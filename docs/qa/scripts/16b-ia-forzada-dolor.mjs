// Recorrido 16b: «Pedírsela igualmente al entrenador IA» con dolor de hoy ≥ 7.
import { navegador, contexto, vigilar, foto, leer, esperar, empezar } from './comun.mjs';
const b = await navegador();
const ctx = await contexto(b, 'm390'); const page = await ctx.newPage(); const err = vigilar(page);
const api = []; page.on('request', r => { if (r.url().includes('/api/')) api.push(r.method() + ' ' + r.url()); });
await empezar(page, 'virginia', { objetivos: ['salud'] });
await page.click('#nav a[href="#hoy"]'); await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
await page.click('[data-act="entrenador.ciZona"][data-v="rodilla"]'); await esperar(300);
await page.$eval('[data-cambio="entrenador.ciDolor"]', el => { el.value = 8; el.dispatchEvent(new Event('change', { bubbles: true })); }); await esperar(300);
await page.click('.hoja [data-r="1"]'); await esperar(300);
const t = await page.$('[data-cambio="entrenador.ciIA"]');
console.log('¿se ofrece pedírsela a la IA con dolor 8?', !!t);
if (t) { await esperar(400); await page.locator('[data-cambio="entrenador.ciIA"]').check(); await esperar(300); console.log((await leer(page)).hoja.split('\n').filter(l => /IA|app/.test(l)).join(' | ')); await foto(page, '16b-m390-forzar-ia-con-dolor8'); }
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(1200);
console.log('peticiones a /api:', api, '| aviso:', (await leer(page)).aviso);
const s = await page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0]);
console.log('sesión D2:', s.tipo, s.minutos, JSON.stringify(s.ejercicios.map(x => [x.id, x.rol, x.series, x.reps])), JSON.stringify(s.calentamiento.map(x => x.nombre + ' ' + x.duracion)), JSON.stringify(s.vuelta.map(x => x.nombre + ' ' + x.duracion)));
console.log('explicación:', s.explicacion.join(' || '));
console.log('errores', err);
await b.close();
