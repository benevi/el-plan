// Re-auditoría del PR 18 (salud, IA y código): una prueba por hallazgo arreglado, con el id del informe y el
// de docs/criterio.md. Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, modelo, lesiones } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
const CRONICA = '2025-01-01';
const L = (zona, dolor, o = {}) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: CRONICA, tipo: 'lesion', ...o });
const ci = (o = {}) => ({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', ...o });
const sesionHoy = (S, dia, c) => modelo.crearSesion(ent.ajustarAlCheckin(S, dia, c).datos);

// ── S1 · la rehabilitación de una fase que hoy no toca (C-DOLOR-1, C-DOSIS-7, C-ZONA-0) ──
const faseHoy = d => (d >= 4 ? 1 : d >= 1 ? 2 : 3);
const CASOS_S1 = [
  ['cervical', 0, 6, 'gym', 'recurrente'], ['dorsal', 0, 5, 'gym', 'lesion'], ['tobillo_pie', 0, 6, 'casa', 'lesion'],
  ['hombro', 0, 6, 'gym', 'lesion'], ['rodilla', 0, 5, 'gym', 'lesion'], ['lumbar', 0, 6, 'gym', 'lesion'], ['codo', 0, 6, 'gym', 'lesion'],
  ['cadera_lateral', 0, 5, 'gym', 'lesion'], ['rodilla', 3, 6, 'gym', 'lesion'], ['hombro', 2, 5, 'gym', 'lesion'], ['muñeca', 0, 4, 'gym', 'lesion'],
];
for (const [z, ficha, hoy, lugar, tipo] of CASOS_S1) {
  test(`S1, C-DOLOR-1: ${z} con ficha ${ficha} y hoy ${hoy} en ${lugar}: la rehabilitación del día del plan baja a la fase ${faseHoy(hoy)}`, () => {
    const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: [lugar], materialCasa: ['banda', 'mancuernas'] });
    S.perfil.lesiones.push(L(z, ficha, { tipo }));
    const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: [lugar] });
    const dia = plan.dias.find(d => d.ejercicios.some(x => x.rol === 'rehab'));
    assert.ok(dia, 'el plan lleva rehabilitación');
    const c = ci({ lugar, dolorHoy: { [z]: hoy } });
    const s = sesionHoy(S, dia, c);
    const rehab = s.ejercicios.filter(x => x.rol === 'rehab');
    assert.ok(rehab.length >= 1, 'una zona en B2 siempre lleva rehabilitación');
    for (const x of rehab) assert.ok(lesiones.fasesDe(cat.ex(x.id), z).some(f => f <= faseHoy(hoy)), `${x.id} es de fase ${lesiones.fasesDe(cat.ex(x.id), z)}`);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  });
}
test('S1: el validador no da por buena una rehabilitación de fase 3 con la zona a 6/10 (también la de la IA)', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2 });
  S.perfil.lesiones.push(L('codo', 0));
  const c = ci({ dolorHoy: { codo: 6 } });
  const s = { lugar: 'gym', minutos: 60, explicacion: ['x'], calentamiento: [], vuelta: [], ejercicios: [{ id: 'remo-maquina', rol: 'rehab', series: 3, reps: '8-12', descanso: 60 }] };
  assert.ok(ent.problemasSesion(S, s, c).some(p => /remo-maquina no es rehabilitación válida hoy/.test(p)));
  const v = ent.validarSesion(S, s, { ...c, origen: 'ia' });
  assert.ok(!v.sesion.ejercicios.some(x => x.id === 'remo-maquina' && x.rol === 'rehab'));
  assert.ok(v.cambios.some(t => /toca la fase 1/.test(t)), v.cambios.join(' | '));
  assert.ok(v.valida);
});

// ── S2, S6 · movilidad y estiramientos de la zona dolorida según su ficha (C-EST-2, C-DOLOR-4, C-EST-4) ──
const ZONAS_FICHA = ['cadera_lateral', 'rodilla', 'tobillo_pie', 'lumbar', 'hombro', 'codo', 'muñeca', 'cervical', 'dorsal'];
const tareas = s => [...s.calentamiento, ...s.vuelta];
// Las tareas de la ficha de z (por id o por texto) con uso «normal» no salen con esa zona en B2 o B3.
const normalesDe = z => ['calentar', 'estirar'].flatMap(t => lesiones.ZONAS[z].tareas[t]).filter(t => t.uso === 'normal');
const esDeLista = (t, l) => l.some(f => (f.id ? f.id === t.id : f.texto === t.nombre));
for (const z of ZONAS_FICHA) {
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) {
    for (const [dolor, minutos] of [[5, 45], [5, 90], [8, 45], [8, 90]]) {
      test(`S2, C-EST-2: ${z} a ${dolor}/10 en ${lugar} (${minutos} min): nada «normal» de su ficha, estiramientos libres sin riesgo en ella`, () => {
        const S = nuevoS({ objetivos: ['salud'], nivel: 2, lugares: [lugar], materialCasa: ['banda'] });
        S.perfil.lesiones.push(L(z, 2));
        const c = ci({ lugar, minutos, dolorHoy: { [z]: dolor } });
        const s = sesionHoy(S, null, c);
        const mal = tareas(s).filter(t => esDeLista(t, normalesDe(z)));
        assert.deepEqual(mal.map(t => t.id || t.nombre), []);
        assert.ok(!tareas(s).some(t => t.nombre === 'Estiramiento de hombros en el borde') || !['hombro', 'dorsal'].includes(z), 'estiramiento libre de hombro con el hombro dolorido');
        assert.ok(!tareas(s).some(t => t.nombre === 'Estiramiento de pecho de pie') || z !== 'hombro', 'estiramiento libre de pecho con el hombro dolorido');
        assert.ok(!tareas(s).some(t => /^Estiramiento de espalda (de pie|en el borde)$/.test(t.nombre)) || !['lumbar', 'dorsal'].includes(z), 'estiramiento libre de espalda con la espalda dolorida');
        if (dolor >= 7) {
          // En D2, de la zona dolorida como mucho 2 tareas «alivio» de su ficha (C-DOLOR-4).
          const deFicha = ['calentar', 'estirar'].flatMap(t => lesiones.ZONAS[z].tareas[t]);
          assert.ok(tareas(s).filter(t => t.id && esDeLista(t, deFicha)).length <= 2);
        }
        assert.deepEqual(ent.problemasSesion(S, s, c), []);
      });
    }
  }
}
test('S2, CR-02: en el día de dolor alto lumbar sale la descarga 90/90 de su ficha («alivio»)', () => {
  for (const lugar of ['gym', 'casa']) {
    const S = nuevoS({ objetivos: ['salud'], lugares: [lugar] });
    S.perfil.lesiones.push(L('lumbar', 3));
    const s = sesionHoy(S, null, ci({ lugar, minutos: 30, dolorHoy: { lumbar: 8 } }));
    assert.ok(tareas(s).some(t => t.id === 'descarga-90-90'), lugar);
  }
});
test('S2: el validador ve los estiramientos libres sin id que cargan la zona dolorida', () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['calle'] });
  S.perfil.lesiones.push(L('hombro', 2));
  const c = ci({ lugar: 'calle', dolorHoy: { hombro: 5 } });
  const s = sesionHoy(S, null, c);
  s.vuelta.unshift({ nombre: 'Estiramiento de pecho de pie', detalle: 'x', duracion: '1 min' });
  assert.ok(ent.problemasSesion(S, s, c).some(p => /Estiramiento de pecho de pie/.test(p)));
});
test('S6, C-CAL-2: la activación de la ficha va con su id y el validador la comprueba', () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  S.perfil.lesiones.push(L('rodilla', 2));
  const s = sesionHoy(S, null, ci({ minutos: 60, dolorHoy: { rodilla: 2 } }));
  const act = s.calentamiento.find(t => /Activación/.test(t.detalle || ''));
  assert.ok(act && act.id === 'extension-rodilla-isometrica', JSON.stringify(s.calentamiento));
  // En la calle no se hace (no tiene «calle»): el validador la quita.
  const c = ci({ lugar: 'calle', dolorHoy: { rodilla: 2 } });
  const s2 = sesionHoy(nuevoS({ objetivos: ['musculo'], lugares: ['calle'], lesiones: [L('rodilla', 2)] }), null, c);
  assert.ok(!tareas(s2).some(t => t.id === 'extension-rodilla-isometrica' || t.nombre === 'Cuádriceps isométrico sentado'));
});
test('S6: el estiramiento de pectoral (r hombro=1) de un día del plan se quita si hoy el hombro está a 6', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push(L('hombro', 1));
  const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: 90, lugares: ['gym'] });
  const c = ci({ minutos: 90, dolorHoy: { hombro: 6 } });
  for (const dia of plan.dias) {
    const s = sesionHoy(S, dia, c);
    assert.ok(!tareas(s).some(t => t.id === 'estiramiento-pectoral-pared' || t.nombre === 'Estiramiento de pectoral en pared o borde'));
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  }
});

// ── S3 · quien no sabe nadar 2 × 25 m, con cualquier nivel (C-PISC-2) ──
for (const nivel of [1, 2, 3]) {
  test(`S3, C-PISC-2: no sabe nadar 2 × 25 m y nivel ${nivel}: sin crol, espalda, nado continuo ni series; aquajogging donde hace pie`, () => {
    const S = nuevoS({ objetivos: ['salud'], nivel, lugares: ['piscina'], nadar25: false });
    for (const minutos of [30, 45, 60, 90]) {
      const s = sesionHoy(S, null, ci({ lugar: 'piscina', minutos }));
      const nadar = s.ejercicios.filter(x => ['crol', 'espalda', 'nado-continuo', 'series-50-crol', 'crol-pull-buoy', 'crol-catch-up', 'crol-un-brazo', 'patada-lateral', 'flecha'].includes(x.id));
      assert.deepEqual(nadar.map(x => x.id), []);
      const cardio = s.ejercicios.find(x => x.rol === 'cardio');
      assert.ok(cardio && /donde hagas pie/.test(cardio.nota), cardio && cardio.nota);
    }
    // La IA con crol y nado continuo: el validador los quita.
    const v = ent.validarSesion(S, { ejercicios: [{ id: 'crol', rol: 'principal', series: 4, reps: '25 m', descanso: 60 }, { id: 'nado-continuo', rol: 'cardio', series: 1, reps: '15 min', descanso: 0 }] }, { lugar: 'piscina', minutos: 45, origen: 'ia' });
    assert.ok(!v.sesion.ejercicios.some(x => ['crol', 'nado-continuo'].includes(x.id)));
    assert.ok(v.valida);
  });
}
test('S3: la ficha del aquajogging empieza por «donde hagas pie»', () => {
  assert.match(cat.ex('aquajogging').p[0], /^Donde hagas pie/);
});

// ── S11 · aletas con el tobillo dolorido (C-PISC-3) ──
test('S11, C-PISC-3: con el tobillo a 5/10 en la piscina no sale la patada lateral con aletas', () => {
  for (const detalle of ['aquiles', 'esguince', 'fascitis', undefined]) {
    for (let k = 0; k < 7; k++) {
      const S = nuevoS({ objetivos: ['natacion'], nivel: 2, lugares: ['piscina'], nadar25: true });
      S.perfil.lesiones.push(L('tobillo_pie', 2, detalle ? { detalle } : {}));
      const s = sesionHoy(S, null, ci({ lugar: 'piscina', minutos: 30 + k * 10, dolorHoy: { tobillo_pie: 5 } }));
      assert.ok(!s.ejercicios.some(x => x.id === 'patada-lateral'));
    }
  }
});

// ── S8 · palabras de alarma (C-ALAR-4): positivos y negativos ──
test('S8, C-ALAR-4: frases habituales de A1, A2, A4, A6 y A11 avisan', () => {
  const si = ['noté falta de aire en la cinta', 'mucha falta de aire hoy', 'falta de aire fuera de lo normal', 'me faltaba el aire', 'me costaba respirar en la bici',
    'sentí opresión en el pecho', 'me dolía el pecho', 'tenía el pecho oprimido', 'casi me desmayo', 'me quedé sin fuerza en el brazo', 'perdí fuerza en la pierna',
    'se me durmió la mano', 'tengo la pierna dormida', 'palpitaciones raras', 'el corazón me iba a mil', 'me dio un pinchazo en el pecho', 'dolor entre los omóplatos y sudor frío',
    'tengo 38 de fiebre', 'estoy con gripe', 'el gemelo hinchado y caliente', 'me duele la cabeza muchísimo de golpe', 'veía doble', 'orina muy oscura', 'me hormiguea el brazo'];
  for (const t of si) assert.ok(ent.fraseAlarma(t), `debería avisar: ${t}`);
});
test('S8, C-ALAR-4: el esfuerzo normal, los ejercicios y las negaciones no avisan', () => {
  const no = ['sin mareos hoy', 'press de pecho muy pesado', 'no he notado hormigueo', 'nada de náuseas', 'estiramiento de pecho genial', 'ni mareo ni nada', 'cero fiebre',
    'aperturas de pecho', 'la falta de tiempo', 'me falta aire al nadar fuerte', 'en las series de crol me falta aire', 'acabé sin aire en la cuesta', 'me ahogo un poco nadando rápido',
    'no quiero perder fuerza', 'para no perder fuerza en las piernas', 'gemelo cargado', 'sin gripe ya', 'me duele la cabeza un poco', 'sin falta de aire', 'el pecho me ha crecido',
    'el corazón a tope en los intervalos'];
  for (const t of no) assert.equal(ent.fraseAlarma(t), null, `no debería avisar: ${t}`);
});

// ── S10 · embarazo desde la semana 16: nada boca arriba más de 2 min seguidos (C-SALUD-0) ──
test('S10, C-SALUD-0: con 24 semanas y visto bueno, ni descarga 90/90, ni dead bug, ni respiración tumbada', () => {
  for (const [lugar, dolor] of [['gym', 3], ['gym', 5], ['casa', 3], ['casa', 5], ['gym', 8]]) {
    const S = nuevoS({ objetivos: ['salud'], lugares: [lugar], salud: { embarazo: 24, vistoBueno: { embarazo: true } } });
    S.perfil.lesiones.push(L('lumbar', 3));
    const s = sesionHoy(S, null, ci({ lugar, dolorHoy: { lumbar: dolor } }));
    const ids = [...s.ejercicios.map(x => x.id), ...tareas(s).map(t => t.id)];
    assert.ok(!ids.includes('descarga-90-90') && !ids.includes('dead-bug'), `${lugar} ${dolor}: ${ids.join(', ')}`);
    assert.ok(!tareas(s).some(t => /^Tumbado/.test(t.detalle || '')), lugar);
    if (dolor < 7) assert.ok(s.ejercicios.some(x => x.rol === 'rehab'), 'sigue habiendo rehabilitación lumbar');
  }
  // Antes de la semana 16, sí.
  const S = nuevoS({ objetivos: ['salud'], lugares: ['gym'], salud: { embarazo: 12, vistoBueno: { embarazo: true } } });
  assert.ok(!ent.restriccionesSalud(S).excluir.has('descarga-90-90'));
});

// ── S4 · equilibrio con 60 años o más aunque el tiempo rehaga el calentamiento (C-EDAD-1) ──
test('S4, C-EDAD-1: con 70 años, toda sesión lleva el equilibrio, también si se acorta el calentamiento', () => {
  let n = 0;
  for (const lugar of ['gym', 'casa', 'calle']) for (const minutos of [30, 45, 60]) for (const [z, d] of [['lumbar', 2], ['hombro', 5], ['dorsal', 3], ['cervical', 2], [null, 0]]) {
    const S = nuevoS({ objetivos: ['perder'], nivel: 2, lugares: [lugar], datos: { nacimiento: '1956' } });
    if (z) S.perfil.lesiones.push(L(z, d));
    const c = ci({ lugar, minutos, dolorHoy: z ? { [z]: d } : {} });
    const s = sesionHoy(S, null, c);
    assert.ok(tareas(s).some(t => t.id === 'equilibrio-una-pierna') || s.ejercicios.some(x => x.id === 'equilibrio-una-pierna'), `${lugar} ${minutos} ${z}`);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
    n++;
  }
  assert.ok(n > 40);
});

// ── S5 · el validador no suspende su propia corrección de C-TIEMPO-2 ──
test('S5, C-TIEMPO-2: quitar la rehabilitación de una zona B1 para que quepa no hace la sesión «no válida»', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push(L('hombro', 2));
  const T = (n, d) => ({ nombre: n, detalle: '', duracion: d });
  const ia = { nombre: 'IA', calentamiento: [{ id: 'bici-estatica', nombre: 'Bici estática', duracion: '3 min' }, { id: 'circulos-cadera', nombre: 'Círculos de cadera', duracion: '2 min' }],
    ejercicios: [{ id: 'rotacion-externa-banda', rol: 'rehab', series: 3, reps: '15', descanso: 45 }, { id: 'prensa-piernas', rol: 'principal', series: 3, reps: '10-12', descanso: 90 }, { id: 'jalon-pecho', rol: 'principal', series: 3, reps: '10-12', descanso: 90 },
      { id: 'curl-femoral-sentado', rol: 'principal', series: 2, reps: '12-15', descanso: 45 }, { id: 'bici-estatica', rol: 'cardio', series: 1, reps: '15 min', descanso: 0 }],
    vueltaCalma: [{ id: 'estiramiento-isquios-pie', nombre: 'Estiramiento de isquios de pie', duracion: '1 min' }, { id: 'estiramiento-gemelo-pared', nombre: 'Estiramiento de gemelo', duracion: '1 min' }, T('Respiración', '1 min')] };
  const c = { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 2 }, energia: 3 };
  const v = ent.validarSesion(S, ia, { ...c, origen: 'ia' });
  assert.ok(v.valida, ent.problemasSesion(S, v.sesion, c).join(' | '));
  // Con tiempo de sobra, la zona B1 sin rehabilitación sí es un fallo.
  const s60 = sesionHoy(S, null, ci({ minutos: 90, dolorHoy: { hombro: 2 } }));
  s60.ejercicios = s60.ejercicios.filter(x => x.rol !== 'rehab');
  assert.ok(ent.problemasSesion(S, s60, ci({ minutos: 90, dolorHoy: { hombro: 2 } })).includes('sin rehabilitación de hombro'));
});

// ── S12 · la alternativa por nivel no cambia un básico por un aislamiento (C-DOSIS-10, CR-08) ──
test('S12, CR-08: principiante de fuerza con press de banca con barra de la IA: el cambio es otro compuesto', () => {
  const S = nuevoS({ objetivos: ['fuerza'], nivel: 1, lugares: ['gym'] });
  const v = ent.validarSesion(S, { ejercicios: [{ id: 'press-banca-barra', rol: 'principal', series: 3, reps: '6-8', descanso: 150 }, { id: 'peso-muerto-rumano', rol: 'principal', series: 3, reps: '6-8', descanso: 150 }, { id: 'jalon-pecho', rol: 'principal', series: 3, reps: '6-8', descanso: 150 }] }, { lugar: 'gym', minutos: 60, origen: 'ia' });
  const p = v.sesion.ejercicios.filter(x => x.rol === 'principal').map(x => cat.ex(x.id));
  assert.ok(!p.some(e => e.id === 'press-banca-barra'));
  const pecho = p.find(e => e.m[0] === 'pecho');
  assert.equal(pecho.tipo, 'compuesto', pecho.id);
});

// ── S13, S19 · nivel superior solo si no hay otro de su nivel, y la nota lo dice (C-DOSIS-10, D-B) ──
test('S13, C-DOSIS-10: un intermedio en la calle con flexiones diamante lleva la nota de por qué', () => {
  const S = nuevoS({ objetivos: ['fuerza'], nivel: 2, lugares: ['calle'] });
  const s = sesionHoy(S, null, ci({ lugar: 'calle', minutos: 90 }));
  const altos = s.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).niv > 2);
  for (const x of altos) assert.match(x.nota, /no hay otro de tu nivel/);
});
test('S19, D-B: el plan de un principiante no rellena con uno de nivel 2 si ya tiene el de su nivel de ese músculo', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: ['casa'], materialCasa: ['mancuernas', 'banda'] });
  const p = ent.planReglas(S, { dias: [1, 2, 4, 5], minutos: 75, lugares: ['casa'] });
  for (const d of p.dias) for (const x of d.ejercicios.filter(y => y.rol === 'principal' && cat.ex(y.id).niv > 1)) {
    const m = cat.ex(x.id).m[0];
    assert.ok(!d.ejercicios.some(y => y.rol === 'principal' && y.id !== x.id && cat.ex(y.id).m[0] === m && cat.ex(y.id).niv <= 1), `${d.diaSemana}: ${x.id}`);
  }
});

// ── S9 · el plan no deja principales a 1 serie (C-DOSIS-2, C-TIEMPO-2) ──
test('S9: ningún principal del plan con menos de 2 series', () => {
  for (const nivel of [1, 2, 3]) for (const obj of ['musculo', 'fuerza']) for (const dias of [[1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5, 6]]) for (const lugar of ['gym', 'casa']) {
    const S = nuevoS({ objetivos: [obj], nivel, lugares: [lugar], materialCasa: ['mancuernas', 'banda'] });
    const p = ent.planReglas(S, { dias, minutos: 75, lugares: [lugar] });
    const unos = p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal' && +x.series < 2 && cat.ex(x.id).t !== 'distancia').map(x => `${d.diaSemana}:${x.id}`));
    assert.deepEqual(unos, [], `${nivel} ${obj} ${dias.length} ${lugar}`);
  }
});

// ── S14 · tope de series de D-B (3 principiante, 4 el resto) en la energía 5 y en la progresión ──
test('S14, D-B: la energía 5 y «dos sesiones al tope» no pasan de 3 series al principiante ni de 4 al resto', async () => {
  const { prog, hecha } = await import('./ayuda/node.mjs');
  for (const [nivel, obj] of [[1, 'musculo'], [2, 'fuerza'], [3, 'fuerza']]) {
    const S = nuevoS({ objetivos: [obj], nivel, lugares: ['gym'] });
    const s = sesionHoy(S, null, ci({ energia: 5 }));
    for (const x of s.ejercicios.filter(y => y.rol === 'principal')) assert.ok(x.series <= (nivel === 1 ? 3 : 4), `${nivel}: ${x.id} ${x.series}`);
  }
  const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: ['casa'] });
  hecha(S, 5, [{ id: 'flexiones-inclinadas', reps: '6-12', sets: [[0, 12], [0, 12], [0, 12]] }]);
  hecha(S, 2, [{ id: 'flexiones-inclinadas', reps: '6-12', sets: [[0, 12], [0, 12], [0, 12]] }]);
  assert.ok(prog.sugerir(S, 'flexiones-inclinadas', { series: 3, reps: '6-12' }, { energia: 3 }).series <= 3);
});

// ── S17 · la nota del cardio es la de ese cardio ──
test('S17: la nota del cardio no habla de otro ejercicio ni se alterna consigo mismo', () => {
  for (const lugar of ['casa', 'calle', 'gym']) for (let dia = 0; dia < 7; dia++) for (const obj of ['salud', 'perder']) {
    fijarFecha(`2026-11-${16 + dia}T10:00`);
    const S = nuevoS({ objetivos: [obj], nivel: 2, lugares: [lugar] });
    const s = sesionHoy(S, null, ci({ lugar }));
    const c = s.ejercicios.find(x => x.rol === 'cardio');
    const m = (c.nota || '').match(/alterna con ([^)]+)\)/);
    assert.ok(!m || !m[1].includes(cat.ex(c.id).n.toLowerCase()), `${lugar}: ${c.id} → ${c.nota}`);
  }
  fijarFecha('2026-11-18T10:00');
});

// ── IA-5 · la sesión de reglas del último recurso no se contradice ──
test('IA-5, C-TIEMPO-2: sin fuerza por tiempo, la explicación no habla de principales ni de dosis y cita el dolor de hoy', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push(L('lumbar', 3), L('rodilla', 3));
  const s = sesionHoy(S, null, ci({ minutos: 30, dolorHoy: { lumbar: 5, rodilla: 5 } }));
  assert.equal(s.ejercicios.filter(x => x.rol === 'principal').length, 0);
  const e = s.explicacion.join(' | ');
  assert.doesNotMatch(e, /Cuerpo completo|ejercicios principales|primer básico|\(3\/10\)/, e);
  assert.match(s.explicacion[0], /lumbar \(5\/10\)/);
  assert.ok(s.explicacion.some(t => /no caben tu cardio/.test(t)));
});
