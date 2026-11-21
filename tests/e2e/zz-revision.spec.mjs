import { test, expect } from '@playwright/test';
import { medirEnPagina } from './medir-contraste.mjs';
const LOCALES = ['127.0.0.1', 'localhost'];
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
async function prep(page, context) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load/.test(m.text())) errores.push(m.text()); });
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  await page.evaluate(async () => { const e = await import('/js/nucleo/estado.js'); e.cambiar(S => { S.perfil.objetivos = ['salud']; S.perfil.usoIA = 'ahorro'; S.perfil.datos = { sexo: 'm', altura: 165, nacimiento: '1987' }; }, 'perfil'); });
  await page.goto('/#progreso'); await page.goto('/#hoy');
  return errores;
}
const bajos = async page => page.evaluate(([fn]) => {
  const f = new Function('return ' + fn)();
  const r = f('body');
  return Object.values(r.muestras).flatMap(x => x.detalle).filter(p => p.r < 4.5).map(p => p);
}, [medirEnPagina.toString()]);

test.skip('contraste bajo detalle', async ({ page, context }) => {
  await prep(page, context);
  await page.click('[data-act="entrenador.plan"] >> nth=0');
  const b = await bajos(page);
  console.log('MONTAR', JSON.stringify(b.slice(0, 20)));
  // font sizes of texto entries
  const info = await page.evaluate(() => [...document.querySelectorAll('.hoja *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => { const c = getComputedStyle(e); return [e.textContent.trim().slice(0,30), c.color, c.fontSize, c.fontWeight]; }).slice(0, 40));
  console.log('INFO', JSON.stringify(info));
});

test.skip('historial: recarga con hoja, abrir/cerrar varias, confirmar', async ({ page, context }) => {
  const errores = await prep(page, context);
  await page.click('#nav a[href="#progreso"]');
  await page.click('#nav a[href="#hoy"]');
  const l0 = await page.evaluate(() => history.length);
  for (let i = 0; i < 4; i++) {
    await page.click('[data-act="entrenador.plan"] >> nth=0');
    await expect(page.locator('.hoja')).toBeVisible();
    await page.click('[data-cerrar-hoja]');
    await expect(page.locator('.hoja')).toHaveCount(0);
    await page.waitForFunction(() => !(history.state && history.state.piposHoja));
  }
  console.log('LEN', l0, await page.evaluate(() => history.length));
  await page.goBack();
  console.log('tras atras url', page.url());
  await page.goForward();
  await page.waitForTimeout(300);
  console.log('tras adelante url', page.url(), await page.evaluate(() => JSON.stringify(history.state)));
  // recarga con hoja
  await page.click('[data-act="entrenador.plan"] >> nth=0');
  await expect(page.locator('.hoja')).toBeVisible();
  await page.reload();
  await expect(page.locator('#nav a')).toHaveCount(4);
  console.log('tras recarga state', await page.evaluate(() => JSON.stringify(history.state)), page.url());
  await page.goBack();
  await page.waitForTimeout(400);
  console.log('atras tras recarga url', page.url(), await page.locator('#vista h1').textContent());
  await page.goBack();
  await page.waitForTimeout(400);
  console.log('atras 2 tras recarga url', page.url());
  console.log('ERR', errores);
});

test.skip('lesion: eco, elige-uno, guardar, borrar-cancelar', async ({ page, context }) => {
  const errores = await prep(page, context);
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
  const nueva = page.locator('[data-act="perfil.lesion"]').first();
  await nueva.click();
  await expect(page.locator('.hoja')).toBeVisible();
  await page.locator('#l-dolor').fill('6');
  console.log('eco', await page.locator('#l-dolor-v').textContent());
  const chips = page.locator('#l-tipo .chip');
  await chips.nth(1).click();
  console.log('chips', await chips.evaluateAll(cs => cs.map(c => c.className + '|' + c.getAttribute('aria-pressed'))));
  const btns = await page.locator('.hoja button').evaluateAll(bs => bs.map(b => (b.dataset.act || '') + ':' + b.textContent.trim()));
  console.log('botones', btns);
  await page.locator('.hoja [data-act="perfil.guardarLesion"]').click().catch(e => console.log('no guardar', e.message));
  await page.waitForTimeout(200);
  console.log('lesiones', await page.evaluate(async () => JSON.stringify((await import('/js/nucleo/estado.js')).estado().perfil.lesiones)));
  console.log('ERR', errores);
});

test('checkin dolor >=7 confirmar y atras', async ({ page, context }) => {
  const errores = await prep(page, context);
  await page.evaluate(async () => { const e = await import('/js/nucleo/estado.js'); e.cambiar(S => { S.perfil.lesiones.push({ id: 'l1', tipo: 'lesion', zona: 'rodilla', dolor: 3, desde: '2025-01-01', nota: '', activa: true }); }, 'perfil'); });
  await page.goto('/#progreso'); await page.goto('/#hoy');
  const b = page.locator('[data-act="entrenador.prepararHoy"], [data-act="entrenador.hacerDia"]').first();
  console.log('hay preparar', await b.count());
  if (!await b.count()) { await page.click('[data-act="entrenador.plan"] >> nth=0'); await page.evaluate(() => [...document.querySelectorAll('.hoja button')].find(b => b.textContent.trim() === 'S').click()); await page.waitForTimeout(200); console.log('dias', await page.locator('.hoja button').evaluateAll(bs => bs.map(b => b.textContent.trim() + (b.dataset.act||'')+(b.dataset.ia||'')).join(','))); await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.waitForTimeout(300); }
  await page.locator('[data-act="entrenador.prepararHoy"], [data-act="entrenador.hacerDia"]').first().click();
  await expect(page.locator('.hoja')).toBeVisible();
  const r = page.locator('.hoja input[type=range]').first();
  console.log('ranges', await page.locator('.hoja input[type=range]').count());
  await r.fill('8');
  await page.waitForTimeout(100);
  console.log('hoja texto', await page.locator('.hoja').first().innerText().then(t => t.slice(0, 80)));
  await page.locator('.hoja [data-r="1"]').click();
  await page.waitForTimeout(300);
  console.log('tras si: hoja', await page.locator('.hoja').count(), 'state', await page.evaluate(() => JSON.stringify(history.state)), 'foco', await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80)));
  await page.goBack();
  await page.waitForTimeout(300);
  console.log('tras atras: hoja', await page.locator('.hoja').count(), page.url());
  console.log('ERR', errores);
});
