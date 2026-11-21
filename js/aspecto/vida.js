// Área ASPECTO · vida: respuesta física y celebración. No toca datos ni lógica.
// Presupuesto de movimiento (DIS 3, 2.4): durante la serie no se mueve nada salvo el reloj, así que al
// marcar una serie o una tarea solo hay un toque corto de vibración. Al guardar la sesión, una
// celebración de menos de 1,5 s con los colores de la marca (lima y rosa), nunca en bucle; con
// «reducir movimiento» no hay celebración (la información es la misma: el aviso «¡Sesión guardada!»).
// El final con el agua que sube llega con el PR 15.

import { movimientoReducido } from '../nucleo/ui.js';

const toque = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* sin vibración */ } };

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="sesion.serie"], [data-act="sesion.tarea"]');
  if (b && b.getAttribute('aria-pressed') === 'false') toque(12);
  if (e.target.closest('[data-act="sesion.cerrar"]')) {
    setTimeout(() => { toque([30, 60, 30]); if (!movimientoReducido()) confeti({ n: 90 }); }, 250);
  }
}, true);

// ── Celebración ──
function colores() {
  const cs = getComputedStyle(document.documentElement);
  const v = k => cs.getPropertyValue(k).trim();
  return [v('--acento'), v('--p-lima-300'), v('--p-rosa-300'), v('--texto-1')].filter(Boolean);
}
export function confeti({ x = innerWidth / 2, y = innerHeight * 0.35, n = 90, fuerza = 10 } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti';
  lienzo.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, devicePixelRatio || 1);
  lienzo.width = innerWidth * dpr; lienzo.height = innerHeight * dpr;
  document.body.appendChild(lienzo);
  const c = lienzo.getContext('2d');
  if (!c) { lienzo.remove(); return; }
  c.scale(dpr, dpr);
  const col = colores();
  const ps = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, v = fuerza * (0.4 + Math.random() * 0.8);
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - fuerza * 0.6, g: 0.28 + Math.random() * 0.12, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 5 + Math.random() * 5, h: 3 + Math.random() * 3, c: col[(Math.random() * col.length) | 0] };
  });
  const t0 = performance.now(), dur = 1400;
  (function cuadro(t) {
    const k = (t - t0) / dur;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
    ps.forEach(p => {
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
    });
    if (k < 1) requestAnimationFrame(cuadro); else lienzo.remove();
  })(t0);
}
