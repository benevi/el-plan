// Guardar al salir: con un cambio aún sin guardar (guardado diferido de 250 ms), pasar la app a segundo
// plano (visibilitychange con document.hidden) o cerrarla (pagehide) lo escribe al momento en pipos4.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
after(() => a.cerrar());

test('visibilitychange a oculta guarda el cambio pendiente en pipos4', async () => {
  await a.esperar(() => a.doc.querySelector('#nav a'));
  a.estado.cambiar(S => { S.perfil.notas = 'antes de cambiar de app'; }, 'perfil-silencio');
  assert.equal(a.guardado().perfil.notas, '', 'aún no se había guardado');
  await a.ocultar(true);
  assert.equal(a.guardado().perfil.notas, 'antes de cambiar de app');
  await a.ocultar(false);
});

test('pagehide guarda el cambio pendiente en pipos4', async () => {
  a.estado.cambiar(S => { S.perfil.notas = 'antes de cerrar'; }, 'perfil-silencio');
  assert.equal(a.guardado().perfil.notas, 'antes de cambiar de app', 'aún no se había guardado');
  a.w.dispatchEvent(new a.w.Event('pagehide'));
  assert.equal(a.guardado().perfil.notas, 'antes de cerrar');
});

test('volver a primer plano no escribe nada por sí solo', async () => {
  const antes = a.w.localStorage.getItem('pipos4');
  await a.ocultar(false);
  assert.equal(a.w.localStorage.getItem('pipos4'), antes);
});
