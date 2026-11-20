// Dirección «Hierro»: cartel de sala de pesas. Cifras enormes y estrechas, rejilla rígida y discos como unidad de medida.
import { iniciar } from '../comun/demo.js';
import { h, num, mmss, SEMANAS } from '../comun/datos.js';

const cab = () => '<header class="cab"><img src="logo.svg" alt="Pipos Fitness" width="120" height="30"></header>';
// Envuelve una cifra grande para que entre subiendo desde su línea base (máscara)
const revela = (txt, clase = '') => `<span class="revela ${clase}"><span>${txt}</span></span>`;

function hoy(d) {
  const t = d.hoy;
  const maxMin = Math.max(...t.semana.map(x => x.min || 0));
  const semana = t.semana.map(x => {
    const estado = { hecho: 'hecha', hoy: 'hoy', plan: 'prevista', descanso: 'descanso' }[x.e];
    return `<li class="col c-${x.e}"><span class="disco" data-v="${x.min ? (0.35 + 0.65 * x.min / maxMin).toFixed(3) : 0.08}"></span><span class="col-d">${x.e === 'hoy' ? 'Hoy' : x.d}</span><span class="solo-lector">${x.n}, ${estado}${x.min ? `, ${x.min} minutos` : ''}</span></li>`;
  }).join('');
  return `${cab()}
  <section class="hoy">
    <p class="fecha">${h(t.fecha)}</p>
    <h1 class="cartel">${h(t.titulo)}</h1>
    <div class="cifras-hoy">
      <p>${revela(`<b class="cifra">${t.minutos}</b>`)}<span>minutos</span></p>
      <p class="lugar">${h(t.lugar)}</p>
    </div>
    <p class="porque">${h(t.porque)}</p>
    <ol class="partes">
      ${t.partes.map((p, i) => `<li><span class="parte-n cifra">${i + 1}</span><div><b>${h(p.nombre)}</b><span>${h(p.detalle)}</span></div><span class="cifra min">${p.min} min</span></li>`).join('')}
    </ol>
    <div class="semana">
      <div class="semana-cab"><h2>Semana</h2><p><b class="cifra">${t.constancia.hechas}</b> de <span class="cifra">${t.constancia.previstas}</span> sesiones</p></div>
      <ol class="cols">${semana}</ol>
    </div>
  </section>
  <div class="accion"><button type="button" class="boton-principal" data-act="ir" data-a="sesion">Empezar sesión</button></div>`;
}

function sesion(d, s) {
  const actual = s.series[s.actual];
  const kg = actual ? (actual.kg ?? s.series[s.actual - 1]?.kg) : null;
  const tira = s.series.map((x, i) => {
    const est = i === s.actual ? 'actual' : x.hecha ? 'hecha' : 'pendiente';
    return `<li class="t-${est}"${i === s.actual ? ' aria-current="step"' : ''}><span class="t-n cifra">${i + 1}</span><span class="t-v cifra">${x.hecha ? `${num(x.kg)}×${x.reps}` : i === s.actual ? 'Ahora' : '—'}</span><span class="solo-lector">${est === 'hecha' ? 'hecha' : est === 'actual' ? 'en curso' : 'pendiente'}</span></li>`;
  }).join('');
  const bloque = actual ? `<div class="bloque-actual" data-actual>
      <div class="pesos">
        <div class="peso" role="group" aria-label="Kilos">
          <output class="cifra" data-cifra>${num(kg)}</output><span>kg</span>
          <div class="mm"><button type="button" data-act="kg-" aria-label="Menos ${num(s.paso)} kilos">−</button><button type="button" data-act="kg+" aria-label="Más ${num(s.paso)} kilos">+</button></div>
        </div>
        <div class="peso" role="group" aria-label="Repeticiones">
          <output class="cifra" data-cifra>${actual.reps ?? 10}</output><span>reps</span>
          <div class="mm"><button type="button" data-act="reps-" aria-label="Una repetición menos">−</button><button type="button" data-act="reps+" aria-label="Una repetición más">+</button></div>
        </div>
      </div>
      <button type="button" class="boton-principal" data-act="hecha">Serie ${s.actual + 1} hecha</button></div>`
    : `<p class="todo-hecho">Todas las series hechas.</p><button type="button" class="boton-principal" data-act="terminar">Terminar sesión</button>`;
  return `<header class="barra-sesion">
      <a href="#hoy" class="volver" aria-label="Volver a Hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></a>
      <p class="cifra"><b>${s.orden}</b>/${s.total}<span class="solo-lector"> ejercicios</span></p>
      <button type="button" class="terminar" data-act="terminar">Terminar</button>
    </header>
    <section class="sesion">
      <h1 class="ejercicio">${h(s.ejercicio)}</h1>
      <p class="objetivo">${h(s.objetivo)}</p>
      <ol class="tira" aria-label="Series">${tira}</ol>
      ${bloque}
      <p class="ultima">La última vez: ${h(s.ultima)}</p>
      <details class="tecnica"><summary>Cómo se hace</summary><p>${h(s.tecnica)}</p></details>
      <p class="siguiente">Después: ${h(s.siguiente)}</p>
    </section>
    <div class="descanso" data-descanso role="timer" aria-label="Descanso">
      <span class="descanso-barra" aria-hidden="true"></span>
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
  const filas = Math.max(...p.constancia.map(c => c[1]));
  const rejilla = p.constancia.map(([a, b], i) => `<li aria-label="Semana del ${SEMANAS[i]}: ${a} de ${b}">
      <span class="celdas">${Array.from({ length: filas }, (_, k) => `<i class="${k < a ? 'si' : k < b ? 'no' : 'nada'}"></i>`).join('')}</span>
      <span class="cifra">${SEMANAS[i].split(' ')[0]}<br>${SEMANAS[i].split(' ')[1]}</span></li>`).join('');
  const min = Math.min(...f.valores); const max = Math.max(...f.valores);
  const cols = f.valores.map((v, i) => `<li><span class="cifra">${num(v)}</span><span class="b" data-v="${(0.3 + 0.7 * (v - min) / (max - min || 1)).toFixed(3)}"></span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('');
  const salud = p.salud.valores
    ? `<ol class="dolor" aria-label="Dolor por semana, de 0 a 10">${p.salud.valores.map((v, i) => `<li><span class="b" data-v="${(v / 10).toFixed(2)}"></span><span class="cifra">${v}</span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('')}</ol>`
    : '';
  return `${cab()}
  <section class="progreso">
    <h1 class="cartel">Progreso</h1>
    <h2 class="sec">Fuerza</h2>
    <p class="titular">${revela(`<b class="cifra">${h(f.resumen.split(' ')[0])}</b>`)}<span>${h(f.resumen.split(' ').slice(1).join(' '))}</span></p>
    <p class="pie">${h(f.ejercicio)}, mejor serie de cada semana</p>
    <ol class="columnas">${cols}</ol>
    <table class="tabla">
      <thead><tr><th scope="col">Ejercicio</th><th scope="col">Antes</th><th scope="col">Ahora</th></tr></thead>
      <tbody>${p.fuerza2.map(x => `<tr><th scope="row">${h(x.ejercicio)}</th><td class="cifra">${num(x.antes)}</td><td class="cifra"><b>${num(x.ahora)}</b> ${x.unidad || 'kg'}</td></tr>`).join('')}</tbody>
    </table>
    <h2 class="sec">Constancia</h2>
    <p class="pie">${h(p.racha)}. Cada cuadro es una sesión prevista; lleno, hecha.</p>
    <ol class="rejilla">${rejilla}</ol>
    <h2 class="sec">Salud</h2>
    <p><b>${h(p.salud.titulo)}.</b> ${h(p.salud.texto)}</p>
    ${salud}
  </section>`;
}

function cierre(d) {
  const c = d.cierre;
  const discos = [[72, 0], [56, 1], [40, 2]];
  const lado = l => discos.map(([alto, i]) => `<rect class="d-${l}" data-i="${i}" x="${l === 'izq' ? 70 - i * 18 : 234 + i * 18}" y="${60 - alto / 2}" width="14" height="${alto}" rx="3"/>`).join('');
  return `<div class="cierre">
    <svg class="barra-olimpica" viewBox="0 0 320 120" aria-hidden="true">
      <rect class="eje" x="10" y="57" width="300" height="6" rx="3"/>
      <rect class="eje" x="96" y="52" width="6" height="16" rx="2"/><rect class="eje" x="218" y="52" width="6" height="16" rx="2"/>
      ${lado('izq')}${lado('der')}
    </svg>
    <h2 id="cierre-titulo" tabindex="-1">Sesión hecha</h2>
    <p class="cierre-total">${revela(`<b class="cifra" data-cuenta="${c.kg}">${c.kg}</b>`)}<span>kilos movidos</span></p>
    <dl class="cierre-datos">
      <div><dt>Series</dt><dd class="cifra">${c.series}</dd></div>
      <div><dt>Minutos</dt><dd class="cifra">${c.minutos}</dd></div>
      <div><dt>Semana</dt><dd>${h(c.semana.replace(' esta semana', ''))}</dd></div>
    </dl>
    <p class="cierre-marca">${h(c.marca)}</p>
    <button type="button" class="boton-principal" data-act="cerrar-cierre">Volver a Hoy</button>
  </div>`;
}

iniciar({ nombre: 'Hierro', pantallas: { hoy, sesion, progreso, cierre } });
