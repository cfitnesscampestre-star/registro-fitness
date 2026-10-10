// ═══════════════════════════════════════════════════════════════════
// PORTAL INSTRUCTOR — Vista personal del instructor logueado
// ═══════════════════════════════════════════════════════════════════

let _instPeriodoDias = 7;
let _instRepChart = null;
let _instFirmaCtx = null;
let _instFirmaDrawing = false;
let _instFirmaHojaActiva = null;  // { semIni, semFin, encabezado, firmas:{} }

// ── Abrir portal ──────────────────────────────
function abrirPortalInstructorLocal() {
  const screen = document.getElementById('instructor-screen');
  if(!screen) return;

  // CRÍTICO: ocultar cualquier elemento del sistema coordinador que pudiera verse
  const mobileHome = document.getElementById('mobile-home');
  if(mobileHome) mobileHome.classList.remove('on');
  const bottomNav = document.getElementById('bottom-nav');
  if(bottomNav) bottomNav.style.display = 'none';
  const hdr = document.getElementById('hdr');
  if(hdr) hdr.style.display = 'none';
  const sidebar = document.getElementById('sidebar');
  if(sidebar) sidebar.style.display = 'none';
  const sectionNav = document.getElementById('section-nav');
  if(sectionNav) sectionNav.style.display = 'none';
  const backBar = document.getElementById('mob-back-bar');
  if(backBar) backBar.style.display = 'none';
  // Ocultar todas las vistas del coordinador
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));

  screen.style.display = 'flex';

  const inst = instructores.find(i => i.id === instActualId);

  // Nombre en el header
  const nombreEl = document.getElementById('inst-portal-nombre');
  if(nombreEl) nombreEl.textContent = inst ? inst.nombre : 'Instructor';
  const pieEl = document.getElementById('inst-portal-nombre-pie');
  if(pieEl) pieEl.textContent = inst ? inst.nombre : '';

  // Foto en el avatar del header
  const avatarRing = document.getElementById('inst-avatar-ring');
  const avatarSvg  = document.getElementById('inst-avatar-svg');
  const avatarImg  = document.getElementById('inst-avatar-img');
  if(avatarImg && avatarSvg) {
    if(inst && inst.foto) {
      avatarImg.src = inst.foto;
      avatarImg.style.display = 'block';
      avatarSvg.style.display = 'none';
      if(avatarRing) avatarRing.style.background = 'transparent';
    } else {
      avatarImg.style.display = 'none';
      avatarSvg.style.display = '';
      if(avatarRing) avatarRing.style.background = '';
    }
  }

  // Fecha de hoy en el datepicker
  const dp = document.getElementById('inst-date-picker');
  if(dp) dp.value = (typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date());

  // Cargar hoja de firmas activa si existe
  instCargarHojaFirmas();

  // Iniciar polling para detectar cuando coordinador publica hoja
  if(typeof instIniciarPoll === 'function') instIniciarPoll();

  // Mantenimiento: arranca en segundo plano (contador rojo de la pestaña)
  if(typeof mantIniciar === 'function') { try { mantIniciar(); } catch(e) { console.warn('[Mant]', e); } }

  // Pruebas físicas de Metodología (Control Gerencia): escucha en segundo plano
  if(typeof pruebasIniciar === 'function') { try { pruebasIniciar(); } catch(e) { console.warn('[Pruebas]', e); } }

  // Quitar la pantalla de carga (ver <head> de index.html) en el siguiente cuadro,
  // ya con el portal pintado
  requestAnimationFrame(() => document.documentElement.classList.remove('boot-inst'));

  // Renderizar tab inicial
  instSwitchTab('hoy');
}

// ── Navegación por tabs ───────────────────────
function instSwitchTab(tab) {
  document.querySelectorAll('.inst-tab-btn').forEach(t => {
    const isOn = t.dataset.t === tab;
    t.classList.toggle('on', isOn);
    // fallback para compatibilidad si aún existen .inst-tab viejos
    t.style.color = '';
    t.style.borderBottomColor = '';
  });
  // compatibilidad hacia atrás con .inst-tab (divs)
  document.querySelectorAll('.inst-tab').forEach(t => {
    const isOn = t.dataset.t === tab;
    t.style.color = isOn ? 'var(--neon)' : 'var(--txt2)';
    t.style.borderBottomColor = isOn ? 'var(--neon)' : 'transparent';
  });
  document.querySelectorAll('.inst-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('inst-panel-' + tab);
  if(panel) panel.style.display = 'block';

  if(tab === 'hoy')     instRenderHoy();
  if(tab === 'horario') instRenderHorario();
  if(tab === 'reporte') instRenderReporte();
  if(tab === 'firma')   instRenderFirmaTab();
  if(tab === 'mant' && typeof mantRenderTab === 'function') mantRenderTab();
  if(tab === 'pruebas' && typeof pruebasRenderTab === 'function') pruebasRenderTab();
}

// ── Cambio de periodo en reporte ──────────────
function instSelPeriodo(btn, dias) {
  _instPeriodoDias = parseInt(dias);
  document.querySelectorAll('.inst-periodo-pill,.inst-periodo-btn').forEach(b => {
    const isOn = b.dataset.p === String(dias);
    b.classList.toggle('on', isOn);
    // fallback estilos inline para .inst-periodo-btn antiguos
    if(b.classList.contains('inst-periodo-btn')) {
      b.style.background = isOn ? 'var(--verde)' : 'var(--panel2)';
      b.style.color = isOn ? '#fff' : 'var(--txt2)';
      b.style.borderColor = isOn ? 'var(--verde)' : 'var(--border)';
    }
  });
  instRenderReporte();
}

// ─────────────────────────────────────────────
// TAB 1: MIS CLASES HOY
// ─────────────────────────────────────────────
// Tarjeta de resumen con el mismo formato que Control Gerencia (etiqueta, número grande, nota)
function instKpi(label, valor, nota, color, cls) {
  return `<div class="ipg-kpi" style="--kc:${color||'var(--v2)'}">
    <span class="k-l">${label}</span><b class="${cls||''}">${valor}</b>${nota?`<em class="k-c">${nota}</em>`:''}
  </div>`;
}

// ── Navegación de fecha (flechas y "Hoy") ─────
function instNavDia(n) {
  const dp = document.getElementById('inst-date-picker');
  if(!dp) return;
  const base = dp.value || ((typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date()));
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + n);
  dp.value = fechaLocalStr(d);
  instRenderHoy();
}
function instIrHoy() {
  const dp = document.getElementById('inst-date-picker');
  if(dp) dp.value = (typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date());
  instRenderHoy();
}

// Clase en curso o la próxima de hoy (las clases duran 1 hora)
function instClaseAhora(clasesData) {
  const now = new Date(), m = now.getHours()*60 + now.getMinutes();
  const min = h => { const [a,b] = String(h||'').split(':').map(Number); return isNaN(a) ? null : a*60 + (b||0); };
  for(let i = 0; i < clasesData.length; i++) {
    const s = min(clasesData[i].slot.hora);
    if(s !== null && m >= s && m <= s + 60) return { idx:i, estado:'curso' };
  }
  for(let i = 0; i < clasesData.length; i++) {
    const s = min(clasesData[i].slot.hora);
    if(s !== null && s > m) return { idx:i, estado:'proxima' };
  }
  return null;
}

// ─────────────────────────────────────────────
// SUPLENCIAS PLANIFICADAS EN EL PORTAL
// Las que la coordinación aprueba en "Suplencias" (suplenciasPlan) aparecen
// en "Mis clases" y en "Mi horario" de los dos instructores:
//  · al suplente, como una clase extra: "Suplencia · cubres a …"
//  · al titular, en su propia clase: "Te cubre …"
// Solo se muestran; la captura de asistentes sigue igual.
// ─────────────────────────────────────────────
function instSupsAprobadas() {
  const lista = (typeof suplenciasPlan !== 'undefined' && Array.isArray(suplenciasPlan)) ? suplenciasPlan : [];
  return lista.filter(s => s && s.fecha && s.hora && (s.estado === 'aprobado' || !s.estado));
}
function instNombreDe(id, nombreExt) {
  const i = (id !== null && id !== undefined) ? instructores.find(x => String(x.id) === String(id)) : null;
  return i ? i.nombre : (nombreExt || 'Suplente externo');
}
// Suplencias en las que este instructor es el suplente, para una fecha
function instSupsQueCubro(instId, fecha) {
  return instSupsAprobadas()
    .filter(s => s.suplente_id !== null && s.suplente_id !== undefined && String(s.suplente_id) === String(instId) && s.fecha === fecha)
    .sort((a,b) => String(a.hora).localeCompare(String(b.hora)));
}
// Suplencia planificada para una clase propia (este instructor es el titular)
function instSupDeMiClase(instId, fecha, slot) {
  return instSupsAprobadas().find(s =>
    String(s.inst_id) === String(instId) && s.fecha === fecha && s.hora === slot.hora &&
    (!s.dia || s.dia === slot.dia)) || null;
}
// Renglón de una clase que este instructor cubre como suplente
function instLineaCubro(s, conFecha) {
  const f = conFecha ? new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}) : '';
  return `<div class="ipg-line ipg-sup" style="--ac:var(--blue)">
    <div class="t">${s.hora}</div>
    <div class="b"><b>${s.clase||'Clase'}</b><small>${conFecha?f+' · ':''}Cubres a ${instNombreDe(s.inst_id)}${s.motivo?' · '+s.motivo:''}</small></div>
    <div class="r"><span class="ipg-tag">Suplencia</span></div>
  </div>`;
}

function instRenderHoy() {
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const dp = document.getElementById('inst-date-picker');
  // "Hoy" sale del reloj del servidor (ver captura-prof.js) para que el teléfono
  // no pueda adelantar/atrasar el día en el que se permite capturar.
  const hoyReal  = (typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date());
  const fechaStr = dp && dp.value ? dp.value : hoyReal;
  const fecha = new Date(fechaStr + 'T12:00:00');
  const diaIdx = (fecha.getDay() + 6) % 7; // 0=Lun
  const diaStr = DIAS[diaIdx];
  const esHoy  = fechaStr === hoyReal;

  const tituloEl = document.getElementById('inst-hoy-titulo');
  const fechaEl  = document.getElementById('inst-hoy-fecha');
  if(tituloEl) tituloEl.textContent = esHoy ? 'Estas son tus clases de hoy. La que va según el horario aparece arriba.' : 'Estás viendo otro día.';
  if(fechaEl) {
    const t = fecha.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
    fechaEl.textContent = t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Clases del instructor para este día
  const slots = getHorarioEn(inst, fechaStr).filter(s => s.dia === diaStr).sort((a,b)=>a.hora.localeCompare(b.hora));

  const clasesData = slots.map(slot => {
    const regs = registros.filter(r =>
      String(r.inst_id) === String(inst.id) &&
      r.fecha === fechaStr && r.dia === slot.dia && r.hora === slot.hora
    );
    const reg = regs.length > 0 ? regs[regs.length-1] : null;
    const capN = (reg && parseInt(reg.cap) > 0) ? parseInt(reg.cap) : getCapClase(slot.clase);
    return { slot, reg, capN };
  });

  // KPIs
  const total      = clasesData.length;
  const registradas = clasesData.filter(c=>c.reg).length;
  const pendientes  = total - registradas;
  const totalAsis   = clasesData.filter(c=>c.reg&&(c.reg.estado==='ok'||c.reg.estado==='sub'))
                                 .reduce((a,c)=>a+(parseInt(c.reg.asistentes)||0), 0);

  const kpiEl = document.getElementById('inst-kpis-hoy');
  if(kpiEl) kpiEl.innerHTML =
    instKpi('Clases del día', total, 'programadas para ti', 'var(--blue)') +
    instKpi('Registradas', `${registradas}/${total}`, total && !pendientes ? 'Todo al día' : 'Faltan por registrar', 'var(--b1,#5fb336)', total && !pendientes ? 'ok' : '') +
    instKpi('Asistentes', totalAsis, 'en las clases del día', 'var(--v2)');

  // Lista de clases
  const listaEl = document.getElementById('inst-lista-clases');
  const ahoraEl = document.getElementById('inst-ahora');
  if(!listaEl) return;

  // Contexto para la tarjeta de captura (captura-prof.js)
  window._instHoyCtx = { fecha: fechaStr, items: clasesData };

  // "Ahora": clase en curso o próxima, con acceso directo a registrar asistentes
  const act = esHoy ? instClaseAhora(clasesData) : null;
  if(ahoraEl) ahoraEl.innerHTML = act ? (() => {
    const { slot, reg, capN } = clasesData[act.idx];
    return `<div class="ipg-h2">Ahora</div>
      <div class="ipg-hero">
        <div class="ipg-hero-t"><span>${act.estado==='curso'?'Clase en curso':'Próxima clase'}</span><b>${slot.clase}</b>
          <span>${slot.hora}${capN?' · cupo '+capN:''}</span></div>
        <button class="ipg-hero-b" onclick="instCapAbrir(${act.idx})">${reg?'Ver registro':'Registrar asistentes'}</button>
      </div>`;
  })() : '';

  // Clases que cubre como suplente ese día
  const cubro = instSupsQueCubro(inst.id, fechaStr);
  const cubroHtml = cubro.length
    ? `<div class="ipg-h2">Suplencias que cubres</div>${cubro.map(s => instLineaCubro(s, false)).join('')}`
    : '';

  if(clasesData.length === 0) {
    listaEl.innerHTML = (cubro.length
      ? `<div class="ipg-sub">No tienes clases propias este día.</div>`
      : `<div class="empty ipg-empty">No tienes clases programadas este día.</div>`) + cubroHtml;
    return;
  }

  listaEl.innerHTML = clasesData.map(({ slot, reg, capN }, idx) => {
    const tieneReg = !!reg;
    const estado   = reg ? reg.estado : 'pendiente';
    const asis     = tieneReg ? (parseInt(reg.asistentes)||0) : null;
    const afoP     = (tieneReg && capN > 0 && asis !== null) ? Math.round(asis/capN*100) : null;

    // Colores de estado (franja izquierda y texto de la derecha, como en Gerencia)
    const estadoMap = {
      ok:       { txt:'Impartida',     cls:'ok',   ac:'var(--v2)'   },
      sub:      { txt:'Con suplente',  cls:'info', ac:'var(--blue)' },
      falta:    { txt:'Falta',         cls:'bad',  ac:'var(--red2)' },
      pendiente:{ txt:'Pendiente',     cls:'warn', ac:'var(--gold2)'}
    };
    let est = estadoMap[estado] || estadoMap.pendiente;
    // Suplencia planificada: si todavía no hay registro, avisa quién lo cubre
    const plan = instSupDeMiClase(inst.id, fechaStr, slot);
    if(plan && !tieneReg) est = { txt:'Te cubren', cls:'info', ac:'var(--blue)' };

    const detalle = [
      tieneReg && asis !== null ? `${asis}${capN?' / '+capN:''} personas` : (capN ? `Cupo ${capN}` : ''),
      (reg && (reg.suplente_id || reg.suplente_nombre)) ? `Suplente: ${nombreSuplenteReg(reg)}`
        : plan ? `Te cubre: ${instNombreDe(plan.suplente_id, plan.suplente_nombre)}${plan.motivo?' · '+plan.motivo:''}` : ''
    ].filter(Boolean).join(' · ');

    return `
      <div class="inst-cap-card ipg-line" role="button" tabindex="0" onclick="instCapAbrir(${idx})"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();instCapAbrir(${idx})}"
           style="--ac:${est.ac}">
        <div class="t">${slot.hora}</div>
        <div class="b">
          <b>${slot.clase}</b>
          ${detalle ? `<small>${detalle}</small>` : ''}
          ${afoP !== null ? `<div class="ipg-bar"><i style="width:${Math.min(afoP,100)}%;background:${pctCol(afoP)}"></i></div>` : ''}
          ${reg && reg.obs ? `<small class="ipg-obs">${reg.obs}</small>` : ''}
          ${typeof instCapBadge === 'function' ? instCapBadge(reg, fechaStr, slot) : ''}
        </div>
        <div class="r"><span class="${est.cls}">${est.txt}${afoP!==null?'<br>'+afoP+'%':''}</span></div>
      </div>`;
  }).join('') + cubroHtml;
}

// ─────────────────────────────────────────────
// TAB: MI HORARIO (semana con fechas, igual que en Gerencia, más las
// suplencias planificadas de esa semana)
// ─────────────────────────────────────────────
let _instHorSemana = 0;   // 0 = esta semana, 1 = la próxima, -1 = la pasada
function instHorNav(n) { _instHorSemana = n === 0 ? 0 : _instHorSemana + n; instRenderHorario(); }

function instRenderHorario() {
  const inst = instructores.find(i => i.id === instActualId);
  const el = document.getElementById('inst-horario-semana');
  if(!inst || !el) return;
  const hoyReal = (typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date());
  const hoyD = new Date(hoyReal + 'T12:00:00');
  const lunes = new Date(hoyD);
  lunes.setDate(hoyD.getDate() - ((hoyD.getDay() + 6) % 7) + _instHorSemana * 7);
  const fechas = DIAS.map((_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return fechaLocalStr(d); });
  const fCorta = f => new Date(f + 'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'});

  // Próximas suplencias (desde hoy), las que cubre y las de sus clases
  const prox = instSupsAprobadas()
    .filter(s => s.fecha >= hoyReal && (String(s.inst_id) === String(inst.id) ||
      (s.suplente_id !== null && s.suplente_id !== undefined && String(s.suplente_id) === String(inst.id))))
    .sort((a,b) => a.fecha.localeCompare(b.fecha) || String(a.hora).localeCompare(String(b.hora)));
  const proxHtml = prox.length ? `<div class="ipg-card ipg-prox">
      <div class="ipg-prox-h"><b>Próximas suplencias</b><small>Planificadas por la coordinación</small></div>
      ${prox.slice(0, 8).map(s => {
        const cubro = String(s.inst_id) !== String(inst.id);
        const f = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
        return `<div class="ipg-prox-r${cubro?' cubro':''}"><span>${f} · ${s.hora}</span><b>${s.clase||'Clase'}</b>
          <em>${cubro ? 'Cubres a ' + instNombreDe(s.inst_id) : 'Te cubre ' + instNombreDe(s.suplente_id, s.suplente_nombre)}</em></div>`;
      }).join('')}
      ${prox.length > 8 ? `<small class="ipg-sub">y ${prox.length - 8} más.</small>` : ''}
    </div>` : '';

  const nav = `<div class="ipg-date">
      <button class="ipg-ibtn" onclick="instHorNav(-1)" aria-label="Semana anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,6 9,12 15,18"/></svg></button>
      <div class="ipg-date-lbl"><b>${_instHorSemana===0?'Esta semana':_instHorSemana===1?'Próxima semana':'Semana'} · ${fCorta(fechas[0])} al ${fCorta(fechas[6])}</b></div>
      <button class="ipg-ibtn" onclick="instHorNav(1)" aria-label="Semana siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg></button>
      <button class="ipg-btn-sm" onclick="instHorNav(0)">Hoy</button>
    </div>`;

  let hayAlgo = false;
  const dias = DIAS.map((dia, i) => {
    const fecha = fechas[i];
    const propias = getHorarioEn(inst, fecha).filter(s => s.dia === dia).map(s => {
      const plan = instSupDeMiClase(inst.id, fecha, s);
      const cap = getCapClase(s.clase);
      return { hora: s.hora, html: `<div class="ipg-line"${plan?' style="--ac:var(--blue)"':''}><div class="t">${s.hora}</div>
        <div class="b"><b>${s.clase}</b><small>${plan ? 'Te cubre: ' + instNombreDe(plan.suplente_id, plan.suplente_nombre) + (plan.motivo?' · '+plan.motivo:'') : (cap ? 'Cupo ' + cap : '')}</small></div>
        ${plan ? '<div class="r"><span class="info">Te cubren</span></div>' : ''}</div>` };
    });
    const cubro = instSupsQueCubro(inst.id, fecha).map(s => ({ hora: String(s.hora), html: instLineaCubro(s, false) }));
    const todas = propias.concat(cubro).sort((a,b) => a.hora.localeCompare(b.hora));
    if(todas.length) hayAlgo = true;
    const esHoy = fecha === hoyReal;
    return `<div class="ipg-h2 sm${esHoy?' hoy':''}">${dia} ${fCorta(fecha)}${esHoy?' · hoy':''}</div>` +
      (todas.length ? todas.map(x => x.html).join('') : '<div class="ipg-sub">Sin clases</div>');
  }).join('');

  el.innerHTML = proxHtml + nav + (hayAlgo || getHorarioEn(inst, hoyReal).length ? dias
    : '<div class="empty ipg-empty">Todavía no tienes clases asignadas. Pide a la coordinación que te las asigne.</div>');
}

// ─────────────────────────────────────────────
// TAB 2: MI REPORTE PERSONAL
// ─────────────────────────────────────────────
function instRenderReporte() {
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const hoyDate = new Date();
  const hoyStr  = fechaLocalStr(hoyDate);
  const desdeFecha = new Date(hoyDate);
  desdeFecha.setDate(desdeFecha.getDate() - _instPeriodoDias);
  const desdeStr = fechaLocalStr(desdeFecha);

  // Filtrar registros del instructor en el periodo
  const misRegs = registros.filter(r =>
    String(r.inst_id) === String(inst.id) &&
    r.fecha >= desdeStr && r.fecha <= hoyStr
  ).sort((a,b) => b.fecha.localeCompare(a.fecha));

  const impartidas = misRegs.filter(r => r.estado==='ok' || r.estado==='sub');
  const faltas     = misRegs.filter(r => r.estado==='falta');
  const conAfor    = impartidas.filter(r => parseInt(r.cap||0)>0);
  const aforProm   = conAfor.length > 0
    ? Math.round(conAfor.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/conAfor.length)
    : null;
  const totalAsis  = impartidas.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);

  // KPIs
  const kpisEl = document.getElementById('inst-rep-kpis');
  if(kpisEl) kpisEl.innerHTML =
    instKpi('Clases impartidas', impartidas.length, 'en el periodo', 'var(--v2)') +
    instKpi('Faltas', faltas.length, faltas.length ? 'revisa con coordinación' : 'sin faltas', faltas.length ? 'var(--red2)' : 'var(--b1,#5fb336)', faltas.length ? 'bad' : 'ok') +
    instKpi('Total asistentes', totalAsis, 'personas atendidas', 'var(--blue)') +
    instKpi('Aforo promedio', aforProm!==null ? aforProm+'%' : '—', 'del cupo de tus clases', aforProm!==null ? pctCol(aforProm) : 'var(--txt3)');

  // Gráfica: aforo por clase (agrupar)
  const claseStats = {};
  impartidas.forEach(r => {
    if(!r.clase) return;
    if(!claseStats[r.clase]) claseStats[r.clase] = { total:0, cap:0, count:0 };
    if(parseInt(r.cap||0)>0) {
      claseStats[r.clase].total += (parseInt(r.asistentes)||0);
      claseStats[r.clase].cap   += parseInt(r.cap);
      claseStats[r.clase].count++;
    }
  });
  const claseLabels = Object.keys(claseStats).filter(k => claseStats[k].count>0);
  const claseAforos = claseLabels.map(k => claseStats[k].cap>0 ? Math.round(claseStats[k].total/claseStats[k].cap*100) : 0);

  const canvas = document.getElementById('inst-rep-chart');
  if(canvas && claseLabels.length > 0) {
    if(_instRepChart) _instRepChart.destroy();
    _instRepChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: claseLabels,
        datasets: [{
          label: 'Aforo %',
          data: claseAforos,
          backgroundColor: claseAforos.map(v => v>=75?'rgba(94,255,160,.7)':v>=30?'rgba(232,184,75,.7)':'rgba(224,80,80,.7)'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false } },
        scales: {
          y: { beginAtZero:true, max:100, ticks:{ color:'#7aaa90', font:{size:10} }, grid:{ color:'rgba(255,255,255,.06)' } },
          x: { ticks:{ color:'#7aaa90', font:{size:10} }, grid:{ display:false } }
        }
      }
    });
  } else if(canvas) {
    if(_instRepChart) _instRepChart.destroy();
    const wrap = document.getElementById('inst-rep-chart-wrap');
    if(wrap) wrap.innerHTML = '<div class="empty">Sin datos suficientes en este periodo.</div>';
  }

  // Tabla de historial
  const tbEl = document.getElementById('inst-rep-tabla');
  if(!tbEl) return;
  if(misRegs.length === 0) {
    tbEl.innerHTML = `<tr><td colspan="6" class="empty">Sin registros en este periodo.</td></tr>`;
    return;
  }
  tbEl.innerHTML = misRegs.slice(0,50).map(r => {
    const fd = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    const asis = parseInt(r.asistentes)||0;
    const cap  = parseInt(r.cap)||0;
    const afo  = cap>0 ? Math.round(asis/cap*100) : null;
    const estMap = { ok:'<span class="chip cok">✔ Impartida</span>', sub:'<span class="chip" style="background:rgba(77,184,232,.12);color:var(--blue)">⇄ Suplente</span>', falta:'<span class="chip cbd">✖ Falta</span>' };
    return `<tr>
      <td class="mono" style="font-size:.74rem;color:var(--txt2)">${fd}</td>
      <td><strong style="font-size:.8rem">${r.clase||'—'}</strong></td>
      <td class="mono" style="font-size:.72rem;color:var(--gold2)">${r.hora||'—'}</td>
      <td class="mono" style="text-align:center">${r.estado!=='falta'?asis:'—'}</td>
      <td>${afo!==null?`<span style="color:${pctCol(afo)};font-family:'DM Mono',monospace;font-size:.74rem;font-weight:700">${afo}%</span>`:'<span style="color:var(--txt3)">—</span>'}</td>
      <td>${estMap[r.estado]||'—'}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
// TAB 3: FIRMA DIGITAL
// ─────────────────────────────────────────────
const INST_FIRMA_KEY = 'fc_hoja_firmas_activa';

function instCargarHojaFirmas() {
  try {
    const data = localStorage.getItem(INST_FIRMA_KEY);
    _instFirmaHojaActiva = data ? JSON.parse(data) : null;
  } catch(e) { _instFirmaHojaActiva = null; }

  // Actualizar badge en header
  const badge = document.getElementById('inst-firma-badge');
  if(!badge) return;
  if(_instFirmaHojaActiva) {
    const firmas = _instFirmaHojaActiva.firmas || {};
    const yafirme = firmas[String(instActualId)] && firmas[String(instActualId)].data;
    badge.style.display = yafirme ? 'none' : 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function instRenderFirmaTab() {
  instCargarHojaFirmas();
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const sinHoja = document.getElementById('inst-firma-sin-hoja');
  const activa  = document.getElementById('inst-firma-activa');

  if(!_instFirmaHojaActiva) {
    sinHoja.style.display = 'block';
    activa.style.display  = 'none';
    return;
  }

  sinHoja.style.display = 'none';
  activa.style.display  = 'block';

  // ── Tabla de clases del periodo ──
  const tablaEl = document.getElementById('inst-firma-clases-tabla');
  if(tablaEl) {
    const semIni = _instFirmaHojaActiva.semIni || '';
    const semFin = _instFirmaHojaActiva.semFin || '';
    const inst   = instructores.find(i => i.id === instActualId);
    const misRegs = inst ? registros.filter(r =>
      String(r.inst_id) === String(inst.id) && r.fecha >= semIni && r.fecha <= semFin
    ).sort((a,b) => a.fecha.localeCompare(b.fecha) || (a.hora||'').localeCompare(b.hora||'')) : [];

    if(misRegs.length === 0) {
      tablaEl.innerHTML = '<div class="empty" style="padding:.8rem;font-size:.72rem">Sin clases registradas en este periodo.</div>';
    } else {
      // Agrupar por clase única (dedup por dia+hora+clase)
      const vistos = new Set();
      const unicos = misRegs.filter(r => {
        const k = `${r.dia}|${r.hora}|${r.clase}`;
        if(vistos.has(k)) return false;
        vistos.add(k); return true;
      });

      const total  = misRegs.filter(r => r.estado==='ok'||r.estado==='sub').length;
      const faltas = misRegs.filter(r => r.estado==='falta').length;
      const conAf  = misRegs.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0)>0);
      const aforProm = conAf.length > 0
        ? Math.round(conAf.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/conAf.length)
        : null;

      tablaEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">
          <div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--neon)">${total}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Impartidas</div>
          </div>
          <div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${faltas>0?'var(--red2)':'var(--neon)'}">${faltas}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Faltas</div>
          </div>
          <div style="padding:.5rem .7rem;text-align:center">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${aforProm!==null?pctCol(aforProm):'var(--txt3)'}">${aforProm!==null?aforProm+'%':'—'}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Aforo prom.</div>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;font-size:.72rem;border-collapse:collapse">
            <thead>
              <tr style="background:var(--panel)">
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Fecha</th>
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Clase</th>
                <th style="padding:5px 8px;text-align:center;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Asist.</th>
                <th style="padding:5px 8px;text-align:center;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Aforo</th>
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${misRegs.map(r => {
                const fd = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
                const asis = parseInt(r.asistentes)||0;
                const cap  = parseInt(r.cap)||0;
                const afo  = cap>0 ? Math.round(asis/cap*100) : null;
                const estCol = r.estado==='ok'?'var(--neon)':r.estado==='falta'?'var(--red2)':'var(--blue)';
                const estTxt = r.estado==='ok'?'✔':r.estado==='falta'?'✖':'⇄';
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:5px 8px;color:var(--txt2)">${fd}</td>
                  <td style="padding:5px 8px;font-weight:600">${r.clase||'—'}<br><span style="font-size:.58rem;color:var(--txt3);font-weight:400">${r.hora||''}</span></td>
                  <td style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace">${r.estado!=='falta'?asis:'—'}</td>
                  <td style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace;color:${afo!==null?pctCol(afo):'var(--txt3)'}">${afo!==null?afo+'%':'—'}</td>
                  <td style="padding:5px 8px;color:${estCol};font-weight:700">${estTxt}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }
  }

  // Info de la hoja
  const semLbl = document.getElementById('inst-firma-semana-lbl');
  if(semLbl) {
    const ini = _instFirmaHojaActiva.semIni || '';
    const fin = _instFirmaHojaActiva.semFin || '';
    const enc = _instFirmaHojaActiva.encabezado || '';
    let txt = enc || '';
    if(ini && fin) {
      const dI = new Date(ini+'T12:00:00');
      const dF = new Date(fin+'T12:00:00');
      txt = (enc ? enc + ' · ' : '') + `Semana del ${dI.toLocaleDateString('es-MX',{day:'numeric',month:'short'})} al ${dF.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}`;
    }
    semLbl.textContent = txt;
  }

  // Info instructor
  const avatarEl = document.getElementById('inst-firma-avatar');
  const nombreEl = document.getElementById('inst-firma-nombre-lbl');
  const estadoEl = document.getElementById('inst-firma-estado-lbl');
  const chipEl   = document.getElementById('inst-firma-chip');

  const iniciales = inst.nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  if(avatarEl) {
    if(inst.foto) {
      avatarEl.innerHTML = `<img src="${inst.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      avatarEl.style.background = 'transparent';
    } else {
      avatarEl.textContent = iniciales;
      avatarEl.style.background = '';
    }
  }
  if(nombreEl) nombreEl.textContent = inst.nombre;

  const firmas = _instFirmaHojaActiva.firmas || {};
  const misFirma = firmas[String(instActualId)];
  const firmado  = misFirma && misFirma.data;

  if(estadoEl) estadoEl.textContent = firmado ? '✔ Firmado el ' + (new Date(misFirma.ts).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})) : 'Sin firma';
  if(chipEl) {
    chipEl.textContent    = firmado ? '✔ Firmado' : '✖ Sin firmar';
    chipEl.style.background = firmado ? 'rgba(94,255,160,.15)' : 'rgba(224,80,80,.15)';
    chipEl.style.color      = firmado ? 'var(--neon)'          : 'var(--red2)';
  }

  // Actualizar botón borrar del canvas según estado
  const btnBorrar = document.getElementById('inst-canvas-borrar-btn');
  if(btnBorrar) {
    if(firmado) {
      btnBorrar.textContent = '✖ Borrar firma guardada';
      btnBorrar.style.borderColor = 'var(--red)';
      btnBorrar.style.color = 'var(--red2)';
      btnBorrar.title = 'Eliminar tu firma guardada para volver a firmar';
    } else {
      btnBorrar.textContent = '↺ Limpiar';
      btnBorrar.style.borderColor = 'var(--border)';
      btnBorrar.style.color = 'var(--txt3)';
      btnBorrar.title = '';
    }
  }

  // Actualizar botón guardar según estado
  const btnGuardar = document.getElementById('inst-guardar-btn');
  if(btnGuardar) {
    btnGuardar.style.opacity = firmado ? '0.5' : '1';
    btnGuardar.style.pointerEvents = firmado ? 'none' : 'auto';
    btnGuardar.textContent = firmado ? '✔ Firma guardada' : '✔ Guardar Firma';
  }

  // Inicializar canvas
  setTimeout(() => instInicializarCanvas(firmado ? misFirma.data : null), 100);
}

function instInicializarCanvas(dataUrl) {
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas) return;
  const wrap = document.getElementById('inst-firma-canvas-wrap');

  // Dimensionar
  const w = wrap ? wrap.clientWidth : 340;
  canvas.width  = w;
  canvas.height = 200;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Si ya hay firma guardada, mostrarla
  if(dataUrl) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = dataUrl;
  }

  _instFirmaCtx     = ctx;
  _instFirmaDrawing = false;

  // Quitar listeners viejos clonando
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const c = document.getElementById('inst-firma-canvas');
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, c.width, c.height);
  if(dataUrl) { const img=new Image(); img.onload=()=>cx.drawImage(img,0,0); img.src=dataUrl; }
  _instFirmaCtx = cx;

  // Si ya hay firma guardada, bloquear el dibujo (solo lectura)
  const _canvasReadOnly = !!dataUrl;
  c.style.cursor = _canvasReadOnly ? 'not-allowed' : 'crosshair';
  c.style.opacity = _canvasReadOnly ? '0.85' : '1';

  // Mouse
  c.addEventListener('mousedown', e => { if(_canvasReadOnly) return; _instFirmaDrawing=true; cx.beginPath(); const r=c.getBoundingClientRect(); cx.moveTo(e.clientX-r.left, e.clientY-r.top); });
  c.addEventListener('mousemove', e => { if(_instFirmaDrawing && !_canvasReadOnly) { const r=c.getBoundingClientRect(); cx.lineWidth=2.5; cx.lineCap='round'; cx.strokeStyle='#1a1a1a'; cx.lineTo(e.clientX-r.left, e.clientY-r.top); cx.stroke(); } });
  c.addEventListener('mouseup',   () => _instFirmaDrawing = false);
  c.addEventListener('mouseleave',() => _instFirmaDrawing = false);

  // Touch
  c.addEventListener('touchstart', e => { if(_canvasReadOnly) return; e.preventDefault(); _instFirmaDrawing=true; cx.beginPath(); const r=c.getBoundingClientRect(); const t=e.touches[0]; cx.moveTo(t.clientX-r.left, t.clientY-r.top); }, {passive:false});
  c.addEventListener('touchmove',  e => { e.preventDefault(); if(!_instFirmaDrawing || _canvasReadOnly) return; const r=c.getBoundingClientRect(); const t=e.touches[0]; cx.lineWidth=2.5; cx.lineCap='round'; cx.strokeStyle='#1a1a1a'; cx.lineTo(t.clientX-r.left, t.clientY-r.top); cx.stroke(); }, {passive:false});
  c.addEventListener('touchend',   () => _instFirmaDrawing = false);
}

function instLimpiarFirma() {
  // Si ya hay firma guardada → pedir confirmación y borrarla
  const firmas = _instFirmaHojaActiva ? (_instFirmaHojaActiva.firmas || {}) : {};
  const misFirma = firmas[String(instActualId)];
  if(misFirma && misFirma.data) {
    instBorrarFirmaGuardada();
    return;
  }
  // Si no hay firma guardada → solo limpiar el canvas
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas || !_instFirmaCtx) return;
  _instFirmaCtx.fillStyle = '#ffffff';
  _instFirmaCtx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Borrar firma ya guardada (con confirmación) ───────────────────────
function instBorrarFirmaGuardada() {
  if(!_instFirmaHojaActiva) return;
  const inst = instructores.find(i => i.id === instActualId);
  const nombre = inst ? inst.nombre.split(' ')[0] : 'tu firma';
  if(!confirm(`¿Borrar la firma guardada de ${nombre}?\nPodrás volver a firmar.`)) return;

  const instId = String(instActualId);
  const tsAhora = new Date().toISOString();

  // Eliminar firma del objeto en memoria
  if(_instFirmaHojaActiva.firmas) {
    delete _instFirmaHojaActiva.firmas[instId];
  }
  // Registrar timestamp de borrado — el listener de Firebase NO sobreescribirá
  // una firma que fue borrada intencionalmente después de ese timestamp
  if(!_instFirmaHojaActiva.firmasBorradas) _instFirmaHojaActiva.firmasBorradas = {};
  _instFirmaHojaActiva.firmasBorradas[instId] = tsAhora;

  // Persistir en localStorage con el registro de borrado
  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(_instFirmaHojaActiva)); } catch(e){}

  // Subir DIRECTAMENTE a Firebase (no via sincronizarFirebase que puede estar bloqueado)
  (async () => {
    try {
      if(typeof fbDb !== 'undefined' && fbDb) {
        // Actualizar solo la hoja en Firebase, sin tocar el resto del payload
        await fbDb.ref('fitness/hojaFirmasActiva').set(_instFirmaHojaActiva);
        console.log('🗑 Firma borrada y subida a Firebase');
      } else if(typeof sincronizarFirebase === 'function') {
        setTimeout(sincronizarFirebase, 300);
      }
    } catch(e) {
      console.warn('Error al borrar firma en Firebase:', e.message);
      if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 500);
    }
  })();

  // Refrescar UI — canvas limpio y habilitado
  instRenderFirmaTab();
  if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
  showToast('Firma eliminada. Ya puedes volver a firmar.', 'info');
  registrarLog('instructor', `Firma eliminada: ${inst?.nombre||'—'}`);
}

function instGuardarFirma() {
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas) return;

  // Verificar que hay algo dibujado
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let hayTrazo = false;
  for(let i=0; i<data.length; i+=4) {
    if(data[i]<240 || data[i+1]<240 || data[i+2]<240) { hayTrazo=true; break; }
  }
  if(!hayTrazo) { showToast('Por favor firma antes de guardar','warn'); return; }

  if(!_instFirmaHojaActiva) return;

  const dataUrl = canvas.toDataURL('image/png');
  if(!_instFirmaHojaActiva.firmas) _instFirmaHojaActiva.firmas = {};
  _instFirmaHojaActiva.firmas[String(instActualId)] = {
    data: dataUrl,
    nombre: instructores.find(i=>i.id===instActualId)?.nombre || '—',
    ts: new Date().toISOString()
  };

  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(_instFirmaHojaActiva)); } catch(e){}

  // ── Subir firma a Firebase SOLO si la hoja sigue activa en Firebase ──────
  // Esto evita que una hoja "fantasma" (ya cerrada por coordinación pero aún
  // en localStorage del instructor) se regenere al guardar la firma.
  (async () => {
    let hojaValidaEnFirebase = false;
    try {
      if(typeof fbDb !== 'undefined' && fbDb) {
        const snap = await fbDb.ref('fitness/hojaFirmasActiva').once('value');
        const fbHoja = snap.val();
        if(fbHoja && fbHoja.semIni === _instFirmaHojaActiva.semIni
                  && fbHoja.semFin === _instFirmaHojaActiva.semFin) {
          hojaValidaEnFirebase = true;
        } else if(fbHoja === null || fbHoja === undefined) {
          // Coordinador ya cerró la hoja — limpiar localStorage del instructor
          localStorage.removeItem(INST_FIRMA_KEY);
          _instFirmaHojaActiva = null;
          instCargarHojaFirmas();
          instRenderFirmaTab();
          showToast('La hoja fue cerrada por coordinación. Tu firma no pudo guardarse.', 'warn');
          return;
        }
      } else {
        // Sin Firebase — confiar en localStorage
        hojaValidaEnFirebase = true;
      }
    } catch(e) {
      // Error de red — subir de todos modos (modo offline)
      hojaValidaEnFirebase = true;
    }

    if(hojaValidaEnFirebase && typeof sincronizarFirebase === 'function') {
      setTimeout(sincronizarFirebase, 300);
    }

    // Actualizar UI
    instRenderFirmaTab();
    instCargarHojaFirmas();
    coordActualizarHojaActiva();
    showToast('✔ Firma guardada correctamente','ok');
    registrarLog('instructor', `Firma digital registrada: ${instructores.find(i=>i.id===instActualId)?.nombre||'—'}`);
  })();
}

function instAbrirFirma() {
  instSwitchTab('firma');
}

// ─────────────────────────────────────────────
// POLLING AUTOMÁTICO — revisar hoja cada 10s mientras instructor está en tab firma
// ─────────────────────────────────────────────
let _instPollTimer = null;

function instIniciarPoll() {
  instPararPoll();
  _instPollTimer = setInterval(() => {
    const anteriorTenia = !!_instFirmaHojaActiva;
    instCargarHojaFirmas();
    const ahoraTiene = !!_instFirmaHojaActiva;

    const panel = document.getElementById('inst-panel-firma');
    const panelVisible = panel && panel.style.display !== 'none';

    // Hoja apareció → notificar si el tab está visible
    if(!anteriorTenia && ahoraTiene && panelVisible) {
      instRenderFirmaTab();
      showToast('\u270d Hoja de firmas disponible \u2014 ya puedes firmar', 'ok');
    }
    // Hoja desapareció (coordinador la cerró) → actualizar UI siempre
    if(anteriorTenia && !ahoraTiene) {
      _instFirmaHojaActiva = null;
      if(panelVisible) instRenderFirmaTab();
      showToast('La hoja de firmas fue cerrada por coordinación.', 'info');
    }
  }, 5000); // Reducido a 5s para detectar cierres más rápido
}

function instPararPoll() {
  if(_instPollTimer) { clearInterval(_instPollTimer); _instPollTimer = null; }
}

// ─────────────────────────────────────────────
// COORDINADOR — Indicador de hoja activa en modal de reportes
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// COORDINADOR — Indicador de hoja activa en modal de reportes
// ─────────────────────────────────────────────
function coordCerrarHojaActiva() {
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(!hoja) return;
    const firmados = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
    const msg = firmados > 0
      ? `¿Cerrar la hoja activa?\n\nTiene ${firmados} firma(s) guardadas.\nAsegúrate de haber generado el PDF antes de cerrarla.\n\n¿Confirmar cierre?`
      : '¿Cerrar la hoja activa para poder generar una nueva?';
    if(!confirm(msg)) return;
  } catch(e){}
  localStorage.removeItem('fc_hoja_firmas_activa');
  coordActualizarHojaActiva();
  // ── Sincronizar el cierre a Firebase (la hoja desaparecerá en todos los dispositivos) ──
  if(typeof sincronizarFirebase === 'function') {
    setTimeout(sincronizarFirebase, 500);
  }
  showToast('Hoja cerrada. Ya puedes generar una nueva.', 'info');
}

function coordActualizarHojaActiva() {
  const infoEl = document.getElementById('coord-hoja-activa-info');
  const txtEl  = document.getElementById('coord-hoja-activa-txt');
  const progEl = document.getElementById('coord-hoja-activa-prog');
  const btnFirmas = document.querySelector('[onclick="abrirFirmasDigitales()"]');
  if(!infoEl) return;
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(!hoja) {
      infoEl.style.display = 'none';
      if(btnFirmas) {
        btnFirmas.style.opacity = '';
        btnFirmas.title = '';
      }
      return;
    }
    infoEl.style.display = 'block';
    const firmas = hoja.firmas || {};
    const firmados = Object.values(firmas).filter(f => f && f.data).length;
    const regsDelPer = (typeof registros !== 'undefined')
      ? [...new Set(registros.filter(r=>r.fecha>=(hoja.semIni||'')&&r.fecha<=(hoja.semFin||'')).map(r=>r.inst_id))]
      : [];
    const total = Math.max(regsDelPer.length, firmados, Object.keys(firmas).length);
    const semTxt = hoja.encabezado || (hoja.semIni ? `${hoja.semIni} → ${hoja.semFin}` : 'Semana activa');
    if(txtEl) txtEl.innerHTML = `✍ Hoja activa · <strong style="color:var(--neon)">${semTxt}</strong>`;
    if(progEl) {
      progEl.textContent = total > 0 ? `${firmados}/${total} firmados` : `${firmados} firmados`;
      progEl.style.color = (total > 0 && firmados >= total) ? 'var(--neon)' : 'var(--gold2)';
    }
    // Resaltar el botón de firmas digitales si hay hoja activa con firmas
    if(btnFirmas && firmados > 0) {
      btnFirmas.title = `Hoja activa: ${firmados} firma(s) — se acumularán al abrir la misma semana`;
    }
  } catch(e) { if(infoEl) infoEl.style.display = 'none'; }
}

// Actualizar indicador periódicamente y al iniciar
setInterval(coordActualizarHojaActiva, 8000);
setTimeout(coordActualizarHojaActiva, 1500);

// ─────────────────────────────────────────────
// COORDINADOR: Generar / Publicar hoja de firmas
// Se llama desde el modal de reportes al elegir "Firmas digitales"
// Expone la hoja para que los instructores puedan firmar desde su portal
// ─────────────────────────────────────────────
function instPublicarHojaFirmas(semIni, semFin, encabezado) {
  // Recuperar firmas previas si ya existe hoja para la misma semana
  let prevFirmas = {};
  try {
    const prev = JSON.parse(localStorage.getItem(INST_FIRMA_KEY)||'null');
    if(prev && prev.semIni === semIni && prev.semFin === semFin) {
      prevFirmas = prev.firmas || {};
    }
  } catch(e){}

  // También cargar firmas del almacén del coordinador para el mismo periodo
  try {
    const fcKey = `fc_firmas_${(semIni||'').replace(/-/g,'')}__${(semFin||'').replace(/-/g,'')}`;
    const raw = localStorage.getItem(fcKey);
    if(raw) {
      const saved = JSON.parse(raw);
      Object.entries(saved).forEach(([instId, dataUrl]) => {
        if(dataUrl && !prevFirmas[instId]) {
          prevFirmas[instId] = { data: dataUrl, nombre: instructores.find(i=>i.id===parseInt(instId))?.nombre||'—', ts: new Date().toISOString(), fromCoord: true };
        }
      });
    }
  } catch(e){}

  const hoja = { semIni, semFin, encabezado, firmas: prevFirmas, publicado: new Date().toISOString() };
  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(hoja)); } catch(e){}
  // Actualizar indicador coordinador
  setTimeout(coordActualizarHojaActiva, 100);
  // ── Subir a Firebase para que instructores en otros dispositivos la vean ──
  if(typeof sincronizarFirebase === 'function') {
    setTimeout(sincronizarFirebase, 500);
  }
  // No mostrar toast aquí porque ya se llama al abrir el modal de firmas
}

// ─────────────────────────────────────────────
// Gancho en el modal de firmas digitales del coordinador:
// Cuando se genera el PDF, también publica la hoja activa
// ─────────────────────────────────────────────
const _origGenerarPDFFirmas = window.generarPDFFirmas;
window.generarPDFFirmasConPublicacion = function(semIni, semFin, encabezado) {
  instPublicarHojaFirmas(semIni, semFin, encabezado);
  if(typeof _origGenerarPDFFirmas === 'function') _origGenerarPDFFirmas();
};

