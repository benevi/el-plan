// Cargar copia (jsdom): una copia con forma mala o con código malicioso (t05 y seg/t2 de la auditoría). PR 4.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const inicial = () => estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha', terminada: new Date().toISOString() }) } });
const a = await montar({ ls: { pipos4: inicial() }, hash: 'hoy' });
after(() => a.cerrar());

async function reiniciar() {
  a.w.localStorage.setItem('pipos4', JSON.stringify(inicial()));
  a.estado.cargar();
  await a.ir('perfil'); await a.ir('hoy');
}
async function pantallas() {
  const r = {};
  for (const p of ['hoy', 'progreso', 'perfil', 'ejercicios']) { await a.ir(p); r[p] = a.pantallaRota() ? 'ROTA' : 'ok'; }
  return r;
}

test('importar una copia buena cambia los datos y todas las pantallas se pintan', async () => {
  await reiniciar();
  // Es de la otra persona: sin confirmarlo no se carga; confirmado, sí.
  assert.throws(() => a.estado.importar(JSON.stringify(estadoBase({ dueño: 'virginia' }))), e => e.codigo === 'otra-persona');
  assert.equal(a.estado.estado().dueño, 'victor');
  a.estado.importar(JSON.stringify(estadoBase({ dueño: 'virginia' })), { otraPersona: true });
  assert.equal(a.estado.estado().dueño, 'virginia');
  assert.deepEqual(await pantallas(), { hoy: 'ok', progreso: 'ok', perfil: 'ok', ejercicios: 'ok' });
});

test('una copia con forma mala no rompe pantallas ni pisa lo guardado', async () => {
  await reiniciar();
  let lanzo = false;
  try { a.estado.importar(JSON.stringify({ version: 4, perfil: { lesiones: null, objetivos: 'musculo', disponibilidad: null }, dueño: 'victor' })); } catch { lanzo = true; }
  if (lanzo) assert.ok(a.guardado().sesiones.s1, 'pisó los datos aunque rechazó la copia');
  assert.deepEqual(await pantallas(), { hoy: 'ok', progreso: 'ok', perfil: 'ok', ejercicios: 'ok' });
});

test('tras una copia mala sigue a mano el botón «Cargar copia»', async () => {
  await reiniciar();
  try { a.estado.importar(JSON.stringify({ version: 4, perfil: {}, sesiones: null })); } catch { /* rechazada: vale */ }
  await a.ir('perfil');
  const aj = a.doc.querySelector('[data-act="perfil.grupo"][data-v="copias"]');
  if (aj) { a.clic(aj); await a.tic(); }
  assert.ok(a.doc.querySelector('[data-act="perfil.importar"]'));
});

test('una copia con HTML en sus datos no inyecta nada en las pantallas', async () => {
  await reiniciar();
  const P = '<img src=x onerror=alert(1)>';
  const hoy = a.estado.hoyISO();
  const copia = {
    version: 4, dueño: 'victor',
    perfil: { objetivos: ['musculo'], nivel: 1, lesiones: [{ id: 'a', zona: 'rodilla', dolor: P, activa: true }], disponibilidad: { dias: P, minutos: 60, diasSemana: [] }, lugares: ['gym'], gustos: {} },
    ajustes: { codigo: '', apiUrl: '' }, dolor: [{ fecha: hoy, zona: 'rodilla', dolor: P, momento: 'despues' }],
    sesiones: { s1: { id: 's1"><img src=x onerror=alert(2)>', fecha: hoy, creada: hoy, fuente: 'ia', nombre: 'T', foco: '', lugar: 'gym', explicacion: [], calentamiento: [], vuelta: [], estado: 'hecha', terminada: hoy, cierre: { esfuerzo: P },
      ejercicios: [{ id: 'x', nombre: 'n', rol: 'principal', series: P, reps: '8', descanso: P, kg: null, nota: '', sets: [{ kg: null, valor: '8', hecha: true }] }] } },
  };
  a.estado.importar(JSON.stringify(copia)); // se acepta, normalizada (números, ids y zonas saneados)
  assert.ok(a.estado.estado().sesiones.s1, 'la sesión entra con su clave buena');
  const inyectados = [];
  for (const [ruta, grupo] of [['hoy'], ['progreso'], ['sesion/s1'], ['perfil', 'lesiones'], ['perfil', 'entreno']]) {
    await a.ir(ruta);
    if (grupo) { a.clic(`[data-act="perfil.grupo"][data-v="${grupo}"]`); await a.tic(); }
    const n = a.doc.querySelectorAll('img[onerror]').length;
    if (n) inyectados.push(`${ruta}${grupo ? '/' + grupo : ''}: ${n}`);
  }
  assert.deepEqual(inyectados, []);
});

test('aunque algo saltara el normalizador, las plantillas escapan ids y números del estado', async () => {
  await reiniciar();
  const P = '"><img src=x onerror=alert(9)>';
  const hoy = a.estado.hoyISO();
  a.estado.cambiar(S => {
    S.perfil.lesiones.push({ id: P, zona: 'rodilla', dolor: P, activa: true, desde: '', nota: '' });
    S.perfil.disponibilidad.dias = P;
    S.dolor.push({ fecha: hoy, zona: 'rodilla', dolor: P, momento: 'despues' });
    const s = S.sesiones.s1;
    s.id = P; s.fecha = hoy; s.cierre = { esfuerzo: P, comentario: '' };
    s.ejercicios[0].series = P; s.ejercicios[0].descanso = P; s.ejercicios[0].rol = P;
  }, 'prueba');
  const inyectados = [];
  for (const [ruta, grupo] of [['hoy'], ['progreso'], ['sesion/s1'], ['perfil', 'lesiones'], ['perfil', 'entreno']]) {
    await a.ir(ruta);
    if (grupo) { a.clic(`[data-act="perfil.grupo"][data-v="${grupo}"]`); await a.tic(); }
    const n = a.doc.querySelectorAll('img[onerror*="alert"]').length;
    if (n) inyectados.push(`${ruta}${grupo ? '/' + grupo : ''}: ${n}`);
  }
  assert.deepEqual(inyectados, []);
});
