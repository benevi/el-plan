// Prototipos navegables de Pipos Fitness (DIS 4). Construidos solo con el sistema de DIS 3 (../sistema/) y la
// identidad Carril 2 + Trenza. Reflejan lo que hace la app en pipos-v2; lo que es nuevo está en docs/diseno/prototipos.md.
// Nada se guarda: el estado vive en memoria y se reinicia al recargar. La persona y el escenario van en la URL
// (?p=victor&e=alarma#sesion), así cada estado tiene su enlace (menú «Prototipo» y capturas).
import * as D from './datos.js';
import { EJERCICIOS, ex, MUSCULOS, MATERIAL, LUGARES, NIVELES } from './catalogo.js';
import { linea, barras, vasos, activar } from '../sistema/graficos.js';
import { MAPA } from './estados.js';

// ───────────────────────── utilidades ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const num = n => (n == null || n === '' ? '—' : fmt.format(n));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ico = (n, extra = '') => `<svg class="icono ${extra}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const minus = t => String(t || '').toLowerCase();
const PARAMS = new URLSearchParams(location.search);
const CAPTURA = PARAMS.has('captura');
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches || CAPTURA;
const CON_PESO = ['mancuernas', 'barra', 'maquina', 'polea', 'botellas'];
const conKg = x => { const e = ex(x.id); return !!e && e.t === 'reps' && e.mat.some(m => CON_PESO.includes(m)); };
// «8-10» · «40-60 s» · «12 min» · «10 c/lado» · «20-30 s c/lado» · «4 × 50 m»
function rango(reps) {
  const t = String(reps);
  const m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(s|min|m)?\b/);
  if (!m) return null;
  const lo = parseFloat(m[1].replace(',', '.')), hi = m[2] ? parseFloat(m[2].replace(',', '.')) : lo;
  return { lo, hi, u: m[3] || '', lados: /c\/lado/.test(t) ? 2 : 1, series: /×/.test(t) };
}
const porTiempo = x => { const r = rango(x.reps); return r && (r.u === 's' || r.u === 'min') ? { lo: r.u === 'min' ? r.lo * 60 : r.lo, hi: r.u === 'min' ? r.hi * 60 : r.hi, lados: r.lados, u: r.u } : null; };
const unidad = x => (porTiempo(x) ? 'seg' : ex(x.id)?.t === 'distancia' ? 'm' : 'reps');
const textoReps = x => { const t = porTiempo(x); return t && t.u === 'min' ? `${t.hi / 60} min` : x.reps; };

// ───────────────────────── estado ─────────────────────────
let S;
function sesionNueva(p) {
  const b = structuredClone(D.SESIONES[p]);
  b.calentamiento.forEach(t => { t.hecho = false; });
  b.vuelta.forEach(t => { t.hecho = false; });
  b.ejercicios.forEach(x => { x.sets = Array.from({ length: x.series }, () => ({ kg: null, valor: null, hecha: false })); });
  b.estado = 'pendiente';
  return b;
}
function marcarHecho(s, hastaEj, hastaSerie) { // escenarios: lo hecho hasta un punto
  s.calentamiento.forEach(t => { t.hecho = true; });
  s.ejercicios.forEach((x, i) => x.sets.forEach((z, j) => {
    if (i < hastaEj || (i === hastaEj && j < hastaSerie)) { z.hecha = true; z.kg = conKg(x) ? x.kg : null; const r = rango(x.reps); z.valor = porTiempo(x) ? String(Math.round(porTiempo(x).hi * 0.9)) : r ? (j === x.series - 1 ? r.lo : r.hi) : ''; }
  }));
  s.ejercicios.forEach(x => { // lo hecho pasa a la siguiente serie (R05)
    const ult = [...x.sets].reverse().find(z => z.hecha); const sig = x.sets.find(z => !z.hecha);
    if (ult && sig && !porTiempo(x)) { sig.kg = ult.kg; sig.valor = ult.valor; }
  });
  s.estado = 'en_curso';
}
function nuevoEstado(p, e) {
  const perfil = structuredClone(D.PERFILES[p]);
  const st = {
    p, e, red: e !== 'sinred', perfil, plan: structuredClone(D.PLANES[p]), sesion: null, ayer: null, modo: 'foco', paso: null,
    descanso: null, alarma: null, ci: null, gustos: perfil.gustos, hecha: false, grupo: PARAMS.get('g') || 'objetivos',
    filtro: { texto: '', lugar: '', musculo: '', gusto: '' }, progreso: e === 'vacio' ? 'vacio' : e === 'semana' ? 'semana' : 'año', sinPlan: e === 'sinplan', primera: e === 'primera',
  };
  if (e === 'primera') { st.perfil.objetivos = []; st.plan = null; }
  if (e === 'sinplan') st.plan = null;
  if (e === 'descanso') st.plan.dias = st.plan.dias.filter(d => d.d !== D.HOY.diaSemana);
  const enSesion = ['sesion', 'lista', 'tiempo', 'cardio', 'descanso-s', 'alarma', 'volver', 'pendientes', 'cierre', 'final', 'leer', 'ficha', 'menu', 'cambiar', 'mia', 'fallo', 'marcha'];
  if (enSesion.includes(e)) {
    st.sesion = sesionNueva(p);
    st.sesion.fuente = e === 'fallo' ? 'app' : 'ia';
    if (e === 'fallo') st.sesion.iaFallo = { motivo: 'el entrenador IA no respondió a tiempo (más de 90 segundos)' };
  }
  const s = st.sesion;
  if (e === 'marcha') marcarHecho(s, 1, 2);
  if (['descanso-s', 'alarma', 'volver'].includes(e)) marcarHecho(s, 0, 1);
  if (e === 'tiempo') marcarHecho(s, p === 'victor' ? 4 : 3, 0);
  if (e === 'cardio') marcarHecho(s, s.ejercicios.length - 1, 0);
  if (e === 'pendientes' || e === 'cierre') marcarHecho(s, s.ejercicios.length - 2, 1);
  if (e === 'leer' || e === 'final' || e === 'hecha') {
    st.sesion = st.sesion || sesionNueva(p);
    marcarHecho(st.sesion, st.sesion.ejercicios.length, 0); st.sesion.vuelta.forEach(t => { t.hecho = true; });
    st.sesion.estado = 'hecha'; st.sesion.cierre = { esfuerzo: 4, comentario: p === 'victor' ? 'El press, muy bien. Las elevaciones, la última serie justa.' : 'La lumbar, bien. El bird dog me cuesta del lado izquierdo.' };
    const hoyDia = st.plan?.dias.find(d => d.d === D.HOY.diaSemana); if (hoyDia) hoyDia.estado = 'hecho';
  }
  if (e === 'lista' || e === 'leer') st.modo = 'lista';
  if (e === 'ayer') { // ayer (viernes) empezó una sesión y no la cerró
    st.ayer = sesionNueva(p); st.ayer.nombre = p === 'victor' ? 'Cuerpo completo en casa' : 'Core y movilidad, extra'; marcarHecho(st.ayer, 2, 0);
    const v = st.plan.dias.find(d => d.d === 5); if (v) v.estado = 'pendiente';
  }
  return st;
}
const persona = () => (S.p === 'victor' ? 'Víctor' : 'Virginia');
const diaHoy = () => S.plan?.dias.find(d => d.d === D.HOY.diaSemana);
const totalSeries = s => s.ejercicios.reduce((a, x) => a + x.sets.length, 0);
const hechasSeries = s => s.ejercicios.reduce((a, x) => a + x.sets.filter(z => z.hecha).length, 0);
const pasos = s => [{ k: 'calentamiento' }, ...s.ejercicios.map((_, i) => ({ k: 'ej', i })), { k: 'vuelta' }];
const pasoHecho = (s, q) => (q.k === 'ej' ? s.ejercicios[q.i].sets.every(z => z.hecha) : s[q.k].every(t => t.hecho));
const primerPendiente = s => { const P = pasos(s); const k = P.findIndex(q => !pasoHecho(s, q)); return k < 0 ? P.length - 1 : k; };

// ───────────────────────── avisos, anuncios y vibración ─────────────────────────
function aviso(titulo, texto = '', tipo = 'bien') {
  const a = document.createElement('div');
  a.className = `aviso aviso--${tipo} entra`;
  a.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  a.innerHTML = `${ico(tipo === 'error' ? 'error' : tipo === 'aviso' ? 'alerta' : tipo === 'info' ? 'info' : 'check')}<div class="aviso-texto"><b>${h(titulo)}</b>${texto ? `<p>${h(texto)}</p>` : ''}</div><button type="button" class="boton-icono boton-icono--sin-borde" data-act="cerrar-aviso" aria-label="Cerrar aviso">${ico('cerrar')}</button>`;
  $('#avisos').replaceChildren(a);
  if (tipo !== 'error') setTimeout(() => a.isConnected && a.remove(), 5000);
}
const anunciar = t => { $('#anuncio').textContent = ''; setTimeout(() => { $('#anuncio').textContent = t; }, 30); };
const vibrar = p => { if (CAPTURA) return; try { navigator.vibrate?.(p); } catch { /* sin vibración */ } };

// ───────────────────────── pantallas ─────────────────────────
const cabecera = () => `<header class="cab"><img src="logo.svg" alt="Pipos Fitness" width="160" height="28">${S.red ? '' : `<span class="red" role="status">${ico('sinred')}Sin conexión</span>`}</header>`;

function tiraSemana() {
  const dias = S.plan ? S.plan.dias : [];
  return `<ol class="semana" aria-label="Esta semana">${[1, 2, 3, 4, 5, 6, 7].map(i => {
    const d = dias.find(x => x.d === i); const esHoy = i === D.HOY.diaSemana;
    let cls = '', marca = `<span class="dia-c cifra">${D.FECHAS_SEMANA[i]}</span>`, txt = 'descanso';
    if (d?.estado === 'hecho') { cls = 'dia--hecha'; marca = `<span class="dia-c">${ico('check')}</span>`; txt = `${d.nombre}, hecho`; }
    else if (d?.estado === 'saltado') { cls = 'dia--perdida'; marca = `<span class="dia-c">${ico('cerrar')}</span>`; txt = `${d.nombre}, no hecho`; }
    else if (esHoy) { cls = 'dia--hoy'; txt = d ? `hoy, ${d.nombre}` : 'hoy, descanso'; }
    else if (d) { cls = 'dia--prevista'; txt = `${d.nombre}, previsto`; }
    return `<li class="dia ${cls}"><span class="dia-l" aria-hidden="true">${D.DIAS_CORTOS[i]}</span>${marca}<span class="solo-lector">${D.DIAS[i]} ${D.FECHAS_SEMANA[i]}: ${h(txt)}</span></li>`;
  }).join('')}</ol>`;
}

function tarjetaPlan() {
  const p = S.plan; if (!p) return '';
  const saltados = p.dias.filter(d => d.estado === 'saltado');
  const ETQ = { hecho: 'Hecho', hoy: 'Hoy', saltado: 'No hecho' };
  return `<section class="bloque" aria-labelledby="t-semana">
    <div class="bloque-fila"><h2 class="bloque-titulo" id="t-semana">Tu semana</h2><p>${p.fuente === 'ia' ? 'entrenador IA' : 'hecha por la app'}</p></div>
    <p class="pequeno texto-2 lectura">${h(p.resumen)}</p>
    ${saltados.length ? `<div class="aviso aviso--aviso" role="status">${ico('alerta')}<div class="aviso-texto"><b>No hiciste ${saltados.map(d => minus(D.DIAS[d.d])).join(' ni ')}</b><p>${h(saltados.map(d => d.nombre).join(', '))}.</p><div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="reorganizar">Reorganizar lo que queda</button></div></div><span></span></div>` : ''}
    <ul class="lista">${p.dias.map(d => `<li class="${d.estado === 'hecho' || d.estado === 'saltado' ? 'apagada' : ''}"><button type="button" class="fila" data-act="ver-dia" data-d="${d.d}">
      <span class="crece"><b>${D.DIAS[d.d]}: ${h(d.nombre)}</b><span>${LUGARES[d.lugar]}, ${d.ej} ejercicios, unos ${d.min} min</span></span>
      ${ETQ[d.estado] ? `<span class="estado-dia">${d.estado === 'hecho' ? ico('check') : ''}${ETQ[d.estado]}</span>` : ''}${ico('sig')}</button></li>`).join('')}</ul>
    <details class="tecnica"><summary>Por qué esta semana</summary><p class="tecnica-texto">${h(p.criterios)}</p><p class="tecnica-texto"><b>Progresión:</b> ${h(p.progresion)}</p></details>
    <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="plan">Cambiar días</button>${diaHoy() && diaHoy().estado === 'hoy' ? '<button type="button" class="boton boton--secundario" data-act="hoy-no">Hoy no puedo</button>' : ''}</div>
  </section>`;
}

function tarjetaConstancia() {
  if (S.primera) return '';
  const dias = S.plan ? S.plan.dias : []; const hechos = dias.filter(d => d.estado === 'hecho').length;
  const meta = dias.length || S.perfil.dias; const pr = D.PROGRESO[S.p];
  return `<section class="bloque tarjeta" aria-labelledby="t-const">
    <div class="bloque-fila"><div><h2 class="bloque-titulo" id="t-const">Constancia</h2><p class="texto-1"><b>${hechos} de ${meta}</b> días del plan esta semana</p></div>
      <p class="racha"><b class="cifra">${pr.racha}</b><span>semanas seguidas</span></p></div>
    <div class="puntos" aria-hidden="true">${Array.from({ length: meta }, (_, i) => `<i class="${i < hechos ? 'si' : ''}"></i>`).join('')}</div>
    <a class="boton boton--texto" href="#progreso">Ver progreso</a></section>`;
}

function vistaHoy() {
  const s = S.sesion, d = diaHoy(), sig = S.plan?.dias.find(x => x.d > D.HOY.diaSemana && x.estado !== 'hecho');
  let tarjeta = '', accion = '';
  if (S.primera) {
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">Primero</p><h2>Cuéntale a tu entrenador quién eres</h2>
      <p class="datos">Objetivos, nivel, lesiones, dónde entrenas y cuántos días puedes. Sin eso va a ciegas.</p></section>`;
    accion = `<a class="boton boton--ancho" href="#perfil" data-principal>Completar mi perfil</a>`;
  } else if (S.sinPlan) {
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">Esta semana</p><h2>¿Qué días puedes entrenar?</h2>
      <p class="datos">Dímelo y te monto la semana: calentamiento, ejercicios, rehabilitación y estiramientos de cada día. Cada día lo ajusto a cómo estés.</p>
      <p class="datos pequeno">La última vez: lunes, miércoles, viernes y sábado.</p>
      <button type="button" class="boton boton--secundario boton--ancho" data-act="hacer-mia">Hacer una de mis sesiones</button></section>`;
    accion = `<button type="button" class="boton boton--ancho" data-act="plan" data-principal>Montar mi semana</button>`;
  } else if (s && s.estado === 'hecha') {
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">${ico('check')} Hecha</p><h2>${h(s.nombre)}</h2>
      <p class="datos">${hechasSeries(s)} series en ${minus(LUGARES[s.lugar])}, esfuerzo ${s.cierre.esfuerzo} de 5.</p>
      ${sig ? `<p class="datos pequeno">Lo siguiente: ${minus(D.DIAS[sig.d])}, ${minus(sig.nombre)}.</p>` : '<p class="datos pequeno">Has hecho todo lo de esta semana.</p>'}
      <a class="boton boton--secundario boton--ancho" href="#sesion">Ver sesión</a></section>`;
  } else if (s) {
    const t = totalSeries(s), hh = hechasSeries(s);
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">${s.estado === 'en_curso' ? 'En marcha' : 'Lista'}: ${s.fuente === 'ia' ? 'entrenador IA' : 'ajustada por la app'}</p><h2>${h(s.nombre)}</h2>
      <p class="datos">${h(s.foco)}, ${s.ejercicios.length} ejercicios, ${minus(LUGARES[s.lugar])}.</p>
      ${hh ? `<div class="avance" role="img" aria-label="${hh} de ${t} series"><i data-v="${(hh / t).toFixed(3)}"></i></div><p class="meta">${hh} de ${t} series</p>` : ''}
      <p class="porque">${ico('ia')}<span>${h(s.explicacion[0])}</span></p></section>`;
    accion = `<a class="boton boton--ancho" href="#sesion" data-principal>${s.estado === 'en_curso' ? 'Seguir con la sesión' : 'Empezar'}</a>`;
  } else if (d && d.estado === 'hoy') {
    const ses = D.SESIONES[S.p];
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">Hoy toca</p><h2>${h(d.nombre)}</h2>
      <p class="datos">${LUGARES[d.lugar]}, ${d.ej} ejercicios, unos ${d.min} min. ${h(ses.foco)}.</p>
      <p class="porque">${ico('ia')}<span>${h(ses.explicacion[0])}</span></p></section>`;
    accion = `<button type="button" class="boton boton--ancho" data-act="checkin" data-principal>Empezar</button><p class="nota-accion">Antes te pregunto cómo estás y lo ajusto.</p>`;
  } else {
    tarjeta = `<section class="tarjeta hoy-tarjeta"><p class="etiqueta">Hoy</p><h2>Descanso</h2>
      <p class="datos">${sig ? `Lo siguiente: ${minus(D.DIAS[sig.d])}, ${minus(sig.nombre)}.` : 'Has hecho todo lo de esta semana.'} Descansar también es entrenar.</p>
      <button type="button" class="boton boton--secundario boton--ancho" data-act="checkin">Entrenar igualmente</button></section>`;
  }
  const ayer = S.ayer ? `<div class="aviso aviso--aviso bloque" role="status">${ico('alerta')}<div class="aviso-texto"><b>La sesión de ayer está sin cerrar</b><p>${h(S.ayer.nombre)}: ${hechasSeries(S.ayer)} de ${totalSeries(S.ayer)} series. Ciérrala para que cuente en tu semana y el entrenador lo sepa.</p>
    <div class="aviso-acciones"><button type="button" class="boton" data-act="cerrar-ayer">Cerrar la de ayer</button><button type="button" class="boton boton--secundario" data-act="descartar-ayer">Descartarla</button></div></div><span></span></div>` : '';
  const red = S.red ? '' : `<div class="aviso bloque" role="status">${ico('sinred')}<div class="aviso-texto"><b>Sin conexión</b><p>Tu sesión de hoy funciona entera. Lo que necesita al entrenador IA espera a que vuelva la red.</p></div><span></span></div>`;
  document.body.classList.toggle('sin-accion', !accion);
  return `${cabecera()}
    <header class="saludo"><p>${D.HOY.texto}</p><h1>Hola, ${persona()}</h1></header>
    ${S.plan && !S.primera ? `<section class="bloque" aria-label="Esta semana">${tiraSemana()}</section>` : ''}
    ${ayer}${red}
    <div class="bloque">${tarjeta}</div>
    ${tarjetaConstancia()}
    ${S.primera || S.sinPlan ? '' : tarjetaPlan()}
    <p class="bloque meta">Llevas 4 sesiones sin guardar una copia. Tus datos solo están en este móvil. <a href="#perfil" data-act="ir-grupo" data-g="ajustes">Guardar copia</a></p>
    ${accion ? `<div class="accion">${accion}</div>` : ''}`;
}

// ---------- Check-in («Antes de empezar»): formulario en su propia pantalla ----------
function nuevoCi() {
  const d = diaHoy() || S.plan?.dias.find(x => x.d > D.HOY.diaSemana && x.estado !== 'hecho');
  return { mia: null, ocupar: true, lugar: d ? d.lugar : S.perfil.lugares[0], minutos: d ? d.min : S.perfil.minutos, energia: 3,
    dolor: Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, l.dolor])), alarma: false, peticion: '', forzarIA: false, dia: d };
}
function previa(ci) {
  const cambios = []; const ses = D.SESIONES[S.p];
  const mia = ci.mia && S.perfil.mias.find(m => m.id === ci.mia);
  const base = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, l.dolor]));
  let nEj = mia ? mia.ej.length : ses.ejercicios.length, min = mia ? mia.minutos + 15 : ci.minutos;
  const maxDolor = Math.max(0, ...Object.values(ci.dolor));
  if (maxDolor >= 7) cambios.push('Con dolor de 7 o más toca la sesión suave del día de dolor alto: movilidad, rehabilitación y cardio suave.');
  else {
    for (const [z, v] of Object.entries(ci.dolor)) {
      if (base[z] == null && v >= 1) cambios.push(`Dolor nuevo en ${minus(D.ZONAS[z][1])} (${v}/10): lo trato como una lesión reciente, sin nada que lo cargue.`);
      else if (base[z] != null && v >= base[z] + 2) cambios.push(`Tu ${minus(D.ZONAS[z][1])} está peor que de costumbre (${v}/10 frente a ${base[z]}/10): más rehabilitación y nada que la cargue.`);
    }
    if (ci.energia <= 2) { cambios.push('Energía baja: una serie menos en los ejercicios principales.'); }
    if (ci.energia === 5) cambios.push(`Energía a tope: una serie más de ${minus(ex(ses.ejercicios[0].id).n)}.`);
    if (!mia && ci.dia && ci.lugar !== ci.dia.lugar) cambios.push(`En ${minus(LUGARES[ci.lugar])} cambio lo que necesita máquinas por ejercicios con lo que hay allí.`);
    if (!mia && ci.dia && ci.minutos < ci.dia.min) { cambios.push(`Con ${ci.minutos} min quito ${minus(ex(ses.ejercicios[ses.ejercicios.length - 3].id).n)} y acorto el cardio.`); nEj -= 1; }
    if (!mia && ci.dia && ci.minutos > ci.dia.min + 10) { cambios.push('Con más tiempo añado un ejercicio de lo que menos has trabajado esta semana.'); nEj += 1; }
  }
  if (ci.peticion.trim()) cambios.push(`Tu petición: «${ci.peticion.trim()}».`);
  const usar = !mia && S.red && (ci.peticion.trim() || Object.keys(ci.dolor).some(z => base[z] == null && ci.dolor[z] >= 1) || (ci.dia && ci.lugar !== ci.dia.lugar));
  const motivo = !S.red ? 'Sin conexión: lo ajusta la app con sus reglas.' : mia ? 'Tu sesión se ajusta con las reglas de la app.' : usar ? 'Lo revisa el entrenador IA: hay algo nuevo que tener en cuenta.' : 'Lo ajusta la app con sus reglas: no ha cambiado nada que necesite al entrenador IA.';
  return { cambios, nEj, min, usar: usar || (ci.forzarIA && S.red && !mia), motivo, mia };
}
function htmlPrevia(ci) {
  const pv = previa(ci);
  return `<section class="previa" id="previa" aria-live="polite" aria-labelledby="t-previa">
    <h2 id="t-previa">Con lo que me dices</h2>
    ${pv.cambios.length ? `<ul>${pv.cambios.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : `<p>${pv.mia ? 'Nada cambia: haces tu sesión tal como la guardaste.' : 'Nada cambia: haces el día tal como estaba previsto.'}</p>`}
    <p>${pv.nEj} ejercicios, unos ${pv.min} min con calentamiento y estiramientos.</p>
    <p class="porque">${ico('ia')}<span>${h(ci.forzarIA && S.red ? 'Se lo pides al entrenador IA.' : pv.motivo)}</span></p>
    ${S.red && !previa({ ...ci, forzarIA: false }).usar && !pv.mia ? `<div class="chips"><button type="button" class="chip" aria-pressed="${ci.forzarIA}" data-act="ci-ia">${ico('check')}Pedírsela igualmente al entrenador IA</button></div>` : ''}
  </section>`;
}
function vistaCheckin() {
  const ci = S.ci || (S.ci = nuevoCi());
  const d = ci.dia, mia = ci.mia && S.perfil.mias.find(m => m.id === ci.mia);
  const zonas = Object.keys(ci.dolor); const otras = Object.keys(D.ZONAS).filter(z => !zonas.includes(z));
  const seg = (nombre, act, opciones, actual) => `<div class="segmento" role="radiogroup" aria-label="${h(nombre)}">${opciones.map(([v, t]) => `<button type="button" role="radio" aria-checked="${String(v) === String(actual)}" tabindex="${String(v) === String(actual) ? 0 : -1}" data-act="${act}" data-v="${v}">${h(t)}</button>`).join('')}</div>`;
  document.body.classList.add('sin-nav');
  return `<header class="cab-sesion"><a class="boton-icono" href="#hoy" aria-label="Volver a Hoy">${ico('atras')}</a><div><h1 tabindex="-1">Antes de empezar</h1></div></header>
    <p class="texto-2 lectura">${mia ? `Haces <b>${h(mia.nombre)}</b>${d && ci.ocupar ? `, que cuenta como el día «${h(d.nombre)}» de tu plan` : ''}. Dime cómo estás y la ajusto a hoy.` : d ? `Toca <b>${h(d.nombre)}</b> en ${minus(LUGARES[d.lugar])}. Dime cómo estás y lo ajusto.` : 'Hoy no hay día en tu plan. Te preparo una sesión con lo que te falta esta semana.'}</p>
    <form class="bloque" data-form="checkin" novalidate>
      <div class="grupo"><p class="grupo-et" id="g-que">Qué sesión</p><div class="chips" role="group" aria-labelledby="g-que">
        <button type="button" class="chip" aria-pressed="${!mia}" data-act="ci-mia" data-v="">${ico('check')}${d ? 'La de mi plan' : 'La que me prepares'}</button>
        ${S.perfil.mias.map(m => `<button type="button" class="chip" aria-pressed="${mia?.id === m.id}" data-act="ci-mia" data-v="${m.id}">${ico('check')}${h(m.nombre)}</button>`).join('')}</div>
        ${mia && d ? `<div class="chips"><button type="button" class="chip" aria-pressed="${ci.ocupar}" data-act="ci-ocupar">${ico('check')}Cuenta como el día «${h(d.nombre)}» del plan</button></div>` : ''}</div>
      <div class="grupo"><p class="grupo-et" id="g-lugar">Dónde</p>${seg('Dónde', 'ci-lugar', S.perfil.lugares.map(l => [l, LUGARES[l]]), ci.lugar)}</div>
      <div class="grupo"><p class="grupo-et">Tiempo <small>minutos</small></p>${seg('Tiempo en minutos', 'ci-min', [30, 45, 60, 75, 90].map(m => [m, String(m)]), ci.minutos)}</div>
      <div class="grupo"><p class="grupo-et">Energía: <b>${D.ENERGIA[ci.energia]}</b></p>${seg('Energía', 'ci-energia', [1, 2, 3, 4, 5].map(n => [n, String(n)]), ci.energia)}</div>
      ${zonas.map(z => `<div class="grupo">${selectorHtml({ id: `ci-dolor-${z}`, et: `Dolor hoy en ${minus(D.ZONAS[z][1])}`, valor: ci.dolor[z], min: 0, max: 10, paso: 1, unidad: 'de 10', act: 'ci-dolor', z })}</div>`).join('')}
      <div class="grupo"><p class="grupo-et" id="g-mas">¿Te duele algo más?</p><div class="chips" role="group" aria-labelledby="g-mas">${otras.map(z => `<button type="button" class="chip" aria-pressed="false" data-act="ci-zona" data-v="${z}">${ico('check')}${D.ZONAS[z][1]}</button>`).join('')}</div></div>
      <div class="grupo"><div class="chips"><button type="button" class="chip" aria-pressed="${ci.alarma}" data-act="ci-alarma">${ico('check')}Hoy noto algo de esto</button></div>
        <details class="tecnica"><summary>Qué cuenta</summary><ul class="tecnica-texto">${D.SEÑALES.map(t => `<li>${h(t)}</li>`).join('')}</ul></details></div>
      ${mia ? '' : `<div class="campo"><label for="ci-peticion">Algo que pedir <small>opcional</small></label><input id="ci-peticion" value="${h(ci.peticion)}" placeholder="hoy solo tren superior, la prensa está ocupada…" autocomplete="off"></div>`}
      ${htmlPrevia(ci)}
    </form>
    <div class="accion"><button type="button" class="boton boton--ancho" data-act="preparar" data-principal>${ci.alarma ? 'Hoy no entreno' : mia ? `Preparar «${h(mia.nombre)}»` : 'Preparar mi sesión'}</button></div>`;
}

// Selector ± del sistema (valor como spinbutton; sin teclado del móvil).
function selectorHtml({ id, et, valor, min, max, paso, unidad, act, z = '', e = '', s = '' }) {
  return `<div class="selector" data-selector data-act-val="${act}" data-min="${min}" data-max="${max}" data-incremento="${paso}" data-z="${z}" data-e="${e}" data-s="${s}">
    <span class="selector-et" id="${id}-et">${h(et)}</span>
    <div class="selector-valor" role="spinbutton" tabindex="0" aria-labelledby="${id}-et" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${valor}" aria-valuetext="${num(valor)} ${h(unidad)}"><b data-cifra>${num(valor)}</b><span>${h(unidad)}</span></div>
    <div class="selector-pasos"><button type="button" data-paso="-1" aria-label="Menos ${num(paso)} ${h(unidad)}" aria-disabled="${valor <= min}">${ico('menos')}</button><button type="button" data-paso="1" aria-label="Más ${num(paso)} ${h(unidad)}" aria-disabled="${valor >= max}">${ico('mas')}</button></div>
  </div>`;
}

// ---------- Sesión ----------
function filaSerie(s, x, i, j, actual) {
  const z = x.sets[j], kg = conKg(x), t = porTiempo(x);
  if (actual && s.estado !== 'hecha') {
    const r = rango(x.reps);
    const kgVal = z.kg ?? x.kg ?? 0; const repVal = z.valor != null ? +z.valor : r ? r.lo : 10;
    const etTiempo = t ? (t.u === 'min' ? `${t.hi / 60} min` : t.lo === t.hi ? `${t.hi} s` : `${t.lo}-${t.hi} s`) : '';
    return `<li class="serie serie--actual" aria-current="step" data-actual>
      <p class="selector-et">Serie <span class="cifra">${j + 1}</span> de ${x.sets.length}${t && t.lados > 1 ? ', cada lado' : ''}</p>
      ${t ? `<p class="serie-tiempo"><b data-cifra>${etTiempo}</b><span>objetivo${t.u === 'min' ? '' : ''}</span></p>
        <button type="button" class="boton" data-act="contador" data-e="${i}" data-s="${j}" data-principal>${ico('play')}Empezar ${etTiempo}</button>`
      : `<div class="selectores">${kg ? selectorHtml({ id: `kg-${i}-${j}`, et: 'Kilos', valor: kgVal, min: 0, max: 300, paso: 2.5, unidad: 'kg', act: 'serie-kg', e: i, s: j }) : ''}
        ${selectorHtml({ id: `rep-${i}-${j}`, et: unidad(x) === 'm' ? 'Metros' : 'Repeticiones', valor: repVal, min: 1, max: unidad(x) === 'm' ? 2000 : 50, paso: unidad(x) === 'm' ? 25 : 1, unidad: unidad(x) === 'm' ? 'm' : 'reps', act: 'serie-rep', e: i, s: j })}</div>
        <button type="button" class="boton" data-act="serie-hecha" data-e="${i}" data-s="${j}" data-principal>Serie ${j + 1} hecha</button>`}
    </li>`;
  }
  const valor = z.hecha ? `${kg && z.kg != null ? `${num(z.kg)} kg × ` : ''}${z.valor}${t ? ' s' : unidad(x) === 'm' ? ' m' : ''}` : 'Pendiente';
  return `<li class="serie ${z.hecha ? (s.estado === 'hecha' ? 'serie--lectura' : 'serie--hecha') : 'serie--pendiente'}${S.recien === `${i}-${j}` ? ' serie--recien' : ''}">
    <span class="serie-n cifra">${j + 1}</span><span class="serie-valor cifra">${valor}</span>
    ${z.hecha ? `<span class="serie-estado">${ico('check')}Hecha</span>` : '<span></span>'}</li>`;
}
function tarjetaEjercicio(s, x, i) {
  const e = ex(x.id); const actualJ = x.sets.findIndex(z => !z.hecha);
  const nuevo = !x.ultima;
  const ROL = { rehab: 'Rehabilitación', cardio: 'Cardio' };
  return `<article class="tarjeta sesion-ej ${actualJ >= 0 && s.estado !== 'hecha' ? 'tarjeta--actual' : ''}" aria-labelledby="ej-${i}">
    <div class="ejercicio-cab"><div><h2 id="ej-${i}">${h(e.n)}</h2>
      <p>${ROL[x.rol] ? `<span class="insignia">${ROL[x.rol]}</span>` : ''}${x.series} × ${h(textoReps(x))}${x.kg != null && conKg(x) ? `, ${num(x.kg)} kg` : ''}${x.descanso ? `, descanso ${mmss(x.descanso)}` : ''}</p></div>
      <button type="button" class="boton-icono" data-act="menu-ej" data-e="${i}" aria-label="Más opciones de ${h(e.n)}">${ico('lista')}</button></div>
    ${x.ultima ? `<p class="ultima">La última vez: <span class="cifra">${h(x.ultima)}</span></p>` : ''}
    ${x.nota ? `<p class="nota-ej">${h(x.nota)}</p>` : ''}
    <ol class="series">${x.sets.map((_, j) => filaSerie(s, x, i, j, j === actualJ)).join('')}</ol>
    <details class="tecnica" ${nuevo && s.estado !== 'hecha' ? 'open' : ''}><summary>Cómo se hace${nuevo ? ' <span class="insignia">Nuevo para ti</span>' : ''}</summary>
      <ol class="tecnica-texto">${e.p.map(t => `<li>${h(t)}</li>`).join('')}</ol>
      <button type="button" class="boton boton--texto" data-act="ficha" data-id="${x.id}">Ver la ficha completa</button></details>
  </article>`;
}
function tareas(s, k, titulo) {
  const l = s[k]; const hh = l.filter(t => t.hecho).length;
  return `<section class="tarjeta" aria-labelledby="t-${k}"><div class="bloque-fila"><h2 class="tarjeta-nombre" id="t-${k}">${titulo}</h2><p>${hh} de ${l.length}</p></div>
    <ul class="tareas">${l.map((t, i) => `<li class="${t.hecho ? 'hecho' : ''}"><button type="button" class="boton-icono" aria-pressed="${t.hecho}" data-act="tarea" data-k="${k}" data-i="${i}" aria-label="${h(t.nombre)}: hecho">${t.hecho ? ico('check') : ''}</button>
      <div><b>${h(t.nombre)}</b>${t.duracion ? `<span class="dur cifra">${h(t.duracion)}</span>` : ''}${t.detalle ? `<p>${h(t.detalle)}</p>` : ''}</div></li>`).join('')}</ul></section>`;
}
function notaFallo(s) {
  if (!s.iaFallo || s.estado === 'hecha') return '';
  const tocada = hechasSeries(s) > 0;
  return `<div class="aviso aviso--aviso" role="note">${ico('alerta')}<div class="aviso-texto"><b>La ha hecho la app</b><p>Porque ${h(s.iaFallo.motivo)}.${s.iaFallo.peticion ? ` No he podido atender lo que pediste: «${h(s.iaFallo.peticion)}».` : ''}</p>
    ${!tocada ? (S.red ? '<div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="reintentar-ia">Reintentar con IA</button></div>' : '<p>Cuando tengas conexión podrás reintentarlo con la IA.</p>') : ''}</div><span></span></div>`;
}
function vistaSesion() {
  const s = S.sesion;
  if (!s) { return `${cabecera()}<section class="bloque vacio"><h1 tabindex="-1">Aún no hay sesión de hoy</h1><p>Prepárala desde Hoy: antes te pregunto cómo estás.</p><a class="boton" href="#hoy">Ir a Hoy</a></section>`; }
  document.body.classList.add('sin-nav');
  const abierta = s.estado !== 'hecha';
  const t = totalSeries(s), hh = hechasSeries(s);
  const foco = S.modo === 'foco' && abierta;
  if (S.paso == null) S.paso = primerPendiente(s);
  const cab = `<header class="cab-sesion"><a class="boton-icono" href="#hoy" aria-label="Volver a Hoy">${ico('atras')}</a>
      <div><h1 tabindex="-1">${h(s.nombre)}</h1><p>${LUGARES[s.lugar]}, <span class="cifra">${hh} de ${t}</span> series${abierta ? '' : ', hecha'}</p></div>
      ${abierta ? '<button type="button" class="boton boton--secundario" data-act="terminar">Terminar</button>' : ''}</header>
    <div class="avance" role="img" aria-label="${hh} de ${t} series"><i data-v="${(hh / t).toFixed(3)}"></i></div>
    ${abierta ? `<div class="segmento segmento--ancho modo" role="radiogroup" aria-label="Cómo ver la sesión"><button type="button" role="radio" aria-checked="${foco}" tabindex="${foco ? 0 : -1}" data-act="modo" data-v="foco">Uno a uno</button><button type="button" role="radio" aria-checked="${!foco}" tabindex="${foco ? -1 : 0}" data-act="modo" data-v="lista">Toda la sesión</button></div>` : ''}`;
  const porque = `<section class="tarjeta" aria-label="Por qué esta sesión">${notaFallo(s)}<p class="porque">${ico('ia')}<span>${h(s.explicacion[0])}</span></p>
    <details class="tecnica"><summary>Por qué cada decisión</summary><ul class="tecnica-texto">${s.explicacion.slice(1).map(x => `<li>${h(x)}</li>`).join('')}</ul></details></section>`;
  const pieMia = s.origenMia ? `<p class="meta centro">De tus sesiones: «${h(s.origenMia)}»</p>` : `<button type="button" class="boton boton--texto centro" data-act="guardar-mia">${ico('mas')}Guardar como mía para repetirla</button>`;
  if (foco) {
    const P = pasos(s), k = Math.min(S.paso, P.length - 1), q = P[k];
    const nombre = r => (r.k === 'calentamiento' ? 'C' : r.k === 'vuelta' ? 'V' : String(r.i + 1));
    const etq = r => (r.k === 'ej' ? `Ejercicio ${r.i + 1}: ${ex(s.ejercicios[r.i].id).n}` : r.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma');
    const tira = `<nav class="pasos-sesion" aria-label="Partes de la sesión">${P.map((r, n) => `<button type="button" data-act="ir-paso" data-v="${n}" class="${pasoHecho(s, r) ? 'hecho' : ''}" aria-label="${h(etq(r))}${pasoHecho(s, r) ? ', hecho' : ''}" ${n === k ? 'aria-current="step"' : ''}>${pasoHecho(s, r) && n !== k ? ico('check') : nombre(r)}</button>`).join('')}</nav>`;
    const cuerpo = q.k === 'ej' ? tarjetaEjercicio(s, s.ejercicios[q.i], q.i) : tareas(s, q.k, q.k === 'calentamiento' ? 'Calentamiento' : 'Vuelta a la calma');
    const ultimo = k === P.length - 1;
    return `<div class="vista-sesion">${cab}${tira}${cuerpo}
      ${k === 0 ? `<div class="bloque">${porque}</div><div class="bloque-mini">${pieMia}</div>` : ''}
      <div class="navega"><button type="button" class="boton boton--secundario" data-act="paso" data-v="-1" ${k === 0 ? 'aria-disabled="true"' : ''}>${ico('atras')}Anterior</button>
      ${ultimo ? '<button type="button" class="boton" data-act="terminar">Terminar</button>' : `<button type="button" class="boton boton--secundario" data-act="paso" data-v="1">Siguiente${ico('sig')}</button>`}</div>
      </div>`;
  }
  return `${cab}<div class="sesion-lista">${porque}${tareas(s, 'calentamiento', 'Calentamiento')}
    ${s.ejercicios.map((x, i) => (abierta && x.sets.every(z => z.hecha) ? `<details class="tarjeta plegada"><summary>${ico('check')}<span><b>${h(ex(x.id).n)}</b><small class="cifra">${x.sets.map(z => (conKg(x) && z.kg != null ? `${num(z.kg)}×` : '') + z.valor).join(', ')}</small></span></summary>${tarjetaEjercicio(s, x, i)}</details>` : tarjetaEjercicio(s, x, i))).join('')}
    ${tareas(s, 'vuelta', 'Vuelta a la calma')}
    ${abierta ? `${pieMia}<button type="button" class="boton boton--ancho" data-act="terminar" data-principal>Terminar sesión</button><button type="button" class="boton boton--texto centro" data-act="descartar">Descartar esta sesión</button>`
    : `<section class="tarjeta"><h2 class="tarjeta-nombre">Cierre</h2><p>Esfuerzo ${s.cierre.esfuerzo} de 5</p><p class="texto-2">«${h(s.cierre.comentario)}»</p></section>${pieMia}`}</div>`;
}

// ---------- Progreso ----------
function vistaProgreso() {
  const pr = D.PROGRESO[S.p]; const p = S.perfil;
  if (S.progreso === 'vacio') {
    return `${cabecera()}<h1 class="titulo-pantalla" tabindex="-1">Progreso</h1>
      <section class="tarjeta vacio"><h2 class="tarjeta-nombre">Tu progreso empieza con tu primera sesión</h2><p>Aquí verás tu constancia semana a semana, cómo sube tu fuerza en cada ejercicio, tus medidas y cómo evoluciona el dolor.</p>
      <div class="fila-botones"><a class="boton" href="#hoy">Ir a Hoy</a><button type="button" class="boton boton--secundario" data-act="medidas">${ico('mas')}Apuntar mis medidas de hoy</button></div></section>`;
  }
  const semana1 = S.progreso === 'semana';
  const constancia = semana1
    ? `<section class="bloque tarjeta" aria-labelledby="t-c"><h2 class="bloque-titulo" id="t-c">Constancia</h2><p><b>1 de 4</b> sesiones esta semana. Es tu primera semana: aquí verás cada semana cómo vas.</p>
       <ul class="datos-lista"><li><span>Sesiones en total</span><b class="cifra">1</b></li></ul></section>`
    : `<section class="bloque tarjeta" aria-labelledby="t-c"><h2 class="bloque-titulo" id="t-c">Constancia</h2>
       <p>${pr.racha} semanas seguidas con al menos 3 sesiones.</p>
       ${vasos({ titulo: 'Últimas 8 semanas', semanas: pr.semanas8, etiquetas: pr.etiquetas8 })}
       ${barras({ titulo: 'Sesiones por mes, último año', cifra: String(pr.total), cifraTexto: 'sesiones en el año', unidad: 'sesiones', valores: pr.sesionesMes, etiquetas: pr.meses, max: 16, cab: 'Mes', ancho: 320 })}
       <ul class="datos-lista"><li><span>Últimas 4 semanas</span><b class="cifra">${pr.cumplimiento} % de lo previsto</b></li><li><span>Sesiones en total</span><b class="cifra">${pr.total}</b></li></ul>
       <h3 class="bloque-titulo bloque">Tu nivel: ${NIVELES[p.nivel]}</h3>
       <p class="pequeno texto-2">Tu entrenador lo sube o lo baja según tu constancia y tu progreso. Para ${minus(NIVELES[p.nivel + 1] || 'mantenerlo')}:</p>
       <ul class="criterios">${p.criterios.map(([q, ok, v]) => `<li class="${ok ? 'ok' : ''}">${ico(ok ? 'check' : 'info')}<span>${h(q)}</span><span>${h(v)}</span></li>`).join('')}</ul></section>`;
  const f0 = pr.fuerza[0];
  const fuerza = semana1
    ? `<section class="bloque tarjeta"><h2 class="bloque-titulo">Fuerza</h2><p class="texto-2">Repite un ejercicio con kilos para ver la comparación. Cuando apuntes los kilos de tus series verás aquí cómo sube tu fuerza en cada ejercicio.</p></section>`
    : `<section class="bloque tarjeta" aria-labelledby="t-f"><h2 class="bloque-titulo" id="t-f">Fuerza</h2>
       <p class="dato-grande"><b class="cifra">+${pr.fuerzaMediana} %</b><span>de fuerza en 12 semanas, mediana de ${pr.fuerza.length} ejercicios, ${pr.records} récords en la última vez</span></p>
       ${linea({ titulo: `${ex(f0[0]).n}: mejor serie de cada mes`, unidad: 'kg', valores: f0[5], etiquetas: pr.meses, cab: 'Mes', paso: 2.5 })}
       <ul class="lista">${pr.fuerza.map(([id, veces, kg, cambio, record]) => `<li><button type="button" class="fila" data-act="hoja-ej-prog" data-id="${id}"><span class="crece"><b>${h(ex(id).n)}</b><span>${veces} veces${kg ? `, último ${num(kg)} kg` : ''}${record ? ', récord' : ''}</span></span>${cambio ? `<span class="insignia insignia--bien cifra">+${cambio} %</span>` : ''}${ico('sig')}</button></li>`).join('')}</ul>
       <p class="meta">Se compara el 1RM estimado (fórmula de Epley con tus kilos y repeticiones) de la primera y la última vez dentro de las 12 semanas.</p></section>`;
  const altura = p.datos.altura / 100; const ich = (pr.cintura.at(-1) / p.datos.altura);
  const salud = `<section class="bloque tarjeta" aria-labelledby="t-s"><h2 class="bloque-titulo" id="t-s">Salud</h2>
    ${semana1 ? '<p class="texto-2">Apunta peso y cintura cada una o dos semanas, por la mañana y en ayunas. Con eso se ve si la comida y el entrenamiento van en la dirección de tus objetivos.</p>'
      : `<div class="multiples">${linea({ titulo: 'Peso', cifra: num(pr.peso.at(-1)), cifraTexto: `kg, ${num(pr.peso.at(-1) - pr.peso[0])} en un año`, unidad: 'kg', valores: pr.peso, etiquetas: pr.meses, cab: 'Mes', paso: 1, ancho: 160 })}${linea({ titulo: 'Cintura', cifra: num(pr.cintura.at(-1)), cifraTexto: `cm, ${num(pr.cintura.at(-1) - pr.cintura[0])} en un año`, unidad: 'cm', valores: pr.cintura, etiquetas: pr.meses, cab: 'Mes', paso: 1, ancho: 160 })}</div>
      <ul class="datos-lista"><li><span>Cintura / altura</span><b class="cifra">${num(Math.round(ich * 100) / 100)} <span class="insignia insignia--bien">saludable</span></b></li></ul>`}
    <div class="bloque-fila bloque"><span class="pequeno">Cardio, últimos 7 días</span><b class="cifra pequeno">${semana1 ? 20 : pr.cardio} de 150 min</b></div>
    <div class="barra-cardio" role="img" aria-label="${semana1 ? 20 : pr.cardio} de 150 minutos"><i data-v="${Math.min(1, (semana1 ? 20 : pr.cardio) / 150).toFixed(3)}"></i></div>
    <p class="meta">La OMS recomienda al menos 150 minutos a la semana de actividad moderada. Cuentan los ejercicios de cardio y la natación apuntados en tus sesiones.</p>
    <button type="button" class="boton boton--secundario" data-act="medidas">${ico('mas')}Apuntar medidas</button></section>`;
  const dolor = !semana1 && pr.dolor.length ? `<section class="bloque tarjeta" aria-labelledby="t-d"><h2 class="bloque-titulo" id="t-d">Dolor</h2>
    ${pr.dolor.map(([z, v, tend]) => `${barras({ titulo: `${D.ZONAS[z][1]}: ${tend === 'baja' ? 'baja' : tend}`, cifra: String(v.at(-1)), cifraTexto: 'de 10 ahora', unidad: 'de 10', valores: v, etiquetas: pr.meses, cab: 'Mes', ancho: 320 })}`).join('')}
    <p class="meta">De 0 a 10, media de cada mes al terminar las sesiones. 2 sesiones en las que subió 2 puntos o más; coincide con peso muerto rumano (2 de 3 veces). Tu entrenador lo tiene en cuenta.</p></section>` : '';
  const hist = D.HISTORIAL[S.p];
  const ultimas = `<section class="bloque" aria-labelledby="t-u"><h2 class="bloque-titulo" id="t-u">Últimas sesiones</h2><ul class="lista">${(semana1 ? hist.slice(0, 1) : hist).map(([n, f, l, esf]) => `<li><a class="fila" href="?p=${S.p}&amp;e=leer#sesion"><span class="crece"><b>${h(n)}</b><span>${f}, ${minus(LUGARES[l])}, esfuerzo ${esf} de 5</span></span>${ico('sig')}</a></li>`).join('')}</ul></section>`;
  void altura;
  return `${cabecera()}<h1 class="titulo-pantalla" tabindex="-1">Progreso</h1>${constancia}${fuerza}${salud}${dolor}${ultimas}`;
}

// ---------- Perfil ----------
const GRUPOS = [['objetivos', 'Objetivos y nivel'], ['lesiones', 'Lesiones'], ['salud', 'Salud'], ['entreno', 'Mi entreno'], ['datos', 'Mis datos'], ['copias', 'Copias'], ['ajustes', 'Ajustes']];
const chip = (act, v, on, txt, extra = '') => `<button type="button" class="chip" aria-pressed="${on}" data-act="${act}" data-v="${h(v)}" ${extra}>${ico('check')}${h(txt)}</button>`;
function vistaPerfil() {
  const p = S.perfil; const g = S.grupo;
  const secc = {
    objetivos: () => `<section class="tarjeta perfil-sec"><h2>Objetivos <small>puedes marcar varios</small></h2><div class="chips">${Object.entries(D.OBJETIVOS).map(([k, n]) => chip('objetivo', k, p.objetivos.includes(k), n)).join('')}</div></section>
      <section class="tarjeta perfil-sec"><h2>Nivel</h2><div class="segmento segmento--ancho" role="radiogroup" aria-label="Nivel">${Object.entries(NIVELES).map(([k, n]) => `<button type="button" role="radio" aria-checked="${+k === p.nivel}" tabindex="${+k === p.nivel ? 0 : -1}" data-act="nivel" data-v="${k}">${n}</button>`).join('')}</div>
        <div class="chips bloque-mini">${chip('nivel-auto', '', p.nivelAuto, 'Que mi progreso me cambie de nivel')}</div>
        <p class="ayuda">Para subir a ${minus(NIVELES[p.nivel + 1] || NIVELES[3])}:</p><ul class="criterios">${p.criterios.map(([q, ok, v]) => `<li class="${ok ? 'ok' : ''}">${ico(ok ? 'check' : 'info')}<span>${h(q)}</span><span>${h(v)}</span></li>`).join('')}</ul></section>`,
    lesiones: () => `<section class="tarjeta perfil-sec"><h2>Lesiones y dolor</h2><p>Cambian con el tiempo: apúntalas, ajusta el dolor y desmárcalas cuando se curen. El entrenador quita lo que las carga y añade rehabilitación.</p>
      ${p.lesiones.length ? `<ul class="lista">${p.lesiones.map(l => `<li class="${l.activa ? '' : 'apagada'}"><button type="button" class="fila" data-act="lesion" data-id="${l.id}"><span class="crece"><b>${h(D.ZONAS[l.zona][0])}</b><span>${l.activa ? `Dolor ${l.dolor} de 10` : 'Curada'}, ${minus(D.TIPOS_LESION[l.tipo])}${l.desde ? `, desde ${h(fechaCorta(l.desde))}` : ''}</span></span>${ico('editar')}</button></li>`).join('')}</ul>` : '<p class="texto-2">Sin lesiones apuntadas.</p>'}
      <button type="button" class="boton boton--secundario" data-act="lesion">${ico('mas')}Añadir lesión o dolor</button></section>`,
    salud: () => `<section class="tarjeta perfil-sec"><h2>Salud</h2>${D.T1.map(t => `<p>${h(t)}</p>`).join('')}
      <div class="aviso" role="note">${ico('info')}<div class="aviso-texto"><b>Es opcional</b><p>Se guarda en este móvil y en tu copia privada. Al entrenador IA solo le llegan como etiquetas (por ejemplo «tensión alta controlada»), nunca lo que escribas.</p></div><span></span></div>
      <div class="chips bloque-mini">${Object.entries(D.CAMPOS_SALUD).map(([k, n]) => chip('salud', k, !!p.salud[k], n)).join('')}</div>
      <p class="grupo-et bloque-mini">Medicación</p><div class="chips">${Object.entries(D.MEDICACION).map(([k, n]) => chip('medicacion', k, !!(p.salud.medicacion || []).includes(k), n)).join('')}</div></section>`,
    entreno: () => `<section class="tarjeta perfil-sec"><h2>Disponibilidad habitual</h2><p>Cada semana eliges los días al montar la semana; esto es lo habitual.</p>
        <div class="grupo bloque-mini">${selectorHtml({ id: 'p-dias', et: 'Días por semana', valor: p.dias, min: 1, max: 7, paso: 1, unidad: 'días', act: 'perfil-dias' })}</div>
        <div class="grupo"><p class="grupo-et">Minutos por sesión</p><div class="segmento" role="radiogroup" aria-label="Minutos por sesión">${[30, 45, 60, 75, 90].map(m => `<button type="button" role="radio" aria-checked="${p.minutos === m}" tabindex="${p.minutos === m ? 0 : -1}" data-act="perfil-min" data-v="${m}">${m}</button>`).join('')}</div></div></section>
      <section class="tarjeta perfil-sec"><h2>Dónde entrenas</h2><div class="chips">${Object.entries(LUGARES).map(([k, n]) => chip('lugar', k, p.lugares.includes(k), n)).join('')}</div>
        ${p.lugares.includes('casa') ? `<p class="grupo-et bloque-mini">Material que tienes ahora en casa</p><div class="chips">${D.MATERIAL_CASA.map(m => chip('material', m, p.materialCasa.includes(m), MATERIAL[m])).join('')}</div>` : ''}
        <div class="chips bloque-mini">${chip('acompanado', '', p.acompañado, 'Entreno a la vez que otra persona')}${p.lugares.includes('piscina') ? chip('nadar25', '', p.nadar25, 'Sé nadar 2 × 25 m seguidos') : ''}</div></section>
      <section class="tarjeta perfil-sec"><h2>Mis sesiones <small>${p.mias.length} de 30</small></h2>
        ${p.mias.length ? `<ul class="lista">${p.mias.map(m => `<li><button type="button" class="fila" data-act="mia" data-id="${m.id}"><span class="crece"><b>${h(m.nombre)}</b><span>${m.ej.length} ejercicios, ${minus(LUGARES[m.lugar])}</span></span>${ico('editar')}</button></li>`).join('')}</ul><p class="ayuda">Para repetir una, elígela en «Antes de empezar».</p>` : '<p>Al preparar o terminar una sesión, toca «Guardar como mía» y podrás repetirla otro día desde «Antes de empezar».</p>'}</section>
      <section class="tarjeta perfil-sec"><h2>Ejercicios que has valorado</h2>${Object.keys(S.gustos).length ? `<ul class="lista">${Object.entries(S.gustos).map(([id, v]) => `<li><button type="button" class="fila" data-act="quitar-gusto" data-id="${id}"><span class="crece"><b>${h(ex(id)?.n || id)}</b><span>${D.GUSTOS[v]}</span></span><span class="pequeno texto-2">Quitar</span></button></li>`).join('')}</ul>` : '<p>Valora los ejercicios durante la sesión y el entrenador lo tendrá en cuenta.</p>'}</section>
      <section class="tarjeta perfil-sec"><h2>Entrenador IA</h2><div class="segmento segmento--ancho" role="radiogroup" aria-label="Uso del entrenador IA">${Object.entries(D.USO_IA).map(([k, [n]]) => `<button type="button" role="radio" aria-checked="${p.usoIA === k}" tabindex="${p.usoIA === k ? 0 : -1}" data-act="uso-ia" data-v="${k}">${n}</button>`).join('')}</div><p class="ayuda">${h(D.USO_IA[p.usoIA][1])}</p></section>`,
    datos: () => `<section class="tarjeta perfil-sec"><h2>Tus datos</h2>
        <div class="grupo"><p class="grupo-et">Sexo</p><div class="segmento" role="radiogroup" aria-label="Sexo">${[['h', 'Hombre'], ['m', 'Mujer']].map(([k, n]) => `<button type="button" role="radio" aria-checked="${p.datos.sexo === k}" tabindex="${p.datos.sexo === k ? 0 : -1}" data-act="sexo" data-v="${k}">${n}</button>`).join('')}</div></div>
        <div class="rejilla-campos bloque-mini"><div class="campo"><label for="d-alt">Altura (cm)</label><input id="d-alt" inputmode="numeric" value="${p.datos.altura}"></div><div class="campo"><label for="d-nac">Año de nacimiento</label><input id="d-nac" inputmode="numeric" value="${p.datos.nacimiento}" placeholder="1985"></div></div></section>
      <section class="tarjeta perfil-sec"><div class="campo"><label for="d-notas">Para tu entrenador</label><textarea id="d-notas" rows="3" placeholder="horarios, metas concretas, cosas que no te gustan…">${h(p.notas)}</textarea></div></section>`,
    copias: () => `<section class="tarjeta perfil-sec"><h2>Copias en la nube</h2><p>Última copia en la nube: hoy, 9:05.</p>
        <p>Se hacen solas: al terminar una sesión, al cambiar tu perfil, lesiones o medidas y cada día que abras la app (con conexión).</p>
        <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="nube-copiar">Copiar ahora</button><button type="button" class="boton boton--secundario" data-act="nube-lista">Ver copias y restaurar</button></div>
        <button type="button" class="boton boton--texto" data-act="nube-frase">Cambiar la frase</button>
        <p class="ayuda">Se cifran en este móvil con tu frase de recuperación antes de salir: ni el servidor ni quien tenga el código de acceso pueden leer lo que hay dentro. Sin la frase, las copias de la nube no se pueden abrir; guárdala en un gestor de contraseñas.</p>
        <button type="button" class="boton boton--texto" data-act="nube-recuperar">Recuperar de la nube en este móvil</button></section>`,
    ajustes: () => `<section class="tarjeta perfil-sec"><h2>Ajustes del móvil</h2>
        <div class="campo"><label for="a-cod">Código de acceso a la IA</label><input id="a-cod" type="password" autocomplete="off" value="prototipo"><p class="ayuda">El mismo que te ha dado Víctor para usar el entrenador IA.</p></div>
        <div class="chips bloque-mini">${chip('ajuste', 'vibrar', S.vibrar !== false, 'Vibrar al acabar el descanso')}${chip('ajuste', 'sonido', S.sonido !== false, 'Pitido al acabar el descanso')}</div></section>
      <section class="tarjeta perfil-sec"><h2>Copia en un archivo</h2><p>La copia lleva tus datos de salud (lesiones, dolor, medidas y entrenos), sin el código de acceso. Guárdala en un sitio privado.</p>
        <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="copia-guardar">Guardar copia</button><button type="button" class="boton boton--secundario" data-act="copia-cargar">Cargar copia</button></div>
        <p class="ayuda">Tus datos ocupan 182 KB, el 4 % de unos 5 MB que deja el navegador. Última copia guardada: 14 nov.</p></section>
      <section class="tarjeta perfil-sec"><h2>Este móvil</h2><p>Móvil de ${persona()}.</p><button type="button" class="boton boton--texto" data-act="cambiar-dueno">Cambiar de quién es</button><p class="meta">Versión de la app: <span class="cifra">${D.VERSION}</span></p></section>`,
  };
  return `${cabecera()}<h1 class="titulo-pantalla" tabindex="-1">Tu perfil</h1>
    <p class="texto-2 pequeno">${p.objetivos.length ? p.objetivos.map(o => D.OBJETIVOS[o]).join(', ') : 'Sin objetivos'}; ${minus(NIVELES[p.nivel])}; ${p.lesiones.filter(l => l.activa).length} lesiones activas.</p>
    <nav class="chips grupos-perfil bloque-mini" aria-label="Partes del perfil">${GRUPOS.map(([k, n]) => `<button type="button" class="chip" aria-pressed="${g === k}" data-act="grupo" data-v="${k}">${n}</button>`).join('')}</nav>
    ${secc[g]()}`;
}
const fechaCorta = iso => { const [y, m, d] = iso.split('-'); return `${+d} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+m - 1]} ${y}`; };

// ---------- Ejercicios ----------
function riesgo(e) { // por la lesión activa (la app lo calcula por zonas)
  const lumbar = S.perfil.lesiones.some(l => l.activa && l.zona === 'lumbar');
  if (lumbar && /sentadilla|zancadas|remo-barra|peso-muerto/.test(e.id)) return 'precaucion';
  return 'ok';
}
function vistaEjercicios() {
  const f = S.filtro; const t = f.texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const lista = EJERCICIOS.filter(e => (!t || e.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)) && (!f.lugar || e.l.includes(f.lugar)) && (!f.musculo || e.m.includes(f.musculo)) && (!f.gusto || S.gustos[e.id] === f.gusto));
  const usados = [...new Set(EJERCICIOS.flatMap(e => e.m))];
  const fila = (k, ops, todos) => `<div class="chips" role="group" aria-label="${h(todos)}"><button type="button" class="chip" aria-pressed="${!f[k]}" data-act="filtro" data-k="${k}" data-v="">${ico('check')}${h(todos)}</button>${ops.map(([v, n]) => `<button type="button" class="chip" aria-pressed="${f[k] === v}" data-act="filtro" data-k="${k}" data-v="${v}">${ico('check')}${h(n)}</button>`).join('')}</div>`;
  const gustosUsados = Object.entries(D.GUSTOS).filter(([k]) => Object.values(S.gustos).includes(k));
  return `${cabecera()}<h1 class="titulo-pantalla" tabindex="-1">Ejercicios</h1>
    <div class="campo buscar"><label class="solo-lector" for="ej-buscar">Buscar ejercicio</label>${ico('buscar')}<input id="ej-buscar" type="search" value="${h(f.texto)}" placeholder="press, plancha, crol…" autocomplete="off"></div>
    <div class="filtros">${fila('lugar', Object.entries(LUGARES), 'Todos los lugares')}${fila('musculo', usados.map(m => [m, MUSCULOS[m]]), 'Todos los músculos')}${gustosUsados.length ? fila('gusto', gustosUsados, 'Todas las valoraciones') : ''}</div>
    <p class="meta" role="status">${lista.length} ejercicio${lista.length === 1 ? '' : 's'}</p>
    ${lista.length ? `<ul class="lista lista-ej">${lista.map(e => { const g = S.gustos[e.id], rg = riesgo(e); return `<li class="${g === 'rechazo' ? 'apagada' : ''}"><button type="button" class="fila" data-act="ficha" data-id="${e.id}"><span class="crece"><b>${h(e.n)}</b><span>${e.m.map(m => MUSCULOS[m]).join(', ')}; ${e.mat.map(m => MATERIAL[m] || m).join(', ')}</span>${rg !== 'ok' || g ? `<span>${rg === 'precaucion' ? '<span class="insignia">Con cuidado por tu lumbar</span>' : ''}${g ? `<span class="insignia">${D.GUSTOS[g]}</span>` : ''}</span>` : ''}</span>${ico('sig')}</button></li>`; }).join('')}</ul>`
      : `<section class="tarjeta vacio"><h2 class="tarjeta-nombre">Ningún ejercicio con esos filtros</h2><p>Prueba con otra palabra o quita los filtros.</p><button type="button" class="boton boton--secundario" data-act="limpiar-filtros">Quitar filtros</button></section>`}`;
}

// ---------- Bienvenida ----------
function vistaBienvenida() {
  document.body.classList.add('sin-nav');
  return `<section class="bienvenida"><img src="icono.svg" alt="" width="96" height="96"><h1 tabindex="-1">Pipos Fitness</h1>
    <p class="lectura">Tu entrenador personal. Cada uno usa su móvil y ve solo lo suyo.</p>
    <p class="quien" id="quien">¿De quién es este móvil?</p>
    <div class="duenos" role="group" aria-labelledby="quien"><span data-persona="victor"><button type="button" class="boton" data-act="elegir-dueno" data-v="victor">Víctor</button></span><span data-persona="virginia"><button type="button" class="boton" data-act="elegir-dueno" data-v="virginia">Virginia</button></span></div>
    <div class="avisos-salud">${D.T1.map(t => `<p>${h(t)}</p>`).join('')}</div></section>`;
}

// ───────────────────────── hojas (sistema: hoja inferior accesible) ─────────────────────────
let disparador = null;
function abrirHoja(titulo, cuerpo, { fija = false, clase = '' } = {}) {
  cerrarCapa(true);
  disparador = document.activeElement;
  $('#capa').innerHTML = `<div class="hoja-velo ${reducido() ? '' : 'entra'}" data-act="${fija ? '' : 'velo'}"><div class="hoja ${clase}" role="dialog" aria-modal="true" aria-labelledby="hoja-t">
    <div class="hoja-asa" aria-hidden="true"></div>
    <div class="hoja-cab"><h2 id="hoja-t" tabindex="-1">${titulo}</h2>${fija ? '' : `<button type="button" class="boton-icono boton-icono--sin-borde" data-act="cerrar-hoja" aria-label="Cerrar">${ico('cerrar')}</button>`}</div>${cuerpo}</div></div>`;
  $('#app').inert = true; $('#pestanas').inert = true;
  despues($('#capa'));
  $('#hoja-t').focus();
  if (!fija && !CAPTURA) history.pushState({ hoja: 1 }, '');
}
function cerrarCapa(silencio = false) {
  if (!$('#capa').firstChild) return;
  const fin = () => { $('#capa').innerHTML = ''; $('#app').inert = false; $('#pestanas').inert = false; if (!silencio) disparador?.focus?.(); };
  const velo = $('#capa .hoja-velo');
  if (silencio || !velo || reducido()) fin(); else { velo.classList.remove('entra'); velo.classList.add('sale'); setTimeout(fin, 200); }
}
function cerrarHoja() { if (history.state?.hoja) history.back(); else cerrarCapa(); }
window.addEventListener('popstate', () => { if ($('#capa .hoja')) cerrarCapa(); });
document.addEventListener('keydown', e => {
  const hoja = $('#capa .hoja, #capa .contador'); if (!hoja) return;
  if (e.key === 'Escape' && !$('#capa .hoja-velo[data-act=""]')) { e.preventDefault(); if ($('#capa .contador')) cerrarContador(false); else cerrarHoja(); return; }
  if (e.key === 'Tab') {
    const f = $$('button:not([tabindex="-1"]):not([inert]), [tabindex="0"], input, textarea, a[href], summary', hoja).filter(x => x.offsetParent !== null);
    if (!f.length) return; const a = f[0], z = f.at(-1);
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});

function hojaFicha(id) {
  const e = ex(id); const g = S.gustos[id];
  const rg = riesgo(e);
  abrirHoja(h(e.n), `<div class="ficha"><p class="texto-2 pequeno">${e.m.map(m => MUSCULOS[m]).join(', ')}${e.s.length ? `; también ${e.s.map(m => minus(MUSCULOS[m])).join(', ')}` : ''}. ${NIVELES[e.niv]}.</p>
    ${rg !== 'ok' ? `<div class="aviso aviso--aviso" role="note">${ico('alerta')}<div class="aviso-texto"><b>Con cuidado</b><p>Carga tu zona lumbar.</p></div><span></span></div>` : ''}
    <h3>Cómo se hace</h3><ol>${e.p.map(p => `<li>${h(p)}</li>`).join('')}</ol>
    ${e.e.length ? `<h3>Errores típicos</h3><ul>${e.e.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
    ${e.c ? `<p class="consejo">${h(e.c)}</p>` : ''}
    ${D.SESIONES[S.p].ejercicios.find(x => x.id === id)?.ultima ? `<h3>Tus últimas veces</h3><ul><li class="cifra">${h(D.SESIONES[S.p].ejercicios.find(x => x.id === id).ultima)}</li></ul>` : ''}
    <h3 id="g-gusto">¿Qué te parece?</h3><div class="chips gustos" role="group" aria-labelledby="g-gusto">${Object.entries(D.GUSTOS).map(([k, n]) => `<button type="button" class="chip" aria-pressed="${g === k}" data-act="gusto" data-id="${id}" data-v="${k}">${ico(k)}${n}</button>`).join('')}</div></div>`);
}
function hojaMenuEj(i) {
  const s = S.sesion, x = s.ejercicios[i], e = ex(x.id), g = S.gustos[x.id];
  abrirHoja(h(e.n), `<ul class="menu-hoja"><li><button type="button" data-act="ficha" data-id="${x.id}">${ico('info')}Cómo se hace</button></li>
      <li><button type="button" data-act="cambiar-ej" data-e="${i}">${ico('cambiar')}Cambiar por otro</button></li>
      <li><button type="button" data-act="serie-mas" data-e="${i}" data-v="1">${ico('mas')}Añadir una serie</button></li>
      ${x.sets.length > 1 ? `<li><button type="button" data-act="serie-mas" data-e="${i}" data-v="-1">${ico('menos')}Quitar una serie</button></li>` : ''}</ul>
    <p class="grupo-et" id="g-q">¿Qué te parece?</p><div class="chips gustos" role="group" aria-labelledby="g-q">${Object.entries(D.GUSTOS).map(([k, n]) => `<button type="button" class="chip" aria-pressed="${g === k}" data-act="gusto" data-id="${x.id}" data-v="${k}" data-menu="${i}">${ico(k)}${n}</button>`).join('')}</div>
    <div class="campo bloque-mini"><label for="m-com">Comentario para tu entrenador</label><textarea id="m-com" rows="2" placeholder="me molesta la muñeca, la máquina estaba ocupada…">${h(x.comentario || '')}</textarea></div>
    <button type="button" class="boton boton--secundario" data-act="comentar" data-e="${i}">Guardar comentario</button>`);
}
function hojaCambiar(i) {
  const s = S.sesion, x = s.ejercicios[i], e = ex(x.id);
  const hechas = x.sets.filter(z => z.hecha).length;
  const alts = EJERCICIOS.filter(a => a.id !== x.id && a.m[0] === e.m[0] && a.l.includes(s.lugar) && S.gustos[a.id] !== 'rechazo' && !s.ejercicios.some(y => y.id === a.id)).slice(0, 6);
  abrirHoja(`Cambiar ${minus(e.n)}`, `${hechas ? `<p class="hoja-texto">Tienes ${hechas} serie${hechas > 1 ? 's' : ''} hecha${hechas > 1 ? 's' : ''} de ${minus(e.n)}: se conserva${hechas > 1 ? 'n' : ''} en tu historial.</p>` : '<p class="hoja-texto">Mismo músculo y con lo que hay en este lugar.</p>'}
    ${alts.length ? `<ul class="lista">${alts.map(a => `<li><button type="button" class="fila" data-act="cambiar-por" data-e="${i}" data-id="${a.id}"><span class="crece"><b>${h(a.n)}</b><span>${a.m.map(m => MUSCULOS[m]).join(', ')}${S.gustos[a.id] ? `; ${D.GUSTOS[S.gustos[a.id]]}` : ''}</span></span>${ico('sig')}</button></li>`).join('')}</ul>` : '<p class="texto-2">No hay alternativas seguras aquí.</p>'}`);
}
function hojaMia() {
  abrirHoja('Guardar como mía', `<p class="hoja-texto">Guardo sus ejercicios con sus series, repeticiones y descansos, y el lugar. Los kilos no: se calculan cada vez con tu progreso. Para repetirla, elígela en «Antes de empezar».</p>
    <div class="campo"><label for="mia-nombre">Nombre</label><input id="mia-nombre" maxlength="40" value="${h(S.sesion.nombre)}" placeholder="abdominales y flexiones"></div>
    <button type="button" class="boton" data-act="mia-ok">Guardar en mis sesiones</button>`);
}
function hojaCierre() {
  const zonas = Object.keys(S.ci?.dolor || Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, l.dolor])));
  const base = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, l.dolor]));
  S.cierre = S.cierre || { esfuerzo: 3, dolor: { ...base, ...(S.ci?.dolor || {}) }, comentario: '' };
  abrirHoja('¿Qué tal ha ido?', `<div class="grupo"><p class="grupo-et">Esfuerzo</p><div class="segmento segmento--ancho" role="radiogroup" aria-label="Esfuerzo">${D.ESFUERZO.map(([v, t]) => `<button type="button" role="radio" aria-checked="${+v === S.cierre.esfuerzo}" tabindex="${+v === S.cierre.esfuerzo ? 0 : -1}" data-act="esfuerzo" data-v="${v}" aria-label="${v}: ${t}">${v}</button>`).join('')}</div><p class="ayuda" id="esf-txt">${D.ESFUERZO[S.cierre.esfuerzo - 1][1]}</p></div>
    ${zonas.map(z => `<div class="grupo">${selectorHtml({ id: `c-dolor-${z}`, et: `Dolor ahora en ${minus(D.ZONAS[z][1])}`, valor: S.cierre.dolor[z] ?? 0, min: 0, max: 10, paso: 1, unidad: 'de 10', act: 'cierre-dolor', z })}</div>`).join('')}
    <div class="campo bloque-mini"><label for="c-com">Para tu entrenador <small>molestias, qué cambiarías…</small></label><textarea id="c-com" rows="3">${h(S.cierre.comentario)}</textarea></div>
    <button type="button" class="boton" data-act="guardar-sesion">Guardar sesión</button>`);
}
function hojaPendientes() {
  const s = S.sesion; const pend = s.ejercicios.map(x => [ex(x.id).n, x.sets.filter(z => !z.hecha).length]).filter(([, n]) => n);
  const n = pend.reduce((a, [, k]) => a + k, 0); const est = s.vuelta.filter(t => !t.hecho).length;
  abrirHoja(`Te quedan ${n} serie${n === 1 ? '' : 's'}`, `<p class="hoja-texto">Si terminas ahora, quedan sin hacer: ${pend.map(([nn, k]) => `${k} de ${minus(nn)}`).join(', ')}${est ? `, y ${est} estiramientos de la vuelta a la calma` : ''}. Lo hecho se guarda igual.</p>
    <div class="fila-botones"><button type="button" class="boton" data-act="seguir-sesion">Seguir con la sesión</button><button type="button" class="boton boton--secundario" data-act="terminar-igual">Terminar igual</button></div>`);
}
function hojaDia(d) {
  const dia = S.plan.dias.find(x => x.d === d); const ses = D.SESIONES[S.p];
  const esHoy = d === D.HOY.diaSemana;
  const ejs = esHoy ? ses.ejercicios : ses.ejercicios.slice(0, dia.ej);
  abrirHoja(`${D.DIAS[d]}: ${h(dia.nombre)}`, `<p class="hoja-texto">${LUGARES[dia.lugar]}, unos ${dia.min} min.</p>
    <p class="grupo-et">Calentamiento</p><ul class="tecnica-texto">${ses.calentamiento.map(t => `<li>${h(t.nombre)} <span class="texto-2">${h(t.duracion)}</span></li>`).join('')}</ul>
    <p class="grupo-et bloque-mini">Trabajo</p><ul class="tecnica-texto">${ejs.map(x => `<li><b>${h(ex(x.id).n)}</b> <span class="texto-2">${x.series} × ${h(textoReps(x))}${x.rol === 'rehab' ? ', rehabilitación' : x.rol === 'cardio' ? ', cardio' : ''}</span></li>`).join('')}</ul>
    <p class="grupo-et bloque-mini">Vuelta a la calma</p><ul class="tecnica-texto">${ses.vuelta.map(t => `<li>${h(t.nombre)} <span class="texto-2">${h(t.duracion)}</span></li>`).join('')}</ul>
    ${dia.estado === 'hecho' ? `<a class="boton boton--secundario" href="?p=${S.p}&amp;e=leer#sesion">Ver lo que hiciste</a>` : `<button type="button" class="boton" data-act="checkin">Hacer este día hoy</button>`}`);
}
function hojaPlan() {
  const dias = S.plan ? S.plan.dias.map(d => d.d) : [1, 3, 5, 6];
  S.ps = S.ps || { dias: dias.slice(), minutos: S.perfil.minutos, lugares: S.perfil.lugares.slice() };
  const ps = S.ps;
  const hechos = S.plan ? S.plan.dias.filter(d => d.estado === 'hecho').map(d => d.d) : [];
  abrirHoja('Tu semana', `<p class="hoja-texto">Marca los días que puedes entrenar <b>esta semana</b>. Si cambia algo a mitad de semana, vuelve aquí y lo reorganizo.</p>
    <div class="chips" role="group" aria-label="Días">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="chip" aria-pressed="${ps.dias.includes(i)}" data-act="ps-dia" data-v="${i}" ${hechos.includes(i) || i < D.HOY.diaSemana ? 'aria-disabled="true"' : ''} aria-label="${D.DIAS[i]}${hechos.includes(i) ? ', ya hecho' : i < D.HOY.diaSemana ? ', ya pasado' : ''}">${ico('check')}${D.DIAS_CORTOS[i]}</button>`).join('')}</div>
    <div class="grupo bloque-mini"><p class="grupo-et">Minutos por sesión</p><div class="segmento" role="radiogroup" aria-label="Minutos por sesión">${[30, 45, 60, 75, 90].map(m => `<button type="button" role="radio" aria-checked="${ps.minutos === m}" tabindex="${ps.minutos === m ? 0 : -1}" data-act="ps-min" data-v="${m}">${m}</button>`).join('')}</div></div>
    <div class="grupo"><p class="grupo-et">Dónde</p><div class="chips">${S.perfil.lugares.map(l => chip('ps-lugar', l, ps.lugares.includes(l), LUGARES[l])).join('')}</div></div>
    <button type="button" class="boton" data-act="crear-plan" data-ia="1" ${S.red ? '' : 'aria-disabled="true"'}>${ico('ia')}Que me la monte el entrenador IA</button>
    ${S.red ? '' : '<p class="boton-motivo">Necesita conexión.</p>'}
    <button type="button" class="boton boton--secundario bloque-mini" data-act="crear-plan" data-ia="0">Hacerla con la app (sin gastar IA)</button>
    <p class="ayuda">${ps.dias.filter(d => d >= D.HOY.diaSemana && !hechos.includes(d)).length} días por planificar; lo que ya has hecho se queda.</p>`);
}
function hojaReorganizar(hoyNo = false) {
  const pend = S.plan.dias.filter(d => d.estado !== 'hecho');
  S.ro = S.ro || [6, 7].filter(d => !hoyNo || d > D.HOY.diaSemana);
  abrirHoja('Reorganizar la semana', `<p class="hoja-texto">Te quedan: ${pend.map(d => `<b>${h(d.nombre)}</b>`).join(', ')}. ¿Qué días puedes de aquí al domingo?</p>
    <div class="chips" role="group" aria-label="Días">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button" class="chip" aria-pressed="${S.ro.includes(i)}" data-act="ro-dia" data-v="${i}" ${i < D.HOY.diaSemana || (hoyNo && i === D.HOY.diaSemana) ? 'aria-disabled="true"' : ''} aria-label="${D.DIAS[i]}">${ico('check')}${D.DIAS_CORTOS[i]}</button>`).join('')}</div>
    <p class="ayuda">Si caben, muevo los días tal cual. Si no, los junto en sesiones de cuerpo completo con lo que aún no has trabajado.</p>
    <button type="button" class="boton" data-act="reorganizar-ok">Reorganizar</button>`);
}
function hojaLesion(id) {
  const l = id ? S.perfil.lesiones.find(x => x.id === id) : { id: '', zona: 'hombro', dolor: 2, tipo: 'puntual', desde: '', nota: '', activa: true };
  S.le = structuredClone(l);
  const le = S.le;
  abrirHoja(id ? 'Editar lesión' : 'Nueva lesión o dolor', `<div class="grupo"><p class="grupo-et" id="g-zona">Zona</p><div class="chips" role="group" aria-labelledby="g-zona">${Object.entries(D.ZONAS).map(([k, [, c]]) => `<button type="button" class="chip" aria-pressed="${le.zona === k}" data-act="le-zona" data-v="${k}">${ico('check')}${c}</button>`).join('')}</div></div>
    <div class="grupo">${selectorHtml({ id: 'le-dolor', et: 'Dolor habitual', valor: le.dolor, min: 0, max: 10, paso: 1, unidad: 'de 10', act: 'le-dolor' })}</div>
    <div class="grupo"><p class="grupo-et">Qué es</p><div class="segmento" role="radiogroup" aria-label="Qué es">${Object.entries(D.TIPOS_LESION).map(([k, n]) => `<button type="button" role="radio" aria-checked="${le.tipo === k}" tabindex="${le.tipo === k ? 0 : -1}" data-act="le-tipo" data-v="${k}">${n}</button>`).join('')}</div></div>
    <div class="campo"><label for="le-desde">Desde</label><input id="le-desde" type="date" value="${h(le.desde)}"></div>
    <div class="campo"><label for="le-nota">Nota <small>qué movimientos duelen, diagnóstico…</small></label><textarea id="le-nota" rows="2">${h(le.nota)}</textarea></div>
    ${id ? `<div class="chips bloque-mini">${chip('le-activa', '', le.activa, 'Sigue activa')}</div>` : ''}
    <div class="fila-botones">${id ? '<button type="button" class="boton boton--peligro" data-act="le-borrar">Borrar lesión</button>' : ''}<button type="button" class="boton" data-act="le-guardar">Guardar lesión</button></div>`);
}
function hojaMedidas() {
  const M = [['peso', 'Peso', 'kg'], ['cintura', 'Cintura', 'cm']];
  const MAS = [['cadera', 'Cadera', 'cm'], ['cuello', 'Cuello', 'cm'], ['pecho', 'Pecho', 'cm'], ['brazo', 'Brazo', 'cm'], ['muslo', 'Muslo', 'cm'], ['grasa', '% grasa', '%']];
  const pr = D.PROGRESO[S.p]; const ult = { peso: pr.peso.at(-1), cintura: pr.cintura.at(-1) };
  const campo = ([k, n, u]) => `<div class="campo"><label for="m-${k}">${n} (${u})</label><input id="m-${k}" inputmode="decimal" placeholder="${ult[k] != null ? `última: ${num(ult[k])}` : ''}" autocomplete="off"></div>`;
  abrirHoja('Medidas de hoy', `<p class="hoja-texto">Por la mañana, en ayunas. La cintura, a la altura del ombligo y sin apretar.</p>
    <div class="rejilla-campos">${M.map(campo).join('')}</div>
    <details class="tecnica"><summary>Más medidas</summary><p class="tecnica-texto">Con cuello, cintura y cadera se estima el % de grasa.</p><div class="rejilla-campos">${MAS.map(campo).join('')}</div></details>
    <button type="button" class="boton" data-act="medidas-ok">Guardar medidas</button>`);
}
function hojaMiaPerfil(id) {
  const m = S.perfil.mias.find(x => x.id === id);
  abrirHoja(h(m.nombre), `<p class="hoja-texto">${LUGARES[m.lugar]}, unos ${m.minutos} min.</p>
    <ul class="tecnica-texto">${m.ej.map(([eid, se, r]) => `<li>${h(ex(eid).n)} <span class="texto-2">${se} × ${h(r)}</span></li>`).join('')}</ul>
    <p class="ayuda">Al hacerla se le añaden calentamiento, cardio y estiramientos, y se cambia lo que ese día no valga por tu dolor, el lugar o el material.</p>
    <div class="campo bloque-mini"><label for="mia-n">Nombre</label><input id="mia-n" maxlength="40" value="${h(m.nombre)}"></div>
    <div class="fila-botones"><button type="button" class="boton boton--peligro" data-act="mia-borrar" data-id="${id}">Borrar «${h(m.nombre)}»</button><button type="button" class="boton" data-act="mia-renombrar" data-id="${id}">Guardar nombre</button></div>`);
}

// ---------- Espera de la IA ----------
let espera = null;
const FASES = ['Conectando con tu entrenador…', 'Pensando tu sesión con tus datos…', 'Escribiendo tu sesión…'];
function abrirEspera(tipo = 'sesion') {
  const t0 = Date.now();
  abrirHoja(tipo === 'plan' ? 'Tu entrenador está montando la semana' : 'Tu entrenador está preparando la sesión', `<ol class="espera-pasos" id="espera-pasos"></ol>
    <p class="espera-tiempo"><span class="cifra" id="espera-t">0:00</span>. Suele tardar entre 20 y 90 segundos.</p>
    <p class="solo-lector" aria-live="polite" id="espera-vivo"></p>
    <button type="button" class="boton boton--secundario bloque-mini" data-act="cancelar-ia">Cancelar y hacerla con la app</button>`, { fija: true });
  espera = { t0, tipo, fase: -1, reloj: null };
  const pintarEspera = () => {
    const seg = (Date.now() - t0) / 1000;
    const fase = CAPTURA ? 1 : seg < 1.5 ? 0 : seg < 4.5 ? 1 : 2;
    $('#espera-t').textContent = mmss(CAPTURA ? 14 : seg);
    if (fase !== espera.fase) {
      espera.fase = fase;
      $('#espera-pasos').innerHTML = FASES.map((f, i) => `<li class="${i < fase ? 'hecho' : i === fase ? 'ahora' : ''}"><span class="marca-paso">${i < fase ? ico('check') : i === fase ? '<span class="giro" aria-hidden="true"></span>' : ''}</span>${i === 2 && fase === 2 ? 'Escribiendo tu sesión: 4 ejercicios…' : f}</li>`).join('');
      $('#espera-vivo').textContent = FASES[fase];
    }
    if (!CAPTURA && seg > 7) { terminarEspera(true); }
  };
  pintarEspera();
  espera.reloj = setInterval(pintarEspera, 250);
}
function terminarEspera(bien) {
  if (!espera) return; clearInterval(espera.reloj); const tipo = espera.tipo; espera = null; cerrarCapa(true);
  if (tipo === 'plan') { aviso('Semana lista', 'Tu entrenador ha montado los días que has marcado.'); return; }
  S.sesion = sesionNueva(S.p); S.paso = null;
  if (!bien) { S.sesion.fuente = 'app'; S.sesion.iaFallo = { motivo: 'cancelaste la espera', peticion: S.ci?.peticion || '' }; }
  irA('sesion');
  aviso(bien ? 'Sesión lista' : 'La ha hecho la app', bien ? 'Tu entrenador la ha ajustado a cómo estás hoy.' : 'Con sus reglas y tus datos de hoy.', bien ? 'bien' : 'info');
}

// ---------- Descanso, alarma y vuelta tras bloquear ----------
const host = () => $('#descanso-host') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'descanso-host' }));
function empezarDescanso(seg, etiqueta) {
  S.descanso = { fin: Date.now() + seg * 1000, total: seg, etiqueta }; S.alarma = null;
  pintarDescanso(); arrancarTic(); mantenerVisible();
}
let tic = null;
function arrancarTic() { clearInterval(tic); if (!CAPTURA) tic = setInterval(pintarDescanso, 250); }
function pintarDescanso() {
  const d = S.descanso, a = S.alarma; const hz = host();
  document.body.classList.toggle('con-descanso', !!(d || a));
  if (!d && !a) { hz.innerHTML = ''; return; }
  if (d && !a) {
    const q = Math.max(0, (d.fin - Date.now()) / 1000);
    if (q <= 0) { terminarDescanso(0); return; }
    const ultimos = q <= 10;
    if (!hz.querySelector('.descanso:not(.descanso--alarma)')) hz.innerHTML = `<div class="descanso descanso--fija" role="timer" aria-label="Descanso"><span class="descanso-nivel" aria-hidden="true"></span><div class="descanso-fila"><div class="descanso-txt"><span class="descanso-et"></span><b class="descanso-reloj" data-reloj></b></div>
      <button type="button" class="boton boton--secundario" data-act="desc-menos" aria-label="Quitar 15 segundos">−15</button><button type="button" class="boton boton--secundario" data-act="desc-mas" aria-label="Añadir 15 segundos">+15</button><button type="button" class="boton boton--secundario" data-act="desc-saltar">Saltar</button></div></div>`;
    const el = hz.querySelector('.descanso');
    el.classList.toggle('descanso--ultimos', ultimos);
    el.style.setProperty('--p', String(q / d.total));
    $('.descanso-et', el).textContent = ultimos ? 'Prepárate' : d.etiqueta;
    $('[data-reloj]', el).textContent = mmss(Math.ceil(q));
    return;
  }
  // Alarma: color de la persona, texto oscuro (≥ 7:1), vibración de tres toques, se cierra sola a los 8 s
  if (!hz.querySelector('.descanso--alarma')) {
    hz.innerHTML = `<div class="descanso descanso--fija descanso--alarma sobre-acento ${reducido() ? '' : 'suena'}" role="alert"><span class="descanso-nivel" aria-hidden="true"></span><div class="descanso-fila"><div class="descanso-txt"><span class="descanso-et">${h(a.titulo)}</span><b class="descanso-reloj">${a.hace ? `−${mmss(a.hace)}` : '0:00'}</b><span class="eco" aria-hidden="true"></span></div>
      <button type="button" class="boton boton--secundario" data-act="desc-mas" aria-label="Añadir 15 segundos">+15</button><button type="button" class="boton boton--secundario" data-act="desc-cerrar">Cerrar</button></div>
      ${a.hace ? `<p class="pequeno alarma-sub">El descanso terminó hace ${mmss(a.hace)}.</p>` : ''}</div>`;
    hz.querySelector('.descanso').style.setProperty('--p', '0');
  }
}
function terminarDescanso(hace) {
  const s = S.sesion; const x = s?.ejercicios.find(y => y.sets.some(z => !z.hecha)); const j = x ? x.sets.findIndex(z => !z.hecha) : 0;
  S.descanso = null;
  S.alarma = { titulo: x ? `A por la serie ${j + 1}` : 'A por la siguiente serie', hace };
  if (x) anunciar(`Descanso terminado. A por la serie ${j + 1} de ${minus(ex(x.id).n)}.`);
  vibrar([250, 120, 250, 120, 250]);
  if (!x) anunciar('Descanso terminado.');
  pintarDescanso();
  clearTimeout(S.alarmaFin); if (!CAPTURA) S.alarmaFin = setTimeout(() => { S.alarma = null; pintarDescanso(); }, 8000);
}
// Vuelta tras bloquear el móvil: se cuenta con la hora real; si el descanso acabó mientras tanto, la alarma lo dice.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S.descanso) return;
  const pasado = (Date.now() - S.descanso.fin) / 1000;
  if (pasado > 0) terminarDescanso(Math.round(pasado)); else pintarDescanso();
});

// ---------- Contador a pantalla completa (ejercicio por tiempo y cardio) ----------
let cont = null;
function abrirContador(i, j) {
  const x = S.sesion.ejercicios[i], t = porTiempo(x);
  cont = { i, j, t, x, fase: 'previa', inicio: Date.now(), pausa: null, lado: 1, tiempos: [] };
  if (CAPTURA) { cont.fase = 'trabajo'; cont.inicio = Date.now() - Math.min(t.hi, t.lo + 4) * 1000 * (t.u === 'min' ? 0.4 : 1); }
  disparador = document.activeElement;
  $('#capa').innerHTML = `<div class="contador contador--pantalla" role="dialog" aria-modal="true" aria-labelledby="ct-n"><span class="contador-agua" aria-hidden="true"></span>
    <div class="contador-cab"><p class="contador-nombre" id="ct-n" tabindex="-1">${h(ex(x.id).n)}</p><p class="contador-estado" data-arriba></p></div>
    <div><b class="contador-reloj" data-reloj role="timer" aria-live="off"></b><p class="contador-meta" data-abajo aria-live="polite"></p></div>
    <div class="contador-acciones" data-botones></div>
    <button type="button" class="boton-icono contador-x" data-act="contador-cancelar" aria-label="Cancelar sin apuntar">${ico('cerrar')}</button></div>`;
  $('#app').inert = true; $('#pestanas').inert = true;
  $('#ct-n').focus();
  pintarContador(); clearInterval(cont.reloj); if (!CAPTURA) cont.reloj = setInterval(pintarContador, 200);
}
function pintarContador() {
  if (!cont) return; const c = cont, t = c.t; const el = $('#capa .contador'); if (!el) return;
  const s = (c.pausa ?? Date.now() - c.inicio) / 1000;
  let grande, arriba, abajo, prog, botones;
  const objetivo = t.u === 'min' ? `${t.hi / 60} min` : t.lo === t.hi ? `${t.hi} s` : `${t.lo}-${t.hi} s`;
  if (c.fase === 'previa') {
    if (s >= 5) { c.fase = 'trabajo'; c.inicio = Date.now(); vibrar(250); return pintarContador(); }
    grande = String(Math.max(1, Math.ceil(5 - s))); arriba = t.lados > 1 ? `Lado ${c.lado} de 2` : 'Prepárate'; abajo = c.lado === 2 ? 'Cambia de lado' : 'Colócate en posición'; prog = 0;
    botones = '<button type="button" class="boton" data-act="contador-ya">Empezar ya</button>';
  } else {
    arriba = `${t.lados > 1 ? `Lado ${c.lado} de 2, ` : ''}objetivo ${objetivo}`;
    if (s < t.lo) { grande = mmss(Math.ceil(t.lo - s)); abajo = t.u === 'min' ? 'Ritmo cómodo: que puedas hablar' : 'Aguanta'; }
    else if (s < t.hi) { grande = mmss(Math.floor(s)); abajo = `Mínimo hecho. Sigue hasta ${t.hi} s si puedes`; }
    else { grande = `+${mmss(Math.floor(s - t.hi))}`; abajo = `Objetivo superado: llevas ${mmss(Math.floor(s))}`; }
    prog = Math.min(1, s / t.hi);
    const ultimoLado = t.lados === 1 || c.lado === 2;
    botones = `<button type="button" class="boton boton--secundario" data-act="contador-pausa">${c.pausa != null ? `${ico('play')}Seguir` : `${ico('pausa')}Pausar`}</button><button type="button" class="boton" data-act="contador-hecho">${ultimoLado ? `${ico('check')}Hecho` : 'Cambiar de lado'}</button>`;
    if (c.pausa != null) abajo = 'En pausa';
  }
  $('[data-reloj]', el).textContent = grande; $('[data-arriba]', el).textContent = arriba; $('[data-abajo]', el).textContent = abajo;
  el.style.setProperty('--p', String(prog));
  if ($('[data-botones]', el).dataset.b !== botones) { $('[data-botones]', el).innerHTML = botones; $('[data-botones]', el).dataset.b = botones; }
}
function cerrarContador(apuntar) {
  if (!cont) return; clearInterval(cont.reloj); const c = cont; cont = null;
  $('#capa').innerHTML = ''; $('#app').inert = false; $('#pestanas').inert = false;
  if (apuntar) {
    const s = Math.round((c.pausa ?? Date.now() - c.inicio) / 1000); const seg = Math.min(s, ...c.tiempos);
    marcarSerie(c.i, c.j, { valor: String(c.t.u === 'min' ? Math.round(seg / 60) : seg) });
  } else pintar();
  disparador?.focus?.();
}

// ---------- Series ----------
function marcarSerie(i, j, datos = {}) {
  const s = S.sesion, x = s.ejercicios[i], z = x.sets[j];
  if (Date.now() - (S.ultimoToque || 0) < 400) return; // doble toque = uno (R27)
  S.ultimoToque = Date.now();
  if (s.estado === 'pendiente') s.estado = 'en_curso';
  z.hecha = true;
  if (datos.valor != null) z.valor = datos.valor;
  if (z.valor == null) { const r = rango(x.reps); z.valor = r ? String(r.lo) : ''; }
  if (z.kg == null && conKg(x)) z.kg = x.kg;
  const sig = x.sets[j + 1];
  if (sig) { sig.kg ??= z.kg; sig.valor ??= porTiempo(x) ? null : z.valor; } // los kilos pasan a la siguiente (R05)
  S.recien = `${i}-${j}`;
  S.alarma = null;
  const ultimaDelEj = j === x.sets.length - 1, ultimaDeTodo = ultimaDelEj && i === s.ejercicios.length - 1;
  if (ultimaDelEj && S.modo === 'foco') { const P = pasos(s); const k = P.findIndex(q => q.k === 'ej' && q.i === i); if (k >= 0 && k < P.length - 1) S.paso = k + 1; }
  if (!ultimaDeTodo && x.descanso) empezarDescanso(x.descanso, ultimaDelEj ? `Después: ${minus(ex(s.ejercicios[i + 1].id).n)}` : `Serie ${j + 2} de ${x.sets.length}`);
  else { S.descanso = null; pintarDescanso(); }
  pintar();
  ($('#app [data-act="serie-hecha"]') || $('#app [data-act="contador"]') || $('#app [data-act="paso"][data-v="1"]'))?.focus({ preventScroll: true });
  mantenerVisible();
}
// La serie actual nunca queda debajo de la barra de descanso (R03, R09).
function mantenerVisible() {
  const fila = $('#app [data-actual]'); const tapa = $('#descanso-host .descanso');
  if (fila && tapa) { const falta = fila.getBoundingClientRect().bottom - tapa.getBoundingClientRect().top + 12; if (falta > 0) window.scrollBy(0, falta); }
}

// ---------- Celebración ----------
function celebrar() {
  const s = S.sesion; const hh = hechasSeries(s);
  const kg = s.ejercicios.reduce((a, x) => a + x.sets.reduce((b, z) => b + (z.hecha && z.kg ? z.kg * (+z.valor || 0) : 0), 0), 0);
  const rd = (v, i0 = 0) => `<span class="solo-lector">${v}</span><span class="rodillo" aria-hidden="true">${[...String(v)].map((c, i) => (/\d/.test(c) ? `<span class="rd" data-fin="${c}" data-i="${i0 + i}"><span class="rd-tira">${[...'0123456789'].map(n => `<span>${n}</span>`).join('')}</span></span>` : `<span>${c}</span>`)).join('')}</span>`;
  const semana = S.plan ? `${S.plan.dias.filter(d => d.estado === 'hecho').length + 1} de ${S.plan.dias.length} días del plan esta semana` : '';
  const marca = S.p === 'victor' ? 'Press de banca con mancuernas: 22,5 kg × 10, tu mejor serie.' : 'Remo sentado en polea: 20 kg × 12, tu mejor serie.';
  $('#capa').innerHTML = `<div class="final ${reducido() ? '' : 'celebra'}" role="dialog" aria-modal="true" aria-labelledby="fin-t"><div class="final-agua" aria-hidden="true"></div><div class="final-dentro">
    <div class="sello" aria-hidden="true"><i></i><i></i><i></i><span>${ico('check')}</span></div>
    <h2 id="fin-t" tabindex="-1">Sesión guardada</h2><p class="semana-txt">${semana}</p>
    <dl><div><dt>series</dt><dd>${rd(hh)}</dd></div><div><dt>minutos</dt><dd>${rd(S.p === 'victor' ? 58 : 47, 3)}</dd></div><div><dt>kilos movidos</dt><dd>${rd(Math.round(kg), 6)}</dd></div></dl>
    <p class="marca">${h(marca)}</p>
    <button type="button" class="boton" data-act="fin-hoy">Volver a Hoy</button></div></div>`;
  $('#app').inert = true; $('#pestanas').inert = true;
  const rds = $$('#capa .rd');
  rds.forEach(n => n.style.setProperty('--i', n.dataset.i));
  if (reducido()) rds.forEach(n => n.style.setProperty('--d', n.dataset.fin));
  else requestAnimationFrame(() => requestAnimationFrame(() => rds.forEach(n => n.style.setProperty('--d', n.dataset.fin))));
  $('#fin-t').focus();
}

// ───────────────────────── rutas y pintado ─────────────────────────
const RUTAS = { bienvenida: vistaBienvenida, hoy: vistaHoy, checkin: vistaCheckin, sesion: vistaSesion, progreso: vistaProgreso, perfil: vistaPerfil, ejercicios: vistaEjercicios };
const ORDEN = { bienvenida: 0, hoy: 1, checkin: 2, sesion: 3, progreso: 4, ejercicios: 5, perfil: 6 };
const TABS = [['hoy', 'Hoy', 'hoy'], ['progreso', 'Progreso', 'progreso'], ['ejercicios', 'Ejercicios', 'ejercicios'], ['perfil', 'Perfil', 'perfil']];
let vista = null;
function despues(raiz) {
  $$('[data-v]', raiz).forEach(n => { if (n.tagName === 'I') n.style.setProperty('--v', n.dataset.v); });
  if ($('[data-grafico], .vasos', raiz)) activar(raiz);
  $$('.selector[data-selector]', raiz).forEach(n => { n.dataset.listo || (n.dataset.listo = '1'); });
}
function pintar() {
  const app = $('#app');
  document.body.classList.remove('sin-nav', 'sin-accion');
  app.innerHTML = RUTAS[vista]();
  $('#pestanas').hidden = document.body.classList.contains('sin-nav');
  $$('#pestanas .pestana').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === (vista === 'checkin' || vista === 'sesion' ? 'hoy' : vista)));
  $$('#pestanas .pestana[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
  despues(app);
  const pet = $('#ci-peticion');
  pet?.addEventListener('input', () => { S.ci.peticion = pet.value; });
  pet?.addEventListener('change', () => { $('#previa').outerHTML = htmlPrevia(S.ci); $('#previa').classList.add('cambiado'); despues($('#previa')); });
  const bus = $('#ej-buscar');
  bus?.addEventListener('input', () => { clearTimeout(bus.t); bus.t = setTimeout(() => { S.filtro.texto = bus.value; pintar(); const n = $('#ej-buscar'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); });
}
function irA(r) { if (location.hash.slice(1) === r) ir(r); else location.hash = r; }
function ir(r) {
  if (!RUTAS[r]) r = 'hoy';
  const antes = vista; vista = r;
  document.documentElement.dataset.dir = antes == null || ORDEN[r] >= ORDEN[antes] ? 'adelante' : 'atras';
  if (antes && antes !== r && !reducido()) { // la anterior sale mientras entra la nueva
    $$('.saliente').forEach(n => n.remove());
    const capaSal = Object.assign(document.createElement('div'), { className: 'saliente' }); capaSal.setAttribute('aria-hidden', 'true'); capaSal.inert = true;
    const dentro = Object.assign(document.createElement('div'), { className: 'saliente-dentro' }); dentro.style.marginTop = `${-window.scrollY}px`;
    dentro.append(...$('#app').childNodes); capaSal.append(dentro); document.body.append(capaSal);
    capaSal.addEventListener('animationend', () => capaSal.remove(), { once: true }); setTimeout(() => capaSal.remove(), 500);
  }
  if (r !== 'sesion') S.paso = S.paso; // la sesión recuerda el paso
  pintar();
  if (antes && antes !== r && !reducido()) { const a = $('#app'); a.classList.remove('entra'); void a.offsetWidth; a.classList.add('entra'); }
  window.scrollTo(0, 0);
  if (antes) $('#app h1')?.focus({ preventScroll: true });
}

// ───────────────────────── selector ± (spinbutton) ─────────────────────────
function cambiarSelector(sel, n) {
  const min = +sel.dataset.min, max = +sel.dataset.max, paso = +sel.dataset.incremento;
  n = Math.min(max, Math.max(min, Math.round(n / paso) * paso));
  const v = $('[role="spinbutton"]', sel); v.setAttribute('aria-valuenow', String(n));
  v.setAttribute('aria-valuetext', `${num(n)} ${$('.selector-valor span', sel).textContent}`);
  $('b', v).textContent = num(n);
  $('[data-paso="-1"]', sel).setAttribute('aria-disabled', String(n <= min)); $('[data-paso="1"]', sel).setAttribute('aria-disabled', String(n >= max));
  const act = sel.dataset.actVal, z = sel.dataset.z, i = +sel.dataset.e, j = +sel.dataset.s;
  if (act === 'serie-kg') S.sesion.ejercicios[i].sets[j].kg = n;
  if (act === 'serie-rep') S.sesion.ejercicios[i].sets[j].valor = String(n);
  if (act === 'ci-dolor') { S.ci.dolor[z] = n; $('#previa').outerHTML = htmlPrevia(S.ci); $('#previa').classList.add('cambiado'); }
  if (act === 'cierre-dolor') S.cierre.dolor[z] = n;
  if (act === 'le-dolor') S.le.dolor = n;
  if (act === 'perfil-dias') S.perfil.dias = n;
}
document.addEventListener('keydown', e => {
  const v = e.target.closest?.('[role="spinbutton"]'); if (!v) return;
  const sel = v.closest('.selector'); const ahora = +v.getAttribute('aria-valuenow'), paso = +sel.dataset.incremento;
  const n = { ArrowUp: ahora + paso, ArrowRight: ahora + paso, ArrowDown: ahora - paso, ArrowLeft: ahora - paso, PageUp: ahora + paso * 4, PageDown: ahora - paso * 4, Home: +sel.dataset.min, End: +sel.dataset.max }[e.key];
  if (n == null) return; e.preventDefault(); cambiarSelector(sel, n);
});
// Grupos de opción única: flechas, Inicio y Fin (radiogroup del sistema)
document.addEventListener('keydown', e => {
  const r = e.target.closest?.('[role="radio"]'); if (!r) return;
  const g = r.closest('[role="radiogroup"]'); const ops = $$('[role="radio"]:not([aria-disabled="true"])', g); const i = ops.indexOf(r);
  const sig = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: ops.length - 1 }[e.key];
  if (sig == null) return; e.preventDefault(); const b = ops[(sig + ops.length) % ops.length]; b.click();
  requestAnimationFrame(() => { const nuevo = $(`[role="radiogroup"][aria-label="${g.getAttribute('aria-label')}"] [role="radio"][aria-checked="true"]`); nuevo?.focus(); });
});

// ───────────────────────── acciones ─────────────────────────
const unico = (g, b) => { $$('[role="radio"]', g).forEach(x => { const si = x === b; x.setAttribute('aria-checked', String(si)); x.tabIndex = si ? 0 : -1; }); };
document.addEventListener('click', e => {
  const paso = e.target.closest('.selector-pasos [data-paso]');
  if (paso) { if (paso.getAttribute('aria-disabled') !== 'true') { const sel = paso.closest('.selector'); cambiarSelector(sel, +$('[role="spinbutton"]', sel).getAttribute('aria-valuenow') + +paso.dataset.paso * +sel.dataset.incremento); } return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') { if (b.dataset.act === 'crear-plan') aviso('Necesita conexión', 'Mientras tanto, hazla con la app.', 'info'); return; }
  const a = b.dataset.act, v = b.dataset.v, s = S.sesion;
  const ACC = {
    proto: menuPrototipo,
    'cerrar-aviso': () => b.closest('.aviso').remove(),
    'cerrar-hoja': cerrarHoja,
    velo: () => { if (e.target === b) cerrarHoja(); },
    // Hoy
    checkin: () => { cerrarCapa(true); S.ci = nuevoCi(); irA('checkin'); },
    'hacer-mia': () => { S.ci = nuevoCi(); S.ci.mia = S.perfil.mias[0].id; irA('checkin'); },
    plan: () => { S.ps = null; hojaPlan(); },
    'ps-dia': () => { const n = +v, i = S.ps.dias.indexOf(n); if (i >= 0) S.ps.dias.splice(i, 1); else S.ps.dias.push(n); b.setAttribute('aria-pressed', String(i < 0)); },
    'ps-min': () => { S.ps.minutos = +v; unico(b.closest('[role="radiogroup"]'), b); },
    'ps-lugar': () => { const i = S.ps.lugares.indexOf(v); if (i >= 0 && S.ps.lugares.length > 1) S.ps.lugares.splice(i, 1); else if (i < 0) S.ps.lugares.push(v); b.setAttribute('aria-pressed', String(S.ps.lugares.includes(v))); },
    'crear-plan': () => { cerrarCapa(true); if (v === '1') abrirEspera('plan'); else { S.plan = S.plan || structuredClone(D.PLANES[S.p]); S.sinPlan = false; S.plan.fuente = 'app'; pintar(); aviso('Semana lista', 'La ha hecho la app con tus días, minutos y lugares.'); } },
    reorganizar: () => { S.ro = null; hojaReorganizar(); },
    'hoy-no': () => { S.ro = null; hojaReorganizar(true); },
    'ro-dia': () => { const n = +v, i = S.ro.indexOf(n); if (i >= 0) S.ro.splice(i, 1); else S.ro.push(n); b.setAttribute('aria-pressed', String(i < 0)); },
    'reorganizar-ok': () => { cerrarHoja(); const sal = S.plan.dias.find(d => d.estado === 'saltado'); if (sal && S.ro.includes(7)) { sal.d = 7; sal.estado = 'pendiente'; } pintar(); aviso('Semana reorganizada', sal && S.ro.includes(7) ? `«${sal.nombre}» pasa al domingo.` : 'Lo que queda cabe en los días que has marcado.', 'info'); },
    'ver-dia': () => hojaDia(+b.dataset.d),
    'cerrar-ayer': () => { S.sesion = S.ayer; S.ayer = null; S.paso = null; irA('sesion'); setTimeout(hojaPendientes, 350); },
    'descartar-ayer': () => { const n = S.ayer.nombre; S.ayer = null; pintar(); aviso('Sesión de ayer descartada', `«${n}» no cuenta en tu semana.`, 'info'); },
    'ir-grupo': () => { S.grupo = b.dataset.g; },
    // Check-in
    'ci-mia': () => { S.ci.mia = v || null; pintar(); },
    'ci-ocupar': () => { S.ci.ocupar = !S.ci.ocupar; pintar(); },
    'ci-lugar': () => { S.ci.lugar = v; refrescarCi(b); },
    'ci-min': () => { S.ci.minutos = +v; refrescarCi(b); },
    'ci-energia': () => { S.ci.energia = +v; refrescarCi(b); },
    'ci-zona': () => { S.ci.dolor[v] = 3; pintar(); $(`#ci-dolor-${v}-et`)?.closest('.selector').querySelector('[role="spinbutton"]').focus(); },
    'ci-alarma': () => { S.ci.alarma = !S.ci.alarma; b.setAttribute('aria-pressed', String(S.ci.alarma)); $('[data-act="preparar"]').textContent = S.ci.alarma ? 'Hoy no entreno' : 'Preparar mi sesión'; },
    'ci-ia': () => { S.ci.forzarIA = !S.ci.forzarIA; $('#previa').outerHTML = htmlPrevia(S.ci); $('#previa [data-act="ci-ia"]')?.focus(); },
    preparar: () => {
      if (S.ci.alarma) { abrirHoja('Hoy no toca entrenar', `<p class="hoja-texto">Hoy no toca entrenar. Lo que notas puede necesitar que te vea un profesional.</p><p class="hoja-texto">Si es dolor en el pecho, mareo fuerte, falta de aire que no cede, dificultad para hablar o pérdida de fuerza de un lado del cuerpo, llama al 112.</p><p class="hoja-texto">En los demás casos, pide cita con tu médico o tu fisioterapeuta y cuéntale lo que notas. Cuando te den el visto bueno, la app retoma tu plan.</p><a class="boton" href="#hoy" data-act="cerrar-hoja">Entendido</a>`); return; }
      const pv = previa(S.ci);
      if (pv.usar) abrirEspera('sesion');
      else { S.sesion = sesionNueva(S.p); S.sesion.fuente = 'app'; if (pv.mia) { S.sesion.origenMia = pv.mia.nombre; S.sesion.nombre = pv.mia.nombre; } S.paso = null; irA('sesion'); aviso('Sesión lista', 'La ha ajustado la app con tus datos de hoy.'); }
    },
    'cancelar-ia': () => { $('#espera-vivo').textContent = 'Cancelado: la hace la app…'; setTimeout(() => terminarEspera(false), 400); },
    'reintentar-ia': () => { abrirEspera('sesion'); },
    // Sesión
    modo: () => { S.modo = v; S.paso = null; pintar(); $(`#app [data-act="modo"][data-v="${v}"]`)?.focus(); },
    paso: () => { const P = pasos(s); S.paso = Math.max(0, Math.min(P.length - 1, S.paso + +v)); pintar(); window.scrollTo(0, 0); },
    'ir-paso': () => { S.paso = +v; pintar(); window.scrollTo(0, 0); $('#app .pasos-sesion [aria-current]')?.focus(); },
    tarea: () => { const t = s[b.dataset.k][+b.dataset.i]; t.hecho = !t.hecho; if (s.estado === 'pendiente') s.estado = 'en_curso'; pintar(); $(`#app [data-act="tarea"][data-k="${b.dataset.k}"][data-i="${b.dataset.i}"]`)?.focus(); },
    'serie-hecha': () => marcarSerie(+b.dataset.e, +b.dataset.s),
    contador: () => abrirContador(+b.dataset.e, +b.dataset.s),
    'contador-ya': () => { cont.fase = 'trabajo'; cont.inicio = Date.now(); pintarContador(); },
    'contador-pausa': () => { if (cont.pausa != null) { cont.inicio = Date.now() - cont.pausa; cont.pausa = null; } else cont.pausa = Date.now() - cont.inicio; pintarContador(); },
    'contador-hecho': () => { if (cont.t.lados > 1 && cont.lado === 1) { cont.tiempos.push(Math.round((Date.now() - cont.inicio) / 1000)); cont.lado = 2; cont.fase = 'previa'; cont.inicio = Date.now(); pintarContador(); return; } cerrarContador(true); },
    'contador-cancelar': () => cerrarContador(false),
    'desc-mas': () => { if (S.alarma) { S.alarma = null; empezarDescanso(15, 'Descanso extra'); return; } S.descanso.fin += 15000; S.descanso.total += 15; pintarDescanso(); },
    'desc-menos': () => { S.descanso.fin -= 15000; pintarDescanso(); },
    'desc-saltar': () => { S.descanso = null; pintarDescanso(); $('#app [data-act="serie-hecha"]')?.focus(); },
    'desc-cerrar': () => { S.alarma = null; clearTimeout(S.alarmaFin); pintarDescanso(); $('#app [data-act="serie-hecha"]')?.focus(); },
    'menu-ej': () => hojaMenuEj(+b.dataset.e),
    ficha: () => hojaFicha(b.dataset.id),
    gusto: () => { const id = b.dataset.id; if (S.gustos[id] === v) delete S.gustos[id]; else S.gustos[id] = v; const ant = b.closest('.hoja'); const menu = b.dataset.menu; if (menu != null) hojaMenuEj(+menu); else if (ant) hojaFicha(id); if (v === 'rechazo' && S.gustos[id]) aviso('No volverá a salir', 'Puedes cambiarlo ahora por otro.', 'info'); },
    'cambiar-ej': () => hojaCambiar(+b.dataset.e),
    'cambiar-por': () => { const i = +b.dataset.e, x = s.ejercicios[i]; const n = ex(b.dataset.id); s.ejercicios[i] = { id: n.id, rol: x.rol, series: x.series, reps: n.t === ex(x.id).t ? x.reps : '10-12', descanso: x.descanso, nota: `En lugar de ${minus(ex(x.id).n)}.`, sets: Array.from({ length: x.series }, () => ({ kg: null, valor: null, hecha: false })) }; if (n.mat.some(m => CON_PESO.includes(m))) s.ejercicios[i].kg = 10; cerrarHoja(); setTimeout(pintar, 220); aviso('Ejercicio cambiado', `${n.n} en lugar de ${minus(ex(x.id).n)}.`); },
    'serie-mas': () => { const x = s.ejercicios[+b.dataset.e]; if (+v > 0) x.sets.push({ kg: null, valor: null, hecha: false }); else if (x.sets.length > 1) x.sets.pop(); x.series = x.sets.length; cerrarHoja(); setTimeout(pintar, 220); },
    comentar: () => { s.ejercicios[+b.dataset.e].comentario = $('#m-com').value.trim(); cerrarHoja(); aviso('Comentario guardado', 'Lo leerá tu entrenador en la próxima sesión.'); },
    'guardar-mia': hojaMia,
    'mia-ok': () => { const n = ($('#mia-nombre').value || '').trim(); if (!n) { aviso('Ponle un nombre', 'Así la encontrarás en «Antes de empezar».', 'error'); return; } S.perfil.mias.push({ id: `m${Date.now()}`, nombre: n, lugar: s.lugar, minutos: 45, ej: s.ejercicios.map(x => [x.id, x.series, x.reps]) }); s.origenMia = n; cerrarHoja(); setTimeout(pintar, 220); aviso('Guardada en tus sesiones', `«${n}»`); },
    terminar: () => { const pend = s.ejercicios.some(x => x.sets.some(z => !z.hecha)); if (pend) hojaPendientes(); else hojaCierre(); },
    'seguir-sesion': () => cerrarHoja(),
    'terminar-igual': () => { cerrarCapa(true); hojaCierre(); },
    esfuerzo: () => { S.cierre.esfuerzo = +v; unico(b.closest('[role="radiogroup"]'), b); $('#esf-txt').textContent = D.ESFUERZO[+v - 1][1]; },
    'guardar-sesion': () => { S.cierre.comentario = $('#c-com').value.trim(); s.estado = 'hecha'; s.cierre = { esfuerzo: S.cierre.esfuerzo, comentario: S.cierre.comentario || 'Sin comentarios.' }; s.vuelta.forEach(t => { t.hecho = true; }); const d = diaHoy(); S.descanso = null; S.alarma = null; pintarDescanso(); cerrarCapa(true); celebrar(); if (d) d.estado = 'hecho'; },
    'fin-hoy': () => { $('#capa').innerHTML = ''; $('#app').inert = false; $('#pestanas').inert = false; irA('hoy'); },
    descartar: () => abrirHoja(`¿Descartar «${h(s.nombre)}»?`, `<p class="hoja-texto">Se borra lo apuntado en ella: ${hechasSeries(s)} series hechas.</p><div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="cerrar-hoja">Seguir con la sesión</button><button type="button" class="boton boton--peligro" data-act="descartar-ok">Descartar sesión</button></div>`),
    'descartar-ok': () => { cerrarCapa(true); S.sesion = null; S.descanso = null; pintarDescanso(); irA('hoy'); aviso('Sesión descartada', '', 'info'); },
    // Progreso
    medidas: hojaMedidas,
    'medidas-ok': () => { cerrarHoja(); aviso('Medidas guardadas', 'Se ven en Salud.'); },
    'hoja-ej-prog': () => hojaFicha(b.dataset.id),
    // Perfil
    grupo: () => { S.grupo = v; pintar(); $(`#app [data-act="grupo"][data-v="${v}"]`)?.focus(); },
    objetivo: () => { const o = S.perfil.objetivos, i = o.indexOf(v); if (i >= 0) o.splice(i, 1); else o.push(v); b.setAttribute('aria-pressed', String(i < 0)); },
    nivel: () => { S.perfil.nivel = +v; unico(b.closest('[role="radiogroup"]'), b); },
    'nivel-auto': () => { S.perfil.nivelAuto = !S.perfil.nivelAuto; b.setAttribute('aria-pressed', String(S.perfil.nivelAuto)); },
    lesion: () => hojaLesion(b.dataset.id),
    'le-zona': () => { S.le.zona = v; $$('[data-act="le-zona"]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); },
    'le-tipo': () => { S.le.tipo = v; unico(b.closest('[role="radiogroup"]'), b); },
    'le-activa': () => { S.le.activa = !S.le.activa; b.setAttribute('aria-pressed', String(S.le.activa)); },
    'le-guardar': () => { const le = { ...S.le, desde: $('#le-desde').value, nota: $('#le-nota').value.trim() }; const L = S.perfil.lesiones; const i = L.findIndex(x => x.id === le.id); if (i >= 0) L[i] = le; else L.push({ ...le, id: `l${Date.now()}` }); cerrarHoja(); setTimeout(pintar, 220); aviso('Lesión guardada', 'El entrenador la tendrá en cuenta desde la próxima sesión.'); },
    'le-borrar': () => abrirHoja(`¿Borrar ${minus(D.ZONAS[S.le.zona][1])}?`, `<p class="hoja-texto">Se borra de tu perfil. Si ya está curada, mejor desmárcala: así el entrenador sabe que la tuviste.</p><div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="cerrar-hoja">Cancelar</button><button type="button" class="boton boton--peligro" data-act="le-borrar-ok">Borrar lesión</button></div>`),
    'le-borrar-ok': () => { S.perfil.lesiones = S.perfil.lesiones.filter(x => x.id !== S.le.id); cerrarCapa(true); pintar(); aviso('Lesión borrada', '', 'info'); },
    salud: () => { const sl = S.perfil.salud; sl[v] = !sl[v]; b.setAttribute('aria-pressed', String(!!sl[v])); },
    medicacion: () => { const m = S.perfil.salud.medicacion = S.perfil.salud.medicacion || []; const i = m.indexOf(v); if (i >= 0) m.splice(i, 1); else m.push(v); b.setAttribute('aria-pressed', String(i < 0)); },
    'perfil-min': () => { S.perfil.minutos = +v; unico(b.closest('[role="radiogroup"]'), b); },
    lugar: () => { const l = S.perfil.lugares, i = l.indexOf(v); if (i >= 0 && l.length > 1) l.splice(i, 1); else if (i < 0) l.push(v); pintar(); $(`#app [data-act="lugar"][data-v="${v}"]`)?.focus(); },
    material: () => { const m = S.perfil.materialCasa, i = m.indexOf(v); if (i >= 0) m.splice(i, 1); else m.push(v); b.setAttribute('aria-pressed', String(i < 0)); },
    acompanado: () => { S.perfil.acompañado = !S.perfil.acompañado; b.setAttribute('aria-pressed', String(S.perfil.acompañado)); },
    nadar25: () => { S.perfil.nadar25 = !S.perfil.nadar25; b.setAttribute('aria-pressed', String(S.perfil.nadar25)); },
    mia: () => hojaMiaPerfil(b.dataset.id),
    'mia-renombrar': () => { const m = S.perfil.mias.find(x => x.id === b.dataset.id); m.nombre = $('#mia-n').value.trim() || m.nombre; cerrarHoja(); setTimeout(pintar, 220); aviso('Nombre guardado', `«${m.nombre}»`); },
    'mia-borrar': () => { const m = S.perfil.mias.find(x => x.id === b.dataset.id); abrirHoja(`¿Borrar «${h(m.nombre)}»?`, `<p class="hoja-texto">Deja de estar en «Antes de empezar». Las sesiones que ya hiciste con ella siguen en tu historial.</p><div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="cerrar-hoja">Cancelar</button><button type="button" class="boton boton--peligro" data-act="mia-borrar-ok" data-id="${m.id}">Borrar sesión</button></div>`); },
    'mia-borrar-ok': () => { const n = S.perfil.mias.find(x => x.id === b.dataset.id).nombre; S.perfil.mias = S.perfil.mias.filter(x => x.id !== b.dataset.id); cerrarCapa(true); pintar(); aviso('Sesión borrada', `«${n}» ya no está en tus sesiones.`, 'info'); },
    'quitar-gusto': () => { delete S.gustos[b.dataset.id]; pintar(); },
    'uso-ia': () => { S.perfil.usoIA = v; pintar(); $(`#app [data-act="uso-ia"][data-v="${v}"]`)?.focus(); },
    sexo: () => { S.perfil.datos.sexo = v; unico(b.closest('[role="radiogroup"]'), b); },
    ajuste: () => { S[v] = S[v] === false; b.setAttribute('aria-pressed', String(S[v] !== false)); },
    'copia-guardar': () => aviso('Copia guardada', `pipos-${S.p}-2026-11-21.json, en Descargas.`),
    'copia-cargar': () => aviso('Elige el archivo de la copia', 'En el prototipo no se carga nada.', 'info'),
    'nube-copiar': () => aviso('Copia hecha en la nube'),
    'nube-lista': () => abrirHoja(`Copias en la nube de ${persona()}`, `<ul class="lista">${['hoy, 9:05', 'ayer, 20:14', '19 nov, 19:40'].map((t, i) => `<li><button type="button" class="fila" data-act="nube-restaurar"><span class="crece"><b>${t}</b><span>${[127, 126, 125][i]} sesiones, se abre con tu frase</span></span>${ico('sig')}</button></li>`).join('')}</ul>`),
    'nube-restaurar': () => abrirHoja('¿Restaurar esta copia?', `<p class="hoja-texto">Se cambian los datos de este móvil por los de la copia. Lo de ahora se guarda aparte y se puede deshacer.</p><div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="cerrar-hoja">Cancelar</button><button type="button" class="boton" data-act="cerrar-hoja">Restaurar copia</button></div>`),
    'nube-frase': () => abrirHoja('Cambiar la frase', `<div class="campo"><label for="n-f1">Frase de recuperación <small>al menos 16 caracteres; mejor varias palabras sin relación</small></label><input id="n-f1" type="password" autocomplete="new-password"></div><div class="campo"><label for="n-f2">Repite la frase</label><input id="n-f2" type="password" autocomplete="new-password"></div><button type="button" class="boton" data-act="cerrar-hoja">Cambiar la frase</button>`),
    'nube-recuperar': () => abrirHoja('Recuperar de la nube', `<div class="grupo"><p class="grupo-et">¿De quién son las copias?</p><div class="segmento" role="radiogroup" aria-label="De quién son las copias"><button type="button" role="radio" aria-checked="${S.p === 'victor'}" tabindex="0">Víctor</button><button type="button" role="radio" aria-checked="${S.p === 'virginia'}" tabindex="-1">Virginia</button></div></div><div class="campo"><label for="n-fr">Frase de recuperación <small>vale también una frase anterior</small></label><input id="n-fr" type="password" autocomplete="current-password"></div><button type="button" class="boton" data-act="nube-lista">Buscar copias</button>`),
    'cambiar-dueno': () => abrirHoja('¿Cambiar de quién es este móvil?', `<p class="hoja-texto">Lo de ${persona()} se guarda aparte y se trae lo de la persona que elijas. Sexo, altura y año de nacimiento se reponen si vuelves.</p><div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="cerrar-hoja">Cancelar</button><a class="boton" href="?p=${S.p}&amp;e=bienvenida#bienvenida">Cambiar de persona</a></div>`),
    // Ejercicios
    filtro: () => { S.filtro[b.dataset.k] = v; pintar(); $(`#app [data-act="filtro"][data-k="${b.dataset.k}"][data-v="${v}"]`)?.focus(); },
    'limpiar-filtros': () => { S.filtro = { texto: '', lugar: '', musculo: '', gusto: '' }; pintar(); },
    // Bienvenida
    'elegir-dueno': () => { location.href = `?p=${v}#hoy`; },
  };
  if (ACC[a]) { if (b.tagName === 'A' && a !== 'ir-grupo' && a !== 'cerrar-hoja') e.preventDefault(); ACC[a](); }
});
function refrescarCi(b) { unico(b.closest('[role="radiogroup"]'), b); const et = b.closest('.grupo').querySelector('.grupo-et b'); if (et) et.textContent = D.ENERGIA[S.ci.energia]; $('#previa').outerHTML = htmlPrevia(S.ci); $('#previa').classList.add('cambiado'); }

// ───────────────────────── menú del prototipo ─────────────────────────
const enlace = (e, r, p = S.p) => (e.startsWith('g:') ? `?p=${p}&g=${e.slice(2)}#${r}` : `?p=${p}&e=${e}#${r}`);
function menuPrototipo() {
  abrirHoja('Prototipo', `<p class="hoja-texto">Elige persona y pantalla. Nada se guarda: al recargar vuelve a empezar.</p>
    <div class="segmento segmento--ancho" role="radiogroup" aria-label="Ver como">${['victor', 'virginia'].map(p => `<a role="radio" aria-checked="${S.p === p}" tabindex="${S.p === p ? 0 : -1}" class="boton ${S.p === p ? '' : 'boton--secundario'}" href="${enlace(S.e, location.hash.slice(1) || 'hoy', p)}">${p === 'victor' ? 'Víctor' : 'Virginia'}</a>`).join('')}</div>
    <div class="proto-mapa">${MAPA.map(([g, l]) => `<h3>${g}</h3><div class="chips">${l.map(([n, e, r]) => `<a class="chip" href="${enlace(e, r)}">${h(n)}</a>`).join('')}</div>`).join('')}</div>
    <p class="ayuda bloque-mini"><a href="../identidad/">Identidad</a> · <a href="../sistema/">Sistema de diseño</a></p>`);
}

// ───────────────────────── arranque ─────────────────────────
const p0 = PARAMS.get('p') === 'virginia' ? 'virginia' : 'victor';
const e0 = PARAMS.get('e') || 'plan';
S = nuevoEstado(p0, e0);
document.documentElement.dataset.persona = p0;
if (CAPTURA) $('#proto').hidden = true;
$('#pestanas').innerHTML = TABS.map(([r, n, i]) => `<a class="pestana" href="#${r}" data-tab="${r}">${ico(i)}${n}</a>`).join('');
window.addEventListener('hashchange', () => ir(location.hash.slice(1)));
ir(location.hash.slice(1) || (e0 === 'bienvenida' ? 'bienvenida' : 'hoy'));
// Escenarios que abren algo encima
const abrir = {
  espera: () => vista === 'checkin' && abrirEspera('sesion'),
  ficha: () => hojaFicha(S.sesion.ejercicios[0].id), 'ficha-ej': () => hojaFicha('plancha'), menu: () => hojaMenuEj(0), cambiar: () => { marcarHecho(S.sesion, 0, 1); S.paso = null; pintar(); hojaCambiar(0); }, mia: hojaMia,
  pendientes: () => hojaPendientes(), cierre: () => hojaCierre(), final: () => celebrar(),
  'descanso-s': () => empezarDescanso(84, 'Serie 2 de ' + S.sesion.ejercicios[0].series), alarma: () => terminarDescanso(0), volver: () => terminarDescanso(40),
  tiempo: () => abrirContador(S.sesion.ejercicios.findIndex(x => porTiempo(x) && x.rol !== 'cardio'), 0), cardio: () => abrirContador(S.sesion.ejercicios.length - 1, 0),
  medidas: () => vista === 'progreso' && hojaMedidas(), 'lesion-nueva': () => { S.grupo = 'lesiones'; pintar(); hojaLesion(); }, 'lesion-editar': () => { S.grupo = 'lesiones'; pintar(); hojaLesion(S.perfil.lesiones[0].id); },
};
if (abrir[e0]) setTimeout(abrir[e0], CAPTURA ? 0 : 350);
if (S.descanso) { S.descanso.fin = Date.now() + 84000; pintarDescanso(); }
