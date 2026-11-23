// Check-in de un toque (M21 del informe del 21-11; decisión de Víctor del 23-11-2026, docs/criterio.md C-CHECK-1):
// antes de entrenar, un paso mínimo con la casilla de alarma siempre a la vista (C-ALAR-3), «Todo bien, empezar»
// y «Algo ha cambiado», que abre el check-in completo. Con una ficha a 7 o más (C-DOLOR-0), el completo directo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const conLesion = (dolor, extra = {}) => { const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true, ...extra }); return b; };
const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
after(() => a.cerrar());
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
const abrir = async () => {
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; a.doc.querySelector('#vista').append(b);
  a.clic(b); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.crearHoy"]'));
};
const hoja = () => a.doc.querySelector('.hoja.checkin');
const sesiones = () => Object.values(a.estado.estado().sesiones);

test('M21: el paso de un toque enseña qué se hará, la casilla de alarma y dos botones; sin energía, tiempo ni lugar', async () => {
  await reiniciar(conLesion(3));
  await abrir();
  assert.ok(hoja().classList.contains('checkin-toque'));
  assert.ok(a.doc.querySelector('[data-cambio="entrenador.ciAlarma"]'), 'C-ALAR-3: la casilla siempre a la vista');
  assert.match(hoja().textContent, /Hoy noto alguna de estas señales/);
  assert.match(hoja().textContent, /Con tu dolor de siempre: rodilla 3\/10\./);
  assert.match(hoja().textContent, /unos \d+ min/);
  assert.equal(a.doc.querySelector('[data-act="entrenador.crearHoy"]').textContent, 'Todo bien, empezar');
  assert.ok(a.doc.querySelector('[data-act="entrenador.ciCompleto"]'));
  assert.equal(a.doc.querySelector('[data-act="entrenador.ci"]'), null, 'sin las preguntas del completo');
  assert.equal(a.doc.querySelector('.selector--dolor'), null);
});

test('M21: «Todo bien, empezar» prepara la sesión con lo que ya hay (energía normal, el dolor de la ficha y los minutos del perfil)', async () => {
  await reiniciar(conLesion(3));
  await abrir();
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => sesiones().length > 0);
  const s = sesiones()[0];
  assert.equal(s.checkin.energia, 3);
  assert.deepEqual(s.checkin.dolor, { rodilla: 3 });
  assert.equal(s.minutos, a.estado.estado().perfil.disponibilidad.minutos);
});

test('M21: «Algo ha cambiado» abre el check-in completo (energía, dolor por zona, tiempo, lugar y petición), con la casilla de alarma', async () => {
  await reiniciar(conLesion(3));
  await abrir();
  a.clic('[data-act="entrenador.ciCompleto"]');
  await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.ci"]'));
  assert.ok(!hoja().classList.contains('checkin-toque'));
  for (const k of ['lugar', 'minutos', 'energia']) assert.ok(a.doc.querySelector(`[data-act="entrenador.ci"][data-k="${k}"]`), k);
  assert.ok(a.doc.querySelector('input[type=range][data-z="rodilla"]'));
  assert.ok(a.doc.querySelector('#ci-peticion'));
  assert.ok(a.doc.querySelector('[data-cambio="entrenador.ciAlarma"]'));
  assert.equal(a.doc.querySelector('[data-act="entrenador.crearHoy"]').textContent, 'Preparar mi sesión');
  // Y lo que se cambia ahí, cuenta.
  a.clic('[data-act="entrenador.ci"][data-k="energia"][data-v="2"]'); await a.tic();
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => sesiones().length > 0);
  assert.equal(sesiones()[0].checkin.energia, 2);
});

test('M21, C-ALAR-1: marcar la casilla en el paso de un toque cambia el botón a «Hoy no entreno» y no crea sesión', async () => {
  await reiniciar(estadoBase());
  await abrir();
  const c = a.doc.querySelector('[data-cambio="entrenador.ciAlarma"]');
  c.checked = true; c.dispatchEvent(new a.w.Event('change', { bubbles: true })); await a.tic();
  assert.equal(a.doc.querySelector('[data-act="entrenador.crearHoy"]').textContent, 'Hoy no entreno');
  assert.equal(a.doc.querySelector('[data-act="entrenador.ciCompleto"]'), null);
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => /Hoy no toca entrenar/.test((a.doc.querySelector('.hoja') || {}).textContent || ''));
  assert.equal(sesiones().length, 0);
});

test('M21, C-DOLOR-0: con una ficha a 7 o más o un dolor por revisar, el check-in completo va directo', async () => {
  for (const extra of [{ dolor: 8 }, { dolor: 4, dolorRevisar: true }]) {
    await reiniciar(conLesion(extra.dolor, extra));
    await abrir();
    assert.ok(!hoja().classList.contains('checkin-toque'), JSON.stringify(extra));
    assert.ok(a.doc.querySelector('input[type=range][data-z="rodilla"]'));
  }
});
