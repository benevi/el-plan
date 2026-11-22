// Lo que el móvil manda al entrenador IA: perfil, lesiones, gustos, catálogo ya filtrado por seguridad,
// historial resumido, recuperación muscular y comentarios recientes. La IA decide; las reglas filtran antes
// (nada peligroso llega al catálogo) y corrigen después (kilos acotados, ver progresion.acotarKg).

import { ex, disponibles, zonasRiesgo, ZONAS, rehabPorFase, techoDolor, bandasZonas, nivelesDe } from './catalogo.js';
import { registros, resumen, sugerir, cargaMuscular, sesionesHechas, hace, dolorSubio, subidasDolor, estaEstancado, medidaSesion, tendenciaDolor, semanaDescarga } from './progresion.js';
import { es } from '../nucleo/ui.js';
import { semanaISO } from '../nucleo/modelo.js';
import { OBJETIVOS, NIVELES, MUSCULOS, LUGARES } from '../datos/constantes.js';

const DIA = 864e5;

// Textos libres que viajan a la IA: recortados aquí (además del tope del servidor) para no mandar más de lo que
// hace falta. Son datos de la persona, nunca instrucciones (C-PRIN-5): el prompt lo dice y el validador manda.
export const LARGO_IA = { notas: 600, nota: 400, comentario: 300, peticion: 500 };
export function recortarIA(t, max) {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  let r = s.slice(0, max - 1);
  const u = r.charCodeAt(r.length - 1);
  if (u >= 0xd800 && u <= 0xdbff) r = r.slice(0, -1); // no dejar medio emoji
  return r + '…';
}

// Perfil para la IA, sin el nombre de la persona ni datos que no cambian lo que se prescribe (altura, peso: el
// peso va en las tendencias). Lugares y material con sus ids, los mismos que la clave «l» del catálogo. El
// primer objetivo es el que manda (C-OBJ-1). Los datos de salud van aparte, solo como etiquetas (C-SALUD-0).
export function perfilParaIA(S) {
  const p = S.perfil;
  const edad = p.datos.nacimiento ? Math.floor((Date.now() - new Date(p.datos.nacimiento)) / (365.25 * DIA)) : null;
  return {
    sexo: p.datos.sexo || null, edad: Number.isFinite(edad) ? edad : null,
    objetivos: p.objetivos.map(o => OBJETIVOS[o] ? OBJETIVOS[o].nombre : o),
    nivel: NIVELES[p.nivel] || 'Principiante',
    diasPorSemana: p.disponibilidad.dias, minutosPorSesion: p.disponibilidad.minutos,
    diasPreferidos: p.disponibilidad.diasSemana,
    lugares: p.lugares.filter(l => LUGARES[l]), materialEnCasa: p.materialCasa,
    entrenaAcompañado: !!p.acompañado,
    sabeNadar2x25: !!p.nadar25,
    notas: recortarIA(p.notas, LARGO_IA.notas),
  };
}

// Zonas activas para la IA: cada lesión activa y cada zona con dolor hoy sin lesión registrada, con la banda,
// el techo de dolor y la fase de rehabilitación ya calculados por las reglas (C-DOLOR-1, C-DOLOR-6, C-LES-2,
// C-DOSIS-7), para que la IA no tenga que deducirlos. bandas: las de bandasHoy (areas/entrenador/dia.js);
// sin ellas, solo el dolor de ficha y el de hoy.
const faseDeBanda = b => (b.banda === 0 ? 3 : b.banda === 1 && !b.nueva ? 2 : 1);
// idsCatalogo: los ids del catálogo que se manda; la rehabilitación sugerida solo cita esos.
export function lesionesParaIA(S, dolorHoy = {}, bandas = null, idsCatalogo = null) {
  const activas = S.perfil.lesiones.filter(l => l.activa);
  const zonas = bandas ? Object.keys(bandas) : [...new Set(activas.map(l => l.zona))];
  return zonas.map(zona => {
    const z = ZONAS[zona] || {};
    const b = bandas ? bandas[zona] : null;
    const l = (b && b.lesion) || activas.find(x => x.zona === zona) || null;
    const nueva = b ? b.nueva : !l || l.tipo === 'puntual';
    const fase = b ? faseDeBanda(b) : null;
    const ids = fase ? (rehabPorFase(zona, l && l.detalle)[fase] || []) : (z.rehab || []);
    return {
      zona, nombre: z.corta || zona,
      banda: b ? 'B' + b.banda : undefined,
      dolorHoy: dolorHoy[zona] != null && dolorHoy[zona] !== '' ? +dolorHoy[zona] : undefined,
      dolorFicha: l ? +l.dolor : undefined,
      dolorPorRevisar: l && l.dolorRevisar ? true : undefined,
      sinLesionRegistrada: b && b.sinLesion ? true : undefined,
      lesionNueva: nueva || undefined,
      techo: ZONAS[zona] ? techoDolor(zona, { nueva, detalle: l && l.detalle }).techo : 3,
      faseRehab: fase || undefined,
      tipo: (l && l.tipo) || undefined, detalle: (l && l.detalle) || undefined, desde: (l && l.desde) || undefined,
      nota: l && l.nota ? recortarIA(l.nota, LARGO_IA.nota) : undefined,
      evitar: z.evitar,
      rehabilitacionSugerida: ids.filter(id => ex(id) && (!idsCatalogo || idsCatalogo.has(id))),
    };
  });
}

// Catálogo seguro de los lugares pedidos, en forma compacta (cada token cuesta):
// { id, m: [principales, ...secundarios marcados con «~»], l: ids de los lugares donde se puede hacer, niv, t,
//   tipo (compuesto · aislamiento · corporal · propia, C-DOSIS-1), prec?: ids de las zonas activas en las que
//   tiene riesgo (dosis «con precaución», C-DOSIS-4), gusto? }
// permitidoEn (opcional): l => (e => bool), la regla del validador para ese lugar (COD-1: una sola regla).
export function catalogoParaIA(S, lugares, dolorHoy = {}, { permitidoEn } = {}) {
  const bandas = bandasZonas(S.perfil, dolorHoy), niveles = nivelesDe(bandas);
  const vistos = new Map();
  lugares.forEach(l => disponibles(S.perfil, l, { dolorHoy, permitido: permitidoEn ? permitidoEn(l) : undefined }).forEach(e => {
    const x = vistos.get(e.id) || { id: e.id, m: [...e.m, ...(e.s || []).map(m => '~' + m)], l: [], niv: e.niv, t: e.t, tipo: e.tipo };
    x.l.push(l);
    const z = zonasRiesgo(e, niveles, bandas); if (z.length) x.prec = z.join(',');
    const g = S.perfil.gustos[e.id]; if (g) x.gusto = g === 'gusta' ? 'le gusta' : 'no le gusta';
    vistos.set(e.id, x);
  }));
  return [...vistos.values()];
}

export function historialParaIA(S, ids, ctx = {}) {
  const progreso = [];
  ids.forEach(id => {
    const regs = registros(S, id); if (!regs.length) return;
    const e = ex(id);
    const sug = sugerir(S, id, { series: e.d[0], reps: e.d[1] }, ctx);
    progreso.push({
      id, diasDesdeUltima: Math.floor((Date.now() - new Date(regs[regs.length - 1].fecha)) / DIA),
      ultimas: regs.slice(-3).reverse().map(r => ({ fecha: String(r.fecha).slice(0, 10), series: resumen(r), esfuerzo: r.esfuerzo ? r.esfuerzo + '/5' : undefined })),
      propuestaReglas: [sug.kg != null ? sug.kg + ' kg' : '', sug.series + ' × ' + sug.reps, sug.motivo].filter(Boolean).join(' · '),
    });
  });
  progreso.sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima);
  const hechas = sesionesHechas(S).reverse();
  const carga = cargaMuscular(S);
  return {
    recuperacion: Object.entries(carga).filter(([, k]) => k.estado !== 'fresco').map(([m, k]) => ({ musculo: MUSCULOS[m] || m, trabajado: hace(k.horas), estado: k.estado === 'cargado' ? 'sin recuperar' : 'casi recuperado', faltanHoras: k.faltan })),
    sesionesUltimos14dias: hechas.filter(s => Date.now() - new Date(s.terminada || s.fecha) < 14 * DIA).map(s => ({
      fecha: s.fecha, nombre: s.nombre, lugar: s.lugar, esfuerzo: s.cierre && s.cierre.esfuerzo ? s.cierre.esfuerzo + '/5' : undefined,
      comentario: s.cierre && s.cierre.comentario ? recortarIA(s.cierre.comentario, LARGO_IA.comentario) : undefined,
      comentariosEjercicios: (s.ejercicios || []).filter(x => x.comentario).map(x => `${ex(x.id) ? ex(x.id).n : x.id}: ${recortarIA(x.comentario, LARGO_IA.comentario)}`),
      // Parada con «Algo va mal» por una señal de alarma (C-ALAR-1, decisión D-A) y ejercicios parados por dolor (C-DOLOR-6).
      parada: s.parada === 'alarma' ? 'señal de alarma: se paró la sesión' : undefined,
      dolorDurante: (s.ejercicios || []).some(x => x.dolorDurante) ? (s.ejercicios || []).filter(x => x.dolorDurante).map(x => `${ex(x.id) ? ex(x.id).n : x.id}: ${x.dolorDurante.zona} ${+x.dolorDurante.dolor}/10 (empezó en ${+x.dolorDurante.antes}/10, tope ${+x.dolorDurante.techo}/10), parado`) : undefined,
    })),
    progreso: progreso.slice(0, 40),
    dolorReciente: dolorReciente(S),
  };
}

// Dolor apuntado en las 4 últimas semanas, los 10 registros más recientes y solo lo que sirve para decidir
// (sin ids de sesión ni otros campos).
export function dolorReciente(S, ahora = Date.now()) {
  return (S.dolor || []).filter(d => d && d.fecha && ahora - new Date(String(d.fecha).slice(0, 10) + 'T12:00') <= 28 * DIA)
    .slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(-10)
    .map(d => ({ fecha: String(d.fecha).slice(0, 10), zona: d.zona, dolor: +d.dolor, momento: d.momento || undefined }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis del entrenador: lo que se saca de lo apuntado y que cambia lo que se prescribe.
// Lo usan las reglas (sin IA) y se manda a la IA tal cual, así las dos decisiones parten de lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

// Comentarios en texto libre → problemas que el entrenador sabe resolver.
const PROBLEMAS = [
  ['molestia', /duel|dolor|dolid|dol[ií][óoa]|molest|pinch|tir[oó]n|tirant|me tira|cruj|lesi|se me carg|me carga/i],
  ['ocupado', /ocupad|no (hab[ií]a|hay|estaba)|rota|averiad|sin m[aá]quina/i],
  ['aburrido', /aburr|mon[oó]ton|siempre lo mismo|repetitiv/i],
  ['facil', /f[aá]cil|ligero|me sobr|muy poco|sin esfuerzo/i],
  ['dificil', /dif[ií]cil|no pude|no llegu|demasiad|muy pesad|imposible|no pod[ií]a/i],
  ['tecnica', /t[eé]cnica|no s[eé] (hacer|c[oó]mo)|no me sale|no lo entiendo|postura/i],
];
// C-ANA-2 · Negaciones que no son molestia: se borran del texto antes de buscar «molestia». Una negación a
// medias («no me duele mucho», «no duele tanto como ayer») sí es molestia y no se borra.
const A_MEDIAS = String.raw`(?!\s+(?:mucho|tanto|demasiado|igual|casi|del todo))`;
const NEGACIONES = [
  /\b(sin|ni|cero|nada de)\s+(ning[uú]n\s+|ninguna\s+|una?\s+)?(dolor(es)?|molestias?)\b/gi,
  /\bdolor(es)?\s*(:\s*)?(0|cero)(\s*\/\s*10)?\b(?![^.]*\b([1-9]|10)\b)/gi,
  new RegExp(String.raw`\b(ya\s+)?no\s+(me\s+|le\s+)?(ha\s+|han\s+|he\s+)?(duel\w*|dol\w*|molest\w*)\b` + A_MEDIAS + String.raw`(\s+nada)?`, 'gi'),
  /\bno\s+noto\s+nada\b/gi,
  /\bno\s+es\s+(un\s+)?dolor\b/gi,
];
// «Dolor N» con N de 1 a 10 en la misma frase (sin contar «/10») siempre es molestia.
const DOLOR_NUMERO = /\bdolor\b[^.]*?\b([1-9]|10)\b(?!\s*(series|rep|kg|min|seg|s\b|x\b|×))/i;
export function leerComentario(txt) {
  const t = String(txt || '');
  const limpio = NEGACIONES.reduce((s, re) => s.replace(re, ' '), t);
  const sinDenominador = t.replace(/\/\s*10\b/g, '');
  return PROBLEMAS.filter(([k, re]) => (k === 'molestia' ? re.test(limpio) || DOLOR_NUMERO.test(sinDenominador) : re.test(t))).map(([k]) => k);
}

// ── Semanas de calendario y constancia (C-ANA-7) ──
// Semanas de lunes a domingo calculadas con el calendario (no restando 7 × 24 h: el cambio de hora no salta
// ninguna). La primera semana de uso no cuenta como incumplida.
const lunesDe = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export function semanasCalendario(S, n, ahora = new Date()) {
  const porSemana = {};
  sesionesHechas(S).forEach(s => { const k = semanaISO(new Date(s.terminada || (s.fecha + 'T12:00'))); porSemana[k] = (porSemana[k] || 0) + 1; });
  const lunes = lunesDe(ahora), out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(lunes); d.setDate(d.getDate() - 7 * k);
    const sem = semanaISO(d);
    out.push({ sem, n: porSemana[sem] || 0, actual: k === 0 });
  }
  return out;
}
export const objetivoSemanal = S => Math.max(1, +(S.perfil.disponibilidad && S.perfil.disponibilidad.dias) || 3);
// % de cumplimiento de las `semanas` últimas semanas cerradas desde que empezó (null si no hay ninguna que contar).
export function cumplimiento(S, semanas = 4, ahora = new Date()) {
  const hechas = sesionesHechas(S);
  if (!hechas.length) return null;
  const obj = objetivoSemanal(S);
  const semPrimera = semanaISO(new Date(hechas[0].terminada || (hechas[0].fecha + 'T12:00')));
  const cuentan = semanasCalendario(S, semanas + 1, ahora).filter(s => !s.actual && (s.sem > semPrimera || (s.sem === semPrimera && s.n >= obj)));
  if (!cuentan.length) return null;
  return Math.round(cuentan.reduce((a, s) => a + Math.min(1, s.n / obj), 0) / cuentan.length * 100);
}

// C-ANA-1 · «Molesta»: en los últimos 30 días y en las 3 últimas sesiones del ejercicio, un comentario de dolor
// sin negación, una subida ≥ 2 en una zona con r o un «dolor durante». Se quita tras 2 sesiones seguidas limpias.
// Las subidas cuentan de antes a después de la sesión y hasta el check-in siguiente (C-DOLOR-7: dos veces con
// el mismo ejercicio → «molesta»; con una basta para C-ANA-1).
export function molesta(regs, e, ahora = Date.now()) {
  const sub = subidasDolor(regs, e);
  const marca = (r, i) => leerComentario(r.comentario).includes('molestia') || sub[i].length > 0 || r.durante;
  const n = regs.length;
  return regs.slice(-3).some((r, j) => { const i = n - Math.min(3, n) + j; return ahora - new Date(r.fecha) <= 30 * DIA && marca(r, i) && n - 1 - i < 2; });
}

// Mejora (%) de un ejercicio de la primera a la última sesión: 1RM estimado o repeticiones al mismo peso
// (C-NIVEL-1); en las asistidas, menos ayuda; sin kilos, repeticiones o tiempo totales.
export function mejoraPct(regs, e) {
  if (regs.length < 2) return null;
  const a = medidaSesion(regs[0], e), b = medidaSesion(regs[regs.length - 1], e);
  const pct = (x, y) => (x > 0 ? (y - x) / x * 100 : 0);
  if (a.kg != null && b.kg != null) {
    if (a.asist) return Math.round(Math.max(pct(b.kg, a.kg), a.kg === b.kg ? pct(a.reps, b.reps) : -Infinity));
    return Math.round(Math.max(a.rm && b.rm ? pct(a.rm, b.rm) : -Infinity, a.kg === b.kg ? pct(a.reps, b.reps) : -Infinity, pct(a.kg, b.kg)));
  }
  return Math.round(pct(a.reps, b.reps));
}

// Por ejercicio: cómo va (progresa, estancado, molesta), si gusta y lo que se ha comentado.
export function analizarEjercicios(S) {
  const porId = {};
  const hechas = sesionesHechas(S);
  hechas.forEach(s => (s.ejercicios || []).forEach(x => {
    if (!x.id || !x.comentario) return;
    (porId[x.id] = porId[x.id] || { comentarios: [] }).comentarios.push({ fecha: s.fecha, texto: x.comentario });
  }));
  const ids = new Set([...hechas.flatMap(s => (s.ejercicios || []).map(x => x.id)).filter(Boolean), ...Object.keys(S.perfil.gustos || {})]);
  const constancia = cumplimiento(S);
  const out = {};
  ids.forEach(id => {
    const e = ex(id); if (!e) return;
    const todos = registros(S, id), regs = todos.slice(-6);
    const a = { id, veces: todos.length, gusto: (S.perfil.gustos || {})[id] || null, comentarios: ((porId[id] || {}).comentarios || []).slice(-3), problemas: [] };
    a.comentarios.forEach(c => leerComentario(c.texto).forEach(p => { if (!a.problemas.includes(p)) a.problemas.push(p); }));
    a.molesta = molesta(todos, e);
    if (!a.molesta) a.problemas = a.problemas.filter(p => p !== 'molestia');
    if (regs.length >= 2) {
      const kgDe = r => Math.max(0, ...r.sets.map(z => z.kg || 0));
      const conKg = kgDe(regs[regs.length - 1]) > 0 && kgDe(regs[0]) > 0;
      a.cambio = mejoraPct(regs, e);
      a.mejora = mejoraPct(todos, e); // desde la primera vez (C-NIVEL-1/2)
      a.unidad = conKg ? 'kg' : 'volumen';
      a.desde = conKg ? `${es(kgDe(regs[0]))} → ${es(kgDe(regs[regs.length - 1]))} kg` : '';
      a.estancado = estaEstancado(todos, e); // C-PROG-8
      a.dolorSube = regs.filter(r => dolorSubio(r, e).length).length;
    }
    // C-PROG-8 · Con constancia < 75 % no se cambia nada y se dice.
    const poca = a.estancado && constancia != null && constancia < 75;
    a.estado = a.gusto === 'rechazo' ? 'rechazado'
      : a.molesta ? 'molesta'
      : a.estancado && !poca ? 'estancado'
      : a.cambio > 0 ? 'progresa'
      : regs.length < 2 ? 'nuevo' : 'estable';
    a.accion = {
      rechazado: 'No volver a ponerlo.',
      molesta: 'Cambiar por una variante que no cargue la zona, o bajar carga y rango.',
      estancado: 'Cambiar de variante o de rango de repeticiones (8-12 → 6-8 o 12-15) durante 4 semanas.',
      progresa: 'Seguir con la doble progresión.',
      estable: poca ? `Lleva 4 sesiones sin mejorar, pero la constancia es del ${constancia} %: no se cambia nada hasta entrenar lo previsto.` : 'Seguir; si se repite, ajustar.',
      nuevo: 'Aprender la técnica y fijar el peso de partida.',
    }[a.estado];
    if (a.problemas.includes('ocupado')) a.accion += ' Tener una alternativa por si está ocupado.';
    if (a.problemas.includes('aburrido')) a.accion += ' Variar el ejercicio.';
    if (a.problemas.includes('facil') && a.estado !== 'molesta') a.accion += ' Le resulta fácil: subir carga o pasar a una variante más difícil.';
    if (a.problemas.includes('dificil')) a.accion += ' Le cuesta: bajar carga o pasar a una variante guiada.';
    if (a.problemas.includes('tecnica')) a.accion += ' Repasar técnica con menos peso.';
    out[id] = a;
  });
  return out;
}

// Puntuación de preferencia de un ejercicio para elegirlo (gusto, molestias, estancamiento, conocido).
export function preferencia(analisis, id) {
  const a = analisis[id]; if (!a) return 0;
  let p = { gusta: 3, nogusta: -4, rechazo: -100 }[a.gusto] || 0;
  if (a.estado === 'molesta') p -= 8;
  if (a.estado === 'estancado') p -= 6;
  if (a.estado === 'progresa') p += 2;
  if (a.problemas.includes('ocupado')) p -= 2;
  if (a.problemas.includes('aburrido')) p -= 2;
  if (a.veces) p += 1; // ya lo conoce: continuidad en la progresión
  return p;
}

// ── Tendencias de medidas (C-ANA-3, C-ANA-4, C-ANA-6) ──
const tFecha = f => new Date(String(f).length === 10 ? f + 'T12:00' : f).getTime();
const media = a => a.reduce((x, y) => x + y, 0) / a.length;
// C-ANA-3 · Peso: ≥ 4 medidas en 35 días con ≥ 21 días entre la primera y la última. Media de las 2 últimas
// frente a la de las 2 primeras; «no baja» = diferencia > −0,2 kg. Con menos datos: sin datos suficientes.
export function tendenciaPeso(medidas, ahora = Date.now(), { dias = 35 } = {}) {
  const v = (medidas || []).filter(m => m.peso != null && m.peso !== '' && Number.isFinite(+m.peso) && ahora - tFecha(m.fecha) <= dias * DIA && tFecha(m.fecha) <= ahora)
    .sort((a, b) => tFecha(a.fecha) - tFecha(b.fecha));
  const span = v.length ? (tFecha(v[v.length - 1].fecha) - tFecha(v[0].fecha)) / DIA : 0;
  if (v.length < 4 || span < 21) return { suficiente: false, n: v.length, dias: Math.round(span), cambio: null, noBaja: null, pctSemana: null };
  const ini = media(v.slice(0, 2).map(m => +m.peso)), fin = media(v.slice(-2).map(m => +m.peso));
  const cambio = Math.round((fin - ini) * 10) / 10;
  return { suficiente: true, n: v.length, dias: Math.round(span), desde: v[0].fecha, cambio, noBaja: fin - ini > -0.2,
    pctSemana: Math.round((fin - ini) / ini / (span / 7) * 1000) / 10 };
}
// C-ANA-4 · Cintura: ≥ 2 medidas separadas ≥ 21 días; cambio relevante ≥ 1 cm.
export function tendenciaCintura(medidas, ahora = Date.now()) {
  const v = (medidas || []).filter(m => m.cintura != null && m.cintura !== '' && Number.isFinite(+m.cintura) && tFecha(m.fecha) <= ahora)
    .sort((a, b) => tFecha(a.fecha) - tFecha(b.fecha));
  if (v.length < 2) return { suficiente: false, cambio: null, baja: false };
  const ult = v[v.length - 1], ref = v.filter(m => tFecha(ult.fecha) - tFecha(m.fecha) >= 21 * DIA && tFecha(ult.fecha) - tFecha(m.fecha) <= 63 * DIA).pop();
  if (!ref) return { suficiente: false, cambio: null, baja: false };
  const cambio = Math.round((+ult.cintura - +ref.cintura) * 10) / 10;
  return { suficiente: true, desde: ref.fecha, cambio, baja: cambio <= -1, relevante: Math.abs(cambio) >= 1 };
}

// Tendencias: peso, cintura, dolor por zona, esfuerzo y constancia. Cambian dosis y volumen.
export function tendencias(S) {
  const ahora = Date.now();
  const med = S.medidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const peso = tendenciaPeso(med, ahora), cintura = tendenciaCintura(med, ahora);
  // C-ANA-6 · Pérdida > 1 % por semana durante 3 semanas.
  const p3 = tendenciaPeso(med, ahora, { dias: 28 });
  const dolor = {};
  S.dolor.forEach(d => { (dolor[d.zona] = dolor[d.zona] || []).push(d); });
  const dolorZona = Object.entries(dolor).map(([z, l]) => ({ zona: z, nombre: (ZONAS[z] || {}).corta || z, ...tendenciaDolor(l, ahora) })).filter(d => d.media14 != null);
  const hechas = sesionesHechas(S);
  const ult28 = hechas.filter(s => ahora - new Date(s.terminada || s.fecha) <= 28 * DIA);
  const esf = ult28.map(s => s.cierre && +s.cierre.esfuerzo).filter(Boolean);
  return {
    pesoKg: (med.filter(m => m.peso != null && m.peso !== '').pop() || {}).peso || null,
    peso, cintura,
    cambioPeso4sem: peso.cambio, cambioCintura4sem: cintura.cambio,
    perdidaRapida: !!(p3.suficiente && p3.pctSemana < -1),
    dolor: dolorZona,
    sesionesPorSemana: Math.round(ult28.length / 4 * 10) / 10,
    constancia: cumplimiento(S),
    esfuerzoMedio: esf.length ? Math.round(esf.reduce((a, b) => a + b, 0) / esf.length * 10) / 10 : null,
  };
}

// Medidor de nivel (C-NIVEL-1, C-NIVEL-2, C-NIVEL-3): el progreso medido puede subir (o bajar) el nivel del
// perfil. La app propone y la persona acepta.
export function medidorNivel(S) {
  const hechas = sesionesHechas(S);
  const nivel = S.perfil.nivel || 1;
  const ahora = Date.now();
  const enSemana = i => hechas.filter(s => { const t = ahora - new Date(s.terminada || s.fecha); return t >= i * 7 * DIA && t < (i + 1) * 7 * DIA; }).length;
  const minSes = nivel === 1 ? 2 : 3;
  const semanasActivas = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => enSemana(i) >= minSes).length;
  const primera = hechas[0] ? new Date(hechas[0].terminada || hechas[0].fecha) : null;
  const semanasEntrenando = primera ? Math.floor((ahora - primera) / (7 * DIA)) : 0;
  const ultima = hechas.length ? new Date(hechas[hechas.length - 1].terminada || hechas[hechas.length - 1].fecha) : null;
  const diasSinEntrenar = ultima ? Math.floor((ahora - ultima) / DIA) : null;
  const semanasSinEntrenar = diasSinEntrenar == null ? null : Math.floor(diasSinEntrenar / 7);
  const an = Object.values(analizarEjercicios(S));
  const mejoran = an.filter(a => a.mejora >= 10 && a.veces >= 3).length;
  const mejoranMucho = an.filter(a => a.mejora >= 25 && a.veces >= 4).length;
  // Ninguna zona en B2-B3 (dolor ≥ 4) en las últimas 8 semanas.
  const dolorAlto = S.dolor.some(d => +d.dolor >= 4 && ahora - tFecha(d.fecha) <= 56 * DIA)
    || hechas.some(s => ahora - new Date(s.terminada || s.fecha) <= 56 * DIA && s.checkin && Object.values(s.checkin.dolor || {}).some(v => +v >= 4));
  const criterios = nivel === 1
    ? [['8 semanas entrenando', semanasEntrenando >= 8, `${semanasEntrenando} semanas`], ['6 de las últimas 8 semanas con 2 sesiones o más', semanasActivas >= 6, `${semanasActivas} de 8`], ['4 ejercicios mejorados un 10 % o más', mejoran >= 4, `${mejoran}`]]
    : nivel === 2
      ? [['12 meses entrenando', semanasEntrenando >= 52, `${semanasEntrenando} semanas`], ['6 de las últimas 8 semanas con 3 sesiones o más', semanasActivas >= 6, `${semanasActivas} de 8`], ['8 ejercicios mejorados un 25 % o más', mejoranMucho >= 8, `${mejoranMucho}`], ['Ninguna zona con dolor 4 o más en 8 semanas', !dolorAlto, dolorAlto ? 'con dolor' : 'sin dolor']]
      : [];
  let sugerido = nivel, motivo = '';
  if (nivel > 1 && diasSinEntrenar != null && diasSinEntrenar >= 56) { sugerido = nivel - 1; motivo = `Llevas ${semanasSinEntrenar} semanas sin entrenar: se vuelve un nivel más abajo para retomar con cuidado.`; }
  else if (criterios.length && criterios.every(c => c[1])) { sugerido = nivel + 1; motivo = 'Cumples todos los criterios de constancia y progreso para subir de nivel.'; }
  return { nivel, sugerido, motivo, criterios: criterios.map(([que, ok, valor]) => ({ que, ok, valor })), semanasActivas, semanasEntrenando, mejoran };
}

// Resumen de análisis para la IA (compacto: solo lo que cambia decisiones).
export function analisisParaIA(S) {
  const an = Object.values(analizarEjercicios(S)).filter(a => a.estado !== 'nuevo' || a.gusto || a.comentarios.length);
  const t = tendencias(S);
  return {
    ejercicios: an.slice(0, 40).map(a => ({ id: a.id, estado: a.estado, cambio: a.cambio != null ? a.cambio + '%' : undefined, veces: a.veces || undefined, gusto: a.gusto || undefined,
      comentarios: a.comentarios.length ? a.comentarios.map(c => recortarIA(c.texto, LARGO_IA.comentario)) : undefined, accion: a.accion })),
    tendencias: { ...t, peso: undefined, cintura: undefined, pesoSuficiente: t.peso.suficiente, cinturaBaja: t.cintura.baja, descarga: semanaDescarga(S).toca || undefined },
  };
}
