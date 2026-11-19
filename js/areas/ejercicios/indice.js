// Área EJERCICIOS: el catálogo, la ficha técnica de cada ejercicio y lo que opina la persona de él
// (me gusta / no me gusta / no lo quiero), que el entrenador lee al elegir.

import { rutas, pestaña, acciones, pintar } from '../../nucleo/router.js';
import { estado, cambiar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, $ } from '../../nucleo/ui.js';
import { EJERCICIOS, ex, nivelesZona, riesgo, zonasRiesgo, ZONAS } from '../../reglas/catalogo.js';
import { registros, resumen } from '../../reglas/progresion.js';
import { MUSCULOS, MATERIAL, LUGARES, NIVELES, GUSTOS } from '../../datos/constantes.js';

const filtro = { texto: '', musculo: '', lugar: '', gusto: '' };
// Miniatura del vídeo (YouTube). Sin conexión o sin vídeo queda el icono del músculo.
export const miniatura = e => e && e.v ? `https://i.ytimg.com/vi/${encodeURIComponent(e.v)}/mqdefault.jpg` : '';

export function botonesGusto(id, act = 'ejercicios.gusto') {
  const g = estado().perfil.gustos[id];
  return `<div class="gustos" role="group" aria-label="¿Qué te parece?">${Object.entries(GUSTOS).map(([k, x]) => `<button class="${g === k ? 'on' : ''} g-${k}" data-act="${act}" data-id="${id}" data-v="${k}" aria-pressed="${g === k}">${x.icono} ${h(x.nombre)}</button>`).join('')}</div>`;
}

// Ficha técnica en hoja inferior: pasos, errores típicos, vídeo, riesgo por lesión y últimas marcas.
export function abrirFicha(id) {
  const e = ex(id); if (!e) return;
  const S = estado();
  const niveles = nivelesZona(S.perfil);
  const rg = riesgo(e, niveles), zonas = zonasRiesgo(e, niveles);
  const ult = registros(S, id).slice(-3).reverse();
  abrirHoja(`<h2>${h(e.n)}</h2>
    <p class="tenue">${e.m.map(m => MUSCULOS[m]).join(', ')}${e.s && e.s.length ? ' · también ' + e.s.map(m => MUSCULOS[m].toLowerCase()).join(', ') : ''} · ${h(NIVELES[e.niv])}</p>
    ${rg !== 'ok' ? `<p class="nota ${rg === 'evitar' ? 'peligro' : 'aviso-nota'}">${rg === 'evitar' ? 'Evítalo por ahora' : 'Con cuidado'}: carga tu ${zonas.map(z => ZONAS[z].corta.toLowerCase()).join(' y ')}.</p>` : ''}
    ${e.v ? `<a class="video-ficha" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener" aria-label="Ver vídeo de ${h(e.n)}"><img src="${miniatura(e)}" alt="" loading="lazy" onerror="this.remove()"><span>${ICONOS.play} Ver vídeo</span></a>` : ''}
    <h3>Cómo se hace</h3><ol class="pasos">${e.p.map(p => `<li>${h(p)}</li>`).join('')}</ol>
    ${e.e && e.e.length ? `<h3>Errores típicos</h3><ul class="errores">${e.e.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
    ${e.c ? `<p class="nota">${h(e.c)}</p>` : ''}
    ${ult.length ? `<h3>Tus últimas veces</h3><ul class="lista compacta">${ult.map(r => `<li><span class="tenue">${h(String(r.fecha).slice(0, 10))}</span> ${h(resumen(r))}</li>`).join('')}</ul>` : ''}
    <h3>¿Qué te parece?</h3>${botonesGusto(id, 'ejercicios.gustoFicha')}`);
}

function chips(clave, opciones, todos) {
  return `<div class="chips desliza" role="group" aria-label="${h(todos)}">
    <button class="chip ${!filtro[clave] ? 'on' : ''}" data-act="ejercicios.filtro" data-k="${clave}" data-v="" aria-pressed="${!filtro[clave]}">${h(todos)}</button>
    ${opciones.map(([k, n]) => `<button class="chip ${filtro[clave] === k ? 'on' : ''}" data-act="ejercicios.filtro" data-k="${clave}" data-v="${k}" aria-pressed="${filtro[clave] === k}">${h(n)}</button>`).join('')}</div>`;
}

function vista() {
  const S = estado();
  const t = filtro.texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sinTilde = x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const gustos = S.perfil.gustos;
  const lista = EJERCICIOS.filter(e => (!t || sinTilde(e.n).includes(t)) && (!filtro.musculo || e.m.includes(filtro.musculo))
    && (!filtro.lugar || e.l.includes(filtro.lugar)) && (!filtro.gusto || gustos[e.id] === filtro.gusto));
  const niveles = nivelesZona(S.perfil);
  const usados = new Set(EJERCICIOS.flatMap(e => e.m));
  const nGustos = Object.keys(GUSTOS).map(k => [k, `${GUSTOS[k].icono} ${GUSTOS[k].nombre}`, Object.values(gustos).filter(v => v === k).length]).filter(x => x[2]);
  return `<h1 class="titulo">Ejercicios</h1>
    <div class="filtros-chips">
      <input type="search" id="ej-buscar" placeholder="Buscar ejercicio" value="${h(filtro.texto)}" aria-label="Buscar ejercicio">
      ${chips('lugar', Object.entries(LUGARES), 'Todos los lugares')}
      ${chips('musculo', Object.entries(MUSCULOS).filter(([k]) => usados.has(k)), 'Todos los músculos')}
      ${nGustos.length ? chips('gusto', nGustos.map(([k, n, c]) => [k, `${n} · ${c}`]), 'Todos') : ''}
    </div>
    <p class="tenue">${lista.length} ejercicio${lista.length === 1 ? '' : 's'}</p>
    ${lista.length ? `<ul class="lista ejercicios">${lista.map(e => {
      const g = gustos[e.id], rg = riesgo(e, niveles), img = miniatura(e);
      return `<li class="${g === 'rechazo' ? 'apagada' : ''}"><button class="fila" data-act="ejercicios.ficha" data-id="${e.id}">
        <span class="mini">${img ? `<img src="${img}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}${ICONOS.ejercicios}${e.v ? `<i>${ICONOS.play}</i>` : ''}</span>
        <span class="grow"><b>${h(e.n)}</b><span class="tenue">${e.m.map(m => MUSCULOS[m]).join(', ')} · ${e.mat.map(m => MATERIAL[m] || m).join(', ')}</span>
          ${rg !== 'ok' || g ? `<span class="marcas">${rg === 'evitar' ? '<span class="insignia peligro">Evitar por tu lesión</span>' : rg === 'precaucion' ? '<span class="insignia cuidado">Con cuidado</span>' : ''}${g ? `<span class="insignia g-${g}">${GUSTOS[g].icono} ${h(GUSTOS[g].nombre)}</span>` : ''}</span>` : ''}</span>
        </button></li>`;
    }).join('')}</ul>` : `<div class="tarjeta vacio"><p>Ningún ejercicio con esos filtros.</p><button class="btn sec" data-act="ejercicios.limpiar">Quitar filtros</button></div>`}`;
}

function guardarGusto(el) {
  const { id, v } = el.dataset;
  cambiar(S => { if (S.perfil.gustos[id] === v) delete S.perfil.gustos[id]; else S.perfil.gustos[id] = v; }, 'gusto');
}

acciones({
  'ejercicios.ficha': el => abrirFicha(el.dataset.id),
  'ejercicios.gusto': guardarGusto,
  'ejercicios.gustoFicha': el => { guardarGusto(el); abrirFicha(el.dataset.id); },
  'ejercicios.filtro': el => { filtro[el.dataset.k] = el.dataset.v; pintar(); },
  'ejercicios.limpiar': () => { Object.assign(filtro, { texto: '', musculo: '', lugar: '', gusto: '' }); pintar(); },
});

rutas({
  ejercicios: {
    titulo: 'Ejercicios', vista,
    montar: raiz => {
      const i = $('#ej-buscar', raiz); let t;
      i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filtro.texto = i.value; pintar(); const n = $('#ej-buscar'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); });
    },
  },
});
pestaña({ ruta: 'ejercicios', nombre: 'Ejercicios', icono: ICONOS.ejercicios, orden: 30 });
