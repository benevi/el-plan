// Coherencia del catálogo de ejercicios y de las zonas de lesión (de t6_catalogo.mjs de la auditoría).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ruta } from './ayuda/comun.mjs';
import { cat, K, prog, lesiones } from './ayuda/node.mjs';

const { EJERCICIOS, ZONAS, ex } = cat;
const { MUSCULOS, MATERIAL, LUGARES, MATERIAL_CASA } = K;
const repetidos = a => a.filter((x, i) => a.indexOf(x) !== i);
// Ejercicios de cardio nuevos del PR 8 (C-CARDIO-5): se citan en el criterio y en las fichas.
const CARDIO_PR8 = ['marcha-estatica', 'cardio-sentado', 'nado-continuo', 'series-50-crol'];
const existeOPendiente = id => !!ex(id);

// 159 + 19 nuevos del PR 9 + 4 de cardio del PR 8 (docs/criterio.md, sección 18) + 4 de la espalda alta (sección 12.9)
// + 1 de cardio sentado para pierna y brazo a la vez (S7) + 5 de pie o con apoyo para la calle (S16), decisiones de Víctor
// del 23-11-2026 (C-CARDIO-6, C-EST-4).
test('el catálogo tiene 192 ejercicios', () => {
  assert.equal(EJERCICIOS.length, 192);
});

test('ids y nombres únicos; ids en minúsculas con guiones', () => {
  assert.deepEqual(repetidos(EJERCICIOS.map(e => e.id)), []);
  assert.deepEqual(repetidos(EJERCICIOS.map(e => e.n)), []);
  assert.deepEqual(EJERCICIOS.filter(e => !/^[a-z0-9-]+$/.test(e.id)).map(e => e.id), []);
});

test('cada ejercicio usa músculos, material, lugares y zonas que existen', () => {
  const mal = [];
  for (const e of EJERCICIOS) {
    if (!e.m || !e.m.length) mal.push([e.id, 'sin m']);
    for (const m of [...(e.m || []), ...(e.s || [])]) if (!MUSCULOS[m]) mal.push([e.id, 'músculo', m]);
    if (!e.mat || !e.mat.length) mal.push([e.id, 'sin material']);
    for (const m of e.mat || []) if (!MATERIAL[m]) mal.push([e.id, 'material', m]);
    if (!e.l || !e.l.length) mal.push([e.id, 'sin lugar']);
    for (const l of e.l || []) if (!LUGARES[l]) mal.push([e.id, 'lugar', l]);
    for (const [z, v] of Object.entries(e.r || {})) {
      if (!ZONAS[z]) mal.push([e.id, 'zona', z]);
      if (![1, 2].includes(v)) mal.push([e.id, 'riesgo', v]);
    }
  }
  assert.deepEqual(mal, []);
});

test('nivel, tipo, dosis y pasos con la forma esperada', () => {
  const mal = [];
  for (const e of EJERCICIOS) {
    if (![1, 2, 3].includes(e.niv)) mal.push([e.id, 'niv', e.niv]);
    if (!['reps', 'tiempo', 'distancia'].includes(e.t)) mal.push([e.id, 't', e.t]);
    if (!Array.isArray(e.d) || e.d.length !== 3 || !Number.isInteger(e.d[0]) || typeof e.d[1] !== 'string' || typeof e.d[2] !== 'number') mal.push([e.id, 'd', JSON.stringify(e.d)]);
    if (!e.p || !e.p.length) mal.push([e.id, 'sin pasos']);
    if (e.v != null && !/^[\w-]{11}$/.test(e.v)) mal.push([e.id, 'vídeo', e.v]);
  }
  assert.deepEqual(mal, []);
});

test('las rehabilitaciones de cada zona existen en el catálogo', () => {
  const faltan = [];
  for (const [z, Z] of Object.entries(ZONAS)) for (const id of Z.rehab || []) if (!ex(id)) faltan.push(`${z}: ${id}`);
  assert.deepEqual(faltan, []);
});

test('todo el material de casa lo usa algún ejercicio de casa, y todo material o músculo definido se usa', () => {
  assert.deepEqual(MATERIAL_CASA.filter(m => !EJERCICIOS.some(e => e.l.includes('casa') && e.mat.includes(m))), []);
  assert.deepEqual(Object.keys(MATERIAL).filter(m => !EJERCICIOS.some(e => e.mat.includes(m))), []);
  assert.deepEqual(Object.keys(MUSCULOS).filter(m => !EJERCICIOS.some(e => e.m[0] === m)), []);
});

test('los ids de ejercicio citados en el entrenador y en las reglas existen', () => {
  // Toda la lógica del entrenador (también lo que se le añada); indice.js es la interfaz y cita ids del DOM.
  const entrenador = fs.readdirSync(ruta('js/areas/entrenador')).filter(f => f.endsWith('.js') && f !== 'indice.js').map(f => 'js/areas/entrenador/' + f);
  for (const f of [...entrenador, 'js/reglas/progresion.js', 'js/reglas/contexto.js']) {
    const t = fs.readFileSync(ruta(f), 'utf8');
    // ids entre comillas con al menos una letra (así no cuentan dosis como '8-12')
    const citados = [...new Set([...t.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/g)].map(m => m[1]).filter(id => /[a-z]/.test(id)))];
    assert.deepEqual(citados.filter(id => !ex(id)), [], f);
  }
});

test('cada lugar tiene ejercicios de cardio y de movilidad', () => {
  for (const l of Object.keys(LUGARES)) {
    const p = EJERCICIOS.filter(e => e.l.includes(l));
    assert.ok(p.some(e => e.m[0] === 'cardio'), `${l} sin cardio`);
    assert.ok(p.some(e => e.m[0] === 'movilidad'), `${l} sin movilidad`);
  }
});

// ── Fallos demostrados por la auditoría (cerrados en el PR 9) ──

test('ninguna rehabilitación tiene riesgo en su propia zona', () => {
  const mal = [];
  for (const [z, Z] of Object.entries(ZONAS)) for (const id of Z.rehab || []) { const e = ex(id); if (e && (e.r || {})[z]) mal.push(`${z}: ${id} r=${e.r[z]}`); }
  assert.deepEqual(mal, []);
});

test('el tipo de cada ejercicio encaja con la unidad de su dosis', () => {
  const mal = EJERCICIOS.filter(e => {
    const r = prog.rango(e.d[1]);
    return !r || (e.t === 'reps' && r.u) || (e.t === 'tiempo' && !['s', 'min'].includes(r.u)) || (e.t === 'distancia' && r.u !== 'm');
  }).map(e => `${e.id}[${e.t}] ${e.d[1]}`);
  assert.deepEqual(mal, []);
});

test('en piscina hay rehabilitación para cada zona', () => {
  const sinRehab = Object.entries(ZONAS).filter(([, Z]) => !(Z.rehab || []).some(id => ex(id) && ex(id).l.includes('piscina'))).map(([z]) => z);
  assert.deepEqual(sinRehab, []);
});

// ── Datos de lesiones y catálogo según docs/criterio.md (PR 9) ──
const L = lesiones;
const LUGARES_SECO = ['gym', 'casa', 'calle'];
const tieneR = (id, z) => ((ex(id) || {}).r || {})[z] || 0;
// Perfil mínimo: nivel avanzado (no filtra por nivel), sin material en casa, sin lesiones del perfil.
const perfil = (extra = {}) => ({ nivel: 3, lesiones: [], gustos: {}, materialCasa: [], ...extra });
const banda = { B1: 2, B2: 5 };

test('todos los ids de ejercicio citados en docs/criterio.md existen', () => {
  const t = fs.readFileSync(ruta('docs/criterio.md'), 'utf8');
  const citados = [...new Set([...t.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map(m => m[1]))];
  assert.ok(citados.length > 100, 'el criterio cita muchos ids');
  assert.deepEqual(citados.filter(id => !existeOPendiente(id)), []);
});

test('los 4 ejercicios de cardio del PR 8 están en el catálogo', () => {
  assert.deepEqual(CARDIO_PR8.filter(id => !ex(id)), []);
});

test('las etiquetas de riesgo son las de la tabla 12.10 del criterio (y las de la revisión)', () => {
  const esperado = [
    ['carrera-suave', 'rodilla', 2], ['carrera-suave', 'tobillo_pie', 2], ['carrera-suave', 'lumbar', 1],
    ['comba', 'rodilla', 2], ['comba', 'tobillo_pie', 2], ['comba', 'muñeca', 1], ['comba', 'lumbar', 1],
    ['estiramiento-cuadriceps-pie', 'rodilla', 2], ['postura-nino', 'rodilla', 2], ['estiramiento-flexor-cadera', 'rodilla', 2],
    ['curl-nordico-asistido', 'rodilla', 2], ['sentadilla-isometrica', 'rodilla', 0],
    ['jumping-jacks-sin-salto', 'rodilla', 1], ['jumping-jacks-sin-salto', 'tobillo_pie', 1], ['jumping-jacks-sin-salto', 'hombro', 1],
    ['eliptica', 'rodilla', 1], ['eliptica', 'tobillo_pie', 1], ['talones-pie', 'tobillo_pie', 0], ['talones-rodilla-flexionada', 'tobillo_pie', 0],
    ...['marcha-rapida', 'step-bajo', 'zancadas', 'sentadilla-bulgara', 'step-up', 'sentadilla-goblet', 'sentadilla-smith', 'sentadilla-barra', 'mountain-climbers'].map(id => [id, 'tobillo_pie', 1]),
    ...['tobillo_pie', 'codo', 'muñeca', 'cervical'].map(z => ['paseo-granjero', z, 1]),
    ...['tobillo_pie', 'codo', 'muñeca'].map(z => ['boxeo-sombra', z, 1]),
    ...['codo', 'muñeca', 'hombro'].map(z => ['remo-ergometro', z, 1]),
    ...['crunch', 'crunch-maquina', 'lenador-polea', 'estiramiento-gluteo-rodilla-pecho'].map(id => [id, 'lumbar', 2]), ['plancha', 'lumbar', 0],
    ...['press-hombro-botellas', 'press-hombro-banda', 'fondos-asistidos-maquina', 'extension-triceps-cabeza', 'dislocaciones-banda', 'elevacion-rodillas-barra', 'dominadas-escapulares'].map(id => [id, 'hombro', 2]),
    ['patada-crol-tabla', 'hombro', 1], ['ytw-tumbado', 'hombro', 1],
    ...['curl-mancuernas', 'curl-martillo', 'curl-polea', 'curl-maquina', 'curl-botellas', 'curl-australiano'].map(id => [id, 'codo', 2]), ['curl-banda', 'codo', 1],
    ['remo-australiano', 'codo', 1], ['remo-barra', 'codo', 1], ['fondos-banco', 'muñeca', 2], ['fondos-paralelas', 'muñeca', 2], ['pike-pushup', 'cervical', 2],
    ...['superman', 'elevaciones-laterales-maquina', 'elevaciones-laterales-banda', 'crol-catch-up', 'crol-pull-buoy', 'crol-un-brazo', 'patada-lateral'].map(id => [id, 'cervical', 1]),
    ['estiramiento-figura-4', 'cadera_lateral', 2], ['buenos-dias', 'cadera_lateral', 2], ['paso-lateral-banda', 'cadera_lateral', 0],
    ['talones-toalla-dedos', 'tobillo_pie', 1], ['estiramiento-pectoral-pared', 'hombro', 1],
    // Revisión del PR 9: la negativa termina colgado de la barra (12.5: colgarse es r=2); la asistida sigue en 1.
    ['dominadas-negativas', 'hombro', 2], ['dominadas-asistidas-maquina', 'hombro', 1],
    // Convención del PR 9 (no está en la tabla 12.10): cuadrupedia o de rodillas con la rodilla apoyada = rodilla 1,
    // como bird-dog; así cuadra el «con dolor 4 o más: sin apoyar la rodilla» de la ficha.
    ...['bird-dog', 'gato-camello', 'rotacion-toracica-cuadrupedia', 'flexiones-rodillas', 'patada-gluteo-cuadrupedia', 'rueda-abdominal'].map(id => [id, 'rodilla', 1]),
  ];
  assert.deepEqual(esperado.filter(([id, z, v]) => tieneR(id, z) !== v).map(([id, z, v]) => `${id} ${z}: ${tieneR(id, z)} (esperado ${v})`), []);
});

test('niveles, lugares, dosis y material cambiados en la sección 18', () => {
  assert.equal(ex('curl-nordico-asistido').niv, 3);
  assert.equal(ex('buenos-dias').niv, 3);
  for (const id of ['estiramiento-gemelo-pared', 'estiramiento-hombro-cruzado']) assert.ok(ex(id).l.includes('piscina'), id);
  for (const id of ['postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4', 'gato-camello']) assert.ok(!ex(id).l.includes('calle'), id);
  assert.deepEqual(ex('aquajogging').d, [1, '10-20 min', 0]);
  assert.ok(MATERIAL_CASA.includes('bici') && ex('bici-estatica').mat.includes('bici'));
  assert.equal(cat.hayMaterial(ex('bici-estatica'), 'casa', perfil()), false, 'sin bici en casa no sale');
  assert.equal(cat.hayMaterial(ex('bici-estatica'), 'casa', perfil({ materialCasa: ['bici'] })), true);
  assert.ok(K.MUSCULOS.antebrazo);
});

test('los ejercicios nuevos no llevan vídeo inventado y tienen técnica y errores', () => {
  const nuevos = EJERCICIOS.filter(e => !e.v).map(e => e.id);
  assert.ok(nuevos.length >= 19);
  for (const id of nuevos) { const e = ex(id); assert.ok(e.p.length >= 3 && e.e.length >= 1, id); }
});

test('tipo, rehab y siguiente con la forma del criterio', () => {
  const mal = [];
  for (const e of EJERCICIOS) {
    if (!['compuesto', 'aislamiento', 'corporal', 'propia'].includes(e.tipo)) mal.push([e.id, 'tipo', e.tipo]);
    if (['cardio', 'movilidad', 'natacion'].includes(e.m[0]) && e.tipo !== 'propia') mal.push([e.id, 'tipo de cardio o movilidad', e.tipo]);
    for (const [z, v] of Object.entries(e.rehab || {})) {
      if (!ZONAS[z]) mal.push([e.id, 'rehab zona', z]);
      const o = typeof v === 'object' && !Array.isArray(v) ? v : { fase: v };
      if (![].concat(o.fase).every(f => [1, 2, 3].includes(f))) mal.push([e.id, 'rehab fase', JSON.stringify(v)]);
      for (const d of o.detalle || []) if (!ZONAS[z].detalles || !ZONAS[z].detalles.opciones[d]) mal.push([e.id, 'rehab detalle', d]);
    }
    for (const s of [].concat(e.siguiente || [])) if (!ex(s) || !ex(s).m.includes(e.m[0])) mal.push([e.id, 'siguiente', s]);
  }
  assert.deepEqual(mal, []);
  assert.deepEqual([].concat(ex('flexiones-inclinadas').siguiente, ex('flexiones-rodillas').siguiente, ex('flexiones').siguiente), ['flexiones-rodillas', 'flexiones', 'flexiones-diamante']);
});

test('rehabilitación por fases: fases 1-2 sin riesgo en su zona y fase 3 nunca r=2, con cualquier detalle', () => {
  const mal = [];
  for (const [z, Z] of Object.entries(ZONAS)) {
    const detalles = Z.detalles ? Object.keys(Z.detalles.opciones) : [null];
    for (const d of detalles) {
      const f = L.rehabPorFase(z, d);
      for (const id of [...f[1], ...f[2]]) if (L.riesgoDetalle(ex(id), z, d)) mal.push(`${z}/${d} fase 1-2: ${id} r=${L.riesgoDetalle(ex(id), z, d)}`);
      for (const id of f[3]) if (L.riesgoDetalle(ex(id), z, d) > 1) mal.push(`${z}/${d} fase 3: ${id} r=2`);
      for (const n of [1, 2, 3]) if (!f[n].length) mal.push(`${z}/${d}: sin fase ${n}`);
    }
    assert.deepEqual(Z.fases, L.rehabPorFase(z), z);
    assert.deepEqual(Z.rehab, [...new Set([...Z.fases[1], ...Z.fases[2]])], z);
  }
  assert.deepEqual(mal, []);
});

test('las fichas siguen el criterio: lo que sale y lo que entra en la rehabilitación', () => {
  const r = z => ZONAS[z].rehab, f3 = z => ZONAS[z].fases[3];
  assert.ok(!r('cadera_lateral').includes('abduccion-tumbada') && f3('cadera_lateral').includes('abduccion-tumbada'));
  assert.ok(!r('hombro').includes('ytw-tumbado') && f3('hombro').includes('ytw-tumbado'));
  assert.ok(!r('codo').includes('curl-martillo') && !r('codo').includes('extension-triceps-banda'));
  assert.ok(!r('muñeca').includes('dead-bug') && !r('muñeca').includes('bird-dog'));
  assert.ok(r('cervical').includes('retraccion-cervical'));
  assert.ok(r('lumbar').includes('descarga-90-90') && !r('lumbar').includes('gato-camello'));
  assert.deepEqual(L.rehabPorFase('tobillo_pie', 'aquiles')[2], ['talones-pie', 'talones-rodilla-flexionada', 'talones-agua']);
  assert.ok(L.rehabPorFase('tobillo_pie', 'fascitis')[3].includes('talones-toalla-dedos') && !L.rehabPorFase('tobillo_pie', 'aquiles')[3].includes('talones-toalla-dedos'));
  assert.ok(L.rehabPorFase('codo', 'dentro')[2].includes('flexion-muneca-excentrica') && !L.rehabPorFase('codo')[2].includes('flexion-muneca-excentrica'));
  // Estiramientos que comprimen o empeoran (C-EST-3): fuera de las fichas.
  assert.ok(!ZONAS.cadera_lateral.estirar.some(t => /piriforme|cuádriceps/i.test(t)));
  assert.ok(!ZONAS.rodilla.estirar.some(t => /cuádriceps/i.test(t)) && ZONAS.rodilla.estirar.includes(ex('estiramiento-flexor-cadera-pie').n));
  assert.ok(![...ZONAS.lumbar.calentar, ...ZONAS.lumbar.estirar].some(t => /rodillas al pecho/i.test(t)));
  assert.ok(!ZONAS.hombro.estirar.some(t => /tríceps/i.test(t)));
});

test('detalle de la lesión: opciones por zona, por defecto lo más prudente', () => {
  const opciones = Object.fromEntries(Object.entries(ZONAS).filter(([, Z]) => Z.detalles).map(([z, Z]) => [z, Object.keys(Z.detalles.opciones)]));
  assert.deepEqual(opciones, { lumbar: ['contractura', 'hernia'], codo: ['fuera', 'dentro'], cervical: ['contractura', 'irradiado'], tobillo_pie: ['esguince', 'fascitis', 'aquiles'] });
  assert.equal(L.detalleDe('tobillo_pie'), 'esguince');
  assert.equal(L.detalleDe('lumbar', 'raro'), 'hernia');
  assert.equal(L.detalleDe('codo'), 'fuera');
  assert.equal(L.detalleDe('rodilla', 'esguince'), null);
  const e = ex('estiramiento-gluteo-rodilla-pecho');
  assert.equal(L.riesgoDetalle(e, 'lumbar'), 2, 'sin detalle: rodillas al pecho fuera');
  assert.equal(L.riesgoDetalle(e, 'lumbar', 'contractura'), 1);
});

test('techo de dolor por zona y detalle (C-DOLOR-6)', () => {
  const t = (z, o) => L.techoDolor(z, o).techo;
  assert.equal(t('cadera_lateral', { nueva: true }), 3);
  for (const z of ['cadera_lateral', 'hombro', 'codo']) assert.equal(t(z, { nueva: false }), 5, z);
  for (const z of ['rodilla', 'muñeca', 'lumbar', 'cervical']) assert.equal(t(z, { nueva: false }), 3, z);
  assert.equal(t('tobillo_pie', { nueva: false }), 3, 'sin detalle, como esguince');
  assert.equal(t('tobillo_pie', { nueva: false, detalle: 'fascitis' }), 5);
  assert.equal(t('hombro', { nueva: false, rehab: true }), 3, 'en la rehabilitación, 3');
  assert.equal(L.techoDolor('cervical', { detalle: 'irradiado' }).sube, 0);
  assert.equal(L.techoDolor('lumbar', {}).sube, 0, 'lumbar sin detalle: como dolor que baja por la pierna');
  assert.equal(L.techoDolor('lumbar', { detalle: 'contractura' }).sube, 2);
});

test('las notas de rehabilitación usan el dolor real y el techo, no un «3/10» fijo', () => {
  const n1 = L.notaRehab('hombro', { dolor: 1, fase: 2, nueva: false });
  assert.match(n1, /1\/10/); assert.match(n1, /hasta 3\/10/);
  const n0 = L.notaRehab('cadera_lateral', { dolor: 0, fase: 3, nueva: false });
  assert.match(n0, /0\/10/); assert.match(n0, /hasta 2\/10/);
  assert.match(L.notaRehab('rodilla', { dolor: 5, fase: 1 }), /5\/10: no debe subir/);
  assert.match(L.notaRehab('cervical', { dolor: 2, detalle: 'irradiado' }), /baja hacia el brazo, para/);
  assert.match(L.notaRehab('lumbar', { dolor: 2 }), /baja hacia la pierna, para/, 'lumbar sin detalle: como dolor que baja');
  assert.match(L.notaRehab('muñeca', {}), /2 puntos/);
  for (const z of Object.keys(ZONAS)) assert.doesNotMatch(L.notaRehab(z, { dolor: 3 }), /diagn|tratamiento|curar/i);
});

test('fichas: tareas de calentar y estirar con ids que existen, uso válido y sin riesgo «evitar» en su zona', () => {
  const mal = [];
  for (const [z, Z] of Object.entries(ZONAS)) {
    for (const t of [...Z.tareas.calentar, ...Z.tareas.estirar]) {
      if (!['alivio', 'normal', 'activacion'].includes(t.uso)) mal.push(`${z}: uso ${t.uso}`);
      if (t.uso === 'activacion' && !ZONAS[z].fases[1].includes(t.id)) mal.push(`${z}: activación ${t.id} que no es de su fase 1`);
      if (!t.id === !t.texto) mal.push(`${z}: tarea sin id ni texto, o con los dos`);
      if (t.id && !ex(t.id)) mal.push(`${z}: ${t.id} no existe`);
      if (t.id && L.riesgoDetalle(ex(t.id), z, (t.detalle || [])[0]) === 2) mal.push(`${z}: ${t.id} tiene r=2 en su zona`);
      // De alivio y con riesgo en la zona, solo si el detalle lo dice (rodillas al pecho con contractura lumbar).
      const op = Z.detalles && t.detalle ? Z.detalles.opciones[t.detalle[0]] : null;
      if (t.uso === 'alivio' && t.id && L.riesgoDetalle(ex(t.id), z, (t.detalle || [])[0]) && !(op && (op.alivio || []).includes(t.id))) mal.push(`${z}: ${t.id} de alivio con riesgo en la zona`);
    }
    if (!Z.estirar.length || !Z.calentar.length) mal.push(`${z}: sin tareas`);
    if (!Z.derivar || !Z.derivar.length) mal.push(`${z}: sin derivar`);
    for (const lugar of ['gym', 'casa', 'calle', 'piscina']) for (const id of Z.cardio.preferente[lugar] || []) {
      if (!existeOPendiente(id)) mal.push(`${z}: cardio ${id} no existe`);
      else if (ex(id) && !ex(id).l.includes(lugar)) mal.push(`${z}: cardio ${id} no se hace en ${lugar}`);
    }
    for (const id of Object.keys(Z.cardio.condiciones)) if (!existeOPendiente(id)) mal.push(`${z}: condición de ${id}`);
  }
  assert.deepEqual(mal, []);
});

test('todo id del cardio preferente de las fichas existe (también los del PR 8)', () => {
  const faltan = [];
  for (const [z, Z] of Object.entries(ZONAS)) for (const id of [...Object.values(Z.cardio.preferente).flat(), ...Object.keys(Z.cardio.condiciones)]) if (!ex(id)) faltan.push(`${z}: ${id}`);
  assert.deepEqual(faltan, []);
});

test('el «evitar» de cada ficha cuadra con el catálogo: absoluto si hay r=2, «con dolor 4 o más» si hay r=1', () => {
  for (const [z, Z] of Object.entries(ZONAS)) {
    const con = EJERCICIOS.filter(e => (e.r || {})[z]);
    const abs = Z.evitar.filter(t => !/^Con dolor 4 o más/.test(t)), prec = Z.evitar.filter(t => /^Con dolor 4 o más/.test(t));
    if (con.some(e => e.r[z] === 2)) assert.ok(abs.length, `${z}: sin evitar absoluto`);
    if (con.some(e => e.r[z] === 1)) assert.ok(prec.length, `${z}: sin «con dolor 4 o más»`);
    assert.ok(!Z.evitar.some(t => /m[aá]quina aductora/i.test(t)), `${z}: cita un ejercicio que no hay`);
  }
});

test('en la calle y en la piscina, los estiramientos que se proponen son de pie o en el borde (C-EST-4)', () => {
  for (const id of ['estiramiento-pectoral-pared', 'estiramiento-isquios-pie', 'estiramiento-flexor-cadera-pie']) for (const l of ['calle', 'piscina']) assert.ok(ex(id).l.includes(l), `${id} en ${l}`);
});

test('cada zona, banda y lugar tiene rehabilitación, fuerza, estiramientos y cardio suficientes', () => {
  const mal = [];
  const ids = l => new Set(l.map(e => e.id));
  for (const z of Object.keys(ZONAS)) {
    for (const [b, dolor] of Object.entries(banda)) {
      for (const lugar of [...LUGARES_SECO, 'piscina']) {
        const pool = cat.disponibles(perfil(), lugar, { dolorHoy: { [z]: dolor } });
        const hay = ids(pool);
        const fuerza = pool.filter(e => !['cardio', 'movilidad', 'natacion', 'antebrazo'].includes(e.m[0]) && !(e.rehab || {})[z]);
        const estirar = pool.filter(e => e.m[0] === 'movilidad' && e.t === 'tiempo');
        const fase = b === 'B2' ? 1 : 2;
        // B2 → fase 1 en cualquier lugar (también piscina; C-DOLOR-3), con cada detalle de la zona.
        // B1 → fase 2 en el gimnasio; en la piscina, fase 2 o, si no hay, fase 1 (rehabDeFase).
        const detalles = ZONAS[z].detalles ? Object.keys(ZONAS[z].detalles.opciones) : [undefined];
        for (const d of detalles) {
          if (b === 'B2' && !L.rehabDeFase(z, 1, { detalle: d, disponibles: hay }).length) mal.push(`${z}/${d} B2 ${lugar}: sin fase 1`);
          if (b === 'B1' && ['gym', 'piscina'].includes(lugar) && !L.rehabDeFase(z, fase, { detalle: d, disponibles: hay }).length) mal.push(`${z}/${d} B1 ${lugar}: sin fase 2 ni 1`);
        }
        if (lugar !== 'piscina' && fuerza.length < 6) mal.push(`${z} ${b} ${lugar}: solo ${fuerza.length} de fuerza`);
        if (estirar.length < 2) mal.push(`${z} ${b} ${lugar}: ${estirar.length} estiramientos`);
        if (lugar === 'gym' && !['bici-estatica', 'eliptica', 'cinta-inclinada', 'remo-ergometro'].some(id => hay.has(id))) mal.push(`${z} ${b} gym: sin cardio`);
        if (lugar === 'piscina' && !['aquajogging', 'caminar-agua', 'nado-continuo'].some(id => hay.has(id))) mal.push(`${z} ${b} piscina: sin bloque continuo`);
      }
    }
  }
  assert.deepEqual(mal, []);
});

test('en casa y en la calle hay cardio permitido con lesiones de carga (cadera, rodilla, tobillo, lumbar) en B2', () => {
  // Casa sin material ni bici y calle (C-CARDIO-5): cardio continuo o bloque encadenado sin r en la zona.
  const cardio = { casa: ['bici-estatica', 'marcha-estatica', 'step-bajo', 'jumping-jacks-sin-salto', 'boxeo-sombra', 'comba', 'cardio-sentado'], calle: ['marcha-rapida', 'carrera-suave', 'comba', 'cardio-sentado'] };
  const mal = [];
  for (const z of ['cadera_lateral', 'rodilla', 'tobillo_pie', 'lumbar']) for (const lugar of ['casa', 'calle']) {
    const hay = new Set(cat.disponibles(perfil(), lugar, { dolorHoy: { [z]: banda.B2 } }).map(e => e.id));
    if (!cardio[lugar].some(id => hay.has(id))) mal.push(`${z} B2 ${lugar}`);
  }
  assert.deepEqual(mal, []);
});

test('dosis de rehabilitación por fase (C-DOSIS-7 y fichas)', () => {
  const D = (id, f) => L.dosisRehab(ex(id), f);
  for (const id of ['abduccion-isometrica-pared', 'rotacion-externa-isometrica', 'extension-rodilla-isometrica', 'talones-isometrico', 'extension-muneca-isometrica']) assert.deepEqual([D(id, 1).series, D(id, 1).reps, D(id, 1).descanso], [4, id === 'abduccion-isometrica-pared' ? '30-45s c/lado' : '30-45s', 30], id); // «c/lado» se conserva (E6)
  assert.deepEqual([D('puente-gluteo', 1).series, D('puente-gluteo', 1).reps], [3, '10']);
  assert.match(D('puente-gluteo', 1).intensidad, /lento/);
  assert.deepEqual([D('separacion-banda', 1).series, D('separacion-banda', 1).reps], [2, '15']);
  assert.match(D('separacion-banda', 1).intensidad, /muy ligera/);
  assert.deepEqual([D('separacion-banda', 2).series, D('separacion-banda', 2).reps, D('separacion-banda', 2).descanso], [3, '15-20', 45]);
  assert.deepEqual([D('dead-bug', 1).series, D('dead-bug', 1).reps], [3, '8 c/lado']);
  assert.deepEqual([D('prension-pelota', 1).series, D('prension-pelota', 1).reps], [3, '10 × 5 s']);
  assert.deepEqual([D('descarga-90-90', 1).reps, D('descarga-90-90', 1).descanso], ['2-3 min', 0]);
  assert.deepEqual([D('almeja', 2).series, D('almeja', 2).reps, D('almeja', 2).descanso], [3, '15 c/pierna', 45]);
  assert.match(D('extension-muneca-excentrica', 2).intensidad, /3 s al bajar/);
  assert.deepEqual([D('puente-una-pierna', 3).series, D('puente-una-pierna', 3).reps, D('puente-una-pierna', 3).descanso], [3, '8-12 c/pierna', 60]);
  assert.deepEqual([D('talones-toalla-dedos', 3).series, D('talones-toalla-dedos', 3).reps], [3, '12']);
  // Toda la rehabilitación tiene dosis válida en todas sus fases.
  for (const [z, Z] of Object.entries(ZONAS)) for (const f of [1, 2, 3]) for (const id of Z.fases[f]) {
    const d = D(id, f);
    assert.ok(Number.isInteger(d.series) && d.series >= 1 && d.series <= 4 && prog.rango(d.reps) && d.descanso >= 0 && d.intensidad, `${z} ${id} fase ${f}`);
  }
});

test('rehabDeFase: en B1 sin fase 2 en el lugar baja a la fase 1', () => {
  const pis = new Set(cat.disponibles(perfil(), 'piscina').map(e => e.id));
  for (const z of ['lumbar', 'codo', 'muñeca']) {
    assert.deepEqual(L.rehabDeFase(z, 2, { disponibles: pis }), L.rehabDeFase(z, 1, { disponibles: pis }), z);
    assert.ok(L.rehabDeFase(z, 2, { disponibles: pis }).length, z);
  }
  assert.deepEqual(L.rehabDeFase('hombro', 2, { disponibles: pis }), ['rotacion-hombro-agua']);
});

test('con Aquiles, ni movilidad de tobillo a la pared ni estiramiento de gemelo en la ficha', () => {
  const tareas = [...ZONAS.tobillo_pie.tareas.calentar, ...ZONAS.tobillo_pie.tareas.estirar];
  for (const id of ['movilidad-tobillo-pared', 'estiramiento-gemelo-pared']) assert.deepEqual(tareas.find(t => t.id === id).detalle, ['esguince', 'fascitis'], id);
});
