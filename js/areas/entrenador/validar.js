// Área ENTRENADOR · validador único de sesiones (C-PRIN-3, C-IA-3 de docs/criterio.md).
// Toda sesión pasa por aquí antes de guardarse, venga de la IA, de las reglas o de un día del plan:
//   validarSesion(S, sesion, ctx) → { sesion (corregida), cambios: [texto explicable], valida, ultimoRecurso }
//   problemasSesion(S, sesion, ctx) → [texto]: lo que aún incumple (vacío si está bien). Lo usan las pruebas.
// ctx: { lugar, minutos, dolorHoy, energia, futuro (día de plan), origen: 'ia'|'reglas'|'plan', k, tipo, mia,
//   vistaPrevia (repaso final del plan por reglas: sin rellenar principales, C-VOL-2) }
// ctx.mia (solo una de «Mis sesiones», excepciones aprobadas por Víctor el 20-11-2026): C-MIA-1, no se rellena
// hasta 3 principales ni se quitan por energía o tiempo; C-MIA-2, un principal de nivel superior se queda con
// nota de técnica (C-DOSIS-10 no se aplica). Dolor, lesiones, lugar, material, rechazos, salud, calentamiento,
// cardio y vuelta con estiramientos mandan igual. Nunca llega desde el plan ni desde la IA.
//
// Qué comprueba y corrige, en este orden:
//  1. Día de dolor alto (dolor de hoy ≥ 7, C-DOLOR-4) o día «solo suave» por salud (C-SALUD-0): plantilla fija.
//  2. Cada ejercicio: que exista, lugar y material (C-EST-4), que no esté rechazado, riesgo con el dolor de hoy
//     también en la rehabilitación (C-DOLOR-1), datos de salud (C-SALUD-0), nivel del principal (C-DOSIS-10),
//     ids únicos y rol válido (cardio de verdad, C-CARDIO-5; rehabilitación de una zona activa, C-DOSIS-1).
//  3. Rehabilitación de cada zona activa (C-DOLOR-3), sin riesgo en su zona (C-ZONA-0).
//  4. Cardio con rol válido y los minutos mínimos de D3 (C-CARDIO-1, C-CARDIO-2).
//  5. ≥ 3 principales (como mucho 3 con energía 1 y 4 con energía 2) y 2 con riesgo por zona (C-DOSIS-4).
//  6. Dosis: series ≤ 6 (10 en largos de piscina, C-SERIES-1), repeticiones con la unidad de su tipo,
//     aislamientos ≥ 8 (≥ 12 en hombro, C-DOSIS-3), descanso mínimo (C-PAUSA-1), kg nulo sin historial (C-PROG-1).
//  7. Calentamiento (≥ 2 tareas con nombre, C-CAL-2) y vuelta (≥ 2 tareas y un estiramiento, C-VUELTA-1),
//     cada tarea con id válida para el lugar y el dolor (C-EST-4).
//  8. Tiempo ≤ pedido + 10 % con el orden de C-TIEMPO-2, incluido el último recurso (decisión 8).

import { ex, hayMaterial, puntosTipo } from '../../reglas/catalogo.js';
import { rango, acotarKg, sesionesHechas, cargaMuscular, semanaDescarga, topeSeries } from '../../reglas/progresion.js';
import {
  contextoDia, riesgoHoy, maxDolorHoy, esCardioValido, reglaCardio, cardioDelDia, opcionesCardio, valePrincipal, elegirPrincipales,
  rehabValida, candidatosRehab, fasesRehab, ejercicioRehab, faseDeBanda, zonasRehab, dosis, tipoEj, pausaMinima, AISLA_HOMBRO, esEstiramiento, tareaOk,
  calentamientoDe, vueltaDe, tiempoSesionExacto, tareaSinIdOk, porNombre, tareaLibreConocida, RE_APROXIMACION, aproximacionDe, tiempoEj, notaCardio, tiempoEjercicios, minutosTareas, minutosCalentamiento, minutosVuelta, minDe, minus, lista, nombreZona, PLANTILLAS, tipoParaLugar, porQueEjercicio, minutosSesion,
  sincronizarDosis, techoDolor, noSabeNadar, CARDIO_ULTIMO,
} from './dia.js';
import { diaDolorAlto, tablaDolorAlto } from './dolor-alto.js';

const copia = x => JSON.parse(JSON.stringify(x));
const nombre = e => minus(e.n);
const ROLES = ['principal', 'rehab', 'cardio'];
export const ULTIMO_RECURSO = 'último recurso';
// Nota de técnica de un principal de nivel superior que se mantiene en una de «Mis sesiones» (C-MIA-2).
export const NOTA_NIVEL = 'Es de un nivel más alto que el tuyo: prioriza la técnica, sin llegar al fallo, y si no sale limpio usa una variante más fácil.';
// Nota de un principal de nivel superior porque no hay otro de su nivel para ese músculo (C-DOSIS-10).
export const NOTA_SIN_NIVEL = 'Aquí no hay otro de tu nivel para este músculo: prioriza la técnica, sin llegar al fallo, y si no sale limpio usa una variante más fácil.';
// La explicación lleva el último recurso (y así el validador acepta menos de 3 principales, C-TIEMPO-2).
export const esUltimoRecurso = t => /\(último recurso\)|no caben tu cardio/.test(String(t));
const LUGAR_TXT = { gym: 'el gimnasio', casa: 'casa', calle: 'la calle', piscina: 'la piscina' };

// Zonas en las que un ejercicio va «con precaución» hoy: r=1 en una zona en B0-B1 (C-DOSIS-4).
const zonasPrecaucion = (e, ctx) => (riesgoHoy(e, ctx.niveles, ctx.bandas) === 'precaucion' ? Object.keys(ctx.bandas).filter(z => (e.r || {})[z] === 1 && ctx.bandas[z].banda <= 1) : []);
const minPrecaucion = tipo => (tipo === 'aislamiento' ? 12 : 10);
// La nota «con precaución» (C-DOSIS-4) se reescribe siempre con el dolor de hoy (la del plan puede llevar el de
// la ficha): fuera la frase vieja (de las reglas o de una validación anterior) y la nueva delante. En la
// rehabilitación no se añade otra frase: su nota (C-DOSIS-7) pasa a 3 repeticiones de margen y bajada de 3 s.
const RE_PRECAUCION = [/Con precaución por [^:]+: bajada de 3 s y 3 repeticiones de margen; si pasa de \d+\/10, salta al siguiente\.\s*/g,
  /Implica a [^:]+: carga moderada, bajada de 3 s y 3 de margen; si pasa de \d+\/10, salta al siguiente\.\s*/g];
function notaPrecaucion(S, x, zp, ctx) {
  let nota = String(x.nota || '');
  if (x.rol === 'rehab') {
    if (/3 repeticiones de margen, bajada de 3 s|Con precaución: bajada de 3 s/.test(nota)) return nota;
    if (/\d repeticiones de margen/.test(nota)) return nota.replace(/\d repeticiones de margen/, '3 repeticiones de margen, bajada de 3 s').slice(0, 300);
    return `${nota} Con precaución: bajada de 3 s y 3 repeticiones de margen.`.trim().slice(0, 300);
  }
  RE_PRECAUCION.forEach(re => { nota = nota.replace(re, ''); });
  const techo = Math.min(...zp.map(z => Math.min(techoDolor(S, z), (ctx.bandas[z].dolor || 0) + 2)));
  return `Con precaución por ${lista(zp.map(z => `tu ${nombreZona(z)} (${ctx.bandas[z].dolor}/10)`))}: bajada de 3 s y 3 repeticiones de margen; si pasa de ${techo}/10, salta al siguiente. ${nota}`.trim().slice(0, 300);
}
// C-DOSIS-4 · Con precaución (r=1 en una zona B0-B1, dolor 0-3): ≥ 10 repeticiones (12 en aislamiento), 3 de
// margen, bajada de 3 s y el techo en la nota. También en lo que se añade después (la rehabilitación que vuelve
// tras el ajuste de tiempo).
function conPrecaucion(S, x, ctx, cambios = []) {
  const e = ex(x.id); if (!e) return;
  const zp = zonasPrecaucion(e, ctx);
  const rp = rango(x.reps);
  if (!(zp.length && e.t === 'reps' && rp && rp.u === '')) return;
  const min = minPrecaucion(tipoEj(e));
  if (rp.lo < min) {
    const nuevo = `${min}-${Math.max(rp.hi, min + 2)}`;
    cambios.push(`${nombre(e)} a ${nuevo} repeticiones: implica ${lista(zp.map(z => `tu ${nombreZona(z)}`))} y, con precaución, no baja de ${min}`);
    x.reps = nuevo + (rp.resto || '');
  }
  x.nota = notaPrecaucion(S, x, zp, ctx);
}
// Por qué un ejercicio no vale hoy (null si vale).
function motivoNoVale(S, e, ctx) {
  if (!e.l.includes(ctx.lugar)) return `es de otro lugar (hoy entrenas en ${LUGAR_TXT[ctx.lugar] || ctx.lugar})`;
  if (!hayMaterial(e, ctx.lugar, S.perfil)) return 'no tienes el material';
  if ((S.perfil.gustos || {})[e.id] === 'rechazo') return 'no lo quieres';
  if (riesgoHoy(e, ctx.niveles, ctx.bandas) === 'evitar') {
    const z = Object.keys(ctx.niveles).find(z => (e.r || {})[z]);
    return `carga tu ${nombreZona(z)}${ctx.bandas[z] ? `, que hoy está a ${ctx.bandas[z].dolor}/10` : ''}`;
  }
  if (ctx.salud.excluir.has(e.id)) return 'no va con tus datos de salud';
  if (ctx.lugar === 'piscina' && noSabeNadar(S, e)) return 'aún no nadas 2 × 25 m seguidos: hoy, donde hagas pie y con tabla'; // C-PISC-2, S3
  return null;
}
// ¿Hay algún principal de su nivel para ese músculo hoy (aunque ya esté en la sesión)?
const hayDeSuNivel = (S, ctx, m, salvo) => ctx.pool.some(a => a.id !== salvo && a.m[0] === m && a.niv <= ctx.nivel && valePrincipal(S, a, ctx));
// Alternativa del mismo músculo que sí vale hoy como principal (de su nivel si la hay).
function alternativa(S, ctx, e, excluir, actuales = []) {
  const mat = new Set(e.mat);
  // Mejor no repetir el músculo principal de otro ejercicio de la sesión.
  const repetidos = m => actuales.filter(x => x && x.rol === 'principal' && ex(x.id) && ex(x.id).m[0] === m).length;
  const c = ctx.pool.filter(a => a.id !== e.id && !excluir.includes(a.id) && valePrincipal(S, a, ctx) && (a.m[0] === e.m[0] || e.m.includes(a.m[0])));
  // Como mucho un principal por músculo: solo alternativas de un músculo que aún no esté (N1).
  const libres = c.filter(a => !repetidos(a.m[0]));
  const nivelOk = libres.filter(a => a.niv <= ctx.nivel);
  // Uno de nivel superior solo si no hay ninguno de su nivel para ese músculo (C-DOSIS-10, S19).
  if (!nivelOk.length && hayDeSuNivel(S, ctx, e.m[0], e.id)) return null;
  return (nivelOk.length ? nivelOk : libres)
    .map(a => ({ a, p: (a.m[0] === e.m[0] ? 10 : 0) + a.mat.filter(m => mat.has(m)).length * 3 + (a.t === e.t ? 2 : 0) + puntosTipo(a, e) - Math.abs(a.niv - e.niv) + (riesgoHoy(a, ctx.niveles, ctx.bandas) === 'ok' ? 3 : 0) + ((S.perfil.gustos || {})[a.id] === 'gusta' ? 3 : 0) - ((S.perfil.gustos || {})[a.id] === 'nogusta' ? 4 : 0) }))
    .sort((x, y) => y.p - x.p || x.a.id.localeCompare(y.a.id)).map(x => x.a)[0] || null;
}

// Repeticiones con la unidad que pide su tipo (reps sin unidad, tiempo en s o min, distancia en m). null si no vale.
export function normalizarReps(e, reps) {
  const t = String(reps == null ? '' : reps).trim().slice(0, 24);
  if (!t) return null;
  if (e.t === 'tiempo') {
    const mmss = t.match(/^(\d{1,2}):(\d{2})$/);
    if (mmss) { const s = +mmss[1] * 60 + +mmss[2]; return s >= 120 && s % 60 === 0 ? `${s / 60} min` : `${s}s`; }
    const r = rango(t);
    if (!r) return null;
    if (r.u === 's' || r.u === 'min') return t;
    if (r.u === '' && r.hi <= 300 && !r.resto.trim()) return `${t}s`;
    return null;
  }
  if (e.t === 'distancia') return /\d+\s*m\b|\d+\s*anchos?/.test(t) ? t : null;
  const r = rango(t);
  return r && r.u === '' && r.hi <= 50 ? t : null;
}
// Largos de piscina hasta 10 (C-SERIES-1); un principal, el tope de D-B (3 principiante, 4 el resto, también lo de
// la IA); lo demás (rehabilitación de fase 1 con 4 series…), 6.
const maxSeries = (e, lugar, rol, nivel) => (e.t === 'distancia' && lugar === 'piscina' ? 10 : rol === 'principal' ? Math.min(6, topeSeries(nivel)) : 6);

// Ids con kilos apuntados alguna vez (para C-PROG-1).
const idsConKg = S => new Set(sesionesHechas(S).flatMap(s => (s.ejercicios || []).filter(y => (y.sets || []).some(z => z.hecha && +z.kg > 0)).map(y => y.id)));

// ── Día de dolor alto: lo que NUNCA sale (C-DOLOR-4, comprobación automática) ──
function problemasDolorAlto(S, s, ctx) {
  const out = [];
  const zonas = Object.keys(ctx.bandas);
  const altas = Object.entries(ctx.dolorHoy || {}).filter(([, v]) => +v >= 7).map(([z]) => z);
  (s.ejercicios || []).forEach(x => {
    const e = ex(x.id);
    if (x.rol === 'principal') out.push(`principal en día de dolor alto: ${x.id}`);
    if (x.rol === 'rehab') out.push(`rehabilitación en día de dolor alto: ${x.id}`);
    if (e && zonas.some(z => (e.r || {})[z])) out.push(`${x.id} tiene riesgo en una zona activa`);
    if (e && x.rol !== 'cardio' && altas.some(z => fasesRehab(e, z).length)) out.push(`${x.id} es rehabilitación de una zona con dolor alto`);
  });
  const tareas = [...(s.calentamiento || []), ...(s.vuelta || [])];
  tareas.forEach(t => { const e = t.id && ex(t.id); if (e && zonas.some(z => (e.r || {})[z])) out.push(`tarea ${t.id} con riesgo en una zona activa`); });
  if (tareas.some(t => /aproximaci|series de prueba/i.test(t.nombre || ''))) out.push('series de aproximación en día de dolor alto');
  const t = tiempoSesionExacto(s);
  if (Math.abs(t - ctx.minutos) > 2) out.push(`día de dolor alto de ${Math.round(t)} min (pedidos ${ctx.minutos})`);
  return out;
}

// ── Lo que aún incumple una sesión (vacío si está bien) ──
export function problemasSesion(S, sesion, ctxIn = {}) {
  const ctx = contextoDia(S, { lugar: ctxIn.lugar || sesion.lugar, minutos: ctxIn.minutos || sesion.minutos, dolorHoy: ctxIn.dolorHoy || {}, energia: ctxIn.energia, futuro: ctxIn.futuro });
  const out = [];
  const ejs = sesion.ejercicios || [];
  const alto = !ctx.futuro && maxDolorHoy(ctx.dolorHoy) >= 7;
  const suave = !alto && !!ctx.salud.soloSuave;
  if (alto || suave) { Object.keys(ctx.niveles).forEach(z => { ctx.niveles[z] = 3; }); out.push(...problemasDolorAlto(S, sesion, ctx)); }
  const ids = ejs.map(x => x.id);
  if (new Set(ids).size !== ids.length) out.push('ids repetidos');
  const conKg = idsConKg(S);
  ejs.forEach(x => {
    const e = ex(x.id);
    if (!e) { out.push(`${x.id} no existe`); return; }
    const m = motivoNoVale(S, e, ctx); if (m) out.push(`${x.id}: ${m}`);
    if (!ROLES.includes(x.rol)) out.push(`${x.id}: rol ${x.rol}`);
    if (x.rol === 'cardio' && !esCardioValido(e, ctx.lugar)) out.push(`${x.id} no vale como cardio`);
    if (x.rol === 'rehab' && !Object.keys(ctx.bandas).some(z => rehabValida(S, e, z, ctx))) out.push(`${x.id} no es rehabilitación válida hoy`);
    if (+x.series > maxSeries(e, ctx.lugar, x.rol, ctx.nivel)) out.push(`${x.id}: ${x.series} series`);
    if (x.rol !== 'cardio' && !normalizarReps(e, x.reps)) out.push(`${x.id}: repeticiones «${x.reps}»`);
    if (x.kg != null && +x.kg > 0 && !conKg.has(x.id)) out.push(`${x.id}: kilos sin historial`);
    const rp = rango(x.reps);
    if (e.t === 'reps' && rp && rp.u === '' && zonasPrecaucion(e, ctx).length && rp.lo < minPrecaucion(tipoEj(e))) out.push(`${x.id}: con precaución, ${x.reps} repeticiones (mínimo ${minPrecaucion(tipoEj(e))})`);
  });
  const cardio = ejs.filter(x => x.rol === 'cardio' && esCardioValido(ex(x.id), ctx.lugar));
  if (!cardio.length && opcionesCardio(S, ctx, { sinRiesgo: alto || suave }).length) out.push('sin cardio');
  const regla = reglaCardio(S, ctx.lugar, { minutos: ctx.minutos, energia: ctx.energia, dolorAlto: alto, bandas: ctx.bandas });
  // En el día de dolor alto el bloque cuenta con su inicio suave (decisión 6): la tabla siempre supera el mínimo.
  const minCardio = alto || suave ? Math.min(regla.minutos, tablaDolorAlto(ctx.minutos).cardio - 8) : regla.minutos;
  const minHecho = cardio.reduce((t, x) => t + minDe(x.reps), 0);
  if (cardio.length && minHecho < minCardio) out.push(`cardio de ${minHecho} min (mínimo ${regla.minutos})`);
  const cal = sesion.calentamiento || [], vue = sesion.vuelta || [];
  if (cal.length < 2 || cal.some(t => !t.nombre)) out.push('calentamiento incompleto');
  if (vue.length < 2 || !vue.some(esEstiramiento)) out.push('vuelta sin estiramientos');
  [...cal, ...vue].forEach(t => {
    if (t.id && ex(t.id)) { if (!tareaOk(S, t.id, ctx)) out.push(`tarea ${t.id} no vale hoy`); }
    else if (t.nombre && !tareaSinIdOk(S, t, ctx)) out.push(`tarea «${t.nombre}» no vale hoy`); // S2, S6: también las sin id
  });
  if (!alto && !suave) {
    // Una de «Mis sesiones» se respeta tal cual: ni mínimo de principales ni tope de tiempo (C-MIA-1).
    const ultimo = (sesion.explicacion || []).some(esUltimoRecurso) || sesion.tipo === 'suave' || !!ctxIn.mia; // el día suave lo marca su tipo, no un texto
    const prin = ejs.filter(x => x.rol === 'principal').length;
    // Menos de 3 solo es un fallo si queda alguno más que respete el dolor, el lugar y el material (revisión del PR #48).
    if (prin < 3 && !ultimo && !(ctx.energia === 1 && prin >= 1)) {
      const mas = elegirPrincipales(S, ctx, { huecos: PLANTILLAS[tipoParaLugar(sesion.tipo, ctx.lugar)].huecos, presupuesto: Infinity, k: 0, excluir: ids, maximo: 1 });
      if (mas.length) out.push(`${prin} principales`);
    }
    // Una zona en B2 siempre lleva rehabilitación; una en B0-B1, solo si cabe con el calentamiento y la vuelta
    // enteros: el paso 4 de C-TIEMPO-2 la quita antes de acortarlos (paso 5), así que no es un fallo (S5).
    const tEntero = tiempoEjercicios(ejs) + Math.max(minutosTareas(sesion.calentamiento) ?? 8, minutosCalentamiento(S, ctx)) + Math.max(minutosTareas(sesion.vuelta) ?? 5, minutosVuelta(S, ctx));
    zonasRehab(ctx).forEach(z => {
      const c = candidatosRehab(S, z, ctx);
      if (!c.length || ejs.some(x => x.rol === 'rehab' && rehabValida(S, ex(x.id), z, ctx))) return;
      const cabe = tEntero + tiempoEj(ejercicioRehab(S, c[0], z, ctx)) <= ctx.minutos * 1.1;
      if (ctx.bandas[z].banda >= 2 || cabe) out.push(`sin rehabilitación de ${z}`);
    });
    if (tiempoSesionExacto(sesion) > ctx.minutos * 1.1 + 0.5 && !ultimo) out.push(`${Math.round(tiempoSesionExacto(sesion))} min para ${ctx.minutos}`);
  }
  return out;
}

// ── Validar y corregir ──
export function validarSesion(S, sesion, ctxIn = {}) {
  // Se defiende solo de lo que venga (C-IA-3): sesión nula, listas que no son listas, elementos vacíos.
  sesion = sesion && typeof sesion === 'object' ? sesion : {};
  const lista0 = v => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);
  sesion = { ...sesion, ejercicios: lista0(sesion.ejercicios), calentamiento: lista0(sesion.calentamiento), vuelta: lista0(sesion.vuelta || sesion.vueltaCalma) };
  const lugar = ctxIn.lugar || sesion.lugar || S.perfil.lugares[0] || 'gym';
  const minutos = minutosSesion(ctxIn.minutos || sesion.minutos);
  const dolorHoy = ctxIn.dolorHoy || {};
  const ctx = contextoDia(S, { lugar, minutos, dolorHoy, energia: ctxIn.energia, futuro: ctxIn.futuro });
  const cambios = [];
  let s = copia(sesion);
  s.lugar = lugar; s.minutos = minutos;
  s.explicacion = Array.isArray(s.explicacion) ? s.explicacion : s.explicacion ? [String(s.explicacion)] : [];
  // De la IA no se fía el texto del último recurso (IA-2, C-TIEMPO-2): menos de 3 principales solo si el ajuste de
  // tiempo de la app (paso 8) confirma que no caben; si hace falta, el paso 8 vuelve a escribir el aviso.
  if (ctxIn.origen === 'ia') s.explicacion = s.explicacion.filter(t => !esUltimoRecurso(t));

  // 1. Día de dolor alto (C-DOLOR-4) o «solo suave» por datos de salud (C-SALUD-0): plantilla fija, sin IA.
  const alto = !ctx.futuro && maxDolorHoy(dolorHoy) >= 7;
  if (alto || ctx.salud.soloSuave) {
    if (s.tipo !== 'dolorAlto') {
      const base = diaDolorAlto(S, { lugar, minutos, dolorHoy }, { motivo: alto ? undefined : ctx.salud.soloSuave });
      s = { ...base, fuente: s.fuente && s.fuente !== 'ia' ? s.fuente : 'reglas' };
      cambios.push(alto ? 'con dolor de 7 o más hoy, la sesión es la del día de dolor alto' : 'por tus datos de salud, hoy solo cardio suave y movilidad');
    }
    const notas = notasSalud(s, ctx);
    return { sesion: s, cambios, valida: problemasSesion(S, s, { ...ctxIn, lugar, minutos, dolorHoy }).length === 0, ultimoRecurso: false, notasSalud: notas };
  }

  const conKg = idsConKg(S);
  const quitados = new Set(); // lo que se quita por riesgo no vuelve como rehabilitación
  const ejs = [];
  const vistos = new Set();
  const propuestos = (s.ejercicios || []).map(y => y.id);
  const nPrin = () => ejs.filter(y => y.rol === 'principal').length;
  // 2. Cada ejercicio.
  for (const x0 of s.ejercicios || []) {
    const x = { ...x0 };
    let e = ex(x.id);
    if (!e) { cambios.push(`quito «${String(x.id).slice(0, 40)}», que no está en el catálogo`); continue; }
    if (vistos.has(e.id)) { cambios.push(`quito ${nombre(e)} repetido`); continue; }
    if (!ROLES.includes(x.rol)) x.rol = 'principal';
    // Rol de cardio solo para cardio de verdad (C-CARDIO-5); y un cardio puro no es un principal.
    if (x.rol === 'cardio' && !esCardioValido(e, lugar)) {
      if (valePrincipal(S, e, ctx)) { x.rol = 'principal'; Object.assign(x, dosis(S, e, nPrin(), lugar)); cambios.push(`${nombre(e)} no es cardio: pasa a ejercicio principal`); }
      else { cambios.push(`quito ${nombre(e)} como cardio: no lo es`); continue; }
    } else if (x.rol === 'principal' && esCardioValido(e, lugar) && !valePrincipal(S, e, ctx)) x.rol = 'cardio';
    // Rehabilitación: de una zona activa y sin riesgo en ella (C-DOSIS-1, C-ZONA-0).
    if (x.rol === 'rehab') {
      const z = Object.keys(ctx.bandas).find(z => rehabValida(S, e, z, ctx));
      // Rehabilitación de una zona activa pero de una fase que hoy no toca (C-DOLOR-1, C-DOSIS-7): fuera; el
      // paso 3 pone la de su fase.
      const deOtraFase = !z && Object.entries(ctx.bandas).find(([zz, b]) => b.banda <= 2 && fasesRehab(e, zz, ((b.lesion || {}).detalle)).length);
      if (z) x.zona = z;
      else if (deOtraFase) { cambios.push(`quito ${nombre(e)} de la rehabilitación: con tu ${nombreZona(deOtraFase[0])} a ${deOtraFase[1].dolor}/10 hoy toca la fase ${faseDeBanda(deOtraFase[1])}`); quitados.add(e.id); continue; }
      else if (valePrincipal(S, e, ctx) && !motivoNoVale(S, e, ctx)) { x.rol = 'principal'; cambios.push(`${nombre(e)} no es rehabilitación de ninguna zona activa hoy: va como principal`); }
      else { cambios.push(`quito ${nombre(e)} de la rehabilitación: ${motivoNoVale(S, e, ctx) || 'no es para tus zonas activas de hoy'}`); continue; }
    }
    // Lugar, material, rechazo, riesgo con el dolor de hoy y salud.
    const motivo = motivoNoVale(S, e, ctx);
    if (motivo) {
      const alt = x.rol === 'principal' ? alternativa(S, ctx, e, [...vistos, ...propuestos], ejs) : null;
      quitados.add(e.id);
      if (!alt) { cambios.push(`quito ${nombre(e)}: ${motivo}`); continue; }
      cambios.push(`cambio ${nombre(e)} por ${nombre(alt)}: ${motivo}`);
      const i = nPrin(), d = dosis(S, alt, i, lugar);
      Object.assign(x, { id: alt.id, ...d, nota: `Hoy en lugar de ${nombre(e)}: ${motivo}. ${porQueEjercicio(S, alt, { i, d, an: ctx.an, carga: {}, niveles: ctx.niveles, dolorHoy })}`.slice(0, 300) });
      delete x.kg;
      e = alt;
    }
    // Principal: que valga como tal y de su nivel si lo hay (C-DOSIS-10).
    if (x.rol === 'principal') {
      if (!valePrincipal(S, e, ctx)) { cambios.push(`quito ${nombre(e)}: no es un ejercicio principal`); continue; }
      if (e.niv > ctx.nivel && ctxIn.mia) {
        // C-MIA-2: en una sesión guardada se mantiene, con una nota de técnica (C-DOSIS-10 no se aplica).
        if (!String(x.nota || '').includes(NOTA_NIVEL)) x.nota = `${NOTA_NIVEL} ${x.nota || ''}`.trim().slice(0, 300);
      } else if (e.niv > ctx.nivel && !(lugar === 'piscina' && S.perfil.nadar25 && ['crol', 'espalda'].includes(e.id))) {
        const alt = alternativa(S, ctx, e, [...vistos, ...propuestos], ejs);
        if (alt && alt.niv <= ctx.nivel) { cambios.push(`cambio ${nombre(e)} por ${nombre(alt)}: es de un nivel más alto que el tuyo`); Object.assign(x, { id: alt.id, ...dosis(S, alt, nPrin(), lugar) }); delete x.kg; e = alt; }
        // El de su nivel ya está en la sesión: este sobra (C-DOSIS-10, S19).
        else if (hayDeSuNivel(S, ctx, e.m[0], e.id) && lugar !== 'piscina') { cambios.push(`quito ${nombre(e)}: es de un nivel más alto que el tuyo`); continue; }
        // Sin otro de su nivel para ese músculo aquí, se queda y la nota lo explica (C-DOSIS-10, S13).
        else if (!String(x.nota || '').includes(NOTA_SIN_NIVEL)) x.nota = `${NOTA_SIN_NIVEL} ${x.nota || ''}`.trim().slice(0, 300);
      }
    }
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    ejs.push(x);
  }

  // 3. Rehabilitación de cada zona activa: al menos 1 por zona, como mucho 2. Lo propuesto que se ha quitado
  // o cambiado (por riesgo, nivel o rol) no vuelve como rehabilitación (N3).
  propuestos.filter(id => !ejs.some(y => y.id === id)).forEach(id => quitados.add(id));
  const rehab = ejs.filter(x => x.rol === 'rehab');
  zonasRehab(ctx).forEach(z => {
    const deZona = rehab.filter(x => x.zona === z);
    deZona.slice(2).forEach(x => { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: basta con 2 ejercicios para tu ${nombreZona(z)}`); });
    if (deZona.length) return;
    const c = candidatosRehab(S, z, ctx).filter(e => !ejs.some(y => y.id === e.id) && !quitados.has(e.id));
    if (!c.length) {
      // Cada zona lleva su rehabilitación (C-DOLOR-3). Si el único que vale ya está en la sesión con otro
      // rol (dead bug como principal, caminar en el agua como cardio), pasa a rehabilitación (el paso 4 pone otro
      // cardio, si lo hay); si se había quitado por otro motivo que no es el riesgo, vuelve.
      const todos = candidatosRehab(S, z, ctx);
      const libre = todos.find(e => !ejs.some(y => y.id === e.id));
      const comoPrin = ejs.find(y => y.rol === 'principal' && todos.some(e => e.id === y.id));
      const comoCardio = ejs.find(y => y.rol === 'cardio' && todos.some(e => e.id === y.id) && opcionesCardio(S, ctx).some(e => !ejs.some(w => w.id === e.id)));
      const de = libre ? null : comoPrin || comoCardio;
      const e0 = libre || (de && ex(de.id));
      if (!e0) return;
      const nuevo = { ...ejercicioRehab(S, e0, z, ctx), zona: z };
      if (de) ejs.splice(ejs.indexOf(de), 1, nuevo); else ejs.unshift(nuevo);
      cambios.push(de ? `${nombre(e0)} va para tu ${nombreZona(z)}` : `añado ${nombre(e0)} para tu ${nombreZona(z)}`);
      return;
    }
    const nuevo = { ...ejercicioRehab(S, c[(ctxIn.k || 0) % c.length], z, ctx), zona: z };
    ejs.unshift(nuevo);
    cambios.push(`añado ${nombre(ex(nuevo.id))} para tu ${nombreZona(z)}`);
  });

  // 4. Cardio: uno, válido, con los minutos mínimos de D3 (nunca menos, C-CARDIO-2).
  const regla = reglaCardio(S, lugar, { minutos, energia: ctx.energia, bandas: ctx.bandas });
  const cardios = ejs.filter(x => x.rol === 'cardio');
  const cardio = cardios[0];
  // Un solo ejercicio de cardio con todos los minutos: si vienen dos o más (un bloque encadenado, C-CARDIO-5), sus
  // minutos se suman al primero y la nota dice con qué alterna (antes se perdían y el cardio quedaba por debajo).
  if (cardios.length > 1) {
    const minutosDe = x => { const t = String(x.reps == null ? '' : x.reps).trim(); return /^\d+(?:[.,]\d+)?$/.test(t) ? +t.replace(',', '.') : minDe(normalizarReps(ex(x.id), t) || ''); };
    const total = Math.round(cardios.reduce((t, x) => t + minutosDe(x), 0));
    const otros = cardios.slice(1).map(x => nombre(ex(x.id)));
    cardios.slice(1).forEach(x => { ejs.splice(ejs.indexOf(x), 1); });
    if (total > 0) cardio.reps = `${total} min`;
    cardio.nota = `${String(cardio.nota || '').trim()} Alterna con ${lista(otros)} cada 1-3 min, sin parar.`.trim().slice(0, 300);
  }
  // La marcha sentada solo si no vale otro cardio (S7), también si la trae la IA (revisión del PR #48, M1).
  if (cardio && CARDIO_ULTIMO.includes(cardio.id) && !ctxIn.mia) {
    const mejor = opcionesCardio(S, ctx).find(e => !CARDIO_ULTIMO.includes(e.id) && !ejs.some(y => y.id === e.id));
    if (mejor) { cambios.push(`cambio ${nombre(ex(cardio.id))} por ${nombre(mejor)}: la marcha sentada solo va si no vale otro cardio`); cardio.id = mejor.id; cardio.nota = ''; }
  }
  if (!cardio) {
    const c = cardioDelDia(S, ctx, ctxIn.k || 0, 0, ejs.map(x => x.id));
    if (c) { ejs.push(c); cambios.push(`añado ${minDe(c.reps)} min de cardio (${nombre(ex(c.id))}): toda sesión lleva cardio`); }
    else cambios.push('hoy no hay ningún cardio posible en este lugar con tu dolor');
  } else {
    // Sin unidad son minutos (M4); con un tope: el máximo de la regla o la mitad de la sesión (B5).
    const txt = String(cardio.reps == null ? '' : cardio.reps).trim();
    const min = Math.round(/^\d+(?:[.,]\d+)?$/.test(txt) ? +txt.replace(',', '.') : minDe(normalizarReps(ex(cardio.id), txt) || ''));
    const tope = (ctxIn.tipo || s.tipo) === 'suave' ? minutos : Math.max(regla.minutos, Math.min(regla.max, Math.floor(minutos / 2)));
    if (min < regla.minutos) { cardio.reps = `${regla.minutos} min`; if (min > 0) cambios.push(`el cardio sube de ${min} a ${regla.minutos} min: es el mínimo para tu objetivo`); }
    else if (min > tope) { cardio.reps = `${tope} min`; cambios.push(`el cardio baja de ${min} a ${tope} min`); }
    else cardio.reps = `${min} min`;
    cardio.series = 1; cardio.descanso = 0;
    // Sin intervalos permitidos o con un esfuerzo máximo por salud, la nota es la de la regla (C-CARDIO-4, B4).
    // La nota es la del cardio que va (S17), no la del primero de la lista.
    if (!cardio.nota || !regla.intervalos || ctx.salud.rpeMax || ctx.energia <= 2) cardio.nota = notaCardio(S, ctx, ex(cardio.id), minDe(cardio.reps), regla, 0, opcionesCardio(S, ctx));
  }

  // 5. Principales: ≥ 3 (como mucho 3 con energía 1 y 4 con energía 2, C-ENERGIA-1); 2 con riesgo por zona.
  const maximo = ctxIn.mia ? 99 : ctx.energia === 1 ? 3 : ctx.energia === 2 ? 4 : 9; // C-MIA-1: no se quita por energía
  ejs.filter(x => x.rol === 'principal').slice(maximo).forEach(x => { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: hoy tienes poca energía`); });
  Object.keys(ctx.bandas).forEach(z => {
    ejs.filter(x => x.rol === 'principal' && (ex(x.id).r || {})[z]).slice(2).forEach(x => {
      const alt = alternativa(S, ctx, ex(x.id), ejs.map(y => y.id), ejs);
      if (alt && !(alt.r || {})[z]) { cambios.push(`cambio ${nombre(ex(x.id))} por ${nombre(alt)}: ya hay 2 ejercicios que implican tu ${nombreZona(z)}`); Object.assign(x, { id: alt.id, ...dosis(S, alt, 3, lugar) }); delete x.kg; }
      else { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: ya hay 2 ejercicios que implican tu ${nombreZona(z)}`); }
    });
  });
  const suaveDelPlan = (ctxIn.tipo || s.tipo) === 'suave' && nPrin() === 0; // día suave del reparto (C-REP-2): sin fuerza
  // La vista previa del plan ya trae sus principales ajustados al volumen semanal (C-VOL-2): no se rellenan aquí.
  let añadidos = null;
  const faltan = s.explicacion.some(esUltimoRecurso) || suaveDelPlan || ctxIn.mia || ctxIn.vistaPrevia ? 0 : Math.min(3, maximo) - nPrin(); // C-MIA-1
  if (faltan > 0) {
    const tipo = tipoParaLugar(ctxIn.tipo || s.tipo, lugar);
    const nuevos = elegirPrincipales(S, ctx, { huecos: PLANTILLAS[tipo].huecos, presupuesto: Infinity, k: ctxIn.k || 0, excluir: ejs.map(x => x.id), maximo: faltan });
    nuevos.forEach(e => {
      const i = nPrin(), d = dosis(S, e, i, lugar);
      ejs.push({ id: e.id, rol: 'principal', ...d, nota: porQueEjercicio(S, e, { i, d, an: ctx.an, carga: {}, niveles: ctx.niveles, dolorHoy }) });
    });
    if (nuevos.length) { cambios.push(`añado ${lista(nuevos.map(nombre))}: toda sesión lleva al menos 3 ejercicios principales`); añadidos = { ids: nuevos.map(e => e.id), texto: cambios[cambios.length - 1] }; }
    if (nuevos.length < faltan) s.explicacion.push(`Hoy, en este lugar, solo ${nPrin() === 1 ? 'hay 1 ejercicio principal' : `hay ${nPrin()} ejercicios principales`} que respeten tu dolor y tu material.`);
  }
  // Orden: rehabilitación → principales (el primero sin riesgo en una zona activa) → cardio (C-REP-5, C-DOSIS-4).
  const orden = { rehab: 0, principal: 1, cardio: 2 };
  ejs.sort((a, b) => orden[a.rol] - orden[b.rol]);
  const pi = ejs.findIndex(x => x.rol === 'principal'), ok = ejs.findIndex(x => x.rol === 'principal' && riesgoHoy(ex(x.id), ctx.niveles, ctx.bandas) === 'ok');
  if (pi >= 0 && ok > pi) ejs.splice(pi, 0, ejs.splice(ok, 1)[0]);

  // 6. Dosis.
  let iPrin = 0;
  // Contexto del check-in para el tope de kilos de la progresión (C-PROG-5, PR 10).
  const ctxKg = { energia: ctx.energia, dolorHoy, niveles: ctx.niveles, carga: ctx.futuro ? {} : cargaMuscular(S), descarga: semanaDescarga(S).toca };
  ejs.forEach(x => {
    const e = ex(x.id);
    const i = x.rol === 'principal' ? iPrin++ : 0;
    const max = maxSeries(e, lugar, x.rol, ctx.nivel);
    const series = Math.round(+x.series);
    if (!(series >= 1)) x.series = x.rol === 'principal' ? dosis(S, e, i, lugar).series : Math.min(3, e.d[0]);
    else if (series > max) { cambios.push(`${nombre(e)}: ${series} series son demasiadas, se queda en ${max}`); x.series = max; } else x.series = series;
    if (x.rol !== 'cardio') {
      const r = normalizarReps(e, x.reps);
      if (!r) {
        const def = x.rol === 'principal' ? dosis(S, e, i, lugar).reps : e.d[1];
        if (x.reps) cambios.push(`${nombre(e)}: «${String(x.reps).slice(0, 20)}» no vale para este ejercicio, pongo ${def}`);
        x.reps = def;
      } else x.reps = r;
      const tipo = tipoEj(e);
      // Topes de dosis (C-DOSIS-2, C-DOSIS-6, B5): nada «al fallo», repeticiones del principal dentro de lo
      // razonable para su nivel, tiempo por serie y metros por serie acotados.
      const fuera = (() => {
        const r = rango(x.reps) || {};
        if (/fallo|m[aá]ximo|amrap/i.test(String(x.reps))) return true;
        if (x.rol === 'principal' && e.t === 'reps' && r.u === '') return r.lo < (ctx.nivel === 1 ? 6 : 3) || r.hi > 20;
        if (e.t === 'tiempo' && x.rol !== 'cardio') {
          const seg = r.u === 'min' ? r.hi * 60 : r.u === 's' ? r.hi : 0;
          if (/min/.test(String(e.d[1]))) return seg > 600; // posturas de minutos (descarga 90/90…)
          const iso = /plancha|isometric|pared/.test(e.id) || tipo === 'propia';
          return seg > (iso ? (ctx.salud.isoMax || 90) : 120);
        }
        if (e.t === 'distancia') { const m = String(x.reps).match(/(\d+)\s*m\b/); return !!m && +m[1] > 200; }
        return false;
      })();
      if (fuera) {
        const def = x.rol === 'principal' ? dosis(S, e, i, lugar).reps : e.d[1];
        cambios.push(`${nombre(e)}: «${String(x.reps).slice(0, 20)}» es demasiado, pongo ${def}`);
        x.reps = def;
      }
      const rg = rango(x.reps);
      const minReps = AISLA_HOMBRO.includes(e.id) ? 12 : 8;
      if (x.rol === 'principal' && tipo === 'aislamiento' && rg && rg.u === '' && rg.lo < minReps) {
        const nuevo = minReps === 12 ? '12-15' : '10-12';
        cambios.push(`${nombre(e)} a ${nuevo} repeticiones: un aislamiento no baja de ${minReps}`);
        x.reps = nuevo + (rg.resto || '');
      }
      // C-DOSIS-4 · Con precaución (r=1 en una zona B0-B1, dolor 0-3): ≥ 10 repeticiones (12 en aislamiento) y
      // 3 de margen, bajada de 3 s y el techo en la nota. También en lo que propone la IA.
      conPrecaucion(S, x, ctx, cambios);
      const desc = Math.round(+x.descanso);
      x.descanso = desc >= 0 && desc <= 300 ? desc : x.rol === 'principal' ? dosis(S, e, i, lugar).descanso : e.d[2];
      const pm = x.rol === 'principal' ? Math.max(pausaMinima(tipo, (rango(x.reps) || {}).lo), ctx.salud.descansoMin || 0) : 0;
      // El primero de una superserie va sin descanso: se descansa tras la pareja, con el segundo (C-TIEMPO-2 paso 6, S18).
      if (x.descanso < pm && !x.superserie) x.descanso = pm;
    }
    // Kilos: nulos sin historial (C-PROG-1); con historial, el tope de la progresión (C-PROG-5, PR 10).
    if (x.kg != null && +x.kg > 0) {
      if (!conKg.has(x.id)) { cambios.push(`${nombre(e)} sin kilos: es la primera vez, elige un peso con el que te sobren 3 repeticiones`); delete x.kg; }
      else x.kg = acotarKg(S, x.id, +x.kg, { ...ctxKg, series: x.series, reps: x.reps });
    } else delete x.kg; // sin kilos: el campo no va (forma del plan); crearSesion lo deja en null
    if (x.kg == null) delete x.kg;
    delete x.zona;
  });

  // 7. Calentamiento y vuelta a la calma: tareas válidas, ≥ 2 tareas y un estiramiento en la vuelta.
  const principales = () => ejs.filter(x => x.rol === 'principal').map(x => ex(x.id));
  const tareaValida = t => t && typeof t === 'object' && (t.nombre == null || typeof t.nombre === 'string') && (t.nombre || (t.id && ex(t.id)));
  // Tareas sin id (la IA las manda así): se busca su ejercicio por el nombre; si no casa y hay zonas activas,
  // la tarea de la IA no se puede comprobar y se cambia por las de las reglas (C-EST-4, B3). Las que escribe la
  // propia app sin id (respiración, series de aproximación o de prueba, estiramientos libres y textos de la ficha)
  // sí se pueden comprobar: se quedan si valen hoy (ronda real del 23-11: 20 de 48 sesiones perdían así tareas buenas).
  const conZonas = Object.keys(ctx.bandas).length > 0;
  const deIA = ctxIn.origen === 'ia';
  let descartadas = 0;
  const limpiar = (l, donde) => (Array.isArray(l) ? l : []).filter(tareaValida).map(t => {
    if (!deIA || (t.id && ex(t.id))) return t;
    if (RE_APROXIMACION.test(String(t.nombre || '').trim())) return { ...t, id: undefined };
    const e = porNombre(t.nombre);
    if (e) return { ...t, id: e.id };
    if (conZonas && !tareaLibreConocida(t)) { descartadas++; return null; }
    return { ...t, id: undefined };
  }).filter(Boolean).filter(t => {
    if (t.id && ex(t.id) && !tareaOk(S, t.id, ctx)) { cambios.push(`quito ${nombre(ex(t.id))} ${donde}: ${motivoNoVale(S, ex(t.id), ctx) || 'hoy no va con tu dolor o no se hace en este lugar'}`); return false; }
    if (!(t.id && ex(t.id)) && t.nombre && !tareaSinIdOk(S, t, ctx)) { cambios.push(`quito «${String(t.nombre).slice(0, 40)}» ${donde}: hoy no va con tu dolor`); return false; }
    return true;
  }).map(t => ({ ...t, nombre: t.nombre || ex(t.id).n }));
  s.calentamiento = limpiar(s.calentamiento, 'del calentamiento');
  // La aproximación de la IA es la del primer compuesto que de verdad queda en la sesión (C-CAL-2), con el texto de
  // la app (porcentajes con kilos apuntados; si no, series de prueba); sin compuesto no hay aproximación.
  if (deIA) {
    const primero = principales().find(e => tipoEj(e) === 'compuesto');
    let puesta = false;
    s.calentamiento = s.calentamiento.flatMap(t => {
      if (!RE_APROXIMACION.test(String(t.nombre || '').trim())) return [t];
      if (!primero || puesta) return [];
      puesta = true;
      return [{ ...aproximacionDe(S, primero), duracion: t.duracion }];
    });
  }
  if (s.calentamiento.length < 2) { s.calentamiento = calentamientoDe(S, ctx, principales()); cambios.push('añado el calentamiento, que siempre va'); }
  ponerEquilibrio(S, s, ctx, ejs);
  // Sin historial no hay porcentajes: series de prueba (C-CAL-2).
  s.calentamiento.forEach(t => {
    if (/%/.test(t.detalle || '') && !principales().some(e => conKg.has(e.id))) { t.nombre = 'Series de prueba'; t.detalle = '1 × 10 muy ligera y 1 × 5 algo más pesada del primer ejercicio, para elegir el peso de hoy.'; }
  });
  s.vuelta = limpiar(s.vuelta || s.vueltaCalma, 'de la vuelta a la calma');
  delete s.vueltaCalma;
  if (!s.vuelta.some(esEstiramiento)) {
    s.vuelta = [...vueltaDe(S, ctx, principales()).filter(esEstiramiento).slice(0, 2), ...s.vuelta];
    cambios.push('añado estiramientos a la vuelta a la calma, que siempre los lleva');
  }
  if (s.vuelta.length < 2) s.vuelta.push({ nombre: 'Respiración', detalle: '6 respiraciones lentas soltando el aire en 6 segundos.', duracion: '1 min' });
  if (descartadas) cambios.push(`cambio ${descartadas} tarea${descartadas > 1 ? 's' : ''} de calentamiento o vuelta que no puedo comprobar con tu lesión por las de la app`);
  s.ejercicios = ejs;
  let notas = notasSalud(s, ctx);

  // 8. Tiempo ≤ pedido + 10 % (C-TIEMPO-1, C-TIEMPO-2). Una de «Mis sesiones» no se recorta (C-MIA-1).
  const ultimo = ctxIn.mia ? null : ajustarTiempo(S, s, ctx, cambios);
  // Lo que el ajuste de tiempo deshace no se cuenta como hecho (ronda del 23-11, CR-26): si los principales que
  // se añadieron ya no están, fuera el «añado …»; sin ningún principal, fuera también las «series menos».
  if (añadidos && !añadidos.ids.some(id => s.ejercicios.some(x => x.id === id))) cambios.splice(cambios.indexOf(añadidos.texto), 1);
  if (ultimo && !s.ejercicios.some(x => x.rol === 'principal')) { const i = cambios.findIndex(c => /^para que quepa en \d+ minutos, \d+ series? menos/.test(c)); if (i >= 0) cambios.splice(i, 1); }
  if (ultimo) {
    // La explicación dice lo que de verdad queda (IA-5): sin fuerza, fuera los puntos de principales y de dosis
    // y un primer punto nuevo con el dolor de hoy; con 2 en superserie, el número que queda.
    const n = s.ejercicios.filter(x => x.rol === 'principal').length;
    if (!n) {
      const zs = zonasRehab(ctx).filter(z => s.ejercicios.some(x => x.rol === 'rehab' && rehabValida(S, ex(x.id), z, ctx)));
      const c = s.ejercicios.find(x => x.rol === 'cardio');
      s.explicacion = [`Hoy cardio${c ? ` (${c.reps})` : ''}${zs.length ? ` y ejercicios para ${lista(zs.map(z => `tu ${nombreZona(z)} (${ctx.bandas[z].dolor}/10)`))}` : ''}: con ${ctx.minutos} minutos no cabe también la fuerza.`,
        ...s.explicacion.slice(1).filter(t => !/ejercicios principales|el primer básico va a|^Dosis para/.test(String(t)))];
    } else s.explicacion = s.explicacion.map(t => String(t).replace(/\b\d+ ejercicios principales/, `${n} ejercicios principales`));
    s.explicacion.splice(1, 0, ultimo);
  }
  sincronizarDosis(s);
  // El margen depende de que queden principales (el último recurso sin fuerza los quita).
  if (!s.ejercicios.some(x => x.rol === 'principal')) { const fuera = notas.filter(n => /de margen en cada serie/.test(n)); s.explicacion = s.explicacion.filter(t => !fuera.includes(t)); notas = notas.filter(n => !fuera.includes(n)); }
  const valida = problemasSesion(S, s, { ...ctxIn, lugar, minutos, dolorHoy }).length === 0;
  return { sesion: s, cambios, valida, ultimoRecurso: !!ultimo, notasSalud: notas };
}

// Un ejercicio de equilibrio con apoyo en cada sesión con 60 años o más o por salud (C-EDAD-1, C-SALUD-0).
// También después de rehacer el calentamiento para cuadrar el tiempo (S4).
const EQ = 'equilibrio-una-pierna';
const necesitaEquilibrio = (S, ctx) => (ctx.salud.equilibrio || (ctx.edad != null && ctx.edad >= 60)) && !!ex(EQ) && tareaOk(S, EQ, ctx);
function ponerEquilibrio(S, s, ctx, ejs = s.ejercicios || []) {
  if (!necesitaEquilibrio(S, ctx)) return;
  if (s.calentamiento.some(t => t.id === EQ) || ejs.some(x => x.id === EQ)) return;
  s.calentamiento.push({ id: EQ, nombre: ex(EQ).n, detalle: '30 s por pierna con la mano cerca de una pared o una barra.', duracion: '1 min' });
}

// Datos de salud en la explicación (C-SALUD-0) y margen mínimo (C-SALUD-1, C-EDAD-1, C-RIR-1).
// Devuelve las notas, para que quien monte la explicación las ponga delante de lo que se pueda recortar (IA-3).
function notasSalud(s, ctx) {
  const margen = Math.max(ctx.salud.margenMin || 0, ctx.edad != null && ctx.edad >= 60 ? 2 : 0);
  const notas = [...ctx.salud.notas, ...(margen && (s.ejercicios || []).some(x => x.rol === 'principal') ? [`Deja al menos ${margen} repeticiones de margen en cada serie.`] : [])];
  s.explicacion = [...(s.explicacion || []).slice(0, 1), ...notas.filter(n => !(s.explicacion || []).includes(n)), ...(s.explicacion || []).slice(1)];
  return notas;
}

// Antagonistas para la superserie (C-TIEMPO-3): empuje-tirón o dominante de rodilla y de cadera.
const GRUPO = { pecho: 'empuje', hombro: 'empuje', triceps: 'empuje', espalda: 'tiron', biceps: 'tiron', cuadriceps: 'rodilla', gluteo: 'cadera', isquios: 'cadera' };
const CONTRARIO = { empuje: 'tiron', tiron: 'empuje', rodilla: 'cadera', cadera: 'rodilla' };
const antagonistas = (a, b) => !!a && !!b && !!GRUPO[a.m[0]] && CONTRARIO[GRUPO[a.m[0]]] === GRUPO[b.m[0]];

// Orden para cuadrar el tiempo (C-TIEMPO-2). Devuelve el texto del último recurso si se ha usado.
function ajustarTiempo(S, s, ctx, cambios) {
  const limite = ctx.minutos * 1.1;
  const T = () => tiempoSesionExacto(s);
  if (T() <= limite) return null;
  const prin = () => s.ejercicios.filter(x => x.rol === 'principal');
  const pausa = x => pausaMinima(tipoEj(ex(x.id)), (rango(x.reps) || {}).lo);
  // 1. Descansos de los accesorios al mínimo de C-PAUSA-1.
  prin().slice(2).forEach(x => { const p = pausa(x); if (p && x.descanso > p) x.descanso = p; });
  // 2. Una serie menos a los accesorios (mínimo 2) y luego a los compuestos (mínimo 2).
  let quitadas = 0;
  for (const grupo of [() => prin().slice(2).reverse(), () => prin().slice(0, 2).reverse()]) {
    let algo = true;
    while (T() > limite && algo) { algo = false; for (const x of grupo()) { if (T() <= limite) break; if (x.series > 2) { x.series--; quitadas++; algo = true; } } }
  }
  if (quitadas) cambios.push(`para que quepa en ${ctx.minutos} minutos, ${quitadas} serie${quitadas > 1 ? 's' : ''} menos y descansos al mínimo`);
  // 3. Accesorios del final, hasta 3 principales.
  const quitados = [];
  while (T() > limite && prin().length > 3) { const x = prin()[prin().length - 1]; s.ejercicios.splice(s.ejercicios.indexOf(x), 1); quitados.push(nombre(ex(x.id))); }
  if (quitados.length) cambios.push(`con ${ctx.minutos} minutos quito ${lista(quitados)}`);
  // 4. Rehabilitación: de 2 por zona a 1; luego fuera la de las zonas en B0-B1 (nunca la última de una zona en B2).
  const deZona = z => s.ejercicios.filter(x => x.rol === 'rehab' && rehabValida(S, ex(x.id), z, ctx));
  const zonas = zonasRehab(ctx);
  // Nunca la última de una zona en B2, aunque el ejercicio sirva también para otra zona (p. ej. la prensión, de codo
  // y de muñeca).
  const ultimaDeB2 = x => zonas.some(z2 => ctx.bandas[z2].banda >= 2 && rehabValida(S, ex(x.id), z2, ctx) && deZona(z2).length <= 1);
  zonas.forEach(z => { while (T() > limite && deZona(z).length > 1) { const x = deZona(z).filter(y => !ultimaDeB2(y)).pop(); if (!x) break; s.ejercicios.splice(s.ejercicios.indexOf(x), 1); } });
  zonas.slice().reverse().forEach(z => { if (T() > limite && ctx.bandas[z].banda <= 1) deZona(z).filter(x => !ultimaDeB2(x)).forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1)); });
  // Si se ha ido el equilibrio que venía como rehabilitación (tobillo), vuelve al calentamiento (C-EDAD-1, S4).
  ponerEquilibrio(S, s, ctx);
  // Tras acortar o quitar fuerza, vuelve la rehabilitación de las zonas B0-B1 que quitó el paso 4 si ahora cabe
  // (revisión del PR #45, M3).
  const reponer = () => zonas.forEach(z => {
    if (ctx.bandas[z].banda > 1 || deZona(z).length) return;
    const c = candidatosRehab(S, z, ctx).filter(e => !s.ejercicios.some(y => y.id === e.id) && !s.calentamiento.some(t => t.id === e.id))[0]; if (!c) return;
    const x = ejercicioRehab(S, c, z, ctx);
    conPrecaucion(S, x, ctx);
    if (T() + tiempoEj(x) <= limite) s.ejercicios.unshift(x);
  });
  // 5. Calentamiento a 4 min y vuelta a 3. El equilibrio (C-EDAD-1) va dentro de esos 4 min (M2).
  if (T() > limite) {
    s.calentamiento = calentamientoDe(S, ctx, prin().map(x => ex(x.id)), { total: necesitaEquilibrio(S, ctx) ? 3 : 4 });
    ponerEquilibrio(S, s, ctx);
    s.vuelta = vueltaDe(S, ctx, prin().map(x => ex(x.id)), { total: 3 });
    cambios.push('calentamiento de 4 minutos y vuelta a la calma de 3');
  }
  if (T() <= limite) { reponer(); return null; }
  // 6. Último recurso: 2 principales en superserie de 2 series (decisión 8, C-TIEMPO-3).
  // La pareja, de antagonistas si la hay: empuje-tirón o rodilla-cadera (C-TIEMPO-3, revisión del PR #48).
  const todos = prin();
  const pares = todos.flatMap((a, i) => todos.slice(i + 1).map(b => [a, b]));
  const par = pares.find(([a, b]) => antagonistas(ex(a.id), ex(b.id))) || todos.slice(0, 2);
  todos.filter(x => !par.includes(x)).forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1));
  // El primero, el que no tiene riesgo en una zona activa (C-DOSIS-4).
  const [p0, p1] = prin();
  if (p1 && riesgoHoy(ex(p0.id), ctx.niveles, ctx.bandas) !== 'ok' && riesgoHoy(ex(p1.id), ctx.niveles, ctx.bandas) === 'ok') {
    s.ejercicios.splice(s.ejercicios.indexOf(p1), 1); s.ejercicios.splice(s.ejercicios.indexOf(p0), 0, p1);
  }
  const dos = prin();
  if (dos.length === 2) {
    dos.forEach(x => { x.series = 2; delete x.superserie; });
    dos[0].superserie = true; dos[0].descanso = 0;
    // Entre parejas, 90-120 s y nunca por debajo de C-PAUSA-1 de ninguno de los dos (S18, decisión de Víctor del 23-11-2026).
    dos[1].descanso = Math.min(120, Math.max(90, ...dos.map(pausa)));
    dos[0].nota = `En superserie con ${nombre(ex(dos[1].id))}: una serie de cada uno seguidas y descansa ${dos[1].descanso} s. ${dos[0].nota || ''}`.slice(0, 300);
    s.ejercicios.splice(s.ejercicios.indexOf(dos[1]), 1);
    s.ejercicios.splice(s.ejercicios.indexOf(dos[0]) + 1, 0, dos[1]);
  }
  if (T() <= limite) reponer();
  if (T() <= limite) return `Por tiempo (${ULTIMO_RECURSO}): con ${ctx.minutos} minutos caben tu cardio, lo de tu lesión y 2 ejercicios principales en superserie.`;
  // 7. Sin fuerza ese día: cardio mínimo y rehabilitación, con el aviso.
  prin().forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1));
  reponer();
  const c = s.ejercicios.find(x => x.rol === 'cardio');
  const zs = zonas.filter(z => deZona(z).length);
  return `Con ${ctx.minutos} minutos no caben tu cardio de ${c ? minDe(c.reps) : 0} minutos, el trabajo de tu ${lista(zs.map(nombreZona)) || 'lesión'} y fuerza. Hoy: cardio y rehabilitación. Si quieres fuerza, elige ${ctx.minutos + 15} minutos.`;
}
