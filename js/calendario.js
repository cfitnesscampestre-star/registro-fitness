// ═══ CALENDARIO — Fitness Control · Club Campestre ═══
function renderCal(){
  const lunes=getLunes(calOffset);
  document.getElementById('cal-semana-lbl').textContent=semanaStr(lunes);
  // Usar strings YYYY-MM-DD para evitar desfase de zona horaria
  const lunesStr=lunes.toISOString().slice(0,10);
  const domDate=new Date(lunes);domDate.setDate(lunes.getDate()+6);
  const domStr=domDate.toISOString().slice(0,10);

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

  HORAS_CAL.forEach(hora=>{
    html+=`<div style="padding:5px 6px;color:var(--txt3);font-family:'DM Mono',monospace;font-size:.69rem;display:flex;align-items:flex-start;padding-top:8px">${hora}</div>`;
    DIAS.forEach(dia=>{
      const clases=(mapa[`${dia}||${hora}`]||[]); // SIN límite — mostrar todas
      const has=clases.length>0;
      // Si hay más de 2, la celda crece con scroll interno
      const maxH=clases.length>2?`max-height:${clases.length*20+10}px;overflow-y:auto`:`min-height:46px`;
      html+=`<div style="background:${has?'var(--panel2)':'var(--bg)'};border:1px solid var(--border);border-radius:5px;padding:3px;${maxH}">`;
      clases.forEach(c=>{
        const cls=c.promAsis===null?'cal-ev-verde':c.promAsis<=3?'cal-ev-rojo':c.promAsis<=8?'cal-ev-amarillo':'cal-ev-verde';
        const txt=c.promAsis!==null?`${c.inst} ${c.promAsis}p`:`${c.inst}`;
        const subBadge=c.hasSub?'<span style="background:#1a3a5a;border-radius:2px;padding:0 3px;font-size:.58rem;margin-left:2px"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':'';
        html+=`<div onclick="verDiagClase('${c.clase}')" class='${cls}' style="border-radius:3px;padding:2px 4px;font-size:.63rem;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${c.clase} · ${c.inst} — clic para diagnóstico"><b>${c.clase.slice(0,8)}</b> ${txt}${subBadge}</div>`;
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
