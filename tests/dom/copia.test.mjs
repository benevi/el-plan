// Perfil → Ajustes: uso del almacenamiento y última copia; recordatorio de copia cada 10 sesiones (PR 3).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const sesiones = {};
for (let i = 0; i < 10; i++) sesiones['s' + i] = sesionDemo('s' + i, { estado: 'hecha', fecha: `2026-11-${String(i + 1).padStart(2, '0')}`, terminada: `2026-11-${String(i + 1).padStart(2, '0')}T19:00:00.000Z` });
const a = await montar({ ls: { pipos4: estadoBase({ sesiones }) }, hash: 'hoy' });
after(() => a.cerrar());

async function ajustes() {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="ajustes"]');
  await a.tic();
}

test('sin navigator.storage (jsdom no lo tiene) la app arranca igual', () => {
  assert.equal(a.w.navigator.storage, undefined);
  assert.ok(a.doc.querySelector('#nav a'));
  assert.deepEqual(a.errores, []);
});

test('Perfil → Ajustes muestra lo que ocupan los datos y que aún no hay copia', async () => {
  await ajustes();
  assert.match(a.doc.querySelector('.uso-almacen').textContent, /ocupan [\d,.]+ (B|KB|MB), (menos del 1 %|\d+ %) de unos 5 MB/);
  assert.match(a.doc.querySelector('.ultima-copia').textContent, /Aún no has guardado ninguna copia/);
});

test('con 10 sesiones terminadas sin copia, Hoy y Perfil lo recuerdan', async () => {
  assert.ok(a.doc.querySelector('.recordatorio-copia'), 'Perfil sin recordatorio');
  await a.ir('hoy');
  const r = a.doc.querySelector('.recordatorio-copia');
  assert.ok(r, 'Hoy sin recordatorio');
  assert.match(r.textContent, /10 sesiones/);
  assert.ok(r.querySelector('[data-act="perfil.exportar"]'));
});

test('al guardar una copia se apunta la fecha y el recordatorio desaparece', async () => {
  a.clic('.recordatorio-copia [data-act="perfil.exportar"]');
  await a.tic();
  assert.ok(JSON.parse(a.w.localStorage.getItem('pipos4-copia')).fecha);
  assert.equal(a.doc.querySelector('.recordatorio-copia'), null);
  await ajustes();
  assert.match(a.doc.querySelector('.ultima-copia').textContent, /Última copia guardada: /);
  assert.equal(a.guardado().copia, undefined, 'pipos4 no cambia de forma');
});
