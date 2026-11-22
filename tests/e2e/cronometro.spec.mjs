// Cronómetro y alarma del descanso en un Chromium de verdad (re-auditoría del PR 18: U1, U3, U4, COD-12).
// Es lo que más usan Víctor y Virginia («tiene que ir perfecto»):
// - U1: con cualquier hoja de la sesión abierta («Más opciones», «Cómo se hace», «Cambiar por otro», «Algo va mal»,
//   «Terminar», «Guardar como mía», «Descartar»), la barra del descanso y su alarma quedan por encima de la hoja
//   (elementFromPoint), la hoja les deja su sitio, la alarma recibe el foco, vibra tres toques, no se cierra antes de
//   8 s ni sin haberse visto (móvil bloqueado) y al cerrarse el foco vuelve a la hoja. A 360 × 640, 390 × 844,
//   320 × 568 y con texto ×2 (180 × 320), con y sin movimiento reducido.
// - Teclado con una hoja abierta: Tab llega a «+15» y «Cerrar»; Escape en la alarma la cierra a ella, no a la hoja.
// - COD-12: al cerrarse sola, la alarma no corta el audio (la tercera alarma, a los 8 s del fin, suena entera).
// - U4: el botón atrás con el contador a pantalla completa lo cancela sin apuntar y no cambia la pantalla.
// - U3: con texto ×2 (zoom de Android: 180 × 320, 195 × 422 y 160 × 284 px CSS) se alcanzan todos los botones del
//   contador y del descanso.
import { test, expect } from '@playwright/test';

const HOY = new Date('2026-11-18T18:00:00+01:00');
const LOCALES = ['127.0.0.1', 'localhost'];
const TRES_TOQUES = [250, 120, 250, 120, 250];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function preparar(page, context, { reducir = true } = {}) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }));
  await page.emulateMedia({ reducedMotion: reducir ? 'reduce' : 'no-preference' });
  await page.addInitScript(() => {
    window.__vibra = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibra.push(p); return true; } });
    // Espía del audio programado: cuándo se para (COD-12)
    window.__pausas = [];
    const pausa = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { window.__pausas.push(Date.now()); return pausa.call(this); };
  });
  await page.clock.install({ time: HOY });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  return errores;
}

// Sesión de hoy: press con kilos (descanso 120 s), plancha por tiempo, plancha lateral c/lado y cardio.
async function sesionDeHoy(page, persona = 'victor') {
  await page.goto('/');
  await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
  await expect(page.locator('#nav a')).toHaveCount(4);
  const id = await page.evaluate(async persona => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const ej = [['press-banca-mancuernas', 4, '8-10', 120, 22], ['plancha', 2, '30-40s', 30, null], ['plancha-lateral', 2, '20-30s c/lado', 45, null], ['bici-estatica', 1, '8 min', 0, null]];
    let id;
    e.cambiar(S => {
      S.perfil.objetivos = ['musculo']; S.perfil.usoIA = 'ahorro'; S.ajustes.modoSesion = 'foco';
      if (persona === 'virginia') S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'cadera_lateral', dolor: 3, desde: '2025-01-01', nota: '', activa: true });
      const s = m.crearSesion({ nombre: 'Empuje y core', lugar: 'gym', minutos: 55, fuente: 'reglas', explicacion: ['Sesión de prueba.'],
        checkin: { energia: 3, dolor: persona === 'virginia' ? { cadera_lateral: 3 } : {} },
        calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], vuelta: [{ nombre: 'Estiramiento de pectoral', duracion: '1 min' }],
        ejercicios: ej.map(([id, series, reps, descanso, kg]) => ({ id, rol: id === 'bici-estatica' ? 'cardio' : 'principal', series, reps, descanso, kg })) });
      S.sesiones[s.id] = s; id = s.id;
    }, 'sesion');
    return id;
  }, persona);
  await page.goto('/#sesion/' + id);
  await expect(page.locator('.vista-sesion')).toBeVisible();
  return id;
}
const irPaso = (page, n) => page.click(`.pasos-sesion [data-v="${n}"]`);
const descanso = (page, id, seg) => page.evaluate(async ([id, seg]) => (await import('/js/areas/sesion/temporizador.js')).descanso(seg, 'Descanso', { sesion: id, siguiente: 'A por la serie 2' }), [id, seg]);
// Avanza el reloj hasta que salta la alarma (sin pasarse: así se miden sus 8 s desde que se ve).
async function hastaAlarma(page) {
  // Hasta 1 s antes del fin de un salto (lo que marca la barra) y luego de 250 en 250 ms
  const q = await page.locator('#temporizador .descanso-reloj').textContent().catch(() => '');
  const m = /^(\d+):(\d\d)$/.exec((q || '').trim());
  if (m) await page.clock.runFor(Math.max(0, (+m[1] * 60 + +m[2] - 1.5) * 1000));
  for (let i = 0; i < 40; i++) {
    if (await page.locator('#temporizador.alarma').count()) return;
    await page.clock.runFor(250);
  }
  throw new Error('la alarma no ha saltado');
}
// Sin movimiento reducido, la hoja entra con una animación (en tiempo real): se espera a que acabe.
const hojaQuieta = page => page.locator('.hoja-fondo').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
const esconder = (page, oculto) => page.evaluate(o => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => o });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (o ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, oculto);

// La barra (o la alarma) está encima de todo: el centro de la barra y el de cada botón son suyos, cada botón dentro
// de la pantalla, y la hoja abierta (si la hay) termina por encima de ella.
async function barraEncima(page, que) {
  await page.clock.runFor(50); // con movimiento reducido, las transiciones duran 1 ms (componentes.css)
  const r = await page.evaluate(() => {
    const t = document.getElementById('temporizador');
    if (!t) return { falta: true };
    const tapados = [];
    const mio = (x, y) => { const el = document.elementFromPoint(x, y); return !!(el && el.closest('#temporizador')); };
    const b = t.getBoundingClientRect();
    if (!mio(b.left + b.width / 2, b.top + Math.min(b.height / 2, 20))) tapados.push('barra');
    for (const x of t.querySelectorAll('button')) {
      const q = x.getBoundingClientRect();
      if (q.left < -0.5 || q.right > innerWidth + 0.5 || q.top < -0.5 || q.bottom > innerHeight + 0.5) tapados.push(`${x.textContent.trim()} fuera`);
      else if (!mio(q.left + q.width / 2, q.top + q.height / 2)) tapados.push(`${x.textContent.trim()} tapado`);
    }
    const hoja = document.querySelector('.hoja-fondo .hoja');
    const hq = hoja && hoja.getBoundingClientRect();
    return { tapados, hojaDebajo: hoja ? Math.round(hq.bottom - b.top) : null, desborde: document.documentElement.scrollWidth - innerWidth };
  });
  expect(r.falta, `${que}: no hay barra`).toBeUndefined();
  expect(r.tapados, `${que}: barra o botones tapados`).toEqual([]);
  if (r.hojaDebajo != null) expect(r.hojaDebajo, `${que}: la hoja se mete debajo de la barra`).toBeLessThanOrEqual(1);
  expect(r.desborde, `${que}: desplazamiento horizontal`).toBeLessThanOrEqual(0);
}

const HOJAS = [
  ['Más opciones', async page => page.locator('#vista [data-act="sesion.menu"]').first().click()],
  ['Cómo se hace', async page => { await page.locator('#vista [data-act="sesion.menu"]').first().click(); await page.click('.hoja [data-act="sesion.ficha"]'); }],
  ['Cambiar por otro', async page => { await page.locator('#vista [data-act="sesion.menu"]').first().click(); await page.click('.hoja [data-act="sesion.cambiar"]'); }],
  ['Algo va mal', async page => page.locator('#vista [data-act="sesion.algoVaMal"]').first().click()],
  ['Terminar', async page => page.locator('#vista [data-act="sesion.terminar"]').first().click()],
  // (en «Toda la sesión», donde están al pie)
  ['Guardar como mía', async page => { await page.click('[data-act="sesion.modo"][data-v="lista"]'); await page.locator('#vista [data-act="sesion.guardarMia"]').first().click(); }],
  ['Descartar', async page => page.locator('#vista [data-act="sesion.descartar"]').first().click()],
];

for (const [w, alto, reducir] of [[360, 640, true], [390, 844, false], [320, 568, true], [180, 320, true]]) {
  test(`U1 a ${w} × ${alto}${reducir ? ', movimiento reducido' : ''}: con cada hoja de la sesión, el descanso y la alarma quedan por encima, con foco y vibración, y no se cierran antes de 8 s`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: alto });
    const errores = await preparar(page, context, { reducir });
    const id = await sesionDeHoy(page, w === 390 ? 'virginia' : 'victor');
    await irPaso(page, 1);
    // El primer descanso, de verdad: «Serie 1 hecha»
    await page.click('[data-actual] [data-principal]');
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    for (const [i, [nombre, abrir]] of HOJAS.entries()) {
      const que = `${nombre} (${w} × ${alto})`;
      if (i > 0) await descanso(page, id, 20);
      await abrir(page);
      await expect(page.locator('.hoja-fondo .hoja')).toBeVisible();
      await hojaQuieta(page);
      await page.clock.runFor(1000);
      await barraEncima(page, que + ', a mitad del descanso');
      const vibras = await page.evaluate(() => window.__vibra.length);
      await hastaAlarma(page);
      await expect(page.locator('#temporizador.alarma'), que).toBeVisible();
      await barraEncima(page, que + ', alarma');
      expect(await page.evaluate(() => document.activeElement && document.activeElement.id), `${que}: la alarma sin el foco`).toBe('temporizador');
      expect(await page.evaluate(n => window.__vibra.slice(n), vibras), `${que}: vibración`).toEqual([TRES_TOQUES]);
      // A la vista 8 s: no antes; al cerrarse sola, el foco vuelve a la hoja, que sigue abierta
      await page.clock.runFor(7000);
      await expect(page.locator('#temporizador.alarma'), `${que}: se cerró antes de 8 s`).toBeVisible();
      await page.clock.runFor(1500);
      await expect(page.locator('#temporizador'), `${que}: no se cerró a los 8 s`).toHaveCount(0);
      await expect(page.locator('.hoja-fondo .hoja')).toBeVisible();
      expect(await page.evaluate(() => !!document.activeElement.closest('.hoja-fondo')), `${que}: el foco no vuelve a la hoja`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('.hoja-fondo')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp('#sesion/' + id));
    }
    expect(errores).toEqual([]);
  });
}

test('U1 con el móvil bloqueado y una hoja abierta: al volver, la alarma está a la vista, dice cuánto hace y cuenta 8 s desde entonces', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const errores = await preparar(page, context);
  const id = await sesionDeHoy(page);
  await irPaso(page, 1);
  await page.click('[data-actual] [data-principal]');
  await page.locator('#vista [data-act="sesion.menu"]').first().click();
  await page.click('.hoja [data-act="sesion.ficha"]');
  await page.clock.runFor(1000);
  // Se bloquea a mitad del descanso y vuelve 40 s después del fin
  await esconder(page, true);
  await page.clock.runFor(160000);
  await expect(page.locator('#temporizador.alarma')).toHaveCount(0);
  await esconder(page, false);
  await expect(page.locator('#temporizador.alarma')).toBeVisible();
  await expect(page.locator('#temporizador .alarma-sub')).toContainText(/terminó hace 0:4\d/);
  await barraEncima(page, 'al volver');
  expect(await page.evaluate(() => window.__vibra.at(-1))).toEqual(TRES_TOQUES);
  await page.clock.runFor(7000);
  await expect(page.locator('#temporizador.alarma')).toBeVisible();
  // Se bloquea con la alarma puesta: no se cierra sola sin verse
  await esconder(page, true);
  await page.clock.runFor(30000);
  await esconder(page, false);
  await expect(page.locator('#temporizador.alarma'), 'se cerró con el móvil bloqueado').toBeVisible();
  await page.clock.runFor(7500);
  await expect(page.locator('#temporizador.alarma')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.locator('#temporizador')).toHaveCount(0);
  await expect(page.locator('.hoja-fondo .hoja')).toBeVisible();
  expect(errores).toEqual([]);
  void id;
});

test('U1 con teclado y una hoja abierta: Tab llega a «+15» y «Cerrar» de la alarma; Escape la cierra a ella y luego a la hoja', async ({ page, context }) => {
  const errores = await preparar(page, context);
  const id = await sesionDeHoy(page);
  await irPaso(page, 1);
  await page.locator('#vista [data-act="sesion.menu"]').first().click();
  await page.click('.hoja [data-act="sesion.ficha"]');
  await descanso(page, id, 15);
  // Durante el descanso, sus botones están en la vuelta del Tab, tras la hoja
  const foco = () => page.evaluate(() => { const a = document.activeElement; return a.closest('#temporizador') ? 'barra:' + (a.textContent.trim() || a.id) : a.closest('.hoja-fondo') ? 'hoja' : a.tagName; });
  await page.keyboard.press('Shift+Tab');
  expect(await foco()).toBe('barra:Saltar');
  await page.keyboard.press('Tab');
  expect(await foco()).toBe('hoja');
  await hastaAlarma(page);
  await expect(page.locator('#temporizador.alarma')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await foco()).toBe('barra:+15');
  await page.keyboard.press('Tab');
  expect(await foco()).toBe('barra:Cerrar');
  await page.keyboard.press('Tab');
  expect(await foco()).toBe('hoja');
  await page.keyboard.press('Shift+Tab');
  expect(await foco()).toBe('barra:Cerrar');
  await page.keyboard.press('Escape');
  await expect(page.locator('#temporizador')).toHaveCount(0);
  await expect(page.locator('.hoja-fondo .hoja')).toBeVisible();
  expect(await foco()).toBe('hoja');
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja-fondo')).toHaveCount(0);
  // «+15» de la alarma con la hoja abierta: otro descanso de 15 s, también encima
  await page.locator('#vista [data-act="sesion.menu"]').first().click();
  await descanso(page, id, 5);
  await page.clock.runFor(5500);
  await page.click('#temporizador [data-t="extra"]');
  await expect(page.locator('#temporizador.descanso:not(.alarma)')).toBeVisible();
  await barraEncima(page, '+15 con la hoja');
  expect(errores).toEqual([]);
});

test('COD-12: la alarma que se cierra sola no corta el audio (la tercera alarma suena entera); «Cerrar» sí lo para', async ({ page, context }) => {
  const errores = await preparar(page, context);
  const id = await sesionDeHoy(page);
  await irPaso(page, 1);
  await descanso(page, id, 10);
  await hastaAlarma(page);
  const pausas = await page.evaluate(() => window.__pausas.length);
  await page.clock.runFor(8500);
  await expect(page.locator('#temporizador')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pausas.length), 'el cierre automático paró el audio').toBe(pausas);
  // Cerrándola a mano, el audio sí se para
  await descanso(page, id, 10);
  await page.clock.runFor(10500);
  const antes = await page.evaluate(() => window.__pausas.length);
  await page.click('#temporizador [data-t="cerrar"]');
  expect(await page.evaluate(() => window.__pausas.length)).toBeGreaterThan(antes);
  expect(errores).toEqual([]);
});

test('U4: atrás con el contador a pantalla completa cancela sin apuntar y no cambia la pantalla; tras «Hecho», atrás va a la anterior', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await page.goto('/');
  const id = await sesionDeHoy(page);
  await irPaso(page, 2);
  const url = page.url();
  const valores = () => page.evaluate(async id => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[1].sets.map(z => z.valor), id);
  const antes = await valores();
  await page.click('[data-actual] [data-act="sesion.cuenta"]');
  await expect(page.locator('#temporizador.contador--pantalla')).toBeVisible();
  await page.clock.runFor(12000);
  await page.goBack();
  await expect(page.locator('#temporizador')).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.locator('.vista-sesion')).toBeVisible();
  expect(await valores(), 'atrás apuntó algo').toEqual(antes);
  expect(await page.evaluate(() => document.body.classList.contains('con-cuenta') || !!document.querySelector('[inert]:not(.hoja-velo)'))).toBe(false);
  // Ahora sí: se hace y se apunta; luego atrás vuelve a Hoy (no queda una entrada muerta en el historial)
  await page.click('[data-actual] [data-act="sesion.cuenta"]');
  await page.clock.runFor(5000 + 35000);
  await page.click('#temporizador [data-t="fin"]');
  await expect(page.locator('#temporizador.contador--pantalla')).toHaveCount(0);
  await expect.poll(async () => (await valores())[0]).toBe('35');
  await page.clock.runFor(1000);
  await page.goBack();
  await expect(page).toHaveURL(/#hoy$/);
  expect(errores).toEqual([]);
});

// U3: con texto ×2 (zoom de Android) todo el contador y el descanso se alcanzan.
for (const [w, alto] of [[180, 320], [195, 422], [160, 284]]) {
  test(`U3 con texto ×2 (${w} × ${alto} px CSS): se alcanzan todos los botones del descanso, la alarma y el contador`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: alto });
    const errores = await preparar(page, context);
    const id = await sesionDeHoy(page, 'virginia');
    await irPaso(page, 1);
    await page.click('[data-actual] [data-principal]');
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    await barraEncima(page, 'descanso');
    await page.click('#temporizador [data-t="menos"]');
    await page.click('#temporizador [data-t="mas"]');
    await page.clock.runFor(121000);
    await expect(page.locator('#temporizador.alarma')).toBeVisible();
    await barraEncima(page, 'alarma');
    await page.click('#temporizador [data-t="cerrar"]');
    // Contador de la plancha lateral (c/lado): cada botón, al desplazarse dentro del contador, se ve y se pulsa
    await irPaso(page, 3);
    await page.click('[data-actual] [data-act="sesion.cuenta"]');
    const alcanzable = async sel => {
      const b = page.locator('#temporizador ' + sel);
      await b.scrollIntoViewIfNeeded();
      const r = await b.evaluate(x => { const q = x.getBoundingClientRect(); const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { dentro: q.top >= 0 && q.bottom <= innerHeight + 0.5 && q.left >= 0 && q.right <= innerWidth + 0.5, mio: el === x || x.contains(el) }; });
      expect(r, `${sel} a ${w} × ${alto}`).toEqual({ dentro: true, mio: true });
      await b.click();
    };
    await alcanzable('[data-t="fin"]'); // Empezar ya
    await page.clock.runFor(3000);
    await alcanzable('[data-t="pausa"]'); // Pausar
    await alcanzable('[data-t="pausa"]'); // Seguir
    await page.clock.runFor(22000);
    await alcanzable('[data-t="fin"]'); // Cambiar de lado
    await page.clock.runFor(5000 + 25000);
    await expect(page.locator('#temporizador [data-t="fin"]')).toContainText('Hecho');
    await alcanzable('[data-t="fin"]'); // Hecho
    await expect(page.locator('#temporizador.contador--pantalla')).toHaveCount(0);
    expect(await page.evaluate(async id => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[2].sets[0].valor, id)).toMatch(/^\d+$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(errores).toEqual([]);
  });
}
