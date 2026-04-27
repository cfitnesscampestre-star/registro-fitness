// ═══ DASHBOARD ═══
let chartClases=null;
// ═══ DASHBOARD PERIODO ═══
function initDashPeriodo(){
  // Solo inicializa si los campos están vacíos
  if(!document.getElementById('dash-fecha-ini').value){
    const fin=new Date();
    const ini=new Date();ini.setDate(ini.getDate()-30);
    document.getElementById('dash-fecha-ini').value=fechaLocalStr(ini);
    document.getElementById('dash-fecha-fin').value=fechaLocalStr(fin);
  }
}
function setDashPeriodo(dias){
  const fin=new Date();
  const finStr=fechaLocalStr(fin);
  document.getElementById('dash-fecha-fin').value=finStr;
  if(dias===0){
    document.getElementById('dash-fecha-ini').value='';
  } else {
    const ini=new Date();ini.setDate(ini.getDate()-dias);
    document.getElementById('dash-fecha-ini').value=fechaLocalStr(ini);
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
  // Suma real de duraciones (min → hrs), con 60 min default
  const horas=(imp.reduce((a,r)=>a+(parseInt(r.dur)||60)/60,0)).toFixed(1);
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
  const aforo2Color = temaActual==='claro' ? 'rgba(200,169,74,0.4)' : 'rgba(94,255,160,0.5)';
  const aforo2Border = temaActual==='claro' ? 'rgba(200,169,74,0.8)' : 'rgba(94,255,160,0.85)';
  chartClases=new Chart(ctx.getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {
        label:'Aforo %',
        data:vals,
        backgroundColor:colors,
        borderColor:colors.map(c=>c.replace(/[\d.]+\)$/,'1)')),
        borderWidth:0,
        borderRadius:6,
        borderSkipped:false,
        yAxisID:'y'
      },
      {
        label:'Asis. Prom.',
        data:vals2,
        backgroundColor:aforo2Color,
        borderColor:aforo2Border,
        borderWidth:1,
        borderRadius:6,
        borderSkipped:false,
        yAxisID:'y2',
        type:'bar'
      }
    ]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          display:false  // usamos leyenda custom HTML abajo
        },
        tooltip:{
          backgroundColor:temaActual==='claro'?'rgba(255,255,255,.97)':'rgba(15,28,20,.97)',
          titleColor:chartTxtColor,
          bodyColor:chartTxtColor,
          borderColor:temaActual==='claro'?'rgba(0,0,0,.1)':'rgba(94,255,160,.2)',
          borderWidth:1,
          padding:10,
          cornerRadius:10,
          callbacks:{
            label:c=>c.datasetIndex===0?` Aforo: ${c.raw}%`:` Asistentes prom: ${c.raw}`,
            afterBody:(items)=>{
              if(items[0]&&items[0].datasetIndex===0)return['','  👆 Clic para diagnóstico'];
              return[];
            }
          }
        }
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
        x:{
          ticks:{color:chartTxtColor,font:{family:'DM Mono',size:10}},
          grid:{color:chartGridColor},
          border:{color:chartGridColor}
        },
        y:{
          ticks:{color:chartTxtColor,font:{family:'DM Mono',size:10},callback:v=>v+'%'},
          grid:{color:chartGridColor},
          border:{color:chartGridColor},
          max:100,
          title:{display:true,text:'Aforo %',color:chartTxtColor,font:{size:10}}
        },
        y2:{
          position:'right',
          ticks:{color:temaActual==='claro'?'#9a7800':aforo2Border,font:{family:'DM Mono',size:10}},
          grid:{display:false},
          border:{color:'transparent'},
          title:{display:true,text:'Asis. Prom.',color:temaActual==='claro'?'#9a7800':aforo2Border,font:{size:10}}
        }
      }
    }
  });

  // Leyenda custom premium debajo de la gráfica
  const legendWrap = document.getElementById('chart-clases-legend');
  if(legendWrap){
    const isClaro = temaActual==='claro';
    legendWrap.innerHTML = [
      '<div style="display:flex;align-items:center;gap:18px;justify-content:center;flex-wrap:wrap;margin-top:.6rem;padding:.4rem .8rem;border-radius:10px;background:'+(isClaro?'rgba(0,0,0,.04)':'rgba(255,255,255,.04)')+';border:1px solid '+(isClaro?'rgba(0,0,0,.08)':'rgba(255,255,255,.07)')+'">' ,
        '<div style="display:flex;align-items:center;gap:7px">',
          '<span style="display:inline-flex;gap:2px">',
            '<span style="width:10px;height:10px;border-radius:3px;background:var(--neon);opacity:.9;display:inline-block"></span>',
            '<span style="width:10px;height:10px;border-radius:3px;background:var(--gold2);opacity:.9;display:inline-block"></span>',
            '<span style="width:10px;height:10px;border-radius:3px;background:var(--red2);opacity:.9;display:inline-block"></span>',
          '</span>',
          '<span style="font-size:.7rem;color:'+(isClaro?'#444':'var(--txt2)')+';font-family:'DM Mono',monospace">Aforo %</span>',
        '</div>',
        '<div style="width:1px;height:14px;background:'+(isClaro?'rgba(0,0,0,.15)':'rgba(255,255,255,.12)')+'"></div>',
        '<div style="display:flex;align-items:center;gap:7px">',
          '<span style="width:22px;height:10px;border-radius:3px;background:'+aforo2Color+';border:1px solid '+aforo2Border+';display:inline-block"></span>',
          '<span style="font-size:.7rem;color:'+(isClaro?'#444':'var(--txt2)')+';font-family:'DM Mono',monospace">Asis. Prom.</span>',
        '</div>',
        '<div style="width:1px;height:14px;background:'+(isClaro?'rgba(0,0,0,.15)':'rgba(255,255,255,.12)')+'"></div>',
        '<span style="font-size:.68rem;color:var(--txt3);font-style:italic">clic en barra → diagnóstico</span>',
      '</div>'
    ].join('');
  }
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
    const avatarHtml = inst.foto
      ? `<img src="${inst.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(94,255,160,.25)">`
      : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--v2),var(--v3));display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:.8rem;color:#fff;flex-shrink:0">${inst.nombre.charAt(0)}</div>`;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">${avatarHtml}<div><strong>${inst.nombre}</strong><br><span style="font-size:.68rem;color:var(--txt2)">${inst.esp||''}</span></div></div></td>
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

// ═══ CALENDARIO CON NAVEGACIÓN ═══
function renderCal(){
  const lunes=getLunes(calOffset);
  document.getElementById('cal-semana-lbl').textContent=semanaStr(lunes);
  // Usar strings YYYY-MM-DD en hora local para evitar desfase de zona horaria
  const lunesStr=fechaLocalStr(lunes);
  const domDate=new Date(lunes);domDate.setDate(lunes.getDate()+6);
  const domStr=fechaLocalStr(domDate);

  const mapa={};
  instructores.forEach(inst=>{
    (inst.horario||[]).forEach(h=>{
      const k=`${h.dia}||${h.hora}`;
      if(!mapa[k])mapa[k]=[];
      // Comparar fechas como strings para evitar bugs de zona horaria
      const recs=registros.filter(r=>{
        const f=r.fecha||'';
        return r.inst_id===inst.id&&r.dia===h.dia&&r.hora===h.hora
          &&(r.estado==='ok'||r.estado==='sub')&&f>=lunesStr&&f<=domStr;
      });
      const promAsis=recs.length>0?Math.round(recs.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/recs.length):null;
      const hasSub=recs.some(r=>r.estado==='sub');
      mapa[k].push({clase:h.clase,inst:inst.nombre.split(' ')[0],tipo:inst.tipo,promAsis,hasSub,inst_id:inst.id});
    });
  });

  let html='<div style="display:grid;grid-template-columns:60px repeat(7,1fr);gap:2px">';
  html+='<div style="background:var(--panel2);padding:6px;border-radius:5px"></div>';
  DIAS.forEach(d=>html+=`<div style="background:var(--panel2);padding:6px;text-align:center;border-radius:5px;font-size:.67rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:600">${d.slice(0,3)}</div>`);

  // Calcular fecha por día de la semana
  const fechasPorDia = {};
  DIAS.forEach((d,i)=>{
    const f = new Date(lunes); f.setDate(lunes.getDate()+i);
    fechasPorDia[d] = fechaLocalStr(f);
  });
  const hoyStr2 = fechaLocalStr(hoy);

  HORAS_CAL.forEach(hora=>{
    html+=`<div style="padding:5px 6px;color:var(--txt3);font-family:'DM Mono',monospace;font-size:.69rem;display:flex;align-items:flex-start;padding-top:8px">${hora}</div>`;
    DIAS.forEach(dia=>{
      const clases=(mapa[`${dia}||${hora}`]||[]); // SIN límite — mostrar todas
      const has=clases.length>0;
      // Si hay más de 2, la celda crece con scroll interno
      const maxH=clases.length>2?`max-height:${clases.length*20+10}px;overflow-y:auto`:`min-height:46px`;
      const fechaDia = fechasPorDia[dia] || '';
      html+=`<div style="background:${has?'var(--panel2)':'var(--bg)'};border:1px solid var(--border);border-radius:5px;padding:3px;${maxH}">`;
      clases.forEach(c=>{
        const cls=c.promAsis===null?'cal-ev-verde':c.promAsis<=3?'cal-ev-rojo':c.promAsis<=8?'cal-ev-amarillo':'cal-ev-verde';
        const txt=c.promAsis!==null?`${c.inst} ${c.promAsis}p`:`${c.inst}`;
        const subBadge=c.hasSub?'<span style="background:#1a3a5a;border-radius:2px;padding:0 3px;font-size:.58rem;margin-left:2px"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':'';
        // Botón rápido de registro (solo admin, en cualquier día de la semana visible)
        const regBtn = `<span class="cal-reg-btn solo-admin" onclick="event.stopPropagation();abrirRegistroDesdeCalendario(${c.inst_id},'${dia}','${hora}','${c.clase}','${fechaDia}')" title="Registrar clase">+</span>`;
        html+=`<div style="display:flex;align-items:center;gap:2px;margin-bottom:1px">
          <div onclick="verDiagClase('${c.clase}')" class='${cls}' style="flex:1;border-radius:3px;padding:2px 4px;font-size:.63rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${c.clase} · ${c.inst} — clic para diagnóstico"><b>${c.clase.slice(0,8)}</b> ${txt}${subBadge}</div>
          ${regBtn}
        </div>`;
      });
      html+='</div>';
    });
  });
  html+='</div>';
  document.getElementById('cal-grid').innerHTML=html;
}
function cambiarSemana(delta){calOffset+=delta;renderCal();}
function irSemanaActual(){calOffset=0;renderCal();}
function verDiagClase(clase){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.vista').forEach(x=>x.classList.remove('on'));
  document.querySelector('[data-v="diagnostico"]').classList.add('on');
  document.getElementById('v-diagnostico').classList.add('on');
  initDiagClases(clase);renderDiagnostico();
}

// ═══ DIAGNÓSTICO ═══
let diagChart=null;
function initDiagClases(presel){
  const clasesUsadas=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))].sort();
  document.getElementById('diag-clase-sel').innerHTML=
    '<option value="">— Selecciona clase —</option>'+
    clasesUsadas.map(c=>`<option value="${c}" ${c===presel?'selected':''}>${c}</option>`).join('');
}
function renderDiagnostico(){
  const clase=document.getElementById('diag-clase-sel').value;
  const periodo=document.getElementById('diag-periodo').value;
  if(!clase){document.getElementById('diag-body').innerHTML='<div class="empty">Selecciona una clase para ver el diagnóstico</div>';return;}
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function filtrarPeriodo(r){
    // Parsear como fecha local para evitar desfase UTC
    const d=new Date((r.fecha||'')+'T12:00:00');
    if(periodo==='semana'){const l=getLunes(calOffset);return d>=l&&d<new Date(l.getTime()+7*86400000);}
    if(periodo==='mes'){const m=new Date();return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}
    const mi=meses.indexOf(periodo);if(mi>=0){return d.getMonth()===mi;}
    return true;
  }
  const recs=registros.filter(r=>r.clase===clase&&(r.estado==='ok'||r.estado==='sub')&&filtrarPeriodo(r));
  const porInst={};
  recs.forEach(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    if(!inst)return;
    if(!porInst[inst.nombre])porInst[inst.nombre]={nombre:inst.nombre,totalAsis:0,cnt:0,cap:20,suplencias:0};
    porInst[inst.nombre].totalAsis+=r.asistentes;
    porInst[inst.nombre].cnt++;
    if(r.estado==='sub')porInst[inst.nombre].suplencias++;
  });
  const lista=Object.values(porInst).sort((a,b)=>b.totalAsis-a.totalAsis);
  const totalGlobal=lista.reduce((a,i)=>a+i.totalAsis,0);
  const totalSesiones=lista.reduce((a,i)=>a+i.cnt,0);
  const totalSuplencias=registros.filter(r=>r.clase===clase&&r.estado==='sub'&&filtrarPeriodo(r)).length;
  if(lista.length===0){document.getElementById('diag-body').innerHTML=`<div class="empty">Sin registros de "${clase}" en el periodo seleccionado</div>`;return;}

  let html=`
    <div class="g3" style="margin-bottom:1.2rem">
      <div style="background:var(--panel2);border-radius:10px;padding:.9rem;text-align:center;border-top:2px solid var(--neon)">
        <div class="klbl">Total Asistentes</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--neon)">${totalGlobal.toLocaleString()}</div>
        <div style="font-size:.7rem;color:var(--txt2);margin-top:2px">Prom/sesión: ${totalSesiones>0?Math.round(totalGlobal/totalSesiones):0} pers.</div>
      </div>
      <div style="background:var(--panel2);border-radius:10px;padding:.9rem;text-align:center;border-top:2px solid var(--gold2)">
        <div class="klbl">Sesiones Impartidas</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--gold2)">${totalSesiones}</div>
        <div style="font-size:.7rem;color:var(--txt2);margin-top:2px">Aforo gral: ${totalSesiones>0?Math.round(totalGlobal/totalSesiones/20*100):0}%</div>
      </div>
      <div style="background:var(--panel2);border-radius:10px;padding:.9rem;text-align:center;border-top:2px solid var(--blue)">
        <div class="klbl">Instructores / Suplencias</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--blue)">${lista.length}</div>
        <div style="font-size:.7rem;color:var(--txt2);margin-top:2px"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${totalSuplencias} suplencias</div>
      </div>
    </div>
    <div class="g2">
      <div>
        <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--txt2);margin-bottom:.7rem">Desglose por Instructor</div>
        ${lista.map((i,n)=>{
          const pct=totalGlobal>0?Math.round(i.totalAsis/totalGlobal*100):0;
          const afoP=Math.round(i.totalAsis/i.cnt/(i.cap||20)*100);
          return `<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem 0;border-bottom:1px solid var(--border)">
            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:${n<3?'var(--gold2)':'var(--txt3)'};min-width:22px">${n+1}</span>
            <div style="flex:1">
              <div style="font-size:.84rem;font-weight:600">${i.nombre}${i.suplencias>0?`<span style="font-size:.69rem;background:rgba(77,184,232,.15);color:var(--blue);border-radius:4px;padding:1px 5px;margin-left:5px"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${i.suplencias} sup.</span>`:''}</div>
              <div style="font-size:.7rem;color:var(--txt2);margin-top:2px">${i.cnt} sesiones · Prom. ${Math.round(i.totalAsis/i.cnt)} pers/clase · Aforo <strong style="color:${pctCol(afoP)}">${afoP}%</strong></div>
              <div style="height:4px;background:var(--border);border-radius:2px;margin-top:5px">
                <div style="height:100%;width:${pct}%;background:${pctCol(afoP)};border-radius:2px;transition:width .6s"></div>
              </div>
            </div>
            <div style="text-align:right;min-width:60px">
              <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:var(--neon)">${i.totalAsis}</div>
              <div style="font-size:.68rem;color:var(--gold2);font-weight:600">${afoP}%</div>
              <div style="font-size:.65rem;color:var(--txt3)">${pct}% del total</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div>
        <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--txt2);margin-bottom:.7rem">Comparativa Visual (Asistentes y Aforo %)</div>
        <div class="graph-wrap"><canvas id="diag-chart"></canvas></div>
      </div>
    </div>`;
  document.getElementById('diag-body').innerHTML=html;
  setTimeout(()=>{
    if(diagChart)diagChart.destroy();
    const ctx2=document.getElementById('diag-chart');if(!ctx2)return;
    diagChart=new Chart(ctx2.getContext('2d'),{
      type:'bar',
      data:{labels:lista.map(i=>i.nombre.split(' ')[0]),
        datasets:[
          {label:'Asistentes',data:lista.map(i=>i.totalAsis),backgroundColor:'rgba(94,255,160,.7)',borderRadius:4,borderSkipped:false},
          {label:'Aforo %',data:lista.map(i=>Math.round(i.totalAsis/i.cnt/(i.cap||20)*100)),backgroundColor:'rgba(255,208,107,.5)',borderRadius:4,borderSkipped:false,yAxisID:'y2'}
        ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#7aaa90',font:{size:11}}},
          tooltip:{callbacks:{label:c=>c.datasetIndex===0?`Asistentes: ${c.raw}`:`Aforo: ${c.raw}%`}}},
        scales:{
          x:{ticks:{color:chartTxtColor,font:{size:10}},grid:{color:chartGridColor}},
          y:{ticks:{color:chartTxtColor,font:{family:'DM Mono',size:10}},grid:{color:chartGridColor},title:{display:true,text:'Asistentes',color:chartTxtColor,font:{size:10}}},
          y2:{position:'right',ticks:{color:'var(--gold2)',font:{family:'DM Mono',size:10},callback:v=>v+'%'},grid:{display:false},max:100,title:{display:true,text:'Aforo %',color:'var(--gold2)',font:{size:10}}}
        }}
    });
  },50);
}

// ═══ TOP 10 ═══
