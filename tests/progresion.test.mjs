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

test('paso() según el material y el peso (C-PROG-3)', () => {
  assert.equal(paso(cat.ex('curl-mancuernas'), 8), 1);
  assert.equal(paso(cat.ex('curl-mancuernas'), 12), 2);
  assert.equal(paso(cat.ex('press-pecho-maquina'), 40), 2.5);
  assert.equal(paso(cat.ex('prensa-piernas'), 100), 2.5, 'máquina: la placa más pequeña, pese lo que pese');
  assert.equal(paso(cat.ex('press-banca-barra'), 80), 2.5);
  assert.equal(paso(cat.ex('press-banca-barra'), 82.5), 5);
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

test('sugerir: energía ≤ 2 → no sube; mismo peso (C-REC-3, C-ENERGIA-1)', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }]);
  for (const energia of [1, 2]) {
    const s = sugerir(S, 'press-pecho-maquina', B, { energia });
    assert.equal(s.tipo, 'igual', s.motivo);
    assert.equal(s.kg, 40);
    assert.match(s.motivo, /poca energía/);
  }
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

test('acotarKg sin historial no toca los kilos; con historial no deja bajar del 50 % (C-PROG-5)', () => {
  const S = nuevoS();
  assert.equal(acotarKg(S, 'curl-mancuernas', 12), 12);
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12]] }]);
  assert.equal(acotarKg(S, 'press-pecho-maquina', 10), 20);
  assert.equal(acotarKg(S, 'press-pecho-maquina', 40), 40);
});

// ── Fallos demostrados por la auditoría, cerrados en el PR 10 ──

test('«estancado» cuenta también las repeticiones: 8-8-8 → 9-9-8 → 10-10-9 con el mismo peso no es estancado (C-PROG-8)', () => {
  const S = nuevoS();
  hecha(S, 7, [{ id: 'press-pecho-maquina', sets: [[40, 8], [40, 8], [40, 8]] }]);
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 9], [40, 9], [40, 8]] }]);
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: [[40, 10], [40, 10], [40, 9]] }]);
  const a = ctx.analizarEjercicios(S)['press-pecho-maquina'];
  assert.equal(a.estancado, false);
  assert.notEqual(a.estado, 'estancado');
});

test('recuperación: en un L-X-V, el miércoles (47 h) el pecho ya puede subir (C-REC-1, C-REC-2)', () => {
  const S = nuevoS();
  hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }], { cuando: new Date(Date.now() - 47 * 3600e3) });
  const s = sugerir(S, 'press-pecho-maquina', B);
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('recuperación: plan L-X-V cuerpo completo deja subir el miércoles (C-REC-2: «parcial» no frena)', () => {
  const S = nuevoS({ nivel: 2 }); // en principiante, las 4 primeras semanas cuentan 60 h (×1,25)
  const ejs = [
    { id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] },
    { id: 'prensa-piernas', sets: [[80, 12], [80, 12], [80, 12]] },
    { id: 'jalon-pecho', sets: [[35, 12], [35, 12], [35, 12]] },
  ];
  hecha(S, 0, ejs, { cuando: new Date(Date.now() - 47 * 3600e3) });
  const carga = cargaMuscular(S);
  // A las 47 h los grandes están «parciales» (menos de 48 h), nunca «cargados»; y «parcial» deja subir.
  assert.deepEqual(['pecho', 'cuadriceps', 'espalda'].filter(m => carga[m] && carga[m].estado === 'cargado'), []);
  assert.equal(carga.pecho.rec, 48);
  for (const x of ejs) assert.equal(sugerir(S, x.id, B, { carga }).tipo, 'sube', x.id);
});

test('lesión activa con dolor 1/10 estable no impide progresar (C-PROG-7, C-DOLOR-2)', () => {
  // Crónica (desde hace 8 meses): sin «desde» contaría como nueva (C-LES-6) y sí frenaría.
  const S = nuevoS({ lesiones: [{ id: 'h', zona: 'hombro', dolor: 1, activa: true, desde: est.hoyISO(new Date(Date.now() - 240 * 864e5)) }] });
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12], [40, 12], [40, 12]] }]);
  const s = sugerir(S, 'press-pecho-maquina', B, { niveles: cat.nivelesZona(S.perfil) });
  assert.equal(s.tipo, 'sube', s.motivo);
});

test('tope de kilos de la IA: como mucho el último peso más un paso (C-PROG-5)', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'curl-polea', sets: [[10, 10]] }]);
  assert.ok(acotarKg(S, 'curl-polea', 999) <= 12.5, `acotarKg = ${acotarKg(S, 'curl-polea', 999)}`);
});

test('acotarKg no devuelve NaN (C-PROG-5)', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'press-pecho-maquina', sets: [[40, 12]] }]);
  const kg = acotarKg(S, 'press-pecho-maquina', NaN);
  assert.ok(kg === null || Number.isFinite(kg), `acotarKg(NaN) = ${kg}`);
});

test('pasos de peso sobre el valor real: prensa 82,5 kg al tope sube a 85, no a 90 (C-PROG-3)', () => {
  // La auditoría esperaba 87,5 (paso de 5 por encima de 80 kg); el criterio aprobado fija para máquina la
  // placa más pequeña, 2,5 kg, pese lo que pese. Lo que se prueba es que se suma al valor real sin redondear.
  const S = nuevoS();
  hecha(S, 5, [{ id: 'prensa-piernas', sets: [[82.5, 12], [82.5, 12], [82.5, 12]] }]);
  assert.equal(sugerir(S, 'prensa-piernas', B).kg, 85);
  const S2 = nuevoS();
  hecha(S2, 5, [{ id: 'press-banca-barra', sets: [[82.5, 12], [82.5, 12], [82.5, 12]] }]);
  assert.equal(sugerir(S2, 'press-banca-barra', B).kg, 87.5, 'barra > 80 kg: paso de 5');
});

test('«baja» de verdad baja: mancuernas de 4 kg con dos sesiones cortas (C-PROG-6, H-2)', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'curl-mancuernas', sets: [[4, 5], [4, 5], [4, 5]] }]);
  hecha(S, 9, [{ id: 'curl-mancuernas', sets: [[4, 5], [4, 5]] }]);
  const s = sugerir(S, 'curl-mancuernas', B);
  assert.equal(s.tipo, 'baja');
  assert.equal(s.kg, 3);
});

test('asistidas: quitar la última ayuda no deja 0 kg (que el modelo convierte en «sin dato»)', () => {
  const S = nuevoS();
  hecha(S, 5, [{ id: 'dominadas-asistidas-maquina', sets: [[2.5, 12], [2.5, 12], [2.5, 12]] }]);
  const s = sugerir(S, 'dominadas-asistidas-maquina', B);
  assert.notEqual(s.kg, 0);
});

test('progresión sin kilos parte de lo último hecho: plancha de 120 s no vuelve a 45-50 s (C-PROG-9)', () => {
  const S = nuevoS();
  for (const [d, v] of [[20, 45], [15, 60], [10, 90], [5, 120]]) hecha(S, d, [{ id: 'plancha', sets: [[null, v], [null, v], [null, v]] }]);
  const s = sugerir(S, 'plancha', { series: 3, reps: '30-45s' });
  assert.ok(rango(s.reps).lo >= 120, `reps = ${s.reps}`);
});

test('vuelta tras 12 semanas sin hacerlo: bajada más prudente que un 10 % (C-PARON-1)', () => {
  const S = nuevoS();
  hecha(S, 84, [{ id: 'prensa-piernas', sets: [[100, 12], [100, 12], [100, 12]] }]);
  const s = sugerir(S, 'prensa-piernas', B);
  assert.ok(s.kg <= 80, `kg = ${s.kg}`);
});

test('«molesta» entiende negaciones: «Sin dolor, muy bien» no es una molestia (C-ANA-2)', () => {
  for (const t of ['Sin dolor, muy bien', 'no me molestó nada la rodilla', 'me encanta, nada de dolor']) {
    assert.ok(!ctx.leerComentario(t).includes('molestia'), t);
  }
});

test('tendencia de peso con un mínimo de datos: dos pesadas en 3 días no dan ritmo semanal (C-ANA-3)', async () => {
  const { salud } = await import('./ayuda/node.mjs').then(m => m.analisis);
  const S = nuevoS({ objetivos: ['perder'], datos: { sexo: 'h', altura: 175 } });
  S.medidas = [{ fecha: est.hoyISO(new Date(Date.now() - 3 * 864e5)), peso: 80 }, { fecha: est.hoyISO(), peso: 79 }];
  const t = salud(S).peso.tendencia;
  assert.ok(t == null || t.porSemana == null, JSON.stringify(t));
});

const N_FUZZ = +process.env.FUZZ_N || 2500; // FUZZ_N=20000 para la prueba larga del plan
test(`fuzz con semilla de ${N_FUZZ} historiales: sin NaN, negativos, saltos de más de un paso ni subidas tras fallar`, () => {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const elige = a => a[Math.floor(azar() * a.length)];
  const ids = ['press-pecho-maquina', 'curl-mancuernas', 'prensa-piernas', 'dominadas-asistidas-maquina', 'sentadilla-goblet', 'hip-thrust', 'elevaciones-laterales', 'press-banca-barra', 'flexiones', 'plancha', 'crol'];
  const malos = [], cuenta = {};
  const reloj = fijarFecha('2026-11-19T10:00');
  try {
    for (let i = 0; i < N_FUZZ; i++) {
      const S = nuevoS({ nivel: elige([1, 2, 3]) });
      if (azar() < 0.2) S.perfil.lesiones = [{ id: 'l', zona: elige(['hombro', 'rodilla', 'lumbar']), dolor: elige([0, 1, 3, 5]), activa: true, desde: elige(['', '2026-01-01', '2026-11-01']) }];
      const id = elige(ids);
      const e = cat.ex(id);
      const base = e.t === 'reps' ? elige([{ series: 3, reps: '8-12' }, { series: 4, reps: '4-6' }, { series: 2, reps: '12-15' }]) : { series: e.d[0], reps: e.d[1] };
      const r = rango(base.reps);
      // Historial de 1 a 5 sesiones, de la más antigua a la más reciente, con huecos variados (incluidos parones).
      let dias = elige([2, 5, 10, 20, 35, 60, 100]);
      const n = elige([1, 2, 3, 4, 5]);
      for (let k = 0; k < n; k++) {
        const kg = elige([null, 0, 1, 2, 2.5, 4, 7.5, 10, 12.5, 20, 40, 82.5, '12,5', 'abc']);
        // 4 de cada 10 sesiones, limpias y al tope (para que haya muchas subidas que comprobar).
        const limpia = azar() < 0.4;
        const sets = limpia ? Array.from({ length: base.series }, () => [kg, elige([r.hi, r.hi + 2])])
          : Array.from({ length: elige([1, 2, 3, 4]) }, () => [kg, elige([r.lo - 3, r.lo, r.hi - 1, r.hi, r.hi + 3, '', '8-10', '1:30']), azar() > 0.15]);
        hecha(S, dias, [{ id, sets }],
          { cierre: { esfuerzo: elige([2, 3, 4, 5]), dolor: azar() < 0.1 ? { hombro: 6 } : {} }, checkin: { energia: elige([2, 3, 4]), dolor: {} } });
        dias = Math.max(0, dias - elige([2, 3, 4, 7, 15]));
      }
      const ctxS = { energia: elige([1, 2, 3, 4, 5]), dolorHoy: azar() < 0.1 ? { hombro: elige([2, 5, 8]) } : {} };
      const sg = sugerir(S, id, base, ctxS);
      cuenta[sg.tipo] = (cuenta[sg.tipo] || 0) + 1;
      const regs = registros(S, id);
      const ult = regs[regs.length - 1];
      if (!ult) continue;
      const tag = `#${i} ${id}`;
      if (sg.kg != null && (!Number.isFinite(sg.kg) || sg.kg <= 0)) malos.push(`${tag}: kg ${sg.kg}`);
      if (!Number.isInteger(sg.series) || sg.series < 1) malos.push(`${tag}: series ${sg.series}`);
      if (/NaN|undefined|Infinity|null/.test(sg.motivo + sg.reps)) malos.push(`${tag}: texto «${sg.motivo}» «${sg.reps}»`);
      const kgs = ult.sets.filter(z => z.kg).map(z => z.kg);
      const asist = prog.esAsistida(e);
      const ref = kgs.length ? (asist ? Math.min(...kgs) : Math.max(...kgs)) : null;
      if (sg.tipo === 'sube' && ref != null) {
        const top = ult.sets.filter(z => z.kg === ref).map(z => valor(z.txt, r.u));
        if (ult.sets.length < base.series) malos.push(`${tag}: sube con ${ult.sets.length}/${base.series} series`);
        if (top.some(v => v == null || v < r.hi)) malos.push(`${tag}: sube tras fallar (${prog.resumen(ult)})`);
        if (!asist && sg.kg - ref > paso(e, ref) + 1e-9) malos.push(`${tag}: sube más de un paso (${ref} → ${sg.kg})`);
      }
      if (sg.tipo === 'baja' && ref != null && sg.kg != null && (asist ? sg.kg <= ref : sg.kg >= ref)) malos.push(`${tag}: «baja» que no baja (${ref} → ${sg.kg})`);
      const ia = acotarKg(S, id, elige([NaN, -5, 0, 1, 50, 999, '30', null]), ctxS);
      if (ia != null && (!Number.isFinite(ia) || ia < 0)) malos.push(`${tag}: acotarKg ${ia}`);
      if (ia != null && ref != null && !asist && ia > ref + paso(e, ref) + 1e-9) malos.push(`${tag}: la IA pasa del tope (${ref} → ${ia})`);
    }
  } finally { reloj.restaurar(); }
  assert.deepEqual(malos.slice(0, 5), []);
  assert.ok(cuenta.sube > N_FUZZ / 50 && cuenta.baja > N_FUZZ / 50, `pocas subidas o bajadas que comprobar: ${JSON.stringify(cuenta)}`);
});
