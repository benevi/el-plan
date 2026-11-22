// COD-2 de la re-auditoría · C-NIVEL-3 con «Que mi progreso me cambie de nivel» activado (el valor por defecto):
// tras 56 días sin entrenar, el nivel baja uno antes de la primera sesión, al abrir la app.
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

test('COD-2, C-NIVEL-3: 70 días sin entrenar con el nivel automático → al abrir la app pasa a principiante, y queda apuntado', async () => {
  const est = await import('../js/nucleo/estado.js');
  await a.tic(); await new Promise(r => setTimeout(r, 30));
  const p = est.estado().perfil;
  assert.equal(p.nivel, 1);
  const ultimo = (p.nivelCambios || []).slice(-1)[0];
  assert.ok(ultimo && ultimo.de === 2 && ultimo.a === 1 && /sin entrenar/.test(ultimo.motivo));
  // Ya en principiante, no vuelve a bajar (no hay nivel 0) ni se repite el aviso.
  const n = p.nivelCambios.length;
  const { revisarBajadaNivel } = await import('../js/areas/entrenador/indice.js');
  assert.equal(revisarBajadaNivel(), false);
  assert.equal(est.estado().perfil.nivelCambios.length, n);
});
