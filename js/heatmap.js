// ═══ HEATMAP — Fitness Control · Club Campestre ═══
// ═══════════════════════════════════════════
// ── Helpers filtros heatmap ──────────────────────────────────────
function hmInstChange() {
  // Al cambiar instructor repoblar clases de ese instructor y re-renderizar
  const rawId = document.getElementById('hm-inst-fil').value;
  const instId = rawId ? parseInt(rawId) : null;
  hmPoblarClases(instId);
  document.getElementById('hm-clase-fil').value = '';
  renderHeatmap();
}

function hmClearFiltros() {
  document.getElementById('hm-inst-fil').value = '';
  document.getElementById('hm-clase-fil').value = '';
  hmPoblarClases(null);
  renderHeatmap();
}

function hmPoblarInstructores(instIdActual) {
  const sel = document.getElementById('hm-inst-fil');
  // Solo instructores que tienen al menos un registro válido
  const idsConDatos = new Set(
    registros
      .filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0)
      .map(r => r.inst_id)
  );
  const lista = instructores
    .filter(i => idsConDatos.has(i.id))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = '<option value="">👤 Todos los instructores</option>' +
    lista.map(i => `<option value="${i.id}" ${i.id===instIdActual?'selected':''}>${i.nombre}</option>`).join('');
}

function hmPoblarClases(instId) {
  const sel = document.getElementById('hm-clase-fil');
  const cur = sel.value;
  // Filtrar registros válidos, y si hay instructor seleccionado solo los suyos
  let regs = registros.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0);
  if(instId) regs = regs.filter(r => r.inst_id === instId); // inst_id ya es número, instId también
  const clases = [...new Set(regs.map(r => r.clase))].filter(Boolean).sort();
  sel.innerHTML = '<option value="">📋 Todas las clases</option>' +
    clases.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

// ── renderHeatmap principal ──────────────────────────────────────
function renderHeatmap() {
  const metric  = document.getElementById('hm-metric').value;
  // *** CLAVE: convertir a número para que coincida con r.inst_id que es número ***
  const rawInstVal = document.getElementById('hm-inst-fil').value;
  const instId  = rawInstVal ? parseInt(rawInstVal) : null;
  const claseFil = document.getElementById('hm-clase-fil').value;

  // Mantener selectores actualizados sin perder la selección actual
  hmPoblarInstructores(instId);
  hmPoblarClases(instId);
  // Re-asignar tras repoblar (repoblar puede haber reseteado el valor)
  if(instId)   document.getElementById('hm-inst-fil').value  = String(instId);
  if(claseFil) document.getElementById('hm-clase-fil').value = claseFil;

  const hayFiltro = instId || claseFil;
  document.getElementById('hm-clear-btn').style.display = hayFiltro ? '' : 'none';

  const instObj = instId ? instructores.find(i => i.id === instId) : null;

  // Banner contextual
  const bannerEl = document.getElementById('hmap-context-banner');
  if(hayFiltro) {
    let txt = '';
    if(instObj) txt += `<span style="background:rgba(94,255,160,.1);color:var(--neon);border:1px solid rgba(94,255,160,.25);border-radius:6px;padding:2px 9px;font-size:.73rem"><svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 18 Q3 12 10 12 Q17 12 17 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg> ${instObj.nombre}</span>`;
    if(claseFil) txt += `<span style="background:rgba(77,184,232,.1);color:var(--blue);border:1px solid rgba(77,184,232,.25);border-radius:6px;padding:2px 9px;font-size:.73rem"><svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ${claseFil}</span>`;
    txt += `<span style="color:var(--txt3);font-size:.72rem"> — mostrando solo registros de esta selección</span>`;
    bannerEl.innerHTML = txt;
    bannerEl.style.display = 'flex';
  } else {
    bannerEl.style.display = 'none';
  }

  // Filtrar registros — usar === con tipos correctos
  let regsValidos = registros.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0) > 0);
  if(instId)   regsValidos = regsValidos.filter(r => r.inst_id === instId);   // número === número
  if(claseFil) regsValidos = regsValidos.filter(r => r.clase   === claseFil); // string === string

  if(regsValidos.length === 0) {
    const msg = hayFiltro
      ? `Sin registros de aforo para ${instObj ? instObj.nombre : 'este instructor'}${claseFil ? ' · ' + claseFil : ''}.`
      : 'Sin datos de aforo registrados aún. Registra clases con aforo para ver el mapa de calor.';
    document.getElementById('hmap-grid').innerHTML = `<div class="empty" style="padding:2rem">${msg}</div>`;
    document.getElementById('hm-top5').innerHTML   = '<div class="empty" style="font-size:.75rem">Sin datos</div>';
    document.getElementById('hm-bot5').innerHTML   = '<div class="empty" style="font-size:.75rem">Sin datos</div>';
    document.getElementById('hmap-insight').innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Registra clases para ver insights de horarios.';
    document.getElementById('hmap-legend').innerHTML  = '';
    return;
  }

  // Construir matriz día x hora
  const matriz = {};
  HORAS_CAL.forEach(h => { matriz[h]={}; DIAS.forEach(d=>{ matriz[h][d]={sum:0,cnt:0,sesiones:0}; }); });

  regsValidos.forEach(r => {
    const asisN = parseInt(r.asistentes) || 0;
    const capN  = parseInt(r.cap) || getCapClase(r.clase) || 20;
    const hSlot = HORAS_CAL.reduce((best,h) => {
      const diff = Math.abs(horaToMin(r.hora)-horaToMin(h));
      return diff < Math.abs(horaToMin(r.hora)-horaToMin(best)) ? h : best;
    }, HORAS_CAL[0]);
    if(matriz[hSlot] && matriz[hSlot][r.dia] !== undefined) {
      matriz[hSlot][r.dia].sum += metric==='asis' ? asisN : metric==='aforo' ? asisN/capN*100 : 1;
      matriz[hSlot][r.dia].cnt++;
      matriz[hSlot][r.dia].sesiones++;
    }
  });

  // Máximo para escala de color
  let maxVal = 1;
  HORAS_CAL.forEach(h => DIAS.forEach(d => {
    const cell = matriz[h][d];
    const val  = cell.cnt > 0 ? (metric==='sesiones' ? cell.sesiones : cell.sum/cell.cnt) : 0;
    if(val > maxVal) maxVal = val;
  }));

  function cellColor(val) {
    if(val===0) return 'var(--panel2)';
    // Usar valor absoluto si es aforo (0-100), relativo si es otro metric
    const pct = metric==='aforo' ? val/100 : val/maxVal;
    // Paleta semáforo vibrante: rojo → naranja → amarillo → verde
    if(pct < 0.20) return '#e53935';   // rojo intenso
    if(pct < 0.35) return '#ef6c00';   // naranja
    if(pct < 0.50) return '#f9a825';   // amarillo ámbar
    if(pct < 0.65) return '#7cb342';   // verde lima
    if(pct < 0.80) return '#2e7d32';   // verde medio
    return '#00c853';                   // verde brillante (estrella)
  }
  function cellTextColor(val){
    if(val===0) return 'var(--txt3)';
    const pct = metric==='aforo' ? val/100 : val/maxVal;
    // Texto oscuro sobre colores claros (amarillo/lima), blanco sobre oscuros
    if(pct >= 0.35 && pct < 0.65) return '#1a1a00';
    return '#fff';
  }

  let html = `<table style="border-collapse:separate;border-spacing:3px;width:100%">
    <thead><tr>
      <th style="width:50px;padding:4px;font-size:.65rem;color:var(--txt3)">Hora</th>
      ${DIAS.map(d=>`<th style="padding:4px;font-size:.65rem;color:var(--txt2);text-align:center;min-width:60px">${d.slice(0,3)}</th>`).join('')}
    </tr></thead><tbody>`;

  const allVals = [];
  HORAS_CAL.forEach(h => {
    html += `<tr><td style="font-family:'DM Mono',monospace;font-size:.65rem;color:var(--txt3);padding:2px 4px;white-space:nowrap">${h}</td>`;
    DIAS.forEach(d => {
      const cell  = matriz[h][d];
      const val   = cell.cnt > 0 ? (metric==='sesiones' ? cell.sesiones : Math.round(cell.sum/cell.cnt)) : 0;
      allVals.push({h, d, val, cnt:cell.cnt});
      const label    = val===0 ? '—' : (metric==='aforo' ? val+'%' : val);
      const sublabel = cell.cnt>0 && metric!=='sesiones'
        ? `<br><span style="font-size:.55rem;opacity:.7">${cell.cnt}ses</span>` : '';
      html += `<td class="hmap-cell" style="background:${cellColor(val)};color:${cellTextColor(val)};height:38px;vertical-align:middle;"
        title="${d} ${h} · ${label}${metric==='aforo'?' aforo':''}${metric==='asis'?' asis.':''} · ${cell.cnt} sesiones"
        onclick="verDiagHorario('${d}','${h}')">
        <div>${label}${sublabel}</div></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('hmap-grid').innerHTML = html;

  // Leyenda
  const isDarkLegend = temaActual !== 'claro';
  const legendColors = isDarkLegend
    ? ['rgba(26,122,69,.12)','rgba(26,122,69,.30)','rgba(26,122,69,.55)','rgba(26,122,69,.80)','#5effa0']
    : ['#d4eedd','#a8d8b8','#6db990','#3a9a68','#1a7a45'];
  document.getElementById('hmap-legend').innerHTML =
    `<span>Menor</span>
    ${legendColors.map((c,i)=>`<span class="hmap-sq" style="background:${c};border:1px solid rgba(94,255,160,${0.1+i*0.15})"></span>`).join('')}
    <span>Mayor</span>
    &nbsp;&nbsp; <span style="opacity:.7">Clic en celda = diagnóstico de ese horario</span>`;

  // Top / Bottom 5
  const horarios   = allVals.filter(v => v.cnt > 0).sort((a,b) => b.val - a.val);
  const metricLabel = metric==='aforo' ? '% aforo' : metric==='asis' ? 'asis. prom' : 'sesiones';

  // Clases por horario respetando filtro activo
  function clasesEnHorario(dia, hora) {
    const resultado = [];
    const instsFiltro = instId ? instructores.filter(i => i.id === instId) : instructores;
    instsFiltro.forEach(inst => {
      (inst.horario||[]).forEach(h => {
        if(h.dia === dia && Math.abs(horaToMin(h.hora)-horaToMin(hora)) <= 30) {
          if(claseFil && h.clase !== claseFil) return;
          const regsSlot = registros.filter(r =>
            r.inst_id === inst.id && r.dia === dia &&
            Math.abs(horaToMin(r.hora)-horaToMin(hora)) <= 30 &&
            (r.estado==='ok'||r.estado==='sub') && r.cap > 0 &&
            (!claseFil || r.clase === claseFil)
          );
          const promAsis = regsSlot.length > 0
            ? Math.round(regsSlot.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/regsSlot.length) : null;
          const promAfo  = regsSlot.length > 0
            ? Math.round(regsSlot.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/regsSlot.length) : null;
          resultado.push({clase:h.clase, inst:inst.nombre.split(' ')[0], promAsis, promAfo, sesiones:regsSlot.length});
        }
      });
    });
    return resultado;
  }

  function sugerenciaMejor(v, clasesList) {
    const nc  = clasesList.map(c=>c.clase).join(', ');
    const pfx = instObj ? `${instObj.nombre.split(' ')[0]} — ` : '';
    if(metric==='aforo'){
      if(v.val>=80) return `<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${pfx}Horario estrella. Considera duplicar ${clasesList[0]?.clase||'esta clase'} o agregar instructor adicional.`;
      if(v.val>=60) return `👍 ${pfx}Buen rendimiento. Mantén la programación actual de ${nc||'este horario'}.`;
      return `<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ${pfx}Horario en crecimiento. Potencial sin explotar en ${nc||'este horario'}.`;
    }
    if(metric==='asis') return `<svg class="ico" viewBox="0 0 20 20"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2 17 Q2 12 8 12 Q14 12 14 17" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M14 11 Q18 11 18 16" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg> ${pfx}Promedio de ${v.val} personas — asigna al instructor de mayor experiencia aquí.`;
    return `<svg class="ico" viewBox="0 0 20 20"><rect x="3" y="12" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="8.5" y="8" width="3" height="9" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="14" y="4" width="3" height="13" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/></svg> ${v.val} sesiones registradas. Horario consolidado.`;
  }

  function sugerenciaCritica(v, clasesList) {
    const nc = clasesList.map(c=>c.clase).join(', ');
    if(metric==='aforo'){
      if(v.val<=15) return `<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--red2)"/></svg> Aforo crítico (${v.val}%). Evalúa cancelar o fusionar ${nc||'esta clase'} con otro horario similar.`;
      if(v.val<=30) return `<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="var(--gold2)"/></svg> Aforo bajo (${v.val}%). Considera cambiar horario o promocionar ${nc||'esta clase'}.`;
      return `<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg>️ Rendimiento mejorable (${v.val}%). Revisa si el horario compite con otra clase del mismo tipo.`;
    }
    if(metric==='asis') return `<svg class="ico" viewBox="0 0 20 20"><polyline points="3,5 7,12 11,9 17,15" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,15 17,15 17,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Solo ${v.val} personas en promedio. Considera reubicar ${nc||'esta clase'} a un horario con mayor demanda.`;
    return `<svg class="ico" viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="8" y="2" width="4" height="2.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Pocas sesiones. Verifica si el horario está activo.`;
  }

  const mkChipVerde = c => `<span style="display:inline-block;background:rgba(94,255,160,.12);color:var(--neon);border-radius:4px;padding:1px 5px;font-size:.62rem;margin:1px">${c.clase}${instId?'':` <span style="opacity:.55">${c.inst}</span>`}</span>`;
  const mkChipRojo  = c => `<span style="display:inline-block;background:rgba(224,80,80,.12);color:var(--red2);border-radius:4px;padding:1px 5px;font-size:.62rem;margin:1px">${c.clase}${instId?'':` <span style="opacity:.55">${c.inst}</span>`}</span>`;

  document.getElementById('hm-top5').innerHTML = horarios.slice(0,5).map((v,n) => {
    const clsList = clasesEnHorario(v.d, v.h);
    const clasesStr = clsList.length > 0
      ? clsList.map(mkChipVerde).join('')
      : `<span style="font-size:.65rem;color:var(--txt3)">Sin clases asignadas</span>`;
    return `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--gold2);min-width:20px">${n+1}</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${v.d} ${v.h}</div><div style="margin-top:2px">${clasesStr}</div></div>
        <span class="mono" style="color:var(--neon);font-size:.85rem;font-weight:700">${v.val}${metric==='aforo'?'%':''}</span>
      </div>
      <div style="font-size:.68rem;color:var(--txt2);padding-left:24px;line-height:1.4">${sugerenciaMejor(v,clsList)}</div>
    </div>`;
  }).join('') || '<div class="empty" style="font-size:.75rem">Sin datos</div>';

  document.getElementById('hm-bot5').innerHTML = [...horarios].reverse().slice(0,5).map((v,n) => {
    const clsList = clasesEnHorario(v.d, v.h);
    const clasesStr = clsList.length > 0
      ? clsList.map(mkChipRojo).join('')
      : `<span style="font-size:.65rem;color:var(--txt3)">Sin clases asignadas</span>`;
    return `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:var(--red2);min-width:20px">${n+1}</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${v.d} ${v.h}</div><div style="margin-top:2px">${clasesStr}</div></div>
        <span class="mono" style="color:var(--red2);font-size:.85rem;font-weight:700">${v.val}${metric==='aforo'?'%':''}</span>
      </div>
      <div style="font-size:.68rem;color:var(--txt2);padding-left:24px;line-height:1.4">${sugerenciaCritica(v,clsList)}</div>
    </div>`;
  }).join('') || '<div class="empty" style="font-size:.75rem">Sin datos</div>';

  // Insight
  if(horarios.length > 0) {
    const mejor = horarios[0];
    const peor  = horarios[horarios.length-1];
    const diaMasActivo   = DIAS.map(d=>({d,tot:HORAS_CAL.reduce((a,h)=>a+(matriz[h][d].sesiones||0),0)})).sort((a,b)=>b.tot-a.tot)[0];
    const diaMenosActivo = DIAS.map(d=>({d,tot:HORAS_CAL.reduce((a,h)=>a+(matriz[h][d].sesiones||0),0)})).filter(x=>x.tot>0).sort((a,b)=>a.tot-b.tot)[0];
    const clasesMejor = clasesEnHorario(mejor.d, mejor.h);
    const clasesPeor  = clasesEnHorario(peor.d,  peor.h);
    const metricNom   = metric==='aforo' ? 'aforo' : metric==='asis' ? 'asistentes' : 'sesiones';
    const titulo = instObj
      ? `<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Análisis individual — ${instObj.nombre}${claseFil?' · '+claseFil:''}`
      : '<svg class="ico" viewBox="0 0 20 20"><path d="M10 3 Q14 3 14 8 Q14 11 12 12.5 L12 14.5 L8 14.5 L8 12.5 Q6 11 6 8 Q6 3 10 3" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8.2" y1="16" x2="11.8" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Análisis y recomendaciones';
    document.getElementById('hmap-insight').innerHTML =
      `<div style="background:var(--panel2);border-radius:10px;padding:.8rem 1rem;border-left:3px solid var(--neon)">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--neon);margin-bottom:.5rem">${titulo}</div>
        <div style="font-size:.78rem;line-height:1.6;color:var(--txt)">
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><polyline points="3,15 7,8 11,11 17,5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,5 17,5 17,9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> <strong>Mejor horario:</strong> ${mejor.d} ${mejor.h}${clasesMejor.length>0?` — <em>${clasesMejor.map(c=>c.clase).join(', ')}</em>`:''} con <strong style="color:var(--neon)">${mejor.val}${metric==='aforo'?'%':''}</strong> de ${metricNom}.</p>
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><polyline points="3,5 7,12 11,9 17,15" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="13,15 17,15 17,11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> <strong>Horario crítico:</strong> ${peor.d} ${peor.h}${clasesPeor.length>0?` — <em>${clasesPeor.map(c=>c.clase).join(', ')}</em>`:''} con solo <strong style="color:var(--red2)">${peor.val}${metric==='aforo'?'%':''}</strong> de ${metricNom}.</p>
          <p style="margin:0 0 .4rem"><svg class="ico" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.3"/><line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/><circle cx="13" cy="12.5" r="1" fill="currentColor"/></svg> <strong>Día más activo:</strong> ${diaMasActivo?.d||'—'}${diaMenosActivo?' · <strong>Día más flojo:</strong> '+diaMenosActivo.d:''}</p>
          <p style="margin:0;font-size:.7rem;color:var(--txt3)">${instObj?`Viendo solo las sesiones de <em>${instObj.nombre}</em>${claseFil?' en <em>'+claseFil+'</em>':''}. Quita el filtro para ver el comparativo general.`:'Selecciona un instructor para ver su mapa individual.'}</p>
        </div>
      </div>`;
  } else {
    document.getElementById('hmap-insight').innerHTML = '<div class="empty">Registra clases para ver el análisis de horarios.</div>';
  }
}

function verDiagHorario(dia, hora) {
  // Construir el diagnóstico completo del slot y mostrarlo en modal
  const instId   = document.getElementById('hm-inst')?.value  || '';
  const claseFil = document.getElementById('hm-clase')?.value || '';
  const metric   = document.getElementById('hm-metric')?.value || 'aforo';

  // Recopilar todas las clases programadas en ese slot (respetando filtros)
  const instsFiltro = instId ? instructores.filter(i => i.id === instId) : instructores;
  const clases = [];
  instsFiltro.forEach(inst => {
    (inst.horario||[]).forEach(h => {
      if(h.dia !== dia) return;
      if(Math.abs(horaToMin(h.hora) - horaToMin(hora)) > 30) return;
      if(claseFil && h.clase !== claseFil) return;
      const regsSlot = registros.filter(r =>
        r.inst_id === inst.id && r.dia === dia &&
        Math.abs(horaToMin(r.hora) - horaToMin(hora)) <= 30 &&
        (r.estado==='ok' || r.estado==='sub') && r.cap > 0 &&
        (!claseFil || r.clase === claseFil)
      ).sort((a,b) => b.fecha.localeCompare(a.fecha));

      const faltas = registros.filter(r =>
        r.inst_id === inst.id && r.dia === dia &&
        Math.abs(horaToMin(r.hora) - horaToMin(hora)) <= 30 &&
        r.estado === 'falta'
      ).length;

      const promAsis = regsSlot.length > 0
        ? Math.round(regsSlot.reduce((a,r) => a + (parseInt(r.asistentes)||0), 0) / regsSlot.length) : null;
      const promAfo  = regsSlot.length > 0
        ? Math.round(regsSlot.reduce((a,r) => a + (parseInt(r.asistentes)||0) / parseInt(r.cap) * 100, 0) / regsSlot.length) : null;

      clases.push({
        clase: h.clase,
        inst: inst.nombre,
        inst_id: inst.id,
        promAsis, promAfo,
        sesiones: regsSlot.length,
        faltas,
        registros: regsSlot.slice(0, 10) // últimas 10 sesiones
      });
    });
  });

  // Cabecera resumen global del slot
  const totalSes = clases.reduce((a,c) => a + c.sesiones, 0);
  const promAfoGlobal = clases.filter(c => c.promAfo !== null).length > 0
    ? Math.round(clases.filter(c => c.promAfo !== null).reduce((a,c) => a + c.promAfo, 0) / clases.filter(c => c.promAfo !== null).length) : null;
  const promAsisGlobal = clases.filter(c => c.promAsis !== null).length > 0
    ? Math.round(clases.filter(c => c.promAsis !== null).reduce((a,c) => a + c.promAsis, 0) / clases.filter(c => c.promAsis !== null).length) : null;

  const diaLabel = dia;
  const colorAfo = promAfoGlobal !== null ? pctCol(promAfoGlobal) : 'var(--txt2)';

  // Tarjetas de cada clase con su historial
  const tarjetas = clases.length === 0
    ? `<div style="color:var(--txt2);text-align:center;padding:2rem;font-size:.9rem">No hay clases programadas en este horario con los filtros actuales.</div>`
    : clases.map(c => {
        const colAfo = c.promAfo !== null ? pctCol(c.promAfo) : 'var(--txt2)';
        const colAsis = c.promAsis !== null ? (c.promAsis >= 9 ? 'var(--neon)' : c.promAsis >= 4 ? 'var(--gold2)' : 'var(--red2)') : 'var(--txt2)';

        // Historial de las últimas sesiones
        const histRows = c.registros.length === 0
          ? `<tr><td colspan="4" style="color:var(--txt2);font-size:.75rem;text-align:center;padding:.5rem">Sin sesiones registradas</td></tr>`
          : c.registros.map(r => {
              const afoP = r.cap > 0 ? Math.round(parseInt(r.asistentes)/parseInt(r.cap)*100) : null;
              const instNom = r.estado === 'sub'
                ? (instructores.find(i => i.id === r.suplente_id)?.nombre.split(' ')[0] || '?') + ' (sub)'
                : c.inst.split(' ')[0];
              return `<tr>
                <td style="padding:3px 8px;font-size:.73rem;color:var(--txt2)">${r.fecha}</td>
                <td style="padding:3px 8px;font-size:.73rem">${instNom}</td>
                <td style="padding:3px 8px;font-size:.73rem;text-align:center;font-weight:600;color:${colAsis}">${r.asistentes}</td>
                <td style="padding:3px 8px;font-size:.73rem;text-align:center">
                  <div style="display:inline-flex;align-items:center;gap:4px">
                    <div style="width:44px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                      <div style="height:100%;width:${Math.min(afoP||0,100)}%;background:${afoP!==null?pctCol(afoP):'var(--border)'};border-radius:3px"></div>
                    </div>
                    <span style="color:${afoP!==null?pctCol(afoP):'var(--txt2)'};font-weight:600">${afoP !== null ? afoP+'%' : '—'}</span>
                  </div>
                </td>
              </tr>`;
            }).join('');

        return `<div style="background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:.9rem 1rem;margin-bottom:.8rem">
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap">
            <span style="font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:var(--neon)">${c.clase}</span>
            <span style="font-size:.78rem;color:var(--txt2)">${c.inst}</span>
            <div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap">
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Sesiones:</span> <strong>${c.sesiones}</strong>
              </span>
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Asis. prom:</span> <strong style="color:${colAsis}">${c.promAsis !== null ? c.promAsis : '—'}</strong>
              </span>
              <span style="background:var(--panel);border-radius:6px;padding:2px 8px;font-size:.72rem">
                <span style="color:var(--txt2)">Aforo prom:</span> <strong style="color:${colAfo}">${c.promAfo !== null ? c.promAfo+'%' : '—'}</strong>
              </span>
              ${c.faltas > 0 ? `<span style="background:rgba(224,80,80,.12);border:1px solid var(--red);border-radius:6px;padding:2px 8px;font-size:.72rem;color:var(--red2)"><svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> ${c.faltas} falta${c.faltas>1?'s':''}</span>` : ''}
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border)">
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:left;font-weight:500">Fecha</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:left;font-weight:500">Instructor</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:center;font-weight:500">Asistentes</th>
                  <th style="padding:3px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.8px;color:var(--txt2);text-align:center;font-weight:500">Aforo</th>
                </tr>
              </thead>
              <tbody>${histRows}</tbody>
            </table>
          </div>
          ${c.registros.length === 10 ? `<div style="font-size:.68rem;color:var(--txt2);margin-top:.4rem;text-align:right">Mostrando las últimas 10 sesiones</div>` : ''}
        </div>`;
      }).join('');

  const body = `
    <div style="margin-bottom:1rem">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--neon);margin-bottom:.15rem">
        <svg class="ico" viewBox="0 0 20 20" style="width:1.1em;height:1.1em"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="12.5" r="1" fill="currentColor"/><circle cx="10" cy="12.5" r="1" fill="currentColor"/><circle cx="13" cy="12.5" r="1" fill="currentColor"/></svg>
        Diagnóstico · ${diaLabel} ${hora}
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.5rem">
        <span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Clases activas:</span> <strong>${clases.length}</strong>
        </span>
        <span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Sesiones totales:</span> <strong>${totalSes}</strong>
        </span>
        ${promAsisGlobal !== null ? `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Asistentes prom:</span> <strong style="color:${colorAfo}">${promAsisGlobal}</strong>
        </span>` : ''}
        ${promAfoGlobal !== null ? `<span style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:4px 12px;font-size:.78rem">
          <span style="color:var(--txt2)">Aforo global:</span> <strong style="color:${colorAfo}">${promAfoGlobal}%</strong>
        </span>` : ''}
      </div>
    </div>
    <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt2);margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)">Detalle por clase</div>
    ${tarjetas}
  `;

  document.getElementById('m-diag-horario-body').innerHTML = body;
  document.getElementById('m-diag-horario').classList.add('on');
}

// ═══════════════════════════════════════════
// ALERTAS AUTOMÁTICAS
