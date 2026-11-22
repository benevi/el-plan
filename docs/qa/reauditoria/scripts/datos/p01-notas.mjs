// ¿Se guarda lo escrito en «Para tu entrenador» (Perfil › Datos) si se sale con «atrás», cambiando de app
// o tocando una pestaña? El campo usa data-cambio (evento 'change', que solo llega al perder el foco).
import { chromium, devices } from '/home/user/wt/auditoria/node_modules/playwright/index.mjs';
import { crearServidor } from '/home/user/wt/auditoria/tests/e2e/servidor.mjs';
const PUERTO = 8921;
const srv = crearServidor(); await srv.escuchar(PUERTO);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const base = `http://127.0.0.1:${PUERTO}`;
async function caso(nombre, salir) {
  const ctx = await nav.newContext({ ...devices['Pixel 7'] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  await page.goto(base + '/');
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await page.waitForSelector('#nav a');
  await page.goto(base + '/#perfil');
  await page.click('[data-act="perfil.grupo"][data-v="datos"]');
  await page.waitForSelector('#d-notas');
  await page.click('#d-notas');
  await page.keyboard.type('Los martes salgo tarde; nada de saltos por la rodilla');
  await salir(page);
  await page.waitForTimeout(600);
  const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('pipos4')).perfil.notas);
  console.log(nombre.padEnd(48), '→ guardado:', JSON.stringify(ls));
  await ctx.close();
}
await caso('tocar la pestaña Hoy', p => p.click('#nav a[href="#hoy"]'));
await caso('botón atrás (history.back)', p => p.evaluate(() => history.back()));
await caso('pasar a segundo plano (visibilitychange+pagehide)', p => p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));
}));
await caso('recargar / cerrar la pestaña (page.reload)', p => p.reload());
await nav.close(); try { srv.cerrar ? srv.cerrar() : srv.servidor?.close(); } catch {}
process.exit(0);
