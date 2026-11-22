// H5: C-NIVEL-3 con «Que mi progreso me cambie de nivel» activado: tras 70 días sin entrenar, ¿baja el nivel?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, fijarFecha } from './ayuda/comun.mjs';
import { montar } from './ayuda/dom.mjs';
fijarFecha('2026-11-18T10:00');
const hace = d => new Date(Date.now() - d * 864e5);
const ses = (id, d) => ({ id, fecha: hace(d).toISOString().slice(0, 10), creada: hace(d).toISOString(), terminada: hace(d).toISOString(), estado: 'hecha', fuente: 'reglas', nombre: 'x', lugar: 'gym', minutos: 60, explicacion: [], calentamiento: [], vuelta: [], checkin: null, cierre: null,
  ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 1, reps: '8-12', descanso: 90, sets: [{ kg: 40, valor: '10', hecha: true }], comentario: '', nota: '' }] });
const S0 = estadoBase();
S0.perfil.nivel = 2; S0.perfil.nivelAuto = true;
S0.sesiones = { a: ses('a', 80), b: ses('b', 75), c: ses('c', 70) };
const a = await montar({ ls: { pipos4: S0 }, hash: 'hoy' });
test('H5: 70 días sin entrenar con nivel automático → al abrir o al volver a entrenar baja a principiante', async () => {
  const ctx = await import('../js/reglas/contexto.js');
  const est = await import('../js/nucleo/estado.js');
  console.log('medidor al abrir:', JSON.stringify(ctx.medidorNivel(est.estado())).slice(0, 160));
  await a.tic(); await new Promise(r => setTimeout(r, 50));
  console.log('nivel tras abrir:', est.estado().perfil.nivel);
  // Vuelve a entrenar: termina una sesión hoy
  est.cambiar(S => { S.sesiones.d = ses('d', 0); }, 'sesion');
  await a.tic(); await new Promise(r => setTimeout(r, 50));
  console.log('medidor tras entrenar:', ctx.medidorNivel(est.estado()).sugerido, 'nivel:', est.estado().perfil.nivel);
  assert.equal(est.estado().perfil.nivel, 1, 'C-NIVEL-3 nunca se aplica solo: el nivel sigue en intermedio');
});
