// Capturas y comprobaciones de las tres direcciones con Chromium (Playwright).
// - Capturas a 390×844 (escala 2) de Hoy, Sesión y Progreso de cada persona, y de la celebración, en ../capturas/.
// - Comprobaciones en 360×640 y 320×568: sin desplazamiento horizontal, serie actual visible sin desplazarse (R03),
//   zonas táctiles (R01), cifras de la sesión ≥ 28 px (R06), ninguna petición fuera del sitio y ningún error de consola.
// Uso: node prototipos/identidad/herramientas/capturas.mjs [--solo tiza]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar, lanzarChromium } from './servidor.mjs';

const AQUI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(AQUI, 'capturas');
const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] : null;
const DIRS = ['tiza', 'carril', 'hierro', 'carril-2'].filter(d => !solo || d === solo);
const VISTAS = ['hoy', 'sesion', 'progreso'];

await mkdir(SALIDA, { recursive: true });
const { srv, url } = await arrancar();
const nav = await lanzarChromium();
const fallos = [];

async function abrir(ctx, ruta) {
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('request', r => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) errores.push('Petición externa: ' + r.url()); });
  await pag.goto(url + ruta);
  await pag.evaluate(() => document.fonts.ready);
  await pag.waitForTimeout(150);
  return { pag, errores };
}

for (const dir of DIRS) {
  // Capturas a 390×844
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  for (const p of ['victor', 'virginia']) {
    for (const v of VISTAS) {
      const { pag, errores } = await abrir(ctx, `/prototipos/identidad/${dir}/?captura&p=${p}#${v}`);
      await pag.screenshot({ path: path.join(SALIDA, `${dir}-${v}-${p}.png`) });
      if (errores.length) fallos.push(`${dir} ${v} ${p}: ${errores.join(' | ')}`);
      await pag.close();
    }
    const { pag, errores } = await abrir(ctx, `/prototipos/identidad/${dir}/?captura&p=${p}&cierre#sesion`);
    await pag.screenshot({ path: path.join(SALIDA, `${dir}-celebracion-${p}.png`) });
    if (errores.length) fallos.push(`${dir} cierre ${p}: ${errores.join(' | ')}`);
    await pag.close();
  }
  // Alarma de fin de descanso (el reloj corre de verdad; se adelanta con el reloj simulado de Playwright)
  {
    const pag = await ctx.newPage();
    await pag.clock.install();
    await pag.goto(`${url}/prototipos/identidad/${dir}/?marco&p=victor#sesion`);
    await pag.evaluate(() => document.fonts.ready);
    await pag.clock.runFor(86000);
    await pag.waitForTimeout(100);
    const alarma = await pag.evaluate(() => document.querySelector('[data-descanso]').classList.contains('alarma'));
    if (!alarma) fallos.push(`${dir}: la alarma no salta al terminar el descanso`);
    await pag.screenshot({ path: path.join(SALIDA, `${dir}-alarma-victor.png`) });
    await pag.clock.runFor(9000);
    const sigue = await pag.evaluate(() => document.querySelector('[data-descanso]').classList.contains('alarma'));
    if (sigue) fallos.push(`${dir}: la alarma no se cierra sola`);
    await pag.close();
  }
  await ctx.close();

  // Comprobaciones en móviles pequeños
  for (const [w, hgt] of [[360, 640], [320, 568]]) {
    const c2 = await nav.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    for (const v of VISTAS) {
      const { pag, errores } = await abrir(c2, `/prototipos/identidad/${dir}/?captura&p=victor#${v}`);
      const r = await pag.evaluate(({ v }) => {
        const res = { desborde: document.documentElement.scrollWidth - innerWidth, pequenos: [], cifras: [] };
        const minimo = v === 'sesion' ? 48 : 44;
        for (const el of document.querySelectorAll('#app button, #app a, #app summary, .pestanas a, .descanso button')) {
          const b = el.getBoundingClientRect();
          if (!b.width || el.closest('[hidden]')) continue;
          if (b.width < minimo - 0.5 || b.height < minimo - 0.5) res.pequenos.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)} ${Math.round(b.width)}×${Math.round(b.height)}`);
        }
        if (v === 'sesion') {
          for (const el of document.querySelectorAll('[data-cifra], [data-reloj]')) {
            const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 28) res.cifras.push(`${el.textContent} ${fs}px`);
          }
          const fila = document.querySelector('[data-actual]');
          const tapa = document.querySelector('[data-descanso]:not([hidden])');
          const limite = tapa ? tapa.getBoundingClientRect().top : innerHeight;
          const fb = fila?.getBoundingClientRect();
          res.r03 = fb ? Math.round(limite - fb.bottom) : null; // ≥ 0: la serie actual entera a la vista y sin tapar
          const hecha = document.querySelector('[data-act="hecha"]').getBoundingClientRect();
          res.r07 = Math.round(((hecha.top + hecha.bottom) / 2) / innerHeight * 100); // % de alto: centro del botón principal
        } else {
          const pri = document.querySelector('#app .boton-principal, #app [data-act="ir"]');
          if (pri) { const b = pri.getBoundingClientRect(); res.r07 = Math.round(((b.top + b.bottom) / 2) / innerHeight * 100); }
        }
        return res;
      }, { v });
      const linea = `${dir} ${w}×${hgt} ${v}: desborde ${r.desborde}px` + (r.r03 != null ? `, R03 margen ${r.r03}px` : '') + (r.r07 != null ? `, R07 acción al ${r.r07} %` : '') +
        (r.pequenos.length ? `, PEQUEÑOS: ${r.pequenos.join('; ')}` : '') + (r.cifras.length ? `, CIFRAS: ${r.cifras.join('; ')}` : '');
      console.log(linea);
      if (r.desborde > 0 || r.pequenos.length || r.cifras.length || (r.r03 != null && r.r03 < 0 && w === 360)) fallos.push(linea);
      if (errores.length) fallos.push(`${dir} ${w} ${v}: ${errores.join(' | ')}`);
      await pag.close();
    }
    await c2.close();
  }
}

// Carril 2: fotogramas del movimiento (se congelan las animaciones en un instante con la Web Animations API)
// y fluidez con la CPU 4 veces más lenta (fotogramas medidos con requestAnimationFrame).
if (!solo || solo === 'carril-2') {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const congelar = (pag, ms) => pag.evaluate(t => new Promise(ok => requestAnimationFrame(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); requestAnimationFrame(ok); })), ms);
  // Final a mitad de la subida del agua y con las ondas
  for (const [ms, nombre] of [[450, 'agua'], [1150, 'ondas']]) {
    const pag = await ctx.newPage();
    await pag.goto(`${url}/prototipos/identidad/carril-2/?marco&p=virginia&cierre#sesion`);
    await pag.evaluate(() => document.fonts.ready);
    await congelar(pag, ms);
    await pag.screenshot({ path: path.join(SALIDA, `carril-2-movimiento-final-${nombre}.png`) });
    await pag.close();
  }
  // Cambio de pantalla Hoy → Progreso a mitad
  {
    const pag = await ctx.newPage();
    await pag.goto(`${url}/prototipos/identidad/carril-2/?marco&p=victor#hoy`);
    await pag.evaluate(() => document.fonts.ready);
    await pag.click('.pestanas [data-tab="progreso"]');
    await pag.waitForSelector('.saliente', { state: 'attached' });
    await congelar(pag, 160);
    await pag.screenshot({ path: path.join(SALIDA, 'carril-2-movimiento-cambio.png') });
    await pag.close();
  }
  // Fluidez
  const pag = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pag);
  await pag.goto(`${url}/prototipos/identidad/carril-2/?marco&p=victor#hoy`);
  await pag.evaluate(() => document.fonts.ready);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const medir = () => pag.evaluate(() => new Promise(ok => {
    const t = []; let ant = performance.now(); const fin = ant + 1500;
    const paso = ahora => { t.push(ahora - ant); ant = ahora; if (ahora < fin) requestAnimationFrame(paso); else ok(t); };
    requestAnimationFrame(paso);
  }));
  const informe = (n, t) => { const m = t.reduce((a, b) => a + b, 0) / t.length; console.log(`carril-2 fluidez ${n}: ${(1000 / m).toFixed(0)} fps de media, ${t.filter(x => x > 34).length} fotogramas de más de 34 ms (CPU ×4)`); };
  let p1 = medir(); await pag.click('.pestanas [data-tab="progreso"]'); informe('cambio a Progreso', await p1);
  await pag.goto(`${url}/prototipos/identidad/carril-2/?marco&p=victor#sesion`); await pag.waitForTimeout(300);
  p1 = medir(); await pag.click('.barra-sesion [data-act="terminar"]'); informe('final', await p1);
  await ctx.close();
}

// Índice
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  if (!solo) {
    const { pag, errores } = await abrir(ctx, '/prototipos/identidad/');
    await pag.waitForTimeout(600);
    await pag.screenshot({ path: path.join(SALIDA, 'indice.png'), fullPage: true });
    if (errores.length) fallos.push('índice: ' + errores.join(' | '));
    const l = await abrir(ctx, '/prototipos/identidad/logos/');
    await l.pag.waitForTimeout(600);
    await l.pag.screenshot({ path: path.join(SALIDA, 'logos.png'), fullPage: true });
    if (l.errores.length) fallos.push('logos: ' + l.errores.join(' | '));
    const l2 = await abrir(ctx, '/prototipos/identidad/logos-2/');
    await l2.pag.waitForTimeout(600);
    await l2.pag.screenshot({ path: path.join(SALIDA, 'logos-2.png'), fullPage: true });
    if (l2.errores.length) fallos.push('logos-2: ' + l2.errores.join(' | '));
  }
  await ctx.close();
}
await nav.close(); srv.close();
console.log(fallos.length ? `\n${fallos.length} avisos:\n- ${fallos.join('\n- ')}` : '\nTodo en orden.');
