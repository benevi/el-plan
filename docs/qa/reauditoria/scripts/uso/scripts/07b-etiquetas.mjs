import { abrir, BASE } from './h.mjs';
const { browser, page } = await abrir({ w: 320, hgt: 568, reducir: true });
await page.goto(BASE + '/'); await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]'); await page.waitForSelector('#nav a');
for (const g of ['objetivos', 'salud', 'entreno', 'ajustes']) {
  await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`); await page.waitForTimeout(200);
  console.log(g, await page.evaluate(() => [...document.querySelectorAll('#vista label:has(input[type=checkbox])')].map(l => { const b = l.getBoundingClientRect(); return `${l.textContent.trim().slice(0, 30)} ${Math.round(b.width)}×${Math.round(b.height)}`; })));
}
console.log('desb', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
await browser.close();
