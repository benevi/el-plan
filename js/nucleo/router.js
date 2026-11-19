// Navegación por #ruta y botones con data-act.
//
// Cada área registra sus pantallas y acciones al cargarse:
//
//   rutas({ 'sesion': { titulo: 'Sesión', vista: (params) => html, montar: (raiz, params) => {}, sinNav: true } })
//   acciones({ 'sesion.serie': (el, evento) => {...} })
//   pestaña({ ruta: 'hoy', nombre: 'Hoy', icono: ICONOS.hoy, orden: 10 })
//
// - #sesion/abc → ruta 'sesion', params ['abc'].
// - Un botón <button data-act="sesion.serie" data-x="..."> llama a la acción con el propio botón.
//   Para inputs y selects se usa data-cambio="area.accion" (se dispara en 'change').
// - pintar() vuelve a dibujar la pantalla actual (las áreas lo llaman tras cambiar datos).

import { $, h, ICONOS } from './ui.js';

const RUTAS = {};
const ACCIONES = {};
const PESTAÑAS = [];
let actual = { ruta: '', params: [] };
let guardia = null;

export function rutas(obj) { Object.assign(RUTAS, obj); }
export function acciones(obj) {
  for (const k of Object.keys(obj)) {
    if (ACCIONES[k]) console.warn('Acción repetida', k);
    ACCIONES[k] = obj[k];
  }
}
export function pestaña(p) { PESTAÑAS.push(p); PESTAÑAS.sort((a, b) => a.orden - b.orden); }
// Una función que decide a dónde ir antes que nada (p. ej. elegir dueño la primera vez).
export function antesDeCadaRuta(fn) { guardia = fn; }

export const rutaActual = () => actual;
export function ir(ruta) { if (location.hash === '#' + ruta) pintar(); else location.hash = ruta; }

function leer() {
  const [ruta, ...params] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { ruta: ruta || 'hoy', params };
}

export function pintar() {
  let r = leer();
  const desvio = guardia && guardia(r);
  if (desvio && desvio !== r.ruta) { r = { ruta: desvio, params: [] }; }
  const def = RUTAS[r.ruta] || RUTAS.hoy;
  const cambia = r.ruta !== actual.ruta || r.params.join('/') !== actual.params.join('/');
  actual = r;
  const main = $('#vista');
  const scroll = cambia ? 0 : window.scrollY;
  try {
    main.innerHTML = def.vista(r.params);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="tarjeta"><b>Algo ha fallado al pintar esta pantalla.</b><p class="tenue">${h(e.message)}</p></div>`;
  }
  document.title = (def.titulo ? def.titulo + ' · ' : '') + 'Pipos Fitness';
  document.body.classList.toggle('sin-nav', !!def.sinNav);
  pintarNav(r.ruta);
  if (def.montar) { try { def.montar(main, r.params); } catch (e) { console.error(e); } }
  window.scrollTo(0, scroll);
}

function pintarNav(ruta) {
  const nav = $('#nav');
  const activa = (RUTAS[ruta] && RUTAS[ruta].pestaña) || ruta;
  nav.innerHTML = PESTAÑAS.map(p => `<a href="#${p.ruta}" class="${p.ruta === activa ? 'activa' : ''}" ${p.ruta === activa ? 'aria-current="page"' : ''}>${p.icono || ICONOS.hoy}<span>${h(p.nombre)}</span></a>`).join('');
}

export function arrancar() {
  window.addEventListener('hashchange', pintar);
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACCIONES[el.dataset.act];
    if (!fn) { console.warn('Acción sin registrar', el.dataset.act); return; }
    e.preventDefault();
    try { const r = fn(el, e); if (r && r.catch) r.catch(err => console.error(err)); } catch (err) { console.error(err); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-cambio]');
    if (!el) return;
    const fn = ACCIONES[el.dataset.cambio];
    if (fn) { try { fn(el, e); } catch (err) { console.error(err); } }
  });
  pintar();
}
