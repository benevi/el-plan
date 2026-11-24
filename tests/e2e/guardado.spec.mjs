// Guardado robusto en un navegador real (PR 3): espejo en IndexedDB, rescate de datos ilegibles
// y dos pestañas que comparten almacenamiento (evento storage de verdad).
import { test, expect } from '@playwright/test';

async function sinFuentesExternas(context) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
}
// Lee el registro del espejo directamente de IndexedDB.
const leerEspejo = page => page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('pipos-espejo', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('estado');
  r.onsuccess = () => {
    const q = r.result.transaction('estado').objectStore('estado').get('pipos4');
    q.onsuccess = () => { res(q.result || null); r.result.close(); };
    q.onerror = () => res(null);
  };
  r.onerror = () => res(null);
}));

test('el espejo de IndexedDB sigue a localStorage y rescata unos datos ilegibles', async ({ page, context }) => {
  await sinFuentesExternas(context);
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  // El espejo se escribe sin bloquear: se espera a que tenga lo mismo que pipos4.
  await expect.poll(async () => {
    const reg = await leerEspejo(page);
    const ls = await page.evaluate(() => localStorage.getItem('pipos4'));
    return reg && reg.txt === ls;
  }).toBe(true);

  // Se rompe pipos4 y se recarga: rescate con la copia interna.
  const roto = await page.evaluate(() => { const t = localStorage.getItem('pipos4').slice(0, -15); localStorage.setItem('pipos4', t); return t; });
  await page.reload();
  await expect(page).toHaveTitle(/Rescatar datos/);
  await expect(page.locator('[data-act="rescate.espejo"]')).toBeVisible();
  await expect(page.locator('#vista')).toContainText('Virginia');
  expect(await page.evaluate(() => localStorage.getItem('pipos4'))).toBe(roto); // no se ha escrito nada
  const copias = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pipos4-roto-')).map(k => localStorage.getItem(k)));
  expect(copias).toEqual([roto]);

  await page.click('[data-act="rescate.espejo"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos4')));
  expect(g.dueño).toBe('virginia');
  expect(errores).toEqual([]);
});

test('dos pestañas: lo que guarda una aparece en la otra y la vieja no lo pisa', async ({ context }) => {
  await sinFuentesExternas(context);
  const a = await context.newPage();
  await a.goto('/');
  await a.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(a.locator('#nav a')).toHaveCount(4);
  // El guardado espera 250 ms: B se abre cuando el dueño ya está guardado (si no, B arranca en la bienvenida).
  await expect.poll(() => a.evaluate(() => (JSON.parse(localStorage.getItem('pipos4') || 'null') || {}).dueño)).toBe('victor');
  const b = await context.newPage();
  await b.goto('/#perfil');
  await expect(b).toHaveTitle(/Perfil/);

  // A marca un objetivo; B lo recibe por el evento storage y repinta.
  await a.goto('/#perfil');
  await a.click('[data-act="perfil.objetivo"][data-v="fuerza"]');
  await expect(b.locator('[data-act="perfil.objetivo"][data-v="fuerza"]')).toHaveAttribute('aria-pressed', 'true');
  // B marca otro; A lo recibe. En pipos4 quedan los dos.
  await b.click('[data-act="perfil.objetivo"][data-v="salud"]');
  await expect(a.locator('[data-act="perfil.objetivo"][data-v="salud"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => a.evaluate(() => JSON.parse(localStorage.getItem('pipos4')).perfil.objetivos.slice().sort().join())).toBe('fuerza,salud');
});
