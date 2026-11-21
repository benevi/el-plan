// Comprueba los prototipos (DIS 4) con Chromium y saca las capturas. Para cada pantalla y estado de estados.js,
// con Víctor y con Virginia:
//   · contraste AA de todo lo que se ve (texto 4,5:1, 3:1 desde 24 px; controles, iconos y foco 3:1; alarma 7:1),
//   · zonas táctiles (48 px en sesión, descanso, contador y cierre; 44 px en el resto),
//   · cifras de la sesión ≥ 28 px, sin desplazamiento horizontal en 320 px, sin errores ni peticiones externas;
// y además: primera serie visible en 360 × 640 (R03), acción principal en el tercio inferior (R07) y la tira de la
// semana de Hoy sin tapar por el botón. Capturas a 390 × 844 (escala 2) en prototipos/app/capturas/.
// Uso: node prototipos/app/comprobar.mjs [--sin-capturas] [--escribir]
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar, lanzarChromium } from '../identidad/herramientas/servidor.mjs';
import { medirEnPagina } from '../sistema/medir.mjs';
import { MAPA } from './estados.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(AQUI, '../../docs/diseno/prototipos.md');
const capturas = !process.argv.includes('--sin-capturas');
await mkdir(path.join(AQUI, 'capturas'), { recursive: true });
const { srv, url } = await arrancar();
const nav = await lanzarChromium();
const fallos = []; const filas = [];
const ruta = (p, e, r) => `${url}/prototipos/app/?captura&p=${p}&${e.startsWith('g:') ? `g=${e.slice(2)}` : `e=${e}`}#${r}`;
const nombreArchivo = (p, grupo, n) => `${grupo}-${n}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '') + `-${p}.png`;

async function abrir(ctx, dir) {
  const pag = await ctx.newPage(); const errores = [];
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  pag.on('request', r => { if (!r.url().startsWith(url)) errores.push('Petición externa: ' + r.url()); });
  await pag.goto(dir); await pag.evaluate(() => document.fonts.ready); await pag.waitForTimeout(250);
  return { pag, errores };
}

const revisar = () => {
  const enSesion = !!document.querySelector('.cab-sesion, .contador, .descanso, .final') && location.hash !== '#checkin';
  const res = { pequenos: [], cifras: [], sinNombre: [], desborde: document.documentElement.scrollWidth - innerWidth };
  const capa = document.querySelector('#capa').firstElementChild;
  const zona = capa ? [capa, ...document.querySelectorAll('#descanso-host > *')] : [document.querySelector('#app'), ...document.querySelectorAll('#pestanas:not([hidden]), #descanso-host > *')];
  for (const raiz of zona) for (const el of raiz.querySelectorAll('button, a[href], summary, [role="spinbutton"], input, textarea')) {
    const b = el.getBoundingClientRect(); if (!b.width || el.closest('[hidden], .solo-lector')) continue;
    if (el.tagName === 'A' && el.closest('p') && !el.classList.contains('boton')) continue; // enlace dentro de un texto
    const min = enSesion || el.closest('.descanso, .contador, .final, .serie, .selector') ? 48 : 44;
    const nombre = (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map(i => document.getElementById(i)?.textContent || '').join(' ') || el.textContent || (el.labels && el.labels[0]?.textContent) || '').trim();
    if (!nombre) res.sinNombre.push(el.outerHTML.slice(0, 60));
    if (el.matches('[role="spinbutton"]')) continue; // el valor no es un objetivo táctil (los ± sí)
    if (b.width < min - 0.5 || b.height < min - 0.5) res.pequenos.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24)} ${Math.round(b.width)}×${Math.round(b.height)}`);
  }
  if (enSesion) for (const el of document.querySelectorAll('[data-cifra], [data-reloj], .contador-reloj, .descanso-reloj')) {
    if (!el.getBoundingClientRect().width) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 28) res.cifras.push(`${el.textContent} ${fs}px`);
  }
  return res;
};

for (const p of ['victor', 'virginia']) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  for (const [grupo, lista] of MAPA) for (const [nombre, e, r] of lista) {
    const { pag, errores } = await abrir(ctx, ruta(p, e, r));
    const selector = await pag.evaluate(() => (document.querySelector('#capa').firstElementChild ? '#capa > *, #descanso-host > *' : '#app, #pestanas:not([hidden]), #descanso-host > *'));
    const m = await pag.evaluate(medirEnPagina, selector);
    const malos = Object.values(m.muestras).flatMap(x => x.detalle.filter(d => !d.ok));
    const minimo = Math.min(...Object.values(m.muestras).map(x => x.minimo).filter(Boolean));
    const r2 = await pag.evaluate(revisar);
    const archivo = nombreArchivo(p, grupo, nombre);
    if (capturas) await pag.screenshot({ path: path.join(AQUI, 'capturas', archivo) });
    filas.push({ p, grupo, nombre, archivo, pares: m.resumen.pares, cumplen: m.resumen.cumplen, minimo, pequenos: r2.pequenos.length, cifras: r2.cifras.length });
    const id = `${p} · ${grupo} · ${nombre}`;
    if (malos.length) fallos.push(`${id}: contraste ${malos.slice(0, 3).map(d => `${d.tipo} «${d.que}» ${d.fg}/${d.bg} ${d.r}:1`).join('; ')}`);
    if (r2.pequenos.length) fallos.push(`${id}: táctil ${r2.pequenos.slice(0, 4).join('; ')}`);
    if (r2.cifras.length) fallos.push(`${id}: cifras ${r2.cifras.join('; ')}`);
    if (r2.sinNombre.length) fallos.push(`${id}: sin nombre accesible ${r2.sinNombre.slice(0, 3).join(' · ')}`);
    if (errores.length) fallos.push(`${id}: ${errores.join(' | ')}`);
    await pag.close();
  }
  await ctx.close();
}

// Medidas de DIS 1 en móviles pequeños
const medidas = [];
for (const [w, hgt] of [[360, 640], [320, 568]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: hgt }, reducedMotion: 'reduce' });
  for (const p of ['victor', 'virginia']) {
    for (const [e, r] of [['sesion', 'sesion'], ['descanso-s', 'sesion'], ['plan', 'hoy'], ['plan', 'checkin'], ['año', 'progreso'], ['g:objetivos', 'perfil'], ['plan', 'ejercicios']]) {
      const { pag, errores } = await abrir(ctx, ruta(p, e, r));
      // En «uno a uno» la sesión empieza por el calentamiento: R03 se mide al pasar al primer ejercicio.
      if (e === 'sesion') { await pag.click('.pasos-sesion button:nth-child(2)'); await pag.evaluate(() => window.scrollTo(0, 0)); await pag.waitForTimeout(100); }
      const x = await pag.evaluate(() => {
        const out = { desborde: document.documentElement.scrollWidth - innerWidth };
        const fila = document.querySelector('[data-actual]'); const tapa = document.querySelector('#descanso-host .descanso');
        if (fila) out.r03 = Math.round((tapa ? tapa.getBoundingClientRect().top : innerHeight) - fila.getBoundingClientRect().bottom);
        const pri = document.querySelector('[data-principal]');
        if (pri) { const b = pri.getBoundingClientRect(); out.r07 = Math.round((b.top + b.bottom) / 2 / innerHeight * 100); }
        const semana = document.querySelector('#app .semana'); const accion = document.querySelector('.accion');
        if (semana && accion) out.semanaLibre = Math.round(accion.getBoundingClientRect().top - semana.getBoundingClientRect().bottom);
        return out;
      });
      medidas.push({ w, hgt, p, e, r, ...x });
      const id = `${w}×${hgt} ${p} ${e}#${r}`;
      if (x.desborde > 0) fallos.push(`${id}: desborde ${x.desborde}px`);
      if (x.r03 != null && x.r03 < 0 && w === 360) fallos.push(`${id}: la serie actual queda ${-x.r03}px tapada o fuera (R03)`);
      if (x.r07 != null && x.r07 < 67) fallos.push(`${id}: acción principal al ${x.r07} % (R07)`);
      if (x.semanaLibre != null && x.semanaLibre < 0) fallos.push(`${id}: el botón tapa la tira de la semana`);
      if (errores.length) fallos.push(`${id}: ${errores.join(' | ')}`);
      await pag.close();
    }
  }
  await ctx.close();
}
await nav.close(); srv.close();

// Resumen
const tot = filas.reduce((a, f) => ({ pares: a.pares + f.pares, cumplen: a.cumplen + f.cumplen }), { pares: 0, cumplen: 0 });
const fmt = n => (Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '—');
let md = `<!-- comprobacion:inicio -->\n_Generado con \`node prototipos/app/comprobar.mjs --escribir\`. No editar a mano._\n\n`;
md += `**${filas.length} pantallas y estados medidos** (Víctor y Virginia, 390 × 844): ${tot.cumplen} de ${tot.pares} pares de contraste cumplen AA; ${filas.reduce((a, f) => a + f.pequenos, 0)} zonas táctiles pequeñas; ${filas.reduce((a, f) => a + f.cifras, 0)} cifras de sesión por debajo de 28 px.\n\n`;
md += `| Medida | ${['360 × 640', '320 × 568'].join(' | ')} |\n|---|---|---|\n`;
const med = (k, f) => [360, 320].map(w => { const v = medidas.filter(x => x.w === w && x[k] != null); return v.length ? f(v) : '—'; }).join(' | ');
md += `| R03: margen de la serie actual sobre el borde o el descanso (peor caso) | ${med('r03', v => `${Math.min(...v.map(x => x.r03))} px`)} |\n`;
md += `| R07: centro de la acción principal (peor caso, % del alto) | ${med('r07', v => `${Math.min(...v.map(x => x.r07))} %`)} |\n`;
md += `| Hoy: hueco entre la tira de la semana y el botón | ${med('semanaLibre', v => `${Math.min(...v.map(x => x.semanaLibre))} px`)} |\n`;
md += `| Desplazamiento horizontal | ${med('desborde', v => `${Math.max(...v.map(x => x.desborde))} px`)} |\n\n`;
md += `| Pantalla | Estado | Captura (Víctor) | Contraste mínimo V / G |\n|---|---|---|---|\n`;
for (const f of filas.filter(x => x.p === 'victor')) {
  const g = filas.find(x => x.p === 'virginia' && x.grupo === f.grupo && x.nombre === f.nombre);
  md += `| ${f.grupo} | ${f.nombre} | \`capturas/${f.archivo}\` | ${fmt(f.minimo)} / ${fmt(g?.minimo)} |\n`;
}
md += `\n${fallos.length ? `**${fallos.length} avisos:**\n\n- ${fallos.join('\n- ')}\n` : '**Todo cumple.**\n'}<!-- comprobacion:fin -->`;
console.log(md.replace(/<!--.*?-->/g, '').split('\n').slice(0, 12).join('\n'));
console.log(fallos.length ? `\n${fallos.length} avisos:\n- ${fallos.join('\n- ')}` : '\nTodo cumple.');
if (process.argv.includes('--escribir')) {
  const doc = await readFile(DOC, 'utf8');
  await writeFile(DOC, doc.replace(/<!-- comprobacion:inicio -->[\s\S]*<!-- comprobacion:fin -->/, md));
}
await writeFile(path.join(AQUI, 'comprobacion.json'), JSON.stringify({ filas, medidas, fallos }, null, 1));
process.exitCode = fallos.length ? 1 : 0;
