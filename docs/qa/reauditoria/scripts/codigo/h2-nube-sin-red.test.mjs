// Copias en la nube (js/nucleo/copia.js) con WebCrypto de Node y api/copia.js con un Blob simulado:
// cifrado ida y vuelta, frase incorrecta, archivo cortado o alterado, IV nunca repetido, clave no exportable,
// qué ve el servidor, activar/cambiar la frase/restaurar y los disparadores (sesión, cambios con espera,
// apertura > 24 h, sin red → reintento, nunca dos a la vez, nunca en el rescate).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { est, cargarCon, hecha } from './ayuda/node.mjs';
import { modulo, estadoBase } from './ayuda/comun.mjs';
import { BlobSimulado, fetchNube, ClavesMemoria } from './ayuda/nube.mjs';
import { ponerReloj, ponerAlmacen, nombreCopiaV1 } from '../api/copia.js';

const C = await import(modulo('js/nucleo/copia.js'));
process.env.VERCEL_ENV = 'production'; // rutas del Blob de producción (copias/…); las de las vistas previas, en tests/api/copia.test.mjs
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

test('cabecera: marca PIPC, versión 2, PBKDF2-SHA-256 con ≥ 600 000 iteraciones, sal de 16 e IV de 12', async () => {
  const k = await claveDe();
  const b = await C.cifrar('{}', k);
  assert.deepEqual([...b.slice(0, 4)], [0x50, 0x49, 0x50, 0x43]);
  const c = C.leerCabecera(b);
  assert.equal(c.version, 2);
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

test('versión 2: metadatos dentro del cifrado; la versión 1 se sigue leyendo', async () => {
  const k = await claveDe();
  const estadoTxt = JSON.stringify({ version: 4, dueño: 'victor', perfil: {} });
  const meta = { persona: 'victor', creada: '2026-11-20T18:40:00.000Z', sesiones: 7, ultima: '2026-11-19' };
  const v2 = await C.abrirArchivo(await C.cifrar(C.empaquetar(meta, estadoTxt), k), k.clave);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.meta, meta);
  assert.deepEqual(JSON.parse(v2.estado), JSON.parse(estadoTxt));
  const v1 = await C.abrirArchivo(await C.cifrar(estadoTxt, k, { version: 1 }), k.clave);
  assert.equal(v1.version, 1); assert.equal(v1.meta, null); assert.equal(v1.estado, estadoTxt);
  // Un texto v2 sin la forma esperada → dañada.
  await assert.rejects(C.abrirArchivo(await C.cifrar('{"hola":1}', k), k.clave), e => e.codigo === 'dañada');
  // Versión desconocida → aviso de actualizar.
  const x = await C.cifrar('{}', k); x[4] = 3;
  await assert.rejects(C.abrirArchivo(x, k.clave), e => e.codigo === 'version');
});

test('metadatos del nombre: cifrados, atados a la persona y que no abren con otra clave', async () => {
  const k = await claveDe(), otra = await claveDe('otra frase cualquiera');
  const t = await C.cifrarNombre({ sesiones: 42, ultima: '2026-11-19' }, k.clave, 'victor');
  assert.match(t, /^[\w-]{40,200}$/);
  assert.doesNotMatch(Buffer.from(t, 'base64url').toString('latin1'), /42|2026/);
  assert.deepEqual(await C.descifrarNombre(t, k.clave, 'victor'), { sesiones: 42, ultima: '2026-11-19' });
  assert.equal(await C.descifrarNombre(t, k.clave, 'virginia'), null);
  assert.equal(await C.descifrarNombre(t, otra.clave, 'victor'), null);
  assert.equal(await C.descifrarNombre('basura!!', k.clave, 'victor'), null);
});

test('frases: la propuesta son 6 palabras distintas de la lista; se rechazan las de baja entropía', () => {
  const vistas = new Set();
  for (let i = 0; i < 50; i++) {
    const f = C.generarFrase();
    const p = f.split(' ');
    assert.equal(p.length, 6);
    assert.ok(C.calidadFrase(f).ok || new Set(p).size < 6, f); // (una palabra repetida es posible por azar)
    vistas.add(f);
  }
  assert.equal(vistas.size, 50);
  for (const mala of ['corta', 'aaaaaaaaaaaaaaaa', 'abcabcabcabcabc', 'electroencefalografista', 'hola hola hola hola', '123456789012', 'contraseña1234', 'qwertyuiopasdf']) {
    assert.equal(C.calidadFrase(mala).ok, false, mala);
  }
  for (const buena of ['caballo grapa batería correcta', 'Mi perro Tobi come 3 manzanas', 'x7#Kq9!mZ2@pL']) assert.equal(C.calidadFrase(buena).ok, true, buena);
});

// ── Con la función y el Blob simulado ──
let blob, f, claves, reloj, temporizadores, red;
const sinPerfil = () => estadoBase({ ajustes: { codigo: 'secreto', vibrar: true, sonido: true } });
function preparar(datos = sinPerfil()) {
  cargarCon({ pipos4: datos });
  blob = new BlobSimulado(); f = fetchNube(blob); claves = new ClavesMemoria();
  reloj = Date.parse('2026-11-20T18:40:00Z'); temporizadores = []; red = true;
  ponerReloj(() => reloj);
  C.configurarCopia({
    almacen: claves, fetch: f, enLinea: () => red, ahora: () => reloj,
    setTimeout: (fn, ms) => { const t = { fn, ms, vivo: true }; temporizadores.push(t); return t; },
    clearTimeout: t => { if (t) t.vivo = false; },
    bloqueo: (n, fn) => fn(), cuandoLibre: () => Promise.resolve(),
  });
  C.reiniciarCopia();
}
const pasar = ms => { for (const t of temporizadores.filter(x => x.vivo)) { t.ms -= ms; if (t.ms <= 0) { t.vivo = false; t.fn(); } } };
const subidas = () => f.peticiones.filter(p => p.init.headers['x-copia-accion'] === 'subir');
const esperarSubida = () => C.subidaEnCurso() || Promise.resolve();
const hora = () => { reloj += 3600e3; }; // la retención deja una copia por hora: las pruebas avanzan el reloj
const sesion = (dias = 0) => est.cambiar(S => { hecha(S, dias, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
beforeEach(() => preparar());

const _ls = new Map(); globalThis.localStorage = { getItem: k => _ls.has(k) ? _ls.get(k) : null, setItem: (k, v) => _ls.set(k, String(v)), removeItem: k => _ls.delete(k) }; // como en el navegador: sobrevive a cerrar la app
// H2 (T11): sesión terminada sin red (piscina), app cerrada; al abrir con red antes de 24 h no se copia.
test('H2a: sesión terminada sin red y app reabierta con red en menos de 24 h → copia de esa sesión', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();            // copia de apertura
  const n = subidas().length;
  hora(); red = false; sesion();       // termina la sesión en la piscina, sin cobertura
  await esperarSubida();
  assert.equal(subidas().length, n, 'sin red no sube (bien)');
  // Cierra la app. Más tarde, en casa y con red, la vuelve a abrir (módulo recién cargado).
  reloj += 2 * 3600e3; red = true;
  C.reiniciarCopia();
  const r = await C.iniciarCopias();
  await esperarSubida();
  console.log('H2a revisarApertura →', r, 'subidas', n, '→', subidas().length);
  assert.equal(subidas().length, n + 1, `al abrir con red no se ha subido la sesión hecha sin red (revisarApertura → ${r})`);
});

// H2b: «red que miente» (navigator.onLine true pero fetch falla): no hay evento «online» y no se reintenta.
test('H2b: fetch falla con onLine=true y la red vuelve sin evento online → se reintenta sola', async () => {
  _ls.clear(); C.reiniciarCopia();
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  const n = subidas().length;
  hora(); f.sinRed = true; sesion(); await esperarSubida();
  f.sinRed = false;                    // vuelve la cobertura; el navegador nunca creyó estar sin red
  pasar(30 * 60e3); await esperarSubida();
  const ok = subidas().filter(p => !p.fallo).length; console.log('H2b peticiones de subida', n, '→', subidas().length, 'nube', JSON.stringify(C.estadoNube ? C.estadoNube() : null));
  const exitos = [...blob.blobs.values()].filter(b => b.pathname.startsWith('copias/')).length;
  assert.equal(exitos, 2, `tras 30 min con red solo hay ${exitos} copia(s) en el Blob: la sesión no se ha subido`);
});
