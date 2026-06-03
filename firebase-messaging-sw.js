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
    icon:    icon  || '/img/icon-192.png',
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

    // Cancelar si ya existía uno para este evento
    if (recordatoriosPendientes.has(eventoId)) {
      clearTimeout(recordatoriosPendientes.get(eventoId));
    }

    const ahora      = Date.now();
    const msEvento   = new Date(fechaHora).getTime();
    const msDisparo  = msEvento - (minAntes || 30) * 60 * 1000;
    const delay      = msDisparo - ahora;

    if (delay <= 0) {
      console.log('[SW] Recordatorio ya pasado, ignorando:', nombre);
      return;
    }

    console.log(`[SW] Recordatorio programado: "${nombre}" en ${Math.round(delay/60000)} min`);

    const tid = setTimeout(() => {
      self.registration.showNotification('📅 Recordatorio · Fitness', {
        body:    `${nombre} comienza en ${minAntes} min`,
        icon:    '/img/icon-192.png',
        badge:   '/img/icon-96.png',
        tag:     'rec_' + eventoId,
        renotify: true,
        requireInteraction: true,
        data:    { eventoId, url: '/' },
        actions: [
          { action: 'ver',    title: '👁 Abrir app' },
          { action: 'cerrar', title: '✕ Cerrar'     }
        ]
      });
      recordatoriosPendientes.delete(eventoId);
    }, delay);

    recordatoriosPendientes.set(eventoId, tid);

    // Confirmar al cliente
    event.source?.postMessage({ tipo: 'RECORDATORIO_CONFIRMADO', eventoId, delay });
  }

  // ── Cancelar recordatorio ─────────────────────────────────────
  if (msg.tipo === 'CANCELAR_RECORDATOSIO') {
    const { eventoId } = msg;
    if (recordatoriosPendientes.has(eventoId)) {
      clearTimeout(recordatoriosPendientes.get(eventoId));
      recordatoriosPendientes.delete(eventoId);
      console.log('[SW] Recordatorio cancelado:', eventoId);
    }
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

// ── 6. Caché básico heredado (mantiene compatibilidad con pwa.js) ──
const CACHE_VERSION = 'fitness-ctrl-v5-notif';

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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // JS/CSS/HTML siempre de red (garantiza cambios inmediatos)
  if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html') || url.includes('index')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Imágenes y fuentes: caché normal
  e.respondWith(
    fetch(e.request).then(r => {
      const rc = r.clone();
      caches.open(CACHE_VERSION).then(c => c.put(e.request, rc));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
