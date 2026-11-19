// Área ASPECTO · vida: movimiento y respuesta visual. No toca datos ni lógica.
// - Al cambiar de pantalla, las tarjetas entran escalonadas (solo al navegar, no en cada repintado).
// - Al marcar una serie o una tarea, la casilla «salta» y el móvil da un toque corto.
// - Al completar un ejercicio, la tarjeta brilla; al guardar la sesión, confeti con los colores de la marca.
// Respeta «reducir movimiento» del sistema.

const reducir = matchMedia('(prefers-reduced-motion: reduce)');
const toque = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };

// ── Entrada al navegar ──
let tEntrada = null;
function entrada() {
  if (reducir.matches) return;
  const v = document.getElementById('vista'), n = document.getElementById('nav');
  [v, n].forEach(el => { if (!el) return; el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra'); });
  clearTimeout(tEntrada);
  tEntrada = setTimeout(() => [v, n].forEach(el => el && el.classList.remove('entra')), 900);
}
addEventListener('hashchange', entrada);
requestAnimationFrame(entrada);

// ── Respuesta al marcar ──
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act="sesion.serie"], [data-act="sesion.tarea"]');
  if (b && b.getAttribute('aria-pressed') === 'false') {
    const sel = b.dataset.act === 'sesion.serie'
      ? `[data-act="sesion.serie"][data-e="${b.dataset.e}"][data-s="${b.dataset.s}"]`
      : `[data-act="sesion.tarea"][data-k="${b.dataset.k}"][data-i="${b.dataset.i}"]`;
    toque(12);
    // Antes del repintado: ¿era la última serie pendiente del ejercicio? (en «uno a uno» la app pasa al siguiente)
    const ultima = b.dataset.act === 'sesion.serie' &&
      document.querySelectorAll(`[data-act="sesion.serie"][data-e="${b.dataset.e}"][aria-pressed="false"]`).length === 1;
    const r0 = b.getBoundingClientRect();
    // La pantalla se repinta tras el clic: buscamos la casilla nueva.
    setTimeout(() => {
      if (reducir.matches) return;
      const nueva = document.querySelector(sel);
      if (nueva) nueva.classList.add('pop');
      if (!ultima) return;
      const ej = nueva && nueva.closest('.ejercicio');
      if (ej) ej.classList.add('celebra');
      const r = nueva ? nueva.getBoundingClientRect() : r0;
      confeti({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 40, fuerza: 7 });
      toque([18, 40, 18]);
    }, 30);
  }
  if (e.target.closest('[data-act="sesion.cerrar"]')) {
    setTimeout(() => { toque([30, 60, 30, 60, 60]); if (!reducir.matches) confeti({ n: 140 }); }, 250);
  }
}, true);

// ── Confeti ──
function colores() {
  const cs = getComputedStyle(document.documentElement);
  const v = k => cs.getPropertyValue(k).trim();
  return [v('--acc') || '#4DD0E8', v('--brand-1') || '#4DD0E8', v('--brand-2') || '#C77DFF', '#FFFFFF', v('--ok') || '#5BD69A'];
}
export function confeti({ x = innerWidth / 2, y = innerHeight * 0.35, n = 120, fuerza = 11 } = {}) {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti';
  const dpr = Math.min(2, devicePixelRatio || 1);
  lienzo.width = innerWidth * dpr; lienzo.height = innerHeight * dpr;
  document.body.appendChild(lienzo);
  const c = lienzo.getContext('2d'); c.scale(dpr, dpr);
  const col = colores();
  const ps = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2, v = fuerza * (0.4 + Math.random() * 0.8);
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - fuerza * 0.6, g: 0.28 + Math.random() * 0.12, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, c: col[(Math.random() * col.length) | 0] };
  });
  const t0 = performance.now(), dur = 1600;
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
