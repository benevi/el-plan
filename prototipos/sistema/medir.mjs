// Medida de contraste sobre la página renderizada (se ejecuta dentro del navegador con page.evaluate).
// La usan prototipos/sistema/comprobar.mjs y prototipos/app/comprobar.mjs. Debe ser autosuficiente: nada de fuera de la función.
export function medirEnPagina(selector = '[data-medir]') {
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const mezcla = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const L = c => 0.2126 * lin(c.r / 255) + 0.7152 * lin(c.g / 255) + 0.0722 * lin(c.b / 255);
  const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const fondoDe = el => { // color de fondo efectivo (componiendo transparencias hacia arriba)
    const capas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; }
    }
    let base = parse(getComputedStyle(document.body).backgroundColor);
    for (const c of capas.reverse()) base = mezcla(c, base);
    return base;
  };
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.solo-lector,[hidden]'); };
  const borde = cs => { const m = cs.boxShadow.match(/rgba?\([^)]+\)[^,]*inset/); return m ? parse(m[0]) : (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' ? parse(cs.borderTopColor) : null); };
  const res = {};
  for (const [n, fig] of [...document.querySelectorAll(selector)].entries()) {
    const minTexto = Number(fig.dataset.minimo || 4.5);
    const pares = [];
    const anota = (tipo, el, fg, bg, min) => {
      const exento = !!el.closest('[aria-disabled="true"]');
      const r = ratio(fg, bg); pares.push({ tipo, fg: hex(fg), bg: hex(bg), r: Math.round(r * 100) / 100, min, ok: r >= min || exento, exento, que: (el.getAttribute('aria-label') || el.textContent || el.className.baseVal || el.className || el.tagName).toString().trim().slice(0, 40) });
    };
    for (const el of fig.querySelectorAll('*')) {
      if (el.closest('figcaption') || !visible(el)) continue;
      const cs = getComputedStyle(el);
      const bg = fondoDe(el.parentElement || el);
      // Texto propio
      const propio = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (propio) {
        const fg = parse(el.tagName.toLowerCase() === 'text' ? cs.fill : cs.color);
        const fs = parseFloat(cs.fontSize); const grande = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700);
        if (fg) anota('texto', el, mezcla(fg, fondoDe(el)), fondoDe(el), Math.max(grande ? 3 : 4.5, minTexto === 4.5 ? 0 : minTexto));
      }
      // Controles: relleno distinto del de su padre, o borde
      if (el.matches('button:not([role="radio"]), [role="radio"][aria-checked="true"], .selector-pasos, .vaso, .dia-c, .chip, .boton-icono')) {
        // El límite del control es su relleno o su borde: cuenta el que más contraste dé con lo que hay detrás.
        const propioBg = parse(cs.backgroundColor); const b = borde(cs);
        const opciones = [];
        if (propioBg && propioBg.a > 0 && hex(mezcla(propioBg, bg)) !== hex(bg)) opciones.push(['control (relleno)', mezcla(propioBg, bg)]);
        if (b && b.a > 0) opciones.push(['control (borde)', mezcla(b, bg)]);
        if (opciones.length) { const [t, c] = opciones.sort((x, y) => ratio(y[1], bg) - ratio(x[1], bg))[0]; anota(t, el, c, bg, 3); }
      }
      // Iconos con significado y marcas de gráfico
      if (el.matches('svg.icono')) anota('icono', el, parse(cs.color), el.closest('.vaso') ? fondoDe(el.closest('.vaso').querySelector('i')) : fondoDe(el), 3);
      if (el.matches('.g-linea')) anota('marca de gráfico', el, parse(cs.stroke), fondoDe(el.closest('.grafico')), 3);
      if (el.matches('.g-barra--ultima, .g-barra')) anota('marca de gráfico', el, parse(cs.fill), fondoDe(el.closest('.grafico')), 3);
      if (el.matches('.descanso-nivel, .vaso i')) anota('indicador', el, parse(cs.backgroundColor), fondoDe(el.parentElement), 3);
      // Anillo de foco
      if (el.matches('.es-foco') && cs.outlineStyle !== 'none') anota('foco', el, parse(cs.outlineColor), bg, 3);
    }
    const validos = pares.filter(p => !p.exento);
    const minimo = validos.length ? Math.min(...validos.map(p => p.r)) : 0;
    res[fig.dataset.medir || fig.id || `zona-${n}`] = { minimo, ok: pares.every(p => p.ok), pares: pares.length, detalle: pares };
  }
  // Tokens: contraste de cada color con el fondo
  const tokens = {};
  const prueba = document.createElement('i'); document.body.append(prueba);
  for (const n of document.querySelectorAll('[data-token]')) {
    prueba.style.color = `var(${n.dataset.token})`;
    const c = parse(getComputedStyle(prueba).color);
    const fondo = parse(getComputedStyle(document.body).backgroundColor);
    tokens[n.dataset.token] = Math.round(ratio(mezcla(c, fondo), fondo) * 100) / 100;
  }
  prueba.remove();
  const todos = Object.values(res).flatMap(r => r.detalle);
  return { muestras: res, tokens, resumen: { pares: todos.length, cumplen: todos.filter(p => p.ok).length } };
}
