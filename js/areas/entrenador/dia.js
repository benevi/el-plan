// Área ENTRENADOR · el día: una sesión completa con reglas (sin IA).
// Dosis por objetivo y nivel, la regla de cardio, el porqué de cada ejercicio y el tiempo que lleva.
// También las piezas que usa el validador (validar.js) para completar o rehacer una sesión: bandas de
// dolor, cardio, rehabilitación, calentamiento y vuelta a la calma. Reglas: docs/criterio.md (ids C-…).

import { analizarEjercicios, preferencia } from '../../reglas/contexto.js';
import { cargaMuscular, rango, sesionesHechas } from '../../reglas/progresion.js';
import { ex, riesgo, hayMaterial, EJERCICIOS, ZONAS, fasesDe, dosisRehab, notaRehab, riesgoDetalle, techoDolor as techoZona, bandasZonas, nivelesDe, riesgoHoy, faseLesion, alternativas, detalleDe } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS, OBJETIVOS } from '../../datos/constantes.js';
import { semanaISO } from '../../nucleo/modelo.js';
import { restriccionesSalud } from './salud.js';
import { validarSesion, problemasSesion } from './validar.js';

// ── Plantillas de día: huecos por músculo principal, del más importante al menos ──
export const PLANTILLAS = {
  fullA: { nombre: 'Cuerpo completo A', huecos: ['cuadriceps', 'espalda', 'pecho', 'isquios', 'hombro', 'core', 'gluteo', 'biceps', 'triceps'] },
  fullB: { nombre: 'Cuerpo completo B', huecos: ['gluteo', 'pecho', 'espalda', 'cuadriceps', 'hombro', 'core', 'triceps', 'biceps', 'isquios'] },
  // C-REP-4: cada cuerpo completo lleva empuje, tirón, dominante de rodilla y de cadera en sus 4 primeros huecos.
  fullC: { nombre: 'Cuerpo completo C', huecos: ['isquios', 'espalda', 'hombro', 'cuadriceps', 'pecho', 'core', 'gluteo', 'gemelo', 'biceps'] },
  torso: { nombre: 'Torso', huecos: ['pecho', 'espalda', 'hombro', 'espalda', 'pecho', 'triceps', 'biceps', 'core'] },
  pierna: { nombre: 'Pierna y glúteo', huecos: ['cuadriceps', 'gluteo', 'isquios', 'cuadriceps', 'gluteo', 'gemelo', 'core'] },
  empuje: { nombre: 'Empuje', huecos: ['pecho', 'hombro', 'pecho', 'triceps', 'hombro', 'core', 'triceps'] },
  tiron: { nombre: 'Tirón', huecos: ['espalda', 'espalda', 'isquios', 'biceps', 'hombro', 'core', 'biceps'] },
  salud: { nombre: 'Salud y movilidad', huecos: ['gluteo', 'espalda', 'core', 'cuadriceps', 'hombro', 'core', 'isquios'] },
  // Día suave (C-REP-2): cardio, core y movilidad; lo pide el reparto del plan (PR 10).
  suave: { nombre: 'Día suave', huecos: ['core', 'core', 'core', 'gluteo', 'core'] },
  piscina: { nombre: 'Piscina', huecos: ['natacion', 'natacion', 'natacion', 'gluteo', 'natacion', 'core'] },
};
// Plantilla que vale para el lugar: la de piscina solo en el agua y ninguna de seco en el agua (C-PISC-1).
export const tipoParaLugar = (tipo, lugar) => (lugar === 'piscina' ? 'piscina' : !tipo || tipo === 'piscina' || !PLANTILLAS[tipo] ? 'fullA' : tipo);

const MOVILIDAD = {
  superior: ['circulos-brazos', 'dislocaciones-banda', 'rotacion-toracica-cuadrupedia'],
  inferior: ['circulos-cadera', 'balanceo-pierna-frontal', 'movilidad-tobillo-pared'],
  core: ['gato-camello'],
};
const SUPERIOR = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'];
const ESTIRA = {
  pecho: ['estiramiento-pectoral-puerta'], hombro: ['estiramiento-hombro-cruzado'], espalda: ['postura-nino', 'estiramiento-hombro-cruzado'], triceps: ['estiramiento-hombro-cruzado'],
  biceps: ['estiramiento-pectoral-puerta'], cuadriceps: ['estiramiento-cuadriceps-pie', 'estiramiento-flexor-cadera'], isquios: ['estiramiento-isquios-tumbado'],
  gluteo: ['estiramiento-gluteo-rodilla-pecho', 'estiramiento-figura-4'], gemelo: ['estiramiento-gemelo-pared'], core: ['gato-camello'],
  natacion: ['estiramiento-hombro-cruzado'], cardio: ['estiramiento-gemelo-pared'],
};
// Estiramientos sin id para completar la vuelta en cualquier lugar (de pie), con su riesgo por zona como en el
// catálogo (S2, C-EST-2): con esa zona en B2 o más no salen. El validador los comprueba por el nombre.
const ESTIRA_LIBRE = {
  piscina: [['Estiramiento de hombros en el borde', 'Agarrado al borde, deja caer el pecho hacia el agua, 30 s.', { hombro: 1, dorsal: 1 }], ['Estiramiento de gemelos en el borde', 'Puntas contra la pared de la piscina y talón abajo, 30 s por pierna.', { tobillo_pie: 1 }], ['Estiramiento de espalda en el borde', 'Agarrado al borde con los brazos estirados, lleva la cadera atrás, 30 s.', { hombro: 1, dorsal: 1, lumbar: 1 }]],
  otro: [['Estiramiento de pecho de pie', 'Mano en una pared a la altura del hombro; gira el cuerpo al lado contrario, 30 s por lado.', { hombro: 1 }], ['Estiramiento de gemelos de pie', 'Manos en la pared, una pierna atrás con el talón apoyado, 30 s por pierna.', { tobillo_pie: 1 }], ['Estiramiento de espalda de pie', 'Manos juntas al frente, redondea la espalda y empuja las manos lejos, 30 s.', { lumbar: 1, dorsal: 1 }]],
};
// Último recurso si ningún estiramiento vale hoy (siempre hay uno en la vuelta, C-PRIN-4).
export const ESTIRA_SUAVE = ['Estiramiento suave de lo que no te duele', 'Lento, 30 s por lado, sin tocar la zona que duele.'];
const RIESGO_LIBRE = Object.fromEntries([...ESTIRA_LIBRE.piscina, ...ESTIRA_LIBRE.otro].map(([n, , r]) => [n, r]));
export const libresDe = lugar => ESTIRA_LIBRE[lugar === 'piscina' ? 'piscina' : 'otro'];
// En la calle, nada tumbado ni de rodillas (C-EST-4).
const TUMBADO = ['postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4', 'gato-camello', 'estiramiento-gluteo-rodilla-pecho', 'estiramiento-flexor-cadera', 'rotacion-toracica-cuadrupedia', 'dead-bug']; // dead-bug: la activación lumbar
// Ejercicios de referencia por músculo, de más a menos preferido (si son seguros y caben en el lugar y el nivel).
const BASE = {
  pecho: ['press-pecho-maquina', 'press-banca-mancuernas', 'press-inclinado-mancuernas', 'press-inclinado-maquina', 'press-banca-barra', 'flexiones', 'flexiones-inclinadas', 'flexiones-rodillas'],
  espalda: ['jalon-pecho', 'remo-sentado-polea', 'remo-mancuerna', 'dominadas-asistidas-maquina', 'remo-maquina', 'dominadas', 'remo-australiano', 'remo-banda', 'jalon-banda'],
  hombro: ['press-hombro-maquina', 'press-militar-mancuernas', 'elevaciones-laterales', 'elevaciones-laterales-maquina', 'face-pull', 'pajaros', 'elevaciones-laterales-banda', 'face-pull-banda'],
  cuadriceps: ['prensa-piernas', 'sentadilla-goblet', 'sentadilla-smith', 'extension-cuadriceps', 'step-up', 'zancadas', 'sentadilla-peso-corporal'],
  gluteo: ['hip-thrust', 'gluteo-maquina', 'puente-gluteo', 'abductor-maquina', 'patada-gluteo-polea', 'puente-banda-rodillas'],
  isquios: ['peso-muerto-rumano', 'curl-femoral-tumbado', 'curl-femoral-sentado', 'puente-talones-elevados', 'hiperextension-45', 'curl-femoral-deslizante'],
  biceps: ['curl-mancuernas', 'curl-polea', 'curl-martillo', 'curl-maquina'],
  triceps: ['extension-triceps-polea', 'fondos-asistidos-maquina', 'triceps-maquina', 'extension-triceps-cabeza', 'fondos-banco', 'extension-triceps-banda'],
  core: ['plancha', 'pallof-press', 'dead-bug', 'plancha-lateral', 'bird-dog', 'crunch-maquina', 'crunch'],
  gemelo: ['talones-pie', 'talones-prensa', 'talones-sentado'],
};
const extraBase = (m, id) => { const i = (BASE[m] || []).indexOf(id); return i < 0 ? 0 : 4 - i * 0.4; };

export const objetivosDe = S => (S.perfil.objetivos.length ? S.perfil.objetivos : ['salud']);
export const tiene = (S, o) => objetivosDe(S).includes(o);
export const esFuerza = e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]);
export const esCompuesto = e => (e.s || []).length > 0 && !/aperturas|cruces|elevacion|curl|extension|patada|abduc|face-pull|pajaros|crunch|talones|plancha/.test(e.id);
export const minDe = txt => { const r = rango(txt); return !r ? 0 : r.u === 'min' ? r.hi : r.u === 's' ? r.hi / 60 : 0; };
export const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
export const minus = t => String(t || '').toLowerCase();
// En minúsculas, pero la letra del día sigue en mayúscula: «cuerpo completo A» (M15 del informe del 21-11).
export const minusNombre = t => minus(t).replace(/ ([a-z])$/, (_, l) => ' ' + l.toUpperCase());
export const nombreZona = z => minus((ZONAS[z] || {}).corta || String(z).replace(/_/g, ' '));
export const esEstiramiento = t => !!t && ((typeof t.nombre === 'string' && /estir|postura|flotaci/i.test(t.nombre)) || (typeof t.id === 'string' && /estiramiento|postura-nino|flotacion/.test(t.id)));
// Edad en años a partir del año de nacimiento (null si no lo sabemos).
export function edadDe(S) {
  const a = +String((S.perfil.datos || {}).nacimiento || '').slice(0, 4);
  return a > 1900 ? new Date().getFullYear() - a : null;
}
// Minutos de la sesión: el check-in y el perfil solo ofrecen 30, 45, 60, 75 y 90 (criterio §0). Menos de 30 se
// trata como 30; lo demás se lleva a la opción más cercana (así nadie recibe un día de 240 minutos).
const OPCIONES_MIN = [30, 45, 60, 75, 90];
export const minutosSesion = m => { const n = +m || 60; return OPCIONES_MIN.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)); };

// ── Tipo de ejercicio (C-DOSIS-1). Con el campo `tipo` del catálogo (PR 9) manda él. ──
const PROPIA = /plancha|dead-bug|bird-dog|pallof/;
export function tipoEj(e) {
  if (e.tipo) return e.tipo;
  if (!esFuerza(e) || PROPIA.test(e.id) || e.t !== 'reps') return 'propia';
  if (esCompuesto(e)) return e.mat.every(m => ['peso corporal', 'barra fija', 'banco'].includes(m)) ? 'corporal' : 'compuesto';
  return 'aislamiento';
}
// Aislamientos de hombro: nunca por debajo de 12 repeticiones (C-DOSIS-3).
export const AISLA_HOMBRO = ['elevaciones-laterales', 'elevaciones-laterales-maquina', 'elevaciones-laterales-banda', 'pajaros', 'face-pull', 'face-pull-banda', 'rotacion-externa-banda'];
// Descanso mínimo por el límite inferior del rango (C-PAUSA-1).
export function pausaMinima(tipo, lo) {
  if (!(lo > 0) || !['compuesto', 'corporal', 'aislamiento'].includes(tipo)) return 0;
  if (tipo === 'aislamiento') return lo <= 10 ? 60 : lo <= 15 ? 45 : 30;
  return lo <= 6 ? 120 : lo <= 10 ? 90 : lo <= 15 ? 60 : 45;
}

// ── Dosis por objetivo principal, nivel y tipo de ejercicio (C-DOSIS-2 a 6, C-OBJ-1 a 3, C-PAUSA-1) ──
const COMPUESTO = { // [principiante, intermedio, avanzado] → [series, reps, descanso]
  fuerza: [[3, '6-8', 150], [4, '4-6', 150], [4, '3-6', 180]],
  musculo: [[3, '8-12', 120], [3, '6-10', 120], [4, '6-10', 120]],
  perder: [[3, '10-12', 90], [3, '8-12', 90], [3, '8-12', 90]],
  resistencia: [[2, '12-15', 60], [3, '12-15', 60], [3, '12-20', 60]],
  salud: [[2, '12-15', 60], [3, '10-12', 90], [3, '8-12', 90]],
};
const ACCESORIO = [[3, '10-12', 90], [3, '8-12', 90], [3, '8-12', 90]];
const AISLAMIENTO = { fuerza: [3, '10-12', 60], musculo: [3, '10-15', 60], perder: [3, '12-15', 45], resistencia: [3, '12-15', 45], salud: [2, '12-15', 45] };
export function dosis(S, e, i, _lugar) {
  const nivel = Math.max(1, Math.min(3, S.perfil.nivel || 1));
  const tipo = tipoEj(e);
  if (tipo === 'propia') {
    if (e.t === 'tiempo' && PROPIA.test(e.id)) { // C-DOSIS-6; «c/lado» se conserva (dos lados en el cronómetro)
      const lado = (String(e.d[1]).match(/\s+(c\/\s*\S+|por lado|cada lado)\s*$/i) || [''])[0];
      return { series: nivel === 1 ? 2 : 3, reps: (nivel === 1 ? '15-30 s' : '20-45 s') + lado, descanso: 45 };
    }
    return { series: e.d[0], reps: e.d[1], descanso: e.d[2] };
  }
  const objs = objetivosDe(S), prin = COMPUESTO[objs[0]] ? objs[0] : 'salud';
  const sec = o => objs.slice(1).includes(o);
  const uni = / c\//.test(e.d[1]) ? ' c/' + e.d[1].split(' c/')[1] : '';
  let d;
  if (tipo === 'aislamiento') {
    d = (AISLAMIENTO[prin] || AISLAMIENTO.salud).slice();
    if ((prin === 'perder' || prin === 'resistencia') && nivel === 1) d[0] = 2;
    if (sec('musculo')) d = [3, '10-15', d[2]];
    else if (sec('perder')) d[1] = '10-15';
  } else if (tipo === 'corporal') {
    d = [3, nivel === 1 ? '6-12' : '8-15', 0]; // C-DOSIS-5
  } else if (i < 2) {
    d = COMPUESTO[prin][nivel - 1].slice();
    if (i === 0 && sec('fuerza')) d = nivel === 1 ? [3, '6-8', 150] : [4, '5-6', 150]; // C-OBJ-2
  } else {
    d = ACCESORIO[nivel - 1].slice();
    if (sec('perder')) d[1] = '10-15';
    if (sec('musculo')) d = [3, '10-15', d[2]];
  }
  let reps = d[1];
  if (tipo === 'aislamiento' && AISLA_HOMBRO.includes(e.id) && rango(reps).lo < 12) reps = '12-15';
  return { series: d[0], reps: reps + uni, descanso: Math.max(d[2], pausaMinima(tipo, rango(reps).lo)) };
}

// ── Bandas de dolor por zona (C-DOLOR-0, C-DOLOR-1, C-LES-1, C-LES-2): la regla está en reglas/catalogo.js ──
export { faseLesion, nivelesDe, riesgoHoy };
export const bandasHoy = (S, dolorHoy = {}, op = {}) => bandasZonas(S.perfil, dolorHoy, op);
export const maxDolorHoy = dolorHoy => Math.max(0, ...Object.values(dolorHoy || {}).map(Number).filter(Number.isFinite));

// ── Contexto del día: lo que necesitan montarDia y el validador ──
// op: { lugar, minutos, dolorHoy, energia, futuro }
export function contextoDia(S, op = {}) {
  const lugar = op.lugar || S.perfil.lugares[0] || 'gym';
  const dolorHoy = op.dolorHoy || {};
  const bandas = bandasHoy(S, dolorHoy, { plan: !!op.futuro });
  const niveles = nivelesDe(bandas);
  const salud = restriccionesSalud(S);
  const nivel = Math.max(1, Math.min(3, S.perfil.nivel || 1));
  const base = { lugar, niveles, salud, bandas };
  const pool = EJERCICIOS.filter(e => e.niv <= Math.min(3, nivel + 1) && permitidoBase(S, e, base));
  return {
    lugar, minutos: minutosSesion(op.minutos || S.perfil.disponibilidad.minutos), dolorHoy, bandas, niveles, salud, nivel, pool,
    energia: +op.energia || 3, futuro: !!op.futuro, edad: edadDe(S), an: analizarEjercicios(S),
  };
}
// Lo que cualquier ejercicio o tarea con id debe cumplir hoy (C-EST-4, C-DOLOR-1, C-SALUD-0).
export function permitidoBase(S, e, { lugar, niveles, salud, bandas }) {
  if (!e || !e.l.includes(lugar) || !hayMaterial(e, lugar, S.perfil)) return false;
  if ((S.perfil.gustos || {})[e.id] === 'rechazo') return false;
  if (riesgoHoy(e, niveles, bandas) === 'evitar') return false;
  if (salud && salud.excluir.has(e.id)) return false;
  return true;
}

// «Cambiar por otro» (COD-1, revisión del PR #45 G1): las alternativas de un ejercicio con las reglas del
// validador para SU rol. Rehabilitación: solo las de la zona y la fase de hoy (candidatosRehab, C-DOLOR-1,
// C-DOSIS-7); cardio: solo cardio válido de hoy (opcionesCardio, C-CARDIO-5/6, C-PISC-2); principal: lo que vale
// como principal (valePrincipal) y el resto de permitidoBase. Con la sesión (op.sesion, op.indice), además, nada
// que cree un problema nuevo en problemasSesion (C-DOSIS-4, tiempo, nivel…). op: { lugar, dolorHoy, excluir,
// nivel, rol, sesion, indice, minutos, energia }.
export function alternativasHoy(S, e, op = {}) {
  const ctx = contextoDia(S, { lugar: op.lugar, dolorHoy: op.dolorHoy || {}, minutos: op.minutos, energia: op.energia });
  const excluir = new Set([...(op.excluir || []), e.id]);
  const rol = op.rol || 'principal';
  let cand;
  if (rol === 'rehab') {
    // Primero la zona de la que era (si lo era), luego las demás zonas activas.
    const zs = zonasRehab(ctx).sort((a, b) => (fasesRehab(e, b, detalleDe0(ctx, b)).length ? 1 : 0) - (fasesRehab(e, a, detalleDe0(ctx, a)).length ? 1 : 0));
    cand = [...new Set(zs.flatMap(z => candidatosRehab(S, z, ctx)))].filter(x => !excluir.has(x.id));
  } else if (rol === 'cardio') {
    cand = opcionesCardio(S, ctx).filter(x => !excluir.has(x.id));
    // La marcha sentada solo se ofrece si no hay otro cardio (S7, revisión del PR #48, M1).
    if (cand.some(x => !CARDIO_ULTIMO.includes(x.id))) cand = cand.filter(x => !CARDIO_ULTIMO.includes(x.id));
  } else {
    cand = alternativas(e, ctx.lugar, S.perfil, { excluir: [...excluir], nivel: op.nivel == null ? null : op.nivel, permitido: x => permitidoBase(S, x, ctx) && valePrincipal(S, x, ctx) });
  }
  if (!op.sesion || op.indice == null) return cand;
  const cvi = { lugar: ctx.lugar, minutos: op.sesion.minutos, dolorHoy: op.dolorHoy || {}, energia: op.energia };
  const antes = new Set(problemasSesion(S, op.sesion, cvi));
  return cand.filter(n => {
    const ejs = op.sesion.ejercicios.slice();
    ejs[op.indice] = { ...ejercicioCambiado(S, op.sesion.ejercicios[op.indice], n, ctx), sets: [] };
    // Lo que ya fallaba con el ejercicio de antes (p. ej. sus series) no cuenta como nuevo.
    return problemasSesion(S, { ...op.sesion, ejercicios: ejs }, cvi).every(p => antes.has(p) || antes.has(p.split(n.id).join(e.id)));
  });
}
// El ejercicio nuevo de «Cambiar por otro»: la rehabilitación con la dosis de su fase de hoy (C-DOSIS-7); el
// cardio con los mismos minutos; un principal con las series y descansos de antes (y su dosis si se mide distinto).
export function ejercicioCambiado(S, viejo, n, ctx) {
  const ve = ex(viejo.id);
  if (viejo.rol === 'rehab') {
    const z = zonasRehab(ctx).find(z => rehabValida(S, n, z, ctx));
    if (z) { const r = ejercicioRehab(S, n, z, ctx); return { id: n.id, rol: 'rehab', series: r.series, reps: r.reps, descanso: r.descanso }; }
  }
  if (viejo.rol === 'cardio') return { id: n.id, rol: 'cardio', series: 1, reps: viejo.reps, descanso: 0 };
  return { id: n.id, rol: viejo.rol, series: viejo.series, reps: ve && n.t === ve.t ? viejo.reps : n.d[1], descanso: viejo.descanso };
}
// Lo que vale de un ejercicio en un lugar con el dolor de hoy (para el catálogo que se manda a la IA).
// Además, quien no sabe nadar no recibe largos ni nado continuo, y la movilidad (que la IA usa en el calentamiento y la
// vuelta) cumple la regla de las tareas: uso de la ficha y nada tumbado en la calle (revisión del PR #45, M5).
export const permitidoEn = (S, lugar, dolorHoy = {}, { futuro = false } = {}) => {
  const ctx = contextoDia(S, { lugar, dolorHoy, futuro });
  return e => permitidoBase(S, e, ctx) && !(ctx.lugar === 'piscina' && noSabeNadar(S, e)) && (e.m[0] !== 'movilidad' || tareaOk(S, e.id, ctx));
};

// ── Cardio (D3, C-CARDIO-1 a 6, decisiones 4-7): la única regla de cuándo va y cuánto ──
// Toda sesión lleva cardio. Devuelve { objetivo, minutos (mínimo), max, rpe, intervalos, obligatorio: true }.
// minutos: los de la sesión (un objetivo secundario solo sube el cardio a 15 en sesiones de 60 min o más).
const CARDIO_MIN = { musculo: [8, 10], fuerza: [8, 10], salud: [10, 15], perder: [15, 25], resistencia: [15, 30], natacion: [10, 15] };
export function reglaCardio(S, lugar, { minutos = 60, energia = 3, dolorAlto = false, bandas } = {}) {
  const objs = objetivosDe(S), prin = CARDIO_MIN[objs[0]] ? objs[0] : 'salud';
  let [min, max] = CARDIO_MIN[prin];
  if (objs.slice(1).some(o => o === 'perder' || o === 'resistencia')) min = Math.max(min, +minutos >= 60 ? 15 : max); // C-OBJ-2, C-OBJ-4
  if (lugar === 'piscina') { min = prin === 'perder' || prin === 'resistencia' ? 15 : 10; max = 20; } // C-PISC-1, decisión 5
  const salud = restriccionesSalud(S);
  let rpe = energia <= 2 || dolorAlto ? '3' : { perder: '4-5', resistencia: '4-6', salud: '3-5', natacion: '3-5' }[prin] || '3-4';
  if (salud.rpeMax && +rpe.slice(-1) > salud.rpeMax) rpe = String(salud.rpeMax);
  return { objetivo: prin, minutos: min, max, rpe, intervalos: !dolorAlto && energia > 2 && intervalosPermitidos(S, salud, bandas || bandasHoy(S, {})), obligatorio: true };
}
// Intervalos solo si se cumple todo (C-CARDIO-4); la frecuencia semanal se recuerda en la nota.
export function intervalosPermitidos(S, salud, bandas) {
  const prin = objetivosDe(S)[0];
  if ((S.perfil.nivel || 1) < 2 || !['perder', 'resistencia'].includes(prin)) return false;
  if (Object.entries(bandas).some(([z, b]) => ['cadera_lateral', 'rodilla', 'tobillo_pie', 'lumbar'].includes(z) && b.banda >= 2)) return false;
  const edad = edadDe(S);
  if (edad != null && edad >= 60) return false;
  return !salud.sinIntervalos;
}
// Qué ejercicios cuentan como cardio y en qué orden se prefieren, por lugar (C-CARDIO-5).
export const CARDIO_LUGAR = {
  gym: ['bici-estatica', 'eliptica', 'cinta-inclinada', 'remo-ergometro', 'cardio-sentado'],
  // marcha-sentada (S7, decisión del 23-11-2026): la última de casa y calle, para cuando duelen una pierna y un brazo.
  casa: ['marcha-estatica', 'boxeo-sombra', 'jumping-jacks-sin-salto', 'step-bajo', 'cardio-sentado', 'comba', 'bici-estatica', 'marcha-sentada'],
  calle: ['marcha-rapida', 'carrera-suave', 'marcha-estatica', 'cardio-sentado', 'comba', 'marcha-sentada'],
  piscina: ['nado-continuo', 'aquajogging', 'caminar-agua'],
};
const ENCADENADO = ['marcha-estatica', 'step-bajo', 'jumping-jacks-sin-salto', 'boxeo-sombra', 'comba', 'cardio-sentado', 'marcha-sentada'];
// La marcha sentada solo va cuando no vale otro cardio (S7): no se ofrece para alternar con uno mejor.
export const CARDIO_ULTIMO = ['marcha-sentada'];
// Quien no sabe nadar 2 × 25 m seguidos (C-PISC-2): por tiempo, con tabla y donde haga pie, sea cual sea su nivel
// de fuerza (el nivel no es de natación; lo prudente, C-PRIN-2): sin nado continuo, crol, espalda ni largos sin
// tabla. Las patadas con tabla sí (es la técnica de su fila de C-PISC-2).
const CON_TABLA = ['patada-crol-tabla', 'patada-espalda-tabla'];
export const noSabeNadar = (S, e) => !!e && !S.perfil.nadar25 && (e.id === 'nado-continuo' || (e.m[0] === 'natacion' && e.t === 'distancia' && !CON_TABLA.includes(e.id)));
export const esCardioValido = (e, lugar) => !!e && (lugar === 'piscina' ? CARDIO_LUGAR.piscina.includes(e.id) : e.m[0] === 'cardio' && e.t === 'tiempo' && (CARDIO_LUGAR[lugar] || []).includes(e.id));
// Opciones de cardio permitidas hoy, de más a menos preferida (las de la ficha de la zona primero, PR 9).
// sinRiesgo: ninguna etiqueta r en una zona activa (día de dolor alto, calentamiento).
export function opcionesCardio(S, ctx, { sinRiesgo = false } = {}) {
  const orden = CARDIO_LUGAR[ctx.lugar] || [];
  const pref = Object.keys(ctx.bandas).flatMap(z => (((ZONAS[z] || {}).cardio || {}).preferente || {})[ctx.lugar] || []);
  const ok = id => {
    const e = ex(id);
    if (!e || !permitidoBase(S, e, ctx) || e.niv > ctx.nivel) return false;
    if (sinRiesgo && Object.keys(ctx.bandas).some(z => (e.r || {})[z])) return false;
    if (noSabeNadar(S, ex(id))) return false; // C-PISC-2: no sabe nadar 2 × 25 m, sea cual sea su nivel (S3)
    if (ctx.salud.sinImpacto && ['comba', 'carrera-suave', 'jumping-jacks-sin-salto'].includes(id)) return false;
    return true;
  };
  return [...new Set([...pref, ...orden])].filter(id => orden.includes(id) && ok(id)).map(ex);
}
// El ejercicio de cardio del día, con su porqué.
export function cardioDelDia(S, ctx, k = 0, extra = 0, excluir = []) {
  const regla = reglaCardio(S, ctx.lugar, { minutos: ctx.minutos, energia: ctx.energia, bandas: ctx.bandas });
  const todasOp = opcionesCardio(S, ctx).filter(e => !excluir.includes(e.id)); // no dos veces el mismo (rehabilitación y cardio)
  if (!todasOp.length) return null;
  // La marcha sentada, solo si no vale ningún otro (S7).
  const opciones = todasOp.some(e => !CARDIO_ULTIMO.includes(e.id)) ? todasOp.filter(e => !CARDIO_ULTIMO.includes(e.id)) : todasOp;
  const an = ctx.an || {};
  const orden = opciones.map((e, i) => ({ e, p: -i + preferencia(an, e.id) })).sort((a, b) => b.p - a.p).map(x => x.e);
  // Con una zona activa manda el orden de su ficha (C-CARDIO-6); en la piscina, el bloque continuo de siempre.
  const pref = Object.keys(ctx.bandas).flatMap(z => (((ZONAS[z] || {}).cardio || {}).preferente || {})[ctx.lugar] || []);
  const fijo = ctx.lugar === 'piscina' || opciones.some(e => pref.includes(e.id));
  const e = fijo ? opciones[0] : orden[k % Math.min(orden.length, ctx.lugar === 'gym' ? 3 : 2)];
  const min = regla.minutos + (ctx.energia <= 2 ? 0 : extra);
  return { id: e.id, rol: 'cardio', series: 1, reps: `${min} min`, descanso: 0, nota: notaCardio(S, ctx, e, min, regla, extra, orden) };
}
const EN_LUGAR = { calle: /^en la calle\b/i, casa: /^en casa\b/i, gym: /^en el gimnasio\b/i, piscina: /^en la piscina\b/i };
export function notaCardio(S, ctx, e, min, regla, extra = 0, opciones = []) {
  const por = { perder: 'buscas perder grasa', resistencia: 'buscas resistencia', salud: 'es bueno para tu corazón', natacion: 'te da fondo para nadar mejor' }[regla.objetivo] || 'toda sesión lleva cardio';
  const habla = +regla.rpe.slice(-1) <= 4 ? 'puedes hablar con frases completas' : 'puedes decir frases cortas';
  const partes = [`${min} min${extra && ctx.energia > 2 ? ` (+${extra} porque tu peso no ha bajado en 4 semanas)` : ''} porque ${por}: esfuerzo ${regla.rpe} de 10 (${habla})`];
  if (regla.intervalos) partes.push('Si te ves bien: 3 min suaves y 6-8 veces 1 min fuerte (7 de 10) con 1-2 min suaves; como mucho 2 días por semana y no seguidos');
  if (ENCADENADO.includes(e.id) && ctx.lugar !== 'gym') {
    const otros = opciones.filter(o => ENCADENADO.includes(o.id) && o.id !== e.id && !CARDIO_ULTIMO.includes(o.id)).slice(0, 2).map(o => minus(o.n));
    // Sin otro con el que alternar, no se habla de «cada uno» (revisión del PR #48).
    if (otros.length) partes.push(`En bloque continuo: 1-3 min de cada uno sin parar (alterna con ${lista(otros)}) hasta sumar los minutos`);
  }
  if (CARDIO_ULTIMO.includes(e.id)) partes.push('Si no llegas a notar un esfuerzo de 4 de 10, ve al ritmo más vivo que puedas sin dolor'); // S7, revisión del PR #48
  if (ctx.lugar === 'piscina') partes.push('Seguido; si paras en el borde, menos de 20 s y sin parar el reloj');
  if (ctx.lugar === 'piscina' && !S.perfil.nadar25) partes.push('Siempre donde hagas pie, con el agua por el pecho'); // C-PISC-2, S3
  // Las condiciones de la ficha que hablan de un lugar («En la calle, …») solo van en ese lugar.
  const otroLugar = c => Object.entries(EN_LUGAR).some(([l, re]) => l !== ctx.lugar && re.test(c));
  const cond = Object.keys(ctx.bandas).map(z => (((ZONAS[z] || {}).cardio || {}).condiciones || {})[e.id]).find(c => c && !otroLugar(c));
  if (cond) partes.push(cond);
  if (S.perfil.lugares.includes('piscina') && ctx.lugar === 'gym') partes.push('Si te apetece, hazlo en la piscina: nado suave o aquajogging');
  return partes.map(frase).join(' ');
}

// ── Rehabilitación de cada zona activa (C-DOLOR-1, C-DOLOR-3, C-ZONA-0, C-DOSIS-7) ──
// Candidatos de una zona: los del campo `rehab` del catálogo con la fase de su banda (PR 9) o, mientras no
// exista, la lista de la ficha. Nunca con riesgo en su propia zona (salvo r=1 en fase 3 con B0).
export const faseDeBanda = b => (b.banda === 0 ? 3 : b.banda === 1 && !b.nueva ? 2 : 1);
// Fases en las que un ejercicio sirve de rehabilitación para una zona (campo `rehab` del catálogo, PR 9:
// número, lista de fases o { fase, detalle }). Sin detalle en la lesión, el de por defecto de la zona.
export const fasesRehab = (e, z, detalle) => fasesDe(e, z, detalle);
const detalleDe0 = (ctx, z) => ((ctx.bandas[z] || {}).lesion || {}).detalle;
// Ejercicio solo de rehabilitación (fases 1-2, dosis propia): no cuenta como principal (los de fuerza sí).
export const soloRehab = e => !!e.rehab && tipoEj(e) === 'propia' && !['core', 'cardio'].includes(e.m[0]);
export function rehabValida(S, e, z, ctx) {
  const b = ctx.bandas[z]; if (!e || !b || b.banda >= 3) return false;
  if (!permitidoBase(S, e, ctx)) return false;
  const fases = fasesRehab(e, z, detalleDe0(ctx, z));
  const conCampo = fases.length > 0;
  if (!conCampo && !((ZONAS[z] || {}).rehab || []).includes(e.id)) return false;
  // La fase la decide la banda de HOY (C-DOLOR-1, C-DOSIS-7): con 4-6 solo fase 1, aunque el plan o la IA
  // traigan la de la ficha (S1).
  if (conCampo && !fases.some(f => f <= faseDeBanda(b))) return false;
  const r = riesgoDetalle(e, z, detalleDe0(ctx, z));
  if (r === 2) return false;
  if (r === 1 && !(b.banda === 0 && fases.includes(3))) return false;
  return true;
}
export function candidatosRehab(S, z, ctx) {
  const b = ctx.bandas[z]; if (!b) return [];
  const fase = faseDeBanda(b), det = detalleDe0(ctx, z);
  const mejor = e => Math.max(...fasesRehab(e, z, det).filter(f => f <= fase));
  const conCampo = ctx.pool.filter(e => fasesRehab(e, z, det).some(f => f <= fase));
  const ids = conCampo.length ? conCampo.sort((a, c) => mejor(c) - mejor(a) || a.id.localeCompare(c.id)).map(e => e.id) : ((ZONAS[z] || {}).rehab || []);
  return ids.map(ex).filter(e => rehabValida(S, e, z, ctx));
}
export function ejercicioRehab(S, e, z, ctx) {
  const b = ctx.bandas[z], det = detalleDe0(ctx, z), max = faseDeBanda(b);
  const fs = fasesRehab(e, z, det).filter(f => f <= max);
  const fase = fs.length ? Math.max(...fs) : max;
  const d = dosisRehab(e, fase); // C-DOSIS-7
  const nota = ZONAS[z] ? notaRehab(z, { dolor: b.dolor, fase, detalle: det, nueva: b.nueva }) : porQueRehab(S, e, z, ctx.dolorHoy);
  return { id: e.id, rol: 'rehab', series: d.series, reps: d.reps, descanso: d.descanso, nota: d.intensidad && nota.length + d.intensidad.length < 280 ? `${nota} Intensidad: ${d.intensidad}.` : nota };
}
// Zonas que llevan rehabilitación, de más a menos dolor (B3 no lleva: día de dolor alto).
export const zonasRehab = ctx => Object.entries(ctx.bandas).filter(([, b]) => b.banda <= 2).sort((a, b) => b[1].dolor - a[1].dolor).map(([z]) => z);
// La rehabilitación del día: 1-2 por zona dentro del 25 % de los minutos; una zona en B2 siempre lleva 1.
export function rehabDelDia(S, ctx, { k = 0, usados = [] } = {}) {
  const tope = ctx.minutos * 0.25;
  const out = [];
  let t = 0;
  const zonas = zonasRehab(ctx);
  for (let ronda = 0; ronda < 2; ronda++) {
    zonas.forEach(z => {
      const c = candidatosRehab(S, z, ctx).filter(e => !usados.includes(e.id) && !out.some(x => x.id === e.id));
      if (!c.length) return;
      const x = ejercicioRehab(S, c[(k + ronda) % c.length], z, ctx);
      const tx = tiempoEj(x);
      const obligada = ronda === 0 && ctx.bandas[z].banda === 2;
      if (!obligada && t + tx > tope) return;
      out.push({ ...x, zona: z }); t += tx;
    });
  }
  return out;
}

// ── Calentamiento (C-CAL-1, C-CAL-2) y vuelta a la calma (C-VUELTA-1, C-EST-1 a 4) ──
export function minutosCalentamiento(S, ctx) {
  const m = ctx.minutos;
  let t = m < 45 ? 5 : m < 60 ? 7 : m < 75 ? 9 : 11;
  if (ctx.edad != null && ctx.edad >= 60) t += 2; // C-EDAD-1
  t += ctx.salud.calentamientoExtra || 0;
  return Math.max(t, ctx.salud.calentamientoMin || 0);
}
export function minutosVuelta(S, ctx) {
  const m = ctx.minutos;
  const t = m < 45 ? 3 : m < 60 ? 5 : m < 75 ? 6 : m < 90 ? 8 : 9;
  return Math.max(t, ctx.salud.vueltaMin || 0);
}
// Reparte `total` minutos enteros entre n partes (al menos 1 cada una si se puede).
export const repartir = (total, n) => Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));
const tareaDe = (e, detalle, min) => ({ id: e.id, nombre: e.n, detalle, duracion: `${min} min` });
// Tareas de la ficha de una zona (calentar o estirar) con su uso (C-EST-2), las del detalle de la lesión (o el
// de por defecto). Uso: «normal» solo en B0-B1, «alivio» en cualquier banda, «activacion» en B0-B2.
export function tareasFicha(z, tipo, detalle) {
  const Z = ZONAS[z]; if (!Z || !Z.tareas) return [];
  const det = detalleDe(z, detalle);
  return (Z.tareas[tipo] || []).filter(t => !t.detalle || t.detalle.includes(det)).map(t => ({ ...t, nombre: t.texto || (ex(t.id) ? ex(t.id).n : t.id) }));
}
export const usoOk = (uso, banda) => (uso === 'normal' ? banda <= 1 : uso === 'activacion' ? banda <= 2 : true);
// ¿La ficha de alguna zona activa no deja hoy esta tarea (por id o por nombre)? (S2, C-EST-2, C-DOLOR-4)
const fichaLaQuita = (ctx, t) => Object.entries(ctx.bandas || {}).some(([z, b]) => ['calentar', 'estirar'].some(tipo =>
  tareasFicha(z, tipo, (b.lesion || {}).detalle).some(f => (t.id ? f.id === t.id : !!f.texto && f.texto === t.nombre) && !usoOk(f.uso, b.banda))));
export const tareaOk = (S, id, ctx) => { const e = ex(id); return !!e && permitidoBase(S, e, ctx) && !(ctx.lugar === 'calle' && TUMBADO.includes(id)) && !fichaLaQuita(ctx, { id }); };
// Una tarea sin id (S2, S6): si su nombre es el de un ejercicio, se comprueba como él; si es un estiramiento
// libre de la app, con su riesgo; si es un texto de la ficha de una zona, con su uso.
export function tareaSinIdOk(S, t, ctx) {
  const e = porNombre(t.nombre);
  if (e) return tareaOk(S, e.id, ctx);
  // Respiración: tumbado no en la calle, en la piscina ni sin poder tumbarse por salud (C-EST-4, C-SALUD-0).
  if (RE_RESPIRACION.test(String(t.nombre || '').trim()) && TUMBADO_TXT.test(String(t.detalle || '')) && (ctx.lugar === 'calle' || ctx.lugar === 'piscina' || ctx.salud.sinTumbado)) return false;
  const r = RIESGO_LIBRE[t.nombre];
  if (r && riesgoHoy({ id: '', r }, ctx.niveles, ctx.bandas) === 'evitar') return false;
  return !fichaLaQuita(ctx, t);
}
// Tareas sin id que la app escribe ella misma y sabe comprobar (C-CAL-2, C-VUELTA-1, C-EST-2): la respiración, las
// series de aproximación o de prueba del primer compuesto, los estiramientos libres de pie o en el borde y los textos
// de la ficha de cada zona. La IA puede mandarlas sin id; cualquier otra sin id solo vale si su nombre es el de un
// ejercicio (porNombre).
const RE_RESPIRACION = /^respiraci[oó]n\b/i;
const TUMBADO_TXT = /tumbad|boca (arriba|abajo)|en el suelo|de rodillas|a cuatro patas/i;
export const RE_APROXIMACION = /^(series de (aproximaci[oó]n|prueba)|aproximaci[oó]n)\b/i;
const TEXTOS_FICHA = new Set(Object.values(ZONAS).flatMap(Z => Object.values((Z && Z.tareas) || {}).flat().map(t => t && t.texto).filter(Boolean)));
// La respiración de la vuelta a la calma: de pie en la calle y en la piscina, sentado si no puede tumbarse por salud.
export const respiracionDe = ctx => (ctx.lugar === 'calle' || ctx.lugar === 'piscina' ? 'De pie, 6 respiraciones lentas soltando el aire en 6 segundos.' : ctx.salud.sinTumbado ? 'Sentado, 6 respiraciones lentas soltando el aire en 6 segundos.' : 'Tumbado, 6 respiraciones lentas soltando el aire en 6 segundos.');
// Una tarea sin id de la IA que la app conoce, con el nombre y el texto de la app (revisión del PR #49, G1): el
// detalle de la IA podría pedir una postura que no vale hoy («túmbate en la esterilla» en la calle, «rodillas al
// pecho» con la lumbar dolorida), así que nunca se queda. null si la app no la conoce (la aproximación va aparte).
export function tareaLibreDeApp(t, ctx) {
  const n = String((t && t.nombre) || '').trim();
  // Cualquier «Respiración …» pasa a ser la respiración de la app, con su nombre y su texto.
  if (RE_RESPIRACION.test(n)) return { nombre: 'Respiración', detalle: respiracionDe(ctx) };
  const libre = [...ESTIRA_LIBRE.piscina, ...ESTIRA_LIBRE.otro].find(([x]) => x === n);
  if (libre) return { nombre: libre[0], detalle: libre[1] };
  if (n === ESTIRA_SUAVE[0]) return { nombre: ESTIRA_SUAVE[0], detalle: ESTIRA_SUAVE[1] };
  if (TEXTOS_FICHA.has(n)) return { nombre: n, detalle: 'Lento y sin dolor. Si el dolor sube o notas hormigueo, sáltalo.' };
  return null;
}
// Aproximación del primer compuesto con carga (C-CAL-2): con kilos apuntados, porcentajes; sin historial, series de prueba.
export function aproximacionDe(S, primero) {
  const conKg = conKgAntes(S, primero.id);
  return conKg
    ? { nombre: 'Series de aproximación', detalle: `${primero.n}: 1 × 8 al 50 % y 1 × 4 al 70 %${tiene(S, 'fuerza') ? ' y 1 × 2 al 85 %' : ''} de tu peso de trabajo.` }
    : { nombre: 'Series de prueba', detalle: `${primero.n}: 1 × 10 muy ligera y 1 × 5 algo más pesada, para elegir el peso de hoy.` };
}
// Lo que vale hoy en el calentamiento y la vuelta a la calma, para que la IA lo pida por id (C-EST-4, C-EST-2, C-CAL-2):
// ids: movilidad, cardio, natación y core estabilizador que pasan tareaOk, y las tareas con id de la ficha de cada zona activa que su
// banda deja; activacion: { zona: id } de su fase 1 (la que pone la app); sinId: los nombres sin id que la app sabe
// comprobar. Como mucho 60 ids (el tope de una lista en el servidor): primero los de las zonas. { todas: true }: sin
// el tope (el validador comprueba con la lista entera).
export function tareasDelDia(S, ctx, { todas = false } = {}) {
  const ids = [], activacion = {};
  const poner = id => { if (id && !ids.includes(id)) ids.push(id); };
  zonasRehab(ctx).filter(z => ZONAS[z]).forEach(z => {
    const t = tareasFicha(z, 'calentar', detalleDe0(ctx, z)).find(t => t.id && t.uso === 'activacion' && usoOk(t.uso, ctx.bandas[z].banda) && tareaOk(S, t.id, ctx));
    // Sin activación en su ficha, un ejercicio de su fase 1 que valga hoy (C-CAL-2).
    const id = t ? t.id : (EJERCICIOS.find(e => fasesRehab(e, z, detalleDe0(ctx, z)).includes(1) && tareaOk(S, e.id, ctx)) || {}).id;
    if (id) { activacion[z] = id; poner(id); }
  });
  Object.entries(ctx.bandas).filter(([z]) => ZONAS[z]).forEach(([z, b]) => ['calentar', 'estirar'].forEach(tipo =>
    tareasFicha(z, tipo, (b.lesion || {}).detalle).filter(t => t.id && usoOk(t.uso, b.banda) && tareaOk(S, t.id, ctx)).forEach(t => poner(t.id))));
  // Y el core estabilizador de dosis propia (dead bug, bird dog, plancha…): la activación del calentamiento y el core
  // suave de la vuelta a la calma de un día suave (C-REP-2). Nada de fuerza con carga (revisión del PR #49, G2).
  EJERCICIOS.filter(e => (['movilidad', 'cardio', 'natacion'].includes(e.m[0]) || (e.m[0] === 'core' && tipoEj(e) === 'propia')) && e.niv <= ctx.nivel && tareaOk(S, e.id, ctx) && !(ctx.lugar === 'piscina' && noSabeNadar(S, e))).forEach(e => poner(e.id));
  const sinId = ['Respiración', 'Series de aproximación', 'Series de prueba', ...libresDe(ctx.lugar).map(([n]) => n).filter(n => tareaSinIdOk(S, { nombre: n }, ctx))];
  return { ids: todas ? ids : ids.slice(0, 60), activacion, sinId };
}
// El ejercicio del catálogo que corresponde a un nombre de tarea (las tareas sin id de la IA o de la ficha).
export const porNombre = n => { const k = normalizar(n).trim(); return k ? EJERCICIOS.find(e => normalizar(e.n) === k) || (k.length >= 8 ? EJERCICIOS.find(e => normalizar(e.n).length >= 8 && k.includes(normalizar(e.n))) : null) : null; };
const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const conKgAntes = (S, id) => sesionesHechas(S).some(s => (s.ejercicios || []).some(y => y.id === id && (y.sets || []).some(z => z.hecha && +z.kg > 0)));
// elegidos: ejercicios principales (del catálogo). total: minutos (si no, los de C-CAL-1).
export function calentamientoDe(S, ctx, elegidos = [], { total } = {}) {
  const T = Math.max(2, Math.round(total || minutosCalentamiento(S, ctx)));
  const out = [];
  if (ctx.lugar === 'piscina') {
    const [a, b, c] = T >= 6 ? [T - 3, 2, 1] : [Math.max(1, T - 2), 1, 1];
    out.push(tareaDe(ex('caminar-agua'), 'Paso amplio, brazos activos, sin prisa.', a));
    out.push(tareaOk(S, 'burbujas', ctx) ? tareaDe(ex('burbujas'), 'Soltar el aire bajo el agua, 10 veces.', b) : { nombre: 'Respiración en el agua', detalle: 'Soltar el aire despacio, 10 veces.', duracion: `${b} min` });
    out.push(tareaOk(S, 'circulos-brazos', ctx) ? tareaDe(ex('circulos-brazos'), 'Dentro del agua, hacia delante y atrás.', c) : { nombre: 'Movilidad suave en el agua', detalle: 'Círculos de cadera y tobillos, sin dolor.', duracion: `${c} min` });
    return out;
  }
  // Partes de C-CAL-1: cardio suave, movilidad y (desde 60 min) activación y aproximación. Lo que sobre
  // (60 años o más, asma) va al cardio suave; si hay que acortar, se quitan activación y aproximación.
  const m = ctx.minutos;
  let [c, mv, x] = m < 45 ? [3, 2, 0] : m < 60 ? [4, 3, 0] : m < 75 ? [5, 2, 2] : [5, 3, 3];
  const sobra = T - (c + mv + x);
  if (sobra >= 0) c += sobra; else { x = 0; mv = Math.min(mv, Math.max(1, T - 2)); c = Math.max(1, T - mv); }
  const suave = opcionesCardio(S, ctx, { sinRiesgo: true })[0] || opcionesCardio(S, ctx)[0];
  out.push(suave ? tareaDe(suave, 'Muy suave (2-3 de 10), hasta notar calor.', c) : { nombre: 'Cardio suave', detalle: 'Caminar o pedalear muy suave hasta notar calor.', duracion: `${c} min` });
  // Movilidad de lo que se va a usar (2-4 tareas).
  const usaSup = !elegidos.length || elegidos.some(e => SUPERIOR.includes(e.m[0])), usaInf = !elegidos.length || elegidos.some(e => !SUPERIOR.includes(e.m[0]) && e.m[0] !== 'core');
  const mov = [...(usaInf ? MOVILIDAD.inferior : []), ...(usaSup ? MOVILIDAD.superior : []), ...MOVILIDAD.core].filter(id => tareaOk(S, id, ctx));
  const nMov = Math.max(1, Math.min(mov.length, mv, 4));
  if (mov.length) repartir(mv, nMov).forEach((t, i) => out.push(tareaDe(ex(mov[i]), '8-10 repeticiones lentas, sin dolor.', t)));
  else out.push({ nombre: 'Movilidad articular', detalle: 'Círculos de hombros, cadera y tobillos, lentos y sin dolor.', duracion: `${mv} min` });
  if (x > 0) {
    // Activación de una zona en B0-B2 (texto de su ficha) y aproximación del primer compuesto con carga.
    let queda = x;
    // La tarea «activacion» de su ficha, con su id para que el validador la compruebe (C-CAL-2, C-EST-4, S6).
    let act = null, z = null;
    for (const zz of zonasRehab(ctx).filter(zz => ZONAS[zz])) {
      act = tareasFicha(zz, 'calentar', detalleDe0(ctx, zz)).find(t => t.uso === 'activacion' && usoOk(t.uso, ctx.bandas[zz].banda) && (t.id ? tareaOk(S, t.id, ctx) : tareaSinIdOk(S, t, ctx)));
      if (act) { z = zz; break; }
    }
    if (act) { out.push({ ...(act.id ? { id: act.id } : {}), nombre: act.nombre, detalle: `Activación para tu ${nombreZona(z)}, sin dolor.`, duracion: '1 min' }); queda -= 1; }
    const primero = elegidos.find(e => tipoEj(e) === 'compuesto');
    if (primero && queda > 0) out.push({ ...aproximacionDe(S, primero), duracion: `${queda} min` }); else if (queda > 0) out[0].duracion = `${minDe(out[0].duracion) + queda} min`;
  }
  return out;
}
export function vueltaDe(S, ctx, elegidos = [], { total } = {}) {
  const T = Math.max(2, Math.round(total || minutosVuelta(S, ctx)));
  const out = [];
  let queda = T;
  if (ctx.lugar === 'piscina' && T >= 3) { out.push(tareaOk(S, 'flotacion', ctx) ? tareaDe(ex('flotacion'), 'Suelta el cuerpo y respira lento.', 1) : { nombre: 'Nado muy suave', detalle: 'Espalda suave o caminar en el agua.', duracion: '1 min' }); queda -= 1; }
  const resp = queda >= 5 ? 2 : 1;
  const nEst = Math.max(1, queda - resp);
  const est = [];
  // Estiramiento de la ficha de la zona: solo si alivia (C-EST-2). Sin la marca de la ficha (PR 9), solo en B0-B1.
  if (T >= 5) {
    Object.entries(ctx.bandas).filter(([z]) => ZONAS[z]).forEach(([z, b]) => {
      // Solo los de su ficha con el uso que permite su banda de hoy, con su id (C-EST-2, S2, S6).
      const t = tareasFicha(z, 'estirar', (b.lesion || {}).detalle).find(x => usoOk(x.uso, b.banda) && (x.id ? tareaOk(S, x.id, ctx) : tareaSinIdOk(S, x, ctx)));
      if (t && est.length < 1) est.push({ ...(t.id ? { id: t.id } : {}), nombre: t.nombre, detalle: `Para tu ${nombreZona(z)}: 30 s por lado. Si al estirar el dolor sube o notas hormigueo, sáltalo.`, duracion: '1 min' });
    });
  }
  // Estiramientos de lo trabajado (C-EST-1) y, si faltan, de pie y sin riesgo para el lugar.
  const trabajados = [...new Set(elegidos.flatMap(e => [e.m[0], ...(e.s || []).slice(0, 1)]))];
  [...trabajados, 'gemelo', 'hombro', 'pecho', 'isquios', 'cuadriceps'].flatMap(m => ESTIRA[m] || []).filter((id, i, a) => a.indexOf(id) === i && tareaOk(S, id, ctx))
    .forEach(id => { if (est.length < nEst) est.push(tareaDe(ex(id), '30 s por lado, tensión suave (3-4 de 10), sin rebotes.', 1)); });
  const libres = libresDe(ctx.lugar).filter(([n]) => tareaSinIdOk(S, { nombre: n }, ctx));
  for (let i = 0; est.length < nEst && i < libres.length; i++) est.push({ nombre: libres[i][0], detalle: libres[i][1], duracion: '1 min' });
  if (!est.length) est.push({ nombre: ESTIRA_SUAVE[0], detalle: ESTIRA_SUAVE[1], duracion: '1 min' });
  if (est.length < nEst) est[est.length - 1].duracion = `${1 + nEst - est.length} min`;
  out.push(...est);
  out.push({ nombre: 'Respiración', detalle: respiracionDe(ctx), duracion: `${resp} min` });
  return out;
}

// ── Por qué de cada ejercicio: corto y con sus datos, nunca una frase genérica ──
// Tras un paréntesis también va punto (M15: «(puedes hablar con frases completas) Si te apetece…»).
export const frase = t => { t = String(t || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) + (/(?:[.!?»]|[.!?]\))$/.test(t) ? '' : '.') : ''; };
const POR_QUE_FUERA = { estancado: 'llevaba 4 sesiones sin mejorar', molesta: 'te ha molestado', rechazado: 'no lo quieres' };
const OBJ_CORTO = { perder: 'perder grasa', musculo: 'ganar músculo', fuerza: 'ganar fuerza', resistencia: 'resistencia', salud: 'salud y movilidad', natacion: 'nadar mejor' };
const objsTxt = S => lista(objetivosDe(S).map(o => OBJ_CORTO[o] || minus(OBJETIVOS[o] ? OBJETIVOS[o].nombre : o)));
// Para qué sirve un accesorio según el objetivo principal.
function paraQue(S, e) {
  if (e.m[0] === 'natacion' || e.l.length === 1 && e.l[0] === 'piscina') return 'técnica y fondo en el agua, sin impacto';
  if (e.m[0] === 'core') return 'estabilidad para proteger la espalda en el resto';
  const o = objetivosDe(S)[0];
  return { perder: 'conserva músculo mientras pierdes grasa', musculo: 'suma volumen para que crezca', fuerza: 'refuerza lo que limita tus básicos', resistencia: 'resistencia muscular con descansos cortos', salud: 'fuerza útil para el día a día' }[o] || 'completa el trabajo del día';
}
const motivoFuera = a => POR_QUE_FUERA[a.estado] || (a.gusto === 'nogusta' ? 'no te gusta' : null);
function dolorDe(S, z, dolorHoy = {}) {
  if (dolorHoy[z] != null && dolorHoy[z] !== '') return +dolorHoy[z];
  const l = (S.perfil.lesiones || []).find(x => x.activa && x.zona === z);
  return l ? +l.dolor : null;
}
function zonaTxt(S, z, dolorHoy) {
  const d = dolorDe(S, z, dolorHoy);
  return `tu ${nombreZona(z)}${d != null ? ` (${d}/10)` : ''}`;
}
// Techo de dolor durante el ejercicio (C-DOLOR-6): 3 en lesión nueva, rehabilitación y la mayoría de zonas;
// 5 en cadera lateral, hombro y codo crónicos o recurrentes. Con el campo `techo` de la ficha (PR 9) manda él.
export function techoDolor(S, z, { rehab = false } = {}) {
  const l = (S.perfil.lesiones || []).find(x => x.activa && x.zona === z);
  if (!ZONAS[z]) return 3;
  return techoZona(z, { nueva: faseLesion(l) === 'nueva', detalle: l && l.detalle, rehab }).techo;
}
// Límite del «dolor durante» un ejercicio (C-DOLOR-6): como mucho 2 puntos sobre el de antes y nunca por encima
// del techo; con dolor irradiado, sin aumento. Devuelve { limite, techo }.
export function limiteDolor(S, z, antes = 0, { rehab = false } = {}) {
  const l = (S.perfil.lesiones || []).find(x => x.activa && x.zona === z);
  const t = ZONAS[z] ? techoZona(z, { nueva: faseLesion(l) === 'nueva', detalle: l && l.detalle, rehab }) : { techo: 3, sube: 2 };
  let limite = Math.min(t.techo, (+antes || 0) + t.sube);
  // Rehabilitación (C-DOSIS-7): «dolor ≤ 3 o igual al de antes»; si ya empieza por encima del techo o es
  // irradiado (sin aumento), vale quedarse como empezó.
  if (rehab && ((+antes || 0) > t.techo || t.sube === 0)) limite = Math.max(limite, +antes || 0);
  return { techo: t.techo, limite };
}
// c: { i, d, an, carga, niveles, dolorHoy, sustituye: { n, por } }
export function porQueEjercicio(S, e, c) {
  const a = c.an[e.id];
  const musc = [...new Set([e.m[0], ...(e.s || []).slice(0, 1)])].map(m => minus(MUSCULOS[m] || m)).filter(Boolean);
  const out = [];
  out.push(c.i === 0 && esCompuesto(e) && e.t === 'reps' && !e.l.every(l => l === 'piscina')
    ? `Básico del día para ${lista(musc)}: ${c.d.series} × ${c.d.reps} con ${c.d.descanso} s porque buscas ${objsTxt(S)}`
    : `${musc.length ? `${lista(musc).replace(/^./, x => x.toUpperCase())}: ` : ''}${paraQue(S, e)}`);
  if (c.sustituye) out.push(`En lugar de ${c.sustituye.n}: ${c.sustituye.por}`);
  else if (a && a.estado === 'progresa' && a.desde) out.push(`Vas subiendo (${a.desde}): lo mantengo`);
  else if (a && a.gusto === 'gusta') out.push('Te gusta y te funciona');
  if (riesgo(e, c.niveles) === 'precaucion') {
    const zs = Object.keys(c.niveles).filter(z => (e.r || {})[z]);
    // C-DOSIS-4: la nota dice la zona, su dolor y el techo.
    const techo = Math.min(...zs.map(z => Math.min(techoDolor(S, z), (dolorDe(S, z, c.dolorHoy) || 0) + 2)));
    if (zs.length) out.push(`Implica a ${lista(zs.map(z => zonaTxt(S, z, c.dolorHoy)))}: carga moderada, bajada de 3 s y 3 de margen; si pasa de ${techo}/10, salta al siguiente`);
  }
  if (a && a.problemas.includes('dificil')) out.push('La última vez te costó: empieza más ligero');
  return out.slice(0, 3).map(frase).join(' ');
}
// La nota de dosis («Básico del día para pecho: 3 × 8-12 con 120 s…») y la línea «el primer básico va a…» de la
// explicación dicen las series, repeticiones y descanso que de verdad quedan, aunque luego los cambie el
// volumen semanal, el tiempo, la energía o la descarga (E10).
const RE_NOTA_DOSIS = /(Básico del día para [^:]+: )\d+ × .+? con \d+ s( porque)/;
const RE_EXPL_DOSIS = /(el primer básico va a )\d+ × .+? con \d+ s( de descanso)/;
export function sincronizarDosis(d) {
  const ejs = (d && d.ejercicios) || [];
  // El primero de una superserie no descansa: su dosis dice el descanso de la pareja (el del segundo, S18).
  const desc = (x, i) => (x.superserie && ejs[i + 1] ? +ejs[i + 1].descanso : +x.descanso);
  ejs.forEach((x, i) => { if (x && typeof x.nota === 'string' && RE_NOTA_DOSIS.test(x.nota)) x.nota = x.nota.replace(RE_NOTA_DOSIS, `$1${+x.series} × ${x.reps} con ${desc(x, i)} s$2`); });
  const p = ejs.find(x => x && x.rol === 'principal' && ex(x.id) && ex(x.id).t === 'reps');
  if (p && Array.isArray(d.explicacion)) d.explicacion = d.explicacion.map(t => (typeof t === 'string' ? t.replace(RE_EXPL_DOSIS, `$1${+p.series} × ${p.reps} con ${desc(p, ejs.indexOf(p))} s$2`) : t));
  return d;
}
export function porQueRehab(S, e, z, dolorHoy) {
  const l = (S.perfil.lesiones || []).find(x => x.activa && x.zona === z) || {};
  const diag = l.nota && l.nota.length <= 40 ? `${l.nota.trim()}, ` : '';
  const d = dolorDe(S, z, dolorHoy);
  return frase(`Ejercicio que suele recomendarse para tu ${nombreZona(z)} (${diag}${d != null ? d + '/10' : 'activa'}): fortalece ${minus(MUSCULOS[e.m[0]] || e.m[0])} sin cargar la zona`) + ` Lento; el dolor puede subir como mucho 2 puntos y nunca pasar de ${techoDolor(S, z, { rehab: true })}/10.`;
}

// ── Principales: llena los huecos de la plantilla hasta los minutos que hay ──
// op: { huecos, presupuesto, k, usados, excluir [ids], maximo }
const NO_PRINCIPAL_AGUA = ['burbujas', 'flotacion'];
export function valePrincipal(S, e, ctx, m = e.m[0]) {
  if (e.m[0] !== m || soloRehab(e)) return false;
  if (ctx.lugar === 'piscina') {
    if (e.m[0] === 'movilidad' || CARDIO_LUGAR.piscina.includes(e.id) || NO_PRINCIPAL_AGUA.includes(e.id)) return false;
    // Quien no sabe nadar 2 × 25 m: nada de largos sin tabla, con cualquier nivel (C-PISC-2, S3); y nada de nivel
    // superior salvo crol y espalda para quien sí sabe (C-DOSIS-10).
    if (noSabeNadar(S, e)) return false;
    if (e.niv > ctx.nivel && !(S.perfil.nadar25 && ['crol', 'espalda'].includes(e.id))) return false;
    return true;
  }
  return esFuerza(e) && (e.t === 'reps' || m === 'core');
}
export function elegirPrincipales(S, ctx, op) {
  const huecos = op.huecos, k = op.k || 0, usados = op.usados || {};
  const an = ctx.an || {}, carga = ctx.futuro ? {} : cargaMuscular(S);
  const excluir = op.excluir || [];
  const elegidos = [];
  let gastado = 0;
  const conRiesgo = z => elegidos.filter(e => (e.r || {})[z]).length;
  const candidatosDe = m => {
    const c = ctx.pool.filter(e => valePrincipal(S, e, ctx, m) && !elegidos.includes(e) && !excluir.includes(e.id)
      && Object.keys(ctx.bandas).every(z => !(e.r || {})[z] || conRiesgo(z) < 2)); // C-DOSIS-4: como mucho 2 con r por zona
    const nivelOk = c.filter(e => e.niv <= ctx.nivel || ctx.lugar === 'piscina'); // C-DOSIS-10
    if (nivelOk.length) return nivelOk;
    // Uno de nivel superior solo si no hay NINGUNO de su nivel para ese músculo aquí (C-DOSIS-10, D-B): si ya
    // se ha elegido el de su nivel, el hueco se queda vacío (S19).
    if (ctx.pool.some(e => e.niv <= ctx.nivel && valePrincipal(S, e, ctx, m))) return [];
    return c.filter(e => e.niv === Math.min(...c.map(x => x.niv)));
  };
  const maximo = op.maximo || 9;
  for (let i = 0; i < huecos.length * 2 && elegidos.length < maximo; i++) {
    const m = huecos[i % huecos.length];
    const c = candidatosDe(m);
    if (!c.length) continue;
    const nota = e => preferencia(an, e.id) + extraBase(m, e.id) - (usados[e.id] || 0) * 6 + (elegidos.length < 2 ? (e.s || []).length * 1.5 : 0)
      + (riesgoHoy(e, ctx.niveles, ctx.bandas) === 'precaucion' ? -3 : 0) + (e.t === 'reps' || ctx.lugar === 'piscina' ? 1 : 0)
      - (carga[e.m[0]] && carga[e.m[0]].estado === 'cargado' ? 4 : 0) + ((e.id.length * 7 + k * 13) % 5) / 10;
    const e = c.sort((a, b) => nota(b) - nota(a) || a.id.localeCompare(b.id))[0];
    const d = dosis(S, e, elegidos.length, ctx.lugar);
    const t = tiempoEj({ ...d, id: e.id });
    if (elegidos.length >= 3 && gastado + t > op.presupuesto) break;
    elegidos.push(e); gastado += t;
    if (i >= huecos.length && elegidos.length >= huecos.length) break;
  }
  // Orden: multiarticulares primero, core al final; nunca el primero con riesgo en una zona activa (C-DOSIS-4).
  elegidos.sort((a, b) => (b.m[0] === 'core' ? -1 : 0) - (a.m[0] === 'core' ? -1 : 0) || (esCompuesto(b) - esCompuesto(a)) || (b.s || []).length - (a.s || []).length);
  const j = elegidos.findIndex(e => riesgoHoy(e, ctx.niveles, ctx.bandas) === 'ok');
  if (j > 0) elegidos.unshift(elegidos.splice(j, 1)[0]);
  return elegidos;
}

// ── Una sesión completa con reglas ──
// op: { lugar, minutos, tipo (PLANTILLAS) | huecos, k (rotación), usados {id:n}, dolorHoy, energia, futuro, extraCardio, rehabExtra }
export function montarDia(S, op) {
  const ctx = contextoDia(S, op);
  const { lugar, minutos } = ctx, k = op.k || 0;
  const tipo = tipoParaLugar(op.tipo, lugar);
  const plantilla = PLANTILLAS[tipo];
  // C-REP-4: A empieza por rodilla, B por cadera y C alterna cada semana (semanas pares, rodilla).
  const semana = +String(semanaISO()).slice(-2);
  const huecosC = semana % 2 ? plantilla.huecos : ['cuadriceps', 'espalda', 'hombro', 'isquios', 'pecho', 'core', 'gluteo', 'gemelo', 'biceps'];
  const huecos = lugar === 'piscina' ? plantilla.huecos : op.huecos || (tipo === 'fullC' ? huecosC : plantilla.huecos);
  const an = ctx.an;
  const usados = op.usados || {};
  const carga = op.futuro ? {} : cargaMuscular(S);

  const rehab = rehabDelDia(S, ctx, { k });
  const ejercicios = rehab.map(({ zona: _z, ...x }) => x);
  const cardio = cardioDelDia(S, ctx, k, op.extraCardio || 0, rehab.map(r => r.id));
  const tCal = minutosCalentamiento(S, ctx), tVue = minutosVuelta(S, ctx);
  const presupuesto = minutos - tCal - tVue - (cardio ? minDe(cardio.reps) : 0) - ejercicios.reduce((t, x) => t + tiempoEj(x), 0);
  const maximo = ctx.energia === 1 ? 3 : ctx.energia === 2 ? 4 : 9; // C-ENERGIA-1
  const elegidos = elegirPrincipales(S, ctx, { huecos, presupuesto, k, usados, excluir: rehab.map(r => r.id), maximo });
  // Lo que dejo fuera por el análisis (estancado, molesta, no lo quiere): cada uno lo sustituye un elegido del mismo músculo.
  const fuera = Object.values(an).filter(a => motivoFuera(a) && ex(a.id) && !elegidos.some(e => e.id === a.id));
  elegidos.forEach((e, i) => {
    usados[e.id] = (usados[e.id] || 0) + 1;
    const d = dosis(S, e, i, lugar);
    const j = fuera.findIndex(a => ex(a.id).m[0] === e.m[0]);
    const sustituye = j >= 0 ? { n: minus(ex(fuera[j].id).n), por: motivoFuera(fuera[j]) } : null;
    if (j >= 0) fuera.splice(j, 1);
    ejercicios.push({ id: e.id, rol: 'principal', ...d, nota: porQueEjercicio(S, e, { i, d, an, carga, niveles: ctx.niveles, dolorHoy: ctx.dolorHoy, sustituye }) });
  });
  if (cardio) ejercicios.push(cardio);
  const calentamiento = calentamientoDe(S, ctx, elegidos, { total: tCal });
  const vuelta = vueltaDe(S, ctx, elegidos, { total: tVue });

  // Por qué
  const explicacion = [];
  const objs = objetivosDe(S).map(o => minus(OBJETIVOS[o] ? OBJETIVOS[o].nombre : o));
  const d0 = elegidos[0] ? dosis(S, elegidos[0], 0, lugar) : null;
  explicacion.push(`${plantilla.nombre} en ${minus(LUGARES[lugar])} para unos ${minutos} minutos: ${elegidos.length} ejercicios principales${rehab.length ? `, ${rehab.length} para tu lesión` : ''}${cardio ? ' y cardio al final' : ''}.`);
  if (d0 && ex(elegidos[0].id).t === 'reps') explicacion.push(`Dosis para ${lista(objs)} y nivel ${['', 'principiante', 'intermedio', 'avanzado'][ctx.nivel]}: el primer básico va a ${d0.series} × ${d0.reps} con ${d0.descanso} s de descanso; los accesorios, más repeticiones y menos descanso.`);
  if (rehab.length) explicacion.push(`Ejercicios para ${lista([...new Set(rehab.map(r => nombreZona(r.zona)))])} al principio, con la dosis que suele recomendarse; lo que carga esa zona no aparece.`);
  if (cardio) explicacion.push(`Cardio de ${cardio.reps}: toda sesión lleva cardio, y los minutos salen de tu objetivo principal (${objs[0]}).`);
  const evitados = Object.values(an).filter(a => a.estado === 'molesta' || a.gusto === 'nogusta').map(a => ex(a.id).n.toLowerCase());
  if (evitados.length) explicacion.push(`Dejo fuera o al final ${lista(evitados.slice(0, 3))}: no te gusta o te ha molestado.`);
  const estancados = elegidos.length ? Object.values(an).filter(a => a.estado === 'estancado' && !elegidos.some(e => e.id === a.id)) : [];
  if (estancados.length) explicacion.push(`Cambio ${lista(estancados.slice(0, 2).map(a => ex(a.id).n.toLowerCase()))} por variantes: llevabas 4 sesiones sin mejorar.`);
  explicacion.unshift(resumenDia(S, { plantilla, lugar, elegidos, rehab, cardio, an, carga, extraCardio: op.extraCardio || 0, dolorHoy: ctx.dolorHoy }));
  const dia = { fuente: 'reglas', lugar, minutos, nombre: plantilla.nombre, foco: [...new Set(elegidos.map(e => MUSCULOS[e.m[0]]))].slice(0, 4).join(', '), tipo, explicacion, calentamiento, ejercicios, vuelta };
  // Validador único también al montar los días (C-PRIN-3).
  const v = validarSesion(S, dia, { lugar, minutos, dolorHoy: ctx.dolorHoy, energia: ctx.energia, futuro: ctx.futuro, origen: 'reglas', k, tipo, usados }); // usados: C-TIEMPO-5 rota en el plan
  v.sesion.explicacion = [...v.sesion.explicacion, ...v.cambios.map(c => 'Ajustado por la app: ' + c)];
  return v.sesion;
}

// Una frase: por qué este día es así (lo primero que se lee en Hoy y en la sesión).
export function resumenDia(S, c) {
  const musc = [...new Set(c.elegidos.map(e => minus(MUSCULOS[e.m[0]])))].slice(0, 3);
  const partes = [`${c.plantilla.nombre}${musc.length ? ` (${lista(musc)})` : ''} porque buscas ${objsTxt(S)}`];
  if (c.rehab.length) partes.push(`ejercicios para ${lista([...new Set(c.rehab.map(r => zonaTxt(S, r.zona, c.dolorHoy)))])}`); // el dolor de hoy (IA-5)
  if (c.cardio) partes.push(`${c.cardio.reps} de cardio${c.extraCardio ? ' (más que antes: tu peso no baja)' : ''}`);
  const cambiados = Object.values(c.an).filter(a => motivoFuera(a) && ex(a.id) && !c.elegidos.some(e => e.id === a.id)).map(a => minus(ex(a.id).n));
  let t = partes.length > 1 ? `${partes[0]}, con ${lista(partes.slice(1))}` : partes[0];
  if (cambiados.length) t += `; dejo fuera ${lista(cambiados.slice(0, 2))} por cómo te ha ido`;
  return frase(t);
}

// El nombre que pone la IA no puede contradecir lo que lleva la sesión (verificación del 22-11: «Torso» con la
// prensa de piernas daba «Torso (pecho, espalda y cuádriceps)»). Si dice solo tren superior y hay un principal de
// pierna, o al revés, pasa a «Cuerpo completo».
const INFERIOR = ['gluteo', 'cuadriceps', 'isquios', 'gemelo'];
const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function nombreCoherente(nombre, ejercicios) {
  const t = sinTildes(nombre);
  if (/completo|full/.test(t)) return nombre;
  const dice = { sup: /torso|superior|empuje|tiron|pecho|espalda|brazo|hombro/.test(t), inf: /pierna|inferior|gluteo|cuadriceps|isquio/.test(t) };
  if (dice.sup === dice.inf) return nombre;
  // Revisión del PR #53: la cadena posterior que también trabaja la espalda (peso muerto rumano, extensión a 45°)
  // cuadra con «Espalda» o «Tirón»; y solo choca si hay 2 principales del otro tren o más que del nombrado.
  const posterior = /espalda|tiron/.test(t);
  const prin = (ejercicios || []).filter(x => x && x.rol === 'principal' && ex(x.id)).map(x => ex(x.id))
    .filter(e => !(posterior && INFERIOR.includes(e.m[0]) && (e.s || []).includes('espalda')));
  const delOtro = prin.filter(e => (dice.sup ? INFERIOR : SUPERIOR).includes(e.m[0])).length;
  const delSuyo = prin.filter(e => (dice.sup ? SUPERIOR : INFERIOR).includes(e.m[0])).length;
  if (!(delOtro >= 2 || delOtro > delSuyo)) return nombre;
  const letra = String(nombre || '').trim().match(/ ([A-Z])$/);
  return 'Cuerpo completo' + (letra ? ' ' + letra[1] : '');
}

// ── Tiempo (C-TIEMPO-1) ──
const RITMO_100M = { 1: 3, 2: 2.5, 3: 2 }; // C-PISC-4
function metros(reps) {
  const t = String(reps || '');
  const m = t.match(/(\d+)\s*m\b/); if (m) return +m[1];
  const a = t.match(/(\d+)\s*anchos?/); if (a) return +a[1] * 12.5;
  return 25;
}
// Minutos de un ejercicio con sus descansos.
export function tiempoEj(x, nivel = 2) {
  const e = ex(x.id); if (!e) return 0;
  const series = +x.series || 1, desc = (+x.descanso || 0) / 60;
  if (x.rol === 'cardio' || e.t === 'tiempo' && minDe(x.reps) >= 3) return minDe(x.reps) * series;
  if (e.t === 'distancia') return series * (metros(x.reps) / 100 * (RITMO_100M[nivel] || 2.5) + desc) + 0.5;
  if (e.t === 'tiempo') { const r = rango(x.reps); const lo = !r ? 0 : r.u === 'min' ? r.lo : r.lo / 60; return series * (Math.max(0.25, lo) + desc) + 0.5; } // isométricos: con el mínimo del rango (C-TIEMPO-1)
  return series * (0.7 + desc) + (x.rol === 'rehab' ? 0.5 : 1);
}
// Minutos de una lista de tareas («5 min», «30 s», «2-3 min»); null si ninguna dice su duración.
export function minutosTareas(tareas) {
  if (!Array.isArray(tareas) || !tareas.length) return null;
  const ms = tareas.map(t => minDe(t.duracion));
  return ms.some(m => m > 0) ? ms.reduce((a, b) => a + b, 0) : null;
}
// Ejercicios con su tiempo; x.superserie: va en pareja con el siguiente (C-TIEMPO-1, C-TIEMPO-3). Tras la última serie
// del último ejercicio de fuerza no se descansa: se pasa al cardio o a la vuelta (revisión del PR #48).
const esBloqueMin = x => { const e = ex(x.id); return !e || x.rol === 'cardio' || (e.t === 'tiempo' && minDe(x.reps) >= 3); };
export function tiempoEjercicios(ejs = []) {
  let t = 0;
  const ult = ejs.reduce((u, x, i) => (esBloqueMin(x) ? u : i), -1);
  for (let i = 0; i < ejs.length; i++) {
    const x = ejs[i], y = ejs[i + 1];
    if (x.superserie && y && ex(x.id) && ex(y.id)) {
      t += Math.max(+x.series || 1, +y.series || 1) * (1.4 + (+y.descanso || 0) / 60) + 1 - (i + 1 === ult ? (+y.descanso || 0) / 60 : 0); i++; continue;
    }
    t += tiempoEj(x) - (i === ult ? (+x.descanso || 0) / 60 : 0);
  }
  return t;
}
// Minutos de la sesión: calentamiento y vuelta por la duración de sus tareas (8 y 5 si no la dicen).
export const tiempoSesionExacto = d => (minutosTareas(d.calentamiento) ?? 8) + (minutosTareas(d.vuelta) ?? 5) + tiempoEjercicios(d.ejercicios || []);
export const tiempoSesion = d => Math.round(tiempoSesionExacto(d));
