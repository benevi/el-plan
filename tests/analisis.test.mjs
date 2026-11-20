// Análisis de Progreso (js/areas/progreso/analisis.js): constancia, fuerza, salud y dolor.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, restaurarFecha } from './ayuda/comun.mjs';
import { analisis as A, nuevoS, hecha } from './ayuda/node.mjs';

afterEach(restaurarFecha);

const sesionEn = (S, cuando, id = 'press-pecho-maquina') => hecha(S, 0, [{ id, sets: [[40, 10], [40, 10]] }], { cuando: new Date(cuando) });

test('con datos vacíos nada falla y no se inventan números', () => {
  const S = nuevoS();
  const c = A.constancia(S);
  assert.equal(c.total, 0);
  assert.equal(c.racha, 0);
  assert.equal(c.diasSin, null);
  assert.equal(c.semanas.length, 8);
  assert.equal(A.textoConstancia(c), 'Tu primera sesión empieza la cuenta.');
  const f = A.fuerza(S);
  assert.deepEqual(f.filas, []);
  assert.equal(f.mediana, null);
  assert.deepEqual(A.dolor(S), []);
  assert.equal(A.salud(S).cardio, 0);
  assert.ok(A.analisisParaEntrenador(S));
});

test('constancia: 3 de 3 la semana pasada → 100 % y racha 1', () => {
  fijarFecha('2026-11-19T10:00'); // jueves
  const S = nuevoS();
  for (const d of ['2026-11-10T19:00', '2026-11-12T19:00', '2026-11-14T19:00']) sesionEn(S, d);
  const c = A.constancia(S);
  assert.equal(c.cumplimiento, 100);
  assert.equal(c.racha, 1);
  assert.equal(c.estaSemana, 0);
  assert.equal(c.faltan, 3);
  assert.equal(c.total, 3);
});

test('constancia: las 8 semanas son consecutivas y la última es la actual', () => {
  fijarFecha('2026-11-19T10:00');
  const c = A.constancia(nuevoS());
  assert.equal(c.semanas[7].sem, '2026-W47');
  assert.ok(c.semanas[7].actual);
  assert.equal(c.semanas[0].sem, '2026-W40');
});

test('fuerza: tolera kilos y repeticiones raros y calcula el cambio', () => {
  const S = nuevoS();
  const a = hecha(S, 20, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]);
  const b = hecha(S, 10, [{ id: 'press-pecho-maquina', sets: [[45, '8-10'], [0, '8']] }]);
  S.sesiones[a].ejercicios[0].sets.push({ kg: '42,5', valor: 'ocho', hecha: true }, { kg: null, valor: '', hecha: true });
  S.sesiones[b].ejercicios.push({ id: null, nombre: 'Viejo', sets: [{ kg: 20, valor: '5', hecha: true }], reps: '', series: 1 });
  const f = A.fuerza(S);
  assert.equal(f.filas.length, 1);
  const fila = f.filas[0];
  assert.equal(fila.id, 'press-pecho-maquina');
  assert.equal(fila.veces, 2);
  assert.equal(fila.ultimoKg, 45);
  assert.ok(Number.isFinite(fila.cambio) && fila.cambio > 0);
});

test('grasaMarina: fórmula de hombre y de mujer', () => {
  assert.equal(A.grasaMarina('h', 180, 39, 90), 19.1);
  assert.equal(A.grasaMarina('m', 165, 32, 70), null); // la de mujer necesita cadera
  assert.ok(A.grasaMarina('m', 165, 32, 70, 95) > 0);
});

// ── Fallos demostrados por la auditoría ──

test('constancia en la primera semana: sin semanas cerradas no hay cumplimiento (no un 0 %)', { todo: 'PR 10: corrección de la constancia en la primera semana' }, () => {
  fijarFecha('2026-11-19T10:00');
  const S = nuevoS();
  assert.equal(A.constancia(S).cumplimiento, null, 'sin ninguna sesión');
  sesionEn(S, '2026-11-19T09:00');
  assert.equal(A.constancia(S).cumplimiento, null, 'con la primera sesión de su vida');
});

test('constancia: tras el cambio de hora de primavera no se salta ninguna semana', { todo: 'PR 10: semanas de la constancia calculadas restando 7×24 h' }, () => {
  fijarFecha('2026-03-30T00:30'); // lunes, justo después del cambio de hora
  const S = nuevoS();
  sesionEn(S, '2026-03-25T19:00');
  const sem = A.constancia(S).semanas.map(s => s.sem);
  assert.deepEqual(sem, ['2026-W07', '2026-W08', '2026-W09', '2026-W10', '2026-W11', '2026-W12', '2026-W13', '2026-W14']);
});
