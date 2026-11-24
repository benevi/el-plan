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
