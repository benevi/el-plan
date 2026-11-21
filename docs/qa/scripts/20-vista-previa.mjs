// Recorrido 20: la vista previa de Vercel (pipos-v2) en Chromium a través del proxy del entorno.
// Uso: ENLACE=<enlace para compartir de Vercel> node 20-vista-previa.mjs <paso>
//   paso «carga»: solo abre y comprueba (sin IA). «codigo»: código de acceso incorrecto (401, sin coste de IA).
//   «plan»: monta la semana con la IA (1 llamada). «sesion»: check-in con petición y lesión (1 llamada).
import { chromium } from 'playwright';
import { contexto, vigilar, foto, leer, botones, esperar } from './comun.mjs';
const PREVIA = 'https://el-plan-git-pipos-v2-benevis-projects.vercel.app/';
if (process.env.BASE !== PREVIA) throw new Error('Lanza con BASE=' + PREVIA);
const paso = process.argv[2] || 'carga';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await contexto(b, 'm390'); const page = await ctx.newPage(); const err = vigilar(page);
const api = []; page.on('response', r => { if (r.url().includes('/api/')) api.push(r.status() + ' ' + r.url().replace(PREVIA, '/')); });
await page.goto(process.env.ENLACE); await page.waitForLoadState('load'); await esperar(1500);
console.log('título:', await page.title(), '| versión:', await page.evaluate(() => document.querySelector('meta[name="pipos-version"]').content));
await page.click('[data-act="bienvenida.elegir"][data-v="' + (paso === 'sesion' ? 'virginia' : 'victor') + '"]');
await page.click('[data-act="perfil.objetivo"][data-v="' + (paso === 'sesion' ? 'salud' : 'musculo') + '"]');
if (paso === 'codigo') {
  await page.click('[data-act="perfil.grupo"][data-v="ajustes"]');
  await page.fill('[data-cambio="perfil.codigo"]', 'cualquiera'); await page.locator('[data-cambio="perfil.codigo"]').blur(); await esperar(300);
}
if (paso === 'sesion') {
  await page.click('[data-act="perfil.grupo"][data-v="lesiones"]');
  await page.click('[data-act="perfil.lesion"]'); await page.selectOption('#l-zona', 'hombro');
  await page.$eval('#l-dolor', el => { el.value = 3; }); await page.fill('#l-desde', '2026-05-01'); await page.click('[data-act="perfil.guardarLesion"]');
  await page.click('[data-act="perfil.grupo"][data-v="entreno"]'); await page.click('[data-act="perfil.usoIA"][data-v="ahorro"]');
}
await page.click('#nav a[href="#hoy"]'); await esperar(400);
if (paso === 'carga') { console.log('Hoy:', (await leer(page)).vista.slice(0, 200)); console.log('errores', err, api); await b.close(); process.exit(0); }
await page.click('[data-act="entrenador.plan"]'); await esperar(300);
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
const conIA = paso === 'plan' || paso === 'codigo';
const t0 = Date.now();
await page.click(`[data-act="entrenador.crearPlan"][data-ia="${conIA ? 1 : 0}"]`);
if (conIA) {
  await esperar(1500); await foto(page, `20-${paso}-espera`);
  console.log('espera:', (await leer(page)).hoja.replace(/\n/g, ' | '));
  await page.waitForFunction(() => !document.querySelector('.hoja.espera'), null, { timeout: 200_000 });
}
console.log('plan en', Date.now() - t0, 'ms | aviso:', (await leer(page)).aviso);
const L = await leer(page); console.log('Hoy:', L.vista);
await foto(page, `20-${paso}-hoy`, { completa: true });
if (paso === 'codigo') {
  const enlace = await page.$('[data-act="perfil.irAjustes"]');
  console.log('enlace a Ajustes:', !!enlace);
  if (enlace) { await enlace.click(); await esperar(400); console.log('tras tocar el enlace:', (await leer(page)).hash, (await leer(page)).vista.split('\n').slice(10, 13).join(' | ')); }
}
if (paso === 'plan') {
  const S = await page.evaluate(() => JSON.parse(localStorage.pipos4));
  console.log('plan:', S.plan.fuente, JSON.stringify(S.plan.dias.map(d => [d.diaSemana, d.nombre, d.lugar, d.minutos, d.ejercicios.map(x => `${x.id} ${x.rol} ${x.series}x${x.reps} ${x.descanso}s`), d.calentamiento.length, d.vuelta.length])));
  console.log('resumen:', S.plan.resumen, '| criterios:', S.plan.criterios, '| progresión:', S.plan.progresion);
}
if (paso === 'sesion') {
  await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
  await page.fill('#ci-peticion', 'Hoy quiero centrarme en pierna y glúteo, la prensa está ocupada');
  await page.locator('#ci-peticion').blur(); await esperar(400);
  console.log('previa:', (await leer(page)).hoja.slice((await leer(page)).hoja.indexOf('CON LO QUE')).replace(/\n/g, ' | '));
  await foto(page, '20-sesion-checkin');
  const t1 = Date.now();
  await page.click('[data-act="entrenador.crearHoy"]'); await esperar(1500);
  console.log('tras preparar (modo ahorro):', (await leer(page)).hash, '| aviso:', (await leer(page)).aviso);
  console.log('nota de la sesión:', (await leer(page)).vista.split('\n').slice(0, 12).join(' | '));
  await foto(page, '20-sesion-ahorro-con-peticion');
  const t2 = Date.now();
  await page.click('[data-act="entrenador.reintentarIA"]'); await esperar(2000);
  await foto(page, '20-sesion-espera');
  console.log('espera:', (await leer(page)).hoja.replace(/\n/g, ' | '));
  await page.waitForFunction(() => !document.querySelector('.hoja.espera'), null, { timeout: 200_000 });
  await esperar(800);
  console.log('reintento en', Date.now() - t2, 'ms');
  console.log('sesión en', Date.now() - t1, 'ms | aviso:', (await leer(page)).aviso, '| hash', (await leer(page)).hash);
  const s = await page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0]);
  console.log('sesión IA:', s.fuente, s.nombre, s.minutos, JSON.stringify(s.ejercicios.map(x => `${x.id} ${x.rol} ${x.series}x${x.reps} ${x.descanso}s kg=${x.kg}`)));
  console.log('calentamiento:', JSON.stringify(s.calentamiento.map(t => t.nombre + ' ' + t.duracion)), '| vuelta:', JSON.stringify(s.vuelta.map(t => t.nombre + ' ' + t.duracion)));
  console.log('explicación:', s.explicacion.join(' || '), '| iaFallo:', JSON.stringify(s.iaFallo));
  await page.click('[data-act="sesion.modo"][data-v="lista"]').catch(() => {});
  await foto(page, '20-sesion-ia', { completa: true });
}
console.log('api:', api); console.log('errores', err);
await b.close();
