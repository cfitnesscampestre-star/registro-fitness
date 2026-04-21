// ═══════════════════════════════════════════════════════════════════════
// SUPLENCIAS_FIRMAS_FIX.JS  — v1.0
//
// Corrige el sistema de firma de suplencias quincenal.
// Problema raíz: sincronizarFirebase() hace .set() en fitness/ completo
// y borra fitness/hojaFirmasSuplencias cada vez que sube datos.
//
// Solución: usar nodo separado fitness_sup_firmas/ FUERA de fitness/
// para que sincronizarFirebase nunca lo toque.
// Además: agregar polling en el portal del instructor para detectar
// la hoja aunque Firebase no haya disparado el listener.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

// Nodo Firebase INDEPENDIENTE (fuera de fitness/ para no ser borrado)
var SUP_FB_NODE  = 'fc_sup_firmas';          // Firebase root node
var SUP_LS_KEY   = 'fc_hoja_firmas_suplencias'; // localStorage key (mismo que antes)

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 1 — SOBRESCRIBIR coordPublicarHojaFirmasSuplencias
// Usa el nodo independiente para publicar
// ─────────────────────────────────────────────────────────────────────
window.coordPublicarHojaFirmasSuplencias = async function(semIni, semFin, encabezado) {
  var periodoLabel = encabezado && encabezado.trim()
    ? encabezado.trim()
    : ('Suplencias ' + semIni + ' al ' + semFin);

  var hoja = {
    semIni:    semIni,
    semFin:    semFin,
    encabezado: periodoLabel,
    publicado:  new Date().toISOString(),
    firmas:     {}
  };

  // Guardar localmente
  try { localStorage.setItem(SUP_LS_KEY, JSON.stringify(hoja)); } catch(e) {}

  // Subir al nodo INDEPENDIENTE (no será borrado por sincronizarFirebase)
  if (typeof fbDb !== 'undefined' && fbDb) {
    try {
      await fbDb.ref(SUP_FB_NODE + '/hoja').set(hoja);
      if (typeof showToast === 'function')
        showToast('Reporte publicado — los instructores ya pueden firmar', 'ok');
    } catch(e) {
      if (typeof showToast === 'function')
        showToast('Publicado localmente. Reintentando...', 'warn');
      // Retry silencioso
      setTimeout(function() {
        if (typeof fbDb !== 'undefined' && fbDb)
          fbDb.ref(SUP_FB_NODE + '/hoja').set(hoja).catch(function(){});
      }, 3000);
    }
  } else {
    if (typeof showToast === 'function')
      showToast('Guardado localmente (sin conexión)', 'warn');
  }

  // Actualizar UI del coordinador
  sfx_actualizarEstadoCoord();
};

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 2 — SOBRESCRIBIR coordCerrarHojaFirmasSuplencias
// ─────────────────────────────────────────────────────────────────────
window.coordCerrarHojaFirmasSuplencias = async function() {
  var hoja = sfx_cargarHojaLocal();
  var firmados = hoja ? Object.values(hoja.firmas || {}).filter(function(f){ return f && f.data; }).length : 0;
  var msg = firmados > 0
    ? ('¿Cerrar el reporte?\n\nTiene ' + firmados + ' firma(s) guardada(s).\nAsegúrate de haber generado el PDF antes de cerrar.\n\n¿Confirmar?')
    : '¿Cerrar el reporte de firmas de suplencias?';
  if (!confirm(msg)) return;

  localStorage.removeItem(SUP_LS_KEY);

  if (typeof fbDb !== 'undefined' && fbDb) {
    try { await fbDb.ref(SUP_FB_NODE + '/hoja').remove(); } catch(e) {}
  }

  sfx_actualizarEstadoCoord();
  if (typeof showToast === 'function') showToast('Reporte cerrado.', 'info');
};

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 3 — HELPERS
// ─────────────────────────────────────────────────────────────────────
function sfx_cargarHojaLocal() {
  try {
    var raw = localStorage.getItem(SUP_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function sfx_guardarHojaLocal(hoja) {
  try { localStorage.setItem(SUP_LS_KEY, JSON.stringify(hoja)); } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 4 — LISTENER FIREBASE para el INSTRUCTOR
// Escucha fc_sup_firmas/hoja (nodo independiente)
// ─────────────────────────────────────────────────────────────────────
(function sfx_escucharFirebase() {
  function tryListen() {
    if (typeof fbDb === 'undefined' || !fbDb) { setTimeout(tryListen, 1500); return; }

    fbDb.ref(SUP_FB_NODE + '/hoja').on('value', function(snap) {
      try {
        var data = snap.val();
        var local = sfx_cargarHojaLocal();

        if (data) {
          // Merge de firmas si mismo periodo
          if (local && local.semIni === data.semIni && local.semFin === data.semFin) {
            var merged = JSON.parse(JSON.stringify(data));
            merged.firmas = merged.firmas || {};
            Object.keys(local.firmas || {}).forEach(function(k) {
              var fLocal = (local.firmas || {})[k];
              var fRemota = merged.firmas[k];
              if (!fLocal || !fLocal.data) return;
              if (!fRemota || !fRemota.data) { merged.firmas[k] = fLocal; return; }
              var tsL = new Date(fLocal.ts || 0).getTime();
              var tsR = new Date(fRemota.ts || 0).getTime();
              if (tsL > tsR) merged.firmas[k] = fLocal;
            });
            sfx_guardarHojaLocal(merged);
            if (typeof _instSupHoja !== 'undefined') window._instSupHoja = merged;
          } else {
            // Nuevo periodo
            sfx_guardarHojaLocal(data);
            if (typeof _instSupHoja !== 'undefined') window._instSupHoja = data;
            // Notificar solo si el instructor tiene suplencias en este periodo
            if (!local && typeof instActualId !== 'undefined' && instActualId) {
              var tieneSup = (typeof registros !== 'undefined')
                ? registros.some(function(r) {
                    return r.estado === 'sub' &&
                           String(r.suplente_id) === String(instActualId) &&
                           r.fecha >= data.semIni && r.fecha <= data.semFin;
                  })
                : false;
              if (tieneSup && typeof showToast === 'function')
                showToast('✍ Reporte de suplencias disponible — ya puedes firmar', 'ok');
            }
          }
        } else {
          // Coordinador cerró el reporte
          localStorage.removeItem(SUP_LS_KEY);
          if (typeof _instSupHoja !== 'undefined') window._instSupHoja = null;
          if (local && typeof showToast === 'function')
            showToast('El reporte de suplencias fue cerrado.', 'info');
        }

        // Refrescar badge y tab si está visible
        if (typeof instActualizarBadgeSup === 'function') instActualizarBadgeSup();
        var panel = document.getElementById('inst-panel-suplencias');
        if (panel && panel.style.display !== 'none' && typeof instRenderSupTab === 'function')
          instRenderSupTab();

        // Refrescar UI del coordinador
        sfx_actualizarEstadoCoord();

      } catch(err) { console.warn('[sfx] listener error:', err); }
    });

    // También escuchar firmas individuales subidas por instructores
    fbDb.ref(SUP_FB_NODE + '/hoja/firmas').on('value', function(snap) {
      try {
        var data = snap.val();
        if (!data) return;
        var local = sfx_cargarHojaLocal();
        if (!local) return;
        // Actualizar firmas locales con las de Firebase
        Object.keys(data).forEach(function(instId) {
          var fFb = data[instId];
          var fLocal = (local.firmas || {})[instId];
          if (!fFb || !fFb.data) return;
          if (!fLocal || !fLocal.data) {
            local.firmas = local.firmas || {};
            local.firmas[instId] = fFb;
          } else {
            var tsL = new Date(fLocal.ts || 0).getTime();
            var tsF = new Date(fFb.ts || 0).getTime();
            if (tsF > tsL) { local.firmas[instId] = fFb; }
          }
        });
        sfx_guardarHojaLocal(local);
        sfx_actualizarEstadoCoord();
      } catch(e) {}
    });
  }
  setTimeout(tryListen, 2000);
})();

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 5 — POLLING para el instructor (detecta hoja aunque Firebase
// tarde en disparar el listener)
// ─────────────────────────────────────────────────────────────────────
(function sfx_pollingInstructor() {
  var _lastSemIni = null;
  var timer = setInterval(function() {
    if (typeof instActualId === 'undefined' || !instActualId) return;
    if (typeof fbDb === 'undefined' || !fbDb) return;

    fbDb.ref(SUP_FB_NODE + '/hoja').once('value', function(snap) {
      try {
        var data = snap.val();
        var local = sfx_cargarHojaLocal();

        if (data && (!local || local.semIni !== data.semIni || local.semFin !== data.semFin)) {
          sfx_guardarHojaLocal(data);
          window._instSupHoja = data;
          if (typeof instActualizarBadgeSup === 'function') instActualizarBadgeSup();
          var panel = document.getElementById('inst-panel-suplencias');
          if (panel && panel.style.display !== 'none' && typeof instRenderSupTab === 'function')
            instRenderSupTab();
          if (!local && _lastSemIni !== data.semIni) {
            _lastSemIni = data.semIni;
            var tieneSup = (typeof registros !== 'undefined')
              ? registros.some(function(r) {
                  return r.estado === 'sub' && String(r.suplente_id) === String(instActualId)
                         && r.fecha >= data.semIni && r.fecha <= data.semFin;
                })
              : false;
            if (tieneSup && typeof showToast === 'function')
              showToast('✍ Reporte de suplencias — ya puedes firmar', 'ok');
          }
        } else if (!data && local) {
          localStorage.removeItem(SUP_LS_KEY);
          window._instSupHoja = null;
          if (typeof instActualizarBadgeSup === 'function') instActualizarBadgeSup();
          var panel = document.getElementById('inst-panel-suplencias');
          if (panel && panel.style.display !== 'none' && typeof instRenderSupTab === 'function')
            instRenderSupTab();
        }
      } catch(e) {}
    }).catch(function(){});
  }, 10000); // Cada 10 segundos
})();

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 6 — GUARDAR FIRMA DEL INSTRUCTOR (sobrescribir instGuardarFirmaSup)
// Usa el nodo independiente fc_sup_firmas/hoja/firmas/{instId}
// ─────────────────────────────────────────────────────────────────────
(function sfx_hookGuardarFirma() {
  function waitReady(fn, n) {
    n = n || 40;
    if (typeof instGuardarFirmaSup === 'function' && typeof instActualId !== 'undefined') {
      fn();
    } else if (n > 0) {
      setTimeout(function(){ waitReady(fn, n-1); }, 200);
    }
  }
  waitReady(function() {
    window.instGuardarFirmaSup = async function() {
      var canvas = document.getElementById('inst-sup-canvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var hayTrazo = false;
      for (var i=0; i<data.length; i+=4) {
        if (data[i]<240 || data[i+1]<240 || data[i+2]<240) { hayTrazo=true; break; }
      }
      if (!hayTrazo) {
        if (typeof showToast === 'function') showToast('Firma el área antes de guardar', 'warn');
        return;
      }

      var hoja = sfx_cargarHojaLocal();
      if (!hoja) {
        if (typeof showToast === 'function') showToast('No hay reporte activo', 'err');
        return;
      }

      // Verificar que el reporte sigue activo en Firebase
      var hojaValida = false;
      try {
        if (typeof fbDb !== 'undefined' && fbDb) {
          var snap = await fbDb.ref(SUP_FB_NODE + '/hoja').once('value');
          var fbHoja = snap.val();
          if (fbHoja && fbHoja.semIni === hoja.semIni && fbHoja.semFin === hoja.semFin) {
            hojaValida = true;
          } else if (!fbHoja) {
            localStorage.removeItem(SUP_LS_KEY);
            window._instSupHoja = null;
            if (typeof instRenderSupTab === 'function') instRenderSupTab();
            if (typeof showToast === 'function')
              showToast('El reporte fue cerrado por coordinación.', 'warn');
            return;
          }
        } else {
          hojaValida = true; // Sin Firebase, confiar en local
        }
      } catch(e) { hojaValida = true; }

      var dataUrl = canvas.toDataURL('image/png');
      var inst = (typeof instructores !== 'undefined')
        ? instructores.find(function(i){ return i.id === instActualId; })
        : null;
      var entrada = {
        data:   dataUrl,
        nombre: inst ? inst.nombre : '—',
        ts:     new Date().toISOString(),
        instId: instActualId
      };

      // Guardar en hoja local
      hoja.firmas = hoja.firmas || {};
      hoja.firmas[String(instActualId)] = entrada;
      sfx_guardarHojaLocal(hoja);
      window._instSupHoja = hoja;

      // Subir a Firebase en el nodo independiente
      if (hojaValida && typeof fbDb !== 'undefined' && fbDb) {
        try {
          await fbDb.ref(SUP_FB_NODE + '/hoja/firmas/' + String(instActualId)).set(entrada);
        } catch(e) {
          console.warn('[sfx] Error subiendo firma:', e.message);
        }
      }

      if (typeof registrarLog === 'function')
        registrarLog('instructor', 'Firma suplencias: ' + (inst ? inst.nombre : '—'));
      if (typeof showToast === 'function')
        showToast('✔ Firma de suplencias guardada', 'ok');

      if (typeof instRenderSupTab === 'function')
        setTimeout(instRenderSupTab, 200);
      if (typeof instActualizarBadgeSup === 'function')
        instActualizarBadgeSup();
    };
  });
})();

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 7 — ACTUALIZAR UI DEL COORDINADOR
// Muestra el estado del reporte activo + firmas recibidas en el modal
// ─────────────────────────────────────────────────────────────────────
function sfx_actualizarEstadoCoord() {
  var hoja = sfx_cargarHojaLocal();
  var btnCerrar = document.getElementById('fsc-btn-cerrar');
  var resumenEl = document.getElementById('fsc-resumen');

  if (!hoja) {
    if (btnCerrar) btnCerrar.style.display = 'none';
    if (resumenEl) {
      var todos = (typeof registros !== 'undefined')
        ? registros.filter(function(r){ return r.estado === 'sub' && r.suplente_id; }) : [];
      var sinFirma = todos.length;
      resumenEl.innerHTML = sfx_resumenHTML(todos.length, 0, sinFirma);
      var badge = document.getElementById('fsc-badge-pend');
      if (badge) { badge.textContent = sinFirma; badge.style.display = sinFirma > 0 ? 'flex' : 'none'; }
    }
    return;
  }

  // Hay hoja activa
  if (btnCerrar) btnCerrar.style.display = 'flex';

  var firmados = Object.values(hoja.firmas || {}).filter(function(f){ return f && f.data; }).length;
  // Total: instructores suplentes únicos en el periodo
  var instSuplentesUnicos = new Set();
  if (typeof registros !== 'undefined') {
    registros.forEach(function(r) {
      if (r.estado === 'sub' && r.suplente_id && r.fecha >= hoja.semIni && r.fecha <= hoja.semFin)
        instSuplentesUnicos.add(String(r.suplente_id));
    });
  }
  var total = Math.max(instSuplentesUnicos.size, firmados);
  var sinFirma = Math.max(0, total - firmados);

  if (resumenEl) resumenEl.innerHTML = sfx_resumenHTML(total, firmados, sinFirma);

  var badge = document.getElementById('fsc-badge-pend');
  if (badge) { badge.textContent = sinFirma; badge.style.display = sinFirma > 0 ? 'flex' : 'none'; }

  // Encabezado del reporte activo
  var hdrEl = document.getElementById('fsc-hoja-activa-info');
  if (hdrEl) {
    var enc = hoja.encabezado || (hoja.semIni + ' al ' + hoja.semFin);
    var col = sinFirma > 0 ? 'rgba(232,184,75,.1)' : 'rgba(94,255,160,.08)';
    var bdr = sinFirma > 0 ? 'rgba(232,184,75,.35)' : 'rgba(94,255,160,.3)';
    hdrEl.style.background = col;
    hdrEl.style.borderColor = bdr;
    hdrEl.style.display = 'block';
    hdrEl.innerHTML = [
      '<div style="font-weight:700;font-size:.78rem;color:var(--txt)">📋 Reporte activo: ' + enc + '</div>',
      '<div style="font-size:.68rem;color:var(--txt2);margin-top:2px">',
        firmados + '/' + total + ' firmas recibidas',
        sinFirma > 0
          ? ' · <span style="color:var(--gold2)">Faltan ' + sinFirma + '</span>'
          : ' · <span style="color:var(--neon)">Completo</span>',
      '</div>'
    ].join('');
  }
}

function sfx_resumenHTML(total, firmadas, sinFirma) {
  var col = sinFirma > 0 ? 'var(--red2)' : 'var(--neon)';
  return [
    '<div style="display:flex;justify-content:space-around;text-align:center">',
      '<div>',
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:var(--blue);line-height:1">' + total + '</div>',
        '<div style="font-size:.6rem;color:var(--txt3)">suplentes</div>',
      '</div>',
      '<div style="width:1px;background:var(--border)"></div>',
      '<div>',
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:var(--neon);line-height:1">' + firmadas + '</div>',
        '<div style="font-size:.6rem;color:var(--txt3)">firmadas</div>',
      '</div>',
      '<div style="width:1px;background:var(--border)"></div>',
      '<div>',
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:' + col + ';line-height:1">' + sinFirma + '</div>',
        '<div style="font-size:.6rem;color:var(--txt3)">pendientes</div>',
      '</div>',
    '</div>'
  ].join('');
}

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — PARCHAR hubAbrirFirmasSuplencias para mostrar hoja activa
// ─────────────────────────────────────────────────────────────────────
(function sfx_patchHubAbrirFirmas() {
  function waitReady(fn, n) {
    n = n || 40;
    if (typeof hubAbrirFirmasSuplencias === 'function') fn();
    else if (n > 0) setTimeout(function(){ waitReady(fn, n-1); }, 200);
  }
  waitReady(function() {
    var _orig = hubAbrirFirmasSuplencias;
    window.hubAbrirFirmasSuplencias = function() {
      _orig.apply(this, arguments);
      // Añadir el div de hoja activa si no existe
      setTimeout(function() {
        var modal = document.getElementById('m-firmas-suplencias-ctrl');
        if (!modal) return;
        if (!document.getElementById('fsc-hoja-activa-info')) {
          var div = document.createElement('div');
          div.id = 'fsc-hoja-activa-info';
          div.style.cssText = [
            'display:none;padding:.55rem .85rem;border-radius:10px;',
            'border:1px solid rgba(94,255,160,.3);background:rgba(94,255,160,.08);',
            'margin-bottom:.8rem;font-size:.75rem;line-height:1.6'
          ].join('');
          var resumen = document.getElementById('fsc-resumen');
          if (resumen) resumen.parentNode.insertBefore(div, resumen);
        }
        sfx_actualizarEstadoCoord();
      }, 50);
    };
  });
})();

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 9 — SOBRESCRIBIR instLimpiarFirmaSup para usar nodo correcto
// ─────────────────────────────────────────────────────────────────────
(function sfx_patchLimpiarFirma() {
  function waitReady(fn, n) {
    n = n || 40;
    if (typeof instLimpiarFirmaSup === 'function') fn();
    else if (n > 0) setTimeout(function(){ waitReady(fn, n-1); }, 200);
  }
  waitReady(function() {
    window.instLimpiarFirmaSup = function() {
      var hoja = sfx_cargarHojaLocal();
      var misFirma = hoja && hoja.firmas ? hoja.firmas[String(instActualId)] : null;
      if (misFirma && misFirma.data) {
        var inst = (typeof instructores !== 'undefined')
          ? instructores.find(function(i){ return i.id === instActualId; }) : null;
        if (!confirm('¿Borrar tu firma de suplencias guardada?\nPodrás volver a firmar.')) return;
        var tsAhora = new Date().toISOString();
        if (!hoja.firmasBorradas) hoja.firmasBorradas = {};
        hoja.firmasBorradas[String(instActualId)] = tsAhora;
        delete hoja.firmas[String(instActualId)];
        sfx_guardarHojaLocal(hoja);
        window._instSupHoja = hoja;
        // Actualizar en Firebase
        if (typeof fbDb !== 'undefined' && fbDb) {
          fbDb.ref(SUP_FB_NODE + '/hoja/firmas/' + String(instActualId)).remove().catch(function(){});
          fbDb.ref(SUP_FB_NODE + '/hoja/firmasBorradas/' + String(instActualId)).set(tsAhora).catch(function(){});
        }
        if (typeof instRenderSupTab === 'function') instRenderSupTab();
        if (typeof showToast === 'function') showToast('Firma eliminada. Puedes volver a firmar.', 'info');
        return;
      }
      // Solo limpiar canvas
      var canvas = document.getElementById('inst-sup-canvas');
      if (canvas) {
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
  });
})();

// ─────────────────────────────────────────────────────────────────────
// SECCIÓN 10 — GENERAR REPORTE PDF CON FIRMAS (versión corregida)
// Lee firmas desde el nodo fc_sup_firmas en Firebase
// ─────────────────────────────────────────────────────────────────────
window.sfx_generarReporteConFirmas = async function(fechaIni, fechaFin) {
  if (typeof showToast === 'function') showToast('Generando reporte...', 'info');

  // Obtener firmas actualizadas desde Firebase
  var firmasMap = {};
  try {
    if (typeof fbDb !== 'undefined' && fbDb) {
      var snap = await fbDb.ref(SUP_FB_NODE + '/hoja/firmas').once('value');
      var fbFirmas = snap.val();
      if (fbFirmas) firmasMap = fbFirmas;
    }
  } catch(e) {}

  // Complementar con firmas locales
  var local = sfx_cargarHojaLocal();
  if (local && local.firmas) {
    Object.keys(local.firmas).forEach(function(k) {
      if (!firmasMap[k] && local.firmas[k] && local.firmas[k].data)
        firmasMap[k] = local.firmas[k];
    });
  }

  // También incluir firmas del antiguo sistema fc_firmas_suplencias
  try {
    var oldFirmas = JSON.parse(localStorage.getItem('fc_firmas_suplencias') || '{}');
    Object.keys(oldFirmas).forEach(function(regId) {
      var f = oldFirmas[regId];
      if (f && f.instId && f.data && !firmasMap[String(f.instId)])
        firmasMap[String(f.instId)] = f;
    });
  } catch(e) {}

  var sups = (typeof registros !== 'undefined')
    ? registros.filter(function(r) {
        return r.estado === 'sub' && r.fecha >= fechaIni && r.fecha <= fechaFin;
      }).sort(function(a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); })
    : [];

  if (sups.length === 0) {
    if (typeof showToast === 'function') showToast('Sin suplencias en el periodo', 'warn');
    return;
  }

  var rows = sups.map(function(r) {
    var instOrig = (typeof instructores !== 'undefined')
      ? instructores.find(function(i){ return i.id === r.inst_id; }) : null;
    var instSup = (typeof instructores !== 'undefined')
      ? instructores.find(function(i){ return String(i.id) === String(r.suplente_id); }) : null;
    var fd = new Date((r.fecha || '') + 'T12:00:00').toLocaleDateString('es-MX',
      {day:'2-digit', month:'short', year:'numeric'});
    // Buscar firma por ID de instructor suplente
    var firma = firmasMap[String(r.suplente_id)];
    var firmaHtml = firma && firma.data
      ? '<img src="' + firma.data + '" style="height:38px;max-width:130px;object-fit:contain" alt="Firma">'
      : '<span style="color:#c00;font-size:.72rem;font-style:italic">Sin firma</span>';
    var asis = parseInt(r.asistentes) || 0;
    var cap  = parseInt(r.cap) || 0;
    var afo  = cap > 0 ? Math.round(asis/cap*100) : null;
    return [
      '<tr>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">' + fd + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">' + (r.clase || '—') + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">' + (r.hora || '') + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5">' + (instOrig ? instOrig.nombre : '—') + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:600">' + (instSup ? instSup.nombre : '—') + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">' + asis + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">' + (afo !== null ? afo + '%' : '—') + '</td>',
        '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center">' + firmaHtml + '</td>',
      '</tr>'
    ].join('');
  }).join('');

  var totalFirmados = sups.filter(function(r){return firmasMap[String(r.suplente_id)]&&firmasMap[String(r.suplente_id)].data;}).length;

  var html = [
    '<div style="font-family:\'Outfit\',sans-serif;color:#111">',
      '<div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem">',
        '<h1 style="font-family:\'Bebas Neue\',sans-serif;font-size:1.5rem;letter-spacing:2px;color:#1a7a45;margin:0">',
          'REPORTE DE SUPLENCIAS — FIRMA QUINCENAL',
        '</h1>',
        '<p style="color:#555;font-size:.8rem;margin:.2rem 0">Club Campestre Aguascalientes · Coordinación Fitness</p>',
        '<p style="color:#333;font-size:.8rem;margin:.2rem 0">',
          'Periodo: <strong>' + fechaIni + '</strong> al <strong>' + fechaFin + '</strong>',
          ' · Total: <strong>' + sups.length + '</strong> suplencias',
          ' · Firmadas: <strong>' + totalFirmados + '</strong> / ' + sups.length,
        '</p>',
      '</div>',
      '<table style="width:100%;border-collapse:collapse;font-size:.78rem">',
        '<thead><tr style="background:#f0f7f3">',
          ['Fecha','Clase','Hora','Titular','Suplente','Asist.','Aforo','Firma'].map(function(h){
            return '<th style="padding:6px 9px;border:1px solid #ccc;color:#1a7a45;font-size:.65rem;text-transform:uppercase">' + h + '</th>';
          }).join(''),
        '</tr></thead>',
        '<tbody>' + rows + '</tbody>',
      '</table>',
      '<div style="margin-top:1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">',
        '<div style="border-top:2px solid #1a7a45;padding-top:.5rem">',
          '<div style="font-size:.75rem;color:#555;margin-bottom:2rem">Firma Coordinador Fitness</div>',
          '<div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>',
        '</div>',
        '<div style="border-top:2px solid #1a7a45;padding-top:.5rem">',
          '<div style="font-size:.75rem;color:#555;margin-bottom:2rem">Vo.Bo. Recursos Humanos</div>',
          '<div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>',
        '</div>',
      '</div>',
      '<div style="margin-top:.8rem;font-size:.7rem;color:#888;text-align:right">',
        'Generado: ' + new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}),
      '</div>',
    '</div>'
  ].join('');

  var ttl  = document.getElementById('print-ttl');
  var body = document.getElementById('print-body');
  if (ttl)  ttl.textContent = 'Suplencias con firmas — ' + fechaIni + ' al ' + fechaFin;
  if (body) body.innerHTML  = html;
  var mPrint = document.getElementById('m-print');
  if (mPrint) mPrint.classList.add('on');
};

// Parchar hubConfirmarReporteConFirmas para usar la nueva función
(function(){
  function waitReady(fn, n) {
    n = n || 40;
    if (typeof hubConfirmarReporteConFirmas === 'function') fn();
    else if (n > 0) setTimeout(function(){ waitReady(fn, n-1); }, 200);
  }
  waitReady(function() {
    window.hubConfirmarReporteConFirmas = function() {
      var ini = document.getElementById('fsc-fecha-ini');
      var fin = document.getElementById('fsc-fecha-fin');
      if (!ini || !ini.value || !fin || !fin.value) {
        if (typeof showToast === 'function') showToast('Selecciona el periodo primero', 'warn');
        return;
      }
      document.getElementById('fsc-picker-reporte').style.display = 'none';
      if (typeof cerrarModal === 'function') cerrarModal('m-firmas-suplencias-ctrl');
      sfx_generarReporteConFirmas(ini.value, fin.value);
    };
  });
})();

// Exponer
window.sfx_actualizarEstadoCoord = sfx_actualizarEstadoCoord;
