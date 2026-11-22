import { abrir, foto, BASE, texto } from './h.mjs';
const { browser, context, page } = await abrir({ w: 390, hgt: 844, reducir: true });
const api = []; page.on('request', r => { if (r.url().includes('/api/')) api.push(r.url()); });
await page.goto(BASE + '/'); await page.click('[data-act="bienvenida.elegir"][data-v="victor"]'); await page.waitForSelector('#nav a');
await page.evaluate(async () => { const e = await import('/js/nucleo/estado.js'), ent = await import('/js/areas/entrenador/entrenador.js');
  e.cambiar(S => { S.perfil.objetivos = ['musculo']; S.perfil.usoIA = 'ahorro'; S.perfil.disponibilidad = { dias: 3, minutos: 60, diasSemana: [3, 5, 6] }; }, 'perfil');
  await ent.crearPlanSemana({ dias: [3, 5, 6], minutos: 60, lugares: ['gym'] }, { conIA: false }); });
await page.evaluate(() => { location.hash = '#hoy'; }); await page.waitForTimeout(300);
const L = (...a) => console.log(...a);
// 1) Hoy no puedo (miércoles)
await page.click('[data-act="entrenador.hoyNo"]'); await page.waitForTimeout(300);
L('HOJA hoyNo:', (await texto(page, '.hoja')).replace(/\n+/g, ' | '));
await foto(page, '08-hoyno');
await page.click('[data-act="entrenador.reorganizar"]'); await page.waitForTimeout(400);
L('Tras reorganizar:', (await texto(page)).replace(/\n+/g, ' | ').slice(0, 700));
await foto(page, '08-tras-reorganizar');
// 2) Entrenar igualmente / check-in con «Pedírsela igualmente»
const b = page.locator('[data-act="entrenador.prepararHoy"], [data-act="entrenador.hacerDia"]').first();
L('boton:', await b.textContent()); await b.click(); await page.waitForTimeout(300);
const ia = page.locator('.hoja input[data-cambio="entrenador.ciIA"]');
L('hay casilla IA', await ia.count());
if (await ia.count()) { await ia.check({ force: true }); await page.waitForTimeout(200); L('previa:', (await texto(page, '.hoja .previa')).replace(/\n+/g, ' | ')); }
await page.click('[data-act="entrenador.crearHoy"]'); await page.waitForTimeout(1500);
L('API pedidas:', api);
L('Sesión:', (await texto(page)).replace(/\n+/g, ' | ').slice(0, 500));
await foto(page, '08-sesion-tras-forzar-ia');
// 3) Algo va mal → Termino la sesión aquí
await page.click('#vista [data-act="sesion.algoVaMal"]'); await page.waitForTimeout(300);
L('AVM:', (await texto(page, '.hoja')).replace(/\n+/g, ' | ').slice(0, 600));
await page.click('[data-act="sesion.pararAlarma"]'); await page.waitForTimeout(300);
L('confirm:', (await texto(page, '.hoja:last-of-type')).replace(/\n+/g, ' | '));
await page.locator('button:has-text("Terminar aquí")').click(); await page.waitForTimeout(500);
L('Hoy tras parar:', (await texto(page)).replace(/\n+/g, ' | ').slice(0, 600));
await foto(page, '08-hoy-tras-parar');
L('ERR', page.errores);
await browser.close();
