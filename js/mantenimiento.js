// ═══════════════════════════════════════════════════════════════════
// MANTENIMIENTO — Reporte de equipo con falla desde el portal del instructor
// Conecta con la base de Firebase de "Control Mantenimiento" mediante una
// SEGUNDA app llamada 'mant'. No toca el nodo "fitness" ni la app por defecto.
//
// Escribe SOLO en:
//   reportes/{claveNueva}                      (alta, una clave por reporte)
//   reportes/{id}=null + historial/{id}={...}  (al eliminar un aviso resuelto,
//                                               en una sola actualización multi-ruta)
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CONFIG_MANT = {
    apiKey: "AIzaSyB_XzEY0fLuv9pNSAtf0tGSEZIDi2JG1SM",
    authDomain: "registro-mantenimiento-9854c.firebaseapp.com",
    databaseURL: "https://registro-mantenimiento-9854c-default-rtdb.firebaseio.com",
    projectId: "registro-mantenimiento-9854c",
    appId: "1:712713568770:web:a0e514012ecd34e9b8dd1b"
  };
  const FB_VER = '9.22.0';                       // misma versión que carga Fitness (firmas.js)
  const SRC_APP = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`;
  const SRC_DB  = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`;
  const LIMITE_H = { normal: 24, urgente: 4, fuera: 2 };   // horas sin atender → rojo
  const URG_TXT  = { normal: 'Normal', urgente: 'Urgente', fuera: 'No se puede usar' };
  const FALLAS   = ['No enciende', 'Ruido extraño', 'Flojo o roto', 'Falta pieza'];
  const COLA_KEY = 'fc_mant_cola';
  const CACHE_KEY = 'fc_mant_cache';

  const M = {
    db: null, conectando: null,
    salones: null, equipos: null,           // { id: {...} }  (solo lectura)
    reportes: {},                           // reportes del instructor { id: {...} }
    query: null, lis: null, profId: null,
    vista: 'reportar',                      // 'reportar' | 'mis'
    sel: null, todo: false, q: '',
    chips: [], texto: '', urg: 'normal',
    salonManual: null, eligiendoSalon: false,
    enviando: false, iniciado: false, timer: null
  };

  // ── utilidades ───────────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const compacto = s => norm(s).replace(/[^a-z0-9]/g, '');
  const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(t => t && t !== 'salon' && t !== 'sala');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'ok'); };
  const root = () => document.getElementById('mant-root');
  const panelVisible = () => { const p = document.getElementById('inst-panel-mant'); return !!p && p.style.display !== 'none'; };

  function instActual() {
    if (typeof instructores === 'undefined' || typeof instActualId === 'undefined') return null;
    return instructores.find(i => String(i.id) === String(instActualId)) || null;
  }
  function snapAObj(snap) { const o = {}; snap.forEach(ch => { o[ch.key] = ch.val(); }); return o; }
  function hace(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
  }

  // ── Firebase 'mant' ──────────────────────────────────────────────
  function cargar(src) {
    if (typeof cargarScript === 'function') return cargarScript(src);
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  // IMPORTANTE: Fitness hace  firebase.apps.length ? firebase.apps[0] : initializeApp(...)
  // Si 'mant' se creara ANTES que la app por defecto, Fitness quedaría apuntando a 'mant'.
  // Por eso se espera a que exista [DEFAULT] antes de crear 'mant'.
  async function getDb() {
    if (M.db) return M.db;
    if (!M.conectando) {
      M.conectando = (async () => {
        await Promise.all([cargar(SRC_APP), cargar(SRC_DB)]);
        const tieneDef = () => firebase.apps.some(a => a.name === '[DEFAULT]');
        if (typeof FIREBASE_ACTIVO !== 'undefined' && FIREBASE_ACTIVO) {
          const t0 = Date.now();
          while (!tieneDef() && Date.now() - t0 < 12000) await sleep(250);
        }
        const app = firebase.apps.find(a => a.name === 'mant') || firebase.initializeApp(CONFIG_MANT, 'mant');
        M.db = app.database();
        return M.db;
      })();
    }
    try { return await M.conectando; } catch (e) { M.conectando = null; throw e; }
  }

  // ── catálogo (salones y equipos, solo lectura) ───────────────────
  function leerCache() {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.salones && c.equipos) return c; } catch (e) {}
    return null;
  }
  async function cargarCatalogo(forzar) {
    if (M.salones && M.equipos && !forzar) return true;
    try {
      if (navigator.onLine === false) throw new Error('offline');
      const db = await getDb();
      const [s, e] = await Promise.all([
        Promise.race([db.ref('salones').once('value'), timeout(15000)]),
        Promise.race([db.ref('equipos').once('value'), timeout(15000)])
      ]);
      M.salones = snapAObj(s); M.equipos = snapAObj(e);
      try {
        const eqSinFoto = {};
        Object.keys(M.equipos).forEach(k => { const x = Object.assign({}, M.equipos[k]); delete x.foto; eqSinFoto[k] = x; });
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), salones: M.salones, equipos: eqSinFoto }));
      } catch (err) { /* cuota llena: se sigue sin caché */ }
      return true;
    } catch (err) {
      const c = leerCache();
      if (c) { M.salones = c.salones; M.equipos = c.equipos; return true; }
      return false;
    }
  }

  // ── salón de Fitness ↔ salón de Mantenimiento ────────────────────
  function matchSalonMant(nombreFit) {
    const arr = Object.keys(M.salones || {}).map(id => ({ id, nombre: (M.salones[id] || {}).nombre || '' }));
    if (!arr.length || !nombreFit) return null;
    const nf = compacto(nombreFit);
    let hit = arr.filter(s => compacto(s.nombre) === nf);            // sin acentos, mayúsculas ni espacios
    if (hit.length === 1) return hit[0];
    const A = tokens(nombreFit);
    if (!A.length) return null;
    hit = arr.filter(s => { const B = tokens(s.nombre); return B.length === A.length && B.every(t => A.includes(t)); });
    if (hit.length === 1) return hit[0];
    hit = arr.filter(s => { const B = tokens(s.nombre); return B.length && (A.every(t => B.includes(t)) || B.every(t => A.includes(t))); });
    return hit.length === 1 ? hit[0] : null;
  }

  // ── clase en curso (de 10 min antes del inicio hasta 60 min después) ──
  function claseEnCurso(inst, ahora) {
    const now = ahora || new Date();
    const fechaStr = fechaLocalStr(now);
    const dia = DIAS[(now.getDay() + 6) % 7];
    const min = now.getHours() * 60 + now.getMinutes();
    const slots = getHorarioEn(inst, fechaStr).filter(s => s.dia === dia);
    for (const s of slots) {
      const p = String(s.hora || '').split(':').map(Number);
      if (p.length < 2 || isNaN(p[0])) continue;
      const ini = p[0] * 60 + p[1];
      if (min >= ini - 10 && min < ini + 60) return s;
    }
    return null;
  }
  function contexto() {
    const inst = instActual();
    const enCurso = inst ? claseEnCurso(inst) : null;
    let salonId = null, salonNombre = null, nota = '';
    if (M.salonManual && M.salones && M.salones[M.salonManual]) {
      salonId = M.salonManual; salonNombre = M.salones[salonId].nombre;
    } else if (enCurso) {
      const sf = typeof getSalonDeClase === 'function' ? getSalonDeClase(enCurso.clase) : null;
      const ms = sf ? matchSalonMant(sf.nombre) : null;
      if (ms) { salonId = ms.id; salonNombre = ms.nombre; }
      else nota = sf ? `No encontré "${sf.nombre}" en la lista de mantenimiento.` : `La clase ${enCurso.clase} no tiene salón asignado.`;
    }
    return { inst, enCurso, clase: enCurso ? enCurso.clase : 'Fuera de clase', hora: enCurso ? enCurso.hora : '', salonId, salonNombre, nota };
  }

  // ── cola sin conexión (Fitness no tiene una, esta es propia) ─────
  const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA_KEY) || '[]'); } catch (e) { return []; } };
  const guardarCola = a => { try { localStorage.setItem(COLA_KEY, JSON.stringify(a)); } catch (e) {} };
  let vaciando = false;
  async function vaciarCola() {
    if (vaciando) return 0;
    if (!leerCola().length || navigator.onLine === false) return 0;
    vaciando = true; let enviados = 0;
    try {
      const db = await getDb();
      for (const it of leerCola()) {
        let cola = leerCola();
        const i = cola.findIndex(x => x.local === it.local);
        if (i < 0) continue;
        if (!cola[i].key) { cola[i].key = db.ref('reportes').push().key; guardarCola(cola); }
        const ref = db.ref('reportes/' + cola[i].key);
        // Solo escribe si la clave aún no existe → un reintento nunca pisa lo que el técnico ya completó
        await Promise.race([ref.transaction(cur => (cur === null ? it.rep : undefined), undefined, false), timeout(10000)]);
        guardarCola(leerCola().filter(x => x.local !== it.local));
        enviados++;
      }
    } catch (e) { console.warn('[Mant] cola pendiente:', e && e.message); }
    vaciando = false;
    return enviados;
  }

  // ── reportes del instructor (tiempo real) ────────────────────────
  const vencido = r => r && r.estado === 'nuevo' && (Date.now() - (r.creado || 0)) > (LIMITE_H[r.urg] || 24) * 3600000;
  function contadorRojo() {
    return Object.values(M.reportes).filter(r => r && (r.estado === 'resuelto' || vencido(r))).length;
  }
  function pintarBadge() {
    const b = document.getElementById('inst-mant-badge');
    if (!b) return;
    const n = contadorRojo();
    b.style.display = n > 0 ? 'flex' : 'none';
    b.textContent = n;
  }
  async function iniciarListener() {
    const inst = instActual();
    if (!inst) return;
    try {
      const db = await getDb();
      if (M.query && M.lis) M.query.off('value', M.lis);
      M.profId = inst.id;
      M.query = db.ref('reportes').orderByChild('profId').equalTo(inst.id);
      M.lis = M.query.on('value', snap => {
        M.reportes = snap.val() || {};
        pintarBadge();
        if (panelVisible()) { pintarSegmento(); if (M.vista === 'mis') pintarMis(); }
      }, err => console.warn('[Mant] listener:', err && err.message));
    } catch (e) { console.warn('[Mant] sin conexión al iniciar:', e && e.message); }
  }

  // ── arranque (lo llama el portal al abrir) ───────────────────────
  function mantIniciar() {
    const inst = instActual();
    if (!inst) return;
    if (M.profId !== null && String(M.profId) !== String(inst.id)) {   // otro instructor en el mismo equipo
      if (M.query && M.lis) { try { M.query.off('value', M.lis); } catch (e) {} }
      M.query = M.lis = null; M.reportes = {}; M.sel = null; M.chips = []; M.texto = ''; M.salonManual = null; M.profId = null;
    }
    inyectarCss();
    if (!M.iniciado) {
      M.iniciado = true;
      window.addEventListener('online', async () => { await vaciarCola(); await cargarCatalogo(true); iniciarListener(); if (panelVisible()) mantRenderTab(); });
      M.timer = setInterval(() => { pintarBadge(); if (panelVisible() && M.vista === 'mis') pintarMis(); if (leerCola().length) vaciarCola().then(n => { if (n && panelVisible()) mantRenderTab(); }); }, 60000);
    }
    setTimeout(async () => { await cargarCatalogo(); await vaciarCola(); iniciarListener(); }, 2500);
  }

  // ═════════════════ UI ═════════════════
  function inyectarCss() {
    if (document.getElementById('mant-css')) return;
    const st = document.createElement('style'); st.id = 'mant-css';
    st.textContent = `
#mant-root{font-family:'Outfit',sans-serif;padding-bottom:2rem}
.mant-seg{display:flex;gap:6px;margin-bottom:1rem}
.mant-seg button{flex:1;padding:10px 8px;border-radius:12px;border:1px solid var(--border);background:var(--panel2);color:var(--txt2);font:600 .76rem 'Outfit',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.mant-seg button.on{background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(94,255,160,.2)}
.mant-cnt{min-width:17px;height:17px;border-radius:9px;background:var(--red2);color:#fff;font-size:.58rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.mant-card{background:var(--panel2);border:1px solid var(--border);border-radius:14px;padding:.85rem 1rem;margin-bottom:.6rem}
.mant-ctx{border-color:rgba(94,255,160,.3);background:rgba(94,255,160,.06)}
.mant-lbl{font-size:.58rem;text-transform:uppercase;letter-spacing:2px;color:var(--txt3);margin:1rem 0 .5rem;display:flex;align-items:center;gap:6px}
.mant-lbl::after{content:'';flex:1;height:1px;background:var(--border)}
.mant-big{font-weight:700;font-size:.92rem;color:var(--txt1)}
.mant-sub{font-size:.7rem;color:var(--txt2);margin-top:2px}
.mant-link{background:none;border:none;color:var(--neon);font:600 .7rem 'Outfit',sans-serif;cursor:pointer;padding:6px 0;text-decoration:underline}
.mant-in{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--panel);color:var(--txt1);font:500 .85rem 'Outfit',sans-serif;outline:none}
.mant-in:focus{border-color:var(--v3)}
.mant-eq{display:flex;align-items:center;gap:.7rem;width:100%;text-align:left;padding:.65rem .8rem;border-radius:12px;border:1px solid var(--border);background:var(--panel2);color:var(--txt1);font:600 .82rem 'Outfit',sans-serif;cursor:pointer;margin-bottom:.4rem}
.mant-eq:active{border-color:var(--v3)}
.mant-eq img,.mant-ph{width:40px;height:40px;border-radius:9px;object-fit:cover;flex-shrink:0;background:var(--panel)}
.mant-ph{display:flex;align-items:center;justify-content:center;color:var(--txt3);font-size:1rem}
.mant-eq small{display:block;font-weight:500;font-size:.64rem;color:var(--txt3);margin-top:1px}
.mant-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:.6rem}
.mant-chip{padding:8px 13px;border-radius:20px;border:1px solid var(--border);background:var(--panel2);color:var(--txt2);font:600 .74rem 'Outfit',sans-serif;cursor:pointer}
.mant-chip.on{background:rgba(94,255,160,.14);border-color:var(--v3);color:var(--neon)}
.mant-urg{display:flex;gap:6px}
.mant-urg button{flex:1;padding:10px 4px;border-radius:12px;border:1px solid var(--border);background:var(--panel2);color:var(--txt2);font:600 .72rem 'Outfit',sans-serif;cursor:pointer}
.mant-urg button.on.normal{background:rgba(94,255,160,.14);border-color:var(--v3);color:var(--neon)}
.mant-urg button.on.urgente{background:rgba(232,184,75,.15);border-color:var(--gold2);color:var(--gold2)}
.mant-urg button.on.fuera{background:rgba(224,80,80,.14);border-color:var(--red2);color:var(--red2)}
.mant-send{width:100%;margin-top:1rem;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;font:700 .86rem 'Outfit',sans-serif;letter-spacing:.4px;cursor:pointer;box-shadow:0 4px 14px rgba(94,255,160,.18)}
.mant-send:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.mant-aviso{font-size:.7rem;color:var(--gold2);background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.25);border-radius:12px;padding:.55rem .8rem;margin-bottom:.6rem}
.mant-tag{display:inline-block;font-size:.62rem;font-weight:700;border-radius:10px;padding:2px 9px;background:var(--panel)}
.mant-rep{border-radius:14px;padding:.85rem 1rem;margin-bottom:.55rem;border:1px solid}
.mant-rep.nuevo{background:rgba(77,184,232,.07);border-color:rgba(77,184,232,.25)}
.mant-rep.rojo{background:rgba(224,80,80,.08);border-color:rgba(224,80,80,.4)}
.mant-rep.atencion{background:rgba(232,184,75,.08);border-color:rgba(232,184,75,.35)}
.mant-rep.resuelto{background:rgba(94,255,160,.08);border-color:rgba(94,255,160,.3)}
.mant-rep.cola{background:var(--panel2);border-color:var(--border);border-style:dashed}
.mant-diag{font-size:.72rem;color:var(--txt1);margin-top:6px;padding:.5rem .65rem;border-radius:10px;background:var(--panel)}
.mant-del{margin-top:.6rem;padding:9px 14px;border-radius:12px;border:1px solid var(--v3);background:transparent;color:var(--neon);font:700 .74rem 'Outfit',sans-serif;cursor:pointer}
.mant-vacio{text-align:center;color:var(--txt3);font-size:.8rem;padding:2rem 1rem}`;
    document.head.appendChild(st);
  }

  function mantRenderTab() {
    const r = root(); if (!r) return;
    inyectarCss();
    r.innerHTML = '<div id="mant-seg"></div><div id="mant-body"></div>';
    pintarSegmento();
    if (M.vista === 'mis') pintarMis(); else pintarReportar();
    if (!M.salones || !M.equipos) {
      cargarCatalogo().then(ok => { if (!panelVisible()) return; if (!ok) pintarSinCatalogo(); else if (M.vista === 'mis') pintarMis(); else pintarReportar(); });
    }
    if (!M.query) iniciarListener();
    vaciarCola().then(n => { if (n && panelVisible()) { toast('Reportes pendientes enviados', 'ok'); if (M.vista === 'mis') pintarMis(); } });
  }
  function pintarSegmento() {
    const s = document.getElementById('mant-seg'); if (!s) return;
    const n = contadorRojo();
    s.innerHTML = `<div class="mant-seg">
      <button data-act="vista" data-id="reportar" class="${M.vista === 'reportar' ? 'on' : ''}">🔧 Reportar equipo</button>
      <button data-act="vista" data-id="mis" class="${M.vista === 'mis' ? 'on' : ''}">📋 Mis reportes${n ? ` <span class="mant-cnt">${n}</span>` : ''}</button></div>`;
  }
  function pintarSinCatalogo() {
    const b = document.getElementById('mant-body'); if (!b) return;
    b.innerHTML = `<div class="mant-vacio">No pude cargar la lista de equipos.<br>Conéctate a internet una vez para descargarla.</div>`;
  }

  // ---- Reportar equipo ----
  function equiposVisibles(ctx) {
    const q = norm(M.q);
    return Object.keys(M.equipos || {}).map(id => Object.assign({ id }, M.equipos[id]))
      .filter(e => e && e.nombre)
      .filter(e => M.todo || (ctx.salonId != null && String(e.salonId) === String(ctx.salonId)))
      .filter(e => !q || norm(e.nombre).includes(q))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }
  function htmlEquipo(e) {
    const sal = M.salones && M.salones[e.salonId] ? M.salones[e.salonId].nombre : '';
    const foto = typeof e.foto === 'string' && /^(data:image|https?:)/.test(e.foto)
      ? `<img loading="lazy" src="${esc(e.foto)}" alt="">` : '<div class="mant-ph">🏋</div>';
    return `<button class="mant-eq" data-act="eq" data-id="${esc(e.id)}">${foto}<span>${esc(e.nombre)}${M.todo && sal ? `<small>${esc(sal)}</small>` : ''}</span></button>`;
  }
  function pintarLista() {
    const l = document.getElementById('mant-eq-list'); if (!l) return;
    const ctx = contexto(); const arr = equiposVisibles(ctx);
    l.innerHTML = arr.length ? arr.map(htmlEquipo).join('')
      : `<div class="mant-vacio">${M.q ? 'Sin resultados para esa búsqueda.' : 'No hay equipos registrados en este salón.'}</div>`;
  }
  function pintarReportar() {
    const b = document.getElementById('mant-body'); if (!b) return;
    if (!M.salones || !M.equipos) { b.innerHTML = '<div class="mant-vacio">Cargando equipos…</div>'; return; }
    const ctx = contexto();
    const cola = leerCola();
    let h = '';
    if (cola.length) h += `<div class="mant-aviso">⏳ ${cola.length} reporte${cola.length > 1 ? 's' : ''} por enviar. Se enviará${cola.length > 1 ? 'n' : ''} automáticamente al volver la señal.</div>`;
    if (navigator.onLine === false) h += `<div class="mant-aviso">📡 Sin internet. Puedes capturar el reporte: se enviará cuando vuelva la señal.</div>`;

    // Contexto: clase / salón
    if (ctx.salonId != null && !M.eligiendoSalon) {
      h += `<div class="mant-card mant-ctx"><div style="font-size:.6rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt3)">${ctx.enCurso ? 'Clase en curso' : 'Salón elegido'}</div>
        <div class="mant-big">${ctx.enCurso ? esc(ctx.clase) + (ctx.hora ? ' · ' + esc(ctx.hora) : '') : esc(ctx.salonNombre)}</div>
        ${ctx.enCurso ? `<div class="mant-sub">📍 ${esc(ctx.salonNombre)}</div>` : ''}
        <button class="mant-link" data-act="cambiarSalon">Cambiar salón</button></div>`;
    } else {
      const sals = Object.keys(M.salones).map(id => ({ id, n: (M.salones[id] || {}).nombre || id })).sort((a, b) => a.n.localeCompare(b.n, 'es'));
      h += `<div class="mant-card"><div class="mant-big">${ctx.enCurso ? esc(ctx.clase) + ' · ' + esc(ctx.hora) : 'No hay clase en curso'}</div>
        <div class="mant-sub">${esc(ctx.nota) || 'Elige el salón donde está el equipo.'}</div>
        <div class="mant-chips" style="margin:.6rem 0 0">${sals.map(s => `<button class="mant-chip" data-act="salon" data-id="${esc(s.id)}">${esc(s.n)}</button>`).join('') || '<span class="mant-sub">Sin salones disponibles.</span>'}</div></div>`;
      b.innerHTML = h; return;
    }

    const eq = M.sel && M.equipos[M.sel] ? Object.assign({ id: M.sel }, M.equipos[M.sel]) : null;
    h += '<div class="mant-lbl">1 · Equipo</div>';
    if (eq) {
      h += `<div class="mant-card">${htmlEquipo(eq).replace('data-act="eq"', 'data-act="noop"').replace('class="mant-eq"', 'class="mant-eq" style="margin:0 0 .3rem;cursor:default"')}
        <button class="mant-link" data-act="cambiarEq">Cambiar equipo</button></div>`;
    } else {
      h += `<input id="mant-q" class="mant-in" type="search" placeholder="🔍 Buscar equipo…" value="${esc(M.q)}" autocomplete="off" style="margin-bottom:.6rem">
        <div id="mant-eq-list"></div>
        <button class="mant-link" data-act="todo">${M.todo ? `← Ver solo equipos de ${esc(ctx.salonNombre)}` : 'Mi equipo no está en esta lista'}</button>`;
    }

    h += `<div class="mant-lbl">2 · ¿Qué falla tiene?</div><div class="mant-chips">${FALLAS.map(f => `<button class="mant-chip ${M.chips.includes(f) ? 'on' : ''}" data-act="chip" data-id="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <textarea id="mant-txt" class="mant-in" rows="3" placeholder="Describe la falla (opcional si elegiste una arriba)">${esc(M.texto)}</textarea>
      <div class="mant-lbl">3 · Urgencia</div>
      <div class="mant-urg">${['normal', 'urgente', 'fuera'].map(u => `<button class="${u} ${M.urg === u ? 'on' : ''}" data-act="urg" data-id="${u}">${URG_TXT[u]}</button>`).join('')}</div>
      <button id="mant-enviar" class="mant-send" data-act="enviar" disabled>Enviar a mantenimiento</button>`;
    b.innerHTML = h;
    if (!eq) pintarLista();
    pintarBoton();
  }
  function pintarBoton() {
    const btn = document.getElementById('mant-enviar'); if (!btn) return;
    const ctx = contexto();
    btn.disabled = M.enviando || !M.sel || ctx.salonId == null || !(M.chips.length || M.texto.trim());
    btn.textContent = M.enviando ? 'Enviando…' : 'Enviar a mantenimiento';
  }

  async function enviar() {
    if (M.enviando) return;
    const ctx = contexto(); const inst = ctx.inst;
    const eq = M.sel && M.equipos ? M.equipos[M.sel] : null;
    const desc = [M.chips.join(', '), M.texto.trim()].filter(Boolean).join('. ');
    if (!inst || !eq || ctx.salonId == null || !desc) return;
    M.enviando = true; pintarBoton();
    const rep = {
      equipoId: M.sel, desc, urg: M.urg, profId: inst.id, prof: inst.nombre, area: inst.esp || 'Fitness',
      clase: ctx.clase, salonId: ctx.salonId, otroLugar: String(eq.salonId) !== String(ctx.salonId),
      creado: Date.now(), estado: 'nuevo'
    };
    const cola = leerCola();
    cola.push({ local: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key: null, rep });
    guardarCola(cola);                                   // primero se guarda local; luego se intenta enviar
    M.sel = null; M.chips = []; M.texto = ''; M.urg = 'normal'; M.q = ''; M.todo = false;
    const n = await vaciarCola();
    M.enviando = false;
    toast(n ? 'Reporte enviado a mantenimiento' : 'Sin señal: el reporte se enviará al volver la conexión', n ? 'ok' : 'warn');
    M.vista = 'mis'; mantRenderTab();
  }

  // ---- Mis reportes ----
  function pintarMis() {
    const b = document.getElementById('mant-body'); if (!b) return;
    const inst = instActual(); if (!inst) return;
    const nombreEq = id => (M.equipos && M.equipos[id] && M.equipos[id].nombre) || 'Equipo';
    const nombreSal = id => (M.salones && M.salones[id] && M.salones[id].nombre) || '';
    const urgTag = r => r.urg && r.urg !== 'normal' ? `<span class="mant-tag" style="color:${r.urg === 'fuera' ? 'var(--red2)' : 'var(--gold2)'}">${esc(URG_TXT[r.urg])}</span>` : '';
    let h = '';
    const cola = leerCola().filter(x => String(x.rep.profId) === String(inst.id));
    cola.forEach(x => {
      h += `<div class="mant-rep cola"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="mant-big">${esc(nombreEq(x.rep.equipoId))}</div><span class="mant-tag" style="color:var(--gold2)">⏳ Por enviar</span></div>
        <div class="mant-sub">${esc(x.rep.desc)}</div></div>`;
    });
    const lista = Object.keys(M.reportes).map(id => Object.assign({ id }, M.reportes[id])).filter(r => r && r.estado)
      .sort((a, b) => (b.creado || 0) - (a.creado || 0));
    lista.forEach(r => {
      const rojo = vencido(r);
      const clase = r.estado === 'nuevo' ? (rojo ? 'rojo' : 'nuevo') : r.estado;
      let tag = '';
      if (r.estado === 'nuevo') tag = rojo ? `<span class="mant-tag" style="color:var(--red2)">⚠ Sin atender · más de ${LIMITE_H[r.urg] || 24} h</span>` : `<span class="mant-tag" style="color:var(--blue)">📨 Enviado · esperando técnico</span>`;
      else if (r.estado === 'atencion') tag = '<span class="mant-tag" style="color:var(--gold2)">🔧 En atención</span>';
      else if (r.estado === 'resuelto') tag = '<span class="mant-tag" style="color:var(--neon)">✔ Resuelto</span>';
      h += `<div class="mant-rep ${clase}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div class="mant-big">${esc(nombreEq(r.equipoId))}</div>${urgTag(r)}</div>
        <div class="mant-sub">${esc(r.desc)}</div>
        <div class="mant-sub" style="color:var(--txt3)">${esc(nombreSal(r.salonId))}${r.clase && r.clase !== 'Fuera de clase' ? ' · ' + esc(r.clase) : ''} · ${hace(Date.now() - (r.creado || Date.now()))}</div>
        <div style="margin-top:6px">${tag}</div>
        ${(r.estado === 'atencion' || r.estado === 'resuelto') && r.diag ? `<div class="mant-diag"><strong>Diagnóstico:</strong> ${esc(r.diag)}</div>` : ''}
        ${r.estado === 'resuelto' ? `<button class="mant-del" data-act="eliminar" data-id="${esc(r.id)}">Eliminar aviso</button>` : ''}
      </div>`;
    });
    b.innerHTML = h || '<div class="mant-vacio">No tienes reportes abiertos.<br>Cuando reportes un equipo aparecerá aquí.</div>';
  }
  async function eliminarAviso(id) {
    const r = M.reportes[id];
    if (!r || r.estado !== 'resuelto') return;
    if (navigator.onLine === false) { toast('Necesitas conexión para eliminar el aviso', 'warn'); return; }
    if (!confirm('¿Eliminar este aviso?\nQuedará guardado en el historial de mantenimiento.')) return;
    try {
      const db = await getDb();
      const upd = {};
      upd['reportes/' + id] = null;
      upd['historial/' + id] = Object.assign({}, r, { cerrado: Date.now() });
      await Promise.race([db.ref().update(upd), timeout(10000)]);   // multi-ruta, solo estas dos claves
      toast('Aviso eliminado', 'ok');
    } catch (e) { toast('No se pudo eliminar. Intenta de nuevo.', 'err'); }
  }

  // ---- eventos (delegados) ----
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('#mant-root [data-act]');
    if (!el) return;
    const id = el.dataset.id;
    switch (el.dataset.act) {
      case 'vista': M.vista = id; mantRenderTab(); break;
      case 'eq': M.sel = id; pintarReportar(); break;
      case 'cambiarEq': M.sel = null; pintarReportar(); break;
      case 'todo': M.todo = !M.todo; M.q = ''; pintarReportar(); break;
      case 'cambiarSalon': M.eligiendoSalon = true; M.sel = null; M.todo = false; M.q = ''; pintarReportar(); break;
      case 'salon': M.salonManual = id; M.eligiendoSalon = false; M.sel = null; M.todo = false; M.q = ''; pintarReportar(); break;
      case 'chip': M.chips = M.chips.includes(id) ? M.chips.filter(c => c !== id) : M.chips.concat(id); el.classList.toggle('on'); pintarBoton(); break;
      case 'urg': M.urg = id; document.querySelectorAll('#mant-root .mant-urg button').forEach(x => x.classList.toggle('on', x.dataset.id === id)); break;
      case 'enviar': enviar(); break;
      case 'eliminar': eliminarAviso(id); break;
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'mant-q') { M.q = e.target.value; pintarLista(); }
    else if (e.target.id === 'mant-txt') { M.texto = e.target.value; pintarBoton(); }
  });

  window.mantIniciar = mantIniciar;
  window.mantRenderTab = mantRenderTab;
})();
