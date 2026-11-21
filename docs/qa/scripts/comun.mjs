// Utilidades comunes de la sesión de pruebas (QA 21-11-2026). Solo para probar: no forman parte de la app.
// Uso: import { abrir, ... } from './comun.mjs'. Servidor local: python3 -m http.server 8795 desde la raíz.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.BASE || 'http://127.0.0.1:8795/';
export const CAPTURAS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../capturas');
export const MOVILES = { m360: { width: 360, height: 640 }, m390: { width: 390, height: 844 }, m412: { width: 412, height: 922 } };
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function navegador() {
  return chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
}

// Contexto de móvil con espía de navigator.vibrate y sin nada de fuera del servidor local.
export async function contexto(browser, movil = 'm390', extra = {}) {
  const ctx = await browser.newContext({
    viewport: MOVILES[movil] || movil, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    ...extra,
  });
  await ctx.addInitScript(() => {
    window.__vib = [];
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function (p) { window.__vib.push({ t: Date.now(), p, oculto: document.hidden }); return true; } }); } catch (e) { /* nada */ }
  });
  const base = new URL(BASE);
  await ctx.route(u => u.hostname !== base.hostname, r => {
    const tipo = r.request().resourceType();
    if (tipo === 'image') return r.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
    return r.fulfill({ status: 204, body: '' });
  });
  return ctx;
}

export function vigilar(page) {
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.type() + ': ' + m.text()); });
  page.on('dialog', d => { errores.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  return errores;
}

export async function foto(page, nombre, op = {}) {
  const f = path.join(CAPTURAS, nombre + '.png');
  await page.screenshot({ path: f, fullPage: !!op.completa });
  return f;
}

// Texto visible de la pantalla y de la hoja abierta (para leer en la consola).
export async function leer(page) {
  return page.evaluate(() => {
    const t = el => el ? el.innerText.replace(/\n{2,}/g, '\n').trim() : '';
    return { hash: location.hash, titulo: document.title, vista: t(document.querySelector('#vista')), hoja: t(document.querySelector('.hoja')), aviso: t(document.querySelector('#aviso.ver')), crono: t(document.querySelector('#temporizador')), alarma: t(document.querySelector('.alarma')) };
  });
}
export async function botones(page, raiz = 'body') {
  return page.evaluate(r => [...document.querySelector(r).querySelectorAll('[data-act],[data-t],a[href^="#"]')].filter(b => b.offsetParent || b.getClientRects().length).map(b => `${b.dataset.act || b.dataset.t || b.getAttribute('href')}${b.dataset.v != null ? '=' + b.dataset.v : ''} «${(b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40)}»${b.disabled ? ' [off]' : ''}`), raiz);
}
export const esperar = ms => new Promise(r => setTimeout(r, ms));

// Crea un perfil básico desde la interfaz (sin tocar el almacén por debajo).
export async function empezar(page, quien = 'victor', { objetivos = ['musculo'], lugares } = {}) {
  await page.goto(BASE);
  await page.click(`[data-act="bienvenida.elegir"][data-v="${quien}"]`);
  await page.waitForSelector('[data-act="perfil.objetivo"]');
  for (const o of objetivos) await page.click(`[data-act="perfil.objetivo"][data-v="${o}"]`);
  if (lugares) {
    await page.click('[data-act="perfil.grupo"][data-v="entreno"]');
    const ahora = await page.$$eval('[data-act="perfil.lugar"].on', bs => bs.map(b => b.dataset.v));
    for (const l of lugares) if (!ahora.includes(l)) await page.click(`[data-act="perfil.lugar"][data-v="${l}"]`);
    for (const l of ahora) if (!lugares.includes(l)) await page.click(`[data-act="perfil.lugar"][data-v="${l}"]`);
  }
}
