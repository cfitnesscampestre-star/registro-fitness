// ═══ LOG DE CAMBIOS ═══════════════════════════════════
// ═══════════════════════════════════════════════════════
let logCambios = JSON.parse(localStorage.getItem('fc_log') || '[]');

function registrarLog(tipo, detalle) {
  const entry = {
    id:     Date.now(),
    ts:     new Date().toISOString(),
    rol:    typeof rolActual !== 'undefined' ? (rolActual || 'sistema') : 'sistema',
    tipo,
    detalle
  };
  logCambios.unshift(entry);
  if(logCambios.length > 300) logCambios = logCambios.slice(0, 300);
  try { localStorage.setItem('fc_log', JSON.stringify(logCambios)); } catch(e){}
  // Actualizar badge del tab Log si está visible
  const logLbl = document.getElementById('log-count-lbl');
  if(logLbl) logLbl.textContent = `${logCambios.length} eventos`;
}

function renderLog() {
  const tipoFil = (document.getElementById('log-filtro-tipo')||{}).value || '';
  const rolFil  = (document.getElementById('log-filtro-rol')||{}).value  || '';
  const lista   = logCambios.filter(e =>
    (!tipoFil || e.tipo === tipoFil) &&
    (!rolFil  || e.rol  === rolFil)
  );
  const lbl = document.getElementById('log-count-lbl');
  if(lbl) lbl.textContent = `${logCambios.length} eventos`;

  const TIPO_ICON = {
    clase:'<svg class="ico" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="7" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/></svg>',
    falta:'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    instructor:'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 18 Q3 12 10 12 Q17 12 17 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
    suplencia:'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    recorrido:'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 6 L9 11 L7 16 M10 6 L11 11 L13 16 M9 11 L12 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sistema:'<svg class="ico" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
  };
  const TIPO_COL = { clase:'var(--neon)', falta:'var(--gold2)', instructor:'var(--blue)', suplencia:'var(--blue)', recorrido:'var(--neon)', sistema:'var(--txt2)' };
  const ROL_CHIP = { admin:'<span class="chip cpl">Coordinador</span>', usuario:'<span class="chip cho">Consulta</span>', sistema:'<span class="chip" style="background:var(--panel2);color:var(--txt3)">Sistema</span>' };

  document.getElementById('log-body').innerHTML = lista.length === 0
    ? `<tr><td colspan="4" class="empty">Sin eventos en el filtro seleccionado</td></tr>`
    : lista.map(e => {
        const d   = new Date(e.ts);
        const fec = d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
        const hor = d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
        const icon = TIPO_ICON[e.tipo] || TIPO_ICON.sistema;
        const col  = TIPO_COL[e.tipo]  || 'var(--txt2)';
        return `<tr>
          <td class="mono" style="font-size:.75rem;white-space:nowrap">${fec} ${hor}</td>
          <td>${ROL_CHIP[e.rol] || ROL_CHIP.sistema}</td>
          <td style="color:${col}">${icon} ${e.tipo}</td>
          <td style="font-size:.77rem;color:var(--txt2);max-width:340px">${e.detalle}</td>
        </tr>`;
      }).join('');
}

function limpiarLog() {
  if(!confirm('¿Borrar todo el historial de cambios? Esta acción no se puede deshacer.')) return;
  logCambios = [];
  try { localStorage.setItem('fc_log','[]'); } catch(e){}
  renderLog();
  showToast('Log limpiado.','ok');
}

// ═══════════════════════════════════════════════════════
// ═══ VISTA HOY ════════════════════════════════════════
// ═══════════════════════════════════════════════════════
function renderHoy() {
  const hoyStr  = fechaLocalStr(vistaFecha);
  const diaHoy  = DIAS[(vistaFecha.getDay() + 6) % 7]; // Lunes=0…Domingo=6
  const fecLbl  = vistaFecha.toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const esHoyReal = fechaLocalStr(vistaFecha) === fechaLocalStr(hoy);

  document.getElementById('hoy-fecha-lbl').textContent =
    vistaFecha.toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase();
  document.getElementById('hoy-dia-lbl').textContent = fecLbl.charAt(0).toUpperCase() + fecLbl.slice(1);

  // Sync date pickers
  const dp = document.getElementById('hoy-date-picker');
  if(dp && dp.value !== hoyStr) dp.value = hoyStr;
  const dpM = document.getElementById('mob-date-picker');
  if(dpM && dpM.value !== hoyStr) dpM.value = hoyStr;

  // Botón "Hoy": solo visible cuando estamos en otra fecha
  const btnHoy = document.getElementById('hoy-btn-hoy');
  if(btnHoy) btnHoy.style.opacity = esHoyReal ? '0.35' : '1';
  const btnHoyMob = document.getElementById('mob-btn-hoy');
  if(btnHoyMob) btnHoyMob.style.opacity = esHoyReal ? '0.35' : '1';

  // Construir lista de clases programadas hoy
  const clasesHoy = [];
  instructores.forEach(inst => {
    (inst.horario || []).forEach(slot => {
      if(slot.dia !== diaHoy) return;
      const regs = registros.filter(r =>
        String(r.inst_id)===String(inst.id) && r.fecha === hoyStr &&
        r.dia === slot.dia && r.hora === slot.hora
      );
      const reg = regs.length > 0 ? regs[regs.length - 1] : null;
      const capN = (reg && parseInt(reg.cap) > 0) ? parseInt(reg.cap) : getCapClase(slot.clase);
      clasesHoy.push({ inst, slot, reg, capN });
    });
  });

  // Ordenar por hora
  clasesHoy.sort((a, b) => a.slot.hora.localeCompare(b.slot.hora));

  const total      = clasesHoy.length;
  const registradas = clasesHoy.filter(c => c.reg).length;
  const pendientes  = total - registradas;
  const totalAsis   = clasesHoy.filter(c=>c.reg&&(c.reg.estado==='ok'||c.reg.estado==='sub')).reduce((a,c)=>a+(parseInt(c.reg.asistentes)||0),0);
  const pctCompleto = total > 0 ? Math.round(registradas / total * 100) : 0;

  // KPIs
  document.getElementById('hoy-kpis').innerHTML = `
    <div class="kpi"><div class="klbl">Programadas</div><div class="kval">${total}</div><div class="ksub">${diaHoy}</div></div>
    <div class="kpi ${pctCompleto===100?'nn':'gd'}">
      <div class="klbl">Registradas</div>
      <div class="kval" style="color:${pctCompleto===100?'var(--neon)':pctCompleto>=50?'var(--gold2)':'var(--red2)'}">${registradas}</div>
      <div class="ksub">${pctCompleto}% completado</div>
      <div class="kpi-bar-wrap"><div class="kpi-bar-fill" style="width:${pctCompleto}%;background:${pctCompleto===100?'var(--neon)':pctCompleto>=50?'var(--gold2)':'var(--red2)'}"></div></div>
    </div>
    <div class="kpi ${pendientes>0?'rd':'nn'}">
      <div class="klbl">Pendientes</div>
      <div class="kval" style="color:${pendientes===0?'var(--neon)':'var(--red2)'}">${pendientes}</div>
      <div class="ksub">${pendientes===0?'¡Todo al día!':'Sin registrar'}</div>
    </div>
    <div class="kpi bl"><div class="klbl">Asistentes${esHoyReal?' Hoy':''}</div><div class="kval" style="color:var(--blue)">${totalAsis}</div><div class="ksub">${esHoyReal?'Total acumulado':diaHoy+' '+hoyStr.slice(8)}</div></div>`;

  // Alerta de pendientes (solo si es el día actual)
  const alertaEl = document.getElementById('hoy-alerta-sin-reg');
  if(pendientes > 0 && esHoyReal) {
    alertaEl.style.display = 'block';
    alertaEl.innerHTML = `<div style="background:rgba(224,80,80,.1);border:1px solid var(--red);border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;gap:.7rem">
      <span style="font-size:1.1rem">⚠</span>
      <div style="flex:1;font-size:.8rem"><strong style="color:var(--red2)">${pendientes} clase(s) sin registrar hoy</strong> — Recuerda completar el registro antes de cerrar el día.</div>
    </div>`;
  } else if(pendientes > 0 && !esHoyReal) {
    alertaEl.style.display = 'block';
    alertaEl.innerHTML = `<div style="background:rgba(232,184,75,.08);border:1px solid var(--gold);border-radius:10px;padding:.65rem 1rem;display:flex;align-items:center;gap:.7rem">
      <span style="font-size:1rem">📅</span>
      <div style="flex:1;font-size:.78rem;color:var(--gold2)">Consultando <strong>${diaHoy} ${hoyStr}</strong> — ${pendientes} clase(s) sin registrar en esta fecha.</div>
    </div>`;
  } else {
    alertaEl.style.display = 'none';
  }

  // Badge en el tab (solo si es el día actual)
  const badge = document.getElementById('hoy-tab-badge');
  if(badge) {
    const pendHoy = esHoyReal ? pendientes : (() => {
      const hStr=fechaLocalStr(hoy), dHoy=DIAS[(hoy.getDay()+6)%7];
      let p=0;
      instructores.forEach(inst=>(inst.horario||[]).forEach(slot=>{
        if(slot.dia!==dHoy)return;
        if(!registros.some(r=>String(r.inst_id)===String(inst.id)&&r.fecha===hStr&&r.dia===slot.dia&&r.hora===slot.hora))p++;
      }));
      return p;
    })();
    badge.style.display = pendHoy > 0 ? 'inline' : 'none';
    badge.textContent = pendHoy;
  }

  // Filtro
  const filtro = (document.getElementById('hoy-filtro')||{}).value || 'todas';
  const lista = clasesHoy.filter(c => {
    if(filtro === 'pendientes') return !c.reg;
    if(filtro === 'registradas') return !!c.reg;
    return true;
  });

  if(lista.length === 0) {
    document.getElementById('hoy-body').innerHTML = `<tr><td colspan="8" class="empty">${total === 0 ? `No hay clases programadas para el ${diaHoy} ${hoyStr}.` : 'Sin clases en este filtro.'}</td></tr>`;
    return;
  }

  document.getElementById('hoy-body').innerHTML = lista.map(({ inst, slot, reg, capN }) => {
    const tieneReg   = !!reg;
    const estado     = reg ? reg.estado : 'pendiente';
    const asis       = tieneReg ? (parseInt(reg.asistentes) || 0) : '—';
    const afoP       = tieneReg && capN > 0 ? Math.round((parseInt(reg.asistentes)||0) / capN * 100) : null;
    const salonNombre = (salones.find(s => s.clases && s.clases.some(c => c.toLowerCase() === slot.clase.toLowerCase())) || {}).nombre || '—';

    const estadoChip = {
      ok:      '<span class="chip cok"><svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Ok</span>',
      sub:     '<span class="chip cpl"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg> Suplencia</span>',
      falta:   '<span class="chip cbd"><svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Falta</span>',
      pendiente:'<span class="chip cwn">⏳ Pendiente</span>'
    }[estado] || '<span class="chip">—</span>';

    const aforoCell = afoP !== null
      ? `<div class="bw"><div class="bar"><div class="bf" style="width:${Math.min(afoP,100)}%;background:${pctCol(afoP)}"></div></div><span class="mono" style="color:${pctCol(afoP)}">${afoP}%</span></div>`
      : '<span style="color:var(--txt3)">—</span>';

    const btnReg = !tieneReg
      ? `<button class="abtn bg solo-admin" style="font-size:.7rem;padding:3px 9px" onclick="abrirRegistroDesdeCalendario(${inst.id},'${slot.dia}','${slot.hora}','${slot.clase}','${hoyStr}')">+ Registrar</button>`
      : `<button class="abtn solo-admin" style="font-size:.7rem;padding:3px 9px" onclick="abrirRegistroDesdeCalendario(${inst.id},'${slot.dia}','${slot.hora}','${slot.clase}','${hoyStr}')">Editar</button>`;

    return `<tr style="${!tieneReg?'background:rgba(224,80,80,.04)':''}">
      <td class="mono" style="font-weight:700;color:var(--neon)">${slot.hora}</td>
      <td><strong>${slot.clase}</strong></td>
      <td>${inst.nombre}<br><span style="font-size:.67rem;color:var(--txt3)">${inst.tipo==='planta'?'Planta':'Honor.'}</span></td>
      <td style="font-size:.75rem;color:var(--txt2)">${salonNombre} <span class="mono" style="color:var(--txt3)">·${capN}p</span></td>
      <td>${estadoChip}</td>
      <td class="mono" style="text-align:center">${asis}</td>
      <td>${aforoCell}</td>
      <td>${btnReg}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// ═══ VERIFICAR CLASES SIN REGISTRAR ══════════════════
// ═══════════════════════════════════════════════════════
function verificarClasesSinRegistrar(silencioso = false) {
  // Solo aplica para coordinador — el instructor no ve clases de otros
  if(typeof rolActual !== 'undefined' && rolActual === 'instructor') return;

  const hoyStr = fechaLocalStr(hoy);
  const diaHoy = DIAS[(hoy.getDay() + 6) % 7];

  const pendientes = [];
  instructores.forEach(inst => {
    (inst.horario || []).forEach(slot => {
      if(slot.dia !== diaHoy) return;
      const tieneReg = registros.some(r =>
        String(r.inst_id)===String(inst.id) && r.fecha === hoyStr &&
        r.dia === slot.dia && r.hora === slot.hora
      );
      if(!tieneReg) pendientes.push(`${slot.hora} ${slot.clase} (${inst.nombre.split(' ')[0]})`);
    });
  });

  if(pendientes.length === 0) {
    showToast('¡Todo al día! No hay clases pendientes de registrar hoy.', 'ok');
    return;
  }

  const txt = pendientes.length <= 4
    ? pendientes.join(', ')
    : `${pendientes.slice(0,3).join(', ')} y ${pendientes.length-3} más`;
  showToast(`${pendientes.length} clase(s) sin registrar hoy: ${txt}`, 'warn');

  // Actualizar badge del tab Hoy
  const badge = document.getElementById('hoy-tab-badge');
  if(badge) { badge.style.display = 'inline'; badge.textContent = pendientes.length; }

  if(!silencioso) {
    // Ir a la vista Hoy si no estamos ahí
    const vistaHoy = document.getElementById('v-hoy');
    if(vistaHoy && !vistaHoy.classList.contains('on')) {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      document.querySelectorAll('.vista').forEach(x => x.classList.remove('on'));
      document.querySelector('[data-v="hoy"]').classList.add('on');
      vistaHoy.classList.add('on');
      document.getElementById('hoy-filtro').value = 'pendientes';
      renderHoy();
    }
  }
}

// ═══════════════════════════════════════════════════════
// ═══ REGISTRO DESDE CALENDARIO ════════════════════════
// ═══════════════════════════════════════════════════════
function abrirRegistroDesdeCalendario(instId, dia, hora, clase, fechaStr) {
  // Abrir el modal — esto carga la lista de instructores
  abrirModal('m-clase');

  // Pequeño delay para que el DOM esté listo
  setTimeout(() => {
    const instSel = document.getElementById('rc-inst');
    if(!instSel) return;

    // Seleccionar el instructor
    instSel.value = String(instId);

    // Recargar los horarios para ese instructor
    cargarHorariosInst();

    // Poner la fecha
    const fechaInp = document.getElementById('rc-fecha');
    if(fechaInp) fechaInp.value = fechaStr;

    // Encontrar el índice del slot correcto (misma lógica que cargarHorariosInst)
    const inst = instructores.find(i => i.id === instId);
    if(!inst || !(inst.horario || []).length) return;

    const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const slots = [...inst.horario].sort((a, b) => {
      const di = ordenDias.indexOf(a.dia) - ordenDias.indexOf(b.dia);
      return di !== 0 ? di : a.hora.localeCompare(b.hora);
    });

    const idx = slots.findIndex(s => s.dia === dia && s.hora === hora && s.clase === clase);
    if(idx >= 0) {
      document.getElementById('rc-horario').value = String(idx);
      autoRellenarHorario();
    }

    // Si ya había un registro hoy para este slot, pre-rellenar asistentes con el último valor
    const prev = registros.filter(r =>
      r.inst_id === instId && r.dia === dia && r.hora === hora
    ).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if(prev.length > 0) {
      const asisInp = document.getElementById('rc-asis');
      if(asisInp && !asisInp.value) asisInp.value = prev[0].asistentes || '';
    }
  }, 60);
}


// ═══════════════════════════════════════════════════════
// ═══ NAVEGACIÓN POR SECCIONES ════════════════════════
// ═══════════════════════════════════════════════════════
const NAV_SECTIONS = {
  hoy:      { views: ['hoy'], label: null },
  programa: { views: ['calendario','sup-plan'], label: { calendario:'Calendario', 'sup-plan':'Suplencias Plan.' } },
  equipo:   { views: ['instructores','salones'], label: { instructores:'Instructores', salones:'Salones' } },
  analisis: { views: ['dashboard','historial','ranking','heatmap','diagnostico','comparar'], label: { dashboard:'Dashboard', historial:'Historial', ranking:'Ranking', heatmap:'Mapa de Calor', diagnostico:'Diagnóstico', comparar:'Comparar' } },
  mas:      { views: ['recorridos','alertas','log','reporte-dep','eventos'], label: { recorridos:'Recorridos', alertas:'Alertas', log:'Log', 'reporte-dep':'Reporte Dep.', eventos:'Eventos' } }
};

const VIEW_TO_SECTION = {};
Object.entries(NAV_SECTIONS).forEach(([sec, cfg]) => cfg.views.forEach(v => VIEW_TO_SECTION[v] = sec));

let _activeSection = 'hoy';
const _lastView = { hoy:'hoy', programa:'calendario', equipo:'instructores', analisis:'dashboard', mas:'recorridos' };

function switchSection(section) {
  _activeSection = section;
  const view = _lastView[section] || NAV_SECTIONS[section].views[0];
  _activateView(view, section);
}

function navegarA(viewId) {
  const section = VIEW_TO_SECTION[viewId];
  if(!section) return;
  _lastView[section] = viewId;
  _activeSection = section;
  _activateView(viewId, section);
}

function _activateView(viewId, section) {
  // Si el rol activo es instructor, no tocar la UI del coordinador
  if(typeof rolActual !== 'undefined' && rolActual === 'instructor') return;

  _lastView[section] = viewId;

  // En móvil, sección 'hoy' = mobile-home (no usa .vista)
  const isMobile = window.innerWidth <= 640;
  const backBar = document.getElementById('mob-back-bar');
  const backLbl = document.getElementById('mob-back-section-lbl');
  if(isMobile && section === 'hoy') {
    document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));
    document.getElementById('mobile-home').classList.add('on');
    document.getElementById('mob-search-overlay').classList.remove('on');
    document.getElementById('mob-agenda-overlay').classList.remove('on');
    if(backBar) backBar.style.display = 'none';
    // Resetear scroll y volver al slide 0
    const mh = document.getElementById('mobile-home');
    if(mh) mh.scrollTop = 0;
    const track = document.getElementById('mob-track');
    if(track) { track.style.transition='none'; track.style.transform='translateX(0)'; }
    document.querySelectorAll('.mob-dot').forEach((d,i)=>d.classList.toggle('on',i===0));
    try{ _mobSlide=0; }catch(e){}
    renderMobileHome();
    _updateNavActive(section, null);
    return;
  } else {
    // En móvil navegando a otra sección, o en desktop: ocultar mobile-home siempre
    document.getElementById('mobile-home').classList.remove('on');
    if(isMobile && backBar) {
      backBar.style.display = 'flex';
      const sectionNames = { programa:'Programa', equipo:'Equipo', analisis:'Análisis', mas:'Más' };
      if(backLbl) backLbl.textContent = sectionNames[section] || '';
    } else if(backBar) {
      backBar.style.display = 'none';
    }
  }
  // Vistas
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));
  const vistaEl = document.getElementById('v-' + viewId);
  if(vistaEl) vistaEl.classList.add('on');

  _updateNavActive(section, viewId);
}
function _updateNavActive(section, viewId) {
  // Section nav desktop
  document.querySelectorAll('.snav-item').forEach(s => s.classList.remove('on'));
  document.querySelector(`.snav-item[data-s="${section}"]`)?.classList.add('on');

  // Bottom nav móvil
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('on'));
  document.querySelector(`.bnav-item[data-s="${section}"]`)?.classList.add('on');

  // Sub-tabs
  const cfg = NAV_SECTIONS[section];
  const subTabsEl = document.getElementById('sub-tabs');
  if(subTabsEl) {
    if(cfg && cfg.views.length > 1) {
      subTabsEl.classList.add('on');
      subTabsEl.innerHTML = cfg.views.map(v =>
        `<div class="stab ${v === viewId ? 'on' : ''}" onclick="navegarA('${v}')">${cfg.label[v]}</div>`
      ).join('');
    } else {
      subTabsEl.classList.remove('on');
      subTabsEl.innerHTML = '';
    }
  }

  // Sincronizar sidebar
  _syncSidebar(section, viewId || '');

  if(!viewId) return;
  // Compatibilidad con listeners del sistema viejo (actualiza .tab oculto)
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
  document.querySelector(`.tab[data-v="${viewId}"]`)?.classList.add('on');

  // Disparar render de la vista
  _triggerRender(viewId);
}

function _triggerRender(viewId) {
  if(viewId === 'hoy')        { renderHoy(); return; }
  if(viewId === 'dashboard')  { renderDashboard(); return; }
  if(viewId === 'instructores'){ renderInst(); return; }
  if(viewId === 'calendario') { renderCal(); return; }
  if(viewId === 'historial')  { histPagina=0; renderHistorial(); return; }
  if(viewId === 'diagnostico'){ initDiagClases(); return; }
  if(viewId === 'ranking')    { renderRanking(); return; }
  if(viewId === 'recorridos') { renderRecorridos(); return; }
  if(viewId === 'heatmap')    { renderHeatmap(); return; }
  if(viewId === 'alertas')    { renderAlertas(); return; }
  if(viewId === 'salones')    { renderSalones(); return; }
  if(viewId === 'sup-plan')   { renderSupPlan(); return; }
  if(viewId === 'log')        { renderLog(); return; }
  if(viewId === 'comparar')   { renderComparar(); return; }
  if(viewId === 'reporte-dep'){ renderReporteDep(); return; }
  if(viewId === 'eventos'){ evtRenderAll(); return; }
}

// Redirigir funciones existentes que navegan directamente
(function patchNavFns() {
  const _orig_verDiagClase = window.verDiagClase;
  window.verDiagClase = function(clase) {
    navegarA('diagnostico');
    initDiagClases(clase);
    renderDiagnostico();
  };
  const _orig_irAlertas = window.irAlertas;
  window.irAlertas = function() { navegarA('alertas'); };
})();

// Arrancar en "Hoy"
(function initNav() {
  // La vista inicial ya está con class="on" en dashboard desde el HTML
  // Cambiamos al nuevo sistema después de que todo cargue
  setTimeout(() => {
    navegarA('hoy');
  }, 100);
})();

// ═══════════════════════════════════════════════════════
// ═══ COMPARADOR ═══════════════════════════════════════
// ═══════════════════════════════════════════════════════
let _compTipo='periodos', _compClasesSel=[], _compProfesSel=[];

function renderComparar(){
  const hoyS=fechaLocalStr(hoy);
  const mesAnt=new Date(hoy);mesAnt.setDate(1);mesAnt.setMonth(mesAnt.getMonth()-1);
  const mesAntFin=new Date(hoy);mesAntFin.setDate(0);
  const mesActIni=new Date(hoy);mesActIni.setDate(1);
  const set2=(a,b,v1,v2)=>{const ea=document.getElementById(a);if(ea&&!ea.value)ea.value=v1;const eb=document.getElementById(b);if(eb&&!eb.value)eb.value=v2;};
  set2('comp-a-ini','comp-a-fin',fechaLocalStr(mesAnt),fechaLocalStr(mesAntFin));
  set2('comp-b-ini','comp-b-fin',fechaLocalStr(mesActIni),hoyS);
  set2('comp-cl-ini','comp-cl-fin',fechaLocalStr(mesActIni),hoyS);
  set2('comp-pr-ini','comp-pr-fin',fechaLocalStr(mesActIni),hoyS);
  const clases=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))].sort();
  const lC=document.getElementById('comp-clases-lista');
  if(lC&&lC.children.length===0)lC.innerHTML=clases.map(c=>`<span class="comp-tag-sel ${_compClasesSel.includes(c)?'selected':''}" onclick="toggleCompSel('clase','${c}',this)">${c}</span>`).join('');
  const lP=document.getElementById('comp-profes-lista');
  if(lP&&lP.children.length===0)lP.innerHTML=instructores.map(i=>`<span class="comp-tag-sel ${_compProfesSel.includes(i.id)?'selected':''}" onclick="toggleCompSel('profe',${i.id},this)">${i.nombre.split(' ')[0]}</span>`).join('');
  setComparaTipo(_compTipo);
}
function setComparaTipo(tipo){
  _compTipo=tipo;
  ['periodos','clases','profes'].forEach(t=>{
    document.getElementById('comp-btn-'+t)?.classList.toggle('active',t===tipo);
    const p=document.getElementById('comp-panel-'+t);if(p)p.style.display=t===tipo?'block':'none';
  });
  document.getElementById('comp-resultado').innerHTML='';
}
function toggleCompSel(tipo,val,el){
  if(tipo==='clase'){
    const idx=_compClasesSel.indexOf(val);
    if(idx>=0){_compClasesSel.splice(idx,1);el.classList.remove('selected');}
    else if(_compClasesSel.length<4){_compClasesSel.push(val);el.classList.add('selected');}
    else showToast('Máximo 4 clases','warn');
  } else {
    const idx=_compProfesSel.indexOf(val);
    if(idx>=0){_compProfesSel.splice(idx,1);el.classList.remove('selected');}
    else if(_compProfesSel.length<4){_compProfesSel.push(val);el.classList.add('selected');}
    else showToast('Máximo 4 profesores','warn');
  }
}
function ejecutarComparacion(){
  if(_compTipo==='periodos')_compPeriodos();
  else if(_compTipo==='clases')_compClasesComp();
  else _compProfesComp();
}
function _getRegs(ini,fin){return(!ini||!fin)?[]:registros.filter(r=>r.fecha>=ini&&r.fecha<=fin);}
function _periodStats(regs){
  const imp=regs.filter(r=>r.estado==='ok'||r.estado==='sub');
  const aR=imp.filter(r=>parseInt(r.cap||0)>0);
  return{impartidas:imp.length,faltas:regs.filter(r=>r.estado==='falta').length,suplencias:regs.filter(r=>r.estado==='sub').length,
    totalAsis:imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0),
    aforoProm:aR.length>0?Math.round(aR.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/aR.length):0};
}
function _delta(a,b,inv=false){
  if(b===0&&a===0)return'<span class="comp-stat-delta delta-neu">—</span>';
  if(typeof a==='string'||typeof b==='string')return'';
  if(b===0)return'<span class="comp-stat-delta delta-pos">nuevo</span>';
  const p=Math.round((a-b)/b*100);
  const mejor=inv?p<0:p>0;
  const cls=p===0?'delta-neu':mejor?'delta-pos':'delta-neg';
  return`<span class="comp-stat-delta ${cls}">${p>0?'▲':p<0?'▼':'—'}${Math.abs(p)}%</span>`;
}
function _fmtPer(ini,fin){const f=s=>new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});return`${f(ini)} — ${f(fin)}`;}
function _compPeriodos(){
  const[iA,fA,iB,fB]=['comp-a-ini','comp-a-fin','comp-b-ini','comp-b-fin'].map(id=>document.getElementById(id)?.value);
  if(!iA||!fA||!iB||!fB){showToast('Completa las fechas de ambos periodos','err');return;}
  const sA=_periodStats(_getRegs(iA,fA)),sB=_periodStats(_getRegs(iB,fB));
  const rows=[
    {lbl:'Clases Impartidas',a:sA.impartidas,b:sB.impartidas},
    {lbl:'Aforo Promedio',a:sA.aforoProm+'%',b:sB.aforoProm+'%',rA:sA.aforoProm,rB:sB.aforoProm},
    {lbl:'Total Asistentes',a:sA.totalAsis.toLocaleString(),b:sB.totalAsis.toLocaleString(),rA:sA.totalAsis,rB:sB.totalAsis},
    {lbl:'Faltas',a:sA.faltas,b:sB.faltas,inv:true},
    {lbl:'Suplencias',a:sA.suplencias,b:sB.suplencias,inv:true},
  ];
  // Top clases
  const topCls=regs=>{const m={};regs.filter(r=>(r.estado==='ok'||r.estado==='sub')&&parseInt(r.cap||0)>0).forEach(r=>{if(!m[r.clase])m[r.clase]={s:0,n:0};m[r.clase].s+=(parseInt(r.asistentes)||0)/parseInt(r.cap)*100;m[r.clase].n++;});return Object.entries(m).map(([k,v])=>({clase:k,aforo:Math.round(v.s/v.n)})).sort((a,b)=>b.aforo-a.aforo).slice(0,5);};
  const tcA=topCls(_getRegs(iA,fA)),tcB=topCls(_getRegs(iB,fB));
  const todas=[...new Set([...tcA.map(c=>c.clase),...tcB.map(c=>c.clase)])];
  document.getElementById('comp-resultado').innerHTML=`
    <div style="display:flex;gap:.8rem;margin-bottom:1rem;flex-wrap:wrap">
      <div class="comp-card comp-card-a">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--blue);font-weight:700;margin-bottom:.8rem">● A · ${_fmtPer(iA,fA)}</div>
        ${rows.map(r=>`<div class="comp-stat"><div class="comp-stat-lbl">${r.lbl}</div><div class="comp-stat-val" style="color:var(--blue)">${r.a}</div></div>`).join('')}
      </div>
      <div class="comp-card comp-card-b">
        <div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold2);font-weight:700;margin-bottom:.8rem">● B · ${_fmtPer(iB,fB)}</div>
        ${rows.map(r=>`<div class="comp-stat"><div class="comp-stat-lbl">${r.lbl}</div><div class="comp-stat-val" style="color:var(--gold2)">${r.b}${_delta(r.rA!==undefined?r.rA:r.a,r.rB!==undefined?r.rB:r.b,r.inv||false)}</div></div>`).join('')}
      </div>
    </div>
    ${todas.length?`<div class="panel"><div class="phdr"><span class="pttl">Top Clases — Aforo %</span><span style="display:flex;gap:1rem;font-size:.68rem"><span style="color:var(--blue)">━ A</span><span style="color:var(--gold2)">━ B</span></span></div><div class="pbody">
      ${todas.map(c=>{const a=tcA.find(x=>x.clase===c),b=tcB.find(x=>x.clase===c),mx=Math.max(a?.aforo||0,b?.aforo||0,1);
        return`<div style="margin-bottom:.7rem"><div style="font-size:.78rem;font-weight:500;margin-bottom:3px">${c}</div>
          ${a?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:var(--blue);width:${Math.round(a.aforo/mx*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.7rem;color:var(--blue)">${a.aforo}%</span></div>`:'<div style="font-size:.63rem;color:var(--txt3);margin-bottom:2px">A: sin datos</div>'}
          ${b?`<div style="display:flex;align-items:center;gap:6px"><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:var(--gold2);width:${Math.round(b.aforo/mx*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.7rem;color:var(--gold2)">${b.aforo}%</span></div>`:'<div style="font-size:.63rem;color:var(--txt3)">B: sin datos</div>'}
        </div>`;}).join('')}
    </div></div>`:''}`;
}
function _compClasesComp(){
  if(_compClasesSel.length<2){showToast('Selecciona al menos 2 clases','warn');return;}
  const ini=document.getElementById('comp-cl-ini')?.value,fin=document.getElementById('comp-cl-fin')?.value;
  if(!ini||!fin){showToast('Define el periodo','err');return;}
  const regs=_getRegs(ini,fin);
  const COLS=['var(--neon)','var(--blue)','var(--gold2)','var(--red2)'];
  const data=_compClasesSel.map((clase,ci)=>{
    const r=regs.filter(rx=>rx.clase===clase&&(rx.estado==='ok'||rx.estado==='sub'));
    const aR=r.filter(rx=>parseInt(rx.cap||0)>0);
    return{clase,color:COLS[ci],sesiones:r.length,totalAsis:r.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0),
      promAsis:r.length>0?Math.round(r.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0)/r.length):0,
      aforoProm:aR.length>0?Math.round(aR.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0)/parseInt(rx.cap)*100,0)/aR.length):0,
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
        <div style="font-size:.63rem;color:var(--txt3);margin-top:.3rem">${d.insts}</div>
      </div></div>`).join('')}
    </div>
    <div class="panel"><div class="phdr"><span class="pttl">Aforo %</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500">${d.clase}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.aforoProm/mxAfo*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.aforoProm}%</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="phdr"><span class="pttl">Asistentes Promedio</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500">${d.clase}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.promAsis/mxAsi*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.promAsis}</span></div>`).join('')}
    </div></div>`;
}
function _compProfesComp(){
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
    return{nombre:inst.nombre,color:COLS[ci],
      impartidas:imp.length,faltas:r.filter(rx=>rx.estado==='falta').length,suplencias:r.filter(rx=>rx.estado==='sub').length,
      totalAsis:imp.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0),0),
      aforoProm:aR.length>0?Math.round(aR.reduce((a,rx)=>a+(parseInt(rx.asistentes)||0)/parseInt(rx.cap)*100,0)/aR.length):0,
      clases:[...new Set(imp.map(rx=>rx.clase))].join(', ')};
  }).filter(Boolean);
  const mxImp=Math.max(...data.map(d=>d.impartidas),1),mxAfo=Math.max(...data.map(d=>d.aforoProm),1),mxAsi=Math.max(...data.map(d=>d.totalAsis),1);
  document.getElementById('comp-resultado').innerHTML=`
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1rem">
      ${data.map(d=>`<div class="panel" style="flex:1;min-width:150px"><div class="pbody">
        <div style="font-size:.85rem;font-weight:700;color:${d.color};margin-bottom:.7rem">${d.nombre}</div>
        <div class="comp-stat"><div class="comp-stat-lbl">Impartidas</div><div class="comp-stat-val" style="color:${d.color}">${d.impartidas}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Aforo Prom.</div><div class="comp-stat-val" style="color:${d.color}">${d.aforoProm}%</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Total Asist.</div><div class="comp-stat-val" style="color:${d.color}">${d.totalAsis.toLocaleString()}</div></div>
        <div class="comp-stat"><div class="comp-stat-lbl">Faltas · Suplencias</div><div style="font-size:.85rem;font-weight:600;color:${d.faltas>0?'var(--red2)':'var(--neon)'}">${d.faltas} · ${d.suplencias}</div></div>
        <div style="font-size:.63rem;color:var(--txt3);margin-top:.3rem;line-height:1.4">${d.clases}</div>
      </div></div>`).join('')}
    </div>
    <div class="panel"><div class="phdr"><span class="pttl">Clases Impartidas</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.nombre.split(' ')[0]}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.impartidas/mxImp*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:30px;text-align:right">${d.impartidas}</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="phdr"><span class="pttl">Aforo Promedio</span></div><div class="pbody">
      ${data.map(d=>`<div class="comp-bar-wrap"><div style="width:130px;font-size:.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.nombre.split(' ')[0]}</div><div class="comp-bar-track"><div style="height:100%;border-radius:3px;background:${d.color};width:${Math.round(d.aforoProm/mxAfo*100)}%;transition:width .5s"></div></div><span class="mono" style="font-size:.75rem;color:${d.color};min-width:36px;text-align:right">${d.aforoProm}%</span></div>`).join('')}
    </div></div>`;
}

// ═══════════════════════════════════════════════════════
// ═══ MOBILE HOME SCREEN ═══════════════════════════════
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// ═══ CARRUSEL MÓVIL ═══════════════════════════════════
// ═══════════════════════════════════════════════════════
let _mobSlide = 0;
let _mobHeatMetric = 'aforo';

function irSlide(n) {
  _mobSlide = Math.max(0, Math.min(2, n));
  const track = document.getElementById('mob-track');
  if(track) track.style.transform = `translateX(-${_mobSlide * 100}%)`;
  document.querySelectorAll('.mob-dot').forEach((d,i) => d.classList.toggle('on', i===_mobSlide));
  if(_mobSlide === 1) renderMobHeatmap();
  if(_mobSlide === 2) renderMobRanking();
}

// Swipe gesture
(function initSwipe(){
  let sx=0, sy=0, dragging=false, startTime=0;
  const getTouches = e => e.touches ? e.touches[0] : e;
  function onStart(e){
    const t=getTouches(e); sx=t.clientX; sy=t.clientY; dragging=true; startTime=Date.now();
  }
  function onEnd(e){
    if(!dragging) return; dragging=false;
    const t=e.changedTouches?e.changedTouches[0]:e;
    const dx=t.clientX-sx, dy=t.clientY-sy;
    const dt=Date.now()-startTime;
    if(Math.abs(dx)>Math.abs(dy)*1.5 && Math.abs(dx)>40 && dt<400){
      if(dx<0) irSlide(_mobSlide+1);
      else     irSlide(_mobSlide-1);
    }
  }
  const car = document.getElementById('mob-carousel');
  if(!car) return;
  car.addEventListener('touchstart', onStart, {passive:true});
  car.addEventListener('touchend',   onEnd,   {passive:true});
})();

// ── Heatmap móvil ─────────────────────────────────────
function setMobHeatMetric(m){
  _mobHeatMetric=m;
  ['aforo','asis','ses'].forEach(k=>{
    const b=document.getElementById('mob-heat-btn-'+k);
    if(b) b.classList.toggle('active', k===m);
  });
  const lbl={aforo:'Aforo %',asis:'Asistentes',ses:'Sesiones'};
  const el=document.getElementById('mob-heat-lbl');
  if(el) el.textContent=lbl[m]||'';
  renderMobHeatmap();
}

function mobHeatFiltroChange(){
  // Al cambiar instructor: repoblar clases y re-renderizar
  const rawInst=document.getElementById('mob-heat-inst')?.value;
  const instFil=rawInst?parseInt(rawInst):null;
  const clasesSel=document.getElementById('mob-heat-clase');
  if(clasesSel){
    let regsBase=registros.filter(r=>r.estado==='ok'||r.estado==='sub');
    if(instFil) regsBase=regsBase.filter(r=>r.inst_id===instFil);
    const clsOpts=[...new Set(regsBase.map(r=>r.clase))].filter(Boolean).sort();
    clasesSel.innerHTML='<option value="">📋 Todas las clases</option>'+
      clsOpts.map(c=>`<option value="${c}">${c}</option>`).join('');
  }
  renderMobHeatmap();
}

function mobHeatPoblarInstructores(){
  const sel=document.getElementById('mob-heat-inst');
  if(!sel) return;
  const cur=sel.value;
  const idsConDatos=new Set(
    registros.filter(r=>r.estado==='ok'||r.estado==='sub').map(r=>r.inst_id)
  );
  const lista=instructores.filter(i=>idsConDatos.has(i.id)).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  sel.innerHTML='<option value="">👤 Todos</option>'+
    lista.map(i=>`<option value="${i.id}"${i.id===parseInt(cur)?' selected':''}>${i.nombre.split(' ').slice(0,2).join(' ')}</option>`).join('');
}

function renderMobHeatmap(){
  const grid=document.getElementById('mob-heat-grid');
  const topEl=document.getElementById('mob-heat-top');
  const botEl=document.getElementById('mob-heat-bottom');
  if(!grid||!topEl) return;

  const DIAS_SHORT=['Lu','Ma','Mi','Ju','Vi','Sa','Do'];
  const HORAS=['06:00','07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
  const m=_mobHeatMetric;

  // Poblar selector de instructores
  mobHeatPoblarInstructores();

  // Leer filtros
  const rawInst=document.getElementById('mob-heat-inst')?.value;
  const instFil=rawInst?parseInt(rawInst):null;
  const claseFil=document.getElementById('mob-heat-clase')?.value||'';

  // Poblar selector de clases según instructor elegido
  const clasesSel=document.getElementById('mob-heat-clase');
  if(clasesSel){
    const curC=clasesSel.value;
    let regsBase=registros.filter(r=>r.estado==='ok'||r.estado==='sub');
    if(instFil) regsBase=regsBase.filter(r=>r.inst_id===instFil);
    const clsOpts=[...new Set(regsBase.map(r=>r.clase))].filter(Boolean).sort();
    clasesSel.innerHTML='<option value="">Todas las clases</option>'+
      clsOpts.map(c=>`<option value="${c}"${c===curC?' selected':''}>${c}</option>`).join('');
  }

  // Banner filtro activo
  const banner=document.getElementById('mob-heat-banner');
  if(banner){
    const instObj=instFil?instructores.find(i=>i.id===instFil):null;
    if(instFil||claseFil){
      banner.style.display='flex';
      let t='';
      if(instObj) t+=`<span style="background:rgba(94,255,160,.12);color:var(--neon);border-radius:6px;padding:1px 7px;font-size:.65rem">${instObj.nombre.split(' ')[0]}</span>`;
      if(claseFil) t+=`<span style="background:rgba(77,184,232,.12);color:var(--blue);border-radius:6px;padding:1px 7px;font-size:.65rem">${claseFil}</span>`;
      banner.innerHTML=t;
    } else { banner.style.display='none'; banner.innerHTML=''; }
  }

  const mat={};
  HORAS.forEach(h=>{ mat[h]={}; DIAS.forEach(d=>{ mat[h][d]={sum:0,cnt:0,ses:0}; }); });

  registros.filter(r=>{if(r.estado!=="ok"&&r.estado!=="sub")return false;if(instFil&&r.inst_id!==instFil)return false;if(claseFil&&r.clase!==claseFil)return false;return true;}).forEach(r=>{
    const hSlot=HORAS.reduce((best,h)=>Math.abs(horaToMin(r.hora)-horaToMin(h))<Math.abs(horaToMin(r.hora)-horaToMin(best))?h:best,HORAS[0]);
    const capN=parseInt(r.cap||0);
    if(mat[hSlot]&&mat[hSlot][r.dia]!==undefined){
      const asisN=parseInt(r.asistentes)||0;
      mat[hSlot][r.dia].ses++;
      if(m==='aforo'&&capN>0){ mat[hSlot][r.dia].sum+=asisN/capN*100; mat[hSlot][r.dia].cnt++; }
      else if(m==='asis'){ mat[hSlot][r.dia].sum+=asisN; mat[hSlot][r.dia].cnt++; }
      else { mat[hSlot][r.dia].cnt++; }
    }
  });

  let maxV=1, minVWithData=999;
  const allVals=[];
  HORAS.forEach(h=>DIAS.forEach(d=>{
    const c=mat[h][d];
    const v=m==='ses'?c.ses:(c.cnt>0?c.sum/c.cnt:0);
    if(v>maxV)maxV=v;
    if(v>0){ allVals.push({h,d,v:Math.round(v)}); if(v<minVWithData)minVWithData=v; }
  }));

  function cellBg(v){
    if(v===0)return'var(--panel2)';
    const p=v/maxV;
    const dark=temaActual!=='claro';
    // Degradado de verdes oscuro→claro para todas las métricas
    if(dark){
      if(p<.15)return'rgba(26,122,69,.10)';
      if(p<.30)return'rgba(26,122,69,.25)';
      if(p<.50)return'rgba(26,122,69,.45)';
      if(p<.70)return'rgba(26,122,69,.68)';
      if(p<.85)return'rgba(26,122,69,.88)';
      return'#5effa0';
    } else {
      if(p<.15)return'#e8f5ee';
      if(p<.30)return'#c6e8d4';
      if(p<.50)return'#8ecfaa';
      if(p<.70)return'#4dab77';
      if(p<.85)return'#2a8c57';
      return'#1a6b3f';
    }
  }
  function cellTxt(v){
    if(v===0)return'';
    const p=v/maxV;
    const dark=temaActual!=='claro';
    if(dark){
      if(p<.15)return'var(--txt3)';
      if(p<.50)return'rgba(180,255,210,.85)';
      if(p>=.85)return'#071a0f';
      return'#d0ffe8';
    } else {
      if(p<.15)return'var(--txt3)';
      if(p<.30)return'#1a5c35';
      return'#fff';
    }
  }

  // Grid con tap para diagnóstico
  let h='<div class="mob-theat-grid">';
  h+='<div class="mob-theat-hdr"></div>';
  DIAS_SHORT.forEach(d=>h+=`<div class="mob-theat-hdr">${d}</div>`);
  HORAS.forEach(hora=>{
    h+=`<div class="mob-theat-hora">${hora.slice(0,2)}</div>`;
    DIAS.forEach(dia=>{
      const c=mat[hora][dia];
      const v=m==='ses'?c.ses:(c.cnt>0?Math.round(c.sum/c.cnt):0);
      const lbl=v===0?'':m==='aforo'?v+'%':v;
      // Tap abre el mismo modal de diagnóstico que en desktop
      h+=`<div class="mob-theat-cell" style="background:${cellBg(v)};color:${cellTxt(v)};cursor:${v>0?'pointer':'default'}"
        onclick="${v>0?`verDiagHorario('${dia}','${hora}')`:''}"
        title="${dia} ${hora}: ${lbl||'sin datos'}">${lbl}</div>`;
    });
  });
  h+='</div>';
  grid.innerHTML=h;

  // Ranking top 5 con clases involucradas
  const sorted=allVals.sort((a,b)=>b.v-a.v);
  const top5=sorted.slice(0,5);
  const bot5=sorted.filter(x=>x.v>0).reverse().slice(0,4);
  const sfx=m==='aforo'?'%':'';
  const COLS=['var(--neon)','var(--blue)','var(--gold2)','var(--txt2)','var(--txt3)'];

  function clasesEnSlot(dia,hora){
    const res=[];
    instructores.forEach(inst=>{
      (inst.horario||[]).forEach(h=>{
        if(h.dia===dia&&Math.abs(horaToMin(h.hora)-horaToMin(hora))<=30)
          res.push(`<span style="font-size:.58rem;background:rgba(94,255,160,.1);color:var(--neon);border-radius:4px;padding:1px 5px;margin:1px">${h.clase.slice(0,8)}</span>`);
      });
    });
    return res.slice(0,4).join('')+(res.length>4?`<span style="font-size:.58rem;color:var(--txt3)"> +${res.length-4}</span>`:'');
  }

  function horarioRow(t,i,color,isTop){
    const clases=clasesEnSlot(t.d,t.h);
    const sug=isTop?(t.v>=80?'Horario estrella — considera duplicar':'Buen rendimiento')
                   :(t.v<30?'Aforo crítico — evaluar cambio':'Aforo bajo — revisar');
    const sugColor=isTop?'var(--neon)':'var(--red2)';
    return`<div style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:9px 11px;cursor:pointer" onclick="verDiagHorario('${t.d}','${t.h}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${color}">${i+1}</span>
          <span style="font-size:.82rem;font-weight:600">${t.d} ${t.h}</span>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:.85rem;font-weight:700;color:${color}">${t.v}${sfx}</span>
      </div>
      <div style="margin-bottom:3px">${clases}</div>
      <div style="font-size:.62rem;color:${sugColor}">→ ${sug}</div>
    </div>`;
  }

  topEl.innerHTML=top5.map((t,i)=>horarioRow(t,i,COLS[i]||'var(--txt2)',true)).join('');
  if(botEl) botEl.innerHTML=bot5.map((t,i)=>horarioRow(t,i,'var(--red2)',false)).join('');
}

// ── Ranking de clases móvil ────────────────────────────
function renderMobRanking(){
  const lista=document.getElementById('mob-rank-lista');
  const podioEl=document.getElementById('mob-rank-podio');
  const metricSel=document.getElementById('mob-rank-metric');
  if(!lista) return;
  const m=metricSel?metricSel.value:'aforo';

  const claseMap={};
  registros.filter(r=>r.estado==='ok'||r.estado==='sub').forEach(r=>{
    const capN=parseInt(r.cap||0);
    const asisN=parseInt(r.asistentes)||0;
    if(!claseMap[r.clase])claseMap[r.clase]={sumAfo:0,cntAfo:0,sumAsis:0,cntAsis:0,total:0,sesiones:0,insts:new Set(),dias:new Set()};
    claseMap[r.clase].total+=asisN;
    claseMap[r.clase].cntAsis++;
    claseMap[r.clase].sumAsis+=asisN;
    claseMap[r.clase].sesiones++;
    if(r.inst_id)claseMap[r.clase].insts.add(r.inst_id);
    if(r.dia)claseMap[r.clase].dias.add(r.dia);
    if(capN>0){claseMap[r.clase].sumAfo+=asisN/capN*100;claseMap[r.clase].cntAfo++;}
  });

  let data=Object.entries(claseMap).map(([k,v])=>({
    clase:k,
    aforo:v.cntAfo>0?Math.round(v.sumAfo/v.cntAfo):0,
    asis:v.cntAsis>0?Math.round(v.sumAsis/v.cntAsis):0,
    total:v.total,
    sesiones:v.sesiones,
    instNombres:[...v.insts].map(id=>instructores.find(i=>i.id===id)?.nombre.split(' ')[0]||'?'),
    dias:[...v.dias]
  }));

  if(m==='aforo')data.sort((a,b)=>b.aforo-a.aforo);
  else if(m==='asis')data.sort((a,b)=>b.asis-a.asis);
  else data.sort((a,b)=>b.total-a.total);

  if(data.length===0){
    if(podioEl)podioEl.innerHTML='';
    lista.innerHTML='<div class="empty" style="font-size:.78rem">Sin registros aún.</div>';
    return;
  }

  // ── Podio mini (top 3) ───────────────────────────────
  const top3=data.slice(0,3);
  const podioOrder=[1,0,2]; // visual: 2do izq, 1ro centro, 3ro der
  const podioColors=['#1a9e5a','#2980b9','#e05050']; // [0]=1ro verde, [1]=2do azul, [2]=3ro rojo
  const podioMedals=['🥇','🥈','🥉'];
  const podioH=['90px','64px','50px']; // 1ro más alto
  if(podioEl){
    podioEl.innerHTML=`<div style="display:flex;align-items:flex-end;justify-content:center;gap:8px;padding:4px 0 8px">
      ${podioOrder.filter(pi=>top3[pi]).map(pi=>{
        const d=top3[pi];
        const val=m==='aforo'?d.aforo+'%':m==='asis'?d.asis:d.total.toLocaleString();
        const instNm=d.instNombres.slice(0,2).join(', ');
        return`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;max-width:110px">
          <div style="font-size:1.2rem">${podioMedals[pi]}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:.88rem;color:${podioColors[pi]};text-align:center;letter-spacing:.5px;line-height:1.1">${d.clase}</div>
          <div style="font-size:.58rem;color:var(--txt3);text-align:center">${instNm}</div>
          <div style="width:100%;background:var(--panel2);border-radius:6px 6px 0 0;height:${podioH[pi]};
               display:flex;flex-direction:column;align-items:center;justify-content:center;
               border:1px solid ${podioColors[pi]};border-bottom:none;background:${podioColors[pi]}18">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:${podioColors[pi]}">${val}</div>
            <div style="font-size:.55rem;color:var(--txt3)">${d.sesiones} ses.</div>
          </div>
          <div style="width:100%;height:3px;background:${podioColors[pi]};border-radius:0 0 3px 3px"></div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const maxV=m==='aforo'?data[0].aforo:m==='asis'?data[0].asis:data[0].total;

  // ── Lista con sugerencia inline — TODAS las clases (sin límite) ──────
  lista.innerHTML=data.map((d,i)=>{
    const val=m==='aforo'?d.aforo+'%':m==='asis'?d.asis:d.total.toLocaleString();
    const raw=m==='aforo'?d.aforo:m==='asis'?d.asis:d.total;
    const pct=maxV>0?Math.round(raw/maxV*100):0;
    // Top 3: 1ro verde, 2do azul, 3ro rojo. Resto: semáforo por aforo
    const TOP3_COLS=['#1a9e5a','#2980b9','#e05050'];
    const color=i===0?TOP3_COLS[0]:i===1?TOP3_COLS[1]:i===2?TOP3_COLS[2]
      :d.aforo<30?'var(--red2)':d.aforo<55?'var(--gold2)':'var(--txt2)';
    const barColor=i===0?TOP3_COLS[0]:i===1?TOP3_COLS[1]:i===2?TOP3_COLS[2]
      :d.aforo<30?'var(--red2)':d.aforo<55?'var(--gold2)':d.aforo>=75?'var(--neon)':'var(--txt2)';
    const medal=i<3?['🥇','🥈','🥉'][i]:'';

    // Sugerencia breve
    let sug='', sugColor='var(--txt3)';
    if(d.aforo>=80){sug='Estrella — considera duplicar grupo';sugColor='var(--neon)';}
    else if(d.aforo>=65){sug='Buen rendimiento — mantener';sugColor='var(--txt2)';}
    else if(d.aforo>=40){sug='Potencial — reforzar promoción o instructor';sugColor='var(--gold2)';}
    else if(d.aforo<30&&d.sesiones>=3){sug='Crítica — evaluar cambio de horario';sugColor='var(--red2)';}

    const instChip=d.instNombres.slice(0,2).map(n=>`<span style="font-size:.58rem;color:var(--txt3);background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:0 4px">${n}</span>`).join(' ');

    return`<div class="mob-rank-item" style="border-left:3px solid ${barColor};margin-bottom:5px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:.85rem;min-width:18px">${medal||''}</span>
        <span style="font-size:.7rem;color:var(--txt3);min-width:16px">${medal?'':i+1}</span>
        <span class="mob-rank-nombre" style="flex:1;color:${i<3?barColor:'inherit'}">${d.clase}</span>
        <span class="mob-rank-val" style="color:${color}">${val}</span>
      </div>
      <div class="mob-rank-bar-bg">
        <div class="mob-rank-bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:3px;margin-top:5px">
        <div style="display:flex;gap:4px">${instChip}</div>
        <div style="font-size:.6rem;color:var(--txt3)">${d.sesiones} ses · ${d.dias.slice(0,2).map(d=>d.slice(0,3)).join(', ')}</div>
      </div>
      ${sug?`<div style="font-size:.62rem;color:${sugColor};margin-top:4px;padding-top:4px;border-top:1px solid var(--border)">→ ${sug}</div>`:''}
    </div>`;
  }).join('');
}


// ── Render de la home móvil ──────────────────────────
function renderMobileHome() {
  // No ejecutar si hay sesión de instructor activa
  if(typeof rolActual !== 'undefined' && rolActual === 'instructor') return;
  const hoyStr  = fechaLocalStr(vistaFecha);
  const diaHoy  = DIAS[(vistaFecha.getDay()+6)%7];
  const esHoyReal = hoyStr === fechaLocalStr(hoy);

  // Sync date pickers
  const dp = document.getElementById('hoy-date-picker');
  if(dp && dp.value !== hoyStr) dp.value = hoyStr;
  const dpM = document.getElementById('mob-date-picker');
  if(dpM && dpM.value !== hoyStr) dpM.value = hoyStr;
  const btnHoy = document.getElementById('hoy-btn-hoy');
  if(btnHoy) btnHoy.style.opacity = esHoyReal ? '0.35' : '1';
  const btnHoyMob = document.getElementById('mob-btn-hoy');
  if(btnHoyMob) btnHoyMob.style.opacity = esHoyReal ? '0.35' : '1';

  // KPIs
  const clasesHoy = [];
  instructores.forEach(inst => {
    (inst.horario||[]).forEach(slot => {
      if(slot.dia !== diaHoy) return;
      const reg = registros.filter(r =>
        String(r.inst_id)===String(inst.id) && r.fecha===hoyStr && r.dia===slot.dia && r.hora===slot.hora
      ).pop() || null;
      clasesHoy.push({ inst, slot, reg });
    });
  });
  clasesHoy.sort((a,b) => a.slot.hora.localeCompare(b.slot.hora));

  const total      = clasesHoy.length;
  const registradas = clasesHoy.filter(c=>c.reg).length;
  const pendientes  = total - registradas;
  const regsHoy    = clasesHoy.filter(c=>c.reg&&(c.reg.estado==='ok'||c.reg.estado==='sub'));
  const afoRegs    = regsHoy.filter(c=>parseInt(c.reg.cap||0)>0);
  const aforoProm  = afoRegs.length>0 ? Math.round(afoRegs.reduce((a,c)=>a+(parseInt(c.reg.asistentes)||0)/parseInt(c.reg.cap)*100,0)/afoRegs.length) : 0;

  const el = id => document.getElementById(id);
  if(el('mob-k-reg'))   el('mob-k-reg').textContent   = registradas;
  if(el('mob-k-pend'))  el('mob-k-pend').textContent  = pendientes;
  if(el('mob-k-aforo')) el('mob-k-aforo').textContent = aforoProm ? aforoProm+'%' : '—';

  // Métricas premium
  const afoBar2 = el('mob-aforo-bar');
  if(afoBar2) afoBar2.style.width = Math.min(aforoProm, 100) + '%';

  // ── Métricas premium ──
  // Barra de aforo
  const afoBar = el('mob-aforo-bar');
  if(afoBar) afoBar.style.width = Math.min(aforoProm, 100) + '%';

  // Sparkline: aforo promedio por franja horaria del día
  // Cada barra = 1 franja horaria con clases; color = % aforo promedio
  const sparkEl = el('mob-sparkline-reg');
  if(sparkEl) {
    const franjas = [];
    for(let h=6;h<=21;h++) franjas.push(h);

    const regsAforo = clasesHoy.filter(c =>
      c.reg && (c.reg.estado==='ok'||c.reg.estado==='sub') && parseInt(c.reg.cap||0)>0
    );

    const segmentos = franjas.map(h => {
      const enFranja = regsAforo.filter(c => {
        const hn = parseInt((c.reg.hora||c.slot.hora||'00:00').split(':')[0]);
        return hn === h;
      });
      if(!enFranja.length) return {h, afo:null};
      const prom = enFranja.reduce((s,c)=>s+Math.round((parseInt(c.reg.asistentes)||0)/parseInt(c.reg.cap)*100),0)/enFranja.length;
      return {h, afo:Math.round(prom)};
    });

    const conClase = franjas.map(h =>
      clasesHoy.some(c => parseInt((c.slot.hora||'00:00').split(':')[0])===h)
    );

    sparkEl.innerHTML = segmentos.map((s,i) => {
      if(!conClase[i]) return '';
      const afo = s.afo;
      const alt = afo!==null ? Math.max(20, afo) : 8;
      const col = afo===null ? 'rgba(26,122,69,.15)'
                : afo>=70   ? '#1a7a45'
                : afo>=40   ? '#c8960a'
                :              '#c0392b';
      const glow = afo!==null&&afo>=70 ? `box-shadow:0 0 5px ${col}66;` : '';
      return `<div class="mob-sparkline-bar" title="${s.h}:00 · ${afo!==null?afo+'%':'sin reg'}" style="height:${alt}%;background:${col};${glow}"></div>`;
    }).filter(Boolean).join('');
  }

  // Dots de pendientes — siempre 10, color cambia según cuántos faltan
  const dotsEl = el('mob-dots-pend');
  if(dotsEl) {
    const maxDots = 10;
    const filled  = Math.min(pendientes, maxDots);
    // Color según urgencia: verde(1-3) → amarillo(4-6) → naranja(7-8) → rojo(9-10)
    // Colores tema claro — alto contraste bajo el sol
    const dotColor = filled <= 3 ? '#2da05a'
                   : filled <= 6 ? '#e08c00'
                   : filled <= 8 ? '#d45000'
                   :               '#c0392b';
    const DS='width:8px;height:8px;min-width:8px;max-width:8px;min-height:8px;max-height:8px;border-radius:50%;flex:0 0 8px;flex-grow:0;flex-shrink:0;display:block';
    dotsEl.innerHTML = Array.from({length: maxDots}, (_, i) =>
      i < filled
        ? `<div class="mob-dot-item" style="${DS};background:${dotColor};box-shadow:0 0 4px ${dotColor}88"></div>`
        : `<div class="mob-dot-item empty" style="${DS};background:rgba(26,122,69,.15)"></div>`
    ).join('');
  }

  // Pendientes badge en tab
  const badge = el('mob-agenda-badge');
  const agendaPend = agendaNotas.filter(n=>!n.resuelta).length;
  const agendaAlta = agendaNotas.filter(n=>!n.resuelta&&n.prioridad==='alta').length;
  if(badge){ badge.style.display=agendaPend>0?'block':'none'; badge.textContent=agendaAlta>0?'!'+agendaAlta:agendaPend; badge.style.background=agendaAlta>0?'var(--red2)':'var(--gold)'; }
  const snavBadge = el('snav-hoy-badge');
  const bnavDot   = el('bnav-hoy-dot');
  if(snavBadge){ snavBadge.style.display=pendientes>0?'inline':'none'; snavBadge.textContent=pendientes; }
  if(bnavDot)  { bnavDot.classList.toggle('on', pendientes>0); }

  const lbl = el('mob-lista-lbl');
  if(lbl) {
    if(!esHoyReal) {
      lbl.textContent = `${diaHoy} ${hoyStr}`;
      lbl.classList.remove('pildora');
    } else if(pendientes > 0) {
      lbl.textContent = `⚠ ${pendientes} PENDIENTE${pendientes>1?'S':''} HOY`;
      lbl.classList.add('pildora');
    } else {
      lbl.textContent = '✔ TODO REGISTRADO HOY';
      lbl.classList.add('pildora');
      lbl.style.borderColor = 'rgba(94,255,160,.3)';
      lbl.style.color = '#5effa0';
      lbl.style.background = 'rgba(94,255,160,.08)';
    }
  }

  if(!el('mob-clases-lista')) return;
  if(total===0){ el('mob-clases-lista').innerHTML='<div class="empty" style="font-size:.78rem">No hay clases programadas hoy.</div>'; return; }

  // Actualizar gauge circles dinámicamente
  const circ = 2 * Math.PI * 20; // r=20 → ~125.7
  function setArc(id, pct) {
    const arc = document.getElementById(id);
    if(arc) arc.setAttribute('stroke-dashoffset', circ * (1 - Math.max(0, Math.min(pct, 1))));
  }
  // reg: % de clases registradas vs total del día
  const regN  = parseInt(el('mob-k-reg')?.textContent) || 0;
  const pendN = parseInt(el('mob-k-pend')?.textContent) || 0;
  const afoStr = el('mob-k-aforo')?.textContent || '0';
  const afoN  = parseInt(afoStr) || 0;
  const totalDia = regN + pendN;
  setArc('mob-kpi-arc-reg',   totalDia > 0 ? regN / totalDia : 0);
  setArc('mob-kpi-arc-pend',  totalDia > 0 ? pendN / totalDia : 0);
  setArc('mob-kpi-arc-aforo', afoN / 100);

  el('mob-clases-lista').innerHTML = clasesHoy.map(({inst,slot,reg}) => {
    const est     = reg ? reg.estado : 'pendiente';
    const asis    = reg ? (parseInt(reg.asistentes)||0) : '—';
    const capN    = (reg && parseInt(reg.cap)>0) ? parseInt(reg.cap) : getCapClase(slot.clase);
    const afoP    = reg && capN>0 ? Math.round((parseInt(reg.asistentes)||0)/capN*100) : null;
    const colorAf = afoP!==null ? pctCol(afoP) : 'var(--txt3)';
    const cls     = est==='pendiente' ? 'pendiente' : 'registrada';
    const barW    = afoP!==null ? Math.min(afoP,100) : 0;
    const estadoTag = {
      ok:    `<span class="chip cok" style="font-size:.58rem;padding:3px 8px">✓ Ok</span>`,
      sub:   `<span class="chip cpl" style="font-size:.58rem;padding:3px 8px">Sub</span>`,
      falta: `<span class="chip cbd" style="font-size:.58rem;padding:3px 8px">⚠ Falta</span>`,
      pendiente: `<span class="chip cwn" style="font-size:.58rem;padding:3px 8px">Pendiente</span>`
    }[est] || '';
    return `<div class="mob-clase-item ${cls}" onclick="abrirRegistroDesdeCalendario(${inst.id},'${slot.dia}','${slot.hora}','${slot.clase}','${hoyStr}')">
      <div class="mob-ci-top">
        <span class="mob-c-hora">${slot.hora}</span>
        <div class="mob-c-info">
          <div class="mob-c-nombre">${slot.clase}</div>
          <span class="mob-c-inst">${inst.nombre.split(' ').slice(0,2).join(' ')}</span>
        </div>
        <div class="mob-ci-right">
          <div class="mob-ci-right-top">
            ${estadoTag}
            <span class="mob-c-asis" style="color:${colorAf}">${afoP!==null ? afoP+'%' : asis}</span>
          </div>
          ${afoP!==null ? `<div class="mob-ci-bar-right"><div class="mob-ci-bar-fill" style="width:${barW}%;background:${colorAf}"></div></div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── BÚSQUEDA MÓVIL ──────────────────────────────────
const _busquedasRecientes = JSON.parse(localStorage.getItem('fc_busq_rec')||'[]');

function abrirBuscadorMob() {
  document.getElementById('mob-search-overlay').classList.add('on');
  _filtroRapidoActivo = '';
  document.querySelectorAll('.srch-fil').forEach(b=>b.classList.remove('on'));
  const todo=document.querySelector('.srch-fil[data-f=""]');
  if(todo) todo.classList.add('on');
  setTimeout(()=>{ const i=document.getElementById('mob-search-input2'); if(i)i.focus(); }, 80);
  _renderBuscadorDefault();
}
function cerrarBuscadorMob() {
  document.getElementById('mob-search-overlay').classList.remove('on');
  _filtroRapidoActivo = '';
  const i1=document.getElementById('mob-search-input');
  const i2=document.getElementById('mob-search-input2');
  if(i1)i1.value=''; if(i2)i2.value='';
  const btn=document.getElementById('mob-search-clear');
  if(btn) btn.style.display='none';
  // Solo restaurar mobile-home si la sección activa es 'hoy'
  if(window.innerWidth <= 640 && _activeSection === 'hoy') {
    const mh = document.getElementById('mobile-home');
    if(mh) { mh.classList.add('on'); mh.scrollTop = 0; }
    const track = document.getElementById('mob-track');
    if(track) { track.style.transition='none'; track.style.transform='translateX(0)'; }
    document.querySelectorAll('.mob-dot').forEach((d,i)=>d.classList.toggle('on',i===0));
    try{ _mobSlide=0; }catch(e){}
  }
}
function ejecutarBuscadorMob(){ if(window.innerWidth<=640) abrirBuscadorMob(); }
function ejecutarBuscadorMob2(q){ _procesarBusqueda(q.trim()); }

const BUSQ_FRECUENTES = ['pilates vs yoga','RPM aforo','faltas este mes','top clases','mejores horarios','clases a modificar','asistencias este mes','aforo semana','body pump','instructores con faltas'];

let _filtroRapidoActivo = '';

function _limpiarBusqueda(){
  const i=document.getElementById('mob-search-input2');
  if(i){i.value='';i.focus();}
  const btn=document.getElementById('mob-search-clear');
  if(btn) btn.style.display='none';
  _procesarBusqueda('');
}

function _setFiltroRapido(btn, tipo){
  document.querySelectorAll('.srch-fil').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _filtroRapidoActivo = tipo;
  const inp = document.getElementById('mob-search-input2');
  const q = inp ? inp.value.trim() : '';
  _procesarBusqueda(q || tipo);
}

function _renderBuscadorDefault() {
  const area = document.getElementById('mob-search-result-area');
  if(!area) return;
  let html = '';

  // ── Resumen rápido de hoy ────────────────────────────
  const hoyS = fechaLocalStr(hoy);
  const diaH = DIAS[(hoy.getDay()+6)%7];
  const regsH = registros.filter(r=>r.fecha===hoyS);
  const impH = regsH.filter(r=>r.estado==='ok'||r.estado==='sub');
  const pendH = instructores.flatMap(i=>(i.horario||[]).filter(s=>s.dia===diaH)).length - impH.length;
  const afoH = (() => { const a=impH.filter(r=>parseInt(r.cap||0)>0); return a.length>0?Math.round(a.reduce((s,r)=>s+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/a.length):0; })();
  html += `<div class="srch-section-lbl">Hoy — ${diaH}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:2px">
    <div onclick="cerrarBuscadorMob();navegarA('hoy')" style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:9px 6px;text-align:center;cursor:pointer">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--neon)">${impH.length}</div>
      <div style="font-size:.57rem;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px">Registradas</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:9px 6px;text-align:center">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:${pendH>0?'var(--red2)':'var(--neon)'}">${pendH}</div>
      <div style="font-size:.57rem;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px">Pendientes</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:9px 6px;text-align:center">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:${pctCol(afoH)}">${afoH}%</div>
      <div style="font-size:.57rem;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px">Aforo</div>
    </div>
  </div>`;

  // ── Instructores ────────────────────────────────────
  if(instructores.length > 0){
    html += `<div class="srch-section-lbl" style="margin-top:4px">Instructores</div>`;
    html += instructores.slice(0,4).map(inst=>{
      const n=registros.filter(r=>String(r.inst_id)===String(inst.id)&&r.estado==='falta').length;
      const cls=(inst.horario||[]).length;
      return `<div class="srch-item" onclick="_busquedaInstructor('${inst.nombre}',${inst.id})">
        <div class="srch-item-icon" style="background:rgba(94,255,160,.1);border:1px solid rgba(94,255,160,.2)">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--neon)" stroke-width="1.5"><circle cx="10" cy="6" r="3"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
        </div>
        <div class="srch-item-body">
          <div class="srch-item-title">${inst.nombre}</div>
          <div class="srch-item-sub">${cls} clase${cls!==1?'s':''}/sem · ${inst.tipo==='planta'?'Planta':'Honor.'}${n>0?` · <span style="color:var(--red2)">${n} falta${n!==1?'s':''}</span>`:''}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="var(--txt3)" stroke-width="1.5"><polyline points="7,4 13,10 7,16" stroke-linecap="round"/></svg>
      </div>`;
    }).join('');
    if(instructores.length>4) html+=`<div style="font-size:.7rem;color:var(--txt3);text-align:center;padding:4px 0;cursor:pointer" onclick="ejecutarBuscadorMob2('instructores')">Ver todos (${instructores.length}) →</div>`;
  }

  // ── Recientes ───────────────────────────────────────
  if(_busquedasRecientes.length>0){
    html += `<div class="srch-section-lbl" style="margin-top:4px">Recientes</div>`;
    html += _busquedasRecientes.slice(0,5).map(q=>
      `<div class="mob-recent-item" onclick="ejecutarBuscadorMob2('${q}');document.getElementById('mob-search-input2').value='${q}'">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="var(--txt3)" stroke-width="1.4"><circle cx="10" cy="10" r="7"/><polyline points="10,6 10,10 13,12"/></svg>
        ${q}
        <button onclick="event.stopPropagation();_eliminarReciente('${q}')" style="background:none;border:none;color:var(--txt3);cursor:pointer;margin-left:auto;padding:0 4px;font-size:.9rem">✕</button>
      </div>`).join('');
  }

  html += `<div class="srch-section-lbl" style="margin-top:4px">Búsquedas frecuentes</div>`;
  html += `<div class="mob-chip-row">${BUSQ_FRECUENTES.map(q=>`<span class="mob-chip" onclick="ejecutarBuscadorMob2('${q}');document.getElementById('mob-search-input2').value='${q}'">${q}</span>`).join('')}</div>`;
  area.innerHTML = html;
}

function _eliminarReciente(q){
  _busquedasRecientes=_busquedasRecientes.filter(x=>x!==q);
  try{localStorage.setItem('fc_busq_rec',JSON.stringify(_busquedasRecientes));}catch(e){}
  _renderBuscadorDefault();
}

function _busquedaInstructor(nombre, id) {
  const inp = document.getElementById('mob-search-input2');
  if(inp) inp.value = nombre;
  _procesarBusqueda(nombre);
}

const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function _detectarPeriodo(qLow) {
  const hoyS=fechaLocalStr(hoy);
  const esHoy=qLow.includes('hoy')||_filtroRapidoActivo==='hoy';
  const esAyer=qLow.includes('ayer');
  const esSemana=qLow.includes('semana')||_filtroRapidoActivo==='semana';
  const esMesAnt=qLow.includes('anterior')||qLow.includes('pasado');
  const es3Meses=qLow.includes('3 mes')||qLow.includes('tres mes')||qLow.includes('trimestre');
  const esAnio=qLow.includes('año')||qLow.includes('anio')||qLow.includes('total');
  const mesNombre=MESES.find(m=>qLow.includes(m));
  const esMes=_filtroRapidoActivo==='mes';
  let ini,fin,periodoLbl;
  if(esHoy){ini=fin=hoyS;periodoLbl='hoy';}
  else if(esAyer){const ay=new Date(hoy);ay.setDate(ay.getDate()-1);ini=fin=fechaLocalStr(ay);periodoLbl='ayer';}
  else if(esSemana){const l=getLunes(0);ini=fechaLocalStr(l);const d2=new Date(l);d2.setDate(l.getDate()+6);fin=fechaLocalStr(d2);periodoLbl='esta semana';}
  else if(esMesAnt){const m=new Date(hoy);m.setDate(1);m.setMonth(m.getMonth()-1);const mf=new Date(hoy);mf.setDate(0);ini=fechaLocalStr(m);fin=fechaLocalStr(mf);periodoLbl='mes anterior';}
  else if(es3Meses){const m=new Date(hoy);m.setMonth(m.getMonth()-3);ini=fechaLocalStr(m);fin=hoyS;periodoLbl='últimos 3 meses';}
  else if(esAnio){ini=`${hoy.getFullYear()}-01-01`;fin=hoyS;periodoLbl='este año';}
  else if(mesNombre){const mi=MESES.indexOf(mesNombre);const yr=hoy.getFullYear()-(mi>hoy.getMonth()?1:0);ini=`${yr}-${String(mi+1).padStart(2,'0')}-01`;const mf=new Date(yr,mi+1,0);fin=fechaLocalStr(mf);periodoLbl=mesNombre;}
  else{const m=new Date(hoy);m.setDate(1);ini=fechaLocalStr(m);fin=hoyS;periodoLbl='este mes';}
  return {ini,fin,periodoLbl};
}

function _procesarBusqueda(q) {
  const btn=document.getElementById('mob-search-clear');
  if(btn) btn.style.display=q?'block':'none';
  if(!q && !_filtroRapidoActivo){ _renderBuscadorDefault(); return; }

  const idx=q?_busquedasRecientes.indexOf(q):-1;
  if(idx>=0)_busquedasRecientes.splice(idx,1);
  if(q){_busquedasRecientes.unshift(q);if(_busquedasRecientes.length>12)_busquedasRecientes.pop();try{localStorage.setItem('fc_busq_rec',JSON.stringify(_busquedasRecientes));}catch(e){}}

  const qLow=(q||'').toLowerCase();
  const area=document.getElementById('mob-search-result-area');
  if(!area) return;

  // ── Fuzzy match ───────────────────────────────────────
  function fuzzy(hay,needle){ return hay.toLowerCase().includes(needle); }
  function score(hay,needle){ if(hay.toLowerCase()===needle)return 3;if(hay.toLowerCase().startsWith(needle))return 2;if(hay.toLowerCase().includes(needle))return 1;return 0; }

  // ── Detectar VS ────────────────────────────────────────
  const vsMatch = q.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if(vsMatch){ _busquedaVs(vsMatch[1].trim(), vsMatch[2].trim(), area); return; }

  // ── Detectar entidades ─────────────────────────────────
  const todasClases=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))];

  // Buscar clases que coincidan con el query
  const clasesMatch = todasClases.filter(c=>score(c,qLow)>0).sort((a,b)=>score(b,qLow)-score(a,qLow));
  const claseEncontrada = clasesMatch[0] || null;

  // Buscar instructores
  const instsMatch = instructores.filter(i=>
    score(i.nombre,qLow)>0 ||
    i.nombre.toLowerCase().split(' ').some(p=>p.length>2&&qLow.includes(p.slice(0,4)))
  ).sort((a,b)=>score(b.nombre,qLow)-score(a.nombre,qLow));
  const instEncontrado = instsMatch[0] || null;

  const diaEncontrado = DIAS.find(d=>qLow.includes(d.toLowerCase().slice(0,4)));
  const horaMatch = qLow.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm|hrs?)?\b/i);
  const horaEncontrada = horaMatch ? null : null; // parsear si hace falta

  // ── Detectar intención ────────────────────────────────
  const filtro = _filtroRapidoActivo;
  const esFiltroFaltas   = filtro==='falta'    || qLow.includes('falta');
  const esFiltroSup      = filtro==='suplencia'|| qLow.includes('suplenc')||qLow.includes('suplente');
  const esFiltroClase    = filtro==='clase';
  const esFiltroInst     = filtro==='instructor';
  const esTop            = qLow.includes('top')||qLow.includes('mejor')||qLow.includes('ranking');
  const esModificar      = qLow.includes('modific')||qLow.includes('cambiar')||qLow.includes('ajustar')||qLow.includes('mover');
  const esReporte        = qLow.includes('reporte')||qLow.includes('imprimir')||qLow.includes('exportar');
  const esAforo          = qLow.includes('aforo')||qLow.includes('capacidad')||qLow.includes('ocupacion');
  const esAsistencias    = qLow.includes('asistenci')||qLow.includes('socios')||qLow.includes('personas');
  const esInstructores   = esFiltroInst||qLow==='instructores'||qLow.includes('todos los instructor');

  const {ini,fin,periodoLbl} = _detectarPeriodo(qLow);

  // ── Enrutar búsquedas especiales ────────────────────────
  if(esModificar){ _busquedaModificar(area,ini,fin,periodoLbl); return; }
  if(esReporte){   _busquedaReporte(area,ini,fin,periodoLbl,claseEncontrada,instEncontrado,diaEncontrado); return; }

  // ── Búsqueda de instructores ──────────────────────────
  if(esInstructores || (esFiltroInst && !q)){
    _renderInstructoresList(area, '', ini, fin, periodoLbl);
    return;
  }
  if(instsMatch.length > 0 && !claseEncontrada && !esAforo && !esAsistencias && !esFiltroFaltas && !esFiltroSup && q && score(instsMatch[0].nombre, qLow) >= 1){
    _renderInstructoresList(area, q, ini, fin, periodoLbl);
    return;
  }

  // ── Búsqueda de faltas ────────────────────────────────
  if(esFiltroFaltas){ _renderFaltas(area, ini, fin, periodoLbl, instEncontrado, claseEncontrada); return; }

  // ── Búsqueda de suplencias ────────────────────────────
  if(esFiltroSup){ _renderSuplencias(area, ini, fin, periodoLbl, instEncontrado, claseEncontrada); return; }

  // ── Búsqueda de clases específicas ───────────────────
  if((esFiltroClase || clasesMatch.length > 0) && !esAforo && !esAsistencias){
    _renderClasesList(area, q, clasesMatch, ini, fin, periodoLbl);
    return;
  }

  // ── Respuesta analítica general ──────────────────────
  _renderAnalisis(area, q, qLow, claseEncontrada, instEncontrado, diaEncontrado, ini, fin, periodoLbl, esAforo, esAsistencias, esFiltroFaltas, esFiltroSup);
}

// ── Renderizar lista de instructores ─────────────────────────────
function _renderInstructoresList(area, q, ini, fin, periodoLbl){
  const lista = q ? instructores.filter(i=>i.nombre.toLowerCase().includes(q.toLowerCase())) : instructores;
  if(lista.length===0){ area.innerHTML=`<div class="mob-search-result"><div class="mob-result-sub">No se encontró instructor con "${q}"</div></div>`; return; }

  let html = `<div class="srch-section-lbl">${lista.length} instructor${lista.length!==1?'es':''} · ${periodoLbl}</div>`;
  html += lista.map(inst=>{
    const regsI = registros.filter(r=>String(r.inst_id)===String(inst.id)&&r.fecha>=ini&&r.fecha<=fin);
    const imp   = regsI.filter(r=>r.estado==='ok'||r.estado==='sub');
    const faltas = regsI.filter(r=>r.estado==='falta').length;
    const sups   = regsI.filter(r=>r.estado==='sub').length;
    const afoR   = imp.filter(r=>parseInt(r.cap||0)>0);
    const afoP   = afoR.length>0?Math.round(afoR.reduce((s,r)=>s+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoR.length):0;
    const totAsis= imp.reduce((s,r)=>s+(parseInt(r.asistentes)||0),0);
    const clases = (inst.horario||[]).length;
    return `<div class="srch-item" onclick="cerrarBuscadorMob();navegarA('instructores')">
      <div class="srch-item-icon" style="background:rgba(94,255,160,.1);border:1px solid rgba(94,255,160,.2)">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--neon)" stroke-width="1.5"><circle cx="10" cy="6" r="3"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
      </div>
      <div class="srch-item-body">
        <div class="srch-item-title">${inst.nombre}</div>
        <div class="srch-item-sub">${clases} clases/sem · ${imp.length} sesiones · ${totAsis.toLocaleString()} asis.${faltas>0?` · <span style="color:var(--red2)">${faltas} falta${faltas!==1?'s':''}</span>`:''}${sups>0?` · ${sups} sup.`:''}</div>
      </div>
      <div class="srch-item-val" style="color:${pctCol(afoP)}">${afoR.length?afoP+'%':'—'}</div>
    </div>`;
  }).join('');
  area.innerHTML=html;
}

// ── Renderizar lista de clases ────────────────────────────────────
function _renderClasesList(area, q, clasesMatch, ini, fin, periodoLbl){
  const todasClases=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))];
  const lista = clasesMatch.length>0 ? clasesMatch : (q ? todasClases.filter(c=>c.toLowerCase().includes(q.toLowerCase())) : todasClases);
  if(lista.length===0){ area.innerHTML=`<div class="mob-search-result"><div class="mob-result-sub">No se encontró clase con "${q}"</div></div>`; return; }

  let html=`<div class="srch-section-lbl">${lista.length} clase${lista.length!==1?'s':''} encontradas · ${periodoLbl}</div>`;
  html += lista.slice(0,8).map(clase=>{
    const regsC=registros.filter(r=>r.clase===clase&&r.fecha>=ini&&r.fecha<=fin&&(r.estado==='ok'||r.estado==='sub'));
    const afoR=regsC.filter(r=>parseInt(r.cap||0)>0);
    const afoP=afoR.length>0?Math.round(afoR.reduce((s,r)=>s+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoR.length):0;
    const totAsis=regsC.reduce((s,r)=>s+(parseInt(r.asistentes)||0),0);
    const dias=[...new Set(regsC.map(r=>r.dia))].join(', ')||'—';
    return `<div class="srch-item" onclick="document.getElementById('mob-search-input2').value='${clase}';_procesarBusqueda('${clase}')">
      <div class="srch-item-icon" style="background:rgba(77,184,232,.1);border:1px solid rgba(77,184,232,.2)">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--blue)" stroke-width="1.5"><rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" y1="9" x2="17" y2="9"/><line x1="7" y1="2" x2="7" y2="6" stroke-linecap="round"/><line x1="13" y1="2" x2="13" y2="6" stroke-linecap="round"/></svg>
      </div>
      <div class="srch-item-body">
        <div class="srch-item-title">${clase}</div>
        <div class="srch-item-sub">${regsC.length} sesiones · ${totAsis.toLocaleString()} asis. · ${dias}</div>
      </div>
      <div class="srch-item-val" style="color:${afoR.length?pctCol(afoP):'var(--txt3)'}">${afoR.length?afoP+'%':'—'}</div>
    </div>`;
  }).join('');
  if(lista.length>8) html+=`<div style="font-size:.7rem;color:var(--txt3);text-align:center;padding:6px 0">…y ${lista.length-8} más</div>`;
  area.innerHTML=html;
}

// ── Renderizar faltas ─────────────────────────────────────────────
function _renderFaltas(area, ini, fin, periodoLbl, instF, claseF){
  let regs=registros.filter(r=>r.fecha>=ini&&r.fecha<=fin&&r.estado==='falta');
  if(instF) regs=regs.filter(r=>String(r.inst_id)===String(instF.id));
  if(claseF) regs=regs.filter(r=>r.clase===claseF);
  regs.sort((a,b)=>b.fecha.localeCompare(a.fecha));

  if(regs.length===0){
    area.innerHTML=`<div class="mob-search-result"><div class="mob-result-val" style="color:var(--neon)">0</div><div class="mob-result-sub">Sin faltas en ${periodoLbl}${instF?' — '+instF.nombre.split(' ')[0]:''}${claseF?' — '+claseF:''} ✔</div></div>`;
    return;
  }
  // Agrupar por instructor
  const porInst={};
  regs.forEach(r=>{
    const id=String(r.inst_id);
    if(!porInst[id]){porInst[id]={inst:instructores.find(i=>String(i.id)===id),faltas:[]};}
    porInst[id].faltas.push(r);
  });
  let html=`<div class="mob-search-result" style="margin-bottom:6px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><div class="mob-result-val" style="color:var(--red2)">${regs.length}</div><div class="mob-result-sub">faltas · ${periodoLbl}</div></div>
      <div style="text-align:right;font-size:.72rem;color:var(--txt2)">${Object.keys(porInst).length} instructor${Object.keys(porInst).length!==1?'es':''}</div>
    </div>
  </div>
  <div class="srch-section-lbl">Por instructor</div>`;
  html += Object.values(porInst).sort((a,b)=>b.faltas.length-a.faltas.length).map(({inst,faltas})=>{
    const nombre=inst?inst.nombre:'Desconocido';
    const ultFecha=faltas[0]?.fecha||'—';
    return `<div class="srch-item">
      <div class="srch-item-icon" style="background:rgba(224,80,80,.12);border:1px solid rgba(224,80,80,.3)">
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="var(--red2)" stroke-width="1.5"><circle cx="10" cy="6" r="3"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>
      </div>
      <div class="srch-item-body">
        <div class="srch-item-title">${nombre}</div>
        <div class="srch-item-sub">Última: ${ultFecha} · ${faltas.map(f=>f.clase).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}</div>
      </div>
      <div class="srch-item-val" style="color:var(--red2)">${faltas.length}</div>
    </div>`;
  }).join('');
  // Últimas 4 faltas individuales
  html+=`<div class="srch-section-lbl" style="margin-top:4px">Últimas faltas</div>`;
  html+=regs.slice(0,5).map(r=>{
    const inst=instructores.find(i=>String(i.id)===String(r.inst_id));
    const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--panel2);border:1px solid var(--border);border-left:3px solid var(--red2);border-radius:10px;margin-bottom:4px;font-size:.76rem">
      <div style="flex:1"><strong>${r.clase}</strong> · ${inst?.nombre.split(' ')[0]||'?'}</div>
      <div style="font-family:'DM Mono',monospace;font-size:.68rem;color:var(--txt3)">${fd} ${r.hora||''}</div>
    </div>`;
  }).join('');
  area.innerHTML=html;
}

// ── Renderizar suplencias ─────────────────────────────────────────
function _renderSuplencias(area, ini, fin, periodoLbl, instF, claseF){
  let regs=registros.filter(r=>r.fecha>=ini&&r.fecha<=fin&&r.estado==='sub');
  if(instF) regs=regs.filter(r=>String(r.inst_id)===String(instF.id));
  if(claseF) regs=regs.filter(r=>r.clase===claseF);
  regs.sort((a,b)=>b.fecha.localeCompare(a.fecha));

  if(regs.length===0){
    area.innerHTML=`<div class="mob-search-result"><div class="mob-result-val" style="color:var(--blue)">0</div><div class="mob-result-sub">Sin suplencias en ${periodoLbl}</div></div>`;
    return;
  }
  const motivoLabels={'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'};
  let html=`<div class="mob-search-result" style="margin-bottom:6px">
    <div class="mob-result-val" style="color:var(--blue)">${regs.length}</div>
    <div class="mob-result-sub">suplencias · ${periodoLbl}</div>
  </div>
  <div class="srch-section-lbl">Detalle</div>`;
  html+=regs.slice(0,6).map(r=>{
    const inst=instructores.find(i=>String(i.id)===String(r.inst_id));
    const sup=r.suplente_id?instructores.find(i=>String(i.id)===String(r.suplente_id)):null;
    const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    const motivo=r.motivo_suplencia?motivoLabels[r.motivo_suplencia]||r.motivo_suplencia:'—';
    return `<div style="background:var(--panel2);border:1px solid var(--border);border-left:3px solid var(--blue);border-radius:10px;padding:8px 11px;margin-bottom:5px;font-size:.75rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <strong>${r.clase}</strong>
        <span style="font-family:'DM Mono',monospace;font-size:.68rem;color:var(--txt3)">${fd} ${r.hora||''}</span>
      </div>
      <div style="color:var(--txt2)">Orig: ${inst?.nombre.split(' ')[0]||'?'} → Sub: <span style="color:var(--blue)">${sup?.nombre.split(' ')[0]||r.suplente_nombre||'?'}</span></div>
      ${motivo!=='—'?`<div style="color:var(--txt3);font-size:.67rem;margin-top:2px">Motivo: ${motivo}</div>`:''}
    </div>`;
  }).join('');
  if(regs.length>6) html+=`<div style="font-size:.7rem;color:var(--txt3);text-align:center;padding:4px 0">…y ${regs.length-6} más · <span style="color:var(--neon);cursor:pointer" onclick="cerrarBuscadorMob();navegarA('historial')">Ver historial →</span></div>`;
  area.innerHTML=html;
}

// ── Respuesta analítica general ───────────────────────────────────
function _renderAnalisis(area, q, qLow, claseEncontrada, instEncontrado, diaEncontrado, ini, fin, periodoLbl, esAforo, esAsistencias, esFaltas, eSup){
  let regs=registros.filter(r=>r.fecha>=ini&&r.fecha<=fin);
  if(claseEncontrada) regs=regs.filter(r=>r.clase===claseEncontrada);
  if(instEncontrado)  regs=regs.filter(r=>String(r.inst_id)===String(instEncontrado.id));
  if(diaEncontrado)   regs=regs.filter(r=>r.dia===diaEncontrado);

  const imp=regs.filter(r=>r.estado==='ok'||r.estado==='sub');
  const afoR=imp.filter(r=>parseInt(r.cap||0)>0);
  const totAsis=imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  const afoP=afoR.length>0?Math.round(afoR.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoR.length):0;
  const faltas=regs.filter(r=>r.estado==='falta').length;
  const suplencias=regs.filter(r=>r.estado==='sub').length;
  const contextoLbl=[claseEncontrada,instEncontrado?.nombre.split(' ')[0],diaEncontrado].filter(Boolean).join(' · ')||'Programa general';

  // Tendencia
  const diffMs=new Date(fin)-new Date(ini);
  const antFin=new Date(ini);antFin.setDate(antFin.getDate()-1);
  const antIni=new Date(antFin.getTime()-diffMs);
  const regsAnt=registros.filter(r=>r.fecha>=fechaLocalStr(antIni)&&r.fecha<=fechaLocalStr(antFin));
  const impAnt=regsAnt.filter(r=>r.estado==='ok'||r.estado==='sub');
  const afoRAnt=impAnt.filter(r=>parseInt(r.cap||0)>0);
  const afoAnt=afoRAnt.length>0?Math.round(afoRAnt.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoRAnt.length):0;
  const totAnt=impAnt.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  const deltaAfo=afoAnt>0?Math.round((afoP-afoAnt)/afoAnt*100):null;
  const deltaTot=totAnt>0?Math.round((totAsis-totAnt)/totAnt*100):null;

  // KPI principal
  let mainVal,mainLbl,mainColor;
  if(esAforo){mainVal=afoP+'%';mainLbl='aforo promedio';mainColor=pctCol(afoP);}
  else{mainVal=totAsis.toLocaleString();mainLbl='asistencias totales';mainColor='var(--neon)';}

  // Desglose por día para clase específica
  let desglose='';
  if(claseEncontrada && !diaEncontrado){
    const pd={};DIAS.forEach(d=>{const rd=imp.filter(r=>r.dia===d);if(rd.length){const a=rd.filter(r=>parseInt(r.cap||0)>0);const af=a.length?Math.round(a.reduce((s,r)=>s+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/a.length):0;pd[d]={n:rd.length,af,asis:Math.round(rd.reduce((s,r)=>s+(parseInt(r.asistentes)||0),0)/rd.length)};}});
    const dias=Object.entries(pd).sort((a,b)=>b[1].af-a[1].af);
    if(dias.length>1){
      desglose=`<div class="srch-section-lbl" style="margin-top:6px">Por día</div>`+
      dias.map(([d,v])=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:50px;font-size:.7rem;color:var(--txt2)">${d.slice(0,3)}</div>
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${v.af}%;background:${pctCol(v.af)};border-radius:3px"></div></div>
        <div style="width:32px;font-family:'DM Mono',monospace;font-size:.68rem;color:${pctCol(v.af)};text-align:right">${v.af}%</div>
        <div style="width:28px;font-size:.67rem;color:var(--txt3);text-align:right">${v.n}s</div>
      </div>`).join('');
    }
  }

  // Top 3 clases si no hay filtro específico
  let topClases='';
  if(!claseEncontrada&&!instEncontrado){
    const pm={};imp.forEach(r=>{if(!pm[r.clase])pm[r.clase]={s:0,n:0,asis:0};pm[r.clase].asis+=parseInt(r.asistentes)||0;const c=parseInt(r.cap||0);if(c>0){pm[r.clase].s+=(parseInt(r.asistentes)||0)/c*100;pm[r.clase].n++;}});
    const sorted=Object.entries(pm).map(([c,v])=>({c,af:v.n?Math.round(v.s/v.n):0,asis:v.asis})).sort((a,b)=>b.af-a.af).slice(0,4);
    if(sorted.length>0){
      topClases=`<div class="srch-section-lbl" style="margin-top:6px">Top clases · ${periodoLbl}</div>`+
      sorted.map((x,i)=>`<div class="srch-item" onclick="document.getElementById('mob-search-input2').value='${x.c}';_procesarBusqueda('${x.c}')">
        <div style="width:20px;text-align:center;font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${i===0?'var(--gold2)':i===1?'var(--txt2)':'var(--txt3)'}">${i+1}</div>
        <div class="srch-item-body">
          <div class="srch-item-title">${x.c}</div>
          <div class="srch-item-sub">${x.asis.toLocaleString()} asistentes · ${periodoLbl}</div>
        </div>
        <div class="srch-item-val" style="color:${pctCol(x.af)}">${x.af}%</div>
      </div>`).join('');
    }
  }

  const tendSign=deltaAfo!==null?(deltaAfo>0?'↑':'↓'):'';
  const tendColor=deltaAfo!==null?(deltaAfo>0?'var(--neon)':'var(--red2)'):'';

  area.innerHTML=`
  <div class="mob-search-result">
    <div style="font-size:.57rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt3);margin-bottom:4px">${contextoLbl} · ${periodoLbl}</div>
    <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:8px">
      <div>
        <div class="mob-result-val" style="color:${mainColor}">${mainVal}</div>
        <div class="mob-result-sub">${mainLbl}</div>
      </div>
      ${deltaAfo!==null?`<div style="font-size:.75rem;color:${tendColor};margin-bottom:6px">${tendSign}${Math.abs(deltaAfo)}% vs ant.</div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px">
      <div style="background:var(--panel2);border-radius:8px;padding:6px;text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${pctCol(afoP)}">${afoP}%</div>
        <div style="font-size:.55rem;color:var(--txt3)">Aforo</div>
      </div>
      <div style="background:var(--panel2);border-radius:8px;padding:6px;text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:var(--blue)">${imp.length}</div>
        <div style="font-size:.55rem;color:var(--txt3)">Sesiones</div>
      </div>
      <div style="background:var(--panel2);border-radius:8px;padding:6px;text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${faltas>0?'var(--red2)':'var(--neon)'}">${faltas}</div>
        <div style="font-size:.55rem;color:var(--txt3)">Faltas</div>
      </div>
      <div style="background:var(--panel2);border-radius:8px;padding:6px;text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:var(--txt2)">${suplencias}</div>
        <div style="font-size:.55rem;color:var(--txt3)">Suplencias</div>
      </div>
    </div>
  </div>
  ${desglose}
  ${topClases}
  <div style="display:flex;gap:6px;margin-top:2px">
    <button class="btn bg" style="flex:1;font-size:.72rem;padding:8px" onclick="cerrarBuscadorMob();navegarA('historial')">Historial →</button>
    <button class="btn bb" style="flex:1;font-size:.72rem;padding:8px" onclick="cerrarBuscadorMob();navegarA('dashboard')">Dashboard →</button>
  </div>
  <div class="mob-chip-row" style="margin-top:6px">${BUSQ_FRECUENTES.map(fq=>`<span class="mob-chip" onclick="ejecutarBuscadorMob2('${fq}');document.getElementById('mob-search-input2').value='${fq}'">${fq}</span>`).join('')}</div>`;
}

// ── Mini comparación "A vs B" en búsqueda ────────────────────────
function _busquedaVs(termA, termB, area){
  const todasClases=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))];
  const findClase=t=>todasClases.find(c=>c.toLowerCase().includes(t.toLowerCase()));
  const findInst=t=>instructores.find(i=>i.nombre.toLowerCase().split(' ').some(p=>p.length>2&&t.toLowerCase().includes(p)));

  const cA=findClase(termA)||null, cB=findClase(termB)||null;
  const iA=!cA?findInst(termA):null, iB=!cB?findInst(termB):null;

  const mesIni=new Date(hoy);mesIni.setDate(1);
  const ini=fechaLocalStr(mesIni),fin=fechaLocalStr(hoy);
  const regs=registros.filter(r=>r.fecha>=ini&&r.fecha<=fin&&(r.estado==='ok'||r.estado==='sub'));

  function stats(regsF){
    const aR=regsF.filter(r=>parseInt(r.cap||0)>0);
    return{
      af:aR.length>0?Math.round(aR.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/aR.length):0,
      asis:regsF.length>0?Math.round(regsF.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/regsF.length):0,
      ses:regsF.length
    };
  }

  let labelA=termA, labelB=termB, regsA, regsB;
  if(cA&&cB){
    labelA=cA;labelB=cB;
    regsA=regs.filter(r=>r.clase===cA);regsB=regs.filter(r=>r.clase===cB);
  } else if(iA&&iB){
    labelA=iA.nombre.split(' ')[0];labelB=iB.nombre.split(' ')[0];
    regsA=regs.filter(r=>r.inst_id===iA.id);regsB=regs.filter(r=>r.inst_id===iB.id);
  } else {
    area.innerHTML=`<div class="mob-search-result"><div class="mob-result-sub">No se encontraron "${termA}" ni "${termB}" en los datos.</div></div>`;
    return;
  }

  const sA=stats(regsA),sB=stats(regsB);
  const cols=['aforo','asis.prom','sesiones'];
  const vA=[sA.af+'%',sA.asis,sA.ses], vB=[sB.af+'%',sB.asis,sB.ses];
  const rA=[sA.af,sA.asis,sA.ses], rB=[sB.af,sB.asis,sB.ses];

  area.innerHTML=`
    <div class="mob-search-result">
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:rgba(94,255,160,.5);margin-bottom:8px">Comparación · este mes</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:var(--blue);text-align:center">${labelA}</div>
        <div style="font-size:.65rem;color:var(--txt3)">vs</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;color:var(--gold2);text-align:center">${labelB}</div>
      </div>
      <div style="height:1px;background:var(--border);margin:8px 0"></div>
      ${cols.map((c,i)=>{
        const ganA=rA[i]>=rB[i];
        return`<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:4px;align-items:center;margin-bottom:6px">
          <div style="text-align:center;padding:5px;border-radius:8px;background:${ganA?'rgba(77,184,232,.1)':'var(--panel2)'}">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${ganA?'var(--blue)':'var(--txt3)'}">${vA[i]}</div>
            ${ganA?'<div style="font-size:.5rem;color:var(--blue)">▲</div>':''}
          </div>
          <div style="font-size:.58rem;color:var(--txt3);text-align:center;line-height:1.3">${c}</div>
          <div style="text-align:center;padding:5px;border-radius:8px;background:${!ganA?'rgba(232,184,75,.1)':'var(--panel2)'}">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:${!ganA?'var(--gold2)':'var(--txt3)'}">${vB[i]}</div>
            ${!ganA?'<div style="font-size:.5rem;color:var(--gold2)">▲</div>':''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--txt3);margin-bottom:6px">Búsquedas frecuentes</div>
    <div class="mob-chip-row">${BUSQ_FRECUENTES.map(fq=>`<span class="mob-chip" onclick="ejecutarBuscadorMob2('${fq}');document.getElementById('mob-search-input2').value='${fq}'">${fq}</span>`).join('')}</div>
  `;
}


// ── Clases a modificar ───────────────────────────────────────────
function _busquedaModificar(area, ini, fin, periodoLbl) {
  const regs = registros.filter(r => r.fecha>=ini && r.fecha<=fin && (r.estado==='ok'||r.estado==='sub'));
  const mapa = {};
  regs.forEach(r => {
    const cap = parseInt(r.cap||0);
    if(!mapa[r.clase]) mapa[r.clase] = {s:0,n:0,asis:0,total:0,dias:new Set(),horas:new Set(),insts:new Set()};
    mapa[r.clase].total++;
    mapa[r.clase].asis += parseInt(r.asistentes)||0;
    mapa[r.clase].dias.add(r.dia);
    mapa[r.clase].horas.add(r.hora);
    if(r.inst_id) mapa[r.clase].insts.add(r.inst_id);
    if(cap>0){ mapa[r.clase].s += (parseInt(r.asistentes)||0)/cap*100; mapa[r.clase].n++; }
  });

  const candidatas = Object.entries(mapa)
    .map(([clase,v]) => ({
      clase,
      aforo: v.n>0 ? Math.round(v.s/v.n) : 0,
      promAsis: v.total>0 ? Math.round(v.asis/v.total) : 0,
      sesiones: v.total,
      dias: [...v.dias].join(', '),
      horas: [...v.horas].sort().join(', '),
      insts: [...v.insts].map(id=>instructores.find(i=>i.id===id)?.nombre.split(' ')[0]||'?').join(', ')
    }))
    .filter(c => c.aforo < 55 && c.sesiones >= 2)
    .sort((a,b) => a.aforo - b.aforo)
    .slice(0, 6);

  if(candidatas.length === 0) {
    area.innerHTML = `<div class="mob-search-result">
      <div class="mob-result-val" style="color:var(--neon)">Sin candidatas</div>
      <div class="mob-result-sub">No hay clases con aforo bajo (&lt;55%) en ${periodoLbl}</div>
    </div>`;
    return;
  }

  area.innerHTML = `
    <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--gold2);margin-bottom:8px">
      ${candidatas.length} clases con potencial de ajuste · ${periodoLbl}
    </div>
    ${candidatas.map(c => {
      // Generar sugerencia concreta
      let sug = '';
      if(c.aforo < 20) sug = `Considera cancelar o fusionar con otra clase similar`;
      else if(c.aforo < 35) sug = `Cambiar horario — probar en franja de mayor demanda`;
      else if(c.aforo < 55) sug = `Reforzar promoción o cambiar instructor`;
      const horasArr = c.horas.split(', ');
      // Sugerir horario alternativo (el más concurrido globalmente)
      const altHoras = ['07:00','08:00','09:00','17:00','18:00','19:00'].filter(h => !horasArr.includes(h)).slice(0,2);
      return `<div class="mob-search-result" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--red2);letter-spacing:.5px">${c.clase}</div>
          <div style="font-family:'DM Mono',monospace;font-size:1rem;font-weight:700;color:var(--red2)">${c.aforo}%</div>
        </div>
        <div style="font-size:.68rem;color:var(--txt2);margin-bottom:4px">
          ${c.dias} · ${c.horas} · ${c.insts}
        </div>
        <div style="font-size:.68rem;background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.2);border-radius:6px;padding:5px 8px;color:var(--gold2)">
          → ${sug}${altHoras.length ? `. Probar: ${altHoras.join(' ó ')}` : ''}
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:8px">
      <button class="btn bd" style="width:100%;font-size:.75rem" onclick="cerrarBuscadorMob();navegarA('ranking')">Ver ranking completo →</button>
    </div>`;
}

// ── Reporte rápido ───────────────────────────────────────────────
function _busquedaReporte(area, ini, fin, periodoLbl, claseF, instF, diaF) {
  let regs = registros.filter(r => r.fecha>=ini && r.fecha<=fin);
  if(claseF) regs = regs.filter(r => r.clase===claseF);
  if(instF)  regs = regs.filter(r => r.inst_id===instF.id);
  if(diaF)   regs = regs.filter(r => r.dia===diaF);
  const imp = regs.filter(r => r.estado==='ok'||r.estado==='sub');
  const afoR = imp.filter(r => parseInt(r.cap||0)>0);
  const totAsis = imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  const afoP = afoR.length>0 ? Math.round(afoR.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoR.length) : 0;
  const ctx = [claseF,instF?.nombre,diaF].filter(Boolean).join(' · ') || 'Programa general';

  area.innerHTML = `
    <div class="mob-search-result">
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:rgba(94,255,160,.5);margin-bottom:6px">Resumen para imprimir · ${periodoLbl}</div>
      <div style="font-size:.75rem;font-weight:600;color:var(--txt);margin-bottom:8px">${ctx}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:var(--panel2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--neon)">${totAsis.toLocaleString()}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Total asistencias</div>
        </div>
        <div style="background:var(--panel2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:${pctCol(afoP)}">${afoP}%</div>
          <div style="font-size:.58rem;color:var(--txt3)">Aforo promedio</div>
        </div>
        <div style="background:var(--panel2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:var(--blue)">${imp.length}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Sesiones</div>
        </div>
        <div style="background:var(--panel2);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:${regs.filter(r=>r.estado==='falta').length>0?'var(--red2)':'var(--neon)'}">${regs.filter(r=>r.estado==='falta').length}</div>
          <div style="font-size:.58rem;color:var(--txt3)">Faltas</div>
        </div>
      </div>
      <button class="btn bg" style="width:100%;font-size:.78rem;margin-bottom:6px" onclick="cerrarBuscadorMob();abrirModal('m-reports')">
        Abrir Reportes completos →
      </button>
      <button class="btn solo-admin" style="width:100%;font-size:.78rem;background:rgba(41,128,185,.2);color:var(--blue);border:1px solid rgba(41,128,185,.35)" onclick="cerrarBuscadorMob();abrirSupPlanner()">
        📅 Planificador de Suplencias →
      </button>
    </div>`;
}

// Voz para búsqueda
let _speechRecSearch = null;
function toggleVozBusqueda() { _toggleVoz('mob-mic-btn', val => { const i=document.getElementById('mob-search-input2'); if(i){i.value=val;ejecutarBuscadorMob2(val);} }); }
function toggleVozBusqueda2() { _toggleVoz('mob-mic-btn2', val => { const i=document.getElementById('mob-search-input2'); if(i){i.value=val;ejecutarBuscadorMob2(val);} }); }

// ── AGENDA ───────────────────────────────────────────
let agendaNotas = JSON.parse(localStorage.getItem('fc_agenda')||'[]');

function _guardarAgenda() {
  try{ localStorage.setItem('fc_agenda', JSON.stringify(agendaNotas)); }catch(e){}
  if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 600);
}

function abrirAgendaMob() {
  _agCalYear  = new Date().getFullYear();
  _agCalMonth = new Date().getMonth();
  _agCalDiaSelec = null;
  document.getElementById('mob-agenda-overlay').classList.add('on');
  renderAgendaCal();
  renderAgendaMob();
}
function cerrarAgendaMob() {
  document.getElementById('mob-agenda-overlay').classList.remove('on');
}

// ══ AGENDA UNIFICADA: NOTAS + EVENTOS ══════════════════════════════════════
let _agTabActual = 'notas'; // 'notas' | 'eventos'

function agTabCambiar(tab) {
  _agTabActual = tab;
  const panelNotas   = document.getElementById('ag-panel-notas');
  const panelEventos = document.getElementById('ag-panel-eventos');
  const btnNotas     = document.getElementById('agtab-notas');
  const btnEventos   = document.getElementById('agtab-eventos');
  if(panelNotas)   panelNotas.style.display   = tab === 'notas'   ? 'flex' : 'none';
  if(panelEventos) panelEventos.style.display = tab === 'eventos' ? 'flex' : 'none';
  if(btnNotas){
    btnNotas.style.background = tab === 'notas' ? 'var(--verde)' : 'none';
    btnNotas.style.color      = tab === 'notas' ? '#fff' : 'var(--txt2)';
    btnNotas.style.fontWeight = tab === 'notas' ? '700' : '600';
  }
  if(btnEventos){
    btnEventos.style.background = tab === 'eventos' ? 'var(--verde)' : 'none';
    btnEventos.style.color      = tab === 'eventos' ? '#fff' : 'var(--txt2)';
    btnEventos.style.fontWeight = tab === 'eventos' ? '700' : '600';
  }
  if(tab === 'eventos') agEvtRenderLista();
  // Re-render el calendario para mostrar los puntos correctos
  renderAgendaCal();
}

// ── Render lista eventos en agenda ─────────────────────────────────────────
function agEvtRenderLista() {
  const cont = document.getElementById('ag-evt-lista');
  const sub  = document.getElementById('ag-evt-subtitulo');
  if(!cont) return;

  const ev = evtCargarDatos();
  const hoyStr = fechaLocalStr(new Date());

  // Si hay día seleccionado, mostrar eventos de ese día
  let lista, subtitulo;
  if(_agCalDiaSelec) {
    lista = ev.filter(e => e.fecha === _agCalDiaSelec);
    const [y,m,d] = _agCalDiaSelec.split('-');
    const fmtFecha = new Date(+y,+m-1,+d).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
    subtitulo = `Eventos del ${fmtFecha}`;
  } else {
    lista = ev.filter(e => e.fecha >= hoyStr && e.estado !== 'cancelado')
              .sort((a,b) => a.fecha.localeCompare(b.fecha))
              .slice(0, 10);
    subtitulo = ev.length > 0 ? `Próximos eventos (${lista.length})` : 'Sin eventos registrados';
  }
  if(sub) sub.textContent = subtitulo;

  if(!lista.length) {
    cont.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--txt3);font-size:.78rem;">
      ${_agCalDiaSelec ? 'Sin eventos para este día' : 'Sin eventos próximos'}<br>
      <span style="font-size:.65rem;color:var(--txt3)">Toca "Registrar Nuevo Evento" para agregar uno</span>
    </div>`;
    return;
  }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const colEst = { planificado:'var(--blue)', realizado:'var(--neon)', cancelado:'var(--red2)', pospuesto:'var(--gold2)' };
  const icoEst = { planificado:'📅', realizado:'✅', cancelado:'❌', pospuesto:'⏸' };

  cont.innerHTML = lista.map(e => {
    const d   = new Date(e.fecha + 'T00:00');
    const dia = d.getDate();
    const mes = MESES[d.getMonth()];
    const diasDiff = Math.ceil((d - new Date()) / 86400000);
    const diasLbl = diasDiff < 0 ? `hace ${Math.abs(diasDiff)}d` :
                    diasDiff === 0 ? '¡Hoy!' :
                    diasDiff === 1 ? 'Mañana' : `en ${diasDiff}d`;
    const col = colEst[e.estado] || 'var(--v2)';
    const ico = icoEst[e.estado] || '📅';
    const partsInfo = [e.deporte, e.lugar, e.horaIni ? e.horaIni+' h' : null].filter(Boolean);
    return `<div onclick="agAbrirEditarEvento('${e.id}')"
      style="display:flex;align-items:stretch;gap:0;background:var(--panel2);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:all .15s;active:opacity:.7;">
      <!-- Borde color estado -->
      <div style="width:4px;background:${col};flex-shrink:0;"></div>
      <!-- Fecha -->
      <div style="min-width:42px;text-align:center;padding:10px 6px;border-right:1px solid var(--border);flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${col};line-height:1">${dia}</div>
        <div style="font-size:.5rem;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-top:1px">${mes}</div>
      </div>
      <!-- Contenido -->
      <div style="flex:1;min-width:0;padding:8px 10px;">
        <div style="font-size:.8rem;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">${e.nombre || '—'}</div>
        <div style="font-size:.63rem;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${partsInfo.join(' · ')}</div>
        ${e.participantes ? `<div style="font-size:.6rem;color:var(--txt3);margin-top:2px;">👥 ${e.participantes} participantes</div>` : ''}
      </div>
      <!-- Estado + tiempo -->
      <div style="flex-shrink:0;padding:8px 10px;text-align:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:3px;">
        <div style="font-size:.58rem;font-weight:700;color:${col};">${diasLbl}</div>
        <div style="font-size:.55rem;color:var(--txt3);">${ico} ${e.estado}</div>
        ${e.calificacion ? `<div style="font-size:.55rem;">${'⭐'.repeat(e.calificacion)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Preview del día en el calendario (notas + eventos) ─────────────────────
function agActualizarPreviewDia() {
  const preview = document.getElementById('ag-dia-preview');
  const fechaLbl = document.getElementById('ag-preview-fecha-lbl');
  const itemsCont = document.getElementById('ag-preview-items');
  if(!preview || !fechaLbl || !itemsCont) return;

  if(!_agCalDiaSelec) { preview.classList.remove('on'); return; }

  const [y,m,d] = _agCalDiaSelec.split('-');
  const fmtFecha = new Date(+y,+m-1,+d).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
  fechaLbl.textContent = fmtFecha.charAt(0).toUpperCase() + fmtFecha.slice(1);

  const colEst = { planificado:'var(--blue)', realizado:'var(--neon)', cancelado:'var(--red2)', pospuesto:'var(--gold2)' };
  const items = [];

  // Eventos del día
  evtCargarDatos().filter(e => e.fecha === _agCalDiaSelec).forEach(e => {
    items.push({
      dot: colEst[e.estado] || 'var(--v2)',
      texto: `🏆 ${e.nombre || e.deporte}${e.horaIni ? ' · ' + e.horaIni : ''}`,
      tipo: 'evento',
      accion: `agAbrirEditarEvento('${e.id}')`
    });
  });

  // Notas del día
  agendaNotas.filter(n => !n.resuelta && n.ts && n.ts.startsWith(_agCalDiaSelec)).forEach(n => {
    const colPri = { alta:'var(--red2)', media:'var(--gold2)', baja:'var(--blue)' };
    items.push({
      dot: colPri[n.prioridad] || 'var(--gold2)',
      texto: n.texto.length > 55 ? n.texto.slice(0,55) + '…' : n.texto,
      tipo: 'nota'
    });
  });

  if(!items.length) { preview.classList.remove('on'); return; }

  preview.classList.add('on');
  itemsCont.innerHTML = items.map(it => `
    <div class="ag-preview-item" ${it.accion ? `onclick="${it.accion}" style="cursor:pointer;"` : ''}>
      <div class="ag-preview-dot" style="background:${it.dot}"></div>
      <div style="font-size:.71rem;color:var(--txt);line-height:1.4;flex:1;">${it.texto}</div>
    </div>`).join('');
}

// ── Abrir/cerrar agenda ─────────────────────────────────────────────────────
function agAbrirNuevoEvento() {
  document.getElementById('mob-agenda-overlay').classList.remove('on');
  setTimeout(() => { abrirModalEvento(null); }, 100);
}

function agAbrirEditarEvento(id) {
  document.getElementById('mob-agenda-overlay').classList.remove('on');
  setTimeout(() => { abrirModalEvento(id); }, 100);
}

// Patch abrirAgendaMob para resetear estado
const _orig_abrirAgendaMob = abrirAgendaMob;
abrirAgendaMob = function() {
  _agTabActual = 'notas';
  // Resetear tabs
  const pN = document.getElementById('ag-panel-notas');
  const pE = document.getElementById('ag-panel-eventos');
  const bN = document.getElementById('agtab-notas');
  const bE = document.getElementById('agtab-eventos');
  if(pN) pN.style.display = 'flex';
  if(pE) pE.style.display = 'none';
  if(bN){ bN.style.background='var(--verde)'; bN.style.color='#fff'; bN.style.fontWeight='700'; }
  if(bE){ bE.style.background='none'; bE.style.color='var(--txt2)'; bE.style.fontWeight='600'; }
  _orig_abrirAgendaMob();
};
function renderAgendaMob() {
  _renderAgendaConFiltro();
}

function cambiarPrioridadNota(idx, pri) {
  if(agendaNotas[idx]) { agendaNotas[idx].prioridad=pri; _guardarAgenda(); renderAgendaCal(); renderAgendaMob(); renderMobileHome(); }
}

let _agendaPriActual = 'media';
let _agendaFiltroActual = 'todas';

function setAgendaPri(p){
  _agendaPriActual=p;
  ['alta','media','baja'].forEach(x=>{
    document.getElementById('agpri-'+x)?.classList.toggle('on', x===p);
  });
}
function setAgendaFiltro(f){
  _agendaFiltroActual=f;
  ['todas','alta','media','baja'].forEach(x=>{
    document.getElementById('agfil-'+x)?.classList.toggle('on', x===f);
  });
  _renderAgendaConFiltro();
}

function guardarNotaMob() {
  const el = document.getElementById('mob-nota-nueva');
  if(!el) return;
  const texto = el.value.trim();
  if(!texto){ _vErr('mob-nota-nueva','Escribe algo primero'); showToast('Escribe algo primero','warn'); return; }
  if(texto.length < 3){ showToast('La nota es demasiado corta','warn'); return; }
  agendaNotas.push({
    id: 'nota_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ts: new Date().toISOString(),
    updatedAt: Date.now(),
    texto,
    prioridad: _agendaPriActual,
    resuelta: false
  });
  _guardarAgenda();
  el.value = '';
  _vClear('mob-nota-nueva');
  renderAgendaCal();
  renderAgendaMob();
  renderMobileHome();
  showToast('Nota guardada','ok');
}

function resolverNota(idx) {
  if(agendaNotas[idx]) { agendaNotas[idx].resuelta = true; agendaNotas[idx].updatedAt = Date.now(); }
  _guardarAgenda();
  renderAgendaCal();
  renderAgendaMob();
  renderMobileHome();
}

// ── MINI-CALENDARIO AGENDA ───────────────────────────────────
let _agCalYear  = new Date().getFullYear();
let _agCalMonth = new Date().getMonth();
let _agCalDiaSelec = null; // "YYYY-MM-DD" o null = sin filtro

const _MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _DOWS     = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

function agCalCambiarMes(delta){
  _agCalMonth += delta;
  if(_agCalMonth>11){ _agCalMonth=0; _agCalYear++; }
  if(_agCalMonth<0) { _agCalMonth=11; _agCalYear--; }
  renderAgendaCal();
}

function agCalSelecDia(dia){
  const key = `${_agCalYear}-${String(_agCalMonth+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  _agCalDiaSelec = (_agCalDiaSelec===key) ? null : key; // toggle
  _agendaFiltroActual = 'todas';
  ['todas','alta','media','baja'].forEach(x=>document.getElementById('agfil-'+x)?.classList.toggle('on',x==='todas'));
  renderAgendaCal(); // incluye agActualizarPreviewDia()
  _renderAgendaConFiltro();
  // Si estamos en tab eventos, refrescar también
  if(_agTabActual === 'eventos') agEvtRenderLista();
}

function renderAgendaCal(){
  const mesLbl = document.getElementById('ag-cal-mes-lbl');
  const grid   = document.getElementById('ag-cal-grid');
  if(!mesLbl||!grid) return;

  mesLbl.textContent = `${_MESES_ES[_agCalMonth]} ${_agCalYear}`;

  // ── Días con notas ──────────────────────────────────────────────
  const diasConNota = {};
  agendaNotas.forEach(n=>{
    if(!n.ts||n.resuelta) return;
    const d = new Date(n.ts);
    if(d.getFullYear()===_agCalYear && d.getMonth()===_agCalMonth){
      const dia = d.getDate();
      if(!diasConNota[dia]) diasConNota[dia]={ alta:false, media:false, baja:false };
      diasConNota[dia][n.prioridad||'media'] = true;
    }
  });

  // ── Días con eventos ────────────────────────────────────────────
  const diasConEvento = {};
  try {
    evtCargarDatos().forEach(e=>{
      if(!e.fecha || e.estado==='cancelado') return;
      const [ey,em,ed] = e.fecha.split('-').map(Number);
      if(ey===_agCalYear && em-1===_agCalMonth) diasConEvento[ed] = true;
    });
  } catch(x){}

  const primerDow  = new Date(_agCalYear, _agCalMonth, 1).getDay();
  const diasEnMes  = new Date(_agCalYear, _agCalMonth+1, 0).getDate();
  const hoyDate    = new Date();
  const esEsteMes  = hoyDate.getFullYear()===_agCalYear && hoyDate.getMonth()===_agCalMonth;
  const diaHoy     = hoyDate.getDate();

  let html = '';
  _DOWS.forEach((d,i)=>{
    const esFin = i===0||i===6;
    html += `<div class="ag-cal-dow${esFin?' fin':''}">${d}</div>`;
  });
  for(let i=0;i<primerDow;i++) html+=`<div class="ag-cal-day vacio"></div>`;

  for(let d=1;d<=diasEnMes;d++){
    const keyDia = `${_agCalYear}-${String(_agCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const esHoy   = esEsteMes && d===diaHoy;
    const esSelec = _agCalDiaSelec===keyDia;
    const nota    = diasConNota[d];
    const evento  = diasConEvento[d];
    const dofW    = (primerDow+d-1)%7;
    const esFin   = dofW===0||dofW===6;
    const cls     = ['ag-cal-day',
      esFin&&!esHoy&&!esSelec?'fin':'',
      esHoy?'hoy':'',
      esSelec?'selec':''
    ].filter(Boolean).join(' ');

    // Construir indicadores (dots)
    let dots = '';
    if(nota||evento){
      dots = '<div class="ag-cal-dots">';
      if(evento)      dots += '<div class="ag-cal-dot evento"></div>';
      if(nota?.alta)  dots += '<div class="ag-cal-dot nota-alta"></div>';
      else if(nota?.media) dots += '<div class="ag-cal-dot nota-media"></div>';
      else if(nota?.baja)  dots += '<div class="ag-cal-dot nota-baja"></div>';
      dots += '</div>';
    }
    html+=`<div class="${cls}" onclick="agCalSelecDia(${d})">${d}${dots}</div>`;
  }
  grid.innerHTML = html;
  // Actualizar preview si hay día seleccionado
  agActualizarPreviewDia();
}

// Render de notas respetando el filtro de día del calendario
function _renderAgendaConFiltro(){
  const lista = document.getElementById('mob-notas-lista');
  if(!lista) return;

  const PRI_CFG = {
    alta: {color:'var(--red2)', label:'Alta', dot:'var(--red2)', order:0},
    media:{color:'var(--gold2)',label:'Media',dot:'var(--gold2)',order:1},
    baja: {color:'var(--blue)', label:'Baja', dot:'var(--blue)', order:2}
  };
  agendaNotas.forEach(n=>{ if(!n.prioridad) n.prioridad='media'; });

  // Contadores para el label
  const pendAlta  = agendaNotas.filter(n=>!n.resuelta&&n.prioridad==='alta').length;
  const pendMedia = agendaNotas.filter(n=>!n.resuelta&&n.prioridad==='media').length;
  const pendBaja  = agendaNotas.filter(n=>!n.resuelta&&n.prioridad==='baja').length;
  const pend = pendAlta+pendMedia+pendBaja;
  const lbl = document.getElementById('mob-agenda-pendientes-lbl');
  if(lbl){
    if(_agCalDiaSelec){
      const [y,m,d] = _agCalDiaSelec.split('-');
      const fecha = new Date(+y,+m-1,+d).toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
      lbl.innerHTML=`<span style="color:var(--blue)">${fecha}</span>`;
    } else {
      lbl.innerHTML = pend>0
        ? `${pendAlta>0?`<span style="color:var(--red2);font-weight:700">${pendAlta}▲</span> `:''}${pendMedia>0?`<span style="color:var(--gold2)">${pendMedia}●</span> `:''}${pendBaja>0?`<span style="color:var(--blue)">${pendBaja}▼</span>`:''}`
        : '<span style="color:var(--neon)">Todo al día ✔</span>';
    }
  }

  let notas = [...agendaNotas].filter(n=>!n.resuelta);
  if(_agendaFiltroActual!=='todas') notas=notas.filter(n=>n.prioridad===_agendaFiltroActual);
  if(_agCalDiaSelec) notas=notas.filter(n=>n.ts&&n.ts.startsWith(_agCalDiaSelec));
  notas.sort((a,b)=>{
    const oa=PRI_CFG[a.prioridad]?.order??1, ob=PRI_CFG[b.prioridad]?.order??1;
    return oa!==ob?oa-ob:b.id-a.id;
  });

  const resueltas = agendaNotas.filter(n=>n.resuelta)
    .filter(n=>_agendaFiltroActual==='todas'||n.prioridad===_agendaFiltroActual)
    .filter(n=>!_agCalDiaSelec||(n.ts&&n.ts.startsWith(_agCalDiaSelec)))
    .slice(0,3);

  const todas = [...notas,...resueltas];
  const PALABRAS=['spinning','yoga','pilates','rpm','crossfit','box','pump','combat','attack','zumba','gap','funcional','trx','step','horario','suplencia','profe','instructor','socio','queja','reunion','reunión','capacidad','salón','salon','clase'];

  if(todas.length===0){
    lista.innerHTML=`<div class="empty" style="font-size:.78rem">${
      _agCalDiaSelec?'Sin notas para este día. Toca otro día o escribe una abajo.':
      _agendaFiltroActual==='todas'?'Sin notas aún. Agrega una abajo.':`Sin notas de prioridad ${_agendaFiltroActual}.`
    }</div>`;
    return;
  }

  lista.innerHTML = todas.map(n=>{
    const idx = agendaNotas.findIndex(x=>x.id===n.id);
    const d   = new Date(n.ts);
    const fec = d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    const hor = d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    const pri = PRI_CFG[n.prioridad||'media'];
    const chips = PALABRAS.filter(p=>n.texto.toLowerCase().includes(p)).slice(0,3)
      .map(p=>`<span style="padding:2px 6px;border-radius:8px;font-size:.58rem;background:rgba(94,255,160,.1);color:var(--neon);border:1px solid rgba(94,255,160,.2)">${p}</span>`).join('');
    return `<div class="nota-card-mob nota-pri-${n.prioridad||'media'} ${n.resuelta?'resuelta':''}" style="opacity:${n.resuelta?.6:1}">
      <div class="nota-ts-mob">
        <div style="width:8px;height:8px;border-radius:50%;background:${n.resuelta?'var(--txt3)':pri.dot};flex-shrink:0"></div>
        <span style="font-size:.62rem;font-weight:700;color:${n.resuelta?'var(--txt3)':pri.color}">${pri.label}</span>
        <span style="color:var(--txt3);font-size:.6rem">· ${fec} ${hor}</span>
        <div style="flex:1"></div>
        ${!n.resuelta
          ?`<div style="display:flex;gap:4px;align-items:center">
              <select style="font-size:.6rem;background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--txt2);padding:1px 4px;" onchange="cambiarPrioridadNota(${idx},this.value)">
                <option value="alta" ${n.prioridad==='alta'?'selected':''}>Alta</option>
                <option value="media" ${n.prioridad==='media'||!n.prioridad?'selected':''}>Media</option>
                <option value="baja" ${n.prioridad==='baja'?'selected':''}>Baja</option>
              </select>
              <span style="font-size:.62rem;color:var(--txt3);cursor:pointer;padding:2px 7px;border:1px solid var(--border);border-radius:6px" onclick="resolverNota(${idx})">✔</span>
             </div>`
          :'<span style="font-size:.6rem;color:var(--txt3)">Resuelta</span>'}
      </div>
      <div class="nota-texto-mob">${n.texto}</div>
      ${chips?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px">${chips}</div>`:''}
    </div>`;
  }).join('');
}

// Voz para notas
function toggleVozNota() {
  _toggleVoz('mob-voz-nota-btn', val => {
    const el = document.getElementById('mob-nota-nueva');
    if(el) el.value = (el.value ? el.value+' ' : '') + val;
  });
}

// ── Motor de voz común ───────────────────────────────
let _vozActiva = null;
let _vozBtnId  = null;
function _toggleVoz(btnId, onResult) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){ showToast('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.','warn'); return; }

  if(_vozActiva) {
    _vozActiva.stop();
    _vozActiva = null;
    const b = document.getElementById(_vozBtnId);
    if(b) b.classList.remove('recording');
    return;
  }

  const recog = new SpeechRecognition();
  recog.lang = 'es-MX';
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  _vozActiva = recog;
  _vozBtnId  = btnId;

  const btn = document.getElementById(btnId);
  if(btn) btn.classList.add('recording');

  recog.onresult = (e) => {
    const val = e.results[0][0].transcript;
    onResult(val);
  };
  recog.onerror = () => { showToast('No se escuchó nada. Intenta de nuevo.','warn'); };
  recog.onend = () => {
    _vozActiva = null;
    const b = document.getElementById(btnId);
    if(b) b.classList.remove('recording');
  };
  recog.start();
}

// Alerta de notas al abrir la app (se llama desde el init)
function mostrarAlertasAgenda() {
  // Solo aplica para coordinador
  if(typeof rolActual !== 'undefined' && rolActual === 'instructor') return;
  const pend = agendaNotas.filter(n=>!n.resuelta);
  if(pend.length===0) return;
  const priAlta = pend.filter(n=>n.prioridad==='alta');
  const primera = (priAlta[0]||pend[0]).texto; const primeraTxt = primera.length>55?primera.slice(0,55)+'...':primera;
  setTimeout(()=>{
    showToast(`📋 ${pend.length} nota(s)${priAlta.length>0?' · '+priAlta.length+' urgente(s)':''}: "${primeraTxt}"`, priAlta.length>0?'warn':'info');
  }, 3000);
}

// ── Inicialización de la home móvil ─────────────────
(function initMobileHome() {
  if(window.innerWidth > 640) return;
  renderMobileHome();
  mostrarAlertasAgenda();
})();


