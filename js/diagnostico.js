// ═══ DIAGNOSTICO — Fitness Control · Club Campestre ═══
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
    const d=new Date(r.fecha);
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
// ═══════════════════════════════════════════
// RANKING DE CLASES CON SUGERENCIAS
