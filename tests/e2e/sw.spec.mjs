// Service worker atómico (PR 5): casos de la auditoría (pwa/t2.js y t3.js) convertidos en pruebas.
// Levanta su propio servidor en el puerto 8783 (PUERTO_SW; +1 por cada proceso en paralelo) para poder cambiar la «versión desplegada»
// y cortar archivos concretos, como pasa con mala cobertura en el gimnasio.
//   vA, vB: copias de la app con una marca de versión. vB añade un export a ui.js que usa main.js:
//           si se mezclaran módulos de las dos, la app quedaría en blanco (SyntaxError al importar).
//   legado: réplica mínima de producción (main) con su service worker copiado tal cual.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearServidor, RAIZ } from './servidor.mjs';
import { escribirVersion, leerAPP } from '../../scripts/version.mjs';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';

// Un puerto por proceso de Playwright, por si se ejecuta en paralelo (p. ej. --repeat-each).
const PUERTO = (+process.env.PUERTO_SW || 8783) + (+process.env.TEST_PARALLEL_INDEX || 0);
test.use({ baseURL: `http://127.0.0.1:${PUERTO}` });
test.describe.configure({ mode: 'serial' });

let srv, tmp, vA, vB, legado;

function copiarApp(destino, cambiar) {
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  for (const f of [...leerAPP(sw).filter(Boolean), 'sw.js', 'LEEME.md']) {
    fs.mkdirSync(path.dirname(path.join(destino, f)), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, f), path.join(destino, f));
  }
  cambiar(rel => path.join(destino, rel));
  return escribirVersion(destino).ahora;
}

test.beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pipos-sw-'));
  vA = path.join(tmp, 'vA'); vB = path.join(tmp, 'vB'); legado = path.join(tmp, 'legado');
  copiarApp(vA, r => fs.appendFileSync(r('js/main.js'), "\ndocument.documentElement.dataset.marca = 'A';\n"));
  copiarApp(vB, r => {
    fs.appendFileSync(r('js/nucleo/ui.js'), "\nexport const MARCA = 'B';\n");
    fs.writeFileSync(r('js/main.js'), "import { MARCA } from './nucleo/ui.js';\n" + fs.readFileSync(r('js/main.js'), 'utf8') + '\ndocument.documentElement.dataset.marca = MARCA;\n');
  });
  // Producción de hoy (main): su sw.js y su index.html; el resto de su precarga, vacío.
  fs.mkdirSync(legado);
  const swViejo = fs.readFileSync(path.join(RAIZ, 'tests/e2e/legado/sw.js'), 'utf8');
  for (const f of leerAPP(swViejo).filter(Boolean)) {
    fs.mkdirSync(path.dirname(path.join(legado, f)), { recursive: true });
    fs.writeFileSync(path.join(legado, f), '');
  }
  fs.copyFileSync(path.join(RAIZ, 'tests/e2e/legado/sw.js'), path.join(legado, 'sw.js'));
  fs.copyFileSync(path.join(RAIZ, 'tests/e2e/legado/index.html'), path.join(legado, 'index.html'));
  srv = crearServidor({ raiz: vA });
  await srv.escuchar(PUERTO);
});

test.afterAll(async () => {
  if (srv) await srv.cerrar();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

test.beforeEach(() => { srv.control.raiz = vA; srv.control.cortar = []; srv.control.peticiones = []; });

function vigilarErrores(page) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  return errores;
}

// Instala la app (vA salvo que se diga otra cosa) y elige dueño.
async function instalar(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
}

const foto = page => page.evaluate(async () => ({
  marca: document.documentElement.dataset.marca || null,
  nav: document.querySelectorAll('#nav a').length,
  vista: document.getElementById('vista') ? document.getElementById('vista').innerText.trim().length : 0,
  caches: (await caches.keys()).sort(),
}));

const sinInstalacionEnCurso = page => page.waitForFunction(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return r && !r.installing;
});

async function appEntera(page, marca) {
  await expect(page.locator('#nav a')).toHaveCount(4);
  await expect(page.locator('#vista')).not.toBeEmpty();
  await expect(page.locator('#vista')).not.toContainText('Algo ha fallado');
  await expect(page.locator('#fallo-arranque')).toHaveCount(0);
  if (marca !== undefined) expect((await foto(page)).marca).toBe(marca);
}

test('se instala, arranca sin red con sus fuentes y no pide nada fuera del sitio', async ({ page, context }) => {
  srv.control.raiz = RAIZ;
  const fuera = [];
  context.on('request', r => { if (!r.url().startsWith(`http://127.0.0.1:${PUERTO}/`)) fuera.push(r.url()); });
  const errores = vigilarErrores(page);
  await instalar(page);
  const VERSION = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
  expect((await foto(page)).caches).toEqual([VERSION]);

  await context.setOffline(true);
  await page.reload();
  await appEntera(page);
  await expect(page.locator('#red')).toBeVisible();
  expect(await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('800 20px Archivo') && document.fonts.check('400 16px Outfit') && [...document.fonts].filter(f => f.status === 'loaded').length >= 2;
  })).toBe(true);
  // La versión del SW, discreta, en Perfil → Ajustes.
  await page.click('#nav a[href="#perfil"]');
  await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
  await expect(page.locator('[data-version-app]')).toHaveText(VERSION);
  await context.setOffline(false);
  expect(fuera).toEqual([]);
  expect(errores).toEqual([]);
});

test('actualización con un archivo que falla a medias: sigue la versión vieja entera; luego entra la nueva entera', async ({ page, context }) => {
  const errores = vigilarErrores(page);
  await instalar(page);
  const cacheA = (await foto(page)).caches;
  expect(cacheA).toHaveLength(1);

  // Se despliega vB, pero ui.js no llega (cobertura a medias).
  srv.control.raiz = vB;
  srv.control.cortar = ['/js/nucleo/ui.js'];
  srv.control.peticiones = [];
  await page.reload();
  await expect.poll(() => srv.control.peticiones.includes('/js/nucleo/ui.js')).toBe(true);
  await sinInstalacionEnCurso(page);
  await appEntera(page, 'A');
  expect((await foto(page)).caches).toEqual(cacheA); // la caché a medias de vB se ha borrado

  // En el gimnasio, sin red: la versión vieja, entera.
  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);

  // Vuelve la red: vB se instala entera y espera; la app avisa sin recargar sola.
  srv.control.cortar = [];
  await page.reload();
  await expect(page.locator('#aviso-version')).toBeVisible();
  await expect(page.locator('#aviso-version')).toContainText('Hay una versión nueva');
  await appEntera(page, 'A');

  await Promise.all([page.waitForEvent('load'), page.click('#aviso-version button')]);
  await appEntera(page, 'B');
  const cacheB = (await foto(page)).caches;
  expect(cacheB).toHaveLength(1);
  expect(cacheB).not.toEqual(cacheA);

  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'B');
  await context.setOffline(false);
  expect(errores).toEqual([]);
});

test('al volver a primer plano avisa de la versión nueva; con una sesión en curso, no', async ({ page }) => {
  await instalar(page);
  const visible = () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  srv.control.raiz = vB;
  await page.evaluate(() => { window.sinRecargar = true; });
  await visible();
  await expect(page.locator('#aviso-version')).toBeVisible();
  expect(await page.evaluate(() => window.sinRecargar)).toBe(true);

  // Otro móvil, desde vA, con una sesión empezada: el SW nuevo espera y no hay aviso ni recarga.
  srv.control.raiz = vA;
  const ctx2 = await page.context().browser().newContext({ ...test.info().project.use, baseURL: `http://127.0.0.1:${PUERTO}` });
  const datos = estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } });
  await ctx2.addInitScript(d => { if (!localStorage.getItem('pipos4')) localStorage.setItem('pipos4', d); }, JSON.stringify(datos));
  const p2 = await ctx2.newPage();
  try {
    await p2.goto('/#hoy');
    await p2.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect(p2.locator('#vista')).toContainText('Seguir');
    srv.control.raiz = vB;
    await p2.evaluate(() => { window.sinRecargar = true; });
    await p2.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await p2.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    await p2.waitForTimeout(500);
    await expect(p2.locator('#aviso-version')).toHaveCount(0);
    expect(await p2.evaluate(() => window.sinRecargar)).toBe(true);
    expect((await foto(p2)).marca).toBe('A');
  } finally {
    await ctx2.close();
  }
});

test('navegar a /LEEME.md u otra URL no pisa index.html', async ({ page, context }) => {
  await instalar(page);
  const r = await page.goto('/LEEME.md');
  expect(r.status()).toBe(200);
  await expect(page.locator('body')).toContainText('Pipos Fitness');
  expect((await page.goto('/no/existe')).status()).toBe(404); // a la red, sin index.html de la caché
  const index = await page.evaluate(async () => (await (await caches.match('/index.html')).text()));
  expect(index).toContain('<script type="module" src="js/main.js">');
  expect(index).toBe(fs.readFileSync(path.join(vA, 'index.html'), 'utf8'));

  await context.setOffline(true);
  await page.goto('/');
  await appEntera(page, 'A');
  await context.setOffline(false);
});

test('vigilante de arranque: si un módulo no llega, lo dice y deja recargar', async ({ page }) => {
  srv.control.cortar = ['/js/nucleo/ui.js'];
  await page.goto('/');
  await expect(page.locator('#fallo-arranque')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#fallo-arranque')).toContainText('No se pudo actualizar: conéctate y vuelve a abrir');
  srv.control.cortar = [];
  await Promise.all([page.waitForEvent('load'), page.click('#fallo-arranque button')]);
  await expect(page.locator('#nav')).toBeAttached();
  await expect(page.locator('#vista')).not.toBeEmpty();
  await page.waitForTimeout(6500); // pasado el plazo del vigilante, con la app arrancada no aparece
  await expect(page.locator('#fallo-arranque')).toHaveCount(0);
});

test('paso desde main (SW viejo) con red a medias, luego sin red, y marcha atrás', async ({ page, context }) => {
  srv.control.raiz = legado;
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page).toHaveTitle('App vieja');

  // Lanzamiento: el primer arranque pierde ui.js. El SW de main da su index.html en su lugar: el vigilante avisa.
  srv.control.raiz = vA;
  srv.control.cortar = ['/js/nucleo/ui.js'];
  await page.reload();
  await expect(page.locator('#fallo-arranque')).toBeVisible({ timeout: 8000 });

  // Con red: arranca, el SW nuevo sustituye al de main sin pedir «Actualizar» y sin aviso.
  srv.control.cortar = [];
  await Promise.all([page.waitForEvent('load'), page.click('#fallo-arranque button')]);
  await page.waitForFunction(async () => {
    const ks = await caches.keys();
    return ks.length === 1 && ks[0].startsWith('pipos-app-') && navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.endsWith('/sw.js');
  });
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await appEntera(page, 'A');
  await expect(page.locator('#aviso-version')).toHaveCount(0);

  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);

  // Marcha atrás a main: abrir la app dos veces basta para volver a la vieja.
  srv.control.raiz = legado;
  await page.reload();
  await page.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('elplan-')));
  await page.reload();
  await expect(page).toHaveTitle('App vieja');
});
