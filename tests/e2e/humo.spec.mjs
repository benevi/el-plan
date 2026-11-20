// Prueba de humo: la app arranca en un móvil, se elige dueño, las 4 pestañas se pintan sin errores
// y, con el service worker instalado, sigue pintando sin red.
import { test, expect } from '@playwright/test';

// Las miniaturas de YouTube (Ejercicios) no forman parte de la prueba: se sirven vacías para no depender de la red.
async function sinMiniaturas(context) {
  await context.route(/i\.ytimg\.com/, r => r.fulfill({ status: 204, body: '' }));
}

function vigilarErrores(page) {
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  return errores;
}

test('arranca, elige dueño y recorre las 4 pestañas sin errores', async ({ page, context }) => {
  await sinMiniaturas(context);
  const errores = vigilarErrores(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Bienvenida/);
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  const pestañas = await page.locator('#nav a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  expect(pestañas).toEqual(['#hoy', '#progreso', '#ejercicios', '#perfil']);
  for (const p of pestañas) {
    await page.click(`#nav a[href="${p}"]`);
    await expect(page).toHaveURL(new RegExp(p + '$'));
    await expect(page.locator('#vista')).not.toBeEmpty();
    await expect(page.locator('#vista')).not.toContainText('Algo ha fallado');
  }
  expect(errores).toEqual([]);
});

test('con el service worker instalado, recarga sin red y sigue pintando', async ({ page, context }) => {
  await sinMiniaturas(context);
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await expect(page.locator('#nav a')).toHaveCount(4);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#nav a')).toHaveCount(4);
  await expect(page.locator('#vista')).not.toBeEmpty();
  await expect(page.locator('#vista')).not.toContainText('Algo ha fallado');
  await expect(page.locator('#red')).toBeVisible(); // aviso «Sin conexión»
  for (const p of ['#hoy', '#progreso', '#ejercicios', '#perfil']) {
    await page.click(`#nav a[href="${p}"]`);
    await expect(page.locator('#vista')).not.toContainText('Algo ha fallado');
  }
  await context.setOffline(false);
  expect(errores).toEqual([]);
});
