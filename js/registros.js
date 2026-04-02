// ═══ REGISTROS — Fitness Control · Club Campestre ═══
// ═══ GUARDAR CLASE ═══
function guardarClase(){
  const instId=parseInt(document.getElementById('rc-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const claseNombre=document.getElementById('rc-clase').value;
  const diaVal=document.getElementById('rc-dia').value;
  const horaVal=document.getElementById('rc-hora').value;

  if(!inst){ toast('Selecciona un instructor','err'); return; }
  if(!claseNombre || !diaVal || !horaVal){
    toast('Selecciona un horario asignado del instructor','err'); return;
  }

  const fechaVal=document.getElementById('rc-fecha').value;
  const hoyStr=new Date().toISOString().slice(0,10);
  if(!fechaVal){ toast('Selecciona la fecha de la clase','err'); document.getElementById('rc-fecha').classList.add('input-error'); return; }
  if(fechaVal > hoyStr){ toast('La fecha no puede ser futura','warn'); document.getElementById('rc-fecha').classList.add('input-error'); return; }

  const asistVal=parseInt(document.getElementById('rc-asis').value)||0;
  const capDefault=getCapClase(claseNombre);
  const capInput=parseInt(document.getElementById('rc-cap').value)||capDefault;
  if(asistVal<0){ toast('Los asistentes no pueden ser negativos','err'); return; }
  if(capInput<1){ toast('La capacidad debe ser al menos 1','err'); return; }
  if(asistVal>capInput){ toast(`Asistentes (${asistVal}) excede la capacidad del salón (${capInput})`, 'warn'); return; }

  const est=document.getElementById('rc-est').value;
  const supId=est==='sub'?parseInt(document.getElementById('rc-suplente').value)||null:null;
  const nuevoIdClase=(registros.length>0?Math.max(...registros.map(r=>parseInt(r.id)||0)):0)+1;
  registros.push({id:nuevoIdClase,inst_id:instId,
    dia:diaVal,
    clase:claseNombre,
    hora:horaVal,
    asistentes:asistVal,
    cap:capInput,
    dur:parseInt(document.getElementById('rc-dur').value)||60,
    estado:est,fecha:fechaVal,tipo:'clase',suplente_id:supId});
  cerrarModal('m-clase');renderAll();
  toast(`Clase registrada para ${inst.nombre}`,'ok');
}
function guardarFalta(){
  const instId=parseInt(document.getElementById('rf-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const nuevoIdFalta=(registros.length>0?Math.max(...registros.map(r=>parseInt(r.id)||0)):0)+1;
  registros.push({id:nuevoIdFalta,inst_id:instId,dia:document.getElementById('rf-dia').value,
    clase:document.getElementById('rf-clase').value,hora:'00:00',asistentes:0,cap:0,dur:0,estado:'falta',
    fecha:hoy.toISOString().slice(0,10),tipo:'falta',tipo_falta:document.getElementById('rf-tipo').value,
    nota:document.getElementById('rf-nota').value,suplente_id:null});
  cerrarModal('m-falta');renderAll();
  toast(`Falta registrada para ${inst.nombre}`,'ok');
}

// ═══ REPORTE DE SUPLENCIAS ═══
let lastSuplencias=[];
function renderReporteSuplencias(){
  const ini=document.getElementById('sup-fecha-ini').value;
  const fin=document.getElementById('sup-fecha-fin').value;
  const filtInst=document.getElementById('sup-filtro-inst').value;
  if(!ini||!fin){toast('Selecciona el rango de fechas','err');return;}
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
        ${['Fecha','Clase','Horario','Instructor Original','Suplente','Asistentes','Aforo %'].map(h=>`<th style="padding:7px 10px;color:var(--txt2);font-size:.67rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border)">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${lastSuplencias.map((r,n)=>{
        const instOrig=instructores.find(i=>i.id===r.inst_id);
        const sup=instructores.find(i=>i.id===r.suplente_id);
        const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
        const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        return `<tr style="background:${n%2?'var(--panel2)':'transparent'};border-bottom:1px solid var(--border)">
          <td style="padding:6px 10px;font-family:monospace;font-size:.78rem">${fd}</td>
          <td style="padding:6px 10px;font-weight:600">${r.clase}</td>
          <td style="padding:6px 10px;font-family:monospace">${r.hora}</td>
          <td style="padding:6px 10px;color:var(--txt2)">${instOrig?instOrig.nombre:'—'}</td>
          <td style="padding:6px 10px;color:var(--blue);font-weight:600">${sup?sup.nombre:'—'}</td>
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
        ${['Fecha','Clase','Horario','Instructor Original','Suplente','Asistentes','Aforo %'].map(h=>`<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.67rem;text-transform:uppercase">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
      ${lastSuplencias.map((r,n)=>{
        const instOrig=instructores.find(i=>i.id===r.inst_id);
        const sup=instructores.find(i=>i.id===r.suplente_id);
        const afoP=r.cap>0?Math.round(r.asistentes/r.cap*100):0;
        const fd=new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        const col=pctColPrint(afoP);
        return `<tr style="background:${n%2?'#f9fdf9':'#fff'}">
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">${fd}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">${r.clase}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">${r.hora}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5">${instOrig?instOrig.nombre:'—'}</td>
          <td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:600">${sup?sup.nombre:'—'}</td>
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

