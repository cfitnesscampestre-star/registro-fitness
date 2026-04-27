// ═══ RECORRIDO ═══
let modoRecorrido = 'turbo'; // 'turbo' | 'clasico'
let turboPresEstado = 'si';

function selModoRec(modo){
  modoRecorrido = modo;
  const bt = document.getElementById('ri-modo-turbo');
  const bc = document.getElementById('ri-modo-clasico');
  if(!bt||!bc) return;
  if(modo==='turbo'){
    bt.style.border='2px solid var(--verde)';bt.style.background='rgba(26,122,69,.15)';
    bc.style.border='2px solid var(--border)';bc.style.background='transparent';
  } else {
    bc.style.border='2px solid var(--verde)';bc.style.background='rgba(26,122,69,.15)';
    bt.style.border='2px solid var(--border)';bt.style.background='transparent';
  }
}

function iniciarRecorrido(){
  document.getElementById('ri-fecha').value=fechaLocalStr(hoy);
  const ahora=new Date();
  document.getElementById('ri-hora').value=`${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}`;
  const diaActual=DIAS[(ahora.getDay()+6)%7];
  document.getElementById('ri-dia').value=diaActual;
  selModoRec('turbo');
  previewClasesActivas();
  document.getElementById('m-rec-init').classList.add('on');
}
function previewClasesActivas(){
  const hora=document.getElementById('ri-hora').value;
  const dia=document.getElementById('ri-dia').value;
  if(!hora||!dia)return;
  const clases=getClasesActivas(dia,hora);
  const prev=document.getElementById('ri-preview');
  if(clases.length===0){
    prev.innerHTML=`<div style="font-size:.75rem;color:var(--txt2);padding:.5rem;background:var(--panel2);border-radius:8px">Sin clases activas en ${dia} ${hora}</div>`;
  } else {
    prev.innerHTML=`<div style="font-size:.75rem;color:var(--neon);margin-bottom:.4rem">⚡ ${clases.length} clases activas a las ${hora}</div>`+
      clases.slice(0,5).map(c=>`<div style="font-size:.73rem;color:var(--txt2);padding:2px 0">• ${c.clase} — ${c.inst_nombre}</div>`).join('')+
      (clases.length>5?`<div style="font-size:.72rem;color:var(--txt3)">...y ${clases.length-5} más</div>`:'');
  }
}
function getClasesActivas(dia,horaRec){
  const minRec=horaToMin(horaRec);const resultado=[];
  instructores.forEach(inst=>{
    (inst.horario||[]).forEach(h=>{
      if(h.dia!==dia)return;
      const minIni=horaToMin(h.hora);const minFin=minIni+55;
      if(minRec>=minIni&&minRec<=minFin)resultado.push({inst_id:inst.id,inst_nombre:inst.nombre,clase:h.clase,hora:h.hora,dia:h.dia});
    });
  });
  return resultado.sort((a,b)=>a.hora.localeCompare(b.hora));
}
function comenzarRecorrido(){
  const fecha=document.getElementById('ri-fecha').value;
  const hora=document.getElementById('ri-hora').value;
  const dia=document.getElementById('ri-dia').value;
  if(!fecha){showToast('Selecciona la fecha','err');return;}
  const clases=getClasesActivas(dia,hora);
  if(clases.length===0){showToast(`No hay clases activas el ${dia} a las ${hora}`,'warn');return;}
  recActual={fecha,hora,dia,items:[],clasesActivas:clases};
  recIdx=0;
  cerrarModal('m-rec-init');
  if(modoRecorrido==='turbo'){
    iniciarTurbo();
  } else {
    mostrarClaseRec();
    document.getElementById('m-rec-cap').classList.add('on');
  }
}

// ─────────────────────────────────────────
// MODO TURBO
// ─────────────────────────────────────────
let turboSwipeStartX=0, turboSwipeStartY=0, turboSwiping=false;

function iniciarTurbo(){
  const sc = document.getElementById('turbo-screen');
  sc.style.display='flex';
  const fd = new Date(recActual.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short'});
  document.getElementById('turbo-fecha-lbl').textContent=`${fd} · ${recActual.dia} ${recActual.hora}`;
  turboMostrar();
  turboIniciarSwipe();
}

function turboMostrar(){
  const total=recActual.clasesActivas.length;
  const c=recActual.clasesActivas[recIdx];
  if(!c){terminarTurbo();return;}

  // Progreso
  const pct=Math.round(recIdx/total*100);
  document.getElementById('turbo-prog').textContent=`${recIdx+1} / ${total}`;
  document.getElementById('turbo-progbar').style.width=pct+'%';

  // Datos de la clase
  document.getElementById('tc-clase').textContent=c.clase;
  document.getElementById('tc-inst').textContent=c.inst_nombre;
  document.getElementById('tc-hora').textContent=c.hora;
  const salon=salones.find(s=>s.clases&&s.clases.some(cl=>cl.toLowerCase()===c.clase.toLowerCase()));
  document.getElementById('tc-salon').textContent=salon?`📍 ${salon.nombre} · ${salon.cap}p`:'';

  // Ocultar avisos de suplencia al inicio — evita que persistan de clase anterior
  const avisoElPrev=document.getElementById("tc-aviso-sup");
  if(avisoElPrev) avisoElPrev.style.display="none";

  // Fix: aviso de suplencia planificada — solo para esta clase específica
  const supPlan=(suplenciasPlan||[]).find(s=>
    String(s.inst_id)===String(c.inst_id) &&
    s.clase===c.clase && s.dia===c.dia && s.hora===c.hora &&
    s.fecha===recActual.fecha && s.estado!=='rechazado'
  );
  const avisoEl=document.getElementById('tc-aviso-sup');
  if(avisoEl){
    if(supPlan){
      const supNom=instructores.find(i=>String(i.id)===String(supPlan.suplente_id))?.nombre||supPlan.suplente_nombre||'Suplente externo';
      avisoEl.innerHTML=`⇄ Suplencia planificada: <strong>${supNom}</strong> · ${supPlan.motivo||''}`;
      avisoEl.style.display='block';
      // Pre-seleccionar estado sub y suplente automáticamente
      turboSetPres('sub');
      const selSup=document.getElementById('tc-suplente');
      if(selSup&&supPlan.suplente_id){
        const opts=instructores.filter(i=>i.id!==c.inst_id).map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
        selSup.innerHTML='<option value="">— Seleccionar suplente —</option>'+opts;
        selSup.value=String(supPlan.suplente_id);
      }
      const selMot=document.getElementById('tc-motivo');
      if(selMot) selMot.value=supPlan.motivo||'permiso';
    } else {
      avisoEl.style.display='none';
    }
  }

  // Capacidad desde salón (o del último registro histórico si existe)
  const capSalon=getCapClase(c.clase)||20;
  const histRecsAll=registros.filter(r=>String(r.inst_id)===String(c.inst_id)&&r.clase===c.clase&&r.dia===c.dia).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const capPrev=histRecsAll.length>0&&parseInt(histRecsAll[0].cap)>0?parseInt(histRecsAll[0].cap):capSalon;
  document.getElementById('tc-cap').value=capPrev;
  const histRecs=histRecsAll.filter(r=>r.estado==='ok'||r.estado==='sub');
  const sugerido=histRecs.length>0?histRecs[0].asistentes:0;
  document.getElementById('tc-asis').value=sugerido;
  turboActualizarColor();

  // Reset estado (solo si no había suplencia planificada)
  if(!supPlan){
    turboSetPres('si');
    document.getElementById('tc-obs').value='';
    document.getElementById('tc-suplente-row').style.display='none';
    const opts=instructores.filter(i=>i.id!==c.inst_id).map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
    document.getElementById('tc-suplente').innerHTML='<option value="">— Seleccionar suplente —</option>'+opts;
  } else {
    document.getElementById('tc-obs').value='';
  }

  // Chips de progreso
  turboActualizarChips();

  // Reset posición tarjeta y hints
  const card=document.getElementById('turbo-card');
  card.style.transition='transform .18s,opacity .18s,border-color .18s';
  card.style.transform='translateX(0) rotate(0deg)';
  card.style.opacity='1';
  card.style.borderColor=supPlan?'rgba(41,128,185,.5)':'var(--border)';
  document.getElementById('turbo-hint-left').style.opacity='0';
  document.getElementById('turbo-hint-right').style.opacity='0';

  // Focus al número
  setTimeout(()=>document.getElementById('tc-asis').focus(),200);
}

function turboActualizarChips(){
  const total=recActual.clasesActivas.length;
  let html='';
  recActual.clasesActivas.forEach((c,i)=>{
    const item=recActual.items.find(it=>String(it.inst_id)===String(c.inst_id)&&it.hora===c.hora&&it.clase===c.clase);
    let bg='var(--border)',col='var(--txt3)',icono='';
    if(item&&!item.saltado){
      const afo=item.asis>0&&item.cap>0?Math.round(item.asis/item.cap*100):0;
      bg=item.presente==='no'?'var(--red)':item.asis>=1?pctCol(afo):'var(--txt3)';
      icono=item.presente==='no'?'✖':item.presente==='sub'?'⇄':'✔';
      col='#fff';
    } else if(item&&item.saltado){
      bg='var(--txt3)';icono='⏭';col='var(--bg)';
    }
    const isCur=i===recIdx;
    html+=`<div onclick="turboIrA(${i})" title="${c.clase} — ${c.inst_nombre}"
      style="flex-shrink:0;min-width:${isCur?'80px':'52px'};height:34px;border-radius:8px;
             background:${isCur?'var(--verde)':bg};
             border:${isCur?'2px solid var(--neon)':'1px solid transparent'};
             display:flex;align-items:center;justify-content:center;gap:3px;
             cursor:pointer;transition:all .15s;padding:0 6px">
      <span style="font-size:.6rem;color:${isCur?'#fff':col};font-weight:${isCur?'700':'400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px">
        ${isCur?c.clase.slice(0,9):icono||'·'}
      </span>
    </div>`;
  });
  const cont=document.getElementById('turbo-chips');
  cont.innerHTML=html;
  // Scroll al chip activo
  setTimeout(()=>{
    const chips=cont.children;
    if(chips[recIdx])chips[recIdx].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  },50);
}

function turboIrA(idx){
  // Solo permite ir a clases ya registradas o la actual
  recIdx=idx;
  turboMostrar();
}

function turboAjustar(delta){
  const inp=document.getElementById('tc-asis');
  inp.value=Math.max(0,(parseInt(inp.value)||0)+delta);
  turboActualizarColor();
}

function turboActualizarColor(){
  const c=recActual.clasesActivas[recIdx];
  if(!c)return;
  const asis=parseInt(document.getElementById('tc-asis').value)||0;
  const capInput=document.getElementById('tc-cap');
  const cap=capInput?parseInt(capInput.value)||getCapClase(c.clase)||20:getCapClase(c.clase)||20;
  const pct=Math.min(Math.round(asis/cap*100),100);
  const col=asis===0?'var(--txt3)':pct>=70?'var(--neon)':pct>=35?'var(--gold2)':'var(--red2)';
  document.getElementById('tc-afo-bar').style.width=pct+'%';
  document.getElementById('tc-afo-bar').style.background=col;
  document.getElementById('tc-afo-lbl').textContent=asis===0?'Sin asistentes':`${pct}% aforo · ${cap} cap.`;
  document.getElementById('tc-asis').style.color=col;
  if(capInput){capInput.style.borderColor=col;}
}

function turboSetPres(estado){
  turboPresEstado=estado;
  const btns={si:'tc-btn-si',no:'tc-btn-no',sub:'tc-btn-sub'};
  const cols={si:'var(--verde)',no:'var(--red)',sub:'#1a5fa3'};
  const bgs={si:'rgba(26,122,69,.25)',no:'rgba(224,80,80,.2)',sub:'rgba(26,95,163,.2)'};
  const txts={si:'var(--neon)',no:'var(--red2)',sub:'var(--blue)'};
  Object.keys(btns).forEach(k=>{
    const b=document.getElementById(btns[k]);
    if(k===estado){
      b.style.border=`2px solid ${cols[k]}`;
      b.style.background=bgs[k];
      b.style.color=txts[k];
    } else {
      b.style.border='2px solid var(--border)';
      b.style.background='transparent';
      b.style.color='var(--txt2)';
    }
  });
  document.getElementById('tc-suplente-row').style.display=estado==='sub'?'block':'none';
  // Mostrar fila de motivo para falta Y para suplencia
  // tc-falta-row: fila de motivo para Ausente (independiente de tc-suplente-row)
  const faltaRow=document.getElementById('tc-falta-row');
  if(faltaRow) faltaRow.style.display=estado==='no'?'block':'none';
  if(navigator.vibrate) navigator.vibrate(15);
}

function turboGuardar(){
  const c=recActual.clasesActivas[recIdx];
  if(!c)return;
  const asis=parseInt(document.getElementById('tc-asis').value)||0;
  const supId=turboPresEstado==='sub'?(parseInt(document.getElementById('tc-suplente').value)||null):null;
  // Capturar motivo: para sub usa tc-motivo, para falta usa tc-motivo-falta
  let motivoSup=null;
  if(turboPresEstado==='sub'){
    const mEl=document.getElementById('tc-motivo');
    motivoSup=mEl?mEl.value||'permiso':null;
  } else if(turboPresEstado==='no'){
    const mEl=document.getElementById('tc-motivo-falta');
    motivoSup=mEl?mEl.value||'injustificada':null;
  }
  const obs=document.getElementById('tc-obs').value.trim();
  const cap=parseInt(document.getElementById('tc-cap').value)||parseInt(getCapClase(c.clase))||20;
  // Normalizar inst_id a número para evitar mismatch con Firebase
  const instIdNum=parseInt(c.inst_id)||c.inst_id;
  const existeIdx=recActual.items.findIndex(it=>String(it.inst_id)===String(c.inst_id)&&it.hora===c.hora&&it.clase===c.clase);
  const item={...c,inst_id:instIdNum,asis,presente:turboPresEstado,suplente_id:supId,motivo_suplencia:motivoSup,obs,saltado:false,cap};
  if(existeIdx>=0)recActual.items[existeIdx]=item;
  else recActual.items.push(item);
  if(navigator.vibrate) navigator.vibrate([20,10,20]);
  turboAvanzar();
}

function turboSaltar(){
  const c=recActual.clasesActivas[recIdx];
  const existeIdx=recActual.items.findIndex(it=>String(it.inst_id)===String(c.inst_id)&&it.hora===c.hora&&it.clase===c.clase);
  const item={...c,asis:0,presente:'si',suplente_id:null,obs:'',saltado:true,cap:getCapClase(c.clase)||20};
  if(existeIdx>=0)recActual.items[existeIdx]=item;
  else recActual.items.push(item);
  turboAvanzar();
}

function turboAvanzar(){
  recIdx++;
  if(recIdx>=recActual.clasesActivas.length){
    // Fin del recorrido
    document.getElementById('turbo-screen').style.display='none';
    terminarRecorrido();
  } else {
    // Animación de salida suave
    const card=document.getElementById('turbo-card');
    card.style.transition='transform .12s,opacity .12s';
    card.style.transform='translateX(-30px)';
    card.style.opacity='0.3';
    setTimeout(()=>{
      card.style.transition='none';
      card.style.transform='translateX(30px)';
      card.style.opacity='0';
      setTimeout(()=>turboMostrar(),30);
    },120);
  }
}

function terminarTurbo(){
  if(!confirm('¿Terminar el recorrido? Las clases no visitadas quedarán sin registrar.'))return;
  document.getElementById('turbo-screen').style.display='none';
  // Completar con saltado las que no se registraron
  recActual.clasesActivas.forEach(c=>{
    const existe=recActual.items.find(it=>String(it.inst_id)===String(c.inst_id)&&it.hora===c.hora&&it.clase===c.clase);
    if(!existe)recActual.items.push({...c,asis:0,presente:'si',suplente_id:null,obs:'',saltado:true,cap:getCapClase(c.clase)||20});
  });
  terminarRecorrido();
}

// ── Swipe con touch ──────────────────────────────────────────────
function turboIniciarSwipe(){
  const card=document.getElementById('turbo-card');
  if(!card)return;
  card.addEventListener('touchstart',e=>{
    turboSwipeStartX=e.touches[0].clientX;
    turboSwipeStartY=e.touches[0].clientY;
    turboSwiping=true;
    card.style.transition='none';
  },{passive:true});
  card.addEventListener('touchmove',e=>{
    if(!turboSwiping)return;
    const dx=e.touches[0].clientX-turboSwipeStartX;
    const dy=e.touches[0].clientY-turboSwipeStartY;
    if(Math.abs(dy)>Math.abs(dx)*1.5){turboSwiping=false;return;} // scroll vertical
    const rot=dx*0.07;
    card.style.transform=`translateX(${dx}px) rotate(${rot}deg)`;
    // Hints
    const pct=Math.min(Math.abs(dx)/120,1);
    const hl=document.getElementById('turbo-hint-left');
    const hr=document.getElementById('turbo-hint-right');
    if(dx<0){hl.style.opacity=pct;hr.style.opacity=0;card.style.borderColor=`rgba(224,80,80,${pct})`;}
    else{hr.style.opacity=pct;hl.style.opacity=0;card.style.borderColor=`rgba(94,255,160,${pct})`;}
  },{passive:true});
  card.addEventListener('touchend',e=>{
    if(!turboSwiping)return;
    turboSwiping=false;
    const dx=e.changedTouches[0].clientX-turboSwipeStartX;
    document.getElementById('turbo-hint-left').style.opacity='0';
    document.getElementById('turbo-hint-right').style.opacity='0';
    card.style.transition='transform .18s,opacity .18s,border-color .18s';
    if(dx<-80){
      // Swipe izquierda = ausente
      card.style.transform='translateX(-120vw) rotate(-12deg)';
      card.style.opacity='0';
      turboSetPres('no');
      setTimeout(()=>{turboGuardar();},180);
    } else if(dx>80){
      // Swipe derecha = presente + guardar con valor actual
      card.style.transform='translateX(120vw) rotate(12deg)';
      card.style.opacity='0';
      turboSetPres('si');
      setTimeout(()=>{turboGuardar();},180);
    } else {
      // Volver al centro
      card.style.transform='translateX(0) rotate(0)';
      card.style.borderColor='var(--border)';
    }
  },{passive:true});
}

// ─────────────────────────────────────────
// MODO CLÁSICO (sin cambios funcionales)
// ─────────────────────────────────────────
function mostrarClaseRec(){
  const total=recActual.clasesActivas.length;
  const c=recActual.clasesActivas[recIdx];
  document.getElementById('rc-prog-ttl').textContent=`Clase ${recIdx+1} de ${total}`;
  document.getElementById('rc-prog-sub').textContent=`${total-recIdx-1} restantes`;
  document.getElementById('rcc-clase').textContent=c.clase;
  document.getElementById('rcc-inst').textContent=c.inst_nombre;
  document.getElementById('rcc-hora').textContent=c.hora;
  document.getElementById('rcc-dia').textContent=c.dia;
  document.getElementById('rcc-asis').value=0;
  document.getElementById('rcc-obs').value='';
  // Inicializar capacidad: del último registro histórico si existe, si no del salón
  const histCap=registros.filter(r=>r.inst_id===c.inst_id&&r.clase===c.clase&&r.dia===c.dia&&parseInt(r.cap)>0).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const capDefault=histCap.length>0?parseInt(histCap[0].cap):getCapClase(c.clase)||20;
  document.getElementById('rcc-cap').value=capDefault;

  // Fix: aviso de suplencia planificada específico para esta clase
  const supPlan=(suplenciasPlan||[]).find(s=>
    String(s.inst_id)===String(c.inst_id) &&
    s.clase===c.clase && s.dia===c.dia && s.hora===c.hora &&
    s.fecha===recActual.fecha && s.estado!=='rechazado'
  );
  const avisoRcc=document.getElementById('rcc-aviso-sup');
  if(supPlan){
    const supNom=instructores.find(i=>String(i.id)===String(supPlan.suplente_id))?.nombre||supPlan.suplente_nombre||'Suplente externo';
    if(avisoRcc){avisoRcc.textContent=`⇄ Suplencia planificada: ${supNom} · ${supPlan.motivo||''}`;avisoRcc.style.display='block';}
    document.getElementById('rcc-pres').value='sub';
    toggleSuplenteRec();
    setTimeout(()=>{
      if(supPlan.suplente_id) document.getElementById('rcc-suplente').value=String(supPlan.suplente_id);
      if(supPlan.motivo) document.getElementById('rcc-motivo').value=supPlan.motivo;
    },50);
  } else {
    if(avisoRcc) avisoRcc.style.display='none';
    document.getElementById('rcc-pres').value='si';
    document.getElementById('rcc-suplente-row').style.display='none';
    const faltaRow=document.getElementById('rcc-falta-motivo-row');
    if(faltaRow) faltaRow.style.display='none';
  }
  document.getElementById('rcc-asis').focus();
}
function ajustarAsis(delta){
  const inp=document.getElementById('rcc-asis');
  inp.value=Math.max(0,Math.min(300,(parseInt(inp.value)||0)+delta));
}
function siguienteClaseRec(){
  const c=recActual.clasesActivas[recIdx];
  const pres=document.getElementById('rcc-pres').value;
  const supId=pres==='sub'?parseInt(document.getElementById('rcc-suplente').value)||null:null;
  // Capturar motivo tanto para suplencia como para falta
  const motivoSup=(pres==='sub'||pres==='no')
    ?(document.getElementById('rcc-motivo')?document.getElementById('rcc-motivo').value||(pres==='sub'?'permiso':'falta'):null)
    :null;
  const cap=parseInt(document.getElementById('rcc-cap').value)||getCapClase(c.clase)||20;
  recActual.items.push({...c,asis:parseInt(document.getElementById('rcc-asis').value)||0,
    presente:pres,suplente_id:supId,motivo_suplencia:motivoSup,obs:document.getElementById('rcc-obs').value.trim(),saltado:false,cap});
  avanzarRec();
}
function saltarClaseRec(){
  const c=recActual.clasesActivas[recIdx];
  recActual.items.push({...c,asis:0,presente:'si',suplente_id:null,obs:'',saltado:true,cap:getCapClase(c.clase)||20});
  avanzarRec();
}
function avanzarRec(){recIdx++;if(recIdx>=recActual.clasesActivas.length)terminarRecorrido();else mostrarClaseRec();}

function terminarRecorrido(){
  document.getElementById('m-rec-cap').classList.remove('on');
  const vis=recActual.items.filter(i=>!i.saltado);
  const totalAsis=vis.reduce((a,i)=>a+i.asis,0);
  const aforoProm=vis.length>0?Math.round(vis.reduce((a,i)=>a+(i.cap>0?i.asis/i.cap*100:0),0)/vis.length):0;
  const ausentes=recActual.items.filter(i=>i.presente==='no');
  const suplentes=recActual.items.filter(i=>i.presente==='sub');
  const bajo3=vis.filter(i=>i.asis<=3);
  const fechaFmt=new Date(recActual.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  let html=`<div style="font-size:.78rem;color:var(--txt2);margin-bottom:.8rem">${fechaFmt} · ${recActual.dia} ${recActual.hora}</div>
    <div class="g3" style="margin-bottom:.9rem">
      <div style="background:var(--panel2);border-radius:8px;padding:.7rem;text-align:center;border-top:2px solid var(--neon)"><div class="klbl">Visitadas</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.7rem;color:var(--neon)">${vis.length}</div></div>
      <div style="background:var(--panel2);border-radius:8px;padding:.7rem;text-align:center;border-top:2px solid var(--gold2)"><div class="klbl">Asistentes</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.7rem;color:var(--gold2)">${totalAsis}</div></div>
      <div style="background:var(--panel2);border-radius:8px;padding:.7rem;text-align:center;border-top:2px solid ${pctCol(aforoProm)}"><div class="klbl">Aforo</div><div style="font-family:'Bebas Neue',sans-serif;font-size:1.7rem;color:${pctCol(aforoProm)}">${aforoProm}%</div></div>
    </div>`;
  if(ausentes.length>0)html+=`<div style="background:rgba(224,80,80,.12);border:1px solid var(--red);border-radius:7px;padding:.6rem .8rem;margin-bottom:.6rem;font-size:.78rem"><strong style="color:var(--red2)"><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> Ausentes:</strong> ${ausentes.map(a=>`${a.inst_nombre} (${a.clase} ${a.hora})`).join(', ')}</div>`;
  if(suplentes.length>0)html+=`<div style="background:rgba(77,184,232,.1);border:1px solid var(--blue);border-radius:7px;padding:.6rem .8rem;margin-bottom:.6rem;font-size:.78rem"><strong style="color:var(--blue)"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Suplentes:</strong> ${suplentes.map(a=>`${nombreSuplente(a.suplente_id)} por ${a.inst_nombre} (${a.clase})`).join(', ')}</div>`;
  if(bajo3.length>0)html+=`<div style="background:rgba(232,184,75,.12);border:1px solid var(--gold);border-radius:7px;padding:.6rem .8rem;margin-bottom:.6rem;font-size:.78rem"><strong style="color:var(--gold2)"><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> ≤3 asist.:</strong> ${bajo3.map(a=>`${a.clase} ${a.hora} (${a.asis}p)`).join(', ')}</div>`;
  html+=`<div style="max-height:200px;overflow-y:auto">
    <table style="width:100%;border-collapse:collapse;font-size:.77rem">
      <thead><tr>${['Clase','Instructor','Hora','Asist.','Aforo','Pres.','Suplente','Obs.'].map(h=>`<th style="padding:5px 8px;border-bottom:1px solid var(--border);color:var(--txt2);font-size:.65rem;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
      <tbody>
      ${vis.map((i,n)=>{
        const col=i.asis<=3?'var(--red2)':i.asis<=8?'var(--gold2)':'var(--v3)';
        const pres=i.presente==='si'?'<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':i.presente==='no'?'<svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>':'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const afoP=i.cap>0?Math.round(i.asis/i.cap*100):0;
        return `<tr style="background:${n%2?'var(--panel2)':'transparent'};border-bottom:1px solid var(--border)">
          <td style="padding:4px 8px;font-weight:600">${i.clase}</td>
          <td style="padding:4px 8px;color:var(--txt2)">${i.inst_nombre.split(' ')[0]}</td>
          <td style="padding:4px 8px;text-align:center;font-family:monospace">${i.hora}</td>
          <td style="padding:4px 8px;text-align:center;color:${col};font-weight:700">${i.asis}</td>
          <td style="padding:4px 8px;text-align:center;color:${col};font-size:.72rem">${afoP}%</td>
          <td style="padding:4px 8px;text-align:center">${pres}</td>
          <td style="padding:4px 8px;color:var(--blue);font-size:.72rem">${i.presente==='sub'?nombreSuplente(i.suplente_id):'—'}</td>
          <td style="padding:4px 8px;color:var(--txt2);font-size:.7rem">${i.obs||'—'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  document.getElementById('rec-res-body').innerHTML=html;
  document.getElementById('m-rec-res').classList.add('on');
}
function guardarRecorrido(){
  const vis=recActual.items.filter(i=>!i.saltado);
  if(vis.length===0&&!confirm('No se registraron clases con aforo. ¿Guardar el recorrido igualmente?'))return;
  const totalAsis=vis.reduce((a,i)=>a+(parseInt(i.asis)||0),0);
  const recsConCap=vis.filter(i=>(i.cap||0)>0);
  const aforoProm=recsConCap.length>0?Math.round(recsConCap.reduce((a,i)=>a+(parseInt(i.asis)||0)/(parseInt(i.cap)||20)*100,0)/recsConCap.length):0;
  const ausentes=recActual.items.filter(i=>i.presente==='no').length;
  const suplentes=recActual.items.filter(i=>i.presente==='sub').length;
  // Guardar resumen del recorrido
  recorridos.push({
    id:recorridos.length+1,fecha:recActual.fecha,hora:recActual.hora,dia:recActual.dia,
    visitadas:vis.length,totalAsis,aforoProm,ausentes,suplentes,items:[...recActual.items]
  });
  // Guardar cada item como registro individual en el historial
  vis.forEach(item=>{
    const cap=parseInt(item.cap)||getCapClase(item.clase)||20;
    const instIdNum=parseInt(item.inst_id)||item.inst_id;
    // Comparación robusta: convierte ambos lados a string para evitar mismatch number/string de Firebase
    const ex=registros.find(r=>
      String(r.inst_id)===String(item.inst_id) &&
      r.clase===item.clase &&
      r.dia===item.dia &&
      r.hora===item.hora &&
      r.fecha===recActual.fecha
    );
    const nuevoEst=item.presente==='no'?'falta':item.presente==='sub'?'sub':'ok';
    if(ex){
      ex.asistentes=parseInt(item.asis)||0;
      ex.estado=nuevoEst;
      ex.suplente_id=item.suplente_id||null;
      ex.motivo_suplencia=(nuevoEst==='sub'||nuevoEst==='falta')?(item.motivo_suplencia||null):null;
      ex.cap=cap;
      ex.updatedAt=Date.now();
    } else {
      const maxId=registros.reduce((m,r)=>Math.max(m,parseInt(r.id)||0),0);
      registros.push({
        id:maxId+1,
        inst_id:instIdNum,
        dia:item.dia,clase:item.clase,hora:item.hora,
        asistentes:parseInt(item.asis)||0,
        cap,dur:60,
        estado:nuevoEst,
        fecha:recActual.fecha,
        tipo:'recorrido',
        suplente_id:item.suplente_id||null,
        motivo_suplencia:(nuevoEst==='sub'||nuevoEst==='falta')?(item.motivo_suplencia||null):null,
        updatedAt:Date.now()
      });
    }
  });
  cerrarModal('m-rec-res');
  renderAll();
  renderRecorridos();
  registrarLog('recorrido', `Guardado: ${recActual.fecha} ${recActual.dia} ${recActual.hora} · ${vis.length} clase(s) · ${totalAsis} asistentes`);
  showToast(`Recorrido guardado — ${vis.length} clase(s) · ${totalAsis} asistentes · ${aforoProm}% aforo prom.`,'ok');
}
function imprimirRecorrido(){
  const vis=recActual.items.filter(i=>!i.saltado);
  const totalAsis=vis.reduce((a,i)=>a+i.asis,0);
  const aforoProm=vis.length>0?Math.round(vis.reduce((a,i)=>a+i.asis/20*100,0)/vis.length):0;
  const ausentes=recActual.items.filter(i=>i.presente==='no');
  const suplentes=recActual.items.filter(i=>i.presente==='sub');
  const bajo3=vis.filter(i=>i.asis<=3);
  const fechaFmt=new Date(recActual.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const html=`<div style="font-family:'Outfit',sans-serif;color:#111">
    <div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem;display:flex;justify-content:space-between">
      <div><h1 style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:2px;color:#1a7a45;margin:0">RECORRIDO DE AFORO</h1>
        <p style="color:#555;font-size:.8rem">Club Campestre Aguascalientes · Coordinación Fitness</p>
        <p style="color:#333;font-size:.82rem;margin-top:2px"><strong>${fechaFmt}</strong> · Hora: ${recActual.hora}</p>
      </div>
      <div style="text-align:right"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#1a7a45">${vis.length} clases</div>
        <div style="font-size:.78rem;color:#555">${totalAsis} asistentes · Aforo ${aforoProm}%</div></div>
    </div>
    ${ausentes.length>0?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:5px;padding:.5rem .7rem;margin-bottom:.6rem;font-size:.8rem"><strong><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> Ausentes:</strong> ${ausentes.map(a=>a.inst_nombre+' ('+a.clase+')').join(', ')}</div>`:''}
    ${suplentes.length>0?`<div style="background:#e8f4f8;border:1px solid #4db8e8;border-radius:5px;padding:.5rem .7rem;margin-bottom:.6rem;font-size:.8rem"><strong><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Suplentes:</strong> ${suplentes.map(a=>nombreSuplente(a.suplente_id)+' sustituyó a '+a.inst_nombre+' ('+a.clase+')').join(', ')}</div>`:''}
    ${bajo3.length>0?`<div style="background:#f8d7da;border:1px solid #dc3545;border-radius:5px;padding:.5rem .7rem;margin-bottom:.6rem;font-size:.8rem"><strong><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> ≤3 asistentes:</strong> ${bajo3.map(a=>a.clase+' ('+a.asis+'p)').join(', ')}</div>`:''}
    <table style="width:100%;border-collapse:collapse;font-size:.79rem">
      <thead><tr style="background:#f0f7f3">
        ${['#','Clase','Instructor','Hora','Asis.','Aforo %','Presente','Suplente','Observación'].map(h=>`<th style="padding:6px 8px;border:1px solid #ccc;color:#1a7a45;font-size:.67rem;text-transform:uppercase">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${vis.map((i,n)=>{
        const bg=n%2?'#f9fdf9':'#fff';
        const afoP=Math.round(i.asis/20*100);
        const col=pctColPrint(afoP);
        return `<tr style="background:${bg}">
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#999">${n+1}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;font-weight:600">${i.clase}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5">${i.inst_nombre}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;font-family:monospace">${i.hora}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${col};font-weight:700">${i.asis}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${col};font-weight:600">${afoP}%</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center">${i.presente==='si'?'<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Sí':i.presente==='no'?'<svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Ausente':'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Sustituto'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#1a5a8a">${i.presente==='sub'?nombreSuplente(i.suplente_id):'—'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#555;font-size:.74rem">${i.obs||'—'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div style="margin-top:1rem;padding:.7rem;background:#f0f7f3;border-radius:7px;border-left:4px solid #1a7a45;font-size:.8rem">
      <strong>Coordinador:</strong> ______________________ &nbsp;|&nbsp; <strong>Firma:</strong> ______________________ &nbsp;|&nbsp; <strong>Hora término:</strong> ______________________
    </div>
  </div>`;
  document.getElementById('print-ttl').textContent=`Recorrido — ${recActual.dia} ${recActual.hora}`;
  document.getElementById('print-body').innerHTML=html;
  cerrarModal('m-rec-res');
  document.getElementById('m-print').classList.add('on');
}
function renderRecorridos(){
  if(recorridos.length===0){document.getElementById('tb-rec').innerHTML=`<tr><td colspan="8"><div class="empty">Sin recorridos aún. Usa <svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 6 L9 11 L7 16 M10 6 L11 11 L13 16 M9 11 L12 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Recorrido para iniciar.</div></td></tr>`;return;}
  document.getElementById('tb-rec').innerHTML=recorridos.slice().reverse().map(r=>{
    const f=new Date((r.fecha||'')+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    return `<tr>
      <td>${f}</td><td class="mono">${r.hora||'—'}</td>
      <td>${r.dia||'—'} · ${r.visitadas||0} clases</td>
      <td class="mono">${r.totalAsis||0}</td>
      <td style="color:${pctCol(r.aforoProm||0)};font-weight:600">${r.aforoProm||0}%</td>
      <td class="${(r.ausentes||0)>0?'tr':'tg'}">${(r.ausentes||0)>0?r.ausentes+' ausente(s)':'—'}${(r.suplentes||0)>0?` <span style="color:var(--blue)"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${r.suplentes} sup.</span>`:''}</td>
      <td><button class="abtn" onclick="verRec(${r.id})"><svg class="ico" viewBox="0 0 20 20"><path d="M2 10 Q6 4 10 4 Q14 4 18 10 Q14 16 10 16 Q6 16 2 10" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/></svg> Ver</button></td>
      <td><button class="abtn" style="color:var(--red2);border-color:var(--red)" onclick="eliminarRecorrido(${r.id})"><svg class="ico" viewBox="0 0 20 20"><polyline points="5,6 15,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 6V4h4v2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><rect x="6" y="6" width="8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="9" y1="9" x2="9" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="11" y1="9" x2="11" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button></td>
    </tr>`;
  }).join('');
}
function eliminarRecorrido(id){
  if(!confirm('¿Eliminar este recorrido? Esta acción no se puede deshacer.'))return;
  recorridos=recorridos.filter(r=>r.id!==id);
  renderRecorridos();
  renderAll();
  showToast('Recorrido eliminado correctamente.','ok');
}
function verRec(id){
  const r=recorridos.find(x=>x.id===id);if(!r)return;
  recActual={...recActual,fecha:r.fecha,hora:r.hora,dia:r.dia,items:r.items||[]};
  terminarRecorrido();
}

// NOTA: guardarClase() y guardarFalta() se definen en registros.js (versión actualizada
// con soporte para rf-fecha y validación de fecha futura). Las versiones obsoletas de
// este archivo fueron eliminadas para evitar duplicación.


// ═══════════════════════════════════════════════════════
