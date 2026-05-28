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
  // Defensivo: si los datos globales no se han cargado, devolver stats vacíos en vez de null
  // para que el preview pueda renderizar al menos los ceros y no quedarse en el placeholder del HTML.
  const _regs   = (typeof registros   !== 'undefined' && Array.isArray(registros))   ? registros   : [];
  const _insts  = (typeof instructores!== 'undefined' && Array.isArray(instructores))? instructores: [];

  // Normalizar r.fecha a YYYY-MM-DD tolerando variantes:
  // - "2026-05-04" (canónico, input HTML5)
  // - "2026-05-04T00:00:00" (con tiempo)
  // - "04/05/2026" o "4/5/2026" (DD/MM/YYYY)
  // - Date object
  // - timestamp numérico (ms)
  function _normFecha(v) {
    if(!v) return '';
    if(typeof v === 'number') {
      try { return new Date(v).toISOString().slice(0,10); } catch(e){ return ''; }
    }
    if(v instanceof Date) {
      try { return v.toISOString().slice(0,10); } catch(e){ return ''; }
    }
    const s = String(v).trim();
    // Ya en formato ISO YYYY-MM-DD...
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    // DD/MM/YYYY o D/M/YYYY
    const mEs = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(mEs) {
      const dd = mEs[1].padStart(2,'0');
      const mm = mEs[2].padStart(2,'0');
      return `${mEs[3]}-${mm}-${dd}`;
    }
    return s; // último recurso, dejar tal cual
  }

  const regs = _regs.filter(r => {
    const f = _normFecha(r.fecha);
    return f && f >= ini && f <= fin;
  });
  const impartidas = regs.filter(r => r.estado === 'ok' || r.estado === 'sub');
  const faltas     = regs.filter(r => r.estado === 'falta');
  const totalAsis  = impartidas.reduce((a, r) => a + (parseInt(r.asistentes) || 0), 0);

  // Stats por instructor para sugerir destacado / menos destacado
  // - El aforo se capa a 100% por clase: un sobrecupo (20 personas en sala de 15)
  //   no debe sesgar el ranking semanal hacia quien dio solo 1 clase.
  // - Mantener también el aforo "crudo" (sin capar) para mostrarlo cuando aporte contexto.
  const statsInsts = _insts.map(inst => {
    const iRegs = regs.filter(r => String(r.inst_id) === String(inst.id));
    const iImp  = iRegs.filter(r => r.estado === 'ok' || r.estado === 'sub');
    const iFalt = iRegs.filter(r => r.estado === 'falta').length;
    const iAfor = iImp.filter(r => parseInt(r.cap||0)>0);
    const aforoCap = iAfor.length > 0
      ? Math.round(iAfor.reduce((a,r) => {
          const pct = (parseInt(r.asistentes)||0) / parseInt(r.cap) * 100;
          return a + Math.min(pct, 100); // capar a 100% por clase
        }, 0) / iAfor.length)
      : null;
    const aforoCrudo = iAfor.length > 0
      ? Math.round(iAfor.reduce((a,r) => a + (parseInt(r.asistentes)||0)/parseInt(r.cap)*100, 0) / iAfor.length)
      : null;
    const iAsis = iImp.reduce((a,r) => a + (parseInt(r.asistentes)||0), 0);
    return { inst, clases: iImp.length, faltas: iFalt, aforo: aforoCap, aforoCrudo, asistentes: iAsis };
  }).filter(s => s.clases > 0 || s.faltas > 0);

  // Para ser elegible como "destacado" se requiere haber dado al menos 3 clases en el periodo.
  // Esto evita que alguien con 1 sola clase (aunque sea con aforo perfecto) eclipse a quien
  // sostiene buen desempeño en toda la semana.
  const MIN_CLASES_DESTACADO = 3;
  const elegibles = statsInsts.filter(s => s.aforo !== null && s.clases >= MIN_CLASES_DESTACADO);
  const conAforo  = statsInsts.filter(s => s.aforo !== null && s.clases > 0);

  // Mejor: prioriza elegibles (≥3 clases). Si nadie cumple, cae a "con al menos 1 clase"
  // pero marca la sugerencia como tentativa para que el usuario sepa que el dato es ruidoso.
  let mejor = null, mejorTentativo = false;
  if(elegibles.length > 0) {
    mejor = elegibles.reduce((a,b) => b.aforo > a.aforo ? b : a);
  } else if(conAforo.length > 0) {
    mejor = conAforo.reduce((a,b) => b.aforo > a.aforo ? b : a);
    mejorTentativo = true;
  }

  // Peor: misma lógica, pero el "peor" pondera faltas y aforo bajo.
  let peor = null, peorTentativo = false;
  const peorElegibles = elegibles.filter(s => !mejor || s.inst.id !== mejor.inst.id);
  const peorConAforo  = conAforo.filter(s => !mejor || s.inst.id !== mejor.inst.id);
  if(peorElegibles.length > 0) {
    peor = peorElegibles.reduce((a,b) => {
      const scoreA = (a.aforo||0) - a.faltas*15;
      const scoreB = (b.aforo||0) - b.faltas*15;
      return scoreB < scoreA ? b : a;
    });
  } else if(peorConAforo.length > 0) {
    peor = peorConAforo.reduce((a,b) => {
      const scoreA = (a.aforo||0) - a.faltas*15;
      const scoreB = (b.aforo||0) - b.faltas*15;
      return scoreB < scoreA ? b : a;
    });
    peorTentativo = true;
  } else {
    peor = statsInsts.filter(s=>s.faltas>0).sort((a,b)=>b.faltas-a.faltas)[0] || null;
    if(peor) peorTentativo = true;
  }
  if(mejor) mejor.tentativo = mejorTentativo;
  if(peor)  peor.tentativo  = peorTentativo;

  // Exponer info de diagnóstico (último cálculo) para que el botón manual pueda mostrarlo
  try {
    window._repUltDiag = {
      totalEnRegistros: _regs.length,
      totalEnRango: regs.length,
      ini, fin,
      muestraRegistros: _regs.slice(0,3).map(r => ({ fecha: r.fecha, estado: r.estado, inst_id: r.inst_id })),
      fechasUnicasEnRango: [...new Set(regs.map(r => _normFecha(r.fecha)))].slice(0,7),
      todasFechasUnicas: [...new Set(_regs.map(r => _normFecha(r.fecha)))].sort().slice(-15)
    };
  } catch(e){}

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
  // Cargar datos guardados
  try {
    const s = localStorage.getItem('fc_reporte_dep');
    if(s) _repDep = Object.assign({}, _repDep, JSON.parse(s));
  } catch(e){}

  // Si no hay fechas guardadas, usar semana actual automáticamente
  if(!_repDep.iniDate || !_repDep.finDate) {
    const { ini, fin } = _repGetLunesViernes();
    _repDep.iniDate = ini;
    _repDep.finDate = fin;
  }

  // Fechas → inputs
  const di = document.getElementById('rep-ini-date');
  const df = document.getElementById('rep-fin-date');
  if(di) di.value = _repDep.iniDate;
  if(df) df.value = _repDep.finDate;

  // Texto de semana: recalcular siempre desde las fechas
  _repDep.semana = _repFmtSemana(_repDep.iniDate, _repDep.finDate);

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

  // Autocarga silenciosa del sistema al entrar a la vista (clave en móvil/iPad,
  // donde el usuario no debería tener que pulsar "⚡ Cargar del sistema" manualmente)
  if(_repDep.iniDate && _repDep.finDate) {
    _repAutoCargarSistema(_repDep.iniDate, _repDep.finDate);
  } else {
    _repActualizarPreview(null);
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
// Al cambiar las fechas se carga AUTOMÁTICAMENTE la información del sistema
// (clases, faltas, asistencia, profesores destacados/menos destacados).
// Esto sustituye al click manual del botón "⚡ Cargar del sistema",
// indispensable en móvil/iPad donde el flujo de varios toques se rompe.
function repOnFechaChange() {
  // [DIAG MÓVIL] confirmar que el handler se disparó
  try { showToast('▶ repOnFechaChange disparado','info'); } catch(e){}
  const ini = document.getElementById('rep-ini-date')?.value || '';
  const fin = document.getElementById('rep-fin-date')?.value || '';
  _repDep.iniDate = ini;
  _repDep.finDate = fin;

  // Al cambiar de rango, soltar la fijación manual de destacado/menos
  // para que vuelva a sugerirse según la nueva semana.
  window._repEditadoManual = { destacado:false, menos:false };

  if(ini && fin) {
    // Validar orden de fechas
    if(ini > fin) {
      try { showToast('La fecha de inicio debe ser anterior a la fecha de fin','warn'); } catch(e){}
      return;
    }
    // Recalcular SIEMPRE el texto de la semana desde las fechas (no condicional)
    const semTxt = _repFmtSemana(ini, fin);
    _repDep.semana = semTxt;
    const elSem = document.getElementById('rep-semana');
    if(elSem) elSem.value = semTxt;

    // Cargar datos del sistema automáticamente (silencioso, sin toast)
    _repAutoCargarSistema(ini, fin);
  }
  repAutoguardar();
}

// Carga silenciosa del sistema — usada por onchange de fechas y por render inicial.
// No muestra toast (a diferencia de repCargarSistema) para no saturar al usuario en móvil.
function _repAutoCargarSistema(ini, fin) {
  const stats = _repCalcStats(ini, fin);
  if(!stats) { _repActualizarPreview(null); return; }

  // Profesores
  const tpEl = document.getElementById('rep-prof-total');
  if(tpEl && (typeof instructores !== 'undefined')) tpEl.value = instructores.length;

  const tcEl = document.getElementById('rep-prof-clases');
  if(tcEl) tcEl.value = stats.totalClases;

  const tiEl = document.getElementById('rep-prof-inasistencias');
  if(tiEl) tiEl.value = stats.faltas;

  // Asistencia total
  const asEl = document.getElementById('rep-alum-asistencia');
  if(asEl) asEl.value = stats.totalAsis;

  // Sugerir destacados.
  // Política: el sistema vuelve a sugerir cada vez que se recalcula con un rango distinto,
  // SALVO que el usuario haya editado manualmente ese campo en esta sesión (marca _repEditadoManual).
  // Eso resuelve el problema de que las sugerencias se quedaran "pegadas" entre semanas.
  if(!window._repEditadoManual) window._repEditadoManual = {};

  const dSel = document.getElementById('rep-prof-destacado');
  const mSel = document.getElementById('rep-prof-menos');

  function _formatRazonDestacado(s) {
    const partes = [];
    partes.push(`Aforo promedio del ${s.aforo}%`);
    partes.push(`${s.clases} clase${s.clases===1?'':'s'} impartida${s.clases===1?'':'s'}`);
    partes.push(`${s.asistentes} asistente${s.asistentes===1?'':'s'} totales`);
    let txt = partes.join(' · ');
    if(s.tentativo) {
      txt += ` · ⚠ Sugerencia tentativa: sólo ${s.clases} clase${s.clases===1?'':'s'} en el periodo, el promedio puede no ser representativo.`;
    }
    if(s.aforoCrudo !== null && s.aforoCrudo > s.aforo) {
      txt += ` (sin capar sobrecupo: ${s.aforoCrudo}%).`;
    }
    return txt;
  }
  function _formatRazonMenos(s) {
    const partes = [];
    if(s.faltas > 0) partes.push(`${s.faltas} falta${s.faltas===1?'':'s'} en el periodo`);
    if(s.aforo !== null) partes.push(`aforo promedio del ${s.aforo}%`);
    partes.push(`${s.clases} clase${s.clases===1?'':'s'} impartida${s.clases===1?'':'s'}`);
    let txt = partes.join(', ');
    if(s.tentativo) {
      txt += ` · ⚠ Sugerencia tentativa: pocos datos en el periodo.`;
    }
    return txt;
  }

  if(dSel && stats.mejor && !window._repEditadoManual.destacado) {
    dSel.value = String(stats.mejor.inst.id);
    const razEl = document.getElementById('rep-prof-destacado-razon');
    if(razEl) razEl.value = _formatRazonDestacado(stats.mejor);
  } else if(dSel && !stats.mejor && !window._repEditadoManual.destacado) {
    // No hay candidato en este rango → limpiar
    dSel.value = '';
    const razEl = document.getElementById('rep-prof-destacado-razon');
    if(razEl) razEl.value = '';
  }

  if(mSel && stats.peor && (!stats.mejor || stats.peor.inst.id !== stats.mejor.inst.id) && !window._repEditadoManual.menos) {
    mSel.value = String(stats.peor.inst.id);
    const razEl = document.getElementById('rep-prof-menos-razon');
    if(razEl) razEl.value = _formatRazonMenos(stats.peor);
  } else if(mSel && !stats.peor && !window._repEditadoManual.menos) {
    mSel.value = '';
    const razEl = document.getElementById('rep-prof-menos-razon');
    if(razEl) razEl.value = '';
  }

  _repActualizarPreview(stats);
}

function repSemanaActual() {
  const { ini, fin } = _repGetLunesViernes();
  const di = document.getElementById('rep-ini-date');
  const df = document.getElementById('rep-fin-date');
  if(di) di.value = ini;
  if(df) df.value = fin;
  // Forzar semana en campo texto SIEMPRE (no condicional)
  const semTxt = _repFmtSemana(ini, fin);
  const elSem = document.getElementById('rep-semana');
  if(elSem) elSem.value = semTxt;
  // Dispara el flujo completo (que ya recalcula semana y autocarga sistema)
  repOnFechaChange();
}

// ─── ⚡ Cargar datos del sistema ──────────────────────────────────
// Versión manual (con toast) — disparada por el botón "⚡ Cargar del sistema"
function repCargarSistema() {
  // [DIAG MÓVIL] confirmar que el handler se disparó
  try { showToast('▶ repCargarSistema disparado','info'); } catch(e){ alert('repCargarSistema disparado'); }
  const ini = document.getElementById('rep-ini-date')?.value || '';
  const fin = document.getElementById('rep-fin-date')?.value || '';
  if(!ini || !fin) {
    showToast('Primero selecciona el rango de fechas de la semana','warn');
    return;
  }
  // Recalcular semana
  const semEl = document.getElementById('rep-semana');
  if(semEl) semEl.value = _repFmtSemana(ini, fin);

  _repAutoCargarSistema(ini, fin);
  repAutoguardar();

  // Diagnóstico visible: si no hay registros en el rango, explicar por qué
  const diag = window._repUltDiag;
  if(diag) {
    if(diag.totalEnRegistros === 0) {
      showToast('⚠ No hay registros cargados en el sistema (¿sincronizando Firebase?). Intenta de nuevo en unos segundos.','warn');
      return;
    }
    if(diag.totalEnRango === 0) {
      const ultimas = (diag.todasFechasUnicas || []).slice(-5).join(', ');
      showToast(`⚠ No hay registros entre ${ini} y ${fin}. Hay ${diag.totalEnRegistros} registros en total. Últimas fechas con datos: ${ultimas || '—'}`, 'warn');
      return;
    }
    showToast(`✔ Cargados ${diag.totalEnRango} registros del sistema (${diag.totalEnRegistros} totales)`, 'ok');
  } else {
    showToast('✔ Datos cargados del sistema','ok');
  }
}

// ─── Guardar / Limpiar ───────────────────────────────────────────
function repAutoguardar() {
  _repLeerCampos();
  try { localStorage.setItem('fc_reporte_dep', JSON.stringify(_repDep)); } catch(e){}
}

// Marca que el usuario tocó un campo de destacado/menos para que el sistema
// no lo sobrescriba al cambiar de semana. Se usa desde los handlers del HTML.
function repMarcarEditado(cual) {
  if(!window._repEditadoManual) window._repEditadoManual = {};
  window._repEditadoManual[cual] = true;
}
window.repMarcarEditado = repMarcarEditado;

// Permite al usuario "desfijar" una edición manual y volver a usar la sugerencia
// automática del sistema. Llamada desde un botón pequeño junto a cada selector.
function repRefrescarSugerencia(cual) {
  if(!window._repEditadoManual) window._repEditadoManual = {};
  window._repEditadoManual[cual] = false;
  const ini = document.getElementById('rep-ini-date')?.value || '';
  const fin = document.getElementById('rep-fin-date')?.value || '';
  if(ini && fin) {
    _repAutoCargarSistema(ini, fin);
    repAutoguardar();
    showToast('Sugerencia recalculada desde el sistema','ok');
  } else {
    showToast('Selecciona primero el rango de fechas','warn');
  }
}
window.repRefrescarSugerencia = repRefrescarSugerencia;

// ─── Archivo de reportes guardados ──────────────────────────────
// Cada reporte se guarda en un "slot" identificado por la fecha de inicio (YYYY-MM-DD).
// Eso permite tener varios reportes (uno por semana) y reabrirlos cuando se vuelva
// a seleccionar el mismo rango de fechas. La lista se administra desde "📂 Reportes".
const REP_ARCHIVO_KEY = 'fc_reporte_dep_archivo';

function _repLeerArchivo() {
  try {
    const raw = localStorage.getItem(REP_ARCHIVO_KEY);
    if(!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch(e){ return {}; }
}
function _repEscribirArchivo(obj) {
  try { localStorage.setItem(REP_ARCHIVO_KEY, JSON.stringify(obj)); } catch(e){}
}

function repGuardar() {
  repAutoguardar();
  // Guardar también en el archivo permanente, indexado por fecha de inicio
  const slot = _repDep.iniDate || '';
  if(!slot) {
    showToast('Selecciona la semana antes de guardar','warn');
    return;
  }
  const archivo = _repLeerArchivo();
  archivo[slot] = {
    iniDate: _repDep.iniDate,
    finDate: _repDep.finDate,
    semana:  _repDep.semana,
    director: _repDep.director,
    disciplina: _repDep.disciplina,
    savedAt: Date.now(),
    data: JSON.parse(JSON.stringify(_repDep))
  };
  _repEscribirArchivo(archivo);
  showToast('Reporte guardado ✔ (' + _repFmtSemana(_repDep.iniDate, _repDep.finDate) + ')','ok');
  // Re-render del selector si está abierto
  _repRenderListaGuardados();
}

function _repRenderListaGuardados() {
  const cont = document.getElementById('rep-guardados-list');
  if(!cont) return;
  const archivo = _repLeerArchivo();
  const slots = Object.keys(archivo).sort().reverse(); // más recientes primero
  if(slots.length === 0) {
    cont.innerHTML = '<div style="color:var(--txt3);font-size:.78rem;padding:.7rem;text-align:center">Aún no has guardado ningún reporte. Cuando pulses 💾 Guardar, el reporte se archivará aquí.</div>';
    return;
  }
  const actualSlot = _repDep.iniDate || '';
  cont.innerHTML = slots.map((slot, idx) => {
    const r = archivo[slot];
    const sem = r.semana || _repFmtSemana(r.iniDate, r.finDate);
    const esActual = slot === actualSlot;
    const fechaGuardado = r.savedAt ? new Date(r.savedAt).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'}) : '—';
    return `
      <div class="rep-arch-item" style="display:flex;align-items:center;gap:.6rem;padding:.55rem .7rem;border-radius:9px;background:${esActual?'rgba(26,122,69,.15)':'var(--panel2)'};border:1px solid ${esActual?'var(--verde)':'var(--border)'};margin-bottom:.4rem">
        <div style="flex:1;min-width:0">
          <div style="font-size:.78rem;font-weight:600;color:var(--txt);line-height:1.2">
            <span style="color:var(--neon);font-family:'Bebas Neue',sans-serif;letter-spacing:1px;margin-right:.4rem">#${slots.length - idx}</span>
            ${sem}
          </div>
          <div style="font-size:.65rem;color:var(--txt3);margin-top:2px">
            ${r.disciplina ? r.disciplina + ' · ' : ''}${r.director ? r.director + ' · ' : ''}Guardado el ${fechaGuardado}
          </div>
        </div>
        ${esActual
          ? '<span style="font-size:.65rem;color:var(--neon);background:rgba(26,122,69,.15);border:1px solid var(--verde);border-radius:5px;padding:2px 7px;white-space:nowrap">● Actual</span>'
          : `<button class="btn bo" onclick="repCargarGuardado('${slot}')" style="font-size:.68rem;padding:4px 9px">Abrir</button>`}
        <button class="btn" onclick="repEliminarGuardado('${slot}')" title="Eliminar" style="background:none;border:1px solid var(--border);color:var(--red2);font-size:.78rem;padding:4px 8px;line-height:1">🗑</button>
      </div>`;
  }).join('');
}

function repAbrirArchivo() {
  _repRenderListaGuardados();
  const m = document.getElementById('m-rep-archivo');
  if(m) m.classList.add('on');
}
function repCerrarArchivo() {
  const m = document.getElementById('m-rep-archivo');
  if(m) m.classList.remove('on');
}

function repCargarGuardado(slot) {
  const archivo = _repLeerArchivo();
  const r = archivo[slot];
  if(!r || !r.data) { showToast('No se pudo cargar ese reporte','err'); return; }
  // Si el reporte actual tiene cambios, guardarlo silenciosamente antes de cambiar
  try {
    if(_repDep.iniDate && _repDep.iniDate !== slot) {
      const archivoActual = _repLeerArchivo();
      archivoActual[_repDep.iniDate] = {
        iniDate: _repDep.iniDate, finDate: _repDep.finDate,
        semana: _repDep.semana, director: _repDep.director, disciplina: _repDep.disciplina,
        savedAt: Date.now(), data: JSON.parse(JSON.stringify(_repDep))
      };
      _repEscribirArchivo(archivoActual);
    }
  } catch(e){}
  _repDep = Object.assign({}, _repDep, r.data);
  // Al cargar un reporte guardado, los selects de destacado/menos vienen de _repDep,
  // por lo tanto NO queremos que el autocálculo los sobrescriba después.
  window._repEditadoManual = { destacado:true, menos:true };
  try { localStorage.setItem('fc_reporte_dep', JSON.stringify(_repDep)); } catch(e){}
  renderReporteDep();
  repCerrarArchivo();
  showToast('Reporte cargado: ' + (r.semana || slot), 'ok');
}

function repEliminarGuardado(slot) {
  if(!confirm('¿Eliminar este reporte guardado? Esta acción no se puede deshacer.')) return;
  const archivo = _repLeerArchivo();
  delete archivo[slot];
  _repEscribirArchivo(archivo);
  _repRenderListaGuardados();
  showToast('Reporte eliminado','info');
}

window.repAbrirArchivo     = repAbrirArchivo;
window.repCerrarArchivo    = repCerrarArchivo;
window.repCargarGuardado   = repCargarGuardado;
window.repEliminarGuardado = repEliminarGuardado;

function repLimpiar() {
  if(!confirm('¿Limpiar todos los campos del reporte?')) return;
  window._repEditadoManual = { destacado:false, menos:false };
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
// ─── Hoja membretada Campestre (fondo PDF) — base64 incrustado ───
const _REP_MEMBRETE_B64 = 'data:image/jpeg;base64,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';

// EXPORTAR PDF DIRECTO (jsPDF) — Reporte Semanal Deportes
// Genera PDF profesional sin depender de "imprimir como PDF"
// ═══════════════════════════════════════════════════════════════
function repExportarPDF() {
  _repLeerCampos();
  repAutoguardar();

  if(!window.jspdf){ showToast('Librería jsPDF no disponible. Usa "Imprimir / PDF".','warn'); return; }
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  // Márgenes ajustados a la hoja membretada: ML mayor para librar la cenefa
  // lateral izquierda; MB mayor para librar la barra azul de íconos al pie.
  const PW=210, PH=297, ML=24, MR=14, MB=26, MT=30;
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

  // ── Fondo: hoja membretada Campestre a página completa ──
  function dibujarMembrete() {
    try {
      doc.addImage(_REP_MEMBRETE_B64, 'JPEG', 0, 0, PW, PH, undefined, 'FAST');
    } catch(e) {
      // Respaldo: si la imagen fallara, dibuja la decoración antigua
      const cols=[[59,137,85],[160,200,80],[180,180,180],[26,122,69],[100,170,60],[210,210,210]];
      for(let i=0;i<Math.ceil(PH/12)+2;i++){
        doc.setFillColor(...cols[i%cols.length]);
        doc.circle(3,6+i*12,5.5,'F');
      }
    }
  }

  // ── Footer: número de página (la barra azul ya viene en el membrete) ──
  function dibujarFooter() {
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(120,120,120);
    doc.text(`Pág. ${pNum}`, PW-MR, PH-17, {align:'right'});
  }

  // ── Nueva página ──
  function nuevaPag() {
    if(pNum>0) doc.addPage();
    pNum++;
    dibujarMembrete();
    Y=MT;
  }

  function checkSpace(h) {
    if(Y+h > PH-MB) { dibujarFooter(); nuevaPag(); }
  }

  // ── Título (el logo real ya viene en la hoja membretada) ──
  function dibujarHeader() {
    doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(...NEG);
    doc.text('Reporte semanal | Deportes', ML, Y);
    // Línea verde bajo el título
    Y+=3;
    doc.setDrawColor(...V); doc.setLineWidth(0.8); doc.line(ML,Y,PW-MR,Y);
    Y+=5;
  }

  // ── Encabezado de sección (estilo gerencia: texto verde, fondo blanco, borde negro) ──
  function secHeader(texto) {
    checkSpace(9);
    doc.setFillColor(...BCO);
    doc.setDrawColor(...NEG);
    doc.setLineWidth(0.3);
    doc.rect(ML,Y,CW,6.5,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(...V);
    doc.text(texto, ML+3, Y+4.5);
    Y+=6.5;
  }

  // ── Fila clave-valor (estilo gerencia: fondo blanco, borde negro) ──
  function fila(label, valor) {
    const labelW=72, valW=CW-labelW;
    const maxValW=valW-4;
    const maxLabW=labelW-4;

    // Fuente de la etiqueta: reduce si es larga para que no se corte
    let labFS = 8.5;
    doc.setFont('helvetica','bold'); doc.setFontSize(labFS);
    let labelLines = doc.splitTextToSize(String(label||''), maxLabW);
    while(labelLines.length > 2 && labFS > 7){
      labFS -= 0.5;
      doc.setFontSize(labFS);
      labelLines = doc.splitTextToSize(String(label||''), maxLabW);
    }

    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(String(valor||''), maxValW);
    const h = Math.max(7, Math.max(lines.length*3.6, labelLines.length*(labFS*0.42))+3);

    checkSpace(h);
    // Celda etiqueta — fondo blanco, borde negro
    doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
    doc.rect(ML,Y,labelW,h,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(labFS); doc.setTextColor(...NEG);
    doc.text(labelLines, ML+2.5, Y+4);

    // Celda valor — fondo blanco, borde negro
    doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
    doc.rect(ML+labelW,Y,valW,h,'FD');
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...NEG);
    doc.text(lines, ML+labelW+2.5, Y+4.2);
    Y+=h;
  }

  // ── Tabla multi-columna ──
  function tblHeader(cols, widths) {
    // Altura automática según la columna con más líneas
    doc.setFont('helvetica','bold'); doc.setFontSize(7.8);
    let nLines=1;
    const colLines = cols.map((txt,i)=>{
      const l = doc.splitTextToSize(txt, widths[i]-4);
      nLines = Math.max(nLines, l.length);
      return l;
    });
    const h = Math.max(6.5, nLines*3.4+2.5);
    checkSpace(h+7);
    let x=ML;
    colLines.forEach((lines,i)=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
      doc.rect(x,Y,widths[i],h,'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(7.8); doc.setTextColor(...NEG);
      doc.text(lines, x+2, Y+3.6);
      x+=widths[i];
    });
    Y+=h;
  }

  function tblRow(cells, widths, opts={}) {
    const h = opts.h || 7;
    checkSpace(h);
    let x=ML;
    cells.forEach((txt,i)=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
      doc.rect(x,Y,widths[i],h,'FD');
      const bold = opts.boldCols && opts.boldCols.includes(i);
      doc.setFont('helvetica', bold?'bold':'normal');
      doc.setFontSize(7.8); doc.setTextColor(...(opts.color||NEG));
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
      doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
      doc.rect(x,Y,widths[i],maxH,'FD');
      const bold = opts.boldCols && opts.boldCols.includes(i);
      doc.setFont('helvetica', bold?'bold':'normal');
      doc.setFontSize(7.8); doc.setTextColor(...(opts.color||NEG));
      doc.text(lines, x+2, Y+4);
      x+=widths[i];
    });
    Y+=maxH;
  }

  function emptyRow(widths, h=8) {
    checkSpace(h);
    let x=ML;
    widths.forEach(w=>{
      doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
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
    doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
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
  doc.setFillColor(...BCO); doc.setDrawColor(...NEG); doc.setLineWidth(0.25);
  doc.rect(ML,Y,CW,ayudaH,'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...NEG);
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
    setTimeout(() => { if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales('continuar'); }, 100);
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

  // Fix: Badge de Firmas de Suplencias en el nuevo item del sidebar
  const supBadge = document.getElementById('sb-firmas-sup-badge');
  if(supBadge) {
    try {
      const hoja = typeof sfv2_cargarHoja === 'function' ? sfv2_cargarHoja() : null;
      if(!hoja) { supBadge.style.display = 'none'; return; }
      const firmados = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
      const total = typeof sfv2_suplentesUnicos === 'function' ? sfv2_suplentesUnicos(hoja).length : 0;
      const pend = Math.max(0, total - firmados);
      supBadge.textContent = pend;
      supBadge.style.display = pend > 0 ? 'inline' : 'none';
    } catch(e) { supBadge.style.display = 'none'; }
  }
};

// Correr cada 8 segundos y al cargar
setInterval(_syncFirmasBadge, 8000);
setTimeout(_syncFirmasBadge, 2000);

// ═══════════════════════════════════════════════════════════════════
// EXPOSICIÓN EXPLÍCITA AL WINDOW — garantía para handlers inline en móvil
// (algunos navegadores móviles tienen problemas resolviendo funciones
// declaradas en scripts diferidos cuando se cachean por PWA)
// ═══════════════════════════════════════════════════════════════════
// Exposición directa al window — sin eval (compatible con todos los navegadores móviles y Safari)
window.renderReporteDep        = renderReporteDep;
window.repOnFechaChange        = repOnFechaChange;
window.repSemanaActual         = repSemanaActual;
window.repCargarSistema        = repCargarSistema;
window._repAutoCargarSistema   = _repAutoCargarSistema;
window._repCalcStats           = _repCalcStats;
window._repActualizarPreview   = _repActualizarPreview;
window._repFmtSemana           = _repFmtSemana;
window.repAutoguardar          = repAutoguardar;
window.repLimpiar              = repLimpiar;
window.repGuardar              = repGuardar;
window.repImprimir             = repImprimir;
window.repExportarPDF          = repExportarPDF;
window.repExportarGDocs        = repExportarGDocs;
window.repAddComp              = repAddComp;
window.repDelComp              = repDelComp;
window.repAddLogro             = repAddLogro;
window.repDelLogro             = repDelLogro;
window.repAddIncidencia        = repAddIncidencia;
window.repDelIncidencia        = repDelIncidencia;
window.repRenderCompetencias   = repRenderCompetencias;
window.repRenderLogros         = repRenderLogros;
window.repRenderIncidencias    = repRenderIncidencias;
window._repLeerCampos          = _repLeerCampos;
window._repPoblarInstructores  = _repPoblarInstructores;
