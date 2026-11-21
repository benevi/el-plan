// Área SESIÓN: hacer la sesión en el gimnasio. Funciona sin conexión (todo está guardado en el móvil).
// Dos modos: lista completa o un ejercicio cada vez. Apuntar series, descansos con alarma, ejercicios por
// tiempo, cambiar un ejercicio, opinar de él, comentar al entrenador y cerrar con esfuerzo y dolor.

import { rutas, acciones, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num } from '../../nucleo/ui.js';
import { crearEjercicio, trabajoHecho } from '../../nucleo/modelo.js';
import { ex, alternativas, ZONAS } from '../../reglas/catalogo.js';
import { rango, registros } from '../../reglas/progresion.js';
import { LUGARES, MUSCULOS, GUSTOS } from '../../datos/constantes.js';
import { abrirFicha, botonesGusto, miniatura } from '../ejercicios/indice.js';
import { notaFallo } from '../entrenador/indice.js';
import { guardarMia, miaDe, LARGO_NOMBRE_MIA, pararPorAlarma, limiteDolor, T3 } from '../entrenador/entrenador.js';
import { descanso, cuenta, parar, registrarFin, mantenerPantalla, soltarPantalla, info } from './temporizador.js';

const ROL = { rehab: 'Rehabilitación', cardio: 'Cardio', principal: '' };
const minus = t => String(t || '').toLowerCase();
let foco = { id: null, i: 0 };

const sesion = id => estado().sesiones[id];
// Segundos del rango («30-45s» → 30 y 45; «2 min» → 120). Cero si no es por tiempo.
const objetivoSeg = x => { const r = rango(x.reps); if (!r || (r.u !== 's' && r.u !== 'min')) return null; const k = r.u === 'min' ? 60 : 1; return { lo: Math.round(r.lo * k), hi: Math.round(r.hi * k), lados: /c\/\s*lado|por lado|cada lado/i.test(r.resto) ? 2 : 1, u: r.u }; };
const segundosObjetivo = x => { const o = objetivoSeg(x); return o ? o.hi : 0; };
const textoSeg = (seg, u) => u === 'min' ? (seg % 60 ? Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0') : String(seg / 60)) : String(seg);
// El cardio por minutos se apunta y se enseña en minutos («8 min», «8:01 min»), no como segundos (E5).
const unidad = x => { const e = ex(x.id); const r = rango(x.reps); return e && e.t === 'distancia' ? 'm' : r && r.u === 'min' ? 'min' : r && r.u === 's' ? 'seg' : 'reps'; };
const textoObjetivo = (seg, u) => u === 'min' ? `${textoSeg(seg, 'min')} minutos` : `${seg} segundos`;
// Solo se apunta peso si el ejercicio usa algo que se carga (banda, peso corporal o banco no llevan kg).
const CON_PESO = ['mancuernas', 'barra', 'maquina', 'polea', 'botellas'];
const conKg = x => { const e = ex(x.id); return !!e && e.t === 'reps' && e.mat.some(m => CON_PESO.includes(m)); };

function empezarSiHaceFalta(S, s) {
  if (s.estado === 'pendiente') { s.estado = 'en_curso'; s.empezada = new Date().toISOString(); }
}

function tareas(s, clave, titulo, abierto) {
  const lista = s[clave]; if (!lista.length) return '';
  const hechas = lista.filter(t => t.hecho).length;
  const abrir = abierto != null ? abierto : hechas < lista.length && s.estado !== 'hecha';
  return `<details class="tarjeta bloque" ${abrir ? 'open' : ''}>
    <summary><h2>${titulo}</h2><span class="tenue">${hechas === lista.length ? ICONOS.check : `${hechas}/${lista.length}`}</span></summary>
    <ul class="tareas">${lista.map((t, i) => `<li class="${t.hecho ? 'hecho' : ''}">
      <button class="marca" data-act="sesion.tarea" data-k="${clave}" data-i="${i}" aria-pressed="${t.hecho}" aria-label="Hecho">${t.hecho ? ICONOS.check : ''}</button>
      <div class="grow"><div class="t-nombre"><b>${h(t.nombre)}</b>${t.duracion ? `<span class="dur">${h(t.duracion)}</span>` : ''}</div>${t.detalle ? `<p class="tenue">${h(t.detalle)}</p>` : ''}</div>
      ${t.id ? `<button class="icono" data-act="sesion.ficha" data-id="${h(t.id)}" aria-label="Cómo se hace">${ICONOS.info}</button>` : ''}</li>`).join('')}</ul></details>`;
}

function filaSerie(x, i, j) {
  const z = x.sets[j], u = unidad(x), seg = segundosObjetivo(x);
  // Ejercicio parado por dolor (C-DOLOR-6): lo no hecho ya no se apunta ni se cronometra.
  if (x.dolorDurante && !z.hecha) return `<li class="serie"><span class="n">${j + 1}</span><span class="tenue grow">No se hace hoy</span></li>`;
  const r = rango(x.reps);
  const ph = r ? (r.lo === r.hi ? String(r.lo) : `${r.lo}-${r.hi}`) : '';
  return `<li class="serie ${z.hecha ? 'hecha' : ''}">
    <span class="n">${j + 1}</span>
    ${conKg(x) ? `<label class="dato"><input inputmode="decimal" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="kg" value="${z.kg != null ? h(z.kg) : ''}" placeholder="${x.kg != null ? h(x.kg) : '—'}"><small>kg</small></label>` : ''}
    <label class="dato"><input inputmode="${u === 'seg' || u === 'min' ? 'text' : 'numeric'}" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="valor" value="${h(z.valor)}" placeholder="${h(ph)}"><small>${u}</small></label>
    ${seg && !z.hecha ? `<button class="icono play" data-act="sesion.cuenta" data-e="${i}" data-s="${j}" aria-label="Empezar ${h(textoObjetivo(seg, (objetivoSeg(x) || {}).u))}">${ICONOS.play}</button>` : ''}
    <button class="marca" data-act="sesion.serie" data-e="${i}" data-s="${j}" aria-pressed="${z.hecha}" aria-label="Serie hecha">${z.hecha ? ICONOS.check : ''}</button></li>`;
}

// Lo que la persona abre o cierra se respeta al repintar.
const tecnicaAbierta = {};
document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.tecnica')) tecnicaAbierta[d.dataset.id] = d.open; }, true);

// Cómo se hace, dentro de la propia tarjeta: vídeo, pasos, errores a evitar y consejo.
// Abierto si la persona aún no lo ha hecho nunca; plegado (un toque) si ya lo conoce.
function tecnica(x) {
  const e = ex(x.id); if (!e || !(e.p && e.p.length)) return '';
  const nuevo = !registros(estado(), x.id).length;
  const abierto = x.id in tecnicaAbierta ? tecnicaAbierta[x.id] : nuevo;
  return `<details class="tecnica" data-id="${h(x.id)}" ${abierto ? 'open' : ''}>
    <summary>${ICONOS.info} Cómo se hace${nuevo ? ' <span class="insignia">Nuevo para ti</span>' : ''}</summary>
    ${e.v ? `<a class="video-ficha" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener" aria-label="Ver vídeo de ${h(e.n)}"><img src="${miniatura(e)}" alt="" loading="lazy" data-quitar-si-falla><span>${ICONOS.play} Ver vídeo</span></a>` : ''}
    <ol class="pasos">${e.p.map(t => `<li>${h(t)}</li>`).join('')}</ol>
    ${e.e && e.e.length ? `<p class="evita">Evita</p><ul class="errores">${e.e.map(t => `<li>${h(t)}</li>`).join('')}</ul>` : ''}
    ${e.c ? `<p class="consejo">${h(e.c)}</p>` : ''}
  </details>`;
}

function tarjetaEjercicio(s, x, i, grande = false) {
  const e = ex(x.id) || { n: x.nombre || x.id, m: [] };
  const hechas = x.sets.filter(z => z.hecha).length;
  return `<article class="tarjeta ejercicio ${hechas === x.sets.length || x.dolorDurante ? 'completo' : ''} ${grande ? 'grande' : ''}" id="ej-${i}">
    <header>
      <span class="num">${hechas === x.sets.length ? ICONOS.check : i + 1}</span>
      <div class="grow"><h3>${h(e.n)}</h3>
        <p class="tenue">${ROL[x.rol] && Object.prototype.hasOwnProperty.call(ROL, x.rol) ? `<span class="insignia ${h(x.rol)}">${h(ROL[x.rol])}</span> ` : ''}${+x.series} × ${h(x.reps)}${x.kg != null ? ` · ${h(x.kg)} kg` : ''}${x.descanso ? ` · ${+x.descanso} s descanso` : ''}</p></div>
      <button class="icono" data-act="sesion.menu" data-e="${i}" aria-label="Más opciones">${ICONOS.lista}</button>
    </header>
    ${x.dolorDurante ? `<p class="nota aviso-nota">Parado por dolor: tu ${h(minus((ZONAS[x.dolorDurante.zona] || {}).corta || x.dolorDurante.zona))} a ${+x.dolorDurante.dolor}/10 (empezaste en ${+x.dolorDurante.antes}/10; el tope era ${+x.dolorDurante.techo}/10). Queda apuntado y hoy no se repite.</p>` : ''}
    ${x.nota ? `<p class="nota">${h(x.nota)}</p>` : ''}
    ${x.motivo ? `<p class="motivo">${h(x.motivo)}</p>` : ''}
    ${tecnica(x)}
    <ul class="series">${x.sets.map((_, j) => filaSerie(x, i, j)).join('')}</ul>
    ${x.comentario ? `<p class="comentario">«${h(x.comentario)}»</p>` : ''}
  </article>`;
}

// «Guardar como mía» (o de cuál de tus sesiones sale). Va al principio en «uno a uno» y al final en la lista.
function pieMia(S, s) {
  const m = s.origen && miaDe(S, s.origen.id);
  if (m) return `<p class="tenue centro mia-origen">De tus sesiones: «${h(m.nombre)}»</p>`;
  if (s.tipo === 'dolorAlto' || !s.ejercicios.some(x => ex(x.id))) return '';
  return `<button class="enlace centro" data-act="sesion.guardarMia">${ICONOS.mas} Guardar como mía para repetirla</button>`;
}

// Pasos del modo «uno a uno»: calentamiento, cada ejercicio y vuelta a la calma.
function pasos(s) {
  return [...(s.calentamiento.length ? [{ k: 'calentamiento' }] : []), ...s.ejercicios.map((_, i) => ({ k: 'ej', i })), ...(s.vuelta.length ? [{ k: 'vuelta' }] : [])];
}
const ejHecho = x => !!x.dolorDurante || x.sets.every(z => z.hecha);
const pasoHecho = (s, p) => p.k === 'ej' ? ejHecho(s.ejercicios[p.i]) : s[p.k].every(t => t.hecho);
const primerPendiente = s => { const P = pasos(s); const k = P.findIndex(p => !pasoHecho(s, p)); return k < 0 ? P.length - 1 : k; };
const modoFocoActivo = S => (S.ajustes.modoSesion || 'foco') === 'foco';

function vista([id]) {
  const S = estado(), s = sesion(id);
  if (!s) return `<div class="tarjeta"><p>No encuentro esa sesión.</p><a class="btn" href="#hoy">Volver a Hoy</a></div>`;
  const total = s.ejercicios.reduce((a, x) => a + x.sets.length, 0), hechas = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
  const abierta = s.estado !== 'hecha';
  const modoFoco = modoFocoActivo(S) && abierta;
  if (foco.id !== id) foco = { id, i: primerPendiente(s) };
  const cab = `<header class="cab-sesion">
      <a href="#hoy" class="icono" aria-label="Volver a Hoy">${ICONOS.atras}</a>
      <div class="grow"><h1>${h(s.nombre)}</h1><p class="tenue">${h(LUGARES[s.lugar] || '')} · ${hechas}/${total} series</p></div>
      ${abierta ? `<button class="btn sec pequeño" data-act="sesion.terminar">Terminar</button>` : ''}
    </header>
    <div class="barra"><i style="width:${total ? Math.round(hechas / total * 100) : 0}%"></i></div>
    ${abierta ? `<div class="segmentos modo-sesion" role="group" aria-label="Cómo ver la sesión">
      <button data-act="sesion.modo" data-v="foco" class="${modoFoco ? 'on' : ''}" aria-pressed="${modoFoco}">Uno a uno</button>
      <button data-act="sesion.modo" data-v="lista" class="${modoFoco ? '' : 'on'}" aria-pressed="${!modoFoco}">Toda la sesión</button></div>
    <button class="enlace peligro centro" data-act="sesion.algoVaMal">Algo va mal</button>` : ''}`;
  // Por qué: la primera frase (resumen del día) siempre a la vista; el resto, plegado.
  const [resumenDia, ...razones] = s.explicacion || [];
  // Si la hizo la app porque falló la IA, la nota con «Reintentar con IA» va aquí arriba (PR 12).
  const porque = resumenDia || s.iaFallo ? `<section class="tarjeta porque">
      ${notaFallo(s)}
      ${resumenDia ? `<p class="porque-resumen">${ICONOS.ia}<span>${h(resumenDia)}</span></p>` : ''}
      ${razones.length ? `<details class="plegable"><summary>Por qué cada decisión</summary><ul>${razones.map(t => `<li>${h(t)}</li>`).join('')}</ul></details>` : ''}
    </section>` : '';

  if (modoFoco) {
    const P = pasos(s), k = Math.min(foco.i, P.length - 1), p = P[k];
    const nombrePaso = q => q.k === 'calentamiento' ? 'C' : q.k === 'vuelta' ? 'V' : String(q.i + 1);
    const tira = `<nav class="pasos-sesion" aria-label="Partes de la sesión">${P.map((q, n) => `<button data-act="sesion.ir" data-v="${n}" class="${n === k ? 'actual' : ''} ${pasoHecho(s, q) ? 'hecho' : ''}" aria-label="${q.k === 'ej' ? 'Ejercicio ' + (q.i + 1) : q.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma'}" ${n === k ? 'aria-current="step"' : ''}>${pasoHecho(s, q) && n !== k ? ICONOS.check : nombrePaso(q)}</button>`).join('')}</nav>`;
    const cuerpo = p.k === 'ej' ? tarjetaEjercicio(s, s.ejercicios[p.i], p.i, true)
      : tareas(s, p.k, p.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma', true);
    const ultimo = k === P.length - 1;
    return `${cab}${tira}
      ${k === 0 ? porque + pieMia(S, s) : ''}
      ${cuerpo}
      <div class="fila-botones"><button class="btn sec" data-act="sesion.foco" data-v="-1" ${k === 0 ? 'disabled' : ''}>${ICONOS.atras} Anterior</button>
      ${!ultimo ? `<button class="btn" data-act="sesion.foco" data-v="1">Siguiente ${ICONOS.sig}</button>` : `<button class="btn" data-act="sesion.terminar">${ICONOS.check} Terminar</button>`}</div>`;
  }

  // Toda la sesión: lo hecho se pliega para que la página no sea eterna.
  return `${cab}${porque}
    ${tareas(s, 'calentamiento', 'Calentamiento')}
    ${s.ejercicios.map((x, i) => abierta && ejHecho(x) ? tarjetaPlegada(x, i) : tarjetaEjercicio(s, x, i)).join('')}
    ${tareas(s, 'vuelta', 'Vuelta a la calma')}
    ${!abierta
      ? `<section class="tarjeta"><h2>Cierre</h2><p>Esfuerzo ${s.cierre && s.cierre.esfuerzo ? +s.cierre.esfuerzo + '/5' : '—'}</p>${s.cierre && s.cierre.comentario ? `<p class="comentario">«${h(s.cierre.comentario)}»</p>` : ''}</section>${pieMia(S, s)}`
      : `${pieMia(S, s)}<button class="btn grande" data-act="sesion.terminar">${ICONOS.check} Terminar sesión</button>
         <button class="enlace peligro centro" data-act="sesion.descartar">Descartar esta sesión</button>`}`;
}

// Ejercicio ya hecho en la vista de lista: una línea con lo apuntado; se abre al tocarla.
function tarjetaPlegada(x, i) {
  const e = ex(x.id) || { n: x.id }, u = unidad(x);
  const res = x.sets.map(z => (conKg(x) && z.kg != null ? `${z.kg}×` : '') + (z.valor || '—')).join(' · ');
  return `<details class="tarjeta ejercicio completo plegada" id="ej-${i}">
    <summary><span class="num">${ICONOS.check}</span><span class="grow"><b>${h(e.n)}</b><span class="tenue">${h(res)} ${u === 'reps' ? '' : u}</span></span></summary>
    ${tarjetaEjercicio(null, x, i).replace(/^<article[^>]*>|<\/article>$/g, '')}
  </details>`;
}

// ── Acciones ──
const idActual = () => location.hash.split('/')[1];
function conSesion(fn, motivo = 'sesion') {
  const id = idActual();
  cambiar(S => { const s = S.sesiones[id]; if (s) fn(s, S); }, motivo);
}


function hojaCierre() {
  const s = sesion(idActual());
  // Sin ninguna serie no hay sesión que guardar: no cuenta como entrenada ni para la constancia (E7).
  if (s && !trabajoHecho(s)) {
    abrirHoja(`<h2>No has marcado nada</h2>
      <p>Una sesión sin ninguna serie ni tarea marcada no cuenta como entrenada. Si las has hecho, márcalas (el círculo de cada una) y vuelve a «Terminar».</p>
      <div class="fila-botones"><button class="btn sec" data-act="sesion.seguir">Volver a la sesión</button><button class="btn peligro" data-act="sesion.descartar">Descartar la sesión</button></div>`);
    return;
  }
  // Solo zonas del catálogo: su clave va dentro de un id (y del data-eco que lo rellena).
  const zonas = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...estado().perfil.lesiones.filter(l => l.activa).map(l => l.zona)])].filter(z => Object.prototype.hasOwnProperty.call(ZONAS, z));
  abrirHoja(`<h2>¿Qué tal ha ido?</h2>
    <div class="campo col"><span>Esfuerzo</span><div class="segmentos" id="c-esf">${[['1', 'Muy fácil'], ['2', 'Fácil'], ['3', 'Justo'], ['4', 'Duro'], ['5', 'Al límite']].map(([v, t]) => `<button data-v="${v}" class="${v === '3' ? 'on' : ''}">${v}<small>${t}</small></button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor ahora · ${h(ZONAS[z].corta)}: <b id="c-${h(z)}-v">${+(s.checkin && s.checkin.dolor[z]) || 0}</b>/10</span><input type="range" min="0" max="10" value="${+(s.checkin && s.checkin.dolor[z]) || 0}" data-zona="${h(z)}" data-eco="c-${h(z)}-v"></label>`).join('')}
    <label class="campo col"><span>Para tu entrenador <small>molestias, qué cambiarías…</small></span><textarea id="c-com" rows="3"></textarea></label>
    <button class="btn grande" data-act="sesion.cerrar">Guardar sesión</button>`);
  $('#c-esf').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#c-esf').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

// ── «Algo va mal» (T3 de alarma.js, C-ALAR-1 y C-DOLOR-6) ──
// Una señal de alarma para la sesión en curso; el dolor de la lesión se apunta por zona y, si pasa del límite
// (+2 sobre el de antes y nunca del techo), ese ejercicio se para, queda guardado y no se repite hoy.
const ejerciciosVivos = s => s.ejercicios.map((x, i) => ({ x, i })).filter(({ x }) => !x.dolorDurante && !x.sets.every(z => z.hecha) && ex(x.id));
function zonasDe(s, x) {
  const S = estado();
  const conDolor = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona)])].filter(z => Object.prototype.hasOwnProperty.call(ZONAS, z));
  const e = x && ex(x.id);
  const suyas = e ? conDolor.filter(z => (e.r || {})[z]) : [];
  return [...suyas, ...conDolor.filter(z => !suyas.includes(z)), ...Object.keys(ZONAS).filter(z => !conDolor.includes(z))];
}
let avm = null; // { e, zona, dolor }
function hojaAlgoVaMal() {
  const S = estado(), s = sesion(idActual()); if (!s) return;
  const vivos = ejerciciosVivos(s);
  if (avm.e == null || !vivos.some(v => v.i === avm.e)) avm.e = vivos.length ? vivos[0].i : null;
  const x = avm.e != null ? s.ejercicios[avm.e] : null;
  const zonas = zonasDe(s, x);
  if (!avm.zona || !zonas.includes(avm.zona)) avm.zona = zonas[0];
  const antes = +(((s.checkin || {}).dolor || {})[avm.zona] || 0);
  const { techo } = limiteDolor(S, avm.zona, antes, { rehab: !!x && x.rol === 'rehab' });
  if (avm.dolor == null) avm.dolor = antes;
  abrirHoja(`<h2>Algo va mal</h2>
    <p>${h(T3(techo))}</p>
    <button class="btn peligro grande" data-act="sesion.pararAlarma">Termino la sesión aquí</button>
    ${x ? `<h3>Si es solo el dolor de tu lesión</h3>
    <label class="campo col"><span>Ejercicio</span><select id="avm-ej" data-no-foco="1" data-cambio="sesion.avmCampo" data-k="e">${vivos.map(v => `<option value="${+v.i}" ${v.i === avm.e ? 'selected' : ''}>${h(ex(v.x.id).n)}</option>`).join('')}</select></label>
    <label class="campo col"><span>Dónde</span><select id="avm-zona" data-no-foco="1" data-cambio="sesion.avmCampo" data-k="zona">${zonas.map(z => `<option value="${h(z)}" ${z === avm.zona ? 'selected' : ''}>${h(ZONAS[z].corta)}</option>`).join('')}</select></label>
    <label class="campo col"><span>Dolor ahora: <b id="avm-v">${+avm.dolor}</b>/10 <small>empezaste en ${antes}/10</small></span><input type="range" id="avm-dolor" min="0" max="10" value="${+avm.dolor}" data-no-foco="1" data-eco="avm-v"></label>
    <button class="btn sec" data-act="sesion.dolorDurante">Apuntar el dolor</button>` : ''}`, { clase: 'precaucion' });
}
function menuEjercicio(i) {
  const s = sesion(idActual()), x = s.ejercicios[i], e = ex(x.id);
  abrirHoja(`<h2>${h(e ? e.n : x.id)}</h2>
    <div class="menu">
      <button data-act="sesion.ficha" data-id="${h(x.id)}">${ICONOS.info} Cómo se hace</button>
      ${s.estado !== 'hecha' ? `<button data-act="sesion.cambiar" data-e="${i}">${ICONOS.editar} Cambiar por otro</button>
      <button data-act="sesion.serieMas" data-e="${i}" data-v="1">${ICONOS.mas} Añadir una serie</button>
      ${x.sets.length > 1 ? `<button data-act="sesion.serieMas" data-e="${i}" data-v="-1">${ICONOS.menos} Quitar una serie</button>` : ''}
      ${x.dolorDurante ? '' : `<button data-act="sesion.algoVaMal" data-e="${i}">${ICONOS.x} Me duele al hacerlo</button>`}` : ''}
    </div>
    <h3>¿Qué te parece?</h3>${botonesGusto(x.id, 'sesion.gusto')}
    <label class="campo col"><span>Comentario para tu entrenador</span><textarea id="m-com" rows="2" data-no-foco="1" placeholder="Me molesta la muñeca, la máquina estaba ocupada…">${h(x.comentario)}</textarea></label>
    <button class="btn" data-act="sesion.comentar" data-e="${i}">Guardar comentario</button>`);
  // Sin foco automático en el comentario (va en la plantilla: abrirHoja decide al abrir): sacaba el teclado (E4).
}

function marcarSerie(i, j, valorPorDefecto, idSesion = idActual()) {
  let descansar = 0, etiqueta = '';
  cambiar(S => { const s = S.sesiones[idSesion]; if (!s) return;
    empezarSiHaceFalta(S, s);
    const x = s.ejercicios[i], z = x.sets[j];
    if (x.dolorDurante && !z.hecha) return; // parado por dolor: no se repite (C-DOLOR-6)
    z.hecha = !z.hecha;
    if (z.hecha) {
      if (!String(z.valor).trim()) { const r = rango(x.reps); z.valor = valorPorDefecto != null ? String(valorPorDefecto) : r ? String(r.lo) : ''; }
      if (z.kg == null && x.kg != null && conKg(x)) z.kg = x.kg;
      const ultima = j === x.sets.length - 1 && i === s.ejercicios.length - 1;
      if (!ultima && x.descanso) { descansar = x.descanso; etiqueta = j === x.sets.length - 1 ? 'Descanso · siguiente: ' + (ex(s.ejercicios[i + 1].id) || {}).n : `Descanso · serie ${j + 2} de ${x.sets.length}`; }
      // Uno a uno: al terminar la última serie, pasa solo al siguiente paso.
      if (j === x.sets.length - 1 && modoFocoActivo(S) && foco.id === idSesion) { const P = pasos(s), k = P.findIndex(p => p.k === 'ej' && p.i === i); if (k >= 0 && k < P.length - 1) foco.i = k + 1; }
    }
  }, 'sesion');
  if (descansar) descanso(descansar, etiqueta); else parar();
}

acciones({
  'sesion.modo': el => cambiar(S => { S.ajustes.modoSesion = el.dataset.v; }, 'ajustes'),
  'sesion.foco': el => { foco.i = Math.max(0, foco.i + +el.dataset.v); pintar(); window.scrollTo(0, 0); },
  'sesion.ir': el => { foco.i = +el.dataset.v; pintar(); window.scrollTo(0, 0); },
  'sesion.tarea': el => conSesion((s, S) => { empezarSiHaceFalta(S, s); const t = s[el.dataset.k][+el.dataset.i]; t.hecho = !t.hecho; }),
  'sesion.ficha': el => abrirFicha(el.dataset.id),
  'sesion.dato': el => conSesion(s => {
    const z = s.ejercicios[+el.dataset.e].sets[+el.dataset.s];
    if (el.dataset.k === 'kg') z.kg = num(el.value); else z.valor = el.value.trim();
  }, 'sesion-silencio'),
  'sesion.serie': el => marcarSerie(+el.dataset.e, +el.dataset.s),
  'sesion.cuenta': el => {
    const i = +el.dataset.e, j = +el.dataset.s, id = idActual(), x = sesion(id).ejercicios[i], o = objetivoSeg(x);
    if (!o) return;
    cuenta({ lo: o.lo, hi: o.hi, lados: o.lados, etiqueta: `${(ex(x.id) || {}).n} · serie ${j + 1} de ${x.sets.length}`, meta: { sesion: id, e: i, s: j } });
  },
  'sesion.menu': el => menuEjercicio(+el.dataset.e),
  'sesion.algoVaMal': el => {
    const s = sesion(idActual()); if (!s || s.estado === 'hecha') return;
    // El ejercicio: el del menú o, uno a uno, el que está a la vista.
    const P = pasos(s), p = P[Math.min(foco.i, P.length - 1)];
    const e = el.dataset.e != null ? +el.dataset.e : modoFocoActivo(estado()) && p && p.k === 'ej' ? p.i : null;
    avm = { e, zona: null, dolor: null };
    hojaAlgoVaMal();
  },
  'sesion.avmCampo': el => {
    if (el.dataset.k === 'e') { avm.e = +el.value; avm.zona = null; } else avm.zona = el.value;
    avm.dolor = null; // el dolor de partida es el de la zona elegida
    hojaAlgoVaMal();
  },
  'sesion.pararAlarma': async () => {
    const id = idActual();
    if (!await confirmar('¿Terminas la sesión aquí? Hoy ya no se entrena: lo que llevas hecho se guarda.', { si: 'Terminar aquí', no: 'Volver', peligro: true })) { hojaAlgoVaMal(); return; }
    parar(); pararPorAlarma(id); cerrarHoja(); ir('hoy');
  },
  'sesion.dolorDurante': () => {
    const S = estado(), s = sesion(idActual()); if (!s || avm.e == null) return;
    const i = avm.e, x = s.ejercicios[i], z = avm.zona, dolor = +(($('#avm-dolor') || {}).value || 0);
    const antes = +(((s.checkin || {}).dolor || {})[z] || 0);
    const { limite, techo } = limiteDolor(S, z, antes, { rehab: x.rol === 'rehab' });
    const zona = minus(ZONAS[z].corta), nombreEj = ex(x.id).n;
    if (dolor <= limite) {
      cerrarHoja();
      aviso(`Tu ${zona} a ${dolor}/10: dentro de lo que permite (hasta ${limite}/10). Sigue con cuidado; si sube más, para.`, 'info');
      return;
    }
    const cr = info();
    if (cr && cr.meta && cr.meta.sesion === s.id && cr.meta.e === i) parar();
    conSesion((s2, S2) => { empezarSiHaceFalta(S2, s2); s2.ejercicios[i].dolorDurante = { zona: z, dolor, antes, techo }; });
    abrirHoja(`<h2>Salta ${h(minus(nombreEj))}</h2>
      <p>Tu ${h(zona)} está a ${dolor}/10 y el límite era ${limite}/10: este ejercicio se para y queda apuntado para tu entrenador. Hoy no se repite.</p>
      <div class="fila-botones"><button class="btn sec" data-act="sesion.cambiar" data-e="${i}">Cambiar por otro</button><button class="btn" data-act="sesion.seguir">Seguir con el siguiente</button></div>`);
  },
  'sesion.serieMas': el => {
    conSesion(s => { const x = s.ejercicios[+el.dataset.e]; if (+el.dataset.v > 0) x.sets.push({ kg: x.kg, valor: '', hecha: false }); else if (x.sets.length > 1) x.sets.pop(); x.series = x.sets.length; });
    cerrarHoja();
  },
  'sesion.gusto': el => {
    const { id, v } = el.dataset;
    cambiar(S => {
      if (S.perfil.gustos[id] === v) delete S.perfil.gustos[id]; else S.perfil.gustos[id] = v;
      const s = S.sesiones[idActual()]; s && s.ejercicios.filter(x => x.id === id).forEach(x => { x.gusto = S.perfil.gustos[id] || null; });
    }, 'gusto');
    const i = sesion(idActual()).ejercicios.findIndex(x => x.id === id);
    if (v === 'rechazo' && estado().perfil.gustos[id] === 'rechazo') { aviso('No volverá a salir. Puedes cambiarlo ahora por otro.'); }
    menuEjercicio(i);
  },
  'sesion.comentar': el => { const t = $('#m-com').value.trim(); conSesion(s => { s.ejercicios[+el.dataset.e].comentario = t; }); cerrarHoja(); aviso('Lo leerá tu entrenador en la próxima sesión'); },
  'sesion.cambiar': el => {
    const S = estado(), s = sesion(idActual()), i = +el.dataset.e, x = s.ejercicios[i], e = ex(x.id);
    // Un principal, de su nivel (C-DOSIS-10), salvo en una de «Mis sesiones» (C-MIA-2). Si el ejercicio se paró
    // por dolor, tampoco nada que cargue esa zona a ese dolor (C-DOLOR-6).
    const esMia = !!(s.origen && s.origen.tipo === 'mia');
    const dd = x.dolorDurante;
    const dolorHoy = { ...((s.checkin && s.checkin.dolor) || {}), ...(dd ? { [dd.zona]: Math.max(+dd.dolor, +(((s.checkin || {}).dolor || {})[dd.zona] || 0)) } : {}) };
    const alts = alternativas(e, s.lugar, S.perfil, { excluir: s.ejercicios.map(y => y.id), dolorHoy, nivel: x.rol === 'principal' && !esMia ? Math.max(1, Math.min(3, +S.perfil.nivel || 1)) : null }).slice(0, 8);
    abrirHoja(`<h2>Cambiar ${h(e.n.toLowerCase())}</h2>
      ${alts.length ? `<ul class="lista">${alts.map(a => `<li><button class="fila" data-act="sesion.cambiarPor" data-e="${i}" data-id="${h(a.id)}"><span class="grow"><b>${h(a.n)}</b><span class="tenue">${a.m.map(m => MUSCULOS[m]).join(', ')}${S.perfil.gustos[a.id] ? ' · ' + GUSTOS[S.perfil.gustos[a.id]].icono : ''}</span></span>${ICONOS.sig}</button></li>`).join('')}</ul>` : '<p class="tenue">No hay alternativas seguras aquí.</p>'}`);
  },
  'sesion.cambiarPor': el => {
    conSesion(s => {
      const i = +el.dataset.e, viejo = s.ejercicios[i], n = ex(el.dataset.id);
      const nuevo = crearEjercicio({ id: n.id, rol: viejo.rol, series: viejo.series, reps: n.t === ex(viejo.id).t ? viejo.reps : n.d[1], descanso: viejo.descanso, nota: `En lugar de ${ex(viejo.id).n.toLowerCase()}.` });
      // Uno parado por dolor se queda (con su «dolor durante» apuntado) y el nuevo va detrás (C-DOLOR-6).
      // Si ya se había cambiado (el siguiente es su sustituto sin nada hecho), se cambia ese: no se van sumando.
      const sustituto = s.ejercicios[i + 1];
      const yaCambiado = viejo.dolorDurante && sustituto && sustituto.nota === `En lugar de ${ex(viejo.id).n.toLowerCase()}.` && !sustituto.sets.some(z => z.hecha);
      if (yaCambiado) s.ejercicios[i + 1] = nuevo; else if (viejo.dolorDurante) s.ejercicios.splice(i + 1, 0, nuevo); else s.ejercicios[i] = nuevo;
    });
    cerrarHoja();
  },
  'sesion.guardarMia': () => {
    const s = sesion(idActual()); if (!s) return;
    abrirHoja(`<h2>Guardar como mía</h2>
      <p class="tenue">Guardo sus ejercicios con sus series, repeticiones y descansos, y el lugar. Los kilos no: se calculan cada vez con tu progreso.</p>
      <p class="tenue">Para repetirla, elígela en «Antes de empezar». Se ajusta al dolor, lugar y material de ese día, y siempre lleva calentamiento, cardio y estiramientos.</p>
      <label class="campo col"><span>Nombre</span><input id="mia-nombre" maxlength="${+LARGO_NOMBRE_MIA}" value="${h(String(s.nombre || '').slice(0, LARGO_NOMBRE_MIA))}" placeholder="Ej.: Abdominales y flexiones"></label>
      <button class="btn grande" data-act="sesion.guardarMiaOk">Guardar</button>`);
  },
  'sesion.guardarMiaOk': () => {
    const nombre = ($('#mia-nombre') || {}).value || '';
    const r = guardarMia(idActual(), nombre);
    if (r.error) { aviso(r.error, 'error'); return; }
    cerrarHoja(); aviso(`Guardada en tus sesiones: «${r.mia.nombre}»`);
  },
  'sesion.terminar': () => hojaCierre(),
  'sesion.seguir': () => cerrarHoja(),
  'sesion.cerrar': () => {
    const s0 = sesion(idActual());
    if (s0 && !trabajoHecho(s0)) { cerrarHoja(); aviso('Sin nada marcado no se guarda: no cuenta como entrenada.', 'info'); return; }
    const esf = +($('#c-esf .on') || { dataset: { v: 3 } }).dataset.v;
    const dolor = {}; document.querySelectorAll('.hoja [data-zona]').forEach(r => { dolor[r.dataset.zona] = +r.value; });
    const comentario = $('#c-com').value.trim();
    conSesion((s, S) => {
      empezarSiHaceFalta(S, s);
      s.estado = 'hecha'; s.terminada = new Date().toISOString(); s.cierre = { esfuerzo: esf, dolor, comentario };
      Object.entries(dolor).forEach(([zona, v]) => S.dolor.push({ fecha: hoyISO(), zona, dolor: v, momento: 'despues', sesion: s.id }));
      Object.entries((s.checkin && s.checkin.dolor) || {}).forEach(([zona, v]) => S.dolor.push({ fecha: hoyISO(), zona, dolor: v, momento: 'antes', sesion: s.id }));
    });
    parar(); cerrarHoja(); aviso('¡Sesión guardada!'); ir('hoy');
  },
  'sesion.descartar': async () => {
    if (!await confirmar('¿Descartar esta sesión? Se borra lo apuntado en ella.', { si: 'Descartar', peligro: true })) return;
    const id = idActual();
    cambiar(S => { delete S.sesiones[id]; }, 'sesion');
    parar(); ir('hoy');
  },
});

// Fin de un ejercicio por tiempo: se apunta lo que se aguantó de verdad (con dos lados, el lado más flojo,
// que es el que manda para progresar) y se marca la serie, que lanza el descanso.
registrarFin((meta, tiempos) => {
  const s = estado().sesiones[meta.sesion]; if (!s) return;
  const x = s.ejercicios[meta.e]; if (!x || !x.sets[meta.s]) return;
  const o = objetivoSeg(x) || { u: 's' }, seg = Math.min(...tiempos);
  if (x.sets[meta.s].hecha) {
    cambiar(S => { S.sesiones[meta.sesion].ejercicios[meta.e].sets[meta.s].valor = textoSeg(seg, o.u); }, 'sesion');
  } else marcarSerie(meta.e, meta.s, textoSeg(seg, o.u), meta.sesion);
});

// Mientras la sesión está abierta, la pantalla no se apaga sola (si el móvil lo permite).
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#sesion/')) soltarPantalla(); });

// Prueba de pintado de una copia (router.probarPantallas): cada sesión, sin tocar lo que se está viendo.
function probar() {
  const antes = foco;
  try { for (const id of Object.keys(estado().sesiones)) vista([id]); vista(['']); } finally { foco = antes; }
}
rutas({ sesion: { titulo: 'Sesión', vista, probar, sinNav: true, pestaña: 'hoy', montar: (_, [id]) => { const s = sesion(id); if (s && s.estado !== 'hecha') mantenerPantalla(); } } });
