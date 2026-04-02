// ═══ DASHBOARD — Fitness Control · Club Campestre ═══
// ═══ DASHBOARD ═══
let chartClases=null;
// ═══ DASHBOARD PERIODO ═══
function initDashPeriodo(){
  // Solo inicializa si los campos están vacíos
  if(!document.getElementById('dash-fecha-ini').value){
    const fin=new Date();
    const ini=new Date();ini.setDate(ini.getDate()-30);
    document.getElementById('dash-fecha-ini').value=ini.toISOString().slice(0,10);
    document.getElementById('dash-fecha-fin').value=fin.toISOString().slice(0,10);
  }
}
function setDashPeriodo(dias){
  const fin=new Date();
  const finStr=fin.toISOString().slice(0,10);
  document.getElementById('dash-fecha-fin').value=finStr;
  if(dias===0){
    document.getElementById('dash-fecha-ini').value='';
  } else {
    const ini=new Date();ini.setDate(ini.getDate()-dias);
    document.getElementById('dash-fecha-ini').value=ini.toISOString().slice(0,10);
  }
  renderDashboard();
}
function getDashRegistros(){
  const ini=document.getElementById('dash-fecha-ini')?.value||'';
  const fin=document.getElementById('dash-fecha-fin')?.value||'';
  return registros.filter(r=>{
    const f=r.fecha||'';
    if(ini&&f<ini)return false;
    if(fin&&f>fin)return false;
    return true;
  });
}
function getDashPeriodoLbl(){
  const ini=document.getElementById('dash-fecha-ini')?.value||'';
  const fin=document.getElementById('dash-fecha-fin')?.value||'';
  if(!ini&&!fin)return 'Todo el historial';
  const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'';
  if(!ini)return `Hasta ${fmt(fin)}`;
  if(!fin)return `Desde ${fmt(ini)}`;
  return `${fmt(ini)} — ${fmt(fin)}`;
}
// statsInst con filtro de periodo
function statsInstPeriodo(inst,regsBase){
  const recs=regsBase.filter(r=>r.inst_id===inst.id);
  const imp=recs.filter(r=>r.estado==='ok'||r.estado==='sub');
  const faltas=recs.filter(r=>r.estado==='falta').length;
  const horas=(imp.length*1).toFixed(1);
  const afoRecs=imp.filter(r=>parseInt(r.cap||0)>0);
  const aforo=afoRecs.length>0?Math.round(afoRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoRecs.length):0;
  const totalAsis=imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  return{impartidas:imp.length,faltas,horas,aforo,totalAsis};
}

function renderDashboard(){
  initDashPeriodo();
  const regsBase=getDashRegistros();
  const lbl=getDashPeriodoLbl();
  const lblEl=document.getElementById('dash-periodo-lbl');
  if(lblEl)lblEl.textContent=`(${regsBase.length} registros · ${lbl})`;

  const allS=instructores.map(i=>({...i,...statsInstPeriodo(i,regsBase)}));
  const totProg=instructores.reduce((a,i)=>a+(i.horario||[]).length,0);
  const totImp=allS.reduce((a,i)=>a+i.impartidas,0);
  const totFalt=allS.reduce((a,i)=>a+i.faltas,0);
  const totAsis=allS.reduce((a,i)=>a+i.totalAsis,0);
  const aforoProm=allS.length>0?Math.round(allS.reduce((a,i)=>a+i.aforo,0)/allS.length):0;
  const pct=totProg>0?Math.round(totImp/totProg*100):0;
  const totSuplencias=regsBase.filter(r=>r.estado==='sub').length;

  document.getElementById('kpi-row').innerHTML=`
    <div class="kpi"><div class="klbl">Clases / Semana</div><div class="kval" style="color:var(--neon)">${totProg}</div><div class="ksub">Programadas</div></div>
    <div class="kpi gd" style="position:relative"><div class="klbl">Impartidas</div><div class="kval" style="color:var(--neon)">${totImp}</div>
      <div class="ksub">${pct}% cumplimiento</div>
      <div class="kpi-meta">Meta: ≥90%</div>
      <div class="kpi-bar-wrap"><div class="kpi-bar-fill" style="width:${Math.min(pct,100)}%;background:${semColorKpi(pct,90)}"></div></div>
      <div class="kpi-sem">${pct>=90?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--neon)"/></svg>':pct>=70?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg>':'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>'}</div>
    </div>
    <div class="kpi rd" style="position:relative"><div class="klbl">Faltas</div><div class="kval" style="color:${totFalt===0?'var(--neon)':totFalt<=3?'var(--gold2)':'var(--red2)'}">${totFalt}</div><div class="ksub">Registradas</div>
      <div class="kpi-sem">${totFalt===0?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--neon)"/></svg>':totFalt<=3?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg>':'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>'}</div>
    </div>
    <div class="kpi bl"><div class="klbl">Total Asistentes</div><div class="kval" style="color:var(--blue)">${totAsis.toLocaleString()}</div><div class="ksub">Entradas acumuladas</div></div>
    <div class="kpi nn" style="position:relative"><div class="klbl">Aforo Prom.</div>
      <div class="kval" style="color:${semColorKpi(aforoProm)}">${aforoProm}%</div>
      <div class="ksub">Ocupación por clase</div>
      <div class="kpi-meta">Meta: ≥60% · ${(()=>{const t=calcTendenciaAforo();return`<span class="${t.delta>=0?'trend-up':'trend-dn'}">${t.label||''}</span>`;})()}</div>
      <div class="kpi-bar-wrap"><div class="kpi-bar-fill" style="width:${Math.min(aforoProm,100)}%;background:${semColorKpi(aforoProm)}"></div></div>
      <div class="kpi-sem">${aforoProm>=60?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--neon)"/></svg>':aforoProm>=35?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg>':'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>'}</div>
    </div>
    <div class="kpi"><div class="klbl">Instructores</div><div class="kval" style="color:var(--neon)">${instructores.length}</div><div class="ksub">Activos</div></div>
    <div class="kpi" style="cursor:pointer" onclick="abrirModal('m-suplencias')"><div class="klbl">Suplencias</div><div class="kval" style="color:var(--blue)">${totSuplencias}</div><div class="ksub">Ver reporte →</div></div>`;

  renderQuickAlerts();

  document.getElementById('inst-count-lbl').innerHTML=`<svg class="ico" viewBox="0 0 20 20"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2 17 Q2 12 8 12 Q14 12 14 17" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M14 11 Q18 11 18 16" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg> Instructores (${instructores.length})`;

  // Ranking: TODOS los instructores activos (con al menos 1 clase programada)
  const todosRank = [...allS]
    .filter(i => (i.horario||[]).length > 0)
    .sort((a,b) => b.aforo - a.aforo);

  const medals = ['<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5.5" stroke="var(--gold2)" stroke-width="1.5" fill="none"/><text x="10" y="13.5" text-anchor="middle" font-size="7" font-weight="700" fill="var(--gold2)" font-family="Outfit,sans-serif">1</text></svg>','<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5.5" stroke="#aaa" stroke-width="1.5" fill="none"/><text x="10" y="13.5" text-anchor="middle" font-size="7" font-weight="700" fill="#aaa" font-family="Outfit,sans-serif">2</text></svg>','<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5.5" stroke="#cd7f32" stroke-width="1.5" fill="none"/><text x="10" y="13.5" text-anchor="middle" font-size="7" font-weight="700" fill="#cd7f32" font-family="Outfit,sans-serif">3</text></svg>'];
  const rankHTML = todosRank.length === 0
    ? '<div class="empty">Sin instructores con clases programadas</div>'
    : `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;padding-bottom:.5rem;border-bottom:1px solid var(--border)">
        <span style="font-size:.63rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Instructor</span>
        <span style="font-size:.63rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Aforo · Asist. · Clases</span>
      </div>` +
      todosRank.map((i,n) => {
        const color = pctCol(i.aforo);
        const sem = i.aforo>=70?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--neon)"/></svg>':i.aforo>=40?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg>':'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg>';
        const label = n < 3 ? medals[n] : `<span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--txt3)">${n+1}</span>`;
        const barPct = Math.min(i.aforo, 100);
        return `<div class="arow" style="padding:6px 0">
          <div style="min-width:26px;text-align:center">${label}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.nombre}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${barPct}%;background:${color};border-radius:2px;transition:width .6s"></div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;margin-left:.6rem">
            <div style="display:flex;align-items:center;gap:4px">
              <span class="mono" style="color:${color};font-size:.82rem;font-weight:700">${i.aforo}%</span>
              <span>${sem}</span>
            </div>
            <span style="font-size:.65rem;color:var(--txt2)">${i.totalAsis.toLocaleString()} asist · ${i.impartidas} cls</span>
          </div>
        </div>`;
      }).join('');

  document.getElementById('rank-p').innerHTML = rankHTML;
  const countLbl = document.getElementById('rank-count-lbl');
  if(countLbl) countLbl.textContent = `${todosRank.length} instructores`;

  const wf=allS.filter(i=>i.faltas>0).sort((a,b)=>b.faltas-a.faltas).slice(0,6);
  document.getElementById('alerts-p').innerHTML=wf.length===0
    ?'<div class="empty"><svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Sin faltas</div>'
    :wf.map(i=>`<div class="arow"><div class="adot" style="background:${i.faltas>2?'var(--red2)':'var(--gold2)'}"></div><span style="flex:1;font-size:.83rem">${i.nombre}</span><span class="mono" style="color:${i.faltas>2?'var(--red2)':'var(--gold2)'}">${i.faltas}</span></div>`).join('');

  // Gráfica conectada al aforo real — filtrada por periodo — clickable para diagnóstico
  const claseMap={};
  regsBase.filter(r=>(r.estado==='ok'||r.estado==='sub')&&parseInt(r.cap||0)>0).forEach(r=>{
    const asis=parseInt(r.asistentes)||0;
    const cap=parseInt(r.cap)||20;
    if(!claseMap[r.clase])claseMap[r.clase]={sumPct:0,cnt:0,totalAsis:0};
    claseMap[r.clase].sumPct+=asis/cap*100;
    claseMap[r.clase].cnt++;
    claseMap[r.clase].totalAsis+=asis;
  });
  const labels=[],vals=[],vals2=[],colors=[];
  Object.entries(claseMap).filter(([,v])=>v.cnt>0).sort((a,b)=>b[1].sumPct/b[1].cnt-a[1].sumPct/a[1].cnt).forEach(([k,v])=>{
    const p=Math.round(v.sumPct/v.cnt);
    labels.push(k);vals.push(p);vals2.push(Math.round(v.totalAsis/v.cnt));colors.push(pctCol(p));
  });
  const chartTxtColor = temaActual==='claro' ? '#2d5a3a' : '#7aaa90';
  const chartGridColor = temaActual==='claro' ? '#d0e8d0' : '#0e1f17';
  if(chartClases)chartClases.destroy();
  const ctx=document.getElementById('chart-clases');
  // Si no hay datos reales, mostrar mensaje en lugar de gráfica vacía
  const chartWrap=document.querySelector('.graph-wrap');
  let emptyMsg=document.getElementById('chart-empty-msg');
  if(labels.length===0){
    if(chartClases){chartClases.destroy();chartClases=null;}
    if(ctx)ctx.style.display='none';
    if(!emptyMsg){
      emptyMsg=document.createElement('div');
      emptyMsg.id='chart-empty-msg';
      emptyMsg.className='empty';
      emptyMsg.style.cssText='height:200px;display:flex;align-items:center;justify-content:center;font-size:.85rem';
      emptyMsg.textContent='Sin clases registradas aún. Agrega aforo con "+ Clase" o "<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 6 L9 11 L7 16 M10 6 L11 11 L13 16 M9 11 L12 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Recorrido".';
      if(chartWrap)chartWrap.appendChild(emptyMsg);
    }
    emptyMsg.style.display='flex';
    return;
  }
  // Hay datos — restaurar canvas y ocultar mensaje vacío
  if(ctx)ctx.style.display='block';
  if(emptyMsg)emptyMsg.style.display='none';
  chartClases=new Chart(ctx.getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Aforo %',data:vals,backgroundColor:colors,borderRadius:5,borderSkipped:false,yAxisID:'y'},
      {label:'Asis. Prom.',data:vals2,backgroundColor:temaActual==='claro'?'rgba(200,169,74,0.35)':'rgba(94,255,160,0.55)',borderRadius:5,borderSkipped:false,yAxisID:'y2',type:'bar'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:chartTxtColor,font:{size:11}}},
        tooltip:{callbacks:{
          label:c=>c.datasetIndex===0?`Aforo: ${c.raw}%`:`Asistentes prom: ${c.raw}`,
          afterBody:(items)=>{
            if(items[0]&&items[0].datasetIndex===0)return['','👆 Clic en la barra para ver diagnóstico'];
            return[];
          }
        }}
      },
      onClick:(e,els)=>{
        if(els.length>0){
          const clase=labels[els[0].index];
          document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
          document.querySelectorAll('.vista').forEach(x=>x.classList.remove('on'));
          document.querySelector('[data-v="diagnostico"]').classList.add('on');
          document.getElementById('v-diagnostico').classList.add('on');
          initDiagClases(clase);
          renderDiagnostico();
        }
      },
      scales:{
        x:{ticks:{color:chartTxtColor,font:{family:'DM Mono',size:10}},grid:{color:chartGridColor}},
        y:{ticks:{color:chartTxtColor,font:{family:'DM Mono',size:10},callback:v=>v+'%'},grid:{color:chartGridColor},max:100,title:{display:true,text:'Aforo %',color:chartTxtColor,font:{size:10}}},
        y2:{position:'right',ticks:{color:temaActual==='claro'?'#9a7800':'var(--neon)',font:{family:'DM Mono',size:10}},grid:{display:false},title:{display:true,text:'Asis. Prom.',color:temaActual==='claro'?'#9a7800':'var(--neon)',font:{size:10}}}
      }
    }
  });
}

// ═══ INSTRUCTORES ═══
let instFil='';
function renderInst(){
  const lista=instFil?instructores.filter(i=>i.nombre.toLowerCase().includes(instFil)):instructores;
  document.getElementById('tb-inst').innerHTML=lista.map(inst=>{
    const s=statsInst(inst);
    const clasesList=(inst.horario||[]).slice(0,3).map(h=>`${h.dia.slice(0,3)} ${h.hora} ${h.clase}`).join(' · ');
    const mas=(inst.horario||[]).length>3?` +${(inst.horario||[]).length-3} más`:'';
    const est=s.faltas===0?'cok':s.faltas<=1?'cwn':'cbd';
    const estL=s.faltas===0?'<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Cumple':s.faltas<=1?'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> Revisar':'<svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Incidencia';
    return `<tr>
      <td><strong>${inst.nombre}</strong><br><span style="font-size:.68rem;color:var(--txt2)">${inst.esp||''}</span></td>
      <td><span class="chip ${inst.tipo==='planta'?'cpl':'cho'}">${inst.tipo==='planta'?'Planta':'Honor.'}</span></td>
      <td>${(inst.horario||[]).length}</td>
      <td style="font-size:.72rem;color:var(--txt2);max-width:200px">${clasesList}${mas?`<span style="color:var(--neon)">${mas}</span>`:''}</td>
      <td>${s.impartidas}</td>
      <td class="${s.faltas===0?'tg':s.faltas<=1?'tgo':'tr'}">${s.faltas}</td>
      <td><div class="bw"><div class="bar"><div class="bf" style="width:${s.aforo}%;background:${pctCol(s.aforo)}"></div></div><span class="mono" style="color:${pctCol(s.aforo)}">${s.aforo}%</span></div></td>
      <td><span class="chip ${est}">${estL}</span></td>
      <td><button class="abtn" onclick="abrirModalInstructor(${inst.id})">Editar</button></td>
    </tr>`;
  }).join('');
}
function filterInst(v){instFil=v.toLowerCase();renderInst();}

