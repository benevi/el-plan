// Dirección «Tiza»: la pizarra del gimnasio. Palotes de constancia, trazo de tiza y letra muy legible.
import { iniciar } from '../comun/demo.js';
import { h, num, mmss, SEMANAS } from '../comun/datos.js';

// Un trazo de tiza: línea con un leve temblor, siempre la misma para que no «baile» entre pintadas.
const trazo = (x1, y1, x2, y2, extra = '') => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 1.5} ${(y1 + y2) / 2 - 1} ${x2} ${y2}" ${extra}/>`;

// Grupo de palotes: hechas en tiza llena, previstas sin hacer en discontinua; el tachón cierra la semana completa.
function palotes(hechas, previstas, { clase = '', etiqueta = '' } = {}) {
  const n = Math.max(hechas, previstas);
  const ancho = 10 + n * 14;
  let svg = '';
  for (let i = 0; i < n; i++) {
    const x = 8 + i * 14;
    svg += trazo(x, 6 + (i % 2), x - 1, 42 - (i % 3), `class="${i < hechas ? 'p-hecha' : 'p-prevista'}" data-i="${i}"`);
  }
  if (hechas >= previstas && previstas > 0) svg += trazo(2, 36, ancho - 2, 10, `class="p-tachon" data-i="${n}"`);
  return `<svg class="palotes ${clase}" viewBox="0 0 ${ancho} 48" width="${ancho}" height="48" role="img" aria-label="${h(etiqueta)}">${svg}</svg>`;
}

const subrayado = '<svg class="subrayado" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 Q50 3 100 6 T198 5"/></svg>';

function cabecera() {
  return `<header class="cab"><img src="logo.svg" alt="Pipos Fitness" width="150" height="28"></header>`;
}

function hoy(d) {
  const t = d.hoy;
  const dias = t.semana.map(x => {
    const estado = { hecho: 'hecha', hoy: 'hoy', plan: 'prevista', descanso: 'descanso' }[x.e];
    const marca = x.e === 'hecho' ? `<svg viewBox="0 0 12 40" aria-hidden="true">${trazo(6, 4, 5, 36)}</svg>`
      : x.e === 'descanso' ? '<span class="punto" aria-hidden="true"></span>'
      : `<svg viewBox="0 0 12 40" aria-hidden="true" class="${x.e === 'hoy' ? 'm-hoy' : 'm-plan'}">${trazo(6, 4, 5, 36)}</svg>`;
    return `<li class="dia d-${x.e}"><span class="dia-letra">${x.d}</span><span class="dia-num cifra">${x.n}</span>${marca}<span class="solo-lector">${estado}</span></li>`;
  }).join('');
  return `${cabecera()}
  <section class="hoy">
    <p class="fecha">${h(t.fecha)}</p>
    <h1 class="titulo">${h(t.titulo)}${subrayado}</h1>
    <p class="meta">${h(t.lugar)}, <span class="cifra">${t.minutos}</span> minutos</p>

    <div class="panel semana">
      <ol class="dias" aria-label="Esta semana">${dias}</ol>
      <p class="semana-pie"><b class="cifra">${t.constancia.hechas} de ${t.constancia.previstas}</b> sesiones esta semana</p>
    </div>

    <div class="porque">
      <h2>Por qué esta sesión</h2>
      <p>${h(t.porque)}</p>
    </div>

    <ol class="panel partes">
      ${t.partes.map(p => `<li><div><b>${h(p.nombre)}</b><span>${h(p.detalle)}</span></div><span class="min cifra">${p.min} min</span></li>`).join('')}
    </ol>
  </section>
  <div class="accion"><button type="button" class="boton-principal" data-act="ir" data-a="sesion">Empezar sesión</button></div>`;
}

function sesion(d, s) {
  const actual = s.series[s.actual];
  const filas = s.series.map((x, i) => {
    if (i === s.actual) {
      const kg = x.kg ?? s.series[i - 1]?.kg;
      return `<li class="serie actual" aria-current="step" data-actual>
        <div class="serie-cab"><span class="serie-n cifra">${i + 1}</span><span>Serie ${i + 1} de ${s.series.length}</span></div>
        <div class="selectores">
          <div class="selector" role="group" aria-label="Kilos">
            <button type="button" data-act="kg-" aria-label="Menos ${num(s.paso)} kilos">−</button>
            <output class="cifra"><b data-cifra>${num(kg)}</b><small>kg</small></output>
            <button type="button" data-act="kg+" aria-label="Más ${num(s.paso)} kilos">+</button>
          </div>
          <div class="selector" role="group" aria-label="Repeticiones">
            <button type="button" data-act="reps-" aria-label="Una repetición menos">−</button>
            <output class="cifra"><b data-cifra>${x.reps ?? 10}</b><small>reps</small></output>
            <button type="button" data-act="reps+" aria-label="Una repetición más">+</button>
          </div>
        </div>
        <button type="button" class="boton-principal" data-act="hecha">Serie ${i + 1} hecha</button>
      </li>`;
    }
    const estado = x.hecha ? 'Hecha' : 'Pendiente';
    return `<li class="serie ${x.hecha ? 'hecha' : 'pendiente'}">
      <span class="serie-n cifra">${i + 1}</span>
      <span class="cifra">${x.kg != null ? `${num(x.kg)} kg` : '—'}</span>
      <span class="cifra">${x.reps != null ? `${x.reps} reps` : '—'}</span>
      <span class="serie-estado">${x.hecha ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11 L8 15 L17 4"/></svg>` : ''}${estado}</span>
    </li>`;
  }).join('');
  const fin = !actual ? `<p class="todo-hecho">Todas las series hechas.</p><button type="button" class="boton-principal" data-act="terminar">Terminar sesión</button>` : '';
  return `<header class="barra-sesion">
      <a href="#hoy" class="volver" aria-label="Volver a Hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></a>
      <span class="cifra">Ejercicio ${s.orden} de ${s.total}</span>
      <button type="button" class="terminar" data-act="terminar">Terminar</button>
    </header>
    <section class="sesion">
      <h1 class="ejercicio">${h(s.ejercicio)}</h1>
      <p class="objetivo">${h(s.objetivo)}</p>
      <p class="ultima">La última vez: <span class="cifra">${h(s.ultima)}</span></p>
      <ol class="panel series">${filas}</ol>
      ${fin}
      <details class="tecnica"><summary>Cómo se hace</summary><p>${h(s.tecnica)}</p></details>
      <p class="siguiente">Después: ${h(s.siguiente)}</p>
    </section>
    <div class="descanso" data-descanso role="timer" aria-label="Descanso">
      <div class="descanso-linea" aria-hidden="true"><span></span></div>
      <div class="descanso-fila">
        <div class="descanso-txt"><span class="descanso-et">Descanso</span><span class="descanso-fin">Descanso terminado</span><b class="cifra" data-reloj>${mmss(s.descanso.restante)}</b></div>
        <button type="button" data-act="descanso+">+15 s</button>
        <button type="button" data-act="descanso-fin">Saltar</button>
      </div>
    </div>
    <p class="solo-lector" aria-live="assertive" data-vivo></p>`;
}

function progreso(d) {
  const p = d.progreso; const f = p.fuerza;
  const grupos = p.constancia.map(([a, b], i) => `<li>${palotes(a, b, { etiqueta: `${a} de ${b} sesiones` })}<span class="cifra">${SEMANAS[i]}</span></li>`).join('');
  // Gráfico de fuerza con trazo de tiza
  const min = Math.min(...f.valores) - 2.5; const max = Math.max(...f.valores) + 2.5;
  const X = i => 12 + i * (296 / (f.valores.length - 1)); const Y = v => 120 - ((v - min) / (max - min)) * 104;
  const linea = f.valores.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const puntos = f.valores.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"/>`).join('');
  const salud = p.salud.valores
    ? `<ol class="dolor" aria-label="Dolor por semana, de 0 a 10">${p.salud.valores.map((v, i) => `<li><span class="barra-dolor" data-v="${v / 10}"></span><span class="cifra">${v}</span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('')}</ol>`
    : '';
  return `${cabecera()}
  <section class="progreso">
    <h1 class="titulo">Progreso${subrayado}</h1>

    <h2 class="sec">Constancia</h2>
    <div class="panel">
      <ol class="semanas">${grupos}</ol>
      <p class="pie">${h(p.racha)}. Una semana tachada es una semana completa.</p>
    </div>

    <h2 class="sec">Fuerza</h2>
    <div class="panel fuerza">
      <p class="grande cifra">${h(f.resumen)}</p>
      <p class="pie">${h(f.ejercicio)}, mejor serie de cada semana</p>
      <svg class="grafico" viewBox="0 0 320 132" role="img" aria-label="${h(f.ejercicio)}: de ${num(f.valores[0])} a ${num(f.valores.at(-1))} kilos">
        <path class="g-base" d="M4 124 H316"/>
        <path class="g-linea" d="${linea}"/>${puntos}
        <text x="12" y="${(Y(f.valores[0]) - 10).toFixed(0)}" class="cifra">${num(f.valores[0])}</text>
        <text x="300" y="${(Y(f.valores.at(-1)) - 10).toFixed(0)}" text-anchor="end" class="cifra">${num(f.valores.at(-1))} kg</text>
      </svg>
      <ul class="otros">${p.fuerza2.map(x => `<li><span>${h(x.ejercicio)}</span><span class="cifra">${num(x.antes)} → <b>${num(x.ahora)} ${x.unidad || 'kg'}</b></span></li>`).join('')}</ul>
    </div>

    <h2 class="sec">Salud</h2>
    <div class="panel salud">
      <p><b>${h(p.salud.titulo)}</b></p>
      <p class="pie">${h(p.salud.texto)}</p>
      ${salud}
    </div>
  </section>`;
}

function cierre(d) {
  const c = d.cierre;
  return `<div class="cierre">
    <svg class="cierre-palotes" viewBox="0 0 120 96" aria-hidden="true">
      ${[0, 1, 2, 3].map(i => trazo(20 + i * 24, 12 + (i % 2) * 2, 19 + i * 24, 84 - (i % 3) * 2, `data-i="${i}"`)).join('')}
      ${trazo(4, 74, 116, 20, 'class="c-tachon"')}
    </svg>
    <span class="polvo" aria-hidden="true">${'<i></i>'.repeat(7)}</span>
    <h2 id="cierre-titulo" tabindex="-1">Sesión hecha</h2>
    <p class="cierre-semana">${h(c.semana)}</p>
    <dl class="cierre-datos">
      <div><dt>Series</dt><dd class="cifra" data-cuenta="${c.series}">${c.series}</dd></div>
      <div><dt>Minutos</dt><dd class="cifra" data-cuenta="${c.minutos}">${c.minutos}</dd></div>
      <div><dt>Kilos movidos</dt><dd class="cifra" data-cuenta="${c.kg}">${c.kg.toLocaleString('es-ES')}</dd></div>
    </dl>
    <p class="cierre-marca">${h(c.marca)}</p>
    <button type="button" class="boton-principal" data-act="cerrar-cierre">Volver a Hoy</button>
  </div>`;
}

iniciar({ nombre: 'Tiza', pantallas: { hoy, sesion, progreso, cierre } });
