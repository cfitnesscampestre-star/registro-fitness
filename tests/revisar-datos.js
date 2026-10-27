#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// REVISAR DATOS REALES — busca registros que harían salir números incorrectos
//
//   node tests/revisar-datos.js respaldo.json [desde AAAA-MM-DD] [hasta AAAA-MM-DD]
//
// respaldo.json: exportación de la base de Firebase (consola de Firebase →
// Realtime Database → ⋮ → Exportar JSON). Sirve la base completa o solo el nodo
// "fitness". Solo LEE el archivo; no se conecta a nada ni cambia datos.
//
//  ✖ error: el dato está mal y altera reportes (hay que corregirlo)
//  ⚠ aviso: raro, conviene revisarlo
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');

const [archivo, desde = '', hasta = ''] = process.argv.slice(2);
if (!archivo) { console.log('Uso: node tests/revisar-datos.js respaldo.json [desde AAAA-MM-DD] [hasta AAAA-MM-DD]'); process.exit(2); }
let raiz = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const F = raiz.fitness || raiz;
const vals = o => (Array.isArray(o) ? o : Object.values(o || {})).filter(x => x && typeof x === 'object');

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const instructores = vals(F.instructores);
const instPorId = new Map(instructores.map(i => [String(i.id), i]));
const regsMapa = F.registros || {};
const registrosTodos = Object.entries(Array.isArray(regsMapa) ? Object.assign({}, regsMapa) : regsMapa)
  .filter(([, r]) => r && typeof r === 'object').map(([k, r]) => ({ ...r, __key: k }));
const enRango = f => (!desde || (f || '') >= desde) && (!hasta || (f || '') <= hasta);
const registros = registrosTodos.filter(r => enRango(r.fecha));
const suplencias = vals(F.suplencias);
const borrados = (F.borrados && F.borrados.registros) || {};
const hoy = new Date().toISOString().slice(0, 10);
const nombre = id => (instPorId.get(String(id)) || {}).nombre || `id ${id}`;
const desc = r => `${r.fecha || '¿fecha?'} ${r.hora || ''} ${r.clase || '¿clase?'} · ${nombre(r.inst_id)} (id ${r.id})`;
const diaDe = f => { const [y, m, d] = String(f).split('-').map(Number); return DIAS[(new Date(y, m - 1, d).getDay() + 6) % 7]; };
const horario = (inst, fecha) => {         // igual que getHorarioEn (core.js)
  if (!inst) return [];
  const hv = (Array.isArray(inst.hv) ? inst.hv : vals(inst.hv)).filter(Boolean);
  if (!hv.length) return inst.horario ? vals(inst.horario) : [];
  let vig = null, min = null;
  hv.forEach(v => { const d = v.desde || '1970-01-01'; if (!min || d < (min.desde || '1970-01-01')) min = v;
    if (d <= fecha && (!vig || d >= (vig.desde || '1970-01-01'))) vig = v; });
  return vals((vig || min).slots);
};

const hallazgos = [];
const add = (nivel, regla, texto) => hallazgos.push({ nivel, regla, texto });
const imp = r => r.estado === 'ok' || r.estado === 'sub';

// ── Reglas ─────────────────────────────────────────────────────────
// Duplicados: dos registros de la misma clase cuentan dos veces asistentes y horas
const grupos = {};
registros.filter(r => r.estado === 'ok' || r.estado === 'sub' || r.estado === 'falta').filter(r => r.tipo !== 'falta')
  .forEach(r => { const k = [r.inst_id, r.fecha, r.hora, r.clase].join('|'); (grupos[k] = grupos[k] || []).push(r); });
Object.values(grupos).filter(g => g.length > 1).forEach(g =>
  add('error', 'Registro duplicado', `${desc(g[0])} aparece ${g.length} veces (ids ${g.map(r => r.id).join(', ')}) → asistentes y horas se cuentan doble`));

registros.forEach(r => {
  if (String(r.id) !== r.__key) add('error', 'Id distinto a su clave', `${desc(r)} está guardado bajo la clave ${r.__key}`);
  if (borrados[String(r.id)]) add('error', 'Borrado que regresó', `${desc(r)} tiene marca de borrado pero sigue en registros`);
  if (!instPorId.has(String(r.inst_id))) add('error', 'Instructor inexistente', `${desc(r)}: no hay instructor con id ${r.inst_id}`);
  if (!['ok', 'sub', 'falta'].includes(r.estado)) add('error', 'Estado desconocido', `${desc(r)}: estado "${r.estado}" no lo cuenta ningún reporte`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || ''))) add('error', 'Fecha inválida', `${desc(r)}: fecha "${r.fecha}"`);
  else {
    if (r.fecha > hoy) add('aviso', 'Fecha futura', desc(r));
    if (r.dia && r.tipo !== 'falta' && diaDe(r.fecha) !== r.dia) add('error', 'Día no coincide con la fecha', `${desc(r)}: dice ${r.dia} pero ${r.fecha} es ${diaDe(r.fecha)} → no se empareja con su horario y la clase sale Pendiente`);
  }
  if (r.tipo !== 'falta' && !/^\d{2}:\d{2}$/.test(String(r.hora || ''))) add('error', 'Hora inválida', `${desc(r)}: hora "${r.hora}"`);
  if (r.estado === 'sub') {
    if (!r.suplente_id && !r.suplente_nombre) add('error', 'Suplencia sin suplente', `${desc(r)}: no dice quién cubrió (sale "—" en el reporte y en la hoja de firmas)`);
    if (r.suplente_id && String(r.suplente_id) === String(r.inst_id)) add('error', 'Suplente = titular', desc(r));
    if (r.suplente_id && !instPorId.has(String(r.suplente_id))) add('error', 'Suplente inexistente', `${desc(r)}: suplente_id ${r.suplente_id}`);
  }
  if (imp(r)) {
    const a = parseInt(r.asistentes, 10), c = parseInt(r.cap, 10);
    if (isNaN(a) || a < 0) add('error', 'Asistentes inválidos', `${desc(r)}: "${r.asistentes}"`);
    if (!(c > 0)) add('aviso', 'Sin capacidad', `${desc(r)}: sin cupo, no entra al aforo promedio`);
    else if (a > c * 1.5) add('error', 'Asistentes muy por encima del cupo', `${desc(r)}: ${a} de ${c} (${Math.round(a / c * 100)}%)`);
    else if (a > c) add('aviso', 'Asistentes sobre el cupo', `${desc(r)}: ${a} de ${c}`);
    // Regla del club: cada clase es 1 hora; solo las listas de gimnasia (Gerencia) duran lo que dura el grupo
    const dur = parseInt(r.dur, 10);
    if (r.ger_id) { if (dur > 240) add('aviso', 'Duración muy larga', `${desc(r)}: ${dur} min`); }
    else if (dur > 0 && dur !== 60) add('aviso', 'Clase que no dura 1 hora', `${desc(r)}: ${dur} min → suma ${(dur / 60).toFixed(1)} h en el resumen en vez de 1 h`);
    if (r.ger_id && !Array.isArray(r.ger_insts) && typeof r.ger_insts !== 'object') add('aviso', 'Gimnasia sin profesoras del grupo', `${desc(r)}: importado antes del cambio; sus horas extra salen Pendiente hasta la próxima sincronización`);
    if (!r.ger_id && r.tipo !== 'falta') {
      const inst = instPorId.get(String(r.inst_id));
      const tiene = horario(inst, r.fecha).some(s => s.dia === r.dia && s.hora === r.hora);
      if (inst && !tiene) add('aviso', 'Clase fuera del horario', `${desc(r)}: el instructor no tenía clase ese día a esa hora`);
    }
  }
  if (!r.updatedAt) add('aviso', 'Sin fecha de modificación', `${desc(r)}: si dos dispositivos lo editan, no se sabe cuál es el más nuevo`);
});

// Suplencias programadas que no cuentan en el reporte
suplencias.filter(s => s.fecha && s.fecha <= hoy && enRango(s.fecha) && (s.estado === 'aprobado' || !s.estado)).forEach(s => {
  const rs = registrosTodos.filter(r => String(r.inst_id) === String(s.inst_id) && r.fecha === s.fecha && r.hora === s.hora);
  if (rs.some(r => r.estado === 'sub')) return;
  const que = !rs.length ? 'la clase no se registró' : `registrada como ${rs[rs.length - 1].estado === 'ok' ? 'impartida' : rs[rs.length - 1].estado}`;
  add('aviso', 'Suplencia programada que no cuenta', `${s.fecha} ${s.hora} ${s.clase || ''} · ${nombre(s.inst_id)} → ${s.suplente_id ? nombre(s.suplente_id) : (s.suplente_nombre || 'externo')}: ${que}`);
});

// ── Resumen ────────────────────────────────────────────────────────
const tot = registros.filter(imp);
console.log(`\nRevisión de datos · ${registros.length} registros${desde || hasta ? ` (${desde || '…'} a ${hasta || '…'})` : ''} · ${instructores.length} instructores · ${suplencias.length} suplencias programadas`);
console.log(`Cifras del periodo: ${tot.length} impartidas · ${registros.filter(r => r.estado === 'falta').length} faltas · ${registros.filter(r => r.estado === 'sub').length} suplencias · ${tot.reduce((a, r) => a + (parseInt(r.asistentes, 10) || 0), 0)} asistentes\n`);
const porRegla = {};
hallazgos.forEach(h => { (porRegla[h.regla] = porRegla[h.regla] || { nivel: h.nivel, items: [] }).items.push(h.texto); });
const orden = Object.entries(porRegla).sort((a, b) => (a[1].nivel === b[1].nivel ? b[1].items.length - a[1].items.length : a[1].nivel === 'error' ? -1 : 1));
if (!orden.length) console.log('✔ No se encontró nada raro.');
orden.forEach(([regla, { nivel, items }]) => {
  console.log(`${nivel === 'error' ? '✖' : '⚠'} ${regla}: ${items.length}`);
  items.slice(0, 8).forEach(t => console.log(`    · ${t}`));
  if (items.length > 8) console.log(`    · …y ${items.length - 8} más`);
});
const errores = hallazgos.filter(h => h.nivel === 'error').length;
console.log(`\n${errores} error(es) · ${hallazgos.length - errores} aviso(s)`);
process.exit(errores ? 1 : 0);
