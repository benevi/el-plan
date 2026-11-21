// Base del rediseño (PR 13) en un Chromium de verdad, a 390 × 844:
// - el botón atrás con una hoja abierta la cierra y no cambia la pantalla de debajo (E8);
// - la app se usa solo con el teclado (pestañas, foco al h1, hoja con foco al título, Tab dentro, Escape);
// - contraste AA medido con el script del sistema (medir-contraste.mjs) en cada pantalla, Víctor y Virginia;
// - arranque con el service worker en mala cobertura y la CPU ×4.
// Con CAPTURAS=1 guarda una captura de cada pantalla en docs/diseno/capturas-pr13/ (escala 1) y la tabla de
// contraste en docs/diseno/capturas-pr13/contraste.json.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { medirEnPagina } from './medir-contraste.mjs';
import { RAIZ } from './servidor.mjs';

const CAPTURAS = process.env.CAPTURAS === '1';
const DIR = path.join(RAIZ, 'docs/diseno/capturas-pr13');
const HOY = new Date('2026-11-18T18:00:00+01:00'); // miércoles por la tarde
const LOCALES = ['127.0.0.1', 'localhost'];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function preparar(page, context, { reducir = true, reloj = true } = {}) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }));
  if (reloj) await page.clock.setFixedTime(HOY);
  if (reducir) await page.emulateMedia({ reducedMotion: 'reduce' });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  return errores;
}

// Datos realistas: perfil, lesión (Virginia), sesiones hechas de las últimas semanas, medidas y dolor.
async function sembrar(page, persona) {
  await page.evaluate(async persona => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return e.hoyISO(d); };
    const V = persona === 'victor';
    const ejercicios = V
      ? [['press-pecho-maquina', 40, '10'], ['press-inclinado-maquina', 30, '10'], ['plancha', null, '40']]
      : [['flexiones', null, '10'], ['crunch', null, '15'], ['plancha', null, '30']];
    e.cambiar(S => {
      S.perfil.usoIA = 'ahorro';
      S.perfil.objetivos = V ? ['musculo', 'salud'] : ['salud', 'perder'];
      S.perfil.datos = V ? { sexo: 'h', altura: 180, nacimiento: '1985' } : { sexo: 'm', altura: 165, nacimiento: '1987' };
      if (!V && !S.perfil.lesiones.length) S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'cadera_lateral', dolor: 3, desde: '2025-01-01', nota: 'Trocanteritis', activa: true });
      for (let k = 0; k < 12; k++) {
        const fecha = hace(2 + k * 3);
        const s = m.crearSesion({ fecha, nombre: V ? 'Torso' : 'Cuerpo entero', lugar: 'gym', minutos: 50, fuente: 'reglas',
          calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], vuelta: [{ nombre: 'Estiramientos', duracion: '5 min' }],
          ejercicios: ejercicios.map(([id]) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 60 })) });
        s.estado = 'hecha'; s.empezada = fecha + 'T17:00:00.000Z'; s.terminada = fecha + 'T17:50:00.000Z';
        s.cierre = { esfuerzo: 3, dolor: {}, comentario: '' };
        s.ejercicios.forEach((x, i) => x.sets.forEach(st => { st.hecha = true; st.kg = ejercicios[i][1] == null ? null : ejercicios[i][1] + Math.floor((11 - k) / 3) * 2.5; st.valor = ejercicios[i][2]; }));
        S.sesiones[s.id] = s;
      }
      S.medidas = [0, 14, 28, 42].map((n, i) => ({ fecha: hace(n + 1), peso: V ? 84 - i * 0.6 : 63 - i * 0.4, cintura: V ? 92 - i : 76 - i * 0.5 }));
      if (!V) S.dolor = [20, 14, 8, 2].map((n, i) => ({ fecha: hace(n), zona: 'cadera_lateral', dolor: 4 - Math.min(i, 2), momento: 'despues' }));
    }, 'sesion');
  }, persona);
}

async function capturar(page, nombre) {
  if (!CAPTURAS) return;
  fs.mkdirSync(DIR, { recursive: true });
  // Los avisos breves de pasos anteriores no tapan la captura (se miden igual en el contraste)
  if (!/aviso/.test(nombre)) await page.evaluate(() => { const a = document.getElementById('aviso'); if (a) a.hidden = true; });
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(DIR, nombre + '.png') });
}

// Cierra la hoja con Escape y espera a que el historial quede quieto (la hoja quita su entrada).
async function escape(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state && history.state.piposHoja));
  await page.waitForTimeout(50);
}

async function medir(page) {
  return page.evaluate(medirEnPagina, 'body');
}

// ── Botón atrás con una hoja abierta (E8) ──
test('atrás con el check-in abierto lo cierra y se queda en Hoy; en la sesión, cierra «Más opciones» sin romper nada', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await sembrar(page, 'victor');
  // (a) Progreso → Hoy → abrir una hoja de Hoy → atrás
  await page.click('#nav a[href="#progreso"]');
  await page.click('#nav a[href="#hoy"]');
  await page.click('[data-act="entrenador.plan"] >> nth=0');
  await expect(page.locator('.hoja')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.hoja')).toHaveCount(0);
  await expect(page).toHaveURL(/#hoy$/);
  await expect(page.locator('#vista h1')).toContainText('Hola');
  await expect(page.locator('#vista')).not.toHaveAttribute('inert', '');
  // Atrás otra vez: ahora sí, a Progreso
  await page.goBack();
  await expect(page).toHaveURL(/#progreso$/);

  // (b) En la sesión: «Más opciones» → atrás → la hoja se va y la sesión sigue en pantalla
  const id = await page.evaluate(async () => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const s = m.crearSesion({ nombre: 'Torso', lugar: 'gym', minutos: 50, fuente: 'reglas', calentamiento: [], vuelta: [],
      ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 3, reps: '8-12', descanso: 60 }] });
    e.cambiar(S => { S.sesiones[s.id] = s; }, 'sesion');
    return s.id;
  });
  await page.goto('/#sesion/' + id);
  await page.click('[data-act="sesion.menu"] >> nth=0');
  await expect(page.locator('.hoja')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.hoja')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#sesion/${id}$`));
  // Y el menú vuelve a funcionar: añadir una serie
  const antes = await page.locator('[data-act="sesion.serie"]').count();
  await page.click('[data-act="sesion.menu"] >> nth=0');
  await page.click('.hoja [data-act="sesion.serieMas"]');
  await expect(page.locator('[data-act="sesion.serie"]')).toHaveCount(antes + 1);
  expect(errores).toEqual([]);
});

// ── Solo con el teclado ──
test('solo con el teclado: pestañas, foco al h1, hoja con foco al título, Tab dentro y Escape devuelve el foco', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await page.goto('/');
  // Bienvenida: Tab hasta el botón de Virginia y Enter
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement && document.activeElement.dataset.v === 'virginia')) break;
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('#nav a')).toHaveCount(4);
  await expect(page.locator('html')).toHaveAttribute('data-persona', 'virginia');
  await sembrar(page, 'virginia');

  // Tab hasta la pestaña Progreso (sin ratón) y Enter
  let llegó = false;
  for (let i = 0; i < 40 && !llegó; i++) {
    await page.keyboard.press('Tab');
    llegó = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href') === '#progreso');
  }
  expect(llegó).toBe(true);
  // Cada parada tiene foco visible (anillo de 2 px)
  const anillo = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return [c.outlineStyle, parseFloat(c.outlineWidth)]; });
  expect(anillo[0]).not.toBe('none');
  expect(anillo[1]).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#progreso$/);
  await expect.poll(() => page.evaluate(() => document.activeElement.tagName + ' ' + document.activeElement.textContent)).toMatch(/^H1 Progreso/);
  await expect(page.locator('#nav a[aria-current="page"]')).toHaveAttribute('href', '#progreso');

  // Perfil › Lesiones: abrir la lesión con el teclado
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
  const abridor = page.locator('[data-act="perfil.lesion"]').first();
  await abridor.focus();
  await page.keyboard.press('Enter');
  const hoja = page.locator('.hoja[role="dialog"]');
  await expect(hoja).toBeVisible();
  const titulo = await hoja.getAttribute('aria-labelledby');
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe(titulo);
  // Tab no sale de la hoja (la vuelta entera)
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('.hoja'))).toBe(true);
  }
  // Escape la cierra y el foco vuelve al botón que la abrió
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.dataset.act)).toBe('perfil.lesion');
  expect(errores).toEqual([]);
});

// ── Arranque rápido con el service worker, mala cobertura y CPU ×4 ──
test('arranque con el service worker en mala cobertura y la CPU ×4: ≤ 0,6 s hasta la app pintada', async ({ page, context }) => {
  await preparar(page, context, { reducir: false, reloj: false }); // el reloj falso de Playwright frena el arranque
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await sembrar(page, 'victor');
  await expect(page.locator('#nav a')).toHaveCount(4);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Momento en que main.js marca el arranque (<html data-arrancado>), desde el inicio de la navegación.
  await page.addInitScript(() => {
    new MutationObserver((_, o) => {
      if (document.documentElement && document.documentElement.hasAttribute('data-arrancado')) { window.__arranque = performance.now(); o.disconnect(); }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-arrancado'] });
  });
  const tiempos = [];
  for (let i = 0; i < 5; i++) {
    await page.reload();
    await page.waitForFunction(() => window.__arranque);
    tiempos.push(await page.evaluate(() => Math.round(window.__arranque)));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const mediana = tiempos.sort((a, b) => a - b)[2];
  console.log(`Arranque con SW, 400 ms de latencia y CPU ×4: ${tiempos.join(', ')} ms (mediana ${mediana} ms)`);
  expect(mediana).toBeLessThanOrEqual(600);
});

// ── Contraste AA en cada pantalla, Víctor y Virginia (y capturas con CAPTURAS=1) ──
for (const persona of ['victor', 'virginia']) {
  test(`contraste AA en todas las pantallas de ${persona === 'victor' ? 'Víctor' : 'Virginia'}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const errores = await preparar(page, context);
    const tabla = {};
    const mirar = async nombre => {
      await page.waitForTimeout(60);
      const r = await medir(page);
      const malos = Object.values(r.muestras).flatMap(x => x.detalle).filter(p => !p.ok);
      tabla[nombre] = { pares: r.resumen.pares, cumplen: r.resumen.cumplen, minimo: Math.min(...Object.values(r.muestras).map(x => x.minimo)), malos };
      await capturar(page, `${nombre}-${persona}`);
    };
    await page.goto('/');
    await expect(page.locator('.bienvenida')).toBeVisible();
    if (persona === 'victor') await mirar('bienvenida');
    await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
    await expect(page.locator('#nav a')).toHaveCount(4);
    await sembrar(page, persona);
    await page.goto('/#hoy');
    await mirar('hoy-sin-plan');
    await page.click('[data-act="entrenador.plan"] >> nth=0');
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('hoja-montar-semana');
    await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]');
    await expect(page.locator('.hoja')).toHaveCount(0);
    await mirar('hoy-con-plan');
    // La sesión de hoy (o un día del plan) con su check-in
    const botonPreparar = page.locator('[data-act="entrenador.prepararHoy"], [data-act="entrenador.hacerDia"]').first();
    await botonPreparar.click();
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('hoja-checkin');
    await page.click('[data-act="entrenador.crearHoy"]');
    await expect(page).toHaveURL(/#sesion\//);
    await mirar('sesion-uno-a-uno');
    await page.click('[data-act="sesion.modo"][data-v="lista"]');
    await mirar('sesion-toda');
    await page.click('[data-act="sesion.menu"] >> nth=0');
    await mirar('hoja-menu-ejercicio');
    await escape(page);
    await page.locator('[data-act="sesion.serie"]').first().click();
    await expect(page.locator('#temporizador, .temporizador').first()).toBeVisible();
    await mirar('sesion-descanso');
    await page.click('[data-act="sesion.terminar"] >> nth=0');
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('hoja-cierre');
    await escape(page);
    await page.goto('/#progreso');
    await mirar('progreso');
    const medidas = page.locator('[data-act="progreso.medida"]').first();
    if (await medidas.count()) { await medidas.click(); await mirar('hoja-medidas'); await page.keyboard.press('Escape'); }
    await page.goto('/#ejercicios');
    await mirar('ejercicios');
    await page.locator('[data-act="ejercicios.ficha"]').first().click();
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('hoja-ficha-ejercicio');
    await escape(page);
    await page.goto('/#perfil');
    for (const g of ['objetivos', 'lesiones', 'salud', 'entreno', 'datos', 'copias', 'ajustes']) {
      await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`);
      await mirar(`perfil-${g}`);
    }
    await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
    await page.locator('[data-act="perfil.lesion"]').first().click();
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('hoja-lesion');
    await escape(page);
    // Aviso y sin conexión
    await page.goto('/#hoy');
    await page.evaluate(async () => (await import('/js/nucleo/ui.js')).aviso('Medidas guardadas'));
    await mirar('hoy-aviso');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('#red')).toBeVisible();
    await mirar('hoy-sin-conexion');
    await context.setOffline(false);

    if (CAPTURAS) {
      const f = path.join(DIR, 'contraste.json');
      const todo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
      todo[persona] = tabla;
      fs.writeFileSync(f, JSON.stringify(todo, null, 1) + '\n');
    }
    const malos = Object.entries(tabla).filter(([, t]) => t.malos.length).map(([n, t]) => [n, t.malos.map(p => `${p.tipo} «${p.que}» ${p.fg} sobre ${p.bg}: ${p.r} < ${p.min}`)]);
    expect(malos).toEqual([]);
    expect(errores).toEqual([]);
  });
}
