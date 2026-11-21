// Motor común de las muestras de identidad: persona, rutas, sesión interactiva, descanso y celebración.
// Cada dirección aporta solo su forma de pintar (pantallas.js) y su estilo (estilo.css); el comportamiento es el mismo.
// Nada se guarda salvo la persona elegida (en localStorage, si se puede) para no tener que elegirla en cada página.
import { PERSONAS, mmss } from './datos.js';

const ORDEN = { hoy: 0, sesion: 1, progreso: 2 };
const PARAMS = new URLSearchParams(location.search);
const CAPTURA = PARAMS.has('captura'); // para las capturas: sin barra del prototipo y con el reloj quieto
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function leerPersona() {
  const p = PARAMS.get('p');
  if (p && PERSONAS[p]) return p;
  try { const g = localStorage.getItem('identidad.persona'); if (PERSONAS[g]) return g; } catch { /* sin almacenamiento */ }
  return 'victor';
}

export function iniciar({ nombre, pantallas, salida = false }) {
  const raiz = document.documentElement;
  const app = document.getElementById('app');
  const capa = document.getElementById('capa');
  const aviso = document.getElementById('aviso');
  let persona = leerPersona();
  let vista = null;
  let ses = null; // copia de la sesión de ejemplo que se puede tocar
  let reloj = null; let alarmaFin = null;

  const datos = () => PERSONAS[persona];
  // Variables CSS que dependen de los datos (orden de aparición, valor de una barra): se ponen por CSSOM,
  // así las plantillas no llevan atributos style y la página funciona con una CSP sin 'unsafe-inline'.
  const aplicarVars = r => r.querySelectorAll('[data-i],[data-v]').forEach(n => {
    if (n.dataset.i != null) n.style.setProperty('--i', n.dataset.i);
    if (n.dataset.v != null) n.style.setProperty('--v', n.dataset.v);
  });

  function nuevaSesion() {
    ses = structuredClone(datos().sesion);
    ses.actual = ses.series.findIndex(s => !s.hecha);
    ses.descanso.activo = true;
  }

  // ---- barra del prototipo (no es parte de la app) ----
  const barra = document.getElementById('demo');
  if (CAPTURA || PARAMS.has('marco')) barra.hidden = true;
  barra.innerHTML = `
    <a class="demo-volver" href="../">Las tres direcciones</a>
    <span class="demo-nombre">${nombre}</span>
    <div class="demo-personas" role="group" aria-label="Ver como">
      <button type="button" data-act="persona" data-p="victor">Víctor</button>
      <button type="button" data-act="persona" data-p="virginia">Virginia</button>
    </div>`;

  function pintarPersona() {
    raiz.dataset.persona = persona;
    barra.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === persona)));
    try { localStorage.setItem('identidad.persona', persona); } catch { /* da igual */ }
  }

  // ---- pestañas ----
  const nav = document.getElementById('pestanas');
  nav.innerHTML = [
    ['hoy', 'Hoy', '<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>'],
    ['progreso', 'Progreso', '<path d="M4 19h16M6 16l4-5 3 3 5-7"/>'],
    ['ejercicios', 'Ejercicios', '<path d="M3 12h2m14 0h2M7 8v8m10-8v8M5 10v4m14-4v4M7 12h10"/>'],
    ['perfil', 'Perfil', '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/>'],
  ].map(([id, txt, ico]) => `<a href="#${id}" data-tab="${id}"${ORDEN[id] == null ? ' data-fuera="1"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ico}</svg>
      <span>${txt}</span></a>`).join('');

  function avisar(txt) {
    aviso.textContent = txt;
    aviso.classList.add('visible');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => aviso.classList.remove('visible'), 2600);
  }

  // ---- rutas ----
  // Cambia la dirección (para que «atrás» funcione) o, si ya está en ella, pinta directamente.
  function irA(destino) {
    if (location.hash.slice(1) === destino) ir(destino); else location.hash = destino;
  }
  function ir(destino, { foco = true } = {}) {
    if (ORDEN[destino] == null) destino = 'hoy';
    const antes = vista;
    raiz.dataset.dir = antes == null || ORDEN[destino] >= ORDEN[antes] ? 'adelante' : 'atras';
    vista = destino;
    if (destino === 'sesion' && !ses) nuevaSesion();
    document.body.classList.toggle('sin-nav', destino === 'sesion');
    nav.querySelectorAll('[data-tab]').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === destino));
    // Con «salida», la pantalla anterior no desaparece de golpe: se queda en una capa fija que sale animada
    // mientras entra la nueva (solo transform y opacity). Con movimiento reducido, cambio directo.
    if (salida && antes !== null && antes !== destino && !reducido()) {
      document.querySelectorAll('.saliente').forEach(n => n.remove());
      const capaSal = document.createElement('div');
      capaSal.className = 'saliente'; capaSal.setAttribute('aria-hidden', 'true'); capaSal.inert = true;
      const dentro = document.createElement('div');
      dentro.className = 'saliente-dentro';
      dentro.style.marginTop = `${-window.scrollY}px`;
      dentro.append(...app.childNodes);
      capaSal.append(dentro);
      document.body.append(capaSal);
      const quitar = () => capaSal.remove();
      capaSal.addEventListener('animationend', quitar, { once: true });
      setTimeout(quitar, 600);
    }
    pintar();
    if (antes !== null && !reducido()) {
      app.classList.remove('entra'); void app.offsetWidth; app.classList.add('entra');
    }
    window.scrollTo(0, 0);
    if (foco && antes !== null) app.querySelector('h1')?.focus({ preventScroll: true });
    if (destino === 'sesion') arrancarReloj(); else pararReloj();
  }

  function pintar() {
    const d = datos();
    app.innerHTML = vista === 'sesion' ? pantallas.sesion(d, ses) : pantallas[vista](d);
    app.querySelector('h1')?.setAttribute('tabindex', '-1');
    aplicarVars(app);
    pantallas.despues?.(app, vista, d, ses, { reducido: reducido() || CAPTURA });
    if (vista === 'sesion') pintarReloj();
  }

  // ---- descanso ----
  function pintarReloj() {
    const r = app.querySelector('[data-descanso]');
    if (!r) return;
    const { restante, total, activo } = ses.descanso;
    r.hidden = !activo && !r.classList.contains('alarma');
    r.style.setProperty('--p', String(Math.max(0, restante) / total));
    r.querySelectorAll('[data-reloj]').forEach(n => { if (pantallas.reloj) pantallas.reloj(n, restante); else n.textContent = mmss(restante); });
  }
  function arrancarReloj() {
    pararReloj();
    if (CAPTURA) return;
    reloj = setInterval(() => {
      if (!ses?.descanso.activo) return;
      ses.descanso.restante -= 1;
      if (ses.descanso.restante <= 0) { ses.descanso.restante = 0; terminarDescanso(); }
      pintarReloj();
    }, 1000);
  }
  function pararReloj() { clearInterval(reloj); reloj = null; }
  function terminarDescanso() {
    ses.descanso.activo = false;
    const r = app.querySelector('[data-descanso]');
    if (r) { r.classList.add('alarma'); r.hidden = false; }
    const vivo = app.querySelector('[data-vivo]');
    if (vivo) vivo.textContent = 'Descanso terminado. Toca la serie ' + (ses.actual + 1) + '.';
    try { navigator.vibrate?.([250, 120, 250, 120, 250]); } catch { /* sin vibración: tres toques seguidos */ }
    clearTimeout(alarmaFin);
    alarmaFin = setTimeout(() => { app.querySelector('[data-descanso]')?.classList.remove('alarma'); pintarReloj(); }, 8000);
  }
  function empezarDescanso() {
    clearTimeout(alarmaFin);
    ses.descanso.restante = ses.descanso.total;
    ses.descanso.activo = true;
  }

  // ---- celebración ----
  let anteFoco = null;
  function abrirCierre() {
    anteFoco = document.activeElement;
    pararReloj();
    capa.innerHTML = pantallas.cierre(datos());
    capa.hidden = false;
    aplicarVars(capa);
    document.body.classList.add('con-capa');
    app.inert = true; nav.inert = true;
    capa.classList.remove('celebra'); void capa.offsetWidth; capa.classList.add('celebra');
    capa.querySelector('h2')?.focus({ preventScroll: true });
    pantallas.alAbrirCierre?.(capa, { reducido: reducido() || CAPTURA });
    // Las cifras cuentan hacia arriba; con movimiento reducido salen directamente con su valor.
    capa.querySelectorAll('[data-cuenta]').forEach(n => {
      const fin = Number(n.dataset.cuenta);
      if (reducido() || CAPTURA) { n.textContent = fin.toLocaleString('es-ES'); return; }
      const t0 = performance.now(); const dur = 900;
      const paso = t => {
        const k = Math.min(1, (t - t0) / dur); const e = 1 - (1 - k) ** 3;
        n.textContent = Math.round(fin * e).toLocaleString('es-ES');
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  }
  function cerrarCierre() {
    capa.hidden = true; capa.innerHTML = '';
    document.body.classList.remove('con-capa');
    app.inert = false; nav.inert = false;
    ses = null;
    irA('hoy');
    anteFoco = null;
  }

  // ---- acciones ----
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act], [data-fuera]');
    if (!b) return;
    if (b.dataset.fuera) { e.preventDefault(); avisar('Esta pantalla no entra en la muestra de identidad.'); return; }
    const act = b.dataset.act;
    const s = ses && ses.series[ses.actual];
    switch (act) {
      case 'persona': persona = b.dataset.p; ses = null; pintarPersona(); ir(vista, { foco: false }); break;
      case 'ir': e.preventDefault(); irA(b.dataset.a); break;
      case 'kg-': case 'kg+':
        if (!s) break;
        s.kg = Math.max(0, (s.kg ?? ses.series[ses.actual - 1]?.kg ?? 0) + (act === 'kg+' ? ses.paso : -ses.paso));
        pintar(); app.querySelector(`[data-act="${act}"]`)?.focus(); break;
      case 'reps-': case 'reps+':
        if (!s) break;
        s.reps = Math.max(1, (s.reps ?? 10) + (act === 'reps+' ? 1 : -1));
        pintar(); app.querySelector(`[data-act="${act}"]`)?.focus(); break;
      case 'hecha': {
        if (!s) break;
        if (Date.now() - (ses.ultimoToque || 0) < 400) break; // doble toque = uno (R27)
        ses.ultimoToque = Date.now();
        s.hecha = true;
        const sig = ses.series.findIndex(x => !x.hecha);
        if (sig >= 0) {
          ses.series[sig].kg ??= s.kg; ses.series[sig].reps ??= s.reps; // los kilos pasan a la siguiente (R05)
          ses.actual = sig;
          app.querySelector('[data-descanso]')?.classList.remove('alarma');
          empezarDescanso();
        } else { ses.actual = ses.series.length; ses.descanso.activo = false; }
        pintar();
        (app.querySelector('[data-act="hecha"]') || app.querySelector('[data-act="terminar"]'))?.focus();
        break;
      }
      case 'descanso+': ses.descanso.restante += 15; ses.descanso.total = Math.max(ses.descanso.total, ses.descanso.restante); pintarReloj(); break;
      case 'descanso-fin': ses.descanso.activo = false; app.querySelector('[data-descanso]')?.classList.remove('alarma'); pintarReloj(); app.querySelector('[data-act="hecha"]')?.focus(); break;
      case 'terminar': abrirCierre(); break;
      case 'cerrar-cierre': cerrarCierre(); break;
      default: break;
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !capa.hidden) cerrarCierre(); });
  window.addEventListener('hashchange', () => ir(location.hash.slice(1)));

  pintarPersona();
  ir(location.hash.slice(1) || 'hoy');
  if (PARAMS.has('cierre')) abrirCierre();
}
