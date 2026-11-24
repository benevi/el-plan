import { abrir, foto, BASE, pequenos, contraste } from './h.mjs';
import { sembrar } from './sembrar.mjs';
const { browser, page } = await abrir({ w: 320, hgt: 568, reducir: true });
const id = await sembrar(page, 'virginia', { modo: 'foco' });
await page.goto(BASE + '/#sesion/' + id); await page.waitForTimeout(300);
for (const v of [0, 2, 4, 5]) { await page.click(`[data-act="sesion.ir"][data-v="${v}"]`); await page.waitForTimeout(150);
  console.log(v, await pequenos(page, 48, '#vista'), await contraste(page), 'principal visible:', await page.evaluate(() => { const b = document.querySelector('#vista [data-principal], #vista .tarea-marca'); if (!b) return 'n/a'; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight; }));
  await foto(page, `10-320-paso${v}`); }
// escribir a mano en «Sin contador»
await page.click('[data-act="sesion.ir"][data-v="2"]');
await page.fill('.serie-manual input', '25'); await page.locator('.serie-manual input').blur(); await page.click('.serie-manual [data-act="sesion.serie"]'); await page.waitForTimeout(200);
console.log(await page.evaluate(async id => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[1].sets, id));
console.log(await page.locator('#ej-1 .series').innerText());
await browser.close();
