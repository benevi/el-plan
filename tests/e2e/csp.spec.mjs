// PR 17: la app entera con la CSP y las cabeceras reales de vercel.json (las sirve tests/e2e/servidor.mjs).
// Recorre todas las pantallas de Víctor y Virginia, una sesión con descanso, su final con el rodillo de cifras,
// hojas, el editor de «Mis sesiones» y «Guardar copia», y comprueba que no hay ninguna violación de CSP (evento securitypolicyviolation ni consola).
import { test, expect } from '@playwright/test';

const HOY = new Date('2026-11-18T18:00:00+01:00');
const LOCALES = ['127.0.0.1', 'localhost'];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function preparar(page, context) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || ''} ${e.sourceFile || ''}:${e.lineNumber || ''}`));
  });
  await page.clock.install({ time: HOY });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => {
    if ((m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) || /Permissions-Policy|Content Security Policy/.test(m.text())) errores.push('console: ' + m.text());
  });
  return errores;
}
const violaciones = page => page.evaluate(() => window.__csp);

test('index.html llega con la CSP, HSTS, Permissions-Policy, COOP y sin marcos', async ({ page, context }) => {
  await preparar(page, context);
  const r = await page.goto('/');
  const c = r.headers();
  expect(c['content-security-policy']).toContain("script-src 'self'");
  expect(c['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(c['content-security-policy']).not.toContain('unsafe');
  expect(c['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(c['permissions-policy']).toContain('camera=()');
  expect(c['cross-origin-opener-policy']).toBe('same-origin');
  expect(c['x-frame-options']).toBe('DENY');
});

for (const persona of ['victor', 'virginia']) {
  test(`sin violaciones de CSP en toda la app (${persona})`, async ({ page, context }) => {
    const errores = await preparar(page, context);
    await page.goto('/');
    await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
    await expect(page.locator('#nav a')).toHaveCount(4);
    const id = await page.evaluate(async () => {
      const e = await import('/js/nucleo/estado.js');
      const m = await import('/js/nucleo/modelo.js');
      let id;
      e.cambiar(S => {
        S.perfil.usoIA = 'ahorro';
        S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'lumbar', dolor: 3, desde: '2025-01-01', nota: '', activa: true });
        const s = m.crearSesion({ nombre: 'Prueba', lugar: 'gym', minutos: 40, fuente: 'reglas',
          calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], vuelta: [{ nombre: 'Respiración', duracion: '1 min' }],
          ejercicios: [{ id: 'remo-sentado-polea', rol: 'principal', series: 2, reps: '10-12', descanso: 3, kg: 30 }, { id: 'plancha', rol: 'principal', series: 1, reps: '20s', descanso: 3 }] });
        S.sesiones[s.id] = s; id = s.id;
      }, 'sesion');
      return id;
    });
    for (const ruta of ['hoy', 'progreso', 'ejercicios', 'perfil', 'mia/nueva']) {
      await page.goto('/#' + ruta);
      await expect(page.locator('#vista h1')).toBeVisible();
    }
    // Perfil: cada parte y la hoja de la lesión (detalle de zona con hidden en vez de style)
    await page.goto('/#perfil');
    for (const g of await page.locator('[data-act="perfil.grupo"]').evaluateAll(b => b.map(x => x.dataset.v))) {
      await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`);
    }
    await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
    await page.locator('[data-act="perfil.lesion"]').first().click();
    await expect(page.locator('.hoja')).toBeVisible();
    await page.selectOption('#l-zona', { index: 1 });
    await page.locator('.hoja h2').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.hoja')).toHaveCount(0);
    // Ficha de un ejercicio (miniatura de i.ytimg.com permitida)
    await page.goto('/#ejercicios');
    await page.locator('[data-act="ejercicios.ficha"]').first().click();
    await expect(page.locator('.hoja')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.hoja')).toHaveCount(0);
    // Sesión: marcar series, descanso con su barra, rodillo de cifras, alarma y sonido (audio blob:)
    await page.goto('/#sesion/' + id);
    await expect(page.locator('#vista h1')).toBeVisible();
    const avance = page.locator('.avance i').first();
    if (await avance.count()) await expect.poll(() => avance.evaluate(el => el.style.getPropertyValue('--v'))).not.toBe('');
    for (const b of await page.locator('[data-act="sesion.tarea"]').all()) await b.click();
    await page.click('[data-act="sesion.foco"][data-v="1"]');
    await page.click('[data-actual] [data-principal]');
    await expect(page.locator('#temporizador')).toBeVisible();
    await page.clock.runFor(5000);
    // Toda la sesión: al marcar una serie, la barra de avance salta a su valor (sin crecer desde 0)
    await page.click('[data-act="sesion.modo"][data-v="lista"]');
    await page.locator('[data-actual] [data-principal]').first().click();
    expect(await page.locator('.avance i').first().evaluate(el => [el.style.getPropertyValue('--v'), el.getAnimations().length])).toEqual([expect.stringMatching(/^0\.\d+$/), 0]);
    // Terminar y la pantalla final (rodillo de cifras)
    await page.click('.cab-sesion [data-act="sesion.terminar"]');
    await page.locator('.hoja [data-act="sesion.cerrar"]').scrollIntoViewIfNeeded();
    await page.click('.hoja [data-act="sesion.cerrar"]');
    await expect(page.locator('.final')).toBeVisible();
    await page.clock.runFor(3000);
    expect(await page.locator('.final .rd').first().evaluate(el => el.style.getPropertyValue('--i'))).toBe('0');
    await page.click('.final [data-fin-hoy]');
    await expect(page.locator('.final')).toHaveCount(0);
    // Guardar copia (descarga por blob:)
    await page.goto('/#perfil');
    await page.click('[data-act="perfil.grupo"][data-v="copias"]');
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="perfil.exportar"]').first().click()]);
    expect(descarga.suggestedFilename()).toMatch(/\.json$/);
    expect(await violaciones(page)).toEqual([]);
    expect(errores.filter(e => /Content Security Policy|Refused to/.test(e))).toEqual([]);
    expect(errores).toEqual([]);
  });
}
