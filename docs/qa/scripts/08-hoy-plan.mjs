// Recorrido 8: Hoy con plan. Ver un día, «Hoy no puedo», reorganizar, «Cambiar días», domingo sin días libres,
// día de descanso con «Entrenar igualmente» y «Volver a ajustarla».
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm390';
const b = await navegador();
async function preparar(fecha, dias) {
  const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
  await page.clock.install({ time: new Date(fecha) });
  await empezar(page, 'virginia', { objetivos: ['perder'] });
  await page.click('#nav a[href="#hoy"]');
  await page.click('[data-act="entrenador.plan"]');
  const on = await page.$$eval('[data-act="entrenador.psDia"].on', bs => bs.map(b => +b.dataset.v));
  for (const d of on) if (!dias.includes(d)) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  for (const d of dias) if (!on.includes(d)) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(600);
  return { ctx, page, err };
}
// Miércoles 18-11 con L-X-V: el lunes queda pasado
let { page, err, ctx } = await preparar('2026-11-18T09:00:00+01:00', [1, 3, 5]);
let L = await leer(page); console.log('MIÉRCOLES:', L.aviso, '\n', L.vista);
await foto(page, `08-${movil}-miercoles`, { completa: true });
await page.click('[data-act="entrenador.verDia"][data-v="5"]'); await page.clock.runFor(300);
console.log('VER VIERNES:', (await leer(page)).hoja.replace(/\n/g, ' | ').slice(0, 700));
await foto(page, `08-${movil}-ver-viernes`);
await page.click('[data-act="entrenador.hacerDia"]'); await page.clock.runFor(300);
console.log('CHECKIN de viernes hoy:', (await leer(page)).hoja.split('\n').slice(0, 3).join(' | '));
await page.mouse.click(5, 5); await page.clock.runFor(300);
await page.click('[data-act="entrenador.hoyNo"]'); await page.clock.runFor(300);
console.log('HOY NO PUEDO:', (await leer(page)).hoja.replace(/\n/g, ' | '), await botones(page, '.hoja'));
await foto(page, `08-${movil}-hoy-no-puedo`);
await page.click('[data-act="entrenador.reorganizar"]'); await page.clock.runFor(400);
L = await leer(page); console.log('TRAS REORGANIZAR:', L.aviso, '\n', L.vista);
await foto(page, `08-${movil}-tras-reorganizar`, { completa: true });
await ctx.close();
// Domingo 22-11 con solo el domingo: «Hoy no puedo»
({ page, err, ctx } = await preparar('2026-11-22T09:00:00+01:00', [7]));
L = await leer(page); console.log('DOMINGO:', L.vista.slice(0, 600));
await page.click('[data-act="entrenador.hoyNo"]'); await page.clock.runFor(300);
console.log('DOMINGO HOY NO PUEDO:', (await leer(page)).hoja.replace(/\n/g, ' | '), await botones(page, '.hoja'));
await foto(page, `08-${movil}-domingo-hoy-no-puedo`);
await page.click('[data-act="entrenador.reorganizar"]'); await page.clock.runFor(400);
L = await leer(page); console.log('DOMINGO TRAS REORGANIZAR:', L.aviso, '\n', L.vista);
await foto(page, `08-${movil}-domingo-tras-reorganizar`, { completa: true });
console.log('errores', err);
await ctx.close();
// Martes 17-11 con L-X-V (hoy descanso): «Entrenar igualmente»
({ page, err, ctx } = await preparar('2026-11-17T09:00:00+01:00', [3, 5]));
L = await leer(page); console.log('MARTES:', L.vista.slice(0, 500));
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
console.log('ENTRENAR IGUALMENTE:', (await leer(page)).hoja.split('\n').slice(0, 3).join(' | '));
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
await page.click('a[aria-label="Volver a Hoy"]'); await page.clock.runFor(300);
L = await leer(page); console.log('MARTES TRAS PREPARAR:', L.vista);
await foto(page, `08-${movil}-martes-tras-preparar`, { completa: true });
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
console.log('VOLVER A AJUSTAR:', (await leer(page)).hoja.split('\n').slice(0, 3).join(' | '));
await page.click('[data-act="entrenador.ci"][data-k="minutos"][data-v="30"]'); await page.clock.runFor(200);
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
const n = await page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones).map(s => [s.fecha, s.minutos, s.estado, s.nombre]));
console.log('sesiones tras reajustar:', JSON.stringify(n));
console.log('errores', err);
await b.close();
