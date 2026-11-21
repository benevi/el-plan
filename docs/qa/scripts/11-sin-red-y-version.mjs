// Recorrido 11: sin conexión (offline del contexto) y aviso de versión nueva (con y sin sesión en curso).
// Necesita una copia de la app servida en el puerto 8796 (COPIA=ruta de esa copia): se cambia un archivo y se
// recalcula la versión allí para simular un despliegue nuevo. No toca el worktree.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const COPIA = process.env.COPIA; const URL = 'http://127.0.0.1:8796/';
if (process.env.BASE !== URL) throw new Error('Lanza con BASE=' + URL);
const b = await navegador();
const ctx = await contexto(b, 'm390'); const page = await ctx.newPage(); const err = vigilar(page);
await page.goto(URL);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
await page.click('[data-act="perfil.objetivo"][data-v="musculo"]');
await page.click('#nav a[href="#hoy"]');
// Sin conexión
await ctx.setOffline(true);
await page.reload(); await esperar(1500);
console.log('sin red tras recargar:', (await leer(page)).vista.slice(0, 120).replace(/\n/g, ' | '), '| marca:', await page.isVisible('#red'));
await page.click('[data-act="entrenador.plan"]'); await esperar(300);
console.log('hoja semana sin red:', await botones(page, '.hoja').then(x => x.filter(y => /crearPlan/.test(y))));
await foto(page, '11-m390-semana-sin-red');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(600);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
console.log('previa sin red:', (await leer(page)).hoja.split('\n').filter(l => /IA|app/.test(l)).join(' | '));
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
console.log('sesión sin red:', (await leer(page)).hash, (await leer(page)).aviso);
// miniaturas sin red
console.log('imágenes rotas visibles:', await page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && i.offsetParent).length));
await foto(page, '11-m390-sesion-sin-red');
await ctx.setOffline(false);
// Versión nueva sin sesión en curso
await page.click('a[aria-label="Volver a Hoy"]'); await esperar(400);
fs.appendFileSync(COPIA + '/css/areas.css', '\n/* cambio de prueba QA */\n');
execSync('node scripts/version.mjs', { cwd: COPIA });
const vis = v => page.evaluate(v => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => v !== 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, v);
await vis('hidden'); await vis('visible');
await page.waitForSelector('#aviso-version', { timeout: 20000 }).catch(() => {});
console.log('aviso versión:', await page.$eval('#aviso-version', e => e.innerText).catch(() => 'NO APARECE'));
await foto(page, '11-m390-aviso-version');
// Con sesión en curso: empezar la sesión y comprobar que el aviso se aparta
const id = await page.evaluate(() => Object.keys(JSON.parse(localStorage.pipos4).sesiones)[0]);
await page.goto(URL + '#sesion/' + id); await esperar(800);
console.log('aviso al abrir la sesión pendiente:', await page.$eval('#aviso-version', e => e.innerText).catch(() => 'no'));
await page.click('[data-act="sesion.ir"][data-v="1"]').catch(() => {});
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await esperar(500);
console.log('aviso con la sesión en curso:', await page.$eval('#aviso-version', e => e.innerText).catch(() => 'no'));
await foto(page, '11-m390-sesion-en-curso-con-version');
// Actualizar
await page.click('[data-act="sesion.terminar"]'); await page.click('[data-act="sesion.cerrar"]'); await esperar(1500);
console.log('aviso al terminar:', await page.$eval('#aviso-version', e => e.innerText).catch(() => 'no'));
const antes = await page.evaluate(() => document.querySelector('meta[name="pipos-version"]').content);
await page.click('#aviso-version button').catch(e => console.log('sin botón', e.message));
await page.waitForLoadState('load'); await esperar(3000);
console.log('versión antes/después:', antes, await page.evaluate(() => document.querySelector('meta[name="pipos-version"]').content), '| datos siguen:', await page.evaluate(() => Object.keys(JSON.parse(localStorage.pipos4).sesiones).length));
console.log('errores', err);
await b.close();
