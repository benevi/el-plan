// Estado de la app y guardado en el móvil (localStorage).
// Cada móvil guarda los datos de UNA persona (su dueño). No se comparte nada entre móviles.
//
// Reglas para todas las áreas:
// - Leer con `estado()` (objeto vivo, no lo sustituyas).
// - Cambiar con `cambiar(fn, motivo)`: aplica fn(estado), guarda y avisa a quien escuche.
// - Escuchar con `escuchar(fn)`; fn(motivo) se llama tras cada cambio.
// - Cada área guarda lo suyo bajo su clave (perfil, plan, sesiones, medidas, dolor…).
//   Si necesitas una clave nueva, añádela en `nuevo()` y, si hace falta, en `migrar()`.
// - Si cambias S sin `cambiar` (no deberías), llama a `guardarYa()`: al salir solo se guarda si hay cambios pendientes.
// - Cómo se guarda (rescate, revisión entre pestañas, espejo en IndexedDB): ver «Guardado robusto» más abajo.
// - Copias (exportar/importar) y migración de la app anterior: ver «Copia de seguridad» y «Migración» más abajo.

import * as espejoIDB from './espejo.js';
import { normalizarEstado, ErrorCopia, migracion as migracionLeida, esObjeto, texto } from './normalizar.js';
import { migrar, corregirAntigua, esViejo, VERSION_MIGRACION } from './migracion.js';
import { PERSONAS } from '../datos/constantes.js';

export { ErrorCopia };

const CLAVE = 'pipos4';
const CLAVE_VIEJA = 'elplan2';
export const VERSION = 4;

export function hoyISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function perfilVacio() {
  return {
    objetivos: [],            // claves de OBJETIVOS, varias a la vez
    nivel: 1,                 // 1-3
    nivelAuto: true,          // si el medidor de progreso puede subirlo solo
    lesiones: [],             // { id, zona, dolor 0-10, desde 'YYYY-MM-DD', nota, activa, tipo?, detalle?, dolorRevisar?, vid? }
    disponibilidad: { dias: 3, minutos: 60, diasSemana: [] }, // diasSemana 1=lunes…7; cambia cada semana
    lugares: ['gym', 'piscina'],
    materialCasa: [],
    gustos: {},               // { idEjercicio: 'rechazo' | 'nogusta' | 'gusta' }
    datos: { sexo: '', altura: null, nacimiento: '' },
    notas: '',                // lo que quiera contarle al entrenador
    // salud?: datos de salud (D4, opcional; ver areas/entrenador/salud.js) · nadar25?: sabe nadar 2 × 25 m seguidos
  };
}

export function nuevo() {
  return {
    version: VERSION,
    dueño: null,              // 'victor' | 'virginia'
    perfil: perfilVacio(),
    plan: null,               // plan semanal (ver areas/entrenador)
    sesiones: {},             // { id: sesión } (ver areas/sesion/modelo.js)
    medidas: [],              // { fecha, peso, cintura, cadera, cuello, pecho, brazo, muslo, grasa, vid? }
    dolor: [],                // { fecha, zona, dolor, momento: 'antes'|'despues'|'dia'|'perfil', sesion, vid? }
    // alarmas?: [{ fecha, respuesta 'si'|'no', frase }]  señales de alarma apuntadas (opcional, PR 8)
    // misSesiones?: [{ id, nombre, lugar, minutos, creada, ejercicios: [{ id, rol, series, reps, descanso }] }]
    //   sesiones guardadas para repetir (opcional; js/areas/entrenador/mias.js)
    ajustes: { codigo: '', vibrar: true, sonido: true }, // la URL de la API es siempre relativa (/api/…)
    // Lo traído de la app anterior (ver js/nucleo/migracion.js): versión de los datos, de quién y claves ya migradas.
    migracion: { version: VERSION_MIGRACION, dueño: null, claves: [], sexoRevisar: false },
  };
}

let S = null;
const oyentes = new Set();
let temporizadorGuardar = null;

// Almacén de datos: en el navegador, localStorage. Las pruebas en node pueden inyectar otro
// con la misma forma (getItem/setItem/removeItem/key/length) mediante `usarAlmacen`; si no se inyecta nada, se usa localStorage.
let almacenInyectado = null;
const almacen = () => almacenInyectado || localStorage;
export function usarAlmacen(obj) { clearTimeout(temporizadorGuardar); almacenInyectado = obj || null; }

// Espejo en IndexedDB (js/nucleo/espejo.js). Las pruebas pueden inyectar otro con { leer(), escribir(reg) }.
let espejo = espejoIDB;
export function usarEspejo(obj) { espejo = obj || espejoIDB; }

function rellenar(base, x) {
  // Añade claves que falten sin pisar lo guardado (útil al ampliar el modelo).
  for (const k of Object.keys(base)) {
    if (x[k] === undefined) x[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && x[k] && typeof x[k] === 'object') rellenar(base[k], x[k]);
  }
  return x;
}

// ── Guardado robusto ──
// - `pipos4` guarda el estado tal cual (su forma no cambia). Lo demás va en claves aparte:
//   `pipos4-rev` (revisión, para que una pestaña vieja no pise a una nueva), `pipos4-roto-<fecha ISO>`
//   (lo que no se pudo leer, intacto), `pipos4-conflicto` (cambios de esta pestaña que otra se adelantó a guardar)
//   y `pipos4-copia` (fecha de la última copia exportada). Los cambios de una pestaña que otra se adelantó a
//   guardar se apartan primero en el espejo (registro 'conflicto') y, si no se puede, en `pipos4-conflicto`.
// - Solo se escribe si hay cambios pendientes (`sucio`), salvo `guardarYa()`, que escribe siempre.
// - Si lo guardado no se puede leer, la app queda «en rescate»: no escribe nada en `pipos4` ni en el espejo
//   hasta que la persona elija (cargar copia, recuperar del espejo o empezar de cero).
// - Tras cada guardado correcto se escribe el mismo texto en el espejo de IndexedDB. Si localStorage falla,
//   el espejo se escribe igualmente y se avisa (escucharGuardado) para mostrar un aviso persistente.
const CLAVE_REV = CLAVE + '-rev';
const CLAVE_COPIA = CLAVE + '-copia';
const CLAVE_CONFLICTO = CLAVE + '-conflicto';
export const PREFIJO_ROTO = CLAVE + '-roto-';
export const CAPACIDAD_APROX = 5 * 1024 * 1024; // localStorage da unos 5 MB por sitio

let rev = 0;               // revisión de lo que hay en memoria (la última leída o escrita)
let sucio = false;         // hay cambios en memoria sin escribir
let rescate = null;        // null | { motivo: 'roto'|'vacio'|'espejo', copia: clave|null, espejo: info|null }
let errorGuardar = null;   // último error de setItem (se limpia al guardar bien)
let cargadoVacio = false;  // al cargar no había nada en pipos4
let regEspejo = null;      // registro válido del espejo que se ofrece en el rescate
let revEspejo = 0;         // revisión más alta conocida del espejo (leída al arrancar o enviada después)
let textoDisco = null;     // el texto de pipos4 tal como lo leímos o escribimos por última vez
let espejoPendiente = false; // la lectura del espejo pasó del tope y aún no ha llegado (D6)
let espejoSaltado = false;   // mientras tanto no se escribió el espejo (para hacerlo al llegar)
const oyentesGuardado = new Set();

function leerCrudo() { try { return almacen().getItem(CLAVE); } catch { return null; } }
// ¿Alguien (otra pestaña) ha escrito pipos4 desde que lo leímos o escribimos? Por la revisión o, si aún no
// se ve la revisión (se escribe justo después), porque el texto ya no es el mismo.
const discoCambió = () => leerRev() > rev || leerCrudo() !== textoDisco;
function leerRev() { try { return Math.max(0, parseInt(almacen().getItem(CLAVE_REV), 10) || 0); } catch { return 0; } }
function claves() {
  const a = almacen(), r = [];
  try { for (let i = 0; i < a.length; i++) r.push(a.key(i)); } catch { /* nada */ }
  return r;
}
function avisarGuardado(ev) { oyentesGuardado.forEach(o => { try { o(ev); } catch (e) { console.error(e); } }); }
function avisar(motivo) { oyentes.forEach(o => { try { o(motivo); } catch (e) { console.error(e); } }); }
const hechas = x => Object.values((x && x.sesiones) || {}).filter(s => s && s.estado === 'hecha');

// Guarda el texto ilegible en `pipos4-roto-<fecha ISO>` (una sola vez por contenido). Devuelve la clave o null.
function apartarRoto(crudo) {
  const a = almacen();
  for (const k of claves()) { if (k && k.startsWith(PREFIJO_ROTO)) { try { if (a.getItem(k) === crudo) return k; } catch { /* nada */ } } }
  const k = PREFIJO_ROTO + new Date().toISOString();
  try { a.setItem(k, crudo); return k; } catch (e) { console.error('No se pudo apartar la copia de los datos ilegibles', e); return null; }
}

// Lo de la app anterior (elplan2) para migrar. Se lee en cada carga y nunca se borra. Va en `S.viejo` como
// propiedad no enumerable: no se escribe en pipos4 ni en las copias (sería duplicar elplan2, con los datos de
// las dos personas). Si elplan2 ya no está pero pipos4 guardó su `viejo` (versiones anteriores), ese se conserva.
function leerViejo() {
  try { const v = JSON.parse(almacen().getItem(CLAVE_VIEJA) || 'null'); return esViejo(v) ? v : null; } catch { return null; }
}
function ponerViejo(x) {
  const v = leerViejo();
  if (v) Object.defineProperty(x, 'viejo', { value: v, enumerable: false, writable: true, configurable: true });
  return x;
}
function nuevoConViejo() { return ponerViejo(nuevo()); }
function preparar(x) {
  // Sin `migracion`: datos de antes de esta versión (versión 1), que pueden necesitar la corrección única.
  if (!esObjeto(x.migracion)) x.migracion = migracionLeida(null);
  const r = rellenar(nuevo(), x);
  delete r.nutricion; // la nutrición irá en otra app
  if (esObjeto(r.ajustes)) delete r.ajustes.apiUrl; // ya no existe: la API es siempre relativa
  return ponerViejo(r);
}

export function cargar() {
  clearTimeout(temporizadorGuardar); // un guardado pendiente del estado anterior no debe escribir sobre el nuevo
  sucio = false; rescate = null; regEspejo = null; revEspejo = 0; cargadoVacio = false; espejoPendiente = false; espejoSaltado = false;
  const crudo = leerCrudo();
  textoDisco = crudo;
  rev = leerRev();
  let x = null;
  if (crudo == null || crudo === '') cargadoVacio = true;
  else {
    try { x = JSON.parse(crudo); } catch { x = null; }
    if (!esObjeto(x)) {
      x = null;
      rescate = { motivo: 'roto', copia: apartarRoto(crudo), espejo: null };
      console.warn('Los datos guardados no se pueden leer; quedan apartados en', rescate.copia);
    }
  }
  S = x ? preparar(x) : nuevoConViejo();
  infoAntesDeImportar(); // borra lo de antes de la última copia si ya tiene más de 7 días
  return S;
}

// Mira el espejo de IndexedDB (al arrancar, antes de pintar). Si pipos4 está roto o vacío, o si el espejo
// tiene una revisión más nueva que pipos4 (porque localStorage falló al escribir), deja la app en rescate
// ofreciendo el espejo. Devuelve el rescate (o null).
// Si la lectura pasa del tope, se sigue sin ella, pero (D6) mientras no llegue no se escribe el espejo (podría
// pisar su único registro con un estado vacío) y, si llega con datos y pipos4 estaba vacío, se ofrece el
// rescate entonces (avisar('rescate')).
const TARDE = Symbol('tarde');
const espejoValido = reg => {
  let x;
  try { x = reg && typeof reg.txt === 'string' ? JSON.parse(reg.txt) : null; } catch { x = null; }
  return esObjeto(x) && x.version === VERSION && esObjeto(x.perfil) && x.dueño ? x : null;
};
function espejoTardio(reg) {
  if (!espejoPendiente) return;
  espejoPendiente = false;
  const x = espejoValido(reg);
  const cargaActual = S;
  if (x && cargadoVacio && !rescate && (hechas(x).length > hechas(cargaActual).length || !cargaActual.dueño)) {
    rescate = { motivo: 'vacio', copia: null, espejo: { fecha: reg.fecha || null, dueño: x.dueño, sesiones: hechas(x).length, rev: +reg.rev || 0 } };
    regEspejo = reg;
    clearTimeout(temporizadorGuardar);
    avisar('rescate');
    return;
  }
  // Nada que rescatar: lo que no se escribió en el espejo mientras tanto, ahora, por encima de su revisión.
  if (espejoSaltado && !rescate) { espejoSaltado = false; guardarYa(); }
}
export async function revisarEspejo({ max = 1500 } = {}) {
  let reg, t = null;
  const lectura = Promise.resolve().then(() => espejo.leer());
  // Aunque la lectura llegue tarde (después del tope), su revisión cuenta para escribir siempre por encima.
  lectura.then(r => { if (r) revEspejo = Math.max(revEspejo, +r.rev || 0); espejoTardio(r); }, () => { espejoTardio(null); });
  try {
    reg = await Promise.race([lectura, new Promise(r => { t = setTimeout(() => r(TARDE), max); })]);
  } catch { reg = null; }
  clearTimeout(t);
  if (reg === TARDE) { espejoPendiente = true; return rescate; }
  if (reg) revEspejo = Math.max(revEspejo, +reg.rev || 0);
  const x = espejoValido(reg);
  if (!x) return rescate;
  const info = { fecha: reg.fecha || null, dueño: x.dueño, sesiones: hechas(x).length, rev: +reg.rev || 0 };
  if (rescate) { rescate.espejo = info; regEspejo = reg; }
  // Si el espejo tiene el mismo texto que pipos4 no hay nada que rescatar (aunque no se escribiera pipos4-rev).
  else if (!sucio && (cargadoVacio || (info.rev > rev && reg.txt !== textoDisco))) {
    rescate = { motivo: cargadoVacio ? 'vacio' : 'espejo', copia: null, espejo: info };
    regEspejo = reg;
  }
  return rescate;
}

export const estado = () => S;
// Cómo va el guardado: { sucio, rev, error, rescate }.
export const estadoGuardado = () => ({ sucio, rev, error: errorGuardar, rescate });
// fn({ tipo: 'error', error }) si falla escribir; fn({ tipo: 'ok' }) al volver a guardar bien tras un fallo;
// fn({ tipo: 'externo', apartado, perdido }) si se cargó lo que guardó otra pestaña (apartado: los cambios de
// aquí sin guardar se apartaron; perdido: había cambios sin guardar y no se pudieron apartar).
export function escucharGuardado(fn) { oyentesGuardado.add(fn); return () => oyentesGuardado.delete(fn); }

// Escribe S con una revisión mayor que `revMin`, que la propia y que la del espejo (el espejo no acepta
// revisiones menores que la suya). Devuelve true si localStorage lo aceptó.
// Con `estricto` (al cargar una copia), si localStorage no lo acepta no se toca nada más (ni el espejo):
// quien llama deshace y avisa.
function escribir(revMin = rev, { estricto = false } = {}) {
  clearTimeout(temporizadorGuardar);
  const nueva = Math.max(rev, revMin, revEspejo) + 1;
  const txt = JSON.stringify(S);
  const reg = { txt, rev: nueva, fecha: new Date().toISOString() };
  const alEspejo = () => {
    if (espejoPendiente) { espejoSaltado = true; return; } // aún no se sabe qué tiene el espejo (D6)
    revEspejo = Math.max(revEspejo, nueva);
    try { Promise.resolve(espejo.escribir(reg)).catch(() => {}); } catch { /* nada */ }
  };
  try {
    almacen().setItem(CLAVE, txt);
  } catch (e) {
    console.error('No se pudo guardar', e);
    if (estricto) return false;
    sucio = true; errorGuardar = e;
    alEspejo(); // el espejo sigue guardando aunque localStorage falle
    avisarGuardado({ tipo: 'error', error: e });
    return false;
  }
  rev = nueva; textoDisco = txt;
  try { almacen().setItem(CLAVE_REV, String(rev)); } catch (e) { console.warn('No se pudo guardar la revisión', e); }
  sucio = false;
  alEspejo();
  if (errorGuardar) { errorGuardar = null; avisarGuardado({ tipo: 'ok' }); }
  return true;
}

// ── Lo apartado (D5) ──
// Un solo hueco con lo último apartado: los cambios de esta pestaña que otra se adelantó a guardar, pipos4 al
// recuperar un espejo más nuevo, o lo de ahora al cargar otra copia cuando ya hay «datos de antes» (D2).
// Vive en el espejo (registro 'conflicto') o en pipos4-conflicto ({ fecha, txt }; antes, el texto a secas);
// vale el más nuevo. Perfil › Ajustes lo enseña con «Recuperarlo» (por importar(), reversible) y «Descartar».
let apartado = null; // { fecha, dueño, sesiones, donde: 'espejo'|'local' } o null; se lee con revisarApartado()
function infoApartadoDe(reg, donde) {
  let x;
  try { x = reg && typeof reg.txt === 'string' ? JSON.parse(reg.txt) : null; } catch { x = null; }
  if (!esObjeto(x)) return null;
  return { fecha: typeof reg.fecha === 'string' ? reg.fecha : null, dueño: x.dueño || null, sesiones: hechas(x).length, donde };
}
function leerApartadoLocal() {
  let crudo; try { crudo = almacen().getItem(CLAVE_CONFLICTO); } catch { crudo = null; }
  if (!crudo) return null;
  let x; try { x = JSON.parse(crudo); } catch { return null; }
  return esObjeto(x) && typeof x.txt === 'string' ? { txt: x.txt, fecha: x.fecha } : { txt: crudo, fecha: null };
}
function ponerApartadoLocal(reg) {
  try { almacen().setItem(CLAVE_CONFLICTO, JSON.stringify(reg)); return true; } catch (e) { console.error('No se pudo apartar en el móvil', e); return false; }
}
// El registro apartado más nuevo: { reg, donde } o null.
async function leerApartado() {
  let idb = null;
  try { if (typeof espejo.leerApartado === 'function') idb = await espejo.leerApartado(); } catch { idb = null; }
  const loc = leerApartadoLocal();
  const ok = r => !!(r && typeof r.txt === 'string' && infoApartadoDe(r));
  const a = ok(idb) ? { reg: idb, donde: 'espejo' } : null, b = ok(loc) ? { reg: loc, donde: 'local' } : null;
  if (a && b) return String(a.reg.fecha || '') >= String(b.reg.fecha || '') ? a : b;
  return a || b;
}
export async function revisarApartado() {
  const r = await leerApartado();
  apartado = r ? infoApartadoDe(r.reg, r.donde) : null;
  return apartado;
}
export const infoApartado = () => apartado;
async function borrarApartado(donde) {
  if (!donde || donde === 'local') { try { almacen().removeItem(CLAVE_CONFLICTO); } catch { /* nada */ } }
  if (!donde || donde === 'espejo') { try { if (typeof espejo.borrarApartado === 'function') await espejo.borrarApartado(); } catch { /* nada */ } }
}
export async function descartarApartado() { await borrarApartado(); apartado = null; }
// «Recuperarlo»: carga lo apartado con importar() (validado y reversible: lo de ahora queda en «datos de antes»
// o, si esos ya existen, pasa a ser lo apartado).
export async function recuperarApartado() {
  const r = await leerApartado();
  if (!r) { apartado = null; throw new ErrorCopia('Ya no hay nada apartado.'); }
  const res = importar(r.reg.txt, { interno: true, otraPersona: true });
  // Lo recuperado deja de estar apartado, salvo que lo de ahora haya ocupado ese mismo sitio (intercambio).
  if (apartando) { try { await apartando; } catch { /* nada */ } apartando = null; } // que el espejo acabe de escribir
  if (res.apartado !== r.donde) await borrarApartado(r.donde);
  await revisarApartado();
  return res;
}
// Aparta los cambios de esta pestaña que no se pudieron guardar: en el espejo (IndexedDB, donde suele haber
// sitio cuando localStorage está lleno) o, si no, en pipos4-conflicto. Devuelve si se pudo.
async function apartarConflicto(txt) {
  const reg = { txt, fecha: new Date().toISOString() };
  try { if (typeof espejo.apartar === 'function' && await espejo.apartar(reg)) { apartado = infoApartadoDe(reg, 'espejo'); return true; } } catch { /* sigue */ }
  if (ponerApartadoLocal(reg)) { apartado = infoApartadoDe(reg, 'local'); return true; }
  console.error('No se pudieron apartar los cambios de esta pestaña');
  return false;
}
let apartando = null;
// ¿Cargar ahora otra copia sustituiría lo apartado? (hay «datos de antes» vigentes y algo apartado). La interfaz
// lo avisa antes de confirmar.
export const cargarSustituyeApartado = () => !!(infoAntesDeImportar() && apartado);
export function avisoSustituyeApartado() {
  const a = cargarSustituyeApartado() && apartado;
  if (!a) return '';
  const f = a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  return ` Ojo: los datos apartados${f ? ` del ${f}` : ''} (${+a.sesiones} ${+a.sesiones === 1 ? 'sesión' : 'sesiones'}) se sustituirán por lo de ahora.`;
}
// Al cargar una copia, lo de ahora se aparta ya (en pipos4-conflicto, sin esperar) o, si no cabe, en el espejo.
// Devuelve dónde: 'local' o 'espejo'.
function apartarYa(txt) {
  const reg = { txt, fecha: new Date().toISOString() };
  if (ponerApartadoLocal(reg)) { apartado = infoApartadoDe(reg, 'local'); return 'local'; }
  apartando = apartarConflicto(txt); // si localStorage no da, al espejo (asíncrono): recuperarApartado lo espera
  return 'espejo';
}

// Carga lo que otra pestaña guardó en pipos4. Si aquí había cambios sin guardar, se apartan (apartarConflicto).
function recargarDeDisco() {
  const crudo = leerCrudo();
  let x;
  try { x = JSON.parse(crudo); } catch { x = null; }
  if (!esObjeto(x)) return false;
  const mio = sucio ? JSON.stringify(S) : null;
  clearTimeout(temporizadorGuardar);
  S = preparar(x); rev = leerRev(); textoDisco = crudo; sucio = false;
  avisar('externo');
  if (!mio) avisarGuardado({ tipo: 'externo', apartado: false, perdido: false });
  else apartarConflicto(mio).then(ok => avisarGuardado({ tipo: 'externo', apartado: ok, perdido: !ok }));
  return true;
}

// En rescate, otra pestaña ha escrito pipos4: se vuelve a cargar (puede que ya esté resuelto) y a mirar el espejo.
function recargarEnRescate() {
  cargar();
  avisar('externo');
  avisarGuardado({ tipo: 'externo', apartado: false, perdido: false });
  revisarEspejo().then(r => { if (r) avisar('rescate'); }, () => {});
}

// Si otra pestaña guardó una revisión más nueva, la carga en memoria (y avisa con el motivo 'externo').
export function comprobarOtraPestaña() {
  if (rescate) {
    if (!discoCambió()) return false;
    recargarEnRescate();
    return true;
  }
  if (leerRev() <= rev) return false;
  return recargarDeDisco();
}

// Escribe ya (aunque no haya cambios). Nunca pisa una revisión más nueva de otra pestaña: la carga en su lugar.
export function guardarYa() {
  clearTimeout(temporizadorGuardar);
  if (rescate) return false; // en rescate no se escribe nada hasta que la persona decida
  const enDisco = leerRev();
  if (discoCambió()) {
    if (recargarDeDisco()) return false;
    // Lo que hay en el disco no se puede leer: se aparta intacto y se escribe lo de aquí.
    const crudo = leerCrudo(); if (crudo) apartarRoto(crudo);
  }
  return escribir(enDisco);
}
// Escribe solo si hay cambios pendientes (al salir o pasar a segundo plano).
export function guardarPendiente() { return sucio ? guardarYa() : false; }
function guardar() {
  clearTimeout(temporizadorGuardar);
  temporizadorGuardar = setTimeout(guardarYa, 250);
}
// Guardar al salir o pasar a segundo plano (solo si hay navegador; en node no existen).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', guardarPendiente);
  // Otra pestaña (o la app instalada) guardó: si su revisión es más nueva, se carga aquí.
  window.addEventListener('storage', e => { if (e.key === CLAVE_REV || e.key === CLAVE) comprobarOtraPestaña(); });
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) guardarPendiente(); });

export function cambiar(fn, motivo = '') {
  if (probando) { fn(S); return; } // durante la prueba de pintado de una copia no se guarda ni se avisa
  fn(S);
  sucio = true;
  guardar();
  avisar(motivo);
}
export function escuchar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

// ── Rescate ──
// Recupera el estado del espejo de IndexedDB (solo si se ofreció en el rescate).
export function recuperarDelEspejo() {
  if (!regEspejo) throw new Error('No hay copia interna que recuperar');
  return importar(regEspejo.txt, { interno: true, otraPersona: true });
}
// «Empezar de cero» (datos ilegibles o vacíos) o «Seguir con lo guardado» (espejo más nuevo): sale del rescate
// y escribe ya, con una revisión por encima de la del espejo para que no se vuelva a ofrecer.
// Lo ilegible sigue apartado en pipos4-roto-<fecha>.
// Si mientras tanto otra pestaña guardó algo, no se escribe: se carga lo suyo. Devuelve si se descartó.
export function descartarRescate() {
  if (!rescate) return false;
  if (discoCambió()) { recargarEnRescate(); return false; }
  if (rescate.motivo === 'roto') S = nuevoConViejo();
  rescate = null; regEspejo = null;
  escribir(Math.max(leerRev(), revEspejo));
  avisar('rescate');
  return true;
}
// El texto ilegible (para descargarlo desde el rescate): la copia apartada o, si no se pudo apartar, pipos4 tal cual.
export function textoRoto() {
  if (!rescate || rescate.motivo !== 'roto') return null;
  try { return (rescate.copia && almacen().getItem(rescate.copia)) || leerCrudo(); } catch { return null; }
}

// ── Copia de seguridad ──
// exportar(): el estado sin el código de acceso (ni lo de la app anterior). Lleva datos de salud: la
// interfaz lo avisa.
export function exportar() {
  const x = JSON.parse(JSON.stringify(S));
  x.ajustes = { ...x.ajustes, codigo: '' };
  delete x.ajustes.apiUrl; delete x.viejo;
  if (esObjeto(x.migracion)) delete x.migracion.porDueño; // lo retirado de la otra persona no sale del móvil
  return JSON.stringify(x, null, 1);
}

// importar(txt, { otraPersona, interno }): sustituye los datos por los de una copia.
// - Copia de esta app (versión 4): se reconstruye entera con el normalizador (js/nucleo/normalizar.js).
// - Copia de la app anterior (v3, la que exportaba main, o el propio elplan2): se migra lo de la persona
//   dueña de este móvil sobre los datos actuales, como al elegir dueño (js/nucleo/migracion.js).
// - Nunca se trae el código de acceso: se queda el de este móvil (salvo `interno`, la copia interna del espejo).
// - Si la copia es de la otra persona, lanza ErrorCopia con código 'otra-persona' salvo con `otraPersona: true`
//   (la interfaz pide confirmación explícita y vuelve a llamar).
// - Antes de guardar: se prueba a pintar todas las pantallas con los datos nuevos (si alguna falla, no se
//   carga nada) y se guarda lo actual en `pipos4-antes-de-importar` (deshacerImportar() lo recupera; caduca
//   a los 7 días o se descarta a mano). En el rescate, lo que se guarda ahí es la copia interna del espejo
//   (lo único que quedaba) y, si había pipos4 legible, este se aparta además como conflicto.
// - Si localStorage no acepta los datos nuevos, se deshace todo y se avisa (no se finge que se cargó).
// Errores: ErrorCopia con un mensaje en español para la persona. Devuelve { tipo, avisos, sesiones? }.
const CLAVE_ANTES = CLAVE + '-antes-de-importar';
const TAMAÑO_MAX_COPIA = 10 * 1024 * 1024;
const DIAS_ANTES = 7;
let pruebaDePintado = null;
let probando = false;
// La interfaz registra aquí cómo pintar todas las pantallas (router.probarPantallas) para probar una copia.
export function usarPruebaDePintado(fn) { pruebaDePintado = typeof fn === 'function' ? fn : null; }

function leerCopia(txt) {
  if (typeof txt !== 'string' || !txt.trim()) throw new ErrorCopia('El archivo está vacío: no es una copia de Pipos Fitness.');
  if (txt.length > TAMAÑO_MAX_COPIA) throw new ErrorCopia('El archivo pesa más de 10 MB: es demasiado grande para ser una copia de Pipos Fitness (las copias suelen ocupar menos de 1 MB).', 'grande');
  try { return JSON.parse(txt); } catch { throw new ErrorCopia('No es una copia de Pipos Fitness: el archivo no se puede leer (está dañado o es de otra cosa).'); }
}
const nombre = d => (PERSONAS[d] ? PERSONAS[d].nombre : 'otra persona');

// Prueba a pintar las pantallas con el estado candidato puesto (sin guardar ni avisar). Lanza si alguna falla.
function probarPintado(candidato) {
  if (!pruebaDePintado) return;
  const antes = S;
  S = candidato; probando = true;
  try { pruebaDePintado(); } catch (e) {
    console.error('La copia no se puede pintar', e);
    throw new ErrorCopia('No he cargado la copia: con sus datos alguna pantalla de la app falla. Tus datos siguen como estaban.', 'pintado');
  } finally { S = antes; probando = false; }
}

export function importar(txt, { otraPersona = false, interno = false, deshacer = false } = {}) {
  const x = leerCopia(txt);
  let candidato, avisos, info = { tipo: 'copia' };
  if (esViejo(x)) {
    if (!S.dueño) throw new ErrorCopia('Es una copia de la app anterior. Elige primero de quién es este móvil y cárgala después desde Perfil → Ajustes.', 'vieja-sin-dueño');
    if (migracionDeOtro()) throw new ErrorCopia(`Lo traído de la app anterior a este móvil es de ${nombre(S.migracion.dueño)}. Resuélvelo primero en Perfil («Traer lo de ${nombre(S.dueño)}») y vuelve a cargar la copia.`, 'migracion-de-otro');
    const base = JSON.parse(JSON.stringify(S));
    const r = migrar(base, x, S.dueño);
    candidato = normalizarEstado(base).estado;
    if (esObjeto(base.migracion) && esObjeto(base.migracion.porDueño)) candidato.migracion.porDueño = base.migracion.porDueño; // propio del móvil
    candidato.ajustes.codigo = S.ajustes.codigo || '';
    info = { tipo: 'anterior', sesiones: r.sesiones, lesiones: r.lesiones, medidas: r.medidas, dolor: r.dolor };
    avisos = r.descartadas.map(t => 'No se ha traído ' + t);
  } else {
    const n = normalizarEstado(x);
    candidato = n.estado; avisos = n.avisos;
    if (S.dueño && candidato.dueño !== S.dueño && !otraPersona) {
      throw new ErrorCopia(`Esta copia es de ${nombre(candidato.dueño)} y este móvil es de ${nombre(S.dueño)}. Si la cargas, el móvil pasará a ser de ${nombre(candidato.dueño)} y se sustituirán todos los datos.`,
        'otra-persona', { dueño: candidato.dueño, actual: S.dueño });
    }
    candidato.ajustes.codigo = interno ? texto(esObjeto(x.ajustes) ? x.ajustes.codigo : '', 200) : (S.ajustes && S.ajustes.codigo) || '';
    // D8: lo apartado de la otra persona en la migración es propio del móvil (no viaja en las copias): se queda,
    // como en el camino de la app anterior.
    if (esObjeto(S.migracion) && esObjeto(S.migracion.porDueño) && esObjeto(candidato.migracion)) candidato.migracion.porDueño = JSON.parse(JSON.stringify(S.migracion.porDueño));
  }
  clearTimeout(temporizadorGuardar);
  // Si otra pestaña acaba de guardar, se carga lo suyo y no se pisa: que la persona lo vuelva a intentar.
  if (discoCambió()) {
    const AVISO = 'Otra ventana acaba de guardar cambios y se han cargado. Si aún quieres esta copia, vuelve a cargarla.';
    if (rescate) { recargarEnRescate(); throw new ErrorCopia(AVISO, 'otra-ventana'); }
    if (recargarDeDisco()) throw new ErrorCopia(AVISO, 'otra-ventana');
    const crudo = leerCrudo(); if (crudo) apartarRoto(crudo);
  }
  probarPintado(candidato);
  // Lo de ahora, aparte, por si la copia no era la buena. En el rescate, lo de ahora es la copia interna del
  // espejo (que se va a sobrescribir); sin rescate, el estado si ya tiene dueño.
  let deAntes = null;
  if (rescate && regEspejo) { try { deAntes = JSON.parse(regEspejo.txt); } catch { deAntes = null; } }
  if (!deAntes && S.dueño) deAntes = S;
  const antesGuardado = (() => { try { return almacen().getItem(CLAVE_ANTES); } catch { return null; } })();
  // D2: si ya hay «datos de antes» (de una copia cargada hace menos de 7 días), no se pisan: siguen siendo lo
  // que había antes de empezar a cargar copias. Lo de ahora va entonces a lo apartado (Perfil › Ajustes).
  // Al deshacer sí se cambian (lo de ahora pasa a ser «los de antes»).
  const conservarAntes = !deshacer && !!infoAntesDeImportar();
  let alApartado = false;
  if (deAntes && conservarAntes) {
    alApartado = apartarYa(JSON.stringify(deAntes));
  } else if (deAntes) {
    try { almacen().setItem(CLAVE_ANTES, JSON.stringify({ fecha: new Date().toISOString(), estado: deAntes })); } catch (e) {
      console.error('No se pudo apartar el estado actual antes de importar', e);
      throw new ErrorCopia('No queda espacio en el móvil para apartar antes tus datos actuales, así que no he cargado la copia. Guarda una copia de lo actual y libera espacio.', 'sin-espacio');
    }
  }
  // Rescate porque el espejo era más nuevo que pipos4: pipos4 (legible) también se aparta, como conflicto.
  if (rescate && rescate.motivo === 'espejo' && regEspejo && S.dueño) apartarConflicto(JSON.stringify(S));
  const previo = { S, rescate, regEspejo, dueñoSoltado };
  S = ponerViejo(candidato);
  rescate = null; regEspejo = null; dueñoSoltado = false;
  // La copia interna (rescate o deshacer) entra aunque localStorage esté lleno: el espejo la guarda y se avisa.
  if (!escribir(Math.max(leerRev(), revEspejo), { estricto: !interno })) {
    if (interno) { avisar('importar'); return { ...info, avisos, apartado: alApartado }; }
    ({ S, rescate, regEspejo, dueñoSoltado } = previo);
    try { if (antesGuardado == null) almacen().removeItem(CLAVE_ANTES); else almacen().setItem(CLAVE_ANTES, antesGuardado); } catch { /* nada */ }
    throw new ErrorCopia('No he cargado la copia: no cabe en el almacenamiento del móvil. Tus datos siguen como estaban. Libera espacio (o descarta los datos de antes de la última copia) y vuelve a intentarlo.', 'sin-espacio');
  }
  avisar('importar');
  return { ...info, avisos, apartado: alApartado };
}

// Lo que había antes de la última copia cargada: { fecha, dueño } o null. Pasados 7 días se borra sola.
export function infoAntesDeImportar(ahora = Date.now()) {
  let c;
  try { c = JSON.parse(almacen().getItem(CLAVE_ANTES) || 'null'); } catch { c = null; }
  if (!c || typeof c.fecha !== 'string' || !esObjeto(c.estado)) return null;
  const t = Date.parse(c.fecha);
  if (Number.isNaN(t) || ahora - t > DIAS_ANTES * 864e5) { descartarAntesDeImportar(); return null; }
  return { fecha: c.fecha, dueño: c.estado.dueño || null };
}
// «Descartar»: libera el espacio de lo que había antes de la última copia.
export function descartarAntesDeImportar() { try { almacen().removeItem(CLAVE_ANTES); } catch { /* nada */ } }
// Vuelve a lo que había antes de la última copia cargada (pasa por importar: validado y reversible).
export function deshacerImportar() {
  let c;
  try { c = JSON.parse(almacen().getItem(CLAVE_ANTES) || 'null'); } catch { c = null; }
  if (!c || !esObjeto(c.estado)) throw new ErrorCopia('No hay datos de antes de cargar una copia.');
  return importar(JSON.stringify(c.estado), { otraPersona: true, interno: true, deshacer: true });
}

// Fecha de la última copia exportada (en una clave aparte) y recordatorio cada 10 sesiones terminadas.
export const SESIONES_RECORDATORIO = 10;
export function marcarCopiaExportada(cuando = new Date()) {
  try { almacen().setItem(CLAVE_COPIA, JSON.stringify({ fecha: cuando.toISOString() })); } catch (e) { console.warn('No se pudo apuntar la fecha de la copia', e); }
}
export function infoCopia() {
  let fecha = null;
  try { const c = JSON.parse(almacen().getItem(CLAVE_COPIA) || 'null'); fecha = c && typeof c.fecha === 'string' ? c.fecha : null; } catch { fecha = null; }
  const desde = hechas(S).filter(s => !fecha || String(s.terminada || s.fecha || '') > fecha).length;
  return { fecha, sesionesDesde: desde, toca: desde >= SESIONES_RECORDATORIO };
}
// Lo que ocupan todas las claves pipos4* (caracteres de clave y valor ≈ bytes), lo de pipos4 solo,
// y el porcentaje aproximado de unos 5 MB.
export function usoAlmacen() {
  let n = 0;
  for (const k of claves()) {
    if (!k || !k.startsWith(CLAVE)) continue;
    try { n += k.length + (almacen().getItem(k) || '').length; } catch { /* nada */ }
  }
  const principal = (leerCrudo() || '').length;
  return { bytes: n, principal, porcentaje: n / CAPACIDAD_APROX * 100 };
}

// ── Migración desde la app anterior (clave 'elplan2', con las dos personas juntas) ──
// La lógica está en js/nucleo/migracion.js. Aquí solo se conecta con el estado vivo.
let ultimaMigracion = null;
let dueñoSoltado = false;
// Trae lo de `dueño` que aún no esté (sesiones, lesiones, medidas, dolor y datos del perfil). Si lo traído antes
// era de la otra persona, lo retira primero. Cambia S directamente (llámala dentro de cambiar). Devuelve las
// sesiones nuevas; el detalle, en resultadoMigracion().
export function migrarDeViejo(dueño) {
  ultimaMigracion = migrar(S, S.viejo || null, dueño);
  dueñoSoltado = false;
  return ultimaMigracion.sesiones;
}
export const resultadoMigracion = () => ultimaMigracion;
// ¿Lo traído de la app anterior es de otra persona que el dueño? (p. ej. tras cambiar de dueño con la versión anterior)
export const migracionDeOtro = () => !!(S && S.dueño && S.migracion && S.migracion.dueño && S.migracion.dueño !== S.dueño);
// Al arrancar: corrección única de los datos migrados con la versión con fallos y lo nuevo de elplan2
// (p. ej. sesiones hechas tras una marcha atrás a la app anterior). Nunca retira nada sin preguntar.
export function ponerAlDiaMigracion() {
  if (rescate || !S || !S.dueño || !esObjeto(S.migracion)) return null;
  if (S.migracion.version < VERSION_MIGRACION) {
    const prueba = JSON.parse(JSON.stringify(S));
    if (corregirAntigua(prueba, S.viejo || null)) cambiar(X => { corregirAntigua(X, X.viejo || null); }, 'migracion');
  }
  if (migracionDeOtro()) return null; // lo traído es de la otra persona: se pregunta en Perfil
  const base = JSON.parse(JSON.stringify(S));
  const r = migrar(base, S.viejo || null, S.dueño);
  if (!r.cambió) return r;
  ultimaMigracion = r;
  cambiar(X => { migrar(X, X.viejo || null, X.dueño); }, 'migracion');
  return r;
}
// «Cambiar de quién es este móvil» (Perfil, ya confirmado): vuelve a la bienvenida sin preguntar otra vez.
export function soltarDueño() { dueñoSoltado = true; cambiar(X => { X.dueño = null; }, 'dueño'); }
export const dueñoSoltadoConConfirmacion = () => dueñoSoltado;
// Respuesta a «¿Es correcto tu sexo?» (corrección única de la migración con fallos).
export function confirmarSexo(sexo) {
  cambiar(X => { if (['h', 'm'].includes(sexo)) X.perfil.datos.sexo = sexo; X.migracion.sexoRevisar = false; }, 'perfil');
}
