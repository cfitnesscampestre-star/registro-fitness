// ═══ REPORTES — Fitness Control · Club Campestre ═══
// ═══ REPORTES ═══
function printStyles(){return`font-family:'Outfit',sans-serif;color:#111;`;}
function pHdr(titulo,sub){
  return`<div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem;">
    <h1 style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:2px;color:#1a7a45;margin:0">${titulo}</h1>
    <p style="color:#555;font-size:.8rem">${sub}</p></div>`;
}
function pFirma(){
  return`<div style="margin-top:1rem;padding:.7rem;background:#f0f7f3;border-radius:7px;border-left:4px solid #1a7a45;font-size:.8rem">
    <strong>Coordinador Fitness:</strong> Club Campestre Aguascalientes &nbsp;|&nbsp; Firma: ______________________ &nbsp;|&nbsp; Vo.Bo. RRHH: ______________________</div>`;
}
function initRptAnios(){
  // Poblar selectores de año con años disponibles en registros
  const anios = [...new Set(registros.map(r=>(r.fecha||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const anioActual = new Date().getFullYear();
  if(!anios.includes(String(anioActual))) anios.unshift(String(anioActual));
  ['rpt-anio','rpt-inst-anio'].forEach(id=>{
    const sel = document.getElementById(id);
    if(!sel) return;
    const cur = sel.value || String(anioActual);
    sel.innerHTML = anios.map(a=>`<option value="${a}" ${a===cur?'selected':''}>${a}</option>`).join('');
  });
}

function autoRptDia(){
  const fechaVal = document.getElementById('rpt-dia-fecha').value;
  if(!fechaVal) return;
  const d = new Date(fechaVal + 'T12:00:00');
  const diasJS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const diaStr = diasJS[d.getDay()];
  document.getElementById('rpt-dia').value = diaStr;
}

function toggleRpt(){
  initRptAnios();
  const t=document.getElementById('rpt-tipo').value;
  document.getElementById('rpt-dia-opt').style.display=t==='diario'?'':'none';
  document.getElementById('rpt-mes-opt').style.display=t==='mensual'?'':'none';
  document.getElementById('rpt-inst-opt').style.display=t==='instructor'?'':'none';
  if(t==='diario'){
    // Poner fecha de hoy por defecto
    if(!document.getElementById('rpt-dia-fecha').value){
      document.getElementById('rpt-dia-fecha').value = new Date().toISOString().slice(0,10);
      autoRptDia();
    }
  }
  if(t==='mensual'){
    // Mes actual por defecto
    document.getElementById('rpt-mes').value = String(new Date().getMonth());
  }
  if(t==='instructor'){
    const sel=document.getElementById('rpt-inst-sel');
    sel.innerHTML='<option value="todos">— Todos los instructores —</option>'+
      [...instructores].sort((a,b)=>a.nombre.localeCompare(b.nombre))
        .map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  }
}
function genReporte(){
  const t=document.getElementById('rpt-tipo').value;
  cerrarModal('m-reports');
  if(t==='diario')genReporteDiario();
  else if(t==='semanal')genReporteSemanal();
  else if(t==='mensual')genReporteMensual();
  else genReporteInstructor();
}

// ── REPORTE DIARIO ────────────────────────────────────────────────────────────
function genReporteDiario(){
  const fechaEsp = document.getElementById('rpt-dia-fecha').value; // YYYY-MM-DD
  const dia      = document.getElementById('rpt-dia').value;
  const fechaFmt = fechaEsp
    ? new Date(fechaEsp+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})
    : dia;

  // ── Construir lista de clases programadas ese día ──
  const horariosDelDia = [];
  instructores.forEach(inst=>{
    (inst.horario||[]).filter(h=>h.dia===dia).forEach(h=>{
      // Buscar registro de ESA FECHA EXACTA (o el más reciente de ese día si no hay fecha)
      let rec = null;
      if(fechaEsp){
        rec = registros.find(r=>
          r.inst_id===inst.id && r.dia===dia &&
          r.hora===h.hora && r.clase===h.clase &&
          r.fecha===fechaEsp
        );
      }
      // Si no hay registro para esa fecha, mostrar como pendiente
      // Pero también buscar promedio histórico para referencia
      const histRecs = registros.filter(r=>
        r.inst_id===inst.id && r.dia===dia &&
        r.hora===h.hora && r.clase===h.clase &&
        (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0)>0
      );
      const capSalon = getCapClase(h.clase);
      const histProm = histRecs.length>0
        ? Math.round(histRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0)/histRecs.length) : null;
      const histAfo  = histRecs.length>0
        ? Math.round(histRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/histRecs.length) : null;

      horariosDelDia.push({
        hora:h.hora, clase:h.clase, inst:inst.nombre,
        asis:rec ? rec.asistentes : null,
        cap:rec ? rec.cap : capSalon,
        estado:rec ? rec.estado : (fechaEsp ? 'pendiente' : '—'),
        suplente_id: rec ? rec.suplente_id : null,
        histProm, histAfo, histSesiones:histRecs.length
      });
    });
  });
  horariosDelDia.sort((a,b)=>a.hora.localeCompare(b.hora));

  const tProg = horariosDelDia.length;
  const tImp  = horariosDelDia.filter(h=>h.asis!==null&&h.estado!=='pendiente').length;
  const tPend = horariosDelDia.filter(h=>h.estado==='pendiente').length;
  const tAsis = horariosDelDia.reduce((a,h)=>a+(h.asis||0),0);
  const tAfoRecs = horariosDelDia.filter(h=>h.asis!==null&&h.cap>0);
  const tAfo  = tAfoRecs.length>0 ? Math.round(tAfoRecs.reduce((a,h)=>a+h.asis/h.cap*100,0)/tAfoRecs.length) : 0;

  const html=`<div style="${printStyles()}">
    ${pHdr(`REPORTE DIARIO — ${dia.toUpperCase()}`,
      `Club Campestre Aguascalientes · ${fechaFmt} · Generado: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}`)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.7rem;margin-bottom:1rem">
      ${[
        ['Clases programadas', tProg,'#1a7a45'],
        ['Impartidas / con datos', tImp,'#0d6a9e'],
        ['Total asistentes', tAsis,'#b87a00'],
        ['Aforo prom.', tAfo+'%', tAfo>=60?'#1a7a45':tAfo>=35?'#b87a00':'#c00']
      ].map(([l,v,c])=>`
        <div style="border:1px solid #ccc;border-radius:8px;padding:.8rem;border-top:3px solid ${c};text-align:center">
          <div style="font-size:.63rem;text-transform:uppercase;color:#777;letter-spacing:1px">${l}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.9rem;color:${c}">${v}</div>
        </div>`).join('')}
    </div>
    ${tPend>0?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:.5rem .8rem;margin-bottom:.8rem;font-size:.78rem">
      ⚠ <strong>${tPend} clase(s) sin registro</strong> para esta fecha. Los datos de promedio histórico se muestran en itálica como referencia.
    </div>`:''}
    <table style="width:100%;border-collapse:collapse;font-size:.79rem;margin-bottom:1rem">
      <thead><tr style="background:#f0f7f3">
        ${['Hora','Clase','Instructor','Asistentes','Aforo%','Estado','Suplente','Prom.Hist.'].map(h=>
          `<th style="padding:6px 8px;border:1px solid #ccc;color:#1a7a45;font-size:.66rem;text-transform:uppercase">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
      ${horariosDelDia.map((h,n)=>{
        const pct = h.asis!==null&&h.cap>0 ? Math.round(h.asis/h.cap*100) : null;
        const col = pct===null?'#555':pctColPrint(pct);
        const esPend = h.estado==='pendiente';
        const estTxt = h.estado==='sub'?'⇄ Suplente':h.estado==='ok'?'✔ Impartida':h.estado==='falta'?'✖ Falta':esPend?'— Pendiente':'—';
        const estCol = h.estado==='falta'?'#c00':h.estado==='ok'||h.estado==='sub'?'#155724':'#856404';
        const histTxt = h.histProm!==null ? `${h.histProm}p · ${h.histAfo}%` : '—';
        return `<tr style="background:${n%2?'#f9fdf9':'#fff'};${esPend?'opacity:.7':''}">
          <td style="padding:5px 8px;border:1px solid #e0ede5;font-family:monospace;font-weight:600">${h.hora}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;font-weight:600">${h.clase}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5">${h.inst}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;font-weight:700;color:${col};font-style:${esPend?'italic':'normal'}">
            ${h.asis!==null?h.asis:'—'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${col};font-weight:600">
            ${pct!==null?pct+'%':'—'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${estCol};font-weight:600">${estTxt}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#1a5a8a;font-size:.75rem">
            ${h.estado==='sub'?nombreSuplente(h.suplente_id):'—'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#777;font-size:.74rem;font-style:italic">
            ${histTxt}${h.histSesiones>0?` (${h.histSesiones}ses)`:''}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    ${pFirma()}
  </div>`;

  document.getElementById('print-ttl').textContent=`Reporte Diario — ${dia} ${fechaEsp||''}`;
  document.getElementById('print-body').innerHTML=html;
  document.getElementById('m-print').classList.add('on');
}

// ── REPORTE SEMANAL ───────────────────────────────────────────────────────────
function genReporteSemanal(){
  const lunes   = getLunes(calOffset);
  const lunStr  = lunes.toISOString().slice(0,10);
  const domDate = new Date(lunes); domDate.setDate(lunes.getDate()+6);
  const domStr  = domDate.toISOString().slice(0,10);

  const totalSem=instructores.reduce((a,i)=>a+(i.horario||[]).length,0);

  // ── Filtrar registros sólo de esta semana ──
  const regsSemanales = registros.filter(r=>{
    const f=r.fecha||'';
    return f>=lunStr && f<=domStr && (r.estado==='ok'||r.estado==='sub');
  });

  // ── Construir mapa con datos reales ──
  const mapa={};
  instructores.forEach(inst=>{
    (inst.horario||[]).forEach(h=>{
      const k=`${h.dia}||${h.hora}`;
      if(!mapa[k])mapa[k]=[];
      // Registros de ESTA semana para este slot
      const recsSlot=regsSemanales.filter(r=>
        r.inst_id===inst.id && r.dia===h.dia && r.hora===h.hora && r.clase===h.clase
      );
      const asis = recsSlot.length>0 ? recsSlot[recsSlot.length-1].asistentes : null; // última sesión de la semana
      const cap  = recsSlot.length>0 ? recsSlot[recsSlot.length-1].cap : getCapClase(h.clase);
      const esSub = recsSlot.some(r=>r.estado==='sub');
      mapa[k].push({clase:h.clase, inst:inst.nombre.split(' ')[0], asis, cap, esSub});
    });
  });

  // Totales de la semana
  const totAsis = regsSemanales.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  const totSes  = regsSemanales.length;
  const regsConCap = regsSemanales.filter(r=>parseInt(r.cap||0)>0);
  const aforoProm = regsConCap.length>0
    ? Math.round(regsConCap.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/regsConCap.length) : 0;
  const totSubs = regsSemanales.filter(r=>r.estado==='sub').length;
  const sinDatos = totalSem - totSes; // programadas sin registro esta semana

  let calRows='';
  HORAS_CAL.forEach(h=>{
    let row=`<tr><td style="padding:4px 6px;font-family:monospace;font-size:.7rem;color:#555;border-right:2px solid #ccc;white-space:nowrap">${h}</td>`;
    DIAS.forEach(d=>{
      const clases=(mapa[`${d}||${h}`]||[]);
      if(clases.length>0){
        const c=clases.map(cl=>{
          const pct = cl.asis!==null && cl.cap>0 ? Math.round(cl.asis/cl.cap*100) : null;
          const bg  = pct===null?'#e8f5e9':pct<=15?'#f8d7da':pct<=40?'#fff3cd':'#d4edda';
          const tc  = pct===null?'#777'  :pct<=15?'#842029':pct<=40?'#856404':'#155724';
          const val = pct!==null ? `${cl.asis}p · ${pct}%` : 'Sin registro';
          const sub = cl.esSub ? ' ⇄' : '';
          return `<div style="background:${bg};color:${tc};font-size:.62rem;padding:2px 4px;border-radius:3px;margin-bottom:1px">
            <b>${cl.clase.slice(0,9)}</b>${sub} ${val}</div>`;
        }).join('');
        row+=`<td style="padding:2px;border:1px solid #e0ede5">${c}</td>`;
      } else row+=`<td style="border:1px solid #e0ede5"></td>`;
    });
    row+='</tr>';calRows+=row;
  });

  const html=`<div style="${printStyles()}">
    ${pHdr('REPORTE SEMANAL — CALENDARIO',
      `Club Campestre Aguascalientes · ${semanaStr(lunes)} · ${totalSem} clases programadas`)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem">
      ${[
        ['Sesiones registradas',`${totSes} / ${totalSem}`,'#1a7a45'],
        ['Total asistentes', totAsis, '#0d6a9e'],
        ['Aforo promedio', aforoProm+'%', aforoProm>=60?'#1a7a45':aforoProm>=35?'#b87a00':'#c00'],
        ['Suplencias', totSubs, totSubs>0?'#856404':'#1a7a45']
      ].map(([l,v,c])=>`
        <div style="border:1px solid #ccc;border-radius:7px;padding:.6rem;text-align:center;border-top:3px solid ${c}">
          <div style="font-size:.6rem;text-transform:uppercase;color:#777;letter-spacing:1px">${l}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:${c}">${v}</div>
        </div>`).join('')}
    </div>
    ${sinDatos>0?`<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:.4rem .7rem;margin-bottom:.6rem;font-size:.75rem">
      ⚠ <strong>${sinDatos} clase(s)</strong> programadas esta semana sin registro de aforo aún.
      Las celdas en <span style="background:#e8f5e9;padding:0 4px;border-radius:2px;color:#777">verde claro</span> no tienen datos de esta semana.
    </div>`:''}
    <p style="font-size:.7rem;color:#777;margin-bottom:.5rem">
      ✅ Buen aforo (≥40%) &nbsp;·&nbsp; ⚠ Aforo medio (16-40%) &nbsp;·&nbsp; ❌ Aforo bajo (≤15%) &nbsp;·&nbsp; Sin registro = celdas verdes sin números
    </p>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:.75rem;min-width:580px">
      <thead><tr style="background:#f0f7f3">
        <th style="padding:5px 6px;border:1px solid #ccc;font-size:.66rem;text-transform:uppercase;color:#1a7a45;width:50px">Hora</th>
        ${DIAS.map(d=>`<th style="padding:5px 6px;border:1px solid #ccc;font-size:.66rem;text-transform:uppercase;color:#1a7a45;text-align:center">${d}</th>`).join('')}
      </tr></thead>
      <tbody>${calRows}</tbody>
    </table></div>
    ${pFirma()}
  </div>`;
  document.getElementById('print-ttl').textContent=`Reporte Semanal — ${semanaStr(lunes)}`;
  document.getElementById('print-body').innerHTML=html;
  document.getElementById('m-print').classList.add('on');
}

// ── REPORTE MENSUAL ───────────────────────────────────────────────────────────
function genReporteMensual(){
  const mesIdx = parseInt(document.getElementById('rpt-mes').value);
  const anio   = parseInt(document.getElementById('rpt-anio').value) || new Date().getFullYear();
  const mesNom = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesIdx];

  // ── Filtrar registros REALES del mes y año seleccionados ──
  const regsDelMes = registros.filter(r=>{
    if(!r.fecha) return false;
    const d = new Date(r.fecha+'T12:00:00');
    return d.getMonth()===mesIdx && d.getFullYear()===anio;
  });

  // ── Stats reales por instructor ──
  const allS = instructores.map(inst=>{
    const rInst = regsDelMes.filter(r=>r.inst_id===inst.id);
    const imp   = rInst.filter(r=>r.estado==='ok'||r.estado==='sub');
    const falt  = rInst.filter(r=>r.estado==='falta').length;
    const sups  = rInst.filter(r=>r.estado==='sub').length;
    const totalAsis = imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
    const afoRecs = imp.filter(r=>parseInt(r.cap||0)>0);
    const afo = afoRecs.length>0
      ? Math.round(afoRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoRecs.length) : 0;
    const horas = imp.length; // 1 clase = ~1 hora (ajustable)
    return {...inst, impMes:imp.length, faltMes:falt, supsMes:sups, horasMes:horas, asisMes:totalAsis, aforoMes:afo};
  });

  const tImp   = allS.reduce((a,i)=>a+i.impMes,0);
  const tFalt  = allS.reduce((a,i)=>a+i.faltMes,0);
  const tAsis  = allS.reduce((a,i)=>a+i.asisMes,0);
  const tSups  = allS.reduce((a,i)=>a+i.supsMes,0);
  const tAforo = allS.filter(i=>i.impMes>0).length>0
    ? Math.round(allS.filter(i=>i.impMes>0).reduce((a,i)=>a+i.aforoMes,0)/allS.filter(i=>i.impMes>0).length) : 0;
  const totalProg = instructores.reduce((a,i)=>a+(i.horario||[]).length,0);
  // Semanas en el mes
  const diasEnMes = new Date(anio,mesIdx+1,0).getDate();
  const semsAprox = Math.round(diasEnMes/7);
  const progMes = totalProg * semsAprox;
  const cumplimiento = progMes>0?Math.round(tImp/progMes*100):0;

  // Resumen de clases del mes
  const clasesMes={};
  regsDelMes.filter(r=>r.estado==='ok'||r.estado==='sub').forEach(r=>{
    if(!r.clase)return;
    if(!clasesMes[r.clase])clasesMes[r.clase]={total:0,asis:0,cap:0,cnt:0};
    clasesMes[r.clase].total++;
    clasesMes[r.clase].asis+=(parseInt(r.asistentes)||0);
    if(parseInt(r.cap||0)>0){clasesMes[r.clase].cap+=parseInt(r.cap);clasesMes[r.clase].cnt++;}
  });
  const topClases = Object.entries(clasesMes)
    .map(([k,v])=>({clase:k,sesiones:v.total,asis:v.asis,afo:v.cnt>0?Math.round(v.asis/v.cap*v.cnt*100/(v.cnt)):0}))
    .sort((a,b)=>b.asis-a.asis).slice(0,8);

  const html=`<div style="${printStyles()}">
    ${pHdr(`REPORTE MENSUAL — ${mesNom.toUpperCase()} ${anio}`,
      `Club Campestre Aguascalientes · Coordinación Fitness · Total registros: ${regsDelMes.length}`)}

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.6rem;margin-bottom:1rem">
      ${[
        ['Clases impartidas', tImp, '#1a7a45'],
        [`Cumplimiento (${semsAprox} sem.)`, cumplimiento+'%', cumplimiento>=85?'#1a7a45':cumplimiento>=65?'#b87a00':'#c00'],
        ['Faltas', tFalt, tFalt===0?'#1a7a45':tFalt<=3?'#b87a00':'#c00'],
        ['Suplencias', tSups, tSups>0?'#b87a00':'#1a7a45'],
        ['Asistentes totales', tAsis.toLocaleString(), '#0d6a9e'],
      ].map(([l,v,c])=>`
        <div style="border:1px solid #ccc;border-radius:7px;padding:.7rem;text-align:center;border-top:3px solid ${c}">
          <div style="font-size:.6rem;text-transform:uppercase;color:#777;letter-spacing:1px">${l}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:${c}">${v}</div>
        </div>`).join('')}
    </div>

    <!-- Tabla instructores -->
    <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:#1a7a45;margin-bottom:.4rem;font-weight:600">
      Desempeño por Instructor — ${mesNom} ${anio}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:1rem">
      <thead><tr style="background:#f0f7f3">
        ${['#','Instructor','Tipo','Programadas*','Impartidas','Faltas','Suplencias','Asistentes','Aforo%','Estado'].map(h=>
          `<th style="padding:6px 8px;border:1px solid #ccc;color:#1a7a45;font-size:.64rem;text-transform:uppercase">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
      ${allS.map((i,n)=>{
        const cls_prog = (i.horario||[]).length * semsAprox;
        const est = i.faltMes===0?'✔ Cumple':i.faltMes<=2?'⚠ Revisar':'✖ Incidencia';
        const bg2 = i.faltMes===0?'#d4edda':i.faltMes<=2?'#fff3cd':'#f8d7da';
        const tc  = i.faltMes===0?'#155724':i.faltMes<=2?'#856404':'#842029';
        const afoCol = pctColPrint(i.aforoMes);
        return `<tr style="background:${n%2?'#f9fdf9':'#fff'};border-bottom:1px solid #e0ede5">
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#999;font-size:.75rem">${n+1}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;font-weight:600">${i.nombre}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;color:#555;font-size:.75rem">${i.tipo==='planta'?'Planta':'Honorarios'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:#777">${cls_prog}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;font-weight:700;color:${i.impMes>0?'#1a7a45':'#999'}">${i.impMes}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${i.faltMes>0?'#c00':'#1a7a45'};font-weight:${i.faltMes>0?'700':'400'}">${i.faltMes}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${i.supsMes>0?'#856404':'#777'}">${i.supsMes}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;font-weight:600">${i.asisMes.toLocaleString()}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${afoCol};font-weight:700">${i.impMes>0?i.aforoMes+'%':'—'}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center">
            <span style="background:${bg2};color:${tc};padding:2px 7px;border-radius:10px;font-size:.7rem;font-weight:600">${est}</span>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>

    <!-- Top clases del mes -->
    ${topClases.length>0?`
    <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:#1a7a45;margin-bottom:.4rem;font-weight:600">
      Clases Destacadas del Mes
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.77rem;margin-bottom:1rem">
      <thead><tr style="background:#f0f7f3">
        ${['Clase','Sesiones','Total Asis.','Aforo Prom.'].map(h=>
          `<th style="padding:5px 8px;border:1px solid #ccc;color:#1a7a45;font-size:.64rem;text-transform:uppercase">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
      ${topClases.map((c,n)=>`
        <tr style="background:${n%2?'#f9fdf9':'#fff'}">
          <td style="padding:5px 8px;border:1px solid #e0ede5;font-weight:600">${n+1}. ${c.clase}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center">${c.sesiones}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;font-weight:600">${c.asis}</td>
          <td style="padding:5px 8px;border:1px solid #e0ede5;text-align:center;color:${pctColPrint(c.afo)};font-weight:700">${c.afo}%</td>
        </tr>`).join('')}
      </tbody>
    </table>`:''}
    <div style="font-size:.68rem;color:#999;margin-bottom:.6rem">* Programadas = clases/semana × ${semsAprox} semanas aprox. del mes</div>
    ${pFirma()}
  </div>`;

  document.getElementById('print-ttl').textContent=`Reporte Mensual — ${mesNom} ${anio}`;
  document.getElementById('print-body').innerHTML=html;
  document.getElementById('m-print').classList.add('on');
}

// ── REPORTE POR INSTRUCTOR ────────────────────────────────────────────────────
function genReporteInstructor(){
  const instId  = document.getElementById('rpt-inst-sel').value;
  const periodo = document.getElementById('rpt-inst-periodo').value;
  const anioSel = parseInt(document.getElementById('rpt-inst-anio')?.value) || new Date().getFullYear();
  const meses   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function filtrarPeriodo(r){
    if(!r.fecha) return periodo==='todo';
    const d = new Date(r.fecha+'T12:00:00');
    const hoyD = new Date();
    const lun  = new Date(hoyD); lun.setDate(hoyD.getDate()-((hoyD.getDay()+6)%7));
    if(periodo==='semana')  return d>=lun && d<new Date(lun.getTime()+7*86400000);
    if(periodo==='mes')     return d.getMonth()===hoyD.getMonth() && d.getFullYear()===hoyD.getFullYear();
    // Numérico = índice de mes
    const mi = parseInt(periodo);
    if(!isNaN(mi) && mi>=0 && mi<=11) return d.getMonth()===mi && d.getFullYear()===anioSel;
    return true; // 'todo'
  }

  const periodoLabel = periodo==='todo'?'Historial completo'
    :periodo==='semana'?'Semana actual'
    :periodo==='mes'?'Mes actual'
    :`${meses[parseInt(periodo)]||''} ${anioSel}`;

  const listaInst = instId==='todos'
    ? [...instructores].sort((a,b)=>a.nombre.localeCompare(b.nombre))
    : instructores.filter(i=>i.id===parseInt(instId));

  let rows='';
  listaInst.forEach(inst=>{
    // Registros filtrados y ordenados por fecha descendente
    const recs = registros
      .filter(r=>r.inst_id===inst.id && (r.estado==='ok'||r.estado==='sub') && filtrarPeriodo(r))
      .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
    const faltasPeriodo = registros.filter(r=>r.inst_id===inst.id && r.estado==='falta' && filtrarPeriodo(r)).length;
    const supsPeriodo   = recs.filter(r=>r.estado==='sub').length;
    const totalAsis     = recs.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
    const afoRecs       = recs.filter(r=>parseInt(r.cap||0)>0);
    const aforoProm     = afoRecs.length>0
      ? Math.round(afoRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoRecs.length) : 0;
    const promClase     = recs.length>0 ? Math.round(totalAsis/recs.length) : 0;
    const afoCol        = pctColPrint(aforoProm);

    // Resumen por clase
    const porClase={};
    recs.forEach(r=>{
      if(!r.clase)return;
      if(!porClase[r.clase])porClase[r.clase]={sesiones:0,asis:0,cap:0,cnt:0};
      porClase[r.clase].sesiones++;
      porClase[r.clase].asis+=(parseInt(r.asistentes)||0);
      if(parseInt(r.cap||0)>0){porClase[r.clase].cap+=parseInt(r.cap);porClase[r.clase].cnt++;}
    });
    const resumenClases=Object.entries(porClase)
      .map(([k,v])=>({clase:k,sesiones:v.sesiones,asis:v.asis,
        afo:v.cnt>0?Math.round(v.asis/v.cap*v.cnt*100/v.cnt):0}))
      .sort((a,b)=>b.asis-a.asis);

    // Últimas 12 sesiones con detalle
    const detalle=recs.slice(0,12).map(r=>{
      const pct=parseInt(r.cap||0)>0?Math.round((parseInt(r.asistentes)||0)/parseInt(r.cap)*100):0;
      const bg=pct>=70?'#d4edda':pct>=40?'#fff3cd':'#f8d7da';
      const tc=pct>=70?'#155724':pct>=40?'#856404':'#842029';
      const supNom=r.estado==='sub'?nombreSuplente(r.suplente_id):'—';
      const fd=r.fecha?new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'}):'—';
      return`<tr style="background:${bg}">
        <td style="padding:3px 7px;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${fd}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-size:.73rem">${r.dia||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${r.hora||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-weight:600;font-size:.75rem">${r.clase||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;text-align:center;font-weight:700;color:${tc}">${parseInt(r.asistentes)||0}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;text-align:center;color:${tc};font-weight:600">${pct>0?pct+'%':'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;color:#1a5a8a;font-size:.7rem">${supNom}</td>
      </tr>`;
    }).join('');

    const estColor=faltasPeriodo===0?'#155724':faltasPeriodo<=2?'#856404':'#842029';
    const estBg   =faltasPeriodo===0?'#d4edda':faltasPeriodo<=2?'#fff3cd':'#f8d7da';
    const estLabel=faltasPeriodo===0?'✔ Sin faltas':faltasPeriodo+' falta(s)';

    rows+=`
    <div style="border:1px solid #ccc;border-radius:10px;padding:1rem;margin-bottom:1.2rem;page-break-inside:avoid">
      <!-- Header instructor -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:1px;color:#1a7a45">${inst.nombre}</div>
          <div style="font-size:.76rem;color:#555;margin-top:1px">
            ${inst.tipo==='planta'?'Instructor de Planta':'Honorarios'} · ${inst.esp||'—'}
            · Horario: ${(inst.horario||[]).length} clase(s)/semana
          </div>
        </div>
        <span style="background:${estBg};color:${estColor};padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700">${estLabel}</span>
      </div>

      <!-- KPIs instructor -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:.9rem">
        ${[
          ['Sesiones',recs.length,'#1a7a45'],
          ['Asistentes',totalAsis.toLocaleString(),'#0d6a9e'],
          ['Prom./Clase',promClase,'#b87a00'],
          ['Aforo prom.',aforoProm+'%',afoCol],
          ['Suplencias',supsPeriodo,supsPeriodo>0?'#856404':'#1a7a45'],
        ].map(([l,v,c])=>`
          <div style="border:1px solid #ddd;border-radius:6px;padding:.5rem;text-align:center;border-top:2px solid ${c}">
            <div style="font-size:.58rem;text-transform:uppercase;color:#777;letter-spacing:.8px">${l}</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:${c}">${v}</div>
          </div>`).join('')}
      </div>

      <!-- Resumen por clase -->
      ${resumenClases.length>1?`
      <div style="margin-bottom:.7rem">
        <div style="font-size:.63rem;text-transform:uppercase;letter-spacing:1px;color:#777;margin-bottom:.3rem">Resumen por clase</div>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem">
          ${resumenClases.map(c=>{
            const afoC=pctColPrint(c.afo);
            return `<span style="background:#f0f7f3;border:1px solid #ccc;border-radius:6px;padding:2px 8px;font-size:.72rem">
              <b>${c.clase}</b> · ${c.sesiones}ses · ${c.asis}asis · <span style="color:${afoC}">${c.afo}%</span>
            </span>`;
          }).join('')}
        </div>
      </div>`:''}

      <!-- Historial sesiones -->
      ${recs.length>0?`
      <div style="font-size:.63rem;text-transform:uppercase;letter-spacing:1px;color:#777;margin-bottom:.3rem">
        Últimas ${Math.min(recs.length,12)} sesiones (de ${recs.length} en el periodo)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.76rem">
        <thead><tr style="background:#f0f7f3">
          ${['Fecha','Día','Hora','Clase','Asist.','Aforo','Suplente'].map(h=>
            `<th style="padding:3px 7px;border:1px solid #ccc;color:#1a7a45;font-size:.62rem;text-transform:uppercase">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>${detalle}</tbody>
      </table>`
      :`<div style="color:#999;font-size:.8rem;text-align:center;padding:.5rem">Sin sesiones registradas en este periodo</div>`}
    </div>`;
  });

  const titulo = instId==='todos'?'REPORTE DE INSTRUCTORES':`REPORTE: ${listaInst[0]?.nombre.toUpperCase()||''}`;
  const html=`<div style="${printStyles()}">
    <div style="border-bottom:3px solid #1a7a45;padding-bottom:.8rem;margin-bottom:1.2rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem">
      <div>
        <h1 style="font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:2px;color:#1a7a45;margin:0">${titulo}</h1>
        <p style="color:#555;font-size:.78rem">Club Campestre Aguascalientes · Coordinación Fitness · <strong>${periodoLabel}</strong></p>
      </div>
      <div style="text-align:right;font-size:.76rem;color:#555">
        <div>${listaInst.length} instructor${listaInst.length!==1?'es':''}</div>
        <div>Generado: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
    </div>
    ${rows||'<div style="text-align:center;padding:2rem;color:#999">Sin instructores para mostrar</div>'}
    ${pFirma()}
  </div>`;

  document.getElementById('print-ttl').textContent=`Reporte Instructor — ${instId==='todos'?'Todos':listaInst[0]?.nombre||''}`;
  document.getElementById('print-body').innerHTML=html;
  document.getElementById('m-print').classList.add('on');
}

// ═══════════════════════════════════════════
// TEMA — OSCURO / CLARO
// ═══════════════════════════════════════════
let temaActual = localStorage.getItem('fc_tema') || 'oscuro';
function aplicarTema(t) {
  temaActual = t;
  const iconEl = document.getElementById('coord-tema-icon');
  if(t === 'claro') {
    document.documentElement.classList.add('tema-claro');
    if(iconEl) iconEl.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="10" y1="2" x2="10" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="15.5" x2="10" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="10" x2="4.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="15.5" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  } else {
    document.documentElement.classList.remove('tema-claro');
    if(iconEl) iconEl.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M14 4 Q10 4 8 7 Q6 10 8 13 Q10 16 14 16 Q11 14 11 10 Q11 6 14 4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  localStorage.setItem('fc_tema', t);
  setTimeout(()=>{if(typeof renderDashboard==='function')renderDashboard();},80);
}
function toggleCoordMenu(){
  const dd=document.getElementById('coord-menu-dropdown');
  if(!dd)return;
  const isOpen=dd.style.display!=='none';
  dd.style.display=isOpen?'none':'block';
  // Cerrar al hacer clic fuera
  if(!isOpen){
    setTimeout(()=>{
      function clickFuera(e){
        const wrap=document.getElementById('coord-menu-wrap');
        if(wrap&&!wrap.contains(e.target)){
          dd.style.display='none';
          document.removeEventListener('click',clickFuera);
        }
      }
      document.addEventListener('click',clickFuera);
    },0);
  }
}

function toggleTema() {
  aplicarTema(temaActual === 'oscuro' ? 'claro' : 'oscuro');
}
// Aplicar tema guardado al cargar
aplicarTema(temaActual);

// ═══════════════════════════════════════════
// IMPRIMIR DESDE MODAL
// ═══════════════════════════════════════════
function imprimirDesdeModal() {
  const titulo = document.getElementById('print-ttl').textContent;
  const cuerpo = document.getElementById('print-body').innerHTML;
  const esClaro = temaActual === 'claro';
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>${titulo}</title>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Outfit',sans-serif;color:#111;background:#fff;padding:20px;font-size:12px;}
      @page{size:A4;margin:1.5cm;}
      @media print{body{padding:0;}}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;}
      th{background:#f0f7f3;padding:6px 8px;border:1px solid #ccc;color:#1a7a45;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
      td{padding:5px 8px;border:1px solid #e0ede5;}
      tr:nth-child(even) td{background:#f9fdf9;}
      h1{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:#1a7a45;}
      .no-print{display:none!important;}
    </style>
  </head><body>${cuerpo}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════
// EXPORTAR PDF (jsPDF)
// ═══════════════════════════════════════════
function exportarPDF() {
  const titulo = document.getElementById('print-ttl').textContent;
  const body = document.getElementById('print-body');
  const tabla = body.querySelector('table');

  if(!window.jspdf){toast('Librería PDF no disponible — usa Imprimir → Guardar como PDF','warn');return;}
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});

  // Header del PDF
  doc.setFillColor(26,122,69);
  doc.rect(0,0,297,18,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  doc.text('FITNESS CONTROL — CLUB CAMPESTRE AGUASCALIENTES',10,11);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text(new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}),240,11);

  // Título del reporte
  doc.setTextColor(26,122,69);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text(titulo.toUpperCase(),10,28);

  // Línea decorativa
  doc.setDrawColor(200,169,74);
  doc.setLineWidth(0.5);
  doc.line(10,31,287,31);

  let startY = 36;

  if(tabla) {
    // Extraer headers
    const ths = [...tabla.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    // Extraer filas
    const rows = [...tabla.querySelectorAll('tbody tr')].map(tr=>
      [...tr.querySelectorAll('td')].map(td=>td.textContent.trim())
    ).filter(r=>r.length>0&&r.some(c=>c&&c!==''));

    doc.autoTable({
      head:[ths],
      body:rows,
      startY,
      theme:'grid',
      headStyles:{fillColor:[26,122,69],textColor:255,fontSize:8,fontStyle:'bold',cellPadding:3},
      bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[30,30,30]},
      alternateRowStyles:{fillColor:[242,250,245]},
      columnStyles:{0:{cellWidth:'auto'}},
      margin:{left:10,right:10},
      didDrawPage:(data)=>{
        // Footer en cada página
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Fitness Control v9 · ${titulo} · Pág ${data.pageNumber}`,10,doc.internal.pageSize.height-5);
        doc.text('Club Campestre Aguascalientes',220,doc.internal.pageSize.height-5);
      }
    });
  } else {
    // Sin tabla — texto plano del contenido
    const textoPlano = body.innerText.replace(/\s+/g,' ').substring(0,2000);
    doc.setTextColor(50,50,50);
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    const lineas = doc.splitTextToSize(textoPlano,267);
    doc.text(lineas,10,startY);
  }

  // Firma al final
  const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY+8 : startY+10;
  if(lastY < doc.internal.pageSize.height-25){
    doc.setDrawColor(200,169,74);
    doc.setLineWidth(0.3);
    doc.line(10,lastY,90,lastY);
    doc.line(110,lastY,190,lastY);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('Coordinador Fitness',10,lastY+4);
    doc.text('Vo.Bo. RRHH',110,lastY+4);
  }

  doc.save(`${titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,'_')}_FitnessControl.pdf`);
}

// ═══════════════════════════════════════════
// EXPORTAR EXCEL (mejorado con estilos)
// ═══════════════════════════════════════════
function exportarPrintExcel() {
  const titulo = document.getElementById('print-ttl').textContent;
  const body = document.getElementById('print-body');
  const tabla = body.querySelector('table');
  if(!tabla){toast('No hay tabla para exportar en este reporte — usa Imprimir para PDF','warn');return;}

  const wb = XLSX.utils.book_new();

  // Hoja principal con datos
  const ws = XLSX.utils.table_to_sheet(tabla);

  // Ancho automático de columnas
  const maxCols = 12;
  ws['!cols'] = Array(maxCols).fill(null).map(()=>({wch:18}));

  // Añadir fila de título encima
  XLSX.utils.sheet_add_aoa(ws,[
    ['FITNESS CONTROL — CLUB CAMPESTRE AGUASCALIENTES'],
    [titulo],
    [`Generado: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}`],
    []
  ],{origin:'A1'});

  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

  // Hoja de metadatos
  const meta = XLSX.utils.aoa_to_sheet([
    ['Campo','Valor'],
    ['Reporte',titulo],
    ['Club','Club Campestre Aguascalientes'],
    ['Sistema','Fitness Control v9'],
    ['Fecha generación',new Date().toLocaleDateString('es-MX')],
    ['Hora',new Date().toLocaleTimeString('es-MX')],
    ['Total instructores',instructores.length],
    ['Total registros',registros.length],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Metadatos');

  XLSX.writeFile(wb, `${titulo.replace(/\s+/g,'_')}_FitnessControl.xlsx`);
}

// ═══════════════════════════════════════════
// EXPORTAR CSV
// ═══════════════════════════════════════════
function exportarPrintCSV() {
  const titulo = document.getElementById('print-ttl').textContent;
  const tabla = document.querySelector('#print-body table');
  if(!tabla){toast('No hay tabla para exportar como CSV','warn');return;}
  const rows = [];
  tabla.querySelectorAll('tr').forEach(tr=>{
    const celdas = [...tr.querySelectorAll('th,td')].map(c=>
      `"${c.textContent.trim().replace(/"/g,'""')}"`
    );
    if(celdas.length>0)rows.push(celdas.join(','));
  });
  const csv = '\uFEFF' + rows.join('\r\n'); // BOM para Excel en español
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`${titulo.replace(/\s+/g,'_')}_FitnessControl.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════
// EXPORTAR EXCEL COMPLETO DEL SISTEMA (desde header)
// ═══════════════════════════════════════════
function exportarExcelCompleto() {
  const wb = XLSX.utils.book_new();
  const fecha = new Date().toLocaleDateString('es-MX');

  // ── Hoja 1: Dashboard resumen
  const allS = instructores.map(i=>({...i,...statsInst(i)}));
  const dashData = [
    ['FITNESS CONTROL — CLUB CAMPESTRE AGUASCALIENTES'],
    [`Reporte generado: ${fecha}`],[],
    ['RESUMEN GENERAL'],
    ['Métrica','Valor'],
    ['Total instructores',instructores.length],
    ['Clases programadas/semana',instructores.reduce((a,i)=>a+(i.horario||[]).length,0)],
    ['Total registros',registros.length],
    ['Total asistentes',registros.reduce((a,r)=>a+(r.asistentes||0),0)],
    ['Aforo promedio (%)',Math.round(registros.filter(r=>r.cap>0).reduce((a,r)=>a+r.asistentes/r.cap*100,0)/Math.max(registros.filter(r=>r.cap>0).length,1))+'%'],
    ['Suplencias totales',registros.filter(r=>r.estado==='sub').length],
    ['Faltas totales',registros.filter(r=>r.estado==='falta').length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dashData), 'Dashboard');

  // ── Hoja 2: Instructores
  const instRows = [['Instructor','Tipo','Turno','Especialidades','Clases/sem','Impartidas','Faltas','Total Asistentes','Aforo %','Estado']];
  allS.forEach(i=>{
    const est = i.faltas===0?'<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Cumple':i.faltas<=1?'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> Revisar':'<svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Incidencia';
    instRows.push([i.nombre,i.tipo,i.turno||'',i.esp||'',(i.horario||[]).length,i.impartidas,i.faltas,i.totalAsis,i.aforo+'%',est]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instRows), 'Instructores');

  // ── Hoja 3: Historial de clases
  const histRows = [['Fecha','Día','Clase','Instructor','Hora','Asistentes','Capacidad','Aforo %','Estado','Suplente','Fuente']];
  [...registros].sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0).forEach(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const sup=r.suplente_id?instructores.find(i=>i.id===r.suplente_id):null;
    const afoP=r.cap>0?Math.round((r.asistentes||0)/r.cap*100):0;
    const est=r.estado==='ok'?'Impartida':r.estado==='sub'?'Con Suplente':'Falta';
    histRows.push([r.fecha||'',r.dia||'',r.clase||'',inst?inst.nombre:'?',r.hora||'',r.asistentes||0,r.cap||0,afoP+'%',est,sup?sup.nombre:'—',r.tipo==='recorrido'?'Recorrido':'Manual']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(histRows), 'Historial Clases');

  // ── Hoja 4: Suplencias
  const supRows = [['Fecha','Clase','Horario','Día','Instructor Original','Suplente','Asistentes','Aforo %']];
  registros.filter(r=>r.estado==='sub').sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0).forEach(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const sup=instructores.find(i=>i.id===r.suplente_id);
    const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
    supRows.push([r.fecha||'',r.clase||'',r.hora||'',r.dia||'',inst?inst.nombre:'?',sup?sup.nombre:'?',r.asistentes||0,afoP+'%']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supRows), 'Suplencias');

  // ── Hoja 5: Análisis de horarios (mapa calor datos)
  const hmRows = [['Día','Hora','Sesiones','Asistentes Prom.','Aforo % Prom.']];
  DIAS.forEach(d=>HORAS_CAL.forEach(h=>{
    const regs=registros.filter(r=>(r.estado==='ok'||r.estado==='sub')&&r.dia===d&&Math.abs(horaToMin(r.hora)-horaToMin(h))<=30&&r.cap>0);
    if(regs.length>0){
      const pAsis=Math.round(regs.reduce((a,r)=>a+r.asistentes,0)/regs.length);
      const pAfo=Math.round(regs.reduce((a,r)=>a+r.asistentes/r.cap*100,0)/regs.length);
      hmRows.push([d,h,regs.length,pAsis,pAfo+'%']);
    }
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hmRows), 'Analisis Horarios');

  XLSX.writeFile(wb, `FitnessControl_Completo_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ═══════════════════════════════════════════
// EXPORTAR PDF COMPLETO DEL SISTEMA
// ═══════════════════════════════════════════
function exportarPDFCompleto() {
  if(!window.jspdf){toast('Librería PDF no disponible','warn');return;}
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const allS = instructores.map(i=>({...i,...statsInst(i)}));
  const fecha = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});

  function addHeader(doc, subtitulo) {
    doc.setFillColor(26,122,69);
    doc.rect(0,0,297,16,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('FITNESS CONTROL — CLUB CAMPESTRE AGUASCALIENTES',10,10);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    doc.text(subtitulo,10,15);
    doc.text(fecha,240,10);
    doc.setDrawColor(200,169,74);
    doc.setLineWidth(0.8);
    doc.line(0,16,297,16);
  }

  // Página 1: Dashboard / KPIs
  addHeader(doc,'RESUMEN EJECUTIVO');
  doc.setTextColor(26,122,69);
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text('REPORTE EJECUTIVO MENSUAL',10,26);

  const totProg=instructores.reduce((a,i)=>a+(i.horario||[]).length,0);
  const totImp=allS.reduce((a,i)=>a+i.impartidas,0);
  const totFalt=allS.reduce((a,i)=>a+i.faltas,0);
  const totAsis=allS.reduce((a,i)=>a+i.totalAsis,0);
  const aforoProm=allS.length>0?Math.round(allS.reduce((a,i)=>a+i.aforo,0)/allS.length):0;
  const pct=totProg>0?Math.round(totImp/totProg*100):0;

  const kpis=[
    ['Clases/Semana',totProg,'Programadas'],
    ['Impartidas',totImp,pct+'% cumplimiento'],
    ['Faltas',totFalt,'Registradas'],
    ['Asistentes',totAsis.toLocaleString(),'Total acumulado'],
    ['Aforo Prom.',aforoProm+'%','Ocupación'],
    ['Instructores',instructores.length,'Activos'],
  ];
  kpis.forEach((k,i)=>{
    const x=10+(i%3)*95;
    const y=33+(Math.floor(i/3)*22);
    doc.setFillColor(i%2===0?242:236,250,242);
    doc.roundedRect(x,y,88,18,2,2,'F');
    doc.setDrawColor(26,122,69);
    doc.setLineWidth(0.3);
    doc.roundedRect(x,y,88,18,2,2,'S');
    doc.setFillColor(26,122,69);
    doc.rect(x,y,2,18,'F');
    doc.setTextColor(120,120,120);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text(k[0].toUpperCase(),x+5,y+5);
    doc.setTextColor(26,122,69);
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text(String(k[1]),x+5,y+13);
    doc.setTextColor(100,100,100);
    doc.setFontSize(7);
    doc.setFont('helvetica','normal');
    doc.text(k[2],x+5,y+17);
  });

  // Tabla de instructores en pág 1
  const instRows=allS.map(i=>[i.nombre,i.tipo==='planta'?'Planta':'Honor.',(i.horario||[]).length,i.impartidas,i.faltas,i.totalAsis.toLocaleString(),i.aforo+'%',i.faltas===0?'<svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> OK':i.faltas<=1?'<svg class="ico ico-warn" viewBox="0 0 20 20"><path d="M10 3 L18 17 H2 Z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="10" y1="9" x2="10" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15.5" r="0.8" fill="currentColor"/></svg> Revisar':'<svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Incid.']);
  doc.autoTable({
    head:[['Instructor','Tipo','Cls/Sem','Impartidas','Faltas','Asistentes','Aforo','Estado']],
    body:instRows,
    startY:80,
    theme:'grid',
    headStyles:{fillColor:[26,122,69],textColor:255,fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:8,cellPadding:2},
    alternateRowStyles:{fillColor:[242,250,245]},
    margin:{left:10,right:10},
    didDrawPage:d=>{
      doc.setFontSize(7);doc.setTextColor(150);
      doc.text(`Fitness Control v9 · Pág ${d.pageNumber}`,10,doc.internal.pageSize.height-4);
    }
  });

  // Página 2: Historial
  doc.addPage();
  addHeader(doc,'HISTORIAL DE CLASES — ÚLTIMOS 30 DÍAS');
  const hoy30=new Date();hoy30.setDate(hoy30.getDate()-30);
  const histRecs=registros.filter(r=>r.fecha&&new Date(r.fecha)>=hoy30).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,80);
  const histRows=histRecs.map(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const afoP=r.cap>0?Math.round((r.asistentes||0)/r.cap*100):0;
    return[r.fecha||'',r.dia||'',r.clase||'',inst?inst.nombre.split(' ')[0]:'?',r.hora||'',r.asistentes||0,afoP+'%',r.estado==='ok'?'OK':r.estado==='sub'?'Suplente':'Falta'];
  });
  doc.autoTable({
    head:[['Fecha','Día','Clase','Instructor','Hora','Asistentes','Aforo','Estado']],
    body:histRows,
    startY:22,
    theme:'grid',
    headStyles:{fillColor:[26,122,69],textColor:255,fontSize:7.5,fontStyle:'bold'},
    bodyStyles:{fontSize:7,cellPadding:1.8},
    alternateRowStyles:{fillColor:[242,250,245]},
    margin:{left:10,right:10},
    didDrawPage:d=>{
      doc.setFontSize(7);doc.setTextColor(150);
      doc.text(`Fitness Control v9 · Pág ${d.pageNumber}`,10,doc.internal.pageSize.height-4);
    }
  });

  doc.save(`FitnessControl_Completo_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ═══════════════════════════════════════════
// EXPORTAR EXCEL COMPLETO (función legacy renombrada)
// ═══════════════════════════════════════════

// ═══ HISTORIAL DE CLASES ═══
