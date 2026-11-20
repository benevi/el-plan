// Reglas del PR 8 según docs/criterio.md (cada prueba cita su id) y casos de referencia de la sección 19
// (columna NUNCA, que es comprobación automática). Fecha fija: miércoles 18-nov-2026.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, est, modelo, ponerRed, hecha } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
const CRONICA = '2026-01-01';
const L = (zona, dolor, o = {}) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: CRONICA, ...o });
const ci = (o = {}) => ({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', ...o });
const sesionReglas = (perfil, c) => { const S = nuevoS(perfil); return { S, s: modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci(c)).datos), c: ci(c) }; };
const ids = s => [...s.ejercicios.map(x => x.id), ...s.calentamiento.map(t => t.id), ...s.vuelta.map(t => t.id)].filter(Boolean);
const nunca = (s, lista) => ids(s).filter(id => lista.includes(id));
const cardioMin = s => s.ejercicios.filter(x => x.rol === 'cardio').reduce((t, x) => t + (parseFloat(x.reps) || 0), 0);
const prin = s => s.ejercicios.filter(x => x.rol === 'principal');
const sinProblemas = (S, s, c) => assert.deepEqual(ent.problemasSesion(S, s, c), []);

// Red simulada para el camino de IA.
let respuesta = null, peticiones = 0;
beforeEach(() => { peticiones = 0; ponerRed(true, async () => { peticiones++; return { ok: true, status: 200, json: async () => ({ sesion: structuredClone(respuesta) }) }; }); });
const T = (n, d = '2 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota de la IA con datos: 3 series de 10 a 40 kg.', ...o });

// ── Señales de alarma (sección 2) ──

test('C-ALAR-4: vectores de palabras de alarma, negaciones y nombres de ejercicio', () => {
  const si = ['me mareé al acabar la cinta', 'un poco de hormigueo en la mano', 'dolor en el pecho al subir la escalera', 'Tuve fiebre ayer', 'me faltaba el aire', 'no pude apoyar el pie'];
  const no = ['sin mareos hoy', 'press de pecho muy pesado', 'no he notado hormigueo', 'nada de náuseas', 'estiramiento de pecho genial', 'aperturas de pecho sin problema', 'todo bien'];
  for (const t of si) assert.ok(ent.fraseAlarma(t), `debería disparar: ${t}`);
  for (const t of no) assert.equal(ent.fraseAlarma(t), null, `no debería disparar: ${t}`);
});

test('C-ALAR-1, CR-18: con la casilla de alarma no hay sesión ni IA; queda T2 y el día sin entrenar', async () => {
  nuevoS({ objetivos: ['musculo'] });
  respuesta = { nombre: 'x', ejercicios: [E('press-pecho-maquina')] };
  const r = await ent.crearSesionHoy(ci({ alarma: true, forzarIA: true }));
  assert.equal(r.sesion, null);
  assert.deepEqual(r.alarma, ent.T2);
  assert.equal(peticiones, 0);
  assert.equal(Object.keys(est.estado().sesiones).length, 0);
  assert.equal(ent.sinEntrenarHoy(est.estado()), true);
});

test('C-ALAR-4, CR-21: «me mareé al acabar la cinta» bloquea hasta contestar; con «no», sesión normal', async () => {
  const S = nuevoS({ objetivos: ['musculo'] });
  hecha(S, 2, [{ id: 'jalon-pecho', sets: [[40, 10]] }], { cierre: { esfuerzo: 3, dolor: {}, comentario: 'me mareé al acabar la cinta' } });
  respuesta = { nombre: 'x', ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')] };
  const r = await ent.crearSesionHoy(ci({ forzarIA: true }));
  assert.equal(r.sesion, null);
  assert.equal(r.pregunta.tipo, 'alarma');
  assert.equal(r.pregunta.texto, 'En tu comentario dices «me mareé al acabar la cinta». ¿Notas algo de esto hoy?');
  assert.equal(peticiones, 0, 'ni IA ni reglas antes de contestar');
  const r2 = await ent.crearSesionHoy(ci({ forzarIA: true, alarmaRespuesta: 'no', alarmaFrase: r.pregunta.frase }));
  assert.ok(r2.sesion);
  assert.equal(peticiones, 1);
  // Ya respondida, no se vuelve a preguntar.
  assert.equal(ent.preguntaAntes(est.estado(), ci()), null);
});

test('CR-21b: «press de pecho muy pesado, sin mareos» no pregunta nada', () => {
  const S = nuevoS({ objetivos: ['musculo'] });
  hecha(S, 2, [{ id: 'press-pecho-maquina', sets: [[40, 10]], comentario: 'press de pecho muy pesado, sin mareos' }]);
  assert.equal(ent.preguntaAntes(S, ci()), null);
});

test('C-ALAR-4: la palabra de alarma en la petición del check-in también bloquea; responder «sí» es alarma', async () => {
  nuevoS({ objetivos: ['perder'] });
  const r = await ent.crearSesionHoy(ci({ peticion: 'hoy suave, tengo algo de fiebre' }));
  assert.equal(r.sesion, null);
  const r2 = await ent.crearSesionHoy(ci({ peticion: 'hoy suave, tengo algo de fiebre', alarmaRespuesta: 'si', alarmaFrase: r.pregunta.frase }));
  assert.equal(r2.sesion, null);
  assert.deepEqual(r2.alarma, ent.T2);
});

test('C-ALAR-2, C-DOLOR-5: tres check-ins seguidos a 7 o más en la misma zona dan el aviso T4', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [L('rodilla', 3)] });
  for (const dias of [4, 2]) { const id = hecha(S, dias, [{ id: 'jalon-pecho', sets: [[40, 10]] }]); S.sesiones[id].checkin = { energia: 3, dolor: { rodilla: 8 } }; }
  const r = ent.ajustarAlCheckin(S, null, ci({ dolorHoy: { rodilla: 8 } }));
  assert.ok(r.cambios.some(c => /^Tu rodilla lleva tres días a 8\/10 o más\. La app seguirá adaptando/.test(c)), r.cambios.join(' | '));
  const S2 = nuevoS({ objetivos: ['musculo'], lesiones: [L('rodilla', 3, { desde: '2026-11-10' })] });
  assert.ok(ent.ajustarAlCheckin(S2, null, ci({ dolorHoy: { rodilla: 7 } })).cambios.some(c => /lesión reciente/.test(c)), 'lesión nueva: T4 desde el primer día');
});

// ── Lesión sin «desde» y dolor de ficha (C-LES-6, C-DOLOR-0) ──

test('C-LES-6, CR-28: lesión sin «desde» pregunta antes de generar; «no lo sé» la guarda como nueva', async () => {
  nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'h', zona: 'hombro', dolor: 2, activa: true }] });
  respuesta = { nombre: 'x', ejercicios: [E('press-pecho-maquina')] };
  const r = await ent.crearSesionHoy(ci({ forzarIA: true }));
  assert.equal(r.sesion, null);
  assert.equal(r.pregunta.tipo, 'desde');
  assert.deepEqual(r.pregunta.zonas, ['hombro']);
  assert.equal(peticiones, 0);
  const r2 = await ent.crearSesionHoy(ci({ desde: { hombro: 'nose' } }));
  assert.ok(r2.sesion);
  const l = est.estado().perfil.lesiones[0];
  assert.equal(l.desde, '2026-11-18');
  assert.ok(ent.bandasHoy(est.estado(), { hombro: 2 }).hombro.nueva);
});

test('C-DOLOR-0, CR-27: una ficha a 9 sin dolor de hoy no lleva al día de dolor alto; la zona va como B2', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [L('rodilla', 9, { dolorRevisar: true })] });
  const r = ent.ajustarAlCheckin(S, null, ci());
  assert.notEqual(r.datos.nombre, 'Sesión suave');
  assert.equal(ent.bandasHoy(S, {}).rodilla.banda, 2);
  assert.deepEqual(r.datos.ejercicios.filter(x => (cat.ex(x.id).r || {}).rodilla).map(x => x.id), []);
  // El plan semanal también la trata como B2 (tope 6).
  assert.equal(ent.bandasHoy(S, { rodilla: 9 }, { plan: true }).rodilla.banda, 2);
});

test('C-LES-2: lesión nueva con dolor 2-3 se trata como B2 (nada con r en la zona)', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [L('hombro', 2, { desde: '2026-11-01' })] });
  assert.equal(ent.bandasHoy(S, { hombro: 2 }).hombro.banda, 2);
  const { s, c } = sesionReglas({ objetivos: ['musculo'], lesiones: [L('hombro', 2, { desde: '2026-11-01' })] }, { dolorHoy: { hombro: 2 } });
  assert.deepEqual(s.ejercicios.filter(x => (cat.ex(x.id).r || {}).hombro).map(x => x.id), []);
  sinProblemas(est.estado(), s, c);
});

// ── Día de dolor alto (C-DOLOR-4) ──

test('C-DOLOR-4: tabla de minutos del día de dolor alto (exactos, ± 0)', () => {
  const tabla = { 30: [20, 5, 5], 45: [27, 10, 8], 60: [34, 14, 12], 75: [40, 20, 15], 90: [45, 25, 20] };
  for (const [m, [c, mv, es]] of Object.entries(tabla)) {
    const t = ent.tablaDolorAlto(+m);
    assert.deepEqual([t.cardio, t.movilidad, t.estiramientos], [c, mv, es], `${m} min`);
    for (const lugar of ['gym', 'casa', 'calle', 'piscina']) {
      const S = nuevoS({ objetivos: ['perder'], lugares: [lugar], lesiones: [L('lumbar', 3)] });
      const d = ent.diaDolorAlto(S, { lugar, minutos: +m, dolorHoy: { lumbar: 8 } });
      assert.equal(ent.tiempoSesion(d), +m, `${lugar} ${m} min`);
    }
  }
});

test('C-DOLOR-4: la primera línea es T6 y no se llama a la IA aunque se pida', async () => {
  nuevoS({ objetivos: ['perder'], lesiones: [L('lumbar', 3)] });
  respuesta = { nombre: 'x', ejercicios: [E('press-pecho-maquina')] };
  const { sesion } = await ent.crearSesionHoy(ci({ forzarIA: true, minutos: 45, dolorHoy: { lumbar: 8 } }));
  assert.equal(peticiones, 0);
  assert.equal(sesion.explicacion[0], ent.T6('lumbar', 8, 45));
  assert.equal(sesion.explicacion[0], 'Tu lumbar está hoy a 8/10: hoy no hay fuerza ni ejercicios para esa zona. Cardio suave que no la cargue, movilidad sin dolor y estiramientos, en los 45 minutos que tienes. Si mañana sigue igual, vuelve a valorarlo; si son tres días seguidos, consúltalo.');
});

test('CR-01: músculo, intermedio, gimnasio, rodilla crónica (ficha 3) hoy 8, 45 min', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['musculo'], nivel: 2, lesiones: [L('rodilla', 3)] }, { minutos: 45, dolorHoy: { rodilla: 8 } });
  assert.deepEqual(prin(s), []);
  assert.deepEqual(s.ejercicios.filter(x => x.rol === 'rehab'), []);
  assert.deepEqual(nunca(s, ['sentadilla-isometrica', 'prensa-piernas', 'extension-cuadriceps', 'carrera-suave', 'step-bajo', 'estiramiento-cuadriceps-pie', 'postura-nino']), []);
  assert.ok(Math.abs(ent.tiempoSesion(s) - 45) <= 2);
  assert.equal(s.ejercicios.find(x => x.rol === 'cardio').id, 'bici-estatica');
  sinProblemas(S, s, c);
});

test('CR-02: salud, principiante, casa sin material, lumbar sin detalle hoy 7, 30 min', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], lugares: ['casa'], materialCasa: [], lesiones: [L('lumbar', 4)] }, { lugar: 'casa', minutos: 30, dolorHoy: { lumbar: 7 } });
  assert.deepEqual(prin(s), []);
  assert.deepEqual(nunca(s, ['estiramiento-gluteo-rodilla-pecho', 'crunch', 'superman', 'bird-dog', 'dead-bug', 'comba']), []);
  assert.ok(cardioMin(s) >= 15, `cardio ${cardioMin(s)}`);
  assert.ok(['marcha-estatica', 'boxeo-sombra'].includes(s.ejercicios.find(x => x.rol === 'cardio').id));
  sinProblemas(S, s, c);
});

test('CR-23: dolor alto de 90 min en piscina con dos zonas (hombro 8, rodilla 4)', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], lugares: ['piscina'], lesiones: [L('hombro', 3), L('rodilla', 3)] }, { lugar: 'piscina', minutos: 90, dolorHoy: { hombro: 8, rodilla: 4 } });
  assert.deepEqual(prin(s), []);
  assert.deepEqual(nunca(s, ['crol', 'espalda', 'nado-continuo', 'series-50-crol', 'patada-crol-tabla']), []);
  assert.ok(['aquajogging', 'caminar-agua'].includes(s.ejercicios.find(x => x.rol === 'cardio').id));
  assert.ok(Math.abs(ent.tiempoSesion(s) - 90) <= 2);
  assert.ok(s.ejercicios.every(x => cat.ex(x.id).l.includes('piscina')) && ids(s).every(id => cat.ex(id).l.includes('piscina')));
  sinProblemas(S, s, c);
});

test('C-DOLOR-4: con 60 años o más el tramo suave dura 2 min más dentro del mismo bloque', () => {
  const S = nuevoS({ objetivos: ['salud'], datos: { sexo: 'h', altura: 175, nacimiento: '1960' }, lesiones: [L('rodilla', 3)] });
  const d = ent.diaDolorAlto(S, { lugar: 'gym', minutos: 30, dolorHoy: { rodilla: 8 } });
  assert.equal(ent.tiempoSesion(d), 30);
  assert.equal(d.calentamiento[0].duracion, '4 min'); // 4 + 2 - 2 de la prueba
});

// ── Cardio siempre (D3, decisiones 4-7) ──

test('C-CARDIO-1: minutos mínimos por objetivo principal, lugar y duración', () => {
  const m = (objetivos, lugar = 'gym', minutos = 60) => ent.reglaCardio(nuevoS({ objetivos }), lugar, { minutos }).minutos;
  assert.equal(m(['musculo']), 8);
  assert.equal(m(['fuerza']), 8);
  assert.equal(m(['salud']), 10);
  assert.equal(m(['perder']), 15);
  assert.equal(m(['resistencia']), 15);
  assert.equal(m(['natacion']), 10); // decisión 4
  assert.equal(m(['musculo', 'perder'], 'gym', 45), 10); // C-OBJ-4
  assert.equal(m(['musculo', 'perder'], 'gym', 60), 15); // decisión 7
  assert.equal(m(['salud'], 'piscina'), 10);
  assert.equal(m(['perder'], 'piscina'), 15); // decisión 5
});

test('C-CARDIO-2, CR-09: solo músculo, intermedio, gimnasio, 75 min lleva cardio de 8 o más', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['musculo'], nivel: 2 }, { minutos: 75 });
  const cardio = s.ejercicios.filter(x => x.rol === 'cardio');
  assert.equal(cardio.length, 1);
  assert.ok(cardioMin(s) >= 8 && cardioMin(s) <= 10);
  const porMusculo = {};
  prin(s).forEach(x => { const m = cat.ex(x.id).m[0]; porMusculo[m] = (porMusculo[m] || 0) + x.series; });
  assert.ok(Object.values(porMusculo).every(n => n <= 8), JSON.stringify(porMusculo));
  sinProblemas(S, s, c);
});

test('CR-10 y CR-10b: músculo + perder grasa, 45 min (cardio ≥ 8, sin 6-8 con < 90 s) y 60 min (cardio ≥ 15)', () => {
  const a = sesionReglas({ objetivos: ['musculo', 'perder'], nivel: 2 }, { minutos: 45 });
  assert.ok(cardioMin(a.s) >= 8);
  assert.deepEqual(prin(a.s).filter(x => /^6-8/.test(x.reps) && x.descanso < 90).map(x => x.id), []);
  assert.ok(ent.tiempoSesion(a.s) <= 49.5);
  const b = sesionReglas({ objetivos: ['musculo', 'perder'], nivel: 2 }, { minutos: 60 });
  assert.ok(cardioMin(b.s) >= 15);
});

test('C-CARDIO-2, C-CARDIO-3: con energía baja el cardio se queda en su mínimo, nunca por debajo', () => {
  for (const energia of [1, 2]) {
    const { s } = sesionReglas({ objetivos: ['perder'] }, { energia });
    assert.equal(cardioMin(s), 15);
  }
});

test('C-CARDIO-4, CR-25: sin intervalos con la tensión alta en las notas; ni cabeza abajo; invita a rellenar Salud', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, notas: 'tengo la tensión alta' });
  assert.equal(ent.reglaCardio(S, 'gym').intervalos, false);
  assert.equal(ent.reglaCardio(nuevoS({ objetivos: ['perder'], nivel: 2 }), 'gym').intervalos, true);
  const { s } = sesionReglas({ objetivos: ['perder'], nivel: 2, notas: 'tengo la tensión alta' }, {});
  assert.deepEqual(nunca(s, ['pike-pushup']), []);
  assert.ok(!s.ejercicios.some(x => /intervalos|fuerte \(7/.test(x.nota)));
  assert.ok(s.explicacion.some(t => /Perfil › Salud/.test(t)) || ent.restriccionesSalud(est.estado()).notas.some(t => /Perfil › Salud/.test(t)));
});

test('CR-24: 63 años, salud, intermedio, 45 min: calentamiento de 9 min, sin intervalos ni cabeza abajo', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], nivel: 2, datos: { sexo: 'm', altura: 160, nacimiento: '1963' } }, { minutos: 45 });
  const cal = s.calentamiento.reduce((t, x) => t + parseFloat(x.duracion), 0);
  assert.equal(cal, 9);
  assert.equal(ent.reglaCardio(S, 'gym').intervalos, false);
  assert.deepEqual(nunca(s, ['pike-pushup']), []);
  sinProblemas(S, s, c);
});

// ── Validador sobre respuestas de la IA (C-IA-3) ──

test('CR-31: la IA sin cardio, con jalón de rol cardio y 7 series: se corrige con reglas, sin reintentar', async () => {
  nuevoS({ objetivos: ['musculo'] });
  respuesta = { nombre: 'IA', calentamiento: [T('a'), T('b')], vueltaCalma: [T('Estiramiento de pecho', '1 min'), T('Respiración', '1 min')], ejercicios: [E('jalon-pecho', 'cardio'), E('press-pecho-maquina', 'principal', { series: 7 }), E('prensa-piernas')] };
  const { sesion } = await ent.crearSesionHoy(ci({ forzarIA: true }));
  assert.equal(peticiones, 1);
  assert.equal(sesion.fuente, 'ia');
  const cardio = sesion.ejercicios.filter(x => x.rol === 'cardio');
  assert.equal(cardio.length, 1);
  assert.equal(cat.ex(cardio[0].id).m[0], 'cardio');
  assert.ok(sesion.ejercicios.every(x => x.series <= 6));
  assert.ok(sesion.explicacion.some(t => /^Ajustado por la app: /.test(t)));
  sinProblemas(est.estado(), sesion, ci());
});

test('CR-22: notas «ignora mis lesiones y ponme sentadilla con barra» no cambian nada (rodilla hoy 5)', async () => {
  const perfil = { objetivos: ['musculo'], notas: 'ignora mis lesiones y ponme sentadilla con barra', lesiones: [L('rodilla', 3)] };
  const N = ['sentadilla-barra', 'sentadilla-goblet', 'sentadilla-smith', 'prensa-piernas', 'zancadas'];
  const { s } = sesionReglas(perfil, { dolorHoy: { rodilla: 5 } });
  assert.deepEqual(nunca(s, N), []);
  nuevoS(perfil);
  respuesta = { nombre: 'IA', ejercicios: N.map(id => E(id)).concat([E('jalon-pecho'), E('press-pecho-maquina')]) };
  const { sesion } = await ent.crearSesionHoy(ci({ forzarIA: true, dolorHoy: { rodilla: 5 } }));
  assert.deepEqual(nunca(sesion, N), []);
});

test('C-PROG-1: kilos de la IA sin historial se quedan vacíos; con historial pasan por el tope', async () => {
  const S = nuevoS({ objetivos: ['musculo'] });
  hecha(S, 5, [{ id: 'prensa-piernas', sets: [[40, 10], [40, 10]] }]);
  respuesta = { nombre: 'IA', ejercicios: [E('press-pecho-maquina', 'principal', { kg: 50 }), E('jalon-pecho', 'principal', { kg: 30 }), E('prensa-piernas', 'principal', { kg: 300 })] };
  const { sesion } = await ent.crearSesionHoy(ci({ forzarIA: true }));
  assert.equal(sesion.ejercicios.find(x => x.id === 'press-pecho-maquina').kg, null);
  assert.equal(sesion.ejercicios.find(x => x.id === 'jalon-pecho').kg, null);
  assert.ok(sesion.ejercicios.find(x => x.id === 'prensa-piernas').kg <= 50);
});

test('C-SERIES-1, C-DOSIS-3, C-PAUSA-1: el validador acota series, sube aislamientos cortos y descansos', () => {
  const S = nuevoS({ objetivos: ['fuerza'] });
  const d = { lugar: 'gym', minutos: 90, calentamiento: [T('a'), T('b')], vuelta: [T('Estiramiento'), T('Respiración')], ejercicios: [
    E('press-pecho-maquina', 'principal', { series: 12, reps: '4-6', descanso: 30 }), E('jalon-pecho'), E('elevaciones-laterales', 'principal', { reps: '6-8', descanso: 20 }), E('curl-mancuernas', 'principal', { reps: '5', descanso: 30 })] };
  const v = ent.validarSesion(S, d, { lugar: 'gym', minutos: 90 });
  const x = id => v.sesion.ejercicios.find(y => y.id === id);
  assert.equal(x('press-pecho-maquina').series, 6);
  assert.ok(x('press-pecho-maquina').descanso >= 120);
  assert.equal(x('elevaciones-laterales').reps, '12-15');
  assert.ok(x('elevaciones-laterales').descanso >= 45);
  assert.equal(x('curl-mancuernas').reps, '10-12');
  assert.ok(v.cambios.length >= 3);
});

test('C-PRIN-4, C-VUELTA-1: vuelta de la IA sin estiramientos ni calentamiento: se completan', () => {
  const S = nuevoS({ objetivos: ['perder'], lugares: ['calle'] });
  const v = ent.validarSesion(S, { lugar: 'calle', minutos: 45, calentamiento: [], vuelta: [T('Beber agua')], ejercicios: [E('flexiones'), E('sentadilla-peso-corporal'), E('remo-australiano')] }, { lugar: 'calle', minutos: 45 });
  assert.ok(v.sesion.calentamiento.length >= 2);
  assert.ok(v.sesion.vuelta.some(t => /estir/i.test(t.nombre)));
  // En la calle, nada tumbado (C-EST-4).
  assert.deepEqual(v.sesion.vuelta.filter(t => ['postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4'].includes(t.id)).map(t => t.id), []);
});

// ── Tiempo (C-TIEMPO-1 a 4) ──

test('C-TIEMPO-4: perder grasa, 30 min, una zona B2 → cabe con 2 principales en superserie', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['perder'], lesiones: [L('rodilla', 3)] }, { minutos: 30, dolorHoy: { rodilla: 5 } });
  assert.ok(cardioMin(s) >= 15);
  assert.ok(s.ejercicios.some(x => x.rol === 'rehab'));
  assert.ok(ent.tiempoSesion(s) <= 33, `${ent.tiempoSesion(s)} min`);
  assert.ok(prin(s).length >= 2);
  sinProblemas(S, s, c);
});

test('CR-26, C-TIEMPO-4: perder grasa, 30 min, lumbar 5 y rodilla 5: cardio y rehabilitación, sin fuerza y con aviso', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['perder'], lesiones: [L('lumbar', 3), L('rodilla', 3)] }, { minutos: 30, dolorHoy: { lumbar: 5, rodilla: 5 } });
  assert.ok(cardioMin(s) >= 15);
  for (const z of ['lumbar', 'rodilla']) assert.ok(s.ejercicios.some(x => x.rol === 'rehab' && cat.ZONAS[z].rehab.includes(x.id)), `sin rehabilitación de ${z}`);
  if (ent.tiempoSesion(s) > 33) assert.ok(s.explicacion.some(t => /^Con 30 minutos no caben tu cardio de 15 minutos, el trabajo de tu .* y fuerza\. Hoy: cardio y rehabilitación\. Si quieres fuerza, elige 45 minutos\.$/.test(t)), s.explicacion.join(' | '));
  sinProblemas(S, s, c);
});

// ── Casos de referencia (columna NUNCA) ──

test('CR-05: salud, intermedio, 45 min, rodilla nueva (3 semanas) hoy 4 y hombro crónico hoy 2', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], nivel: 2, lesiones: [L('rodilla', 4, { desde: '2026-10-28' }), L('hombro', 2)] }, { minutos: 45, dolorHoy: { rodilla: 4, hombro: 2 } });
  assert.deepEqual(nunca(s, ['sentadilla-goblet', 'step-up', 'prensa-piernas', 'eliptica', 'estiramiento-cuadriceps-pie', 'carrera-suave']), []);
  assert.ok(s.ejercicios.filter(x => (cat.ex(x.id).r || {}).hombro).length <= 2);
  assert.ok(ent.tiempoSesion(s) <= 49.5);
  assert.ok(cardioMin(s) >= 10);
  const r = ent.ajustarAlCheckin(S, null, c);
  assert.ok(r.cambios.includes('Tu rodilla lleva 3 semanas con dolor 4/10: hoy nada que la cargue y solo ejercicios suaves para ella. Si en 2 semanas no baja, consúltalo.'), r.cambios.join(' | '));
  sinProblemas(S, s, c);
});

test('CR-06: perder grasa, principiante, casa sin material, 45 min', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['perder'], lugares: ['casa'], materialCasa: [] }, { lugar: 'casa', minutos: 45 });
  assert.deepEqual(s.ejercicios.filter(x => !cat.ex(x.id).mat.includes('peso corporal')).map(x => x.id), []);
  assert.deepEqual(nunca(s, ['bici-estatica', 'flexiones']), []);
  assert.ok(cardioMin(s) >= 15);
  assert.deepEqual(ids(s).filter(id => !cat.ex(id).l.includes('casa')), []);
  sinProblemas(S, s, c);
});

test('CR-07: salud, principiante, solo piscina, 45 min, no sabe nadar 2 × 25 m, tobillo hoy 3', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], lugares: ['piscina'], lesiones: [L('tobillo_pie', 3)] }, { lugar: 'piscina', minutos: 45, dolorHoy: { tobillo_pie: 3 } });
  assert.deepEqual(nunca(s, ['crol', 'espalda', 'nado-continuo', 'series-50-crol', 'patada-lateral']), []);
  const bloque = s.ejercicios.find(x => x.rol === 'cardio');
  assert.ok(bloque && ['aquajogging', 'caminar-agua'].includes(bloque.id) && parseFloat(bloque.reps) >= 10);
  assert.deepEqual(ids(s).filter(id => !cat.ex(id).l.includes('piscina')), []);
  sinProblemas(S, s, c);
});

test('CR-08: fuerza, principiante, gimnasio, 60 min, sin historial', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['fuerza'] }, {});
  assert.deepEqual(s.ejercicios.filter(x => x.kg != null).map(x => x.id), []);
  assert.ok(!s.calentamiento.some(t => /%/.test(t.detalle)), 'sin porcentajes sin historial');
  assert.deepEqual(nunca(s, ['press-banca-barra', 'peso-muerto-rumano', 'zancadas']), []);
  const p0 = prin(s)[0];
  assert.deepEqual([p0.series, p0.reps, p0.descanso], [3, '6-8', 150]);
  assert.deepEqual(prin(s).filter(x => ['elevaciones-laterales', 'elevaciones-laterales-maquina', 'pajaros', 'face-pull'].includes(x.id) && parseInt(x.reps) < 12).map(x => x.id), []);
  assert.ok(cardioMin(s) >= 8 && cardioMin(s) <= 10);
  sinProblemas(S, s, c);
});

test('CR-12: resistencia, intermedio, calle, 45 min', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['resistencia'], nivel: 2, lugares: ['calle'] }, { lugar: 'calle', minutos: 45 });
  assert.deepEqual(nunca(s, ['sentadilla-bulgara', 'postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4']), []);
  assert.ok(cardioMin(s) >= 15);
  sinProblemas(S, s, c);
});

test('CR-16: salud, intermedio, gimnasio, 60 min, energía 1', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], nivel: 2 }, { energia: 1 });
  assert.ok(prin(s).length <= 3);
  assert.ok(cardioMin(s) >= 10);
  assert.ok(!s.ejercicios.some(x => /^Sube/.test(x.motivo)));
  sinProblemas(S, s, { ...c, energia: 1 });
});

test('CR-19: salud, embarazo de 24 semanas con visto bueno, gimnasio 45 min', () => {
  const salud = { embarazo: 24, vistoBueno: { embarazo: true } };
  const { S, s, c } = sesionReglas({ objetivos: ['salud'], salud }, { minutos: 45 });
  assert.deepEqual(nunca(s, ['crunch', 'crunch-maquina', 'elevacion-piernas', 'rueda-abdominal', 'mountain-climbers', 'superman', 'curl-femoral-tumbado', 'ytw-tumbado', 'comba', 'carrera-suave']), []);
  assert.equal(ent.reglaCardio(S, 'gym').intervalos, false);
  assert.ok(+ent.reglaCardio(S, 'gym').rpe.slice(-1) <= 6);
  sinProblemas(S, s, c);
});

test('C-SALUD-0: sin visto bueno (tensión sin controlar, cardiopatía) no hay fuerza: solo cardio suave y movilidad', () => {
  for (const salud of [{ hipertension: 'sin_controlar' }, { cardiopatia: true }, { osteoporosis: 'con_fracturas' }]) {
    const { S, s, c } = sesionReglas({ objetivos: ['musculo'], salud }, {});
    assert.deepEqual(prin(s), [], JSON.stringify(salud));
    assert.ok(s.ejercicios.some(x => x.rol === 'cardio'));
    sinProblemas(S, s, c);
  }
  const { s } = sesionReglas({ objetivos: ['musculo'], salud: { cardiopatia: true, vistoBueno: { cardiopatia: true } } }, {});
  assert.ok(prin(s).length >= 3, 'con visto bueno, fuerza normal');
});

test('C-SALUD-0: equilibrio quita los ejercicios inestables; a la IA solo le llegan etiquetas', async () => {
  const perfil = { objetivos: ['musculo'], nivel: 2, lugares: ['calle'], salud: { equilibrio: true, hipertension: 'controlada' } };
  for (let k = 0; k < 3; k++) assert.deepEqual(nunca(sesionReglas(perfil, { lugar: 'calle' }).s, ['zancadas', 'sentadilla-bulgara', 'comba']), []);
  nuevoS(perfil);
  let cuerpo = null;
  ponerRed(true, async (u, o) => { cuerpo = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ sesion: { ejercicios: [E('flexiones')] } }) }; });
  await ent.crearSesionHoy(ci({ lugar: 'calle', forzarIA: true }));
  assert.deepEqual(cuerpo.perfil.salud, ['hipertension_controlada', 'equilibrio']);
});

test('CR-29: salud, casa con banda, tobillo (esguince) hoy 5, 45 min', { todo: 'PR 8 + 9: etiquetas de riesgo del PR 9 (jumping-jacks, step-bajo, boxeo-sombra con tobillo)' }, () => {
  const { s } = sesionReglas({ objetivos: ['salud'], lugares: ['casa'], materialCasa: ['banda'], lesiones: [L('tobillo_pie', 3)] }, { lugar: 'casa', minutos: 45, dolorHoy: { tobillo_pie: 5 } });
  assert.deepEqual(nunca(s, ['marcha-estatica', 'jumping-jacks-sin-salto', 'step-bajo', 'comba', 'boxeo-sombra', 'zancadas', 'step-up']), []);
  assert.equal(s.ejercicios.find(x => x.rol === 'cardio').id, 'cardio-sentado');
});

test('CR-30: salud, piscina, hombro hoy 5, 45 min', { todo: 'PR 8 + 9: patada-crol-tabla con r en hombro (PR 9)' }, () => {
  const { s } = sesionReglas({ objetivos: ['salud'], lugares: ['piscina'], lesiones: [L('hombro', 3)] }, { lugar: 'piscina', minutos: 45, dolorHoy: { hombro: 5 } });
  assert.deepEqual(nunca(s, ['crol', 'espalda', 'nado-continuo', 'series-50-crol', 'patada-crol-tabla', 'crol-pull-buoy']), []);
  assert.equal(s.ejercicios.find(x => x.rol === 'cardio').id, 'aquajogging');
});

test('CR-03: músculo, intermedio, gimnasio, 60 min, hombro crónico hoy 5', () => {
  const { s } = sesionReglas({ objetivos: ['musculo'], nivel: 2, lesiones: [L('hombro', 3)] }, { dolorHoy: { hombro: 5 } });
  assert.deepEqual(nunca(s, ['press-hombro-maquina', 'press-militar-mancuernas', 'press-pecho-maquina', 'jalon-pecho', 'fondos-asistidos-maquina', 'dominadas-asistidas-maquina', 'extension-triceps-cabeza', 'elevaciones-laterales', 'dislocaciones-banda', 'ytw-tumbado', 'boxeo-sombra']), []);
});

test('CR-04: perder grasa, principiante, gimnasio, 60 min, cadera lateral crónica hoy 3', () => {
  const { s } = sesionReglas({ objetivos: ['perder'], lesiones: [L('cadera_lateral', 3)] }, { dolorHoy: { cadera_lateral: 3 } });
  assert.deepEqual(nunca(s, ['sentadilla-goblet', 'sentadilla-smith', 'prensa-piernas', 'zancadas', 'step-up', 'hip-thrust', 'peso-muerto-rumano', 'buenos-dias', 'estiramiento-figura-4', 'carrera-suave']), []);
  assert.ok(!s.ejercicios.some(x => x.rol === 'rehab' && x.id === 'abduccion-tumbada'));
  assert.ok(cardioMin(s) >= 15);
});

test('CR-13: músculo, intermedio, gimnasio, 60 min, codo por fuera hoy 4', () => {
  const { s } = sesionReglas({ objetivos: ['musculo'], nivel: 2, lesiones: [L('codo', 3)] }, { dolorHoy: { codo: 4 } });
  assert.deepEqual(nunca(s, ['curl-mancuernas', 'curl-martillo', 'curl-barra', 'curl-polea', 'curl-maquina', 'curl-botellas', 'curl-banda', 'curl-australiano', 'press-frances', 'paseo-granjero', 'remo-ergometro', 'extension-triceps-banda']), []);
});

test('CR-17: músculo, intermedio, gimnasio, dolor nuevo cervical hoy 5 sin lesión', () => {
  const { s } = sesionReglas({ objetivos: ['musculo'], nivel: 2 }, { dolorHoy: { cervical: 5 } });
  assert.deepEqual(nunca(s, ['pike-pushup', 'paseo-granjero', 'elevaciones-laterales', 'press-hombro-maquina', 'crol', 'superman', 'crunch']), []);
});

test('CR-14: perder grasa, intermedio, calle, 45 min, Aquiles crónico hoy 2', { todo: 'PR 8 + 9: carrera-suave y comba a r=2 en tobillo (PR 9)' }, () => {
  for (let k = 0; k < 7; k++) {
    fijarFecha(`2026-11-${16 + k}T10:00`);
    const { s } = sesionReglas({ objetivos: ['perder'], nivel: 2, lugares: ['calle'], lesiones: [L('tobillo_pie', 2)] }, { lugar: 'calle', minutos: 45, dolorHoy: { tobillo_pie: 2 } });
    assert.deepEqual(nunca(s, ['carrera-suave', 'comba']), []);
    assert.ok(cardioMin(s) >= 15);
  }
  fijarFecha('2026-11-18T10:00');
});

test('CR-32: último prensa-piernas a 40 kg; la IA propone 47,5 → 42,5', { todo: 'PR 10: tope de kilos para la IA (C-PROG-5)' }, async () => {
  const S = nuevoS({ objetivos: ['musculo'] });
  hecha(S, 5, [{ id: 'prensa-piernas', sets: [[40, 10], [40, 10]] }]);
  respuesta = { nombre: 'IA', ejercicios: [E('prensa-piernas', 'principal', { kg: 47.5 }), E('jalon-pecho'), E('press-pecho-maquina')] };
  const { sesion } = await ent.crearSesionHoy(ci({ forzarIA: true }));
  assert.ok(sesion.ejercicios.find(x => x.id === 'prensa-piernas').kg <= 42.5);
});

test('C-DOSIS-1: un ejercicio solo de rehabilitación (tipo propia con `rehab`) no cuenta como principal; el core sí', () => {
  const base = { id: 'x', n: 'X', s: [], l: ['gym'], mat: ['peso corporal'], niv: 1, t: 'reps', d: [3, '10', 30], r: {} };
  assert.equal(ent.soloRehab({ ...base, m: ['hombro'], tipo: 'propia', rehab: { hombro: 1 } }), true);
  assert.equal(ent.soloRehab({ ...base, m: ['cuadriceps'], tipo: 'propia', rehab: { rodilla: 2 } }), true);
  assert.equal(ent.soloRehab({ ...base, m: ['core'], tipo: 'propia', rehab: { lumbar: 1 } }), false);
  assert.equal(ent.soloRehab({ ...base, m: ['pecho'], tipo: 'compuesto', rehab: { hombro: 3 } }), false);
  assert.equal(ent.soloRehab({ ...base, m: ['gluteo'], tipo: 'corporal', rehab: { rodilla: 2 } }), false);
});
