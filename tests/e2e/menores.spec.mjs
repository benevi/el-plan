// Fallos menores de interfaz del informe del 21-11-2026 que piden un navegador de verdad:
// - M9: una nota de lesión con una palabra o un enlace larguísimo no se sale de la pantalla;
// - M19: Perfil › Copias no repite el aviso de «ninguna copia» ni el botón «Copiar ahora», y Ajustes no repite
//   el aviso de la nube (con las copias activadas y el servidor sin la nube, un 503).
// El resto de los menores de interfaz, en tests/dom/menores-interfaz.test.mjs.
import { test, expect } from '@playwright/test';

const LOCALES = ['127.0.0.1', 'localhost'];
test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });

async function preparar(page, context) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin nube en la prueba"}' }));
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  return errores;
}

test('M9: una nota de lesión con un enlace larguísimo se parte y no desborda la pantalla', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await page.evaluate(async () => {
    const e = await import('/js/nucleo/estado.js');
    e.cambiar(S => { S.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 3, desde: '2025-01-01', tipo: 'lesion', nota: 'https://ejemplo.com/' + 'a'.repeat(70), activa: true }); }, 'perfil');
  });
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
  const fila = page.locator('[data-act="perfil.lesion"][data-id="l1"] .crece > span');
  await expect(fila).toContainText('https://ejemplo.com/');
  const medidas = await page.evaluate(() => {
    const el = document.querySelector('[data-act="perfil.lesion"][data-id="l1"] .crece > span');
    return { derecha: el.getBoundingClientRect().right, ancho: innerWidth, desborde: document.documentElement.scrollWidth - innerWidth, interior: el.scrollWidth - el.clientWidth };
  });
  expect(medidas.desborde).toBe(0);
  expect(medidas.interior).toBeLessThanOrEqual(0);
  expect(medidas.derecha).toBeLessThanOrEqual(medidas.ancho);
  expect(errores).toEqual([]);
});

test('M19: con las copias activadas y sin ninguna en la nube, Copias lo dice una vez y con un solo «Copiar ahora»', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.grupo"][data-v="copias"]');
  await page.click('[data-act="nube.activar"]');
  const frase = 'tortuga lámpara otoño ciento';
  await page.fill('#n-f1', frase); await page.fill('#n-f2', frase);
  await page.click('[data-act="nube.confirmarActivar"]');
  await expect(page.locator('[data-act="nube.frase"]')).toBeVisible({ timeout: 10000 });
  const copias = page.locator('.copias-nube');
  await expect(copias.locator('.ultima-nube')).toContainText('Aún no hay ninguna copia en la nube');
  await expect(copias.locator('[data-act="nube.copiar"]')).toHaveCount(1);
  expect(await copias.evaluate(el => (el.textContent.match(/ninguna copia/g) || []).length)).toBe(1);
  // Lo de que el servidor no tiene la nube sí se dice (es información nueva), sin otro botón.
  await expect(copias).toContainText('aún no están activadas en el servidor');
  // En Ajustes, el aviso de la nube sale una vez (arriba), no dos.
  await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
  await expect(page.locator('#vista .aviso-nube')).toHaveCount(1);
  expect(errores).toEqual([]);
});
