// Área ENTRENADOR · validador único de sesiones (C-PRIN-3, C-IA-3 de docs/criterio.md).
// Toda sesión pasa por aquí antes de guardarse, venga de la IA, de las reglas o de un día del plan:
//   validarSesion(S, sesion, ctx) → { sesion (corregida), cambios: [texto explicable], valida, ultimoRecurso }
//   problemasSesion(S, sesion, ctx) → [texto]: lo que aún incumple (vacío si está bien). Lo usan las pruebas.
// ctx: { lugar, minutos, dolorHoy, energia, futuro (día de plan), origen: 'ia'|'reglas'|'plan', k, tipo }
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

import { ex, riesgo, hayMaterial } from '../../reglas/catalogo.js';
import { rango, acotarKg, sesionesHechas, cargaMuscular } from '../../reglas/progresion.js';
import {
  contextoDia, maxDolorHoy, esCardioValido, reglaCardio, cardioDelDia, opcionesCardio, valePrincipal, elegirPrincipales,
  rehabValida, candidatosRehab, fasesRehab, ejercicioRehab, zonasRehab, dosis, tipoEj, pausaMinima, AISLA_HOMBRO, esEstiramiento, tareaOk,
  calentamientoDe, vueltaDe, tiempoSesionExacto, minDe, minus, lista, nombreZona, PLANTILLAS, tipoParaLugar, porQueEjercicio, minutosSesion,
} from './dia.js';
import { diaDolorAlto, tablaDolorAlto } from './dolor-alto.js';

const copia = x => JSON.parse(JSON.stringify(x));
const nombre = e => minus(e.n);
const ROLES = ['principal', 'rehab', 'cardio'];
export const ULTIMO_RECURSO = 'último recurso';
// La explicación lleva el último recurso (y así el validador acepta menos de 3 principales, C-TIEMPO-2).
export const esUltimoRecurso = t => /\(último recurso\)|no caben tu cardio/.test(String(t));
const LUGAR_TXT = { gym: 'el gimnasio', casa: 'casa', calle: 'la calle', piscina: 'la piscina' };

// Por qué un ejercicio no vale hoy (null si vale).
function motivoNoVale(S, e, ctx) {
  if (!e.l.includes(ctx.lugar)) return `es de otro lugar (hoy entrenas en ${LUGAR_TXT[ctx.lugar] || ctx.lugar})`;
  if (!hayMaterial(e, ctx.lugar, S.perfil)) return 'no tienes el material';
  if ((S.perfil.gustos || {})[e.id] === 'rechazo') return 'no lo quieres';
  if (riesgo(e, ctx.niveles) === 'evitar') {
    const z = Object.keys(ctx.niveles).find(z => (e.r || {})[z]);
    return `carga tu ${nombreZona(z)}${ctx.bandas[z] ? `, que hoy está a ${ctx.bandas[z].dolor}/10` : ''}`;
  }
  if (ctx.salud.excluir.has(e.id)) return 'no va con tus datos de salud';
  return null;
}
// Alternativa del mismo músculo que sí vale hoy como principal (de su nivel si la hay).
function alternativa(S, ctx, e, excluir) {
  const mat = new Set(e.mat);
  const c = ctx.pool.filter(a => a.id !== e.id && !excluir.includes(a.id) && valePrincipal(S, a, ctx) && (a.m[0] === e.m[0] || e.m.includes(a.m[0])));
  const nivelOk = c.filter(a => a.niv <= ctx.nivel);
  return (nivelOk.length ? nivelOk : c)
    .map(a => ({ a, p: (a.m[0] === e.m[0] ? 10 : 0) + a.mat.filter(m => mat.has(m)).length * 3 + (a.t === e.t ? 2 : 0) - Math.abs(a.niv - e.niv) + (riesgo(a, ctx.niveles) === 'ok' ? 3 : 0) + ((S.perfil.gustos || {})[a.id] === 'gusta' ? 3 : 0) - ((S.perfil.gustos || {})[a.id] === 'nogusta' ? 4 : 0) }))
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
const maxSeries = (e, lugar) => (e.t === 'distancia' && lugar === 'piscina' ? 10 : 6);

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
    if (+x.series > maxSeries(e, ctx.lugar)) out.push(`${x.id}: ${x.series} series`);
    if (x.rol !== 'cardio' && !normalizarReps(e, x.reps)) out.push(`${x.id}: repeticiones «${x.reps}»`);
    if (x.kg != null && +x.kg > 0 && !conKg.has(x.id)) out.push(`${x.id}: kilos sin historial`);
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
  [...cal, ...vue].forEach(t => { if (t.id && ex(t.id) && !tareaOk(S, t.id, ctx)) out.push(`tarea ${t.id} no vale hoy`); });
  if (!alto && !suave) {
    const ultimo = (sesion.explicacion || []).some(esUltimoRecurso);
    const prin = ejs.filter(x => x.rol === 'principal').length;
    if (prin < 3 && !ultimo && !(ctx.energia === 1 && prin >= 1)) out.push(`${prin} principales`);
    zonasRehab(ctx).forEach(z => {
      if (candidatosRehab(S, z, ctx).length && !ejs.some(x => x.rol === 'rehab' && rehabValida(S, ex(x.id), z, ctx))) out.push(`sin rehabilitación de ${z}`);
    });
    if (tiempoSesionExacto(sesion) > ctx.minutos * 1.1 + 0.5 && !ultimo) out.push(`${Math.round(tiempoSesionExacto(sesion))} min para ${ctx.minutos}`);
  }
  return out;
}

// ── Validar y corregir ──
export function validarSesion(S, sesion, ctxIn = {}) {
  const lugar = ctxIn.lugar || sesion.lugar || S.perfil.lugares[0] || 'gym';
  const minutos = minutosSesion(ctxIn.minutos || sesion.minutos);
  const dolorHoy = ctxIn.dolorHoy || {};
  const ctx = contextoDia(S, { lugar, minutos, dolorHoy, energia: ctxIn.energia, futuro: ctxIn.futuro });
  const cambios = [];
  let s = copia(sesion);
  s.lugar = lugar; s.minutos = minutos;
  s.explicacion = Array.isArray(s.explicacion) ? s.explicacion : s.explicacion ? [String(s.explicacion)] : [];

  // 1. Día de dolor alto (C-DOLOR-4) o «solo suave» por datos de salud (C-SALUD-0): plantilla fija, sin IA.
  const alto = !ctx.futuro && maxDolorHoy(dolorHoy) >= 7;
  if (alto || ctx.salud.soloSuave) {
    if (s.tipo !== 'dolorAlto') {
      const base = diaDolorAlto(S, { lugar, minutos, dolorHoy }, { motivo: alto ? undefined : ctx.salud.soloSuave });
      s = { ...base, fuente: s.fuente && s.fuente !== 'ia' ? s.fuente : 'reglas' };
      cambios.push(alto ? 'con dolor de 7 o más hoy, la sesión es la del día de dolor alto' : 'por tus datos de salud, hoy solo cardio suave y movilidad');
    }
    return { sesion: s, cambios, valida: problemasSesion(S, s, { ...ctxIn, lugar, minutos, dolorHoy }).length === 0, ultimoRecurso: false };
  }

  const conKg = idsConKg(S);
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
    } else if (x.rol !== 'cardio' && esCardioValido(e, lugar) && !valePrincipal(S, e, ctx)) x.rol = 'cardio';
    // Rehabilitación: de una zona activa y sin riesgo en ella (C-DOSIS-1, C-ZONA-0).
    if (x.rol === 'rehab') {
      const z = Object.keys(ctx.bandas).find(z => rehabValida(S, e, z, ctx));
      if (z) x.zona = z;
      else if (valePrincipal(S, e, ctx) && !motivoNoVale(S, e, ctx)) { x.rol = 'principal'; cambios.push(`${nombre(e)} no es rehabilitación de ninguna zona activa hoy: va como principal`); }
      else { cambios.push(`quito ${nombre(e)} de la rehabilitación: ${motivoNoVale(S, e, ctx) || 'no es para tus zonas activas de hoy'}`); continue; }
    }
    // Lugar, material, rechazo, riesgo con el dolor de hoy y salud.
    const motivo = motivoNoVale(S, e, ctx);
    if (motivo) {
      const alt = x.rol === 'principal' ? alternativa(S, ctx, e, [...vistos, ...propuestos]) : null;
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
      if (e.niv > ctx.nivel && !(lugar === 'piscina' && S.perfil.nadar25 && ['crol', 'espalda'].includes(e.id))) {
        const alt = alternativa(S, ctx, e, [...vistos, ...propuestos]);
        if (alt && alt.niv <= ctx.nivel) { cambios.push(`cambio ${nombre(e)} por ${nombre(alt)}: es de un nivel más alto que el tuyo`); Object.assign(x, { id: alt.id, ...dosis(S, alt, nPrin(), lugar) }); delete x.kg; e = alt; }
      }
    }
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    ejs.push(x);
  }

  // 3. Rehabilitación de cada zona activa: al menos 1 por zona, como mucho 2.
  const rehab = ejs.filter(x => x.rol === 'rehab');
  zonasRehab(ctx).forEach(z => {
    const deZona = rehab.filter(x => x.zona === z);
    deZona.slice(2).forEach(x => { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: basta con 2 ejercicios para tu ${nombreZona(z)}`); });
    if (deZona.length) return;
    const c = candidatosRehab(S, z, ctx).filter(e => !ejs.some(y => y.id === e.id));
    if (!c.length) return;
    const nuevo = { ...ejercicioRehab(S, c[(ctxIn.k || 0) % c.length], z, ctx), zona: z };
    ejs.unshift(nuevo);
    cambios.push(`añado ${nombre(ex(nuevo.id))} para tu ${nombreZona(z)}`);
  });

  // 4. Cardio: uno, válido, con los minutos mínimos de D3 (nunca menos, C-CARDIO-2).
  const regla = reglaCardio(S, lugar, { minutos, energia: ctx.energia, bandas: ctx.bandas });
  const cardios = ejs.filter(x => x.rol === 'cardio');
  cardios.slice(1).forEach(x => { ejs.splice(ejs.indexOf(x), 1); });
  const cardio = cardios[0];
  if (!cardio) {
    const c = cardioDelDia(S, ctx, ctxIn.k || 0);
    if (c) { ejs.push(c); cambios.push(`añado ${minDe(c.reps)} min de cardio (${nombre(ex(c.id))}): toda sesión lleva cardio`); }
    else cambios.push('hoy no hay ningún cardio posible en este lugar con tu dolor');
  } else {
    const min = minDe(normalizarReps(ex(cardio.id), cardio.reps) || '');
    if (min < regla.minutos) { cardio.reps = `${regla.minutos} min`; if (min > 0) cambios.push(`el cardio sube de ${min} a ${regla.minutos} min: es el mínimo para tu objetivo`); }
    else cardio.reps = normalizarReps(ex(cardio.id), cardio.reps);
    cardio.series = 1; cardio.descanso = 0;
    const ref = cardioDelDia(S, ctx, 0);
    if (!cardio.nota && ref) cardio.nota = ref.nota.replace(/^\d+ min/, cardio.reps);
  }

  // 5. Principales: ≥ 3 (como mucho 3 con energía 1 y 4 con energía 2, C-ENERGIA-1); 2 con riesgo por zona.
  const maximo = ctx.energia === 1 ? 3 : ctx.energia === 2 ? 4 : 9;
  ejs.filter(x => x.rol === 'principal').slice(maximo).forEach(x => { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: hoy tienes poca energía`); });
  Object.keys(ctx.bandas).forEach(z => {
    ejs.filter(x => x.rol === 'principal' && (ex(x.id).r || {})[z]).slice(2).forEach(x => {
      const alt = alternativa(S, ctx, ex(x.id), ejs.map(y => y.id));
      if (alt && !(alt.r || {})[z]) { cambios.push(`cambio ${nombre(ex(x.id))} por ${nombre(alt)}: ya hay 2 ejercicios que implican tu ${nombreZona(z)}`); Object.assign(x, { id: alt.id, ...dosis(S, alt, 3, lugar) }); delete x.kg; }
      else { ejs.splice(ejs.indexOf(x), 1); cambios.push(`quito ${nombre(ex(x.id))}: ya hay 2 ejercicios que implican tu ${nombreZona(z)}`); }
    });
  });
  const faltan = s.explicacion.some(esUltimoRecurso) ? 0 : Math.min(3, maximo) - nPrin();
  if (faltan > 0) {
    const tipo = tipoParaLugar(ctxIn.tipo || s.tipo, lugar);
    const nuevos = elegirPrincipales(S, ctx, { huecos: PLANTILLAS[tipo].huecos, presupuesto: Infinity, k: ctxIn.k || 0, excluir: ejs.map(x => x.id), maximo: faltan });
    nuevos.forEach(e => {
      const i = nPrin(), d = dosis(S, e, i, lugar);
      ejs.push({ id: e.id, rol: 'principal', ...d, nota: porQueEjercicio(S, e, { i, d, an: ctx.an, carga: {}, niveles: ctx.niveles, dolorHoy }) });
    });
    if (nuevos.length) cambios.push(`añado ${lista(nuevos.map(nombre))}: toda sesión lleva al menos 3 ejercicios principales`);
  }
  // Orden: rehabilitación → principales (el primero sin riesgo en una zona activa) → cardio (C-REP-5, C-DOSIS-4).
  const orden = { rehab: 0, principal: 1, cardio: 2 };
  ejs.sort((a, b) => orden[a.rol] - orden[b.rol]);
  const pi = ejs.findIndex(x => x.rol === 'principal'), ok = ejs.findIndex(x => x.rol === 'principal' && riesgo(ex(x.id), ctx.niveles) === 'ok');
  if (pi >= 0 && ok > pi) ejs.splice(pi, 0, ejs.splice(ok, 1)[0]);

  // 6. Dosis.
  let iPrin = 0;
  // Contexto del check-in para el tope de kilos de la progresión (C-PROG-5, PR 10).
  const ctxKg = { energia: ctx.energia, dolorHoy, niveles: ctx.niveles, carga: ctx.futuro ? {} : cargaMuscular(S) };
  ejs.forEach(x => {
    const e = ex(x.id);
    const i = x.rol === 'principal' ? iPrin++ : 0;
    const max = maxSeries(e, lugar);
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
      const tipo = tipoEj(e), rg = rango(x.reps);
      const minReps = AISLA_HOMBRO.includes(e.id) ? 12 : 8;
      if (x.rol === 'principal' && tipo === 'aislamiento' && rg && rg.u === '' && rg.lo < minReps) {
        const nuevo = minReps === 12 ? '12-15' : '10-12';
        cambios.push(`${nombre(e)} a ${nuevo} repeticiones: un aislamiento no baja de ${minReps}`);
        x.reps = nuevo + (rg.resto || '');
      }
      const desc = Math.round(+x.descanso);
      x.descanso = desc >= 0 && desc <= 300 ? desc : x.rol === 'principal' ? dosis(S, e, i, lugar).descanso : e.d[2];
      const pm = x.rol === 'principal' ? pausaMinima(tipo, (rango(x.reps) || {}).lo) : 0;
      if (x.descanso < pm) x.descanso = pm;
    }
    // Kilos: nulos sin historial (C-PROG-1); con historial, el tope de la progresión (C-PROG-5, PR 10).
    if (x.kg != null && +x.kg > 0) {
      if (!conKg.has(x.id)) { cambios.push(`${nombre(e)} sin kilos: es la primera vez, elige un peso con el que te sobren 3 repeticiones`); delete x.kg; }
      else x.kg = acotarKg(S, x.id, +x.kg, ctxKg);
    } else delete x.kg; // sin kilos: el campo no va (forma del plan); crearSesion lo deja en null
    if (x.kg == null) delete x.kg;
    delete x.zona;
  });

  // 7. Calentamiento y vuelta a la calma: tareas válidas, ≥ 2 tareas y un estiramiento en la vuelta.
  const principales = () => ejs.filter(x => x.rol === 'principal').map(x => ex(x.id));
  const tareaValida = t => t && typeof t === 'object' && (t.nombre || (t.id && ex(t.id)));
  const limpiar = (l, donde) => (Array.isArray(l) ? l : []).filter(tareaValida).filter(t => {
    if (t.id && ex(t.id) && !tareaOk(S, t.id, ctx)) { cambios.push(`quito ${nombre(ex(t.id))} ${donde}: ${motivoNoVale(S, ex(t.id), ctx) || 'no se hace en este lugar'}`); return false; }
    return true;
  }).map(t => ({ ...t, nombre: t.nombre || ex(t.id).n }));
  s.calentamiento = limpiar(s.calentamiento, 'del calentamiento');
  if (s.calentamiento.length < 2) { s.calentamiento = calentamientoDe(S, ctx, principales()); cambios.push('añado el calentamiento, que siempre va'); }
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
  s.ejercicios = ejs;

  // 8. Tiempo ≤ pedido + 10 % (C-TIEMPO-1, C-TIEMPO-2).
  const ultimo = ajustarTiempo(S, s, ctx, cambios);
  if (ultimo) s.explicacion.splice(1, 0, ultimo);
  const valida = problemasSesion(S, s, { ...ctxIn, lugar, minutos, dolorHoy }).length === 0;
  return { sesion: s, cambios, valida, ultimoRecurso: !!ultimo };
}

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
  zonas.forEach(z => { while (T() > limite && deZona(z).length > 1) { const x = deZona(z).pop(); s.ejercicios.splice(s.ejercicios.indexOf(x), 1); } });
  zonas.slice().reverse().forEach(z => { if (T() > limite && ctx.bandas[z].banda <= 1) deZona(z).forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1)); });
  // 5. Calentamiento a 4 min y vuelta a 3.
  if (T() > limite) {
    s.calentamiento = calentamientoDe(S, ctx, prin().map(x => ex(x.id)), { total: 4 });
    s.vuelta = vueltaDe(S, ctx, prin().map(x => ex(x.id)), { total: 3 });
    cambios.push('calentamiento de 4 minutos y vuelta a la calma de 3');
  }
  if (T() <= limite) return null;
  // 6. Último recurso: 2 principales en superserie de 2 series (decisión 8, C-TIEMPO-3).
  prin().slice(2).forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1));
  const dos = prin();
  if (dos.length === 2) {
    dos.forEach(x => { x.series = 2; delete x.superserie; });
    dos[0].superserie = true; dos[0].descanso = 0;
    dos[1].descanso = 60; // entre parejas, como en el cálculo de C-TIEMPO-4
    dos[0].nota = `En superserie con ${nombre(ex(dos[1].id))}: una serie de cada uno seguidas y descansa ${dos[1].descanso} s. ${dos[0].nota || ''}`.slice(0, 300);
    s.ejercicios.splice(s.ejercicios.indexOf(dos[1]), 1);
    s.ejercicios.splice(s.ejercicios.indexOf(dos[0]) + 1, 0, dos[1]);
  }
  if (T() <= limite) return `Por tiempo (${ULTIMO_RECURSO}): con ${ctx.minutos} minutos caben tu cardio, lo de tu lesión y 2 ejercicios principales en superserie.`;
  // 7. Sin fuerza ese día: cardio mínimo y rehabilitación, con el aviso.
  prin().forEach(x => s.ejercicios.splice(s.ejercicios.indexOf(x), 1));
  const c = s.ejercicios.find(x => x.rol === 'cardio');
  const zs = zonas.filter(z => deZona(z).length);
  return `Con ${ctx.minutos} minutos no caben tu cardio de ${c ? minDe(c.reps) : 0} minutos, el trabajo de tu ${lista(zs.map(nombreZona)) || 'lesión'} y fuerza. Hoy: cardio y rehabilitación. Si quieres fuerza, elige ${ctx.minutos + 15} minutos.`;
}
