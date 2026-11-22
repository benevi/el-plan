// Modo sin conexión de Pipos Fitness: caché inmutable por versión.
// - Cada VERSION tiene su propia caché y solo se llena en `install`, todo o nada: se descarga APP
//   entera, cada archivo se comprueba contra su huella (HUELLAS) y solo entonces se guarda. Si un
//   archivo falla o es de otro despliegue, la versión nueva no se instala y sigue la anterior entera.
// - En `fetch` se sirve desde la caché de la versión activa y NUNCA se reescribe: así no se mezclan
//   módulos viejos y nuevos. Lo que no está precargado va a la red sin guardarse. /api/* nunca se guarda.
// - Navegación: solo ./ y ./index.html reciben el index.html de la caché; cualquier otra URL del sitio
//   (p. ej. /LEEME.md o una ruta inventada) va a la red y no toca la caché.
// - La versión nueva espera hasta que la persona toca «Actualizar» (js/nucleo/version.js), salvo que
//   la versión activa sea de antes de este esquema (ver `install`).
// VERSION y HUELLAS las escribe `npm run version` (scripts/version.mjs): no las cambies a mano.
const VERSION = 'pipos-app-ee7f6e58e7ba';
const PREFIJO = 'pipos-app-';
// Huella de cada archivo de APP (la escribe también `npm run version`): la instalación solo acepta estos.
const HUELLAS = {
  './': 'sha256-5GP3IPrNLy3/lapvXWNTmwZow318B7OQX8lrPb3FJBA=',
  './css/areas.css': 'sha256-ZzfU6KU7w/c5tUfsaTBCfqAoUQ9P+jMbXw61jQdPLug=',
  './css/componentes.css': 'sha256-EUqHgW58BSffOwOeNUFtDXMe7cE2F/Yc2EQgRuWjOD8=',
  './css/ejercicios.css': 'sha256-/PRQnpPMx6ibZwR6sm8eqcgnTtgengfu6Q8iYHqngiA=',
  './css/hoy.css': 'sha256-PwBJArs42wCJpzEgWFdrd7nCLLzIVDYgScN9yzJ4/yM=',
  './css/legado.css': 'sha256-RzLFY+MMiNeUeWPtB0q+xrQxN96mSCiAHGk4SOXJS/w=',
  './css/marco.css': 'sha256-Y+9bAghnBzSPmNsyhRjFXl7t4/GluCD4RxuZJC+MI1Y=',
  './css/perfil.css': 'sha256-H6CV+eKgPbraY6G6JDMr/oQCxgTxqjh0DtjxAvgeMgk=',
  './css/progreso.css': 'sha256-75RgtZQWBEvIJXxzCiDfI398Q4tRh2/I5y5mTlPsQN0=',
  './css/sesion.css': 'sha256-/mq1Yh+m88eIsfuWzYeIsi0yTqjGWsezorrfGpAJR/c=',
  './css/tokens.css': 'sha256-IS6xlCpgQu+R18m0qtXYBDDUhNou1isluEAd7ZsmNxc=',
  './fonts/instrument-sans.woff2': 'sha256-rk9YUt7Enho5JjLjCQhuZacfSGX9yMdsX2u2zxJx4AU=',
  './icons/icon-180.png': 'sha256-HL2I8vR+SqWC6lipjg6LtjomGLg7MFrjTv7eaCfJIrg=',
  './icons/icon-192.png': 'sha256-Be3AEg9cCiHRyF7d1KkWSPm2bX6RaxNejm+G6RmOrQg=',
  './icons/icon-32.png': 'sha256-ehKgJyadLbyf/YMOiUOBuFuH8i5nrcDo8UO7fO59SIc=',
  './icons/icon-512.png': 'sha256-032LUQv7ZkjxyypYS8HMoe7iN3WhjR5l2t4LidabtGQ=',
  './icons/icon.svg': 'sha256-sJzu6OtKFXuo/fIR4P5sSXUivY6OWsXJkeVRxMzZ8HM=',
  './icons/logo.svg': 'sha256-5zigwm3jcX26G6wTlAB+IViwYh0i6bnBGth9bvhdROE=',
  './icons/maskable-512.png': 'sha256-tdm98mEZRBgddtEiMnKlHmSGq8rylRfSma5jYNi27yE=',
  './index.html': 'sha256-5GP3IPrNLy3/lapvXWNTmwZow318B7OQX8lrPb3FJBA=',
  './js/areas/ejercicios/buscador.js': 'sha256-dXJ7NSnIWHQf8Vm2yDQuDsr3K0u6F9WTDtPPoVTdy2w=',
  './js/areas/ejercicios/indice.js': 'sha256-ShKymjOA1X2xP6s1HYhFukQl93SMisalAgZCUYYABsI=',
  './js/areas/entrenador/alarma.js': 'sha256-8NnNTcENxRFRXVyWpBfBDSsguazYB2fYLS02C71xgSo=',
  './js/areas/entrenador/checkin.js': 'sha256-TZBdEobi33F/t78OoQOwHufnyXUbCq9OoFU9KZv8INI=',
  './js/areas/entrenador/dia.js': 'sha256-hiCTBmTL6BS5y5mhEmgwNzGpRIKQ66azWBvHYXXNxMA=',
  './js/areas/entrenador/dolor-alto.js': 'sha256-ZYpo0kn5QbAlIY9ayK1BCCIYJTepu+TOogMM9vEJyaI=',
  './js/areas/entrenador/entrenador.js': 'sha256-CVkPFkOxDpa1UCiVEy9zWNXJbsXCM5dptyaYV9Ry7W0=',
  './js/areas/entrenador/ia.js': 'sha256-fvr8n9FfZb7iabSfRwWRgBe7ymwUt/TANrz5ru6+tDs=',
  './js/areas/entrenador/indice.js': 'sha256-Pfgv2bEzQGyHUx3y+ARNS1+0OTZzfLpDGUT9KSoneU8=',
  './js/areas/entrenador/mias.js': 'sha256-WT6OovD/5Kr3pavzS+D52M2Zb0e8W5a3mNAFVkYGxUc=',
  './js/areas/entrenador/plan.js': 'sha256-EHRTIJT524GpemlN61UbxjGhaVmPwAU2FbFvxmnpTJE=',
  './js/areas/entrenador/salud.js': 'sha256-0xHTi5jPLFC+umJPnTQ2VR2HwfyKFf6fzgxl7GZ114g=',
  './js/areas/entrenador/validar.js': 'sha256-jrmsDqLqVueEyVyRv6PzG70NtInTgYzt0F/bhWxEpYg=',
  './js/areas/hoy/indice.js': 'sha256-RFgvoQSMp4ueDCFXYxVCoIxrhLG3UsLa3Sda6dsQb7I=',
  './js/areas/perfil/bienvenida.js': 'sha256-a12JuWIyQEL9s0iRtZ4dUTXyLDKHMvhLxy3HhRx2Yo8=',
  './js/areas/perfil/controles.js': 'sha256-SEK696W9UBpjbhv22oOmXxT0tYsT30bgaJ8nJHqt/JM=',
  './js/areas/perfil/editor.js': 'sha256-J7d5AHXOAM7hzy+XCVq4aMv3+3gZnBazd6WnJUpea2o=',
  './js/areas/perfil/grupo.js': 'sha256-aZDPUEqt80/gqYplOA5dxzPZgXJJK077aPGOVXr+ysU=',
  './js/areas/perfil/indice.js': 'sha256-qBXGtUWcwhWIc/8ODIVxHzKbXOxdcYfZ1qhPpWGWyWM=',
  './js/areas/perfil/nube.js': 'sha256-SKRkAnAR5jm8y/52lWBKDF8G+5GLmttMPjh63/N3gRA=',
  './js/areas/perfil/salud.js': 'sha256-5OBpW+gcCT7dMErp6kBttGwGLXLyLazUblp5TiU4Hq4=',
  './js/areas/progreso/analisis.js': 'sha256-falXFn9d39akfbcNNkeloo5gmWCwr35Gzds19P4h4Do=',
  './js/areas/progreso/graficos.js': 'sha256-VgvMJutMXvZX/U3PrVHZmIwmuAEGQoyT7Y5J+Czyy9g=',
  './js/areas/progreso/indice.js': 'sha256-iCOq3MLVHFgoXWIJWAeMiuQ54lB4rUSTzRAUWi269OY=',
  './js/areas/sesion/indice.js': 'sha256-OaDSkJ5uuCrq1GWHkEs7fSm7rEHlzjNfARnN3NKiwi0=',
  './js/areas/sesion/temporizador.js': 'sha256-az1e7fIsBU5nBBguR4V1VeHATChXNk1NUoLdtAnds+U=',
  './js/arranque.js': 'sha256-ON75atFH/l3yd1yeqf+KTataCTsNGzSrzVqHHNNsl7A=',
  './js/aspecto/movimiento.js': 'sha256-1hBZ7vMNHZpytod7rnPGR5s+ZCGC6D/ebHcQzChHz2Q=',
  './js/aspecto/vida.js': 'sha256-sdljBtKdHRg3T/2wRrW3RL0pt6/rziyIxmcHigkFPfU=',
  './js/datos/constantes.js': 'sha256-N0S9PWBCcP6HMXzcJWsnTL+GqCq+3U41RngvLLSr91s=',
  './js/datos/ejercicios.js': 'sha256-aWB6adSZQxVRW6uFLyoh7WhRC0YezrC9qNcMKrievU0=',
  './js/datos/lesiones.js': 'sha256-KKHm3GuDbEvtRZl7/DbV/BLddSSAMuDoYYuyGI6Cn/8=',
  './js/datos/palabras.js': 'sha256-uNIKPRAkULGKC90yvFVDChjrk/Xymx0tBE8BuAulTF0=',
  './js/main.js': 'sha256-SRDeV4j2sl9gNop3C5pBtR0VFtVe5I49osub/2vIs8Q=',
  './js/nucleo/api.js': 'sha256-KAPQ4sdQPBHZ7OcJxupZYvwa5hIuymT33A+ELBLY48s=',
  './js/nucleo/copia.js': 'sha256-c4HEXt+r9MpgjU2ry0mRCGqZFV3PkRAjxxAIWB8tr2I=',
  './js/nucleo/espejo.js': 'sha256-dbtF3o38cXtXdMI+h3IksN1zkiIT5x54DsHsr7InGuY=',
  './js/nucleo/estado.js': 'sha256-Booo/cTeGQrk3DiTCw+u//fK2USpn5LRr1XsuwRfKO0=',
  './js/nucleo/migracion.js': 'sha256-KU2w3gp99EJQ2i+nP4fZjKihPDMFPybH6i/JMKhZhs0=',
  './js/nucleo/modelo.js': 'sha256-xgsihlJYQ3FqdSoez5pnXzwsilNLsvIN1uJVntgomqg=',
  './js/nucleo/normalizar.js': 'sha256-F7mAtg/MY2YKhRbrtJO+uh5YL+1/XTUyIcQbCxXWvgg=',
  './js/nucleo/rescate.js': 'sha256-nkpOCeQb3GnT6xCB6tNjiXhruP4zeimkSE+h0l5KL2g=',
  './js/nucleo/router.js': 'sha256-+6PmHMap+ovhsvlM6v05KDA/L8vOz3D7NkQoitd2JE0=',
  './js/nucleo/ui.js': 'sha256-aQXJJ+wRvVeO8Muf21WAF5NJISB7efYaADKI+enPtrc=',
  './js/nucleo/version.js': 'sha256-/F3bhqZEQ2dGPs+qYrdQEawe6YM2+5h+/ypcXWxHHiY=',
  './js/reglas/catalogo.js': 'sha256-/iWZIq9XCIUwSRj7vvUoU8swW0K9xZs9RNlHc5oadds=',
  './js/reglas/contexto.js': 'sha256-hSJ2h5r06HIY2BWNC+lZEHoM/8fwCGIj/qSedGzvbQk=',
  './js/reglas/progresion.js': 'sha256-0uNieaVd51H3Pts8hL0N/asG/ne6HIpb7SMOO4V4Zy0=',
  './manifest.webmanifest': 'sha256-wbazL0HrW7ibusPgoPL8ZPKrzfnGp5IV64swKL6tFhs=',
};
const APP = [
  './',
  './css/areas.css',
  './css/componentes.css',
  './css/ejercicios.css',
  './css/hoy.css',
  './css/legado.css',
  './css/marco.css',
  './css/perfil.css',
  './css/progreso.css',
  './css/sesion.css',
  './css/tokens.css',
  './fonts/instrument-sans.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-32.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/logo.svg',
  './icons/maskable-512.png',
  './index.html',
  './js/areas/ejercicios/buscador.js',
  './js/areas/ejercicios/indice.js',
  './js/areas/entrenador/alarma.js',
  './js/areas/entrenador/checkin.js',
  './js/areas/entrenador/dia.js',
  './js/areas/entrenador/dolor-alto.js',
  './js/areas/entrenador/entrenador.js',
  './js/areas/entrenador/ia.js',
  './js/areas/entrenador/indice.js',
  './js/areas/entrenador/mias.js',
  './js/areas/entrenador/plan.js',
  './js/areas/entrenador/salud.js',
  './js/areas/entrenador/validar.js',
  './js/areas/hoy/indice.js',
  './js/areas/perfil/bienvenida.js',
  './js/areas/perfil/controles.js',
  './js/areas/perfil/editor.js',
  './js/areas/perfil/grupo.js',
  './js/areas/perfil/indice.js',
  './js/areas/perfil/nube.js',
  './js/areas/perfil/salud.js',
  './js/areas/progreso/analisis.js',
  './js/areas/progreso/graficos.js',
  './js/areas/progreso/indice.js',
  './js/areas/sesion/indice.js',
  './js/areas/sesion/temporizador.js',
  './js/arranque.js',
  './js/aspecto/movimiento.js',
  './js/aspecto/vida.js',
  './js/datos/constantes.js',
  './js/datos/ejercicios.js',
  './js/datos/lesiones.js',
  './js/datos/palabras.js',
  './js/main.js',
  './js/nucleo/api.js',
  './js/nucleo/copia.js',
  './js/nucleo/espejo.js',
  './js/nucleo/estado.js',
  './js/nucleo/migracion.js',
  './js/nucleo/modelo.js',
  './js/nucleo/normalizar.js',
  './js/nucleo/rescate.js',
  './js/nucleo/router.js',
  './js/nucleo/ui.js',
  './js/nucleo/version.js',
  './js/reglas/catalogo.js',
  './js/reglas/contexto.js',
  './js/reglas/progresion.js',
  './manifest.webmanifest',
];

// Huella SHA-256 (base64) de un cuerpo, en el formato de HUELLAS ('sha256-…').
async function huella(cuerpo) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', cuerpo));
  let txt = '';
  for (const x of b) txt += String.fromCharCode(x);
  return 'sha256-' + btoa(txt);
}

// Descarga APP entera y comprueba cada archivo contra HUELLAS antes de guardar nada. Si un archivo no
// llega o no es el de esta versión (p. ej. un despliegue nuevo a mitad de la descarga), falla todo.
async function precargar() {
  const descargas = await Promise.all(APP.map(async u => {
    // `no-cache`: revalida con el servidor (ETag) para no meter un archivo viejo de la caché HTTP.
    const r = await fetch(new Request(u, { cache: 'no-cache' }));
    if (!r.ok) throw new Error(`Precarga: ${u} respondió ${r.status}`);
    const cuerpo = await r.clone().arrayBuffer();
    let bueno = (await huella(cuerpo)) === HUELLAS[u];
    // index.html: vale también si lleva la meta de esta VERSION (Vercel inyecta su barra en las vistas previas).
    if (!bueno && (u === './' || u === './index.html')) bueno = new TextDecoder().decode(cuerpo).includes(`<meta name="pipos-version" content="${VERSION}">`);
    if (!bueno) throw new Error(`Precarga: ${u} no es el de ${VERSION}`);
    return [u, r];
  }));
  const c = await caches.open(VERSION);
  try {
    for (const [u, r] of descargas) await c.put(u, r);
  } catch (err) {
    await caches.delete(VERSION); // no deja una caché a medias
    throw err;
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await precargar();
    // Si la versión activa es de antes de este esquema (la de `main` o una vista previa con la caché que
    // se reescribía), no hay una versión coherente que conservar: la nueva entra ya.
    const otras = (await caches.keys()).filter(k => k.startsWith(PREFIJO) && k !== VERSION);
    if (!otras.length) await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Borra las demás cachés: las versiones anteriores y las de `main` (elplan-v3.3.0 y su -ext de
    // fuentes y miniaturas de YouTube, que ya no se guardan).
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
    // Avisa a todas las pestañas: las que tienen código de otra versión se recargan (js/nucleo/version.js).
    try { new BroadcastChannel('pipos-version').postMessage({ tipo: 'activada', version: VERSION }); } catch { /* sin BroadcastChannel */ }
  })());
});

self.addEventListener('message', e => {
  const tipo = e.data && e.data.tipo;
  if (tipo === 'actualizar') self.skipWaiting();
  if (tipo === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

const BASE = new URL('./', location).pathname;
// Rutas de la app: solo ./ y ./index.html (las vistas van con #). Otra ruta no puede recibir index.html:
// sus rutas relativas (css/, js/) apuntarían a otro sitio.
const esRutaDeApp = ruta => ruta === BASE || ruta === BASE + 'index.html';

async function desdeCache(clave, peticion) {
  const c = await caches.open(VERSION);
  const guardado = await c.match(clave, { ignoreSearch: true });
  return guardado || fetch(peticion); // fuera de la precarga: red, sin guardar
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.searchParams.has('comprobar-red')) return; // js/arranque.js mira si la red sirve de verdad
  if (req.mode === 'navigate') {
    if (esRutaDeApp(url.pathname)) e.respondWith(desdeCache('./index.html', req));
    return; // otra página del sitio: directa a la red, sin tocar la caché
  }
  e.respondWith(desdeCache(req, req));
});
