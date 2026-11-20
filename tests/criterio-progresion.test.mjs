// PR 10 · Progresión, recuperación, descarga, parón, nivel y análisis según docs/criterio.md.
// Cada prueba cita el id de la regla. Incluye los vectores de C-PROG-8 y C-ANA-2, los 8 historiales
// sintéticos (H-1 a H-8) de la sección 19 y el criterio T6 del plan.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, restaurarFecha } from './ayuda/comun.mjs';
import { prog, ctx, nuevoS, hecha, cat, est, analisis as A } from './ayuda/node.mjs';

afterEach(restaurarFecha);
const { sugerir, acotarKg, cargaMuscular, registros, semanaDescarga, tramoParon } = prog;
const B = { series: 3, reps: '8-12' };
const serie = (kg, ...reps) => reps.map(r => [kg, r]);
const dia = n => est.hoyISO(new Date(Date.now() - n * 864e5));
const cronica = (zona, dolor) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: dia(240), tipo: 'lesion' });

// ── C-PROG-8 · Estancado (vectores del criterio) ──

test('C-PROG-8: 20 kg 8-8-8 → 9-8-8 → 10-10-9 → 10-10-10 progresa', () => {
  const S = nuevoS();
  [[21, [8, 8, 8]], [14, [9, 8, 8]], [7, [10, 10, 9]], [1, [10, 10, 10]]].forEach(([d, r]) => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(20, ...r) }]));
  const a = ctx.analizarEjercicios(S)['press-pecho-maquina'];
  assert.equal(a.estancado, false);
  assert.equal(a.estado, 'progresa');
});

test('C-PROG-8: 20 kg 10-9-8 cuatro veces en 3 semanas está estancado', () => {
  const S = nuevoS();
  // Constancia alta para que se aplique el cambio (con < 75 % no se cambia nada).
  for (let d = 30; d >= 1; d -= 2) hecha(S, d, [{ id: 'remo-sentado-polea', sets: serie(30, 12, 12, 12) }]);
  [21, 14, 7, 1].forEach(d => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(20, 10, 9, 8) }]));
  const a = ctx.analizarEjercicios(S)['press-pecho-maquina'];
  assert.equal(a.estancado, true);
  assert.equal(a.estado, 'estancado');
  assert.match(a.accion, /variante|rango/);
});

test('C-PROG-8: 20 kg 12-12-12 → 22 kg 8-8-8 → 9-9-8 → 10-9-9 progresa', () => {
  const S = nuevoS();
  hecha(S, 21, [{ id: 'press-pecho-maquina', sets: serie(20, 12, 12, 12) }]);
  [[14, [8, 8, 8]], [7, [9, 9, 8]], [1, [10, 9, 9]]].forEach(([d, r]) => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(22, ...r) }]));
  assert.equal(ctx.analizarEjercicios(S)['press-pecho-maquina'].estancado, false);
});

test('C-PROG-8: menos de 14 días o sesiones con energía ≤ 2 no cuentan para «estancado»', () => {
  const S = nuevoS();
  [12, 8, 4, 1].forEach(d => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(20, 10, 9, 8) }]));
  assert.equal(ctx.analizarEjercicios(S)['press-pecho-maquina'].estancado, false, 'en 11 días');
  const S2 = nuevoS();
  [21, 14].forEach(d => hecha(S2, d, [{ id: 'press-pecho-maquina', sets: serie(20, 10, 9, 8) }]));
  [7, 1].forEach(d => hecha(S2, d, [{ id: 'press-pecho-maquina', sets: serie(20, 10, 9, 8) }], { checkin: { energia: 2, dolor: {} } }));
  assert.equal(ctx.analizarEjercicios(S2)['press-pecho-maquina'].estancado, false, 'dos con energía 2');
});

test('C-PROG-8: con constancia < 75 % no se cambia nada y se dice', () => {
  fijarFecha('2026-11-18T10:00');
  const S = nuevoS({ disponibilidad: { dias: 4, minutos: 60, diasSemana: [] } });
  [35, 28, 21, 14, 7, 1].forEach(d => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(20, 10, 9, 8) }]));
  const a = ctx.analizarEjercicios(S)['press-pecho-maquina'];
  assert.equal(a.estancado, true);
  assert.equal(a.estado, 'estable');
  assert.match(a.accion, /constancia/);
});

// ── C-ANA-1 y C-ANA-2 · «Molesta» ──

test('C-ANA-2: vectores de negación', () => {
  const v = { 'sin dolor, muy bien': false, 'no me ha molestado nada': false, 'me molesta un poco el hombro al bajar': true, 'ya no duele pero cruje': true, 'dolor 0': false,
    'no me duele': false, 'nada de dolor': false, 'ni molestia': false, 'cero dolor': false, 'ya no me molesta': false, 'no noto nada': false, 'sin molestias': false, 'me duele la rodilla': true };
  for (const [t, si] of Object.entries(v)) assert.equal(ctx.leerComentario(t).includes('molestia'), si, t);
});

test('C-ANA-1: «molesta» solo en los últimos 30 días y se quita tras 2 sesiones limpias', () => {
  const S = nuevoS();
  hecha(S, 40, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10), comentario: 'me duele el codo' }]);
  hecha(S, 35, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10) }]);
  assert.notEqual(ctx.analizarEjercicios(S)['curl-mancuernas'].estado, 'molesta', 'hace más de 30 días');
  const S2 = nuevoS();
  hecha(S2, 10, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10), comentario: 'me duele el codo' }]);
  assert.equal(ctx.analizarEjercicios(S2)['curl-mancuernas'].estado, 'molesta');
  hecha(S2, 6, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10) }]);
  assert.equal(ctx.analizarEjercicios(S2)['curl-mancuernas'].estado, 'molesta', 'una sesión limpia no basta');
  hecha(S2, 2, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10) }]);
  assert.notEqual(ctx.analizarEjercicios(S2)['curl-mancuernas'].estado, 'molesta', 'dos sesiones limpias');
});

test('C-ANA-1: una subida de dolor ≥ 2 en una zona con r marca «molesta»', () => {
  const S = nuevoS();
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 10, 10, 10) }], { checkin: { energia: 3, dolor: { hombro: 1 } }, cierre: { esfuerzo: 3, dolor: { hombro: 4 } } });
  assert.equal(ctx.analizarEjercicios(S)['press-pecho-maquina'].estado, 'molesta');
});

// ── Historiales sintéticos (sección 19) ──

test('H-1: mancuerna de 4 kg a 3 × 12: no sube a 5 kg hasta 2 sesiones en el tope o 3 × 14 (C-PROG-4)', () => {
  const S = nuevoS();
  hecha(S, 4, [{ id: 'curl-mancuernas', sets: serie(4, 12, 12, 12) }]);
  const una = sugerir(S, 'curl-mancuernas', B);
  assert.equal(una.tipo, 'igual', una.motivo);
  assert.equal(una.kg, 4);
  hecha(S, 2, [{ id: 'curl-mancuernas', sets: serie(4, 12, 12, 12) }]);
  const dos = sugerir(S, 'curl-mancuernas', B);
  assert.equal(dos.tipo, 'sube', dos.motivo);
  assert.equal(dos.kg, 5);
  const S2 = nuevoS();
  hecha(S2, 2, [{ id: 'curl-mancuernas', sets: serie(4, 14, 14, 14) }]);
  assert.equal(sugerir(S2, 'curl-mancuernas', B).kg, 5, 'tope + 2 repeticiones');
});

test('H-2: 4 kg, dos sesiones con 5-5-4 en rango 8-12 → baja a 3 kg (C-PROG-6)', () => {
  const S = nuevoS();
  hecha(S, 6, [{ id: 'curl-mancuernas', sets: serie(4, 5, 5, 4) }]);
  hecha(S, 2, [{ id: 'curl-mancuernas', sets: serie(4, 5, 5, 4) }]);
  const s = sugerir(S, 'curl-mancuernas', B);
  assert.equal(s.tipo, 'baja');
  assert.equal(s.kg, 3);
  // Una sola sesión corta: se repite el peso.
  const S2 = nuevoS();
  hecha(S2, 2, [{ id: 'curl-mancuernas', sets: serie(4, 5, 5, 4) }]);
  assert.equal(sugerir(S2, 'curl-mancuernas', B).kg, 4);
});

test('H-3: cuerpo completo L-X-V, pecho 4 series cada día, esfuerzo 3 → el miércoles puede subir (C-REC-1, C-REC-2)', () => {
  fijarFecha('2026-11-18T18:00'); // miércoles
  const S = nuevoS();
  hecha(S, 0, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12, 12) }], { cuando: new Date('2026-11-16T18:00'), cierre: { esfuerzo: 3, dolor: {} } });
  const carga = cargaMuscular(S);
  assert.notEqual(carga.pecho && carga.pecho.estado, 'cargado');
  const s = sugerir(S, 'press-pecho-maquina', { series: 4, reps: '8-12' });
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('H-4: hombro activo 1/10 desde hace 8 meses, sin subidas → press-pecho-maquina sube (C-PROG-7)', () => {
  const S = nuevoS({ lesiones: [cronica('hombro', 1)] });
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }], { checkin: { energia: 3, dolor: { hombro: 1 } }, cierre: { esfuerzo: 3, dolor: { hombro: 1 } } });
  const s = sugerir(S, 'press-pecho-maquina', B, { niveles: cat.nivelesZona(S.perfil), dolorHoy: { hombro: 1 } });
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('H-5: 2 medidas de peso en 10 días → sin datos suficientes ni cardio extra (C-ANA-3)', () => {
  const S = nuevoS({ objetivos: ['perder'] });
  S.medidas = [{ fecha: dia(10), peso: 80 }, { fecha: dia(0), peso: 80.5 }];
  const t = ctx.tendencias(S);
  assert.equal(t.peso.suficiente, false);
  assert.equal(t.cambioPeso4sem, null);
  for (let d = 30; d >= 1; d -= 2) hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(40, 10, 10) }]);
  assert.equal(ctxPlan().ajustesPorTendencia(S).cardioExtra, 0);
});

test('H-6: «sin dolor» en curl-mancuernas no es «molesta» (C-ANA-2)', () => {
  const S = nuevoS();
  hecha(S, 2, [{ id: 'curl-mancuernas', sets: serie(8, 10, 10, 10), comentario: 'sin dolor' }]);
  assert.notEqual(ctx.analizarEjercicios(S)['curl-mancuernas'].estado, 'molesta');
});

test('H-7: flexiones 3 × 15 dos veces, intermedio → progresión desde lo hecho; diamante solo con nivel 3 (C-PROG-9, C-DOSIS-10)', () => {
  const base = { series: 3, reps: '8-15' };
  for (const nivel of [2, 3]) {
    const S = nuevoS({ nivel });
    hecha(S, 6, [{ id: 'flexiones', sets: serie(null, 15, 15, 15) }]);
    hecha(S, 2, [{ id: 'flexiones', sets: serie(null, 15, 15, 15) }]);
    const s = sugerir(S, 'flexiones', base);
    assert.equal(s.tipo, 'series', s.motivo);
    assert.equal(s.series, 4);
    assert.ok(prog.rango(s.reps).hi >= 15, s.reps);
    assert.equal(s.variante, undefined);
  }
  // Por encima de 15 repeticiones dos sesiones seguidas: variante, pero la diamante (nivel 3) solo a un avanzado.
  const conNivel = nivel => { const S = nuevoS({ nivel }); hecha(S, 6, [{ id: 'flexiones', sets: serie(null, 17, 17, 17, 17) }]); hecha(S, 2, [{ id: 'flexiones', sets: serie(null, 17, 17, 17, 17) }]); return sugerir(S, 'flexiones', { series: 4, reps: '8-15' }); };
  assert.equal(conNivel(2).variante, undefined);
  assert.doesNotMatch(conNivel(2).motivo, /diamante/);
  assert.equal(conNivel(3).variante, 'flexiones-diamante');
  assert.ok(prog.rango(conNivel(2).reps).lo >= 17, 'nunca por debajo de lo hecho');
});

test('H-8: parón de 30 días → −20 % y −1 serie (C-PARON-1)', () => {
  const S = nuevoS();
  hecha(S, 30, [{ id: 'prensa-piernas', sets: serie(100, 12, 12, 12) }]);
  const s = sugerir(S, 'prensa-piernas', B);
  assert.equal(s.tipo, 'baja');
  assert.equal(s.kg, 80);
  assert.equal(s.series, 2);
});

// ── T6 (plan): la progresión sube cuando toca ──

test('T6: en un L-X-V de cuerpo completo se sube los tres días', () => {
  const S = nuevoS({ nivel: 2 });
  const ejs = { 'press-pecho-maquina': 40, 'prensa-piernas': 80, 'jalon-pecho': 35 };
  const B4 = { series: 3, reps: '8-12' };
  // El viernes anterior, todo al tope.
  fijarFecha('2026-11-13T18:00');
  hecha(S, 0, Object.entries(ejs).map(([id, kg]) => ({ id, sets: serie(kg, 12, 12, 12) })), { cuando: new Date('2026-11-13T18:00') });
  for (const f of ['2026-11-16T18:00', '2026-11-18T18:00', '2026-11-20T18:00']) {
    fijarFecha(f);
    const hoy = Object.keys(ejs).map(id => { const s = sugerir(S, id, B4); assert.equal(s.tipo, 'sube', `${f} ${id}: ${s.motivo}`); return { id, sets: serie(s.kg, 12, 12, 12) }; });
    hecha(S, 0, hoy, { cuando: new Date(f), cierre: { esfuerzo: 3, dolor: {} } });
  }
});

test('T6: 8-8-8 → 10-10-9 con el mismo peso no es «estancado»', () => {
  const S = nuevoS();
  [[21, [8, 8, 8]], [14, [8, 8, 9]], [7, [9, 9, 9]], [1, [10, 10, 9]]].forEach(([d, r]) => hecha(S, d, [{ id: 'press-pecho-maquina', sets: serie(40, ...r) }]));
  assert.notEqual(ctx.analizarEjercicios(S)['press-pecho-maquina'].estado, 'estancado');
});

test('T6: con dolor 1-3 estable se progresa; con dolor de hoy ≥ 4 no (C-PROG-7)', () => {
  for (const d of [1, 2, 3]) {
    const S = nuevoS({ lesiones: [cronica('hombro', d)] });
    hecha(S, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }]);
    assert.equal(sugerir(S, 'press-pecho-maquina', B, { niveles: cat.nivelesZona(S.perfil, { hombro: d }), dolorHoy: { hombro: d } }).tipo, 'sube', `dolor ${d}`);
    assert.notEqual(sugerir(S, 'press-pecho-maquina', B, { niveles: cat.nivelesZona(S.perfil, { hombro: 4 }), dolorHoy: { hombro: 4 } }).tipo, 'sube', 'dolor 4 hoy');
  }
});

// ── C-PROG-7 y C-REC-3 · Frenos ──

test('C-PROG-7: frena la lesión nueva, la tendencia que sube y la subida de dolor; nunca dos semanas seguidas', () => {
  const nueva = nuevoS({ lesiones: [{ id: 'h', zona: 'hombro', dolor: 2, activa: true, desde: dia(20) }] });
  hecha(nueva, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }]);
  assert.match(sugerir(nueva, 'press-pecho-maquina', B).motivo, /reciente/);

  const sube = nuevoS({ lesiones: [cronica('hombro', 2)] });
  sube.dolor = [20, 18, 16, 10, 6, 1].map((d, i) => ({ fecha: dia(d), zona: 'hombro', dolor: i < 3 ? 1 : 3, momento: 'dia' }));
  hecha(sube, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }]);
  assert.match(sugerir(sube, 'press-pecho-maquina', B).motivo, /va a más/);

  const semana = nuevoS({ lesiones: [cronica('hombro', 1)] });
  hecha(semana, 9, [{ id: 'press-pecho-maquina', sets: serie(37.5, 12, 12, 12) }]);
  hecha(semana, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }]);
  const s = sugerir(semana, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'igual', s.motivo);
  assert.match(s.motivo, /semana sí y otra no/);
});

test('C-REC-1/2: un músculo «cargado» (menos del 67 % de sus horas y ≥ 4 series) frena; el core se recupera en 24 h', () => {
  const S = nuevoS({ nivel: 2 });
  hecha(S, 0, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12, 12) }, { id: 'plancha', sets: serie(null, 40, 40, 40, 40) }], { cuando: new Date(Date.now() - 20 * 3600e3) });
  const c = cargaMuscular(S);
  assert.equal(c.pecho.estado, 'cargado');
  assert.equal(c.core.rec, 24);
  assert.notEqual(sugerir(S, 'press-pecho-maquina', { series: 4, reps: '8-12' }).tipo, 'sube');
  hecha(S, 0, [{ id: 'curl-mancuernas', sets: serie(8, 12, 12, 12) }], { cuando: new Date(Date.now() - 30 * 3600e3) });
  assert.equal(cargaMuscular(S).biceps.rec, 36);
});

test('C-DOLOR-7: hoy 2 puntos más que antes de la última sesión → baja un 30 %', () => {
  const S = nuevoS({ lesiones: [cronica('hombro', 2)] });
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 10, 10, 10) }], { checkin: { energia: 3, dolor: { hombro: 2 } }, cierre: { esfuerzo: 3, dolor: { hombro: 2 } } });
  const s = sugerir(S, 'press-pecho-maquina', B, { dolorHoy: { hombro: 4 } });
  assert.equal(s.tipo, 'baja');
  assert.equal(s.kg, 27.5);
});

// ── C-PROG-5 · Tope de la IA ──

test('C-PROG-5 (CR-32): último prensa a 40 kg, la IA propone 47,5 → 42,5; mínimo 50 %; nunca NaN', () => {
  const S = nuevoS();
  hecha(S, 3, [{ id: 'prensa-piernas', sets: serie(40, 10, 10, 10) }]);
  assert.equal(acotarKg(S, 'prensa-piernas', 47.5), 42.5);
  assert.equal(acotarKg(S, 'prensa-piernas', 5), 20);
  for (const raro of [NaN, 'abc', -3, Infinity, null, '']) assert.equal(acotarKg(S, 'prensa-piernas', raro), null, String(raro));
  // Asistidas: ayuda ≥ última − 1 paso.
  hecha(S, 3, [{ id: 'dominadas-asistidas-maquina', sets: serie(20, 8, 8, 8) }]);
  assert.equal(acotarKg(S, 'dominadas-asistidas-maquina', 5), 17.5);
  // Con dolor de hoy ≥ 4 en una zona implicada, sin subida.
  const L = nuevoS({ lesiones: [cronica('hombro', 2)] });
  hecha(L, 3, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }]);
  assert.equal(acotarKg(L, 'press-pecho-maquina', 45, { dolorHoy: { hombro: 5 } }), 40, 'CR-03');
});

// ── C-PARON-1 · Vuelta tras un parón (y CR-15) ──

test('C-PARON-1: tramos de vuelta', () => {
  assert.equal(tramoParon(10), null);
  assert.equal(tramoParon(14).pct, 0.1);
  assert.equal(tramoParon(21).pct, 0.1);
  assert.equal(tramoParon(22).pct, 0.2);
  assert.equal(tramoParon(42).pct, 0.2);
  assert.equal(tramoParon(43).pct, 0.35);
  assert.equal(tramoParon(84).pct, 0.35);
  assert.equal(tramoParon(85).pct, null);
  const S = nuevoS();
  hecha(S, 100, [{ id: 'prensa-piernas', sets: serie(100, 12, 12, 12) }]);
  const s = sugerir(S, 'prensa-piernas', B);
  assert.equal(s.tipo, 'nuevo');
  assert.equal(s.kg, null);
  assert.equal(acotarKg(S, 'prensa-piernas', 90), null);
});

test('C-PARON-1 (CR-15): tras 7 semanas, −30 a −40 %, series −40 % y sin subidas en 2 semanas; nivel −1 desde 56 días', () => {
  const S = nuevoS({ nivel: 2 });
  const N = nuevoS({ nivel: 2 });
  hecha(N, 57, [{ id: 'prensa-piernas', sets: serie(100, 12, 12, 12) }]);
  assert.equal(ctx.medidorNivel(N).sugerido, 1, 'C-NIVEL-3: con 56 días o más se propone nivel −1');
  hecha(S, 49, [{ id: 'prensa-piernas', sets: serie(100, 12, 12, 12) }]);
  const s = sugerir(S, 'prensa-piernas', { series: 4, reps: '8-12' });
  assert.ok(s.kg >= 60 && s.kg <= 70, `kg ${s.kg}`);
  assert.equal(s.series, 2);
  assert.ok(acotarKg(S, 'prensa-piernas', 95) <= 70);
  assert.equal(ctx.medidorNivel(S).sugerido, 2, 'C-NIVEL-3: hasta 56 días no se propone bajar');
  // Reentrada: la primera sesión de vuelta al tope no sube.
  hecha(S, 3, [{ id: 'prensa-piernas', sets: serie(65, 12, 12, 12) }]);
  const r = sugerir(S, 'prensa-piernas', B);
  assert.notEqual(r.tipo, 'sube', r.motivo);
  assert.match(r.motivo, /parón/);
});

// ── C-DESCARGA-1 ──

test('C-DESCARGA-1: tras 5 semanas constantes (intermedio) toca descarga; mismo peso y sin subidas', () => {
  fijarFecha('2026-11-18T10:00'); // miércoles de la semana 47
  const S = nuevoS({ nivel: 2, disponibilidad: { dias: 3, minutos: 60, diasSemana: [] } });
  // Semanas 42 a 46 con 3 sesiones (lunes, miércoles y viernes).
  for (let w = 5; w >= 1; w--) for (const d of [0, 2, 4]) hecha(S, 0, [{ id: 'press-pecho-maquina', sets: serie(40, 12, 12, 12) }], { cuando: new Date(new Date('2026-11-16T18:00').getTime() - w * 7 * 864e5 + d * 864e5) });
  assert.equal(semanaDescarga(S).toca, true);
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'igual');
  assert.equal(s.kg, 40);
  assert.match(s.motivo, /descarga/);
  // Principiante: tras 8.
  S.perfil.nivel = 1;
  assert.equal(semanaDescarga(S).toca, false);
});

test('C-DESCARGA-1: una semana sin entrenar cuenta como descarga; 2 de 4 señales la adelantan', () => {
  fijarFecha('2026-11-18T10:00');
  const S = nuevoS({ nivel: 2 });
  for (const w of [6, 5, 3, 2, 1]) for (const d of [0, 2, 4]) hecha(S, 0, [{ id: 'remo-sentado-polea', sets: serie(40, 10, 10, 10) }], { cuando: new Date(new Date('2026-11-16T18:00').getTime() - w * 7 * 864e5 + d * 864e5) });
  assert.equal(semanaDescarga(S).toca, false, 'la semana 4 sin entrenar reinicia la cuenta');
  // Señales: esfuerzo medio ≥ 4,3 y energía ≤ 2 en 3 de los últimos 5 check-ins.
  const T = nuevoS({ nivel: 2 });
  for (const d of [12, 10, 8, 5, 3]) hecha(T, d, [{ id: 'remo-sentado-polea', sets: serie(40, 10, 10, 10) }], { cierre: { esfuerzo: 5, dolor: {} }, checkin: { energia: 2, dolor: {} } });
  const r = semanaDescarga(T);
  assert.equal(r.toca, true);
  assert.equal(r.senales.length >= 2, true);
});

test('C-DESCARGA-1: las sesiones de descarga no cuentan para «estancado»', () => {
  fijarFecha('2026-11-18T10:00');
  const S = nuevoS({ nivel: 2 });
  for (let w = 7; w >= 1; w--) for (const d of [0, 2, 4]) hecha(S, 0, [{ id: 'press-pecho-maquina', sets: serie(40, 10, 9, 8) }], { cuando: new Date(new Date('2026-11-16T18:00').getTime() - w * 7 * 864e5 + d * 864e5) });
  const regs = registros(S, 'press-pecho-maquina');
  assert.equal(regs.filter(r => r.descarga).length, 3, 'la sexta semana es de descarga');
  assert.equal(regs.filter(prog.cuentaParaEstancado).length, regs.length - 3);
});

// ── C-NIVEL-1/2/3 ──

test('C-NIVEL-1: principiante → intermedio con 8 semanas, 6 de 8 con ≥ 2 sesiones y 4 ejercicios ≥ 10 %', () => {
  const S = nuevoS({ nivel: 1 });
  const ids = ['press-pecho-maquina', 'prensa-piernas', 'jalon-pecho', 'remo-sentado-polea'];
  for (let d = 60; d >= 1; d -= 3) hecha(S, d, ids.map(id => ({ id, sets: serie(40 + (60 - d) / 3, 10, 10, 10) })));
  const m = ctx.medidorNivel(S);
  assert.deepEqual(m.criterios.map(c => c.ok), [true, true, true]);
  assert.equal(m.sugerido, 2);
});

test('C-NIVEL-2: intermedio → avanzado pide 12 meses y ninguna zona en B2-B3 en 8 semanas', () => {
  const S = nuevoS({ nivel: 2 });
  hecha(S, 300, [{ id: 'press-pecho-maquina', sets: serie(40, 10, 10) }]);
  const m = ctx.medidorNivel(S);
  assert.match(m.criterios[0].que, /12 meses/);
  assert.equal(m.criterios[0].ok, false);
  S.dolor = [{ fecha: dia(10), zona: 'rodilla', dolor: 5, momento: 'dia' }];
  assert.equal(ctx.medidorNivel(S).criterios[3].ok, false);
});

// ── C-ANA-3/4/5/6 · Tendencias con un mínimo de datos ──

test('C-ANA-3: peso con ≥ 4 medidas en 35 días y ≥ 21 días de margen; «no baja» > −0,2 kg', () => {
  const S = nuevoS({ objetivos: ['perder'] });
  S.medidas = [[30, 80], [22, 80.2], [10, 80.1], [1, 80]].map(([d, p]) => ({ fecha: dia(d), peso: p }));
  const t = ctx.tendencias(S).peso;
  assert.equal(t.suficiente, true);
  assert.equal(t.noBaja, true);
  S.medidas = [[30, 81], [22, 80.8], [10, 80.4], [1, 80.2]].map(([d, p]) => ({ fecha: dia(d), peso: p }));
  assert.equal(ctx.tendencias(S).peso.noBaja, false);
  S.medidas = [[15, 81], [10, 80.8], [5, 80.4], [1, 80.2]].map(([d, p]) => ({ fecha: dia(d), peso: p }));
  assert.equal(ctx.tendencias(S).peso.suficiente, false, 'solo 14 días');
});

test('C-ANA-3/4: el cardio extra pide datos suficientes y constancia ≥ 75 %; si la cintura baja ≥ 1 cm, no se añade', () => {
  fijarFecha('2026-11-18T10:00');
  const S = nuevoS({ objetivos: ['perder'], disponibilidad: { dias: 3, minutos: 60, diasSemana: [] } });
  S.medidas = [[30, 80], [22, 80.2], [10, 80.1], [1, 80]].map(([d, p]) => ({ fecha: dia(d), peso: p }));
  assert.equal(ctxPlan().ajustesPorTendencia(S).cardioExtra, 0, 'sin sesiones: constancia desconocida');
  for (let w = 5; w >= 1; w--) for (const d of [0, 2, 4]) hecha(S, 0, [{ id: 'remo-sentado-polea', sets: serie(40, 10, 10) }], { cuando: new Date(new Date('2026-11-16T18:00').getTime() - w * 7 * 864e5 + d * 864e5) });
  assert.equal(ctxPlan().ajustesPorTendencia(S).cardioExtra, 5);
  S.medidas.push({ fecha: dia(25), cintura: 90 }, { fecha: dia(1), cintura: 88.5 });
  assert.equal(ctxPlan().ajustesPorTendencia(S).cardioExtra, 0);
});

test('C-ANA-5: tendencia del dolor con ≥ 3 registros en cada mitad; «sube» = +1 y el último ≥ la media', () => {
  const r = (ds, vs) => ds.map((d, i) => ({ fecha: dia(d), zona: 'rodilla', dolor: vs[i] }));
  assert.equal(prog.tendenciaDolor(r([20, 2], [3, 4])).tendencia, 'sin datos');
  assert.equal(prog.tendenciaDolor(r([25, 20, 16, 10, 5, 1], [2, 2, 2, 3, 3, 4])).tendencia, 'sube');
  assert.equal(prog.tendenciaDolor(r([25, 20, 16, 10, 5, 1], [2, 2, 2, 4, 4, 2])).tendencia, 'igual', 'el último por debajo de la media');
  assert.equal(prog.tendenciaDolor(r([25, 20, 16, 10, 5, 1], [4, 4, 4, 2, 2, 2])).tendencia, 'baja');
});

test('C-ANA-5: «qué ejercicios coinciden con subidas» pide ≥ 3 sesiones con el ejercicio', () => {
  const S = nuevoS();
  S.dolor = [{ fecha: dia(1), zona: 'rodilla', dolor: 5, momento: 'despues' }];
  const sube = { checkin: { energia: 3, dolor: { rodilla: 2 } }, cierre: { esfuerzo: 3, dolor: { rodilla: 5 } } };
  hecha(S, 8, [{ id: 'prensa-piernas', sets: serie(80, 10) }], sube);
  hecha(S, 4, [{ id: 'prensa-piernas', sets: serie(80, 10) }], sube);
  assert.deepEqual(A.dolor(S)[0].sospechosos, []);
  hecha(S, 1, [{ id: 'prensa-piernas', sets: serie(80, 10) }], sube);
  assert.deepEqual(A.dolor(S)[0].sospechosos.map(x => x.id), ['prensa-piernas']);
});

test('C-ANA-6: perder más de un 1 % por semana durante 3 semanas da el aviso de priorizar la fuerza', () => {
  const S = nuevoS({ objetivos: ['perder'] });
  S.medidas = [[24, 90], [17, 88.5], [8, 86.5], [1, 85.5]].map(([d, p]) => ({ fecha: dia(d), peso: p }));
  assert.equal(ctx.tendencias(S).perdidaRapida, true);
  assert.ok(ctxPlan().ajustesPorTendencia(S).notas.some(n => /prioriza la fuerza/.test(n)));
});

test('C-ANA-7: la primera semana de uso no cuenta como incumplida', () => {
  fijarFecha('2026-11-18T10:00');
  const S = nuevoS({ disponibilidad: { dias: 3, minutos: 60, diasSemana: [] } });
  // Empezó el sábado de la semana pasada (1 sesión) y esta semana va bien.
  sesionDia(S, '2026-11-14T18:00');
  assert.equal(A.constancia(S).cumplimiento, null);
  assert.equal(ctx.tendencias(S).constancia, null);
  // Con una semana completa cerrada después, ya cuenta solo esa.
  fijarFecha('2026-11-25T10:00');
  for (const f of ['2026-11-16T18:00', '2026-11-18T18:00', '2026-11-20T18:00']) sesionDia(S, f);
  assert.equal(A.constancia(S).cumplimiento, 100);
});

function sesionDia(S, f) { return hecha(S, 0, [{ id: 'remo-sentado-polea', sets: serie(40, 10) }], { cuando: new Date(f) }); }
function ctxPlan() { return planMod; }
const planMod = await import('./ayuda/comun.mjs').then(m => import(m.modulo('js/areas/entrenador/plan.js')));
