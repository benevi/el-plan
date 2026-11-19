// Temporizador de la sesión: descansos y ejercicios por tiempo, con alarma visual, vibración y pitido.
// Cuenta con la hora real (no con setInterval), así que sigue bien aunque se bloquee la pantalla.

import { estado } from '../../nucleo/estado.js';
import { h, mmss, ICONOS } from '../../nucleo/ui.js';

let t = null;        // { fin, total, etiqueta, tipo: 'descanso'|'tiempo', alAcabar, pausa }
let tic = null;
let audio = null;
let bloqueo = null;

function caja() {
  let el = document.getElementById('temporizador');
  if (!el) { el = document.createElement('div'); el.id = 'temporizador'; el.setAttribute('role', 'timer'); document.body.appendChild(el); }
  return el;
}
const quedan = () => (t.pausa != null ? t.pausa : Math.max(0, (t.fin - Date.now()) / 1000));

function pintar() {
  if (!t) { const el = document.getElementById('temporizador'); if (el) el.remove(); document.body.classList.remove('con-temporizador'); return; }
  const q = quedan();
  const el = caja();
  document.body.classList.add('con-temporizador');
  el.className = 'temporizador ' + t.tipo + (q <= 5 ? ' final' : '');
  el.innerHTML = `<div class="t-progreso" style="width:${Math.min(100, (1 - q / t.total) * 100)}%"></div>
    <div class="t-texto"><small>${h(t.etiqueta)}</small><b>${mmss(Math.ceil(q))}</b></div>
    <div class="t-botones">
      ${t.tipo === 'descanso' ? `<button data-t="menos" aria-label="Quitar 15 segundos">−15</button><button data-t="mas" aria-label="Añadir 15 segundos">+15</button>`
        : `<button data-t="pausa" aria-label="${t.pausa != null ? 'Seguir' : 'Pausar'}">${t.pausa != null ? ICONOS.play : ICONOS.pausa}</button>`}
      <button data-t="fin" class="t-fin">${t.tipo === 'descanso' ? 'Saltar' : 'Hecho'}</button>
    </div>`;
}

function bucle() {
  clearInterval(tic);
  tic = setInterval(() => {
    if (!t) return clearInterval(tic);
    if (t.pausa == null && Date.now() >= t.fin) return terminar(true);
    pintar();
  }, 250);
  pintar();
}

async function mantenerPantalla() {
  try { if ('wakeLock' in navigator && !bloqueo) { bloqueo = await navigator.wakeLock.request('screen'); bloqueo.addEventListener('release', () => { bloqueo = null; }); } } catch (e) { /* no disponible */ }
}

function pitido() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((d, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.25);
      o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.3);
    });
  } catch (e) { /* sin audio */ }
}

// Alarma: pantalla que parpadea en el color de la persona + vibración + pitido (según ajustes).
export function alarma(texto) {
  const A = estado().ajustes;
  if (A.vibrar && navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 700]);
  if (A.sonido) pitido();
  const el = document.createElement('button');
  el.className = 'alarma';
  el.innerHTML = `<b>${h(texto)}</b><span>Toca para seguir</span>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function terminar(natural) {
  const x = t; t = null; clearInterval(tic); pintar();
  if (!x) return;
  if (natural) alarma(x.tipo === 'descanso' ? '¡A por la siguiente serie!' : '¡Tiempo!');
  if (x.alAcabar) x.alAcabar(natural);
}

export function descanso(seg, etiqueta = 'Descanso') {
  if (!seg) return;
  // El audio necesita un toque del usuario para arrancar: se prepara aquí.
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* nada */ }
  t = { fin: Date.now() + seg * 1000, total: seg, etiqueta, tipo: 'descanso' };
  mantenerPantalla(); bucle();
}

// Ejercicio por tiempo (plancha 40 s…). alAcabar(natural) se llama al terminar o al pulsar «Hecho».
export function cuenta(seg, etiqueta, alAcabar) {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* nada */ }
  t = { fin: Date.now() + seg * 1000, total: seg, etiqueta, tipo: 'tiempo', alAcabar };
  mantenerPantalla(); bucle();
}

export const activo = () => !!t;
export function parar() { t = null; clearInterval(tic); pintar(); }

document.addEventListener('click', e => {
  const b = e.target.closest('#temporizador [data-t]'); if (!b || !t) return;
  const a = b.dataset.t;
  if (a === 'mas') { t.fin += 15000; t.total += 15; }
  else if (a === 'menos') { t.fin -= 15000; }
  else if (a === 'pausa') { if (t.pausa != null) { t.fin = Date.now() + t.pausa * 1000; t.pausa = null; } else t.pausa = quedan(); }
  else if (a === 'fin') return terminar(false);
  pintar();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && t) { mantenerPantalla(); pintar(); } });
