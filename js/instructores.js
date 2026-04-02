// ═══ INSTRUCTORES — Fitness Control · Club Campestre ═══
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

// ═══ CALENDARIO CON NAVEGACIÓN ═══
