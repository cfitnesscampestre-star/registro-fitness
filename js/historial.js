// ═══ HISTORIAL — Fitness Control · Club Campestre ═══
// ═══ HISTORIAL DE CLASES ═══
let histPagina=0;
const HIST_POR_PAG=25;

function inicializarFiltrosHistorial(){
  // Solo pone fechas por defecto si los campos están vacíos (primera vez)
  const iniEl=document.getElementById('hist-fecha-ini');
  const finEl=document.getElementById('hist-fecha-fin');
  if(!iniEl.value&&!finEl.value){
    const fin=new Date();
    const ini=new Date();ini.setDate(ini.getDate()-30);
    iniEl.value=ini.toISOString().slice(0,10);
    finEl.value=fin.toISOString().slice(0,10);
  }
  // Actualizar selectores de instructor y clase SIN tocar las fechas
  const selInst=document.getElementById('hist-inst-fil');
  const curInst=selInst.value;
  selInst.innerHTML='<option value="">— Todos los instructores —</option>'+
    [...instructores].sort((a,b)=>a.nombre.localeCompare(b.nombre))
      .map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  if(curInst)selInst.value=curInst;
  // Clases únicas de registros reales
  const clases=[...new Set(registros.map(r=>r.clase))].filter(Boolean).sort();
  const selClase=document.getElementById('hist-clase-fil');
  const curClase=selClase.value;
  selClase.innerHTML='<option value="">— Todas las clases —</option>'+
    clases.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(curClase)selClase.value=curClase;
}

function filtrarRegistrosHistorial(){
  const ini=document.getElementById('hist-fecha-ini').value;
  const fin=document.getElementById('hist-fecha-fin').value;
  const instId=document.getElementById('hist-inst-fil').value;
  const clase=document.getElementById('hist-clase-fil').value;
  const estado=document.getElementById('hist-estado-fil').value;
  return registros.filter(r=>{
    const f=r.fecha||'';
    if(ini&&f<ini)return false;
    if(fin&&f>fin)return false;
    if(instId&&String(r.inst_id)!==instId)return false;
    if(clase&&r.clase!==clase)return false;
    if(estado&&r.estado!==estado)return false;
    return true;
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.hora.localeCompare(a.hora));
}

function renderHistorial(){
  inicializarFiltrosHistorial();
  const lista=filtrarRegistrosHistorial();
  const total=lista.length;
  const totalAsis=lista.reduce((a,r)=>a+(r.asistentes||0),0);
  const impartidas=lista.filter(r=>r.estado==='ok'||r.estado==='sub').length;
  const faltas=lista.filter(r=>r.estado==='falta').length;
  const sups=lista.filter(r=>r.estado==='sub').length;
  document.getElementById('hist-resumen').innerHTML=
    `<span style="color:var(--neon)">${total} registros</span> &nbsp;·&nbsp; `+
    `<span style="color:var(--v3)"><svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${impartidas} impartidas</span> &nbsp;·&nbsp; `+
    `<span style="color:var(--red2)"><svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> ${faltas} faltas</span> &nbsp;·&nbsp; `+
    `<span style="color:var(--blue)"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> ${sups} suplencias</span> &nbsp;·&nbsp; `+
    `<span style="color:var(--gold2)"><svg class="ico" viewBox="0 0 20 20"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2 17 Q2 12 8 12 Q14 12 14 17" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="6" r="2.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M14 11 Q18 11 18 16" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg> ${totalAsis.toLocaleString()} asistentes totales</span>`;

  const inicio=histPagina*HIST_POR_PAG;
  const pagina=lista.slice(inicio,inicio+HIST_POR_PAG);

  if(pagina.length===0){
    document.getElementById('tb-historial').innerHTML=`<tr><td colspan="12"><div class="empty">Sin registros en este periodo. Agrega clases con el botón "+ Clase" o realiza un recorrido.</div></td></tr>`;
    document.getElementById('hist-paginacion').innerHTML='';
    return;
  }

  document.getElementById('tb-historial').innerHTML=pagina.map(r=>{
    const inst=instructores.find(i=>i.id===r.inst_id);
    const sup=r.suplente_id?instructores.find(i=>i.id===r.suplente_id):null;
    const afoP=r.cap>0?Math.round((r.asistentes||0)/r.cap*100):0;
    const fd=r.fecha?new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'—';
    const estChip=r.estado==='ok'?'<span class="chip cok"><svg class="ico ico-ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><polyline points="6,10 9,13 14,7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Impartida</span>':
                  r.estado==='sub'?'<span class="chip bb" style="font-size:.68rem"><svg class="ico" viewBox="0 0 20 20"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 5.2 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-5.2-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><polyline points="14.5,7 15.5,3.8 18.5,5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="5.5,13 4.5,16.2 1.5,15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Suplente</span>':
                  '<span class="chip cbd"><svg class="ico ico-err" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="7" y1="7" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Falta</span>';
    return `<tr>
      <td class="mono" style="font-size:.75rem">${fd}</td>
      <td style="font-size:.75rem;color:var(--txt2)">${r.dia||'—'}</td>
      <td><strong>${r.clase||'—'}</strong></td>
      <td style="font-size:.8rem">${inst?inst.nombre:'—'}</td>
      <td class="mono">${r.hora||'—'}</td>
      <td style="text-align:center;font-weight:700;color:${pctCol(afoP)}">${r.estado==='falta'?'—':(r.asistentes??'—')}</td>
      <td style="text-align:center;color:var(--txt2)">${r.cap||'—'}</td>
      <td style="text-align:center">
        ${r.estado!=='falta'?`<div class="bw" style="justify-content:center">
          <div class="bar"><div class="bf" style="width:${Math.min(afoP,100)}%;background:${pctCol(afoP)}"></div></div>
          <span class="mono" style="color:${pctCol(afoP)};font-size:.74rem">${afoP}%</span>
        </div>`:'—'}
      </td>
      <td>${estChip}</td>
      <td style="font-size:.75rem;color:var(--blue)">${sup?sup.nombre:'—'}</td>
      <td style="font-size:.7rem;color:var(--txt3)">${r.tipo==='recorrido'?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 6 L9 11 L7 16 M10 6 L11 11 L13 16 M9 11 L12 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Recorrido':'<svg class="ico" viewBox="0 0 20 20"><path d="M5 3 H13 L16 6 V17 H5 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><polyline points="13,3 13,6 16,6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Manual'}</td>
      <td><button class="abtn" onclick="abrirEditarRegistro(${r.id})" title="Editar aforo / estado"><svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg></button></td>
    </tr>`;
  }).join('');

  // Paginación
  const totalPags=Math.ceil(total/HIST_POR_PAG);
  if(totalPags>1){
    let pags='';
    for(let i=0;i<totalPags;i++){
      pags+=`<button class="abtn" onclick="cambiarPagHist(${i})" style="${i===histPagina?'background:var(--verde);color:#fff;border-color:var(--verde)':''}">${i+1}</button> `;
    }
    document.getElementById('hist-paginacion').innerHTML=
      `<span style="font-size:.75rem;color:var(--txt2);margin-right:.5rem">Página ${histPagina+1} de ${totalPags} · ${total} registros</span>`+pags;
  } else {
    document.getElementById('hist-paginacion').innerHTML='';
  }
}

function cambiarPagHist(p){histPagina=p;renderHistorial();}
function limpiarFiltrosHistorial(){
  const fin=new Date();const ini=new Date();ini.setDate(ini.getDate()-30);
  document.getElementById('hist-fecha-ini').value=ini.toISOString().slice(0,10);
  document.getElementById('hist-fecha-fin').value=fin.toISOString().slice(0,10);
  document.getElementById('hist-inst-fil').value='';
  document.getElementById('hist-clase-fil').value='';
  document.getElementById('hist-estado-fil').value='';
  histPagina=0;renderHistorial();
}

// ═══ EDITAR REGISTRO ═══
function abrirEditarRegistro(regId){
  const r=registros.find(x=>x.id===regId);
  if(!r)return;
  const inst=instructores.find(i=>i.id===r.inst_id);
  const fd=r.fecha?new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'—';
  document.getElementById('er-info-cls').innerHTML=
    `<div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:var(--neon)">${r.clase||'—'}</div>
        <div style="color:var(--txt2);font-size:.8rem">${inst?inst.nombre:'—'} · ${r.hora||'—'} · ${fd}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.7rem;color:var(--txt3)">${r.tipo==='recorrido'?'<svg class="ico" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 6 L9 11 L7 16 M10 6 L11 11 L13 16 M9 11 L12 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Recorrido':'<svg class="ico" viewBox="0 0 20 20"><path d="M5 3 H13 L16 6 V17 H5 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><polyline points="13,3 13,6 16,6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><line x1="8" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Manual'}</div>
      </div>
    </div>`;
  document.getElementById('er-id').value=regId;
  document.getElementById('er-asis').value=r.asistentes||0;
  document.getElementById('er-cap').value=r.cap||20;
  document.getElementById('er-est').value=r.estado||'ok';
  document.getElementById('er-obs').value=r.obs||'';
  // Suplentes
  const opts=instructores.filter(i=>i.id!==r.inst_id).map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  document.getElementById('er-suplente').innerHTML='<option value="">— Sin suplente —</option>'+opts;
  if(r.suplente_id)document.getElementById('er-suplente').value=r.suplente_id;
  toggleErSuplente();
  document.getElementById('m-edit-reg').classList.add('on');
}
function toggleErSuplente(){
  const v=document.getElementById('er-est').value;
  document.getElementById('er-suplente-row').style.display=(v==='sub')?'flex':'none';
}
function guardarEdicionRegistro(){
  const id=parseInt(document.getElementById('er-id').value);
  const idx=registros.findIndex(r=>r.id===id);
  if(idx<0)return;
  const est=document.getElementById('er-est').value;
  registros[idx]={
    ...registros[idx],
    asistentes:parseInt(document.getElementById('er-asis').value)||0,
    cap:parseInt(document.getElementById('er-cap').value)||20,
    estado:est,
    obs:document.getElementById('er-obs').value.trim(),
    suplente_id:est==='sub'?(parseInt(document.getElementById('er-suplente').value)||null):null
  };
  cerrarModal('m-edit-reg');
  renderAll();
  renderHistorial();
  toast('Registro actualizado correctamente','ok');
}
function eliminarRegistro(){
  const id=parseInt(document.getElementById('er-id').value);
  if(!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.'))return;
  registros=registros.filter(r=>r.id!==id);
  cerrarModal('m-edit-reg');
  renderAll();
  renderHistorial();
  toast('Registro eliminado','ok');
}

// ═══ TABS ═══
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.vista').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    document.getElementById('v-'+t.dataset.v).classList.add('on');
    if(t.dataset.v==='calendario')renderCal();
    if(t.dataset.v==='ranking')renderRanking();
    if(t.dataset.v==='recorridos')renderRecorridos();
    if(t.dataset.v==='diagnostico')initDiagClases();
    if(t.dataset.v==='historial'){histPagina=0;renderHistorial();}
    if(t.dataset.v==='heatmap')renderHeatmap();
    if(t.dataset.v==='alertas')renderAlertas();
    if(t.dataset.v==='salones')renderSalones();
    if(t.dataset.v==='sup-plan')renderSupPlan();
  });
});

// ═══ RENDER ALL ═══
function renderAll(){
  renderDashboard();
  renderInst();
  renderRanking();
  if(document.getElementById('v-calendario').classList.contains('on'))renderCal();
}

// ═══ INIT ═══
toggleRpt();
actualizarSelectoresClase();
initDiagClases();
renderAll();
renderCal();

// ═══════════════════════════════════════════
