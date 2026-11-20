// Área ENTRENADOR · el día: una sesión completa con reglas (sin IA).
// Dosis por objetivo y nivel, la regla de cardio, el porqué de cada ejercicio y el tiempo que lleva.
// También las pequeñas utilidades de texto y objetivos que comparten plan.js, checkin.js e ia.js.

import { analizarEjercicios, preferencia } from '../../reglas/contexto.js';
import { cargaMuscular, rango } from '../../reglas/progresion.js';
import { nivelesZona, ex, riesgo, disponibles, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS, OBJETIVOS } from '../../datos/constantes.js';

// ── Plantillas de día: huecos por músculo principal, del más importante al menos ──
const PLANTILLAS = {
  fullA: { nombre: 'Cuerpo completo A', huecos: ['cuadriceps', 'espalda', 'pecho', 'isquios', 'hombro', 'core', 'gluteo', 'biceps', 'triceps'] },
  fullB: { nombre: 'Cuerpo completo B', huecos: ['gluteo', 'pecho', 'espalda', 'cuadriceps', 'hombro', 'core', 'triceps', 'biceps', 'isquios'] },
  fullC: { nombre: 'Cuerpo completo C', huecos: ['isquios', 'espalda', 'hombro', 'cuadriceps', 'pecho', 'core', 'gluteo', 'gemelo', 'biceps'] },
  torso: { nombre: 'Torso', huecos: ['pecho', 'espalda', 'hombro', 'espalda', 'pecho', 'triceps', 'biceps', 'core'] },
  pierna: { nombre: 'Pierna y glúteo', huecos: ['cuadriceps', 'gluteo', 'isquios', 'cuadriceps', 'gluteo', 'gemelo', 'core'] },
  empuje: { nombre: 'Empuje', huecos: ['pecho', 'hombro', 'pecho', 'triceps', 'hombro', 'core', 'triceps'] },
  tiron: { nombre: 'Tirón', huecos: ['espalda', 'espalda', 'isquios', 'biceps', 'hombro', 'core', 'biceps'] },
  salud: { nombre: 'Salud y movilidad', huecos: ['gluteo', 'espalda', 'core', 'cuadriceps', 'hombro', 'core', 'isquios'] },
  piscina: { nombre: 'Piscina', huecos: ['natacion', 'natacion', 'cardio', 'natacion', 'gluteo', 'cardio', 'natacion'] },
};
const MOVILIDAD = {
  superior: ['circulos-brazos', 'dislocaciones-banda', 'rotacion-toracica-cuadrupedia'],
  inferior: ['circulos-cadera', 'balanceo-pierna-frontal', 'movilidad-tobillo-pared'],
  core: ['gato-camello'],
};
const SUPERIOR = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'];
const ESTIRA = {
  pecho: ['estiramiento-pectoral-puerta'], hombro: ['estiramiento-hombro-cruzado'], espalda: ['postura-nino'], triceps: ['estiramiento-hombro-cruzado'],
  biceps: ['estiramiento-pectoral-puerta'], cuadriceps: ['estiramiento-cuadriceps-pie', 'estiramiento-flexor-cadera'], isquios: ['estiramiento-isquios-tumbado'],
  gluteo: ['estiramiento-gluteo-rodilla-pecho', 'estiramiento-figura-4'], gemelo: ['estiramiento-gemelo-pared'], core: ['gato-camello'],
  natacion: ['estiramiento-hombro-cruzado', 'postura-nino'], cardio: ['estiramiento-gemelo-pared'],
};
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
const esFuerza = e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]);
const esCompuesto = e => (e.s || []).length > 0 && !/aperturas|cruces|elevacion|curl|extension|patada|abduc|face-pull|pajaros|crunch|talones|plancha/.test(e.id);
export const minDe = txt => { const r = rango(txt); return !r ? 0 : r.u === 'min' ? r.hi : r.u === 's' ? r.hi / 60 : 0; };
export const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
export const minus = t => String(t || '').toLowerCase();

// ── Dosis: series, repeticiones y descanso según TODOS sus objetivos y su nivel ──
export function dosis(S, e, i, lugar = 'gym') {
  const nivel = S.perfil.nivel || 1;
  if (e.t !== 'reps' || !esFuerza(e)) return { series: e.d[0], reps: e.d[1], descanso: e.d[2] };
  const uni = / c\//.test(e.d[1]) ? ' c/' + e.d[1].split(' c/')[1] : '';
  const compuesto = esCompuesto(e), peq = ['core', 'gemelo', 'biceps', 'triceps'].includes(e.m[0]);
  let d;
  if (e.m[0] === 'core') d = [3, '10-15', 45];
  else if (tiene(S, 'fuerza') && compuesto && i < 2 && !uni && !/puente|gluteo|hip-thrust|zancada|step|abduc/.test(e.id)) d = nivel === 1 || i === 1 ? [3, '6-8', 120] : [4, '4-6', 150];
  else if (tiene(S, 'musculo')) d = compuesto && i < 3 ? [nivel >= 2 ? 4 : 3, '6-10', 120] : peq ? [3, '10-15', 60] : [3, '8-12', 75];
  else if (tiene(S, 'fuerza')) d = [3, '6-8', 90];
  else if (tiene(S, 'perder')) d = [3, peq ? '12-15' : '10-12', 60];
  else if (tiene(S, 'resistencia')) d = [3, '15-20', 40];
  else d = [nivel >= 2 ? 3 : 2, '10-15', 60];
  // Perder grasa a la vez que otra cosa: mismos rangos, descansos más cortos en accesorios.
  if (tiene(S, 'perder') && !(compuesto && i < 2)) d[2] = Math.min(d[2], 60);
  if (tiene(S, 'resistencia') && !(compuesto && i < 2)) d[2] = Math.min(d[2], 45);
  // En casa o en la calle no hay cargas máximas: descansos más cortos.
  if (lugar === 'casa' || lugar === 'calle') d[2] = Math.min(d[2], 75);
  return { series: d[0], reps: d[1] + uni, descanso: d[2] };
}

// ── Cardio: la regla de cuándo va y cuánto ──
// Única definición de la regla de cardio. Devuelve null si no toca cardio; si toca, { objetivo que lo pide,
// minutos de base, obligatorio }. «obligatorio»: la app lo añade aunque la IA no lo proponga.
// Quién la usa hoy, y cómo:
// - cardioDelDia (aquí) la llama sin dolorMax: montarDia pone cardio aunque haya dolor ≥ 7.
// - completarIA (ia.js) la llama sin dolorMax: añade cardio a la sesión de la IA (perder, resistencia)
//   también con dolor ≥ 7.
// - ajustarAlCheckin (checkin.js), solo en su rama de dolor ≥ 7, la llama con dolorMax: siempre da null,
//   así que quita el cardio de la «Sesión suave» de reglas.
// Unificar el criterio (D3, y el día de dolor alto según D2) es del PR 8.
export function reglaCardio(S, lugar, { dolorMax = 0 } = {}) {
  if (lugar === 'piscina' || dolorMax >= 7) return null;
  const conFuerza = tiene(S, 'musculo') || tiene(S, 'fuerza');
  if (tiene(S, 'perder')) return { objetivo: 'perder', minutos: conFuerza ? 15 : 20, obligatorio: true };
  if (tiene(S, 'resistencia')) return { objetivo: 'resistencia', minutos: 15, obligatorio: true };
  if (tiene(S, 'salud')) return { objetivo: 'salud', minutos: 10, obligatorio: false };
  return null;
}

// El ejercicio de cardio del día, con su porqué.
function cardioDelDia(S, lugar, pool, k, extra = 0) {
  const regla = reglaCardio(S, lugar);
  if (!regla) return null;
  const nivel = S.perfil.nivel || 1, an = analizarEjercicios(S);
  const conFuerza = tiene(S, 'musculo') || tiene(S, 'fuerza');
  const reps = `${regla.minutos + extra} min`;
  const mas = extra ? ` (+${extra} porque tu peso no ha bajado en 4 semanas)` : '';
  let nota = {
    perder: `${reps}${mas} porque buscas perder grasa${conFuerza ? ' sin quitar sitio a la fuerza' : ''}. Ritmo en el que puedas hablar con frases cortas.`,
    resistencia: `${reps}${mas} porque buscas resistencia. ` + (nivel >= 2 ? 'Intervalos: 2 min fuerte y 1 min suave.' : 'Ritmo constante y cómodo; sube un poco cada semana.'),
    salud: `${reps}${mas} suaves por la salud del corazón.`,
  }[regla.objetivo];
  const maq = e => (lugar === 'gym' && e.mat.includes('maquina') ? 2 : 0);
  const c = pool.filter(e => e.m[0] === 'cardio' && e.t === 'tiempo').sort((a, b) => (preferencia(an, b.id) + maq(b)) - (preferencia(an, a.id) + maq(a)) || a.niv - b.niv || a.id.localeCompare(b.id));
  if (!c.length) return null;
  const opciones = c.filter(e => maq(e)).length >= 2 ? c.filter(e => maq(e)) : c;
  const e = opciones[k % Math.min(opciones.length, 3)];
  if (S.perfil.lugares.includes('piscina') && lugar === 'gym') nota += ' Si os apetece, hacedlo en la piscina: nado suave o aquajogging.';
  return { id: e.id, rol: 'cardio', series: 1, reps, descanso: 0, nota };
}

// ── Por qué de cada ejercicio: corto y con sus datos, nunca una frase genérica ──
export const frase = t => { t = String(t || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) + (/[.!?»)]$/.test(t) ? '' : '.') : ''; };
const POR_QUE_FUERA = { estancado: 'llevaba 3 sesiones sin mejorar', molesta: 'te ha molestado', rechazado: 'no lo quieres' };
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
  return `tu ${minus((ZONAS[z] || {}).corta || z)}${d != null ? ` (${d}/10)` : ''}`;
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
    if (zs.length) out.push(`Implica a ${lista(zs.map(z => zonaTxt(S, z, c.dolorHoy)))}: carga moderada y para si pasa de 3/10`);
  }
  if (a && a.problemas.includes('dificil')) out.push('La última vez te costó: empieza más ligero');
  return out.slice(0, 3).map(frase).join(' ');
}
export function porQueRehab(S, e, z, dolorHoy) {
  const l = (S.perfil.lesiones || []).find(x => x.activa && x.zona === z) || {};
  const diag = l.nota && l.nota.length <= 40 ? `${l.nota.trim()}, ` : '';
  const d = dolorDe(S, z, dolorHoy);
  return frase(`Para tu ${minus((ZONAS[z] || {}).corta || z)} (${diag}${d != null ? d + '/10' : 'activa'}): fortalece ${minus(MUSCULOS[e.m[0]] || e.m[0])} sin cargar la zona`) + ' Lento; el dolor no debe pasar de 3/10.';
}

// ── Una sesión completa con reglas ──
// op: { lugar, minutos, tipo (PLANTILLAS) | huecos, k (rotación), usados {id:n}, dolorHoy, futuro, extraCardio, rehabExtra }
export function montarDia(S, op) {
  const lugar = op.lugar, minutos = +op.minutos || S.perfil.disponibilidad.minutos || 60, k = op.k || 0;
  const plantilla = PLANTILLAS[op.tipo] || PLANTILLAS.fullA;
  const huecos = op.huecos || plantilla.huecos;
  const nivel = S.perfil.nivel || 1;
  const niveles = nivelesZona(S.perfil, op.dolorHoy || {});
  const pool = disponibles(S.perfil, lugar, { dolorHoy: op.dolorHoy || {} });
  const an = analizarEjercicios(S);
  const usados = op.usados || {};
  const carga = op.futuro ? {} : cargaMuscular(S);
  const explicacion = [];

  // Rehabilitación de cada zona activa, al principio y rotando entre días.
  const zonas = Object.keys(niveles).filter(z => ZONAS[z]);
  const porZona = zonas.length === 1 ? (op.rehabExtra ? 3 : 2) : 1;
  const rehab = [];
  zonas.forEach(z => {
    const ids = (ZONAS[z].rehab || []).filter(id => pool.some(e => e.id === id));
    for (let j = 0; j < Math.min(porZona, ids.length) && rehab.length < 3; j++) rehab.push({ id: ids[(k + j) % ids.length], zona: z });
  });
  const ejercicios = rehab.map(r => {
    const e = ex(r.id);
    return { id: e.id, rol: 'rehab', series: Math.min(3, e.d[0]), reps: e.d[1], descanso: 45, nota: porQueRehab(S, e, r.zona, op.dolorHoy || {}) };
  });

  // Principal: llena los huecos hasta los minutos que tiene.
  const cardio = cardioDelDia(S, lugar, pool, k, op.extraCardio || 0);
  const presupuesto = minutos - 8 - 5 - (cardio ? minDe(cardio.reps) : 0) - ejercicios.reduce((t, x) => t + tiempoEj(x), 0);
  const elegidos = [];
  let gastado = 0;
  const candidatosDe = m => pool.filter(e => e.m[0] === m && (lugar === 'piscina' ? e.m[0] !== 'movilidad' : esFuerza(e) && (e.t === 'reps' || m === 'core')) && !elegidos.includes(e) && !rehab.some(r => r.id === e.id));
  for (let i = 0; i < huecos.length * 2; i++) {
    const m = huecos[i % huecos.length];
    const c = candidatosDe(m);
    if (!c.length) continue;
    const nota = e => preferencia(an, e.id) + extraBase(m, e.id) - (usados[e.id] || 0) * 6 + (elegidos.length < 2 ? (e.s || []).length * 1.5 : 0)
      + (e.niv <= nivel ? 1 : -2) + (riesgo(e, niveles) === 'precaucion' ? -3 : 0) + (e.t === 'reps' || lugar === 'piscina' ? 1 : 0)
      - (carga[e.m[0]] && carga[e.m[0]].estado === 'cargado' ? 4 : 0) + ((e.id.length * 7 + k * 13) % 5) / 10;
    const e = c.sort((a, b) => nota(b) - nota(a) || a.id.localeCompare(b.id))[0];
    const d = dosis(S, e, elegidos.length, lugar);
    const t = tiempoEj({ ...d, id: e.id });
    if (elegidos.length >= (minutos >= 75 ? 4 : 3) && gastado + t > presupuesto) break;
    elegidos.push(e); gastado += t;
    if (i >= huecos.length && elegidos.length >= huecos.length) break;
  }
  // Orden: multiarticulares primero, core al final.
  elegidos.sort((a, b) => (b.m[0] === 'core' ? -1 : 0) - (a.m[0] === 'core' ? -1 : 0) || (esCompuesto(b) - esCompuesto(a)) || (b.s || []).length - (a.s || []).length);
  // Lo que dejo fuera por el análisis (estancado, molesta, no lo quiere): cada uno lo sustituye un elegido del mismo músculo.
  const fuera = Object.values(an).filter(a => motivoFuera(a) && ex(a.id) && !elegidos.some(e => e.id === a.id));
  elegidos.forEach((e, i) => {
    usados[e.id] = (usados[e.id] || 0) + 1;
    const d = dosis(S, e, i, lugar);
    const j = fuera.findIndex(a => ex(a.id).m[0] === e.m[0]);
    const sustituye = j >= 0 ? { n: minus(ex(fuera[j].id).n), por: motivoFuera(fuera[j]) } : null;
    if (j >= 0) fuera.splice(j, 1);
    ejercicios.push({ id: e.id, rol: 'principal', ...d, nota: porQueEjercicio(S, e, { i, d, an, carga, niveles, dolorHoy: op.dolorHoy || {}, sustituye }) });
  });
  if (cardio) {
    ejercicios.push(cardio);
    // Si los ejercicios mínimos no caben, el cardio se acorta (nunca menos de 10 min).
    const sobra = tiempoSesion({ ejercicios: [...ejercicios, ...elegidos.map((e, i) => ({ id: e.id, ...dosis(S, e, i, lugar) }))] }) - minutos;
    if (sobra > 3) { cardio.reps = `${Math.max(10, minDe(cardio.reps) - Math.round(sobra))} min`; cardio.nota = cardio.nota.replace(/^\d+ min( \([^)]*\))?/, `${cardio.reps} (lo que cabe en tu tiempo)`); }
  }

  // Calentamiento: cardio suave, movilidad de lo que se usa, activación de la lesión, aproximación.
  const usaSup = elegidos.some(e => SUPERIOR.includes(e.m[0])), usaInf = elegidos.some(e => !SUPERIOR.includes(e.m[0]) && e.m[0] !== 'core');
  const calentamiento = [];
  if (lugar === 'piscina') {
    calentamiento.push({ id: ex('caminar-agua') ? 'caminar-agua' : null, nombre: 'Caminar en el agua', detalle: 'Paso amplio, brazos activos.', duracion: '4 min' });
    calentamiento.push({ id: ex('burbujas') ? 'burbujas' : null, nombre: 'Burbujas', detalle: 'Soltar el aire bajo el agua, 10 veces.', duracion: '2 min' });
    calentamiento.push({ id: 'circulos-brazos', nombre: ex('circulos-brazos') ? ex('circulos-brazos').n : 'Círculos de brazos', detalle: 'Dentro del agua, hacia delante y atrás.', duracion: '1 min' });
  } else {
    const suave = pool.filter(e => e.m[0] === 'cardio' && e.t === 'tiempo').sort((a, b) => a.niv - b.niv || preferencia(an, b.id) - preferencia(an, a.id))[0];
    calentamiento.push({ id: suave ? suave.id : null, nombre: suave ? suave.n : 'Cardio suave', detalle: 'Ritmo cómodo, hasta notar calor y algo de sudor.', duracion: '5 min' });
    const mov = [...(usaSup ? MOVILIDAD.superior : []), ...(usaInf ? MOVILIDAD.inferior : []), ...MOVILIDAD.core]
      .filter(id => ex(id) && riesgo(ex(id), niveles) !== 'evitar' && ex(id).l.includes(lugar));
    mov.slice(0, 3).forEach(id => calentamiento.push({ id, nombre: ex(id).n, detalle: '8-10 repeticiones lentas, sin forzar.', duracion: '1 min' }));
  }
  zonas.forEach(z => (ZONAS[z].calentar || []).filter(t => !/bici|cinta|el[ií]ptic|cardio/i.test(t)).slice(0, 1)
    .forEach(t => calentamiento.push({ nombre: t, detalle: `Activación para tu ${minus(ZONAS[z].corta)}.`, duracion: '2 min' })));
  const primero = elegidos.find(e => e.t === 'reps' && esCompuesto(e) && !e.mat.includes('peso corporal'));
  if (primero && lugar !== 'piscina') calentamiento.push({ nombre: 'Series de aproximación', detalle: `${primero.n}: 1 serie de 10 con la mitad del peso y 1 de 5 con el 75 %.`, duracion: '3 min' });

  // Vuelta a la calma: estiramientos de lo trabajado y de la lesión, respiración.
  const trabajados = [...new Set(elegidos.flatMap(e => [e.m[0], ...(e.s || []).slice(0, 1)]))];
  const vuelta = [];
  if (lugar === 'piscina') vuelta.push({ id: ex('flotacion') ? 'flotacion' : null, nombre: 'Flotación boca arriba', detalle: 'Suelta el cuerpo y respira lento.', duracion: '2 min' });
  trabajados.flatMap(m => ESTIRA[m] || []).filter((id, i, a) => a.indexOf(id) === i && ex(id) && riesgo(ex(id), niveles) !== 'evitar').slice(0, 4)
    .forEach(id => vuelta.push({ id, nombre: ex(id).n, detalle: '30 s por lado, respirando lento, sin rebotes.', duracion: '1 min' }));
  zonas.forEach(z => (ZONAS[z].estirar || []).slice(0, op.rehabExtra ? 2 : 1).forEach(t => vuelta.push({ nombre: t, detalle: `Para tu ${minus(ZONAS[z].corta)}: 30 s por lado.`, duracion: '1 min' })));
  vuelta.push({ nombre: 'Respiración', detalle: 'Tumbado, 6 respiraciones lentas soltando el aire en 6 segundos.', duracion: '1 min' });

  // Por qué
  const objs = objetivosDe(S).map(o => minus(OBJETIVOS[o] ? OBJETIVOS[o].nombre : o));
  const d0 = elegidos[0] ? dosis(S, elegidos[0], 0, lugar) : null;
  explicacion.push(`${plantilla.nombre} en ${minus(LUGARES[lugar])} para unos ${minutos} minutos: ${elegidos.length} ejercicios principales${rehab.length ? `, ${rehab.length} de rehabilitación` : ''}${cardio ? ' y cardio al final' : ''}.`);
  if (d0 && ex(elegidos[0].id).t === 'reps') explicacion.push(`Dosis para ${lista(objs)} y nivel ${['', 'principiante', 'intermedio', 'avanzado'][nivel]}: el primer básico va a ${d0.series} × ${d0.reps} con ${d0.descanso} s de descanso; los accesorios, más repeticiones y menos descanso.`);
  if (rehab.length) explicacion.push(`Rehabilitación de ${lista([...new Set(rehab.map(r => minus(ZONAS[r.zona].corta)))])} al principio, con dosis terapéutica; lo que carga esa zona no aparece.`);
  if (cardio) explicacion.push(`Cardio de ${cardio.reps} porque buscas ${lista(objs.filter(o => /grasa|resistencia|salud/.test(o)))}.`);
  const evitados = Object.values(an).filter(a => a.estado === 'molesta' || a.gusto === 'nogusta').map(a => ex(a.id).n.toLowerCase());
  if (evitados.length) explicacion.push(`Dejo fuera o al final ${lista(evitados.slice(0, 3))}: no te gusta o te ha molestado.`);
  const estancados = elegidos.length ? Object.values(an).filter(a => a.estado === 'estancado' && !elegidos.some(e => e.id === a.id)) : [];
  if (estancados.length) explicacion.push(`Cambio ${lista(estancados.slice(0, 2).map(a => ex(a.id).n.toLowerCase()))} por variantes: llevabas 3 sesiones sin mejorar.`);

  explicacion.unshift(resumenDia(S, { plantilla, lugar, elegidos, rehab, cardio, an, carga, extraCardio: op.extraCardio || 0 }));
  return { fuente: 'reglas', lugar, minutos, nombre: plantilla.nombre, foco: [...new Set(elegidos.map(e => MUSCULOS[e.m[0]]))].slice(0, 4).join(', '), tipo: op.tipo, explicacion, calentamiento, ejercicios, vuelta };
}

// Una frase: por qué este día es así (lo primero que se lee en Hoy y en la sesión).
export function resumenDia(S, c) {
  const musc = [...new Set(c.elegidos.map(e => minus(MUSCULOS[e.m[0]])))].slice(0, 3);
  const partes = [`${c.plantilla.nombre}${musc.length ? ` (${lista(musc)})` : ''} porque buscas ${objsTxt(S)}`];
  if (c.rehab.length) partes.push(`rehabilitación de ${lista([...new Set(c.rehab.map(r => zonaTxt(S, r.zona)))])}`);
  if (c.cardio) partes.push(`${c.cardio.reps} de cardio${c.extraCardio ? ' (más que antes: tu peso no baja)' : ''}`);
  const cambiados = Object.values(c.an).filter(a => motivoFuera(a) && ex(a.id) && !c.elegidos.some(e => e.id === a.id)).map(a => minus(ex(a.id).n));
  let t = partes.length > 1 ? `${partes[0]}, con ${lista(partes.slice(1))}` : partes[0];
  if (cambiados.length) t += `; dejo fuera ${lista(cambiados.slice(0, 2))} por cómo te ha ido`;
  return frase(t);
}

// Minutos aproximados de un ejercicio con sus descansos.
export function tiempoEj(x) {
  const e = ex(x.id); if (!e) return 0;
  if (x.rol === 'cardio' || e.t === 'tiempo' && minDe(x.reps) >= 3) return minDe(x.reps) * (x.series || 1);
  const trabajo = e.t === 'tiempo' ? Math.max(0.5, minDe(x.reps)) : e.t === 'distancia' ? 1 : 0.8;
  return x.series * (trabajo + (x.descanso || 0) / 60) + 1;
}
export const tiempoSesion = d => Math.round(8 + 5 + (d.ejercicios || []).reduce((t, x) => t + tiempoEj(x), 0));
