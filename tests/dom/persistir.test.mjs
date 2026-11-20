// navigator.storage.persist() al arrancar (PR 3): se pide si el navegador lo tiene y no se pide dos veces.
// Que no rompa sin navigator.storage lo cubren las demás pruebas de pantalla (jsdom no lo tiene).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const llamadas = [];
const a = await montar({
  ls: { pipos4: estadoBase() }, hash: 'hoy',
  antes: w => {
    Object.defineProperty(w.navigator, 'storage', {
      configurable: true,
      value: { persisted: async () => { llamadas.push('persisted'); return false; }, persist: async () => { llamadas.push('persist'); return true; } },
    });
  },
});
after(() => a.cerrar());

test('al arrancar se pide almacenamiento persistente si aún no lo es', async () => {
  await a.esperar(() => llamadas.includes('persist'), { que: 'la llamada a persist()' });
  assert.deepEqual(llamadas, ['persisted', 'persist']);
  assert.ok(a.doc.querySelector('#nav a'), 'la app arrancó');
});
