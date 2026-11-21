// Script clásico (no módulo) que se carga antes que js/main.js. Es externo, no en línea, para la CSP.
// 1) Aviso de red: la sesión ya creada funciona sin conexión; crear una nueva usa las reglas.
// 2) Vigilante de arranque: si main.js no marca el arranque (<html data-arrancado> y el evento
//    «pipos:arrancado») en unos segundos, o un módulo no llega, en vez de dejar la pantalla en blanco:
//    - con un service worker que controla la página y una red que de verdad sirve la app (se comprueba
//      pidiendo index.html, máx. 4,5 s), una sola vez por pestaña (marca en sessionStorage): borra las
//      cachés pipos-app-*, da de baja el service worker y recarga desde la red;
//    - si no, «No se pudo actualizar: conéctate y vuelve a abrir» con «Volver a intentar» (que activa
//      la versión que esté esperando, si la hay).
//    Si la página aún no la controla un service worker de esta app (primera instalación o paso desde
//    main, con la red lenta), primero dice «Sigue cargando…» y espera más antes de dar el error.
(function () {
  'use strict';
  var ESPERA = 6000;
  var ESPERA_LARGA = 20000;
  var ESPERA_RED = 4500;
  var MARCA_RESCATE = 'pipos-rescate';

  function red() {
    var el = document.getElementById('red');
    if (el) el.hidden = navigator.onLine !== false;
  }
  addEventListener('online', red);
  addEventListener('offline', red);
  red();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', red);

  var arrancado = function () { return document.documentElement.hasAttribute('data-arrancado'); };
  var sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  var panel = null;
  var decidido = false;
  var tLargo = null;

  function marca(valor) {
    try {
      if (valor === undefined) return sessionStorage.getItem(MARCA_RESCATE);
      if (valor === null) sessionStorage.removeItem(MARCA_RESCATE); else sessionStorage.setItem(MARCA_RESCATE, valor);
    } catch (e) { return '1'; } // sin sessionStorage no se intenta el rescate (no habría freno al bucle)
    return null;
  }

  function quitar() { if (panel) { panel.remove(); panel = null; } }

  // Estilos con CSSOM (no atributos style ni CSS en línea) y sin depender de que haya cargado el CSS.
  function pintar(texto, conBoton) {
    if (!document.body) return;
    quitar();
    panel = document.createElement('div');
    panel.id = 'fallo-arranque';
    panel.setAttribute('role', conBoton ? 'alert' : 'status');
    var s = panel.style;
    s.position = 'fixed'; s.inset = '0'; s.zIndex = '1000'; s.display = 'flex'; s.flexDirection = 'column';
    s.alignItems = 'center'; s.justifyContent = 'center'; s.gap = '18px'; s.padding = '24px';
    s.background = '#081723'; s.color = '#EDF3F7'; s.textAlign = 'center'; // --sup-fondo y --texto-1 (aún sin CSS)
    s.font = '17px/1.45 system-ui, -apple-system, sans-serif';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.style.maxWidth = '22em';
    p.textContent = texto;
    panel.appendChild(p);
    if (conBoton) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Volver a intentar';
      var bs = b.style;
      bs.minHeight = '48px'; bs.padding = '0 22px'; bs.border = '0'; bs.borderRadius = '999px';
      bs.background = '#EDF3F7'; bs.color = '#081723'; bs.font = '600 16px system-ui, sans-serif';
      b.addEventListener('click', reintentar);
      panel.appendChild(b);
    }
    document.body.appendChild(panel);
  }

  // Si hay una versión esperando, la activa y recarga cuando tome el control; si no, recarga.
  function reintentar() {
    if (!sw) { location.reload(); return; }
    sw.getRegistration().then(function (r) {
      if (!r || !r.waiting) { location.reload(); return; }
      sw.addEventListener('controllerchange', function () { location.reload(); });
      r.waiting.postMessage({ tipo: 'actualizar' });
      setTimeout(function () { location.reload(); }, 3000);
    }).catch(function () { location.reload(); });
  }

  // ¿La página la controla un service worker de esta app (con su caché pipos-app-*)?
  function controladaPorLaApp() {
    if (!sw || !sw.controller || typeof caches === 'undefined') return Promise.resolve(false);
    return caches.keys().then(function (ks) {
      return ks.some(function (k) { return k.indexOf('pipos-app-') === 0; });
    }).catch(function () { return false; });
  }

  // Salida de emergencia: la caché de la versión no sirve (no arranca) y hay red. Una vez por pestaña.
  function rescatar() {
    marca('1');
    pintar('Reparando la app…', false);
    var borrar = caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('pipos-app-') === 0; }).map(function (k) { return caches.delete(k); }));
    });
    var baja = sw.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); });
    Promise.all([borrar, baja]).catch(function () {}).then(function () { location.reload(); });
  }

  // ¿La red sirve de verdad? navigator.onLine miente a menudo (wifi del gimnasio sin salida). Pide
  // index.html saltándose el service worker (?comprobar-red, ver sw.js) y sin caché, con límite de tiempo.
  function redDeVerdad() {
    if (typeof fetch === 'undefined') return Promise.resolve(false);
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var limite = new Promise(function (res) { setTimeout(function () { if (ctl) ctl.abort(); res(false); }, ESPERA_RED); });
    var pedida = fetch('./index.html?comprobar-red=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.status === 200 ? r.text() : ''; })
      .then(function (t) { return t.indexOf('<meta name="pipos-version"') !== -1; })
      .catch(function () { return false; });
    return Promise.race([pedida, limite]);
  }

  function fallo() {
    if (decidido || arrancado()) return;
    decidido = true;
    clearTimeout(tLargo);
    var error = function () { pintar('No se pudo actualizar: conéctate y vuelve a abrir.', true); };
    if (!(sw && sw.controller && navigator.onLine !== false && typeof caches !== 'undefined' && !marca())) { error(); return; }
    // Solo se tira la caché si la red sirve la app: si no, se quedaría sin app y sin conexión.
    pintar('Comprobando la conexión…', false);
    redDeVerdad().then(function (ok) { if (arrancado()) return; if (ok) rescatar(); else error(); });
  }

  // Pasó el plazo corto: error, salvo que la app todavía se esté instalando por primera vez.
  function plazo() {
    if (decidido || arrancado()) return;
    controladaPorLaApp().then(function (deLaApp) {
      if (decidido || arrancado()) return;
      if (deLaApp) { fallo(); return; }
      pintar('Sigue cargando…', false);
      tLargo = setTimeout(fallo, ESPERA_LARGA - ESPERA);
    });
  }

  setTimeout(plazo, ESPERA);
  // Si un módulo no llega (o llega otra cosa en su lugar), el <script type="module"> lanza «error»:
  // no hace falta esperar al plazo.
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.type === 'module') setTimeout(fallo, 300);
  }, true);
  // Si al final arranca (red muy lenta), se quita el aviso y se olvida el rescate.
  addEventListener('pipos:arrancado', function () { clearTimeout(tLargo); quitar(); marca(null); });
})();
