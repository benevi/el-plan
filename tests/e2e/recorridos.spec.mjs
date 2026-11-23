// PR 18 · Los recorridos COMPLETOS de Víctor y de Virginia, de principio a fin y en un solo hilo cada uno, en
// un Chromium de verdad a 390 × 844 con la CSP de vercel.json y el service worker:
//   bienvenida → migración desde datos reales de la app anterior (`elplan2`, la forma de main) → perfil
//   (objetivos, nivel, lesión con dolor, días, lugares, material de casa) → semana sin IA → check-in → sesión
//   (calentamiento, series con kilos que pasan a la siguiente, ejercicio por tiempo, cardio, descanso con alarma
//   visual y vibración, vuelta a la calma con estiramientos) → cierre → progreso → ejercicios (ficha, me gusta,
//   no me gusta, no lo quiero) → editor de «Mis sesiones» (una de casa con abdominales y flexiones, y hacerla)
//   → Víctor: la IA (simulada) propone un día y pasa por el validador · Virginia: día de dolor ≥ 7 (D2)
//   → copia a archivo y cargarla en un navegador limpio → modo avión (recargar sin red y entrenar)
//   → versión nueva desplegada: el aviso espera a que acabe la sesión y «Actualizar» no pierde nada.
// En cada paso: lo que dice la pantalla es lo que pasa en los datos, sin errores en la consola ni violaciones de
// CSP, y los criterios de docs/criterio.md que aplican a toda sesión (C-CAL-1, C-CARDIO-1, C-VUELTA-1, C-EST-4,
// C-DOLOR-1, C-DOLOR-4 y el rechazo «No lo quiero»). Reloj fijo con page.clock; /api/** sin IA (503) salvo en
// el paso de la IA, que atiende la función real api/entrenador.js con un cliente de Claude simulado (coste 0).
// Levanta su propio servidor (PUERTO_RECORRIDOS, por defecto PUERTO_SW + 20) con dos «despliegues», vA y vB,
// como sw.spec.mjs.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearServidor, RAIZ } from './servidor.mjs';
import { escribirVersion, leerAPP } from '../../scripts/version.mjs';
import { viejoReal } from '../ayuda/viejo-real.mjs';
import handler from '../../api/entrenador.js';
import { ponerClienteIA, Anthropic } from '../../api/_comun.js';
import { clienteEnVivo, mensaje, delta } from '../api/_simulado.mjs';

const PUERTO = (+process.env.PUERTO_RECORRIDOS || (+process.env.PUERTO_SW || 8783) + 20) + (+process.env.TEST_PARALLEL_INDEX || 0);
const BASE = `http://127.0.0.1:${PUERTO}`;
const LOCALES = ['127.0.0.1', 'localhost'];
// Semana del lunes 16 al domingo 22 de noviembre de 2026, siempre a las 18:00 (Madrid).
const DIA = n => new Date(`2026-11-${String(16 + n).padStart(2, '0')}T18:00:00+01:00`);
const NOMBRE = { victor: 'Víctor', virginia: 'Virginia' };

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, baseURL: BASE });
test.describe.configure({ mode: 'serial' });

// ── Servidor con dos despliegues (vA, vB) y /api en el propio proceso ──
let srv, tmp, vA, vB;
let modoIA = 'caida';
const llamadas = [];
function copiarApp(destino, marca) {
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
  for (const f of [...leerAPP(sw).filter(Boolean), 'sw.js', 'LEEME.md']) {
    fs.mkdirSync(path.dirname(path.join(destino, f)), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, f), path.join(destino, f));
  }
  fs.appendFileSync(path.join(destino, 'js/main.js'), `\ndocument.documentElement.dataset.marca = '${marca}';\n`);
  return escribirVersion(destino).ahora;
}
test.beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pipos-recorridos-'));
  vA = path.join(tmp, 'vA'); vB = path.join(tmp, 'vB');
  copiarApp(vA, 'A'); copiarApp(vB, 'B');
  process.env.APP_CODE = 'secreto'; process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
  srv = crearServidor({ raiz: vA });
  // /api/*: 503 (sin IA) salvo en modo 'ia', donde contesta la función real con la IA simulada.
  srv.control.api = (req, res) => {
    let b = ''; req.on('data', d => { b += d; });
    req.on('end', () => {
      llamadas.push({ url: req.url, modo: modoIA });
      if (modoIA !== 'ia' || !req.url.startsWith('/api/entrenador')) {
        res.writeHead(503, { 'content-type': 'application/json' });
        return res.end('{"error":"sin IA en la prueba"}');
      }
      try { req.body = JSON.parse(b); } catch { req.body = b; }
      res.status = c => { res.statusCode = c; return res; };
      res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
      handler(req, res);
    });
  };
  await srv.escuchar(PUERTO);
});
test.afterAll(async () => {
  ponerClienteIA(null);
  if (srv) await srv.cerrar();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});
test.beforeEach(() => { Object.assign(srv.control, { raiz: vA, porRuta: {}, cortar: [], retrasar: {}, peticiones: [] }); modoIA = 'caida'; llamadas.length = 0; });

// IA simulada: «escribe» la sesión en dos trozos y la devuelve (la función real la sanea y la manda en vivo).
const iaQueDevuelve = sesion => clienteEnVivo(async emitir => {
  emitir({ type: 'message_start', message: {} });
  emitir({ type: 'content_block_start', index: 0, content_block: { type: 'text' } });
  const t = JSON.stringify(sesion);
  emitir(delta(t.slice(0, t.length >> 1))); emitir(delta(t.slice(t.length >> 1)));
  return mensaje(sesion);
}, Anthropic.APIUserAbortError);

// ── Navegador: CSP, consola, vibración y reloj ──
async function abrirContexto(browser, { viejo = null, cuando }) {
  const ctx = await browser.newContext({ ...test.info().project.use, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, baseURL: BASE, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  ctx.setDefaultTimeout(10_000); // contexto propio: sin esto, una acción bloqueada esperaría hasta el final
  await ctx.route(u => !LOCALES.includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  // Lo que dejó en este móvil la app anterior (main): `elplan2`, que nunca se borra.
  if (viejo) await ctx.addInitScript(v => { if (!localStorage.getItem('elplan2')) localStorage.setItem('elplan2', v); }, JSON.stringify(viejo));
  await ctx.addInitScript(() => {
    window.__csp = []; window.__vibra = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI || ''} ${e.sourceFile || ''}:${e.lineNumber || ''}`));
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibra.push(p); return true; } });
  });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: cuando });
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => {
    if ((m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) || /Content Security Policy|Refused to|Permissions-Policy/.test(m.text())) errores.push('console: ' + m.text());
  });
  return { ctx, page, errores };
}
// Al final de cada paso: ni errores ni violaciones de CSP.
async function limpio(page, errores, paso) {
  expect(errores, `${paso}: errores en la consola`).toEqual([]);
  expect(await page.evaluate(() => window.__csp), `${paso}: violaciones de CSP`).toEqual([]);
}
const paso = (nombre, page, errores, fn) => test.step(nombre, async () => { const t0 = Date.now(); await fn(); await limpio(page, errores, nombre); if (process.env.TIEMPOS) console.log(`${nombre}: ${Date.now() - t0} ms`); });

// ── Lectura de los datos (lo que la app tiene en memoria: lo mismo que guarda) ──
const datos = page => page.evaluate(async () => JSON.parse(JSON.stringify((await import('/js/nucleo/estado.js')).estado())));
const guardado = page => page.evaluate(() => JSON.parse(localStorage.getItem('pipos4') || 'null'));
const sesionDe = async (page, id) => (await datos(page)).sesiones[id];
const idEnURL = page => decodeURIComponent(page.url().split('#sesion/')[1] || '');

// Criterios que toda sesión cumple (en la página, con el catálogo de la app). Devuelve la lista de fallos.
// - C-CAL-1/C-CAL-2: calentamiento con 2 tareas o más · C-VUELTA-1: vuelta con 2 tareas o más y al menos un
//   estiramiento · C-CARDIO-1: cardio siempre · C-EST-4: todo lo que tiene id es del lugar, con material, y no
//   «evitar» con el dolor del día (C-DOLOR-0: el de hoy en el check-in; sin check-in, el de la ficha con tope 6)
//   · nunca un ejercicio «No lo quiero» · C-DOLOR-4: con dolor ≥ 7 hoy, ni fuerza ni nada con r en la zona.
// `s` es una sesión o un día del plan.
function criterios(page, s) {
  return page.evaluate(async s => {
    const e = await import('/js/nucleo/estado.js');
    const c = await import('/js/reglas/catalogo.js');
    const S = e.estado(), P = S.perfil;
    const fallos = [];
    const hoy = (s.checkin && s.checkin.dolor) || null;
    const niveles = {};
    for (const l of P.lesiones.filter(x => x.activa)) {
      const d = hoy && hoy[l.zona] != null ? +hoy[l.zona] : Math.min(6, +l.dolor || 0);
      niveles[l.zona] = Math.max(1, c.bandaDe(d));
    }
    for (const [z, v] of Object.entries(hoy || {})) niveles[z] = Math.max(niveles[z] || 0, c.bandaDe(+v));
    if ((s.calentamiento || []).length < 2) fallos.push('calentamiento con menos de 2 tareas');
    if ((s.vuelta || []).length < 2) fallos.push('vuelta a la calma con menos de 2 tareas');
    if (!(s.vuelta || []).some(t => /estir|postura/i.test(t.nombre) || /^estiramiento|postura-nino/.test(t.id || ''))) fallos.push('vuelta a la calma sin estiramientos');
    if (!s.ejercicios.some(x => x.rol === 'cardio')) fallos.push('sin cardio');
    const altas = Object.entries(hoy || {}).filter(([, v]) => +v >= 7).map(([z]) => z);
    for (const x of [...s.ejercicios, ...(s.calentamiento || []).filter(t => t.id), ...(s.vuelta || []).filter(t => t.id)]) {
      const ej = c.ex(x.id);
      if (!ej) { fallos.push(`${x.id}: no está en el catálogo`); continue; }
      if (!ej.l.includes(s.lugar)) fallos.push(`${x.id}: no es de ${s.lugar}`);
      if (!c.hayMaterial(ej, s.lugar, P)) fallos.push(`${x.id}: sin material en ${s.lugar}`);
      if (P.gustos[x.id] === 'rechazo') fallos.push(`${x.id}: «No lo quiero»`);
      if (c.riesgo(ej, niveles) === 'evitar') fallos.push(`${x.id}: carga una zona con dolor (${JSON.stringify(ej.r)})`);
      if (altas.some(z => (ej.r || {})[z])) fallos.push(`${x.id}: con dolor ≥ 7 carga ${altas}`);
      if (x.rol && !(ej.p && ej.p.length)) fallos.push(`${x.id}: sin «Cómo se hace»`);
    }
    if (altas.length && s.ejercicios.some(x => x.rol === 'principal' || x.rol === 'rehab')) fallos.push('con dolor ≥ 7 lleva fuerza o rehabilitación');
    return fallos;
  }, s);
}

// ── Piezas de la interfaz ──
// Deja un grupo de chips (aria-pressed) con exactamente los valores pedidos, marcados en ese orden (el primer
// objetivo es el principal, C-OBJ-1).
async function chips(page, act, quiero, raiz = '') {
  for (const b of await page.locator(`${raiz} [data-act="${act}"]`).all()) {
    if (await b.getAttribute('aria-pressed') === 'true' && !quiero.includes(await b.getAttribute('data-v'))) await b.click();
  }
  for (const v of quiero) {
    const b = page.locator(`${raiz} [data-act="${act}"][data-v="${v}"]`);
    if (await b.getAttribute('aria-pressed') !== 'true') await b.click();
  }
  for (const v of quiero) await expect(page.locator(`${raiz} [data-act="${act}"][data-v="${v}"]`)).toHaveAttribute('aria-pressed', 'true');
}
async function cerrarHojaConEscape(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.hoja')).toHaveCount(0);
  await page.waitForFunction(() => !(history.state && history.state.piposHoja));
}
// Cambia el día (el reloj sigue parado en esa hora) y recarga como quien abre la app al día siguiente.
async function irAlDia(page, n) {
  await page.clock.setSystemTime(DIA(n));
  await page.goto('/#hoy');
  await page.reload();
  await expect(page.locator('#vista h1')).toContainText('Hola');
}
// «Sí» en la hoja de confirmar() de ui.js.
const confirmarSi = async page => { await page.locator('.hoja [data-r="1"]').click(); };

// Hace la sesión abierta en pantalla, uno a uno, como en el gimnasio. Devuelve lo que se ha apuntado.
// - calentamiento: cada tarea; - el primer ejercicio con kilos: todas sus series, subiendo un paso los kilos en
//   la primera (pasan a las siguientes) y dejando que el primer descanso acabe con su alarma (visual, foco,
//   tres vibraciones, se cierra sola); - por tiempo (segundos) y cardio (minutos): el contador entero, con su
//   aviso al llegar al objetivo; - el resto: una serie; - vuelta a la calma: cada estiramiento; - cierre.
async function hacerSesion(page, id, { esfuerzo = 4, comentario = '' } = {}) {
  const s = await sesionDe(page, id);
  await page.goto('/#sesion/' + id);
  await expect(page.locator('.cab-sesion h1')).toHaveText(s.nombre);
  // Cada ejercicio trae su «Cómo se hace» (pasos, errores y consejo) dentro de la tarjeta.
  await page.click('[data-act="sesion.modo"][data-v="lista"]');
  await expect(page.locator('.sesion-ej')).toHaveCount(s.ejercicios.length);
  await expect(page.locator('.sesion-ej details.tecnica')).toHaveCount(s.ejercicios.length);
  for (const d of await page.locator('.sesion-ej details.tecnica').all()) expect(await d.locator('.pasos li').count()).toBeGreaterThan(0);
  await page.click('[data-act="sesion.modo"][data-v="foco"]');
  const pasoN = n => page.click(`.pasos-sesion [data-v="${n}"]`);
  const apuntado = { kg: null, tiempo: null, cardio: null, alarma: false };

  // Calentamiento
  await pasoN(0);
  await expect(page.locator('.tareas-bloque h2')).toHaveText('Calentamiento');
  const tareas = page.locator('[data-act="sesion.tarea"]');
  await expect(tareas).toHaveCount(s.calentamiento.length);
  for (let i = 0; i < s.calentamiento.length; i++) await page.click(`[data-act="sesion.tarea"][data-k="calentamiento"][data-i="${i}"]`);
  await expect(page.locator('.tareas-bloque .bloque-fila .cifra')).toHaveText(`${s.calentamiento.length} de ${s.calentamiento.length}`);

  for (const [i, x] of s.ejercicios.entries()) {
    await pasoN(i + 1);
    await expect(page.locator('.sesion-ej h2')).toBeVisible();
    const porTiempo = await page.locator('[data-actual] [data-act="sesion.cuenta"]').count();
    if (porTiempo) {
      const lados = /c\/lado|por lado/.test(String(x.reps));
      if (lados) { await page.click('[data-actual] [data-act="sesion.serie"]'); await page.clock.runFor(1100); continue; } // apuntar sin contador
      const t = await page.evaluate(([i]) => import('/js/nucleo/estado.js').then(e => e.estado().sesiones[location.hash.split('/')[1]].ejercicios[i]), [i]);
      await page.evaluate(() => { window.__vibra = []; });
      // Reloj parado desde que arranca el contador hasta «Hecho»: con la máquina cargada, el tiempo real que pasa
      // entre pasos se sumaba a lo que mide (46 s en vez de 45, revisión del PR #47). Solo avanza con runFor.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
      await page.click('[data-actual] [data-act="sesion.cuenta"]');
      await expect(page.locator('#temporizador.contador')).toBeVisible();
      const fases = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos-temporizador')).fases);
      const trabajo = fases.find(f => f.f === 'trabajo');
      const previa = fases.filter(f => f.f === 'previa').reduce((a, f) => a + f.dur, 0);
      await page.clock.runFor((previa + trabajo.hi) * 1000 + 300);
      // Al llegar al objetivo avisa (destello y dos vibraciones) y sigue contando hasta «Hecho».
      await expect(page.locator('#temporizador.contador.superado')).toBeVisible();
      expect(await page.evaluate(() => window.__vibra)).toContainEqual([300, 120, 300]);
      await page.click('#temporizador [data-t="fin"]');
      await page.clock.resume();
      const v = (await sesionDe(page, id)).ejercicios[i].sets[0].valor;
      const esperado = trabajo.hi / (/min/.test(t.reps) ? 60 : 1);
      expect(+v, `${x.id}: lo apuntado por el contador`).toBeCloseTo(esperado, 0);
      if (x.rol === 'cardio') apuntado.cardio = +v; else apuntado.tiempo = +v;
      if (await page.locator('#temporizador.descanso').count()) await page.click('#temporizador [data-t="fin"]'); // saltar el descanso
      await expect(page.locator('#temporizador')).toHaveCount(0);
      continue;
    }
    const kgSel = page.locator('[data-actual] .selector [role="spinbutton"]').first();
    if (!apuntado.kg && await page.locator('[data-actual] .selector-et', { hasText: 'Kilos' }).count()) {
      // El primer ejercicio con kilos (haya historial o no: sin él, empieza en lo que proponga la app).
      // Series con kilos: el +, «Serie 1 hecha», descanso con alarma y los kilos pasan a la siguiente.
      const kg0 = +(await kgSel.getAttribute('aria-valuenow'));
      await page.click('[data-actual] .selector [data-paso="1"] >> nth=0');
      const kg1 = +(await kgSel.getAttribute('aria-valuenow'));
      expect(kg1).toBeGreaterThan(kg0);
      for (let j = 0; j < x.series; j++) {
        await expect(page.locator('[data-actual] .serie-cuenta')).toContainText(`Serie ${j + 1} de ${x.series}`);
        expect(+(await kgSel.getAttribute('aria-valuenow')), `serie ${j + 1}: los kilos de la anterior`).toBe(kg1);
        await page.click('[data-actual] [data-principal]');
        if (j === x.series - 1) { await page.clock.runFor(1100); break; } // nada de doble toque con la siguiente
        await expect(page.locator('#temporizador.descanso')).toBeVisible();
        if (j === 0) {
          const dur = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos-temporizador')).fases[0].dur);
          expect(dur).toBe(x.descanso);
          await page.evaluate(() => { window.__vibra = []; });
          await page.clock.runFor(dur * 1000);
          await expect(page.locator('#temporizador.descanso--alarma')).toBeVisible();
          await expect(page.locator('#temporizador')).toHaveAttribute('role', 'alert');
          await expect(page.locator('#temporizador')).toBeFocused();
          expect(await page.evaluate(() => window.__vibra)).toEqual([[250, 120, 250, 120, 250]]);
          await page.clock.runFor(8200);
          await expect(page.locator('#temporizador')).toHaveCount(0);
          apuntado.alarma = true;
        } else {
          await page.click('#temporizador [data-t="fin"]'); // Saltar
        }
        await page.clock.runFor(1100); // nada de doble toque
      }
      const sets = (await sesionDe(page, id)).ejercicios[i].sets;
      expect(sets.map(z => [z.hecha, z.kg])).toEqual(sets.map(() => [true, kg1]));
      apuntado.kg = { id: x.id, kg: kg1 };
    } else {
      await page.click('[data-actual] [data-principal]');
      if (x.series > 1) { await expect(page.locator('#temporizador.descanso')).toBeVisible(); await page.click('#temporizador [data-t="fin"]'); }
      await page.clock.runFor(1100);
      expect((await sesionDe(page, id)).ejercicios[i].sets[0].hecha).toBe(true);
    }
  }

  // Vuelta a la calma con estiramientos
  await pasoN(s.ejercicios.length + 1);
  await expect(page.locator('.tareas-bloque h2')).toHaveText('Vuelta a la calma');
  for (let i = 0; i < s.vuelta.length; i++) await page.click(`[data-act="sesion.tarea"][data-k="vuelta"][data-i="${i}"]`);
  await expect(page.locator('.tareas-bloque .bloque-fila .cifra')).toHaveText(`${s.vuelta.length} de ${s.vuelta.length}`);

  // Cierre: avisa de lo que queda, esfuerzo, comentario y la pantalla final.
  await page.click('.cab-sesion [data-act="sesion.terminar"]');
  await expect(page.locator('.hoja h2')).toHaveText('¿Qué tal ha ido?');
  await page.click(`.hoja #c-esf [data-v="${esfuerzo}"]`);
  await expect(page.locator(`.hoja #c-esf [data-v="${esfuerzo}"]`)).toHaveAttribute('aria-checked', 'true');
  if (comentario) await page.fill('#c-com', comentario);
  await page.locator('.hoja [data-act="sesion.cerrar"]').scrollIntoViewIfNeeded();
  await page.click('.hoja [data-act="sesion.cerrar"]');
  await expect(page.locator('.final')).toBeVisible();
  await expect(page).toHaveURL(/#hoy$/);
  await page.clock.runFor(3000);
  await page.click('.final [data-fin-hoy]');
  await expect(page.locator('.final')).toHaveCount(0);
  const hecha = await sesionDe(page, id);
  expect(hecha.estado).toBe('hecha');
  expect(hecha.cierre.esfuerzo).toBe(esfuerzo);
  if (comentario) expect(hecha.cierre.comentario).toBe(comentario);
  expect(hecha.calentamiento.every(t => t.hecho) && hecha.vuelta.every(t => t.hecho)).toBe(true);
  return apuntado;
}

// Check-in desde Hoy: abre «Antes de empezar» con el botón que haya (Empezar o Entrenar igualmente).
async function abrirCheckin(page) {
  const b = page.locator('#vista [data-act="entrenador.prepararHoy"]').first();
  await b.click();
  await expect(page.locator('.hoja.checkin-pantalla h2')).toHaveText('Antes de empezar');
  // Check-in de un toque (M21, C-CHECK-1): la casilla de alarma a la vista y «Algo ha cambiado» para el completo.
  // Con una ficha a 7 o más, o un dolor de hoy de 7 o más, el completo sale directo (C-DOLOR-0).
  if (await page.locator('.hoja.checkin-toque').count()) {
    await expect(page.locator('.hoja [data-cambio="entrenador.ciAlarma"]')).toBeVisible();
    await expect(page.locator('.hoja [data-act="entrenador.crearHoy"]')).toHaveText('Todo bien, empezar');
    await page.click('.hoja [data-act="entrenador.ciCompleto"]');
    await expect(page.locator('.hoja.checkin-toque')).toHaveCount(0);
  }
}
async function prepararDesdeCheckin(page) {
  await page.click('.hoja [data-act="entrenador.crearHoy"]');
  await expect(page).toHaveURL(/#sesion\//, { timeout: 15000 });
  await expect(page.locator('.hoja')).toHaveCount(0);
  return idEnURL(page);
}

// ── Datos de cada persona ──
const PERFIL = {
  victor: {
    objetivos: ['musculo', 'salud'], nivel: '2', lugares: ['gym', 'casa'], material: ['mancuernas', 'banda'],
    zona: 'rodilla', zonaNombre: 'Rodilla', nota: 'Menisco', dolorFicha: 4, dolorHoy: 4, minutos: '60', dias: ['1', '3', '5'],
    datos: { sexo: 'h', altura: '180' }, nacimiento: '1985',
  },
  virginia: {
    objetivos: ['salud', 'perder'], nivel: '1', lugares: ['gym', 'piscina', 'casa'], material: ['banda', 'comba'],
    zona: 'cadera_lateral', zonaNombre: 'Cadera lateral', nota: 'Trocanteritis', dolorFicha: 8, dolorHoy: 3, minutos: '60', dias: ['1', '3', '5'],
    datos: { sexo: 'm', altura: '165' }, nacimiento: '1987',
  },
};
// Lo que valora cada uno en Ejercicios.
const GUSTOS = {
  victor: { 'press-pecho-maquina': 'rechazo', 'jalon-pecho': 'gusta', 'remo-sentado-polea': 'nogusta' },
  virginia: { 'prensa-piernas': 'rechazo', 'remo-sentado-polea': 'gusta', 'crunch': 'nogusta' },
};
// La sesión que «escribe» la IA para Víctor el miércoles: trae un ejercicio que él no quiere, otro que carga la
// rodilla (dolor 4: B2), ningún cardio ni rehabilitación. El servidor quita lo que el móvil no le ofreció y el
// validador añade lo que falta.
const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, kg = 30) => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg, nota: `Controla la bajada en 3 segundos y para con 2 repeticiones en reserva; empieza con ${kg} kg.` });
const SESION_IA = {
  nombre: 'Torso con máquinas', foco: 'Pecho y espalda', cambios: ['Has pedido máquinas: todo el día en máquina y polea.'],
  explicacion: ['Hoy torso con máquinas, como pediste, sin cargar la rodilla.'],
  calentamiento: [T('Bici suave'), T('Movilidad de hombros con banda', '3 min')],
  ejercicios: [E('press-pecho-maquina', 40), E('jalon-pecho', 45), E('prensa-piernas', 60), E('remo-sentado-polea', 35)],
  vueltaCalma: [T('Estirar pecho en la pared', '1 min'), T('Estiramiento de dorsal', '1 min')],
};

for (const persona of ['victor', 'virginia']) {
  test(`recorrido completo de ${NOMBRE[persona]}: de la app anterior a una versión nueva sin perder nada`, async ({ browser }) => {
    test.setTimeout(150_000);
    const P = PERFIL[persona], V = persona === 'victor';
    const viejo = viejoReal();
    const yo = V ? 'him' : 'her';
    const { ctx, page, errores } = await abrirContexto(browser, { viejo, cuando: DIA(0) });
    const ids = {};

    await paso('bienvenida y migración desde la app anterior', page, errores, async () => {
      await page.goto('/');
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      await expect(page.locator('.bienvenida h1')).toHaveText('Pipos Fitness');
      await expect(page.locator('.bienvenida .avisos-salud p').first()).toBeVisible();
      await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
      const deEllos = Object.values(viejo.workouts).filter(w => w.user === yo);
      await expect(page.locator('#aviso')).toContainText(`He traído ${deEllos.length} sesiones de la app anterior`);
      // Siempre a Hoy (U5): sin objetivos todavía, su tarjeta lleva a Perfil, con el aviso del dolor estimado de lo migrado.
      await expect(page).toHaveURL(/#hoy$/);
      await expect(page.locator('#vista')).toContainText('Cuéntale a tu entrenador quién eres');
      await page.click('#vista a[href="#perfil"]:has-text("Completar mi perfil")');
      await expect(page).toHaveURL(/#perfil$/);
      await expect(page.locator('#nav a')).toHaveCount(4);
      await expect(page.locator('html')).toHaveAttribute('data-persona', persona);
      const S = await datos(page);
      expect(S.dueño).toBe(persona);
      expect(Object.values(S.sesiones).map(s => s.fuente)).toEqual(deEllos.map(() => 'anterior'));
      expect(Object.values(S.sesiones).every(s => s.estado === 'hecha')).toBe(true);
      // La fecha de cada entreno es la de Madrid: los de Víctor acaban a las 00:45 del día siguiente (CEST).
      if (V) expect(Object.values(S.sesiones).map(s => s.fecha).sort()).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
      // Con sus series y kilos (el press de 40 kg × 10 de la app anterior).
      if (V) for (const s of Object.values(S.sesiones)) expect(s.ejercicios.map(x => [x.id, x.sets.map(z => [z.kg, String(z.valor), z.hecha])])).toEqual([['press-pecho-maquina', [[40, '10', true]]]]);
      const [les] = viejo.injuries[yo];
      expect(S.perfil.lesiones).toEqual([expect.objectContaining({ zona: P.zona, dolor: les.severity * 3, nota: P.nota, activa: true, dolorRevisar: true })]);
      expect(S.perfil.datos).toEqual(expect.objectContaining({ sexo: P.datos.sexo, altura: +P.datos.altura }));
      expect(S.medidas.map(m => m.peso)).toEqual(viejo.bodyLog[yo].map(b => b.weight));
      // elplan2 sigue ahí, tal cual (marcha atrás posible).
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elplan2')))).toEqual(viejo);
      await expect(page.locator('#vista')).toContainText('de la app anterior con el dolor estimado');
      // Progreso ya enseña lo traído.
      await page.click('#nav a[href="#progreso"]');
      await expect(page.locator('#vista h1')).toHaveText('Progreso');
      await expect(page.locator('[aria-labelledby="t-u"] .lista li')).toHaveCount(deEllos.length);
      await expect(page.locator('[aria-labelledby="t-u"]')).toContainText('Torso');
    });

    await paso('perfil: objetivos, nivel, lesión con dolor, días, lugares y material de casa', page, errores, async () => {
      await page.click('#nav a[href="#perfil"]');
      // Lesión migrada: se revisa el dolor (estimado = gravedad × 3).
      await page.click('#vista [data-act="perfil.grupo"][data-v="lesiones"]');
      const fila = page.locator(`[data-act="perfil.lesion"][data-id]`);
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText(P.zonaNombre);
      await expect(fila).toContainText('(estimado: revísalo)');
      await expect(fila).toContainText(P.nota);
      await fila.click();
      await expect(page.locator('.hoja h2')).toHaveText('Editar lesión');
      await expect(page.locator('#l-zona')).toHaveValue(P.zona);
      const dolor = page.locator('#l-dolor');
      let ahora = +(await dolor.getAttribute('aria-valuenow'));
      while (ahora !== P.dolorFicha) {
        await page.click(`.hoja [data-act="control.paso"][data-paso="${ahora < P.dolorFicha ? 1 : -1}"]`);
        ahora = +(await dolor.getAttribute('aria-valuenow'));
      }
      await expect(dolor).toHaveAttribute('aria-valuetext', `${P.dolorFicha} de 10`);
      await page.click('#l-tipo [data-v="recurrente"]');
      await expect(page.locator('#l-tipo [data-v="recurrente"]')).toHaveAttribute('aria-pressed', 'true');
      await page.click('.hoja [data-act="perfil.guardarLesion"]');
      await expect(page.locator('.hoja')).toHaveCount(0);
      await expect(fila).toContainText(`Dolor ${P.dolorFicha} de 10`);
      await expect(fila).not.toContainText('estimado');
      await expect(page.locator('#vista')).not.toContainText('de la app anterior con el dolor estimado');

      await page.click('[data-act="perfil.grupo"][data-v="objetivos"]');
      await chips(page, 'perfil.objetivo', P.objetivos);
      await page.click(`[data-act="perfil.nivel"][data-v="${P.nivel}"]`);
      await expect(page.locator(`[data-act="perfil.nivel"][data-v="${P.nivel}"]`)).toHaveAttribute('aria-checked', 'true');
      if (V) await page.uncheck('[data-cambio="perfil.nivelAuto"]');

      await page.click('[data-act="perfil.grupo"][data-v="datos"]');
      await expect(page.locator('#d-sexo')).toHaveValue(P.datos.sexo);
      await expect(page.locator('#d-altura')).toHaveValue(P.datos.altura);
      await page.fill('#d-nac', P.nacimiento);
      await page.locator('#d-nac').blur();

      await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
      const dias = page.locator('#p-dias');
      while (+(await dias.getAttribute('aria-valuenow')) !== P.dias.length) {
        await page.click(`#p-dias ~ .selector-pasos [data-paso="${+(await dias.getAttribute('aria-valuenow')) < P.dias.length ? 1 : -1}"]`);
      }
      await expect(dias).toHaveAttribute('aria-valuetext', `${P.dias.length} días por semana`);
      await page.click(`[data-act="perfil.minutos"][data-v="${P.minutos}"]`);
      await chips(page, 'perfil.lugar', P.lugares);
      await chips(page, 'perfil.material', P.material);
      if (!V) { await page.check('[data-cambio="perfil.nadar25"]'); }
      await expect(page.locator('.perfil-resumen')).toContainText('1 lesión activa');

      // Todo eso se guarda en el móvil (pipos4), no solo en pantalla.
      await expect.poll(async () => {
        const g = await guardado(page);
        const p = g && g.perfil;
        return p && JSON.stringify([p.objetivos, p.nivel, p.lugares.slice().sort(), p.materialCasa.slice().sort(), p.disponibilidad.dias, p.disponibilidad.minutos, p.lesiones[0].dolor, p.lesiones[0].tipo, !!p.lesiones[0].dolorRevisar, p.datos.nacimiento]);
      }).toBe(JSON.stringify([P.objetivos, +P.nivel, P.lugares.slice().sort(), P.material.slice().sort(), P.dias.length, +P.minutos, P.dolorFicha, 'recurrente', false, P.nacimiento]));
    });

    await paso('semana sin IA (reglas)', page, errores, async () => {
      await page.click('#nav a[href="#hoy"]');
      await expect(page.locator('#vista h1')).toHaveText(`Hola, ${NOMBRE[persona]}`);
      await expect(page.locator('.accion-hoy [data-act="entrenador.plan"]')).toHaveText('Montar mi semana');
      await page.click('.accion-hoy [data-act="entrenador.plan"]');
      await expect(page.locator('.hoja h2')).toHaveText('Tu semana');
      await chips(page, 'entrenador.psDia', P.dias, '.hoja');
      await page.click(`.hoja [data-act="entrenador.psMin"][data-v="${P.minutos}"]`);
      // Esta semana, solo el gimnasio (lunes con kilos); la casa queda para «Mis sesiones».
      await chips(page, 'entrenador.psLugar', ['gym'], '.hoja');
      await expect(page.locator('.hoja .ayuda')).toContainText('3 días por planificar');
      await page.click('.hoja [data-act="entrenador.crearPlan"][data-ia="0"]');
      await expect(page.locator('.hoja')).toHaveCount(0);
      await expect(page.locator('#aviso')).toContainText(/Semana lista|semana/i);
      expect(llamadas, 'sin gastar IA').toEqual([]);
      const S = await datos(page);
      expect(S.plan.fuente).toBe('reglas');
      expect(S.plan.dias.map(d => d.diaSemana)).toEqual(P.dias.map(Number));
      expect(S.plan.dias.every(d => d.lugar === 'gym')).toBe(true);
      expect(S.perfil.disponibilidad.diasSemana).toEqual(P.dias.map(Number)); // es lunes: pasa a lo habitual
      for (const d of S.plan.dias) expect(await criterios(page, d), `día ${d.diaSemana} del plan`).toEqual([]);
      // Lo que dice Hoy: la tarjeta de la semana con sus 3 días, la tira y «Hoy toca».
      await expect(page.locator('.plan-semana .dias-plan li')).toHaveCount(3);
      await expect(page.locator('.plan-semana')).toContainText('hecha por la app');
      await expect(page.locator('.semana .dia-c')).toHaveCount(7);
      await expect(page.locator('.hoy-tarjeta .etiqueta')).toHaveText('Hoy toca');
      await expect(page.locator('.hoy-tarjeta h2')).toHaveText(S.plan.dias[0].nombre);
      // Ver el día: su calentamiento, trabajo y vuelta a la calma.
      await page.click('[data-act="entrenador.verDia"][data-v="1"]');
      await expect(page.locator('.hoja h2')).toContainText(`Lunes: ${S.plan.dias[0].nombre}`);
      await expect(page.locator('.hoja h3')).toHaveText(['Calentamiento', 'Trabajo', 'Vuelta a la calma']);
      await expect(page.locator('.hoja .lista-dia').nth(1).locator('li')).toHaveCount(S.plan.dias[0].ejercicios.length);
      await cerrarHojaConEscape(page);
    });

    await paso('check-in y sesión del lunes, con kilos, descanso con alarma, tiempo, cardio y estiramientos', page, errores, async () => {
      await expect(page.locator('.accion-hoy [data-act="entrenador.prepararHoy"]')).toHaveText('Empezar');
      await abrirCheckin(page);
      const S0 = await datos(page);
      await expect(page.locator('.hoja .ci-intro')).toContainText(`Toca ${S0.plan.dias[0].nombre} en gimnasio`);
      // C-DOLOR-0: se rellena con el dolor de la ficha, con tope 6 (una ficha a 8 no lleva sola al día suave).
      await expect(page.locator(`#ci-${P.zona}`)).toHaveText(String(Math.min(6, P.dolorFicha)));
      while (+(await page.locator(`#ci-${P.zona}`).textContent()) !== P.dolorHoy) {
        await page.click(`.hoja [data-act="entrenador.ciDolorPaso"][data-z="${P.zona}"][data-v="${+(await page.locator(`#ci-${P.zona}`).textContent()) < P.dolorHoy ? 1 : -1}"]`);
      }
      await page.click('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="4"]');
      await expect(page.locator('.hoja [data-act="entrenador.ci"][data-k="energia"][data-v="4"]')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('.hoja .previa')).toContainText(/\d+ ejercicios, unos \d+ min con calentamiento y estiramientos/);
      const id = await prepararDesdeCheckin(page);
      ids.lunes = id;
      const s = await sesionDe(page, id);
      expect(s.fecha).toBe('2026-11-16');
      expect(s.lugar).toBe('gym');
      expect(s.checkin).toEqual(expect.objectContaining({ energia: 4, dolor: { [P.zona]: P.dolorHoy } }));
      expect(await criterios(page, s), 'la sesión del lunes').toEqual([]);
      // Uso «Automático» sin nada que lo pida (sin petición ni dolor nuevo): el día lo ajusta la app, sin IA.
      expect(llamadas, 'el día lo ajusta la app').toEqual([]);
      expect(s.iaFallo).toBeFalsy();
      const r = await hacerSesion(page, id, { esfuerzo: 4, comentario: V ? 'La rodilla, bien' : 'La cadera aguanta' });
      expect(r.alarma, 'un descanso acabó con su alarma').toBe(true);
      expect(r.kg, 'una serie con kilos').not.toBeNull();
      expect(r.cardio, 'el cardio con su contador').not.toBeNull();
      ids.kg = r.kg;
      // Hoy: la sesión hecha y la semana con el lunes hecho.
      await expect(page.locator('.hoy-tarjeta .etiqueta')).toContainText('Hecha');
      await expect(page.locator('.plan-semana .dias-plan li').first()).toContainText('Hecho');
      const S = await datos(page);
      expect(S.plan.hechos[1]).toBe(id);
    });

    await paso('progreso: constancia, fuerza con los kilos de hoy y la sesión en el historial', page, errores, async () => {
      await page.click('#nav a[href="#progreso"]');
      await expect(page.locator('#vista h1')).toHaveText('Progreso');
      await expect(page.locator('[aria-labelledby="t-c"] h2')).toHaveText('Constancia');
      const fuerza = page.locator(`[data-act="progreso.ejercicio"][data-id="${ids.kg.id}"]`);
      await expect(fuerza).toBeVisible();
      await expect(page.locator('[aria-labelledby="t-u"] .lista li').first()).toContainText((await sesionDe(page, ids.lunes)).nombre);
      await expect(page.locator('[aria-labelledby="t-u"] .lista li').first()).toContainText('esfuerzo 4 de 5');
      await fuerza.click();
      await expect(page.locator('.hoja')).toContainText(String(ids.kg.kg).replace('.', ','));
      await cerrarHojaConEscape(page);
      // El historial lleva a la sesión, en lectura.
      await page.locator('[aria-labelledby="t-u"] .lista li a').first().click();
      await expect(page).toHaveURL(new RegExp(`#sesion/${ids.lunes}$`));
      await expect(page.locator('.cab-sesion')).toContainText('hecha');
      expect(await page.locator('[data-act="sesion.serie"], [data-act="sesion.tarea"], [data-act="sesion.cuenta"]').count()).toBe(0);
    });

    await paso('ejercicios: ficha técnica, me gusta, no me gusta y no lo quiero', page, errores, async () => {
      await page.goto('/#ejercicios'); // desde una sesión no hay barra de pestañas
      await expect(page.locator('#vista h1')).toHaveText('Ejercicios');
      const NOMBRES = { rechazo: 'No lo quiero', gusta: 'Me gusta', nogusta: 'No me gusta' };
      for (const [id, g] of Object.entries(GUSTOS[persona])) {
        await page.fill('#ej-buscar', '');
        const fila = page.locator(`[data-act="ejercicios.ficha"][data-id="${id}"]`);
        await fila.scrollIntoViewIfNeeded();
        await fila.click();
        const hoja = page.locator('.hoja');
        await expect(hoja.locator('h3').first()).toHaveText('Cómo se hace');
        expect(await hoja.locator('.ficha ol li').count()).toBeGreaterThan(1);
        await hoja.locator(`[data-act="ejercicios.gustoFicha"][data-v="${g}"]`).click();
        await expect(page.locator(`.hoja [data-act="ejercicios.gustoFicha"][data-v="${g}"]`)).toHaveAttribute('aria-pressed', 'true');
        await cerrarHojaConEscape(page);
        await expect(fila).toContainText(NOMBRES[g]);
      }
      const rechazado = Object.keys(GUSTOS[persona]).find(k => GUSTOS[persona][k] === 'rechazo');
      await expect(page.locator(`li.apagada [data-id="${rechazado}"]`)).toHaveCount(1);
      // El filtro de valoración enseña lo valorado.
      await expect.poll(async () => (await guardado(page)).perfil.gustos).toEqual(GUSTOS[persona]);
      // Y Perfil › Mi entreno lo lista, con «Quitar».
      await page.click('#nav a[href="#perfil"]');
      await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
      await expect(page.locator('[data-act="perfil.quitarGusto"]')).toHaveCount(3);
    });

    await paso('martes: «Mis sesiones», una de casa con abdominales y flexiones, y hacerla', page, errores, async () => {
      await irAlDia(page, 1);
      // Martes no toca: descanso, con «Entrenar igualmente».
      await expect(page.locator('.hoy-tarjeta h2')).toHaveText('Descanso');
      await page.click('#nav a[href="#perfil"]');
      await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
      await page.click('[data-act="perfil.crearMia"]');
      await expect(page).toHaveURL(/#mia\/nueva$/);
      await expect(page.locator('#vista h1')).toHaveText('Nueva sesión');
      await page.fill('#mia-nombre', 'Abdominales y flexiones');
      await page.click('[data-act="mia.lugar"][data-v="casa"]');
      await expect(page.locator('[data-act="mia.lugar"][data-v="casa"]')).toHaveAttribute('aria-checked', 'true');
      await page.click('[data-act="mia.buscar"]');
      const hoja = page.locator('.hoja');
      await expect(hoja.locator('[data-act="mia.filtro"][data-k="lugar"][data-v="casa"]')).toHaveAttribute('aria-pressed', 'true');
      for (const [buscar, id] of [['crunch', 'crunch'], ['flexiones', 'flexiones'], ['plancha frontal', 'plancha']]) {
        await page.fill('#mia-buscar', buscar);
        await hoja.locator(`[data-act="mia.anadir"][data-id="${id}"]`).click();
        await expect(hoja.locator(`[data-act="mia.anadir"][data-id="${id}"]`)).toHaveAttribute('aria-disabled', 'true');
      }
      await expect(hoja.locator('.meta-lista')).toContainText('3 en la sesión');
      await page.click('[data-act="mia.listo"]');
      await expect(page.locator('.mia-ej-nombre')).toHaveText(['Crunch abdominal', 'Flexiones', 'Plancha frontal']);
      await expect(page.locator('#mia-plancha-reps-et')).toHaveText('Tiempo');
      await page.click('[data-act="mia.guardar"]');
      await expect(page).toHaveURL(/#perfil$/);
      await expect(page.locator('#aviso')).toContainText('Guardada en tus sesiones: «Abdominales y flexiones»');
      await expect(page.locator('.mis-sesiones')).toContainText('Abdominales y flexiones');
      await expect(page.locator('.mis-sesiones')).toContainText('3 ejercicios, casa');
      const [mia] = (await datos(page)).misSesiones;
      expect(mia).toEqual(expect.objectContaining({ nombre: 'Abdominales y flexiones', lugar: 'casa' }));
      expect(mia.ejercicios.map(x => x.id)).toEqual(['crunch', 'flexiones', 'plancha']);
      ids.mia = mia.id;

      // Hacerla: Hoy › Entrenar igualmente › «Antes de empezar» con la mía elegida (sin IA).
      await page.click('#nav a[href="#hoy"]');
      await abrirCheckin(page);
      await page.click(`.hoja [data-act="entrenador.ciMia"][data-v="${mia.id}"]`);
      await expect(page.locator('.hoja .ci-intro')).toContainText('Haces Abdominales y flexiones');
      await expect(page.locator('.hoja [data-act="entrenador.ci"][data-k="lugar"][data-v="casa"]')).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('#ci-peticion')).toHaveCount(0);
      await expect(page.locator('.hoja [data-act="entrenador.crearHoy"]')).toHaveText('Preparar «Abdominales y flexiones»');
      const antes = llamadas.length;
      const id = await prepararDesdeCheckin(page);
      expect(llamadas.length, 'una de mis sesiones se prepara sin IA').toBe(antes);
      ids.martes = id;
      await expect(page.locator('#vista')).toContainText('De tus sesiones: «Abdominales y flexiones»');
      const s = await sesionDe(page, id);
      expect(s.origen).toEqual({ tipo: 'mia', id: mia.id });
      expect(s.lugar).toBe('casa');
      for (const e of ['crunch', 'flexiones', 'plancha']) {
        // C-MIA-1: se hace tal cual (a Virginia el crunch «no le gusta», pero lo eligió ella).
        expect(s.ejercicios.map(x => x.id)).toContain(e);
      }
      expect(await criterios(page, s), 'la mía de casa').toEqual([]);
      const r = await hacerSesion(page, id, { esfuerzo: 3 });
      expect(r.tiempo, 'la plancha con su contador en segundos').not.toBeNull();
      const S = await datos(page);
      expect(S.plan.hechos[2]).toBeUndefined(); // no ocupa ningún día del plan
    });

    if (V) {
      await paso('miércoles: la IA (simulada) propone el día y el validador lo corrige', page, errores, async () => {
        await irAlDia(page, 2);
        await page.click('#nav a[href="#perfil"]');
        await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
        await page.fill('#a-codigo', 'secreto');
        await page.locator('#a-codigo').press('Tab');
        await expect(page.locator('#aviso')).toContainText('Código guardado');
        modoIA = 'ia';
        const cliente = iaQueDevuelve(SESION_IA);
        ponerClienteIA(cliente);
        await page.click('#nav a[href="#hoy"]');
        await expect(page.locator('.hoy-tarjeta .etiqueta')).toHaveText('Hoy toca');
        await abrirCheckin(page);
        // Lo rellena con el dolor del lunes (hace ≤ 3 días).
        await expect(page.locator(`#ci-${P.zona}`)).toHaveText(String(P.dolorHoy));
        await page.fill('#ci-peticion', 'hoy prefiero máquinas');
        await page.locator('#ci-peticion').press('Tab');
        await page.click('.hoja [data-act="entrenador.crearHoy"]');
        // La IA simulada contesta en milisegundos: la hoja de espera ni se llega a ver (PR 12 la prueba aparte).
        await expect(page).toHaveURL(/#sesion\//, { timeout: 15000 });
        const id = idEnURL(page);
        ids.miercoles = id;
        await expect(page.locator('.cab-sesion h1')).toHaveText('Torso con máquinas');
        await expect(page.locator('.nota-fallo')).toHaveCount(0);
        expect(cliente.llamadas.length).toBe(1);
        // Lo que viaja a la IA: la petición como dato, el rechazo y el dolor de hoy; sin nombre ni código.
        const cuerpo = cliente.llamadas[0].params.messages[0].content;
        expect(cuerpo).toContain('hoy prefiero máquinas');
        expect(cuerpo).not.toContain('Víctor');
        expect(cuerpo).not.toContain('secreto');
        const s = await sesionDe(page, id);
        expect(s.fuente).toBe('ia');
        const ids2 = s.ejercicios.map(x => x.id);
        expect(ids2, 'no lo quiere').not.toContain('press-pecho-maquina');
        expect(ids2, 'carga la rodilla a 4/10').not.toContain('prensa-piernas');
        expect(ids2).toContain('jalon-pecho');
        // Doble barandilla: el móvil solo ofrece a la IA los ids que valen hoy (ni el rechazado ni lo que carga la
        // rodilla) y el servidor descarta lo que no esté entre ellos; luego el validador completa lo que falta.
        const enviado = JSON.parse(cuerpo.split('<datos>\n')[1].split('\n</datos>')[0]);
        const ofrecidos = enviado.catalogo.map(e => e.id);
        expect(ofrecidos).not.toContain('press-pecho-maquina');
        expect(ofrecidos).not.toContain('prensa-piernas');
        expect(enviado.analisis.ejercicios).toContainEqual(expect.objectContaining({ id: 'press-pecho-maquina', gusto: 'rechazo', accion: 'No volver a ponerlo.' }));
        expect(s.explicacion.join(' ')).toMatch(/Ajustado por la app: añado .+ para tu rodilla/);
        expect(s.explicacion.join(' ')).toMatch(/Ajustado por la app: [^.]*añado \d+ min de cardio/);
        expect(await criterios(page, s), 'la sesión de la IA tras el validador').toEqual([]);
        // La pantalla lo cuenta: por qué cada decisión.
        await page.click('[data-act="sesion.modo"][data-v="lista"]');
        await page.locator('.porque-bloque details summary').click();
        await expect(page.locator('.porque-bloque')).toContainText('toda sesión lleva cardio');
        await page.click('[data-act="sesion.modo"][data-v="foco"]');
        modoIA = 'caida'; ponerClienteIA(null);
      });
    } else {
      await paso('miércoles: dolor de 7 o más hoy, sesión suave sin IA (D2)', page, errores, async () => {
        await irAlDia(page, 2);
        await abrirCheckin(page);
        await expect(page.locator(`#ci-${P.zona}`)).toHaveText(String(P.dolorHoy)); // el del lunes
        for (let i = P.dolorHoy; i < 6; i++) await page.click(`.hoja [data-act="entrenador.ciDolorPaso"][data-z="${P.zona}"][data-v="1"]`);
        await page.click(`.hoja [data-act="entrenador.ciDolorPaso"][data-z="${P.zona}"][data-v="1"]`);
        await expect(page.locator('.hoja')).toContainText('¿Hoy de verdad 7 o más?');
        await confirmarSi(page);
        await expect(page.locator(`#ci-${P.zona}`)).toHaveText('7');
        // Con dolor ≥ 7 no se ofrece la IA (C-DOLOR-4).
        await expect(page.locator('[data-cambio="entrenador.ciIA"]')).toHaveCount(0);
        const antes = llamadas.length;
        const id = await prepararDesdeCheckin(page);
        ids.miercoles = id;
        expect(llamadas.length, 'D2 sin IA').toBe(antes);
        const s = await sesionDe(page, id);
        expect(s.tipo).toBe('dolorAlto');
        expect(s.checkin.dolor[P.zona]).toBe(7);
        expect(s.ejercicios.map(x => x.rol)).toEqual(['cardio']);
        expect(await criterios(page, s), 'D2').toEqual([]);
        await expect(page.locator('.cab-sesion h1')).toHaveText('Sesión suave');
        // Se hace entera: el bloque de cardio, la movilidad y los estiramientos.
        await hacerSesion(page, id, { esfuerzo: 2 });
      });
    }

    let copia;
    await paso('copia a un archivo', page, errores, async () => {
      await page.goto('/#perfil'); // desde una sesión no hay barra de pestañas
      await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
      await expect(page.locator('.ultima-copia')).toContainText('Aún no has guardado ninguna copia');
      const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#vista [data-act="perfil.exportar"]')]);
      expect(descarga.suggestedFilename()).toBe(`pipos-fitness-${persona}-2026-11-18.json`);
      copia = path.join(tmp, descarga.suggestedFilename());
      await descarga.saveAs(copia);
      await expect(page.locator('#aviso')).toContainText('Copia guardada en Descargas');
      await expect(page.locator('.ultima-copia')).toContainText('Última copia guardada');
      const txt = fs.readFileSync(copia, 'utf8');
      expect(txt).not.toContain('secreto'); // nunca el código de acceso
      expect(txt).not.toContain('elplan2');
    });
    const antes = await datos(page);
    await ctx.close();

    // ── Otro móvil (un navegador limpio), el jueves ──
    const otro = await abrirContexto(browser, { cuando: DIA(3) });
    const p2 = otro.page, e2 = otro.errores;
    await paso('cargar la copia en un navegador limpio', p2, e2, async () => {
      await p2.goto('/');
      await p2.evaluate(() => navigator.serviceWorker.ready);
      await p2.waitForFunction(() => navigator.serviceWorker.controller !== null);
      await p2.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
      await expect(p2).toHaveURL(/#hoy$/); // siempre a Hoy (U5)
      expect(Object.keys((await datos(p2)).sesiones)).toEqual([]); // móvil limpio: nada que migrar
      await p2.click('#nav a[href="#perfil"]');
      await expect(p2).toHaveURL(/#perfil$/);
      await p2.click('[data-act="perfil.grupo"][data-v="ajustes"]');
      const [elegir] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('#vista [data-act="perfil.importar"]')]);
      await elegir.setFiles(copia);
      await expect(p2.locator('.hoja')).toContainText('Esto sustituye todos los datos de este móvil');
      await confirmarSi(p2);
      await expect(p2.locator('#aviso')).toContainText('Copia cargada');
      const S = await datos(p2);
      expect(Object.keys(S.sesiones).sort()).toEqual(Object.keys(antes.sesiones).sort());
      expect(S.perfil).toEqual(antes.perfil);
      expect(S.misSesiones).toEqual(antes.misSesiones);
      expect(S.plan).toEqual(antes.plan);
      expect(S.medidas).toEqual(antes.medidas);
      expect(S.ajustes.codigo).toBe('');
      await p2.click('#nav a[href="#progreso"]');
      await expect(p2.locator('[aria-labelledby="t-u"] .lista li').first()).toBeVisible();
    });

    let idJueves;
    await paso('modo avión: recargar sin red, la app arranca y la sesión creada funciona', p2, e2, async () => {
      await otro.ctx.setOffline(true);
      await p2.goto('/#hoy');
      await p2.reload();
      await expect(p2.locator('#nav a')).toHaveCount(4);
      await expect(p2.locator('#vista h1')).toHaveText(`Hola, ${NOMBRE[persona]}`);
      await expect(p2.locator('#fallo-arranque')).toHaveCount(0);
      expect(await p2.evaluate(() => document.documentElement.dataset.marca)).toBe('A');
      await expect(p2.locator('.sin-red')).toContainText('Tu sesión de hoy funciona entera');
      // Jueves no toca: «Entrenar igualmente» con la mía de casa; el check-in dice que va sin red.
      await abrirCheckin(p2);
      await expect(p2.locator('.ci-red')).toContainText('Sin conexión');
      await p2.click(`.hoja [data-act="entrenador.ciMia"][data-v="${ids.mia}"]`);
      // Se rellena con el dolor del último check-in (C-DOLOR-0): Virginia ayer estaba a 7; hoy dice que a 3
      // (con 7 o más, también una de sus sesiones pasaría a ser el día suave).
      const ayer = V ? P.dolorHoy : 7;
      await expect(p2.locator(`#ci-${P.zona}`)).toHaveText(String(ayer));
      for (let i = ayer; i > P.dolorHoy; i--) await p2.click(`.hoja [data-act="entrenador.ciDolorPaso"][data-z="${P.zona}"][data-v="-1"]`);
      await expect(p2.locator(`#ci-${P.zona}`)).toHaveText(String(P.dolorHoy));
      idJueves = await prepararDesdeCheckin(p2);
      const s = await sesionDe(p2, idJueves);
      expect(s.origen).toEqual({ tipo: 'mia', id: ids.mia });
      expect(await criterios(p2, s), 'la mía, sin red').toEqual([]);
      // Empieza: calentamiento y la primera serie, con su descanso (el cronómetro va sin red).
      for (let i = 0; i < s.calentamiento.length; i++) await p2.click(`[data-act="sesion.tarea"][data-k="calentamiento"][data-i="${i}"]`);
      await p2.click('[data-act="sesion.foco"][data-v="1"]');
      const primero = s.ejercicios[0];
      const tiempo = await p2.locator('[data-actual] [data-act="sesion.cuenta"]').count();
      if (tiempo) {
        await p2.click('[data-actual] [data-act="sesion.serie"]');
      } else {
        await p2.click('[data-actual] [data-principal]');
        if (primero.series > 1) {
          await expect(p2.locator('#temporizador.descanso')).toBeVisible();
          await p2.clock.runFor(primero.descanso * 1000);
          await expect(p2.locator('#temporizador.descanso--alarma')).toBeVisible();
          expect(await p2.evaluate(() => window.__vibra)).toContainEqual([250, 120, 250, 120, 250]);
          await p2.click('#temporizador [data-t="cerrar"]');
        }
      }
      await expect.poll(async () => ((await guardado(p2)).sesiones[idJueves] || {}).estado).toBe('en_curso'); // guardado en el móvil
      expect((await sesionDe(p2, idJueves)).ejercicios[0].sets[0].hecha).toBe(true);
      await otro.ctx.setOffline(false);
    });

    await paso('versión nueva desplegada: el aviso espera a terminar y «Actualizar» no pierde nada', p2, e2, async () => {
      srv.control.raiz = vB;
      await p2.reload();
      await expect.poll(() => p2.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.waiting); }), { timeout: 15000 }).toBe(true);
      // Con la sesión en curso, el aviso no sale (no se interrumpe el entreno).
      await p2.goto('/#sesion/' + idJueves);
      await expect(p2.locator('.cab-sesion h1')).toBeVisible();
      await expect(p2.locator('#aviso-version')).toHaveCount(0);
      await p2.click('.cab-sesion [data-act="sesion.terminar"]');
      await expect(p2.locator('.hoja .aviso-hoja')).toContainText(/Te quedan/);
      await p2.locator('.hoja [data-act="sesion.cerrar"]').scrollIntoViewIfNeeded();
      await p2.click('.hoja [data-act="sesion.cerrar"]');
      await expect(p2.locator('.final')).toBeVisible();
      await p2.clock.runFor(3000);
      await p2.click('.final [data-fin-hoy]');
      // Al terminarla, el aviso.
      await expect(p2.locator('#aviso-version')).toBeVisible();
      await expect(p2.locator('#aviso-version')).toContainText('Hay una versión nueva');
      await expect(p2.locator('#aviso-version button')).toHaveText('Actualizar');
      const S0 = await datos(p2);
      await Promise.all([p2.waitForEvent('load'), p2.click('#aviso-version button')]);
      await expect(p2.locator('#nav a')).toHaveCount(4);
      await expect.poll(() => p2.evaluate(() => document.documentElement.dataset.marca)).toBe('B');
      await expect(p2.locator('#aviso-version')).toHaveCount(0);
      const S1 = await datos(p2);
      expect(S1).toEqual(S0);
      expect(S1.sesiones[idJueves].estado).toBe('hecha');
      // Y sin red, la versión nueva entera.
      await otro.ctx.setOffline(true);
      await p2.reload();
      await expect(p2.locator('#vista h1')).toHaveText(`Hola, ${NOMBRE[persona]}`);
      expect(await p2.evaluate(() => document.documentElement.dataset.marca)).toBe('B');
      await otro.ctx.setOffline(false);
    });
    await otro.ctx.close();
  });
}
