// Editor de «Mis sesiones» (PR 16, pedido por Víctor). Sin IA en ningún paso.
// Hoy › Mis sesiones → «Crear una sesión» / «Crear otra» (#mia/nueva) o «Editar» en una guardada (#mia/<id>).
// Desde el 24-11-2026 (decisión de Víctor) «Mis sesiones» está solo en Hoy: el editor vuelve allí.
// Se elige nombre y lugar, se añaden ejercicios del catálogo (buscador y filtros por músculo, lugar y
// material, los mismos de la pantalla Ejercicios), se quitan y se ordenan (Subir y Bajar, con el teclado y el
// lector), y en cada uno se fijan series, repeticiones o tiempo y descanso, con lo que propone la app según tu
// nivel (C-DOSIS-2 a 6 y el tope de series de D-B). Guardar comprueba nombre, ejercicios y el máximo de 30.
// Al hacerla, como cualquier mía: calentamiento, cardio y estiramientos siempre, y solo cambia lo que choque
// con el dolor, las lesiones, el lugar, el material o los rechazos de ese día (C-MIA-1, C-MIA-2).
//
// Lo que se está editando vive aquí (borrador) hasta guardarlo. Al salir del editor se descarta: con «‹ Mis
// Hoy» o las pestañas, si hay cambios, se pregunta antes; con el botón atrás, se avisa de que no se guardaron.
// Si la guardada cambia por otro lado (añadir desde la ficha, cargar una copia), el borrador se rehace.

import { rutas, acciones, pintar, ir, antesDeCadaRuta, rutaActual } from '../../nucleo/router.js';
import { estado } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $ } from '../../nucleo/ui.js';
import { ex, nivelesZona, riesgo } from '../../reglas/catalogo.js';
import { rango } from '../../reglas/progresion.js';
import { LUGARES } from '../../datos/constantes.js';
import { miaDe, ejerciciosMia, propuestaMia, topeSeriesMia, guardarEdicionMia, borrarMia, LARGO_NOMBRE_MIA, MAX_EJERCICIOS_MIA, DESCANSO_MAX_MIA } from '../entrenador/entrenador.js';
import { segmento, selector, alCambiarSelector, devolverFoco, valorSelector, ICONOS16 } from './controles.js';
import { filtroVacio, filtrarEjercicios, filaFiltro, datosEjercicio, marcarEnFila } from '../ejercicios/buscador.js';

let borrador = null; // { id (null si es nueva), nombre, lugar, ejercicios: [{ id, rol, series, reps, descanso }], error, huella, inicial }
const buscador = filtroVacio();
let anuncio = '';

const copia = x => JSON.parse(JSON.stringify(x));
const lugarInicial = S => (S.perfil.lugares && S.perfil.lugares[0]) || 'gym';
function empezarNueva(ejercicios = []) {
  const S = estado();
  borrador = { id: null, nombre: '', lugar: lugarInicial(S), ejercicios, error: null, huella: null };
  borrador.inicial = contenido(borrador);
}
// Lo editable, para saber si hay cambios sin guardar.
const contenido = b => JSON.stringify({ nombre: String(b.nombre || '').trim(), lugar: b.lugar, ejercicios: b.ejercicios });
const huellaDe = m => (m ? JSON.stringify(m) : null);
export const hayCambiosMia = () => !!borrador && contenido(borrador) !== borrador.inicial;
function empezarEdicion(id) {
  const m = miaDe(estado(), id);
  borrador = m ? { id: m.id, nombre: m.nombre, lugar: m.lugar, ejercicios: copia(ejerciciosMia(m)), error: null, huella: huellaDe(m) } : null;
  if (borrador) borrador.inicial = contenido(borrador);
}
// Desde la ficha de un ejercicio: una nueva con él (y el lugar donde se hace, si es uno de los tuyos).
export function nuevaConEjercicio(idEj) {
  const S = estado(), e = ex(idEj);
  empezarNueva(e ? [propuestaMia(S, e.id, 0)] : []);
  if (e && !e.l.includes(borrador.lugar)) borrador.lugar = (S.perfil.lugares || []).find(l => e.l.includes(l)) || e.l[0] || borrador.lugar;
  borrador.inicial = contenido({ ...borrador, ejercicios: [] }); // el ejercicio de la ficha ya es un cambio
}

// ── Repeticiones, tiempo o distancia: una lista de valores que se recorre con ± ──
const ESCALAS = {
  '': ['4-6', '5-8', '6-8', '6-10', '8-10', '8-12', '8-15', '10-12', '10-15', '12-15', '12-20', '15-20', '20-25'],
  s: ['10-20 s', '15-30 s', '20-30 s', '20-45 s', '30 s', '30-45 s', '30-60 s', '45-60 s', '60 s', '60-90 s'],
  min: ['3-5 min', '5 min', '5-10 min', '10 min', '10-15 min', '10-20 min', '15-20 min', '20 min', '20-30 min', '30 min', '30-45 min'],
  m: ['10-15 m', '20-30 m', '25 m', '50 m', '100 m', '200 m'],
};
const clave = r => (r ? [r.lo, r.hi] : [0, 0]);
// Los valores para este ejercicio, con el suyo dentro (y su «c/lado» o «c/pierna» en todos).
export function escala(reps) {
  const r = rango(reps);
  const u = r && ESCALAS[r.u] ? r.u : '';
  const resto = r ? r.resto : '';
  const base = ESCALAS[u].map(x => x + resto);
  const ya = base.findIndex(x => { const y = rango(x); return y && r && y.lo === r.lo && y.hi === r.hi; });
  if (ya >= 0) base[ya] = String(reps);
  else if (r) {
    const [lo, hi] = clave(r);
    const i = base.findIndex(x => { const [a, b] = clave(rango(x)); return a > lo || (a === lo && b > hi); });
    base.splice(i < 0 ? base.length : i, 0, String(reps));
  } else base.unshift(String(reps));
  return { valores: base, u };
}
const NOMBRE_U = { '': ['Repeticiones', 'repeticiones'], s: ['Tiempo', 'segundos'], min: ['Tiempo', 'minutos'], m: ['Distancia', 'metros'] };
function textoReps(v, u) {
  const r = rango(v);
  if (!r) return String(v);
  const lado = /c\/\s*lado|por lado|cada lado/i.test(r.resto) ? ' por lado' : /c\/\s*pierna/i.test(r.resto) ? ' por pierna' : /c\/\s*brazo/i.test(r.resto) ? ' por brazo' : '';
  return `${r.lo === r.hi ? r.lo : `${r.lo} a ${r.hi}`} ${NOMBRE_U[u][1]}${lado}`;
}

// ── Pantalla ──
function itemEjercicio(x, i, n, S, niveles) {
  const e = ex(x.id);
  const { valores, u } = escala(x.reps);
  const fuera = !e.l.includes(borrador.lugar);
  // De nivel superior: se mantiene con una nota de técnica al hacerla (C-MIA-2)
  const dificil = e.niv > (+S.perfil.nivel || 1);
  const rg = riesgo(e, niveles);
  const tope = topeSeriesMia(S, e);
  const base = `mia-${x.id}`;
  return `<li class="tarjeta mia-ej" data-ej="${h(x.id)}">
    <div class="mia-ej-cab"><span class="mia-num" aria-hidden="true">${i + 1}</span>
      <div><h3 class="mia-ej-nombre" id="${base}-n">${h(e.n)}</h3><p class="mia-ej-datos">${h(datosEjercicio(e))}</p>
      ${fuera || rg !== 'ok' || dificil ? `<p class="insignias">${dificil ? '<span class="insignia">Más difícil que tu nivel</span>' : ''}${fuera ? `<span class="insignia insignia--aviso">No es de ${h((LUGARES[borrador.lugar] || '').toLowerCase())}</span>` : ''}${rg === 'evitar' ? '<span class="insignia insignia--error">Evitar por tu lesión</span>' : rg === 'precaucion' ? '<span class="insignia insignia--aviso">Con cuidado</span>' : ''}</p>` : ''}</div></div>
    <div class="mia-ej-dosis" role="group" aria-labelledby="${base}-n">
      ${selector({ id: `${base}-series`, et: 'Series', valor: Math.min(x.series, tope), min: 1, max: tope, paso: 1, act: 'mia.dato', datos: { id: x.id, k: 'series' }, compacto: true, texto: v => `${v} ${v === 1 ? 'serie' : 'series'}` })}
      ${selector({ id: `${base}-reps`, et: NOMBRE_U[u][0], valor: x.reps, opciones: valores, act: 'mia.dato', datos: { id: x.id, k: 'reps' }, compacto: true, texto: v => textoReps(v, u) })}
      ${selector({ id: `${base}-desc`, et: 'Descanso', valor: x.descanso, min: 0, max: DESCANSO_MAX_MIA, paso: 15, act: 'mia.dato', datos: { id: x.id, k: 'descanso' }, compacto: true, cifra: v => (v ? `${v} s` : '0'), texto: v => (v ? `${v} segundos de descanso` : 'sin descanso') })}
    </div>
    <div class="mia-ej-acciones">
      <button type="button" class="boton-icono" data-act="mia.subir" data-id="${h(x.id)}" aria-label="Subir ${h(e.n)}" aria-disabled="${i === 0}">${ICONOS16.subir}</button>
      <button type="button" class="boton-icono" data-act="mia.bajar" data-id="${h(x.id)}" aria-label="Bajar ${h(e.n)}" aria-disabled="${i === n - 1}">${ICONOS16.bajar}</button>
      <button type="button" class="boton boton--texto mia-quitar" data-act="mia.quitar" data-id="${h(x.id)}" aria-label="Quitar ${h(e.n)}">${ICONOS.basura}<span>Quitar</span></button>
    </div>
  </li>`;
}

function vista(params) {
  const S = estado();
  const idRuta = params && params[0] && params[0] !== 'nueva' ? params[0] : null;
  // Se rehace si es otra sesión o si la guardada cambió por otro lado desde que se abrió.
  if (!borrador || borrador.id !== idRuta || (idRuta && borrador.huella !== huellaDe(miaDe(S, idRuta)))) { if (idRuta) empezarEdicion(idRuta); else empezarNueva(); }
  if (!borrador) {
    return `<h1 class="titulo-pantalla">Esa sesión ya no está</h1>
      <p class="texto-2">Puede que la borraras. Tus sesiones están en Hoy, en «Mis sesiones».</p>
      <button type="button" class="boton boton--secundario" data-act="mia.volver">Volver a Hoy</button>`;
  }
  const b = borrador, n = b.ejercicios.length;
  const niveles = nivelesZona(S.perfil);
  const err = b.error || {};
  const fuera = b.ejercicios.filter(x => !ex(x.id).l.includes(b.lugar)).length;
  return `<button type="button" class="boton boton--texto volver" data-act="mia.volver">${ICONOS.atras}<span>Hoy</span></button>
    <h1 class="titulo-pantalla">${b.id ? 'Editar sesión' : 'Nueva sesión'}</h1>
    <p class="ayuda mia-ayuda">Al hacerla, la app le añade calentamiento, cardio y estiramientos, y cambia lo que ese día no valga por tu dolor, el lugar o el material. Sin IA.</p>
    <section class="tarjeta mia-sec" aria-labelledby="mia-t-datos">
      <h2 class="solo-lector" id="mia-t-datos">Nombre y lugar</h2>
      <div class="campo">
        <label for="mia-nombre">Nombre</label>
        <input id="mia-nombre" maxlength="${LARGO_NOMBRE_MIA}" value="${h(b.nombre)}" placeholder="Abdominales y flexiones" autocomplete="off" aria-describedby="mia-nombre-ayuda${err.campo === 'nombre' ? ' mia-nombre-error' : ''}"${err.campo === 'nombre' ? ' aria-invalid="true"' : ''}>
        <p class="ayuda" id="mia-nombre-ayuda">Hasta ${LARGO_NOMBRE_MIA} letras; no puede repetirse.</p>
        ${err.campo === 'nombre' ? `<p class="mensaje mensaje--error" id="mia-nombre-error">${ICONOS.error}<span>${h(err.texto)}</span></p>` : ''}
      </div>
      <div class="grupo"><p class="grupo-et" id="mia-lugar-et">Lugar</p>
        ${segmento('Lugar', 'mia.lugar', Object.entries(LUGARES), b.lugar, { rejilla: true, grupo: 'mia-lugar' })}
        ${!(S.perfil.lugares || []).includes(b.lugar) ? `<p class="ayuda">${h(LUGARES[b.lugar] || '')} no está entre tus lugares del perfil: al hacerla, «Antes de empezar» te lo ofrecerá igual.${b.lugar === 'casa' ? ' El material de casa es el que marques en Perfil › Mi entreno.' : ''}</p>` : ''}
        ${fuera ? `<p class="ayuda">${fuera === 1 ? '1 ejercicio no es' : `${fuera} ejercicios no son`} de ${h((LUGARES[b.lugar] || '').toLowerCase())}: al hacerla, la app ${fuera === 1 ? 'lo cambiará' : 'los cambiará'} por otro del mismo músculo.</p>` : ''}
      </div>
    </section>
    <section class="mia-sec" aria-labelledby="mia-t-ejs">
      <div class="bloque-fila"><h2 class="seccion-titulo" id="mia-t-ejs">Ejercicios</h2><span class="texto-2 pequeno">${n} de ${MAX_EJERCICIOS_MIA}</span></div>
      ${n ? `<ol class="mia-ejs">${b.ejercicios.map((x, i) => itemEjercicio(x, i, n, S, niveles)).join('')}</ol>`
    : '<div class="tarjeta vacio mia-vacia"><h3>Aún no tiene ejercicios</h3><p>Añade los que quieras del catálogo: la app te propone las series, repeticiones y descanso según tu nivel.</p></div>'}
      ${err.campo === 'ejercicios' ? `<p class="mensaje mensaje--error" id="mia-ejs-error">${ICONOS.error}<span>${h(err.texto)}</span></p>` : ''}
      ${n < MAX_EJERCICIOS_MIA ? `<button type="button" class="boton boton--secundario boton--ancho" data-act="mia.buscar">${ICONOS.mas}<span>Añadir ejercicios</span></button>` : ''}
      <p class="solo-lector" role="status" id="mia-anuncio"></p>
    </section>
    ${err.campo === 'general' ? `<p class="mensaje mensaje--error" role="alert">${ICONOS.error}<span>${h(err.texto)}</span></p>` : ''}
    <div class="mia-guardar">
      <button type="button" class="boton boton--ancho" data-act="mia.guardar">${b.id ? 'Guardar cambios' : 'Guardar sesión'}</button>
      ${b.id ? `<button type="button" class="boton boton--peligro boton--ancho" data-act="mia.borrar">Borrar «${h((miaDe(S, b.id) || b).nombre)}»</button>` : ''}
    </div>`;
}

// ── Hoja «Añadir ejercicios»: buscador y filtros del catálogo ──
function filaResultado(e, S, niveles) {
  const ya = borrador.ejercicios.some(x => x.id === e.id);
  const rg = riesgo(e, niveles);
  return `<li><button type="button" class="fila" data-act="mia.anadir" data-id="${h(e.id)}"${ya ? ' aria-disabled="true"' : ''}>
    <span class="crece"><b>${h(e.n)}</b><span>${h(datosEjercicio(e))}</span>${ya || rg !== 'ok' ? `<span class="insignias">${ya ? '<span class="insignia insignia--bien">Añadido</span>' : ''}${rg === 'evitar' ? '<span class="insignia insignia--error">Evitar por tu lesión</span>' : rg === 'precaucion' ? '<span class="insignia insignia--aviso">Con cuidado</span>' : ''}</span>` : ''}</span>
    ${ya ? ICONOS.check : ICONOS.mas}</button></li>`;
}
function resultadosBuscador() {
  const S = estado();
  const lista = filtrarEjercicios(S, buscador);
  const niveles = nivelesZona(S.perfil);
  return `<p class="meta-lista" role="status">${lista.length} ${lista.length === 1 ? 'ejercicio' : 'ejercicios'} · ${borrador.ejercicios.length} en la sesión</p>
    ${lista.length ? `<ul class="lista">${lista.map(e => filaResultado(e, S, niveles)).join('')}</ul>`
    : '<div class="vacio"><h4>Ningún ejercicio con esos filtros</h4><p>Prueba con otra palabra o quita los filtros.</p><button type="button" class="boton boton--secundario" data-act="mia.limpiarFiltros">Quitar filtros</button></div>'}`;
}
function filtrosBuscador() {
  const S = estado();
  return `${filaFiltro(S, buscador, 'musculo', 'mia.filtro')}${filaFiltro(S, buscador, 'lugar', 'mia.filtro')}${filaFiltro(S, buscador, 'material', 'mia.filtro')}`;
}
function abrirBuscador() {
  Object.assign(buscador, filtroVacio(), { lugar: borrador.lugar });
  const panel = abrirHoja(`<h2>Añadir ejercicios</h2>
    <div class="buscar"><label class="solo-lector" for="mia-buscar">Buscar ejercicio</label>${ICONOS16.buscar}<input id="mia-buscar" type="search" placeholder="press, plancha, crol…" autocomplete="off" enterkeyhint="search"></div>
    <div class="filtros" id="mia-filtros">${filtrosBuscador()}</div>
    <div id="mia-resultados">${resultadosBuscador()}</div>
    <button type="button" class="boton boton--ancho mia-listo" data-act="mia.listo">Listo</button>`, { clase: 'hoja-buscador hoja-pf', alCerrar: () => pintar() });
  const i = panel.querySelector('#mia-buscar'); let t;
  i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { buscador.texto = i.value; repintarResultados(); }, 150); });
}
const repintarResultados = () => { const r = $('#mia-resultados'); if (r) r.innerHTML = resultadosBuscador(); };

// ── Acciones ──
const indice = id => borrador ? borrador.ejercicios.findIndex(x => x.id === id) : -1;
function mover(id, d) {
  const i = indice(id), j = i + d;
  if (i < 0 || j < 0 || j >= borrador.ejercicios.length) return;
  const l = borrador.ejercicios;
  [l[i], l[j]] = [l[j], l[i]];
  anuncio = `${ex(id).n}: puesto ${j + 1} de ${l.length}.`;
  pintar();
}
function errorDe(texto) {
  if (/nombre|llama/i.test(texto)) return { campo: 'nombre', texto };
  if (/ejercicio/i.test(texto)) return { campo: 'ejercicios', texto };
  return { campo: 'general', texto };
}
function leerNombre() { const i = $('#mia-nombre'); if (i && borrador) borrador.nombre = i.value; }

alCambiarSelector({
  'mia.dato': sel => {
    const x = borrador && borrador.ejercicios[indice(sel.dataset.id)];
    if (!x) return;
    const v = valorSelector(sel);
    x[sel.dataset.k] = sel.dataset.k === 'reps' ? String(v) : +v;
    pintar();
  },
});

acciones({
  'mia.volver': async () => {
    leerNombre();
    if (hayCambiosMia() && !await confirmar('¿Salir sin guardar los cambios de esta sesión?', { si: 'Salir sin guardar', no: 'Seguir editando', peligro: true })) return;
    borrador = null; ir('hoy');
  },
  'mia.lugar': el => { leerNombre(); borrador.lugar = el.dataset.v; pintar(); },
  'mia.subir': el => { if (el.getAttribute('aria-disabled') !== 'true') { leerNombre(); mover(el.dataset.id, -1); } },
  'mia.bajar': el => { if (el.getAttribute('aria-disabled') !== 'true') { leerNombre(); mover(el.dataset.id, 1); } },
  'mia.quitar': el => {
    leerNombre();
    const i = indice(el.dataset.id); if (i < 0) return;
    const [x] = borrador.ejercicios.splice(i, 1);
    anuncio = `Quitado: ${ex(x.id).n}.`;
    pintar();
    // El foco pasa al ejercicio que ocupa su sitio (o al anterior, o a «Añadir ejercicios»).
    const sig = borrador.ejercicios[i] || borrador.ejercicios[i - 1];
    const destino = sig ? $(`[data-act="mia.quitar"][data-id="${sig.id}"]`) : $('[data-act="mia.buscar"]');
    if (destino) destino.focus();
  },
  'mia.buscar': () => { leerNombre(); abrirBuscador(); },
  'mia.filtro': el => { buscador[el.dataset.k] = el.dataset.v; marcarEnFila(el); repintarResultados(); },
  'mia.limpiarFiltros': () => {
    Object.assign(buscador, filtroVacio());
    const i = $('#mia-buscar'); if (i) i.value = '';
    const f = $('#mia-filtros'); if (f) f.innerHTML = filtrosBuscador();
    repintarResultados();
    if (i) i.focus();
  },
  'mia.anadir': el => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (borrador.ejercicios.length >= MAX_EJERCICIOS_MIA) { aviso(`Como mucho ${MAX_EJERCICIOS_MIA} ejercicios por sesión.`, 'error'); return; }
    const S = estado();
    const p = propuestaMia(S, el.dataset.id, borrador.ejercicios.filter(x => x.rol !== 'cardio').length);
    if (!p) return;
    borrador.ejercicios.push(p);
    if (borrador.error && borrador.error.campo === 'ejercicios') borrador.error = null;
    anuncio = `Añadido: ${ex(p.id).n}.`;
    const id = el.dataset.id;
    repintarResultados();
    const nuevo = $(`.hoja [data-act="mia.anadir"][data-id="${id}"]`);
    if (nuevo) nuevo.focus();
  },
  'mia.listo': () => cerrarHoja(),
  'mia.guardar': () => {
    leerNombre();
    const nueva = !borrador.id;
    const r = guardarEdicionMia(borrador.id, { nombre: borrador.nombre, lugar: borrador.lugar, ejercicios: borrador.ejercicios });
    if (r.error) {
      borrador.error = errorDe(r.error);
      pintar();
      const foco = borrador.error.campo === 'nombre' ? $('#mia-nombre') : borrador.error.campo === 'ejercicios' ? $('[data-act="mia.buscar"]') || $('#mia-ejs-error') : null;
      if (foco) foco.focus();
      return;
    }
    borrador = null;
    ir('hoy');
    aviso(nueva ? `Guardada en tus sesiones: «${r.mia.nombre}». Hazla desde Hoy, en «Mis sesiones».` : `Cambios guardados en «${r.mia.nombre}»`);
  },
  'mia.borrar': async () => {
    leerNombre();
    const m = miaDe(estado(), borrador && borrador.id); if (!m) return;
    if (!await confirmar(`¿Borrar «${m.nombre}» de tus sesiones? Las sesiones que ya hiciste con ella se quedan.`, { si: `Borrar «${m.nombre}»`, peligro: true })) return;
    borrarMia(m.id);
    borrador = null;
    ir('hoy');
    aviso(`Borrada: «${m.nombre}»`);
  },
});

// Para la prueba de pintado de una copia: el editor de cada una de sus sesiones.
function probar() {
  const antes = borrador;
  try { vista(['nueva']); for (const m of (estado().misSesiones || [])) if (m && m.id) { borrador = null; vista([m.id]); } } finally { borrador = antes; }
}

// Al salir de las rutas del editor el borrador se descarta. Con las pestañas y cambios sin guardar, antes se
// pregunta; con el botón atrás (no se puede parar), se avisa de que no se guardaron.
let saliendo = false;
antesDeCadaRuta(r => {
  if (r.ruta !== 'mia' && borrador) {
    if (hayCambiosMia() && !saliendo) aviso(`No se han guardado los cambios de «${borrador.nombre.trim() || 'la sesión nueva'}».`, 'info');
    borrador = null; saliendo = false;
  }
  return null;
});
if (typeof document !== 'undefined') {
  document.addEventListener('click', async e => {
    const a = e.target.closest && e.target.closest('#nav a[href^="#"]');
    if (!a || rutaActual().ruta !== 'mia' || (leerNombre(), !hayCambiosMia())) return;
    e.preventDefault(); e.stopPropagation();
    if (!await confirmar('¿Salir sin guardar los cambios de esta sesión?', { si: 'Salir sin guardar', no: 'Seguir editando', peligro: true })) return;
    saliendo = true;
    ir(a.getAttribute('href').slice(1));
  }, true);
}

rutas({
  mia: {
    titulo: 'Mis sesiones', pestaña: 'hoy', vista, probar,
    montar: raiz => {
      const i = $('#mia-nombre', raiz);
      if (i) i.addEventListener('input', () => { borrador.nombre = i.value; if (borrador.error && borrador.error.campo === 'nombre') { borrador.error = null; const m = $('#mia-nombre-error'); if (m) m.remove(); i.removeAttribute('aria-invalid'); } });
      devolverFoco(raiz);
      // Lo que acaba de pasar (añadido, quitado, movido) se anuncia tras pintar, para que el lector lo lea.
      const a = anuncio; anuncio = '';
      if (a) setTimeout(() => { const s = $('#mia-anuncio'); if (s) s.textContent = a; }, 50);
    },
  },
});

