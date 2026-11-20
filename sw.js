// Modo sin conexión de Pipos Fitness.
// - Guarda la app al instalarse (lista de abajo) y todo lo demás del mismo sitio la primera vez que se pide.
// - Sirve primero lo guardado y lo actualiza por detrás, así una sesión ya creada funciona en el gimnasio sin red.
// - /api/* nunca se guarda: la IA siempre va a la red.
// Al cambiar archivos, sube VERSION para que los móviles descarguen la versión nueva.
const VERSION = 'pipos-5.3.1';
const APP = [
  './',
  './css/areas.css',
  './css/base.css',
  './css/componentes.css',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-32.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/marca-fondo.svg',
  './icons/maskable-512.png',
  './index.html',
  './js/areas/ejercicios/indice.js',
  './js/areas/entrenador/entrenador.js',
  './js/areas/entrenador/indice.js',
  './js/areas/hoy/indice.js',
  './js/areas/perfil/bienvenida.js',
  './js/areas/perfil/indice.js',
  './js/areas/progreso/analisis.js',
  './js/areas/progreso/indice.js',
  './js/areas/sesion/indice.js',
  './js/areas/sesion/temporizador.js',
  './js/aspecto/vida.js',
  './js/datos/constantes.js',
  './js/datos/ejercicios.js',
  './js/datos/lesiones.js',
  './js/main.js',
  './js/nucleo/api.js',
  './js/nucleo/espejo.js',
  './js/nucleo/estado.js',
  './js/nucleo/modelo.js',
  './js/nucleo/rescate.js',
  './js/nucleo/router.js',
  './js/nucleo/ui.js',
  './js/reglas/catalogo.js',
  './js/reglas/contexto.js',
  './js/reglas/generador.js',
  './js/reglas/progresion.js',
  './manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const mismo = url.origin === location.origin;
  const fuentes = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mismo && !fuentes) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const clave = e.request.mode === 'navigate' ? './index.html' : e.request;
    const guardado = await c.match(clave, { ignoreSearch: mismo });
    const red = fetch(e.request).then(r => { if (r.ok && e.request.mode !== 'navigate') c.put(e.request, r.clone()); else if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => guardado);
    return guardado || red;
  }));
});
