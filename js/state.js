// ═══ STATE — Fitness Control · Club Campestre ═══
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

const hoy=new Date();
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
  const horas=(imp.length*1).toFixed(1);
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

