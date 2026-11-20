// Perfil → Copias y «Recuperar de la nube» en el rescate (jsdom, sin red ni IndexedDB): la app arranca igual
// con las copias en la nube sin activar, no llama al servidor por su cuenta y enseña lo necesario.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

let llamadas = 0;
const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'perfil', antes: () => { globalThis.fetch = async () => { llamadas++; throw new Error('sin red'); }; } });
after(() => a.cerrar());

test('Perfil → Copias: sin activar, ofrece activar y avisa de la frase; no llama a la nube', async () => {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="copias"]'); await a.tic();
  const v = a.vista().textContent;
  assert.ok(a.vista().querySelector('[data-act="nube.activar"]'));
  assert.match(v, /Sin la frase, las copias de la nube no se pueden abrir; guárdala en un gestor de contraseñas/);
  assert.ok(a.vista().querySelector('[data-act="nube.recuperar"]'));
  assert.equal(llamadas, 0);
  assert.ok(!a.pantallaRota());
});

test('activar pide la frase dos veces con la advertencia; si no coinciden, no activa', async () => {
  a.clic('[data-act="nube.activar"]'); await a.tic();
  const hoja = a.doc.querySelector('.hoja');
  assert.ok(hoja.querySelector('#n-f1') && hoja.querySelector('#n-f2'));
  assert.match(hoja.textContent, /gestor de contraseñas/);
  hoja.querySelector('#n-f1').value = 'una frase bastante larga';
  hoja.querySelector('#n-f2').value = 'otra frase bastante larga';
  a.clic('[data-act="nube.confirmarActivar"]'); await a.tic();
  assert.match(a.doc.querySelector('#aviso').textContent, /no coinciden/);
  assert.equal(llamadas, 0);
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('en el rescate hay «Recuperar de la nube» y abre la hoja con persona y frase', async () => {
  a.w.localStorage.setItem('pipos4', '{roto');
  a.estado.cargar();
  await a.ir('hoy'); await a.tic();
  assert.match(a.doc.title, /Rescatar/);
  a.clic('[data-act="nube.recuperar"]'); await a.tic();
  const hoja = a.doc.querySelector('.hoja');
  assert.equal(hoja.querySelectorAll('#n-persona button').length, 2);
  assert.ok(hoja.querySelector('#n-frase'));
  assert.ok(hoja.querySelector('#n-codigo'), 'sin código en el móvil, lo pide');
});
