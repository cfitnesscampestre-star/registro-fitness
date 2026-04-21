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
    doc.text('Vo.Bo. RRHH',110,lastY+4);
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
  const ML=10, MR=10, MB=10;
  const CW = PW-ML-MR;

  // ── Paleta institucional ─────────────────────────────────────────────
  const CV     = [15, 80, 40];     // verde oscuro institucional
  const CV2    = [26,122,69];      // verde medio (acentos)
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

    // ▌ Barra verde superior (más alta)
    doc.setFillColor(...CV);
    doc.rect(0, 0, PW, HDR_H, 'F');

    // Línea decorativa dorada/verde claro bajo la barra
    doc.setFillColor(...CV2);
    doc.rect(0, HDR_H, PW, 0.8, 'F');

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
    doc.setTextColor(...CBCO);
    doc.text('CLUB CAMPESTRE AGUASCALIENTES', ML+21, 10);
    doc.setFont('helvetica','normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180,230,200);
    doc.text('COORDINACIÓN FITNESS  ·  CONTROL INTERNO  ·  NO CIRCULAR', ML+21, 15.5);

    // Semana — alineada a la derecha
    doc.setFont('helvetica','bold');
    doc.setFontSize(7);
    doc.setTextColor(...CBCO);
    doc.text('SEMANA:', PW-MR, 9, {align:'right'});
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(200,255,220);
    doc.text(semana, PW-MR, 16, {align:'right'});

    // Leyenda: rectángulo rojo dibujado + texto (sin símbolo ■)
    const leyX = PW/2;
    doc.setFillColor(...CROJO);
    doc.rect(leyX - 28, 9.5, 3.5, 3.5, 'F');
    doc.setFont('helvetica','normal');
    doc.setFontSize(6);
    doc.setTextColor(255,200,200);
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
        const sigW = 28, sigH = 8;
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

    // ── LADO DERECHO: Vo.Bo. RRHH ────────────────────────────────────
    const xR = ML + halfW + 3;
    doc.setFont('helvetica','bold'); doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Vo.Bo. RECURSOS HUMANOS', xR, Y0c + 4);

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

