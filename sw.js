/* sw.js — YA NO SE USA EN FITNESS.
   Este archivo era el service worker de Control Gerencia (gd-v80) y se coló en este repositorio.
   Si algún equipo todavía lo tiene registrado, esta versión lo desinstala solo, borra las cachés "gd-*"
   (las de Gerencia) y recarga la pantalla. Después Fitness usa únicamente firebase-messaging-sw.js. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.filter(function (k) { return /^gd-/.test(k); }).map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      var cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(function (c) { try { c.navigate(c.url); } catch (err) {} });
    } catch (err) {}
  })());
});
