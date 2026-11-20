// Fechas: hoyISO, semanaISO y diaSemana en hora de Madrid, con cambios de año y de hora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulo, isoLocal, semanaRef } from './ayuda/comun.mjs';

const { hoyISO } = await import(modulo('js/nucleo/estado.js'));
const { semanaISO, diaSemana } = await import(modulo('js/nucleo/modelo.js'));

test('la zona horaria de las pruebas es Europe/Madrid', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Madrid');
});

test('hoyISO y semanaISO coinciden con la referencia en 2019-2032 a varias horas', () => {
  let n = 0;
  const malos = [];
  for (let y = 2019; y <= 2032; y++) for (let m = 0; m < 12; m++) for (let d = 1; d <= 31; d++) for (const hh of [0, 1, 2, 3, 12, 23]) {
    const f = new Date(y, m, d, hh, 30);
    if (f.getMonth() !== m) continue; // 31 de febrero, etc.
    n++;
    if (semanaISO(f) !== semanaRef(f)) malos.push(['semana', f.toString(), semanaISO(f), semanaRef(f)]);
    if (hoyISO(f) !== isoLocal(f)) malos.push(['hoy', f.toString(), hoyISO(f), isoLocal(f)]);
  }
  assert.ok(n > 30000);
  assert.deepEqual(malos.slice(0, 5), []);
});

test('semanaISO en fin e inicio de año', () => {
  const casos = {
    '2024-12-29T23:59': '2024-W52', '2024-12-30T00:01': '2025-W01', '2025-12-31T12:00': '2026-W01',
    '2026-01-01T00:00': '2026-W01', '2026-12-28T12:00': '2026-W53', '2027-01-03T23:00': '2026-W53',
    '2027-01-04T00:30': '2027-W01', '2021-01-03T12:00': '2020-W53', '2020-12-31T12:00': '2020-W53',
  };
  for (const [s, esperada] of Object.entries(casos)) assert.equal(semanaISO(new Date(s)), esperada, s);
});

test('hoyISO cerca de medianoche y en los cambios de hora', () => {
  assert.equal(hoyISO(new Date('2026-11-19T23:59')), '2026-11-19');
  assert.equal(hoyISO(new Date('2026-11-20T00:01')), '2026-11-20');
  // 29-mar-2026: a las 2:00 pasan a ser las 3:00 (la hora 2:30 no existe).
  assert.equal(hoyISO(new Date('2026-03-29T02:30')), '2026-03-29');
  assert.equal(hoyISO(new Date('2026-03-29T00:30')), '2026-03-29');
  // 25-oct-2026: a las 3:00 vuelven a ser las 2:00.
  assert.equal(hoyISO(new Date('2026-10-25T02:30')), '2026-10-25');
  assert.equal(hoyISO(new Date('2026-10-25T23:30')), '2026-10-25');
  assert.equal(hoyISO(new Date('2026-10-26T00:10')), '2026-10-26');
});

test('semanaISO no cambia de semana un domingo de cambio de hora y sí el lunes', () => {
  assert.equal(semanaISO(new Date('2026-03-29T23:30')), semanaISO(new Date('2026-03-23T00:10')));
  assert.notEqual(semanaISO(new Date('2026-03-30T00:30')), semanaISO(new Date('2026-03-29T23:30')));
  assert.equal(semanaISO(new Date('2026-10-25T23:30')), '2026-W43');
  assert.equal(semanaISO(new Date('2026-10-26T00:30')), '2026-W44');
});

test('diaSemana: lunes = 1 … domingo = 7', () => {
  assert.equal(diaSemana(new Date('2026-11-16T12:00')), 1);
  assert.equal(diaSemana(new Date('2026-11-21T12:00')), 6);
  assert.equal(diaSemana(new Date('2026-11-22T23:59')), 7);
  assert.equal(diaSemana(new Date('2026-11-23T00:00')), 1);
});
