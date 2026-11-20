// Copias en la nube (js/nucleo/copia.js) con WebCrypto de Node y api/copia.js con un Blob simulado:
// cifrado ida y vuelta, frase incorrecta, archivo cortado o alterado, IV nunca repetido, clave no exportable,
// qué ve el servidor, activar/cambiar la frase/restaurar y los disparadores (sesión, cambios con espera,
// apertura > 24 h, sin red → reintento, nunca dos a la vez, nunca en el rescate).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { est, cargarCon, hecha } from './ayuda/node.mjs';
import { modulo, estadoBase } from './ayuda/comun.mjs';
import { BlobSimulado, fetchNube, ClavesMemoria } from './ayuda/nube.mjs';

const C = await import(modulo('js/nucleo/copia.js'));
const N = await import(modulo('js/nucleo/normalizar.js'));
const FRASE = 'caballo grapa batería correcta';
const sal = () => C.nuevaSal();

// ── Formato y cifrado ──
const claveDe = async (frase = FRASE, s = sal()) => ({ clave: await C.derivarClave(frase, s), sal: s, iteraciones: C.ITERACIONES });

test('ida y vuelta: lo que se cifra es lo que se descifra (texto con tildes y emojis)', async () => {
  const k = await claveDe();
  const txt = JSON.stringify({ dueño: 'virginia', nota: 'Me duele la cadera 🦵 ñandú', n: [1, 2, 3] }).repeat(50);
  const b = await C.cifrar(txt, k);
  assert.equal(await C.descifrar(b, k.clave), txt);
  // Con la frase y la sal de la cabecera (móvil nuevo).
  assert.equal(await C.descifrar(b, (s, it) => C.derivarClave(FRASE, s, it)), txt);
});

test('cabecera: marca PIPC, versión 1, PBKDF2-SHA-256 con ≥ 600 000 iteraciones, sal de 16 e IV de 12', async () => {
  const k = await claveDe();
  const b = await C.cifrar('{}', k);
  assert.deepEqual([...b.slice(0, 4)], [0x50, 0x49, 0x50, 0x43]);
  const c = C.leerCabecera(b);
  assert.equal(c.version, 1);
  assert.ok(c.iteraciones >= 600000);
  assert.deepEqual([...c.sal], [...k.sal]);
  assert.equal(c.iv.length, 12);
});

test('frase incorrecta → ErrorNube «frase» con un mensaje claro', async () => {
  const k = await claveDe();
  const b = await C.cifrar('{"a":1}', k);
  await assert.rejects(C.descifrar(b, (s, it) => C.derivarClave('otra frase distinta', s, it)), e => e instanceof C.ErrorNube && e.codigo === 'frase' && /frase no es la correcta/.test(e.message));
});

test('archivo cortado o alterado (cabecera y cuerpo) → error controlado, nunca datos', async () => {
  const k = await claveDe();
  const b = await C.cifrar(JSON.stringify({ x: 'y'.repeat(500) }), k);
  const prueba = async (bytes, que) => {
    await assert.rejects(C.descifrar(bytes, k.clave), e => e instanceof C.ErrorNube && ['frase', 'dañada', 'version'].includes(e.codigo), que);
  };
  for (const n of [0, 3, 20, 40, 56, b.length - 1]) await prueba(b.slice(0, n), 'cortado a ' + n);
  // Un byte cambiado en cada parte: marca, versión, kdf, iteraciones, sal, IV, cuerpo y etiqueta.
  for (const i of [0, 4, 5, 7, 9, 12, 26, 30, 39, 45, b.length - 1]) {
    const x = b.slice(); x[i] ^= 0x01;
    await prueba(x, 'byte ' + i);
  }
  // Iteraciones rebajadas (para forzar fuerza bruta) o disparatadas (para colgar el móvil): rechazadas sin derivar.
  for (const it of [1000, 599999, 0xffffffff]) {
    const x = b.slice(); new DataView(x.buffer).setUint32(6, it, false);
    let derivado = false;
    await assert.rejects(C.descifrar(x, () => { derivado = true; return k.clave; }), e => e.codigo === 'dañada');
    assert.equal(derivado, false);
  }
  await assert.rejects(C.descifrar(new TextEncoder().encode('{"version":4}'), k.clave), e => e.codigo === 'dañada');
});

test('el IV nunca se repite (500 copias con la misma clave) y el cifrado cambia aunque el texto no', async () => {
  const k = await claveDe();
  const ivs = new Set(), cuerpos = new Set();
  for (let i = 0; i < 500; i++) {
    const b = await C.cifrar('mismo texto', k);
    ivs.add(Buffer.from(C.leerCabecera(b).iv).toString('hex'));
    cuerpos.add(Buffer.from(b).toString('hex'));
  }
  assert.equal(ivs.size, 500);
  assert.equal(cuerpos.size, 500);
});

test('la clave derivada no es exportable y sirve solo para cifrar y descifrar', async () => {
  const k = await C.derivarClave(FRASE, sal());
  assert.equal(k.extractable, false);
  assert.deepEqual([...k.usages].sort(), ['decrypt', 'encrypt']);
  assert.equal(k.algorithm.name, 'AES-GCM'); assert.equal(k.algorithm.length, 256);
  await assert.rejects(crypto.subtle.exportKey('raw', k));
});

test('misma frase con otra sal da otra clave (la sal es por persona)', async () => {
  const a = await claveDe(FRASE), b = await claveDe(FRASE);
  const x = await C.cifrar('{}', a);
  await assert.rejects(C.descifrar(x, b.clave), e => e.codigo === 'frase');
});

// ── Con la función y el Blob simulado ──
let blob, f, claves, reloj, temporizadores, red;
function preparar(datos = estadoBase({ ajustes: { codigo: 'secreto', vibrar: true, sonido: true } })) {
  cargarCon({ pipos4: datos });
  blob = new BlobSimulado(); f = fetchNube(blob); claves = new ClavesMemoria();
  reloj = Date.parse('2026-11-20T18:40:00Z'); temporizadores = []; red = true;
  C.configurarCopia({
    almacen: claves, fetch: f, enLinea: () => red, ahora: () => reloj,
    setTimeout: (fn, ms) => { const t = { fn, ms, vivo: true }; temporizadores.push(t); return t; },
    clearTimeout: t => { if (t) t.vivo = false; },
    bloqueo: (n, fn) => fn(),
  });
  C.reiniciarCopia();
}
const pasar = ms => { for (const t of temporizadores.filter(x => x.vivo)) { t.ms -= ms; if (t.ms <= 0) { t.vivo = false; t.fn(); } } };
const subidas = () => f.peticiones.filter(p => p.init.headers['x-copia-accion'] === 'subir');
const esperarSubida = () => C.subidaEnCurso() || Promise.resolve();
beforeEach(() => preparar());

test('el servidor solo ve bytes cifrados: nada del estado en claro en lo subido ni en las cabeceras', async () => {
  est.cambiar(S => { S.perfil.notas = 'SECRETO-DE-SALUD rodilla'; S.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 6, desde: '2026-01-01', nota: 'menisco', activa: true }); }, 'x');
  hecha(est.estado(), 1, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]);
  await C.activar('victor', FRASE);
  assert.equal(await C.copiarAhora('prueba'), 'ok');
  const [g] = [...blob.blobs.values()];
  const comoTexto = g.bytes.toString('latin1');
  for (const x of ['SECRETO', 'rodilla', 'menisco', 'victor', 'press', '"perfil"']) assert.ok(!comoTexto.includes(x), x);
  assert.equal(g.opciones.access, 'private');
  assert.match(g.pathname, /^copias\/victor\/.+_s1_u\d{4}-\d{2}-\d{2}\.bin$/);
  const cab = subidas()[0].init.headers;
  assert.deepEqual(Object.keys(cab).sort(), ['Content-Type', 'x-app-code', 'x-copia-accion', 'x-copia-persona', 'x-copia-sesiones', 'x-copia-ultima']);
  // Y con la frase se recupera el estado exportado (sin el código de acceso).
  const t = await C.descifrar(new Uint8Array(g.bytes), (s, it) => C.derivarClave(FRASE, s, it));
  const x = JSON.parse(t);
  assert.equal(x.perfil.notas, 'SECRETO-DE-SALUD rodilla');
  assert.equal(x.ajustes.codigo, '');
});

test('la frase no se guarda: solo la clave (no exportable) y la sal', async () => {
  await C.activar('victor', FRASE);
  const r = claves.regs.get('victor');
  assert.deepEqual(Object.keys(r).sort(), ['clave', 'creada', 'iteraciones', 'persona', 'sal']);
  assert.equal(r.clave.extractable, false);
  assert.ok(!JSON.stringify(r).includes(FRASE));
  assert.equal(r.sal.length, 16);
});

test('frase corta → error; activar con una frase que no abre la copia que ya hay → aviso «otra-frase»', async () => {
  await assert.rejects(C.activar('victor', 'corta'), e => e.codigo === 'corta');
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  await assert.rejects(C.activar('victor', 'una frase completamente distinta'), e => e.codigo === 'otra-frase');
  // Con la misma frase en otro móvil: se reutiliza la sal de la nube (misma clave).
  const antes = claves.regs.get('victor').sal;
  claves.regs.clear();
  await C.activar('victor', FRASE);
  assert.deepEqual([...claves.regs.get('victor').sal], [...antes]);
});

test('cambiar la frase: sal nueva; las copias nuevas con ella y las viejas siguen con la anterior', async () => {
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  const vieja = [...blob.blobs.keys()][0];
  const salVieja = claves.regs.get('victor').sal;
  await C.cambiarFrase('victor', 'la frase nueva de este año');
  assert.notDeepEqual([...claves.regs.get('victor').sal], [...salVieja]);
  reloj += 1000;
  await C.copiarAhora();
  const nueva = [...blob.blobs.keys()].find(k => k !== vieja);
  await assert.rejects(C.abrirCopia('victor', vieja), e => e.codigo === 'pide-frase');
  assert.ok((await C.abrirCopia('victor', vieja, { frase: FRASE })).texto);
  await assert.rejects(C.abrirCopia('victor', vieja, { frase: 'la frase nueva de este año' }), e => e.codigo === 'frase');
  assert.ok((await C.abrirCopia('victor', nueva)).texto);
});

test('restaurar desde un móvil nuevo: elegir persona + frase → importar() deja los mismos datos', async () => {
  hecha(est.estado(), 2, [{ id: 'press-pecho-maquina', sets: [[50, 8]] }]);
  est.cambiar(S => { S.medidas.push({ fecha: '2026-11-18', peso: 81.5 }); }, 'x');
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  // Lo que debe quedar: la copia tal como la deja el normalizador (importar() siempre pasa por él).
  const original = JSON.parse(JSON.stringify(N.normalizarEstado(JSON.parse(est.exportar())).estado));
  // Móvil nuevo: almacén vacío, sin clave, sin código.
  cargarCon({}); claves.regs.clear(); C.reiniciarCopia();
  const lista = await C.listar('victor', { codigo: 'secreto' });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].sesiones, 1);
  await assert.rejects(C.abrirCopia('victor', lista[0].nombre, { frase: 'no es esta frase', codigo: 'secreto' }), e => e.codigo === 'frase');
  assert.equal(est.estado().dueño, null, 'una frase mala no toca nada');
  const { texto, recordar } = await C.abrirCopia('victor', lista[0].nombre, { frase: FRASE, codigo: 'secreto' });
  est.importar(texto);
  assert.deepEqual(JSON.parse(est.exportar()), original);
  await recordar();
  assert.ok(claves.regs.get('victor'), 'tras restaurar se recuerda la clave para seguir copiando');
});

// ── Disparadores ──
test('al terminar una sesión se sube una copia enseguida', async () => {
  await C.activar('victor', FRASE);
  C.iniciarCopias(); await esperarSubida(); // apertura: primera copia
  const n = subidas().length;
  est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
  await esperarSubida();
  assert.equal(subidas().length, n + 1);
  assert.equal(subidas().at(-1).init.headers['x-copia-sesiones'], '1');
});

test('cambios de perfil, lesiones o medidas: espera 1 minuto sin cambios y sube una sola', async () => {
  await C.activar('victor', FRASE);
  C.iniciarCopias(); await esperarSubida();
  const n = subidas().length;
  est.cambiar(S => { S.perfil.nivel = 2; }, 'perfil');
  pasar(30e3);
  est.cambiar(S => { S.perfil.notas = 'algo'; }, 'perfil-silencio');
  pasar(40e3);
  assert.equal(subidas().length, n, 'aún no: el segundo cambio reinicia la espera');
  est.cambiar(S => { S.medidas.push({ fecha: '2026-11-20', peso: 80 }); }, 'medidas');
  pasar(59e3); assert.equal(subidas().length, n);
  pasar(1e3); await esperarSubida();
  assert.equal(subidas().length, n + 1);
  // Otros motivos (gustos, plan) no copian.
  est.cambiar(S => { S.plan = null; }, 'plan'); pasar(120e3); await esperarSubida();
  assert.equal(subidas().length, n + 1);
});

test('al abrir: copia si la última tiene más de 24 h, no si es reciente', async () => {
  await C.activar('victor', FRASE);
  assert.equal(await C.revisarApertura(), 'ok');
  reloj += 23 * 3600e3;
  assert.equal(await C.revisarApertura(), 'reciente');
  reloj += 2 * 3600e3;
  assert.equal(await C.revisarApertura(), 'ok');
  assert.equal(subidas().length, 2);
});

test('sin red no se intenta y se reintenta al volver la conexión', async () => {
  await C.activar('victor', FRASE);
  red = false;
  assert.equal(await C.copiarAhora('sesion'), 'sin-red');
  assert.equal(subidas().length, 0);
  red = true;
  C._alVolverRed(); await esperarSubida();
  assert.equal(subidas().length, 1);
  // Si falla la conexión a mitad (fetch lanza), también queda pendiente.
  f.sinRed = true;
  assert.equal(await C.copiarAhora(), 'sin-red');
  f.sinRed = false;
  C._alVolverRed(); await esperarSubida();
  assert.equal(subidas().length, 3);
  // Sin nada pendiente, volver la red no sube nada.
  C._alVolverRed(); await esperarSubida();
  assert.equal(subidas().length, 3);
});

test('nunca dos subidas a la vez: lo que llega mientras sube se junta en una sola al acabar', async () => {
  await C.activar('victor', FRASE);
  let enVuelo = 0, maximo = 0;
  const base = f;
  C.configurarCopia({ fetch: async (...a) => { enVuelo++; maximo = Math.max(maximo, enVuelo); await new Promise(r => setTimeout(r, 20)); try { return await base(...a); } finally { enVuelo--; } } });
  const p1 = C.copiarAhora(); C.copiarAhora(); C.copiarAhora(); C.copiarAhora();
  await p1; await esperarSubida(); await esperarSubida();
  assert.equal(maximo, 1);
  assert.equal(subidas().length, 2, 'la primera y una más con lo último');
});

test('nunca durante el rescate', async () => {
  await C.activar('victor', FRASE);
  cargarCon({ pipos4: '{roto' });
  assert.ok(est.estadoGuardado().rescate);
  assert.equal(await C.copiarAhora(), 'sin-dueño');
  est.estado().dueño = 'victor';
  assert.equal(await C.copiarAhora(), 'rescate');
  assert.equal(subidas().length, 0);
});

test('sin almacén Blob (503): queda marcado «inactiva», con aviso, y no se rompe nada', async () => {
  await C.activar('victor', FRASE);
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
  const { ponerAlmacen } = await import('../api/copia.js');
  ponerAlmacen(null);
  assert.equal(await C.copiarAhora(), 'inactiva');
  const n = C.estadoNube();
  assert.equal(n.inactiva, true);
  assert.equal(n.avisar, true);
  assert.equal(est.estado().dueño, 'victor');
  ponerAlmacen(blob);
  assert.equal(await C.copiarAhora(), 'ok');
  assert.equal(C.estadoNube().inactiva, false);
});

test('aviso si pasan más de 3 días sin copia', async () => {
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  assert.equal(C.estadoNube().avisar, false);
  reloj += 3 * 864e5 + 1;
  assert.equal(C.estadoNube().avisar, true);
});

test('sin activar en este móvil no se sube nada (ni al abrir, ni al terminar una sesión)', async () => {
  C.iniciarCopias();
  est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
  await esperarSubida();
  assert.equal(f.peticiones.length, 0);
  assert.equal(C.estadoNube().activada, false);
});
