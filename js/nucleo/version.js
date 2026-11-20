// Versiones de la app: registra el service worker, busca versiones nuevas y avisa para actualizar.
// - Al volver a primer plano pide al navegador que mire si hay sw.js nuevo (reg.update()).
// - Si hay una versión nueva esperando, muestra un aviso fijo «Hay una versión nueva — Actualizar».
// - La versión nueva solo entra al tocar «Actualizar» (skipWaiting a petición): la página que está
//   abierta sigue con los archivos de su versión hasta recargar, y nunca se recarga sola.
// - Con una sesión en curso no se avisa: se espera a que termine para no cortar el entrenamiento.
// versionApp() da la VERSION del service worker que controla la página (la enseña Perfil → Ajustes).
import { estado, escuchar, hoyISO } from './estado.js';

let version = null;
let avisoPendiente = false;
let pidioActualizar = false;
let registro = null;

export const versionApp = () => version;

// Hay sesión en curso: la de hoy está empezada, o alguna se empezó hace menos de 6 horas (pasada la medianoche).
export function haySesionEnCurso(S = estado()) {
  const sesiones = Object.values((S && S.sesiones) || {});
  const reciente = Date.now() - 6 * 3600e3;
  return sesiones.some(s => s && s.estado === 'en_curso' && (s.fecha === hoyISO() || (s.empezada && Date.parse(s.empezada) > reciente)));
}

function pintarVersion() {
  for (const el of document.querySelectorAll('[data-version-app]')) el.textContent = version || '—';
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

export function mostrarAvisoVersion() {
  if (haySesionEnCurso()) { avisoPendiente = true; return; }
  avisoPendiente = false;
  if (document.getElementById('aviso-version')) return;
  const el = document.createElement('div');
  el.id = 'aviso-version';
  el.className = 'aviso-version';
  el.setAttribute('role', 'status');
  const txt = document.createElement('span');
  txt.textContent = 'Hay una versión nueva';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = 'Actualizar';
  b.addEventListener('click', actualizar);
  el.append(txt, b);
  document.body.appendChild(el);
}

function actualizar() {
  const esperando = registro && registro.waiting;
  if (!esperando) { location.reload(); return; } // ya está activa (otra pestaña la activó): basta recargar
  pidioActualizar = true;
  esperando.postMessage({ tipo: 'actualizar' });
  // Si en unos segundos no cambia el controlador (no debería), recarga igual.
  setTimeout(() => location.reload(), 4000);
}

function revisar() {
  if (registro && registro.waiting && navigator.serviceWorker.controller) mostrarAvisoVersion();
}

export async function iniciarVersiones() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const sw = navigator.serviceWorker;
  let controlador = sw.controller;
  // Controlador de antes de este esquema (main o una vista previa vieja): no contesta a «version».
  // Si la versión nueva lo sustituye, la página ya es nueva: no hace falta avisar.
  let controladorViejo = false;
  if (controlador) {
    version = await preguntarVersion(controlador);
    controladorViejo = !version;
    pintarVersion();
  }

  sw.addEventListener('controllerchange', async () => {
    if (pidioActualizar) { location.reload(); return; }
    const habia = controlador;
    controlador = sw.controller;
    version = await preguntarVersion(controlador);
    pintarVersion();
    // Primera instalación o paso desde un service worker viejo: la página ya tiene los archivos buenos.
    if (habia && !controladorViejo) mostrarAvisoVersion();
    controladorViejo = false;
  });

  // Al terminar la sesión en curso, enseña el aviso que quedó pendiente; si empieza una, lo guarda para luego.
  escuchar(() => {
    const enCurso = haySesionEnCurso();
    const el = document.getElementById('aviso-version');
    if (el && enCurso) { el.remove(); avisoPendiente = true; } else if (avisoPendiente && !enCurso) mostrarAvisoVersion();
  });

  try {
    registro = await sw.register('sw.js');
  } catch (e) {
    console.warn('Sin modo sin conexión', e);
    return;
  }
  if (!controlador) sw.ready.then(async r => { if (!version) { version = await preguntarVersion(r.active); pintarVersion(); } });
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
