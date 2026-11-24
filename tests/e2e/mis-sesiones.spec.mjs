// «Mis sesiones» en un Chromium de verdad: se hace una sesión de abdominales y flexiones, se guarda como mía
// y al día siguiente se repite desde el check-in (sin IA), con calentamiento, cardio y estiramientos.
// Decisiones de Víctor del 24-11-2026: crear una desde Hoy › Mis sesiones y empezarla; ejercicio suelto desde la
// ficha (C-SUELTO-1 a 5) con un descanso y su alarma (visual y vibración), terminarlo y verlo en la ficha y en
// Progreso; y el bloqueo por zona dolorida.
import { test, expect } from '@playwright/test';

const LOCALES = ['127.0.0.1', 'localhost'];
async function sinFuentesExternas(context) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
}
const DIA1 = new Date('2026-11-18T18:00:00+01:00'); // miércoles
const DIA2 = new Date('2026-11-19T18:00:00+01:00'); // jueves

test('guardar una sesión de abdominales y flexiones y repetirla otro día', async ({ page, context }) => {
  await sinFuentesExternas(context);
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  let llamadasIA = 0;
  await context.route('**/api/**', r => { llamadasIA++; return r.fulfill({ status: 500, body: '{}' }); });
  await page.clock.setFixedTime(DIA1);

  // Perfil: salud, intermedio (las flexiones son de nivel 2), solo en casa.
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.objetivo"][data-v="salud"]');
  await page.click('[data-act="perfil.nivel"][data-v="2"]');
  await page.uncheck('[data-cambio="perfil.nivelAuto"]');
  await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
  await page.click('[data-act="perfil.lugar"][data-v="casa"]');
  await page.click('[data-act="perfil.lugar"][data-v="gym"]');
  await page.click('[data-act="perfil.lugar"][data-v="piscina"]');
  // «Mis sesiones» está en Hoy (24-11-2026): sin ninguna, «Crear una sesión».
  await page.goto('/#hoy');
  await expect(page.locator('.mis-sesiones-hoy')).toContainText('Crear una sesión');

  // La sesión de hoy: abdominales y flexiones (la monta la propia app con su modelo, como si la hubiera cambiado).
  const id = await page.evaluate(async () => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const s = m.crearSesion({ nombre: 'Core y pecho', lugar: 'casa', minutos: 45, fuente: 'reglas',
      calentamiento: [{ nombre: 'Marcha en el sitio', duracion: '3 min' }, { nombre: 'Movilidad', duracion: '3 min' }],
      vuelta: [{ nombre: 'Estiramiento de pectoral', duracion: '1 min' }, { nombre: 'Respiración', duracion: '1 min' }],
      ejercicios: [
        { id: 'flexiones', rol: 'principal', series: 3, reps: '8-12', descanso: 60 },
        { id: 'crunch', rol: 'principal', series: 3, reps: '15-20', descanso: 45 },
        { id: 'plancha', rol: 'principal', series: 3, reps: '30-45s', descanso: 45 },
      ] });
    e.cambiar(S => { S.sesiones[s.id] = s; }, 'sesion');
    return s.id;
  });

  // La hace (una serie basta) y la cierra.
  await page.goto('/#sesion/' + id);
  await page.click('[data-act="sesion.modo"][data-v="lista"]');
  await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]');
  await page.click('[data-act="sesion.terminar"] >> nth=0');
  await page.click('[data-act="sesion.cerrar"]');
  await expect(page).toHaveURL(/#hoy$/);

  // Desde la sesión terminada: «Guardar como mía».
  await page.goto('/#sesion/' + id);
  await page.click('[data-act="sesion.guardarMia"]');
  await page.fill('#mia-nombre', 'Abdominales y flexiones');
  await page.click('[data-act="sesion.guardarMiaOk"]');
  await expect(page.locator('#aviso')).toContainText('Guardada en tus sesiones: «Abdominales y flexiones»');
  // Se guarda en el móvil (el guardado espera un instante).
  const leer = () => page.evaluate(() => JSON.parse(localStorage.getItem('pipos4')));
  await expect.poll(async () => ((await leer()).misSesiones || []).length).toBe(1);
  const mias = (await leer()).misSesiones;
  expect(mias[0].ejercicios.map(x => x.id)).toEqual(['flexiones', 'crunch', 'plancha']);
  expect(mias[0].ejercicios.every(x => !('kg' in x))).toBe(true);
  await page.goto('/#hoy');
  await expect(page.locator('.mis-sesiones-hoy')).toContainText('Abdominales y flexiones');

  // Otro día: Hoy ofrece hacer una de mis sesiones; el check-in la trae elegida y la prepara sin IA.
  await page.clock.setFixedTime(DIA2);
  await page.goto('/#hoy');
  await page.reload();
  await page.click('[data-act="entrenador.prepararMia"]');
  await expect(page.locator('.hoja.checkin')).toContainText('Haces Abdominales y flexiones');
  await expect(page.locator('[data-act="entrenador.ciMia"][aria-pressed="true"]')).toHaveText('Abdominales y flexiones');
  await expect(page.locator('#ci-peticion')).toHaveCount(0);
  await page.click('[data-act="entrenador.crearHoy"]');
  await expect(page).toHaveURL(/#sesion\//);
  await expect(page.locator('.cab-sesion h1')).toHaveText('Abdominales y flexiones');
  await expect(page.locator('#vista')).toContainText('De tus sesiones: «Abdominales y flexiones»');

  await expect.poll(async () => Object.values((await leer()).sesiones).some(x => x.fecha === '2026-11-19')).toBe(true);
  const s = Object.values((await leer()).sesiones).find(x => x.fecha === '2026-11-19');
  expect(s.origen).toEqual({ tipo: 'mia', id: mias[0].id });
  for (const e of ['flexiones', 'crunch', 'plancha']) expect(s.ejercicios.map(x => x.id)).toContain(e);
  expect(s.ejercicios.some(x => x.rol === 'cardio')).toBe(true);
  expect(s.calentamiento.length).toBeGreaterThanOrEqual(2);
  expect(s.vuelta.some(t => /estir|postura/i.test(t.nombre))).toBe(true);
  expect(s.explicacion[0]).toMatch(/Tu sesión «Abdominales y flexiones»/);
  expect(llamadasIA).toBe(0);

  // En Hoy se ve como tu sesión.
  await page.goto('/#hoy');
  await expect(page.locator('#vista')).toContainText('tu sesión, ajustada por la app');
  expect(errores).toEqual([]);
});

// ── Decisiones del 24-11-2026 ──
const HOY = new Date('2026-11-18T18:00:00+01:00'); // miércoles
async function preparar(page, context, perfil = {}) {
  await sinFuentesExternas(context);
  let ia = 0;
  await context.route('**/api/**', r => { ia++; return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__vibra = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibra.push(p); return true; } });
  });
  await page.clock.install({ time: HOY });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  await page.evaluate(async perfil => {
    const e = await import('/js/nucleo/estado.js');
    e.cambiar(S => { Object.assign(S.perfil, { objetivos: ['musculo'], nivel: 2, nivelAuto: false, lugares: ['gym'], usoIA: 'ahorro' }, perfil); }, 'perfil');
  }, perfil);
  return { errores, ia: () => ia };
}
const leerDatos = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/js/nucleo/estado.js')).estado())));

test('Hoy › Mis sesiones: crear una desde Hoy y empezarla (por el check-in, sin IA)', async ({ page, context }) => {
  const { errores, ia } = await preparar(page, context);
  await page.goto('/#hoy');
  await expect(page.locator('.mis-sesiones-hoy')).toContainText('Elige tú los ejercicios');
  await page.click('.mis-sesiones-hoy [data-act="hoy.crearMia"]');
  await expect(page).toHaveURL(/#mia\/nueva$/);
  await expect(page.locator('#nav a[aria-current="page"]')).toHaveAttribute('href', '#hoy');
  await page.fill('#mia-nombre', 'Pecho y espalda');
  await page.click('[data-act="mia.buscar"]');
  for (const [buscar, id] of [['press de pecho', 'press-pecho-maquina'], ['remo', 'remo-maquina']]) {
    await page.fill('#mia-buscar', buscar);
    await page.locator(`.hoja [data-act="mia.anadir"][data-id="${id}"]`).click();
  }
  await page.click('[data-act="mia.listo"]');
  await page.click('[data-act="mia.guardar"]');
  await expect(page).toHaveURL(/#hoy$/);
  await expect(page.locator('.mis-sesiones-hoy')).toContainText('Pecho y espalda');
  const [mia] = (await leerDatos(page)).misSesiones;
  // Empezarla: un toque en ella abre «Antes de empezar» con ella elegida
  await page.click(`.mis-sesiones-hoy [data-act="entrenador.prepararMia"][data-v="${mia.id}"]`);
  await expect(page.locator('.hoja.checkin')).toContainText('Haces Pecho y espalda');
  await page.click('.hoja [data-act="entrenador.crearHoy"]');
  await expect(page).toHaveURL(/#sesion\//);
  await expect(page.locator('#vista')).toContainText('De tus sesiones: «Pecho y espalda»');
  const id = decodeURIComponent(page.url().split('#sesion/')[1]);
  const s = (await leerDatos(page)).sesiones[id];
  expect(s.origen).toEqual({ tipo: 'mia', id: mia.id });
  expect(s.calentamiento.length).toBeGreaterThanOrEqual(2);
  expect(s.ejercicios.some(x => x.rol === 'cardio')).toBe(true);
  expect(ia()).toBe(0);
  expect(errores).toEqual([]);
});

test('ejercicio suelto: «Hacerlo ahora», un descanso con su alarma, terminarlo y verlo en la ficha y en Progreso', async ({ page, context }) => {
  const { errores, ia } = await preparar(page, context);
  await page.goto('/#ejercicios');
  await page.fill('#ej-buscar', 'press de pecho');
  await page.locator('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]').click();
  await expect(page.locator('.hoja .ficha-suelto')).toContainText('Hacerlo ahora');
  await page.click('.hoja [data-act="ejercicios.suelto"]');
  await expect(page).toHaveURL(/#sesion\//);
  const id = decodeURIComponent(page.url().split('#sesion/')[1]);
  await expect(page.locator('.cab-sesion')).toContainText('Ejercicio suelto');
  await expect(page.locator('.tareas-bloque')).toHaveCount(0);
  await expect(page.locator('.modo-sesion')).toHaveCount(0);
  await expect(page.locator('details.tecnica[open] .pasos li').first()).toBeVisible();
  // Kilos con el + y «Serie 1 hecha»: descanso; al acabar, alarma visual (foco, rol alert) y tres vibraciones
  const kg = page.locator('[data-actual] .selector [role="spinbutton"]').first();
  for (let i = 0; i < 8; i++) await page.click('[data-actual] .selector [data-paso="1"] >> nth=0');
  const kilos = +(await kg.getAttribute('aria-valuenow'));
  expect(kilos).toBe(20);
  await page.click('[data-actual] [data-principal]');
  await expect(page.locator('#temporizador.descanso')).toBeVisible();
  const dur = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos-temporizador')).fases[0].dur);
  const s0 = (await leerDatos(page)).sesiones[id];
  expect(dur).toBe(s0.ejercicios[0].descanso);
  await page.evaluate(() => { window.__vibra = []; });
  await page.clock.runFor(dur * 1000);
  await expect(page.locator('#temporizador.descanso--alarma')).toBeVisible();
  await expect(page.locator('#temporizador')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#temporizador')).toBeFocused();
  expect(await page.evaluate(() => window.__vibra)).toEqual([[250, 120, 250, 120, 250]]);
  await page.clock.runFor(8200);
  await expect(page.locator('#temporizador')).toHaveCount(0);
  // Hoy no la toma como la sesión de hoy
  await page.goto('/#hoy');
  await expect(page.locator('.hoy-tarjeta')).not.toContainText('En marcha');
  // Terminar y guardar: vuelve a Ejercicios con «Ejercicio guardado»
  await page.goto('/#sesion/' + id);
  await page.click('#vista [data-act="sesion.terminar"] >> nth=0');
  await expect(page.locator('.hoja [data-act="sesion.cerrar"]')).toHaveText('Guardar ejercicio');
  await page.click('.hoja [data-act="sesion.cerrar"]');
  await expect(page).toHaveURL(/#ejercicios$/);
  await expect(page.locator('.final')).toContainText('Ejercicio guardado');
  await page.click('.final [data-fin-hoy]');
  await expect(page.locator('.final')).toHaveCount(0);
  const d = await leerDatos(page);
  expect(d.sesiones[id].estado).toBe('hecha');
  expect(d.sesiones[id].origen).toEqual({ tipo: 'suelto' });
  expect(d.sesiones[id].ejercicios[0].sets[0]).toEqual(expect.objectContaining({ kg: 20, hecha: true }));
  // La ficha enseña la vez; Progreso, en fuerza y en lo último (como ejercicio suelto); sin constancia
  await page.fill('#ej-buscar', 'press de pecho');
  await page.locator('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]').click();
  await expect(page.locator('.hoja .ultimas')).toContainText('20 kg');
  // Cerrar la hoja vuelve atrás en el historial: se espera a que acabe antes de cambiar de pantalla.
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state && history.state.piposHoja));
  await page.goto('/#progreso');
  await expect(page.locator('#vista')).toContainText('ejercicio suelto');
  await expect(page.locator('[data-act="progreso.ejercicio"][data-id="press-pecho-maquina"]')).toBeVisible();
  await expect(page.locator('#t-c')).toHaveCount(0);
  expect(ia()).toBe(0);
  expect(errores).toEqual([]);
});

test('ejercicio suelto: con el hombro a 5 la ficha dice por qué no y no deja empezarlo', async ({ page, context }) => {
  const { errores } = await preparar(page, context, { lesiones: [{ id: 'l1', zona: 'hombro', dolor: 5, activa: true, desde: '2026-01-01', tipo: 'lesion', nota: '' }] });
  await page.goto('/#ejercicios');
  await page.fill('#ej-buscar', 'press de pecho');
  await page.locator('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]').click();
  await expect(page.locator('.hoja .ficha-suelto-no')).toContainText('Hoy no puedes hacerlo suelto');
  await expect(page.locator('.hoja .ficha-suelto-no')).toContainText('Carga tu hombro');
  await expect(page.locator('.hoja [data-act="ejercicios.suelto"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state && history.state.piposHoja));
  // Uno que no carga el hombro, sí
  await page.fill('#ej-buscar', 'curl femoral sentado');
  await page.locator('[data-act="ejercicios.ficha"][data-id="curl-femoral-sentado"]').click();
  await expect(page.locator('.hoja [data-act="ejercicios.suelto"]')).toBeVisible();
  expect(Object.values((await leerDatos(page)).sesiones).length).toBe(0);
  expect(errores).toEqual([]);
});

