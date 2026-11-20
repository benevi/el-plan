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
const VERSION = 'pipos-app-379aaabe0e85';
const PREFIJO = 'pipos-app-';
// Huella de cada archivo de APP (la escribe también `npm run version`): la instalación solo acepta estos.
const HUELLAS = {
  './': 'sha256-ZR9u0doQYmThckBehtx13ToVuwC9xu+vwz7zhlfCl1o=',
  './css/areas.css': 'sha256-Hcx2CJ/w3ZeMyJnVf0t4tm7nG6iYjTOhRiOSERGlKVM=',
  './css/base.css': 'sha256-t1TGiTYMCAdF3xTohIrxh/zYk3KGyGNfcuTwc7YBe7s=',
  './css/componentes.css': 'sha256-qcAHPb9HeaqPt++g/W85R/j7MGEaJSCdwQE1kHdbsFw=',
  './fonts/archivo-latin-var.woff2': 'sha256-igMZE3lrXQl0FyWcAdsDT4ylrAXkBnpr2qdXeeoMjtg=',
  './fonts/outfit-latin-400.woff2': 'sha256-cfAo/SNJmQs/iqZDq+dn6C4PWWvkB65m8ABP8WQSG9s=',
  './fonts/outfit-latin-500.woff2': 'sha256-/Jv/lB3vbZJKcWMr2KkxkFKIcurmQUhE88Nn/5SNkv0=',
  './fonts/outfit-latin-600.woff2': 'sha256-jP4Vwsbebvjv/z7tvVKjg6ye8j1sI/bNn5uDj1833DY=',
  './icons/icon-180.png': 'sha256-nOzi3KiKABC62kNnhiFdsh3mX6gelREfbvHRhGep3O4=',
  './icons/icon-192.png': 'sha256-foQTx5VM5ySe+6Qi13MJHTODZXTTGX/iVnYscHXqzJo=',
  './icons/icon-32.png': 'sha256-oTrPliRoG579txJvPRyUKq+qASRJzSWmY5hnXahC8R4=',
  './icons/icon-512.png': 'sha256-XjFSSSOrZYGSPoT+3glRmdGVlvkHHoExMZmE6B+EeXc=',
  './icons/icon.svg': 'sha256-aUggqLqOaPKt5bJunqc5bLMaaip7+6bHSNPUV7+zjuY=',
  './icons/marca-fondo.svg': 'sha256-2d1uHx/UzqcnPU5eATOl5mle/t4ZeKUj2eMkk1Y0CfE=',
  './icons/maskable-512.png': 'sha256-Wg7q3cskSBqhJrXE7gGW0UIks2gd7DYmselYqumbAcE=',
  './index.html': 'sha256-ZR9u0doQYmThckBehtx13ToVuwC9xu+vwz7zhlfCl1o=',
  './js/arranque.js': 'sha256-FY4jDwXB/NYydVPPBDDohoLfSKNFw2RNc2B1oG8JFio=',
  './js/areas/ejercicios/indice.js': 'sha256-uTRWT8hDPOXYUn9+fRLQ+mOqc5g4vgFLbww55sdtmiI=',
  './js/areas/entrenador/checkin.js': 'sha256-IlY4AVaDrd89BffWGhijVF8Z682h4WcA+BIHz479DOg=',
  './js/areas/entrenador/dia.js': 'sha256-YfkZAhTpuP3GcKDdwMoJjXIDM04XOIoCMpAP14bNMQQ=',
  './js/areas/entrenador/entrenador.js': 'sha256-jBhBRsqQWIN0Zy672D7Ty1G8EB1l/E5UqY2ilj3tnoc=',
  './js/areas/entrenador/ia.js': 'sha256-p5dIPKVzx8wCXEXg9b9AKYiJ+5MywZvD/N9hoRHiFjw=',
  './js/areas/entrenador/indice.js': 'sha256-yvc9o0bo3WKoFNaRjwsSLNT561L8Kdrmm8UBS+Zcgqw=',
  './js/areas/entrenador/plan.js': 'sha256-Fp9qGwQO3l0X4gcZFojFUfYYFwNNAaPlfnMCpKAHc8o=',
  './js/areas/entrenador/validar.js': 'sha256-+waeNOcaEYnWSKcgF7vzj6IlrvUNYgSFkzBXPnCWUag=',
  './js/areas/hoy/indice.js': 'sha256-hdZ5A3usSMnPUwfDc0xogT63lbw24zPrNMTeXrMT8IU=',
  './js/areas/perfil/bienvenida.js': 'sha256-XPPS50dmSZsCWTt39+ySMzSW7XrmjM3pp7Kg5G1VG9U=',
  './js/areas/perfil/indice.js': 'sha256-54pReaL4OYERRNzqlzdrGt/O3SD7dr4L4AI2hHHh+eM=',
  './js/areas/progreso/analisis.js': 'sha256-ERUbRDIg94+Mk5E6y/GcWb4ksCLP5CW1snvghmIv5Gc=',
  './js/areas/progreso/indice.js': 'sha256-scpOueTs/SQUpPn4SiAWlxY5t6BlGpEuuo9pbNOnxU0=',
  './js/areas/sesion/indice.js': 'sha256-U/NDK6SUJ9FrbXyTCBaYj6vxG10cvpvy6LVGXNc+WvE=',
  './js/areas/sesion/temporizador.js': 'sha256-YIkvTD96PCmz3EcQEps19vXzU6QPXxwVs45YqoV1J/s=',
  './js/aspecto/vida.js': 'sha256-/74osN4/qqoNl5u68jwOdl+bDD9Akhk8tropIhhRyT8=',
  './js/datos/constantes.js': 'sha256-8n0nnc8b2TB4qI1A0Idi2e8dcPyVl+8nEL1iiyS7nGg=',
  './js/datos/ejercicios.js': 'sha256-CT+AS9GUwXOvS7hvcjwwVGgf+pskLngV2eoutzDYvbk=',
  './js/datos/lesiones.js': 'sha256-JecIpuwLmKw05yIXyhdLZEJyXxR+H4XWiwjwWcHSFCk=',
  './js/main.js': 'sha256-eNUp/nIgc/JJzO9meWLlVtlTYa+/T4t1MTFOhyH+aIs=',
  './js/nucleo/api.js': 'sha256-ublEKn9V9Xv6ebdJJby9Vg3+EGWlbES4lH/p4hYr+xY=',
  './js/nucleo/espejo.js': 'sha256-dbtF3o38cXtXdMI+h3IksN1zkiIT5x54DsHsr7InGuY=',
  './js/nucleo/estado.js': 'sha256-EodhHygBkxcQAAQpCTpiBDyB65h3GPNCS/YzSSqUH2g=',
  './js/nucleo/modelo.js': 'sha256-80TG9nhKN3LoYAdGpiiceodtJUL0nBgNa3bu2WmgFXI=',
  './js/nucleo/rescate.js': 'sha256-rQNc7KlmEYenoeTzDfYr69q8XI9uO3hbpCzb3NwGstk=',
  './js/nucleo/router.js': 'sha256-yiKB0ffAUd5QdluulRJdzWtzFdD16tRg9CltWm16z2Y=',
  './js/nucleo/ui.js': 'sha256-u4LkYrLJD/uYHweHnTn9lYbB+7YvITO72E2fSkRJBSM=',
  './js/nucleo/version.js': 'sha256-/F3bhqZEQ2dGPs+qYrdQEawe6YM2+5h+/ypcXWxHHiY=',
  './js/reglas/catalogo.js': 'sha256-h+tmDslS2iqHrvlYMthQH4b8jxfiACjC5KrhK+aWRGw=',
  './js/reglas/contexto.js': 'sha256-CN6N1hA9J1o1NrAa7bpg+XaADWQ0yeDc8wkylSJZh5g=',
  './js/reglas/progresion.js': 'sha256-INGcRYa5QoEeZ77v00ScJqD6rO3UFFkhvIepWfkr2GA=',
  './manifest.webmanifest': 'sha256-OmIi8iwSpWN8kvG0ZzJf0w9au0bwrlMnVTMsxQltZPA=',
};
const APP = [
  './',
  './css/areas.css',
  './css/base.css',
  './css/componentes.css',
  './fonts/archivo-latin-var.woff2',
  './fonts/outfit-latin-400.woff2',
  './fonts/outfit-latin-500.woff2',
  './fonts/outfit-latin-600.woff2',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-32.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/marca-fondo.svg',
  './icons/maskable-512.png',
  './index.html',
  './js/arranque.js',
  './js/areas/ejercicios/indice.js',
  './js/areas/entrenador/checkin.js',
  './js/areas/entrenador/dia.js',
  './js/areas/entrenador/entrenador.js',
  './js/areas/entrenador/ia.js',
  './js/areas/entrenador/indice.js',
  './js/areas/entrenador/plan.js',
  './js/areas/entrenador/validar.js',
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
