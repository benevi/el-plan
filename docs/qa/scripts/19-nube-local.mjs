// Recorrido 19: copias en la nube en local (sin servidor de copias: python no tiene /api). Solo la interfaz.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const b = await navegador();
const ctx = await contexto(b, 'm390'); const page = await ctx.newPage(); const err = vigilar(page);
const api = []; page.on('response', r => { if (r.url().includes('/api/')) api.push(r.status() + ' ' + r.request().method() + ' ' + r.url()); });
await empezar(page, 'virginia', { objetivos: ['salud'] });
await page.click('[data-act="perfil.grupo"][data-v="copias"]');
await page.click('[data-act="nube.activar"]'); await esperar(400);
console.log('hoja activar:', (await leer(page)).hoja.replace(/\n/g, ' | '));
console.log(await botones(page, '.hoja'));
await foto(page, '19-m390-nube-activar');
const frase = await page.evaluate(() => { const i = document.querySelector('.hoja input'); return i && i.value; });
console.log('frase propuesta en el campo:', frase);
const campos = await page.$$eval('.hoja input', is => is.map(i => i.id + ':' + i.type));
console.log('campos:', campos);
// Probar frase floja
if (campos.length >= 2) {
  await page.fill('.hoja input >> nth=0', 'hola'); await page.fill('.hoja input >> nth=1', 'hola');
  const ok = await page.$('.hoja [data-act^="nube."]:not([data-act="nube.otra"])');
  await page.click('.hoja .btn.grande, .hoja [data-act="nube.guardarFrase"]').catch(e => console.log('no hay botón', e.message.split('\n')[0]));
  await esperar(500); console.log('frase floja:', (await leer(page)).aviso, (await leer(page)).hoja.split('\n').slice(-3).join(' | '));
}
console.log('api:', api, '| errores', err);
await b.close();
// (segunda parte) Usar la frase propuesta y activar sin servidor de copias
{
  const b2 = await navegador();
  const ctx = await contexto(b2, 'm390'); const page = await ctx.newPage(); const err = vigilar(page);
  const api = []; page.on('response', r => { if (r.url().includes('/api/')) api.push(r.status() + ' ' + r.request().method() + ' ' + r.url()); });
  await empezar(page, 'virginia', { objetivos: ['salud'] });
  await page.click('[data-act="perfil.grupo"][data-v="copias"]');
  await page.click('[data-act="nube.activar"]'); await esperar(300);
  await page.click('[data-act="nube.usarGenerada"]'); await esperar(300);
  console.log('tras «Usar esta»:', await page.$$eval('.hoja input', is => is.map(i => i.value ? 'relleno' : 'vacío')));
  await page.click('[data-act="nube.confirmarActivar"]'); await esperar(4000);
  console.log('tras activar:', (await leer(page)).aviso, '|', (await leer(page)).hoja.replace(/\n/g, ' | ').slice(0, 300), '|', (await leer(page)).vista.split('\n').slice(10, 20).join(' | '));
  await foto(page, '19-m390-nube-tras-activar', { completa: true });
  await page.click('#nav a[href="#hoy"]'); await esperar(500);
  console.log('Hoy:', (await leer(page)).vista.replace(/\n/g, ' | ').slice(0, 400));
  console.log('api:', api, '| errores', err);
  await b2.close();
}
