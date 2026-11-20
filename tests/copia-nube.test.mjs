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

test('el servidor solo ve bytes cifrados: nada del estado en claro en lo subido, en el nombre ni en las cabeceras', async () => {
  est.cambiar(S => { S.perfil.notas = 'SECRETO-DE-SALUD rodilla'; S.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 6, desde: '2026-01-01', nota: 'menisco', activa: true }); }, 'x');
  hecha(est.estado(), 1, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]);
  await C.activar('victor', FRASE);
  assert.equal(await C.copiarAhora('prueba'), 'ok');
  const [g] = [...blob.blobs.values()].filter(b => b.pathname.startsWith('copias/'));
  const comoTexto = g.bytes.toString('latin1') + g.pathname;
  for (const x of ['SECRETO', 'rodilla', 'menisco', 'press', '"perfil"']) assert.ok(!comoTexto.includes(x), x);
  assert.equal(g.opciones.access, 'private');
  assert.match(g.pathname, /^copias\/victor\/[^_]+_k[\w-]{22}_m[\w-]+\.bin$/);
  const cab = subidas()[0].init.headers;
  assert.deepEqual(Object.keys(cab).sort(), ['Content-Type', 'x-app-code', 'x-copia-accion', 'x-copia-meta', 'x-copia-persona', 'x-copia-sal']);
  // Con la frase se recupera el estado exportado (sin el código de acceso) y sus metadatos.
  const a = await C.abrirArchivo(new Uint8Array(g.bytes), (s, it) => C.derivarClave(FRASE, s, it));
  assert.equal(JSON.parse(a.estado).perfil.notas, 'SECRETO-DE-SALUD rodilla');
  assert.equal(JSON.parse(a.estado).ajustes.codigo, '');
  assert.deepEqual({ ...a.meta, creada: null }, { persona: 'victor', creada: null, sesiones: 1, ultima: est.hoyISO(new Date(Date.now() - 864e5)) });
});

test('la frase no se guarda: solo la clave (no exportable) y la sal', async () => {
  await C.activar('victor', FRASE);
  const r = claves.regs.get('victor');
  assert.deepEqual(Object.keys(r).sort(), ['clave', 'creada', 'iteraciones', 'persona', 'sal']);
  assert.equal(r.clave.extractable, false);
  assert.ok(!JSON.stringify(r).includes(FRASE));
  assert.equal(r.sal.length, 16);
});

test('activar: frase floja → error; con copias que no abre → «otra-frase»; con la misma frase en otro móvil, misma sal', async () => {
  await assert.rejects(C.activar('victor', 'corta'), e => e.codigo === 'corta');
  await assert.rejects(C.activar('victor', 'electroencefalografista'), e => e.codigo === 'corta');
  await C.activar('victor', FRASE);
  sesion(); await C.copiarAhora();
  await assert.rejects(C.activar('victor', 'una frase completamente distinta'), e => e.codigo === 'otra-frase');
  const antes = claves.regs.get('victor').sal;
  claves.regs.clear();
  const r = await C.activar('victor', FRASE);
  assert.deepEqual([...claves.regs.get('victor').sal], [...antes]);
  assert.equal(r.abren, 1);
});

test('cambiar la frase: sal nueva; las copias nuevas con ella y las viejas siguen con la anterior', async () => {
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  const vieja = [...blob.blobs.keys()].find(k => k.startsWith('copias/'));
  const salVieja = claves.regs.get('victor').sal;
  await C.cambiarFrase('victor', 'la frase nueva de este año');
  assert.notDeepEqual([...claves.regs.get('victor').sal], [...salVieja]);
  hora();
  await C.copiarAhora();
  const nueva = [...blob.blobs.keys()].find(k => k.startsWith('copias/') && k !== vieja);
  await assert.rejects(C.abrirCopia('victor', vieja), e => e.codigo === 'pide-frase');
  assert.ok((await C.abrirCopia('victor', vieja, { frase: FRASE })).texto);
  await assert.rejects(C.abrirCopia('victor', vieja, { frase: 'la frase nueva de este año' }), e => e.codigo === 'frase');
  assert.ok((await C.abrirCopia('victor', nueva)).texto);
});

test('M2: probar la frase no depende de la más nueva: frases antiguas y copias basura no bloquean', async () => {
  await C.activar('victor', FRASE);
  sesion(); await C.copiarAhora();
  hora(); await C.cambiarFrase('victor', 'la frase nueva de este año'); await C.copiarAhora();
  // Alguien con el código sube una copia basura (bien formada, con otra sal), que pasa a ser la más nueva.
  hora();
  const basura = new Uint8Array(200); crypto.getRandomValues(basura); basura.set([0x50, 0x49, 0x50, 0x43, 2], 0);
  await f('/api/copia', { method: 'POST', headers: { 'x-app-code': 'secreto', 'Content-Type': 'application/octet-stream', 'x-copia-accion': 'subir', 'x-copia-persona': 'victor', 'x-copia-sal': Buffer.from(basura.slice(11, 27)).toString('base64url'), 'x-copia-meta': Buffer.from(basura.slice(0, 60)).toString('base64url') }, body: basura });
  const lista = await C.listar('victor');
  assert.equal(lista.length, 3);
  // Frase antigua: abre la más vieja, no las otras; deriva una vez por sal distinta (3 sales).
  const p = await C.probarCopias('victor', lista, { frase: FRASE });
  assert.deepEqual(p.copias.map(c => c.abre), [false, false, true]);
  assert.equal(p.claves.size, 3);
  assert.equal(p.copias[2].sesiones, 1);
  const q = await C.probarCopias('victor', lista, { frase: 'la frase nueva de este año' });
  assert.deepEqual(q.copias.map(c => c.abre), [false, true, false]);
  // Con la clave guardada (frase nueva): sin derivar nada.
  const r = await C.probarCopias('victor', lista, { reg: claves.regs.get('victor') });
  assert.deepEqual(r.copias.map(c => c.abre), [false, true, false]);
  // Y se restaura la antigua con la frase antigua, con sus metadatos de dentro.
  const a = await C.abrirCopia('victor', lista[2].nombre, { clave: p.claves.get(lista[2].sal), esperado: p.copias[2] });
  assert.equal(a.meta.sesiones, 1);
  assert.deepEqual(a.avisos, []);
  // Activar con la frase antigua en un móvil nuevo: abre (la más nueva que abre), aunque no sea la más nueva de todas.
  claves.regs.clear(); C.reiniciarCopia();
  const act = await C.activar('victor', FRASE);
  assert.equal(act.abren, 1);
});

test('M3: si los metadatos de dentro no cuadran con el nombre o la persona, se avisa', async () => {
  await C.activar('victor', FRASE);
  sesion(); await C.copiarAhora();
  const [c] = (await C.probarCopias('victor', await C.listar('victor'), { reg: claves.regs.get('victor') })).copias;
  const bien = await C.abrirCopia('victor', c.nombre, { esperado: c });
  assert.deepEqual(bien.avisos, []);
  const mal = await C.abrirCopia('victor', c.nombre, { esperado: { ...c, sesiones: 9, fecha: '2026-01-01T00:00:00.000Z' } });
  assert.equal(mal.avisos.length, 2);
  // Una copia «de Virginia» por dentro subida como de Víctor (con la misma clave).
  const reg = claves.regs.get('victor');
  const bytes = await C.cifrar(C.empaquetar({ persona: 'virginia', creada: new Date(reloj).toISOString(), sesiones: 0, ultima: '' }, est.exportar()), reg);
  hora();
  const cuerpo = Buffer.from(bytes);
  await f('/api/copia', { method: 'POST', headers: { 'x-app-code': 'secreto', 'Content-Type': 'application/octet-stream', 'x-copia-accion': 'subir', 'x-copia-persona': 'victor', 'x-copia-sal': C.b64u(reg.sal), 'x-copia-meta': await C.cifrarNombre({ sesiones: 0, ultima: '' }, reg.clave, 'victor') }, body: cuerpo });
  const [nueva] = (await C.probarCopias('victor', await C.listar('victor'), { reg })).copias;
  const x = await C.abrirCopia('victor', nueva.nombre, { esperado: nueva });
  assert.match(x.avisos.join(' '), /Virginia/);
});

test('las copias de la versión 1 (nombre con datos en claro) se siguen listando y abriendo', async () => {
  await C.activar('victor', FRASE);
  const reg = claves.regs.get('victor');
  const bytes = Buffer.from(await C.cifrar(est.exportar(), reg, { version: 1 }));
  const n = nombreCopiaV1('victor', new Date(reloj - 864e5), 0, null);
  blob.blobs.set(n, { pathname: n, bytes, uploadedAt: new Date() });
  const p = await C.probarCopias('victor', await C.listar('victor'), { frase: FRASE });
  assert.equal(p.copias[0].abre, true);
  const a = await C.abrirCopia('victor', n, { frase: FRASE, bytes: p.bajadas.get(n) });
  assert.equal(a.meta, null); assert.equal(a.version, 1);
  assert.equal(JSON.parse(a.texto).dueño, 'victor');
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
  const malo = await C.probarCopias('victor', lista, { frase: 'no es esta frase', codigo: 'secreto' });
  assert.equal(malo.copias[0].abre, false);
  await assert.rejects(C.abrirCopia('victor', lista[0].nombre, { frase: 'no es esta frase', codigo: 'secreto' }), e => e.codigo === 'frase');
  assert.equal(est.estado().dueño, null, 'una frase mala no toca nada');
  const p = await C.probarCopias('victor', lista, { frase: FRASE, codigo: 'secreto' });
  assert.equal(p.copias[0].sesiones, 1);
  const { texto, recordar, avisos } = await C.abrirCopia('victor', lista[0].nombre, { clave: p.claves.get(lista[0].sal), codigo: 'secreto', esperado: p.copias[0] });
  assert.deepEqual(avisos, []);
  est.importar(texto);
  assert.deepEqual(JSON.parse(est.exportar()), original);
  await recordar();
  assert.ok(claves.regs.get('victor'), 'tras restaurar se recuerda la clave para seguir copiando');
});

// ── Disparadores ──
test('al terminar una sesión se sube una copia enseguida', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  const n = subidas().length;
  hora(); sesion();
  await esperarSubida();
  assert.equal(subidas().length, n + 1);
});

test('cambios de perfil, lesiones o medidas: espera 1 minuto sin cambios y sube una sola', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
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
  f.sinRed = true;
  assert.equal(await C.copiarAhora(), 'sin-red');
  f.sinRed = false;
  C._alVolverRed(); await esperarSubida();
  assert.equal(subidas().length, 3);
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

test('B4: si otra pestaña tiene el cerrojo, se reintenta cuando lo suelta', async () => {
  await C.activar('victor', FRASE);
  let libre = null, ocupado = true;
  C.configurarCopia({
    bloqueo: (n, fn) => (ocupado ? 'ocupado' : fn()),
    cuandoLibre: () => new Promise(r => { libre = r; }),
  });
  assert.equal(await C.copiarAhora(), 'ocupado');
  assert.equal(subidas().length, 0);
  ocupado = false; libre();
  await new Promise(r => setTimeout(r, 0)); await esperarSubida();
  assert.equal(subidas().length, 1);
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

test('M1: no se sube sola una copia con menos sesiones o con una última sesión anterior; «subir de todos modos» sí', async () => {
  await C.activar('victor', FRASE);
  sesion(1); await C.copiarAhora();
  hora(); sesion(0); await C.copiarAhora();
  assert.equal(subidas().length, 2);
  // Se borra una sesión (o se cargan datos más viejos): las automáticas se retienen y se avisa.
  est.cambiar(S => { const id = Object.keys(S.sesiones)[1]; delete S.sesiones[id]; }, 'sesion');
  hora();
  assert.equal(await C.copiarAhora('cambios'), 'retenida');
  assert.equal(await C.revisarApertura().then(() => C.copiarAhora('apertura')), 'retenida');
  assert.equal(subidas().length, 2);
  const n = C.estadoNube();
  assert.deepEqual([n.retenida.sesiones, n.retenida.base, n.avisar], [1, 2, true]);
  // Misma cantidad pero con la última sesión anterior: también.
  est.cambiar(S => { const s = Object.values(S.sesiones)[0]; S.sesiones.x = { ...s, id: 'x', fecha: '2020-01-01', terminada: '2020-01-01T10:00:00.000Z' }; }, 'x');
  assert.equal(await C.copiarAhora(), 'retenida');
  // La persona decide: subir de todos modos.
  hora();
  assert.equal(await C.copiarAhora('forzada', { forzar: true }), 'ok');
  assert.equal(C.estadoNube().retenida, null);
  assert.equal(subidas().length, 3);
});

test('M1: al activar en un móvil vacío con copias en la nube, la base es la de la nube (no se sube una vacía)', async () => {
  await C.activar('victor', FRASE);
  sesion(); await C.copiarAhora();
  // Móvil nuevo, mismo dueño y sin sesiones.
  cargarCon({ pipos4: sinPerfil() }); claves.regs.clear(); C.reiniciarCopia();
  try { globalThis.localStorage && globalThis.localStorage.removeItem('pipos4-nube'); } catch { /* nada */ }
  const r = await C.activar('victor', FRASE);
  assert.equal(r.copias, 1); assert.equal(r.ultimaQueAbre.sesiones, 1);
  hora();
  assert.equal(await C.copiarAhora('apertura'), 'retenida');
  assert.equal(subidas().length, 1);
});

test('M1: tras «Empezar de cero» en el rescate las copias quedan en pausa hasta confirmarlo', async () => {
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  C.pausarNube();
  hora();
  assert.equal(await C.copiarAhora(), 'pausada');
  assert.equal(C.estadoNube().pausada, true);
  assert.equal(C.estadoNube().avisar, true);
  C.reanudarNube();
  assert.equal(await C.copiarAhora(), 'ok');
});

test('B2: hubo copias desde este móvil y ya no está la clave → «desactivadas en este móvil»', async () => {
  await C.activar('victor', FRASE);
  await C.copiarAhora();
  claves.regs.clear();
  await C.cargarClave();
  const n = C.estadoNube();
  assert.equal(n.activada, false);
  assert.equal(n.desactivada, true);
  assert.equal(n.avisar, true);
});

test('sin almacén Blob (503): queda marcado «inactiva», con aviso, y no se rompe nada', async () => {
  await C.activar('victor', FRASE);
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
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
  sesion();
  await esperarSubida();
  assert.equal(f.peticiones.length, 0);
  assert.equal(C.estadoNube().activada, false);
});
