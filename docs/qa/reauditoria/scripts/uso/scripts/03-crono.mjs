import { abrir, foto, BASE, pequenos, contraste } from './h.mjs';
import { sembrar, esconder, tTxt, sets } from './sembrar.mjs';
const W = +process.argv[2] || 360, H = +process.argv[3] || 640;
const { browser, page } = await abrir({ w: W, hgt: H });
const id = await sembrar(page, 'victor', { modo: 'lista' });
await page.goto(BASE + '/#sesion/' + id); await page.waitForSelector('.sesion-ej');
const L = (...a) => console.log(...a);
// 1) Plancha lateral c/lado: Empezar
await page.click('#ej-1 [data-act="sesion.cuenta"]');
await page.clock.runFor(1000); L('previa', await tTxt(page));
await foto(page, `03-${W}-cuenta-previa`);
L('PEQ cuenta', await pequenos(page, 48, '#temporizador'));
L('CONTR cuenta', await contraste(page, '#temporizador'));
await page.clock.runFor(5000); L('trabajo L1 +5', await tTxt(page));
await page.clock.runFor(22000); L('L1 a 21s', await tTxt(page));
await foto(page, `03-${W}-cuenta-l1-logrado`);
await page.click('#temporizador [data-t="fin"]'); // Cambiar de lado
await page.clock.runFor(500); L('tras cambiar lado', await tTxt(page));
await foto(page, `03-${W}-cuenta-l2-previa`);
await page.clock.runFor(6000); L('L2 trabajo', await tTxt(page));
// pausa en L2
await page.click('#temporizador [data-t="pausa"]'); await page.clock.runFor(10000); L('L2 pausado 10 s', await tTxt(page));
await page.click('#temporizador [data-t="pausa"]'); await page.clock.runFor(26000); L('L2 tras seguir 26 s', await tTxt(page));
await page.click('#temporizador [data-t="fin"]'); await page.clock.runFor(300);
L('sets plancha lateral', JSON.stringify(await sets(page, id, 1)));
L('temporizador tras hecho', await tTxt(page));
// 2) Botón atrás con la cuenta a pantalla completa (plancha)
await page.click('#temporizador [data-t="fin"]').catch(() => {}); // saltar descanso
await page.clock.runFor(300);
await page.click('#ej-2 [data-act="sesion.cuenta"]'); await page.clock.runFor(8000);
L('plancha', await tTxt(page), 'hash', await page.evaluate(() => location.hash));
await page.goBack(); await page.clock.runFor(500);
L('tras atrás: hash', await page.evaluate(() => location.hash), 'cuenta', await tTxt(page), 'h1', await page.evaluate(() => document.querySelector('#vista h1')?.textContent));
await foto(page, `03-${W}-atras-con-cuenta`);
await page.click('#temporizador [data-t="fin"]'); await page.clock.runFor(500);
L('tras Hecho fuera de la sesión: sets plancha', JSON.stringify(await sets(page, id, 2)), 'temp', await tTxt(page));
await foto(page, `03-${W}-hecho-fuera`);
L('ERR', page.errores);
await browser.close();
