// ═══════════════════════════════════════════════════════════════
// firebase-messaging-sw.js  —  RAÍZ del proyecto (junto a index.html)
// Service Worker para Firebase Cloud Messaging (FCM)
// Club Campestre Fitness · notificaciones push al coordinador
// ═══════════════════════════════════════════════════════════════

// ── 1. Importar Firebase desde CDN (versión compat para SW) ────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── 2. Inicializar Firebase con la misma config del proyecto ───
firebase.initializeApp({
  apiKey:            "AIzaSyC3_83rzlemRzDEr5rbQoYTzvLock5xkjE",
  authDomain:        "fitness-campestre-e218c.firebaseapp.com",
  databaseURL:       "https://fitness-campestre-e218c-default-rtdb.firebaseio.com",
  projectId:         "fitness-campestre-e218c",
  storageBucket:     "fitness-campestre-e218c.firebasestorage.app",
  messagingSenderId: "813526273487",
  appId:             "1:813526273487:web:3a3643ae3d95d44d4a16ba"
});

const messaging = firebase.messaging();

// ── 3. Notificaciones en segundo plano (app cerrada / minimizada) ──
// FCM llama a este handler cuando llega un mensaje push y la app NO está abierta.
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Mensaje en background recibido:', payload);

  const { title, body, icon, data } = payload.notification || {};
  const notifTitle = title || '📅 Recordatorio Fitness';
  const notifOpts  = {
    body:    body  || 'Tienes un evento próximo.',
    icon:    icon  || 'img/icon-192-any.png',
    badge:        '/img/icon-96.png',
    tag:          data?.eventoId || 'fitness-recordatorio',
    renotify:     true,
    requireInteraction: true,          // permanece hasta que el usuario la toca
    data:         data || {},
    actions: [
      { action: 'ver',    title: '👁 Ver evento' },
      { action: 'cerrar', title: '✕ Cerrar'      }
    ]
  };

  return self.registration.showNotification(notifTitle, notifOpts);
});

// ── 4. Notificaciones locales programadas (Opción A integrada) ──
// Cuando el SW recibe un mensaje interno de tipo 'PROGRAMAR_RECORDATORIO',
// almacena el evento y lanza un setTimeout para la notificación local.
// Esto funciona con la app abierta O con el SW activo en background.
const recordatoriosPendientes = new Map(); // eventoId → timeoutId

self.addEventListener('message', event => {
  const msg = event.data;
  if (!msg || !msg.tipo) return;

  // ── Programar recordatorio local ──────────────────────────────
  if (msg.tipo === 'PROGRAMAR_RECORDATORIO') {
    const { eventoId, nombre, fechaHora, minAntes } = msg;
    if (!eventoId || !fechaHora) return;

    // Cancelar si ya existía uno (timer o notificación con trigger) para este evento
    if (recordatoriosPendientes.has(eventoId)) {
      clearTimeout(recordatoriosPendientes.get(eventoId));
      recordatoriosPendientes.delete(eventoId);
    }

    const ahora      = Date.now();
    const msEvento   = new Date(fechaHora).getTime();
    const msDisparo  = msEvento - (minAntes || 30) * 60 * 1000;
    const delay      = msDisparo - ahora;

    if (delay <= 0) {
      console.log('[SW] Recordatorio ya pasado, ignorando:', nombre);
      return;
    }

    const opciones = {
      body:    `${nombre} comienza en ${minAntes} min`,
      icon:    'img/icon-192-any.png',
      badge:   '/img/icon-96.png',
      tag:     'rec_' + eventoId,
      renotify: true,
      requireInteraction: true,
      data:    { eventoId, url: '/' },
      actions: [
        { action: 'ver',    title: '👁 Abrir app' },
        { action: 'cerrar', title: '✕ Cerrar'     }
      ]
    };

    // ── Vía confiable: Notification Triggers API (sobrevive al cierre del SW) ──
    // El navegador agenda la notificación; funciona aunque la app/SW estén cerrados.
    // Soportado en Chrome/Edge de escritorio y Android. iOS/Firefox usan el fallback.
    if ('showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') {
      self.registration.showNotification('📅 Recordatorio · Fitness', {
        ...opciones,
        showTrigger: new TimestampTrigger(msDisparo)
      });
      console.log(`[SW] Recordatorio agendado con TimestampTrigger: "${nombre}" para ${new Date(msDisparo).toLocaleString()}`);
    } else {
      // ── Fallback: setTimeout (solo dispara mientras el SW siga vivo) ──
      const tid = setTimeout(() => {
        self.registration.showNotification('📅 Recordatorio · Fitness', opciones);
        recordatoriosPendientes.delete(eventoId);
      }, delay);
      recordatoriosPendientes.set(eventoId, tid);
      console.log(`[SW] Recordatorio con setTimeout (fallback): "${nombre}" en ${Math.round(delay/60000)} min`);
    }

    // Confirmar al cliente
    event.source?.postMessage({ tipo: 'RECORDATORIO_CONFIRMADO', eventoId, delay });
  }

  // ── Cancelar recordatorio ─────────────────────────────────────
  if (msg.tipo === 'CANCELAR_RECORDATORIO') {
    const { eventoId } = msg;
    // 1. Cancelar timer pendiente (fallback)
    if (recordatoriosPendientes.has(eventoId)) {
      clearTimeout(recordatoriosPendientes.get(eventoId));
      recordatoriosPendientes.delete(eventoId);
    }
    // 2. Cancelar notificación agendada con TimestampTrigger (aún no disparada)
    if (self.registration.getNotifications) {
      self.registration.getNotifications({ tag: 'rec_' + eventoId, includeTriggered: true })
        .then(lista => lista.forEach(n => n.close()))
        .catch(() => {});
    }
    console.log('[SW] Recordatorio cancelado:', eventoId);
  }
});

// ── 5. Acción al tocar la notificación ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'cerrar') return;

  // Abrir o enfocar la app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      const appUrl = self.location.origin + '/';
      // Si ya hay una ventana abierta, enfocarla
      const ventana = lista.find(c => c.url.startsWith(appUrl));
      if (ventana) return ventana.focus();
      // Si no, abrir una nueva
      return clients.openWindow(appUrl);
    })
  );
});

// ── 6. Caché de la app ─────────────────────────────────────────
// Antes: TODO GET pasaba por aquí, incluidas las peticiones a Firebase (base de datos, login)
// y las librerías del CDN; los .js/.css/.html se pedían siempre a la red sin guardarse,
// así que con poca señal la app esperaba hasta que el navegador se rindiera y sin
// internet no abría. Ahora:
//   • Firebase y cualquier otro servicio externo: el SW no se mete (van directo a la red).
//   • Librerías con versión fija en la URL (gstatic/firebasejs, cdnjs, fuentes): primero caché.
//   • Archivos propios: primero la red (cambios inmediatos); si en 4 s no contesta y hay
//     copia guardada, se usa la copia y la red sigue actualizándola por detrás.
const CACHE_VERSION = 'fitness-ctrl-v6';
const ESPERA_RED_MS = 4000;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function esLibreriaVersionada(url) {
  return (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) ||
         (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.indexOf('/ajax/libs/') === 0) ||
         url.hostname === 'fonts.gstatic.com';
}

function guardarEnCache(req, resp) {
  if (resp && (resp.ok || resp.type === 'opaque')) {
    const copia = resp.clone();
    caches.open(CACHE_VERSION).then(c => c.put(req, copia)).catch(() => {});
  }
  return resp;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (!esLibreriaVersionada(url)) return;          // Firebase, Google, etc.: sin intervenir
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => guardarEnCache(req, r)))
    );
    return;
  }

  const esCodigo = req.mode === 'navigate' || /\.(js|css|html)$/.test(url.pathname) || url.pathname.endsWith('/');
  const red = fetch(req, esCodigo ? { cache: 'no-store' } : undefined).then(r => guardarEnCache(req, r));
  red.catch(() => {});
  e.respondWith(
    caches.match(req, { ignoreSearch: esCodigo }).then(hit => {
      if (!hit) return red;
      const plazo = new Promise(res => setTimeout(() => res(hit), ESPERA_RED_MS));
      return Promise.race([red.catch(() => hit), plazo]);
    })
  );
});
