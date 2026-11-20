// Arranque real de la app en jsdom (index.html + js/main.js): las pantallas principales se pintan sin fallos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase({ sesiones: { s1: sesionDemo() } }) }, hash: 'sesion/s1' });
after(() => a.cerrar());

test('abre una sesión guardada con sus series', async () => {
  await a.esperar(() => a.doc.querySelector('h1') && a.doc.querySelector('h1').textContent === 'Demo');
  assert.equal(a.doc.title, 'Sesión · Pipos Fitness');
  assert.equal(a.doc.querySelector('h1').textContent, 'Demo');
  assert.ok(a.doc.querySelectorAll('[data-act="sesion.serie"]').length >= 3);
});

test('las cuatro pestañas se pintan sin «Algo ha fallado»', async () => {
  await a.ir('hoy');
  const pestañas = [...a.doc.querySelectorAll('#nav a')].map(x => x.getAttribute('href').slice(1));
  assert.deepEqual(pestañas, ['hoy', 'progreso', 'ejercicios', 'perfil']);
  for (const p of pestañas) {
    await a.ir(p);
    assert.ok(!a.pantallaRota(), `${p}: ${a.vista().textContent.slice(0, 80)}`);
    assert.ok(a.vista().textContent.trim().length > 20, `${p} vacía`);
  }
});

test('los grupos del perfil se abren sin fallos', async () => {
  await a.ir('perfil');
  for (const g of ['objetivos', 'lesiones', 'entreno', 'datos', 'ajustes']) {
    a.clic(`[data-act="perfil.grupo"][data-v="${g}"]`);
    await a.tic();
    assert.ok(!a.pantallaRota(), g);
  }
});

test('marcar una serie la guarda como hecha y arranca el descanso', async () => {
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]');
  await a.esperar(() => a.doc.querySelector('#temporizador'));
  await a.esperar(() => a.guardado().sesiones.s1.ejercicios[0].sets[0].hecha, { que: 'el guardado diferido' });
  assert.equal(a.estado.estado().sesiones.s1.ejercicios[0].sets[0].hecha, true);
  assert.ok(a.doc.querySelector('#temporizador'));
  assert.equal(a.guardado().sesiones.s1.ejercicios[0].sets[0].hecha, true);
});

test('rutas desconocidas o sin parámetros caen en una pantalla con salida', async () => {
  for (const h of ['sesion/', 'sesion/noexiste', 'ejercicio/noexiste', 'progreso/x/y']) {
    await a.ir(h);
    assert.ok(!a.pantallaRota(), h);
    assert.ok(a.vista().textContent.trim().length > 0, h);
  }
});

test('sin errores en consola durante el recorrido', () => {
  assert.deepEqual(a.errores, []);
});
