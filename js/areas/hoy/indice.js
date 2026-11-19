// Área HOY (inicio): qué toca hoy, la sesión en marcha o hecha, la semana y el plan.

import { rutas, pestaña, acciones, ir } from '../../nucleo/router.js';
import { estado, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, fechaLarga } from '../../nucleo/ui.js';
import { sesionDeHoy, diaSemana } from '../../nucleo/modelo.js';
import { PERSONAS, LUGARES, DIAS_CORTOS } from '../../datos/constantes.js';
import { tarjetaPlan, planDeHoy, planDeLaSemana } from '../entrenador/indice.js';
import { sesionesHechas } from '../../reglas/progresion.js';

function semanaActual(S) {
  const hoy = new Date(), d = diaSemana(hoy);
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - d + 1);
  const hechas = new Set(sesionesHechas(S).map(s => s.fecha));
  const plan = planDeLaSemana(S);
  return [1, 2, 3, 4, 5, 6, 7].map(i => {
    const f = new Date(lunes); f.setDate(lunes.getDate() + i - 1);
    const iso = hoyISO(f);
    return { i, iso, hecha: hechas.has(iso), toca: plan && plan.dias.some(x => x.diaSemana === i), hoy: i === d };
  });
}

function tarjetaHoy(S) {
  const s = sesionDeHoy(S);
  const plan = planDeHoy(S);
  if (s && s.estado === 'hecha') {
    const series = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
    return `<section class="tarjeta destacada hecha">
      <span class="etiqueta">${ICONOS.check} Hecha</span>
      <h2>${h(s.nombre)}</h2><p class="tenue">${series} series · ${h(LUGARES[s.lugar] || '')}${s.cierre && s.cierre.esfuerzo ? ' · esfuerzo ' + s.cierre.esfuerzo + '/5' : ''}</p>
      <div class="fila-botones"><a class="btn sec" href="#sesion/${s.id}">Ver sesión</a><button class="btn sec" data-act="entrenador.prepararHoy">Otra sesión</button></div></section>`;
  }
  if (s) {
    const total = s.ejercicios.reduce((a, x) => a + x.sets.length, 0), hechas = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
    return `<section class="tarjeta destacada">
      <span class="etiqueta">${s.estado === 'en_curso' ? 'En marcha' : 'Lista'} · ${s.fuente === 'ia' ? 'entrenador IA' : s.fuente === 'plan' ? 'del plan' : 'reglas'}</span>
      <h2>${h(s.nombre)}</h2>
      <p class="tenue">${h(s.foco)}${s.foco ? ' · ' : ''}${s.ejercicios.length} ejercicios · ${h(LUGARES[s.lugar] || '')}</p>
      ${hechas ? `<div class="barra"><i style="width:${Math.round(hechas / total * 100)}%"></i></div>` : ''}
      <a class="btn grande" href="#sesion/${s.id}">${ICONOS.play} ${s.estado === 'en_curso' ? 'Seguir' : 'Empezar'}</a>
      <button class="enlace" data-act="entrenador.prepararHoy">Prepararla de nuevo</button></section>`;
  }
  return `<section class="tarjeta destacada">
    <span class="etiqueta">Hoy</span>
    <h2>${plan ? h(plan.nombre) : 'Sesión de hoy'}</h2>
    <p class="tenue">${plan ? `${h(LUGARES[plan.lugar])}${plan.foco ? ' · ' + h(plan.foco) : ''}` : 'Cuéntale cómo estás y el entrenador te prepara la sesión: calentamiento, ejercicios, rehabilitación y estiramientos.'}</p>
    <button class="btn grande" data-act="entrenador.prepararHoy">${ICONOS.ia} Preparar sesión</button></section>`;
}

function vista() {
  const S = estado(), p = PERSONAS[S.dueño];
  const falta = !S.perfil.objetivos.length;
  return `
  <header class="saludo"><p class="tenue">${h(fechaLarga(hoyISO()))}</p><h1 class="titulo">Hola, ${h(p ? p.nombre : '')}</h1></header>
  ${falta ? `<a class="tarjeta aviso-perfil" href="#perfil"><b>Completa tu perfil</b><span>Objetivos, lesiones y días: sin eso el entrenador va a ciegas.</span></a>` : ''}
  <ol class="tira-semana" aria-label="Esta semana">${semanaActual(S).map(d => `<li class="${d.hoy ? 'hoy' : ''} ${d.hecha ? 'hecha' : ''} ${d.toca ? 'toca' : ''}"><span>${DIAS_CORTOS[d.i]}</span><i></i></li>`).join('')}</ol>
  ${tarjetaHoy(S)}
  ${tarjetaPlan(S)}`;
}

rutas({ hoy: { titulo: 'Hoy', vista } });
pestaña({ ruta: 'hoy', nombre: 'Hoy', icono: ICONOS.hoy, orden: 10 });
acciones({ 'hoy.ir': el => ir(el.dataset.v) });
