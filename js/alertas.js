// ═══ ALERTAS — Fitness Control · Club Campestre ═══
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
        alertas.push({tipo:'red',icon:'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>',texto:`<strong>${g.clase}</strong> con ${inst?.nombre||'?'} a las ${g.hora} lleva 3+ sesiones consecutivas con aforo menor al 20%.`,accion:'Verifica la difusión y convocatoria de esta clase.'});
      }
    }
  });

  // 2. Instructor con 2+ faltas en el último mes
  instructores.forEach(inst => {
    const faltas = registros.filter(r=>r.inst_id===inst.id&&r.estado==='falta'&&new Date(r.fecha)>=hoy30);
    if(faltas.length>=2) {
      alertas.push({tipo:'gold',icon:'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg>️',texto:`<strong>${inst.nombre}</strong> tiene <strong>${faltas.length} faltas</strong> en los últimos 30 días.`,accion:'Revisa tu historial de asistencia.'});
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
      alertas.push({tipo:'gold',icon:'<svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',texto:`<strong>${inst.nombre}</strong> tiene suplentes en el <strong>${Math.round(sups/impTotal*100)}%</strong> de sus clases este mes (${sups} de ${impTotal}).`,accion:'Revisa tu disponibilidad y agenda del mes.'});
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
