// Área SESIÓN: hacer la sesión en el gimnasio. Funciona sin conexión (todo está guardado en el móvil).
// Dos modos: un ejercicio cada vez («Uno a uno») o la sesión entera. Apuntar series con el selector ±, descansos
// en la barra de abajo, ejercicios por tiempo y cardio con el contador a pantalla completa, cambiar un ejercicio,
// opinar de él, comentar al entrenador, «Algo va mal» y cerrar con esfuerzo y dolor. Diseño aprobado en DIS 4
// (prototipos/app, rama diseno-prototipos) con las decisiones del 21-11-2026. PR 15.

import { rutas, acciones, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, $$, num, es, mmss, movimientoReducido, plural } from '../../nucleo/ui.js';
import { crearEjercicio, trabajoHecho } from '../../nucleo/modelo.js';
import { ex, ZONAS } from '../../reglas/catalogo.js';
import { rango, registros, paso as pasoKg, valor as valorApuntado, e1rm } from '../../reglas/progresion.js';
import { LUGARES, MUSCULOS, GUSTOS, LARGO_TEXTO } from '../../datos/constantes.js';
import { abrirFicha, botonesGusto, miniatura } from '../ejercicios/indice.js';
import { notaFallo } from '../entrenador/indice.js';
import { guardarMia, miaDe, LARGO_NOMBRE_MIA, pararPorAlarma, limiteDolor, T3, T3b, estadoDias, alternativasHoy, ejercicioCambiado, contextoDia } from '../entrenador/entrenador.js';
import { descanso, cuenta, parar, registrarFin, mantenerPantalla, soltarPantalla, info, cerrarAlarma, alarmaDe } from './temporizador.js';

// «Cambiar por otro»: el dolor de hoy con el «dolor durante» del ejercicio (C-DOLOR-6) y las alternativas que
// acepta el validador para su rol, sin crear problemas nuevos en la sesión (G1 de la revisión del PR #45).
const dolorDeCambio = (s, x) => {
  const dd = x && x.dolorDurante, ck = (s.checkin && s.checkin.dolor) || {};
  return { ...ck, ...(dd ? { [dd.zona]: Math.max(+dd.dolor, +(ck[dd.zona] || 0)) } : {}) };
};
function alternativasDe(S, s, i) {
  const x = s.ejercicios[i], e = ex(x.id); if (!e) return [];
  const esMia = !!(s.origen && s.origen.tipo === 'mia');
  return alternativasHoy(S, e, { lugar: s.lugar, rol: x.rol, excluir: s.ejercicios.map(y => y.id), dolorHoy: dolorDeCambio(s, x), energia: (s.checkin || {}).energia,
    nivel: x.rol === 'principal' && !esMia ? Math.max(1, Math.min(3, +S.perfil.nivel || 1)) : null, sesion: s, indice: i });
}

const ROL = { rehab: 'Rehabilitación', cardio: 'Cardio' };
const minus = t => String(t || '').toLowerCase();
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
let foco = { id: null, i: 0 };
let recien = ''; // la serie que se acaba de marcar (su ✓ entra con un pequeño gesto)

const sesion = id => estado().sesiones[id];
// Segundos del rango («30-45s» → 30 y 45; «2 min» → 120). Nada si no es por tiempo.
const objetivoSeg = x => { const r = rango(x.reps); if (!r || (r.u !== 's' && r.u !== 'min')) return null; const k = r.u === 'min' ? 60 : 1; return { lo: Math.round(r.lo * k), hi: Math.round(r.hi * k), lados: /c\/\s*lado|por lado|cada lado/i.test(r.resto) ? 2 : 1, u: r.u }; };
const textoSeg = (seg, u) => u === 'min' ? (seg % 60 ? Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0') : String(seg / 60)) : String(seg);
// El cardio por minutos se apunta y se enseña en minutos («8 min», «8:01 min»), no como segundos (E5).
const unidad = x => { const e = ex(x.id); const r = rango(x.reps); return e && e.t === 'distancia' ? 'm' : r && r.u === 'min' ? 'min' : r && r.u === 's' ? 's' : 'reps'; };
const textoObjetivo = (seg, u) => u === 'min' ? `${textoSeg(seg, 'min')} minutos` : `${seg} segundos`;
// Objetivo de un ejercicio por tiempo, corto: «8 min», «40-60 s».
const objetivoCorto = o => o.u === 'min' ? (o.lo === o.hi ? `${textoSeg(o.hi, 'min')} min` : `${textoSeg(o.lo, 'min')}-${textoSeg(o.hi, 'min')} min`) : o.lo === o.hi ? `${o.hi} s` : `${o.lo}-${o.hi} s`;
// Solo se apunta peso si el ejercicio usa algo que se carga (banda, peso corporal o banco no llevan kg).
const CON_PESO = ['mancuernas', 'barra', 'maquina', 'polea', 'botellas'];
const conKg = x => { const e = ex(x.id); return !!e && e.t === 'reps' && e.mat.some(m => CON_PESO.includes(m)); };
const kgDe = (x, z) => (z.kg != null ? +z.kg : x.kg != null ? +x.kg : 0);
// Lo apuntado en una serie, como se lee: «22,5 kg × 10», «45 s», «8 min», «12 reps».
function textoSerie(x, z) {
  const u = unidad(x), v = String(z.valor || '').trim();
  const kg = conKg(x) && z.kg != null && +z.kg > 0 ? `${es(+z.kg, 2)} kg × ` : '';
  if (!v) return kg ? kg.replace(/ × $/, '') : '—';
  return kg + v + (u === 'reps' ? (kg ? '' : ' reps') : ' ' + u);
}

function empezarSiHaceFalta(S, s) {
  if (s.estado === 'pendiente') { s.estado = 'en_curso'; s.empezada = new Date().toISOString(); }
}

// ── Selector ± del sistema (R04): el valor es un spinbutton, sin teclado del móvil ──
// Lleva un <input type="hidden"> con el valor: lo leen los formularios (cierre, «Algo va mal») y, si tiene
// data-cambio, al cambiar se lanza esa acción (la serie actual guarda sus kilos y repeticiones al momento).
function selector({ id, et, valor, min, max, paso, unidad: u, nombre, entrada = '', ej = '' }) {
  const v = es(valor, 2);
  return `<div class="selector" data-sel data-min="${+min}" data-max="${+max}" data-paso="${+paso}"${ej ? ` data-ej="${h(ej)}"` : ''}>
    <span class="selector-et" id="${h(id)}-et">${h(et)}</span>
    <div class="selector-valor" role="spinbutton" tabindex="0" aria-labelledby="${h(id)}-et" aria-valuemin="${+min}" aria-valuemax="${+max}" aria-valuenow="${+valor}" aria-valuetext="${h(v)} ${h(nombre)}"><b>${h(v)}</b><span>${h(u)}</span></div>
    <div class="selector-pasos"><button type="button" data-paso="-1" aria-label="Menos ${h(es(paso, 2))} ${h(nombre)}" aria-disabled="${valor <= min}">${ICONOS.menos}</button><button type="button" data-paso="1" aria-label="Más ${h(es(paso, 2))} ${h(nombre)}" aria-disabled="${valor >= max}">${ICONOS.mas}</button></div>
    <input type="hidden" id="${h(id)}" value="${+valor}" ${entrada}>
  </div>`;
}
function cambiarSelector(sel, n) {
  const min = +sel.dataset.min, max = +sel.dataset.max;
  n = Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
  const v = $('[role="spinbutton"]', sel), campo = $('input[type="hidden"]', sel);
  const nombre = (v.getAttribute('aria-valuetext') || '').replace(/^\S+\s*/, '');
  v.setAttribute('aria-valuenow', String(n));
  v.setAttribute('aria-valuetext', `${es(n, 2)} ${nombre}`);
  $('b', v).textContent = es(n, 2);
  $('[data-paso="-1"]', sel).setAttribute('aria-disabled', String(n <= min));
  $('[data-paso="1"]', sel).setAttribute('aria-disabled', String(n >= max));
  // El paso de los kilos depende del peso (mancuernas: de 1 en 1 hasta 10 kg y luego de 2 en 2).
  const e = sel.dataset.ej && ex(sel.dataset.ej);
  if (e) {
    const p = pasoKg(e, n); sel.dataset.paso = String(p);
    $('[data-paso="-1"]', sel).setAttribute('aria-label', `Menos ${es(p, 2)} ${nombre}`);
    $('[data-paso="1"]', sel).setAttribute('aria-label', `Más ${es(p, 2)} ${nombre}`);
  }
  if (campo && String(campo.value) !== String(n)) {
    campo.value = String(n);
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.selector[data-sel] [data-paso]'); if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') return;
  const sel = b.closest('.selector');
  const ahora = +$('[role="spinbutton"]', sel).getAttribute('aria-valuenow');
  // Bajando, el paso es el del peso de abajo (de 10 a 9 con mancuernas, no a 8).
  const ej = sel.dataset.ej && ex(sel.dataset.ej);
  const p = ej && +b.dataset.paso < 0 ? pasoKg(ej, Math.max(0, ahora - 0.01)) : +sel.dataset.paso;
  cambiarSelector(sel, ahora + +b.dataset.paso * p);
});
document.addEventListener('keydown', e => {
  const v = e.target.closest && e.target.closest('.selector[data-sel] [role="spinbutton"]'); if (!v) return;
  const sel = v.closest('.selector'), ahora = +v.getAttribute('aria-valuenow'), p = +sel.dataset.paso;
  const n = { ArrowUp: ahora + p, ArrowRight: ahora + p, ArrowDown: ahora - p, ArrowLeft: ahora - p, PageUp: ahora + p * 4, PageDown: ahora - p * 4, Home: +sel.dataset.min, End: +sel.dataset.max }[e.key];
  if (n == null) return;
  e.preventDefault(); cambiarSelector(sel, n);
});

// ── Calentamiento y vuelta a la calma ──
function tareas(s, clave, titulo, abierta) {
  const lista = s[clave]; if (!lista.length) return '';
  const hechas = lista.filter(t => t.hecho).length;
  return `<section class="tarjeta tareas-bloque" aria-labelledby="t-${clave}">
    <div class="bloque-fila"><h2 class="tarjeta-nombre" id="t-${clave}">${titulo}</h2><p class="cifra">${hechas} de ${lista.length}</p></div>
    <ul class="tareas">${lista.map((t, i) => `<li class="${t.hecho ? 'hecho' : ''}">
      ${abierta
        ? `<button type="button" class="boton-icono tarea-marca" data-act="sesion.tarea" data-k="${clave}" data-i="${i}" aria-pressed="${!!t.hecho}" aria-label="${h(t.nombre)}: hecho">${t.hecho ? ICONOS.check : ''}</button>`
        : `<span class="tarea-estado${t.hecho ? ' hecho' : ''}" role="img" aria-label="${t.hecho ? 'Hecho' : 'Sin hacer'}">${t.hecho ? ICONOS.check : ''}</span>`}
      <div class="tarea-texto"><b>${h(t.nombre)}</b>${t.duracion ? `<span class="dur cifra">${h(t.duracion)}</span>` : ''}${t.detalle ? `<p>${h(t.detalle)}</p>` : ''}</div>
      ${t.id && ex(t.id) ? `<button type="button" class="boton-icono boton-icono--sin-borde" data-act="sesion.ficha" data-id="${h(t.id)}" aria-label="Cómo se hace: ${h(t.nombre)}">${ICONOS.info}</button>` : ''}</li>`).join('')}</ul>
  </section>`;
}

// ── Fila de serie (sistema: «Fila de serie») ──
// La actual es una tarjeta con los selectores y «Serie n hecha» (o «Empezar» si es por tiempo); las hechas se
// pueden desmarcar y las pendientes marcar de una vez (si las hiciste sin apuntar). En lectura, solo texto.
function filaSerie(s, x, i, j, actualJ) {
  const z = x.sets[j], u = unidad(x), abierta = s.estado !== 'hecha';
  const n = `<span class="serie-n cifra">${j + 1}</span>`;
  // Ejercicio parado por dolor (C-DOLOR-6): lo no hecho ya no se apunta ni se cronometra.
  if (x.dolorDurante && !z.hecha) return `<li class="serie serie--parada">${n}<span class="serie-valor">No se hace hoy</span><span></span></li>`;
  if (!abierta) return `<li class="serie serie--lectura">${n}<span class="serie-valor cifra">${z.hecha ? h(textoSerie(x, z)) : 'Sin hacer'}</span>${z.hecha ? `<span class="serie-estado">${ICONOS.check}Hecha</span>` : '<span></span>'}</li>`;
  if (j === actualJ) {
    const o = objetivoSeg(x), r = rango(x.reps), total = x.sets.length;
    const cab = `<p class="selector-et serie-cuenta">Serie <span class="cifra">${j + 1}</span> de ${total}${o && o.lados > 1 ? ', cada lado' : ''}</p>`;
    if (o) {
      const corto = objetivoCorto(o);
      const ph = r ? (r.lo === r.hi ? String(r.lo) : `${r.lo}-${r.hi}`) : '';
      return `<li class="serie serie--actual serie--tiempo" aria-current="step" data-actual>${cab}
        <p class="serie-tiempo"><b>${h(corto.replace(/ (min|s)$/, ''))}</b><span>${o.u === 'min' ? 'min' : 's'}, objetivo</span></p>
        <button type="button" class="boton boton--ancho" data-act="sesion.cuenta" data-e="${i}" data-s="${j}" data-principal aria-label="Empezar ${h(textoObjetivo(o.hi, o.u))}">${ICONOS.play}Empezar</button>
        <div class="serie-manual"><label class="dato"><span>Sin contador</span><input inputmode="text" data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="valor" value="${h(z.valor)}" placeholder="${h(ph)}" autocomplete="off"><small>${u}</small></label>
          <button type="button" class="boton boton--secundario" data-act="sesion.serie" data-e="${i}" data-s="${j}">Apuntar</button></div>
      </li>`;
    }
    const kg = conKg(x), e = ex(x.id);
    const kgVal = kgDe(x, z);
    const reps = u === 'm'
      ? { et: 'Metros', nombre: 'metros', u: 'm', min: 0, max: 5000, paso: 25 }
      : { et: 'Repeticiones', nombre: 'repeticiones', u: 'reps', min: 0, max: 100, paso: 1 };
    const repVal = num(z.valor) != null ? num(z.valor) : r ? r.lo : 10;
    return `<li class="serie serie--actual" aria-current="step" data-actual>${cab}
      <div class="selectores${kg ? '' : ' selectores--uno'}">
        ${kg ? selector({ id: `kg-${i}-${j}`, et: 'Kilos', valor: kgVal, min: 0, max: 400, paso: pasoKg(e, kgVal), unidad: 'kg', nombre: 'kilos', ej: x.id, entrada: `data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="kg"` }) : ''}
        ${selector({ id: `rep-${i}-${j}`, et: reps.et, valor: repVal, min: reps.min, max: reps.max, paso: reps.paso, unidad: reps.u, nombre: reps.nombre, entrada: `data-cambio="sesion.dato" data-e="${i}" data-s="${j}" data-k="valor"` })}
      </div>
      <button type="button" class="boton boton--ancho" data-act="sesion.serie" data-e="${i}" data-s="${j}" data-principal>Serie ${j + 1} hecha</button>
    </li>`;
  }
  if (z.hecha) {
    const t = textoSerie(x, z);
    return `<li class="serie serie--hecha${recien === `${s.id}/${i}/${j}` ? ' serie--recien' : ''}">${n}<span class="serie-valor cifra">${h(t)}</span>
      <button type="button" class="serie-estado" data-act="sesion.serie" data-e="${i}" data-s="${j}" aria-pressed="true" aria-label="Serie ${j + 1} hecha, ${h(t)}. Tocar para desmarcarla">${ICONOS.check}Hecha</button></li>`;
  }
  return `<li class="serie serie--pendiente">${n}<span class="serie-valor">Pendiente</span>
    <button type="button" class="serie-estado serie-marcar" data-act="sesion.serie" data-e="${i}" data-s="${j}" aria-pressed="false" aria-label="Marcar la serie ${j + 1} hecha"><span class="anillo" aria-hidden="true"></span></button></li>`;
}

// Lo que la persona abre o cierra se respeta al repintar.
const tecnicaAbierta = {};
document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.tecnica[data-id]')) tecnicaAbierta[d.dataset.id] = d.open; }, true);

// «Cómo se hace», dentro de la tarjeta y debajo de las series (R26): vídeo, pasos, errores a evitar y consejo.
// Abierto si la persona aún no lo ha hecho nunca; plegado (un toque) si ya lo conoce.
function tecnica(s, x) {
  const e = ex(x.id); if (!e || !(e.p && e.p.length)) return '';
  const nuevo = !registros(estado(), x.id).length;
  const abierto = x.id in tecnicaAbierta ? tecnicaAbierta[x.id] : nuevo && s.estado !== 'hecha';
  return `<details class="tecnica" data-id="${h(x.id)}" ${abierto ? 'open' : ''}>
    <summary>Cómo se hace${nuevo ? ' <span class="insignia">Nuevo para ti</span>' : ''}</summary>
    <div class="tecnica-texto">
      ${e.v ? `<a class="video-ficha" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener" aria-label="Ver vídeo de ${h(e.n)}"><img src="${miniatura(e)}" alt="" loading="lazy" data-quitar-si-falla><span>${ICONOS.play} Ver vídeo</span></a>` : ''}
      <ol class="pasos">${e.p.map(t => `<li>${h(t)}</li>`).join('')}</ol>
      ${e.e && e.e.length ? `<p class="evita">Evita</p><ul class="errores">${e.e.map(t => `<li>${h(t)}</li>`).join('')}</ul>` : ''}
      ${e.c ? `<p class="consejo">${h(e.c)}</p>` : ''}
      <button type="button" class="boton boton--texto" data-act="sesion.ficha" data-id="${h(x.id)}">Ver la ficha completa</button>
    </div>
  </details>`;
}

// «La última vez: 20 kg: 10, 10, 10 y 9» (de las sesiones ya hechas; solo lectura de lo guardado).
function ultimaVez(x) {
  const reg = registros(estado(), x.id).slice(-1)[0]; if (!reg) return '';
  const y = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0] || '';
  const kgs = [...new Set(reg.sets.map(z => z.kg))];
  const u = unidad(x), suf = u === 'reps' ? '' : ' ' + u;
  const txt = kgs.length === 1 && kgs[0] ? `${es(kgs[0], 2)} kg: ${y(reg.sets.map(z => z.txt || '?'))}`
    : kgs.length === 1 ? y(reg.sets.map(z => (z.txt || '?') + suf))
      : reg.sets.map(z => (z.kg ? `${es(z.kg, 2)} kg × ` : '') + (z.txt || '?')).join(', ');
  return `<p class="ultima">La última vez: <span class="cifra">${h(txt)}</span></p>`;
}

function tarjetaEjercicio(s, x, i) {
  const e = ex(x.id) || { n: x.nombre || x.id, m: [] };
  const abierta = s.estado !== 'hecha';
  const actualJ = abierta && !x.dolorDurante ? x.sets.findIndex(z => !z.hecha) : -1;
  const o = objetivoSeg(x);
  const objetivo = o ? objetivoCorto(o) + (o.lados > 1 ? ' cada lado' : '') : x.reps;
  const zonaDolor = x.dolorDurante && minus((ZONAS[x.dolorDurante.zona] || {}).corta || x.dolorDurante.zona);
  return `<article class="tarjeta sesion-ej${actualJ >= 0 ? ' tarjeta--actual' : ''}${x.dolorDurante ? ' sesion-ej--parado' : ''}" id="ej-${i}" aria-labelledby="ej-${i}-n">
    <div class="ejercicio-cab"><div><h2 id="ej-${i}-n">${h(e.n)}</h2>
      <p>${tiene(ROL, x.rol) ? `<span class="insignia">${h(ROL[x.rol])}</span>` : ''}<span class="cifra">${+x.series} × ${h(objetivo)}</span>${x.kg != null && conKg(x) ? `, <span class="cifra">${h(es(+x.kg, 2))} kg</span>` : ''}${x.descanso ? `, descanso <span class="cifra">${mmss(+x.descanso)}</span>` : ''}</p></div>
      <button type="button" class="boton-icono" data-act="sesion.menu" data-e="${i}" aria-label="Más opciones de ${h(e.n)}">${ICONOS.lista}</button></div>
    ${abierta ? ultimaVez(x) : ''}
    ${x.dolorDurante ? `<div class="aviso aviso--aviso aviso-tarjeta" role="note">${ICONOS.alerta}<div class="aviso-texto"><b>Parado por dolor</b><p>Tu ${h(zonaDolor)} a ${+x.dolorDurante.dolor}/10 (empezaste en ${+x.dolorDurante.antes}/10; el tope era ${+x.dolorDurante.techo}/10). Queda apuntado y hoy no se repite.</p></div></div>` : ''}
    ${x.nota ? `<p class="nota-ej">${h(x.nota)}</p>` : ''}
    ${x.motivo ? `<p class="nota-ej motivo">${h(x.motivo)}</p>` : ''}
    <ol class="series">${x.sets.map((_, j) => filaSerie(s, x, i, j, actualJ)).join('')}</ol>
    ${x.comentario ? `<p class="comentario">Para tu entrenador: «${h(x.comentario)}»</p>` : ''}
    ${tecnica(s, x)}
  </article>`;
}

// Ejercicio ya hecho en la vista de lista: una línea con lo apuntado; se abre al tocarla.
function tarjetaPlegada(s, x, i) {
  const e = ex(x.id) || { n: x.id };
  const res = x.dolorDurante ? 'Parado por dolor' : x.sets.map(z => textoSerie(x, z)).join(', ');
  return `<details class="tarjeta plegada">
    <summary>${ICONOS.check}<span><b>${h(e.n)}</b><small class="cifra">${h(res)}</small></span></summary>
    ${tarjetaEjercicio(s, x, i)}
  </details>`;
}

// «Guardar como mía» (o de cuál de tus sesiones sale).
function pieMia(S, s) {
  const m = s.origen && miaDe(S, s.origen.id);
  if (m) return `<p class="meta centro mia-origen">De tus sesiones: «${h(m.nombre)}»</p>`;
  if (s.tipo === 'dolorAlto' || !s.ejercicios.some(x => ex(x.id))) return '';
  return `<button type="button" class="boton boton--texto centro" data-act="sesion.guardarMia">${ICONOS.mas}Guardar como mía para repetirla</button>`;
}

// Pasos del modo «uno a uno»: calentamiento, cada ejercicio y vuelta a la calma.
function pasos(s) {
  return [...(s.calentamiento.length ? [{ k: 'calentamiento' }] : []), ...s.ejercicios.map((_, i) => ({ k: 'ej', i })), ...(s.vuelta.length ? [{ k: 'vuelta' }] : [])];
}
const ejHecho = x => !!x.dolorDurante || x.sets.every(z => z.hecha);
const pasoHecho = (s, p) => p.k === 'ej' ? ejHecho(s.ejercicios[p.i]) : s[p.k].every(t => t.hecho);
const primerPendiente = s => { const P = pasos(s); const k = P.findIndex(p => !pasoHecho(s, p)); return k < 0 ? P.length - 1 : k; };
const modoFocoActivo = S => (S.ajustes.modoSesion || 'foco') === 'foco';
const totales = s => ({ total: s.ejercicios.reduce((a, x) => a + x.sets.length, 0), hechas: s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0) });

function vista([id]) {
  const S = estado(), s = sesion(id);
  if (!s) return `<section class="vacio"><h1>No encuentro esa sesión</h1><p>Puede que se descartara. Prepara la de hoy desde Hoy.</p><a class="boton" href="#hoy">Volver a Hoy</a></section>`;
  const { total, hechas } = totales(s);
  const abierta = s.estado !== 'hecha';
  const modoFoco = modoFocoActivo(S) && abierta;
  if (foco.id !== id) foco = { id, i: primerPendiente(s) };
  const cab = `<header class="cab-sesion">
      <a href="#hoy" class="boton-icono" aria-label="Volver a Hoy">${ICONOS.atras}</a>
      <div><h1>${h(s.nombre)}</h1><p>${h(LUGARES[s.lugar] || '')}, <span class="cifra">${hechas} de ${total}</span> series${abierta ? '' : ', hecha'}</p></div>
      ${abierta ? '<button type="button" class="boton boton--secundario" data-act="sesion.terminar">Terminar</button>' : ''}
    </header>
    <div class="avance" role="img" aria-label="${plural(hechas, 'serie', 'series', total)}"><i data-var="--v:${total ? (hechas / total).toFixed(3) : 0}"></i></div>
    ${abierta ? `<div class="segmento segmento--ancho modo-sesion" role="radiogroup" aria-label="Cómo ver la sesión">
      <button type="button" role="radio" data-act="sesion.modo" data-v="foco" aria-checked="${modoFoco}" tabindex="${modoFoco ? 0 : -1}">Uno a uno</button>
      <button type="button" role="radio" data-act="sesion.modo" data-v="lista" aria-checked="${!modoFoco}" tabindex="${modoFoco ? -1 : 0}">Toda la sesión</button></div>` : ''}`;
  // Por qué: la primera frase (resumen del día) siempre a la vista; el resto, plegado.
  const [resumenDia, ...razones] = s.explicacion || [];
  // Si la hizo la app porque falló la IA, la nota con «Reintentar con IA» va aquí (PR 12).
  const porque = resumenDia || s.iaFallo ? `<section class="tarjeta porque-bloque" aria-label="Por qué esta sesión">
      ${notaFallo(s)}
      ${resumenDia ? `<p class="porque">${ICONOS.ia}<span>${h(resumenDia)}</span></p>` : ''}
      ${razones.length ? `<details class="tecnica"><summary>Por qué cada decisión</summary><ul class="tecnica-texto">${razones.map(t => `<li>${h(t)}</li>`).join('')}</ul></details>` : ''}
    </section>` : '';
  const algoVaMal = `<button type="button" class="boton boton--texto centro algo-va-mal" data-act="sesion.algoVaMal">${ICONOS.alerta}Algo va mal</button>`;

  if (modoFoco) {
    const P = pasos(s), k = Math.min(foco.i, P.length - 1), p = P[k];
    if (!p) return `${cab}<section class="tarjeta"><p>Esta sesión no tiene nada que hacer.</p></section>`;
    const nombrePaso = q => q.k === 'calentamiento' ? 'C' : q.k === 'vuelta' ? 'V' : String(q.i + 1);
    const etq = q => q.k === 'ej' ? `Ejercicio ${q.i + 1}: ${(ex(s.ejercicios[q.i].id) || { n: s.ejercicios[q.i].id }).n}` : q.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma';
    const tira = `<nav class="pasos-sesion" aria-label="Partes de la sesión">${P.map((q, n) => `<button type="button" data-act="sesion.ir" data-v="${n}" class="${pasoHecho(s, q) ? 'hecho' : ''}" aria-label="${h(etq(q))}${pasoHecho(s, q) ? ', hecho' : ''}" ${n === k ? 'aria-current="step"' : ''}>${pasoHecho(s, q) && n !== k ? ICONOS.check : nombrePaso(q)}</button>`).join('')}</nav>`;
    const cuerpo = p.k === 'ej' ? tarjetaEjercicio(s, s.ejercicios[p.i], p.i)
      : tareas(s, p.k, p.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma', true);
    const ultimo = k === P.length - 1;
    return `<div class="vista-sesion">${cab}${tira}${cuerpo}
      <div class="navega"><button type="button" class="boton boton--secundario" data-act="sesion.foco" data-v="-1" ${k === 0 ? 'aria-disabled="true"' : ''}>${ICONOS.atras}Anterior</button>
      ${ultimo ? '<button type="button" class="boton" data-act="sesion.terminar">Terminar</button>' : `<button type="button" class="boton boton--secundario" data-act="sesion.foco" data-v="1">Siguiente${ICONOS.sig}</button>`}</div>
      ${k === 0 ? `<div class="bloque-sesion">${porque}</div><div class="bloque-mini">${pieMia(S, s)}</div>` : ''}
      ${algoVaMal}
    </div>`;
  }

  // Toda la sesión (o la sesión ya hecha, en modo lectura): lo hecho se pliega para que la página no sea eterna.
  return `<div class="vista-sesion">${cab}<div class="sesion-lista">${porque}
    ${tareas(s, 'calentamiento', 'Calentamiento', abierta)}
    ${s.ejercicios.map((x, i) => abierta && ejHecho(x) ? tarjetaPlegada(s, x, i) : tarjetaEjercicio(s, x, i)).join('')}
    ${tareas(s, 'vuelta', 'Vuelta a la calma', abierta)}
    ${!abierta
      ? `<section class="tarjeta cierre-resumen" aria-labelledby="t-cierre"><h2 class="tarjeta-nombre" id="t-cierre">Cierre</h2><p>Esfuerzo ${s.cierre && s.cierre.esfuerzo ? `<span class="cifra">${+s.cierre.esfuerzo} de 5</span>` : '—'}</p>${s.cierre && s.cierre.comentario ? `<p class="comentario">«${h(s.cierre.comentario)}»</p>` : ''}</section>${pieMia(S, s)}`
      : `${pieMia(S, s)}<button type="button" class="boton boton--ancho" data-act="sesion.terminar">Terminar sesión</button>
         ${algoVaMal}
         <button type="button" class="boton boton--texto centro descartar" data-act="sesion.descartar">Descartar esta sesión</button>`}
  </div></div>`;
}

// ── Acciones ──
const idActual = () => location.hash.split('/')[1];
function conSesion(fn, motivo = 'sesion') {
  const id = idActual();
  cambiar(S => { const s = S.sesiones[id]; if (s) fn(s, S); }, motivo);
}

// Protección contra el doble toque (R27): un segundo toque en lo mismo en menos de 1 s cuenta como uno; en las
// series, también un toque en otra serie en menos de 240 ms (el dedo cae en el botón que acaba de ocupar el sitio).
let ultimoToque = { k: '', t: -1e9 };
function dobleToque(k, otra = 0) {
  const t = performance.now(), d = t - ultimoToque.t;
  if ((k === ultimoToque.k && d < 1000) || (k !== ultimoToque.k && k[0] === ultimoToque.k[0] && d < otra)) return true;
  ultimoToque = { k, t };
  return false;
}
window.addEventListener('hashchange', () => { ultimoToque = { k: '', t: -1e9 }; });

// El último dolor conocido de una zona: el del check-in de esta sesión; si no, el de la lesión en el perfil; si no,
// el último apuntado. Así el cierre no empieza en 0 cuando hoy duele (auditoría, PR 15).
function ultimoDolor(S, s, z) {
  const ci = s.checkin && s.checkin.dolor;
  if (ci && ci[z] != null) return +ci[z];
  const l = S.perfil.lesiones.find(x => x.activa && x.zona === z);
  if (l && l.dolor != null) return +l.dolor;
  const r = (S.dolor || []).filter(d => d.zona === z).slice(-1)[0];
  return r ? +r.dolor : 0;
}
// Cuántas series y estiramientos quedan (para «Terminar» con cosas pendientes, R17).
function pendientes(s) {
  const ej = s.ejercicios.filter(x => !x.dolorDurante).map(x => [(ex(x.id) || { n: x.id }).n, x.sets.filter(z => !z.hecha).length]).filter(([, n]) => n);
  return { ej, series: ej.reduce((a, [, n]) => a + n, 0), vuelta: s.vuelta.filter(t => !t.hecho).length };
}

function hojaCierre() {
  const S = estado(), s = sesion(idActual()); if (!s || s.estado === 'hecha') return;
  // Sin ninguna serie no hay sesión que guardar: no cuenta como entrenada ni para la constancia (E7).
  if (!trabajoHecho(s)) {
    abrirHoja(`<h2>No has marcado nada</h2>
      <p class="hoja-texto">Una sesión sin ninguna serie ni tarea marcada no cuenta como entrenada. Si las has hecho, márcalas y vuelve a «Terminar».</p>
      <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="sesion.seguir">Volver a la sesión</button><button type="button" class="boton boton--peligro" data-act="sesion.descartar">Descartar la sesión</button></div>`, { clase: 'hoja-sesion' });
    return;
  }
  // «Terminar» dice cuántas quedan (R17), en la misma hoja que el cierre: seguir o guardar igual.
  const p = pendientes(s);
  const lista = [...p.ej.map(([n, k]) => `${k} de ${minus(n)}`), ...(p.vuelta ? [`${p.vuelta} estiramiento${p.vuelta === 1 ? '' : 's'} de la vuelta a la calma`] : [])];
  const est = `${p.vuelta} estiramiento${p.vuelta === 1 ? '' : 's'}`;
  const titulo = p.series ? `${p.series} serie${p.series === 1 ? '' : 's'}${p.vuelta ? ` y ${est}` : ''}` : est;
  const quedan = lista.length ? `<div class="aviso aviso--aviso aviso-hoja" role="note">${ICONOS.alerta}<div class="aviso-texto">
      <b>Te ${p.series + p.vuelta === 1 ? 'queda' : 'quedan'} ${titulo}</b>
      <p>Si terminas ahora, quedan sin hacer: ${h(lista.join(', '))}. Lo hecho se guarda igual.</p>
      <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="sesion.seguir">Seguir con la sesión</button></div></div></div>` : '';
  // Solo zonas del catálogo: su clave va dentro de un id.
  const zonas = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona)])].filter(z => tiene(ZONAS, z));
  abrirHoja(`<h2>¿Qué tal ha ido?</h2>
    ${quedan}
    <div class="grupo"><p class="grupo-et" id="c-esf-et">Esfuerzo</p>
      <div class="segmento segmento--ancho" role="radiogroup" aria-labelledby="c-esf-et" id="c-esf">${Object.entries(ESFUERZO).map(([v, t]) => `<button type="button" role="radio" data-v="${v}" aria-checked="${v === '3'}" tabindex="${v === '3' ? 0 : -1}" aria-label="${v}: ${t}">${v}</button>`).join('')}</div>
      <p class="ayuda" id="c-esf-txt">${ESFUERZO[3]}</p></div>
    ${zonas.map(z => `<div class="grupo">${selector({ id: `c-dolor-${z}`, et: `Dolor ahora en ${minus(ZONAS[z].corta)}`, valor: Math.max(0, Math.min(10, ultimoDolor(S, s, z))), min: 0, max: 10, paso: 1, unidad: 'de 10', nombre: 'de 10', entrada: `data-zona="${h(z)}"` })}</div>`).join('')}
    <div class="campo"><label for="c-com">Para tu entrenador <small>molestias, qué cambiarías…</small></label><textarea id="c-com" rows="3" maxlength="${+LARGO_TEXTO.comentarioCierre}"></textarea></div>
    <button type="button" class="boton boton--ancho" data-act="sesion.cerrar">Guardar sesión</button>`, { clase: 'hoja-sesion' });
}
// Esfuerzo: grupo de radio (flechas, Inicio y Fin) que se actualiza en su sitio (R15).
const ESFUERZO = { 1: 'Muy fácil', 2: 'Fácil', 3: 'Justo', 4: 'Duro', 5: 'Al límite' };
function elegirEsfuerzo(b) {
  const g = b.closest('#c-esf'); if (!g) return;
  for (const x of g.children) { const si = x === b; x.setAttribute('aria-checked', String(si)); x.tabIndex = si ? 0 : -1; }
  const t = $('#c-esf-txt'); if (t) t.textContent = ESFUERZO[b.dataset.v];
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#c-esf [role="radio"]'); if (b) elegirEsfuerzo(b); });
document.addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('#c-esf [role="radio"]'); if (!b) return;
  const l = [...b.parentNode.children], k = l.indexOf(b);
  const n = { ArrowRight: k + 1, ArrowDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, Home: 0, End: l.length - 1 }[e.key];
  if (n == null) return;
  e.preventDefault(); const d = l[(n + l.length) % l.length]; elegirEsfuerzo(d); d.focus();
});

// ── «Algo va mal» (T3 de alarma.js, C-ALAR-1 y C-DOLOR-6) ──
// Una señal de alarma para la sesión en curso; el dolor de la lesión se apunta por zona y, si pasa del límite
// (+2 sobre el de antes y nunca del techo), ese ejercicio se para, queda guardado y no se repite hoy.
const ejerciciosVivos = s => s.ejercicios.map((x, i) => ({ x, i })).filter(({ x }) => !x.dolorDurante && !x.sets.every(z => z.hecha) && ex(x.id));
function zonasDe(s, x) {
  const S = estado();
  const conDolor = [...new Set([...Object.keys((s.checkin && s.checkin.dolor) || {}), ...S.perfil.lesiones.filter(l => l.activa).map(l => l.zona)])].filter(z => tiene(ZONAS, z));
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
  // Sin lesiones activas, T3b (aprobado por Víctor el 23-11-2026, § 2.5): no habla de «tu lesión» (U6).
  const conLesion = S.perfil.lesiones.some(l => l.activa);
  abrirHoja(`<h2>Algo va mal</h2>
    <p class="hoja-texto">${h(conLesion ? T3(techo) : T3b(techo))}</p>
    <button type="button" class="boton boton--peligro boton--ancho" data-act="sesion.pararAlarma">Termino la sesión aquí</button>
    ${x ? `<h3 class="hoja-sub">${conLesion ? 'Si es solo el dolor de tu lesión' : 'Si te duele una zona al hacer un ejercicio'}</h3>
    <div class="campo"><label for="avm-ej">Ejercicio</label><select id="avm-ej" data-cambio="sesion.avmCampo" data-k="e">${vivos.map(v => `<option value="${+v.i}" ${v.i === avm.e ? 'selected' : ''}>${h(ex(v.x.id).n)}</option>`).join('')}</select></div>
    <div class="campo"><label for="avm-zona">Dónde</label><select id="avm-zona" data-cambio="sesion.avmCampo" data-k="zona">${zonas.map(z => `<option value="${h(z)}" ${z === avm.zona ? 'selected' : ''}>${h(ZONAS[z].corta)}</option>`).join('')}</select></div>
    <div class="grupo">${selector({ id: 'avm-dolor', et: `Dolor ahora (empezaste en ${antes} de 10)`, valor: Math.max(0, Math.min(10, +avm.dolor)), min: 0, max: 10, paso: 1, unidad: 'de 10', nombre: 'de 10' })}</div>
    <button type="button" class="boton boton--secundario boton--ancho" data-act="sesion.dolorDurante">Apuntar el dolor</button>` : ''}`, { clase: 'precaucion hoja-sesion' });
}
function menuEjercicio(i) {
  const s = sesion(idActual()); if (!s) return;
  const x = s.ejercicios[i], e = ex(x.id), abierta = s.estado !== 'hecha';
  abrirHoja(`<h2>${h(e ? e.n : x.id)}</h2>
    <ul class="menu-hoja">
      <li><button type="button" data-act="sesion.ficha" data-id="${h(x.id)}">${ICONOS.info}Cómo se hace</button></li>
      ${abierta ? `<li><button type="button" data-act="sesion.cambiar" data-e="${i}">${ICONOS.editar}Cambiar por otro</button></li>
      ${x.dolorDurante ? '' : `<li><button type="button" data-act="sesion.serieMas" data-e="${i}" data-v="1">${ICONOS.mas}Añadir una serie</button></li>
      ${x.sets.length > 1 && !x.sets[x.sets.length - 1].hecha ? `<li><button type="button" data-act="sesion.serieMas" data-e="${i}" data-v="-1">${ICONOS.menos}Quitar una serie</button></li>` : ''}
      <li><button type="button" data-act="sesion.algoVaMal" data-e="${i}">${ICONOS.alerta}Me duele al hacerlo</button></li>`}` : ''}
    </ul>
    <p class="grupo-et">¿Qué te parece?</p>${botonesGusto(x.id, 'sesion.gusto')}
    <div class="campo"><label for="m-com">Comentario para tu entrenador</label><textarea id="m-com" rows="2" maxlength="${+LARGO_TEXTO.comentarioEjercicio}" placeholder="me molesta la muñeca, la máquina estaba ocupada…">${h(x.comentario)}</textarea></div>
    <button type="button" class="boton boton--secundario boton--ancho" data-act="sesion.comentar" data-e="${i}">Guardar comentario</button>`, { clase: 'hoja-sesion' });
  // Sin foco automático en el comentario (abrirHoja pone el foco en el título): sacaba el teclado (E4).
}

// Tras marcar: el foco va a la siguiente acción principal (R11) y la serie actual no queda debajo del descanso (R09).
function mantenerVisible() {
  const fila = $('#vista [data-actual]'), tapa = $('#temporizador.descanso');
  if (!fila) return;
  const limite = tapa ? tapa.getBoundingClientRect().top : innerHeight;
  const falta = fila.getBoundingClientRect().bottom - limite + 12;
  if (falta > 0) window.scrollTo(0, window.scrollY + falta);
}
function enfocarSiguiente() {
  const b = $('#vista [data-principal]') || $('#vista [data-act="sesion.foco"][data-v="1"]') || $('#vista [data-act="sesion.terminar"]');
  try { b && b.focus({ preventScroll: true }); } catch { /* sin foco */ }
}

function marcarSerie(i, j, valorPorDefecto, idSesion = idActual()) {
  let descansar = 0, etiqueta = '', siguiente = '', avanza = false, desmarcada = false;
  const s0 = sesion(idSesion);
  if (!s0 || s0.estado === 'hecha') return; // una sesión hecha se ve en modo lectura
  cambiar(S => { const s = S.sesiones[idSesion]; if (!s) return;
    const x = s.ejercicios[i], z = x && x.sets[j]; if (!z) return;
    if (x.dolorDurante && !z.hecha) return; // parado por dolor: no se repite (C-DOLOR-6)
    empezarSiHaceFalta(S, s);
    z.hecha = !z.hecha;
    if (!z.hecha) { desmarcada = true; return; }
    if (!String(z.valor).trim()) { const r = rango(x.reps); z.valor = valorPorDefecto != null ? String(valorPorDefecto) : r ? String(r.lo) : ''; }
    if (z.kg == null && x.kg != null && conKg(x)) z.kg = x.kg;
    // Los kilos y las repeticiones pasan a las series siguientes que siguen vacías (R05): las que no se han
    // hecho, con el peso previsto y sin repeticiones apuntadas.
    // También se pisa lo que vino propagado de la serie anterior (coincide con ella): si bajas la serie 2, la 3
    // baja con ella; lo que ajustaste a mano en una serie siguiente se respeta.
    const porTiempo = !!objetivoSeg(x);
    const ant = x.sets.slice(0, j).filter(q => q.hecha).pop();
    for (const w of x.sets.slice(j + 1)) {
      if (w.hecha) continue;
      if (conKg(x) && z.kg != null && (w.kg == null || +w.kg === +x.kg || (ant && ant.kg != null && +w.kg === +ant.kg))) w.kg = z.kg;
      const wv = String(w.valor || '').trim();
      if (!porTiempo && (!wv || (ant && wv === String(ant.valor || '').trim()))) w.valor = z.valor;
    }
    const sig = x.sets.findIndex(w => !w.hecha);
    const ultimaDelEj = sig < 0;
    const prox = s.ejercicios.slice(i + 1).find(y => !ejHecho(y));
    if ((!ultimaDelEj || prox) && x.descanso) {
      descansar = x.descanso;
      const nProx = prox && minus((ex(prox.id) || { n: prox.id }).n);
      etiqueta = ultimaDelEj ? `Después: ${nProx}` : `Serie ${sig + 1} de ${x.sets.length}`;
      siguiente = ultimaDelEj ? `A por ${nProx}` : `A por la serie ${sig + 1}`;
    }
    // Uno a uno: al terminar la última serie, pasa solo al siguiente paso.
    if (ultimaDelEj && modoFocoActivo(S) && foco.id === idSesion) { const P = pasos(s), k = P.findIndex(p => p.k === 'ej' && p.i === i); if (k >= 0 && k < P.length - 1) { foco.i = k + 1; avanza = true; } }
    recien = `${idSesion}/${i}/${j}`;
  }, 'sesion');
  recien = '';
  cerrarAlarma();
  // Desmarcar una serie anterior no corta el descanso en marcha (M4): solo se quita si lo empezó esa serie.
  if (desmarcada) { const cr = info(); if (cr && cr.tipo === 'descanso' && cr.meta && cr.meta.sesion === idSesion && cr.meta.e === i && cr.meta.s === j) parar(); }
  else if (descansar) descanso(descansar, etiqueta, { sesion: idSesion, siguiente, e: i, s: j }); else parar();
  if (avanza) window.scrollTo(0, 0);
  enfocarSiguiente();
  mantenerVisible();
}

// ── Pantalla final (celebración aprobada): series, minutos, kilos movidos y mejor serie, con lo que ya hay ──
function datosFinal(S, s) {
  let series = 0, kilos = 0, mejor = null, aprox = false;
  for (const x of s.ejercicios) {
    const e = ex(x.id), u = unidad(x);
    for (const z of x.sets) {
      if (!z.hecha) continue;
      series++;
      if (!conKg(x) || u !== 'reps' || !(+z.kg > 0)) continue;
      const reps = valorApuntado(z.valor, '') || 0;
      // «10 c/lado» son 20 repeticiones; las mancuernas pueden ser una o dos: la cifra se da como aproximada.
      const lados = /c\/\s*lado|por lado|cada lado/i.test(String(x.reps)) ? 2 : 1;
      if (e && e.mat.includes('mancuernas')) aprox = true;
      kilos += +z.kg * reps * lados;
      const rm = e1rm(+z.kg, reps || 1);
      if (reps && (!mejor || rm > mejor.rm)) mejor = { rm, n: e ? e.n : x.id, kg: +z.kg, reps };
    }
  }
  // Minutos de verdad (de la primera marca a guardar); si empezó otro día o pasa de 4 h, los de la sesión.
  let min = s.empezada && s.terminada ? Math.max(1, Math.round((new Date(s.terminada) - new Date(s.empezada)) / 60000)) : null;
  if (min && (min > 240 || new Date(s.empezada).toDateString() !== new Date(s.terminada).toDateString())) min = +s.minutos || null;
  let semana = '';
  try {
    const d = estadoDias(S);
    if (d.length) semana = `${plural(d.filter(x => x.estado === 'hecho').length, 'día del plan', 'días del plan', d.length)} esta semana`;
  } catch { /* sin plan */ }
  return { series, kilos: Math.round(kilos), aprox, mejor, min, semana };
}
let finalViva = null;
function quitarFinal() {
  if (!finalViva) return;
  const { el, inertes } = finalViva; finalViva = null;
  el.remove(); inertes.forEach(n => n.removeAttribute('inert'));
  document.body.classList.remove('con-final');
  const t = $('#vista h1'); try { t && t.focus({ preventScroll: true }); } catch { /* sin foco */ }
}
function mostrarFinal(idSesion) {
  quitarFinal();
  const S = estado(), s = S.sesiones[idSesion]; if (!s) return;
  const d = datosFinal(S, s), quieto = movimientoReducido();
  // Cifras en rodillo: cada dígito sube hasta su valor (con movimiento reducido, ya en su sitio).
  let n = 0;
  const rd = v => `<span class="solo-lector">${h(v)}</span><span class="rodillo" aria-hidden="true">${[...String(v)].map(c => /\d/.test(c) ? `<span class="rd" data-var="--i:${n++}"><span class="rd-tira" data-fin="${c}">${[...'0123456789'].map(k => `<span>${k}</span>`).join('')}</span></span>` : `<span>${h(c)}</span>`).join('')}</span>`;
  const cifras = [['series', d.series], ...(d.min ? [['minutos', d.min]] : []), ...(d.kilos ? [[d.aprox ? 'kilos movidos, aprox.' : 'kilos movidos', d.kilos.toLocaleString('es-ES')]] : [])];
  const el = document.createElement('div');
  el.className = 'final' + (quieto ? '' : ' celebra');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'fin-t');
  el.innerHTML = `<div class="final-agua" aria-hidden="true"></div><div class="final-dentro">
    <div class="sello" aria-hidden="true"><i></i><i></i><i></i><span>${ICONOS.check}</span></div>
    <h2 id="fin-t" tabindex="-1">Sesión guardada</h2>${d.semana ? `<p class="semana-txt">${h(d.semana)}</p>` : ''}
    <dl>${cifras.map(([t, v]) => `<div><dt>${t}</dt><dd>${rd(v)}</dd></div>`).join('')}</dl>
    ${d.mejor ? `<p class="marca">${h(d.mejor.n)}: <span class="cifra">${h(es(d.mejor.kg, 2))} kg × ${d.mejor.reps}</span>, tu mejor serie de hoy.</p>` : '<p class="marca">Hecha. Lo que te hace progresar es la constancia.</p>'}
    <button type="button" class="boton boton--ancho" data-fin-hoy>Volver a Hoy</button></div>`;
  const inertes = [...document.body.children].filter(c => c !== el && !c.hasAttribute('inert') && !c.matches('script, #aviso'));
  inertes.forEach(c => c.setAttribute('inert', ''));
  document.body.appendChild(el);
  document.body.classList.add('con-final');
  finalViva = { el, inertes };
  const tiras = $$('.rd-tira', el);
  const poner = () => tiras.forEach(t => t.style.setProperty('--d', t.dataset.fin));
  if (quieto) poner(); else requestAnimationFrame(() => requestAnimationFrame(poner));
  el.addEventListener('click', e => { if (e.target.closest('[data-fin-hoy]')) quitarFinal(); });
  try { $('#fin-t', el).focus({ preventScroll: true }); } catch { /* sin foco */ }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && finalViva) { e.preventDefault(); quitarFinal(); } });
// Cambiar de pantalla (o el botón atrás) quita la pantalla final.
window.addEventListener('hashchange', () => { if (finalViva && location.hash !== '#hoy') quitarFinal(); });

// Para el temporizador y la alarma solo si son de esta sesión (cerrar la de ayer no corta el descanso de hoy).
function pararSiEsDe(id) {
  const cr = info();
  if (cr && (!cr.meta || cr.meta.sesion === id)) parar();
  const al = alarmaDe();
  if (al && (!al.sesion || al.sesion === id)) cerrarAlarma();
}
let cerrando = false;
acciones({
  'sesion.modo': el => {
    if (el.getAttribute('aria-checked') === 'true') return;
    cambiar(S => { S.ajustes.modoSesion = el.dataset.v; }, 'ajustes');
    const b = $(`#vista [data-act="sesion.modo"][data-v="${el.dataset.v}"]`); try { b && b.focus({ preventScroll: true }); } catch { /* nada */ }
  },
  'sesion.foco': el => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    foco.i = Math.max(0, foco.i + +el.dataset.v); pintar(); window.scrollTo(0, 0);
    const b = $(`#vista [data-act="sesion.foco"][data-v="${el.dataset.v}"]:not([aria-disabled="true"])`) || $('#vista .navega [data-act="sesion.terminar"]') || $('#vista .navega .boton');
    try { b && b.focus({ preventScroll: true }); } catch { /* nada */ }
  },
  'sesion.ir': el => {
    foco.i = +el.dataset.v; pintar(); window.scrollTo(0, 0);
    const b = $('#vista .pasos-sesion [aria-current]'); try { b && b.focus({ preventScroll: true }); } catch { /* nada */ }
  },
  'sesion.tarea': el => {
    const s = sesion(idActual()); if (!s || s.estado === 'hecha') return;
    if (dobleToque(`t/${el.dataset.k}/${el.dataset.i}`)) return;
    conSesion((s2, S) => { empezarSiHaceFalta(S, s2); const t = s2[el.dataset.k][+el.dataset.i]; t.hecho = !t.hecho; });
    const b = $(`#vista [data-act="sesion.tarea"][data-k="${el.dataset.k}"][data-i="${el.dataset.i}"]`); try { b && b.focus({ preventScroll: true }); } catch { /* nada */ }
  },
  'sesion.ficha': el => abrirFicha(el.dataset.id),
  'sesion.dato': el => conSesion(s => {
    if (s.estado === 'hecha') return;
    const x = s.ejercicios[+el.dataset.e]; const z = x && x.sets[+el.dataset.s]; if (!z) return;
    if (el.dataset.k === 'kg') z.kg = num(el.value); else z.valor = String(el.value).trim();
  }, 'sesion-silencio'),
  'sesion.serie': el => {
    if (dobleToque(`s/${idActual()}/${el.dataset.e}/${el.dataset.s}`, 240)) return;
    marcarSerie(+el.dataset.e, +el.dataset.s);
  },
  'sesion.cuenta': el => {
    const i = +el.dataset.e, j = +el.dataset.s, id = idActual(), s = sesion(id); if (!s || s.estado === 'hecha') return;
    if (dobleToque(`c/${id}/${i}/${j}`)) return;
    const x = s.ejercicios[i], o = objetivoSeg(x);
    if (!o) return;
    cerrarAlarma();
    const nombre = (ex(x.id) || { n: x.id }).n;
    cuenta({ lo: o.lo, hi: o.hi, lados: o.lados, u: o.u, nombre, etiqueta: `${nombre} · serie ${j + 1} de ${x.sets.length}`, meta: { sesion: id, e: i, s: j } });
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
    parar(); cerrarAlarma(); pararPorAlarma(id); cerrarHoja(); ir('hoy');
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
      <p class="hoja-texto">Tu ${h(zona)} está a ${dolor}/10 y el límite era ${limite}/10: este ejercicio se para y queda apuntado para tu entrenador. Hoy no se repite.</p>
      <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="sesion.cambiar" data-e="${i}">Cambiar por otro</button><button type="button" class="boton" data-act="sesion.seguir">Seguir con el siguiente</button></div>`, { clase: 'hoja-sesion' });
  },
  'sesion.serieMas': el => {
    conSesion(s => {
      if (s.estado === 'hecha') return;
      const x = s.ejercicios[+el.dataset.e];
      if (+el.dataset.v > 0) x.sets.push({ kg: x.kg, valor: '', hecha: false });
      else if (x.sets.length > 1 && !x.sets[x.sets.length - 1].hecha) x.sets.pop();
      x.series = x.sets.length;
    });
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
    // (las alternativas salen de alternativasDe, con las reglas del validador)
    const S = estado(), s = sesion(idActual()), i = +el.dataset.e, x = s.ejercicios[i], e = ex(x.id);
    // Un principal, de su nivel (C-DOSIS-10), salvo en una de «Mis sesiones» (C-MIA-2). Si el ejercicio se paró
    // por dolor, tampoco nada que cargue esa zona a ese dolor (C-DOLOR-6).
    const dd = x.dolorDurante;
    const alts = alternativasDe(S, s, i).slice(0, 8);
    const hechas = dd ? 0 : x.sets.filter(z => z.hecha).length;
    const pl = hechas > 1;
    abrirHoja(`<h2>Cambiar ${h(minus(e.n))}</h2>
      <p class="hoja-texto">${hechas ? `Tienes ${hechas} serie${pl ? 's' : ''} hecha${pl ? 's' : ''} de ${h(minus(e.n))}: se ${pl ? 'quedan' : 'queda'} apuntada${pl ? 's' : ''} y el nuevo hace las que faltan.` : 'Para el mismo trabajo, con lo que hay en este lugar y lo que te permite hoy.'}</p>
      ${alts.length ? `<ul class="lista">${alts.map(a => `<li><button type="button" class="fila" data-act="sesion.cambiarPor" data-e="${i}" data-id="${h(a.id)}"><span class="crece"><b>${h(a.n)}</b><span>${a.m.map(m => MUSCULOS[m]).join(', ')}${S.perfil.gustos[a.id] ? `; ${h(GUSTOS[S.perfil.gustos[a.id]].nombre)}` : ''}</span></span>${ICONOS.sig}</button></li>`).join('')}</ul>` : '<p class="hoja-texto">No hay alternativas seguras aquí.</p>'}`, { clase: 'hoja-sesion' });
  },
  'sesion.cambiarPor': async el => {
    const i = +el.dataset.e, nuevoId = el.dataset.id;
    const s0 = sesion(idActual()), v0 = s0 && s0.ejercicios[i], n0 = ex(nuevoId); if (!v0 || !n0) return;
    // Solo lo que acepta el validador para ese rol y esta sesión (revisión del PR #45, G1).
    if (!alternativasDe(estado(), s0, i).some(a => a.id === nuevoId)) { aviso('Ese cambio ya no vale con tu sesión de hoy: elige otro.', 'error'); cerrarHoja(); return; }
    const hechas = v0.dolorDurante ? 0 : v0.sets.filter(z => z.hecha).length;
    // Con series ya hechas se pregunta antes (auditoría, R17): no se pierde nada, pero cambia la sesión.
    if (hechas) {
      const pl = hechas > 1, faltan = Math.max(1, v0.sets.length - hechas);
      if (!await confirmar(`Tienes ${hechas} serie${pl ? 's' : ''} hecha${pl ? 's' : ''} de ${minus(ex(v0.id).n)}: se ${pl ? 'quedan' : 'queda'} apuntada${pl ? 's' : ''}, y ${minus(n0.n)} hace ${faltan === 1 ? 'la que falta' : `las ${faltan} que faltan`}. ¿Lo cambias?`, { si: 'Cambiar', no: 'Volver' })) return;
    }
    conSesion(s => {
      const viejo = s.ejercicios[i], n = ex(nuevoId);
      const nota = `En lugar de ${ex(viejo.id).n.toLowerCase()}.`;
      const yaHechas = viejo.dolorDurante ? 0 : viejo.sets.filter(z => z.hecha).length;
      const series = yaHechas ? Math.max(1, viejo.sets.length - yaHechas) : viejo.series;
      const d = ejercicioCambiado(estado(), viejo, n, contextoDia(estado(), { lugar: s.lugar, dolorHoy: dolorDeCambio(s, viejo) }));
      const nuevo = crearEjercicio({ ...d, series: yaHechas ? series : d.series, nota });
      // Uno parado por dolor se queda (con su «dolor durante» apuntado) y el nuevo va detrás (C-DOLOR-6).
      // Si ya se había cambiado (el siguiente es su sustituto sin nada hecho), se cambia ese: no se van sumando.
      const sustituto = s.ejercicios[i + 1];
      const yaCambiado = viejo.dolorDurante && sustituto && sustituto.nota === nota && !sustituto.sets.some(z => z.hecha);
      if (yaCambiado) s.ejercicios[i + 1] = nuevo;
      else if (viejo.dolorDurante) s.ejercicios.splice(i + 1, 0, nuevo);
      else if (yaHechas) {
        // Lo hecho se queda como estaba; el nuevo, detrás, con las series que faltan.
        viejo.sets = viejo.sets.filter(z => z.hecha); viejo.series = viejo.sets.length;
        s.ejercicios.splice(i + 1, 0, nuevo);
      } else s.ejercicios[i] = nuevo;
    });
    cerrarHoja();
    aviso(`${n0.n} en lugar de ${minus(ex(v0.id).n)}`);
  },
  'sesion.guardarMia': () => {
    const s = sesion(idActual()); if (!s) return;
    abrirHoja(`<h2>Guardar como mía</h2>
      <p class="hoja-texto">Guardo sus ejercicios con sus series, repeticiones y descansos, y el lugar. Los kilos no: se calculan cada vez con tu progreso. Para repetirla, elígela en «Antes de empezar»: se ajusta al dolor, lugar y material de ese día, y siempre lleva calentamiento, cardio y estiramientos.</p>
      <div class="campo"><label for="mia-nombre">Nombre</label><input id="mia-nombre" maxlength="${+LARGO_NOMBRE_MIA}" value="${h(String(s.nombre || '').slice(0, LARGO_NOMBRE_MIA))}" placeholder="abdominales y flexiones"></div>
      <button type="button" class="boton boton--ancho" data-act="sesion.guardarMiaOk">Guardar en mis sesiones</button>`, { clase: 'hoja-sesion' });
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
    const id = idActual(), s0 = sesion(id);
    if (!s0 || s0.estado === 'hecha' || cerrando) return; // doble toque en «Guardar sesión»
    if (!trabajoHecho(s0)) { cerrarHoja(); aviso('Sin nada marcado no se guarda: no cuenta como entrenada.', 'info'); return; }
    const sel = $('#c-esf [aria-checked="true"]');
    const esf = sel ? +sel.dataset.v : 3;
    const dolor = {}; document.querySelectorAll('.hoja [data-zona]').forEach(r => { dolor[r.dataset.zona] = +r.value; });
    const comentario = (($('#c-com') || {}).value || '').trim();
    cerrando = true;
    try {
      conSesion((s, S) => {
        empezarSiHaceFalta(S, s);
        s.estado = 'hecha'; s.terminada = new Date().toISOString(); s.cierre = { esfuerzo: esf, dolor, comentario };
        // Una sesión de otro día («Cerrar la de ayer» desde Hoy) apunta el dolor en su día, no en el de hoy.
        const fecha = s.fecha && s.fecha < hoyISO() ? s.fecha : hoyISO();
        Object.entries(dolor).forEach(([zona, v]) => S.dolor.push({ fecha, zona, dolor: v, momento: 'despues', sesion: s.id }));
        Object.entries((s.checkin && s.checkin.dolor) || {}).forEach(([zona, v]) => S.dolor.push({ fecha, zona, dolor: v, momento: 'antes', sesion: s.id }));
      });
      pararSiEsDe(id); cerrarHoja(); ir('hoy');
      mostrarFinal(id);
    } finally { cerrando = false; }
  },
  'sesion.descartar': async () => {
    const s = sesion(idActual()); if (!s) return;
    const { hechas } = totales(s);
    if (!await confirmar(`¿Descartar «${s.nombre}»? Se borra lo apuntado en ella${hechas ? `: ${hechas} serie${hechas === 1 ? '' : 's'} hecha${hechas === 1 ? '' : 's'}` : ''}.`, { si: 'Descartar sesión', no: 'Seguir con la sesión', peligro: true })) return;
    const id = idActual();
    cambiar(S => { delete S.sesiones[id]; }, 'sesion');
    pararSiEsDe(id); ir('hoy');
    aviso('Sesión descartada', 'info');
  },
});
// Fin de un ejercicio por tiempo: se apunta lo que se aguantó de verdad (con dos lados, el lado más flojo,
// que es el que manda para progresar) y se marca la serie, que lanza el descanso.
registrarFin((meta, tiempos) => {
  const s = estado().sesiones[meta.sesion]; if (!s || s.estado === 'hecha') return;
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
