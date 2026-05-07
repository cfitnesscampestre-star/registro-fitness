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
      document.getElementById('rpt-dia-fecha').value = fechaLocalStr(new Date());
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
  const lunStr  = fechaLocalStr(lunes);
  const domDate = new Date(lunes); domDate.setDate(lunes.getDate()+6);
  const domStr  = fechaLocalStr(domDate);

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
      const motivoNom=r.estado==='sub'&&r.motivo_suplencia?({'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'}[r.motivo_suplencia]||r.motivo_suplencia):'—';
      const fd=r.fecha?new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'}):'—';
      return`<tr style="background:${bg}">
        <td style="padding:3px 7px;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${fd}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-size:.73rem">${r.dia||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${r.hora||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;font-weight:600;font-size:.75rem">${r.clase||'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;text-align:center;font-weight:700;color:${tc}">${parseInt(r.asistentes)||0}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;text-align:center;color:${tc};font-weight:600">${pct>0?pct+'%':'—'}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;color:#1a5a8a;font-size:.7rem">${supNom}</td>
        <td style="padding:3px 7px;border:1px solid #ddd;color:#555;font-size:.7rem">${motivoNom}</td>
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
          ${['Fecha','Día','Hora','Clase','Asist.','Aforo','Suplente','Motivo'].map(h=>
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

// En móvil siempre tema claro — sin opción de cambio
function _esMobil() { return window.innerWidth <= 640; }

function aplicarTema(t) {
  // Forzar tema claro en móvil independientemente de la preferencia
  const temaEfectivo = _esMobil() ? 'claro' : t;
  temaActual = t; // Guardar preferencia real (para tablet/desktop)
  const iconEl = document.getElementById('coord-tema-icon');
  const btnTema = document.getElementById('coord-tema-btn');
  if(temaEfectivo === 'claro') {
    document.documentElement.classList.add('tema-claro');
    if(iconEl) iconEl.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="10" y1="2" x2="10" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="15.5" x2="10" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="10" x2="4.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="15.5" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  } else {
    document.documentElement.classList.remove('tema-claro');
    if(iconEl) iconEl.innerHTML = '<svg class="ico" viewBox="0 0 20 20"><path d="M14 4 Q10 4 8 7 Q6 10 8 13 Q10 16 14 16 Q11 14 11 10 Q11 6 14 4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  // Ocultar botón "Cambiar apariencia" en móvil
  if(btnTema) btnTema.style.display = _esMobil() ? 'none' : '';
  if(!_esMobil()) localStorage.setItem('fc_tema', t);
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
  if(_esMobil()) return; // No permitir cambio en móvil
  aplicarTema(temaActual === 'oscuro' ? 'claro' : 'oscuro');
}
// Aplicar tema guardado al cargar
aplicarTema(temaActual);

// Re-aplicar tema al cambiar tamaño de ventana (rotación, resize)
window.addEventListener('resize', () => {
  aplicarTema(temaActual);
});

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
  </head><body>${cuerpo}<script>window.onload=()=>{window.print();}<\/script>
<!-- ═══ BOTTOM NAV (móvil/tablet) ═══ -->
<nav id="bottom-nav">
  <div class="bnav-item on" data-s="hoy" onclick="switchSection('hoy')">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><polyline points="10,6 10,10 13,12" stroke-width="1.7"/></svg>
    <span>Hoy</span>
    <span class="bnav-dot" id="bnav-hoy-dot"></span>
  </div>
  <div class="bnav-item" data-s="programa" onclick="switchSection('programa')">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" y1="9" x2="17" y2="9"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="13" y1="2" x2="13" y2="6"/></svg>
    <span>Programa</span>
  </div>
  <div class="bnav-item" data-s="equipo" onclick="switchSection('equipo')">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="6" r="3"/><path d="M2 17 Q2 12 8 12 Q14 12 14 17"/><circle cx="14" cy="6" r="2.5"/><path d="M14 11 Q18 11 18 16"/></svg>
    <span>Equipo</span>
  </div>
  <div class="bnav-item" data-s="analisis" onclick="switchSection('analisis')">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="12" width="3" height="5" rx="1"/><rect x="8.5" y="8" width="3" height="9" rx="1"/><rect x="14" y="4" width="3" height="13" rx="1"/></svg>
    <span>Análisis</span>
  </div>
  <div class="bnav-item" data-s="mas" onclick="switchSection('mas')">
    <svg viewBox="0 0 20 20" fill="currentColor"><circle cx="5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/></svg>
    <span>Más</span>
  </div>
</nav>

</body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════
// EXPORTAR PDF (jsPDF)
// ═══════════════════════════════════════════
function exportarPDF() {
  const titulo = document.getElementById('print-ttl').textContent;
  const body = document.getElementById('print-body');
  const tabla = body.querySelector('table');

  if(!window.jspdf){showToast('Librería PDF no disponible. Usa Imprimir → Guardar como PDF.','warn');return;}
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
    doc.text('Vo.Bo. GERENCIA DEPORTES',110,lastY+4);
  }

  doc.save(`${titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,'_')}_FitnessControl.pdf`);
}


// ═══════════════════════════════════════════════════════════════════════
// HOJA OFICIAL DE FIRMAS — Club Campestre Aguascalientes
// Formato profesional para impresión · suplencias y faltas en rojo
// ═══════════════════════════════════════════════════════════════════════

function firmasActualizarLabel(){
  const elI = document.getElementById('firmas-fecha-ini');
  const elF = document.getElementById('firmas-fecha-fin');
  const elT = document.getElementById('firmas-semana-txt');
  if(!elI||!elF||!elT) return;
  if(elI.value && elF.value){
    const fmt = s => new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long'});
    elT.value = `${fmt(elI.value)} al ${fmt(elF.value)} ${elI.value.slice(0,4)}`;
  }
}

// ── Función compartida — genera la hoja de firmas con o sin imágenes de firma ──
// firmasDigitales: objeto { profId: dataURL } o null para PDF sin firmas

function _generarHojaFirmasCore(fechaIni, fechaFin, semana, firmasDigitales){
  if(!window.jspdf){ showToast('Librería PDF no disponible.','warn'); return false; }
  const {jsPDF} = window.jspdf;

  // ── Filtrar y agrupar registros ──────────────────────────────────────
  const regs = registros.filter(r => r.fecha >= fechaIni && r.fecha <= fechaFin);
  if(!regs.length){
    showToast(`Sin registros entre ${fechaIni} y ${fechaFin}.`,'warn'); return false;
  }

  const DIAS_ORD  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const DIAS_ABR  = {'Lunes':'LUN','Martes':'MAR','Miércoles':'MIÉ',
                     'Jueves':'JUE','Viernes':'VIE','Sábado':'SÁB','Domingo':'DOM'};

  const porInst = {};
  regs.forEach(r => {
    const inst = instructores.find(i => String(i.id)===String(r.inst_id));
    if(!inst) return;
    if(!porInst[inst.id]) porInst[inst.id] = {inst, clases:[]};
    const h = r.hora||'';
    let horaFmt = h, horaMin = 0;
    if(h && !h.includes('a.')&&!h.includes('p.')){
      const [hh,mm] = h.split(':').map(Number);
      if(!isNaN(hh)){
        const s = hh>=12?'p.m.':'a.m.';
        const h12 = hh===0?12:hh>12?hh-12:hh;
        horaFmt = `${h12}:${String(mm||0).padStart(2,'0')} ${s}`;
        horaMin = hh*60+(mm||0);
      }
    } else if(h){
      const pm = h.toLowerCase().includes('p. m.')||h.toLowerCase().includes('pm');
      const numMatch = h.match(/(\d+):(\d+)/);
      if(numMatch){
        let hh=parseInt(numMatch[1]), mm=parseInt(numMatch[2]);
        if(pm && hh!==12) hh+=12;
        if(!pm && hh===12) hh=0;
        horaMin = hh*60+mm;
        // Normalizar a formato compacto
        const s = pm ? 'p.m.' : 'a.m.';
        const h12 = pm && parseInt(numMatch[1])!==12 ? parseInt(numMatch[1]) : (!pm && parseInt(numMatch[1])===12 ? 12 : parseInt(numMatch[1]));
        horaFmt = `${h12}:${String(mm).padStart(2,'0')} ${s}`;
      }
    }
    porInst[inst.id].clases.push({
      dia: r.dia||'', hora: horaFmt, horaMin,
      clase: (r.clase||'').toUpperCase(),
      alumnos: (r.asistentes!==undefined&&r.asistentes!==null&&r.asistentes!=='') ? parseInt(r.asistentes) : null,
      estado: r.estado||'ok',
      suplente_id: r.suplente_id||null,
    });
  });

  const profesores = Object.values(porInst)
    .sort((a,b)=>a.inst.nombre.localeCompare(b.inst.nombre))
    .map(p=>{
      const mapa = {};
      p.clases.forEach(c=>{
        const k = `${c.dia}|${c.hora}|${c.clase}`;
        const pri = {falta:2,sub:1,ok:0}[c.estado]||0;
        if(!mapa[k]||pri>(({falta:2,sub:1,ok:0}[mapa[k].estado]||0))) mapa[k]=c;
      });
      const clases = Object.values(mapa);
      clases.sort((a,b)=>{
        const da=DIAS_ORD.indexOf(a.dia), db=DIAS_ORD.indexOf(b.dia);
        return da!==db ? da-db : (a.horaMin||0)-(b.horaMin||0);
      });
      return {nombre:(p.inst.nombre||'').toUpperCase(), inst:p.inst, clases};
    })
    .filter(p=>p.clases.length>0);

  if(!profesores.length){
    showToast('No hay registros de profesores en ese período.','warn'); return false;
  }

  // ── Configuración de página: carta horizontal ────────────────────────
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'letter'});
  const PW=279.4, PH=215.9;
  const ML=14, MR=14, MB=10;   // Fix: margen lateral aumentado de 10 a 14mm
  const CW = PW-ML-MR;

  // ── Paleta institucional ─────────────────────────────────────────────
  const CV     = [15, 80, 40];     // verde oscuro institucional
  const CV2    = [26,122,69];      // verde medio (acentos)
  const CVH    = [235, 245, 238];  // verde muy claro — fondo header opción B
  const CV3    = [220,242,228];    // verde muy claro (fondo encabezado instructor)
  const CGRIS  = [240,240,240];    // gris claro alternado
  const CGRIS2 = [210,218,212];    // gris medio (líneas)
  const CROJO  = [160, 20, 20];    // rojo oscuro imprimible
  const CRJBG  = [254,243,243];    // rojo fondo muy suave
  const CNEG   = [30, 30, 30];
  const CBCO   = [255,255,255];
  const CORO   = [140, 100, 0];    // dorado para badge firma digital
  const COROBG = [255,248,225];    // fondo badge firma digital

  // ── Altura de encabezado de página ──────────────────────────────────
  const HDR_H = 24;  // mm — encabezado más alto y elegante
  const MT    = HDR_H + 3;

  let pNum = 0;

  function nuevaPagina(){
    if(pNum>0) doc.addPage();
    pNum++;

    // ▌ Header opción B: fondo verde muy claro + borde verde oscuro
    doc.setFillColor(...CVH);
    doc.rect(0, 0, PW, HDR_H, 'F');

    // Línea verde oscuro superior (1.5mm)
    doc.setFillColor(...CV);
    doc.rect(0, 0, PW, 1.5, 'F');

    // Línea verde oscuro inferior (1mm)
    doc.setFillColor(...CV);
    doc.rect(0, HDR_H - 1, PW, 1, 'F');

    // Logo Campestre Fitness — contenedor verde que integra el ícono
    try {
      doc.addImage('data:image/png;base64,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', 'PNG', ML+1, 3, 15, 15);
    } catch(e) {
      // Fallback: recuadro FC si la imagen falla
      doc.setFillColor(20,50,30);
      doc.setDrawColor(94,255,160);
      doc.setLineWidth(0.5);
      doc.roundedRect(ML, 3.5, 17, 17, 2, 2, 'FD');
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.setTextColor(94,255,160);
      doc.text('FC', ML+8.5, 14, {align:'center'});
    }

    // Institución
    doc.setFont('helvetica','bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...CV);
    doc.text('CLUB CAMPESTRE AGUASCALIENTES', ML+21, 10);
    doc.setFont('helvetica','normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...CV2);
    doc.text('COORDINACIÓN FITNESS  ·  CONTROL INTERNO  ·  NO CIRCULAR', ML+21, 15.5);

    // Semana — alineada a la derecha
    doc.setFont('helvetica','bold');
    doc.setFontSize(7);
    doc.setTextColor(...CV);
    doc.text('SEMANA:', PW-MR, 9, {align:'right'});
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...CV2);
    doc.text(semana, PW-MR, 16, {align:'right'});

    // Leyenda: rectángulo rojo dibujado + texto (sin símbolo ■)
    const leyX = PW/2;
    doc.setFillColor(...CROJO);
    doc.rect(leyX - 28, 9.5, 3.5, 3.5, 'F');
    doc.setFont('helvetica','normal');
    doc.setFontSize(6);
    doc.setTextColor(...CV);
    doc.text('Rojo = Suplencia o Falta', leyX - 23, 12.5);

    // Número de página — pie
    doc.setFont('helvetica','normal');
    doc.setFontSize(5.5);
    doc.setTextColor(160,160,160);
    doc.text('Fitness Control — Club Campestre Aguascalientes', ML, PH-4);
    doc.text(`Pág. ${pNum}`, PW-MR, PH-4, {align:'right'});
  }

  nuevaPagina();
  let Y = MT;

  // ── Helper drawText ──────────────────────────────────────────────────
  const drawText = (txt,x,y,opts={}) => {
    if(opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(...CNEG);
    if(opts.bold)  doc.setFont('helvetica','bold');  else doc.setFont('helvetica','normal');
    if(opts.size)  doc.setFontSize(opts.size);
    doc.text(String(txt), x, y, opts.align?{align:opts.align}:{});
  };

  // ── Constantes de fila ───────────────────────────────────────────────
  const hCab  = 6.5;   // banner PROFESORA / días
  const hSubh = 5.0;   // sub-header HR | CLASE | ALUM.
  const hRow  = 6.0;   // fila de datos (ligeramente más alta)

  // ── Dibujar cada profesor ────────────────────────────────────────────
  profesores.forEach((prof, profIdx) => {
    const diasProf = DIAS_ORD.filter(d => prof.clases.some(c=>c.dia===d));
    if(!diasProf.length) return;

    const porDia = {};
    diasProf.forEach(d => { porDia[d]=prof.clases.filter(c=>c.dia===d); });
    const maxFilas = Math.max(...diasProf.map(d=>porDia[d].length));
    const nDias    = diasProf.length;

    // Columna FIRMA: más ancha cuando hay pocos días, más estrecha con muchos
    const colFir = nDias <= 3 ? 34 : nDias <= 5 ? 30 : 26;
    const colNom = nDias <= 3 ? 44 : nDias <= 5 ? 40 : 36;
    const colDat = CW - colNom - colFir;
    const colDW  = colDat / nDias;
    const cHr  = colDW * 0.31;
    const cCl  = colDW * 0.44;
    const cAl  = colDW * 0.25;

    const hBloque = hCab + hSubh + maxFilas * hRow;

    // Salto de página si no cabe
    if(Y + hBloque > PH - MB - 5){ nuevaPagina(); Y = MT; }

    const Y0 = Y;
    const xFirCol = ML + colNom + colDat;

    // ── FRANJA nombre del instructor (fondo verde claro degradado) ──
    // Fondo verde muy claro para toda la fila de cabecera
    doc.setFillColor(...CV);
    doc.rect(ML, Y, CW, hCab, 'F');

    // Género
    const genNom = prof.inst.nombre||'';
    const esF = /\b(ana|cristina|blanca|marisa|karina|consuelo|sara|jimena|valeria|hermelinda|socorro|ernestina|araceli|gabriela|esthela|alejandra|diana|laura|patricia|rosa|maria|ma\.)\b/i.test(genNom);

    // Etiqueta PROF/A — pequeña, izquierda
    drawText(esF?'PROFESORA':'PROFESOR', ML+2.5, Y+4.4, {bold:true, size:6.5, color:[160,220,185]});

    // Días en la cabecera
    let xD = ML+colNom;
    diasProf.forEach(d=>{
      drawText(DIAS_ABR[d]||d.slice(0,3).toUpperCase(), xD+colDW/2, Y+4.4, {bold:true, size:7, color:CBCO, align:'center'});
      xD+=colDW;
    });
    drawText('FIRMA', xFirCol+colFir/2, Y+4.4, {bold:true, size:7, color:CBCO, align:'center'});
    Y += hCab;

    // ── SUB-HEADER: nombre + columnas HR/CLASE/ALUM ──────────────────
    doc.setFillColor(...CV3);
    doc.rect(ML, Y, colNom+colDat, hSubh, 'F');
    // Celda firma: blanco
    doc.setFillColor(...CBCO);
    doc.rect(xFirCol, Y, colFir, hSubh, 'F');

    const maxCar = Math.floor(colNom / 1.7);
    const nomCorto = genNom.length>maxCar ? genNom.slice(0,maxCar-1)+'…' : genNom;
    drawText(nomCorto.toUpperCase(), ML+2.5, Y+3.6, {bold:true, size:7.5, color:CV});

    xD = ML+colNom;
    diasProf.forEach(()=>{
      drawText('HR',      xD+cHr/2,           Y+3.5, {size:5.2, color:[80,100,88], align:'center'});
      drawText('CLASE',   xD+cHr+cCl/2,       Y+3.5, {size:5.2, color:[80,100,88], align:'center'});
      drawText('ALUM.',   xD+cHr+cCl+cAl/2,   Y+3.5, {size:4.8, color:[80,100,88], align:'center'});
      xD += colDW;
    });
    Y += hSubh;

    // ── FILAS DE DATOS ───────────────────────────────────────────────
    for(let i=0; i<maxFilas; i++){
      const bgFila = i%2===0 ? CBCO : CGRIS;
      doc.setFillColor(...bgFila);
      doc.rect(ML, Y, colNom+colDat, hRow, 'F');
      // Columna firma siempre blanca
      doc.setFillColor(...CBCO);
      doc.rect(xFirCol, Y, colFir, hRow, 'F');

      xD = ML+colNom;
      diasProf.forEach(d=>{
        const cds = porDia[d]||[];
        if(i < cds.length){
          const c = cds[i];
          const esMal = c.estado==='sub'||c.estado==='falta';
          const txtCol = esMal ? CROJO : CNEG;

          if(esMal){
            doc.setFillColor(...CRJBG);
            doc.rect(xD, Y, colDW, hRow, 'F');
          }

          // Hora — compacta
          drawText(c.hora, xD+1.0, Y+4.0, {size:5.8, color:txtCol});

          // Clase
          const maxClase = Math.floor(cCl / 1.55);
          const claseStr = c.clase.length > maxClase ? c.clase.slice(0,maxClase-1)+'.' : c.clase;
          drawText(claseStr, xD+cHr+0.8, Y+4.0, {size:5.8, color:txtCol, bold:esMal});

          // Alumnos / estado
          const aluX = xD + cHr + cCl + cAl/2;
          if(esMal){
            const etiq = c.estado==='sub' ? 'SUP' : 'FALTA';
            if(c.alumnos!==null && c.alumnos!==undefined){
              // Número arriba, etiqueta debajo — separados claramente
              drawText(String(c.alumnos), aluX, Y+2.6, {size:6.0, bold:true, color:CROJO, align:'center'});
              drawText(etiq,              aluX, Y+5.2, {size:4.5, bold:true, color:CROJO, align:'center'});
            } else {
              drawText(etiq, aluX, Y+4.0, {size:5.0, bold:true, color:CROJO, align:'center'});
            }
          } else {
            const aluStr = (c.alumnos!==null && c.alumnos!==undefined) ? String(c.alumnos) : '';
            drawText(aluStr, aluX, Y+4.0, {size:6.5, bold:true, color:CNEG, align:'center'});
          }
        }
        xD += colDW;
      });
      Y += hRow;
    }

    // ── FIRMA insertada o línea punteada ─────────────────────────────
    const yFirmaTop  = Y0 + hCab;
    const hFirmaCell = hBloque - hCab;
    const wFirmaDisp = colFir - 5;
    const xFirmaIni  = xFirCol + 2.5;

    if(firmasDigitales && firmasDigitales[prof.inst.id]) {
      try {
        const RATIO = 3.0;
        let imgH = hFirmaCell - 5;
        let imgW = imgH * RATIO;
        if(imgW > wFirmaDisp){ imgW = wFirmaDisp; imgH = imgW / RATIO; }
        const imgX = xFirCol + (colFir - imgW) / 2;
        const imgY = yFirmaTop + (hFirmaCell - imgH) / 2;
        doc.addImage(firmasDigitales[prof.inst.id], 'PNG', imgX, imgY, imgW, imgH);
        // Badge "✓ digital" en la parte inferior de la celda
        doc.setFillColor(...COROBG);
        doc.roundedRect(xFirCol+1.5, Y-5.5, colFir-3, 4.5, 1, 1, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(4.2); doc.setTextColor(...CORO);
        doc.text('firma digital', xFirCol+colFir/2, Y-2.8, {align:'center'});
      } catch(e) {
        // Fallback línea
        doc.setDrawColor(...CV2); doc.setLineWidth(0.5);
        doc.line(xFirmaIni, Y-4, xFirmaIni+wFirmaDisp, Y-4);
      }
    } else {
      // Sin firma: línea punteada centrada + texto "Firma"
      const yLinea = yFirmaTop + hFirmaCell * 0.65;
      doc.setDrawColor(...CGRIS2); doc.setLineWidth(0.4);
      doc.setLineDashPattern([1.2, 0.8], 0);
      doc.line(xFirmaIni+2, yLinea, xFirmaIni+wFirmaDisp-2, yLinea);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica','italic'); doc.setFontSize(4.5); doc.setTextColor(180,180,180);
      doc.text('Firma', xFirCol+colFir/2, yLinea+3.5, {align:'center'});
    }

    // ── BORDES del bloque ────────────────────────────────────────────
    // Sombra / separación inferior entre bloques (espacio en blanco)
    // Marco exterior verde institucional
    doc.setDrawColor(...CV);
    doc.setLineWidth(0.7);
    doc.rect(ML, Y0, CW, hBloque);

    // Línea divisoria columna FIRMA (verde más claro)
    doc.setLineWidth(0.9); doc.setDrawColor(...CV2);
    doc.line(xFirCol, Y0, xFirCol, Y0+hBloque);

    // Grid interno — solo en zona de datos
    doc.setLineWidth(0.15); doc.setDrawColor(...CGRIS2);
    let xG = ML+colNom;
    diasProf.forEach((d,idx)=>{
      if(idx>0) doc.line(xG, Y0+hCab, xG, Y0+hBloque);
      doc.line(xG+cHr,     Y0+hCab, xG+cHr,     Y0+hBloque);
      doc.line(xG+cHr+cCl, Y0+hCab, xG+cHr+cCl, Y0+hBloque);
      xG += colDW;
    });
    // Líneas horizontales entre filas (no cruzan columna firma)
    for(let i=1; i<maxFilas; i++){
      const yL = Y0+hCab+hSubh+i*hRow;
      doc.setLineWidth(0.12); doc.setDrawColor(...CGRIS2);
      doc.line(ML, yL, xFirCol, yL);
    }
    // Separador cabecera verde / sub-header
    doc.setLineWidth(0.25); doc.setDrawColor(...CV);
    doc.line(ML, Y0+hCab, ML+CW, Y0+hCab);

    // Espacio entre bloques
    Y += 4.5;
  });

  // ── BLOQUE COORDINADOR al pie ────────────────────────────────────────
  // Se dibuja siempre (con o sin firma digital), justo antes de los totales.
  // Ancho: mitad izquierda (firma coordinador) + mitad derecha (Vo.Bo. RRHH)
  {
    const COORD_H  = 18;   // altura total del bloque
    const COORD_W  = CW;
    const halfW    = COORD_W / 2;
    const CORO_LOC = [140, 100, 0];    // dorado
    const COROBG_L = [255, 248, 225];  // fondo badge dorado

    // Salto de página si no cabe
    if(Y + COORD_H + 16 > PH - MB) { nuevaPagina(); Y = MT; }

    const Y0c = Y + 2;

    // Fondo izquierdo (coord) — verde muy claro dorado
    doc.setFillColor(250, 248, 235);
    doc.rect(ML, Y0c, halfW, COORD_H, 'F');
    // Fondo derecho (RRHH) — gris muy claro
    doc.setFillColor(245, 245, 245);
    doc.rect(ML + halfW, Y0c, halfW, COORD_H, 'F');

    // Marco exterior
    doc.setDrawColor(...CV2); doc.setLineWidth(0.4);
    doc.rect(ML, Y0c, COORD_W, COORD_H);
    // Divisor central
    doc.setDrawColor(...CV2); doc.setLineWidth(0.3);
    doc.line(ML + halfW, Y0c, ML + halfW, Y0c + COORD_H);

    // ── LADO IZQUIERDO: Coordinador ──────────────────────────────────
    const coordNombrePDF = (firmasDigitales && firmasDigitales['coord_nombre'])
      ? firmasDigitales['coord_nombre']
      : (typeof _FD !== 'undefined' && _FD.coordNombre ? _FD.coordNombre
        : (localStorage.getItem('fc_coord_nombre') || 'Coordinador Fitness'));

    // Etiqueta superior
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
    doc.setTextColor(...CORO_LOC);
    doc.text('COORDINADOR FITNESS', ML + 3, Y0c + 4);

    // Nombre del coordinador
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.setTextColor(50, 40, 0);
    doc.text(coordNombrePDF.toUpperCase(), ML + 3, Y0c + 8.5);

    // Institución
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
    doc.setTextColor(120, 100, 40);
    doc.text('Club Campestre Aguascalientes', ML + 3, Y0c + 12);

    // Firma digital del coordinador o línea punteada
    if(firmasDigitales && firmasDigitales['coord']) {
      try {
        const sigW = 42, sigH = 14;   // Fix: firma más grande (antes 28x8)
        const sigX = ML + halfW - sigW - 4;
        const sigY = Y0c + (COORD_H - sigH) / 2 - 1;
        doc.addImage(firmasDigitales['coord'], 'PNG', sigX, sigY, sigW, sigH);
        // Badge "firma digital"
        doc.setFillColor(...COROBG_L);
        doc.roundedRect(sigX, Y0c + COORD_H - 5.5, sigW, 4, 0.8, 0.8, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(4); doc.setTextColor(...CORO_LOC);
        doc.text('firma digital', sigX + sigW/2, Y0c + COORD_H - 2.8, {align:'center'});
      } catch(e) {
        // fallback línea
        doc.setDrawColor(...CORO_LOC); doc.setLineWidth(0.4);
        doc.line(ML + halfW - 36, Y0c + COORD_H - 4, ML + halfW - 4, Y0c + COORD_H - 4);
      }
    } else {
      // Línea punteada para firma manual
      doc.setDrawColor(180, 160, 80); doc.setLineWidth(0.35);
      doc.setLineDashPattern([1.0, 0.8], 0);
      doc.line(ML + halfW - 38, Y0c + COORD_H - 4, ML + halfW - 4, Y0c + COORD_H - 4);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica','italic'); doc.setFontSize(4.5); doc.setTextColor(160,140,80);
      doc.text('Firma', ML + halfW - 21, Y0c + COORD_H - 1.5, {align:'center'});
    }

    // ── LADO DERECHO: Vo.Bo. GERENCIA DEPORTES ───────────────────────
    const xR = ML + halfW + 3;
    doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Vo.Bo. GERENCIA DEPORTES', xR, Y0c + 4);

    doc.setFont('helvetica','normal'); doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Club Campestre Aguascalientes', xR, Y0c + 8.5);

    // Línea para firma manual RRHH
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.35);
    doc.setLineDashPattern([1.0, 0.8], 0);
    const xRH = ML + halfW + halfW/2;
    doc.line(xRH - 22, Y0c + COORD_H - 4, xRH + 22, Y0c + COORD_H - 4);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica','italic'); doc.setFontSize(4.5); doc.setTextColor(160,160,160);
    doc.text('Firma', xRH, Y0c + COORD_H - 1.5, {align:'center'});

    Y = Y0c + COORD_H + 3;
  }

  // ── TOTALES al pie de última página ─────────────────────────────────
  const totalClases = regs.filter(r=>r.estado==='ok'||r.estado==='sub').length;
  const totalSup    = regs.filter(r=>r.estado==='sub').length;
  const totalFaltas = regs.filter(r=>r.estado==='falta').length;
  const firmCnt     = firmasDigitales ? Object.keys(firmasDigitales).length : 0;

  if(Y+14 < PH-MB){
    doc.setFillColor(245,250,246);
    doc.rect(ML, Y+1, CW, 10, 'F');
    doc.setDrawColor(...CV2); doc.setLineWidth(0.3);
    doc.rect(ML, Y+1, CW, 10);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...CV);
    const resumen = `Clases impartidas: ${totalClases}   ·   Suplencias: ${totalSup}   ·   Faltas: ${totalFaltas}   ·   Profesores: ${profesores.length}` +
                    (firmCnt > 0 ? `   ·   Firmas digitales: ${firmCnt}` : '');
    doc.text(resumen, ML+4, Y+7);
    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(120,140,128);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}`, PW-MR-2, Y+7, {align:'right'});
  }

  // ── Nombre de archivo y descarga ─────────────────────────────────────
  const sufijo = firmasDigitales ? '_Digital' : '';
  const archivo = `HojaFirmas${sufijo}_${semana.replace(/[^\wáéíóúÁÉÍÓÚñÑ\s]/g,'').replace(/\s+/g,'_').slice(0,50)}.pdf`;
  doc.save(archivo);
  return { profesores: profesores.length, totalSup, totalFaltas, firmCnt };
}

function generarHojaFirmasPDF(){
  const elI = document.getElementById('firmas-fecha-ini');
  const elF = document.getElementById('firmas-fecha-fin');
  const elT = document.getElementById('firmas-semana-txt');
  const lun = new Date(lunesBase);
  const dom = new Date(lun); dom.setDate(lun.getDate()+6);
  const iso = d => fechaLocalStr(d);
  const fechaIni = (elI&&elI.value) ? elI.value : iso(lun);
  const fechaFin = (elF&&elF.value) ? elF.value : iso(dom);
  const fmt2 = s => new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long'});
  const semana = (elT&&elT.value.trim()) ? elT.value.trim()
               : `${fmt2(fechaIni)} al ${fmt2(fechaFin)} ${fechaIni.slice(0,4)}`;
  const r = _generarHojaFirmasCore(fechaIni, fechaFin, semana, null);
  if(r){ cerrarModal('m-reports'); showToast(`Hoja de firmas lista · ${r.profesores} profesores · ${r.totalSup} suplencias · ${r.totalFaltas} faltas`,'ok'); }
}

// ═══════════════════════════════════════════
// EXPORTAR EXCEL (mejorado con estilos)
// ═══════════════════════════════════════════
function exportarPrintExcel() {
  const titulo = document.getElementById('print-ttl').textContent;
  const body = document.getElementById('print-body');
  const tabla = body.querySelector('table');
  if(!tabla){showToast('No hay tabla para exportar en este reporte. Usa Imprimir para exportar como PDF.','warn');return;}

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
  if(!tabla){showToast('No hay tabla para exportar como CSV.','warn');return;}
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
  const histRows = [['Fecha','Día','Clase','Instructor','Hora','Asistentes','Capacidad','Aforo %','Estado','Suplente','Motivo Suplencia','Fuente']];
  [...registros].sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0).forEach(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const sup=r.suplente_id?instructores.find(i=>i.id===r.suplente_id):null;
    const afoP=r.cap>0?Math.round((r.asistentes||0)/r.cap*100):0;
    const est=r.estado==='ok'?'Impartida':r.estado==='sub'?'Con Suplente':'Falta';
    const motivoLabel=r.estado==='sub'&&r.motivo_suplencia?({'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'}[r.motivo_suplencia]||r.motivo_suplencia):'—';
    histRows.push([r.fecha||'',r.dia||'',r.clase||'',inst?inst.nombre:'?',r.hora||'',r.asistentes||0,r.cap||0,afoP+'%',est,sup?sup.nombre:'—',motivoLabel,r.tipo==='recorrido'?'Recorrido':'Manual']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(histRows), 'Historial Clases');

  // ── Hoja 4: Suplencias
  const supRows = [['Fecha','Clase','Horario','Día','Instructor Original','Suplente','Motivo','Asistentes','Aforo %']];
  registros.filter(r=>r.estado==='sub').sort((a,b)=>b.fecha?.localeCompare(a.fecha||'')||0).forEach(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const sup=instructores.find(i=>i.id===r.suplente_id);
    const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
    const motivoLabel=r.motivo_suplencia?({'permiso':'Permiso','vacaciones':'Vacaciones','falta':'Falta','incapacidad':'Incapacidad','otro':'Otro'}[r.motivo_suplencia]||r.motivo_suplencia):'—';
    supRows.push([r.fecha||'',r.clase||'',r.hora||'',r.dia||'',inst?inst.nombre:'?',sup?sup.nombre:'?',motivoLabel,r.asistentes||0,afoP+'%']);
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

  XLSX.writeFile(wb, `FitnessControl_Completo_${fechaLocalStr(new Date())}.xlsx`);
}

// ═══════════════════════════════════════════
// EXPORTAR PDF COMPLETO DEL SISTEMA
// ═══════════════════════════════════════════
function exportarPDFCompleto() {
  if(!window.jspdf){showToast('Librería PDF no disponible.','warn');return;}
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
  const hoy30str=fechaLocalStr(hoy30);
  const histRecs=registros.filter(r=>r.fecha&&r.fecha>=hoy30str).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,80);
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

  doc.save(`FitnessControl_Completo_${fechaLocalStr(new Date())}.pdf`);
}

// ═══════════════════════════════════════════
// EXPORTAR EXCEL COMPLETO (función legacy renombrada)
// ═══════════════════════════════════════════

