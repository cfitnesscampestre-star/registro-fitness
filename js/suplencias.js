// ═══ SUPLENCIAS — Fitness Control · Club Campestre ═══
// SUPLENCIAS PLANIFICADAS
// ═══════════════════════════════════════════
let suplenciasPlan = JSON.parse(localStorage.getItem('fc_suplencias')||'[]');
let solicitudesInst = JSON.parse(localStorage.getItem('fc_solicitudes')||'[]');

// ── Tab handler para sup-plan ──────────────
document.querySelector('[data-v="sup-plan"]')?.addEventListener('click',()=>{
  renderSupPlan();
});

function renderSupPlan(){
  renderPines();
  renderSolicitudesPendientes();
  renderTablaSuplencias();
}

// ── PINs de instructores ───────────────────
function renderPines(){
  const cont = document.getElementById('pines-body');
  if(!cont)return;
  if(!instructores.length){cont.innerHTML='<div class="empty">Sin instructores cargados.</div>';return;}
  cont.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.5rem">
    ${instructores.map(inst=>{
      const pinGuardado=inst.pin||localStorage.getItem(`fc_pin_${inst.id}`)||'1234';
      return`<div style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:.65rem .85rem;display:flex;align-items:center;gap:.6rem">
        <div style="flex:1;font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inst.nombre.split(' ')[0]}</div>
        <input type="text" maxlength="6" value="${pinGuardado}"
          style="width:64px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:4px 7px;color:var(--gold2);font-family:'DM Mono',monospace;font-size:.85rem;text-align:center;outline:none"
          onchange="guardarPinInst(${inst.id},this.value)"
          title="PIN de ${inst.nombre}">
      </div>`;
    }).join('')}
  </div>
  <div style="font-size:.65rem;color:var(--txt3);margin-top:.5rem">
    ✏️ Haz clic en el PIN para editarlo · Los instructores usan este PIN para entrar al portal
  </div>`;
}

function guardarPinInst(instId, pin){
  if(!pin||pin.length<4){toast('El PIN debe tener al menos 4 caracteres','err');return;}
  // Guardar en el objeto instructor
  const idx=instructores.findIndex(i=>i.id===instId);
  if(idx>=0){instructores[idx].pin=pin;guardarLocal();sincronizarFirebase();}
  localStorage.setItem(`fc_pin_${instId}`,pin);
}

// ── Solicitudes de instructores ────────────
function renderSolicitudesPendientes(){
  const cont=document.getElementById('solicitudes-pendientes');
  if(!cont)return;
  // Cargar desde Firebase si está disponible
  const pend=(solicitudesInst||[]).filter(s=>s.estado==='pendiente').sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
  if(pend.length===0){
    cont.innerHTML='<div class="empty">Sin solicitudes pendientes.</div>';
    return;
  }
  cont.innerHTML=pend.map(s=>{
    const inst=instructores.find(i=>i.id===s.inst_id);
    const fd=s.fecha?new Date(s.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}):'—';
    const supSug=instructores.find(i=>i.id===s.suplente_id);
    return`<div style="background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.25);border-left:3px solid var(--gold2);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
        <div>
          <div style="font-weight:700;font-size:.9rem">${inst?inst.nombre:'?'} <span style="font-weight:400;color:var(--txt2);font-size:.78rem">solicita permiso</span></div>
          <div style="font-size:.78rem;color:var(--txt2);margin-top:2px"><strong>${s.clase}</strong> · ${s.dia} ${s.hora} · ${fd}</div>
          <div style="font-size:.72rem;color:var(--txt3);margin-top:2px">Motivo: ${s.motivo||'—'}${s.nota?' · '+s.nota:''}</div>
          ${supSug?`<div style="font-size:.72rem;color:var(--blue);margin-top:2px">Suplente sugerido: <strong>${supSug.nombre}</strong> (${s.score||0}pts)</div>`:''}
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button onclick="aprobarSolicitud(${s.id})" style="background:rgba(26,122,69,.2);color:var(--neon);border:1px solid var(--verde);border-radius:8px;padding:5px 12px;font-family:'Outfit',sans-serif;font-size:.73rem;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.background='var(--verde)'" onmouseout="this.style.background='rgba(26,122,69,.2)'">✔ Aprobar</button>
          <button onclick="rechazarSolicitud(${s.id})" style="background:rgba(224,80,80,.12);color:var(--red2);border:1px solid rgba(224,80,80,.3);border-radius:8px;padding:5px 12px;font-family:'Outfit',sans-serif;font-size:.73rem;font-weight:600;cursor:pointer;transition:all .2s">✖ Rechazar</button>
          <button onclick="editarSolicitudComoSuplencia(${s.id})" style="background:rgba(77,184,232,.1);color:var(--blue);border:1px solid rgba(77,184,232,.3);border-radius:8px;padding:5px 12px;font-family:'Outfit',sans-serif;font-size:.73rem;cursor:pointer">✏️ Editar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function aprobarSolicitud(id){
  const idx=solicitudesInst.findIndex(s=>s.id===id);
  if(idx<0)return;
  const s=solicitudesInst[idx];
  solicitudesInst[idx].estado='aprobado';
  // Crear suplencia planificada aprobada
  const nuevaSup={...s,estado:'aprobado',aprobado_ts:new Date().toISOString()};
  const existeIdx=suplenciasPlan.findIndex(sp=>sp.id===id);
  if(existeIdx>=0)suplenciasPlan[existeIdx]=nuevaSup;
  else suplenciasPlan.push(nuevaSup);
  guardarSupLocal();
  if(fbDb){
    try{
      await fbDb.ref(`fitness/solicitudes/${id}`).update({estado:'aprobado'});
      await fbDb.ref(`fitness/suplencias/${id}`).set(nuevaSup);
    }catch(e){}
  }
  renderSupPlan();
  toast(`Suplencia aprobada — ${s.clase} · ${s.fecha} · Suplente: ${instructores.find(i=>i.id===s.suplente_id)?.nombre||'—'}`,'ok',4500);
}

async function rechazarSolicitud(id){
  if(!confirm('¿Rechazar esta solicitud?'))return;
  const idx=solicitudesInst.findIndex(s=>s.id===id);
  if(idx<0)return;
  solicitudesInst[idx].estado='rechazado';
  guardarSupLocal();
  if(fbDb){
    try{
      await fbDb.ref(`fitness/solicitudes/${id}`).update({estado:'rechazado'});
      await fbDb.ref(`fitness/suplencias/${id}`).update({estado:'rechazado'});
    }catch(e){}
  }
  renderSupPlan();
}

function editarSolicitudComoSuplencia(id){
  const s=solicitudesInst.find(x=>x.id===id);
  if(!s)return;
  abrirModalNuevaSuplencia();
  setTimeout(()=>{
    document.getElementById('nsup-inst').value=s.inst_id;
    nsupCargarClases();
    setTimeout(()=>{
      document.getElementById('nsup-fecha').value=s.fecha;
      const claveClase=`${s.dia}||${s.hora}||${s.clase}`;
      document.getElementById('nsup-clase').value=claveClase;
      document.getElementById('nsup-motivo').value=s.motivo||'permiso';
      document.getElementById('nsup-nota').value=s.nota||'';
      document.getElementById('nsup-suplente').value=s.suplente_id||'';
      document.getElementById('nsup-id').value=id;
      nsupBuscarSugeridos();
    },100);
  },100);
}

// ── Tabla de suplencias aprobadas ──────────
function renderTablaSuplencias(){
  // Llenar filtro de instructores
  const selInst=document.getElementById('sp-fil-inst');
  if(selInst){
    const cur=selInst.value;
    selInst.innerHTML='<option value="">Todos los instructores</option>'+
      instructores.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
    if(cur)selInst.value=cur;
  }
  const estFil=document.getElementById('sp-fil-estado')?.value||'';
  const instFil=document.getElementById('sp-fil-inst')?.value||'';
  const iniFil=document.getElementById('sp-fil-ini')?.value||'';
  const finFil=document.getElementById('sp-fil-fin')?.value||'';

  let lista=suplenciasPlan.filter(s=>{
    if(estFil&&s.estado!==estFil)return false;
    if(instFil&&String(s.inst_id)!==instFil)return false;
    if(iniFil&&s.fecha<iniFil)return false;
    if(finFil&&s.fecha>finFil)return false;
    return true;
  }).sort((a,b)=>a.fecha.localeCompare(b.fecha));

  const tb=document.getElementById('tb-sup-plan');
  if(!tb)return;
  if(lista.length===0){
    tb.innerHTML=`<tr><td colspan="8"><div class="empty">Sin suplencias planificadas en el periodo.</div></td></tr>`;
    return;
  }
  const hoyStr=new Date().toISOString().slice(0,10);
  tb.innerHTML=lista.map(s=>{
    const instOrig=instructores.find(i=>i.id===s.inst_id);
    const sup=instructores.find(i=>i.id===s.suplente_id);
    const fd=s.fecha?new Date(s.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const esPasado=s.fecha<hoyStr;
    const estCol=s.estado==='aprobado'?'cok':s.estado==='rechazado'?'cbd':'cwn';
    const estTxt=s.estado==='aprobado'?'✔ Aprobada':s.estado==='rechazado'?'✖ Rechazada':s.estado==='pendiente_aprobacion'?'⏳ Pendiente':'—';
    return`<tr style="${esPasado?'opacity:.6':''}">
      <td class="mono" style="font-size:.74rem">${fd}</td>
      <td><strong>${s.clase||'—'}</strong></td>
      <td class="mono">${s.dia||'—'} ${s.hora||'—'}</td>
      <td style="font-size:.8rem">${instOrig?instOrig.nombre:'—'}</td>
      <td style="font-size:.8rem;color:var(--blue);font-weight:600">${sup?sup.nombre:'—'}</td>
      <td style="font-size:.75rem;color:var(--txt2)">${s.motivo||'—'}${s.nota?`<br><em style="color:var(--txt3)">${s.nota}</em>`:''}</td>
      <td><span class="chip ${estCol}">${estTxt}</span></td>
      <td>
        <div style="display:flex;gap:.3rem">
          <button class="abtn" onclick="abrirEditarSuplencia(${s.id})" style="font-size:.68rem;padding:2px 7px">✏️</button>
          <button class="abtn" onclick="eliminarSuplencia(${s.id})" style="color:var(--red2);font-size:.68rem;padding:2px 7px">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal nueva/editar suplencia ───────────
function abrirModalNuevaSuplencia(id){
  const opts=instructores.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  document.getElementById('nsup-inst').innerHTML='<option value="">— Instructor —</option>'+opts;
  document.getElementById('nsup-suplente').innerHTML='<option value="">— Seleccionar suplente —</option>'+opts;
  document.getElementById('nsup-clase').innerHTML='<option value="">— Selecciona instructor primero —</option>';
  document.getElementById('nsup-fecha').value=new Date().toISOString().slice(0,10);
  document.getElementById('nsup-nota').value='';
  document.getElementById('nsup-id').value='';
  document.getElementById('nsup-sug-wrap').style.display='none';
  document.getElementById('nsup-del').style.display='none';
  document.getElementById('nsup-ttl').textContent='⇄ Nueva Suplencia Planificada';
  if(id) abrirEditarSuplencia(id);
  document.getElementById('m-nueva-sup').classList.add('on');
}

function abrirEditarSuplencia(id){
  const s=suplenciasPlan.find(x=>x.id===id);
  if(!s)return;
  document.getElementById('nsup-ttl').textContent='✏️ Editar Suplencia';
  document.getElementById('nsup-id').value=id;
  document.getElementById('nsup-inst').value=s.inst_id;
  nsupCargarClases();
  setTimeout(()=>{
    const claveClase=`${s.dia}||${s.hora}||${s.clase}`;
    document.getElementById('nsup-clase').value=claveClase;
    document.getElementById('nsup-fecha').value=s.fecha;
    document.getElementById('nsup-motivo').value=s.motivo||'permiso';
    document.getElementById('nsup-nota').value=s.nota||'';
    document.getElementById('nsup-suplente').value=s.suplente_id||'';
    document.getElementById('nsup-del').style.display='block';
    nsupBuscarSugeridos();
  },80);
  document.getElementById('m-nueva-sup').classList.add('on');
}

function nsupCargarClases(){
  const instId=parseInt(document.getElementById('nsup-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const sel=document.getElementById('nsup-clase');
  if(!inst||(inst.horario||[]).length===0){
    sel.innerHTML='<option value="">— Sin horarios asignados —</option>';
    return;
  }
  const slots=[...inst.horario].sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)||a.hora.localeCompare(b.hora));
  sel.innerHTML='<option value="">— Selecciona clase —</option>'+
    slots.map(h=>`<option value="${h.dia}||${h.hora}||${h.clase}">${h.dia} ${h.hora} — ${h.clase}</option>`).join('');
}

function nsupBuscarSugeridos(){
  const instId=parseInt(document.getElementById('nsup-inst').value);
  const claseVal=document.getElementById('nsup-clase').value;
  const fecha=document.getElementById('nsup-fecha').value;
  if(!instId||!claseVal||!fecha){document.getElementById('nsup-sug-wrap').style.display='none';return;}
  const[dia,hora,clase]=claseVal.split('||');
  const sugs=calcularSugeridosAdmin(instId,dia,hora,clase,fecha);
  const wrap=document.getElementById('nsup-sug-wrap');
  wrap.style.display='';
  document.getElementById('nsup-sug-lista').innerHTML=sugs.length===0
    ?'<div style="font-size:.75rem;color:var(--txt2)">Sin candidatos automáticos disponibles.</div>'
    :sugs.slice(0,4).map((s,i)=>{
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      return`<div onclick="nsupSelSug(${s.id})" style="cursor:pointer;background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:.55rem .8rem;margin-bottom:.35rem;display:flex;align-items:center;gap:.6rem;transition:border-color .15s" onmouseover="this.style.borderColor='var(--v3)'" onmouseout="this.style.borderColor='var(--border)'">
        <span style="font-size:1rem;min-width:22px">${medal||'•'}</span>
        <div style="flex:1"><div style="font-size:.83rem;font-weight:600">${s.nombre}</div>
          <div style="font-size:.65rem;color:var(--txt2);margin-top:1px">${s.razon}</div></div>
        <span style="font-family:'DM Mono',monospace;font-size:.75rem;color:var(--neon);font-weight:700">${s.score}pts</span>
      </div>`;
    }).join('');
}

function nsupSelSug(instId){
  document.getElementById('nsup-suplente').value=instId;
}

function calcularSugeridosAdmin(excluirId, dia, hora, clase, fecha){
  const minHora=horaToMin(hora);
  const candidatos=[];
  instructores.forEach(inst=>{
    if(inst.id===excluirId)return;
    const tieneClase=(inst.horario||[]).some(h=>{
      if(h.dia!==dia)return false;
      return Math.abs(horaToMin(h.hora)-minHora)<60;
    });
    if(tieneClase)return;
    const tieneSup=suplenciasPlan.some(s=>s.suplente_id===inst.id&&s.fecha===fecha&&s.estado!=='rechazado');
    if(tieneSup)return;
    let score=50;
    const tieneExp=(inst.horario||[]).some(h=>h.clase.toLowerCase()===clase.toLowerCase());
    if(tieneExp)score+=30;
    const esp=(inst.esp||'').toLowerCase();
    if(esp.includes(clase.toLowerCase().split(' ')[0]))score+=15;
    const hasCubierto=registros.some(r=>r.suplente_id===inst.id&&r.clase===clase&&r.estado==='sub');
    if(hasCubierto)score+=10;
    const hoy30=new Date();hoy30.setDate(hoy30.getDate()-30);
    const faltasRec=registros.filter(r=>r.inst_id===inst.id&&r.estado==='falta'&&new Date(r.fecha)>=hoy30).length;
    score-=faltasRec*10;
    if((inst.horario||[]).length>=8)score-=5;
    score=Math.max(0,Math.min(100,score));
    const razones=[];
    if(tieneExp)razones.push(`Imparte ${clase}`);
    else if(esp)razones.push(inst.esp);
    if(hasCubierto)razones.push('Ya cubrió antes');
    if(faltasRec>0)razones.push(`${faltasRec} falta(s)`);
    candidatos.push({id:inst.id,nombre:inst.nombre,score,razon:razones.join(' · ')||'Disponible'});
  });
  return candidatos.sort((a,b)=>b.score-a.score).slice(0,4);
}

async function guardarNuevaSuplencia(){
  const idEdit=parseInt(document.getElementById('nsup-id').value)||0;
  const instId=parseInt(document.getElementById('nsup-inst').value);
  const claseVal=document.getElementById('nsup-clase').value;
  const fecha=document.getElementById('nsup-fecha').value;
  const supId=parseInt(document.getElementById('nsup-suplente').value)||null;
  if(!instId||!claseVal||!fecha){toast('Completa todos los campos obligatorios','err');return;}
  if(!supId){toast('Selecciona un instructor suplente','err');return;}
  const[dia,hora,clase]=claseVal.split('||');
  const datos={
    id:idEdit||Date.now(),
    inst_id:instId,
    suplente_id:supId,
    clase,dia,hora,fecha,
    motivo:document.getElementById('nsup-motivo').value,
    nota:document.getElementById('nsup-nota').value.trim(),
    estado:'aprobado',
    ts:new Date().toISOString()
  };
  const idx=suplenciasPlan.findIndex(s=>s.id===datos.id);
  if(idx>=0)suplenciasPlan[idx]=datos;
  else suplenciasPlan.push(datos);
  guardarSupLocal();
  if(fbDb){
    try{await fbDb.ref(`fitness/suplencias/${datos.id}`).set(datos);}catch(e){}
  }
  cerrarModal('m-nueva-sup');
  renderSupPlan();
  const sup=instructores.find(i=>i.id===supId);
  toast(`Suplencia guardada — ${clase} · ${fecha} · Suplente: ${sup?sup.nombre:'—'}`,'ok',4500);
}

async function eliminarSuplencia(id){
  const idDel=id||parseInt(document.getElementById('nsup-id').value);
  if(!confirm('¿Eliminar esta suplencia planificada?'))return;
  suplenciasPlan=suplenciasPlan.filter(s=>s.id!==idDel);
  guardarSupLocal();
  if(fbDb){try{await fbDb.ref(`fitness/suplencias/${idDel}`).remove();}catch(e){}}
  cerrarModal('m-nueva-sup');
  renderSupPlan();
}

// guardarSupLocal está definida arriba en la sección de Firebase unificada


// ── Portal de instructores ──────────────────
function abrirPortalInstructor(){
  window.open('instructor.html','_blank');
}
function copiarLinkPortal(){
  const url=window.location.href.replace('index.html','instructor.html').replace(/\?.*$/,'');
  const base=window.location.origin+window.location.pathname.replace('index.html','')+'instructor.html';
  navigator.clipboard?.writeText(base).then(()=>{
    const b=document.getElementById('btn-copiar-link');
    if(b){b.textContent='✔ Copiado!';setTimeout(()=>b.textContent='📋 Copiar Link',2000);}
  }).catch(()=>toast('Link: '+base,'info',6000));
}

// ── Guardar suplencias en local ────────────────
function guardarSupLocal(){
  guardarLocal(); // reutiliza guardarLocal que ya incluye suplencias y solicitudes
}

// ── Sincronizar suplencias también al guardar ──
// (guardarLocal y sincronizarFirebase ya incluyen suplencias — no se necesita override)


// ─── Arranque ───
(function init(){
  // Aplicar tema guardado
  aplicarTema(localStorage.getItem('fc_tema')||'oscuro');

  // ── Respaldo: eventos de red del navegador ──
  window.addEventListener('online', ()=>{
    setIndicador('🟡 Red recuperada · Sincronizando...');
    setTimeout(()=>{ if(!fbSyncing) sincronizarFirebase(); }, 900);
  });
  window.addEventListener('offline', ()=>{
    setIndicador('🔴 Sin conexión · Cambios guardados localmente');
  });

  // Verificar sesión guardada en la pestaña actual
  const rolGuardado = sessionStorage.getItem('fc_rol');
  if(rolGuardado === 'admin' || rolGuardado === 'usuario') {
    aplicarRol(rolGuardado);
    document.getElementById('login-screen').classList.add('oculto');
  }

  const hayLocal = cargarLocal();
  if(hayLocal){
    _renderAllBase();   // renderAll base — sin subir a Firebase todavía
    renderCal();
    console.log('💾 Datos restaurados desde almacenamiento local');
  }

  // Inicializar Firebase (conecta, carga y escucha cambios en tiempo real)
  inicializarFirebase();

  // Guardar antes de cerrar pestaña
  window.addEventListener('beforeunload', guardarLocal);
})();
</script>

