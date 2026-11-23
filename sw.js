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
const VERSION = 'pipos-app-873ad61632d5';
const PREFIJO = 'pipos-app-';
// Huella de cada archivo de APP (la escribe también `npm run version`): la instalación solo acepta estos.
const HUELLAS = {
  './': 'sha256-xumI+J88dQTf13BsFet1vy0RGkPB08cRkNm7+LgqF7o=',
  './css/areas.css': 'sha256-ZzfU6KU7w/c5tUfsaTBCfqAoUQ9P+jMbXw61jQdPLug=',
  './css/componentes.css': 'sha256-EUqHgW58BSffOwOeNUFtDXMe7cE2F/Yc2EQgRuWjOD8=',
  './css/ejercicios.css': 'sha256-/PRQnpPMx6ibZwR6sm8eqcgnTtgengfu6Q8iYHqngiA=',
  './css/hoy.css': 'sha256-uXusF5FvVsyN0xnDmYAIp3NJU7OXJsbKC4jd/tFVBpo=',
  './css/legado.css': 'sha256-RzLFY+MMiNeUeWPtB0q+xrQxN96mSCiAHGk4SOXJS/w=',
  './css/marco.css': 'sha256-Y+9bAghnBzSPmNsyhRjFXl7t4/GluCD4RxuZJC+MI1Y=',
  './css/perfil.css': 'sha256-kixore0qAt61OIqJY2lRrxC6f8eYmQOMBg2rJPQQLR0=',
  './css/progreso.css': 'sha256-75RgtZQWBEvIJXxzCiDfI398Q4tRh2/I5y5mTlPsQN0=',
  './css/sesion.css': 'sha256-rwFVruXK8xI04gF44ucIbgPyH+St7+8FMfLMtlShI0o=',
  './css/tokens.css': 'sha256-mTco9f+4cJLn9PoZufMv0pkPrp5PVr7MSacT0ANylc0=',
  './fonts/instrument-sans.woff2': 'sha256-rk9YUt7Enho5JjLjCQhuZacfSGX9yMdsX2u2zxJx4AU=',
  './icons/icon-180.png': 'sha256-HL2I8vR+SqWC6lipjg6LtjomGLg7MFrjTv7eaCfJIrg=',
  './icons/icon-192.png': 'sha256-Be3AEg9cCiHRyF7d1KkWSPm2bX6RaxNejm+G6RmOrQg=',
  './icons/icon-32.png': 'sha256-ehKgJyadLbyf/YMOiUOBuFuH8i5nrcDo8UO7fO59SIc=',
  './icons/icon-512.png': 'sha256-032LUQv7ZkjxyypYS8HMoe7iN3WhjR5l2t4LidabtGQ=',
  './icons/icon.svg': 'sha256-sJzu6OtKFXuo/fIR4P5sSXUivY6OWsXJkeVRxMzZ8HM=',
  './icons/logo.svg': 'sha256-5zigwm3jcX26G6wTlAB+IViwYh0i6bnBGth9bvhdROE=',
  './icons/maskable-512.png': 'sha256-tdm98mEZRBgddtEiMnKlHmSGq8rylRfSma5jYNi27yE=',
  './index.html': 'sha256-xumI+J88dQTf13BsFet1vy0RGkPB08cRkNm7+LgqF7o=',
  './js/areas/ejercicios/buscador.js': 'sha256-dXJ7NSnIWHQf8Vm2yDQuDsr3K0u6F9WTDtPPoVTdy2w=',
  './js/areas/ejercicios/indice.js': 'sha256-ShKymjOA1X2xP6s1HYhFukQl93SMisalAgZCUYYABsI=',
  './js/areas/entrenador/alarma.js': 'sha256-VP4tbS0/BjFrgaUmbdAzZpH/1r1S/IhothJNZAwBgh4=',
  './js/areas/entrenador/checkin.js': 'sha256-n7WI6e0GvstPTYECxPCW8TM7p71Vr+vTr+33ZSFFLJI=',
  './js/areas/entrenador/dia.js': 'sha256-xxg2gS/7ihmx8LRNQFCFudJtYw9VOBYocqP0BU+mAQQ=',
  './js/areas/entrenador/dolor-alto.js': 'sha256-tEU1EMhgjerhZUOAYRAOyTWdSyBj5oWLAv+DfWsWnrA=',
  './js/areas/entrenador/entrenador.js': 'sha256-13QAsfPqE3+Rv08bxvafhm2uJ80ZsgxX72XsDb8o64I=',
  './js/areas/entrenador/ia.js': 'sha256-9JkV+ibC2uo6ON5Bm+IqcXGVjdUo5ODfwL3W/aGysQo=',
  './js/areas/entrenador/indice.js': 'sha256-xeLQBCZKLHOaDhWV/r7dOJafkaaKT0G9tH9rlbVSvaw=',
  './js/areas/entrenador/mias.js': 'sha256-3pbV4xYDmq9vQ1RSJRSoZojeezE8UQ/0BpcS+D4k/lk=',
  './js/areas/entrenador/plan.js': 'sha256-uSQM5HjHBfGxXp/XUw8xGwvuO0uFIEazEJSS6KMRUz4=',
  './js/areas/entrenador/salud.js': 'sha256-9IOy+tzfTI3x+HfQxNtwWSoLKUN4AvjJJJ3qqo8Y1dE=',
  './js/areas/entrenador/validar.js': 'sha256-Ue2ugNWQEBzlPlSir6wuS/Eaw7X0TMtKljT9prvaDdY=',
  './js/areas/hoy/indice.js': 'sha256-pVZ4l2DLhBMkD3ldT6YM1JIpeGsyLR0Asq4mPsmkcvM=',
  './js/areas/perfil/bienvenida.js': 'sha256-UYQf1FzKUFrhQwaC2ZWzuko6jr6PFw63G78Z8Ru52s8=',
  './js/areas/perfil/controles.js': 'sha256-SEK696W9UBpjbhv22oOmXxT0tYsT30bgaJ8nJHqt/JM=',
  './js/areas/perfil/editor.js': 'sha256-/TQ0RVykCQAx8WyVWczNq+jc5pVqsWluXaj5k0LwwjY=',
  './js/areas/perfil/grupo.js': 'sha256-aZDPUEqt80/gqYplOA5dxzPZgXJJK077aPGOVXr+ysU=',
  './js/areas/perfil/indice.js': 'sha256-IE2+jLyF7gNlAFeRIom0lAVkQ1dy7lU6rgXnsG8Hzbc=',
  './js/areas/perfil/nube.js': 'sha256-YfxWYMZ/J9iwI4HPEsmc9LseWIJQnhTX95eRomCSuk0=',
  './js/areas/perfil/salud.js': 'sha256-38BQdSYXUddIOeO6Pcg+GH+DYJVE+qy+ex52fa9xYU8=',
  './js/areas/progreso/analisis.js': 'sha256-luOhjFmMpt3JyYX1w96zCLEsdFt2nTmLc88t7wJS0lI=',
  './js/areas/progreso/graficos.js': 'sha256-WU1aoXhXlaJc9GpP2nJIlv38ThfrPVEQi/MD7Xnmuyc=',
  './js/areas/progreso/indice.js': 'sha256-8hTvp3FJh34fxlRA+nNDaEMToI2vpzh/sQq3M/ptXBw=',
  './js/areas/sesion/indice.js': 'sha256-Cfs29UdkqiDeKl1jYgTe3cCRVdCvFjhjkzz7bSbGG38=',
  './js/areas/sesion/pitidos.js': 'sha256-HLh6MF4/cReIeb7GaxomTJhYcbMh1ZJwK30Wll/h22s=',
  './js/areas/sesion/temporizador.js': 'sha256-CxYnVA63CCEeaCvYN7A/Qa0hv9H4iCNpn1DYMdGuWn0=',
  './js/arranque.js': 'sha256-ON75atFH/l3yd1yeqf+KTataCTsNGzSrzVqHHNNsl7A=',
  './js/aspecto/movimiento.js': 'sha256-1hBZ7vMNHZpytod7rnPGR5s+ZCGC6D/ebHcQzChHz2Q=',
  './js/aspecto/vida.js': 'sha256-sdljBtKdHRg3T/2wRrW3RL0pt6/rziyIxmcHigkFPfU=',
  './js/datos/constantes.js': 'sha256-vQ3Et/429B94/UAJNqnt80Ola/QJymSZ7fJnvNYvbzs=',
  './js/datos/ejercicios.js': 'sha256-yNvazSSs5zMJj8q4Bb00gWcOyx5YTNUSXzbnLov7+1U=',
  './js/datos/lesiones.js': 'sha256-EUTHi70/dUkKwir/veKkW/CRLyyWU/sjOgqsORNEJvY=',
  './js/datos/palabras.js': 'sha256-uNIKPRAkULGKC90yvFVDChjrk/Xymx0tBE8BuAulTF0=',
  './js/main.js': 'sha256-RN+M/lfMJk80cXf+LrLGJ2s5pvASvNgK1ksyw29FcGM=',
  './js/nucleo/api.js': 'sha256-OBdNq53SohnHUOON8LiIVQt3RJKDjXTNYVSfcXnV8HA=',
  './js/nucleo/copia.js': 'sha256-Ub9sGKl1qrha0qk3PKDQ+GzAFPqZ9NwvtItaQAaSrV8=',
  './js/nucleo/espejo.js': 'sha256-a5UgPajqqC4dNBZKb0cEpujFTZkwxWVW87K3yfY6RZ0=',
  './js/nucleo/estado.js': 'sha256-QLTPltClpviGbyG2hNZgqVRgn46aVJkttGAlqgo7TpM=',
  './js/nucleo/migracion.js': 'sha256-KU2w3gp99EJQ2i+nP4fZjKihPDMFPybH6i/JMKhZhs0=',
  './js/nucleo/modelo.js': 'sha256-xgsihlJYQ3FqdSoez5pnXzwsilNLsvIN1uJVntgomqg=',
  './js/nucleo/normalizar.js': 'sha256-WL0bfkw8ADUNySMh406stBzJVLBuRZbSe/cLCtcFLxQ=',
  './js/nucleo/rescate.js': 'sha256-nkpOCeQb3GnT6xCB6tNjiXhruP4zeimkSE+h0l5KL2g=',
  './js/nucleo/router.js': 'sha256-+6PmHMap+ovhsvlM6v05KDA/L8vOz3D7NkQoitd2JE0=',
  './js/nucleo/ui.js': 'sha256-DMnY30Iy+xY3W0yTq3X2+L+4Q6Mp5pyYHhxREqvmNdU=',
  './js/nucleo/version.js': 'sha256-LtzF3eUp42lbAisHNOc3AzwPdP67nYrvklPceMWLwZM=',
  './js/reglas/catalogo.js': 'sha256-Eq6IhBwEbVe5YsFA8D4lQiOdh3HQOQCYuDGU04X83Cw=',
  './js/reglas/contexto.js': 'sha256-u2X78396fNq/zdEOO+D7RaLmPO6KxZtOIK1xVvOKoV0=',
  './js/reglas/progresion.js': 'sha256-tnP2Y4F39Idcc4VUrIEg1+OIb1OGwsmqvY81mROEP4Y=',
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
  './js/areas/sesion/pitidos.js',
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
