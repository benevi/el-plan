// Check-in y Perfil › Salud (jsdom), PR 8: casilla de alarma siempre visible (C-ALAR-3), T2 al marcarla
// (C-ALAR-1), «¿desde cuándo?» antes de generar (C-LES-6) y la sección Salud con T1 (D4, C-SALUD-0).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const conLesion = desde => { const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'hombro', dolor: 9, desde, nota: '', activa: true }); return b; };
const a = await montar({ ls: { pipos4: conLesion('2026-01-01') }, hash: 'hoy' });
after(() => a.cerrar());
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
// Abre el check-in como lo hace el botón de Hoy (sin plan esta semana, Hoy enseña «Montar mi semana»).
const abrir = async () => {
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; a.doc.querySelector('#vista').append(b);
  a.clic(b); await a.esperar(() => a.doc.querySelector('.hoja'));
};

test('C-ALAR-3, C-DOLOR-0: la casilla de alarma está siempre en el check-in y la ficha a 9 entra como 6', async () => {
  await reiniciar(conLesion('2026-01-01'));
  await abrir();
  assert.ok(a.doc.querySelector('[data-cambio="entrenador.ciAlarma"]'), 'sin casilla de alarma');
  assert.match(a.doc.querySelector('.hoja').textContent, /Hoy noto alguna de estas señales/);
  assert.equal(a.doc.querySelector('input[type=range][data-z="hombro"]').value, '6');
});

test('C-ALAR-1: marcar la casilla y seguir enseña T2 y no crea sesión', async () => {
  await reiniciar(conLesion('2026-01-01'));
  await abrir();
  const c = a.doc.querySelector('[data-cambio="entrenador.ciAlarma"]');
  c.checked = true; c.dispatchEvent(new a.w.Event('change', { bubbles: true })); await a.tic();
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => /Hoy no toca entrenar/.test((a.doc.querySelector('.hoja') || {}).textContent || ''));
  assert.equal(Object.keys(a.estado.estado().sesiones).length, 0);
  assert.match(a.doc.querySelector('.hoja').textContent, /llama al 112/);
});

test('C-LES-6: con una lesión sin «desde», el check-in pregunta antes de nada', async () => {
  await reiniciar(conLesion(''));
  await abrir();
  assert.match(a.doc.querySelector('.hoja').textContent, /¿Desde cuándo te duele tu hombro\?/);
  a.clic('[data-act="entrenador.ciDesde"][data-v="mas3m"]');
  await a.esperar(() => a.doc.querySelector('[data-act="entrenador.crearHoy"]'));
});

test('D4: Perfil › Salud enseña T1 y guarda una casilla', async () => {
  await reiniciar(estadoBase());
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="salud"]'); await a.tic();
  assert.match(a.doc.querySelector('main, #app, body').textContent, /No diagnostica ni sustituye a tu médico/);
  const c = a.doc.querySelector('[data-cambio="perfil.salud"][data-k="asma"]');
  c.checked = true; c.dispatchEvent(new a.w.Event('change', { bubbles: true })); await a.tic();
  assert.equal(a.estado.estado().perfil.salud.asma, true);
});

test('una zona añadida por error en el check-in se puede quitar; la de una lesión activa no lleva «Quitar»', async () => {
  await reiniciar(conLesion('2026-01-01'));
  await abrir();
  assert.equal(a.doc.querySelector('[data-act="entrenador.ciQuitarZona"][data-v="hombro"]'), null, 'la lesión activa no se quita desde aquí');
  a.clic('[data-act="entrenador.ciZona"][data-v="rodilla"]');
  await a.esperar(() => a.doc.querySelector('input[type=range][data-z="rodilla"]'));
  a.clic('[data-act="entrenador.ciQuitarZona"][data-v="rodilla"]');
  await a.esperar(() => !a.doc.querySelector('input[type=range][data-z="rodilla"]'));
  assert.ok(a.doc.querySelector('[data-act="entrenador.ciZona"][data-v="rodilla"]'), 'vuelve a la lista de «¿Te duele algo más?»');
});

test('C-ALAR-3: la lista corta de señales se ve sin desplegar nada', async () => {
  await reiniciar(conLesion('2026-01-01'));
  await abrir();
  const corta = a.doc.querySelector('.alarma-ci .señales-cortas');
  assert.ok(corta && corta.closest('details') === null, 'la lista corta no debe ir plegada');
  assert.match(corta.textContent, /pecho/);
});

test('C-ALAR-1: el aviso de precaución no usa el estilo de la alarma del descanso y «La marqué por error» lo quita', async () => {
  const b = conLesion('2026-01-01');
  b.alarmas = [{ fecha: a.estado.hoyISO(), respuesta: 'si', frase: '' }];
  await reiniciar(b);
  await abrir();
  const hoja = a.doc.querySelector('.hoja');
  assert.match(hoja.textContent, /Hoy no toca entrenar/);
  assert.ok(hoja.classList.contains('precaucion'));
  assert.equal(a.doc.querySelector('.hoja.alarma, .tarjeta.alarma'), null, '.alarma es la pantalla de fin de descanso');
  a.clic('[data-act="entrenador.deshacerAlarma"]');
  await a.esperar(() => [...a.doc.querySelectorAll('.hoja button')].some(x => /No noto ninguna/.test(x.textContent)));
  a.clic([...a.doc.querySelectorAll('.hoja button')].find(x => /No noto ninguna/.test(x.textContent)));
  await a.esperar(() => !(a.estado.estado().alarmas || []).some(x => x.respuesta === 'si'));
});
