// ═══════════════════════════════════════════════════════════════════
// Entorno de prueba: la app real en Chromium con un Firebase FALSO en memoria.
//
//  · Nada toca la base real: los scripts de Firebase (gstatic) se sustituyen por
//    un módulo falso cuyos datos viven aquí, en Node (FakeDB).
//  · Varias páginas = varios dispositivos (celular, compu, portal de una profesora)
//    que comparten la misma nube falsa, para probar guardados simultáneos.
//  · Un dispositivo se puede poner "sin señal": sus escrituras se encolan y se
//    aplican al reconectar, como hace el SDK real.
// ═══════════════════════════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function servidor() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const f = path.join(RAIZ, rel);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const clon = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const partes = p => String(p || '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

// ── Nube falsa ─────────────────────────────────────────────────────
class FakeDB {
  constructor() { this.data = {}; this.subs = []; }
  leer(p) {
    let n = this.data;
    for (const k of partes(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; }
    return n === undefined ? null : clon(n);
  }
  _poner(p, v) {
    const ks = partes(p);
    if (!ks.length) { this.data = (v && typeof v === 'object') ? clon(v) : {}; return; }
    let n = this.data;
    for (const k of ks.slice(0, -1)) { if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; }
    const u = ks[ks.length - 1];
    if (v === null || v === undefined) delete n[u]; else n[u] = clon(v);
  }
  sembrar(datos) { Object.entries(datos).forEach(([k, v]) => this._poner(k, v)); }
  aplicar(op) {
    if (op.op === 'set') this._poner(op.path, op.v);
    if (op.op === 'update') Object.entries(op.v || {}).forEach(([k, v]) => this._poner(partes(op.path).concat(partes(k)).join('/'), v));
  }
  async avisar(soloPagina) {
    for (const s of this.subs.slice()) {
      if (s.disp.sinSenal || (soloPagina && s.disp !== soloPagina)) continue;
      await s.disp.page.evaluate(([id, v]) => window.__fbFire && window.__fbFire(id, v), [s.id, this.leer(s.path)]).catch(() => {});
    }
  }
}

// Módulo que reemplaza firebase-app-compat.js dentro de la página
const FIREBASE_FALSO = `(function(){
  if (window.firebase && window.firebase.__falso) return;
  const subs = {}; let n = 0;
  const snap = (v, p) => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null,
    key: String(p).split('/').pop(), forEach(fn){ if (v && typeof v === 'object') Object.keys(v).forEach(k => fn(snap(v[k], p + '/' + k))); } });
  window.__fbFire = (id, v) => { const s = subs[id]; if (s) s.cb(snap(v, s.path)); };
  const op = (o, a) => window.__fbOp(o, a);
  function ref(p){
    p = String(p || '').replace(/^\\/+|\\/+$/g, '');
    return {
      on(ev, cb){
        if (p === '.info/connected') { setTimeout(() => cb(snap(true, p)), 0); return cb; }
        if (p === '.info/serverTimeOffset') { setTimeout(() => cb(snap(0, p)), 0); return cb; }
        const id = 's' + (++n); subs[id] = { cb, path: p }; cb.__fid = id; op('on', { id, path: p }); return cb;
      },
      off(ev, cb){ if (cb && cb.__fid) { delete subs[cb.__fid]; op('off', { id: cb.__fid }); } },
      once(ev, cb){ return op('get', { path: p }).then(v => { const s = snap(v, p); if (typeof cb === 'function') cb(s); return s; }); },
      set(v){ return op('set', { path: p, v: v === undefined ? null : JSON.parse(JSON.stringify(v)) }); },
      update(o){ return op('update', { path: p, v: JSON.parse(JSON.stringify(o)) }); },
      remove(){ return op('set', { path: p, v: null }); },
      push(v){ const r = ref(p + '/k' + Date.now() + Math.random().toString(36).slice(2, 6)); if (v !== undefined) r.set(v); return r; },
      child(k){ return ref(p + '/' + k); },
      transaction(fn){ return op('get', { path: p }).then(cur => { const nv = fn(cur); const fin = nv === undefined ? cur : nv;
        return op('set', { path: p, v: fin }).then(() => ({ committed: true, snapshot: snap(fin, p) })); }); }
    };
  }
  const db = { ref, goOnline(){}, goOffline(){} };
  const auth = { currentUser: { uid: 'prueba' }, onAuthStateChanged(cb){ setTimeout(() => cb(auth.currentUser), 0); return () => {}; },
    signInAnonymously: () => Promise.resolve({ user: auth.currentUser }), authStateReady: () => Promise.resolve() };
  const apps = [];
  window.firebase = { __falso: true, apps, initializeApp(cfg, name){ const a = { name: name || '[DEFAULT]', options: cfg, auth: () => auth, database: () => db }; apps.push(a); return a; },
    database: () => db, auth: () => auth };
})();`;

// Chart.js viene de un CDN; en las pruebas basta con un sustituto que no dibuja
const CHART_FALSO = `window.Chart = window.Chart || function(){ return { destroy(){}, update(){}, data:{ datasets:[] }, options:{} }; };
  window.Chart.register = () => {}; window.Chart.defaults = window.Chart.defaults || { font:{}, plugins:{ legend:{}, tooltip:{} } };`;

class Dispositivo {
  constructor(env, nombre) { this.env = env; this.nombre = nombre; this.sinSenal = false; this.cola = []; this.errores = []; }
  // Evalúa una función dentro de la app
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  async esperar(fn, arg, ms = 8000, que = 'condición') {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await this.ev(fn, arg).catch(() => false)) return true; await this.page.waitForTimeout(100); }
    throw new Error(`[${this.nombre}] tiempo agotado esperando: ${que}`);
  }
  // Deja que terminen subidas con espera (renderAll sube a los 800 ms)
  async calma(ms = 1800) { await this.page.waitForTimeout(ms); }
  async quitarSenal() { this.sinSenal = true; }
  async volverSenal() {
    this.sinSenal = false;
    const cola = this.cola; this.cola = [];
    for (const o of cola) this.env.db.aplicar(o);
    await this.env.db.avisar();
  }
}

async function crearEntorno() {
  const srv = await servidor();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const env = { db: new FakeDB(), dispositivos: [], base, browser };

  // Abre la app como un dispositivo. hora: momento "actual" (zona de México)
  env.abrir = async function (nombre, { hora, rol = 'admin', instId = null, local = null } = {}) {
    const d = new Dispositivo(env, nombre);
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'America/Mexico_City', locale: 'es-MX', hasTouch: true });
    const page = await ctx.newPage(); d.page = page; d.ctx = ctx;
    if (hora) { await page.clock.install({ time: new Date(hora) }); await page.clock.resume(); }
    page.on('pageerror', e => d.errores.push(e.message));
    await ctx.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith(base)) return r.continue();
      if (/gstatic\.com\/firebasejs\/.*firebase-app-compat/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: FIREBASE_FALSO });
      if (/gstatic\.com\/firebasejs\//.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
      return r.abort();
    });
    await page.addInitScript(([chart, loc]) => {
      eval(chart);
      if (loc && !sessionStorage.getItem('__sembrado')) {
        sessionStorage.setItem('__sembrado', '1');
        Object.entries(loc).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
      }
    }, [CHART_FALSO, local]);
    await page.exposeFunction('__fbOp', async (op, a) => {
      if (op === 'get') return env.db.leer(a.path);
      if (op === 'on') {
        const s = { id: a.id, path: a.path, disp: d }; env.db.subs.push(s);
        setTimeout(() => { if (!d.sinSenal) page.evaluate(([id, v]) => window.__fbFire && window.__fbFire(id, v), [s.id, env.db.leer(s.path)]).catch(() => {}); }, 0);
        return null;
      }
      if (op === 'off') { env.db.subs = env.db.subs.filter(s => !(s.disp === d && s.id === a.id)); return null; }
      const o = { op, path: a.path, v: a.v };
      if (d.sinSenal) { d.cola.push(o); return null; }   // el SDK la guarda y la manda al reconectar
      env.db.aplicar(o);
      await env.db.avisar();
      return null;
    });
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => typeof _loginExitoso === 'function' && typeof renderAll === 'function', null, { timeout: 15000 });
    await page.evaluate(([rol, instId]) => { _loginExitoso(rol, instId || undefined); }, [rol, instId]);
    // Espera a que llegue la primera respuesta de la nube (falsa)
    await d.esperar(() => typeof fbInicializado !== 'undefined' && fbInicializado === true, null, 15000, 'conexión con la nube');
    await page.waitForTimeout(400);
    env.dispositivos.push(d);
    return d;
  };

  env.cerrar = async function () {
    await browser.close().catch(() => {});
    await new Promise(r => srv.close(r));
  };
  return env;
}

module.exports = { crearEntorno, FakeDB };
