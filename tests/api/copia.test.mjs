// api/copia.js con un Blob simulado: puerta (APP_CODE, código, método), 503 sin almacén, persona,
// tamaño, que solo se guardan bytes cifrados y privados, listar/bajar, retención y ritmo.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Respuesta, peticion } from './_simulado.mjs';
import { BlobSimulado } from './_blob-simulado.mjs';
import handler, { ponerAlmacen, reiniciarRitmo, sobrantes, nombreCopia, nombreCopiaV1, leerNombre, LIMITE_COPIA, SUBIDAS_DIA } from '../../api/copia.js';

let registros, errores, logAntes, errorAntes, blob;
beforeEach(() => {
  process.env.APP_CODE = 'secreto';
  process.env.VERCEL_ENV = 'production'; // las rutas de siempre; las vistas previas, al final
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
  blob = new BlobSimulado(); ponerAlmacen(blob); reiniciarRitmo();
  registros = []; errores = [];
  logAntes = console.log; errorAntes = console.error;
  console.log = (...a) => registros.push(a.join(' '));
  console.error = (...a) => errores.push(a.join(' '));
});
afterEach(() => { console.log = logAntes; console.error = errorAntes; ponerAlmacen(null); });

// Un archivo con forma de copia cifrada (cabecera PIPC + bytes aleatorios).
function cifrado(n = 300) {
  const b = randomBytes(n);
  b.write('PIPC', 0, 'latin1'); b[4] = 1;
  return b;
}
async function llamar(op) { const res = new Respuesta(); await handler(peticion(op), res); return res; }
const META = randomBytes(55).toString('base64url'); // como los metadatos cifrados del nombre (IV + texto + etiqueta)
const salDe = b => b.subarray(11, 27).toString('base64url');
const subir = (bytes = cifrado(), { persona = 'victor', sal = salDe(bytes), meta = META, codigo = 'secreto', extra = {} } = {}) => llamar({
  codigo, tipo: 'application/octet-stream', cuerpo: bytes,
  cabeceras: { 'x-copia-accion': 'subir', 'x-copia-persona': persona, 'x-copia-sal': sal, 'x-copia-meta': meta, 'content-length': String(bytes.length), ...extra },
});
const v2 = (persona, fecha) => nombreCopia(persona, fecha, randomBytes(16).toString('base64url'), META);
const copiasEn = (persona = 'victor') => [...blob.blobs.keys()].filter(k => k.startsWith(`copias/${persona}/`));
const json = (cuerpo, codigo = 'secreto') => llamar({ cuerpo, codigo });

// ── Puerta ──
test('sin APP_CODE → 500 y no toca el Blob', async () => {
  delete process.env.APP_CODE;
  const r = await subir();
  assert.equal(r.codigo, 500);
  assert.deepEqual(r.cuerpo, { error: 'el servidor no está configurado' });
  assert.equal(r.cabeceras['cache-control'], 'no-store');
  assert.deepEqual(blob.llamadas, []);
});

test('código malo o ausente → 401 (subir y listar)', async () => {
  for (const codigo of ['otro', 'secreto ', '', null]) {
    assert.equal((await subir(cifrado(), { codigo })).codigo, 401, `código ${JSON.stringify(codigo)}`);
    assert.equal((await json({ accion: 'listar', persona: 'victor' }, codigo)).codigo, 401);
  }
  assert.deepEqual(blob.llamadas, []);
});

test('GET → 405 con Allow: POST', async () => {
  const r = await llamar({ metodo: 'GET', cuerpo: undefined });
  assert.equal(r.codigo, 405);
  assert.equal(r.cabeceras.allow, 'POST');
});

test('sin credenciales del Blob → 503 «aún no están activadas», también en producción sin almacén simulado', async () => {
  ponerAlmacen(null);
  for (const r of [await subir(), await json({ accion: 'listar', persona: 'virginia' }), await json({ accion: 'bajar', persona: 'victor', nombre: 'x' })]) {
    assert.equal(r.codigo, 503);
    assert.equal(r.cuerpo.error, 'las copias en la nube aún no están activadas');
    assert.equal(r.cuerpo.activada, false);
    assert.equal(r.cabeceras['cache-control'], 'no-store');
  }
});

test('un error de «almacén no encontrado» del SDK también es 503; otro fallo, 502 sin texto crudo', async () => {
  const B = await import('@vercel/blob');
  blob.fallo = new B.BlobStoreNotFoundError();
  assert.equal((await json({ accion: 'listar', persona: 'victor' })).codigo, 503);
  blob.fallo = new Error('Vercel Blob: TEXTO-CRUDO token_vercel_blob_rw_xxx');
  const r = await json({ accion: 'listar', persona: 'victor' });
  assert.equal(r.codigo, 502);
  assert.doesNotMatch(JSON.stringify(r.cuerpo), /CRUDO|token/);
  // En el registro, solo el tipo de error, nunca su mensaje.
  assert.doesNotMatch(errores.join('\n'), /CRUDO|token_vercel|almacén no encontrado/);
  assert.match(errores.join('\n'), /"tipo":"(Error|BlobStoreNotFoundError)"/);
});

// ── Validación ──
test('persona inválida → 400 (subir, listar, bajar y borrar)', async () => {
  for (const persona of ['', 'otro', 'VICTOR', '../victor', 'victor/', '__proto__']) {
    assert.equal((await subir(cifrado(), { persona })).codigo, 400, persona);
    for (const accion of ['listar', 'bajar', 'borrar-viejas']) assert.equal((await json({ accion, persona })).codigo, 400, accion + ' ' + persona);
  }
  assert.equal(blob.blobs.size, 0);
});

test('acción desconocida → 400; subir en JSON → 415; otro tipo → 415', async () => {
  assert.equal((await json({ accion: 'borrar-todo', persona: 'victor' })).codigo, 400);
  assert.equal((await json({ accion: 'subir', persona: 'victor', datos: 'xx' })).codigo, 415);
  assert.equal((await llamar({ tipo: 'text/plain', cuerpo: 'hola' })).codigo, 415);
});

test('tamaño: más de 4 MiB (y desde luego más de 5 MB) → 413, por cabecera o por cuerpo real', async () => {
  let r = await subir(cifrado(1000), { extra: { 'content-length': String(5 * 1024 * 1024 + 1) } });
  assert.equal(r.codigo, 413);
  r = await subir(cifrado(LIMITE_COPIA + 1));
  assert.equal(r.codigo, 413);
  // Sin content-length fiable: se mide el cuerpo.
  r = await subir(cifrado(LIMITE_COPIA + 10), { extra: { 'content-length': '10' } });
  assert.equal(r.codigo, 413);
  assert.equal(blob.blobs.size, 0);
  assert.equal((await subir(cifrado(LIMITE_COPIA))).codigo, 200);
});

test('solo acepta bytes con forma de copia cifrada: un JSON en claro → 400', async () => {
  const claro = Buffer.from(JSON.stringify({ version: 4, dueño: 'victor', perfil: { lesiones: [{ zona: 'rodilla' }] } }).repeat(3));
  assert.equal((await subir(claro)).codigo, 400);
  assert.equal(blob.blobs.size, 0);
});

// ── Subir, listar, bajar ──
test('subir: guarda privado, en copias/<persona>/<fecha>_k<sal>_m<meta>.bin, los mismos bytes y sin caché', async () => {
  const bytes = cifrado(500);
  const r = await subir(bytes);
  assert.equal(r.codigo, 200);
  assert.equal(r.cabeceras['cache-control'], 'no-store');
  const g = blob.blobs.get(copiasEn()[0]);
  assert.match(g.pathname, /^copias\/victor\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z_k[\w-]{22}_m[\w-]{40,200}\.bin$/);
  const i = g.pathname.indexOf('Z_k') + 3;
  assert.equal(g.pathname.slice(i, i + 22), salDe(bytes));
  assert.equal(g.opciones.access, 'private');
  assert.equal(g.opciones.allowOverwrite, false);
  assert.deepEqual(g.bytes, bytes);
  // Sin datos en claro en el nombre: ni sesiones ni fechas de sesión.
  assert.doesNotMatch(g.pathname.slice(0, i), /_s\d|_u\d/);
  assert.equal(g.pathname.slice(i + 22, i + 24), '_m');
});

test('subir: sal que no es la del archivo, o metadatos que faltan o no son base64url → 400', async () => {
  for (const op of [{ sal: randomBytes(16).toString('base64url') }, { sal: 'corta' }, { meta: '' }, { meta: 'x'.repeat(20) }, { meta: 'a b'.repeat(20) }, { meta: 'x'.repeat(201) }]) {
    assert.equal((await subir(cifrado(), op)).codigo, 400, JSON.stringify(op));
  }
  assert.equal(copiasEn().length, 0);
});

test('el servidor solo ve bytes cifrados: lo guardado es exactamente lo que llegó y el registro no lleva contenido', async () => {
  const bytes = cifrado(800);
  await subir(bytes);
  const linea = registros.map(l => { try { return JSON.parse(l); } catch { return null; } }).find(x => x && x.copia);
  assert.deepEqual(Object.keys(linea.copia).sort(), ['accion', 'borradas', 'bytes', 'ms', 'resultado']);
  assert.equal(linea.copia.bytes, 800);
  assert.doesNotMatch(registros.join('\n'), /victor|virginia/);
});

test('listar: solo las de esa persona, de más nueva a más vieja; las v2 con sal y meta, las v1 con sus datos', async () => {
  const v1 = nombreCopiaV1('victor', new Date('2026-11-01T10:00:00Z'), 3, '2026-10-31');
  blob.blobs.set(v1, { pathname: v1, bytes: cifrado(), uploadedAt: new Date() });
  const bytes = cifrado();
  await subir(bytes);
  await subir(cifrado(), { persona: 'virginia' });
  blob.blobs.set('copias/victor/basura.txt', { pathname: 'copias/victor/basura.txt', bytes: Buffer.from('x'), uploadedAt: new Date() });
  const r = await json({ accion: 'listar', persona: 'victor' });
  assert.equal(r.codigo, 200);
  assert.equal(r.cuerpo.copias.length, 2);
  const [nueva, vieja] = r.cuerpo.copias;
  assert.equal(nueva.sal, salDe(bytes)); assert.equal(nueva.meta, META);
  assert.equal(nueva.sesiones, undefined);
  assert.equal(vieja.fecha, '2026-11-01T10:00:00.000Z');
  assert.equal(vieja.sesiones, 3); assert.equal(vieja.ultima, '2026-10-31');
  assert.ok(r.cuerpo.copias.every(c => c.nombre.startsWith('copias/victor/') && !('persona' in c)));
});

test('bajar: devuelve los bytes; una copia de la otra persona o un nombre raro → 400; si no está → 404', async () => {
  const bytes = cifrado(1234);
  const nombre = (await subir(bytes)).cuerpo.copia.nombre;
  const r = await json({ accion: 'bajar', persona: 'victor', nombre });
  assert.equal(r.codigo, 200);
  assert.equal(r.cabeceras['content-type'], 'application/octet-stream');
  assert.equal(r.cabeceras['cache-control'], 'no-store');
  assert.deepEqual(r.bytes, bytes);
  assert.equal((await json({ accion: 'bajar', persona: 'virginia', nombre })).codigo, 400);
  for (const n of ['../copias/victor/x.bin', 'copias/victor/../../secreto', '', null, 42]) assert.equal((await json({ accion: 'bajar', persona: 'victor', nombre: n })).codigo, 400);
  assert.equal((await json({ accion: 'bajar', persona: 'victor', nombre: v2('victor', new Date('2020-01-01T00:00:00Z')) })).codigo, 404);
});

// ── Retención ──
test('retención con un calendario simulado: 14 días (horas distintas) todas, 3 meses una por semana, 2 años una por mes', () => {
  const ahora = Date.parse('2026-11-20T12:00:00Z');
  const copias = [];
  // Cuatro copias al día durante 3 años hacia atrás.
  for (let d = 0; d < 3 * 365; d++) for (const hora of [8, 12, 18, 22]) {
    const f = new Date(ahora - d * 864e5); f.setUTCHours(hora, 0, 0, 0);
    if (f.getTime() > ahora) continue;
    copias.push({ nombre: v2('victor', f), fecha: f.toISOString() });
  }
  const fuera = new Set(sobrantes(copias, ahora));
  const quedan = copias.filter(c => !fuera.has(c.nombre));
  const edad = c => (ahora - Date.parse(c.fecha)) / 864e5;
  // Todas las de los últimos 14 días.
  assert.ok(copias.filter(c => edad(c) <= 14).every(c => !fuera.has(c.nombre)));
  // Entre 14 días y 3 meses: como mucho una por semana (unas 11-12 semanas).
  const semanales = quedan.filter(c => edad(c) > 14 && edad(c) <= 92);
  assert.ok(semanales.length >= 10 && semanales.length <= 13, `semanales ${semanales.length}`);
  const lunes = c => { const d = new Date(c.fecha); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString(); };
  assert.equal(new Set(semanales.map(lunes)).size, semanales.length, 'una por semana (de lunes a domingo)');
  // Entre 3 meses y 2 años: una por mes (unos 21).
  const mensuales = quedan.filter(c => edad(c) > 92 && edad(c) <= 730);
  assert.ok(mensuales.length >= 20 && mensuales.length <= 23, `mensuales ${mensuales.length}`);
  assert.equal(new Set(mensuales.map(c => c.fecha.slice(0, 7))).size, mensuales.length);
  // Nada de más de 2 años.
  assert.equal(quedan.filter(c => edad(c) > 730).length, 0);
  // De cada semana entera se queda la más nueva: la del domingo a las 22:00.
  const s = new Date(semanales[1].fecha);
  assert.deepEqual([s.getUTCDay(), s.getUTCHours()], [0, 22]);
});

test('retención: la única copia (aunque tenga 3 años) no se borra nunca', () => {
  const ahora = Date.parse('2026-11-20T12:00:00Z');
  const c = { nombre: 'a', fecha: '2023-01-01T00:00:00.000Z' };
  assert.deepEqual(sobrantes([c], ahora), []);
  assert.deepEqual(sobrantes([c, { nombre: 'b', fecha: '2022-01-01T00:00:00.000Z' }], ahora), ['b']);
});

test('al subir se borran las que sobran (solo de esa persona) y borrar-viejas hace lo mismo', async () => {
  const viejo = new Date(Date.now() - 800 * 864e5);
  const pon = (p, f) => { const n = v2(p, f); blob.blobs.set(n, { pathname: n, bytes: cifrado(), uploadedAt: f }); return n; };
  const vic = pon('victor', viejo), vir = pon('virginia', viejo);
  const r = await subir();
  assert.equal(r.cuerpo.borradas, 1);
  assert.ok(!blob.blobs.has(vic));
  assert.ok(blob.blobs.has(vir), 'la de la otra persona no se toca');
  await subir(cifrado(), { persona: 'virginia' });
  assert.ok(!blob.blobs.has(vir));
  const v3 = pon('victor', new Date(Date.now() - 900 * 864e5));
  const b = await json({ accion: 'borrar-viejas', persona: 'victor' });
  assert.equal(b.codigo, 200);
  assert.equal(b.cuerpo.borradas, 1);
  assert.ok(!blob.blobs.has(v3));
});

test('nombres: ida y vuelta (v2 y v1) y rechazo de lo que no encaja', () => {
  const f = new Date('2026-11-20T18:40:05.123Z');
  const sal = randomBytes(16).toString('base64url');
  const n = nombreCopia('virginia', f, sal, META);
  assert.deepEqual(leerNombre(n), { nombre: n, persona: 'virginia', fecha: f.toISOString(), sal, meta: META });
  const n1 = nombreCopiaV1('virginia', f, 7, '2026-11-20');
  assert.deepEqual(leerNombre(n1), { nombre: n1, persona: 'virginia', fecha: f.toISOString(), sesiones: 7, ultima: '2026-11-20' });
  for (const x of ['copias/otro/' + n.split('/')[2], n.replace('.bin', '.txt'), n + '/x', 'x' + n, n.replace('_k', '_q')]) assert.equal(leerNombre(x), null);
});

// ── Ritmo ──
test('ritmo: un móvil en bucle recibe 429 tras 20 subidas en 10 minutos', async () => {
  const codigos = [];
  for (let i = 0; i < 22; i++) codigos.push((await subir()).codigo);
  assert.deepEqual(codigos.slice(0, 20), Array(20).fill(200));
  assert.equal(codigos[21], 429);
  // La otra persona no se ve afectada.
  assert.equal((await subir(cifrado(), { persona: 'virginia' })).codigo, 200);
});

test('retención en los últimos 14 días: como mucho la última de cada hora y 10 por día', () => {
  const ahora = Date.parse('2026-11-20T23:59:00Z');
  const copias = [];
  // Hoy y hace 3 días: una copia cada 10 minutos de 6:00 a 23:50 (18 horas, 6 por hora).
  for (const d of [0, 3]) for (let m = 6 * 60; m < 24 * 60; m += 10) {
    const f = new Date(ahora - d * 864e5); f.setUTCHours(0, m, 0, 0);
    if (f.getTime() <= ahora) copias.push({ nombre: 'c' + d + '-' + m, fecha: f.toISOString() });
  }
  const fuera = new Set(sobrantes(copias, ahora));
  const quedan = copias.filter(c => !fuera.has(c.nombre));
  for (const dia of ['2026-11-20', '2026-11-17']) {
    const delDia = quedan.filter(c => c.fecha.startsWith(dia));
    assert.equal(delDia.length, 10, dia);
    assert.equal(new Set(delDia.map(c => c.fecha.slice(0, 13))).size, 10, 'una por hora');
    // Las que quedan son las últimas de su hora (xx:50) y de las últimas horas del día.
    assert.ok(delDia.every(c => c.fecha.slice(14, 16) === '50'));
    assert.equal(delDia.map(c => c.fecha.slice(11, 13)).sort()[0], '14');
  }
});

test('tope de 30 subidas al día por persona (contador en el Blob, aunque la retención borre copias)', async () => {
  const codigos = [];
  for (let i = 0; i < SUBIDAS_DIA + 2; i++) { reiniciarRitmo(); codigos.push((await subir()).codigo); }
  assert.deepEqual(codigos.slice(0, SUBIDAS_DIA), Array(SUBIDAS_DIA).fill(200));
  assert.equal(codigos[SUBIDAS_DIA], 429);
  assert.ok(copiasEn().length <= 10, 'la retención deja como mucho 10 de hoy');
  reiniciarRitmo();
  assert.equal((await subir(cifrado(), { persona: 'virginia' })).codigo, 200);
  // Los contadores de otros días se limpian al subir.
  blob.blobs.set('cuentas/virginia/2020-01-01.json', { pathname: 'cuentas/virginia/2020-01-01.json', bytes: Buffer.from('{"n":3}'), uploadedAt: new Date() });
  reiniciarRitmo(); await subir(cifrado(), { persona: 'virginia' });
  assert.ok(!blob.blobs.has('cuentas/virginia/2020-01-01.json'));
});

// ── Vistas previas: copias aparte de las de producción ──
test('en una vista previa (o sin VERCEL_ENV) las copias y los contadores van bajo preview/ y no se ven desde producción', async () => {
  for (const entorno of ['preview', 'development', undefined]) {
    blob = new BlobSimulado(); ponerAlmacen(blob); reiniciarRitmo();
    if (entorno) process.env.VERCEL_ENV = entorno; else delete process.env.VERCEL_ENV;
    const r = await subir();
    assert.equal(r.codigo, 200, String(entorno));
    const claves = [...blob.blobs.keys()];
    assert.ok(claves.length >= 2 && claves.every(k => k.startsWith('preview/')), `${entorno}: ${claves.join(', ')}`);
    assert.match(r.cuerpo.copia.nombre, /^preview\/copias\/victor\//);
    const l = await json({ accion: 'listar', persona: 'victor' });
    assert.equal(l.cuerpo.copias.length, 1);
    const b = await json({ accion: 'bajar', persona: 'victor', nombre: r.cuerpo.copia.nombre });
    assert.equal(b.codigo, 200);
    // Producción no las lista ni las baja (ni al revés).
    process.env.VERCEL_ENV = 'production';
    assert.equal((await json({ accion: 'listar', persona: 'victor' })).cuerpo.copias.length, 0);
    assert.equal((await json({ accion: 'bajar', persona: 'victor', nombre: r.cuerpo.copia.nombre })).codigo, 400);
    const p = await subir();
    assert.match(p.cuerpo.copia.nombre, /^copias\/victor\//);
    if (entorno) process.env.VERCEL_ENV = entorno; else delete process.env.VERCEL_ENV;
    assert.deepEqual((await json({ accion: 'listar', persona: 'victor' })).cuerpo.copias.map(c => c.nombre), [r.cuerpo.copia.nombre]);
  }
});
