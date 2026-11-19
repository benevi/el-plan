// Área EJERCICIOS: el catálogo, la ficha técnica de cada ejercicio y lo que opina la persona de él
// (me gusta / no me gusta / no lo quiero), que el entrenador lee al elegir.

import { rutas, pestaña, acciones, pintar } from '../../nucleo/router.js';
import { estado, cambiar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, $ } from '../../nucleo/ui.js';
import { EJERCICIOS, ex, nivelesZona, riesgo, zonasRiesgo, ZONAS } from '../../reglas/catalogo.js';
import { registros, resumen } from '../../reglas/progresion.js';
import { MUSCULOS, MATERIAL, LUGARES, NIVELES, GUSTOS } from '../../datos/constantes.js';

const filtro = { texto: '', musculo: '', lugar: '' };

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
    <h3>Cómo se hace</h3><ol class="pasos">${e.p.map(p => `<li>${h(p)}</li>`).join('')}</ol>
    ${e.e && e.e.length ? `<h3>Errores típicos</h3><ul class="errores">${e.e.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
    ${e.c ? `<p class="nota">${h(e.c)}</p>` : ''}
    ${e.v ? `<a class="btn sec" href="https://www.youtube.com/watch?v=${encodeURIComponent(e.v)}" target="_blank" rel="noopener">${ICONOS.video} Ver vídeo</a>` : ''}
    ${ult.length ? `<h3>Tus últimas veces</h3><ul class="lista compacta">${ult.map(r => `<li><span class="tenue">${h(String(r.fecha).slice(0, 10))}</span> ${h(resumen(r))}</li>`).join('')}</ul>` : ''}
    <h3>¿Qué te parece?</h3>${botonesGusto(id, 'ejercicios.gustoFicha')}`);
}

function vista() {
  const S = estado();
  const t = filtro.texto.toLowerCase();
  const lista = EJERCICIOS.filter(e => (!t || e.n.toLowerCase().includes(t)) && (!filtro.musculo || e.m.includes(filtro.musculo)) && (!filtro.lugar || e.l.includes(filtro.lugar)));
  const niveles = nivelesZona(S.perfil);
  return `<h1 class="titulo">Ejercicios</h1>
    <div class="filtros">
      <input type="search" id="ej-buscar" placeholder="Buscar" value="${h(filtro.texto)}" aria-label="Buscar ejercicio">
      <select data-cambio="ejercicios.filtro" data-k="musculo" aria-label="Músculo"><option value="">Todos los músculos</option>${Object.entries(MUSCULOS).map(([k, n]) => `<option value="${k}" ${filtro.musculo === k ? 'selected' : ''}>${h(n)}</option>`).join('')}</select>
      <select data-cambio="ejercicios.filtro" data-k="lugar" aria-label="Lugar"><option value="">Todos los lugares</option>${Object.entries(LUGARES).map(([k, n]) => `<option value="${k}" ${filtro.lugar === k ? 'selected' : ''}>${h(n)}</option>`).join('')}</select>
    </div>
    <p class="tenue">${lista.length} ejercicios</p>
    <ul class="lista">${lista.map(e => {
      const g = S.perfil.gustos[e.id], rg = riesgo(e, niveles);
      return `<li><button class="fila" data-act="ejercicios.ficha" data-id="${e.id}">
        <span class="grow"><b>${h(e.n)}</b><span class="tenue">${e.m.map(m => MUSCULOS[m]).join(', ')} · ${e.mat.map(m => MATERIAL[m] || m).join(', ')}</span></span>
        ${rg === 'evitar' ? '<span class="insignia peligro">Evitar</span>' : rg === 'precaucion' ? '<span class="insignia aviso">Cuidado</span>' : ''}
        ${g ? `<span class="insignia">${GUSTOS[g].icono}</span>` : ''}</button></li>`;
    }).join('')}</ul>`;
}

function guardarGusto(el) {
  const { id, v } = el.dataset;
  cambiar(S => { if (S.perfil.gustos[id] === v) delete S.perfil.gustos[id]; else S.perfil.gustos[id] = v; }, 'gusto');
}

acciones({
  'ejercicios.ficha': el => abrirFicha(el.dataset.id),
  'ejercicios.gusto': guardarGusto,
  'ejercicios.gustoFicha': el => { guardarGusto(el); abrirFicha(el.dataset.id); },
  'ejercicios.filtro': el => { filtro[el.dataset.k] = el.value; pintar(); },
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
