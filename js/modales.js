// ═══ MODALES — Fitness Control · Club Campestre ═══
// ═══ MODALES ═══
function abrirModal(id){
  document.getElementById(id).classList.add('on');
  const opts=instructores.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  if(id==='m-clase'){
    document.getElementById('rc-inst').innerHTML=opts;
    document.getElementById('rc-fecha').value=hoy.toISOString().slice(0,10);
    document.getElementById('rc-suplente').innerHTML='<option value="">— Sin suplente —</option>'+opts;
    cargarHorariosInst();
  }
  if(id==='m-falta'){
    document.getElementById('rf-inst').innerHTML=opts;
    cargarClasesInst('rf');
  }
  if(id==='m-suplencias'){
    document.getElementById('sup-filtro-inst').innerHTML='<option value="">— Todos los suplentes —</option>'+opts;
    const ini=new Date(lunesBase);ini.setDate(ini.getDate()-28);
    document.getElementById('sup-fecha-ini').value=ini.toISOString().slice(0,10);
    document.getElementById('sup-fecha-fin').value=hoy.toISOString().slice(0,10);
    document.getElementById('sup-body').innerHTML='';
    document.getElementById('sup-export-btns').style.display='none';
  }
}
function cerrarModal(id){document.getElementById(id).classList.remove('on');}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on');}));

function cargarClasesInst(pref){
  const instId=parseInt(document.getElementById(pref+'-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const clases=inst?[...new Set(inst.horario.map(h=>h.clase))]:TIPOS_CLASE;
  const opts=clases.map(c=>`<option>${c}</option>`).join('');
  document.getElementById(pref+'-clase').innerHTML=opts;
}

// ── Carga los horarios del instructor seleccionado en el modal "+ Clase" ──
function cargarHorariosInst(){
  const instId = parseInt(document.getElementById('rc-inst').value);
  const inst   = instructores.find(i => i.id === instId);
  const selHor = document.getElementById('rc-horario');
  const preview   = document.getElementById('rc-slot-preview');
  const sinMsg    = document.getElementById('rc-sin-horarios');

  // Limpiar campos ocultos
  document.getElementById('rc-clase').value = '';
  document.getElementById('rc-dia').value   = '';
  document.getElementById('rc-hora').value  = '';
  if(preview)  preview.style.display  = 'none';
  if(sinMsg)   sinMsg.style.display   = 'none';

  if(!inst || !(inst.horario||[]).length){
    selHor.innerHTML = '<option value="">— Sin horarios asignados —</option>';
    selHor.disabled  = true;
    if(sinMsg && inst) sinMsg.style.display = 'block';
    return;
  }

  selHor.disabled = false;
  // Ordenar slots: por día de la semana primero, luego por hora
  const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const slots = [...inst.horario].sort((a,b)=>{
    const di = ordenDias.indexOf(a.dia) - ordenDias.indexOf(b.dia);
    return di !== 0 ? di : a.hora.localeCompare(b.hora);
  });

  selHor.innerHTML = '<option value="">— Selecciona un horario —</option>' +
    slots.map((s,i) =>
      `<option value="${i}">${s.dia}  ·  ${s.hora}  —  ${s.clase}</option>`
    ).join('');

  // Si solo hay 1 slot, seleccionarlo automáticamente
  if(slots.length === 1){
    selHor.value = '0';
    autoRellenarHorario();
  }
}

// ── Al elegir un horario, rellena los campos ocultos y muestra la tarjeta ──
function autoRellenarHorario(){
  const instId = parseInt(document.getElementById('rc-inst').value);
  const inst   = instructores.find(i => i.id === instId);
  const idx    = document.getElementById('rc-horario').value;
  const preview   = document.getElementById('rc-slot-preview');
  const sinMsg    = document.getElementById('rc-sin-horarios');

  if(idx === '' || !inst){
    if(preview) preview.style.display = 'none';
    document.getElementById('rc-clase').value = '';
    document.getElementById('rc-dia').value   = '';
    document.getElementById('rc-hora').value  = '';
    return;
  }

  const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const slots = [...inst.horario].sort((a,b)=>{
    const di = ordenDias.indexOf(a.dia) - ordenDias.indexOf(b.dia);
    return di !== 0 ? di : a.hora.localeCompare(b.hora);
  });

  const slot = slots[parseInt(idx)];
  if(!slot) return;

  // Rellenar campos ocultos que usa guardarClase()
  document.getElementById('rc-clase').value = slot.clase;
  document.getElementById('rc-dia').value   = slot.dia;
  document.getElementById('rc-hora').value  = slot.hora;

  // Capacidad automática desde salones
  const capAuto = getCapClase(slot.clase);
  document.getElementById('rc-cap').value = capAuto;

  // Mostrar tarjeta visual
  if(preview){
    document.getElementById('rc-prev-clase').textContent = slot.clase;
    document.getElementById('rc-prev-dia').textContent   = slot.dia;
    document.getElementById('rc-prev-hora').textContent  = slot.hora;
    preview.style.display = 'block';
  }
  if(sinMsg) sinMsg.style.display = 'none';
}

function toggleSuplenteClase(){
  const v=document.getElementById('rc-est').value;
  document.getElementById('rc-suplente-row').style.display=(v==='sub')?'flex':'none';
}
function toggleSuplenteRec(){
  const v=document.getElementById('rcc-pres').value;
  const row=document.getElementById('rcc-suplente-row');
  row.style.display=(v==='sub')?'flex':'none';
  if(v==='sub'){
    const c=recActual.clasesActivas[recIdx];
    const opts=instructores.filter(i=>i.id!==c.inst_id).map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
    document.getElementById('rcc-suplente').innerHTML='<option value="">— Seleccionar —</option>'+opts;
  }
}

// ═══ MODAL INSTRUCTOR ═══
function abrirModalInstructor(id){
  actualizarSelectoresClase();
  if(id){
    const inst=instructores.find(i=>i.id===id);
    document.getElementById('mi-ttl').textContent='<svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg> Editar Instructor';
    document.getElementById('mi-id').value=id;
    document.getElementById('mi-nombre').value=inst.nombre;
    document.getElementById('mi-tipo').value=inst.tipo;
    document.getElementById('mi-turno').value=inst.turno;
    document.getElementById('mi-esp').value=inst.esp||'';
    tmpSlots=[...(inst.horario||[])];
    document.getElementById('mi-del').style.display='block';
  } else {
    document.getElementById('mi-ttl').textContent='+ Nuevo Instructor';
    document.getElementById('mi-id').value='';
    document.getElementById('mi-nombre').value='';
    document.getElementById('mi-tipo').value='planta';
    document.getElementById('mi-turno').value='ambos';
    document.getElementById('mi-esp').value='';
    tmpSlots=[];
    document.getElementById('mi-del').style.display='none';
  }
  renderSlots();
  document.getElementById('m-instructor').classList.add('on');
}
function renderSlots(){
  const cont=document.getElementById('mi-slots');
  if(tmpSlots.length===0){cont.innerHTML='<div style="font-size:.75rem;color:var(--txt3);text-align:center;padding:.5rem">Sin clases asignadas aún</div>';return;}
  cont.innerHTML=tmpSlots.map((s,i)=>`
    <div class="sch-slot">
      <span style="font-size:.75rem;color:var(--txt2);min-width:70px">${s.dia}</span>
      <span class="mono" style="color:var(--gold2);min-width:46px">${s.hora}</span>
      <span style="flex:1;font-size:.82rem;font-weight:600">${s.clase}</span>
      <button class="sch-rm" onclick="quitarSlot(${i})"><svg class="ico" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    </div>`).join('');
}
function agregarSlot(){
  const dia=document.getElementById('s-dia').value;
  const hora=document.getElementById('s-hora').value;
  const clase=getClaseSeleccionada();
  if(!clase){toast('Escribe el nombre de la clase','err');return;}
  if(tmpSlots.find(s=>s.dia===dia&&s.hora===hora)){toast('Ya hay una clase asignada en ese horario','warn');return;}
  tmpSlots.push({dia,hora,clase});
  tmpSlots.sort((a,b)=>{const di=DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia);return di!==0?di:a.hora.localeCompare(b.hora);});
  renderSlots();
  document.getElementById('s-clase-custom').style.display='none';
  document.getElementById('s-clase-custom').value='';
}
function quitarSlot(i){tmpSlots.splice(i,1);renderSlots();}
function guardarInstructor(){
  const id=parseInt(document.getElementById('mi-id').value)||0;
  const nombre=document.getElementById('mi-nombre').value.trim();
  if(!nombre){toast('Ingresa el nombre del instructor','err');document.getElementById('mi-nombre').classList.add('input-error');return;}
  const data={nombre,tipo:document.getElementById('mi-tipo').value,turno:document.getElementById('mi-turno').value,esp:document.getElementById('mi-esp').value.trim(),horario:[...tmpSlots]};
  if(id){const idx=instructores.findIndex(i=>i.id===id);instructores[idx]={...instructores[idx],...data};}
  else{const nid=Math.max(...instructores.map(i=>i.id),0)+1;instructores.push({id:nid,...data});}
  cerrarModal('m-instructor');renderAll();
  toast(`Instructor ${id?'actualizado':'agregado'} correctamente`,'ok');
}
function eliminarInstructor(){
  const id=parseInt(document.getElementById('mi-id').value);
  if(!confirm('¿Eliminar este instructor?'))return;
  instructores=instructores.filter(i=>i.id!==id);
  cerrarModal('m-instructor');renderAll();
}

