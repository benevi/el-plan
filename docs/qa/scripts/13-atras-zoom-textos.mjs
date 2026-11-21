// Recorrido 13: botón atrás a mitad de algo, textos largos y zoom (130 % y 150 % = ventana de 277 y 240 px).
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar, BASE } from './comun.mjs';
const b = await navegador();
let ctx = await contexto(b, 'm390'); let page = await ctx.newPage(); let err = vigilar(page);
await empezar(page, 'victor', { objetivos: ['musculo'] });
await page.click('#nav a[href="#hoy"]');
await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
// Atrás con el check-in abierto
await page.click('#nav a[href="#progreso"]'); await esperar(200);
await page.click('#nav a[href="#hoy"]'); await esperar(200);
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
await page.goBack(); await esperar(500);
console.log('atrás con el check-in abierto → hash', (await leer(page)).hash, '| hoja sigue:', !!(await page.$('.hoja')), '| título hoja:', (await leer(page)).hoja.split('\n')[0]);
await foto(page, '13-m390-atras-con-checkin');
await page.click('.hoja [data-act="entrenador.crearHoy"]').catch(e => console.log('no se pudo tocar:', e.message.split('\n')[0]));
await esperar(600);
console.log('tras preparar desde Progreso:', (await leer(page)).hash);
// Atrás en la sesión con el descanso en marcha
await page.click('[data-act="sesion.modo"][data-v="lista"]').catch(() => {});
await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await esperar(300);
await page.click('[data-act="sesion.menu"][data-e="0"]'); await esperar(300);
await page.goBack(); await esperar(500);
console.log('atrás con el menú abierto en la sesión → hash', (await leer(page)).hash, '| hoja sigue:', !!(await page.$('.hoja')), (await leer(page)).hoja.split('\n')[0], '| crono:', (await leer(page)).crono.split('\n')[0]);
await foto(page, '13-m390-atras-con-menu');
await page.click('.hoja [data-act="sesion.serieMas"][data-v="1"]').catch(e => console.log('x', e.message.split('\n')[0])); await esperar(300);
console.log('«Añadir una serie» tocado fuera de la sesión → hash', (await leer(page)).hash, '| aviso', (await leer(page)).aviso, '| vista:', (await leer(page)).vista.slice(0, 60).replace(/\n/g, ' '));
// Textos largos: nombre de mía, nota de lesión, comentario y notas del perfil
const largo = 'Supercalifragilisticoespialidoso'.repeat(4);
await page.goto(BASE + '#perfil'); await esperar(300);
await page.click('[data-act="perfil.grupo"][data-v="datos"]');
await page.fill('[data-cambio="perfil.notas"]', ('Texto largo para el entrenador. ').repeat(80)); await page.locator('[data-cambio="perfil.notas"]').blur();
await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
await page.click('[data-act="perfil.lesion"]'); await page.selectOption('#l-zona', 'muñeca'); await page.fill('#l-nota', largo + ' ' + 'nota '.repeat(200)); await page.click('[data-act="perfil.guardarLesion"]'); await esperar(300);
const ancho = () => page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, anchos: [...document.querySelectorAll('#vista *, .hoja *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map(e => e.tagName + '.' + e.className + ' «' + (e.innerText || '').slice(0, 30) + '»') }));
console.log('lesiones con nota larga:', JSON.stringify(await ancho()));
await foto(page, '13-m390-lesion-nota-larga', { completa: true });
const notaGuardada = await page.evaluate(() => JSON.parse(localStorage.pipos4).perfil.lesiones[0].nota.length);
console.log('nota de lesión guardada, largo:', notaGuardada);
await ctx.close();
// Zoom: recorrer pantallas a 277 y 240 px y buscar desbordes
for (const w of [360, 277, 240]) {
  ctx = await contexto(b, { width: w, height: Math.round(w * 16 / 9) }, { isMobile: false }); page = await ctx.newPage(); err = vigilar(page);
  await empezar(page, 'virginia', { objetivos: ['musculo', 'perder', 'salud'] });
  await page.goto(BASE + '#hoy'); await esperar(300); await page.click('[data-act="entrenador.plan"]');
  for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  const r1 = await ancho();
  await foto(page, `13-${w}-hoja-semana`);
  await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
  const r2 = await ancho(); await foto(page, `13-${w}-hoy`);
  await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(300);
  const r3 = await ancho(); await foto(page, `13-${w}-checkin`);
  await page.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
  const r4 = await ancho(); await foto(page, `13-${w}-sesion`);
  await page.click('[data-act="sesion.ir"][data-v="1"]'); await esperar(200);
  await page.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await esperar(300);
  await foto(page, `13-${w}-sesion-descanso`);
  await page.click('#nav a[href="#perfil"]').catch(() => {}); await page.goto(BASE + '#perfil'); await esperar(300);
  const r5 = await ancho(); await foto(page, `13-${w}-perfil`);
  await page.goto(BASE + '#ejercicios'); await esperar(300);
  const r6 = await ancho(); await foto(page, `13-${w}-ejercicios`);
  console.log(w, 'px desbordes:', JSON.stringify({ semana: r1, hoy: r2, checkin: r3, sesion: r4, perfil: r5, ejercicios: r6 }));
  await ctx.close();
}
await b.close();
