// Coherencia del catálogo de ejercicios y de las zonas de lesión (de t6_catalogo.mjs de la auditoría).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ruta } from './ayuda/comun.mjs';
import { cat, K, prog } from './ayuda/node.mjs';

const { EJERCICIOS, ZONAS, ex } = cat;
const { MUSCULOS, MATERIAL, LUGARES, MATERIAL_CASA } = K;
const repetidos = a => a.filter((x, i) => a.indexOf(x) !== i);

test('el catálogo tiene 159 ejercicios', () => {
  assert.equal(EJERCICIOS.length, 159);
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
  for (const f of ['dia.js', 'plan.js', 'checkin.js', 'ia.js'].map(f => 'js/areas/entrenador/' + f).concat(['js/reglas/progresion.js', 'js/reglas/contexto.js'])) {
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

// ── Fallos demostrados por la auditoría (PR 9) ──

test('ninguna rehabilitación tiene riesgo en su propia zona', { todo: 'PR 9: rehabilitación con riesgo propio (cadera, rodilla, codo, tobillo, muñeca)' }, () => {
  const mal = [];
  for (const [z, Z] of Object.entries(ZONAS)) for (const id of Z.rehab || []) { const e = ex(id); if (e && (e.r || {})[z]) mal.push(`${z}: ${id} r=${e.r[z]}`); }
  assert.deepEqual(mal, []);
});

test('el tipo de cada ejercicio encaja con la unidad de su dosis', { todo: 'PR 9: «2 anchos» en un ejercicio de distancia' }, () => {
  const mal = EJERCICIOS.filter(e => {
    const r = prog.rango(e.d[1]);
    return !r || (e.t === 'reps' && r.u) || (e.t === 'tiempo' && !['s', 'min'].includes(r.u)) || (e.t === 'distancia' && r.u !== 'm');
  }).map(e => `${e.id}[${e.t}] ${e.d[1]}`);
  assert.deepEqual(mal, []);
});

test('en piscina hay rehabilitación para cada zona', { todo: 'PR 9: piscina sin rehabilitación' }, () => {
  const sinRehab = Object.entries(ZONAS).filter(([, Z]) => !(Z.rehab || []).some(id => ex(id) && ex(id).l.includes('piscina'))).map(([z]) => z);
  assert.deepEqual(sinRehab, []);
});
