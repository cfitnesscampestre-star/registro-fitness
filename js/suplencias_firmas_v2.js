// ═══════════════════════════════════════════════════════════════════════
// SUPLENCIAS_FIRMAS_V2.JS
// Sistema de firma de suplencias quincenal.
// Estructura idéntica al sistema de firmas semanales existente:
//   - Menú: Crear / Continuar / Eliminar hoja (igual que m-firmas-menu)
//   - Modal presencial: lista de suplentes izq + canvas derecho
//   - Portal instructor: una firma por suplencia individual
// Nodo Firebase independiente: fc_sup_firmas/ (nunca borrado por sync)
// ═══════════════════════════════════════════════════════════════════════
'use strict';

// ── Constantes ────────────────────────────────────────────────────────
var SFV2_FB     = 'fc_sup_firmas';            // nodo Firebase raíz
var SFV2_LS     = 'fc_hoja_firmas_suplencias'; // localStorage key

// ── Estado interno ────────────────────────────────────────────────────
var _sfv2 = {
  hoja:        null,   // hoja activa (semIni, semFin, encabezado, firmas:{})
  profActivo:  null,   // índice en _sfv2.suplentes (para firma presencial)
  suplentes:   [],     // [{inst, clases:[]}] (igual que _FD.profesores)
  canvas:      null,
  ctx:         null,
  dibujando:   false,
  puntosActual:0,
  // Portal instructor
  supSelIdx:   null,   // índice de la suplencia seleccionada en portal
  supClases:   [],     // registros de suplencia del instructor
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — MENÚ DE GESTIÓN (igual que abrirFirmasDigitalesDirecto)
// ════════════════════════════════════════════════════════════════════════
// ── Renderiza el menú con los datos de una hoja (puede ser null) ───────
function sfv2_renderMenu(hoja) {
  var estadoEl   = document.getElementById('fsm-estado-wrap');
  var btnCont    = document.getElementById('fsm-btn-continuar');
  var btnElim    = document.getElementById('fsm-btn-eliminar');
  var btnCrearEl = document.getElementById('fsm-btn-crear');
  var btnCrearLb = document.getElementById('fsm-btn-crear-lbl');
  var btnCrearSb = document.getElementById('fsm-btn-crear-sub');

  if (hoja) {
    var firmados   = Object.values(hoja.firmas || {}).filter(function(f){ return f&&f.data; }).length;
    var semTxt     = hoja.encabezado || (hoja.semIni + ' → ' + hoja.semFin);
    var suplUnicos = sfv2_suplentesUnicos(hoja);
    var total      = suplUnicos.length;
    var pendientes = Math.max(0, total - firmados);
    var completa   = pendientes === 0 && firmados > 0;

    if (estadoEl) {
      var col = completa ? 'rgba(94,255,160,.08)' : firmados > 0 ? 'rgba(232,184,75,.08)' : 'rgba(94,255,160,.04)';
      var bdr = completa ? 'rgba(94,255,160,.3)'  : firmados > 0 ? 'rgba(232,184,75,.3)'  : 'rgba(94,255,160,.15)';
      estadoEl.style.background = col;
      estadoEl.style.border = '1px solid ' + bdr;
      estadoEl.style.color  = 'var(--txt2)';
      estadoEl.innerHTML =
        '<div style="font-weight:700;color:var(--txt);margin-bottom:3px">⇄ Hoja activa: ' + semTxt + '</div>' +
        '<div>' + firmados + ' de ' + total + ' firma' + (total!==1?'s':'') + ' recibida' + (firmados!==1?'s':'') + ' · ' +
        (completa
          ? '<span style="color:var(--neon)">Completa</span>'
          : '<span style="color:var(--gold2)">' + pendientes + ' pendiente' + (pendientes!==1?'s':'') + '</span>') +
        '</div>';
      estadoEl.style.display = 'block';
    }
    if (btnCont) {
      btnCont.style.display = 'flex';
      var subCont = document.getElementById('fsm-btn-continuar-sub');
      if (subCont) subCont.textContent = completa ? 'Completa — genera el PDF' : 'Faltan ' + pendientes + ' firma' + (pendientes!==1?'s':'');
    }
    if (btnElim) btnElim.style.display = 'flex';
    if (btnCrearLb) btnCrearLb.textContent = 'Crear nueva hoja';
    if (btnCrearSb) btnCrearSb.textContent = firmados > 0
      ? '⚠ Se perderán las ' + firmados + ' firma' + (firmados!==1?'s':'') + ' actuales'
      : 'Reemplaza la hoja actual vacía';
    if (btnCrearEl) btnCrearEl.style.background = firmados > 0 ? 'rgba(192,57,43,.75)' : '';
  } else {
    if (estadoEl)   estadoEl.style.display   = 'none';
    if (btnCont)    btnCont.style.display     = 'none';
    if (btnElim)    btnElim.style.display     = 'none';
    if (btnCrearLb) btnCrearLb.textContent    = 'Crear nueva hoja de suplencias';
    if (btnCrearSb) btnCrearSb.textContent    = 'Se publicará para que los suplentes firmen';
    if (btnCrearEl) btnCrearEl.style.background = '';
  }
}

// ── Abre el menú: siempre sincroniza con Firebase primero ──────────────
window.abrirMenuFirmasSuplencias = function() {
  // Mostrar el modal de inmediato con los datos locales (no bloquear la UI)
  var hojaLocal = sfv2_cargarHoja();
  sfv2_renderMenu(hojaLocal);
  var menuEl = document.getElementById('m-sup-firmas-menu');
  if (menuEl) menuEl.classList.add('on');

  // Luego consultar Firebase y actualizar si hay diferencias
  if (typeof fbDb === 'undefined' || !fbDb) return;
  fbDb.ref(SFV2_FB + '/hoja').once('value', function(snap) {
    try {
      var fbHoja = snap.val();
      var local  = sfv2_cargarHoja();

      if (fbHoja) {
        // Firebase tiene hoja — fusionar con local y actualizar menú
        if (local && local.semIni === fbHoja.semIni && local.semFin === fbHoja.semFin) {
          // Misma hoja: mezclar firmas (ganador: más reciente)
          fbHoja.firmas = fbHoja.firmas || {};
          Object.keys(local.firmas || {}).forEach(function(k) {
            var fL = (local.firmas||{})[k], fR = fbHoja.firmas[k];
            if (!fL || !fL.data) return;
            if (!fR || !fR.data || new Date(fL.ts||0) > new Date(fR.ts||0)) fbHoja.firmas[k] = fL;
          });
        }
        localStorage.setItem(SFV2_LS, JSON.stringify(fbHoja));
        _sfv2.hoja = fbHoja;
        sfv2_renderMenu(fbHoja);
      } else {
        // Firebase no tiene hoja — limpiar local si hubiera algo
        if (local) {
          localStorage.removeItem(SFV2_LS);
          _sfv2.hoja = null;
          sfv2_renderMenu(null);
        }
      }
    } catch(e) {}
  }).catch(function() {});
};

window.fsmAccion = function(accion) {
  if (accion === 'continuar') {
    cerrarModal('m-sup-firmas-menu');
    setTimeout(sfv2_abrirFirmasPresencial, 100);
    return;
  }
  if (accion === 'eliminar') {
    // Leer de Firebase para tener el estado real antes de eliminar
    function _procederEliminar(hojaReal) {
      if (!hojaReal) { showToast('No hay hoja activa','info'); return; }
      var firmados = Object.values(hojaReal.firmas||{}).filter(function(f){return f&&f.data;}).length;
      var semTxt   = hojaReal.encabezado || (hojaReal.semIni + ' → ' + hojaReal.semFin);
      var msg = firmados > 0
        ? '¿Eliminar la hoja "' + semTxt + '"?\n\nTiene ' + firmados + ' firma' + (firmados!==1?'s':'') + ' guardada' + (firmados!==1?'s':'') + '.\nEsta acción no se puede deshacer.'
        : '¿Eliminar la hoja "' + semTxt + '"?';
      if (!confirm(msg)) return;
      localStorage.removeItem(SFV2_LS);
      _sfv2.hoja = null;
      if (typeof fbDb !== 'undefined' && fbDb)
        fbDb.ref(SFV2_FB + '/hoja').remove().catch(function(){});
      sfv2_actualizarBadgeCoord();
      cerrarModal('m-sup-firmas-menu');
      showToast('Hoja de suplencias eliminada','ok');
    }

    if (typeof fbDb !== 'undefined' && fbDb) {
      fbDb.ref(SFV2_FB + '/hoja').once('value', function(snap) {
        var fbHoja = snap.val();
        if (fbHoja) { localStorage.setItem(SFV2_LS, JSON.stringify(fbHoja)); _sfv2.hoja = fbHoja; }
        else { localStorage.removeItem(SFV2_LS); _sfv2.hoja = null; }
        _procederEliminar(fbHoja);
      }).catch(function() { _procederEliminar(sfv2_cargarHoja()); });
    } else {
      _procederEliminar(sfv2_cargarHoja());
    }
    return;
  }
  if (accion === 'crear') {
    // Consultar Firebase (fuente de verdad global) antes de permitir crear
    function _procederCrear(hojaReal) {
      var firmados = hojaReal ? Object.values(hojaReal.firmas||{}).filter(function(f){return f&&f.data;}).length : 0;
      if (hojaReal && firmados > 0) {
        var semTxt = hojaReal.encabezado || (hojaReal.semIni + ' → ' + hojaReal.semFin);
        if (!confirm('⚠ Ya existe la hoja "' + semTxt + '" con ' + firmados + ' firma' + (firmados!==1?'s':'') + ' guardada' + (firmados!==1?'s':'') + '.\n\nSi creas una nueva se perderán todas las firmas.\n¿Confirmar?'))
          return;
        localStorage.removeItem(SFV2_LS);
        _sfv2.hoja = null;
        if (typeof fbDb !== 'undefined' && fbDb)
          fbDb.ref(SFV2_FB + '/hoja').remove().catch(function(){});
      } else if (hojaReal) {
        // Hoja sin firmas — reemplazar directo
        localStorage.removeItem(SFV2_LS);
        _sfv2.hoja = null;
        if (typeof fbDb !== 'undefined' && fbDb)
          fbDb.ref(SFV2_FB + '/hoja').remove().catch(function(){});
      }
      cerrarModal('m-sup-firmas-menu');
      sfv2_abrirCrearHoja();
    }

    if (typeof fbDb !== 'undefined' && fbDb) {
      fbDb.ref(SFV2_FB + '/hoja').once('value', function(snap) {
        var fbHoja = snap.val();
        // Sincronizar localStorage con Firebase
        if (fbHoja) {
          localStorage.setItem(SFV2_LS, JSON.stringify(fbHoja));
          _sfv2.hoja = fbHoja;
        } else {
          localStorage.removeItem(SFV2_LS);
          _sfv2.hoja = null;
        }
        _procederCrear(fbHoja);
      }).catch(function() {
        // Sin conexión — fallback a localStorage
        _procederCrear(sfv2_cargarHoja());
      });
    } else {
      _procederCrear(sfv2_cargarHoja());
    }
  }
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — CREAR HOJA (modal con picker de fechas quincenal)
// ════════════════════════════════════════════════════════════════════════
function sfv2_abrirCrearHoja() {
  // Pre-llenar con corte quincenal más cercano (día 1–8 ó 9–22)
  var hoy   = new Date();
  var dia   = hoy.getDate();
  var mes   = hoy.getMonth();
  var anio  = hoy.getFullYear();
  var ini, fin;
  var fmt   = function(d) { return typeof fechaLocalStr==='function' ? fechaLocalStr(d) : d.toISOString().slice(0,10); };

  if (dia <= 8) {
    ini = new Date(anio, mes, 1);
    fin = new Date(anio, mes, 8);
  } else if (dia <= 22) {
    ini = new Date(anio, mes, 9);
    fin = new Date(anio, mes, 22);
  } else {
    ini = new Date(anio, mes, 23);
    fin = new Date(anio, mes+1, 0); // último día del mes
  }

  var elIni = document.getElementById('sfv2-crear-ini');
  var elFin = document.getElementById('sfv2-crear-fin');
  var elEnc = document.getElementById('sfv2-crear-enc');
  if (elIni) elIni.value = fmt(ini);
  if (elFin) elFin.value = fmt(fin);
  if (elEnc) {
    var nomMes = ini.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
    elEnc.value = 'Suplencias ' + ini.getDate() + '-' + fin.getDate() + ' ' + nomMes;
  }

  document.getElementById('m-sup-firmas-crear').classList.add('on');
}

window.sfv2_confirmarCrearHoja = async function() {
  var ini = document.getElementById('sfv2-crear-ini');
  var fin = document.getElementById('sfv2-crear-fin');
  var enc = document.getElementById('sfv2-crear-enc');
  if (!ini||!ini.value||!fin||!fin.value) { showToast('Selecciona el periodo','warn'); return; }

  var hoja = {
    semIni:     ini.value,
    semFin:     fin.value,
    encabezado: (enc&&enc.value.trim()) || ('Suplencias ' + ini.value + ' al ' + fin.value),
    publicado:  new Date().toISOString(),
    firmas:     {}
  };
  localStorage.setItem(SFV2_LS, JSON.stringify(hoja));
  _sfv2.hoja = hoja;

  // No guardar firmas:{} vacío — Firebase descarta objetos vacíos y puede causar problemas
  var hojaFirebase = {
    semIni:     hoja.semIni,
    semFin:     hoja.semFin,
    encabezado: hoja.encabezado,
    publicado:  hoja.publicado
    // firmas se omite intencionalmente si está vacío
  };

  if (typeof fbDb !== 'undefined' && fbDb) {
    try {
      await fbDb.ref(SFV2_FB + '/hoja').set(hojaFirebase);
      console.log('[SFV2] hoja subida a Firebase OK:', hoja.encabezado);
      // Verificar que quedó guardada
      fbDb.ref(SFV2_FB + '/hoja/semIni').once('value', function(snap) {
        console.log('[SFV2] verificación post-guardado semIni:', snap.val());
        if (!snap.val()) {
          console.error('[SFV2] FALLO: la hoja no quedó en Firebase después del set');
          showToast('⚠ Error al publicar — verifica conexión y reglas de Firebase','err');
        }
      });
    } catch(e) {
      console.error('[SFV2] ERROR subiendo hoja a Firebase:', e);
      showToast('Sin conexión — la hoja está guardada localmente. Vuelve a intentarlo.','warn');
    }
  } else {
    console.warn('[SFV2] fbDb no disponible al crear hoja — solo local');
    showToast('Sin conexión con Firebase — la hoja no es visible para otros dispositivos','warn');
  }

  cerrarModal('m-sup-firmas-crear');
  sfv2_actualizarBadgeCoord();
  showToast('Hoja creada — los suplentes ya pueden firmar desde su portal','ok');
  sfv2_abrirFirmasPresencial();
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — MODAL FIRMAS PRESENCIAL (igual que m-firmas-digitales)
// Lista de suplentes izq + canvas der
// ════════════════════════════════════════════════════════════════════════
function sfv2_abrirFirmasPresencial() {
  var hoja = sfv2_cargarHoja();
  if (!hoja) { showToast('No hay hoja de suplencias activa','warn'); return; }

  // Construir lista de suplentes con sus clases del periodo
  var DIAS_ORD = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  var porInst  = {};

  (registros || []).forEach(function(r) {
    if (r.estado !== 'sub' || !r.suplente_id) return;
    if (r.fecha < hoja.semIni || r.fecha > hoja.semFin) return;
    var inst = (instructores||[]).find(function(i){ return String(i.id)===String(r.suplente_id); });
    if (!inst) return;
    var key = String(inst.id);
    if (!porInst[key]) porInst[key] = { inst: inst, clases: [] };
    var hh = r.hora||'';
    var horaMin = 0;
    if (hh && !hh.includes('a.') && !hh.includes('p.')) {
      var parts = hh.split(':').map(Number);
      if (!isNaN(parts[0])) { horaMin = parts[0]*60 + (parts[1]||0); }
    }
    porInst[key].clases.push({
      dia:      r.dia||'',
      hora:     hh,
      horaMin:  horaMin,
      clase:    (r.clase||'').toUpperCase(),
      alumnos:  r.asistentes !== undefined ? parseInt(r.asistentes) : null,
      fecha:    r.fecha,
      cap:      parseInt(r.cap)||0,
      reg_id:   r.id
    });
  });

  _sfv2.suplentes = Object.values(porInst)
    .sort(function(a,b){ return a.inst.nombre.localeCompare(b.inst.nombre); })
    .map(function(p) {
      p.clases.sort(function(a,b){
        var di = DIAS_ORD.indexOf(a.dia) - DIAS_ORD.indexOf(b.dia);
        return di !== 0 ? di : (a.horaMin||0) - (b.horaMin||0);
      });
      return { inst: p.inst, clases: p.clases, id: p.inst.id };
    });

  _sfv2.profActivo   = null;
  _sfv2.puntosActual = 0;

  // Cargar firmas existentes
  _sfv2.hoja = sfv2_cargarHoja();

  // Actualizar header
  var semLbl = document.getElementById('sfv2-semana-lbl');
  if (semLbl) semLbl.textContent = hoja.encabezado || (hoja.semIni + ' al ' + hoja.semFin);

  var progFirm = document.getElementById('sfv2-prog-firmados');
  var progTot  = document.getElementById('sfv2-prog-total');
  var firmados = Object.values(hoja.firmas||{}).filter(function(f){return f&&f.data;}).length;
  if (progFirm) progFirm.textContent = firmados;
  if (progTot)  progTot.textContent  = _sfv2.suplentes.length;

  document.getElementById('m-sup-firmas-presencial').classList.add('on');

  setTimeout(function() {
    sfv2_renderListaSuplentes();
    sfv2_inicializarCanvas();
  }, 60);
}

function sfv2_renderListaSuplentes() {
  var cont = document.getElementById('sfv2-lista');
  if (!cont) return;
  var hoja    = _sfv2.hoja || {};
  var firmas  = hoja.firmas || {};
  var COLORS  = ['#E85D04','#7209B7','#0077B6','#2D6A4F','#C1121F','#F59E0B','#0891B2','#BE185D','#15803D','#9333EA'];

  // Conservar el label "Suplentes" que está como primer hijo
  var labelHtml = '<span style="font-size:.55rem;text-transform:uppercase;letter-spacing:1.2px;color:var(--txt3);padding:.4rem .2rem .2rem;font-weight:700;flex-shrink:0">Suplentes</span>';

  var chips = '';
  _sfv2.suplentes.forEach(function(p, idx) {
    var firmado  = !!(firmas[String(p.id)] && firmas[String(p.id)].data);
    var activo   = _sfv2.profActivo === idx;
    var color    = COLORS[(parseInt(p.id)||0) % COLORS.length];
    var initials = p.inst.nombre.trim().split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2).toUpperCase();
    var nombre2  = p.inst.nombre.split(' ').slice(0,2).join(' ');
    var bdr = activo ? '2px solid var(--neon)' : (firmado ? '2px solid var(--verde)' : '1px solid transparent');
    var bg  = activo ? 'rgba(26,122,69,.2)' : 'rgba(0,0,0,.08)';
    chips += [
      '<div onclick="sfv2_seleccionarSuplente('+idx+')" style="',
        'display:inline-flex;flex-direction:column;align-items:center;gap:3px;',
        'padding:5px 8px;border-radius:10px;cursor:pointer;flex-shrink:0;',
        'background:'+bg+';border:'+bdr+';',
        'transition:all .15s;-webkit-tap-highlight-color:transparent;min-width:58px;max-width:72px">',
        '<div style="position:relative">',
          '<div style="width:36px;height:36px;border-radius:50%;background:'+color+';',
            'display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;">'+initials+'</div>',
          firmado ? '<div style="position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-radius:50%;background:var(--neon);border:2px solid var(--bg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 20 20" width="9" height="9" fill="none" stroke="#0a1f10" stroke-width="3.5" stroke-linecap="round"><polyline points="4,10 8,14 16,6"/></svg></div>' : '',
        '</div>',
        '<div style="font-size:.55rem;font-weight:600;color:'+(activo?'var(--neon)':'var(--txt)')+';text-align:center;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;max-width:66px">'+nombre2+'</div>',
      '</div>'
    ].join('');
  });

  cont.innerHTML = labelHtml + chips;
  // Scroll al chip activo
  if (_sfv2.profActivo !== null) {
    var chips2 = cont.querySelectorAll('div[onclick]');
    if (chips2[_sfv2.profActivo]) {
      chips2[_sfv2.profActivo].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    }
  }
}

window.sfv2_seleccionarSuplente = function(idx) {
  if (_sfv2.profActivo !== null && _sfv2.profActivo !== idx && _sfv2.puntosActual > 10) {
    if (!confirm('¿Descartar la firma actual sin guardar?')) return;
  }
  _sfv2.profActivo    = idx;
  _sfv2.puntosActual  = 0;
  var p = _sfv2.suplentes[idx];
  if (!p) return;

  var COLORS = ['#E85D04','#7209B7','#0077B6','#2D6A4F','#C1121F','#F59E0B','#0891B2','#BE185D','#15803D','#9333EA'];
  var color  = COLORS[(parseInt(p.id)||0) % COLORS.length];

  var av = document.getElementById('sfv2-prof-avatar');
  if (av) { av.textContent = p.inst.nombre.trim().split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase(); av.style.background = color; }
  var nm = document.getElementById('sfv2-prof-nombre');
  if (nm) nm.textContent = p.inst.nombre.toUpperCase();
  var cl = document.getElementById('sfv2-prof-clases-lbl');
  if (cl) cl.textContent = p.clases.length + ' suplencia' + (p.clases.length!==1?'s':'') + ' en el periodo';

  // Mostrar mini-lista de clases del suplente
  var clsList = document.getElementById('sfv2-clases-list');
  if (clsList) {
    clsList.innerHTML = p.clases.map(function(c) {
      var fd = new Date((c.fecha||'')+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
      var afoP = (c.alumnos!==null && c.cap>0) ? Math.round(c.alumnos/c.cap*100) : null;
      var afoCol = afoP!==null ? (afoP>=70?'var(--neon)':afoP>=40?'var(--gold2)':'var(--red2)') : '#999';
      return [
        '<span style="display:inline-flex;align-items:center;gap:4px;',
          'background:var(--panel2);border:1px solid var(--border);border-radius:7px;',
          'padding:4px 9px;font-size:.65rem;color:var(--txt2);">',
          '<span style="font-family:\'DM Mono\',monospace;min-width:40px;color:var(--gold2)">', fd, '</span>',
          '<span style="font-weight:700;color:var(--txt)">', c.clase, '</span>',
          afoP!==null ? '<span style="color:'+afoCol+';font-size:.6rem">'+c.alumnos+'p&nbsp;'+afoP+'%</span>' : '',
        '</span>'
      ].join('');
    }).join('');
  }

  var ins = document.getElementById('sfv2-instruccion');
  var btn = document.getElementById('sfv2-btn-guardar');
  var hoja = sfv2_cargarHoja();
  var firma = hoja && hoja.firmas ? hoja.firmas[String(p.id)] : null;
  var firmado = firma && firma.data;

  if (ins) ins.textContent = firmado
    ? '✔ Firma guardada. Puedes borrarla y volver a firmar.'
    : 'Firma en el área de abajo con el stylus o dedo';
  if (btn) btn.style.background = firmado ? 'var(--gold)' : 'var(--v2)';

  sfv2_limpiarCanvas();
  if (firmado) {
    var img = new Image();
    img.onload = function() { _sfv2.ctx.drawImage(img, 0, 0, _sfv2.canvas.width, _sfv2.canvas.height); };
    img.src = firma.data;
  }
  sfv2_renderListaSuplentes();
};

function sfv2_inicializarCanvas() {
  var canvas = document.getElementById('sfv2-canvas');
  if (!canvas) return;
  canvas.width  = 600;
  canvas.height = 200;
  var isMob = window.innerWidth <= 640;
  var dispW = Math.min(window.innerWidth - (isMob?32:260), 680);
  canvas.style.width  = dispW + 'px';
  canvas.style.height = Math.round(dispW * (200/600)) + 'px';
  _sfv2.canvas = canvas;
  _sfv2.ctx    = canvas.getContext('2d');
  sfv2_limpiarCanvas();

  function scaleX(v, r) { return (v - r.left) * (600 / r.width); }
  function scaleY(v, r) { return (v - r.top)  * (200 / r.height); }

  function iniciarTrazo(x, y) {
    _sfv2.dibujando = true;
    _sfv2.lastX = x;   // inicializar AQUÍ para que el primer segmento parta del punto correcto
    _sfv2.lastY = y;
    _sfv2.ctx.beginPath();
    _sfv2.ctx.moveTo(x, y);
  }
  function finalizarTrazo() {
    _sfv2.dibujando = false;
    _sfv2.lastX = null;  // resetear para que el próximo trazo no arrastre
    _sfv2.lastY = null;
    _sfv2.ctx.beginPath();
  }

  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var t = e.touches[0], r = canvas.getBoundingClientRect();
    iniciarTrazo(scaleX(t.clientX, r), scaleY(t.clientY, r));
  }, {passive:false});
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!_sfv2.dibujando) return;
    var t = e.touches[0], r = canvas.getBoundingClientRect();
    sfv2_dibujar(scaleX(t.clientX, r), scaleY(t.clientY, r));
    _sfv2.puntosActual++;
  }, {passive:false});
  canvas.addEventListener('touchend',    function(e) { e.preventDefault(); finalizarTrazo(); }, {passive:false});
  canvas.addEventListener('touchcancel', function(e) { e.preventDefault(); finalizarTrazo(); }, {passive:false});

  canvas.addEventListener('mousedown', function(e) {
    var r = canvas.getBoundingClientRect();
    iniciarTrazo(scaleX(e.clientX, r), scaleY(e.clientY, r));
  });
  canvas.addEventListener('mousemove', function(e) {
    if (!_sfv2.dibujando) return;
    var r = canvas.getBoundingClientRect();
    sfv2_dibujar(scaleX(e.clientX, r), scaleY(e.clientY, r));
    _sfv2.puntosActual++;
  });
  canvas.addEventListener('mouseup',    function() { finalizarTrazo(); });
  canvas.addEventListener('mouseleave', function() { finalizarTrazo(); });
}

function sfv2_dibujar(x, y) {
  var ctx = _sfv2.ctx;
  // Si no hay punto previo (primer movimiento del trazo), solo movemos
  if (_sfv2.lastX === null || _sfv2.lastX === undefined) {
    _sfv2.lastX = x; _sfv2.lastY = y;
    ctx.beginPath(); ctx.moveTo(x, y);
    return;
  }
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth   = 2.4;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  // Curva suave entre el punto anterior y el actual
  var mx = (_sfv2.lastX + x) / 2;
  var my = (_sfv2.lastY + y) / 2;
  ctx.quadraticCurveTo(_sfv2.lastX, _sfv2.lastY, mx, my);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx, my);
  _sfv2.lastX = x;
  _sfv2.lastY = y;
}

function sfv2_limpiarCanvas() {
  if (!_sfv2.ctx||!_sfv2.canvas) return;
  _sfv2.ctx.clearRect(0,0,_sfv2.canvas.width,_sfv2.canvas.height);
  _sfv2.ctx.fillStyle='#ffffff';
  _sfv2.ctx.fillRect(0,0,_sfv2.canvas.width,_sfv2.canvas.height);
  _sfv2.puntosActual=0;
  _sfv2.ctx.beginPath();
}

window.sfv2_borrarFirmaCanvas = function() { sfv2_limpiarCanvas(); var ins=document.getElementById('sfv2-instruccion'); if(ins&&_sfv2.profActivo!==null)ins.textContent='Firma en el área de abajo con el stylus o dedo'; };

window.sfv2_guardarFirma = async function() {
  if (_sfv2.profActivo === null) { showToast('Selecciona un suplente primero','warn'); return; }
  if (_sfv2.puntosActual < 5) { showToast('El área está vacía. Firma con el stylus primero.','warn'); return; }
  var p    = _sfv2.suplentes[_sfv2.profActivo];
  var url  = _sfv2.canvas.toDataURL('image/png');
  var hoja = sfv2_cargarHoja();
  if (!hoja) { showToast('Hoja no disponible','err'); return; }
  hoja.firmas = hoja.firmas || {};
  hoja.firmas[String(p.id)] = { data: url, nombre: p.inst.nombre, ts: new Date().toISOString() };
  localStorage.setItem(SFV2_LS, JSON.stringify(hoja));
  _sfv2.hoja = hoja;
  _sfv2.puntosActual = 0;

  if (typeof fbDb !== 'undefined' && fbDb)
    fbDb.ref(SFV2_FB + '/hoja/firmas/' + String(p.id)).set(hoja.firmas[String(p.id)]).catch(function(){});

  // Progreso
  var firmados = Object.values(hoja.firmas).filter(function(f){return f&&f.data;}).length;
  var pf = document.getElementById('sfv2-prog-firmados');
  if (pf) pf.textContent = firmados;

  var ins = document.getElementById('sfv2-instruccion');
  if (ins) ins.textContent = '✔ Firma guardada correctamente';
  var btn = document.getElementById('sfv2-btn-guardar');
  if (btn) btn.style.background = 'var(--gold)';
  sfv2_renderListaSuplentes();
  showToast('Firma de ' + p.inst.nombre.split(' ')[0] + ' guardada','ok');

  // Auto-avanzar al siguiente sin firma
  setTimeout(function() {
    var sig = -1;
    var h   = sfv2_cargarHoja();
    var fms = h ? (h.firmas||{}) : {};
    for (var i=_sfv2.profActivo+1; i<_sfv2.suplentes.length; i++) {
      if (!fms[String(_sfv2.suplentes[i].id)] || !fms[String(_sfv2.suplentes[i].id)].data) { sig=i; break; }
    }
    if (sig >= 0) sfv2_seleccionarSuplente(sig);
  }, 600);
};

window.sfv2_exportarPDF = function() {
  var hoja = sfv2_cargarHoja();
  if (!hoja) { showToast('No hay hoja activa','warn'); return; }
  var firmados = Object.values(hoja.firmas||{}).filter(function(f){return f&&f.data;}).length;
  if (firmados === 0) { showToast('Aún no hay firmas guardadas','warn'); return; }
  // Sincronizar firmas individuales desde Firebase antes de generar
  showToast('Descargando firmas...','info');
  sfv2_sincFirmasIndDesdeFirebase(function() {
    sfv2_generarPDF(hoja);
  });
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — PORTAL INSTRUCTOR: firma por suplencia individual
// ════════════════════════════════════════════════════════════════════════
// ── Descarga registros e instructores desde Firebase si están vacíos ────
// Esto es el fix raíz: en el dispositivo del instructor, registros=[] hasta
// que el listener principal (pwa.js/mobile.js) los carga — pero ese proceso
// puede no haber terminado cuando el instructor abre el tab de Suplencias.
function sfv2_asegurarDatosBase(callback) {
  var tieneRegistros   = (typeof registros   !== 'undefined') && registros.length   > 0;
  var tieneInstructores= (typeof instructores !== 'undefined') && instructores.length > 0;

  console.log('[SFV2] asegurarDatosBase — registros:', tieneRegistros ? registros.length : 0, '| instructores:', tieneInstructores ? instructores.length : 0);

  if (tieneRegistros && tieneInstructores) {
    callback(); return;
  }

  if (typeof fbDb === 'undefined' || !fbDb) {
    console.warn('[SFV2] fbDb no disponible — callback sin datos');
    callback(); return;
  }

  // Intentar cargar desde localStorage primero (más rápido)
  if (!tieneRegistros) {
    try {
      var ls = localStorage.getItem('fc_registros');
      if (ls) {
        registros = JSON.parse(ls);
        if(typeof normalizarRegistros==='function') normalizarRegistros();
        tieneRegistros = registros.length > 0;
        console.log('[SFV2] registros desde localStorage:', registros.length);
      }
    } catch(e) { console.warn('[SFV2] Error leyendo fc_registros de localStorage', e); }
  }
  if (!tieneInstructores) {
    try {
      var li = localStorage.getItem('fc_instructores');
      if (li) {
        instructores = JSON.parse(li);
        tieneInstructores = instructores.length > 0;
        console.log('[SFV2] instructores desde localStorage:', instructores.length);
      }
    } catch(e) { console.warn('[SFV2] Error leyendo fc_instructores de localStorage', e); }
  }

  if (tieneRegistros && tieneInstructores) {
    console.log('[SFV2] datos completos desde localStorage — ok');
    callback(); return;
  }

  // Descargar nodos individuales (más liviano que fitness/ completo)
  console.log('[SFV2] descargando desde Firebase — instructores:', !tieneInstructores, '| registros:', !tieneRegistros);

  var pendientes = 0;
  var callbackLlamado = false;
  function _done() {
    pendientes--;
    if (pendientes <= 0 && !callbackLlamado) {
      callbackLlamado = true;
      console.log('[SFV2] Firebase descarga completa — instructores:', (typeof instructores!=='undefined'?instructores.length:0), '| registros:', (typeof registros!=='undefined'?registros.length:0));
      callback();
    }
  }

  if (!tieneInstructores) {
    pendientes++;
    fbDb.ref('fitness/instructores').once('value', function(snap) {
      try {
        var data = snap.val();
        if (data) {
          instructores = Array.isArray(data) ? data : Object.values(data);
          try { localStorage.setItem('fc_instructores', JSON.stringify(instructores)); } catch(e) {}
          console.log('[SFV2] instructores desde Firebase:', instructores.length);
        } else {
          console.warn('[SFV2] Firebase fitness/instructores vacío');
        }
      } catch(e) { console.error('[SFV2] Error procesando instructores', e); }
      _done();
    }).catch(function(e) { console.error('[SFV2] Error descargando instructores', e); _done(); });
  }

  if (!tieneRegistros) {
    pendientes++;
    fbDb.ref('fitness/registros').once('value', function(snap) {
      try {
        var data = snap.val();
        if (data) {
          registros = Object.values(data);
          if (typeof normalizarRegistros === 'function') normalizarRegistros();
          try { localStorage.setItem('fc_registros', JSON.stringify(registros)); } catch(e) {}
          console.log('[SFV2] registros desde Firebase:', registros.length);
        } else {
          console.warn('[SFV2] Firebase fitness/registros vacío');
        }
      } catch(e) { console.error('[SFV2] Error procesando registros', e); }
      _done();
    }).catch(function(e) { console.error('[SFV2] Error descargando registros', e); _done(); });
  }

  // Safety: si Firebase no responde en 8s, continuar igual
  setTimeout(function() {
    if (!callbackLlamado) {
      callbackLlamado = true;
      console.warn('[SFV2] Timeout Firebase — continuando sin datos completos');
      callback();
    }
  }, 8000);
}

window.instRenderSupTab = function() {
  // Primero asegurar que registros e instructores estén cargados
  sfv2_asegurarDatosBase(function() {
    var inst = (typeof instructores!=='undefined')
      ? instructores.find(function(i){ return String(i.id)===String(instActualId); })
      : null;
    if (!inst) return;

    // Renderizar con datos locales inmediato, luego refrescar desde Firebase
    sfv2_cargarHojaDesdeFirebase(function(hoja) {
      _sfv2.hoja = hoja;
      _instRenderSupTabConHoja(inst);
    });
  });
};

// Función interna que hace el render real con la hoja ya cargada
function _instRenderSupTabConHoja(inst) {

  var sinHoja = document.getElementById('inst-sup-sin-hoja');
  var activa  = document.getElementById('inst-sup-activa');
  var hoja    = _sfv2.hoja;

  console.log('[SFV2] renderSupTab — inst:', inst ? inst.nombre : 'null', '| instActualId:', instActualId, '| hoja:', hoja ? hoja.encabezado : 'null', '| registros totales:', (typeof registros!=='undefined' ? registros.length : 0));

  // Calcular mis suplencias del periodo (o de los últimos 60 días si no hay hoja)
  var fechaIni = hoja ? hoja.semIni : '';
  var fechaFin = hoja ? hoja.semFin : '';

  var misSups = (typeof registros!=='undefined')
    ? registros.filter(function(r){
        return r.estado==='sub' && String(r.suplente_id)===String(instActualId) &&
               (!fechaIni || r.fecha >= fechaIni) && (!fechaFin || r.fecha <= fechaFin);
      }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||'')||(a.hora||'').localeCompare(b.hora||''); })
    : [];

  console.log('[SFV2] misSups encontradas:', misSups.length, '| periodo:', fechaIni, '-', fechaFin);

  _sfv2.supClases  = misSups;
  _sfv2.supSelIdx  = null;

  if (!hoja) {
    if (sinHoja) sinHoja.style.display = 'block';
    if (activa)  activa.style.display  = 'none';
    return;
  }

  if (sinHoja) sinHoja.style.display = 'none';
  if (activa)  activa.style.display  = 'block';

  // Período
  var periodoEl = document.getElementById('inst-sup-periodo-lbl');
  if (periodoEl) periodoEl.textContent = hoja.encabezado || (hoja.semIni + ' al ' + hoja.semFin);

  // Avatar
  var iniciales = inst.nombre.split(' ').map(function(p){return p[0]||'';}).join('').slice(0,2).toUpperCase();
  var av = document.getElementById('inst-sup-avatar');
  if (av) { if(inst.foto){av.innerHTML='<img src="'+inst.foto+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';av.style.background='transparent';}else{av.textContent=iniciales;av.style.background='';} }
  var nm = document.getElementById('inst-sup-nombre-lbl');
  if (nm) nm.textContent = inst.nombre;

  // Estado general de firma
  var firmas   = hoja.firmas || {};
  var misFirma = firmas[String(instActualId)];
  var firmadoGral = !!(misFirma && misFirma.data);
  var estadoEl = document.getElementById('inst-sup-estado-lbl');
  var chipEl   = document.getElementById('inst-sup-chip');
  if (estadoEl) estadoEl.textContent = firmadoGral
    ? '✔ Firmado el ' + new Date(misFirma.ts).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
    : 'Sin firma';
  if (chipEl) {
    chipEl.textContent = firmadoGral ? '✔ Firmado' : '✖ Sin firmar';
    chipEl.style.background = firmadoGral ? 'rgba(94,255,160,.15)' : 'rgba(224,80,80,.15)';
    chipEl.style.color      = firmadoGral ? 'var(--neon)'          : 'var(--red2)';
  }

  // Tabla de suplencias — cada una con botón Firmar propio
  var tablaEl = document.getElementById('inst-sup-clases-tabla');
  if (tablaEl) {
    if (misSups.length === 0) {
      tablaEl.innerHTML = '<div class="empty" style="padding:.8rem;font-size:.72rem">Sin suplencias en este periodo.</div>';
    } else {
      // Cargar firmas individuales (por regId)
      var firmasInd = sfv2_cargarFirmasIndividuales();
      var total   = misSups.length;
      var firmAdas = misSups.filter(function(r){ return !!(firmasInd[String(r.id)]&&firmasInd[String(r.id)].data); }).length;
      var totalAsis= misSups.reduce(function(s,r){return s+(parseInt(r.asistentes)||0);},0);

      tablaEl.innerHTML = [
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">',
          '<div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">',
            '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:var(--blue);line-height:1">', total, '</div>',
            '<div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Suplencias</div>',
          '</div>',
          '<div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">',
            '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:var(--neon);line-height:1">', firmAdas, '</div>',
            '<div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Firmadas</div>',
          '</div>',
          '<div style="padding:.5rem .7rem;text-align:center">',
            '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:', firmAdas<total?'var(--red2)':'var(--neon)', ';line-height:1">', total-firmAdas, '</div>',
            '<div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Pendientes</div>',
          '</div>',
        '</div>',
        '<div>',
          misSups.map(function(r, idx) {
            var fd = new Date((r.fecha||'')+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
            var asis = parseInt(r.asistentes)||0;
            var cap  = parseInt(r.cap)||0;
            var afo  = cap>0 ? Math.round(asis/cap*100) : null;
            var afoCol = afo!==null?(afo>=70?'var(--neon)':afo>=40?'var(--gold2)':'var(--red2)'):'var(--txt3)';
            var instTit = (typeof instructores!=='undefined')?instructores.find(function(i){return i.id===r.inst_id;}):null;
            var firmaInd = firmasInd[String(r.id)];
            var firmadaInd = !!(firmaInd && firmaInd.data);
            return [
              '<div style="display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;',
                'border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;',
                'background:', firmadaInd?'rgba(94,255,160,.05)':'transparent',
                '" onclick="sfv2_abrirFirmarSuplenciaInst(', idx, ')" ',
                'onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'', firmadaInd?'rgba(94,255,160,.05)':'transparent','\'">',
                '<div style="flex:1;min-width:0">',
                  '<div style="font-weight:700;font-size:.82rem">', r.clase||'—', ' <span style="font-family:\'DM Mono\',monospace;color:var(--gold2);font-size:.72rem">', r.hora||'', '</span></div>',
                  '<div style="font-size:.64rem;color:var(--txt2);margin-top:1px">', fd, ' · Titular: ', instTit?instTit.nombre:'—', '</div>',
                  afo!==null ? '<div style="font-size:.6rem;color:'+afoCol+';margin-top:1px">'+asis+' asist. · '+afo+'% aforo</div>' : '',
                '</div>',
                firmadaInd
                  ? '<span style="font-size:.68rem;padding:3px 9px;border-radius:8px;background:rgba(94,255,160,.12);color:var(--neon);font-weight:700;flex-shrink:0">✔ Firmada</span>'
                  : '<span style="font-size:.68rem;padding:3px 9px;border-radius:8px;background:rgba(41,128,185,.12);color:var(--blue);font-weight:600;flex-shrink:0;cursor:pointer">✏ Firmar</span>',
              '</div>'
            ].join('');
          }).join(''),
        '</div>'
      ].join('');
    }
  }

  // Canvas (oculto hasta que seleccionen una suplencia)
  var canvasWrap = document.getElementById('inst-sup-canvas-wrap');
  var canvasMsg  = document.getElementById('inst-sup-canvas-msg');
  if (canvasWrap) canvasWrap.style.display = 'none';
  if (canvasMsg)  canvasMsg.style.display  = 'block';
};

window.sfv2_abrirFirmarSuplenciaInst = function(idx) {
  _sfv2.supSelIdx = idx;
  var r   = _sfv2.supClases[idx];
  if (!r) return;

  var firmasInd = sfv2_cargarFirmasIndividuales();
  var firmaExist = firmasInd[String(r.id)];
  var firmada    = !!(firmaExist && firmaExist.data);

  // Mostrar canvas
  var canvasWrap = document.getElementById('inst-sup-canvas-wrap');
  var canvasMsg  = document.getElementById('inst-sup-canvas-msg');
  if (canvasWrap) canvasWrap.style.display = 'block';
  if (canvasMsg)  canvasMsg.style.display  = 'none';

  // Actualizar título del canvas
  var tit = document.getElementById('inst-sup-canvas-titulo');
  var fd  = new Date((r.fecha||'')+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short'});
  if (tit) tit.textContent = '✏ Firmando: ' + (r.clase||'—') + ' · ' + (r.hora||'') + ' · ' + fd;

  // Botones — siempre visibles cuando hay canvas abierto
  var btnGuard  = document.getElementById('inst-sup-guardar-btn');
  var btnHint   = document.getElementById('inst-sup-canvas-hint');
  var btnBorrar = document.getElementById('inst-sup-borrar-btn');

  if (btnGuard) {
    btnGuard.style.display       = 'block';
    btnGuard.style.opacity       = firmada ? '0.5' : '1';
    btnGuard.style.pointerEvents = firmada ? 'none' : 'auto';
    btnGuard.textContent         = firmada ? '\u2714 Firma guardada' : '\u2714 Guardar Firma';
  }
  if (btnHint) btnHint.style.display = 'block';
  if (btnBorrar) {
    btnBorrar.textContent       = firmada ? '\u2716 Borrar firma' : '\u21ba Limpiar';
    btnBorrar.style.color       = firmada ? 'var(--red2)' : 'var(--txt3)';
    btnBorrar.style.borderColor = firmada ? 'rgba(224,80,80,.4)' : 'var(--border)';
  }

  // Scroll suave hasta el canvas
  setTimeout(function() {
    var wrap = document.getElementById('inst-sup-canvas-wrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 150);

  // Inicializar canvas
  setTimeout(function(){ sfv2_inicializarCanvasInst(firmada ? firmaExist.data : null); }, 80);
};

function sfv2_inicializarCanvasInst(dataUrl) {
  var canvas = document.getElementById('inst-sup-canvas');
  if (!canvas) return;
  var wrap = document.getElementById('inst-sup-canvas-wrap');
  canvas.width  = wrap ? wrap.clientWidth : 340;
  canvas.height = 200;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (dataUrl) { var img=new Image(); img.onload=function(){ctx.drawImage(img,0,0);}; img.src=dataUrl; }

  var readOnly = !!dataUrl;
  canvas.style.cursor  = readOnly ? 'not-allowed' : 'crosshair';
  canvas.style.opacity = readOnly ? '0.85' : '1';

  // Clonar para limpiar listeners
  var newC = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newC, canvas);
  var c  = document.getElementById('inst-sup-canvas');
  var cx = c.getContext('2d');
  cx.fillStyle='#ffffff'; cx.fillRect(0,0,c.width,c.height);
  if (dataUrl) { var img2=new Image(); img2.onload=function(){cx.drawImage(img2,0,0);}; img2.src=dataUrl; }

  if (readOnly) return;

  // Variables locales de estado para este canvas
  var instLastX = null, instLastY = null, instDibujando = false;

  function instScaleX(v, r) { return (v - r.left) * (c.width  / r.width);  }
  function instScaleY(v, r) { return (v - r.top)  * (c.height / r.height); }

  function instIniciar(x, y) {
    instDibujando = true;
    instLastX = x; instLastY = y;
    cx.beginPath(); cx.moveTo(x, y);
  }
  function instDibujar(x, y) {
    if (instLastX === null) { instLastX = x; instLastY = y; cx.beginPath(); cx.moveTo(x, y); return; }
    cx.strokeStyle = '#1a1a1a'; cx.lineWidth = 2.5; cx.lineCap = 'round'; cx.lineJoin = 'round';
    var mx = (instLastX + x) / 2, my = (instLastY + y) / 2;
    cx.quadraticCurveTo(instLastX, instLastY, mx, my);
    cx.stroke(); cx.beginPath(); cx.moveTo(mx, my);
    instLastX = x; instLastY = y;
  }
  function instFinalizar() {
    instDibujando = false;
    instLastX = null; instLastY = null;
    cx.beginPath();
  }

  c.addEventListener('mousedown',  function(e) {
    var r = c.getBoundingClientRect();
    instIniciar(instScaleX(e.clientX, r), instScaleY(e.clientY, r));
  });
  c.addEventListener('mousemove',  function(e) {
    if (!instDibujando) return;
    var r = c.getBoundingClientRect();
    instDibujar(instScaleX(e.clientX, r), instScaleY(e.clientY, r));
  });
  c.addEventListener('mouseup',    function() { instFinalizar(); });
  c.addEventListener('mouseleave', function() { instFinalizar(); });

  c.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var r = c.getBoundingClientRect(), t = e.touches[0];
    instIniciar(instScaleX(t.clientX, r), instScaleY(t.clientY, r));
  }, {passive:false});
  c.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!instDibujando || e.touches.length === 0) return;
    var r = c.getBoundingClientRect(), t = e.touches[0];
    instDibujar(instScaleX(t.clientX, r), instScaleY(t.clientY, r));
  }, {passive:false});
  c.addEventListener('touchend',    function(e) { e.preventDefault(); instFinalizar(); }, {passive:false});
  c.addEventListener('touchcancel', function(e) { e.preventDefault(); instFinalizar(); }, {passive:false});
}

window.instLimpiarFirmaSup = function() {
  var idx = _sfv2.supSelIdx;
  if (idx === null || idx === undefined) return;
  var r = _sfv2.supClases[idx];
  if (!r) return;
  var firmasInd = sfv2_cargarFirmasIndividuales();
  var firmaExist = firmasInd[String(r.id)];
  if (firmaExist && firmaExist.data) {
    if (!confirm('¿Borrar la firma guardada? Podrás volver a firmar.')) return;
    delete firmasInd[String(r.id)];
    sfv2_guardarFirmasIndividuales(firmasInd);
    if (typeof fbDb!=='undefined'&&fbDb)
      fbDb.ref(SFV2_FB+'/firmas_ind/'+String(r.id)).remove().catch(function(){});
    sfv2_abrirFirmarSuplenciaInst(idx);
    instRenderSupTab();
    showToast('Firma eliminada. Puedes volver a firmar.','info');
    return;
  }
  var c = document.getElementById('inst-sup-canvas');
  if (c) { var ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height); }
};

window.instGuardarFirmaSup = async function() {
  var idx = _sfv2.supSelIdx;
  if (idx === null || idx === undefined) { showToast('Selecciona una suplencia primero','warn'); return; }
  var r = _sfv2.supClases[idx];
  if (!r) return;

  var canvas = document.getElementById('inst-sup-canvas');
  if (!canvas) return;
  var ctx  = canvas.getContext('2d');
  var data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  var hayTrazo = false;
  for (var i=0;i<data.length;i+=4){ if(data[i]<240||data[i+1]<240||data[i+2]<240){hayTrazo=true;break;} }
  if (!hayTrazo) { showToast('Firma el área antes de guardar','warn'); return; }

  // Verificar hoja activa
  var hoja = sfv2_cargarHoja();
  if (!hoja) {
    // Guardar sin hoja (periodo libre)
  } else {
    var hojaValida = true;
    try {
      if (typeof fbDb!=='undefined'&&fbDb) {
        var snap = await fbDb.ref(SFV2_FB+'/hoja').once('value');
        var fbH  = snap.val();
        if (!fbH) { localStorage.removeItem(SFV2_LS); _sfv2.hoja=null; showToast('El reporte fue cerrado.','warn'); instRenderSupTab(); return; }
      }
    } catch(e) {}
  }

  var inst = (typeof instructores!=='undefined') ? instructores.find(function(i){return i.id===instActualId;}) : null;
  var dataUrl = canvas.toDataURL('image/png');
  var entrada = { data:dataUrl, nombre:inst?inst.nombre:'—', ts:new Date().toISOString(), instId:instActualId, regId:r.id };

  // Guardar en firmas individuales (clave: regId)
  var firmasInd = sfv2_cargarFirmasIndividuales();
  firmasInd[String(r.id)] = entrada;
  sfv2_guardarFirmasIndividuales(firmasInd);

  // También guardar firma del instructor en la hoja (por instId) para el coordinador
  if (hoja) {
    hoja.firmas = hoja.firmas || {};
    hoja.firmas[String(instActualId)] = { data:dataUrl, nombre:inst?inst.nombre:'—', ts:new Date().toISOString() };
    localStorage.setItem(SFV2_LS, JSON.stringify(hoja));
    _sfv2.hoja = hoja;
  }

  // Subir a Firebase
  if (typeof fbDb!=='undefined'&&fbDb) {
    fbDb.ref(SFV2_FB+'/firmas_ind/'+String(r.id)).set(entrada).catch(function(){});
    // Guardar también en hoja/firmas/{instId} para que el coordinador vea el avance en tiempo real
    if (hoja) {
      var firmaHoja = { data:dataUrl, nombre:inst?inst.nombre:'—', ts:new Date().toISOString() };
      fbDb.ref(SFV2_FB+'/hoja/firmas/'+String(instActualId)).set(firmaHoja).catch(function(){});
    }
  }

  if (typeof registrarLog==='function') registrarLog('instructor','Firma suplencia: '+(inst?inst.nombre:'—')+' · '+r.clase+' '+r.fecha);
  showToast('✔ Firma guardada','ok');

  // Refrescar tabla y avanzar a la siguiente
  instRenderSupTab();
  if (typeof instActualizarBadgeSup==='function') instActualizarBadgeSup();

  // Avanzar al siguiente sin firma
  var firmasIndFresh = sfv2_cargarFirmasIndividuales();
  for (var i=idx+1; i<_sfv2.supClases.length; i++) {
    var fi = firmasIndFresh[String(_sfv2.supClases[i].id)];
    if (!fi||!fi.data) { setTimeout(function(ii){ sfv2_abrirFirmarSuplenciaInst(ii); }, 400, i); break; }
  }
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 5 — GENERACIÓN DE PDF
// ════════════════════════════════════════════════════════════════════════
function sfv2_generarPDF(hoja) {
  // Firmas: individual (por regId) tiene prioridad sobre hoja (por instId)
  var firmasInst = hoja ? (hoja.firmas||{}) : {};
  var firmasInd  = sfv2_cargarFirmasIndividuales();

  var MOTIVOS = {permiso:'Permiso',enfermedad:'Enfermedad',vacaciones:'Vacaciones',emergencia:'Emergencia',falta:'Falta',incapacidad:'Incapacidad',otro:'Otro'};

  var sups = (typeof registros!=='undefined')
    ? registros.filter(function(r){
        return r.estado==='sub' &&
               (!hoja || (r.fecha>=hoja.semIni && r.fecha<=hoja.semFin));
      }).sort(function(a,b){
        var df=(a.fecha||'').localeCompare(b.fecha||'');
        return df!==0?df:(a.hora||'').localeCompare(b.hora||'');
      })
    : [];

  if (sups.length===0) { showToast('Sin suplencias en el periodo','warn'); return; }

  // Columnas: Fecha | Titular | Suplente | Clase | Hora | Asist. | Motivo | Firma
  var rows = sups.map(function(r, n) {
    var instOrig = (typeof instructores!=='undefined')?instructores.find(function(i){return i.id===r.inst_id;}):null;
    var instSup  = (typeof instructores!=='undefined')?instructores.find(function(i){return String(i.id)===String(r.suplente_id);}):null;
    var fd   = new Date((r.fecha||'')+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    var asis = parseInt(r.asistentes)||0;
    var mot  = MOTIVOS[r.motivo_suplencia||r.motivo||''] || (r.motivo_suplencia||r.motivo||'\u2014');
    var firma = firmasInd[String(r.id)] || firmasInst[String(r.suplente_id)];
    var firmaHtml = (firma&&firma.data)
      ? '<img src="'+firma.data+'" style="height:32px;max-width:88px;object-fit:contain;display:block;margin:0 auto" alt="Firma">'
      : '<div style="height:32px;width:88px;margin:0 auto;border:1px solid #ccc;border-radius:3px;background:#fff"></div>';
    var bg = n%2?'#f6fbf8':'#ffffff';
    var td = 'padding:5px 8px;border:1px solid #d8ede2;font-size:.75rem;vertical-align:middle;';
    return '<tr style="background:'+bg+'">' +
      '<td style="'+td+'font-family:monospace;white-space:nowrap">'+fd+'</td>' +
      '<td style="'+td+'">'+((instOrig&&instOrig.nombre)||'\u2014')+'</td>' +
      '<td style="'+td+'color:#1a5a8a;font-weight:700">'+((instSup&&instSup.nombre)||r.suplente_nombre||'\u2014')+'</td>' +
      '<td style="'+td+'font-weight:600">'+((r.clase||'\u2014').toUpperCase())+'</td>' +
      '<td style="'+td+'font-family:monospace;text-align:center">'+((r.hora)||'\u2014')+'</td>' +
      '<td style="'+td+'text-align:center">'+asis+'</td>' +
      '<td style="'+td+'">'+mot+'</td>' +
      '<td style="'+td+'text-align:center;min-width:100px">'+firmaHtml+'</td>' +
    '</tr>';
  }).join('');

  var totalFirm = sups.filter(function(r){
    var f=firmasInd[String(r.id)]||firmasInst[String(r.suplente_id)]; return f&&f.data;
  }).length;

  var enc = hoja?(hoja.encabezado||hoja.semIni+' al '+hoja.semFin):'Suplencias';
  var ths = ['Fecha','Titular','Suplente','Clase','Hora','Asist.','Motivo','Firma'].map(function(h){
    return '<th style="padding:6px 7px;border:1px solid #aaa;background:#1a7a45;color:#fff;font-size:.68rem;text-transform:uppercase;font-weight:700;white-space:nowrap">'+h+'</th>';
  }).join('');

  var htmlBody = '<div style="font-family:Arial,sans-serif;color:#111;padding:10px">' +
    '<div style="border-bottom:3px solid #1a7a45;padding-bottom:7px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:5px">' +
      '<div>' +
        '<h2 style="font-size:1.15rem;letter-spacing:2px;color:#1a7a45;margin:0 0 2px">REPORTE DE SUPLENCIAS</h2>' +
        '<p style="color:#333;font-size:.78rem;margin:0"><strong>'+enc+'</strong></p>' +
        '<p style="color:#555;font-size:.7rem;margin:2px 0 0">Club Campestre Aguascalientes &middot; Coordinaci&oacute;n Fitness</p>' +
      '</div>' +
      '<div style="text-align:right;font-size:.72rem;color:#555">' +
        '<div>Total: <strong>'+sups.length+'</strong> suplencias</div>' +
        '<div>Firmadas: <strong style="color:'+(totalFirm===sups.length?'#1a7a45':'#c0392b')+'">'+totalFirm+'/'+sups.length+'</strong></div>' +
      '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse"><thead><tr>'+ths+'</tr></thead><tbody>'+rows+'</tbody></table>' +
    '<div style="margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:18px;page-break-inside:avoid">' +
      '<div style="border-top:2px solid #1a7a45;padding-top:5px">' +
        '<p style="font-size:.72rem;color:#555;margin:0 0 24px">Coordinador de Fitness</p>' +
        '<div style="border-top:1px solid #333;font-size:.68rem;color:#555;padding-top:2px">Nombre y Firma</div>' +
      '</div>' +
      '<div style="border-top:2px solid #1a7a45;padding-top:5px">' +
        '<p style="font-size:.72rem;color:#555;margin:0 0 24px">Vo.Bo. Gerencia Deportes</p>' +
        '<div style="border-top:1px solid #333;font-size:.68rem;color:#555;padding-top:2px">Nombre y Firma</div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:6px;font-size:.62rem;color:#999;text-align:right">Generado: '+new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})+'</div>' +
  '</div>';

  // Abrir ventana nueva para imprimir (garantiza que las imágenes base64 se rendericen)
  var ventana = window.open('','_blank','width=800,height=900,scrollbars=yes');
  if (ventana) {
    ventana.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Suplencias \u2014 '+enc+'</title>' +
      '<style>' +
        '@page{size:A4 portrait;margin:12mm 14mm}' +   /* Fix: portrait + márgenes */
        'body{font-family:Arial,sans-serif;margin:0;padding:0;font-size:9px}' +
        /* Fix: firma más grande en impresión */
        'img{max-width:90px;height:32px;object-fit:contain;display:block;margin:0 auto}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:0}' +
        'th{background:#1a7a45;color:#fff;padding:4px 5px;border:1px solid #999;font-size:8px;white-space:nowrap}' +
        /* Fix: padding reducido para aprovechar mejor el espacio vertical */
        'td{padding:3px 5px;border:1px solid #ccc;vertical-align:middle;font-size:8.5px}' +
        /* Fix: columna firma más compacta para portrait */
        'td:last-child{min-width:80px;max-width:90px;text-align:center}' +
        'tr:nth-child(even) td{background:#f6fbf8}' +
        '@media print{button,nav,.noprint{display:none!important}}' +
      '<\/style>' +
      '<\/head><body>' + htmlBody +
      '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>' +
      '<\/body><\/html>');
    ventana.document.close();
  } else {
    // Popup bloqueado: fallback al modal
    var ttlEl  = document.getElementById('print-ttl');
    var bodyEl = document.getElementById('print-body');
    if (ttlEl)  ttlEl.textContent = 'Suplencias \u2014 ' + enc;
    if (bodyEl) bodyEl.innerHTML  = htmlBody;
    var mPrint = document.getElementById('m-print');
    if (mPrint) { cerrarModal('m-sup-firmas-presencial'); mPrint.classList.add('on'); }
  }
}

window.sfv2_generarPDFDesdeMenu = function() {
  var hoja = sfv2_cargarHoja();
  showToast('Descargando firmas...','info');
  sfv2_sincFirmasIndDesdeFirebase(function() {
    sfv2_generarPDF(hoja);
  });
};

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 6 — HELPERS
// ════════════════════════════════════════════════════════════════════════
function sfv2_cargarHoja() {
  try { var r=localStorage.getItem(SFV2_LS); return r?JSON.parse(r):null; } catch(e){return null;}
}
function sfv2_cargarHojaEnMemoria() {
  _sfv2.hoja = sfv2_cargarHoja();
}

// ── Carga hoja desde Firebase, sincroniza localStorage y ejecuta callback ─
// Usar en el portal del instructor para garantizar datos frescos
function sfv2_cargarHojaDesdeFirebase(callback) {
  if (typeof fbDb === 'undefined' || !fbDb) {
    console.warn('[SFV2] fbDb no disponible en cargarHojaDesdeFirebase — usando localStorage');
    _sfv2.hoja = sfv2_cargarHoja();
    if (callback) callback(_sfv2.hoja);
    return;
  }
  console.log('[SFV2] descargando hoja desde Firebase:', SFV2_FB + '/hoja');
  fbDb.ref(SFV2_FB + '/hoja').once('value', function(snap) {
    try {
      var fbHoja = snap.val();
      console.log('[SFV2] hoja desde Firebase:', fbHoja ? (fbHoja.encabezado || fbHoja.semIni) : 'null/vacía');
      if (fbHoja) {
        // Fusionar con firmas locales si es la misma hoja
        var local = sfv2_cargarHoja();
        if (local && local.semIni === fbHoja.semIni && local.semFin === fbHoja.semFin) {
          fbHoja.firmas = fbHoja.firmas || {};
          Object.keys(local.firmas || {}).forEach(function(k) {
            var fL = (local.firmas||{})[k], fR = fbHoja.firmas[k];
            if (!fL || !fL.data) return;
            if (!fR || !fR.data || new Date(fL.ts||0) > new Date(fR.ts||0)) fbHoja.firmas[k] = fL;
          });
        }
        localStorage.setItem(SFV2_LS, JSON.stringify(fbHoja));
        _sfv2.hoja = fbHoja;
      } else {
        localStorage.removeItem(SFV2_LS);
        _sfv2.hoja = null;
      }
    } catch(e) {
      _sfv2.hoja = sfv2_cargarHoja(); // fallback
    }
    if (callback) callback(_sfv2.hoja);
  }).catch(function() {
    _sfv2.hoja = sfv2_cargarHoja(); // fallback sin conexión
    if (callback) callback(_sfv2.hoja);
  });
}
function sfv2_suplentesUnicos(hoja) {
  var set = {};
  (typeof registros!=='undefined'?registros:[]).forEach(function(r){
    if(r.estado==='sub'&&r.suplente_id&&r.fecha>=hoja.semIni&&r.fecha<=hoja.semFin)
      set[String(r.suplente_id)]=true;
  });
  return Object.keys(set);
}
function sfv2_cargarFirmasIndividuales() {
  try { var r=localStorage.getItem('fc_firmas_sup_ind'); return r?JSON.parse(r):{}; } catch(e){return{};}
}
function sfv2_guardarFirmasIndividuales(obj) {
  try { localStorage.setItem('fc_firmas_sup_ind', JSON.stringify(obj)); } catch(e){}
}

// ── Carga firmas_ind desde Firebase y las fusiona con localStorage ────
// Llamar antes de generar el PDF para asegurarse de tener todas las firmas
function sfv2_sincFirmasIndDesdeFirebase(callback) {
  if (typeof fbDb === 'undefined' || !fbDb) { if(callback) callback(); return; }
  fbDb.ref(SFV2_FB + '/firmas_ind').once('value', function(snap) {
    try {
      var data = snap.val();
      if (!data) { if(callback) callback(); return; }
      var local = sfv2_cargarFirmasIndividuales();
      var changed = false;
      Object.keys(data).forEach(function(k) {
        var fF = data[k], fL = local[k];
        if (!fF || !fF.data) return;
        if (!fL || !fL.data) { local[k] = fF; changed = true; return; }
        if (new Date(fF.ts||0) > new Date(fL.ts||0)) { local[k] = fF; changed = true; }
      });
      if (changed) sfv2_guardarFirmasIndividuales(local);
    } catch(e) {}
    if (callback) callback();
  }).catch(function() { if(callback) callback(); });
}

// Badge del tab Suplencias en el portal
window.instActualizarBadgeSup = function() {
  var badge = document.getElementById('inst-sup-badge');
  var tab   = document.getElementById('inst-tabn-suplencias');
  if (typeof instActualId==='undefined'||!instActualId) return;

  // Asegurar datos base antes de calcular badge
  sfv2_asegurarDatosBase(function() {
    _computarBadgeSup(badge, tab);
  });
};

function _computarBadgeSup(badge, tab) {
  function _aplicarBadge(hoja) {
    var ini60 = (function(){ var d=new Date(); d.setDate(d.getDate()-60); return typeof fechaLocalStr==='function'?fechaLocalStr(d):d.toISOString().slice(0,10); })();
    var tieneSups = (typeof registros!=='undefined') && registros.some(function(r){
      return r.estado==='sub' && String(r.suplente_id)===String(instActualId) &&
             r.fecha >= (hoja ? hoja.semIni : ini60);
    });
    // Mostrar tab si hay hoja activa O tiene suplencias recientes
    if (tab) tab.style.display = (hoja || tieneSups) ? '' : 'none';
    if (!badge) return;
    if (!hoja) { badge.style.display='none'; return; }
    var firmasInd = sfv2_cargarFirmasIndividuales();
    var pend = (typeof registros!=='undefined')
      ? registros.filter(function(r){
          return r.estado==='sub'&&String(r.suplente_id)===String(instActualId)&&
                 r.fecha>=hoja.semIni&&r.fecha<=hoja.semFin&&
                 !(firmasInd[String(r.id)]&&firmasInd[String(r.id)].data);
        }).length : 0;
    badge.textContent=pend; badge.style.display=pend>0?'flex':'none';
  }

  // Aplicar con datos locales inmediato (no bloquea UI)
  _aplicarBadge(sfv2_cargarHoja());

  // Luego verificar Firebase para corregir si el local estaba desactualizado
  if (typeof fbDb !== 'undefined' && fbDb) {
    fbDb.ref(SFV2_FB + '/hoja').once('value', function(snap) {
      try {
        var fbHoja = snap.val();
        if (fbHoja) {
          localStorage.setItem(SFV2_LS, JSON.stringify(fbHoja));
          _sfv2.hoja = fbHoja;
        } else {
          localStorage.removeItem(SFV2_LS);
          _sfv2.hoja = null;
        }
        _aplicarBadge(fbHoja);
      } catch(e) {}
    }).catch(function(){});
  }
};

// Badge del coordinador en la home
function sfv2_actualizarBadgeCoord() {
  var hoja = sfv2_cargarHoja();
  // El hub muestra el badge cuando hay hoja activa con pendientes
  // (Se actualiza cuando se abre el hub)
}

// ── Firebase listener ─────────────────────────────────────────────────
(function sfv2_escuchar() {
  function try1() {
    if (typeof fbDb==='undefined'||!fbDb) { setTimeout(try1,1500); return; }
    fbDb.ref(SFV2_FB+'/hoja').on('value', function(snap) {
      try {
        var data  = snap.val();
        var local = sfv2_cargarHoja();
        if (data) {
          if (local&&local.semIni===data.semIni&&local.semFin===data.semFin) {
            var merged = JSON.parse(JSON.stringify(data));
            merged.firmas=merged.firmas||{};
            Object.keys(local.firmas||{}).forEach(function(k){
              var fL=(local.firmas||{})[k],fR=merged.firmas[k];
              if(!fL||!fL.data)return;
              if(!fR||!fR.data){merged.firmas[k]=fL;return;}
              if(new Date(fL.ts||0)>new Date(fR.ts||0))merged.firmas[k]=fL;
            });
            localStorage.setItem(SFV2_LS,JSON.stringify(merged));
            _sfv2.hoja=merged;
          } else {
            localStorage.setItem(SFV2_LS,JSON.stringify(data));
            _sfv2.hoja=data;
            if (!local&&typeof instActualId!=='undefined'&&instActualId) {
              var tieneSup=(typeof registros!=='undefined')&&registros.some(function(r){
                return r.estado==='sub'&&String(r.suplente_id)===String(instActualId)&&r.fecha>=data.semIni&&r.fecha<=data.semFin;
              });
              if(tieneSup&&typeof showToast==='function') showToast('✍ Reporte de suplencias disponible','ok');
            }
          }
        } else {
          localStorage.removeItem(SFV2_LS); _sfv2.hoja=null;
          if(local&&typeof showToast==='function') showToast('El reporte de suplencias fue cerrado.','info');
        }
        // Asegurar datos base antes de refrescar badge y tab del instructor
        sfv2_asegurarDatosBase(function() {
          if(typeof instActualizarBadgeSup==='function') instActualizarBadgeSup();
          // Refrescar si el tab está visible (usa flag en vez de display para evitar race condition)
          if(_sfv2.tabVisible&&typeof instRenderSupTab==='function') instRenderSupTab();
        });
        // Refrescar modal presencial del coordinador si está abierto
        var modalPresencial = document.getElementById('m-sup-firmas-presencial');
        if (modalPresencial && modalPresencial.classList.contains('on') && _sfv2.hoja) {
          var firmadosAct = Object.values(_sfv2.hoja.firmas||{}).filter(function(f){return f&&f.data;}).length;
          var pf = document.getElementById('sfv2-prog-firmados');
          if (pf) pf.textContent = firmadosAct;
          sfv2_renderListaSuplentes();
        }
      } catch(e){}
    });
    // Sincronizar firmas individuales
    fbDb.ref(SFV2_FB+'/firmas_ind').on('value', function(snap) {
      try {
        var data=snap.val(); if(!data)return;
        var local=sfv2_cargarFirmasIndividuales();
        var changed=false;
        Object.keys(data).forEach(function(k){
          var fF=data[k],fL=local[k];
          if(!fF||!fF.data)return;
          if(!fL||!fL.data){local[k]=fF;changed=true;return;}
          if(new Date(fF.ts||0)>new Date(fL.ts||0)){local[k]=fF;changed=true;}
        });
        if(changed){
          sfv2_guardarFirmasIndividuales(local);
          if(typeof instActualizarBadgeSup==='function')instActualizarBadgeSup();
          // Refrescar vista presencial del coordinador si está abierta
          var modalPresencial = document.getElementById('m-sup-firmas-presencial');
          if (modalPresencial && modalPresencial.classList.contains('on')) {
            // Actualizar contador de firmados
            var hoja = sfv2_cargarHoja();
            if (hoja) {
              // Recalcular firmados contando firmas individuales
              var allFirmas = sfv2_cargarFirmasIndividuales();
              var sups = (typeof registros!=='undefined')
                ? registros.filter(function(r){ return r.estado==='sub' && r.suplente_id && r.fecha>=hoja.semIni && r.fecha<=hoja.semFin; })
                : [];
              var instConFirma = new Set();
              sups.forEach(function(r) {
                if (allFirmas[String(r.id)] && allFirmas[String(r.id)].data) instConFirma.add(String(r.suplente_id));
              });
              // Mezclar con firmas del objeto hoja
              Object.keys(hoja.firmas||{}).forEach(function(k){ if(hoja.firmas[k]&&hoja.firmas[k].data) instConFirma.add(k); });
              var pf = document.getElementById('sfv2-prog-firmados');
              if (pf) pf.textContent = instConFirma.size;
              sfv2_renderListaSuplentes();
            }
          }
          // Refrescar tab suplencias del portal del instructor si está visible
          if (_sfv2.tabVisible && typeof instRenderSupTab==='function') instRenderSupTab();
        }
      } catch(e){}
    });
  }
  setTimeout(try1, 500); // reducido: instructores ven hoja más rápido
})();

// ── Test de escritura Firebase al arrancar ────────────────────────────
(function sfv2_testFirebase() {
  function run() {
    if (typeof fbDb === 'undefined' || !fbDb) { setTimeout(run, 2000); return; }
    var testRef = fbDb.ref(SFV2_FB + '/_test');
    testRef.set({ ts: Date.now() })
      .then(function() {
        console.log('[SFV2] ✔ Firebase escritura OK en', SFV2_FB);
        testRef.remove().catch(function(){});
      })
      .catch(function(e) {
        console.error('[SFV2] ✖ Firebase escritura BLOQUEADA en', SFV2_FB, '— error:', e.code, e.message);
        // Esto indica reglas de Firebase denegando acceso al nodo fc_sup_firmas
      });
  }
  setTimeout(run, 3000);
})();

// ── Integrar con instSwitchTab ────────────────────────────────────────
(function() {
  function wait(fn,n){
    n=n||50;
    if(typeof instSwitchTab==='function'&&typeof instCargarHojaFirmas==='function') fn();
    else if(n>0) setTimeout(function(){wait(fn,n-1);},200);
  }
  wait(function(){
    var _orig=window.instSwitchTab;
    window.instSwitchTab=function(tab){
      var sp=document.getElementById('inst-panel-suplencias');
      if(sp&&tab!=='suplencias') sp.style.display='none';
      _orig.call(this,tab);
      if(tab==='suplencias'){
        ['hoy','reporte','firma'].forEach(function(t){var p=document.getElementById('inst-panel-'+t);if(p)p.style.display='none';});
        if(sp)sp.style.display='block';
        document.querySelectorAll('.inst-tab-btn').forEach(function(b){b.classList.toggle('on',b.dataset.t==='suplencias');});
        _sfv2.tabVisible=true;
        // Siempre forzar lectura de Firebase al entrar al tab
        instRenderSupTab();
      } else {
        _sfv2.tabVisible=false;
      }
    };
    var _origC=window.instCargarHojaFirmas;
    window.instCargarHojaFirmas=function(){
      _origC.apply(this,arguments);
      instActualizarBadgeSup();
    };
  });
})();

// ── Botón "Verificar" en el portal: fuerza recarga desde Firebase ────────
window.sfv2_verificarHojaPortal = function() {
  showToast('Verificando...','info');
  // Asegurar datos base primero (fix: en dispositivo nuevo instructores=[] al presionar Verificar)
  sfv2_asegurarDatosBase(function() {
    var inst = (typeof instructores!=='undefined') ? instructores.find(function(i){return String(i.id)===String(instActualId);}) : null;
    if (!inst) {
      showToast('Sin reporte activo por el momento','info');
      return;
    }
    sfv2_cargarHojaDesdeFirebase(function(hoja) {
      _sfv2.hoja = hoja;
      if (typeof _instRenderSupTabConHoja === 'function') _instRenderSupTabConHoja(inst);
      if (typeof instActualizarBadgeSup === 'function') instActualizarBadgeSup();
      if (hoja) {
        showToast('✔ Reporte encontrado: ' + (hoja.encabezado || hoja.semIni + ' al ' + hoja.semFin), 'ok');
      } else {
        showToast('Sin reporte activo por el momento','info');
      }
    });
  });
};
window.sfv2_verificarHojaPortal = window.sfv2_verificarHojaPortal; // exponer
// Alias por si el HTML lo llama con nombre diferente
window.instVerificarHojaSup = window.sfv2_verificarHojaPortal;

// Exponer globales
window.sfv2_generarPDF         = sfv2_generarPDF;
window.sfv2_limpiarCanvas      = sfv2_limpiarCanvas;
window.sfv2_cargarHoja         = sfv2_cargarHoja;

// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 11 — PARCHE PLANIFICADOR: Editar/Quitar suplente persiste
// ════════════════════════════════════════════════════════════════════════
(function sfv2_patchPlanificador() {
  function wait(fn, n) {
    n = n || 60;
    if (typeof splGuardarAsignacion === 'function' && typeof splQuitarAsignacion === 'function') fn();
    else if (n > 0) setTimeout(function(){ wait(fn, n-1); }, 200);
  }

  wait(function() {
    // ── Parche splGuardarAsignacion: después de guardar en memoria, persistir ──
    var _origGuardar = window.splGuardarAsignacion || splGuardarAsignacion;
    window.splGuardarAsignacion = function() {
      // Ejecutar original (guarda en splAsignaciones y re-renderiza)
      _origGuardar.apply(this, arguments);
      // Persistir inmediatamente en suplenciasPlan + Firebase
      sfv2_persistirAsignaciones();
    };

    // ── Parche splQuitarAsignacion: eliminar también de suplenciasPlan ──
    var _origQuitar = window.splQuitarAsignacion || splQuitarAsignacion;
    window.splQuitarAsignacion = function() {
      // Obtener la key antes de que el original la borre
      var keyEl = document.getElementById('spl-asig-key');
      var key   = keyEl ? keyEl.value : null;

      // Ejecutar original
      _origQuitar.apply(this, arguments);

      // Eliminar de suplenciasPlan si existe
      if (key) {
        var parts = key.split('|'); // instId|fecha|dia|hora
        if (parts.length >= 4) {
          var iId = parts[0], fecha = parts[1], dia = parts[2], hora = parts[3];
          var idx = -1;
          for (var i = 0; i < suplenciasPlan.length; i++) {
            var s = suplenciasPlan[i];
            if (String(s.inst_id)===iId && s.fecha===fecha && s.dia===dia && s.hora===hora) {
              idx = i; break;
            }
          }
          if (idx >= 0) {
            var borrada = suplenciasPlan.splice(idx, 1)[0];
            // Persistir
            try {
              localStorage.setItem('fc_suplencias', JSON.stringify(suplenciasPlan));
            } catch(e) {}
            if (typeof fbDb !== 'undefined' && fbDb && borrada) {
              fbDb.ref('fitness/suplencias/' + String(borrada.id)).remove().catch(function(){});
            }
            if (typeof guardarSupLocal === 'function') guardarSupLocal();
            if (typeof renderSupPlan   === 'function') renderSupPlan();
            if (typeof showToast       === 'function') showToast('Suplente removido y guardado', 'ok');
          }
        }
      }
    };
  });

  // ── Persistir asignaciones del planificador en suplenciasPlan + Firebase ──
  function sfv2_persistirAsignaciones() {
    if (typeof splAsignaciones === 'undefined') return;
    var keys = Object.keys(splAsignaciones);
    if (keys.length === 0) return;
    var instIdEl = document.getElementById('spl-inst');
    var instId   = instIdEl ? parseInt(instIdEl.value) : 0;
    if (!instId) return;

    var guardados = 0;
    keys.forEach(function(key) {
      var parts = key.split('|');
      if (parts.length < 4) return;
      var iId = parts[0], fecha = parts[1], dia = parts[2], hora = parts[3];
      var inst = (typeof instructores!=='undefined') ? instructores.find(function(i){return String(i.id)===iId;}) : null;
      if (!inst) return;
      var slot = (inst.horario||[]).find(function(h){return h.dia===dia&&h.hora===hora;});
      if (!slot) return;
      var asig = splAsignaciones[key];

      var datos = {
        id: Date.now() + guardados,
        inst_id: parseInt(iId),
        suplente_id:     asig.supId || null,
        suplente_nombre: asig.externo ? asig.supNombre : null,
        clase:   slot.clase,
        dia:     dia,
        hora:    hora,
        fecha:   fecha,
        motivo:  asig.motivo || 'permiso',
        nota:    asig.nota   || '',
        estado:  'aprobado',
        ts:      new Date().toISOString()
      };

      // Buscar existente
      var exIdx = -1;
      for (var i = 0; i < suplenciasPlan.length; i++) {
        var s = suplenciasPlan[i];
        if (String(s.inst_id)===iId && s.fecha===fecha && s.dia===dia && s.hora===hora) {
          exIdx = i; break;
        }
      }
      if (exIdx >= 0) { datos.id = suplenciasPlan[exIdx].id; suplenciasPlan[exIdx] = datos; }
      else            { suplenciasPlan.push(datos); }

      if (typeof fbDb !== 'undefined' && fbDb)
        fbDb.ref('fitness/suplencias/' + String(datos.id)).set(datos).catch(function(){});

      guardados++;
    });

    if (guardados > 0) {
      try { localStorage.setItem('fc_suplencias', JSON.stringify(suplenciasPlan)); } catch(e) {}
      if (typeof guardarSupLocal === 'function') guardarSupLocal();
      if (typeof renderSupPlan   === 'function') renderSupPlan();
    }
  }

  window.sfv2_persistirAsignaciones = sfv2_persistirAsignaciones;
})();


// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 12 — PARCHE COLUMNAS REPORTE DE SUPLENCIAS
// Orden: Fecha · Titular · Suplente · Clase · Hora · Asistentes · Motivo
// Se elimina "Aforo %" del reporte de consulta.
// ════════════════════════════════════════════════════════════════════════
(function sfv2_patchColumnas() {
  var MOTIVOS_MAP = {
    permiso:'Permiso', vacaciones:'Vacaciones', falta:'Falta',
    incapacidad:'Incapacidad', enfermedad:'Enfermedad',
    emergencia:'Emergencia', otro:'Otro'
  };
  function motivoLabel(r) {
    var m = r.motivo_suplencia || r.motivo || '';
    return MOTIVOS_MAP[m] || m || '\u2014';
  }
  function pctCol(p) {
    return p >= 70 ? 'var(--neon)' : p >= 40 ? 'var(--gold2)' : 'var(--red2)';
  }
  function pctColPrint(p) {
    return p >= 70 ? '#1a7a45' : p >= 40 ? '#b8860b' : '#c0392b';
  }

  function wait(fn, n) {
    n = n || 80;
    if (typeof renderReporteSuplencias === 'function') fn();
    else if (n > 0) setTimeout(function(){ wait(fn, n-1); }, 150);
  }

  wait(function() {

    // ── 1. Tabla de consulta (dentro del modal m-suplencias) ──────────
    window.renderReporteSuplencias = function() {
      var ini      = document.getElementById('sup-fecha-ini').value;
      var fin      = document.getElementById('sup-fecha-fin').value;
      var filtInst = document.getElementById('sup-filtro-inst').value;
      if (!ini || !fin) { showToast('Selecciona el rango de fechas','err'); return; }
      var d1 = new Date(ini+'T00:00:00'), d2 = new Date(fin+'T23:59:59');
      window.lastSuplencias = registros.filter(function(r) {
        if (r.estado !== 'sub') return false;
        var d = new Date(r.fecha+'T12:00:00');
        if (d < d1 || d > d2) return false;
        if (filtInst && String(r.suplente_id) !== filtInst) return false;
        return true;
      }).sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });

      var bodyEl     = document.getElementById('sup-body');
      var exportBtns = document.getElementById('sup-export-btns');

      if (!window.lastSuplencias.length) {
        bodyEl.innerHTML = '<div class="empty">Sin suplencias en el periodo seleccionado</div>';
        if (exportBtns) exportBtns.style.display = 'none';
        return;
      }

      var ths = ['Fecha','Titular','Suplente','Clase','Hora','Asist.','Motivo'].map(function(h) {
        return '<th style="padding:7px 10px;color:var(--txt2);font-size:.67rem;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);white-space:nowrap">'+h+'</th>';
      }).join('');

      var filas = window.lastSuplencias.map(function(r, n) {
        var instOrig = instructores.find(function(i){ return i.id === r.inst_id; });
        var sup      = instructores.find(function(i){ return i.id === r.suplente_id; });
        var fd  = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        var mot = motivoLabel(r);
        var bg  = n%2 ? 'var(--panel2)' : 'transparent';
        return '<tr style="background:'+bg+';border-bottom:1px solid var(--border)">' +
          '<td style="padding:6px 10px;font-family:monospace;font-size:.78rem">'+fd+'</td>' +
          '<td style="padding:6px 10px;color:var(--txt2)">'+((instOrig&&instOrig.nombre)||'\u2014')+'</td>' +
          '<td style="padding:6px 10px;color:var(--blue);font-weight:600">'+((sup&&sup.nombre)||r.suplente_nombre||'\u2014')+'</td>' +
          '<td style="padding:6px 10px;font-weight:600">'+((r.clase||'').toUpperCase())+'</td>' +
          '<td style="padding:6px 10px;font-family:monospace">'+((r.hora)||'\u2014')+'</td>' +
          '<td style="padding:6px 10px;text-align:center;font-weight:700">'+((parseInt(r.asistentes)||0))+'</td>' +
          '<td style="padding:6px 10px;font-size:.76rem">'+mot+'</td>' +
        '</tr>';
      }).join('');

      bodyEl.innerHTML =
        '<div style="font-size:.78rem;color:var(--txt2);margin-bottom:.6rem">'+
          window.lastSuplencias.length+' suplencia(s) &mdash; '+ini+' al '+fin+
        '</div>' +
        '<div style="overflow-x:auto;max-height:340px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:.8rem">' +
            '<thead><tr style="position:sticky;top:0;background:var(--panel2)">'+ths+'</tr></thead>' +
            '<tbody>'+filas+'</tbody>' +
          '</table>' +
        '</div>';
      if (exportBtns) exportBtns.style.display = 'flex';
    };

    // ── 2. Imprimir / PDF del reporte (sin firmas) ────────────────────
    window.imprimirSuplencias = function() {
      var ini = document.getElementById('sup-fecha-ini').value;
      var fin = document.getElementById('sup-fecha-fin').value;
      if (!window.lastSuplencias || !window.lastSuplencias.length) return;

      var ths = ['Fecha','Titular','Suplente','Clase','Hora','Asist.','Motivo'].map(function(h) {
        return '<th style="padding:6px 9px;border:1px solid #ccc;background:#1a7a45;color:#fff;font-size:.67rem;text-transform:uppercase">'+h+'</th>';
      }).join('');

      var filas = window.lastSuplencias.map(function(r, n) {
        var instOrig = (typeof instructores !== 'undefined') ? instructores.find(function(i){ return i.id===r.inst_id; }) : null;
        var sup      = (typeof instructores !== 'undefined') ? instructores.find(function(i){ return i.id===r.suplente_id; }) : null;
        var fd  = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
        var mot = motivoLabel(r);
        var bg  = n%2 ? '#f9fdf9' : '#fff';
        return '<tr style="background:'+bg+'">' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace">'+fd+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5">'+((instOrig&&instOrig.nombre)||'\u2014')+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5;color:#1a5a8a;font-weight:700">'+((sup&&sup.nombre)||r.suplente_nombre||'\u2014')+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5;font-weight:600">'+((r.clase||'').toUpperCase())+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5;font-family:monospace;text-align:center">'+((r.hora)||'\u2014')+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5;text-align:center;font-weight:700">'+((parseInt(r.asistentes)||0))+'</td>' +
          '<td style="padding:5px 9px;border:1px solid #e0ede5">'+mot+'</td>' +
        '</tr>';
      }).join('');

      var html =
        '<div style="font-family:\'Outfit\',sans-serif;color:#111">' +
          '<div style="border-bottom:3px solid #1a7a45;padding-bottom:.7rem;margin-bottom:1rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem">' +
            '<div>' +
              '<h1 style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;letter-spacing:2px;color:#1a7a45;margin:0">REPORTE DE SUPLENCIAS</h1>' +
              '<p style="color:#555;font-size:.8rem;margin:.2rem 0">Club Campestre Aguascalientes &middot; Coordinaci&oacute;n Fitness</p>' +
              '<p style="color:#333;font-size:.82rem;margin:.2rem 0">Periodo: <strong>'+ini+'</strong> al <strong>'+fin+'</strong> &middot; Total: '+window.lastSuplencias.length+' suplencias</p>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.4rem;color:#1a7a45">'+window.lastSuplencias.length+'</div>' +
              '<div style="font-size:.78rem;color:#555">suplencias</div>' +
            '</div>' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:.79rem">' +
            '<thead><tr>'+ths+'</tr></thead>' +
            '<tbody>'+filas+'</tbody>' +
          '</table>' +
          '<div style="margin-top:1.5rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
            '<div style="border-top:2px solid #1a7a45;padding-top:.5rem">' +
              '<div style="font-size:.75rem;color:#555;margin-bottom:2rem">Firma Coordinador Fitness</div>' +
              '<div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>' +
            '</div>' +
            '<div style="border-top:2px solid #1a7a45;padding-top:.5rem">' +
              '<div style="font-size:.75rem;color:#555;margin-bottom:2rem">Vo.Bo. Recursos Humanos</div>' +
              '<div style="border-top:1px solid #333;font-size:.72rem;color:#555">Nombre y Firma</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.getElementById('print-ttl').textContent = 'Suplencias \u2014 '+ini+' al '+fin;
      document.getElementById('print-body').innerHTML  = html;
      if (typeof cerrarModal === 'function') cerrarModal('m-suplencias');
      document.getElementById('m-print').classList.add('on');
    };

    // ── 3. Exportar Excel ─────────────────────────────────────────────
    window.exportarSuplenciasExcel = function() {
      if (!window.lastSuplencias || !window.lastSuplencias.length) return;
      var rows = [['Fecha','Titular','Suplente','Clase','Hora','Asistentes','Motivo','Día']];
      window.lastSuplencias.forEach(function(r) {
        var instOrig = (typeof instructores!=='undefined')?instructores.find(function(i){return i.id===r.inst_id;}):null;
        var sup      = (typeof instructores!=='undefined')?instructores.find(function(i){return i.id===r.suplente_id;}):null;
        rows.push([
          r.fecha,
          (instOrig&&instOrig.nombre)||'\u2014',
          (sup&&sup.nombre)||r.suplente_nombre||'\u2014',
          (r.clase||'').toUpperCase(),
          r.hora,
          parseInt(r.asistentes)||0,
          motivoLabel(r),
          r.dia||''
        ]);
      });
      if (typeof XLSX === 'undefined') { showToast('Librería Excel no disponible','warn'); return; }
      var ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{wch:14},{wch:24},{wch:24},{wch:14},{wch:9},{wch:11},{wch:14},{wch:11}];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, 'Suplencias', ws);
      XLSX.writeFile(wb, 'Suplencias_FitnessControl.xlsx');
    };

  }); // end wait
})();


// ════════════════════════════════════════════════════════════════════════
// SECCIÓN 13 — PARCHE: Motivo en Falta + Editar registro al tocar clase
// ════════════════════════════════════════════════════════════════════════
(function sfv2_patchRegistro() {
  function wait(fn, n) {
    n = n || 80;
    if (typeof toggleSuplenteClase === 'function' &&
        typeof toggleErSuplente    === 'function' &&
        typeof abrirRegistroDesdeCalendario === 'function') fn();
    else if (n > 0) setTimeout(function(){ wait(fn, n-1); }, 150);
  }

  wait(function() {

    // ── FIX 1: Mostrar "Motivo" también cuando estado es "falta" ─────
    // Aplica a m-clase (registro nuevo) y m-edit-reg (editar)

    window.toggleSuplenteClase = function() {
      var v      = document.getElementById('rc-est').value;
      var isSub  = (v === 'sub');
      var isFalt = (v === 'falta');

      // Fila suplente: solo si es 'sub'
      var supRow = document.getElementById('rc-suplente-row');
      if (supRow) supRow.style.display = isSub ? 'flex' : 'none';

      // Fila motivo: si es 'sub' O 'falta'
      var motRow = document.getElementById('rc-motivo-row');
      if (motRow) {
        motRow.style.display = (isSub || isFalt) ? 'flex' : 'none';
        // Cambiar la etiqueta según el contexto
        var lbl = motRow.querySelector('label');
        if (lbl) lbl.textContent = isSub ? 'Motivo de Suplencia' : 'Motivo de Falta';
      }
    };

    window.toggleErSuplente = function() {
      var v      = document.getElementById('er-est').value;
      var isSub  = (v === 'sub');
      var isFalt = (v === 'falta');

      var supRow = document.getElementById('er-suplente-row');
      if (supRow) supRow.style.display = isSub ? 'flex' : 'none';

      var motRow = document.getElementById('er-motivo-row');
      if (motRow) {
        motRow.style.display = (isSub || isFalt) ? 'flex' : 'none';
        var lbl = motRow.querySelector('label');
        if (lbl) lbl.textContent = isSub ? 'Motivo de Suplencia' : 'Motivo de Falta';
      }
    };

    // Mismo fix para el recorrido
    var _origToggleRec = window.toggleSuplenteRec;
    if (typeof _origToggleRec === 'function') {
      window.toggleSuplenteRec = function() {
        _origToggleRec.apply(this, arguments);
        // rcc-motivo-row ya lo maneja el original (solo para sub)
        // pero lo ajustamos igual
        var v      = (document.getElementById('rcc-pres') || {}).value || '';
        var isSub  = (v === 'sub');
        var isFalt = (v === 'falta');
        var motRow = document.getElementById('rcc-motivo-row');
        if (motRow) {
          motRow.style.display = (isSub || isFalt) ? 'flex' : 'none';
          var lbl = motRow.querySelector('label');
          if (lbl) lbl.textContent = isSub ? 'Motivo de Suplencia' : 'Motivo de Falta';
        }
      };
    }

    // También ajustar guardarClase para que guarde motivo_suplencia en falta
    var _origGuardarClase = window.guardarClase;
    if (typeof _origGuardarClase === 'function') {
      window.guardarClase = function() {
        // Antes de guardar, copiar el motivo al campo correcto si es falta
        var estEl  = document.getElementById('rc-est');
        var motEl  = document.getElementById('rc-motivo');
        if (estEl && motEl && estEl.value === 'falta') {
          // guardarClase lee motivo_suplencia del campo rc-motivo — no necesita cambio
          // solo asegurar que el valor esté sincronizado
        }
        _origGuardarClase.apply(this, arguments);
      };
    }

    // ── FIX 2: Tocar una clase registrada abre m-edit-reg, no m-clase ─
    var _origAbrir = window.abrirRegistroDesdeCalendario;
    window.abrirRegistroDesdeCalendario = function(instId, dia, hora, clase, fechaStr) {
      // Buscar si ya hay un registro para esta clase en esta fecha
      var regExistente = (typeof registros !== 'undefined')
        ? registros.find(function(r) {
            return String(r.inst_id) === String(instId) &&
                   r.fecha === fechaStr &&
                   r.hora  === hora &&
                   (r.clase === clase || (r.clase||'').toLowerCase() === (clase||'').toLowerCase());
          })
        : null;

      if (regExistente && typeof abrirEditarRegistro === 'function') {
        // Ya existe: abrir modal de edición
        abrirEditarRegistro(regExistente.id);
      } else {
        // No existe: abrir modal de nuevo registro
        _origAbrir.apply(this, arguments);
      }
    };

    // Aplicar toggles en los modales en cuanto se abran para reflejar estado guardado
    // (por si ya tienen estado 'falta' al abrirse desde edición)
    var _origAbrirEdit = window.abrirEditarRegistro;
    if (typeof _origAbrirEdit === 'function') {
      window.abrirEditarRegistro = function(regId) {
        _origAbrirEdit.apply(this, arguments);
        // Forzar toggleErSuplente después para que el motivo se muestre si es falta
        setTimeout(function() {
          if (typeof window.toggleErSuplente === 'function') window.toggleErSuplente();
          // Cargar motivo guardado
          var r = (typeof registros !== 'undefined') ? registros.find(function(x){ return x.id === regId; }) : null;
          if (r && (r.motivo_suplencia || r.motivo)) {
            var motEl = document.getElementById('er-motivo');
            if (motEl) motEl.value = r.motivo_suplencia || r.motivo || 'permiso';
          }
        }, 60);
      };
    }

  }); // end wait
})();
