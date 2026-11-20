// Matriz de 336 casos del plan (T1, T2, T3) por el camino de reglas. Ver ayuda/matriz.mjs.
// Lo que ya se cumple se comprueba; lo que no, queda como `todo` del PR 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casos, esCardio, esEstiramiento, conCarga } from './ayuda/matriz.mjs';
import { cat, ent } from './ayuda/node.mjs';

const FILAS = casos();
const fallan = pred => FILAS.filter(pred).map(f => f.nombre);

test('la matriz tiene 336 casos', () => {
  assert.equal(FILAS.length, 336);
});

test('toda sesión de la matriz lleva calentamiento, al menos un principal y estiramientos en la vuelta', () => {
  assert.deepEqual(fallan(f => !f.sesion.calentamiento.length), []);
  assert.deepEqual(fallan(f => !f.sesion.ejercicios.some(x => x.rol === 'principal')), []);
  assert.deepEqual(fallan(f => !f.sesion.vuelta.some(esEstiramiento)), []);
});

test('ningún ejercicio de la matriz es de otro lugar ni sin material, ni se repite', () => {
  assert.deepEqual(fallan(f => f.sesion.ejercicios.some(x => !cat.ex(x.id) || !cat.ex(x.id).l.includes(f.sesion.lugar))), []);
  assert.deepEqual(fallan(f => f.sesion.ejercicios.some(x => !cat.hayMaterial(cat.ex(x.id), f.sesion.lugar, { materialCasa: [] }))), []);
  assert.deepEqual(fallan(f => new Set(f.sesion.ejercicios.map(x => x.id)).size !== f.sesion.ejercicios.length), []);
});

test('con dolor 8 en la rodilla no hay ningún ejercicio con riesgo para la rodilla', () => {
  assert.deepEqual(fallan(f => f.dolor && f.sesion.ejercicios.some(x => (cat.ex(x.id).r || {}).rodilla)), []);
});

// ── Fallos demostrados por la auditoría (PR 8) ──

test('T1: ninguna sesión de la matriz queda sin cardio', { todo: 'PR 8: cardio siempre según D3 (hoy 180 de 336 sin cardio)' }, () => {
  const sin = fallan(f => !f.sesion.ejercicios.some(esCardio));
  assert.equal(sin.length, 0, `${sin.length} sin cardio, p. ej.: ${sin.slice(0, 3).join(' · ')}`);
});

test('T2: con dolor ≥ 7 no hay ningún ejercicio principal con carga', { todo: 'PR 8: día con dolor ≥ 7 (rama propia según D2)' }, () => {
  const mal = fallan(f => f.dolor && f.sesion.ejercicios.some(x => x.rol === 'principal' && conCarga(x)));
  assert.equal(mal.length, 0, `${mal.length} casos, p. ej.: ${mal.slice(0, 3).join(' · ')}`);
});

test('el tiempo estimado no pasa de lo pedido + 10 %', { todo: 'PR 8: tiempo no respetado (bajar series y descansos antes que quitar ejercicios)' }, () => {
  const mal = FILAS.filter(f => ent.tiempoSesion(f.sesion) > f.minutos * 1.1).map(f => `${f.nombre}: ${ent.tiempoSesion(f.sesion)} min`);
  assert.equal(mal.length, 0, `${mal.length} casos, p. ej.: ${mal.slice(0, 3).join(' · ')}`);
});
