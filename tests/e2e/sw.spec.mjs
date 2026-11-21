// Service worker atómico (PR 5): casos de la auditoría (pwa/t2.js y t3.js) convertidos en pruebas.
// Más los de la revisión del PR 5 (rev-pr5/repro.mjs): despliegue a mitad de la instalación y dos pestañas.
// Levanta su propio servidor en el puerto 8783 (PUERTO_SW; +1 por cada proceso en paralelo) para poder
// cambiar la «versión desplegada», servir rutas de otra, y cortar o retrasar archivos concretos.
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
  fs.copyFileSync(path.join(RAIZ, 'tests/e2e/legado/vercel.json'), path.join(legado, 'vercel.json')); // sus cabeceras, sin CSP
  srv = crearServidor({ raiz: vA });
  await srv.escuchar(PUERTO);
});

test.afterAll(async () => {
  if (srv) await srv.cerrar();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

test.beforeEach(() => { Object.assign(srv.control, { raiz: vA, porRuta: {}, cortar: [], retrasar: {}, peticiones: [] }); });

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

// Espera a que algo asíncrono de la página sea verdadero (waitForFunction no espera promesas).
const enPagina = (page, fn, arg, timeout = 15000) => expect.poll(() => page.evaluate(fn, arg).catch(() => false), { timeout }).toBeTruthy();
const sinInstalacionEnCurso = page => enPagina(page, async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing; });
const hayEnEspera = page => enPagina(page, async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.waiting); });
const volverAPrimerPlano = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});

async function appEntera(page, marca) {
  await expect(page.locator('#nav a')).toHaveCount(4);
  await expect(page.locator('#vista')).not.toBeEmpty();
  await expect(page.locator('#vista')).not.toContainText('Algo ha fallado');
  await expect(page.locator('#fallo-arranque')).toHaveCount(0);
  if (marca !== undefined) expect((await foto(page)).marca).toBe(marca);
}

// Contexto nuevo con una sesión empezada hoy (y dueño elegido) en sus datos.
async function contextoConSesion(browser) {
  const ctx = await browser.newContext({ ...test.info().project.use, baseURL: `http://127.0.0.1:${PUERTO}` });
  const datos = estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } });
  await ctx.addInitScript(d => { if (!localStorage.getItem('pipos4')) localStorage.setItem('pipos4', d); }, JSON.stringify(datos));
  return ctx;
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
    // PR 13: una sola familia variable (Instrument Sans, identidad Carril 2), alojada en fonts/.
    return document.fonts.check('400 16px "Instrument Sans"') && document.fonts.check('600 16px "Instrument Sans"') && [...document.fonts].some(f => f.status === 'loaded');
  })).toBe(true);
  // La versión, discreta, en Perfil → Ajustes.
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
  await page.reload();
  await expect.poll(() => srv.control.peticiones.includes('/js/nucleo/ui.js')).toBe(true);
  await sinInstalacionEnCurso(page);
  await appEntera(page, 'A');
  await enPagina(page, async c => JSON.stringify(await caches.keys()) === c, JSON.stringify(cacheA)); // sin caché a medias

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

test('despliegue a mitad de la instalación (sw.js de B, ui.js de A): no se instala la mezcla y sigue A entera', async ({ page, context }) => {
  // rev-pr5/repro.mjs, escenario 1: antes quedaba una caché «coherente» con módulos de dos despliegues
  // y la app en blanco para siempre, también con red.
  const errores = vigilarErrores(page);
  await instalar(page);
  const cacheA = (await foto(page)).caches;
  srv.control.raiz = vB;
  srv.control.porRuta = { '/js/nucleo/ui.js': vA };
  await page.reload();
  await expect.poll(() => srv.control.peticiones.filter(p => p === '/js/nucleo/ui.js').length).toBeGreaterThan(0);
  await sinInstalacionEnCurso(page);
  await page.waitForTimeout(300);
  await expect(page.locator('#aviso-version')).toHaveCount(0);
  expect((await foto(page)).caches).toEqual(cacheA);
  await appEntera(page, 'A');
  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);

  // Termina el despliegue: B entra entera.
  srv.control.porRuta = {};
  await page.reload();
  await expect(page.locator('#aviso-version')).toBeVisible();
  await Promise.all([page.waitForEvent('load'), page.click('#aviso-version button')]);
  await appEntera(page, 'B');
  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'B');
  await context.setOffline(false);
  await page.reload();
  await appEntera(page, 'B');
  expect(errores).toEqual([]);
});

test('caché estropeada: con red, el vigilante la tira y recarga desde la red; sin red, lo dice', async ({ page, context }) => {
  await instalar(page);
  // Simula una caché que ya no arranca (un módulo con otros exports).
  await page.evaluate(async () => {
    const [k] = await caches.keys();
    await (await caches.open(k)).put('js/nucleo/ui.js', new Response('export const nada = 1;\n', { headers: { 'content-type': 'application/javascript' } }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#fallo-arranque')).toContainText('No se pudo actualizar: conéctate y vuelve a abrir', { timeout: 10000 });
  await context.setOffline(false);
  // Con red, «Volver a intentar»: el vigilante rescata (una vez) y la app vuelve.
  await page.click('#fallo-arranque button');
  await expect(page.locator('#nav a')).toHaveCount(4, { timeout: 20000 });
  await appEntera(page, 'A');
  // Y vuelve a instalarse entera, sin red sigue funcionando.
  await enPagina(page, async () => !!navigator.serviceWorker.controller && (await caches.keys()).length === 1);
  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);
});

test('«red que miente» (onLine sin respuesta) y la app no arranca por otra causa: no tira la caché', async ({ page, context }) => {
  // rev-pr5/liefi.mjs: antes el rescate borraba cachés y SW y la app pasaba a ser la página de error.
  await instalar(page);
  // Un fallo de arranque que no es de la caché (como un error de JS con ciertos datos), a voluntad.
  await context.addInitScript(() => {
    if (!localStorage.getItem('romper-arranque')) return;
    const o = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) { if (n === 'data-arrancado') throw new Error('fallo simulado'); return o.call(this, n, v); };
  });
  const antes = await page.evaluate(async () => ({ caches: await caches.keys(), regs: (await navigator.serviceWorker.getRegistrations()).length }));
  await page.evaluate(() => localStorage.setItem('romper-arranque', '1'));
  srv.control.retrasar = { '/': 120000 }; // el servidor no contesta
  await page.reload();
  await expect(page.locator('#fallo-arranque')).toContainText('No se pudo actualizar', { timeout: 15000 });
  expect(await page.evaluate(async () => ({ caches: await caches.keys(), regs: (await navigator.serviceWorker.getRegistrations()).length }))).toEqual(antes);
  expect(await page.evaluate(() => !!localStorage.getItem('pipos4'))).toBe(true);
  // La app sigue ahí sin conexión.
  srv.control.retrasar = {};
  await page.evaluate(() => localStorage.removeItem('romper-arranque'));
  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);
});

test('Instrument Sans (variable) se carga y dibuja cada peso y las cifras estrechas donde el CSS los pide', async ({ page }) => {
  // PR 13: la letra de la identidad aprobada sustituye a Archivo y Outfit. Es un archivo variable (peso
  // 400-700 y anchura 75-100 %): si no cargara, los pesos y la anchura se sintetizarían y medirían igual.
  await instalar(page);
  await page.click('#nav a[href="#perfil"]');
  await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
  await page.click('#nav a[href="#hoy"]');
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Instrument Sans' && f.status === 'loaded');
  })).toBe(true);
  const anchos = await page.evaluate(() => [['400', '100%'], ['500', '100%'], ['600', '100%'], ['400', '75%']].map(([w, st]) => {
    const s = document.createElement('span');
    s.textContent = 'Pipos Fitness ñáé 0123456789';
    s.style.font = `${w} 40px "Instrument Sans"`;
    s.style.fontStretch = st;
    s.style.position = 'absolute';
    s.style.whiteSpace = 'nowrap';
    document.body.append(s);
    const x = s.getBoundingClientRect().width;
    s.remove();
    return x;
  }));
  expect(new Set(anchos).size).toBe(4);
  expect(anchos[3]).toBeLessThan(anchos[0]); // las cifras estrechas (75 %) ocupan menos
  // Todo el texto de Hoy y de Perfil → Ajustes usa la letra alojada, con pesos 400 y 500 o 600.
  const usados = () => page.evaluate(() => {
    const cs = [...document.querySelectorAll('#vista *, #nav *')].map(e => getComputedStyle(e)).filter(c => c.fontFamily);
    return { familias: [...new Set(cs.map(c => c.fontFamily.split(',')[0].replace(/"/g, '').trim()))], pesos: [...new Set(cs.map(c => c.fontWeight))] };
  });
  const hoy = await usados();
  expect(hoy.familias).toEqual(['Instrument Sans']);
  expect(hoy.pesos).toEqual(expect.arrayContaining(['400']));
  for (const w of hoy.pesos) expect(await page.evaluate(w => document.fonts.check(`${w} 16px "Instrument Sans"`), w)).toBe(true);
});

test('al volver a primer plano avisa de la versión nueva; con una sesión en curso, no', async ({ page, browser }) => {
  await instalar(page);
  srv.control.raiz = vB;
  await page.evaluate(() => { window.sinRecargar = true; });
  await volverAPrimerPlano(page);
  await expect(page.locator('#aviso-version')).toBeVisible();
  expect(await page.evaluate(() => window.sinRecargar)).toBe(true);

  // Otro móvil, desde vA, con una sesión empezada: el SW nuevo espera y no hay aviso ni recarga.
  srv.control.raiz = vA;
  const ctx2 = await contextoConSesion(browser);
  const p2 = await ctx2.newPage();
  try {
    await p2.goto('/#hoy');
    await p2.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect(p2.locator('#vista')).toContainText('Seguir');
    srv.control.raiz = vB;
    await p2.evaluate(() => { window.sinRecargar = true; });
    await volverAPrimerPlano(p2);
    await hayEnEspera(p2);
    await p2.waitForTimeout(500);
    await expect(p2.locator('#aviso-version')).toHaveCount(0);
    expect(await p2.evaluate(() => window.sinRecargar)).toBe(true);
    expect((await foto(p2)).marca).toBe('A');
  } finally {
    await ctx2.close();
  }
});

test('dos pestañas: al actualizar en una, la otra (sin sesión) se recarga con la versión nueva', async ({ context }) => {
  // rev-pr5/repro.mjs, escenario 2: antes la otra pestaña seguía con código viejo bajo el SW nuevo.
  const t1 = await context.newPage();
  await instalar(t1);
  const t2 = await context.newPage();
  await t2.goto('/#hoy');
  await t2.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await t2.evaluate(() => { window.sinRecargar = true; });
  srv.control.raiz = vB;
  await t1.reload();
  await expect(t1.locator('#aviso-version')).toBeVisible();
  await Promise.all([t1.waitForEvent('load'), t2.waitForEvent('load'), t1.click('#aviso-version button')]);
  await appEntera(t1, 'B');
  await appEntera(t2, 'B');
  expect(await t2.evaluate(() => window.sinRecargar || null)).toBe(null);
});

test('dos pestañas con una sesión en curso: la otra avisa, no se recarga y se recarga al terminar la sesión', async ({ browser }) => {
  const ctx = await contextoConSesion(browser);
  try {
    const t1 = await ctx.newPage();
    await t1.goto('/#hoy');
    await t1.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const t2 = await ctx.newPage();
    await t2.goto('/#sesion/s1');
    await expect(t2.locator('[data-act="sesion.serie"]').first()).toBeVisible();
    await t2.evaluate(() => { window.sinRecargar = true; });
    srv.control.raiz = vB;
    await volverAPrimerPlano(t1);
    await hayEnEspera(t1);
    // Se activa la versión nueva desde fuera de t2 (como «Actualizar» en otra pestaña o «Volver a intentar»).
    await t1.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting.postMessage({ tipo: 'actualizar' }));
    await expect(t2.locator('#aviso-version')).toContainText('al terminar la sesión');
    await t2.waitForTimeout(500);
    expect(await t2.evaluate(() => window.sinRecargar)).toBe(true);
    expect((await foto(t2)).marca).toBe('A');
    // Termina la sesión (con una serie hecha: sin ninguna no se guarda, E7): se recarga sola con B.
    await t2.locator('[data-act="sesion.serie"]').first().click();
    const terminar = t2.locator('[data-act="sesion.terminar"]:visible').first();
    await terminar.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await terminar.click({ timeout: 5000 });
    await Promise.all([t2.waitForEvent('load', { timeout: 10000 }), t2.locator('[data-act="sesion.cerrar"]:visible').first().click({ timeout: 5000 })]);
    await expect(t2.locator('#nav a')).toHaveCount(4);
    expect((await foto(t2)).marca).toBe('B');
    expect(await t2.evaluate(() => JSON.parse(localStorage.getItem('pipos4')).sesiones.s1.estado)).toBe('hecha');
  } finally {
    await ctx.close();
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

test('vigilante en la primera instalación con red lenta: «Sigue cargando…» sin error, y arranca', async ({ page }) => {
  srv.control.retrasar = { '/js/datos/ejercicios.js': 10000 };
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#fallo-arranque')).toHaveText('Sigue cargando…', { timeout: 9000 });
  await expect(page.locator('#fallo-arranque button')).toHaveCount(0);
  await expect(page.locator('#nav')).toBeAttached({ timeout: 15000 });
  await expect(page.locator('#fallo-arranque')).toHaveCount(0);
  await expect(page.locator('[data-act="bienvenida.elegir"]').first()).toBeVisible();
});

test('paso desde main (SW viejo) con red a medias, luego sin red, y marcha atrás', async ({ page, context }) => {
  srv.control.raiz = legado;
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page).toHaveTitle('App vieja');

  // Lanzamiento: el primer arranque pierde ui.js. El SW de main da su index.html en su lugar: el vigilante
  // da de baja ese SW y lo reintenta desde la red una vez; como ui.js sigue sin llegar, avisa.
  srv.control.raiz = vA;
  srv.control.cortar = ['/js/nucleo/ui.js'];
  await page.reload();
  await expect(page.locator('#fallo-arranque')).toContainText('No se pudo actualizar', { timeout: 15000 });

  // Con red: arranca y el SW nuevo toma el control sin pedir «Actualizar» y sin aviso.
  srv.control.cortar = [];
  await Promise.all([page.waitForEvent('load'), page.click('#fallo-arranque button')]);
  await enPagina(page, async () => {
    const ks = await caches.keys();
    return ks.length === 1 && ks[0].startsWith('pipos-app-') && !!navigator.serviceWorker.controller;
  });
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await appEntera(page, 'A');
  await expect(page.locator('#aviso-version')).toHaveCount(0);

  await context.setOffline(true);
  await page.reload();
  await appEntera(page, 'A');
  await context.setOffline(false);

  // Marcha atrás a main: al abrir la app, el SW de main se instala, entra solo y borra la caché nueva;
  // la siguiente apertura ya es la app vieja.
  srv.control.raiz = legado;
  await page.reload();
  await enPagina(page, async () => { const ks = await caches.keys(); return ks.some(k => k.startsWith('elplan-')) && !ks.some(k => k.startsWith('pipos-app-')); });
  await page.reload();
  await expect(page).toHaveTitle('App vieja');
});
