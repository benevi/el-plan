// Catálogo y filtros de seguridad: qué ejercicios puede hacer cada persona hoy según sus lesiones,
// el dolor que tenga, el lugar, el material de casa y lo que ha rechazado.

import { EJERCICIOS } from '../datos/ejercicios.js';
import { ZONAS } from '../datos/lesiones.js';
// Rehabilitación por fases, detalle de la lesión, techo de dolor y notas (docs/criterio.md, sección 12).
export { fasesDe, rehabPorFase, detalleDe, riesgoDetalle, techoDolor, notaRehab } from '../datos/lesiones.js';

const POR_ID = Object.fromEntries(EJERCICIOS.map(e => [e.id, e]));
export const ex = id => POR_ID[id] || null;
export { EJERCICIOS, ZONAS };

// Nivel de cuidado de cada zona hoy (0 nada · 1 cuidado · 2 cambiar lo que la carga · 3 parar).
// Sale de las lesiones activas del perfil (dolor 0-10) y del dolor que diga hoy en el check-in.
export const nivelDolor = n => n >= 7 ? 3 : n >= 4 ? 2 : n >= 1 ? 1 : 0;
export function nivelesZona(perfil, dolorHoy = {}) {
  const z = {};
  (perfil.lesiones || []).filter(l => l.activa).forEach(l => { z[l.zona] = Math.max(z[l.zona] || 0, Math.max(1, nivelDolor(+l.dolor || 0))); });
  Object.entries(dolorHoy || {}).forEach(([k, v]) => { const n = nivelDolor(+v); if (n) z[k] = Math.max(z[k] || 0, n); });
  return z;
}

// 'ok' · 'precaucion' · 'evitar'
export function riesgo(e, niveles) {
  let peor = 'ok';
  for (const [zona, nivel] of Object.entries(niveles)) {
    const r = (e.r || {})[zona];
    if (!r || !nivel) continue;
    if (r === 2 || (r === 1 && nivel >= 2)) return 'evitar';
    peor = 'precaucion';
  }
  return peor;
}
export const zonasRiesgo = (e, niveles) => Object.keys(e.r || {}).filter(z => niveles[z]);

// ¿Hay material para hacerlo en este lugar? El gimnasio y la piscina del centro lo tienen todo.
export function hayMaterial(e, lugar, perfil) {
  if (lugar === 'gym' || lugar === 'piscina') return true;
  return e.mat.some(m => m === 'peso corporal' || (perfil.materialCasa || []).includes(m));
}

// Ejercicios posibles hoy en ese lugar: seguros para sus lesiones, con material, a su nivel y no rechazados.
export function disponibles(perfil, lugar, { dolorHoy = {}, nivelMax } = {}) {
  const niveles = nivelesZona(perfil, dolorHoy);
  const tope = nivelMax || Math.min(3, (perfil.nivel || 1) + 1);
  return EJERCICIOS.filter(e => e.l.includes(lugar) && riesgo(e, niveles) !== 'evitar' && hayMaterial(e, lugar, perfil) &&
    e.niv <= tope && (perfil.gustos || {})[e.id] !== 'rechazo');
}

// Alternativa segura para cambiar un ejercicio (mismo músculo, material parecido, mismo tipo).
// Un ejercicio de dosis propia (rehabilitación, movilidad…) solo sustituye a uno de fuerza si no hay otro.
const puntosTipo = (e, orig) => (e.tipo === orig.tipo ? 4 : 0) - (e.tipo === 'propia' && orig.tipo !== 'propia' ? 8 : 0);
export function alternativas(orig, lugar, perfil, { excluir = [], dolorHoy = {} } = {}) {
  const mat = new Set(orig.mat);
  return disponibles(perfil, lugar, { dolorHoy }).filter(e => e.id !== orig.id && !excluir.includes(e.id) && (e.m[0] === orig.m[0] || orig.m.includes(e.m[0])))
    .map(e => ({ e, p: (e.m[0] === orig.m[0] ? 10 : 0) + e.mat.filter(m => mat.has(m)).length * 3 + (e.t === orig.t ? 2 : 0) + puntosTipo(e, orig) - Math.abs(e.niv - orig.niv) + ((perfil.gustos || {})[e.id] === 'gusta' ? 3 : 0) - ((perfil.gustos || {})[e.id] === 'nogusta' ? 4 : 0) }))
    .sort((a, b) => b.p - a.p).map(x => x.e);
}
