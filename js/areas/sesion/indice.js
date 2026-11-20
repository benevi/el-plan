// Área SESIÓN: hacer la sesión en el gimnasio. Funciona sin conexión (todo está guardado en el móvil).
// Dos modos: lista completa o un ejercicio cada vez. Apuntar series, descansos con alarma, ejercicios por
// tiempo, cambiar un ejercicio, opinar de él, comentar al entrenador y cerrar con esfuerzo y dolor.

import { rutas, acciones, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num } from '../../nucleo/ui.js';
import { crearEjercicio } from '../../nucleo/modelo.js';
import { ex, alternativas, ZONAS } from '../../reglas/catalogo.js';
import { rango, registros } from '../../reglas/progresion.js';
import { LUGARES, MUSCULOS, GUSTOS } from '../../datos/constantes.js';
import { abrirFicha, botonesGusto, miniatura } from '../ejercicios/indice.js';
import { notaFallo } from '../entrenador/indice.js';
import { guardarMia, miaDe, LARGO_NOMBRE_MIA } from '../entrenador/entrenador.js';
import { descanso, cuenta, parar, registrarFin, mantenerPantalla, soltarPantalla } from './temporizador.js';

const ROL = { rehab: 'Rehabilitación', cardio: 'Cardio', principal: '' };
let foco = { id: null, i: 0 };

const sesion = id => estado().sesiones[id];
// Segundos del rango («30-45s» → 30 y 45; «2 min» → 120). Cero si no es por tiempo.
const objetivoSeg = x => { const r = rango(x.reps); if (!r || (r.u !== 's' && r.u !== 'min')) return null; const k = r.u === 'min' ? 60 : 1; return { lo: Math.round(r.lo * k), hi: Math.round(r.hi * k), lados: /c\/\s*lado|por lado|cada lado/i.test(r.resto) ? 2 : 1, u: r.u }; };
const segundosObjetivo = x => { const o = objetivoSeg(x); return o ? o.hi : 0; };
const textoSeg = (seg, u) => u === 'min' ? (seg % 60 ? Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0') : String(seg / 60)) : String(seg);
const unidad = x => { const e = ex(x.id); const r = rango(x.reps); return e && e.t === 'distancia' ? 'm' : r && (r.u === 's' || r.u === 'min') ? 'seg' : 'reps'; };
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
  const r = rango(x.reps);
  const ph = r ? (r.lo === r.hi ? String(r.lo) : `${r.lo}-${r.hi}`) : '';
  return `<li class="serie ${z.hecha ? 'hecha' : ''}">
    <span class="n">${j + 1}</span>
    ${conKg(x) ? `<label class="dato"><input inputmode="decimal" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="kg" value="${z.kg != null ? h(z.kg) : ''}" placeholder="${x.kg != null ? h(x.kg) : '—'}"><small>kg</small></label>` : ''}
    <label class="dato"><input inputmode="${u === 'seg' ? 'text' : 'numeric'}" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="valor" value="${h(z.valor)}" placeholder="${h(ph)}"><small>${u}</small></label>
    ${seg && !z.hecha ? `<button class="icono play" data-act="sesion.cuenta" data-e="${i}" data-s="${j}" aria-label="Empezar ${seg} segundos">${ICONOS.play}</button>` : ''}
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
    ${e.v ? `<a class="video-ficha" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener" aria-label="Ver vídeo de ${h(e.n)}"><img src="${miniatura(e)}" alt="" loading="lazy" onerror="this.remove()"><span>${ICONOS.play} Ver vídeo</span></a>` : ''}
    <ol class="pasos">${e.p.map(t => `<li>${h(t)}</li>`).join('')}</ol>
    ${e.e && e.e.length ? `<p class="evita">Evita</p><ul class="errores">${e.e.map(t => `<li>${h(t)}</li>`).join('')}</ul>` : ''}
    ${e.c ? `<p class="consejo">${h(e.c)}</p>` : ''}
  </details>`;
}

function tarjetaEjercicio(s, x, i, grande = false) {
  const e = ex(x.id) || { n: x.nombre || x.id, m: [] };
  const hechas = x.sets.filter(z => z.hecha).length;
  return `<article class="tarjeta ejercicio ${hechas === x.sets.length ? 'completo' : ''} ${grande ? 'grande' : ''}" id="ej-${i}">
    <header>
      <span class="num">${hechas === x.sets.length ? ICONOS.check : i + 1}</span>
      <div class="grow"><h3>${h(e.n)}</h3>
        <p class="tenue">${ROL[x.rol] && Object.prototype.hasOwnProperty.call(ROL, x.rol) ? `<span class="insignia ${h(x.rol)}">${h(ROL[x.rol])}</span> ` : ''}${+x.series} × ${h(x.reps)}${x.kg != null ? ` · ${h(x.kg)} kg` : ''}${x.descanso ? ` · ${+x.descanso} s descanso` : ''}</p></div>
      <button class="icono" data-act="sesion.menu" data-e="${i}" aria-label="Más opciones">${ICONOS.lista}</button>
    </header>
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
const pasoHecho = (s, p) => p.k === 'ej' ? s.ejercicios[p.i].sets.every(z => z.hecha) : s[p.k].every(t => t.hecho);
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
      <button data-act="sesion.modo" data-v="lista" class="${modoFoco ? '' : 'on'}" aria-pressed="${!modoFoco}">Toda la sesión</button></div>` : ''}`;
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
    ${s.ejercicios.map((x, i) => abierta && x.sets.every(z => z.hecha) ? tarjetaPlegada(x, i) : tarjetaEjercicio(s, x, i)).join('')}
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
  // Solo zonas del catálogo: su clave va dentro de un id y de un manejador oninput.
  const zonas = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...estado().perfil.lesiones.filter(l => l.activa).map(l => l.zona)])].filter(z => Object.prototype.hasOwnProperty.call(ZONAS, z));
  abrirHoja(`<h2>¿Qué tal ha ido?</h2>
    <div class="campo col"><span>Esfuerzo</span><div class="segmentos" id="c-esf">${[['1', 'Muy fácil'], ['2', 'Fácil'], ['3', 'Justo'], ['4', 'Duro'], ['5', 'Al límite']].map(([v, t]) => `<button data-v="${v}" class="${v === '3' ? 'on' : ''}">${v}<small>${t}</small></button>`).join('')}</div></div>
    ${zonas.map(z => `<label class="campo col"><span>Dolor ahora · ${h(ZONAS[z].corta)}: <b id="c-${h(z)}-v">${+(s.checkin && s.checkin.dolor[z]) || 0}</b>/10</span><input type="range" min="0" max="10" value="${+(s.checkin && s.checkin.dolor[z]) || 0}" data-zona="${h(z)}" oninput="document.getElementById('c-${h(z)}-v').textContent=this.value"></label>`).join('')}
    <label class="campo col"><span>Para tu entrenador <small>molestias, qué cambiarías…</small></span><textarea id="c-com" rows="3"></textarea></label>
    <button class="btn grande" data-act="sesion.cerrar">Guardar sesión</button>`);
  $('#c-esf').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#c-esf').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

function menuEjercicio(i) {
  const s = sesion(idActual()), x = s.ejercicios[i], e = ex(x.id);
  abrirHoja(`<h2>${h(e ? e.n : x.id)}</h2>
    <div class="menu">
      <button data-act="sesion.ficha" data-id="${h(x.id)}">${ICONOS.info} Cómo se hace</button>
      ${s.estado !== 'hecha' ? `<button data-act="sesion.cambiar" data-e="${i}">${ICONOS.editar} Cambiar por otro</button>
      <button data-act="sesion.serieMas" data-e="${i}" data-v="1">${ICONOS.mas} Añadir una serie</button>
      ${x.sets.length > 1 ? `<button data-act="sesion.serieMas" data-e="${i}" data-v="-1">${ICONOS.menos} Quitar una serie</button>` : ''}` : ''}
    </div>
    <h3>¿Qué te parece?</h3>${botonesGusto(x.id, 'sesion.gusto')}
    <label class="campo col"><span>Comentario para tu entrenador</span><textarea id="m-com" rows="2" placeholder="Me molesta la muñeca, la máquina estaba ocupada…">${h(x.comentario)}</textarea></label>
    <button class="btn" data-act="sesion.comentar" data-e="${i}">Guardar comentario</button>`);
  $('#m-com').dataset.noFoco = '1';
}

function marcarSerie(i, j, valorPorDefecto, idSesion = idActual()) {
  let descansar = 0, etiqueta = '';
  cambiar(S => { const s = S.sesiones[idSesion]; if (!s) return;
    empezarSiHaceFalta(S, s);
    const x = s.ejercicios[i], z = x.sets[j];
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
      ${alts.length ? `<ul class="lista">${alts.map(a => `<li><button class="fila" data-act="sesion.cambiarPor" data-e="${i}" data-id="${h(a.id)}"><span class="grow"><b>${h(a.n)}</b><span class="tenue">${a.m.map(m => MUSCULOS[m]).join(', ')}${S.perfil.gustos[a.id] ? ' · ' + GUSTOS[S.perfil.gustos[a.id]].icono : ''}</span></span>${ICONOS.sig}</button></li>`).join('')}</ul>` : '<p class="tenue">No hay alternativas seguras aquí.</p>'}`);
  },
  'sesion.cambiarPor': el => {
    conSesion(s => {
      const i = +el.dataset.e, viejo = s.ejercicios[i], n = ex(el.dataset.id);
      const nuevo = crearEjercicio({ id: n.id, rol: viejo.rol, series: viejo.series, reps: n.t === ex(viejo.id).t ? viejo.reps : n.d[1], descanso: viejo.descanso, nota: `En lugar de ${ex(viejo.id).n.toLowerCase()}.` });
      s.ejercicios[i] = nuevo;
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
