// Piezas comunes de los recorridos de despliegue (Playwright con el Chromium del entorno).
import { chromium, devices } from 'playwright';
export const LUNES = new Date('2026-11-16T09:00:00+01:00');
export async function navegador() { return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
export async function contexto(b, puerto, { reloj = LUNES } = {}) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], baseURL: `http://127.0.0.1:${puerto}` });
  await ctx.route(u => !['127.0.0.1', 'localhost'].includes(u.hostname), r => r.fulfill({ status: 204, body: '' }));
  if (reloj) await ctx.clock.install({ time: reloj });
  return ctx;
}
export const acts = page => page.locator('[data-act]:visible').evaluateAll(xs => xs.map(x => x.dataset.act + (x.dataset.v ? '=' + x.dataset.v : '') + ' :: ' + x.textContent.trim().slice(0, 30)));
// Plan por reglas L-X-V y la sesión de hoy (lunes) creada por la app.
export async function planYSesion(page) {
  await page.click('[data-act="perfil.objetivo"]:has-text("Ganar fuerza")');
  await page.click('#nav a[href="#hoy"]');
  await page.click('[data-act="entrenador.plan"]');
  for (const d of [1, 3, 5]) { const c = page.locator(`[data-act="entrenador.psDia"][data-v="${d}"]`); if (await c.getAttribute('aria-pressed') !== 'true') await c.click(); }
  await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]');
  await page.locator('.accion-hoy [data-act="entrenador.prepararHoy"]').click();
  await page.click('[data-act="entrenador.crearHoy"]');
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('pipos4')).sesiones || {}).length > 0, null, { timeout: 30000 });
}
export const sesiones = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pipos4') || '{}').sesiones || {}).map(s => ({ id: s.id, fecha: s.fecha, estado: s.estado, fuente: s.fuente })));
