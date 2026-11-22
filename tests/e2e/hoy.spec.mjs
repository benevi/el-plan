// PR 14 · Hoy y check-in en un Chromium de verdad, a 390 × 844, con Víctor y con Virginia:
// - cada estado aprobado de Hoy (con plan, primera vez, sin plan, descanso, en marcha, sesión de ayer sin
//   cerrar, sin conexión, hecha, «Hoy no entrenas», precaución T2 y la nota «La ha hecho la app») y del
//   check-in (antes de empezar, con una de mis sesiones, con zona añadida y alarma, sin conexión, espera de
//   la IA y fallo) se pinta, pasa el contraste AA (medir-contraste.mjs) y no da errores;
// - la tira de la semana dice cada día con texto (no solo color) y el botón de abajo no la tapa (390 × 844,
//   360 × 640 y 320 × 568);
// - el check-in se actualiza en su sitio (no vuelve arriba), el selector ± del dolor funciona con el dedo y con
//   el teclado, y los segmentos con las flechas;
// - «Cerrar la de ayer» abre su cierre y «Descartarla» la borra tras confirmarlo.
// Con CAPTURAS=1 guarda una captura de cada estado en docs/diseno/capturas-pr14/ (escala 2, como el prototipo)
// y la tabla de contraste en docs/diseno/capturas-pr14/contraste.json.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { medirEnPagina } from './medir-contraste.mjs';
import { RAIZ } from './servidor.mjs';

const CAPTURAS = process.env.CAPTURAS === '1';
const DIR = path.join(RAIZ, 'docs/diseno/capturas-pr14');
const SABADO = new Date('2026-11-21T10:00:00+01:00'); // como el prototipo: sábado 21 de noviembre
const LOCALES = ['127.0.0.1', 'localhost'];

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: CAPTURAS ? 2 : 1 });

async function preparar(page, context, { api = 'caida' } = {}) {
  await context.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  if (api === 'caida') await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA en la prueba"}' }));
  await page.clock.setFixedTime(SABADO);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text()); });
  await page.goto('/');
  return errores;
}

// Escenario en la página: persona, perfil, historial, plan de la semana (L, X, V, S, como el prototipo) y lo
// que pida el estado. Todo con las funciones de la app (estado, modelo y entrenador), sin tocar su lógica.
async function escenario(page, persona, e = {}) {
  await expect(page.locator('#vista h1')).toBeVisible();
  if (await page.locator('[data-act="bienvenida.elegir"]').count()) {
    await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
    await expect(page.locator('#nav a')).toHaveCount(4);
  }
  await page.evaluate(async ({ persona, e }) => {
    const est = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const ent = await import('/js/areas/entrenador/entrenador.js');
    const V = persona === 'victor';
    const fecha = n => { const d = new Date(); d.setDate(d.getDate() + n); return est.hoyISO(d); }; // n días desde hoy (sábado)
    const ejs = V ? ['press-pecho-maquina', 'jalon-pecho', 'press-inclinado-maquina', 'plancha'] : ['crunch', 'jalon-pecho', 'flexiones', 'plancha'];
    const sesion = (f, estado, hechas, extra = {}) => {
      const s = m.crearSesion({ fecha: f, nombre: extra.nombre || (V ? 'Empuje y tren superior' : 'Core y espalda'), foco: V ? 'Pecho, hombro y espalda' : 'Core, glúteo y espalda',
        lugar: 'gym', minutos: 60, fuente: extra.fuente || 'ia', explicacion: [V ? 'Subimos 2,5 kg en el press porque el lunes te sobraron dos repeticiones en todas las series.' : 'Tu lumbar está en 3/10: core en estático y tracción sentada, nada que la cargue en flexión.'],
        calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }, { nombre: 'Movilidad', duracion: '2 min' }], vuelta: [{ nombre: 'Estiramientos', duracion: '5 min' }],
        ejercicios: ejs.map(id => ({ id, rol: 'principal', series: 3, reps: id === 'plancha' ? '30-40 s' : '8-12', descanso: 60, kg: id.includes('maquina') || id === 'jalon-pecho' ? 30 : null })), ...(extra.crear || {}) });
      s.estado = estado;
      let n = 0;
      s.ejercicios.forEach(x => x.sets.forEach(z => { if (n < hechas) { z.hecha = true; z.valor = '10'; z.kg = x.kg; n++; } }));
      if (estado !== 'pendiente') s.empezada = f + 'T09:00:00.000Z';
      if (estado === 'hecha') { s.terminada = f + 'T10:00:00.000Z'; s.cierre = { esfuerzo: 4, dolor: {}, comentario: '' }; }
      return s;
    };
    // De un estado al siguiente se empieza de cero (misma persona)
    est.cambiar(S => { S.sesiones = {}; S.plan = null; S.alarmas = []; S.misSesiones = []; S.dolor = []; S.perfil = est.perfilVacio(); }, 'sesion');
    est.cambiar(S => {
      S.perfil.objetivos = e.primera ? [] : V ? ['musculo', 'salud'] : ['salud', 'perder'];
      S.perfil.datos = V ? { sexo: 'h', altura: 180, nacimiento: '1985' } : { sexo: 'm', altura: 165, nacimiento: '1987' };
      S.perfil.lugares = V ? ['gym', 'casa'] : ['gym', 'piscina'];
      S.perfil.disponibilidad = { dias: 4, minutos: 60, diasSemana: [1, 3, 5, 6] };
      S.perfil.usoIA = 'auto';
      if (!V) S.perfil.lesiones = [{ id: 'l1', tipo: 'recurrente', zona: 'lumbar', dolor: 3, desde: '2025-01-01', nota: '', activa: true }];
      S.misSesiones = [{ id: 'm1', nombre: V ? 'Abdominales y flexiones' : 'Core de los martes', lugar: 'gym', minutos: 30, creada: '2026-11-01T10:00:00.000Z',
        ejercicios: [{ id: 'crunch', rol: 'principal', series: 3, reps: '15', descanso: 45 }, { id: 'flexiones', rol: 'principal', series: 3, reps: '10', descanso: 60 }] }];
      // Historial: semanas anteriores con sesiones hechas (constancia y racha)
      for (let k = 1; k <= 8; k++) { const s = sesion(fecha(-7 * k), 'hecha', 12, { fuente: 'reglas' }); S.sesiones[s.id] = s; }
    }, 'sesion');
    if (e.primera) return;
    if (e.plan !== false) {
      const S = est.estado();
      const dias = e.descanso ? [1, 3, 5, 7] : [1, 3, 5, 6];
      const plan = ent.planReglas(S, { dias, minutos: 60, lugares: S.perfil.lugares }, { hechas: [] });
      plan.fuente = e.planIA ? 'ia' : 'reglas';
      est.cambiar(S2 => {
        S2.plan = plan;
        // Lunes y miércoles hechos (V es «no hecho» en el prototipo)
        for (const n of [-5, -3]) { const s = sesion(fecha(n), 'hecha', 12, { nombre: n === -5 ? 'Torso' : 'Pierna' }); S2.sesiones[s.id] = s; }
        if (e.noPuedo) S2.plan.noPuedo = [6];
      }, 'plan');
    }
    est.cambiar(S => {
      if (e.marcha) { const s = sesion(fecha(0), 'en_curso', 5); S.sesiones[s.id] = s; }
      if (e.hecha) { const s = sesion(fecha(0), 'hecha', 12); S.sesiones[s.id] = s; }
      if (e.ayer) { const s = sesion(fecha(-1), 'en_curso', 6, { nombre: V ? 'Cuerpo completo, extra' : 'Core y movilidad, extra' }); s.id = 'ayer'; S.sesiones.ayer = s; }
      if (e.fallo) { const s = sesion(fecha(0), 'pendiente', 0, { fuente: 'reglas', crear: { iaFallo: { motivo: 'el entrenador IA no respondió a tiempo (más de 90 segundos)', peticion: '', diaPlan: 6, reintentable: true } } }); S.sesiones[s.id] = s; }
      if (e.precaucion) S.alarmas = [{ fecha: est.hoyISO(), respuesta: 'si', frase: '' }];
    }, 'sesion');
  }, { persona, e });
  await page.evaluate(() => { location.hash = '#progreso'; });
  await page.evaluate(() => { location.hash = '#hoy'; });
  await expect(page.locator('#vista h1')).toContainText('Hola');
}

async function capturar(page, nombre) {
  if (!CAPTURAS) return;
  fs.mkdirSync(DIR, { recursive: true });
  await page.evaluate(() => { const a = document.getElementById('aviso'); if (a) a.hidden = true; });
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(DIR, nombre + '.png') });
}
const tabla = {};
async function mirar(page, nombre, persona) {
  await page.waitForTimeout(60);
  const r = await page.evaluate(medirEnPagina, 'body');
  const malos = Object.values(r.muestras).flatMap(x => x.detalle).filter(p => !p.ok);
  (tabla[persona] = tabla[persona] || {})[nombre] = { pares: r.resumen.pares, cumplen: r.resumen.cumplen, minimo: Math.min(...Object.values(r.muestras).map(x => x.minimo)), malos };
  await capturar(page, `${nombre}-${persona}`);
  expect(malos.map(p => `${nombre}: ${p.tipo} «${p.que}» ${p.fg} sobre ${p.bg}: ${p.r} < ${p.min}`)).toEqual([]);
}
test.afterAll(() => {
  if (!CAPTURAS) return;
  const f = path.join(DIR, 'contraste.json');
  const todo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  fs.writeFileSync(f, JSON.stringify({ ...todo, ...tabla }, null, 1) + '\n');
});

const HOY = [
  ['hoy-con-plan', {}],
  ['hoy-primera-vez', { primera: true }],
  ['hoy-sin-plan-esta-semana', { plan: false }],
  ['hoy-dia-de-descanso', { descanso: true }],
  ['hoy-sesion-en-marcha', { marcha: true }],
  ['hoy-sesion-de-ayer-sin-cerrar', { ayer: true }],
  ['hoy-sesion-hecha', { hecha: true }],
  ['hoy-hoy-no-entrenas', { noPuedo: true }],
  ['hoy-precaucion', { precaucion: true }],
  ['hoy-la-ha-hecho-la-app', { fallo: true }],
];

for (const persona of ['victor', 'virginia']) {
  test(`Hoy: cada estado aprobado de ${persona === 'victor' ? 'Víctor' : 'Virginia'}, con contraste AA`, async ({ page, context }) => {
    test.setTimeout(120_000);
    const errores = await preparar(page, context);
    for (const [nombre, e] of HOY) {
      await escenario(page, persona, e);
      const vista = page.locator('#vista');
      if (nombre === 'hoy-con-plan') {
        await expect(vista).toContainText('Hoy toca');
        await expect(page.locator('.accion-hoy [data-act="entrenador.prepararHoy"]')).toHaveText('Empezar');
        await expect(page.locator('.accion-hoy')).toContainText('Antes te pregunto cómo estás y lo ajusto.');
      }
      if (nombre === 'hoy-primera-vez') await expect(page.locator('.accion-hoy a[href="#perfil"]')).toHaveText('Completar mi perfil');
      if (nombre === 'hoy-sin-plan-esta-semana') { await expect(page.locator('.accion-hoy [data-act="entrenador.plan"]')).toHaveText('Montar mi semana'); await expect(vista).toContainText('La última vez: lunes, miércoles, viernes y sábado.'); }
      if (nombre === 'hoy-dia-de-descanso') { await expect(vista).toContainText('Descansar también es entrenar'); await expect(page.locator('.accion-hoy')).toHaveCount(0); }
      if (nombre === 'hoy-sesion-en-marcha') { await expect(page.locator('.accion-hoy a')).toHaveText('Seguir con la sesión'); await expect(vista).toContainText(/5 de \d+ series/); }
      if (nombre === 'hoy-sesion-de-ayer-sin-cerrar') { await expect(page.locator('.sin-cerrar')).toContainText('La sesión de ayer está sin cerrar'); await expect(page.locator('.sin-cerrar')).toContainText(/6 de \d+ series/); }
      if (nombre === 'hoy-sesion-hecha') await expect(vista).toContainText('Hecha');
      if (nombre === 'hoy-hoy-no-entrenas') await expect(vista).toContainText('Hoy no entrenas');
      if (nombre === 'hoy-precaucion') { await expect(vista).toContainText('Sin entrenar por precaución'); await expect(page.locator('#vista [data-act="entrenador.deshacerAlarma"]')).toBeVisible(); }
      if (nombre === 'hoy-la-ha-hecho-la-app') { await expect(page.locator('.nota-fallo')).toContainText('La ha hecho la app porque el entrenador IA no respondió a tiempo'); await expect(page.locator('.nota-fallo [data-act="entrenador.reintentarIA"]')).toBeVisible(); }
      await mirar(page, nombre, persona);
    }
    // Sin conexión (con plan)
    await escenario(page, persona, {});
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('.sin-red')).toContainText('Tu sesión de hoy funciona entera');
    await mirar(page, 'hoy-sin-conexion', persona);
    // Check-in sin conexión: lo dice y no ofrece «Pedírsela igualmente»
    await page.click('.accion-hoy [data-act="entrenador.prepararHoy"]');
    await expect(page.locator('.hoja.checkin-pantalla')).toBeVisible();
    await expect(page.locator('.ci-red')).toContainText('Sin conexión');
    await expect(page.locator('[data-cambio="entrenador.ciIA"]')).toHaveCount(0);
    await mirar(page, 'check-in-sin-conexion', persona);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.ci-red')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test(`check-in de ${persona === 'victor' ? 'Víctor' : 'Virginia'}: en su sitio, selector ±, mis sesiones, alarma, espera de la IA y fallo`, async ({ page, context }) => {
    test.setTimeout(90_000);
    // La IA no contesta: la espera se queda hasta «Cancelar y hacerla con la app».
    await context.route('**/api/**', () => { /* colgada */ });
    const errores = await preparar(page, context, { api: 'colgada' });
    await escenario(page, persona, {});
    await page.click('.accion-hoy [data-act="entrenador.prepararHoy"]');
    const hoja = page.locator('.hoja.checkin-pantalla');
    await expect(hoja).toBeVisible();
    // A pantalla completa, con la flecha atrás y la acción fija abajo
    const caja = await hoja.boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(840);
    await expect(page.locator('.checkin-pantalla .hoja-cab [data-cerrar-hoja]')).toHaveAttribute('aria-label', 'Volver a Hoy');
    await mirar(page, 'check-in-antes-de-empezar', persona);

    // En su sitio: bajar, tocar Energía 4 y Tiempo 45; no vuelve arriba
    await hoja.evaluate(h => { h.scrollTop = 260; });
    await page.click('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="4"]');
    await expect(page.locator('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="4"]')).toHaveAttribute('aria-checked', 'true');
    expect(await hoja.evaluate(h => h.scrollTop)).toBe(260);
    // Flechas en el segmento: de 4 a 5
    await page.focus('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="4"]');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="5"]')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => page.evaluate(() => document.activeElement.dataset.v)).toBe('5');
    await expect(page.locator('.hoja .grupo-et b')).toContainText('A tope');

    // «¿Te duele algo más?»: añadir rodilla, subirla con +, bajarla con las flechas, y quitarla
    await page.click('.hoja [data-act="entrenador.ciZona"][data-v="rodilla"]');
    await expect(page.locator('#ci-rodilla')).toHaveText('3');
    await page.click('.hoja [data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]');
    await expect(page.locator('#ci-rodilla')).toHaveText('4');
    await page.focus('#ci-r-rodilla');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#ci-rodilla')).toHaveText('3');
    await expect(page.locator('.hoja .previa')).toContainText('rodilla');
    await mirar(page, 'check-in-dolor-nuevo', persona);
    // 7 o más se confirma
    for (let i = 0; i < 4; i++) await page.click('.hoja [data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]');
    await expect(page.locator('.hoja')).toContainText('¿Hoy de verdad 7 o más?');
    await page.click('.hoja [data-r="0"]');
    await expect(page.locator('#ci-rodilla')).toHaveText('6');
    await page.click('.hoja [data-act="entrenador.ciQuitarZona"][data-v="rodilla"]');
    await expect(page.locator('#ci-rodilla')).toHaveCount(0);

    // Mis sesiones: «Cuenta como el día…» y vuelta a la del plan
    await page.click('.hoja [data-act="entrenador.ciMia"][data-v="m1"]');
    await expect(page.locator('.hoja .casilla')).toContainText(['Cuenta como el día']);
    await page.click('.hoja label.casilla:has([data-cambio="entrenador.ciOcupar"])');
    await expect(page.locator('.hoja .ci-intro')).toContainText('que cuenta como el día');
    await mirar(page, 'check-in-mis-sesiones', persona);
    await page.click('.hoja [data-act="entrenador.ciMia"][data-v=""]');

    // Señales de alarma: lista corta a la vista; la casilla cambia el botón
    await expect(page.locator('.alarma-ci .señales-cortas')).toBeVisible();
    await page.click('.hoja label.casilla:has([data-cambio="entrenador.ciAlarma"])');
    await expect(page.locator('.hoja [data-act="entrenador.crearHoy"]')).toHaveText('Hoy no entreno');
    await mirar(page, 'check-in-senales-de-alarma', persona);
    await page.click('.hoja label.casilla:has([data-cambio="entrenador.ciAlarma"])');

    // «Pedírsela igualmente» (sin cambios que pidan la IA) y la espera
    const forzar = page.locator('.hoja label.casilla:has([data-cambio="entrenador.ciIA"])');
    await expect(forzar).toBeVisible();
    await forzar.click();
    await page.click('.hoja [data-act="entrenador.crearHoy"]');
    const espera = page.locator('.hoja.espera');
    await expect(espera).toBeVisible();
    await expect(page.locator('#espera-pasos li')).toHaveCount(3);
    await expect(page.locator('#espera-pasos li.ahora')).toContainText('Conectando');
    await page.clock.runFor(14_000).catch(() => {});
    await mirar(page, 'check-in-espera-de-la-ia', persona);
    await page.click('.hoja [data-act="entrenador.cancelarIA"]');
    await expect(page).toHaveURL(/#sesion\//);
    await expect(page.locator('.nota-fallo')).toContainText('La ha hecho la app porque cancelaste la espera.');
    await mirar(page, 'check-in-fallo-de-la-ia', persona);
    await page.goto('/#hoy');
    await expect(page.locator('.hoy-tarjeta .nota-fallo [data-act="entrenador.reintentarIA"]')).toBeVisible();
    expect(errores).toEqual([]);
  });
}

test('la tira de la semana se lee sin color y el botón de abajo no la tapa (390 × 844, 360 × 640 y 320 × 568)', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await escenario(page, 'virginia', {});
  const etiquetas = await page.locator('.semana .dia-c').evaluateAll(l => l.map(x => x.getAttribute('aria-label')));
  expect(etiquetas).toHaveLength(7);
  expect(etiquetas[0]).toMatch(/^Lunes 16: .+, hecho$/);
  expect(etiquetas[4]).toMatch(/^Viernes 20: .+, no hecho$/);
  expect(etiquetas[5]).toMatch(/^Sábado 21: hoy, /);
  expect(etiquetas[6]).toBe('Domingo 22: descanso');
  // Hecho con ✓ y no hecho con ×: icono, no solo color
  await expect(page.locator('.semana .dia--hecha .dia-c svg')).toHaveCount(2);
  await expect(page.locator('.semana .dia--perdida .dia-c svg')).toHaveCount(1);
  for (const [w, h] of [[390, 844], [360, 640], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    const tira = await page.locator('.semana').boundingBox();
    const barra = await page.locator('.accion-hoy').boundingBox();
    expect(tira.y + tira.height, `${w} × ${h}`).toBeLessThan(barra.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    // Al final de la página, lo último no queda debajo de la barra
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const ultimo = await page.locator('#vista > :not(.accion-hoy)').last().boundingBox();
    const barra2 = await page.locator('.accion-hoy').boundingBox();
    expect(ultimo.y + ultimo.height, `${w} × ${h}: lo último tapado`).toBeLessThanOrEqual(barra2.y + 1);
  }
  // Con la barra de descanso, el aviso de versión nueva o los dos: lo último sigue a la vista y los avisos
  // (#aviso y el de versión) van por encima de la barra de Hoy (revisión del PR #41).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => {
    const v = document.createElement('div'); v.id = 'aviso-version'; v.className = 'aviso-version'; v.hidden = true;
    v.innerHTML = '<span>Hay una versión nueva.</span><button class="btn" type="button">Actualizar</button>';
    document.body.append(v);
  });
  for (const clases of [['con-temporizador'], ['con-aviso-version'], ['con-temporizador', 'con-aviso-version']]) {
    // Descanso de verdad (la barra del temporizador) y el aviso de versión como lo pone version.js
    await page.evaluate(async c => {
      const t = await import('/js/areas/sesion/temporizador.js');
      if (c.includes('con-temporizador')) t.descanso(120); else t.parar();
      document.body.classList.toggle('con-aviso-version', c.includes('con-aviso-version'));
      document.getElementById('aviso-version').hidden = !c.includes('con-aviso-version');
    }, clases);
    if (clases.includes('con-temporizador')) { await expect(page.locator('#temporizador')).toBeVisible(); await expect(page.locator('body')).toHaveClass(/con-temporizador/); }
    await page.evaluate(async () => (await import('/js/nucleo/ui.js')).aviso('Medidas guardadas'));
    await page.waitForTimeout(50);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const barra = await page.locator('.accion-hoy').boundingBox();
    const ultimo = await page.locator('#vista > :not(.accion-hoy)').last().boundingBox();
    let techo = barra.y;
    if (clases.includes('con-temporizador')) {
      const tmp = await page.locator('#temporizador').boundingBox();
      expect(barra.y + barra.height, `${clases}: la barra de Hoy encima del descanso`).toBeLessThanOrEqual(tmp.y + 1);
    }
    if (clases.includes('con-aviso-version')) {
      const ver = await page.locator('#aviso-version').boundingBox();
      expect(ver.y + ver.height, `${clases}: el aviso de versión bajo la barra`).toBeLessThanOrEqual(barra.y + 1);
      techo = Math.min(techo, ver.y);
    }
    expect(ultimo.y + ultimo.height, `${clases}: lo último tapado`).toBeLessThanOrEqual(techo + 1);
    const av = await page.locator('#aviso').boundingBox();
    expect(av.y + av.height, `${clases}: #aviso bajo la barra`).toBeLessThanOrEqual(barra.y + 1);
  }
  expect(errores).toEqual([]);
});

// U2 (re-auditoría): los días L-D de «Tu semana» / «Cambiar días» y de «Hoy no puedo → Reorganizar» miden ≥ 44 × 44 px
// (T9) en los tres tamaños, sin desplazamiento lateral.
test('días de la semana de las hojas «Tu semana» y «Reorganizar»: ≥ 44 × 44 px a 390, 360 y 320', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await escenario(page, 'victor', {});
  const medir = () => page.locator('.hoja .chips.dias .chip').evaluateAll(l => l.map(x => { const r = x.getBoundingClientRect(); return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, dentro: r.left >= 0 && r.right <= innerWidth }; }));
  for (const [w, h] of [[390, 844], [360, 640], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const act of ['entrenador.plan', 'entrenador.hoyNo']) {
      await page.locator(`#vista [data-act="${act}"]`).first().click();
      await expect(page.locator('.hoja .chips.dias .chip')).toHaveCount(7);
      const dias = await medir();
      for (const [i, d] of dias.entries()) {
        expect(d.w, `${act} a ${w} px: ancho del día ${i + 1}`).toBeGreaterThanOrEqual(44);
        expect(d.h, `${act} a ${w} px: alto del día ${i + 1}`).toBeGreaterThanOrEqual(44);
        expect(d.dentro, `${act} a ${w} px: el día ${i + 1} se sale`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      await page.click('.hoja [data-cerrar-hoja]');
      await expect(page.locator('.hoja-fondo')).toHaveCount(0);
    }
  }
  expect(errores).toEqual([]);
});

test('sesión de ayer sin cerrar: «Cerrar la de ayer» abre su cierre y «Descartarla» la borra tras confirmarlo', async ({ page, context }) => {
  const errores = await preparar(page, context);
  await escenario(page, 'victor', { ayer: true });
  await page.click('.sin-cerrar [data-act="hoy.cerrarAnterior"]');
  await expect(page).toHaveURL(/#sesion\/ayer$/);
  await expect(page.locator('.hoja [data-act="sesion.cerrar"]')).toBeVisible();
  await page.click('.hoja [data-act="sesion.cerrar"]');
  await expect(page).toHaveURL(/#hoy$/);
  await expect(page.locator('.sin-cerrar')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/js/nucleo/estado.js')).estado().sesiones.ayer.estado)).toBe('hecha');

  await escenario(page, 'victor', { ayer: true });
  await page.click('.sin-cerrar [data-act="hoy.descartarAnterior"]');
  await expect(page.locator('.hoja')).toContainText('la sesión de ayer');
  await page.click('.hoja [data-r="1"]');
  await expect(page.locator('.sin-cerrar')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/js/nucleo/estado.js')).estado().sesiones.ayer)).toBeUndefined();
  expect(errores).toEqual([]);
});
