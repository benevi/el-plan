// Buscador del catálogo: texto (sin tildes) y filtros en fila de chips. Lo usan la pantalla Ejercicios
// (lugar, músculo y valoración) y el editor de «Mis sesiones» (músculo, lugar y material).
// Cada fila es un grupo de chips con aria-pressed; «Todos…» quita ese filtro.

import { h } from '../../nucleo/ui.js';
import { EJERCICIOS } from '../../reglas/catalogo.js';
import { MUSCULOS, MATERIAL, LUGARES, GUSTOS } from '../../datos/constantes.js';
import { chip, listaY } from '../perfil/controles.js';

export const sinTilde = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const filtroVacio = () => ({ texto: '', musculo: '', lugar: '', material: '', gusto: '' });

export function filtrarEjercicios(S, f) {
  const t = sinTilde(f.texto).trim();
  const gustos = (S.perfil && S.perfil.gustos) || {};
  return EJERCICIOS.filter(e => (!t || sinTilde(e.n).includes(t))
    && (!f.musculo || e.m.includes(f.musculo))
    && (!f.lugar || e.l.includes(f.lugar))
    && (!f.material || e.mat.includes(f.material))
    && (!f.gusto || gustos[e.id] === f.gusto));
}

const MUSCULOS_USADOS = () => { const u = new Set(EJERCICIOS.flatMap(e => e.m)); return Object.entries(MUSCULOS).filter(([k]) => u.has(k)); };
const MATERIAL_USADO = () => { const u = new Set(EJERCICIOS.flatMap(e => e.mat)); return Object.entries(MATERIAL).filter(([k]) => u.has(k)); };
const FILAS = {
  lugar: ['Todos los lugares', () => Object.entries(LUGARES)],
  musculo: ['Todos los músculos', MUSCULOS_USADOS],
  material: ['Todo el material', MATERIAL_USADO],
  gusto: ['Todas las valoraciones', S => Object.entries(GUSTOS).filter(([k]) => Object.values(S.perfil.gustos || {}).includes(k)).map(([k, g]) => [k, g.nombre])],
};
// Una fila de filtros: «Todos…» y cada opción. `act` recibe data-k (filtro) y data-v (valor).
export function filaFiltro(S, f, k, act) {
  const [todos, ops] = FILAS[k];
  const opciones = ops(S);
  if (!opciones.length) return '';
  return `<div class="chips chips--fila" role="group" aria-label="${h(todos.replace(/^Tod[oa]s? (los |las |el )?/, 'Filtrar por '))}">
    ${chip(act, '', !f[k], todos, `data-k="${k}"`)}${opciones.map(([v, n]) => chip(act, v, f[k] === v, n, `data-k="${k}"`)).join('')}</div>`;
}

// Línea de datos de un ejercicio: «Pecho y tríceps; mancuernas y banco».
export const datosEjercicio = e => `${listaY(e.m.map(m => MUSCULOS[m] || m))}; ${listaY(e.mat.map((m, i) => { const t = MATERIAL[m] || m; return i ? t.toLowerCase() : t; }))}`;

// Pone un chip de una fila como elegido sin repintar (el foco se queda en él).
export function marcarEnFila(boton) {
  const fila = boton.closest('[role="group"]');
  if (!fila) return;
  for (const c of fila.querySelectorAll('.chip')) { const si = c === boton; c.setAttribute('aria-pressed', String(si)); c.classList.toggle('on', si); }
}
