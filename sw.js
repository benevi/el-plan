// Funciona sin conexión: la app se guarda en caché; los vídeos y la IA necesitan internet.
const VERSION = 'elplan-v3.3.1';
const APP = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/ejercicios.js', 'js/datos-base.js', 'js/plan.js', 'js/store.js', 'js/logic.js', 'js/progresion.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-32.png', 'icons/icon.svg'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Archivos de la app: primero la red (para coger cambios), si no hay, la caché.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  // Fuentes y miniaturas: caché primero.
  if (/fonts\.(googleapis|gstatic)\.com|i\.ytimg\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const c = n.clone(); caches.open(VERSION + '-ext').then(x => x.put(req, c)); return n; })));
  }
});
