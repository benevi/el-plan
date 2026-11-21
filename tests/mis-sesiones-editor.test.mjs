// Editor de «Mis sesiones» (PR 16, pedido por Víctor): crear y cambiar una sesión guardada sin IA, con lo que
// propone la app según el nivel (C-DOSIS-2 a 6) y el tope de series de D-B (3 principiante, 4 los demás).
// La forma guardada no cambia y, al hacerla, pasa por el check-in y el validador como cualquier mía (C-MIA-1).
// Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, est, ponerRed } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
ponerRed(false);
const { normalizarEstado } = await import(modulo('js/nucleo/normalizar.js'));
const { escala } = await import(modulo('js/areas/perfil/editor.js'));
const ci = (o = {}) => ({ lugar: 'casa', minutos: 45, energia: 3, dolorHoy: {}, peticion: '', ...o });
const ej = (id, o = {}) => ({ ...ent.propuestaMia(est.estado(), id, 0), ...o });

test('propuesta de la app: la dosis de las reglas con el tope de series de D-B', () => {
  nuevoS({ nivel: 1, objetivos: ['fuerza'], lugares: ['casa'] });
  for (const id of ['press-banca-mancuernas', 'flexiones', 'crunch', 'plancha', 'dead-bug']) {
    const p = ent.propuestaMia(est.estado(), id, 0);
    assert.ok(p.series <= 3, `${id}: ${p.series} series para un principiante`);
    assert.equal(p.rol, 'principal');
    assert.ok(p.reps && typeof p.reps === 'string');
  }
  // Principiante: la plancha a 15-30 s (C-DOSIS-6) y el press, 3 × 6-8 con 150 s (C-DOSIS-2, fuerza)
  assert.match(ent.propuestaMia(est.estado(), 'plancha', 0).reps, /^15-30 s/);
  assert.deepEqual(ent.propuestaMia(est.estado(), 'press-banca-mancuernas', 0), { id: 'press-banca-mancuernas', rol: 'principal', series: 3, reps: '6-8', descanso: 150 });
  // Intermedio de fuerza: 4 series, nunca 5
  nuevoS({ nivel: 2, objetivos: ['fuerza'] });
  assert.equal(ent.propuestaMia(est.estado(), 'press-banca-mancuernas', 0).series, 4);
  assert.equal(ent.topeSeriesMia(est.estado(), cat.ex('press-banca-mancuernas')), 4);
  // El cardio va con su rol; la natación por distancia admite hasta 10 series (C-SERIES-1)
  assert.equal(ent.propuestaMia(est.estado(), 'bici-estatica', 0).rol, 'cardio');
  assert.equal(ent.topeSeriesMia(est.estado(), cat.ex('crol')), 10);
  assert.equal(ent.propuestaMia(est.estado(), 'no-existe', 0), null);
});

test('crear: nombre, lugar y ejercicios con la forma de siempre (sin claves nuevas)', () => {
  nuevoS({ nivel: 2, objetivos: ['salud'], lugares: ['casa'] });
  const r = ent.guardarEdicionMia(null, { nombre: '  Abdominales   y flexiones ', lugar: 'casa', ejercicios: [ej('flexiones'), ej('crunch'), ej('plancha')] });
  assert.ok(!r.error, r.error);
  const [m] = est.estado().misSesiones;
  assert.equal(m.nombre, 'Abdominales y flexiones');
  assert.equal(m.lugar, 'casa');
  assert.deepEqual(Object.keys(m).sort(), ['creada', 'ejercicios', 'id', 'lugar', 'minutos', 'nombre']);
  assert.deepEqual(m.ejercicios.map(x => x.id), ['flexiones', 'crunch', 'plancha']);
  m.ejercicios.forEach(x => assert.deepEqual(Object.keys(x).sort(), ['descanso', 'id', 'reps', 'rol', 'series']));
  assert.ok(m.minutos >= 10 && m.minutos <= 240);
  // El normalizador la deja igual (la forma guardada no cambia)
  const { estado: N } = normalizarEstado(JSON.parse(JSON.stringify(est.estado())));
  assert.deepEqual(N.misSesiones, est.estado().misSesiones);
});

test('guardar valida: nombre, nombre repetido, al menos un ejercicio, 30 ejercicios y 30 sesiones', () => {
  nuevoS({ nivel: 2, lugares: ['casa'] });
  const S = est.estado();
  assert.match(ent.guardarEdicionMia(null, { nombre: '   ', lugar: 'casa', ejercicios: [ej('crunch')] }).error, /Ponle un nombre/);
  assert.match(ent.guardarEdicionMia(null, { nombre: 'Vacía', lugar: 'casa', ejercicios: [] }).error, /al menos un ejercicio/);
  assert.match(ent.guardarEdicionMia(null, { nombre: 'Rara', lugar: 'casa', ejercicios: [{ id: 'no-existe', series: 3, reps: '10', descanso: 60 }] }).error, /al menos un ejercicio/);
  const muchos = cat.EJERCICIOS.slice(0, 31).map(e => ej(e.id));
  assert.match(ent.guardarEdicionMia(null, { nombre: 'Larga', lugar: 'gym', ejercicios: muchos }).error, /Como mucho 30 ejercicios/);
  assert.ok(ent.guardarEdicionMia(null, { nombre: 'Abdos', lugar: 'casa', ejercicios: [ej('crunch')] }).mia);
  assert.match(ent.guardarEdicionMia(null, { nombre: 'ABDOS', lugar: 'casa', ejercicios: [ej('crunch')] }).error, /Ya tienes una sesión que se llama/);
  assert.equal(ent.guardarEdicionMia(null, { nombre: 'x'.repeat(60), lugar: 'casa', ejercicios: [ej('crunch')] }).mia.nombre.length, ent.LARGO_NOMBRE_MIA);
  for (let i = misSesiones().length; i < ent.MAX_MIAS; i++) assert.ok(ent.guardarEdicionMia(null, { nombre: 'Sesión ' + i, lugar: 'casa', ejercicios: [ej('crunch')] }).mia);
  assert.match(ent.guardarEdicionMia(null, { nombre: 'Una más', lugar: 'casa', ejercicios: [ej('crunch')] }).error, /Ya tienes 30 sesiones guardadas/);
  assert.equal(misSesiones().length, 30);
  void S;
});
const misSesiones = () => est.estado().misSesiones || [];

test('editar conserva id, fecha y «suave»; respeta los topes aunque lleguen valores de más', () => {
  nuevoS({ nivel: 1, lugares: ['casa'] });
  const { mia } = ent.guardarEdicionMia(null, { nombre: 'Core', lugar: 'casa', ejercicios: [ej('crunch'), ej('plancha')] });
  est.cambiar(S => { S.misSesiones[0].tipo = 'suave'; }, 'misSesiones');
  const r = ent.guardarEdicionMia(mia.id, { nombre: 'Core suave', lugar: 'gym', ejercicios: [ej('plancha', { series: 9, descanso: 999 }), ej('crunch', { series: 0 })] });
  assert.ok(!r.error, r.error);
  const [m] = misSesiones();
  assert.equal(m.id, mia.id);
  assert.equal(m.creada, mia.creada);
  assert.equal(m.tipo, 'suave');
  assert.equal(m.nombre, 'Core suave');
  assert.equal(m.lugar, 'gym');
  assert.deepEqual(m.ejercicios.map(x => [x.id, x.series, x.descanso]), [['plancha', 3, 300], ['crunch', 1, m.ejercicios[1].descanso]]);
  // Renombrar a un nombre que ya tiene otra no se puede; a sí misma, sí
  ent.guardarEdicionMia(null, { nombre: 'Otra', lugar: 'casa', ejercicios: [ej('crunch')] });
  assert.match(ent.guardarEdicionMia(mia.id, { nombre: 'otra', lugar: 'casa', ejercicios: [ej('crunch')] }).error, /Ya tienes/);
  assert.ok(ent.guardarEdicionMia(mia.id, { nombre: 'core suave', lugar: 'casa', ejercicios: [ej('crunch')] }).mia);
  assert.match(ent.guardarEdicionMia('no-esta', { nombre: 'X', lugar: 'casa', ejercicios: [ej('crunch')] }).error, /ya no está/);
});

test('añadir desde la ficha: al final, con la propuesta; sin repetir ni pasar de 30', () => {
  nuevoS({ nivel: 2, lugares: ['casa'] });
  const { mia } = ent.guardarEdicionMia(null, { nombre: 'Abdos', lugar: 'casa', ejercicios: [ej('crunch')] });
  const r = ent.añadirAMia(mia.id, 'flexiones');
  assert.ok(!r.error, r.error);
  assert.deepEqual(misSesiones()[0].ejercicios.map(x => x.id), ['crunch', 'flexiones']);
  assert.deepEqual(misSesiones()[0].ejercicios[1], ent.propuestaMia(est.estado(), 'flexiones', 1));
  assert.match(ent.añadirAMia(mia.id, 'flexiones').error, /ya está en «Abdos»/);
  assert.match(ent.añadirAMia('otra', 'flexiones').error, /ya no está/);
  assert.match(ent.añadirAMia(mia.id, 'no-existe').error, /catálogo/);
  ent.guardarEdicionMia(mia.id, { nombre: 'Abdos', lugar: 'gym', ejercicios: cat.EJERCICIOS.slice(0, 30).map(e => ej(e.id)) });
  assert.match(ent.añadirAMia(mia.id, cat.EJERCICIOS[40].id).error, /ya tiene 30 ejercicios/);
});

test('al hacerla: sin IA, con calentamiento, cardio y estiramientos, y respetando lo editado (C-MIA-1)', async () => {
  nuevoS({ nivel: 2, objetivos: ['salud'], lugares: ['casa'] });
  const { mia } = ent.guardarEdicionMia(null, { nombre: 'Abdominales y flexiones', lugar: 'casa', ejercicios: [ej('flexiones', { series: 4 }), ej('crunch'), ej('plancha')] });
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id }));
  assert.deepEqual(s.origen, { tipo: 'mia', id: mia.id });
  const ids = s.ejercicios.map(x => x.id);
  for (const id of ['flexiones', 'crunch', 'plancha']) assert.ok(ids.includes(id), id);
  assert.equal(s.ejercicios.find(x => x.id === 'flexiones').series, 4);
  assert.ok(s.ejercicios.some(x => x.rol === 'cardio'), 'sin cardio');
  assert.ok(s.calentamiento.length >= 2, 'sin calentamiento');
  assert.ok(s.vuelta.some(t => /estir|postura/i.test(t.nombre)), 'sin estiramientos');
});

test('escala de repeticiones, tiempo y distancia: incluye el valor de la sesión y su «c/lado»', () => {
  const r = escala('8-12');
  assert.equal(r.u, '');
  assert.ok(r.valores.includes('8-12'));
  const t = escala('30-45s');
  assert.equal(t.u, 's');
  assert.ok(t.valores.includes('30-45s'), 'conserva cómo estaba escrito');
  assert.ok(!t.valores.includes('30-45 s'), 'sin duplicar el mismo rango');
  const lado = escala('20-30 s c/lado');
  assert.ok(lado.valores.every(v => / c\/lado$/.test(v)));
  const raro = escala('17-19');
  const i = raro.valores.indexOf('17-19');
  assert.ok(i > raro.valores.indexOf('15-20') && i < raro.valores.indexOf('20-25'), 'ordenado por el rango');
  assert.equal(escala('25 m').u, 'm');
  assert.equal(escala('10-20 min').u, 'min');
});
