// Entrenador con IA simulada: lo que la app hace con respuestas de la IA buenas, raras o rotas
// (de t1_ia.mjs y t5_plan.mjs de la auditoría). fetch se sustituye; nunca se llama al servidor real.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { nuevoS, ent, est, cat, ponerRed, hecha } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles
let respuesta = null;
let peticiones = [];
beforeEach(() => {
  peticiones = [];
  ponerRed(true, async (url, o) => {
    const cuerpo = JSON.parse(o.body);
    peticiones.push({ url, cuerpo });
    const r = typeof respuesta === 'function' ? respuesta(cuerpo) : respuesta;
    if (r instanceof Error) throw r;
    return { ok: true, status: 200, json: async () => r };
  });
});

const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
const ci0 = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true };
const BASE = { nombre: 'Torso', foco: 'x', cambios: [], explicacion: ['Porque sí.'], calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')], vueltaCalma: [T('Estirar pecho', '1 min'), T('Estiramiento de cuádriceps', '1 min')] };
async function sesionIA(perfil, sesion, ci = ci0, prep) {
  const S = nuevoS(perfil);
  if (prep) prep(S);
  respuesta = { sesion };
  return ent.crearSesionHoy({ ...ci });
}
const esCardio = x => x.rol === 'cardio' && ['cardio', 'natacion'].includes(cat.ex(x.id).m[0]);
const dia = (ds, lugar, ejs, o = {}) => ({ diaSemana: ds, lugar, nombre: 'D' + ds, foco: '', minutos: 60, explicacion: ['x'], calentamiento: [T('a'), T('b')], ejercicios: ejs, vueltaCalma: [T('Estirar'), T('Respirar')], ...o });

// ── Lo que ya funciona ──

test('una respuesta válida de la IA se guarda como sesión de IA', async () => {
  const { sesion, aviso } = await sesionIA({ objetivos: ['musculo'] }, BASE);
  assert.equal(aviso, '');
  assert.equal(sesion.fuente, 'ia');
  assert.deepEqual(sesion.ejercicios.filter(x => x.rol === 'principal').map(x => x.id), ['press-pecho-maquina', 'jalon-pecho', 'prensa-piernas']);
  assert.equal(peticiones.length, 1);
  assert.match(peticiones[0].url, /\/api\/entrenador$/);
});

test('la app completa calentamiento y vuelta si la IA los deja vacíos', async () => {
  const { sesion } = await sesionIA({ objetivos: ['perder'] }, { ...BASE, calentamiento: [], vueltaCalma: [] });
  assert.ok(sesion.calentamiento.length >= 2);
  assert.ok(sesion.vuelta.length >= 2);
});

test('el catálogo enviado no incluye ejercicios rechazados', async () => {
  await sesionIA({ objetivos: ['musculo'], gustos: { 'prensa-piernas': 'rechazo' } }, BASE);
  assert.ok(!peticiones[0].cuerpo.catalogo.some(e => e.id === 'prensa-piernas'));
});

test('si la red falla, la sesión la hace la app y lo dice', async () => {
  nuevoS({ objetivos: ['perder'] });
  respuesta = new TypeError('Failed to fetch');
  const { sesion, aviso } = await ent.crearSesionHoy({ ...ci0 });
  assert.notEqual(sesion.fuente, 'ia');
  assert.equal(aviso, 'Sesión ajustada por la app (sin conexión con el servidor).');
});

test('sin ejercicios válidos de la IA (perfil músculo) la hace la app', async () => {
  const { sesion, aviso } = await sesionIA({ objetivos: ['musculo'] }, { ...BASE, ejercicios: [] });
  assert.equal(sesion.fuente, 'reglas');
  assert.match(aviso, /no propuso ejercicios válidos/);
});

// ── Fallos demostrados por la auditoría ──

test('la sesión de la IA siempre lleva cardio (perfil solo músculo)', { todo: 'PR 8: cardio siempre según D3, también con IA' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'] }, BASE);
  assert.ok(sesion.ejercicios.some(esCardio), sesion.ejercicios.map(x => x.rol + ':' + x.id).join(', '));
});

test('una vuelta a la calma sin estiramientos se completa', { todo: 'PR 8: vuelta sin estiramientos' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['perder'] }, { ...BASE, vueltaCalma: [T('Respiración'), T('Beber agua')] });
  assert.ok(sesion.vuelta.some(t => /estir/i.test(t.nombre)), sesion.vuelta.map(t => t.nombre).join(', '));
});

test('sin ejercicios de la IA no queda una sesión de solo cardio (perfil perder)', { todo: 'PR 8: ≥ 3 ejercicios principales válidos' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['perder'] }, { ...BASE, ejercicios: [] });
  assert.ok(sesion.ejercicios.filter(x => x.rol === 'principal').length >= 3, sesion.ejercicios.map(x => x.rol + ':' + x.id).join(', '));
});

test('ids únicos: la IA no puede repetir como principal la rehabilitación que añade la app', { todo: 'PR 8: ids únicos' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'rodilla', dolor: 3, activa: true }] },
    { ...BASE, ejercicios: [E('sentadilla-isometrica'), E('puente-gluteo'), E('jalon-pecho')] }, { ...ci0, dolorHoy: { rodilla: 3 } });
  const ids = sesion.ejercicios.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
});

test('con dos lesiones hay rehabilitación de cada zona', { todo: 'PR 8: rehabilitación por cada zona activa' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'rodilla', dolor: 3, activa: true }, { id: 'm', zona: 'hombro', dolor: 3, activa: true }] },
    { ...BASE, ejercicios: [E('puente-gluteo', 'rehab'), E('jalon-pecho'), E('curl-femoral-tumbado')] }, { ...ci0, dolorHoy: { rodilla: 3, hombro: 3 } });
  const rehab = sesion.ejercicios.filter(x => x.rol === 'rehab').map(x => x.id);
  for (const z of ['rodilla', 'hombro']) assert.ok(rehab.some(id => cat.ZONAS[z].rehab.includes(id)), `sin rehabilitación de ${z}: ${rehab.join(', ')}`);
});

test('kilos de la IA sin historial: nulos (que elija la persona)', { todo: 'PR 8: kg nulo sin historial' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'] }, { ...BASE, ejercicios: [E('curl-mancuernas', 'principal', { kg: 119 }), E('jalon-pecho'), E('prensa-piernas')] });
  assert.equal(sesion.ejercicios.find(x => x.id === 'curl-mancuernas').kg, null);
});

test('un ejercicio de fuerza no puede venir con rol de cardio', { todo: 'PR 8: cardio con rol válido (jalón como cardio)' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'] }, { ...BASE, ejercicios: [E('press-pecho-maquina'), E('plancha'), E('jalon-pecho', 'cardio')] });
  assert.deepEqual(sesion.ejercicios.filter(x => x.rol === 'cardio' && !['cardio', 'natacion'].includes(cat.ex(x.id).m[0])).map(x => x.id), []);
});

test('series y repeticiones de la IA normalizadas («1:30» no es un rango de repeticiones)', { todo: 'PR 8: repeticiones normalizadas; series ≤ 6' }, async () => {
  const { sesion } = await sesionIA({ objetivos: ['musculo'] }, { ...BASE, ejercicios: [E('press-pecho-maquina'), E('plancha', 'principal', { series: 40, reps: '1:30' }), E('jalon-pecho')] });
  const p = sesion.ejercicios.find(x => x.id === 'plancha');
  assert.ok(p.series <= 6, `series ${p.series}`);
  assert.match(p.reps, /^\d+(-\d+)?\s*(s|min)\b/);
});

test('con dolor ≥ 7 no se llama a la IA (D2)', { todo: 'PR 8: día con dolor ≥ 7 sin IA' }, async () => {
  await sesionIA({ objetivos: ['perder'], lesiones: [{ id: 'l', zona: 'rodilla', dolor: 3, activa: true }] }, BASE, { ...ci0, forzarIA: false, dolorHoy: { rodilla: 8 } });
  assert.equal(peticiones.length, 0);
});

test('respuesta 200 sin «sesion»: mensaje claro, sin el error interno', { todo: 'PR 12: errores crudos' }, async () => {
  nuevoS({ objetivos: ['perder'] });
  respuesta = {};
  const { aviso } = await ent.crearSesionHoy({ ...ci0 });
  assert.doesNotMatch(aviso, /Cannot read|undefined|TypeError/);
});

test('un plan de la IA con días vacíos no se acepta tal cual', { todo: 'PR 8: días vacíos del plan' }, async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  respuesta = { plan: { resumen: '', criterios: '', progresion: '', dias: [dia(3, 'gym', []), dia(4, 'gym', [])] } };
  await ent.crearPlanSemana({ dias: [3, 4], minutos: 60, lugares: ['gym'] });
  assert.deepEqual(est.estado().plan.dias.filter(d => !d.ejercicios.length).map(d => d.diaSemana), []);
});

test('un plan de la IA con ejercicios de otro lugar no deja días vacíos', { todo: 'PR 8: lugar del día que no encaja con sus ejercicios' }, async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym', 'piscina'] });
  respuesta = { plan: { resumen: 'r', criterios: 'c', progresion: 'p', dias: [dia(3, 'piscina', [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')]), dia(4, 'gym', [E('crol'), E('espalda'), E('aquajogging')])] } };
  await ent.crearPlanSemana({ dias: [3, 4], minutos: 60, lugares: ['gym', 'piscina'] });
  assert.deepEqual(est.estado().plan.dias.filter(d => !d.ejercicios.length).map(d => d.diaSemana), []);
});

test('plan nulo de la IA: se hace por reglas con un aviso claro', { todo: 'PR 12: errores crudos' }, async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  respuesta = { plan: null };
  const r = await ent.crearPlanSemana({ dias: [3], minutos: 60, lugares: ['gym'] });
  assert.doesNotMatch(r.aviso, /Cannot read|null|TypeError/);
});

test('el historial enviado a la IA usa los kilos reales', async () => {
  await sesionIA({ objetivos: ['musculo'] }, BASE, ci0, S => hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 10], [40, 10]] }]));
  assert.match(JSON.stringify(peticiones[0].cuerpo.historial), /40/);
});
