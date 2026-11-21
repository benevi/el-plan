// Progreso del PR 16: los datos de los gráficos (constancia con el denominador del plan, sesiones por mes,
// dolor por mes, puntos con fecha) y los textos con concordancia («1 lesión activa», «glúteo e isquios»).
// Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, analisis as A, hecha } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
const { listaY, cuenta } = await import(modulo('js/areas/perfil/controles.js'));
const E = [{ id: 'press-pecho-maquina', sets: [[40, 10]] }];

test('constancia de 8 semanas: cada vaso con su lunes, y la semana en curso con el plan (como Hoy)', () => {
  const S = nuevoS({ disponibilidad: { dias: 3, minutos: 60, diasSemana: [] } });
  hecha(S, 1, E); hecha(S, 2, E);            // esta semana: lunes 16 y martes 17
  for (const d of [7, 8, 9]) hecha(S, d, E); // la anterior: 3 (cumplida)
  hecha(S, 14, E);                           // hace dos: 1
  const sin = A.constanciaSemanas(S, 8);
  assert.equal(sin.length, 8);
  assert.equal(sin[7].etiqueta, '16 nov');
  assert.equal(sin[0].etiqueta, '28 sep');
  assert.deepEqual(sin.slice(-3).map(s => [s.n, s.meta]), [[1, 3], [3, 3], [2, 3]]);
  // Con plan de 4 días y 1 hecho del plan, la semana en curso dice 1 de 4 (lo mismo que Hoy)
  const con = A.constanciaSemanas(S, 8, { planificados: 4, hechosPlan: 1 });
  assert.deepEqual([con[7].n, con[7].meta], [1, 4]);
  assert.deepEqual([con[6].n, con[6].meta], [3, 3]);
  // Racha: la semana en curso sin cumplir no la rompe
  assert.equal(A.rachaSemanas(sin), 1);
  assert.equal(A.rachaSemanas([...sin.slice(0, 7), { ...sin[7], n: 3 }]), 2);
});

test('sesiones por mes del último año: 12 meses, el último el de ahora, con los vacíos a 0', () => {
  const S = nuevoS();
  hecha(S, 1, E); hecha(S, 3, E); hecha(S, 40, E); hecha(S, 400, E);
  const m = A.sesionesPorMes(S, 12);
  assert.equal(m.length, 12);
  assert.equal(m[11].mes, '2026-11');
  assert.equal(m[11].etiqueta, 'nov');
  assert.equal(m[0].etiqueta, 'dic');
  assert.equal(m[11].n, 2);
  assert.equal(m[10].n, 1);
  assert.equal(m.reduce((a, x) => a + x.n, 0), 3, 'lo de hace más de un año no entra');
});

test('dolor por mes: media de lo apuntado después y en el día a día (no lo de antes), solo meses con datos', () => {
  const S = nuevoS();
  S.dolor = [
    { fecha: '2026-09-10', zona: 'lumbar', dolor: 6, momento: 'despues' },
    { fecha: '2026-11-02', zona: 'lumbar', dolor: 4, momento: 'despues' },
    { fecha: '2026-11-10', zona: 'lumbar', dolor: 2, momento: 'perfil' },
    { fecha: '2026-11-11', zona: 'lumbar', dolor: 9, momento: 'antes' },
    { fecha: '2026-11-11', zona: 'rodilla', dolor: 5, momento: 'despues' },
  ];
  assert.deepEqual(A.dolorPorMes(S, 'lumbar'), [{ etiqueta: 'sep', v: 6 }, { etiqueta: 'nov', v: 3 }]);
});

test('puntos con fecha para las líneas: los últimos, redondeados y con su día', () => {
  const serie = Array.from({ length: 15 }, (_, i) => ({ fecha: `2026-10-${String(i + 1).padStart(2, '0')}`, v: 40 + i / 3 }));
  const p = A.puntosFecha(serie, 12);
  assert.equal(p.length, 12);
  assert.deepEqual(p[0], { v: 41, etiqueta: '4 oct' });
  assert.equal(p[11].etiqueta, '15 oct');
});

test('textos: «y» o «e» y concordancia de número', () => {
  assert.equal(listaY(['Glúteo', 'isquios']), 'Glúteo e isquios');
  assert.equal(listaY(['pecho', 'hombro', 'tríceps']), 'pecho, hombro y tríceps');
  assert.equal(listaY(['agua', 'hierro']), 'agua y hierro'); // «hie-» va con «y»
  assert.equal(listaY(['tabla', 'hilo']), 'tabla e hilo');
  assert.equal(listaY(['core']), 'core');
  assert.equal(cuenta(1, 'lesión activa', 'lesiones activas'), '1 lesión activa');
  assert.equal(cuenta(2, 'lesión activa', 'lesiones activas'), '2 lesiones activas');
});
