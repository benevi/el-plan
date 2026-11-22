// T11 (D1 y COD-3 de la re-auditoría): una copia que no se pudo subir (sin red, red que «miente», 5xx, 429)
// queda pendiente, también tras cerrar la app, y se reintenta sola con espera creciente; al abrir con red se
// sube si el móvil tiene sesiones que no están en la nube aunque la última copia tenga menos de 24 h.
// D7: gustos, «Mis sesiones» y alarmas también disparan copia.
// Aquí localStorage sobrevive a «cerrar la app» (reiniciarCopia), como en el navegador.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { est, cargarCon, hecha, AlmacenMemoria } from './ayuda/node.mjs';
import { modulo, estadoBase } from './ayuda/comun.mjs';
import { BlobSimulado, fetchNube, ClavesMemoria } from './ayuda/nube.mjs';
import { ponerReloj } from '../api/copia.js';

const ls = new AlmacenMemoria();
globalThis.localStorage = ls;
// Lo justo de document para «visibilitychange» (copia.js lo escucha al iniciar).
const doc = Object.assign(new EventTarget(), { hidden: false });
globalThis.document = doc;
const C = await import(modulo('js/nucleo/copia.js'));
process.env.VERCEL_ENV = 'production';
const FRASE = 'caballo grapa batería correcta';

let blob, f, claves, reloj, red, temporizadores;
function configurar() {
  C.configurarCopia({
    almacen: claves, fetch: f, enLinea: () => red, ahora: () => reloj,
    setTimeout: (fn, ms) => { const t = { fn, ms, vivo: true }; temporizadores.push(t); return t; },
    clearTimeout: t => { if (t) t.vivo = false; },
    bloqueo: (n, fn) => fn(), cuandoLibre: () => Promise.resolve(),
  });
}
beforeEach(() => {
  ls.clear();
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'secreto', vibrar: true, sonido: true } }) });
  blob = new BlobSimulado(); f = fetchNube(blob); claves = new ClavesMemoria();
  reloj = Date.parse('2026-11-20T18:40:00Z'); red = true; temporizadores = [];
  ponerReloj(() => reloj);
  configurar(); C.reiniciarCopia();
});
const subidas = () => f.peticiones.filter(p => p.init.headers['x-copia-accion'] === 'subir');
const enBlob = () => [...blob.blobs.keys()].filter(k => k.startsWith('copias/')).length;
const esperarSubida = () => C.subidaEnCurso() || Promise.resolve();
const vivos = () => temporizadores.filter(t => t.vivo);
// Avanza el reloj falso y dispara los temporizadores que vencen (esperando a cada subida que lancen).
async function pasar(ms) {
  reloj += ms;
  for (const t of vivos()) { t.ms -= ms; if (t.ms <= 0) { t.vivo = false; t.fn(); await esperarSubida(); } }
}
const sesion = () => est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
const hora = () => { reloj += 3600e3; };

test('COD-3a / D1: sesión hecha sin red, app cerrada y reabierta con red antes de 24 h → se sube al abrir', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  assert.equal(enBlob(), 1);
  hora(); red = false; sesion(); await esperarSubida();
  assert.equal(enBlob(), 1, 'sin red no se sube');
  // Cierra la app (el módulo se recarga) y la abre 2 h después, con red.
  reloj += 2 * 3600e3; red = true;
  C.reiniciarCopia(); configurar();
  const r = await C.iniciarCopias(); await esperarSubida();
  assert.equal(r, 'ok');
  assert.equal(enBlob(), 2, 'la sesión hecha sin red ya está en la nube');
  assert.equal(C.estadoNube().pendiente, false);
});

test('COD-3a: con una sesión más que lo subido se copia al abrir aunque no quedara nada pendiente', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  // La app se cierra justo al terminar (la subida ni empieza): la sesión está en el móvil y no en la nube.
  hora(); est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'externo');
  C.reiniciarCopia(); configurar();
  hora();
  assert.equal(await C.iniciarCopias(), 'ok');
  assert.equal(enBlob(), 2);
  // Ya al día: la siguiente apertura reciente no sube nada.
  C.reiniciarCopia(); configurar(); hora();
  assert.equal(await C.iniciarCopias(), 'reciente');
});

test('COD-3b / D1: el fetch falla con navigator.onLine a true y la red vuelve sin evento «online» → reintento solo', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  hora(); f.sinRed = true; sesion();
  assert.equal(await esperarSubida(), 'sin-red');
  assert.equal(C.estadoNube().pendiente, true);
  f.sinRed = false; // vuelve la cobertura; el navegador nunca se creyó sin red
  await pasar(30e3);
  assert.equal(enBlob(), 2, 'a los 30 s se ha reintentado y subido');
  assert.equal(C.estadoNube().pendiente, false);
  assert.equal(vivos().length, 0, 'sin más reintentos programados');
});

test('D1: un 5xx se reintenta con espera creciente (30 s, 2 min, 10 min…) y avisa mientras tanto', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  const n0 = subidas().length;
  hora();
  f.sinRed = false;
  const base = f;
  let fallar = true;
  C.configurarCopia({ fetch: async (url, init) => {
    if (fallar && init.headers['x-copia-accion'] === 'subir') { base.peticiones.push({ url, init }); return new Response('{"error":"la nube no responde ahora"}', { status: 502, headers: { 'content-type': 'application/json' } }); }
    return base(url, init);
  } });
  sesion();
  assert.equal(await esperarSubida(), 'error');
  const n = C.estadoNube();
  assert.equal(n.fallida, true);
  assert.equal(n.reintenta, true);
  assert.equal(n.avisar, true, 'se avisa ya, no a los 3 días');
  assert.match(n.error, /no responde/);
  // Esperas crecientes: cada fallo programa el siguiente reintento más tarde.
  const esperas = [];
  for (let i = 0; i < 4; i++) { const t = vivos()[0]; esperas.push(t.ms); await pasar(t.ms); }
  assert.deepEqual(esperas, C.REINTENTOS);
  assert.equal(vivos()[0].ms, C.REINTENTOS.at(-1), 'la última espera se repite');
  assert.equal(subidas().length - n0, 5);
  fallar = false;
  await pasar(vivos()[0].ms);
  assert.equal(enBlob(), 2);
  assert.deepEqual([C.estadoNube().fallida, C.estadoNube().avisar, C.estadoNube().error], [false, false, null]);
});

test('D1: un 429 (tope diario) también se reintenta; un 401 no (no se arregla solo) pero avisa', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  hora();
  C.configurarCopia({ fetch: async () => new Response('{"error":"demasiadas"}', { status: 429, headers: { 'content-type': 'application/json' } }) });
  sesion(); await esperarSubida();
  assert.equal(vivos().length, 1);
  C.reiniciarCopia(); configurar();
  await C.cargarClave();
  C.configurarCopia({ fetch: async () => new Response('{"error":"código"}', { status: 401, headers: { 'content-type': 'application/json' } }) });
  assert.equal(await C.copiarAhora('sesion'), 'espera', 'tras el 429, lo automático espera su turno (M4)');
  assert.equal(await C.copiarAhora('manual'), 'error', '«Copiar ahora» sí lo intenta');
  assert.equal(vivos().length, 0, 'con el código malo no se insiste');
  const n = C.estadoNube();
  assert.deepEqual([n.fallida, n.reintenta, n.avisar], [true, false, true]);
});

test('D1: al volver la app a primer plano con algo pendiente se sube ya', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  hora(); f.sinRed = true; sesion(); await esperarSubida();
  f.sinRed = false;
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(enBlob(), 1, 'al irse a segundo plano no');
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await esperarSubida();
  assert.equal(enBlob(), 2);
  assert.equal(vivos().length, 0, 'el reintento programado se cancela');
});

test('D7: gustos, «Mis sesiones» y alarmas disparan copia (con la espera de 1 minuto)', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  for (const motivo of ['gusto', 'misSesiones', 'alarma']) {
    const n = enBlob();
    hora();
    est.cambiar(S => { S.perfil.gustos['remo-maquina'] = motivo === 'gusto' ? 'like' : 'dislike'; }, motivo);
    await pasar(59e3);
    assert.equal(enBlob(), n, motivo + ': aún no');
    await pasar(1e3);
    assert.equal(enBlob(), n + 1, motivo);
  }
  // El plan sigue sin copiar solo (se rehace con la IA).
  const n = enBlob(); hora();
  est.cambiar(S => { S.plan = null; }, 'plan');
  await pasar(120e3);
  assert.equal(enBlob(), n);
});

// ── Revisión del PR #46 ──
const json = (status, cuerpo, cab = {}) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...cab } });
const primerPlano = async () => { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await esperarSubida(); };

test('G1: con 401 no se vuelve a subir al volver a primer plano, al abrir ni al volver la red; al cambiar el código, sí', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  const base = f; let peticiones = 0;
  C.configurarCopia({ fetch: async (u, i) => { peticiones++; return json(401, { error: 'código de acceso incorrecto' }); } });
  hora(); sesion(); await esperarSubida();
  assert.equal(peticiones, 1);
  for (let i = 0; i < 12; i++) { reloj += 30e3; await primerPlano(); }
  C._alVolverRed(); await esperarSubida();
  C.reiniciarCopia(); configurar(); C.configurarCopia({ fetch: async () => { peticiones++; return json(401, { error: 'x' }); } });
  assert.equal(await C.iniciarCopias(), 'bloqueada');
  await pasarTodo();
  assert.equal(peticiones, 1, 'una sola petición con el código malo');
  assert.equal(C.estadoNube().fallida, true);
  // Cambia el código en Ajustes: se vuelve a intentar al momento.
  C.configurarCopia({ fetch: base });
  est.cambiar(S => { S.ajustes.codigo = 'secreto2'; }, 'perfil-silencio');
  process.env.APP_CODE = 'secreto2';
  await esperarSubida();
  assert.equal(enBlob(), 2);
  assert.equal(C.estadoNube().fallida, false);
  process.env.APP_CODE = 'secreto';
});
async function pasarTodo() { for (let i = 0; i < 5; i++) { const t = vivos()[0]; if (!t) return; reloj += t.ms; t.vivo = false; t.fn(); await esperarSubida(); } }

test('M4: el 429 del tope diario no se reintenta hasta el día UTC siguiente (ni al volver a primer plano)', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  let peticiones = 0;
  C.configurarCopia({ fetch: async () => { peticiones++; return json(429, { error: 'ya se han hecho muchas copias hoy; la siguiente, mañana' }); } });
  hora(); sesion(); await esperarSubida(); // 2026-11-20T20:40Z
  const t = vivos()[0];
  assert.ok(reloj + t.ms >= Date.parse('2026-11-21T00:00:00Z') && reloj + t.ms <= Date.parse('2026-11-21T00:05:00Z'), new Date(reloj + t.ms).toISOString());
  for (let i = 0; i < 6; i++) { reloj += 30 * 60e3; await primerPlano(); }
  C.reiniciarCopia(); configurar(); C.configurarCopia({ fetch: async () => { peticiones++; return json(429, { error: 'x' }); } });
  assert.equal(await C.iniciarCopias(), 'espera');
  assert.equal(peticiones, 1);
});

test('M4: se respeta Retry-After y volver a primer plano no reinicia la espera creciente', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  let peticiones = 0;
  C.configurarCopia({ fetch: async () => { peticiones++; return json(429, { error: 'demasiadas copias seguidas' }, { 'retry-after': '600' }); } });
  hora(); sesion(); await esperarSubida();
  assert.equal(vivos()[0].ms, 600e3);
  for (let i = 0; i < 5; i++) { reloj += 60e3; await primerPlano(); }
  assert.equal(peticiones, 1, 'antes de los 10 minutos, nada');
  C.configurarCopia({ fetch: f });
  reloj += 6 * 60e3; await primerPlano();
  assert.equal(enBlob(), 2, 'pasada la espera, al volver a primer plano sí');
});

test('M3: activar con el código malo o sin red da error en vez de crear una sal nueva; con 503 sigue', async () => {
  C.configurarCopia({ fetch: async () => json(401, { error: 'x' }) });
  await assert.rejects(C.activar('victor', FRASE), e => e.codigo === 'codigo');
  assert.equal(claves.regs.size, 0);
  red = false;
  await assert.rejects(C.activar('victor', FRASE), e => e.codigo === 'sin-red');
  red = true;
  C.configurarCopia({ fetch: async () => json(503, { error: 'x', activada: false }) });
  assert.ok((await C.activar('victor', FRASE)).reg);
});

test('M3: tras activar, un 403 de etiqueta hace probar la lista con la frase y adoptar la sal que abre', async () => {
  // Copias en la nube con FRASE (sal A), hechas desde otro móvil.
  await C.activar('victor', FRASE); sesion(); await C.copiarAhora('manual');
  const salA = C.b64u(claves.regs.get('victor').sal);
  // Móvil nuevo: la lista no se pudo ver (503 un momento) y se creó la sal B.
  claves.regs.clear(); C.reiniciarCopia(); configurar(); ls.clear();
  const base = f; let listas = 0;
  C.configurarCopia({ fetch: async (u, i) => (JSON.parse(i.body.length < 400 && typeof i.body === 'string' ? i.body : '{}').accion === 'listar' && listas++ === 0 ? json(503, { error: 'x' }) : base(u, i)) });
  await C.activar('victor', FRASE);
  assert.notEqual(C.b64u(claves.regs.get('victor').sal), salA);
  reloj += 60e3; // la primera copia, enseguida
  const r = await C.copiarAhora('activar');
  assert.equal(r, 'ok', JSON.stringify(C.estadoNube()));
  assert.equal(C.b64u(claves.regs.get('victor').sal), salA, 'adopta la clave registrada');
});

test('revisión #46: la etiqueta anterior se manda aunque pipos4-nube no diga de quién es', async () => {
  await C.activar('victor', FRASE); sesion(); await C.copiarAhora('manual');
  await C.cambiarFrase('victor', 'la frase nueva de este año');
  const n = JSON.parse(ls.getItem('pipos4-nube')); delete n.persona; ls.setItem('pipos4-nube', JSON.stringify(n));
  C.reiniciarCopia(); configurar(); await C.cargarClave('victor');
  hora();
  assert.equal(await C.copiarAhora('manual'), 'ok');
});
