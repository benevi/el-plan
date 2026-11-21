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
// Al cambiar de pantalla (PR 13): se cierra la hoja abierta, la pantalla anterior sale y la nueva entra
// (js/aspecto/movimiento.js) y el foco va a su <h1> para que el lector de pantalla y el teclado empiecen
// por arriba. Al volver a la app con otro día, Hoy se repinta.

import { $, h, ICONOS, cerrarHoja, hayHojaAbierta, trasHistorial, reusarEntradaDeHoja } from './ui.js';
import { hoyISO } from './estado.js';
import { cambioDePantalla } from '../aspecto/movimiento.js';

const RUTAS = {};
const ACCIONES = {};
const PESTAÑAS = [];
let actual = { ruta: '', params: [] };
let diaPintado = '';
const guardias = [];

export function rutas(obj) { Object.assign(RUTAS, obj); }
export function acciones(obj) {
  for (const k of Object.keys(obj)) {
    if (ACCIONES[k]) console.warn('Acción repetida', k);
    ACCIONES[k] = obj[k];
  }
}
export function pestaña(p) { PESTAÑAS.push(p); PESTAÑAS.sort((a, b) => a.orden - b.orden); }
// Funciones que deciden a dónde ir antes que nada (p. ej. rescatar datos ilegibles o elegir dueño la primera vez).
// Se miran en el orden en que se registran; manda la primera que devuelva una ruta.
export function antesDeCadaRuta(fn) { guardias.push(fn); }

export const rutaActual = () => actual;
// Va a otra pantalla. Si hay una hoja abierta, primero se cierra (y se quita su entrada del historial).
export function ir(ruta) {
  const destino = String(ruta).split('/')[0];
  if (hayHojaAbierta() && destino !== actual.ruta) cerrarHoja();
  const reusada = reusarEntradaDeHoja('#' + ruta);
  if (reusada) { if (reusada === 'mismo') pintar(); return; }
  trasHistorial(() => { if (location.hash === '#' + ruta) pintar(); else location.hash = ruta; });
}

// Un hash mal formado (p. ej. «%E0%A4%A») no puede dejar la app en blanco: se lee tal cual.
function leer() {
  const crudo = location.hash.slice(1);
  let texto = crudo;
  try { texto = decodeURIComponent(crudo); } catch { /* se queda como viene */ }
  const [ruta, ...params] = texto.split('/');
  return { ruta: ruta || 'hoy', params };
}

// Orden de las pantallas para el sentido del cambio (adelante / atrás).
function orden(ruta) {
  const def = RUTAS[ruta];
  const p = PESTAÑAS.find(x => x.ruta === ruta || x.ruta === (def && def.pestaña));
  return p ? p.orden + (p.ruta === ruta ? 0 : 5) : 100;
}

export function pintar() {
  let r = { ruta: 'hoy', params: [] };
  let def = RUTAS.hoy;
  try {
    r = leer();
    let desvio = null;
    for (const g of guardias) { desvio = g(r); if (desvio) break; }
    if (desvio && desvio !== r.ruta) { r = { ruta: desvio, params: [] }; }
    def = RUTAS[r.ruta] || RUTAS.hoy;
  } catch (e) { console.error(e); }
  const antes = actual;
  const cambia = r.ruta !== antes.ruta || r.params.join('/') !== antes.params.join('/');
  const nuevaPantalla = cambia && !!antes.ruta;
  // La hoja de otra pantalla no se queda encima de esta (E8); su entrada del historial ya no es la última.
  if (cambia && hayHojaAbierta()) cerrarHoja({ historial: false });
  actual = r;
  const main = $('#vista');
  const scroll = cambia ? 0 : window.scrollY;
  const terminar = nuevaPantalla && r.ruta !== antes.ruta ? cambioDePantalla(main, orden(r.ruta) >= orden(antes.ruta) ? 'adelante' : 'atras') : null;
  try {
    main.innerHTML = def.vista(r.params);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="tarjeta"><h1 class="titulo">Algo ha fallado</h1><p>No se ha podido pintar esta pantalla. Prueba a volver a Hoy.</p><p class="tenue">${h(e.message)}</p></div>`;
  }
  // Antes de cualquier lectura de estilos (scroll, foco, transición): si no, una barra con transición
  // arrancaría desde 0 en cada repintado esperando al observador.
  aplicarVariables(main);
  diaPintado = hoyISO();
  document.title = (def.titulo ? def.titulo + ' · ' : '') + 'Pipos Fitness';
  document.body.classList.toggle('sin-nav', !!def.sinNav);
  pintarNav(r.ruta);
  if (def.montar) { try { def.montar(main, r.params); } catch (e) { console.error(e); } }
  if (terminar) terminar();
  window.scrollTo(0, scroll);
  // Foco al título de la pantalla nueva (no en el primer pintado ni en los repintados).
  if (nuevaPantalla && !hayHojaAbierta()) {
    const t = main.querySelector('h1') || main;
    if (t !== main && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch { /* sin foco */ }
  }
}

// Pinta en memoria (sin tocar la página) todas las pantallas con el estado actual y lanza si alguna falla.
// Sirve para probar una copia antes de cargarla (estado.importar). Cada ruta puede dar `probar()` para
// pintar sus variantes (todas las partes del perfil, cada sesión…); si no, se pinta su vista sin parámetros.
// No se prueban las pantallas de rescate ni de bienvenida (no dependen de los datos).
export function probarPantallas() {
  for (const [nombre, def] of Object.entries(RUTAS)) {
    if (nombre === 'rescate' || nombre === 'bienvenida') continue;
    try {
      if (def.probar) def.probar(); else def.vista([]);
    } catch (e) { throw new Error(`pantalla «${nombre}»: ${e.message}`, { cause: e }); }
  }
}

function pintarNav(ruta) {
  const nav = $('#nav');
  const activa = (RUTAS[ruta] && RUTAS[ruta].pestaña) || ruta;
  nav.innerHTML = PESTAÑAS.map(p => `<a href="#${p.ruta}" class="pestana"${p.ruta === activa ? ' aria-current="page"' : ''}>${p.icono || ICONOS.hoy}<span>${h(p.nombre)}</span></a>`).join('');
}

// Al volver a la app (desbloquear el móvil, cambiar de app): si ha cambiado el día, Hoy se repinta.
function alVolver() {
  if (document.hidden) return;
  if (actual.ruta === 'hoy' && diaPintado && hoyISO() !== diaPintado && !hayHojaAbierta()) pintar();
}

export function arrancar() {
  window.addEventListener('hashchange', pintar);
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('pageshow', alVolver);
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
  // Eco de un deslizador: <input type="range" data-eco="id"> escribe su valor en #id mientras se mueve
  // (sustituye a los oninput en línea; prepara la CSP del PR 17).
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el || !el.dataset || !el.dataset.eco) return;
    const destino = document.getElementById(el.dataset.eco);
    if (destino) destino.textContent = el.value;
  });
  // Elegir uno de un grupo de chips sin acción propia: <div class="chips" data-elige-uno> (la lesión, «Qué es»).
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-elige-uno] > .chip');
    if (!chip) return;
    for (const c of chip.parentNode.children) { c.classList.toggle('on', c === chip); c.setAttribute('aria-pressed', String(c === chip)); }
  });
  // Una imagen que no carga (miniaturas de ejercicios) se quita si lo pide: <img data-quitar-si-falla>.
  document.addEventListener('error', e => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.hasAttribute('data-quitar-si-falla')) el.remove();
  }, true);
  // Variables de CSS que dependen de los datos (avance, rodillo de cifras): <i data-var="--v:0.5">.
  // Con la CSP (PR 17) no hay atributos style en las plantillas; se ponen por CSSOM al entrar en la página.
  aplicarVariables(document.body);
  const Observador = globalThis.MutationObserver || (document.defaultView && document.defaultView.MutationObserver);
  if (Observador) new Observador(cambios => {
    for (const c of cambios) for (const n of c.addedNodes) if (n.nodeType === 1) aplicarVariables(n);
  }).observe(document.body, { childList: true, subtree: true });
  pintar();
}

// Solo propiedades personalizadas (--algo) con valores numéricos: nada que venga de un texto libre.
export function aplicarVariables(raiz) {
  const els = raiz.matches && raiz.matches('[data-var]') ? [raiz, ...raiz.querySelectorAll('[data-var]')] : raiz.querySelectorAll('[data-var]');
  for (const el of els) {
    for (const par of el.dataset.var.split(';')) {
      const m = /^\s*(--[a-z][\w-]*)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/i.exec(par);
      if (m) el.style.setProperty(m[1], m[2]);
    }
  }
}
