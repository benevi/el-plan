// Área ENTRENADOR · interfaz: la semana (crear, ver, reorganizar), el check-in que ajusta la sesión de hoy
// y lo que ve el entrenador de tu progreso. La lógica está en entrenador.js (fachada de dia, plan, checkin e ia).
// Diseño aprobado en DIS 4 (PR 14): el check-in es una hoja a pantalla completa («Antes de empezar») con la
// flecha atrás, controles de un toque (segmentos, chips, selector ± del dolor) y la acción fija abajo; cada
// toque la repinta en su sitio, sin volver arriba (E3).

import { acciones, ir } from '../../nucleo/router.js';
import { estado, cambiar, escuchar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, $$, es, mmss } from '../../nucleo/ui.js';
import { enLinea } from '../../nucleo/api.js';
import { diaSemana, sesionDeHoy, sesionTocada } from '../../nucleo/modelo.js';
import { info as cronometro } from '../sesion/temporizador.js';
import { LUGARES, DIAS, DIAS_CORTOS, MUSCULOS, NIVELES } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { analizarEjercicios, medidorNivel, tendencias } from '../../reglas/contexto.js';
import { sesionesHechas } from '../../reglas/progresion.js';
import {
  crearSesionHoy, crearPlanSemana, planDeLaSemana, planDeHoy, estadoDias, siguientePendiente, reorganizar, noPuedoHoy,
  previaCheckin, diasPorDefecto, tiempoSesion, diaElegido, preguntaAntes, sinEntrenarHoy, SEÑALES, SEÑALES_CORTAS, T2, DESDE, misSesiones, miaDe,
} from './entrenador.js';

export { planDeLaSemana, planDeHoy, estadoDias };

const ENERGIA = ['', 'Muy baja', 'Baja', 'Normal', 'Buena', 'A tope'];
const minus = t => String(t || '').toLowerCase();
// Minutos de una sesión o un día del plan: la misma cuenta en Hoy, la semana, el día y la vista previa del
// check-in (calentamiento + ejercicios + vuelta a la calma), para que no digan cosas distintas.
export const minutosDe = d => +tiempoSesion(d) || 0;
// «1 ejercicio», «5 ejercicios», «6 de 13 series»
export const plural = (n, uno, varios, de = null) => de == null ? `${+n} ${+n === 1 ? uno : varios}` : `${+n} de ${+de} ${+de === 1 ? uno : varios}`;
// Las opciones de minutos siempre incluyen el valor elegido (el del perfil o el del día pueden ser 50 o 40).
const OPCIONES_MIN = [30, 45, 60, 75, 90];
const opcionesMin = m => [...new Set([...OPCIONES_MIN, +m].filter(Boolean))].sort((a, b) => a - b);

// ── Piezas del sistema para las hojas ──
// Segmento (una opción de varias): radiogroup con flechas; .on se queda por compatibilidad.
const segmento = (idEt, opciones, actual, attrs) => `<div class="segmento segmento--ancho" role="radiogroup" aria-labelledby="${idEt}" data-flechas>${opciones.map(([v, t]) => {
  const si = String(v) === String(actual);
  return `<button type="button" role="radio" class="${si ? 'on' : ''}" aria-checked="${si}" tabindex="${si ? 0 : -1}" ${attrs(v)}>${h(t)}</button>`;
}).join('')}</div>`;
// Chip que se marca (aria-pressed y ✓: el estado no va solo por color).
const chip = (on, texto, attrs, extra = '') => `<button type="button" class="chip ${on ? 'on' : ''} ${extra}" aria-pressed="${!!on}" ${attrs}>${ICONOS.check}${h(texto)}</button>`;
// Casilla con aspecto de chip: la casilla nativa (data-cambio) con su caja visible y ✓ al marcarla.
const casilla = (cambio, on, html, extra = '') => `<label class="chip casilla ${extra}"><input type="checkbox" data-no-foco="1" data-cambio="${cambio}" ${on ? 'checked' : ''}><span class="caja" aria-hidden="true">${ICONOS.check}</span><span class="casilla-texto">${html}</span></label>`;
// En la hoja a pantalla completa la ✕ es la flecha atrás de la cabecera («Volver a Hoy»).
function cabeceraPantalla(panel, etiqueta = 'Volver a Hoy') {
  const x = panel && panel.querySelector('.hoja-cab [data-cerrar-hoja]');
  if (!x) return;
  x.innerHTML = ICONOS.atras;
  x.classList.remove('boton-icono--sin-borde');
  x.setAttribute('aria-label', etiqueta);
}

// ── Check-in: lo que cambia la sesión, y enseña qué cambia antes de crearla ──
let ci = null;
// Desplazamiento de la hoja que se recupera al repintarla (E3): cada opción repinta la hoja entera y, sin esto,
// volvía arriba a cada toque. Lo guarda también quien abre otra hoja encima (la confirmación de 7 o más).
let scrollCi = null;
const guardarScrollCi = () => { const v = $('.hoja.checkin'); if (v) scrollCi = v.scrollTop; };

function hojaCheckin({ arriba = false } = {}) {
  const S = estado();
  const vieja = $('.hoja.checkin');
  const top = arriba ? 0 : vieja ? vieja.scrollTop : scrollCi || 0;
  scrollCi = null;
  // Solo zonas del catálogo: su clave va dentro de un id (y del data-eco que lo rellena).
  const zonas = [...new Set([...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona), ...Object.keys(ci.dolorHoy)])].filter(z => Object.prototype.hasOwnProperty.call(ZONAS, z));
  const otras = Object.keys(ZONAS).filter(z => !zonas.includes(z));
  const deLesion = S.perfil.lesiones.filter(l => l.activa).map(l => l.zona);
  // Antes de nada: alarma en un texto libre o lesión sin «desde» (C-ALAR-4, C-LES-6). No se genera nada.
  const pregunta = preguntaAntes(S, ci);
  if (pregunta) return hojaPregunta(pregunta);
  // Si la mía elegida ya no existe (borrada en otra pestaña…), se vuelve a lo de antes.
  if (ci.mia && !miaDe(S, ci.mia)) elegirMia(S, null);
  const pv = previaCheckin(ci);
  const dia = pv.dia;
  const mia = miaDe(S, ci.mia), mias = misSesiones(S);
  const panel = abrirHoja(`<h2>Antes de empezar</h2>
    ${enLinea() ? '' : `<p class="red ci-red" role="status">${ICONOS.sinred}Sin conexión: la prepara la app con sus reglas</p>`}
    <p class="ci-intro">${mia ? `Haces <b>${h(mia.nombre)}</b>${dia && ci.ocuparDia ? `, que cuenta como el día «${h(dia.nombre)}» de tu plan` : ''}. Dime cómo estás y la ajusto a hoy.`
    : dia ? `Toca <b>${h(dia.nombre)}</b> en ${h(minus(LUGARES[dia.lugar]))}. Dime cómo estás y lo ajusto.` : 'Hoy no hay día en tu plan. Te preparo una sesión con lo que te falta esta semana.'}</p>
    ${mias.length ? `<div class="grupo mis-sesiones-ci"><p class="grupo-et" id="ci-g-que">Qué sesión</p><div class="chips" role="group" aria-labelledby="ci-g-que">
      ${chip(!mia, dia ? 'La de mi plan' : 'La que me prepares', 'data-act="entrenador.ciMia" data-v=""')}
      ${mias.map(m => chip(mia && mia.id === m.id, m.nombre, `data-act="entrenador.ciMia" data-v="${h(m.id)}"`)).join('')}</div>
      ${mia && dia ? `<div class="chips">${casilla('entrenador.ciOcupar', ci.ocuparDia, `Cuenta como el día «${h(dia.nombre)}» del plan`)}</div>` : ''}</div>` : ''}
    <div class="grupo"><p class="grupo-et" id="ci-g-lugar">Dónde</p>${segmento('ci-g-lugar', lugaresCi(S, mia).map(l => [l, LUGARES[l]]), ci.lugar, v => `data-act="entrenador.ci" data-k="lugar" data-v="${h(v)}"`)}</div>
    <div class="grupo"><p class="grupo-et" id="ci-g-min">Tiempo <small>minutos</small></p>${segmento('ci-g-min', opcionesMin(ci.minutos).map(m => [m, String(m)]), ci.minutos, v => `data-act="entrenador.ci" data-k="minutos" data-v="${+v}" aria-label="${+v} minutos"`)}</div>
    <div class="grupo"><p class="grupo-et" id="ci-g-energia">Energía: <b>${ENERGIA[ci.energia]}</b></p>${segmento('ci-g-energia', [1, 2, 3, 4, 5].map(n => [n, String(n)]), ci.energia, v => `data-act="entrenador.ci" data-k="energia" data-v="${+v}" aria-label="${+v}: ${ENERGIA[v]}"`)}</div>
    ${zonas.map(z => selectorDolor(z, !deLesion.includes(z))).join('')}
    <div class="grupo"><p class="grupo-et" id="ci-g-mas">¿Te duele algo más?</p><div class="chips" role="group" aria-labelledby="ci-g-mas">${otras.map(z => `<button type="button" class="chip" data-act="entrenador.ciZona" data-v="${z}">${h(ZONAS[z].corta)}</button>`).join('')}</div></div>
    <div class="grupo alarma-ci"><p class="grupo-et">Señales de alarma</p>
      <ul class="señales-cortas">${SEÑALES_CORTAS.map(t => `<li>${h(t)}</li>`).join('')}</ul>
      <details class="tecnica"><summary>Ver la lista completa</summary><ul class="tecnica-texto">${SEÑALES.map(t => `<li>${h(t)}</li>`).join('')}</ul></details>
      <div class="chips">${casilla('entrenador.ciAlarma', ci.alarma, '<b>Hoy noto alguna de estas señales</b> · si la marcas, hoy no se entrena', 'casilla--alarma')}</div></div>
    ${mia ? '' : `<div class="campo"><label for="ci-peticion">Algo que pedir <small>opcional</small></label><input id="ci-peticion" data-no-foco="1" value="${h(ci.peticion)}" placeholder="hoy solo tren superior, la prensa está ocupada…" autocomplete="off" maxlength="2000"></div>`}
    ${htmlPrevia(pv)}
    <div class="ci-accion"><button type="button" class="boton boton--ancho" data-act="entrenador.crearHoy">${ci.alarma ? 'Hoy no entreno' : mia ? `Preparar «${h(mia.nombre)}»` : 'Preparar mi sesión'}</button></div>`, { clase: 'checkin checkin-pantalla' });
  cabeceraPantalla(panel);
  // Se abre arriba (sin foco automático en ningún campo, que bajaba la hoja hasta la casilla de alarma) y,
  // al repintar, se queda donde estaba.
  const hoja = $('.hoja.checkin'); if (hoja) hoja.scrollTop = top;
  const pet = $('#ci-peticion');
  if (!pet) return;
  pet.addEventListener('input', e => { ci.peticion = e.target.value; });
  // Al terminar de escribir solo se repinta la previa: repintar la hoja entera quitaba de debajo del dedo el
  // botón «Preparar mi sesión» y el toque se perdía (PR 12).
  pet.addEventListener('change', () => { const v = $('.hoja.checkin .previa'); if (v) v.outerHTML = htmlPrevia(previaCheckin(ci)); });
}
// Dolor de hoy por zona: selector ± del sistema (un toque, sin teclado del móvil). El deslizador nativo se queda
// como ÚNICO control accesible (flechas, Re Pág/Av Pág, Inicio y Fin) sin verse: el valor grande es su eco y los
// botones ± son solo para el dedo (fuera del orden de Tab y del lector: una parada y un control por zona).
function selectorDolor(z, quitable) {
  const v = +ci.dolorHoy[z] || 0, nombre = ZONAS[z].corta;
  return `<div class="grupo"><div class="selector selector--dolor">
    <label class="selector-et" for="ci-r-${h(z)}">Dolor hoy · ${h(nombre)}</label>
    <div class="selector-valor" aria-hidden="true"><b id="ci-${h(z)}">${v}</b><span>de 10</span></div>
    <input type="range" class="solo-lector" id="ci-r-${h(z)}" min="0" max="10" step="1" value="${v}" aria-valuetext="${v} de 10" data-no-foco="1" data-cambio="entrenador.ciDolor" data-z="${h(z)}" data-eco="ci-${h(z)}">
    <div class="selector-pasos" aria-hidden="true"><button type="button" tabindex="-1" data-act="entrenador.ciDolorPaso" data-z="${h(z)}" data-v="-1" aria-disabled="${v <= 0}">${ICONOS.menos}</button><button type="button" tabindex="-1" data-act="entrenador.ciDolorPaso" data-z="${h(z)}" data-v="1" aria-disabled="${v >= 10}">${ICONOS.mas}</button></div>
    ${quitable ? `<button type="button" class="boton boton--texto selector-nota" data-act="entrenador.ciQuitarZona" data-v="${h(z)}">Quitar ${h(minus(nombre))}</button>` : ''}
  </div></div>`;
}
// «Pedírsela igualmente al entrenador IA» solo cuando de verdad se puede pedir: no con dolor de 7 o más, con
// datos de salud que piden la sesión suave, con una de «Mis sesiones», sin red ni con la casilla de alarma
// (C-DOLOR-4, C-SALUD-1, C-ALAR-1; E12). Con la casilla ya marcada sigue a la vista para poder quitarla.
const puedeForzarIA = pv => enLinea() && !ci.mia && !ci.alarma && !['dolor', 'salud', 'mia', 'red'].includes(pv.ia.por) && (!pv.ia.usar || ci.forzarIA);
function htmlPrevia(pv) {
  return `<section class="previa" aria-live="polite" aria-labelledby="ci-t-previa">
      <h3 id="ci-t-previa">Con lo que me dices</h3>
      ${pv.cambios.length ? `<ul>${pv.cambios.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : `<p>${ci.mia ? 'Nada cambia: haces tu sesión tal como la guardaste.' : 'Nada cambia: haces el día tal como estaba previsto.'}</p>`}
      <p>${plural(pv.datos.ejercicios.length, 'ejercicio', 'ejercicios')}, unos ${+pv.minutos} min con calentamiento y estiramientos.</p>
      <p class="porque">${ICONOS.ia}<span>${h(pv.ia.motivo)}</span></p>
      ${puedeForzarIA(pv) ? `<div class="chips">${casilla('entrenador.ciIA', ci.forzarIA, 'Pedírsela igualmente al entrenador IA')}</div>` : ''}
    </section>`;
}

// Pregunta que bloquea el check-in hasta contestarla: alarma en un texto (C-ALAR-4) o «¿desde cuándo?» (C-LES-6).
function hojaPregunta(p) {
  if (p.tipo === 'alarma') {
    abrirHoja(`<h2>Antes de preparar nada</h2>
      <p class="hoja-texto">${h(p.texto)}</p>
      <ul class="señales-cortas">${SEÑALES.slice(0, 4).map(t => `<li>${h(t)}</li>`).join('')}</ul>
      <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="entrenador.ciRespAlarma" data-v="no">No, hoy no noto nada de eso</button><button type="button" class="boton" data-act="entrenador.ciRespAlarma" data-v="si">Sí, lo noto</button></div>`, { clase: 'checkin' });
    return;
  }
  abrirHoja(`<h2>${h(p.texto)}</h2>
    ${p.zonas.map(z => `<div class="grupo"><p class="grupo-et" id="ci-desde-${h(z)}">${h(ZONAS[z] ? ZONAS[z].corta : z)}</p><div class="chips" role="group" aria-labelledby="ci-desde-${h(z)}">${Object.entries(DESDE).map(([k, [n]]) => chip((ci.desde || {})[z] === k, n, `data-act="entrenador.ciDesde" data-z="${h(z)}" data-v="${k}"`)).join('')}</div></div>`).join('')}
    <p class="ayuda">Lo guardo en tu lesión. «No lo sé» la trata como reciente, que es lo más prudente.</p>`, { clase: 'checkin' });
}
function hojaAlarma() {
  abrirHoja(`<h2>Hoy no toca entrenar</h2>${T2.map(t => `<p class="hoja-texto">${h(t)}</p>`).join('')}<button type="button" class="boton boton--ancho" data-act="entrenador.cerrarAlarma">Entendido</button><button type="button" class="boton boton--texto centro" data-act="entrenador.deshacerAlarma">La marqué por error</button>`, { clase: 'checkin precaucion' });
}

// Dolor con que se rellena el check-in (C-DOLOR-0): el último de un check-in de hace ≤ 3 días; si no, el de
// la ficha con tope 6 (así una ficha a 9 no lleva sola al día de dolor alto).
function dolorInicial(S, l) {
  const limite = Date.now() - 3 * 864e5;
  const ult = Object.values(S.sesiones).filter(s => s.checkin && s.checkin.dolor && s.checkin.dolor[l.zona] != null && new Date(s.creada || s.fecha) >= limite)
    .sort((a, b) => String(b.creada).localeCompare(String(a.creada)))[0];
  return ult ? +ult.checkin.dolor[l.zona] : Math.min(6, +l.dolor || 0);
}

// op.mia: id de una de «Mis sesiones» ya elegida (desde Hoy sin plan).
export function abrirCheckin(diaPlan = null, op = {}) {
  revisarBajadaNivel();
  const S = estado();
  // Alarma confirmada hoy: no hay check-in ni sesión (C-ALAR-1).
  if (sinEntrenarHoy(S)) { hojaAlarma(); return; }
  const p = diaElegido(S, diaPlan);
  // La petición que no se pudo atender en la sesión de hoy se conserva al volver a ajustarla (PR 12).
  const deHoy = sesionDeHoy(S);
  const pendiente = deHoy && deHoy.estado === 'pendiente' && deHoy.iaFallo && deHoy.iaFallo.peticion ? deHoy.iaFallo.peticion : '';
  // «Volver a ajustarla» una sesión hecha desde una mía: se vuelve a elegir esa mía (y si ocupaba el día, sigue).
  const deMia = deHoy && deHoy.estado === 'pendiente' && deHoy.origen && deHoy.origen.tipo === 'mia' && miaDe(S, deHoy.origen.id) ? deHoy : null;
  const enlazado = deMia && S.plan && S.plan.hechos ? Object.entries(S.plan.hechos).find(([, id]) => id === deMia.id) : null;
  ci = { diaPlan: p ? p.diaSemana : null, lugar: p ? p.lugar : S.perfil.lugares[0], minutos: (p && p.minutos) || S.perfil.disponibilidad.minutos, energia: 3, dolorHoy: {}, peticion: pendiente, forzarIA: false };
  // Si hoy no toca, adelanta el siguiente día pendiente.
  if (!p) { const sig = siguientePendiente(S); if (sig) { ci.diaPlan = sig.diaSemana; ci.lugar = sig.lugar; ci.minutos = sig.minutos || ci.minutos; } }
  S.perfil.lesiones.filter(l => l.activa).forEach(l => { ci.dolorHoy[l.zona] = dolorInicial(S, l); });
  const mia = op.mia || (deMia && deMia.origen.id);
  if (mia) elegirMia(S, mia);
  if (enlazado) { ci.diaPlan = +enlazado[0]; ci.ocuparDia = true; }
  hojaCheckin({ arriba: true });
}
// Lugares del check-in: los del perfil y, con una de «Mis sesiones», también el suyo (PR 16).
const lugaresCi = (S, mia) => (mia && LUGARES[mia.lugar] && !S.perfil.lugares.includes(mia.lugar) ? [...S.perfil.lugares, mia.lugar] : S.perfil.lugares);

// Elegir (o dejar) una de «Mis sesiones» en el check-in: su lugar y su tiempo; sin petición ni IA.
// Lo de antes (lugar, minutos, petición, IA) se aparta y vuelve al dejarla («La de mi plan»).
function elegirMia(S, id) {
  const m = miaDe(S, id);
  if (!m) {
    if (ci.antesMia) Object.assign(ci, ci.antesMia);
    ci.mia = null; ci.ocuparDia = false; delete ci.antesMia;
    return;
  }
  if (!ci.antesMia) ci.antesMia = { lugar: ci.lugar, minutos: ci.minutos, peticion: ci.peticion, forzarIA: ci.forzarIA };
  ci.mia = m.id;
  ci.peticion = ''; ci.forzarIA = false;
  ci.lugar = m.lugar; // su lugar, aunque no esté entre los del perfil (C-MIA-1: tal cual); se puede cambiar
  if (m.minutos) ci.minutos = OPCIONES_MIN.find(x => x >= m.minutos) || 90;
}

// Dolor de una zona (el deslizador o el selector ±). Pasar a 7 o más lleva al día de dolor alto: se
// confirma (C-DOLOR-0) y, si no, se queda como estaba.
// Después, el foco va al control de dolor de esa zona (también al volver de la confirmación).
const focoDolor = z => { const r = document.getElementById('ci-r-' + z); if (r) { try { r.focus({ preventScroll: true }); } catch { /* nada */ } } };
async function ponerDolor(z, v) {
  v = Math.max(0, Math.min(10, Math.round(+v || 0)));
  const antes = +ci.dolorHoy[z] || 0;
  if (v >= 7 && antes < 7) {
    guardarScrollCi();
    if (!await confirmar('¿Hoy de verdad 7 o más?', { si: 'Sí, 7 o más', no: 'No' })) { hojaCheckin(); focoDolor(z); return; }
  }
  ci.dolorHoy[z] = v; hojaCheckin(); focoDolor(z);
}

// Señal de alarma marcada o confirmada: se apunta y no se prepara nada (C-ALAR-1).
async function crearConAlarma() {
  const r = await crearSesionHoy({ ...ci, alarma: !!ci.alarma });
  if (r.alarma) hojaAlarma();
}

// ── Espera de la IA (PR 12) ──
// Una sola petición a la vez (enCurso). La hoja no se cierra tocando fuera: se sale cuando llega la respuesta
// o con «Cancelar y hacerla con la app», que corta la petición (AbortController) y deja lo de las reglas al
// momento. La respuesta solo lleva a la sesión si la persona sigue en la misma pantalla que al empezar.
// Los pasos se marcan según avanza: conectando → pensando → escribiendo (con el número de ejercicios o días).
let enCurso = null;
export const esperandoIA = () => !!enCurso;
const PASOS = {
  sesion: ['Conectando con tu entrenador…', 'Pensando tu sesión con tus datos…', 'Escribiendo tu sesión…'],
  plan: ['Conectando con tu entrenador…', 'Pensando tu semana con tus datos…', 'Escribiendo tu semana…'],
};
const TEXTO_FASE = {
  sesion: p => p.fase === 'escribiendo' ? `Escribiendo tu sesión${p.ejercicios ? ` · ${plural(p.ejercicios, 'ejercicio', 'ejercicios')}` : ''}…` : 'Pensando tu sesión con tus datos…',
  plan: p => p.fase === 'escribiendo' ? `Escribiendo tu semana${p.dias ? ` · día ${+p.dias}${p.de ? ` de ${+p.de}` : ''}` : ''}…` : 'Pensando tu semana con tus datos…',
};
const htmlPasos = (tipo, paso, texto) => PASOS[tipo].map((t, i) => `<li class="${i < paso ? 'hecho' : i === paso ? 'ahora' : ''}"${i === paso ? ' aria-current="step"' : ''}><span class="marca-paso" aria-hidden="true">${i < paso ? ICONOS.check : i === paso ? '<span class="giro"></span>' : ''}</span><span>${h(i === paso && texto ? texto : t)}</span></li>`).join('');
function pintarPaso(tipo, paso, texto) {
  const l = $('#espera-pasos'); if (l) l.innerHTML = htmlPasos(tipo, paso, texto);
  const f = $('#espera-fase'); if (f) f.textContent = texto;
}
async function conEspera(tipo, titulo, hacer) {
  if (enCurso) { aviso('Ya estoy preparando una, espera a que termine.', 'info'); return null; }
  const ctrl = new AbortController();
  const yo = { tipo, ctrl, hash: location.hash, inicio: Date.now() };
  enCurso = yo;
  abrirHoja(`<h2>${h(titulo)}</h2>
    <ol class="espera-pasos" id="espera-pasos">${htmlPasos(tipo, 0)}</ol>
    <p class="solo-lector" id="espera-fase" aria-live="polite">${h(PASOS[tipo][0])}</p>
    <p class="espera-tiempo"><span class="cifra" id="espera-tiempo">0:00</span>. Suele tardar entre 20 y 90 segundos.</p>
    <button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.cancelarIA" data-atras data-atras-pregunta="¿Cancelar y hacerla con la app?">Cancelar y hacerla con la app</button>`, { clase: 'espera', fija: true });
  const reloj = setInterval(() => { const t = $('#espera-tiempo'); if (t) t.textContent = mmss((Date.now() - yo.inicio) / 1000); }, 1000);
  const alProgreso = p => { if (enCurso === yo) pintarPaso(tipo, p && p.fase === 'escribiendo' ? 2 : 1, TEXTO_FASE[tipo](p || {})); };
  try {
    return await hacer({ signal: ctrl.signal, alProgreso });
  } finally {
    clearInterval(reloj);
    if (enCurso === yo) enCurso = null;
    if ($('.hoja.espera')) cerrarHoja();
  }
}
const mismaPantalla = hash => location.hash === hash;

// Prepara la sesión de hoy (con o sin IA) y lleva a ella. op.reintento: id de la sesión de la app a rehacer.
async function prepararSesion(datos, op = {}) {
  const pv = previaCheckin(datos);
  const usaIA = pv.ia.usar && enLinea(); // ya cuenta forzarIA, salvo con dolor ≥ 7 o salud (C-DOLOR-4)
  const hash = location.hash;
  const r = usaIA
    ? await conEspera('sesion', 'Tu entrenador está preparando la sesión', o => crearSesionHoy(datos, { ...o, ...op }))
    : await crearSesionHoy(datos, op);
  if (!r) return;
  if (r.alarma) { hojaAlarma(); return; }
  // Si antes hay que preguntar algo, el reintento sigue en ci: al contestar se sustituye la misma sesión.
  if (r.pregunta) { ci = { ...datos, ...(op.reintento ? { reintento: op.reintento } : {}) }; hojaPregunta(r.pregunta); return; }
  if ($('.hoja.checkin')) cerrarHoja();
  if (r.descartada) { aviso(op.reintento ? 'Ya has empezado a apuntar en esta sesión: la dejo como está.' : 'Mientras tanto ya tenías otra sesión de hoy: la dejo como está.', 'info'); return; }
  if (r.aviso) aviso(r.aviso, 'info'); else if (r.motivo) aviso(r.motivo, 'info');
  if (r.sesion && (mismaPantalla(hash) || !usaIA)) ir('sesion/' + r.sesion.id);
  else if (r.sesion) aviso('Tu sesión está lista en Hoy.', 'info');
}

// ── Nota fija «La ha hecho la app porque…» (sesión de hoy y semana): aviso del sistema con su acción ──
const enlaceCodigo = motivo => /código de acceso/.test(motivo) ? '<button type="button" class="boton boton--secundario" data-act="perfil.irAjustes">Cambiar el código en Perfil › Ajustes</button>' : '';
export function notaFallo(s) {
  const f = s && s.iaFallo;
  if (!f) return '';
  // Nada de rehacerla si ya ha apuntado algo (kilos, series, comentarios, cambios) o tiene el cronómetro en marcha.
  const crono = cronometro();
  const tocada = sesionTocada(s) || !!(crono && crono.meta && crono.meta.sesion === s.id);
  const puede = s.estado === 'pendiente' && !tocada && f.reintentable !== false;
  const acciones = [puede && enLinea() ? `<button type="button" class="boton boton--secundario" data-act="entrenador.reintentarIA" data-v="${h(s.id)}">${ICONOS.ia}Reintentar con IA</button>` : '', enlaceCodigo(f.motivo)].join('');
  return `<div class="aviso aviso--aviso nota-fallo" role="note">${ICONOS.alerta}<div class="aviso-texto">
    <p><b>La ha hecho la app</b> porque ${h(f.motivo)}.</p>
    ${f.peticion ? (f.atendido
    ? `<p>De lo que pediste («${h(f.peticion)}»), la app ha hecho lo que entiende: ${h(f.atendido)}. Lo demás no lo he podido atender: sin el entrenador IA, la app solo entiende si pides tren superior o inferior.</p>`
    : `<p>No he podido atender lo que pediste: «${h(f.peticion)}».</p>`) : ''}
    ${puede && !enLinea() ? '<p>Cuando tengas conexión podrás reintentarlo con la IA.</p>' : ''}
    ${acciones ? `<div class="aviso-acciones">${acciones}</div>` : ''}
  </div><span></span></div>`;
}
function notaFalloPlan(p) {
  const f = p && p.iaFallo;
  if (!f) return '';
  const acciones = [enLinea() ? `<button type="button" class="boton boton--secundario" data-act="entrenador.reintentarPlan">${ICONOS.ia}Reintentar con IA</button>` : '', enlaceCodigo(f.motivo)].join('');
  return `<div class="aviso aviso--aviso nota-fallo" role="note">${ICONOS.alerta}<div class="aviso-texto">
    <p><b>La semana la ha hecho la app</b> porque ${h(f.motivo)}.</p>
    ${enLinea() ? '' : '<p>Cuando tengas conexión podrás reintentarlo con la IA.</p>'}
    ${acciones ? `<div class="aviso-acciones">${acciones}</div>` : ''}
  </div><span></span></div>`;
}

// ── Crear o rehacer la semana ──
let ps = null;
function hojaPlan() {
  const S = estado(), hoy = diaSemana(), hechos = estadoDias(S).filter(d => d.estado === 'hecho').map(d => d.diaSemana);
  const libres = ps.dias.filter(d => d >= hoy && !hechos.includes(d));
  const red = enLinea();
  abrirHoja(`<h2>Tu semana</h2>
    <p class="hoja-texto">Marca los días que puedes entrenar <b>esta semana</b>. Si cambia algo a mitad de semana, vuelve aquí y lo reorganizo.</p>
    <div class="chips dias" role="group" aria-label="Días">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="chip ${ps.dias.includes(i) ? 'on' : ''} ${i < hoy ? 'pasado' : ''}" aria-pressed="${ps.dias.includes(i)}" data-act="entrenador.psDia" data-v="${i}" ${hechos.includes(i) || i < hoy ? 'disabled aria-disabled="true"' : ''} aria-label="${h(DIAS[i])}${hechos.includes(i) ? ': ya hecho' : i < hoy ? ': ya ha pasado' : ''}">${ICONOS.check}${DIAS_CORTOS[i]}</button>`).join('')}</div>
    <div class="grupo"><p class="grupo-et" id="ps-g-min">Minutos por sesión</p>${segmento('ps-g-min', opcionesMin(ps.minutos).map(m => [m, String(m)]), ps.minutos, v => `data-act="entrenador.psMin" data-v="${+v}" aria-label="${+v} minutos"`)}</div>
    <div class="grupo"><p class="grupo-et" id="ps-g-lugar">Dónde</p><div class="chips" role="group" aria-labelledby="ps-g-lugar">${S.perfil.lugares.map(l => chip(ps.lugares.includes(l), LUGARES[l], `data-act="entrenador.psLugar" data-v="${h(l)}"`)).join('')}</div></div>
    ${libres.length ? `<div class="hoja-botones"><button type="button" class="boton boton--ancho" data-act="entrenador.crearPlan" data-ia="1" ${red ? '' : 'disabled aria-disabled="true" aria-describedby="ps-sin-red"'}>${ICONOS.ia}Que me la monte el entrenador IA</button>
      ${red ? '' : '<p class="boton-motivo" id="ps-sin-red">Necesita conexión. Mientras tanto, hazla con la app.</p>'}
      <button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.crearPlan" data-ia="0">Hacerla con la app (sin gastar IA)</button></div>
      <p class="ayuda">${plural(libres.length, 'día', 'días')} por planificar${hechos.length ? '; lo que ya has hecho se queda' : ''}.</p>`
    : '<p class="ayuda">Marca al menos un día de hoy en adelante.</p>'}`);
}
// Los días que ya han pasado (sin hacer) no se marcan ni cuentan: ni para la semana ni para el perfil (E2).
const diasVivos = (S, dias) => { const hoy = diaSemana(), hechos = estadoDias(S).filter(d => d.estado === 'hecho').map(d => d.diaSemana); return dias.filter(d => d >= hoy || hechos.includes(d)); };
export function abrirPlan() {
  const S = estado(), d = S.perfil.disponibilidad, p = planDeLaSemana(S);
  ps = { dias: diasVivos(S, p ? p.dias.map(x => x.diaSemana) : diasPorDefecto(S)), minutos: d.minutos, lugares: S.perfil.lugares.slice() };
  hojaPlan();
}

// ── Reorganizar lo que queda ──
let ro = null, roHoyNo = false;
function hojaReorganizar() {
  const S = estado(), hoy = diaSemana();
  const pend = estadoDias(S).filter(d => d.estado !== 'hecho');
  abrirHoja(`<h2>Reorganizar la semana</h2>
    <p class="hoja-texto">Te quedan: ${pend.map(d => `<b>${h(d.nombre)}</b>`).join(', ') || 'nada'}. ¿Qué días puedes de aquí al domingo?</p>
    <div class="chips dias" role="group" aria-label="Días">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="chip ${ro.includes(i) ? 'on' : ''}" aria-pressed="${ro.includes(i)}" data-act="entrenador.roDia" data-v="${i}" ${i < hoy ? 'disabled aria-disabled="true"' : ''} aria-label="${h(DIAS[i])}${i < hoy ? ': ya ha pasado' : ''}">${ICONOS.check}${DIAS_CORTOS[i]}</button>`).join('')}</div>
    <p class="ayuda">Si caben, muevo los días tal cual. Si no, los junto en sesiones de cuerpo completo con lo que aún no has trabajado.</p>
    <button type="button" class="boton boton--ancho" data-act="entrenador.reorganizar">Reorganizar</button>`);
}

// ── Tarjeta del plan (la usa Hoy) ──
const ETIQUETA = { hecho: 'Hecho', hoy: 'Hoy', pendiente: '', saltado: 'No hecho', noPuedo: 'Hoy no puedes' };
// Un «Hoy no puedo» de un día que ya pasó es un día no entrenado.
const etiquetaDia = d => (d.estado === 'noPuedo' && d.diaSemana < diaSemana() ? 'No entrenado' : ETIQUETA[d.estado]);
export function tarjetaPlan(S) {
  const p = planDeLaSemana(S);
  if (!p) return '';
  const dias = estadoDias(S);
  const saltados = dias.filter(d => d.estado === 'saltado');
  const ultimoCambio = (p.cambios || []).slice(-1)[0];
  return `<section class="bloque plan-semana" aria-labelledby="t-semana">
    <div class="bloque-fila"><h2 class="bloque-titulo" id="t-semana">Tu semana</h2><p>${p.fuente === 'ia' ? 'entrenador IA' : 'hecha por la app'}</p></div>
    ${p.resumen ? `<p class="plan-resumen">${h(p.resumen)}</p>` : ''}
    ${notaFalloPlan(p)}
    ${saltados.length ? `<div class="aviso aviso--aviso" role="status">${ICONOS.alerta}<div class="aviso-texto"><b>No hiciste ${saltados.map(d => h(minus(DIAS[d.diaSemana]))).join(' ni ')}</b><p>${saltados.map(d => h(d.nombre)).join(', ')}.</p>
      <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="entrenador.reorg">Reorganizar lo que queda</button></div></div><span></span></div>` : ''}
    ${ultimoCambio ? `<p class="plan-cambio">${h(ultimoCambio.texto)}</p>` : ''}
    <ul class="lista dias-plan">${dias.map(d => `<li class="${d.estado === 'saltado' || d.estado === 'hecho' ? 'apagada' : ''}">
      <button type="button" class="fila" data-act="entrenador.verDia" data-v="${+d.diaSemana}">
        <span class="grow"><b>${h(DIAS[d.diaSemana])}: ${h(d.nombre)}</b><span>${h(LUGARES[d.lugar])}, ${plural(d.ejercicios.length, 'ejercicio', 'ejercicios')}, unos ${minutosDe(d)} min</span></span>
        ${etiquetaDia(d) ? `<span class="estado-dia estado-dia--${h(d.estado)}">${d.estado === 'hecho' ? ICONOS.check : d.estado === 'saltado' || d.estado === 'noPuedo' ? ICONOS.x : ''}${etiquetaDia(d)}</span>` : ''}${ICONOS.sig}</button></li>`).join('')}</ul>
    <details class="tecnica"><summary>Por qué esta semana</summary>
      ${p.criterios ? `<p class="tecnica-texto">${h(p.criterios)}</p>` : ''}${p.progresion ? `<p class="tecnica-texto"><b>Progresión:</b> ${h(p.progresion)}</p>` : ''}
    </details>
    <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="entrenador.plan">Cambiar días</button>${dias.some(d => d.estado === 'hoy') ? '<button type="button" class="boton boton--secundario" data-act="entrenador.hoyNo">Hoy no puedo</button>' : ''}</div>
  </section>`;
}

// Ver un día del plan con sus ejercicios.
function hojaDia(n) {
  const S = estado(), d = estadoDias(S).find(x => x.diaSemana === n); if (!d) return;
  const fila = x => { const e = ex(x.id); return e ? `<li><b>${h(e.n)}</b> <span class="texto-2">${+x.series} × ${h(x.reps)}${x.rol === 'rehab' ? ', rehabilitación' : x.rol === 'cardio' ? ', cardio' : ''}</span>${x.nota ? `<br><small>${h(x.nota)}</small>` : ''}</li>` : ''; };
  abrirHoja(`<h2>${h(DIAS[n])}: ${h(d.nombre)}</h2>
    <p class="hoja-texto">${h(LUGARES[d.lugar])}, unos ${minutosDe(d)} min${d.foco ? '. ' + h(d.foco) : ''}.</p>
    ${d.explicacion.length ? `<p class="porque porque-linea">${ICONOS.ia}<span>${h(d.explicacion[0])}</span></p>` : ''}
    <h3>Calentamiento</h3><ul class="lista-dia">${d.calentamiento.map(t => `<li>${h(t.nombre)} <span class="texto-2">${h(t.duracion || '')}</span></li>`).join('')}</ul>
    <h3>Trabajo</h3><ul class="lista-dia">${d.ejercicios.map(fila).join('')}</ul>
    <h3>Vuelta a la calma</h3><ul class="lista-dia">${d.vuelta.map(t => `<li>${h(t.nombre)} <span class="texto-2">${h(t.duracion || '')}</span></li>`).join('')}</ul>
    ${d.explicacion.length > 1 ? `<details class="tecnica"><summary>Más detalle</summary><ul class="tecnica-texto">${d.explicacion.slice(1).map(t => `<li>${h(t)}</li>`).join('')}</ul></details>` : ''}
    <div class="hoja-botones">${d.estado === 'hecho' ? `<a class="boton boton--secundario boton--ancho" href="#sesion/${h(d.sesion)}">Ver lo que hiciste</a>` : `<button type="button" class="boton boton--ancho" data-act="entrenador.hacerDia" data-v="${+n}">Hacer este día hoy</button>`}</div>`, { clase: 'dia-plan' });
}

// ── Lo que ve tu entrenador (análisis del progreso con su consecuencia) ──
export function tarjetaAnalisis(S) {
  const an = Object.values(analizarEjercicios(S));
  if (!sesionesHechas(S).length) return '';
  const t = tendencias(S);
  const grupo = (est, titulo) => { const l = an.filter(a => a.estado === est); return l.length ? `<li><b>${titulo}:</b> ${l.slice(0, 4).map(a => h(ex(a.id).n) + (a.desde ? ` <span class="tenue">(${h(a.desde)})</span>` : a.cambio ? ` <span class="tenue">(${a.cambio > 0 ? '+' : ''}${+a.cambio} %)</span>` : '')).join(', ')}. <span class="tenue">${h(l[0].accion)}</span></li>` : ''; };
  return `<section class="tarjeta">
    <h2>Lo que ve tu entrenador</h2>
    <ul class="analisis">
      ${grupo('progresa', 'Progresan')}${grupo('estancado', 'Estancados')}${grupo('molesta', 'Te molestan')}
      <li><b>Constancia:</b> ${es(t.sesionesPorSemana)} sesiones por semana (${t.constancia == null ? 'aún sin semanas completas' : +t.constancia + ' % de lo previsto'})${t.esfuerzoMedio ? `, esfuerzo medio ${es(t.esfuerzoMedio)}/5` : ''}.</li>
      ${t.cambioPeso4sem != null ? `<li><b>Peso:</b> ${t.cambioPeso4sem > 0 ? '+' : ''}${es(t.cambioPeso4sem)} kg en 4 semanas.</li>` : ''}
      ${t.dolor.map(d => `<li><b>Dolor de ${h(minus(d.nombre))}:</b> ${es(d.media14)}/10 de media${d.tendencia === 'sube' ? ' (sube: más rehabilitación)' : d.tendencia === 'baja' ? ' (baja)' : ''}.</li>`).join('')}
    </ul></section>`;
}

// Medidor de nivel (lo pinta Perfil).
export function bloqueMedidor(S) {
  const m = medidorNivel(S);
  return `<div class="medidor">
    ${m.criterios.length ? `<p class="tenue">Para subir a ${h(minus(NIVELES[m.nivel + 1]))}:</p><ul class="criterios">${m.criterios.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? ICONOS.check : '○'} ${h(c.que)} <span class="tenue">· ${h(c.valor)}</span></li>`).join('')}</ul>` : '<p class="tenue">Nivel máximo.</p>'}
    ${m.sugerido !== m.nivel && !S.perfil.nivelAuto ? `<p class="nota">${h(m.motivo)} <button class="enlace" data-act="entrenador.aplicarNivel">Pasar a ${h(minus(NIVELES[m.sugerido]))}</button></p>` : ''}
    ${(S.perfil.nivelCambios || []).slice(-2).map(c => `<p class="tenue">${h(c.fecha.slice(0, 10))}: ${h(NIVELES[c.de])} → ${h(NIVELES[c.a])}. ${h(c.motivo)}</p>`).join('')}
  </div>`;
}
function aplicarNivel(auto) {
  const S = estado(), m = medidorNivel(S);
  if (m.sugerido === m.nivel) return;
  cambiar(S2 => {
    S2.perfil.nivel = m.sugerido;
    S2.perfil.nivelCambios = [...(S2.perfil.nivelCambios || []), { fecha: new Date().toISOString(), de: m.nivel, a: m.sugerido, motivo: m.motivo }];
  }, 'perfil');
  const baja = m.sugerido < m.nivel;
  aviso(baja ? `${m.motivo} Pasas a ${minus(NIVELES[m.sugerido])}.` : `${auto ? 'Tu progreso te sube' : 'Pasas'} a ${minus(NIVELES[m.sugerido])}. El entrenador lo usará desde la próxima sesión.`);
}
// C-NIVEL-3 con «Que mi progreso me cambie de nivel» (COD-2): tras 56 días sin entrenar baja un nivel antes de la
// primera sesión, al abrir la app o el check-in (al terminar esa sesión ya no se ve el parón).
export function revisarBajadaNivel() {
  const S = estado(); if (!S || !S.dueño || !S.perfil.nivelAuto) return false;
  const m = medidorNivel(S);
  if (!(m.sugerido < m.nivel)) return false;
  aplicarNivel(true);
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('pipos:arrancado', () => { try { revisarBajadaNivel(); } catch (e) { console.error('Nivel', e); } });
// Al terminar sesiones, el medidor revisa el nivel si el perfil lo permite.
let hechasVistas = -1;
escuchar(motivo => {
  if (/^(perfil|plan|nivel)/.test(motivo)) return;
  const S = estado(); if (!S || !S.dueño) return;
  const n = sesionesHechas(S).length;
  if (n === hechasVistas) return;
  const primera = hechasVistas < 0; hechasVistas = n;
  if (primera || !S.perfil.nivelAuto) return;
  if (medidorNivel(S).sugerido !== S.perfil.nivel) setTimeout(() => aplicarNivel(true), 0);
});

async function montarPlan(datos, conIA) {
  const usaIA = conIA && enLinea();
  const r = usaIA
    ? await conEspera('plan', 'Tu entrenador está montando la semana', o => crearPlanSemana(datos, { conIA: true, ...o }))
    : await crearPlanSemana(datos, { conIA });
  if (!r) return;
  if ($('.hoja') && !$('.hoja.espera')) cerrarHoja();
  if (r.descartada) { aviso('Mientras tanto cambió tu semana: la dejo como está.', 'info'); return; }
  aviso(r.aviso || 'Semana lista', r.aviso ? 'info' : '');
}


// Segmentos (radiogroup) con el teclado: flechas, Inicio y Fin mueven y eligen (como un grupo de radio nativo).
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    const b = e.target && e.target.closest && e.target.closest('[role="radiogroup"][data-flechas] [role="radio"]');
    if (!b || !['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const todos = $$('[role="radio"]', b.parentNode), i = todos.indexOf(b);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? todos.length - 1 : (i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + todos.length) % todos.length;
    e.preventDefault();
    try { todos[j].focus(); } catch { /* nada */ }
    todos[j].click();
  });
}
// Con o sin red, el check-in lo dice al momento (y quita o pone «Pedírsela igualmente al entrenador IA»).
function alCambiarRed() { if (ci && $('.hoja.checkin-pantalla') && !$('.hoja.espera')) hojaCheckin(); }
if (typeof window !== 'undefined') { window.addEventListener('online', alCambiarRed); window.addEventListener('offline', alCambiarRed); }

acciones({
  'entrenador.prepararHoy': () => abrirCheckin(),
  'entrenador.ci': el => { const k = el.dataset.k; ci[k] = k === 'lugar' ? el.dataset.v : +el.dataset.v; hojaCheckin(); },
  'entrenador.ciDolor': el => ponerDolor(el.dataset.z, el.value),
  // Selector ± del dolor: un punto arriba o abajo (en los extremos no hace nada).
  'entrenador.ciDolorPaso': el => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    const z = el.dataset.z;
    return ponerDolor(z, (+ci.dolorHoy[z] || 0) + +el.dataset.v);
  },
  'entrenador.ciAlarma': el => { ci.alarma = el.checked; hojaCheckin(); },
  'entrenador.ciRespAlarma': el => {
    const p = preguntaAntes(estado(), ci);
    if (el.dataset.v === 'si') { ci.alarmaRespuesta = 'si'; ci.alarmaFrase = p && p.frase; crearConAlarma(); return; }
    // «No»: se apunta esa frase y, si hay otra, se pregunta por ella (sin volver a la misma).
    if (p) ci.alarmasNo = [...(ci.alarmasNo || []), p.frase];
    hojaCheckin();
  },
  'entrenador.ciDesde': el => { ci.desde = { ...(ci.desde || {}), [el.dataset.z]: el.dataset.v }; hojaCheckin(); },
  'entrenador.cerrarAlarma': () => { cerrarHoja(); ir('hoy'); },
  // Casilla o respuesta de alarma marcada sin querer: se quita la de hoy, tras confirmarlo (C-ALAR-1).
  'entrenador.deshacerAlarma': async () => {
    if (!await confirmar('¿Seguro que hoy no notas ninguna de esas señales?', { si: 'No noto ninguna', no: 'Sí noto algo' })) return;
    const hoy = hoyISO();
    cambiar(S => { S.alarmas = (S.alarmas || []).filter(a => !(a.fecha === hoy && a.respuesta === 'si')); }, 'alarma marcada por error');
    if (ci) { ci.alarma = false; ci.alarmaRespuesta = null; }
    cerrarHoja(); ir('hoy');
  },
  'entrenador.ciZona': el => { ci.dolorHoy[el.dataset.v] = 3; hojaCheckin(); },
  // Una zona añadida por error se quita del todo (las de una lesión activa se dejan a 0 con el selector).
  'entrenador.ciQuitarZona': el => { delete ci.dolorHoy[el.dataset.v]; hojaCheckin(); },
  'entrenador.ciIA': el => { ci.forzarIA = el.checked; hojaCheckin(); },
  'entrenador.ciMia': el => { elegirMia(estado(), el.dataset.v); hojaCheckin(); },
  'entrenador.ciOcupar': el => { ci.ocuparDia = el.checked; hojaCheckin(); },
  'entrenador.prepararMia': () => abrirCheckin(null, { mia: (misSesiones(estado())[0] || {}).id }),
  'entrenador.crearHoy': async () => {
    const datos = { ...ci, peticion: ($('#ci-peticion') || {}).value || ci.peticion };
    if (datos.alarma) { crearConAlarma(); return; }
    await prepararSesion(datos, datos.reintento ? { reintento: datos.reintento } : {});
  },
  'entrenador.cancelarIA': () => {
    if (!enCurso) return;
    pintarPaso(enCurso.tipo, 2, 'Cancelado: la hace la app…');
    enCurso.ctrl.abort();
  },
  'entrenador.reintentarIA': async el => {
    const S = estado(), s = S.sesiones[el.dataset.v];
    if (!s || !s.iaFallo || s.estado !== 'pendiente') return;
    const f = s.iaFallo, c = s.checkin || {};
    await prepararSesion({ diaPlan: f.diaPlan, lugar: s.lugar, minutos: s.minutos || S.perfil.disponibilidad.minutos, energia: +c.energia || 3, dolorHoy: { ...(c.dolor || {}) }, peticion: f.peticion || '', forzarIA: true }, { reintento: s.id });
  },
  'entrenador.reintentarPlan': async () => {
    const p = planDeLaSemana(estado());
    if (!p || !p.iaFallo) return;
    await montarPlan({ ...p.iaFallo.semana }, true);
  },
  'entrenador.plan': abrirPlan,
  'entrenador.psDia': el => { const v = +el.dataset.v, i = ps.dias.indexOf(v); if (v < diaSemana()) return; if (i >= 0) ps.dias.splice(i, 1); else ps.dias.push(v); ps.dias.sort(); hojaPlan(); },
  'entrenador.psMin': el => { ps.minutos = +el.dataset.v; hojaPlan(); },
  'entrenador.psLugar': el => { const v = el.dataset.v, i = ps.lugares.indexOf(v); if (i >= 0 && ps.lugares.length > 1) ps.lugares.splice(i, 1); else if (i < 0) ps.lugares.push(v); hojaPlan(); },
  'entrenador.crearPlan': async el => {
    const conIA = el.dataset.ia === '1';
    const datos = { ...ps, dias: diasVivos(estado(), ps.dias), lugares: ps.lugares.slice() };
    // Lo que marque aquí pasa a ser su disponibilidad, pero solo si la hoja abarca la semana entera (lunes):
    // a mitad de semana solo se ven los días que quedan y «2 días» no es lo que entrena de normal (E2).
    const enteraSemana = diaSemana() === 1;
    cambiar(S => {
      if (enteraSemana) { S.perfil.disponibilidad.diasSemana = datos.dias.slice(); S.perfil.disponibilidad.dias = datos.dias.length || S.perfil.disponibilidad.dias; }
      S.perfil.disponibilidad.minutos = datos.minutos;
    }, 'perfil-silencio');
    await montarPlan(datos, conIA);
  },
  'entrenador.reorg': () => { roHoyNo = false; const hoy = diaSemana(); ro = [1, 2, 3, 4, 5, 6, 7].filter(d => d >= hoy && (estado().perfil.disponibilidad.diasSemana.includes(d) || !estado().perfil.disponibilidad.diasSemana.length)); hojaReorganizar(); },
  'entrenador.roDia': el => { const v = +el.dataset.v, i = ro.indexOf(v); if (i >= 0) ro.splice(i, 1); else ro.push(v); hojaReorganizar(); },
  'entrenador.reorganizar': () => { const nota = reorganizar(ro.slice(), { quitarHoy: roHoyNo }); cerrarHoja(); if (nota) aviso(nota, 'info'); },
  'entrenador.hoyNo': () => {
    const hoy = diaSemana();
    const libres = [1, 2, 3, 4, 5, 6, 7].filter(d => d > hoy);
    ro = libres.filter(d => !estadoDias(estado()).some(x => x.diaSemana === d && x.estado === 'hecho'));
    // Último día de la semana: no hay a dónde moverlo; se apunta que hoy no se entrena y se dice (E13).
    if (!ro.length) { const nota = noPuedoHoy(); if (nota) aviso(nota, 'info'); return; }
    roHoyNo = true;
    hojaReorganizar();
  },
  'entrenador.verDia': el => hojaDia(+el.dataset.v),
  'entrenador.hacerDia': el => abrirCheckin(+el.dataset.v),
  'entrenador.aplicarNivel': () => aplicarNivel(false),
});

// Texto corto de un ejercicio para listas (lo usan Hoy y Progreso).
export const nombreEj = id => (ex(id) ? ex(id).n : id);
export const musculoEj = id => (ex(id) ? MUSCULOS[ex(id).m[0]] : '');
