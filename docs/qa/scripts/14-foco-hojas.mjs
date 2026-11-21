// Recorrido 14: a dónde va el foco (y el desplazamiento) al abrir las hojas: check-in sin lesiones, menú del ejercicio.
import { navegador, contexto, vigilar, foto, leer, esperar, empezar } from './comun.mjs';
const b = await navegador();
for (const movil of ['m360', 'm412']) {
  const ctx = await contexto(b, movil); const page = await ctx.newPage(); vigilar(page);
  await empezar(page, 'victor', { objetivos: ['musculo'] });
  await page.click('#nav a[href="#hoy"]'); await page.click('[data-act="entrenador.plan"]');
  for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
  await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(700);
  const f = await page.evaluate(() => ({ scrollTop: document.querySelector('.hoja').scrollTop, foco: document.activeElement.outerHTML.slice(0, 90) }));
  console.log(movil, 'check-in sin lesiones, 0,7 s después de abrir:', JSON.stringify(f));
  await foto(page, `14-${movil}-checkin-al-abrir`);
  await page.click('[data-act="entrenador.crearHoy"]'); await esperar(700);
  await page.click('[data-act="sesion.ir"][data-v="1"]'); await esperar(200);
  await page.click('[data-act="sesion.menu"][data-e="0"]'); await esperar(700);
  console.log(movil, 'menú del ejercicio, foco:', await page.evaluate(() => document.activeElement.outerHTML.slice(0, 60)), '| scrollTop hoja', await page.$eval('.hoja', h => h.scrollTop));
  await foto(page, `14-${movil}-menu-ejercicio`);
  await ctx.close();
}
await b.close();
