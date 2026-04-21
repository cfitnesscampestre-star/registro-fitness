// ═══════════════════════════════════════════════════════════════════════════
// SUPLENCIAS_LINK.JS  —  v1.0
// Integra el planificador de suplencias con:
//   1. Pre-llenado automático en modal "+ Clase"
//   2. Pre-llenado automático en recorrido (turboMostrar)
//   3. Sincronización bidireccional clase/recorrido → suplenciasPlan + calendario
//   4. Firmas de suplencias en el portal del instructor (suplente)
//   5. Badge de pendientes de firma en el tab
//
// INSTALACIÓN: agregar <script src="suplencias_link.js"></script>
// en index.html DESPUÉS de todos los demás scripts (suplencias2.js, portal.js, etc.)
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 1 — HOOKS SOBRE autoRellenarHorario y turboMostrar
// Detecta si hay suplencia planificada para esa clase/fecha y pre-llena los campos
// ─────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // ── Esperar a que las funciones originales estén disponibles ─────────────
  function waitReady(fn, retries) {
    retries = retries || 40;
    if (typeof autoRellenarHorario === 'function' && typeof turboMostrar === 'function') {
      fn();
    } else if (retries > 0) {
      setTimeout(function() { waitReady(fn, retries - 1); }, 150);
    }
  }

  waitReady(function() {

    // ════════════════════════════════════════════════════════════════════════
    // 1A — HOOK EN autoRellenarHorario (modal "+ Clase")
    // ════════════════════════════════════════════════════════════════════════
    var _origAutoRellenar = autoRellenarHorario;
    autoRellenarHorario = function() {
      _origAutoRellenar.apply(this, arguments);
      slk_preLlenarModalClase();
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1B — HOOK EN turboMostrar (recorrido)
    // ════════════════════════════════════════════════════════════════════════
    var _origTurboMostrar = turboMostrar;
    turboMostrar = function() {
      _origTurboMostrar.apply(this, arguments);
      slk_preLlenarRecorrido();
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1C — HOOK EN guardarClase (registros.js) — sincroniza → suplenciasPlan
    // ════════════════════════════════════════════════════════════════════════
    var _origGuardarClase = guardarClase;
    guardarClase = function() {
      _origGuardarClase.apply(this, arguments);
      slk_sincronizarDesdeClase();
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1D — HOOK EN turboGuardar (recorrido.js) — sincroniza → suplenciasPlan
    // ════════════════════════════════════════════════════════════════════════
    var _origTurboGuardar = turboGuardar;
    turboGuardar = function() {
      _origTurboGuardar.apply(this, arguments);
      slk_sincronizarDesdeRecorrido();
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1E — HOOK EN instCargarHojaFirmas — añade badge de suplencias pendientes
    // ════════════════════════════════════════════════════════════════════════
    var _origInstCargarHojaFirmas = instCargarHojaFirmas;
    instCargarHojaFirmas = function() {
      _origInstCargarHojaFirmas.apply(this, arguments);
      slk_actualizarBadgeSuplencias();
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1F — HOOK EN instRenderFirmaTab — añade sección de suplencias al tab
    // ════════════════════════════════════════════════════════════════════════
    var _origInstRenderFirmaTab = instRenderFirmaTab;
    instRenderFirmaTab = function() {
      _origInstRenderFirmaTab.apply(this, arguments);
      slk_renderFirmaSuplencias();
    };

  }); // waitReady

})();


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 2 — PRE-LLENADO MODAL "+ CLASE"
// Si la fecha + instructor + horario seleccionados tienen suplencia planificada,
// auto-seleccionar estado "sub", suplente y motivo.
// ─────────────────────────────────────────────────────────────────────────────
function slk_preLlenarModalClase() {
  try {
    var instId   = parseInt(document.getElementById('rc-inst').value);
    var claseVal = document.getElementById('rc-clase').value;
    var diaVal   = document.getElementById('rc-dia').value;
    var horaVal  = document.getElementById('rc-hora').value;
    var fechaVal = document.getElementById('rc-fecha').value;

    if (!instId || !claseVal || !diaVal || !horaVal || !fechaVal) return;

    var sup = (suplenciasPlan || []).find(function(s) {
      return String(s.inst_id) === String(instId) &&
             s.clase  === claseVal &&
             s.dia    === diaVal   &&
             s.hora   === horaVal  &&
             s.fecha  === fechaVal &&
             s.estado !== 'rechazado';
    });

    if (!sup) return;

    // Ya existe registro real (no volver a pre-llenar si ya fue guardado)
    var yaRegistrado = (registros || []).some(function(r) {
      return String(r.inst_id) === String(instId) &&
             r.clase === claseVal && r.dia === diaVal &&
             r.hora  === horaVal  && r.fecha === fechaVal &&
             (r.estado === 'sub' || r.estado === 'ok' || r.estado === 'falta');
    });
    if (yaRegistrado) return;

    // Pre-llenar estado sub
    var selEst = document.getElementById('rc-est');
    if (selEst) {
      selEst.value = 'sub';
      if (typeof toggleSuplenteClase === 'function') toggleSuplenteClase();
    }

    // Pre-llenar suplente
    if (sup.suplente_id) {
      var selSup = document.getElementById('rc-suplente');
      if (selSup) selSup.value = String(sup.suplente_id);
    }

    // Pre-llenar motivo
    if (sup.motivo) {
      var selMot = document.getElementById('rc-motivo');
      if (selMot) {
        selMot.value = sup.motivo;
      }
    }

    // Banner informativo para el coordinador
    slk_mostrarBannerSuplencia('m-clase', sup, 'rc-slot-preview');

  } catch(e) { /* silencioso */ }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 3 — PRE-LLENADO RECORRIDO
// Si la clase actual del recorrido tiene suplencia planificada para esa fecha,
// auto-poner estado "sub", seleccionar suplente y mostrar aviso.
// ─────────────────────────────────────────────────────────────────────────────
function slk_preLlenarRecorrido() {
  try {
    if (!recActual || recActual.clasesActivas === undefined || recIdx === undefined) return;
    var c = recActual.clasesActivas[recIdx];
    if (!c) return;

    var fechaRec = recActual.fecha;
    var diaRec   = recActual.dia;

    var sup = (suplenciasPlan || []).find(function(s) {
      return String(s.inst_id) === String(c.inst_id) &&
             s.clase  === c.clase  &&
             s.dia    === diaRec   &&
             s.hora   === c.hora   &&
             s.fecha  === fechaRec &&
             s.estado !== 'rechazado';
    });

    if (!sup) return;

    // Auto-seleccionar estado "sub"
    if (typeof turboSetPres === 'function') turboSetPres('sub');

    // Seleccionar suplente en el select del recorrido
    if (sup.suplente_id) {
      var selSup = document.getElementById('tc-suplente');
      if (selSup) selSup.value = String(sup.suplente_id);
    }

    // Motivo
    if (sup.motivo) {
      var selMot = document.getElementById('tc-motivo');
      if (selMot) selMot.value = sup.motivo;
    }

    // Aviso visual dentro de la tarjeta del recorrido
    slk_mostrarAvisoRecorrido(sup);

  } catch(e) { /* silencioso */ }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 4 — SINCRONIZACIÓN CLASE → suplenciasPlan + Firebase
// Cuando se guarda una clase con estado "sub", crear/actualizar la entrada
// en suplenciasPlan para que aparezca en el calendario.
// ─────────────────────────────────────────────────────────────────────────────
function slk_sincronizarDesdeClase() {
  try {
    // El registro más reciente con estado sub
    var regsub = (registros || [])
      .filter(function(r) { return r.estado === 'sub' && r.suplente_id; })
      .sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0) })[0];

    if (!regsub) return;

    // Solo sincronizar si fue guardado en los últimos 3 segundos
    if (Date.now() - (regsub.updatedAt || 0) > 3000) return;

    slk_upsertSuplenciaPlan(regsub);
  } catch(e) { /* silencioso */ }
}

function slk_sincronizarDesdeRecorrido() {
  try {
    if (!recActual || !recActual.items) return;
    var items = recActual.items.filter(function(it) {
      return it.presente === 'sub' && it.suplente_id;
    });
    items.forEach(function(item) {
      // Construir objeto similar a un registro
      var pseudo = {
        inst_id:          item.inst_id,
        clase:            item.clase,
        dia:              recActual.dia,
        hora:             item.hora,
        fecha:            recActual.fecha,
        suplente_id:      item.suplente_id,
        motivo_suplencia: item.motivo_suplencia || 'permiso',
        nota:             item.obs || '',
        estado:           'sub'
      };
      slk_upsertSuplenciaPlan(pseudo);
    });
  } catch(e) { /* silencioso */ }
}

/**
 * Crea o actualiza un registro en suplenciasPlan a partir de un registro de clase.
 * También lo persiste en Firebase/localStorage.
 */
async function slk_upsertSuplenciaPlan(reg) {
  try {
    var datos = {
      id:              Date.now(),
      inst_id:         parseInt(reg.inst_id),
      suplente_id:     reg.suplente_id ? parseInt(reg.suplente_id) : null,
      suplente_nombre: null,
      clase:           reg.clase,
      dia:             reg.dia,
      hora:            reg.hora,
      fecha:           reg.fecha,
      motivo:          reg.motivo_suplencia || 'permiso',
      nota:            reg.nota || '',
      estado:          'aprobado',
      ts:              new Date().toISOString(),
      origen:          'registro'   // distinguir los creados manualmente
    };

    var idx = (suplenciasPlan || []).findIndex(function(s) {
      return String(s.inst_id) === String(datos.inst_id) &&
             s.fecha === datos.fecha &&
             s.dia   === datos.dia   &&
             s.hora  === datos.hora;
    });

    if (idx >= 0) {
      datos.id = suplenciasPlan[idx].id;
      suplenciasPlan[idx] = datos;
    } else {
      suplenciasPlan.push(datos);
    }

    // Persistir
    if (typeof guardarSupLocal === 'function') guardarSupLocal();

    // Subir a Firebase si está disponible
    if (typeof fbDb !== 'undefined' && fbDb) {
      try {
        await fbDb.ref('fitness/suplencias/' + datos.id).set(datos);
      } catch(e) {}
    }

    // Re-renderizar el plan si la vista está abierta
    if (typeof renderSupPlan === 'function') {
      var v = document.getElementById('v-sup-plan');
      if (v && v.classList.contains('on')) renderSupPlan();
    }
  } catch(e) { /* silencioso */ }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 5 — FIRMAS DE SUPLENCIAS EN EL PORTAL DEL INSTRUCTOR
// Muestra en el tab "Firma" una sección separada: clases en las que el instructor
// fue SUPLENTE y aún no ha firmado como suplente.
// ─────────────────────────────────────────────────────────────────────────────

// Clave localStorage para firmas de suplencias
var SLK_SUP_FIRMAS_KEY = 'fc_firmas_suplencias';

/**
 * Devuelve el objeto de firmas de suplencias: { regId: { data, ts, nombre } }
 */
function slk_cargarFirmasSuplencias() {
  try {
    var raw = localStorage.getItem(SLK_SUP_FIRMAS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function slk_guardarFirmasSuplencias(obj) {
  try {
    localStorage.setItem(SLK_SUP_FIRMAS_KEY, JSON.stringify(obj));
  } catch(e) {}
}

/**
 * Badge: si hay suplencias sin firmar, poner un punto rojo adicional
 * en el tab de firma del portal.
 */
function slk_actualizarBadgeSuplencias() {
  try {
    if (typeof instActualId === 'undefined' || !instActualId) return;

    var pendientes = slk_obtenerSuplenciasPendientesFirma(instActualId);
    var badge = document.getElementById('inst-firma-badge');
    if (!badge) return;

    if (pendientes.length > 0) {
      badge.style.display = 'flex';
      badge.title = pendientes.length + ' suplencia(s) pendiente(s) de firmar';
    } else {
      // Solo ocultar si tampoco hay hoja activa sin firmar
      var hayHojaPendiente = false;
      try {
        var hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
        if (hoja) {
          var firmas = hoja.firmas || {};
          var yaFirme = firmas[String(instActualId)] && firmas[String(instActualId)].data;
          hayHojaPendiente = !yaFirme;
        }
      } catch(e2) {}
      if (!hayHojaPendiente) badge.style.display = 'none';
    }
  } catch(e) {}
}

/**
 * Devuelve los registros donde instId fue SUPLENTE y no ha firmado como suplente.
 */
function slk_obtenerSuplenciasPendientesFirma(instId) {
  try {
    var firmasSup = slk_cargarFirmasSuplencias();
    var yaFirmados = Object.keys(firmasSup); // IDs de registros ya firmados

    return (registros || []).filter(function(r) {
      return r.estado === 'sub' &&
             String(r.suplente_id) === String(instId) &&
             !yaFirmados.includes(String(r.id));
    }).sort(function(a, b) {
      return (b.fecha || '').localeCompare(a.fecha || '');
    });
  } catch(e) { return []; }
}

/**
 * Renderiza la sección de suplencias pendientes de firma dentro del tab firma.
 * Se llama DESPUÉS de instRenderFirmaTab() (via hook).
 */
function slk_renderFirmaSuplencias() {
  try {
    if (typeof instActualId === 'undefined' || !instActualId) return;

    // ── Quitar sección previa donde sea que esté ──────────────────────
    var prev = document.getElementById('slk-sup-section');
    if (prev) prev.remove();

    var pendientes = slk_obtenerSuplenciasPendientesFirma(instActualId);
    var firmasSup  = slk_cargarFirmasSuplencias();
    var supsFirmadas = (registros || []).filter(function(r) {
      return r.estado === 'sub' &&
             String(r.suplente_id) === String(instActualId) &&
             firmasSup[String(r.id)];
    }).sort(function(a, b) {
      return (b.fecha || '').localeCompare(a.fecha || '');
    });

    // No mostrar nada si no hay nada relevante
    if (pendientes.length === 0 && supsFirmadas.length === 0) return;

    // ── Determinar dónde insertar la sección ──────────────────────────
    // Si hay hoja activa: dentro de inst-firma-activa (al final)
    // Si NO hay hoja activa: dentro de inst-panel-firma, después del bloque "sin hoja"
    var panelFirma = document.getElementById('inst-firma-activa');
    var insertarEnPanel = false;
    if (!panelFirma || panelFirma.style.display === 'none') {
      // No hay hoja activa → insertar en el panel general y mostrar sin depender de hoja
      panelFirma = document.getElementById('inst-panel-firma');
      insertarEnPanel = true;
    }
    if (!panelFirma) return;

    var section = document.createElement('div');
    section.id = 'slk-sup-section';
    section.style.cssText = insertarEnPanel
      ? 'margin-top:1rem;padding:0 .1rem'
      : 'margin-top:1.2rem';

    // ── Título de sección ──────────────────────────────────────────────
    section.innerHTML = [
      insertarEnPanel
        ? '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;letter-spacing:2.5px;color:var(--blue);margin-bottom:.25rem">FIRMA DE SUPLENCIAS</div>' +
          '<div style="font-size:.7rem;color:var(--txt2);margin-bottom:1.1rem">Clases en las que fuiste suplente y aún no has firmado.</div>'
        : '',
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;letter-spacing:2px;color:var(--blue);margin-bottom:.25rem">',
        'SUPLENCIAS — FIRMA COMO SUPLENTE',
      '</div>',
      '<div style="font-size:.7rem;color:var(--txt3);margin-bottom:.9rem">',
        'Clases en las que fuiste suplente. Debes firmarlas para autorizar tu pago.',
      '</div>'
    ].join('');

    // ── Lista de pendientes ────────────────────────────────────────────
    if (pendientes.length > 0) {
      var listHTML = '<div style="margin-bottom:.8rem">' +
        '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold2);font-weight:700;margin-bottom:.4rem">⏳ Pendientes de firma</div>';

      pendientes.forEach(function(r) {
        var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
        var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday: 'short', day: '2-digit', month: 'short'
        });
        var asisN = parseInt(r.asistentes) || 0;
        var capN  = parseInt(r.cap) || 0;
        var afoP  = (capN > 0) ? Math.round(asisN / capN * 100) : null;
        var afoCol = afoP !== null
          ? (afoP >= 70 ? 'var(--neon)' : afoP >= 40 ? 'var(--gold2)' : 'var(--red2)')
          : 'var(--txt3)';

        listHTML += [
          '<div style="background:var(--panel2);border:1px solid rgba(77,184,232,.3);border-radius:12px;',
              'padding:.7rem .9rem;margin-bottom:.5rem;display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">',
            '<div style="flex:1;min-width:0">',
              '<div style="font-weight:700;font-size:.82rem;color:var(--txt)">', r.clase || '—', '</div>',
              '<div style="font-size:.65rem;color:var(--txt2);margin-top:2px">',
                '<span style="font-family:\'DM Mono\',monospace">', r.hora || '', '</span>',
                ' &nbsp;·&nbsp; ', fd,
                ' &nbsp;·&nbsp; Titular: <strong>', instOrig ? instOrig.nombre : '—', '</strong>',
              '</div>',
              afoP !== null
                ? '<div style="font-size:.62rem;color:' + afoCol + ';margin-top:3px">' + asisN + ' asistentes · ' + afoP + '%</div>'
                : '',
            '</div>',
            '<button onclick="slk_abrirFirmarSuplencia(' + r.id + ')" style="',
              'padding:6px 14px;border-radius:8px;border:1px solid var(--blue);',
              'background:rgba(77,184,232,.12);color:var(--blue);font-size:.7rem;',
              'cursor:pointer;white-space:nowrap;font-family:\'Outfit\',sans-serif;',
              'font-weight:600;flex-shrink:0;transition:background .15s"',
              ' onmouseover="this.style.background=\'rgba(77,184,232,.25)\'"',
              ' onmouseout="this.style.background=\'rgba(77,184,232,.12)\'">',
              '✏ Firmar',
            '</button>',
          '</div>'
        ].join('');
      });

      listHTML += '</div>';
      section.innerHTML += listHTML;
    }

    // ── Lista de ya firmadas ────────────────────────────────────────────
    if (supsFirmadas.length > 0) {
      var firmHTML = '<div>' +
        '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--neon);font-weight:700;margin-bottom:.4rem">✔ Firmadas</div>';

      supsFirmadas.forEach(function(r) {
        var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
        var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday: 'short', day: '2-digit', month: 'short'
        });
        var fSup = firmasSup[String(r.id)];
        var fDate = fSup && fSup.ts
          ? new Date(fSup.ts).toLocaleDateString('es-MX', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})
          : '';

        firmHTML += [
          '<div style="background:var(--panel2);border:1px solid rgba(94,255,160,.2);border-radius:12px;',
              'padding:.6rem .9rem;margin-bottom:.4rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem">',
            '<div style="flex:1;min-width:0">',
              '<div style="font-weight:600;font-size:.8rem;color:var(--neon)">', r.clase || '—', '</div>',
              '<div style="font-size:.62rem;color:var(--txt3);margin-top:2px">',
                '<span style="font-family:\'DM Mono\',monospace">', r.hora || '', '</span>',
                ' &nbsp;·&nbsp; ', fd,
                instOrig ? ' &nbsp;·&nbsp; Titular: ' + instOrig.nombre : '',
              '</div>',
              fDate ? '<div style="font-size:.6rem;color:var(--neon);margin-top:2px">Firmado: ' + fDate + '</div>' : '',
            '</div>',
            '<span style="font-size:.72rem;padding:4px 10px;border-radius:10px;background:rgba(94,255,160,.12);',
              'color:var(--neon);font-weight:700;flex-shrink:0">✔ Firmado</span>',
          '</div>'
        ].join('');
      });

      firmHTML += '</div>';
      section.innerHTML += firmHTML;
    }

    // ── Insertar sección ──────────────────────────────────────────────
    if (insertarEnPanel) {
      // Insertar AL FINAL del panel (después del bloque "sin hoja")
      panelFirma.appendChild(section);
    } else {
      // Insertar al final de inst-firma-activa
      panelFirma.appendChild(section);
    }

  } catch(e) { console.warn('[slk] renderFirmaSuplencias:', e); }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 6 — MODAL DE FIRMA DE SUPLENCIA
// Canvas propio, independiente del modal de hoja de firmas semanal.
// ─────────────────────────────────────────────────────────────────────────────

var _slkFirmaRegId   = null;
var _slkFirmaCanvas  = null;
var _slkFirmaCtx     = null;
var _slkFirmaDrawing = false;

function slk_abrirFirmarSuplencia(regId) {
  _slkFirmaRegId = regId;

  var reg = (registros || []).find(function(r) { return r.id === regId; });
  if (!reg) { showToast('Registro no encontrado', 'err'); return; }

  var instOrig = (instructores || []).find(function(i) { return i.id === reg.inst_id; });
  var instSup  = (instructores || []).find(function(i) { return String(i.id) === String(reg.suplente_id); });
  var fd = new Date((reg.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  // Crear/reutilizar modal
  var modal = document.getElementById('slk-modal-firma-sup');
  if (!modal) {
    modal = document.createElement('div');
    modal.id    = 'slk-modal-firma-sup';
    modal.className = 'ov';
    modal.style.cssText = 'z-index:2000';
    document.body.appendChild(modal);

    // Cerrar al click en fondo
    modal.addEventListener('click', function(e) {
      if (e.target === modal) slk_cerrarFirmarSuplencia();
    });
  }

  modal.innerHTML = [
    '<div class="modal" style="max-width:480px;width:95vw;padding:1.2rem 1.1rem">',

      // Cerrar
      '<button class="mcls" onclick="slk_cerrarFirmarSuplencia()" style="position:absolute;top:10px;right:10px">',
        '<svg class="ico" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      '</button>',

      // Título
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.15rem;letter-spacing:2.5px;color:var(--blue);margin-bottom:.9rem">',
        'FIRMA DE SUPLENCIA',
      '</div>',

      // Info de la clase
      '<div style="background:linear-gradient(135deg,var(--panel2),rgba(15,30,20,.6));border:1px solid rgba(77,184,232,.2);border-radius:12px;padding:.8rem 1rem;margin-bottom:1rem">',
        '<div style="font-weight:700;font-size:.9rem;color:var(--txt)">', reg.clase || '—', '</div>',
        '<div style="font-size:.7rem;color:var(--txt2);margin-top:4px">',
          '<span style="font-family:\'DM Mono\',monospace">', reg.hora || '', '</span>',
          ' &nbsp;·&nbsp; ', fd,
        '</div>',
        '<div style="font-size:.7rem;color:var(--txt2);margin-top:3px">',
          'Titular: <strong>', instOrig ? instOrig.nombre : '—', '</strong>',
        '</div>',
        '<div style="font-size:.7rem;color:var(--blue);margin-top:3px;font-weight:600">',
          'Suplente: ', instSup ? instSup.nombre : '—',
        '</div>',
        '<div style="font-size:.68rem;color:var(--txt3);margin-top:3px">',
          'Asistentes: <strong>', reg.asistentes !== undefined ? reg.asistentes : '—', '</strong>',
          (reg.cap > 0 ? ' / ' + reg.cap + ' cap.' : ''),
        '</div>',
      '</div>',

      // Texto instrucción
      '<div style="font-size:.7rem;color:var(--txt2);margin-bottom:.5rem;text-align:center">',
        'Firma abajo como <strong>instructor suplente</strong> para confirmar que impartiste esta clase',
      '</div>',

      // Canvas
      '<div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:.8rem">',
        '<div style="padding:.5rem .9rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.15)">',
          '<span style="font-size:.62rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:600">✏ Firma aquí como suplente</span>',
          '<button onclick="slk_limpiarFirmaSupCanvas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--txt3);font-size:.62rem;padding:3px 9px;cursor:pointer;font-family:\'Outfit\',sans-serif">↺ Limpiar</button>',
        '</div>',
        '<canvas id="slk-sup-canvas" style="display:block;width:100%;touch-action:none;cursor:crosshair;background:#fff" height="180"></canvas>',
      '</div>',

      // Botón guardar
      '<button onclick="slk_guardarFirmasSuplencia()" style="',
          'width:100%;padding:.75rem;border-radius:10px;border:none;',
          'background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;',
          'font-family:\'Outfit\',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;',
          'letter-spacing:.5px;transition:opacity .2s"',
        ' onmouseover="this.style.opacity=\'.85\'"',
        ' onmouseout="this.style.opacity=\'1\'">',
        '✔ Guardar firma de suplencia',
      '</button>',

    '</div>'
  ].join('');

  modal.classList.add('on');

  // Inicializar canvas
  setTimeout(function() {
    var c = document.getElementById('slk-sup-canvas');
    if (!c) return;
    var wrap = c.parentElement;
    c.width  = wrap ? wrap.clientWidth : 340;
    c.height = 180;
    _slkFirmaCanvas = c;
    _slkFirmaCtx    = c.getContext('2d');
    _slkFirmaCtx.fillStyle = '#ffffff';
    _slkFirmaCtx.fillRect(0, 0, c.width, c.height);
    _slkFirmaDrawing = false;

    // Mouse
    c.addEventListener('mousedown', function(e) {
      _slkFirmaDrawing = true;
      _slkFirmaCtx.beginPath();
      var r = c.getBoundingClientRect();
      _slkFirmaCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
    });
    c.addEventListener('mousemove', function(e) {
      if (!_slkFirmaDrawing) return;
      var r = c.getBoundingClientRect();
      _slkFirmaCtx.lineWidth = 2.5;
      _slkFirmaCtx.lineCap = 'round';
      _slkFirmaCtx.strokeStyle = '#1a1a1a';
      _slkFirmaCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
      _slkFirmaCtx.stroke();
    });
    c.addEventListener('mouseup',    function() { _slkFirmaDrawing = false; });
    c.addEventListener('mouseleave', function() { _slkFirmaDrawing = false; });

    // Touch
    c.addEventListener('touchstart', function(e) {
      e.preventDefault();
      _slkFirmaDrawing = true;
      var r = c.getBoundingClientRect();
      var t = e.touches[0];
      _slkFirmaCtx.beginPath();
      _slkFirmaCtx.moveTo(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });
    c.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (!_slkFirmaDrawing) return;
      var r = c.getBoundingClientRect();
      var t = e.touches[0];
      _slkFirmaCtx.lineWidth = 2.5;
      _slkFirmaCtx.lineCap = 'round';
      _slkFirmaCtx.strokeStyle = '#1a1a1a';
      _slkFirmaCtx.lineTo(t.clientX - r.left, t.clientY - r.top);
      _slkFirmaCtx.stroke();
    }, { passive: false });
    c.addEventListener('touchend', function() { _slkFirmaDrawing = false; });
  }, 80);
}

function slk_cerrarFirmarSuplencia() {
  var modal = document.getElementById('slk-modal-firma-sup');
  if (modal) modal.classList.remove('on');
  _slkFirmaRegId  = null;
  _slkFirmaCanvas = null;
  _slkFirmaCtx    = null;
}

function slk_limpiarFirmaSupCanvas() {
  if (!_slkFirmaCtx || !_slkFirmaCanvas) return;
  _slkFirmaCtx.fillStyle = '#ffffff';
  _slkFirmaCtx.fillRect(0, 0, _slkFirmaCanvas.width, _slkFirmaCanvas.height);
}

async function slk_guardarFirmasSuplencia() {
  if (!_slkFirmaCanvas || !_slkFirmaRegId) return;

  // Verificar que hay trazo
  var data = _slkFirmaCtx.getImageData(0, 0, _slkFirmaCanvas.width, _slkFirmaCanvas.height).data;
  var hayTrazo = false;
  for (var i = 0; i < data.length; i += 4) {
    if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) { hayTrazo = true; break; }
  }
  if (!hayTrazo) { showToast('Firma el área antes de guardar', 'warn'); return; }

  var inst = (instructores || []).find(function(i) { return i.id === instActualId; });
  var dataUrl = _slkFirmaCanvas.toDataURL('image/png');

  // Guardar en localStorage
  var firmasSup = slk_cargarFirmasSuplencias();
  firmasSup[String(_slkFirmaRegId)] = {
    data:   dataUrl,
    nombre: inst ? inst.nombre : '—',
    ts:     new Date().toISOString(),
    instId: instActualId
  };
  slk_guardarFirmasSuplencias(firmasSup);

  // Subir a Firebase (nodo propio para no interferir con hojaFirmasActiva)
  if (typeof fbDb !== 'undefined' && fbDb) {
    try {
      await fbDb.ref('fitness/firmasSuplencias/' + _slkFirmaRegId).set(firmasSup[String(_slkFirmaRegId)]);
    } catch(e) {}
  }

  if (typeof registrarLog === 'function') {
    registrarLog('instructor', 'Firma suplencia registrada: ' + (inst ? inst.nombre : '—') + ' · reg#' + _slkFirmaRegId);
  }

  showToast('✔ Firma de suplencia guardada', 'ok');
  slk_cerrarFirmarSuplencia();

  // Refrescar tab firma para mostrar la nueva firma
  if (typeof instRenderFirmaTab === 'function') {
    setTimeout(instRenderFirmaTab, 200);
  }

  // Actualizar badge
  slk_actualizarBadgeSuplencias();
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 7 — HELPERS DE UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Muestra un banner discreto en el modal de clase cuando hay suplencia planificada.
 */
function slk_mostrarBannerSuplencia(modalId, sup, anchorId) {
  try {
    var prev = document.getElementById('slk-banner-clase');
    if (prev) prev.remove();

    var anchor = document.getElementById(anchorId);
    if (!anchor) return;

    var supNom = '—';
    if (sup.suplente_id) {
      var inst = (instructores || []).find(function(i) { return String(i.id) === String(sup.suplente_id); });
      if (inst) supNom = inst.nombre;
    } else if (sup.suplente_nombre) {
      supNom = sup.suplente_nombre;
    }

    var motivoMap = {
      permiso: 'Permiso', vacaciones: 'Vacaciones',
      falta: 'Falta', incapacidad: 'Incapacidad', otro: 'Otro'
    };
    var motivoTxt = (sup.motivo && motivoMap[sup.motivo]) ? motivoMap[sup.motivo] : (sup.motivo || '—');

    var banner = document.createElement('div');
    banner.id = 'slk-banner-clase';
    banner.style.cssText = [
      'background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.35);',
      'border-radius:10px;padding:.55rem .8rem;margin-bottom:.6rem;',
      'font-size:.7rem;color:var(--blue);display:flex;align-items:flex-start;gap:.5rem'
    ].join('');
    banner.innerHTML = [
      '<svg viewBox="0 0 20 20" style="width:14px;height:14px;flex-shrink:0;margin-top:1px" fill="none" stroke="currentColor" stroke-width="1.5">',
        '<rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" y1="9" x2="17" y2="9"/>',
        '<line x1="7" y1="2" x2="7" y2="6"/><line x1="13" y1="2" x2="13" y2="6"/>',
      '</svg>',
      '<div>',
        '<strong>Suplencia planificada:</strong> ',
        supNom,
        ' &nbsp;·&nbsp; ',
        motivoTxt,
        sup.nota ? ' &nbsp;·&nbsp; <em>' + sup.nota + '</em>' : '',
        '<br><span style="color:var(--txt3);font-size:.63rem">Los campos se pre-llenaron automáticamente. Puedes modificarlos.</span>',
      '</div>'
    ].join('');

    // Insertar antes del ancla (preview del horario)
    anchor.parentElement.insertBefore(banner, anchor);
  } catch(e) {}
}

/**
 * Muestra aviso dentro de la tarjeta del recorrido cuando hay suplencia planificada.
 */
function slk_mostrarAvisoRecorrido(sup) {
  try {
    var prev = document.getElementById('slk-aviso-rec');
    if (prev) prev.remove();

    var supNom = '—';
    if (sup.suplente_id) {
      var inst = (instructores || []).find(function(i) { return String(i.id) === String(sup.suplente_id); });
      if (inst) supNom = inst.nombre;
    } else if (sup.suplente_nombre) {
      supNom = sup.suplente_nombre;
    }

    var card = document.getElementById('turbo-card');
    if (!card) return;

    var aviso = document.createElement('div');
    aviso.id = 'slk-aviso-rec';
    aviso.style.cssText = [
      'background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.3);',
      'border-radius:8px;padding:.45rem .7rem;margin-top:.4rem;',
      'font-size:.65rem;color:var(--blue);display:flex;align-items:center;gap:.4rem'
    ].join('');
    aviso.innerHTML = [
      '<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><line x1="10" y1="7" x2="10" y2="11"/><circle cx="10" cy="13.5" r=".6" fill="currentColor"/></svg>',
      '<span><strong>Suplencia planificada:</strong> ' + supNom + '</span>'
    ].join('');

    // Insertar al inicio de la tarjeta
    var firstChild = card.firstChild;
    card.insertBefore(aviso, firstChild);
  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — REPORTE DE SUPLENCIAS CON FIRMAS (para coordinador)
// Expone slk_generarReporteSuplenciasConFirmas(ini, fin) que devuelve HTML
// imprimible con la firma del suplente incluida.
// ─────────────────────────────────────────────────────────────────────────────

function slk_generarReporteSuplenciasConFirmas(fechaIni, fechaFin) {
  var firmasSup = slk_cargarFirmasSuplencias();

  var sups = (registros || []).filter(function(r) {
    return r.estado === 'sub' && r.fecha >= fechaIni && r.fecha <= fechaFin;
  }).sort(function(a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });

  if (sups.length === 0) {
    showToast('Sin suplencias en el periodo', 'warn');
    return;
  }

  var rows = sups.map(function(r) {
    var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
    var instSup  = (instructores || []).find(function(i) { return String(i.id) === String(r.suplente_id); });
    var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    var firma = firmasSup[String(r.id)];
    var firmaHtml = firma && firma.data
      ? '<img src="' + firma.data + '" style="height:36px;max-width:120px;object-fit:contain" alt="Firma">'
      : '<span style="color:#c00;font-size:.7rem">Sin firma</span>';

    return [
      '<tr>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">', fd, '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">', r.clase || '—', '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">', r.hora || '', '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5">', instOrig ? instOrig.nombre : '—', '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:600">', instSup ? instSup.nombre : '—', '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">', r.asistentes !== undefined ? r.asistentes : '—', '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">', firmaHtml, '</td>',
      '</tr>'
    ].join('');
  }).join('');

  var html = [
    '<div style="font-family:\'Outfit\',sans-serif;color:#111">',
      '<div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem">',
        '<h1 style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;letter-spacing:2px;color:#1a7a45;margin:0">',
          'REPORTE DE SUPLENCIAS CON FIRMAS',
        '</h1>',
        '<p style="color:#555;font-size:.8rem;margin:.2rem 0 0">',
          'Club Campestre Aguascalientes · Coordinación Fitness',
        '</p>',
        '<p style="color:#333;font-size:.8rem;margin:.2rem 0 0">',
          'Periodo: <strong>', fechaIni, '</strong> al <strong>', fechaFin, '</strong>',
          ' · Total suplencias: <strong>', sups.length, '</strong>',
        '</p>',
      '</div>',
      '<table style="width:100%;border-collapse:collapse;font-size:.79rem">',
        '<thead>',
          '<tr style="background:#f0f7f3">',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Fecha</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Clase</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Hora</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Titular</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Suplente</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Asist.</th>',
            '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">Firma Suplente</th>',
          '</tr>',
        '</thead>',
        '<tbody>', rows, '</tbody>',
      '</table>',
    '</div>'
  ].join('');

  // Usar el modal de impresión existente
  var ttl = document.getElementById('print-ttl');
  var body = document.getElementById('print-body');
  if (ttl) ttl.textContent = 'Suplencias con firmas — ' + fechaIni + ' al ' + fechaFin;
  if (body) body.innerHTML = html;
  var mPrint = document.getElementById('m-print');
  if (mPrint) mPrint.classList.add('on');
}

// Exponer como función global para el coordinador
window.slk_generarReporteSuplenciasConFirmas = slk_generarReporteSuplenciasConFirmas;
window.slk_abrirFirmarSuplencia             = slk_abrirFirmarSuplencia;
window.slk_cerrarFirmarSuplencia            = slk_cerrarFirmarSuplencia;
window.slk_limpiarFirmaSupCanvas            = slk_limpiarFirmaSupCanvas;
window.slk_guardarFirmasSuplencia           = slk_guardarFirmasSuplencia;


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 9 — AUTO-INIT: agregar botón "Reporte con Firmas" al modal de suplencias
// Se ejecuta una vez cuando el DOM está listo.
// ─────────────────────────────────────────────────────────────────────────────
(function slk_autoInit() {
  function inject() {
    // Agregar botón al bloque de exportar del modal m-suplencias
    var exportBtns = document.getElementById('sup-export-btns');
    if (exportBtns && !document.getElementById('slk-btn-reporte-firmas')) {
      var btn = document.createElement('button');
      btn.id = 'slk-btn-reporte-firmas';
      btn.className = 'btn no-print';
      btn.style.cssText = 'background:linear-gradient(135deg,rgba(41,128,185,.18),rgba(41,128,185,.08));border:1px solid var(--blue);color:var(--blue)';
      btn.title = 'Generar reporte de suplencias con firmas digitales de los suplentes';
      btn.innerHTML = [
        '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4">',
          '<rect x="5" y="2" width="10" height="16" rx="2"/>',
          '<path d="M9 12 Q10.5 10 12 12" stroke-linecap="round"/>',
          '<line x1="8" y1="7" x2="12" y2="7" stroke-linecap="round"/>',
        '</svg> Con Firmas'
      ].join('');
      btn.addEventListener('click', function() {
        var ini = document.getElementById('sup-fecha-ini');
        var fin = document.getElementById('sup-fecha-fin');
        if (!ini || !ini.value || !fin || !fin.value) {
          if (typeof showToast === 'function') showToast('Selecciona primero el rango de fechas y consulta', 'warn');
          return;
        }
        slk_generarReporteSuplenciasConFirmas(ini.value, fin.value);
      });
      exportBtns.appendChild(btn);
    }
  }

  // Intentar al cargar y con retry por si el DOM tarda
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    setTimeout(inject, 800);
  }
  // Retry adicional por si el modal se renderiza tarde
  setTimeout(inject, 3000);
})();
