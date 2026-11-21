// Área PERFIL: todo lo que el entrenador necesita saber de la persona, editable en cualquier momento.
// Objetivos (varios), nivel, lesiones y dolor, disponibilidad de la semana, lugares, material de casa,
// datos personales, notas para el entrenador y ajustes del móvil (código de acceso, vibración, copia).

import { rutas, acciones, pestaña, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar, uid, hoyISO, exportar, importar, marcarCopiaExportada, infoCopia, usoAlmacen, ErrorCopia,
  infoAntesDeImportar, deshacerImportar, descartarAntesDeImportar, soltarDueño, confirmarSexo, migracionDeOtro, migrarDeViejo, resultadoMigracion } from '../../nucleo/estado.js';
import { esViejo } from '../../nucleo/migracion.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num, es, fechaCorta } from '../../nucleo/ui.js';
import { OBJETIVOS, NIVELES, LUGARES, MATERIAL, MATERIAL_CASA, PERSONAS, GUSTOS } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { medidorNivel } from '../../reglas/contexto.js';
import { tarjetaAnalisis } from '../entrenador/indice.js';
import { misSesiones, MAX_MIAS } from '../entrenador/entrenador.js';
import { versionApp } from '../../nucleo/version.js';
import { grupoCopias, avisoNube, siVisible } from './nube.js';
import { grupoSalud } from './salud.js';
import { chip, segmento, selector, alCambiarSelector, devolverFoco, cuenta } from './controles.js';
import { GRUPOS, grupoPerfil, ponerGrupo } from './grupo.js';
import './editor.js';

siVisible(() => grupoPerfil() === 'copias');
const TIPOS_LESION = { lesion: 'Lesión diagnosticada', recurrente: 'Dolor que va y viene', puntual: 'Molestia puntual (días)' };
const USO_IA = {
  auto: ['Automático', 'La IA monta la semana y revisa el día solo cuando hace falta (dolor nuevo, una petición, otro lugar, comentarios). Unos 0,25 € por semana y 0,10 € por día revisado.'],
  siempre: ['Siempre', 'La IA rehace cada sesión con tu check-in. Unos 0,10 € por sesión.'],
  ahorro: ['Ahorro', 'La IA solo cuando la pidas para la semana. El día lo ajusta la app.'],
};
const minus = t => String(t || '').toLowerCase();
// «Ganar músculo, Salud, movilidad y espalda sana · intermedio · 1 lesión activa»
function resumenPerfil(p) {
  const obj = p.objetivos.length ? p.objetivos.map(o => OBJETIVOS[o].nombre).join(', ') : 'Sin objetivos';
  const act = p.lesiones.filter(l => l.activa).length;
  return `${obj} · ${minus(NIVELES[p.nivel] || NIVELES[1])} · ${act ? cuenta(act, 'lesión activa', 'lesiones activas') : 'sin lesiones activas'}`;
}

function vista() {
  const S = estado(), p = S.perfil, g = grupoPerfil();
  return `
  <h1 class="titulo-pantalla">Tu perfil</h1>
  <p class="tenue perfil-resumen">${h(resumenPerfil(p))}</p>
  ${avisosMigracion(S)}
  ${g !== 'copias' ? avisoNube() : ''}
  <nav class="grupos-perfil" aria-label="Partes del perfil"><ul>${GRUPOS.map(([k, n]) => `<li><button type="button" class="chip" data-act="perfil.grupo" data-v="${k}"${g === k ? ' aria-current="true"' : ''}>${h(n)}</button></li>`).join('')}</ul></nav>
  ${({ objetivos: grupoObjetivos, lesiones: grupoLesiones, salud: grupoSalud, entreno: grupoEntreno, datos: grupoDatos, copias: grupoCopias, ajustes: grupoAjustes }[g] || grupoObjetivos)(S)}`;
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
  return `${m.sexoRevisar ? `<section class="aviso aviso-linea aviso--aviso revisar-sexo" role="group" aria-label="Revisa tu sexo">${ICONOS.alerta}<div class="aviso-texto">
      <p>Al pasar tus datos de la app anterior el sexo pudo quedar cambiado. Ahora pone <b>${h(SEXO[S.perfil.datos.sexo] || 'nada')}</b>. ¿Cuál es el correcto?</p>
      <div class="aviso-acciones">${[['h', 'Hombre'], ['m', 'Mujer']].map(([k, n]) => `<button type="button" class="boton ${k === SEXO_PROBABLE[S.dueño] ? 'probable' : 'boton--secundario'}" data-act="perfil.sexoRevisado" data-v="${k}">${n}</button>`).join('')}</div></div></section>` : ''}
    ${migracionDeOtro() ? `<section class="aviso aviso-linea aviso--aviso migracion-otro" role="group" aria-label="Datos de otra persona">${ICONOS.alerta}<div class="aviso-texto">
      <p>Lo que se trajo de la app anterior es de ${h(nombre(m.dueño))}, no de ${h(nombre(S.dueño))}.</p>
      <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="perfil.rehacerMigracion">Traer lo de ${h(nombre(S.dueño))}</button></div></div></section>` : ''}
    ${porRevisar && grupoPerfil() !== 'lesiones' ? `<div class="aviso aviso-linea aviso--aviso" role="note">${ICONOS.alerta}<div class="aviso-texto"><p>Tienes ${cuenta(porRevisar, 'lesión', 'lesiones')} de la app anterior con el dolor estimado: ¿cuánto te duele normalmente, de 0 a 10? Hasta que lo digas, el plan la trata con prudencia.</p>
      <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="perfil.grupo" data-v="lesiones">Revisar lesiones</button></div></div></div>` : ''}`;
}

const tarjeta = (titulo, cuerpo, { clase = '', id = '', sub = '' } = {}) => {
  const t = id || 'p-' + titulo.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-');
  return `<section class="tarjeta perfil-sec ${clase}" aria-labelledby="${t}"><h2 id="${t}">${h(titulo)}${sub ? ` <small>${h(sub)}</small>` : ''}</h2>${cuerpo}</section>`;
};
const interruptor = (act, on, txt, extra = '') => `<label class="interruptor"><input type="checkbox" data-cambio="${act}" ${on ? 'checked' : ''} ${extra}><span>${h(txt)}</span></label>`;

// Medidor de nivel: qué falta para subir (C-NIVEL-1 a 3) y, si toca, la propuesta de cambiar.
function medidor(S) {
  const m = medidorNivel(S);
  return `<div class="medidor">
    ${m.criterios.length ? `<p class="ayuda">Para subir a ${h(minus(NIVELES[m.nivel + 1]))}:</p><ul class="criterios">${m.criterios.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? ICONOS.check : ICONOS.info}<span>${h(c.que)}<span class="solo-lector">: ${c.ok ? 'cumplido' : 'pendiente'}</span></span><span>${h(c.valor)}</span></li>`).join('')}</ul>` : '<p class="ayuda">Estás en el nivel más alto.</p>'}
    ${m.sugerido !== m.nivel && !S.perfil.nivelAuto ? `<div class="aviso aviso-linea aviso--info" role="note">${ICONOS.info}<div class="aviso-texto"><p>${h(m.motivo)}</p><div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="entrenador.aplicarNivel">Pasar a ${h(minus(NIVELES[m.sugerido]))}</button></div></div></div>` : ''}
    ${(S.perfil.nivelCambios || []).slice(-2).map(c => `<p class="ayuda">${h(fechaCorta(c.fecha.slice(0, 10)))}: de ${h(minus(NIVELES[c.de]))} a ${h(minus(NIVELES[c.a]))}. ${h(c.motivo)}</p>`).join('')}
  </div>`;
}

function grupoObjetivos(S) {
  const p = S.perfil;
  return `${tarjeta('Objetivos', `<div class="chips" role="group" aria-label="Objetivos (puedes marcar varios)">${Object.entries(OBJETIVOS).map(([k, o]) => chip('perfil.objetivo', k, p.objetivos.includes(k), o.nombre)).join('')}</div>`, { sub: 'puedes marcar varios' })}
  ${tarjeta('Nivel', `${segmento('Nivel', 'perfil.nivel', Object.entries(NIVELES), p.nivel, { ancho: true })}
    ${interruptor('perfil.nivelAuto', p.nivelAuto, 'Que mi progreso me cambie de nivel')}
    ${medidor(S)}`)}
  ${tarjetaAnalisis(S)}`;
}

function grupoLesiones(S) {
  const p = S.perfil;
  const lesiones = p.lesiones.slice().sort((a, b) => b.activa - a.activa);
  const detalle = l => { const z = ZONAS[l.zona]; const d = l.detalle && z && z.detalles && z.detalles.opciones[l.detalle]; return d ? minus(d.nombre) : ''; };
  return tarjeta('Lesiones y dolor', `<p>Cambian con el tiempo: apúntalas, ajusta el dolor y desmárcalas cuando se curen. El entrenador quita lo que las carga y añade rehabilitación.</p>
    ${lesiones.some(l => l.activa && l.dolorRevisar) ? `<div class="aviso aviso-linea aviso--aviso" role="note">${ICONOS.alerta}<div class="aviso-texto"><p>El dolor de las lesiones traídas de la app anterior es una estimación. Toca cada una y pon cuánto te duele ahora.</p></div></div>` : ''}
    ${lesiones.length ? `<ul class="lista">${lesiones.map(l => `<li class="${l.activa ? '' : 'apagada'}">
      <button type="button" class="fila" data-act="perfil.lesion" data-id="${h(l.id)}">
        <span class="crece"><b>${h(ZONAS[l.zona] ? ZONAS[l.zona].nombre : l.zona)}</b><span>${[l.activa ? `Dolor ${+l.dolor} de 10${l.dolorRevisar ? ' (estimado: revísalo)' : ''}` : 'Curada', l.tipo ? minus(TIPOS_LESION[l.tipo]) : '', detalle(l), l.desde ? 'desde ' + fechaCorta(l.desde) : '', l.nota].filter(Boolean).map(h).join(', ')}</span></span>
        ${ICONOS.editar}<span class="solo-lector">Editar</span></button></li>`).join('')}</ul>` : '<p class="texto-2">Sin lesiones apuntadas.</p>'}
    <button type="button" class="boton boton--secundario" data-act="perfil.lesion">${ICONOS.mas}<span>Añadir lesión o dolor</span></button>`);
}

function grupoEntreno(S) {
  const p = S.perfil, d = p.disponibilidad;
  const gustos = Object.entries(p.gustos || {}).filter(([id]) => ex(id));
  return `${tarjeta('Disponibilidad habitual', `<p>Cada semana eliges los días al montar la semana; esto es lo habitual.</p>
    <div class="grupo">${selector({ id: 'p-dias', et: 'Días por semana', valor: +d.dias || 3, min: 1, max: 7, paso: 1, unidad: 'días', act: 'perfil.dias', texto: v => cuenta(v, 'día por semana', 'días por semana') })}</div>
    <div class="grupo"><p class="grupo-et" id="p-min-et">Minutos por sesión</p>${segmento('Minutos por sesión', 'perfil.minutos', [30, 45, 60, 75, 90].map(m => [m, String(m), `${m} minutos`]), d.minutos, { ancho: true })}</div>`)}
  ${tarjeta('Dónde entrenas', `<div class="chips" role="group" aria-label="Dónde entrenas">${Object.entries(LUGARES).map(([k, n]) => chip('perfil.lugar', k, p.lugares.includes(k), n)).join('')}</div>
    ${p.lugares.includes('casa') ? `<p class="grupo-et bloque-mini" id="p-mat-et">Material que tienes ahora en casa</p><div class="chips" role="group" aria-labelledby="p-mat-et">${MATERIAL_CASA.map(m => chip('perfil.material', m, p.materialCasa.includes(m), MATERIAL[m])).join('')}</div>` : ''}
    <div class="bloque-mini">${interruptor('perfil.acompañado', p.acompañado, 'Entreno a la vez que otra persona')}
    ${p.lugares.includes('piscina') ? interruptor('perfil.nadar25', p.nadar25, 'Sé nadar 2 × 25 m seguidos') : ''}</div>`)}
  ${tarjetaMias(S)}
  ${tarjeta('Ejercicios que has valorado', gustos.length ? `<ul class="lista">${gustos.map(([id, g]) => `<li><div class="fila fila--quieta"><span class="crece"><b>${h(ex(id).n)}</b><span>${h(GUSTOS[g] ? GUSTOS[g].nombre : '')}</span></span><button type="button" class="boton boton--texto" data-act="perfil.quitarGusto" data-id="${h(id)}" aria-label="Quitar la valoración de ${h(ex(id).n)}">Quitar</button></div></li>`).join('')}</ul>`
    : '<p>Valora los ejercicios en su ficha o durante la sesión (me gusta, no me gusta, no lo quiero) y el entrenador lo tendrá en cuenta.</p>')}
  ${tarjeta('Entrenador IA', `${segmento('Uso del entrenador IA', 'perfil.usoIA', Object.entries(USO_IA).map(([k, [n]]) => [k, n]), p.usoIA || 'auto', { ancho: true })}
    <p class="ayuda">${h(USO_IA[p.usoIA || 'auto'][1])}</p>`)}`;
}

// «Mis sesiones»: las guardadas para repetir (se eligen en «Antes de empezar»). Se crean y se editan aquí.
function tarjetaMias(S) {
  const mias = misSesiones(S);
  return `<section class="tarjeta perfil-sec mis-sesiones" aria-labelledby="p-mias"><div class="bloque-fila"><h2 id="p-mias">Mis sesiones</h2><span class="texto-2 pequeno">${+mias.length} de ${+MAX_MIAS}</span></div>
    ${mias.length ? `<ul class="lista">${mias.map(m => `<li><button type="button" class="fila" data-act="perfil.editarMia" data-id="${h(m.id)}">
      <span class="crece"><b>${h(m.nombre)}</b><span>${cuenta(m.ejercicios.length, 'ejercicio', 'ejercicios')}, ${h(minus(LUGARES[m.lugar] || ''))}${m.minutos ? `, unos ${+m.minutos} min` : ''}</span></span>
      <span class="fila-accion">${ICONOS.editar}<span>Editar<span class="solo-lector"> «${h(m.nombre)}»</span></span></span></button></li>`).join('')}</ul>
      <p class="ayuda">Para hacer una, elígela en «Antes de empezar».</p>`
    : '<p>Al preparar o terminar una sesión, toca «Guardar como mía» y podrás repetirla otro día desde «Antes de empezar». También puedes crear una con los ejercicios que quieras.</p>'}
    ${mias.length < MAX_MIAS ? `<button type="button" class="boton boton--secundario" data-act="perfil.crearMia">${ICONOS.mas}<span>Crear sesión</span></button>` : `<p class="ayuda">Ya tienes ${MAX_MIAS}: para crear otra, borra alguna.</p>`}
  </section>`;
}

function grupoDatos(S) {
  const p = S.perfil;
  const año = String(p.datos.nacimiento || '').slice(0, 4);
  return `${tarjeta('Tus datos', `<div class="rejilla-campos">
      <div class="campo"><label for="d-sexo">Sexo</label><select id="d-sexo" data-cambio="perfil.dato" data-k="sexo"><option value="">Sin decir</option><option value="h" ${p.datos.sexo === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.datos.sexo === 'm' ? 'selected' : ''}>Mujer</option></select></div>
      <div class="campo"><label for="d-altura">Altura (cm)</label><input id="d-altura" type="number" inputmode="numeric" min="100" max="230" data-cambio="perfil.dato" data-k="altura" value="${h(p.datos.altura || '')}"></div>
      <div class="campo"><label for="d-nac">Año de nacimiento</label><input id="d-nac" type="number" inputmode="numeric" min="1930" max="2015" placeholder="1985" data-cambio="perfil.dato" data-k="nacimiento" value="${h(año)}"></div>
    </div>
    <p class="ayuda">El sexo y la altura sirven para el índice cintura/altura y el % de grasa; la edad, para la dosis a partir de los 60.</p>`)}
  ${tarjeta('Para tu entrenador', `<div class="campo"><label for="d-notas">Lo que quieras que tenga en cuenta</label><textarea id="d-notas" rows="3" data-cambio="perfil.notas" placeholder="horarios, metas concretas, cosas que no te gustan…">${h(p.notas)}</textarea>
    <p class="ayuda">Lo lee el entrenador IA como información, no como órdenes.</p></div>`)}`;
}

function grupoAjustes(S) {
  return `${tarjeta('Ajustes del móvil', `<div class="campo"><label for="a-codigo">Código de acceso a la IA</label><input id="a-codigo" type="password" autocomplete="off" data-cambio="perfil.codigo" value="${h(S.ajustes.codigo)}" aria-describedby="a-codigo-ayuda">
      <p class="ayuda" id="a-codigo-ayuda">El mismo que te ha dado Víctor para usar el entrenador IA. Sin él, la app monta tus sesiones con sus reglas.</p></div>
    <div class="bloque-mini">${interruptor('perfil.ajuste', S.ajustes.vibrar, 'Vibrar al acabar el descanso', 'data-k="vibrar"')}
    ${interruptor('perfil.ajuste', S.ajustes.sonido, 'Pitido al acabar el descanso', 'data-k="sonido"')}</div>`)}
  ${tarjeta('Copia en un archivo', `<div class="aviso aviso-linea aviso--aviso aviso-salud" role="note">${ICONOS.alerta}<div class="aviso-texto"><b>Lleva tus datos de salud</b><p>Lesiones, dolor, medidas y entrenos (sin el código de acceso). Guárdala en un sitio privado.</p></div></div>
    <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="perfil.exportar">Guardar copia</button><button type="button" class="boton boton--secundario" data-act="perfil.importar">Cargar copia</button></div>
    ${puedeCompartirArchivos() ? '<button type="button" class="boton boton--texto" data-act="perfil.compartir">Enviar la copia a otra app (Archivos, Drive…)</button>' : ''}
    ${bloqueCopia()}
    ${bloqueDeshacer()}
    <p class="ayuda">Las copias automáticas están en Perfil › Copias.</p>`)}
  ${tarjeta('Este móvil', `<p>Móvil de ${h(nombre(S.dueño))}.</p>
    <button type="button" class="boton boton--texto" data-act="perfil.cambiarDueño">Cambiar de quién es</button>
    <p class="meta version-app">Versión de la app: <span class="cifra" data-version-app>${h(versionApp() || '—')}</span></p>`)}`;
}

// Uso del almacenamiento y última copia exportada (los datos solo viven en este móvil).
const tamaño = b => b < 1024 ? b + ' B' : b < 1024 * 1024 ? es(b / 1024, 0) + ' KB' : es(b / 1024 / 1024, 1) + ' MB';
export function recordatorioCopia() {
  const c = infoCopia();
  if (!c.toca) return avisoNube();
  return avisoNube() + `<div class="aviso aviso-linea aviso--aviso recordatorio-copia" role="note">${ICONOS.alerta}<div class="aviso-texto"><p>Llevas ${+c.sesionesDesde} sesiones sin guardar una copia. Tus datos solo están en este móvil.</p>
    <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="perfil.exportar">Guardar copia</button></div></div></div>`;
}
function bloqueCopia() {
  const u = usoAlmacen(), c = infoCopia();
  const pct = u.porcentaje < 1 ? 'menos del 1 %' : `${es(u.porcentaje, 0)} %`;
  return `<p class="ayuda uso-almacen">Tus datos ocupan ${tamaño(u.bytes)}, ${pct} de unos 5 MB que deja el navegador.</p>
    <p class="ayuda ultima-copia">${c.fecha ? `Última copia guardada: ${h(fechaCorta(c.fecha))}.` : 'Aún no has guardado ninguna copia.'}</p>
    ${recordatorioCopia()}`;
}

function bloqueDeshacer() {
  const a = infoAntesDeImportar();
  if (!a) return '';
  return `<div class="aviso aviso-linea aviso--info deshacer-importar" role="note">${ICONOS.info}<div class="aviso-texto"><p>Antes de cargar la última copia (${h(fechaCorta(a.fecha))}) tus datos quedaron apartados. Se borran solos a los 7 días.</p>
    <div class="aviso-acciones"><button type="button" class="boton boton--secundario" data-act="perfil.deshacerImportar">Volver a ellos</button><button type="button" class="boton boton--texto" data-act="perfil.descartarAntes">Descartar</button></div></div></div>`;
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
    return `<div class="campo" data-detalle="${h(k)}" ${k === l.zona ? '' : 'style="display:none"'}>
      <label for="l-detalle-${h(k)}">Detalle <small>opcional; si no lo sabes, la app elige lo más prudente</small></label>
      <select id="l-detalle-${h(k)}" data-cambio="perfil.lesionDetalle"><option value="">No lo sé</option>${Object.entries(z.detalles.opciones).map(([o, d]) => `<option value="${h(o)}" data-irradia="${d.irradiado ? '1' : ''}" ${l.zona === k && l.detalle === o ? 'selected' : ''}>${h(d.nombre)}</option>`).join('')}</select>
      ${z.detalles.ayuda ? `<p class="ayuda">${h(z.detalles.ayuda)}</p>` : ''}
      <p class="mensaje mensaje--error" data-a4="${h(k)}" role="alert" ${irradia ? '' : 'style="display:none"'}>${h(AVISO_IRRADIADO)}</p></div>`;
  }).join('');
}
// Dolor que baja por el brazo o la pierna (A4 de docs/criterio.md).
const AVISO_IRRADIADO = 'Si es nuevo o va a más, no entrenes y consulta.';

function hojaLesion(l) {
  const nueva = !l;
  l = l || { zona: Object.keys(ZONAS)[0], dolor: 3, desde: hoyISO(), nota: '', activa: true };
  const tipo = l.tipo || 'lesion';
  abrirHoja(`<h2>${nueva ? 'Nueva lesión o dolor' : 'Editar lesión'}</h2>
    <div class="campo"><label for="l-zona">Zona</label><select id="l-zona" data-cambio="perfil.lesionZona">${Object.entries(ZONAS).map(([k, z]) => `<option value="${k}" ${k === l.zona ? 'selected' : ''}>${h(z.nombre)}</option>`).join('')}</select></div>
    ${detallesLesion(l)}
    <div class="grupo">${selector({ id: 'l-dolor', et: 'Dolor habitual', valor: Math.max(0, Math.min(10, +l.dolor || 0)), min: 0, max: 10, paso: 1, unidad: 'de 10', act: 'perfil.lesionDolor', texto: v => `${v} de 10` })}</div>
    <div class="grupo"><p class="grupo-et" id="l-tipo-et">Qué es</p><div class="chips" id="l-tipo" role="group" aria-labelledby="l-tipo-et" data-elige-uno>${Object.entries(TIPOS_LESION).map(([k, n]) => `<button type="button" class="chip ${tipo === k ? 'on' : ''}" data-v="${k}" aria-pressed="${tipo === k}">${ICONOS.check}<span>${h(n)}</span></button>`).join('')}</div></div>
    <div class="campo"><label for="l-desde">Desde</label><input type="date" id="l-desde" value="${h(l.desde || '')}"></div>
    <div class="campo"><label for="l-nota">Nota <small>qué movimientos duelen, diagnóstico…</small></label><textarea id="l-nota" rows="2">${h(l.nota)}</textarea></div>
    ${nueva ? '' : `<label class="interruptor"><input type="checkbox" id="l-activa" ${l.activa ? 'checked' : ''}><span>Sigue activa</span></label>`}
    <div class="fila-botones">${nueva ? '' : `<button type="button" class="boton boton--peligro" data-act="perfil.borrarLesion" data-id="${h(l.id)}">Borrar lesión</button>`}<button type="button" class="boton" data-act="perfil.guardarLesion" data-id="${h(l.id || '')}">Guardar lesión</button></div>`);
  $('#l-zona').dataset.noFoco = '1';
}

const alternar = (lista, v) => { const i = lista.indexOf(v); if (i >= 0) lista.splice(i, 1); else lista.push(v); };

acciones({
  'perfil.grupo': el => { ponerGrupo(el.dataset.v); pintar(); window.scrollTo(0, 0); const b = $(`[data-act="perfil.grupo"][data-v="${el.dataset.v}"]`); if (b && el.closest('.grupos-perfil')) b.focus({ preventScroll: true }); },
  // Desde otras pantallas (p. ej. la nota «el código de acceso no es correcto»): Perfil › Ajustes.
  'perfil.irAjustes': () => { ponerGrupo('ajustes'); cerrarHoja(); ir('perfil'); window.scrollTo(0, 0); },
  'perfil.acompañado': el => cambiar(S => { S.perfil.acompañado = el.checked; }, 'perfil-silencio'),
  'perfil.nadar25': el => cambiar(S => { if (el.checked) S.perfil.nadar25 = true; else delete S.perfil.nadar25; }, 'perfil'),
  'perfil.usoIA': el => cambiar(S => { S.perfil.usoIA = el.dataset.v; }, 'perfil'),
  'perfil.quitarGusto': el => cambiar(S => { delete S.perfil.gustos[el.dataset.id]; }, 'perfil'),
  'perfil.objetivo': el => cambiar(S => alternar(S.perfil.objetivos, el.dataset.v), 'perfil'),
  'perfil.nivel': el => cambiar(S => { S.perfil.nivel = +el.dataset.v; }, 'perfil'),
  'perfil.nivelAuto': el => cambiar(S => { S.perfil.nivelAuto = el.checked; }, 'perfil'),
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
  'perfil.crearMia': () => ir('mia/nueva'),
  'perfil.editarMia': el => ir('mia/' + el.dataset.id),
  'perfil.lesion': el => hojaLesion(el.dataset.id ? estado().perfil.lesiones.find(l => l.id === el.dataset.id) : null),
  'perfil.guardarLesion': el => {
    const datos = { tipo: ($('#l-tipo .chip[aria-pressed="true"]') || { dataset: { v: 'lesion' } }).dataset.v, zona: $('#l-zona').value, dolor: +$('#l-dolor').getAttribute('aria-valuenow'), desde: $('#l-desde').value, nota: $('#l-nota').value.trim(), activa: $('#l-activa') ? $('#l-activa').checked : true };
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
    const l = estado().perfil.lesiones.find(x => x.id === el.dataset.id); if (!l) return;
    const zona = ZONAS[l.zona] ? ZONAS[l.zona].nombre : l.zona;
    if (!await confirmar(`¿Borrar la lesión de ${minus(zona)}? Si ya está curada, mejor desmarca «Sigue activa» para que el entrenador lo sepa.`, { si: 'Borrar lesión', peligro: true })) return;
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

// Días por semana (selector ±): se guarda al momento.
alCambiarSelector({
  'perfil.dias': sel => cambiar(S => { S.perfil.disponibilidad.dias = Math.max(1, Math.min(7, +sel.dataset.valor)); }, 'perfil'),
  'perfil.lesionDolor': () => {}, // se lee al guardar la lesión
});

// Prueba de pintado de una copia (router.probarPantallas): todas las partes del perfil.
function probar() {
  const antes = grupoPerfil();
  try { for (const [k] of GRUPOS) { ponerGrupo(k); vista(); } } finally { ponerGrupo(antes); }
}
const montar = raiz => devolverFoco(raiz);
rutas({ perfil: { titulo: 'Perfil', vista, montar, probar } });
pestaña({ ruta: 'perfil', nombre: 'Perfil', icono: ICONOS.perfil, orden: 40 });
export { vista };
