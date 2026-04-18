(function(){
  let fabPressTimer = null;
  let fabMenuOpen   = false;

  function fabTap() {
    if(fabMenuOpen){ cerrarFabMenu(); return; }
    abrirModal('m-clase');
  }
  function abrirFabMenu() {
    fabMenuOpen = true;
    document.getElementById('fab-menu').classList.add('open');
    document.getElementById('fab-overlay').classList.add('open');
  }
  window.cerrarFabMenu = function() {
    fabMenuOpen = false;
    document.getElementById('fab-menu').classList.remove('open');
    document.getElementById('fab-overlay').classList.remove('open');
  };
  window.fabTap = fabTap;
  window.abrirFabMenu = abrirFabMenu;

  const fabBtn = document.getElementById('fab-clase');
  if(fabBtn){
    fabBtn.addEventListener('touchstart', () => {
      fabPressTimer = setTimeout(() => {
        if(navigator.vibrate) navigator.vibrate(40);
        abrirFabMenu();
      }, 420);
    }, {passive:true});
    fabBtn.addEventListener('touchend', () => {
      if(fabPressTimer){ clearTimeout(fabPressTimer); fabPressTimer = null; }
    }, {passive:true});
    fabBtn.addEventListener('touchmove', () => {
      if(fabPressTimer){ clearTimeout(fabPressTimer); fabPressTimer = null; }
    }, {passive:true});
  }

  // Pulso de bienvenida la primera vez
  if(!localStorage.getItem('fc_fab_seen')){
    setTimeout(()=>{
      const f = document.getElementById('fab-clase');
      if(f){
        f.classList.add('fab-pulse');
        f.addEventListener('animationend', ()=>f.classList.remove('fab-pulse'), {once:true});
      }
      localStorage.setItem('fc_fab_seen','1');
    }, 2200);
  }
})();

// ── Re-evaluar layout al rotar / redimensionar ──────────────────────────────
(function() {
  let _lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    if(w === _lastWidth) return;
    _lastWidth = w;
    const mh = document.getElementById('mobile-home');
    if(!mh) return;
    if(w > 640) {
      // Pasó a landscape/tablet → ocultar mobile-home, mostrar vista normal
      mh.classList.remove('on');
      // Si estábamos en 'hoy', activar vista desktop de hoy
      if(_activeSection === 'hoy') {
        document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));
        const vh = document.getElementById('v-hoy');
        if(vh) vh.classList.add('on');
        renderHoy();
      }
    } else {
      // Volvió a portrait → si sección activa es 'hoy', mostrar mobile-home
      if(_activeSection === 'hoy') {
        document.querySelectorAll('.vista').forEach(v => v.classList.remove('on'));
        mh.classList.add('on');
        renderMobileHome();
      }
    }
  });

})();

// ═══════════════════════════════════════════════════════════════
// ═══ MÓDULO EVENTOS DEPORTIVOS ════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ═══ MÓDULO EVENTOS DEPORTIVOS ════════════════════════════════
// ═══════════════════════════════════════════════════════════════

const EVT_KEY = 'fitness_eventos_v1';
let _evtEditing = null;
let _evtCalFecha = new Date();
let _evtResultados = [];
let _evtVista = 'calendario';
let _evtChartDeporte = null;
let _evtChartMes = null;

const EVT_LOGISTICA_ITEMS = [
  {id:'sillas',      label:'🪑 Sillas / Butacas'},
  {id:'mesas',       label:'🪞 Mesas'},
  {id:'lonas',       label:'🏕 Lonas / Gazebos'},
  {id:'sonido',      label:'🔊 Sistema de Sonido'},
  {id:'microfono',   label:'🎤 Micrófono / Voceo'},
  {id:'iluminacion', label:'💡 Iluminación extra'},
  {id:'cronometraje',label:'⏱ Cronometraje'},
  {id:'trofeos',     label:'🏆 Trofeos / Medallas'},
  {id:'arbitros',    label:'🦺 Árbitros / Jueces'},
  {id:'primeros',    label:'🩺 Primeros Auxilios'},
  {id:'hidratacion', label:'💧 Hidratación / Agua'},
  {id:'limpieza',    label:'🧹 Servicio de Limpieza'},
  {id:'impresion',   label:'🖨 Impresiones / Lonas'},
  {id:'seguridad',   label:'🔒 Seguridad'},
  {id:'transporte',  label:'🚌 Transporte'},
  {id:'catering',    label:'🍽 Catering / Refrigerio'},
  {id:'fotografia',  label:'📷 Fotografía / Video'},
  {id:'redes',       label:'📱 Difusión Redes Sociales'},
];

function evtCargarDatos(){
  try{ return JSON.parse(localStorage.getItem(EVT_KEY)||'[]'); }catch(e){ return []; }
}
function evtGuardarDatos(arr){
  localStorage.setItem(EVT_KEY, JSON.stringify(arr));
}
function evtId(){
  return 'evt_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────
function evtRenderAll(){
  document.getElementById('evtAnioActual').textContent = new Date().getFullYear();
  evtActualizarKPIs();
  evtVista(_evtVista);
}

function evtVista(v){
  _evtVista = v;
  ['calendario','lista','stats'].forEach(p=>{
    const el = document.getElementById('evt-panel-'+p);
    if(el) el.style.display = p===v ? 'block' : 'none';
  });
  // Botones activos
  ['Cal','Lista','Stats'].forEach(b=>{
    const btn = document.getElementById('evtBtn'+b);
    if(!btn) return;
    const bv = b === 'Cal' ? 'calendario' : b.toLowerCase();
    const match = bv === v;
    btn.style.background = match ? 'var(--verde)' : '';
    btn.style.color = match ? '#fff' : '';
    btn.style.borderColor = match ? 'var(--verde)' : '';
  });
  if(v==='calendario'){ evtRenderCalendario(); evtRenderProximos(); }
  if(v==='lista'){ evtRenderFiltros(); renderEvtLista(); }
  if(v==='stats'){ evtRenderCharts(); evtGenerarRecomendaciones(); }
}

// ── KPIs ─────────────────────────────────────────────────────
function evtActualizarKPIs(){
  const ev = evtCargarDatos();
  const anio = new Date().getFullYear();
  const esteAnio = ev.filter(e => e.fecha && e.fecha.startsWith(String(anio)));
  const deportes = [...new Set(ev.map(e=>e.deporte).filter(Boolean))].length;
  document.getElementById('evtK1').textContent = ev.length;
  document.getElementById('evtK2').textContent = esteAnio.length;
  document.getElementById('evtK3').textContent = deportes;

  // Próximo evento
  const hoyStr = fechaLocalStr(new Date());
  const proximos = ev.filter(e=>e.fecha >= hoyStr && e.estado!=='cancelado').sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if(proximos.length){
    const p = proximos[0];
    document.getElementById('evtKProx').textContent = p.nombre || p.deporte;
    const dias = Math.ceil((new Date(p.fecha+' 00:00') - new Date()) / 86400000);
    document.getElementById('evtKProxDias').textContent = dias===0 ? '¡Hoy!' : `en ${dias} día${dias>1?'s':''}`;
  } else {
    document.getElementById('evtKProx').textContent = '—';
    document.getElementById('evtKProxDias').textContent = 'Sin eventos próximos';
  }
}

// ── CALENDARIO ───────────────────────────────────────────────
function evtRenderCalendario(){
  const ev = evtCargarDatos();
  const anio = _evtCalFecha.getFullYear();
  const mes  = _evtCalFecha.getMonth();
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('evtCalLbl').textContent = MESES[mes] + ' ' + anio;

  const primerDia = new Date(anio, mes, 1);
  let dow = primerDia.getDay(); // 0=dom
  dow = dow===0 ? 6 : dow-1;   // Lunes=0
  const diasMes = new Date(anio, mes+1, 0).getDate();
  const hoyStr = fechaLocalStr(new Date());

  const grid = document.getElementById('evtCalGrid');
  grid.innerHTML = '';

  // Celdas vacías al inicio
  for(let i=0;i<dow;i++){
    const c = document.createElement('div');
    c.style.cssText = 'min-height:54px;border-radius:6px;background:transparent';
    grid.appendChild(c);
  }

  for(let d=1;d<=diasMes;d++){
    const dStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evsDia = ev.filter(e=>e.fecha===dStr);
    const esHoy = dStr===hoyStr;

    const cell = document.createElement('div');
    cell.style.cssText = `min-height:54px;border-radius:6px;padding:4px;cursor:default;
      background:${esHoy?'rgba(94,255,160,.1)':'var(--panel2)'};
      border:1px solid ${esHoy?'var(--neon)':'var(--border)'};
      transition:all .15s;`;

    cell.innerHTML = `<div style="font-size:.68rem;font-weight:${esHoy?'700':'500'};color:${esHoy?'var(--neon)':'var(--txt2)'};text-align:right;margin-bottom:2px">${d}</div>`;

    evsDia.forEach(e=>{
      const colores = {planificado:'var(--blue)',realizado:'var(--neon)',cancelado:'var(--red2)',pospuesto:'var(--gold2)'};
      const chip = document.createElement('div');
      chip.style.cssText = `font-size:.58rem;background:${colores[e.estado]||'var(--v2)'};color:#000;
        border-radius:3px;padding:1px 4px;margin-bottom:1px;cursor:pointer;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;
        opacity:.92;`;
      chip.textContent = (e.deporte||'') + (e.nombre ? ': '+e.nombre : '');
      chip.title = e.nombre || e.deporte;
      chip.onclick = ()=>abrirModalEvento(e.id);
      cell.appendChild(chip);
    });

    if(evsDia.length===0){
      cell.style.cursor = 'pointer';
      cell.onclick = ()=>{
        abrirModalEvento(null);
        setTimeout(()=>{ document.getElementById('evtFecha').value = dStr; },100);
      };
    }
    grid.appendChild(cell);
  }
}

function evtCalMes(delta){
  _evtCalFecha = new Date(_evtCalFecha.getFullYear(), _evtCalFecha.getMonth()+delta, 1);
  evtRenderCalendario();
}
function evtCalHoy(){
  _evtCalFecha = new Date();
  evtRenderCalendario();
}

// ── PRÓXIMOS EVENTOS ─────────────────────────────────────────
function evtRenderProximos(){
  const ev = evtCargarDatos();
  const hoyStr = fechaLocalStr(new Date());
  const prox = ev.filter(e=>e.fecha >= hoyStr && e.estado!=='cancelado')
                 .sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(0,8);
  const cont = document.getElementById('evtProxLista');
  if(!prox.length){ cont.innerHTML='<div class="empty">No hay eventos próximos registrados.</div>'; return; }
  cont.innerHTML = prox.map(e=>{
    const dias = Math.ceil((new Date(e.fecha+' 00:00') - new Date()) / 86400000);
    const diasLbl = dias===0 ? '<span style="color:var(--neon);font-weight:700">¡HOY!</span>' :
                    dias===1 ? '<span style="color:var(--gold2)">Mañana</span>' :
                    `<span style="color:var(--txt2)">En ${dias} días</span>`;
    const colEst = {planificado:'var(--blue)',realizado:'var(--neon)',cancelado:'var(--red2)',pospuesto:'var(--gold2)'};
    return `<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem;border-bottom:1px solid var(--border);cursor:pointer" onclick="abrirModalEvento('${e.id}')">
      <div style="min-width:38px;text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--neon);line-height:1">${new Date(e.fecha+'T00:00').getDate()}</div>
        <div style="font-size:.55rem;color:var(--txt2);text-transform:uppercase">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date(e.fecha+'T00:00').getMonth()]}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600;color:var(--txt)">${e.nombre||'Sin nombre'}</div>
        <div style="font-size:.7rem;color:var(--txt2)">${e.deporte||''}${e.lugar ? ' · '+e.lugar : ''}${e.horaIni ? ' · '+e.horaIni : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        ${diasLbl}
        <div style="font-size:.62rem;color:${colEst[e.estado]||'var(--txt2)'};margin-top:2px;text-transform:capitalize">${e.estado||''}</div>
      </div>
    </div>`;
  }).join('');
}

// ── LISTA / FILTROS ───────────────────────────────────────────
function evtRenderFiltros(){
  const ev = evtCargarDatos();
  const deportes = [...new Set(ev.map(e=>e.deporte).filter(Boolean))].sort();
  const anios    = [...new Set(ev.map(e=>e.fecha&&e.fecha.slice(0,4)).filter(Boolean))].sort().reverse();
  const selD = document.getElementById('evtFiltroDeporte');
  const selA = document.getElementById('evtFiltroAnio');
  const vd = selD.value, va = selA.value;
  selD.innerHTML = '<option value="">— Todos los deportes —</option>' + deportes.map(d=>`<option${vd===d?' selected':''}>${d}</option>`).join('');
  selA.innerHTML = '<option value="">— Todos los años —</option>' + anios.map(a=>`<option${va===a?' selected':''}>${a}</option>`).join('');
}

function renderEvtLista(){
  const ev = evtCargarDatos();
  const fD = document.getElementById('evtFiltroDeporte')?.value||'';
  const fA = document.getElementById('evtFiltroAnio')?.value||'';
  let filtrados = ev;
  if(fD) filtrados = filtrados.filter(e=>e.deporte===fD);
  if(fA) filtrados = filtrados.filter(e=>e.fecha&&e.fecha.startsWith(fA));
  filtrados = filtrados.sort((a,b)=>b.fecha.localeCompare(a.fecha));

  const colEst = {planificado:'chip cpl',realizado:'chip cok',cancelado:'chip cbd',pospuesto:'chip cho'};
  const tbod = document.getElementById('evtTablaBody');
  if(!filtrados.length){ tbod.innerHTML='<tr><td colspan="8" class="empty">Sin eventos con los filtros seleccionados.</td></tr>'; return; }
  tbod.innerHTML = filtrados.map(e=>{
    const calif = e.calificacion ? '⭐'.repeat(e.calificacion) : '—';
    const fecFmt = e.fecha ? new Date(e.fecha+'T00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<tr>
      <td><span style="font-weight:600;color:var(--neon)">${e.deporte||'—'}</span></td>
      <td>${e.nombre||'—'}</td>
      <td class="mono" style="white-space:nowrap">${fecFmt}</td>
      <td>${e.lugar||'—'}</td>
      <td style="text-align:center">${e.participantes||'—'}</td>
      <td style="text-align:center;font-size:.82rem">${calif}</td>
      <td><span class="${colEst[e.estado]||'chip'}" style="text-transform:capitalize">${e.estado||'—'}</span></td>
      <td>
        <button class="abtn" onclick="abrirModalEvento('${e.id}')" style="margin-right:3px">✏️</button>
        <button class="abtn" onclick="evtVerReporte('${e.id}')">📄</button>
      </td>
    </tr>`;
  }).join('');
}

// ── CHARTS ───────────────────────────────────────────────────
function evtRenderCharts(){
  const ev = evtCargarDatos();
  const txtColor = document.documentElement.classList.contains('tema-claro') ? '#2d5a3a' : '#7aaa90';
  const gridColor = document.documentElement.classList.contains('tema-claro') ? 'rgba(26,122,69,.1)' : 'rgba(94,255,160,.07)';

  // Chart deportes
  const deporteCount = {};
  ev.forEach(e=>{ if(e.deporte) deporteCount[e.deporte] = (deporteCount[e.deporte]||0)+1; });
  const dLabels = Object.keys(deporteCount).sort((a,b)=>deporteCount[b]-deporteCount[a]).slice(0,8);
  const dData   = dLabels.map(d=>deporteCount[d]);
  const PALETA  = ['#5effa0','#4db8e8','#e8b84b','#e05050','#9b8ea8','#52c97d','#ffd06b','#ff7070'];

  const ctxD = document.getElementById('evtChartDeporte');
  if(_evtChartDeporte){ _evtChartDeporte.destroy(); }
  if(ctxD && dLabels.length){
    _evtChartDeporte = new Chart(ctxD, {
      type:'doughnut',
      data:{ labels:dLabels, datasets:[{ data:dData, backgroundColor:PALETA, borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:txtColor, font:{size:11} } } } }
    });
  }

  // Chart por mes
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const anioActual = new Date().getFullYear();
  const porMes = Array(12).fill(0);
  ev.filter(e=>e.fecha&&e.fecha.startsWith(String(anioActual))).forEach(e=>{
    const m = parseInt(e.fecha.slice(5,7))-1;
    porMes[m]++;
  });
  const ctxM = document.getElementById('evtChartMes');
  if(_evtChartMes){ _evtChartMes.destroy(); }
  if(ctxM){
    _evtChartMes = new Chart(ctxM, {
      type:'bar',
      data:{ labels:MESES, datasets:[{
        label:'Eventos '+anioActual, data:porMes,
        backgroundColor:'rgba(94,255,160,.7)', borderRadius:5, borderWidth:0
      }]},
      options:{ responsive:true, maintainAspectRatio:false,
        scales:{
          x:{ ticks:{color:txtColor,font:{size:10}}, grid:{color:gridColor} },
          y:{ ticks:{color:txtColor,font:{size:10},stepSize:1}, grid:{color:gridColor}, beginAtZero:true }
        },
        plugins:{ legend:{display:false} }
      }
    });
  }
}

// ── RECOMENDACIONES ──────────────────────────────────────────
function evtGenerarRecomendaciones(){
  const ev = evtCargarDatos();
  const cont = document.getElementById('evtIARec');
  if(!cont) return;
  if(!ev.length){ cont.innerHTML='<div class="empty">Registra al menos un evento para recibir recomendaciones.</div>'; return; }
  cont.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--txt2);font-size:.8rem">⏳ Analizando historial de eventos...</div>';

  // Análisis local inteligente
  setTimeout(()=>{
    const deporteCount = {};
    const mesesUsados = Array(12).fill(0);
    ev.forEach(e=>{
      if(e.deporte) deporteCount[e.deporte] = (deporteCount[e.deporte]||0)+1;
      if(e.fecha) mesesUsados[parseInt(e.fecha.slice(5,7))-1]++;
    });

    const topDeporte = Object.entries(deporteCount).sort((a,b)=>b[1]-a[1])[0];
    const mesVacio = mesesUsados.indexOf(Math.min(...mesesUsados));
    const mesConMas = mesesUsados.indexOf(Math.max(...mesesUsados));
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const anioActual = new Date().getFullYear();
    const esteAnio = ev.filter(e=>e.fecha&&e.fecha.startsWith(String(anioActual))).length;
    const avgAnio = ev.length / Math.max(1, [...new Set(ev.map(e=>e.fecha&&e.fecha.slice(0,4)))].filter(Boolean).length);

    const recomendaciones = [];

    if(topDeporte){
      recomendaciones.push({
        icono:'🏆', titulo:`Potenciar ${topDeporte[0]}`,
        desc:`Es tu deporte más activo con ${topDeporte[1]} evento${topDeporte[1]>1?'s':''}. Considera organizar una copa interna anual o una liga corta para mantener el impulso.`,
        tipo:'green'
      });
    }
    if(mesVacio !== -1 && mesesUsados[mesVacio]===0){
      recomendaciones.push({
        icono:'📅', titulo:`Activar ${MESES[mesVacio]}`,
        desc:`${MESES[mesVacio]} no tiene eventos registrados. Es una oportunidad para programar un evento especial, torneo o clinic que anime al club en ese mes.`,
        tipo:'blue'
      });
    }
    if(esteAnio < Math.round(avgAnio) && avgAnio > 1){
      recomendaciones.push({
        icono:'📈', titulo:'Aumentar frecuencia este año',
        desc:`Llevas ${esteAnio} evento${esteAnio!==1?'s':''} este año vs. un promedio histórico de ${Math.round(avgAnio)}. Planifica eventos adicionales para mantener el nivel de actividad.`,
        tipo:'gold'
      });
    }
    if(mesConMas !== -1){
      recomendaciones.push({
        icono:'🔥', titulo:`Aprovechar ${MESES[mesConMas]}`,
        desc:`${MESES[mesConMas]} es tu mes con mayor actividad (${mesesUsados[mesConMas]} evento${mesesUsados[mesConMas]>1?'s':''}). Considera anclar un evento insignia anual en ese mes.`,
        tipo:'green'
      });
    }

    const deportesSugeridos = ['Triatlón Kids','Natación recreativa','Yoga al aire libre','Ciclismo familiar','Torneo de Pádel','Duatlón interno'].filter(s=>
      !Object.keys(deporteCount).some(d=>s.toLowerCase().includes(d.toLowerCase()))
    ).slice(0,2);
    deportesSugeridos.forEach(s=>{
      recomendaciones.push({
        icono:'💡', titulo:`Nuevo: ${s}`,
        desc:`Este deporte/formato no está en tu historial. Podría atraer nuevos segmentos del club y diversificar la oferta deportiva.`,
        tipo:'blue'
      });
    });

    const colTipo = {green:'alrt-green',blue:'alrt-blue',gold:'alrt-gold',red:'alrt-red'};
    cont.innerHTML = recomendaciones.map(r=>`
      <div class="alert-card ${colTipo[r.tipo]||''}">
        <div class="alert-icon">${r.icono}</div>
        <div class="alert-txt">
          <strong>${r.titulo}</strong><br>${r.desc}
        </div>
      </div>`).join('') || '<div class="empty">Sin recomendaciones disponibles aún.</div>';
  }, 600);
}

// ── MODAL NUEVO/EDITAR ────────────────────────────────────────
function abrirModalEvento(id){
  _evtEditing = id;
  _evtResultados = [];

  // Construir logística checkboxes ANTES de evtModalTab
  const logWrap = document.getElementById('evtLogisticaWrap');
  if(logWrap){
    logWrap.innerHTML = EVT_LOGISTICA_ITEMS.map(it=>`
    <label style="display:flex;align-items:center;gap:.4rem;font-size:.76rem;cursor:pointer;padding:4px 6px;border-radius:5px;border:1px solid var(--border);background:var(--panel2)">
      <input type="checkbox" id="evtLog_${it.id}" style="accent-color:var(--verde)"> ${it.label}
    </label>`).join('');
  }

  evtModalTab(1);

  if(id){
    const ev = evtCargarDatos().find(e=>e.id===id);
    if(!ev) return;
    document.getElementById('evtModalTitulo').textContent = '✏️ Editar Evento';
    document.getElementById('evtBtnEliminar').style.display = 'inline-block';
    document.getElementById('evtDeporte').value    = ev.deporte||'';
    document.getElementById('evtNombre').value     = ev.nombre||'';
    document.getElementById('evtFecha').value      = ev.fecha||'';
    document.getElementById('evtLugar').value      = ev.lugar||'';
    document.getElementById('evtHoraIni').value    = ev.horaIni||'';
    document.getElementById('evtHoraFin').value    = ev.horaFin||'';
    document.getElementById('evtCategoria').value  = ev.categoria||'';
    document.getElementById('evtEstado').value     = ev.estado||'planificado';
    document.getElementById('evtPartTotal').value  = ev.participantes||'';
    document.getElementById('evtClubM').value      = ev.clubM||'';
    document.getElementById('evtClubF').value      = ev.clubF||'';
    document.getElementById('evtForM').value       = ev.forM||'';
    document.getElementById('evtForF').value       = ev.forF||'';
    document.getElementById('evtClubTotal').value  = ((ev.clubM||0)+(ev.clubF||0))||'';
    document.getElementById('evtPresupuesto').value= ev.presupuesto||'';
    document.getElementById('evtCostoReal').value  = ev.costoReal||'';
    document.getElementById('evtNotasLog').value   = ev.notasLog||'';
    document.getElementById('evtObservaciones').value = ev.observaciones||'';
    document.getElementById('evtMejoras').value    = ev.mejoras||'';
    evtSetStar(ev.calificacion||0, true);
    // Logística checkboxes
    (ev.logistica||[]).forEach(lid=>{ const cb=document.getElementById('evtLog_'+lid); if(cb) cb.checked=true; });
    // Resultados
    _evtResultados = JSON.parse(JSON.stringify(ev.resultados||[]));
    evtRenderResultados();
  } else {
    document.getElementById('evtModalTitulo').textContent = '🏆 Nuevo Evento Deportivo';
    document.getElementById('evtBtnEliminar').style.display = 'none';
    ['evtDeporte','evtNombre','evtFecha','evtLugar','evtHoraIni','evtHoraFin',
     'evtPartTotal','evtClubM','evtClubF','evtForM','evtForF','evtClubTotal',
     'evtPresupuesto','evtCostoReal','evtNotasLog','evtObservaciones','evtMejoras'
    ].forEach(f=>{ const el=document.getElementById(f); if(el) el.value=''; });
    document.getElementById('evtCategoria').value = '';
    document.getElementById('evtEstado').value    = 'planificado';
    evtSetStar(0, true);
    evtRenderResultados();
  }
  document.getElementById('ov-evento').classList.add('on');
}

function evtModalTab(n){
  for(let i=1;i<=5;i++){
    const panel = document.getElementById('evtMPanel'+i);
    const btn   = document.getElementById('evtMTab'+i);
    if(panel) panel.style.display = i===n ? 'block' : 'none';
    if(btn){
      btn.style.background    = i===n ? 'var(--verde)' : '';
      btn.style.color         = i===n ? '#fff' : '';
      btn.style.borderColor   = i===n ? 'var(--verde)' : '';
    }
  }
}

function evtActualizarTotales(){
  const cm = parseInt(document.getElementById('evtClubM').value)||0;
  const cf = parseInt(document.getElementById('evtClubF').value)||0;
  document.getElementById('evtClubTotal').value = cm+cf || '';
}

function evtSetStar(n, silent){
  const califEl = document.getElementById('evtCalif');
  if(!califEl) return;
  califEl.value = n;
  const lbls = ['','Muy malo','Malo','Regular','Bueno','Excelente'];
  const starLbl = document.getElementById('evtStarLbl');
  if(starLbl) starLbl.textContent = n ? lbls[n]||'' : '';
  document.querySelectorAll('#evtEstrellas span').forEach((s,i)=>{
    s.textContent = i < n ? '⭐' : '☆';
    s.style.transform = 'scale(1)';
  });
}

// ── RESULTADOS ────────────────────────────────────────────────
function evtAddResultado(){
  _evtResultados.push({ nombre:'', sexo:'Masculino', categoria:'', modalidad:'', lugar:'' });
  evtRenderResultados();
}

function evtRenderResultados(){
  const wrap = document.getElementById('evtResultadosWrap');
  if(!wrap) return;
  if(!_evtResultados.length){
    wrap.innerHTML='<div style="font-size:.75rem;color:var(--txt3);text-align:center;padding:1.2rem">Presiona "+ Agregar resultado" para capturar resultados.</div>';
    return;
  }
  wrap.innerHTML = _evtResultados.map((r,i)=>`
    <div style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:.6rem .7rem;margin-bottom:.4rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
        <span style="font-size:.7rem;color:var(--txt2);font-weight:600">Resultado #${i+1}</span>
        <button class="abtn" onclick="evtDelResultado(${i})" style="color:var(--red2);border-color:var(--red);font-size:.65rem;padding:2px 7px">✕ Quitar</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:.4rem;align-items:end">
        <div class="fg" style="margin:0"><label>Nombre completo</label>
          <input class="ctrl" style="font-size:.77rem" value="${r.nombre||''}" oninput="evtResEdit(${i},'nombre',this.value)" placeholder="Nombre del participante">
        </div>
        <div class="fg" style="margin:0"><label>Sexo</label>
          <select class="ctrl" style="font-size:.77rem" onchange="evtResEdit(${i},'sexo',this.value)">
            <option${r.sexo==='Masculino'?' selected':''}>Masculino</option>
            <option${r.sexo==='Femenino'?' selected':''}>Femenino</option>
          </select>
        </div>
        <div class="fg" style="margin:0"><label>Categoría</label>
          <input class="ctrl" style="font-size:.77rem" value="${r.categoria||''}" oninput="evtResEdit(${i},'categoria',this.value)" placeholder="ej. 2010">
        </div>
        <div class="fg" style="margin:0"><label>Modalidad</label>
          <input class="ctrl" style="font-size:.77rem" value="${r.modalidad||''}" oninput="evtResEdit(${i},'modalidad',this.value)" placeholder="ej. 100 mts.">
        </div>
        <div class="fg" style="margin:0"><label>Lugar</label>
          <input class="ctrl" style="font-size:.77rem" value="${r.lugar||''}" oninput="evtResEdit(${i},'lugar',this.value)" placeholder="ej. 1ro.">
        </div>
      </div>
    </div>`).join('');
}

function evtResEdit(i, campo, val){ _evtResultados[i][campo] = val; }
function evtDelResultado(i){ _evtResultados.splice(i,1); evtRenderResultados(); }

// ── GUARDAR / ELIMINAR ────────────────────────────────────────
function guardarEvento(){
  const deporte = document.getElementById('evtDeporte').value.trim();
  const nombre  = document.getElementById('evtNombre').value.trim();
  const fecha   = document.getElementById('evtFecha').value;
  if(!deporte || !nombre || !fecha){
    alert('Por favor completa: Deporte, Nombre del evento y Fecha.');
    evtModalTab(1); return;
  }
  const logistica = EVT_LOGISTICA_ITEMS.filter(it=>{
    const cb = document.getElementById('evtLog_'+it.id);
    return cb && cb.checked;
  }).map(it=>it.id);

  const evento = {
    id: _evtEditing || evtId(),
    deporte, nombre, fecha,
    lugar:        document.getElementById('evtLugar').value.trim(),
    horaIni:      document.getElementById('evtHoraIni').value,
    horaFin:      document.getElementById('evtHoraFin').value,
    categoria:    document.getElementById('evtCategoria').value,
    estado:       document.getElementById('evtEstado').value,
    participantes:parseInt(document.getElementById('evtPartTotal').value)||0,
    clubM:        parseInt(document.getElementById('evtClubM').value)||0,
    clubF:        parseInt(document.getElementById('evtClubF').value)||0,
    forM:         parseInt(document.getElementById('evtForM').value)||0,
    forF:         parseInt(document.getElementById('evtForF').value)||0,
    presupuesto:  parseFloat(document.getElementById('evtPresupuesto').value)||0,
    costoReal:    parseFloat(document.getElementById('evtCostoReal').value)||0,
    notasLog:     document.getElementById('evtNotasLog').value.trim(),
    observaciones:document.getElementById('evtObservaciones').value.trim(),
    mejoras:      document.getElementById('evtMejoras').value.trim(),
    calificacion: parseInt(document.getElementById('evtCalif').value)||0,
    logistica,
    resultados:   JSON.parse(JSON.stringify(_evtResultados)),
    creadoEn:     _evtEditing ? undefined : new Date().toISOString(),
    modificadoEn: new Date().toISOString(),
  };

  let ev = evtCargarDatos();
  if(_evtEditing){
    const idx = ev.findIndex(e=>e.id===_evtEditing);
    if(idx>=0){ evento.creadoEn = ev[idx].creadoEn; ev[idx] = evento; }
    else { evento.creadoEn = new Date().toISOString(); ev.push(evento); }
  } else {
    ev.push(evento);
  }
  evtGuardarDatos(ev);
  cerrarOv('ov-evento');
  evtRenderAll();
}

function eliminarEvento(){
  if(!_evtEditing) return;
  if(!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
  let ev = evtCargarDatos().filter(e=>e.id!==_evtEditing);
  evtGuardarDatos(ev);
  cerrarOv('ov-evento');
  evtRenderAll();
}

// ── REPORTE ───────────────────────────────────────────────────
function evtVerReporte(id){
  const ev = evtCargarDatos().find(e=>e.id===id);
  if(!ev) return;
  const fmtFecha = ev.fecha ? new Date(ev.fecha+'T00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '—';
  const logItems = (ev.logistica||[]).map(lid=>{
    const it = EVT_LOGISTICA_ITEMS.find(x=>x.id===lid);
    return it ? it.label : lid;
  });
  const estrellas = ev.calificacion ? '⭐'.repeat(ev.calificacion) : '—';
  const colEst = {planificado:'#4db8e8',realizado:'#5effa0',cancelado:'#e05050',pospuesto:'#e8b84b'};

  let html = `
  <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.8rem">
    <div style="background:linear-gradient(90deg,var(--verde),#0a3020);padding:.9rem 1.1rem;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:2px;color:#fff">🏆 Reporte de Evento Deportivo</div>
        <div style="font-size:.65rem;color:rgba(255,255,255,.7);letter-spacing:1px">Club Campestre Aguascalientes</div>
      </div>
      <div style="background:${colEst[ev.estado]||'#888'};color:#000;font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:12px;text-transform:uppercase">${ev.estado||'—'}</div>
    </div>
    <div style="padding:1rem">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .8rem;margin-bottom:.8rem;font-size:.8rem">
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Deporte</span><div style="font-weight:600;color:var(--neon)">${ev.deporte||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Nombre del Evento</span><div style="font-weight:600">${ev.nombre||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Fecha</span><div style="font-weight:600">${fmtFecha}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Lugar</span><div style="font-weight:600">${ev.lugar||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Hora Inicio</span><div>${ev.horaIni||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Hora Término</span><div>${ev.horaFin||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Categoría</span><div>${ev.categoria||'—'}</div></div>
        <div><span style="color:var(--txt2);font-size:.68rem;text-transform:uppercase;letter-spacing:1px">Calificación</span><div>${estrellas}</div></div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:.7rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">👥 Participantes</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;font-size:.75rem;text-align:center">
          <div style="background:var(--panel2);border-radius:6px;padding:.4rem"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--neon)">${ev.participantes||0}</div><div style="color:var(--txt2);font-size:.6rem">Total</div></div>
          <div style="background:var(--panel2);border-radius:6px;padding:.4rem"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--blue)">${ev.clubM||0}</div><div style="color:var(--txt2);font-size:.6rem">Club Masc.</div></div>
          <div style="background:var(--panel2);border-radius:6px;padding:.4rem"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--gold2)">${ev.clubF||0}</div><div style="color:var(--txt2);font-size:.6rem">Club Fem.</div></div>
          <div style="background:var(--panel2);border-radius:6px;padding:.4rem"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--v3)">${ev.forM||0}</div><div style="color:var(--txt2);font-size:.6rem">For. Masc.</div></div>
          <div style="background:var(--panel2);border-radius:6px;padding:.4rem"><div style="font-family:'Bebas Neue',sans-serif;font-size:1.4rem;color:var(--red2)">${ev.forF||0}</div><div style="color:var(--txt2);font-size:.6rem">For. Fem.</div></div>
        </div>
      </div>`;

  if((ev.resultados||[]).length){
    html += `
      <div style="border-top:1px solid var(--border);padding-top:.7rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">🏅 Resultados</div>
        <table style="width:100%;border-collapse:collapse;font-size:.77rem">
          <thead><tr style="background:var(--panel2)">
            <th style="padding:5px 8px;text-align:left;font-size:.63rem;color:var(--txt2)">Nombre</th>
            <th style="padding:5px 8px;text-align:left;font-size:.63rem;color:var(--txt2)">Sexo</th>
            <th style="padding:5px 8px;text-align:left;font-size:.63rem;color:var(--txt2)">Categoría</th>
            <th style="padding:5px 8px;text-align:left;font-size:.63rem;color:var(--txt2)">Modalidad</th>
            <th style="padding:5px 8px;text-align:left;font-size:.63rem;color:var(--txt2)">Lugar</th>
          </tr></thead>
          <tbody>${ev.resultados.map(r=>`<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 8px">${r.nombre||'—'}</td>
            <td style="padding:5px 8px">${r.sexo||'—'}</td>
            <td style="padding:5px 8px">${r.categoria||'—'}</td>
            <td style="padding:5px 8px">${r.modalidad||'—'}</td>
            <td style="padding:5px 8px;font-weight:700;color:var(--gold2)">${r.lugar||'—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  if(logItems.length){
    html += `
      <div style="border-top:1px solid var(--border);padding-top:.7rem;margin-bottom:.7rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">🛒 Logística</div>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem">${logItems.map(l=>`<span style="background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:2px 8px;font-size:.71rem">${l}</span>`).join('')}</div>
        ${ev.presupuesto||ev.costoReal ? `<div style="margin-top:.5rem;font-size:.77rem;display:flex;gap:1.5rem">
          <span>Presupuesto: <strong style="color:var(--neon)">$${(ev.presupuesto||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></span>
          <span>Costo real: <strong style="color:var(--gold2)">$${(ev.costoReal||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></span>
        </div>` : ''}
        ${ev.notasLog ? `<div style="font-size:.75rem;color:var(--txt2);margin-top:.4rem">${ev.notasLog}</div>` : ''}
      </div>`;
  }

  if(ev.observaciones||ev.mejoras){
    html += `
      <div style="border-top:1px solid var(--border);padding-top:.7rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">📝 Observaciones</div>
        ${ev.observaciones ? `<div style="font-size:.78rem;margin-bottom:.4rem">${ev.observaciones}</div>` : ''}
        ${ev.mejoras ? `<div style="font-size:.75rem;color:var(--txt2)"><strong>Puntos de mejora:</strong> ${ev.mejoras}</div>` : ''}
      </div>`;
  }

  html += `</div></div>`;
  document.getElementById('evtReporteContenido').innerHTML = html;
  document.getElementById('ov-evt-reporte').classList.add('on');
}

function evtImprimirReporte(){
  window.print();
}

// ── INIT ──────────────────────────────────────────────────────
// Alias para compatibilidad con el sistema
function cerrarOv(id){ cerrarModal(id); }

document.addEventListener('DOMContentLoaded', ()=>{
  // Pre-cargar año actual en el KPI label
  const sp = document.getElementById('evtAnioActual');
  if(sp) sp.textContent = new Date().getFullYear();
});




