// Dirección «Carril»: la piscina climatizada. Calles, la T del final de la calle y cifras de marcador de competición.
import { iniciar } from '../comun/demo.js';
import { h, num, mmss, SEMANAS } from '../comun/datos.js';

function cabecera(derecha = '') {
  return `<header class="cab"><img src="logo.svg" alt="Pipos Fitness" width="132" height="28">${derecha}</header>`;
}

// La sesión como una calle: cada parte ocupa lo que dura; al final, la T de la pared.
function calle(partes) {
  const total = partes.reduce((a, p) => a + p.min, 0);
  return `<div class="calle" role="img" aria-label="${partes.map(p => `${p.nombre}, ${p.min} minutos`).join('; ')}">
    ${partes.map((p, i) => `<span class="tramo t${i}" data-v="${p.min / total}"></span>`).join('')}
    <span class="calle-t" aria-hidden="true"></span>
  </div>`;
}

function hoy(d) {
  const t = d.hoy;
  const azulejos = t.semana.map(x => {
    const estado = { hecho: 'hecha', hoy: 'hoy', plan: 'prevista', descanso: 'descanso' }[x.e];
    return `<li class="az az-${x.e}"><span class="az-d">${x.d}</span><span class="az-n cifra">${x.n}</span>${x.e === 'hecho' ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4"/></svg>' : ''}<span class="solo-lector">${estado}</span></li>`;
  }).join('');
  return `${cabecera(`<span class="cab-fecha">${h(t.fecha)}</span>`)}
  <section class="hoy">
    <h1>${h(t.titulo)}</h1>
    <div class="marcador-hoy">
      <p><b class="cifra num-cond">${t.minutos}</b><span>min</span></p>
      <p class="lugar">${h(t.lugar)}</p>
    </div>
    ${calle(t.partes)}
    <ol class="partes">
      ${t.partes.map((p, i) => `<li><span class="parte-marca t${i}" aria-hidden="true"></span><div><b>${h(p.nombre)}</b><span>${h(p.detalle)}</span></div><span class="cifra min">${p.min} min</span></li>`).join('')}
    </ol>
    <p class="porque"><b>Por qué hoy.</b> ${h(t.porque)}</p>
    <div class="corchera" aria-hidden="true"></div>
    <h2 class="sec">Esta semana <span class="cifra">${t.constancia.hechas} de ${t.constancia.previstas}</span></h2>
    <ol class="azulejos">${azulejos}</ol>
  </section>
  <div class="accion"><button type="button" class="boton-principal" data-act="ir" data-a="sesion">Empezar sesión</button></div>`;
}

function sesion(d, s) {
  const actual = s.series[s.actual];
  const filas = s.series.map((x, i) => {
    if (i === s.actual) {
      const kg = x.kg ?? s.series[i - 1]?.kg;
      return `<li class="serie actual" aria-current="step" data-actual>
        <p class="serie-titulo"><span class="cifra">Serie ${i + 1}</span> de ${s.series.length}</p>
        <div class="marcador">
          <div class="casilla" role="group" aria-label="Kilos">
            <output class="cifra num-cond" data-cifra>${num(kg)}</output><span class="unidad">kilos</span>
            <div class="mm"><button type="button" data-act="kg-" aria-label="Menos ${num(s.paso)} kilos">−</button><button type="button" data-act="kg+" aria-label="Más ${num(s.paso)} kilos">+</button></div>
          </div>
          <div class="casilla" role="group" aria-label="Repeticiones">
            <output class="cifra num-cond" data-cifra>${x.reps ?? 10}</output><span class="unidad">repeticiones</span>
            <div class="mm"><button type="button" data-act="reps-" aria-label="Una repetición menos">−</button><button type="button" data-act="reps+" aria-label="Una repetición más">+</button></div>
          </div>
        </div>
        <button type="button" class="boton-principal" data-act="hecha">Hecha</button>
      </li>`;
    }
    return `<li class="serie ${x.hecha ? 'hecha' : 'pendiente'}">
      <span class="serie-n cifra num-cond">${i + 1}</span>
      <span class="cifra">${x.kg != null ? `${num(x.kg)} kg × ${x.reps}` : 'Sin hacer'}</span>
      <span class="serie-estado">${x.hecha ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4"/></svg>Hecha' : 'Pendiente'}</span>
    </li>`;
  }).join('');
  const fin = !actual ? `<p class="todo-hecho">Todas las series hechas.</p><button type="button" class="boton-principal" data-act="terminar">Terminar sesión</button>` : '';
  return `<header class="barra-sesion">
      <a href="#hoy" class="volver" aria-label="Volver a Hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></a>
      <div class="progreso-ses" role="img" aria-label="Ejercicio ${s.orden} de ${s.total}">${Array.from({ length: s.total }, (_, i) => `<span class="${i < s.orden - 1 ? 'pasado' : i === s.orden - 1 ? 'ahora' : ''}"></span>`).join('')}</div>
      <button type="button" class="terminar" data-act="terminar">Terminar</button>
    </header>
    <section class="sesion">
      <p class="orden cifra">Ejercicio ${s.orden} de ${s.total}</p>
      <h1>${h(s.ejercicio)}</h1>
      <p class="objetivo">${h(s.objetivo)}. <span>La última vez, ${h(s.ultima)}.</span></p>
      <ol class="series">${filas}</ol>
      ${fin}
      <details class="tecnica"><summary>Cómo se hace</summary><p>${h(s.tecnica)}</p></details>
      <p class="siguiente">Después: ${h(s.siguiente)}</p>
    </section>
    <div class="descanso" data-descanso role="timer" aria-label="Descanso">
      <div class="descanso-fila">
        <div class="descanso-txt"><span class="descanso-et">Descanso</span><span class="descanso-fin">¡A la serie siguiente!</span><b class="cifra num-cond" data-reloj>${mmss(s.descanso.restante)}</b></div>
        <button type="button" data-act="descanso+">+15 s</button>
        <button type="button" data-act="descanso-fin">Saltar</button>
      </div>
      <div class="largo" aria-hidden="true"><span class="largo-agua"></span><span class="largo-t"></span></div>
    </div>
    <p class="solo-lector" aria-live="assertive" data-vivo></p>`;
}

function progreso(d) {
  const p = d.progreso; const f = p.fuerza;
  const calles = p.constancia.map(([a, b], i) => `<li>
      <span class="cifra sem">${SEMANAS[i]}</span>
      <span class="pista" role="img" aria-label="${a} de ${b} sesiones">${Array.from({ length: b }, (_, k) => `<i class="${k < a ? 'si' : ''}"></i>`).join('')}${a >= b ? '<em class="t-fin"></em>' : ''}</span>
      <span class="cifra cuenta">${a}/${b}</span>
    </li>`).join('');
  const min = Math.min(...f.valores); const max = Math.max(...f.valores);
  const barras = f.valores.map((v, i) => `<li><span class="b" data-v="${(0.25 + 0.75 * (v - min) / (max - min || 1)).toFixed(3)}"></span><span class="cifra">${num(v)}</span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('');
  const salud = p.salud.valores
    ? `<ol class="barras dolor" aria-label="Dolor por semana, de 0 a 10">${p.salud.valores.map((v, i) => `<li><span class="b" data-v="${v / 10}"></span><span class="cifra">${v}</span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('')}</ol>`
    : '';
  return `${cabecera()}
  <section class="progreso">
    <h1>Progreso</h1>
    <h2 class="sec">Constancia</h2>
    <p class="pie">${h(p.racha)}. La T marca la semana completa.</p>
    <ol class="calles">${calles}</ol>
    <div class="corchera" aria-hidden="true"></div>
    <h2 class="sec">Fuerza</h2>
    <p class="destacado"><b class="cifra num-cond">${h(f.resumen.split(' ')[0])}</b> <span>${h(f.resumen.split(' ').slice(1).join(' '))}</span></p>
    <p class="pie">${h(f.ejercicio)}, mejor serie de cada semana en kilos</p>
    <ol class="barras" aria-label="${h(f.ejercicio)}: de ${num(f.valores[0])} a ${num(f.valores.at(-1))} kilos">${barras}</ol>
    <ul class="otros">${p.fuerza2.map(x => `<li><span>${h(x.ejercicio)}</span><span class="cifra">${num(x.antes)} → <b>${num(x.ahora)} ${x.unidad || 'kg'}</b></span></li>`).join('')}</ul>
    <div class="corchera" aria-hidden="true"></div>
    <h2 class="sec">Salud</h2>
    <p><b>${h(p.salud.titulo)}.</b> ${h(p.salud.texto)}</p>
    ${salud}
  </section>`;
}

function cierre(d) {
  const c = d.cierre;
  return `<div class="cierre">
    <div class="meta-largo" aria-hidden="true"><span class="ml-linea"></span><span class="ml-t"></span><i></i><i></i><i></i></div>
    <h2 id="cierre-titulo" tabindex="-1">Sesión hecha</h2>
    <p class="cierre-semana">${h(c.semana)}</p>
    <dl class="cierre-datos">
      <div><dt>series</dt><dd class="cifra num-cond" data-cuenta="${c.series}">${c.series}</dd></div>
      <div><dt>minutos</dt><dd class="cifra num-cond" data-cuenta="${c.minutos}">${c.minutos}</dd></div>
      ${c.metros ? `<div><dt>metros nadados</dt><dd class="cifra num-cond" data-cuenta="${c.metros}">${c.metros}</dd></div>` : `<div><dt>kilos movidos</dt><dd class="cifra num-cond" data-cuenta="${c.kg}">${c.kg}</dd></div>`}
    </dl>
    <p class="cierre-marca"><b>Mejor marca.</b> ${h(c.marca)}</p>
    <button type="button" class="boton-principal" data-act="cerrar-cierre">Volver a Hoy</button>
  </div>`;
}

// Las barras de la calle se reparten por flex-grow según los minutos de cada parte.
function despues(raiz) {
  raiz.querySelectorAll('.tramo[data-v]').forEach(n => { n.style.flexGrow = n.dataset.v; });
}

iniciar({ nombre: 'Carril', pantallas: { hoy, sesion, progreso, cierre, despues } });
