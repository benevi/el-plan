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
// - Modo sin conexión (D5): si el service worker de esta app no llega a instalarse (p. ej. un archivo que no casa
//   con su huella), la página sigue con el de antes (el de `main`, o ninguno) sin que se note. Se dice una vez con
//   un aviso y en Perfil › Ajustes («Modo sin conexión: no instalado» con «Reintentar»). Reintentar solo pide al
//   navegador que lo vuelva a intentar: lo que funcionaba sin conexión sigue igual mientras tanto.
// El aviso es propio (no avisoFijo de ui.js): ese hueco es para «No se ha podido guardar», que manda.
import { estado, escuchar, hoyISO, guardarYa } from './estado.js';
import { aviso } from './ui.js';

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
let modo = null; // modo sin conexión: null (sin service worker), 'instalando', 'listo' o 'no-instalado'
let avisadoModo = false;
const oyentesModo = new Set();
export const modoSinConexion = () => modo;
export const alCambiarModo = fn => { oyentesModo.add(fn); return () => oyentesModo.delete(fn); };
function ponerModo(m, { fallo = false } = {}) {
  if (m === 'no-instalado' && fallo && !avisadoModo) {
    avisadoModo = true;
    aviso('El modo sin conexión no se ha podido instalar. Puedes reintentarlo en Perfil › Ajustes.', 'info');
  }
  if (m === modo) return;
  modo = m;
  for (const fn of oyentesModo) { try { fn(m); } catch (e) { console.error(e); } }
}

// Hay sesión en curso: la de hoy está empezada, o alguna se empezó hace menos de 6 horas (pasada la medianoche).
// Un ejercicio suelto a medias (C-SUELTO-1) solo cuenta las 6 horas: olvidado, no retiene la versión nueva todo el día.
export function haySesionEnCurso(S = estado()) {
  const sesiones = Object.values((S && S.sesiones) || {});
  const reciente = Date.now() - 6 * 3600e3;
  const suelta = s => !!(s.origen && s.origen.tipo === 'suelto');
  return sesiones.some(s => s && s.estado === 'en_curso' && ((s.fecha === hoyISO() && !suelta(s)) || (s.empezada && Date.parse(s.empezada) > reciente)));
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

// ¿Está instalado el service worker de esta app? (el de `main` y los de antes no contestan a la versión)
// Cada comprobación tiene su turno: una vieja (que esperaba la respuesta de un service worker que ya no manda, p. ej.
// el de `main` en el paso a esta versión) no pisa lo que ha dicho una más nueva.
let turnoModo = 0;
async function comprobarModo({ fallo = false } = {}) {
  if (!registro) return;
  const turno = ++turnoModo;
  const vigente = () => turno === turnoModo;
  const sw = navigator.serviceWorker;
  const ctrl = sw.controller;
  if (ctrl && await preguntarVersion(ctrl)) return vigente() && ponerModo('listo');
  if (!vigente()) return;
  const activo = registro.active;
  if (activo && activo !== ctrl && await preguntarVersion(activo)) return vigente() && ponerModo('listo');
  if (!vigente()) return;
  // Mientras se esperaba, otro service worker ha tomado el control: se vuelve a mirar con él.
  if (sw.controller !== ctrl) { comprobarModo({ fallo }); return; }
  if (registro.installing || registro.waiting) return ponerModo('instalando');
  ponerModo('no-instalado', { fallo });
}
function vigilarInstalacion(nuevo) {
  if (!nuevo) return;
  ponerModo(modo === 'listo' ? 'listo' : 'instalando');
  nuevo.addEventListener('statechange', () => {
    if (nuevo.state === 'installed') revisar();
    // (en «installed» no se pregunta nada al controlador: con el de `main` entrando, retrasaba su activación)
    if (nuevo.state === 'activated') comprobarModo();
    if (nuevo.state === 'redundant') comprobarModo({ fallo: true });
  });
}
// «Reintentar» de Perfil › Ajustes. Devuelve false si no se pudo ni preguntar (sin conexión).
export async function reintentarSinConexion() {
  if (!registro) return false;
  ponerModo('instalando');
  try {
    // Sin ningún service worker (la primera instalación falló) update() no sirve: se vuelve a registrar.
    if (registro.active || registro.waiting || registro.installing) await registro.update();
    else registro = await navigator.serviceWorker.register('sw.js');
  } catch { await comprobarModo(); return false; }
  vigilarInstalacion(registro.installing);
  await comprobarModo();
  return true;
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
    comprobarModo();
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
  registro.addEventListener('updatefound', () => vigilarInstalacion(registro.installing));
  vigilarInstalacion(registro.installing);
  comprobarModo();
  revisar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registro.update().catch(() => {});
  });
}
