// Recorrido 10b: check-in abierto antes de medianoche y preparado después; sesión empezada antes y cerrada después.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm390';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await page.clock.install({ time: new Date('2026-11-21T23:40:00+01:00') });
await empezar(page, 'virginia', { objetivos: ['musculo'] });
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(500);
// C) check-in abierto a las 23:40, preparado a las 00:02
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
console.log('check-in 23:40:', (await leer(page)).hoja.split('\n').slice(0, 2).join(' | '));
await page.clock.runFor(22 * 60e3);
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
let S = await page.evaluate(() => JSON.parse(localStorage.pipos4));
console.log('C) sesiones:', JSON.stringify(Object.values(S.sesiones).map(s => [s.fecha, s.nombre, s.estado])), '| plan.hechos', JSON.stringify(S.plan.hechos));
await page.goto(page.url().split('#')[0] + '#hoy'); await page.clock.runFor(800);
const L = await leer(page);
console.log('C) Hoy el domingo:', L.vista.split('\n').slice(0, 40).join(' | '));
await foto(page, `10b-${movil}-domingo-con-la-de-sabado`, { completa: true });
console.log('errores', err);
await b.close();
