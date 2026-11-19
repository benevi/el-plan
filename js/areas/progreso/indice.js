// Área PROGRESO: constancia semanal, fuerza por ejercicio, medidas corporales, dolor e historial.

import { rutas, pestaña, acciones } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, $, num, es, fechaCorta } from '../../nucleo/ui.js';
import { semanaISO } from '../../nucleo/modelo.js';
import { sesionesHechas, registros } from '../../reglas/progresion.js';
import { ex, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES } from '../../datos/constantes.js';

const MEDIDAS = [['peso', 'Peso', 'kg'], ['cintura', 'Cintura', 'cm'], ['cadera', 'Cadera', 'cm'], ['cuello', 'Cuello', 'cm'], ['pecho', 'Pecho', 'cm'], ['brazo', 'Brazo', 'cm'], ['muslo', 'Muslo', 'cm'], ['grasa', '% grasa', '%']];

function constancia(S) {
  const hechas = sesionesHechas(S);
  const objetivo = S.perfil.disponibilidad.dias || 3;
  const semanas = [];
  for (let k = 7; k >= 0; k--) {
    const d = new Date(); d.setDate(d.getDate() - k * 7);
    const sem = semanaISO(d);
    semanas.push({ sem, n: hechas.filter(s => semanaISO(new Date(s.fecha + 'T12:00')) === sem).length });
  }
  let racha = 0;
  for (let k = semanas.length - 2; k >= 0 && semanas[k].n >= objetivo; k--) racha++;
  if (semanas[semanas.length - 1].n >= objetivo) racha++;
  const max = Math.max(objetivo, ...semanas.map(s => s.n));
  return `<section class="tarjeta"><h2>Constancia</h2>
    <p><b>${semanas[semanas.length - 1].n} de ${objetivo}</b> sesiones esta semana${racha ? ` · <b>${racha}</b> semana${racha > 1 ? 's' : ''} seguidas cumpliendo` : ''}</p>
    <div class="barras" role="img" aria-label="Sesiones por semana, últimas 8 semanas">${semanas.map(s => `<div class="${s.n >= objetivo ? 'ok' : ''}"><i style="height:${Math.round(s.n / max * 100)}%"></i><span>${s.n}</span></div>`).join('')}
      <hr style="bottom:${Math.round(objetivo / max * 100)}%"></div></section>`;
}

function fuerza(S) {
  const ids = [...new Set(sesionesHechas(S).flatMap(s => s.ejercicios.map(x => x.id)))].filter(id => ex(id));
  const filas = ids.map(id => {
    const regs = registros(S, id).filter(r => r.sets.some(z => z.kg));
    if (regs.length < 1) return null;
    const rm = r => Math.max(...r.sets.filter(z => z.kg).map(z => z.kg * (1 + (parseInt(z.txt) || 1) / 30)));
    const a = rm(regs[0]), b = rm(regs[regs.length - 1]);
    return { id, n: ex(id).n, veces: regs.length, ult: Math.max(...regs[regs.length - 1].sets.filter(z => z.kg).map(z => z.kg)), cambio: a ? (b - a) / a * 100 : 0 };
  }).filter(Boolean).sort((x, y) => y.veces - x.veces).slice(0, 10);
  if (!filas.length) return `<section class="tarjeta"><h2>Fuerza</h2><p class="tenue">Cuando apuntes kilos verás aquí cómo suben.</p></section>`;
  return `<section class="tarjeta"><h2>Fuerza</h2><ul class="lista compacta">${filas.map(f => `<li><span class="grow">${h(f.n)}<span class="tenue"> · ${f.veces} veces</span></span><b>${es(f.ult)} kg</b>${f.veces > 1 ? `<span class="insignia ${f.cambio > 0 ? 'bien' : ''}">${f.cambio > 0 ? '+' : ''}${es(f.cambio, 0)} %</span>` : ''}</li>`).join('')}</ul>
    <p class="tenue pie">El % compara tu fuerza estimada (1RM) de la primera vez con la última.</p></section>`;
}

function medidas(S) {
  const m = S.medidas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  return `<section class="tarjeta"><h2>Medidas</h2>
    ${m.length ? `<ul class="lista compacta">${m.slice(0, 6).map(x => `<li><span class="tenue">${h(fechaCorta(x.fecha))}</span><span class="grow">${MEDIDAS.filter(([k]) => x[k] != null).map(([k, n, u]) => `${n} ${es(x[k])} ${u}`).join(' · ')}</span></li>`).join('')}</ul>` : '<p class="tenue">Apunta peso y medidas cada semana o dos, en ayunas.</p>'}
    <button class="btn sec" data-act="progreso.medida">${ICONOS.mas} Nuevas medidas</button></section>`;
}

function dolor(S) {
  const zonas = [...new Set(S.dolor.map(d => d.zona))].filter(z => ZONAS[z]);
  if (!zonas.length) return '';
  return `<section class="tarjeta"><h2>Dolor</h2><ul class="lista compacta">${zonas.map(z => {
    const v = S.dolor.filter(d => d.zona === z).slice(-8);
    return `<li><span class="grow">${h(ZONAS[z].corta)}</span><span class="puntos">${v.map(d => `<i title="${h(d.fecha)}" style="--v:${d.dolor}">${d.dolor}</i>`).join('')}</span></li>`;
  }).join('')}</ul><p class="tenue pie">Últimos registros, de más antiguo a más reciente.</p></section>`;
}

function historial(S) {
  const s = sesionesHechas(S).reverse().slice(0, 12);
  if (!s.length) return '';
  return `<section class="tarjeta"><h2>Últimas sesiones</h2><ul class="lista">${s.map(x => `<li><a class="fila" href="#sesion/${x.id}"><span class="grow"><b>${h(x.nombre)}</b><span class="tenue">${h(fechaCorta(x.fecha))} · ${h(LUGARES[x.lugar] || '')}${x.cierre && x.cierre.esfuerzo ? ' · esfuerzo ' + x.cierre.esfuerzo + '/5' : ''}</span></span>${ICONOS.sig}</a></li>`).join('')}</ul></section>`;
}

function vista() {
  const S = estado();
  return `<h1 class="titulo">Progreso</h1>${constancia(S)}${fuerza(S)}${medidas(S)}${dolor(S)}${historial(S)}`;
}

acciones({
  'progreso.medida': () => {
    abrirHoja(`<h2>Nuevas medidas</h2><div class="rejilla">${MEDIDAS.map(([k, n, u]) => `<label class="campo col"><span>${n} (${u})</span><input inputmode="decimal" id="m-${k}"></label>`).join('')}</div>
      <button class="btn grande" data-act="progreso.guardarMedida">Guardar</button>`);
  },
  'progreso.guardarMedida': () => {
    const x = { fecha: hoyISO() };
    MEDIDAS.forEach(([k]) => { x[k] = num($('#m-' + k).value); });
    if (MEDIDAS.every(([k]) => x[k] == null)) return cerrarHoja();
    cambiar(S => { S.medidas = S.medidas.filter(m => m.fecha !== x.fecha); S.medidas.push(x); }, 'medidas');
    cerrarHoja();
  },
});

rutas({ progreso: { titulo: 'Progreso', vista } });
pestaña({ ruta: 'progreso', nombre: 'Progreso', icono: ICONOS.progreso, orden: 20 });
