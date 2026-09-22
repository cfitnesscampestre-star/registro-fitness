// ═══════════════════════════════════════════════════════════════
// AUDITORÍA DE REGISTROS HUÉRFANOS
// Detecta registros de clase que ya no tienen sentido en reportes:
//   1) inst_id que ya no existe en `instructores` (instructor eliminado)
//   2) clase que ya no aparece en el horario de ningún instructor
//      activo NI en ningún salón (se dejó de impartir / se renombró)
// No borra nada automáticamente: solo agrupa y deja revisar antes
// de eliminar, grupo por grupo o todo junto.
// ═══════════════════════════════════════════════════════════════

function auditoriaCalcular() {
  const clasesEnUso = new Set();
  instructoresActivos().forEach(i => (i.horario || []).forEach(h => clasesEnUso.add(_normClase(h.clase))));
  salones.forEach(s => (s.clases || []).forEach(c => clasesEnUso.add(_normClase(c))));

  const porInst = {};   // instId inexistente → grupo
  const porClase = {};  // clase normalizada → grupo

  registros.forEach(r => {
    const instId = r.inst_id;
    const instExiste = instructores.some(i => String(i.id) === String(instId));

    if (!instExiste) {
      const k = String(instId);
      if (!porInst[k]) porInst[k] = { instId, count: 0, fechaMin: null, fechaMax: null, clases: new Set(), ids: [] };
      const g = porInst[k];
      g.count++; g.ids.push(r.id); g.clases.add(r.clase || '?');
      if (!g.fechaMin || (r.fecha || '') < g.fechaMin) g.fechaMin = r.fecha || '';
      if (!g.fechaMax || (r.fecha || '') > g.fechaMax) g.fechaMax = r.fecha || '';
      return; // ya contado aquí, no lo dupliques en el grupo de clases
    }

    const cn = _normClase(r.clase);
    if (cn && !clasesEnUso.has(cn)) {
      if (!porClase[cn]) porClase[cn] = { clase: r.clase, count: 0, fechaMin: null, fechaMax: null, instNombres: new Set(), ids: [] };
      const g = porClase[cn];
      g.count++; g.ids.push(r.id);
      const inst = instructores.find(i => String(i.id) === String(instId));
      if (inst) g.instNombres.add(inst.nombre);
      if (!g.fechaMin || (r.fecha || '') < g.fechaMin) g.fechaMin = r.fecha || '';
      if (!g.fechaMax || (r.fecha || '') > g.fechaMax) g.fechaMax = r.fecha || '';
    }
  });

  return {
    totalRegistros: registros.length,
    totalClases: new Set(registros.map(r => _normClase(r.clase))).size,
    totalInstructoresRef: new Set(registros.map(r => String(r.inst_id))).size,
    gruposInst: Object.values(porInst).sort((a, b) => b.count - a.count),
    gruposClase: Object.values(porClase).sort((a, b) => b.count - a.count),
  };
}

function _audEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _audFecha(f) { return f ? f.split('-').reverse().join('/') : '—'; }

function abrirAuditoria() {
  document.getElementById('m-auditoria').classList.add('on');
  renderAuditoria();
}

function renderAuditoria() {
  const d = auditoriaCalcular();
  const totalHuerfanos = d.gruposInst.reduce((a, g) => a + g.count, 0) + d.gruposClase.reduce((a, g) => a + g.count, 0);

  document.getElementById('aud-resumen').innerHTML = `
    <div class="rec-card" style="text-align:center;padding:.6rem"><div class="klbl">Total registros</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--neon)">${d.totalRegistros}</div></div>
    <div class="rec-card" style="text-align:center;padding:.6rem"><div class="klbl">Clases distintas</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--txt)">${d.totalClases}</div></div>
    <div class="rec-card" style="text-align:center;padding:.6rem"><div class="klbl">Instructores referenciados</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--txt)">${d.totalInstructoresRef}</div></div>
    <div class="rec-card" style="text-align:center;padding:.6rem;border-color:${totalHuerfanos>0?'var(--red)':'var(--border)'}"><div class="klbl">Registros huérfanos</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:${totalHuerfanos>0?'var(--red2)':'var(--neon)'}">${totalHuerfanos}</div></div>
  `;

  document.getElementById('aud-todo-wrap').style.display = totalHuerfanos > 0 ? 'block' : 'none';

  const bodyInst = document.getElementById('aud-inst-body');
  bodyInst.innerHTML = d.gruposInst.length === 0
    ? '<div class="empty">Ningún registro apunta a un instructor inexistente.</div>'
    : d.gruposInst.map(g => {
        const claseList = [...g.clases].slice(0, 5).join(', ') + (g.clases.size > 5 ? ` +${g.clases.size - 5} más` : '');
        return `<div class="rec-card" style="margin-bottom:.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap">
            <div>
              <div style="font-weight:700">ID de instructor ${_audEsc(g.instId)} <span style="color:var(--txt3);font-weight:400;font-size:.7rem">(ya no existe)</span></div>
              <div style="font-size:.72rem;color:var(--txt2);margin-top:1px">${g.count} registro(s) · ${_audFecha(g.fechaMin)} – ${_audFecha(g.fechaMax)}</div>
              <div style="font-size:.68rem;color:var(--txt3);margin-top:1px">Clases: ${_audEsc(claseList)}</div>
            </div>
            <button class="btn bd" data-ids="${g.ids.join(',')}" data-label="${_audEsc('instructor eliminado (ID ' + g.instId + ')')}" onclick="eliminarGrupoAuditoria(this)">Eliminar ${g.count}</button>
          </div>
        </div>`;
      }).join('');

  const bodyClase = document.getElementById('aud-clase-body');
  bodyClase.innerHTML = d.gruposClase.length === 0
    ? '<div class="empty">Todas las clases registradas siguen asignadas a un profesor o salón.</div>'
    : d.gruposClase.map(g => {
        const instList = [...g.instNombres].slice(0, 4).join(', ') + (g.instNombres.size > 4 ? ` +${g.instNombres.size - 4} más` : '');
        return `<div class="rec-card" style="margin-bottom:.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap">
            <div>
              <div style="font-weight:700">${_audEsc(g.clase)} <span style="color:var(--txt3);font-weight:400;font-size:.7rem">(sin profesor ni salón)</span></div>
              <div style="font-size:.72rem;color:var(--txt2);margin-top:1px">${g.count} registro(s) · ${_audFecha(g.fechaMin)} – ${_audFecha(g.fechaMax)}</div>
              <div style="font-size:.68rem;color:var(--txt3);margin-top:1px">Impartida por: ${_audEsc(instList) || '—'}</div>
            </div>
            <button class="btn bd" data-ids="${g.ids.join(',')}" data-label="${_audEsc('clase "' + g.clase + '"')}" onclick="eliminarGrupoAuditoria(this)">Eliminar ${g.count}</button>
          </div>
        </div>`;
      }).join('');
}

function _eliminarRegistrosPorId(ids) {
  const idSet = new Set(ids.map(Number));
  registros = registros.filter(r => !idSet.has(parseInt(r.id)));
  if (typeof guardarLocal === 'function') guardarLocal();
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderHistorial === 'function' && document.getElementById('v-historial')?.classList.contains('on')) renderHistorial();
  if (typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 800);
}

function eliminarGrupoAuditoria(btn) {
  const ids = (btn.dataset.ids || '').split(',').filter(Boolean).map(Number);
  const label = btn.dataset.label || 'este grupo';
  if (ids.length === 0) return;
  if (!confirm(`¿Eliminar ${ids.length} registro(s) de ${label}?\n\nEsta acción no se puede deshacer.`)) return;
  _eliminarRegistrosPorId(ids);
  registrarLog('sistema', `Auditoría: eliminados ${ids.length} registro(s) huérfano(s) — ${label}`);
  showToast(`${ids.length} registro(s) eliminado(s)`, 'ok');
  renderAuditoria();
}

function eliminarTodosHuerfanos() {
  const d = auditoriaCalcular();
  const ids = [...d.gruposInst.flatMap(g => g.ids), ...d.gruposClase.flatMap(g => g.ids)];
  if (ids.length === 0) return;
  if (!confirm(`¿Eliminar los ${ids.length} registro(s) huérfano(s) detectados (todos los grupos)?\n\nEsta acción no se puede deshacer.`)) return;
  _eliminarRegistrosPorId(ids);
  registrarLog('sistema', `Auditoría: eliminados ${ids.length} registro(s) huérfano(s) (todos los grupos)`);
  showToast(`${ids.length} registro(s) eliminado(s)`, 'ok');
  renderAuditoria();
}
