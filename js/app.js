// ═══ INIT ═══
toggleRpt();
actualizarSelectoresClase();
initDiagClases();
// renderAll() y renderCal() se llaman desde init() después de cargarLocal()
// para evitar pantalla verde sin datos al primer arranque

// ═══════════════════════════════════════════
// SALONES — CAPACIDAD POR SALÓN
// ═══════════════════════════════════════════

function getCapClase(nombreClase) {
  const salon = salones.find(s => s.clases && s.clases.some(c => c.toLowerCase() === nombreClase.toLowerCase()));
  return salon ? salon.cap : 20;
}

function getTipoIcon(tipo) {
  const icons = {salon:'<svg class="ico" viewBox="0 0 20 20"><line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="2" y="8" width="2.5" height="4" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="5" y="7" width="2.5" height="6" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="12.5" y="7" width="2.5" height="6" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="15.5" y="8" width="2.5" height="4" rx="0.8" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/></svg>️',spinning:'<svg class="ico" viewBox="0 0 20 20"><circle cx="5" cy="14" r="3.5" stroke="currentColor" stroke-width="1.3" fill="none"/><circle cx="15" cy="14" r="3.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M5 14 L8 8 L12 8 L15 14 M8 8 L10 5" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="5" r="1" fill="currentColor"/></svg>',yoga:'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M10 6 L10 12 M10 8 L7 10 M10 8 L13 10 M10 12 L8 16 M10 12 L12 16" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',funcional:'<svg class="ico" viewBox="0 0 20 20"><path d="M12 4 Q16 5 15 9 L14 11 Q15 14 13 16 Q10 18 7 15 L5 12 Q3 9 6 7 L9 8 L11 5 Z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>',cardio:'<svg class="ico" viewBox="0 0 20 20"><circle cx="12" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M12 6 L10 10 L7 13 M10 10 L13 13 L15 17 M12 6 L14 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',piscina:'<svg class="ico" viewBox="0 0 20 20"><circle cx="13" cy="5" r="1.8" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M3 10 Q7 7 10 10 Q13 13 17 10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M3 14 Q7 11 10 14 Q13 17 17 14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13 7 L10 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',exterior:'<svg class="ico" viewBox="0 0 20 20"><path d="M5 16 Q8 8 16 4 Q14 12 8 15 Z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="5" y1="16" x2="12" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',multiusos:'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
  return icons[tipo] || '<svg class="ico" viewBox="0 0 20 20"><path d="M3 10 L10 3 L17 10 L17 17 L3 17 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><rect x="7.5" y="12" width="5" height="5" rx="0.5" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>';
}
function getTipoLabel(tipo) {
  const labels = {salon:'Salón general',spinning:'Estudio Spinning',yoga:'Sala Yoga / Pilates',funcional:'Área Funcional',cardio:'Sala Cardio',piscina:'Piscina / Alberca',exterior:'Área exterior',multiusos:'Multiusos'};
  return labels[tipo] || tipo;
}

function renderSalones() {
  document.getElementById('salones-body').innerHTML = salones.length === 0
    ? '<div class="empty">Sin salones configurados. Agrega uno con el botón "+" arriba.</div>'
    : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.8rem">
      ${salones.map(s => {
        const clasesUso = s.clases||[];
        return `<div class="rec-card" style="cursor:pointer;border:1px solid var(--border);transition:border-color .2s" onmouseover="this.style.borderColor='var(--v3)'" onmouseout="this.style.borderColor='var(--border)'" onclick="abrirModalSalon(${s.id})">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
            <div style="font-size:1.6rem">${getTipoIcon(s.tipo)}</div>
            <span class="chip cpl" style="font-size:.68rem">${s.cap} personas</span>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--neon);letter-spacing:1px">${s.nombre}</div>
          <div style="font-size:.68rem;color:var(--txt2);margin-top:1px">${getTipoLabel(s.tipo)}</div>
          ${s.desc?`<div style="font-size:.65rem;color:var(--txt3);margin-top:3px;font-style:italic">${s.desc}</div>`:''}
          <div style="margin-top:.5rem;font-size:.68rem;color:${clasesUso.length>0?'var(--txt2)':'var(--txt3)'}">
            ${clasesUso.length>0
              ? clasesUso.slice(0,4).map(c=>`<span style="display:inline-block;background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin:1px;font-size:.63rem">${c}</span>`).join('')+(clasesUso.length>4?`<span style="color:var(--txt3);font-size:.63rem"> +${clasesUso.length-4} más</span>`:'')
              : 'Sin clases asignadas — clic para editar'}
          </div>
          <div style="margin-top:.5rem;font-size:.62rem;color:var(--txt3);text-align:right"><svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg> Editar</div>
        </div>`;
      }).join('')}
    </div>`;

  // Tabla de asignación clase → salón
  const todasClases = [...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))].sort();
  const rows = todasClases.map(clase => {
    const salon = salones.find(s=>s.clases&&s.clases.some(c=>c.toLowerCase()===clase.toLowerCase()));
    const cap = salon ? salon.cap : 20;
    const col = salon ? 'var(--neon)' : 'var(--txt3)';
    const badge = !salon ? `<span style="font-size:.6rem;background:rgba(224,80,80,.15);color:var(--red2);border-radius:4px;padding:1px 5px;margin-left:4px">Sin salón → cap. 20 por defecto</span>` : '';
    return `<div class="arow">
      <div class="adot" style="background:${col}"></div>
      <span style="flex:1;font-size:.83rem">${clase}</span>
      <span style="font-size:.75rem;color:var(--txt2)">${salon?salon.nombre:'<span style="color:var(--txt3)">Sin salón asignado</span>'}${badge}</span>
      <span class="mono" style="color:${col};font-size:.77rem;margin-left:.5rem">${cap}p</span>
    </div>`;
  }).join('');
  document.getElementById('asignacion-body').innerHTML = rows || '<div class="empty">Sin clases en horarios aún</div>';
}

// Lista de clases extra agregadas manualmente al modal (que no están en horarios)
let msClasesExtra = [];

function toggleTipoCustom() {
  const val = document.getElementById('ms-tipo').value;
  const campo = document.getElementById('ms-tipo-custom');
  campo.style.display = val === 'otro' ? 'block' : 'none';
  if(val === 'otro') campo.focus();
}

function renderCheckboxesClases(clasesSeleccionadas) {
  // Clases de horarios + extras guardadas en el salón + las que se agregan ahora
  const deHorarios = [...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))].sort();
  const todasVisible = [...new Set([...deHorarios, ...msClasesExtra, ...clasesSeleccionadas])].sort();
  document.getElementById('ms-clases-check').innerHTML = todasVisible.map(c => {
    const checked = clasesSeleccionadas.includes(c);
    const esExtra = !deHorarios.includes(c);
    return `<label style="display:flex;align-items:center;gap:5px;font-size:.75rem;cursor:pointer;padding:3px 4px;border-radius:4px;${checked?'background:var(--panel);':''}" title="${esExtra?'Clase agregada manualmente':''}">
      <input type="checkbox" value="${c}" ${checked?'checked':''} style="accent-color:var(--verde)">
      <span>${c}</span>
      ${esExtra?`<span style="font-size:.58rem;color:var(--txt3)">✚</span>`:''}
    </label>`;
  }).join('');
}

function agregarClaseAlSalon() {
  const inp = document.getElementById('ms-clase-nueva');
  const nombre = inp.value.trim();
  if(!nombre){inp.focus();return;}
  // Obtener clases ya marcadas antes de redibujar
  const yaSeleccionadas = [...document.querySelectorAll('#ms-clases-check input:checked')].map(c=>c.value);
  if(!msClasesExtra.includes(nombre)) msClasesExtra.push(nombre);
  renderCheckboxesClases([...new Set([...yaSeleccionadas, nombre])]);
  inp.value = '';
  inp.focus();
}

function seleccionarTodasClasesSalon() {
  document.querySelectorAll('#ms-clases-check input[type=checkbox]').forEach(cb=>cb.checked=true);
}

function abrirModalSalon(id) {
  const salon = id ? salones.find(s=>s.id===id) : null;
  msClasesExtra = []; // reset

  document.getElementById('ms-ttl').innerHTML = salon ? '<svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg> Editar Salón' : '+ Nuevo Salón';
  document.getElementById('ms-id').value = id||'';
  document.getElementById('ms-nombre').value = salon ? salon.nombre : '';
  document.getElementById('ms-cap').value = salon ? salon.cap : 20;
  document.getElementById('ms-desc').value = salon ? (salon.desc||'') : '';
  document.getElementById('ms-clase-nueva').value = '';
  document.getElementById('ms-del').style.display = salon ? 'block' : 'none';

  // Tipo: detectar si es predefinido o personalizado
  const tiposPredefinidos = ['salon','spinning','yoga','funcional','cardio','piscina','exterior','multiusos'];
  const tipoGuardado = salon ? (salon.tipo||'salon') : 'salon';
  const esPredefinido = tiposPredefinidos.includes(tipoGuardado);
  document.getElementById('ms-tipo').value = esPredefinido ? tipoGuardado : 'otro';
  const campoCust = document.getElementById('ms-tipo-custom');
  if(!esPredefinido){
    campoCust.style.display = 'block';
    campoCust.value = tipoGuardado;
  } else {
    campoCust.style.display = 'none';
    campoCust.value = '';
  }

  // Clases: las del salón incluyen posibles extras
  const clasesDelSalon = salon ? (salon.clases||[]) : [];
  const deHorarios = [...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))];
  msClasesExtra = clasesDelSalon.filter(c=>!deHorarios.includes(c));
  renderCheckboxesClases(clasesDelSalon);

  document.getElementById('m-salon').classList.add('on');
}

function guardarSalon() {
  const id = parseInt(document.getElementById('ms-id').value)||0;
  const nombre = document.getElementById('ms-nombre').value.trim();
  if(!nombre){showToast('Ingresa el nombre del salón','err');return;}
  const cap = parseInt(document.getElementById('ms-cap').value)||20;
  const desc = document.getElementById('ms-desc').value.trim();

  // Tipo: predefinido o personalizado
  const tipoSel = document.getElementById('ms-tipo').value;
  const tipo = tipoSel === 'otro'
    ? (document.getElementById('ms-tipo-custom').value.trim() || 'Otro')
    : tipoSel;

  const clases = [...document.querySelectorAll('#ms-clases-check input:checked')].map(c=>c.value);

  if(id){
    const idx = salones.findIndex(s=>s.id===id);
    salones[idx] = {...salones[idx], nombre, cap, tipo, desc, clases};
  } else {
    salones.push({id:Math.max(...salones.map(s=>s.id),0)+1, nombre, cap, tipo, desc, clases});
  }
  localStorage.setItem('fc_salones', JSON.stringify(salones));
  cerrarModal('m-salon');
  renderSalones();
  showToast(`Salón "${nombre}" guardado · ${cap} personas · ${clases.length} clase(s) asignada(s)`,'ok');
  registrarLog('sistema',`Salón guardado: "${nombre}" cap:${cap} tipo:${tipo} clases:[${clases.join(', ')}]`);
  // Sincronizar con Firebase si está disponible
  if(typeof guardarLocal === 'function') guardarLocal();
  if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 800);
}

function eliminarSalon() {
  const id = parseInt(document.getElementById('ms-id').value);
  const salon = salones.find(s=>s.id===id);
  if(!confirm('¿Eliminar este salón?'))return;
  salones = salones.filter(s=>s.id!==id);
  localStorage.setItem('fc_salones',JSON.stringify(salones));
  cerrarModal('m-salon');
  renderSalones();
  showToast(`Salón eliminado`,'ok');
  if(salon) registrarLog('sistema',`Salón eliminado: "${salon.nombre}"`);
  if(typeof guardarLocal === 'function') guardarLocal();
  if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 800);
}

// ═══════════════════════════════════════════
// MAPA DE CALOR
// ═══════════════════════════════════════════
// ── Helpers filtros heatmap ──────────────────────────────────────
function hmInstChange() {
  // Al cambiar instructor repoblar clases de ese instructor y re-renderizar
  const rawId = document.getElementById('hm-inst-fil').value;
  const instId = rawId ? parseInt(rawId) : null;
  hmPoblarClases(instId);
  document.getElementById('hm-clase-fil').value = '';
  renderHeatmap();
}

function hmClearFiltros() {
  document.getElementById('hm-inst-fil').value = '';
  document.getElementById('hm-clase-fil').value = '';
  hmPoblarClases(null);
  renderHeatmap();
}

function hmPoblarInstructores(instIdActual) {
  const sel = document.getElementById('hm-inst-fil');
  // Solo instructores que tienen al menos un registro válido
  const idsConDatos = new Set(
    registros
      .filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0)
      .map(r => r.inst_id)
  );
  const lista = instructores
    .filter(i => idsConDatos.has(i.id))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = '<option value="">👤 Todos los instructores</option>' +
    lista.map(i => `<option value="${i.id}" ${i.id===instIdActual?'selected':''}>${i.nombre}</option>`).join('');
}

function hmPoblarClases(instId) {
  const sel = document.getElementById('hm-clase-fil');
  const cur = sel.value;
  // Filtrar registros válidos, y si hay instructor seleccionado solo los suyos
  let regs = registros.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0);
  if(instId) regs = regs.filter(r => r.inst_id === instId); // inst_id ya es número, instId también
  const clases = [...new Set(regs.map(r => r.clase))].filter(Boolean).sort();
  sel.innerHTML = '<option value="">📋 Todas las clases</option>' +
    clases.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

// ── renderHeatmap principal ──────────────────────────────────────
function renderHeatmap() {

  const metric  = document.getElementById('hm-metric').value;
  // *** CLAVE: convertir a número para que coincida con r.inst_id que es número ***
  const rawInstVal = document.getElementById('hm-inst-fil').value;
  const instId  = rawInstVal ? parseInt(rawInstVal) : null;
  const claseFil = document.getElementById('hm-clase-fil').value;

  // Mantener selectores actualizados sin perder la selección actual
  hmPoblarInstructores(instId);
  hmPoblarClases(instId);
  // Re-asignar tras repoblar (repoblar puede haber reseteado el valor)
  if(instId)   document.getElementById('hm-inst-fil').value  = String(instId);
  if(claseFil) document.getElementById('hm-clase-fil').value = claseFil;

  const hayFiltro = instId || claseFil;
  document.getElementById('hm-clear-btn').style.display = hayFiltro ? '' : 'none';

  const instObj = instId ? instructores.find(i => i.id === instId) : null;

  // Banner contextual
  const bannerEl = document.getElementById('hmap-context-banner');
  if(hayFiltro) {
    let txt = '';
    if(instObj) txt += `<span style="background:rgba(94,255,160,.1);color:var(--neon);border:1px solid rgba(94,255,160,.25);border-radius:6px;padding:2px 9px;font-size:.73rem"><svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 18 Q3 12 10 12 Q17 12 17 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg> ${instObj.nombre}</span>`;
    if(claseFil) txt += `<span style="background:rgba(77,184,232,.1);color:var(--blue);border:1px solid rgba(77,184,232,.25);border-radius:6px;padding:2px 9px;font-size:.73rem"><svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ${claseFil}</span>`;
    txt += `<span style="color:var(--txt3);font-size:.72rem"> — mostrando solo registros de esta selección</span>`;
    bannerEl.innerHTML = txt;
    bannerEl.style.display = 'flex';
  } else {
    bannerEl.style.display = 'none';
  }

  // Filtrar registros — usar === con tipos correctos
  let regsValidos = registros.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0);
  if(instId)   regsValidos = regsValidos.filter(r => r.inst_id === instId);   // número === número
  if(claseFil) regsValidos = regsValidos.filter(r => r.clase   === claseFil); // string === string

  if(regsValidos.length === 0) {
    const msg = hayFiltro
      ? `Sin registros de aforo para ${instObj ? instObj.nombre : 'este instructor'}${claseFil ? ' · ' + claseFil : ''}.`
      : 'Sin datos de aforo registrados aún. Registra clases con aforo para ver el mapa de calor.';
    document.getElementById('hmap-grid').innerHTML = `<div class="empty" style="padding:2rem">${msg}</div>`;
    document.getElementById('hm-top5').innerHTML   = '<div class="empty" style="font-size:.75rem">Sin datos</div>';
    document.getElementById('hm-bot5').innerHTML   = '<div class="empty" style="font-size:.75rem">Sin datos</div>';
    document.getElementById('hmap-insight').innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Registra clases para ver insights de horarios.';
    document.getElementById('hmap-legend').innerHTML  = '';
    return;
  }

  // Construir matriz día x hora
  const matriz = {};
  HORAS_CAL.forEach(h => { matriz[h]={}; DIAS.forEach(d=>{ matriz[h][d]={sum:0,cnt:0,sesiones:0}; }); });

  regsValidos.forEach(r => {
    const asisN = parseInt(r.asistentes) || 0;
    const capN  = parseInt(r.cap) || getCapClase(r.clase) || 20;
    const hSlot = HORAS_CAL.reduce((best,h) => {
      const diff = Math.abs(horaToMin(r.hora)-horaToMin(h));
      return diff < Math.abs(horaToMin(r.hora)-horaToMin(best)) ? h : best;
    }, HORAS_CAL[0]);
    if(matriz[hSlot] && matriz[hSlot][r.dia] !== undefined) {
      matriz[hSlot][r.dia].sum += metric==='asis' ? asisN : metric==='aforo' ? asisN/capN*100 : 1;
      matriz[hSlot][r.dia].cnt++;
      matriz[hSlot][r.dia].sesiones++;
    }
  });

  // Máximo para escala de color
  let maxVal = 1;
  HORAS_CAL.forEach(h => DIAS.forEach(d => {
    const cell = matriz[h][d];
    const val  = cell.cnt > 0 ? (metric==='sesiones' ? cell.sesiones : cell.sum/cell.cnt) : 0;
    if(val > maxVal) maxVal = val;
  }));

  function cellColor(val) {
    if(val===0) return 'var(--panel2)';
    const pct = val/maxVal;
    const isDark = temaActual !== 'claro';
    if(isDark){
      if(pct<0.25)return'rgba(26,122,69,.12)';
      if(pct<0.45)return'rgba(26,122,69,.30)';
      if(pct<0.65)return'rgba(26,122,69,.55)';
      if(pct<0.80)return'rgba(26,122,69,.80)';
      return'#5effa0';
    } else {
      if(pct<0.25)return'#d4eedd';
      if(pct<0.45)return'#a8d8b8';
      if(pct<0.65)return'#6db990';
      if(pct<0.80)return'#3a9a68';
      return'#1a7a45';
    }
  }
  function cellTextColor(val){
    if(val===0) return 'var(--txt3)';
    const _dark = temaActual !== 'claro';
    if(!_dark) return val/maxVal < 0.25 ? 'var(--txt3)' : '#0a1f12';
    const pct = val/maxVal;
    if(pct === 0) return 'var(--txt3)';
    if(pct < 0.25) return 'var(--txt3)';
    if(pct >= 0.80) return '#071a0f';   // dark text on bright neon green
    return '#fff';
  }

  let html = `<table style="border-collapse:separate;border-spacing:3px;width:100%">
    <thead><tr>
      <th style="width:50px;padding:4px;font-size:.65rem;color:var(--txt3)">Hora</th>
      ${DIAS.map(d=>`<th style="padding:4px;font-size:.65rem;color:var(--txt2);text-align:center;min-width:60px">${d.slice(0,3)}</th>`).join('')}
    </tr></thead><tbody>`;

  const allVals = [];
  HORAS_CAL.forEach(h => {
    html += `<tr><td style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--txt3);padding:2px 4px;white-space:nowrap">${h}</td>`;
    DIAS.forEach(d => {
      const cell  = matriz[h][d];
      const val   = cell.cnt > 0 ? (metric==='sesiones' ? cell.sesiones : Math.round(cell.sum/cell.cnt)) : 0;
      allVals.push({h, d, val, cnt:cell.cnt});
      const label    = val===0 ? '—' : (metric==='aforo' ? val+'%' : val);
      const sublabel = cell.cnt>0 && metric!=='sesiones'
        ? `<br><span style="font-size:.55rem;opacity:.7">${cell.cnt}ses</span>` : '';
      html += `<td class="hmap-cell" style="background:${cellColor(val)};color:${cellTextColor(val)};height:38px;vertical-align:middle;"
        title="${d} ${h} · ${label}${metric==='aforo'?' aforo':''}${metric==='asis'?' asis.':''} · ${cell.cnt} sesiones"
        onclick="verDiagHorario('${d}','${h}')">
        <div>${label}${sublabel}</div></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('hmap-grid').innerHTML = html;

  // Leyenda
  const isDarkLegend = temaActual !== 'claro';
  const legendColors = isDarkLegend
    ? ['rgba(26,122,69,.12)','rgba(26,122,69,.30)','rgba(26,122,69,.55)','rgba(26,122,69,.80)','#5effa0']
    : ['#d4eedd','#a8d8b8','#6db990','#3a9a68','#1a7a45'];
  document.getElementById('hmap-legend').innerHTML =
    `<span>Menor</span>
    ${legendColors.map((c,i)=>`<span class="hmap-sq" style="background:${c};border:1px solid rgba(94,255,160,${0.1+i*0.15})"></span>`).join('')}
    <span>Mayor</span>
    &nbsp;&nbsp; <span style="opacity:.7">Clic en celda = diagnóstico de ese horario</span>`;

  // Top / Bottom 5
  const horarios   = allVals.filter(v => v.cnt > 0).sort((a,b) => b.val - a.val);
  const metricLabel = metric==='aforo' ? '% aforo' : metric==='asis' ? 'asis. prom' : 'sesiones';

  // Clases por horario respetando filtro activo
  function clasesEnHorario(dia, hora) {
    const resultado = [];
    const instsFiltro = instId ? instructores.filter(i => i.id === instId) : instructores;
    instsFiltro.forEach(inst => {
      (inst.horario||[]).forEach(h => {
        if(h.dia === dia && Math.abs(horaToMin(h.hora)-horaToMin(hora)) <= 30) {
          if(claseFil && h.clase !== claseFil) return;
          const regsSlot = registros.filter(r =>
            r.inst_id === inst.id && r.dia === dia &&
            Math.abs(horaToMin(r.hora)-horaToMin(hora)) <= 30 &&
            (r.estado==='ok'||r.estado==='sub') && r.cap > 0 &&
            (!claseFil || r.clase === claseFil)
          );
          const promAsis = regsSlot.length > 0
            ? Math.round(regsSlot.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/regsSlot.length) : null;
          const promAfo  = regsSlot.length > 0
            ? Math.round(regsSlot.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/regsSlot.length) : null;
          resultado.push({clase:h.clase, inst:inst.nombre.split(' ')[0], promAsis, promAfo, sesiones:regsSlot.length});
        }
      });
    });
    return resultado;
  }

  function sugerenciaMejor(v, clasesList) {
    const nc  = clasesList.map(c=>c.clase).join(', ');
    const pfx = instObj ? `${instObj.nombre.split(' ')[0]} — ` : '';
    if(metric==='aforo'){
      if(v.val>=80) return `<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${pfx}Horario estrella. Considera duplicar ${clasesList[0]?.clase||'esta clase'} o agregar instructor adicional.`;
      if(v.val>=60) return `👍 ${pfx}Buen rendimiento. Mantén la programación actual de ${nc||'este horario'}.`;
      return `<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ${pfx}Horario en crecimiento. Potencial sin explotar en ${nc||'este horario'}.`;
    }
    if(metric==='asis') return `<svg class="ico" viewBox="0 0 20 20"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2 17 Q2 12 8 12 Q14 12 14 17" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M14 11 Q18 11 18 16" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg> ${pfx}Promedio de ${v.val} personas — asigna al instructor de mayor experiencia aquí.`;
    return `<svg class="ico" viewBox="0 0 20 20"><rect x="3" y="12" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="8.5" y="8" width="3" height="9" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="14" y="4" width="3" height="13" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg> ${v.val} sesiones registradas. Horario consolidado.`;
  }

  function sugerenciaCritica(v, clasesList) {
    const nc = clasesList.map(c=>c.clase).join(', ');
    if(metric==='aforo'){
      if(v.val<=15) return `<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg> Aforo crítico (${v.val}%). Evalúa cancelar o fusionar ${nc||'esta clase'} con otro horario similar.`;
      if(v.val<=30) return `<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg> Aforo bajo (${v.val}%). Considera cambiar horario o promocionar ${nc||'esta clase'}.`;
      return `<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg>️ Rendimiento mejorable (${v.val}%). Revisa si el horario compite con otra clase del mismo tipo.`;
    }
    if(metric==='asis') return `<svg class="ico" viewBox="0 0 20 20"><polyline points="3,5 7,12 11,9 17,15" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,15 17,15 17,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Solo ${v.val} personas en promedio. Considera reubicar ${nc||'esta clase'} a un horario con mayor demanda.`;
    return `<svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Pocas sesiones. Verifica si el horario está activo.`;
  }

  const mkChipVerde = c => `<span style="display:inline-block;background:rgba(94,255,160,.12);color:var(--neon);border-radius:4px;padding:1px 5px;font-size:.62rem;margin:1px">${c.clase}${instId?'':` <span style="opacity:.55">${c.inst}</span>`}</span>`;
  const mkChipRojo  = c => `<span style="display:inline-block;background:rgba(224,80,80,.12);color:var(--red2);border-radius:4px;padding:1px 5px;font-size:.62rem;margin:1px">${c.clase}${instId?'':` <span style="opacity:.55">${c.inst}</span>`}</span>`;

  document.getElementById('hm-top5').innerHTML = horarios.slice(0,5).map((v,n) => {
    const clsList = clasesEnHorario(v.d, v.h);
    const clasesStr = clsList.length > 0
      ? clsList.map(mkChipVerde).join('')
      : `<span style="font-size:.65rem;color:var(--txt3)">Sin clases asignadas</span>`;
    return `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--gold2);min-width:20px">${n+1}</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${v.d} ${v.h}</div><div style="margin-top:2px">${clasesStr}</div></div>
        <span class="mono" style="color:var(--neon);font-size:.85rem;font-weight:700">${v.val}${metric==='aforo'?'%':''}</span>
      </div>
      <div style="font-size:.68rem;color:var(--txt2);padding-left:24px;line-height:1.4">${sugerenciaMejor(v,clsList)}</div>
    </div>`;
  }).join('') || '<div class="empty" style="font-size:.75rem">Sin datos</div>';

  document.getElementById('hm-bot5').innerHTML = [...horarios].reverse().slice(0,5).map((v,n) => {
    const clsList = clasesEnHorario(v.d, v.h);
    const clasesStr = clsList.length > 0
      ? clsList.map(mkChipRojo).join('')
      : `<span style="font-size:.65rem;color:var(--txt3)">Sin clases asignadas</span>`;
    return `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--red2);min-width:20px">${n+1}</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${v.d} ${v.h}</div><div style="margin-top:2px">${clasesStr}</div></div>
        <span class="mono" style="color:var(--red2);font-size:.85rem;font-weight:700">${v.val}${metric==='aforo'?'%':''}</span>
      </div>
      <div style="font-size:.68rem;color:var(--txt2);padding-left:24px;line-height:1.4">${sugerenciaCritica(v,clsList)}</div>
    </div>`;
  }).join('') || '<div class="empty" style="font-size:.75rem">Sin datos</div>';

  // Insight
  if(horarios.length > 0) {
    const mejor = horarios[0];
    const peor  = horarios[horarios.length-1];
    const diaMasActivo   = DIAS.map(d=>({d,tot:HORAS_CAL.reduce((a,h)=>a+(matriz[h][d].sesiones||0),0)})).sort((a,b)=>b.tot-a.tot)[0];
    const diaMenosActivo = DIAS.map(d=>({d,tot:HORAS_CAL.reduce((a,h)=>a+(matriz[h][d].sesiones||0),0)})).filter(x=>x.tot>0).sort((a,b)=>a.tot-b.tot)[0];
    const clasesMejor = clasesEnHorario(mejor.d, mejor.h);
    const clasesPeor  = clasesEnHorario(peor.d,  peor.h);
    const metricNom   = metric==='aforo' ? 'aforo' : metric==='asis' ? 'asistentes' : 'sesiones';
    const titulo = instObj
      ? `<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Análisis individual — ${instObj.nombre}${claseFil?' · '+claseFil:''}`
      : '<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Análisis y recomendaciones';
    document.getElementById('hmap-insight').innerHTML =
      `<div style="background:var(--panel2);border-radius:10px;padding:.8rem 1rem;border-left:3px solid var(--neon)">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--neon);margin-bottom:.5rem">${titulo}</div>
        <div style="font-size:.78rem;line-height:1.6;color:var(--txt)">
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><polyline points="3,15 7,8 11,11 17,5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,5 17,5 17,9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> <strong>Mejor horario:</strong> ${mejor.d} ${mejor.h}${clasesMejor.length>0?` — <em>${clasesMejor.map(c=>c.clase).join(', ')}</em>`:''} con <strong style="color:var(--neon)">${mejor.val}${metric==='aforo'?'%':''}</strong> de ${metricNom}.</p>
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><polyline points="3,5 7,12 11,9 17,15" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,15 17,15 17,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> <strong>Horario crítico:</strong> ${peor.d} ${peor.h}${clasesPeor.length>0?` — <em>${clasesPeor.map(c=>c.clase).join(', ')}</em>`:''} con solo <strong style="color:var(--red2)">${peor.val}${metric==='aforo'?'%':''}</strong> de ${metricNom}.</p>
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/><circle cx="13" cy="12.5" r="1" fill="currentColor"/></svg> <strong>Día más activo:</strong> ${diaMasActivo?.d||'—'}${diaMenosActivo?' · <strong>Día más flojo:</strong> '+diaMenosActivo.d:''}</p>
          <p style="margin:0;font-size:.7rem;color:var(--txt3)">${instObj?`Viendo solo las sesiones de <em>${instObj.nombre}</em>${claseFil?' en <em>'+claseFil+'</em>':''}. Quita el filtro para ver el comparativo general.`:'Selecciona un instructor para ver su mapa individual.'}</p>
        </div>
      </div>`;
  } else {
    document.getElementById('hmap-insight').innerHTML = '<div class="empty">Registra clases para ver el análisis de horarios.</div>';
  }
}

function verDiagHorario(dia, hora) {
  // Construir el diagnóstico completo del slot y mostrarlo en modal
  const instId   = document.getElementById('hm-inst-fil')?.value  || '';
  const claseFil = document.getElementById('hm-clase-fil')?.value || '';
  const metric   = document.getElementById('hm-metric')?.value || 'aforo';

  // Recopilar todas las clases programadas en ese slot (respetando filtros)
  const instsFiltro = instId ? instructores.filter(i => i.id === instId) : instructores;
  const clases = [];
  instsFiltro.forEach(inst => {
    (inst.horario||[]).forEach(h => {
      if(h.dia !== dia) return;
      if(Math.abs(horaToMin(h.hora) - horaToMin(hora)) > 30) return;
      if(claseFil && h.clase !== claseFil) return;
      const regsSlot = registros.filter(r =>
        r.inst_id === inst.id && r.dia === dia &&
        Math.abs(horaToMin(r.hora) - horaToMin(hora)) <= 30 &&
        (r.estado==='ok' || r.estado==='sub') && r.cap > 0 &&
        (!claseFil || r.clase === claseFil)
      ).sort((a,b) => b.fecha.localeCompare(a.fecha));

      const faltas = registros.filter(r =>
        r.inst_id === inst.id && r.dia === dia &&
        Math.abs(horaToMin(r.hora) - horaToMin(hora)) <= 30 &&
        r.estado === 'falta'
      ).length;

      const promAsis = regsSlot.length > 0
        ? Math.round(regsSlot.reduce((a,r) => a + (parseInt(r.asistentes)||0), 0) / regsSlot.length) : null;
      const promAfo  = regsSlot.length > 0
        ? Math.round(regsSlot.reduce((a,r) => a + (parseInt(r.asistentes)||0) / parseInt(r.cap) * 100, 0) / regsSlot.length) : null;

      clases.push({
        clase: h.clase,
        inst: inst.nombre,
        inst_id: inst.id,
        promAsis, promAfo,
        sesiones: regsSlot.length,
        faltas,
        registros: regsSlot.slice(0, 10) // últimas 10 sesiones
      });
    });
  });

  // Cabecera resumen global del slot
  const totalSes = clases.reduce((a,c) => a + c.sesiones, 0);
  const promAfoGlobal = clases.filter(c => c.promAfo !== null).length > 0
    ? Math.round(clases.filter(c => c.promAfo !== null).reduce((a,c) => a + c.promAfo, 0) / clases.filter(c => c.promAfo !== null).length) : null;
  const promAsisGlobal = clases.filter(c => c.promAsis !== null).length > 0
    ? Math.round(clases.filter(c => c.promAsis !== null).reduce((a,c) => a + c.promAsis, 0) / clases.filter(c => c.promAsis !== null).length) : null;
  const totalAsisSlot = clases.reduce((a,c) => a + c.registros.reduce((b,r)=>b+(parseInt(r.asistentes)||0),0), 0);

  const diaLabel = dia;
  const colorAfo = promAfoGlobal !== null ? pctCol(promAfoGlobal) : 'var(--txt2)';
  const sugerenciaSlot = promAfoGlobal !== null ? (promAfoGlobal>=80?'Horario estrella — considera duplicar o ampliar capacidad':promAfoGlobal>=60?'Buen rendimiento — mantener programación':promAfoGlobal>=35?'Potencial de mejora — revisar horario o instructor':'Aforo crítico — evaluar cambio de horario o fusión') : 'Sin datos suficientes';

  // Tarjetas de cada clase con su historial
  // Summary pill with total asistencias + suggestion
  const summaryPill = clases.length > 0 && totalSes > 0 ? `
    <div style="background:rgba(94,255,160,.08);border:1px solid rgba(94,255,160,.2);border-radius:10px;padding:.6rem .9rem;margin-bottom:.8rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
      <div style="text-align:center;flex:1">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--neon)">${totalAsisSlot.toLocaleString()}</div>
        <div style="font-size:.6rem;color:var(--txt3)">Total asistencias</div>
      </div>
      <div style="text-align:center;flex:1">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${colorAfo}">${promAfoGlobal ?? '—'}${promAfoGlobal !== null ? '%' : ''}</div>
        <div style="font-size:.6rem;color:var(--txt3)">Aforo prom.</div>
      </div>
      <div style="font-size:.72rem;color:var(--gold2);flex:2;background:rgba(232,184,75,.08);border-radius:7px;padding:5px 8px;">→ ${sugerenciaSlot}</div>
    </div>` : '';

  const tarjetas = clases.length === 0
    ? `<div style="color:var(--txt2);text-align:center;padding:2rem;font-size:.9rem">No hay clases programadas en este horario con los filtros actuales.</div>`
    : clases.map(c => {
        const colAfo = c.promAfo !== null ? pctCol(c.promAfo) : 'var(--txt2)';
        const colAsis = c.promAsis !== null ? (c.promAsis >= 9 ? 'var(--neon)' : c.promAsis >= 4 ? 'var(--gold2)' : 'var(--red2)') : 'var(--txt2)';

        // Historial de las últimas sesiones
        const histRows = c.registros.length === 0
          ? `<tr><td colspan="4" style="color:var(--txt2);font-size:.75rem;text-align:center;padding:.5rem">Sin sesiones registradas</td></tr>`
          : c.registros.map(r => {
              const afoP = r.cap > 0 ? Math.round(parseInt(r.asistentes)/parseInt(r.cap)*100) : null;
              const instNom = r.estado === 'sub'
                ? (instructores.find(i => i.id === r.suplente_id)?.nombre.split(' ')[0] || '?') + ' (sub)'
                : c.inst.split(' ')[0];
              return `<tr>
                <td style="padding:3px 8px;font-size:.73rem;color:var(--txt2)">${r.fecha}</td>
                <td style="padding:3px 8px;font-size:.73rem">${instNom}</td>
                <td style="padding:3px 8px;font-size:.73rem;text-align:center;font-weight:600;color:${colAsis}">${r.asistentes}</td>
                <td style="padding:3px 8px;font-size:.73rem;text-align:center">
                  <div style="display:inline-flex;align-items:center;gap:4px">
                    <div style="width:44px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                      <div style="height:100%;width:${Math.min(afoP||0,100)}%;background:${afoP!==null?pctCol(afoP):'var(--border)'};border-radius:3px"></div>
                    </div>
                    <span style="color:${afoP!==null?pctCol(afoP):'var(--txt2)'};font-weight:600">${afoP !== null ? afoP+'%' : '—'}</span>
                  </div>
                </td>
              </tr>`;
            }).join('');

        return `<div style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:.9rem 1rem;margin-bottom:.8rem">
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap">
            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--neon)">${c.clase}</span>
            <span style="font-size:.78rem;color:var(--txt2)">${c.inst}</span>
            <div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap">
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Sesiones:</span> <strong>${c.sesiones}</strong>
              </span>
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Asis. prom:</span> <strong style="color:${colAsis}">${c.promAsis !== null ? c.promAsis : '—'}</strong>
              </span>
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Aforo prom:</span> <strong style="color:${colAfo}">${c.promAfo !== null ? c.promAfo+'%' : '—'}</strong>
              </span>
              ${c.faltas > 0 ? `<span style="background:rgba(224,80,80,.12);border:1px solid var(--red);border-radius:6px;padding:2px 8px;font-size:.72rem;color:var(--red2)"><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> ${c.faltas} falta${c.faltas>1?'s':''}</span>` : ''}
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border)">
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:left;font-weight:500">Fecha</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:left;font-weight:500">Instructor</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:center;font-weight:500">Asistentes</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:center;font-weight:500">Aforo</th>
                </tr>
              </thead>
              <tbody>${histRows}</tbody>
            </table>
          </div>
          ${c.registros.length === 10 ? `<div style="font-size:.68rem;color:var(--txt2);margin-top:.4rem;text-align:right">Mostrando las últimas 10 sesiones</div>` : ''}
        </div>`;
      }).join('');

  const body = `
    <div style="margin-bottom:1rem">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--neon);margin-bottom:.15rem">
        <svg class="ico" viewBox="0 0 20 20" style="width:1.1em;height:1.1em"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/><circle cx="13" cy="12.5" r="1" fill="currentColor"/></svg>
        Diagnóstico · ${diaLabel} ${hora}
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.5rem">
        <span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Clases activas:</span> <strong>${clases.length}</strong>
        </span>
        <span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Sesiones totales:</span> <strong>${totalSes}</strong>
        </span>
        ${promAsisGlobal !== null ? `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Asistentes prom:</span> <strong style="color:${colorAfo}">${promAsisGlobal}</strong>
        </span>` : ''}
        ${promAfoGlobal !== null ? `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Aforo global:</span> <strong style="color:${colorAfo}">${promAfoGlobal}%</strong>
        </span>` : ''}
      </div>
    </div>
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt2);margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)">Detalle por clase</div>
    ${tarjetas}
  `;

  document.getElementById('m-diag-horario-body').innerHTML = body;
  document.getElementById('m-diag-horario').classList.add('on');
}

// ═══════════════════════════════════════════
// ALERTAS AUTOMÁTICAS
// ═══════════════════════════════════════════
function calcularAlertas() {
  const alertas = [];
  const hoy7 = new Date(); hoy7.setDate(hoy7.getDate()-7);
  const hoy30 = new Date(); hoy30.setDate(hoy30.getDate()-30);
  const hoy7str=hoy7.toISOString().slice(0,10);
  const hoy30str=hoy30.toISOString().slice(0,10);
  const fmtFecha = d => d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});

  // 1. Clases con aforo < 20% en últimas 3 semanas consecutivas
  const gruposClase = {};
  registros.filter(r=>r.estado==='ok'||r.estado==='sub').forEach(r => {
    const k = `${r.inst_id}||${r.clase}||${r.hora}`;
    if(!gruposClase[k]) gruposClase[k] = {inst_id:r.inst_id,clase:r.clase,hora:r.hora,recs:[]};
    gruposClase[k].recs.push(r);
  });
  Object.values(gruposClase).forEach(g => {
    const recientes = g.recs.filter(r=>new Date(r.fecha)>=hoy30).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    if(recientes.length>=3) {
      const bajos = recientes.slice(0,3).filter(r=>r.cap>0&&(r.asistentes/r.cap*100)<20);
      if(bajos.length>=3) {
        const inst = instructores.find(i=>i.id===g.inst_id);
        alertas.push({tipo:'red',icon:'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>',texto:`<strong>${g.clase}</strong> con ${inst?.nombre||'?'} a las ${g.hora} lleva 3+ sesiones consecutivas con aforo menor al 20%.`,accion:'Considera revisar o reasignar este horario.'});
      }
    }
  });

  // 2. Instructor con 2+ faltas en el último mes
  instructores.forEach(inst => {
    const faltas = registros.filter(r=>r.inst_id===inst.id&&r.estado==='falta'&&new Date(r.fecha)>=hoy30);
    if(faltas.length>=2) {
      alertas.push({tipo:'gold',icon:'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg>️',texto:`<strong>${inst.nombre}</strong> tiene <strong>${faltas.length} faltas</strong> en los últimos 30 días.`,accion:'Requiere seguimiento de RRHH o coordinación.'});
    }
  });

  // 3. Clases programadas sin registro esta semana
  const inicioSemana = getLunes(0);
  const finSemana = new Date(inicioSemana); finSemana.setDate(finSemana.getDate()+7);
  const diasSemana = DIAS.filter((_,i) => {
    const d = new Date(inicioSemana); d.setDate(d.getDate()+i);
    return d <= new Date();
  });
  const sinRegistro = [];
  instructores.forEach(inst => {
    (inst.horario||[]).forEach(h => {
      if(!diasSemana.includes(h.dia)) return;
      const tieneReg = registros.some(r=>r.inst_id===inst.id&&r.dia===h.dia&&r.hora===h.hora&&
        new Date(r.fecha)>=inicioSemana&&new Date(r.fecha)<finSemana&&(r.estado==='ok'||r.estado==='sub'||r.estado==='falta'));
      if(!tieneReg) sinRegistro.push(`${h.clase} (${inst.nombre.split(' ')[0]}) ${h.dia} ${h.hora}`);
    });
  });
  if(sinRegistro.length>0){
    alertas.push({tipo:'blue',icon:'<svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',texto:`<strong>${sinRegistro.length} clase(s)</strong> de esta semana sin registro aún: ${sinRegistro.slice(0,3).join(', ')}${sinRegistro.length>3?` y ${sinRegistro.length-3} más`:''}`,accion:'Verifica si se impartieron y regístralas.'});
  }

  // 4. Semanas con tendencia negativa (aforo promedio bajando)
  const aforoSemanas = [];
  for(let i=3;i>=0;i--){
    const ini = getLunes(-i);
    const fin = new Date(ini); fin.setDate(fin.getDate()+7);
    const regs = registros.filter(r=>(r.estado==='ok'||r.estado==='sub')&&r.cap>0&&new Date(r.fecha)>=ini&&new Date(r.fecha)<fin);
    if(regs.length>0){
      const prom = Math.round(regs.reduce((a,r)=>a+r.asistentes/r.cap*100,0)/regs.length);
      aforoSemanas.push(prom);
    }
  }
  if(aforoSemanas.length>=3){
    const tendencia = aforoSemanas[aforoSemanas.length-1] - aforoSemanas[0];
    if(tendencia < -10){
      alertas.push({tipo:'red',icon:'<svg class="ico" viewBox="0 0 20 20"><polyline points="3,5 7,12 11,9 17,15" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,15 17,15 17,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',texto:`El aforo promedio ha bajado <strong>${Math.abs(Math.round(tendencia))}%</strong> en las últimas semanas (${aforoSemanas[0]}% → ${aforoSemanas[aforoSemanas.length-1]}%).`,accion:'Analiza el mapa de calor para identificar horarios problemáticos.'});
    } else if(tendencia > 5){
      alertas.push({tipo:'green',icon:'<svg class="ico" viewBox="0 0 20 20"><polyline points="3,15 7,8 11,11 17,5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,5 17,5 17,9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',texto:`¡Buenas noticias! El aforo promedio ha subido <strong>${Math.round(tendencia)}%</strong> en las últimas semanas (${aforoSemanas[0]}% → ${aforoSemanas[aforoSemanas.length-1]}%).`,accion:'El programa va en buena dirección.'});
    }
  }

  // 5. Instructor con alta tasa de suplencias
  instructores.forEach(inst => {
    const impTotal = registros.filter(r=>r.inst_id===inst.id&&(r.estado==='ok'||r.estado==='sub')&&new Date(r.fecha)>=hoy30).length;
    const sups = registros.filter(r=>r.inst_id===inst.id&&r.estado==='sub'&&new Date(r.fecha)>=hoy30).length;
    if(impTotal>=4 && sups/impTotal >= 0.5){
      alertas.push({tipo:'gold',icon:'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',texto:`<strong>${inst.nombre}</strong> tiene suplentes en el <strong>${Math.round(sups/impTotal*100)}%</strong> de sus clases este mes (${sups} de ${impTotal}).`,accion:'Considera revisar disponibilidad o reasignación de clases.'});
    }
  });

  // 6. Clases sin datos suficientes
  const clasesConPocosDatos = Object.values(gruposClase).filter(g=>{
    const recientes = g.recs.filter(r=>new Date(r.fecha)>=hoy30);
    return recientes.length<3 && (instructores.find(i=>i.id===g.inst_id)?.horario||[]).length>0;
  });
  if(clasesConPocosDatos.length>2){
    alertas.push({tipo:'blue',icon:'<svg class="ico" viewBox="0 0 20 20"><rect x="3" y="12" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="8.5" y="8" width="3" height="9" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="14" y="4" width="3" height="13" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',texto:`<strong>${clasesConPocosDatos.length} combinaciones</strong> de clase/instructor tienen menos de 3 registros en el último mes.`,accion:'Más datos permiten mejores diagnósticos. Registra clases regularmente.'});
  }

  return alertas;
}

function renderAlertas() {
  const alertas = calcularAlertas();
  const container = document.getElementById('alertas-body');
  if(alertas.length===0){
    container.innerHTML = `<div style="text-align:center;padding:2rem">
      <div style="font-size:2rem;margin-bottom:.5rem"><svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div style="font-size:.9rem;color:var(--neon);font-weight:600">Sin alertas activas</div>
      <div style="font-size:.75rem;color:var(--txt2);margin-top:.3rem">Todo marcha bien por ahora.</div>
    </div>`;
    return;
  }
  const resumen = {red:alertas.filter(a=>a.tipo==='red').length,gold:alertas.filter(a=>a.tipo==='gold').length,blue:alertas.filter(a=>a.tipo==='blue').length,green:alertas.filter(a=>a.tipo==='green').length};
  container.innerHTML =
    `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
      ${resumen.red>0?`<span style="background:rgba(224,80,80,.15);color:var(--red2);border:1px solid var(--red);border-radius:20px;padding:3px 10px;font-size:.72rem"><svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg> ${resumen.red} crítica(s)</span>`:''}
      ${resumen.gold>0?`<span style="background:rgba(232,184,75,.15);color:var(--gold2);border:1px solid var(--gold);border-radius:20px;padding:3px 10px;font-size:.72rem"><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg>️ ${resumen.gold} advertencia(s)</span>`:''}
      ${resumen.blue>0?`<span style="background:rgba(77,184,232,.12);color:var(--blue);border:1px solid var(--blue);border-radius:20px;padding:3px 10px;font-size:.72rem"><svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ${resumen.blue} info</span>`:''}
      ${resumen.green>0?`<span style="background:rgba(94,255,160,.1);color:var(--neon);border:1px solid var(--verde);border-radius:20px;padding:3px 10px;font-size:.72rem"><svg class="ico" viewBox="0 0 20 20"><polyline points="3,15 7,8 11,11 17,5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,5 17,5 17,9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${resumen.green} positiva(s)</span>`:''}
    </div>` +
    alertas.map(a=>`
      <div class="alert-card alrt-${a.tipo}">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-txt">
          <div>${a.texto}</div>
          <div style="color:var(--txt3);font-size:.68rem;margin-top:3px">→ ${a.accion}</div>
        </div>
      </div>`).join('');
}

// ═══════════════════════════════════════════
// KPIs CON SEMÁFORO Y TENDENCIA (override)
// ═══════════════════════════════════════════
function calcTendenciaAforo() {
  // Compara aforo promedio semana actual vs semana anterior
  const semAct = getLunes(0);
  const semAnt = getLunes(-1);
  const finAct = new Date(semAct); finAct.setDate(finAct.getDate()+7);
  const finAnt = new Date(semAnt); finAnt.setDate(finAnt.getDate()+7);

  const semActStr=semAct.toISOString().slice(0,10);
  const finActStr=finAct.toISOString().slice(0,10);
  const semAntStr=semAnt.toISOString().slice(0,10);
  const finAntStr=finAnt.toISOString().slice(0,10);
  const regsAct = registros.filter(r=>(r.estado==='ok'||r.estado==='sub')&&parseInt(r.cap||0)>0&&(r.fecha||'')>=semActStr&&(r.fecha||'')<finActStr);
  const regsAnt = registros.filter(r=>(r.estado==='ok'||r.estado==='sub')&&parseInt(r.cap||0)>0&&(r.fecha||'')>=semAntStr&&(r.fecha||'')<finAntStr);
  const afoAct = regsAct.length>0?Math.round(regsAct.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/regsAct.length):null;
  const afoAnt = regsAnt.length>0?Math.round(regsAnt.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/regsAnt.length):null;
  if(afoAct===null||afoAnt===null)return{delta:0,label:'Sin datos comparables'};
  const delta = afoAct-afoAnt;
  return{delta,actStr:afoAct+'%',antStr:afoAnt+'%',label:(delta>=0?'▲ +':' ▼ ')+Math.abs(delta)+'% vs sem. anterior'};
}

function semColorKpi(pct, meta=60) {
  if(pct>=meta)return'var(--neon)';
  if(pct>=meta*0.65)return'var(--gold2)';
  return'var(--red2)';
}

function renderQuickAlerts() {
  const alertas = calcularAlertas().filter(a=>a.tipo==='red');
  if(alertas.length===0){
    document.getElementById('quick-alerts').innerHTML='';
    return;
  }
  document.getElementById('quick-alerts').innerHTML =
    `<div style="background:rgba(224,80,80,.1);border:1px solid var(--red);border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;gap:.7rem;cursor:pointer" onclick="irAlertas()">
      <span style="font-size:1.1rem"><svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg></span>
      <div style="flex:1;font-size:.78rem"><strong style="color:var(--red2)">${alertas.length} alerta(s) crítica(s)</strong> — ${alertas[0].texto.replace(/<[^>]+>/g,'')}</div>
      <span style="font-size:.72rem;color:var(--red2)">Ver todas →</span>
    </div>`;
}
function irAlertas(){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.vista').forEach(x=>x.classList.remove('on'));
  document.querySelector('[data-v="alertas"]').classList.add('on');
  document.getElementById('v-alertas').classList.add('on');
  renderAlertas();
}

// ═══════════════════════════════════════════
// PERSISTENCIA LOCAL + FIREBASE — versión unificada
// ═══════════════════════════════════════════

// ── Estado de sincronización ─────────────────
let fbApp = null, fbDb = null;
let fbSyncing   = false;   // true mientras estamos subiendo a Firebase
let fbReceiving = false;   // true mientras procesamos datos que bajan de Firebase
let fbListener  = null;    // referencia al listener activo (para evitar duplicados)
let fbWasOffline = false;
let fbInicializado = false; // true SOLO después de recibir la primera respuesta de Firebase
                             // NUNCA subir datos hasta que esto sea true
let fbDataRecibida = false;  // true SOLO cuando Firebase devolvió datos reales (no null/vacío)
                              // Dispositivo sin datos NUNCA sube hasta confirmar que Firebase también está vacío
let _fbMaxRegistros  = 0;    // máximo de registros conocidos en Firebase — protege contra borrados accidentales
let _fbMaxRecorridos = 0;    // igual para recorridos

const FIREBASE_ACTIVO = true;
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC3_83rzlemRzDEr5rbQoYTzvLock5xkjE",
  authDomain:        "fitness-campestre-e218c.firebaseapp.com",
  databaseURL:       "https://fitness-campestre-e218c-default-rtdb.firebaseio.com",
  projectId:         "fitness-campestre-e218c",
  storageBucket:     "fitness-campestre-e218c.firebasestorage.app",
  messagingSenderId: "813526273487",
  appId:             "1:813526273487:web:3a3643ae3d95d44d4a16ba"
};

// ── Normalización de tipos ────────────────────
function normalizarRegistros(){
  registros = registros.map(r=>({
    ...r,
    id:         parseInt(r.id)         || r.id,
    inst_id:    parseInt(r.inst_id)    || r.inst_id,
    asistentes: parseInt(r.asistentes) || 0,
    cap:        parseInt(r.cap)        || 20,
    dur:        parseInt(r.dur)        || 60,
    suplente_id: r.suplente_id ? (parseInt(r.suplente_id) || r.suplente_id) : null
  }));
}

// ── Guardar en localStorage ───────────────────
function guardarLocal(){
  try{
    const ts = Date.now();
    localStorage.setItem('fc_instructores', JSON.stringify(instructores));
    localStorage.setItem('fc_registros',    JSON.stringify(registros));
    localStorage.setItem('fc_recorridos',   JSON.stringify(recorridos));
    localStorage.setItem('fc_salones',      JSON.stringify(salones));
    localStorage.setItem('fc_suplencias',   JSON.stringify(suplenciasPlan));
    localStorage.setItem('fc_solicitudes',  JSON.stringify(solicitudesInst));
    localStorage.setItem('fc_ts', ts);
    // fc_local_ts solo se actualiza cuando el cambio viene de este dispositivo
    if(!fbReceiving) localStorage.setItem('fc_local_ts', ts);
  } catch(e){ console.warn('localStorage lleno o no disponible', e); }
}

// ── Cargar desde localStorage ─────────────────
function cargarLocal(){
  try{
    const inst = localStorage.getItem('fc_instructores');
    const regs = localStorage.getItem('fc_registros');
    const recs = localStorage.getItem('fc_recorridos');
    const sals = localStorage.getItem('fc_salones');
    const sups = localStorage.getItem('fc_suplencias');
    const sols = localStorage.getItem('fc_solicitudes');
    if(inst) instructores    = JSON.parse(inst);
    if(regs) registros       = JSON.parse(regs);
    if(recs) recorridos      = JSON.parse(recs);
    if(sals) salones         = JSON.parse(sals);
    if(sups) suplenciasPlan  = JSON.parse(sups);
    if(sols) solicitudesInst = JSON.parse(sols);
    normalizarRegistros();
    const ts = localStorage.getItem('fc_ts');
    
    return !!(inst || regs);
  } catch(e){
    console.warn('Error cargando localStorage:', e);
    return false;
  }
}

// ── Subir TODOS los datos a Firebase ─────────
async function sincronizarFirebase(){
  if(!FIREBASE_ACTIVO || !fbDb || fbSyncing || fbReceiving) return;

  // ── GUARDIA CRÍTICA: nunca subir antes de recibir la primera respuesta de Firebase ──
  // Esto evita que un dispositivo recién abierto (localStorage vacío) sobreescriba
  // con datos vacíos antes de saber qué hay en la nube.
  if(!fbInicializado){
    console.warn('⏳ Firebase aún no inicializado — subida pospuesta');
    return;
  }

  // ── GUARDIA NIVEL 1: bloquear si nunca hemos recibido datos reales de Firebase ──
  // Un dispositivo recién abierto (localStorage vacío) NUNCA puede subir datos
  // hasta haber confirmado que Firebase también está vacío.
  if(!fbDataRecibida){
    // Firebase aún no nos confirmó su estado real — posponer subida
    if(registros.length === 0 && recorridos.length === 0){
      showToast('⏳ Esperando confirmación de Firebase antes de sincronizar…','info');
      return;
    }
    // Tenemos datos locales y Firebase no respondió aún → OK subir (datos propios)
  }

  // ── GUARDIA NIVEL 2: nunca subir si los datos locales están vacíos ─────────────
  // Un dispositivo con 0 registros nunca debe sobrescribir datos en Firebase.
  if(registros.length === 0 && recorridos.length === 0){
    try {
      const fbSnap = await fbDb.ref('fitness/registros').once('value');
      const fbVal  = fbSnap.val();
      if(fbVal && Object.keys(fbVal).length > 0){
        console.warn('🚫 Local vacío pero Firebase tiene datos — subida cancelada');
        return;
      }
    } catch(e){
      // Si la lectura de verificación falla, NO subir — es más seguro esperar
      console.warn('🚫 No se pudo verificar Firebase — subida cancelada por seguridad:', e.message);
      showToast('⚠ Sin conexión — sincronización pospuesta por seguridad','warn');
      return;
    }
  }

  // ── GUARDIA NIVEL 3: protección contra reducción drástica de datos ─────────────
  // Si vamos a subir significativamente menos registros de los que conocemos,
  // bloquear la subida para evitar borrados accidentales.
  const _umbralSeguridad = Math.floor(_fbMaxRegistros * 0.6);
  if(_fbMaxRegistros > 5 && registros.length < _umbralSeguridad){
    console.warn(`🚫 Reducción drástica detectada: ${registros.length} vs ${_fbMaxRegistros} conocidos — subida cancelada`);
    showToast(`⚠ Sincronización bloqueada: se detectaron ${registros.length} registros locales vs ${_fbMaxRegistros} en la nube. Recarga para resolver.`,'warn');
    return;
  }

  fbSyncing = true;
  try{
    const ts = Date.now();
    // Incluir hoja de firmas activa para que instructores en otros dispositivos la vean
    let _hojaFirmas = null;
    try { _hojaFirmas = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null'); } catch(e){}
    const payload = {
      instructores,
      registros:   registros.reduce((a,r)=>{ a[String(r.id)]=r; return a; },{}),
      recorridos:  recorridos.reduce((a,r)=>{ a[String(r.id)]=r; return a; },{}),
      salones,
      suplencias:  suplenciasPlan.reduce((a,s)=>{ a[String(s.id)]=s; return a; },{}),
      solicitudes: solicitudesInst.reduce((a,s)=>{ a[String(s.id)]=s; return a; },{}),
      hojaFirmasActiva: _hojaFirmas,
      ts
    };
    await fbDb.ref('fitness').set(payload);
    // Actualizar fc_local_ts para que otros dispositivos sepan cuándo fue esto
    localStorage.setItem('fc_local_ts', String(ts));
    // Actualizar contadores máximos tras subida exitosa
    if(registros.length  > _fbMaxRegistros)  _fbMaxRegistros  = registros.length;
    if(recorridos.length > _fbMaxRecorridos) _fbMaxRecorridos = recorridos.length;
    fbDataRecibida = true;
    setIndicador('🟢 Guardado en la nube ✔');
  } catch(e){
    console.warn('Firebase sync error:', e.message);
    setIndicador('🔴 Sin conexión — datos guardados localmente');
  } finally{
    setTimeout(()=>{ fbSyncing = false; }, 600);
  }
}

// ── renderAll con auto-guardado ───────────────
// IMPORTANTE: sobreescribimos renderAll UNA SOLA VEZ aquí
const _renderAllBase = renderAll;
renderAll = function(){
  _renderAllBase();
  guardarLocal();
  // Subir a Firebase con un pequeño debounce para no saturar en ediciones rápidas
  clearTimeout(renderAll._timer);
  renderAll._timer = setTimeout(sincronizarFirebase, 800);
};
renderAll._timer = null;

// ═══════════════════════════════════════════════════════
