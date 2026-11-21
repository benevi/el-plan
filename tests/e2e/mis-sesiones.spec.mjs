// «Mis sesiones» en un Chromium de verdad: se hace una sesión de abdominales y flexiones, se guarda como mía
// y al día siguiente se repite desde el check-in (sin IA), con calentamiento, cardio y estiramientos.
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
  await expect(page.locator('.mis-sesiones')).toContainText('Al preparar o terminar una sesión');

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
  await page.goto('/#perfil');
  await expect(page.locator('.mis-sesiones')).toContainText('Abdominales y flexiones');

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
