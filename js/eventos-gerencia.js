// ═══════════════════════════════════════════════════════════════════
// EVENTOS ← CONTROL GERENCIA  (Gerencia → Fitness, SOLO LECTURA de Gerencia)
//
// Los eventos que la dirección captura en Control Gerencia (área vinculada con
// Fitness Control, la que tiene "vinculo") aparecen también en el calendario de
// eventos de Fitness: calendario de escritorio, "Próximos eventos" y la Agenda
// del celular. Se ven con la etiqueta "Gerencia" y se abren en solo lectura.
//
//  · NUNCA escribe en Gerencia ni guarda estos eventos en Fitness: no entran a
//    los KPIs, la lista ni las estadísticas de eventos de Fitness.
//  · Gerencia ya muestra los eventos de Fitness Control por su lado (vinculo.js
//    allá), y esos NO se guardan en data/<área>/eventos de Gerencia, así que no
//    se duplican de regreso.
//  · Se guarda una copia en el equipo para verlos sin internet.
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
  const DB_ROOT = 'gerencia_deportes';          // igual que DB_ROOT en Control Gerencia
  const AREA_DEF = 'fitness';                   // si Gerencia no tiene ninguna área marcada como vinculada
  const FB_VER = '9.22.0';
  const SRC_APP  = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`;
  const SRC_DB   = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-database-compat.js`;
  const SRC_AUTH = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`;
  const CACHE = 'fc_evt_gerencia_v1';
  const ESTADOS = ['planificado', 'realizado', 'cancelado', 'pospuesto'];

  const E = { iniciado: false, estado: 'off', msg: '', aid: '', lista: [], ref: null, t: null };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Los calendarios de Fitness arman HTML sin escapar: los textos de Gerencia se limpian aquí
  const limpio = s => String(s == null ? '' : s).replace(/[<>"'`\\]/g, '').trim();
  const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
  const hhmm = h => { const m = String(h || '').match(/(\d{1,2}):(\d{2})/); return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : ''; };

  function cargar(src) {
    if (typeof cargarScript === 'function') return cargarScript(src);
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  // Misma app 'ger' que usa gimnasia-gerencia.js (sesión anónima en el proyecto de Gerencia)
  async function getDb() {
    await Promise.all([cargar(SRC_APP), cargar(SRC_DB)]);
    const tieneDef = () => firebase.apps.some(a => a.name === '[DEFAULT]');
    const t0 = Date.now();
    while (!tieneDef() && Date.now() - t0 < 12000) await sleep(250);
    let app = firebase.apps.find(a => a.name === 'ger');
    if (!app) { try { app = firebase.initializeApp(CONFIG_GER, 'ger'); } catch (e) { app = firebase.apps.find(a => a.name === 'ger'); } }
    try {
      await cargar(SRC_AUTH);
      const au = app.auth();
      const lista = typeof au.authStateReady === 'function' ? au.authStateReady() : new Promise(r => { const u = au.onAuthStateChanged(() => { u(); r(); }); });
      await Promise.race([lista, sleep(4000)]);
      if (!au.currentUser) await Promise.race([au.signInAnonymously(), new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo')), 6000))]);
    } catch (e) { console.warn('[Eventos Gerencia] Auth de Gerencia no disponible:', e && e.message); }
    return app.database();
  }

  // Evento de Gerencia → forma de evento de Fitness (solo para mostrarse)
  function adaptar(raw) {
    const out = [];
    Object.entries(raw || {}).forEach(([k, e]) => {
      if (!e || typeof e !== 'object' || !fechaOk(e.fecha) || !e.nombre) return;
      const fin = fechaOk(e.fechaFin) && e.fechaFin > e.fecha ? e.fechaFin : '';
      out.push({
        id: 'ger_' + String(e.id || k).replace(/[^\w-]/g, '_'),
        ger: true,
        nombre: limpio(e.nombre),
        fecha: e.fecha,
        fechaFin: fin,
        horaIni: hhmm(e.hora),
        lugar: limpio(e.lugar),
        deporte: limpio(e.tipo) || 'Gerencia',
        estado: ESTADOS.includes(e.estado) ? e.estado : 'planificado',
        participantes: parseInt(e.participantes, 10) || 0,
        notas: String(e.notas || '')
      });
    });
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  function refrescar() {
    clearTimeout(E.t);
    E.t = setTimeout(() => {
      const visible = id => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
      try { if (visible('evtCalGrid') && typeof evtRenderCalendario === 'function') evtRenderCalendario(); } catch (e) {}
      try { if (visible('evtProxLista') && typeof evtRenderProximos === 'function') evtRenderProximos(); } catch (e) {}
      try { if (document.getElementById('ag-evt-lista') && typeof agEvtRenderLista === 'function') agEvtRenderLista(); } catch (e) {}
      try { if (document.getElementById('ag-cal-grid') && typeof renderAgendaCal === 'function') renderAgendaCal(); } catch (e) {}
    }, 200);
  }

  function desdeCache() {
    try { const c = JSON.parse(localStorage.getItem(CACHE)); if (c && Array.isArray(c.lista)) { E.lista = c.lista; E.aid = c.aid || ''; } } catch (e) {}
  }
  function aCache() {
    try { localStorage.setItem(CACHE, JSON.stringify({ ts: Date.now(), aid: E.aid, lista: E.lista })); } catch (e) {}
  }

  async function iniciar() {
    E.iniciado = true; E.estado = 'conectando';
    try {
      const db = await getDb();
      // El área de Gerencia vinculada con Fitness Control (la que tiene "vinculo")
      const sa = await db.ref(`${DB_ROOT}/cfg/areas`).once('value');
      const areas = sa.val() || {};
      const vinc = Object.values(areas).find(a => a && a.vinculo);
      E.aid = (vinc && vinc.id) || Object.keys(areas).find(k => areas[k] && areas[k].vinculo) || AREA_DEF;
      E.ref = db.ref(`${DB_ROOT}/data/${E.aid}/eventos`);
      E.ref.on('value', snap => {
        E.lista = adaptar(snap.val()); E.estado = 'ok'; E.msg = '';
        aCache(); refrescar();
      }, err => {
        E.estado = 'error'; E.msg = (err && err.message) || String(err);
        console.warn('[Eventos Gerencia] No se pudo leer:', E.msg);
        E.iniciado = false;                      // se reintenta en el siguiente ciclo
      });
    } catch (e) {
      E.estado = 'error'; E.msg = (e && e.message) || String(e);
      console.warn('[Eventos Gerencia] Error al conectar:', E.msg);
      setTimeout(() => { E.iniciado = false; }, 30000);
    }
  }

  // ── API para eventos.js y mobile.js ──────────────────────────────
  window.evtGerencia = () => E.lista.slice();
  window.evtGerenciaEstado = () => ({ estado: E.estado, msg: E.msg, area: E.aid, n: E.lista.length });

  // Ficha de solo lectura
  window.evtVerGerencia = function (id) {
    const e = E.lista.find(x => x.id === id); if (!e) return;
    const fmt = f => { try { return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (x) { return f; } };
    const fila = (l, v) => v ? `<div style="display:flex;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--border);font-size:.8rem"><div style="min-width:96px;color:var(--txt2)">${l}</div><div style="flex:1;color:var(--txt)">${v}</div></div>` : '';
    let ov = document.getElementById('ov-evt-ger');
    if (!ov) { ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'ov-evt-ger'; ov.addEventListener('click', ev => { if (ev.target === ov) ov.classList.remove('on'); }); document.body.appendChild(ov); }
    ov.innerHTML = `<div class="modal" style="max-width:460px">
      <button class="mcls" onclick="document.getElementById('ov-evt-ger').classList.remove('on')">✕</button>
      <div class="mttl">🏛 ${esc(e.nombre)}</div>
      <div style="font-size:.72rem;color:var(--txt2);margin:-.2rem 0 .8rem">Evento registrado en Control Gerencia · solo lectura</div>
      ${fila('Fecha', esc(fmt(e.fecha)) + (e.fechaFin ? ' al ' + esc(fmt(e.fechaFin)) : ''))}
      ${fila('Hora', esc(e.horaIni))}
      ${fila('Lugar', esc(e.lugar))}
      ${fila('Tipo', esc(e.deporte))}
      ${fila('Estado', esc(e.estado))}
      ${fila('Participantes', e.participantes ? esc(e.participantes) : '')}
      ${fila('Notas', esc(e.notas).replace(/\n/g, '<br>'))}
      <div style="font-size:.7rem;color:var(--txt3);margin-top:.8rem">Para cambiarlo o eliminarlo, hazlo en Control Gerencia (Agenda → Eventos).</div>
    </div>`;
    ov.classList.add('on');
  };

  desdeCache();
  // Arranca cuando hay sesión y Fitness ya conectó con su nube
  setInterval(() => {
    if (E.iniciado) return;
    if (typeof rolActual === 'undefined' || !rolActual) return;
    if (typeof fbDb === 'undefined' || !fbDb) return;
    if (typeof fbInicializado !== 'undefined' && !fbInicializado) return;
    iniciar();
  }, 2500);
  window.addEventListener('online', () => { if (E.estado === 'error') E.iniciado = false; });
})();
