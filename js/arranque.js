// Script clásico (no módulo) que se carga antes que js/main.js. Es externo, no en línea, para la CSP.
// 1) Aviso de red: la sesión ya creada funciona sin conexión; crear una nueva usa las reglas.
// 2) Vigilante de arranque: si main.js no marca el arranque en unos segundos (un módulo que no llegó,
//    una versión a medias), en vez de dejar la pantalla en blanco explica qué hacer y deja recargar.
//    main.js marca el arranque con <html data-arrancado> y el evento «pipos:arrancado».
(function () {
  'use strict';
  var ESPERA = 6000;

  function red() {
    var el = document.getElementById('red');
    if (el) el.hidden = navigator.onLine !== false;
  }
  addEventListener('online', red);
  addEventListener('offline', red);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', red); else red();

  var arrancado = function () { return document.documentElement.hasAttribute('data-arrancado'); };
  var panel = null;

  function quitar() { if (panel) { panel.remove(); panel = null; } }

  // Estilos con CSSOM (no atributos style ni CSS en línea) y sin depender de que haya cargado el CSS.
  function mostrar() {
    if (panel || arrancado() || !document.body) return;
    panel = document.createElement('div');
    panel.id = 'fallo-arranque';
    panel.setAttribute('role', 'alert');
    var s = panel.style;
    s.position = 'fixed'; s.inset = '0'; s.zIndex = '1000'; s.display = 'flex'; s.flexDirection = 'column';
    s.alignItems = 'center'; s.justifyContent = 'center'; s.gap = '18px'; s.padding = '24px';
    s.background = '#07080F'; s.color = '#EEF0F7'; s.textAlign = 'center';
    s.font = '17px/1.45 system-ui, -apple-system, sans-serif';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.style.maxWidth = '22em';
    p.textContent = 'No se pudo actualizar: conéctate y vuelve a abrir.';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Volver a intentar';
    var bs = b.style;
    bs.minHeight = '48px'; bs.padding = '0 22px'; bs.border = '0'; bs.borderRadius = '14px';
    bs.background = '#4DD0E8'; bs.color = '#06121A'; bs.font = '600 16px system-ui, sans-serif';
    b.addEventListener('click', function () { location.reload(); });
    panel.appendChild(p);
    panel.appendChild(b);
    document.body.appendChild(panel);
  }

  setTimeout(mostrar, ESPERA);
  // Si un módulo no llega (o llega otra cosa en su lugar), el <script type="module"> lanza «error»:
  // no hace falta esperar a que pase el tiempo.
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.type === 'module') setTimeout(mostrar, 300);
  }, true);
  // Si al final arranca (red muy lenta), se quita el aviso.
  addEventListener('pipos:arrancado', quitar);
})();
