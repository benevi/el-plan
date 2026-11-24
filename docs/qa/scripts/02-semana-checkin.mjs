// Recorrido 2: perfil mínimo → montar la semana con la app → Hoy → check-in con todas sus opciones.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm390', quien = process.argv[3] || 'victor';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await empezar(page, quien, { objetivos: ['musculo', 'perder'] });
// Lesión de rodilla a 4/10
await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
await page.click('[data-act="perfil.lesion"]');
await page.selectOption('#l-zona', 'rodilla');
await page.$eval('#l-dolor', el => { el.value = 4; el.dispatchEvent(new Event('input', { bubbles: true })); });
await foto(page, `02-${quien}-${movil}-hoja-lesion`);
await page.click('[data-act="perfil.guardarLesion"]');
console.log((await leer(page)).vista.split('\n').slice(10, 16).join(' | '));
await page.click('#nav a[href="#hoy"]'); await esperar(200);
console.log('HOY:', (await leer(page)).vista);
await foto(page, `02-${quien}-${movil}-hoy-sin-plan`);
await page.click('[data-act="entrenador.plan"]'); await esperar(300);
console.log('HOJA PLAN:', (await leer(page)).hoja, await botones(page, '.hoja'));
await foto(page, `02-${quien}-${movil}-hoja-semana`);
await page.click('[data-act="entrenador.psDia"][data-v="6"]'); await page.click('[data-act="entrenador.psDia"][data-v="7"]'); await foto(page, `02-${quien}-${movil}-hoja-semana-sd`); console.log((await leer(page)).hoja.slice(-200)); await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(800);
const L = await leer(page); console.log('TRAS PLAN:', L.aviso, '\n', L.vista);
await foto(page, `02-${quien}-${movil}-hoy-con-plan`, { completa: true });
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
console.log('CHECKIN:', (await leer(page)).hoja); console.log(await botones(page, '.hoja'));
await foto(page, `02-${quien}-${movil}-checkin`);
console.log('errores', err);
await b.close();
