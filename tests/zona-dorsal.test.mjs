// Zona nueva «Espalda alta (dorsal)» (docs/criterio.md, sección 12.9, pendiente de aprobación de Víctor):
// ficha, etiquetas r.dorsal del catálogo, rehabilitación por fases, techo, validador, día de dolor alto y
// normalizador. Fecha fija: miércoles 18-nov-2026.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, modelo, ponerRed, lesiones as L } from './ayuda/node.mjs';

const norm = await import(modulo('js/nucleo/normalizar.js'));
fijarFecha('2026-11-18T10:00');
const { ZONAS, EJERCICIOS, ex } = cat;
const lesion = (dolor, o = {}) => ({ id: 'l-dorsal', zona: 'dorsal', dolor, activa: true, desde: '2026-01-01', ...o });
const ci = (o = {}) => ({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', ...o });
const rD = id => ((ex(id) || {}).r || {}).dorsal || 0;
const ids = s => [...s.ejercicios.map(x => x.id), ...s.calentamiento.map(t => t.id), ...s.vuelta.map(t => t.id)].filter(Boolean);
const conR = s => s.ejercicios.filter(x => rD(x.id));
const sesionReglas = (perfil, c) => { const S = nuevoS(perfil); return { S, s: modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci(c)).datos), c: ci(c) }; };

// Red simulada para el camino de IA.
let respuesta = null;
beforeEach(() => { ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: structuredClone(respuesta) }) })); });
const T = (n, d = '2 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota de la IA con datos: 3 series de 10 a 40 kg.', ...o });
const IA_ESPALDA = {
  nombre: 'Espalda de la IA', calentamiento: [T('Bici suave', '5 min'), T('Movilidad de hombros')], vueltaCalma: [T('Estiramiento de pecho')],
  ejercicios: ['press-pecho-maquina', 'remo-barra', 'dominadas', 'jalon-pecho', 'remo-sentado-polea', 'remo-mancuerna', 'lenador-polea', 'sentadilla-barra', 'prensa-piernas'].map(id => E(id))
    .concat(E('bici-estatica', 'cardio', { reps: '10 min' })),
};

// ── Datos de la zona ──

const R2 = ['remo-barra', 'buenos-dias', 'sentadilla-barra', 'sentadilla-smith', 'dominadas', 'dominadas-negativas', 'pullover-mancuerna', 'lenador-polea'];
const R1 = ['remo-sentado-polea', 'remo-mancuerna', 'remo-australiano', 'remo-mochila', 'remo-ergometro', 'jalon-pecho', 'jalon-maquina', 'dominadas-asistidas-maquina',
  'dominadas-escapulares', 'press-banca-barra', 'press-hombro-maquina', 'press-militar-mancuernas', 'press-hombro-botellas', 'press-hombro-banda', 'pike-pushup',
  'peso-muerto-rumano', 'peso-muerto-rumano-una-pierna', 'hiperextension-45', 'superman', 'paseo-granjero', 'sentadilla-goblet', 'hip-thrust', 'crunch', 'crunch-maquina',
  'rueda-abdominal', 'pajaros', 'boxeo-sombra', 'crol', 'crol-un-brazo', 'crol-catch-up', 'crol-pull-buoy', 'patada-lateral', 'nado-continuo', 'series-50-crol',
  'buenos-dias-sin-peso']; // S16 (23-11-2026): la bisagra de cadera de pie para la calle

test('C-ZONA-DORSAL: la zona «Espalda alta» existe con todos los campos de una ficha', () => {
  const Z = ZONAS.dorsal;
  assert.ok(Z, 'sin zona dorsal');
  assert.equal(Z.corta, 'Espalda alta');
  assert.equal(Z.nombre, 'Espalda alta (dorsal)');
  assert.ok(Z.icono && Z.desc && Z.consejo);
  assert.deepEqual(Z.techo, { nueva: 3, cronica: 3 });
  assert.equal(Z.detalles, null, 'sin detalle: lo que no es mecánico se consulta');
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) assert.ok(Z.cardio.preferente[lugar].length, lugar);
  assert.ok(Z.calentar.length >= 2 && Z.estirar.length >= 2);
  assert.ok(Z.tareas.calentar.some(t => t.uso === 'activacion' && t.id === 'retraccion-escapular-isometrica'));
  // Derivar: señales propias de la espalda alta (corazón, dolor que no cambia, noche, fiebre, golpe, peso, costillas).
  const der = Z.derivar.join(' | ');
  for (const re of [/pecho/, /112/, /mandíbula/, /no cambia/, /noche/, /fiebre/, /pérdida de peso/, /golpe|caída/, /osteoporosis/, /costillas/, /piernas/]) assert.match(der, re);
});

test('C-ZONA-DORSAL: etiquetas r.dorsal del catálogo (r=2 absoluto, r=1 con dolor 4 o más)', () => {
  const con2 = EJERCICIOS.filter(e => rD(e.id) === 2).map(e => e.id).sort();
  const con1 = EJERCICIOS.filter(e => rD(e.id) === 1).map(e => e.id).sort();
  assert.deepEqual(con2, [...R2].sort());
  assert.deepEqual(con1, [...R1].sort());
  // Lo que se usa para la espalda alta no lleva riesgo en ella.
  for (const id of ['remo-maquina', 'remo-banda', 'remo-toalla', 'jalon-banda', 'face-pull', 'face-pull-banda', 'separacion-banda', 'ytw-tumbado', 'pallof-press', 'espalda', 'press-pecho-maquina'])
    assert.equal(rD(id), 0, id);
});

test('C-ZONA-DORSAL, C-ZONA-0: rehabilitación por fases, sin riesgo en fases 1-2 y como mucho r=1 en la 3', () => {
  const f = L.rehabPorFase('dorsal');
  assert.deepEqual(f[1], ['retraccion-escapular-isometrica']);
  assert.deepEqual([...f[2]].sort(), ['face-pull-banda', 'rotacion-toracica-cuadrupedia', 'separacion-banda', 'ytw-inclinado', 'ytw-tumbado']); // ytw-inclinado: el de pie de la calle (S16)
  assert.deepEqual([...f[3]].sort(), ['face-pull', 'remo-banda', 'remo-mancuerna', 'remo-maquina']);
  for (const id of [...f[1], ...f[2]]) assert.equal(rD(id), 0, id);
  for (const id of f[3]) assert.ok(rD(id) <= 1, id);
  // Fase 1 en todos los lugares (también de pie en la piscina y en la calle).
  for (const l of ['gym', 'casa', 'calle', 'piscina']) assert.ok(ex('retraccion-escapular-isometrica').l.includes(l), l);
  // Dosis de fase 1 (C-DOSIS-7): isométrico 4 × 30-45 s con 30 s.
  assert.deepEqual(L.dosisRehab(ex('retraccion-escapular-isometrica'), 1).series, 4);
  assert.equal(L.dosisRehab(ex('retraccion-escapular-isometrica'), 1).reps, '30-45s');
  // En la piscina no hay fase 2: baja a la fase 1.
  const piscina = EJERCICIOS.filter(e => e.l.includes('piscina')).map(e => e.id);
  assert.deepEqual(L.rehabDeFase('dorsal', 2, { disponibles: piscina }), ['retraccion-escapular-isometrica']);
});

test('C-DOLOR-6: techo 3 en nueva y en crónica; la nota de rehabilitación habla de «tu espalda alta»', () => {
  assert.deepEqual(L.techoDolor('dorsal', { nueva: true }), { techo: 3, sube: 2, irradiado: false });
  assert.equal(L.techoDolor('dorsal', { nueva: false }).techo, 3);
  const n = L.notaRehab('dorsal', { dolor: 2, fase: 2, nueva: false });
  assert.match(n, /^Para tu espalda alta:/);
  assert.match(n, /hasta 3\/10/);
});

test('los ejercicios nuevos de la zona tienen ficha completa', () => {
  for (const id of ['retraccion-escapular-isometrica', 'apertura-libro', 'extension-toracica-silla', 'estiramiento-espalda-alta']) {
    const e = ex(id);
    assert.ok(e, id);
    assert.ok(e.p.length >= 3 && e.e.length >= 2 && e.c, `${id}: pasos, errores y consejo`);
    assert.equal(e.tipo, 'propia', id);
    assert.ok(e.l.length && e.mat.length && e.niv === 1, id);
    assert.equal(e.v, undefined, `${id}: sin vídeo inventado`);
  }
  // Tumbado de lado sobre cada lado: con la cadera lateral activa, fuera (12.1).
  assert.equal(ex('apertura-libro').r.cadera_lateral, 2);
});

test('el normalizador reconoce la zona y sus nombres sueltos', () => {
  assert.equal(norm.zona('dorsal'), 'dorsal');
  assert.equal(norm.zona('Espalda alta'), 'dorsal');
  assert.equal(norm.zona('dorsales'), 'dorsal');
  assert.equal(norm.zona('torácica'), 'dorsal');
});

// ── Validador y sesiones ──

test('C-DOLOR-1, validador: con la espalda alta a 5 (B2) la IA pierde todo lo que la carga (r=2 y r=1) y lleva su fase 1', async () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lesiones: [lesion(3)] });
  respuesta = IA_ESPALDA;
  const c = ci({ forzarIA: true, dolorHoy: { dorsal: 5 } });
  const { sesion } = await ent.crearSesionHoy(c);
  assert.deepEqual(ids(sesion).filter(id => rD(id)), [], 'nada con r en dorsal');
  const rehab = sesion.ejercicios.filter(x => x.rol === 'rehab');
  assert.ok(rehab.length >= 1 && rehab.every(x => L.rehabPorFase('dorsal')[1].includes(x.id)), rehab.map(x => x.id).join(', '));
  assert.ok(rehab.every(x => /^Para tu espalda alta: .*Empiezas en 5\/10/.test(x.nota)), rehab.map(x => x.nota).join(' | '));
  assert.ok(sesion.ejercicios.filter(x => x.rol === 'principal').length >= 3);
  assert.deepEqual(ent.problemasSesion(S, sesion, c), []);
});

test('C-DOLOR-1, C-DOSIS-4, validador: con la espalda alta a 2 (B1) se quita lo r=2 y lo r=1 queda dosificado', async () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lesiones: [lesion(3)] });
  respuesta = IA_ESPALDA;
  const c = ci({ forzarIA: true, dolorHoy: { dorsal: 2 } });
  const { sesion } = await ent.crearSesionHoy(c);
  assert.deepEqual(ids(sesion).filter(id => rD(id) === 2), [], 'nada con r=2');
  const prin = sesion.ejercicios.filter(x => x.rol === 'principal');
  const riesgo = conR(sesion);
  assert.ok(riesgo.length >= 1 && riesgo.length <= 2, `con riesgo: ${riesgo.map(x => x.id).join(', ')}`);
  assert.equal(rD(prin[0].id), 0, 'el primero, sin riesgo en la zona');
  assert.ok(sesion.ejercicios.some(x => x.rol === 'rehab' && L.rehabPorFase('dorsal')[2].includes(x.id)), 'rehabilitación de fase 2');
  assert.deepEqual(ent.problemasSesion(S, sesion, c), []);
});

// En casa con mancuernas: en la calle ya no está el superman (S16, nada tumbado en la calle), que era lo que implicaba la espalda alta.
test('C-DOSIS-4 por reglas: con la espalda alta a 2, lo que la implica lleva la nota con la zona, su dolor y el techo', () => {
  const { S, s, c } = sesionReglas({ objetivos: ['musculo'], nivel: 2, lugares: ['casa'], materialCasa: ['mancuernas'], lesiones: [lesion(3)] }, { lugar: 'casa', minutos: 45, dolorHoy: { dorsal: 2 } });
  const riesgo = conR(s);
  assert.ok(riesgo.length >= 1 && riesgo.length <= 2, riesgo.map(x => x.id).join(', '));
  assert.ok(riesgo.every(x => /tu espalda alta \(2\/10\)/.test(x.nota)), riesgo.map(x => x.nota).join(' | '));
  assert.ok(riesgo.every(x => rD(x.id) === 1));
  assert.deepEqual(ent.problemasSesion(S, s, c), []);
});

test('C-DOLOR-4: día de dolor alto con la espalda alta a 8 (gimnasio y piscina), sin IA', async () => {
  for (const [lugar, minutos] of [['gym', 45], ['piscina', 60], ['casa', 30]]) {
    const S = nuevoS({ objetivos: ['salud'], lugares: [lugar], lesiones: [lesion(3)] });
    respuesta = IA_ESPALDA;
    let peticiones = 0;
    ponerRed(true, async () => { peticiones++; return { ok: true, status: 200, json: async () => ({ sesion: structuredClone(respuesta) }) }; });
    const c = ci({ lugar, minutos, forzarIA: true, dolorHoy: { dorsal: 8 } });
    const { sesion } = await ent.crearSesionHoy(c);
    assert.equal(peticiones, 0, `${lugar}: sin IA`);
    assert.equal(sesion.explicacion[0], ent.T6('dorsal', 8, minutos));
    assert.match(sesion.explicacion[0], /^Tu espalda alta está hoy a 8\/10/);
    assert.deepEqual(sesion.ejercicios.filter(x => x.rol !== 'cardio'), [], `${lugar}: ni fuerza ni rehabilitación`);
    assert.deepEqual(ids(sesion).filter(id => rD(id)), [], `${lugar}: nada con r en dorsal`);
    assert.ok(Math.abs(ent.tiempoSesion(sesion) - minutos) <= 2, `${lugar}: ${ent.tiempoSesion(sesion)} min`);
    assert.ok(sesion.vuelta.length >= 2, `${lugar}: vuelta a la calma`);
    assert.deepEqual(ent.problemasSesion(S, sesion, c), []);
  }
});

test('cada lugar con la espalda alta a 5 tiene fuerza suficiente sin cargarla', () => {
  for (const lugar of ['gym', 'casa', 'calle']) {
    const pool = cat.disponibles({ nivel: 3, lesiones: [], gustos: {}, materialCasa: [] }, lugar, { dolorHoy: { dorsal: 5 } });
    assert.ok(pool.every(e => !rD(e.id)), lugar);
    assert.ok(pool.filter(e => !['cardio', 'movilidad', 'natacion', 'antebrazo'].includes(e.m[0])).length >= 6, lugar);
  }
});
