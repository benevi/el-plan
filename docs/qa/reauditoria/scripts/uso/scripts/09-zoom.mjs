// Texto ×2 en Android (escala de texto = zoom de página): 360×640 → 180×320 CSS px. Y ×1,5 → 240×427.
import { abrir, foto, BASE, desborde } from './h.mjs';
import { sembrar, tTxt } from './sembrar.mjs';
for (const [w, hh] of [[240, 427], [180, 320]]) {
  const { browser, page } = await abrir({ w, hgt: hh, reducir: true });
  const id = await sembrar(page, 'virginia', { modo: 'foco' });
  const corte = () => page.evaluate(() => [...document.querySelectorAll('#vista *, #temporizador *, .hoja *')].filter(e => { const cs = getComputedStyle(e); return e.children.length === 0 && e.textContent.trim() && (e.scrollWidth > e.clientWidth + 1) && cs.overflow !== 'visible' ; }).map(e => e.textContent.trim().slice(0, 25)).slice(0, 8));
  const fuera = () => page.evaluate(() => [...document.querySelectorAll('#vista button, #temporizador button, .hoja button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 20)));
  const m = async n => { console.log(w, n, 'desb', await desborde(page), 'cortado', JSON.stringify(await corte()), 'fuera', JSON.stringify(await fuera())); await foto(page, `09-${w}-${n}`); };
  await page.goto(BASE + '/#hoy'); await page.waitForTimeout(300); await m('hoy');
  await page.goto(BASE + '/#sesion/' + id); await page.waitForTimeout(300);
  await page.click('[data-act="sesion.ir"][data-v="1"]'); await m('sesion');
  await page.click('[data-act="sesion.serie"][data-principal]'); await page.clock.runFor(500); await m('descanso');
  console.log('  barra', await tTxt(page), await page.evaluate(() => { const t = document.getElementById('temporizador'); return t && Math.round(t.getBoundingClientRect().height) + ' de ' + innerHeight; }));
  await page.clock.runFor(95000); await m('alarma');
  await page.click('[data-act="sesion.ir"][data-v="2"]'); await page.click('[data-act="sesion.cuenta"]'); await page.clock.runFor(7000); await m('contador');
  console.log('  contador visible: botones', await page.evaluate(() => [...document.querySelectorAll('#temporizador button')].map(b => { const r = b.getBoundingClientRect(); return `${b.textContent.trim() || b.getAttribute('aria-label')} ${Math.round(r.top)}-${Math.round(r.bottom)}/${innerHeight}`; })));
  await browser.close();
}
