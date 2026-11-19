// Área ENTRENADOR · interfaz: check-in antes de la sesión, plan semanal y su porqué.
// La lógica (IA + reglas de respaldo) está en entrenador.js.

import { acciones, ir } from '../../nucleo/router.js';
import { estado } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, $ } from '../../nucleo/ui.js';
import { enLinea } from '../../nucleo/api.js';
import { diaSemana } from '../../nucleo/modelo.js';
import { LUGARES, DIAS, DIAS_CORTOS, MUSCULOS } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { crearSesionHoy, crearPlanSemana, planDeLaSemana, planDeHoy, sesionDesdePlan } from './entrenador.js';

export { planDeLaSemana, planDeHoy };

// ── Check-in: solo lo que cambia la sesión (lugar, tiempo, energía, dolor y una petición) ──
let ci = null;
const ENERGIA = ['', 'Muy baja', 'Baja', 'Normal', 'Buena', 'A tope'];

function hojaCheckin() {
  const S = estado();
  const zonas = [...new Set([...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona), ...Object.keys(ci.dolorHoy)])];
  const otras = Object.keys(ZONAS).filter(z => !zonas.includes(z));
  const plan = planDeHoy(S);
  abrirHoja(`<h2>Antes de empezar</h2>
    ${plan ? `<p class="tenue">Hoy toca <b>${h(plan.nombre)}</b> en ${h(LUGARES[plan.lugar].toLowerCase())}. El entrenador lo ajusta a cómo estás.</p>` : ''}
    <div class="campo col"><span>Dónde</span><div class="chips">${S.perfil.lugares.map(l => `<button class="chip ${ci.lugar === l ? 'on' : ''}" data-act="entrenador.ci" data-k="lugar" data-v="${l}">${h(LUGARES[l])}</button>`).join('')}</div></div>
    <div class="campo col"><span>Tiempo</span><div class="chips">${[30, 45, 60, 75, 90].map(m => `<button class="chip ${ci.minutos === m ? 'on' : ''}" data-act="entrenador.ci" data-k="minutos" data-v="${m}">${m} min</button>`).join('')}</div></div>
    <div class="campo col"><span>Energía: <b>${ENERGIA[ci.energia]}</b></span><div class="segmentos">${[1, 2, 3, 4, 5].map(n => `<button class="${ci.energia === n ? 'on' : ''}" data-act="entrenador.ci" data-k="energia" data-v="${n}">${n}</button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor hoy · ${h(ZONAS[z].corta)}: <b id="ci-${z}">${ci.dolorHoy[z] || 0}</b>/10</span>
      <input type="range" min="0" max="10" value="${ci.dolorHoy[z] || 0}" data-cambio="entrenador.ciDolor" data-z="${z}" oninput="document.getElementById('ci-${z}').textContent=this.value"></label>`).join('')}
    <label class="campo col"><span>¿Te duele algo más?</span><select data-cambio="entrenador.ciZona"><option value="">No</option>${otras.map(z => `<option value="${z}">${h(ZONAS[z].nombre)}</option>`).join('')}</select></label>
    <label class="campo col"><span>Algo que pedir <small>opcional</small></span><input id="ci-peticion" value="${h(ci.peticion)}" placeholder="Ej.: hoy solo tren superior, la prensa está ocupada…"></label>
    ${Math.max(0, ...Object.values(ci.dolorHoy)) >= 7 ? '<p class="nota aviso-nota">Dolor fuerte hoy: el entrenador te propondrá algo suave o solo movilidad. Si dura varios días, consúltalo con tu fisio.</p>' : ''}
    <button class="btn grande" data-act="entrenador.crearHoy">${ICONOS.ia} ${enLinea() ? 'Crear mi sesión' : 'Crear sin conexión'}</button>`, { clase: 'checkin' });
  $('#ci-peticion').addEventListener('input', e => { ci.peticion = e.target.value; });
}

function abrirCheckin() {
  const S = estado(), plan = planDeHoy(S);
  ci = { lugar: plan ? plan.lugar : S.perfil.lugares[0], minutos: (plan && plan.minutos) || S.perfil.disponibilidad.minutos, energia: 3, dolorHoy: {}, peticion: '' };
  S.perfil.lesiones.filter(l => l.activa).forEach(l => { ci.dolorHoy[l.zona] = l.dolor; });
  hojaCheckin();
}

function cargando(txt) {
  abrirHoja(`<div class="cargando"><div class="giro"></div><p>${h(txt)}</p><p class="tenue">Suele tardar entre 20 y 60 segundos.</p></div>`);
}

// ── Plan semanal ──
let ps = null;
function hojaPlan() {
  const S = estado();
  abrirHoja(`<h2>Tu semana</h2>
    <p class="tenue">Marca los días que puedes entrenar esta semana. El entrenador reparte el trabajo y lo explica.</p>
    <div class="chips dias">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button class="chip ${ps.dias.includes(i) ? 'on' : ''}" data-act="entrenador.psDia" data-v="${i}">${DIAS_CORTOS[i]}</button>`).join('')}</div>
    <div class="campo col"><span>Minutos por sesión</span><div class="chips">${[30, 45, 60, 75, 90].map(m => `<button class="chip ${ps.minutos === m ? 'on' : ''}" data-act="entrenador.psMin" data-v="${m}">${m} min</button>`).join('')}</div></div>
    <div class="campo col"><span>Lugares</span><div class="chips">${S.perfil.lugares.map(l => `<button class="chip ${ps.lugares.includes(l) ? 'on' : ''}" data-act="entrenador.psLugar" data-v="${l}">${h(LUGARES[l])}</button>`).join('')}</div></div>
    <button class="btn grande" data-act="entrenador.crearPlan" ${ps.dias.length ? '' : 'disabled'}>${ICONOS.ia} Crear plan de ${ps.dias.length} día${ps.dias.length === 1 ? '' : 's'}</button>`);
}

export function tarjetaPlan(S) {
  const p = planDeLaSemana(S);
  if (!p) return `<section class="tarjeta">
    <h2>Plan de la semana</h2>
    <p class="tenue">Dile al entrenador qué días tienes esta semana y te reparte el trabajo.</p>
    <button class="btn sec" data-act="entrenador.plan">${ICONOS.ia} Crear plan de la semana</button></section>`;
  const hoy = diaSemana();
  return `<section class="tarjeta">
    <h2>Plan de la semana <small>${p.fuente === 'ia' ? 'entrenador IA' : 'reglas'}</small></h2>
    ${p.resumen ? `<p>${h(p.resumen)}</p>` : ''}
    <ul class="semana">${p.dias.map(d => `<li class="${d.diaSemana === hoy ? 'hoy' : d.diaSemana < hoy ? 'pasado' : ''}"><b>${DIAS[d.diaSemana]}</b><span>${h(d.nombre)} · ${h(LUGARES[d.lugar])}</span></li>`).join('')}</ul>
    <details class="plegable"><summary>Por qué este plan</summary>
      ${p.criterios ? `<p>${h(p.criterios)}</p>` : ''}${p.progresion ? `<p><b>Progresión:</b> ${h(p.progresion)}</p>` : ''}
      ${p.dias.map(d => d.explicacion.length ? `<p><b>${DIAS[d.diaSemana]}:</b> ${d.explicacion.map(h).join(' ')}</p>` : '').join('')}
    </details>
    <button class="btn sec" data-act="entrenador.plan">Cambiar días y rehacer</button></section>`;
}

acciones({
  'entrenador.prepararHoy': abrirCheckin,
  'entrenador.ci': el => { const k = el.dataset.k; ci[k] = k === 'lugar' ? el.dataset.v : +el.dataset.v; hojaCheckin(); },
  'entrenador.ciDolor': el => { ci.dolorHoy[el.dataset.z] = +el.value; hojaCheckin(); },
  'entrenador.ciZona': el => { if (el.value) { ci.dolorHoy[el.value] = 3; hojaCheckin(); } },
  'entrenador.crearHoy': async () => {
    const S = estado(), plan = planDeHoy(S);
    const datos = { ...ci };
    if (!enLinea() && plan && plan.lugar === datos.lugar && plan.ejercicios.length) {
      const s = sesionDesdePlan(plan, datos);
      cerrarHoja(); ir('sesion/' + s.id); return;
    }
    cargando('Tu entrenador está preparando la sesión…');
    const { sesion, aviso: a } = await crearSesionHoy(datos);
    cerrarHoja();
    if (a) aviso(a, 'info');
    ir('sesion/' + sesion.id);
  },
  'entrenador.plan': () => {
    const S = estado(), d = S.perfil.disponibilidad;
    ps = { dias: d.diasSemana.length ? d.diasSemana.slice() : [], minutos: d.minutos, lugares: S.perfil.lugares.slice() };
    hojaPlan();
  },
  'entrenador.psDia': el => { const v = +el.dataset.v, i = ps.dias.indexOf(v); if (i >= 0) ps.dias.splice(i, 1); else ps.dias.push(v); ps.dias.sort(); hojaPlan(); },
  'entrenador.psMin': el => { ps.minutos = +el.dataset.v; hojaPlan(); },
  'entrenador.psLugar': el => { const v = el.dataset.v, i = ps.lugares.indexOf(v); if (i >= 0 && ps.lugares.length > 1) ps.lugares.splice(i, 1); else if (i < 0) ps.lugares.push(v); hojaPlan(); },
  'entrenador.crearPlan': async () => {
    const datos = { ...ps };
    cargando('Tu entrenador está montando la semana…');
    const { aviso: a } = await crearPlanSemana(datos);
    cerrarHoja();
    aviso(a || 'Plan de la semana listo', a ? 'info' : '');
  },
});

// Texto corto de un ejercicio para listas (lo usan Hoy y Progreso).
export const nombreEj = id => (ex(id) ? ex(id).n : id);
export const musculoEj = id => (ex(id) ? MUSCULOS[ex(id).m[0]] : '');
