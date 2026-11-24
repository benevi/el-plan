// Forma de una sesión y de un ejercicio (js/nucleo/modelo.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { modelo, est, cat } from './ayuda/node.mjs';

const { crearEjercicio, crearSesion, sesionDeHoy } = modelo;

test('crearEjercicio toma series, reps y descanso del catálogo si no vienen', () => {
  const x = crearEjercicio({ id: 'press-pecho-maquina' });
  assert.equal(x.series, 4);
  assert.equal(x.reps, '8-12');
  assert.equal(x.descanso, 90);
  assert.equal(x.rol, 'principal');
  assert.equal(x.kg, null);
  assert.equal(x.sets.length, 4);
  assert.deepEqual(x.sets[0], { kg: null, valor: '', hecha: false });
});

test('crearEjercicio acota series (1-10), descanso (0-300) y rol', () => {
  assert.equal(crearEjercicio({ id: 'plancha', series: 40 }).series, 10);
  assert.equal(crearEjercicio({ id: 'plancha', series: 0 }).series, cat.ex('plancha').d[0]); // 0 → valor del catálogo
  assert.equal(crearEjercicio({ id: 'plancha', series: -3 }).series, 1);
  assert.equal(crearEjercicio({ id: 'plancha', descanso: 900 }).descanso, 300);
  assert.equal(crearEjercicio({ id: 'plancha', descanso: -5 }).descanso, cat.ex('plancha').d[2]); // negativo → catálogo
  assert.equal(crearEjercicio({ id: 'plancha', descanso: 0 }).descanso, 0);
  assert.equal(crearEjercicio({ id: 'plancha', rol: 'jefe' }).rol, 'principal');
  assert.equal(crearEjercicio({ id: 'bici-estatica', rol: 'cardio' }).rol, 'cardio');
});

test('crearEjercicio redondea los kilos a 0,25 y descarta valores imposibles', () => {
  assert.equal(crearEjercicio({ id: 'curl-mancuernas', kg: 12.3 }).kg, 12.25);
  assert.equal(crearEjercicio({ id: 'curl-mancuernas', kg: 0 }).kg, null);
  assert.equal(crearEjercicio({ id: 'curl-mancuernas', kg: -5 }).kg, null);
  assert.equal(crearEjercicio({ id: 'curl-mancuernas', kg: 400 }).kg, null);
  assert.equal(crearEjercicio({ id: 'curl-mancuernas', kg: 'abc' }).kg, null);
  const x = crearEjercicio({ id: 'curl-mancuernas', kg: 10, series: 2 });
  assert.deepEqual(x.sets.map(s => s.kg), [10, 10]);
});

test('crearEjercicio recorta textos largos', () => {
  const x = crearEjercicio({ id: 'plancha', nota: 'a'.repeat(500), motivo: 'b'.repeat(500), reps: '1'.repeat(50) });
  assert.equal(x.nota.length, 300);
  assert.equal(x.motivo.length, 300);
  assert.equal(x.reps.length, 24);
});

test('crearSesion quita ejercicios inexistentes o de otro lugar y normaliza tareas', () => {
  const s = crearSesion({
    nombre: 'Torso', lugar: 'gym', minutos: '45', explicacion: 'Una sola razón',
    calentamiento: [{ id: 'bici-estatica', duracion: '5 min' }, { nombre: '' }, { nombre: 'Movilidad libre' }],
    ejercicios: [{ id: 'press-pecho-maquina' }, { id: 'no-existe' }, { id: 'crol' }],
    vueltaCalma: [{ nombre: 'Estirar pecho', duracion: '1 min' }],
  });
  assert.equal(s.estado, 'pendiente');
  assert.equal(s.fuente, 'reglas');
  assert.equal(s.minutos, 45);
  assert.deepEqual(s.explicacion, ['Una sola razón']);
  assert.deepEqual(s.ejercicios.map(x => x.id), ['press-pecho-maquina']);
  assert.deepEqual(s.calentamiento.map(t => t.nombre), ['Bici estática', 'Movilidad libre']);
  assert.equal(s.calentamiento[0].id, 'bici-estatica');
  assert.equal(s.calentamiento[1].id, null);
  assert.deepEqual(s.vuelta.map(t => t.nombre), ['Estirar pecho']);
  assert.match(s.id, /^[a-z0-9]+$/);
});

test('crearSesion pone la fecha local de hoy', () => {
  const reloj = fijarFecha('2026-11-19T23:50');
  try {
    assert.equal(crearSesion({}).fecha, '2026-11-19');
  } finally { reloj.restaurar(); }
});

test('sesionDeHoy devuelve la última creada hoy e ignora las migradas', () => {
  const S = est.nuevo();
  const hoy = est.hoyISO();
  S.sesiones = {
    a: { id: 'a', fecha: hoy, creada: '2026-01-01T10:00:00Z', fuente: 'reglas' },
    b: { id: 'b', fecha: hoy, creada: '2026-01-01T12:00:00Z', fuente: 'ia' },
    c: { id: 'c', fecha: hoy, creada: '2026-01-01T13:00:00Z', fuente: 'anterior' },
    d: { id: 'd', fecha: '2000-01-01', creada: '2026-01-01T14:00:00Z', fuente: 'ia' },
  };
  assert.equal(sesionDeHoy(S).id, 'b');
  assert.equal(sesionDeHoy(est.nuevo()), null);
});
