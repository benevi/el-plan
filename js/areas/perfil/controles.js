// Controles del sistema (DIS 3) para Perfil, Progreso, Ejercicios y el editor de «Mis sesiones» (PR 16):
// - chip(): botón con aria-pressed (varios a la vez o un filtro), con la marca ✓ del sistema;
// - segmento(): grupo de opción única (radiogroup): un solo Tab, flechas, Inicio y Fin;
// - selector(): selector ± (spinbutton) sin teclado del móvil: flechas, Re Pág/Av Pág, Inicio y Fin; puede ir
//   por números (min, max, paso) o por una lista de valores («8-12», «10-15»…);
// - el foco vuelve al mismo control cuando la pantalla se repinta tras tocarlo (con el teclado no se pierde).
// Solo aspecto y manejo: lo que cambia cada control lo decide su área con acciones normales del router.

import { acciones } from '../../nucleo/router.js';
import { h, ICONOS, es } from '../../nucleo/ui.js';

// Iconos que estas pantallas necesitan y el marco aún no tenía (mismo trazo que ICONOS de ui.js).
const svg = d => `<svg class="icono" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICONOS16 = {
  buscar: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  subir: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  bajar: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
};

export const chip = (act, v, on, txt, extra = '') =>
  `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on ? 'true' : 'false'}" data-act="${h(act)}" data-v="${h(v)}" ${extra}>${ICONOS.check}<span>${h(txt)}</span></button>`;

// opciones: [[valor, texto, etiquetaLarga?]]. `grupo` da nombre estable para devolver el foco tras repintar.
export function segmento(nombre, act, opciones, actual, { ancho = false, rejilla = false, grupo = act, extra = '' } = {}) {
  const sel = opciones.some(([v]) => String(v) === String(actual)) ? String(actual) : null;
  return `<div class="segmento${ancho ? ' segmento--ancho' : ''}${rejilla ? ' segmento--rejilla' : ''}" role="radiogroup" aria-label="${h(nombre)}" data-flechas data-grupo="${h(grupo)}">${opciones.map(([v, t, largo], i) => {
    const on = String(v) === sel;
    return `<button type="button" role="radio" aria-checked="${on}" tabindex="${on || (sel == null && i === 0) ? 0 : -1}" data-act="${h(act)}" data-v="${h(v)}"${largo ? ` aria-label="${h(largo)}"` : ''} ${extra}>${h(t)}</button>`;
  }).join('')}</div>`;
}

// Selector ±. Por números: { min, max, paso, valor, unidad }. Por lista: { opciones: ['8-10', '8-12'…], valor }.
// `act`: acción del router que recibe (el, evento) con el valor nuevo en el.dataset.valor.
// `texto(v)` da lo que lee el lector (aria-valuetext) y `cifra(v)` lo que se ve.
export function selector({ id, et, valor, act, min = 0, max = 10, paso = 1, unidad = '', opciones = null, texto = null, cifra = null, datos = {}, compacto = false, etOculta = false }) {
  const lista = Array.isArray(opciones) && opciones.length ? opciones.map(String) : null;
  const n = lista ? Math.max(0, lista.indexOf(String(valor))) : +valor;
  const lo = lista ? 0 : min, hi = lista ? lista.length - 1 : max;
  const v = lista ? lista[n] : n;
  const ver = cifra ? cifra(v) : lista ? v : es(v, 1);
  const leer = texto ? texto(v) : `${lista ? v : es(v, 1)}${unidad ? ' ' + unidad : ''}`;
  const extra = Object.entries(datos).map(([k, x]) => ` data-${h(k)}="${h(x)}"`).join('');
  return `<div class="selector${compacto ? ' selector--compacto' : ''}" data-selector data-al-cambiar="${h(act)}" data-min="${lo}" data-max="${hi}" data-incremento="${lista ? 1 : paso}" data-uni="${h(unidad)}"${lista ? ` data-ops="${h(JSON.stringify(lista))}"` : ''}${extra}>
    <span class="selector-et${etOculta ? ' solo-lector' : ''}" id="${h(id)}-et">${h(et)}</span>
    <div class="selector-valor" role="spinbutton" tabindex="0" id="${h(id)}" aria-labelledby="${h(id)}-et" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${n}" aria-valuetext="${h(leer)}"><b>${h(ver)}</b>${unidad && !lista ? `<span>${h(unidad)}</span>` : ''}</div>
    <div class="selector-pasos"><button type="button" data-act="control.paso" data-paso="-1" aria-label="Menos: ${h(et)}" aria-disabled="${n <= lo}">${ICONOS.menos}</button><button type="button" data-act="control.paso" data-paso="1" aria-label="Más: ${h(et)}" aria-disabled="${n >= hi}">${ICONOS.mas}</button></div>
  </div>`;
}

// Valor de un selector (número o el texto de la lista).
export function valorSelector(sel) {
  const v = sel.querySelector('[role="spinbutton"]');
  const n = +v.getAttribute('aria-valuenow');
  if (sel.dataset.ops) { try { return JSON.parse(sel.dataset.ops)[n]; } catch { return null; } }
  return n;
}

// Mueve un selector a la posición `n` (acotada) y avisa a su acción.
function mover(sel, n, evento) {
  const lo = +sel.dataset.min, hi = +sel.dataset.max, paso = +sel.dataset.incremento || 1;
  const ahora = +sel.querySelector('[role="spinbutton"]').getAttribute('aria-valuenow');
  n = Math.min(hi, Math.max(lo, Math.round(n / paso) * paso));
  if (n === ahora) return;
  sel.querySelector('[role="spinbutton"]').setAttribute('aria-valuenow', String(n));
  sel.dataset.valor = String(valorSelector(sel));
  const fn = MANEJADORES[sel.dataset.alCambiar];
  if (fn) fn(sel, evento);
  if (sel.isConnected) refrescar(sel); // si su área no repintó, se pone al día aquí
}
// Pone al día lo que se ve y lo que lee el lector (valor, unidad y ± en su límite).
function refrescar(sel) {
  const v = sel.querySelector('[role="spinbutton"]');
  const n = +v.getAttribute('aria-valuenow'), lo = +sel.dataset.min, hi = +sel.dataset.max;
  const x = valorSelector(sel);
  const ver = sel.dataset.ops ? String(x) : es(x, 1);
  const b = v.querySelector('b'); if (b) b.textContent = ver;
  v.setAttribute('aria-valuetext', `${ver}${sel.dataset.uni ? ' ' + sel.dataset.uni : ''}`);
  sel.querySelector('[data-paso="-1"]').setAttribute('aria-disabled', String(n <= lo));
  sel.querySelector('[data-paso="1"]').setAttribute('aria-disabled', String(n >= hi));
}
// Las áreas registran aquí qué hace cada selector (no son botones: el router no los ve).
const MANEJADORES = {};
export function alCambiarSelector(obj) { Object.assign(MANEJADORES, obj); }

acciones({
  'control.paso': (el, e) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    const sel = el.closest('[data-selector]');
    const v = sel.querySelector('[role="spinbutton"]');
    mover(sel, +v.getAttribute('aria-valuenow') + +el.dataset.paso * (+sel.dataset.incremento || 1), e);
  },
});

// ── Foco tras repintar: el control que se tocó (o su equivalente en la pantalla nueva) ──
const esc = s => String(s == null ? '' : s).replace(/["\\]/g, '\\$&');
const CLAVES = ['act', 'cambio', 'v', 'k', 'id', 'i', 'paso', 'grupo'];
let ultimo = null;
const huella = el => {
  const c = el && el.closest && el.closest('[data-act], [data-cambio], [role="spinbutton"]');
  if (!c || !c.closest('#vista')) return null;
  const sel = c.closest('[data-selector]');
  return { el: c, act: c.dataset.act || c.dataset.cambio || '', datos: Object.fromEntries(CLAVES.filter(k => k in c.dataset).map(k => [k, c.dataset[k]])), spin: c.getAttribute('role') === 'spinbutton' ? c.id : '', sel: sel ? sel.querySelector('[role="spinbutton"]').id : '', grupo: c.closest('[role="radiogroup"]') ? c.closest('[role="radiogroup"]').dataset.grupo : '' };
};
// Devuelve el foco al control equivalente si la pantalla se ha repintado y el foco se ha perdido.
export function devolverFoco(raiz) {
  const u = ultimo; ultimo = null;
  if (!u || (u.el.isConnected && document.activeElement === u.el)) return;
  const a = document.activeElement;
  if (a && a !== document.body && raiz.contains(a)) return;
  if (a && a !== document.body && !raiz.contains(a) && a.closest && a.closest('.hoja-velo')) return;
  let destino = null;
  if (u.grupo) destino = raiz.querySelector(`[role="radiogroup"][data-grupo="${esc(u.grupo)}"] [aria-checked="true"]`);
  if (!destino && u.spin) destino = raiz.querySelector(`[id="${esc(u.spin)}"]`);
  if (!destino && u.sel) {
    const spin = raiz.querySelector(`[id="${esc(u.sel)}"]`);
    const b = spin && spin.closest('[data-selector]').querySelector(`[data-paso="${esc(u.datos.paso || '')}"]`);
    destino = b && b.getAttribute('aria-disabled') !== 'true' ? b : spin;
  }
  if (!destino && u.act) {
    destino = [...raiz.querySelectorAll('[data-act], [data-cambio]')].find(x => (x.dataset.act || x.dataset.cambio) === u.act
      && CLAVES.every(k => (k in u.datos) === (k in x.dataset) && (!(k in u.datos) || x.dataset[k] === u.datos[k]))) || null;
  }
  if (destino) { try { destino.focus({ preventScroll: true }); } catch { /* nada */ } }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', e => { const x = huella(e.target); if (x) ultimo = x; }, true);
  document.addEventListener('change', e => { const x = huella(e.target); if (x) ultimo = x; }, true);
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    // Selector ±
    const v = e.target.closest && e.target.closest('[data-selector] [role="spinbutton"]');
    if (v) {
      const sel = v.closest('[data-selector]'), ahora = +v.getAttribute('aria-valuenow'), paso = +sel.dataset.incremento || 1;
      const n = { ArrowUp: ahora + paso, ArrowRight: ahora + paso, ArrowDown: ahora - paso, ArrowLeft: ahora - paso, PageUp: ahora + paso * 4, PageDown: ahora - paso * 4, Home: +sel.dataset.min, End: +sel.dataset.max }[e.key];
      if (n == null) return;
      e.preventDefault();
      ultimo = huella(v);
      mover(sel, n, e);
      return;
    }
    // Grupo de opción única
    const r = e.target.closest && e.target.closest('[role="radiogroup"][data-flechas] [role="radio"]');
    if (!r) return;
    const g = r.closest('[role="radiogroup"]');
    const ops = [...g.querySelectorAll('[role="radio"]:not([aria-disabled="true"])')];
    const i = ops.indexOf(r);
    const sig = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: ops.length - 1 }[e.key];
    if (sig == null) return;
    e.preventDefault();
    const b = ops[(sig + ops.length) % ops.length];
    b.click();
    // Si la pantalla o la hoja no se repintaron, el grupo se actualiza aquí.
    if (b.isConnected) {
      ops.forEach(x => { const si = x === b; x.setAttribute('aria-checked', String(si)); x.tabIndex = si ? 0 : -1; });
      b.focus();
    } else {
      const raiz = document.querySelector('.hoja-velo .hoja') || document.querySelector('#vista');
      const nuevo = raiz && raiz.querySelector(`[role="radiogroup"][data-grupo="${esc(g.dataset.grupo || '')}"] [aria-checked="true"]`);
      if (nuevo) nuevo.focus();
    }
  });
}

// Lista con «y» (o «e» delante de i- o hi-, salvo hie-): «glúteo e isquios», «pecho, hombro y tríceps».
export function listaY(a) {
  const x = a.filter(Boolean);
  if (x.length <= 1) return x.join('');
  const ult = x[x.length - 1];
  const conj = /^h?i(?!e)/i.test(String(ult).normalize('NFD').replace(/[̀-ͯ]/g, '')) ? ' e ' : ' y ';
  return x.slice(0, -1).join(', ') + conj + ult;
}
// «1 lesión activa», «2 lesiones activas»…
export const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
