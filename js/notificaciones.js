// ═══════════════════════════════════════════════════════════════
// js/notificaciones.js  —  Notificaciones push · Fitness Campestre
// Coordinador: solicita permiso, registra token FCM en Firebase,
// programa recordatorios configurables por evento.
// ═══════════════════════════════════════════════════════════════

// ── VAPID public key ─────────────────────────────────────────
// Generada en Firebase Console → Project Settings → Cloud Messaging
// → Web Push certificates → Generate key pair → copiar "Key pair"
// ⚠️  REEMPLAZA este valor con tu VAPID key real antes de subir.
const FCM_VAPID_KEY = 'BNCbWz9IgFw2mBfN3ChI9zekBl3Vvz-16Ad2ckicHOT8U12IMh1a1Jf4bBIvQfLqUrJfWUyjyg5MQACaqKd9XBQ';

// ── Estado del módulo ────────────────────────────────────────
let _fcmMessaging   = null;   // instancia firebase.messaging()
let _swRegistration = null;   // SW registration activo
let _fcmToken       = null;   // token FCM de este dispositivo

// ═══════════════════════════════════════════════════════════════
// 1. INICIALIZACIÓN  (llamar desde init() en app principal)
// ═══════════════════════════════════════════════════════════════
async function initNotificaciones() {
  // Solo para coordinador
  // Verificar rol desde localStorage (admin o usuario = coordinador)
  const _rolSesion = localStorage.getItem("fc_ses_rol");
  if (!_rolSesion || _rolSesion === "instructor") return;

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[Notif] Este navegador no soporta notificaciones push.');
    return;
  }

  try {
    // Registrar el SW real (reemplaza el Blob de pwa.js si existiera)
    _swRegistration = await navigator.serviceWorker.register(
      new URL('firebase-messaging-sw.js', location.href).pathname,
      { scope: new URL('./', location.href).pathname }
    );
    console.log('[Notif] Service Worker registrado:', _swRegistration.scope);

    // Escuchar mensajes de confirmación del SW
    navigator.serviceWorker.addEventListener('message', _onSwMessage);

    // Inicializar Firebase Messaging si está disponible
    if (typeof firebase !== 'undefined' && firebase.messaging) {
      _fcmMessaging = firebase.messaging();

      // Mensajes cuando la app está en PRIMER PLANO
      _fcmMessaging.onMessage(payload => {
        console.log('[Notif] Mensaje en foreground:', payload);
        const { title, body } = payload.notification || {};
        _mostrarToastNotif(title || '📅 Recordatorio', body || '');
      });
    }

    // Solicitar permiso y obtener token FCM
    await _solicitarPermiso();

    // Programar recordatorios de todos los eventos futuros
    _programarTodosLosRecordatorios();

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
    const acepto = await _mostrarDialogoPermiso();
    if (!acepto) return false;

    const resultado = await Notification.requestPermission();
    if (resultado !== 'granted') {
      if (typeof showToast === 'function')
        showToast('Notificaciones no activadas. Puedes activarlas en ajustes del navegador.', 'warn');
      return false;
    }
  }

  await _obtenerTokenFCM();
  return true;
}

async function _obtenerTokenFCM() {
  if (!_fcmMessaging || !FCM_VAPID_KEY || FCM_VAPID_KEY === 'TU_VAPID_PUBLIC_KEY_AQUI') {
    // Sin VAPID key configurada: modo solo-local (SW maneja recordatorios con setTimeout)
    console.log('[Notif] Modo local activo (VAPID key no configurada).');
    return;
  }

  try {
    const token = await _fcmMessaging.getToken({ vapidKey: FCM_VAPID_KEY });
    if (!token) return;

    _fcmToken = token;
    console.log('[Notif] Token FCM obtenido:', token.substring(0, 20) + '...');

    // Guardar token en Firebase para uso futuro de push remoto
    if (typeof firebase !== 'undefined' && firebase.database) {
      const uid = firebase.auth().currentUser?.uid || 'coordinador';
      await firebase.database().ref(`fitness/notif_tokens/${uid}`).set({
        token,
        dispositivo: navigator.userAgent.substring(0, 80),
        actualizado: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('[Notif] Error obteniendo token FCM:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. PROGRAMAR RECORDATORIOS DE EVENTOS
// ═══════════════════════════════════════════════════════════════

// Llama al iniciar la app — programa todos los eventos futuros pendientes
function _programarTodosLosRecordatorios() {
  if (!_swRegistration || !_swRegistration.active) return;

  const eventos  = typeof _cargarEventos === 'function' ? _cargarEventos() : _obtenerEventosLocales();
  const hoyStr   = new Date().toISOString().slice(0, 10);

  eventos
    .filter(e => e.estado !== 'cancelado' && e.fecha >= hoyStr && e.horaIni)
    .forEach(e => _programarRecordatorio(e));
}

// Programar (o reprogramar) el recordatorio de UN evento
// Llama a esta función desde guardarEvento()

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

  // minRecordatorio viene del campo del modal (5, 10, 15, 30, 60 min)
  const minAntes  = parseInt(evento.minRecordatorio) || 15;
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
// Llama a esta función desde eliminarEvento() y al cambiar estado a 'cancelado'
function cancelarRecordatorioEvento(eventoId) {
  const sw = _swRegistration?.active;
  if (!sw || !eventoId) return;
  sw.postMessage({ tipo: 'CANCELAR_RECORDATORIO', eventoId });
}

// ═══════════════════════════════════════════════════════════════
// 4. ESCUCHAR MENSAJES DEL SERVICE WORKER
// ═══════════════════════════════════════════════════════════════
function _onSwMessage(event) {
  const msg = event.data;
  if (!msg || !msg.tipo) return;

  if (msg.tipo === 'RECORDATORIO_CONFIRMADO') {
    const mins = Math.round(msg.delay / 60000);
    console.log(`[Notif] ✅ Recordatorio confirmado para evento ${msg.eventoId} en ~${mins} min`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 5. DIÁLOGO DE PERMISO (UI amigable antes del prompt del navegador)
// ═══════════════════════════════════════════════════════════════
function _mostrarDialogoPermiso() {
  return new Promise(resolve => {
    // Si existe un modal genérico en la app, usarlo; si no, usar confirm()
    if (typeof mostrarModal === 'function') {
      mostrarModal({
        titulo:  '🔔 Activar recordatorios',
        mensaje: 'Recibe notificaciones antes de tus eventos programados, aunque la app esté en segundo plano.',
        btnOk:    'Activar',
        btnCancel:'Ahora no',
        onOk:    () => resolve(true),
        onCancel:() => resolve(false)
      });
    } else {
      const ok = confirm('¿Activar notificaciones para recordatorios de eventos?');
      resolve(ok);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 6. TOAST DE NOTIFICACIÓN EN PRIMER PLANO
// ═══════════════════════════════════════════════════════════════
function _mostrarToastNotif(titulo, cuerpo) {
  // Usar showToast de la app si existe
  if (typeof showToast === 'function') {
    showToast(`${titulo}: ${cuerpo}`, 'info', 6000);
    return;
  }
  // Fallback: notificación nativa directa (app abierta)
  if (Notification.permission === 'granted') {
    new Notification(titulo, { body: cuerpo, icon: '/img/icon-192.png' });
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. HELPER: obtener eventos desde localStorage si no hay función global
// ═══════════════════════════════════════════════════════════════
function _obtenerEventosLocales() {
  try {
    return JSON.parse(localStorage.getItem('fitness_eventos') || '[]');
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// 8. PANEL DE ESTADO (para mostrar en ajustes del coordinador)
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
          ${_fcmToken ? 'Push remoto activo (FCM)' : 'Modo local (recordatorios programados)'}
        </div>
      </div>
      ${permiso !== 'granted'
        ? `<button onclick="initNotificaciones()" 
             style="font-size:.7rem;padding:.3rem .6rem;border-radius:6px;
                    background:var(--neon);color:#000;border:none;cursor:pointer;font-weight:600;">
             Activar
           </button>`
        : ''}
    </div>`;
}

// Exponer funciones públicas globalmente
window.programarRecordatorioEvento = programarRecordatorioEvento;
window.cancelarRecordatorioEvento  = cancelarRecordatorioEvento;
window.initNotificaciones           = initNotificaciones;

// ═══════════════════════════════════════════════════════════════
// 9. AUTO-ARRANQUE al cargar la página (si ya hay sesión activa)
// ═══════════════════════════════════════════════════════════════
(function _autoIniciarNotificaciones() {
  const rol = localStorage.getItem('fc_ses_rol');
  const ttl = parseInt(localStorage.getItem('fc_ses_ttl') || '0');
  // Solo si hay sesión de coordinador vigente
  if ((rol === 'admin' || rol === 'usuario') && ttl > Date.now()) {
    // Esperar a que todos los scripts estén cargados
    if (document.readyState === 'complete') {
      setTimeout(initNotificaciones, 2500);
    } else {
      window.addEventListener('load', () => setTimeout(initNotificaciones, 2500));
    }
  }
})();

// ═══════════════════════════════════════════════════════════════
// 10. LISTENER AUTOMÁTICO para notas con aviso (fc_agenda)
// Intercepta cuando guardarNotaMob() guarda en localStorage
// sin necesidad de modificar app.js
// ═══════════════════════════════════════════════════════════════
(function _escucharCambiosAgenda() {
  // Sobrescribir localStorage.setItem para detectar cambios en fc_agenda
  const _setItemOriginal = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function(key, value) {
    _setItemOriginal(key, value);

    // Solo nos interesa fc_agenda
    if (key !== 'fc_agenda') return;

    try {
      const notas = JSON.parse(value || '[]');
      const ahora = Date.now();

      notas.forEach(nota => {
        // Soportar tanto ts (formato ISO) como fecha+hora separados
        let fechaHora = null;
        if (nota.ts) {
          fechaHora = nota.ts; // '2026-06-03T12:11:00'
        } else if (nota.fecha && nota.hora) {
          fechaHora = nota.fecha + 'T' + nota.hora + ':00';
        }
        if (!fechaHora) return;

        // Leer el aviso del campo correcto (mob-nota-recordatorio guarda en 'recordatorio' o 'aviso')
        const minAntes = parseInt(nota.recordatorio || nota.aviso || nota.minRecordatorio) || 0;
        if (!minAntes) return; // Sin aviso configurado

        const msEvento = new Date(fechaHora).getTime();
        const msDisparo = msEvento - minAntes * 60 * 1000;
        if (msDisparo <= ahora) return;

        // Programar recordatorio usando el sistema de notificaciones
        const notaComoEvento = {
          id:              nota.id || ('nota_' + Date.now()),
          nombre:          nota.texto || nota.titulo || 'Nota de agenda',
          fecha:           fechaHora.slice(0, 10),
          horaIni:         fechaHora.slice(11, 16),
          minRecordatorio: minAntes,
          estado:          nota.completada ? 'cancelado' : 'planificado'
        };

        if (typeof programarRecordatorioEvento === 'function') {
          programarRecordatorioEvento(notaComoEvento);
        }
      });
    } catch(e) {
      console.warn('[Notif] Error procesando fc_agenda:', e);
    }
  };
})();
