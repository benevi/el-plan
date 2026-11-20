// Versiones de la app: registra el service worker, busca versiones nuevas y avisa para actualizar.
// - La página sabe de qué versión es por <meta name="pipos-version"> de index.html (la escribe
//   `npm run version`; es la VERSION de sw.js con la que se instala). La enseña Perfil → Ajustes.
// - Al volver a primer plano pide al navegador que mire si hay sw.js nuevo (reg.update()).
// - Si hay una versión nueva esperando, muestra un aviso fijo «Hay una versión nueva — Actualizar».
//   La versión nueva solo entra al tocarlo (skipWaiting a petición). Con una sesión en curso el aviso
//   espera a que termine.
// - Cuando una versión nueva se activa (desde otra pestaña), sw.js lo anuncia por BroadcastChannel y
//   llega controllerchange: esta pestaña tiene código de otra versión, así que se recarga si no hay
//   sesión en curso; si la hay, lo avisa y se recarga al terminarla.
// El aviso es propio (no avisoFijo de ui.js): ese hueco es para «No se ha podido guardar», que manda.
import { estado, escuchar, hoyISO, guardarYa } from './estado.js';

const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="pipos-version"]') : null;
const version = (meta && meta.content) || null;
export const versionApp = () => version;

// Para las pruebas en jsdom (allí no se puede recargar de verdad).
export const opciones = { recargar: () => location.reload() };

let registro = null;
let pidioActualizar = false;
let avisoPendiente = false; // versión nueva esperando, con el aviso guardado mientras hay sesión
let recargarAlTerminar = false; // otra versión ya activa: recargar en cuanto acabe la sesión
let recargando = false;

// Hay sesión en curso: la de hoy está empezada, o alguna se empezó hace menos de 6 horas (pasada la medianoche).
export function haySesionEnCurso(S = estado()) {
  const sesiones = Object.values((S && S.sesiones) || {});
  const reciente = Date.now() - 6 * 3600e3;
  return sesiones.some(s => s && s.estado === 'en_curso' && (s.fecha === hoyISO() || (s.empezada && Date.parse(s.empezada) > reciente)));
}

function recargar() {
  if (recargando) return;
  recargando = true;
  guardarYa();
  opciones.recargar();
}

// Pregunta su VERSION a un service worker. Los de antes de este esquema no contestan: null.
function preguntarVersion(sw, espera = 1500) {
  return new Promise(res => {
    if (!sw) return res(null);
    const canal = new MessageChannel();
    const fin = v => { clearTimeout(t); canal.port1.close(); res(v); };
    const t = setTimeout(() => fin(null), espera);
    canal.port1.onmessage = e => fin((e.data && e.data.version) || null);
    try { sw.postMessage({ tipo: 'version' }, [canal.port2]); } catch { fin(null); }
  });
}

function quitarAviso() { const el = document.getElementById('aviso-version'); if (el) el.remove(); document.body.classList.remove('con-aviso-version'); }

function pintarAviso(texto) {
  let el = document.getElementById('aviso-version');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso-version';
    el.className = 'aviso-version';
    el.setAttribute('role', 'status');
    const txt = document.createElement('span');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = 'Actualizar';
    b.addEventListener('click', actualizar);
    el.append(txt, b);
    document.body.appendChild(el);
    document.body.classList.add('con-aviso-version'); // deja sitio debajo para que no tape nada
  }
  el.firstChild.textContent = texto;
}

// Versión nueva esperando: aviso, salvo con una sesión en curso (entonces, al terminarla).
export function mostrarAvisoVersion() {
  if (haySesionEnCurso()) { avisoPendiente = true; quitarAviso(); return; }
  avisoPendiente = false;
  pintarAviso('Hay una versión nueva');
}

function actualizar() {
  const esperando = registro && registro.waiting;
  if (!esperando) { recargar(); return; } // ya está activa: basta recargar
  pidioActualizar = true;
  esperando.postMessage({ tipo: 'actualizar' });
  setTimeout(recargar, 4000); // por si no llega controllerchange
}

// Se ha activado la versión `nueva` (en esta pestaña o en otra).
function versionActivada(nueva) {
  if (pidioActualizar) { recargar(); return; }
  if (!nueva || nueva === version) return; // primera instalación o paso desde main: esta página ya es esa
  if (haySesionEnCurso()) {
    recargarAlTerminar = true;
    pintarAviso('Hay una versión nueva: se pondrá al terminar la sesión');
    return;
  }
  recargar();
}

async function revisar() {
  const esperando = registro && registro.waiting;
  if (!esperando || !navigator.serviceWorker.controller) return;
  const nueva = await preguntarVersion(esperando);
  if (nueva && nueva !== version) mostrarAvisoVersion();
}

export async function iniciarVersiones() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;

  sw.addEventListener('controllerchange', async () => {
    if (pidioActualizar) { recargar(); return; }
    versionActivada(await preguntarVersion(sw.controller));
  });
  if (typeof BroadcastChannel !== 'undefined') {
    const canal = new BroadcastChannel('pipos-version');
    canal.onmessage = e => { if (e.data && e.data.tipo === 'activada') versionActivada(e.data.version); };
    if (canal.unref) canal.unref(); // node (pruebas): que no impida terminar
  }

  // Al terminar la sesión: recarga si otra versión ya está activa, o enseña el aviso pendiente.
  // Si empieza una con el aviso de «versión esperando» a la vista, lo guarda para luego.
  escuchar(() => {
    if (haySesionEnCurso()) {
      if (!recargarAlTerminar && document.getElementById('aviso-version')) { quitarAviso(); avisoPendiente = true; }
      return;
    }
    if (recargarAlTerminar) { setTimeout(recargar, 1500); return; } // deja ver «¡Sesión guardada!»
    if (avisoPendiente) mostrarAvisoVersion();
  });

  try {
    registro = await sw.register('sw.js');
  } catch (e) {
    console.warn('Sin modo sin conexión', e);
    return;
  }
  registro.addEventListener('updatefound', () => {
    const nuevo = registro.installing;
    if (!nuevo) return;
    nuevo.addEventListener('statechange', () => { if (nuevo.state === 'installed') revisar(); });
  });
  revisar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registro.update().catch(() => {});
  });
}
