// ═══════════════════════════════════════════════════════════════════
// VER COMO INSTRUCTOR (coordinación)
//
// Desde coordinación se elige un instructor y se abre su portal tal como él
// lo ve, sin cerrar la sesión del coordinador ni pedir su PIN.
//
//  · Es SOLO LECTURA: no se capturan asistentes, no se firma, no se reporta
//    equipo ni se guardan pruebas a nombre del instructor. Se puede navegar
//    por todas sus pestañas, fechas y semanas.
//  · "Volver a coordinación" (o el botón Salir del portal) regresa al inicio
//    del coordinador. Al recargar la página siempre se vuelve a coordinación.
//  · No cambia la sesión guardada (fc_ses_rol sigue siendo la del coordinador).
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  let activo = false;
  let instPrevio = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'info'); };
  const aviso = () => toast('Vista de instructor: solo lectura. Para capturar, hazlo desde coordinación.', 'warn');

  // ── Selector de instructor ────────────────────────────────────────
  function crearSelector() {
    if ($('vci-picker')) return;
    const d = document.createElement('div');
    d.id = 'vci-picker';
    d.innerHTML = `
      <div class="vci-fondo" onclick="vciCerrarSelector()"></div>
      <div class="vci-hoja" role="dialog" aria-label="Ver como instructor">
        <div class="vci-h"><b>Ver como instructor</b><small>Elige a quién quieres ver. Es solo lectura.</small>
          <button class="vci-x" onclick="vciCerrarSelector()" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button></div>
        <div class="vci-buscar"><input id="vci-q" type="search" placeholder="Buscar instructor..." autocomplete="off" oninput="vciFiltrar(this.value)"></div>
        <div class="vci-lista" id="vci-lista"></div>
      </div>`;
    document.body.appendChild(d);
  }

  function lista(q) {
    const el = $('vci-lista'); if (!el) return;
    const base = (typeof instructoresActivos === 'function' ? instructoresActivos() : (instructores || []))
      .slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const t = String(q || '').trim().toLowerCase();
    const res = t ? base.filter(i => String(i.nombre).toLowerCase().includes(t)) : base;
    if (!res.length) { el.innerHTML = '<div class="vci-vacio">No hay instructores con ese nombre.</div>'; return; }
    el.innerHTML = res.map(i => {
      const n = (i.horario || []).length;
      const ini = String(i.nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      const foto = i.foto ? `<img src="${esc(i.foto)}" alt="">` : `<span>${esc(ini)}</span>`;
      return `<button class="vci-item" onclick="vciAbrir(${JSON.stringify(i.id).replace(/"/g, '&quot;')})">
        <div class="vci-av">${foto}</div>
        <div class="vci-t"><b>${esc(i.nombre)}</b><small>${n} clase${n === 1 ? '' : 's'} por semana${i.tipo ? ' · ' + esc(i.tipo) : ''}</small></div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>
      </button>`;
    }).join('');
  }

  window.vciAbrirSelector = function () {
    if (typeof cerrarMenuCoord === 'function') cerrarMenuCoord();
    const dd = $('coord-menu-dropdown'); if (dd) dd.style.display = 'none';
    crearSelector();
    const q = $('vci-q'); if (q) q.value = '';
    lista('');
    $('vci-picker').classList.add('on');
  };
  window.vciCerrarSelector = function () { const p = $('vci-picker'); if (p) p.classList.remove('on'); };
  window.vciFiltrar = lista;

  // ── Abrir el portal del instructor en modo vista ─────────────────
  window.vciAbrir = function (id) {
    const inst = (instructores || []).find(i => String(i.id) === String(id));
    if (!inst) return;
    vciCerrarSelector();
    if (!activo) instPrevio = instActualId;
    activo = true;
    instActualId = inst.id;
    document.documentElement.classList.add('ver-como-inst');
    pintarBanner(inst);
    if (typeof abrirPortalInstructorLocal === 'function') abrirPortalInstructorLocal();
  };

  function pintarBanner(inst) {
    let b = $('vci-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'vci-banner';
      document.body.appendChild(b);
    }
    b.innerHTML = `<span class="vci-ojo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></span>
      <span class="vci-txt"><small>Viendo como · solo lectura</small><b>${esc(inst.nombre)}</b></span>
      <button onclick="vciAbrirSelector()">Cambiar</button>
      <button class="vci-volver" onclick="vciVolver()"><span class="vci-l">Volver a coordinación</span><span class="vci-s">Volver</span></button>`;
    b.style.display = 'flex';
  }

  // ── Regresar a coordinación ──────────────────────────────────────
  window.vciVolver = function () {
    if (!activo) return;
    activo = false;
    document.documentElement.classList.remove('ver-como-inst');
    if (typeof instPararPoll === 'function') { try { instPararPoll(); } catch (e) {} }
    const s = $('instructor-screen'); if (s) s.style.display = 'none';
    const b = $('vci-banner'); if (b) b.style.display = 'none';
    // abrirPortalInstructorLocal ocultó la interfaz del coordinador: se restaura
    ['hdr', 'bottom-nav', 'sidebar', 'section-nav'].forEach(k => { const e = $(k); if (e) e.style.display = ''; });
    instActualId = instPrevio;
    if (typeof switchSection === 'function') switchSection('hoy');
    else if (typeof renderAll === 'function') renderAll();
  };

  // ── Solo lectura: bloquear lo que guarda a nombre del instructor ──
  function envolver(nombre) {
    const orig = window[nombre];
    if (typeof orig !== 'function' || orig._vci) return;
    const w = function () { if (activo) { aviso(); return; } return orig.apply(this, arguments); };
    w._vci = true;
    window[nombre] = w;
  }
  function envolverTodo() {
    ['instCapAbrir', 'instGuardarFirma', 'sfv2_guardarFirma', 'instGuardarFirmaSup'].forEach(envolver);
    // El botón Salir del portal regresa a coordinación en lugar de cerrar la sesión
    const cs = window.cerrarSesion;
    if (typeof cs === 'function' && !cs._vci) {
      const w = function () { if (activo) { vciVolver(); return; } return cs.apply(this, arguments); };
      w._vci = true; window.cerrarSesion = w;
    }
  }

  // Cualquier botón que guarde, envíe, firme o reporte dentro del portal (mantenimiento,
  // pruebas físicas, firmas…) se detiene antes de llegar a su función.
  const ACCION = /guardar|enviar|firmar|reportar|registrar|confirmar|capturar|subir|eliminar|borrar|tomar foto/i;
  document.addEventListener('click', e => {
    if (!activo) return;
    const btn = e.target.closest && e.target.closest('#instructor-screen button, #instructor-screen [role="button"], #instructor-screen .inst-cap-card');
    if (!btn) return;
    if (btn.closest('.inst-tabs-bar') || btn.closest('.ipg-date') || btn.closest('.inst-salir-btn') ||
        btn.classList.contains('inst-periodo-pill') || btn.classList.contains('ia-volver')) return;
    const txt = (btn.textContent || '') + ' ' + (btn.getAttribute('aria-label') || '');
    if (btn.classList.contains('inst-cap-card') || btn.classList.contains('ipg-hero-b') || ACCION.test(txt)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      aviso();
    }
  }, true);

  // Las funciones de firma/suplencias se definen o se envuelven al cargar: esperar a que estén
  if (document.readyState === 'complete') setTimeout(envolverTodo, 2500);
  else window.addEventListener('load', () => setTimeout(envolverTodo, 2500));
  // Por si otro script vuelve a reemplazarlas después
  setInterval(() => { if (activo) envolverTodo(); }, 3000);
})();
