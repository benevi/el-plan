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
  assert.equal(await C.copiarAhora('sesion'), 'error');
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
