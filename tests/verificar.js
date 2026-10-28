#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// VERIFICAR NÚMEROS — pruebas automáticas de Fitness Control
//
//   node tests/verificar.js            todas las pruebas
//   node tests/verificar.js suplencias solo las que contienen esa palabra
//
// Cada escenario carga datos con resultado CONOCIDO (calculado a mano) en la app
// real, con una nube falsa (tests/lib/entorno.js), y revisa que pantallas y
// reportes den exactamente esos números.
//
//  ✔ correcto   ✖ número incorrecto (bug: hay que arreglarlo antes de publicar)
//  ⚠ hallazgo conocido: el número es discutible y espera una decisión del
//    equipo. No hace fallar la corrida; si se arregla, pasa a ✔ solo.
// ═══════════════════════════════════════════════════════════════════
const { crearEntorno } = require('./lib/entorno');

const filtro = (process.argv[2] || '').toLowerCase();
const res = { ok: 0, mal: 0, hall: 0, detalle: [] };
let actual = '';

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(que, real, esperado) {
  if (igual(real, esperado)) { res.ok++; console.log(`   ✔ ${que}`); }
  else { res.mal++; const m = `${que}: esperado ${JSON.stringify(esperado)}, salió ${JSON.stringify(real)}`; res.detalle.push(`[${actual}] ${m}`); console.log(`   ✖ ${m}`); }
}
// sigueElBug=true → se muestra como hallazgo; false → ya se corrigió
function hallazgo(que, sigueElBug, detalle) {
  if (sigueElBug) { res.hall++; console.log(`   ⚠ ${que} — ${detalle}`); }
  else { res.ok++; console.log(`   ✔ ${que} (hallazgo ya corregido)`); }
}

// ── Datos de apoyo ─────────────────────────────────────────────────
const LUNES = '2026-10-26';                       // "hoy" en todas las pruebas (lunes)
const A_LAS = h => `${LUNES}T${h}:00-06:00`;      // hora de México
const inst = (id, nombre, slots) => ({ id, nombre, tipo: 'Planta', horario: slots.map(([dia, hora, clase]) => ({ dia, hora, clase })) });
let _id = 1000;
const reg = o => Object.assign({ id: _id++, tipo: 'clase', estado: 'ok', dur: 60, cap: 20, asistentes: 0, suplente_id: null, updatedAt: 1 }, o);
const mapa = arr => arr.reduce((a, x) => { a[String(x.id)] = x; return a; }, {});
const nube = ({ instructores, registros = [], suplencias = [], salones }) =>
  ({ fitness: Object.assign({ ts: 1, instructores, registros: mapa(registros), suplencias: mapa(suplencias) }, salones ? { salones } : {}) });

// Lee los KPI del dashboard por su etiqueta
const kpisDashboard = d => d.ev(() => {
  renderDashboard();
  const o = {};
  document.querySelectorAll('#kpi-row .kpi').forEach(k => {
    const l = k.querySelector('.klbl'), v = k.querySelector('.kval');
    if (l && v) o[l.childNodes[0].textContent.trim()] = v.textContent.trim();
  });
  return o;
});

// ═══════════════════════════════════════════════════════════════════
const ESCENARIOS = [];
const escenario = (nombre, fn) => ESCENARIOS.push({ nombre, fn });

// 1 ─ Números del resumen y de los reportes ─────────────────────────
// Reglas del club: cada clase cuenta 1 hora (solo gimnasia de Gerencia dura lo que dura el grupo);
// la suplencia se suma al titular; el aforo por instructor promedia sus clases y el de una
// disciplina promedia todas las clases de ese tipo, sin importar quién las dio.
escenario('resumen: horas, asistentes, aforo, faltas y suplencias cuadran en todos los reportes', async env => {
  // Ana:   Yoga ok 10/20 (50%) · Yoga ok 15/20 (75%) · Pilates falta · Pilates suplencia de Beto 8/20 (40%)
  //        → 3 impartidas, 1 falta, 3 h, aforo (50+75+40)/3 = 55%, 33 asistentes
  // Beto:  Yoga ok 20/20 (100%) → 1 h · Carla: sin clases (no debe bajar el promedio)
  // Sara:  lista de gimnasia de Gerencia, 18/20 (90%), grupo de 2 h → 2 h
  // Dashboard: 5 impartidas, 1 falta, 71 asistentes, 1 suplencia, aforo (55+100+90)/3 = 82%
  // Disciplina Yoga: 3 sesiones, 45 asistentes, aforo (50+75+100)/3 = 75%
  env.db.sembrar(nube({
    instructores: [inst(1, 'Ana Uno', [['Lunes', '08:00', 'Yoga'], ['Lunes', '09:00', 'Pilates']]),
                   inst(2, 'Beto Dos', [['Lunes', '08:00', 'Yoga']]), inst(3, 'Carla Tres', [['Martes', '10:00', 'Zumba']]),
                   inst(4, 'Sara Ruiz', [['Lunes', '17:00', 'GIMNASIA EQUIPO'], ['Lunes', '18:00', 'GIMNASIA EQUIPO']])],
    registros: [
      reg({ inst_id: 1, dia: 'Lunes', hora: '08:00', clase: 'Yoga', fecha: '2026-10-19', asistentes: 10 }),
      reg({ inst_id: 1, dia: 'Lunes', hora: '08:00', clase: 'Yoga', fecha: LUNES, asistentes: 15 }),
      reg({ inst_id: 1, dia: 'Lunes', hora: '09:00', clase: 'Pilates', fecha: '2026-10-19', estado: 'falta', tipo: 'falta', cap: 0, dur: 0 }),
      reg({ inst_id: 1, dia: 'Lunes', hora: '09:00', clase: 'Pilates', fecha: LUNES, estado: 'sub', suplente_id: 2, asistentes: 8, motivo_suplencia: 'permiso' }),
      reg({ inst_id: 2, dia: 'Lunes', hora: '08:00', clase: 'Yoga', fecha: '2026-10-19', asistentes: 20 }),
      reg({ inst_id: 4, dia: 'Lunes', hora: '17:00', clase: 'Equipo', fecha: LUNES, asistentes: 18, dur: 120, ger_id: 'eq_' + LUNES, asis_ger: 18, ger_insts: [4], origen: 'gerencia' }),
    ]
  }));
  const d = await env.abrir('coordinación', { hora: A_LAS('18:30') });

  const st = await d.ev(() => instructores.map(i => statsInst(i)));
  check('Ana: 3 impartidas, 1 falta, 3 h (la suplencia cuenta al titular), aforo 55%, 33 asistentes', st[0], { impartidas: 3, faltas: 1, horas: '3.0', aforo: 55, totalAsis: 33 });
  check('Beto: su clase 1 h; la que suplió no se le suma', st[1], { impartidas: 1, faltas: 0, horas: '1.0', aforo: 100, totalAsis: 20 });
  check('Sara: la lista de gimnasia de 2 h cuenta 2 h', st[3].horas, '2.0');

  const k = await kpisDashboard(d);
  check('Dashboard · Impartidas', k['Impartidas'], '5');
  check('Dashboard · Faltas', k['Faltas'], '1');
  check('Dashboard · Total asistentes', k['Total Asistentes'], '71');
  check('Dashboard · Suplencias', k['Suplencias'], '1');
  check('Dashboard · Aforo promedio (sin contar a quien no tuvo clases)', k['Aforo Prom.'], '82%');

  // KPIs de un reporte impreso: etiqueta → valor
  const leerKpis = () => {
    const o = {};
    document.querySelectorAll('#print-body div').forEach(x => {
      const n = x.nextElementSibling;
      if (x.children.length === 0 && n && n.children.length === 0) o[x.textContent.trim()] = n.textContent.trim();
    });
    return o;
  };
  const rango = ['2026-09-26', LUNES];

  // Reporte mensual (rango) del mismo periodo debe decir lo mismo que el dashboard
  const m = await d.ev(([[ini, fin], leer]) => {
    document.getElementById('rpt-mes').value = 'rango';
    document.getElementById('rpt-mes-fecha-ini').value = ini;
    document.getElementById('rpt-mes-fecha-fin').value = fin;
    const cs = document.getElementById('rpt-clase-sel'); if (cs) cs.value = '';
    genReporteMensual();
    return eval(leer)();
  }, [rango, leerKpis.toString()]);
  check('Reporte mensual = dashboard (impartidas, faltas, suplencias, asistentes)',
    [m['Clases impartidas'], m['Faltas'], m['Suplencias'], m['Asistentes totales']], ['5', '1', '1', '71']);

  // Reporte por instructor: promedia solo lo que dio ese profesor
  const ri = await d.ev(([[ini, fin], leer]) => {
    const si = document.getElementById('rpt-inst-sel');
    if (![...si.options].some(o => o.value === '1')) si.add(new Option('Ana Uno', '1'));
    si.value = '1';
    document.getElementById('rpt-inst-periodo').value = 'rango';
    document.getElementById('rpt-inst-fecha-ini').value = ini;
    document.getElementById('rpt-inst-fecha-fin').value = fin;
    const cs = document.getElementById('rpt-clase-sel'); if (cs) cs.value = '';
    genReporteInstructor();
    return eval(leer)();
  }, [rango, leerKpis.toString()]);
  check('Reporte por instructor (Ana): 3 sesiones, 33 asistentes, aforo 55%, 1 suplencia',
    [ri['Sesiones'], ri['Asistentes'], ri['Aforo prom.'], ri['Suplencias']], ['3', '33', '55%', '1']);

  // Reporte por disciplina: promedia todas las clases de Yoga, sin importar el profesor
  const rd = await d.ev(([[ini, fin], leer]) => {
    const cs = document.getElementById('rpt-clase-sel');
    if (![...cs.options].some(o => o.value === 'Yoga')) cs.add(new Option('Yoga', 'Yoga'));
    cs.value = 'Yoga';
    document.getElementById('rpt-disc-fecha-ini').value = ini;
    document.getElementById('rpt-disc-fecha-fin').value = fin;
    genReporteDisciplina();
    return eval(leer)();
  }, [rango, leerKpis.toString()]);
  check('Reporte por disciplina (Yoga, Ana + Beto): 3 sesiones, 45 asistentes, aforo 75%',
    [rd['Sesiones'], rd['Total asistentes'], rd['Aforo promedio']], ['3', '45', '75%']);

  // Reporte de suplencias
  const s = await d.ev(([ini, fin]) => {
    abrirModal('m-suplencias');
    document.getElementById('sup-fecha-ini').value = ini; document.getElementById('sup-fecha-fin').value = fin;
    document.getElementById('sup-filtro-inst').value = '';
    renderReporteSuplencias();
    return { n: (window.lastSuplencias || []).length, sup: (document.querySelector('#sup-body tbody tr td:nth-child(3)') || {}).textContent };
  }, rango);
  check('Reporte de suplencias: 1 suplencia, cubierta por Beto', [s.n, s.sup], [1, 'Beto Dos']);
});

// 2 ─ Pantalla Hoy y gimnasia desde Gerencia ─────────────────────────
escenario('hoy + gimnasia: una lista de Gerencia cubre todas las horas y cuenta a las niñas una vez', async env => {
  env.db.sembrar(nube({
    instructores: [
      inst(1, 'Sara Ruiz', [['Lunes', '17:00', 'GIMNASIA EQUIPO'], ['Lunes', '18:00', 'GIMNASIA EQUIPO']]),
      inst(2, 'Jimena Soto', [['Lunes', '17:00', 'GIMNASIA EQUIPO'], ['Lunes', '18:00', 'GIMNASIA EQUIPO']]),
      inst(3, 'Valeria Salas', [['Lunes', '16:00', 'GIMNASIA RITMICA'], ['Lunes', '17:00', 'GIMNASIA RITMICA']]),
      inst(4, 'Cristi Romo', [['Lunes', '18:00', 'RPM']]),
    ]
  }));
  env.db.sembrar({ 'gerencia_deportes/data/gimnasia': {
    profesores: { p1: { nombre: 'Sara Ruiz Velasco' }, p2: { nombre: 'Jimena Areli Soto' }, p3: { nombre: 'Valeria Salas' } },
    grupos: {
      eq: { nombre: 'Equipo', profDia: { d0: 'p2,p1' }, horDia: { d0: '17:00|19:00' }, cupo: 20 },
      g1: { nombre: 'Grupo 1 de 4 a 7 años', profId: 'p3', hi: '16:00', hf: '17:00', cupo: 9 },
    },
    asistencia: {
      a1: { id: 'eq_' + LUNES, grupoId: 'eq', fecha: LUNES, asistentes: 18, porProf: 'p1' },   // pasó lista Sara
      a2: { id: 'g1_' + LUNES, grupoId: 'g1', fecha: LUNES, asistentes: 3, porProf: 'p3' },
    }
  } });
  const d = await env.abrir('coordinación', { hora: A_LAS('18:30') });
  await d.esperar(() => registros.some(r => r.ger_id), null, 15000, 'importación de Gerencia');
  await d.calma(1200);

  const eq = await d.ev(() => registros.filter(r => String(r.ger_id || '').startsWith('eq_')).map(r => ({ inst: r.inst_id, hora: r.hora, dur: r.dur, asis: r.asistentes, profs: (r.ger_insts || []).map(Number).sort() })));
  check('Equipo: UN registro de 120 min con 18 niñas, a nombre de quien pasó lista', eq, [{ inst: 1, hora: '17:00', dur: 120, asis: 18, profs: [1, 2] }]);

  const hoy = await d.ev(() => {
    switchSection('hoy');
    const l = [...document.querySelectorAll('#mob-clases-lista .mob-clase-item')].map(x => x.innerText.replace(/\s+/g, ' ').trim());
    return { pend: l.filter(t => /Pendiente/.test(t)).map(t => t.split(' ').slice(0, 3).join(' ')), total: l.length };
  });
  check('Hoy: solo quedan pendientes Valeria 17:00 (otro grupo) y RPM 18:00', hoy.pend.sort(), ['17:00 GIMNASIA RITMICA', '18:00 RPM CRISTI'].sort());
  check('Hoy: 7 clases en la lista', hoy.total, 7);

  const k = await kpisDashboard(d);
  check('Dashboard: las 18 niñas cuentan una vez (18 + 3 = 21)', k['Total Asistentes'], '21');
  const enNube = Object.values(env.db.leer('fitness/registros') || {}).filter(r => r.ger_id).length;
  check('Los 2 registros importados están en la nube', enNube, 2);
});

// 3 ─ Recorrido: actualizar el número no borra la suplencia ──────────
escenario('recorrido: volver a pasar para actualizar el número conserva la suplencia', async env => {
  env.db.sembrar(nube({
    instructores: [inst(1, 'Ana Romo', [['Lunes', '18:00', 'Pilates']]), inst(2, 'Cristi Romo', [['Lunes', '18:00', 'RPM']]),
                   Object.assign(inst(3, 'Exprofe Baja', []), { baja: '2026-01-01' })],
    registros: [
      reg({ id: 1, inst_id: 1, dia: 'Lunes', hora: '18:00', clase: 'Pilates', fecha: LUNES, estado: 'sub', suplente_id: null, suplente_nombre: 'Laura Pérez', motivo_suplencia: 'vacaciones', asistentes: 8, tipo: 'recorrido' }),
      reg({ id: 2, inst_id: 2, dia: 'Lunes', hora: '18:00', clase: 'RPM', fecha: LUNES, estado: 'sub', suplente_id: 3, motivo_suplencia: 'permiso', asistentes: 5, tipo: 'recorrido' }),
    ]
  }));
  const d = await env.abrir('coordinación', { hora: A_LAS('18:40') });
  // Recorrido turbo de las 18:10: Pilates (externa) se actualiza a 10; RPM (suplente dado de baja) se guarda deslizando →
  await d.ev(() => {
    recActual = { fecha: '2026-10-26', hora: '18:10', dia: 'Lunes', items: [], clasesActivas: getClasesActivas('Lunes', '18:10', '2026-10-26') };
    recIdx = 0; modoRecorrido = 'turbo'; iniciarTurbo();
  });
  for (let i = 0; i < 2; i++) {
    const clase = await d.ev(() => recActual.clasesActivas[recIdx].clase);
    if (clase === 'Pilates') {
      await d.ev(() => { document.getElementById('tc-asis').value = '10'; turboGuardar(); });
    } else {
      await d.ev(() => {                                   // deslizar a la derecha (gesto real con eventos táctiles)
        const card = document.getElementById('turbo-card');
        const t = x => new Touch({ identifier: 1, target: card, clientX: x, clientY: 300 });
        card.dispatchEvent(new TouchEvent('touchstart', { touches: [t(100)], changedTouches: [t(100)], bubbles: true }));
        card.dispatchEvent(new TouchEvent('touchmove', { touches: [t(260)], changedTouches: [t(260)], bubbles: true }));
        card.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(260)], bubbles: true }));
      });
    }
    await d.page.waitForTimeout(450);
  }
  await d.ev(() => { window.confirm = () => true; guardarRecorrido(); });
  await d.calma();
  const r = await d.ev(() => registros.filter(x => x.fecha === '2026-10-26').sort((a, b) => a.inst_id - b.inst_id)
    .map(x => ({ estado: x.estado, sup: x.suplente_id || x.suplente_nombre, mot: x.motivo_suplencia, asis: x.asistentes })));
  check('Pilates: sigue con suplente externo, número actualizado a 10', r[0], { estado: 'sub', sup: 'Laura Pérez', mot: 'vacaciones', asis: 10 });
  check('RPM: deslizar → no quita la suplencia (suplente dado de baja se conserva)', r[1], { estado: 'sub', sup: 3, mot: 'permiso', asis: 5 });
  check('Sin registros duplicados', await d.ev(() => registros.length), 2);
  const n = env.db.leer('fitness/registros/1');
  check('En la nube también quedó como suplencia con 10', [n && n.estado, n && n.asistentes], ['sub', 10]);
});

// 4 ─ Suplencias programadas que no cuentan ─────────────────────────
escenario('suplencias: el reporte avisa de las programadas que no cuentan', async env => {
  env.db.sembrar(nube({
    instructores: [inst(1, 'Ana Romo', [['Lunes', '18:00', 'Pilates']]), inst(2, 'Cristi Romo', [['Lunes', '07:00', 'RPM']]), inst(3, 'Coyito', [])],
    registros: [
      reg({ inst_id: 1, dia: 'Lunes', hora: '18:00', clase: 'Pilates', fecha: '2026-10-19', asistentes: 9 }),                      // programada pero registrada como impartida
      reg({ inst_id: 2, dia: 'Lunes', hora: '07:00', clase: 'RPM', fecha: '2026-10-19', estado: 'sub', suplente_id: 3, asistentes: 6 }), // bien registrada
    ],
    suplencias: [
      { id: 1, inst_id: 1, suplente_id: 3, clase: 'Pilates', dia: 'Lunes', hora: '18:00', fecha: '2026-10-19', motivo: 'permiso', estado: 'aprobado' },
      { id: 2, inst_id: 2, suplente_id: 3, clase: 'RPM', dia: 'Lunes', hora: '07:00', fecha: '2026-10-19', motivo: 'permiso', estado: 'aprobado' },
      { id: 3, inst_id: 2, suplente_id: 1, clase: 'RPM', dia: 'Lunes', hora: '07:00', fecha: LUNES, motivo: 'vacaciones', estado: 'aprobado' },   // sin registro
      { id: 4, inst_id: 2, suplente_id: 1, clase: 'RPM', dia: 'Lunes', hora: '07:00', fecha: '2026-11-02', motivo: 'permiso', estado: 'aprobado' }, // futura: no cuenta aún
    ]
  }));
  const d = await env.abrir('coordinación', { hora: A_LAS('18:30') });
  const s = await d.ev(() => {
    abrirModal('m-suplencias');
    document.getElementById('sup-fecha-ini').value = '2026-10-01'; document.getElementById('sup-fecha-fin').value = '2026-11-30';
    renderReporteSuplencias();
    const aviso = [...document.querySelectorAll('#sup-body div')].find(x => /programada\(s\) que no cuentan/.test(x.textContent));
    return { contadas: (window.lastSuplencias || []).length, aviso: aviso ? aviso.textContent.match(/(\d+) suplencia/)[1] : '0',
      motivos: [...document.querySelectorAll('#sup-body tr td:nth-child(3)')].map(x => x.textContent).filter(t => /registr/i.test(t)).sort() };
  });
  check('Reporte: cuenta 1 suplencia registrada', s.contadas, 1);
  check('Aviso: 2 programadas no cuentan (la futura no se avisa)', s.aviso, '2');
  check('Aviso: dice por qué', s.motivos, ['La clase no se registró', 'Registrada como impartida (9 pers.)']);
});

// 5 ─ Dos dispositivos ──────────────────────────────────────────────
escenario('sincronización: dos dispositivos guardando a la vez, sin señal y borrando', async env => {
  env.db.sembrar(nube({
    instructores: [inst(1, 'Ana Uno', [['Lunes', '08:00', 'Yoga'], ['Lunes', '09:00', 'Pilates'], ['Lunes', '10:00', 'Zumba']])],
    registros: [reg({ id: 7, inst_id: 1, dia: 'Lunes', hora: '10:00', clase: 'Zumba', fecha: '2026-10-19', asistentes: 4 })]
  }));
  const cel = await env.abrir('celular', { hora: A_LAS('18:30') });
  const compu = await env.abrir('compu', { hora: A_LAS('18:30') });
  const nuevo = (d, hora, clase, asis) => d.ev(([hora, clase, asis]) => {
    registros.push({ id: Date.now() * 1000 + Math.floor(Math.random() * 1000), inst_id: 1, dia: 'Lunes', hora, clase, fecha: '2026-10-26', estado: 'ok', asistentes: asis, cap: 20, dur: 60, tipo: 'clase', updatedAt: Date.now() });
    renderAll();
  }, [hora, clase, asis]);
  const enNube = () => Object.values(env.db.leer('fitness/registros') || {}).map(r => r.clase).sort();
  const enDisp = d => d.ev(() => registros.map(r => r.clase).sort());

  // a) a la vez
  await Promise.all([nuevo(cel, '08:00', 'Yoga', 11), nuevo(compu, '09:00', 'Pilates', 12)]);
  await cel.calma(2500);
  check('A la vez: la nube tiene las dos clases', enNube(), ['Pilates', 'Yoga', 'Zumba']);
  check('A la vez: el celular ve las dos', await enDisp(cel), ['Pilates', 'Yoga', 'Zumba']);
  check('A la vez: la compu ve las dos', await enDisp(compu), ['Pilates', 'Yoga', 'Zumba']);

  // b) celular sin señal captura; la compu borra Zumba y captura otra; el celular vuelve
  await cel.quitarSenal();
  await nuevo(cel, '08:00', 'Yoga-tarde', 7);
  await compu.ev(() => { window.confirm = () => true; document.getElementById('er-id').value = registros.find(r => r.clase === 'Zumba').id; eliminarRegistro(); });
  await nuevo(compu, '09:00', 'Pilates-tarde', 9);
  await compu.calma(1500);
  await cel.calma(1000);
  await cel.volverSenal();
  await cel.calma(2500);
  await compu.calma(500);
  check('Sin señal: no se pierde lo que capturó la compu mientras tanto', enNube().includes('Pilates-tarde'), true);
  check('Sin señal: lo del celular llega al reconectar', enNube().includes('Yoga-tarde'), true);
  check('Borrado: Zumba no regresa desde el celular atrasado', enNube().includes('Zumba'), false);
  check('Borrado: el celular también la quita', (await enDisp(cel)).includes('Zumba'), false);
  check('Al final los dos dispositivos ven lo mismo que la nube', [await enDisp(cel), await enDisp(compu)], [enNube(), enNube()]);
  const ids = Object.keys(env.db.leer('fitness/registros') || {});
  check('Ids sin repetir', ids.length, new Set(ids).size);
});

// 6 ─ Portal de la profesora ────────────────────────────────────────
escenario('portal: la clase con suplencia programada se guarda como suplencia', async env => {
  env.db.sembrar(nube({
    instructores: [inst(1, 'Ana Romo', [['Lunes', '17:00', 'Pilates']]), inst(2, 'Cristi Romo', [])],
    suplencias: [{ id: 9, inst_id: 1, suplente_id: 2, clase: 'Pilates', dia: 'Lunes', hora: '17:00', fecha: LUNES, motivo: 'incapacidad', estado: 'aprobado' }]
  }));
  const d = await env.abrir('portal de Ana', { hora: A_LAS('17:20'), rol: 'instructor', instId: 1 });
  await d.esperar(() => window._instHoyCtx && window._instHoyCtx.items && window._instHoyCtx.items.length > 0, null, 8000, 'clases del portal');
  await d.ev(() => {
    const idx = window._instHoyCtx.items.findIndex(x => x.slot.clase === 'Pilates');
    instCapAbrir(idx);
    document.getElementById('cp-num').value = '9';
    document.getElementById('cp-guardar').click();
  });
  await d.calma(1500);
  const n = Object.values(env.db.leer('fitness/registros') || {});
  check('Se guardó UN registro como suplencia de Cristi, con 9 personas', n.map(r => [r.estado, r.suplente_id, r.motivo_suplencia, r.asistentes]), [['sub', 2, 'incapacidad', 9]]);
});

// 7a ─ Cupo de las clases ───────────────────────────────────────────
escenario('cupo: "+ Clase" y recorrido proponen el cupo del salón (o el último guardado)', async env => {
  env.db.sembrar(nube({
    salones: [{ id: 1, nombre: 'Estudio Spinning', cap: 25, tipo: 'spinning', clases: ['RPM'] }],
    instructores: [inst(1, 'Cristi Romo', [['Lunes', '18:00', 'RPM']]), inst(2, 'Mateo Padilla', [['Lunes', '18:00', 'BOX'], ['Martes', '18:00', 'BOX']]),
                   inst(3, 'Ana Romo', [['Lunes', '18:00', 'Step']])],
    registros: [reg({ inst_id: 2, dia: 'Martes', hora: '18:00', clase: 'BOX', fecha: '2026-10-20', asistentes: 6, cap: 12 })]   // BOX sin salón, se escribió 12
  }));
  const d = await env.abrir('coordinación', { hora: A_LAS('18:30') });
  const capClase = (instId, clase) => d.ev(async ([instId, clase]) => {
    abrirRegistroDesdeCalendario(instId, 'Lunes', '18:00', clase, '2026-10-26');
    await new Promise(r => setTimeout(r, 250));
    const v = document.getElementById('rc-cap').value, nota = document.getElementById('rc-cap-nota');
    cerrarModal('m-clase');
    return [v, !!(nota && nota.style.display !== 'none' && nota.textContent)];
  }, [instId, clase]);
  const capRec = clase => d.ev(async clase => {
    recActual = { fecha: '2026-10-26', hora: '18:10', dia: 'Lunes', items: [], clasesActivas: getClasesActivas('Lunes', '18:10', '2026-10-26') };
    recIdx = recActual.clasesActivas.findIndex(c => c.clase === clase); modoRecorrido = 'turbo'; iniciarTurbo();
    await new Promise(r => setTimeout(r, 300));
    const v = document.getElementById('tc-cap').value;
    document.getElementById('turbo-screen').style.display = 'none';
    return v;
  }, clase);

  check('+ Clase · RPM (salón Spinning): cupo 25, sin aviso', await capClase(1, 'RPM'), ['25', false]);
  check('Recorrido · RPM: cupo 25', await capRec('RPM'), '25');
  // Cambiar el cupo del salón como lo hace la persona (Salones → editar → guardar)
  await d.ev(() => { abrirModalSalon(1); document.getElementById('ms-cap').value = '30'; guardarSalon(); });
  await d.calma(1200);
  check('Tras cambiar el salón a 30: "+ Clase" propone 30', await capClase(1, 'RPM'), ['30', false]);
  check('Tras cambiar el salón a 30: recorrido propone 30', await capRec('RPM'), '30');
  check('+ Clase · BOX sin salón: el último cupo guardado (12), con aviso', await capClase(2, 'BOX'), ['12', true]);
  check('Recorrido · BOX sin salón: 12', await capRec('BOX'), '12');
  check('+ Clase · Step nunca registrada y sin salón: 20', (await capClase(3, 'Step'))[0], '20');
});

escenario('salones: un teléfono que estuvo sin señal no regresa el cupo viejo', async env => {
  env.db.sembrar(nube({
    salones: [{ id: 1, nombre: 'Estudio Spinning', cap: 25, tipo: 'spinning', clases: ['RPM'] }],
    instructores: [inst(1, 'Cristi Romo', [['Lunes', '18:00', 'RPM']])]
  }));
  const cel = await env.abrir('celular', { hora: A_LAS('18:30') });
  const compu = await env.abrir('compu', { hora: A_LAS('18:30') });
  await cel.quitarSenal();
  await cel.ev(() => { registros.push({ id: nuevoIdRegistro(), inst_id: 1, dia: 'Lunes', hora: '18:00', clase: 'RPM', fecha: '2026-10-26',
    estado: 'ok', asistentes: 15, cap: 25, dur: 60, tipo: 'clase', updatedAt: Date.now() }); renderAll(); });
  await cel.calma(1500);
  await compu.ev(() => { abrirModalSalon(1); document.getElementById('ms-cap').value = '30'; guardarSalon(); });
  await compu.calma(1500);
  await cel.volverSenal();
  await cel.calma(2500);
  const s = env.db.leer('fitness/salones');
  check('La nube conserva el cupo nuevo del salón (30)', s && s[0] && s[0].cap, 30);
  check('El celular también lo tiene', await cel.ev(() => salones[0].cap), 30);
  check('Y el registro que hizo sin señal llegó', Object.values(env.db.leer('fitness/registros') || {}).length, 1);
});

// 7b ─ Rendimiento ──────────────────────────────────────────────────
escenario('rendimiento: cada guardado sube solo lo que cambió', async env => {
  // Subir todos los registros por ruta en cada guardado congelaba el celular 3-4 s (3,000 registros).
  const regs = [];
  for (let i = 0; i < 3000; i++) regs.push(reg({ id: 50000 + i, inst_id: 1, dia: 'Lunes', hora: '08:00', clase: 'Yoga',
    fecha: `2026-${String(1 + (i % 9)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, asistentes: i % 20 }));
  env.db.sembrar(nube({ instructores: [inst(1, 'Ana Uno', [['Lunes', '08:00', 'Yoga']])], registros: regs }));
  const d = await env.abrir('coordinación', { hora: A_LAS('09:00') });
  await d.calma(2000);
  const subidos = () => env.db.escrituras.filter(e => e.op === 'update').reduce((a, e) => a + e.registros, 0);
  check('Abrir la app no vuelve a subir los 3,000 registros', subidos(), 0);
  env.db.escrituras = [];
  await d.ev(() => { registros.push({ id: nuevoIdRegistro(), inst_id: 1, dia: 'Lunes', hora: '08:00', clase: 'Yoga', fecha: '2026-10-26',
    estado: 'ok', asistentes: 9, cap: 20, dur: 60, tipo: 'clase', updatedAt: Date.now() }); renderAll(); });
  await d.calma(2000);
  check('Guardar una clase sube 1 registro', subidos(), 1);
  env.db.escrituras = [];
  await d.ev(() => { const r = registros.find(x => x.id === 50010); r.asistentes = 19; r.updatedAt = Date.now(); renderAll(); });
  await d.calma(2000);
  check('Editar un registro sube solo ese', subidos(), 1);
  check('La nube conserva los 3,001 registros', Object.keys(env.db.leer('fitness/registros') || {}).length, 3001);
});

// 7 ─ Ids ───────────────────────────────────────────────────────────
escenario('ids: los registros nuevos nunca repiten id', async env => {
  env.db.sembrar(nube({ instructores: [inst(1, 'Ana Uno', [])] }));
  const d = await env.abrir('coordinación', { hora: A_LAS('09:00') });
  const r = await d.ev(() => { const s = new Set(); let seguros = true;
    for (let i = 0; i < 3000; i++) { const id = nuevoIdRegistro(); s.add(id); registros.push({ id }); if (!Number.isSafeInteger(id)) seguros = false; }
    registros = []; return [s.size, seguros]; });
  check('3000 ids seguidos: todos distintos y enteros seguros', r, [3000, true]);
});

// ═══════════════════════════════════════════════════════════════════
(async () => {
  const lista = ESCENARIOS.filter(e => !filtro || e.nombre.toLowerCase().includes(filtro));
  console.log(`\nVerificar números · ${lista.length} escenario(s)\n`);
  for (const e of lista) {
    actual = e.nombre;
    console.log(`▸ ${e.nombre}`);
    let env;
    try {
      env = await crearEntorno();
      await e.fn(env);
      const errs = env.dispositivos.flatMap(d => d.errores.map(m => `${d.nombre}: ${m}`));
      check('sin errores de JavaScript en la app', errs, []);
    } catch (err) {
      res.mal++; res.detalle.push(`[${e.nombre}] no terminó: ${err.message}`);
      console.log(`   ✖ no terminó: ${err.message}`);
    } finally { if (env) await env.cerrar(); }
  }
  console.log(`\n${res.ok} correctas · ${res.mal} incorrectas · ${res.hall} hallazgo(s) conocido(s)`);
  if (res.mal) { console.log('\nIncorrectas:'); res.detalle.forEach(x => console.log(' - ' + x)); }
  process.exit(res.mal ? 1 : 0);
})();
