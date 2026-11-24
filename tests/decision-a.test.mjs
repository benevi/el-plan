// Decisión A de Víctor (24-11-2026, C-TIEMPO-5 de docs/criterio.md): en una sesión corta con una zona dolorida, si
// tras quitar la fuerza (C-TIEMPO-2 paso 7) quedan 4 minutos o más, entra 1 principal que no cargue la zona, sin
// pasar nunca de los minutos pedidos (C-TIEMPO-1). Y la negación de «a tope»/«sprint» en la nota del cardio
// (C-CARDIO-4) solo cuenta si va justo delante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, lesiones } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
const dia = await import(modulo('js/areas/entrenador/dia.js'));
const val = await import(modulo('js/areas/entrenador/validar.js'));
const L = (zona, dolor) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: '2026-01-01' });
const ci = (o = {}) => ({ lugar: 'gym', minutos: 30, energia: 3, dolorHoy: {}, peticion: '', ...o });
const prin = s => s.ejercicios.filter(x => x.rol === 'principal');
const sesion = (perfil, c) => { const S = nuevoS(perfil); return { S, s: ent.ajustarAlCheckin(S, null, ci(c)).datos, c: ci(c) }; };
const TXT_A = /^Por tiempo \(último recurso\): con \d+ minutos caben tu cardio.* y 1 ejercicio principal/;
const TXT_SIN = /^Con \d+ minutos no caben tu cardio/;

test('C-TIEMPO-5 (decisión A): 30 min, hombro a 5 y 5 min libres tras quitar la fuerza → 1 principal que no carga el hombro, ≤ 30 min', () => {
  const { S, s, c } = sesion({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)] }, { dolorHoy: { hombro: 5 } });
  const p = prin(s);
  assert.equal(p.length, 1, s.ejercicios.map(x => x.id).join(', '));
  assert.ok(!(cat.ex(p[0].id).r || {}).hombro, `${p[0].id} carga el hombro`);
  assert.ok(p[0].series >= 2);
  assert.ok(dia.tiempoSesionExacto(s) <= 30, `${dia.tiempoSesionExacto(s)} min`);
  assert.ok(s.ejercicios.some(x => x.rol === 'rehab'), 'sin rehabilitación del hombro');
  assert.ok(s.ejercicios.filter(x => x.rol === 'cardio').reduce((t, x) => t + parseFloat(x.reps), 0) >= 15, 'cardio por debajo del mínimo');
  assert.ok(s.explicacion.some(t => TXT_A.test(t) && /que no carga tu hombro/.test(t)), s.explicacion.join(' | '));
  assert.match(s.explicacion[0], /^Hoy cardio \(15 min\), ejercicios para tu hombro \(5\/10\) y 1 ejercicio de fuerza \(.+\): con 30 minutos no cabe más fuerza\.$/);
  assert.ok(!s.explicacion.some(TXT_SIN.test.bind(TXT_SIN)), 'sigue el aviso de sin fuerza');
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-TIEMPO-5 (decisión A): sin hueco de 4 min (CR-26: lumbar y rodilla a 5, 30 min) no se añade nada', () => {
  const { S, s, c } = sesion({ objetivos: ['perder'], nivel: 2, lesiones: [L('lumbar', 3), L('rodilla', 3)] }, { dolorHoy: { lumbar: 5, rodilla: 5 } });
  assert.equal(prin(s).length, 0);
  assert.ok(30 - dia.tiempoSesionExacto(s) < val.HUECO_PRINCIPAL, `${dia.tiempoSesionExacto(s)} min`);
  assert.ok(s.explicacion.some(t => TXT_SIN.test(t)), s.explicacion.join(' | '));
  assert.ok(!s.explicacion.some(t => TXT_A.test(t)));
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-TIEMPO-5 (decisión A): rodilla a 5, intermedio, 30 min: justo 4 min libres → entra el principal que cabe (un aislamiento), ≤ 30', () => {
  // C-TIEMPO-4: 4 + 3 + 15 + isométrico 4 (sin su último descanso) = 26. Un compuesto a 2 × 8-12 con 90 s (3,9 más el
  // descanso del isométrico) no cabe; un aislamiento a 2 × 12-15 con 45 s sí.
  const { S, s, c } = sesion({ objetivos: ['perder'], nivel: 2, lesiones: [L('rodilla', 3)] }, { dolorHoy: { rodilla: 5 } });
  const p = prin(s);
  assert.equal(p.length, 1, s.explicacion.join(' | '));
  assert.ok(!(cat.ex(p[0].id).r || {}).rodilla, p[0].id);
  assert.ok(dia.tiempoSesionExacto(s) <= 30, `${dia.tiempoSesionExacto(s)} min`);
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-TIEMPO-5 (decisión A): sin ningún principal seguro (todos rechazados) no se añade nada', () => {
  const S0 = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)] });
  const ctx = dia.contextoDia(S0, { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 5 } });
  const gustos = Object.fromEntries(ctx.pool.filter(e => dia.valePrincipal(S0, e, ctx)).map(e => [e.id, 'rechazo']));
  const { S, s, c } = sesion({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)], gustos }, { dolorHoy: { hombro: 5 } });
  assert.equal(prin(s).length, 0);
  assert.ok(dia.tiempoSesionExacto(s) <= 30);
  assert.ok(!s.explicacion.some(t => TXT_A.test(t)), s.explicacion.join(' | '));
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-TIEMPO-5, IA-2 (decisión A): la IA manda cardio y rehabilitación como último recurso; la app pone el principal que cabe', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)] });
  const T = n => ({ id: '', nombre: n, detalle: '', duracion: '2 min' });
  const v = ent.validarSesion(S, { explicacion: ['Con 30 minutos no caben tu cardio de 15 minutos, el trabajo de tu hombro y fuerza.'],
    ejercicios: [{ id: 'bici-estatica', rol: 'cardio', series: 1, reps: '15 min', descanso: 0, nota: '' }], calentamiento: [T('Bici'), T('Movilidad')], vuelta: [T('Estiramiento de pecho'), T('Respiración')] },
  { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 5 }, origen: 'ia' });
  const p = prin(v.sesion);
  assert.equal(p.length, 1, v.sesion.ejercicios.map(x => x.id).join(', '));
  assert.ok(!(cat.ex(p[0].id).r || {}).hombro);
  assert.ok(dia.tiempoSesionExacto(v.sesion) <= 30);
  assert.ok(v.ultimoRecurso && v.valida);
  // Validar otra vez no cambia nada (la sesión guardada se revalida al abrirla).
  const w = ent.validarSesion(S, v.sesion, { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 5 } });
  assert.deepEqual(prin(w.sesion).map(x => [x.id, x.series]), p.map(x => [x.id, x.series]));
});

test('C-TIEMPO-1, C-TIEMPO-5: barrido de lugares, objetivos, zonas y minutos 20-45: nunca más de lo pedido, y el principal añadido no carga la zona', () => {
  const zonas = Object.keys(lesiones.ZONAS).sort();
  const mal = [];
  let conA = 0, sinFuerza = 0;
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) {
    for (const obj of ['perder', 'musculo', 'fuerza', 'resistencia', 'salud', 'natacion']) {
      for (const z of zonas) {
        for (const [dolor, nivel] of [[5, 2], [3, 1]]) {
          for (const minutos of [20, 25, 30, 35, 40, 45]) {
            const { S, s, c } = sesion({ objetivos: [obj], lugares: [lugar], nivel, materialCasa: ['mancuernas', 'banda'], nadar25: true, lesiones: [L(z, dolor)] }, { lugar, minutos, dolorHoy: { [z]: dolor } });
            const n = `${lugar}/${obj}/${z}${dolor}/niv${nivel}/${minutos}`;
            const pedido = dia.minutosSesion(minutos); // la app ofrece 30, 45, 60, 75 y 90: 20-35 → 30; 40-45 → 45
            const t = dia.tiempoSesionExacto(s);
            if (s.minutos !== pedido || t > pedido + 0.01) mal.push(`${n}: ${t.toFixed(1)} min para ${pedido}`);
            const p = prin(s);
            if (s.explicacion.some(x => TXT_A.test(x))) {
              conA++;
              if (p.length !== 1 || (cat.ex(p[0].id).r || {})[z]) mal.push(`${n}: el principal de la decisión A no vale (${p.map(x => x.id)})`);
            }
            if (!p.length && s.explicacion.some(x => TXT_SIN.test(x))) {
              sinFuerza++;
              if (pedido - t >= val.HUECO_PRINCIPAL && dia.elegirPrincipales(S, { ...dia.contextoDia(S, { lugar, minutos, dolorHoy: { [z]: dolor } }), pool: dia.contextoDia(S, { lugar, minutos, dolorHoy: { [z]: dolor } }).pool.filter(e => !(e.r || {})[z]) },
                { huecos: dia.PLANTILLAS[dia.tipoParaLugar(s.tipo, lugar)].huecos, presupuesto: Infinity, excluir: s.ejercicios.map(x => x.id), maximo: 1 }).length) {
                mal.push(`${n}: sin fuerza con ${(pedido - t).toFixed(1)} min libres`);
              }
            }
            const prob = ent.problemasSesion(S, s, c);
            if (prob.length) mal.push(`${n}: ${prob.join('; ')}`);
          }
        }
      }
    }
  }
  assert.deepEqual(mal.slice(0, 15), []);
  assert.ok(conA > 0, 'el barrido no pasa por la decisión A');
  assert.ok(sinFuerza + conA > 0);
});

// ── C-CARDIO-4: «a tope» y «sprint» solo cuentan como negados con la negación justo delante (revisión del PR #53) ──
test('C-CARDIO-4: la negación de «a tope»/«sprint» va justo delante; «sin parar a tope» o «no pares y sprint» se detectan', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2 });
  const T = n => ({ id: '', nombre: n, detalle: '', duracion: '2 min' });
  const P = (id, o = {}) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, nota: '', ...o });
  const notaFinal = nota => ent.validarSesion(S, {
    ejercicios: [P('press-pecho-maquina'), P('jalon-pecho'), P('prensa-piernas'), { id: 'bici-estatica', rol: 'cardio', series: 1, reps: '20 min', descanso: 0, nota }],
    calentamiento: [T('Bici'), T('Movilidad')], vuelta: [T('Estiramiento de pecho'), T('Respiración')],
  }, { lugar: 'gym', minutos: 60, energia: 3 }).sesion.ejercicios.find(x => x.rol === 'cardio').nota;
  const base = 'Esfuerzo 4-5 de 10, puedes hablar con frases cortas.';
  for (const neg of ['nunca a tope', 'sin sprints', 'nada de ir a tope', 'no vayas a tope', 'sin sprint']) {
    const nota = `${base} ${neg[0].toUpperCase() + neg.slice(1)}.`;
    assert.equal(notaFinal(nota), nota, `«${neg}» debería contar como negado`);
  }
  for (const si of ['1 min sin parar a tope', 'no pares y sprint final', 'nunca pares: al final, a tope', 'sin descanso, sprint de 30 s']) {
    const nota = `${base} ${si}.`;
    assert.notEqual(notaFinal(nota), nota, `«${si}» debería detectarse`);
  }
});

// ── Revisión del PR #54 ──
const Tl = n => ({ id: '', nombre: n, detalle: '', duracion: '2 min' });
const P = (id, o = {}) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, ...o });
const CARDIO15 = { id: 'bici-estatica', rol: 'cardio', series: 1, reps: '15 min', descanso: 0, nota: '' };

test('C-TIEMPO-5, C-SALUD-0 (revisión del PR #54): con hipertensión el principal añadido descansa ≥ 60 s y validar dos veces no cambia nada', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('rodilla', 3)], salud: { hipertension: 'controlada' } });
  const c = { lugar: 'gym', minutos: 30, energia: 3, dolorHoy: { rodilla: 5 } };
  let vistos = 0;
  for (let d = 20; d <= 90; d += 5) {
    const v = ent.validarSesion(S, { explicacion: [], ejercicios: [{ id: 'sentadilla-isometrica', rol: 'rehab', series: 4, reps: '30-45s', descanso: d }, P('press-pecho-maquina'), P('jalon-pecho'), CARDIO15],
      calentamiento: [Tl('Bici'), Tl('Movilidad')], vuelta: [Tl('Estiramiento de pecho'), Tl('Respiración')] }, { ...c, origen: 'ia' });
    const s = v.sesion;
    assert.ok(dia.tiempoSesionExacto(s) <= 30 + 1e-9, `${d}: ${dia.tiempoSesionExacto(s)}`);
    prin(s).forEach(x => assert.ok(x.descanso >= 60, `${d}: ${x.id} descansa ${x.descanso} s`));
    if (prin(s).length) vistos++;
    const w = ent.validarSesion(S, s, c).sesion;
    assert.deepEqual(w.ejercicios.map(x => [x.id, x.series, x.reps, x.descanso]), s.ejercicios.map(x => [x.id, x.series, x.reps, x.descanso]), `${d}: no es idempotente`);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  }
  assert.ok(vistos > 0, 'ningún caso con principal');
});

test('C-TIEMPO-2 paso 1, C-SALUD-0 (revisión del PR #54): los descansos de los accesorios no bajan de 60 s con hipertensión', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, salud: { hipertension: 'controlada' } });
  const v = ent.validarSesion(S, { explicacion: [], ejercicios: [P('press-pecho-maquina'), P('jalon-pecho'), P('prensa-piernas'),
    P('elevaciones-laterales', { reps: '12-15', descanso: 90 }), P('curl-biceps-mancuerna', { reps: '12-15', descanso: 90 }), { ...CARDIO15, reps: '20 min' }],
  calentamiento: [Tl('Bici'), Tl('Movilidad')], vuelta: [Tl('Estiramiento de pecho'), Tl('Respiración')] }, { lugar: 'gym', minutos: 45, energia: 3 });
  prin(v.sesion).forEach(x => assert.ok(x.descanso >= 60, `${x.id} descansa ${x.descanso} s`));
});

test('C-TIEMPO-5 (revisión del PR #54): el principal que propone la IA se queda si cabe y no carga la zona', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)] });
  for (const id of ['extension-cuadriceps', 'gluteo-maquina', 'curl-femoral-maquina']) {
    if (!cat.ex(id)) continue;
    const v = ent.validarSesion(S, { explicacion: ['Por tiempo (último recurso): con 30 minutos caben tu cardio, lo de tu hombro y 1 ejercicio principal que no carga tu hombro.'],
      ejercicios: [{ id: 'separacion-banda', rol: 'rehab', series: 2, reps: '15', descanso: 30 }, P(id, { series: 2, reps: '10-12' }), CARDIO15],
      calentamiento: [Tl('Bici'), Tl('Movilidad')], vuelta: [Tl('Estiramiento de cuádriceps'), Tl('Respiración')] }, { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 5 }, origen: 'ia' });
    assert.deepEqual(prin(v.sesion).map(x => x.id), [id]);
    assert.ok(dia.tiempoSesionExacto(v.sesion) <= 30);
    assert.ok(v.valida);
  }
});

test('C-TIEMPO-5, C-EST-1, C-CAL-2 (revisión del PR #54): calentamiento y vuelta van con el principal añadido', () => {
  const SUP = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'];
  let n = 0;
  for (const z of ['rodilla', 'cadera_lateral', 'lumbar']) {
    const { s } = sesion({ objetivos: ['perder'], nivel: 2, lesiones: [L(z, 3)] }, { dolorHoy: { [z]: 5 } });
    const p = prin(s)[0];
    if (!p || !s.explicacion.some(t => TXT_A.test(t))) continue;
    n++;
    const e = cat.ex(p.id);
    const esperado = dia.vueltaDe(nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L(z, 3)] }), dia.contextoDia(nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L(z, 3)] }), { lugar: 'gym', minutos: 30, dolorHoy: { [z]: 5 } }), [e], { total: 3 });
    assert.deepEqual(s.vuelta.map(t => t.nombre), esperado.map(t => t.nombre), `${z}: ${p.id}`);
    const sup = SUP.includes(e.m[0]);
    assert.ok(s.calentamiento.length >= 2 && s.vuelta.length >= 2, z);
    assert.ok(sup || !s.vuelta.every(t => !t.id || /pectoral|hombro/.test(t.id) || !cat.ex(t.id)), `${z}: la vuelta no estira lo trabajado (${e.m[0]})`);
    assert.ok(dia.tiempoSesionExacto(s) <= 30);
  }
  assert.ok(n > 0);
});

test('C-TIEMPO-5 (revisión del PR #54): en el plan, el principal añadido rota entre días del mismo tipo', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('rodilla', 5)] });
  S.perfil.disponibilidad.minutos = 30;
  const p = ent.planReglas(S, { dias: [1, 3, 5, 6], minutos: 30, lugares: ['gym'] });
  const porTipo = {};
  p.dias.forEach(d => { const x = prin(d); if (x.length === 1 && d.explicacion.some(t => TXT_A.test(t))) (porTipo[d.tipo] = porTipo[d.tipo] || []).push(x[0].id); });
  const repetidos = Object.entries(porTipo).filter(([, ids]) => ids.length > 1 && new Set(ids).size < ids.length);
  assert.ok(Object.values(porTipo).some(ids => ids.length > 1), JSON.stringify(porTipo));
  assert.deepEqual(repetidos, []);
});

test('C-TIEMPO-5, C-IA-3 (revisión del PR #54): «Ajustado por la app» dice qué principal entra o se recorta', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lesiones: [L('hombro', 3)] });
  const c = { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 5 }, origen: 'ia' };
  const base = { calentamiento: [Tl('Bici'), Tl('Movilidad')], vuelta: [Tl('Estiramiento de cuádriceps'), Tl('Respiración')] };
  // La app lo añade: la IA no manda ninguno.
  const v = ent.validarSesion(S, { ...base, explicacion: [], ejercicios: [{ id: 'separacion-banda', rol: 'rehab', series: 2, reps: '15', descanso: 30 }, CARDIO15] }, c);
  const p = prin(v.sesion)[0];
  assert.ok(v.cambios.some(t => t === `añado ${cat.ex(p.id).n.toLowerCase()} (${p.series} series, descanso ${p.descanso} s): es lo que cabe en 30 minutos sin cargar tu hombro` || new RegExp(`^añado .+ \\(${p.series} series, descanso ${p.descanso} s\\): es lo que cabe en 30 minutos sin cargar tu hombro$`).test(t)), v.cambios.join(' | '));
  // La IA manda uno a 4 series: se queda recortado y se dice.
  const w = ent.validarSesion(S, { ...base, explicacion: [], ejercicios: [{ id: 'separacion-banda', rol: 'rehab', series: 2, reps: '15', descanso: 30 }, P('extension-cuadriceps', { series: 4, reps: '10-12' }), CARDIO15] }, c);
  assert.deepEqual(prin(w.sesion).map(x => [x.id, x.series]), [['extension-cuadriceps', 2]]);
  assert.ok(w.cambios.some(t => /^dejo .+ a 2 series con \d+ s de descanso: es lo que cabe en 30 minutos sin cargar tu hombro$/.test(t)), w.cambios.join(' | '));
});

// ── Segunda revisión del PR #54 ──
test('C-SALUD-0, C-TIEMPO-2 paso 5, C-TIEMPO-5: con cardiopatía el ajuste de tiempo no recorta calentamiento ni vuelta por debajo de 10 y 10', () => {
  const card = { cardiopatia: true, vistoBueno: { cardiopatia: true } };
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) {
    for (const obj of ['perder', 'salud', 'musculo']) {
      for (const z of ['rodilla', 'hombro', 'lumbar']) {
        for (const minutos of [30, 45]) {
          const { S, s, c } = sesion({ objetivos: [obj], lugares: [lugar], nivel: 2, materialCasa: ['mancuernas', 'banda'], nadar25: true, lesiones: [L(z, 3)], salud: card }, { lugar, minutos, dolorHoy: { [z]: 5 } });
          const n0 = `${lugar}/${obj}/${z}/${minutos}`;
          const cal = s.calentamiento.reduce((t, x) => t + parseFloat(x.duracion), 0), vue = s.vuelta.reduce((t, x) => t + parseFloat(x.duracion), 0);
          assert.ok(cal >= 10 && vue >= 10, `${n0}: calentamiento ${cal}, vuelta ${vue}`);
          assert.deepEqual(ent.problemasSesion(S, s, c), [], n0);
          assert.ok(dia.tiempoSesionExacto(s) <= minutos + 0.01, `${n0}: ${dia.tiempoSesionExacto(s)} min`);
        }
      }
    }
  }
});

test('C-SALUD-0 (segunda revisión del PR #54): problemasSesion avisa de un calentamiento o una vuelta por debajo del mínimo de salud', () => {
  const S = nuevoS({ objetivos: ['salud'], nivel: 2, salud: { cardiopatia: true, vistoBueno: { cardiopatia: true } } });
  const s = { lugar: 'gym', minutos: 45, explicacion: [], ejercicios: [P('press-pecho-maquina', { reps: '10-12' }), P('jalon-pecho', { reps: '10-12' }), P('prensa-piernas', { reps: '10-12' }), { ...CARDIO15, reps: '10 min' }],
    calentamiento: [{ id: 'bici-estatica', nombre: 'Bici estática', detalle: '', duracion: '3 min' }, { id: 'circulos-brazos', nombre: 'Círculos de brazos', detalle: '', duracion: '1 min' }],
    vuelta: [{ id: 'estiramiento-pectoral-marco', nombre: 'Estiramiento de pectoral', detalle: '', duracion: '2 min' }, { nombre: 'Respiración', detalle: '', duracion: '1 min' }] };
  const p = ent.problemasSesion(S, s, { lugar: 'gym', minutos: 45 });
  assert.ok(p.some(t => /^calentamiento de 4 min \(mínimo 10 por salud\)$/.test(t)), p.join(' | '));
  assert.ok(p.some(t => /^vuelta a la calma de 3 min \(mínimo 10 por salud\)$/.test(t)), p.join(' | '));
});

test('C-DOLOR-1, §12.5 (segunda revisión del PR #54): las flexiones inclinadas y con rodillas llevan r=1 en hombro, como las flexiones', () => {
  for (const id of ['flexiones-inclinadas', 'flexiones-rodillas', 'flexiones']) assert.equal((cat.ex(id).r || {}).hombro, 1, id);
  // En casa con el hombro a 5 no salen como «la que no carga tu hombro».
  const { s } = sesion({ objetivos: ['perder'], lugares: ['casa'], nivel: 2, materialCasa: ['mancuernas', 'banda'], lesiones: [L('hombro', 3)] }, { lugar: 'casa', dolorHoy: { hombro: 5 } });
  assert.ok(!prin(s).some(x => /^flexiones/.test(x.id)), prin(s).map(x => x.id).join(', '));
});

// ── Tercera revisión del PR #54: cardiopatía, nunca más de lo pedido y avisos veraces ──
const CARD = { cardiopatia: true, vistoBueno: { cardiopatia: true } };
const minTareas = l => l.reduce((t, x) => t + parseFloat(x.duracion), 0);
const huella = s => JSON.stringify({ e: s.ejercicios.map(x => [x.id, x.rol, x.series, x.reps, x.descanso]), c: s.calentamiento.map(t => [t.id, t.duracion]), v: s.vuelta.map(t => [t.id, t.duracion]), x: s.explicacion });

test('C-SALUD-0, C-TIEMPO-1, C-TIEMPO-2 paso 5b: cardiopatía en lugares × objetivos × zonas × 30/45/60: ≤ lo pedido, calentamiento y vuelta ≥ 10, idempotente', () => {
  const zonas = [null, ...Object.keys(lesiones.ZONAS).sort()];
  const mal = [];
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) {
    for (const obj of ['perder', 'salud', 'musculo', 'resistencia']) {
      for (const z of zonas) {
        for (const minutos of [30, 45, 60]) {
          const dolorHoy = z ? { [z]: 5 } : {};
          const { S, s, c } = sesion({ objetivos: [obj], lugares: [lugar], nivel: 2, materialCasa: ['mancuernas', 'banda'], nadar25: true, lesiones: z ? [L(z, 3)] : [], salud: CARD }, { lugar, minutos, dolorHoy });
          const n = `${lugar}/${obj}/${z}/${minutos}`;
          const t = dia.tiempoSesionExacto(s);
          if (t > minutos + 0.01) mal.push(`${n}: ${t.toFixed(1)} min`);
          if (minTareas(s.calentamiento) < 10 || minTareas(s.vuelta) < 10) mal.push(`${n}: calentamiento ${minTareas(s.calentamiento)}, vuelta ${minTareas(s.vuelta)}`);
          const p = ent.problemasSesion(S, s, c);
          if (p.length) mal.push(`${n}: ${p.join('; ')}`);
          if (s.explicacion.filter(x => /\(último recurso\)|no caben tu cardio/.test(x)).length > 1) mal.push(`${n}: aviso repetido`);
          if (!z && s.explicacion.some(x => /lesión|rehabilitación/.test(x) && /último recurso|no caben/.test(x))) mal.push(`${n}: habla de lesión sin lesión`);
          let w = s;
          for (let i = 0; i < 5; i++) w = ent.validarSesion(S, w, { lugar, minutos, energia: 3, dolorHoy }).sesion;
          if (huella(w) !== huella(s)) mal.push(`${n}: no es idempotente`);
        }
      }
    }
  }
  assert.deepEqual(mal.slice(0, 12), []);
});

test('C-SALUD-0 (24-11-2026): con cardiopatía y 30 min, el aviso dice el corazón, el cardio suave cuenta y no hay «Tu check-in no cambia nada»', () => {
  const { S, s, c } = sesion({ objetivos: ['perder'], nivel: 2, salud: CARD }, {});
  assert.ok(dia.tiempoSesionExacto(s) <= 30);
  assert.ok(s.explicacion.some(t => /^Ajustado por la app: [Cc]on tu corazón, el calentamiento y la vuelta a la calma son de 10 minutos, con cardio suave dentro: cuentan como parte de tu cardio de hoy, así que el bloque de cardio queda en \d+ minutos\.?$/.test(t)), s.explicacion.join(' | '));
  assert.ok(!s.explicacion.some(t => /Tu check-in no cambia nada/.test(t)), s.explicacion.join(' | '));
  assert.ok(!s.explicacion.some(t => /lesión|rehabilitación/.test(t)), s.explicacion.join(' | '));
  // El cardio suave está de verdad en el calentamiento y en la vuelta.
  const cardioEn = l => l.filter(t => t.id && ['cardio', 'natacion'].includes(cat.ex(t.id).m[0])).reduce((a, t) => a + parseFloat(t.duracion), 0);
  assert.ok(cardioEn(s.calentamiento) >= 5 && cardioEn(s.vuelta) >= 5, `${cardioEn(s.calentamiento)} + ${cardioEn(s.vuelta)}`);
  const bloque = s.ejercicios.find(x => x.rol === 'cardio');
  assert.ok(parseFloat(bloque.reps) >= 5);
  assert.ok(parseFloat(bloque.reps) + cardioEn(s.calentamiento) + cardioEn(s.vuelta) >= 15, 'el cardio total no llega al mínimo de perder grasa');
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-TIEMPO-1 (tercera revisión del PR #54): problemasSesion avisa de una sesión más larga que lo pedido, también en el último recurso', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2 });
  const s = { lugar: 'gym', minutos: 30, explicacion: ['Hoy cardio.', 'Con 30 minutos no caben tu cardio de 15 minutos y fuerza. Hoy: cardio. Si quieres fuerza, elige 45 minutos.'],
    ejercicios: [{ ...CARDIO15, reps: '25 min' }], calentamiento: [Tl('Bici'), Tl('Movilidad')], vuelta: [{ ...Tl('Estiramiento de pecho'), duracion: '2 min' }, { ...Tl('Respiración'), duracion: '2 min' }] };
  const p = ent.problemasSesion(S, s, { lugar: 'gym', minutos: 30 });
  assert.ok(p.some(t => /^\d+ min para 30$/.test(t)), p.join(' | '));
});
