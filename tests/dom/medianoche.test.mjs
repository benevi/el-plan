// Hoy alrededor de medianoche con una sesión en curso (t13 de la auditoría). PR 13 y PR 14.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, fijarFecha } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const reloj = fijarFecha('2026-11-19T23:40:00'); // jueves 23:40
const s = sesionDemo('s1', { fecha: '2026-11-19', estado: 'en_curso', empezada: new Date().toISOString() });
s.ejercicios[0].sets[0].hecha = true; s.ejercicios[0].sets[0].valor = '10';
const a = await montar({ ls: { pipos4: estadoBase({ sesiones: { s1: s } }) }, hash: 'hoy' });
after(() => { reloj.restaurar(); a.cerrar(); });
const fecha = () => (a.doc.querySelector('.saludo p') || {}).textContent || '';

test('a las 23:40 Hoy muestra la sesión en marcha', async () => {
  await a.esperar(() => fecha());
  assert.match(fecha(), /jueves, 19 de noviembre/);
  assert.ok(a.doc.querySelector('a[href="#sesion/s1"]'));
});

test('al volver a la app pasada la medianoche, Hoy se repinta con el día nuevo', async () => {
  reloj.avanzar(30 * 60 * 1000); // 00:10
  await a.ocultar(false);
  assert.match(fecha(), /viernes, 20 de noviembre/);
});

test('pasada la medianoche, Hoy sigue enseñando la sesión sin cerrar', { todo: 'PR 14: sesión sin cerrar tras medianoche' }, async () => {
  await a.ir('progreso'); await a.ir('hoy');
  assert.ok(a.doc.querySelector('a[href="#sesion/s1"]'), 'no hay enlace a la sesión en curso');
});
