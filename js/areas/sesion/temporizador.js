// Temporizador de la sesión: descansos y ejercicios por tiempo.
//
// Pensado para el móvil en el gimnasio:
// - Cuenta con la hora real. Si la pantalla se bloquea o la app pasa a segundo plano, al volver está en su sitio.
// - El aviso suena aunque la pantalla esté bloqueada: al empezar (con el toque de la persona) se reproduce un audio
//   que ya lleva dentro los pitidos en el segundo exacto. Un <audio> sigue sonando en segundo plano y no lo silencia
//   el interruptor de silencio del iPhone, al contrario que los pitidos generados al momento.
// - Alarma visual que parpadea hasta que se toca, vibración repetida (en Android; el iPhone no deja vibrar a una web)
//   y cuenta atrás 3-2-1 con pitidos cortos.
// - Se guarda en su propia clave: si la app se recarga a mitad de un descanso, sigue contando.
// - Ejercicios por tiempo: 5 s para colocarse, aviso al llegar al mínimo, sigue contando hasta el máximo y más allá
//   (se apunta lo que de verdad aguantas) y, si es «c/lado», hace los dos lados seguidos.

import { estado } from '../../nucleo/estado.js';
import { h, mmss, ICONOS } from '../../nucleo/ui.js';

const CLAVE = 'pipos-temporizador';
const PREVIA = 5;          // segundos para colocarse antes de un ejercicio por tiempo
const EXTRA_MAX = 120;     // pasado el máximo, se cierra solo a los 2 min (por si se olvida)

let t = null;
// t = { tipo:'descanso'|'tiempo', etiqueta, fases:[{f:'previa'|'trabajo'|'descanso', dur, lo, hi, lado}],
//       i, inicio (ms del inicio de la fase), pausa (ms transcurridos al pausar o null),
//       tiempos:[seg aguantados por lado], meta, avisos:{} }
let tic = null;
let pantallaBloqueo = null;
let alFin = null;
let sonido = null, urlSonido = null;
let ctx = null;

const ahora = () => Date.now();
const fase = () => t && t.fases[t.i];
const transcurrido = () => (t.pausa != null ? t.pausa : ahora() - t.inicio) / 1000;
const ajustes = () => estado().ajustes || {};

// ── Guardar y recuperar ──
function guardar() {
  try {
    if (!t) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, JSON.stringify(t));
  } catch (e) { /* sin espacio: no pasa nada */ }
}

// ── Audio programado (suena aunque la pantalla esté bloqueada) ──
// Genera un WAV de 8 kHz con silencio y pitidos en los segundos indicados.
function wav(pitidos, dur) {
  const R = 8000, n = Math.ceil((dur + 0.5) * R);
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const txt = (o, s) => [...s].forEach((c, i) => { buf[o + i] = c.charCodeAt(0); });
  txt(0, 'RIFF'); dv.setUint32(4, 36 + n, true); txt(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, R, true); dv.setUint32(28, R, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  txt(36, 'data'); dv.setUint32(40, n, true);
  buf.fill(128, 44);
  for (const p of pitidos) {
    const a = Math.floor(p.t * R), b = Math.min(n, a + Math.floor(p.d * R));
    for (let k = Math.max(0, a); k < b; k++) {
      const x = (k - a) / R, env = Math.min(1, x / 0.01, (p.d - x) / 0.02);
      buf[44 + k] = 128 + Math.round(Math.sin(2 * Math.PI * p.f * x) * 110 * p.v * env);
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

const CORTO = s => [{ t: s, f: 660, d: 0.09, v: 0.6 }];
const ALARMA = s => [0, 0.32, 0.64].map((d, i) => ({ t: s + d, f: i === 2 ? 1320 : 880, d: 0.24, v: 1 }));
const ARRANCA = s => [{ t: s, f: 1320, d: 0.45, v: 1 }];
const DOBLE = s => [0, 0.25].map(d => ({ t: s + d, f: 1040, d: 0.16, v: 0.9 }));
const cuentaAtras = fin => [3, 2, 1].filter(k => fin - k > 0.05).flatMap(k => CORTO(fin - k));

// Pitidos que quedan desde ahora, siguiendo las fases que vienen.
function agenda() {
  const p = [];
  if (!t || t.pausa != null) return { p, dur: 0 };
  let base = -transcurrido();
  for (let k = t.i; k < t.fases.length; k++) {
    const F = t.fases[k];
    if (F.f === 'previa') { p.push(...cuentaAtras(base + F.dur), ...ARRANCA(base + F.dur)); base += F.dur; }
    else if (F.f === 'descanso') { const fin = base + F.dur; p.push(...cuentaAtras(fin), ...ALARMA(fin), ...ALARMA(fin + 4), ...ALARMA(fin + 8)); base = fin + 10; }
    else if (F.f === 'trabajo') {
      if (F.lo < F.hi) p.push(...DOBLE(base + F.lo));
      const fin = base + F.hi;
      p.push(...cuentaAtras(fin), ...ALARMA(fin));
      if (k === t.fases.length - 1) { base = fin + 1.5; break; } // después del máximo ya no hay más pitidos
      base = fin;
    }
  }
  return { p: p.filter(x => x.t >= 0), dur: Math.max(0, base) };
}

function programarSonido() {
  if (!sonido) { sonido = new Audio(); sonido.preload = 'auto'; sonido.setAttribute('playsinline', ''); }
  try { sonido.pause(); } catch (e) { /* nada */ }
  if (urlSonido) { URL.revokeObjectURL(urlSonido); urlSonido = null; }
  if (!t || !ajustes().sonido || t.pausa != null) return;
  const { p, dur } = agenda();
  if (!dur) return;
  urlSonido = URL.createObjectURL(wav(p, dur));
  sonido.src = urlSonido;
  const r = sonido.play();
  if (r && r.catch) r.catch(() => { /* sin permiso para sonar: queda la alarma visual */ });
}

// Pitido inmediato (pantalla encendida): para cuando no hay audio programado.
function pitar(tipo = 'alarma') {
  if (!ajustes().sonido) return;
  if (sonido && !sonido.paused) return; // ya lo lleva el audio programado
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const lista = tipo === 'corto' ? CORTO(0) : tipo === 'doble' ? DOBLE(0) : tipo === 'arranca' ? ARRANCA(0) : ALARMA(0);
    lista.forEach(b => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + b.t;
      o.frequency.value = b.f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4 * b.v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + b.d); o.start(t0); o.stop(t0 + b.d + 0.02);
    });
  } catch (e) { /* sin audio */ }
}
function vibrar(patron) { if (ajustes().vibrar && navigator.vibrate) try { navigator.vibrate(patron); } catch (e) { /* nada */ } }

// ── Pantalla de bloqueo (Android/iPhone muestran qué cuenta) ──
function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  try {
    if (!t) { ms.metadata = null; ms.playbackState = 'none'; return; }
    const F = fase();
    ms.metadata = new MediaMetadata({ title: t.etiqueta, artist: F.f === 'descanso' ? 'Descanso' : F.f === 'previa' ? 'Prepárate' : 'Pipos Fitness', album: 'Pipos Fitness', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    ms.playbackState = t.pausa != null ? 'paused' : 'playing';
    if (ms.setPositionState && F.dur) ms.setPositionState({ duration: F.f === 'trabajo' ? F.hi : F.dur, position: Math.min(F.f === 'trabajo' ? F.hi : F.dur, transcurrido()), playbackRate: 1 });
  } catch (e) { /* no soportado */ }
}
function manejadoresMedia() {
  if (!('mediaSession' in navigator)) return;
  const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* no soportado */ } };
  set('pause', () => accion('pausa'));
  set('play', () => accion('pausa'));
  set('nexttrack', () => accion('fin'));
}

// ── Mantener la pantalla encendida ──
export async function mantenerPantalla() {
  try {
    if ('wakeLock' in navigator && !pantallaBloqueo && !document.hidden) {
      pantallaBloqueo = await navigator.wakeLock.request('screen');
      pantallaBloqueo.addEventListener('release', () => { pantallaBloqueo = null; });
    }
  } catch (e) { /* no disponible */ }
}
export function soltarPantalla() { try { pantallaBloqueo && pantallaBloqueo.release(); } catch (e) { /* nada */ } pantallaBloqueo = null; }

// ── Pintar ──
function quitarCaja() {
  const el = document.getElementById('temporizador'); if (el) el.remove();
  document.body.classList.remove('con-temporizador', 'con-cuenta');
}

// Solo se rehace el HTML cuando cambia la estructura (fase, pausa, botones). Cada tic actualiza números y barra
// en su sitio: así un toque nunca cae en un botón que se acaba de sustituir.
function poner(el, clase, esqueleto, valores) {
  const destello = el.classList.contains('destello');
  el.className = clase + (destello ? ' destello' : '');
  if (el.dataset.esq !== esqueleto) { el.innerHTML = esqueleto; el.dataset.esq = esqueleto; }
  for (const [sel, v] of Object.entries(valores)) {
    const n = el.querySelector(sel); if (!n) continue;
    if (sel.endsWith('i')) n.style.width = v; else if (n.textContent !== v) n.textContent = v;
  }
}

function pintarCaja() {
  if (!t) return quitarCaja();
  let el = document.getElementById('temporizador');
  if (!el) { el = document.createElement('div'); el.id = 'temporizador'; el.setAttribute('role', 'timer'); el.setAttribute('aria-live', 'off'); document.body.appendChild(el); }
  const F = fase(), s = transcurrido(), pausa = t.pausa != null;
  if (F.f === 'descanso') {
    const q = Math.max(0, F.dur - s);
    document.body.classList.add('con-temporizador'); document.body.classList.remove('con-cuenta');
    poner(el, 'temporizador descanso' + (q <= 5 ? ' final' : ''),
      `<div class="t-progreso"></div>
      <div class="t-texto"><small>${h(t.etiqueta)}</small><b></b></div>
      <div class="t-botones">
        <button data-t="menos" aria-label="Quitar 15 segundos">−15</button>
        <button data-t="mas" aria-label="Añadir 15 segundos">+15</button>
        <button data-t="fin" class="t-fin">Saltar</button>
      </div>`,
      { '.t-texto b': mmss(Math.ceil(q)) });
    el.querySelector('.t-progreso').style.width = Math.min(100, s / F.dur * 100) + '%';
    return;
  }
  // Ejercicio por tiempo: pantalla completa, números grandes que se leen desde el suelo.
  document.body.classList.add('con-cuenta'); document.body.classList.remove('con-temporizador');
  const lados = t.fases.filter(x => x.f === 'trabajo').length;
  let grande, arriba, abajo, estadoCls = F.f, prog = 0;
  if (F.f === 'previa') {
    grande = String(Math.max(1, Math.ceil(F.dur - s)));
    arriba = F.lado ? `Lado ${F.lado} de ${lados}` : 'Prepárate';
    abajo = F.lado === 2 ? 'Cambia de lado' : 'Colócate en posición';
    prog = s / F.dur;
  } else {
    // Con minutos enteros (cardio «8 min») se lee en minutos, no «480 s» (E5).
    const enMin = F.lo >= 120 && F.lo % 60 === 0 && F.hi % 60 === 0;
    const objetivo = enMin ? (F.lo === F.hi ? `${F.hi / 60} min` : `${F.lo / 60}-${F.hi / 60} min`) : F.lo === F.hi ? `${F.hi} s` : `${F.lo}-${F.hi} s`;
    arriba = (lados > 1 ? `Lado ${F.lado} de ${lados} · ` : '') + 'objetivo ' + objetivo;
    if (s < F.lo) { grande = mmss(Math.ceil(F.lo - s)); abajo = 'Aguanta'; prog = s / F.hi; }
    else if (s < F.hi) { grande = mmss(Math.floor(s)); abajo = `¡Mínimo hecho! Sigue hasta ${enMin ? F.hi / 60 + ' min' : F.hi + ' s'} si puedes`; estadoCls += ' logrado'; prog = s / F.hi; }
    else { grande = '+' + mmss(Math.floor(s - F.hi)); abajo = `¡Objetivo superado! Llevas ${enMin ? mmss(Math.floor(s)) : Math.floor(s) + ' s'}`; estadoCls += ' superado'; prog = 1; }
  }
  const ultimoLado = !t.fases.slice(t.i + 1).some(x => x.f === 'trabajo');
  const textoFin = F.f === 'previa' ? 'Empezar ya' : ultimoLado ? `${ICONOS.check} Hecho` : 'Cambiar de lado';
  poner(el, `temporizador cuenta ${estadoCls}${pausa ? ' pausado' : ''}`,
    `<div class="c-cab"><small>${h(t.etiqueta)}</small>
      <button data-t="cancelar" class="icono" aria-label="Cancelar sin apuntar">${ICONOS.x}</button></div>
    <div class="c-centro">
      <p class="c-arriba">${h(arriba)}</p>
      <b class="c-num"></b>
      <p class="c-abajo"></p>
      <div class="c-barra"><i></i>${F.f === 'trabajo' && F.lo < F.hi ? `<span style="left:${F.lo / F.hi * 100}%"></span>` : ''}</div>
    </div>
    <div class="c-botones">
      ${F.f === 'trabajo' ? `<button data-t="pausa" class="btn sec" aria-label="${pausa ? 'Seguir' : 'Pausar'}">${pausa ? ICONOS.play + ' Seguir' : ICONOS.pausa + ' Pausa'}</button>` : ''}
      <button data-t="fin" class="btn">${textoFin}</button>
    </div>`,
    { '.c-num': grande, '.c-abajo': pausa ? 'En pausa' : abajo, '.c-barra i': Math.min(100, prog * 100) + '%' });
}

// ── Avanzar con la hora real ──
// Las transiciones automáticas usan el final previsto de cada fase (no «ahora»), así un bloqueo de pantalla
// largo no descuadra nada: al volver, se recorren las fases que ya han pasado.
function avanzar(enVivo = true) {
  let cambio = false;
  while (t && t.pausa == null) {
    const F = fase(), s = transcurrido();
    if (F.f === 'previa' && s >= F.dur) {
      t.inicio += F.dur * 1000; t.i++; cambio = true;
      if (enVivo) { pitar('arranca'); vibrar(250); }
      continue;
    }
    if (F.f === 'trabajo') {
      if (s >= F.lo && !t.avisos['lo' + t.i] && F.lo < F.hi) { t.avisos['lo' + t.i] = 1; if (enVivo) { pitar('doble'); vibrar([150, 80, 150]); destello(); } }
      const ultimo = t.i === t.fases.length - 1;
      if (s >= F.hi && !t.avisos['hi' + t.i]) {
        t.avisos['hi' + t.i] = 1; cambio = true;
        if (enVivo) { pitar(); vibrar([300, 120, 300]); destello(); }
        if (!ultimo) { t.tiempos.push(F.hi); t.inicio += F.hi * 1000; t.i++; continue; }
      }
      if (ultimo && s >= F.hi + EXTRA_MAX) { t.tiempos.push(Math.round(s)); return terminar(true, enVivo); }
      break;
    }
    if (F.f === 'descanso' && s >= F.dur) return terminar(true, enVivo, s - F.dur);
    break;
  }
  if (cambio) { guardar(); mediaSession(); }
  pintarCaja();
}

function bucle() {
  clearInterval(tic);
  tic = setInterval(() => { if (!t) return clearInterval(tic); avanzar(!document.hidden); }, 200);
  avanzar();
}

function destello() {
  const el = document.getElementById('temporizador'); if (!el) return;
  el.classList.remove('destello'); void el.offsetWidth; el.classList.add('destello');
}

// ── Alarma a pantalla completa: parpadea y vibra hasta que se toca ──
let alarmaViva = null;
export function alarma(texto, sub = 'Toca para seguir') {
  cerrarAlarma();
  pitar(); vibrar([400, 150, 400, 150, 700]);
  const el = document.createElement('button');
  el.className = 'alarma';
  el.setAttribute('role', 'alert');
  el.innerHTML = `${ICONOS.reloj}<b>${h(texto)}</b><span>${h(sub)}</span>`;
  el.addEventListener('click', cerrarAlarma);
  document.body.appendChild(el);
  let veces = 0;
  const rep = setInterval(() => {
    if (++veces > 12 || !el.isConnected) return clearInterval(rep);
    vibrar([400, 150, 400]);
    if (veces % 3 === 0) pitar();
  }, 2500);
  alarmaViva = { el, rep };
}
function cerrarAlarma() {
  if (!alarmaViva) return;
  clearInterval(alarmaViva.rep); alarmaViva.el.remove(); alarmaViva = null;
  try { sonido && sonido.pause(); } catch (e) { /* nada */ }
  if (navigator.vibrate) try { navigator.vibrate(0); } catch (e) { /* nada */ }
}

function terminar(natural, enVivo = true, retraso = 0) {
  const x = t; t = null; clearInterval(tic); guardar(); mediaSession(); quitarCaja();
  if (!x) return;
  if (!natural || x.tipo === 'tiempo') { try { sonido && sonido.pause(); } catch (e) { /* nada */ } }
  if (x.tipo === 'descanso') {
    if (natural) alarma('¡A por la siguiente serie!', retraso > 3 ? `El descanso terminó hace ${mmss(retraso)} · toca para seguir` : 'Toca para seguir');
  } else if (x.tiempos.length) {
    if (natural && !enVivo) alarma('Ejercicio terminado', `Se ha apuntado ${Math.min(...x.tiempos)} s`);
    if (alFin) alFin(x.meta, x.tiempos);
  }
  if (!pantallaBloqueo) mantenerPantalla();
}

function empezar(nuevo) {
  cerrarAlarma();
  t = { i: 0, inicio: ahora(), pausa: null, tiempos: [], avisos: {}, ...nuevo };
  guardar(); manejadoresMedia(); mediaSession(); mantenerPantalla();
  programarSonido();
  bucle();
}

// ── API para la sesión ──
// Al terminar un ejercicio por tiempo se llama fn(meta, tiempos) con los segundos aguantados (uno por lado).
export function registrarFin(fn) { alFin = fn; }

export function descanso(seg, etiqueta = 'Descanso') {
  if (!seg) return;
  empezar({ tipo: 'descanso', etiqueta, fases: [{ f: 'descanso', dur: seg }] });
}

// Ejercicio por tiempo. lo/hi en segundos (30-45 s → 30 y 45). lados = 2 para «c/lado».
export function cuenta({ lo, hi, lados = 1, etiqueta, meta }) {
  hi = Math.max(lo, hi || lo);
  const fases = [];
  for (let l = 1; l <= lados; l++) {
    fases.push({ f: 'previa', dur: PREVIA, lado: lados > 1 ? l : 0 });
    fases.push({ f: 'trabajo', lo, hi, lado: lados > 1 ? l : 0 });
  }
  empezar({ tipo: 'tiempo', etiqueta, fases, meta });
}

export const activo = () => !!t;
export const info = () => t && { tipo: t.tipo, meta: t.meta };
export function parar() { t = null; clearInterval(tic); guardar(); mediaSession(); quitarCaja(); try { sonido && sonido.pause(); } catch (e) { /* nada */ } }

function accion(a) {
  if (!t) return;
  const F = fase();
  if (a === 'mas' && F.f === 'descanso') F.dur += 15;
  else if (a === 'menos' && F.f === 'descanso') F.dur = Math.max(transcurrido() + 1, F.dur - 15);
  else if (a === 'pausa' && F.f === 'trabajo') {
    if (t.pausa != null) { t.inicio = ahora() - t.pausa; t.pausa = null; } else t.pausa = ahora() - t.inicio;
  } else if (a === 'cancelar') { return parar(); }
  else if (a === 'fin') {
    if (F.f === 'descanso') return terminar(false);
    if (F.f === 'previa') { t.i++; t.inicio = ahora(); pitar('arranca'); }
    else {
      t.tiempos.push(Math.round(transcurrido()));
      const resto = t.fases.slice(t.i + 1);
      if (!resto.some(x => x.f === 'trabajo')) return terminar(true);
      t.i++; t.inicio = ahora(); t.pausa = null;
    }
  } else return;
  guardar(); programarSonido(); mediaSession(); avanzar();
}

document.addEventListener('click', e => {
  const b = e.target.closest('#temporizador [data-t]'); if (!b) return;
  accion(b.dataset.t);
});

// Al volver a la app: recolocar, y si algo terminó mientras no mirabas, enseñarlo.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (t) { avanzar(false); mantenerPantalla(); }
});

// Recuperar un temporizador si la app se recargó a mitad.
setTimeout(() => {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!g || !g.fases) return;
    const F = g.fases[g.i];
    const s = (g.pausa != null ? g.pausa : ahora() - g.inicio) / 1000;
    if (s > 30 * 60 || (F.f === 'descanso' && s - F.dur > 10 * 60)) { localStorage.removeItem(CLAVE); return; }
    t = g; manejadoresMedia(); mediaSession(); bucle();
  } catch (e) { localStorage.removeItem(CLAVE); }
}, 0);
