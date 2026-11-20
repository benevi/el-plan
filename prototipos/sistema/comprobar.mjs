// Comprueba el sistema de diseño sobre la página catálogo renderizada (Chromium, Playwright) y escribe contraste.json.
//   1. Reglas de código: sin hex fuera de tokens.css, sin <script> en línea, sin on…=, sin style=, sin import() dinámico, sin URLs externas.
//   2. Contraste de cada muestra, para Víctor y para Virginia: texto ≥ 4,5:1 (≥ 3:1 si ≥ 24 px), alarma ≥ 7:1,
//      bordes y rellenos de controles, iconos, marcas de gráfico y anillos de foco ≥ 3:1. Los desactivados se miden pero no suspenden.
//   3. Teclado: se recorre la página con Tab; cada parada tiene nombre accesible, foco visible y tamaño táctil.
//   4. Capturas del catálogo en prototipos/sistema/capturas/.
// Uso: node prototipos/sistema/comprobar.mjs [--escribir]  (--escribir vuelca las tablas en docs/diseno/sistema.md)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar, lanzarChromium } from '../identidad/herramientas/servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(AQUI, '../../docs/diseno/sistema.md');
const fallos = [];

// ---------- 1. Reglas de código ----------
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
for (const f of ['componentes.css', 'catalogo.css']) {
  const css = sinComentarios(await readFile(path.join(AQUI, f), 'utf8'));
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgb = css.match(/rgba?\(/g) || [];
  if (hex.length || rgb.length) fallos.push(`${f}: valores de color en bruto (${[...hex, ...rgb].join(', ')}); usa tokens`);
}
const html = await readFile(path.join(AQUI, 'index.html'), 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fallos.push('index.html: <script> en línea');
if (/\son[a-z]+\s*=/i.test(html)) fallos.push('index.html: manejadores on…= en línea');
if (/\sstyle\s*=/i.test(html)) fallos.push('index.html: atributo style en línea');
if (/(src|href)\s*=\s*"https?:/i.test(html)) fallos.push('index.html: recurso externo');
for (const f of ['catalogo.js', 'graficos.js']) {
  const js = await readFile(path.join(AQUI, f), 'utf8');
  if (/\bimport\s*\(/.test(js)) fallos.push(`${f}: import() dinámico`);
  if (/https?:\/\//.test(js)) fallos.push(`${f}: URL externa`);
}

// ---------- 2-4. En el navegador ----------
const { srv, url } = await arrancar();
const nav = await lanzarChromium();
const salida = { fecha: new Date().toISOString().slice(0, 10), personas: {}, teclado: null, reglas: [] };

function medirEnPagina() {
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
  for (const fig of document.querySelectorAll('[data-medir]')) {
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
    res[fig.dataset.medir] = { minimo, ok: pares.every(p => p.ok), pares: pares.length, detalle: pares };
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

for (const persona of ['victor', 'virginia']) {
  const ctx = await nav.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('contraste.json')) errores.push(`${r.status()} ${r.url()}`); });
  pag.on('request', r => { if (!r.url().startsWith(url)) errores.push('Petición externa: ' + r.url()); });
  await pag.goto(`${url}/prototipos/sistema/`);
  await pag.evaluate(p => { document.documentElement.dataset.persona = p; }, persona);
  await pag.evaluate(() => document.fonts.ready);
  await pag.waitForTimeout(300);
  const m = await pag.evaluate(medirEnPagina);
  salida.personas[persona] = m;
  for (const [id, r] of Object.entries(m.muestras)) if (!r.ok) fallos.push(`${persona} · ${id}: ${r.detalle.filter(p => !p.ok).map(p => `${p.tipo} «${p.que}» ${p.fg}/${p.bg} ${p.r}:1 < ${p.min}`).join('; ')}`);
  if (errores.length) fallos.push(`${persona}: ${errores.join(' | ')}`);
  await ctx.close();
}

// Teclado: recorrido con Tab en un móvil (390 px)
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: false });
  const pag = await ctx.newPage();
  await pag.goto(`${url}/prototipos/sistema/`);
  await pag.evaluate(() => document.fonts.ready);
  const vistos = new Set(); const paradas = [];
  for (let i = 0; i < 260; i++) {
    await pag.keyboard.press('Tab');
    const p = await pag.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      window.__vk = window.__vk || 0; if (!el.dataset.vk) el.dataset.vk = String(++window.__vk);
      const id = el.dataset.vk;
      const cs = getComputedStyle(el);
      const etiqueta = (() => {
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
        const lb = el.getAttribute('aria-labelledby'); if (lb) return lb.split(' ').map(x => document.getElementById(x)?.textContent || '').join(' ');
        return el.textContent;
      })().trim();
      let foco = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
      const r = el.getBoundingClientRect();
      const enTexto = el.tagName === 'A' && el.closest('p');
      const minimo = enTexto ? 0 : el.closest('.descanso, .serie, .contador, .selector') ? 48 : 44;
      return { id, etiqueta: etiqueta.slice(0, 50), foco, w: Math.round(r.width), h: Math.round(r.height), minimo, rol: el.getAttribute('role') || el.tagName.toLowerCase() };
    });
    if (!p) continue;
    if (vistos.has(p.id)) break;
    vistos.add(p.id); paradas.push(p);
  }
  const mal = paradas.filter(p => !p.etiqueta || !p.foco || p.w < p.minimo - 0.5 || p.h < p.minimo - 0.5);
  salida.teclado = { paradas: paradas.length, mal };
  for (const p of mal) fallos.push(`teclado: ${p.rol} «${p.etiqueta}» ${!p.etiqueta ? 'sin nombre' : ''}${!p.foco ? ' sin foco visible' : ''}${p.w < p.minimo || p.h < p.minimo ? ` ${p.w}×${p.h} < ${p.minimo}` : ''}`);
  // La hoja: abre, foco al título, Escape cierra y el foco vuelve
  await pag.click('[data-act="abrir-hoja"]');
  await pag.waitForTimeout(400);
  const alAbrir = await pag.evaluate(() => ({ foco: document.activeElement.id, inert: document.querySelector('main').inert, dialogo: !!document.querySelector('[role="dialog"][aria-modal="true"][aria-labelledby]') }));
  await pag.keyboard.press('Escape'); await pag.waitForTimeout(400);
  const alCerrar = await pag.evaluate(() => ({ abierta: !!document.querySelector('#capa-hoja .hoja'), foco: document.activeElement.dataset.act }));
  salida.teclado.hoja = { alAbrir, alCerrar };
  if (alAbrir.foco !== 'hoja-t' || !alAbrir.inert || !alAbrir.dialogo || alCerrar.abierta || alCerrar.foco !== 'abrir-hoja') fallos.push(`hoja inferior: ${JSON.stringify(salida.teclado.hoja)}`);
  await ctx.close();
}

// Capturas
await mkdir(path.join(AQUI, 'capturas'), { recursive: true });
for (const [persona, ancho, nombre] of [['victor', 390, 'catalogo-movil-victor'], ['virginia', 390, 'catalogo-movil-virginia'], ['victor', 1100, 'catalogo-escritorio-victor']]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: ancho < 500 ? 2 : 1, reducedMotion: 'reduce' });
  const pag = await ctx.newPage();
  await pag.goto(`${url}/prototipos/sistema/`);
  await pag.evaluate(p => { document.documentElement.dataset.persona = p; document.querySelector(`[data-persona="${p}"]`).click(); }, persona);
  await pag.evaluate(() => document.fonts.ready); await pag.waitForTimeout(400);
  await pag.screenshot({ path: path.join(AQUI, 'capturas', `${nombre}.png`), fullPage: true, scale: 'css' });
  if (ancho < 500 && persona === 'victor') {
    await pag.evaluate(() => { document.querySelector('.cat-cab').style.position = 'static'; });
    for (const sec of ['c-boton', 'c-selector', 'c-serie', 'c-descanso', 'c-contador', 'c-graficos']) {
      const el = await pag.$(`#${sec}`);
      await el.screenshot({ path: path.join(AQUI, 'capturas', `seccion-${sec.slice(2)}.png`) });
    }
    await pag.click('[data-act="abrir-hoja"]'); await pag.waitForTimeout(400);
    await pag.screenshot({ path: path.join(AQUI, 'capturas', 'hoja-abierta.png') });
  }
  await ctx.close();
}
await nav.close(); srv.close();

salida.reglas = fallos;
await writeFile(path.join(AQUI, 'contraste.json'), JSON.stringify(salida, null, 1));

// Resumen y tabla para sistema.md
const fmt = n => n.toFixed(2).replace('.', ',');
let md = `<!-- comprobacion:inicio -->\n_Generado con \`node prototipos/sistema/comprobar.mjs --escribir\` el ${salida.fecha}. No editar a mano._\n\n`;
md += `| Muestra | Víctor: mínimo | Virginia: mínimo | Pares | Cumple |\n|---|---|---|---|---|\n`;
for (const id of Object.keys(salida.personas.victor.muestras)) {
  const v = salida.personas.victor.muestras[id], g = salida.personas.virginia.muestras[id];
  md += `| ${id} | ${fmt(v.minimo)}:1 | ${fmt(g.minimo)}:1 | ${v.pares} | ${v.ok && g.ok ? 'Sí' : '**NO**'} |\n`;
}
const rv = salida.personas.victor.resumen, rg = salida.personas.virginia.resumen;
md += `\n**Total:** Víctor ${rv.cumplen} de ${rv.pares} pares; Virginia ${rg.cumplen} de ${rg.pares} pares. Teclado: ${salida.teclado.paradas} paradas con Tab, ${salida.teclado.mal.length} sin nombre, sin foco visible o pequeñas. Hoja inferior: foco al título al abrir, fondo inerte, Escape cierra y devuelve el foco: ${fallos.some(f => f.startsWith('hoja')) ? '**NO**' : 'sí'}. Reglas de código: ${fallos.filter(f => /index\.html|\.css|\.js:/.test(f)).length ? '**con fallos**' : 'sin fallos'}.\n<!-- comprobacion:fin -->`;
console.log(md.replace(/<!--.*?-->/g, ''));
if (process.argv.includes('--escribir')) {
  const doc = await readFile(DOC, 'utf8');
  await writeFile(DOC, doc.replace(/<!-- comprobacion:inicio -->[\s\S]*<!-- comprobacion:fin -->/, md));
  console.log('Tabla escrita en docs/diseno/sistema.md');
}
console.log(fallos.length ? `\n${fallos.length} fallos:\n- ${fallos.join('\n- ')}` : '\nTodo cumple.');
process.exitCode = fallos.length ? 1 : 0;
