// Área ENTRENADOR · interfaz: la semana (crear, ver, reorganizar), el check-in que ajusta la sesión de hoy
// y lo que ve el entrenador de tu progreso. La lógica está en entrenador.js (fachada de dia, plan, checkin e ia).

import { acciones, ir } from '../../nucleo/router.js';
import { estado, cambiar, escuchar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, es } from '../../nucleo/ui.js';
import { enLinea } from '../../nucleo/api.js';
import { diaSemana } from '../../nucleo/modelo.js';
import { LUGARES, DIAS, DIAS_CORTOS, MUSCULOS, NIVELES } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { analizarEjercicios, medidorNivel, tendencias } from '../../reglas/contexto.js';
import { sesionesHechas } from '../../reglas/progresion.js';
import {
  crearSesionHoy, crearPlanSemana, planDeLaSemana, planDeHoy, estadoDias, siguientePendiente, reorganizar,
  previaCheckin, diasPorDefecto, tiempoSesion, diaElegido, preguntaAntes, SEÑALES, T2, DESDE,
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
  const pv = previaCheckin(ci);
  const dia = pv.dia;
  abrirHoja(`<h2>Antes de empezar</h2>
    ${dia ? `<p class="tenue">Toca <b>${h(dia.nombre)}</b> en ${h(minus(LUGARES[dia.lugar]))}. Dime cómo estás y lo ajusto.</p>` : '<p class="tenue">Hoy no hay día en tu plan. Te preparo una sesión con lo que te falta esta semana.</p>'}
    <div class="campo col"><span>Dónde</span><div class="chips">${S.perfil.lugares.map(l => `<button class="chip ${ci.lugar === l ? 'on' : ''}" data-act="entrenador.ci" data-k="lugar" data-v="${h(l)}">${h(LUGARES[l])}</button>`).join('')}</div></div>
    <div class="campo col"><span>Tiempo</span><div class="chips">${[30, 45, 60, 75, 90].map(m => `<button class="chip ${ci.minutos === m ? 'on' : ''}" data-act="entrenador.ci" data-k="minutos" data-v="${m}">${m} min</button>`).join('')}</div></div>
    <div class="campo col"><span>Energía: <b>${ENERGIA[ci.energia]}</b></span><div class="segmentos">${[1, 2, 3, 4, 5].map(n => `<button class="${ci.energia === n ? 'on' : ''}" data-act="entrenador.ci" data-k="energia" data-v="${n}">${n}</button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor hoy · ${h(ZONAS[z].corta)}: <b id="ci-${h(z)}">${+ci.dolorHoy[z] || 0}</b>/10</span>
      <input type="range" min="0" max="10" value="${+ci.dolorHoy[z] || 0}" data-cambio="entrenador.ciDolor" data-z="${h(z)}" oninput="document.getElementById('ci-${h(z)}').textContent=this.value"></label>`).join('')}
    <div class="campo col"><span>¿Te duele algo más?</span><div class="chips">${otras.map(z => `<button class="chip" data-act="entrenador.ciZona" data-v="${z}">${h(ZONAS[z].corta)}</button>`).join('')}</div></div>
    <div class="campo col alarma-ci"><label class="interruptor"><input type="checkbox" data-cambio="entrenador.ciAlarma" ${ci.alarma ? 'checked' : ''}><span><b>Hoy noto algo de esto</b></span></label>
      <details class="plegable"><summary>Qué cuenta</summary><ul class="tenue">${SEÑALES.map(t => `<li>${h(t)}</li>`).join('')}</ul></details></div>
    <label class="campo col"><span>Algo que pedir <small>opcional</small></span><input id="ci-peticion" value="${h(ci.peticion)}" placeholder="Ej.: hoy solo tren superior, la prensa está ocupada…"></label>
    <section class="previa" aria-live="polite">
      <h3>Con lo que me dices</h3>
      ${pv.cambios.length ? `<ul>${pv.cambios.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : '<p class="tenue">Nada cambia: haces el día tal como estaba previsto.</p>'}
      <p class="tenue">${+pv.datos.ejercicios.length} ejercicios · unos ${+pv.minutos} min con calentamiento y estiramientos.</p>
      <p class="tenue">${ICONOS.ia} ${h(ci.forzarIA ? 'Se lo pides al entrenador IA.' : pv.ia.motivo)}</p>
      ${enLinea() && !pv.ia.usar ? `<label class="interruptor"><input type="checkbox" data-cambio="entrenador.ciIA" ${ci.forzarIA ? 'checked' : ''}><span>Pedírsela igualmente al entrenador IA</span></label>` : ''}
    </section>
    <button class="btn grande" data-act="entrenador.crearHoy">${ci.alarma ? 'Hoy no entreno' : `${ICONOS.play} Preparar mi sesión`}</button>`, { clase: 'checkin' });
  $('#ci-peticion').addEventListener('input', e => { ci.peticion = e.target.value; });
  $('#ci-peticion').addEventListener('change', () => hojaCheckin());
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

export function abrirCheckin(diaPlan = null) {
  const S = estado();
  const p = diaElegido(S, diaPlan);
  ci = { diaPlan: p ? p.diaSemana : null, lugar: p ? p.lugar : S.perfil.lugares[0], minutos: (p && p.minutos) || S.perfil.disponibilidad.minutos, energia: 3, dolorHoy: {}, peticion: '', forzarIA: false };
  // Si hoy no toca, adelanta el siguiente día pendiente.
  if (!p) { const sig = siguientePendiente(S); if (sig) { ci.diaPlan = sig.diaSemana; ci.lugar = sig.lugar; ci.minutos = sig.minutos || ci.minutos; } }
  S.perfil.lesiones.filter(l => l.activa).forEach(l => { ci.dolorHoy[l.zona] = dolorInicial(S, l); });
  hojaCheckin();
}

// Señal de alarma marcada o confirmada: se apunta y no se prepara nada (C-ALAR-1).
async function crearConAlarma() {
  const r = await crearSesionHoy({ ...ci, alarma: !!ci.alarma });
  if (r.alarma) hojaAlarma();
}

function cargando(txt) {
  abrirHoja(`<div class="cargando"><div class="giro"></div><p>${h(txt)}</p><p class="tenue">Suele tardar entre 20 y 90 segundos.</p></div>`);
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
    ci.alarmaRespuesta = 'no'; ci.alarmaFrase = p && p.frase; hojaCheckin();
  },
  'entrenador.ciDesde': el => { ci.desde = { ...(ci.desde || {}), [el.dataset.z]: el.dataset.v }; hojaCheckin(); },
  'entrenador.cerrarAlarma': () => { cerrarHoja(); ir('hoy'); },
  'entrenador.ciZona': el => { ci.dolorHoy[el.dataset.v] = 3; hojaCheckin(); },
  'entrenador.ciIA': el => { ci.forzarIA = el.checked; hojaCheckin(); },
  'entrenador.crearHoy': async () => {
    const datos = { ...ci, peticion: ($('#ci-peticion') || {}).value || ci.peticion };
    if (datos.alarma) { crearConAlarma(); return; }
    const pv = previaCheckin(datos);
    if (pv.ia.usar || datos.forzarIA) cargando('Tu entrenador está preparando la sesión…');
    const { sesion, aviso: a, motivo, pregunta, alarma } = await crearSesionHoy(datos);
    if (alarma) { hojaAlarma(); return; }
    if (pregunta) { ci.peticion = datos.peticion; hojaPregunta(pregunta); return; }
    cerrarHoja();
    if (a) aviso(a, 'info'); else if (motivo) aviso(motivo, 'info');
    ir('sesion/' + sesion.id);
  },
  'entrenador.plan': abrirPlan,
  'entrenador.psDia': el => { const v = +el.dataset.v, i = ps.dias.indexOf(v); if (i >= 0) ps.dias.splice(i, 1); else ps.dias.push(v); ps.dias.sort(); hojaPlan(); },
  'entrenador.psMin': el => { ps.minutos = +el.dataset.v; hojaPlan(); },
  'entrenador.psLugar': el => { const v = el.dataset.v, i = ps.lugares.indexOf(v); if (i >= 0 && ps.lugares.length > 1) ps.lugares.splice(i, 1); else if (i < 0) ps.lugares.push(v); hojaPlan(); },
  'entrenador.crearPlan': async el => {
    const conIA = el.dataset.ia === '1';
    const datos = { ...ps };
    // Lo que marque aquí pasa a ser su disponibilidad de la semana.
    cambiar(S => { S.perfil.disponibilidad.diasSemana = datos.dias.slice(); S.perfil.disponibilidad.dias = datos.dias.length || S.perfil.disponibilidad.dias; S.perfil.disponibilidad.minutos = datos.minutos; }, 'perfil-silencio');
    if (conIA) cargando('Tu entrenador está montando la semana…');
    const { aviso: a } = await crearPlanSemana(datos, { conIA });
    cerrarHoja();
    aviso(a || 'Semana lista', a ? 'info' : '');
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
