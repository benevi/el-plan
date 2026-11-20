// Copia de seguridad (PR 4): exportar sin el código, importar validado (normalizador, prueba de pintado,
// copia de lo anterior), copias maliciosas, copia de la otra persona y copias de la app anterior.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, viejoDemo, modulo } from './ayuda/comun.mjs';
import { est, cargarCon, nuevoS, hecha, ent } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const norm = await import(modulo('js/nucleo/normalizar.js'));
const guardado = () => JSON.parse(N.almacen.getItem('pipos4') || 'null');
const conSesion = () => estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } });
afterEach(() => est.usarPruebaDePintado(null));

// Copia v3 tal como la exportaba la app anterior (rama main: Store.exportar en js/store.js).
function copiaV3() {
  const d = viejoDemo();
  d.workouts.k1.feedback = { esfuerzo: 4, nota: 'Bien' };
  d.workouts.k1.checkin = { energia: 4, dolor: { hombro: 2 }, tiempo: 'completo' };
  d.workouts.k1.key = 'k1';
  d.painLog = [
    { date: '2026-10-05T23:30:05.000Z', user: 'him', antes: { hombro: 2 }, despues: { hombro: 3, rodilla_rara: 4 }, energia: 4 },
    { date: '2026-10-06T18:00:00.000Z', user: 'her', antes: { cadera_lateral: 5 }, despues: { cadera_lateral: 4 } },
  ];
  d.routines = { him: [], her: [] };
  d.settings = { autoRest: true, apiUrl: 'https://malo.example/api', code: 'clave-vieja' };
  return { version: 3, exported: '2026-10-07T10:00:00.000Z', currentUser: 'him', ...d, lastExport: null };
}

// ── Exportar ──
test('exportar: sin el código de acceso, sin apiUrl y sin lo de la app anterior', () => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'secreto-123', vibrar: true, sonido: true, apiUrl: 'x' } }), elplan2: viejoDemo() });
  assert.ok(est.estado().viejo, 'la app anterior está a mano para migrar');
  const x = JSON.parse(est.exportar());
  assert.equal(x.ajustes.codigo, '');
  assert.equal(x.ajustes.apiUrl, undefined);
  assert.equal(x.viejo, undefined);
  assert.equal(est.estado().ajustes.codigo, 'secreto-123', 'exportar no toca el estado');
});

test('cargar quita ajustes.apiUrl del estado guardado', () => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: '', vibrar: true, sonido: true, apiUrl: 'https://malo.example' } }) });
  assert.equal(est.estado().ajustes.apiUrl, undefined);
  est.guardarYa();
  assert.equal(guardado().ajustes.apiUrl, undefined);
});

// ── Importar: mensajes y copia de lo anterior ──
test('importar: los errores se explican en español (no el mensaje de JSON.parse)', () => {
  cargarCon({ pipos4: conSesion() });
  for (const [txt, re] of [['', /vacío/], ['{"version":4,', /no se puede leer/], ['[1,2]', /No es una copia/], ['{"version":9,"perfil":{},"dueño":"victor"}', /versión más nueva/], ['{"version":4,"perfil":{}}', /no dice de quién es/]]) {
    assert.throws(() => est.importar(txt), e => e instanceof est.ErrorCopia && re.test(e.message) && !/JSON|Unexpected|token/i.test(e.message), txt);
  }
  assert.ok(guardado().sesiones.s1, 'no se pisa nada');
});

test('importar guarda antes lo de ahora en pipos4-antes-de-importar y deshacerImportar vuelve a ello', () => {
  cargarCon({ pipos4: conSesion() });
  est.importar(JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-01', peso: 80 }] })));
  assert.deepEqual(est.estado().sesiones, {});
  const antes = JSON.parse(N.almacen.getItem('pipos4-antes-de-importar'));
  assert.ok(antes.fecha && antes.estado.sesiones.s1);
  assert.ok(est.infoAntesDeImportar());
  est.deshacerImportar();
  assert.ok(est.estado().sesiones.s1);
  assert.ok(guardado().sesiones.s1);
});

test('si no hay sitio para apartar lo de ahora, no se importa nada', () => {
  cargarCon({ pipos4: conSesion() });
  const set = N.almacen.setItem.bind(N.almacen);
  N.almacen.setItem = (k, v) => { if (k === 'pipos4-antes-de-importar') throw new Error('QuotaExceededError'); set(k, v); };
  const errorReal = console.error; console.error = () => {};
  try {
    assert.throws(() => est.importar(JSON.stringify(estadoBase())), e => e.codigo === 'sin-espacio');
  } finally { console.error = errorReal; }
  assert.ok(est.estado().sesiones.s1);
  assert.ok(guardado().sesiones.s1);
});

test('si alguna pantalla falla con la copia, no se importa y se avisa', () => {
  cargarCon({ pipos4: conSesion() });
  let visto = null;
  est.usarPruebaDePintado(() => { visto = est.estado().dueño; throw new Error('roto'); });
  const errorReal = console.error; console.error = () => {};
  try {
    assert.throws(() => est.importar(JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-01', peso: 70 }] }))), e => e.codigo === 'pintado' && /Tus datos siguen como estaban/.test(e.message));
  } finally { console.error = errorReal; }
  assert.equal(visto, 'victor', 'la prueba se hace con la copia puesta');
  assert.ok(est.estado().sesiones.s1, 'el estado vuelve a ser el de antes');
  assert.equal(N.almacen.getItem('pipos4-antes-de-importar'), null);
});

test('durante la prueba de pintado, cambiar no guarda ni avisa', () => {
  cargarCon({ pipos4: conSesion() });
  const motivos = []; const q = est.escuchar(m => motivos.push(m));
  est.usarPruebaDePintado(() => est.cambiar(S => { S.perfil.notas = 'de la prueba'; }, 'x'));
  try { est.importar(JSON.stringify(estadoBase())); } finally { q(); }
  assert.deepEqual(motivos, ['importar']);
  assert.equal(guardado().perfil.notas, 'de la prueba', 'el cambio se queda en la copia probada (que es la que entra)');
});

// ── La otra persona ──
test('una copia de la otra persona no se carga sin confirmarlo', () => {
  cargarCon({ pipos4: conSesion() });
  const antes = N.almacen.getItem('pipos4');
  assert.throws(() => est.importar(JSON.stringify(estadoBase({ dueño: 'virginia' }))), e => e.codigo === 'otra-persona' && e.info.dueño === 'virginia' && /Virginia/.test(e.message) && /Víctor/.test(e.message));
  assert.equal(N.almacen.getItem('pipos4'), antes);
  est.importar(JSON.stringify(estadoBase({ dueño: 'virginia' })), { otraPersona: true });
  assert.equal(est.estado().dueño, 'virginia');
});

test('el código de acceso del móvil se conserva al importar (y nunca entra el de la copia)', () => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'mio', vibrar: true, sonido: true } }) });
  est.importar(JSON.stringify(estadoBase({ ajustes: { codigo: 'ajeno', vibrar: false, sonido: true, apiUrl: 'https://malo.example' } })));
  assert.equal(est.estado().ajustes.codigo, 'mio');
  assert.equal(est.estado().ajustes.vibrar, false);
  assert.equal(guardado().ajustes.apiUrl, undefined);
});

// ── Copias maliciosas ──
test('XSS en campos numéricos y en ids: se convierten en números o se quitan', () => {
  cargarCon({ pipos4: conSesion() });
  const P = '<img src=x onerror=alert(1)>';
  est.importar(JSON.stringify({
    version: 4, dueño: 'victor',
    perfil: { objetivos: ['musculo', P], nivel: P, lesiones: [{ id: 'a"><b>', zona: 'rodilla', dolor: P, activa: true }, { id: 'b', zona: P, dolor: 3 }], disponibilidad: { dias: P, minutos: '45', diasSemana: [1, P, 9] }, lugares: [P], gustos: { [P]: 'gusta', 'press-pecho-maquina': P }, datos: { sexo: P, altura: P, nacimiento: P } },
    sesiones: { 's1"><img>': { id: 'x', fecha: '2026-11-01', estado: 'hecha', nombre: P, lugar: P, cierre: { esfuerzo: P, dolor: { rodilla: P } }, ejercicios: [{ id: '"><img', nombre: 'Algo', series: P, descanso: P, kg: P, rol: P, sets: [{ kg: P, valor: P, hecha: 'sí' }] }] }, ok: { fecha: '2026-11-02', checkin: { energia: P, dolor: { [P]: 3 } } } },
    medidas: [{ fecha: P, peso: 80 }, { fecha: '2026-11-03', peso: P, cintura: '90' }],
    dolor: [{ fecha: '2026-11-03', zona: 'rodilla', dolor: P }, { fecha: '2026-11-03', zona: 'rodilla', dolor: 4, momento: P, sesion: '"><img' }],
    plan: { semana: P },
  }));
  const S = est.estado();
  assert.deepEqual(S.perfil.objetivos, ['musculo']);
  assert.equal(S.perfil.nivel, 1);
  assert.equal(S.perfil.lesiones.length, 1, 'la lesión de zona desconocida no entra');
  assert.match(S.perfil.lesiones[0].id, /^[\w-]+$/);
  assert.equal(S.perfil.lesiones[0].dolor, 3);
  assert.deepEqual(S.perfil.disponibilidad, { dias: 3, minutos: 45, diasSemana: [1] });
  assert.deepEqual(S.perfil.lugares, ['gym']);
  assert.deepEqual(S.perfil.gustos, {});
  assert.deepEqual(S.perfil.datos, { sexo: '', altura: null, nacimiento: '' });
  assert.deepEqual(Object.keys(S.sesiones), ['x', 'ok'], 'la clave mala se cambia por el id bueno');
  const s = S.sesiones.x;
  assert.equal(s.lugar, 'gym');
  assert.deepEqual(s.cierre, { esfuerzo: null, dolor: {}, comentario: '' });
  assert.equal(s.ejercicios[0].id, null);
  assert.equal(s.ejercicios[0].series, 1);
  assert.equal(s.ejercicios[0].descanso, 60);
  assert.equal(s.ejercicios[0].kg, null);
  assert.equal(s.ejercicios[0].rol, 'principal');
  assert.deepEqual(s.ejercicios[0].sets, [{ kg: null, valor: P.slice(0, 12), hecha: false }]);
  assert.deepEqual(S.sesiones.ok.checkin, { energia: null, dolor: {}, tiempo: null });
  assert.deepEqual(S.medidas, [{ fecha: '2026-11-03', cintura: 90 }]);
  assert.deepEqual(S.dolor, [{ fecha: '2026-11-03', zona: 'rodilla', dolor: 4, momento: 'dia' }]);
  assert.equal(S.plan, null);
});

test('__proto__ y claves desconocidas: no contaminan nada y no entran', () => {
  cargarCon({ pipos4: conSesion() });
  const txt = `{"version":4,"dueño":"victor","__proto__":{"contaminado":1},"raro":1,
    "perfil":{"__proto__":{"contaminado":2},"gustos":{"__proto__":"gusta","constructor":"gusta","sentadilla":"gusta"},"otra":1},
    "sesiones":{"__proto__":{"id":"__proto__","fecha":"2026-11-01"},"constructor":{"fecha":"2026-11-01"}},
    "ajustes":{"__proto__":{"codigo":"x"},"vibrar":true}}`;
  est.importar(txt);
  const S = est.estado();
  assert.equal(({}).contaminado, undefined);
  assert.equal(Object.prototype.contaminado, undefined);
  assert.equal(S.raro, undefined);
  assert.equal(S.perfil.otra, undefined);
  assert.equal(Object.getPrototypeOf(S.perfil.gustos), Object.prototype);
  assert.deepEqual(Object.keys(S.perfil.gustos), ['sentadilla']);
  assert.deepEqual(Object.keys(S.sesiones), []);
  assert.deepEqual(Object.keys(S).sort(), Object.keys(est.nuevo()).sort());
  assert.equal(S.ajustes.codigo, '');
});

// ── Lo que hace la app lo conserva el normalizador (exportar → importar no pierde nada) ──
test('el normalizador no pierde nada de un estado real (plan, sesión hecha, lesiones, medidas, dolor)', async () => {
  const S = nuevoS({ lugares: ['gym', 'piscina'], usoIA: 'ahorro', acompañado: true, lesiones: [{ id: 'l1', zona: 'rodilla', dolor: 4, desde: '2026-01-01', nota: 'menisco', activa: true, tipo: 'recurrente' }], nivelCambios: [{ fecha: '2026-11-01T10:00:00.000Z', de: 1, a: 2, motivo: 'constancia' }] });
  S.plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym', 'piscina'] });
  S.plan.cambios = [{ fecha: '2026-11-02T10:00:00.000Z', texto: 'Muevo el lunes' }];
  const { sesion } = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: { rodilla: 2 }, peticion: '' });
  const s = est.estado().sesiones[sesion.id];
  s.estado = 'hecha'; s.empezada = new Date().toISOString(); s.terminada = new Date().toISOString();
  s.cierre = { esfuerzo: 3, dolor: { rodilla: 2 }, comentario: 'bien' };
  s.ejercicios[0].gusto = 'gusta'; s.ejercicios[0].comentario = 'pesado'; s.ejercicios[0].sets[0] = { kg: 40, valor: '10', hecha: true };
  s.calentamiento.forEach(t => { t.hecho = true; });
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: [[40, 10], [40, 9]] }]);
  S.medidas.push({ fecha: '2026-11-01', peso: 80.5, cintura: 90 });
  S.dolor.push({ fecha: '2026-11-01', zona: 'rodilla', dolor: 3, momento: 'despues', sesion: sesion.id });
  S.ajustes.modoSesion = 'lista';
  S.perfil.gustos['sentadilla-goblet'] = 'rechazo';
  const x = JSON.parse(est.exportar());
  const { estado: n, avisos } = norm.normalizarEstado(JSON.parse(JSON.stringify(x)));
  assert.deepEqual(avisos, []);
  // hecha() de las pruebas no rellena todos los campos de una sesión: se comparan las de la app.
  for (const k of Object.keys(x.sesiones)) if (x.sesiones[k].nombre === 'x') { delete x.sesiones[k]; delete n.sesiones[k]; }
  assert.deepEqual(n, x);
});

// ── Copias de la app anterior ──
test('importar una copia v3 real de la app anterior: trae lo de la persona del móvil, sin claves ni URL', () => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'mio', vibrar: true, sonido: true } }) });
  const r = est.importar(JSON.stringify(copiaV3()));
  assert.equal(r.tipo, 'anterior');
  assert.equal(r.sesiones, 1);
  const S = est.estado();
  const s = S.sesiones['v-k1'];
  assert.equal(s.fecha, '2026-10-06');
  assert.deepEqual(s.ejercicios.map(x => x.id), ['press-pecho-maquina', null]);
  assert.equal(s.ejercicios[1].nombre, 'Curl raro sin exId');
  assert.deepEqual(s.cierre, { esfuerzo: 4, dolor: {}, comentario: 'Bien' });
  assert.deepEqual(s.checkin, { energia: 4, dolor: { hombro: 2 }, tiempo: null });
  // painLog → registro de dolor, enlazado con su sesión; la zona desconocida se descarta con aviso.
  assert.deepEqual(S.dolor.map(d => [d.fecha, d.zona, d.dolor, d.momento, d.sesion]), [['2026-10-06', 'hombro', 2, 'antes', 'v-k1'], ['2026-10-06', 'hombro', 3, 'despues', 'v-k1']]);
  assert.ok(r.avisos.some(a => /rodilla_rara/.test(a)));
  assert.equal(S.ajustes.codigo, 'mio');
  assert.doesNotMatch(N.almacen.getItem('pipos4'), /clave-vieja|malo\.example/);
  assert.equal(S.perfil.datos.sexo, 'h', 'no se pisa el sexo ya puesto, y si se pusiera sería h');
  // Otra vez la misma copia: nada nuevo.
  assert.equal(est.importar(JSON.stringify(copiaV3())).sesiones, 0);
  assert.equal(Object.keys(est.estado().sesiones).length, 1);
  assert.equal(est.estado().dolor.length, 2);
});

test('una copia de la app anterior sin dueño elegido se rechaza con explicación', () => {
  cargarCon();
  assert.throws(() => est.importar(JSON.stringify(copiaV3())), e => e.codigo === 'vieja-sin-dueño' && /Elige primero/.test(e.message));
});

// ── Revisión del PR 4 ──
test('rescate: cargar un archivo no pierde la copia interna del espejo (queda en pipos4-antes-de-importar)', async () => {
  const reg = { txt: JSON.stringify(estadoBase({ sesiones: { nueva: sesionDemo('nueva', { estado: 'hecha' }) } })), rev: 9, fecha: new Date().toISOString() };
  const espejo = { reg, async leer() { return this.reg; }, async escribir(r) { this.reg = r; }, async apartar() { return false; } };
  est.usarEspejo(espejo);
  try {
    cargarCon({}); // pipos4 vacío (p. ej. el navegador lo borró)
    assert.equal((await est.revisarEspejo()).motivo, 'vacio');
    est.importar(JSON.stringify(estadoBase()));
    await new Promise(r => setTimeout(r, 10));
    assert.equal(JSON.parse(espejo.reg.txt).sesiones.nueva, undefined, 'el espejo ya tiene lo cargado');
    assert.ok(est.infoAntesDeImportar(), 'pero se puede volver');
    assert.ok(JSON.parse(N.almacen.getItem('pipos4-antes-de-importar')).estado.sesiones.nueva);
    est.deshacerImportar();
    assert.ok(est.estado().sesiones.nueva);
  } finally { est.usarEspejo(null); }
});

test('cuota justa: si pipos4 no acepta la copia, no se finge que se cargó (se deshace y se avisa)', () => {
  cargarCon({ pipos4: conSesion() });
  const antes = N.almacen.getItem('pipos4');
  const real = N.almacen.setItem.bind(N.almacen);
  N.almacen.setItem = (k, v) => { if (k === 'pipos4') { const e = new Error('lleno'); e.name = 'QuotaExceededError'; throw e; } return real(k, v); };
  const errorReal = console.error; console.error = () => {};
  try {
    assert.throws(() => est.importar(JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-01', peso: 70 }] }))), e => e.codigo === 'sin-espacio' && /siguen como estaban/.test(e.message));
  } finally { console.error = errorReal; N.almacen.setItem = real; }
  assert.ok(est.estado().sesiones.s1, 'en memoria sigue lo de antes');
  assert.equal(est.estado().medidas.length, 0);
  assert.equal(N.almacen.getItem('pipos4'), antes);
  assert.equal(N.almacen.getItem('pipos4-antes-de-importar'), null, 'no queda una copia «de antes» que no corresponde');
  assert.equal(est.estadoGuardado().error, null, 'no deja aviso de error de guardado');
});

test('lo de antes de importar caduca a los 7 días y se puede descartar', () => {
  cargarCon({ pipos4: conSesion() });
  est.importar(JSON.stringify(estadoBase()));
  assert.ok(est.infoAntesDeImportar());
  assert.equal(est.infoAntesDeImportar(Date.now() + 8 * 864e5), null);
  assert.equal(N.almacen.getItem('pipos4-antes-de-importar'), null);
  est.importar(JSON.stringify(estadoBase()));
  est.descartarAntesDeImportar();
  assert.equal(est.infoAntesDeImportar(), null);
});

test('una copia de más de 10 MB se rechaza con un mensaje claro', () => {
  cargarCon({ pipos4: conSesion() });
  assert.throws(() => est.importar(' '.repeat(10 * 1024 * 1024 + 1) + '{}'), e => e.codigo === 'grande' && /10 MB/.test(e.message));
});

test('una copia cuyo migrado es de otra persona no retira nada sin preguntar', () => {
  cargarCon({ pipos4: conSesion(), elplan2: viejoDemo() });
  const copia = estadoBase({ migracion: { version: 2, dueño: 'virginia', claves: ['s:k2'], sexoRevisar: false } });
  copia.sesiones = { 'v-k2': { ...sesionDemo('v-k2', { estado: 'hecha' }), fuente: 'anterior' } };
  est.importar(JSON.stringify(copia));
  assert.equal(est.ponerAlDiaMigracion(), null);
  assert.equal(est.migracionDeOtro(), true);
  assert.ok(est.estado().sesiones['v-k2']);
  assert.throws(() => est.importar(JSON.stringify(viejoDemo())), e => e.codigo === 'migracion-de-otro');
  assert.ok(est.estado().sesiones['v-k2']);
});

test('ida y vuelta: un estado largo generado por la app sale y vuelve idéntico (salvo el código)', async () => {
  const { generarEstadoLargo } = await import('./ayuda/estado-largo.mjs');
  cargarCon({ elplan2: viejoDemo() });
  await generarEstadoLargo(est, ent);
  const antes = JSON.parse(JSON.stringify(est.estado()));
  assert.ok(Object.keys(antes.sesiones).length >= 18 && antes.plan, 'el estado es largo de verdad');
  const txt = est.exportar();
  assert.doesNotMatch(txt, /secreto|Trocanteritis|"viejo"/, 'ni el código, ni lo de la otra persona, ni la app anterior');
  const r = est.importar(txt);
  assert.deepEqual(r.avisos, []);
  const despues = JSON.parse(JSON.stringify(est.estado()));
  delete antes.ajustes.codigo; delete despues.ajustes.codigo;
  assert.deepEqual(despues, antes);
});
