// Área ASPECTO · movimiento: el cambio de pantalla del sistema (DIS 3, apartado 2.4). No toca datos.
// Eje horizontal compartido: la pantalla anterior sale en 150 ms y la nueva entra en 300 ms con una
// cascada de 50 ms entre sus primeros bloques (máximo 5): en total, menos de 600 ms. Solo transform y
// opacity. Con «reducir movimiento» se cambia directamente, sin desplazamientos (R25).
//
//   const terminar = cambioDePantalla(main, 'adelante' | 'atras');  // antes de pintar la nueva
//   …pintar…
//   terminar();                                                       // después de pintarla

import { movimientoReducido } from '../nucleo/ui.js';

let tLimpiar = null;
let estilos = null; // las hojas de estilo de la app, una vez, para pintar la copia que sale

// La pantalla que se va es una copia muda dentro de una raíz oculta (shadow DOM cerrado): se ve igual,
// pero ningún selector del documento (ni el lector de pantalla, ni las pruebas) la encuentra.
function estilosDeLaApp() {
  if (estilos) return estilos;
  try {
    const css = [...document.styleSheets].map(h => { try { return [...h.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    estilos = new CSSStyleSheet();
    estilos.replaceSync(css);
  } catch { estilos = null; }
  return estilos;
}

export function cambioDePantalla(main, dir = 'adelante') {
  if (!main || movimientoReducido() || typeof document === 'undefined') return null;
  document.documentElement.dataset.dir = dir;
  document.querySelectorAll('.saliente').forEach(n => n.remove());
  const hoja = main.childElementCount && typeof main.attachShadow === 'function' ? estilosDeLaApp() : null;
  if (hoja) {
    const capa = document.createElement('div');
    capa.className = 'saliente';
    capa.setAttribute('aria-hidden', 'true');
    capa.setAttribute('inert', '');
    const raiz = capa.attachShadow({ mode: 'closed' });
    raiz.adoptedStyleSheets = [hoja];
    const dentro = document.createElement('div');
    dentro.className = 'saliente-dentro';
    // CSSOM (no es un atributo style en el HTML): la copia queda donde estaba, con el desplazamiento.
    const cab = document.querySelector('body > .cab');
    const alto = cab && !document.body.classList.contains('sin-nav') ? cab.offsetHeight : 0;
    dentro.style.paddingTop = `${alto}px`;
    dentro.style.marginTop = `${-window.scrollY}px`;
    for (const n of main.children) {
      const c = n.cloneNode(true);
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      dentro.appendChild(c);
    }
    raiz.appendChild(dentro);
    document.body.appendChild(capa);
    capa.addEventListener('animationend', () => capa.remove(), { once: true });
    setTimeout(() => capa.remove(), 400);
  }
  return () => {
    main.classList.remove('entra');
    void main.offsetWidth; // reinicia la animación
    main.classList.add('entra');
    clearTimeout(tLimpiar);
    tLimpiar = setTimeout(() => main.classList.remove('entra'), 700);
  };
}
