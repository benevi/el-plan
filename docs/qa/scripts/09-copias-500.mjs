// Recorrido 9: copia a archivo (exportar), copia enorme de 500 sesiones (importar), tiempos de pintado y tamaño.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar, CAPTURAS } from './comun.mjs';
import fs from 'node:fs'; import path from 'node:path';
const movil = process.argv[2] || 'm390';
const b = await navegador();
let ctx = await contexto(b, movil, { acceptDownloads: true }); let page = await ctx.newPage(); let err = vigilar(page);
await empezar(page, 'victor', { objetivos: ['fuerza'] });
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
await page.click('[data-act="sesion.modo"][data-v="lista"]');
for (let e = 0; e < 2; e++) for (let s = 0; s < 3; s++) {
  await page.fill(`[data-cambio="sesion.dato"][data-e="${e}"][data-s="${s}"][data-k="kg"]`, String(40 + e * 20));
  await page.locator(`[data-cambio="sesion.dato"][data-e="${e}"][data-s="${s}"][data-k="kg"]`).blur();
  await page.click(`[data-act="sesion.serie"][data-e="${e}"][data-s="${s}"]`);
  await page.click('#temporizador [data-t="fin"]').catch(() => {});
}
await page.click('[data-act="sesion.terminar"]'); await page.click('[data-act="sesion.cerrar"]'); await esperar(500);
// Exportar
await page.click('#nav a[href="#perfil"]'); await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('[data-act="perfil.exportar"]')]);
console.log('descarga:', dl && dl.suggestedFilename(), '| aviso:', (await leer(page)).aviso, '| última copia:', (await leer(page)).vista.match(/Última copia[^\n]*/));
const base = JSON.parse(await page.evaluate(() => localStorage.pipos4));
await ctx.close();
// Copia enorme: 500 sesiones hechas en ~2 años, con kilos que suben poco a poco
const molde = Object.values(base.sesiones).find(s => s.estado === 'hecha');
const big = JSON.parse(JSON.stringify(base)); big.sesiones = {}; big.dolor = []; big.medidas = [];
const inicio = new Date('2024-11-25T18:00:00Z').getTime();
for (let i = 0; i < 500; i++) {
  const s = JSON.parse(JSON.stringify(molde)); const t = new Date(inicio + i * 1.45 * 864e5);
  s.id = 'g' + i.toString(36).padStart(4, '0'); s.fecha = t.toISOString().slice(0, 10); s.creada = s.empezada = t.toISOString(); s.terminada = new Date(t.getTime() + 3600e3).toISOString();
  s.ejercicios.forEach(x => x.sets.forEach(z => { if (z.kg != null) z.kg = Math.round((z.kg + i * 0.1) * 2) / 2; }));
  s.cierre = { esfuerzo: 1 + (i % 5), dolor: {}, comentario: i % 7 ? '' : 'Comentario largo de prueba '.repeat(10) };
  big.sesiones[s.id] = s;
  if (i % 10 === 0) big.medidas.push({ fecha: s.fecha, peso: 80 - i * 0.01, cintura: 90 - i * 0.005 });
}
big.plan = null;
const archivo = path.join((await import('node:os')).tmpdir(), 'pipos-copia-500-sesiones.json');
fs.writeFileSync(archivo, JSON.stringify(big));
console.log('copia enorme:', (fs.statSync(archivo).size / 1024).toFixed(0), 'KB');
// Importar en un móvil nuevo
ctx = await contexto(b, movil); page = await ctx.newPage(); err = vigilar(page);
await empezar(page, 'victor', { objetivos: ['musculo'] });
await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="perfil.importar"]')]);
await fc.setFiles(archivo); await esperar(300);
console.log('pregunta:', (await leer(page)).hoja);
let t0 = Date.now();
await page.click('.hoja [data-r="1"]');
await page.waitForFunction(() => document.querySelector('#aviso.ver'), null, { timeout: 30000 });
console.log('importar tardó', Date.now() - t0, 'ms | aviso:', (await leer(page)).aviso);
console.log('uso:', (await leer(page)).vista.match(/Tus datos ocupan[^\n]*/));
for (const r of ['#hoy', '#progreso', '#ejercicios', '#perfil']) {
  await page.click(`#nav a[href="${r}"]`); await page.waitForFunction(r => location.hash === r, r);
  const ms = await page.evaluate(() => { const t = performance.now(); window.dispatchEvent(new HashChangeEvent('hashchange')); return performance.now() - t; });
  console.log('pintar', r, Math.round(ms), 'ms', await page.evaluate(() => location.hash));
}
await page.click('#nav a[href="#progreso"]'); await page.waitForFunction(() => location.hash === '#progreso'); await esperar(800);
console.log('PROGRESO con 500:', (await leer(page)).vista.slice(0, 900));
await foto(page, `09-${movil}-progreso-500`, { completa: true });
await page.click('#nav a[href="#hoy"]'); await page.waitForFunction(() => location.hash === '#hoy'); await esperar(800); await foto(page, `09-${movil}-hoy-500`, { completa: true });
// Montar la semana con 500 sesiones
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) if (!(await page.$(`[data-act="entrenador.psDia"][data-v="${d}"].on`))) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
t0 = Date.now(); await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.waitForSelector('[data-act="entrenador.prepararHoy"]', { timeout: 30000 });
console.log('montar semana con 500 sesiones:', Date.now() - t0, 'ms');
t0 = Date.now(); await page.click('[data-act="entrenador.prepararHoy"]'); await page.waitForSelector('.hoja.checkin'); console.log('abrir check-in:', Date.now() - t0, 'ms');
t0 = Date.now(); await page.click('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await page.waitForSelector('.hoja.checkin'); console.log('repintar check-in:', Date.now() - t0, 'ms');
t0 = Date.now(); await page.click('[data-act="entrenador.crearHoy"]'); await page.waitForFunction(() => location.hash.startsWith('#sesion/'), null, { timeout: 30000 }); console.log('preparar sesión:', Date.now() - t0, 'ms');
console.log('sesión con historial:', (await leer(page)).vista.slice(0, 900));
await foto(page, `09-${movil}-sesion-500`);
console.log('errores', err);
await b.close();
