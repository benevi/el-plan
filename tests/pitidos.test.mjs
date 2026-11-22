// COD-4 (re-auditoría): el audio programado del temporizador, lo que suena con la pantalla bloqueada.
// Instantes de los pitidos del descanso (cuenta atrás y tres alarmas), de la previa de 5 s, del mínimo y del
// máximo de un ejercicio por tiempo y de «c/lado», y que el WAV lleve el sonido en esos segundos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulo } from './ayuda/comun.mjs';

const { agenda, wav, fasesCuenta, PREVIA, ALARMAS_DESCANSO } = await import(modulo('js/areas/sesion/pitidos.js'));

const r = x => Math.round(x * 100) / 100;
const inicios = (p, f) => p.filter(x => f(x)).map(x => r(x.t));
// Una alarma son tres pitidos (880, 880, 1320 Hz): se cuenta por su primer pitido.
const alarmas = p => p.filter((x, i) => x.f === 880 && !(p[i - 1] && p[i - 1].f === 880 && r(x.t - p[i - 1].t) === 0.32)).map(x => r(x.t));
const cortos = p => inicios(p, x => x.f === 660);

test('descanso de 90 s: cuenta atrás 3-2-1 y tres alarmas (fin, +4 y +8 s); el audio dura hasta fin + 10', () => {
  assert.deepEqual(ALARMAS_DESCANSO, [0, 4, 8]);
  const { p, dur } = agenda([{ f: 'descanso', dur: 90 }], 0, 0);
  assert.deepEqual(cortos(p), [87, 88, 89]);
  assert.deepEqual(alarmas(p), [90, 94, 98]);
  assert.equal(p.filter(x => x.f === 1320).length, 3, 'cada alarma acaba en un pitido agudo');
  assert.equal(dur, 100);
});

test('descanso a mitad: los instantes se cuentan desde ahora y lo ya pasado no suena', () => {
  const { p, dur } = agenda([{ f: 'descanso', dur: 90 }], 0, 88.5);
  assert.deepEqual(cortos(p), [0.5]);
  assert.deepEqual(alarmas(p), [1.5, 5.5, 9.5]);
  assert.equal(dur, 11.5);
  // Pasado el fin, quedan las alarmas que faltan (la tercera, a los 8 s del fin)
  assert.deepEqual(alarmas(agenda([{ f: 'descanso', dur: 90 }], 0, 95).p), [3]);
});

test('ejercicio por tiempo 30-45 s: previa de 5 s (3-2-1 y «ya»), doble pitido al mínimo y alarma al máximo', () => {
  assert.equal(PREVIA, 5);
  const fases = fasesCuenta({ lo: 30, hi: 45 });
  assert.deepEqual(fases, [{ f: 'previa', dur: 5, lado: 0 }, { f: 'trabajo', lo: 30, hi: 45, lado: 0 }]);
  const { p, dur } = agenda(fases, 0, 0);
  assert.deepEqual(cortos(p), [2, 3, 4, 47, 48, 49]);
  assert.deepEqual(inicios(p, x => x.f === 1320 && x.d === 0.45), [5], 'el «ya» al acabar la previa');
  assert.deepEqual(inicios(p, x => x.f === 1040), [35, 35.25], 'doble pitido al llegar al mínimo');
  assert.deepEqual(alarmas(p), [50]);
  assert.equal(dur, 51.5);
});

test('sin rango (40 s): no hay doble pitido del mínimo; c/lado: el segundo lado con su previa justo tras el primero', () => {
  assert.deepEqual(inicios(agenda(fasesCuenta({ lo: 40, hi: 40 }), 0, 0).p, x => x.f === 1040), []);
  const fases = fasesCuenta({ lo: 20, hi: 30, lados: 2 });
  assert.deepEqual(fases.map(f => f.f + f.lado), ['previa1', 'trabajo1', 'previa2', 'trabajo2']);
  const { p, dur } = agenda(fases, 0, 0);
  assert.deepEqual(inicios(p, x => x.f === 1320 && x.d === 0.45), [5, 40]);
  assert.deepEqual(inicios(p, x => x.f === 1040).filter((t, i) => i % 2 === 0), [25, 60]);
  assert.deepEqual(alarmas(p), [35, 70]);
  assert.equal(dur, 71.5);
  // Ya en el segundo lado, a 10 s de empezarlo
  assert.deepEqual(alarmas(agenda(fases, 3, 10).p), [20]);
});

test('el WAV lleva sonido en el segundo de cada pitido y silencio entre medias', async () => {
  const { p, dur } = agenda([{ f: 'descanso', dur: 10 }], 0, 0);
  const b = new Uint8Array(await wav(p, dur).arrayBuffer());
  assert.equal(String.fromCharCode(...b.slice(0, 4)), 'RIFF');
  const R = 8000, n = b.length - 44;
  assert.equal(n, Math.ceil((dur + 0.5) * R));
  const suena = (desde, hasta) => { for (let k = Math.floor(desde * R); k < Math.floor(hasta * R); k++) if (Math.abs(b[44 + k] - 128) > 20) return true; return false; };
  for (const t of [10, 14, 18]) assert.ok(suena(t, t + 0.2), `sin alarma a los ${t} s`);
  for (const t of [7, 8, 9]) assert.ok(suena(t, t + 0.08), `sin cuenta atrás a los ${t} s`);
  assert.ok(!suena(1, 6.9), 'suena algo antes de la cuenta atrás');
  assert.ok(!suena(15, 17.9), 'suena algo entre la segunda y la tercera alarma');
});
