// Recorrido 7: casos raros del cronómetro. Recargar a mitad de descanso, dos lados, doble toque, desmarcar,
// salir de la sesión con el descanso en marcha y empezar otra serie con un ejercicio por tiempo en marcha.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm412';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await page.clock.install({ time: new Date('2026-11-21T10:00:00+01:00') });
await empezar(page, 'victor', { objetivos: ['fuerza'] });
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
await page.click('[data-act="sesion.modo"][data-v="lista"]');
const ses = () => page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0]);
const c = async () => (await leer(page)).crono.replace(/\n/g, ' | ');
// (a) recargar a mitad del descanso
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await page.clock.runFor(30_000);
console.log('a) antes de recargar:', await c());
await page.reload(); await page.clock.runFor(1500);
console.log('a) tras recargar:', await c(), '| hash', (await leer(page)).hash);
await page.clock.runFor(200_000);
console.log('a) al acabar tras recargar: alarma', JSON.stringify((await leer(page)).alarma), JSON.stringify(await page.evaluate(() => window.__vib.splice(0))));
await page.click('.alarma').catch(() => {});
// (c) doble toque en la marca de una serie
await page.dblclick('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await page.clock.runFor(400);
console.log('c) doble toque: serie hecha?', (await ses()).ejercicios[0].sets[1].hecha, '| crono', JSON.stringify(await c()));
// (e) desmarcar una serie anterior con un descanso en marcha
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await page.clock.runFor(300);
console.log('e) descanso en marcha:', await c());
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await page.clock.runFor(300);
console.log('e) tras desmarcar la serie 1:', JSON.stringify(await c()), '| serie1', (await ses()).ejercicios[0].sets[0].hecha);
// (f) salir a Hoy con el descanso en marcha
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await page.clock.runFor(300);
await page.click('a[aria-label="Volver a Hoy"]'); await page.clock.runFor(300);
console.log('f) en Hoy:', JSON.stringify(await c()));
await foto(page, `07-${movil}-hoy-con-descanso`);
await page.clock.runFor(200_000);
console.log('f) alarma en Hoy:', JSON.stringify((await leer(page)).alarma));
await page.click('.alarma').catch(() => {});
// (b) dos lados: se fuerza «30-45s c/lado» en un ejercicio por tiempo (como la plancha lateral del catálogo)
const s = await ses();
let k = s.ejercicios.findIndex(x => /\d+\s*s/.test(x.reps) && x.rol !== 'cardio');
console.log('ejercicios:', JSON.stringify(s.ejercicios.map(x => [x.id, x.reps])));
await page.evaluate(() => { const S = JSON.parse(localStorage.pipos4); const s = Object.values(S.sesiones)[0]; const x = s.ejercicios[s.ejercicios.length - 2]; x.id = 'plancha-lateral'; x.reps = '20-30s c/lado'; x.series = 2; x.sets = [{ kg: null, valor: '', hecha: false }, { kg: null, valor: '', hecha: false }]; localStorage.pipos4 = JSON.stringify(S); localStorage['pipos4-rev'] = String(+(localStorage['pipos4-rev'] || 0) + 1); });
await page.goto(await page.evaluate(() => location.href.split('#')[0] + '#sesion/' + Object.keys(JSON.parse(localStorage.pipos4).sesiones)[0])); await page.reload(); await page.clock.runFor(1000);
k = (await ses()).ejercicios.findIndex(x => x.id === 'plancha-lateral');
console.log('b) plancha lateral en', k, await page.$eval(`#ej-${k} .serie`, e => e.innerText.replace(/\n/g, ' ')).catch(e => e.message));
await page.click(`[data-act="sesion.cuenta"][data-e="${k}"][data-s="0"]`); await page.clock.runFor(300);
console.log('b1', await c()); await page.clock.runFor(5200);
console.log('b2', await c()); await page.clock.runFor(20_000);
console.log('b3 a 20 s', await c()); await page.clock.runFor(10_200);
console.log('b4 a 30 s', await c()); await foto(page, `07-${movil}-cambio-lado`);
await page.clock.runFor(5200);
console.log('b5 lado 2', await c()); await page.clock.runFor(22_000);
await page.click('#temporizador [data-t="fin"]'); await page.clock.runFor(300);
console.log('b6 tras Hecho', JSON.stringify(await c()), JSON.stringify((await ses()).ejercicios[k].sets[0]));
// (g) ejercicio por tiempo en marcha y se marca otra serie
await page.click('#temporizador [data-t="fin"]').catch(() => {});
await page.click(`[data-act="sesion.cuenta"][data-e="${k}"][data-s="1"]`); await page.clock.runFor(15_000);
console.log('g) contando:', await c());
const otra = await page.$('[data-act="sesion.serie"][data-e="1"][data-s="0"]');
const tapado = await page.evaluate(() => { const el = document.querySelector('[data-act="sesion.serie"][data-e="1"][data-s="0"]'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top && top.closest('#temporizador') ? 'tapado por el cronómetro' : 'accesible'; });
console.log('g) marca de otra serie con la cuenta a pantalla completa:', tapado);
console.log('errores', err);
await b.close();
