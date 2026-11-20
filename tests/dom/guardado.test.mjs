// Guardado en el navegador (jsdom): datos ilegibles, dos pestañas y cuota llena (t04 y t10 de la auditoría).
// Todo pendiente del PR 3.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const bueno = JSON.stringify(estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha' }) } }));
const roto = bueno.slice(0, -20); // datos reales con el JSON cortado
const a = await montar({ ls: { pipos4: roto } });
after(() => a.cerrar());

// Vuelve a un estado bueno conocido (para las pruebas que no van de JSON roto).
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  await a.ir('perfil'); await a.ir('hoy');
}

test('con datos ilegibles, pasar la app a segundo plano no los pisa', { todo: 'PR 3: JSON ilegible pisado' }, async () => {
  await a.espera(30);
  await a.ocultar(true);
  await a.ocultar(false);
  const ahora = a.w.localStorage.getItem('pipos4');
  const copias = Object.keys(a.w.localStorage).filter(k => a.w.localStorage.getItem(k) === roto);
  assert.ok(ahora === roto || copias.length > 0, `quedan ${ahora.length} bytes y el original no está en ninguna clave`);
});

test('con datos ilegibles se ofrece rescatarlos en vez de la bienvenida', { todo: 'PR 3: pantalla de rescate' }, () => {
  assert.notEqual(a.doc.title, 'Bienvenida · Pipos Fitness');
});

test('una pestaña vieja no pisa lo que guardó otra más nueva', { todo: 'PR 3: dos pestañas (contador de revisión + evento storage)' }, async () => {
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

test('si el almacenamiento está lleno, la persona ve un aviso persistente', { todo: 'PR 3: fallo de guardado silencioso (cuota llena)' }, async () => {
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
    await a.espera(400);
    assert.equal(a.estado.estado().sesiones.s1.ejercicios[0].sets[0].hecha, true, 'en memoria sí se marcó');
    assert.equal(a.guardado().sesiones.s1.ejercicios[0].sets[0].hecha, false, 'en disco no se guardó');
    const aviso = a.doc.querySelector('#aviso');
    assert.ok(aviso && /guardar|espacio|almacen/i.test(aviso.textContent), `aviso: ${aviso ? aviso.textContent : 'ninguno'}`);
  } finally { proto.setItem = real; }
});
