// ═══════════════════════════════════════════════════════════════════
// PRUEBAS FÍSICAS DE METODOLOGÍA  ↔  CONTROL GERENCIA
//
// Cuando el metodólogo activa una prueba en Control Gerencia (Metodología →
// Pruebas), este módulo la muestra en el portal del profesor de Fitness
// (pestaña "Pruebas" + aviso arriba) si alguna de sus clases pertenece a
// las áreas que el metodólogo eligió. El profesor la aplica aquí (prueba de
// Rufier con cronómetro) y el resultado se guarda directamente en la base de
// Gerencia, en el mismo lugar que usan los profesores de Gerencia, así que
// entra solo a los reportes de Metodología.
//
// Lee de Gerencia  (gerencia_deportes/…):
//   cfg/areas              áreas (para saber cuál es Fitness y repartir clases)
//   met/pruebas            pruebas activadas por Metodología
//   met/rufier/<pruebaId>  resultados (para contar "has evaluado")
// Escribe en Gerencia SOLO:
//   met/rufier/<pruebaId>/<clave>   un resultado por persona evaluada
//   (misma clave que usa Gerencia: area_nombre sin acentos ni espacios;
//    si la misma persona se evalúa otra vez, se reemplaza)
//
// El área de cada profesor se calcula igual que Control Gerencia reparte las
// clases de Fitness Control: por el nombre de la clase ("Gimnasia rítmica" →
// área Gimnasia); lo demás cae en el área vinculada a Fitness. Las áreas
// marcadas "100% manual" en Gerencia (fcExcluir) no se toman.
//
// Sin internet: el resultado queda en una cola del equipo y se sube solo.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CONFIG_GER = {
    apiKey: "AIzaSyDX1Vw-YaT0i7hN24r42VMGBPWwFGYAnQA",
    authDomain: "registro-gerencia.firebaseapp.com",
    databaseURL: "https://registro-gerencia-default-rtdb.firebaseio.com",
    projectId: "registro-gerencia",
    appId: "1:439284382620:web:fc12d9529900592d9ae659"
  };
  const DB_ROOT = 'gerencia_deportes';
  const FB_VER = '9.22.0';                       // misma versión que carga Fitness (firmas.js)
  const SRC_APP  = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`;
  const SRC_DB   = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`;
  const SRC_AUTH = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`;
  const COLA_KEY = 'fc_pruebas_cola';
  const CACHE_KEY = 'fc_pruebas_cache';

  const P = {
    db: null, iniciado: false, estado: 'off', msg: '',
    pruebas: {}, areas: {}, res: {},             // res: pruebaId → { clave: resultado }
    lisRes: {}, recibido: { pruebas: false, areas: false },
    ui: null, timer: null, audio: null, lock: null, enviando: false
  };

  // ── utilidades ───────────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const normNom = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rfKey = (aid, nombre) => `${aid}_${normNom(nombre).replace(/ /g, '')}`.slice(0, 80);     // igual que Control Gerencia
  const obj = v => (v && typeof v === 'object') ? v : {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  const toast = (m, t) => { try { showToast(m, t || 'ok'); } catch (e) {} };
  const root = () => document.getElementById('pruebas-root');
  const panelVisible = () => { const p = document.getElementById('inst-panel-pruebas'); return !!p && p.style.display !== 'none'; };
  const hoyStr = () => (typeof instCapHoy === 'function') ? instCapHoy() : fechaLocalStr(new Date());
  const pad = n => String(n).padStart(2, '0');
  const fmtF = f => { try { return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch (e) { return f || ''; } };

  function instActual() {
    if (typeof instructores === 'undefined' || typeof instActualId === 'undefined' || !instActualId) return null;
    return instructores.find(i => String(i.id) === String(instActualId)) || null;
  }
  const miId = () => { const i = instActual(); return i ? 'fc_p' + i.id : ''; };      // mismo id que usa Gerencia para los profesores que vienen de Fitness
  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // ── Firebase 'ger' (misma app que usa gimnasia-gerencia.js) ──────
  function cargar(src) {
    if (typeof cargarScript === 'function') return cargarScript(src);
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  // Fitness usa  firebase.apps[0]  como su base: se espera a que exista [DEFAULT] antes de crear otra app.
  async function getDb() {
    if (P.db) return P.db;
    await Promise.all([cargar(SRC_APP), cargar(SRC_DB)]);
    const tieneDef = () => firebase.apps.some(a => a.name === '[DEFAULT]');
    const t0 = Date.now();
    while (!tieneDef() && Date.now() - t0 < 12000) await sleep(250);
    const app = firebase.apps.find(a => a.name === 'ger') || firebase.initializeApp(CONFIG_GER, 'ger');
    try {                                         // las reglas de Gerencia exigen sesión: anónima, en SU proyecto
      await cargar(SRC_AUTH);
      const au = app.auth();
      const lista = typeof au.authStateReady === 'function' ? au.authStateReady() : new Promise(r => { const u = au.onAuthStateChanged(() => { u(); r(); }); });
      await Promise.race([lista, sleep(4000)]);
      if (!au.currentUser) await Promise.race([au.signInAnonymously(), timeout(6000)]);
    } catch (e) { console.warn('[Pruebas] Auth de Gerencia no disponible:', e && e.message); }
    P.db = app.database();
    return P.db;
  }

  // ── Áreas del profesor y pruebas que le tocan ────────────────────
  const areasLista = () => Object.values(obj(P.areas)).filter(a => a && a.id);
  const areaFitness = () => { const a = areasLista().find(x => x.vinculo); return a ? a.id : (P.areas.fitness ? 'fitness' : null); };
  const nombreArea = id => (obj(P.areas)[id] || {}).nombre || id;
  function areaPorClase(clase, fallback) {
    const d = norm(clase); if (!d) return fallback;
    const as = areasLista(), n = x => norm(x.nombre);
    const a = as.find(x => n(x) === d) || as.find(x => n(x) && d.includes(n(x)));
    return a ? a.id : fallback;
  }
  // Áreas de Gerencia donde este profesor tiene clases (reparto por nombre de clase, como en Control Gerencia)
  function misAreas() {
    const inst = instActual(), fit = areaFitness();
    if (!inst || !fit) return [];
    let slots = [];
    try { slots = typeof getHorarioEn === 'function' ? getHorarioEn(inst, hoyStr()) : (inst.horario || []); } catch (e) { slots = inst.horario || []; }
    const set = new Set();
    (slots || []).forEach(s => {
      if (!s || !s.clase) return;
      const aid = areaPorClase(s.clase, fit);
      if (!(obj(P.areas)[aid] || {}).fcExcluir) set.add(aid);
    });
    if (!set.size && !(obj(P.areas)[fit] || {}).fcExcluir) set.add(fit);       // sin clases cargadas: se asume Fitness
    return [...set];
  }
  function estadoPrueba(p) {                       // programada | activa | finalizada  (igual que Gerencia)
    const t = hoyStr();
    if (p.cerrada) return 'finalizada';
    if (p.fin && t > p.fin) return 'finalizada';
    if (p.inicio && t < p.inicio) return 'programada';
    return 'activa';
  }
  const todasPruebas = () => Object.values(obj(P.pruebas)).filter(p => p && p.id).sort((a, b) => (b.creado || 0) - (a.creado || 0));
  function pruebasMias(estado) {
    const mias = misAreas();
    return todasPruebas().filter(p => estadoPrueba(p) === estado && (p.areas || []).some(a => mias.includes(a)));
  }
  const areasEnComun = p => { const mias = misAreas(); return (p.areas || []).filter(a => mias.includes(a)); };

  // ── Resultados (los del servidor + los que aún están en cola) ────
  const leerCola = () => leer(COLA_KEY, []);
  function resDe(pid) {
    const r = Object.assign({}, obj(P.res[pid]));
    leerCola().forEach(x => { if (x.pid === pid) r[x.key] = x.rec; });
    return Object.values(r).filter(Boolean);
  }
  const misResultados = pid => resDe(pid).filter(r => r.aplicaId === miId()).sort((a, b) => String(b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
  const yaEvaluado = (pid, aid, nombre) => resDe(pid).find(r => r.aid === aid && rfKey(r.aid, r.nombre) === rfKey(aid, nombre)) || null;

  // ── Conexión y listeners ─────────────────────────────────────────
  function cargarCache() {
    const c = leer(CACHE_KEY, null);
    if (!c) return;
    P.pruebas = obj(c.pruebas); P.areas = obj(c.areas); P.res = obj(c.res);
  }
  function guardarCache() { guardarLS(CACHE_KEY, { pruebas: P.pruebas, areas: P.areas, res: P.res, ts: Date.now() }); }

  function alRecibir() {
    guardarCache();
    atarResultados();
    pintarAvisos();
    if (panelVisible() && !P.ui) pintarLista();
  }
  function atarResultados() {                      // un listener por prueba (solo las que hoy le tocan o ya terminaron con resultados suyos)
    if (!P.db) return;
    todasPruebas().forEach(p => {
      if (P.lisRes[p.id]) return;
      P.lisRes[p.id] = true;
      P.db.ref(`${DB_ROOT}/met/rufier/${p.id}`).on('value', s => { P.res[p.id] = s.val() || {}; guardarCache(); pintarAvisos(); if (panelVisible() && !P.ui) pintarLista(); }, () => {});
    });
  }
  async function iniciar() {
    if (P.iniciado) { pintarAvisos(); return; }
    P.iniciado = true; P.estado = 'conectando';
    cargarCache(); pintarAvisos();
    try {
      const db = await getDb();
      const falla = err => { P.estado = 'error'; P.msg = (err && err.message) || String(err); pintarAvisos(); if (panelVisible() && !P.ui) pintarLista(); };
      db.ref(`${DB_ROOT}/cfg/areas`).on('value', s => { P.areas = s.val() || {}; P.recibido.areas = true; P.estado = 'ok'; alRecibir(); }, falla);
      db.ref(`${DB_ROOT}/met/pruebas`).on('value', s => { P.pruebas = s.val() || {}; P.recibido.pruebas = true; P.estado = 'ok'; alRecibir(); }, falla);
      vaciarCola();
      window.addEventListener('online', () => { vaciarCola(); });
      setInterval(() => { vaciarCola(); pintarAvisos(); }, 60000);
    } catch (e) {
      P.estado = 'error'; P.msg = (e && e.message) || String(e); P.iniciado = false; pintarAvisos();
    }
  }

  // ── Cola de resultados por enviar ────────────────────────────────
  async function vaciarCola() {
    if (P.enviando) return 0;
    let cola = leerCola(); if (!cola.length) return 0;
    P.enviando = true; let n = 0;
    try {
      const db = await getDb();
      for (const it of cola.slice()) {
        // si Metodología eliminó la prueba mientras tanto, el resultado ya no tiene a dónde ir
        if (P.recibido.pruebas && !P.pruebas[it.pid]) { guardarLS(COLA_KEY, leerCola().filter(x => !(x.pid === it.pid && x.key === it.key))); continue; }
        try {
          await Promise.race([db.ref(`${DB_ROOT}/met/rufier/${it.pid}/${it.key}`).set(it.rec), timeout(9000)]);
          guardarLS(COLA_KEY, leerCola().filter(x => !(x.pid === it.pid && x.key === it.key)));
          (P.res[it.pid] = obj(P.res[it.pid]))[it.key] = it.rec; guardarCache();     // se ve de inmediato, sin esperar al listener
          n++;
        } catch (e) {
          if (/permission/i.test((e && e.message) || '')) { P.estado = 'error'; P.msg = 'Gerencia no permite guardar desde Fitness (revisa las reglas de Firebase de registro-gerencia).'; }
          break;                                   // sin señal o sin permiso: se reintenta después
        }
      }
    } catch (e) { /* sin conexión */ }
    P.enviando = false;
    if (n) { pintarAvisos(); if (panelVisible() && !P.ui) pintarLista(); }
    return n;
  }

  // ── Pestaña, insignia y aviso del portal ─────────────────────────
  function pintarAvisos() {
    const act = pruebasMias('activa');
    const btn = document.getElementById('inst-tabn-pruebas');
    const cola = leerCola().length;
    if (btn) btn.style.display = (act.length || P.ui || cola) ? '' : 'none';
    const b = document.getElementById('inst-pruebas-badge');
    if (b) { b.textContent = act.length; b.style.display = act.length ? 'flex' : 'none'; }
    const box = document.getElementById('inst-alertas');
    if (!box) return;
    let el = document.getElementById('ia-pruebas');
    if (!el) { el = document.createElement('div'); el.id = 'ia-pruebas'; box.appendChild(el); }
    const mostrar = act.length && !panelVisible() && !P.ui;
    const h = mostrar ? `<button class="ia-banner sup" data-ia="pruebas" aria-label="Prueba física por aplicar">
      <span class="ia-ico">💓</span>
      <span class="ia-txt"><div class="ia-t">Metodología pide aplicar ${act.length > 1 ? act.length + ' pruebas' : esc(act[0].nombre || 'la prueba de Rufier')}</div><div class="ia-s">Toca aquí para aplicarla a tus alumnos</div></span>
      <span class="ia-go">›</span></button>` : '';
    if (el.innerHTML !== h) el.innerHTML = h;
  }

  // ── CSS ──────────────────────────────────────────────────────────
  function inyectarCss() {
    if (document.getElementById('pf-css')) return;
    const st = document.createElement('style'); st.id = 'pf-css';
    st.textContent = `
#pruebas-root{font-family:'Outfit',sans-serif;color:var(--txt)}
.pf-card{background:var(--panel2);border:1px solid var(--border);border-radius:14px;padding:.9rem 1rem;margin-bottom:.7rem}
.pf-h2{font-family:'Bebas Neue',sans-serif;font-size:1.15rem;letter-spacing:2px;color:var(--neon);margin:.2rem 0 .6rem}
.pf-sub{font-size:.72rem;color:var(--txt2);line-height:1.4}
.pf-aviso{border-radius:12px;padding:.6rem .8rem;margin-bottom:.7rem;font-size:.74rem;line-height:1.35;border:1px solid rgba(232,184,75,.45);background:rgba(232,184,75,.12);color:var(--gold2)}
.pf-aviso.mal{border-color:rgba(224,80,80,.5);background:rgba(224,80,80,.12);color:var(--red2)}
.pf-row{display:flex;align-items:center;justify-content:space-between;gap:.7rem}
.pf-btn{display:block;width:100%;border:1px solid var(--border);background:var(--panel2);color:var(--txt);border-radius:11px;padding:12px;font:600 .85rem 'Outfit',sans-serif;cursor:pointer;margin-top:.5rem;-webkit-tap-highlight-color:transparent}
.pf-btn.cta{background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;border-color:transparent;font-weight:700;letter-spacing:.3px}
.pf-btn.sm{display:inline-block;width:auto;padding:8px 14px;font-size:.74rem;margin:0}
.pf-lbl{display:block;font-size:.62rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt3);margin:.6rem 0 .25rem}
.pf-in{width:100%;box-sizing:border-box;background:var(--panel);border:1px solid var(--border);border-radius:9px;color:var(--txt);padding:10px 11px;font:500 .9rem 'Outfit',sans-serif}
.pf-datos{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
.pf-res{display:flex;justify-content:space-between;gap:.6rem;padding:.5rem 0;border-top:1px solid var(--border);font-size:.78rem}
.pf-res:first-of-type{border-top:0}
.pf-res small{display:block;color:var(--txt3);font-size:.64rem;margin-top:1px}
.pf-pill{display:inline-block;border-radius:20px;padding:2px 9px;font-size:.62rem;font-weight:700;border:1px solid var(--border)}
.pf-pill.ok{color:var(--neon);border-color:rgba(94,255,160,.4)}.pf-pill.info{color:var(--blue);border-color:rgba(77,184,232,.4)}
.pf-pill.warn{color:var(--gold2);border-color:rgba(232,184,75,.5)}.pf-pill.bad{color:var(--red2);border-color:rgba(224,80,80,.5)}
.pf-h{text-align:center;margin:.2rem 0 .8rem}.pf-h b{display:block;font-size:1.25rem}.pf-h small{color:var(--txt2);font-size:.74rem}
.pf-big{background:var(--panel2);border:1px solid var(--border);border-radius:20px;padding:1.2rem .9rem;text-align:center;margin-bottom:.8rem}
.pf-etq{font-size:.68rem;font-weight:700;color:var(--txt2);letter-spacing:1.5px;text-transform:uppercase}
.pf-t{font-family:'DM Mono',monospace;font-size:5.2rem;font-weight:700;line-height:1.05;margin:.5rem 0 .7rem;color:var(--neon);font-variant-numeric:tabular-nums}
.pf-t.chico{font-size:2.8rem}.pf-big.pulso .pf-t{color:var(--red2)}.pf-big.prep .pf-t{color:var(--gold2)}
.pf-barra{height:9px;border-radius:99px;background:var(--panel);overflow:hidden;margin:0 6px}
.pf-barra i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--v2),var(--v3));transition:width .12s linear}
.pf-i{margin-top:.9rem;color:var(--txt2);font-size:.8rem;line-height:1.4}.pf-i.g{font-size:.92rem;margin:0}
.pf-tap{display:flex;flex-direction:column;align-items:center;justify-content:center;width:200px;height:200px;margin:.4rem auto 1rem;border-radius:50%;border:0;background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.35);touch-action:manipulation;user-select:none;-webkit-user-select:none;cursor:pointer}
.pf-tap:active{transform:scale(.96)}.pf-tap span{font-size:4.4rem;font-weight:700;line-height:1}.pf-tap small{font-size:.8rem;opacity:.9}
.pf-rep{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-top:.4rem}.pf-rep b{font-size:5.4rem;line-height:1;color:var(--neon)}.pf-rep span{font-size:1.4rem;color:var(--txt3)}
.pf-ind{font-family:'Bebas Neue',sans-serif;font-size:4.6rem;line-height:1.05;margin:.3rem 0}
.pf-ind.ok{color:var(--neon)}.pf-ind.info{color:var(--blue)}.pf-ind.warn{color:var(--gold2)}.pf-ind.bad{color:var(--red2)}
.pf-lpm{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 18px;margin-top:.8rem;color:var(--txt2);font-size:.8rem}.pf-lpm b{font-size:1.1rem;color:var(--txt)}
.pf-lpm small{flex-basis:100%;color:var(--txt3);font-size:.66rem}
.pf-pasos ol{margin:.4rem 0 .6rem 1.1rem;display:flex;flex-direction:column;gap:5px;color:var(--txt2);font-size:.78rem;line-height:1.4}
.pf-x{text-align:center;margin:.6rem 0 1rem}
`;
    document.head.appendChild(st);
  }

  // ═══════════════════════════════════════════════════════════════
  //  LISTA DE PRUEBAS
  // ═══════════════════════════════════════════════════════════════
  function clasifica(ind) {                        // Ruffier-Dickson (igual que Gerencia)
    if (ind <= 0) return { t: 'Excelente', c: 'ok', k: 'E' };
    if (ind <= 5) return { t: 'Muy buena', c: 'ok', k: 'MB' };
    if (ind <= 10) return { t: 'Buena', c: 'info', k: 'B' };
    if (ind <= 15) return { t: 'Regular', c: 'warn', k: 'R' };
    return { t: 'Mala', c: 'bad', k: 'M' };
  }
  const indice = (p0, p1, p2) => Math.round(p0 + p1 + p2 - 200) / 10;
  const FLEX_EDADES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const FLEX = { M: [10, 14, 15, 16, 22, 23, 27, 28, 34], F: [14, 18, 22, 23, 28, 29, 32, 33, 37] };
  function flexRef(sx, edad) {
    const v = FLEX[sx]; if (!v || !(edad > 0)) return null;
    if (edad <= 10) return v[0]; if (edad >= 90) return v[8];
    const i = Math.floor(edad / 10) - 1, f = (edad - (i + 1) * 10) / 10;
    return Math.round((v[i] + (v[i + 1] - v[i]) * f) * 10) / 10;
  }
  function flexEval(q) {
    if (!q || q.flex == null || q.flex === '') return null;
    const ref = flexRef(q.sexo, +q.edad); if (ref == null) return null;
    const dif = Math.round((+q.flex - ref) * 10) / 10; return { ref, dif, ok: dif >= 0 };
  }

  function pintarLista() {
    const r = root(); if (!r) return;
    inyectarCss();
    if (P.ui) { pintarPrueba(); return; }
    const act = pruebasMias('activa'), prog = pruebasMias('programada'), cola = leerCola();
    let h = '';
    if (P.estado === 'error') h += `<div class="pf-aviso mal">No se pudo conectar con Control Gerencia. ${esc(P.msg || '')}${P.pruebas && Object.keys(P.pruebas).length ? ' Se muestra la última copia guardada.' : ''}</div>`;
    else if (P.estado === 'conectando' && !Object.keys(obj(P.pruebas)).length) h += `<div class="pf-aviso">Buscando pruebas de Metodología…</div>`;
    if (cola.length) h += `<div class="pf-aviso">⏳ ${cola.length} resultado${cola.length > 1 ? 's' : ''} por enviar a Metodología. Se enviará${cola.length > 1 ? 'n' : ''} solo al volver la señal.</div>`;
    if (navigator.onLine === false) h += `<div class="pf-aviso">📡 Sin internet. Puedes aplicar la prueba: el resultado se envía cuando vuelva la señal.</div>`;
    if (!act.length) {
      h += `<div class="pf-card" style="text-align:center;padding:1.6rem 1rem"><div style="font-size:1.8rem">💓</div>
        <div style="font-weight:700;margin:.3rem 0">No hay pruebas activas para ti</div>
        <div class="pf-sub">Cuando Metodología deportiva active una prueba física para tu disciplina, aparecerá aquí.</div></div>`;
    }
    act.forEach(p => {
      const mios = misResultados(p.id), comun = areasEnComun(p);
      h += `<div class="pf-card">
        <div class="pf-row"><div><b style="font-size:.95rem">${esc(p.nombre || 'Prueba de Rufier')}</b>
          <div class="pf-sub">${esc(comun.map(nombreArea).join(', '))} · ${p.fin ? 'hasta el ' + esc(fmtF(p.fin)) : 'abierta hasta que Metodología la finalice'}</div></div>
          <span class="pf-pill ok">Activa</span></div>
        <div class="pf-sub" style="margin-top:.5rem">Metodología pide aplicarla a tus alumnos o socios. Has evaluado: <b>${mios.length}</b>.</div>
        <button class="pf-btn cta" data-pf="abrir" data-id="${esc(p.id)}">Aplicar prueba</button>
      </div>`;
      if (mios.length) {
        h += `<div class="pf-card"><div class="pf-h2" style="font-size:1rem;margin-top:0">Evaluados por ti</div>${mios.slice(0, 15).map(x => {
          const ind = +x.ind, c = clasifica(ind);
          return `<div class="pf-res"><div><b>${esc(x.nombre)}</b><small>${esc([nombreArea(x.aid), fmtF(x.fecha), x.hora].filter(Boolean).join(' · '))}</small></div>
            <div style="text-align:right"><b>${isNaN(ind) ? '—' : ind.toFixed(1)}</b><br><span class="pf-pill ${c.c}">${c.k} · ${c.t}</span></div></div>`;
        }).join('')}${mios.length > 15 ? `<div class="pf-sub" style="margin-top:.4rem">…y ${mios.length - 15} más.</div>` : ''}</div>`;
      }
    });
    if (prog.length) {
      h += `<div class="pf-h2">Programadas</div>` + prog.map(p => `<div class="pf-card"><div class="pf-row"><div><b>${esc(p.nombre || 'Prueba de Rufier')}</b>
        <div class="pf-sub">Empieza el ${esc(fmtF(p.inicio))}${p.fin ? ' · termina el ' + esc(fmtF(p.fin)) : ''}</div></div><span class="pf-pill info">Próxima</span></div></div>`).join('');
    }
    r.innerHTML = h;
  }
  function pruebasRenderTab() {
    const r = root(); if (!r) return;
    inyectarCss();
    if (!P.iniciado) iniciar();
    if (P.ui) pintarPrueba(); else pintarLista();
    pintarAvisos();
    vaciarCola();
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRUEBA DE RUFIER CON CRONÓMETRO
  //  Reposo 5 min → P0 (15 s) → 30 sentadillas en 45 s con metrónomo →
  //  P1 (15 s) → recuperación 30 s → P2 (15 s) → confirmar → resultado.
  //  Índice = ((P0 + P1 + P2) − 200) ÷ 10   (Ruffier-Dickson)
  // ═══════════════════════════════════════════════════════════════
  const RF = { REPOSO: 300, CONTEO: 15, PREP: 3, SENT: 45, REPS: 30, REC: 30 };
  const REF = [['0 o menos', 'Excelente (E)'], ['0.1 a 5', 'Muy buena (MB)'], ['5.1 a 10', 'Buena (B)'], ['10.1 a 15', 'Regular (R)'], ['Más de 15', 'Mala (M)']];
  const MS = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  const $ = id => document.getElementById(id);

  function beep(f, ms) {
    try {
      P.audio = P.audio || new (window.AudioContext || window.webkitAudioContext)();
      if (P.audio.state === 'suspended') P.audio.resume();
      const o = P.audio.createOscillator(), g = P.audio.createGain();
      o.frequency.value = f; o.type = 'sine'; g.gain.value = .25; o.connect(g); g.connect(P.audio.destination);
      o.start(); o.stop(P.audio.currentTime + ms / 1000);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(Math.min(ms, 120)); } catch (e) {}
  }
  async function pantalla(on) {                    // evita que el celular se apague durante la prueba
    try {
      if (on && navigator.wakeLock && !P.lock) { P.lock = await navigator.wakeLock.request('screen'); P.lock.addEventListener('release', () => { P.lock = null; }); }
      if (!on && P.lock) { await P.lock.release(); P.lock = null; }
    } catch (e) {}
  }
  function arriba() { const c = $('inst-content'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); }

  function abrirPrueba(pid) {
    const p = obj(P.pruebas)[pid]; if (!p) return;
    const areas = areasEnComun(p);
    if (!areas.length) { toast('Esta prueba no está asignada a tu disciplina', 'warn'); return; }
    P.ui = { pid, areas, aid: areas[0], fase: 'intro', nombre: '', sexo: '', edad: '', talla: '', peso: '', flex: '', p0: null, p1: null, p2: null, taps: 0, manual: false, q: null };
    pintarPrueba(); arriba(); pintarAvisos();
  }
  function leerCampos() {
    const R = P.ui; if (!R) return;
    [['pf_nombre', 'nombre'], ['pf_edad', 'edad'], ['pf_talla', 'talla'], ['pf_peso', 'peso'], ['pf_flex', 'flex'], ['pf_sexo', 'sexo'], ['pf_area', 'aid']].forEach(([id, k]) => { const e = $(id); if (e) R[k] = e.value; });
  }
  function fijaQuien() {
    const R = P.ui; if (!R) return false;
    if (R.q) return true;
    leerCampos();
    const nom = String(R.nombre).trim().replace(/\s+/g, ' ');
    if (!nom) { toast('Escribe el nombre de la persona', 'warn'); return false; }
    if (R.sexo !== 'M' && R.sexo !== 'F') { toast('Elige el sexo de la persona (M o F)', 'warn'); return false; }
    const num = (v, min, max) => { const x = parseFloat(String(v).replace(',', '.')); return (x >= min && x <= max) ? Math.round(x * 10) / 10 : null; };
    const ed = parseInt(R.edad, 10);
    R.q = { aid: R.aid, nombre: nom, sexo: R.sexo, edad: (ed > 0 && ed < 110) ? ed : null, talla: num(R.talla, 50, 250), peso: num(R.peso, 10, 300), flex: num(R.flex, -30, 80) };
    return true;
  }
  function salir() { clearInterval(P.timer); P.timer = null; pantalla(false); P.ui = null; pintarLista(); pintarAvisos(); arriba(); }

  function fase(nombre, seg, sigue) {              // arranca una fase cronometrada
    const R = P.ui; if (!R) return;
    clearInterval(P.timer);
    R.fase = nombre; R.fin = Date.now() + seg * 1000; R.seg = seg; R.rep = 0; R.taps = 0; R.sigue = sigue; R.ult = null;
    pintarPrueba();
    P.timer = setInterval(tick, 100);
    tick();
  }
  function tick() {
    const R = P.ui; if (!R || !R.fin) return;
    const resta = Math.max(0, R.fin - Date.now()), s = Math.ceil(resta / 1000);
    if (R.fase === 'sent') {                        // metrónomo: una sentadilla cada 1.5 s
      const rep = Math.min(RF.REPS, Math.floor((R.seg * 1000 - resta) / 1500) + 1);
      if (rep !== R.rep && resta > 0) { R.rep = rep; beep(rep % 2 ? 880 : 660, 90); const e = $('pf_rep'); if (e) e.textContent = rep; }
    } else if (R.fase === 'prep' || (resta > 0 && resta <= 3000 && ['reposo', 'rec'].includes(R.fase))) {
      if (R.ult !== s) { R.ult = s; beep(660, 80); }
    }
    const t = $('pf_t'); if (t) t.textContent = R.fase === 'reposo' || R.fase === 'rec' ? MS(s) : String(s);
    const b = $('pf_bar'); if (b) b.style.width = Math.max(0, Math.min(100, (R.seg * 1000 - resta) / (R.seg * 1000) * 100)) + '%';
    if (resta <= 0) { clearInterval(P.timer); P.timer = null; beep(1040, 350); const f = R.sigue; R.fin = 0; if (f) f(); }
  }
  const irReposo = () => { pantalla(true); fase('reposo', RF.REPOSO, irP0Listo); };
  function irP0Listo() { clearInterval(P.timer); P.timer = null; const R = P.ui; R.fase = 'p1listo'; R.fin = 0; pintarPrueba(); }
  const irP0 = () => fase('p1', RF.CONTEO, () => { const R = P.ui; R.p0 = R.taps * 4; R.fase = 'p1cap'; pintarPrueba(); });
  const irPrep = () => fase('prep', RF.PREP, () => fase('sent', RF.SENT, () => fase('p2', RF.CONTEO, () => { P.ui.p1 = P.ui.taps * 4;
    fase('rec', RF.REC, () => fase('p3', RF.CONTEO, () => { const R = P.ui; R.p2 = R.taps * 4; R.fase = 'cap'; pintarPrueba(); })); })));

  function guardarResultado() {
    const R = P.ui, p = obj(P.pruebas)[R.pid], inst = instActual(); if (!R || !inst) return;
    const g = id => Math.round(+($(id) || {}).value);
    const p0 = g('pf_p0'), p1 = g('pf_p1'), p2 = g('pf_p2');
    if ([p0, p1, p2].some(v => !(v >= 30 && v <= 240))) { toast('Cada pulso (ppm) debe estar entre 30 y 240 pulsaciones por minuto', 'warn'); return; }
    const ind = indice(p0, p1, p2), now = new Date(), q = R.q, key = rfKey(q.aid, q.nombre);
    const rec = { v: 2, id: key, pruebaId: R.pid, aid: q.aid, nombre: q.nombre, sexo: q.sexo, edad: q.edad || null,
      talla: q.talla == null ? null : q.talla, peso: q.peso == null ? null : q.peso, flex: q.flex == null ? null : q.flex,
      grupoId: '', grupo: '', p0, p1, p2, ind, fecha: hoyStr(), hora: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      aplicaId: miId(), aplica: inst.nombre, manual: !!R.manual, origen: 'fitness' };
    const cola = leerCola().filter(x => !(x.pid === R.pid && x.key === key));
    cola.push({ pid: R.pid, key, rec }); guardarLS(COLA_KEY, cola);
    R.p0 = p0; R.p1 = p1; R.p2 = p2; R.ind = ind; R.fase = 'fin'; pantalla(false);
    pintarPrueba(); arriba();
    vaciarCola().then(n => { if (n) toast('Resultado enviado a Metodología', 'ok'); else if (leerCola().length) toast('Resultado guardado en este equipo; se enviará al volver la señal', 'info'); });
  }

  function pintarPrueba() {
    const r = root(); if (!r || !P.ui) return;
    inyectarCss();
    const R = P.ui, p = obj(P.pruebas)[R.pid] || {}, f = R.fase;
    const cab = (tit, sub) => `<div class="pf-h"><b>${tit}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const salirBtn = `<div class="pf-x"><button class="pf-btn sm" data-pf="salir">${f === 'fin' ? 'Cerrar' : 'Cancelar prueba'}</button></div>`;
    const seg = () => Math.ceil(Math.max(0, R.fin - Date.now()) / 1000);
    const reloj = (etq, instr, tipo) => `<div class="pf-big ${tipo || ''}"><div class="pf-etq">${etq}</div><div class="pf-t" id="pf_t">${f === 'reposo' || f === 'rec' ? MS(seg()) : seg()}</div>
      <div class="pf-barra"><i id="pf_bar" style="width:0"></i></div><div class="pf-i">${instr}</div></div>`;
    const ppm = (id, l, v) => `<label class="pf-lbl" for="${id}">${l}</label><input class="pf-in" id="${id}" type="number" inputmode="numeric" min="30" max="240" value="${v == null ? '' : v}" placeholder="ppm">`;
    let c = '';
    if (f === 'intro') {
      const yaH = String(R.nombre).trim() ? yaEvaluado(R.pid, R.aid, R.nombre) : null;
      const num = (id, l, v, ph, st) => `<div><label class="pf-lbl" for="${id}">${l}</label><input class="pf-in" id="${id}" type="number" inputmode="decimal" step="${st || 1}" value="${esc(v)}" placeholder="${ph}"></div>`;
      c = `${cab(esc(p.nombre || 'Prueba de Rufier'), 'Test de Ruffier-Dickson · mide la resistencia cardíaca al esfuerzo y la capacidad de recuperación')}
        <div class="pf-h2">¿A quién se le aplica?</div>
        <div class="pf-card">
          ${R.areas.length > 1 ? `<label class="pf-lbl" for="pf_area">Disciplina</label><select class="pf-in" id="pf_area">${R.areas.map(a => `<option value="${esc(a)}"${a === R.aid ? ' selected' : ''}>${esc(nombreArea(a))}</option>`).join('')}</select>` : ''}
          <label class="pf-lbl" for="pf_nombre">Nombre y apellidos</label><input class="pf-in" id="pf_nombre" value="${esc(R.nombre)}" placeholder="Nombre y apellidos" autocomplete="off">
          <div class="pf-datos">
            <div><label class="pf-lbl" for="pf_sexo">Sexo</label><select class="pf-in" id="pf_sexo"><option value="">Elige…</option><option value="M"${R.sexo === 'M' ? ' selected' : ''}>M · Hombre</option><option value="F"${R.sexo === 'F' ? ' selected' : ''}>F · Mujer</option></select></div>
            ${num('pf_edad', 'Edad (años)', R.edad, 'Ej. 34')}${num('pf_talla', 'Talla (cm)', R.talla, 'Ej. 170')}${num('pf_peso', 'Peso (kg)', R.peso, 'Ej. 68', 0.1)}${num('pf_flex', 'Flexibilidad (cm)', R.flex, 'Ej. 15', 0.5)}
          </div>
          <div class="pf-sub" style="margin-top:.6rem">Talla, peso y flexibilidad son los datos de la tabla de captura de Metodología; si no los tienes, déjalos en blanco.</div>
        </div>
        <div class="pf-card pf-pasos"><b>Cómo se aplica</b><ol>
          <li><b>P0 · reposo.</b> La persona se sienta o acuesta y descansa <b>5 minutos</b> (el cronómetro los cuenta). Se miden sus pulsaciones por minuto (ppm): se cuentan 15 segundos y se multiplica por 4.</li>
          <li><b>Esfuerzo.</b> De pie, <b>30 flexiones y extensiones profundas de piernas en 45 segundos</b>, siguiendo el metrónomo.</li>
          <li><b>P1 · al finalizar.</b> De inmediato se miden sus ppm.</li>
          <li><b>P2 · un minuto después.</b> Transcurrido un minuto de acabadas las flexiones, se miden otra vez sus ppm.</li></ol>
          <div class="pf-sub">Índice = ((P0 + P1 + P2) − 200) ÷ 10. Pon el volumen del celular y déjalo donde lo veas. Es un examen previo a la actividad deportiva: si la persona tiene algún malestar o una enfermedad que restrinja el esfuerzo, no debe hacer la prueba.</div></div>
        ${yaH ? `<div class="pf-aviso">${esc(yaH.nombre)} ya tiene un resultado en esta prueba (índice ${(+yaH.ind).toFixed(1)}). Si la repites, se reemplaza.</div>` : ''}
        <button class="pf-btn cta" data-pf="comenzar">Comenzar con el reposo de 5 minutos</button>
        <button class="pf-btn" data-pf="saltar">Ya descansó: ir directo al primer conteo</button>
        <button class="pf-btn" data-pf="manual">Ya tengo los pulsos medidos: capturarlos sin cronómetro</button>${salirBtn}`;
    } else if (f === 'reposo') {
      c = `${cab('Reposo', 'Paso 1 de 6')}${reloj('Descansa sentado o acostado', 'Respira tranquilo. Al terminar empieza la medición de P0 (pulso en reposo).')}
        <button class="pf-btn" data-pf="saltar">Omitir el reposo</button>${salirBtn}`;
    } else if (f === 'p1listo') {
      c = `${cab('Pulso en reposo · P0', 'Paso 2 de 6')}<div class="pf-big"><div class="pf-i g">Busca el pulso (cuello o muñeca). Al presionar “Iniciar”, toca el círculo en cada latido durante 15 segundos.</div></div>
        <button class="pf-btn cta" data-pf="p0">Iniciar conteo de 15 s</button>${salirBtn}`;
    } else if (['p1', 'p2', 'p3'].includes(f)) {
      const n = { p1: 'Pulso en reposo · P0', p2: 'Pulso al finalizar · P1', p3: 'Pulso a 1 minuto · P2' }[f], paso = { p1: 'Paso 2 de 6', p2: 'Paso 4 de 6', p3: 'Paso 6 de 6' }[f];
      c = `${cab(n, paso)}${reloj('Toca en cada latido', 'Cuenta cada latido que sientas.', 'pulso')}
        <button class="pf-tap" data-pf="tap" aria-label="Contar un latido"><span id="pf_taps">${R.taps}</span><small>latidos</small></button>${salirBtn}`;
    } else if (f === 'p1cap') {
      c = `${cab('Pulso en reposo · P0', 'Confirma el pulso')}<div class="pf-card">${ppm('pf_p1c', 'Pulsaciones por minuto (ppm) en reposo', R.p0)}<div class="pf-sub" style="margin-top:.4rem">Los 15 segundos contados × 4. Si lo mediste de otra forma, corrígelo aquí.</div></div>
        <div class="pf-big"><div class="pf-i g">Ahora, de pie: <b>30 flexiones y extensiones profundas de piernas en 45 segundos</b>. Al presionar “Listo” hay una cuenta de 3 segundos y empieza el metrónomo.</div></div>
        <button class="pf-btn cta" data-pf="sentlisto">Listo: iniciar las flexiones</button>${salirBtn}`;
    } else if (f === 'prep') {
      c = `${cab('Prepárate', 'Flexiones de piernas')}${reloj('Empiezas en', 'De pie, con los pies al ancho de los hombros.', 'prep')}${salirBtn}`;
    } else if (f === 'sent') {
      c = `${cab('¡Flexiones!', 'Paso 3 de 6')}<div class="pf-big"><div class="pf-etq">Flexión profunda de piernas</div><div class="pf-rep"><b id="pf_rep">${R.rep || 1}</b><span>/ ${RF.REPS}</span></div>
        <div class="pf-t chico" id="pf_t">${seg()}</div><div class="pf-barra"><i id="pf_bar" style="width:0"></i></div>
        <div class="pf-i">Baja con cada sonido y sube en el siguiente. Al terminar, la medición de P1 empieza sola.</div></div>${salirBtn}`;
    } else if (f === 'rec') {
      c = `${cab('Recuperación', 'Paso 5 de 6')}${reloj('Descansa', 'Siéntate o acuéstate. Al cumplirse el minuto, la medición de P2 empieza sola.')}${salirBtn}`;
    } else if (f === 'cap') {
      c = `${cab(R.manual ? 'Captura de pulsos' : 'Confirma los pulsos', R.manual ? esc(R.q.nombre) : 'Pulsaciones por minuto (ppm)')}<div class="pf-card">
        ${ppm('pf_p0', 'P0 · ppm en reposo', R.p0)}${ppm('pf_p1', 'P1 · ppm al finalizar la actividad', R.p1)}${ppm('pf_p2', 'P2 · ppm después de un minuto de recuperación', R.p2)}
        <div class="pf-sub" style="margin-top:.5rem">${R.manual ? 'Escribe los pulsos por minuto de la tabla de captura.' : 'Si el conteo táctil no fue exacto, corrígelo aquí.'}</div></div>
        <button class="pf-btn cta" data-pf="guardar">Ver y guardar resultado</button>${salirBtn}`;
    } else if (f === 'fin') {
      const cl = clasifica(R.ind), q = R.q, fx = flexEval(q), pend = leerCola().some(x => x.pid === R.pid && x.key === rfKey(q.aid, q.nombre));
      c = `${cab('Resultado', 'Test de Ruffier-Dickson')}<div class="pf-big"><div class="pf-etq">${esc(q.nombre)}</div><div class="pf-ind ${cl.c}">${R.ind.toFixed(1)}</div><span class="pf-pill ${cl.c}">${cl.k} · ${cl.t}</span>
        <div class="pf-lpm"><span>P0 <b>${R.p0}</b></span><span>P1 <b>${R.p1}</b></span><span>P2 <b>${R.p2}</b></span><small>pulsaciones por minuto (ppm)</small></div>
        ${(q.talla != null || q.peso != null || q.flex != null) ? `<div class="pf-lpm">${q.talla != null ? `<span>Talla <b>${q.talla} cm</b></span>` : ''}${q.peso != null ? `<span>Peso <b>${q.peso} kg</b></span>` : ''}${q.flex != null ? `<span>Flexibilidad <b>${q.flex} cm</b></span>` : ''}</div>` : ''}
        ${fx ? `<div class="pf-aviso ${fx.ok ? '' : ''}" style="margin:.8rem 0 0;text-align:left">Flexibilidad: referencia para su sexo y edad ${fx.ref} cm · ${fx.ok ? 'en o sobre la referencia' : `por debajo de la referencia (${fx.dif} cm)`}</div>` : ''}</div>
        <div class="pf-aviso" style="${pend ? '' : 'display:none'}">⏳ Resultado guardado en este equipo; se enviará a Metodología al volver la señal.</div>
        <div class="pf-sub" style="text-align:center">Índice = ((P0 + P1 + P2) − 200) ÷ 10. ${REF.map(x => `${x[0]}: ${x[1]}`).join(' · ')}. Metodología deportiva interpreta el resultado.</div>
        <button class="pf-btn" data-pf="otro" data-id="${esc(R.pid)}">Aplicarla a otra persona</button>${salirBtn}`;
    }
    r.innerHTML = `<div style="max-width:560px;margin:0 auto">${c}</div>`;
  }

  // ── Eventos del panel ────────────────────────────────────────────
  document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('#pruebas-root [data-pf]') : null;
    if (!t) return;
    const a = t.dataset.pf, R = P.ui;
    switch (a) {
      case 'abrir': abrirPrueba(t.dataset.id); break;
      case 'otro': abrirPrueba(t.dataset.id); break;
      case 'salir': salir(); break;
      case 'comenzar': if (!fijaQuien()) return; beep(660, 60); irReposo(); break;
      case 'saltar':
        if (R && R.fase === 'intro' && !fijaQuien()) return;
        beep(660, 60); pantalla(true); clearInterval(P.timer); P.timer = null; irP0Listo(); break;
      case 'manual': if (!fijaQuien()) return; R.manual = true; R.p0 = R.p1 = R.p2 = null; R.fase = 'cap'; pintarPrueba(); arriba(); break;
      case 'p0': beep(660, 60); irP0(); break;
      case 'tap': if (!R || !R.fin) return; R.taps++; { const el = $('pf_taps'); if (el) el.textContent = R.taps; } try { if (navigator.vibrate) navigator.vibrate(15); } catch (er) {} break;
      case 'sentlisto': { const v = Math.round(+($('pf_p1c') || {}).value); if (v >= 30 && v <= 240) R.p0 = v; beep(660, 60); irPrep(); break; }
      case 'guardar': guardarResultado(); break;
    }
  });
  document.addEventListener('change', e => {            // guardar lo escrito al cambiar sexo / disciplina (se vuelve a pintar el aviso de "ya evaluado")
    if (!P.ui || P.ui.fase !== 'intro') return;
    if (e.target && ['pf_sexo', 'pf_area'].includes(e.target.id)) { leerCampos(); if (e.target.id === 'pf_area') pintarPrueba(); }
  });
  document.addEventListener('visibilitychange', () => {   // al volver a la app durante una fase, el reloj se pone al día
    if (document.visibilityState === 'visible' && P.ui && P.ui.fin) tick();
  });

  window.pruebasIniciar = iniciar;
  window.pruebasRenderTab = pruebasRenderTab;
  window.pruebasRefrescar = pintarAvisos;
})();
