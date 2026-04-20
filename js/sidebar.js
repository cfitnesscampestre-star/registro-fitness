// ═══ SIDEBAR — sincronización de estado activo ═══════════════════
function _syncSidebar(section, viewId) {
  // Quitar .on de todos los items
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('on'));
  document.querySelectorAll('.sb-sub-item').forEach(i => i.classList.remove('on'));

  // Activar el item de la vista actual (si existe como item directo)
  const sbEl = document.getElementById('sb-' + viewId);
  if(sbEl) sbEl.classList.add('on');

  // Si no hay item directo, activar el de la sección
  if(!sbEl) {
    const sbSec = document.querySelector(`.sb-item[data-s="${section}"]`);
    if(sbSec) sbSec.classList.add('on');
  }

  // Badge Hoy
  const badge = document.getElementById('sb-hoy-badge');
  const badgeSrc = document.getElementById('snav-hoy-badge');
  if(badge && badgeSrc) {
    badge.style.display = badgeSrc.style.display;
    badge.textContent = badgeSrc.textContent;
  }
}

// Mostrar botón de collapse solo en PC >900px
(function() {
  function checkCollapseBtn() {
    const btn = document.getElementById('sb-collapse-btn');
    if(btn) btn.style.display = window.innerWidth > 900 ? 'flex' : 'none';
  }
  checkCollapseBtn();
  window.addEventListener('resize', checkCollapseBtn);
})();

// Colapsar / expandir sidebar
let _sidebarCollapsed = false;
function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sb = document.getElementById('sidebar');
  if(sb) sb.classList.toggle('collapsed', _sidebarCollapsed);
  try { localStorage.setItem('fc_sb_collapsed', _sidebarCollapsed ? '1' : '0'); } catch(e){}
}

// Restaurar estado de collapse
(function() {
  if(localStorage.getItem('fc_sb_collapsed') === '1' && window.innerWidth > 900) {
    const sb = document.getElementById('sidebar');
    if(sb) { sb.classList.add('collapsed'); _sidebarCollapsed = true; }
  }
})();



// ═══════════════════════════════════════════════════════════════════
// MÓDULO: REPORTE DEPORTIVO SEMANAL — v2 (dinámico + sistema)
// ═══════════════════════════════════════════════════════════════════

let _repDep = {
  iniDate:'', finDate:'',
  disciplina:'', semana:'', director:'',
  objAnterior:'', objCumplido:'', objProximo:'',
  alumTotal:'', alumAsistencia:'', alumNuevos:'', alumEdades:'',
  profTotal:'', profClases:'', profInasistencias:'',
  profDestacadoId:'', profDestacadoRazon:'',
  profMenosId:'', profMenosRazon:'',
  competencias:[''],
  logros:[{logro:'', descripcion:'', redes:'No'}],
  incidencias:[{incidencia:'', solucion:''}],
  ayuda:''
};

// ─── Helpers de fecha ────────────────────────────────────────────
function _repGetLunesViernes() {
  const hoy = new Date();
  const dow = hoy.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + diff);
  const viernes = new Date(lunes); viernes.setDate(lunes.getDate() + 4);
  return {
    ini: fechaLocalStr(lunes),
    fin: fechaLocalStr(viernes)
  };
}

function _repFmtFecha(iso) {
  if(!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-MX', {day:'numeric', month:'long'});
}

function _repFmtSemana(ini, fin) {
  if(!ini || !fin) return '';
  const dI = new Date(ini + 'T12:00:00');
  const dF = new Date(fin + 'T12:00:00');
  const diaI = dI.getDate();
  const diaF = dF.getDate();
  const mesI = dI.toLocaleDateString('es-MX', {month:'long'});
  const mesF = dF.toLocaleDateString('es-MX', {month:'long'});
  const anio = dF.getFullYear();
  if(mesI === mesF) return `Del ${diaI} al ${diaF} de ${mesI} ${anio}`;
  return `Del ${diaI} de ${mesI} al ${diaF} de ${mesF} ${anio}`;
}

// ─── Registrar en campos ───────────────────────────────────────────
function _repPoblarInstructores() {
  const opts = instructores.map(i =>
    `<option value="${i.id}">${i.nombre}</option>`
  ).join('');
  const base = '<option value="">— Seleccionar instructor —</option>';
  const d = document.getElementById('rep-prof-destacado');
  const m = document.getElementById('rep-prof-menos');
  if(d) d.innerHTML = base + opts;
  if(m) m.innerHTML = base + opts;
  if(d && _repDep.profDestacadoId) d.value = String(_repDep.profDestacadoId);
  if(m && _repDep.profMenosId) m.value = String(_repDep.profMenosId);
}

// ─── Calcular stats de la semana desde el sistema ─────────────────
function _repCalcStats(ini, fin) {
  if(!ini || !fin) return null;
  const regs = registros.filter(r => {
    const f = r.fecha || '';
    return f >= ini && f <= fin;
  });
  const impartidas = regs.filter(r => r.estado === 'ok' || r.estado === 'sub');
  const faltas     = regs.filter(r => r.estado === 'falta');
  const totalAsis  = impartidas.reduce((a, r) => a + (parseInt(r.asistentes) || 0), 0);

  // Stats por instructor para sugerir destacado / menos destacado
  const statsInsts = instructores.map(inst => {
    const iRegs = regs.filter(r => r.inst_id === inst.id);
    const iImp  = iRegs.filter(r => r.estado === 'ok' || r.estado === 'sub');
    const iFalt = iRegs.filter(r => r.estado === 'falta').length;
    const iAfor = iImp.filter(r => parseInt(r.cap||0)>0);
    const aforo = iAfor.length > 0
      ? Math.round(iAfor.reduce((a,r) => a + (parseInt(r.asistentes)||0)/parseInt(r.cap)*100, 0) / iAfor.length)
      : null;
    const iAsis = iImp.reduce((a,r) => a + (parseInt(r.asistentes)||0), 0);
    return { inst, clases: iImp.length, faltas: iFalt, aforo, asistentes: iAsis };
  }).filter(s => s.clases > 0 || s.faltas > 0);

  // Mejor aforo (al menos 1 clase)
  const conAforo = statsInsts.filter(s => s.aforo !== null && s.clases > 0);
  const mejor  = conAforo.length ? conAforo.reduce((a,b) => b.aforo > a.aforo ? b : a) : null;
  // Más faltas o menor aforo
  const peor   = conAforo.length ? conAforo.reduce((a,b) => {
    const scoreA = (a.aforo||0) - a.faltas*15;
    const scoreB = (b.aforo||0) - b.faltas*15;
    return scoreB < scoreA ? b : a;
  }) : (statsInsts.filter(s=>s.faltas>0).sort((a,b)=>b.faltas-a.faltas)[0] || null);

  return {
    totalClases: impartidas.length,
    faltas: faltas.length,
    totalAsis,
    mejor, peor,
    statsInsts
  };
}

// ─── Actualizar preview en el banner ──────────────────────────────
function _repActualizarPreview(stats) {
  const el = document.getElementById('rep-stats-preview');
  if(!el) return;
  if(!stats) {
    el.innerHTML = '<span style="color:var(--txt3)">Selecciona un rango de fechas</span>';
    return;
  }
  el.innerHTML = `
    <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <b style="font-size:1rem;color:var(--neon)">${stats.totalClases}</b>
      <span style="font-size:.62rem">Clases</span>
    </span>
    <span style="color:var(--border)">|</span>
    <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <b style="font-size:1rem;color:var(--gold2)">${stats.faltas}</b>
      <span style="font-size:.62rem">Faltas</span>
    </span>
    <span style="color:var(--border)">|</span>
    <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <b style="font-size:1rem;color:var(--blue)">${stats.totalAsis}</b>
      <span style="font-size:.62rem">Asistentes</span>
    </span>
    <span style="color:var(--border)">|</span>
    <span style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <b style="font-size:.85rem;color:var(--neon);white-space:nowrap">${stats.mejor ? stats.mejor.inst.nombre.split(' ')[0] : '—'}</b>
      <span style="font-size:.62rem">⭐ Destacado</span>
    </span>`;
}

// ─── Render principal ─────────────────────────────────────────────
function renderReporteDep() {
  try {
    const s = localStorage.getItem('fc_reporte_dep');
    if(s) _repDep = Object.assign({}, _repDep, JSON.parse(s));
  } catch(e){}

  // Fechas
  const di = document.getElementById('rep-ini-date');
  const df = document.getElementById('rep-fin-date');
  if(di) di.value = _repDep.iniDate || '';
  if(df) df.value = _repDep.finDate || '';

  const map = {
    'rep-disciplina': 'disciplina', 'rep-semana': 'semana', 'rep-director': 'director',
    'rep-obj-anterior': 'objAnterior', 'rep-obj-cumplido': 'objCumplido', 'rep-obj-proximo': 'objProximo',
    'rep-alum-total': 'alumTotal', 'rep-alum-asistencia': 'alumAsistencia',
    'rep-alum-nuevos': 'alumNuevos', 'rep-alum-edades': 'alumEdades',
    'rep-prof-total': 'profTotal', 'rep-prof-clases': 'profClases',
    'rep-prof-inasistencias': 'profInasistencias',
    'rep-prof-destacado-razon': 'profDestacadoRazon',
    'rep-prof-menos-razon': 'profMenosRazon',
    'rep-ayuda': 'ayuda'
  };
  for(const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if(el) el.value = _repDep[key] || '';
  }

  _repPoblarInstructores();
  repRenderCompetencias();
  repRenderLogros();
  repRenderIncidencias();

  if(_repDep.iniDate && _repDep.finDate) {
    const stats = _repCalcStats(_repDep.iniDate, _repDep.finDate);
    _repActualizarPreview(stats);
  }
}

// ─── Leer todos los campos ────────────────────────────────────────
function _repLeerCampos() {
  const di = document.getElementById('rep-ini-date');
  const df = document.getElementById('rep-fin-date');
  _repDep.iniDate = di?.value || '';
  _repDep.finDate = df?.value || '';

  const map = {
    'rep-disciplina': 'disciplina', 'rep-semana': 'semana', 'rep-director': 'director',
    'rep-obj-anterior': 'objAnterior', 'rep-obj-cumplido': 'objCumplido', 'rep-obj-proximo': 'objProximo',
    'rep-alum-total': 'alumTotal', 'rep-alum-asistencia': 'alumAsistencia',
    'rep-alum-nuevos': 'alumNuevos', 'rep-alum-edades': 'alumEdades',
    'rep-prof-total': 'profTotal', 'rep-prof-clases': 'profClases',
    'rep-prof-inasistencias': 'profInasistencias',
    'rep-prof-destacado-razon': 'profDestacadoRazon',
    'rep-prof-menos-razon': 'profMenosRazon',
    'rep-ayuda': 'ayuda'
  };
  for(const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if(el) _repDep[key] = el.value;
  }
  const d = document.getElementById('rep-prof-destacado');
  const m = document.getElementById('rep-prof-menos');
  _repDep.profDestacadoId = d?.value || '';
  _repDep.profMenosId = m?.value || '';

  _repDep.competencias = Array.from(document.querySelectorAll('.rep-comp-input')).map(e => e.value);
  _repDep.logros = Array.from(document.querySelectorAll('.rep-logro-row')).map(r => ({
    logro: r.querySelector('.rep-logro-n')?.value || '',
    descripcion: r.querySelector('.rep-logro-d')?.value || '',
    redes: r.querySelector('.rep-logro-r')?.value || 'No'
  }));
  _repDep.incidencias = Array.from(document.querySelectorAll('.rep-inc-row')).map(r => ({
    incidencia: r.querySelector('.rep-inc-i')?.value || '',
    solucion: r.querySelector('.rep-inc-s')?.value || ''
  }));
}

// ─── Cambio de fechas ─────────────────────────────────────────────
function repOnFechaChange() {
  const ini = document.getElementById('rep-ini-date')?.value || '';
  const fin = document.getElementById('rep-fin-date')?.value || '';
  _repDep.iniDate = ini;
  _repDep.finDate = fin;
  if(ini && fin) {
    const semTxt = _repFmtSemana(ini, fin);
    const el = document.getElementById('rep-semana');
    if(el && !el.value) el.value = semTxt;
    const stats = _repCalcStats(ini, fin);
    _repActualizarPreview(stats);
  }
  repAutoguardar();
}

function repSemanaActual() {
  const { ini, fin } = _repGetLunesViernes();
  const di = document.getElementById('rep-ini-date');
  const df = document.getElementById('rep-fin-date');
  if(di) di.value = ini;
  if(df) df.value = fin;
  repOnFechaChange();
  // Forzar semana en campo texto
  const semTxt = _repFmtSemana(ini, fin);
  const elSem = document.getElementById('rep-semana');
  if(elSem) elSem.value = semTxt;
  repAutoguardar();
}

// ─── ⚡ Cargar datos del sistema ──────────────────────────────────
function repCargarSistema() {
  const ini = document.getElementById('rep-ini-date')?.value || '';
  const fin = document.getElementById('rep-fin-date')?.value || '';
  if(!ini || !fin) {
    showToast('Primero selecciona el rango de fechas de la semana','warn');
    return;
  }

  const stats = _repCalcStats(ini, fin);
  if(!stats) return;

  // Semana
  const semEl = document.getElementById('rep-semana');
  if(semEl) semEl.value = _repFmtSemana(ini, fin);

  // Profesores
  const tpEl = document.getElementById('rep-prof-total');
  if(tpEl) tpEl.value = instructores.length;

  const tcEl = document.getElementById('rep-prof-clases');
  if(tcEl) tcEl.value = stats.totalClases;

  const tiEl = document.getElementById('rep-prof-inasistencias');
  if(tiEl) tiEl.value = stats.faltas;

  // Asistencia total
  const asEl = document.getElementById('rep-alum-asistencia');
  if(asEl) asEl.value = stats.totalAsis;

  // Sugerir destacados
  const dSel = document.getElementById('rep-prof-destacado');
  const mSel = document.getElementById('rep-prof-menos');
  if(dSel && stats.mejor) {
    dSel.value = String(stats.mejor.inst.id);
    const razEl = document.getElementById('rep-prof-destacado-razon');
    if(razEl && !razEl.value) {
      razEl.value = `Aforo del ${stats.mejor.aforo}% · ${stats.mejor.clases} clases impartidas · ${stats.mejor.asistentes} asistentes totales`;
    }
  }
  if(mSel && stats.peor && (!stats.mejor || stats.peor.inst.id !== stats.mejor.inst.id)) {
    mSel.value = String(stats.peor.inst.id);
    const razEl = document.getElementById('rep-prof-menos-razon');
    if(razEl && !razEl.value) {
      const razon = [];
      if(stats.peor.faltas > 0) razon.push(`${stats.peor.faltas} falta(s) en el periodo`);
      if(stats.peor.aforo !== null) razon.push(`aforo del ${stats.peor.aforo}%`);
      if(razon.length) razEl.value = razon.join(', ');
    }
  }

  _repActualizarPreview(stats);
  repAutoguardar();
  showToast('✔ Datos cargados del sistema','ok');
}

// ─── Guardar / Limpiar ───────────────────────────────────────────
function repAutoguardar() {
  _repLeerCampos();
  try { localStorage.setItem('fc_reporte_dep', JSON.stringify(_repDep)); } catch(e){}
}

function repGuardar() {
  repAutoguardar();
  showToast('Reporte guardado ✔','ok');
}

function repLimpiar() {
  if(!confirm('¿Limpiar todos los campos del reporte?')) return;
  _repDep = {
    iniDate:'', finDate:'',
    disciplina:'', semana:'', director:'',
    objAnterior:'', objCumplido:'', objProximo:'',
    alumTotal:'', alumAsistencia:'', alumNuevos:'', alumEdades:'',
    profTotal:'', profClases:'', profInasistencias:'',
    profDestacadoId:'', profDestacadoRazon:'',
    profMenosId:'', profMenosRazon:'',
    competencias:[''],
    logros:[{logro:'', descripcion:'', redes:'No'}],
    incidencias:[{incidencia:'', solucion:''}],
    ayuda:''
  };
  try { localStorage.removeItem('fc_reporte_dep'); } catch(e){}
  renderReporteDep();
  showToast('Reporte limpiado','info');
}

// ─── Competencias ────────────────────────────────────────────────
function repRenderCompetencias() {
  const cont = document.getElementById('rep-competencias-list');
  if(!cont) return;
  const list = (_repDep.competencias||['']).length ? _repDep.competencias : [''];
  cont.innerHTML = list.map((c, i) => `
    <div class="rep-row-dyn" style="display:grid;grid-template-columns:auto 1fr;gap:.5rem;align-items:center;padding:.5rem .7rem .5rem 2rem">
      <button class="rep-row-del" onclick="repDelComp(${i})" title="Eliminar">✕</button>
      <input type="text" class="rep-comp-input" value="${(c||'').replace(/"/g,'&quot;')}"
             placeholder="Ej: Liga Campestre Baloncesto" oninput="repAutoguardar()">
    </div>`).join('');
}

function repAddComp() {
  _repLeerCampos();
  _repDep.competencias.push('');
  repRenderCompetencias();
  document.querySelectorAll('.rep-comp-input')[_repDep.competencias.length-1]?.focus();
}

function repDelComp(idx) {
  _repLeerCampos();
  _repDep.competencias.splice(idx,1);
  if(!_repDep.competencias.length) _repDep.competencias=[''];
  repRenderCompetencias(); repAutoguardar();
}

// ─── Logros ──────────────────────────────────────────────────────
function repRenderLogros() {
  const cont = document.getElementById('rep-logros-list');
  if(!cont) return;
  const list = (_repDep.logros||[]).length ? _repDep.logros : [{logro:'',descripcion:'',redes:'No'}];
  cont.innerHTML = list.map((l, i) => `
    <div class="rep-row-dyn rep-logro-row">
      <button class="rep-row-del" onclick="repDelLogro(${i})" title="Eliminar">✕</button>
      <div class="rep-logro-inner">
        <div class="rep-field" style="margin:0">
          <label>Logro #${i+1}</label>
          <input type="text" class="rep-logro-n" value="${(l.logro||'').replace(/"/g,'&quot;')}"
                 placeholder="Título del logro" oninput="repAutoguardar()">
        </div>
        <div class="rep-field" style="margin:0">
          <label>Descripción</label>
          <textarea class="rep-logro-d" rows="2" placeholder="Detalla el logro…"
                    oninput="repAutoguardar()">${(l.descripcion||'').replace(/</g,'&lt;')}</textarea>
        </div>
        <div class="rep-field" style="margin:0">
          <label>¿Pub. redes?</label>
          <select class="rep-logro-r" onchange="repAutoguardar()">
            <option value="Si" ${l.redes==='Si'?'selected':''}>Sí</option>
            <option value="No" ${l.redes!=='Si'?'selected':''}>No</option>
          </select>
        </div>
      </div>
    </div>`).join('');
}

function repAddLogro() {
  _repLeerCampos();
  _repDep.logros.push({logro:'',descripcion:'',redes:'No'});
  repRenderLogros();
}

function repDelLogro(idx) {
  _repLeerCampos();
  _repDep.logros.splice(idx,1);
  if(!_repDep.logros.length) _repDep.logros=[{logro:'',descripcion:'',redes:'No'}];
  repRenderLogros(); repAutoguardar();
}

// ─── Incidencias ─────────────────────────────────────────────────
function repRenderIncidencias() {
  const cont = document.getElementById('rep-incidencias-list');
  if(!cont) return;
  const list = (_repDep.incidencias||[]).length ? _repDep.incidencias : [{incidencia:'',solucion:''}];
  cont.innerHTML = list.map((inc, i) => `
    <div class="rep-row-dyn rep-inc-row">
      <button class="rep-row-del" onclick="repDelIncidencia(${i})" title="Eliminar">✕</button>
      <div class="rep-inc-inner">
        <div class="rep-field" style="margin:0">
          <label>Incidencia</label>
          <textarea class="rep-inc-i" rows="2" placeholder="Describe la incidencia…"
                    oninput="repAutoguardar()">${(inc.incidencia||'').replace(/</g,'&lt;')}</textarea>
        </div>
        <div class="rep-field" style="margin:0">
          <label>Solución</label>
          <textarea class="rep-inc-s" rows="2" placeholder="Describe la solución o acción tomada…"
                    oninput="repAutoguardar()">${(inc.solucion||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>
    </div>`).join('');
}

function repAddIncidencia() {
  _repLeerCampos();
  _repDep.incidencias.push({incidencia:'',solucion:''});
  repRenderIncidencias();
}

function repDelIncidencia(idx) {
  _repLeerCampos();
  _repDep.incidencias.splice(idx,1);
  if(!_repDep.incidencias.length) _repDep.incidencias=[{incidencia:'',solucion:''}];
  repRenderIncidencias(); repAutoguardar();
}

// ─── Imprimir / PDF (fiel al membrete original) ───────────────────
function repImprimir() {
  _repLeerCampos();
  repAutoguardar();

  const logoSrc = document.querySelector('#hdr img')?.src || '';
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Nombre de los instructores seleccionados
  const destInst = instructores.find(i => String(i.id) === String(_repDep.profDestacadoId));
  const menosInst = instructores.find(i => String(i.id) === String(_repDep.profMenosId));
  const destNombre = destInst ? destInst.nombre : '';
  const menosNombre = menosInst ? menosInst.nombre : '';

  const profDestCell = destNombre
    ? `<strong>${esc(destNombre)}</strong>${_repDep.profDestacadoRazon ? ', ' + esc(_repDep.profDestacadoRazon) : ''}`
    : '';
  const profMenosCell = menosNombre
    ? `<strong>${esc(menosNombre)}</strong>${_repDep.profMenosRazon ? ', ' + esc(_repDep.profMenosRazon) : ''}`
    : '';

  const compRows = (_repDep.competencias||[]).filter(c=>c.trim())
    .map(c=>`<tr><td style="padding:5px 8px">${esc(c)}</td></tr>`).join('')
    || '<tr><td style="padding:5px 8px;color:#888">—</td></tr>';

  const logroRows = (_repDep.logros||[]).filter(l=>l.logro||l.descripcion).map((l,i)=>`
    <tr>
      <td style="padding:6px 8px;font-weight:600;vertical-align:top;width:22%">${i+1}. ${esc(l.logro)}</td>
      <td style="padding:6px 8px;vertical-align:top">${esc(l.descripcion)}</td>
      <td style="padding:6px 8px;text-align:center;vertical-align:top;font-weight:${l.redes==='Si'?'bold':'normal'};color:${l.redes==='Si'?'#1a7a45':'#333'};width:18%">${esc(l.redes)}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="padding:5px 8px;color:#888">—</td></tr>';

  const incRows = (_repDep.incidencias||[]).filter(i=>i.incidencia||i.solucion).map(inc=>`
    <tr>
      <td style="padding:6px 8px;vertical-align:top;font-weight:600;width:42%">${esc(inc.incidencia)}</td>
      <td style="padding:6px 8px;vertical-align:top">${esc(inc.solucion)}</td>
    </tr>`).join('') || '<tr><td colspan="2" style="padding:6px 8px;color:#888">—</td></tr>';

  const incCount = (_repDep.incidencias||[]).filter(i=>i.incidencia.trim()).length;
  const emptyIncRows = Array(Math.max(0, 4-incCount)).fill('<tr><td style="padding:10px 8px">&nbsp;</td><td>&nbsp;</td></tr>').join('');

  // Decoración lateral izquierda — patrón de semicírculos verde/gris/amarillo-verde
  const colPattern = ['#3b8955','#a0c850','#b0b0b0','#1a7a45','#6db050','#d0d0d0'];
  const decoSegs = Array(40).fill(0).map((_,i)=>{
    const c = colPattern[i % colPattern.length];
    return `<div class="deco-seg" style="background:${c}"></div>`;
  }).join('');

  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="Club Campestre" style="height:14mm;width:auto">`
    : `<div class="logo-text"><span class="logo-c">C</span>ampestre<br><small>Aguascalientes</small></div>`;

  // Iconos deportivos SVG para el footer (consistentes en todos los navegadores)
  const deporteIcons = [
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="2" r="2"/><path d="M4.5 16.5l1.3-.8L9 12.5V9l-2-1.5L4 9v3.5l.5 4z"/><path d="M19.5 16.5l-1.3-.8L15 12.5V9l2-1.5L20 9v3.5l-.5 4z"/><path d="M12 22c.5 0 1-.4 1-1v-5.5L9 12l3-3 3 3-4 3.5V21c0 .6.5 1 1 1z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12s4.5 10 10 10 10-4.5 10-10zM4.1 14.1l5.1-1.4.5 2.4-4 1.1c-.7-.6-1.2-1.3-1.6-2.1zm16.4-2.2l-5.1 1.4-.5-2.4 4-1.1c.7.6 1.2 1.3 1.6 2.1zM12 20c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S3.1 13.5 5 13.5s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z"/></svg>',
  ];
  const footerIcons = Array(20).fill(deporteIcons).flat().slice(0,20)
    .map(icon=>`<span class="ft-ico">${icon}</span>`).join('');

  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte Semanal Deportes · ${esc(_repDep.disciplina)} · ${esc(_repDep.semana)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:210mm;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#222}
@page{size:A4 portrait;margin:0}

/* Decoración lateral — semicírculos alternados */
.deco{position:fixed;left:0;top:0;width:12mm;height:100%;display:flex;flex-direction:column;overflow:hidden;z-index:10}
.deco-seg{width:12mm;height:12mm;border-radius:50%;flex-shrink:0;margin:0 0 -1px -3mm}

/* Logo */
.logo-text{font-weight:bold;font-size:14px;color:#1a7a45;text-align:right;line-height:1.2;font-family:Georgia,serif}
.logo-text .logo-c{font-size:22px;font-style:italic;color:#2a9a55}
.logo-text small{font-size:9px;color:#555;font-weight:normal;letter-spacing:1px}

/* Página */
.page{padding:8mm 12mm 18mm 19mm;position:relative}
.top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:2mm;margin-bottom:5mm;border-bottom:2.5px solid #1a7a45}
.ptitle{font-size:16px;font-weight:bold;color:#111}

/* Tablas */
table{width:100%;border-collapse:collapse;margin-bottom:4mm;page-break-inside:avoid}
td,th{border:1px solid #b8b8b8;padding:4.5px 7px;vertical-align:top;line-height:1.5;font-size:10px}
.sh td{background:#1a7a45;color:#fff;font-weight:bold;font-size:10.5px;letter-spacing:.5px;padding:5px 8px;border-color:#158a4a}
.sh2 td{background:#1a7a45;color:#fff;font-weight:bold;font-size:10.5px;letter-spacing:.5px;padding:5px 8px;border-color:#158a4a}
.lbl{font-weight:bold;width:42%;background:#f2f8f4;color:#111}
.thdr td{background:#e4f2e8;font-weight:bold;font-size:9.8px;color:#1a5a35}
.nota{font-size:8.5px;color:#555;font-style:italic;padding:5px 8px;border:1px solid #b8b8b8;border-top:none;margin-bottom:4mm;page-break-inside:avoid}

/* Footer deportivo */
.footer{position:fixed;bottom:0;left:12mm;right:0;height:13mm;background:linear-gradient(135deg,#1a3a5a 0%,#1a5a3a 100%);display:flex;align-items:center;justify-content:space-around;padding:0 6mm;overflow:hidden}
.ft-ico{display:inline-flex;width:13px;height:13px;opacity:.35}
.ft-ico svg{width:100%;height:100%;fill:rgba(255,255,255,.6)}

/* Print fidelity */
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .page{padding:8mm 12mm 18mm 19mm}
  table{page-break-inside:avoid}
  tr{page-break-inside:avoid}
}
</style></head><body>
<div class="deco">${decoSegs}</div>
<div class="page">
  <div class="top">
    <div class="ptitle">Reporte semanal | Deportes</div>
    <div>${logoHtml}</div>
  </div>

  <table>
    <tr class="sh"><td colspan="2">Datos generales</td></tr>
    <tr><td class="lbl">Disciplina</td><td>${esc(_repDep.disciplina)||'Fitness'}</td></tr>
    <tr><td class="lbl">Semana</td><td>${esc(_repDep.semana)}</td></tr>
    <tr><td class="lbl">Director</td><td>${esc(_repDep.director)}</td></tr>
  </table>

  <table>
    <tr class="sh"><td colspan="2">Objetivos</td></tr>
    <tr><td class="lbl">Objetivo semanal anterior de dirección</td><td>${esc(_repDep.objAnterior)}</td></tr>
    <tr><td class="lbl">¿Se cumplió? Si/ No, ¿Por qué?</td><td>${esc(_repDep.objCumplido)}</td></tr>
    <tr><td class="lbl">Objetivo semanal próximo de dirección</td><td style="line-height:1.5">${esc(_repDep.objProximo)}</td></tr>
  </table>

  <table>
    <tr class="sh"><td colspan="2">Alumnado</td></tr>
    <tr><td class="lbl">Cantidad total de alumnado</td><td>${esc(_repDep.alumTotal)}</td></tr>
    <tr><td class="lbl">Asistencia total semanal</td><td><strong>${esc(_repDep.alumAsistencia)}</strong></td></tr>
    <tr><td class="lbl">Nuevos alumnos</td><td>${esc(_repDep.alumNuevos)}</td></tr>
    <tr><td class="lbl">Edades predominantes de alumnado</td><td>${esc(_repDep.alumEdades)}</td></tr>
  </table>

  <table>
    <tr class="sh"><td colspan="2">Profesores</td></tr>
    <tr><td class="lbl">Cantidad total de profesores</td><td>${esc(String(_repDep.profTotal))}</td></tr>
    <tr><td class="lbl">Cantidad total de clases</td><td>${esc(String(_repDep.profClases))}</td></tr>
    <tr><td class="lbl">Inasistencias semanales</td><td>${esc(String(_repDep.profInasistencias))}</td></tr>
    <tr><td class="lbl">Profesor más destacado de la semana (explica la razón)</td><td>${profDestCell}</td></tr>
    <tr><td class="lbl">Profesor menos destacado de la semana (explica la razón)</td><td>${profMenosCell}</td></tr>
  </table>

  <table>
    <tr class="sh"><td>Competencias activas</td></tr>
    ${compRows}
    <tr><td style="padding:8px">&nbsp;</td></tr>
    <tr><td style="padding:8px">&nbsp;</td></tr>
  </table>

  <table>
    <tr class="sh"><td colspan="3">Logros semanales</td></tr>
    <tr class="thdr">
      <td style="width:22%">Logro</td>
      <td style="width:60%">Descripción</td>
      <td style="width:18%;text-align:center;font-size:9px;line-height:1.3">¿Consideras necesario<br>publicarlo en redes? (Si/ No)</td>
    </tr>
    ${logroRows}
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  </table>
  <div class="nota">En dado caso que consideres necesario publicarlo en redes, hay que anexar en el drive una carpeta con el número del logro y las imágenes correspondientes.</div>

  <table>
    <tr class="sh"><td colspan="2">Incidencias generales semanales</td></tr>
    <tr class="thdr"><td style="width:42%">Incidencia</td><td>Solución</td></tr>
    ${incRows}${emptyIncRows}
  </table>

  <table>
    <tr class="sh2"><td>¿En qué te puede ayudar la gerencia deportiva?</td></tr>
    <tr><td style="min-height:18mm;height:18mm;vertical-align:top;padding:5px 8px">${esc(_repDep.ayuda)}</td></tr>
  </table>
</div>
<div class="footer">${footerIcons}</div>
<script>window.onload=()=>{setTimeout(()=>window.print(),400);};<\/script>
</body></html>`;

  const w = window.open('','_blank','width=940,height=760');
  if(!w){ showToast('⚠ Permite ventanas emergentes para imprimir','warn'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ═══════════════════════════════════════════════════════════════
// EXPORTAR PDF DIRECTO (jsPDF) — Reporte Semanal Deportes
// Genera PDF profesional sin depender de "imprimir como PDF"
// ═══════════════════════════════════════════════════════════════
function repExportarPDF() {
  _repLeerCampos();
  repAutoguardar();

  if(!window.jspdf){ showToast('Librería jsPDF no disponible. Usa "Imprimir / PDF".','warn'); return; }
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const PW=210, PH=297, ML=18, MR=12, MB=18;
  const CW=PW-ML-MR;

  // Paleta
  const V=[26,122,69], VL=[228,242,232], VBG=[242,248,244];
  const GR=[184,184,184], NEG=[34,34,34], GRIS=[90,90,90], BCO=[255,255,255];
  const AZUL_OSC=[26,58,90];

  let Y=0, pNum=0;

  // Nombres de instructores
  const destInst = instructores.find(i=>String(i.id)===String(_repDep.profDestacadoId));
  const menosInst = instructores.find(i=>String(i.id)===String(_repDep.profMenosId));
  const destText = destInst ? destInst.nombre + (_repDep.profDestacadoRazon?', '+_repDep.profDestacadoRazon:'') : '';
  const menosText = menosInst ? menosInst.nombre + (_repDep.profMenosRazon?', '+_repDep.profMenosRazon:'') : '';

  // ── Decoración lateral ──
  function dibujarDeco() {
    const cols=[[59,137,85],[160,200,80],[180,180,180],[26,122,69],[100,170,60],[210,210,210]];
    for(let i=0;i<Math.ceil(PH/12)+2;i++){
      const c=cols[i%cols.length];
      doc.setFillColor(...c);
      doc.circle(3,6+i*12,5.5,'F');
    }
  }

  // ── Footer ──
  function dibujarFooter() {
    doc.setFillColor(...AZUL_OSC);
    doc.rect(12,PH-13,PW-12,13,'F');
    // Línea de gradiente verde
    doc.setFillColor(...V);
    doc.rect(12,PH-13,PW-12,0.5,'F');
    // Texto página
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(160,180,170);
    doc.text('Fitness Control · Club Campestre Aguascalientes', ML, PH-6);
    doc.text(`Pág. ${pNum}`, PW-MR, PH-6, {align:'right'});
  }

  // ── Nueva página ──
  function nuevaPag() {
    if(pNum>0) doc.addPage();
    pNum++;
    dibujarDeco();
    Y=12;
  }

  function checkSpace(h) {
    if(Y+h > PH-MB) { dibujarFooter(); nuevaPag(); }
  }

  // ── Título + Logo ──
  function dibujarHeader() {
    doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(...NEG);
    doc.text('Reporte semanal | Deportes', ML, Y);
    // Logo placeholder derecho
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...V);
    doc.text('ampestre', PW-MR, Y-2, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
    doc.text('Aguascalientes', PW-MR, Y+2.5, {align:'right'});
    // Línea verde
    Y+=3;
    doc.setDrawColor(...V); doc.setLineWidth(0.8); doc.line(ML,Y,PW-MR,Y);
    Y+=5;
  }

  // ── Encabezado de sección ──
  function secHeader(texto) {
    checkSpace(9);
    doc.setFillColor(...V);
    doc.setDrawColor(...GR);
    doc.setLineWidth(0.15);
    doc.rect(ML,Y,CW,6.5,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...BCO);
    doc.text(texto, ML+3, Y+4.5);
    Y+=6.5;
  }

  // ── Fila clave-valor ──
  function fila(label, valor) {
    const labelW=72, valW=CW-labelW;
    const maxValW=valW-4;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(String(valor||''), maxValW);
    const labelLines = doc.splitTextToSize(String(label||''), labelW-4);
    const h = Math.max(7, Math.max(lines.length, labelLines.length)*3.6+3);

    checkSpace(h);
    // Label cell
    doc.setFillColor(...VBG); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
    doc.rect(ML,Y,labelW,h,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...NEG);
    doc.text(labelLines, ML+2.5, Y+4.2);

    // Value cell
    doc.setFillColor(...BCO);
    doc.rect(ML+labelW,Y,valW,h,'FD');
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text(lines, ML+labelW+2.5, Y+4.2);
    Y+=h;
  }

  // ── Tabla multi-columna ──
  function tblHeader(cols, widths) {
    const h=6.5;
    checkSpace(h+7);
    let x=ML;
    cols.forEach((txt,i)=>{
      doc.setFillColor(228,242,232); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
      doc.rect(x,Y,widths[i],h,'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(7.8); doc.setTextColor(26,90,53);
      const lines = doc.splitTextToSize(txt, widths[i]-4);
      doc.text(lines, x+2, Y+4);
      x+=widths[i];
    });
    Y+=h;
  }

  function tblRow(cells, widths, opts={}) {
    const h = opts.h || 7;
    checkSpace(h);
    let x=ML;
    cells.forEach((txt,i)=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
      doc.rect(x,Y,widths[i],h,'FD');
      const bold = opts.boldCols && opts.boldCols.includes(i);
      doc.setFont('helvetica', bold?'bold':'normal');
      doc.setFontSize(7.8); doc.setTextColor(...(opts.color||GRIS));
      const lines = doc.splitTextToSize(String(txt||''), widths[i]-4);
      doc.text(lines, x+2, Y+4.2);
      x+=widths[i];
    });
    Y+=h;
  }

  function tblRowMultiline(cells, widths, opts={}) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.8);
    let maxH=7;
    const allLines=cells.map((txt,i)=>{
      const lines = doc.splitTextToSize(String(txt||''), widths[i]-4);
      maxH = Math.max(maxH, lines.length*3.5+3.5);
      return lines;
    });
    checkSpace(maxH);
    let x=ML;
    allLines.forEach((lines,i)=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
      doc.rect(x,Y,widths[i],maxH,'FD');
      const bold = opts.boldCols && opts.boldCols.includes(i);
      doc.setFont('helvetica', bold?'bold':'normal');
      doc.setFontSize(7.8); doc.setTextColor(...(opts.color||GRIS));
      doc.text(lines, x+2, Y+4);
      x+=widths[i];
    });
    Y+=maxH;
  }

  function emptyRow(widths, h=8) {
    checkSpace(h);
    let x=ML;
    widths.forEach(w=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
      doc.rect(x,Y,w,h,'FD');
      x+=w;
    });
    Y+=h;
  }

  // ═══ CONSTRUIR PDF ═══
  nuevaPag();
  dibujarHeader();

  // ── Datos generales ──
  secHeader('Datos generales');
  fila('Disciplina', _repDep.disciplina || 'Fitness');
  fila('Semana', _repDep.semana);
  fila('Director', _repDep.director);
  Y+=3;

  // ── Objetivos ──
  secHeader('Objetivos');
  fila('Objetivo semanal anterior de dirección', _repDep.objAnterior);
  fila('¿Se cumplió? Si/ No, ¿Por qué?', _repDep.objCumplido);
  fila('Objetivo semanal próximo de dirección', _repDep.objProximo);
  Y+=3;

  // ── Alumnado ──
  secHeader('Alumnado');
  fila('Cantidad total de alumnado', _repDep.alumTotal);
  fila('Asistencia total semanal', _repDep.alumAsistencia);
  fila('Nuevos alumnos', _repDep.alumNuevos);
  fila('Edades predominantes de alumnado', _repDep.alumEdades);
  Y+=3;

  // ── Profesores ──
  secHeader('Profesores');
  fila('Cantidad total de profesores', _repDep.profTotal);
  fila('Cantidad total de clases', _repDep.profClases);
  fila('Inasistencias semanales', _repDep.profInasistencias);
  fila('Profesor más destacado de la semana (explica la razón)', destText);
  fila('Profesor menos destacado de la semana (explica la razón)', menosText);
  Y+=3;

  // ── Competencias activas ──
  secHeader('Competencias activas');
  const comps = (_repDep.competencias||[]).filter(c=>c.trim());
  if(comps.length){
    comps.forEach(c=>{ fila('', c); }); // usar fila de ancho completo
  } else {
    checkSpace(7);
    doc.setFillColor(...BCO); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
    doc.rect(ML,Y,CW,7,'FD');
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(160,160,160);
    doc.text('—', ML+CW/2, Y+4.5, {align:'center'});
    Y+=7;
  }
  emptyRow([CW],7);
  emptyRow([CW],7);
  Y+=3;

  // ── Logros semanales ──
  secHeader('Logros semanales');
  const colL=[CW*0.22, CW*0.58, CW*0.20];
  tblHeader(['Logro','Descripción','¿Consideras necesario\npublicarlo en redes? (Si/ No)'], colL);
  const logros = (_repDep.logros||[]).filter(l=>l.logro||l.descripcion);
  if(logros.length){
    logros.forEach((l,i)=>{
      tblRowMultiline([`${i+1}. ${l.logro}`, l.descripcion||'', l.redes||'No'], colL, {boldCols:[0]});
    });
  } else {
    tblRow(['—','',''], colL);
  }
  // Filas vacías
  for(let i=0;i<3;i++) emptyRow(colL,8);

  // Nota
  Y+=1;
  checkSpace(8);
  doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(120,120,120);
  doc.text('En dado caso que consideres necesario publicarlo en redes, hay que anexar en el drive una', ML, Y+3);
  doc.text('carpeta con el número del logro y las imágenes correspondientes.', ML, Y+6.5);
  Y+=9;

  // ── Incidencias ──
  secHeader('Incidencias generales semanales');
  const colI=[CW*0.42, CW*0.58];
  tblHeader(['Incidencia','Solución'], colI);
  const incids = (_repDep.incidencias||[]).filter(i=>i.incidencia||i.solucion);
  if(incids.length){
    incids.forEach(inc=>{
      tblRowMultiline([inc.incidencia||'', inc.solucion||''], colI, {boldCols:[0]});
    });
  } else {
    tblRow(['—',''], colI);
  }
  for(let i=0;i<Math.max(0,4-incids.length);i++) emptyRow(colI,10);
  Y+=3;

  // ── Ayuda gerencia ──
  secHeader('¿En qué te puede ayudar la gerencia deportiva?');
  const ayudaLines = doc.splitTextToSize(_repDep.ayuda||'', CW-5);
  const ayudaH = Math.max(16, ayudaLines.length*3.5+5);
  checkSpace(ayudaH);
  doc.setFillColor(...BCO); doc.setDrawColor(...GR); doc.setLineWidth(0.15);
  doc.rect(ML,Y,CW,ayudaH,'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  if(_repDep.ayuda) doc.text(ayudaLines, ML+2.5, Y+4.5);
  Y+=ayudaH;

  // Footer en todas las páginas
  for(let p=1;p<=doc.getNumberOfPages();p++){
    doc.setPage(p);
    dibujarFooter();
  }

  // Nombre archivo
  const nombre = `Reporte_Semanal_Deportes_${(_repDep.disciplina||'Fitness').replace(/\s+/g,'_')}_${(_repDep.semana||'').replace(/[^a-zA-Z0-9áéíóúñ]/gi,'_').replace(/_+/g,'_').slice(0,40)}.pdf`;
  doc.save(nombre);
  showToast(`✔ PDF descargado: ${nombre}`, 'ok');
}


// ─── Exportar Word (.docx) — formato idéntico al Reporte_semana1 ─────────
function repExportarWord() {
  _repLeerCampos();
  repAutoguardar();

  if(!window.fflate) {
    showToast('Cargando librería ZIP, espera un momento...','info');
    if(window._cargarFflate){
      window._cargarFflate().then(function(){
        showToast('✔ Librería lista, generando Word...','ok');
        _repGenerarWordInterno();
      }).catch(function(){
        showToast('No se pudo cargar la librería ZIP. Verifica tu conexión a internet.','err');
      });
    } else {
      showToast('Librería ZIP no disponible. Recarga la página e intenta de nuevo.','err');
    }
    return;
  }

  _repGenerarWordInterno();
}

function _repGenerarWordInterno() {

  const x = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Nombres de instructores
  const destInst  = instructores.find(i => String(i.id) === String(_repDep.profDestacadoId));
  const menosInst = instructores.find(i => String(i.id) === String(_repDep.profMenosId));
  const destNombre  = destInst  ? destInst.nombre  : '';
  const menosNombre = menosInst ? menosInst.nombre : '';
  const destText  = destNombre  ? destNombre  + (_repDep.profDestacadoRazon ? ', ' + _repDep.profDestacadoRazon : '') : '';
  const menosText = menosNombre ? menosNombre + (_repDep.profMenosRazon     ? ', ' + _repDep.profMenosRazon     : '') : '';

  // ── Helpers de XML ──────────────────────────────────────────────────────
  const enc = s => x(String(s||''));

  function par(text, opts={}) {
    const {bold=false, size=20, color='000000', align='left', spBefore=0, spAfter=80, shade=null, italic=false, font='Arial'} = opts;
    const alignXml = align!=='left' ? `<w:jc w:val="${align}"/>` : '';
    const shdXml   = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '';
    const boldXml  = bold  ? '<w:b/><w:bCs/>' : '';
    const italXml  = italic? '<w:i/><w:iCs/>'  : '';
    const colorXml = color !== '000000' ? `<w:color w:val="${color}"/>` : '';
    return `<w:p>
      <w:pPr>
        <w:spacing w:before="${spBefore}" w:after="${spAfter}"/>
        ${alignXml}
        ${shdXml}
        <w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${boldXml}${italXml}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${colorXml}</w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${boldXml}${italXml}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${colorXml}</w:rPr>
        <w:t xml:space="preserve">${enc(text)}</w:t>
      </w:r>
    </w:p>`;
  }

  // Párrafo con dos runs (bold label + normal value) en la misma línea
  function parDual(label, value, opts={}) {
    const {size=20, color='000000', font='Arial', spAfter=60} = opts;
    return `<w:p>
      <w:pPr><w:spacing w:before="0" w:after="${spAfter}"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:b/><w:bCs/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="${color}"/></w:rPr>
        <w:t xml:space="preserve">${enc(label)}</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>
        <w:t xml:space="preserve">${enc(value)}</w:t>
      </w:r>
    </w:p>`;
  }

  // Dimensiones: Letter, márgenes 1" = 1440 dxa  →  contenido = 12240-2880 = 9360
  const TBL_W = 9360;
  const COL1  = 3900; // etiqueta ~42%
  const COL2  = TBL_W - COL1;

  // Bordes de tabla mejorados
  const BORDE_COLOR = 'B0B0B0';

  function cellShd(fill) {
    return `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
  }

  function td(text, opts={}) {
    const {w=COL2, bold=false, color='000000', shade='FFFFFF', size=20, span=0, align='left', italic=false} = opts;
    const spn = span > 1 ? `<w:gridSpan w:val="${span}"/>` : '';
    return `<w:tc>
      <w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${spn}${cellShd(shade)}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>
      ${par(text, {bold, color, size, spBefore:0, spAfter:0, align, italic})}
    </w:tc>`;
  }

  function headerRow(label, span=2) {
    return `<w:tr>
      <w:trPr><w:trHeight w:val="340"/></w:trPr>
      ${td(label, {w: TBL_W, bold:true, color:'FFFFFF', shade:'1A7A45', size:21, span})}
    </w:tr>`;
  }

  function dataRow(label, value) {
    return `<w:tr>
      <w:trPr><w:trHeight w:val="300"/></w:trPr>
      ${td(label,  {w:COL1, bold:true,  shade:'F2F8F4'})}
      ${td(value,  {w:COL2, shade:'FFFFFF'})}
    </w:tr>`;
  }

  function table(rows, colWidths=[COL1, COL2]) {
    const grid = colWidths.map(w=>`<w:gridCol w:w="${w}"/>`).join('');
    return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${TBL_W}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${BORDE_COLOR}"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>${grid}</w:tblGrid>
      ${rows}
    </w:tbl>
    <w:p><w:pPr><w:spacing w:after="140"/></w:pPr></w:p>`;
  }

  // ── Competencias ────────────────────────────────────────────────────────
  const comps = (_repDep.competencias||[]).filter(c=>c.trim());
  const compRows = comps.length
    ? comps.map(c=>`<w:tr><w:trPr><w:trHeight w:val="280"/></w:trPr>${td(c,{w:TBL_W,span:1})}</w:tr>`).join('')
    : `<w:tr><w:trPr><w:trHeight w:val="280"/></w:trPr>${td('—',{w:TBL_W,span:1,italic:true,color:'888888'})}</w:tr>`;
  const compEmpty = `<w:tr><w:trPr><w:trHeight w:val="320"/></w:trPr>${td('',{w:TBL_W,span:1})}</w:tr>`.repeat(2);

  // ── Logros ──────────────────────────────────────────────────────────────
  const COL_L1=2400, COL_L2=5160, COL_L3=1800;
  const logros = (_repDep.logros||[]).filter(l=>l.logro||l.descripcion);
  const logroHeader = `<w:tr>
    <w:trPr><w:trHeight w:val="280"/></w:trPr>
    ${td('Logro',          {w:COL_L1, bold:true, shade:'E4F2E8', size:19, color:'1A5A35'})}
    ${td('Descripción',    {w:COL_L2, bold:true, shade:'E4F2E8', size:19, color:'1A5A35'})}
    ${td('¿Consideras necesario publicarlo en redes? (Si/ No)',{w:COL_L3, bold:true, shade:'E4F2E8', size:16, align:'center', color:'1A5A35'})}
  </w:tr>`;
  const logroRows = logros.length
    ? logros.map((l,i)=>`<w:tr>
        <w:trPr><w:trHeight w:val="300"/></w:trPr>
        ${td(`${i+1}. ${l.logro}`, {w:COL_L1, bold:true})}
        ${td(l.descripcion||'',    {w:COL_L2})}
        ${td(l.redes||'No',        {w:COL_L3, align:'center', bold: l.redes==='Si', color: l.redes==='Si'?'1A7A45':'000000'})}
      </w:tr>`).join('')
    : `<w:tr><w:trPr><w:trHeight w:val="280"/></w:trPr>${td('—',{w:COL_L1})}${td('',{w:COL_L2})}${td('',{w:COL_L3})}</w:tr>`;
  const logroEmpty = `<w:tr>
    <w:trPr><w:trHeight w:val="360"/></w:trPr>
    ${td('',{w:COL_L1})}${td('',{w:COL_L2})}${td('',{w:COL_L3})}
  </w:tr>`.repeat(3);
  const notaLogro = par('En dado caso que consideres necesario publicarlo en redes, hay que anexar en el drive una carpeta con el número del logro y las imágenes correspondientes.',
    {size:18, color:'555555', italic:true, spBefore:0, spAfter:180});

  // ── Incidencias ─────────────────────────────────────────────────────────
  const COL_I1=3900, COL_I2=5460;
  const incids = (_repDep.incidencias||[]).filter(i=>i.incidencia||i.solucion);
  const incHeader = `<w:tr>
    <w:trPr><w:trHeight w:val="280"/></w:trPr>
    ${td('Incidencia',{w:COL_I1, bold:true, shade:'E4F2E8', size:19, color:'1A5A35'})}
    ${td('Solución',  {w:COL_I2, bold:true, shade:'E4F2E8', size:19, color:'1A5A35'})}
  </w:tr>`;
  const incRows = incids.length
    ? incids.map(inc=>`<w:tr>
        <w:trPr><w:trHeight w:val="340"/></w:trPr>
        ${td(inc.incidencia||'', {w:COL_I1, bold:true})}
        ${td(inc.solucion||'',   {w:COL_I2})}
      </w:tr>`).join('')
    : `<w:tr><w:trPr><w:trHeight w:val="320"/></w:trPr>${td('—',{w:COL_I1})}${td('',{w:COL_I2})}</w:tr>`;
  const incEmpty = `<w:tr>
    <w:trPr><w:trHeight w:val="420"/></w:trPr>
    ${td('',{w:COL_I1})}${td('',{w:COL_I2})}
  </w:tr>`.repeat(Math.max(0, 4 - incids.length));

  // ── Tabla gerencia — ahora con verde (igual que el PDF original) ───────
  const gerenciaRow = `<w:tr>
    <w:trPr><w:trHeight w:val="1800" w:hRule="atLeast"/></w:trPr>
    ${td(_repDep.ayuda||'', {w:TBL_W, span:1})}
  </w:tr>`;

  // ── Título del documento con línea verde ──────────────────────────────
  const titulo = `<w:p>
    <w:pPr>
      <w:spacing w:before="200" w:after="120"/>
      <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="1A7A45"/></w:pBdr>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
      <w:t>Reporte semanal | Deportes</w:t>
    </w:r>
  </w:p>
  <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`;

  // ── Ensamblado del body ──────────────────────────────────────────────────
  const body = [
    titulo,

    table([
      headerRow('Datos generales'),
      dataRow('Disciplina', _repDep.disciplina || 'Fitness'),
      dataRow('Semana',     _repDep.semana),
      dataRow('Director',   _repDep.director),
    ]),

    table([
      headerRow('Objetivos'),
      dataRow('Objetivo semanal anterior de dirección', _repDep.objAnterior),
      dataRow('¿Se cumplió? Si/ No, ¿Por qué?',         _repDep.objCumplido),
      dataRow('Objetivo semanal próximo de dirección',  _repDep.objProximo),
    ]),

    table([
      headerRow('Alumnado'),
      dataRow('Cantidad total de alumnado',    _repDep.alumTotal),
      dataRow('Asistencia total semanal',      _repDep.alumAsistencia),
      dataRow('Nuevos alumnos',                String(_repDep.alumNuevos||'')),
      dataRow('Edades predominantes de alumnado', _repDep.alumEdades),
    ]),

    table([
      headerRow('Profesores'),
      dataRow('Cantidad total de profesores',  String(_repDep.profTotal||'')),
      dataRow('Cantidad total de clases',      String(_repDep.profClases||'')),
      dataRow('Inasistencias semanales',       String(_repDep.profInasistencias||'')),
      dataRow('Profesor más destacado de la semana (explica la razón)',  destText),
      dataRow('Profesor menos destacado de la semana (explica la razón)', menosText),
    ]),

    table([headerRow('Competencias activas', 1), compRows, compEmpty], [TBL_W]),

    table([headerRow('Logros semanales', 3), logroHeader, logroRows, logroEmpty], [COL_L1, COL_L2, COL_L3]),
    notaLogro,

    table([headerRow('Incidencias generales semanales', 2), incHeader, incRows, incEmpty], [COL_I1, COL_I2]),

    table([
      `<w:tr><w:trPr><w:trHeight w:val="340"/></w:trPr>
        ${td('¿En qué te puede ayudar la gerencia deportiva?',{w:TBL_W, bold:true, color:'FFFFFF', shade:'1A7A45', size:21, span:1})}
      </w:tr>`,
      gerenciaRow,
    ], [TBL_W]),

  ].join('\n');

  // ── Header XML (aparece en cada página) ──────────────────────────────────
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="1A7A45"/></w:pBdr>
      <w:jc w:val="right"/>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="1A7A45"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="18"/><w:color w:val="1A7A45"/></w:rPr>
      <w:t xml:space="preserve">Club Campestre Aguascalientes</w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="777777"/></w:rPr>
      <w:t xml:space="preserve"> · Coordinación Fitness</w:t>
    </w:r>
  </w:p>
</w:hdr>`;

  // ── Footer XML ───────────────────────────────────────────────────────────
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pBdr><w:top w:val="single" w:sz="6" w:space="2" w:color="1A7A45"/></w:pBdr>
      <w:jc w:val="center"/>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>
      <w:t xml:space="preserve">Reporte Semanal Deportes · Fitness Control · Club Campestre Aguascalientes · </w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>
      <w:instrText> PAGE </w:instrText>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="999999"/></w:rPr>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
</w:ftr>`;

  // ── Armar document.xml con referencia a header/footer ────────────────────
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHdr1"/>
      <w:footerReference w:type="default" r:id="rIdFtr1"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1260" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // ── Archivos del ZIP ─────────────────────────────────────────────────────
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  // ── Comprimir y descargar ────────────────────────────────────────────────
  const te = new TextEncoder();
  const zipped = fflate.zipSync({
    '[Content_Types].xml':              te.encode(contentTypes),
    '_rels/.rels':                      te.encode(relsRoot),
    'word/document.xml':                te.encode(documentXml),
    'word/header1.xml':                 te.encode(headerXml),
    'word/footer1.xml':                 te.encode(footerXml),
    'word/_rels/document.xml.rels':     te.encode(relsWord),
  }, { level: 6 });

  const blob = new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const nombre = `Reporte_Semanal_Deportes_${(_repDep.disciplina||'Fitness').replace(/\s+/g,'_')}_${(_repDep.semana||'semana').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g,'_').slice(0,35)}.docx`;
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
  showToast(`📄 Word descargado: ${nombre}`, 'ok');
}

// ═══════════════════════════════════════════════════════════════
// EXPORTAR GOOGLE DOCS — HTML descargable que Drive abre nativo
// Sin dependencia de fflate · Compatible 100% con Google Docs
// ═══════════════════════════════════════════════════════════════
function repExportarGDocs() {
  _repLeerCampos();
  repAutoguardar();

  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Nombres de instructores
  const destInst = instructores.find(i => String(i.id) === String(_repDep.profDestacadoId));
  const menosInst = instructores.find(i => String(i.id) === String(_repDep.profMenosId));
  const destNombre = destInst ? destInst.nombre : '';
  const menosNombre = menosInst ? menosInst.nombre : '';
  const profDestCell = destNombre
    ? `<strong>${esc(destNombre)}</strong>${_repDep.profDestacadoRazon ? ', ' + esc(_repDep.profDestacadoRazon) : ''}`
    : '';
  const profMenosCell = menosNombre
    ? `<strong>${esc(menosNombre)}</strong>${_repDep.profMenosRazon ? ', ' + esc(_repDep.profMenosRazon) : ''}`
    : '';

  const compRows = (_repDep.competencias||[]).filter(c=>c.trim())
    .map(c=>`<tr><td style="padding:5px 8px">${esc(c)}</td></tr>`).join('')
    || '<tr><td style="padding:5px 8px;color:#888">—</td></tr>';

  const logroRows = (_repDep.logros||[]).filter(l=>l.logro||l.descripcion).map((l,i)=>`
    <tr>
      <td style="padding:6px 8px;font-weight:bold;vertical-align:top">${i+1}. ${esc(l.logro)}</td>
      <td style="padding:6px 8px;vertical-align:top">${esc(l.descripcion)}</td>
      <td style="padding:6px 8px;text-align:center;vertical-align:top;color:${l.redes==='Si'?'#1a7a45':'#333'};font-weight:${l.redes==='Si'?'bold':'normal'}">${esc(l.redes)}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="padding:5px 8px;color:#888">—</td></tr>';

  const incRows = (_repDep.incidencias||[]).filter(i=>i.incidencia||i.solucion).map(inc=>`
    <tr>
      <td style="padding:6px 8px;vertical-align:top;font-weight:bold">${esc(inc.incidencia)}</td>
      <td style="padding:6px 8px;vertical-align:top">${esc(inc.solucion)}</td>
    </tr>`).join('') || '<tr><td colspan="2" style="padding:6px 8px;color:#888">—</td></tr>';

  const incCount = (_repDep.incidencias||[]).filter(i=>(i.incidencia||'').trim()).length;
  const emptyIncRows = Array(Math.max(0, 4-incCount)).fill('<tr><td style="padding:10px 8px">&nbsp;</td><td>&nbsp;</td></tr>').join('');

  const emptyLogroRows = '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'.repeat(3);

  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte Semanal Deportes · ${esc(_repDep.disciplina||'Fitness')} · ${esc(_repDep.semana)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#222;margin:20px 30px;line-height:1.5}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
td,th{border:1px solid #b0b0b0;padding:5px 8px;vertical-align:top;font-size:10pt}
.sh td{background-color:#1a7a45;color:#ffffff;font-weight:bold;font-size:10.5pt;letter-spacing:0.5px;padding:6px 8px}
.lbl{font-weight:bold;width:42%;background-color:#f2f8f4}
.thdr td{background-color:#e4f2e8;font-weight:bold;font-size:9.5pt;color:#1a5a35}
h1{font-size:16pt;font-weight:bold;color:#111;border-bottom:3px solid #1a7a45;padding-bottom:6px;margin-bottom:18px}
.nota{font-size:8.5pt;color:#555;font-style:italic;margin-bottom:14px}
</style></head><body>

<h1>Reporte semanal | Deportes</h1>

<table>
  <tr class="sh"><td colspan="2">Datos generales</td></tr>
  <tr><td class="lbl">Disciplina</td><td>${esc(_repDep.disciplina)||'Fitness'}</td></tr>
  <tr><td class="lbl">Semana</td><td>${esc(_repDep.semana)}</td></tr>
  <tr><td class="lbl">Director</td><td>${esc(_repDep.director)}</td></tr>
</table>

<table>
  <tr class="sh"><td colspan="2">Objetivos</td></tr>
  <tr><td class="lbl">Objetivo semanal anterior de dirección</td><td>${esc(_repDep.objAnterior)}</td></tr>
  <tr><td class="lbl">¿Se cumplió? Si/ No, ¿Por qué?</td><td>${esc(_repDep.objCumplido)}</td></tr>
  <tr><td class="lbl">Objetivo semanal próximo de dirección</td><td>${esc(_repDep.objProximo)}</td></tr>
</table>

<table>
  <tr class="sh"><td colspan="2">Alumnado</td></tr>
  <tr><td class="lbl">Cantidad total de alumnado</td><td>${esc(_repDep.alumTotal)}</td></tr>
  <tr><td class="lbl">Asistencia total semanal</td><td><strong>${esc(_repDep.alumAsistencia)}</strong></td></tr>
  <tr><td class="lbl">Nuevos alumnos</td><td>${esc(String(_repDep.alumNuevos||''))}</td></tr>
  <tr><td class="lbl">Edades predominantes de alumnado</td><td>${esc(_repDep.alumEdades)}</td></tr>
</table>

<table>
  <tr class="sh"><td colspan="2">Profesores</td></tr>
  <tr><td class="lbl">Cantidad total de profesores</td><td>${esc(String(_repDep.profTotal||''))}</td></tr>
  <tr><td class="lbl">Cantidad total de clases</td><td>${esc(String(_repDep.profClases||''))}</td></tr>
  <tr><td class="lbl">Inasistencias semanales</td><td>${esc(String(_repDep.profInasistencias||''))}</td></tr>
  <tr><td class="lbl">Profesor más destacado de la semana (explica la razón)</td><td>${profDestCell}</td></tr>
  <tr><td class="lbl">Profesor menos destacado de la semana (explica la razón)</td><td>${profMenosCell}</td></tr>
</table>

<table>
  <tr class="sh"><td>Competencias activas</td></tr>
  ${compRows}
  <tr><td style="padding:8px">&nbsp;</td></tr>
  <tr><td style="padding:8px">&nbsp;</td></tr>
</table>

<table>
  <tr class="sh"><td colspan="3">Logros semanales</td></tr>
  <tr class="thdr">
    <td style="width:22%">Logro</td>
    <td style="width:60%">Descripción</td>
    <td style="width:18%;text-align:center;font-size:9pt;line-height:1.3">¿Consideras necesario publicarlo en redes? (Si/ No)</td>
  </tr>
  ${logroRows}
  ${emptyLogroRows}
</table>
<p class="nota">En dado caso que consideres necesario publicarlo en redes, hay que anexar en el drive una carpeta con el número del logro y las imágenes correspondientes.</p>

<table>
  <tr class="sh"><td colspan="2">Incidencias generales semanales</td></tr>
  <tr class="thdr"><td style="width:42%">Incidencia</td><td>Solución</td></tr>
  ${incRows}${emptyIncRows}
</table>

<table>
  <tr class="sh"><td>¿En qué te puede ayudar la gerencia deportiva?</td></tr>
  <tr><td style="min-height:60px;padding:6px 8px;vertical-align:top">${esc(_repDep.ayuda)}</td></tr>
</table>

</body></html>`;

  // Descargar como .html
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nombre = `Reporte_Semanal_Deportes_${(_repDep.disciplina||'Fitness').replace(/\s+/g,'_')}_${(_repDep.semana||'').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_').replace(/_+/g,'_').slice(0,35)}.html`;
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('📝 Archivo descargado. Súbelo a Google Drive y ábrelo con Google Docs.', 'ok');
}

// ── Sidebar: hover expand (tablet) + click-to-collapse (desktop) ──────────
(function() {
  const sb = document.getElementById('sidebar');
  if(!sb) return;

  // Tablet 641-900px: expandir como overlay al pasar el mouse
  // Desktop >900px: expandir como overlay solo cuando está colapsado
  function shouldHoverExpand() {
    const w = window.innerWidth;
    return (w >= 641 && w <= 900) || (w > 900 && _sidebarCollapsed);
  }

  sb.addEventListener('mouseenter', function() {
    if(shouldHoverExpand()) sb.classList.add('sb-hover-expanded');
  });
  sb.addEventListener('mouseleave', function() {
    sb.classList.remove('sb-hover-expanded');
  });

  // Desktop >900px: clic en el contenido principal colapsa el sidebar
  const cw = document.getElementById('content-wrap');
  if(cw) {
    cw.addEventListener('click', function(e) {
      // No colapsar si el clic fue dentro de un modal o overlay
      if(e.target.closest('.ov') || e.target.closest('.modal')) return;
      if(window.innerWidth > 900 && !_sidebarCollapsed) {
        toggleSidebar();
      }
    }, true); // capture phase para capturar antes de que el evento sea consumido
  }
})();


// ── Bloquear orientación portrait en móvil ──────────────────────
(function lockOrientation(){
  if(window.innerWidth > 640) return;
  try {
    if(screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(()=>{});
    }
  } catch(e){}
})();


// ═══ COMPARADOR — utilidades ══════════════════════════
function compAjustarFechas(iniId, finId, preset) {
  const hoyS = fechaLocalStr(hoy);
  let ini, fin;
  if(preset === 'mes') {
    const m = new Date(hoy); m.setDate(1);
    ini = fechaLocalStr(m); fin = hoyS;
  } else if(preset === 'mes-ant') {
    const m = new Date(hoy); m.setDate(1); m.setMonth(m.getMonth()-1);
    const mf = new Date(hoy); mf.setDate(0);
    ini = fechaLocalStr(m); fin = fechaLocalStr(mf);
  } else if(preset === '3meses') {
    const m = new Date(hoy); m.setMonth(m.getMonth()-3);
    ini = fechaLocalStr(m); fin = hoyS;
  } else if(preset === 'anio') {
    ini = `${hoy.getFullYear()}-01-01`; fin = hoyS;
  }
  const a = document.getElementById(iniId); if(a) a.value = ini;
  const b = document.getElementById(finId); if(b) b.value = fin;
}

function compAtajo(preset) {
  const hoyS = fechaLocalStr(hoy);
  let iA,fA,iB,fB;
  if(preset === 'este-mes-vs-ant') {
    const mA = new Date(hoy); mA.setDate(1); mA.setMonth(mA.getMonth()-1);
    const mAf = new Date(hoy); mAf.setDate(0);
    const mB = new Date(hoy); mB.setDate(1);
    iA=fechaLocalStr(mA); fA=fechaLocalStr(mAf);
    iB=fechaLocalStr(mB); fB=hoyS;
  } else if(preset === 'sem-vs-ant') {
    const l=getLunes(0),la=getLunes(-1);
    const lf=new Date(l);lf.setDate(l.getDate()+6);
    const laf=new Date(la);laf.setDate(la.getDate()+6);
    iA=fechaLocalStr(la); fA=fechaLocalStr(laf);
    iB=fechaLocalStr(l);  fB=fechaLocalStr(lf);
  } else if(preset === 'trim-vs-ant') {
    const t1s=new Date(hoy);t1s.setMonth(t1s.getMonth()-6);
    const t1e=new Date(hoy);t1e.setMonth(t1e.getMonth()-3);t1e.setDate(t1e.getDate()-1);
    const t2s=new Date(hoy);t2s.setMonth(t2s.getMonth()-3);
    iA=fechaLocalStr(t1s); fA=fechaLocalStr(t1e);
    iB=fechaLocalStr(t2s); fB=hoyS;
  } else if(preset === 'q1-q2') {
    const yr=hoy.getFullYear();
    iA=`${yr}-01-01`; fA=`${yr}-03-31`;
    iB=`${yr}-04-01`; fB=`${yr}-06-30`;
  }
  ['comp-a-ini','comp-a-fin','comp-b-ini','comp-b-fin'].forEach((id,i)=>{
    const el=document.getElementById(id); if(el) el.value=[iA,fA,iB,fB][i];
  });
  showToast('Fechas cargadas','ok');
}

// Poblar filtros de clase e instructor en panel periodos
const _origRenderComparar = renderComparar;
renderComparar = function() {
  _origRenderComparar();
  // Poblar select de clase
  const sc = document.getElementById('comp-per-clase');
  if(sc && sc.options.length <= 1) {
    const clases=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))].sort();
    clases.forEach(c=>{ const o=document.createElement('option');o.value=c;o.textContent=c;sc.appendChild(o); });
  }
  const si = document.getElementById('comp-per-inst');
  if(si && si.options.length <= 1) {
    instructores.forEach(i=>{ const o=document.createElement('option');o.value=i.id;o.textContent=i.nombre.split(' ').slice(0,2).join(' ');si.appendChild(o); });
  }
};

// Parchar _compPeriodos para respetar filtros de clase/instructor
const _origCompPeriodos = _compPeriodos;
_compPeriodos = function() {
  const claseF = document.getElementById('comp-per-clase')?.value || '';
  const instF  = parseInt(document.getElementById('comp-per-inst')?.value) || 0;
  if(!claseF && !instF) { _origCompPeriodos(); return; }

  const[iA,fA,iB,fB]=['comp-a-ini','comp-a-fin','comp-b-ini','comp-b-fin'].map(id=>document.getElementById(id)?.value);
  if(!iA||!fA||!iB||!fB){showToast('Completa las fechas de ambos periodos','err');return;}

  function filtrar(regs){
    let r=regs;
    if(claseF) r=r.filter(x=>x.clase===claseF);
    if(instF)  r=r.filter(x=>x.inst_id===instF);
    return r;
  }
  const sA=_periodStats(filtrar(_getRegs(iA,fA)));
  const sB=_periodStats(filtrar(_getRegs(iB,fB)));
  const filtroLbl=[claseF,instF?instructores.find(i=>i.id===instF)?.nombre.split(' ')[0]:''].filter(Boolean).join(' · ');

  const rows=[
    {lbl:'Clases Impartidas',a:sA.impartidas,b:sB.impartidas},
    {lbl:'Aforo Promedio',a:sA.aforoProm+'%',b:sB.aforoProm+'%',rA:sA.aforoProm,rB:sB.aforoProm},
    {lbl:'Total Asistentes',a:sA.totalAsis.toLocaleString(),b:sB.totalAsis.toLocaleString(),rA:sA.totalAsis,rB:sB.totalAsis},
    {lbl:'Asist. Promedio',a:sA.impartidas>0?Math.round(sA.totalAsis/sA.impartidas):0,b:sB.impartidas>0?Math.round(sB.totalAsis/sB.impartidas):0},
    {lbl:'Faltas',a:sA.faltas,b:sB.faltas,inv:true},
    {lbl:'Suplencias',a:sA.suplencias,b:sB.suplencias,inv:true},
  ];

  document.getElementById('comp-resultado').innerHTML=`
    ${filtroLbl?`<div style="font-size:.72rem;color:var(--txt2);margin-bottom:.6rem;padding:.4rem .7rem;background:var(--panel2);border-radius:8px">Filtro: <strong>${filtroLbl}</strong></div>`:''}
    <div style="display:flex;gap:.8rem;margin-bottom:1rem;flex-wrap:wrap">
      <div class="comp-card comp-card-a">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--blue);font-weight:700;margin-bottom:.8rem">● A · ${_fmtPer(iA,fA)}</div>
        ${rows.map(r=>`<div class="comp-stat"><div class="comp-stat-lbl">${r.lbl}</div><div class="comp-stat-val" style="color:var(--blue)">${r.a}</div></div>`).join('')}
      </div>
      <div class="comp-card comp-card-b">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold2);font-weight:700;margin-bottom:.8rem">● B · ${_fmtPer(iB,fB)}</div>
        ${rows.map(r=>`<div class="comp-stat"><div class="comp-stat-lbl">${r.lbl}</div><div class="comp-stat-val" style="color:var(--gold2)">${r.b}${_delta(r.rA!==undefined?r.rA:r.a,r.rB!==undefined?r.rB:r.b,r.inv||false)}</div></div>`).join('')}
      </div>
    </div>`;
};

// Mejorar _compClasesComp con más métricas
const _origCompClases = _compClasesComp;
_compClasesComp = function() {
  if(_compClasesSel.length<2){showToast('Selecciona al menos 2 clases','warn');return;}
  const ini=document.getElementById('comp-cl-ini')?.value,fin=document.getElementById('comp-cl-fin')?.value;
  if(!ini||!fin){showToast('Define el periodo','err');return;}
  const regs=_getRegs(ini,fin);
  const COLS=['var(--neon)','var(--blue)','var(--gold2)','var(--red2)'];
  const data=_compClasesSel.map((clase,ci)=>{
    const r=regs.filter(rx=>rx.clase===clase&&(rx.estado==='ok'||rx.estado==='sub'));
    const aR=r.filter(rx=>parseInt(rx.cap||0)>0);
    const totalR=regs.filter(rx=>rx.clase===clase); // incluye faltas
    const faltas=totalR.filter(rx=>rx.estado==='falta').length;
    const cumplimiento=totalR.length>0?Math.round(r.length/totalR.length*100):100;
    const promAsis=r.length>0?Math.round(r.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0)/r.length):0;
    // mejor día
    const porDia={};r.forEach(rx=>{if(!porDia[rx.dia])porDia[rx.dia]={s:0,n:0};const cap=parseInt(rx.cap||0);if(cap>0){porDia[rx.dia].s+=(parseInt(rx.asistentes)||0)/cap*100;porDia[rx.dia].n++;}});
    const mejorDia=Object.entries(porDia).map(([d,v])=>({d,af:v.n>0?Math.round(v.s/v.n):0})).sort((a,b)=>b.af-a.af)[0];
    return{clase,color:COLS[ci],sesiones:r.length,faltas,cumplimiento,
      totalAsis:r.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0),
      promAsis,
      aforoProm:aR.length>0?Math.round(aR.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0)/parseInt(rx.cap)*100,0)/aR.length):0,
      mejorDia:mejorDia?`${mejorDia.d} (${mejorDia.af}%)`:'—',
      insts:[...new Set(r.map(rx=>{const i=instructores.find(i=>i.id===rx.inst_id);return i?i.nombre.split(' ')[0]:'—'}))].join(', ')};
  });
  const mxAfo=Math.max(...data.map(d=>d.aforoProm),1),mxAsi=Math.max(...data.map(d=>d.promAsis),1);
  document.getElementById('comp-resultado').innerHTML=`
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1rem">
      ${data.map(d=>`<div class="panel" style="flex:1;min-width:150px"><div class="pbody">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${d.color};letter-spacing:1px;margin-bottom:.7rem">${d.clase}</div>
        <div class="comp-stat"><div class="comp-stat-lbl">Sesiones</div><div class="comp-stat-val" style="color:${d.color}">${d.sesiones}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Aforo Prom.</div><div class="comp-stat-val" style="color:${d.color}">${d.aforoProm}%</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Asist. Prom.</div><div class="comp-stat-val" style="color:${d.color}">${d.promAsis}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Total Asist.</div><div style="font-size:.9rem;font-weight:600;color:${d.color}">${d.totalAsis.toLocaleString()}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Cumplimiento</div><div style="font-size:.9rem;font-weight:600;color:${d.cumplimiento>=90?'var(--neon)':d.cumplimiento>=70?'var(--gold2)':'var(--red2)'}">${d.cumplimiento}%</div></div>
        <div style="font-size:.63rem;color:var(--txt3);margin-top:.3rem">Mejor día: ${d.mejorDia}</div>
        <div style="font-size:.63rem;color:var(--txt3)">Instructores: ${d.insts}</div>
      </div></div>`).join('')}
    </div>
    <div class="panel"><div class="phdr"><span class="pttl">Aforo %</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500">${d.clase}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.aforoProm/mxAfo*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.aforoProm}%</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="phdr"><span class="pttl">Asistentes Promedio</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500">${d.clase}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.promAsis/mxAsi*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.promAsis}</span></div>`).join('')}
    </div></div>`;
};

// Mejorar _compProfesComp con más métricas
const _origCompProfes = _compProfesComp;
_compProfesComp = function() {
  if(_compProfesSel.length<2){showToast('Selecciona al menos 2 profesores','warn');return;}
  const ini=document.getElementById('comp-pr-ini')?.value,fin=document.getElementById('comp-pr-fin')?.value;
  if(!ini||!fin){showToast('Define el periodo','err');return;}
  const regs=_getRegs(ini,fin);
  const COLS=['var(--neon)','var(--blue)','var(--gold2)','var(--red2)'];
  const data=_compProfesSel.map((instId,ci)=>{
    const inst=instructores.find(i=>i.id===instId);if(!inst)return null;
    const r=regs.filter(rx=>rx.inst_id===instId);
    const imp=r.filter(rx=>rx.estado==='ok'||rx.estado==='sub');
    const aR=imp.filter(rx=>parseInt(rx.cap||0)>0);
    const faltas=r.filter(rx=>rx.estado==='falta').length;
    const total=imp.length+faltas;
    const cumplimiento=total>0?Math.round(imp.length/total*100):100;
    // mejor clase
    const porClase={};imp.forEach(rx=>{if(!porClase[rx.clase])porClase[rx.clase]={s:0,n:0};const cap=parseInt(rx.cap||0);if(cap>0){porClase[rx.clase].s+=(parseInt(rx.asistentes)||0)/cap*100;porClase[rx.clase].n++;}});
    const mejorClase=Object.entries(porClase).map(([c,v])=>({c,af:v.n>0?Math.round(v.s/v.n):0})).sort((a,b)=>b.af-a.af)[0];
    const diasActivos=[...new Set(imp.map(rx=>rx.dia))].join(', ');
    return{nombre:inst.nombre,color:COLS[ci],
      impartidas:imp.length,faltas,suplencias:r.filter(rx=>rx.estado==='sub').length,
      cumplimiento,diasActivos:diasActivos||'—',
      totalAsis:imp.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0),
      aforoProm:aR.length>0?Math.round(aR.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0)/parseInt(rx.cap)*100,0)/aR.length):0,
      mejorClase:mejorClase?`${mejorClase.c} (${mejorClase.af}%)`:'—',
      clases:[...new Set(imp.map(rx=>rx.clase))].join(', ')};
  }).filter(Boolean);
  const mxImp=Math.max(...data.map(d=>d.impartidas),1),mxAfo=Math.max(...data.map(d=>d.aforoProm),1);
  document.getElementById('comp-resultado').innerHTML=`
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1rem">
      ${data.map(d=>`<div class="panel" style="flex:1;min-width:150px"><div class="pbody">
        <div style="font-size:.85rem;font-weight:700;color:${d.color};margin-bottom:.7rem">${d.nombre}</div>
        <div class="comp-stat"><div class="comp-stat-lbl">Impartidas</div><div class="comp-stat-val" style="color:${d.color}">${d.impartidas}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Aforo Prom.</div><div class="comp-stat-val" style="color:${d.color}">${d.aforoProm}%</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Cumplimiento</div><div style="font-size:.9rem;font-weight:600;color:${d.cumplimiento>=90?'var(--neon)':d.cumplimiento>=70?'var(--gold2)':'var(--red2)'}">${d.cumplimiento}%</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Total Asist.</div><div class="comp-stat-val" style="color:${d.color}">${d.totalAsis.toLocaleString()}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Faltas · Suplencias</div><div style="font-size:.85rem;font-weight:600;color:${d.faltas>0?'var(--red2)':'var(--neon)'}">${d.faltas} · ${d.suplencias}</div></div>
        <div style="font-size:.63rem;color:var(--txt3);margin-top:.3rem">Mejor clase: ${d.mejorClase}</div>
        <div style="font-size:.63rem;color:var(--txt3)">Días activos: ${d.diasActivos}</div>
      </div></div>`).join('')}
    </div>
    <div class="panel"><div class="phdr"><span class="pttl">Clases Impartidas</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.nombre.split(' ')[0]}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.impartidas/mxImp*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:30px;text-align:right">${d.impartidas}</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="phdr"><span class="pttl">Aforo Promedio</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.nombre.split(' ')[0]}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.aforoProm/mxAfo*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.aforoProm}%</span></div>`).join('')}
    </div></div>`;
};


function rkToggleSugerencias(id) {
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════
// ═══ CALENDARIO SUPLENCIAS MÓVIL ══════════════════════
// ═══════════════════════════════════════════════════════
let _supCalYear       = new Date().getFullYear();
let _supCalMonth      = new Date().getMonth();
let _supCalDia        = null;  // "YYYY-MM-DD"
let _supCalTrainerId  = null;  // null = todos

const _MESES_SUP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _TRAINER_COLORS = [
  '#E85D04','#7209B7','#0077B6','#2D6A4F','#C1121F',
  '#F59E0B','#0891B2','#BE185D','#15803D','#9333EA'
];

function _supGetColor(instId) {
  return _TRAINER_COLORS[((parseInt(instId)||1) - 1) % _TRAINER_COLORS.length];
}
function _supInitials(nombre) {
  if(!nombre) return '?';
  const p = nombre.trim().split(' ');
  return ((p[0]||'?')[0] + ((p[1]||'')[0]||'')).toUpperCase();
}
function _getSuplenciasAprobadas() {
  return (suplenciasPlan||[]).filter(s =>
    s.estado === 'aprobado' || !s.estado
  );
}
function _buildSupMarkers(yr, mo) {
  const sups = _getSuplenciasAprobadas();
  const filtered = _supCalTrainerId
    ? sups.filter(s => String(s.inst_id) === String(_supCalTrainerId))
    : sups;
  const map = {};
  filtered.forEach(s => {
    if(!s.fecha) return;
    const [sy, sm] = s.fecha.split('-');
    if(parseInt(sy) === yr && parseInt(sm) === mo + 1)
      map[s.fecha] = (map[s.fecha]||0) + 1;
  });
  return map;
}

function renderMobCalSuplencias() {
  const wrap = document.getElementById('mob-sup-cal-wrap');
  if(!wrap) return;

  const yr  = _supCalYear;
  const mo  = _supCalMonth;
  const hoyStr    = fechaLocalStr(new Date());
  const markers   = _buildSupMarkers(yr, mo);
  const primerDow = ((new Date(yr, mo, 1).getDay()) + 6) % 7; // Lun=0
  const diasEnMes = new Date(yr, mo + 1, 0).getDate();

  // ── Chips de entrenadores con suplencias en el mes actual o cualquier mes ──
  const allSups  = _getSuplenciasAprobadas();
  const instIds  = [...new Set(allSups.map(s => s.inst_id))];
  let trainerChipsHTML = '';
  instIds.forEach(id => {
    const inst = (instructores||[]).find(i => String(i.id) === String(id));
    if(!inst) return;
    const col    = _supGetColor(parseInt(id));
    const active = String(_supCalTrainerId) === String(id);
    const count  = allSups.filter(s => String(s.inst_id) === String(id)).length;
    trainerChipsHTML += `<span class="mob-sup-trainer-chip${active?' active':''}"
      style="${active ? `background:${col};border-color:${col};color:#fff;` : ''}"
      onclick="supCalSelTrainer(${id})">
      ${inst.nombre.split(' ')[0]}
      <span style="opacity:.65;font-size:.58rem;margin-left:3px">${count}</span>
    </span>`;
  });

  // ── Grid del calendario ──
  const DOWS = ['L','M','X','J','V','S','D'];
  let calHTML = '<div class="mob-sup-cal-grid">';
  DOWS.forEach(d => { calHTML += `<div class="mob-sup-cal-dow">${d}</div>`; });
  for(let i = 0; i < primerDow; i++)
    calHTML += '<div class="mob-sup-cal-day empty"></div>';
  for(let d = 1; d <= diasEnMes; d++) {
    const key  = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cnt  = markers[key] || 0;
    const isH  = key === hoyStr;
    const isS  = key === _supCalDia;
    const isM  = cnt > 0;
    let cls = 'mob-sup-cal-day';
    if(isS)       cls += ' selec';
    else if(isH)  cls += ' hoy';
    else if(isM)  cls += ' marcado';
    calHTML += `<div class="${cls}" onclick="supCalSelDia('${key}')">
      ${d}${cnt > 0 ? `<span class="mob-sup-cal-badge">${cnt}</span>` : ''}
    </div>`;
  }
  calHTML += '</div>';

  // ── Detalle del día seleccionado ──
  let detailHTML = '';
  if(_supCalDia) {
    const dayData = _getSuplenciasAprobadas().filter(s =>
      s.fecha === _supCalDia &&
      (!_supCalTrainerId || String(s.inst_id) === String(_supCalTrainerId))
    ).sort((a, b) => (a.hora||'').localeCompare(b.hora||''));

    const [dy, dm, dd] = _supCalDia.split('-');
    const fechaFmt = `${parseInt(dd)} de ${_MESES_SUP[parseInt(dm)-1]}`;

    detailHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:8px 0 6px;flex-shrink:0;border-top:1px solid var(--border);margin-top:6px;">
        <span style="font-size:.74rem;font-weight:700;color:var(--txt)">${fechaFmt}</span>
        <span style="font-size:.62rem;background:rgba(232,93,4,.13);color:#E85D04;
                     border:1px solid rgba(232,93,4,.28);border-radius:20px;
                     padding:2px 9px;font-weight:700;">
          ${dayData.length} clase${dayData.length !== 1 ? 's' : ''}
        </span>
      </div>`;

    if(dayData.length === 0) {
      detailHTML += `<div class="mob-sup-empty">Sin suplencias para este día<br>
        <span style="font-size:.68rem">con el filtro actual</span></div>`;
    } else {
      dayData.forEach(s => {
        const instOrig = (instructores||[]).find(i => String(i.id) === String(s.inst_id));
        const supInst  = (instructores||[]).find(i => String(i.id) === String(s.suplente_id));
        const trCol    = _supGetColor(parseInt(s.inst_id) || 1);
        const origName = instOrig ? instOrig.nombre.split(' ').slice(0,2).join(' ') : '?';
        const supName  = supInst  ? supInst.nombre.split(' ').slice(0,2).join(' ')
                                  : (s.suplente_nombre || 'Externo');
        detailHTML += `
          <div class="mob-sup-card" style="border-left:3px solid ${trCol}">
            <div class="mob-sup-card-top">
              <span class="mob-sup-time">⏱ ${s.hora || '—'}</span>
              <span class="mob-sup-classname">${s.clase || '—'}</span>
            </div>
            <div class="mob-sup-persons">
              <div class="mob-sup-person">
                <div class="mob-sup-person-lbl">AUSENTE</div>
                <div class="mob-sup-person-row">
                  <span class="mob-sup-avatar" style="background:${trCol}">
                    ${_supInitials(origName)}
                  </span>
                  <span class="mob-sup-name">${origName}</span>
                </div>
              </div>
              <span class="mob-sup-arrow">→</span>
              <div class="mob-sup-person">
                <div class="mob-sup-person-lbl">SUPLENTE</div>
                <div class="mob-sup-person-row">
                  <span class="mob-sup-avatar" style="background:#374151">
                    ${_supInitials(supName)}
                  </span>
                  <span class="mob-sup-name">${supName}</span>
                </div>
              </div>
            </div>
            ${s.motivo ? `<div style="font-size:.62rem;color:var(--txt3);margin-top:5px;padding-top:5px;border-top:1px solid var(--border)">
              Motivo: ${s.motivo}${s.nota ? ' · ' + s.nota : ''}</div>` : ''}
          </div>`;
      });
    }
  } else {
    // No hay día seleccionado — mostrar resumen del mes
    const countMonth = Object.values(markers).reduce((a,b)=>a+b,0);
    detailHTML = `<div class="mob-sup-empty">
      ${countMonth > 0
        ? `<div style="font-size:1.6rem;font-family:'Bebas Neue',sans-serif;color:var(--neon);margin-bottom:4px">${countMonth}</div>
           <div>suplencia${countMonth!==1?'s':''} en ${_MESES_SUP[mo]}</div>
           <div style="margin-top:6px;font-size:.7rem">Toca un día <span style="color:#E85D04;font-weight:700">marcado</span> para ver el detalle</div>`
        : `<div style="font-size:1.8rem;margin-bottom:4px">📅</div>
           Sin suplencias en ${_MESES_SUP[mo]}<br>
           <span style="font-size:.68rem">Usa el planificador para agregar</span>`
      }
    </div>`;
  }

  // ── Render completo ──
  const totalSups = _getSuplenciasAprobadas().filter(s =>
    !_supCalTrainerId || String(s.inst_id) === String(_supCalTrainerId)
  ).length;

  wrap.innerHTML = `
    <div class="mob-sup-trainer-chips">
      <span class="mob-sup-trainer-chip${!_supCalTrainerId?' active':''}"
        style="${!_supCalTrainerId?'background:var(--verde);border-color:var(--verde);color:#fff;':''}"
        onclick="supCalSelTrainer(null)">
        Todos
        <span style="opacity:.65;font-size:.58rem;margin-left:3px">${totalSups}</span>
      </span>
      ${trainerChipsHTML}
    </div>
    <div class="mob-sup-month-nav">
      <button class="mob-sup-month-btn" onclick="supCalCambiarMes(-1)">‹</button>
      <span class="mob-sup-month-lbl">${_MESES_SUP[mo]} ${yr}</span>
      <button class="mob-sup-month-btn" onclick="supCalCambiarMes(1)">›</button>
    </div>
    ${calHTML}
    <div class="mob-sup-detail-scroll">${detailHTML}</div>
  `;
}

function supCalCambiarMes(delta) {
  _supCalMonth += delta;
  if(_supCalMonth > 11) { _supCalMonth = 0; _supCalYear++; }
  if(_supCalMonth < 0)  { _supCalMonth = 11; _supCalYear--; }
  _supCalDia = null;
  renderMobCalSuplencias();
}
function supCalSelDia(key) {
  _supCalDia = (_supCalDia === key) ? null : key;
  renderMobCalSuplencias();
}
function supCalSelTrainer(id) {
  _supCalTrainerId = id ? parseInt(id) : null;
  _supCalDia = null;
  renderMobCalSuplencias();
}

// ═══════════════════════════════════════════════════════
// ═══ MODAL CALENDARIO SUPLENCIAS (Planificador) ═══════
// ═══════════════════════════════════════════════════════
let _calsupYear    = new Date().getFullYear();
let _calsupMonth   = new Date().getMonth();
let _calsupDia     = null;
let _calsupInstFil = null;

function abrirCalSuplencias() {
  // Sincronizar con el instructor seleccionado en el planificador
  const spl = document.getElementById('spl-inst');
  _calsupInstFil = spl && spl.value ? parseInt(spl.value) : null;
  _calsupYear  = new Date().getFullYear();
  _calsupMonth = new Date().getMonth();
  _calsupDia   = null;

  // Poblar selector de instructores
  _calsupPoblarFiltro();
  _calsupRender();
  document.getElementById('m-cal-suplencias').classList.add('on');
}

function _calsupPoblarFiltro() {
  const sel = document.getElementById('calsup-inst-fil');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los instructores</option>' +
    (instructores||[]).map(i =>
      `<option value="${i.id}" ${String(i.id)===String(_calsupInstFil)?'selected':''}>${i.nombre}</option>`
    ).join('');
  if(_calsupInstFil) sel.value = String(_calsupInstFil);
}

function calsupFiltrarInst() {
  const sel = document.getElementById('calsup-inst-fil');
  _calsupInstFil = sel && sel.value ? parseInt(sel.value) : null;
  _calsupDia = null;
  _calsupRender();
}

function calsupCambiarMes(delta) {
  _calsupMonth += delta;
  if(_calsupMonth > 11) { _calsupMonth = 0; _calsupYear++; }
  if(_calsupMonth < 0)  { _calsupMonth = 11; _calsupYear--; }
  _calsupDia = null;
  _calsupRender();
}

function _calsupGetSups() {
  return (suplenciasPlan||[]).filter(s => s.estado === 'aprobado' || !s.estado);
}

function _calsupBuildMarkers() {
  const yr = _calsupYear, mo = _calsupMonth;
  const sups = _calsupGetSups();
  const filtered = _calsupInstFil
    ? sups.filter(s => String(s.inst_id) === String(_calsupInstFil))
    : sups;
  const map = {};
  filtered.forEach(s => {
    if(!s.fecha) return;
    const [sy, sm] = s.fecha.split('-');
    if(parseInt(sy) === yr && parseInt(sm) === mo + 1)
      map[s.fecha] = (map[s.fecha]||0) + 1;
  });
  return map;
}

function _calsupRender() {
  const yr = _calsupYear, mo = _calsupMonth;
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DOWS  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const hoyStr    = fechaLocalStr(new Date());
  const markers   = _calsupBuildMarkers();
  const primerDow = ((new Date(yr, mo, 1).getDay()) + 6) % 7;
  const diasEnMes = new Date(yr, mo + 1, 0).getDate();

  // Mes label
  const mesLbl = document.getElementById('calsup-mes-lbl');
  if(mesLbl) mesLbl.textContent = MESES[mo] + ' ' + yr;

  // ── Grid ──
  let gridHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">`;
  DOWS.forEach(d => {
    gridHTML += `<div style="text-align:center;font-size:.58rem;font-weight:700;letter-spacing:.3px;color:var(--txt3);padding:2px 0;">${d}</div>`;
  });
  for(let i = 0; i < primerDow; i++)
    gridHTML += `<div></div>`;
  for(let d = 1; d <= diasEnMes; d++) {
    const key  = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cnt  = markers[key] || 0;
    const isH  = key === hoyStr;
    const isS  = key === _calsupDia;
    const isM  = cnt > 0;
    let bg     = 'var(--panel2)';
    let border = '1px solid var(--border)';
    let color  = 'var(--txt2)';
    let fw     = '400';
    if(isS)      { bg='rgba(232,93,4,.18)'; border='2px solid #E85D04'; color='var(--txt)'; fw='700'; }
    else if(isH) { border='1px solid var(--gold2)'; color='var(--gold2)'; fw='700'; }
    else if(isM) { bg='rgba(26,122,69,.13)'; border='1px solid rgba(94,255,160,.28)'; }
    gridHTML += `<div onclick="calsupSelDia('${key}')" style="
      aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
      border-radius:7px;font-size:.75rem;font-weight:${fw};color:${color};
      background:${bg};border:${border};cursor:${isM||isH||isS?'pointer':'default'};
      position:relative;min-height:32px;transition:all .12s;">
      ${d}
      ${cnt > 0 ? `<span style="position:absolute;top:2px;right:2px;background:#E85D04;color:#fff;
        font-size:.44rem;font-weight:700;border-radius:5px;padding:0 3px;line-height:13px;">${cnt}</span>` : ''}
    </div>`;
  }
  gridHTML += '</div>';

  const gridEl = document.getElementById('calsup-cal-grid');
  if(gridEl) gridEl.innerHTML = gridHTML;

  // ── Detalle ──
  const detEl = document.getElementById('calsup-detail');
  if(!detEl) return;

  if(!_calsupDia) {
    const totalMes = Object.values(markers).reduce((a,b)=>a+b,0);
    const instNom  = _calsupInstFil
      ? (instructores||[]).find(i=>i.id===_calsupInstFil)?.nombre || ''
      : '';
    detEl.innerHTML = totalMes > 0
      ? `<div style="text-align:center;padding:14px 0 8px;">
           <div style="font-family:'Bebas Neue',sans-serif;font-size:2.2rem;color:var(--neon);line-height:1">${totalMes}</div>
           <div style="font-size:.74rem;color:var(--txt2);margin-top:2px">
             suplencia${totalMes!==1?'s':''} en ${MESES[mo]}${instNom?' · '+instNom.split(' ')[0]:''}
           </div>
           <div style="font-size:.68rem;color:var(--txt3);margin-top:5px">
             Toca un día <span style="color:#E85D04;font-weight:700">marcado</span> para ver el detalle
           </div>
         </div>`
      : `<div style="text-align:center;padding:14px 0 8px;color:var(--txt3);font-size:.78rem;">
           Sin suplencias en ${MESES[mo]}${instNom?' para '+instNom.split(' ')[0]:''}
         </div>`;
    return;
  }

  // Día seleccionado
  const dayData = _calsupGetSups().filter(s =>
    s.fecha === _calsupDia &&
    (!_calsupInstFil || String(s.inst_id) === String(_calsupInstFil))
  ).sort((a,b) => (a.hora||'').localeCompare(b.hora||''));

  const [dy, dm, dd] = _calsupDia.split('-');
  const MESES2 = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaFmt = `${parseInt(dd)} de ${MESES2[parseInt(dm)-1]} ${dy}`;

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;
    padding:8px 0 7px;border-top:1px solid var(--border);margin-bottom:4px;">
    <span style="font-size:.78rem;font-weight:700;color:var(--txt)">${fechaFmt}</span>
    <span style="font-size:.65rem;background:rgba(232,93,4,.13);color:#E85D04;
      border:1px solid rgba(232,93,4,.28);border-radius:20px;padding:2px 10px;font-weight:700;">
      ${dayData.length} clase${dayData.length!==1?'s':''}
    </span>
  </div>`;

  if(dayData.length === 0) {
    html += `<div style="text-align:center;padding:12px;color:var(--txt3);font-size:.77rem;">
      Sin suplencias para este día con el filtro actual.</div>`;
  } else {
    const COLORS = ['#E85D04','#7209B7','#0077B6','#2D6A4F','#C1121F',
                    '#F59E0B','#0891B2','#BE185D','#15803D','#9333EA'];
    const trColor = id => COLORS[((parseInt(id)||1)-1) % COLORS.length];
    const inits   = n => { if(!n) return '?'; const p=n.trim().split(' '); return((p[0]||'?')[0]+((p[1]||'')[0]||'')).toUpperCase(); };

    dayData.forEach(s => {
      const instOrig = (instructores||[]).find(i=>String(i.id)===String(s.inst_id));
      const supInst  = (instructores||[]).find(i=>String(i.id)===String(s.suplente_id));
      const trCol    = trColor(s.inst_id);
      const origName = instOrig ? instOrig.nombre.split(' ').slice(0,2).join(' ') : '?';
      const supName  = supInst  ? supInst.nombre.split(' ').slice(0,2).join(' ')
                                : (s.suplente_nombre||'Externo');
      html += `
        <div style="background:var(--panel2);border:1px solid var(--border);border-left:3px solid ${trCol};
          border-radius:10px;padding:10px 12px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
            <span style="font-size:.65rem;color:var(--txt3);background:var(--panel);border:1px solid var(--border);
              border-radius:20px;padding:2px 8px;flex-shrink:0;">⏱ ${s.hora||'—'}</span>
            <span style="font-size:.84rem;font-weight:700;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.clase||'—'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;">
              <div style="font-size:.54rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);font-weight:700;margin-bottom:3px;">AUSENTE</div>
              <div style="display:flex;align-items:center;gap:5px;">
                <span style="width:26px;height:26px;border-radius:50%;background:${trCol};display:flex;align-items:center;
                  justify-content:center;font-size:.6rem;font-weight:700;color:#fff;flex-shrink:0;">${inits(origName)}</span>
                <span style="font-size:.76rem;font-weight:600;color:var(--txt);">${origName}</span>
              </div>
            </div>
            <span style="color:var(--txt3);font-size:14px;padding:0 2px;flex-shrink:0;">→</span>
            <div style="flex:1;">
              <div style="font-size:.54rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);font-weight:700;margin-bottom:3px;">SUPLENTE</div>
              <div style="display:flex;align-items:center;gap:5px;">
                <span style="width:26px;height:26px;border-radius:50%;background:#374151;display:flex;align-items:center;
                  justify-content:center;font-size:.6rem;font-weight:700;color:#fff;flex-shrink:0;">${inits(supName)}</span>
                <span style="font-size:.76rem;font-weight:600;color:var(--txt);">${supName}</span>
              </div>
            </div>
          </div>
          ${s.motivo ? `<div style="font-size:.62rem;color:var(--txt3);margin-top:6px;padding-top:6px;
            border-top:1px solid var(--border);">
            Motivo: ${s.motivo}${s.nota?' · '+s.nota:''}</div>` : ''}
        </div>`;
    });
  }
  detEl.innerHTML = html;
}

function calsupSelDia(key) {
  _calsupDia = (_calsupDia === key) ? null : key;
  _calsupRender();
}


// ═══════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// ACCESO DIRECTO A FIRMAS DIGITALES desde el sidebar
// Abre el modal de reportes preconfigurado en modo Firmas Digitales,
// usando la semana actual como rango por defecto.
// ═══════════════════════════════════════════════════════════════════
function abrirFirmasDigitalesDirecto() {
  // ── Abrir el menú de gestión de firmas ──────────────────────────────
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    const estadoWrap   = document.getElementById('fm-estado-wrap');
    const btnContinuar = document.getElementById('fm-btn-continuar');
    const btnEliminar  = document.getElementById('fm-btn-eliminar');
    const btnCrearLbl  = document.getElementById('fm-btn-crear-lbl');
    const btnCrearSub  = document.getElementById('fm-btn-crear-sub');
    const btnCrear     = document.getElementById('fm-btn-crear');

    if(hoja) {
      const firmados   = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
      const semTxt     = hoja.encabezado || `${hoja.semIni} → ${hoja.semFin}`;
      const totalInst  = typeof instructores !== 'undefined'
        ? instructores.filter(i => (i.horario||[]).length > 0).length + 1
        : Math.max(firmados, 1);
      const pendientes = Math.max(0, totalInst - firmados);
      const completa   = pendientes === 0 && firmados > 0;

      if(estadoWrap) {
        const color  = completa ? 'rgba(94,255,160,.08)' : firmados > 0 ? 'rgba(232,184,75,.08)' : 'rgba(94,255,160,.04)';
        const border = completa ? 'rgba(94,255,160,.3)'  : firmados > 0 ? 'rgba(232,184,75,.3)'  : 'rgba(94,255,160,.15)';
        const icono  = completa ? '\u2705' : firmados > 0 ? '\u23f3' : '\U0001f4cb';
        estadoWrap.style.background = color;
        estadoWrap.style.border = `1px solid ${border}`;
        estadoWrap.style.color = 'var(--txt2)';
        estadoWrap.innerHTML =
          `<div style="font-weight:700;color:var(--txt);margin-bottom:3px">${icono} Hoja activa: ${semTxt}</div>` +
          `<div>${firmados} de ${totalInst} firma${totalInst!==1?'s':''} recibida${firmados!==1?'s':''} \u00b7 ` +
          (completa
            ? `<span style="color:var(--neon)">Completa</span>`
            : `<span style="color:var(--gold2)">${pendientes} pendiente${pendientes!==1?'s':''}</span>`) +
          `</div>`;
        estadoWrap.style.display = 'block';
      }
      if(btnContinuar) {
        btnContinuar.style.display = 'flex';
        const subEl = document.getElementById('fm-btn-continuar-sub');
        if(subEl) subEl.textContent = completa
          ? 'Hoja completa \u2014 puedes generar el PDF'
          : `Faltan ${pendientes} firma${pendientes!==1?'s':''}`;
      }
      if(btnEliminar) btnEliminar.style.display = 'flex';
      if(btnCrearLbl) btnCrearLbl.textContent = 'Crear nueva hoja';
      if(btnCrearSub) btnCrearSub.textContent = firmados > 0
        ? `\u26a0 Se perder\u00e1n las ${firmados} firma${firmados!==1?'s':''} actuales`
        : 'Reemplaza la hoja actual vac\u00eda';
      if(btnCrear) btnCrear.style.background = firmados > 0 ? 'rgba(192,57,43,.75)' : '';
    } else {
      if(estadoWrap)   estadoWrap.style.display   = 'none';
      if(btnContinuar) btnContinuar.style.display  = 'none';
      if(btnEliminar)  btnEliminar.style.display   = 'none';
      if(btnCrearLbl)  btnCrearLbl.textContent      = 'Crear nueva hoja';
      if(btnCrearSub)  btnCrearSub.textContent      = 'Se publicar\u00e1 para que los instructores firmen';
      if(btnCrear)     btnCrear.style.background    = '';
    }
  } catch(e) {}

  document.getElementById('m-firmas-menu').classList.add('on');
}

// ── Acciones del menú de firmas ──────────────────────────────────────
function fmAccion(accion) {
  if(accion === 'continuar') {
    cerrarModal('m-firmas-menu');
    try {
      const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
      if(hoja) {
        const elI = document.getElementById('firmas-fecha-ini');
        const elF = document.getElementById('firmas-fecha-fin');
        const elT = document.getElementById('firmas-semana-txt');
        if(elI) elI.value = hoja.semIni || '';
        if(elF) elF.value = hoja.semFin || '';
        if(elT && hoja.encabezado) elT.value = hoja.encabezado;
        if(typeof firmasActualizarLabel === 'function') firmasActualizarLabel();
      }
    } catch(e) {}
    setTimeout(() => { if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales(); }, 100);
    return;
  }

  if(accion === 'eliminar') {
    const hoja = (() => { try { return JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null'); } catch(e){ return null; } })();
    if(!hoja) { if(typeof showToast==='function') showToast('No hay hoja activa', 'info'); return; }
    const firmados = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
    const semTxt   = hoja.encabezado || `${hoja.semIni} \u2192 ${hoja.semFin}`;
    const msg = firmados > 0
      ? `\u00bfEliminar la hoja "${semTxt}"?\n\nTiene ${firmados} firma${firmados!==1?'s':''} guardada${firmados!==1?'s':''}.\nEsta acci\u00f3n no se puede deshacer.`
      : `\u00bfEliminar la hoja "${semTxt}"?`;
    if(!confirm(msg)) return;
    try { localStorage.removeItem('fc_hoja_firmas_activa'); } catch(e) {}
    try {
      if(typeof fbDb !== 'undefined' && fbDb)
        fbDb.ref('fitness/hojaFirmasActiva').remove().catch(()=>{});
    } catch(e) {}
    if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
    if(typeof _syncFirmasBadge === 'function') _syncFirmasBadge();
    cerrarModal('m-firmas-menu');
    if(typeof showToast === 'function') showToast('Hoja de firmas eliminada', 'ok');
    return;
  }

  if(accion === 'crear') {
    const hoja = (() => { try { return JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null'); } catch(e){ return null; } })();
    const firmados = hoja ? Object.values(hoja.firmas || {}).filter(f => f && f.data).length : 0;
    if(firmados > 0) {
      if(!confirm(`\u00bfCrear una nueva hoja?\n\nSe perder\u00e1n las ${firmados} firma${firmados!==1?'s':''} guardadas de la hoja actual.\nEsta acci\u00f3n no se puede deshacer.`)) return;
      try { localStorage.removeItem('fc_hoja_firmas_activa'); } catch(e) {}
    }
    cerrarModal('m-firmas-menu');
    const _hoy  = new Date();
    const _dow  = _hoy.getDay();
    const _diff = _dow === 0 ? -6 : 1 - _dow;
    const _lun  = new Date(_hoy); _lun.setDate(_hoy.getDate() + _diff);
    const _dom  = new Date(_lun); _dom.setDate(_lun.getDate() + 6);
    const _iso  = d => (typeof fechaLocalStr === 'function') ? fechaLocalStr(d) : d.toISOString().slice(0,10);
    const modal = document.getElementById('m-reports');
    if(modal) modal.classList.add('on');
    setTimeout(() => {
      const elI = document.getElementById('firmas-fecha-ini');
      const elF = document.getElementById('firmas-fecha-fin');
      if(elI) elI.value = _iso(_lun);
      if(elF) elF.value = _iso(_dom);
      if(typeof firmasActualizarLabel === 'function') firmasActualizarLabel();
      if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales();
    }, 150);
  }
}

// ── Actualizar badge de Firmas en el sidebar ─────────────────────
// Muestra cuántas firmas están pendientes (instructores sin firmar)
function _syncFirmasBadge() {
  const badge = document.getElementById('sb-firmas-badge');
  if(!badge) return;
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(!hoja) { badge.style.display = 'none'; return; }
    const firmados  = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
    // Contar instructores que tienen clases en el periodo
    const total = typeof instructores !== 'undefined'
      ? instructores.filter(i => (i.horario||[]).length > 0).length + 1 // +1 coordinador
      : 0;
    const pendientes = Math.max(0, total - firmados);
    if(pendientes > 0) {
      badge.textContent = pendientes;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch(e) { badge.style.display = 'none'; }
}

// Sincronizar también los badges móviles (snav y mobile-home)
const _origSyncFirmasBadge = _syncFirmasBadge;
_syncFirmasBadge = function() {
  _origSyncFirmasBadge();
  // Badge en section-nav móvil
  const snavBadge = document.getElementById('snav-firmas-badge');
  const mobBadge  = document.getElementById('mob-firmas-badge');
  const sbBadge   = document.getElementById('sb-firmas-badge');
  const txt = sbBadge ? sbBadge.textContent : '';
  const vis = sbBadge ? sbBadge.style.display : 'none';
  [snavBadge, mobBadge].forEach(b => {
    if(!b) return;
    b.textContent = txt;
    b.style.display = vis;
  });
};

// Correr cada 8 segundos y al cargar
setInterval(_syncFirmasBadge, 8000);
setTimeout(_syncFirmasBadge, 2000);
