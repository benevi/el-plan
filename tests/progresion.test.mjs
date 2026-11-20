// Progresión (js/reglas/progresion.js y analizarEjercicios de contexto.js).
// Las pruebas con `todo` reproducen fallos de la auditoría que arregla el PR 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { prog, ctx, nuevoS, hecha, cat, est } from './ayuda/node.mjs';

const { rango, textoRango, valor, paso, sugerir, acotarKg, cargaMuscular, registros } = prog;
const B = { series: 3, reps: '8-12' };

// ── Lo que ya funciona ──

test('rango() entiende los formatos del catálogo', () => {
  assert.deepEqual(rango('8-12'), { lo: 8, hi: 12, u: '', resto: '' });
  assert.deepEqual(rango('12 c/pierna'), { lo: 12, hi: 12, u: '', resto: ' c/pierna' });
  assert.deepEqual(rango('30-45s'), { lo: 30, hi: 45, u: 's', resto: '' });
  assert.deepEqual(rango('25 m'), { lo: 25, hi: 25, u: 'm', resto: '' });
  assert.deepEqual(rango('10-20 min'), { lo: 10, hi: 20, u: 'min', resto: '' });
  assert.deepEqual(rango('8,5-10'), { lo: 8.5, hi: 10, u: '', resto: '' });
  assert.deepEqual(rango('20-30s c/lado'), { lo: 20, hi: 30, u: 's', resto: ' c/lado' });
  assert.equal(rango('AMRAP'), null);
  assert.equal(rango(''), null);
  assert.equal(rango(null), null);
});

test('textoRango() es la inversa de rango() para los formatos del catálogo', () => {
  for (const t of ['8-12', '12 c/pierna', '30-45s', '25 m', '10-20 min', '20-30s c/lado', '1 min']) assert.equal(textoRango(rango(t)), t);
});

test('rango() reconoce todas las dosis del catálogo', () => {
  const sinRango = cat.EJERCICIOS.filter(e => !rango(e.d[1])).map(e => e.id);
  assert.deepEqual(sinRango, []);
});

test('valor() convierte lo apuntado a la unidad del rango', () => {
  assert.equal(valor('12', ''), 12);
  assert.equal(valor('12,5', ''), 12.5);
  assert.equal(valor('1:30', 's'), 90);
  assert.equal(valor('1:30', 'min'), 1.5);
  assert.equal(valor('2 min', 's'), 120);
  assert.equal(valor('40s', 's'), 40);
  assert.equal(valor('', ''), null);
  assert.equal(valor(null, ''), null);
  assert.equal(valor('doce', ''), null);
});

test('paso() según el material y el peso', () => {
  assert.equal(paso(cat.ex('curl-mancuernas'), 8), 1);
  assert.equal(paso(cat.ex('curl-mancuernas'), 12), 2);
  assert.equal(paso(cat.ex('press-pecho-maquina'), 40), 2.5);
  assert.equal(paso(cat.ex('prensa-piernas'), 100), 5);
});

test('sugerir: primera vez → «nuevo» con consejo para elegir peso', () => {
  const S = nuevoS();
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'nuevo');
  assert.equal(s.kg, null);
  assert.match(s.motivo, /Primera vez/);
});

test('sugerir: al tope en todas las series y recuperado → sube un paso', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }]);
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'sube');
  assert.equal(s.kg, 42.5);
});

test('sugerir: sin llegar al tope → mismo peso', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 10], [40, 9], [40, 9]] }]);
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'igual');
  assert.equal(s.kg, 40);
});

test('sugerir: energía 1 → baja un 10 %', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }]);
  const s = sugerir(S, 'press-pecho-maquina', B, { energia: 1 });
  assert.equal(s.tipo, 'baja');
  assert.ok(s.kg < 40);
});

test('sugerir: el dolor subió tras la última sesión → no sube', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }], { checkin: { energia: 3, dolor: { hombro: 2 } }, cierre: { esfuerzo: 3, dolor: { hombro: 6 } } });
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.notEqual(s.tipo, 'sube');
  assert.equal(s.kg, 40);
});

test('sugerir sin kilos: plancha al tope sube el tiempo', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'plancha', sets: [[null, '45'], [null, '45'], [null, '45']] }]);
  const s = sugerir(S, 'plancha', { series: 3, reps: '30-45s' });
  assert.equal(s.tipo, 'sube');
  assert.equal(s.reps, '45-50s');
});

test('sugerir en distancia: largos completos → una serie más', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'crol', sets: [[null, '25'], [null, '25'], [null, '25'], [null, '25']] }]);
  const s = sugerir(S, 'crol', { series: 4, reps: '25 m' });
  assert.equal(s.tipo, 'series');
  assert.equal(s.series, 5);
});

test('registros ignora series no hechas y vacías', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, '', false], [null, '']] }]);
  const r = registros(S, 'press-pecho-maquina');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].sets, [{ kg: 40, txt: '12' }]);
});

test('acotarKg sin historial no toca los kilos; con historial no deja bajar de un 70 %', () => {
  const S = nuevoS();
  assert.equal(acotarKg(S, 'curl-mancuernas', 12), 12);
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12]] }]);
  assert.equal(acotarKg(S, 'press-pecho-maquina', 10), 27.5);
  assert.equal(acotarKg(S, 'press-pecho-maquina', 40), 40);
});

// ── Fallos demostrados por la auditoría (PR 10) ──

test('«estancado» cuenta también las repeticiones: 8-8-8 → 9-9-8 → 10-10-9 con el mismo peso no es estancado', { todo: 'PR 10: estancado = 4 sesiones sin subir kilos ni repeticiones totales' }, () => {
  const S = nuevoS();
  hecha(S, 7, [{ id: 'press-pecho-maquina', sets: [[40, 8], [40, 8], [40, 8]] }]);
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 9], [40, 9], [40, 8]] }]);
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: [[40, 10], [40, 10], [40, 9]] }]);
  const a = ctx.analizarEjercicios(S)['press-pecho-maquina'];
  assert.equal(a.estancado, false);
  assert.notEqual(a.estado, 'estancado');
});

test('recuperación: en un L-X-V, el miércoles (47 h) el pecho ya puede subir', { todo: 'PR 10: 48 h para músculos grandes; «parcial» deja de frenar' }, () => {
  const S = nuevoS();
  hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }], { cuando: new Date(Date.now() - 47 * 3600e3) });
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('recuperación: plan L-X-V cuerpo completo deja subir algo el miércoles', { todo: 'PR 10: la recuperación de 72 h frena todo el plan L-X-V' }, () => {
  const S = nuevoS();
  hecha(S, 0, [
    { id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] },
    { id: 'prensa-piernas', sets: [[80, 12], [80, 12], [80, 12]] },
    { id: 'jalon-pecho', sets: [[35, 12], [35, 12], [35, 12]] },
  ], { cuando: new Date(Date.now() - 47 * 3600e3) });
  const carga = cargaMuscular(S);
  const frenados = ['pecho', 'cuadriceps', 'espalda'].filter(m => carga[m] && carga[m].estado !== 'fresco');
  assert.deepEqual(frenados, []);
});

test('lesión activa con dolor 1/10 no impide progresar para siempre', { todo: 'PR 10: el freno por lesión solo actúa con dolor ≥ 4 o si el dolor subió' }, () => {
  const S = nuevoS({ lesiones: [{ id: 'h', zona: 'hombro', dolor: 1, activa: true }] });
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }]);
  const s = sugerir(S, 'press-pecho-maquina', B, { niveles: cat.nivelesZona(S.perfil) });
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('tope de kilos de la IA: como mucho el último peso más un paso', { todo: 'PR 10: tope de kilos para la IA = último peso + 1 paso' }, () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'curl-polea', sets: [[10, 10]] }]);
  assert.ok(acotarKg(S, 'curl-polea', 999) <= 12.5, `acotarKg = ${acotarKg(S, 'curl-polea', 999)}`);
});

test('acotarKg no devuelve NaN', { todo: 'PR 10: kilos de la IA no numéricos' }, () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12]] }]);
  const kg = acotarKg(S, 'press-pecho-maquina', NaN);
  assert.ok(kg === null || Number.isFinite(kg), `acotarKg(NaN) = ${kg}`);
});

test('pasos de peso sobre el valor real: prensa 82,5 kg al tope sube a 87,5, no a 90', { todo: 'PR 10: redondeos de los pasos de peso' }, () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'prensa-piernas', sets: [[82.5, 12], [82.5, 12], [82.5, 12]] }]);
  assert.equal(sugerir(S, 'prensa-piernas', B).kg, 87.5);
});

test('«baja» de verdad baja: mancuernas de 4 kg con dos sesiones cortas', { todo: 'PR 10: «baja» que no baja con pesos pequeños' }, () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'curl-mancuernas', sets: [[4, 5], [4, 5], [4, 5]] }]);
  hecha(S, 9, [{ id: 'curl-mancuernas', sets: [[4, 5], [4, 5]] }]);
  const s = sugerir(S, 'curl-mancuernas', B);
  assert.equal(s.tipo, 'baja');
  assert.ok(s.kg < 4, `kg = ${s.kg}`);
});

test('asistidas: quitar la última ayuda no deja 0 kg (que el modelo convierte en «sin dato»)', { todo: 'PR 10: asistida con 2,5 kg de ayuda sube a 0 kg' }, () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'dominadas-asistidas-maquina', sets: [[2.5, 12], [2.5, 12], [2.5, 12]] }]);
  const s = sugerir(S, 'dominadas-asistidas-maquina', B);
  assert.notEqual(s.kg, 0);
});

test('progresión sin kilos parte de lo último hecho: plancha de 120 s no vuelve a 45-50 s', { todo: 'PR 10: progresión sin kilos que parte de lo último hecho' }, () => {
  const S = nuevoS();
  for (const [d, v] of [[20, 45], [15, 60], [10, 90], [5, 120]]) hecha(S, d, [{ id: 'plancha', sets: [[null, v], [null, v], [null, v]] }]);
  const s = sugerir(S, 'plancha', { series: 3, reps: '30-45s' });
  assert.ok(rango(s.reps).lo >= 120, `reps = ${s.reps}`);
});

test('vuelta tras 12 semanas sin hacerlo: bajada más prudente que un 10 %', { todo: 'PR 10: vuelta tras un parón más prudente' }, () => {
  const S = nuevoS();
  hecha(S, 84, [{ id: 'prensa-piernas', sets: [[100, 12], [100, 12], [100, 12]] }]);
  const s = sugerir(S, 'prensa-piernas', B);
  assert.ok(s.kg <= 80, `kg = ${s.kg}`);
});

test('«molesta» entiende negaciones: «Sin dolor, muy bien» no es una molestia', { todo: 'PR 10: falsas alarmas de molestia' }, () => {
  for (const t of ['Sin dolor, muy bien', 'no me molestó nada la rodilla', 'me encanta, nada de dolor']) {
    assert.ok(!ctx.leerComentario(t).includes('molestia'), t);
  }
});

test('tendencia de peso con un mínimo de datos: dos pesadas en 3 días no dan ritmo semanal', { todo: 'PR 10: tendencias con un mínimo de datos' }, async () => {
  const { salud } = await import('./ayuda/node.mjs').then(m => m.analisis);
  const S = nuevoS({ objetivos: ['perder'], datos: { sexo: 'h', altura: 175 } });
  S.medidas = [{ fecha: est.hoyISO(new Date(Date.now() - 3 * 864e5)), peso: 80 }, { fecha: est.hoyISO(), peso: 79 }];
  const t = salud(S).peso.tendencia;
  assert.ok(t == null || t.porSemana == null, JSON.stringify(t));
});

test('fuzz de 2000 historiales: sin kilos NaN, negativos ni subidas tras fallar', { todo: 'PR 10: fuzz de progresión (la auditoría usó 20 000)' }, () => {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const elige = a => a[Math.floor(azar() * a.length)];
  const ids = ['press-pecho-maquina', 'curl-mancuernas', 'prensa-piernas', 'dominadas-asistidas-maquina', 'sentadilla-goblet', 'hip-thrust', 'elevaciones-laterales'];
  const malos = [];
  const reloj = fijarFecha('2026-11-19T10:00');
  try {
    for (let i = 0; i < 2000; i++) {
      const S = nuevoS();
      const id = elige(ids);
      const base = elige([{ series: 3, reps: '8-12' }, { series: 4, reps: '4-6' }, { series: 2, reps: '12-15' }]);
      const r = rango(base.reps);
      hecha(S, 5, [{ id, sets: Array.from({ length: elige([1, 2, 3, 4]) }, () => [elige([null, 0, 1, 2, 2.5, 4, 7.5, 10, 12.5, 20, 40, 82.5, '12,5']), elige([r.lo - 3, r.lo, r.hi - 1, r.hi, r.hi + 3, '', '8-10']), azar() > 0.15]) }], { cierre: { esfuerzo: elige([2, 3, 4]) } });
      const sg = sugerir(S, id, base, { energia: elige([2, 3, 4, 5]) });
      const ult = registros(S, id).pop();
      if (!ult) continue;
      if (sg.kg != null && (!Number.isFinite(sg.kg) || sg.kg <= 0)) malos.push(`${id}: kg ${sg.kg}`);
      if (/NaN|undefined|Infinity/.test(sg.motivo + sg.reps)) malos.push(`${id}: texto «${sg.motivo}»`);
      const kgs = ult.sets.filter(z => z.kg).map(z => z.kg);
      const mx = kgs.length ? Math.max(...kgs) : null;
      if (sg.tipo === 'sube' && mx && ult.sets.length < base.series) malos.push(`${id}: sube con ${ult.sets.length}/${base.series} series`);
    }
  } finally { reloj.restaurar(); }
  assert.deepEqual(malos.slice(0, 5), []);
});
