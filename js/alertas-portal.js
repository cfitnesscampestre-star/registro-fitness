// ═══════════════════════════════════════════════════════════════════
// ALERTAS DEL PORTAL DEL INSTRUCTOR
//
// · Las pestañas "Firma Digital" y "Suplencias" ya no se ven: cuando hay una
//   hoja de firmas o de suplencias activa y pendiente para el instructor,
//   aparece un aviso grande arriba. Al tocarlo lo lleva a la pantalla de firma.
// · El aviso se quita solo cuando la firma queda guardada, y el portal regresa
//   a "Mis Clases".
// · El botón "Guardar firma" permanece apagado mientras no haya trazo.
//
// No cambia cómo se guardan las firmas: reutiliza portal.js y
// suplencias_firmas_v2.js tal como están.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CSS = `
#inst-tabn-firma,#inst-tabn-suplencias{display:none!important}
#inst-firma-badge{display:none!important}
#inst-alertas{flex-shrink:0;display:flex;flex-direction:column;gap:6px;padding:0 10px}
#inst-alertas:empty,#inst-alertas>div:empty{display:none}
#inst-alertas>div:not(:empty){margin-top:8px}
.ia-banner{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;border:0;cursor:pointer;
  border-radius:14px;padding:13px 14px;color:#fff;font-family:'Outfit',sans-serif;-webkit-tap-highlight-color:transparent;
  background:linear-gradient(135deg,#d63b2f,#b3261e);box-shadow:0 4px 16px rgba(198,45,34,.35);
  animation:ia-pulso 1.8s ease-in-out infinite}
.ia-banner.sup{background:linear-gradient(135deg,#0a6fbd,#0a4f8c);box-shadow:0 4px 16px rgba(10,111,189,.35);animation-name:ia-pulso-azul}
.ia-banner .ia-ico{font-size:1.5rem;line-height:1;flex-shrink:0}
.ia-banner .ia-txt{flex:1;min-width:0}
.ia-banner .ia-t{font-weight:800;font-size:.9rem;line-height:1.2}
.ia-banner .ia-s{font-size:.72rem;opacity:.92;margin-top:2px}
.ia-banner .ia-go{font-size:1.3rem;font-weight:700;flex-shrink:0}
@keyframes ia-pulso{0%,100%{box-shadow:0 4px 16px rgba(198,45,34,.35),0 0 0 0 rgba(214,59,47,.55)}50%{box-shadow:0 4px 16px rgba(198,45,34,.35),0 0 0 8px rgba(214,59,47,0)}}
@keyframes ia-pulso-azul{0%,100%{box-shadow:0 4px 16px rgba(10,111,189,.35),0 0 0 0 rgba(10,111,189,.55)}50%{box-shadow:0 4px 16px rgba(10,111,189,.35),0 0 0 8px rgba(10,111,189,0)}}
@media (prefers-reduced-motion:reduce){.ia-banner{animation:none}}
.ia-volver{display:flex;align-items:center;gap:6px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--txt2);
  font:600 .74rem 'Outfit',sans-serif;padding:7px 12px;margin-bottom:.8rem;cursor:pointer}
`;

  const PEND = { firma: false, suplencias: false };   // lo que estaba pendiente la última vez
  let ultimoHtml = '';

  const portalAbierto = () => {
    const s = document.getElementById('instructor-screen');
    return !!s && s.style.display !== 'none' && typeof instActualId !== 'undefined' && !!instActualId;
  };
  const panelVisible = t => {
    const p = document.getElementById('inst-panel-' + t);
    return !!p && p.style.display !== 'none';
  };

  // ── ¿qué tiene pendiente por firmar? ─────────────────────────────
  function firmaPendiente() {
    try {
      const h = (typeof _instFirmaHojaActiva !== 'undefined') ? _instFirmaHojaActiva : null;
      if (!h) return false;
      const f = (h.firmas || {})[String(instActualId)];
      return !(f && f.data);
    } catch (e) { return false; }
  }
  function suplenciasPendientes() {
    const b = document.getElementById('inst-sup-badge');
    if (!b || b.style.display === 'none') return 0;
    return parseInt(b.textContent, 10) || 0;
  }

  // ── contenedor ───────────────────────────────────────────────────
  function sub(id) {
    const box = document.getElementById('inst-alertas');
    if (!box) return null;
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; box.appendChild(el); }
    return el;
  }

  function banner(tipo, ico, titulo, texto) {
    return `<button class="ia-banner ${tipo === 'suplencias' ? 'sup' : ''}" data-ia="${tipo}" aria-label="${titulo}">
      <span class="ia-ico">${ico}</span>
      <span class="ia-txt"><div class="ia-t">${titulo}</div><div class="ia-s">${texto}</div></span>
      <span class="ia-go">›</span></button>`;
  }

  function pintar() {
    const el = sub('ia-firmas');
    if (!el) return;
    if (!portalAbierto()) { el.innerHTML = ''; ultimoHtml = ''; return; }

    const fp = firmaPendiente();
    const n = suplenciasPendientes();
    let h = '';
    if (fp && !panelVisible('firma')) h += banner('firma', '✍️', 'Tienes una hoja de firmas por firmar', 'Toca aquí para firmar ahora');
    if (n > 0 && !panelVisible('suplencias')) h += banner('suplencias', '⇄', `Tienes ${n} suplencia${n > 1 ? 's' : ''} por firmar`, 'Toca aquí para firmar ahora');

    if (h !== ultimoHtml) {
      const aparecio = h && !ultimoHtml;
      el.innerHTML = h; ultimoHtml = h;
      if (aparecio && navigator.vibrate) { try { navigator.vibrate([120, 80, 120]); } catch (e) {} }
    }

    // Si estaba pendiente y ya se firmó/guardó: regresar a Mis Clases
    if (PEND.firma && !fp && panelVisible('firma')) volverAHoy();
    if (PEND.suplencias && n === 0 && panelVisible('suplencias')) volverAHoy();
    PEND.firma = fp; PEND.suplencias = n > 0;
  }

  function volverAHoy() {
    if (typeof instSwitchTab === 'function') instSwitchTab('hoy');
    pintar();
  }

  // ── botón "← Volver" dentro de las pantallas de firma ────────────
  function agregarVolver() {
    ['firma', 'suplencias'].forEach(t => {
      const p = document.getElementById('inst-panel-' + t);
      if (!p || p.querySelector('.ia-volver')) return;
      const b = document.createElement('button');
      b.className = 'ia-volver'; b.type = 'button'; b.textContent = '← Volver a Mis Clases';
      b.addEventListener('click', () => { if (typeof instSwitchTab === 'function') instSwitchTab('hoy'); pintar(); });
      p.insertBefore(b, p.firstChild);
    });
  }

  // ── "Guardar firma" apagado hasta que haya trazo ─────────────────
  const PARES = [
    { canvas: 'inst-firma-canvas', btn: 'inst-guardar-btn', borrar: 'inst-canvas-borrar-btn' },
    { canvas: 'inst-sup-canvas',   btn: 'inst-sup-guardar-btn', borrar: 'inst-sup-borrar-btn' }
  ];
  const conTrazo = new WeakMap();   // canvas (elemento) → true si ya dibujaron

  function marcarTrazo(e) {
    const c = e.target && e.target.closest ? e.target.closest('canvas') : null;
    if (!c || !PARES.some(p => p.canvas === c.id)) return;
    if (e.type === 'mousemove' && !e.buttons) return;
    conTrazo.set(c, true);
    aplicarBloqueo();
  }
  ['mousemove', 'touchmove'].forEach(ev => document.addEventListener(ev, marcarTrazo, true));
  document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    // "Limpiar" vacía el cuadro → vuelve a bloquear Guardar
    PARES.forEach(p => {
      if (t.id === p.borrar) { const c = document.getElementById(p.canvas); if (c) conTrazo.set(c, false); setTimeout(aplicarBloqueo, 50); }
    });
    // Aviso tocado → ir a la pantalla de firma
    const ia = t.closest ? t.closest('[data-ia]') : null;
    if (ia) { instSwitchTab(ia.dataset.ia); pintar(); window.scrollTo(0, 0); }
    // Al guardar: revisar varias veces mientras termina de sincronizar
    if (t.id === 'inst-guardar-btn' || t.id === 'inst-sup-guardar-btn') {
      [900, 2200, 4500, 8000].forEach(ms => setTimeout(() => {
        try { if (typeof instCargarHojaFirmas === 'function') instCargarHojaFirmas(); } catch (er) {}
        pintar();
      }, ms));
    }
  });

  function aplicarBloqueo() {
    PARES.forEach(p => {
      const c = document.getElementById(p.canvas), b = document.getElementById(p.btn);
      if (!c || !b) return;
      if (/guardada/i.test(b.textContent)) return;          // ya firmado: lo maneja el portal
      const ok = conTrazo.get(c) === true;
      b.disabled = !ok;
      b.style.opacity = ok ? '1' : '.4';
      b.style.pointerEvents = ok ? 'auto' : 'none';
      b.title = ok ? '' : 'Firma en el recuadro para activar Guardar';
    });
  }

  // ── arranque ─────────────────────────────────────────────────────
  function iniciar() {
    if (!document.getElementById('ia-css')) {
      const st = document.createElement('style'); st.id = 'ia-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    agregarVolver();
    pintar(); aplicarBloqueo();
    setInterval(() => { agregarVolver(); pintar(); }, 2000);
    setInterval(aplicarBloqueo, 300);
    // al cambiar de pestaña, refrescar de inmediato
    const orig = window.instSwitchTab;
    if (typeof orig === 'function' && !orig._ia) {
      const w = function () { const r = orig.apply(this, arguments); setTimeout(() => { pintar(); aplicarBloqueo(); }, 60); return r; };
      w._ia = true; window.instSwitchTab = w;
    }
  }
  // sfv2 envuelve instSwitchTab al cargar; esperamos a que termine para envolver encima
  if (document.readyState === 'complete') setTimeout(iniciar, 1500);
  else window.addEventListener('load', () => setTimeout(iniciar, 1500));

  window.iaRefrescar = pintar;
})();
