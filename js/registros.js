// ═══ GUARDAR CLASE ═══
function guardarClase(){
  _vClearAll(['rc-inst','rc-horario','rc-asis','rc-cap','rc-fecha','rc-suplente']);

  const instId=parseInt(document.getElementById('rc-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const claseNombre=document.getElementById('rc-clase').value;
  const diaVal=document.getElementById('rc-dia').value;
  const horaVal=document.getElementById('rc-hora').value;
  const fechaVal=document.getElementById('rc-fecha').value;
  const asisVal=parseInt(document.getElementById('rc-asis').value)||0;
  const capDefault=getCapClase(claseNombre);
  const capInput=parseInt(document.getElementById('rc-cap').value)||capDefault;
  const est=document.getElementById('rc-est').value;
  const supId=est==='sub'?parseInt(document.getElementById('rc-suplente').value)||null:null;
  const motivoSup=est==='sub'?(document.getElementById('rc-motivo').value||'permiso'):null;

  // Validaciones
  let ok=true;
  if(!inst){ _vErr('rc-inst','Selecciona un instructor'); showToast('Selecciona un instructor','err'); ok=false; }
  if(!claseNombre||!diaVal||!horaVal){ _vErr('rc-horario','Selecciona un horario'); showToast('Selecciona un horario del instructor','err'); ok=false; }
  if(!fechaVal){ _vErr('rc-fecha','La fecha es requerida'); showToast('Indica la fecha de la clase','err'); ok=false; }
  if(ok && fechaVal > new Date().toISOString().slice(0,10)){
    _vErr('rc-fecha','No puede ser fecha futura');
    showToast('La fecha no puede ser futura','warn'); ok=false;
  }
  if(asisVal < 0){ _vErr('rc-asis','Asistentes no puede ser negativo'); showToast('Asistentes no puede ser negativo','err'); ok=false; }
  if(capInput > 0 && asisVal > capInput * 1.5){
    _vErr('rc-asis',`${asisVal} supera el 150% de la capacidad (${capInput}). ¿Es correcto?`);
    showToast(`⚠ Asistentes (${asisVal}) supera 150% de la capacidad (${capInput}). Verifica el dato.`,'warn');
    // Advertencia pero no bloquea
  }
  if(est==='sub' && !supId){
    _vErr('rc-suplente','Selecciona un suplente');
    showToast('Selecciona el instructor suplente','err'); ok=false;
  }
  if(est==='sub' && supId && supId===instId){
    _vErr('rc-suplente','El suplente no puede ser el mismo instructor');
    showToast('El suplente no puede ser el mismo instructor','err'); ok=false;
  }
  // Detectar duplicado exacto en el mismo día/hora/fecha
  const duplicado=registros.find(r=>
    r.inst_id===instId && r.clase===claseNombre &&
    r.dia===diaVal && r.hora===horaVal && r.fecha===fechaVal &&
    (r.estado==='ok'||r.estado==='sub')
  );
  if(duplicado){
    showToast(`Ya existe un registro de ${claseNombre} para ${inst?.nombre} el ${fechaVal}. ¿Duplicado?`,'warn');
    // Advertencia pero no bloquea — puede ser legítimo
  }
  if(!ok) return;

  const nuevoIdClase=(registros.length>0?Math.max(...registros.map(r=>parseInt(r.id)||0)):0)+1;
  registros.push({id:nuevoIdClase,inst_id:instId,
    dia:diaVal, clase:claseNombre, hora:horaVal,
    asistentes:asisVal, cap:capInput,
    dur:parseInt(document.getElementById('rc-dur').value)||60,
    estado:est, fecha:fechaVal, tipo:'clase', suplente_id:supId,
    motivo_suplencia:motivoSup,
    updatedAt:Date.now()});
  cerrarModal('m-clase');renderAll();
  registrarLog('clase', `${inst.nombre} · ${claseNombre} · ${diaVal} ${horaVal} · ${fechaVal} · ${est==='sub'?'Suplencia':'Ok'} · ${asisVal} asis.`);
  showToast(`Clase registrada para ${inst.nombre}`,'ok');
}
function guardarFalta(){
  _vClearAll(['rf-inst','rf-dia','rf-clase']);
  const instId=parseInt(document.getElementById('rf-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const diaVal=document.getElementById('rf-dia').value;
  const claseVal=document.getElementById('rf-clase').value;
  let ok=true;
  if(!inst){ showToast('Selecciona un instructor','err'); ok=false; }
  if(!diaVal){ _vErr('rf-dia','Selecciona el día'); showToast('Indica el día de la falta','err'); ok=false; }
  if(!claseVal){ _vErr('rf-clase','Selecciona la clase'); showToast('Indica la clase afectada','err'); ok=false; }
  // Detectar falta duplicada
  if(ok && inst){
    const yaTieneFalta=registros.find(r=>
      r.inst_id===instId && r.dia===diaVal && r.clase===claseVal &&
      r.estado==='falta' && r.fecha===fechaLocalStr(hoy)
    );
    if(yaTieneFalta) showToast(`${inst.nombre} ya tiene falta registrada para ${claseVal} este día`,'warn');
  }
  if(!ok) return;
  const nuevoIdFalta=(registros.length>0?Math.max(...registros.map(r=>parseInt(r.id)||0)):0)+1;
  registros.push({id:nuevoIdFalta,inst_id:instId,dia:diaVal,
    clase:claseVal,hora:'00:00',asistentes:0,cap:0,dur:0,estado:'falta',
    fecha:fechaLocalStr(hoy),tipo:'falta',
    tipo_falta:document.getElementById('rf-tipo').value,
    nota:document.getElementById('rf-nota').value,suplente_id:null,
    updatedAt:Date.now()});
  cerrarModal('m-falta');renderAll();
  registrarLog('falta', `${inst.nombre} · ${claseVal} · ${diaVal} · ${document.getElementById('rf-tipo').value}`);
  showToast(`Falta registrada para ${inst.nombre}`,'warn');
}


// ═══════════════════════════════════════════════════════
