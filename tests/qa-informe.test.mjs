// Arreglos del informe de pruebas del 21-11-2026 (docs/qa/informe-2026-11-21.md), lógica sin pantalla:
// E1 textos de la semana de la IA, E6 «c/lado», E10 series del principiante y nota de dosis, E11 nivel al
// cambiar, E13 «Hoy no puedo» el último día, C-DOSIS-4 en el validador, N4 lo que sí se atendió de la
// petición y los campos opcionales nuevos en el normalizador. Las pantallas, en tests/dom/qa-informe.test.mjs.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { nuevoS, ent, est, cat, lesiones, ponerRed, modelo } from './ayuda/node.mjs';
import { modulo } from './ayuda/comun.mjs';

const { normalizarEstado } = await import(modulo('js/nucleo/normalizar.js'));
const ia = await import(modulo('js/areas/entrenador/ia.js'));
const checkin = await import(modulo('js/areas/entrenador/checkin.js'));

fijarFecha('2026-11-21T10:00'); // sábado
let respuesta = null;
beforeEach(() => ponerRed(true, async () => ({ ok: true, status: 200, json: async () => respuesta })));

const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 120, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
const dia = (ds, lugar, ejs, o = {}) => ({ diaSemana: ds, lugar, nombre: 'D' + ds, foco: '', minutos: 60, explicacion: ['x'], calentamiento: [T('a'), T('b')], ejercicios: ejs, vueltaCalma: [T('Estirar pecho'), T('Respirar')], ...o });

// ── E1 ──
test('E1: si la app rehace un día de la IA, el resumen ya no anuncia el día de la IA y dice qué ha puesto', async () => {
  nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: ['gym', 'piscina'] });
  const suave = dia(7, 'piscina', [E('aquajogging', 'cardio', { series: 1, reps: '30 min', descanso: 0 })], { nombre: 'Día suave', explicacion: ['Día suave: cardio cómodo en la piscina.'] });
  respuesta = { plan: {
    resumen: 'Semana corta: el sábado haces tu primer cuerpo completo y el domingo un día suave en la piscina. Cada día se ajusta a tu check-in.',
    criterios: 'Empiezas con cuerpo completo. El domingo, piscina suave para recuperar.', progresion: 'Doble progresión.',
    dias: [dia(6, 'gym', [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')]), suave],
  } };
  await ent.crearPlanSemana({ dias: [6, 7], minutos: 60, lugares: ['gym', 'piscina'] });
  const p = est.estado().plan;
  const d7 = p.dias.find(d => d.diaSemana === 7);
  assert.notEqual(d7.tipo, 'suave', 'el reparto de 2 días no lleva día suave: lo rehace la app');
  assert.doesNotMatch(p.resumen, /suave|piscina/i, p.resumen);
  assert.match(p.resumen, new RegExp(`domingo \\(${d7.nombre}`), p.resumen);
  assert.doesNotMatch(p.criterios, /domingo/i, p.criterios);
  assert.match(p.criterios, /cuerpo completo/, 'lo que no habla del día rehecho se queda');
});

test('E1: sin días rehechos, los textos de la IA se quedan tal cual', () => {
  const p = { resumen: 'El sábado cuerpo completo.', criterios: 'c', progresion: 'p' };
  assert.deepEqual(ia.textosPlanIA(p, [{ diaSemana: 6, nombre: 'A', lugar: 'gym' }], []), { resumen: 'El sábado cuerpo completo.', criterios: 'c', progresion: 'p' });
});

// ── E6 ──
test('E6: un isométrico «c/lado» conserva «c/lado» en fase 1 y en la dosis de los isométricos de fuerza', () => {
  assert.equal(lesiones.dosisRehab(cat.ex('abduccion-isometrica-pared'), 1).reps, '30-45s c/lado');
  assert.equal(lesiones.dosisRehab(cat.ex('extension-rodilla-isometrica'), 1).reps, '30-45s');
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2 });
  assert.match(ent.dosis(S, cat.ex('plancha-lateral'), 3).reps, /c\/lado$/);
  assert.doesNotMatch(ent.dosis(S, cat.ex('plancha'), 3).reps, /lado/);
});

test('E6: la rehabilitación de cadera lateral (B2) lleva la abducción isométrica por lados', () => {
  const S = nuevoS({ objetivos: ['salud'], nivel: 1, lesiones: [{ id: 'l1', zona: 'cadera_lateral', dolor: 4, desde: '2026-01-10', nota: '', activa: true }] });
  const d = ent.montarDia(S, { lugar: 'gym', minutos: 60, tipo: 'fullA', dolorHoy: { cadera_lateral: 4 } });
  const ab = d.ejercicios.find(x => x.id === 'abduccion-isometrica-pared');
  assert.ok(ab, d.ejercicios.map(x => x.id).join(', '));
  assert.equal(ab.reps, '30-45s c/lado');
});

// ── E10 ──
test('E10: un principiante no pasa de las 3 series de C-DOSIS-2 y la nota dice las series reales', () => {
  for (const objetivos of [['musculo'], ['fuerza'], ['salud']]) {
    const S = nuevoS({ objetivos, nivel: 1 });
    const p = ent.planReglas(S, { dias: [6, 7], minutos: 60, lugares: ['gym'] });
    for (const d of p.dias) {
      for (const x of d.ejercicios.filter(y => y.rol === 'principal')) {
        assert.ok(x.series <= 3, `${objetivos}: ${x.id} ${x.series} × ${x.reps}`);
        const m = /Básico del día para [^:]+: (\d+) × (.+?) con (\d+) s/.exec(x.nota || '');
        if (m) assert.deepEqual([+m[1], m[2], +m[3]], [x.series, x.reps, x.descanso], x.nota);
      }
      const linea = d.explicacion.find(t => /el primer básico va a/.test(t));
      const pri = d.ejercicios.find(y => y.rol === 'principal' && cat.ex(y.id).t === 'reps');
      if (linea && pri) assert.match(linea, new RegExp(`va a ${pri.series} × ${pri.reps.replace(/[-]/g, '\\-')} con ${pri.descanso} s`), linea);
    }
  }
});

test('E10: la nota de dosis sigue a las series aunque cambien después (intermedio con relleno de volumen)', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2 });
  const p = ent.planReglas(S, { dias: [6, 7], minutos: 60, lugares: ['gym'] });
  const conNota = p.dias.flatMap(d => d.ejercicios).filter(x => /Básico del día para/.test(x.nota || ''));
  assert.ok(conNota.length);
  for (const x of conNota) assert.match(x.nota, new RegExp(`: ${x.series} × `), `${x.id} ${x.series} series: ${x.nota}`);
});

// ── E11 ──
test('E11: «Cambiar por otro» de un principal respeta el nivel (C-DOSIS-10); sin nivel, como antes (C-MIA-2)', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 1 });
  const e = cat.ex('press-pecho-maquina');
  const conNivel = cat.alternativas(e, 'gym', S.perfil, { nivel: 1 });
  assert.ok(conNivel.length);
  assert.ok(conNivel.every(a => a.niv <= 1), conNivel.map(a => a.id + ':' + a.niv).join(', '));
  assert.ok(cat.alternativas(e, 'gym', S.perfil).some(a => a.niv === 2), 'sin tope (Mis sesiones) siguen los de nivel 2');
});

// ── E13 ──
test('E13: «Hoy no puedo» el último día del plan apunta que hoy no se entrena y Hoy deja de decir «Hoy toca»', async () => {
  const reloj = fijarFecha('2026-11-22T10:00'); // domingo
  try {
    nuevoS({ objetivos: ['salud'], nivel: 1 });
    await ent.crearPlanSemana({ dias: [7], minutos: 60, lugares: ['gym'] }, { conIA: false });
    assert.equal(ent.planDeHoy(est.estado()).diaSemana, 7);
    const nota = ent.noPuedoHoy();
    assert.match(nota, /hoy \(domingo\) no entrenas/);
    const S = est.estado();
    assert.equal(ent.planDeHoy(S), null);
    assert.equal(ent.estadoDias(S)[0].estado, 'noPuedo');
    assert.deepEqual(S.plan.noPuedo, [7]);
    assert.equal(S.plan.cambios.slice(-1)[0].texto, nota);
    // También desde «Reorganizar» sin ningún día marcado.
    est.cambiar(S2 => { delete S2.plan.noPuedo; }, 'plan');
    assert.match(ent.reorganizar([], { quitarHoy: true }), /no entrenas/);
    assert.deepEqual(est.estado().plan.noPuedo, [7]);
  } finally { reloj.restaurar(); fijarFecha('2026-11-21T10:00'); }
});

// ── C-DOSIS-4 en el validador ──
test('C-DOSIS-4: lo que la IA manda con riesgo 1 en una zona a 1-3 sube a ≥ 10 repeticiones (12 en aislamiento) con 3 de margen', () => {
  const S = nuevoS({ objetivos: ['fuerza'], nivel: 2, lesiones: [{ id: 'l1', zona: 'hombro', dolor: 2, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }] });
  const s = { nombre: 'x', explicacion: ['x'], calentamiento: [T('Bici'), T('Movilidad')], vuelta: [T('Estiramiento de pecho', '1 min'), T('Respirar', '1 min')],
    ejercicios: [E('prensa-piernas', 'principal', { reps: '6-8' }), E('press-pecho-maquina', 'principal', { reps: '6-8', nota: 'Press pesado.' }), E('aperturas-maquina', 'principal', { reps: '8-10' }), E('bici-estatica', 'cardio', { series: 1, reps: '15 min', descanso: 0 })] };
  const ctx = { lugar: 'gym', minutos: 60, dolorHoy: { hombro: 2 }, origen: 'ia' };
  assert.ok(ent.problemasSesion(S, s, ctx).some(t => /press-pecho-maquina: con precaución/.test(t)), 'el problema se detecta');
  const v = ent.validarSesion(S, s, ctx);
  const press = v.sesion.ejercicios.find(x => x.id === 'press-pecho-maquina');
  const ap = v.sesion.ejercicios.find(x => x.id === 'aperturas-maquina');
  const prensa = v.sesion.ejercicios.find(x => x.id === 'prensa-piernas');
  assert.ok(press && ap, v.sesion.ejercicios.map(x => x.id).join(', '));
  assert.ok(modelo && cat, 'módulos');
  const lo = x => +x.reps.split('-')[0];
  assert.ok(lo(press) >= 10, press.reps);
  assert.ok(lo(ap) >= 12, ap.reps);
  assert.equal(prensa.reps, '6-8', 'sin riesgo en el hombro no cambia');
  assert.match(press.nota, /3 repeticiones de margen/);
  assert.match(press.nota, /hombro \(2\/10\)/);
  assert.match(press.nota, /si pasa de 4\/10/);
  assert.deepEqual(ent.problemasSesion(S, v.sesion, ctx).filter(t => /precaución/.test(t)), []);
});

// ── N4 ──
test('N4: lo que las reglas entienden de la petición se dice aparte; una petición que solo pide pierna no queda «sin atender»', async () => {
  assert.deepEqual(checkin.leerPeticion('Hoy quiero centrarme en pierna y glúteo, la prensa está ocupada'), { tipo: 'pierna', atendido: 'hoy pierna y glúteo', completa: false });
  assert.equal(checkin.leerPeticion('hoy solo pierna').completa, true);
  assert.equal(checkin.leerPeticion('hoy sin máquinas de pierna').tipo, null, 'lo negado no es una petición de pierna');
  ponerRed(false);
  nuevoS({ objetivos: ['salud'], usoIA: 'ahorro' });
  const ci = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: 'Hoy quiero centrarme en pierna y glúteo, la prensa está ocupada' };
  const r = await ent.crearSesionHoy(ci);
  assert.equal(r.sesion.iaFallo.atendido, 'hoy pierna y glúteo');
  assert.equal(r.sesion.iaFallo.peticion, ci.peticion);
  nuevoS({ objetivos: ['salud'], usoIA: 'ahorro' });
  const r2 = await ent.crearSesionHoy({ ...ci, peticion: 'hoy solo pierna' });
  assert.ok(!r2.sesion.iaFallo || !r2.sesion.iaFallo.peticion, JSON.stringify(r2.sesion.iaFallo));
});

// ── Campos opcionales nuevos ──
test('el normalizador conserva los campos opcionales nuevos (dolorDurante, parada, iaFallo.atendido, plan.noPuedo) y descarta los malos', () => {
  const S = nuevoS();
  const s = modelo.crearSesion({ nombre: 'x', lugar: 'gym', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 3, reps: '8-12' }, { id: 'jalon-pecho', rol: 'principal', series: 3, reps: '8-12' }], iaFallo: { motivo: 'm', peticion: 'p', atendido: 'hoy torso' } });
  s.ejercicios[0].dolorDurante = { zona: 'hombro', dolor: 6, antes: 2, techo: 5 };
  s.ejercicios[1].dolorDurante = { zona: 'nariz', dolor: 6 };
  s.parada = 'alarma'; s.estado = 'hecha';
  const datos = { ...JSON.parse(JSON.stringify(S)), sesiones: { [s.id]: s }, plan: { semana: modelo.semanaISO(), creado: new Date().toISOString(), fuente: 'reglas', resumen: '', criterios: '', progresion: '', dias: [], hechos: {}, noPuedo: [7, 7, 9, 'x'] } };
  const n = normalizarEstado(datos).estado;
  const ns = n.sesiones[s.id];
  assert.deepEqual(ns.ejercicios[0].dolorDurante, { zona: 'hombro', dolor: 6, antes: 2, techo: 5 });
  assert.equal(ns.ejercicios[1].dolorDurante, undefined);
  assert.equal(ns.parada, 'alarma');
  assert.equal(ns.iaFallo.atendido, 'hoy torso');
  assert.deepEqual(n.plan.noPuedo, [7]);
});

test('E9: «Algo va mal» con señal de alarma para la sesión: lo hecho se guarda como parada y hoy queda sin entrenar', () => {
  const S = nuevoS();
  const s = modelo.crearSesion({ nombre: 'x', lugar: 'gym', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 2, reps: '8-12' }] });
  s.ejercicios[0].sets[0].hecha = true; s.estado = 'en_curso';
  const vacia = modelo.crearSesion({ nombre: 'y', lugar: 'gym', ejercicios: [{ id: 'jalon-pecho', rol: 'principal', series: 2, reps: '8-12' }] });
  est.cambiar(S2 => { S2.sesiones[s.id] = s; S2.sesiones[vacia.id] = vacia; }, 'sesion');
  ent.pararPorAlarma(s.id);
  ent.pararPorAlarma(vacia.id);
  const S1 = est.estado();
  assert.equal(S1.sesiones[s.id].estado, 'hecha');
  assert.equal(S1.sesiones[s.id].parada, 'alarma');
  assert.equal(S1.sesiones[vacia.id], undefined, 'sin ninguna serie no queda');
  assert.ok(ent.sinEntrenarHoy(S1));
  assert.ok(S);
  // T3 tal cual, con el techo.
  assert.equal(ent.T3(5), 'Para el ejercicio. Si notas dolor en el pecho, mareo, sudor frío, falta de aire fuera de lo normal, hormigueo o pérdida de fuerza, termina la sesión aquí y consulta (112 si es en el pecho o no cede). Si es solo el dolor de tu lesión y pasa de 5/10, salta este ejercicio y sigue con el siguiente.');
});

test('C-DOLOR-6: límite del dolor durante: +2 sobre el de antes y nunca por encima del techo', () => {
  const S = nuevoS({ lesiones: [{ id: 'l1', zona: 'hombro', dolor: 2, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }, { id: 'l2', zona: 'rodilla', dolor: 2, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }] });
  assert.deepEqual(ent.limiteDolor(S, 'hombro', 2), { techo: 5, limite: 4 });
  assert.deepEqual(ent.limiteDolor(S, 'hombro', 4), { techo: 5, limite: 5 });
  assert.deepEqual(ent.limiteDolor(S, 'rodilla', 2), { techo: 3, limite: 3 });
  assert.deepEqual(ent.limiteDolor(S, 'codo', 0), { techo: 3, limite: 2 }, 'dolor sin lesión: techo 3');
});

// ── Revisión del PR #38 y decisiones de Víctor del 21-11-2026 ──
const { zona } = await import(modulo('js/nucleo/normalizar.js'));
const contexto = await import(modulo('js/reglas/contexto.js'));

test('D-A: una sesión parada por alarma va al historial de la IA con «parada» y sus ejercicios parados por dolor', () => {
  const S = nuevoS();
  const s = modelo.crearSesion({ nombre: 'x', lugar: 'gym', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 2, reps: '8-12' }, { id: 'jalon-pecho', rol: 'principal', series: 2, reps: '8-12' }] });
  s.ejercicios[0].sets[0].hecha = true;
  s.ejercicios[1].dolorDurante = { zona: 'hombro', dolor: 6, antes: 2, techo: 5 };
  Object.assign(s, { estado: 'hecha', terminada: new Date().toISOString(), parada: 'alarma', cierre: { esfuerzo: null, dolor: {}, comentario: '' } });
  est.cambiar(S2 => { S2.sesiones[s.id] = s; }, 'sesion');
  const h = contexto.historialParaIA(est.estado(), ['press-pecho-maquina']).sesionesUltimos14dias[0];
  assert.match(h.parada, /alarma/);
  assert.match(h.dolorDurante[0], /Jalón.*hombro 6\/10.*parado/);
  assert.ok(S);
});

test('E7/E9: cuenta como trabajo hecho una serie, una tarea marcada o un «dolor durante» (día de dolor alto sin ejercicios)', () => {
  const base = () => modelo.crearSesion({ nombre: 'x', lugar: 'gym', calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], ejercicios: [], vuelta: [{ nombre: 'Estirar', duracion: '5 min' }] });
  const s = base();
  assert.equal(modelo.trabajoHecho(s), false);
  s.calentamiento[0].hecho = true;
  assert.equal(modelo.trabajoHecho(s), true);
  const d = modelo.crearSesion({ nombre: 'y', lugar: 'gym', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 2, reps: '8-12' }] });
  d.ejercicios[0].dolorDurante = { zona: 'hombro', dolor: 6, antes: 2, techo: 5 };
  assert.equal(modelo.trabajoHecho(d), true);
  // «Termino la sesión aquí» no borra lo que tiene tareas o un «dolor durante».
  for (const x of [s, d]) {
    nuevoS();
    est.cambiar(S2 => { S2.sesiones[x.id] = x; }, 'sesion');
    ent.pararPorAlarma(x.id);
    assert.equal(est.estado().sesiones[x.id].parada, 'alarma', x.nombre);
  }
  assert.ok(est.estado().sesiones[d.id].ejercicios[0].dolorDurante);
});

test('C-DOSIS-4: la nota «con precaución» se reescribe con el dolor de hoy y en la rehabilitación cambia el margen sin otra frase', () => {
  const S = nuevoS({ objetivos: ['fuerza'], nivel: 2, lesiones: [{ id: 'l1', zona: 'hombro', dolor: 3, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }] });
  const vieja = 'Implica a tu hombro (3/10): carga moderada, bajada de 3 s y 3 de margen; si pasa de 5/10, salta al siguiente. Pecho y tríceps.';
  const s = { nombre: 'x', explicacion: ['x'], calentamiento: [T('Bici'), T('Movilidad')], vuelta: [T('Estiramiento de pecho', '1 min'), T('Respirar', '1 min')],
    ejercicios: [E('prensa-piernas'), E('press-pecho-maquina', 'principal', { reps: '10-12', nota: vieja }), E('remo-sentado-polea'), E('bici-estatica', 'cardio', { series: 1, reps: '15 min', descanso: 0 })] };
  const ctx = { lugar: 'gym', minutos: 60, dolorHoy: { hombro: 1 }, origen: 'plan' };
  let v = ent.validarSesion(S, s, ctx);
  v = ent.validarSesion(S, v.sesion, ctx); // dos veces: no se acumula
  const press = v.sesion.ejercicios.find(x => x.id === 'press-pecho-maquina');
  assert.doesNotMatch(press.nota, /\(3\/10\)|5\/10|Implica/, press.nota);
  assert.equal((press.nota.match(/Con precaución/g) || []).length, 1, press.nota);
  assert.match(press.nota, /tu hombro \(1\/10\).*si pasa de 3\/10/);
  assert.match(press.nota, /Pecho y tríceps/);
  // Rehabilitación de fase 3 con r=1 (B0): su nota dice 3 repeticiones de margen, sin otra frase.
  const notaRehab = 'Para tu hombro: fuerza progresiva, con 2 repeticiones de margen y el movimiento controlado. Mañana debe estar como hoy antes de empezar.';
  const S0 = nuevoS({ objetivos: ['fuerza'], nivel: 2, lesiones: [{ id: 'l1', zona: 'hombro', dolor: 0, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }] });
  const r = ent.validarSesion(S0, { ...s, ejercicios: [E('prensa-piernas'), E('press-pecho-maquina', 'rehab', { reps: '10-12', nota: notaRehab }), E('remo-sentado-polea'), E('jalon-pecho'), E('bici-estatica', 'cardio', { series: 1, reps: '15 min', descanso: 0 })] }, { ...ctx, dolorHoy: {} });
  const rh = r.sesion.ejercicios.find(x => x.id === 'press-pecho-maquina');
  assert.equal(rh && rh.rol, 'rehab', JSON.stringify(r.sesion.ejercicios.map(x => x.id + ':' + x.rol)));
  {
    assert.match(rh.nota, /con 3 repeticiones de margen, bajada de 3 s/);
    assert.doesNotMatch(rh.nota, /2 repeticiones de margen|Con precaución por/);
  }
});

test('C-DOSIS-7: en la rehabilitación, si empieza por encima del techo, quedarse como empezó no para el ejercicio', () => {
  const S = nuevoS({ lesiones: [{ id: 'l1', zona: 'rodilla', dolor: 4, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }] });
  assert.deepEqual(ent.limiteDolor(S, 'rodilla', 4, { rehab: true }), { techo: 3, limite: 4 });
  assert.deepEqual(ent.limiteDolor(S, 'rodilla', 4), { techo: 3, limite: 3 }, 'fuera de la rehabilitación manda el techo');
});

test('E1: una frase que habla de un día rehecho y de otro que se mantiene conserva la parte del que se mantiene', () => {
  const p = { resumen: 'Semana corta: el sábado haces tu primer cuerpo completo y el domingo un día suave en la piscina', criterios: '', progresion: '' };
  const dias = [{ diaSemana: 6, nombre: 'Cuerpo completo A', lugar: 'gym' }, { diaSemana: 7, nombre: 'Cuerpo completo B', lugar: 'gym' }];
  const t = ia.textosPlanIA(p, dias, [dias[1]]);
  assert.match(t.resumen, /^Semana corta: el sábado haces tu primer cuerpo completo\. La app ha preparado el domingo \(Cuerpo completo B, gimnasio\)/, t.resumen);
});

test('normalizador: zona «__proto__» no vale y plan.noPuedo solo con enteros 1-7', () => {
  assert.equal(zona('__proto__'), null);
  assert.equal(zona('constructor'), null);
  assert.equal(zona('cadera'), 'cadera_lateral');
  const S = nuevoS();
  const datos = { ...JSON.parse(JSON.stringify(S)), plan: { semana: modelo.semanaISO(), creado: new Date().toISOString(), fuente: 'reglas', resumen: '', criterios: '', progresion: '', dias: [], hechos: {}, noPuedo: ['x', 0, 8, 2.5, '3', 9, 9, 9, 9, 9, 9, 9, 6, 1] } };
  assert.deepEqual(normalizarEstado(datos).estado.plan.noPuedo, [1, 6]);
});
