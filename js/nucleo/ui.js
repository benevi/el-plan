// Piezas de interfaz comunes: escapar texto, avisos, hojas inferiores, confirmaciones e iconos.
// Las áreas pintan HTML con plantillas y usan data-act="area.accion" para los botones (ver acciones.js).

export const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? null : x; };
export const es = (v, dec = 1) => v == null ? '' : (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('es-ES');

export function fechaLarga(iso) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00' : ''));
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fechaCorta(iso) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00' : ''));
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
export function mmss(seg) {
  seg = Math.max(0, Math.round(seg));
  return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
}

// ── Aviso breve ──
let tAviso = null;
export function aviso(txt, tipo = '') {
  let el = $('#aviso');
  if (!el) { el = document.createElement('div'); el.id = 'aviso'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'aviso ' + tipo;
  el.textContent = txt;
  requestAnimationFrame(() => el.classList.add('ver'));
  clearTimeout(tAviso);
  tAviso = setTimeout(() => el.classList.remove('ver'), 3200);
}

// ── Hoja inferior ──
// abrirHoja(html) muestra un panel; cerrarHoja() lo quita. Los botones dentro usan data-act como siempre.
export function abrirHoja(html, { clase = '' } = {}) {
  cerrarHoja();
  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo';
  fondo.innerHTML = `<div class="hoja ${clase}" role="dialog" aria-modal="true"><div class="hoja-asa"></div>${html}</div>`;
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrarHoja(); });
  document.body.appendChild(fondo);
  document.body.classList.add('con-hoja');
  requestAnimationFrame(() => fondo.classList.add('ver'));
  const primero = fondo.querySelector('input, select, textarea');
  if (primero && !primero.dataset.noFoco) setTimeout(() => primero.focus(), 200);
  return fondo.firstElementChild;
}
export function cerrarHoja() {
  $$('.hoja-fondo').forEach(f => f.remove());
  document.body.classList.remove('con-hoja');
}

export function confirmar(txt, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  return new Promise(res => {
    const hoja = abrirHoja(`<p class="hoja-texto">${h(txt)}</p>
      <div class="fila-botones"><button class="btn sec" data-r="0">${h(no)}</button><button class="btn ${peligro ? 'peligro' : ''}" data-r="1">${h(si)}</button></div>`);
    hoja.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      cerrarHoja(); res(b.dataset.r === '1');
    });
  });
}

// ── Iconos (trazo, 24×24) ──
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONOS = {
  hoy: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  progreso: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  ejercicios: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'),
  perfil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  ia: svg('<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'),
  play: svg('<path d="M7 4v16l13-8z"/>'),
  pausa: svg('<path d="M8 4v16M16 4v16"/>'),
  check: svg('<path d="M4 12.5 9.5 18 20 6"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
  menos: svg('<path d="M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  atras: svg('<path d="M15 5l-7 7 7 7"/>'),
  sig: svg('<path d="M9 5l7 7-7 7"/>'),
  reloj: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  video: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>'),
  lista: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  foco: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/>'),
  editar: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  basura: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};
