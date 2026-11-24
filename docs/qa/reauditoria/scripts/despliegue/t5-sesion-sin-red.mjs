// T5: instalar v2 con red, crear la sesión de hoy (IA caída → reglas), modo avión, cerrar y reabrir,
// y hacer la sesión sin red: empezar, serie hecha, descanso, terminar y que quede guardada. Puerto 8931.
import { crearServidor, RAIZ } from '/home/user/wt/auditoria/tests/e2e/servidor.mjs';
import { navegador, contexto, acts, planYSesion, sesiones } from './comun-pw.mjs';
const srv = crearServidor({ raiz: RAIZ });
srv.control.api = (q, s) => { s.writeHead(503, { 'content-type': 'application/json' }); s.end('{"error":"sin IA"}'); };
await srv.escuchar(8931);
const b = await navegador(); const ctx = await contexto(b, 8931);
let page = await ctx.newPage(); const errores = []; const vig = p => p.on('pageerror', e => errores.push(e.message)); vig(page);
const log = (...a) => console.log('·', ...a);
try {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await planYSesion(page);
  log('con red, creada:', JSON.stringify(await sesiones(page)), page.url());
  await ctx.setOffline(true);
  await page.close(); page = await ctx.newPage(); vig(page);
  await page.goto('/');
  await page.waitForSelector('#nav a', { timeout: 15000 });
  log('sin red, Hoy acciones:', JSON.stringify(await acts(page)));
  await page.locator('.accion-hoy a, .accion-hoy [data-act]').first().click();
  await page.waitForTimeout(600);
  log('url:', page.url(), JSON.stringify((await acts(page)).slice(0, 12)));
  await page.click('[data-act="sesion.ir"][data-v="1"]'); await page.waitForTimeout(300);
  await page.locator('[data-act="sesion.serie"]:visible').first().click(); await page.waitForTimeout(600);
  log('tras la serie, acciones:', JSON.stringify((await acts(page)).filter(x => !/sesion.ir/.test(x))));
  log('descanso/alarma:', await page.locator('[class*="descanso"]:visible').count(), await page.locator('[data-act="sesion.pararAlarma"]').count());
  await ctx.clock.runFor(200000).catch(e => log('runFor', e.message));
  await page.waitForTimeout(500);
  log('tras el descanso, alarma:', await page.locator('[data-act="sesion.pararAlarma"]:visible').count());
  await page.locator('[data-act="sesion.terminar"]:visible').first().click(); await page.waitForTimeout(400);
  log('hoja terminar:', JSON.stringify(await acts(page)));
  for (let i = 0; i < 4; i++) { const t = page.locator('.hoja [data-act="sesion.terminar"]:visible, .hoja [data-act="sesion.cerrar"]:visible').last(); if (!await t.count()) break; log('toco', (await t.innerText()).trim()); await t.click(); await page.waitForTimeout(500); }
  log('tras tocar:', (await page.locator('#vista').innerText()).slice(0, 250).replace(/\n+/g, ' / '));
  log('descanso/cronómetro en pantalla:', await page.locator('[class*="descanso"]:visible, [class*="crono"]:visible, [class*="tempor"]:visible').count());
  log('guardado:', JSON.stringify(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pipos4')).sesiones).map(s => ({ estado: s.estado, ej: s.ejercicios.map(e => (e.hechas || e.registro || []).length) })))));
  log('errores:', JSON.stringify(errores));
} catch (e) { console.error('FALLO', e.message.split('\n')[0]); }
finally { await b.close(); await srv.cerrar(); }
