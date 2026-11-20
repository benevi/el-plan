// Índice: compara la misma pantalla en las tres direcciones, con la persona y el tamaño de móvil elegidos.
const estado = { vista: 'hoy', p: 'victor', tam: '390x844' };
try { Object.assign(estado, JSON.parse(localStorage.getItem('identidad.indice') || '{}')); } catch { /* sin almacenamiento */ }

const marcos = [...document.querySelectorAll('.marco')];
const carrusel = document.getElementById('carrusel');

function ruta(dir) {
  const cierre = estado.vista === 'cierre';
  return `${dir}/?marco&p=${estado.p}${cierre ? '&cierre' : ''}#${cierre ? 'sesion' : estado.vista}`;
}

function encajar() {
  const [w, h] = estado.tam.split('x').map(Number);
  // En el móvil cada marco ocupa el ancho disponible (menos los márgenes); en pantallas grandes, a tamaño real.
  const disponible = Math.min(carrusel.clientWidth - 32, w);
  const escala = Math.min(1, disponible / w);
  for (const m of marcos) {
    const caja = m.querySelector('.caja');
    const fr = m.querySelector('iframe');
    caja.style.width = `${Math.round(w * escala)}px`;
    caja.style.height = `${Math.round(h * escala)}px`;
    fr.style.width = `${w}px`; fr.style.height = `${h}px`;
    fr.style.transform = `scale(${escala})`;
    m.style.width = `${Math.round(w * escala)}px`;
  }
}

function pintar() {
  document.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', String(estado[b.dataset.k] === b.dataset.v)));
  for (const m of marcos) {
    const fr = m.querySelector('iframe');
    const nueva = ruta(m.dataset.dir);
    if (fr.getAttribute('src') !== nueva) fr.setAttribute('src', nueva);
  }
  encajar();
  try { localStorage.setItem('identidad.indice', JSON.stringify(estado)); } catch { /* da igual */ }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (!b) return;
  estado[b.dataset.k] = b.dataset.v;
  pintar();
});
addEventListener('resize', encajar);
pintar();
