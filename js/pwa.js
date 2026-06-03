// ═══ PWA — Service Worker + Botón Instalar  (versión con notificaciones) ═══
// CAMBIO vs versión anterior: ya NO genera un SW como Blob.
// En su lugar registra /firebase-messaging-sw.js que incluye:
//   • caché offline (igual que antes)
//   • Firebase Cloud Messaging para notificaciones push
//   • Programación de recordatorios locales
// ════════════════════════════════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  // Registrar el SW real (debe estar en la raíz del sitio)
  navigator.serviceWorker
    .register(new URL('firebase-messaging-sw.js', location.href).pathname, { scope: new URL('./', location.href).pathname })
    .then(reg => {
      console.log('[PWA] Service Worker registrado · scope:', reg.scope);
      // Inicializar notificaciones una vez el SW esté listo
      if (typeof initNotificaciones === 'function') {
        navigator.serviceWorker.ready.then(() => initNotificaciones());
      }
    })
    .catch(err => {
      console.warn('[PWA] Error al registrar SW:', err);
      // Fallback: SW en memoria (sin notificaciones push, solo caché básico)
      const SW_VERSION = 'v5';
      const swCode = `
        const CACHE = 'fitness-ctrl-${SW_VERSION}';
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', e => {
          e.waitUntil(
            caches.keys().then(keys =>
              Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
            ).then(() => self.clients.claim())
          );
        });
        self.addEventListener('fetch', e => {
          if (e.request.method !== 'GET') return;
          const url = e.request.url;
          if (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html') || url.includes('index')) {
            e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
            return;
          }
          e.respondWith(
            fetch(e.request).then(r => {
              const rc = r.clone();
              caches.open(CACHE).then(c => c.put(e.request, rc));
              return r;
            }).catch(() => caches.match(e.request))
          );
        });
      `;
      const blob = new Blob([swCode], { type: 'application/javascript' });
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
    });
}

// ── Botón "Instalar" en la barra superior (sin cambios) ──────────────────────
let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  if (document.getElementById('btn-instalar')) return;

  const b = document.createElement('button');
  b.id        = 'btn-instalar';
  b.className = 'btn no-print';
  b.style.cssText = 'background:#0d2218;color:var(--neon);border:1px solid var(--verde);' +
                    'font-size:.65rem;padding:5px 8px;white-space:nowrap;flex-shrink:0;';
  b.innerHTML = '<svg class="ico" viewBox="0 0 20 20">' +
    '<rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/>' +
    '<circle cx="10" cy="15.5" r="1" fill="currentColor"/>' +
    '<polyline points="8,7 10,5 12,7" stroke="currentColor" stroke-width="1.3" fill="none" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
    '<line x1="10" y1="5" x2="10" y2="11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg> Instalar';
  b.title   = 'Instalar en pantalla de inicio';
  b.onclick = async () => {
    if (!_pwaPrompt) return;
    _pwaPrompt.prompt();
    const { outcome } = await _pwaPrompt.userChoice;
    if (outcome === 'accepted') {
      b.remove();
      // Activar notificaciones justo después de instalar
      setTimeout(() => {
        if (typeof initNotificaciones === 'function') initNotificaciones();
      }, 1500);
    }
    _pwaPrompt = null;
  };

  const hr = document.querySelector('.hr');
  if (hr) hr.insertBefore(b, hr.firstChild);
});

window.addEventListener('appinstalled', () => {
  const b = document.getElementById('btn-instalar');
  if (b) b.remove();
  _pwaPrompt = null;
});
