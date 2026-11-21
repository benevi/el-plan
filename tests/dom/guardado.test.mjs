// Guardado en el navegador (jsdom): datos ilegibles, dos pestañas y cuota llena (t04 y t10 de la auditoría).
// Arreglado en el PR 3 (rescate, revisión entre pestañas y aviso persistente).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const bueno = JSON.stringify(estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } }));
const roto = bueno.slice(0, -20); // datos reales con el JSON cortado
const a = await montar({ ls: { pipos4: roto } });
after(() => a.cerrar());
const ui = await import(modulo('js/nucleo/ui.js')); // el mismo módulo que usa la app

// Vuelve a un estado bueno conocido (para las pruebas que no van de JSON roto).
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  await a.ir('perfil'); await a.ir('hoy');
}

test('con datos ilegibles, pasar la app a segundo plano no los pisa', async () => {
  await a.esperar(() => a.doc.title);
  await a.ocultar(true);
  await a.ocultar(false);
  const ahora = a.w.localStorage.getItem('pipos4');
  const copias = Object.keys(a.w.localStorage).filter(k => a.w.localStorage.getItem(k) === roto);
  assert.ok(ahora === roto || copias.length > 0, `quedan ${ahora.length} bytes y el original no está en ninguna clave`);
});

test('con datos ilegibles se ofrece rescatarlos en vez de la bienvenida', () => {
  assert.notEqual(a.doc.title, 'Bienvenida · Pipos Fitness');
});

test('la pantalla de rescate ofrece cargar copia y empezar de cero, sin pestañas', async () => {
  assert.equal(a.doc.title, 'Rescatar datos · Pipos Fitness');
  assert.ok(a.doc.querySelector('[data-act="perfil.importar"]'), 'falta «Cargar copia»');
  assert.ok(a.doc.querySelector('[data-act="rescate.descartar"]'), 'falta «Empezar de cero»');
  assert.equal(a.doc.querySelector('[data-act="rescate.espejo"]'), null, 'sin espejo no se ofrece recuperarlo');
  assert.ok(a.doc.querySelector('[data-act="rescate.descargarRoto"]'), 'falta «Descargar los datos ilegibles»');
  assert.ok(a.doc.body.classList.contains('sin-nav'));
  await a.ir('perfil');
  assert.equal(a.doc.title, 'Rescatar datos · Pipos Fitness', 'no se puede salir del rescate navegando');
});

test('«Empezar de cero» pide confirmación, lleva a la bienvenida y lo ilegible sigue apartado', async () => {
  a.clic('[data-act="rescate.descartar"]');
  await a.esperar(() => a.doc.querySelector('.hoja [data-r="1"]'), { que: 'la confirmación' });
  assert.equal(a.w.localStorage.getItem('pipos4'), roto, 'antes de confirmar no se escribe');
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => a.doc.title === 'Bienvenida · Pipos Fitness', { que: 'la bienvenida' });
  assert.equal(a.guardado().dueño, null);
  const copias = Object.keys(a.w.localStorage).filter(k => k.startsWith('pipos4-roto-'));
  assert.equal(copias.length, 1);
  assert.equal(a.w.localStorage.getItem(copias[0]), roto);
});

test('sin cambios, pasar a segundo plano o cerrar no escribe nada', async () => {
  await reiniciar(estadoBase());
  const proto = Object.getPrototypeOf(a.w.localStorage);
  const real = proto.setItem;
  let n = 0;
  proto.setItem = function (...r) { n++; return real.apply(this, r); };
  try {
    await a.ocultar(true); await a.ocultar(false);
    a.w.dispatchEvent(new a.w.Event('pagehide'));
    assert.equal(n, 0);
  } finally { proto.setItem = real; }
});

test('si otra pestaña guarda una revisión más nueva (evento storage), esta la carga y repinta', async () => {
  await reiniciar(estadoBase());
  await a.ir('perfil');
  const rev = +a.w.localStorage.getItem('pipos4-rev') || 0;
  a.w.localStorage.setItem('pipos4', JSON.stringify(estadoBase({ perfil: { ...estadoBase().perfil, objetivos: ['fuerza'] } })));
  a.w.localStorage.setItem('pipos4-rev', String(rev + 1));
  a.w.dispatchEvent(new a.w.StorageEvent('storage', { key: 'pipos4-rev', newValue: String(rev + 1) }));
  await a.tic();
  assert.deepEqual(a.estado.estado().perfil.objetivos, ['fuerza']);
  assert.match(a.vista().querySelector('p.tenue').textContent, /^Ganar fuerza ·/);
  // Y lo siguiente que se guarde aquí va por encima.
  a.estado.cambiar(S => { S.perfil.notas = 'después'; }, 'perfil-silencio');
  a.estado.guardarYa();
  assert.equal(a.guardado().perfil.notas, 'después');
  assert.deepEqual(a.guardado().perfil.objetivos, ['fuerza']);
  assert.equal(+a.w.localStorage.getItem('pipos4-rev'), rev + 2);
});

test('una pestaña vieja no pisa lo que guardó otra más nueva', async () => {
  await reiniciar(estadoBase({ sesiones: { s1: sesionDemo() } }));
  // Otra pestaña (o la app instalada, que comparte almacenamiento en Android) termina la sesión y apunta una medida.
  const otra = a.guardado();
  otra.sesiones.s1.estado = 'hecha'; otra.sesiones.s1.terminada = new Date().toISOString();
  otra.medidas.push({ fecha: '2026-11-19', peso: 81 });
  a.w.localStorage.setItem('pipos4', JSON.stringify(otra));
  // Esta pestaña, sin tocar nada, pasa a segundo plano.
  await a.ocultar(true); await a.ocultar(false);
  const g = a.guardado();
  assert.equal(g.sesiones.s1.estado, 'hecha');
  assert.equal(g.medidas.length, 1);
});

test('si el almacenamiento está lleno, la persona ve un aviso persistente', async () => {
  await reiniciar(estadoBase({ sesiones: { s1: sesionDemo() } }));
  const proto = Object.getPrototypeOf(a.w.localStorage);
  const real = proto.setItem;
  proto.setItem = function (k, ...r) {
    if (k === 'pipos4') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
    return real.call(this, k, ...r);
  };
  try {
    await a.ir('sesion/s1');
    a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]');
    await a.esperar(() => a.errores.some(e => /No se pudo guardar/.test(e)), { que: 'el intento de guardado' });
    assert.equal(a.estado.estado().sesiones.s1.ejercicios[0].sets[0].hecha, true, 'en memoria sí se marcó');
    assert.equal(a.guardado().sesiones.s1.ejercicios[0].sets[0].hecha, false, 'en disco no se guardó');
    const aviso = a.doc.querySelector('#aviso');
    assert.ok(aviso && /guardar|espacio|almacen/i.test(aviso.textContent), `aviso: ${aviso ? aviso.textContent : 'ninguno'}`);
    assert.ok(aviso.classList.contains('fijo') && aviso.classList.contains('ver'), 'el aviso no es persistente');
    assert.ok(aviso.querySelector('[data-act="perfil.exportar"]'), 'el aviso ofrece guardar una copia');
  } finally { proto.setItem = real; }
});

test('al volver a poder guardar, el siguiente cambio se guarda y el aviso persistente se quita', async () => {
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]');
  await a.esperar(() => a.guardado().sesiones.s1.ejercicios[0].sets[1].hecha, { que: 'el reintento' });
  assert.equal(a.guardado().sesiones.s1.ejercicios[0].sets[0].hecha, true, 'se guarda también lo que falló antes');
  // El aviso breve «Ya se guarda de nuevo» tapa el fijo unos segundos: hay que mirar si el fijo sigue activo.
  assert.equal(ui.hayAvisoFijo(), false, 'el aviso persistente sigue activo y volvería a salir');
});
