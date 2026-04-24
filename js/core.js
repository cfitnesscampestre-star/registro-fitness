// ── Variables globales de sesión — declaradas al inicio para evitar TDZ ──
let rolActual = null;
let rolLoginSeleccionado = 'admin';
let instActualId = null;

// ═══ SISTEMA DE TOAST ═══
(function(){
  const ICONS={ok:'✔',err:'✖',warn:'⚠',info:'ℹ'};
  const dur={ok:3200,err:4500,warn:4000,info:3500};
  window.showToast=function(msg,type='ok'){
    const c=document.getElementById('toast-container');
    if(!c)return;
    const t=document.createElement('div');
    t.className=`toast toast-${type}`;
    t.innerHTML=`<span class="toast-ico">${ICONS[type]||ICONS.info}</span><span class="toast-msg">${msg}</span>`;
    const dismiss=()=>{
      t.classList.add('hide');
      t.addEventListener('animationend',()=>t.remove(),{once:true});
    };
    t.addEventListener('click',dismiss);
    c.appendChild(t);
    setTimeout(dismiss,dur[type]||3500);
  };
})();

// ═══ CONSTANTES ═══
const DIAS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const HORAS_CAL=['06:00','07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
let TIPOS_CLASE=['Spinning','Yoga','Pilates','Zumba','CrossFit','Aqua Fitness','Body Pump','GAP','Funcional','Box Fitness','TRX','Stretching','RPM','Step','Kick Boxing'];

// ═══ ESTADO — sin datos ficticios, todo se carga desde localStorage/Firebase ═══
let instructores=[];

let registros=[];
let recorridos=[];
let tmpSlots=[];
let recActual={fecha:'',hora:'',dia:'',items:[],clasesActivas:[]};
let recIdx=0;

// ═══════════════════════════════════════════
// SALONES — declaración anticipada para que
// getCapClase() esté disponible desde el inicio
// ═══════════════════════════════════════════
let salones = JSON.parse(localStorage.getItem('fc_salones') || 'null') || [
  {id:1, nombre:'Salón Principal', cap:20, tipo:'salon', clases:[]},
  {id:2, nombre:'Estudio Spinning', cap:20, tipo:'spinning', clases:['Spinning','Indoor Cycling','Ciclismo Indoor']},
  {id:3, nombre:'Sala Yoga', cap:15, tipo:'yoga', clases:['Yoga','Pilates','Stretching']},
];

let suplenciasPlan  = JSON.parse(localStorage.getItem('fc_suplencias')  || '[]');
let solicitudesInst = JSON.parse(localStorage.getItem('fc_solicitudes') || '[]');

const hoy=new Date();
let vistaFecha=new Date(); // fecha seleccionada en la vista "Hoy" (por defecto = hoy real)
// ── Fecha en hora local (evita bug UTC que cambia el día a las 6 PM en México) ──
function fechaLocalStr(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ── Navegación de fecha en vista "Hoy" ──────────────────────────────────────
function setVistaFecha(val){
  if(!val) return;
  const [y,m,d]=val.split('-').map(Number);
  vistaFecha=new Date(y,m-1,d);
  renderHoy();
  renderMobileHome();
}
function cambiarVistaFecha(delta){
  vistaFecha=new Date(vistaFecha);
  vistaFecha.setDate(vistaFecha.getDate()+delta);
  renderHoy();
  renderMobileHome();
}
function resetVistaFecha(){
  vistaFecha=new Date(hoy);
  renderHoy();
  renderMobileHome();
}
const lunesBase=new Date(hoy);lunesBase.setDate(hoy.getDate()-((hoy.getDay()+6)%7));
let calOffset=0;

// ═══ UTILS ═══
function pctCol(v){return v>=80?'var(--v3)':v>=55?'var(--gold2)':'var(--red2)';}
function pctColPrint(v){return v>=80?'#155724':v>=55?'#856404':'#c00';}
function semanaStr(lunes){
  const d=new Date(lunes);d.setDate(lunes.getDate()+6);
  const f=x=>x.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
  return `${f(lunes)} — ${f(d)} ${d.getFullYear()}`;
}
function getLunes(offset){
  const l=new Date(lunesBase);
  l.setDate(lunesBase.getDate()+offset*7);
  return l;
}
function horaToMin(h){const[hh,mm]=h.split(':').map(Number);return hh*60+(mm||0);}
function statsInst(inst){
  const recs=registros.filter(r=>r.inst_id===inst.id);
  const imp=recs.filter(r=>r.estado==='ok'||r.estado==='sub');
  const faltas=recs.filter(r=>r.estado==='falta').length;
  const horas=(imp.reduce((a,r)=>a+(parseInt(r.dur)||60)/60,0)).toFixed(1);
  const afoRecs=imp.filter(r=>parseInt(r.cap||0)>0);
  const aforo=afoRecs.length>0?Math.round(afoRecs.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/afoRecs.length):0;
  const totalAsis=imp.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);
  return{impartidas:imp.length,faltas,horas,aforo,totalAsis};
}
function todosLosClasesUnicos(){
  const del=[...new Set(instructores.flatMap(i=>(i.horario||[]).map(h=>h.clase)))];
  return [...new Set([...TIPOS_CLASE,...del])].sort();
}
function nombreSuplente(sid){
  if(!sid)return '—';
  const s=instructores.find(i=>i.id===sid);
  return s?s.nombre:'—';
}

// ═══ GESTIÓN DE CLASES PERSONALIZADAS ═══
function syncClaseInput(){
  const sel=document.getElementById('s-clase');
  const inp=document.getElementById('s-clase-custom');
  if(sel.value==='__nueva__'){
    inp.style.display='block';
    inp.focus();
  } else {
    inp.style.display='none';
  }
}
function syncClaseSelect(){
  const inp=document.getElementById('s-clase-custom');
  const sel=document.getElementById('s-clase');
  if(inp.value.trim()){sel.value='__nueva__';}
}
function getClaseSeleccionada(){
  const sel=document.getElementById('s-clase');
  const inp=document.getElementById('s-clase-custom');
  if(sel.value==='__nueva__'){
    const v=inp.value.trim();
    if(v&&!TIPOS_CLASE.includes(v)){TIPOS_CLASE.push(v);actualizarSelectoresClase();}
    return v;
  }
  return sel.value;
}
function actualizarSelectoresClase(){
  const todas=todosLosClasesUnicos();
  const opts=todas.map(c=>`<option value="${c}">${c}</option>`).join('')+'<option value="__nueva__">✚ Nueva clase...</option>';
  const sel=document.getElementById('s-clase');
  if(sel){const cur=sel.value;sel.innerHTML=opts;sel.value=cur||todas[0];}
}

// ═══ MODALES ═══
function abrirModal(id){
  document.getElementById(id).classList.add('on');
  const opts=instructores.map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
  if(id==='m-clase'){
    document.getElementById('rc-inst').innerHTML=opts;
    document.getElementById('rc-fecha').value=fechaLocalStr(hoy);
    document.getElementById('rc-suplente').innerHTML='<option value="">— Sin suplente —</option>'+opts;
    cargarHorariosInst();
  }
  if(id==='m-falta'){
    document.getElementById('rf-inst').innerHTML=opts;
    // Inicializar fecha con hoy — el usuario puede cambiarlo a días anteriores
    const rfFecha = document.getElementById('rf-fecha');
    if(rfFecha){
      rfFecha.value = fechaLocalStr(hoy);
      // Límite: no más de 30 días atrás, no futuro
      const minDate = new Date(hoy); minDate.setDate(hoy.getDate()-30);
      rfFecha.min = fechaLocalStr(minDate);
      rfFecha.max = fechaLocalStr(hoy);
    }
    cargarClasesInst('rf');
  }
  if(id==='m-suplencias'){
    document.getElementById('sup-filtro-inst').innerHTML='<option value="">— Todos los suplentes —</option>'+opts;
    const ini=new Date(lunesBase);ini.setDate(ini.getDate()-28);
    document.getElementById('sup-fecha-ini').value=fechaLocalStr(ini);
    document.getElementById('sup-fecha-fin').value=fechaLocalStr(hoy);
    document.getElementById('sup-body').innerHTML='';
    document.getElementById('sup-export-btns').style.display='none';
  }
  if(id==='m-reports'){
    const lun = new Date(lunesBase);
    const dom = new Date(lun); dom.setDate(lun.getDate()+6);
    const elI = document.getElementById('firmas-fecha-ini');
    const elF = document.getElementById('firmas-fecha-fin');
    if(elI && !elI.value){ elI.value = fechaLocalStr(lun); }
    if(elF && !elF.value){ elF.value = fechaLocalStr(dom); }
    firmasActualizarLabel();
  }
}
function cerrarModal(id){document.getElementById(id).classList.remove('on');}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on');}));

function cargarClasesInst(pref){
  const instId=parseInt(document.getElementById(pref+'-inst').value);
  const inst=instructores.find(i=>i.id===instId);
  const clases=inst?[...new Set(inst.horario.map(h=>h.clase))]:TIPOS_CLASE;
  const opts=clases.map(c=>`<option>${c}</option>`).join('');
  document.getElementById(pref+'-clase').innerHTML=opts;
}

// ── Carga los horarios del instructor seleccionado en el modal "+ Clase" ──
function cargarHorariosInst(){
  const instId = parseInt(document.getElementById('rc-inst').value);
  const inst   = instructores.find(i => i.id === instId);
  const selHor = document.getElementById('rc-horario');
  const preview   = document.getElementById('rc-slot-preview');
  const sinMsg    = document.getElementById('rc-sin-horarios');

  // Limpiar campos ocultos
  document.getElementById('rc-clase').value = '';
  document.getElementById('rc-dia').value   = '';
  document.getElementById('rc-hora').value  = '';
  if(preview)  preview.style.display  = 'none';
  if(sinMsg)   sinMsg.style.display   = 'none';

  if(!inst || !(inst.horario||[]).length){
    selHor.innerHTML = '<option value="">— Sin horarios asignados —</option>';
    selHor.disabled  = true;
    if(sinMsg && inst) sinMsg.style.display = 'block';
    return;
  }

  selHor.disabled = false;
  // Ordenar slots: por día de la semana primero, luego por hora
  const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const slots = [...inst.horario].sort((a,b)=>{
    const di = ordenDias.indexOf(a.dia) - ordenDias.indexOf(b.dia);
    return di !== 0 ? di : a.hora.localeCompare(b.hora);
  });

  selHor.innerHTML = '<option value="">— Selecciona un horario —</option>' +
    slots.map((s,i) =>
      `<option value="${i}">${s.dia}  ·  ${s.hora}  —  ${s.clase}</option>`
    ).join('');

  // Si solo hay 1 slot, seleccionarlo automáticamente
  if(slots.length === 1){
    selHor.value = '0';
    autoRellenarHorario();
  }
}

// ── Al elegir un horario, rellena los campos ocultos y muestra la tarjeta ──
function autoRellenarHorario(){
  const instId = parseInt(document.getElementById('rc-inst').value);
  const inst   = instructores.find(i => i.id === instId);
  const idx    = document.getElementById('rc-horario').value;
  const preview   = document.getElementById('rc-slot-preview');
  const sinMsg    = document.getElementById('rc-sin-horarios');

  if(idx === '' || !inst){
    if(preview) preview.style.display = 'none';
    document.getElementById('rc-clase').value = '';
    document.getElementById('rc-dia').value   = '';
    document.getElementById('rc-hora').value  = '';
    return;
  }

  const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const slots = [...inst.horario].sort((a,b)=>{
    const di = ordenDias.indexOf(a.dia) - ordenDias.indexOf(b.dia);
    return di !== 0 ? di : a.hora.localeCompare(b.hora);
  });

  const slot = slots[parseInt(idx)];
  if(!slot) return;

  // Rellenar campos ocultos que usa guardarClase()
  document.getElementById('rc-clase').value = slot.clase;
  document.getElementById('rc-dia').value   = slot.dia;
  document.getElementById('rc-hora').value  = slot.hora;

  // Capacidad automática desde salones
  const capAuto = getCapClase(slot.clase);
  document.getElementById('rc-cap').value = capAuto;

  // Mostrar tarjeta visual
  if(preview){
    document.getElementById('rc-prev-clase').textContent = slot.clase;
    document.getElementById('rc-prev-dia').textContent   = slot.dia;
    document.getElementById('rc-prev-hora').textContent  = slot.hora;
    preview.style.display = 'block';
  }
  if(sinMsg) sinMsg.style.display = 'none';
}

function toggleSuplenteClase(){
  const v=document.getElementById('rc-est').value;
  const isSub=(v==='sub');
  document.getElementById('rc-suplente-row').style.display=isSub?'flex':'none';
  document.getElementById('rc-motivo-row').style.display=isSub?'flex':'none';
}
function toggleSuplenteRec(){
  const v=document.getElementById('rcc-pres').value;
  const isSub=(v==='sub');
  const isNo=(v==='no');
  const row=document.getElementById('rcc-suplente-row');
  row.style.display=isSub?'flex':'none';
  document.getElementById('rcc-motivo-row').style.display=isSub?'flex':'none';
  // Bug fix: mostrar motivo de falta solo cuando el instructor está ausente
  const faltaRow=document.getElementById('rcc-falta-motivo-row');
  if(faltaRow) faltaRow.style.display=isNo?'flex':'none';
  if(isSub){
    const c=recActual.clasesActivas[recIdx];
    const opts=instructores.filter(i=>i.id!==c.inst_id).map(i=>`<option value="${i.id}">${i.nombre}</option>`).join('');
    document.getElementById('rcc-suplente').innerHTML='<option value="">— Seleccionar —</option>'+opts;
  }
}

// ═══ MODAL INSTRUCTOR ═══

// ═══ FOTO DE INSTRUCTOR ═══════════════════════════════
function miPrecargarFoto(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // Comprimir a max 200px usando canvas
    const img = new Image();
    img.onload = () => {
      const MAX = 200;
      const ratio = Math.min(MAX/img.width, MAX/img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.82);
      document.getElementById('mi-foto-data').value = data;
      _miMostrarFotoPreview(data);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function _miMostrarFotoPreview(data) {
  const prev = document.getElementById('mi-foto-preview');
  const del  = document.getElementById('mi-foto-del');
  if(data) {
    prev.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    if(del) del.style.display = 'inline';
  } else {
    prev.textContent = '?';
    if(del) del.style.display = 'none';
  }
}
function miQuitarFoto() {
  document.getElementById('mi-foto-data').value = '';
  document.getElementById('mi-foto-input').value = '';
  _miMostrarFotoPreview(null);
}
// ════════════════════════════════════════════════════════

function abrirModalInstructor(id){
  actualizarSelectoresClase();
  if(id){
    const inst=instructores.find(i=>String(i.id)===String(id));
    document.getElementById('mi-ttl').innerHTML='<svg class="ico" viewBox="0 0 20 20"><path d="M13.5 3.5 L16.5 6.5 L8 15 L4 16 L5 12 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="12" y1="5" x2="15" y2="8" stroke="currentColor" stroke-width="1.3"/></svg> Editar Instructor';
    document.getElementById('mi-id').value=id;
    document.getElementById('mi-nombre').value=inst.nombre;
    document.getElementById('mi-tipo').value=inst.tipo;
    document.getElementById('mi-turno').value=inst.turno;
    document.getElementById('mi-esp').value=inst.esp||'';
    document.getElementById('mi-foto-data').value=inst.foto||'';
    _miMostrarFotoPreview(inst.foto||null);
    tmpSlots=[...(inst.horario||[])];
    document.getElementById('mi-del').style.display='block';
  } else {
    document.getElementById('mi-ttl').textContent='+ Nuevo Instructor';
    document.getElementById('mi-id').value='';
    document.getElementById('mi-nombre').value='';
    document.getElementById('mi-tipo').value='planta';
    document.getElementById('mi-turno').value='ambos';
    document.getElementById('mi-esp').value='';
    document.getElementById('mi-foto-data').value='';
    document.getElementById('mi-foto-input').value='';
    _miMostrarFotoPreview(null);
    tmpSlots=[];
    document.getElementById('mi-del').style.display='none';
  }
  renderSlots();
  document.getElementById('m-instructor').classList.add('on');
}
function renderSlots(){
  const cont=document.getElementById('mi-slots');
  if(tmpSlots.length===0){cont.innerHTML='<div style="font-size:.75rem;color:var(--txt3);text-align:center;padding:.5rem">Sin clases asignadas aún</div>';return;}
  cont.innerHTML=tmpSlots.map((s,i)=>`
    <div class="sch-slot">
      <span style="font-size:.75rem;color:var(--txt2);min-width:70px">${s.dia}</span>
      <span class="mono" style="color:var(--gold2);min-width:46px">${s.hora}</span>
      <span style="flex:1;font-size:.82rem;font-weight:600">${s.clase}</span>
      <button class="sch-rm" onclick="quitarSlot(${i})"><svg class="ico" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    </div>`).join('');
}
function agregarSlot(){
  const dia=document.getElementById('s-dia').value;
  const hora=document.getElementById('s-hora').value;
  const clase=getClaseSeleccionada();
  if(!clase){showToast('Escribe el nombre de la clase','err');return;}
  if(tmpSlots.find(s=>s.dia===dia&&s.hora===hora)){showToast('Ya hay una clase en ese horario','warn');return;}
  tmpSlots.push({dia,hora,clase});
  tmpSlots.sort((a,b)=>{const di=DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia);return di!==0?di:a.hora.localeCompare(b.hora);});
  renderSlots();
  document.getElementById('s-clase-custom').style.display='none';
  document.getElementById('s-clase-custom').value='';
}
function quitarSlot(i){tmpSlots.splice(i,1);renderSlots();}

// ═══════════════════════════════════════════════════════
// ═══ MOTOR DE VALIDACIÓN ══════════════════════════════
// ═══════════════════════════════════════════════════════
function _vErr(id, msg) {
  const el = document.getElementById(id);
  if(!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.boxShadow   = '0 0 0 2px rgba(224,80,80,.2)';
  el.title = msg;
  const clear = () => _vClear(id);
  el.addEventListener('input',  clear, {once:true});
  el.addEventListener('change', clear, {once:true});
}
function _vClear(id) {
  const el = document.getElementById(id);
  if(!el) return;
  el.style.borderColor = '';
  el.style.boxShadow   = '';
  el.title = '';
}
function _vClearAll(ids) { ids.forEach(id => _vClear(id)); }

function guardarInstructor(){
  _vClearAll(['mi-nombre','mi-tipo']);
  const id=parseInt(document.getElementById('mi-id').value)||0;
  const nombre=document.getElementById('mi-nombre').value.trim();
  let ok=true;
  if(!nombre){ _vErr('mi-nombre','El nombre es requerido'); showToast('Ingresa el nombre del instructor','err'); ok=false; }
  if(!ok) return;
  // Verificar nombre duplicado
  const nombreNorm=nombre.toLowerCase().trim();
  const duplicado=instructores.find(i=>i.nombre.toLowerCase().trim()===nombreNorm && String(i.id)!==String(id));
  if(duplicado){ showToast(`Ya existe un instructor con el nombre "${nombre}"`, 'warn'); }
  // Mínimo 1 clase en horario si es nuevo
  if(!id && tmpSlots.length===0) showToast('Recuerda agregar el horario del instructor después','info');
  const fotoData=document.getElementById('mi-foto-data').value||null;
  const data={nombre,tipo:document.getElementById('mi-tipo').value,
    turno:document.getElementById('mi-turno').value,
    esp:document.getElementById('mi-esp').value.trim(),
    foto:fotoData,horario:[...tmpSlots]};
  if(id){ const idx=instructores.findIndex(i=>String(i.id)===String(id)); if(idx>=0) instructores[idx]={...instructores[idx],...data}; else{ showToast('No se encontró el instructor. Intenta de nuevo.','err'); return; } }
  else{ const nid=instructores.reduce((m,i)=>Math.max(m,i.id||0),0)+1; instructores.push({id:nid,...data}); }
  cerrarModal('m-instructor');renderAll();
  registrarLog('instructor', `${id?'Editado':'Nuevo'}: ${nombre} · ${data.tipo}`);
  showToast(`Instructor ${id?'actualizado':'agregado'}`,'ok');
}
function eliminarInstructor(){
  const id=parseInt(document.getElementById('mi-id').value);
  const inst=instructores.find(i=>String(i.id)===String(id));
  const nomInst=inst?inst.nombre:'este instructor';
  const regsAfectados=registros.filter(r=>String(r.inst_id)===String(id)).length;
  const msg=regsAfectados>0
    ? `¿Eliminar a ${nomInst}?\n\nSe eliminarán también sus ${regsAfectados} registro(s) de clases y su historial de asistencia.\n\nEsta acción no se puede deshacer.`
    : `¿Eliminar a ${nomInst}? Esta acción no se puede deshacer.`;
  if(!confirm(msg))return;
  // Bug fix 5: limpiar registros y recorridos del instructor antes de eliminarlo
  registros=registros.filter(r=>String(r.inst_id)!==String(id));
  recorridos=recorridos.map(rec=>({
    ...rec,
    items:(rec.items||[]).filter(it=>String(it.inst_id)!==String(id))
  }));
  instructores=instructores.filter(i=>String(i.id)!==String(id));
  cerrarModal('m-instructor');renderAll();
  registrarLog('instructor',`Eliminado: ${nomInst} · ${regsAfectados} registro(s) borrados`);
  const msgToast = regsAfectados>0
    ? `${nomInst} eliminado · ${regsAfectados} registro(s) borrados`
    : `${nomInst} eliminado`;
  showToast(msgToast,'ok');
}

