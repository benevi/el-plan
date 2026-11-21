// Recorrido 10: cambio de día a medianoche con page.clock (Hoy abierto, check-in abierto y sesión a caballo).
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm390';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await page.clock.install({ time: new Date('2026-11-21T23:50:00+01:00') });
await empezar(page, 'virginia', { objetivos: ['musculo'] });
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(500);
console.log('23:50', (await leer(page)).vista.split('\n').slice(0, 14).join(' | '));
const oculto = v => page.evaluate(v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, v);
// A) Hoy abierto, el móvil se bloquea y se vuelve a las 00:05
await oculto(true); await page.clock.runFor(15 * 60e3); await oculto(false); await page.clock.runFor(500);
console.log('00:05 al volver:', (await leer(page)).vista.split('\n').slice(0, 14).join(' | '));
await foto(page, `10-${movil}-hoy-tras-medianoche`);
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
console.log('check-in a las 00:05:', (await leer(page)).hoja.split('\n').slice(0, 2).join(' | '));
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
const S = await page.evaluate(() => JSON.parse(localStorage.pipos4));
console.log('sesiones:', JSON.stringify(Object.values(S.sesiones).map(s => [s.fecha, s.nombre, s.estado])), '| plan.hechos', JSON.stringify(S.plan.hechos));
await page.click('a[aria-label="Volver a Hoy"]'); await page.clock.runFor(500);
console.log('Hoy tras preparar:', (await leer(page)).vista.split('\n').slice(0, 30).join(' | '));
await foto(page, `10-${movil}-hoy-tras-preparar`, { completa: true });
console.log('errores', err);
await b.close();
