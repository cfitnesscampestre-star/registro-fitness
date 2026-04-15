// ═══ FIREBASE — Fitness Control · Club Campestre ═══
// ── Estado de sincronización ─────────────────
let fbApp = null, fbDb = null;
let fbSyncing   = false;   // true mientras estamos subiendo a Firebase
let fbReceiving = false;   // true mientras procesamos datos que bajan de Firebase
let fbListener  = null;    // referencia al listener activo (para evitar duplicados)
let fbWasOffline = false;

const FIREBASE_ACTIVO = true;
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC3_83rzlemRzDEr5rbQoYTzvLock5xkjE",
  authDomain:        "fitness-campestre-e218c.firebaseapp.com",
  databaseURL:       "https://fitness-campestre-e218c-default-rtdb.firebaseio.com",
  projectId:         "fitness-campestre-e218c",
  storageBucket:     "fitness-campestre-e218c.firebasestorage.app",
  messagingSenderId: "813526273487",
  appId:             "1:813526273487:web:3a3643ae3d95d44d4a16ba"
};

// ── Normalización de tipos ────────────────────
function normalizarRegistros(){
  registros = registros.map(r=>({
    ...r,
    id:         parseInt(r.id)         || r.id,
    inst_id:    parseInt(r.inst_id)    || r.inst_id,
    asistentes: parseInt(r.asistentes) || 0,
    cap:        parseInt(r.cap)        || 20,
    dur:        parseInt(r.dur)        || 60,
    suplente_id: r.suplente_id ? (parseInt(r.suplente_id) || r.suplente_id) : null
  }));
}

// ── Guardar en localStorage ───────────────────
function guardarLocal(){
  try{
    const ts = Date.now();
    localStorage.setItem('fc_instructores', JSON.stringify(instructores));
    localStorage.setItem('fc_registros',    JSON.stringify(registros));
    localStorage.setItem('fc_recorridos',   JSON.stringify(recorridos));
    localStorage.setItem('fc_salones',      JSON.stringify(salones));
    localStorage.setItem('fc_suplencias',   JSON.stringify(suplenciasPlan));
    localStorage.setItem('fc_solicitudes',  JSON.stringify(solicitudesInst));
    localStorage.setItem('fc_ts', ts);
    // fc_local_ts solo se actualiza cuando el cambio viene de este dispositivo
    if(!fbReceiving) localStorage.setItem('fc_local_ts', ts);
  } catch(e){ console.warn('localStorage lleno o no disponible', e); }
}

// ── Cargar desde localStorage ─────────────────
function cargarLocal(){
  try{
    const inst = localStorage.getItem('fc_instructores');
    const regs = localStorage.getItem('fc_registros');
    const recs = localStorage.getItem('fc_recorridos');
    const sals = localStorage.getItem('fc_salones');
    const sups = localStorage.getItem('fc_suplencias');
    const sols = localStorage.getItem('fc_solicitudes');
    if(inst) instructores    = JSON.parse(inst);
    if(regs) registros       = JSON.parse(regs);
    if(recs) recorridos      = JSON.parse(recs);
    if(sals) salones         = JSON.parse(sals);
    if(sups) suplenciasPlan  = JSON.parse(sups);
    if(sols) solicitudesInst = JSON.parse(sols);
    normalizarRegistros();
    const ts = localStorage.getItem('fc_ts');
    if(ts) console.log('💾 Local cargado:', new Date(parseInt(ts)).toLocaleString('es-MX'));
    return !!(inst || regs);
  } catch(e){
    console.warn('Error cargando localStorage:', e);
    return false;
  }
}

// ── Subir TODOS los datos a Firebase ─────────
async function sincronizarFirebase(){
  if(!FIREBASE_ACTIVO || !fbDb || fbSyncing || fbReceiving) return;
  fbSyncing = true;
  try{
    const payload = {
      instructores,
      registros:   registros.reduce((a,r)=>{ a[String(r.id)]=r; return a; },{}),
      recorridos:  recorridos.reduce((a,r)=>{ a[String(r.id)]=r; return a; },{}),
      salones,
      suplencias:  suplenciasPlan.reduce((a,s)=>{ a[String(s.id)]=s; return a; },{}),
      solicitudes: solicitudesInst.reduce((a,s)=>{ a[String(s.id)]=s; return a; },{}),
      ts: Date.now()
    };
    // Incluir hoja de firmas activa si existe
    try {
      const hojaActiva = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
      if(hojaActiva) payload.hojaFirmasActiva = hojaActiva;
    } catch(e) {}
    await fbDb.ref('fitness').set(payload);
    setIndicador('🟢 Guardado en la nube ✔');
    console.log('☁️  Firebase ←', new Date().toLocaleTimeString('es-MX'),
      `| ${registros.length} registros | ${recorridos.length} recorridos`);
  } catch(e){
    console.warn('Firebase sync error:', e.message);
    setIndicador('🔴 Sin conexión — datos guardados localmente');
  } finally{
    setTimeout(()=>{ fbSyncing = false; }, 600);
  }
}

// ── renderAll con auto-guardado ───────────────
// IMPORTANTE: sobreescribimos renderAll UNA SOLA VEZ aquí
const _renderAllBase = renderAll;
renderAll = function(){
  _renderAllBase();
  guardarLocal();
  // Subir a Firebase con un pequeño debounce para no saturar en ediciones rápidas
  clearTimeout(renderAll._timer);
  renderAll._timer = setTimeout(sincronizarFirebase, 800);
};
renderAll._timer = null;

// ── Firebase: inicialización y listener ÚNICO ─
async function inicializarFirebase(){
  if(!FIREBASE_ACTIVO){ setIndicador('⚪ Modo offline'); return; }
  try{
    await Promise.all([
      cargarScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js'),
      cargarScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js')
    ]);

    // Evitar doble inicialización de la SDK
    fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    fbDb  = firebase.database();

    // ── Monitor de conexión ──────────────────
    fbDb.ref('.info/connected').on('value', snap => {
      const online = snap.val() === true;
      if(online){
        if(fbWasOffline){
          fbWasOffline = false;
          setIndicador('🟡 Reconectado · Subiendo datos locales...');
          // Subir lo que se acumuló offline
          setTimeout(()=>{ if(!fbSyncing) sincronizarFirebase(); }, 1200);
        } else {
          setIndicador('🟢 En línea');
        }
      } else {
        fbWasOffline = true;
        setIndicador('🔴 Sin conexión · Guardando localmente');
      }
    });

    // ── Listener ÚNICO para recibir cambios de otros dispositivos ──
    // Eliminamos el listener anterior si existía (evita duplicados en HMR/reload)
    if(fbListener){ fbDb.ref('fitness').off('value', fbListener); }

    fbListener = fbDb.ref('fitness').on('value', snap => {
      // Si NOSOTROS estamos subiendo, ignorar el eco
      if(fbSyncing) return;

      const data = snap.val();
      if(!data){ return; }

      // ─── Comparar timestamps: solo procesar si Firebase tiene datos más nuevos ───
      const localTs = parseInt(localStorage.getItem('fc_local_ts') || '0');
      const fbTs    = parseInt(data.ts || '0');

      if(localTs > fbTs + 3000){
        // Nuestros datos locales son más recientes → subir, no recibir
        console.log('📤 Local más reciente → subiendo a Firebase');
        if(!fbSyncing) setTimeout(sincronizarFirebase, 500);
        return;
      }

      // ─── Aplicar datos de Firebase ────────────────────────────────────────────
      fbReceiving = true;
      try{
        if(Array.isArray(data.instructores) && data.instructores.length >= 0)
          instructores = data.instructores;

        if(data.registros)
          registros = Object.values(data.registros);

        if(data.recorridos)
          recorridos = Object.values(data.recorridos);

        if(Array.isArray(data.salones) && data.salones.length >= 0)
          salones = data.salones;

        if(data.suplencias)
          suplenciasPlan = Object.values(data.suplencias);

        if(data.solicitudes)
          solicitudesInst = Object.values(data.solicitudes);

        // ── Sincronizar hoja de firmas activa ──────────────────────────────────
        // Si Firebase trae una hoja, actualizamos localStorage para que el
        // instructor en este dispositivo la vea sin necesidad de recargar.
        try {
          if(data.hojaFirmasActiva) {
            const localHoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
            const fbHoja = data.hojaFirmasActiva;
            // Usar la hoja de Firebase si: no hay local, o la de Firebase es más reciente,
            // o tiene más firmas que la local
            const localFirmas  = localHoja  ? Object.values(localHoja.firmas  || {}).filter(f=>f&&f.data).length : -1;
            const fbFirmas     = Object.values(fbHoja.firmas || {}).filter(f=>f&&f.data).length;
            const fbPublicadoTs = new Date(fbHoja.publicado || 0).getTime();
            const localPubTs   = localHoja ? new Date(localHoja.publicado || 0).getTime() : 0;
            if(!localHoja || fbPublicadoTs >= localPubTs || fbFirmas > localFirmas) {
              localStorage.setItem('fc_hoja_firmas_activa', JSON.stringify(fbHoja));
              // Notificar al portal del instructor si está abierto
              if(typeof instCargarHojaFirmas === 'function') {
                const teniaHoja = !!localHoja;
                instCargarHojaFirmas();
                // Si acaba de aparecer la hoja (antes no había), avisar al instructor
                if(!teniaHoja && typeof instRenderFirmaTab === 'function') {
                  const panel = document.getElementById('inst-panel-firma');
                  if(panel && panel.style.display !== 'none') {
                    instRenderFirmaTab();
                    if(typeof showToast === 'function')
                      showToast('✍ Hoja de firmas disponible — ya puedes firmar', 'ok');
                  }
                }
              }
              // Actualizar indicador del coordinador si está visible
              if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
            }
          } else if(data.hasOwnProperty('hojaFirmasActiva') && !data.hojaFirmasActiva) {
            // El coordinador cerró la hoja — eliminarla en este dispositivo también
            localStorage.removeItem('fc_hoja_firmas_activa');
            if(typeof instCargarHojaFirmas === 'function') instCargarHojaFirmas();
            if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
          }
        } catch(e) { console.warn('Error sync hoja firmas:', e.message); }

        normalizarRegistros();

        // Persistir localmente sin actualizar fc_local_ts (fbReceiving=true lo evita)
        guardarLocal();

        // Re-renderizar sin volver a subir a Firebase
        _renderAllBase();
        renderRecorridos();
        if(document.getElementById('v-calendario')?.classList.contains('on')) renderCal();
        if(document.getElementById('v-historial')?.classList.contains('on'))  renderHistorial();
        if(document.getElementById('v-sup-plan')?.classList.contains('on'))    renderSupPlan();

        console.log('🔽 Firebase → local:',
          new Date().toLocaleTimeString('es-MX'),
          `| ${registros.length} registros | ${recorridos.length} recorridos`);
      } finally{
        fbReceiving = false;
      }
    });

    setIndicador('🟢 Firebase conectado');
    console.log('✅ Firebase inicializado');

  } catch(e){
    console.warn('Firebase error:', e.message);
    setIndicador('🟡 Sin Firebase · Solo datos locales');
  }
}

// ── Limpiar todos los datos ───────────────────
async function confirmarLimpiezaTotal(){
  const resp = prompt('⚠ ADVERTENCIA: Esta acción es irreversible.\nEscribe BORRAR para confirmar:');
  if(resp !== 'BORRAR'){ toast('Operación cancelada','info'); return; }

  instructores    = [];
  registros       = [];
  recorridos      = [];
  suplenciasPlan  = [];
  solicitudesInst = [];

  const keys = ['fc_instructores','fc_registros','fc_recorridos','fc_salones',
                 'fc_suplencias','fc_solicitudes','fc_ts','fc_local_ts'];
  keys.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });

  if(fbDb){
    try{
      await fbDb.ref('fitness').set({
        instructores:[], registros:{}, recorridos:{},
        salones, suplencias:{}, solicitudes:{}, ts: Date.now()
      });
    } catch(e){ console.warn('Error borrando Firebase:', e); }
  }

  renderAll();
  renderRecorridos();
  renderCal();
  toast('Todos los datos han sido eliminados. El sistema está limpio.','ok',5000);
}

// ── Helpers ───────────────────────────────────
function cargarScript(src){
  return new Promise((res, rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){ res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function setIndicador(txt){
  const el = document.getElementById('sync-indicator');
  if(el) el.innerHTML = txt;
}

// Indicador de estado en el header
// ═══════════════════════════════════════════
