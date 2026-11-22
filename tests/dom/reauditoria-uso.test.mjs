// Re-auditoría del PR 18 (enfoque uso), hallazgos bajos que se ven en jsdom:
// - U5: la primera vez, tras elegir persona se va a Hoy, cuya tarjeta dice qué hacer («Cuéntale a tu entrenador
//   quién eres» → Completar mi perfil), no a Perfil sin ninguna indicación.
// - U6: «Algo va mal» sin lesiones activas no habla de «tu lesión» en su apartado (el texto T3 es fijo: § 2.5).
// - U7: el foco del día es una lista de músculos y va en minúscula tras el primero («Pecho, cuádriceps…»).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({});
after(() => a.cerrar());

test('U5: la primera vez, al elegir persona se va a Hoy con la tarjeta que lleva a completar el perfil', async () => {
  await a.esperar(() => a.doc.querySelector('[data-act="bienvenida.elegir"][data-v="virginia"]'));
  a.clic('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await a.esperar(() => a.w.location.hash === '#hoy', { que: 'ir a Hoy' });
  await a.esperar(() => /Cuéntale a tu entrenador quién eres/.test(a.vista().textContent), { que: 'la tarjeta de la primera vez' });
  assert.ok(a.doc.querySelector('#vista a[href="#perfil"]'), 'falta el enlace «Completar mi perfil»');
});

let avmTexto = '';
async function algoVaMal(lesiones) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(estadoBase({ sesiones: { s1: sesionDemo() }, perfil: { ...estadoBase().perfil, lesiones } })));
  a.estado.cargar();
  await a.ir('hoy'); await a.ir('sesion/s1');
  a.clic('[data-act="sesion.algoVaMal"]');
  const h3 = await a.esperar(() => a.doc.querySelector('.hoja .hoja-sub'), { que: 'la hoja «Algo va mal»' });
  const texto = h3.textContent;
  avmTexto = a.doc.querySelector('.hoja .hoja-texto').textContent;
  a.clic('.hoja [data-cerrar-hoja]'); await a.tic();
  return texto;
}

test('U6: «Algo va mal» sin lesiones dice «Si te duele una zona…»; con una lesión activa, «Si es solo el dolor de tu lesión»', async () => {
  assert.equal(await algoVaMal([]), 'Si te duele una zona al hacer un ejercicio');
  assert.equal(await algoVaMal([{ id: 'l1', tipo: 'pasada', zona: 'hombro', dolor: 0, desde: '2025-01-01', nota: '', activa: false }]), 'Si te duele una zona al hacer un ejercicio');
  assert.match(avmTexto, /Si es un dolor en una zona concreta \(un músculo o una articulación\) y pasa de \d+\/10/, 'sin lesiones, T3b');
  assert.doesNotMatch(avmTexto, /tu lesión/);
  assert.equal(await algoVaMal([{ id: 'l1', tipo: 'recurrente', zona: 'hombro', dolor: 3, desde: '2025-01-01', nota: '', activa: true }]), 'Si es solo el dolor de tu lesión');
  assert.match(avmTexto, /Si es solo el dolor de tu lesión y pasa de \d+\/10/, 'con lesión, T3 tal cual');
});

test('T3b es el texto de docs/criterio.md § 2.5 (pendiente de que Víctor lo apruebe)', async () => {
  const fs = await import('node:fs');
  const { ruta } = await import('../ayuda/comun.mjs');
  const { T3b } = await import(modulo('js/areas/entrenador/alarma.js'));
  const doc = fs.readFileSync(ruta('docs/criterio.md'), 'utf8');
  assert.ok(doc.includes('> ' + T3b('[techo]')), 'T3b no coincide con criterio.md');
});

test('U5: con lesiones traídas de la app anterior (dolor estimado), Hoy pide revisarlas y lleva a Perfil › Lesiones', async () => {
  const b = estadoBase();
  b.perfil.lesiones = [{ id: 'l1', tipo: 'recurrente', zona: 'lumbar', dolor: 6, desde: '2025-01-01', nota: '', activa: true, dolorRevisar: true }];
  a.w.localStorage.setItem('pipos4', JSON.stringify(b));
  a.estado.cargar();
  await a.ir('progreso'); await a.ir('hoy');
  const aviso = await a.esperar(() => a.doc.querySelector('#vista .revisar-lesiones'), { que: 'el aviso de las lesiones traídas' });
  assert.match(aviso.textContent, /Revisa el dolor de tus lesiones traídas/);
  a.clic('#vista [data-act="perfil.irLesiones"]');
  await a.esperar(() => a.w.location.hash === '#perfil' && /estimado: revísalo/.test(a.vista().textContent), { que: 'Perfil › Lesiones' });
  // Revisada (sin dolorRevisar), el aviso se va
  b.perfil.lesiones[0].dolorRevisar = undefined;
  a.w.localStorage.setItem('pipos4', JSON.stringify(b));
  a.estado.cargar();
  await a.ir('hoy');
  assert.equal(a.doc.querySelector('#vista .revisar-lesiones'), null);
});

test('U7: el foco del día va en minúscula tras el primer músculo (también en planes ya guardados); el de la IA no cambia', async () => {
  const { focoTexto } = await import(modulo('js/areas/entrenador/indice.js'));
  assert.equal(focoTexto('Pecho, Cuádriceps, Espalda, Isquios'), 'Pecho, cuádriceps, espalda, isquios');
  assert.equal(focoTexto('Cardio suave, core y movilidad'), 'Cardio suave, core y movilidad');
  assert.equal(focoTexto('Empuje: Pecho y hombro'), 'Empuje: Pecho y hombro');
  assert.equal(focoTexto(''), '');
});
