// Recorrido 17: Progreso (vacío, medidas, con una sesión) y Ejercicios (buscar, filtros, ficha, gustos).
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const b = await navegador();
const ctx = await contexto(b, 'm360'); const page = await ctx.newPage(); const err = vigilar(page);
await empezar(page, 'virginia', { objetivos: ['perder'] });
await page.click('#nav a[href="#progreso"]'); await esperar(300);
console.log('PROGRESO vacío:', (await leer(page)).vista.replace(/\n/g, ' | '));
await foto(page, '17-m360-progreso-vacio');
await page.click('[data-act="progreso.medida"]'); await esperar(300);
await page.fill('#m-peso', '-5'); await page.fill('#m-cintura', '80,5');
await page.click('[data-act="progreso.guardarMedida"]'); await esperar(300);
console.log('medidas guardadas:', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.pipos4).medidas)));
console.log('PROGRESO con medida:', (await leer(page)).vista.replace(/\n/g, ' | ').slice(0, 600));
await foto(page, '17-m360-progreso-medida', { completa: true });
await page.click('[data-act="progreso.medida"]'); await esperar(300);
await page.fill('#m-peso', '1000'); await page.click('[data-act="progreso.guardarMedida"]'); await esperar(300);
console.log('peso 1000:', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.pipos4).medidas)), (await leer(page)).vista.match(/Peso\n[^\n]*/));
// Ejercicios
await page.click('#nav a[href="#ejercicios"]'); await esperar(300);
console.log('EJERCICIOS:', (await leer(page)).vista.split('\n').slice(0, 6).join(' | '));
await page.fill('#ej-buscar', 'sentadilla'); await esperar(600);
console.log('buscar sentadilla:', (await leer(page)).vista.match(/\d+ ejercicios?/)[0], '| foco sigue en buscador:', await page.evaluate(() => document.activeElement.id));
await page.fill('#ej-buscar', 'zzzz'); await esperar(600);
console.log('sin resultados:', (await leer(page)).vista.split('\n').slice(-3).join(' | '));
await page.click('[data-act="ejercicios.limpiar"]'); await esperar(300);
console.log('tras limpiar:', (await leer(page)).vista.match(/\d+ ejercicios?/)[0], '| buscador:', await page.inputValue('#ej-buscar'));
await page.click('[data-act="ejercicios.filtro"][data-k="lugar"][data-v="piscina"]'); await esperar(200);
console.log('piscina:', (await leer(page)).vista.match(/\d+ ejercicios?/)[0]);
await page.click('[data-act="ejercicios.ficha"]'); await esperar(300);
console.log('ficha:', (await leer(page)).hoja.replace(/\n/g, ' | ').slice(0, 300));
await page.click('.hoja [data-act="ejercicios.gustoFicha"][data-v="rechazo"]'); await esperar(300);
await page.mouse.click(5, 5); await esperar(300);
console.log('tras «No lo quiero»:', (await leer(page)).vista.split('\n').slice(0, 12).join(' | '));
await foto(page, '17-m360-ejercicios', { completa: false });
// Ficha de un ejercicio sin pasos ni vídeo
const sinV = await page.evaluate(async () => { const m = await import('./js/datos/ejercicios.js'); return m.EJERCICIOS.filter(e => !e.v).map(e => e.id).length + ' sin vídeo; ' + m.EJERCICIOS.filter(e => !(e.p && e.p.length)).map(e => e.id).join(','); });
console.log('catálogo:', sinV);
console.log('errores', err);
await b.close();
