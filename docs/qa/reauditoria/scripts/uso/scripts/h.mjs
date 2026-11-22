// Utilidades de la auditoría de uso.
import { chromium } from '/home/user/wt/auditoria/node_modules/playwright/index.mjs';
import fs from 'node:fs';
export const BASE = 'http://127.0.0.1:' + (process.env.PUERTO || 8961);
export const DIR = '/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/uso/capturas';
const { medirEnPagina } = await import('/home/user/wt/auditoria/tests/e2e/medir-contraste.mjs');
export { medirEnPagina };
export async function abrir({ w = 390, hgt = 844, reducir = false, tiempo = '2026-11-18T18:00:00+01:00', reloj = 'install', escala = 1 } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: escala, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await context.route(u => !['127.0.0.1', 'localhost'].includes(new URL(u).hostname), r => r.fulfill({ status: 204, body: '' }));
  await context.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sin IA"}' }));
  const page = await context.newPage();
  page.errores = [];
  page.on('pageerror', e => page.errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/503|Failed to load/.test(m.text())) page.errores.push('console: ' + m.text()); });
  await page.addInitScript(() => { window.__vibra = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__vibra.push(p); return true; } }); });
  if (reducir) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (reloj === 'install') await page.clock.install({ time: new Date(tiempo) });
  else if (reloj === 'fijo') await page.clock.setFixedTime(new Date(tiempo));
  return { browser, context, page };
}
export async function foto(page, nombre, full = false) { fs.mkdirSync(DIR, { recursive: true }); await page.screenshot({ path: `${DIR}/${nombre}.png`, fullPage: full }); }
// Controles visibles pequeños: limite px
export async function pequenos(page, limite = 44, raizSel = 'body') {
  return page.evaluate(([limite, raizSel]) => {
    const out = [];
    for (const el of document.querySelectorAll(raizSel + ' :is(button, a[href], summary, input:not([type=hidden]), select, textarea, [role=radio], [role=spinbutton], [tabindex="0"])')) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height || el.closest('[hidden], .solo-lector, [inert]')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
      if (b.width < limite - 0.5 || b.height < limite - 0.5) out.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)} [${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}] ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    return out;
  }, [limite, raizSel]);
}
export async function contraste(page, sel = 'body') {
  const r = await page.evaluate(medirEnPagina, sel);
  return Object.values(r.muestras).flatMap(x => x.detalle).filter(p => !p.ok).map(p => `${p.tipo} «${p.que}» ${p.fg}/${p.bg} ${p.r}<${p.min}`);
}
export async function desborde(page) { return page.evaluate(() => document.documentElement.scrollWidth - innerWidth); }
export async function botones(page, sel = '#vista') {
  return page.evaluate(sel => [...document.querySelectorAll(sel + ' :is(button, a[href], summary, [data-act], [data-cambio])')].filter(e => e.getBoundingClientRect().width).map(e => `${e.tagName.toLowerCase()} ${e.dataset.act || e.dataset.cambio || e.getAttribute('href') || ''} «${(e.getAttribute('aria-label') || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 50)}»`), sel);
}
export async function estado(page) { return page.evaluate(async () => (await import('/js/nucleo/estado.js')).estado()); }
export async function texto(page, sel = '#vista') { return page.evaluate(sel => (document.querySelector(sel) || {}).innerText, sel); }
