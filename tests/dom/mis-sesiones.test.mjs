// «Mis sesiones» en pantalla (jsdom): el check-in con una mía elegida (interruptor del día del plan apagado por
// defecto, volver a «La de mi plan», mía borrada mientras tanto), «Volver a ajustarla» y Perfil con datos raros.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, semanaRef } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const hoyDS = new Date().getDay() || 7;
const MIA = { id: 'm1', nombre: 'Abdos', lugar: 'casa', minutos: 30, creada: '2026-11-01T10:00:00.000Z', ejercicios: [
  { id: 'flexiones-rodillas', rol: 'principal', series: 3, reps: '8-12', descanso: 60 },
  { id: 'dead-bug', rol: 'principal', series: 3, reps: '10 c/lado', descanso: 45 },
] };
const P = (id) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, nota: '' });
const T = n => ({ nombre: n, detalle: '', duracion: '3 min' });
function base(extra = {}) {
  const b = estadoBase(extra);
  b.perfil.objetivos = ['salud']; b.perfil.lugares = ['gym', 'casa'];
  b.plan = { semana: semanaRef(new Date()), creado: new Date().toISOString(), fuente: 'reglas', resumen: '', criterios: '', progresion: '', hechos: {},
    dias: [{ diaSemana: hoyDS, nombre: 'Torso', foco: '', lugar: 'gym', minutos: 60, tipo: 'fullA', explicacion: [], calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [P('press-pecho-maquina'), P('jalon-pecho'), P('prensa-piernas')], vuelta: [T('Estirar pecho'), T('Respirar')] }] };
  b.misSesiones = [MIA];
  return b;
}
const a = await montar({ ls: { pipos4: base() }, hash: 'hoy' });
after(() => a.cerrar());
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
const abrir = async () => {
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; a.doc.querySelector('#vista').append(b);
  a.clic(b); await a.esperar(() => a.doc.querySelector('.hoja.checkin'));
};
const pulsada = () => a.doc.querySelector('[data-act="entrenador.ciMia"][aria-pressed="true"]').dataset.v;
const lugarOn = () => a.doc.querySelector('[data-act="entrenador.ci"][data-k="lugar"].on').dataset.v;
const minOn = () => a.doc.querySelector('[data-act="entrenador.ci"][data-k="minutos"].on').dataset.v;
const crear = async () => {
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => Object.values(a.estado.estado().sesiones).length > 0);
};

test('una mía no ocupa el día del plan salvo que se marque «Cuenta como el día…»', async () => {
  await reiniciar(base());
  await abrir();
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  const c = a.doc.querySelector('[data-cambio="entrenador.ciOcupar"]');
  assert.ok(c, 'sin interruptor');
  assert.equal(c.checked, false);
  assert.match(c.parentNode.textContent, /Cuenta como el día «Torso» del plan/);
  await crear();
  const S = a.estado.estado(), s = Object.values(S.sesiones)[0];
  assert.deepEqual(s.origen, { tipo: 'mia', id: 'm1' });
  assert.deepEqual(S.plan.hechos, {});

  await reiniciar(base());
  await abrir();
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  const c2 = a.doc.querySelector('[data-cambio="entrenador.ciOcupar"]');
  c2.checked = true; c2.dispatchEvent(new a.w.Event('change', { bubbles: true })); await a.tic();
  assert.match(a.doc.querySelector('.hoja').textContent, /que cuenta como el día «Torso» de tu plan/);
  await crear();
  const S2 = a.estado.estado();
  assert.equal(S2.plan.hechos[hoyDS], Object.values(S2.sesiones)[0].id);
});

test('volver a «La de mi plan» deja el lugar, los minutos y la petición de antes', async () => {
  await reiniciar(base());
  await abrir();
  assert.equal(lugarOn(), 'gym'); assert.equal(minOn(), '60');
  const pet = a.doc.querySelector('#ci-peticion');
  pet.value = 'hoy la prensa está ocupada'; pet.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  assert.equal(lugarOn(), 'casa'); assert.equal(minOn(), '30');
  assert.equal(a.doc.querySelector('#ci-peticion'), null);
  a.clic('[data-act="entrenador.ciMia"][data-v=""]'); await a.tic();
  assert.equal(pulsada(), '');
  assert.equal(lugarOn(), 'gym'); assert.equal(minOn(), '60');
  assert.equal(a.doc.querySelector('#ci-peticion').value, 'hoy la prensa está ocupada');
});

test('si la mía elegida se borra mientras tanto, el check-in vuelve a la del plan', async () => {
  await reiniciar(base());
  await abrir();
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  a.estado.cambiar(S => { S.misSesiones = []; }, 'misSesiones-silencio');
  a.clic('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await a.tic();
  assert.equal(a.doc.querySelector('[data-act="entrenador.ciMia"]'), null);
  assert.equal(lugarOn(), 'gym');
  assert.match(a.doc.querySelector('[data-act="entrenador.crearHoy"]').textContent, /Preparar mi sesión/);
});

test('«Volver a ajustarla» una sesión hecha desde una mía la trae elegida', async () => {
  await reiniciar(base());
  await abrir();
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  await crear();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('hoy');
  assert.match(a.doc.querySelector('#vista').textContent, /tu sesión, ajustada por la app/);
  a.clic('[data-act="entrenador.prepararHoy"]'); await a.esperar(() => a.doc.querySelector('.hoja.checkin'));
  assert.equal(pulsada(), 'm1');
  assert.equal(a.doc.querySelector('[data-cambio="entrenador.ciOcupar"]').checked, false);
});

test('una mía sin ningún ejercicio del catálogo no crea sesión y lo dice', async () => {
  const b = base();
  a.w.localStorage.setItem('pipos4', JSON.stringify(b));
  a.estado.cargar();
  a.estado.cambiar(S => { S.misSesiones = [{ ...MIA, ejercicios: [{ id: 'no-existe', rol: 'principal', series: 3, reps: '10', descanso: 60 }] }]; }, 'misSesiones');
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('hoy');
  await abrir();
  a.clic('[data-act="entrenador.ciMia"][data-v="m1"]'); await a.tic();
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => /ningún ejercicio que exista/.test((a.doc.querySelector('#aviso') || {}).textContent || ''));
  assert.equal(Object.keys(a.estado.estado().sesiones).length, 0);
});

test('Perfil › Mi entreno no revienta con entradas raras en misSesiones', async () => {
  await reiniciar(base());
  a.estado.cambiar(S => { S.misSesiones = [null, { id: 'x', nombre: 5 }, { id: 'y', nombre: 'Sin lista', ejercicios: 'no' }, MIA]; }, 'misSesiones');
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="entreno"]'); await a.tic();
  const t = a.doc.querySelector('.mis-sesiones').textContent;
  assert.match(t, /Abdos/);
  assert.match(t, /1 de 30/);
  assert.equal(a.pantallaRota(), false);
});
