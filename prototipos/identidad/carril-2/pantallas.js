// Dirección «Carril 2»: Carril más sobria. La piscina queda como alusión (la línea del agua, el nivel que sube,
// las ondas) y el carácter lo ponen el aire, una letra más fina y un movimiento más cuidado.
import { iniciar } from '../comun/demo.js';
import { h, num, mmss, SEMANAS } from '../comun/datos.js';

// ---- Cifras que fluyen: cada dígito es una tira 0-9 que se desplaza (solo transform) ----
const TIRA = '<span class="rd-tira">' + [...'0123456789'].map(n => `<span>${n}</span>`).join('') + '</span>';
function rodillo(texto, { desde = null } = {}) {
  let i = 0;
  const visible = [...String(texto)].map(c => /\d/.test(c)
    ? `<span class="rd" data-d="${desde ?? c}" data-fin="${c}" data-i="${i++}">${TIRA}</span>`
    : `<span class="rd-sep">${c}</span>`).join('');
  return `<span class="solo-lector">${h(texto)}</span><span class="rodillo" aria-hidden="true">${visible}</span>`;
}
const fijarDigitos = raiz => raiz.querySelectorAll('.rd').forEach(n => n.style.setProperty('--d', n.dataset.d));

function cab(fecha = '') {
  return `<header class="cab"><img src="logo.svg" alt="Pipos Fitness" width="136" height="24">${fecha ? `<span class="cab-fecha">${h(fecha)}</span>` : ''}</header>`;
}

function hoy(d) {
  const t = d.hoy;
  const total = t.partes.reduce((a, p) => a + p.min, 0);
  const dias = t.semana.map((x, i) => {
    const estado = { hecho: 'hecha', hoy: 'hoy', plan: 'prevista', descanso: 'descanso' }[x.e];
    return `<li class="dia d-${x.e}" data-i="${i}"><span class="dia-l">${x.d}</span><span class="dia-c cifra">${x.e === 'hecho' ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.8 11.5 12.5 4.8"/></svg>' : x.n}</span><span class="solo-lector">${x.n}, ${estado}</span></li>`;
  }).join('');
  return `${cab(t.fecha)}
  <section class="hoy">
    <div class="bloque" data-i="0">
      <h1>${h(t.titulo)}</h1>
      <p class="meta">${h(t.lugar)}, <span class="cifra">${t.minutos}</span> minutos</p>
      <div class="calle" role="img" aria-label="${t.partes.map(p => `${p.nombre}, ${p.min} minutos`).join('; ')}">${t.partes.map((p, i) => `<span class="tramo t${i}" data-i="${i}" data-g="${p.min / total}"></span>`).join('')}</div>
    </div>
    <ol class="partes bloque" data-i="1">
      ${t.partes.map((p, i) => `<li><span class="punto t${i}" aria-hidden="true"></span><div><b>${h(p.nombre)}</b><span>${h(p.detalle)}</span></div><span class="cifra min">${p.min} min</span></li>`).join('')}
    </ol>
    <div class="bloque" data-i="2">
      <h2 class="sec">Por qué hoy</h2>
      <p class="porque">${h(t.porque)}</p>
    </div>
    <div class="bloque" data-i="3">
      <div class="sec-fila"><h2 class="sec">Esta semana</h2><p class="cifra">${t.constancia.hechas} de ${t.constancia.previstas} sesiones</p></div>
      <ol class="dias">${dias}</ol>
    </div>
  </section>
  <div class="accion"><button type="button" class="boton-principal" data-act="ir" data-a="sesion">Empezar sesión</button></div>`;
}

function sesion(d, s) {
  const actual = s.series[s.actual];
  const recien = Date.now() - (s.ultimoToque || 0) < 900;
  const filas = s.series.map((x, i) => {
    if (i === s.actual) {
      const kg = x.kg ?? s.series[i - 1]?.kg;
      return `<li class="serie actual" aria-current="step" data-actual>
        <p class="serie-t">Serie <span class="cifra">${i + 1}</span> de <span class="cifra">${s.series.length}</span></p>
        <div class="valores">
          <div class="valor" role="group" aria-label="Kilos">
            <p><output class="cifra num" data-cifra>${num(kg)}</output><span>kg</span></p>
            <div class="paso"><button type="button" data-act="kg-" aria-label="Menos ${num(s.paso)} kilos">−</button><button type="button" data-act="kg+" aria-label="Más ${num(s.paso)} kilos">+</button></div>
          </div>
          <div class="valor" role="group" aria-label="Repeticiones">
            <p><output class="cifra num" data-cifra>${x.reps ?? 10}</output><span>reps</span></p>
            <div class="paso"><button type="button" data-act="reps-" aria-label="Una repetición menos">−</button><button type="button" data-act="reps+" aria-label="Una repetición más">+</button></div>
          </div>
        </div>
        <button type="button" class="boton-principal" data-act="hecha">Serie ${i + 1} hecha</button>
      </li>`;
    }
    const acaba = recien && x.hecha && i === (actual ? s.actual - 1 : s.series.length - 1);
    return `<li class="serie ${x.hecha ? 'hecha' : 'pendiente'}${acaba ? ' recien' : ''}">
      <span class="serie-n cifra">${i + 1}</span>
      <span class="cifra">${x.hecha ? `${num(x.kg)} kg × ${x.reps}` : 'Pendiente'}</span>
      ${x.hecha ? '<span class="ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.8 11.5 12.5 4.8"/></svg>Hecha</span>' : ''}
    </li>`;
  }).join('');
  const fin = !actual ? `<div class="todo"><p>Todas las series hechas.</p><button type="button" class="boton-principal" data-act="terminar">Terminar sesión</button></div>` : '';
  return `<header class="barra-sesion">
      <a href="#hoy" class="volver" aria-label="Volver a Hoy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></a>
      <div class="avance" role="img" aria-label="Ejercicio ${s.orden} de ${s.total}">${Array.from({ length: s.total }, (_, i) => `<span class="${i < s.orden - 1 ? 'pasado' : i === s.orden - 1 ? 'ahora' : ''}"></span>`).join('')}</div>
      <button type="button" class="terminar" data-act="terminar">Terminar</button>
    </header>
    <section class="sesion">
      <p class="orden">Ejercicio <span class="cifra">${s.orden}</span> de <span class="cifra">${s.total}</span></p>
      <h1>${h(s.ejercicio)}</h1>
      <p class="objetivo">${h(s.objetivo)}</p>
      <p class="ultima">La última vez: <span class="cifra">${h(s.ultima)}</span></p>
      <ol class="series">${filas}</ol>
      ${fin}
      <details class="tecnica"><summary>Cómo se hace</summary><p>${h(s.tecnica)}</p></details>
      <p class="siguiente">Después: ${h(s.siguiente)}</p>
    </section>
    <div class="descanso" data-descanso role="timer" aria-label="Descanso">
      <span class="nivel" aria-hidden="true"></span>
      <div class="descanso-fila">
        <div class="descanso-txt"><span class="descanso-et">Descanso</span><span class="descanso-fin">Descanso terminado</span><b class="cifra reloj" data-reloj>${mmss(s.descanso.restante)}</b><span class="eco" aria-hidden="true"></span></div>
        <button type="button" data-act="descanso+">+15 s</button>
        <button type="button" data-act="descanso-fin">Saltar</button>
      </div>
    </div>
    <p class="solo-lector" aria-live="assertive" data-vivo></p>`;
}

function progreso(d) {
  const p = d.progreso; const f = p.fuerza;
  const vasos = p.constancia.map(([a, b], i) => `<li data-i="${i}">
      <span class="vaso${a >= b ? ' lleno' : ''}" role="img" aria-label="Semana del ${SEMANAS[i]}: ${a} de ${b}${a >= b ? ', completa' : ''}"><i data-v="${(a / b).toFixed(3)}" data-i="${i}"></i>${a >= b ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.8 11.5 12.5 4.8"/></svg>' : ''}</span>
      <span class="cifra sem">${SEMANAS[i].replace(' ', '<br>')}</span></li>`).join('');
  // Línea de fuerza con su área (un solo tono que se desvanece)
  const min = Math.min(...f.valores) - 2.5; const max = Math.max(...f.valores) + 1;
  const X = i => 8 + i * (304 / (f.valores.length - 1)); const Y = v => 104 - ((v - min) / (max - min)) * 92;
  const pts = f.valores.map((v, i) => [X(i), Y(v)]);
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [ux, uy] = pts.at(-1);
  const salud = p.salud.valores
    ? `<ol class="dolor" aria-label="Dolor por semana, de 0 a 10">${p.salud.valores.map((v, i) => `<li><span class="b" data-v="${(v / 10).toFixed(2)}" data-i="${i}"></span><span class="cifra">${v}</span><span class="solo-lector">${SEMANAS[i]}</span></li>`).join('')}</ol>`
    : '';
  const [signo, ...resto] = f.resumen.split(' ');
  return `${cab()}
  <section class="progreso">
    <h1 class="bloque" data-i="0">Progreso</h1>
    <div class="bloque" data-i="1">
      <h2 class="sec">Constancia</h2>
      <p class="pie">${h(p.racha)}.</p>
      <ol class="vasos">${vasos}</ol>
    </div>
    <div class="bloque" data-i="2">
      <h2 class="sec">Fuerza</h2>
      <p class="titular"><b class="cifra">${rodillo(signo)}</b><span>${h(resto.join(' '))}</span></p>
      <p class="pie">${h(f.ejercicio)}, mejor serie de cada semana</p>
      <div class="grafico-caja">
        <svg class="grafico" viewBox="0 0 320 116" role="img" aria-label="${h(f.ejercicio)}: de ${num(f.valores[0])} a ${num(f.valores.at(-1))} kilos en 8 semanas">
          <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="g-a1"/><stop offset="1" class="g-a2"/></linearGradient></defs>
          <path class="g-area" d="${linea} L${ux.toFixed(1)} 112 L8 112 Z"/>
          <path class="g-linea" d="${linea}"/>
          <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4.5" class="g-fin"/>
        </svg>
        <span class="cortina" aria-hidden="true"></span>
        <p class="ejes cifra"><span>${num(f.valores[0])} kg</span><span>${num(f.valores.at(-1))} kg</span></p>
      </div>
      <ul class="otros">${p.fuerza2.map(x => `<li><span>${h(x.ejercicio)}</span><span class="cifra">${num(x.antes)} <span class="flecha" aria-label="a">→</span> <b>${num(x.ahora)} ${x.unidad || 'kg'}</b></span></li>`).join('')}</ul>
    </div>
    <div class="bloque" data-i="3">
      <h2 class="sec">Salud</h2>
      <p><b>${h(p.salud.titulo)}.</b> <span class="pie">${h(p.salud.texto)}</span></p>
      ${salud}
    </div>
  </section>`;
}

function cierre(d) {
  const c = d.cierre;
  const tercero = c.metros ? ['metros', c.metros] : ['kilos', c.kg];
  return `<div class="cierre">
    <div class="agua" aria-hidden="true"><svg class="ola" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d="M0 20 C100 0 200 0 300 20 S500 40 600 20 S800 0 900 20 S1100 40 1200 20 V40 H0 Z"/></svg></div>
    <div class="cierre-dentro">
      <div class="sello" aria-hidden="true"><i></i><i></i><i></i><span><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg></span></div>
      <h2 id="cierre-titulo" tabindex="-1">Sesión hecha</h2>
      <p class="cierre-semana">${h(c.semana)}</p>
      <dl class="cierre-datos">
        <div><dt>series</dt><dd class="cifra">${rodillo(c.series, { desde: 0 })}</dd></div>
        <div><dt>minutos</dt><dd class="cifra">${rodillo(c.minutos, { desde: 0 })}</dd></div>
        <div><dt>${tercero[0]}</dt><dd class="cifra">${rodillo(tercero[1], { desde: 0 })}</dd></div>
      </dl>
      <p class="cierre-marca">${h(c.marca)}</p>
      <button type="button" class="boton-principal" data-act="cerrar-cierre">Volver a Hoy</button>
    </div>
  </div>`;
}

// Tras pintar: reparto de la calle, dígitos en su sitio y la serie actual siempre por encima del descanso.
function despues(raiz, vista, d, s) {
  raiz.querySelectorAll('.tramo[data-g]').forEach(n => { n.style.flexGrow = n.dataset.g; });
  fijarDigitos(raiz);
  if (vista === 'sesion') {
    const fila = raiz.querySelector('[data-actual]') || raiz.querySelector('.todo');
    const tapa = raiz.querySelector('[data-descanso]:not([hidden])');
    if (fila && tapa) {
      const falta = fila.getBoundingClientRect().bottom - tapa.getBoundingClientRect().top + 12;
      if (falta > 0 && s.ultimoToque) window.scrollBy(0, falta); // tras marcar una serie, la siguiente nunca queda tapada
    }
  }
}

// El reloj del descanso: el número de cada dígito se desliza al cambiar (es lo único que se mueve en la serie).
function reloj(nodo, segundos) {
  const txt = mmss(segundos);
  const digitos = nodo.querySelectorAll('.rd');
  if (digitos.length !== txt.replace(/\D/g, '').length) { nodo.innerHTML = rodillo(txt); fijarDigitos(nodo); return; }
  nodo.querySelector('.solo-lector').textContent = txt;
  let i = 0;
  for (const c of txt) if (/\d/.test(c)) { digitos[i].style.setProperty('--d', c); i++; }
}

function alAbrirCierre(capa, { reducido }) {
  const rds = capa.querySelectorAll('.cierre-datos .rd');
  if (reducido) { rds.forEach(n => n.style.setProperty('--d', n.dataset.fin)); return; }
  rds.forEach(n => n.style.setProperty('--d', 0));
  requestAnimationFrame(() => requestAnimationFrame(() => rds.forEach(n => n.style.setProperty('--d', n.dataset.fin))));
}

iniciar({ nombre: 'Carril 2', salida: true, pantallas: { hoy, sesion, progreso, cierre, despues, reloj, alAbrirCierre } });
