// Recorrido 1: bienvenida y todas las partes del perfil, para Víctor y Virginia, en 360×640.
import { navegador, contexto, vigilar, foto, leer, botones, BASE, esperar } from './comun.mjs';
const b = await navegador();
for (const quien of ['victor', 'virginia']) {
  const ctx = await contexto(b, 'm360'); const page = await ctx.newPage(); const err = vigilar(page);
  await page.goto(BASE);
  await foto(page, `01-${quien}-bienvenida`, { completa: true });
  await page.click(`[data-act="bienvenida.elegir"][data-v="${quien}"]`);
  await page.waitForSelector('[data-act="perfil.objetivo"]');
  const acc = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acc') + ' / ' + getComputedStyle(document.body).getPropertyValue('--acc'));
  console.log(quien, 'color --acc:', acc, '| hash', (await leer(page)).hash);
  await foto(page, `01-${quien}-perfil-vacio`, { completa: true });
  for (const g of ['objetivos', 'lesiones', 'salud', 'entreno', 'datos', 'copias', 'ajustes']) {
    await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`); await esperar(150);
    if (quien === 'victor') { console.log('--', g); console.log((await leer(page)).vista.slice(0, 1500)); console.log(await botones(page, '#vista')); }
    await foto(page, `01-${quien}-perfil-${g}`, { completa: true });
  }
  console.log(quien, 'errores:', err);
  await ctx.close();
}
await b.close();
