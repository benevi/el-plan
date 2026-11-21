// Área PROGRESO: constancia, nivel, fuerza, salud (medidas y cardio), dolor e historial.
// Todo sale de lo apuntado; los cálculos están en analisis.js (también los usan Hoy y el entrenador IA).

import { rutas, pestaña, acciones } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, $, num, es, fechaCorta } from '../../nucleo/ui.js';
import { sesionesHechas, resumen, registros } from '../../reglas/progresion.js';
import { ex } from '../../reglas/catalogo.js';
import { LUGARES, NIVELES } from '../../datos/constantes.js';
import { medidorNivel } from '../../reglas/contexto.js';
import { constancia, textoConstancia, fuerza, salud, lecturaPeso, dolor } from './analisis.js';

const MEDIDAS = [['peso', 'Peso', 'kg', 1], ['cintura', 'Cintura', 'cm', 1], ['cadera', 'Cadera', 'cm', 0], ['cuello', 'Cuello', 'cm', 0], ['pecho', 'Pecho', 'cm', 0], ['brazo', 'Brazo', 'cm', 0], ['muslo', 'Muslo', 'cm', 0], ['grasa', '% grasa', '%', 0]];
const signo = v => (v > 0 ? '+' : v < 0 ? '−' : '') + es(Math.abs(v));

// Línea pequeña con los valores (SVG, sin librerías).
function linea(puntos, { alto = 56, clase = '' } = {}) {
  if (puntos.length < 2) return '';
  const v = puntos.map(p => p.v), min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
  const W = 300, x = i => Math.round(i / (puntos.length - 1) * W), y = val => Math.round(4 + (1 - (val - min) / r) * (alto - 8));
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.v)}`).join(' ');
  return `<svg class="linea ${clase}" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none" role="img" aria-label="De ${es(v[0])} a ${es(v[v.length - 1])}">
    <path d="${d}" vector-effect="non-scaling-stroke"/><circle cx="${x(puntos.length - 1)}" cy="${y(v[v.length - 1])}" r="3.5"/></svg>`;
}

// ── Constancia (también en Hoy) ──
function barrasSemanas(c) {
  const max = Math.max(c.objetivo, ...c.semanas.map(s => s.n));
  return `<div class="barras" role="img" aria-label="Sesiones por semana, últimas ${c.semanas.length} semanas">${c.semanas.map(s => `<div class="${s.n >= c.objetivo ? 'ok' : ''} ${s.actual ? 'actual' : ''}"><i style="height:${Math.round(s.n / max * 100)}%"></i><span>${s.actual ? 'Esta' : s.n}</span></div>`).join('')}
    <hr style="bottom:${Math.round(c.objetivo / max * 100)}%"></div>`;
}

// Tarjeta para Hoy. opciones: { planificados, hechosPlan } si hay plan de la semana.
export function tarjetaConstancia(S, { planificados, hechosPlan } = {}) {
  const c = constancia(S, 4);
  if (!c.total) return '';
  const conPlan = planificados > 0;
  const hechas = conPlan ? hechosPlan || 0 : c.estaSemana, meta = conPlan ? planificados : c.objetivo;
  return `<section class="tarjeta constancia-hoy">
    <div class="fila-dato"><div class="grow"><h2>Constancia</h2>
      <p>${hechas >= meta ? `<b>Semana cumplida</b> · ${hechas} de ${meta}` : `<b>${hechas} de ${meta}</b> ${conPlan ? 'días del plan' : 'sesiones'} esta semana`}</p></div>
      ${c.racha > 1 ? `<div class="racha"><b>${c.racha}</b><small>semanas<br>seguidas</small></div>` : ''}</div>
    <div class="puntos-semana">${Array.from({ length: meta }, (_, i) => `<i class="${i < hechas ? 'on' : ''}"></i>`).join('')}</div>
    <a class="enlace" href="#progreso">Ver progreso ${ICONOS.sig}</a></section>`;
}

function seccionConstancia(S) {
  const c = constancia(S);
  return `<section class="tarjeta"><h2>Constancia</h2>
    <p>${textoConstancia(c)}</p>
    ${barrasSemanas(c)}
    <ul class="lista compacta datos">
      <li><span class="grow">Últimas 4 semanas</span><b>${c.cumplimiento == null ? '—' : +c.cumplimiento + ' %'}</b><span class="tenue">de lo previsto</span></li>
      <li><span class="grow">Sesiones en total</span><b>${+c.total}</b></li>
      ${c.diasSin != null && c.diasSin >= 4 ? `<li><span class="grow">Sin entrenar</span><b>${+c.diasSin} días</b></li>` : ''}
    </ul>
    <div class="nivel"><div class="fila-dato"><span class="grow">Tu nivel</span><b>${h(NIVELES[S.perfil.nivel] || NIVELES[1])}</b></div>
      <p class="tenue pie">${S.perfil.nivelAuto ? 'Tu entrenador lo sube o lo baja según tu constancia y tu progreso.' : 'Lo eliges tú en <a href="#perfil">Perfil</a>.'}</p>
      ${(() => { const m = medidorNivel(S); return m.criterios.length ? `<p class="tenue pie">Para ${h(NIVELES[(+S.perfil.nivel || 1) + 1])}:</p><ul class="criterios">${m.criterios.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? ICONOS.check : '<i></i>'}<span class="grow">${h(c.que)}</span><span class="tenue">${h(c.valor)}</span></li>`).join('')}</ul>` : ''; })()}
    </div></section>`;
}

// ── Fuerza ──
function seccionFuerza(S) {
  const f = fuerza(S);
  if (!f.filas.length) return `<section class="tarjeta"><h2>Fuerza</h2><p class="tenue">Cuando apuntes los kilos de tus series verás aquí cómo sube tu fuerza en cada ejercicio.</p></section>`;
  return `<section class="tarjeta"><h2>Fuerza</h2>
    ${f.mediana != null ? `<p class="destacado"><b class="${f.mediana > 0 ? 'bien' : ''}">${signo(f.mediana)} %</b> <span>de fuerza en ${f.semanas} semanas<br><small class="tenue">mediana de ${f.comparados} ejercicio${f.comparados > 1 ? 's' : ''}${f.records ? ` · ${f.records} récord${f.records > 1 ? 's' : ''} en la última vez` : ''}</small></span></p>` : '<p class="tenue">Repite un ejercicio con kilos para ver la comparación.</p>'}
    <ul class="lista">${f.filas.slice(0, 12).map(x => `<li><button class="fila" data-act="progreso.ejercicio" data-id="${h(x.id)}">
      <span class="grow"><b>${h(x.n)}</b><span class="tenue">${+x.veces} ${x.veces > 1 ? 'veces' : 'vez'} · último ${es(x.ultimoKg)} kg${x.record ? ' · récord' : ''}</span></span>
      ${x.cambio != null ? `<span class="insignia ${x.cambio > 0 ? 'bien' : x.cambio < -5 ? 'cuidado' : ''}">${signo(x.cambio)} %</span>` : ''}${ICONOS.sig}</button></li>`).join('')}</ul>
    <p class="tenue pie">Se compara el 1RM estimado (fórmula de Epley con tus kilos y repeticiones) de la primera y la última vez dentro de las ${f.semanas} semanas.</p></section>`;
}

function hojaEjercicio(id) {
  const S = estado(), f = fuerza(S, 520).filas.find(x => x.id === id), e = ex(id);
  const regs = registros(S, id).slice().reverse();
  abrirHoja(`<h2>${h(e ? e.n : id)}</h2>
    ${f && f.serie.length > 1 ? `<p class="tenue">1RM estimado: de ${es(f.serie[0].v, 1)} a ${es(f.e1rm)} kg</p>${linea(f.serie)}` : ''}
    <ul class="lista compacta">${regs.slice(0, 15).map(r => `<li><span class="tenue fecha">${h(fechaCorta(String(r.fecha).slice(0, 10)))}</span><span class="grow">${h(resumen(r))}</span>${r.esfuerzo ? `<span class="tenue">esf. ${+r.esfuerzo}/5</span>` : ''}</li>`).join('')}</ul>`);
}

// ── Salud ──
function seccionSalud(S) {
  const sa = salud(S);
  const ichTxt = { bien: 'saludable', aviso: 'riesgo aumentado', peligro: 'riesgo alto' };
  const t = sa.peso && sa.peso.tendencia, tc = sa.cintura && sa.cintura.tendencia;
  const cardioPct = Math.min(100, Math.round(sa.cardio / sa.cardioObjetivo * 100));
  const hayMedidas = sa.peso || sa.cintura;
  return `<section class="tarjeta"><h2>Salud</h2>
    ${hayMedidas ? `<div class="rejilla-datos">
      ${sa.peso ? `<div class="dato-salud"><small>Peso</small><b>${es(sa.peso.v)} kg</b>${t ? `<span class="tenue">${signo(t.delta)} kg desde ${h(fechaCorta(t.desde))}</span>` : ''}${linea(sa.series.peso, { alto: 36 })}</div>` : ''}
      ${sa.cintura ? `<div class="dato-salud"><small>Cintura</small><b>${es(sa.cintura.v)} cm</b>${tc ? `<span class="tenue">${signo(tc.delta)} cm desde ${h(fechaCorta(tc.desde))}</span>` : ''}${linea(sa.series.cintura, { alto: 36 })}</div>` : ''}
      ${sa.ich != null ? `<div class="dato-salud"><small>Cintura / altura</small><b>${es(sa.ich, 2)}</b><span class="insignia ${{ bien: 'bien', aviso: 'cuidado', peligro: 'peligro' }[sa.ichNivel]}">${ichTxt[sa.ichNivel]}</span></div>` : ''}
      ${sa.grasa ? `<div class="dato-salud"><small>% de grasa</small><b>${es(sa.grasa.v)} %</b><span class="tenue">${sa.grasa.fuente === 'estimada' ? 'estimada con cuello, cintura y cadera' : 'apuntada'}</span></div>` : ''}
    </div>
    ${t ? `<p class="lectura">${h(lecturaPeso(S, t))}</p>` : ''}` : '<p class="tenue">Apunta peso y cintura cada una o dos semanas, por la mañana y en ayunas. Con eso se ve si la comida y el entrenamiento van en la dirección de tus objetivos.</p>'}
    ${!sa.altura ? `<p class="tenue pie">Añade tu altura en <a href="#perfil">Perfil</a> para calcular el índice cintura/altura.</p>` : ''}
    <div class="cardio">
      <div class="fila-dato"><span class="grow">Cardio últimos 7 días</span><b>${+sa.cardio} de ${+sa.cardioObjetivo} min</b></div>
      <div class="barra"><i style="width:${cardioPct}%"></i></div>
      <p class="tenue pie">La OMS recomienda al menos 150 minutos a la semana de actividad moderada. Cuentan los ejercicios de cardio y la natación apuntados en tus sesiones.</p>
    </div>
    <button class="btn sec" data-act="progreso.medida">${ICONOS.mas} Apuntar medidas</button></section>`;
}

// ── Dolor ──
function seccionDolor(S) {
  const zonas = dolor(S);
  if (!zonas.length) return '';
  const flecha = { baja: 'Baja', sube: 'Sube', igual: 'Estable' };
  return `<section class="tarjeta"><h2>Dolor</h2><ul class="lista dolor">${zonas.map(z => `<li>
      <div class="fila-dato"><b class="grow">${h(z.nombre)}</b>${z.tendencia ? `<span class="insignia ${z.tendencia === 'baja' ? 'bien' : z.tendencia === 'sube' ? 'peligro' : ''}">${flecha[z.tendencia]}</span>` : ''}</div>
      <span class="puntos">${z.registros.map(d => `<i title="${h(fechaCorta(d.fecha))} · ${d.momento === 'antes' ? 'antes' : d.momento === 'despues' ? 'después' : 'día'}" style="--v:${+d.dolor}">${+d.dolor}</i>`).join('')}</span>
      ${z.subidas ? `<p class="tenue pie">${+z.subidas} sesi${z.subidas > 1 ? 'ones' : 'ón'} en que subió 2 puntos o más.${z.sospechosos.length ? ` Coincide con: ${z.sospechosos.map(s => `<b>${h((ex(s.id) || {}).n || s.id)}</b> (${+s.n} de ${+s.total} veces)`).join(', ')}. Tu entrenador lo tiene en cuenta.` : ''}</p>` : ''}
    </li>`).join('')}</ul><p class="tenue pie">De 0 a 10, del más antiguo al más reciente, al terminar cada sesión.</p></section>`;
}

function historial(S) {
  const s = sesionesHechas(S).reverse().slice(0, 6);
  if (!s.length) return '';
  return `<section class="tarjeta"><h2>Últimas sesiones</h2><ul class="lista">${s.map(x => `<li><a class="fila" href="#sesion/${h(x.id)}"><span class="grow"><b>${h(x.nombre)}</b><span class="tenue">${h(fechaCorta(x.fecha))} · ${h(LUGARES[x.lugar] || '')}${x.cierre && x.cierre.esfuerzo ? ' · esfuerzo ' + +x.cierre.esfuerzo + '/5' : ''}</span></span>${ICONOS.sig}</a></li>`).join('')}</ul></section>`;
}

function vista() {
  const S = estado();
  const hay = sesionesHechas(S).length;
  if (!hay && !S.medidas.length) {
    return `<h1 class="titulo">Progreso</h1>
      <section class="tarjeta vacio">${ICONOS.progreso}<h2>Tu progreso empieza con tu primera sesión</h2>
        <p class="tenue">Aquí verás tu constancia semana a semana, cómo sube tu fuerza en cada ejercicio, tus medidas y cómo evoluciona el dolor.</p>
        <a class="btn" href="#hoy">Ir a Hoy</a>
        <button class="btn sec" data-act="progreso.medida">${ICONOS.mas} Apuntar mis medidas de hoy</button></section>`;
  }
  return `<h1 class="titulo">Progreso</h1>${hay ? seccionConstancia(S) : ''}${seccionFuerza(S)}${seccionSalud(S)}${seccionDolor(S)}${historial(S)}`;
}

acciones({
  'progreso.ejercicio': el => hojaEjercicio(el.dataset.id),
  'progreso.medida': () => {
    const S = estado(), ult = {};
    S.medidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => MEDIDAS.forEach(([k]) => { if (m[k] != null) ult[k] = m[k]; }));
    const hoy = S.medidas.find(m => m.fecha === hoyISO()) || {};
    const campo = ([k, n, u]) => `<label class="campo col"><span>${n} (${u})</span><input inputmode="decimal" id="m-${k}" value="${hoy[k] != null ? h(hoy[k]) : ''}" placeholder="${ult[k] != null ? 'última: ' + h(es(ult[k])) : ''}"></label>`;
    abrirHoja(`<h2>Medidas de hoy</h2>
      <p class="tenue">Por la mañana, en ayunas. La cintura, a la altura del ombligo y sin apretar.</p>
      <div class="rejilla">${MEDIDAS.filter(m => m[3]).map(campo).join('')}</div>
      <details class="plegable"><summary>Más medidas</summary><p class="tenue">Con cuello, cintura y cadera se estima el % de grasa.</p><div class="rejilla">${MEDIDAS.filter(m => !m[3]).map(campo).join('')}</div></details>
      <button class="btn grande" data-act="progreso.guardarMedida">Guardar</button>`);
  },
  'progreso.guardarMedida': () => {
    const x = { fecha: hoyISO() };
    MEDIDAS.forEach(([k]) => { const v = num($('#m-' + k).value); if (v != null && v > 0) x[k] = v; });
    if (Object.keys(x).length === 1) return cerrarHoja();
    cambiar(S => { S.medidas = S.medidas.filter(m => m.fecha !== x.fecha); S.medidas.push(x); }, 'medidas');
    cerrarHoja();
  },
});

rutas({ progreso: { titulo: 'Progreso', vista } });
pestaña({ ruta: 'progreso', nombre: 'Progreso', icono: ICONOS.progreso, orden: 20 });
