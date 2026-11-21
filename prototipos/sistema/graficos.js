// Gráficos del sistema (constancia, fuerza, medidas y dolor). SVG a mano, sin dependencias.
// Reglas (guía dataviz): una serie por gráfico en el color de la persona; un solo eje; texto en tinta (tokens de texto);
// marcas finas; burbuja al pasar el dedo, el ratón o el foco por cada punto; y la tabla con los mismos datos.
const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
export const num = n => fmt.format(n);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uid = 0;

function tabla(etqs, vals, cab, unidad) {
  return `<details class="ver-tabla"><summary>Ver como tabla</summary><table class="tabla-datos"><thead><tr><th scope="col">${esc(cab)}</th><th scope="col">${esc(unidad)}</th></tr></thead>
    <tbody>${vals.map((v, i) => `<tr><td>${esc(etqs[i])}</td><td>${v == null ? '—' : num(v)}</td></tr>`).join('')}</tbody></table></details>`;
}

// Puntos del gráfico: el SVG entero es una sola parada de teclado (flechas, Inicio y Fin recorren los puntos) y, con el
// dedo o el ratón, se elige el punto más cercano en horizontal. Cada punto lleva sus datos en data-* para la burbuja.
function puntos(xs, ys, etiquetas, textos) {
  return `<g class="g-puntos">${xs.map((x, i) => `<circle class="g-foco" data-x="${x.toFixed(1)}" data-y="${ys[i].toFixed(1)}" data-t="${esc(etiquetas[i])}" data-v="${esc(textos[i])}" cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="7" hidden/>`).join('')}</g>`;
}
const atributosSvg = (id, titulo, etiquetas, textos) =>
  `tabindex="0" role="img" aria-labelledby="${id}" aria-describedby="${id}-r" data-resumen="${esc(`${titulo}: de ${textos[0]} (${etiquetas[0]}) a ${textos.at(-1)} (${etiquetas.at(-1)}). Flechas para recorrer las semanas.`)}"`;

export function linea({ titulo, cifra, cifraTexto, unidad, valores, etiquetas, cab = 'Semana', paso = 2.5, ancho = 320 }) {
  // El ancho del viewBox se ajusta al ancho real para que el texto del eje no encoja (12 px de verdad).
  const W = ancho, H = ancho < 240 ? 110 : 140, iz = 30, de = 10, ar = 12, ab = 22;
  const min = Math.floor(Math.min(...valores) / paso) * paso - paso, max = Math.ceil(Math.max(...valores) / paso) * paso;
  const X = i => iz + i * ((W - iz - de) / (valores.length - 1));
  const Y = v => ar + (1 - (v - min) / (max - min)) * (H - ar - ab);
  const pts = valores.map((v, i) => [X(i), Y(v)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const marcas = [min, (min + max) / 2, max];
  const id = `g${++uid}`;
  return `<div class="grafico" data-grafico>
    <p class="grafico-titulo" id="${id}">${esc(titulo)}</p>
    ${cifra != null ? `<p class="grafico-cifra"><b>${esc(cifra)}</b><span>${esc(cifraTexto)}</span></p>` : ''}
    <svg viewBox="0 0 ${W} ${H}" ${atributosSvg(id, titulo, etiquetas, valores.map(v => `${num(v)} ${unidad}`))}>
      ${marcas.map(m => `<line class="g-rejilla" x1="${iz}" x2="${W - de}" y1="${Y(m).toFixed(1)}" y2="${Y(m).toFixed(1)}"/><text class="g-eje" x="${iz - 6}" y="${(Y(m) + 4).toFixed(1)}" text-anchor="end">${num(m)}</text>`).join('')}
      <text class="g-eje" x="${X(0)}" y="${H - 4}" text-anchor="start">${esc(etiquetas[0])}</text>
      <text class="g-eje" x="${X(valores.length - 1)}" y="${H - 4}" text-anchor="end">${esc(etiquetas.at(-1))}</text>
      <path class="g-area" d="${d} L${X(valores.length - 1).toFixed(1)} ${Y(min).toFixed(1)} L${iz} ${Y(min).toFixed(1)} Z"/>
      <path class="g-linea" d="${d}"/>
      <circle class="g-punto" cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="4"/>
      <line class="g-guia" x1="0" x2="0" y1="${ar}" y2="${H - ab}" hidden/>
      ${puntos(pts.map(p => p[0]), pts.map(p => p[1]), etiquetas, valores.map(v => `${num(v)} ${unidad}`))}
    </svg>
    <p class="solo-lector" id="${id}-r" aria-live="polite"></p>
    <div class="burbuja" hidden></div>
    ${tabla(etiquetas, valores, cab, unidad)}
  </div>`;
}

export function barras({ titulo, cifra, cifraTexto, unidad, valores, etiquetas, max = 10, cab = 'Semana', ancho = 150 }) {
  // Como en linea(): el viewBox sigue al ancho real para que el texto del eje mida 12 px de verdad.
  const W = ancho, H = ancho > 200 ? 140 : 96, ab = 18, n = valores.length, hueco = 2;
  const bw = (W - (n - 1) * hueco) / n;
  const Y = v => (H - ab) * (1 - v / max);
  const id = `g${++uid}`;
  return `<div class="grafico" data-grafico>
    <p class="grafico-titulo" id="${id}">${esc(titulo)}</p>
    ${cifra != null ? `<p class="grafico-cifra"><b>${esc(cifra)}</b><span>${esc(cifraTexto)}</span></p>` : ''}
    <svg viewBox="0 0 ${W} ${H}" ${atributosSvg(id, titulo, etiquetas, valores.map(v => `${num(v)} ${unidad}`))}>
      <line class="g-rejilla" x1="0" x2="${W}" y1="${H - ab}" y2="${H - ab}"/>
      ${valores.map((v, i) => { const x = i * (bw + hueco); const y = Y(v); const h = Math.max(2, H - ab - y);
        return `<path class="g-barra${i === n - 1 ? ' g-barra--ultima' : ''}" d="M${x.toFixed(1)} ${(H - ab).toFixed(1)} V${(H - ab - h + 3).toFixed(1)} q0 -3 3 -3 h${(bw - 6).toFixed(1)} q3 0 3 3 V${(H - ab).toFixed(1)} Z"/>`; }).join('')}
      <text class="g-eje" x="0" y="${H - 3}">${esc(etiquetas[0])}</text>
      <text class="g-eje" x="${W}" y="${H - 3}" text-anchor="end">${esc(etiquetas.at(-1))}</text>
      ${puntos(valores.map((_, i) => i * (bw + hueco) + bw / 2), valores.map(v => Y(v)), etiquetas, valores.map(v => `${num(v)} ${unidad}`))}
    </svg>
    <p class="solo-lector" id="${id}-r" aria-live="polite"></p>
    <div class="burbuja" hidden></div>
    ${tabla(etiquetas, valores, cab, unidad)}
  </div>`;
}

export function vasos({ titulo, semanas, etiquetas }) {
  const completas = semanas.filter(([a, b]) => a >= b).length;
  return `<div class="grafico">
    <p class="grafico-titulo">${esc(titulo)}</p>
    <p class="grafico-cifra"><b>${completas}</b><span>de ${semanas.length} semanas completas</span></p>
    <ol class="vasos">${semanas.map(([a, b], i) => `<li><span class="vaso${a >= b ? ' vaso--lleno' : ''}" role="img" aria-label="Semana del ${esc(etiquetas[i])}: ${a} de ${b} sesiones${a >= b ? ', completa' : ''}"><i data-v="${(a / b).toFixed(3)}"></i>${a >= b ? '<svg class="icono" aria-hidden="true"><use href="#i-check"/></svg>' : ''}</span><span class="cifra">${esc(etiquetas[i]).replace(' ', '<br>')}</span></li>`).join('')}</ol>
    ${tabla(etiquetas, semanas.map(([a]) => a), 'Semana', 'Sesiones hechas')}
  </div>`;
}

export function vacio({ titulo, cabecera, texto, accion }) {
  return `<div class="grafico"><p class="grafico-titulo">${esc(titulo)}</p><div class="vacio"><h4>${esc(cabecera)}</h4><p>${esc(texto)}</p><button type="button" class="boton boton--secundario">${esc(accion)}</button></div></div>`;
}

export function cargando({ titulo }) {
  return `<div class="grafico" aria-busy="true"><p class="grafico-titulo">${esc(titulo)}</p><span class="esqueleto sk-cifra"></span><span class="esqueleto sk-grafico"></span></div>`;
}

// Burbuja: sigue al dedo, al ratón o a las flechas del teclado.
export function activar(raiz) {
  raiz.querySelectorAll('[data-v]').forEach(n => { if (n.tagName === 'I') n.style.setProperty('--v', n.dataset.v); });
  raiz.querySelectorAll('[data-grafico]').forEach(g => {
    const svg = g.querySelector('svg'); const burbuja = g.querySelector('.burbuja'); const guia = g.querySelector('.g-guia');
    const vivo = g.querySelector('[aria-live]'); const pts = [...g.querySelectorAll('.g-foco')];
    const vb = svg.viewBox.baseVal; let actual = -1;
    svg.setAttribute('aria-label', svg.dataset.resumen);
    const mostrar = (i, anunciar) => {
      actual = Math.max(0, Math.min(pts.length - 1, i)); const p = pts[actual];
      pts.forEach(x => { x.hidden = x !== p; });
      const k = svg.getBoundingClientRect().width / vb.width;
      burbuja.innerHTML = `<b>${esc(p.dataset.v)}</b> <span>${esc(p.dataset.t)}</span>`;
      burbuja.hidden = false;
      burbuja.style.left = `${svg.offsetLeft + Number(p.dataset.x) * k}px`;
      burbuja.style.top = `${svg.offsetTop + Number(p.dataset.y) * k}px`;
      if (guia) { guia.hidden = false; guia.setAttribute('x1', p.dataset.x); guia.setAttribute('x2', p.dataset.x); }
      if (anunciar) vivo.textContent = `${p.dataset.t}: ${p.dataset.v}`;
    };
    const ocultar = () => { burbuja.hidden = true; pts.forEach(x => { x.hidden = true; }); if (guia) guia.hidden = true; actual = -1; };
    const cercano = e => {
      const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / (r.width / vb.width);
      return pts.reduce((m, p, i) => (Math.abs(p.dataset.x - x) < Math.abs(pts[m].dataset.x - x) ? i : m), 0);
    };
    svg.addEventListener('pointermove', e => mostrar(cercano(e), false));
    svg.addEventListener('pointerdown', e => mostrar(cercano(e), false));
    svg.addEventListener('pointerleave', ocultar);
    svg.addEventListener('blur', ocultar);
    svg.addEventListener('keydown', e => {
      const n = { ArrowRight: actual + 1, ArrowLeft: actual < 0 ? pts.length - 1 : actual - 1, Home: 0, End: pts.length - 1 }[e.key];
      if (n == null) return; e.preventDefault(); mostrar(n, true);
    });
  });
}
