// Hojas inferiores accesibles y navegación (PR 13, R10, R23, E8 del informe del 21-11-2026): entran en el
// historial y el botón atrás las cierra sin cambiar la pantalla de debajo, Escape, ✕, fondo inert,
// aria-labelledby, foco al título (sin teclado), cierre al cambiar de ruta, y foco al <h1> al navegar.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase({ sesiones: { s1: sesionDemo() } }) }, hash: 'hoy' });
after(() => a.cerrar());
const ui = await import(modulo('js/nucleo/ui.js'));
const router = await import(modulo('js/nucleo/router.js'));
const hoja = () => a.doc.querySelector('.hoja');
const atras = async () => { a.w.history.back(); await a.espera(60); await a.tic(); };
const tecla = key => a.doc.dispatchEvent(new a.w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

test('al abrir: título con nombre del diálogo, foco en el título, ✕ y el resto de la página inert', async () => {
  await a.ir('progreso');
  const panel = ui.abrirHoja('<h2>Medidas de hoy</h2><label>Peso <input id="x-peso"></label>');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  const t = a.doc.getElementById(panel.getAttribute('aria-labelledby'));
  assert.equal(t && t.textContent, 'Medidas de hoy');
  assert.equal(a.doc.activeElement, t, 'el foco va al título, no al campo (no sale el teclado)');
  assert.ok(panel.querySelector('[data-cerrar-hoja][aria-label="Cerrar"]'), 'sin botón ✕');
  assert.ok(a.doc.querySelector('#vista').hasAttribute('inert'));
  assert.ok(a.doc.querySelector('#nav').hasAttribute('inert'));
  a.clic('[data-cerrar-hoja]'); await a.espera(60);
  assert.equal(hoja(), null);
  assert.ok(!a.doc.querySelector('#vista').hasAttribute('inert'), 'el fondo sigue inert tras cerrar');
});

test('con { foco: "campo" } el foco va al primer campo', async () => {
  ui.abrirHoja('<h2>Nombre</h2><input id="x-nombre">', { foco: 'campo' });
  assert.equal(a.doc.activeElement.id, 'x-nombre');
  ui.cerrarHoja(); await a.espera(60);
});

test('E8: el botón atrás cierra la hoja y no cambia la pantalla de debajo', async () => {
  await a.ir('progreso');
  ui.abrirHoja('<h2>Una hoja</h2><p>Hola</p>');
  await a.tic();
  assert.ok(a.w.history.state && a.w.history.state.piposHoja, 'la hoja no está en el historial');
  await atras();
  assert.equal(hoja(), null, 'la hoja sigue abierta tras «atrás»');
  assert.equal(a.w.location.hash, '#progreso');
  assert.ok(!a.doc.body.classList.contains('con-hoja'));
  // Y el siguiente «atrás» ya cambia de pantalla
  await a.ir('ejercicios');
  await atras();
  assert.equal(a.w.location.hash, '#progreso');
});

test('cerrar con ✕ quita también su entrada del historial (atrás no se queda «muerto»)', async () => {
  await a.ir('perfil'); await a.ir('ejercicios');
  ui.abrirHoja('<h2>Otra</h2>');
  await a.tic();
  a.clic('[data-cerrar-hoja]'); await a.espera(60);
  assert.ok(!(a.w.history.state && a.w.history.state.piposHoja));
  await atras();
  assert.equal(a.w.location.hash, '#perfil');
});

test('Escape cierra; una hoja fija (espera de la IA) con «atrás» pulsa su botón [data-atras]', async () => {
  ui.abrirHoja('<h2>Con Escape</h2>');
  tecla('Escape'); await a.espera(60);
  assert.equal(hoja(), null);
  let cancelada = 0;
  router.acciones({ 'prueba.cancelar': () => { cancelada++; ui.cerrarHoja(); } });
  ui.abrirHoja('<h2>Esperando</h2><button class="btn" data-act="prueba.cancelar" data-atras>Cancelar</button>', { fija: true });
  await a.tic();
  assert.equal(hoja().querySelector('[data-cerrar-hoja]'), null, 'una hoja fija no lleva ✕');
  await atras();
  assert.equal(cancelada, 1, 'atrás no canceló la espera');
  assert.equal(hoja(), null);
});

test('confirmar() responde «no» si la hoja se cierra con atrás', async () => {
  const r = ui.confirmar('¿Seguro?');
  await a.tic();
  assert.match(hoja().getAttribute('aria-labelledby'), /hoja-t-/);
  await atras();
  assert.equal(await r, false);
});

test('cerrar y navegar a la vez: se llega a la pantalla nueva sin hoja y sin entrada colgando', async () => {
  await a.ir('hoy');
  ui.abrirHoja('<h2>Antes de ir</h2>');
  await a.tic();
  router.ir('progreso');
  await a.esperar(() => a.w.location.hash === '#progreso');
  await a.tic();
  assert.equal(hoja(), null);
  await atras();
  assert.equal(a.w.location.hash, '#hoy', 'atrás tras navegar desde una hoja no vuelve a la pantalla anterior');
});

test('al cambiar de pantalla, la hoja se cierra y el foco va al título de la nueva', async () => {
  await a.ir('hoy');
  ui.abrirHoja('<h2>Hoja de Hoy</h2>');
  await a.ir('ejercicios');
  assert.equal(hoja(), null, 'la hoja se quedó encima de otra pantalla');
  const h1 = a.doc.querySelector('#vista h1');
  assert.equal(a.doc.activeElement, h1, 'el foco no está en el h1 de la pantalla nueva');
  assert.equal(h1.getAttribute('tabindex'), '-1');
});

test('las pestañas son enlaces con aria-current en la activa', async () => {
  await a.ir('progreso');
  const activas = [...a.doc.querySelectorAll('#nav a[aria-current="page"]')].map(x => x.getAttribute('href'));
  assert.deepEqual(activas, ['#progreso']);
  assert.equal(a.doc.querySelectorAll('#nav a.pestana').length, 4);
});

test('avisos: icono + texto; los errores no se van solos y se cierran con su ✕', async () => {
  ui.aviso('Guardado');
  const el = a.doc.querySelector('#aviso');
  assert.equal(el.getAttribute('role'), 'status');
  assert.ok(el.querySelector('svg.icono'));
  ui.aviso('No se pudo', 'error');
  assert.equal(el.getAttribute('role'), 'alert');
  await a.espera(3500);
  assert.match(el.textContent, /No se pudo/, 'el error se fue solo');
  a.clic('[data-cerrar-aviso]');
  assert.ok(el.hidden);
});

test('ocupado(): el botón dice qué hace y lleva aria-busy; al terminar vuelve a ser el de antes', () => {
  const b = a.doc.createElement('button'); b.textContent = 'Guardar';
  const listo = ui.ocupado(b);
  assert.equal(b.getAttribute('aria-busy'), 'true');
  assert.match(b.textContent, /Guardando…/);
  listo();
  assert.equal(b.textContent, 'Guardar');
  assert.ok(!b.hasAttribute('aria-busy'));
});
