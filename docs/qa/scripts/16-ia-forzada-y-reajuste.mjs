// Recorrido 16: «Pedírsela igualmente al entrenador IA» con salud o dolor ≥ 7 (¿se llama a /api?), y
// «Volver a ajustarla» en un día del plan (¿cuántas sesiones quedan?). Doble toque en «Preparar mi sesión».
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const b = await navegador();
let ctx = await contexto(b, 'm390'); let page = await ctx.newPage(); let err = vigilar(page);
const api = []; page.on('request', r => { if (r.url().includes('/api/')) api.push(r.method() + ' ' + r.url()); });
await empezar(page, 'victor', { objetivos: ['fuerza'] });
await page.click('[data-act="perfil.grupo"][data-v="salud"]');
await page.check('[data-cambio="perfil.salud"][data-k="hipertension"]'); await esperar(200);
await page.click('#nav a[href="#hoy"]'); await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
await page.check('[data-cambio="entrenador.ciIA"]'); await esperar(300);
console.log('previa con IA forzada:', (await leer(page)).hoja.split('\n').filter(l => /IA|app/.test(l)).join(' | '));
await foto(page, '16-m390-forzar-ia-con-salud');
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(1500);
console.log('peticiones a /api:', api, '| aviso:', (await leer(page)).aviso, '| fuente:', await page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0].fuente));
await ctx.close();
// Reajustar en día del plan y doble toque
ctx = await contexto(b, 'm390'); page = await ctx.newPage(); err = vigilar(page);
await empezar(page, 'virginia', { objetivos: ['musculo'] });
await page.click('#nav a[href="#hoy"]'); await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
await page.dblclick('[data-act="entrenador.crearHoy"]'); await esperar(800);
let n = await page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones).length);
console.log('doble toque en «Preparar mi sesión»: sesiones creadas =', n, '| hash', (await leer(page)).hash);
for (let k = 0; k < 3; k++) {
  await page.click('a[aria-label="Volver a Hoy"]'); await page.waitForFunction(() => location.hash === '#hoy'); await esperar(300);
  await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
  await page.click(`[data-act="entrenador.ci"][data-k="minutos"][data-v="${[30, 45, 90][k]}"]`); await esperar(200);
  await page.click('[data-act="entrenador.crearHoy"]'); await esperar(700);
}
const S = await page.evaluate(() => JSON.parse(localStorage.pipos4));
console.log('tras «Volver a ajustarla» 3 veces:', JSON.stringify(Object.values(S.sesiones).map(s => [s.fecha, s.minutos, s.estado])), '| plan.hechos', JSON.stringify(S.plan.hechos));
await page.goto(page.url().split('#')[0] + '#perfil'); await page.click('[data-act="perfil.grupo"][data-v="ajustes"]'); await esperar(300);
console.log('copia: ', (await leer(page)).vista.match(/Tus datos ocupan[^\n]*/)[0]);
console.log('errores', err);
await b.close();
