// ═══ RANKING — Fitness Control · Club Campestre ═══
// RANKING DE CLASES CON SUGERENCIAS
// ═══════════════════════════════════════════
function rkLimpiar(){
  document.getElementById('rk-periodo').value='30';
  document.getElementById('rk-orden').value='aforo_desc';
  document.getElementById('rk-nivel').value='todos';
  document.getElementById('rk-inst-fil').value='';
  renderRanking();
}

let rkVistaActual = 'cards';
let rkChart = null;

function rkVista(v){
  rkVistaActual = v;
  document.getElementById('rk-cards').style.display = v==='cards' ? '' : 'none';
  document.getElementById('rk-tabla').style.display = v==='tabla' ? '' : 'none';
  document.getElementById('rk-btn-cards').className = v==='cards' ? 'btn bg' : 'btn bo';
  document.getElementById('rk-btn-tabla').className = v==='tabla' ? 'btn bg' : 'btn bo';
  document.getElementById('rk-btn-cards').style.cssText = 'padding:5px 10px;font-size:.72rem';
  document.getElementById('rk-btn-tabla').style.cssText  = 'padding:5px 10px;font-size:.72rem';
}

function rkGetPeriodoRegs(){
  const p=document.getElementById('rk-periodo')?.value||'30';
  if(p==='todo') return registros;
  const desde=new Date(); desde.setDate(desde.getDate()-parseInt(p));
  const desdeStr=desde.toISOString().slice(0,10);
  return registros.filter(r=>(r.fecha||'')>=desdeStr);
}

function rkNivelLabel(aforo){
  if(aforo>=75) return {label:'Alto',color:'var(--neon)',bg:'rgba(94,255,160,.1)',borde:'var(--verde)',icono:'🏆'};
  if(aforo>=55) return {label:'Medio',color:'var(--blue)',bg:'rgba(77,184,232,.08)',borde:'var(--blue)',icono:'👍'};
  if(aforo>=30) return {label:'Bajo',color:'var(--gold2)',bg:'rgba(232,184,75,.08)',borde:'var(--gold)',icono:'⚠️'};
  return {label:'Crítico',color:'var(--red2)',bg:'rgba(224,80,80,.08)',borde:'var(--red)',icono:'🔴'};
}

function rkSugerencias(g){
  const {aforo,promAsis,sesiones,cap,tendencia,bajosCnt,instNombres,dias,horas} = g;
  const sugs=[];
  const instStr = instNombres.slice(0,2).join(' / ');
  const horStr  = dias.slice(0,2).map((d,i)=>`${d} ${horas[i]}`).join(', ');

  if(aforo<30){
    if(sesiones<4)
      sugs.push({tipo:'info',  txt:`Datos insuficientes (${sesiones} sesiones). Registra más clases para evaluar con precisión.`});
    else if(tendencia<=-10)
      sugs.push({tipo:'danger',txt:`Tendencia fuertemente negativa (${tendencia>0?'+':''}${tendencia}%). Considera cancelar o restructurar urgente.`});
    else
      sugs.push({tipo:'danger',txt:`Aforo crítico sostenido. Evalúa cancelar este horario o fusionarlo con una clase similar.`});
    if(dias.length>0)
      sugs.push({tipo:'danger',txt:`Horario(s) más afectado(s): ${horStr}. Revisa si hay otra clase competidora en el mismo espacio.`});
    sugs.push({tipo:'action',txt:`Acción sugerida: Reasignar al instructor más popular del turno o eliminar del programa.`});
  } else if(aforo<55){
    if(tendencia>=5)
      sugs.push({tipo:'ok',   txt:`Tendencia positiva (+${tendencia}%). La clase está mejorando, mantén la estrategia.`});
    else if(tendencia<=-5)
      sugs.push({tipo:'warn', txt:`Tendencia negativa (${tendencia}%). La asistencia está bajando; intervención recomendada.`});
    else
      sugs.push({tipo:'warn', txt:`Aforo bajo estable. El horario no está atrayendo suficiente público.`});
    if(promAsis<=5)
      sugs.push({tipo:'warn', txt:`Promedio de ${promAsis} personas por sesión. Considera mover el horario a una franja de mayor demanda.`});
    sugs.push({tipo:'action',txt:`Acción sugerida: Cambiar de horario, promocionar en redes sociales o asignar instructor de mayor convocatoria.`});
  } else if(aforo<75){
    sugs.push({tipo:'ok',    txt:`Clase con buen rendimiento. Con un pequeño empuje puede llegar al nivel óptimo (≥75%).`});
    if(tendencia>=3)
      sugs.push({tipo:'ok',  txt:`Tendencia al alza (+${tendencia}%). Va en buen camino.`});
    else if(tendencia<-3)
      sugs.push({tipo:'warn',txt:`Ligera tendencia a la baja (${tendencia}%). Monitorear de cerca.`});
    if(cap && promAsis >= cap*0.7)
      sugs.push({tipo:'action',txt:`La clase está casi llena. Considera abrir un segundo horario para capturar más demanda.`});
    else
      sugs.push({tipo:'action',txt:`Acción sugerida: Campaña de difusión puntual o clase especial de prueba para atraer nuevos socios.`});
  } else {
    sugs.push({tipo:'ok',    txt:`Clase estrella. Excelente convocatoria con ${promAsis} personas por sesión en promedio.`});
    if(tendencia>=5)
      sugs.push({tipo:'ok',  txt:`Tendencia en ascenso (+${tendencia}%). Alta demanda creciente.`});
    if(cap && promAsis >= cap*0.85)
      sugs.push({tipo:'action',txt:`¡Clase casi a full! Abre un segundo horario o amplía la capacidad del espacio.`});
    else
      sugs.push({tipo:'action',txt:`Replica el modelo: mismo instructor, horario similar, en otro día de la semana.`});
    if(sesiones>=10)
      sugs.push({tipo:'ok',  txt:`Alta frecuencia (${sesiones} sesiones). Clase consolidada en el programa.`});
  }
  if(instNombres.length>1)
    sugs.push({tipo:'info', txt:`Impartida por ${instNombres.length} instructores distintos. Evalúa cuál genera mayor asistencia en el diagnóstico.`});
  return sugs;
}

function rkTendencia(regsOrdenados){
  if(regsOrdenados.length<4) return 0;
  const mid=Math.floor(regsOrdenados.length/2);
  const reciente=regsOrdenados.slice(0,mid);
  const anterior=regsOrdenados.slice(mid);
  const prom=arr=>arr.filter(r=>r.cap>0).reduce((a,r)=>a+r.asistentes/r.cap*100,0)/Math.max(arr.filter(r=>r.cap>0).length,1);
  return Math.round(prom(reciente)-prom(anterior));
}

function renderRanking(){
  // ── Actualizar selector de instructores ──────────────────────────────
  const selInst = document.getElementById('rk-inst-fil');
  if(selInst){
    const curInst = selInst.value;
    selInst.innerHTML = '<option value="">Todos los instructores</option>' +
      [...instructores].sort((a,b)=>a.nombre.localeCompare(b.nombre))
        .map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
    if(curInst) selInst.value = curInst;
  }

  const instFilVal = selInst?.value || '';
  let regsBase = rkGetPeriodoRegs().filter(r=>r.estado==='ok'||r.estado==='sub');
  if(instFilVal) regsBase = regsBase.filter(r=>String(r.inst_id)===instFilVal);

  const orden    = document.getElementById('rk-orden')?.value   || 'aforo_desc';
  const nivelFil = document.getElementById('rk-nivel')?.value   || 'todos';

  // ── Agrupar por nombre de clase ──────────────────────────────────────
  const grupos={};
  regsBase.forEach(r=>{
    if(!r.clase) return;
    if(!grupos[r.clase]) grupos[r.clase]={
      clase:r.clase, recs:[], instIds:new Set(), dias:[], horas:[]
    };
    grupos[r.clase].recs.push(r);
    grupos[r.clase].instIds.add(r.inst_id);
    if(!grupos[r.clase].dias.includes(r.dia))  grupos[r.clase].dias.push(r.dia);
    if(!grupos[r.clase].horas.includes(r.hora)) grupos[r.clase].horas.push(r.hora);
  });

  // ── Calcular métricas por clase ──────────────────────────────────────
  const clases = Object.values(grupos).map(g=>{
    const recs     = g.recs;
    const conCap   = recs.filter(r=>parseInt(r.cap||0)>0);
    const aforo    = conCap.length>0 ? Math.round(conCap.reduce((a,r)=>a+r.asistentes/r.cap*100,0)/conCap.length) : 0;
    const promAsis = recs.length>0 ? Math.round(recs.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/recs.length) : 0;
    const totalAsis= recs.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
    const cap      = conCap.length>0 ? Math.round(conCap.reduce((a,r)=>a+parseInt(r.cap),0)/conCap.length) : 20;
    const bajosCnt = recs.filter(r=>r.asistentes<=3).length;
    const recsOrd  = [...recs].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const tendencia= rkTendencia(recsOrd);
    const instNombres = [...g.instIds].map(id=>instructores.find(i=>i.id===id)?.nombre||'?').filter(Boolean);
    const maxAsis  = Math.max(...recs.map(r=>parseInt(r.asistentes)||0));
    const minAsis  = Math.min(...recs.map(r=>parseInt(r.asistentes)||0));
    const sesiones = recs.length;
    const sparkData= recsOrd.slice(0,8).reverse().map(r=>parseInt(r.asistentes)||0);
    return {clase:g.clase, aforo, promAsis, totalAsis, cap, bajosCnt, tendencia,
            instNombres, dias:g.dias, horas:g.horas, sesiones, maxAsis, minAsis, sparkData};
  });

  // ── Filtrar por nivel ────────────────────────────────────────────────
  const filtradas = nivelFil==='todos' ? clases : clases.filter(c=>{
    if(nivelFil==='critico') return c.aforo<30;
    if(nivelFil==='bajo')    return c.aforo>=30 && c.aforo<55;
    if(nivelFil==='medio')   return c.aforo>=55 && c.aforo<75;
    if(nivelFil==='alto')    return c.aforo>=75;
    return true;
  });

  // ── Ordenar ──────────────────────────────────────────────────────────
  const ordenadas = [...filtradas].sort((a,b)=>{
    if(orden==='aforo_desc')    return b.aforo - a.aforo;
    if(orden==='aforo_asc')     return a.aforo - b.aforo;
    if(orden==='asis_desc')     return b.promAsis - a.promAsis;
    if(orden==='sesiones_desc') return b.sesiones - a.sesiones;
    if(orden==='tendencia')     return b.tendencia - a.tendencia;
    return 0;
  });

  // ── KPIs rápidos ─────────────────────────────────────────────────────
  const totalClases = filtradas.length;
  const nCriticas   = filtradas.filter(c=>c.aforo<30).length;
  const nAltas      = filtradas.filter(c=>c.aforo>=75).length;
  const aforoGlobal = filtradas.length>0 ? Math.round(filtradas.reduce((a,c)=>a+c.aforo,0)/filtradas.length) : 0;
  const mejorTend   = filtradas.length>0 ? filtradas.reduce((a,c)=>c.tendencia>a.tendencia?c:a, filtradas[0]) : null;
  const totalAsisTot= filtradas.reduce((a,c)=>a+c.totalAsis,0);

  document.getElementById('rk-kpis').innerHTML=`
    <div class="kpi nn"><div class="klbl">Clases analizadas</div><div class="kval">${totalClases}</div><div class="ksub">Con datos en el periodo</div></div>
    <div class="kpi"><div class="klbl">Aforo global prom.</div>
      <div class="kval" style="color:${pctCol(aforoGlobal)}">${aforoGlobal}%</div>
      <div class="ksub">Todas las clases</div>
      <div class="kpi-bar-wrap"><div class="kpi-bar-fill" style="width:${aforoGlobal}%;background:${pctCol(aforoGlobal)}"></div></div>
    </div>
    <div class="kpi bl"><div class="klbl">Total Asistentes</div>
      <div class="kval" style="color:var(--blue)">${totalAsisTot.toLocaleString()}</div>
      <div class="ksub">Acumulado del periodo</div></div>
    <div class="kpi rd"><div class="klbl">Clases críticas</div>
      <div class="kval" style="color:${nCriticas>0?'var(--red2)':'var(--neon)'}">${nCriticas}</div>
      <div class="ksub">Aforo &lt; 30%</div></div>
    <div class="kpi gd"><div class="klbl">Clases estrella</div>
      <div class="kval" style="color:var(--gold2)">${nAltas}</div>
      <div class="ksub">Aforo ≥ 75%</div></div>
    ${mejorTend && mejorTend.tendencia>0 ? `<div class="kpi bl"><div class="klbl">Mejor tendencia</div>
      <div class="kval" style="color:var(--neon);font-size:1.4rem">${mejorTend.clase}</div>
      <div class="ksub">+${mejorTend.tendencia}% vs periodo anterior</div></div>` : ''}
  `;

  document.getElementById('rk-resumen-lbl').textContent =
    `${ordenadas.length} clase${ordenadas.length!==1?'s':''} · ${nivelFil==='todos'?'todos los niveles':nivelFil}${instFilVal?' · '+instructores.find(i=>i.id===parseInt(instFilVal))?.nombre.split(' ')[0]:''}`;

  // ── Sin datos ────────────────────────────────────────────────────────
  if(ordenadas.length===0){
    document.getElementById('rk-podio').innerHTML='';
    document.getElementById('rk-chart-panel').style.display='none';
    document.getElementById('rk-cards').innerHTML=`
      <div class="panel"><div class="pbody">
        <div class="empty" style="padding:2.5rem">
          <div style="font-size:1.5rem;margin-bottom:.5rem">📊</div>
          <div>Sin clases con datos en el periodo seleccionado.</div>
          <div style="font-size:.75rem;color:var(--txt3);margin-top:.4rem">Registra clases o amplía el periodo de análisis.</div>
        </div>
      </div></div>`;
    document.getElementById('rk-tabla').innerHTML='';
    return;
  }

  document.getElementById('rk-chart-panel').style.display='';

  // ── PODIO TOP 3 ──────────────────────────────────────────────────────
  const top3 = [...ordenadas].sort((a,b)=>b.aforo-a.aforo).slice(0,3);
  const podioConfig = [
    {pos:1, order:1, height:'110px', color:'var(--gold2)', medal:'🥇', label:'1er lugar'},
    {pos:2, order:0, height:'80px',  color:'#aaa',         medal:'🥈', label:'2do lugar'},
    {pos:3, order:2, height:'60px',  color:'#cd7f32',      medal:'🥉', label:'3er lugar'},
  ];
  const podioHTML = `
    <div class="panel" style="margin-bottom:1rem">
      <div class="phdr">
        <span class="pttl">🏆 Podio — Top 3 Clases</span>
        <span style="font-size:.7rem;color:var(--txt2)">Por aforo promedio en el periodo</span>
      </div>
      <div class="pbody">
        <div style="display:flex;align-items:flex-end;justify-content:center;gap:1rem;padding:.5rem 0 0">
          ${podioConfig.filter((_,i)=>top3[i]).map(cfg=>{
            const c = top3[cfg.pos-1];
            if(!c) return '';
            const niv = rkNivelLabel(c.aforo);
            return `
            <div style="order:${cfg.order};display:flex;flex-direction:column;align-items:center;gap:.4rem;flex:1;max-width:200px">
              <div style="font-size:1.6rem">${cfg.medal}</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${cfg.color};text-align:center;letter-spacing:1px">${c.clase}</div>
              <div style="font-size:.7rem;color:var(--txt2);text-align:center">${c.instNombres[0]?.split(' ')[0]||'—'}${c.instNombres.length>1?` +${c.instNombres.length-1}`:''}</div>
              <div style="width:100%;background:var(--panel2);border-radius:8px 8px 0 0;height:${cfg.height};
                   display:flex;flex-direction:column;align-items:center;justify-content:center;
                   border:1px solid ${cfg.color};border-bottom:none;
                   background:linear-gradient(180deg,${cfg.color}22,${cfg.color}08)">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:${cfg.color}">${c.aforo}%</div>
                <div style="font-size:.65rem;color:var(--txt2)">${c.promAsis} asis. prom</div>
                <div style="font-size:.62rem;color:var(--txt3)">${c.sesiones} sesiones</div>
              </div>
              <div style="width:100%;height:4px;background:${cfg.color};border-radius:0 0 3px 3px"></div>
              <span style="font-size:.63rem;color:${cfg.color};font-weight:600">${cfg.label}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  document.getElementById('rk-podio').innerHTML = podioHTML;

  // ── GRÁFICO COMPARATIVO ──────────────────────────────────────────────
  if(rkChart){ rkChart.destroy(); rkChart=null; }
  const chartTxtColor = temaActual==='claro' ? '#2d5a3a' : '#7aaa90';
  const chartGridColor = temaActual==='claro' ? '#d0e8d0' : '#0e1f17';
  const top20 = [...ordenadas].sort((a,b)=>b.aforo-a.aforo).slice(0,20);
  const ctx = document.getElementById('rk-chart');
  if(ctx){
    rkChart = new Chart(ctx.getContext('2d'),{
      type:'bar',
      data:{
        labels: top20.map(c=>c.clase),
        datasets:[
          {
            label:'Aforo %',
            data: top20.map(c=>c.aforo),
            backgroundColor: top20.map(c=>c.aforo>=75?'rgba(94,255,160,.75)':c.aforo>=30?'rgba(255,208,107,.75)':'rgba(224,80,80,.75)'),
            borderRadius:5, borderSkipped:false, yAxisID:'y'
          },
          {
            label:'Asis. prom.',
            data: top20.map(c=>c.promAsis),
            backgroundColor:'rgba(77,184,232,.45)',
            borderRadius:5, borderSkipped:false, type:'bar', yAxisID:'y2'
          }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{labels:{color:chartTxtColor,font:{size:11}}},
          tooltip:{callbacks:{
            label:c=>c.datasetIndex===0?`Aforo: ${c.raw}%`:`Asis. prom: ${c.raw} personas`
          }}
        },
        onClick:(e,els)=>{
          if(els.length>0){ verDiagClase(top20[els[0].index].clase); }
        },
        scales:{
          x:{ticks:{color:chartTxtColor,font:{family:'DM Mono',size:9},maxRotation:35},grid:{color:chartGridColor}},
          y:{ticks:{color:chartTxtColor,font:{family:'DM Mono',size:9},callback:v=>v+'%'},grid:{color:chartGridColor},max:100,
             title:{display:true,text:'Aforo %',color:chartTxtColor,font:{size:9}}},
          y2:{position:'right',ticks:{color:'#4db8e8',font:{family:'DM Mono',size:9}},grid:{display:false},
              title:{display:true,text:'Asis. prom.',color:'#4db8e8',font:{size:9}}}
        }
      }
    });
  }

  // ── VISTA TABLA ──────────────────────────────────────────────────────
  const tablaHTML = `
    <div class="panel">
      <div class="phdr"><span class="pttl">Tabla de Clases</span>
        <span style="font-size:.7rem;color:var(--txt2)">${ordenadas.length} clases</span>
      </div>
      <div class="twrap">
        <table>
          <thead><tr>
            <th>#</th><th>Clase</th><th>Nivel</th><th>Aforo %</th><th>Asis. Prom.</th>
            <th>Total Asis.</th><th>Sesiones</th><th>Capacidad</th><th>Tendencia</th>
            <th>Instructores</th><th></th>
          </tr></thead>
          <tbody>
          ${ordenadas.map((c,n)=>{
            const niv=rkNivelLabel(c.aforo);
            const tend=c.sesiones>=4
              ?`<span style="color:${c.tendencia>=0?'var(--neon)':'var(--red2)'};font-weight:600">${c.tendencia>=0?'▲ +':'▼ '}${c.tendencia}%</span>`
              :`<span style="color:var(--txt3)">—</span>`;
            const medal=n===0?'🥇 ':n===1?'🥈 ':n===2?'🥉 ':'';
            return `<tr>
              <td style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--txt3)">${medal}${n+1}</td>
              <td><strong>${c.clase}</strong></td>
              <td><span style="background:${niv.bg};color:${niv.color};border:1px solid ${niv.borde};border-radius:10px;padding:2px 8px;font-size:.68rem;font-weight:700">${niv.icono} ${niv.label}</span></td>
              <td><div class="bw"><div class="bar"><div class="bf" style="width:${Math.min(c.aforo,100)}%;background:${niv.color}"></div></div>
                <span class="mono" style="color:${niv.color};font-size:.78rem;font-weight:700">${c.aforo}%</span></div></td>
              <td class="mono" style="font-weight:600">${c.promAsis}</td>
              <td class="mono">${c.totalAsis.toLocaleString()}</td>
              <td class="mono">${c.sesiones}</td>
              <td class="mono">${c.cap}</td>
              <td>${tend}</td>
              <td style="font-size:.72rem;color:var(--txt2)">${c.instNombres.map(n=>n.split(' ')[0]).slice(0,2).join(', ')}${c.instNombres.length>2?` +${c.instNombres.length-2}`:''}</td>
              <td><button class="abtn" style="font-size:.67rem;padding:2px 8px" onclick="verDiagClase('${c.clase}')">Diagnóstico</button></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('rk-tabla').innerHTML = tablaHTML;
  if(rkVistaActual==='tabla'){
    document.getElementById('rk-cards').style.display='none';
    document.getElementById('rk-tabla').style.display='';
  }

  // ── TARJETAS ─────────────────────────────────────────────────────────
  const cards = ordenadas.map((c,n)=>{
    const niv     = rkNivelLabel(c.aforo);
    const sugs    = rkSugerencias(c);
    const barPct  = Math.min(c.aforo,100);
    const medal   = n===0?'🥇':n===1?'🥈':n===2?'🥉':'';
    const borderColor = niv.color;
    const spark = rkSparkline(c.sparkData, c.cap);

    const instChips = c.instNombres.slice(0,3).map(nm=>
      `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:1px 7px;font-size:.65rem;color:var(--txt2)">${nm.split(' ')[0]}</span>`
    ).join(' ') + (c.instNombres.length>3?`<span style="font-size:.63rem;color:var(--txt3)"> +${c.instNombres.length-3}</span>`:'');

    const horChips = c.dias.slice(0,3).map((d,i)=>
      `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:4px;padding:1px 7px;font-size:.65rem;color:var(--txt2)">${d.slice(0,3)} ${c.horas[i]||''}</span>`
    ).join(' ') + (c.dias.length>3?`<span style="font-size:.63rem;color:var(--txt3)"> +${c.dias.length-3}</span>`:'');

    const tendBadge = c.sesiones>=4
      ? `<span style="font-size:.68rem;padding:2px 7px;border-radius:10px;font-weight:600;
           background:${c.tendencia>=0?'rgba(94,255,160,.12)':'rgba(224,80,80,.12)'};
           color:${c.tendencia>=0?'var(--neon)':'var(--red2)'};
           border:1px solid ${c.tendencia>=0?'var(--verde)':'var(--red)'}">
           ${c.tendencia>=0?'▲ +':'▼ '}${c.tendencia}%</span>`
      : `<span style="font-size:.65rem;color:var(--txt3)">(pocas sesiones)</span>`;

    const sugColors = {ok:'rgba(94,255,160,.1)',warn:'rgba(232,184,75,.1)',danger:'rgba(224,80,80,.1)',action:'rgba(77,184,232,.1)',info:'rgba(255,255,255,.05)'};
    const sugText   = {ok:'var(--neon)',warn:'var(--gold2)',danger:'var(--red2)',action:'var(--blue)',info:'var(--txt2)'};
    const sugIcon   = {ok:'✔',warn:'⚠',danger:'✖',action:'→',info:'ℹ'};
    const sugsHTML  = sugs.map(s=>
      `<div style="display:flex;align-items:flex-start;gap:7px;padding:.45rem .65rem;border-radius:7px;margin-bottom:4px;background:${sugColors[s.tipo]};border-left:3px solid ${sugText[s.tipo]}">
        <span style="font-size:.8rem;flex-shrink:0;margin-top:1px">${sugIcon[s.tipo]}</span>
        <span style="font-size:.76rem;color:var(--txt);line-height:1.45">${s.txt}</span>
      </div>`
    ).join('');

    return `
    <div class="panel" style="border-left:4px solid ${borderColor};margin-bottom:.9rem;transition:box-shadow .2s" onmouseover="this.style.boxShadow='0 4px 24px rgba(0,0,0,.3)'" onmouseout="this.style.boxShadow=''">
      <div class="pbody" style="padding:1rem 1.1rem">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem">
          <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.05rem;letter-spacing:2px;color:var(--txt3)">#${n+1}</span>
            ${medal?`<span style="font-size:1.1rem">${medal}</span>`:''}
            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.35rem;letter-spacing:1px;color:${niv.color}">${c.clase}</span>
            <span style="font-size:.7rem;padding:2px 9px;border-radius:12px;font-weight:700;background:${niv.bg};color:${niv.color};border:1px solid ${niv.borde}">${niv.icono} ${niv.label}</span>
            ${tendBadge}
          </div>
          <button class="abtn" style="font-size:.68rem;padding:3px 10px" onclick="verDiagClase('${c.clase}')">
            <svg class="ico" viewBox="0 0 20 20"><line x1="10" y1="3" x2="10" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 10 L4 16 L16 16" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Diagnóstico
          </button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:.7rem;align-items:center;margin-bottom:.8rem">
          <div style="background:var(--panel2);border-radius:8px;padding:.6rem .8rem;border-top:2px solid ${niv.color}">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2)">Aforo prom.</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:${niv.color};line-height:1.1">${c.aforo}%</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:5px">
              <div style="height:100%;width:${barPct}%;background:${niv.color};border-radius:2px;transition:width .6s"></div>
            </div>
          </div>
          <div style="background:var(--panel2);border-radius:8px;padding:.6rem .8rem;border-top:2px solid var(--blue)">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2)">Asis. prom.</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--blue);line-height:1.1">${c.promAsis}</div>
            <div style="font-size:.63rem;color:var(--txt3);margin-top:3px">${c.minAsis}–${c.maxAsis} rango</div>
          </div>
          <div style="background:var(--panel2);border-radius:8px;padding:.6rem .8rem;border-top:2px solid var(--gold2)">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2)">Sesiones</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--gold2);line-height:1.1">${c.sesiones}</div>
            <div style="font-size:.63rem;color:var(--txt3);margin-top:3px">${c.totalAsis.toLocaleString()} asist. totales</div>
          </div>
          <div style="background:var(--panel2);border-radius:8px;padding:.6rem .8rem;border-top:2px solid var(--txt3)">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2)">Capacidad</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--txt2);line-height:1.1">${c.cap}</div>
            <div style="font-size:.63rem;color:var(--txt3);margin-top:3px">${c.bajosCnt>0?`⚠ ${c.bajosCnt}× ≤3 asis.`:' '}</div>
          </div>
          <div style="background:var(--panel2);border-radius:8px;padding:.5rem .7rem;border-top:2px solid var(--txt3);min-width:90px">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);margin-bottom:4px">Últimas sesiones</div>
            ${spark}
          </div>
        </div>

        <div style="display:flex;gap:.8rem;flex-wrap:wrap;margin-bottom:.75rem;font-size:.68rem">
          <div style="display:flex;align-items:center;gap:5px;color:var(--txt2)">
            <svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 18 Q3 12 10 12 Q17 12 17 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>
            ${instChips}
          </div>
          <div style="display:flex;align-items:center;gap:5px;color:var(--txt2)">
            <svg class="ico" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            ${horChips}
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:.7rem">
          <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt3);margin-bottom:.4rem">
            <svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Sugerencias de modificación
          </div>
          ${sugsHTML}
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('rk-cards').innerHTML = cards;
  rkVista(rkVistaActual);
}

// Mini sparkline SVG de asistencia
function rkSparkline(data, cap){
  if(!data || data.length===0) return '<div style="font-size:.65rem;color:var(--txt3)">Sin datos</div>';
  const w=80, h=30, n=data.length;
  const maxV = Math.max(...data, cap||20, 1);
  const pts = data.map((v,i)=>{
    const x = n===1 ? w/2 : (i/(n-1))*(w-4)+2;
    const y = h - (v/maxV)*(h-4)-2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const capY = h - (cap/maxV)*(h-4)-2;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px;overflow:visible">
    <line x1="0" y1="${capY.toFixed(1)}" x2="${w}" y2="${capY.toFixed(1)}" stroke="var(--txt3)" stroke-width="0.8" stroke-dasharray="2,2"/>
    <polyline points="${pts}" fill="none" stroke="var(--neon)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${data.map((v,i)=>{
      const x = n===1 ? w/2 : (i/(n-1))*(w-4)+2;
      const y = h - (v/maxV)*(h-4)-2;
      const col = v<=3?'var(--red2)':v/maxV>=0.75?'var(--neon)':'var(--gold2)';
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${col}"/>`;
    }).join('')}
  </svg>`;
}

// ═══ RECORRIDO ═══
