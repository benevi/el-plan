// Sesión y descanso (PR 15) en un Chromium de verdad, con Víctor y con Virginia:
// - el recorrido entero de una sesión (uno a uno, serie actual con el selector ±, descanso, alarma, vuelta tras
//   bloquear, toda la sesión, menú, cambiar con series hechas, «Cómo se hace», ejercicio por tiempo, cardio,
//   tiempo con el móvil bloqueado, guardar como mía, terminar con series pendientes, cierre, final y la sesión
//   hecha en lectura) con el contraste AA medido (medir-contraste.mjs), zonas táctiles ≥ 48 px y cifras ≥ 28 px;
// - la alarma vibra tres toques (espía en navigator.vibrate), recibe el foco y se cierra sola a los 8 s;
// - T9 en 360 × 640 y 320 × 568: la serie actual se ve sin desplazarse y no queda debajo del descanso;
// - el doble toque en «Serie 1 hecha» marca una sola serie.
// Con CAPTURAS=1 guarda una captura de cada estado en docs/diseno/capturas-pr15/ (390 × 844 y 360 × 640) y la
// tabla de contraste en docs/diseno/capturas-pr15/contraste.json.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { medirEnPagina } from './medir-contraste.mjs';
import { RAIZ } from './servidor.mjs';

const CAPTURAS = process.env.CAPTURAS === '1';
const DIR = path.join(RAIZ, 'docs/diseno/capturas-pr15');
const HOY = new Date('2026-11-18T18:00:00+01:00'); // miércoles por la tarde
const LOCALES = ['127.0.0.1', 'localhost'];
const PERSONAS = ['victor', 'virginia'];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function preparar(page, context) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Espía de la vibración: cada llamada a navigator.vibrate queda apuntada.
  await page.addInitScript(() => {
    window.__vibra = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibra.push(p); return true; } });
  });
  await page.clock.install({ time: HOY });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  return errores;
}

// Datos: historial (para «La última vez»), lesión de Virginia y la sesión de hoy con calentamiento, ejercicios con
// kilos, por tiempo (Virginia: por lados), cardio en minutos y vuelta a la calma.
async function empezar(page, persona) {
  await page.goto('/');
  await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
  await expect(page.locator('#nav a')).toHaveCount(4);
  return page.evaluate(async persona => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const V = persona === 'victor';
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return e.hoyISO(d); };
    const ej = V
      ? [['press-banca-mancuernas', 4, '8-10', 120, 22], ['remo-sentado-polea', 3, '10-12', 75, 40], ['plancha', 3, '40-60s', 60, null], ['bici-estatica', 1, '12 min', 0, null]]
      : [['remo-sentado-polea', 3, '10-12', 75, 20], ['sentadilla-goblet', 3, '10-12', 90, 10], ['plancha-lateral', 2, '20-30s c/lado', 45, null], ['bici-estatica', 1, '15 min', 0, null]];
    let id;
    e.cambiar(S => {
      S.perfil.usoIA = 'ahorro';
      if (!V) S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'cadera_lateral', dolor: 3, desde: '2025-01-01', nota: 'Trocanteritis', activa: true });
      for (const k of [9, 5]) {
        const s = m.crearSesion({ fecha: hace(k), nombre: 'Anterior', lugar: 'gym', fuente: 'reglas', ejercicios: ej.map(([id, series, reps, descanso, kg]) => ({ id, rol: 'principal', series, reps, descanso, kg })) });
        s.estado = 'hecha'; s.empezada = hace(k) + 'T17:00:00.000Z'; s.terminada = hace(k) + 'T17:50:00.000Z'; s.cierre = { esfuerzo: 3, dolor: {}, comentario: '' };
        s.ejercicios.forEach(x => x.sets.forEach((z, j) => { z.hecha = true; z.kg = x.kg ? x.kg - 2 : null; z.valor = /s/.test(x.reps) ? '40' : /min/.test(x.reps) ? '12' : String(10 - (j === 3 ? 1 : 0)); }));
        S.sesiones[s.id] = s;
      }
      const s = m.crearSesion({ nombre: V ? 'Empuje y tren superior' : 'Core y espalda', lugar: 'gym', minutos: 55, fuente: 'reglas',
        explicacion: [V ? 'Subimos 2 kg en el press porque la última vez te sobraron dos repeticiones en todas las series.' : 'Remo y core para tu espalda, sin cargar la cadera.', 'El cardio va al final, suave.'],
        checkin: { energia: 3, dolor: V ? {} : { cadera_lateral: 3 } },
        calentamiento: [{ nombre: 'Bici suave', duracion: '5 min', detalle: 'Que puedas hablar sin ahogarte.' }, { nombre: 'Movilidad de hombros con banda', duracion: '2 min', detalle: 'Círculos y aperturas, sin dolor.' }],
        vuelta: [{ nombre: 'Estiramiento de pectoral', duracion: '1 min' }, { nombre: 'Respiración', duracion: '1 min' }],
        ejercicios: ej.map(([id, series, reps, descanso, kg]) => ({ id, rol: id === 'bici-estatica' ? 'cardio' : 'principal', series, reps, descanso, kg })) });
      S.sesiones[s.id] = s; id = s.id;
    }, 'sesion');
    return id;
  }, persona);
}

const tabla = {};
async function mirar(page, nombre, { tactil = true } = {}) {
  await page.waitForTimeout(40);
  const r = await page.evaluate(medirEnPagina, 'body');
  const malos = Object.values(r.muestras).flatMap(x => x.detalle).filter(p => !p.ok);
  // Zonas táctiles de la sesión (≥ 48 px) y cifras de la sesión (≥ 28 px)
  const otros = await page.evaluate(() => {
    const pequenos = [], cifras = [];
    const capa = document.querySelector('.final, .temporizador.contador, .hoja-fondo .hoja');
    const raices = capa ? [capa, ...document.querySelectorAll('#temporizador.descanso')] : [document.querySelector('#vista'), ...document.querySelectorAll('#temporizador')];
    for (const raiz of raices) for (const el of raiz.querySelectorAll('button, a[href], summary, input:not([type=hidden]), select, textarea')) {
      const b = el.getBoundingClientRect(); if (!b.width || el.closest('[hidden], .solo-lector')) continue;
      if (b.width < 47.5 || b.height < 47.5) pequenos.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    for (const el of document.querySelectorAll('.selector-valor b, .descanso-reloj, .contador-reloj, .serie-tiempo b, .final dd')) {
      if (!el.getBoundingClientRect().width) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 28) cifras.push(`${el.textContent} ${fs}px`);
    }
    return { pequenos, cifras, desborde: document.documentElement.scrollWidth - innerWidth };
  });
  tabla[nombre] = { pares: r.resumen.pares, cumplen: r.resumen.cumplen, minimo: Math.min(...Object.values(r.muestras).map(x => x.minimo)), malos, ...otros };
  if (CAPTURAS) {
    fs.mkdirSync(DIR, { recursive: true });
    if (!/aviso/.test(nombre)) await page.evaluate(() => { const a = document.getElementById('aviso'); if (a) a.hidden = true; });
    await page.screenshot({ path: path.join(DIR, nombre + '.png') });
  }
  expect.soft(malos.map(p => `${nombre}: ${p.tipo} «${p.que}» ${p.fg} sobre ${p.bg}: ${p.r} < ${p.min}`)).toEqual([]);
  if (tactil) expect.soft(otros.pequenos, `${nombre}: zonas táctiles`).toEqual([]);
  expect.soft(otros.cifras, `${nombre}: cifras`).toEqual([]);
  expect.soft(otros.desborde, `${nombre}: desplazamiento horizontal`).toBeLessThanOrEqual(0);
}

const esconder = (page, oculto) => page.evaluate(o => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => o });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (o ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, oculto);
const irPaso = (page, n) => page.click(`.pasos-sesion [data-v="${n}"]`);
const hechas = (page, id, e) => page.evaluate(async ([id, e]) => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[e].sets.filter(z => z.hecha).length, [id, e]);

for (const [ancho, alto] of [[390, 844], [360, 640]]) for (const persona of PERSONAS) {
  test(`recorrido de la sesión de ${persona === 'victor' ? 'Víctor' : 'Virginia'} en ${ancho} × ${alto}: diseño aprobado, contraste AA, toques de 48 px y alarma`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: ancho, height: alto });
    const errores = await preparar(page, context);
    const id = await empezar(page, persona);
    const sufijo = '-' + persona + (ancho === 390 ? '' : '-' + ancho);
    await page.goto('/#sesion/' + id);
    await expect(page.locator('.cab-sesion h1')).toBeVisible();

    // Uno a uno: calentamiento
    await mirar(page, 'sesion-uno-a-uno' + sufijo);
    for (const b of await page.locator('[data-act="sesion.tarea"]').all()) await b.click();
    await page.click('[data-act="sesion.foco"][data-v="1"]');
    // Serie actual arriba, con el selector ± (los kilos suben un paso y la serie pasa a «hecha»)
    await expect(page.locator('[data-actual] [data-principal]')).toBeVisible();
    await mirar(page, 'sesion-serie-actual' + sufijo);
    const kg0 = +(await page.locator('[data-actual] .selector [role="spinbutton"]').first().getAttribute('aria-valuenow'));
    await page.click('[data-actual] .selector [data-paso="1"] >> nth=0');
    const kg1 = +(await page.locator('[data-actual] .selector [role="spinbutton"]').first().getAttribute('aria-valuenow'));
    expect(kg1).toBeGreaterThan(kg0);
    await page.click('[data-actual] [data-principal]');
    // Descanso en la barra; la serie siguiente queda por encima (R09) y los kilos pasaron a la siguiente (R05)
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    const kgSig = +(await page.locator('[data-actual] .selector [role="spinbutton"]').first().getAttribute('aria-valuenow'));
    expect(kgSig).toBe(kg1);
    const r09 = await page.evaluate(() => document.querySelector('#temporizador').getBoundingClientRect().top - document.querySelector('[data-actual]').getBoundingClientRect().bottom);
    expect(r09).toBeGreaterThanOrEqual(0);
    await expect(page.locator('[data-actual] [data-principal]')).toBeFocused();
    await page.clock.runFor(1000);
    await mirar(page, 'descanso-barra' + sufijo);

    // Alarma de fin: tres vibraciones, foco, legible, se cierra sola a los 8 s
    await page.evaluate(() => { window.__vibra = []; });
    const descanso = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos-temporizador')).fases[0].dur);
    await page.clock.runFor(descanso * 1000);
    await expect(page.locator('#temporizador.descanso--alarma')).toBeVisible();
    expect(await page.evaluate(() => window.__vibra)).toEqual([[250, 120, 250, 120, 250]]);
    await expect(page.locator('#temporizador')).toBeFocused();
    await expect(page.locator('#temporizador')).toHaveAttribute('role', 'alert');
    await mirar(page, 'descanso-alarma' + sufijo);
    await page.clock.runFor(8200);
    await expect(page.locator('#temporizador')).toHaveCount(0);
    expect(await page.evaluate(() => window.__vibra.length)).toBe(1); // una sola vez, no repite

    // Vuelta tras bloquear el móvil: el descanso acabó hace 0:40
    await page.clock.runFor(300);
    await page.click('[data-actual] [data-principal]');
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    await esconder(page, true);
    await page.clock.runFor((descanso + 40) * 1000);
    await esconder(page, false);
    await expect(page.locator('#temporizador.descanso--alarma')).toContainText('El descanso terminó hace 0:40');
    await expect(page.locator('#temporizador .descanso-reloj')).toHaveText('−0:40');
    await mirar(page, 'descanso-vuelta-tras-bloquear' + sufijo);
    await page.click('#temporizador [data-t="cerrar"]');
    await expect(page.locator('#temporizador')).toHaveCount(0);
    await expect(page.locator('[data-actual] [data-principal]')).toBeFocused();

    // Toda la sesión
    await page.click('[data-act="sesion.modo"][data-v="lista"]');
    await mirar(page, 'sesion-toda-la-sesion' + sufijo);
    // «Cómo se hace» dentro de la tarjeta, debajo de las series
    const tec = page.locator('.tarjeta--actual details.tecnica').first();
    if (!(await tec.evaluate(d => d.open))) await tec.locator('summary').click();
    await tec.evaluate(d => d.scrollIntoView({ block: 'start' }));
    await mirar(page, 'sesion-como-se-hace' + sufijo);
    await page.evaluate(() => window.scrollTo(0, 0));
    // Menú del ejercicio
    await page.click('.tarjeta--actual [data-act="sesion.menu"]');
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar(page, 'sesion-menu-del-ejercicio' + sufijo);
    // Cambiar con series hechas: lo dice y pide confirmación
    await page.click('.hoja [data-act="sesion.cambiar"]');
    await expect(page.locator('.hoja')).toContainText('se quedan apuntadas');
    await mirar(page, 'sesion-cambiar-ejercicio' + sufijo);
    await page.click('.hoja [data-act="sesion.cambiarPor"] >> nth=0');
    await expect(page.locator('.hoja [data-r="1"]')).toBeVisible();
    await mirar(page, 'sesion-cambiar-confirmar' + sufijo);
    await page.click('.hoja [data-r="0"]');
    await expect(page.locator('.hoja')).toHaveCount(0);

    // Ejercicio por tiempo (uno a uno)
    await page.click('[data-act="sesion.modo"][data-v="foco"]');
    await irPaso(page, 3);
    await mirar(page, 'sesion-serie-por-tiempo' + sufijo);
    await page.click('[data-actual] [data-act="sesion.cuenta"]');
    await expect(page.locator('#temporizador.contador')).toBeVisible();
    await page.clock.runFor((5 + (persona === 'victor' ? 44 : 24)) * 1000);
    await mirar(page, 'sesion-ejercicio-por-tiempo' + sufijo);
    if (persona === 'virginia') { await page.click('#temporizador [data-t="fin"]'); await page.clock.runFor(5000 + 22000); }
    await page.click('#temporizador [data-t="fin"]');
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    await page.click('#temporizador [data-t="fin"]'); // Saltar
    // Con el móvil bloqueado: no apunta solo, pregunta
    await page.clock.runFor(300);
    await page.click('[data-actual] [data-act="sesion.cuenta"]');
    await expect(page.locator('#temporizador.contador')).toBeVisible();
    await esconder(page, true);
    await page.clock.runFor(10 * 60 * 1000);
    await esconder(page, false);
    await expect(page.locator('#temporizador.contador.confirmar')).toBeVisible();
    await mirar(page, 'sesion-tiempo-con-el-movil-bloqueado' + sufijo);
    await page.click('#temporizador [data-t="cancelar"]');
    await expect(page.locator('#temporizador')).toHaveCount(0);

    // Cardio: contador en minutos
    await irPaso(page, 4);
    await page.click('[data-actual] [data-act="sesion.cuenta"]');
    await page.clock.runFor((5 + 200) * 1000);
    await expect(page.locator('#temporizador .contador-estado')).toContainText('min');
    await mirar(page, 'sesion-cardio' + sufijo);
    await page.click('#temporizador [data-t="cancelar"]');

    // Guardar como mía (desde el primer paso)
    await irPaso(page, 0);
    await page.click('[data-act="sesion.guardarMia"]');
    await expect(page.locator('#mia-nombre')).toBeVisible();
    await mirar(page, 'sesion-guardar-como-mia' + sufijo);
    await page.keyboard.press('Escape');
    await expect(page.locator('.hoja')).toHaveCount(0);

    // Terminar con series pendientes: lo dice en el cierre; el dolor parte del último valor conocido
    await page.click('.cab-sesion [data-act="sesion.terminar"]');
    await expect(page.locator('.hoja .aviso-hoja')).toContainText(/Te quedan \d+ series/);
    if (persona === 'virginia') await expect(page.locator('.hoja [data-zona="cadera_lateral"]')).toHaveValue('3');
    await mirar(page, 'sesion-terminar-con-series-pendientes' + sufijo);
    await page.locator('.hoja [data-act="sesion.cerrar"]').scrollIntoViewIfNeeded();
    await mirar(page, 'sesion-cierre' + sufijo);
    await page.click('.hoja #c-esf [data-v="4"]');
    await page.click('.hoja [data-act="sesion.cerrar"]');
    // Final: series, minutos, kilos movidos y mejor serie
    await expect(page.locator('.final')).toBeVisible();
    await expect(page).toHaveURL(/#hoy$/);
    await expect(page.locator('.final')).toContainText('kilos movidos');
    await expect(page.locator('.final .marca')).toContainText('tu mejor serie de hoy');
    await expect(page.locator('#fin-t')).toBeFocused();
    await mirar(page, 'sesion-final' + sufijo);
    await page.click('.final [data-fin-hoy]');
    await expect(page.locator('.final')).toHaveCount(0);
    // Sesión hecha: modo lectura, sin nada que marcar
    await page.goto('/#sesion/' + id);
    await expect(page.locator('.cab-sesion')).toContainText('hecha');
    expect(await page.locator('[data-act="sesion.serie"], [data-act="sesion.tarea"], [data-act="sesion.cuenta"]').count()).toBe(0);
    await mirar(page, 'sesion-hecha-lectura' + sufijo);

    if (CAPTURAS) {
      const f = path.join(DIR, 'contraste.json');
      const todo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
      todo[persona + (ancho === 390 ? '' : '-' + ancho)] = Object.fromEntries(Object.entries(tabla).filter(([k]) => k.endsWith(sufijo)));
      fs.writeFileSync(f, JSON.stringify(todo, null, 1) + '\n');
    }
    expect(errores).toEqual([]);
  });
}

// ── T9 en móviles pequeños ──
for (const [w, alto] of [[360, 640], [320, 568]]) for (const persona of PERSONAS) {
  test(`T9 en ${w} × ${alto} (${persona}): la serie actual se ve sin desplazarse, no la tapa el descanso y todo mide ≥ 48 px`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: alto });
    const errores = await preparar(page, context);
    const id = await empezar(page, persona);
    await page.goto('/#sesion/' + id);
    await irPaso(page, 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    const r03 = await page.evaluate(() => Math.round(innerHeight - document.querySelector('[data-actual]').getBoundingClientRect().bottom));
    console.log(`T9 ${w}×${alto} ${persona}: margen de la serie actual sobre el borde ${r03} px`);
    if (w === 360) expect(r03, 'margen de la serie actual sobre el borde (R03)').toBeGreaterThanOrEqual(0);
    const sufijo = `-${persona}-${w}`;
    await mirar(page, 'sesion-serie-actual' + sufijo);
    await page.click('[data-actual] [data-principal]');
    await expect(page.locator('#temporizador.descanso')).toBeVisible();
    const r09 = await page.evaluate(() => Math.round(document.querySelector('#temporizador').getBoundingClientRect().top - document.querySelector('[data-actual]').getBoundingClientRect().bottom));
    console.log(`T9 ${w}×${alto} ${persona}: margen de la serie actual sobre el descanso ${r09} px`);
    expect(r09, 'margen de la serie actual sobre el descanso (R09)').toBeGreaterThanOrEqual(0);
    await mirar(page, 'descanso-barra' + sufijo);
    expect(errores).toEqual([]);
  });
}

test('doble toque en «Serie 1 hecha»: cuenta como uno', async ({ page, context }) => {
  await preparar(page, context);
  const id = await empezar(page, 'victor');
  await page.goto('/#sesion/' + id);
  await irPaso(page, 1);
  await page.dblclick('[data-actual] [data-principal]');
  await page.clock.runFor(500);
  expect(await hechas(page, id, 0)).toBe(1);
});

test('ejercicio por tiempo: si el máximo se avisó con la pantalla a la vista, ocultar la app un momento no pregunta y apunta los segundos reales', async ({ page, context }) => {
  await preparar(page, context);
  const id = await empezar(page, 'victor');
  await page.goto('/#sesion/' + id);
  await irPaso(page, 3); // plancha 40-60 s
  await page.click('[data-actual] [data-act="sesion.cuenta"]');
  await page.evaluate(() => { window.__vibra = []; });
  await page.clock.runFor((5 + 61) * 1000); // pasa el máximo con la pantalla a la vista: avisa
  expect(await page.evaluate(() => window.__vibra)).toContainEqual([300, 120, 300]);
  await esconder(page, true);
  await page.clock.runFor(3000);
  await esconder(page, false);
  await expect(page.locator('#temporizador.contador.superado')).toBeVisible();
  await expect(page.locator('#temporizador.contador.confirmar')).toHaveCount(0);
  await page.click('#temporizador [data-t="fin"]');
  const v = await page.evaluate(async id => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[2].sets[0].valor, id);
  expect(+v).toBeGreaterThanOrEqual(63);
  expect(+v).toBeLessThanOrEqual(66);
});
