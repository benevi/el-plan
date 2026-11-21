// Recorrido 3: opciones del check-in. Desplazamiento de la hoja, zonas, dolor ≥ 7, alarma, petición con alarma.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm360';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await empezar(page, 'virginia', { objetivos: ['salud'] });
await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
await page.click('[data-act="perfil.lesion"]');
await page.selectOption('#l-zona', 'lumbar');
await page.click('[data-act="perfil.guardarLesion"]');
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
const hoja = '.hoja';
const scroll = () => page.$eval(hoja, h => ({ top: h.scrollTop, alto: h.scrollHeight, vis: h.clientHeight, foco: document.activeElement && (document.activeElement.outerHTML || '').slice(0, 80) }));
console.log('inicio', await scroll());
// 1) Bajar hasta la energía y tocar 4: ¿se mantiene la posición?
await page.$eval(hoja, h => { h.scrollTop = 250; });
console.log('antes de tocar energía', await scroll());
await page.click('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await esperar(400);
console.log('después de tocar energía', await scroll());
await foto(page, `03-${movil}-checkin-tras-energia`);
// 2) Añadir hombro y quitarlo
await page.click('[data-act="entrenador.ciZona"][data-v="hombro"]'); await esperar(400);
console.log('tras añadir hombro:', (await leer(page)).hoja.match(/Dolor hoy[^\n]*\n?/g), await botones(page, '.hoja').then(x => x.filter(y => /Quitar|ciZona/.test(y)).slice(0, 3)));
await foto(page, `03-${movil}-checkin-hombro`);
await page.click('[data-act="entrenador.ciQuitarZona"][data-v="hombro"]'); await esperar(300);
console.log('tras quitar hombro:', (await leer(page)).hoja.match(/Dolor hoy[^\n]*/g));
// 3) Dolor lumbar a 8 → confirmación
await page.$eval('[data-cambio="entrenador.ciDolor"]', el => { el.value = 8; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
await esperar(400);
console.log('confirmación:', (await leer(page)).hoja);
await foto(page, `03-${movil}-checkin-confirmar7`);
await page.click('.hoja [data-r="1"]'); await esperar(400);
const L = await leer(page); console.log('con 8:', L.hoja.slice(L.hoja.indexOf('CON LO QUE'), L.hoja.indexOf('CON LO QUE') + 600));
await foto(page, `03-${movil}-checkin-dolor8`);
// 4) Casilla de alarma
await page.check('[data-cambio="entrenador.ciAlarma"]'); await esperar(300);
console.log('botón con alarma:', await botones(page, '.hoja').then(x => x.slice(-2)));
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(500);
console.log('hoja alarma:', (await leer(page)).hoja);
await foto(page, `03-${movil}-alarma`);
await page.click('.hoja [data-act="entrenador.deshacerAlarma"]'); await esperar(300);
console.log('confirmar deshacer:', (await leer(page)).hoja);
await page.click('.hoja [data-r="1"]'); await esperar(500);
console.log('tras deshacer:', (await leer(page)).vista.slice(0, 400));
await foto(page, `03-${movil}-tras-deshacer`);
// 5) Petición con palabra de alarma
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
console.log('reabrir checkin, alarma marcada?', await page.$eval('[data-cambio="entrenador.ciAlarma"]', e => e.checked).catch(e => 'n/a'), (await leer(page)).hoja.match(/Dolor hoy[^\n]*/g));
await page.fill('#ci-peticion', 'ayer me mareé al acabar la cinta');
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
console.log('tras petición con alarma:', (await leer(page)).hoja, (await leer(page)).hash);
await foto(page, `03-${movil}-peticion-alarma`);
const bs = await botones(page, '.hoja'); console.log(bs);
if (bs.some(x => x.includes('ciRespAlarma=no'))) { await page.click('[data-act="entrenador.ciRespAlarma"][data-v="no"]'); await esperar(500); console.log('tras responder no:', (await leer(page)).hoja.slice(0, 300), (await leer(page)).hash); }
console.log('errores', err);
await b.close();
