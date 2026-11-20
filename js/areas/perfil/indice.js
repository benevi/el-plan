// Área PERFIL: todo lo que el entrenador necesita saber de la persona, editable en cualquier momento.
// Objetivos (varios), nivel, lesiones y dolor, disponibilidad de la semana, lugares, material de casa,
// datos personales, notas para el entrenador y ajustes del móvil (código de acceso, vibración, copia).

import { rutas, acciones, pestaña, pintar } from '../../nucleo/router.js';
import { estado, cambiar, uid, hoyISO, exportar, importar, marcarCopiaExportada, infoCopia, usoAlmacen, ErrorCopia,
  infoAntesDeImportar, deshacerImportar, descartarAntesDeImportar, soltarDueño, confirmarSexo, migracionDeOtro, migrarDeViejo, resultadoMigracion } from '../../nucleo/estado.js';
import { esViejo } from '../../nucleo/migracion.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num, es, fechaCorta } from '../../nucleo/ui.js';
import { OBJETIVOS, NIVELES, LUGARES, MATERIAL, MATERIAL_CASA, PERSONAS, GUSTOS } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { bloqueMedidor, tarjetaAnalisis } from '../entrenador/indice.js';
import { versionApp } from '../../nucleo/version.js';
import { grupoCopias, avisoNube, siVisible } from './nube.js';

const chip = (act, val, on, txt) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${h(val)}" aria-pressed="${on}">${h(txt)}</button>`;

// El perfil va por grupos (antes era una página de 2200 px): se ve uno cada vez.
const GRUPOS = [['objetivos', 'Objetivos y nivel'], ['lesiones', 'Lesiones'], ['entreno', 'Mi entreno'], ['datos', 'Mis datos'], ['copias', 'Copias'], ['ajustes', 'Ajustes']];
let grupo = 'objetivos';
siVisible(() => grupo === 'copias');
const TIPOS_LESION = { lesion: 'Lesión diagnosticada', recurrente: 'Dolor que va y viene', puntual: 'Molestia puntual (días)' };
const USO_IA = {
  auto: ['Automático', 'La IA monta la semana y revisa el día solo cuando hace falta (dolor nuevo, una petición, otro lugar, comentarios). Unos 0,25 € por semana y 0,10 € por día revisado.'],
  siempre: ['Siempre', 'La IA rehace cada sesión con tu check-in. Unos 0,10 € por sesión.'],
  ahorro: ['Ahorro', 'La IA solo cuando la pidas para la semana. El día lo ajusta la app.'],
};

function vista() {
  const S = estado(), p = S.perfil;
  const resumen = [
    p.objetivos.length ? p.objetivos.map(o => OBJETIVOS[o].nombre).join(', ') : 'Sin objetivos',
    NIVELES[p.nivel],
    `${p.lesiones.filter(l => l.activa).length} lesiones activas`,
  ].join(' · ');
  return `
  <h1 class="titulo">Tu perfil</h1>
  <p class="tenue">${h(resumen)}</p>
  ${avisosMigracion(S)}
  ${grupo !== 'copias' ? avisoNube() : ''}
  <nav class="chips grupos" aria-label="Partes del perfil">${GRUPOS.map(([k, n]) => `<button class="chip ${grupo === k ? 'on' : ''}" data-act="perfil.grupo" data-v="${k}" aria-pressed="${grupo === k}">${h(n)}</button>`).join('')}</nav>
  ${({ objetivos: grupoObjetivos, lesiones: grupoLesiones, entreno: grupoEntreno, datos: grupoDatos, copias: grupoCopias, ajustes: grupoAjustes }[grupo] || grupoObjetivos)(S)}`;
}

const nombre = d => (PERSONAS[d] ? PERSONAS[d].nombre : '—');
const SEXO = { h: 'Hombre', m: 'Mujer' };
// Lo más probable para cada persona (se marca, pero se pregunta igual).
const SEXO_PROBABLE = { victor: 'h', virginia: 'm' };
// Lo que quedó pendiente de la migración desde la app anterior: preguntar en vez de adivinar.
// Qué pasa exactamente al cambiar de dueño (js/nucleo/migracion.js: retirar y reponer).
const QUEDA = 'Se queda, para la nueva persona, todo lo hecho en esta app: sesiones, plan, objetivos, nivel, lesiones y medidas apuntadas aquí. Sexo, altura y año de nacimiento se guardan aparte y se reponen si vuelves. ¿Seguir?';
const TEXTO_CAMBIO_DUEÑO = '¿Cambiar de quién es este móvil? Lo traído de la app anterior se guarda aparte (con tus cambios) y se trae lo de la persona que elijas. ' + QUEDA;
export { QUEDA };
function avisosMigracion(S) {
  const m = S.migracion || {};
  const porRevisar = S.perfil.lesiones.filter(l => l.activa && l.dolorRevisar).length;
  return `${m.sexoRevisar ? `<section class="tarjeta aviso-nota revisar-sexo">
      <p>Al pasar tus datos de la app anterior el sexo pudo quedar cambiado. Ahora pone <b>${h(SEXO[S.perfil.datos.sexo] || 'nada')}</b>. ¿Cuál es el correcto?</p>
      <div class="fila-botones">${[['h', 'Hombre'], ['m', 'Mujer']].map(([k, n]) => `<button class="btn ${k === SEXO_PROBABLE[S.dueño] ? 'probable' : 'sec'}" data-act="perfil.sexoRevisado" data-v="${k}">${n}</button>`).join('')}</div></section>` : ''}
    ${migracionDeOtro() ? `<section class="tarjeta aviso-nota migracion-otro">
      <p>Lo que se trajo de la app anterior es de ${h(nombre(m.dueño))}, no de ${h(nombre(S.dueño))}.</p>
      <button class="btn sec" data-act="perfil.rehacerMigracion">Traer lo de ${h(nombre(S.dueño))}</button></section>` : ''}
    ${porRevisar && grupo !== 'lesiones' ? `<p class="nota aviso-nota">Tienes ${+porRevisar} lesi${porRevisar > 1 ? 'ones' : 'ón'} de la app anterior con el dolor estimado. <button class="enlace" data-act="perfil.grupo" data-v="lesiones">Revísalo</button></p>` : ''}`;
}

function grupoObjetivos(S) {
  const p = S.perfil;
  return `<section class="tarjeta">
    <h2>Objetivos <small>puedes marcar varios</small></h2>
    <div class="chips">${Object.entries(OBJETIVOS).map(([k, o]) => chip('perfil.objetivo', k, p.objetivos.includes(k), o.nombre)).join('')}</div>
  </section>
  <section class="tarjeta">
    <h2>Nivel</h2>
    <div class="segmentos">${Object.entries(NIVELES).map(([k, n]) => `<button class="${+k === p.nivel ? 'on' : ''}" data-act="perfil.nivel" data-v="${k}">${h(n)}</button>`).join('')}</div>
    <label class="interruptor"><input type="checkbox" data-cambio="perfil.nivelAuto" ${p.nivelAuto ? 'checked' : ''}><span>Que mi progreso me cambie de nivel</span></label>
    ${bloqueMedidor(S)}
  </section>
  ${tarjetaAnalisis(S)}`;
}

function grupoLesiones(S) {
  const p = S.perfil;
  const lesiones = p.lesiones.slice().sort((a, b) => b.activa - a.activa);
  return `<section class="tarjeta">
    <h2>Lesiones y dolor</h2>
    <p class="tenue">Cambian con el tiempo: apúntalas, ajusta el dolor y desmárcalas cuando se curen. El entrenador quita lo que las carga y añade rehabilitación.</p>
    ${lesiones.some(l => l.activa && l.dolorRevisar) ? '<p class="nota aviso-nota">El dolor de las lesiones traídas de la app anterior es una estimación. Toca cada una y pon cuánto te duele ahora.</p>' : ''}
    ${lesiones.length ? `<ul class="lista">${lesiones.map(l => `<li class="${l.activa ? '' : 'apagada'}">
      <button class="fila" data-act="perfil.lesion" data-id="${h(l.id)}">
        <span class="grow"><b>${h(ZONAS[l.zona] ? ZONAS[l.zona].nombre : l.zona)}</b><span class="tenue">${l.activa ? `Dolor ${+l.dolor}/10${l.dolorRevisar ? ' (estimado: revísalo)' : ''}` : 'Curada'}${l.tipo ? ' · ' + h(TIPOS_LESION[l.tipo]) : ''}${l.detalle && ZONAS[l.zona] && ZONAS[l.zona].detalles && ZONAS[l.zona].detalles.opciones[l.detalle] ? ' · ' + h(ZONAS[l.zona].detalles.opciones[l.detalle].nombre.toLowerCase()) : ''}${l.desde ? ' · desde ' + h(l.desde) : ''}${l.nota ? ' · ' + h(l.nota) : ''}</span></span>
        ${ICONOS.editar}</button></li>`).join('')}</ul>` : '<p class="tenue">Sin lesiones apuntadas.</p>'}
    <button class="btn sec" data-act="perfil.lesion">${ICONOS.mas} Añadir lesión o dolor</button>
  </section>`;
}

function grupoEntreno(S) {
  const p = S.perfil, d = p.disponibilidad;
  const gustos = Object.entries(p.gustos || {});
  return `<section class="tarjeta">
    <h2>Disponibilidad habitual</h2>
    <p class="tenue">Cada semana eliges los días al montar la semana; esto es lo habitual.</p>
    <div class="campo"><span>Días por semana</span>
      <div class="paso"><button data-act="perfil.dias" data-v="-1" aria-label="Menos">${ICONOS.menos}</button><b>${+d.dias}</b><button data-act="perfil.dias" data-v="1" aria-label="Más">${ICONOS.mas}</button></div></div>
    <div class="campo col"><span>Minutos por sesión</span>
      <div class="chips">${[30, 45, 60, 75, 90].map(m => chip('perfil.minutos', m, d.minutos === m, m + ' min')).join('')}</div></div>
  </section>
  <section class="tarjeta">
    <h2>Dónde entrenas</h2>
    <div class="chips">${Object.entries(LUGARES).map(([k, n]) => chip('perfil.lugar', k, p.lugares.includes(k), n)).join('')}</div>
    ${p.lugares.includes('casa') ? `<h3>Material que tienes ahora en casa</h3><div class="chips">${MATERIAL_CASA.map(m => chip('perfil.material', m, p.materialCasa.includes(m), MATERIAL[m])).join('')}</div>` : ''}
    <label class="interruptor"><input type="checkbox" data-cambio="perfil.acompañado" ${p.acompañado ? 'checked' : ''}><span>Entreno a la vez que otra persona</span></label>
  </section>
  <section class="tarjeta">
    <h2>Ejercicios que has valorado</h2>
    ${gustos.length ? `<ul class="lista">${gustos.map(([id, g]) => `<li><button class="fila" data-act="perfil.quitarGusto" data-id="${h(id)}"><span class="grow"><b>${h(ex(id) ? ex(id).n : id)}</b><span class="tenue">${GUSTOS[g] ? GUSTOS[g].icono + ' ' + h(GUSTOS[g].nombre) : ''}</span></span><span class="tenue">Quitar</span></button></li>`).join('')}</ul>`
      : '<p class="tenue">Valora los ejercicios durante la sesión (me gusta, no me gusta, no lo quiero) y el entrenador lo tendrá en cuenta.</p>'}
  </section>
  <section class="tarjeta">
    <h2>Entrenador IA</h2>
    <div class="segmentos">${Object.entries(USO_IA).map(([k, [n]]) => `<button class="${(p.usoIA || 'auto') === k ? 'on' : ''}" data-act="perfil.usoIA" data-v="${k}">${h(n)}</button>`).join('')}</div>
    <p class="tenue">${h(USO_IA[p.usoIA || 'auto'][1])}</p>
  </section>`;
}

function grupoDatos(S) {
  const p = S.perfil;
  const año = String(p.datos.nacimiento || '').slice(0, 4);
  return `<section class="tarjeta">
    <h2>Tus datos</h2>
    <div class="rejilla">
      <label class="campo col"><span>Sexo</span><select data-cambio="perfil.dato" data-k="sexo"><option value="">—</option><option value="h" ${p.datos.sexo === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.datos.sexo === 'm' ? 'selected' : ''}>Mujer</option></select></label>
      <label class="campo col"><span>Altura (cm)</span><input type="number" inputmode="numeric" data-cambio="perfil.dato" data-k="altura" value="${h(p.datos.altura || '')}"></label>
      <label class="campo col"><span>Año de nacimiento</span><input type="number" inputmode="numeric" min="1930" max="2015" placeholder="1985" data-cambio="perfil.dato" data-k="nacimiento" value="${h(año)}"></label>
    </div>
  </section>
  <section class="tarjeta">
    <h2>Para tu entrenador</h2>
    <textarea rows="3" data-cambio="perfil.notas" placeholder="Lo que quieras que tenga en cuenta: horarios, metas concretas, cosas que no te gustan…">${h(p.notas)}</textarea>
  </section>`;
}

function grupoAjustes(S) {
  return `<section class="tarjeta">
    <h2>Ajustes del móvil</h2>
    <label class="campo col"><span>Código de acceso a la IA</span><input type="password" autocomplete="off" data-cambio="perfil.codigo" value="${h(S.ajustes.codigo)}" placeholder="El mismo que APP_CODE en Vercel"></label>
    <label class="interruptor"><input type="checkbox" data-cambio="perfil.ajuste" data-k="vibrar" ${S.ajustes.vibrar ? 'checked' : ''}><span>Vibrar al acabar el descanso</span></label>
    <label class="interruptor"><input type="checkbox" data-cambio="perfil.ajuste" data-k="sonido" ${S.ajustes.sonido ? 'checked' : ''}><span>Pitido al acabar el descanso</span></label>
    <div class="fila-botones"><button class="btn sec" data-act="perfil.exportar">Guardar copia</button><button class="btn sec" data-act="perfil.importar">Cargar copia</button></div>
    ${puedeCompartirArchivos() ? '<button class="enlace" data-act="perfil.compartir">Enviar la copia a otra app (Archivos, Drive…)</button>' : ''}
    <p class="tenue aviso-salud">La copia lleva tus datos de salud (lesiones, dolor, medidas y entrenos), sin el código de acceso. Guárdala en un sitio privado.</p>
    ${bloqueCopia()}
    ${bloqueDeshacer()}
    <p class="tenue pie">Móvil de ${h(nombre(S.dueño))} · <button class="enlace" data-act="perfil.cambiarDueño">cambiar</button></p>
    <p class="tenue pie version-app">Versión de la app: <span data-version-app>${h(versionApp() || '—')}</span></p>
  </section>`;
}

// Uso del almacenamiento y última copia exportada (los datos solo viven en este móvil).
const tamaño = b => b < 1024 ? b + ' B' : b < 1024 * 1024 ? es(b / 1024, 0) + ' KB' : es(b / 1024 / 1024, 1) + ' MB';
export function recordatorioCopia() {
  const c = infoCopia();
  if (!c.toca) return avisoNube();
  return avisoNube() + `<p class="nota aviso-nota recordatorio-copia">Llevas ${c.sesionesDesde} sesiones sin guardar una copia. Tus datos solo están en este móvil.
    <button class="enlace" data-act="perfil.exportar">Guardar copia</button></p>`;
}
function bloqueCopia() {
  const u = usoAlmacen(), c = infoCopia();
  const pct = u.porcentaje < 1 ? 'menos del 1 %' : `${es(u.porcentaje, 0)} %`;
  return `<p class="tenue uso-almacen">Tus datos ocupan ${tamaño(u.bytes)}, ${pct} de unos 5 MB que deja el navegador.</p>
    <p class="tenue ultima-copia">${c.fecha ? `Última copia guardada: ${h(fechaCorta(c.fecha))}.` : 'Aún no has guardado ninguna copia.'}</p>
    ${recordatorioCopia()}`;
}

function bloqueDeshacer() {
  const a = infoAntesDeImportar();
  if (!a) return '';
  return `<p class="tenue deshacer-importar">Antes de cargar la última copia (${h(fechaCorta(a.fecha))}) tus datos quedaron apartados (se borran solos a los 7 días).
    <button class="enlace" data-act="perfil.deshacerImportar">Volver a ellos</button> · <button class="enlace" data-act="perfil.descartarAntes">Descartar</button></p>`;
}

// ── Guardar y cargar copias ──
const tipoJSON = 'application/json';
function archivoCopia() {
  const nombreArchivo = `pipos-fitness-${estado().dueño}-${hoyISO()}.json`;
  const txt = exportar();
  return { nombreArchivo, txt, archivo: typeof File === 'function' ? new File([txt], nombreArchivo, { type: tipoJSON }) : null };
}
function puedeCompartirArchivos() {
  try { return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: tipoJSON })] }); } catch { return false; }
}
// iPhone con la app instalada en la pantalla de inicio: ahí la descarga con a.download no funciona.
const iPhoneInstalada = () => /iPad|iPhone|iPod/.test(navigator.userAgent || '') && (navigator.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches));
// Devuelve 'compartida' o 'descargada' si se completó, null si la persona lo canceló. Lanza si no se pudo.
async function compartir(c) {
  try { await navigator.share({ files: [c.archivo], title: c.nombreArchivo }); return 'compartida'; } catch (e) {
    if (e && e.name === 'AbortError') return null;
    throw e;
  }
}
async function guardarArchivo({ forzarCompartir = false } = {}) {
  const c = archivoCopia();
  const share = puedeCompartirArchivos();
  const descarga = 'download' in document.createElement('a');
  if (share && (forzarCompartir || !descarga || iPhoneInstalada())) {
    try { return await compartir(c); } catch (e) { if (forzarCompartir || !descarga) throw e; /* si no, se prueba la descarga */ }
  }
  if (!descarga) throw new Error('este navegador no deja descargar archivos');
  try {
    const url = URL.createObjectURL(new Blob([c.txt], { type: tipoJSON }));
    const a = document.createElement('a');
    a.href = url; a.download = c.nombreArchivo; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'descargada';
  } catch (e) {
    if (share) return compartir(c);
    throw e;
  }
}
async function exportarCopia(opciones) {
  let r;
  try { r = await guardarArchivo(opciones); } catch (e) {
    console.error('No se pudo guardar la copia', e);
    aviso('No se ha podido guardar la copia en este móvil. Prueba con «Enviar la copia a otra app».', 'error');
    return;
  }
  if (!r) return; // cancelado: no cuenta como copia hecha
  marcarCopiaExportada();
  pintar();
  aviso(r === 'compartida' ? 'Copia enviada. Lleva tus datos de salud: guárdala en un sitio privado.' : 'Copia guardada en Descargas. Lleva tus datos de salud: guárdala en un sitio privado.');
}

function avisoCargada(r) {
  const base = r.tipo === 'anterior'
    ? (r.sesiones ? `He traído ${r.sesiones} sesiones de la copia de la app anterior` : 'La copia de la app anterior no traía nada nuevo')
    : 'Copia cargada';
  aviso(r.avisos && r.avisos.length ? `${base}. ${r.avisos.join('. ')}.` : base, r.avisos && r.avisos.length ? 'info' : '');
}
async function cargarCopia(txt, opciones = {}) {
  try { avisoCargada(importar(txt, opciones)); } catch (e) {
    if (e instanceof ErrorCopia && e.codigo === 'otra-persona') {
      if (await confirmar(`${e.message} ¿Seguro que quieres cargarla?`, { si: `Sí, el móvil es de ${nombre(e.info.dueño)}`, peligro: true })) return cargarCopia(txt, { ...opciones, otraPersona: true });
      return;
    }
    if (!(e instanceof ErrorCopia)) console.error(e);
    aviso(e instanceof ErrorCopia ? e.message : 'No se ha podido cargar la copia. Tus datos siguen como estaban.', 'error');
  }
}
function esCopiaVieja(txt) { try { return esViejo(JSON.parse(txt)); } catch { return false; } }

// Detalle opcional de la zona (esguince, fascitis…): un desplegable por zona y solo se ve el de la elegida.
// Sin detalle, el entrenador aplica lo más prudente.
function detallesLesion(l) {
  return Object.entries(ZONAS).filter(([, z]) => z.detalles).map(([k, z]) => {
    const irradia = l.zona === k && l.detalle && (z.detalles.opciones[l.detalle] || {}).irradiado;
    return `<label class="campo col" data-detalle="${h(k)}" ${k === l.zona ? '' : 'style="display:none"'}>
      <span>Detalle <small>opcional; si no lo sabes, la app elige lo más prudente</small></span>
      <select id="l-detalle-${h(k)}" data-cambio="perfil.lesionDetalle"><option value="">No lo sé</option>${Object.entries(z.detalles.opciones).map(([o, d]) => `<option value="${h(o)}" data-irradia="${d.irradiado ? '1' : ''}" ${l.zona === k && l.detalle === o ? 'selected' : ''}>${h(d.nombre)}</option>`).join('')}</select>
      ${z.detalles.ayuda ? `<small class="tenue">${h(z.detalles.ayuda)}</small>` : ''}
      <p class="nota aviso-nota" data-a4="${h(k)}" ${irradia ? '' : 'style="display:none"'}>${h(AVISO_IRRADIADO)}</p></label>`;
  }).join('');
}
// Dolor que baja por el brazo o la pierna (A4 de docs/criterio.md).
const AVISO_IRRADIADO = 'Si es nuevo o va a más, no entrenes y consulta.';

function hojaLesion(l) {
  const nueva = !l;
  l = l || { zona: Object.keys(ZONAS)[0], dolor: 3, desde: hoyISO(), nota: '', activa: true };
  abrirHoja(`<h2>${nueva ? 'Nueva lesión o dolor' : 'Editar lesión'}</h2>
    <label class="campo col"><span>Zona</span><select id="l-zona" data-cambio="perfil.lesionZona">${Object.entries(ZONAS).map(([k, z]) => `<option value="${k}" ${k === l.zona ? 'selected' : ''}>${h(z.nombre)}</option>`).join('')}</select></label>
    ${detallesLesion(l)}
    <label class="campo col"><span>Dolor habitual: <b id="l-dolor-v">${+l.dolor}</b>/10</span><input type="range" id="l-dolor" min="0" max="10" value="${+l.dolor}" oninput="document.getElementById('l-dolor-v').textContent=this.value"></label>
    <div class="campo col"><span>Qué es</span><div class="chips" id="l-tipo">${Object.entries(TIPOS_LESION).map(([k, n]) => `<button type="button" class="chip ${(l.tipo || 'lesion') === k ? 'on' : ''}" data-v="${k}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${h(n)}</button>`).join('')}</div></div>
    <label class="campo col"><span>Desde</span><input type="date" id="l-desde" value="${h(l.desde || '')}"></label>
    <label class="campo col"><span>Nota <small>qué movimientos duelen, diagnóstico…</small></span><textarea id="l-nota" rows="2">${h(l.nota)}</textarea></label>
    ${nueva ? '' : `<label class="interruptor"><input type="checkbox" id="l-activa" ${l.activa ? 'checked' : ''}><span>Sigue activa</span></label>`}
    <div class="fila-botones">${nueva ? '' : `<button class="btn sec peligro" data-act="perfil.borrarLesion" data-id="${h(l.id)}">Borrar</button>`}<button class="btn" data-act="perfil.guardarLesion" data-id="${h(l.id || '')}">Guardar</button></div>`);
  $('#l-zona').dataset.noFoco = '1';
}

const alternar = (lista, v) => { const i = lista.indexOf(v); if (i >= 0) lista.splice(i, 1); else lista.push(v); };

acciones({
  'perfil.grupo': el => { grupo = el.dataset.v; pintar(); window.scrollTo(0, 0); },
  'perfil.acompañado': el => cambiar(S => { S.perfil.acompañado = el.checked; }, 'perfil-silencio'),
  'perfil.usoIA': el => cambiar(S => { S.perfil.usoIA = el.dataset.v; }, 'perfil'),
  'perfil.quitarGusto': el => cambiar(S => { delete S.perfil.gustos[el.dataset.id]; }, 'perfil'),
  'perfil.objetivo': el => cambiar(S => alternar(S.perfil.objetivos, el.dataset.v), 'perfil'),
  'perfil.nivel': el => cambiar(S => { S.perfil.nivel = +el.dataset.v; }, 'perfil'),
  'perfil.nivelAuto': el => cambiar(S => { S.perfil.nivelAuto = el.checked; }, 'perfil'),
  'perfil.dias': el => cambiar(S => { const d = S.perfil.disponibilidad; d.dias = Math.max(1, Math.min(7, d.dias + +el.dataset.v)); }, 'perfil'),
  'perfil.diaSemana': el => cambiar(S => { alternar(S.perfil.disponibilidad.diasSemana, +el.dataset.v); S.perfil.disponibilidad.diasSemana.sort(); if (S.perfil.disponibilidad.diasSemana.length) S.perfil.disponibilidad.dias = S.perfil.disponibilidad.diasSemana.length; }, 'perfil'),
  'perfil.minutos': el => cambiar(S => { S.perfil.disponibilidad.minutos = +el.dataset.v; }, 'perfil'),
  'perfil.lugar': el => cambiar(S => { alternar(S.perfil.lugares, el.dataset.v); if (!S.perfil.lugares.length) S.perfil.lugares.push('gym'); }, 'perfil'),
  'perfil.material': el => cambiar(S => alternar(S.perfil.materialCasa, el.dataset.v), 'perfil'),
  'perfil.dato': el => cambiar(S => { const k = el.dataset.k; S.perfil.datos[k] = k === 'altura' ? num(el.value) : k === 'nacimiento' ? String(el.value || '').slice(0, 4) : el.value; }, 'perfil-silencio'),
  'perfil.notas': el => cambiar(S => { S.perfil.notas = el.value.trim(); }, 'perfil-silencio'),
  'perfil.codigo': el => { cambiar(S => { S.ajustes.codigo = el.value.trim(); }, 'perfil-silencio'); aviso('Código guardado'); },
  'perfil.ajuste': el => cambiar(S => { S.ajustes[el.dataset.k] = el.checked; }, 'perfil-silencio'),
  'perfil.lesionDetalle': el => {
    const a4 = document.querySelector(`[data-a4="${el.id.replace('l-detalle-', '')}"]`);
    if (a4) a4.style.display = el.selectedOptions[0] && el.selectedOptions[0].dataset.irradia ? '' : 'none';
  },
  'perfil.lesionZona': el => document.querySelectorAll('[data-detalle]').forEach(c => { c.style.display = c.dataset.detalle === el.value ? '' : 'none'; }),
  'perfil.lesion': el => hojaLesion(el.dataset.id ? estado().perfil.lesiones.find(l => l.id === el.dataset.id) : null),
  'perfil.guardarLesion': el => {
    const datos = { tipo: ($('#l-tipo .chip.on') || { dataset: { v: 'lesion' } }).dataset.v, zona: $('#l-zona').value, dolor: +$('#l-dolor').value, desde: $('#l-desde').value, nota: $('#l-nota').value.trim(), activa: $('#l-activa') ? $('#l-activa').checked : true };
    const detalle = $(`#l-detalle-${datos.zona}`);
    if (detalle && detalle.value) datos.detalle = detalle.value;
    cambiar(S => {
      const l = el.dataset.id && S.perfil.lesiones.find(x => x.id === el.dataset.id);
      if (l) { Object.assign(l, datos); delete l.dolorRevisar; if (!datos.detalle) delete l.detalle; } else S.perfil.lesiones.push({ id: uid(), ...datos });
      S.dolor.push({ fecha: hoyISO(), zona: datos.zona, dolor: datos.dolor, momento: 'perfil' });
    }, 'perfil');
    cerrarHoja();
  },
  'perfil.borrarLesion': async el => {
    if (!await confirmar('¿Borrar esta lesión? Si ya está curada, mejor desmarca «Sigue activa» para que el entrenador lo sepa.', { si: 'Borrar', peligro: true })) return;
    cambiar(S => { S.perfil.lesiones = S.perfil.lesiones.filter(l => l.id !== el.dataset.id); }, 'perfil');
  },
  'perfil.exportar': () => exportarCopia(),
  'perfil.compartir': () => exportarCopia({ forzarCompartir: true }),
  'perfil.importar': () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
    i.onchange = async () => {
      const f = i.files && i.files[0]; if (!f) return;
      let txt;
      try { txt = await f.text(); } catch { aviso('No he podido leer el archivo', 'error'); return; }
      const vieja = esCopiaVieja(txt);
      const pregunta = vieja
        ? `Es una copia de la app anterior: traeré lo de ${nombre(estado().dueño)} que aún no esté en este móvil. ¿Seguir?`
        : 'Esto sustituye todos los datos de este móvil por los de la copia (lo de ahora queda apartado y puedes volver a ello). ¿Seguir?';
      if (!await confirmar(pregunta, { si: 'Cargar copia' })) return;
      await cargarCopia(txt);
    };
    i.click();
  },
  'perfil.deshacerImportar': async () => {
    const a = infoAntesDeImportar(); if (!a) return;
    if (!await confirmar(`¿Volver a los datos que había antes de cargar la última copia (${fechaCorta(a.fecha)})? Lo de ahora queda apartado en su lugar.`, { si: 'Volver a ellos' })) return;
    try { deshacerImportar(); aviso('Has vuelto a los datos de antes'); } catch (e) { aviso(e.message, 'error'); }
  },
  'perfil.descartarAntes': async () => {
    if (!await confirmar('¿Descartar los datos de antes de la última copia? Ya no podrás volver a ellos.', { si: 'Descartar', peligro: true })) return;
    descartarAntesDeImportar(); pintar();
  },
  'perfil.cambiarDueño': async () => {
    if (!await confirmar(TEXTO_CAMBIO_DUEÑO, { si: 'Cambiar' })) return;
    soltarDueño();
  },
  'perfil.sexoRevisado': el => { confirmarSexo(el.dataset.v); aviso('Gracias, apuntado'); },
  'perfil.rehacerMigracion': async () => {
    const S = estado();
    if (!await confirmar(`Se quitará lo traído de la app anterior de ${nombre(S.migracion.dueño)} y se traerá lo de ${nombre(S.dueño)}. ${QUEDA}`, { si: 'Seguir' })) return;
    cambiar(X => { migrarDeViejo(X.dueño); }, 'perfil');
    const r = resultadoMigracion();
    aviso(`He traído ${r ? r.sesiones : 0} sesiones de la app anterior`);
  },
});

// Prueba de pintado de una copia (router.probarPantallas): todas las partes del perfil.
function probar() {
  const antes = grupo;
  try { for (const [k] of GRUPOS) { grupo = k; vista(); } } finally { grupo = antes; }
}
rutas({ perfil: { titulo: 'Perfil', vista, probar } });
pestaña({ ruta: 'perfil', nombre: 'Perfil', icono: ICONOS.perfil, orden: 40 });
export { vista };
