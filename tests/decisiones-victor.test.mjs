// Decisiones de criterio de Víctor del 23-11-2026 (docs/criterio.md, sección 20, puntos 14-20): una prueba por
// decisión, con su id del informe de verificación (S7, S18, S16, S3, T3b, S8, S4) y el de docs/criterio.md.
// Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fijarFecha, ruta, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, modelo, lesiones } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
const dia = await import(modulo('js/areas/entrenador/dia.js'));
const alarma = await import(modulo('js/areas/entrenador/alarma.js'));
const CRONICA = '2025-01-01';
const L = (zona, dolor, o = {}) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: CRONICA, tipo: 'lesion', ...o });
const ci = (o = {}) => ({ lugar: 'gym', minutos: 45, energia: 3, dolorHoy: {}, peticion: '', ...o });
const sesionHoy = (S, d, c) => modelo.crearSesion(ent.ajustarAlCheckin(S, d, c).datos);
const criterio = fs.readFileSync(ruta('docs/criterio.md'), 'utf8');
const PIERNA = ['cadera_lateral', 'rodilla', 'tobillo_pie'];
const BRAZO = ['hombro', 'codo', 'muñeca'];
const todas = s => [...s.calentamiento, ...s.ejercicios, ...s.vuelta];

// ── S7 · Cardio siempre (T1 al 100 %, D3, C-CARDIO-5, C-CARDIO-6, C-DOLOR-4) ──
test('S7, C-CARDIO-6: la marcha sentada tiene su ficha completa y no carga piernas ni brazos', () => {
  const e = cat.ex('marcha-sentada');
  assert.ok(e, 'existe marcha-sentada');
  assert.equal(e.m[0], 'cardio'); assert.equal(e.t, 'tiempo'); assert.equal(e.tipo, 'propia'); assert.equal(e.niv, 1);
  assert.deepEqual(['casa', 'calle'].filter(l => !e.l.includes(l)), []);
  assert.ok(e.mat.includes('peso corporal'));
  assert.ok(e.p.length >= 4 && e.e.length >= 3 && e.c, 'cómo se hace, en qué fijarse y consejo');
  assert.deepEqual([...PIERNA, ...BRAZO].filter(z => (e.r || {})[z]), [], 'sin riesgo en piernas ni brazos');
  for (const l of ['casa', 'calle']) assert.ok(dia.CARDIO_LUGAR[l].includes('marcha-sentada'), `cuenta como cardio en ${l}`);
  assert.match(criterio, /`marcha-sentada`/, 'el criterio la cita');
});

for (const lugar of ['casa', 'calle']) for (const p of PIERNA) for (const b of BRAZO) {
  test(`S7, T1: ${lugar} con ${p} y ${b} a 5/10 (B2): hay cardio y no carga ninguna de las dos`, () => {
    const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: [lugar], materialCasa: [] });
    S.perfil.lesiones.push(L(p, 5), L(b, 5));
    const c = ci({ lugar, dolorHoy: { [p]: 5, [b]: 5 } });
    const s = sesionHoy(S, null, c);
    const cardio = s.ejercicios.filter(x => x.rol === 'cardio');
    assert.ok(cardio.length, `sin cardio: ${s.ejercicios.map(x => x.id).join(', ')}`);
    for (const x of cardio) assert.deepEqual([p, b].filter(z => (cat.ex(x.id).r || {})[z]), [], x.id);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  });
  test(`S7, C-DOLOR-4: ${lugar}, día de dolor alto de ${p} (8/10) con una lesión de ${b} a 0/10: hay cardio suave`, () => {
    const S = nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: [lugar], materialCasa: ['banda'] });
    S.perfil.lesiones.push(L(b, 0, { tipo: 'puntual' }));
    const c = ci({ lugar, minutos: 30, dolorHoy: { [p]: 8 } });
    const s = sesionHoy(S, null, c);
    assert.equal(s.tipo, 'dolorAlto');
    const cardio = s.ejercicios.filter(x => x.rol === 'cardio');
    assert.equal(cardio.length, 1, s.explicacion.join(' | '));
    assert.deepEqual([p, b].filter(z => (cat.ex(cardio[0].id).r || {})[z]), []);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  });
}
test('S7, C-DOLOR-4: con un brazo a 8/10 y una pierna lesionada en la calle también hay cardio', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 2, lugares: ['calle'] });
  S.perfil.lesiones.push(L('tobillo_pie', 3));
  const c = ci({ lugar: 'calle', minutos: 60, dolorHoy: { codo: 8, tobillo_pie: 2 } });
  const s = sesionHoy(S, null, c);
  assert.ok(s.ejercicios.some(x => x.rol === 'cardio'), s.explicacion.join(' | '));
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

// ── S18 · Superserie del último recurso: 90-120 s entre parejas (C-PAUSA-1, C-TIEMPO-2 paso 6, C-TIEMPO-4) ──
for (const [nombre, perfil, les, dolorHoy, lugar, energia] of [
  ['fuerza, casa, codo 0', { objetivos: ['fuerza'], nivel: 1, materialCasa: [] }, [L('codo', 0)], { codo: 0 }, 'casa', 3],
  ['fuerza, casa, codo 0, energía 5', { objetivos: ['fuerza'], nivel: 1, materialCasa: [] }, [L('codo', 0)], { codo: 0 }, 'casa', 5],
  ['salud, casa, muñeca 5', { objetivos: ['salud'], nivel: 1, materialCasa: [] }, [L('muñeca', 5)], { muñeca: 5 }, 'casa', 3],
  ['resistencia, calle, cervical 5', { objetivos: ['resistencia'], nivel: 2, materialCasa: [] }, [L('cervical', 5)], { cervical: 5 }, 'calle', 2],
]) {
  test(`S18, C-PAUSA-1: superserie del último recurso (${nombre}): 90-120 s tras la pareja, nunca por debajo de C-PAUSA-1, y el primero sin descanso`, () => {
    const S = nuevoS({ lugares: [lugar], ...perfil });
    S.perfil.lesiones.push(...les);
    const c = ci({ lugar, minutos: 30, dolorHoy, energia });
    const s = sesionHoy(S, null, c);
    const i = s.ejercicios.findIndex(x => x.superserie);
    assert.ok(i >= 0, s.ejercicios.map(x => x.id).join());
    const [primero, segundo] = [s.ejercicios[i], s.ejercicios[i + 1]];
    assert.equal(primero.descanso, 0, 'el primero de la pareja va sin descanso');
    assert.ok(segundo.descanso >= 90 && segundo.descanso <= 120, `${segundo.descanso} s`);
    for (const x of [primero, segundo]) assert.ok(segundo.descanso >= dia.pausaMinima(dia.tipoEj(cat.ex(x.id)), +String(x.reps).match(/\d+/)[0]), `${x.id} ${x.reps}`);
    assert.match(primero.nota, new RegExp(`descansa ${segundo.descanso} s`));
    assert.doesNotMatch(primero.nota, / con 0 s/);
    assert.ok(ent.tiempoSesion(s) <= 33, `${ent.tiempoSesion(s)} min`);
    assert.deepEqual(ent.problemasSesion(S, s, c), []);
  });
}
test('S18, C-TIEMPO-4: perder grasa, 30 min, rodilla B2: con 90 s la superserie no cabe (≈ 33,3 de 33) y va el paso 7 con su aviso', () => {
  const S = nuevoS({ objetivos: ['perder'], nivel: 1, lugares: ['gym'] });
  S.perfil.lesiones.push(L('rodilla', 3));
  const c = ci({ minutos: 30, dolorHoy: { rodilla: 5 } });
  const s = sesionHoy(S, null, c);
  assert.equal(s.ejercicios.filter(x => x.rol === 'principal').length, 0);
  assert.ok(s.explicacion.some(t => /^Con 30 minutos no caben tu cardio de 15 minutos, el trabajo de tu rodilla y fuerza\. Hoy: cardio y rehabilitación\. Si quieres fuerza, elige 45 minutos\.$/.test(t)), s.explicacion.join(' | '));
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});
test('S18: el ejemplo de C-TIEMPO-4 ya no cuenta la superserie con 60 s', () => {
  const sec = criterio.slice(criterio.indexOf('**C-TIEMPO-4'), criterio.indexOf('## 16.'));
  assert.doesNotMatch(sec, /superserie[^.]*con 60 s/);
  assert.match(sec, /90 s/);
});

// ── S16 · En la calle, nada tumbado ni de rodillas (C-EST-4) ──
// Lo que se hace tumbado (boca arriba, boca abajo o de lado), a cuatro patas, de rodillas o sentado en el suelo.
const EN_EL_SUELO = /[Tt]úmbate|[Tt]umbado|boca (arriba|abajo)|cuadrupedia|cuatro patas|[Aa]rrodíllate|[Aa]poya rodillas|[Ss]iéntate en el suelo/;
test('S16, C-EST-4: ningún ejercicio de la calle se hace tumbado, a cuatro patas, de rodillas o sentado en el suelo', () => {
  const mal = cat.EJERCICIOS.filter(e => e.l.includes('calle') && EN_EL_SUELO.test(e.p[0] + ' ' + e.n) && e.id !== 'retraccion-cervical').map(e => e.id);
  assert.deepEqual(mal, []);
  for (const id of ['puente-gluteo', 'dead-bug', 'superman', 'bird-dog', 'rotacion-toracica-cuadrupedia', 'crunch', 'plancha-lateral', 'flexiones-rodillas']) assert.ok(!cat.ex(id).l.includes('calle'), id);
});
test('S16, C-EST-4: la calle sigue teniendo fuerza de su nivel para cada músculo de los cuerpos completos (sin material)', () => {
  for (const nivel of [1, 2, 3]) {
    const S = nuevoS({ objetivos: ['salud'], nivel, lugares: ['calle'], materialCasa: [] });
    const ctx = dia.contextoDia(S, { lugar: 'calle', minutos: 60 });
    const faltan = ['cuadriceps', 'gluteo', 'isquios', 'pecho', 'espalda', 'core', 'hombro']
      .filter(m => !ctx.pool.some(e => e.niv <= nivel && dia.valePrincipal(S, e, ctx, m)));
    assert.deepEqual(faltan, [], `nivel ${nivel}`);
  }
});
test('S16, C-ZONA-0: con la lumbar a 5/10 en la calle hay rehabilitación de fase 1 de pie', () => {
  const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: ['calle'] });
  S.perfil.lesiones.push(L('lumbar', 5));
  const c = ci({ lugar: 'calle', dolorHoy: { lumbar: 5 } });
  const s = sesionHoy(S, null, c);
  const rehab = s.ejercicios.filter(x => x.rol === 'rehab');
  assert.ok(rehab.some(x => lesiones.fasesDe(cat.ex(x.id), 'lumbar').includes(1)), rehab.map(x => x.id).join());
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});
test('S16, C-EST-4: 300 sesiones en la calle (reglas y plan) sin nada tumbado ni de rodillas', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const Z = Object.keys(cat.ZONAS);
  for (let i = 0; i < 300; i++) {
    const S = nuevoS({ objetivos: pick([['musculo'], ['fuerza'], ['perder'], ['salud'], ['resistencia', 'musculo']]), nivel: pick([1, 2, 3]), lugares: ['calle'], materialCasa: pick([[], ['banda'], ['mancuernas', 'banda']]) });
    const z = pick(Z); const hoy = pick([0, 1, 3, 5]);
    if (rnd() < 0.6) S.perfil.lesiones.push(L(z, hoy));
    const c = ci({ lugar: 'calle', minutos: pick([30, 45, 60, 90]), energia: pick([1, 3, 5]), dolorHoy: rnd() < 0.6 ? { [z]: hoy } : {} });
    const plan = rnd() < 0.5 ? ent.planReglas(S, { dias: [1, 3, 5], minutos: c.minutos, lugares: ['calle'] }) : null;
    const s = sesionHoy(S, plan ? plan.dias[0] : null, c);
    const enSuelo = l => l.filter(x => x.id && cat.ex(x.id) && x.id !== 'retraccion-cervical' && (EN_EL_SUELO.test(cat.ex(x.id).p[0] + ' ' + cat.ex(x.id).n) || !cat.ex(x.id).l.includes('calle'))).map(x => x.id);
    assert.deepEqual(enSuelo(todas(s)), [], `#${i}`);
    if (plan) assert.deepEqual(enSuelo(plan.dias.flatMap(d => todas(d))), [], `plan #${i}`);
  }
});

// ── S3 · Aquajogging (C-PISC-2) y T3b (§ 2.5): aprobados, sin la marca de «pendiente» ──
test('S3, T3b: el criterio recoge la aprobación del 23-11-2026 y ya no tiene T3b ni el aquajogging pendientes', () => {
  assert.doesNotMatch(criterio, /pendiente de que Víctor apruebe el texto/);
  assert.match(criterio, /\*\*T3b · Durante la sesión, sin lesiones activas \(botón «Algo va mal»\)\*\* — \*aprobado por Víctor el 23-11-2026\*/);
  const pisc = criterio.slice(criterio.indexOf('**C-PISC-2'), criterio.indexOf('**C-PISC-3'));
  assert.match(pisc, /aprobado por Víctor el 23-11-2026/);
  assert.match(pisc, /donde hace pie/);
  assert.doesNotMatch(fs.readFileSync(ruta('js/areas/entrenador/alarma.js'), 'utf8'), /pendiente de que Víctor apruebe/);
});
test('S3, C-PISC-2: quien no nada 2 × 25 m lleva el aquajogging donde hace pie; en lo hondo, solo con cinturón y sabiendo nadar', () => {
  assert.match(cat.ex('aquajogging').p[0], /^Donde hagas pie.*en la parte honda solo si sabes nadar y con cinturón de flotación/);
  const S = nuevoS({ objetivos: ['salud'], nivel: 3, lugares: ['piscina'], nadar25: false });
  const s = sesionHoy(S, null, ci({ lugar: 'piscina' }));
  const c = s.ejercicios.find(x => x.rol === 'cardio');
  assert.ok(['aquajogging', 'caminar-agua'].includes(c.id), c.id);
  assert.match(c.nota, /Siempre donde hagas pie/);
  assert.ok(!s.ejercicios.some(x => ['nado-continuo', 'crol', 'espalda', 'series-50-crol'].includes(x.id)));
});

// ── S8 · Palabras de alarma (C-ALAR-4): la lista del criterio es la del código ──
test('S8, C-ALAR-4: cada expresión que detecta alarma.js está en la lista del criterio', () => {
  const sec = criterio.slice(criterio.indexOf('**C-ALAR-4'), criterio.indexOf('**C-ALAR-5'));
  const faltan = alarma.EXPRESIONES_ALARMA.filter(src => !sec.includes('`' + src + '`'));
  assert.deepEqual(faltan, []);
});
test('S8, C-ALAR-4: «se me nubló la vista» y «calambre en el brazo izquierdo» avisan (y sus variantes)', () => {
  for (const t of ['se me nubló la vista', 'al acabar se me nubló todo', 'tenía la vista nublada', 'visión borrosa en la cinta', 'veía borroso al levantarme',
    'calambre en el brazo izquierdo', 'me dio un calambre en el brazo izquierdo', 'pinchazo en el brazo izquierdo', 'el brazo izquierdo entumecido', 'opresión en el brazo izquierdo'])
    assert.ok(ent.fraseAlarma(t), `debería avisar: ${t}`);
});
test('S8, C-ALAR-4: sin falsas alarmas por el tiempo, los calambres musculares ni las negaciones', () => {
  for (const t of ['el día estaba nublado', 'cielo nublado y fresco', 'con la vista al frente', 'calambre en el gemelo nadando', 'calambre en el brazo derecho con el curl',
    'me dio un calambre en el brazo con el curl', 'sin visión borrosa', 'no se me nubló la vista', 'nada de calambre en el brazo izquierdo', 'dolor en el codo izquierdo', 'el brazo izquierdo más fuerte que nunca'])
    assert.equal(ent.fraseAlarma(t), null, `no debería avisar: ${t}`);
});

// ── S4 · Con 60 años o más, el equilibrio siempre (C-EDAD-1), también si el ajuste de tiempo quita la rehabilitación ──
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: '', ...o });
const Tn = (n, d = '2 min') => ({ nombre: n, detalle: '', duracion: d });
// Respuesta de la IA como la de la matriz de la verificación (matriz-ia.mjs).
function respuestaIA(lugar, zonas) {
  const deLugar = cat.EJERCICIOS.filter(e => e.l.includes(lugar));
  const fase3 = deLugar.filter(e => zonas.some(z => lesiones.fasesDe(e, z).includes(3))).slice(0, 2).map(e => E(e.id, 'rehab', { reps: '6-8' }));
  const peligrosos = deLugar.filter(e => zonas.some(z => (e.r || {})[z] === 2)).slice(0, 3).map(e => E(e.id));
  const precaucion = deLugar.filter(e => e.t === 'reps' && zonas.some(z => (e.r || {})[z] === 1)).slice(0, 4).map(e => E(e.id, 'principal', { reps: '4-6', descanso: 30 }));
  const otros = deLugar.filter(e => e.t === 'reps' && !(e.r && zonas.some(z => e.r[z]))).slice(0, 3).map(e => E(e.id, 'principal', { series: 8, reps: 'al fallo' }));
  const cardio = deLugar.filter(e => e.m[0] === 'cardio' || ['nado-continuo', 'aquajogging'].includes(e.id)).slice(0, 1).map(e => E(e.id, 'cardio', { reps: '30 min' }));
  const estira = deLugar.filter(e => /estiramiento|postura/.test(e.id)).slice(0, 4).map(e => Tn(e.n, '1 min'));
  return { nombre: 'IA', calentamiento: [Tn('Trote'), Tn('Movilidad')], ejercicios: [...fase3, ...peligrosos, ...precaucion, ...otros, ...cardio], vueltaCalma: estira, cambios: [] };
}
for (const [lugar, obj, nivel, les, hoy, min] of [
  ['piscina', 'salud', 2, [L('tobillo_pie', 2, { desde: '2026-11-01' })], { tobillo_pie: 0 }, 45],
  ['gym', 'resistencia', 1, [L('codo', 2), L('tobillo_pie', 6)], { codo: 6, tobillo_pie: 1 }, 60],
]) {
  test(`S4, C-EDAD-1: 64 años, tobillo en B0-B1 en ${lugar} (IA): el equilibrio queda aunque el tiempo quite su rehabilitación`, () => {
    const S = nuevoS({ objetivos: [obj], nivel, lugares: [lugar], datos: { nacimiento: '1962-01-01' } });
    S.perfil.lesiones.push(...les);
    const c = { lugar, minutos: min, energia: 5, dolorHoy: hoy, origen: 'ia' };
    const v = ent.validarSesion(S, respuestaIA(lugar, les.map(l => l.zona)), c);
    assert.ok(todas(v.sesion).some(x => x.id === 'equilibrio-una-pierna'), v.cambios.join(' | '));
    assert.deepEqual(ent.problemasSesion(S, v.sesion, c), []);
  });
}

// ── Bajos de la verificación ──
test('C-DOLOR-4, CR-01: con la rodilla a 8/10, el equilibrio a una pierna va sobre la pierna que no duele (o no sale)', () => {
  for (const [z, lugar] of [['rodilla', 'gym'], ['cadera_lateral', 'casa'], ['rodilla', 'calle']]) {
    const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: [lugar], datos: { nacimiento: '1958-01-01' } });
    S.perfil.lesiones.push(L(z, 6));
    const s = sesionHoy(S, null, ci({ lugar, dolorHoy: { [z]: 8 } }));
    for (const t of todas(s).filter(x => x.id === 'equilibrio-una-pierna')) assert.match(t.detalle, /pierna que no te duele/, `${z} ${lugar}`);
  }
});
test('C-TIEMPO-1, C-TIEMPO-2, C-EST-4: la vista previa del plan por reglas pasa el validador día a día', () => {
  const casos = [
    [1, ['musculo'], [3], ['gym'], 45, 'rodilla'], [1, ['salud'], [1, 2, 3, 4, 5, 6], ['gym'], 75, 'hombro'], [1, ['musculo'], [1, 2, 3, 4, 5], ['calle'], 45, null],
    [2, ['fuerza'], [1, 3, 5], ['casa'], 45, null], [3, ['musculo', 'perder'], [1, 2, 4, 5], ['gym', 'piscina'], 75, 'rodilla'], [2, ['natacion'], [1, 2, 3, 4, 5, 6], ['calle'], 75, 'hombro'],
  ];
  for (const [nivel, objetivos, dias, lugares, minutos, z] of casos) {
    const S = nuevoS({ objetivos, nivel, lugares, materialCasa: ['mancuernas', 'banda'] });
    if (z) S.perfil.lesiones.push(L(z, 3));
    const p = ent.planReglas(S, { dias, minutos, lugares });
    for (const d of p.dias) assert.deepEqual(ent.problemasSesion(S, d, { lugar: d.lugar, minutos: d.minutos, futuro: true, dolorHoy: {} }), [], `nivel ${nivel} ${objetivos} ${dias.length} días ${lugares} ${z}: ${d.nombre}`);
  }
});
