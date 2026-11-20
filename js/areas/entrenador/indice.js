// Área ENTRENADOR · interfaz: la semana (crear, ver, reorganizar), el check-in que ajusta la sesión de hoy
// y lo que ve el entrenador de tu progreso. La lógica está en entrenador.js (fachada de dia, plan, checkin e ia).

import { acciones, ir } from '../../nucleo/router.js';
import { estado, cambiar, escuchar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, es, mmss } from '../../nucleo/ui.js';
import { enLinea } from '../../nucleo/api.js';
import { diaSemana, sesionDeHoy, sesionTocada } from '../../nucleo/modelo.js';
import { info as cronometro } from '../sesion/temporizador.js';
import { LUGARES, DIAS, DIAS_CORTOS, MUSCULOS, NIVELES } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { analizarEjercicios, medidorNivel, tendencias } from '../../reglas/contexto.js';
import { sesionesHechas } from '../../reglas/progresion.js';
import {
  crearSesionHoy, crearPlanSemana, planDeLaSemana, planDeHoy, estadoDias, siguientePendiente, reorganizar,
  previaCheckin, diasPorDefecto, tiempoSesion, diaElegido, preguntaAntes, sinEntrenarHoy, SEÑALES, T2, DESDE, misSesiones, miaDe,
} from './entrenador.js';

export { planDeLaSemana, planDeHoy, estadoDias };

const ENERGIA = ['', 'Muy baja', 'Baja', 'Normal', 'Buena', 'A tope'];
const minus = t => String(t || '').toLowerCase();

// ── Check-in: lo que cambia la sesión, y enseña qué cambia antes de crearla ──
let ci = null;

function hojaCheckin() {
  const S = estado();
  // Solo zonas del catálogo: su clave va dentro de un id y de un manejador oninput.
  const zonas = [...new Set([...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona), ...Object.keys(ci.dolorHoy)])].filter(z => Object.prototype.hasOwnProperty.call(ZONAS, z));
  const otras = Object.keys(ZONAS).filter(z => !zonas.includes(z));
  // Antes de nada: alarma en un texto libre o lesión sin «desde» (C-ALAR-4, C-LES-6). No se genera nada.
  const pregunta = preguntaAntes(S, ci);
  if (pregunta) return hojaPregunta(pregunta);
  // Si la mía elegida ya no existe (borrada en otra pestaña…), se vuelve a lo de antes.
  if (ci.mia && !miaDe(S, ci.mia)) elegirMia(S, null);
  const pv = previaCheckin(ci);
  const dia = pv.dia;
  const mia = miaDe(S, ci.mia), mias = misSesiones(S);
  abrirHoja(`<h2>Antes de empezar</h2>
    ${mia ? `<p class="tenue">Haces <b>${h(mia.nombre)}</b>${dia && ci.ocuparDia ? `, que cuenta como el día «${h(dia.nombre)}» de tu plan` : ''}. Dime cómo estás y la ajusto a hoy.</p>`
    : dia ? `<p class="tenue">Toca <b>${h(dia.nombre)}</b> en ${h(minus(LUGARES[dia.lugar]))}. Dime cómo estás y lo ajusto.</p>` : '<p class="tenue">Hoy no hay día en tu plan. Te preparo una sesión con lo que te falta esta semana.</p>'}
    ${mias.length ? `<div class="campo col mis-sesiones-ci"><span>Qué sesión</span><div class="chips">
      <button class="chip ${mia ? '' : 'on'}" data-act="entrenador.ciMia" data-v="" aria-pressed="${!mia}">${dia ? 'La de mi plan' : 'La que me prepares'}</button>
      ${mias.map(m => `<button class="chip ${mia && mia.id === m.id ? 'on' : ''}" data-act="entrenador.ciMia" data-v="${h(m.id)}" aria-pressed="${!!(mia && mia.id === m.id)}">${h(m.nombre)}</button>`).join('')}</div>
      ${mia && dia ? `<label class="interruptor"><input type="checkbox" data-cambio="entrenador.ciOcupar" ${ci.ocuparDia ? 'checked' : ''}><span>Cuenta como el día «${h(dia.nombre)}» del plan</span></label>` : ''}</div>` : ''}
    <div class="campo col"><span>Dónde</span><div class="chips">${S.perfil.lugares.map(l => `<button class="chip ${ci.lugar === l ? 'on' : ''}" data-act="entrenador.ci" data-k="lugar" data-v="${h(l)}">${h(LUGARES[l])}</button>`).join('')}</div></div>
    <div class="campo col"><span>Tiempo</span><div class="chips">${[30, 45, 60, 75, 90].map(m => `<button class="chip ${ci.minutos === m ? 'on' : ''}" data-act="entrenador.ci" data-k="minutos" data-v="${m}">${m} min</button>`).join('')}</div></div>
    <div class="campo col"><span>Energía: <b>${ENERGIA[ci.energia]}</b></span><div class="segmentos">${[1, 2, 3, 4, 5].map(n => `<button class="${ci.energia === n ? 'on' : ''}" data-act="entrenador.ci" data-k="energia" data-v="${n}">${n}</button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor hoy · ${h(ZONAS[z].corta)}: <b id="ci-${h(z)}">${+ci.dolorHoy[z] || 0}</b>/10</span>
      <input type="range" min="0" max="10" value="${+ci.dolorHoy[z] || 0}" data-cambio="entrenador.ciDolor" data-z="${h(z)}" oninput="document.getElementById('ci-${h(z)}').textContent=this.value"></label>`).join('')}
    <div class="campo col"><span>¿Te duele algo más?</span><div class="chips">${otras.map(z => `<button class="chip" data-act="entrenador.ciZona" data-v="${z}">${h(ZONAS[z].corta)}</button>`).join('')}</div></div>
    <div class="campo col alarma-ci"><label class="interruptor"><input type="checkbox" data-cambio="entrenador.ciAlarma" ${ci.alarma ? 'checked' : ''}><span><b>Hoy noto algo de esto</b></span></label>
      <details class="plegable"><summary>Qué cuenta</summary><ul class="tenue">${SEÑALES.map(t => `<li>${h(t)}</li>`).join('')}</ul></details></div>
    ${mia ? '' : `<label class="campo col"><span>Algo que pedir <small>opcional</small></span><input id="ci-peticion" value="${h(ci.peticion)}" placeholder="Ej.: hoy solo tren superior, la prensa está ocupada…"></label>`}
    ${htmlPrevia(pv)}
    <button class="btn grande" data-act="entrenador.crearHoy">${ci.alarma ? 'Hoy no entreno' : `${ICONOS.play} ${mia ? `Preparar «${h(mia.nombre)}»` : 'Preparar mi sesión'}`}</button>`, { clase: 'checkin' });
  const pet = $('#ci-peticion');
  if (!pet) return;
  pet.addEventListener('input', e => { ci.peticion = e.target.value; });
  // Al terminar de escribir solo se repinta la previa: repintar la hoja entera quitaba de debajo del dedo el
  // botón «Preparar mi sesión» y el toque se perdía (PR 12).
  pet.addEventListener('change', () => { const v = $('.hoja.checkin .previa'); if (v) v.outerHTML = htmlPrevia(previaCheckin(ci)); });
}
function htmlPrevia(pv) {
  return `<section class="previa" aria-live="polite">
      <h3>Con lo que me dices</h3>
      ${pv.cambios.length ? `<ul>${pv.cambios.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : `<p class="tenue">${ci.mia ? 'Nada cambia: haces tu sesión tal como la guardaste.' : 'Nada cambia: haces el día tal como estaba previsto.'}</p>`}
      <p class="tenue">${+pv.datos.ejercicios.length} ejercicios · unos ${+pv.minutos} min con calentamiento y estiramientos.</p>
      <p class="tenue">${ICONOS.ia} ${h(ci.forzarIA ? 'Se lo pides al entrenador IA.' : pv.ia.motivo)}</p>
      ${enLinea() && !pv.ia.usar && !ci.mia ? `<label class="interruptor"><input type="checkbox" data-cambio="entrenador.ciIA" ${ci.forzarIA ? 'checked' : ''}><span>Pedírsela igualmente al entrenador IA</span></label>` : ''}
    </section>`;
}

// Pregunta que bloquea el check-in hasta contestarla: alarma en un texto (C-ALAR-4) o «¿desde cuándo?» (C-LES-6).
function hojaPregunta(p) {
  if (p.tipo === 'alarma') {
    abrirHoja(`<h2>Antes de preparar nada</h2>
      <p>${h(p.texto)}</p>
      <ul class="tenue">${SEÑALES.slice(0, 4).map(t => `<li>${h(t)}</li>`).join('')}</ul>
      <div class="fila-botones"><button class="btn sec" data-act="entrenador.ciRespAlarma" data-v="no">No, hoy no noto nada de eso</button><button class="btn" data-act="entrenador.ciRespAlarma" data-v="si">Sí, lo noto</button></div>`, { clase: 'checkin' });
    return;
  }
  abrirHoja(`<h2>${h(p.texto)}</h2>
    ${p.zonas.map(z => `<div class="campo col"><span>${h(ZONAS[z] ? ZONAS[z].corta : z)}</span><div class="chips">${Object.entries(DESDE).map(([k, [n]]) => `<button class="chip ${(ci.desde || {})[z] === k ? 'on' : ''}" data-act="entrenador.ciDesde" data-z="${h(z)}" data-v="${k}">${h(n)}</button>`).join('')}</div></div>`).join('')}
    <p class="tenue">Lo guardo en tu lesión. «No lo sé» la trata como reciente, que es lo más prudente.</p>`, { clase: 'checkin' });
}
function hojaAlarma() {
  abrirHoja(`<h2>Hoy no toca entrenar</h2>${T2.map(t => `<p>${h(t)}</p>`).join('')}<button class="btn" data-act="entrenador.cerrarAlarma">Entendido</button>`, { clase: 'checkin alarma' });
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
  hojaCheckin();
}
// Elegir (o dejar) una de «Mis sesiones» en el check-in: su lugar, si lo tienes, y su tiempo; sin petición ni IA.
// Lo de antes (lugar, minutos, petición, IA) se aparta y vuelve al dejarla («La de mi plan»).
const MINUTOS_CI = [30, 45, 60, 75, 90];
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
  if (S.perfil.lugares.includes(m.lugar)) ci.lugar = m.lugar;
  if (m.minutos) ci.minutos = MINUTOS_CI.find(x => x >= m.minutos) || 90;
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
let enCurso = null;
export const esperandoIA = () => !!enCurso;
const TEXTO_FASE = {
  sesion: p => p.fase === 'escribiendo' ? `Escribiendo tu sesión${p.ejercicios ? ` · ${+p.ejercicios} ejercicio${p.ejercicios > 1 ? 's' : ''}` : ''}…` : 'Pensando tu sesión con tus datos…',
  plan: p => p.fase === 'escribiendo' ? `Escribiendo tu semana${p.dias ? ` · día ${+p.dias}${p.de ? ` de ${+p.de}` : ''}` : ''}…` : 'Pensando tu semana con tus datos…',
};
async function conEspera(tipo, titulo, hacer) {
  if (enCurso) { aviso('Ya estoy preparando una, espera a que termine.', 'info'); return null; }
  const ctrl = new AbortController();
  const yo = { tipo, ctrl, hash: location.hash, inicio: Date.now() };
  enCurso = yo;
  abrirHoja(`<h2>${h(titulo)}</h2>
    <div class="cargando espera"><div class="giro"></div>
      <p id="espera-fase" aria-live="polite">Conectando con tu entrenador…</p>
      <p class="tenue"><span id="espera-tiempo">0:00</span> · suele tardar entre 20 y 90 segundos</p></div>
    <button class="btn sec" data-act="entrenador.cancelarIA">Cancelar y hacerla con la app</button>`, { clase: 'espera', fija: true });
  const reloj = setInterval(() => { const t = $('#espera-tiempo'); if (t) t.textContent = mmss((Date.now() - yo.inicio) / 1000); }, 1000);
  const alProgreso = p => { const f = $('#espera-fase'); if (f && enCurso === yo) f.textContent = TEXTO_FASE[tipo](p); };
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

// ── Nota fija «La ha hecho la app porque…» (sesión de hoy y semana) ──
const enlaceCodigo = motivo => /código de acceso/.test(motivo) ? ' <button class="enlace" data-act="perfil.irAjustes">Cambiar el código en Perfil › Ajustes</button>' : '';
export function notaFallo(s) {
  const f = s && s.iaFallo;
  if (!f) return '';
  // Nada de rehacerla si ya ha apuntado algo (kilos, series, comentarios, cambios) o tiene el cronómetro en marcha.
  const crono = cronometro();
  const tocada = sesionTocada(s) || !!(crono && crono.meta && crono.meta.sesion === s.id);
  const puede = s.estado === 'pendiente' && !tocada && f.reintentable !== false;
  return `<div class="nota aviso-nota nota-fallo" role="note">
    <p>La ha hecho la app porque ${h(f.motivo)}.${enlaceCodigo(f.motivo)}</p>
    ${f.peticion ? `<p>No he podido atender lo que pediste: «${h(f.peticion)}».</p>` : ''}
    ${puede ? (enLinea() ? `<button class="btn sec pequeño" data-act="entrenador.reintentarIA" data-v="${h(s.id)}">${ICONOS.ia} Reintentar con IA</button>` : '<p class="tenue">Cuando tengas conexión podrás reintentarlo con la IA.</p>') : ''}
  </div>`;
}
function notaFalloPlan(p) {
  const f = p && p.iaFallo;
  if (!f) return '';
  return `<div class="nota aviso-nota nota-fallo" role="note">
    <p>La semana la ha hecho la app porque ${h(f.motivo)}.${enlaceCodigo(f.motivo)}</p>
    ${enLinea() ? `<button class="btn sec pequeño" data-act="entrenador.reintentarPlan">${ICONOS.ia} Reintentar con IA</button>` : '<p class="tenue">Cuando tengas conexión podrás reintentarlo con la IA.</p>'}
  </div>`;
}

// ── Crear o rehacer la semana ──
let ps = null;
function hojaPlan() {
  const S = estado(), hoy = diaSemana(), hechos = estadoDias(S).filter(d => d.estado === 'hecho').map(d => d.diaSemana);
  const libres = ps.dias.filter(d => d >= hoy && !hechos.includes(d));
  abrirHoja(`<h2>Tu semana</h2>
    <p class="tenue">Marca los días que puedes entrenar <b>esta semana</b>. Si cambia algo a mitad de semana, vuelve aquí y lo reorganizo.</p>
    <div class="chips dias">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button class="chip ${ps.dias.includes(i) ? 'on' : ''} ${i < hoy ? 'pasado' : ''}" data-act="entrenador.psDia" data-v="${i}" ${hechos.includes(i) ? 'disabled' : ''}>${DIAS_CORTOS[i]}</button>`).join('')}</div>
    <div class="campo col"><span>Minutos por sesión</span><div class="chips">${[30, 45, 60, 75, 90].map(m => `<button class="chip ${ps.minutos === m ? 'on' : ''}" data-act="entrenador.psMin" data-v="${m}">${m} min</button>`).join('')}</div></div>
    <div class="campo col"><span>Dónde</span><div class="chips">${S.perfil.lugares.map(l => `<button class="chip ${ps.lugares.includes(l) ? 'on' : ''}" data-act="entrenador.psLugar" data-v="${h(l)}">${h(LUGARES[l])}</button>`).join('')}</div></div>
    ${libres.length ? `<button class="btn grande" data-act="entrenador.crearPlan" data-ia="1" ${enLinea() ? '' : 'disabled'}>${ICONOS.ia} Que me la monte el entrenador IA</button>
      <button class="btn sec" data-act="entrenador.crearPlan" data-ia="0">Hacerla con la app (sin gastar IA)</button>
      <p class="tenue pie">${libres.length} día${libres.length > 1 ? 's' : ''} por planificar${hechos.length ? `; lo que ya has hecho se queda` : ''}.</p>`
    : '<p class="tenue">Marca al menos un día de hoy en adelante.</p>'}`);
}
export function abrirPlan() {
  const S = estado(), d = S.perfil.disponibilidad, p = planDeLaSemana(S);
  ps = { dias: p ? p.dias.map(x => x.diaSemana) : diasPorDefecto(S), minutos: d.minutos, lugares: S.perfil.lugares.slice() };
  hojaPlan();
}

// ── Reorganizar lo que queda ──
let ro = null;
function hojaReorganizar() {
  const S = estado(), hoy = diaSemana();
  const pend = estadoDias(S).filter(d => d.estado !== 'hecho');
  abrirHoja(`<h2>Reorganizar la semana</h2>
    <p class="tenue">Te quedan: ${pend.map(d => `<b>${h(d.nombre)}</b>`).join(', ') || 'nada'}. ¿Qué días puedes de aquí al domingo?</p>
    <div class="chips dias">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button class="chip ${ro.includes(i) ? 'on' : ''}" data-act="entrenador.roDia" data-v="${i}" ${i < hoy ? 'disabled' : ''}>${DIAS_CORTOS[i]}</button>`).join('')}</div>
    <p class="tenue">Si caben, muevo los días tal cual. Si no, los junto en sesiones de cuerpo completo con lo que aún no has trabajado.</p>
    <button class="btn grande" data-act="entrenador.reorganizar">Reorganizar</button>`);
}

// ── Tarjeta del plan (la usa Hoy) ──
const ETIQUETA = { hecho: 'Hecho', hoy: 'Hoy', pendiente: '', saltado: 'No hecho' };
export function tarjetaPlan(S) {
  const p = planDeLaSemana(S);
  if (!p) return '';
  const dias = estadoDias(S);
  const saltados = dias.filter(d => d.estado === 'saltado');
  const ultimoCambio = (p.cambios || []).slice(-1)[0];
  return `<section class="tarjeta plan-semana">
    <h2>Tu semana <small>${p.fuente === 'ia' ? 'entrenador IA' : 'hecha por la app'}</small></h2>
    ${p.resumen ? `<p>${h(p.resumen)}</p>` : ''}
    ${notaFalloPlan(p)}
    ${saltados.length ? `<p class="nota aviso-nota">No hiciste ${saltados.map(d => `${h(minus(DIAS[d.diaSemana]))} (${h(minus(d.nombre))})`).join(' ni ')}. <button class="enlace" data-act="entrenador.reorg">Reorganizar lo que queda</button></p>` : ''}
    ${ultimoCambio ? `<p class="tenue">${h(ultimoCambio.texto)}</p>` : ''}
    <ul class="lista">${dias.map(d => `<li class="${d.estado === 'saltado' || d.estado === 'hecho' ? 'apagada' : ''}">
      <button class="fila" data-act="entrenador.verDia" data-v="${+d.diaSemana}">
        <span class="grow"><b>${h(DIAS[d.diaSemana])} · ${h(d.nombre)}</b><span class="tenue">${h(LUGARES[d.lugar])} · ${+d.ejercicios.length} ejercicios · unos ${+tiempoSesion(d)} min</span></span>
        ${ETIQUETA[d.estado] ? `<span class="etiqueta">${d.estado === 'hecho' ? ICONOS.check + ' ' : ''}${ETIQUETA[d.estado]}</span>` : ICONOS.sig}</button></li>`).join('')}</ul>
    <details class="plegable"><summary>Por qué esta semana</summary>
      ${p.criterios ? `<p>${h(p.criterios)}</p>` : ''}${p.progresion ? `<p><b>Progresión:</b> ${h(p.progresion)}</p>` : ''}
    </details>
    <div class="fila-botones"><button class="btn sec" data-act="entrenador.plan">Cambiar días</button>${dias.some(d => d.estado === 'hoy') ? '<button class="btn sec" data-act="entrenador.hoyNo">Hoy no puedo</button>' : ''}</div>
  </section>`;
}

// Ver un día del plan con sus ejercicios.
function hojaDia(n) {
  const S = estado(), d = estadoDias(S).find(x => x.diaSemana === n); if (!d) return;
  const fila = x => { const e = ex(x.id); return e ? `<li><b>${h(e.n)}</b><span class="tenue"> · ${+x.series} × ${h(x.reps)}${x.rol === 'rehab' ? ' · rehabilitación' : x.rol === 'cardio' ? ' · cardio' : ''}</span>${x.nota ? `<br><small>${h(x.nota)}</small>` : ''}</li>` : ''; };
  abrirHoja(`<h2>${h(DIAS[n])} · ${h(d.nombre)}</h2>
    <p class="tenue">${h(LUGARES[d.lugar])} · unos ${+tiempoSesion(d)} min${d.foco ? ' · ' + h(d.foco) : ''}</p>
    ${d.explicacion.length ? `<p class="nota porque-linea">${ICONOS.ia} ${h(d.explicacion[0])}</p>` : ''}
    <h3>Calentamiento</h3><ul>${d.calentamiento.map(t => `<li>${h(t.nombre)} <span class="tenue">${h(t.duracion || '')}</span></li>`).join('')}</ul>
    <h3>Trabajo</h3><ul>${d.ejercicios.map(fila).join('')}</ul>
    <h3>Vuelta a la calma</h3><ul>${d.vuelta.map(t => `<li>${h(t.nombre)} <span class="tenue">${h(t.duracion || '')}</span></li>`).join('')}</ul>
    ${d.explicacion.length > 1 ? `<details class="plegable"><summary>Más detalle</summary><ul>${d.explicacion.slice(1).map(t => `<li>${h(t)}</li>`).join('')}</ul></details>` : ''}
    ${d.estado === 'hecho' ? `<a class="btn sec" href="#sesion/${h(d.sesion)}">Ver lo que hiciste</a>` : `<button class="btn grande" data-act="entrenador.hacerDia" data-v="${+n}">${ICONOS.play} Hacer este día hoy</button>`}`);
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
  aviso(`${auto ? 'Tu progreso te sube' : 'Pasas'} a ${minus(NIVELES[m.sugerido])}. El entrenador lo usará desde la próxima sesión.`);
}
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

acciones({
  'entrenador.prepararHoy': () => abrirCheckin(),
  'entrenador.ci': el => { const k = el.dataset.k; ci[k] = k === 'lugar' ? el.dataset.v : +el.dataset.v; hojaCheckin(); },
  'entrenador.ciDolor': async el => {
    const v = +el.value, antes = +ci.dolorHoy[el.dataset.z] || 0;
    // Pasar a 7 o más lleva al día de dolor alto: se confirma (C-DOLOR-0).
    if (v >= 7 && antes < 7 && !await confirmar('¿Hoy de verdad 7 o más?', { si: 'Sí, 7 o más', no: 'No' })) { hojaCheckin(); return; }
    ci.dolorHoy[el.dataset.z] = v; hojaCheckin();
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
  'entrenador.ciZona': el => { ci.dolorHoy[el.dataset.v] = 3; hojaCheckin(); },
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
    const f = $('#espera-fase'); if (f) f.textContent = 'Cancelado: la hace la app…';
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
  'entrenador.psDia': el => { const v = +el.dataset.v, i = ps.dias.indexOf(v); if (i >= 0) ps.dias.splice(i, 1); else ps.dias.push(v); ps.dias.sort(); hojaPlan(); },
  'entrenador.psMin': el => { ps.minutos = +el.dataset.v; hojaPlan(); },
  'entrenador.psLugar': el => { const v = el.dataset.v, i = ps.lugares.indexOf(v); if (i >= 0 && ps.lugares.length > 1) ps.lugares.splice(i, 1); else if (i < 0) ps.lugares.push(v); hojaPlan(); },
  'entrenador.crearPlan': async el => {
    const conIA = el.dataset.ia === '1';
    const datos = { ...ps, dias: ps.dias.slice(), lugares: ps.lugares.slice() };
    // Lo que marque aquí pasa a ser su disponibilidad de la semana.
    cambiar(S => { S.perfil.disponibilidad.diasSemana = datos.dias.slice(); S.perfil.disponibilidad.dias = datos.dias.length || S.perfil.disponibilidad.dias; S.perfil.disponibilidad.minutos = datos.minutos; }, 'perfil-silencio');
    await montarPlan(datos, conIA);
  },
  'entrenador.reorg': () => { const hoy = diaSemana(); ro = [1, 2, 3, 4, 5, 6, 7].filter(d => d >= hoy && (estado().perfil.disponibilidad.diasSemana.includes(d) || !estado().perfil.disponibilidad.diasSemana.length)); hojaReorganizar(); },
  'entrenador.roDia': el => { const v = +el.dataset.v, i = ro.indexOf(v); if (i >= 0) ro.splice(i, 1); else ro.push(v); hojaReorganizar(); },
  'entrenador.reorganizar': () => { const nota = reorganizar(ro.slice()); cerrarHoja(); if (nota) aviso(nota, 'info'); },
  'entrenador.hoyNo': () => {
    const hoy = diaSemana();
    const libres = [1, 2, 3, 4, 5, 6, 7].filter(d => d > hoy);
    ro = libres.filter(d => !estadoDias(estado()).some(x => x.diaSemana === d && x.estado === 'hecho'));
    hojaReorganizar();
  },
  'entrenador.verDia': el => hojaDia(+el.dataset.v),
  'entrenador.hacerDia': el => abrirCheckin(+el.dataset.v),
  'entrenador.aplicarNivel': () => aplicarNivel(false),
});

// Texto corto de un ejercicio para listas (lo usan Hoy y Progreso).
export const nombreEj = id => (ex(id) ? ex(id).n : id);
export const musculoEj = id => (ex(id) ? MUSCULOS[ex(id).m[0]] : '');
