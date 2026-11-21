// Recorrido 18: comprobaciones automáticas de accesibilidad en las pantallas principales (tamaño de los toques,
// nombres accesibles, etiquetas de campos y contraste de los textos más usados).
import { navegador, contexto, vigilar, foto, leer, esperar, empezar } from './comun.mjs';
const b = await navegador();
const ctx = await contexto(b, 'm360'); const page = await ctx.newPage(); vigilar(page);
await empezar(page, 'victor', { objetivos: ['musculo'] });
await page.click('[data-act="perfil.grupo"][data-v="lesiones"]'); await page.click('[data-act="perfil.lesion"]'); await page.click('[data-act="perfil.guardarLesion"]');
await page.click('#nav a[href="#hoy"]'); await page.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
const revisar = () => page.evaluate(() => {
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const fondo = el => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== 'transparent') { const a = (c.match(/[\d.]+/g) || [])[3]; if (a == null || +a > 0.9) return c; } el = el.parentElement; } return 'rgb(7, 8, 15)'; };
  const visibles = [...document.querySelectorAll('button, a, input, select, textarea, summary')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const pequeños = visibles.filter(e => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'); }).map(e => `${e.tagName}${e.dataset.act ? '[' + e.dataset.act + ']' : ''} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)} «${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
  const menos44 = visibles.filter(e => { const r = e.getBoundingClientRect(); return (r.height < 44) && e.tagName === 'BUTTON'; }).length;
  const sinNombre = visibles.filter(e => /BUTTON|A/.test(e.tagName) && !(e.innerText || '').trim() && !e.getAttribute('aria-label')).map(e => e.outerHTML.slice(0, 80));
  const sinEtiqueta = visibles.filter(e => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && e.type !== 'hidden' && !e.closest('label') && !e.getAttribute('aria-label') && !(e.id && document.querySelector(`label[for="${e.id}"]`))).map(e => e.outerHTML.slice(0, 90));
  const textos = [...document.querySelectorAll('.tenue, small, .nav a span, .etiqueta, .insignia, p, h2, .chip')].filter(e => e.getClientRects().length && (e.innerText || '').trim());
  const bajos = [];
  for (const e of textos) { const c = getComputedStyle(e).color; const f = fondo(e); const L1 = lum(c), L2 = lum(f); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); const fs = parseFloat(getComputedStyle(e).fontSize); if (ratio < (fs >= 24 ? 3 : 4.5)) bajos.push(`${e.className || e.tagName} ${fs}px ${ratio.toFixed(2)} «${e.innerText.trim().slice(0, 25)}»`); }
  return { pequeños: pequeños.slice(0, 12), botonesMenos44: menos44 + ' de ' + visibles.filter(e => e.tagName === 'BUTTON').length, sinNombre, sinEtiqueta, contrasteBajo: [...new Set(bajos)].slice(0, 12) };
});
console.log('HOY', JSON.stringify(await revisar(), null, 1));
await page.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
console.log('CHECK-IN', JSON.stringify(await revisar(), null, 1));
await page.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
await page.click('[data-act="sesion.modo"][data-v="lista"]'); await esperar(300);
console.log('SESIÓN', JSON.stringify(await revisar(), null, 1));
await page.click('[data-act="sesion.serie"][data-e="1"][data-s="0"]'); await esperar(300);
console.log('crono role/aria-live:', await page.$eval('#temporizador', e => [e.getAttribute('role'), e.getAttribute('aria-live')]));
console.log('alarma role:', 'button role=alert (se mira al saltar)');
await b.close();
