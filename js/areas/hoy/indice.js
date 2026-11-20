// Área HOY (inicio). Un solo camino: perfil → semana → sesión de hoy.
// - Sin perfil: completar el perfil.
// - Sin plan esta semana: decir qué días puede entrenar (el entrenador monta la semana).
// - Con plan: lo que toca hoy (o el descanso y lo siguiente), la sesión en marcha o hecha, y la semana.

import { rutas, pestaña, acciones, ir } from '../../nucleo/router.js';
import { estado, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, fechaLarga } from '../../nucleo/ui.js';
import { sesionDeHoy, diaSemana } from '../../nucleo/modelo.js';
import { PERSONAS, LUGARES, DIAS, DIAS_CORTOS } from '../../datos/constantes.js';
import { tarjetaPlan, planDeHoy, planDeLaSemana, estadoDias } from '../entrenador/indice.js';
import { siguientePendiente, tiempoSesion, sinEntrenarHoy, T2 } from '../entrenador/entrenador.js';
import * as progreso from '../progreso/indice.js';
import { recordatorioCopia } from '../perfil/indice.js';

const minus = t => String(t || '').toLowerCase();
// El porqué en una frase, siempre a la vista: lo primero de la explicación del entrenador.
const porque = d => d && d.explicacion && d.explicacion[0] ? `<p class="nota porque-linea">${ICONOS.ia} ${h(d.explicacion[0])}</p>` : '';

function tiraSemana(S) {
  const dias = estadoDias(S), hoy = diaSemana();
  return `<ol class="tira-semana" aria-label="Esta semana">${[1, 2, 3, 4, 5, 6, 7].map(i => {
    const d = dias.find(x => x.diaSemana === i);
    return `<li class="${i === hoy ? 'hoy' : ''} ${d ? 'toca ' + h(d.estado) + (d.estado === 'hecho' ? ' hecha' : '') : ''}" title="${d ? h(d.nombre) : 'Descanso'}"><span>${DIAS_CORTOS[i]}</span><i></i></li>`;
  }).join('')}</ol>`;
}

function tarjetaHoy(S) {
  // Señal de alarma de hoy: día sin entrenar por precaución (C-ALAR-1).
  if (sinEntrenarHoy(S) && !sesionDeHoy(S)) {
    return `<section class="tarjeta destacada alarma"><span class="etiqueta">Hoy</span><h2>Sin entrenar por precaución</h2>${T2.map(t => `<p>${h(t)}</p>`).join('')}</section>`;
  }
  const s = sesionDeHoy(S);
  if (s && s.estado === 'hecha') {
    const series = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
    const sig = siguientePendiente(S);
    return `<section class="tarjeta destacada hecha">
      <span class="etiqueta">${ICONOS.check} Hecha</span>
      <h2>${h(s.nombre)}</h2><p class="tenue">${+series} series · ${h(LUGARES[s.lugar] || '')}${s.cierre && s.cierre.esfuerzo ? ' · esfuerzo ' + +s.cierre.esfuerzo + '/5' : ''}</p>
      ${sig ? `<p class="tenue">Lo siguiente: ${h(minus(DIAS[sig.diaSemana]))}, ${h(minus(sig.nombre))}.</p>` : ''}
      <a class="btn sec" href="#sesion/${h(s.id)}">Ver sesión</a></section>`;
  }
  if (s) {
    const total = s.ejercicios.reduce((a, x) => a + x.sets.length, 0), hechas = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
    return `<section class="tarjeta destacada">
      <span class="etiqueta">${s.estado === 'en_curso' ? 'En marcha' : 'Lista'} · ${s.fuente === 'ia' ? 'entrenador IA' : 'ajustada por la app'}</span>
      <h2>${h(s.nombre)}</h2>
      <p class="tenue">${h(s.foco)}${s.foco ? ' · ' : ''}${+s.ejercicios.length} ejercicios · ${h(LUGARES[s.lugar] || '')}</p>
      ${porque(s)}
      ${hechas ? `<div class="barra"><i style="width:${Math.round(hechas / total * 100)}%"></i></div>` : ''}
      <a class="btn grande" href="#sesion/${h(s.id)}">${ICONOS.play} ${s.estado === 'en_curso' ? 'Seguir' : 'Empezar'}</a>
      ${s.estado === 'pendiente' ? '<button class="enlace" data-act="entrenador.prepararHoy">Volver a ajustarla</button>' : ''}</section>`;
  }
  const dia = planDeHoy(S);
  if (dia) {
    return `<section class="tarjeta destacada">
      <span class="etiqueta">Hoy toca</span>
      <h2>${h(dia.nombre)}</h2>
      <p class="tenue">${h(LUGARES[dia.lugar])} · ${+dia.ejercicios.length} ejercicios · unos ${+tiempoSesion(dia)} min${dia.foco ? ' · ' + h(dia.foco) : ''}</p>
      ${porque(dia)}
      <button class="btn grande" data-act="entrenador.prepararHoy">${ICONOS.play} Empezar</button>
      <p class="tenue pie">Antes te pregunto cómo estás y lo ajusto.</p></section>`;
  }
  const sig = siguientePendiente(S);
  return `<section class="tarjeta destacada">
    <span class="etiqueta">Hoy</span>
    <h2>Descanso</h2>
    <p class="tenue">${sig ? `Lo siguiente: ${h(minus(DIAS[sig.diaSemana]))}, ${h(minus(sig.nombre))}.` : 'Has hecho todo lo de esta semana.'} Descansar también es entrenar.</p>
    <button class="btn sec" data-act="entrenador.prepararHoy">Entrenar igualmente</button></section>`;
}

function tarjetaSinPlan(S) {
  const d = S.perfil.disponibilidad;
  return `<section class="tarjeta destacada">
    <span class="etiqueta">Esta semana</span>
    <h2>¿Qué días puedes entrenar?</h2>
    <p class="tenue">Dímelo y te monto la semana: calentamiento, ejercicios, rehabilitación y estiramientos de cada día. Cada día lo ajusto a cómo estés.</p>
    ${d.diasSemana.length ? `<p class="tenue">La última vez: ${h(d.diasSemana.map(i => DIAS[i]).filter(Boolean).join(', '))}.</p>` : ''}
    <button class="btn grande" data-act="entrenador.plan">${ICONOS.ia} Montar mi semana</button></section>`;
}

function vista() {
  const S = estado(), p = PERSONAS[S.dueño];
  const sinPerfil = !S.perfil.objetivos.length;
  const plan = planDeLaSemana(S);
  const dias = estadoDias(S);
  const constancia = typeof progreso.tarjetaConstancia === 'function'
    ? progreso.tarjetaConstancia(S, plan ? { planificados: dias.length, hechosPlan: dias.filter(d => d.estado === 'hecho').length } : {}) : '';
  return `
  <header class="saludo"><p class="tenue">${h(fechaLarga(hoyISO()))}</p><h1 class="titulo">Hola, ${h(p ? p.nombre : '')}</h1></header>
  ${sinPerfil ? `<section class="tarjeta destacada"><span class="etiqueta">Primero</span><h2>Cuéntale a tu entrenador quién eres</h2>
      <p class="tenue">Objetivos, nivel, lesiones, dónde entrenas y cuántos días puedes. Sin eso va a ciegas.</p>
      <a class="btn grande" href="#perfil">Completar mi perfil</a></section>`
    : plan ? `${tiraSemana(S)}${tarjetaHoy(S)}${constancia}${tarjetaPlan(S)}`
      : `${sesionDeHoy(S) ? tarjetaHoy(S) : ''}${tarjetaSinPlan(S)}${constancia}`}
  ${recordatorioCopia()}`;
}

rutas({ hoy: { titulo: 'Hoy', vista } });
pestaña({ ruta: 'hoy', nombre: 'Hoy', icono: ICONOS.hoy, orden: 10 });
acciones({ 'hoy.ir': el => ir(el.dataset.v) });
