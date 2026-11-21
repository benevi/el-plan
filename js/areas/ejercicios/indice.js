// Área EJERCICIOS (diseño aprobado, DIS 4): el catálogo con buscador y filtros (lugar, músculo y valoración),
// la ficha técnica de cada ejercicio (hoja inferior) y lo que opina la persona de él (me gusta / no me gusta /
// no lo quiero), que el entrenador lee al elegir. Desde la ficha se puede añadir a una de «Mis sesiones».

import { rutas, pestaña, acciones, pintar, ir } from '../../nucleo/router.js';
import { estado, cambiar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, $, fechaCorta } from '../../nucleo/ui.js';
import { ex, nivelesZona, riesgo, zonasRiesgo, ZONAS } from '../../reglas/catalogo.js';
import { registros, resumen } from '../../reglas/progresion.js';
import { MUSCULOS, NIVELES, GUSTOS, LUGARES } from '../../datos/constantes.js';
import { misSesiones, miaDe, añadirAMia, MAX_MIAS } from '../entrenador/entrenador.js';
import { chip, listaY, devolverFoco, ICONOS16 } from '../perfil/controles.js';
import { filtroVacio, filtrarEjercicios, filaFiltro, datosEjercicio, marcarEnFila } from './buscador.js';
import { nuevaConEjercicio } from '../perfil/editor.js';

const filtro = filtroVacio();
// Miniatura del vídeo (YouTube). Sin conexión o sin vídeo queda el icono del músculo (la usa la sesión).
export const miniatura = e => e && e.v ? `https://i.ytimg.com/vi/${encodeURIComponent(e.v)}/mqdefault.jpg` : '';

// Botones de valoración que pinta la sesión (su menú del ejercicio). Se mantienen tal cual para el PR 15.
export function botonesGusto(id, act = 'ejercicios.gusto') {
  const g = estado().perfil.gustos[id];
  return `<div class="gustos" role="group" aria-label="¿Qué te parece?">${Object.entries(GUSTOS).map(([k, x]) => `<button class="${g === k ? 'on' : ''} g-${k}" data-act="${act}" data-id="${h(id)}" data-v="${k}" aria-pressed="${g === k}">${x.icono} ${h(x.nombre)}</button>`).join('')}</div>`;
}

// Orden de la valoración en la ficha: de mejor a peor.
const ORDEN_GUSTO = ['gusta', 'nogusta', 'rechazo'];

// Ficha técnica en hoja inferior: músculos y nivel, aviso por lesión, vídeo, pasos, errores típicos, consejo,
// tus últimas veces, tu valoración y «Añadir a una de mis sesiones».
export function abrirFicha(id) {
  const e = ex(id); if (!e) return;
  const S = estado();
  const niveles = nivelesZona(S.perfil);
  const rg = riesgo(e, niveles), zonas = zonasRiesgo(e, niveles);
  const ult = registros(S, id).slice(-3).reverse();
  const g = S.perfil.gustos[id];
  const musculos = `${listaY(e.m.map(m => MUSCULOS[m] || m))}${e.s && e.s.length ? `; también ${listaY(e.s.map(m => (MUSCULOS[m] || m).toLowerCase()))}` : ''}. ${NIVELES[e.niv] || ''}.`;
  abrirHoja(`<h2>${h(e.n)}</h2>
    <div class="ficha">
      <p class="ficha-datos">${h(musculos)}</p>
      ${rg !== 'ok' ? `<div class="aviso aviso-linea aviso--${rg === 'evitar' ? 'error' : 'aviso'} ficha-riesgo" role="note">${rg === 'evitar' ? ICONOS.error : ICONOS.alerta}<div class="aviso-texto"><b>${rg === 'evitar' ? 'Evítalo por ahora' : 'Con cuidado'}</b><p>Carga tu ${h(listaY(zonas.map(z => ZONAS[z].corta.toLowerCase())))}.</p></div></div>` : ''}
      ${e.v ? `<a class="video-ficha" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener" aria-label="Ver el vídeo de ${h(e.n)} (se abre en YouTube)"><img src="${miniatura(e)}" alt="" loading="lazy" data-quitar-si-falla><span>${ICONOS.play} Ver vídeo</span></a>` : ''}
      <h3>Cómo se hace</h3><ol>${e.p.map(p => `<li>${h(p)}</li>`).join('')}</ol>
      ${e.e && e.e.length ? `<h3>Errores típicos</h3><ul>${e.e.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${e.c ? `<p class="consejo">${h(e.c)}</p>` : ''}
      ${ult.length ? `<h3>Tus últimas veces</h3><ul class="ultimas">${ult.map(r => `<li><span>${h(fechaCorta(String(r.fecha).slice(0, 10)))}</span> ${h(resumen(r))}</li>`).join('')}</ul>` : ''}
      <h3 id="ficha-gusto">¿Qué te parece?</h3>
      <div class="chips gustos-ficha" role="group" aria-labelledby="ficha-gusto">${ORDEN_GUSTO.map(k => chip('ejercicios.gustoFicha', k, g === k, GUSTOS[k].nombre, `data-id="${h(id)}"`)).join('')}</div>
      <button type="button" class="boton boton--secundario boton--ancho ficha-mia" data-act="ejercicios.aMia" data-id="${h(id)}">${ICONOS.mas}<span>Añadir a una de mis sesiones</span></button>
    </div>`, { clase: 'hoja-ficha' });
}

// «Añadir a una de mis sesiones»: elige una guardada o crea una nueva con este ejercicio.
function hojaAMia(id) {
  const e = ex(id); if (!e) return;
  const mias = misSesiones(estado());
  abrirHoja(`<h2>Añadir «${h(e.n)}»</h2>
    <p class="hoja-texto">Se añade al final con las series, repeticiones y descanso que te propone la app. Luego puedes cambiarlos en Perfil › Mi entreno › Mis sesiones.</p>
    ${mias.length ? `<ul class="lista lista-mias" aria-label="Mis sesiones">${mias.map(m => {
      const ya = m.ejercicios.some(x => x && x.id === id);
      return `<li><button type="button" class="fila" data-act="ejercicios.aMiaOk" data-id="${h(id)}" data-mia="${h(m.id)}"${ya ? ' aria-disabled="true"' : ''}>
        <span class="crece"><b>${h(m.nombre)}</b><span>${ya ? 'Ya lo tiene' : `${+m.ejercicios.length} ${m.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}, ${h((LUGARES[m.lugar] || '').toLowerCase())}`}</span></span>${ya ? ICONOS.check : ICONOS.mas}</button></li>`;
    }).join('')}</ul>` : '<p class="hoja-texto">Aún no tienes ninguna sesión guardada.</p>'}
    ${mias.length < MAX_MIAS ? `<button type="button" class="boton${mias.length ? ' boton--secundario' : ''} boton--ancho" data-act="ejercicios.aMiaNueva" data-id="${h(id)}">Crear una sesión nueva con este ejercicio</button>` : `<p class="ayuda">Ya tienes ${MAX_MIAS} sesiones guardadas: para crear otra, borra alguna.</p>`}`);
}

function itemEjercicio(e, gustos, niveles) {
  const g = gustos[e.id], rg = riesgo(e, niveles);
  const insignias = `${rg === 'evitar' ? '<span class="insignia insignia--error">Evitar por tu lesión</span>' : rg === 'precaucion' ? '<span class="insignia insignia--aviso">Con cuidado</span>' : ''}${g ? `<span class="insignia${g === 'gusta' ? ' insignia--bien' : ''}">${h(GUSTOS[g].nombre)}</span>` : ''}`;
  return `<li class="${g === 'rechazo' ? 'apagada' : ''}"><button type="button" class="fila" data-act="ejercicios.ficha" data-id="${h(e.id)}">
    <span class="crece"><b>${h(e.n)}</b><span>${h(datosEjercicio(e))}</span>${insignias ? `<span class="insignias">${insignias}</span>` : ''}</span>${ICONOS.sig}</button></li>`;
}

function resultados(S) {
  const lista = filtrarEjercicios(S, filtro);
  const niveles = nivelesZona(S.perfil);
  const gustos = S.perfil.gustos || {};
  return `<p class="meta-lista" role="status">${lista.length} ${lista.length === 1 ? 'ejercicio' : 'ejercicios'}</p>
    ${lista.length ? `<ul class="lista lista-ej">${lista.map(e => itemEjercicio(e, gustos, niveles)).join('')}</ul>`
    : `<section class="tarjeta vacio"><h2 class="tarjeta-nombre">Ningún ejercicio con esos filtros</h2><p>Prueba con otra palabra o quita los filtros.</p><button type="button" class="boton boton--secundario" data-act="ejercicios.limpiar">Quitar filtros</button></section>`}`;
}

function vista() {
  const S = estado();
  return `<h1 class="titulo-pantalla">Ejercicios</h1>
    <div class="buscar"><label class="solo-lector" for="ej-buscar">Buscar ejercicio</label>${ICONOS16.buscar}<input id="ej-buscar" type="search" value="${h(filtro.texto)}" placeholder="press, plancha, crol…" autocomplete="off" enterkeyhint="search"></div>
    <div class="filtros">${filaFiltro(S, filtro, 'lugar', 'ejercicios.filtro')}${filaFiltro(S, filtro, 'musculo', 'ejercicios.filtro')}${filaFiltro(S, filtro, 'gusto', 'ejercicios.filtro')}</div>
    <div id="ej-resultados">${resultados(S)}</div>`;
}
const repintarResultados = () => { const r = $('#ej-resultados'); if (r) r.innerHTML = resultados(estado()); };

function guardarGusto(el) {
  const { id, v } = el.dataset;
  cambiar(S => { if (S.perfil.gustos[id] === v) delete S.perfil.gustos[id]; else S.perfil.gustos[id] = v; }, 'gusto');
}

acciones({
  'ejercicios.ficha': el => abrirFicha(el.dataset.id),
  'ejercicios.gusto': guardarGusto,
  'ejercicios.gustoFicha': el => { guardarGusto(el); abrirFicha(el.dataset.id); },
  'ejercicios.filtro': el => { filtro[el.dataset.k] = el.dataset.v; marcarEnFila(el); repintarResultados(); },
  'ejercicios.limpiar': () => { Object.assign(filtro, filtroVacio()); pintar(); const b = $('#ej-buscar'); if (b) b.focus(); },
  'ejercicios.aMia': el => hojaAMia(el.dataset.id),
  'ejercicios.aMiaOk': el => {
    if (el.getAttribute('aria-disabled') === 'true') { aviso('Esa sesión ya tiene este ejercicio.', 'info'); return; }
    const m = miaDe(estado(), el.dataset.mia);
    const r = añadirAMia(el.dataset.mia, el.dataset.id);
    if (r.error) { aviso(r.error, 'error'); return; }
    cerrarHoja();
    aviso(`Añadido a «${m ? m.nombre : r.mia.nombre}»`);
  },
  'ejercicios.aMiaNueva': el => { cerrarHoja(); nuevaConEjercicio(el.dataset.id); ir('mia/nueva'); },
});

rutas({
  ejercicios: {
    titulo: 'Ejercicios', vista,
    montar: raiz => {
      const i = $('#ej-buscar', raiz); let t;
      i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filtro.texto = i.value; repintarResultados(); }, 150); });
      devolverFoco(raiz);
    },
  },
});
pestaña({ ruta: 'ejercicios', nombre: 'Ejercicios', icono: ICONOS.ejercicios, orden: 30 });
