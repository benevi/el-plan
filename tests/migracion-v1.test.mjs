// Quien ya migró con la versión con fallos (datos v1, antes del PR 4) y luego usó la app: la corrección única
// no resucita ni duplica lo que borró o cambió, arregla las fechas y enlaza el dolor (revisión del PR 4).
// tests/datos/v1-victor.json: lo que dejó en pipos4 la migración con fallos para Víctor con viejoReal().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ruta } from './ayuda/comun.mjs';
import { est, cargarCon } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const base = JSON.parse(fs.readFileSync(ruta('tests/datos/v1-victor.json'), 'utf8'));
// Arranca dos veces (la corrección es única y lo demás idempotente) y devuelve el estado tras cada arranque.
function arrancar(cambio = () => {}) {
  const p4 = JSON.parse(base.pipos4), v = JSON.parse(base.elplan2);
  cambio(p4, v);
  const datos = { pipos4: p4, elplan2: v };
  const vueltas = [];
  for (let i = 0; i < 2; i++) {
    cargarCon(datos);
    const r = est.ponerAlDiaMigracion();
    est.guardarYa();
    datos.pipos4 = JSON.parse(N.almacen.getItem('pipos4'));
    vueltas.push({ r, S: JSON.parse(JSON.stringify(est.estado())) });
  }
  assert.deepEqual(vueltas[1].S, vueltas[0].S, 'el segundo arranque no cambia nada');
  return vueltas[0];
}
const lesiones = S => S.perfil.lesiones.map(l => `${l.zona}:${l.nota}:${l.activa}`);

test('sin cambios: no se duplica nada, la fecha pasa a la local y el dolor se enlaza con la sesión v1', () => {
  const { r, S } = arrancar();
  assert.deepEqual([r.sesiones, r.lesiones, r.medidas], [0, 0, 0]);
  assert.equal(Object.keys(S.sesiones).length, 6);
  assert.deepEqual(Object.values(S.sesiones).map(s => s.fecha).sort(), ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'], 'acabaron a las 00:45 en Madrid');
  assert.deepEqual(lesiones(S), ['rodilla:Menisco:true']);
  assert.equal(S.medidas.length, 2);
  const s1 = Object.values(S.sesiones).find(s => s.terminada === '2026-10-01T22:45:00.000Z');
  assert.deepEqual(S.dolor.map(d => [d.fecha, d.momento, d.sesion]), [['2026-10-02', 'antes', s1.id], ['2026-10-02', 'despues', s1.id]]);
  assert.ok(S.sesiones[s1.id], 'el dolor apunta a una sesión que existe');
});

test('lesión borrada no vuelve', () => {
  const { S } = arrancar(p4 => { p4.perfil.lesiones = []; });
  assert.deepEqual(S.perfil.lesiones, []);
});

test('lesión curada (y con otra fecha) no vuelve activa', () => {
  const { S } = arrancar(p4 => { p4.perfil.lesiones[0].activa = false; p4.perfil.lesiones[0].desde = '2026-10-15'; });
  assert.deepEqual(lesiones(S), ['rodilla:Menisco:false']);
});

test('lesión con la nota cambiada no se duplica', () => {
  const { S } = arrancar(p4 => { p4.perfil.lesiones[0].nota = 'Menisco (editado)'; });
  assert.deepEqual(lesiones(S), ['rodilla:Menisco (editado):true']);
});

test('sesión borrada no vuelve', () => {
  const { S } = arrancar(p4 => { delete p4.sesiones[Object.keys(p4.sesiones)[0]]; });
  assert.equal(Object.keys(S.sesiones).length, 5);
});

test('medida corregida no reaparece (ni al día siguiente por la fecha local)', () => {
  const { S } = arrancar(p4 => { p4.medidas[0].peso = 82.2; });
  assert.deepEqual(S.medidas.map(m => `${m.fecha}:${m.peso}`), ['2026-10-01:82.2', '2026-10-05:81.5']);
});

test('lo posterior a la migración (marcha atrás a main) sí se trae', () => {
  const { r, S } = arrancar((p4, v) => { v.workouts.h9 = { ...v.workouts.h0, key: 'h9', date: '2026-10-20T18:00:00.000Z', completedAt: '2026-10-20T19:00:00.000Z' }; });
  assert.equal(r.sesiones, 1);
  assert.ok(S.sesiones['v-h9']);
});

test('sin elplan2: no se inventa nada y el sexo se pregunta', () => {
  const p4 = JSON.parse(base.pipos4);
  cargarCon({ pipos4: p4 });
  est.ponerAlDiaMigracion();
  assert.equal(Object.keys(est.estado().sesiones).length, 6);
  assert.equal(est.estado().migracion.sexoRevisar, true);
});
