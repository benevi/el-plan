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
  // Una sola palabra (o repeticiones) se rechaza aunque sea larga.
  hoja.querySelector('#n-f1').value = hoja.querySelector('#n-f2').value = 'electroencefalografista';
  a.clic('[data-act="nube.confirmarActivar"]'); await a.tic();
  assert.match(a.doc.querySelector('#aviso').textContent, /sola palabra/);
  assert.equal(llamadas, 0);
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('activar propone una frase de 6 palabras; «Generar otra» la cambia y «Usar esta» la pone en los dos campos', async () => {
  a.clic('[data-act="nube.activar"]'); await a.tic();
  const gen = () => a.doc.querySelector('#n-gen').textContent;
  const p1 = gen();
  assert.equal(p1.split(' ').length, 6);
  a.clic('[data-act="nube.generar"]'); await a.tic();
  assert.notEqual(gen(), p1);
  a.clic('[data-act="nube.usarGenerada"]'); await a.tic();
  assert.equal(a.doc.querySelector('#n-f1').value, gen());
  assert.equal(a.doc.querySelector('#n-f2').value, gen());
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

test('«Empezar de cero» en el rescate deja las copias en la nube en pausa (pipos4-nube)', async () => {
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  a.clic('[data-act="rescate.descartar"]'); await a.tic();
  a.clic('.hoja [data-r="1"]'); await a.tic(); await a.tic();
  assert.equal(JSON.parse(a.w.localStorage.getItem('pipos4-nube')).pausada, true);
});
