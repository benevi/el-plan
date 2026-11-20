// Matriz de 336 casos del plan (criterios T1, T2 y T3 del PR 8) por el camino de reglas y con respuestas de
// IA simuladas (5 respuestas × 336 = 1680 sesiones). Ver ayuda/matriz.mjs.
// T1: toda sesión lleva calentamiento, cardio y vuelta con estiramientos (C-PRIN-4, D3).
// T2: con dolor ≥ 7, ni carga ni ejercicios de la zona (C-DOLOR-4) y minutos ≤ pedidos.
// T3: el validador único no encuentra nada (C-PRIN-3): lugar, material, riesgo, roles, dosis y tiempo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { casos, casosIA, esCardio, esEstiramiento, conCarga } from './ayuda/matriz.mjs';
import { cat, ent } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles
const FILAS = casos();
const FILAS_IA = await casosIA();
const fallan = (filas, pred) => filas.filter(pred).map(f => f.nombre);
const ejemplo = l => `${l.length} casos, p. ej.: ${l.slice(0, 3).join(' · ')}`;
// Minutos de la sesión: menos de 30 se trata como 30 (criterio §0).
const pedidos = f => Math.max(30, f.minutos);

test('la matriz tiene 336 casos por reglas y 1680 con IA simulada', () => {
  assert.equal(FILAS.length, 336);
  assert.equal(FILAS_IA.length, 336 * 5);
});

for (const [camino, filas] of [['reglas', FILAS], ['IA simulada', FILAS_IA]]) {
  test(`T1 (${camino}): toda sesión lleva calentamiento, cardio y vuelta con estiramientos`, () => {
    const mal = fallan(filas, f => f.sesion.calentamiento.length < 2 || !f.sesion.ejercicios.some(esCardio) || !f.sesion.vuelta.some(esEstiramiento));
    assert.equal(mal.length, 0, ejemplo(mal));
  });
  test(`T1 (${camino}): sin dolor alto, al menos 3 principales o el último recurso de tiempo explicado`, () => {
    const mal = fallan(filas, f => !f.dolor && f.sesion.ejercicios.filter(x => x.rol === 'principal').length < 3 && !f.sesion.explicacion.some(t => /último recurso|no caben tu cardio/.test(t)));
    assert.equal(mal.length, 0, ejemplo(mal));
  });
  test(`T2 (${camino}): con dolor ≥ 7 no hay principales (con o sin carga), ni rehabilitación, ni nada con riesgo para la rodilla, y los minutos son los pedidos`, () => {
    const mal = fallan(filas, f => f.dolor && (f.sesion.ejercicios.some(x => (x.rol === 'principal' && conCarga(x)) || x.rol === 'principal' || x.rol === 'rehab' || (cat.ex(x.id).r || {}).rodilla)
      || [...f.sesion.calentamiento, ...f.sesion.vuelta].some(t => t.id && (cat.ex(t.id).r || {}).rodilla)
      || Math.abs(ent.tiempoSesion(f.sesion) - pedidos(f)) > 2));
    assert.equal(mal.length, 0, ejemplo(mal));
  });
  test(`T3 (${camino}): el validador único no encuentra nada en ninguna sesión`, () => {
    const mal = filas.map(f => [f.nombre, ent.problemasSesion(f.S, f.sesion, f.ci)]).filter(([, p]) => p.length).map(([n, p]) => `${n}: ${p.join('; ')}`);
    assert.equal(mal.length, 0, ejemplo(mal));
  });
  test(`T3 (${camino}): ningún ejercicio es de otro lugar ni sin material, ni se repite`, () => {
    assert.deepEqual(fallan(filas, f => f.sesion.ejercicios.some(x => !cat.ex(x.id) || !cat.ex(x.id).l.includes(f.sesion.lugar))), []);
    assert.deepEqual(fallan(filas, f => f.sesion.ejercicios.some(x => !cat.hayMaterial(cat.ex(x.id), f.sesion.lugar, { materialCasa: [] }))), []);
    assert.deepEqual(fallan(filas, f => new Set(f.sesion.ejercicios.map(x => x.id)).size !== f.sesion.ejercicios.length), []);
  });
  test(`C-TIEMPO-1 (${camino}): el tiempo estimado no pasa de lo pedido + 10 % salvo el último recurso explicado`, () => {
    const mal = filas.filter(f => ent.tiempoSesion(f.sesion) > pedidos(f) * 1.1 && !f.sesion.explicacion.some(t => /no caben tu cardio/.test(t))).map(f => `${f.nombre}: ${ent.tiempoSesion(f.sesion)} min`);
    assert.equal(mal.length, 0, ejemplo(mal));
  });
}

test('C-ALAR-5 / C-DOLOR-4: con dolor ≥ 7 nunca se llama a la IA, aunque se pida', () => {
  assert.deepEqual(fallan(FILAS_IA, f => f.dolor && f.peticiones > 0), []);
  assert.ok(FILAS_IA.filter(f => !f.dolor).every(f => f.peticiones === 1));
});
