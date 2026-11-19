// Área ENTRENADOR (cerebro): plan de la semana, sesión del día y cómo cambian con lo que pasa.
//
// Quién decide qué:
// - La IA (/api/entrenador) diseña el plan de la semana y, cuando hace falta pensar (dolor nuevo, una petición,
//   otro lugar, poca energía…), la sesión del día. Cada llamada cuesta dinero, así que no se llama por rutina.
// - Las reglas de esta área montan un plan y una sesión completos sin IA (sin red, sin saldo o en modo ahorro)
//   y ajustan cada día al check-in: energía, dolor, tiempo, lugar, recuperación, progresión, gustos y comentarios.
// - Barandillas sobre lo que diga la IA: solo ejercicios seguros, kilos acotados, siempre calentamiento,
//   rehabilitación de las lesiones activas, cardio si el objetivo lo pide y vuelta a la calma.

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { llamar, enLinea } from '../../nucleo/api.js';
import { es } from '../../nucleo/ui.js';
import { crearSesion, semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { perfilParaIA, lesionesParaIA, catalogoParaIA, historialParaIA, analizarEjercicios, analisisParaIA, preferencia, tendencias, leerComentario } from '../../reglas/contexto.js';
import { acotarKg, sugerir, cargaMuscular, sesionesHechas, rango } from '../../reglas/progresion.js';
import { nivelesZona, ex, riesgo, disponibles, alternativas, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS, OBJETIVOS, DIAS } from '../../datos/constantes.js';

const DIA = 864e5;

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
// Volumen semanal orientativo por músculo grande (series), según objetivo.
const VOLUMEN = { musculo: [10, 16], fuerza: [8, 12], perder: [8, 12], resistencia: [6, 10], salud: [4, 8], natacion: [4, 8] };
const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];
// Zonas en las que la piscina descarga (cardio sin impacto).
const ZONAS_CARGA = ['cadera_lateral', 'rodilla', 'lumbar', 'tobillo_pie'];

const objetivosDe = S => (S.perfil.objetivos.length ? S.perfil.objetivos : ['salud']);
const tiene = (S, o) => objetivosDe(S).includes(o);
const esFuerza = e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]);
const esCompuesto = e => (e.s || []).length > 0 && !/aperturas|cruces|elevacion|curl|extension|patada|abduc|face-pull|pajaros|crunch|talones|plancha/.test(e.id);
const minDe = txt => { const r = rango(txt); return !r ? 0 : r.u === 'min' ? r.hi : r.u === 's' ? r.hi / 60 : 0; };
const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
const minus = t => String(t || '').toLowerCase();

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

// ── Cardio según objetivo ──
function cardioDelDia(S, lugar, pool, k, extra = 0) {
  if (lugar === 'piscina') return null;
  const nivel = S.perfil.nivel || 1, an = analizarEjercicios(S);
  let reps = null, nota = '';
  const conFuerza = tiene(S, 'musculo') || tiene(S, 'fuerza');
  const mas = extra ? ` (+${extra} porque tu peso no ha bajado en 4 semanas)` : '';
  if (tiene(S, 'perder')) { reps = `${(conFuerza ? 15 : 20) + extra} min`; nota = `${reps}${mas} porque buscas perder grasa${conFuerza ? ' sin quitar sitio a la fuerza' : ''}. Ritmo en el que puedas hablar con frases cortas.`; }
  else if (tiene(S, 'resistencia')) { reps = `${15 + extra} min`; nota = `${reps}${mas} porque buscas resistencia. ` + (nivel >= 2 ? 'Intervalos: 2 min fuerte y 1 min suave.' : 'Ritmo constante y cómodo; sube un poco cada semana.'); }
  else if (tiene(S, 'salud')) { reps = `${10 + extra} min`; nota = `${reps}${mas} suaves por la salud del corazón.`; }
  if (!reps) return null;
  const maq = e => (lugar === 'gym' && e.mat.includes('maquina') ? 2 : 0);
  const c = pool.filter(e => e.m[0] === 'cardio' && e.t === 'tiempo').sort((a, b) => (preferencia(an, b.id) + maq(b)) - (preferencia(an, a.id) + maq(a)) || a.niv - b.niv || a.id.localeCompare(b.id));
  if (!c.length) return null;
  const opciones = c.filter(e => maq(e)).length >= 2 ? c.filter(e => maq(e)) : c;
  const e = opciones[k % Math.min(opciones.length, 3)];
  if (S.perfil.lugares.includes('piscina') && lugar === 'gym') nota += ' Si os apetece, hacedlo en la piscina: nado suave o aquajogging.';
  return { id: e.id, rol: 'cardio', series: 1, reps, descanso: 0, nota };
}

// Ajustes por cómo van las cosas (peso, dolor, constancia). Cambian el plan y se explican.
export function ajustesPorTendencia(S) {
  const t = tendencias(S), out = { cardioExtra: 0, rehabExtra: false, notas: [] };
  if (tiene(S, 'perder') && t.cambioPeso4sem != null && t.cambioPeso4sem >= 0) {
    out.cardioExtra = 5; out.notas.push(`Tu peso no ha bajado en 4 semanas (${t.cambioPeso4sem >= 0 ? '+' : ''}${es(t.cambioPeso4sem)} kg): subo 5 minutos el cardio. Revisa también la nutrición.`);
  }
  if (tiene(S, 'perder') && t.cambioPeso4sem != null && t.cambioPeso4sem < -3) out.notas.push(`Has bajado ${es(-t.cambioPeso4sem)} kg en 4 semanas: es rápido; prioriza la fuerza para no perder músculo.`);
  const sube = t.dolor.filter(d => d.tendencia === 'sube');
  if (sube.length) { out.rehabExtra = true; out.notas.push(`El dolor de ${lista(sube.map(d => minus(d.nombre)))} ha subido estas dos semanas: más rehabilitación y menos carga en esa zona.`); }
  if (t.constancia < 50 && sesionesHechas(S).length >= 4) out.notas.push(`Estas 4 semanas has hecho ${es(t.sesionesPorSemana)} sesiones por semana de ${S.perfil.disponibilidad.dias} previstas: mejor un plan realista que uno que no se cumple.`);
  return out;
}

// ── Por qué de cada ejercicio: corto y con sus datos, nunca una frase genérica ──
const frase = t => { t = String(t || '').trim(); return t ? t[0].toUpperCase() + t.slice(1) + (/[.!?»)]$/.test(t) ? '' : '.') : ''; };
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
function porQueEjercicio(S, e, c) {
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
  const k = c.carga[e.m[0]];
  if (k && k.estado === 'casi') out.push(`Tu ${minus(MUSCULOS[e.m[0]])} aún se recupera: no apures al fallo`);
  return out.slice(0, 3).map(frase).join(' ');
}
function porQueRehab(S, e, z, dolorHoy) {
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
function resumenDia(S, c) {
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

// ── Reparto de la semana ──
function reparto(S, n) {
  const nivel = S.perfil.nivel || 1;
  const soloSalud = objetivosDe(S).every(o => o === 'salud' || o === 'natacion');
  if (soloSalud) return Array.from({ length: n }, (_, i) => (i % 2 ? 'fullA' : 'salud'));
  if (n <= 3) return (nivel >= 2 && n === 3 && S.perfil.lugares.includes('gym') && !tiene(S, 'perder') && (tiene(S, 'musculo') || tiene(S, 'fuerza'))) ? ['empuje', 'pierna', 'tiron'] : ['fullA', 'fullB', 'fullC'].slice(0, n);
  if (n === 4) return ['torso', 'pierna', 'torso', 'pierna'];
  if (n === 5) return ['torso', 'pierna', 'fullA', 'torso', 'pierna'];
  return ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna', 'fullB'].slice(0, n);
}
// Qué días de la semana, si no los ha marcado: repartidos con descanso.
const HORARIO = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
export const diasPorDefecto = S => { const d = S.perfil.disponibilidad; return d.diasSemana.length ? d.diasSemana.slice() : HORARIO[Math.max(1, Math.min(7, d.dias || 3))].slice(); };

// ¿Cuándo va a la piscina? Si nada, si tiene lesiones de carga o busca cardio, y hay 4 días o más.
function diasPiscina(S, n, lugares) {
  if (!lugares.includes('piscina')) return 0;
  const carga = S.perfil.lesiones.some(l => l.activa && ZONAS_CARGA.includes(l.zona));
  if (tiene(S, 'natacion')) return n >= 4 ? 2 : 1;
  if (lugares.length === 1) return n;
  if (n >= 4 && (carga || tiene(S, 'perder') || tiene(S, 'resistencia') || tiene(S, 'salud'))) return 1;
  return 0;
}

// semana: { dias [1..7], minutos, lugares }
export function planReglas(S, semana, { hechas = [] } = {}) {
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  const dias = semana.dias.slice().sort((a, b) => a - b);
  const seco = lugares.find(l => l !== 'piscina') || lugares[0];
  const nPisc = Math.min(diasPiscina(S, dias.length, lugares), dias.length);
  const tipos = reparto(S, dias.length - (seco === 'piscina' ? 0 : nPisc));
  const t = ajustesPorTendencia(S);
  const usados = {};
  const out = [];
  let iSeco = 0;
  dias.forEach((d, i) => {
    // La piscina va al final de la semana (o detrás de un día de pierna), con su propia plantilla.
    const pisc = seco !== 'piscina' && i >= dias.length - nPisc;
    const lugar = pisc ? 'piscina' : seco;
    const tipo = pisc || lugar === 'piscina' ? 'piscina' : tipos[iSeco++ % tipos.length];
    const dia = montarDia(S, { lugar, minutos: semana.minutos, tipo, k: i, usados, futuro: true, extraCardio: t.cardioExtra, rehabExtra: t.rehabExtra });
    out.push({ diaSemana: d, ...dia, nombre: dia.nombre });
  });
  // Volumen semanal por músculo grande (series directas + la mitad de las indirectas).
  const vol = {};
  out.forEach(d => d.ejercicios.filter(x => x.rol === 'principal').forEach(x => { const e = ex(x.id); vol[e.m[0]] = (vol[e.m[0]] || 0) + x.series; (e.s || []).forEach(m => { vol[m] = (vol[m] || 0) + x.series / 2; }); }));
  const objPrin = objetivosDe(S).find(o => VOLUMEN[o]) || 'salud';
  const [lo, hi] = VOLUMEN[objPrin];
  // Si un músculo grande se queda corto, una serie más donde aparece (hasta 5).
  GRANDES.forEach(m => {
    let falta = Math.ceil(lo - (vol[m] || 0));
    out.forEach(d => d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id).m[0] === m).forEach(x => { if (falta > 0 && x.series < 5) { x.series++; falta--; vol[m] = (vol[m] || 0) + 1; } }));
  });
  const hechasTxt = hechas.length ? ` Ya llevas ${hechas.length} sesión${hechas.length > 1 ? 'es' : ''} esta semana y lo que queda lo tiene en cuenta.` : '';
  const zonas = S.perfil.lesiones.filter(l => l.activa).map(l => (ZONAS[l.zona] || {}).corta).filter(Boolean);
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'reglas',
    resumen: `${dias.length} días: ${lista(out.map(d => `${DIAS[d.diaSemana].toLowerCase()} (${d.nombre})`))}.${hechasTxt} Cada día se ajusta a tu check-in.`,
    criterios: [
      `Reparto para ${dias.length} días y tus objetivos (${lista(objetivosDe(S).map(o => minus(OBJETIVOS[o].nombre)))}), con 48-72 h entre sesiones que repiten músculo grande.`,
      out.some(d => d.lugar !== 'piscina') && `Volumen semanal (series): ${GRANDES.map(m => `${minus(MUSCULOS[m])} ${Math.round(vol[m] || 0)}`).join(', ')}. Orientativo para tu objetivo: ${lo}-${hi}.`,
      zonas.length ? `Lesiones (${lista(zonas.map(minus))}): fuera lo que las carga y rehabilitación en cada sesión.` : '',
      (() => { const np = out.filter(d => d.lugar === 'piscina').length; return np ? `Piscina ${np} día${np > 1 ? 's' : ''}: ${tiene(S, 'natacion') ? 'técnica y resistencia en el agua' : 'cardio y trabajo sin impacto'}.` : ''; })(),
      ...t.notas,
    ].filter(Boolean).join(' '),
    progresion: 'Doble progresión: cuando llegues al tope de repeticiones en todas las series, la app te sube el peso mínimo. Si un ejercicio se estanca 3 sesiones, se cambia por una variante. Cada 5-6 semanas, una semana de descarga con la mitad de series.',
    dias: out.map(d => ({ diaSemana: d.diaSemana, nombre: d.nombre, foco: d.foco, lugar: d.lugar, minutos: d.minutos, tipo: d.tipo, explicacion: d.explicacion, calentamiento: d.calentamiento, ejercicios: d.ejercicios, vuelta: d.vuelta })),
    hechos: {},
  };
}

// ── Estado de la semana ──
export const planDeLaSemana = S => (S.plan && S.plan.semana === semanaISO() ? S.plan : null);
function lunesISO() { const h = new Date(); h.setDate(h.getDate() - diaSemana(h) + 1); return hoyISO(h); }
// Estado de cada día del plan: 'hecho' | 'hoy' | 'pendiente' | 'saltado'.
export function estadoDias(S) {
  const p = planDeLaSemana(S); if (!p) return [];
  const hoy = diaSemana(), lunes = lunesISO();
  const hechasSemana = sesionesHechas(S).filter(s => s.fecha >= lunes);
  const usadas = new Set();
  return p.dias.map(d => {
    const id = (p.hechos || {})[d.diaSemana];
    let hecha = id && S.sesiones[id] && S.sesiones[id].estado === 'hecha' ? S.sesiones[id] : null;
    if (!hecha) { // sesión hecha ese mismo día aunque no saliera del plan
      const f = new Date(lunes); f.setDate(f.getDate() + d.diaSemana - 1);
      hecha = hechasSemana.find(s => s.fecha === hoyISO(f) && !usadas.has(s.id)) || null;
    }
    if (hecha) usadas.add(hecha.id);
    return { ...d, estado: hecha ? 'hecho' : d.diaSemana === hoy ? 'hoy' : d.diaSemana < hoy ? 'saltado' : 'pendiente', sesion: hecha ? hecha.id : null };
  });
}
// El día que toca hoy: el de hoy si lo hay; si no, nada (se puede adelantar el siguiente).
export function planDeHoy(S) {
  const d = estadoDias(S).find(x => x.estado === 'hoy');
  return d || null;
}
export const siguientePendiente = S => estadoDias(S).find(x => x.estado === 'pendiente') || estadoDias(S).find(x => x.estado === 'saltado') || null;

// Plan automático sin IA si la semana empieza sin plan y el perfil está completo (no cuesta nada).
export function asegurarPlan() {
  const S = estado();
  if (planDeLaSemana(S) || !S.perfil.objetivos.length) return false;
  const plan = planReglas(S, { dias: diasPorDefecto(S), minutos: S.perfil.disponibilidad.minutos, lugares: S.perfil.lugares });
  plan.automatico = true;
  cambiar(S2 => { S2.plan = plan; }, 'plan');
  return true;
}

// ── Reorganizar lo que queda de semana (día perdido, menos días, «hoy no puedo») ──
// libres: días que aún puede entrenar (>= hoy). Mueve los pendientes en orden; si no caben, los rehace.
export function reorganizar(libres, { quitarHoy = false } = {}) {
  const S = estado(), p = planDeLaSemana(S); if (!p) return null;
  const hoy = diaSemana();
  const est = estadoDias(S);
  const hechos = est.filter(d => d.estado === 'hecho');
  const pendientes = est.filter(d => d.estado !== 'hecho');
  libres = libres.filter(d => d >= hoy && !hechos.some(h => h.diaSemana === d) && !(quitarHoy && d === hoy)).sort((a, b) => a - b);
  let nuevos, nota;
  if (pendientes.length <= libres.length) {
    nuevos = pendientes.map((d, i) => ({ ...d, diaSemana: libres[i] }));
    const mov = pendientes.map((d, i) => [d, libres[i]]).filter(([d, n]) => d.diaSemana !== n);
    nota = mov.length ? `Muevo ${lista(mov.map(([d, n]) => `${minus(DIAS[d.diaSemana])} (${minus(d.nombre)}) al ${minus(DIAS[n])}`))}.` : 'Todo sigue en su día.';
  } else {
    // No caben: con los días que quedan, cuerpo completo priorizando lo que aún no se ha trabajado esta semana.
    const trabajado = new Set(hechos.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id).m[0])));
    const faltan = GRANDES.filter(m => !trabajado.has(m));
    const huecos = [...faltan, ...GRANDES.filter(m => trabajado.has(m)), 'core'];
    const usados = {};
    nuevos = libres.map((d, i) => {
      const lugar = pendientes[i] ? pendientes[i].lugar : (S.perfil.lugares.find(l => l !== 'piscina') || S.perfil.lugares[0]);
      const dia = montarDia(S, { lugar, minutos: (pendientes[0] && pendientes[0].minutos) || S.perfil.disponibilidad.minutos, tipo: lugar === 'piscina' ? 'piscina' : 'fullA', huecos: lugar === 'piscina' ? null : huecos, k: i + 3, usados, futuro: true });
      return { diaSemana: d, nombre: libres.length === 1 ? 'Cuerpo completo (resumen de la semana)' : dia.nombre, foco: dia.foco, lugar, minutos: dia.minutos, tipo: 'fullA', explicacion: [`Rehecho al reorganizar la semana: prioriza ${lista(faltan.map(m => minus(MUSCULOS[m])))}, que aún no has trabajado.`, ...dia.explicacion], calentamiento: dia.calentamiento, ejercicios: dia.ejercicios, vuelta: dia.vuelta };
    });
    nota = `Quedaban ${pendientes.length} días y puedes ${libres.length}: lo junto en ${libres.length === 1 ? 'una sesión de cuerpo completo' : 'sesiones de cuerpo completo'} priorizando ${lista(faltan.map(m => minus(MUSCULOS[m]))) || 'lo más importante'}.`;
  }
  cambiar(S2 => {
    const pl = S2.plan;
    pl.dias = [...hechos.map(d => p.dias.find(x => x.diaSemana === d.diaSemana) || d), ...nuevos.map(({ estado: _e, sesion: _s, ...d }) => d)].sort((a, b) => a.diaSemana - b.diaSemana);
    pl.cambios = [...(pl.cambios || []), { fecha: new Date().toISOString(), texto: nota }];
  }, 'plan');
  return nota;
}

// ── Check-in: lo que cambia del día planificado con cómo estás hoy ──
// ci: { lugar, minutos, energia 1-5, dolorHoy {zona:n}, peticion }
// Devuelve { datos (para crearSesion), cambios [texto] }.
export function ajustarAlCheckin(S, dia, ci) {
  const cambios = [];
  const energia = +ci.energia || 3;
  const dolorHoy = ci.dolorHoy || {};
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const maxDolor = Math.max(0, ...Object.values(dolorHoy).map(Number));
  const lesionDolor = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, +l.dolor]));
  const pet = minus(ci.peticion);
  let base = dia ? JSON.parse(JSON.stringify(dia)) : null;
  const tipoDe = d => d && d.tipo || 'fullA';

  // Dolor fuerte: sesión suave de movilidad y rehabilitación.
  if (maxDolor >= 7) {
    const z = Object.entries(dolorHoy).find(([, v]) => +v >= 7)[0];
    base = montarDia(S, { lugar: ci.lugar, minutos: Math.min(ci.minutos, 40), tipo: ci.lugar === 'piscina' ? 'piscina' : 'salud', dolorHoy, rehabExtra: true });
    base.nombre = 'Sesión suave'; base.ejercicios = base.ejercicios.filter(x => x.rol !== 'cardio');
    cambios.push(`Te duele ${minus((ZONAS[z] || {}).corta || z)} a ${dolorHoy[z]}/10: hoy sesión suave de movilidad y rehabilitación, sin cargar. Si sigue así varios días, consúltalo con tu fisio.`);
  } else {
    // Petición concreta que las reglas entienden.
    let tipo = tipoDe(base);
    if (/superior|torso|brazo|pecho|espalda/.test(pet) && !/pierna|inferior/.test(pet)) { tipo = 'torso'; cambios.push('Pides tren superior: hoy torso.'); }
    else if (/inferior|pierna|gl[uú]teo/.test(pet)) { tipo = 'pierna'; cambios.push('Pides tren inferior: hoy pierna y glúteo.'); }
    if (!base || ci.lugar !== base.lugar || tipo !== tipoDe(base)) {
      if (base && ci.lugar !== base.lugar) cambios.push(`Hoy entrenas en ${minus(LUGARES[ci.lugar])} en vez de ${minus(LUGARES[base.lugar])}: misma idea, con lo que hay allí.`);
      const huecos = base && base.ejercicios && tipo === tipoDe(base) && ci.lugar !== 'piscina' ? base.ejercicios.filter(x => x.rol === 'principal' && ex(x.id)).map(x => ex(x.id).m[0]) : null;
      base = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: ci.lugar === 'piscina' ? 'piscina' : tipo, huecos: huecos && huecos.length ? huecos : null, dolorHoy, k: diaSemana() });
    }
  }
  if (!base.calentamiento || !base.calentamiento.length || !base.vuelta || !base.vuelta.length) {
    const r = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: tipoDe(base), dolorHoy });
    if (!base.calentamiento || !base.calentamiento.length) base.calentamiento = r.calentamiento;
    if (!base.vuelta || !base.vuelta.length) base.vuelta = r.vuelta;
  }
  let ej = base.ejercicios.map(x => ({ ...x }));

  // Dolor de hoy: fuera (o cambiado) lo que hoy carga la zona.
  Object.entries(dolorHoy).forEach(([z, v]) => {
    if (+v >= 1 && lesionDolor[z] == null) cambios.push(`Dolor nuevo en ${minus((ZONAS[z] || {}).corta || z)} (${v}/10): lo tengo en cuenta en cada ejercicio.`);
    else if (lesionDolor[z] != null && +v >= lesionDolor[z] + 2) cambios.push(`Tu ${minus(ZONAS[z].corta)} está peor que de costumbre (${v}/10 frente a ${lesionDolor[z]}/10).`);
  });
  const an = analizarEjercicios(S);
  ej = ej.map(x => {
    const e = ex(x.id); if (!e || x.rol === 'rehab') return x;
    const peligro = riesgo(e, niveles) === 'evitar';
    const molesta = an[x.id] && (an[x.id].estado === 'molesta' || an[x.id].gusto === 'rechazo');
    if (!peligro && !molesta) return x;
    const alt = alternativas(e, ci.lugar, S.perfil, { excluir: ej.map(y => y.id), dolorHoy }).filter(a => !an[a.id] || an[a.id].estado !== 'molesta')[0];
    const por = peligro ? `carga la zona que hoy te duele` : an[x.id].gusto === 'rechazo' ? 'no lo quieres' : `te ha molestado («${(an[x.id].comentarios.slice(-1)[0] || {}).texto || 'dolor después'}»)`;
    if (!alt) { cambios.push(`Quito ${e.n.toLowerCase()}: ${por}.`); return null; }
    cambios.push(`Cambio ${e.n.toLowerCase()} por ${alt.n.toLowerCase()}: ${por}.`);
    return { ...x, id: alt.id, nota: frase(`Hoy en lugar de ${e.n.toLowerCase()}: ${por}`) + ' Mismo trabajo, sin cargar esa zona.' };
  }).filter(Boolean);
  // Comentarios de «ocupado»: aviso con alternativa.
  ej.forEach(x => { const a = an[x.id]; if (a && a.problemas.includes('ocupado')) { const alt = alternativas(ex(x.id), ci.lugar, S.perfil, { excluir: ej.map(y => y.id), dolorHoy })[0]; if (alt) x.nota = [x.nota, `Si está ocupado otra vez, haz ${alt.n.toLowerCase()}.`].filter(Boolean).join(' '); } });

  // Recuperación: músculos aún cargados (por ejemplo si entrenó ayer fuera del plan).
  const carga = cargaMuscular(S);
  const cargados = [...new Set(ej.filter(x => x.rol === 'principal' && carga[ex(x.id).m[0]] && carga[ex(x.id).m[0]].estado === 'cargado').map(x => ex(x.id).m[0]))];
  if (cargados.length) {
    ej.forEach(x => { if (x.rol === 'principal' && cargados.includes(ex(x.id).m[0]) && x.series > 2) x.series--; });
    cambios.push(`${lista(cargados.map(m => MUSCULOS[m]))} aún se recupera${cargados.length > 1 ? 'n' : ''}: una serie menos y sin subir peso.`);
  }

  // Energía.
  if (energia <= 2) {
    const antes = ej.filter(x => x.rol === 'principal').length;
    ej.forEach(x => { if (x.rol === 'principal' && x.series > 2) x.series--; if (x.rol === 'cardio') { x.reps = energia === 1 ? '10 min' : '12-15 min'; x.nota = `${x.reps} suaves: hoy tienes poca energía (${energia}/5) y mejor recuperar. Ritmo en el que puedas hablar.`; } });
    const prin = ej.filter(x => x.rol === 'principal');
    if (prin.length > 4) { const quitar = prin.slice(4).map(x => x.id); ej = ej.filter(x => !quitar.includes(x.id)); }
    cambios.push(`Energía ${energia === 1 ? 'muy baja' : 'baja'}: una serie menos${antes > 4 ? `, ${antes - 4} ejercicio${antes - 4 > 1 ? 's' : ''} menos` : ''}${ej.some(x => x.rol === 'cardio') ? ' y cardio más corto' : ''}, y sin subir peso.`);
  } else if (energia === 5) {
    const p = ej.find(x => x.rol === 'principal' && ex(x.id).t === 'reps');
    if (p && p.series < 5) { p.series++; cambios.push(`Energía a tope: una serie más de ${ex(p.id).n.toLowerCase()}.`); }
  }

  // Tiempo disponible.
  let t = tiempoSesion({ ejercicios: ej });
  if (t > ci.minutos + 5) {
    const quitados = [];
    while (t > ci.minutos + 5 && ej.filter(x => x.rol === 'principal').length > 3) {
      const idx = ej.map(x => x.rol).lastIndexOf('principal');
      quitados.push(ex(ej[idx].id).n.toLowerCase()); ej.splice(idx, 1); t = tiempoSesion({ ejercicios: ej });
    }
    const c = ej.find(x => x.rol === 'cardio');
    if (t > ci.minutos + 5 && c) { c.reps = `${Math.max(8, minDe(c.reps) - (t - ci.minutos))} min`; c.nota = String(c.nota || '').replace(/^\d+ min( \([^)]*\))?/, `${c.reps} (lo que cabe en tus ${ci.minutos} min de hoy)`); t = tiempoSesion({ ejercicios: ej }); }
    if (quitados.length) cambios.push(`Tienes ${ci.minutos} minutos: quito ${lista(quitados)}.`);
  } else if (t < ci.minutos - 15 && maxDolor < 7) {
    const extra = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: tipoDe(base), dolorHoy, k: diaSemana() + 1 }).ejercicios
      .filter(x => x.rol === 'principal' && !ej.some(y => y.id === x.id));
    const añadidos = [];
    while (extra.length && t < ci.minutos - 10) { const x = extra.shift(); const pos = ej.map(y => y.rol).lastIndexOf('principal') + 1; ej.splice(pos, 0, x); añadidos.push(ex(x.id).n.toLowerCase()); t = tiempoSesion({ ejercicios: ej }); }
    if (añadidos.length) cambios.push(`Tienes ${ci.minutos} minutos: añado ${lista(añadidos)}.`);
  }

  // Progresión de cada ejercicio con lo que apuntaste (doble progresión con frenos).
  const subidas = [], bajadas = [];
  ej = ej.map(x => {
    if (x.rol === 'cardio') return x;
    const sg = sugerir(S, x.id, { series: x.series, reps: x.reps }, { energia, niveles, carga });
    if (sg.tipo === 'sube') subidas.push(`${ex(x.id).n.toLowerCase()}${sg.kg != null ? ' a ' + es(sg.kg) + ' kg' : ' (' + sg.reps + ')'}`);
    if (sg.tipo === 'baja') bajadas.push(ex(x.id).n.toLowerCase());
    return { ...x, series: sg.series, reps: sg.reps, kg: sg.kg != null ? sg.kg : x.kg, motivo: sg.motivo };
  });
  if (subidas.length) cambios.push(`Subes en ${lista(subidas)}: llegaste al tope la última vez.`);
  if (bajadas.length) cambios.push(`Bajas un poco en ${lista(bajadas)} para recuperar el ritmo.`);

  const datos = {
    ...base, fuente: dia && dia === base ? 'plan' : base.fuente === 'ia' ? 'ia' : dia ? 'plan' : 'reglas',
    lugar: ci.lugar, minutos: ci.minutos, ejercicios: ej,
    explicacion: [...(base.explicacion || []).slice(0, 1), ...(cambios.length ? cambios.map(c => 'Por tu check-in: ' + c) : ['Tu check-in no cambia nada: haces el día tal como estaba planificado.']), ...(base.explicacion || []).slice(1)].slice(0, 8),
    checkin: { energia, dolor: dolorHoy, tiempo: ci.minutos },
  };
  return { datos, cambios };
}

// ── Cuándo merece la pena pagar una llamada a la IA para el día ──
// modo del perfil: 'auto' (por defecto) · 'siempre' · 'ahorro'.
export function motivoIA(S, ci, dia) {
  const modo = S.perfil.usoIA || 'auto';
  if (!enLinea()) return { usar: false, motivo: 'Sin conexión: lo ajusta la app con sus reglas.' };
  if (ci.forzarIA) return { usar: true, motivo: 'Se lo pides al entrenador IA.' };
  if (modo === 'ahorro') return { usar: false, motivo: 'Modo ahorro: la IA solo hace el plan semanal.' };
  if (modo === 'siempre') return { usar: true, motivo: 'Modo «siempre IA».' };
  const lesion = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, +l.dolor]));
  const r = [];
  if ((ci.peticion || '').trim().length > 3) r.push('le pides algo concreto');
  if (Object.entries(ci.dolorHoy || {}).some(([z, v]) => +v >= 1 && lesion[z] == null)) r.push('tienes un dolor nuevo');
  if (Object.entries(ci.dolorHoy || {}).some(([z, v]) => lesion[z] != null && +v >= Math.max(4, lesion[z] + 2))) r.push('te duele más de lo normal');
  if (dia && ci.lugar !== dia.lugar) r.push('cambias de lugar');
  if (!dia) r.push('hoy no hay día planificado');
  const p = planDeLaSemana(S);
  const desde = p ? p.creado : '';
  const nuevos = sesionesHechas(S).filter(s => (s.terminada || '') > desde).some(s => (s.cierre && s.cierre.comentario) || (s.ejercicios || []).some(x => x.comentario && leerComentario(x.comentario).length));
  if (nuevos) r.push('hay comentarios tuyos que leer');
  return r.length ? { usar: true, motivo: `El entrenador IA la revisa porque ${lista(r)}.` } : { usar: false, motivo: 'Ajustada por la app con tu check-in (sin gastar IA).' };
}

// ── Petición a la IA ──
function peticionBase(S, lugares, dolorHoy) {
  const catalogo = catalogoParaIA(S, lugares, dolorHoy);
  const ids = catalogo.map(e => e.id);
  return {
    perfil: perfilParaIA(S), lesiones: lesionesParaIA(S, dolorHoy), catalogo,
    historial: historialParaIA(S, ids, { niveles: nivelesZona(S.perfil, dolorHoy) }), analisis: analisisParaIA(S),
    hoy: hoyISO(), diaSemana: diaSemana(),
  };
}

// Barandillas sobre lo que propone la IA (sesión o día de plan): seguridad, kilos y piezas obligatorias.
function completarIA(S, d, { lugar, minutos, dolorHoy = {}, k = 0 }) {
  const r = montarDia(S, { lugar, minutos, tipo: lugar === 'piscina' ? 'piscina' : 'fullA', dolorHoy, k, futuro: !!d.futuro });
  const añadidos = [];
  if (!d.calentamiento || d.calentamiento.length < 2) { d.calentamiento = r.calentamiento; añadidos.push('calentamiento'); }
  if (!d.vuelta || d.vuelta.length < 2) { d.vuelta = r.vuelta; añadidos.push('estiramientos'); }
  const zonas = Object.keys(nivelesZona(S.perfil, dolorHoy)).filter(z => ZONAS[z]);
  zonas.forEach(z => {
    const tieneRehab = d.ejercicios.some(x => x.rol === 'rehab' && (ZONAS[z].rehab || []).includes(x.id)) || d.ejercicios.some(x => x.rol === 'rehab');
    if (!tieneRehab) { const x = r.ejercicios.find(y => y.rol === 'rehab'); if (x) { d.ejercicios.unshift(x); añadidos.push('rehabilitación de ' + minus(ZONAS[z].corta)); } }
  });
  if ((tiene(S, 'perder') || tiene(S, 'resistencia')) && lugar !== 'piscina' && !d.ejercicios.some(x => x.rol === 'cardio')) {
    const c = r.ejercicios.find(y => y.rol === 'cardio'); if (c) { d.ejercicios.push(c); añadidos.push('cardio'); }
  }
  d.ejercicios.forEach(x => {
    if (!(x.kg != null && +x.kg > 0)) { x.kg = null; return; }
    const conHistorial = sesionesHechas(S).some(s2 => (s2.ejercicios || []).some(y => y.id === x.id && (y.sets || []).some(z => z.hecha && +z.kg > 0)));
    // Sin historial no hay referencia: un peso absurdo se descarta y la persona elige el de partida.
    x.kg = conHistorial ? acotarKg(S, x.id, +x.kg) : +x.kg <= 120 ? +x.kg : null;
  });
  // Cada ejercicio con su porqué concreto: si la IA deja una nota vacía o genérica, la escribe la app con sus datos.
  const an = analizarEjercicios(S), carga = d.futuro ? {} : cargaMuscular(S), niveles = nivelesZona(S.perfil, dolorHoy);
  d.ejercicios.forEach((x, i) => {
    const e = ex(x.id); if (!e || !notaGenerica(x.nota)) return;
    if (x.rol === 'rehab') { const z = zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0]; if (z) x.nota = porQueRehab(S, e, z, dolorHoy); }
    else if (x.rol === 'principal') x.nota = porQueEjercicio(S, e, { i, d: x, an, carga, niveles, dolorHoy });
  });
  if (!(d.explicacion || []).length) {
    const rehabZ = d.ejercicios.filter(x => x.rol === 'rehab').map(x => ({ zona: zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0] })).filter(x => x.zona);
    d.explicacion = [resumenDia(S, { plantilla: { nombre: d.nombre || 'Sesión' }, elegidos: d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id)).filter(Boolean), rehab: rehabZ, cardio: d.ejercicios.find(x => x.rol === 'cardio'), an: {} })];
  }
  if (añadidos.length) d.explicacion = [...(d.explicacion || []), `La app añadió ${lista(añadidos)}, que siempre van.`];
  return d;
}
const notaGenerica = t => !t || String(t).trim().length < 30 || /^(con cuidado|cuidado|técnica limpia|cambiado|sin dolor|controlad)/i.test(String(t).trim()) && !/\d/.test(t);

// ── Sesión de hoy ──
// Devuelve { sesion, aviso }. Sin IA (o si falla) usa el día del plan ajustado al check-in o una sesión de reglas.
export async function crearSesionHoy(ci) {
  const S = estado();
  const dia = ci.diaPlan != null ? (planDeLaSemana(S) || { dias: [] }).dias.find(d => d.diaSemana === ci.diaPlan) || null : planDeHoy(S);
  const local = ajustarAlCheckin(S, dia, ci);
  const decide = motivoIA(S, ci, dia);
  let datos = local.datos, aviso = '';
  if (decide.usar) {
    try {
      const r = await llamar('entrenador', {
        modo: 'sesion', ...peticionBase(S, [ci.lugar], ci.dolorHoy),
        checkin: { lugar: LUGARES[ci.lugar], minutos: ci.minutos, energia: ci.energia, dolorHoy: ci.dolorHoy, peticion: ci.peticion || '' },
        planDeHoy: dia ? { nombre: dia.nombre, foco: dia.foco, lugar: LUGARES[dia.lugar], ejercicios: dia.ejercicios.map(x => ({ id: x.id, rol: x.rol, series: x.series, reps: x.reps })) } : null,
        ajusteReglas: local.cambios,
      });
      const s = r.sesion;
      const d = completarIA(S, { ...s, vuelta: s.vueltaCalma, ejercicios: (s.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(ci.lugar)) }, { lugar: ci.lugar, minutos: ci.minutos, dolorHoy: ci.dolorHoy });
      if (d.ejercicios.filter(x => x.rol !== 'rehab').length) {
        datos = { ...d, explicacion: [...(d.explicacion || []).slice(0, 1), ...(s.cambios || []).map(c => 'Por tu check-in: ' + c), ...(d.explicacion || []).slice(1)].slice(0, 8), fuente: 'ia', lugar: ci.lugar, minutos: ci.minutos, checkin: local.datos.checkin };
      } else aviso = 'La IA no propuso ejercicios válidos: sesión ajustada por la app.';
    } catch (e) {
      aviso = `Sesión ajustada por la app (${e.message}).`;
    }
  }
  const sesion = crearSesion(datos);
  sesion.ejercicios.forEach(x => { if (x.kg != null) { x.kg = acotarKg(S, x.id, x.kg); x.sets.forEach(z => { z.kg = x.kg; }); } });
  cambiar(S2 => {
    S2.sesiones[sesion.id] = sesion;
    if (dia && S2.plan) { S2.plan.hechos = S2.plan.hechos || {}; S2.plan.hechos[dia.diaSemana] = sesion.id; }
  }, 'sesion');
  return { sesion, aviso, motivo: decide.usar && !aviso ? decide.motivo : decide.usar ? '' : decide.motivo };
}

// ── Plan de la semana ──
// semana: { dias: [1..7], minutos, lugares }, conIA
export async function crearPlanSemana(semana, { conIA = true } = {}) {
  const S = estado();
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  const hoy = diaSemana();
  const est = estadoDias(S);
  const hechas = est.filter(d => d.estado === 'hecho');
  // A mitad de semana solo se planifican los días que quedan; lo hecho se conserva.
  const dias = semana.dias.filter(d => d >= hoy && !hechas.some(h => h.diaSemana === d));
  const conservar = hechas.map(d => planDeLaSemana(S).dias.find(x => x.diaSemana === d.diaSemana));
  const unir = plan => { plan.dias = [...conservar, ...plan.dias].sort((a, b) => a.diaSemana - b.diaSemana); plan.hechos = (planDeLaSemana(S) || {}).hechos || {}; return plan; };
  if (!dias.length) return { plan: planDeLaSemana(S), aviso: 'No quedan días por planificar esta semana.' };
  if (conIA && enLinea()) {
    try {
      const r = await llamar('entrenador', {
        modo: 'plan', ...peticionBase(S, lugares, {}),
        semana: {
          dias, minutos: semana.minutos, lugares: lugares.map(l => ({ id: l, nombre: LUGARES[l] })),
          hechas: hechas.map(d => ({ dia: DIAS[d.diaSemana], nombre: d.nombre, musculos: [...new Set(d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id) && ex(x.id).m[0]).filter(Boolean))] })),
        },
      }, { espera: 240000 });
      const plan = normalizarPlan(S, r.plan, lugares, dias, semana.minutos);
      if (!plan.dias.length) throw new Error('plan vacío');
      cambiar(S2 => { S2.plan = unir(plan); }, 'plan');
      return { plan, aviso: '' };
    } catch (e) {
      const plan = unir(planReglas(S, { ...semana, dias, lugares }, { hechas }));
      cambiar(S2 => { S2.plan = plan; }, 'plan');
      return { plan, aviso: `Plan hecho por la app (${e.message}).` };
    }
  }
  const plan = unir(planReglas(S, { ...semana, dias, lugares }, { hechas }));
  cambiar(S2 => { S2.plan = plan; }, 'plan');
  return { plan, aviso: '' };
}

function normalizarPlan(S, p, lugares, dias, minutos) {
  const vistos = new Set();
  const out = (p.dias || []).map((d, i) => {
    const lugar = lugares.includes(d.lugar) ? d.lugar : lugares[0];
    const ds = Math.max(1, Math.min(7, +d.diaSemana || 1));
    if (!dias.includes(ds) || vistos.has(ds)) return null;
    vistos.add(ds);
    const dd = completarIA(S, {
      futuro: true, nombre: String(d.nombre || '').slice(0, 60), foco: String(d.foco || '').slice(0, 80),
      explicacion: (Array.isArray(d.explicacion) ? d.explicacion : [d.explicacion]).filter(Boolean).map(String),
      calentamiento: d.calentamiento || [], vuelta: d.vueltaCalma || d.vuelta || [],
      ejercicios: (d.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(lugar)),
    }, { lugar, minutos: +d.minutos || minutos, k: i });
    delete dd.futuro;
    return { diaSemana: ds, lugar, minutos: +d.minutos || minutos, tipo: null, ...dd };
  }).filter(Boolean);
  // Días que la IA se dejó: los completa la app.
  const faltan = dias.filter(d => !vistos.has(d));
  if (faltan.length) planReglas(S, { dias: faltan, minutos, lugares }).dias.forEach(d => out.push({ ...d, explicacion: [...d.explicacion.slice(0, 1), 'Día completado por la app.', ...d.explicacion.slice(1)] }));
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'ia',
    resumen: String(p.resumen || ''), criterios: String(p.criterios || ''), progresion: String(p.progresion || ''),
    dias: out.sort((a, b) => a.diaSemana - b.diaSemana), hechos: {},
  };
}

// Vista previa del check-in (para enseñar qué cambia antes de crear la sesión).
export function previaCheckin(ci) {
  const S = estado();
  const dia = ci.diaPlan != null ? (planDeLaSemana(S) || { dias: [] }).dias.find(d => d.diaSemana === ci.diaPlan) || null : planDeHoy(S);
  const { datos, cambios } = ajustarAlCheckin(S, dia, ci);
  return { dia, datos, cambios, ia: motivoIA(S, ci, dia), minutos: tiempoSesion(datos) };
}
