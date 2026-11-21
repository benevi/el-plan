// Recorrido 6: Virginia con cadera a 4/10. Ejercicio por tiempo con dos lados, menú del ejercicio (cambiar, gustos,
// cómo se hace, comentario), guardar como mía y cierre.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const movil = process.argv[2] || 'm360';
const b = await navegador();
const ctx = await contexto(b, movil); const page = await ctx.newPage(); const err = vigilar(page);
await page.clock.install({ time: new Date('2026-11-21T10:00:00+01:00') });
await empezar(page, 'virginia', { objetivos: ['salud', 'perder'] });
await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
await page.click('[data-act="perfil.lesion"]');
await page.selectOption('#l-zona', 'cadera_lateral');
await page.$eval('#l-dolor', el => { el.value = 4; });
await page.fill('#l-desde', '2026-01-10');
await page.click('[data-act="perfil.guardarLesion"]');
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(500);
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
await page.click('[data-act="sesion.modo"][data-v="lista"]');
const ses = () => page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0]);
let s = await ses();
console.log(JSON.stringify(s.ejercicios.map(x => [x.id, x.rol, x.series, x.reps, x.descanso])));
const i = s.ejercicios.findIndex(x => /c\/lado/.test(x.reps) && /s/.test(x.reps));
console.log('ejercicio por tiempo a dos lados:', i, s.ejercicios[i] && s.ejercicios[i].reps);
if (i >= 0) {
  await page.click(`[data-act="sesion.cuenta"][data-e="${i}"][data-s="0"]`); await page.clock.runFor(300);
  const c = async () => (await leer(page)).crono.replace(/\n/g, ' | ');
  console.log('A', await c()); await page.clock.runFor(5200);
  console.log('B lado 1', await c()); await page.clock.runFor(30_000);
  console.log('C lado 1 a 30 s', await c()); await foto(page, `06-${movil}-lado1-minimo`);
  await page.clock.runFor(15_500);
  console.log('D tras 45 s', await c()); await foto(page, `06-${movil}-lado2-previa`);
  await page.clock.runFor(5200);
  console.log('E lado 2', await c());
  await page.clock.runFor(33_000);
  await page.click('#temporizador [data-t="fin"]'); await page.clock.runFor(400);
  console.log('F tras Hecho:', JSON.stringify((await leer(page)).crono), '| set', JSON.stringify((await ses()).ejercicios[i].sets[0]));
  await page.click('#temporizador [data-t="fin"]').catch(() => {}); // saltar el descanso
}
// Menú del primer principal
const p = s.ejercicios.findIndex(x => x.rol === 'principal');
await page.click(`[data-act="sesion.menu"][data-e="${p}"]`); await page.clock.runFor(400);
console.log('menú:', (await leer(page)).hoja.replace(/\n/g, ' | '));
console.log('foco tras abrir menú:', await page.evaluate(() => document.activeElement.outerHTML.slice(0, 60)));
await foto(page, `06-${movil}-menu-ejercicio`);
console.log(await botones(page, '.hoja'));
await page.click('.hoja [data-act="sesion.gusto"][data-v="gusta"]'); await page.clock.runFor(300);
console.log('tras me gusta:', (await page.evaluate(() => JSON.parse(localStorage.pipos4).perfil.gustos)), (await botones(page, '.hoja')).filter(x => /gusto/.test(x)));
await page.click('.hoja [data-act="sesion.ficha"]'); await page.clock.runFor(400);
console.log('ficha:', (await leer(page)).hoja.slice(0, 600).replace(/\n/g, ' | '));
await foto(page, `06-${movil}-ficha`);
await page.keyboard.press('Escape'); await page.mouse.click(5, 5); await page.clock.runFor(300);
console.log('hoja tras tocar fuera:', !!(await page.$('.hoja')));
// Cambiar por otro
await page.click(`[data-act="sesion.menu"][data-e="${p}"]`); await page.clock.runFor(300);
await page.click('.hoja [data-act="sesion.cambiar"]'); await page.clock.runFor(300);
console.log('alternativas:', (await leer(page)).hoja.replace(/\n/g, ' | ').slice(0, 500));
await foto(page, `06-${movil}-alternativas`);
const antes = (await ses()).ejercicios[p];
await page.click('.hoja [data-act="sesion.cambiarPor"]'); await page.clock.runFor(300);
const desp = (await ses()).ejercicios[p];
console.log('cambio:', antes.id, antes.series + '×' + antes.reps, '→', desp.id, desp.series + '×' + desp.reps, 'nota:', desp.nota, '| gusto queda?', JSON.stringify(desp.gusto));
// No lo quiero sobre el nuevo
await page.click(`[data-act="sesion.menu"][data-e="${p}"]`); await page.clock.runFor(300);
await page.click('.hoja [data-act="sesion.gusto"][data-v="rechazo"]'); await page.clock.runFor(300);
console.log('aviso rechazo:', (await leer(page)).aviso, '| ¿sigue en la sesión?', (await ses()).ejercicios[p].id);
await foto(page, `06-${movil}-rechazo`);
// Comentario
await page.fill('#m-com', 'La máquina estaba ocupada');
await page.click('.hoja [data-act="sesion.comentar"]'); await page.clock.runFor(300);
console.log('aviso comentario:', (await leer(page)).aviso);
// Guardar como mía
await page.click('[data-act="sesion.guardarMia"]'); await page.clock.runFor(300);
console.log('guardar mía:', (await leer(page)).hoja.replace(/\n/g, ' | '));
await page.fill('#mia-nombre', 'Mi sesión de cadera con un nombre muy largo que pasa de cuarenta');
console.log('valor nombre:', await page.inputValue('#mia-nombre'));
await page.click('[data-act="sesion.guardarMiaOk"]'); await page.clock.runFor(300);
console.log('aviso mía:', (await leer(page)).aviso, '| pie:', (await leer(page)).vista.split('\n').slice(-4).join(' | '));
// Cierre
await page.click('[data-act="sesion.terminar"]'); await page.clock.runFor(400);
console.log('cierre:', (await leer(page)).hoja.replace(/\n/g, ' | '));
await page.$eval('.hoja [data-zona]', el => { el.value = 6; el.dispatchEvent(new Event('input', { bubbles: true })); });
console.log('etiqueta dolor tras mover:', (await leer(page)).hoja.match(/Dolor ahora[^\n]*/)[0]);
await page.click('#c-esf [data-v="4"]');
await page.fill('#c-com', 'Me ha costado la prensa');
await foto(page, `06-${movil}-cierre`);
await page.click('[data-act="sesion.cerrar"]'); await page.clock.runFor(600);
const L = await leer(page); console.log('tras cerrar:', L.hash, L.aviso, '\n', L.vista.slice(0, 700));
await foto(page, `06-${movil}-hoy-tras-cerrar`, { completa: true });
s = await ses(); console.log('estado', s.estado, JSON.stringify(s.cierre));
console.log('errores', err);
await b.close();
