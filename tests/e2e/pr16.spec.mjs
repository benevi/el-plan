// PR 16 en un Chromium de verdad, a 390 × 844: Progreso, Perfil, Ejercicios, bienvenida y el editor de
// «Mis sesiones» (pedido por Víctor).
// - Se crea una sesión de abdominales y flexiones desde el editor (sin IA), se edita, se reordena, se le añade
//   un ejercicio desde su ficha y se hace: pasa por el validador como cualquier mía (C-MIA-1, C-MIA-2).
// - Contraste AA medido con el script del sistema (medir-contraste.mjs) en cada pantalla nueva, Víctor y Virginia.
// Con CAPTURAS=1 guarda una captura de cada pantalla en docs/diseno/capturas-pr16/ (escala 1) y la tabla de
// contraste en docs/diseno/capturas-pr16/contraste.json.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { medirEnPagina } from './medir-contraste.mjs';
import { RAIZ } from './servidor.mjs';

const CAPTURAS = process.env.CAPTURAS === '1';
const DIR = path.join(RAIZ, 'docs/diseno/capturas-pr16');
const HOY = new Date('2026-11-18T18:00:00+01:00'); // miércoles por la tarde
const MAÑANA = new Date('2026-11-19T18:00:00+01:00');
const LOCALES = ['127.0.0.1', 'localhost'];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function preparar(page, context, { reloj = HOY } = {}) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  let llamadasIA = 0;
  await context.route('**/api/**', r => { llamadasIA++; return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }); });
  await page.clock.setFixedTime(reloj);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  return { errores, ia: () => llamadasIA };
}

// Un año de datos realistas (como en rediseno.spec.mjs, más largo): sesiones con kilos, medidas y dolor.
async function sembrar(page, persona, { semanas = 52 } = {}) {
  await page.evaluate(async ({ persona, semanas }) => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return e.hoyISO(d); };
    const V = persona === 'victor';
    const ejercicios = V
      ? [['press-pecho-maquina', 40, '10'], ['jalon-pecho', 45, '10'], ['plancha', null, '40']]
      : [['prensa-piernas', 60, '12'], ['remo-sentado-polea', 30, '12'], ['plancha', null, '30']];
    e.cambiar(S => {
      S.perfil.usoIA = 'ahorro';
      S.perfil.nivel = V ? 2 : 1; S.perfil.nivelAuto = false;
      S.perfil.objetivos = V ? ['musculo', 'salud'] : ['salud', 'perder'];
      S.perfil.lugares = ['gym', 'casa'];
      S.perfil.datos = V ? { sexo: 'h', altura: 180, nacimiento: '1985' } : { sexo: 'm', altura: 165, nacimiento: '1987' };
      S.perfil.gustos = V ? { 'press-pecho-maquina': 'gusta' } : { 'plancha': 'nogusta' };
      if (!V && !S.perfil.lesiones.length) S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'cadera_lateral', dolor: 3, desde: '2025-01-01', nota: 'Trocanteritis', activa: true });
      const n = Math.round(semanas * 7 / 3);
      for (let k = 0; k < n; k++) {
        const fecha = hace(2 + k * 3);
        const s = m.crearSesion({ fecha, nombre: V ? 'Torso' : 'Cuerpo entero', lugar: 'gym', minutos: 50, fuente: 'reglas',
          calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], vuelta: [{ nombre: 'Estiramientos', duracion: '5 min' }],
          ejercicios: ejercicios.map(([id]) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 60 })) });
        s.estado = 'hecha'; s.empezada = fecha + 'T17:00:00.000Z'; s.terminada = fecha + 'T17:50:00.000Z';
        s.cierre = { esfuerzo: 3, dolor: {}, comentario: '' };
        s.ejercicios.forEach((x, i) => x.sets.forEach(st => { st.hecha = true; st.kg = ejercicios[i][1] == null ? null : ejercicios[i][1] + Math.floor((n - 1 - k) / 6) * 2.5; st.valor = ejercicios[i][2]; }));
        S.sesiones[s.id] = s;
      }
      S.medidas = Array.from({ length: 12 }, (_, i) => ({ fecha: hace(i * 28 + 1), peso: V ? 80 + i * 0.4 : 61 + i * 0.3, cintura: V ? 88 + i * 0.4 : 74 + i * 0.3 }));
      if (!V) S.dolor = Array.from({ length: 10 }, (_, i) => ({ fecha: hace(i * 20 + 2), zona: 'cadera_lateral', dolor: Math.min(6, 2 + Math.floor(i / 3)), momento: 'despues' }));
    }, 'sesion');
  }, { persona, semanas });
}

// Las pantallas largas (Progreso con datos, Perfil, el editor) se capturan enteras; las hojas, lo que se ve.
const ENTERAS = /^(progreso-un-ano|progreso-primera-semana|perfil-(objetivos|lesiones|salud|entreno|datos|copias|ajustes|mis-sesiones)|editor-(mia|nueva|editar))/;
async function capturar(page, nombre) {
  if (!CAPTURAS) return;
  fs.mkdirSync(DIR, { recursive: true });
  if (!/aviso/.test(nombre)) await page.evaluate(() => { const a = document.getElementById('aviso'); if (a) a.hidden = true; });
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(DIR, nombre + '.png'), fullPage: ENTERAS.test(nombre) && !(await page.locator('.hoja').count()) });
}
async function escape(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state && history.state.piposHoja));
  await page.waitForTimeout(50);
}
const leer = page => page.evaluate(() => JSON.parse(localStorage.getItem('pipos4')));

// ── El editor de «Mis sesiones» de principio a fin ──
test('editor de Mis sesiones: crear una de abdominales y flexiones, editarla, reordenar, añadir desde la ficha y hacerla', async ({ page, context }) => {
  const { errores, ia } = await preparar(page, context);
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(page.locator('#nav a')).toHaveCount(4);
  // Perfil: salud, intermedio, en casa.
  await page.goto('/#perfil');
  await page.click('[data-act="perfil.objetivo"][data-v="salud"]');
  await page.click('[data-act="perfil.nivel"][data-v="2"]');
  await page.uncheck('[data-cambio="perfil.nivelAuto"]');
  await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
  await page.click('[data-act="perfil.lugar"][data-v="casa"]');
  await page.click('[data-act="perfil.lugar"][data-v="gym"]');
  if (await page.locator('[data-act="perfil.lugar"][data-v="piscina"][aria-pressed="true"]').count()) await page.click('[data-act="perfil.lugar"][data-v="piscina"]');

  // Perfil › Mi entreno › Mis sesiones › Crear sesión
  await page.click('[data-act="perfil.crearMia"]');
  await expect(page).toHaveURL(/#mia\/nueva$/);
  await expect(page.locator('#vista h1')).toHaveText('Nueva sesión');
  await expect(page.locator('#nav a[aria-current="page"]')).toHaveAttribute('href', '#perfil');
  // Guardar sin nada: dice qué falta, junto al campo
  await page.click('[data-act="mia.guardar"]');
  await expect(page.locator('#mia-nombre-error')).toContainText('Ponle un nombre');
  await expect(page.locator('#mia-nombre')).toBeFocused();
  await page.fill('#mia-nombre', 'Abdominales y flexiones');
  await page.click('[data-act="mia.guardar"]');
  await expect(page.locator('#mia-ejs-error')).toContainText('Añade al menos un ejercicio');
  await expect(page.locator('[data-act="mia.lugar"][data-v="casa"]')).toHaveAttribute('aria-checked', 'true');

  // Añadir: buscador y filtros del catálogo
  await page.click('[data-act="mia.buscar"]');
  const hoja = page.locator('.hoja');
  await expect(hoja.locator('h2')).toHaveText('Añadir ejercicios');
  await expect(hoja.locator('[data-act="mia.filtro"][data-k="lugar"][data-v="casa"]')).toHaveAttribute('aria-pressed', 'true');
  await hoja.locator('[data-act="mia.filtro"][data-k="musculo"][data-v="core"]').click();
  await capturar(page, 'editor-buscador-victor');
  await page.fill('#mia-buscar', 'crunch');
  await expect(hoja.locator('[data-act="mia.anadir"]').first()).toContainText('Crunch');
  await hoja.locator('[data-act="mia.anadir"][data-id="crunch"]').click();
  await expect(hoja.locator('[data-act="mia.anadir"][data-id="crunch"]')).toHaveAttribute('aria-disabled', 'true');
  await page.fill('#mia-buscar', 'plancha');
  await hoja.locator('[data-act="mia.anadir"][data-id="plancha"]').click();
  await hoja.locator('[data-act="mia.filtro"][data-k="musculo"][data-v="pecho"]').click();
  await page.fill('#mia-buscar', 'flexiones');
  await hoja.locator('[data-act="mia.anadir"][data-id="flexiones"]').click();
  await expect(hoja.locator('.meta-lista')).toContainText('3 en la sesión');
  await page.click('[data-act="mia.listo"]');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await expect(page.locator('.mia-ej')).toHaveCount(3);
  // Lo que propone la app: intermedio → hasta 4 series; la plancha va por tiempo.
  await expect(page.locator('#mia-plancha-reps-et')).toHaveText('Tiempo');
  await expect(page.locator('#mia-crunch-series')).toHaveAttribute('aria-valuemax', '4');
  await capturar(page, 'editor-nueva-victor');

  // Reordenar: flexiones arriba del todo (con el teclado: Enter sobre «Subir»)
  await page.locator('[data-act="mia.subir"][data-id="flexiones"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-act="mia.subir"][data-id="flexiones"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mia-ej-nombre')).toHaveText(['Flexiones', 'Crunch abdominal', 'Plancha frontal']);
  await expect(page.locator('[data-act="mia.subir"][data-id="flexiones"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#mia-anuncio')).toContainText('Flexiones: puesto 1 de 3');
  // Series de las flexiones: 3 → 4 con la flecha arriba (spinbutton) y no pasa del tope
  const series = page.locator('#mia-flexiones-series');
  await series.focus();
  await page.keyboard.press('End');
  await expect(series).toHaveAttribute('aria-valuenow', '4');
  await page.keyboard.press('ArrowUp');
  await expect(series).toHaveAttribute('aria-valuenow', '4');
  await expect(series).toBeFocused();
  // Descanso del crunch con el botón +
  const antes = +(await page.locator('#mia-crunch-desc').getAttribute('aria-valuenow'));
  await page.click('#mia-crunch-desc ~ .selector-pasos [data-paso="1"]');
  await expect(page.locator('#mia-crunch-desc')).toHaveAttribute('aria-valuenow', String(antes + 15));
  await page.click('[data-act="mia.guardar"]');
  await expect(page).toHaveURL(/#perfil$/);
  await expect(page.locator('#aviso')).toContainText('Guardada en tus sesiones: «Abdominales y flexiones»');
  await expect(page.locator('.mis-sesiones')).toContainText('Abdominales y flexiones');
  await expect(page.locator('.mis-sesiones')).toContainText('1 de 30');
  await expect.poll(async () => ((await leer(page)).misSesiones || []).length).toBe(1);
  let [mia] = (await leer(page)).misSesiones;
  expect(mia.ejercicios.map(x => x.id)).toEqual(['flexiones', 'crunch', 'plancha']);
  expect(mia.ejercicios[0].series).toBe(4);
  expect(mia.ejercicios[1].descanso).toBe(antes + 15);
  expect(Object.keys(mia).sort()).toEqual(['creada', 'ejercicios', 'id', 'lugar', 'minutos', 'nombre']);
  expect(Object.keys(mia.ejercicios[0]).sort()).toEqual(['descanso', 'id', 'reps', 'rol', 'series']);

  // Editar: quitar la plancha, cambiar el nombre y guardar (mismo id)
  await page.click(`[data-act="perfil.editarMia"][data-id="${mia.id}"]`);
  await expect(page.locator('#vista h1')).toHaveText('Editar sesión');
  await page.click('[data-act="mia.quitar"][data-id="plancha"]');
  await expect(page.locator('.mia-ej')).toHaveCount(2);
  await expect(page.locator('[data-act="mia.quitar"][data-id="crunch"]')).toBeFocused();
  await page.fill('#mia-nombre', 'Abdos y flexiones');
  await capturar(page, 'editor-editar-victor');
  await page.click('[data-act="mia.guardar"]');
  await expect(page.locator('#aviso')).toContainText('Cambios guardados en «Abdos y flexiones»');
  await expect.poll(async () => (await leer(page)).misSesiones[0].nombre).toBe('Abdos y flexiones');
  expect((await leer(page)).misSesiones[0].id).toBe(mia.id);

  // Atajo: desde la ficha de un ejercicio, «Añadir a una de mis sesiones»
  await page.goto('/#ejercicios');
  await page.fill('#ej-buscar', 'dead bug');
  await page.locator('[data-act="ejercicios.ficha"][data-id="dead-bug"]').click();
  await page.click('[data-act="ejercicios.aMia"]');
  await expect(page.locator('.hoja h2')).toHaveText('Añadir «Dead bug»');
  await capturar(page, 'ficha-anadir-a-mia-victor');
  await page.click(`[data-act="ejercicios.aMiaOk"][data-mia="${mia.id}"]`);
  await expect(page.locator('#aviso')).toContainText('Añadido a «Abdos y flexiones»');
  await expect.poll(async () => (await leer(page)).misSesiones[0].ejercicios.map(x => x.id)).toEqual(['flexiones', 'crunch', 'dead-bug']);
  // Y crear una nueva desde la ficha: entra en el editor con ese ejercicio
  await page.locator('[data-act="ejercicios.ficha"][data-id="dead-bug"]').click();
  await page.click('[data-act="ejercicios.aMia"]');
  await expect(page.locator(`[data-act="ejercicios.aMiaOk"][data-mia="${mia.id}"]`)).toHaveAttribute('aria-disabled', 'true');
  await page.click('[data-act="ejercicios.aMiaNueva"]');
  await expect(page).toHaveURL(/#mia\/nueva$/);
  await expect(page.locator('.mia-ej-nombre')).toHaveText(['Dead bug']);
  await page.click('[data-act="mia.volver"]');
  await expect(page.locator('.hoja')).toContainText('¿Salir sin guardar los cambios de esta sesión?');
  await page.click('.hoja [data-r="1"]');
  await expect(page).toHaveURL(/#perfil$/);
  await expect(page.locator('[data-act="perfil.grupo"][data-v="entreno"]')).toHaveAttribute('aria-current', 'true');

  // Hacerla otro día: el check-in la trae, sin IA, con calentamiento, cardio y estiramientos.
  await page.clock.setFixedTime(MAÑANA);
  await page.goto('/#hoy');
  await page.reload();
  await page.click('[data-act="entrenador.prepararMia"]');
  await expect(page.locator('.hoja.checkin')).toContainText('Haces Abdos y flexiones');
  await page.click('[data-act="entrenador.crearHoy"]');
  await expect(page).toHaveURL(/#sesion\//);
  await expect(page.locator('#vista')).toContainText('De tus sesiones: «Abdos y flexiones»');
  await expect.poll(async () => Object.values((await leer(page)).sesiones).some(x => x.fecha === '2026-11-19')).toBe(true);
  const s = Object.values((await leer(page)).sesiones).find(x => x.fecha === '2026-11-19');
  expect(s.origen).toEqual({ tipo: 'mia', id: mia.id });
  for (const id of ['flexiones', 'crunch', 'dead-bug']) expect(s.ejercicios.map(x => x.id)).toContain(id);
  expect(s.ejercicios.some(x => x.rol === 'cardio')).toBe(true);
  expect(s.calentamiento.length).toBeGreaterThanOrEqual(2);
  expect(s.vuelta.some(t => /estir|postura/i.test(t.nombre))).toBe(true);
  expect(s.ejercicios.find(x => x.id === 'flexiones').series).toBe(4);
  expect(ia()).toBe(0);
  [mia] = (await leer(page)).misSesiones;
  expect(mia.ejercicios.length).toBe(3);
  expect(errores).toEqual([]);
});

test('Perfil: las siete partes caben sin salirse, con el teclado se cambia de parte y el foco no se pierde', async ({ page, context }) => {
  const { errores } = await preparar(page, context);
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="virginia"]');
  await sembrar(page, 'virginia', { semanas: 4 });
  await page.goto('/#perfil');
  for (const ancho of [390, 360, 320]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    const fuera = await page.evaluate(() => [...document.querySelectorAll('.grupos-perfil .chip')].filter(c => { const r = c.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length);
    expect(fuera, `chips fuera de la vista a ${ancho} px`).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.perfil-resumen')).toHaveText('Salud, movilidad y espalda sana, Perder grasa · principiante · 1 lesión activa');
  // Cambiar de parte con el teclado: el foco se queda en la parte elegida
  await page.locator('[data-act="perfil.grupo"][data-v="entreno"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-act="perfil.grupo"][data-v="entreno"]')).toBeFocused();
  await expect(page.locator('[data-act="perfil.grupo"][data-v="entreno"]')).toHaveAttribute('aria-current', 'true');
  // Minutos por sesión: grupo de opción única con flechas
  const sel = page.locator('[data-act="perfil.minutos"][aria-checked="true"]');
  await sel.focus();
  const v = await sel.getAttribute('data-v');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await leer(page))?.perfil?.disponibilidad?.minutos).not.toBe(+v);
  await expect(page.locator('[data-act="perfil.minutos"][aria-checked="true"]')).toBeFocused();
  // Días por semana: selector ± con flechas
  const dias = page.locator('#p-dias');
  await dias.focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => (await leer(page))?.perfil?.disponibilidad?.dias).toBe(1);
  await expect(page.locator('#p-dias')).toBeFocused();
  await expect(page.locator('#p-dias')).toHaveAttribute('aria-valuetext', '1 día por semana');
  // Ajustes: ayuda del código y versión visible; el aviso de salud de la copia, en Copias (M19)
  await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
  await expect(page.locator('#a-codigo-ayuda')).toContainText('El mismo que te ha dado Víctor');
  await expect(page.locator('[data-version-app]')).not.toHaveText('');
  await page.click('[data-act="perfil.grupo"][data-v="copias"]');
  await expect(page.locator('.aviso-salud')).toContainText('Lleva tus datos de salud');
  expect(errores).toEqual([]);
});

test('zonas táctiles de 44 px o más en Perfil, Ejercicios, Progreso y el editor, también a 320 × 568', async ({ page, context }) => {
  const { errores } = await preparar(page, context);
  await page.goto('/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await sembrar(page, 'victor', { semanas: 8 });
  // (una casilla se toca por su fila entera: se mide la etiqueta .interruptor, no el cuadrito)
  const pequeñas = () => page.evaluate(() => [...document.querySelectorAll('#vista button, #vista a, #vista [role="radio"], #vista input:not([type="checkbox"]), #vista select, #vista label.interruptor, .hoja button, .hoja input')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('.solo-lector, .ver-tabla table') && (r.height < 43.5 || r.width < 43.5); })
    .map(el => `${el.dataset.act || el.tagName} ${el.dataset.v || el.dataset.id || ''} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`));
  for (const [w, hgt] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width: w, height: hgt });
    for (const r of ['#perfil', '#ejercicios', '#progreso']) { await page.goto('/' + r); expect(await pequeñas(), `${r} a ${w} px`).toEqual([]); }
    await page.goto('/#perfil');
    for (const g of ['objetivos', 'entreno', 'datos', 'ajustes']) { await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`); expect(await pequeñas(), `perfil ${g} a ${w} px`).toEqual([]); }
    await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
    await page.click('[data-act="perfil.crearMia"]');
    await page.click('[data-act="mia.buscar"]');
    await page.locator('[data-act="mia.anadir"]').first().click();
    expect(await pequeñas(), `buscador a ${w} px`).toEqual([]);
    await page.click('[data-act="mia.listo"]');
    expect(await pequeñas(), `editor a ${w} px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `sin desplazamiento lateral a ${w} px`).toBe(true);
    await page.click('[data-act="mia.volver"]');
    expect(await pequeñas(), `confirmación a ${w} px`).toEqual([]);
    await page.click('.hoja [data-r="1"]');
    await expect(page).toHaveURL(/#perfil$/);
  }
  expect(errores).toEqual([]);
});

// ── Contraste AA en las pantallas del PR 16, Víctor y Virginia (y capturas con CAPTURAS=1) ──
for (const persona of ['victor', 'virginia']) {
  test(`contraste AA y capturas del PR 16 de ${persona === 'victor' ? 'Víctor' : 'Virginia'}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const { errores } = await preparar(page, context);
    const tabla = {};
    const mirar = async nombre => {
      await page.waitForTimeout(60);
      const r = await page.evaluate(medirEnPagina, 'body');
      const malos = Object.values(r.muestras).flatMap(x => x.detalle).filter(p => !p.ok);
      tabla[nombre] = { pares: r.resumen.pares, cumplen: r.resumen.cumplen, minimo: Math.min(...Object.values(r.muestras).map(x => x.minimo)), malos };
      await capturar(page, `${nombre}-${persona}`);
    };
    await page.goto('/');
    await expect(page.locator('.bienvenida')).toBeVisible();
    await mirar('bienvenida');
    await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
    await expect(page.locator('#nav a')).toHaveCount(4);
    await page.goto('/#progreso');
    await mirar('progreso-vacio');
    // Primera semana: una sola sesión
    await sembrar(page, persona, { semanas: 0.5 });
    await page.goto('/#perfil'); await page.goto('/#progreso');
    await mirar('progreso-primera-semana');
    await sembrar(page, persona, { semanas: 52 });
    await page.goto('/#perfil'); await page.goto('/#progreso');
    await mirar('progreso-un-ano');
    // La burbuja del gráfico con el teclado
    const svg = page.locator('.grafico svg[tabindex="0"]').first();
    await svg.focus();
    await page.keyboard.press('End');
    await expect(page.locator('.burbuja:not([hidden])').first()).toBeVisible();
    await mirar('progreso-burbuja');
    await page.locator('.ver-tabla summary').first().click();
    await mirar('progreso-tabla');
    await page.click('[data-act="progreso.medida"]');
    await mirar('progreso-medidas');
    await escape(page);
    await page.locator('[data-act="progreso.ejercicio"]').first().click();
    await mirar('progreso-ejercicio');
    await escape(page);
    await page.goto('/#perfil');
    for (const g of ['objetivos', 'lesiones', 'salud', 'entreno', 'datos', 'copias', 'ajustes']) {
      await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`);
      await mirar(`perfil-${g}`);
    }
    await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
    await page.locator('[data-act="perfil.lesion"]').last().click();
    await mirar('perfil-lesion');
    await escape(page);
    await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
    await page.click('[data-act="perfil.crearMia"]');
    await page.click('[data-act="mia.buscar"]');
    for (const id of ['flexiones', 'plancha']) {
      await page.fill('#mia-buscar', id === 'plancha' ? 'plancha frontal' : id);
      await page.locator(`.hoja [data-act="mia.filtro"][data-k="lugar"][data-v=""]`).click();
      await page.locator(`[data-act="mia.anadir"][data-id="${id}"]`).click();
    }
    await mirar('editor-buscador');
    await page.click('[data-act="mia.listo"]');
    await page.fill('#mia-nombre', 'Core en casa');
    await mirar('editor-mia');
    await page.click('[data-act="mia.guardar"]');
    await expect(page).toHaveURL(/#perfil$/);
    await mirar('perfil-mis-sesiones');
    await page.goto('/#ejercicios');
    await mirar('ejercicios');
    await page.click('[data-act="ejercicios.filtro"][data-k="lugar"][data-v="piscina"]');
    await page.fill('#ej-buscar', 'zzz');
    await expect(page.locator('[data-act="ejercicios.limpiar"]')).toBeVisible();
    await mirar('ejercicios-sin-resultados');
    await page.click('[data-act="ejercicios.limpiar"]');
    await page.locator('[data-act="ejercicios.ficha"][data-id="plancha"]').click();
    await expect(page.locator('.hoja')).toBeVisible();
    await mirar('ficha');
    await page.click('[data-act="ejercicios.aMia"]');
    await mirar('ficha-anadir-a-mia');
    await escape(page);

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
