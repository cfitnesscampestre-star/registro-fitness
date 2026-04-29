// ═══ SISTEMA DE FIRMAS DIGITALES ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
const _FD = {
  profesores:   [],   // lista construida de los registros del periodo
  profActivo:   null, // índice en _FD.profesores
  firmas:       {},   // { profId: dataURL }
  semana:       '',
  fechaIni:     '',
  fechaFin:     '',
  canvas:       null,
  ctx:          null,
  dibujando:    false,
  lastX:        0,
  lastY:        0,
  puntosActual: 0,    // para detectar si el canvas tiene algo
  coordNombre:  '',   // nombre del coordinador que firma la hoja
};

// ── Helpers ──────────────────────────────────────────────────────────
function _fdInits(nombre) {
  if(!nombre) return '??';
  const p = nombre.trim().split(' ');
  return ((p[0]||'?')[0] + ((p[1]||'')[0]||'')).toUpperCase();
}
function _fdColor(id) {
  const C = ['#E85D04','#7209B7','#0077B6','#2D6A4F','#C1121F',
             '#F59E0B','#0891B2','#BE185D','#15803D','#9333EA'];
  return C[((parseInt(id)||1)-1) % C.length];
}

// ── Abrir el modal ────────────────────────────────────────────────────
function abrirFirmasDigitales(modo) {
  // ── Si viene desde "Continuar hoja activa", saltar toda verificación ──────────
  if(modo === 'continuar') {
    // Precargar fechas desde la hoja activa y abrir directo
    try {
      const hojaC = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
      if(hojaC) {
        const elI = document.getElementById('firmas-fecha-ini');
        const elF = document.getElementById('firmas-fecha-fin');
        const elT = document.getElementById('firmas-semana-txt');
        if(elI) elI.value = hojaC.semIni || '';
        if(elF) elF.value = hojaC.semFin || '';
        if(elT && hojaC.encabezado) elT.value = hojaC.encabezado;
        if(typeof firmasActualizarLabel === 'function') firmasActualizarLabel();
      }
    } catch(e) {}
    // Saltar toda la verificación — ir directo a cargar y abrir
    _abrirModalFirmasDirecto();
    return;
  }

  // ── Verificar si hay hoja activa ANTES de abrir ──────────────────────────────
  // El bloqueo se basa en el ESTADO de la hoja, no en las fechas seleccionadas.
  // Reglas:
  //   1. Hoja activa con firmas INCOMPLETAS → BLOQUEAR siempre
  //   2. Hoja activa con todas las firmas completas → confirmar cierre
  //   3. Hoja activa sin ninguna firma → reemplazar silenciosamente
  //   4. Sin hoja activa → continuar normalmente
  try {
    const hojaActiva = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(hojaActiva) {
      const firmasObj = hojaActiva.firmas || {};
      const firmados  = Object.values(firmasObj).filter(f => f && f.data).length;
      const semTxt    = hojaActiva.encabezado || `${hojaActiva.semIni} → ${hojaActiva.semFin}`;

      // Total = coordinador + instructores con horario
      const totalInst = typeof instructores !== 'undefined'
        ? instructores.filter(i => (i.horario||[]).length > 0).length
        : Math.max(0, firmados - 1);
      const totalConCoord = totalInst + 1; // +1 por el coordinador
      const pendientes = Math.max(0, totalConCoord - firmados);

      if(firmados > 0 && pendientes > 0) {
        // ── Si viene desde "Continuar", abrir directo sin bloquear ──
        if(modo === 'continuar') { /* caer al flujo normal */ } else {
        // ── BLOQUEO TOTAL: hoja activa con firmas incompletas ──
        showToast(
          `🔒 Hay una hoja activa con ${firmados}/${totalConCoord} firmas. Complétala primero.`,
          'warn'
        );
        alert(
          `🔒 NO SE PUEDE ABRIR UNA NUEVA HOJA\n\n` +
          `Semana activa: ${semTxt}\n` +
          `Firmas recibidas: ${firmados} de ${totalConCoord} (faltan ${pendientes})\n\n` +
          `Para continuar tienes dos opciones:\n` +
          `  1. Espera a que los ${pendientes} instructor(es) restante(s) firmen.\n` +
          `  2. Ve a "Cerrar hoja y generar nueva" para descartarla.\n\n` +
          `⚠ Si cierras perderás las ${firmados} firma(s) ya guardadas.`
        );
        return; // BLOQUEO — no seguir
        } // fin else modo
      } else if(firmados > 0 && pendientes === 0) {
        // ── Todas firmadas — confirmar cierre ──
        const ok = confirm(
          `✔ La hoja "${semTxt}" está COMPLETAMENTE firmada (${firmados}/${totalConCoord}).\n\n` +
          `¿Generar PDF y abrir una hoja nueva?`
        );
        if(!ok) return;
        localStorage.removeItem('fc_hoja_firmas_activa');
        if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
      } else {
        // ── Sin firmas — reemplazar sin aviso (solo si no es modo continuar) ──
        if(modo !== 'continuar') {
          localStorage.removeItem('fc_hoja_firmas_activa');
          if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
        }
      }
    } else {
      // ── Sin hoja activa — pedir confirmación antes de crear una nueva ──
      const _elI = document.getElementById('firmas-fecha-ini');
      const _elF = document.getElementById('firmas-fecha-fin');
      const _lun = new Date(lunesBase);
      const _dom = new Date(_lun); _dom.setDate(_lun.getDate()+6);
      const _iso = d => fechaLocalStr(d);
      const _ini = (_elI && _elI.value) ? _elI.value : _iso(_lun);
      const _fin = (_elF && _elF.value) ? _elF.value : _iso(_dom);
      const _fmt = s => new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
      const _ok = confirm(
        `¿Crear una nueva hoja de firmas digitales?\n\n` +
        `Periodo: ${_fmt(_ini)} al ${_fmt(_fin)}\n\n` +
        `Al confirmar se publicará la hoja para que los instructores puedan firmar desde su portal.`
      );
      if(!_ok) return;
    }
  } catch(e){}

  const elI = document.getElementById('firmas-fecha-ini');
  const elF = document.getElementById('firmas-fecha-fin');
  const elT = document.getElementById('firmas-semana-txt');

  const lun = new Date(lunesBase);
  const dom = new Date(lun); dom.setDate(lun.getDate()+6);
  const iso = d => fechaLocalStr(d);
  _FD.fechaIni = (elI && elI.value) ? elI.value : iso(lun);
  _FD.fechaFin = (elF && elF.value) ? elF.value : iso(dom);

  const fmt2 = s => new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long'});
  _FD.semana = (elT && elT.value.trim())
    ? elT.value.trim()
    : `${fmt2(_FD.fechaIni)} al ${fmt2(_FD.fechaFin)} ${_FD.fechaIni.slice(0,4)}`;

  // Construir lista de profesores del periodo (igual que generarHojaFirmasPDF)
  const regs = registros.filter(r => r.fecha >= _FD.fechaIni && r.fecha <= _FD.fechaFin);
  if(!regs.length) {
    showToast('Sin registros en ese periodo', 'warn');
    return;
  }

  const DIAS_ORD = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const porInst  = {};
  regs.forEach(r => {
    const inst = instructores.find(i => String(i.id) === String(r.inst_id));
    if(!inst) return;
    if(!porInst[inst.id]) porInst[inst.id] = { inst, clases: [] };
    const h = r.hora || '';
    let horaFmt = h, horaMin = 0;
    if(h && !h.includes('a.') && !h.includes('p.')) {
      const [hh, mm] = h.split(':').map(Number);
      if(!isNaN(hh)) {
        const s = hh >= 12 ? 'p. m.' : 'a. m.';
        const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        horaFmt = `${h12}:${String(mm||0).padStart(2,'0')} ${s}`;
        horaMin = hh * 60 + (mm || 0);
      }
    }
    porInst[inst.id].clases.push({
      dia: r.dia || '', hora: horaFmt, horaMin,
      clase: (r.clase || '').toUpperCase(),
      alumnos: r.asistentes !== undefined ? parseInt(r.asistentes) : null,
      estado: r.estado || 'ok'
    });
  });

  // Recuperar nombre del coordinador guardado
  _FD.coordNombre = localStorage.getItem('fc_coord_nombre') || 'Coordinador';

  // Entrada especial del COORDINADOR — siempre primera en la lista
  const entradaCoord = {
    id: 'coord',
    esCoord: true,
    inst: { id: 'coord', nombre: _FD.coordNombre },
    clases: []
  };

  _FD.profesores = [entradaCoord, ...Object.values(porInst)
    .sort((a,b) => a.inst.nombre.localeCompare(b.inst.nombre))
    .map(p => {
      const mapa = {};
      p.clases.forEach(c => {
        const k = `${c.dia}|${c.hora}|${c.clase}`;
        const pri = {falta:2,sub:1,ok:0}[c.estado]||0;
        if(!mapa[k] || pri > ({falta:2,sub:1,ok:0}[mapa[k].estado]||0)) mapa[k] = c;
      });
      const clases = Object.values(mapa).sort((a,b) => {
        const di = DIAS_ORD.indexOf(a.dia) - DIAS_ORD.indexOf(b.dia);
        return di !== 0 ? di : (a.horaMin||0) - (b.horaMin||0);
      });
      return { inst: p.inst, clases, id: p.inst.id };
    })
    .filter(p => p.clases.length > 0)];

  _FD.profActivo = null;
  _FD.firmas = {};  // limpiar para cargar frescas del storage

  // Cargar firmas guardadas del periodo
  _fdCargarFirmasGuardadas();

  // ── Publicar hoja para que instructores puedan firmar desde su portal ──
  instPublicarHojaFirmas(_FD.fechaIni, _FD.fechaFin, _FD.semana);

  // Abrir modal
  document.getElementById('m-firmas-digitales').classList.add('on');

  // Inicializar canvas
  setTimeout(() => {
    _fdInicializarCanvas();
    _fdRenderLista();
    _fdActualizarProgreso();
    document.getElementById('fd-semana-lbl').textContent = _FD.semana;
  }, 60);
}

// ── Abrir modal de firmas directo (sin verificaciones) — usado por modo continuar ──
function _abrirModalFirmasDirecto() {
  const elI = document.getElementById('firmas-fecha-ini');
  const elF = document.getElementById('firmas-fecha-fin');
  const elT = document.getElementById('firmas-semana-txt');

  const lun = new Date(lunesBase);
  const dom = new Date(lun); dom.setDate(lun.getDate()+6);
  const iso = d => fechaLocalStr(d);
  _FD.fechaIni = (elI && elI.value) ? elI.value : iso(lun);
  _FD.fechaFin = (elF && elF.value) ? elF.value : iso(dom);

  const fmt2 = s => new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long'});
  _FD.semana = (elT && elT.value.trim())
    ? elT.value.trim()
    : `${fmt2(_FD.fechaIni)} al ${fmt2(_FD.fechaFin)} ${_FD.fechaIni.slice(0,4)}`;

  const regs = registros.filter(r => r.fecha >= _FD.fechaIni && r.fecha <= _FD.fechaFin);
  if(!regs.length) { showToast('Sin registros en ese periodo', 'warn'); return; }

  const DIAS_ORD = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const porInst  = {};
  regs.forEach(r => {
    const inst = instructores.find(i => String(i.id) === String(r.inst_id));
    if(!inst) return;
    if(!porInst[inst.id]) porInst[inst.id] = { inst, clases: [] };
    const h = r.hora || '';
    let horaFmt = h, horaMin = 0;
    if(h && !h.includes('a.') && !h.includes('p.')) {
      const [hh, mm] = h.split(':').map(Number);
      if(!isNaN(hh)) {
        const s = hh >= 12 ? 'p. m.' : 'a. m.';
        const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        horaFmt = `${h12}:${String(mm||0).padStart(2,'0')} ${s}`;
        horaMin = hh * 60 + (mm || 0);
      }
    }
    porInst[inst.id].clases.push({
      dia: r.dia || '', hora: horaFmt, horaMin,
      clase: (r.clase || '').toUpperCase(),
      alumnos: r.asistentes !== undefined ? parseInt(r.asistentes) : null,
      estado: r.estado || 'ok'
    });
  });

  _FD.coordNombre = localStorage.getItem('fc_coord_nombre') || 'Coordinador';
  const entradaCoord = { id:'coord', esCoord:true, inst:{ id:'coord', nombre:_FD.coordNombre }, clases:[] };

  _FD.profesores = [entradaCoord, ...Object.values(porInst)
    .sort((a,b) => a.inst.nombre.localeCompare(b.inst.nombre))
    .map(p => {
      const mapa = {};
      p.clases.forEach(c => {
        const k = `${c.dia}|${c.hora}|${c.clase}`;
        const pri = {falta:2,sub:1,ok:0}[c.estado]||0;
        if(!mapa[k] || pri > ({falta:2,sub:1,ok:0}[mapa[k].estado]||0)) mapa[k] = c;
      });
      const clases = Object.values(mapa).sort((a,b) => {
        const di = DIAS_ORD.indexOf(a.dia) - DIAS_ORD.indexOf(b.dia);
        return di !== 0 ? di : (a.horaMin||0) - (b.horaMin||0);
      });
      return { inst: p.inst, clases, id: p.inst.id };
    })
    .filter(p => p.clases.length > 0)];

  _FD.profActivo = null;
  _FD.firmas = {};
  _fdCargarFirmasGuardadas();
  // No publicar hoja nueva — solo abrir la existente
  document.getElementById('m-firmas-digitales').classList.add('on');
  setTimeout(() => {
    _fdInicializarCanvas();
    _fdRenderLista();
    _fdActualizarProgreso();
    document.getElementById('fd-semana-lbl').textContent = _FD.semana;
  }, 60);
}


// ── Canvas: inicializar y eventos ─────────────────────────────────────
function _fdInicializarCanvas() {
  const canvas = document.getElementById('fd-canvas');
  if(!canvas) return;
  _FD.canvas = canvas;
  _FD.ctx    = canvas.getContext('2d');

  // Canvas con proporciones de firma reales (3:1 aspect ratio)
  // El canvas interno siempre es 600×200 para consistencia al exportar
  const CANVAS_W = 600;
  const CANVAS_H = 200;
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  // Mostrar en pantalla ajustado al espacio disponible pero manteniendo 3:1
  // En móvil (<= 640px) no hay sidebar lateral, el canvas ocupa el ancho completo
  const isMobile = window.innerWidth <= 640;
  const sidebarW = isMobile ? 32 : 260; // móvil: solo padding; escritorio: sidebar 220px + gaps
  const dispW = Math.min(window.innerWidth - sidebarW, 680);
  const dispH = Math.round(dispW * (CANVAS_H / CANVAS_W));
  canvas.style.width  = dispW + 'px';
  canvas.style.height = dispH + 'px';
  _FD._canvasAspect = CANVAS_W / CANVAS_H;

  _fdLimpiarCanvas();

  // ── Eventos touch (stylus + dedo) ──
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    _FD.dibujando  = true;
    _FD.lastX = (t.clientX - r.left) * (canvas.width  / r.width);
    _FD.lastY = (t.clientY - r.top)  * (canvas.height / r.height);
    _FD.ctx.beginPath();
    _FD.ctx.moveTo(_FD.lastX, _FD.lastY);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if(!_FD.dibujando) return;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (canvas.width  / r.width);
    const y = (t.clientY - r.top)  * (canvas.height / r.height);
    _fdDibujarLinea(x, y);
    _FD.puntosActual++;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    _FD.dibujando = false;
    _FD.ctx.beginPath();
  }, { passive: false });

  // ── Eventos mouse (para probar en escritorio) ──
  canvas.addEventListener('mousedown', e => {
    const r = canvas.getBoundingClientRect();
    _FD.dibujando = true;
    _FD.lastX = (e.clientX - r.left) * (canvas.width  / r.width);
    _FD.lastY = (e.clientY - r.top)  * (canvas.height / r.height);
    _FD.ctx.beginPath();
    _FD.ctx.moveTo(_FD.lastX, _FD.lastY);
  });
  canvas.addEventListener('mousemove', e => {
    if(!_FD.dibujando) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width  / r.width);
    const y = (e.clientY - r.top)  * (canvas.height / r.height);
    _fdDibujarLinea(x, y);
    _FD.puntosActual++;
  });
  canvas.addEventListener('mouseup',   () => { _FD.dibujando = false; _FD.ctx.beginPath(); });
  canvas.addEventListener('mouseleave',() => { _FD.dibujando = false; _FD.ctx.beginPath(); });
}

function _fdDibujarLinea(x, y) {
  const ctx = _FD.ctx;
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.quadraticCurveTo(_FD.lastX, _FD.lastY, (x + _FD.lastX)/2, (y + _FD.lastY)/2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((x + _FD.lastX)/2, (y + _FD.lastY)/2);
  _FD.lastX = x;
  _FD.lastY = y;
}

function _fdLimpiarCanvas() {
  if(!_FD.ctx || !_FD.canvas) return;
  _FD.ctx.clearRect(0, 0, _FD.canvas.width, _FD.canvas.height);
  _FD.ctx.fillStyle = '#ffffff';
  _FD.ctx.fillRect(0, 0, _FD.canvas.width, _FD.canvas.height);
  _FD.puntosActual = 0;
  _FD.ctx.beginPath();
}

// ── Lista de profesores (sidebar) ──────────────────────────────────────
function _fdRenderLista() {
  const cont = document.getElementById('fd-lista');
  if(!cont) return;

  let html = '';

  _FD.profesores.forEach((p, idx) => {
    const firmado  = !!_FD.firmas[p.id];
    const activo   = _FD.profActivo === idx;
    const esCoord  = !!p.esCoord;
    const color    = esCoord ? 'var(--v2)' : _fdColor(p.id);
    const initials = _fdInits(p.inst.nombre);
    const clsCnt   = p.clases.length;

    // Separador de sección antes del primer instructor
    if(idx === 0) html += `<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold2);padding:.3rem .4rem .2rem;font-weight:700;">Coordinación</div>`;
    if(idx === 1) html += `<div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--txt3);padding:.5rem .4rem .2rem;font-weight:700;border-top:1px solid var(--border);margin-top:4px;">Instructores</div>`;

    html += `<div onclick="fd_seleccionarProf(${idx})" style="
      display:flex;align-items:center;gap:8px;padding:8px 8px;
      border-radius:10px;cursor:pointer;margin-bottom:3px;
      background:${activo ? (esCoord?'rgba(232,184,75,.12)':'rgba(26,122,69,.18)') : 'transparent'};
      border:1px solid ${activo ? (esCoord?'var(--gold)':'var(--verde)') : 'transparent'};
      transition:all .15s;-webkit-tap-highlight-color:transparent;">
      <div style="position:relative;flex-shrink:0;">
        <div style="width:34px;height:34px;border-radius:${esCoord?'8px':'50%'};background:${color};
          display:flex;align-items:center;justify-content:center;
          font-size:.7rem;font-weight:700;color:#fff;">${esCoord?'CO':initials}</div>
        ${firmado ? `<div style="position:absolute;bottom:-1px;right:-1px;width:13px;height:13px;
          border-radius:50%;background:var(--neon);border:2px solid var(--panel);
          display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="#0a1f10" stroke-width="3" stroke-linecap="round">
            <polyline points="4,10 8,14 16,6"/>
          </svg></div>` : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.78rem;font-weight:600;color:${activo?(esCoord?'var(--gold2)':'var(--neon)'):'var(--txt)'};
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${esCoord ? (p.inst.nombre || 'Coordinador') : p.inst.nombre.split(' ').slice(0,2).join(' ')}
        </div>
        <div style="font-size:.62rem;color:${firmado?'var(--neon)':(esCoord?'var(--gold2)':'var(--txt3)')};font-style:${esCoord&&!firmado?'italic':'normal'};">
          ${firmado ? '✔ Firmado' : (esCoord ? '← Firma primero aquí' : clsCnt + ' clase' + (clsCnt!==1?'s':''))}
        </div>
      </div>
    </div>`;
  });

  cont.innerHTML = html;
}

// ── Seleccionar profesor activo ────────────────────────────────────────
function fd_seleccionarProf(idx) {
  // Si hay firma pendiente sin guardar, preguntar
  if(_FD.profActivo !== null && _FD.profActivo !== idx && _FD.puntosActual > 10) {
    if(!confirm('¿Descartar la firma actual sin guardar?')) return;
  }

  _FD.profActivo = idx;
  const p = _FD.profesores[idx];
  const esCoord = !!p.esCoord;
  const color = esCoord ? 'var(--v2)' : _fdColor(p.id);

  // Avatar e info
  const av = document.getElementById('fd-prof-avatar');
  if(av){ av.textContent = esCoord ? 'CO' : _fdInits(p.inst.nombre); av.style.background = color; av.style.borderRadius = esCoord ? '8px' : '50%'; }
  const nm = document.getElementById('fd-prof-nombre');
  if(nm) {
    if(esCoord) {
      // Campo editable para nombre del coordinador
      nm.innerHTML = `<input id="fd-coord-nombre-input" type="text"
        value="${_FD.coordNombre}"
        placeholder="Nombre del coordinador"
        style="background:transparent;border:none;border-bottom:1px solid var(--gold);color:var(--gold2);
               font-family:'Outfit',sans-serif;font-size:.82rem;font-weight:700;width:100%;outline:none;padding:2px 0;"
        oninput="fd_actualizarNombreCoord(this.value)">`;
    } else {
      nm.textContent = p.inst.nombre.toUpperCase();
    }
  }
  const cl = document.getElementById('fd-prof-clases-lbl');
  if(cl) cl.textContent = esCoord ? 'Coordinación · Firma la hoja para activarla' : `${p.clases.length} clase${p.clases.length!==1?'s':''} esta semana`;

  // Instrucción
  const ins = document.getElementById('fd-instruccion');
  if(ins) ins.textContent = _FD.firmas[p.id]
    ? (esCoord ? 'Hoja activada con tu firma. Puedes borrarla si necesitas rehacerla.' : 'Ya tienes una firma guardada. Puedes borrarla y volver a firmar.')
    : (esCoord ? 'Firma aquí para ACTIVAR la hoja — los instructores podrán firmar después.' : 'Firma en el área de abajo con el stylus pen');

  // Botón guardar
  const btn = document.getElementById('fd-btn-guardar');
  if(btn) btn.style.background = _FD.firmas[p.id] ? 'var(--gold)' : 'var(--v2)';

  // Mini lista de clases
  const CROJO = '#c0392b';
  const clsList = document.getElementById('fd-clases-list');
  if(clsList) {
    clsList.innerHTML = p.clases.map(c => {
      const esMal   = c.estado==='sub'||c.estado==='falta';
      const capN    = (c.cap && parseInt(c.cap)>0) ? parseInt(c.cap) : (typeof getCapClase === 'function' ? getCapClase(c.clase) : 20);
      const asisN   = (c.alumnos !== null && c.alumnos !== undefined) ? parseInt(c.alumnos) : null;
      const afoP    = (asisN !== null && capN > 0) ? Math.round(asisN / capN * 100) : null;
      const afoColor= afoP !== null ? (afoP >= 70 ? '#1a7a45' : afoP >= 40 ? '#b87a00' : '#c0392b') : '#999';
      const etiqEstado = esMal
        ? `<span style="font-size:.52rem;font-weight:800;background:${esMal&&c.estado==='falta'?'rgba(192,57,43,.15)':'rgba(41,128,185,.15)'};
            border-radius:3px;padding:0 4px;color:${c.estado==='falta'?CROJO:'#1a5fa3'};">
            ${c.estado==='sub'?'SUP':'FALTA'}</span>` : '';
      const afoChip = asisN !== null
        ? `<span style="font-family:'DM Mono',monospace;font-size:.62rem;font-weight:700;
            color:${afoColor};background:${afoP>=70?'rgba(26,122,69,.1)':afoP>=40?'rgba(184,122,0,.1)':'rgba(192,57,43,.1)'};
            border-radius:4px;padding:1px 5px;margin-left:2px;">${asisN}p&nbsp;${afoP!==null?afoP+'%':''}</span>`
        : '';
      return `<span style="display:inline-flex;align-items:center;gap:4px;
        background:var(--panel2);border:1px solid ${esMal?'rgba(192,57,43,.35)':'var(--border)'};
        border-radius:7px;padding:4px 9px;font-size:.65rem;
        color:${esMal?CROJO:'var(--txt2)'};">
        <span style="font-family:'DM Mono',monospace;min-width:52px;">${c.hora}</span>
        <span style="font-weight:700;color:var(--txt);">${c.clase}</span>
        ${afoChip}
        ${etiqEstado}
      </span>`;
    }).join('');
  }

  // Cargar firma guardada si existe, o limpiar canvas
  _fdLimpiarCanvas();
  if(_FD.firmas[p.id]) {
    const img = new Image();
    img.onload = () => { _FD.ctx.drawImage(img, 0, 0, _FD.canvas.width, _FD.canvas.height); };
    img.src = _FD.firmas[p.id];
  }

  _fdRenderLista();
}

// ── Limpiar firma (borrar canvas) ──────────────────────────────────────
function fd_limpiarFirma() {
  _fdLimpiarCanvas();
  const ins = document.getElementById('fd-instruccion');
  if(ins && _FD.profActivo !== null)
    ins.textContent = 'Firma en el área de abajo con el stylus pen';
  const btn = document.getElementById('fd-btn-guardar');
  if(btn) btn.style.background = 'var(--v2)';
}

// ── Clave localStorage para firmas del periodo ────────────────────────
function _fdStorageKey() {
  // Clave única por periodo: fc_firmas_YYYYMMDD_YYYYMMDD
  return `fc_firmas_${(_FD.fechaIni||'').replace(/-/g,'')}__${(_FD.fechaFin||'').replace(/-/g,'')}`;
}

// ── Guardar todas las firmas actuales en localStorage ─────────────────
function _fdPersistirFirmas() {
  try {
    // Solo guardamos el mapa profId→dataURL (puede ser grande, usamos compresión básica)
    const key = _fdStorageKey();
    localStorage.setItem(key, JSON.stringify(_FD.firmas));
    // Guardar también un índice de claves de firmas para poder limpiar antiguas
    let idx = JSON.parse(localStorage.getItem('fc_firmas_idx') || '[]');
    if(!idx.includes(key)) { idx.push(key); localStorage.setItem('fc_firmas_idx', JSON.stringify(idx)); }
    // Purgar firmas de más de 60 días para no saturar el storage
    idx = idx.filter(k => {
      try {
        const fecha = k.split('__')[0].replace('fc_firmas_','');
        const y=fecha.slice(0,4), m=fecha.slice(4,6), d=fecha.slice(6,8);
        const dt = new Date(`${y}-${m}-${d}`);
        const dias = (Date.now() - dt.getTime()) / 86400000;
        if(dias > 60) { localStorage.removeItem(k); return false; }
        return true;
      } catch(e){ return true; }
    });
    localStorage.setItem('fc_firmas_idx', JSON.stringify(idx));
  } catch(e) {
    console.warn('No se pudo persistir firmas:', e);
  }
}

// ── Cargar firmas guardadas del periodo actual ────────────────────────
function _fdCargarFirmasGuardadas() {
  try {
    const key = _fdStorageKey();
    const raw = localStorage.getItem(key);
    if(raw) {
      const saved = JSON.parse(raw);
      // Solo restaurar firmas de instructores que existen en el periodo actual
      _FD.profesores.forEach(p => {
        if(saved[p.id]) _FD.firmas[p.id] = saved[p.id];
      });
      const cnt = Object.keys(_FD.firmas).length;
      if(cnt > 0) showToast(`${cnt} firma${cnt!==1?'s':''} recuperada${cnt!==1?'s':''} del periodo`, 'ok');
    }
  } catch(e) {
    console.warn('No se pudieron cargar firmas guardadas:', e);
  }

  // ── También importar firmas que los instructores pusieron desde su portal ──
  // Respeta firmasBorradas: no importa firmas que fueron borradas intencionalmente
  try {
    const hojaActiva = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(hojaActiva && hojaActiva.firmas && hojaActiva.semIni === _FD.fechaIni && hojaActiva.semFin === _FD.fechaFin) {
      const borradas = hojaActiva.firmasBorradas || {};
      let importadas = 0;
      Object.entries(hojaActiva.firmas).forEach(([instId, firmaDatos]) => {
        const idNum = parseInt(instId);
        if(!firmaDatos || !firmaDatos.data) return;
        // No importar si fue borrada después de guardarse
        const tsBorrado = borradas[instId] || borradas[String(idNum)] || '';
        const tsFirma   = firmaDatos.ts || '';
        if(tsBorrado && tsBorrado >= tsFirma) return;
        if(!_FD.firmas[idNum]) {
          _FD.firmas[idNum] = firmaDatos.data;
          importadas++;
        }
      });
      if(importadas > 0) showToast(`${importadas} firma${importadas!==1?'s':''} importada${importadas!==1?'s':''} del portal de instructores`, 'info');
    }
  } catch(e) { console.warn('Error importando firmas del portal:', e); }
}

// ── Borrar firmas del periodo del localStorage ────────────────────────
function fd_borrarFirmasPeriodo() {
  const cnt = Object.keys(_FD.firmas).length;
  if(cnt === 0) { showToast('No hay firmas guardadas en este periodo', 'info'); return; }
  if(!confirm(`¿Borrar las ${cnt} firma${cnt!==1?'s':''} guardadas de este periodo?\nEsta acción no se puede deshacer.`)) return;

  const tsAhora = new Date().toISOString();

  // 1. Limpiar almacén propio del modal
  try { localStorage.removeItem(_fdStorageKey()); } catch(e){}

  // 2. Limpiar firmas de la hoja activa — registrar cada una como borrada
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(hoja && hoja.semIni === _FD.fechaIni && hoja.semFin === _FD.fechaFin) {
      if(!hoja.firmasBorradas) hoja.firmasBorradas = {};
      // Registrar timestamp de borrado para cada instructor que tenía firma
      Object.keys(hoja.firmas || {}).forEach(instId => {
        hoja.firmasBorradas[instId] = tsAhora;
      });
      hoja.firmas = {};
      localStorage.setItem('fc_hoja_firmas_activa', JSON.stringify(hoja));
      // Subir directamente a Firebase para propagar el borrado a todos los dispositivos
      if(typeof fbDb !== 'undefined' && fbDb) {
        fbDb.ref('fitness/hojaFirmasActiva').set(hoja)
          .then(() => console.log('🗑 Firmas borradas en Firebase'))
          .catch(e => {
            console.warn('Error borrando firmas en Firebase:', e.message);
            if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 500);
          });
      } else if(typeof sincronizarFirebase === 'function') {
        setTimeout(sincronizarFirebase, 300);
      }
    }
  } catch(e) { console.warn('Error limpiando hoja activa:', e); }

  _FD.firmas = {};
  _FD.profActivo = null;
  _fdLimpiarCanvas();
  _fdRenderLista();
  _fdActualizarProgreso();
  const ins = document.getElementById('fd-instruccion');
  if(ins) ins.textContent = 'Selecciona un profesor de la lista para que firme en el área de abajo';
  const av = document.getElementById('fd-prof-avatar');
  if(av){ av.textContent = '?'; av.style.background = 'var(--verde)'; }
  const nm = document.getElementById('fd-prof-nombre');
  if(nm) nm.textContent = 'Selecciona un profesor';
  const cl = document.getElementById('fd-prof-clases-lbl');
  if(cl) cl.textContent = '';
  if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
  showToast('Firmas del periodo eliminadas', 'ok');
}

// ── Guardar firma del profesor activo ──────────────────────────────────
function fd_guardarFirma() {
  if(_FD.profActivo === null) {
    showToast('Selecciona primero un profesor', 'warn');
    return;
  }

  // Verificar que el coordinador ya firmó antes de aceptar firmas de instructores
  const p = _FD.profesores[_FD.profActivo];
  if(!p.esCoord && !_FD.firmas['coord']) {
    showToast('⚠ Primero debe firmar el coordinador para activar la hoja', 'warn');
    alert('El coordinador debe firmar primero.\n\nSelecciona "Coordinación" en la lista y agrega tu firma para activar la hoja.');
    return;
  }

  if(_FD.puntosActual < 5) {
    showToast('El área de firma está vacía. Firma con el stylus primero.', 'warn');
    return;
  }
  const url = _FD.canvas.toDataURL('image/png');
  _FD.firmas[p.id] = url;
  _FD.puntosActual = 0;

  // Persistir inmediatamente en localStorage
  _fdPersistirFirmas();

  _fdActualizarProgreso();
  _fdRenderLista();

  const ins = document.getElementById('fd-instruccion');
  if(ins) ins.textContent = '✔ Firma guardada correctamente';
  const btn = document.getElementById('fd-btn-guardar');
  if(btn) btn.style.background = 'var(--gold)';

  showToast(`Firma de ${p.inst.nombre.split(' ')[0]} guardada`, 'ok');

  // Auto-avanzar al siguiente sin firma
  setTimeout(() => {
    const sig = _FD.profesores.findIndex((pr, i) => i > _FD.profActivo && !_FD.firmas[pr.id]);
    if(sig >= 0) fd_seleccionarProf(sig);
  }, 600);
}

// ── Progreso ───────────────────────────────────────────────────────────


// ── Actualizar nombre del coordinador en tiempo real ──────────────────
function fd_actualizarNombreCoord(nombre) {
  _FD.coordNombre = nombre.trim() || 'Coordinador';
  // Actualizar en la lista de profesores
  const coordProf = _FD.profesores.find(p => p.esCoord);
  if(coordProf) coordProf.inst.nombre = _FD.coordNombre;
  // Guardar en localStorage
  try { localStorage.setItem('fc_coord_nombre', _FD.coordNombre); } catch(e) {}
}

function _fdActualizarProgreso() {
  // Contar coordinador por separado — solo instructores en el total del progreso
  const coordFirmado = !!_FD.firmas['coord'];
  const instructoresList = _FD.profesores.filter(p => !p.esCoord);
  const total    = instructoresList.length;
  const firmados = instructoresList.filter(p => !!_FD.firmas[p.id]).length;
  const el1 = document.getElementById('fd-prog-firmados');
  const el2 = document.getElementById('fd-prog-total');
  if(el1) el1.textContent = firmados;
  if(el2) el2.textContent = total;
}

// ── Exportar PDF con firmas ────────────────────────────────────────────
function fd_exportarPDF() {
  if(!window.jspdf) { showToast('Librería PDF no disponible', 'warn'); return; }
  const firmados = _FD.profesores.filter(p => !!_FD.firmas[p.id]).length;
  if(firmados === 0) {
    showToast('Aún no hay firmas guardadas', 'warn');
    return;
  }
  const sinFirma = _FD.profesores.filter(p => !_FD.firmas[p.id]);
  if(sinFirma.length > 0) {
    const nombres = sinFirma.slice(0,3).map(p=>p.inst.nombre.split(' ')[0]).join(', ');
    const resto   = sinFirma.length > 3 ? ` y ${sinFirma.length-3} más` : '';
    if(!confirm(`Faltan firmas de: ${nombres}${resto}.\n¿Generar el PDF igualmente con los ${firmados} firmados?`))
      return;
  }

  // Reutilizar la lógica de generarHojaFirmasPDF pero inyectando las firmas
  _fd_generarPDFConFirmas();
}

function _fd_generarPDFConFirmas() {
  // Adjuntar nombre del coordinador al objeto de firmas para que el PDF lo muestre
  const firmasConNombre = Object.assign({}, _FD.firmas, {
    coord_nombre: _FD.coordNombre || localStorage.getItem('fc_coord_nombre') || 'Coordinador Fitness'
  });
  const r = _generarHojaFirmasCore(_FD.fechaIni, _FD.fechaFin, _FD.semana, firmasConNombre);
  if(r){
    cerrarModal('m-firmas-digitales');
    showToast(`PDF listo · ${r.firmCnt} firma${r.firmCnt!==1?'s':''} digital${r.firmCnt!==1?'es':''}`, 'ok');
  }
}


// ═══ Verificación automática al cargar (discreta) ════
(function() {
  // Esperar a que los datos carguen antes de verificar
  setTimeout(() => {
    verificarClasesSinRegistrar(true); // silencioso: solo actualiza badge
    // También actualizar el badge del tab Hoy con el conteo de pendientes
    const hoyStr = fechaLocalStr(hoy);
    const diaHoy = DIAS[(hoy.getDay() + 6) % 7];
    let pend = 0;
    instructores.forEach(inst => {
      (inst.horario || []).forEach(slot => {
        if(slot.dia !== diaHoy) return;
        const tieneReg = registros.some(r =>
          String(r.inst_id)===String(inst.id) && r.fecha === hoyStr &&
          r.dia === slot.dia && r.hora === slot.hora
        );
        if(!tieneReg) pend++;
      });
    });
    const badge = document.getElementById('hoy-tab-badge');
    if(badge && pend > 0) { badge.style.display = 'inline'; badge.textContent = pend; }
  }, 3500);
})();
async function inicializarFirebase(){
  if(!FIREBASE_ACTIVO){ setIndicador('⚪ Modo offline'); return; }
  try{
    await Promise.all([
      cargarScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js'),
      cargarScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js')
    ]);

    // Evitar doble inicialización de la SDK
    fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    fbDb  = firebase.database();

    // ── Monitor de conexión ──────────────────
    fbDb.ref('.info/connected').on('value', snap => {
      const online = snap.val() === true;
      if(online){
        if(fbWasOffline){
          fbWasOffline = false;
          setIndicador('🟡 Reconectado · Sincronizando...');
          // Solo subir si ya recibimos la primera respuesta de Firebase
          // (el listener se re-activará solo al reconectar y manejará la lógica)
          setTimeout(()=>{ if(!fbSyncing && fbInicializado) sincronizarFirebase(); }, 2000);
        } else {
          setIndicador('🟢 En línea');
        }
      } else {
        fbWasOffline = true;
        setIndicador('🔴 Sin conexión · Guardando localmente');
      }
    });

    // ── Listener ÚNICO para recibir cambios de otros dispositivos ──
    // Eliminamos el listener anterior si existía (evita duplicados en HMR/reload)
    if(fbListener){ fbDb.ref('fitness').off('value', fbListener); }

    fbListener = fbDb.ref('fitness').on('value', snap => {
      // Si NOSOTROS estamos subiendo, ignorar el eco
      if(fbSyncing) return;

      const data = snap.val();

      // ── Primera respuesta de Firebase (aunque sea null) ──────────────────────
      // Solo a partir de aquí sabemos el estado real de la nube.
      const esPrimeraVez = !fbInicializado;
      fbInicializado = true;

      if(!data){
        // Firebase está vacío → somos la fuente de verdad, subir si tenemos datos locales
        // fbDataRecibida permanece false — indicamos que Firebase confirmó estar vacío
        fbDataRecibida = false;
        if(registros.length > 0 || recorridos.length > 0){
          // Tenemos datos locales y Firebase está vacío → somos la fuente autoritaria
          fbDataRecibida = true; // nuestros datos son los únicos, está bien subir
          setTimeout(sincronizarFirebase, 500);
        }
        return;
      }

      // Firebase tiene datos reales → marcar como recibidos y actualizar máximos
      fbDataRecibida = true;
      const _fbRegCount = data.registros ? Object.keys(data.registros).length : 0;
      const _fbRecCount = data.recorridos ? Object.keys(data.recorridos).length : 0;
      if(_fbRegCount > _fbMaxRegistros)  _fbMaxRegistros  = _fbRegCount;
      if(_fbRecCount > _fbMaxRecorridos) _fbMaxRecorridos = _fbRecCount;
      // Bug fix 6: persistir máximos para que la guardia sobreviva recargas
      if(typeof _persistirMaximos === 'function') _persistirMaximos();

      // ─── Comparar timestamps ────────────────────────────────────────────────
      const localTs = parseInt(localStorage.getItem('fc_local_ts') || '0');
      const fbTs    = parseInt(data.ts || '0');

      // ── Helper: merge de colección por ID, gana el registro más reciente ────
      function mergeColeccion(locales, fbObj){
        if(!fbObj) return locales;
        const fbArr = Object.values(fbObj);
        // Construir mapa local por id
        const mapa = {};
        locales.forEach(r => { mapa[String(r.id)] = r; });
        // Fusionar: si el registro de FB tiene updatedAt mayor, lo usamos
        fbArr.forEach(r => {
          const key = String(r.id);
          if(!mapa[key]){
            mapa[key] = r; // nuevo en Firebase, agregar
          } else {
            const tsLocal = parseInt(mapa[key].updatedAt || mapa[key].ts || 0);
            const tsFb    = parseInt(r.updatedAt || r.ts || 0);
            if(tsFb > tsLocal) mapa[key] = r; // Firebase más nuevo
          }
        });
        return Object.values(mapa);
      }

      fbReceiving = true;
      try{
        if(localTs > fbTs + 3000 && !esPrimeraVez){
          // Datos locales más recientes → subir, no recibir
          fbReceiving = false;
          setTimeout(sincronizarFirebase, 500);
          return;
        }

        // ─── Aplicar / Fusionar datos de Firebase ──────────────────────────
        if(Array.isArray(data.instructores) && data.instructores.length > 0)
          instructores = data.instructores;

        // Merge por ID para registros y recorridos
        registros   = mergeColeccion(registros,   data.registros);
        recorridos  = mergeColeccion(recorridos,  data.recorridos);

        if(Array.isArray(data.salones) && data.salones.length > 0)
          salones = data.salones;

        if(data.suplencias)
          suplenciasPlan = Object.values(data.suplencias);

        if(data.solicitudes)
          solicitudesInst = Object.values(data.solicitudes);

        // ── Sincronizar Agenda (notas) desde Firebase ─────────────────────
        if(Array.isArray(data.agendaNotas) && data.agendaNotas.length > 0) {
          try {
            const localAg   = JSON.parse(localStorage.getItem('fc_agenda') || '[]');
            // Merge por id: gana la nota con ts más reciente
            const mapaAg = {};
            localAg.forEach(n => { if(n.id) mapaAg[n.id] = n; });
            data.agendaNotas.forEach(n => {
              if(!n.id) return;
              if(!mapaAg[n.id]) {
                mapaAg[n.id] = n;
              } else {
                const tsL = parseInt(mapaAg[n.id].updatedAt || mapaAg[n.id].ts || 0);
                const tsF = parseInt(n.updatedAt || n.ts || 0);
                if(tsF > tsL) mapaAg[n.id] = n;
              }
            });
            const mergedAg = Object.values(mapaAg);
            localStorage.setItem('fc_agenda', JSON.stringify(mergedAg));
            // Actualizar variable global si existe
            if(typeof agendaNotas !== 'undefined') {
              agendaNotas = mergedAg;
              if(typeof renderAgendaMob === 'function') renderAgendaMob();
            }
          } catch(e) { console.warn('Merge agenda:', e); }
        }

        // ── Sincronizar Eventos Deportivos desde Firebase ─────────────────
        if(Array.isArray(data.eventos) && data.eventos.length > 0) {
          try {
            const localEv = JSON.parse(localStorage.getItem('fitness_eventos_v1') || '[]');
            // Merge por id: gana el evento con updatedAt más reciente
            const mapaEv = {};
            localEv.forEach(e => { if(e.id) mapaEv[e.id] = e; });
            data.eventos.forEach(e => {
              if(!e.id) return;
              if(!mapaEv[e.id]) {
                mapaEv[e.id] = e;
              } else {
                const tsL = parseInt(mapaEv[e.id].updatedAt || 0);
                const tsF = parseInt(e.updatedAt || 0);
                if(tsF > tsL) mapaEv[e.id] = e;
              }
            });
            const mergedEv = Object.values(mapaEv);
            localStorage.setItem('fitness_eventos_v1', JSON.stringify(mergedEv));
            // Re-renderizar vista de eventos si está activa
            if(typeof evtRenderAll === 'function') {
              try { evtRenderAll(); } catch(ex){}
            }
          } catch(e) { console.warn('Merge eventos:', e); }
        }

        // ── Sincronizar hoja de firmas activa desde Firebase ──────────────
        // Esto permite que cuando el coordinador publica una hoja,
        // los instructores en otros dispositivos la vean inmediatamente
        if(data.hojaFirmasActiva !== undefined) {
          try {
            const hojaLocal  = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
            const hojaRemota = data.hojaFirmasActiva;

            if(hojaRemota) {
              if(!hojaLocal) {
                // No tenemos hoja local → usar la de Firebase directamente
                localStorage.setItem('fc_hoja_firmas_activa', JSON.stringify(hojaRemota));
              } else if(hojaLocal.semIni === hojaRemota.semIni && hojaLocal.semFin === hojaRemota.semFin) {
                // Misma semana → merge de firmas respetando borrados intencionales
                const borradasLocal  = hojaLocal.firmasBorradas  || {};
                const borradasRemota = hojaRemota.firmasBorradas || {};
                // Merge de registros de borrado: gana el timestamp más reciente
                const borradasMerge = { ...borradasRemota };
                Object.entries(borradasLocal).forEach(([instId, ts]) => {
                  if(!borradasMerge[instId] || ts > borradasMerge[instId])
                    borradasMerge[instId] = ts;
                });

                const firmasMerge = { ...(hojaRemota.firmas || {}) };
                Object.entries(hojaLocal.firmas || {}).forEach(([instId, firmaLocal]) => {
                  if(!firmaLocal || !firmaLocal.data) return;
                  const firmaRemota = firmasMerge[instId];
                  if(!firmaRemota || !firmaRemota.data) {
                    firmasMerge[instId] = firmaLocal;
                  } else {
                    const tsLocal  = new Date(firmaLocal.ts || 0).getTime();
                    const tsRemota = new Date(firmaRemota.ts || 0).getTime();
                    if(tsLocal > tsRemota) firmasMerge[instId] = firmaLocal;
                  }
                });

                // Eliminar firmas que fueron borradas intencionalmente
                Object.entries(borradasMerge).forEach(([instId, tsBorrado]) => {
                  const firma = firmasMerge[instId];
                  if(firma && firma.ts && tsBorrado >= firma.ts) delete firmasMerge[instId];
                  else if(firma && !firma.ts) delete firmasMerge[instId];
                });

                const hojaMerge = { ...hojaRemota, firmas: firmasMerge, firmasBorradas: borradasMerge };
                localStorage.setItem('fc_hoja_firmas_activa', JSON.stringify(hojaMerge));
              } else {
                // Semana diferente → la de Firebase es la nueva (el coordinador cambió de semana)
                localStorage.setItem('fc_hoja_firmas_activa', JSON.stringify(hojaRemota));
              }
            } else if(!hojaRemota && hojaLocal) {
              // Firebase no tiene hoja (coordinador la cerró) → limpiar local
              localStorage.removeItem('fc_hoja_firmas_activa');
            }

            // Actualizar UI de firmas si está visible
            if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
            if(typeof instCargarHojaFirmas === 'function') instCargarHojaFirmas();
          } catch(e) { console.warn('Error sincronizando hoja firmas:', e); }
        }

        normalizarRegistros();

        // Actualizar contadores máximos tras recibir datos de Firebase
        if(registros.length  > _fbMaxRegistros)  _fbMaxRegistros  = registros.length;
        if(recorridos.length > _fbMaxRecorridos) _fbMaxRecorridos = recorridos.length;

        // Persistir localmente (fc_local_ts NO se toca porque fbReceiving=true)
        guardarLocal();

        // Si en la primera carga tenemos datos locales MÁS RECIENTES que Firebase,
        // subir el merge resultante para que todos los dispositivos lo vean
        if(esPrimeraVez && localTs > fbTs + 3000){
          // Pequeño delay para dejar que fbReceiving = false primero
          setTimeout(()=>{ fbInicializado=true; sincronizarFirebase(); }, 800);
        }

        // Re-renderizar sin volver a subir a Firebase
        // Guardia: si el rol activo es instructor, no tocar la UI del coordinador
        if(rolActual !== 'instructor') {
          renderAll();
          renderRecorridos();
          if(document.getElementById('v-calendario')?.classList.contains('on')) renderCal();
          if(document.getElementById('v-historial')?.classList.contains('on'))  renderHistorial();
          if(document.getElementById('v-sup-plan')?.classList.contains('on'))    renderSupPlan();
          if(document.getElementById('v-hoy')?.classList.contains('on'))         renderHoy();
          if(document.getElementById('v-salones')?.classList.contains('on'))     renderSalones();
        }
        // Si hay sesión de instructor activa, actualizar su portal con datos frescos
        if(rolActual === 'instructor' && instActualId) {
          const inst = instructores.find(i => i.id === instActualId);
          const nombreEl = document.getElementById('inst-portal-nombre');
          if(inst && nombreEl && (nombreEl.textContent === 'Instructor' || nombreEl.textContent === '')) {
            nombreEl.textContent = inst.nombre;
          }
          // Re-renderizar tab activo del portal
          const tabActivo = document.querySelector('.inst-tab[style*="var(--neon)"]');
          if(tabActivo && tabActivo.dataset.t) instSwitchTab(tabActivo.dataset.t);
          else instSwitchTab('hoy');
        }

      } finally{
        fbReceiving = false;
      }
    });

    setIndicador('🟢 Firebase conectado');

  } catch(e){
    console.warn('Firebase error:', e.message);
    setIndicador('🟡 Sin Firebase · Solo datos locales');
  }
}

// ── Limpiar todos los datos ───────────────────
async function confirmarLimpiezaTotal(){
  const resp = prompt('⚠ ADVERTENCIA: Esta acción es irreversible.\nEscribe BORRAR para confirmar:');
  if(resp !== 'BORRAR'){ showToast('Operación cancelada.','info'); return; }

  instructores    = [];
  registros       = [];
  recorridos      = [];
  suplenciasPlan  = [];
  solicitudesInst = [];
  salones = [
    {id:1, nombre:'Salón Principal', cap:20, tipo:'salon', clases:[]},
    {id:2, nombre:'Estudio Spinning', cap:20, tipo:'spinning', clases:['Spinning','Indoor Cycling','Ciclismo Indoor']},
    {id:3, nombre:'Sala Yoga', cap:15, tipo:'yoga', clases:['Yoga','Pilates','Stretching']},
  ];

  const keys = ['fc_instructores','fc_registros','fc_recorridos','fc_salones',
                 'fc_suplencias','fc_solicitudes','fc_ts','fc_local_ts'];
  keys.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });

  if(fbDb){
    try{
      await fbDb.ref('fitness').set({
        instructores:[], registros:{}, recorridos:{},
        salones, suplencias:{}, solicitudes:{}, ts: Date.now()
      });
    } catch(e){ console.warn('Error borrando Firebase:', e); }
  }

  renderAll();
  renderRecorridos();
  renderCal();
  renderSalones();
  showToast('Todos los datos han sido eliminados. El sistema está limpio.','ok');
}

// ── Helpers ───────────────────────────────────
function cargarScript(src){
  return new Promise((res, rej)=>{
    if(document.querySelector(`script[src="${src}"]`)){ res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function setIndicador(txt){
  // Actualizar pill móvil
  const dot = document.getElementById('mob-sync-dot');
  const stxt = document.getElementById('mob-sync-txt');
  if(dot && stxt) {
    dot.className = '';
    stxt.textContent = txt.replace(/^[🟢🟡🔴⚪]\s*/u, '');
    if(txt.includes('🟢')) dot.classList.add('online');
    else if(txt.includes('🔴')) dot.classList.add('offline');
    else if(txt.includes('🟡')) dot.classList.add('syncing');
  }
  const el = document.getElementById('sync-indicator');
  if(el) el.innerHTML = txt;
}

// Indicador de estado en el header
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ACCESO DIRECTO desde el dashboard (botón "Firmas" mobile, sidebar y snav).
// Abre el menú m-firmas-menu y actualiza su contenido según haya hoja activa:
//   • Sin hoja activa → solo "Crear nueva hoja" (verde)
//   • Con hoja activa → card de estado + "Crear nueva hoja" (rojo, advertencia)
//                       + "Continuar hoja activa" + "Eliminar hoja activa"
// ═══════════════════════════════════════════════════════════════════════════
function abrirFirmasDigitalesDirecto() {
  const menu = document.getElementById('m-firmas-menu');
  if(!menu) {
    if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales();
    else if(typeof showToast === 'function') showToast('No se pudo abrir Firmas Digitales', 'err');
    return;
  }

  // Refrescar estado de los botones según haya hoja activa o no
  fmActualizarMenu();

  menu.classList.add('on');
}

// ── Actualiza qué botones se muestran y el card de estado ──────────────────
function fmActualizarMenu() {
  const wrap     = document.getElementById('fm-estado-wrap');
  const btnCrear = document.getElementById('fm-btn-crear');
  const btnCont  = document.getElementById('fm-btn-continuar');
  const btnElim  = document.getElementById('fm-btn-eliminar');
  const lblCrear = document.getElementById('fm-btn-crear-lbl');
  const subCrear = document.getElementById('fm-btn-crear-sub');
  const subCont  = document.getElementById('fm-btn-continuar-sub');

  let hojaActiva = null;
  try {
    hojaActiva = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
  } catch(e) { hojaActiva = null; }

  if(hojaActiva) {
    // ── HAY HOJA ACTIVA ──────────────────────────────────────────────
    const firmasObj = hojaActiva.firmas || {};
    const firmados  = Object.values(firmasObj).filter(f => f && f.data).length;
    const totalInst = (typeof instructores !== 'undefined')
      ? instructores.filter(i => (i.horario||[]).length > 0).length
      : 0;
    const totalConCoord = totalInst + 1; // +1 coordinador
    const pendientes = Math.max(0, totalConCoord - firmados);

    // Formatear rango de fechas (ej. "13-abril al 19-abril 2026")
    let rango = hojaActiva.encabezado || '';
    if(!rango && hojaActiva.semIni && hojaActiva.semFin) {
      try {
        const fmt = s => {
          const d = new Date(s + 'T12:00:00');
          const dia = String(d.getDate()).padStart(2,'0');
          const mes = d.toLocaleDateString('es-MX', { month:'long' });
          return `${dia}-${mes}`;
        };
        const año = hojaActiva.semIni.slice(0,4);
        rango = `${fmt(hojaActiva.semIni)} al ${fmt(hojaActiva.semFin)} ${año}`;
      } catch(e) {
        rango = `${hojaActiva.semIni} → ${hojaActiva.semFin}`;
      }
    }

    // Card de estado (amarillo)
    if(wrap) {
      wrap.style.display = 'block';
      wrap.style.background = 'rgba(245,158,11,.08)';
      wrap.style.border = '1px solid rgba(245,158,11,.35)';
      wrap.style.color = 'var(--txt)';
      wrap.innerHTML =
        '<div style="font-weight:700;margin-bottom:2px">' +
          '⏳ Hoja activa: ' + rango +
        '</div>' +
        '<div style="font-size:.72rem;opacity:.85">' +
          firmados + ' de ' + totalConCoord + ' firmas recibidas' +
          (pendientes > 0
            ? ' · <span style="color:#f59e0b;font-weight:700">' + pendientes + ' pendientes</span>'
            : ' · <span style="color:var(--neon);font-weight:700">completa</span>') +
        '</div>';
    }

    // Botón "Crear" → en ROJO con advertencia
    if(btnCrear) {
      btnCrear.classList.remove('bsave');
      btnCrear.style.background = 'rgba(192,57,43,.55)';
      btnCrear.style.border = '1px solid rgba(192,57,43,.7)';
      btnCrear.style.color = '#fff';
      btnCrear.style.cursor = 'pointer';
      btnCrear.style.fontFamily = "'Outfit',sans-serif";
      btnCrear.style.width = '100%';
    }
    if(lblCrear) lblCrear.textContent = 'Crear nueva hoja';
    if(subCrear) subCrear.innerHTML = '⚠ Se perderán las ' + firmados + ' firmas actuales';

    // Botón "Continuar" → visible
    if(btnCont) btnCont.style.display = 'flex';
    if(subCont) subCont.textContent = pendientes > 0
      ? 'Faltan ' + pendientes + ' firmas'
      : 'Todas las firmas recibidas';

    // Botón "Eliminar" → visible
    if(btnElim) btnElim.style.display = 'flex';

  } else {
    // ── SIN HOJA ACTIVA ──────────────────────────────────────────────
    if(wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }

    // Botón "Crear" → verde original
    if(btnCrear) {
      btnCrear.classList.add('bsave');
      btnCrear.style.background = '';
      btnCrear.style.border = '';
      btnCrear.style.color = '';
    }
    if(lblCrear) lblCrear.textContent = 'Crear nueva hoja';
    if(subCrear) subCrear.textContent = 'Se publicará para que los instructores firmen';

    // Ocultar continuar y eliminar
    if(btnCont) btnCont.style.display = 'none';
    if(btnElim) btnElim.style.display = 'none';
  }
}

// ── Handler de los 3 botones del menú ──────────────────────────────────────
function fmAccion(tipo) {
  cerrarModal('m-firmas-menu');

  if(tipo === 'crear') {
    // abrirFirmasDigitales() ya tiene la lógica de confirmar/bloquear
    // si hay hoja activa con firmas.
    if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales();
    return;
  }

  if(tipo === 'continuar') {
    if(typeof abrirFirmasDigitales === 'function') abrirFirmasDigitales('continuar');
    return;
  }

  if(tipo === 'eliminar') {
    let hojaActiva = null;
    try {
      hojaActiva = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    } catch(e) {}
    const firmados = hojaActiva
      ? Object.values(hojaActiva.firmas || {}).filter(f => f && f.data).length
      : 0;

    const ok = confirm(
      '⚠ ELIMINAR HOJA ACTIVA\n\n' +
      'Esto borrará la hoja y las ' + firmados + ' firma(s) ya recibidas.\n\n' +
      'Esta acción NO se puede deshacer. ¿Continuar?'
    );
    if(!ok) return;

    localStorage.removeItem('fc_hoja_firmas_activa');

    // Sincronizar con Firebase si está disponible
    try {
      if(typeof fbDb !== 'undefined' && fbDb) {
        fbDb.ref('fitness/hojaFirmasActiva').remove();
      }
    } catch(e) { console.warn('No se pudo borrar hoja firmas en Firebase:', e); }

    if(typeof showToast === 'function') showToast('Hoja activa eliminada', 'ok');
    if(typeof coordActualizarHojaActiva === 'function') coordActualizarHojaActiva();
    return;
  }
}

// Exponer en window para los onclick inline del HTML
window.abrirFirmasDigitalesDirecto = abrirFirmasDigitalesDirecto;
window.fmActualizarMenu = fmActualizarMenu;
window.fmAccion = fmAccion;
