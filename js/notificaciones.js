// ═══════════════════════════════════════════════════════════════
// js/notificaciones.js  —  Notificaciones push · Fitness Campestre
// Coordinador: solicita permiso, registra token FCM en Firebase,
// programa recordatorios configurables por evento.
// ═══════════════════════════════════════════════════════════════

// ── VAPID public key ─────────────────────────────────────────
// Generada en Firebase Console → Project Settings → Cloud Messaging
// → Web Push certificates → Generate key pair → copiar "Key pair"
// IMPORTANTE: reemplaza este valor con tu VAPID key real.
const FCM_VAPID_KEY = 'BNCbWz9IgFw2mBfN3ChI9zekBl3Vvz-16Ad2ckicHOT8U12IMh1a1Jf4bBIvQfLqUrJfWUyjyg5MQACaqKd9XBQ';

// ── Estado del módulo ────────────────────────────────────────
let _fcmMessaging   = null;   // instancia firebase.messaging()
let _swRegistration = null;   // SW registration activo
let _fcmToken       = null;   // token de este dispositivo

// ═══════════════════════════════════════════════════════════════
// 1. INICIALIZACIÓN  (llamar desde init() en app principal)
// ═══════════════════════════════════════════════════════════════
async function initNotificaciones() {
  // Solo para coordinador — si no hay sesión activa, salir
  if (!_esCoordinador()) return;

  // Verificar soporte del navegador
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[Notif] Este navegador no soporta notificaciones push.');
    return;
  }

  try {
    // Registrar el SW real (ruta relativa: funciona en raíz o subdirectorio)
    _swRegistration = await navigator.serviceWorker.register(
      new URL('firebase-messaging-sw.js', document.baseURI).href
    );
    console.log('[Notif] Service Worker registrado:', _swRegistration.scope);

    // Escuchar mensajes de confirmación del SW
    navigator.serviceWorker.addEventListener('message', _onSwMessage);

    // Inicializar Firebase Messaging (requiere que firebase esté cargado)
    if (typeof firebase !== 'undefined' && firebase.messaging) {
      _fcmMessaging = firebase.messaging();

      // Manejar mensajes cuando la app está EN PRIMER PLANO
      _fcmMessaging.onMessage(payload => {
        console.log('[Notif] Mensaje en foreground:', payload);
        const { title, body } = payload.notification || {};
        _mostrarToastNotif(title || '📅 Recordatorio', body || '');
      });
    }

    // Solicitar permiso y obtener token (con flujo suave)
    await _solicitarPermiso();

    // Programar recordatorios de eventos próximos (vía SW, best-effort)
    _programarTodosLosRecordatorios();

    // Programador EN LA PÁGINA: la capa CONFIABLE mientras la app está abierta
    _iniciarSchedulerPagina();

  } catch (err) {
    console.warn('[Notif] Error en initNotificaciones:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. SOLICITAR PERMISO Y OBTENER TOKEN FCM
// ═══════════════════════════════════════════════════════════════
async function _solicitarPermiso() {
  const permiso = Notification.permission;

  if (permiso === 'denied') {
    console.warn('[Notif] Permiso denegado por el usuario.');
    return false;
  }

  if (permiso === 'default') {
    // Primera vez: mostrar explicación antes del prompt del navegador
    const acepto = await _mostrarDialogoPermiso();
    if (!acepto) return false;

    const resultado = await Notification.requestPermission();
    if (resultado !== 'granted') {
      showToast('Notificaciones no activadas. Puedes activarlas en ajustes del navegador.', 'warn');
      return false;
    }
  }

  // Permiso concedido — obtener token FCM
  await _obtenerTokenFCM();
  return true;
}

async function _obtenerTokenFCM() {
  if (!_fcmMessaging || !FCM_VAPID_KEY || FCM_VAPID_KEY === 'TU_VAPID_PUBLIC_KEY_AQUI') {
    // Sin VAPID key: modo solo-local (notificaciones locales programadas desde SW)
    console.log('[Notif] Modo local activo (sin VAPID key configurada).');
    return;
  }

  try {
    const token = await _fcmMessaging.getToken({
      vapidKey:            FCM_VAPID_KEY,
      serviceWorkerRegistration: _swRegistration
    });

    if (token) {
      _fcmToken = token;
      console.log('[Notif] Token FCM obtenido:', token.slice(0, 20) + '…');
      // Guardar en Firebase para poder enviar push remotas en el futuro
      await _guardarTokenEnFirebase(token);
      showToast('🔔 Notificaciones activadas para este dispositivo', 'ok');
    }
  } catch (err) {
    console.warn('[Notif] No se pudo obtener token FCM:', err.message);
    // Continuar en modo local — las notificaciones del SW siguen funcionando
  }
}

async function _guardarTokenEnFirebase(token) {
  if (!fbDb) return;
  try {
    const dispositivo = {
      token,
      rol:       'coordinador',
      ua:        navigator.userAgent.slice(0, 80),
      actualizadoEn: Date.now()
    };
    await fbDb.ref('fitness/notif_tokens/' + _tokenKey(token)).set(dispositivo);
  } catch (e) {
    console.warn('[Notif] No se pudo guardar token en Firebase:', e.message);
  }
}

// Key segura derivada del token (últimos 20 chars)
function _tokenKey(token) {
  return 'coord_' + token.slice(-20).replace(/[^a-zA-Z0-9]/g, '_');
}

// ═══════════════════════════════════════════════════════════════
// 3. PROGRAMAR RECORDATORIOS DE EVENTOS
// ═══════════════════════════════════════════════════════════════

// Llamar al guardar un evento O al abrir la app (programa todos los pendientes)
function _programarTodosLosRecordatorios() {
  if (!_swRegistration || !_swRegistration.active) return;

  const hoyStr  = new Date().toISOString().slice(0, 10);

  // 1. Eventos deportivos pendientes
  _cargarEventos()
    .filter(e => e.estado !== 'cancelado' && e.fecha >= hoyStr && e.horaIni)
    .forEach(e => _programarRecordatorio(e));

  // 2. Notas de agenda con fecha + hora + recordatorio configurado
  _cargarNotasAgenda()
    .filter(n => !n.resuelta && n.fecha && n.fecha >= hoyStr && n.hora && n.minRecordatorio)
    .forEach(n => _programarRecordatorio({
      id:              n.id,
      nombre:          (n.texto || 'Nota').slice(0, 60),
      fecha:           n.fecha,
      horaIni:         n.hora,
      minRecordatorio: n.minRecordatorio
    }));
}

// Programar (o reprogramar) el recordatorio de UN evento
function programarRecordatorioEvento(evento) {
  if (!evento || !evento.horaIni || !evento.fecha) return;
  if (evento.estado === 'cancelado') {
    cancelarRecordatorioEvento(evento.id);
    return;
  }
  if (!_swRegistration?.active) {
    // SW no listo todavía — reintentar en 2 segundos
    setTimeout(() => programarRecordatorioEvento(evento), 2000);
    return;
  }
  _programarRecordatorio(evento);
}

function _programarRecordatorio(evento) {
  const sw = _swRegistration?.active;
  if (!sw) return;

  const minAntes  = parseInt(evento.minRecordatorio) || 30; // campo nuevo en el modal
  const fechaHora = evento.fecha + 'T' + evento.horaIni + ':00';

  sw.postMessage({
    tipo:      'PROGRAMAR_RECORDATORIO',
    eventoId:  evento.id,
    nombre:    evento.nombre || evento.deporte || 'Evento',
    fechaHora,
    minAntes
  });
}

// Cancelar recordatorio al eliminar o cancelar un evento
function cancelarRecordatorioEvento(eventoId) {
  const sw = _swRegistration?.active;
  if (!sw || !eventoId) return;
  sw.postMessage({ tipo: 'CANCELAR_RECORDATORIO', eventoId });
}

// ═══════════════════════════════════════════════════════════════
// 4. PANEL DE CONFIGURACIÓN (para mostrar en ajustes del coord)
// ═══════════════════════════════════════════════════════════════
function renderPanelNotifStatus() {
  const el = document.getElementById('notif-status-panel');
  if (!el) return;

  const permiso   = Notification.permission;
  const iconColor = permiso === 'granted' ? 'var(--neon)' : permiso === 'denied' ? 'var(--red2)' : 'var(--gold2)';
  const iconTxt   = permiso === 'granted' ? '🔔' : permiso === 'denied' ? '🔕' : '🔔?';
  const estadoTxt = permiso === 'granted' ? 'Activas' : permiso === 'denied' ? 'Bloqueadas en el navegador' : 'Sin configurar';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;
                background:var(--panel2);border:1px solid var(--border);border-radius:10px;">
      <span style="font-size:1.2rem">${iconTxt}</span>
      <div style="flex:1">
        <div style="font-size:.78rem;font-weight:600;color:${iconColor}">
          Notificaciones: ${estadoTxt}
        </div>
        <div style="font-size:.65rem;color:var(--txt3);margin-top:1px">
          ${_fcmToken ? 'Token FCM registrado ✔' : 'Solo notificaciones locales (app debe abrirse una vez al día)'}
        </div>
      </div>
      ${permiso !== 'granted'
        ? `<button class="btn bo" style="font-size:.65rem;padding:4px 10px"
                   onclick="initNotificaciones()">Activar</button>`
        : `<button class="btn bo" style="font-size:.65rem;padding:4px 10px"
                   onclick="_programarTodosLosRecordatorios();showToast('Recordatorios actualizados','ok')">
             ↺ Reprogramar
           </button>`
      }
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// 5. HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════

function _esCoordinador() {
  // El coordinador inicia sesión como 'admin' o 'usuario' (auth.js).
  // Se revisa sessionStorage.fc_rol (login fresco), localStorage.fc_ses_rol
  // (sesión persistida) y fc_rol como respaldo.
  const rol = sessionStorage.getItem('fc_rol')
           || localStorage.getItem('fc_ses_rol')
           || localStorage.getItem('fc_rol')
           || '';
  // Los instructores NO reciben recordatorios de coordinación.
  if (rol === 'instructor') return false;
  return rol === 'admin' || rol === 'usuario' || rol === 'coordinador' || rol === 'coord' || rol === '';
}

function _cargarEventos() {
  try {
    return JSON.parse(localStorage.getItem('fitness_eventos_v1') || '[]');
  } catch (e) { return []; }
}

function _cargarNotasAgenda() {
  try {
    return JSON.parse(localStorage.getItem('fc_agenda') || '[]');
  } catch (e) { return []; }
}

// ════════════════════════════════════════════════════════════════
//  PROGRAMADOR EN LA PÁGINA  ·  capa CONFIABLE mientras la app está abierta
//  ----------------------------------------------------------------
//  El setTimeout del Service Worker NO es confiable: el navegador detiene los
//  service workers inactivos a los ~30 s aunque la app siga abierta, y el
//  temporizador se pierde. Por eso revisamos los recordatorios desde la propia
//  página con un intervalo. Mientras la app esté abierta, los avisos SÍ se
//  disparan a tiempo. (Con la app cerrada se necesita push del servidor / FCM.)
// ════════════════════════════════════════════════════════════════
let _pageSchedulerId = null;
const _recordatoriosDisparados = new Set(_cargarDisparados());

function _cargarDisparados() {
  try { return JSON.parse(localStorage.getItem('fc_notif_disparados') || '[]'); }
  catch (e) { return []; }
}
function _marcarDisparado(id) {
  _recordatoriosDisparados.add(id);
  try {
    // Conservar solo los últimos 200 para no crecer indefinidamente
    localStorage.setItem('fc_notif_disparados', JSON.stringify([..._recordatoriosDisparados].slice(-200)));
  } catch (e) {}
}

// Lista unificada de recordatorios pendientes (eventos + notas de agenda)
function _recordatoriosPendientes() {
  const out = [];
  const hoyStr = new Date().toISOString().slice(0, 10);

  _cargarEventos()
    .filter(e => e.estado !== 'cancelado' && e.fecha >= hoyStr && e.horaIni && e.minRecordatorio)
    .forEach(e => out.push({
      id: 'rec_' + e.id,
      nombre: e.nombre || e.deporte || 'Evento',
      fecha: e.fecha, hora: e.horaIni, min: parseInt(e.minRecordatorio) || 30
    }));

  _cargarNotasAgenda()
    .filter(n => !n.resuelta && n.fecha && n.fecha >= hoyStr && n.hora && n.minRecordatorio)
    .forEach(n => out.push({
      id: 'rec_' + n.id,
      nombre: (n.texto || 'Nota').slice(0, 60),
      fecha: n.fecha, hora: n.hora, min: parseInt(n.minRecordatorio) || 30
    }));

  return out;
}

function _revisarRecordatorios() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const ahora = Date.now();

  _recordatoriosPendientes().forEach(r => {
    if (_recordatoriosDisparados.has(r.id)) return;
    const msEvento = new Date(r.fecha + 'T' + r.hora + ':00').getTime();
    if (isNaN(msEvento)) return;
    const msDisparo = msEvento - r.min * 60 * 1000;
    // Ventana: desde la hora del aviso hasta 1 min después del inicio del evento.
    // Así, si abres la app un poco tarde, el aviso todavía se dispara una vez.
    if (ahora >= msDisparo && ahora <= msEvento + 60000) {
      _dispararNotificacionLocal(r);
      _marcarDisparado(r.id);
    }
  });
}

async function _dispararNotificacionLocal(r) {
  const titulo = '📅 Recordatorio · Fitness';
  const opts = {
    body: `${r.nombre} comienza en ${r.min} min`,
    icon: 'img/icon-192.png',
    badge: 'img/icon-96.png',
    tag: r.id,                 // mismo tag que el SW → no se duplica
    renotify: true,
    requireInteraction: true,
    data: { url: location.href }
  };
  try {
    // En móvil la notificación DEBE mostrarse vía Service Worker
    const reg = _swRegistration || await navigator.serviceWorker.ready;
    await reg.showNotification(titulo, opts);
    console.log('[Notif] Recordatorio disparado desde la página:', r.nombre);
  } catch (e) {
    console.warn('[Notif] No se pudo mostrar la notificación:', e.message);
    _mostrarToastNotif(titulo, opts.body);   // último recurso visible en pantalla
  }
}

function _iniciarSchedulerPagina() {
  if (_pageSchedulerId) return;
  _revisarRecordatorios();                                  // revisar de inmediato
  _mostrarResumenDiario();                                  // resumen de pendientes del día
  _pageSchedulerId = setInterval(_revisarRecordatorios, 20000); // cada 20 s
  // Al volver al frente (regresar de otra app / desbloquear / abrir en la tarde)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      _revisarRecordatorios();
      _mostrarResumenDiario();
    }
  });
}

// ════════════════════════════════════════════════════════════════
//  RESUMEN DE PENDIENTES DEL DÍA  ·  se muestra al abrir la app
//  ----------------------------------------------------------------
//  Cuando llegas en la mañana y abres la app, recibes una notificación con
//  TODOS los pendientes de hoy (notas sin resolver + eventos). Si vuelves a
//  abrirla en la tarde (pasadas ~3 h), te lo recuerda de nuevo. Entre aperturas
//  cercanas no se repite, para no saturarte.
// ════════════════════════════════════════════════════════════════
const RESUMEN_THROTTLE_MS = 3 * 60 * 60 * 1000;   // 3 horas entre resúmenes

function _pendientesDeHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  const items = [];

  _cargarEventos()
    .filter(e => e.estado !== 'cancelado' && e.fecha === hoy)
    .forEach(e => items.push({ hora: e.horaIni || '', nombre: e.nombre || e.deporte || 'Evento', tipo: '🏆' }));

  _cargarNotasAgenda()
    .filter(n => !n.resuelta && n.fecha === hoy)
    .forEach(n => items.push({ hora: n.hora || '', nombre: (n.texto || 'Nota').slice(0, 50), tipo: '📝' }));

  // Ordenar: primero los que tienen hora (cronológico), luego los sin hora
  items.sort((a, b) => {
    if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
    if (a.hora) return -1;
    if (b.hora) return 1;
    return 0;
  });
  return items;
}

async function _mostrarResumenDiario(forzar) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Anti-spam: no repetir si ya se mostró hace menos de 3 h (salvo que se fuerce)
  const ultimo = parseInt(localStorage.getItem('fc_resumen_last') || '0');
  if (!forzar && (Date.now() - ultimo) < RESUMEN_THROTTLE_MS) return;

  const pend = _pendientesDeHoy();
  if (pend.length === 0) {
    if (forzar) _mostrarToastNotif('✅ Sin pendientes', 'No tienes pendientes para hoy');
    return;
  }

  // Construir el cuerpo: hasta 6 líneas, luego "y N más"
  const lineas = pend.slice(0, 6).map(p =>
    `${p.tipo} ${p.hora ? p.hora + '  ' : ''}${p.nombre}`
  );
  if (pend.length > 6) lineas.push(`… y ${pend.length - 6} más`);

  const titulo = pend.length === 1
    ? '📋 Tienes 1 pendiente hoy'
    : `📋 Tienes ${pend.length} pendientes hoy`;

  try {
    const reg = _swRegistration || await navigator.serviceWorker.ready;
    await reg.showNotification(titulo, {
      body: lineas.join('\n'),
      icon: 'img/icon-192.png',
      badge: 'img/icon-96.png',
      tag: 'resumen-dia',          // siempre reemplaza el anterior
      renotify: true,
      requireInteraction: true,
      data: { url: location.href }
    });
    localStorage.setItem('fc_resumen_last', String(Date.now()));
    console.log('[Notif] Resumen del día mostrado:', pend.length, 'pendientes');
  } catch (e) {
    console.warn('[Notif] No se pudo mostrar el resumen:', e.message);
    _mostrarToastNotif(titulo, lineas.join(' · '));
  }
}


// Toast de notificación en foreground (cuando la app está abierta)
function _mostrarToastNotif(titulo, cuerpo) {
  if (typeof showToast === 'function') {
    showToast(`${titulo}${cuerpo ? ' · ' + cuerpo : ''}`, 'info');
  }
  // También mostrar notificación visual en pantalla si está disponible
  const container = document.getElementById('notif-foreground-banner') || _crearBanner();
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:.7rem;padding:.7rem 1rem;
                background:var(--panel2);border:1px solid var(--verde);border-radius:12px;
                box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideDown .3s ease">
      <span style="font-size:1.4rem">📅</span>
      <div style="flex:1">
        <div style="font-size:.82rem;font-weight:700;color:var(--neon)">${titulo}</div>
        ${cuerpo ? `<div style="font-size:.72rem;color:var(--txt2);margin-top:2px">${cuerpo}</div>` : ''}
      </div>
      <button onclick="this.parentElement.parentElement.remove()"
              style="background:none;border:none;color:var(--txt3);font-size:1rem;cursor:pointer;padding:4px">✕</button>
    </div>`;
  container.style.display = 'block';
  setTimeout(() => { if (container) container.remove(); }, 8000);
}

function _crearBanner() {
  const div = document.createElement('div');
  div.id = 'notif-foreground-banner';
  div.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;width:min(90vw,380px)';
  document.body.appendChild(div);
  return div;
}

// Diálogo explicativo antes de pedir permiso del navegador
function _mostrarDialogoPermiso() {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;
      display:flex;align-items:center;justify-content:center;padding:1rem`;
    div.innerHTML = `
      <div style="background:var(--panel);border:1px solid var(--verde);border-radius:16px;
                  padding:1.4rem;max-width:320px;width:100%;text-align:center">
        <div style="font-size:2rem;margin-bottom:.5rem">🔔</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:var(--neon);
                    letter-spacing:1px;margin-bottom:.6rem">Activar Recordatorios</div>
        <div style="font-size:.78rem;color:var(--txt2);line-height:1.5;margin-bottom:1rem">
          Recibe notificaciones en tu celular antes de cada evento programado,
          aunque no tengas la app abierta.
        </div>
        <div style="display:flex;gap:.5rem;justify-content:center">
          <button class="btn bg" style="flex:1" onclick="this.closest('div[style]').remove();_resolve(true)">
            Sí, activar
          </button>
          <button class="btn bo" style="flex:1" onclick="this.closest('div[style]').remove();_resolve(false)">
            Ahora no
          </button>
        </div>
      </div>`;
    // Exponer resolve al scope del HTML inline
    window._resolve = v => { resolve(v); delete window._resolve; };
    document.body.appendChild(div);
  });
}

function _onSwMessage(event) {
  const msg = event.data;
  if (!msg) return;
  if (msg.tipo === 'RECORDATORIO_CONFIRMADO') {
    const mins = Math.round((msg.delay || 0) / 60000);
    console.log(`[Notif] Recordatorio confirmado por SW (en ~${mins} min):`, msg.eventoId);
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. EXPONER FUNCIONES GLOBALES
// ═══════════════════════════════════════════════════════════════
window.initNotificaciones             = initNotificaciones;
window.programarRecordatorioEvento    = programarRecordatorioEvento;
window.cancelarRecordatorioEvento     = cancelarRecordatorioEvento;
window.renderPanelNotifStatus         = renderPanelNotifStatus;
window._programarTodosLosRecordatorios = _programarTodosLosRecordatorios;
window._revisarRecordatorios           = _revisarRecordatorios;
window._iniciarSchedulerPagina         = _iniciarSchedulerPagina;
window.mostrarPendientesHoy            = () => _mostrarResumenDiario(true);
