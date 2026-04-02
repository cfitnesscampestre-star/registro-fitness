// ═══ SALONES — Fitness Control · Club Campestre ═══
// ═══════════════════════════════════════════
// SALONES — CAPACIDAD POR SALÓN
// ═══════════════════════════════════════════
let salones = JSON.parse(localStorage.getItem('fc_salones') || 'null') || [
  {id:1, nombre:'Salón Principal', cap:20, tipo:'salon', clases:[]},
  {id:2, nombre:'Estudio Spinning', cap:20, tipo:'spinning', clases:['Spinning','Indoor Cycling','Ciclismo Indoor']},
  {id:3, nombre:'Sala Yoga', cap:15, tipo:'yoga', clases:['Yoga','Pilates','Stretching']},
];

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
    return `<div class="arow">
      <div class="adot" style="background:${col}"></div>
      <span style="flex:1;font-size:.83rem">${clase}</span>
      <span style="font-size:.75rem;color:var(--txt2)">${salon?salon.nombre:'<span style="color:var(--txt3)">Sin salón asignado</span>'}</span>
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

  document.getElementById('ms-ttl').textContent = salon ? '<svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg> Editar Salón' : '+ Nuevo Salón';
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
  if(!nombre){toast('Ingresa el nombre del salón','err');document.getElementById('ms-nombre').classList.add('input-error');return;}
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
  toast(`Salón ${id?'actualizado':'agregado'} correctamente`,'ok');

function eliminarSalon() {
  const id = parseInt(document.getElementById('ms-id').value);
  if(!confirm('¿Eliminar este salón?'))return;
  salones = salones.filter(s=>s.id!==id);
  localStorage.setItem('fc_salones',JSON.stringify(salones));
  cerrarModal('m-salon');
  renderSalones();
}

// ═══════════════════════════════════════════
// MAPA DE CALOR
// ═══════════════════════════════════════════
// ── Helpers filtros heatmap ──────────────────────────────────────
