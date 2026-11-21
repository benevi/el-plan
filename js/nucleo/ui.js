// Piezas de interfaz comunes: escapar texto, avisos, hojas inferiores, confirmaciones, espera e iconos.
// Las áreas pintan HTML con plantillas y usan data-act="area.accion" para los botones (ver router.js).
// El aspecto sale del sistema de diseño (css/tokens.css y css/componentes.css): aquí solo hay estructura.

export const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? null : x; };
export const es = (v, dec = 1) => v == null ? '' : (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('es-ES');

export function fechaLarga(iso) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00' : ''));
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fechaCorta(iso) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00' : ''));
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
export function mmss(seg) {
  seg = Math.max(0, Math.round(seg));
  return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
}

// «Reducir movimiento» del sistema: mismo contenido, sin desplazamientos (R25).
export const movimientoReducido = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ── Iconos (trazo, 24×24, clase .icono del sistema) ──
const svg = d => `<svg class="icono" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICONOS = {
  hoy: svg('<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>'),
  progreso: svg('<path d="M4 19h16M6 16l4-5 3 3 5-7"/>'),
  ejercicios: svg('<path d="M3 12h2m14 0h2M7 8v8m10-8v8M5 10v4m14-4v4M7 12h10"/>'),
  perfil: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/>'),
  ia: svg('<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  pausa: svg('<path d="M9 5v14M15 5v14"/>'),
  check: svg('<path d="M5 12.5 10 17 19 7"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
  menos: svg('<path d="M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  atras: svg('<path d="M15 5 8 12l7 7"/>'),
  sig: svg('<path d="M9 5l7 7-7 7"/>'),
  reloj: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  alerta: svg('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>'),
  error: svg('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  sinred: svg('<path d="M2.5 8.5a14 14 0 0 1 19 0M6 12a9 9 0 0 1 12 0M9.5 15.5a4 4 0 0 1 5 0M12 19h.01M3 3l18 18"/>'),
  video: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>'),
  lista: svg('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  foco: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/>'),
  editar: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'),
  basura: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

// ── Avisos (componente .aviso del sistema) ──
// aviso(txt, tipo): '' (hecho), 'info' o 'error'. Los de hecho e información se van solos (más tiempo si el
// texto es largo); los errores se quedan hasta cerrarlos con su ✕ (R13). avisoFijo(html) se queda hasta
// quitarAvisoFijo() (p. ej. si no se puede guardar); mientras haya uno fijo, los breves se ven encima y
// luego vuelve el fijo. Todos llevan icono + texto: el color nunca va solo (R12).
let tAviso = null;
let fijo = null;
const TIPOS = { '': ['bien', 'check'], bien: ['bien', 'check'], info: ['info', 'info'], aviso: ['aviso', 'alerta'], error: ['error', 'error'] };
function elAviso() {
  let el = $('#aviso');
  if (!el) { el = document.createElement('div'); el.id = 'aviso'; el.hidden = true; document.body.appendChild(el); }
  return el;
}
function pintarAviso(tipo, contenido, { cerrable = false, alerta = false, esFijo = false } = {}) {
  const el = elAviso();
  const [clase, icono] = TIPOS[tipo] || TIPOS.info;
  el.className = `aviso aviso--${clase} ver${esFijo ? ' fijo' : ''}${cerrable ? '' : ' aviso--solo'}${movimientoReducido() ? '' : ' entra'}`;
  el.setAttribute('role', alerta ? 'alert' : 'status');
  el.innerHTML = `${ICONOS[icono]}<div class="aviso-texto">${contenido}</div>${cerrable ? `<button type="button" class="boton-icono boton-icono--sin-borde" data-cerrar-aviso aria-label="Cerrar aviso">${ICONOS.x}</button>` : ''}`;
  el.hidden = false;
}
function mostrarFijo() { pintarAviso('error', fijo, { alerta: true, esFijo: true }); }
function ocultarAviso() {
  const el = $('#aviso');
  if (!el) return;
  el.hidden = true; el.textContent = ''; el.className = 'aviso';
}
export function aviso(txt, tipo = '') {
  const error = tipo === 'error';
  pintarAviso(tipo, `<p>${h(txt)}</p>`, { cerrable: error, alerta: error });
  clearTimeout(tAviso);
  if (error) return; // los errores no se van solos
  const largo = String(txt).length;
  tAviso = setTimeout(() => { if (fijo) mostrarFijo(); else ocultarAviso(); }, Math.min(8000, 3200 + Math.max(0, largo - 50) * 40));
}
export function avisoFijo(html) {
  fijo = html;
  clearTimeout(tAviso);
  mostrarFijo();
}
export const hayAvisoFijo = () => !!fijo;
export function quitarAvisoFijo() {
  if (!fijo) return;
  fijo = null;
  const el = $('#aviso');
  if (el && el.classList.contains('fijo')) ocultarAviso();
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    if (!e.target.closest || !e.target.closest('[data-cerrar-aviso]')) return;
    clearTimeout(tAviso);
    if (fijo) mostrarFijo(); else ocultarAviso();
  });
}

// ── Espera del sistema ──
// Menos de 1 s: nada. Unos segundos: el botón dice qué hace (ocupado). Más: esqueleto con la forma del
// contenido. Con movimiento reducido el giro se queda quieto y el esqueleto no late (lo resuelve el CSS).
export const giro = () => '<span class="giro" aria-hidden="true"></span>';
export function esqueleto(lineas = 3, { titulo = true } = {}) {
  const filas = Array.from({ length: lineas }, (_, i) => `<span class="esqueleto${i === lineas - 1 ? ' esqueleto--corta' : ''}"></span>`).join('');
  return `<div class="espera-bloque" aria-hidden="true">${titulo ? '<span class="esqueleto esqueleto--titulo"></span>' : ''}${filas}</div>`;
}
// Pone un botón en «ocupado» (aria-busy, giro y texto) y devuelve la función que lo deja como estaba.
export function ocupado(boton, texto = 'Guardando…') {
  if (!boton) return () => {};
  const antes = boton.innerHTML;
  boton.setAttribute('aria-busy', 'true');
  boton.innerHTML = `${giro()}<span>${h(texto)}</span>`;
  return () => { boton.removeAttribute('aria-busy'); boton.innerHTML = antes; };
}

// ── Hoja inferior accesible (R10, R23) ──
// abrirHoja(html, opciones) muestra un panel encima de la pantalla; cerrarHoja() lo quita. Los botones de
// dentro usan data-act como siempre. El primer <h2> (o .hoja-texto) es su título: va en la cabecera con el
// botón ✕, da nombre al diálogo (aria-labelledby) y recibe el foco al abrir, así no sale el teclado.
// - Entra en el historial: el botón atrás del móvil la cierra sin cambiar la pantalla de debajo (E8).
// - Escape, ✕ y tocar el velo la cierran; Tab no sale de ella; el resto de la página queda inert; el foco
//   vuelve a quien la abrió.
// - Se cierra sola al cambiar de pantalla (router.js).
// Opciones:
//   clase     clases extra del panel (p. ej. 'checkin').
//   fija      sin ✕ ni velo que cierre (la espera de la IA). Atrás y Escape pulsan su botón [data-atras]
//             si lo tiene; si no, la hoja se queda.
//   foco      'titulo' (por defecto) o 'campo' (el primer campo: abre el teclado).
//   alCerrar  función que se llama cuando la hoja se va por cualquier camino (también si otra la sustituye).
let hoja = null; // { fondo, op, disparador }
let nHoja = 0;
let entrada = false; // hay una entrada nuestra en el historial
let enVuelo = false; // history.back() pedido y aún sin su popstate
let tVuelo = null;
const cola = [];
const ESTADO = 'piposHoja';
const historial = () => { const hi = typeof window !== 'undefined' ? window.history : null; return hi && typeof hi.pushState === 'function' ? hi : null; };
const esNuestra = st => !!(st && st[ESTADO]);

function soltarCola() {
  enVuelo = false;
  clearTimeout(tVuelo);
  for (const fn of cola.splice(0)) { try { fn(); } catch (e) { console.error(e); } }
}
function irAtrasSinVer(hi) {
  enVuelo = true;
  clearTimeout(tVuelo);
  tVuelo = setTimeout(soltarCola, 600); // si el navegador no avisa del popstate, no se queda nada esperando
  hi.back();
}
// Ejecuta fn cuando el historial está quieto (tras quitar la entrada de una hoja). La usan el router al
// navegar y las hojas al abrirse, para no mezclar su entrada con un history.back() en curso.
export function trasHistorial(fn) { if (enVuelo) cola.push(fn); else fn(); }
function ponerEntrada() {
  const hi = historial();
  if (!hi || entrada) return;
  // Se acaba de cerrar otra hoja en este mismo paso (confirmar → volver a la hoja): su entrada sirve.
  if (atrasPendiente) { clearTimeout(atrasPendiente); atrasPendiente = null; entrada = true; return; }
  trasHistorial(() => {
    if (entrada || !hayHojaAbierta()) return;
    try { hi.pushState({ ...(hi.state || {}), [ESTADO]: true }, ''); entrada = true; } catch { /* sin historial */ }
  });
}
// Al cerrar una hoja, su entrada se quita con history.back(), pero no en el acto: si en el mismo paso se
// navega (router.ir) o se abre otra hoja, se aprovecha la entrada (reusarEntradaDeHoja, ponerEntrada) y no
// hace falta esperar a ningún popstate.
let atrasPendiente = null;
function quitarEntrada() {
  const hi = historial();
  if (!entrada) return;
  entrada = false;
  if (!hi || !esNuestra(hi.state)) return;
  clearTimeout(atrasPendiente);
  atrasPendiente = setTimeout(() => { atrasPendiente = null; if (esNuestra(hi.state) && !hayHojaAbierta()) irAtrasSinVer(hi); }, 0);
}
// Navegar justo después de cerrar una hoja: la entrada de la hoja pasa a ser la de la pantalla nueva
// (replaceState), así «atrás» vuelve a la de antes y no queda ninguna entrada muerta. Devuelve false si no
// hay entrada que aprovechar; 'mismo' si el destino es la dirección actual; 'cambio' si ha cambiado (y
// avisa con un hashchange, como cualquier navegación).
export function reusarEntradaDeHoja(destino) {
  const hi = historial();
  if (!atrasPendiente || !hi) return false;
  clearTimeout(atrasPendiente); atrasPendiente = null;
  const antes = location.href;
  const st = { ...(hi.state || {}) }; delete st[ESTADO];
  hi.replaceState(st, '', destino);
  if (location.href === antes) return 'mismo';
  const Ev = window.HashChangeEvent || window.Event;
  window.dispatchEvent(new Ev('hashchange', { oldURL: antes, newURL: location.href }));
  return 'cambio';
}
if (typeof window !== 'undefined') {
  // Recargar con una hoja abierta deja su entrada del historial sin hoja: se quita al cargar.
  try { const hi = historial(); if (hi && esNuestra(hi.state)) irAtrasSinVer(hi); } catch { /* sin historial */ }
  window.addEventListener('popstate', e => {
    if (enVuelo) { soltarCola(); return; }
    if (entrada && !esNuestra(e.state)) { entrada = false; atras(); return; }
    // Una entrada de hoja que quedó atrás (la hoja se cerró al cambiar de pantalla): se salta.
    if (esNuestra(e.state) && !hayHojaAbierta()) { const hi = historial(); if (hi) irAtrasSinVer(hi); }
  });
}

export const hayHojaAbierta = () => !!(hoja && hoja.fondo.isConnected);

// Un control se identifica por su acción y sus datos (data-act + data-id/k/v/e/s/z, o href): así, si la
// pantalla o la hoja se repinta, se puede devolver el foco al control equivalente del repintado.
const CLAVES = ['id', 'k', 'v', 'e', 's', 'z'];
function huellaDe(el) {
  if (!el || el.nodeType !== 1 || el === document.body) return null;
  const act = el.dataset && (el.dataset.act || el.dataset.cambio);
  if (act) return { act, datos: Object.fromEntries(CLAVES.filter(k => k in el.dataset).map(k => [k, el.dataset[k]])) };
  const href = el.getAttribute && el.getAttribute('href');
  return href ? { href } : null;
}
function buscarEquivalente(huella, raiz) {
  if (!huella || !raiz) return null;
  if (huella.href) return [...raiz.querySelectorAll('[href]')].find(x => x.getAttribute('href') === huella.href) || null;
  return [...raiz.querySelectorAll('[data-act], [data-cambio]')].find(x => (x.dataset.act || x.dataset.cambio) === huella.act
    && CLAVES.every(k => (k in huella.datos) === (k in x.dataset) && (!(k in huella.datos) || x.dataset[k] === huella.datos[k]))) || null;
}
// Foco al título de la pantalla (h1, enfocable sin estar en el orden de Tab).
function focoAlTitulo() {
  const t = document.querySelector('#vista h1') || document.querySelector('#vista');
  if (!t) return;
  if (t.tagName === 'H1' && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
  try { t.focus({ preventScroll: true }); } catch { /* nada */ }
}

// Pregunta dentro de la propia hoja (sin sustituirla: lo de debajo sigue funcionando). La usa la espera
// de la IA: atrás o Escape no cancelan en silencio, preguntan.
function preguntarDentro(boton, pregunta) {
  const panel = hoja.fondo.querySelector('.hoja');
  let caja = panel.querySelector('.hoja-pregunta');
  if (!caja) {
    caja = document.createElement('div');
    caja.className = 'hoja-pregunta nota aviso-nota';
    caja.setAttribute('role', 'group');
    caja.setAttribute('aria-labelledby', 'hoja-pregunta-t');
    caja.innerHTML = `<p id="hoja-pregunta-t"><b>${h(pregunta)}</b></p><div class="fila-botones"><button type="button" class="btn sec" data-respuesta="no">No, seguir esperando</button><button type="button" class="btn" data-respuesta="si">Sí, cancelar</button></div>`;
    caja.addEventListener('click', e => {
      const r = e.target.closest('[data-respuesta]'); if (!r) return;
      caja.remove();
      if (r.dataset.respuesta === 'si') boton.click();
      else { try { boton.focus({ preventScroll: true }); } catch { /* nada */ } }
    });
    boton.before(caja);
  }
  try { caja.querySelector('[data-respuesta="no"]').focus(); } catch { /* nada */ }
}

// El botón atrás (o Escape) con una hoja abierta.
function atras() {
  if (!hayHojaAbierta()) return;
  if (hoja.op.fija) {
    const b = hoja.fondo.querySelector('[data-atras]');
    if (b && b.dataset.atrasPregunta) { preguntarDentro(b, b.dataset.atrasPregunta); ponerEntrada(); return; }
    if (b) { b.click(); return; }
    ponerEntrada(); // se queda: vuelve a poner su entrada para el siguiente atrás
    return;
  }
  cerrarHoja({ historial: false });
}

function fondoInerte(fondo, si) {
  for (const el of [...document.body.children]) {
    if (el === fondo || el.id === 'aviso' || el.matches('script, .temporizador, .alarma, .hoja-velo')) continue;
    if (si) { if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); el.dataset.inerteHoja = '1'; } }
    else if (el.dataset.inerteHoja) { el.removeAttribute('inert'); delete el.dataset.inerteHoja; }
  }
}

export function abrirHoja(html, { clase = '', fija = false, foco = 'titulo', alCerrar = null } = {}) {
  const habia = hayHojaAbierta();
  const disparador = habia ? hoja.disparador : document.activeElement;
  const huellaDisparador = habia ? hoja.huellaDisparador : huellaDe(document.activeElement);
  // Al repintar la misma hoja (el check-in a cada toque), el foco vuelve al control que se pulsó, no al título.
  const dentro = habia && hoja.fondo.contains(document.activeElement) ? huellaDe(document.activeElement) : null;
  if (habia) quitarHoja({ animar: false, devolverFoco: false });
  $$('.hoja-fondo').forEach(f => f.remove()); // restos (p. ej. quitada a mano en las pruebas)
  const id = `hoja-t-${++nHoja}`;
  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo hoja-velo' + (habia || movimientoReducido() ? '' : ' entra');
  fondo.innerHTML = `<div class="hoja ${h(clase)}" role="dialog" aria-modal="true"><div class="hoja-asa" aria-hidden="true"></div>${html}</div>`;
  const panel = fondo.firstElementChild;
  // Cabecera: título + ✕
  const titulo = panel.querySelector('h2, .hoja-texto');
  const cab = document.createElement('div');
  cab.className = 'hoja-cab';
  if (titulo) {
    titulo.id = titulo.id || id;
    titulo.setAttribute('tabindex', '-1');
    panel.setAttribute('aria-labelledby', titulo.id);
    cab.appendChild(titulo); // sale de donde estuviera y va arriba
  } else {
    panel.setAttribute('aria-label', 'Hoja');
    cab.appendChild(document.createElement('span'));
  }
  if (!fija) cab.insertAdjacentHTML('beforeend', `<button type="button" class="boton-icono boton-icono--sin-borde" data-cerrar-hoja aria-label="Cerrar">${ICONOS.x}</button>`);
  panel.firstElementChild.after(cab);
  if (!fija) fondo.addEventListener('click', e => { if (e.target === fondo || e.target.closest('[data-cerrar-hoja]')) cerrarHoja(); });
  document.body.appendChild(fondo);
  document.body.classList.add('con-hoja');
  hoja = { fondo, op: { fija, alCerrar }, disparador, huellaDisparador };
  fondoInerte(fondo, true);
  const campo = foco === 'campo' && panel.querySelector('input:not([type=hidden]), select, textarea');
  const igual = dentro && buscarEquivalente(dentro, panel);
  try { (igual || campo || titulo || panel).focus({ preventScroll: true }); } catch { /* sin foco */ }
  ponerEntrada();
  return panel;
}

// Quita la hoja de la página (sin tocar el historial).
function quitarHoja({ animar = true, devolverFoco = true } = {}) {
  if (!hoja) return;
  const { fondo, op, disparador, huellaDisparador } = hoja;
  hoja = null;
  const estaba = fondo.isConnected;
  fondo.remove();
  if (animar && estaba && !movimientoReducido()) {
    // Copia muda que sale en 200 ms: sin ids, sin acciones y fuera del árbol de accesibilidad.
    const panel = fondo.querySelector('.hoja');
    const eco = document.createElement('div');
    eco.className = 'hoja-velo sale';
    eco.setAttribute('aria-hidden', 'true');
    eco.setAttribute('inert', '');
    const copia = panel.cloneNode(true);
    copia.className = 'hoja';
    for (const a of ['role', 'aria-modal', 'aria-labelledby']) copia.removeAttribute(a);
    copia.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copia.querySelectorAll('[data-act], [data-cambio]').forEach(n => { n.removeAttribute('data-act'); n.removeAttribute('data-cambio'); });
    eco.appendChild(copia);
    document.body.appendChild(eco);
    setTimeout(() => eco.remove(), 220);
  }
  if (!$('.hoja-fondo')) { document.body.classList.remove('con-hoja'); fondoInerte(null, false); }
  // El foco vuelve a quien abrió la hoja; si la pantalla se repintó (p. ej. al guardar), a su equivalente,
  // y si ya no existe, al título de la pantalla: nunca se pierde en <body>.
  if (devolverFoco && estaba) {
    const destino = disparador && disparador.isConnected ? disparador : buscarEquivalente(huellaDisparador, document.querySelector('#vista'));
    if (destino && typeof destino.focus === 'function') { try { destino.focus({ preventScroll: true }); } catch { /* nada */ } }
    else focoAlTitulo();
  }
  if (op.alCerrar) { try { op.alCerrar(); } catch (e) { console.error(e); } }
}

// cerrarHoja() quita la hoja y su entrada del historial. Con { historial: false } deja el historial como
// está (el botón atrás ya la quitó, o la pantalla ya ha cambiado).
export function cerrarHoja({ historial: tocarHistorial = true } = {}) {
  $$('.hoja-fondo').forEach(f => { if (!hoja || f !== hoja.fondo) f.remove(); }); // restos sin dueño
  quitarHoja();
  if (!$('.hoja-fondo')) { document.body.classList.remove('con-hoja'); fondoInerte(null, false); }
  if (tocarHistorial) quitarEntrada(); else entrada = false;
}

if (typeof document !== 'undefined') {
  // Escape cierra; Tab no sale de la hoja.
  document.addEventListener('keydown', e => {
    if (!hayHojaAbierta()) return;
    if (e.key === 'Escape') { e.preventDefault(); if (hoja.op.fija) atras(); else cerrarHoja(); return; }
    if (e.key !== 'Tab') return;
    const enfocables = $$('button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]', hoja.fondo)
      .filter(x => x.getClientRects().length);
    if (!enfocables.length) return;
    const a = enfocables[0], z = enfocables[enfocables.length - 1];
    const dentro = hoja.fondo.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === a || !dentro)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && (document.activeElement === z || !dentro)) { e.preventDefault(); a.focus(); }
  });
  // Un enlace a otra pantalla desde dentro de una hoja: primero se quita la hoja (y su entrada) y luego se va.
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('.hoja-fondo a[href^="#"]');
    if (!a || !entrada) return;
    e.preventDefault();
    const destino = a.getAttribute('href');
    cerrarHoja();
    if (!reusarEntradaDeHoja(destino)) trasHistorial(() => { if (location.hash !== destino) location.hash = destino; });
  }, true);
}

export function confirmar(txt, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  return new Promise(res => {
    let respondido = false;
    const responder = v => { if (!respondido) { respondido = true; res(v); } };
    const panel = abrirHoja(`<p class="hoja-texto">${h(txt)}</p>
      <div class="fila-botones"><button type="button" class="btn sec" data-r="0">${h(no)}</button><button type="button" class="btn ${peligro ? 'peligro' : ''}" data-r="1">${h(si)}</button></div>`,
    { alCerrar: () => responder(false) });
    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      responder(b.dataset.r === '1');
      cerrarHoja();
    });
  });
}
