// ═══════════════════════════════════════════════════════════════════
// PORTAL INSTRUCTOR — Vista personal del instructor logueado
// ═══════════════════════════════════════════════════════════════════

let _instPeriodoDias = 7;
let _instRepChart = null;
let _instFirmaCtx = null;
let _instFirmaDrawing = false;
let _instFirmaHojaActiva = null;  // { semIni, semFin, encabezado, firmas:{} }

// ── Abrir portal ──────────────────────────────
function abrirPortalInstructorLocal() {
  const screen = document.getElementById('instructor-screen');
  if(!screen) return;

  // CRÍTICO: ocultar cualquier elemento del sistema coordinador que pudiera verse
  const mobileHome = document.getElementById('mobile-home');
  if(mobileHome) mobileHome.classList.remove('on');
  const bottomNav = document.getElementById('bottom-nav');
  if(bottomNav) bottomNav.style.display = 'none';
  const hdr = document.getElementById('hdr');
  if(hdr) hdr.style.display = 'none';
  const sidebar = document.getElementById('sidebar');
  if(sidebar) sidebar.style.display = 'none';
  const sectionNav = document.getElementById('section-nav');
  if(sectionNav) sectionNav.style.display = 'none';
  const backBar = document.getElementById('mob-back-bar');
  if(backBar) backBar.style.display = 'none';
  // Ocultar todas las vistas del coordinador
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));

  screen.style.display = 'flex';

  const inst = instructores.find(i => i.id === instActualId);

  // Nombre en el header
  const nombreEl = document.getElementById('inst-portal-nombre');
  if(nombreEl) nombreEl.textContent = inst ? inst.nombre : 'Instructor';

  // Fecha de hoy en el datepicker
  const dp = document.getElementById('inst-date-picker');
  if(dp) dp.value = fechaLocalStr(new Date());

  // Cargar hoja de firmas activa si existe
  instCargarHojaFirmas();

  // Iniciar polling para detectar cuando coordinador publica hoja
  if(typeof instIniciarPoll === 'function') instIniciarPoll();

  // Renderizar tab inicial
  instSwitchTab('hoy');
}

// ── Navegación por tabs ───────────────────────
function instSwitchTab(tab) {
  document.querySelectorAll('.inst-tab-btn').forEach(t => {
    const isOn = t.dataset.t === tab;
    t.classList.toggle('on', isOn);
    // fallback para compatibilidad si aún existen .inst-tab viejos
    t.style.color = '';
    t.style.borderBottomColor = '';
  });
  // compatibilidad hacia atrás con .inst-tab (divs)
  document.querySelectorAll('.inst-tab').forEach(t => {
    const isOn = t.dataset.t === tab;
    t.style.color = isOn ? 'var(--neon)' : 'var(--txt2)';
    t.style.borderBottomColor = isOn ? 'var(--neon)' : 'transparent';
  });
  document.querySelectorAll('.inst-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('inst-panel-' + tab);
  if(panel) panel.style.display = 'block';

  if(tab === 'hoy')     instRenderHoy();
  if(tab === 'reporte') instRenderReporte();
  if(tab === 'firma')   instRenderFirmaTab();
}

// ── Cambio de periodo en reporte ──────────────
function instSelPeriodo(btn, dias) {
  _instPeriodoDias = parseInt(dias);
  document.querySelectorAll('.inst-periodo-pill,.inst-periodo-btn').forEach(b => {
    const isOn = b.dataset.p === String(dias);
    b.classList.toggle('on', isOn);
    // fallback estilos inline para .inst-periodo-btn antiguos
    if(b.classList.contains('inst-periodo-btn')) {
      b.style.background = isOn ? 'var(--verde)' : 'var(--panel2)';
      b.style.color = isOn ? '#fff' : 'var(--txt2)';
      b.style.borderColor = isOn ? 'var(--verde)' : 'var(--border)';
    }
  });
  instRenderReporte();
}

// ─────────────────────────────────────────────
// TAB 1: MIS CLASES HOY
// ─────────────────────────────────────────────
function instRenderHoy() {
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const dp = document.getElementById('inst-date-picker');
  const fechaStr = dp ? dp.value : fechaLocalStr(new Date());
  const fecha = new Date(fechaStr + 'T12:00:00');
  const diaIdx = (fecha.getDay() + 6) % 7; // 0=Lun
  const diaStr = DIAS[diaIdx];
  const esHoy  = fechaStr === fechaLocalStr(new Date());

  const tituloEl = document.getElementById('inst-hoy-titulo');
  const fechaEl  = document.getElementById('inst-hoy-fecha');
  if(tituloEl) tituloEl.textContent = esHoy ? 'HOY' : diaStr.toUpperCase();
  if(fechaEl)  fechaEl.textContent  = fecha.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Clases del instructor para este día
  const slots = (inst.horario||[]).filter(s => s.dia === diaStr).sort((a,b)=>a.hora.localeCompare(b.hora));

  const clasesData = slots.map(slot => {
    const regs = registros.filter(r =>
      String(r.inst_id) === String(inst.id) &&
      r.fecha === fechaStr && r.dia === slot.dia && r.hora === slot.hora
    );
    const reg = regs.length > 0 ? regs[regs.length-1] : null;
    const capN = (reg && parseInt(reg.cap) > 0) ? parseInt(reg.cap) : getCapClase(slot.clase);
    return { slot, reg, capN };
  });

  // KPIs
  const total      = clasesData.length;
  const registradas = clasesData.filter(c=>c.reg).length;
  const pendientes  = total - registradas;
  const totalAsis   = clasesData.filter(c=>c.reg&&(c.reg.estado==='ok'||c.reg.estado==='sub'))
                                 .reduce((a,c)=>a+(parseInt(c.reg.asistentes)||0), 0);

  const kpiEl = document.getElementById('inst-kpis-hoy');
  if(kpiEl) kpiEl.innerHTML = `
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--v3)"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;line-height:1;color:var(--neon)">${total}</div>
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Programadas</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${pendientes>0?'var(--red2)':'var(--neon)'}"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;line-height:1;color:${pendientes>0?'var(--red2)':'var(--neon)'}">${registradas}</div>
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Registradas</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--blue)"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;line-height:1;color:var(--blue)">${totalAsis}</div>
      <div style="font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Asistentes</div>
    </div>`;

  // Lista de clases
  const listaEl = document.getElementById('inst-lista-clases');
  if(!listaEl) return;

  if(clasesData.length === 0) {
    listaEl.innerHTML = `<div class="empty" style="padding:2rem">No tienes clases programadas para el ${diaStr}.</div>`;
    return;
  }

  listaEl.innerHTML = clasesData.map(({ slot, reg, capN }) => {
    const tieneReg = !!reg;
    const estado   = reg ? reg.estado : 'pendiente';
    const asis     = tieneReg ? (parseInt(reg.asistentes)||0) : null;
    const afoP     = (tieneReg && capN > 0 && asis !== null) ? Math.round(asis/capN*100) : null;

    // Colores de estado
    const estadoMap = {
      ok:       { txt:'✔ Impartida',   color:'var(--neon)',   bg:'rgba(94,255,160,.08)',  border:'rgba(94,255,160,.25)' },
      sub:      { txt:'⇄ Con Suplente', color:'var(--blue)',  bg:'rgba(77,184,232,.07)',  border:'rgba(77,184,232,.25)' },
      falta:    { txt:'✖ Falta',        color:'var(--red2)',  bg:'rgba(224,80,80,.07)',   border:'rgba(224,80,80,.25)'  },
      pendiente:{ txt:'⏳ Pendiente',   color:'var(--gold2)', bg:'rgba(232,184,75,.06)',  border:'rgba(232,184,75,.2)'  }
    };
    const est = estadoMap[estado] || estadoMap.pendiente;

    // Suplente si aplica
    const suplementoRow = (reg && reg.suplente_id)
      ? `<div style="font-size:.65rem;color:var(--blue);margin-top:4px">⇄ Suplente: <strong>${instructores.find(i=>i.id===reg.suplente_id)?.nombre||'—'}</strong></div>`
      : '';

    // Barra de aforo
    const aforoBar = afoP !== null
      ? `<div style="margin-top:6px">
           <div style="display:flex;justify-content:space-between;font-size:.6rem;color:var(--txt3);margin-bottom:2px">
             <span>Aforo</span><span style="color:${pctCol(afoP)};font-weight:700">${afoP}%</span>
           </div>
           <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
             <div style="height:100%;width:${Math.min(afoP,100)}%;background:${pctCol(afoP)};border-radius:2px;transition:width .5s"></div>
           </div>
         </div>`
      : '';

    return `
      <div style="background:${est.bg};border:1px solid ${est.border};border-radius:14px;padding:.9rem 1rem;margin-bottom:.5rem;transition:all .15s">
        <div style="display:flex;align-items:flex-start;gap:.8rem">
          <div style="min-width:44px;text-align:center">
            <div style="font-family:'DM Mono',monospace;font-size:.8rem;color:var(--gold2);font-weight:700">${slot.hora}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.9rem;margin-bottom:3px">${slot.clase}</div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              <span style="font-size:.68rem;font-weight:700;color:${est.color};background:var(--panel2);border-radius:10px;padding:2px 8px">${est.txt}</span>
              ${tieneReg && asis !== null ? `<span style="font-size:.68rem;color:var(--txt2)">👥 ${asis}${capN?' / '+capN:''} personas</span>` : ''}
            </div>
            ${suplementoRow}
            ${aforoBar}
            ${reg && reg.obs ? `<div style="font-size:.65rem;color:var(--txt3);margin-top:4px;font-style:italic">${reg.obs}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// TAB 2: MI REPORTE PERSONAL
// ─────────────────────────────────────────────
function instRenderReporte() {
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const hoyDate = new Date();
  const hoyStr  = fechaLocalStr(hoyDate);
  const desdeFecha = new Date(hoyDate);
  desdeFecha.setDate(desdeFecha.getDate() - _instPeriodoDias);
  const desdeStr = fechaLocalStr(desdeFecha);

  // Filtrar registros del instructor en el periodo
  const misRegs = registros.filter(r =>
    String(r.inst_id) === String(inst.id) &&
    r.fecha >= desdeStr && r.fecha <= hoyStr
  ).sort((a,b) => b.fecha.localeCompare(a.fecha));

  const impartidas = misRegs.filter(r => r.estado==='ok' || r.estado==='sub');
  const faltas     = misRegs.filter(r => r.estado==='falta');
  const conAfor    = impartidas.filter(r => parseInt(r.cap||0)>0);
  const aforProm   = conAfor.length > 0
    ? Math.round(conAfor.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/conAfor.length)
    : null;
  const totalAsis  = impartidas.reduce((a,r)=>a+(parseInt(r.asistentes)||0),0);

  // KPIs
  const kpisEl = document.getElementById('inst-rep-kpis');
  if(kpisEl) kpisEl.innerHTML = `
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--neon)"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;line-height:1;color:var(--neon)">${impartidas.length}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Clases impartidas</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${faltas.length>0?'var(--red2)':'var(--v3)'}"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;line-height:1;color:${faltas.length>0?'var(--red2)':'var(--neon)'}">${faltas.length}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Faltas</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--blue)"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;line-height:1;color:var(--blue)">${totalAsis}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Total asistentes</div>
    </div>
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${aforProm!==null?pctCol(aforProm):'var(--txt3)'}"></div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:2rem;line-height:1;color:${aforProm!==null?pctCol(aforProm):'var(--txt3)'}">${aforProm!==null?aforProm+'%':'—'}</div>
      <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3);margin-top:3px">Aforo promedio</div>
    </div>`;

  // Gráfica: aforo por clase (agrupar)
  const claseStats = {};
  impartidas.forEach(r => {
    if(!r.clase) return;
    if(!claseStats[r.clase]) claseStats[r.clase] = { total:0, cap:0, count:0 };
    if(parseInt(r.cap||0)>0) {
      claseStats[r.clase].total += (parseInt(r.asistentes)||0);
      claseStats[r.clase].cap   += parseInt(r.cap);
      claseStats[r.clase].count++;
    }
  });
  const claseLabels = Object.keys(claseStats).filter(k => claseStats[k].count>0);
  const claseAforos = claseLabels.map(k => claseStats[k].cap>0 ? Math.round(claseStats[k].total/claseStats[k].cap*100) : 0);

  const canvas = document.getElementById('inst-rep-chart');
  if(canvas && claseLabels.length > 0) {
    if(_instRepChart) _instRepChart.destroy();
    _instRepChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: claseLabels,
        datasets: [{
          label: 'Aforo %',
          data: claseAforos,
          backgroundColor: claseAforos.map(v => v>=75?'rgba(94,255,160,.7)':v>=30?'rgba(232,184,75,.7)':'rgba(224,80,80,.7)'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{ display:false } },
        scales: {
          y: { beginAtZero:true, max:100, ticks:{ color:'#7aaa90', font:{size:10} }, grid:{ color:'rgba(255,255,255,.06)' } },
          x: { ticks:{ color:'#7aaa90', font:{size:10} }, grid:{ display:false } }
        }
      }
    });
  } else if(canvas) {
    if(_instRepChart) _instRepChart.destroy();
    const wrap = document.getElementById('inst-rep-chart-wrap');
    if(wrap) wrap.innerHTML = '<div class="empty">Sin datos suficientes en este periodo.</div>';
  }

  // Tabla de historial
  const tbEl = document.getElementById('inst-rep-tabla');
  if(!tbEl) return;
  if(misRegs.length === 0) {
    tbEl.innerHTML = `<tr><td colspan="6" class="empty">Sin registros en este periodo.</td></tr>`;
    return;
  }
  tbEl.innerHTML = misRegs.slice(0,50).map(r => {
    const fd = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    const asis = parseInt(r.asistentes)||0;
    const cap  = parseInt(r.cap)||0;
    const afo  = cap>0 ? Math.round(asis/cap*100) : null;
    const estMap = { ok:'<span class="chip cok">✔ Impartida</span>', sub:'<span class="chip" style="background:rgba(77,184,232,.12);color:var(--blue)">⇄ Suplente</span>', falta:'<span class="chip cbd">✖ Falta</span>' };
    return `<tr>
      <td class="mono" style="font-size:.74rem;color:var(--txt2)">${fd}</td>
      <td><strong style="font-size:.8rem">${r.clase||'—'}</strong></td>
      <td class="mono" style="font-size:.72rem;color:var(--gold2)">${r.hora||'—'}</td>
      <td class="mono" style="text-align:center">${r.estado!=='falta'?asis:'—'}</td>
      <td>${afo!==null?`<span style="color:${pctCol(afo)};font-family:'DM Mono',monospace;font-size:.74rem;font-weight:700">${afo}%</span>`:'<span style="color:var(--txt3)">—</span>'}</td>
      <td>${estMap[r.estado]||'—'}</td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────
// TAB 3: FIRMA DIGITAL
// ─────────────────────────────────────────────
const INST_FIRMA_KEY = 'fc_hoja_firmas_activa';

function instCargarHojaFirmas() {
  try {
    const data = localStorage.getItem(INST_FIRMA_KEY);
    _instFirmaHojaActiva = data ? JSON.parse(data) : null;
  } catch(e) { _instFirmaHojaActiva = null; }

  // Actualizar badge en header
  const badge = document.getElementById('inst-firma-badge');
  if(!badge) return;
  if(_instFirmaHojaActiva) {
    const firmas = _instFirmaHojaActiva.firmas || {};
    const yafirme = firmas[String(instActualId)] && firmas[String(instActualId)].data;
    badge.style.display = yafirme ? 'none' : 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function instRenderFirmaTab() {
  instCargarHojaFirmas();
  const inst = instructores.find(i => i.id === instActualId);
  if(!inst) return;

  const sinHoja = document.getElementById('inst-firma-sin-hoja');
  const activa  = document.getElementById('inst-firma-activa');

  if(!_instFirmaHojaActiva) {
    sinHoja.style.display = 'block';
    activa.style.display  = 'none';
    return;
  }

  sinHoja.style.display = 'none';
  activa.style.display  = 'block';

  // ── Tabla de clases del periodo ──
  const tablaEl = document.getElementById('inst-firma-clases-tabla');
  if(tablaEl) {
    const semIni = _instFirmaHojaActiva.semIni || '';
    const semFin = _instFirmaHojaActiva.semFin || '';
    const inst   = instructores.find(i => i.id === instActualId);
    const misRegs = inst ? registros.filter(r =>
      String(r.inst_id) === String(inst.id) && r.fecha >= semIni && r.fecha <= semFin
    ).sort((a,b) => a.fecha.localeCompare(b.fecha) || (a.hora||'').localeCompare(b.hora||'')) : [];

    if(misRegs.length === 0) {
      tablaEl.innerHTML = '<div class="empty" style="padding:.8rem;font-size:.72rem">Sin clases registradas en este periodo.</div>';
    } else {
      // Agrupar por clase única (dedup por dia+hora+clase)
      const vistos = new Set();
      const unicos = misRegs.filter(r => {
        const k = `${r.dia}|${r.hora}|${r.clase}`;
        if(vistos.has(k)) return false;
        vistos.add(k); return true;
      });

      const total  = misRegs.filter(r => r.estado==='ok'||r.estado==='sub').length;
      const faltas = misRegs.filter(r => r.estado==='falta').length;
      const conAf  = misRegs.filter(r => (r.estado==='ok'||r.estado==='sub') && parseInt(r.cap||0)>0);
      const aforProm = conAf.length > 0
        ? Math.round(conAf.reduce((a,r)=>a+(parseInt(r.asistentes)||0)/parseInt(r.cap)*100,0)/conAf.length)
        : null;

      tablaEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">
          <div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--neon)">${total}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Impartidas</div>
          </div>
          <div style="padding:.5rem .7rem;text-align:center;border-right:1px solid var(--border)">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${faltas>0?'var(--red2)':'var(--neon)'}">${faltas}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Faltas</div>
          </div>
          <div style="padding:.5rem .7rem;text-align:center">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:${aforProm!==null?pctCol(aforProm):'var(--txt3)'}">${aforProm!==null?aforProm+'%':'—'}</div>
            <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt3)">Aforo prom.</div>
          </div>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;font-size:.72rem;border-collapse:collapse">
            <thead>
              <tr style="background:var(--panel)">
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Fecha</th>
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Clase</th>
                <th style="padding:5px 8px;text-align:center;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Asist.</th>
                <th style="padding:5px 8px;text-align:center;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Aforo</th>
                <th style="padding:5px 8px;text-align:left;font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--txt2);font-weight:500">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${misRegs.map(r => {
                const fd = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
                const asis = parseInt(r.asistentes)||0;
                const cap  = parseInt(r.cap)||0;
                const afo  = cap>0 ? Math.round(asis/cap*100) : null;
                const estCol = r.estado==='ok'?'var(--neon)':r.estado==='falta'?'var(--red2)':'var(--blue)';
                const estTxt = r.estado==='ok'?'✔':r.estado==='falta'?'✖':'⇄';
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:5px 8px;color:var(--txt2)">${fd}</td>
                  <td style="padding:5px 8px;font-weight:600">${r.clase||'—'}<br><span style="font-size:.58rem;color:var(--txt3);font-weight:400">${r.hora||''}</span></td>
                  <td style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace">${r.estado!=='falta'?asis:'—'}</td>
                  <td style="padding:5px 8px;text-align:center;font-family:'DM Mono',monospace;color:${afo!==null?pctCol(afo):'var(--txt3)'}">${afo!==null?afo+'%':'—'}</td>
                  <td style="padding:5px 8px;color:${estCol};font-weight:700">${estTxt}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }
  }

  // Info de la hoja
  const semLbl = document.getElementById('inst-firma-semana-lbl');
  if(semLbl) {
    const ini = _instFirmaHojaActiva.semIni || '';
    const fin = _instFirmaHojaActiva.semFin || '';
    const enc = _instFirmaHojaActiva.encabezado || '';
    let txt = enc || '';
    if(ini && fin) {
      const dI = new Date(ini+'T12:00:00');
      const dF = new Date(fin+'T12:00:00');
      txt = (enc ? enc + ' · ' : '') + `Semana del ${dI.toLocaleDateString('es-MX',{day:'numeric',month:'short'})} al ${dF.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}`;
    }
    semLbl.textContent = txt;
  }

  // Info instructor
  const avatarEl = document.getElementById('inst-firma-avatar');
  const nombreEl = document.getElementById('inst-firma-nombre-lbl');
  const estadoEl = document.getElementById('inst-firma-estado-lbl');
  const chipEl   = document.getElementById('inst-firma-chip');

  const iniciales = inst.nombre.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  if(avatarEl) avatarEl.textContent = iniciales;
  if(nombreEl) nombreEl.textContent = inst.nombre;

  const firmas = _instFirmaHojaActiva.firmas || {};
  const misFirma = firmas[String(instActualId)];
  const firmado  = misFirma && misFirma.data;

  if(estadoEl) estadoEl.textContent = firmado ? '✔ Firmado el ' + (new Date(misFirma.ts).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})) : 'Sin firma';
  if(chipEl) {
    chipEl.textContent    = firmado ? '✔ Firmado' : '✖ Sin firmar';
    chipEl.style.background = firmado ? 'rgba(94,255,160,.15)' : 'rgba(224,80,80,.15)';
    chipEl.style.color      = firmado ? 'var(--neon)'          : 'var(--red2)';
  }

  // Actualizar botón borrar del canvas según estado
  const btnBorrar = document.getElementById('inst-canvas-borrar-btn');
  if(btnBorrar) {
    if(firmado) {
      btnBorrar.textContent = '✖ Borrar firma guardada';
      btnBorrar.style.borderColor = 'var(--red)';
      btnBorrar.style.color = 'var(--red2)';
      btnBorrar.title = 'Eliminar tu firma guardada para volver a firmar';
    } else {
      btnBorrar.textContent = '↺ Limpiar';
      btnBorrar.style.borderColor = 'var(--border)';
      btnBorrar.style.color = 'var(--txt3)';
      btnBorrar.title = '';
    }
  }

  // Actualizar botón guardar según estado
  const btnGuardar = document.getElementById('inst-guardar-btn');
  if(btnGuardar) {
    btnGuardar.style.opacity = firmado ? '0.5' : '1';
    btnGuardar.style.pointerEvents = firmado ? 'none' : 'auto';
    btnGuardar.textContent = firmado ? '✔ Firma guardada' : '✔ Guardar Firma';
  }

  // Inicializar canvas
  setTimeout(() => instInicializarCanvas(firmado ? misFirma.data : null), 100);
}

function instInicializarCanvas(dataUrl) {
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas) return;
  const wrap = document.getElementById('inst-firma-canvas-wrap');

  // Dimensionar
  const w = wrap ? wrap.clientWidth : 340;
  canvas.width  = w;
  canvas.height = 200;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Si ya hay firma guardada, mostrarla
  if(dataUrl) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = dataUrl;
  }

  _instFirmaCtx     = ctx;
  _instFirmaDrawing = false;

  // Quitar listeners viejos clonando
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const c = document.getElementById('inst-firma-canvas');
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, c.width, c.height);
  if(dataUrl) { const img=new Image(); img.onload=()=>cx.drawImage(img,0,0); img.src=dataUrl; }
  _instFirmaCtx = cx;

  // Si ya hay firma guardada, bloquear el dibujo (solo lectura)
  const _canvasReadOnly = !!dataUrl;
  c.style.cursor = _canvasReadOnly ? 'not-allowed' : 'crosshair';
  c.style.opacity = _canvasReadOnly ? '0.85' : '1';

  // Mouse
  c.addEventListener('mousedown', e => { if(_canvasReadOnly) return; _instFirmaDrawing=true; cx.beginPath(); const r=c.getBoundingClientRect(); cx.moveTo(e.clientX-r.left, e.clientY-r.top); });
  c.addEventListener('mousemove', e => { if(_instFirmaDrawing && !_canvasReadOnly) { const r=c.getBoundingClientRect(); cx.lineWidth=2.5; cx.lineCap='round'; cx.strokeStyle='#1a1a1a'; cx.lineTo(e.clientX-r.left, e.clientY-r.top); cx.stroke(); } });
  c.addEventListener('mouseup',   () => _instFirmaDrawing = false);
  c.addEventListener('mouseleave',() => _instFirmaDrawing = false);

  // Touch
  c.addEventListener('touchstart', e => { if(_canvasReadOnly) return; e.preventDefault(); _instFirmaDrawing=true; cx.beginPath(); const r=c.getBoundingClientRect(); const t=e.touches[0]; cx.moveTo(t.clientX-r.left, t.clientY-r.top); }, {passive:false});
  c.addEventListener('touchmove',  e => { e.preventDefault(); if(!_instFirmaDrawing || _canvasReadOnly) return; const r=c.getBoundingClientRect(); const t=e.touches[0]; cx.lineWidth=2.5; cx.lineCap='round'; cx.strokeStyle='#1a1a1a'; cx.lineTo(t.clientX-r.left, t.clientY-r.top); cx.stroke(); }, {passive:false});
  c.addEventListener('touchend',   () => _instFirmaDrawing = false);
}

function instLimpiarFirma() {
  // Si ya hay firma guardada → pedir confirmación y borrarla
  const firmas = _instFirmaHojaActiva ? (_instFirmaHojaActiva.firmas || {}) : {};
  const misFirma = firmas[String(instActualId)];
  if(misFirma && misFirma.data) {
    instBorrarFirmaGuardada();
    return;
  }
  // Si no hay firma guardada → solo limpiar el canvas
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas || !_instFirmaCtx) return;
  _instFirmaCtx.fillStyle = '#ffffff';
  _instFirmaCtx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Borrar firma ya guardada (con confirmación) ───────────────────────
function instBorrarFirmaGuardada() {
  if(!_instFirmaHojaActiva) return;
  const inst = instructores.find(i => i.id === instActualId);
  const nombre = inst ? inst.nombre.split(' ')[0] : 'tu firma';
  if(!confirm(`¿Borrar la firma guardada de ${nombre}?\nPodrás volver a firmar.`)) return;

  // Eliminar firma del objeto en memoria
  if(_instFirmaHojaActiva.firmas) {
    delete _instFirmaHojaActiva.firmas[String(instActualId)];
  }

  // Actualizar localStorage
  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(_instFirmaHojaActiva)); } catch(e){}

  // Subir a Firebase para que coordinación también vea el borrado
  (async () => {
    try {
      if(typeof fbDb !== 'undefined' && fbDb) {
        const snap = await fbDb.ref('fitness/hojaFirmasActiva').once('value');
        const fbHoja = snap.val();
        if(fbHoja && fbHoja.semIni === _instFirmaHojaActiva.semIni) {
          if(fbHoja.firmas) delete fbHoja.firmas[String(instActualId)];
          _instFirmaHojaActiva = fbHoja;
          localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(_instFirmaHojaActiva));
        }
      }
    } catch(e) {}
    if(typeof sincronizarFirebase === 'function') setTimeout(sincronizarFirebase, 300);
  })();

  // Refrescar UI — canvas limpio y habilitado
  instRenderFirmaTab();
  showToast('Firma eliminada. Ya puedes volver a firmar.', 'info');
  registrarLog('instructor', `Firma eliminada: ${inst?.nombre||'—'}`);
}

function instGuardarFirma() {
  const canvas = document.getElementById('inst-firma-canvas');
  if(!canvas) return;

  // Verificar que hay algo dibujado
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let hayTrazo = false;
  for(let i=0; i<data.length; i+=4) {
    if(data[i]<240 || data[i+1]<240 || data[i+2]<240) { hayTrazo=true; break; }
  }
  if(!hayTrazo) { showToast('Por favor firma antes de guardar','warn'); return; }

  if(!_instFirmaHojaActiva) return;

  const dataUrl = canvas.toDataURL('image/png');
  if(!_instFirmaHojaActiva.firmas) _instFirmaHojaActiva.firmas = {};
  _instFirmaHojaActiva.firmas[String(instActualId)] = {
    data: dataUrl,
    nombre: instructores.find(i=>i.id===instActualId)?.nombre || '—',
    ts: new Date().toISOString()
  };

  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(_instFirmaHojaActiva)); } catch(e){}

  // ── Subir firma a Firebase SOLO si la hoja sigue activa en Firebase ──────
  // Esto evita que una hoja "fantasma" (ya cerrada por coordinación pero aún
  // en localStorage del instructor) se regenere al guardar la firma.
  (async () => {
    let hojaValidaEnFirebase = false;
    try {
      if(typeof fbDb !== 'undefined' && fbDb) {
        const snap = await fbDb.ref('fitness/hojaFirmasActiva').once('value');
        const fbHoja = snap.val();
        if(fbHoja && fbHoja.semIni === _instFirmaHojaActiva.semIni
                  && fbHoja.semFin === _instFirmaHojaActiva.semFin) {
          hojaValidaEnFirebase = true;
        } else if(fbHoja === null || fbHoja === undefined) {
          // Coordinador ya cerró la hoja — limpiar localStorage del instructor
          localStorage.removeItem(INST_FIRMA_KEY);
          _instFirmaHojaActiva = null;
          instCargarHojaFirmas();
          instRenderFirmaTab();
          showToast('La hoja fue cerrada por coordinación. Tu firma no pudo guardarse.', 'warn');
          return;
        }
      } else {
        // Sin Firebase — confiar en localStorage
        hojaValidaEnFirebase = true;
      }
    } catch(e) {
      // Error de red — subir de todos modos (modo offline)
      hojaValidaEnFirebase = true;
    }

    if(hojaValidaEnFirebase && typeof sincronizarFirebase === 'function') {
      setTimeout(sincronizarFirebase, 300);
    }

    // Actualizar UI
    instRenderFirmaTab();
    instCargarHojaFirmas();
    coordActualizarHojaActiva();
    showToast('✔ Firma guardada correctamente','ok');
    registrarLog('instructor', `Firma digital registrada: ${instructores.find(i=>i.id===instActualId)?.nombre||'—'}`);
  })();
}

function instAbrirFirma() {
  instSwitchTab('firma');
}

// ─────────────────────────────────────────────
// POLLING AUTOMÁTICO — revisar hoja cada 10s mientras instructor está en tab firma
// ─────────────────────────────────────────────
let _instPollTimer = null;

function instIniciarPoll() {
  instPararPoll();
  _instPollTimer = setInterval(() => {
    const anteriorTenia = !!_instFirmaHojaActiva;
    instCargarHojaFirmas();
    const ahoraTiene = !!_instFirmaHojaActiva;

    const panel = document.getElementById('inst-panel-firma');
    const panelVisible = panel && panel.style.display !== 'none';

    // Hoja apareció → notificar si el tab está visible
    if(!anteriorTenia && ahoraTiene && panelVisible) {
      instRenderFirmaTab();
      showToast('\u270d Hoja de firmas disponible \u2014 ya puedes firmar', 'ok');
    }
    // Hoja desapareció (coordinador la cerró) → actualizar UI siempre
    if(anteriorTenia && !ahoraTiene) {
      _instFirmaHojaActiva = null;
      if(panelVisible) instRenderFirmaTab();
      showToast('La hoja de firmas fue cerrada por coordinación.', 'info');
    }
  }, 5000); // Reducido a 5s para detectar cierres más rápido
}

function instPararPoll() {
  if(_instPollTimer) { clearInterval(_instPollTimer); _instPollTimer = null; }
}

// ─────────────────────────────────────────────
// COORDINADOR — Indicador de hoja activa en modal de reportes
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// COORDINADOR — Indicador de hoja activa en modal de reportes
// ─────────────────────────────────────────────
function coordCerrarHojaActiva() {
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(!hoja) return;
    const firmados = Object.values(hoja.firmas || {}).filter(f => f && f.data).length;
    const msg = firmados > 0
      ? `¿Cerrar la hoja activa?\n\nTiene ${firmados} firma(s) guardadas.\nAsegúrate de haber generado el PDF antes de cerrarla.\n\n¿Confirmar cierre?`
      : '¿Cerrar la hoja activa para poder generar una nueva?';
    if(!confirm(msg)) return;
  } catch(e){}
  localStorage.removeItem('fc_hoja_firmas_activa');
  coordActualizarHojaActiva();
  // ── Sincronizar el cierre a Firebase (la hoja desaparecerá en todos los dispositivos) ──
  if(typeof sincronizarFirebase === 'function') {
    setTimeout(sincronizarFirebase, 500);
  }
  showToast('Hoja cerrada. Ya puedes generar una nueva.', 'info');
}

function coordActualizarHojaActiva() {
  const infoEl = document.getElementById('coord-hoja-activa-info');
  const txtEl  = document.getElementById('coord-hoja-activa-txt');
  const progEl = document.getElementById('coord-hoja-activa-prog');
  const btnFirmas = document.querySelector('[onclick="abrirFirmasDigitales()"]');
  if(!infoEl) return;
  try {
    const hoja = JSON.parse(localStorage.getItem('fc_hoja_firmas_activa') || 'null');
    if(!hoja) {
      infoEl.style.display = 'none';
      if(btnFirmas) {
        btnFirmas.style.opacity = '';
        btnFirmas.title = '';
      }
      return;
    }
    infoEl.style.display = 'block';
    const firmas = hoja.firmas || {};
    const firmados = Object.values(firmas).filter(f => f && f.data).length;
    const regsDelPer = (typeof registros !== 'undefined')
      ? [...new Set(registros.filter(r=>r.fecha>=(hoja.semIni||'')&&r.fecha<=(hoja.semFin||'')).map(r=>r.inst_id))]
      : [];
    const total = Math.max(regsDelPer.length, firmados, Object.keys(firmas).length);
    const semTxt = hoja.encabezado || (hoja.semIni ? `${hoja.semIni} → ${hoja.semFin}` : 'Semana activa');
    if(txtEl) txtEl.innerHTML = `✍ Hoja activa · <strong style="color:var(--neon)">${semTxt}</strong>`;
    if(progEl) {
      progEl.textContent = total > 0 ? `${firmados}/${total} firmados` : `${firmados} firmados`;
      progEl.style.color = (total > 0 && firmados >= total) ? 'var(--neon)' : 'var(--gold2)';
    }
    // Resaltar el botón de firmas digitales si hay hoja activa con firmas
    if(btnFirmas && firmados > 0) {
      btnFirmas.title = `Hoja activa: ${firmados} firma(s) — se acumularán al abrir la misma semana`;
    }
  } catch(e) { if(infoEl) infoEl.style.display = 'none'; }
}

// Actualizar indicador periódicamente y al iniciar
setInterval(coordActualizarHojaActiva, 8000);
setTimeout(coordActualizarHojaActiva, 1500);

// ─────────────────────────────────────────────
// COORDINADOR: Generar / Publicar hoja de firmas
// Se llama desde el modal de reportes al elegir "Firmas digitales"
// Expone la hoja para que los instructores puedan firmar desde su portal
// ─────────────────────────────────────────────
function instPublicarHojaFirmas(semIni, semFin, encabezado) {
  // Recuperar firmas previas si ya existe hoja para la misma semana
  let prevFirmas = {};
  try {
    const prev = JSON.parse(localStorage.getItem(INST_FIRMA_KEY)||'null');
    if(prev && prev.semIni === semIni && prev.semFin === semFin) {
      prevFirmas = prev.firmas || {};
    }
  } catch(e){}

  // También cargar firmas del almacén del coordinador para el mismo periodo
  try {
    const fcKey = `fc_firmas_${(semIni||'').replace(/-/g,'')}__${(semFin||'').replace(/-/g,'')}`;
    const raw = localStorage.getItem(fcKey);
    if(raw) {
      const saved = JSON.parse(raw);
      Object.entries(saved).forEach(([instId, dataUrl]) => {
        if(dataUrl && !prevFirmas[instId]) {
          prevFirmas[instId] = { data: dataUrl, nombre: instructores.find(i=>i.id===parseInt(instId))?.nombre||'—', ts: new Date().toISOString(), fromCoord: true };
        }
      });
    }
  } catch(e){}

  const hoja = { semIni, semFin, encabezado, firmas: prevFirmas, publicado: new Date().toISOString() };
  try { localStorage.setItem(INST_FIRMA_KEY, JSON.stringify(hoja)); } catch(e){}
  // Actualizar indicador coordinador
  setTimeout(coordActualizarHojaActiva, 100);
  // ── Subir a Firebase para que instructores en otros dispositivos la vean ──
  if(typeof sincronizarFirebase === 'function') {
    setTimeout(sincronizarFirebase, 500);
  }
  // No mostrar toast aquí porque ya se llama al abrir el modal de firmas
}

// ─────────────────────────────────────────────
// Gancho en el modal de firmas digitales del coordinador:
// Cuando se genera el PDF, también publica la hoja activa
// ─────────────────────────────────────────────
const _origGenerarPDFFirmas = window.generarPDFFirmas;
window.generarPDFFirmasConPublicacion = function(semIni, semFin, encabezado) {
  instPublicarHojaFirmas(semIni, semFin, encabezado);
  if(typeof _origGenerarPDFFirmas === 'function') _origGenerarPDFFirmas();
};

