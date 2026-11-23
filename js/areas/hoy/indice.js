// Área HOY (inicio). Un solo camino: perfil → semana → sesión de hoy. Diseño aprobado en DIS 4 (PR 14).
// - Sin perfil: completar el perfil.
// - Sin plan esta semana: decir qué días puede entrenar (el entrenador monta la semana).
// - Con plan: la tira de la semana arriba, lo que toca hoy (o el descanso y lo siguiente), la sesión en
//   marcha o hecha, la constancia y la semana.
// - Siempre: una sesión sin cerrar de un día anterior (R20) y el aviso «Sin conexión».
// La acción principal va en una barra fija abajo, encima de las pestañas: nunca tapa la tira de la semana,
// que va arriba, debajo del saludo.

import { rutas, pestaña, acciones, ir, pintar, rutaActual } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, fechaLarga, confirmar, aviso, hayHojaAbierta, $ } from '../../nucleo/ui.js';
import { sesionDeHoy, diaSemana, trabajoHecho } from '../../nucleo/modelo.js';
import { enLinea } from '../../nucleo/api.js';
import { PERSONAS, LUGARES, DIAS, DIAS_CORTOS } from '../../datos/constantes.js';
import { tarjetaPlan, planDeHoy, planDeLaSemana, estadoDias, notaFallo, minutosDe, plural, focoTexto } from '../entrenador/indice.js';
import { siguientePendiente, sinEntrenarHoy, T2, misSesiones } from '../entrenador/entrenador.js';
import { info as cronometro, parar as pararCronometro } from '../sesion/temporizador.js';
import * as progreso from '../progreso/indice.js';
import { minusNombre } from '../entrenador/dia.js';
import { recordatorioCopia } from '../perfil/indice.js';

const minus = t => String(t || '').toLowerCase();
const series = s => s.ejercicios.reduce((a, x) => a + x.sets.length, 0);
const seriesHechas = s => s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
// El porqué en una frase, siempre a la vista: lo primero de la explicación del entrenador.
const porque = d => d && d.explicacion && d.explicacion[0] ? `<p class="porque porque-linea">${ICONOS.ia}<span>${h(d.explicacion[0])}</span></p>` : '';
// A mitad de frase el nombre del día va en minúscula, salvo la letra final: «cuerpo completo B» (M15).
const loSiguiente = sig => sig ? `Lo siguiente: ${h(minus(DIAS[sig.diaSemana]))}, ${h(minusNombre(sig.nombre))}.` : '';
const fuente = s => s.origen ? 'tu sesión, ajustada por la app' : s.fuente === 'ia' ? 'entrenador IA' : 'ajustada por la app';
// «lunes, miércoles y viernes»
const listaDias = l => { const n = l.map(i => minus(DIAS[i])).filter(Boolean); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join(''); };

// ── Tira de la semana (R12: nunca solo por color) ──
// Cada día dice su estado con un icono o su fecha (✓ hecho, × no hecho, anillo hoy, discontinuo previsto) y
// lleva su nombre accesible completo («Lunes 16: Torso, hecho»).
function fechaDelDia(i) {
  const d = new Date(hoyISO() + 'T12:00');
  d.setDate(d.getDate() - diaSemana(d) + i);
  return d.getDate();
}
function tiraSemana(S) {
  const dias = estadoDias(S), hoy = diaSemana();
  return `<section class="semana-hoy" aria-label="Esta semana"><ol class="semana">${[1, 2, 3, 4, 5, 6, 7].map(i => {
    const d = dias.find(x => x.diaSemana === i), n = fechaDelDia(i), esHoy = i === hoy;
    let clase = '', marca = `<span class="cifra">${+n}</span>`, txt = esHoy ? 'hoy, descanso' : 'descanso';
    if (d && d.estado === 'hecho') { clase = esHoy ? 'dia--hecha dia--hoy' : 'dia--hecha'; marca = ICONOS.check; txt = `${esHoy ? 'hoy, ' : ''}${d.nombre}, hecho`; }
    else if (d && (d.estado === 'saltado' || (d.estado === 'noPuedo' && i < hoy))) { clase = 'dia--perdida'; marca = ICONOS.x; txt = `${d.nombre}, no hecho`; }
    else if (d && d.estado === 'noPuedo') { clase = 'dia--hoy dia--no'; marca = ICONOS.x; txt = `hoy, ${d.nombre}: hoy no puedes`; }
    else if (esHoy) { clase = 'dia--hoy'; txt = d ? `hoy, ${d.nombre}` : 'hoy, descanso'; }
    else if (d) { clase = 'dia--prevista'; txt = `${d.nombre}, previsto`; }
    return `<li class="dia ${clase}"><span class="dia-l" aria-hidden="true">${DIAS_CORTOS[i]}</span><span class="dia-c" role="img" aria-label="${h(DIAS[i])} ${+n}: ${h(txt)}">${marca}</span></li>`;
  }).join('')}</ol></section>`;
}

// ── Sesión sin cerrar de un día anterior (R20) ──
// Solo lectura: una sesión de otro día con algo hecho y sin cerrar (la más reciente). Cerrarla la guarda en
// su día; descartarla la borra tras confirmarlo.
export function sesionSinCerrar(S) {
  const hoy = hoyISO();
  return Object.values(S.sesiones || {}).filter(s => s && s.fecha < hoy && s.estado !== 'hecha' && s.fuente !== 'anterior' && trabajoHecho(s))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creada).localeCompare(String(a.creada)))[0] || null;
}
function cuandoFue(fecha) {
  const ayer = new Date(hoyISO() + 'T12:00'); ayer.setDate(ayer.getDate() - 1);
  if (fecha === hoyISO(ayer)) return { de: 'de ayer', la: 'la de ayer' };
  const d = new Date(fecha + 'T12:00');
  const hace = Math.round((new Date(hoyISO() + 'T12:00') - d) / 864e5);
  // De hace más de una semana, con el mes: «el jueves 5 de noviembre»
  const dia = `${minus(DIAS[diaSemana(d)])} ${d.getDate()}${hace > 7 ? ` de ${d.toLocaleDateString('es-ES', { month: 'long' })}` : ''}`;
  return { de: `del ${dia}`, la: `la del ${dia}` };
}
// Lo apuntado en una sesión, sin decir «0 de 12 series» si solo hay tareas de calentamiento o vuelta a la calma.
function loApuntado(s) {
  const hechas = seriesHechas(s);
  if (hechas) return plural(hechas, 'serie', 'series', series(s));
  const tareas = [...(s.calentamiento || []), ...(s.vuelta || [])].filter(t => t.hecho).length;
  if (tareas) return plural(tareas, 'tarea hecha', 'tareas hechas') + ' de calentamiento o vuelta a la calma';
  return 'un ejercicio parado por dolor';
}
function avisoSinCerrar(S) {
  const s = sesionSinCerrar(S);
  if (!s) return '';
  const c = cuandoFue(s.fecha);
  return `<div class="aviso aviso--aviso sin-cerrar" role="region" aria-labelledby="t-sin-cerrar" tabindex="-1">${ICONOS.alerta}<div class="aviso-texto">
    <b id="t-sin-cerrar">La sesión ${h(c.de)} está sin cerrar</b>
    <p>${h(s.nombre)}: ${loApuntado(s)}. Ciérrala para que cuente en tu semana y el entrenador lo sepa.</p>
    <div class="aviso-acciones"><a class="boton" href="#sesion/${h(s.id)}" data-act="hoy.cerrarAnterior" data-v="${h(s.id)}">Cerrar ${h(c.la)}</a><button type="button" class="boton boton--secundario" data-act="hoy.descartarAnterior" data-v="${h(s.id)}">Descartarla</button></div>
  </div><span></span></div>`;
}

const avisoRed = () => enLinea() ? '' : `<div class="aviso sin-red" role="status">${ICONOS.sinred}<div class="aviso-texto"><b>Sin conexión</b>
  <p>Tu sesión de hoy funciona entera. Lo que necesita al entrenador IA espera a que vuelva la red.</p></div><span></span></div>`;
// Lesiones traídas de la app anterior con el dolor estimado (U5, revisión del PR #47): que se revise antes de entrenar.
const avisoLesionesTraidas = S => S.perfil.lesiones.some(l => l.activa && l.dolorRevisar)
  ? `<div class="aviso aviso--aviso revisar-lesiones" role="note">${ICONOS.alerta}<div class="aviso-texto"><b>Revisa el dolor de tus lesiones traídas</b>
  <p>Viene estimado de la app anterior.</p><div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="perfil.irLesiones">Revisarlas</button></div></div><span></span></div>` : '';

// ── La tarjeta de hoy: { tarjeta, accion } (accion = la principal, en la barra de abajo) ──
const tarjeta = (etiqueta, titulo, cuerpo, clase = '') => `<section class="tarjeta destacada hoy-tarjeta ${clase}" aria-labelledby="t-hoy-${clase || 'dia'}">
  <p class="etiqueta">${etiqueta}</p><h2 id="t-hoy-${clase || 'dia'}">${titulo}</h2>${cuerpo}</section>`;

function deHoy(S) {
  const s = sesionDeHoy(S);
  // Señal de alarma de hoy: día sin entrenar por precaución (C-ALAR-1).
  if (sinEntrenarHoy(S) && !(s && s.estado === 'hecha' && !s.parada)) {
    return { tarjeta: tarjeta(`${ICONOS.alerta} Hoy`, 'Sin entrenar por precaución', `${T2.map(t => `<p class="datos">${h(t)}</p>`).join('')}
      <button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.deshacerAlarma">La marqué por error</button>`, 'precaucion') };
  }
  if (s && s.estado === 'hecha') {
    const sig = siguientePendiente(S);
    return { tarjeta: tarjeta(`${ICONOS.check} Hecha`, h(s.nombre), `<p class="datos">${plural(seriesHechas(s), 'serie', 'series')}${LUGARES[s.lugar] ? ` en ${h(minus(LUGARES[s.lugar]))}` : ''}${s.cierre && s.cierre.esfuerzo ? `, esfuerzo ${+s.cierre.esfuerzo} de 5` : ''}.</p>
      <p class="datos pequeno">${sig ? loSiguiente(sig) : 'Has hecho todo lo de esta semana.'}</p>
      <a class="boton boton--secundario boton--ancho" href="#sesion/${h(s.id)}">Ver sesión</a>`, 'hecha') };
  }
  if (s) {
    const total = series(s), hechas = seriesHechas(s), enMarcha = s.estado === 'en_curso';
    return {
      tarjeta: tarjeta(`${enMarcha ? 'En marcha' : 'Lista'}: ${fuente(s)}`, h(s.nombre),
        `<p class="datos">${s.foco ? h(focoTexto(s.foco)) + ', ' : ''}${plural(s.ejercicios.length, 'ejercicio', 'ejercicios')}${LUGARES[s.lugar] ? `, ${h(minus(LUGARES[s.lugar]))}` : ''}, unos ${minutosDe(s)} min.</p>
        ${hechas && total ? `<div class="avance" role="img" aria-label="${plural(+hechas, 'serie hecha', 'series hechas', +total)}"><i data-var="--v:${(hechas / total).toFixed(3)}"></i></div><p class="meta">${plural(+hechas, 'serie', 'series', +total)}</p>` : ''}
        ${porque(s)}${notaFallo(s)}
        ${s.estado === 'pendiente' ? '<button type="button" class="boton boton--texto" data-act="entrenador.prepararHoy">Volver a ajustarla</button>' : ''}`),
      accion: `<a class="boton boton--ancho" href="#sesion/${h(s.id)}">${enMarcha ? 'Seguir con la sesión' : 'Empezar'}</a>`,
    };
  }
  // «Hoy no puedo» el último día: hoy no se entrena, y se puede entrenar igualmente (E13).
  const noPuede = estadoDias(S).find(d => d.estado === 'noPuedo' && d.diaSemana === diaSemana());
  if (noPuede) {
    const sig = siguientePendiente(S);
    return { tarjeta: tarjeta('Hoy', 'Hoy no entrenas', `<p class="datos">Has dicho que hoy no puedes hacer «${h(noPuede.nombre)}». ${sig && sig.estado === 'pendiente' ? loSiguiente(sig) : 'No quedan más días esta semana: el lunes montas la semana nueva.'}</p>
      <button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.hacerDia" data-v="${+noPuede.diaSemana}">Entrenar igualmente</button>`) };
  }
  const dia = planDeHoy(S);
  if (dia) {
    return {
      tarjeta: tarjeta('Hoy toca', h(dia.nombre), `<p class="datos">${h(LUGARES[dia.lugar] || '')}, ${plural(dia.ejercicios.length, 'ejercicio', 'ejercicios')}, unos ${minutosDe(dia)} min.${dia.foco ? ' ' + h(focoTexto(dia.foco)) + '.' : ''}</p>${porque(dia)}`),
      accion: '<button type="button" class="boton boton--ancho" data-act="entrenador.prepararHoy">Empezar</button><p class="nota-accion">Antes te pregunto cómo estás y lo ajusto.</p>',
    };
  }
  const sig = siguientePendiente(S);
  return { tarjeta: tarjeta('Hoy', 'Descanso', `<p class="datos">${sig ? loSiguiente(sig) : 'Has hecho todo lo de esta semana.'} Descansar también es entrenar.</p>
    <button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.prepararHoy">Entrenar igualmente</button>`) };
}

function sinPlan(S, principal) {
  const d = S.perfil.disponibilidad;
  const mias = misSesiones(S).length && !sesionDeHoy(S) && !sinEntrenarHoy(S);
  const montar = `<button type="button" class="boton ${principal ? '' : 'boton--secundario'} boton--ancho" data-act="entrenador.plan">Montar mi semana</button>`;
  return {
    tarjeta: tarjeta('Esta semana', '¿Qué días puedes entrenar?', `<p class="datos">Dímelo y te monto la semana: calentamiento, ejercicios, rehabilitación y estiramientos de cada día. Cada día lo ajusto a cómo estés.</p>
      ${d.diasSemana.length ? `<p class="datos pequeno">La última vez: ${h(listaDias(d.diasSemana))}.</p>` : ''}
      ${mias ? '<button type="button" class="boton boton--secundario boton--ancho" data-act="entrenador.prepararMia">Hacer una de mis sesiones</button>' : ''}
      ${principal ? '' : montar}`, 'sin-plan'),
    accion: principal ? montar : '',
  };
}

function vista() {
  const S = estado(), p = PERSONAS[S.dueño];
  const sinPerfil = !S.perfil.objetivos.length;
  const plan = planDeLaSemana(S);
  const dias = estadoDias(S);
  const constancia = typeof progreso.tarjetaConstancia === 'function'
    ? progreso.tarjetaConstancia(S, plan ? { planificados: dias.length, hechosPlan: dias.filter(d => d.estado === 'hecho').length } : {}) : '';
  let cuerpo, accion;
  if (sinPerfil) {
    cuerpo = tarjeta('Primero', 'Cuéntale a tu entrenador quién eres', '<p class="datos">Objetivos, nivel, lesiones, dónde entrenas y cuántos días puedes. Sin eso va a ciegas.</p>', 'primera');
    accion = '<a class="boton boton--ancho" href="#perfil">Completar mi perfil</a>';
  } else if (plan) {
    const t = deHoy(S);
    cuerpo = `${t.tarjeta}${constancia}${tarjetaPlan(S)}`;
    accion = t.accion || '';
  } else {
    // Sin plan: la sesión de hoy (si ya hay una) manda; si no, montar la semana es lo principal.
    const t = sesionDeHoy(S) || sinEntrenarHoy(S) ? deHoy(S) : null;
    // Con la tarjeta de hoy (sesión o precaución T2), «Montar mi semana» pasa a secundaria.
    const sp = sinPlan(S, !t);
    cuerpo = `${t ? t.tarjeta : ''}${sp.tarjeta}${constancia}`;
    accion = (t && t.accion) || sp.accion;
  }
  return `
  <header class="saludo"><p>${h(fechaLarga(hoyISO()))}</p><h1>Hola, ${h(p ? p.nombre : '')}</h1></header>
  ${plan && !sinPerfil ? tiraSemana(S) : ''}
  ${avisoSinCerrar(S)}${avisoRed()}${avisoLesionesTraidas(S)}
  <div class="hoy-cuerpo">${cuerpo}</div>
  ${recordatorioCopia()}
  ${accion ? `<div class="accion-hoy">${accion}</div>` : ''}`;
}

// «Cerrar la de ayer»: a esa sesión, con el cierre abierto (esfuerzo, dolor y comentario).
async function cerrarAnterior(id) {
  ir('sesion/' + id);
  for (let i = 0; i < 40; i++) {
    const b = $('#vista [data-act="sesion.terminar"]');
    if (b && location.hash === '#sesion/' + id) { if (!hayHojaAbierta()) b.click(); return; }
    await new Promise(r => setTimeout(r, 25));
  }
}
async function descartarAnterior(id) {
  const s = estado().sesiones[id]; if (!s) return;
  const c = cuandoFue(s.fecha);
  if (!await confirmar(`¿Descartar «${s.nombre}», la sesión ${c.de}? Se borra lo apuntado en ella (${loApuntado(s)}) y no cuenta en tu semana.`, { si: 'Descartar sesión', no: 'Cancelar', peligro: true })) return;
  const crono = cronometro();
  if (crono && crono.meta && crono.meta.sesion === id) pararCronometro();
  cambiar(S => { delete S.sesiones[id]; }, 'sesion');
  aviso(`Sesión ${c.de} descartada.`, 'info');
  // El foco no se pierde: al siguiente aviso de sesión sin cerrar o al título de Hoy.
  const destino = $('#vista .sin-cerrar') || $('#vista h1');
  if (destino) { if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1'); try { destino.focus({ preventScroll: false }); } catch { /* nada */ } }
}

// Con o sin red, Hoy lo dice al momento (si no hay una hoja encima).
function alCambiarRed() { if (rutaActual().ruta === 'hoy' && !hayHojaAbierta()) pintar(); }
if (typeof window !== 'undefined') { window.addEventListener('online', alCambiarRed); window.addEventListener('offline', alCambiarRed); }

rutas({ hoy: { titulo: 'Hoy', vista } });
pestaña({ ruta: 'hoy', nombre: 'Hoy', icono: ICONOS.hoy, orden: 10 });
acciones({
  'hoy.cerrarAnterior': el => cerrarAnterior(el.dataset.v),
  'hoy.descartarAnterior': el => descartarAnterior(el.dataset.v),
});
