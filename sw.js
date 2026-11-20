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
const VERSION = 'pipos-app-5d8b9c0547fd';
const PREFIJO = 'pipos-app-';
// Huella de cada archivo de APP (la escribe también `npm run version`): la instalación solo acepta estos.
const HUELLAS = {
  './': 'sha256-KoW/slOblLaEVL5S83DSMgdWI6kQGsYgsiXoViByFtU=',
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
  './index.html': 'sha256-KoW/slOblLaEVL5S83DSMgdWI6kQGsYgsiXoViByFtU=',
  './js/arranque.js': 'sha256-FY4jDwXB/NYydVPPBDDohoLfSKNFw2RNc2B1oG8JFio=',
  './js/areas/ejercicios/indice.js': 'sha256-1dNwpWu3kCieSdNnYOFKfqrH7+iu0Mumcz4HQ/hOL2A=',
  './js/areas/entrenador/alarma.js': 'sha256-KJsg+UPR2XZ9/vag66O7rtpJEjqv4AV7pKUwSOkqJsg=',
  './js/areas/entrenador/checkin.js': 'sha256-qC1Hqnfg2TMsDP+tpLBoBLszymlrosSH8W4bpgvtLA0=',
  './js/areas/entrenador/dia.js': 'sha256-LEBUNhZAbllX/6jVssbff5f3jPGH/787LVHaCoBvvLI=',
  './js/areas/entrenador/dolor-alto.js': 'sha256-ZYpo0kn5QbAlIY9ayK1BCCIYJTepu+TOogMM9vEJyaI=',
  './js/areas/entrenador/entrenador.js': 'sha256-XMLl9LtFqq2hdFlVANXvw/0AaROWEnJvBygGDlzP8OU=',
  './js/areas/entrenador/ia.js': 'sha256-buXH7cI+c6uDYTpA+WNS+8ZHQozE+m5jVE0V0V6tqJU=',
  './js/areas/entrenador/indice.js': 'sha256-o+OGAIhDu/fbTR0mhZij0o1REJsZEzK9PIzKviYcY3s=',
  './js/areas/entrenador/plan.js': 'sha256-Fp9qGwQO3l0X4gcZFojFUfYYFwNNAaPlfnMCpKAHc8o=',
  './js/areas/entrenador/salud.js': 'sha256-JzSuKK4QSVHpa2v9k26mLISLoBPPmf25Z2sxHky+P3I=',
  './js/areas/entrenador/validar.js': 'sha256-r5k0LlRZG2zsva94WoU7yU01hIpNoMtZ+q1eD76UpTs=',
  './js/areas/hoy/indice.js': 'sha256-tYefVdtW6frkvFiaepXFE4xCOR9ttqAk1MpmnSFCBgo=',
  './js/areas/perfil/bienvenida.js': 'sha256-NH80sTMDb7ZPwvfXOladJP1tOAPd1HwkNmKIQyqWCuU=',
  './js/areas/perfil/indice.js': 'sha256-qWeMiaOxhssMR0qqzZEnTBW+rp3n8QGFtsHRBRbXkcU=',
  './js/areas/perfil/nube.js': 'sha256-fIbFFHjClReMFn/F2or7At0yk0pqUxPa+4g29y/1Jjg=',
  './js/areas/perfil/salud.js': 'sha256-w3W4N+CSn37NbqqHzk6RgoL+Qy/HoMLE6LsGo4+7swo=',
  './js/areas/progreso/analisis.js': 'sha256-ERUbRDIg94+Mk5E6y/GcWb4ksCLP5CW1snvghmIv5Gc=',
  './js/areas/progreso/indice.js': 'sha256-0PCKCaJQOr3a5D3wk0UPSkeblEodUXvn97VpL709Rto=',
  './js/areas/sesion/indice.js': 'sha256-aAKCxtCQrrZ6DL8CfuZ1gOCLYYD6twEhETcP+hBil8g=',
  './js/areas/sesion/temporizador.js': 'sha256-YIkvTD96PCmz3EcQEps19vXzU6QPXxwVs45YqoV1J/s=',
  './js/aspecto/vida.js': 'sha256-/74osN4/qqoNl5u68jwOdl+bDD9Akhk8tropIhhRyT8=',
  './js/datos/constantes.js': 'sha256-N0S9PWBCcP6HMXzcJWsnTL+GqCq+3U41RngvLLSr91s=',
  './js/datos/ejercicios.js': 'sha256-kRv+nC9CCUOtDMCNGDNRNvxAHs6FRyeh8nCmD50sIso=',
  './js/datos/lesiones.js': 'sha256-H+rawcjrPpMYPKDzoKWMXW5z9HJccoKsC9ISKtzRdSQ=',
  './js/datos/palabras.js': 'sha256-uNIKPRAkULGKC90yvFVDChjrk/Xymx0tBE8BuAulTF0=',
  './js/main.js': 'sha256-HGRZ9zo5/U73KCvqEE+FWLtC90SEXTpuha+lhoPhgi8=',
  './js/nucleo/api.js': 'sha256-v9hN8+9rp5/5hfnDIG5bVauFFdL0Y2ISdQNjUxBp0TE=',
  './js/nucleo/copia.js': 'sha256-kwGnIJi3iwkG+qM+48Mzmbr2QkE05BOo2zCOQ5WJuP0=',
  './js/nucleo/espejo.js': 'sha256-dbtF3o38cXtXdMI+h3IksN1zkiIT5x54DsHsr7InGuY=',
  './js/nucleo/estado.js': 'sha256-KKEf1nrPgnUR3dZjuCn2eHYOkAiu312TjeGYK1FhTfg=',
  './js/nucleo/migracion.js': 'sha256-KU2w3gp99EJQ2i+nP4fZjKihPDMFPybH6i/JMKhZhs0=',
  './js/nucleo/modelo.js': 'sha256-bgeaBAo/mFINv+3bTNAnAaFnZ4ZRn5kJadGPoFnZ/mI=',
  './js/nucleo/normalizar.js': 'sha256-skv0vP4zJCKGdoh8fH9DkDodP7j8qSZUJT9rL+3q6SI=',
  './js/nucleo/rescate.js': 'sha256-nkpOCeQb3GnT6xCB6tNjiXhruP4zeimkSE+h0l5KL2g=',
  './js/nucleo/router.js': 'sha256-yMtffyf5KI/fj2UoTGk+rBMohWY7aHuXofjRXEbyluQ=',
  './js/nucleo/ui.js': 'sha256-u4LkYrLJD/uYHweHnTn9lYbB+7YvITO72E2fSkRJBSM=',
  './js/nucleo/version.js': 'sha256-/F3bhqZEQ2dGPs+qYrdQEawe6YM2+5h+/ypcXWxHHiY=',
  './js/reglas/catalogo.js': 'sha256-EsPEiWQjkndM6gsik32/ocVD4UqGWSrfZh0u8sNJxPM=',
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
  './js/areas/entrenador/alarma.js',
  './js/areas/entrenador/checkin.js',
  './js/areas/entrenador/dia.js',
  './js/areas/entrenador/dolor-alto.js',
  './js/areas/entrenador/entrenador.js',
  './js/areas/entrenador/ia.js',
  './js/areas/entrenador/indice.js',
  './js/areas/entrenador/plan.js',
  './js/areas/entrenador/salud.js',
  './js/areas/entrenador/validar.js',
  './js/areas/hoy/indice.js',
  './js/areas/perfil/bienvenida.js',
  './js/areas/perfil/indice.js',
  './js/areas/perfil/nube.js',
  './js/areas/perfil/salud.js',
  './js/areas/progreso/analisis.js',
  './js/areas/progreso/indice.js',
  './js/areas/sesion/indice.js',
  './js/areas/sesion/temporizador.js',
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
