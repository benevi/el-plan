// Área PERFIL: todo lo que el entrenador necesita saber de la persona, editable en cualquier momento.
// Objetivos (varios), nivel, lesiones y dolor, disponibilidad de la semana, lugares, material de casa,
// datos personales, notas para el entrenador y ajustes del móvil (código de acceso, vibración, copia).

import { rutas, acciones, pestaña, pintar } from '../../nucleo/router.js';
import { estado, cambiar, uid, hoyISO, exportar, importar, marcarCopiaExportada, infoCopia, usoAlmacen } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, num, es, fechaCorta } from '../../nucleo/ui.js';
import { OBJETIVOS, NIVELES, LUGARES, MATERIAL, MATERIAL_CASA, PERSONAS, GUSTOS } from '../../datos/constantes.js';
import { ZONAS, ex } from '../../reglas/catalogo.js';
import { bloqueMedidor, tarjetaAnalisis } from '../entrenador/indice.js';

const chip = (act, val, on, txt) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${h(val)}" aria-pressed="${on}">${h(txt)}</button>`;

// El perfil va por grupos (antes era una página de 2200 px): se ve uno cada vez.
const GRUPOS = [['objetivos', 'Objetivos y nivel'], ['lesiones', 'Lesiones'], ['entreno', 'Mi entreno'], ['datos', 'Mis datos'], ['ajustes', 'Ajustes']];
let grupo = 'objetivos';
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
  <nav class="chips grupos" aria-label="Partes del perfil">${GRUPOS.map(([k, n]) => `<button class="chip ${grupo === k ? 'on' : ''}" data-act="perfil.grupo" data-v="${k}" aria-pressed="${grupo === k}">${h(n)}</button>`).join('')}</nav>
  ${({ objetivos: grupoObjetivos, lesiones: grupoLesiones, entreno: grupoEntreno, datos: grupoDatos, ajustes: grupoAjustes }[grupo] || grupoObjetivos)(S)}`;
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
    ${lesiones.length ? `<ul class="lista">${lesiones.map(l => `<li class="${l.activa ? '' : 'apagada'}">
      <button class="fila" data-act="perfil.lesion" data-id="${l.id}">
        <span class="grow"><b>${h(ZONAS[l.zona] ? ZONAS[l.zona].nombre : l.zona)}</b><span class="tenue">${l.activa ? `Dolor ${l.dolor}/10` : 'Curada'}${l.tipo ? ' · ' + h(TIPOS_LESION[l.tipo]) : ''}${l.desde ? ' · desde ' + h(l.desde) : ''}${l.nota ? ' · ' + h(l.nota) : ''}</span></span>
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
      <div class="paso"><button data-act="perfil.dias" data-v="-1" aria-label="Menos">${ICONOS.menos}</button><b>${d.dias}</b><button data-act="perfil.dias" data-v="1" aria-label="Más">${ICONOS.mas}</button></div></div>
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
    ${bloqueCopia()}
    <p class="tenue pie">Móvil de ${h(PERSONAS[S.dueño] ? PERSONAS[S.dueño].nombre : '—')} · <button class="enlace" data-act="perfil.cambiarDueño">cambiar</button></p>
  </section>`;
}

// Uso del almacenamiento y última copia exportada (los datos solo viven en este móvil).
const tamaño = b => b < 1024 ? b + ' B' : b < 1024 * 1024 ? es(b / 1024, 0) + ' KB' : es(b / 1024 / 1024, 1) + ' MB';
export function recordatorioCopia() {
  const c = infoCopia();
  if (!c.toca) return '';
  return `<p class="nota aviso-nota recordatorio-copia">Llevas ${c.sesionesDesde} sesiones sin guardar una copia. Tus datos solo están en este móvil.
    <button class="enlace" data-act="perfil.exportar">Guardar copia</button></p>`;
}
function bloqueCopia() {
  const u = usoAlmacen(), c = infoCopia();
  const pct = u.porcentaje < 1 ? 'menos del 1 %' : `${es(u.porcentaje, 0)} %`;
  return `<p class="tenue uso-almacen">Tus datos ocupan ${tamaño(u.bytes)}, ${pct} de unos 5 MB que deja el navegador.</p>
    <p class="tenue ultima-copia">${c.fecha ? `Última copia guardada: ${h(fechaCorta(c.fecha))}.` : 'Aún no has guardado ninguna copia.'}</p>
    ${recordatorioCopia()}`;
}

function hojaLesion(l) {
  const nueva = !l;
  l = l || { zona: Object.keys(ZONAS)[0], dolor: 3, desde: hoyISO(), nota: '', activa: true };
  abrirHoja(`<h2>${nueva ? 'Nueva lesión o dolor' : 'Editar lesión'}</h2>
    <label class="campo col"><span>Zona</span><select id="l-zona">${Object.entries(ZONAS).map(([k, z]) => `<option value="${k}" ${k === l.zona ? 'selected' : ''}>${h(z.nombre)}</option>`).join('')}</select></label>
    <label class="campo col"><span>Dolor habitual: <b id="l-dolor-v">${l.dolor}</b>/10</span><input type="range" id="l-dolor" min="0" max="10" value="${l.dolor}" oninput="document.getElementById('l-dolor-v').textContent=this.value"></label>
    <div class="campo col"><span>Qué es</span><div class="chips" id="l-tipo">${Object.entries(TIPOS_LESION).map(([k, n]) => `<button type="button" class="chip ${(l.tipo || 'lesion') === k ? 'on' : ''}" data-v="${k}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">${h(n)}</button>`).join('')}</div></div>
    <label class="campo col"><span>Desde</span><input type="date" id="l-desde" value="${h(l.desde || '')}"></label>
    <label class="campo col"><span>Nota <small>qué movimientos duelen, diagnóstico…</small></span><textarea id="l-nota" rows="2">${h(l.nota)}</textarea></label>
    ${nueva ? '' : `<label class="interruptor"><input type="checkbox" id="l-activa" ${l.activa ? 'checked' : ''}><span>Sigue activa</span></label>`}
    <div class="fila-botones">${nueva ? '' : `<button class="btn sec peligro" data-act="perfil.borrarLesion" data-id="${l.id}">Borrar</button>`}<button class="btn" data-act="perfil.guardarLesion" data-id="${l.id || ''}">Guardar</button></div>`);
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
  'perfil.lesion': el => hojaLesion(el.dataset.id ? estado().perfil.lesiones.find(l => l.id === el.dataset.id) : null),
  'perfil.guardarLesion': el => {
    const datos = { tipo: ($('#l-tipo .chip.on') || { dataset: { v: 'lesion' } }).dataset.v, zona: $('#l-zona').value, dolor: +$('#l-dolor').value, desde: $('#l-desde').value, nota: $('#l-nota').value.trim(), activa: $('#l-activa') ? $('#l-activa').checked : true };
    cambiar(S => {
      const l = el.dataset.id && S.perfil.lesiones.find(x => x.id === el.dataset.id);
      if (l) { Object.assign(l, datos); } else S.perfil.lesiones.push({ id: uid(), ...datos });
      S.dolor.push({ fecha: hoyISO(), zona: datos.zona, dolor: datos.dolor, momento: 'perfil' });
    }, 'perfil');
    cerrarHoja();
  },
  'perfil.borrarLesion': async el => {
    if (!await confirmar('¿Borrar esta lesión? Si ya está curada, mejor desmarca «Sigue activa» para que el entrenador lo sepa.', { si: 'Borrar', peligro: true })) return;
    cambiar(S => { S.perfil.lesiones = S.perfil.lesiones.filter(l => l.id !== el.dataset.id); }, 'perfil');
  },
  'perfil.exportar': () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportar()], { type: 'application/json' }));
    a.download = `pipos-fitness-${estado().dueño}-${hoyISO()}.json`; a.click();
    marcarCopiaExportada();
    pintar();
  },
  'perfil.importar': () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
    i.onchange = async () => {
      try { if (!await confirmar('Esto sustituye todos los datos de este móvil por los de la copia. ¿Seguir?', { si: 'Cargar copia' })) return; importar(await i.files[0].text()); aviso('Copia cargada'); }
      catch (e) { aviso(e.message, 'error'); }
    };
    i.click();
  },
  'perfil.cambiarDueño': async () => {
    if (!await confirmar('¿Cambiar de quién es este móvil? Los datos guardados se quedan, pero se verán como de la otra persona.', { si: 'Cambiar' })) return;
    cambiar(S => { S.dueño = null; }, 'dueño');
  },
});

rutas({ perfil: { titulo: 'Perfil', vista } });
pestaña({ ruta: 'perfil', nombre: 'Perfil', icono: ICONOS.perfil, orden: 40 });
export { vista };
