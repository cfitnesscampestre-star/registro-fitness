/* ═══════════════════════════════════════════════════════════════
   instalar-app.js — Guía para instalar Fitness Control en el celular.
   · iPhone (Safari): pasos Compartir → Agregar a inicio.
   · iPhone dentro de WhatsApp / Instagram / Facebook / Chrome: "Ábrela en Safari" + Copiar enlace.
   · Android (Chrome): botón "Instalar" con el aviso nativo del navegador.
   · Android dentro de otra app: "Ábrela en Chrome" + Copiar enlace.
   · Se muestra sola la primera vez que se abre el enlace (pantalla de acceso) y después queda
     el botón "Instala la app en tu celular". Si la app ya está instalada, no aparece nada.
   · "No volver a mostrar este aviso" lo oculta definitivamente en ese celular.
   Solo es interfaz: no toca sesión, PIN ni datos.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var K_NO = 'fc_inst_app_nomostrar';   // el usuario pidió no verlo más
  var K_VISTO = 'fc_inst_app_visto';    // ya se mostró solo una vez
  var K_HECHO = 'fc_inst_app_hecho';    // ya la instaló
  var ua = navigator.userAgent || '';
  var promptEvt = null;

  function ls(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  function get(k) { return ls(function (s) { return s.getItem(k); }); }
  function set(k, v) { ls(function (s) { s.setItem(k, v); }); }

  var esIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var esAndroid = /Android/i.test(ua);
  var enApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|LinkedInApp|Messenger/i.test(ua)
              || (esIOS && !/Safari\//.test(ua))                  // WebView de iOS (no trae "Safari/")
              || (esIOS && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua))   // otro navegador de iPhone
              || (esAndroid && /; wv\)/.test(ua));
  function instalada() {
    try {
      if (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) return true;
      if (navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }
  function enlace() { return location.origin + location.pathname.replace(/index\.html$/, ''); }

  /* "modo" que corresponde a este celular: 'safari' | 'ios' | 'android' | 'copiar' | null */
  function modo() {
    if (instalada() || get(K_NO) === '1') return null;
    if (esIOS) return enApp ? 'copiar' : 'ios';
    if (esAndroid) return enApp ? 'copiar' : (promptEvt ? 'android' : null);
    return null;   // computadora: no se muestra
  }

  var ICO = {
    tel: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><circle cx="12" cy="18" r=".8" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/></svg>',
    brujula: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>',
    mas: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
    flecha: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>'
  };

  function css() {
    if (document.getElementById('ia-style')) return;
    var s = document.createElement('style'); s.id = 'ia-style';
    s.textContent =
      '#ia-btn{display:none;width:100%;margin-top:.9rem;align-items:center;gap:12px;text-align:left;cursor:pointer;font-family:inherit;color:#0a4d3a;' +
        'background:rgba(95,179,54,.14);border:1.5px dashed rgba(15,122,90,.55);border-radius:18px;padding:10px 12px}' +
      '#ia-btn.on{display:flex}' +
      '#ia-btn .ia-bi{flex:none;width:42px;height:42px;border-radius:13px;background:#fff;color:#0f7a5a;display:flex;align-items:center;justify-content:center}' +
      '#ia-btn .ia-bt{flex:1;line-height:1.25}#ia-btn b{display:block;font-size:.95rem;color:#0a3d2e}#ia-btn span{font-size:.74rem;opacity:.75}' +
      '#ia-btn .ia-bf{flex:none;color:#0f7a5a}' +
      '#ia-ov{position:fixed;inset:0;z-index:100000;background:rgba(10,24,20,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);display:none;align-items:flex-end;justify-content:center}' +
      '#ia-ov.on{display:flex}' +
      '#ia-sheet{width:100%;max-width:520px;max-height:94vh;overflow:auto;background:#fff;color:#10222b;border-radius:28px 28px 0 0;padding:10px 20px calc(18px + env(safe-area-inset-bottom));' +
        'box-shadow:0 -12px 40px rgba(0,0,0,.28);font-family:"Outfit",system-ui,-apple-system,sans-serif;animation:iaUp .32s cubic-bezier(.2,.8,.2,1)}' +
      '@keyframes iaUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
      '#ia-sheet .ia-h{width:44px;height:5px;border-radius:3px;background:#d3dbe0;margin:2px auto 14px}' +
      '#ia-sheet .ia-top{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}' +
      '#ia-sheet .ia-ic{flex:none;width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#5fb336,#0f7a5a);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(15,122,90,.3)}' +
      '#ia-sheet h2{margin:0 0 4px;font-size:1.5rem;line-height:1.1;font-weight:800;letter-spacing:-.3px;color:#0a2a22}' +
      '#ia-sheet .ia-sub{margin:0;font-size:.88rem;line-height:1.4;color:#667985}' +
      '#ia-sheet .ia-st{display:flex;align-items:center;gap:12px;border:1.5px solid #e3ebe9;border-radius:18px;padding:12px 14px;margin-bottom:10px}' +
      '#ia-sheet .ia-n{flex:none;width:30px;height:30px;border-radius:50%;background:#e4f4d9;color:#2b7a12;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.9rem}' +
      '#ia-sheet .ia-tx{flex:1;font-size:.95rem;line-height:1.35}#ia-sheet .ia-tx small{display:block;margin-top:3px;font-size:.78rem;color:#7a8a94;line-height:1.35}' +
      '#ia-sheet .ia-si{flex:none;color:#2b7a12;display:flex}' +
      '#ia-sheet .ia-nota{background:#e7f6dc;border-radius:16px;padding:12px 14px;font-size:.86rem;line-height:1.4;margin:4px 0 14px}' +
      '#ia-sheet .ia-go{width:100%;border:0;border-radius:999px;padding:16px;font-family:inherit;font-size:1.1rem;font-weight:800;color:#0a2a22;cursor:pointer;' +
        'background:linear-gradient(180deg,#b6ee3c,#8fd62a);box-shadow:0 8px 20px rgba(143,214,42,.45)}' +
      '#ia-sheet .ia-go:active{transform:scale(.98)}' +
      '#ia-sheet .ia-no{display:block;width:100%;margin:12px 0 2px;background:none;border:0;font-family:inherit;font-size:.82rem;color:#6b7b85;text-decoration:underline;cursor:pointer;font-weight:600}';
    document.head.appendChild(s);
  }

  function paso(n, html, icono) {
    return '<div class="ia-st"><div class="ia-n">' + n + '</div><div class="ia-tx">' + html + '</div><div class="ia-si">' + icono + '</div></div>';
  }
  function contenido(m) {
    var nota = '<div class="ia-nota">Al abrir la app instalada te pedirá tu <b>código de 4 dígitos</b> una sola vez. Tenlo a la mano.</div>';
    if (m === 'copiar') {
      var nav = esIOS ? 'Safari' : 'Chrome';
      return { t: 'Ábrela en ' + nav,
        sub: 'Estás viendo la app dentro de otra aplicación (WhatsApp, Instagram, Facebook…). Desde aquí no se puede instalar.',
        pasos: paso(1, 'Toca <b>Copiar enlace</b> aquí abajo.', ICO.link) +
               paso(2, 'Abre <b>' + nav + '</b> y pega el enlace en la barra de direcciones.' + (esIOS ? '<small>También puedes tocar el ícono de brújula o ⋯ y elegir <b>Abrir en Safari</b>.</small>' : '<small>También puedes tocar ⋮ y elegir <b>Abrir en el navegador</b>.</small>'), ICO.brujula) +
               (esIOS ? paso(3, 'Ahí toca <b>Compartir → Agregar a inicio → Agregar</b>.', ICO.share) : paso(3, 'Ahí toca <b>Instalar</b> cuando aparezca el aviso.', ICO.mas)),
        nota: nota, boton: 'Copiar enlace', accion: 'copiar' };
    }
    if (m === 'ios') {
      return { t: 'Instala la app en tu celular',
        sub: 'Se abre con un toque desde tu pantalla de inicio, carga más rápido y funciona sin internet.',
        pasos: paso(1, 'Toca el botón <b>Compartir</b> de Safari.<small>Si no lo ves, toca ⋯ (abajo a la derecha) y luego <b>Compartir</b>.</small>', ICO.share) +
               paso(2, 'Desliza hacia arriba y toca <b>Agregar a inicio</b>.', ICO.mas) +
               paso(3, 'Toca <b>Agregar</b>. Listo: ábrela desde el ícono nuevo en tu pantalla.', ICO.ok),
        nota: nota, boton: 'Entendido', accion: 'cerrar' };
    }
    return { t: 'Instala la app en tu celular',
      sub: 'Se abre con un toque desde tu pantalla de inicio, carga más rápido y funciona sin internet.',
      pasos: paso(1, 'Toca <b>Instalar app</b> aquí abajo.', ICO.mas) +
             paso(2, 'Confirma en el aviso que aparece: toca <b>Instalar</b>.', ICO.ok) +
             paso(3, 'Listo: ábrela desde el ícono nuevo en tu pantalla.', ICO.tel),
      nota: nota, boton: 'Instalar app', accion: 'instalar' };
  }

  function cerrar() { var o = document.getElementById('ia-ov'); if (o) o.classList.remove('on'); }

  function copiar(btn) {
    var url = enlace();
    function ok() { btn.textContent = '¡Enlace copiado!'; setTimeout(function () { btn.textContent = 'Copiar enlace'; }, 2200); }
    function viejo() {
      try {
        var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta);
        ta.select(); ta.setSelectionRange(0, 99999); document.execCommand('copy'); ta.remove(); ok();
      } catch (e) { window.prompt('Copia este enlace:', url); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, viejo); else viejo();
  }

  function abrir(m) {
    m = m || modo(); if (!m) return;
    css();
    var c = contenido(m), o = document.getElementById('ia-ov');
    if (!o) {
      o = document.createElement('div'); o.id = 'ia-ov';
      o.addEventListener('click', function (e) { if (e.target === o) cerrar(); });
      document.body.appendChild(o);
    }
    o.innerHTML = '<div id="ia-sheet" role="dialog" aria-modal="true"><div class="ia-h"></div>' +
      '<div class="ia-top"><div class="ia-ic">' + ICO.tel + '</div><div><h2>' + c.t + '</h2><p class="ia-sub">' + c.sub + '</p></div></div>' +
      c.pasos + c.nota +
      '<button type="button" class="ia-go" id="ia-go">' + c.boton + '</button>' +
      '<button type="button" class="ia-no" id="ia-no">No volver a mostrar este aviso</button></div>';
    o.classList.add('on');
    set(K_VISTO, '1');
    var go = document.getElementById('ia-go');
    go.onclick = function () {
      if (c.accion === 'copiar') return copiar(go);
      if (c.accion === 'instalar' && promptEvt) {
        var p = promptEvt; promptEvt = null;
        try { p.prompt(); p.userChoice.then(function (r) { if (r && r.outcome === 'accepted') { set(K_HECHO, '1'); refrescar(); } cerrar(); }); } catch (e) { cerrar(); }
        return;
      }
      cerrar();
    };
    document.getElementById('ia-no').onclick = function () { set(K_NO, '1'); cerrar(); refrescar(); };
  }
  window.instalarAppAbrir = function () { abrir(); };

  /* botón punteado en la pantalla de acceso */
  function boton() {
    var b = document.getElementById('ia-btn');
    var box = document.querySelector('#login-screen .login-box');
    if (!box) return;
    if (!b) {
      css();
      b = document.createElement('button'); b.type = 'button'; b.id = 'ia-btn';
      b.innerHTML = '<span class="ia-bi">' + ICO.tel + '</span><span class="ia-bt"><b>Instala la app en tu celular</b><span>Un toque desde tu pantalla de inicio</span></span><span class="ia-bf">' + ICO.flecha + '</span>';
      b.addEventListener('click', function () { abrir(); });
      box.appendChild(b);
    }
    b.classList.toggle('on', !!modo());
  }
  function refrescar() { try { boton(); } catch (e) {} }

  window.addEventListener('beforeinstallprompt', function (e) { promptEvt = e; refrescar(); autoMostrar(); });
  window.addEventListener('appinstalled', function () { promptEvt = null; set(K_HECHO, '1'); cerrar(); refrescar(); });

  var auto = false;
  function autoMostrar() {
    if (auto || get(K_VISTO) === '1') return;
    var scr = document.getElementById('login-screen');
    if (!scr || scr.classList.contains('oculto')) return;      // ya hay sesión abierta: no estorbar
    if (!modo()) return;
    auto = true;
    setTimeout(function () { if (modo()) abrir(); }, 900);
  }

  function init() {
    refrescar();
    autoMostrar();
    setTimeout(function () { refrescar(); autoMostrar(); }, 2500);   // Android: el navegador avisa un momento después
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
