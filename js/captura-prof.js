// ═══════════════════════════════════════════════════════════════════
// CAPTURA DE ALUMNOS POR EL PROFESOR
//
// PROFESOR (portal del instructor → "Mis Clases")
//  · Toca una de las clases del día → se abre su tarjeta con un contador
//    (− / +, o teclear directo), notas y "Guardar".
//  · Solo se puede capturar el MISMO DÍA de la clase. Otro día = solo lectura.
//    La fecha se toma del reloj de Firebase, así que cambiar la fecha del
//    teléfono no abre días anteriores.
//  · Si nadie había capturado la clase, el número del profesor queda en la
//    casilla principal (asistentes) y puede corregirlo ese mismo día.
//  · Si el coordinador ya capturó, la casilla principal queda bloqueada para
//    el profesor, pero puede anotar libremente "su aforo" (campo aparte).
//
// COORDINADOR (vista del celular → Hoy)
//  · Si el aforo del profesor difiere del que capturó el coordinador, aparece
//    una observación con los dos números y la nota del profesor.
//  · "Autorizar" pasa el número del profesor a la casilla principal.
//    "Dejar mi número" conserva el del coordinador y cierra la observación.
//
// Campos que agrega a cada registro (todos opcionales):
//   captura_por   'inst' | 'coord'   quién fijó el número principal
//   asis_prof     número que contó el profesor (siempre se conserva aparte)
//   asis_prof_nota, asis_prof_ts
//   asis_prof_aut 'autorizado' | 'descartado'   decisión del coordinador
//   asis_coord_prev  número que tenía el coordinador antes de autorizar
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const TZ = 'America/Mexico_City';
  const MAX_PERSONAS = 999;
  const DIAS_OBS = 30;                       // observaciones pendientes de los últimos N días

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aviso = (m, t) => { try { showToast(m, t || 'info'); } catch (e) { alert(m); } };
  const hayNum = v => v !== undefined && v !== null && v !== '' && !isNaN(parseInt(v, 10));

  // ── Reloj del servidor (Firebase) ────────────────────────────────
  let _offset = 0, _relojListo = false;
  function iniciarReloj() {
    try {
      if (typeof fbDb === 'undefined' || !fbDb) return false;
      fbDb.ref('.info/serverTimeOffset').on('value', s => {
        const v = s.val();
        if (typeof v === 'number') _offset = v;
      });
      return true;
    } catch (e) { return false; }
  }
  function ahora() {
    if (!_relojListo) _relojListo = iniciarReloj();
    return Date.now() + _offset;
  }
  function hoyStr() {
    let s = '';
    try { s = new Date(ahora()).toLocaleDateString('en-CA', { timeZone: TZ }); } catch (e) {}
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fechaLocalStr(new Date(ahora()));
  }
  window.instCapHoy = hoyStr;

  function restarDias(fecha, n) {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() - n);
    return fechaLocalStr(d);
  }
  function fechaLarga(fecha, corta) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX',
      corta ? { weekday: 'short', day: 'numeric', month: 'short' }
            : { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ── Estado de captura de una clase ───────────────────────────────
  function regDe(inst, slot, fecha) {
    const regs = registros.filter(r =>
      String(r.inst_id) === String(inst.id) && r.fecha === fecha &&
      r.dia === slot.dia && r.hora === slot.hora);
    return regs.length ? regs[regs.length - 1] : null;
  }
  // Minutos desde medianoche en hora de México (reloj del servidor)
  function minAhora() {
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(ahora()));
      const h = parseInt(p.find(x => x.type === 'hour').value, 10), m = parseInt(p.find(x => x.type === 'minute').value, 10);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    } catch (e) {}
    const d = new Date(ahora()); return d.getHours() * 60 + d.getMinutes();
  }
  function aunNoEmpieza(slot) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String((slot && slot.hora) || ''));
    if (!m) return false;
    return minAhora() < (parseInt(m[1], 10) * 60 + parseInt(m[2], 10));
  }
  function estadoCaptura(reg, fecha, hoy, slot) {
    if (fecha > hoy) return 'futura';
    if (fecha < hoy) return 'pasada';
    if (aunNoEmpieza(slot)) return 'temprano';           // hoy, pero la clase aún no comienza
    if (reg && (reg.estado === 'falta' || reg.estado === 'sub')) return 'estado';
    if (!reg) return 'nueva';
    if (reg.captura_por === 'inst') return 'propia';     // la fijó el profesor: puede corregir hoy
    if (reg.asis_prof_aut) return 'resuelta';            // el coordinador ya revisó su aforo
    return 'aforo';                                       // el coordinador capturó: bloqueada, aforo libre
  }

  // ── Aviso dentro de la tarjeta de la clase (lista "Mis Clases") ──
  window.instCapBadge = function (reg, fecha, slot) {
    const hoy = hoyStr();
    const modo = estadoCaptura(reg, fecha, hoy, slot);
    let txt = '', cls = '';
    const mio = reg && hayNum(reg.asis_prof) ? parseInt(reg.asis_prof, 10) : null;
    if (modo === 'nueva')        { txt = '✎ Toca para capturar tus alumnos'; cls = 'go'; }
    else if (modo === 'propia')  { txt = '✔ Capturada por ti · toca para corregir'; cls = 'ok'; }
    else if (modo === 'aforo')   { txt = mio !== null ? `Tu aforo: ${mio} · en revisión` : '🔒 Coordinación ya registró · toca si tu conteo es distinto'; cls = mio !== null ? 'rev' : 'lock'; }
    else if (modo === 'resuelta'){ txt = `Tu aforo (${mio}): ${reg.asis_prof_aut === 'autorizado' ? 'autorizado ✔' : 'se mantuvo el número oficial'}`; cls = 'lock'; }
    else if (modo === 'temprano'){ txt = `🕒 Se podrá capturar a las ${esc(slot.hora)}, cuando comience`; cls = 'off'; }
    else if (modo === 'futura')  { txt = 'Se captura el día de la clase'; cls = 'off'; }
    else if (modo === 'pasada' && !reg) { txt = 'Sin captura · el plazo era el día de la clase'; cls = 'off'; }
    const nota = reg && reg.asis_prof_nota ? `<div class="cp-hint-nota">Tu nota: ${esc(reg.asis_prof_nota)}</div>` : '';
    return (txt ? `<div class="cp-hint ${cls}">${txt}</div>` : '') + nota;
  };

  // ═════════════════════════════════════════════════════════════════
  // TARJETA DE CAPTURA (profesor)
  // ═════════════════════════════════════════════════════════════════
  const S = { inst: null, slot: null, fecha: '', capN: 20, modo: '', touched: false, guardando: false };

  function crearSheet() {
    if ($('cp-sheet')) return;
    const el = document.createElement('div');
    el.id = 'cp-sheet';
    el.className = 'cp-ov';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cp-titulo');
    el.innerHTML = `
      <div class="cp-card" tabindex="-1">
        <div class="cp-head">
          <div style="min-width:0">
            <div class="cp-clase" id="cp-titulo"></div>
            <div class="cp-meta" id="cp-meta"></div>
          </div>
          <button type="button" class="cp-x" id="cp-cerrar" aria-label="Cerrar">✕</button>
        </div>
        <div id="cp-aviso"></div>
        <div id="cp-form">
          <div class="cp-lbl" id="cp-lbl-num">¿Cuántas personas tuviste?</div>
          <div class="cp-stepper">
            <button type="button" class="cp-step" id="cp-menos" aria-label="Una persona menos">−</button>
            <input id="cp-num" class="cp-num" type="text" inputmode="numeric" pattern="[0-9]*"
                   autocomplete="off" maxlength="3" aria-label="Número de personas" placeholder="0">
            <button type="button" class="cp-step" id="cp-mas" aria-label="Una persona más">+</button>
          </div>
          <div class="cp-cap" id="cp-cap"></div>
          <label class="cp-lbl" for="cp-nota">Notas (opcional)</label>
          <textarea id="cp-nota" class="cp-nota" rows="3" maxlength="300"
                    placeholder="Ej. llovió, evento en la alberca…"></textarea>
          <button type="button" class="cp-guardar" id="cp-guardar">Guardar</button>
        </div>
        <div id="cp-solo"></div>
      </div>`;
    ($('instructor-screen') || document.body).appendChild(el);

    $('cp-cerrar').addEventListener('click', cerrar);
    el.addEventListener('click', e => { if (e.target === el) cerrar(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
    $('cp-guardar').addEventListener('click', guardar);
    const inp = $('cp-num');
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 3);
      S.touched = true;
      pintarCap();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    inp.addEventListener('focus', () => { try { inp.select(); } catch (e) {} });
    bindStep($('cp-menos'), -1);
    bindStep($('cp-mas'), +1);
  }

  // + / − con toque simple o manteniendo presionado
  function bindStep(btn, delta) {
    let t1 = null, t2 = null;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    const go = () => cambiar(delta);
    btn.addEventListener('pointerdown', e => {
      if (btn.disabled) return;
      e.preventDefault();
      go();
      t1 = setTimeout(() => { t2 = setInterval(go, 90); }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }

  function leerNum() {
    const v = parseInt($('cp-num').value, 10);
    return isNaN(v) ? null : Math.max(0, Math.min(MAX_PERSONAS, v));
  }
  function cambiar(delta) {
    const n = Math.max(0, Math.min(MAX_PERSONAS, (leerNum() || 0) + delta));
    $('cp-num').value = String(n);
    S.touched = true;
    pintarCap();
  }
  function pintarCap() {
    const el = $('cp-cap');
    const n = leerNum();
    const cap = parseInt(S.capN, 10) || 0;
    if (n === null || cap <= 0) { el.textContent = cap > 0 ? `Capacidad del salón: ${cap}` : ''; el.style.color = ''; return; }
    const p = Math.round(n / cap * 100);
    el.textContent = `${p}% de aforo · capacidad ${cap}${n > cap ? ' · supera la capacidad' : ''}`;
    el.style.color = n > cap ? 'var(--gold2)' : 'var(--txt3)';
  }
  const bloqueAviso = (tipo, html) => `<div class="cp-aviso ${tipo}">${html}</div>`;

  window.instCapAbrir = function (idx) {
    const ctx = window._instHoyCtx;
    if (!ctx || !ctx.items || !ctx.items[idx]) return;
    const inst = instructores.find(i => i.id === instActualId);
    if (!inst) return;
    crearSheet();

    const slot = ctx.items[idx].slot;
    const reg = regDe(inst, slot, ctx.fecha);                    // estado vigente, no el del render
    const capN = (reg && parseInt(reg.cap, 10) > 0) ? parseInt(reg.cap, 10) : (getCapClase(slot.clase) || 20);
    Object.assign(S, { inst, slot, fecha: ctx.fecha, capN, touched: false, guardando: false,
                       modo: estadoCaptura(reg, ctx.fecha, hoyStr(), slot) });
    pintarSheet(reg);
    $('cp-sheet').hidden = false;
    const card = $('cp-sheet').querySelector('.cp-card');
    if (card) { card.scrollTop = 0; card.focus({ preventScroll: true }); }
  };

  function pintarSheet(reg) {
    $('cp-titulo').textContent = S.slot.clase;
    $('cp-meta').textContent = `${S.slot.hora} · ${fechaLarga(S.fecha)}`;
    const form = $('cp-form'), solo = $('cp-solo'), av = $('cp-aviso');
    const oficial = reg ? (parseInt(reg.asistentes, 10) || 0) : 0;
    const mio = reg && hayNum(reg.asis_prof) ? parseInt(reg.asis_prof, 10) : null;
    const editable = ['nueva', 'propia', 'aforo'].includes(S.modo);

    form.style.display = editable ? '' : 'none';
    solo.style.display = editable ? 'none' : '';

    if (editable) {
      let valor = 0, nota = reg && reg.asis_prof_nota ? reg.asis_prof_nota : '';
      $('cp-lbl-num').textContent = S.modo === 'aforo' ? 'Tu conteo de la clase' : '¿Cuántas personas tuviste?';
      $('cp-guardar').textContent = S.modo === 'aforo' ? 'Guardar mi aforo' : (S.modo === 'propia' ? 'Guardar cambios' : 'Guardar');
      if (S.modo === 'propia') {
        valor = oficial;
        av.innerHTML = bloqueAviso('ok', 'Ya capturaste esta clase. Puedes corregirla hoy.');
      } else if (S.modo === 'aforo') {
        valor = mio !== null ? mio : oficial;
        av.innerHTML = mio !== null
          ? bloqueAviso('info', `Coordinación registró <b>${oficial}</b> persona${oficial === 1 ? '' : 's'} (número oficial). Tu aforo ya está en revisión; puedes cambiarlo mientras no lo revisen.`)
          : bloqueAviso('info', `Coordinación ya registró esta clase con <b>${oficial}</b> persona${oficial === 1 ? '' : 's'}, por eso el número oficial está bloqueado. Si tú contaste distinto, anótalo aquí y coordinación lo revisará.`);
      } else {
        av.innerHTML = '';
      }
      $('cp-num').value = String(valor);
      $('cp-nota').value = nota;
      $('cp-guardar').disabled = false;
      pintarCap();
    } else {
      let msg = '';
      if (S.modo === 'temprano') msg = bloqueAviso('info', `Aún no comienza esta clase. Podrás capturarla a partir de las <b>${esc(S.slot.hora)}</b>.`);
      else if (S.modo === 'futura') msg = bloqueAviso('info', 'Esta clase se captura el día en que se imparte.');
      else if (S.modo === 'pasada') msg = bloqueAviso('info', 'El plazo para capturar esta clase era el mismo día. Ya no se puede modificar.');
      else if (S.modo === 'estado') msg = bloqueAviso('info', `Coordinación marcó esta clase como <b>${reg.estado === 'falta' ? 'falta' : 'suplencia'}</b>; no lleva captura de alumnos.`);
      else if (S.modo === 'resuelta') msg = bloqueAviso(reg.asis_prof_aut === 'autorizado' ? 'ok' : 'info',
        reg.asis_prof_aut === 'autorizado' ? 'Coordinación autorizó tu aforo.' : 'Coordinación revisó tu aforo y se mantuvo el número oficial.');
      av.innerHTML = '';
      let det = '';
      if (reg) {
        det += `<div class="cp-fila"><span>Número oficial</span><b>${oficial}</b></div>`;
        if (mio !== null) det += `<div class="cp-fila"><span>Tu aforo</span><b>${mio}</b></div>`;
        if (reg.asis_prof_nota) det += `<div class="cp-nota-ro">${esc(reg.asis_prof_nota)}</div>`;
      }
      solo.innerHTML = msg + det;
    }
  }

  function cerrar() { const s = $('cp-sheet'); if (s) s.hidden = true; }

  // ── Guardar ──────────────────────────────────────────────────────
  function nuevoId() {
    // Único por construcción (hora del servidor + azar): varios profesores terminan
    // clase a la misma hora y cada teléfono calcularía el mismo "máximo + 1".
    let id;
    do { id = Math.floor(ahora()) * 1000 + Math.floor(Math.random() * 1000); }
    while (registros.some(r => String(r.id) === String(id)));
    return id;
  }

  // Escribe en Firebase solo ese registro. Si el registro ya existe en la nube se le
  // fusionan únicamente los campos nuevos (no pisa lo que coordinación haya cambiado).
  function persistir(rec, campos) {
    try { if (typeof guardarLocal === 'function') guardarLocal(); } catch (e) {}
    if (typeof fbDb === 'undefined' || !fbDb) {
      try { if (typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 800); } catch (e) {}
      return Promise.resolve('local');
    }
    const ref = fbDb.ref('fitness/registros/' + rec.id);
    const op = campos
      ? ref.transaction(cur => cur ? Object.assign({}, cur, campos) : rec)
      : ref.set(rec);
    const limite = new Promise(res => setTimeout(() => res('local'), 7000));   // sin conexión
    return Promise.race([Promise.resolve(op).then(() => 'nube'), limite]).catch(e => {
      console.warn('[Captura] Firebase:', e);
      try { if (typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 800); } catch (x) {}
      return 'local';
    });
  }

  async function guardar() {
    if (S.guardando) return;
    const n = leerNum();
    if (n === null) { aviso('Escribe cuántas personas tuviste', 'warn'); $('cp-num').focus(); return; }

    // 1) Plazo: solo el día de la clase (hora del servidor)
    const hoy = hoyStr();
    if (S.fecha !== hoy) {
      aviso('El plazo para capturar esta clase terminó (era solo el día de la clase).', 'err');
      cerrar(); if (typeof instRenderHoy === 'function') instRenderHoy();
      return;
    }

    // 2) Estado vigente: coordinación pudo capturar mientras la tarjeta estaba abierta
    const inst = instructores.find(i => i.id === instActualId);
    if (!inst) return;
    const reg = regDe(inst, S.slot, S.fecha);
    const modo = estadoCaptura(reg, S.fecha, hoy, S.slot);
    if (modo === 'temprano') {
      aviso(`Esta clase aún no comienza. Podrás capturarla a las ${S.slot.hora}.`, 'warn');
      cerrar(); if (typeof instRenderHoy === 'function') instRenderHoy();
      return;
    }
    if (modo === 'estado' || modo === 'resuelta') {
      aviso(modo === 'estado' ? 'Coordinación marcó esta clase como falta/suplencia.' : 'Coordinación ya revisó tu aforo.', 'warn');
      cerrar(); if (typeof instRenderHoy === 'function') instRenderHoy();
      return;
    }
    if (modo !== S.modo && S.modo === 'nueva' && modo === 'aforo') {
      aviso('Coordinación acaba de registrar esta clase; tu número se guardará como tu aforo para revisión.', 'info');
    }

    // 3) Confirmaciones por números raros
    if (n === 0 && !S.touched && !confirm('¿Guardar la clase con 0 personas?')) return;
    const cap = parseInt(S.capN, 10) || 0;
    if (cap > 0 && n > cap * 1.5 && !confirm(`${n} personas supera el 150% de la capacidad (${cap}). ¿Es correcto?`)) return;

    S.guardando = true;
    const btn = $('cp-guardar'); btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const nota = ($('cp-nota').value || '').trim().slice(0, 300);
      const t = Math.floor(ahora());
      let rec, campos = null;

      if (modo === 'nueva') {
        rec = {
          id: nuevoId(), inst_id: inst.id, dia: S.slot.dia, clase: S.slot.clase, hora: S.slot.hora,
          asistentes: n, cap: cap || 20, dur: 60, estado: 'ok', fecha: S.fecha, tipo: 'clase',
          suplente_id: null, suplente_nombre: null, motivo_suplencia: null,
          captura_por: 'inst', asis_prof: n, asis_prof_nota: nota, asis_prof_ts: t, updatedAt: t
        };
        registros.push(rec);
      } else if (modo === 'propia') {
        campos = { asistentes: n, asis_prof: n, asis_prof_nota: nota, asis_prof_ts: t, updatedAt: t };
        Object.assign(reg, campos); rec = reg;
      } else {                                              // 'aforo': solo el campo del profesor
        campos = { asis_prof: n, asis_prof_nota: nota, asis_prof_ts: t, updatedAt: t };
        Object.assign(reg, campos); rec = reg;
      }

      const destino = await persistir(rec, campos);
      cerrar();
      if (typeof instRenderHoy === 'function') instRenderHoy();
      const texto = modo === 'aforo' ? 'Tu aforo quedó anotado para revisión de coordinación.' : 'Clase guardada.';
      aviso(destino === 'nube' ? texto : 'Guardado en tu teléfono; se enviará al volver la conexión.', destino === 'nube' ? 'ok' : 'warn');
    } catch (e) {
      console.error('[Captura] Error al guardar', e);
      aviso('No se pudo guardar. Intenta de nuevo.', 'err');
      btn.disabled = false;
      btn.textContent = S.modo === 'aforo' ? 'Guardar mi aforo' : 'Guardar';
    } finally {
      S.guardando = false;
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // OBSERVACIONES DE AFORO (coordinador · vista del celular)
  // ═════════════════════════════════════════════════════════════════
  let _obsAbierto = false;

  function obsPendientes() {
    const desde = restarDias(hoyStr(), DIAS_OBS);
    return registros.filter(r =>
      hayNum(r.asis_prof) && r.captura_por !== 'inst' && !r.asis_prof_aut &&
      (r.estado === 'ok' || r.estado === 'sub') &&
      parseInt(r.asis_prof, 10) !== (parseInt(r.asistentes, 10) || 0) &&
      (r.fecha || '') >= desde
    ).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''));
  }

  function obsRender() {
    const box = $('mob-obs-prof');
    if (!box) return;
    if (typeof rolActual === 'undefined' || rolActual !== 'admin') { box.innerHTML = ''; return; }
    const lista = obsPendientes();
    if (!lista.length) { box.innerHTML = ''; return; }

    const filas = lista.map(r => {
      const inst = instructores.find(i => String(i.id) === String(r.inst_id));
      const tu = parseInt(r.asistentes, 10) || 0, el = parseInt(r.asis_prof, 10) || 0, dif = el - tu;
      return `<div class="op-row">
        <div class="op-top"><b>${esc(r.clase)}</b> · ${esc(r.hora)} · ${esc(fechaLarga(r.fecha, true))}</div>
        <div class="op-prof">${esc(inst ? inst.nombre : 'Profesor')}</div>
        <div class="op-nums">
          <span>Tu conteo <b>${tu}</b></span><span class="op-arr">→</span>
          <span>Profe <b>${el}</b> <i>(${dif > 0 ? '+' : ''}${dif})</i></span>
        </div>
        ${r.asis_prof_nota ? `<div class="op-nota">“${esc(r.asis_prof_nota)}”</div>` : ''}
        <div class="op-btns">
          <button type="button" class="op-no" onclick="obsProfResolver(${Number(r.id)},'descartado')">Dejar mi número</button>
          <button type="button" class="op-si" onclick="obsProfResolver(${Number(r.id)},'autorizado')">Autorizar ${el}</button>
        </div>
      </div>`;
    }).join('');

    box.innerHTML = `<div class="op-wrap">
      <button type="button" class="op-head" onclick="obsProfToggle()" aria-expanded="${_obsAbierto}">
        <span class="op-t">Aforo del profe distinto al tuyo</span>
        <span class="op-n">${lista.length}</span>
        <span class="op-chev">${_obsAbierto ? '▴' : '▾'}</span>
      </button>
      <div class="op-body" ${_obsAbierto ? '' : 'hidden'}>${filas}</div>
    </div>`;
  }

  window.obsProfToggle = function () { _obsAbierto = !_obsAbierto; obsRender(); };

  window.obsProfResolver = function (id, decision) {
    if (typeof rolActual === 'undefined' || rolActual !== 'admin') return;
    const r = registros.find(x => String(x.id) === String(id));
    if (!r || r.asis_prof_aut) { obsRender(); return; }
    const el = parseInt(r.asis_prof, 10) || 0, tu = parseInt(r.asistentes, 10) || 0;
    if (decision === 'autorizado') {
      if (!confirm(`¿Autorizar ${el} personas en ${r.clase} (${r.hora})?\nTu número (${tu}) será reemplazado.`)) return;
      r.asis_coord_prev = tu;
      r.asistentes = el;
      r.captura_por = 'coord';
    }
    r.asis_prof_aut = decision;
    r.updatedAt = Math.floor(ahora());
    renderAll();                                           // guarda y sincroniza como cualquier edición
    try { registrarLog('clase', `Aforo del profe ${decision === 'autorizado' ? 'autorizado' : 'descartado'} · ${r.clase} · ${r.fecha} ${r.hora} · profe ${el} / coord ${tu}`); } catch (e) {}
    aviso(decision === 'autorizado' ? `Autorizado: ahora son ${el} personas.` : `Se mantiene tu número (${tu}).`, 'ok');
  };

  // La tarjeta se refresca cuando llegan datos nuevos o se abre la pantalla "Hoy"
  const _renderAllPrev = window.renderAll;
  if (typeof _renderAllPrev === 'function') {
    window.renderAll = function () { const r = _renderAllPrev.apply(this, arguments); try { obsRender(); } catch (e) {} return r; };
  }
  const _mobHomePrev = window.renderMobileHome;
  if (typeof _mobHomePrev === 'function') {
    window.renderMobileHome = function () { const r = _mobHomePrev.apply(this, arguments); try { obsRender(); } catch (e) {} return r; };
  }

  // ── Estilos ──────────────────────────────────────────────────────
  const st = document.createElement('style');
  st.id = 'cp-style';
  st.textContent = `
.inst-cap-card{cursor:pointer;-webkit-tap-highlight-color:transparent}
.inst-cap-card:active{transform:scale(.99)}
.cp-hint{margin-top:7px;font-size:.68rem;font-weight:700;border-radius:8px;padding:5px 9px;display:inline-block;background:var(--panel2);color:var(--txt2)}
.cp-hint.go{color:var(--neon);border:1px dashed rgba(94,255,160,.45)}
.cp-hint.ok{color:var(--neon)}
.cp-hint.rev{color:var(--gold2)}
.cp-hint.lock,.cp-hint.off{color:var(--txt3);font-weight:600}
.cp-hint-nota{margin-top:4px;font-size:.65rem;color:var(--txt3);font-style:italic}
.cp-ov{position:absolute;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.cp-ov[hidden]{display:none}
.cp-card{width:100%;max-width:480px;max-height:92vh;overflow-y:auto;outline:none;box-sizing:border-box;background:var(--panel);color:var(--txt);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:1rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.45);font-family:'Outfit',sans-serif}
@media(min-width:560px){.cp-ov{align-items:center}.cp-card{border-radius:20px}}
.cp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem;margin-bottom:.9rem}
.cp-clase{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;letter-spacing:2px;line-height:1.05;color:var(--neon)}
.cp-meta{font-size:.74rem;color:var(--txt2);margin-top:3px;text-transform:capitalize}
.cp-x{flex-shrink:0;width:38px;height:38px;border-radius:50%;border:1px solid var(--border);background:var(--panel2);color:var(--txt2);font-size:1rem;cursor:pointer}
.cp-aviso{font-size:.76rem;line-height:1.4;border-radius:10px;padding:.65rem .8rem;margin-bottom:.9rem;background:var(--panel2);border:1px solid var(--border);color:var(--txt2)}
.cp-aviso.info{border-color:rgba(77,184,232,.35);background:rgba(77,184,232,.07)}
.cp-aviso.ok{border-color:rgba(94,255,160,.3);background:rgba(94,255,160,.07)}
.cp-aviso b{color:var(--txt)}
.cp-lbl{display:block;font-size:.62rem;text-transform:uppercase;letter-spacing:1.4px;color:var(--txt3);margin:.2rem 0 .5rem}
.cp-stepper{display:flex;align-items:center;gap:.7rem}
.cp-step{flex:0 0 68px;height:68px;border-radius:18px;border:1px solid var(--border);background:var(--panel2);color:var(--neon);font-size:2.1rem;font-weight:300;line-height:1;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.cp-step:active{background:rgba(94,255,160,.14)}
.cp-num{flex:1;min-width:0;height:68px;text-align:center;box-sizing:border-box;font-family:'Bebas Neue',sans-serif;font-size:3.1rem;letter-spacing:2px;color:var(--txt);background:var(--panel2);border:1.5px solid var(--border);border-radius:18px;outline:none}
.cp-num:focus{border-color:var(--neon)}
.cp-cap{min-height:1.1em;text-align:center;font-size:.7rem;color:var(--txt3);margin:.55rem 0 1rem}
.cp-nota{width:100%;box-sizing:border-box;resize:none;font:inherit;font-size:16px;color:var(--txt);background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.65rem .75rem;outline:none;margin-bottom:1rem}
.cp-nota:focus{border-color:var(--neon)}
.cp-guardar{width:100%;border:none;border-radius:14px;padding:15px;font:700 1rem 'Outfit',sans-serif;letter-spacing:.4px;color:#fff;background:linear-gradient(135deg,var(--v2),var(--v3));box-shadow:0 4px 14px rgba(94,255,160,.18);cursor:pointer}
.cp-guardar:disabled{opacity:.6;cursor:default}
.cp-fila{display:flex;justify-content:space-between;align-items:baseline;padding:.6rem 0;border-bottom:1px solid var(--border);font-size:.84rem;color:var(--txt2)}
.cp-fila b{font-family:'Bebas Neue',sans-serif;font-size:1.5rem;color:var(--txt)}
.cp-nota-ro{margin-top:.7rem;font-size:.78rem;color:var(--txt2);font-style:italic}
.op-wrap{margin:10px 0 4px;border:1px solid rgba(232,184,75,.5);background:rgba(232,184,75,.09);border-radius:14px;overflow:hidden}
.op-head{display:flex;align-items:center;gap:.6rem;width:100%;box-sizing:border-box;padding:.7rem .85rem;border:0;background:none;color:var(--txt);font:700 .8rem 'Outfit',sans-serif;text-align:left;cursor:pointer}
.op-t{flex:1}
.op-n{min-width:22px;height:22px;border-radius:11px;background:var(--gold2);color:#1a1300;font-size:.72rem;display:flex;align-items:center;justify-content:center;padding:0 6px}
.op-chev{color:var(--txt3)}
.op-body{padding:0 .85rem .7rem}
.op-body[hidden]{display:none}
.op-row{border-top:1px solid var(--border);padding:.7rem 0}
.op-top{font-size:.82rem;color:var(--txt)}
.op-prof{font-size:.7rem;color:var(--txt3);margin-top:1px}
.op-nums{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.45rem;font-size:.8rem;color:var(--txt2)}
.op-nums b{font-size:1rem;color:var(--txt)}
.op-nums i{font-style:normal;color:var(--gold2);font-weight:700}
.op-arr{color:var(--txt3)}
.op-nota{margin-top:.4rem;font-size:.74rem;color:var(--txt2);font-style:italic}
.op-btns{display:flex;gap:.5rem;margin-top:.6rem}
.op-btns button{flex:1;border-radius:10px;padding:10px 8px;font:700 .76rem 'Outfit',sans-serif;cursor:pointer}
.op-no{background:none;border:1px solid var(--border);color:var(--txt2)}
.op-si{background:var(--gold2);border:1px solid var(--gold2);color:#1a1300}
#mob-obs-prof:empty{display:none}
@media (prefers-reduced-motion:reduce){.inst-cap-card:active{transform:none}}
`;
  document.head.appendChild(st);
})();
