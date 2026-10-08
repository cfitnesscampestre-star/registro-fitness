// ═══════════════════════════════════════════════════════════════════
// GIMNASIA ← CONTROL GERENCIA  (Gerencia → Fitness, SOLO LECTURA de Gerencia)
//
// Las profesoras de gimnasia (Jimena, Valeria, Sara) pasan lista en Control
// Gerencia (área Gimnasia). Este módulo LEE esos aforos y los guarda como
// registros normales de Fitness, para que entren a los reportes de Fitness.
//
//  · NUNCA escribe en Gerencia. Solo lee  gerencia_deportes/data/gimnasia/…
//  · Cada registro importado conserva el número de Gerencia aparte (asis_ger).
//  · Si coordinación corrige el aforo en Fitness, esa corrección se queda SOLO
//    en Fitness. Si después Gerencia trae otro número, aparece una observación
//    con los dos números: "Autorizar el de Gerencia" o "Dejar el mío"
//    (misma mecánica que el aforo del profe en captura-prof.js).
//  · Mientras coordinación no corrija nada, el registro sigue al de Gerencia.
//
// Campos que agrega a cada registro importado:
//   ger_id         id del aforo en Gerencia (grupoId_fecha) — también lo marca como importado
//   asis_ger       último número que trajo Gerencia (siempre se conserva aparte)
//   ger_aut        'autorizado' | 'descartado'   decisión de coordinación
//   ger_aut_val    el número de Gerencia sobre el que se decidió (si Gerencia cambia, se reabre)
//   asis_coord_prev  número que tenía coordinación antes de autorizar
//   origen         'gerencia'  (solo si el registro lo creó este módulo)
//
// Solo corre con la sesión de coordinación (rol admin), nunca en el portal del instructor.
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
  const DB_ROOT = 'gerencia_deportes';        // igual que DB_ROOT en Control Gerencia
  const AREA_ID = 'gimnasia';                 // id del área en Gerencia
  const FB_VER = '9.22.0';                    // misma versión que carga Fitness (firmas.js)
  const SRC_APP  = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`;
  const SRC_DB   = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`;
  const SRC_AUTH = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`;
  const FECHA_DESDE = '2026-10-06';           // solo se importan aforos de esta fecha en adelante; lo anterior queda tal cual
  // Nombre en Gerencia → nombre en Fitness (se compara sin acentos ni mayúsculas)
  const ALIAS = {
    'jimena areli soto': 'jimena soto',
    'sara ruiz velasco': 'sara ruiz',
    'valeria salas': 'valeria salas'
  };
  const ID_BASE = 900000000, ID_RANGO = 90000000;

  const G = {
    estado: 'off',                            // off | conectando | ok | error
    msg: '', ts: 0, db: null, iniciado: false,
    asis: null, grupos: null, profs: null,
    sinMatch: {},                             // nombre de profesora de Gerencia sin instructor en Fitness → nº de aforos
    omitidos: 0, ultimoCambio: 0,
    abierto: false, timer: null
  };

  // ── utilidades ───────────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  const num = v => parseInt(v, 10);
  const hayNum = v => v !== undefined && v !== null && v !== '' && !isNaN(parseInt(v, 10));
  const obj = v => (v && typeof v === 'object') ? v : {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const aviso = (m, t) => { try { showToast(m, t || 'info'); } catch (e) {} };
  const esAdmin = () => typeof rolActual !== 'undefined' && rolActual === 'admin';

  function cargar(src) {
    if (typeof cargarScript === 'function') return cargarScript(src);
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function hoyStr() { return fechaLocalStr(new Date()); }
  function restarDias(f, n) { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() - n); return fechaLocalStr(d); }
  function wdIdx(f) { const [y, m, d] = f.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; }   // lunes = 0
  function hhmm(h) { const m = String(h || '').match(/(\d{1,2}):(\d{2})/); return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : ''; }
  function minutos(h) { const m = hhmm(h).match(/(\d{2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function fechaCorta(f) {
    try { return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return f; }
  }

  // ── Firebase 'ger' (segunda/tercera app, solo lectura) ───────────
  // Igual que mantenimiento.js: se espera a que exista la app [DEFAULT] de Fitness
  // antes de crear otra, porque Fitness usa  firebase.apps[0]  como su base.
  async function getDb() {
    if (G.db) return G.db;
    await Promise.all([cargar(SRC_APP), cargar(SRC_DB)]);
    const tieneDef = () => firebase.apps.some(a => a.name === '[DEFAULT]');
    const t0 = Date.now();
    while (!tieneDef() && Date.now() - t0 < 12000) await sleep(250);
    const app = firebase.apps.find(a => a.name === 'ger') || firebase.initializeApp(CONFIG_GER, 'ger');
    // Las reglas de Gerencia exigen sesión: se usa sesión anónima en SU proyecto (no toca la de Fitness).
    try {
      await cargar(SRC_AUTH);
      const au = app.auth();
      const lista = typeof au.authStateReady === 'function' ? au.authStateReady() : new Promise(r => { const u = au.onAuthStateChanged(() => { u(); r(); }); });
      await Promise.race([lista, sleep(4000)]);
      if (!au.currentUser) await Promise.race([au.signInAnonymously(), new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo')), 6000))]);
    } catch (e) { console.warn('[Gimnasia] Auth de Gerencia no disponible:', e && e.message); }
    G.db = app.database();
    return G.db;
  }

  // ── Gerencia: grupo / profesora de cada aforo ────────────────────
  function profIdsDelDia(g, wd) {
    const pd = g && g.profDia;
    if (pd && typeof pd === 'object' && Object.keys(pd).length) return String(pd['d' + wd] || '').split(',').filter(Boolean);
    return g && g.profId ? [g.profId] : [];
  }
  function horaDelDia(g, wd) {
    const v = g && g.horDia && g.horDia['d' + wd];
    if (v) { const [a, b] = String(v).split('|'); return { hi: hhmm(a), hf: hhmm(b) }; }
    return { hi: hhmm(g && g.hi), hf: hhmm(g && g.hf) };
  }
  function instDePersona(nombre) {
    let n = norm(nombre); if (!n) return null;
    if (ALIAS[n]) { nombre = ALIAS[n]; n = norm(nombre); }
    const lista = (typeof instructores !== 'undefined' ? instructores : []).filter(i => typeof instActivo !== 'function' || instActivo(i));
    let hit = lista.filter(i => norm(i.nombre) === n);
    if (hit.length === 1) return hit[0];
    const A = tokens(nombre);
    if (!A.length) return null;
    hit = lista.filter(i => { const B = tokens(i.nombre); return A.every(t => B.includes(t)) || B.every(t => A.includes(t)); });
    return hit.length === 1 ? hit[0] : null;
  }

  // ── Importación (idempotente) ────────────────────────────────────
  function idDe(gerId) {
    const usados = new Map();
    registros.forEach(r => usados.set(String(r.id), r));
    let id = ID_BASE + (hash(gerId) % ID_RANGO);
    for (let i = 0; i < 50; i++, id++) {
      const o = usados.get(String(id));
      if (!o || o.ger_id === gerId) return id;
    }
    return (registros.reduce((m, r) => Math.max(m, parseInt(r.id) || 0), 0)) + 1;
  }

  function sincronizar() {
    if (!esAdmin() || !G.asis || !G.grupos) return;
    if (typeof registros === 'undefined' || typeof instructores === 'undefined') return;
    if (typeof fbInicializado !== 'undefined' && !fbInicializado) return;      // primero lo que hay en la nube

    const grupos = obj(G.grupos), profs = obj(G.profs), asis = obj(G.asis);
    const desde = FECHA_DESDE, hoy = hoyStr();
    const porGer = new Map();
    registros.forEach(r => { if (r.ger_id) porGer.set(r.ger_id, r); });
    const sinMatch = {}; let omitidos = 0, cambios = 0, nuevos = 0, ahora = Date.now();

    Object.keys(asis).forEach(k => {
      const a = asis[k];
      if (!a || !a.fecha || a.omitida || a.fecha < desde || a.fecha > hoy) return;
      const g = grupos[a.grupoId]; if (!g) return;
      if (!hayNum(a.asistentes)) return;
      const gerId = String(a.id || k), nGer = Math.max(0, num(a.asistentes));
      const wd = wdIdx(a.fecha), h = horaDelDia(g, wd);

      let r = porGer.get(gerId);
      if (r) {                                              // ya importado: seguir a Gerencia salvo que coordinación lo haya corregido
        const corregido = hayNum(r.asis_ger) && num(r.asistentes) !== num(r.asis_ger);
        let cambio = false;
        if (!corregido && num(r.asistentes) !== nGer) { r.asistentes = nGer; cambio = true; }
        if (num(r.asis_ger) !== nGer || !hayNum(r.asis_ger)) { r.asis_ger = nGer; cambio = true; }
        if (cambio) { r.updatedAt = ahora++; cambios++; }
        return;
      }

      // profesora que dio la clase ese día
      const ids = profIdsDelDia(g, wd);
      const pid = (a.porProf && ids.includes(a.porProf)) ? a.porProf : ids[0];
      const nombreProf = (profs[pid] && profs[pid].nombre) || a.porNom || g.prof || '';
      const inst = instDePersona(nombreProf);
      if (!inst) { const nm = nombreProf || '(sin profesora)'; sinMatch[nm] = (sinMatch[nm] || 0) + 1; omitidos++; return; }

      const clase = String(g.nombre || 'Gimnasia');
      const dia = DIAS[wd], hora = h.hi || '00:00';

      // ¿ya existe un registro de Fitness de esa misma clase (capturado antes por coordinación)? → se adopta
      const previo = registros.find(x => !x.ger_id && x.inst_id === inst.id && x.fecha === a.fecha &&
        norm(x.clase) === norm(clase) && hhmm(x.hora) === hora && (x.estado === 'ok' || x.estado === 'sub' || x.estado === 'falta'));
      if (previo) {
        if (previo.estado === 'falta') { omitidos++; return; }        // coordinación la marcó como falta: no se toca
        previo.ger_id = gerId; previo.asis_ger = nGer; previo.updatedAt = ahora++;
        porGer.set(gerId, previo); cambios++; return;
      }

      const dur = (minutos(h.hf) != null && minutos(h.hi) != null && minutos(h.hf) > minutos(h.hi)) ? minutos(h.hf) - minutos(h.hi) : 60;
      const cap = parseInt(g.cupo, 10) > 0 ? parseInt(g.cupo, 10) : (typeof getCapClase === 'function' ? getCapClase(clase) : 20);
      const nuevo = {
        id: idDe(gerId), inst_id: inst.id, dia, clase, hora, asistentes: nGer, cap, dur,
        estado: 'ok', fecha: a.fecha, tipo: 'clase', captura_por: 'ger',
        suplente_id: null, motivo_suplencia: null, motivo_falta: null,
        ger_id: gerId, asis_ger: nGer, origen: 'gerencia', updatedAt: ahora++
      };
      registros.push(nuevo); porGer.set(gerId, nuevo); nuevos++; cambios++;
    });

    G.sinMatch = sinMatch; G.omitidos = omitidos; G.ts = Date.now();
    if (cambios) {
      G.ultimoCambio = Date.now();
      try { renderAll(); } catch (e) { console.warn('[Gimnasia] renderAll', e); }   // guarda y sincroniza como cualquier edición
      if (nuevos) aviso(`Gimnasia: ${nuevos} aforo(s) nuevo(s) traído(s) de Gerencia.`, 'ok');
    }
    pintar();
  }

  // ── Conexión ─────────────────────────────────────────────────────
  function programar() { clearTimeout(G.timer); G.timer = setTimeout(sincronizar, 400); }

  async function iniciar() {
    if (G.iniciado) return;
    G.iniciado = true; G.estado = 'conectando'; pintar();
    try {
      const db = await getDb();
      const base = `${DB_ROOT}/data/${AREA_ID}`;
      const rx = { asistencia: false, grupos: false };
      const recibe = (clave, destino) => snap => {
        G[destino] = snap.val() || {}; rx[clave] = true;
        if (rx.asistencia && rx.grupos) { G.estado = 'ok'; G.msg = ''; programar(); }
      };
      const falla = err => { G.estado = 'error'; G.msg = (err && err.message) || String(err); pintar(); };
      db.ref(`${base}/asistencia`).on('value', recibe('asistencia', 'asis'), falla);
      db.ref(`${base}/grupos`).on('value', recibe('grupos', 'grupos'), falla);
      db.ref(`${base}/profesores`).on('value', s => { G.profs = s.val() || {}; programar(); }, () => { G.profs = {}; });
    } catch (e) {
      G.estado = 'error'; G.msg = (e && e.message) || String(e); G.iniciado = false; pintar();
    }
  }

  // ── Observaciones: el aforo de Gerencia es distinto al de coordinación ─
  function pendientes() {
    if (typeof registros === 'undefined') return [];
    return registros.filter(r =>
      r.ger_id && hayNum(r.asis_ger) && r.estado !== 'falta' &&
      num(r.asistentes) !== num(r.asis_ger) &&
      !(r.ger_aut && num(r.ger_aut_val) === num(r.asis_ger))
    ).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''));
  }

  window.gerObsToggle = function () { G.abierto = !G.abierto; pintar(); };

  window.gerObsResolver = function (id, decision) {
    if (!esAdmin()) return;
    const r = registros.find(x => String(x.id) === String(id));
    if (!r || !hayNum(r.asis_ger)) { pintar(); return; }
    const gerN = num(r.asis_ger), mio = num(r.asistentes) || 0;
    if (decision === 'autorizado') {
      if (!confirm(`¿Usar el aforo de Gerencia (${gerN}) en ${r.clase} (${r.hora})?\nTu número (${mio}) será reemplazado en Fitness.`)) return;
      r.asis_coord_prev = mio;
      r.asistentes = gerN;
    }
    r.ger_aut = decision; r.ger_aut_val = gerN;
    r.updatedAt = Date.now();
    try { renderAll(); } catch (e) {}
    try { registrarLog('clase', `Aforo de Gerencia ${decision === 'autorizado' ? 'autorizado' : 'descartado'} · ${r.clase} · ${r.fecha} ${r.hora} · Gerencia ${gerN} / Fitness ${mio}`); } catch (e) {}
    aviso(decision === 'autorizado' ? `Autorizado: ahora son ${gerN} personas.` : `Se mantiene tu número (${mio}).`, 'ok');
  };

  window.gerSincronizarAhora = function () {
    if (!esAdmin()) return;
    if (!G.iniciado) { iniciar(); aviso('Conectando con Gerencia…', 'info'); return; }
    if (G.estado === 'error') { G.iniciado = false; iniciar(); return; }
    const antes = registros.length;
    sincronizar();
    aviso(G.estado === 'ok' ? 'Gimnasia actualizada desde Gerencia.' : 'Todavía conectando con Gerencia…', G.estado === 'ok' ? 'ok' : 'info');
    return antes;
  };

  // ── Tarjeta ──────────────────────────────────────────────────────
  function nombreInst(r) {
    const i = (typeof instructores !== 'undefined' ? instructores : []).find(x => String(x.id) === String(r.inst_id));
    return i ? i.nombre : 'Profesora';
  }
  function html() {
    if (!esAdmin()) return '';
    const lista = pendientes(), sm = Object.keys(G.sinMatch);
    const err = G.estado === 'error';
    if (!lista.length && !sm.length && !err) return '';
    const filas = lista.map(r => {
      const mio = num(r.asistentes) || 0, ger = num(r.asis_ger) || 0, dif = ger - mio;
      return `<div class="op-row">
        <div class="op-top"><b>${esc(r.clase)}</b> · ${esc(r.hora)} · ${esc(fechaCorta(r.fecha))}</div>
        <div class="op-prof">${esc(nombreInst(r))}</div>
        <div class="op-nums">
          <span>Tu conteo <b>${mio}</b></span><span class="op-arr">→</span>
          <span>Gerencia <b>${ger}</b> <i>(${dif > 0 ? '+' : ''}${dif})</i></span>
        </div>
        <div class="op-btns">
          <button type="button" class="op-no" onclick="gerObsResolver(${Number(r.id)},'descartado')">Dejar mi número</button>
          <button type="button" class="op-si" onclick="gerObsResolver(${Number(r.id)},'autorizado')">Autorizar ${ger}</button>
        </div>
      </div>`;
    }).join('');
    const avisos = [];
    if (err) avisos.push(`<div class="op-nota">No se pudo leer Gerencia: ${esc(G.msg)}. Revisa las reglas de Firebase del proyecto registro-gerencia.</div>`);
    if (sm.length) avisos.push(`<div class="op-nota">Sin instructor en Fitness con ese nombre (no se importaron): ${sm.map(n => `${esc(n)} (${G.sinMatch[n]})`).join(', ')}. Escribe el nombre igual que en Gerencia.</div>`);
    const total = lista.length + (err || sm.length ? 1 : 0);
    return `<div class="op-wrap">
      <button type="button" class="op-head" onclick="gerObsToggle()" aria-expanded="${G.abierto}">
        <span class="op-t">Gimnasia · aforo de Gerencia distinto al tuyo</span>
        <span class="op-n">${lista.length || '!'}</span>
        <span class="op-chev">${G.abierto ? '▴' : '▾'}</span>
      </button>
      <div class="op-body" ${G.abierto ? '' : 'hidden'}>
        ${filas}${avisos.join('')}
        <div class="op-btns"><button type="button" class="op-no" onclick="gerSincronizarAhora()">Actualizar desde Gerencia</button></div>
      </div>
    </div>`;
  }
  function contenedores() {
    const out = [];
    let m = document.getElementById('ger-obs-mob');
    if (!m) {
      const ref = document.getElementById('mob-obs-prof');
      if (ref && ref.parentNode) { m = document.createElement('div'); m.id = 'ger-obs-mob'; ref.parentNode.insertBefore(m, ref.nextSibling); }
    }
    if (m) out.push(m);
    let d = document.getElementById('ger-obs-dash');
    if (!d) {
      const v = document.getElementById('v-dashboard');
      if (v) { d = document.createElement('div'); d.id = 'ger-obs-dash'; v.insertBefore(d, v.firstChild); }
    }
    if (d) out.push(d);
    return out;
  }
  function pintar() {
    try { const h = html(); contenedores().forEach(c => { c.innerHTML = h; }); } catch (e) {}
  }

  // La tarjeta se refresca cuando llegan datos nuevos o se abre la pantalla "Hoy"
  const _renderAllPrev = window.renderAll;
  if (typeof _renderAllPrev === 'function') {
    window.renderAll = function () { const r = _renderAllPrev.apply(this, arguments); try { pintar(); } catch (e) {} return r; };
  }
  const _mobHomePrev = window.renderMobileHome;
  if (typeof _mobHomePrev === 'function') {
    window.renderMobileHome = function () { const r = _mobHomePrev.apply(this, arguments); try { pintar(); } catch (e) {} return r; };
  }

  // Arranca solo cuando hay sesión de coordinación y Fitness ya conectó con su nube
  setInterval(() => {
    if (G.iniciado || !esAdmin()) return;
    if (typeof fbDb === 'undefined' || !fbDb) return;
    if (typeof fbInicializado !== 'undefined' && !fbInicializado) return;
    iniciar();
  }, 2500);
  // Respaldo: al volver a abrir la app o recuperar internet se revisa de nuevo
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && G.estado === 'ok') programar(); });
  window.addEventListener('online', () => { if (G.estado === 'error') { G.iniciado = false; } });

  const st = document.createElement('style');
  st.id = 'ger-style';
  st.textContent = '#ger-obs-mob:empty,#ger-obs-dash:empty{display:none}#ger-obs-dash{margin-bottom:.8rem}';
  document.head.appendChild(st);
})();
