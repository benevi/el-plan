import { abrir, foto, BASE } from './h.mjs';
import { sembrar, tTxt, sets } from './sembrar.mjs';
const { browser, page } = await abrir({ w: 390, hgt: 844, reducir: true });
const id = await sembrar(page, 'virginia', { modo: 'foco' });
await page.goto(BASE + '/#sesion/' + id); await page.waitForSelector('.vista-sesion');
await page.click('[data-act="sesion.ir"][data-v="1"]'); await page.clock.runFor(200);
console.log(await page.locator('body').ariaSnapshot());
// recorrido con Tab desde el principio
await page.evaluate(() => document.activeElement.blur());
const orden = [];
for (let k = 0; k < 40; k++) { await page.keyboard.press('Tab'); orden.push(await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return `${a.tagName.toLowerCase()} «${(a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}» foco:${cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' ? cs.outlineWidth + ' ' + cs.outlineColor : (cs.boxShadow !== 'none' ? 'sombra' : 'NADA')}`; })); }
console.log(orden.join('\n'));
await browser.close();
