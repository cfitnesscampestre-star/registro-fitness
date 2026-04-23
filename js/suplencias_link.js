// ═══════════════════════════════════════════════════════════════════════════
// SUPLENCIAS_LINK.JS  —  v2.0
// Integra el planificador de suplencias con:
//   1. Pre-llenado automático en modal "+ Clase" (lee fecha seleccionada)
//   2. Pre-llenado automático en recorrido (turboMostrar)
//   3. Sincronización bidireccional clase/recorrido → suplenciasPlan + Firebase
//   4. Firmas de suplencias en el portal del instructor (suplente)
//   5. Badge de pendientes de firma en el tab
//   6. firmasSuplencias incluidas en payload de Firebase (sincronización real)
//
// INSTALACIÓN: <script src="js/suplencias_link.js"></script>
// después de portal.js y antes de pwa.js en index.html
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ─── Clave localStorage para firmas de suplencias ────────────────────────
var SLK_SUP_FIRMAS_KEY = 'fc_firmas_suplencias';

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 1 — HOOKS: se instalan cuando el DOM+scripts estén listos
// ─────────────────────────────────────────────────────────────────────────────
(function() {
  function waitReady(fn, retries) {
    retries = retries || 60;
    if (typeof autoRellenarHorario === 'function' &&
        typeof turboMostrar       === 'function' &&
        typeof guardarClase       === 'function' &&
        typeof turboGuardar       === 'function' &&
        typeof instCargarHojaFirmas === 'function' &&
        typeof instRenderFirmaTab   === 'function' &&
        typeof sincronizarFirebase  === 'function') {
      fn();
    } else if (retries > 0) {
      setTimeout(function() { waitReady(fn, retries - 1); }, 200);
    }
  }

  waitReady(function() {

    // ── 1A: Hook en autoRellenarHorario → pre-llenar modal clase ─────
    var _origAutoRellenar = autoRellenarHorario;
    autoRellenarHorario = function() {
      _origAutoRellenar.apply(this, arguments);
      slk_preLlenarModalClase();
    };

    // ── 1B: También escuchar cambio de fecha en el modal clase ────────
    var rcFecha = document.getElementById('rc-fecha');
    if (rcFecha) {
      rcFecha.addEventListener('change', function() {
        slk_preLlenarModalClase();
      });
    }

    // ── 1C: Hook en turboMostrar → pre-llenar recorrido ───────────────
    var _origTurboMostrar = turboMostrar;
    turboMostrar = function() {
      _origTurboMostrar.apply(this, arguments);
      slk_preLlenarRecorrido();
    };

    // ── 1D: Hook en guardarClase → sincronizar a suplenciasPlan ───────
    var _origGuardarClase = guardarClase;
    guardarClase = function() {
      _origGuardarClase.apply(this, arguments);
      setTimeout(slk_sincronizarDesdeClase, 100);
    };

    // ── 1E: Hook en turboGuardar → sincronizar a suplenciasPlan ───────
    var _origTurboGuardar = turboGuardar;
    turboGuardar = function() {
      _origTurboGuardar.apply(this, arguments);
      setTimeout(slk_sincronizarDesdeRecorrido, 100);
    };

    // ── 1F: Hook en instCargarHojaFirmas → badge de suplencias ────────
    var _origInstCargarHojaFirmas = instCargarHojaFirmas;
    instCargarHojaFirmas = function() {
      _origInstCargarHojaFirmas.apply(this, arguments);
      slk_actualizarBadgeSuplencias();
    };

    // ── 1G: Hook en instRenderFirmaTab → sección de suplencias ────────
    var _origInstRenderFirmaTab = instRenderFirmaTab;
    instRenderFirmaTab = function() {
      _origInstRenderFirmaTab.apply(this, arguments);
      slk_renderFirmaSuplencias();
    };

    // ── 1H: CRÍTICO — hook en sincronizarFirebase para incluir
    //        firmasSuplencias en el payload que sube a Firebase ─────────
    var _origSincronizarFirebase = sincronizarFirebase;
    sincronizarFirebase = function() {
      // Antes de subir, inyectar firmasSuplencias en el nodo fitness
      slk_inyectarFirmasEnFirebase();
      return _origSincronizarFirebase.apply(this, arguments);
    };

    // ── 1I: Hook en el listener de Firebase para leer firmasSuplencias
    //        cuando llegan desde otro dispositivo ───────────────────────
    slk_hookFirebaseListener();

    // ── 1J: Forzar recarga de firmasSuplencias desde Firebase al init ──
    setTimeout(slk_cargarFirmasSuplenciasDesdeFirebase, 2000);
  });
})();


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 2 — SINCRONIZACIÓN FIREBASE (el problema principal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inyecta firmasSuplencias en Firebase ANTES de que sincronizarFirebase suba.
 * Usa el nodo fitness/firmasSuplencias separado para no interferir con el payload.
 */
function slk_inyectarFirmasEnFirebase() {
  try {
    if (typeof fbDb === 'undefined' || !fbDb) return;
    var firmas = slk_cargarFirmasSuplencias();
    if (Object.keys(firmas).length === 0) return;
    // Subir sin await (no bloqueante) — se sincroniza en paralelo
    fbDb.ref('fitness/firmasSuplencias').set(firmas).catch(function() {});
  } catch(e) {}
}

/**
 * Engancha el listener de Firebase existente para leer firmasSuplencias
 * cuando llegan cambios desde otro dispositivo.
 * Funciona observando el nodo directamente.
 */
function slk_hookFirebaseListener() {
  // Esperar a que fbDb esté disponible
  var intentos = 0;
  var timer = setInterval(function() {
    intentos++;
    if (intentos > 40) { clearInterval(timer); return; }
    if (typeof fbDb === 'undefined' || !fbDb) return;
    clearInterval(timer);

    // Escuchar cambios en firmasSuplencias desde cualquier dispositivo
    fbDb.ref('fitness/firmasSuplencias').on('value', function(snap) {
      try {
        var data = snap.val();
        if (!data) return;
        // Merge con las locales (gana la más reciente)
        var local = slk_cargarFirmasSuplencias();
        var actualizado = false;
        Object.keys(data).forEach(function(regId) {
          var remota = data[regId];
          var local_firma = local[regId];
          if (!local_firma) {
            local[regId] = remota;
            actualizado = true;
          } else {
            var tsRemota = new Date(remota.ts || 0).getTime();
            var tsLocal  = new Date(local_firma.ts || 0).getTime();
            if (tsRemota > tsLocal) {
              local[regId] = remota;
              actualizado = true;
            }
          }
        });
        if (actualizado) {
          slk_guardarFirmasSuplencias(local);
          // Si el instructor está en el tab firma, refrescar
          if (typeof instActualId !== 'undefined' && instActualId) {
            var panel = document.getElementById('inst-panel-firma');
            if (panel && panel.style.display !== 'none') {
              slk_renderFirmaSuplencias();
              slk_actualizarBadgeSuplencias();
            }
          }
        }
      } catch(e) {}
    });

    // También escuchar cambios en suplenciasPlan para que el pre-llenado
    // funcione en el celular cuando la computadora guarda una suplencia
    fbDb.ref('fitness/suplencias').on('value', function(snap) {
      try {
        var data = snap.val();
        if (!data || typeof fbReceiving === 'undefined' || fbReceiving) return;
        // Solo actualizar si no somos nosotros los que estamos subiendo
        var nuevas = Object.values(data);
        if (nuevas.length === 0) return;
        // Merge con suplenciasPlan local
        nuevas.forEach(function(s) {
          var idx = suplenciasPlan.findIndex(function(p) { return String(p.id) === String(s.id); });
          if (idx < 0) {
            suplenciasPlan.push(s);
          } else {
            var tsLocal = new Date(suplenciasPlan[idx].ts || 0).getTime();
            var tsRemota = new Date(s.ts || 0).getTime();
            if (tsRemota > tsLocal) suplenciasPlan[idx] = s;
          }
        });
      } catch(e) {}
    });
  }, 300);
}

/**
 * Carga firmasSuplencias desde Firebase una vez al iniciar
 * (para cuando el instructor abre el portal en un nuevo dispositivo).
 */
function slk_cargarFirmasSuplenciasDesdeFirebase() {
  try {
    if (typeof fbDb === 'undefined' || !fbDb) return;
    fbDb.ref('fitness/firmasSuplencias').once('value', function(snap) {
      try {
        var data = snap.val();
        if (!data) return;
        var local = slk_cargarFirmasSuplencias();
        var actualizado = false;
        Object.keys(data).forEach(function(regId) {
          if (!local[regId]) {
            local[regId] = data[regId];
            actualizado = true;
          }
        });
        if (actualizado) {
          slk_guardarFirmasSuplencias(local);
          slk_actualizarBadgeSuplencias();
        }
      } catch(e) {}
    });
  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 3 — PRE-LLENADO MODAL "+ CLASE"
// Lee la fecha del campo rc-fecha (que puede ser diferente de hoy)
// ─────────────────────────────────────────────────────────────────────────────
function slk_preLlenarModalClase() {
  try {
    var instId   = parseInt(document.getElementById('rc-inst').value);
    var claseVal = (document.getElementById('rc-clase') || {}).value;
    var diaVal   = (document.getElementById('rc-dia')   || {}).value;
    var horaVal  = (document.getElementById('rc-hora')  || {}).value;
    var fechaEl  = document.getElementById('rc-fecha');
    var fechaVal = fechaEl ? fechaEl.value : '';

    if (!instId || !claseVal || !diaVal || !horaVal || !fechaVal) return;

    // Buscar en suplenciasPlan (ya sincronizado desde Firebase)
    var sup = (suplenciasPlan || []).find(function(s) {
      return String(s.inst_id) === String(instId) &&
             s.clase  === claseVal &&
             s.dia    === diaVal   &&
             s.hora   === horaVal  &&
             s.fecha  === fechaVal &&
             s.estado !== 'rechazado';
    });

    if (!sup) return;

    // No re-llenar si ya hay un registro guardado para esa combinación
    var yaRegistrado = (registros || []).some(function(r) {
      return String(r.inst_id) === String(instId) &&
             r.clase === claseVal && r.dia === diaVal &&
             r.hora  === horaVal  && r.fecha === fechaVal &&
             (r.estado === 'sub' || r.estado === 'ok' || r.estado === 'falta');
    });
    if (yaRegistrado) return;

    // Pre-llenar estado sub
    var selEst = document.getElementById('rc-est');
    if (selEst && selEst.value !== 'sub') {
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
      if (selMot) selMot.value = sup.motivo;
    }

    // Banner informativo
    slk_mostrarBannerSuplencia(sup);

  } catch(e) { console.warn('[slk] preLlenarModalClase:', e); }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 4 — PRE-LLENADO RECORRIDO
// ─────────────────────────────────────────────────────────────────────────────
function slk_preLlenarRecorrido() {
  try {
    if (typeof recActual === 'undefined' || !recActual ||
        typeof recIdx    === 'undefined') return;
    var c = (recActual.clasesActivas || [])[recIdx];
    if (!c) return;

    var sup = (suplenciasPlan || []).find(function(s) {
      return String(s.inst_id) === String(c.inst_id) &&
             s.clase  === c.clase       &&
             s.dia    === recActual.dia &&
             s.hora   === c.hora        &&
             s.fecha  === recActual.fecha &&
             s.estado !== 'rechazado';
    });

    if (!sup) return;

    // Auto-seleccionar estado "sub"
    if (typeof turboSetPres === 'function') turboSetPres('sub');

    // Seleccionar suplente
    if (sup.suplente_id) {
      var selSup = document.getElementById('tc-suplente');
      if (selSup) selSup.value = String(sup.suplente_id);
    }

    // Motivo
    if (sup.motivo) {
      var selMot = document.getElementById('tc-motivo');
      if (selMot) selMot.value = sup.motivo;
    }

    // Aviso visual
    slk_mostrarAvisoRecorrido(sup);

  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 5 — SINCRONIZACIÓN CLASE → suplenciasPlan
// ─────────────────────────────────────────────────────────────────────────────
function slk_sincronizarDesdeClase() {
  try {
    var recientes = (registros || [])
      .filter(function(r) { return r.estado === 'sub' && r.suplente_id; })
      .sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    var reg = recientes[0];
    if (!reg) return;
    if (Date.now() - (reg.updatedAt || 0) > 4000) return;
    slk_upsertSuplenciaPlan(reg);
  } catch(e) {}
}

function slk_sincronizarDesdeRecorrido() {
  try {
    if (typeof recActual === 'undefined' || !recActual || !recActual.items) return;
    recActual.items.forEach(function(item) {
      if (item.presente !== 'sub' || !item.suplente_id) return;
      slk_upsertSuplenciaPlan({
        inst_id:          item.inst_id,
        clase:            item.clase,
        dia:              recActual.dia,
        hora:             item.hora,
        fecha:            recActual.fecha,
        suplente_id:      item.suplente_id,
        motivo_suplencia: item.motivo_suplencia || 'permiso',
        nota:             item.obs || '',
        estado:           'sub'
      });
    });
  } catch(e) {}
}

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
      origen:          'registro'
    };

    var idx = (suplenciasPlan || []).findIndex(function(s) {
      return String(s.inst_id) === String(datos.inst_id) &&
             s.fecha === datos.fecha && s.dia === datos.dia && s.hora === datos.hora;
    });

    if (idx >= 0) { datos.id = suplenciasPlan[idx].id; suplenciasPlan[idx] = datos; }
    else suplenciasPlan.push(datos);

    if (typeof guardarSupLocal === 'function') guardarSupLocal();

    if (typeof fbDb !== 'undefined' && fbDb) {
      try { await fbDb.ref('fitness/suplencias/' + datos.id).set(datos); } catch(e) {}
    }

    if (typeof renderSupPlan === 'function') {
      var v = document.getElementById('v-sup-plan');
      if (v && v.classList.contains('on')) renderSupPlan();
    }
  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 6 — FIRMAS DE SUPLENCIAS: helpers de storage
// ─────────────────────────────────────────────────────────────────────────────
function slk_cargarFirmasSuplencias() {
  try {
    var raw = localStorage.getItem(SLK_SUP_FIRMAS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function slk_guardarFirmasSuplencias(obj) {
  try { localStorage.setItem(SLK_SUP_FIRMAS_KEY, JSON.stringify(obj)); } catch(e) {}
}

function slk_obtenerSuplenciasPendientesFirma(instId) {
  try {
    var firmasSup  = slk_cargarFirmasSuplencias();
    var yaFirmados = Object.keys(firmasSup);
    return (registros || []).filter(function(r) {
      return r.estado === 'sub' &&
             String(r.suplente_id) === String(instId) &&
             !yaFirmados.includes(String(r.id));
    }).sort(function(a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
  } catch(e) { return []; }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 7 — BADGE DE PENDIENTES
// ─────────────────────────────────────────────────────────────────────────────
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
      // Solo ocultar si tampoco hay hoja semanal pendiente
      var hayHojaPendiente = false;
      try {
        var hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
        if (hoja) {
          var firmas = hoja.firmas || {};
          hayHojaPendiente = !(firmas[String(instActualId)] && firmas[String(instActualId)].data);
        }
      } catch(e2) {}
      if (!hayHojaPendiente) badge.style.display = 'none';
    }
  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — RENDER DE SECCIÓN DE SUPLENCIAS EN TAB FIRMA DEL PORTAL
// Funciona con o sin hoja semanal activa
// ─────────────────────────────────────────────────────────────────────────────
function slk_renderFirmaSuplencias() {
  // Desactivado: el tab Suplencias dedicado reemplaza este bloque
  var prev = document.getElementById('slk-sup-section');
  if (prev) prev.remove(); // limpiar si quedó de una sesión anterior
  return;
  try {
    if (typeof instActualId === 'undefined' || !instActualId) return;

    var prev = document.getElementById('slk-sup-section');
    if (prev) prev.remove();

    var pendientes  = slk_obtenerSuplenciasPendientesFirma(instActualId);
    var firmasSup   = slk_cargarFirmasSuplencias();
    var supsFirmadas = (registros || []).filter(function(r) {
      return r.estado === 'sub' &&
             String(r.suplente_id) === String(instActualId) &&
             !!firmasSup[String(r.id)];
    }).sort(function(a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });

    if (pendientes.length === 0 && supsFirmadas.length === 0) return;

    // ── Decidir dónde insertar ──────────────────────────────────────
    var hojaActiva = document.getElementById('inst-firma-activa');
    var conHoja = hojaActiva && hojaActiva.style.display !== 'none';
    var contenedor = conHoja ? hojaActiva : document.getElementById('inst-panel-firma');
    if (!contenedor) return;

    var section = document.createElement('div');
    section.id = 'slk-sup-section';
    section.style.cssText = 'margin-top:1.2rem;padding-bottom:.5rem';

    var html = [
      '<div style="border-top:1px solid rgba(77,184,232,.25);padding-top:1rem;margin-top:.5rem">',
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1rem;letter-spacing:2.5px;color:var(--blue);margin-bottom:.2rem">',
          '⇄ Firma como Suplente',
        '</div>',
        '<div style="font-size:.68rem;color:var(--txt3);margin-bottom:.8rem">',
          'Clases en las que fuiste suplente — fírmalas para autorizar tu pago.',
        '</div>'
    ].join('');

    // ── Pendientes ──
    if (pendientes.length > 0) {
      pendientes.forEach(function(r) {
        var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
        var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
          weekday:'short', day:'2-digit', month:'short', year:'numeric'
        });
        var asis = parseInt(r.asistentes) || 0;
        var cap  = parseInt(r.cap) || 0;
        var afo  = cap > 0 ? Math.round(asis / cap * 100) : null;
        var afoCol = afo !== null ? (afo >= 70 ? 'var(--neon)' : afo >= 40 ? 'var(--gold2)' : 'var(--red2)') : 'var(--txt3)';

        html += [
          '<div style="background:var(--panel2);border:1px solid rgba(77,184,232,.3);border-left:3px solid var(--blue);',
              'border-radius:10px;padding:.65rem .85rem;margin-bottom:.45rem;',
              'display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">',
            '<div style="flex:1;min-width:0">',
              '<div style="font-weight:700;font-size:.84rem">', r.clase || '—', '</div>',
              '<div style="font-size:.64rem;color:var(--txt2);margin-top:2px">',
                '<span style="font-family:\'DM Mono\',monospace">', r.hora || '', '</span>',
                ' · ', fd,
                instOrig ? ' · Titular: <strong>' + instOrig.nombre + '</strong>' : '',
              '</div>',
              afo !== null
                ? '<div style="font-size:.6rem;color:' + afoCol + ';margin-top:3px">' + asis + ' asist. · ' + afo + '%</div>'
                : '',
            '</div>',
            '<button onclick="slk_abrirFirmarSuplencia(' + r.id + ')" style="',
                'padding:7px 14px;border-radius:8px;border:1px solid var(--blue);',
                'background:rgba(77,184,232,.13);color:var(--blue);font-size:.72rem;',
                'cursor:pointer;white-space:nowrap;font-family:\'Outfit\',sans-serif;',
                'font-weight:600;flex-shrink:0;transition:background .15s"',
                ' onmouseover="this.style.background=\'rgba(77,184,232,.28)\'"',
                ' onmouseout="this.style.background=\'rgba(77,184,232,.13)\'">',
              '✏ Firmar',
            '</button>',
          '</div>'
        ].join('');
      });
    }

    // ── Ya firmadas ──
    if (supsFirmadas.length > 0) {
      html += '<div style="margin-top:.5rem">';
      html += '<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--neon);font-weight:700;margin-bottom:.35rem">✔ Suplencias firmadas</div>';
      supsFirmadas.forEach(function(r) {
        var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
        var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
          day:'2-digit', month:'short', year:'numeric'
        });
        var fSup = firmasSup[String(r.id)];
        var fDate = fSup && fSup.ts
          ? new Date(fSup.ts).toLocaleDateString('es-MX', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})
          : '';
        html += [
          '<div style="background:var(--panel2);border:1px solid rgba(94,255,160,.2);border-left:3px solid var(--neon);',
              'border-radius:10px;padding:.55rem .85rem;margin-bottom:.35rem;',
              'display:flex;align-items:center;justify-content:space-between;gap:.5rem">',
            '<div style="flex:1;min-width:0">',
              '<div style="font-weight:600;font-size:.8rem;color:var(--neon)">', r.clase || '—', '</div>',
              '<div style="font-size:.62rem;color:var(--txt3);margin-top:2px">',
                r.hora || '', ' · ', fd,
                instOrig ? ' · ' + instOrig.nombre : '',
              '</div>',
              fDate ? '<div style="font-size:.6rem;color:var(--neon);margin-top:2px">Firmado: ' + fDate + '</div>' : '',
            '</div>',
            '<span style="font-size:.68rem;padding:3px 9px;border-radius:8px;',
                'background:rgba(94,255,160,.12);color:var(--neon);font-weight:700;flex-shrink:0">✔</span>',
          '</div>'
        ].join('');
      });
      html += '</div>';
    }

    html += '</div>'; // cierra border-top container
    section.innerHTML = html;
    contenedor.appendChild(section);

  } catch(e) { console.warn('[slk] renderFirmaSuplencias:', e); }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 9 — MODAL DE FIRMA DE SUPLENCIA (canvas propio)
// ─────────────────────────────────────────────────────────────────────────────
var _slkFirmaRegId   = null;
var _slkFirmaCanvas  = null;
var _slkFirmaCtx     = null;
var _slkFirmaDrawing = false;

function slk_abrirFirmarSuplencia(regId) {
  _slkFirmaRegId = regId;
  var reg = (registros || []).find(function(r) { return r.id === regId; });
  if (!reg) { if (typeof showToast === 'function') showToast('Registro no encontrado', 'err'); return; }

  var instOrig = (instructores || []).find(function(i) { return i.id === reg.inst_id; });
  var instSup  = (instructores || []).find(function(i) { return String(i.id) === String(reg.suplente_id); });
  var fd = new Date((reg.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });
  fd = fd.charAt(0).toUpperCase() + fd.slice(1);

  var asis = parseInt(reg.asistentes) || 0;
  var cap  = parseInt(reg.cap) || 0;
  var afo  = cap > 0 ? Math.round(asis / cap * 100) : null;

  var modal = document.getElementById('slk-modal-firma-sup');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'slk-modal-firma-sup';
    modal.className = 'ov';
    modal.style.cssText = 'z-index:2000';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) slk_cerrarFirmarSuplencia();
    });
  }

  modal.innerHTML = [
    '<div class="modal" style="max-width:460px;width:94vw;padding:1.2rem 1.1rem;position:relative">',

      '<button class="mcls" onclick="slk_cerrarFirmarSuplencia()" style="position:absolute;top:10px;right:10px">',
        '<svg class="ico" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      '</button>',

      '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.1rem;letter-spacing:2.5px;color:var(--blue);margin-bottom:.85rem">',
        'FIRMA DE SUPLENCIA',
      '</div>',

      '<div style="background:linear-gradient(135deg,rgba(41,128,185,.12),rgba(41,128,185,.05));',
          'border:1px solid rgba(41,128,185,.25);border-radius:12px;padding:.75rem .95rem;margin-bottom:.9rem">',
        '<div style="font-weight:700;font-size:.88rem">', reg.clase || '—', '</div>',
        '<div style="font-size:.68rem;color:var(--txt2);margin-top:3px">',
          '<span style="font-family:\'DM Mono\',monospace">', reg.hora || '', '</span>',
          ' · ', fd,
        '</div>',
        '<div style="font-size:.68rem;color:var(--txt3);margin-top:3px">',
          'Titular: <strong style="color:var(--txt)">', instOrig ? instOrig.nombre : '—', '</strong>',
        '</div>',
        '<div style="font-size:.68rem;color:var(--blue);margin-top:3px;font-weight:600">',
          'Suplente: ', instSup ? instSup.nombre : '—',
        '</div>',
        afo !== null
          ? '<div style="font-size:.65rem;color:var(--txt3);margin-top:3px">' + asis + ' asistentes · ' + afo + '% aforo</div>'
          : '',
      '</div>',

      '<div style="font-size:.68rem;color:var(--txt3);text-align:center;margin-bottom:.5rem">',
        'Firma abajo como <strong style="color:var(--txt)">instructor suplente</strong>',
        '<br>para confirmar que impartiste esta clase',
      '</div>',

      '<div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:.75rem">',
        '<div style="padding:.45rem .9rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.15)">',
          '<span style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--blue);font-weight:700">✏ Firma aquí</span>',
          '<button onclick="slk_limpiarFirmaSupCanvas()" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--txt3);font-size:.62rem;padding:3px 9px;cursor:pointer;font-family:\'Outfit\',sans-serif">↺ Limpiar</button>',
        '</div>',
        '<canvas id="slk-sup-canvas" style="display:block;width:100%;touch-action:none;cursor:crosshair;background:#fff" height="180"></canvas>',
      '</div>',

      '<button onclick="slk_guardarFirmasSuplencia()" style="',
          'width:100%;padding:.75rem;border-radius:10px;border:none;',
          'background:linear-gradient(135deg,var(--v2),var(--v3));color:#fff;',
          'font-family:\'Outfit\',sans-serif;font-size:.85rem;font-weight:700;',
          'cursor:pointer;letter-spacing:.5px;transition:opacity .2s"',
        ' onmouseover="this.style.opacity=\'.85\'"',
        ' onmouseout="this.style.opacity=\'1\'">',
        '✔ Guardar firma de suplencia',
      '</button>',

    '</div>'
  ].join('');

  modal.classList.add('on');

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

    ['mousedown','mousemove','mouseup','mouseleave'].forEach(function(ev) { c[ev] = null; });

    c.addEventListener('mousedown', function(e) {
      _slkFirmaDrawing = true; _slkFirmaCtx.beginPath();
      var r = c.getBoundingClientRect();
      _slkFirmaCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
    });
    c.addEventListener('mousemove', function(e) {
      if (!_slkFirmaDrawing) return;
      var r = c.getBoundingClientRect();
      _slkFirmaCtx.lineWidth = 2.5; _slkFirmaCtx.lineCap = 'round';
      _slkFirmaCtx.strokeStyle = '#1a1a1a';
      _slkFirmaCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
      _slkFirmaCtx.stroke();
    });
    c.addEventListener('mouseup', function() { _slkFirmaDrawing = false; });
    c.addEventListener('mouseleave', function() { _slkFirmaDrawing = false; });
    c.addEventListener('touchstart', function(e) {
      e.preventDefault(); _slkFirmaDrawing = true; _slkFirmaCtx.beginPath();
      var r = c.getBoundingClientRect(); var t = e.touches[0];
      _slkFirmaCtx.moveTo(t.clientX - r.left, t.clientY - r.top);
    }, { passive: false });
    c.addEventListener('touchmove', function(e) {
      e.preventDefault(); if (!_slkFirmaDrawing) return;
      var r = c.getBoundingClientRect(); var t = e.touches[0];
      _slkFirmaCtx.lineWidth = 2.5; _slkFirmaCtx.lineCap = 'round';
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
  _slkFirmaRegId = null; _slkFirmaCanvas = null; _slkFirmaCtx = null;
}

function slk_limpiarFirmaSupCanvas() {
  if (!_slkFirmaCtx || !_slkFirmaCanvas) return;
  _slkFirmaCtx.fillStyle = '#ffffff';
  _slkFirmaCtx.fillRect(0, 0, _slkFirmaCanvas.width, _slkFirmaCanvas.height);
}

async function slk_guardarFirmasSuplencia() {
  if (!_slkFirmaCanvas || !_slkFirmaRegId) return;

  var data = _slkFirmaCtx.getImageData(0, 0, _slkFirmaCanvas.width, _slkFirmaCanvas.height).data;
  var hayTrazo = false;
  for (var i = 0; i < data.length; i += 4) {
    if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) { hayTrazo = true; break; }
  }
  if (!hayTrazo) {
    if (typeof showToast === 'function') showToast('Firma el área antes de guardar', 'warn');
    return;
  }

  var inst = (instructores || []).find(function(i) { return i.id === instActualId; });
  var dataUrl = _slkFirmaCanvas.toDataURL('image/png');
  var entrada = {
    data:   dataUrl,
    nombre: inst ? inst.nombre : '—',
    ts:     new Date().toISOString(),
    instId: instActualId
  };

  // Guardar en localStorage
  var firmasSup = slk_cargarFirmasSuplencias();
  firmasSup[String(_slkFirmaRegId)] = entrada;
  slk_guardarFirmasSuplencias(firmasSup);

  // Subir a Firebase directamente
  if (typeof fbDb !== 'undefined' && fbDb) {
    try {
      await fbDb.ref('fitness/firmasSuplencias/' + _slkFirmaRegId).set(entrada);
    } catch(e) {}
  }

  if (typeof registrarLog === 'function') {
    registrarLog('instructor', 'Firma suplencia: ' + (inst ? inst.nombre : '—') + ' · reg#' + _slkFirmaRegId);
  }
  if (typeof showToast === 'function') showToast('✔ Firma de suplencia guardada', 'ok');

  slk_cerrarFirmarSuplencia();
  slk_actualizarBadgeSuplencias();
  if (typeof instRenderFirmaTab === 'function') setTimeout(instRenderFirmaTab, 200);
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 10 — HELPERS DE UI (banners)
// ─────────────────────────────────────────────────────────────────────────────
function slk_mostrarBannerSuplencia(sup) {
  try {
    var prev = document.getElementById('slk-banner-clase');
    if (prev) prev.remove();

    var anchor = document.getElementById('rc-slot-preview');
    if (!anchor || !anchor.parentElement) return;

    var supNom = '—';
    if (sup.suplente_id) {
      var inst = (instructores || []).find(function(i) { return String(i.id) === String(sup.suplente_id); });
      if (inst) supNom = inst.nombre;
    } else if (sup.suplente_nombre) { supNom = sup.suplente_nombre; }

    var motivoMap = { permiso:'Permiso', vacaciones:'Vacaciones', falta:'Falta', incapacidad:'Incapacidad', otro:'Otro' };
    var motivoTxt = (sup.motivo && motivoMap[sup.motivo]) || sup.motivo || '—';

    var banner = document.createElement('div');
    banner.id = 'slk-banner-clase';
    banner.style.cssText = 'background:rgba(41,128,185,.1);border:1px solid rgba(41,128,185,.35);border-radius:10px;padding:.5rem .8rem;margin-bottom:.5rem;font-size:.7rem;color:var(--blue)';
    banner.innerHTML = '⇄ <strong>Suplencia planificada:</strong> ' + supNom + ' · ' + motivoTxt +
      (sup.nota ? ' · <em>' + sup.nota + '</em>' : '') +
      '<br><span style="color:var(--txt3);font-size:.62rem">Campos pre-llenados automáticamente. Puedes modificarlos.</span>';

    anchor.parentElement.insertBefore(banner, anchor);
  } catch(e) {}
}

function slk_mostrarAvisoRecorrido(sup) {
  try {
    var prev = document.getElementById('slk-aviso-rec');
    if (prev) prev.remove();

    var supNom = '—';
    if (sup.suplente_id) {
      var inst = (instructores || []).find(function(i) { return String(i.id) === String(sup.suplente_id); });
      if (inst) supNom = inst.nombre;
    } else if (sup.suplente_nombre) { supNom = sup.suplente_nombre; }

    var card = document.getElementById('turbo-card');
    if (!card) return;

    var aviso = document.createElement('div');
    aviso.id = 'slk-aviso-rec';
    aviso.style.cssText = 'background:rgba(41,128,185,.1);border:1px solid rgba(41,128,185,.3);border-radius:8px;padding:.4rem .7rem;margin-bottom:.4rem;font-size:.65rem;color:var(--blue)';
    aviso.innerHTML = '⇄ <strong>Suplencia planificada:</strong> ' + supNom;
    card.insertBefore(aviso, card.firstChild);
  } catch(e) {}
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 11 — REPORTE DE SUPLENCIAS CON FIRMAS (coordinador)
// ─────────────────────────────────────────────────────────────────────────────
function slk_generarReporteSuplenciasConFirmas(fechaIni, fechaFin) {
  var firmasSup = slk_cargarFirmasSuplencias();
  var sups = (registros || []).filter(function(r) {
    return r.estado === 'sub' && r.fecha >= fechaIni && r.fecha <= fechaFin;
  }).sort(function(a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });

  if (sups.length === 0) {
    if (typeof showToast === 'function') showToast('Sin suplencias en el periodo', 'warn');
    return;
  }

  var rows = sups.map(function(r) {
    var instOrig = (instructores || []).find(function(i) { return i.id === r.inst_id; });
    var instSup  = (instructores || []).find(function(i) { return String(i.id) === String(r.suplente_id); });
    var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX', {
      day:'2-digit', month:'short', year:'numeric'
    });
    var firma = firmasSup[String(r.id)];
    var firmaHtml = firma && firma.data
      ? '<img src="' + firma.data + '" style="height:36px;max-width:120px;object-fit:contain" alt="Firma">'
      : '<div style="height:36px;width:110px;margin:0 auto;border:1px solid #ccc;border-radius:3px;background:#fff"></div>';
    return '<tr><td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">' + fd + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">' + (r.clase || '—') + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">' + (r.hora || '') + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5">' + (instOrig ? instOrig.nombre : '—') + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:600">' + (instSup ? instSup.nombre : '—') + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">' + (r.asistentes !== undefined ? r.asistentes : '—') + '</td>' +
      '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">' + firmaHtml + '</td></tr>';
  }).join('');

  var html = '<div style="font-family:\'Outfit\',sans-serif;color:#111">' +
    '<div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem">' +
    '<h1 style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;letter-spacing:2px;color:#1a7a45;margin:0">REPORTE DE SUPLENCIAS CON FIRMAS</h1>' +
    '<p style="color:#555;font-size:.8rem;margin:.2rem 0">Club Campestre Aguascalientes · Coordinación Fitness</p>' +
    '<p style="color:#333;font-size:.8rem;margin:.2rem 0">Periodo: <strong>' + fechaIni + '</strong> al <strong>' + fechaFin + '</strong> · ' + sups.length + ' suplencias</p>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:.79rem">' +
    '<thead><tr style="background:#f0f7f3">' +
    ['Fecha','Clase','Hora','Titular','Suplente','Asist.','Firma Suplente'].map(function(h) {
      return '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">' + h + '</th>';
    }).join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  var ttl  = document.getElementById('print-ttl');
  var body = document.getElementById('print-body');
  if (ttl)  ttl.textContent  = 'Suplencias con firmas — ' + fechaIni + ' al ' + fechaFin;
  if (body) body.innerHTML   = html;
  var mPrint = document.getElementById('m-print');
  if (mPrint) mPrint.classList.add('on');
}


// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 12 — AUTO-INIT: botón "Con Firmas" en modal de suplencias
// ─────────────────────────────────────────────────────────────────────────────
(function slk_autoInit() {
  function inject() {
    var exportBtns = document.getElementById('sup-export-btns');
    if (exportBtns && !document.getElementById('slk-btn-reporte-firmas')) {
      var btn = document.createElement('button');
      btn.id = 'slk-btn-reporte-firmas';
      btn.className = 'btn no-print';
      btn.style.cssText = 'background:rgba(41,128,185,.12);border:1px solid var(--blue);color:var(--blue)';
      btn.title = 'Reporte con firma digital del suplente';
      btn.innerHTML = '<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="2" width="10" height="16" rx="2"/><path d="M9 12 Q10.5 10 12 12" stroke-linecap="round"/><line x1="8" y1="7" x2="12" y2="7" stroke-linecap="round"/></svg> Con Firmas';
      btn.addEventListener('click', function() {
        var ini = document.getElementById('sup-fecha-ini');
        var fin = document.getElementById('sup-fecha-fin');
        if (!ini || !ini.value || !fin || !fin.value) {
          if (typeof showToast === 'function') showToast('Selecciona el rango y consulta primero', 'warn');
          return;
        }
        slk_generarReporteSuplenciasConFirmas(ini.value, fin.value);
      });
      exportBtns.appendChild(btn);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else setTimeout(inject, 800);
  setTimeout(inject, 3000);
})();

// ── Exponer globales ─────────────────────────────────────────────────────────
window.slk_abrirFirmarSuplencia             = slk_abrirFirmarSuplencia;
window.slk_cerrarFirmarSuplencia            = slk_cerrarFirmarSuplencia;
window.slk_limpiarFirmaSupCanvas            = slk_limpiarFirmaSupCanvas;
window.slk_guardarFirmasSuplencia           = slk_guardarFirmasSuplencia;
window.slk_generarReporteSuplenciasConFirmas = slk_generarReporteSuplenciasConFirmas;
