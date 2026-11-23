// Área PROGRESO (diseño aprobado, DIS 4): constancia, nivel, fuerza, salud (medidas y cardio), dolor e historial.
// Todo sale de lo apuntado; los cálculos están en analisis.js (también los usan Hoy y el entrenador IA).
// Gráficos según la guía dataviz (graficos.js): una serie por gráfico, burbuja y «Ver como tabla».
// La constancia usa el mismo denominador que Hoy: la semana en curso frente a los días de su plan.

import { rutas, pestaña, acciones } from '../../nucleo/router.js';
import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, $, num, es, fechaCorta, plural } from '../../nucleo/ui.js';
import { sesionesHechas, resumen, registros } from '../../reglas/progresion.js';
import { ex } from '../../reglas/catalogo.js';
import { LUGARES, NIVELES } from '../../datos/constantes.js';
import { medidorNivel } from '../../reglas/contexto.js';
import { estadoDias } from '../entrenador/plan.js';
import { constancia, fuerza, salud, lecturaPeso, dolor, constanciaSemanas, rachaSemanas, sesionesPorMes, puntosFecha, dolorPorMes } from './analisis.js';
import { linea, barras, vasos, activar } from './graficos.js';
import { cuenta, listaY } from '../perfil/controles.js';

// [clave, nombre, unidad, se ve sin abrir «Más medidas», mínimo, máximo]. Fuera de esos márgenes es un error al
// escribir (1000 kg, una cintura negativa) y no se guarda (M16).
const MEDIDAS = [['peso', 'Peso', 'kg', 1, 25, 300], ['cintura', 'Cintura', 'cm', 1, 40, 200], ['cadera', 'Cadera', 'cm', 0, 50, 200], ['cuello', 'Cuello', 'cm', 0, 20, 70], ['pecho', 'Pecho', 'cm', 0, 50, 200], ['brazo', 'Brazo', 'cm', 0, 15, 70], ['muslo', 'Muslo', 'cm', 0, 25, 100], ['grasa', '% de grasa', '%', 0, 3, 60]];
const signo = v => (v > 0 ? '+' : v < 0 ? '−' : '') + es(Math.abs(v));
const minus = t => String(t || '').toLowerCase();

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

// Días del plan de esta semana (como en Hoy): { planificados, hechosPlan }.
function delPlan(S) {
  const dias = estadoDias(S);
  return dias.length ? { planificados: dias.length, hechosPlan: dias.filter(d => d.estado === 'hecho').length } : {};
}

function bloqueNivel(S) {
  const m = medidorNivel(S), p = S.perfil;
  return `<h3 class="bloque-titulo bloque">Tu nivel: ${h(NIVELES[p.nivel] || NIVELES[1])}</h3>
    <p class="ayuda">${p.nivelAuto ? 'Tu entrenador lo sube o lo baja según tu constancia y tu progreso.' : 'Lo eliges tú en Perfil › Objetivos y nivel.'}${m.criterios.length ? ` Para pasar a ${h(minus(NIVELES[(+p.nivel || 1) + 1]))}:` : ''}</p>
    ${m.criterios.length ? `<ul class="criterios">${m.criterios.map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? ICONOS.check : ICONOS.info}<span>${h(c.que)}<span class="solo-lector">: ${c.ok ? 'cumplido' : 'pendiente'}</span></span><span>${h(c.valor)}</span></li>`).join('')}</ul>` : ''}`;
}

function seccionConstancia(S) {
  const c = constancia(S), plan = delPlan(S);
  const sem = constanciaSemanas(S, 8, plan);
  const actual = sem[sem.length - 1];
  const datos = `<ul class="datos-lista">
      ${c.cumplimiento != null ? `<li><span>Últimas 4 semanas</span><b class="cifra">${+c.cumplimiento} % de lo previsto</b></li>` : ''}
      <li><span>Sesiones en total</span><b class="cifra">${+c.total}</b></li>
      ${c.diasSin != null && c.diasSin >= 4 ? `<li><span>Sin entrenar</span><b class="cifra">${cuenta(+c.diasSin, 'día', 'días')}</b></li>` : ''}
    </ul>`;
  if (c.semanasActivo <= 1) {
    return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-c"><h2 class="bloque-titulo" id="t-c">Constancia</h2>
      <p><b>${+actual.n} de ${+actual.meta}</b> ${plan.planificados ? 'días del plan' : 'sesiones'} esta semana. Es tu primera semana: aquí verás cada semana cómo vas.</p>
      ${datos}${bloqueNivel(S)}</section>`;
  }
  const racha = rachaSemanas(constanciaSemanas(S, 104, plan));
  const meses = sesionesPorMes(S, 12);
  const conMeses = meses.filter(m => m.n).length >= 2;
  const total12 = meses.reduce((a, m) => a + m.n, 0);
  const frase = racha > 1 ? `${racha} semanas seguidas cumpliendo lo previsto.`
    : actual.n >= actual.meta ? `Esta semana, cumplida: ${+actual.n} de ${+actual.meta}.` : `Esta semana llevas ${+actual.n} de ${+actual.meta} ${plan.planificados ? 'días del plan' : 'sesiones'}.`;
  return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-c"><h2 class="bloque-titulo" id="t-c">Constancia</h2>
    <p class="prog-frase">${h(frase)}</p>
    ${vasos({ titulo: 'Últimas 8 semanas', semanas: sem })}
    ${conMeses ? barras({ titulo: 'Sesiones por mes, último año', cifra: String(total12), cifraTexto: total12 === 1 ? 'sesión en el año' : 'sesiones en el año', unidad: 'sesiones', valores: meses.map(m => m.n), etiquetas: meses.map(m => m.etiqueta), max: 16, cab: 'Mes' }) : ''}
    ${datos}
    ${bloqueNivel(S)}</section>`;
}

// ── Fuerza ──
function seccionFuerza(S) {
  const f = fuerza(S);
  if (!f.filas.length) return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-f"><h2 class="bloque-titulo" id="t-f">Fuerza</h2><p class="texto-2">Cuando apuntes los kilos de tus series verás aquí cómo sube tu fuerza en cada ejercicio.</p></section>`;
  const top = f.filas[0];
  const pts = puntosFecha(top.serie.filter(p => p.v != null));
  return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-f"><h2 class="bloque-titulo" id="t-f">Fuerza</h2>
    ${f.mediana != null ? `<p class="dato-grande"><b class="cifra">${signo(f.mediana)} %</b><span>de fuerza en ${plural(+f.semanas, 'semana', 'semanas')}, mediana de ${cuenta(+f.comparados, 'ejercicio', 'ejercicios')}${f.records ? `, ${cuenta(+f.records, 'récord', 'récords')} en la última vez` : ''}</span></p>` : '<p class="texto-2">Repite un ejercicio con kilos para ver la comparación.</p>'}
    ${pts.length >= 2 ? linea({ titulo: `${top.n}: 1RM estimado de cada sesión`, unidad: 'kg', valores: pts.map(p => p.v), etiquetas: pts.map(p => p.etiqueta), cab: 'Fecha', paso: 2.5, recorrido: 'las sesiones' }) : ''}
    <ul class="lista">${f.filas.slice(0, 12).map(x => `<li><button type="button" class="fila" data-act="progreso.ejercicio" data-id="${h(x.id)}">
      <span class="crece"><b>${h(x.n)}</b><span>${cuenta(+x.veces, 'vez', 'veces')}, último ${es(x.ultimoKg)} kg${x.record ? ', récord' : ''}</span></span>
      ${x.cambio != null ? `<span class="insignia cifra${x.cambio > 0 ? ' insignia--bien' : x.cambio < -5 ? ' insignia--aviso' : ''}">${signo(x.cambio)} %</span>` : ''}${ICONOS.sig}</button></li>`).join('')}</ul>
    <p class="meta">Se compara el 1RM estimado (fórmula de Epley con tus kilos y repeticiones) de la primera y la última vez dentro de las ${+f.semanas} semanas.</p></section>`;
}

function hojaEjercicio(id) {
  const S = estado(), f = fuerza(S, 520).filas.find(x => x.id === id), e = ex(id);
  const regs = registros(S, id).slice().reverse();
  const pts = f ? puntosFecha(f.serie.filter(p => p.v != null)) : [];
  const panel = abrirHoja(`<h2>${h(e ? e.n : id)}</h2>
    ${pts.length >= 2 ? linea({ titulo: '1RM estimado', cifra: es(f.e1rm), cifraTexto: `kg ahora, desde ${es(pts[0].v)} kg`, unidad: 'kg', valores: pts.map(p => p.v), etiquetas: pts.map(p => p.etiqueta), cab: 'Fecha', recorrido: 'las sesiones' }) : ''}
    <h3>Últimas veces</h3>
    <ul class="lista lista-compacta">${regs.slice(0, 15).map(r => `<li><span class="cifra texto-2">${h(fechaCorta(String(r.fecha).slice(0, 10)))}</span><span class="crece">${h(resumen(r))}</span>${r.esfuerzo ? `<span class="texto-2">esfuerzo ${+r.esfuerzo} de 5</span>` : ''}</li>`).join('')}</ul>`, { clase: 'hoja-pf' });
  activar(panel);
}

// ── Salud ──
function seccionSalud(S) {
  const sa = salud(S);
  const ichTxt = { bien: 'saludable', aviso: 'riesgo aumentado', peligro: 'riesgo alto' };
  const t = sa.peso && sa.peso.tendencia;
  const pp = puntosFecha(sa.series.peso), pc = puntosFecha(sa.series.cintura);
  const medida = (titulo, p, ult, u, tend) => p.length >= 2
    ? linea({ titulo, cifra: es(ult.v), cifraTexto: `${u}${tend ? `, ${signo(tend.delta)} desde ${fechaCorta(tend.desde)}` : ''}`, unidad: u, valores: p.map(x => x.v), etiquetas: p.map(x => x.etiqueta), cab: 'Fecha', paso: 1, ancho: 150, recorrido: 'las fechas' })
    : `<div class="grafico"><p class="grafico-titulo">${h(titulo)}</p><p class="grafico-cifra"><b>${h(es(ult.v))}</b><span>${h(u)}</span></p></div>`;
  const hay = sa.peso || sa.cintura;
  const cardioV = Math.min(1, sa.cardio / sa.cardioObjetivo);
  return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-s"><h2 class="bloque-titulo" id="t-s">Salud</h2>
    ${hay ? `<div class="multiples">${sa.peso ? medida('Peso', pp, sa.peso, 'kg', t) : ''}${sa.cintura ? medida('Cintura', pc, sa.cintura, 'cm', sa.cintura.tendencia) : ''}</div>
      ${sa.ich != null || sa.grasa ? `<ul class="datos-lista">
        ${sa.ich != null ? `<li><span>Cintura / altura</span><b class="cifra">${es(sa.ich, 2)} <span class="insignia${sa.ichNivel === 'bien' ? ' insignia--bien' : sa.ichNivel === 'aviso' ? ' insignia--aviso' : ' insignia--error'}">${ichTxt[sa.ichNivel]}</span></b></li>` : ''}
        ${sa.grasa ? `<li><span>% de grasa ${sa.grasa.fuente === 'estimada' ? '(estimado)' : ''}</span><b class="cifra">${es(sa.grasa.v)} %</b></li>` : ''}
      </ul>` : ''}
      ${t ? `<p class="lectura prog-lectura">${h(lecturaPeso(S, t))}</p>` : ''}`
    : '<p class="texto-2">Apunta peso y cintura cada una o dos semanas, por la mañana y en ayunas. Con eso se ve si la comida y el entrenamiento van en la dirección de tus objetivos.</p>'}
    ${!sa.altura ? '<p class="ayuda">Añade tu altura en Perfil › Mis datos para calcular el índice cintura/altura.</p>' : ''}
    <div class="bloque-fila bloque"><span class="pequeno">Cardio, últimos 7 días</span><b class="cifra pequeno">${+sa.cardio} de ${+sa.cardioObjetivo} min</b></div>
    <div class="barra-cardio" role="img" aria-label="${+sa.cardio} de ${+sa.cardioObjetivo} minutos de cardio en los últimos 7 días"><i data-v="${cardioV.toFixed(3)}"></i></div>
    <p class="meta">La OMS recomienda al menos 150 minutos a la semana de actividad moderada. Cuentan los ejercicios de cardio y la natación apuntados en tus sesiones.</p>
    <button type="button" class="boton boton--secundario" data-act="progreso.medida">${ICONOS.mas}<span>Apuntar medidas</span></button></section>`;
}

// ── Dolor ──
function seccionDolor(S) {
  const zonas = dolor(S);
  if (!zonas.length) return '';
  const tend = { baja: 'baja', sube: 'sube', igual: 'estable' };
  return `<section class="tarjeta bloque prog-sec" aria-labelledby="t-d"><h2 class="bloque-titulo" id="t-d">Dolor</h2>
    ${zonas.map(z => {
    const meses = dolorPorMes(S, z.zona);
    const titulo = `${z.nombre}${z.tendencia ? `: ${tend[z.tendencia]}` : ''}`;
    const graf = meses.length >= 2
      ? barras({ titulo, cifra: z.ultimo != null ? String(z.ultimo) : null, cifraTexto: 'de 10 la última vez', unidad: 'de 10', valores: meses.map(m => m.v), etiquetas: meses.map(m => m.etiqueta), max: 10, cab: 'Mes' })
      : `<div class="grafico"><p class="grafico-titulo">${h(titulo)}</p>${z.ultimo != null ? `<p class="grafico-cifra"><b>${+z.ultimo}</b><span>de 10 la última vez</span></p>` : ''}</div>`;
    const nota = z.subidas ? `${cuenta(+z.subidas, 'sesión', 'sesiones')} en las que subió 2 puntos o más${z.sospechosos.length ? `; coincide con ${listaY(z.sospechosos.map(s => `${minus((ex(s.id) || {}).n || s.id)} (${plural(+s.n, 'vez', 'veces', +s.total)})`))}. Tu entrenador lo tiene en cuenta` : ''}.` : '';
    return `<div class="dolor-zona">${graf}${nota ? `<p class="meta">${h(nota)}</p>` : ''}</div>`;
  }).join('')}
    <p class="meta">De 0 a 10: media de cada mes de lo que apuntas al terminar las sesiones y en tu perfil.</p></section>`;
}

function historial(S) {
  const s = sesionesHechas(S).reverse().slice(0, 6);
  if (!s.length) return '';
  return `<section class="bloque prog-sec" aria-labelledby="t-u"><h2 class="bloque-titulo" id="t-u">Últimas sesiones</h2><ul class="lista">${s.map(x => `<li><a class="fila" href="#sesion/${h(x.id)}"><span class="crece"><b>${h(x.nombre)}</b><span>${h([fechaCorta(x.fecha), minus(LUGARES[x.lugar] || ''), x.cierre && x.cierre.esfuerzo ? `esfuerzo ${+x.cierre.esfuerzo} de 5` : ''].filter(Boolean).join(', '))}</span></span>${ICONOS.sig}</a></li>`).join('')}</ul></section>`;
}

function vista() {
  const S = estado();
  const hay = sesionesHechas(S).length;
  if (!hay && !S.medidas.length) {
    return `<h1 class="titulo-pantalla">Progreso</h1>
      <section class="tarjeta vacio prog-vacio"><h2 class="tarjeta-nombre">Tu progreso empieza con tu primera sesión</h2>
        <p>Aquí verás tu constancia semana a semana, cómo sube tu fuerza en cada ejercicio, tus medidas y cómo evoluciona el dolor.</p>
        <div class="fila-botones"><a class="boton" href="#hoy">Ir a Hoy</a><button type="button" class="boton boton--secundario" data-act="progreso.medida">${ICONOS.mas}<span>Apuntar mis medidas de hoy</span></button></div></section>`;
  }
  return `<h1 class="titulo-pantalla">Progreso</h1>${hay ? seccionConstancia(S) : ''}${seccionFuerza(S)}${seccionSalud(S)}${seccionDolor(S)}${historial(S)}`;
}

acciones({
  'progreso.ejercicio': el => hojaEjercicio(el.dataset.id),
  'progreso.medida': () => {
    const S = estado(), ult = {};
    S.medidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => MEDIDAS.forEach(([k]) => { if (m[k] != null) ult[k] = m[k]; }));
    const hoy = S.medidas.find(m => m.fecha === hoyISO()) || {};
    const campo = ([k, n, u]) => `<div class="campo"><label for="m-${k}">${n} (${u})</label><input inputmode="decimal" id="m-${k}" autocomplete="off" value="${hoy[k] != null ? h(hoy[k]) : ''}" placeholder="${ult[k] != null ? 'última: ' + h(es(ult[k])) : ''}"></div>`;
    abrirHoja(`<h2>Medidas de hoy</h2>
      <p class="hoja-texto">Por la mañana, en ayunas. La cintura, a la altura del ombligo y sin apretar.</p>
      <div class="rejilla-campos">${MEDIDAS.filter(m => m[3]).map(campo).join('')}</div>
      <details class="tecnica"><summary>Más medidas</summary><p class="tecnica-texto">Con cuello, cintura y cadera se estima el % de grasa.</p><div class="rejilla-campos">${MEDIDAS.filter(m => !m[3]).map(campo).join('')}</div></details>
      <p class="mensaje mensaje--error" id="m-error" role="alert" hidden></p>
      <button type="button" class="boton boton--ancho" data-act="progreso.guardarMedida">Guardar medidas</button>`, { clase: 'hoja-pf' });
  },
  'progreso.guardarMedida': () => {
    const x = { fecha: hoyISO() }, malas = [];
    MEDIDAS.forEach(([k, n, u, , min, max]) => {
      const el = $('#m-' + k), txt = el.value.trim(), v = num(txt);
      const mal = !!txt && (v == null || v < min || v > max);
      if (mal) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'm-error'); malas.push(`${n}: entre ${min} y ${max} ${u}`); }
      else { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); if (v != null) x[k] = v; }
    });
    const error = $('#m-error');
    if (malas.length) {
      error.textContent = `Revisa ${malas.length === 1 ? 'esta medida' : 'estas medidas'}. ${malas.join('. ')}.`;
      error.hidden = false;
      const primera = $('.hoja [aria-invalid="true"]');
      if (primera && primera.closest('details')) primera.closest('details').open = true;
      try { primera && primera.focus(); } catch { /* nada */ }
      return;
    }
    if (Object.keys(x).length === 1) return cerrarHoja();
    cambiar(S => { S.medidas = S.medidas.filter(m => m.fecha !== x.fecha); S.medidas.push(x); }, 'medidas');
    cerrarHoja();
  },
});

rutas({ progreso: { titulo: 'Progreso', vista, montar: raiz => activar(raiz) } });
pestaña({ ruta: 'progreso', nombre: 'Progreso', icono: ICONOS.progreso, orden: 20 });
