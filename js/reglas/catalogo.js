// Catálogo y filtros de seguridad: qué ejercicios puede hacer cada persona hoy según sus lesiones,
// el dolor que tenga, el lugar, el material de casa y lo que ha rechazado.

import { EJERCICIOS } from '../datos/ejercicios.js';
import { ZONAS } from '../datos/lesiones.js';
// Rehabilitación por fases, detalle de la lesión, techo de dolor y notas (docs/criterio.md, sección 12).
export { fasesDe, rehabPorFase, rehabDeFase, dosisRehab, detalleDe, riesgoDetalle, techoDolor, notaRehab } from '../datos/lesiones.js';
import { riesgoDetalle } from '../datos/lesiones.js';

const POR_ID = Object.fromEntries(EJERCICIOS.map(e => [e.id, e]));
export const ex = id => POR_ID[id] || null;
export { EJERCICIOS, ZONAS };

// ── Bandas de dolor por zona (C-DOLOR-0, C-DOLOR-1, C-LES-1, C-LES-2, C-LES-3): la ÚNICA regla ──
// La usan el validador, las reglas, «Cambiar por otro», el catálogo que se manda a la IA y las pantallas.
// Devuelve { zona: { dolor, banda 0-3, nueva, sinLesion, ficha, lesion } } para cada zona activa: lesión
// activa del perfil o zona con dolor ≥ 1 hoy. La sesión del día usa el dolor de hoy; si hoy no se dice, el
// de ficha con tope 6 (igual que el plan semanal y las lesiones con el dolor por revisar): B3 solo sale del
// dolor de hoy ≥ 7.
const SEMANA = 7 * 864e5;
export function faseLesion(l) {
  if (!l || l.tipo === 'puntual') return 'nueva';
  if (l.tipo === 'recurrente') return 'cronica';
  const desde = l.desde ? new Date(l.desde) : null;
  if (!desde || Number.isNaN(+desde)) return 'nueva'; // sin `desde`: lo prudente (C-LES-6)
  const sem = (Date.now() - desde) / SEMANA;
  return sem < 6 ? 'nueva' : sem <= 12 ? 'subaguda' : 'cronica';
}
export const bandaDe = d => (d >= 7 ? 3 : d >= 4 ? 2 : d >= 1 ? 1 : 0);
export function bandasZonas(perfil, dolorHoy = {}, { plan = false } = {}) {
  const out = {};
  ((perfil || {}).lesiones || []).filter(l => l.activa).forEach(l => {
    const hoy = !plan && dolorHoy && dolorHoy[l.zona] != null && dolorHoy[l.zona] !== '' ? +dolorHoy[l.zona] : null;
    const dolor = hoy != null ? hoy : Math.min(6, +l.dolor || 0);
    if (out[l.zona] && out[l.zona].dolor >= dolor) return;
    out[l.zona] = { dolor, banda: bandaDe(dolor), nueva: faseLesion(l) === 'nueva', sinLesion: false, ficha: +l.dolor || 0, lesion: l };
  });
  if (!plan) {
    Object.entries(dolorHoy || {}).forEach(([z, v]) => {
      const d = +v; if (!(d >= 1) || out[z]) return;
      out[z] = { dolor: d, banda: bandaDe(d), nueva: true, sinLesion: true, ficha: null, lesion: null };
    });
  }
  // Lesión nueva (o dolor sin lesión registrada): de 2 a 6 se trata como B2 (C-LES-2, C-LES-3).
  Object.values(out).forEach(b => { if (b.nueva && b.banda === 1 && b.dolor >= 2) b.banda = 2; });
  return out;
}
// Niveles para riesgo(): B0 se vigila como B1 (fuera r=2), B1 → 1, B2 → 2, B3 → 3.
export const nivelesDe = bandas => Object.fromEntries(Object.entries(bandas).map(([z, b]) => [z, Math.max(1, b.banda)]));
// Nivel de cuidado de cada zona hoy (1 cuidado · 2 cambiar lo que la carga · 3 parar), de las mismas bandas.
export const nivelesZona = (perfil, dolorHoy = {}, op = {}) => nivelesDe(bandasZonas(perfil, dolorHoy, op));

// Riesgo de hoy ('ok' · 'precaucion' · 'evitar') con el detalle de cada lesión (C-ZONA-SUB; sin detalle, el de
// por defecto, que es el más prudente). bandas: las de bandasZonas (para saber el detalle de cada lesión).
export function riesgoHoy(e, niveles, bandas = {}) {
  let peor = 'ok';
  for (const [z, n] of Object.entries(niveles || {})) {
    const r = riesgoDetalle(e, z, ((bandas[z] || {}).lesion || {}).detalle);
    if (!r || !n) continue;
    if (r === 2 || (r === 1 && n >= 2)) return 'evitar';
    peor = 'precaucion';
  }
  return peor;
}
// 'ok' · 'precaucion' · 'evitar' (la misma regla que riesgoHoy).
export const riesgo = (e, niveles, bandas) => riesgoHoy(e, niveles, bandas);
export const zonasRiesgo = (e, niveles, bandas = {}) => Object.keys(niveles || {}).filter(z => riesgoDetalle(e, z, ((bandas[z] || {}).lesion || {}).detalle));

// ¿Hay material para hacerlo en este lugar? El gimnasio y la piscina del centro lo tienen todo.
export function hayMaterial(e, lugar, perfil) {
  if (lugar === 'gym' || lugar === 'piscina') return true;
  return e.mat.some(m => m === 'peso corporal' || (perfil.materialCasa || []).includes(m));
}

// Ejercicios posibles hoy en ese lugar: seguros para sus lesiones, con material, a su nivel y no rechazados.
// permitido (opcional): la regla completa del validador (permitidoBase de entrenador/dia.js, con los datos de
// salud); con ella manda solo esa regla, así «Cambiar por otro» ofrece lo mismo que acepta el validador.
export function disponibles(perfil, lugar, { dolorHoy = {}, nivelMax, permitido } = {}) {
  const tope = nivelMax || Math.min(3, (perfil.nivel || 1) + 1);
  if (permitido) return EJERCICIOS.filter(e => e.niv <= tope && permitido(e));
  const bandas = bandasZonas(perfil, dolorHoy), niveles = nivelesDe(bandas);
  return EJERCICIOS.filter(e => e.l.includes(lugar) && riesgoHoy(e, niveles, bandas) !== 'evitar' && hayMaterial(e, lugar, perfil) &&
    e.niv <= tope && (perfil.gustos || {})[e.id] !== 'rechazo');
}

// Alternativa segura para cambiar un ejercicio (mismo músculo, material parecido, mismo tipo).
// Un ejercicio de dosis propia (rehabilitación, movilidad…) solo sustituye a uno de fuerza si no hay otro.
export const puntosTipo = (e, orig) => (e.tipo === orig.tipo ? 4 : 0) - (e.tipo === 'propia' && orig.tipo !== 'propia' ? 8 : 0);
// nivel: tope de nivel para un principal (C-DOSIS-10: niv ≤ nivel; si no hay ninguno, los de menor nivel).
// Sin él (una de «Mis sesiones», C-MIA-2), hasta un nivel más, como hasta ahora.
export function alternativas(orig, lugar, perfil, { excluir = [], dolorHoy = {}, nivel = null, permitido } = {}) {
  const mat = new Set(orig.mat);
  let cand = disponibles(perfil, lugar, { dolorHoy, permitido }).filter(e => e.id !== orig.id && !excluir.includes(e.id) && (e.m[0] === orig.m[0] || orig.m.includes(e.m[0])));
  if (nivel != null && cand.length) {
    const ok = cand.filter(e => e.niv <= nivel);
    cand = ok.length ? ok : cand.filter(e => e.niv === Math.min(...cand.map(x => x.niv)));
  }
  return cand
    .map(e => ({ e, p: (e.m[0] === orig.m[0] ? 10 : 0) + e.mat.filter(m => mat.has(m)).length * 3 + (e.t === orig.t ? 2 : 0) + puntosTipo(e, orig) - Math.abs(e.niv - orig.niv) + ((perfil.gustos || {})[e.id] === 'gusta' ? 3 : 0) - ((perfil.gustos || {})[e.id] === 'nogusta' ? 4 : 0) }))
    .sort((a, b) => b.p - a.p).map(x => x.e);
}
