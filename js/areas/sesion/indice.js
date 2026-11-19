// Área SESIÓN: hacer la sesión en el gimnasio. Funciona sin conexión (todo está guardado en el móvil).
// Dos modos: lista completa o un ejercicio cada vez. Apuntar series, descansos con alarma, ejercicios por
// tiempo, cambiar un ejercicio, opinar de él, comentar al entrenador y cerrar con esfuerzo y dolor.

import { rutas, acciones, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num } from '../../nucleo/ui.js';
import { crearEjercicio } from '../../nucleo/modelo.js';
import { ex, alternativas, ZONAS } from '../../reglas/catalogo.js';
import { rango } from '../../reglas/progresion.js';
import { LUGARES, MUSCULOS, GUSTOS } from '../../datos/constantes.js';
import { abrirFicha, botonesGusto } from '../ejercicios/indice.js';
import { descanso, cuenta, parar } from './temporizador.js';

const ROL = { rehab: 'Rehabilitación', cardio: 'Cardio', principal: '' };
let foco = { id: null, i: 0 };

const sesion = id => estado().sesiones[id];
const segundosObjetivo = x => { const r = rango(x.reps); if (!r) return 0; return r.u === 'min' ? r.hi * 60 : r.u === 's' ? r.hi : 0; };
const unidad = x => { const e = ex(x.id); const r = rango(x.reps); return e && e.t === 'distancia' ? 'm' : r && (r.u === 's' || r.u === 'min') ? 'seg' : 'reps'; };
const conKg = x => { const e = ex(x.id); return e && e.t === 'reps' && !(e.mat.length === 1 && e.mat[0] === 'peso corporal'); };

function empezarSiHaceFalta(S, s) {
  if (s.estado === 'pendiente') { s.estado = 'en_curso'; s.empezada = new Date().toISOString(); }
}

function tareas(s, clave, titulo) {
  const lista = s[clave]; if (!lista.length) return '';
  const hechas = lista.filter(t => t.hecho).length;
  return `<details class="tarjeta bloque" ${hechas < lista.length && s.estado !== 'hecha' ? 'open' : ''}>
    <summary><h2>${titulo}</h2><span class="tenue">${hechas}/${lista.length}</span></summary>
    <ul class="tareas">${lista.map((t, i) => `<li class="${t.hecho ? 'hecho' : ''}">
      <button class="marca" data-act="sesion.tarea" data-k="${clave}" data-i="${i}" aria-pressed="${t.hecho}" aria-label="Hecho">${t.hecho ? ICONOS.check : ''}</button>
      <div class="grow"><b>${h(t.nombre)}</b>${t.duracion ? ` <span class="tenue">· ${h(t.duracion)}</span>` : ''}${t.detalle ? `<p class="tenue">${h(t.detalle)}</p>` : ''}</div>
      ${t.id ? `<button class="icono" data-act="sesion.ficha" data-id="${t.id}" aria-label="Cómo se hace">${ICONOS.info}</button>` : ''}</li>`).join('')}</ul></details>`;
}

function filaSerie(x, i, j) {
  const z = x.sets[j], u = unidad(x), seg = segundosObjetivo(x);
  const r = rango(x.reps);
  const ph = r ? (r.lo === r.hi ? String(r.lo) : `${r.lo}-${r.hi}`) : '';
  return `<li class="serie ${z.hecha ? 'hecha' : ''}">
    <span class="n">${j + 1}</span>
    ${conKg(x) ? `<label class="dato"><input inputmode="decimal" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="kg" value="${z.kg != null ? h(z.kg) : ''}" placeholder="${x.kg != null ? h(x.kg) : '—'}"><small>kg</small></label>` : ''}
    <label class="dato"><input inputmode="${u === 'seg' ? 'text' : 'numeric'}" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="valor" value="${h(z.valor)}" placeholder="${h(ph)}"><small>${u}</small></label>
    ${seg && !z.hecha ? `<button class="icono play" data-act="sesion.cuenta" data-e="${i}" data-s="${j}" aria-label="Empezar ${seg} segundos">${ICONOS.play}</button>` : ''}
    <button class="marca" data-act="sesion.serie" data-e="${i}" data-s="${j}" aria-pressed="${z.hecha}" aria-label="Serie hecha">${z.hecha ? ICONOS.check : ''}</button></li>`;
}

function tarjetaEjercicio(s, x, i, grande = false) {
  const e = ex(x.id) || { n: x.nombre || x.id, m: [] };
  const hechas = x.sets.filter(z => z.hecha).length;
  return `<article class="tarjeta ejercicio ${hechas === x.sets.length ? 'completo' : ''} ${grande ? 'grande' : ''}" id="ej-${i}">
    <header>
      <span class="num">${hechas === x.sets.length ? ICONOS.check : i + 1}</span>
      <div class="grow"><h3>${h(e.n)}</h3>
        <p class="tenue">${ROL[x.rol] ? `<span class="insignia ${x.rol}">${ROL[x.rol]}</span> ` : ''}${x.series} × ${h(x.reps)}${x.kg != null ? ` · ${h(x.kg)} kg` : ''}${x.descanso ? ` · ${x.descanso} s descanso` : ''}</p></div>
      <button class="icono" data-act="sesion.menu" data-e="${i}" aria-label="Más opciones">${ICONOS.lista}</button>
    </header>
    ${x.nota ? `<p class="nota">${h(x.nota)}</p>` : ''}
    ${x.motivo ? `<p class="motivo">${h(x.motivo)}</p>` : ''}
    <ul class="series">${x.sets.map((_, j) => filaSerie(x, i, j)).join('')}</ul>
    ${x.comentario ? `<p class="comentario">«${h(x.comentario)}»</p>` : ''}
  </article>`;
}

function vista([id]) {
  const S = estado(), s = sesion(id);
  if (!s) return `<div class="tarjeta"><p>No encuentro esa sesión.</p><a class="btn" href="#hoy">Volver a Hoy</a></div>`;
  const total = s.ejercicios.reduce((a, x) => a + x.sets.length, 0), hechas = s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
  const modoFoco = S.ajustes.modoSesion === 'foco' && s.estado !== 'hecha';
  if (foco.id !== id) foco = { id, i: Math.max(0, s.ejercicios.findIndex(x => x.sets.some(z => !z.hecha))) };
  const cab = `<header class="cab-sesion">
      <a href="#hoy" class="icono" aria-label="Volver">${ICONOS.atras}</a>
      <div class="grow"><h1>${h(s.nombre)}</h1><p class="tenue">${h(LUGARES[s.lugar] || '')} · ${hechas}/${total} series</p></div>
      ${s.estado !== 'hecha' ? `<button class="icono" data-act="sesion.modo" aria-label="${modoFoco ? 'Ver lista' : 'Un ejercicio cada vez'}">${modoFoco ? ICONOS.lista : ICONOS.foco}</button>` : ''}
    </header>
    <div class="barra"><i style="width:${total ? Math.round(hechas / total * 100) : 0}%"></i></div>`;
  const porque = s.explicacion.length ? `<details class="tarjeta plegable porque"><summary>${ICONOS.ia} Por qué esta sesión</summary><ul>${s.explicacion.map(t => `<li>${h(t)}</li>`).join('')}</ul></details>` : '';

  if (modoFoco) {
    const i = Math.min(foco.i, s.ejercicios.length - 1);
    return `${cab}
      ${i === 0 ? tareas(s, 'calentamiento', 'Calentamiento') : ''}
      <p class="tenue centro">Ejercicio ${i + 1} de ${s.ejercicios.length}</p>
      ${s.ejercicios[i] ? tarjetaEjercicio(s, s.ejercicios[i], i, true) : ''}
      <div class="fila-botones"><button class="btn sec" data-act="sesion.foco" data-v="-1" ${i === 0 ? 'disabled' : ''}>${ICONOS.atras} Anterior</button>
      ${i < s.ejercicios.length - 1 ? `<button class="btn" data-act="sesion.foco" data-v="1">Siguiente ${ICONOS.sig}</button>` : `<button class="btn" data-act="sesion.terminar">Terminar</button>`}</div>
      ${i === s.ejercicios.length - 1 ? tareas(s, 'vuelta', 'Vuelta a la calma') : ''}`;
  }

  return `${cab}${porque}
    ${tareas(s, 'calentamiento', 'Calentamiento')}
    ${s.ejercicios.map((x, i) => tarjetaEjercicio(s, x, i)).join('')}
    ${tareas(s, 'vuelta', 'Vuelta a la calma')}
    ${s.estado === 'hecha'
      ? `<section class="tarjeta"><h2>Cierre</h2><p>Esfuerzo ${s.cierre && s.cierre.esfuerzo ? s.cierre.esfuerzo + '/5' : '—'}</p>${s.cierre && s.cierre.comentario ? `<p class="comentario">«${h(s.cierre.comentario)}»</p>` : ''}</section>`
      : `<button class="btn grande" data-act="sesion.terminar">${ICONOS.check} Terminar sesión</button>
         <button class="enlace peligro centro" data-act="sesion.descartar">Descartar esta sesión</button>`}`;
}

// ── Acciones ──
const idActual = () => location.hash.split('/')[1];
function conSesion(fn, motivo = 'sesion') {
  const id = idActual();
  cambiar(S => { const s = S.sesiones[id]; if (s) fn(s, S); }, motivo);
}

function hojaCierre() {
  const s = sesion(idActual());
  const zonas = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...estado().perfil.lesiones.filter(l => l.activa).map(l => l.zona)])];
  abrirHoja(`<h2>¿Qué tal ha ido?</h2>
    <div class="campo col"><span>Esfuerzo</span><div class="segmentos" id="c-esf">${[['1', 'Muy fácil'], ['2', 'Fácil'], ['3', 'Justo'], ['4', 'Duro'], ['5', 'Al límite']].map(([v, t]) => `<button data-v="${v}" class="${v === '3' ? 'on' : ''}">${v}<small>${t}</small></button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor ahora · ${h(ZONAS[z].corta)}: <b id="c-${z}-v">${(s.checkin && s.checkin.dolor[z]) || 0}</b>/10</span><input type="range" min="0" max="10" value="${(s.checkin && s.checkin.dolor[z]) || 0}" data-zona="${z}" oninput="document.getElementById('c-${z}-v').textContent=this.value"></label>`).join('')}
    <label class="campo col"><span>Para tu entrenador <small>molestias, qué cambiarías…</small></span><textarea id="c-com" rows="3"></textarea></label>
    <button class="btn grande" data-act="sesion.cerrar">Guardar sesión</button>`);
  $('#c-esf').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#c-esf').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

function menuEjercicio(i) {
  const s = sesion(idActual()), x = s.ejercicios[i], e = ex(x.id);
  abrirHoja(`<h2>${h(e ? e.n : x.id)}</h2>
    <div class="menu">
      <button data-act="sesion.ficha" data-id="${x.id}">${ICONOS.info} Cómo se hace</button>
      ${s.estado !== 'hecha' ? `<button data-act="sesion.cambiar" data-e="${i}">${ICONOS.editar} Cambiar por otro</button>
      <button data-act="sesion.serieMas" data-e="${i}" data-v="1">${ICONOS.mas} Añadir una serie</button>
      ${x.sets.length > 1 ? `<button data-act="sesion.serieMas" data-e="${i}" data-v="-1">${ICONOS.menos} Quitar una serie</button>` : ''}` : ''}
    </div>
    <h3>¿Qué te parece?</h3>${botonesGusto(x.id, 'sesion.gusto')}
    <label class="campo col"><span>Comentario para tu entrenador</span><textarea id="m-com" rows="2" placeholder="Me molesta la muñeca, la máquina estaba ocupada…">${h(x.comentario)}</textarea></label>
    <button class="btn" data-act="sesion.comentar" data-e="${i}">Guardar comentario</button>`);
  $('#m-com').dataset.noFoco = '1';
}

function marcarSerie(i, j, valorPorDefecto) {
  let descansar = 0, etiqueta = '';
  conSesion((s, S) => {
    empezarSiHaceFalta(S, s);
    const x = s.ejercicios[i], z = x.sets[j];
    z.hecha = !z.hecha;
    if (z.hecha) {
      if (!String(z.valor).trim()) { const r = rango(x.reps); z.valor = valorPorDefecto != null ? String(valorPorDefecto) : r ? String(r.lo) : ''; }
      if (z.kg == null && x.kg != null && conKg(x)) z.kg = x.kg;
      const ultima = j === x.sets.length - 1 && i === s.ejercicios.length - 1;
      if (!ultima && x.descanso) { descansar = x.descanso; etiqueta = j === x.sets.length - 1 ? 'Descanso · siguiente: ' + (ex(s.ejercicios[i + 1].id) || {}).n : `Descanso · serie ${j + 2} de ${x.sets.length}`; }
      if (j === x.sets.length - 1 && S.ajustes.modoSesion === 'foco' && i < s.ejercicios.length - 1) foco.i = i + 1;
    }
  });
  if (descansar) descanso(descansar, etiqueta); else parar();
}

acciones({
  'sesion.modo': () => cambiar(S => { S.ajustes.modoSesion = S.ajustes.modoSesion === 'foco' ? 'lista' : 'foco'; }, 'ajustes'),
  'sesion.foco': el => { foco.i = Math.max(0, foco.i + +el.dataset.v); pintar(); window.scrollTo(0, 0); },
  'sesion.tarea': el => conSesion((s, S) => { empezarSiHaceFalta(S, s); const t = s[el.dataset.k][+el.dataset.i]; t.hecho = !t.hecho; }),
  'sesion.ficha': el => abrirFicha(el.dataset.id),
  'sesion.dato': el => conSesion(s => {
    const z = s.ejercicios[+el.dataset.e].sets[+el.dataset.s];
    if (el.dataset.k === 'kg') z.kg = num(el.value); else z.valor = el.value.trim();
  }, 'sesion-silencio'),
  'sesion.serie': el => marcarSerie(+el.dataset.e, +el.dataset.s),
  'sesion.cuenta': el => {
    const i = +el.dataset.e, j = +el.dataset.s, s = sesion(idActual()), x = s.ejercicios[i];
    const seg = segundosObjetivo(x), inicio = Date.now();
    cuenta(seg, `${(ex(x.id) || {}).n} · serie ${j + 1}`, natural => {
      const hecho = natural ? seg : Math.round((Date.now() - inicio) / 1000);
      if (!s.ejercicios[i].sets[j].hecha) marcarSerie(i, j, hecho);
    });
  },
  'sesion.menu': el => menuEjercicio(+el.dataset.e),
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
    const alts = alternativas(e, s.lugar, S.perfil, { excluir: s.ejercicios.map(y => y.id), dolorHoy: (s.checkin && s.checkin.dolor) || {} }).slice(0, 8);
    abrirHoja(`<h2>Cambiar ${h(e.n.toLowerCase())}</h2>
      ${alts.length ? `<ul class="lista">${alts.map(a => `<li><button class="fila" data-act="sesion.cambiarPor" data-e="${i}" data-id="${a.id}"><span class="grow"><b>${h(a.n)}</b><span class="tenue">${a.m.map(m => MUSCULOS[m]).join(', ')}${S.perfil.gustos[a.id] ? ' · ' + GUSTOS[S.perfil.gustos[a.id]].icono : ''}</span></span>${ICONOS.sig}</button></li>`).join('')}</ul>` : '<p class="tenue">No hay alternativas seguras aquí.</p>'}`);
  },
  'sesion.cambiarPor': el => {
    conSesion(s => {
      const i = +el.dataset.e, viejo = s.ejercicios[i], n = ex(el.dataset.id);
      const nuevo = crearEjercicio({ id: n.id, rol: viejo.rol, series: viejo.series, reps: n.t === ex(viejo.id).t ? viejo.reps : n.d[1], descanso: viejo.descanso, nota: `En lugar de ${ex(viejo.id).n.toLowerCase()}.` });
      s.ejercicios[i] = nuevo;
    });
    cerrarHoja();
  },
  'sesion.terminar': () => hojaCierre(),
  'sesion.cerrar': () => {
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

rutas({ sesion: { titulo: 'Sesión', vista, sinNav: true, pestaña: 'hoy' } });
