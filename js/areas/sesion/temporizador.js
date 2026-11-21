// Temporizador de la sesión: descansos y ejercicios por tiempo (PR 15: diseño aprobado de DIS 4).
//
// Pensado para el móvil en el gimnasio:
// - Cuenta con la hora real. Si la pantalla se bloquea o la app pasa a segundo plano, al volver está en su sitio.
// - El aviso suena aunque la pantalla esté bloqueada: al empezar (con el toque de la persona) se reproduce un audio
//   que ya lleva dentro los pitidos en el segundo exacto. Un <audio> sigue sonando en segundo plano y no lo silencia
//   el interruptor de silencio del iPhone, al contrario que los pitidos generados al momento. Si la app se recarga
//   a mitad, el navegador no deja sonar sin un toque: la barra ofrece «Activar el sonido».
// - Descanso: siempre la barra de abajo (−15, +15, Saltar; «Prepárate» en los últimos 10 s), que no tapa la serie
//   siguiente. Al acabar, la propia barra se vuelve alarma: color de la persona con texto oscuro (≥ 7:1), tres
//   vibraciones (250-120-250-120-250 ms), recibe el foco y se cierra sola a los 8 s (R08). Si acabó con el móvil
//   bloqueado, al volver dice cuánto hace.
// - Ejercicios por tiempo y cardio: contador a pantalla completa. 5 s para colocarse, aviso al llegar al mínimo,
//   sigue contando hasta el máximo y más allá (se apunta lo que de verdad aguantas) y, si es «c/lado», hace los dos
//   lados seguidos. Si el máximo llega con el móvil bloqueado, no se apunta solo: al volver pregunta cuánto, con el
//   objetivo como tope de partida.
// - Se guarda en su propia clave: si la app se recarga a mitad de un descanso, sigue contando.

import { estado } from '../../nucleo/estado.js';
import { h, mmss, ICONOS, movimientoReducido } from '../../nucleo/ui.js';

const CLAVE = 'pipos-temporizador';
const PREVIA = 5;          // segundos para colocarse antes de un ejercicio por tiempo
const EXTRA_MAX = 120;     // pasado el máximo con la pantalla a la vista, se cierra solo a los 2 min (tope)
const ALARMA_SEG = 8;      // la alarma del descanso se cierra sola
export const VIBRA_ALARMA = [250, 120, 250, 120, 250]; // tres toques (decisión de Víctor del 21-11-2026)

let t = null;
// t = { tipo:'descanso'|'tiempo', etiqueta, nombre, u, fases:[{f:'previa'|'trabajo'|'descanso', dur, lo, hi, lado}],
//       i, inicio (ms del inicio de la fase), pausa (ms transcurridos al pausar o null),
//       tiempos:[seg aguantados por lado], meta, avisos:{}, confirmar:{ seg } | null, sinSonido }
let tic = null;
let pantallaBloqueo = null;
let alFin = null;
let sonido = null, urlSonido = null;
let ctx = null;
let alarmaViva = null; // { titulo, hace, meta, hasta, cierre }
let inertes = [];      // lo que queda detrás del contador a pantalla completa

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
  if (!t || t.pausa != null || t.confirmar) return { p, dur: 0 };
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
  // Sin permiso para sonar (p. ej. tras recargar la app, sin un toque): la barra ofrece activarlo.
  if (r && r.catch) r.catch(() => { if (t && !t.sinSonido) { t.sinSonido = true; guardar(); pintarCaja(); } });
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
// El contador a pantalla completa deja inerte lo de detrás (el lector y el teclado no se salen de él).
function ponerInerte(si) {
  inertes.forEach(n => n.removeAttribute('inert')); inertes = [];
  if (!si) return;
  const el = document.getElementById('temporizador');
  inertes = [...document.body.children].filter(n => n !== el && !n.hasAttribute('inert') && !n.matches('script, #aviso'));
  inertes.forEach(n => n.setAttribute('inert', ''));
}
function quitarCaja() {
  const el = document.getElementById('temporizador'); if (el) el.remove();
  ponerInerte(false);
  document.body.classList.remove('con-temporizador', 'con-cuenta');
  document.body.style.removeProperty('--alto-descanso');
}

// Solo se rehace el HTML cuando cambia la estructura (fase, pausa, botones). Cada tic actualiza números y barra
// en su sitio: así un toque nunca cae en un botón que se acaba de sustituir.
function poner(el, clase, esqueleto, valores) {
  const destello = el.classList.contains('destello');
  el.className = clase + (destello ? ' destello' : '');
  if (el.dataset.esq !== esqueleto) { el.innerHTML = esqueleto; el.dataset.esq = esqueleto; }
  for (const [sel, v] of Object.entries(valores)) {
    const n = el.querySelector(sel); if (n && n.textContent !== v) n.textContent = v;
  }
}
// La barra reserva su alto abajo para no tapar la serie siguiente (R09).
function reservarAlto(el) {
  const alto = Math.ceil(el.getBoundingClientRect().height);
  if (alto) document.body.style.setProperty('--alto-descanso', alto + 'px');
}
// En la página de otra sesión (p. ej. una ya hecha, en modo lectura) la barra no se enseña: sigue contando.
const enOtraSesion = meta => {
  const m = /^#sesion\/([^/]+)/.exec(location.hash);
  return !!(m && meta && meta.sesion && decodeURIComponent(m[1]) !== meta.sesion);
};
function caja(rol) {
  let el = document.getElementById('temporizador');
  if (!el) { el = document.createElement('div'); el.id = 'temporizador'; document.body.appendChild(el); }
  if (el.getAttribute('role') !== rol) el.setAttribute('role', rol);
  return el;
}

function pintarCaja() {
  if (!t) {
    if (alarmaViva && !enOtraSesion(alarmaViva.meta)) return pintarAlarma();
    return quitarCaja();
  }
  if (t.tipo === 'descanso' && enOtraSesion(t.meta)) return quitarCaja();
  const F = fase(), s = transcurrido(), pausa = t.pausa != null;
  if (F.f === 'descanso') {
    const el = caja('timer');
    el.setAttribute('aria-label', 'Descanso'); el.removeAttribute('aria-modal'); el.removeAttribute('tabindex');
    const q = Math.max(0, F.dur - s), ultimos = q <= 10;
    document.body.classList.add('con-temporizador'); document.body.classList.remove('con-cuenta');
    ponerInerte(false);
    poner(el, `temporizador descanso descanso--fija${ultimos ? ' descanso--ultimos' : ''}`,
      `<span class="descanso-nivel" aria-hidden="true"></span>
      <div class="descanso-fila">
        <div class="descanso-txt"><span class="descanso-et"></span><b class="descanso-reloj" aria-live="off"></b></div>
        <button type="button" class="boton boton--secundario" data-t="menos" aria-label="Quitar 15 segundos">−15</button>
        <button type="button" class="boton boton--secundario" data-t="mas" aria-label="Añadir 15 segundos">+15</button>
        <button type="button" class="boton boton--secundario" data-t="fin">Saltar</button>
      </div>
      ${t.sinSonido ? `<button type="button" class="boton boton--texto descanso-sonido" data-t="sonido">${ICONOS.reloj}Activar el sonido</button>` : ''}`,
      { '.descanso-et': ultimos ? 'Prepárate' : t.etiqueta, '.descanso-reloj': mmss(Math.ceil(q)) });
    el.style.setProperty('--p', String(Math.max(0, Math.min(1, q / F.dur))));
    reservarAlto(el);
    return;
  }
  // Ejercicio por tiempo y cardio: pantalla completa, números grandes que se leen desde el suelo.
  const el = caja('dialog');
  el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ct-n'); el.removeAttribute('aria-label');
  const nuevo = !document.body.classList.contains('con-cuenta');
  document.body.classList.add('con-cuenta'); document.body.classList.remove('con-temporizador');
  document.body.style.removeProperty('--alto-descanso');
  const lados = t.fases.filter(x => x.f === 'trabajo').length;
  const enMin = t.u === 'min' || (F.lo >= 120 && F.lo % 60 === 0 && F.hi % 60 === 0);
  const tx = seg => enMin ? `${mmss(seg)} min` : `${seg} s`;
  const objetivo = F.f === 'previa' ? '' : enMin ? (F.lo === F.hi ? `${F.hi / 60} min` : `${F.lo / 60}-${F.hi / 60} min`) : F.lo === F.hi ? `${F.hi} s` : `${F.lo}-${F.hi} s`;
  let grande, arriba, abajo, estadoCls = F.f, prog, botones;
  if (t.confirmar) {
    // El máximo llegó con el móvil bloqueado: no se apunta solo; se pregunta, con el objetivo como partida.
    estadoCls = 'confirmar';
    grande = mmss(t.confirmar.seg);
    arriba = 'El móvil estuvo bloqueado';
    abajo = `No sé cuánto aguantaste: pon lo que hiciste (objetivo ${objetivo || tx(F.hi)}).`;
    prog = Math.min(1, t.confirmar.seg / F.hi);
    const p = enMin ? '1 minuto' : '5 segundos';
    botones = `<div class="selector-pasos contador-pasos"><button type="button" data-t="conf-menos" aria-label="Menos ${p}">${ICONOS.menos}</button><button type="button" data-t="conf-mas" aria-label="Más ${p}">${ICONOS.mas}</button></div>
      <div class="contador-acciones"><button type="button" class="boton boton--secundario" data-t="cancelar">No apuntar</button><button type="button" class="boton" data-t="apuntar">${ICONOS.check}Apuntar</button></div>`;
  } else if (F.f === 'previa') {
    grande = String(Math.max(1, Math.ceil(F.dur - s)));
    arriba = F.lado ? `Lado ${F.lado} de ${lados}` : 'Prepárate';
    abajo = F.lado === 2 ? 'Cambia de lado' : 'Colócate en posición';
    prog = 0;
    botones = '<div class="contador-acciones"><button type="button" class="boton" data-t="fin">Empezar ya</button></div>';
  } else {
    // Con minutos (cardio «8 min») se lee en minutos, no «480 s» (E5, R18).
    arriba = (lados > 1 ? `Lado ${F.lado} de ${lados}, ` : '') + 'objetivo ' + objetivo;
    if (s < F.lo) { grande = mmss(Math.ceil(F.lo - s)); abajo = enMin ? 'Sigue a tu ritmo' : 'Aguanta'; }
    else if (s < F.hi) { grande = mmss(Math.floor(s)); abajo = `Mínimo hecho. Sigue hasta ${tx(F.hi)} si puedes`; estadoCls += ' logrado'; }
    else { grande = '+' + mmss(Math.floor(s - F.hi)); abajo = `Objetivo superado: llevas ${enMin ? mmss(Math.floor(s)) : Math.floor(s) + ' s'}`; estadoCls += ' superado'; }
    prog = Math.min(1, s / F.hi);
    const ultimoLado = !t.fases.slice(t.i + 1).some(x => x.f === 'trabajo');
    botones = `<div class="contador-acciones"><button type="button" class="boton boton--secundario" data-t="pausa">${pausa ? ICONOS.play + 'Seguir' : ICONOS.pausa + 'Pausar'}</button>
      <button type="button" class="boton" data-t="fin">${ultimoLado ? ICONOS.check + 'Hecho' : 'Cambiar de lado'}</button></div>`;
  }
  poner(el, `temporizador cuenta contador contador--pantalla ${estadoCls}${pausa && !t.confirmar ? ' pausado' : ''}`,
    `<span class="contador-agua" aria-hidden="true"></span>
    <div class="contador-cab"><p class="contador-nombre" id="ct-n" tabindex="-1">${h(t.nombre || t.etiqueta)}</p><p class="contador-estado c-arriba"></p></div>
    <div class="contador-centro"><b class="contador-reloj c-num" role="timer" aria-live="off"></b><p class="contador-meta c-abajo" aria-live="polite"></p></div>
    <div class="contador-pie">${botones}${t.sinSonido ? `<button type="button" class="boton boton--texto contador-sonido" data-t="sonido">${ICONOS.reloj}Activar el sonido</button>` : ''}</div>
    <button type="button" class="boton-icono contador-x" data-t="cancelar" aria-label="Cancelar sin apuntar">${ICONOS.x}</button>`,
    { '.c-arriba': arriba, '.c-num': grande, '.c-abajo': pausa && !t.confirmar ? 'En pausa' : abajo });
  el.style.setProperty('--p', String(prog));
  if (nuevo) {
    ponerInerte(true);
    const n = el.querySelector('#ct-n'); try { n && n.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }
}

// ── Alarma de fin de descanso: en la propia barra ──
function pintarAlarma() {
  const a = alarmaViva, el = caja('alert');
  document.body.classList.add('con-temporizador'); document.body.classList.remove('con-cuenta');
  ponerInerte(false);
  el.removeAttribute('aria-modal'); el.removeAttribute('aria-labelledby'); el.removeAttribute('aria-label');
  el.setAttribute('aria-live', 'assertive'); el.tabIndex = -1;
  const reloj = a.hace ? `−${mmss(a.hace)}` : '0:00';
  poner(el, `temporizador descanso descanso--fija descanso--alarma alarma sobre-acento${movimientoReducido() ? '' : ' suena'}`,
    `<span class="descanso-nivel" aria-hidden="true"></span>
    <div class="descanso-fila">
      <div class="descanso-txt"><span class="descanso-et">${h(a.titulo)}</span><b class="descanso-reloj">${h(reloj)}</b><span class="eco" aria-hidden="true"></span></div>
      <button type="button" class="boton boton--secundario" data-t="extra" aria-label="Descansar 15 segundos más">+15</button>
      <button type="button" class="boton boton--secundario" data-t="cerrar">Cerrar</button>
    </div>
    ${a.hace ? `<p class="alarma-sub">El descanso terminó hace ${h(mmss(a.hace))}.</p>` : ''}`, {});
  el.style.setProperty('--p', '0');
  reservarAlto(el);
}
function alarmaDescanso(titulo, hace, meta) {
  cerrarAlarma({ foco: false });
  alarmaViva = { titulo, hace: hace > 3 ? Math.round(hace) : 0, meta };
  pitar(); vibrar(VIBRA_ALARMA);
  if (enOtraSesion(meta)) { alarmaViva = null; return; }
  pintarAlarma();
  // Recibe el foco (el lector lo anuncia y «Cerrar» queda a un Tab) y se cierra sola a los 8 s.
  const el = document.getElementById('temporizador');
  const escribiendo = document.activeElement && document.activeElement.matches('input:not([type=hidden]), textarea, select, [contenteditable]');
  try { el && !escribiendo && !document.querySelector('.hoja-fondo') && el.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  alarmaViva.cierre = setTimeout(() => cerrarAlarma(), ALARMA_SEG * 1000);
}
// Quita la alarma (al cerrarla, al marcar la serie siguiente o a los 8 s). El foco vuelve a la serie siguiente.
export function cerrarAlarma({ foco = true } = {}) {
  if (!alarmaViva) return;
  clearTimeout(alarmaViva.cierre);
  alarmaViva = null;
  const el = document.getElementById('temporizador');
  const teniaFoco = el && el.contains(document.activeElement);
  try { sonido && !t && sonido.pause(); } catch (e) { /* nada */ }
  if (!t) quitarCaja(); else pintarCaja();
  if (foco && teniaFoco) {
    const b = document.querySelector('#vista [data-principal]') || document.querySelector('#vista h1');
    try { b && b.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }
}

// ── Avanzar con la hora real ──
// Las transiciones automáticas usan el final previsto de cada fase (no «ahora»), así un bloqueo de pantalla
// largo no descuadra nada: al volver, se recorren las fases que ya han pasado. enVivo = con la pantalla a la vista.
function avanzar(enVivo = true) {
  let cambio = false;
  while (t && t.pausa == null && !t.confirmar) {
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
        if (enVivo) { t.avisos['vivo' + t.i] = 1; pitar(); vibrar([300, 120, 300]); destello(); }
        if (!ultimo) { t.tiempos.push(F.hi); t.inicio += F.hi * 1000; t.i++; continue; }
      }
      // Si el máximo llegó con el móvil bloqueado (o la app cerrada), no se sabe cuándo paró: se pregunta (tope y
      // confirmación). Si se avisó con la pantalla a la vista, se sigue contando: los segundos son reales.
      if (ultimo && !enVivo && s >= F.hi && !t.avisos['vivo' + t.i]) {
        t.confirmar = { seg: F.hi }; t.pausa = F.hi * 1000; cambio = true;
        try { sonido && sonido.pause(); } catch (e) { /* nada */ }
        vibrar(VIBRA_ALARMA);
        break;
      }
      if (ultimo && s >= F.hi + EXTRA_MAX) { t.tiempos.push(Math.round(F.hi + EXTRA_MAX)); return terminar(true, enVivo); }
      break;
    }
    if (F.f === 'descanso' && s >= F.dur) return terminar(true, enVivo, s - F.dur);
    break;
  }
  if (cambio) { guardar(); mediaSession(); }
  pintarCaja();
}

function bucle(enVivo = true) {
  clearInterval(tic);
  // En segundo plano no se avanza (el audio programado suena igual): al volver se recorre lo que pasó.
  tic = setInterval(() => { if (!t) return clearInterval(tic); if (!document.hidden) avanzar(true); }, 200);
  avanzar(enVivo);
}

function destello() {
  const el = document.getElementById('temporizador'); if (!el) return;
  el.classList.remove('destello'); void el.offsetWidth; el.classList.add('destello');
}

function terminar(natural, enVivo = true, retraso = 0) {
  const x = t; t = null; clearInterval(tic); guardar(); mediaSession(); quitarCaja();
  if (!x) return;
  if (!natural || x.tipo === 'tiempo') { try { sonido && sonido.pause(); } catch (e) { /* nada */ } }
  if (x.tipo === 'descanso') {
    if (natural) alarmaDescanso((x.meta && x.meta.siguiente) || 'A por la siguiente serie', enVivo ? 0 : retraso, x.meta);
    else { try { sonido && sonido.pause(); } catch (e) { /* nada */ } }
  } else if (x.tiempos.length && alFin) alFin(x.meta, x.tiempos);
  if (!pantallaBloqueo) mantenerPantalla();
}

function empezar(nuevo) {
  cerrarAlarma({ foco: false });
  t = { i: 0, inicio: ahora(), pausa: null, tiempos: [], avisos: {}, confirmar: null, ...nuevo };
  guardar(); manejadoresMedia(); mediaSession(); mantenerPantalla();
  programarSonido();
  bucle();
}

// ── API para la sesión ──
// Al terminar un ejercicio por tiempo se llama fn(meta, tiempos) con los segundos aguantados (uno por lado).
export function registrarFin(fn) { alFin = fn; }

// Descanso de la barra. meta: { sesion, siguiente } (siguiente: lo que dice la alarma, «A por la serie 2»).
export function descanso(seg, etiqueta = 'Descanso', meta = null) {
  if (!seg) return;
  empezar({ tipo: 'descanso', etiqueta, meta, fases: [{ f: 'descanso', dur: seg }] });
}

// Ejercicio por tiempo. lo/hi en segundos (30-45 s → 30 y 45). lados = 2 para «c/lado». u: 's' o 'min'.
export function cuenta({ lo, hi, lados = 1, u = 's', nombre = '', etiqueta, meta }) {
  hi = Math.max(lo, hi || lo);
  const fases = [];
  for (let l = 1; l <= lados; l++) {
    fases.push({ f: 'previa', dur: PREVIA, lado: lados > 1 ? l : 0 });
    fases.push({ f: 'trabajo', lo, hi, lado: lados > 1 ? l : 0 });
  }
  empezar({ tipo: 'tiempo', etiqueta, nombre: nombre || etiqueta, u, fases, meta });
}

export const activo = () => !!t;
export const alarmaDe = () => (alarmaViva ? alarmaViva.meta || {} : null);
export const info = () => t && { tipo: t.tipo, meta: t.meta };
export function parar() { t = null; clearInterval(tic); guardar(); mediaSession(); try { sonido && sonido.pause(); } catch (e) { /* nada */ } pintarCaja(); }

function accion(a) {
  if (a === 'cerrar') return cerrarAlarma();
  if (a === 'extra') { const m = alarmaViva && alarmaViva.meta; cerrarAlarma({ foco: false }); return descanso(15, 'Descanso extra', m); }
  if (!t) return;
  const F = fase();
  if (a === 'sonido') { t.sinSonido = false; guardar(); pitar('corto'); programarSonido(); return pintarCaja(); }
  if (t.confirmar) {
    const paso = t.u === 'min' || F.hi >= 120 ? 60 : 5;
    if (a === 'conf-menos') t.confirmar.seg = Math.max(paso, t.confirmar.seg - paso);
    else if (a === 'conf-mas') t.confirmar.seg = Math.min(F.hi + EXTRA_MAX, t.confirmar.seg + paso);
    else if (a === 'apuntar') { t.tiempos.push(t.confirmar.seg); return terminar(true); }
    else if (a === 'cancelar') return parar();
    else return;
    guardar(); return pintarCaja();
  }
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
  const b = e.target.closest && e.target.closest('#temporizador [data-t]'); if (!b) return;
  accion(b.dataset.t);
});
// Escape en el contador: cancelar sin apuntar; en la alarma: cerrarla.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (alarmaViva && !document.querySelector('.hoja-fondo')) { cerrarAlarma(); return; }
  if (t && t.tipo === 'tiempo' && !document.querySelector('.hoja-fondo')) { e.preventDefault(); accion('cancelar'); }
});

// Al volver a la app: recolocar, y si algo terminó mientras no mirabas, enseñarlo.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (t) { avanzar(false); mantenerPantalla(); }
});
// Otra pestaña (o la app instalada) cambió el temporizador: si lo quitó («Saltar», terminar), aquí se para todo
// (sin alarma ni vibración fantasma); si empezó o cambió uno, se adopta.
window.addEventListener('storage', e => {
  if (e.key !== CLAVE) return;
  let g;
  try { g = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { g = null; }
  clearInterval(tic);
  try { sonido && sonido.pause(); } catch (err) { /* nada */ }
  if (!g || !g.fases) { t = null; cerrarAlarma({ foco: false }); mediaSession(); quitarCaja(); return; }
  cerrarAlarma({ foco: false });
  t = g; mediaSession(); bucle(false);
});
// Al cambiar de pantalla, la barra se enseña o se esconde (no va encima de otra sesión).
window.addEventListener('hashchange', () => { if (t || alarmaViva) pintarCaja(); });

// Recuperar un temporizador si la app se recargó a mitad.
setTimeout(() => {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!g || !g.fases) return;
    const F = g.fases[g.i];
    const s = (g.pausa != null ? g.pausa : ahora() - g.inicio) / 1000;
    // Tope: un descanso que acabó hace más de 10 min o un ejercicio por tiempo pasado su máximo + 2 min (lo que
    // quedaba de previas y lados incluido) ya no se recupera. Uno que espera confirmación (en pausa) sí.
    const resto = g.fases.slice(g.i).reduce((a, x) => a + (x.f === 'previa' ? x.dur : x.f === 'trabajo' ? x.hi : 0), 0);
    if ((F.f === 'descanso' && s - F.dur > 10 * 60) || (g.tipo === 'tiempo' && g.pausa == null && s > resto + EXTRA_MAX)) { localStorage.removeItem(CLAVE); return; }
    t = g; manejadoresMedia(); mediaSession();
    bucle(false); // lo que pasó mientras la app estaba cerrada se trata como con el móvil bloqueado
    if (t) programarSonido();
  } catch (e) { localStorage.removeItem(CLAVE); }
}, 0);
