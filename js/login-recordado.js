/* ═══════════════════════════════════════════════════════════════
   login-recordado.js
   Recuerda al instructor en el celular donde está instalada la app.
   - Tras un login de instructor exitoso (app instalada) se guarda quién es.
   - La próxima vez la pantalla de login solo muestra su foto/nombre y el PIN
     (se ocultan Coordinador, Consulta y la lista de nombres).
   - Mantener presionado el logo ~2 s borra lo recordado y regresa a la
     pantalla inicial completa.
   El PIN sigue siendo obligatorio; no se toca bloqueo ni sesión.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'fc_inst_recordado';   // JSON {id, nombre, foto?}
  var LONG_MS = 2000;

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function leer() {
    var s = ls(); if (!s) return null;
    try { var o = JSON.parse(s.getItem(KEY) || 'null'); return (o && o.id) ? o : null; } catch (e) { return null; }
  }
  function guardar(o) { var s = ls(); if (s) { try { s.setItem(KEY, JSON.stringify(o)); } catch (e) { try { delete o.foto; s.setItem(KEY, JSON.stringify(o)); } catch (e2) {} } } }
  function borrar() { var s = ls(); if (s) { try { s.removeItem(KEY); } catch (e) {} } }

  // Solo en la app instalada (pantalla completa / standalone)
  function esInstalada() {
    try {
      if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
                                window.matchMedia('(display-mode: fullscreen)').matches)) return true;
      if (window.navigator && window.navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }
  window.loginRecordadoInstalada = esInstalada;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function buscarInst(id) {
    try {
      return (instructores || []).find(function (i) { return String(i.id) === String(id); }) || null;
    } catch (e) { return null; }
  }
  function iniciales(n) {
    var p = String(n || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[1][0] : '')).toUpperCase();
  }

  // ── Estilos ──
  function inyectarCSS() {
    if (document.getElementById('lr-style')) return;
    var st = document.createElement('style');
    st.id = 'lr-style';
    st.textContent =
      '#login-screen.lr-activo .login-perfil-lbl,' +
      '#login-screen.lr-activo .login-role-btns,' +
      '#login-screen.lr-activo #login-instructor-select-wrap,' +
      '#login-screen.lr-activo .login-info{display:none!important}' +
      '#lr-card{display:none;flex-direction:column;align-items:center;gap:6px;margin:.2rem 0 1rem;text-align:center}' +
      '#login-screen.lr-activo #lr-card{display:flex}' +
      '#lr-avatar{width:84px;height:84px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;' +
        'background:linear-gradient(135deg,#1a7a45,#2fae6b);color:#fff;font-weight:700;font-size:1.7rem;' +
        'box-shadow:0 0 0 3px rgba(94,255,160,.28),0 4px 14px rgba(0,0,0,.18)}' +
      '#lr-avatar img{width:100%;height:100%;object-fit:cover;display:block}' +
      '#lr-hola{font-size:.72rem;letter-spacing:1.5px;text-transform:uppercase;opacity:.7}' +
      '#lr-nombre{font-size:1.15rem;font-weight:700;line-height:1.2}' +
      '#lr-hint{font-size:.62rem;opacity:.5;margin-top:2px}' +
      '#login-screen .login-logo{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}' +
      '#login-screen .login-logo.lr-pressing{opacity:.55;transition:opacity 1.8s linear}';
    document.head.appendChild(st);
  }

  function asegurarTarjeta() {
    var card = document.getElementById('lr-card');
    if (card) return card;
    var campo = document.getElementById('login-pass-field');
    if (!campo || !campo.parentNode) return null;
    card = document.createElement('div');
    card.id = 'lr-card';
    card.innerHTML = '<div id="lr-avatar"></div><div id="lr-hola">Hola</div><div id="lr-nombre"></div>' +
                     '<div id="lr-hint">Mantén presionado el logo para cambiar de perfil</div>';
    campo.parentNode.insertBefore(card, campo);
    return card;
  }

  // ── Mostrar la pantalla "solo mi perfil" ──
  function aplicar() {
    var rec = leer();
    var scr = document.getElementById('login-screen');
    if (!rec || !scr || scr.classList.contains('oculto')) return false;

    var inst = buscarInst(rec.id);
    var hayLista = false;
    try { hayLista = (instructores || []).length > 0; } catch (e) {}
    // Si ya hay lista cargada y el instructor ya no existe / está inactivo → olvidar
    if (hayLista && (!inst || (typeof instActivo === 'function' && !instActivo(inst)))) {
      borrar(); desaplicar(); return false;
    }

    inyectarCSS();
    var card = asegurarTarjeta();
    if (!card) return false;

    var nombre = (inst && inst.nombre) || rec.nombre || '';
    var foto = (inst && inst.foto) || rec.foto || '';
    var av = document.getElementById('lr-avatar');
    av.innerHTML = foto ? '<img alt="" src="' + esc(foto) + '">' : esc(iniciales(nombre));
    document.getElementById('lr-nombre').textContent = nombre;

    // Deja el login listo como instructor con su nombre elegido
    try { seleccionarRol('instructor'); } catch (e) {}
    var sel = document.getElementById('login-instructor-sel');
    if (sel) {
      if (!sel.querySelector('option[value="' + rec.id + '"]')) {
        var op = document.createElement('option');
        op.value = rec.id; op.textContent = nombre; sel.appendChild(op);
      }
      sel.value = String(rec.id);
    }
    scr.classList.add('lr-activo');

    // Mantener al día nombre/foto cacheados
    if (inst) guardar({ id: inst.id, nombre: inst.nombre, foto: (inst.foto && inst.foto.length < 150000) ? inst.foto : '' });
    return true;
  }

  function desaplicar() {
    var scr = document.getElementById('login-screen');
    if (scr) scr.classList.remove('lr-activo');
    var card = document.getElementById('lr-card');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  // ── Volver a la pantalla inicial como si no hubiera nada guardado ──
  function olvidar() {
    borrar();
    desaplicar();
    ['admin', 'usuario', 'instructor'].forEach(function (r) {
      var b = document.getElementById('role-btn-' + r);
      if (b) b.classList.remove('selected');
    });
    try { rolLoginSeleccionado = 'admin'; } catch (e) {}
    var w = document.getElementById('login-instructor-select-wrap'); if (w) w.style.display = 'none';
    var sel = document.getElementById('login-instructor-sel'); if (sel) sel.value = '';
    var lbl = document.getElementById('login-pass-label'); if (lbl) lbl.textContent = 'PIN (4 DÍGITOS)';
    var p = document.getElementById('login-pass');
    if (p) { p.value = ''; p.placeholder = 'Ingresa tu PIN...'; }
    var er = document.getElementById('login-error'); if (er) er.style.display = 'none';
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    if (typeof showToast === 'function') { try { showToast('Perfil olvidado. Elige tu perfil de nuevo.'); } catch (e) {} }
  }
  window.loginRecordadoOlvidar = olvidar;

  // ── Pulsación larga en el logo ──
  function instalarPulsacionLarga() {
    var logo = document.querySelector('#login-screen .login-logo');
    if (!logo || logo._lrListo) return;
    logo._lrListo = true;
    var timer = null, x0 = 0, y0 = 0;

    function cancelar() {
      if (timer) { clearTimeout(timer); timer = null; }
      logo.classList.remove('lr-pressing');
    }
    function iniciar(x, y) {
      cancelar();
      x0 = x; y0 = y;
      logo.classList.add('lr-pressing');
      timer = setTimeout(function () { timer = null; logo.classList.remove('lr-pressing'); olvidar(); }, LONG_MS);
    }
    logo.addEventListener('pointerdown', function (e) { iniciar(e.clientX, e.clientY); });
    logo.addEventListener('pointermove', function (e) {
      if (timer && (Math.abs(e.clientX - x0) > 14 || Math.abs(e.clientY - y0) > 14)) cancelar();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { logo.addEventListener(ev, cancelar); });
    logo.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    logo._lrIniciar = iniciar; // para pruebas
  }

  // ── Recordar tras login exitoso (solo app instalada) ──
  var _orig = window._loginExitoso;
  if (typeof _orig === 'function') {
    window._loginExitoso = function (rol, instId) {
      try {
        if (rol === 'instructor' && instId && esInstalada()) {
          var inst = buscarInst(instId);
          if (inst) guardar({ id: inst.id, nombre: inst.nombre, foto: (inst.foto && inst.foto.length < 150000) ? inst.foto : '' });
        }
      } catch (e) {}
      return _orig.apply(this, arguments);
    };
  }

  function init() {
    instalarPulsacionLarga();
    aplicar();
    // La lista de instructores puede llegar después (Firebase): reintentar
    setTimeout(function () { if (leer()) aplicar(); }, 2500);
    setTimeout(function () { if (leer()) aplicar(); }, 7000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
