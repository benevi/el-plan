// Estado y guardado (js/nucleo/estado.js) con un almacén en memoria inyectado (usarAlmacen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, viejoDemo } from './ayuda/comun.mjs';
import { est, cat, cargarCon, almacen as almacenInicial } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const guardado = () => JSON.parse(N.almacen.getItem('pipos4') || 'null');

test('sin datos guardados arranca con un estado nuevo de la versión 4', () => {
  const S = cargarCon();
  assert.equal(S.version, 4);
  assert.equal(S.dueño, null);
  assert.deepEqual(S.sesiones, {});
  assert.deepEqual(S.perfil.lugares, ['gym', 'piscina']);
  assert.ok(almacenInicial, 'el arnés inyecta un almacén');
});

test('cargar rellena claves nuevas sin pisar lo guardado y quita la nutrición', () => {
  const viejo = estadoBase({ nutricion: { x: 1 } });
  delete viejo.ajustes.sonido;
  delete viejo.perfil.notas;
  viejo.perfil.nivel = 3;
  const S = cargarCon({ pipos4: viejo });
  assert.equal(S.ajustes.sonido, true);
  assert.equal(S.perfil.notas, '');
  assert.equal(S.perfil.nivel, 3);
  assert.equal(S.nutricion, undefined);
});

test('sin pipos4 pero con la app anterior (elplan2), la guarda en S.viejo para migrar', () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  assert.ok(S.viejo);
  assert.equal(Object.keys(S.viejo.workouts).length, 2);
});

test('cambiar aplica el cambio, avisa a los oyentes y guarda', async () => {
  cargarCon({ pipos4: estadoBase() });
  const motivos = [];
  const quitar = est.escuchar(m => motivos.push(m));
  est.cambiar(S => { S.perfil.nivel = 2; }, 'perfil');
  quitar();
  est.cambiar(S => { S.perfil.nivel = 3; }, 'otro');
  assert.deepEqual(motivos, ['perfil']);
  assert.equal(est.estado().perfil.nivel, 3);
  await new Promise(r => setTimeout(r, 300)); // guardado diferido de 250 ms
  assert.equal(guardado().perfil.nivel, 3);
});

test('un oyente que falla no impide avisar a los demás', () => {
  cargarCon({ pipos4: estadoBase() });
  const vistos = [];
  const errorReal = console.error; console.error = () => {};
  const q1 = est.escuchar(() => { throw new Error('roto'); });
  const q2 = est.escuchar(m => vistos.push(m));
  try { est.cambiar(() => {}, 'x'); } finally { q1(); q2(); console.error = errorReal; }
  assert.deepEqual(vistos, ['x']);
});

test('guardarYa escribe al momento', () => {
  cargarCon({ pipos4: estadoBase() });
  est.estado().medidas.push({ fecha: '2026-11-19', peso: 80 });
  est.guardarYa();
  assert.equal(guardado().medidas.length, 1);
});

test('exportar e importar: ida y vuelta conserva los datos', () => {
  cargarCon({ pipos4: estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } }) });
  const txt = est.exportar();
  cargarCon();
  est.importar(txt);
  assert.equal(est.estado().dueño, 'victor');
  assert.equal(est.estado().sesiones.s1.estado, 'hecha');
  assert.equal(guardado().sesiones.s1.id, 's1');
});

test('importar rechaza lo que no es una copia de la versión 4', () => {
  cargarCon({ pipos4: estadoBase() });
  assert.throws(() => est.importar('{"version":3,"perfil":{}}'), /No es una copia/);
  assert.throws(() => est.importar('{"version":4}'), /No es una copia/);
  assert.throws(() => est.importar('no es json'));
  assert.equal(guardado().dueño, 'victor');
});

test('migrarDeViejo trae las sesiones, lesiones y medidas de esa persona y nada de la otra', () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'virginia';
  const n = est.migrarDeViejo('virginia');
  assert.equal(n, 1);
  assert.equal(S.perfil.lesiones.length, 1);
  assert.equal(S.perfil.lesiones[0].zona, 'cadera_lateral');
  assert.equal(S.perfil.lesiones[0].dolor, 6);
  assert.deepEqual(S.medidas.map(m => m.peso), [60]);
  assert.equal(S.perfil.datos.altura, 165);
  const s = Object.values(S.sesiones)[0];
  assert.equal(s.fuente, 'anterior');
  assert.equal(s.estado, 'hecha');
});

test('migrarDeViejo sin datos de la app anterior no hace nada', () => {
  cargarCon();
  assert.equal(est.migrarDeViejo('victor'), 0);
});

// ── Fallos demostrados por la auditoría ──

test('si lo guardado no se puede leer, no se pisa al guardar', () => {
  const bueno = JSON.stringify(estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } }));
  const roto = bueno.slice(0, -20);
  cargarCon({ pipos4: roto });
  est.guardarYa();
  const conservado = Object.values(N.almacen.datos).includes(roto);
  assert.ok(conservado, 'el texto original ya no está en ninguna clave');
});

test('importar una copia con forma mala no rompe ni pisa los datos', { todo: 'PR 4: importar sin validar' }, () => {
  cargarCon({ pipos4: estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } }) });
  const antes = N.almacen.getItem('pipos4');
  let lanzo = false;
  try { est.importar(JSON.stringify({ version: 4, perfil: { lesiones: null, objetivos: 'musculo', disponibilidad: null }, dueño: 'victor', sesiones: null })); } catch { lanzo = true; }
  if (lanzo) { assert.equal(N.almacen.getItem('pipos4'), antes); return; }
  const S = est.estado();
  assert.ok(Array.isArray(S.perfil.lesiones), 'lesiones no es una lista');
  assert.ok(Array.isArray(S.perfil.objetivos), 'objetivos no es una lista');
  assert.ok(S.perfil.disponibilidad && Array.isArray(S.perfil.disponibilidad.diasSemana), 'disponibilidad rota');
  assert.ok(S.sesiones && typeof S.sesiones === 'object', 'sesiones nulas');
});

test('importar nunca trae el código de acceso ni apiUrl de la copia', { todo: 'PR 4: apiUrl y código importados' }, () => {
  cargarCon({ pipos4: estadoBase() });
  est.importar(JSON.stringify(estadoBase({ ajustes: { codigo: 'ajeno', vibrar: true, sonido: true, apiUrl: 'https://malo.example' } })));
  assert.notEqual(est.estado().ajustes.apiUrl, 'https://malo.example');
  assert.notEqual(est.estado().ajustes.codigo, 'ajeno');
});

test('la copia exportada no lleva el código de acceso', { todo: 'PR 4: copia con el código de acceso' }, () => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'secreto-123', vibrar: true, sonido: true, apiUrl: '' } }) });
  assert.doesNotMatch(est.exportar(), /secreto-123/);
});

test('importar acepta una copia v3 de la app anterior', { todo: 'PR 4: copia v3 no importable' }, () => {
  cargarCon({ pipos4: estadoBase() });
  assert.doesNotThrow(() => est.importar(JSON.stringify(viejoDemo())));
});

test('migración: el sexo se traduce bien (en la app anterior m = hombre)', { todo: "PR 4: sexo cruzado ('m' → 'h', 'f' → 'm')" }, () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  assert.equal(S.perfil.datos.sexo, 'h');
});

test('migración: la fecha de la sesión es la local (terminó el 6 de octubre a la 1:30 en Madrid)', { todo: 'PR 4: fecha UTC en la migración' }, () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  est.migrarDeViejo('victor');
  assert.equal(Object.values(S.sesiones)[0].fecha, '2026-10-06');
});

test('migración: ejercicios sin exId se resuelven por nombre', { todo: 'PR 4: ejercicios sin exId' }, () => {
  const v = viejoDemo();
  v.workouts.k1.exercises[1].name = cat.ex('curl-mancuernas').n;
  const S = cargarCon({ elplan2: v });
  est.migrarDeViejo('victor');
  assert.deepEqual(Object.values(S.sesiones)[0].ejercicios.map(x => x.id), ['press-pecho-maquina', 'curl-mancuernas']);
});

test('migración: elegir mal el dueño se puede corregir (se retira lo del otro y se migra lo suyo)', { todo: 'PR 4: dueño irreversible' }, () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  S.dueño = 'virginia';
  est.migrarDeViejo('virginia');
  assert.deepEqual(Object.values(S.sesiones).map(s => s.creada), ['2026-10-06T17:00:00.000Z']);
  assert.equal(S.perfil.lesiones.length, 1);
  assert.deepEqual(S.medidas.map(m => m.peso), [60]);
});

test('migración incremental: tras una marcha atrás a la app anterior se traen las sesiones nuevas', { todo: 'PR 4: re-migración tras marcha atrás' }, () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  est.guardarYa();
  // Marcha atrás: la app anterior guarda otra sesión en elplan2; luego vuelve la v2.
  const v = JSON.parse(N.almacen.getItem('elplan2'));
  v.workouts.k3 = { key: 'k3', id: 'k3', user: 'him', day: 'B', nombre: 'Durante la marcha atrás', lugar: 'gym', date: '2026-11-01T18:00:00.000Z', completed: true, completedAt: '2026-11-01T19:00:00.000Z', exercises: [] };
  N.almacen.setItem('elplan2', JSON.stringify(v));
  const S2 = est.cargar();
  est.migrarDeViejo('victor');
  assert.ok(Object.values(S2.sesiones).some(s => s.nombre === 'Durante la marcha atrás'));
  assert.equal(Object.values(S2.sesiones).length, 2);
});
