// S1 (re-auditoría, T7 «ni para gastar de más»): freno a los intentos de código fallidos y cupo diario de
// llamadas a la IA en el servidor (api/_freno.js). Las funciones de Vercel no comparten memoria: con el almacén
// Blob conectado, el freno vale entre instancias; sin él, solo dentro de cada una.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Respuesta, peticion, mensaje, clienteSimulado } from './_simulado.mjs';
import { BlobSimulado } from './_blob-simulado.mjs';
import handler, { TOPE_DIARIO } from '../../api/entrenador.js';
import handlerCopia from '../../api/copia.js';
import { ponerClienteIA, BLOQUEADA } from '../../api/_comun.js';
import { reiniciarFrenos, ponerAlmacenFreno, ponerRelojFreno, FALLOS, CUPO } from '../../api/_freno.js';

const cat = [{ id: 'sentadilla-goblet', m: ['cuadriceps'], l: ['gym'], niv: 1, t: 'reps', tipo: 'compuesto' }];
const sesionIA = { nombre: 'x', foco: 'y', cambios: [], explicacion: ['z'], calentamiento: [], vueltaCalma: [], ejercicios: [{ id: 'sentadilla-goblet', rol: 'principal', series: 3, reps: '8', descanso: 60, kg: 10, nota: 'n' }] };
let cliente, reloj, logAntes, errorAntes;
beforeEach(() => {
  process.env.APP_CODE = 'el-codigo-bueno'; process.env.ANTHROPIC_API_KEY = 'x'; process.env.VERCEL_ENV = 'production';
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID; delete process.env.CUPO_IA_SESIONES; delete process.env.CUPO_IA_PLANES;
  reiniciarFrenos(); ponerAlmacenFreno(null);
  reloj = Date.parse('2026-11-22T10:00:00Z'); ponerRelojFreno(() => reloj);
  cliente = clienteSimulado(p => mensaje(p.max_tokens === 48000 ? { dias: [] } : sesionIA)); ponerClienteIA(cliente);
  logAntes = console.log; errorAntes = console.error; console.log = () => {}; console.error = () => {};
});
afterEach(() => { console.log = logAntes; console.error = errorAntes; ponerClienteIA(null); ponerAlmacenFreno(null); ponerRelojFreno(null); });

async function pedir({ codigo = 'el-codigo-bueno', ip = '203.0.113.7', modo = 'sesion' } = {}) {
  const r = new Respuesta();
  const cuerpo = modo === 'plan' ? { modo: 'plan', catalogo: cat, semana: { dias: [1], lugares: [{ id: 'gym' }] } } : { modo: 'sesion', catalogo: cat };
  await handler(peticion({ codigo, cuerpo, cabeceras: { 'x-forwarded-for': ip + ', 10.0.0.1' } }), r);
  return r;
}

// ── Intentos de código ──
test('S1: 10 códigos malos desde una IP la bloquean 15 min (429), también con el código bueno; otra IP sigue', async () => {
  for (let i = 0; i < FALLOS.max; i++) assert.equal((await pedir({ codigo: 'malo' + i })).codigo, 401);
  const r = await pedir();
  assert.equal(r.codigo, 429);
  assert.equal(r.cuerpo.error, BLOQUEADA);
  assert.equal(cliente.llamadas.length, 0, 'bloqueada no llega a la IA ni con el código bueno');
  assert.equal((await pedir({ codigo: 'otro-malo' })).codigo, 429);
  assert.equal((await pedir({ ip: '198.51.100.9' })).codigo, 200, 'otra IP no se ve afectada');
  reloj += FALLOS.bloqueo + 1;
  assert.equal((await pedir()).codigo, 200, 'pasado el bloqueo, vuelve a entrar');
});

test('S1: los fallos espaciados (menos de 10 por ventana de 10 min) no bloquean', async () => {
  for (let v = 0; v < 3; v++) {
    for (let i = 0; i < FALLOS.max - 1; i++) assert.equal((await pedir({ codigo: 'malo' })).codigo, 401);
    reloj += FALLOS.ventana;
  }
  assert.equal((await pedir()).codigo, 200);
});

test('S1: el freno de /api/copia es el mismo (misma puerta)', async () => {
  for (let i = 0; i < FALLOS.max; i++) { const r = new Respuesta(); await handlerCopia(peticion({ codigo: 'malo' + i, cuerpo: { accion: 'listar', persona: 'victor' }, cabeceras: { 'x-forwarded-for': '203.0.113.7' } }), r); assert.equal(r.codigo, 401); }
  assert.equal((await pedir()).codigo, 429);
});

test('S1: con el almacén Blob, otra instancia ve el bloqueo ante otro código malo; el código bueno no toca el Blob', async () => {
  const blob = new BlobSimulado(); ponerAlmacenFreno(blob);
  const r0 = new Respuesta(); await handlerCopia(peticion({ codigo: 'el-codigo-bueno', cuerpo: { accion: 'listar', persona: 'victor' }, cabeceras: { 'x-forwarded-for': '203.0.113.7' } }), r0);
  assert.equal(r0.codigo, 503, 'pasa la puerta (sin almacén de copias)');
  assert.deepEqual(blob.llamadas, [], 'M1: con el código bueno, la puerta no hace ni una operación del Blob');
  for (let i = 0; i < 2; i++) await pedir({ codigo: 'malo' + i });
  assert.deepEqual(blob.llamadas, [], 'M1: los dos primeros códigos malos, solo en memoria');
  for (let i = 2; i < FALLOS.max; i++) await pedir({ codigo: 'malo' + i });
  assert.ok(blob.llamadas.length > 0, 'a partir del 3.º, al Blob');
  reiniciarFrenos(); // otra instancia: memoria vacía
  // Otra instancia solo mira el Blob a partir del 3.º código malo de esa IP (M1): con él ve el bloqueo.
  assert.equal((await pedir({ codigo: 'otro-1' })).codigo, 401);
  assert.equal((await pedir({ codigo: 'otro-2' })).codigo, 401);
  assert.equal((await pedir({ codigo: 'otro-3' })).codigo, 429, 'otra instancia: bloqueada');
  assert.equal((await pedir()).codigo, 429, 'y ya lo sabe esa instancia');
  const archivos = [...blob.blobs.keys()];
  assert.ok(archivos.every(k => k.startsWith('frenos/codigo/')), archivos.join());
  assert.ok(!archivos.some(k => k.includes('203.0.113.7')), 'la IP no se guarda en claro');
  assert.ok(![...blob.blobs.values()].some(b => b.bytes.toString().includes('malo')), 'ni los códigos probados');
  // Sin Blob: la memoria de cada instancia es lo único (límite documentado en LEEME).
  ponerAlmacenFreno(null); reiniciarFrenos();
  for (let i = 0; i < FALLOS.max; i++) await pedir({ codigo: 'malo' + i, ip: '192.0.2.1' });
  assert.equal((await pedir({ ip: '192.0.2.1' })).codigo, 429);
  reiniciarFrenos();
  assert.equal((await pedir({ ip: '192.0.2.1' })).codigo, 200);
});

test('G1: el mismo código malo repetido (un móvil con el código viejo) cuenta una vez y no bloquea a nadie', async () => {
  for (let i = 0; i < 50; i++) assert.equal((await pedir({ codigo: 'el-codigo-viejo' })).codigo, 401);
  assert.equal((await pedir()).codigo, 200);
});

test('M1: IPv6 se agrupa por /64 (cambiar la parte de dispositivo no reinicia el freno)', async () => {
  for (let i = 0; i < FALLOS.max; i++) assert.equal((await pedir({ codigo: 'malo' + i, ip: `2001:db8:1:2:${i.toString(16)}::1` })).codigo, 401);
  assert.equal((await pedir({ ip: '2001:db8:1:2:abcd:ef::9' })).codigo, 429);
  assert.equal((await pedir({ ip: '2001:db8:1:3::1' })).codigo, 200, 'otra /64 no');
});

test('M2: si el Blob se cuelga, el freno no espera más de 1,5 s y sigue con la memoria', async () => {
  const colgado = { get: () => new Promise(() => {}), put: () => new Promise(() => {}), list: async () => ({ blobs: [] }), del: async () => {}, llamadas: [] };
  ponerAlmacenFreno(colgado);
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) assert.equal((await pedir({ codigo: 'malo' + i })).codigo, 401);
  assert.equal((await pedir()).codigo, 200);
  assert.ok(performance.now() - t0 < 4 * 1700 + 1700, 'cada espera, como mucho 1,5 s');
});

test('S1: si el Blob falla, no se bloquea a nadie por eso', async () => {
  const blob = new BlobSimulado(); blob.fallo = new Error('caído'); ponerAlmacenFreno(blob);
  assert.equal((await pedir()).codigo, 200);
  assert.equal((await pedir({ codigo: 'malo' })).codigo, 401);
});

// ── Cupo diario de la IA ──
test('S1: cupo diario de sesiones y de planes; pasado, 429 sin llamar a Claude; al día siguiente, otra vez', async () => {
  assert.deepEqual(CUPO, { sesion: 60, plan: 15 });
  for (let i = 0; i < CUPO.sesion; i++) assert.equal((await pedir()).codigo, 200, 'sesión ' + i);
  const n = cliente.llamadas.length;
  const r = await pedir();
  assert.equal(r.codigo, 429);
  assert.equal(r.cuerpo.error, TOPE_DIARIO);
  assert.equal(cliente.llamadas.length, n);
  assert.equal((await pedir({ modo: 'plan' })).codigo, 200, 'el de planes va aparte');
  for (let i = 1; i < CUPO.plan; i++) await pedir({ modo: 'plan' });
  assert.equal((await pedir({ modo: 'plan' })).codigo, 429);
  reloj += 864e5;
  assert.equal((await pedir()).codigo, 200);
});

test('S1: el cupo se puede cambiar con CUPO_IA_SESIONES / CUPO_IA_PLANES y vale entre instancias con el Blob', async () => {
  process.env.CUPO_IA_SESIONES = '3';
  const blob = new BlobSimulado(); ponerAlmacenFreno(blob);
  for (let i = 0; i < 2; i++) assert.equal((await pedir()).codigo, 200);
  reiniciarFrenos(); // otra instancia
  assert.equal((await pedir()).codigo, 200);
  reiniciarFrenos();
  assert.equal((await pedir()).codigo, 429);
  assert.ok(blob.blobs.has('frenos/ia/2026-11-22.json'));
});

test('S1: una petición rechazada antes (código malo, 400) no gasta cupo', async () => {
  process.env.CUPO_IA_SESIONES = '1';
  await pedir({ codigo: 'malo' });
  const r = new Respuesta(); await handler(peticion({ codigo: 'el-codigo-bueno', cuerpo: { modo: 'sesion', catalogo: [] } }), r);
  assert.equal(r.codigo, 400);
  assert.equal((await pedir()).codigo, 200);
});

test('cupo: si la IA falla antes de responder (saturada, sin conexión) no se cuenta; si responde mal, sí', async () => {
  process.env.CUPO_IA_SESIONES = '2';
  ponerClienteIA(clienteSimulado(() => { const e = new Error('overloaded'); e.status = 529; throw e; }));
  for (let i = 0; i < 5; i++) assert.equal((await pedir()).codigo, 529);
  ponerClienteIA(clienteSimulado(() => mensaje('no es json')));
  assert.equal((await pedir()).codigo, 502);
  ponerClienteIA(cliente);
  assert.equal((await pedir()).codigo, 200);
  const r = await pedir();
  assert.equal(r.codigo, 429);
  assert.ok(r.cuerpo.vuelve.endsWith('T00:00:00.000Z'));
});
