// Gráficos del sistema (DIS 3, prototipos/sistema/graficos.js) para Progreso: SVG a mano, sin dependencias.
// Reglas (guía dataviz): una serie por gráfico en el color de la persona; un solo eje; texto en tinta (tokens de
// texto); marcas finas; burbuja al pasar el dedo, el ratón o el foco por cada punto; y «Ver como tabla» con los
// mismos datos. El gráfico entero es una sola parada de Tab: las flechas, Inicio y Fin recorren los puntos y el
// lector anuncia cada uno.

import { h, es, ICONOS } from '../../nucleo/ui.js';

const num = n => es(n, 1);
let uid = 0;

function tabla(etqs, vals, cab, unidad) {
  return `<details class="ver-tabla"><summary>Ver como tabla</summary><table class="tabla-datos"><thead><tr><th scope="col">${h(cab)}</th><th scope="col">${h(unidad)}</th></tr></thead>
    <tbody>${vals.map((v, i) => `<tr><td>${h(etqs[i])}</td><td>${v == null ? '—' : h(num(v))}</td></tr>`).join('')}</tbody></table></details>`;
}

// Puntos del gráfico: cada uno con sus datos en data-* para la burbuja.
function puntos(xs, ys, etiquetas, textos) {
  return `<g class="g-puntos">${xs.map((x, i) => `<circle class="g-foco" data-x="${x.toFixed(1)}" data-y="${ys[i].toFixed(1)}" data-t="${h(etiquetas[i])}" data-v="${h(textos[i])}" cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="7" hidden/>`).join('')}</g>`;
}
const atributosSvg = (id, titulo, etiquetas, textos, paso = 'los puntos') =>
  `tabindex="0" role="img" aria-label="${h(`${titulo}: de ${textos[0]} (${etiquetas[0]}) a ${textos[textos.length - 1]} (${etiquetas[etiquetas.length - 1]}). Flechas para recorrer ${paso}.`)}"`;
const cabecera = (id, titulo, cifra, cifraTexto) => `<p class="grafico-titulo" id="${id}">${h(titulo)}</p>
    ${cifra != null ? `<p class="grafico-cifra"><b>${h(cifra)}</b><span>${h(cifraTexto)}</span></p>` : ''}`;

// Línea con área suave y el último punto marcado. valores: números (≥ 2).
export function linea({ titulo, cifra = null, cifraTexto = '', unidad, valores, etiquetas, cab = 'Fecha', paso = 2.5, ancho = 320, recorrido = 'las fechas' }) {
  const W = ancho, H = ancho < 240 ? 110 : 140, iz = 34, de = 10, ar = 12, ab = 22;
  let min = Math.floor(Math.min(...valores) / paso) * paso - paso, max = Math.ceil(Math.max(...valores) / paso) * paso;
  if (max <= min) max = min + paso;
  const X = i => iz + i * ((W - iz - de) / Math.max(1, valores.length - 1));
  const Y = v => ar + (1 - (v - min) / (max - min)) * (H - ar - ab);
  const pts = valores.map((v, i) => [X(i), Y(v)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const marcas = [min, (min + max) / 2, max];
  const id = `g${++uid}`;
  const textos = valores.map(v => `${num(v)} ${unidad}`);
  const ult = pts[pts.length - 1];
  return `<div class="grafico" data-grafico>
    ${cabecera(id, titulo, cifra, cifraTexto)}
    <svg viewBox="0 0 ${W} ${H}" ${atributosSvg(id, titulo, etiquetas, textos, recorrido)}>
      ${marcas.map(m => `<line class="g-rejilla" x1="${iz}" x2="${W - de}" y1="${Y(m).toFixed(1)}" y2="${Y(m).toFixed(1)}"/><text class="g-eje" x="${iz - 6}" y="${(Y(m) + 4).toFixed(1)}" text-anchor="end">${h(num(m))}</text>`).join('')}
      <text class="g-eje" x="${X(0)}" y="${H - 4}" text-anchor="start">${h(etiquetas[0])}</text>
      <text class="g-eje" x="${X(valores.length - 1)}" y="${H - 4}" text-anchor="end">${h(etiquetas[etiquetas.length - 1])}</text>
      <path class="g-area" d="${d} L${X(valores.length - 1).toFixed(1)} ${Y(min).toFixed(1)} L${iz} ${Y(min).toFixed(1)} Z"/>
      <path class="g-linea" d="${d}"/>
      <circle class="g-punto" cx="${ult[0].toFixed(1)}" cy="${ult[1].toFixed(1)}" r="4"/>
      <line class="g-guia" x1="0" x2="0" y1="${ar}" y2="${H - ab}" hidden/>
      ${puntos(pts.map(p => p[0]), pts.map(p => p[1]), etiquetas, textos)}
    </svg>
    <p class="solo-lector" id="${id}-r" aria-live="polite"></p>
    <div class="burbuja" hidden></div>
    ${tabla(etiquetas, valores, cab, unidad)}
  </div>`;
}

// Barras; la última, en el color de la persona (lo de ahora). valores: números ≥ 0.
export function barras({ titulo, cifra = null, cifraTexto = '', unidad, valores, etiquetas, max = 10, cab = 'Mes', ancho = 320, recorrido = 'los meses' }) {
  const W = ancho, H = ancho > 200 ? 140 : 96, ab = 18, n = valores.length, hueco = 2;
  const tope = Math.max(max, ...valores, 1);
  const bw = (W - (n - 1) * hueco) / n;
  const Y = v => (H - ab) * (1 - v / tope);
  const id = `g${++uid}`;
  const textos = valores.map(v => `${num(v)} ${unidad}`);
  return `<div class="grafico" data-grafico>
    ${cabecera(id, titulo, cifra, cifraTexto)}
    <svg viewBox="0 0 ${W} ${H}" ${atributosSvg(id, titulo, etiquetas, textos, recorrido)}>
      <line class="g-rejilla" x1="0" x2="${W}" y1="${H - ab}" y2="${H - ab}"/>
      ${valores.map((v, i) => {
    const x = i * (bw + hueco), y = Y(v), alto = Math.max(2, H - ab - y), r = Math.min(3, bw / 2, alto / 2);
    return `<path class="g-barra${i === n - 1 ? ' g-barra--ultima' : ''}" d="M${x.toFixed(1)} ${(H - ab).toFixed(1)} V${(H - ab - alto + r).toFixed(1)} q0 -${r} ${r} -${r} h${(bw - 2 * r).toFixed(1)} q${r} 0 ${r} ${r} V${(H - ab).toFixed(1)} Z"/>`;
  }).join('')}
      <text class="g-eje" x="0" y="${H - 3}">${h(etiquetas[0])}</text>
      <text class="g-eje" x="${W}" y="${H - 3}" text-anchor="end">${h(etiquetas[etiquetas.length - 1])}</text>
      ${puntos(valores.map((_, i) => i * (bw + hueco) + bw / 2), valores.map(v => Y(v)), etiquetas, textos)}
    </svg>
    <p class="solo-lector" id="${id}-r" aria-live="polite"></p>
    <div class="burbuja" hidden></div>
    ${tabla(etiquetas, valores, cab, unidad)}
  </div>`;
}

// Vasos de las últimas semanas: cada uno se llena con lo hecho frente a lo previsto esa semana (el plan de la
// semana si lo hay; si no, los días por semana del perfil). Con ✓ si se cumplió.
export function vasos({ titulo, semanas }) {
  const completas = semanas.filter(s => s.n >= s.meta).length;
  return `<div class="grafico">
    <p class="grafico-titulo">${h(titulo)}</p>
    <p class="grafico-cifra"><b>${completas}</b><span>de ${semanas.length} semanas completas</span></p>
    <ol class="vasos">${semanas.map(s => {
    const lleno = s.n >= s.meta;
    return `<li><span class="vaso${lleno ? ' vaso--lleno' : ''}" role="img" aria-label="${h(`Semana del ${s.etiqueta}${s.actual ? ' (esta)' : ''}: ${s.n} de ${s.meta} sesiones${lleno ? ', completa' : ''}`)}"><i data-v="${Math.min(1, s.meta ? s.n / s.meta : 0).toFixed(3)}"></i>${lleno ? ICONOS.check : ''}</span><span class="cifra" aria-hidden="true">${h(s.etiqueta).replace(' ', '<br>')}</span></li>`;
  }).join('')}</ol>
    <details class="ver-tabla"><summary>Ver como tabla</summary><table class="tabla-datos"><thead><tr><th scope="col">Semana del</th><th scope="col">Hechas</th><th scope="col">Previstas</th></tr></thead>
    <tbody>${semanas.map(s => `<tr><td>${h(s.etiqueta)}${s.actual ? ' (esta)' : ''}</td><td>${+s.n}</td><td>${+s.meta}</td></tr>`).join('')}</tbody></table></details>
  </div>`;
}

// Burbuja: sigue al dedo, al ratón o a las flechas del teclado. Rellena los vasos.
export function activar(raiz) {
  raiz.querySelectorAll('.vaso i[data-v], .barra-cardio i[data-v]').forEach(n => n.style.setProperty('--v', n.dataset.v));
  raiz.querySelectorAll('[data-grafico]').forEach(g => {
    const svg = g.querySelector('svg'), burbuja = g.querySelector('.burbuja'), guia = g.querySelector('.g-guia');
    const vivo = g.querySelector('[aria-live]'), pts = [...g.querySelectorAll('.g-foco')];
    if (!svg || !pts.length) return;
    const vb = svg.viewBox && svg.viewBox.baseVal;
    let actual = -1;
    const mostrar = (i, anunciar) => {
      actual = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[actual];
      pts.forEach(x => { x.toggleAttribute('hidden', x !== p); });
      const k = vb && vb.width ? svg.getBoundingClientRect().width / vb.width : 1;
      burbuja.innerHTML = `<b>${h(p.dataset.v)}</b> <span>${h(p.dataset.t)}</span>`;
      burbuja.hidden = false;
      // Posición del punto dentro de .grafico (los SVG no tienen offsetLeft), sin salirse por los lados.
      const rs = svg.getBoundingClientRect(), rg = g.getBoundingClientRect();
      const x = rs.left - rg.left + Number(p.dataset.x) * k, y = rs.top - rg.top + Number(p.dataset.y) * k;
      const ancho = burbuja.offsetWidth || 0;
      burbuja.style.left = `${Math.round(Math.max(0, Math.min(rg.width - ancho, x - ancho / 2)))}px`;
      burbuja.style.top = `${Math.round(y)}px`;
      burbuja.style.transform = 'translateY(calc(-100% - 10px))';
      if (guia) { guia.removeAttribute('hidden'); guia.setAttribute('x1', p.dataset.x); guia.setAttribute('x2', p.dataset.x); }
      if (anunciar) vivo.textContent = `${p.dataset.t}: ${p.dataset.v}`;
    };
    const ocultar = () => { burbuja.hidden = true; pts.forEach(x => x.setAttribute('hidden', '')); if (guia) guia.setAttribute('hidden', ''); actual = -1; };
    const cercano = e => {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / (r.width / (vb ? vb.width : r.width));
      return pts.reduce((m, p, i) => (Math.abs(p.dataset.x - x) < Math.abs(pts[m].dataset.x - x) ? i : m), 0);
    };
    svg.addEventListener('pointermove', e => mostrar(cercano(e), false));
    svg.addEventListener('pointerdown', e => mostrar(cercano(e), false));
    svg.addEventListener('pointerleave', ocultar);
    svg.addEventListener('blur', ocultar);
    svg.addEventListener('keydown', e => {
      const n = { ArrowRight: actual + 1, ArrowLeft: actual < 0 ? pts.length - 1 : actual - 1, Home: 0, End: pts.length - 1 }[e.key];
      if (n == null) return;
      e.preventDefault(); mostrar(n, true);
    });
  });
}
