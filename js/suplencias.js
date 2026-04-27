// ═══ PLANIFICADOR DE SUPLENCIAS ════════════════════════
// ═══════════════════════════════════════════════════════
let splAsignaciones = {}; // key: "instId|fecha|dia|hora" → {supNombre, supId, motivo, nota, externo}

function abrirSupPlanner(){
  // Poblar selector de instructores
  const sel = document.getElementById('spl-inst');
  sel.innerHTML = '<option value="">— Seleccionar instructor —</option>' +
    instructores.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  // Fechas por defecto: semana actual
  const hoyL = new Date();
  const lun = new Date(hoyL); lun.setDate(hoyL.getDate()-((hoyL.getDay()+6)%7));
  const dom = new Date(lun); dom.setDate(lun.getDate()+6);
  document.getElementById('spl-ini').value = fechaLocalStr(lun);
  document.getElementById('spl-fin').value = fechaLocalStr(dom);
  splRenderMiniCal();
  document.getElementById('spl-clases-wrap').style.display='none';
  document.getElementById('spl-empty').style.display='block';
  document.getElementById('spl-empty').textContent='Selecciona un instructor y un rango de fechas.';
  splAsignaciones = {};
  document.getElementById('m-sup-planner').classList.add('on');
}

function splRenderMiniCal(){
  const wrap = document.getElementById('spl-mini-cal');
  if(!wrap) return;
  const hoyL = new Date();
  const semanas = [];
  // Generar 6 semanas: pasada, actual y 4 próximas
  const base = new Date(hoyL);
  base.setDate(hoyL.getDate()-((hoyL.getDay()+6)%7)-7);
  for(let s=0;s<7;s++){
    const lun = new Date(base); lun.setDate(base.getDate()+s*7);
    const dom = new Date(lun); dom.setDate(lun.getDate()+6);
    semanas.push({lun,dom});
  }
  const fmt = d => d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
  wrap.innerHTML = semanas.map(({lun,dom},i)=>{
    const lunS = fechaLocalStr(lun);
    const domS = fechaLocalStr(dom);
    const actual = fechaLocalStr(new Date()) >= lunS && fechaLocalStr(new Date()) <= domS;
    return `<button onclick="splSetSemana('${lunS}','${domS}')" style="
      padding:4px 9px;font-size:.68rem;border-radius:20px;border:1px solid var(--border);
      background:${actual?'var(--verde)':'var(--panel2)'};
      color:${actual?'#fff':'var(--txt2)'};cursor:pointer;white-space:nowrap;
      transition:all .15s" 
      onmouseover="this.style.borderColor='var(--neon)'" 
      onmouseout="this.style.borderColor='var(--border)'"
    >${fmt(lun)} – ${fmt(dom)}</button>`;
  }).join('');
}

function splSetSemana(ini, fin){
  document.getElementById('spl-ini').value = ini;
  document.getElementById('spl-fin').value = fin;
  splCargarClases();
}

function splCargarClases(){
  const instId = parseInt(document.getElementById('spl-inst').value);
  const ini = document.getElementById('spl-ini').value;
  const fin = document.getElementById('spl-fin').value;
  const wrap = document.getElementById('spl-clases-wrap');
  const empty = document.getElementById('spl-empty');

  if(!instId || !ini || !fin){
    wrap.style.display='none';
    empty.style.display='block';
    empty.textContent='Selecciona un instructor y un rango de fechas.';
    return;
  }
  const inst = instructores.find(i=>String(i.id)===String(instId));
  if(!inst || !(inst.horario||[]).length){
    wrap.style.display='none';
    empty.style.display='block';
    empty.textContent=`${inst?inst.nombre:'—'} no tiene clases asignadas en su horario.`;
    return;
  }

  // Generar todas las fechas entre ini y fin
  const fechas = [];
  const d = new Date(ini+'T12:00:00');
  const dFin = new Date(fin+'T12:00:00');
  while(d <= dFin){ fechas.push(fechaLocalStr(new Date(d))); d.setDate(d.getDate()+1); }

  // Para cada fecha, ver qué slots del horario corresponden a ese día
  const filas = [];
  fechas.forEach(fStr => {
    const dObj = new Date(fStr+'T12:00:00');
    const diaNom = DIAS[(dObj.getDay()+6)%7];
    (inst.horario||[]).forEach(slot => {
      if(slot.dia !== diaNom) return;
      filas.push({ fecha:fStr, dia:diaNom, hora:slot.hora, clase:slot.clase, inst });
    });
  });

  if(filas.length===0){
    wrap.style.display='none';
    empty.style.display='block';
    empty.textContent='No hay clases programadas en ese periodo para este instructor.';
    return;
  }

  empty.style.display='none';
  wrap.style.display='block';

  // Pre-cargar asignaciones guardadas de suplenciasPlan
  filas.forEach(f=>{
    const key = `${instId}|${f.fecha}|${f.dia}|${f.hora}`;
    if(!splAsignaciones[key]){
      const existing = suplenciasPlan.find(s=>
        String(s.inst_id)===String(instId) && s.fecha===f.fecha && s.dia===f.dia && s.hora===f.hora && s.estado!=='rechazado'
      );
      if(existing){
        const supInst = instructores.find(i=>String(i.id)===String(existing.suplente_id));
        splAsignaciones[key]={
          supId: existing.suplente_id||null,
          supNombre: supInst?supInst.nombre:(existing.suplente_nombre||'—'),
          motivo: existing.motivo||'permiso',
          nota: existing.nota||'',
          externo: !supInst && !!existing.suplente_nombre
        };
      }
    }
  });

  // Agrupar por fecha para render
  const porFecha = {};
  filas.forEach(f=>{
    if(!porFecha[f.fecha]) porFecha[f.fecha]=[];
    porFecha[f.fecha].push(f);
  });

  let html = '';
  Object.keys(porFecha).sort().forEach(fStr=>{
    const dO = new Date(fStr+'T12:00:00');
    const lbl = dO.toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'short'});
    html += `<div style="margin-bottom:.7rem">
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--neon);
        padding:.3rem .6rem;background:rgba(26,122,69,.12);border-radius:6px;margin-bottom:.3rem;
        border-left:3px solid var(--verde)">${lbl.charAt(0).toUpperCase()+lbl.slice(1)}</div>`;
    porFecha[fStr].forEach(f=>{
      const key = `${instId}|${f.fecha}|${f.dia}|${f.hora}`;
      const asig = splAsignaciones[key];
      const chipColor = asig ? 'rgba(26,122,69,.18)' : 'rgba(224,80,80,.1)';
      const chipBorder = asig ? 'var(--v3)' : 'var(--red)';
      const chipTxt = asig ? `⇄ ${asig.supNombre}` : '⚠ Sin suplente';
      const chipCol = asig ? 'var(--neon)' : 'var(--red2)';
      html += `<div style="display:flex;align-items:center;gap:.6rem;padding:.55rem .7rem;
        background:var(--panel2);border:1px solid var(--border);border-radius:10px;margin-bottom:.3rem;flex-wrap:wrap">
        <div style="font-family:'DM Mono',monospace;font-size:.78rem;color:var(--gold2);min-width:46px">${f.hora}</div>
        <div style="font-weight:600;font-size:.84rem;flex:1;min-width:120px">${f.clase}</div>
        <div style="font-size:.72rem;padding:3px 10px;border-radius:20px;background:${chipColor};
          border:1px solid ${chipBorder};color:${chipCol};min-width:140px;text-align:center">${chipTxt}</div>
        <button onclick="splAbrirAsignar('${key}','${f.clase}','${f.hora}','${f.dia}','${fStr}')" style="
          padding:4px 12px;border-radius:7px;border:1px solid var(--blue);background:rgba(77,184,232,.12);
          color:var(--blue);font-size:.72rem;cursor:pointer;white-space:nowrap;transition:background .15s"
          onmouseover="this.style.background='rgba(77,184,232,.25)'"
          onmouseout="this.style.background='rgba(77,184,232,.12)'"
        >${asig?'✏ Editar':'+ Asignar'}</button>
      </div>`;
    });
    html += '</div>';
  });
  document.getElementById('spl-clases-lista').innerHTML = html;
}

function splAbrirAsignar(key, clase, hora, dia, fecha){
  // Poblar select de instructores internos
  const instId = parseInt(document.getElementById('spl-inst').value);
  const inst = instructores.find(i=>String(i.id)===String(instId));
  const sel = document.getElementById('spl-sup-inst');
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    instructores.filter(i=>String(i.id)!==String(instId))
      .map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');

  // Info de la clase
  const dO = new Date(fecha+'T12:00:00');
  const fLbl = dO.toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long'});
  document.getElementById('spl-asig-info').innerHTML =
    `<strong style="color:var(--neon)">${clase}</strong> &nbsp;·&nbsp; ${hora} &nbsp;·&nbsp; ${fLbl.charAt(0).toUpperCase()+fLbl.slice(1)}<br>
     <span style="font-size:.75rem;color:var(--txt2)">Instructor: ${inst?inst.nombre:'—'}</span>`;

  // Pre-rellenar si hay asignación
  const asig = splAsignaciones[key];
  document.getElementById('spl-tipo-sup').value = (asig&&asig.externo)?'externo':'interno';
  splToggleTipo();
  if(asig){
    if(asig.externo){
      document.getElementById('spl-sup-externo').value = asig.supNombre||'';
    } else {
      document.getElementById('spl-sup-inst').value = asig.supId||'';
    }
    document.getElementById('spl-motivo').value = asig.motivo||'permiso';
    document.getElementById('spl-nota').value = asig.nota||'';
    document.getElementById('spl-asig-del').style.display='block';
  } else {
    document.getElementById('spl-sup-inst').value='';
    document.getElementById('spl-sup-externo').value='';
    document.getElementById('spl-motivo').value='permiso';
    document.getElementById('spl-nota').value='';
    document.getElementById('spl-asig-del').style.display='none';
  }
  document.getElementById('spl-asig-key').value = key;
  document.getElementById('m-spl-asignar').classList.add('on');
}

function splToggleTipo(){
  const t = document.getElementById('spl-tipo-sup').value;
  document.getElementById('spl-row-interno').style.display = t==='interno'?'':'none';
  document.getElementById('spl-row-externo').style.display = t==='externo'?'':'none';
}

function splGuardarAsignacion(){
  const key = document.getElementById('spl-asig-key').value;
  const tipo = document.getElementById('spl-tipo-sup').value;
  let supId = null, supNombre = '', externo = false;
  if(tipo==='interno'){
    supId = parseInt(document.getElementById('spl-sup-inst').value)||null;
    if(!supId){ showToast('Selecciona un instructor suplente','err'); return; }
    const s = instructores.find(i=>String(i.id)===String(supId));
    supNombre = s ? s.nombre : '—';
  } else {
    supNombre = document.getElementById('spl-sup-externo').value.trim();
    if(!supNombre){ showToast('Escribe el nombre del suplente externo','err'); return; }
    externo = true;
  }
  splAsignaciones[key] = {
    supId, supNombre, externo,
    motivo: document.getElementById('spl-motivo').value,
    nota: document.getElementById('spl-nota').value.trim()
  };
  cerrarModal('m-spl-asignar');
  splCargarClases(); // re-render
  showToast(`Suplente asignado: ${supNombre}`,'ok');
}

function splQuitarAsignacion(){
  const key = document.getElementById('spl-asig-key').value;
  delete splAsignaciones[key];
  cerrarModal('m-spl-asignar');
  splCargarClases();
  showToast('Suplente removido','info');
}

async function splGuardarTodo(){
  const instId = parseInt(document.getElementById('spl-inst').value);
  if(!instId){ showToast('Selecciona un instructor','err'); return; }
  const keys = Object.keys(splAsignaciones);
  if(keys.length===0){ showToast('No hay suplencias asignadas','warn'); return; }
  let guardados=0;
  for(const key of keys){
    const [iId,fecha,dia,hora] = key.split('|');
    const inst = instructores.find(i=>String(i.id)===String(iId));
    if(!inst) continue;
    const slot = (inst.horario||[]).find(h=>h.dia===dia&&h.hora===hora);
    if(!slot) continue;
    const asig = splAsignaciones[key];
    const datos = {
      id: Date.now()+guardados,
      inst_id: parseInt(iId),
      suplente_id: asig.supId||null,
      suplente_nombre: asig.externo ? asig.supNombre : null,
      clase: slot.clase, dia, hora, fecha,
      motivo: asig.motivo, nota: asig.nota,
      estado: 'aprobado', ts: new Date().toISOString()
    };
    // Buscar si ya existe para actualizar
    const exIdx = suplenciasPlan.findIndex(s=>
      String(s.inst_id)===String(iId) && s.fecha===fecha && s.dia===dia && s.hora===hora
    );
    if(exIdx>=0){ datos.id=suplenciasPlan[exIdx].id; suplenciasPlan[exIdx]=datos; }
    else suplenciasPlan.push(datos);
    if(fbDb){
      try{ await fbDb.ref(`fitness/suplencias/${datos.id}`).set(datos); }catch(e){}
    }
    guardados++;
  }
  guardarSupLocal();
  renderSupPlan();
  showToast(`${guardados} suplencia(s) guardada(s) correctamente`,'ok');
  registrarLog('suplencia', `Planificador: ${guardados} suplencias guardadas`);
}

function splImprimir(){
  const instId = parseInt(document.getElementById('spl-inst').value);
  const ini = document.getElementById('spl-ini').value;
  const fin = document.getElementById('spl-fin').value;
  const inst = instructores.find(i=>String(i.id)===String(instId));
  if(!inst){ showToast('Selecciona un instructor','warn'); return; }

  const keys = Object.keys(splAsignaciones);
  const fmt = d => new Date(d+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short'});
  const fmtLargo = d => new Date(d+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  let rows = '';
  // Reconstruir todas las filas visibles
  const all = [];
  const d = new Date(ini+'T12:00:00');
  const dFin = new Date(fin+'T12:00:00');
  while(d<=dFin){
    const fStr = fechaLocalStr(new Date(d));
    const diaNom = DIAS[(new Date(d).getDay()+6)%7];
    (inst.horario||[]).forEach(slot=>{
      if(slot.dia!==diaNom)return;
      const key=`${instId}|${fStr}|${diaNom}|${slot.hora}`;
      const asig=splAsignaciones[key];
      all.push({fecha:fStr,dia:diaNom,hora:slot.hora,clase:slot.clase,asig});
    });
    d.setDate(d.getDate()+1);
  }
  all.sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.hora.localeCompare(b.hora));
  all.forEach(r=>{
    const supTxt = r.asig ? r.asig.supNombre : '<span style="color:#c00">Sin asignar</span>';
    const motivoTxt = r.asig ? r.asig.motivo : '—';
    rows += `<tr>
      <td>${fmt(r.fecha)}</td>
      <td>${r.hora}</td>
      <td><strong>${r.clase}</strong></td>
      <td>${supTxt}</td>
      <td>${motivoTxt}</td>
      <td style="font-size:.75rem;color:#666">${r.asig&&r.asig.nota?r.asig.nota:'—'}</td>
    </tr>`;
  });

  const html = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <div style="background:#1a7a45;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;margin-bottom:0">
      <div style="font-size:18px;font-weight:700;letter-spacing:1px">REPORTE DE SUPLENCIAS</div>
      <div style="font-size:12px;margin-top:2px;opacity:.85">Club Campestre Aguascalientes</div>
    </div>
    <div style="background:#f5f5f5;padding:8px 16px;margin-bottom:12px;border-radius:0 0 8px 8px;display:flex;gap:2rem;font-size:12px;color:#333">
      <span><strong>Instructor:</strong> ${inst.nombre}</span>
      <span><strong>Periodo:</strong> ${fmt(ini)} – ${fmt(fin)}</span>
      <span><strong>Total clases:</strong> ${all.length}</span>
      <span><strong>Suplentes asignados:</strong> ${keys.length}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#1a7a45;color:#fff">
        <th style="padding:6px 8px;text-align:left">Fecha</th>
        <th style="padding:6px 8px;text-align:left">Hora</th>
        <th style="padding:6px 8px;text-align:left">Clase</th>
        <th style="padding:6px 8px;text-align:left">Suplente</th>
        <th style="padding:6px 8px;text-align:left">Motivo</th>
        <th style="padding:6px 8px;text-align:left">Nota</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;font-size:11px;color:#888;text-align:right">
      Generado: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}
    </div>
  </div>`;

  document.getElementById('print-ttl').textContent='Reporte de Suplencias — '+inst.nombre;
  document.getElementById('print-body').innerHTML=html;
  cerrarModal('m-sup-planner');
  document.getElementById('m-print').classList.add('on');
}


// ═══ REPORTE DE SUPLENCIAS ═══
let lastSuplencias=[];
function renderReporteSuplencias(){
  const ini=document.getElementById('sup-fecha-ini').value;
  const fin=document.getElementById('sup-fecha-fin').value;
  const filtInst=document.getElementById('sup-filtro-inst').value;
  if(!ini||!fin){showToast('Selecciona el rango de fechas','err');return;}
  const d1=new Date(ini+'T00:00:00');const d2=new Date(fin+'T23:59:59');
  lastSuplencias=registros.filter(r=>{
    if(r.estado!=='sub')return false;
    const d=new Date(r.fecha+'T12:00:00');
    if(d<d1||d>d2)return false;
    if(filtInst&&String(r.suplente_id)!==filtInst)return false;
    return true;
  }).sort((a,b)=>a.fecha.localeCompare(b.fecha));

  if(lastSuplencias.length===0){
    document.getElementById('sup-body').innerHTML='<div class="empty">Sin suplencias en el periodo seleccionado</div>';
    document.getElementById('sup-export-btns').style.display='none';return;
  }
  let html=`<div style="font-size:.78rem;color:var(--txt2);margin-bottom:.6rem">${lastSuplencias.length} suplencia(s) encontradas — ${ini} al ${fin}</div>
    <div style="overflow-x:auto;max-height:340px">
    <table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="position:sticky;top:0;background:var(--panel2)">
        ${['Fecha','Clase','Horario','Instructor Original','Suplente','Motivo','Asistentes','Aforo %'].map(h=>`<th style="padding:7px 10px;color:var(--txt2);font-size:.67rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${lastSuplencias.map((r,n)=>{
        const instOrig=instructores.find(i=>i.id===r.inst_id);
        const sup=instructores.find(i=>i.id===r.suplente_id);
        const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
        const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        const motivoNom=r.motivo_suplencia?({'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'}[r.motivo_suplencia]||r.motivo_suplencia):'—';
        return `<tr style="background:${n%2?'var(--panel2)':'transparent'};border-bottom:1px solid var(--border)">
          <td style="padding:6px 10px;font-family:monospace;font-size:.78rem">${fd}</td>
          <td style="padding:6px 10px;font-weight:600">${r.clase}</td>
          <td style="padding:6px 10px;font-family:monospace">${r.hora}</td>
          <td style="padding:6px 10px;color:var(--txt2)">${instOrig?instOrig.nombre:'—'}</td>
          <td style="padding:6px 10px;color:var(--blue);font-weight:600">${sup?sup.nombre:'—'}</td>
          <td style="padding:6px 10px;color:var(--txt2);font-size:.76rem">${motivoNom}</td>
          <td style="padding:6px 10px;text-align:center;color:${pctCol(afoP)};font-weight:700">${r.asistentes}</td>
          <td style="padding:6px 10px;text-align:center;color:${pctCol(afoP)};font-weight:700">${afoP}%</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  document.getElementById('sup-body').innerHTML=html;
  document.getElementById('sup-export-btns').style.display='flex';
}
function imprimirSuplencias(){
  const ini=document.getElementById('sup-fecha-ini').value;
  const fin=document.getElementById('sup-fecha-fin').value;
  if(lastSuplencias.length===0)return;
  const html=`<div style="font-family:'Outfit',sans-serif;color:#111">
    <div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem;display:flex;justify-content:space-between">
      <div><h1 style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:2px;color:#1a7a45;margin:0">REPORTE DE SUPLENCIAS</h1>
        <p style="color:#555;font-size:.8rem">Club Campestre Aguascalientes · Coordinación Fitness</p>
        <p style="color:#333;font-size:.82rem;margin-top:2px">Periodo: <strong>${ini}</strong> al <strong>${fin}</strong> · Total: ${lastSuplencias.length} suplencias</p>
      </div>
      <div style="text-align:right"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:#1a7a45">${lastSuplencias.length}</div><div style="font-size:.78rem;color:#555">suplencias</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.79rem">
      <thead><tr style="background:#f0f7f3">
        ${['Fecha','Clase','Horario','Instructor Original','Suplente','Motivo','Asistentes','Aforo %'].map(h=>`<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.67rem;text-transform:uppercase">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${lastSuplencias.map((r,n)=>{
        const instOrig=instructores.find(i=>i.id===r.inst_id);
        const sup=instructores.find(i=>i.id===r.suplente_id);
        const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
        const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        const col=pctColPrint(afoP);
        const motivoNom=r.motivo_suplencia?({'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'}[r.motivo_suplencia]||r.motivo_suplencia):'—';
        return `<tr style="background:${n%2?'#f9fdf9':'#fff'}">
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">${fd}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">${r.clase}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">${r.hora}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5">${instOrig?instOrig.nombre:'—'}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:600">${sup?sup.nombre:'—'}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;color:#555">${motivoNom}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center;color:${col};font-weight:700">${r.asistentes}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center;color:${col};font-weight:700">${afoP}%</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div style="margin-top:1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div style="border-top:2px solid #1a7a45;padding-top:.5rem">
        <div style="font-size:.75rem;color:#555;margin-bottom:2rem">Firma Coordinador Fitness</div>
        <div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>
      </div>
      <div style="border-top:2px solid #1a7a45;padding-top:.5rem">
        <div style="font-size:.75rem;color:#555;margin-bottom:2rem">Vo.Bo. Recursos Humanos</div>
        <div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>
      </div>
    </div>
  </div>`;
  document.getElementById('print-ttl').textContent=`Suplencias — ${ini} al ${fin}`;
  document.getElementById('print-body').innerHTML=html;
  cerrarModal('m-suplencias');
  document.getElementById('m-print').classList.add('on');
}
function exportarSuplenciasExcel(){
  if(!lastSuplencias.length)return;
  const rows=[['Fecha','Clase','Horario','Instructor Original','Suplente','Asistentes','Aforo %','Día']];
  lastSuplencias.forEach(r=>{
    const instOrig=instructores.find(i=>i.id===r.inst_id);
    const sup=instructores.find(i=>i.id===r.suplente_id);
    const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
    rows.push([r.fecha,r.clase,r.hora,instOrig?instOrig.nombre:'—',sup?sup.nombre:'—',r.asistentes,afoP+'%',r.dia]);
  });
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:14},{wch:14},{wch:9},{wch:22},{wch:22},{wch:12},{wch:10},{wch:11}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,'Suplencias',ws);
  XLSX.writeFile(wb,'Suplencias_FitnessControl.xlsx');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  CALENDARIO DE SUPLENCIAS — abrirCalSuplencias & helpers    ║
// ╚══════════════════════════════════════════════════════════════╝

let _calsupMes   = new Date().getMonth();
let _calsupYear  = new Date().getFullYear();
let _calsupDia   = null;   // fecha seleccionada 'YYYY-MM-DD'
let _calsupFiltInst = '';  // id instructor filtrado ('' = todos)

const _CALSUP_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _CALSUP_DOWS  = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

function abrirCalSuplencias() {
  // Resetear estado
  _calsupMes   = new Date().getMonth();
  _calsupYear  = new Date().getFullYear();
  _calsupDia   = null;
  _calsupFiltInst = '';

  // Llenar selector de instructores
  const sel = document.getElementById('calsup-inst-fil');
  if (sel) {
    sel.innerHTML = '<option value="">Todos los instructores</option>' +
      (instructores || []).map(i =>
        `<option value="${i.id}">${i.nombre}</option>`
      ).join('');
    sel.value = '';
  }

  _calsupRenderGrid();
  _calsupRenderDetalle(null);
  abrirModal('m-cal-suplencias');
}

function calsupCambiarMes(delta) {
  _calsupMes += delta;
  if (_calsupMes > 11) { _calsupMes = 0;  _calsupYear++; }
  if (_calsupMes < 0)  { _calsupMes = 11; _calsupYear--; }
  _calsupDia = null;
  _calsupRenderGrid();
  _calsupRenderDetalle(null);
}

function calsupFiltrarInst() {
  const sel = document.getElementById('calsup-inst-fil');
  _calsupFiltInst = sel ? sel.value : '';
  _calsupDia = null;
  _calsupRenderGrid();
  _calsupRenderDetalle(null);
}

function _calsupGetData() {
  // Combina suplenciasPlan (planificadas) y registros estado='sub' (recorrido)
  const resultado = {};

  // ── 1. Suplencias planificadas ──────────────────────────────
  (suplenciasPlan || []).forEach(s => {
    if (!s.fecha) return;
    if (_calsupFiltInst && String(s.inst_id) !== _calsupFiltInst &&
        String(s.suplente_id) !== _calsupFiltInst) return;
    if (!resultado[s.fecha]) resultado[s.fecha] = [];
    const instOrig = (instructores || []).find(i => i.id === s.inst_id);
    const sup      = (instructores || []).find(i => i.id === s.suplente_id);
    resultado[s.fecha].push({
      hora:     s.hora || '—',
      clase:    s.clase || '—',
      dia:      s.dia  || '',
      original: instOrig ? instOrig.nombre : '—',
      suplente: sup     ? sup.nombre      : '—',
      motivo:   s.motivo || '',
      fuente:   'plan',
      estado:   s.estado || ''
    });
  });

  // ── 2. Registros reales de recorrido (estado='sub') ─────────
  (registros || []).forEach(r => {
    if (r.estado !== 'sub' || !r.fecha) return;
    if (_calsupFiltInst && String(r.inst_id) !== _calsupFiltInst &&
        String(r.suplente_id) !== _calsupFiltInst) return;
    if (!resultado[r.fecha]) resultado[r.fecha] = [];
    const instOrig = (instructores || []).find(i => i.id === r.inst_id);
    const sup      = (instructores || []).find(i => i.id === r.suplente_id);
    resultado[r.fecha].push({
      hora:     r.hora    || '—',
      clase:    r.clase   || '—',
      dia:      r.dia     || '',
      original: instOrig  ? instOrig.nombre : '—',
      suplente: sup        ? sup.nombre      : '—',
      motivo:   r.motivo_suplencia || '',
      fuente:   'real',
      estado:   ''
    });
  });

  return resultado;
}

function _calsupRenderGrid() {
  const lbl  = document.getElementById('calsup-mes-lbl');
  const grid = document.getElementById('calsup-cal-grid');
  if (!lbl || !grid) return;

  lbl.textContent = `${_CALSUP_MESES[_calsupMes]} ${_calsupYear}`;

  const data       = _calsupGetData();
  const primerDow  = new Date(_calsupYear, _calsupMes, 1).getDay();
  const diasEnMes  = new Date(_calsupYear, _calsupMes + 1, 0).getDate();
  const hoy        = new Date();
  const esEsteMes  = hoy.getFullYear() === _calsupYear && hoy.getMonth() === _calsupMes;
  const diaHoy     = hoy.getDate();

  let html = '';

  // Cabecera días de la semana
  _CALSUP_DOWS.forEach((d, i) => {
    const esFin = i === 0 || i === 6;
    html += `<div class="calsup-weekday${esFin ? ' fin' : ''}">${d}</div>`;
  });

  // Celdas vacías iniciales
  for (let i = 0; i < primerDow; i++) {
    html += `<div class="calsup-day vacio"></div>`;
  }

  // Días del mes
  for (let d = 1; d <= diasEnMes; d++) {
    const yyyy = _calsupYear;
    const mm   = String(_calsupMes + 1).padStart(2, '0');
    const dd   = String(d).padStart(2, '0');
    const key  = `${yyyy}-${mm}-${dd}`;
    const sups = data[key] || [];
    const cnt  = sups.length;

    const esHoy   = esEsteMes && d === diaHoy;
    const esSelec = _calsupDia === key;
    const tieneSup = cnt > 0;

    let cls = 'calsup-day';
    if (esSelec)  cls += ' is-selected';
    else if (esHoy) cls += ' is-today';
    if (tieneSup && !esSelec) cls += ' has-sup';

    const badge = cnt > 0
      ? `<span class="calsup-badge">${cnt}</span>`
      : '';

    html += `<div class="${cls}" onclick="_calsupSelecDia('${key}')">${d}${badge}</div>`;
  }

  grid.innerHTML = html;
}

function _calsupSelecDia(key) {
  _calsupDia = (_calsupDia === key) ? null : key;
  _calsupRenderGrid();
  _calsupRenderDetalle(_calsupDia);
}

function _calsupRenderDetalle(key) {
  const el = document.getElementById('calsup-detail');
  if (!el) return;

  if (!key) {
    el.innerHTML = `<div class="calsup-empty">Toca un día para ver las suplencias registradas.</div>`;
    return;
  }

  const data = _calsupGetData();
  const sups = data[key] || [];

  if (sups.length === 0) {
    const fd = new Date(key + 'T12:00:00').toLocaleDateString('es-MX',
      {weekday:'long', day:'numeric', month:'long'});
    el.innerHTML = `<div class="calsup-empty">${fd}<br><br>Sin suplencias registradas.</div>`;
    return;
  }

  const fd = new Date(key + 'T12:00:00').toLocaleDateString('es-MX',
    {weekday:'long', day:'numeric', month:'long', year:'numeric'});

  let html = `<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.5rem;text-transform:capitalize">${fd}</div>`;

  sups.forEach(s => {
    const motivoMap = {
      permiso:'Permiso', vacaciones:'Vacaciones', falta:'Falta',
      incapacidad:'Incapacidad', medico:'Cita médica',
      capacitacion:'Capacitación', emergencia:'Emergencia', otro:'Otro'
    };
    const motivoTxt = s.motivo ? (motivoMap[s.motivo] || s.motivo) : '';
    const fuenteTag = s.fuente === 'real'
      ? `<span style="font-size:.58rem;color:var(--neon);margin-left:4px">✓ recorrido</span>`
      : '';

    html += `<div class="sup-item">
      <div class="sup-item-hora">${s.hora} · ${s.dia || ''}</div>
      <div class="sup-item-clase">${s.clase}${fuenteTag}</div>
      <div class="sup-item-suplente">${s.suplente}</div>
      <div class="sup-item-original">por: ${s.original}</div>
      ${motivoTxt ? `<div class="sup-item-motivo">${motivoTxt}</div>` : ''}
    </div>`;
  });

  el.innerHTML = html;
}
