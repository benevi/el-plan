// Guardado robusto (PR 3) en node, con un almacén en memoria y un espejo falso inyectados:
// datos ilegibles, rescate, guardar solo con cambios, revisión entre pestañas, fallo al guardar,
// espejo en IndexedDB, última copia y uso del almacenamiento.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from './ayuda/comun.mjs';
import { est, cargarCon } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const leer = k => N.almacen.getItem(k);
const guardado = () => JSON.parse(leer('pipos4') || 'null');
const clavesRotas = () => Object.keys(N.almacen.datos).filter(k => k.startsWith('pipos4-roto-'));
const espera = ms => new Promise(r => setTimeout(r, ms));

// Espejo falso: guarda lo que se le escribe (con la misma regla que el real: no pisa una revisión más nueva).
class EspejoFalso {
  constructor(reg = null) { this.reg = reg; this.escrituras = []; this.conflicto = null; }
  async leer() { return this.reg; }
  async escribir(r) { this.escrituras.push(r); if (!this.reg || this.reg.rev <= r.rev) this.reg = r; }
  async apartar(r) { this.conflicto = r; return true; }
}
// Hace que setItem lance «cuota llena» para esas claves. Devuelve la función que lo deshace.
function lleno(claves) {
  const real = N.almacen.setItem.bind(N.almacen);
  const ceReal = console.error, cwReal = console.warn;
  console.error = () => {}; console.warn = () => {};
  N.almacen.setItem = (k, v) => { if (claves.includes(k)) { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } return real(k, v); };
  return () => { N.almacen.setItem = real; console.error = ceReal; console.warn = cwReal; };
}
const notasEspejo = () => JSON.parse(espejo.reg.txt).perfil.notas;
const conNotas = notas => estadoBase({ perfil: { ...estadoBase().perfil, notas } });
const regDe = (datos, rev = 5, fecha = '2026-11-18T19:00:00.000Z') => ({ txt: JSON.stringify(datos), rev, fecha });

let espejo;
beforeEach(() => { espejo = new EspejoFalso(); est.usarEspejo(espejo); });

const bueno = () => estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha', terminada: '2026-11-18T19:00:00.000Z' }) } });
const roto = () => JSON.stringify(bueno()).slice(0, -20);

// ── JSON ilegible y rescate ──

test('datos ilegibles: se apartan en pipos4-roto-<fecha ISO> y la app queda en rescate', () => {
  const crudo = roto();
  cargarCon({ pipos4: crudo });
  const [k] = clavesRotas();
  assert.match(k, /^pipos4-roto-\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(leer(k), crudo);
  const r = est.estadoGuardado().rescate;
  assert.equal(r.motivo, 'roto');
  assert.equal(r.copia, k);
});

test('datos ilegibles: ni cambiar ni guardar escriben en pipos4 ni en el espejo', async () => {
  const crudo = roto();
  cargarCon({ pipos4: crudo });
  est.cambiar(S => { S.perfil.notas = 'x'; }, 'perfil');
  assert.equal(est.guardarYa(), false);
  assert.equal(est.guardarPendiente(), false);
  await espera(300);
  assert.equal(leer('pipos4'), crudo);
  assert.equal(espejo.escrituras.length, 0);
});

test('datos ilegibles: cargar dos veces no duplica la copia apartada', () => {
  const crudo = roto();
  cargarCon({ pipos4: crudo });
  est.cargar();
  assert.equal(clavesRotas().length, 1);
});

test('JSON válido pero que no es un estado (una lista, un número) también va al rescate', () => {
  cargarCon({ pipos4: '[1,2]' });
  assert.equal(est.estadoGuardado().rescate.motivo, 'roto');
  cargarCon({ pipos4: '42' });
  assert.equal(est.estadoGuardado().rescate.motivo, 'roto');
});

test('empezar de cero: escribe un estado nuevo y lo ilegible sigue apartado', () => {
  const crudo = roto();
  cargarCon({ pipos4: crudo });
  est.descartarRescate();
  assert.equal(est.estadoGuardado().rescate, null);
  assert.equal(guardado().dueño, null);
  assert.equal(leer(clavesRotas()[0]), crudo);
});

test('cargar una copia desde el rescate la guarda y sale del rescate', () => {
  cargarCon({ pipos4: roto() });
  est.importar(JSON.stringify(bueno()));
  assert.equal(est.estadoGuardado().rescate, null);
  assert.equal(guardado().sesiones.s1.estado, 'hecha');
});

test('datos ilegibles con espejo válido: se ofrece y se recupera', async () => {
  cargarCon({ pipos4: roto() });
  espejo.reg = regDe(bueno(), 7);
  const r = await est.revisarEspejo();
  assert.equal(r.motivo, 'roto');
  assert.deepEqual({ dueño: r.espejo.dueño, sesiones: r.espejo.sesiones }, { dueño: 'victor', sesiones: 1 });
  est.recuperarDelEspejo();
  assert.equal(est.estadoGuardado().rescate, null);
  assert.equal(guardado().sesiones.s1.estado, 'hecha');
  assert.ok(+leer('pipos4-rev') > 7, 'la revisión queda por encima de la del espejo');
});

test('sin pipos4 pero con espejo válido: rescate «vacío» antes de la bienvenida', async () => {
  cargarCon();
  espejo.reg = regDe(bueno());
  const r = await est.revisarEspejo();
  assert.equal(r.motivo, 'vacio');
  assert.equal(est.guardarYa(), false, 'no se escribe hasta decidir');
  assert.equal(leer('pipos4'), null);
});

test('un espejo sin dueño, de otra versión o ilegible no se ofrece', async () => {
  for (const reg of [regDe(estadoBase({ dueño: null })), regDe(estadoBase({ version: 3 })), { txt: '{roto', rev: 9 }, { rev: 9 }, null]) {
    cargarCon();
    espejo.reg = reg;
    assert.equal(await est.revisarEspejo(), null);
  }
});

test('espejo más nuevo que pipos4 (localStorage falló): se ofrece; «seguir con lo guardado» no lo vuelve a ofrecer', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  espejo.reg = regDe(bueno(), 4);
  assert.equal((await est.revisarEspejo()).motivo, 'espejo');
  est.descartarRescate();
  assert.equal(est.estadoGuardado().rescate, null);
  assert.ok(+leer('pipos4-rev') > 4);
  await espera(0);
  est.cargar();
  assert.equal(await est.revisarEspejo(), null);
});

test('espejo igual o más viejo que pipos4: arranque normal', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '5' });
  espejo.reg = regDe(bueno(), 5);
  assert.equal(await est.revisarEspejo(), null);
});

test('un espejo que no contesta no bloquea el arranque', async () => {
  cargarCon();
  est.usarEspejo({ leer: () => new Promise(() => {}), escribir: async () => {} });
  const t0 = performance.now();
  assert.equal(await est.revisarEspejo({ max: 50 }), null);
  assert.ok(performance.now() - t0 < 1000);
});

// ── Guardar solo si hay cambios ──

test('sin cambios pendientes, guardarPendiente (pagehide / segundo plano) no escribe', () => {
  cargarCon({ pipos4: estadoBase() });
  const antes = N.almacen.escrituras;
  assert.equal(est.guardarPendiente(), false);
  assert.equal(N.almacen.escrituras, antes);
});

test('con cambios pendientes, guardarPendiente escribe una vez y deja de estar sucio', () => {
  cargarCon({ pipos4: estadoBase() });
  est.cambiar(S => { S.perfil.notas = 'hola'; }, 'perfil-silencio');
  assert.equal(est.estadoGuardado().sucio, true);
  assert.equal(est.guardarPendiente(), true);
  assert.equal(guardado().perfil.notas, 'hola');
  assert.equal(est.estadoGuardado().sucio, false);
  assert.equal(est.guardarPendiente(), false);
});

// ── Revisión entre pestañas ──

test('cada guardado sube la revisión en pipos4-rev (sin tocar la forma de pipos4)', () => {
  cargarCon({ pipos4: estadoBase() });
  est.guardarYa(); est.guardarYa();
  assert.equal(leer('pipos4-rev'), '2');
  assert.equal(guardado().rev, undefined);
  // La forma es la del modelo (nuevo()): nada del guardado (revisión, copia…) se mete en pipos4.
  assert.deepEqual(Object.keys(guardado()).sort(), Object.keys(est.nuevo()).sort());
});

test('una pestaña con revisión vieja no pisa la nueva: carga lo de la otra y aparta lo suyo en el espejo', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '4' });
  const motivos = [], eventos = [];
  const q1 = est.escuchar(m => motivos.push(m)), q2 = est.escucharGuardado(e => eventos.push(e));
  try {
    // Otra pestaña guarda la revisión 5 con una medida.
    N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-19', peso: 81 }] })));
    N.almacen.setItem('pipos4-rev', '5');
    // Esta pestaña, que iba por la 4, cambia algo y guarda.
    est.cambiar(S => { S.perfil.notas = 'de la pestaña vieja'; }, 'perfil-silencio');
    assert.equal(est.guardarYa(), false);
    await espera(0);
  } finally { q1(); q2(); }
  assert.equal(guardado().medidas.length, 1, 'lo de la otra pestaña sigue ahí');
  assert.equal(leer('pipos4-rev'), '5');
  assert.equal(est.estado().medidas.length, 1, 'en memoria está lo nuevo');
  assert.equal(JSON.parse(espejo.conflicto.txt).perfil.notas, 'de la pestaña vieja', 'apartado en IndexedDB');
  assert.equal(leer('pipos4-conflicto'), null, 'no ocupa sitio en localStorage');
  assert.ok(motivos.includes('externo'));
  assert.deepEqual(eventos.at(-1), { tipo: 'externo', apartado: true, perdido: false });
});

test('conflicto sin espejo: se aparta en pipos4-conflicto; si tampoco cabe, se avisa de que se perdió', async () => {
  for (const [cabe, esperado] of [[true, { apartado: true, perdido: false }], [false, { apartado: false, perdido: true }]]) {
    cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '1' });
    est.usarEspejo({ leer: async () => null, escribir: async () => {}, apartar: async () => false });
    const eventos = [];
    const q = est.escucharGuardado(e => eventos.push(e));
    const deshacer = cabe ? () => {} : lleno(['pipos4-conflicto']);
    try {
      N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ dueño: 'virginia' })));
      N.almacen.setItem('pipos4-rev', '2');
      est.cambiar(S => { S.perfil.notas = 'mío'; }, 'perfil-silencio');
      est.guardarYa();
      await espera(0);
    } finally { q(); deshacer(); }
    assert.deepEqual(eventos.at(-1), { tipo: 'externo', ...esperado });
    assert.equal(leer('pipos4-conflicto') !== null, cabe);
  }
});

test('E: otra pestaña escribió pipos4 pero aún no su revisión: no se pisa (se compara el texto)', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-19', peso: 81 }] })));
  est.cambiar(S => { S.perfil.notas = 'aquí'; }, 'perfil-silencio');
  assert.equal(est.guardarYa(), false);
  await espera(0);
  assert.equal(guardado().medidas.length, 1);
  assert.equal(est.estado().medidas.length, 1);
});

test('comprobarOtraPestaña (evento storage) recarga solo si la revisión es más nueva', () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '2' });
  assert.equal(est.comprobarOtraPestaña(), false);
  N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ dueño: 'virginia' })));
  N.almacen.setItem('pipos4-rev', '3');
  assert.equal(est.comprobarOtraPestaña(), true);
  assert.equal(est.estado().dueño, 'virginia');
  assert.equal(leer('pipos4-conflicto'), null, 'sin cambios propios no se aparta nada');
  est.cambiar(S => { S.perfil.notas = 'tras recargar'; }, 'perfil-silencio');
  assert.equal(est.guardarYa(), true);
  assert.equal(leer('pipos4-rev'), '4');
});

test('importar escribe por encima de la revisión del espejo', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '1' });
  espejo.reg = regDe(estadoBase(), 9);
  await est.revisarEspejo();
  est.importar(JSON.stringify(bueno()));
  assert.equal(leer('pipos4-rev'), '10');
  assert.equal(guardado().sesiones.s1.estado, 'hecha');
});

test('importar no pisa lo que otra pestaña acaba de guardar: lo carga y pide repetir', () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '1' });
  N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ dueño: 'virginia' })));
  N.almacen.setItem('pipos4-rev', '2');
  assert.throws(() => est.importar(JSON.stringify(bueno())), /Otra ventana/);
  assert.equal(guardado().dueño, 'virginia');
  assert.equal(est.estado().dueño, 'virginia');
});

// ── Fallo al guardar ──

test('si setItem falla: avisa, sigue sucio, el espejo guarda igual y el siguiente cambio reintenta', async () => {
  cargarCon({ pipos4: estadoBase() });
  const eventos = [];
  const quitar = est.escucharGuardado(e => eventos.push(e.tipo));
  const real = N.almacen.setItem.bind(N.almacen);
  N.almacen.setItem = (k, v) => { if (k === 'pipos4') { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } return real(k, v); };
  const ceReal = console.error; console.error = () => {};
  try {
    est.cambiar(S => { S.perfil.notas = 'sin sitio'; }, 'perfil-silencio');
    assert.equal(est.guardarYa(), false);
    assert.equal(est.estadoGuardado().sucio, true);
    assert.equal(est.estadoGuardado().error.name, 'QuotaExceededError');
    assert.deepEqual(eventos, ['error']);
    assert.equal(JSON.parse(espejo.reg.txt).perfil.notas, 'sin sitio', 'el espejo tiene lo último');
    assert.equal(guardado().perfil.notas, '');
  } finally { N.almacen.setItem = real; console.error = ceReal; }
  est.cambiar(S => { S.perfil.notas = 'ya hay sitio'; }, 'perfil-silencio');
  await espera(300); // guardado diferido
  quitar();
  assert.equal(guardado().perfil.notas, 'ya hay sitio');
  assert.equal(est.estadoGuardado().error, null);
  assert.deepEqual(eventos, ['error', 'ok']);
});

// ── Espejo ──

test('tras cada guardado correcto se escribe el mismo texto y la revisión en el espejo', () => {
  cargarCon({ pipos4: estadoBase() });
  est.cambiar(S => { S.perfil.notas = 'espejo'; }, 'perfil-silencio');
  est.guardarYa();
  const r = espejo.escrituras.at(-1);
  assert.equal(r.txt, leer('pipos4'));
  assert.equal(String(r.rev), leer('pipos4-rev'));
  assert.ok(!isNaN(new Date(r.fecha)));
});

test('un espejo que lanza no rompe el guardado', () => {
  cargarCon({ pipos4: estadoBase() });
  est.usarEspejo({ leer: async () => null, escribir: () => { throw new Error('IDB rota'); } });
  assert.equal(est.guardarYa(), true);
  est.usarEspejo({ leer: async () => null, escribir: () => Promise.reject(new Error('IDB rota')) });
  assert.equal(est.guardarYa(), true);
});

// ── Última copia y uso del almacenamiento ──

test('recordatorio de copia: a partir de 10 sesiones terminadas desde la última exportación', () => {
  const sesiones = {};
  for (let i = 0; i < 12; i++) sesiones['s' + i] = sesionDemo('s' + i, { estado: 'hecha', terminada: `2026-11-${String(i + 1).padStart(2, '0')}T19:00:00.000Z` });
  sesiones.p = sesionDemo('p');
  cargarCon({ pipos4: estadoBase({ sesiones }) });
  assert.deepEqual(est.infoCopia(), { fecha: null, sesionesDesde: 12, toca: true });
  est.marcarCopiaExportada(new Date('2026-11-03T00:00:00.000Z'));
  assert.deepEqual(est.infoCopia(), { fecha: '2026-11-03T00:00:00.000Z', sesionesDesde: 10, toca: true });
  est.marcarCopiaExportada(new Date('2026-11-04T00:00:00.000Z'));
  assert.equal(est.infoCopia().sesionesDesde, 9);
  assert.equal(est.infoCopia().toca, false);
  assert.equal(guardado().copia, undefined, 'la fecha va en una clave aparte');
});

test('uso del almacenamiento: suma todas las claves pipos4* y da el porcentaje de unos 5 MB', () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-roto-2026-11-01T00:00:00.000Z': 'x'.repeat(1000), elplan2: 'y'.repeat(500), otra: 'z' });
  est.guardarYa();
  const u = est.usoAlmacen();
  const esperado = Object.entries(N.almacen.datos).filter(([k]) => k.startsWith('pipos4')).reduce((n, [k, v]) => n + k.length + v.length, 0);
  assert.equal(u.bytes, esperado);
  assert.equal(u.principal, leer('pipos4').length);
  assert.ok(u.bytes > 1000);
  assert.ok(Math.abs(u.porcentaje - u.bytes / (5 * 1024 * 1024) * 100) < 1e-9);
});

// ── Casos de la revisión adversarial (A-D, F) ──

test('A: con la cuota llena, tras «Recuperar la copia interna» los cambios siguientes llegan al espejo', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  espejo.reg = regDe(conNotas('espejo4'), 4);
  assert.equal((await est.revisarEspejo()).motivo, 'espejo');
  const deshacer = lleno(['pipos4']);
  try {
    est.recuperarDelEspejo();
    await espera(0);
    assert.equal(notasEspejo(), 'espejo4');
    est.cambiar(S => { S.perfil.notas = 'nuevo tras recuperar'; }, 'perfil-silencio');
    est.guardarYa();
    await espera(0);
    assert.equal(notasEspejo(), 'nuevo tras recuperar');
  } finally { deshacer(); }
});

test('B: con la cuota llena, tras «Seguir con lo guardado» los cambios llegan al espejo', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  espejo.reg = regDe(conNotas('espejo4'), 4);
  await est.revisarEspejo();
  const deshacer = lleno(['pipos4']);
  try {
    est.descartarRescate();
    est.cambiar(S => { S.perfil.notas = 'trabajo de hoy'; }, 'perfil-silencio');
    est.guardarYa();
    await espera(0);
    assert.equal(notasEspejo(), 'trabajo de hoy');
  } finally { deshacer(); }
});

test('B bis: una lectura del espejo que llega después del tope también cuenta para la revisión', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  let soltar;
  const lento = new Promise(r => { soltar = r; });
  const falso = new EspejoFalso();
  falso.leer = () => lento;
  est.usarEspejo(falso);
  assert.equal(await est.revisarEspejo({ max: 10 }), null);
  soltar(regDe(conNotas('viejo'), 20));
  await espera(0);
  est.cambiar(S => { S.perfil.notas = 'después'; }, 'perfil-silencio');
  est.guardarYa();
  await espera(0);
  assert.ok(falso.escrituras.at(-1).rev > 20, `rev ${falso.escrituras.at(-1).rev}`);
});

test('C: si solo falla pipos4-rev, al recargar no se ofrece un falso rescate «espejo»', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '3' });
  const deshacer = lleno(['pipos4-rev']);
  try { est.cambiar(S => { S.perfil.notas = 'x'; }, 'perfil-silencio'); est.guardarYa(); } finally { deshacer(); }
  await espera(0);
  est.cargar();
  assert.equal(await est.revisarEspejo(), null);
});

test('D: una pestaña en rescate no pisa lo que otra ya resolvió (evento storage y «Empezar de cero»)', () => {
  cargarCon({ pipos4: '{roto' });
  const resuelto = JSON.stringify(bueno());
  N.almacen.setItem('pipos4', resuelto);
  N.almacen.setItem('pipos4-rev', '1');
  assert.equal(est.descartarRescate(), false, 'no escribe: carga lo de la otra pestaña');
  assert.equal(leer('pipos4'), resuelto);
  assert.equal(est.estadoGuardado().rescate, null);
  assert.equal(est.estado().sesiones.s1.estado, 'hecha');
  // Y por el evento storage: otra vez en rescate, llega el aviso de la otra pestaña.
  cargarCon({ pipos4: '{roto' });
  N.almacen.setItem('pipos4', resuelto);
  N.almacen.setItem('pipos4-rev', '1');
  assert.equal(est.comprobarOtraPestaña(), true);
  assert.equal(est.estadoGuardado().rescate, null);
  assert.equal(est.estado().sesiones.s1.estado, 'hecha');
});

test('F: sin pipos4, con espejo y con la app anterior: «Empezar de cero» conserva lo de la app anterior', async () => {
  cargarCon({ elplan2: JSON.stringify({ workouts: {} }) });
  espejo.reg = regDe(estadoBase(), 9);
  assert.equal((await est.revisarEspejo()).motivo, 'vacio');
  assert.equal(est.descartarRescate(), true);
  // Lo de la app anterior no se copia en pipos4 (sería duplicar elplan2): se sigue leyendo de elplan2.
  assert.ok(est.estado().viejo, 'se pierde la app anterior para migrar');
  assert.ok(leer('elplan2'), 'se borró elplan2');
  assert.equal(guardado().viejo, undefined);
  assert.ok(+leer('pipos4-rev') > 9);
});

test('textoRoto: en el rescate devuelve el texto ilegible para descargarlo', () => {
  const crudo = roto();
  cargarCon({ pipos4: crudo });
  assert.equal(est.textoRoto(), crudo);
  cargarCon({ pipos4: estadoBase() });
  assert.equal(est.textoRoto(), null);
});
