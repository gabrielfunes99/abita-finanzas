/* Service worker: la app abre sin red (los datos siempre se piden en vivo a Apps Script). */
var V = 'abita-7c809f7991';
var SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
var CDN = /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com\/firebasejs)\//;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  // Archivos propios: primero la red (para ver cambios al instante), si no hay red, la copia guardada.
  if (new URL(r.url).origin === location.origin) {
    e.respondWith(fetch(r).then(function (res) {
      var copy = res.clone(); caches.open(V).then(function (c) { c.put(r, copy); }); return res;
    }).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
    return;
  }
  // Chart.js, Firebase y fuentes: copia guardada, si no, red.
  if (CDN.test(r.url)) {
    e.respondWith(caches.match(r).then(function (hit) {
      return hit || fetch(r).then(function (res) { var copy = res.clone(); caches.open(V).then(function (c) { c.put(r, copy); }); return res; });
    }));
  }
  // Todo lo demás (login de Google, API) va directo a la red.
});
