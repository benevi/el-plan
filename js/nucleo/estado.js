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

import * as espejoIDB from './espejo.js';

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
    lesiones: [],             // { id, zona, dolor 0-10, desde 'YYYY-MM-DD', nota, activa }
    disponibilidad: { dias: 3, minutos: 60, diasSemana: [] }, // diasSemana 1=lunes…7; cambia cada semana
    lugares: ['gym', 'piscina'],
    materialCasa: [],
    gustos: {},               // { idEjercicio: 'rechazo' | 'nogusta' | 'gusta' }
    datos: { sexo: '', altura: null, nacimiento: '' },
    notas: '',                // lo que quiera contarle al entrenador
  };
}

export function nuevo() {
  return {
    version: VERSION,
    dueño: null,              // 'victor' | 'virginia'
    perfil: perfilVacio(),
    plan: null,               // plan semanal (ver areas/entrenador)
    sesiones: {},             // { id: sesión } (ver areas/sesion/modelo.js)
    medidas: [],              // { fecha, peso, cintura, cadera, cuello, pecho, brazo, muslo, grasa }
    dolor: [],                // { fecha, zona, dolor, momento: 'antes'|'despues'|'dia', sesion }
    ajustes: { codigo: '', vibrar: true, sonido: true, apiUrl: '' },
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
//   y `pipos4-copia` (fecha de la última copia exportada).
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
let revEspejo = 0;         // revisión del espejo leída al arrancar
const oyentesGuardado = new Set();

const esObjeto = x => !!x && typeof x === 'object' && !Array.isArray(x);
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

function nuevoConViejo() {
  const x = nuevo();
  try { const viejo = JSON.parse(almacen().getItem(CLAVE_VIEJA) || 'null'); if (viejo) x.viejo = viejo; } catch { /* nada */ }
  return x;
}
function preparar(x) {
  const r = rellenar(nuevo(), x);
  delete r.nutricion; // la nutrición irá en otra app
  return r;
}

export function cargar() {
  clearTimeout(temporizadorGuardar); // un guardado pendiente del estado anterior no debe escribir sobre el nuevo
  sucio = false; rescate = null; regEspejo = null; revEspejo = 0; cargadoVacio = false;
  let crudo;
  try { crudo = almacen().getItem(CLAVE); } catch { crudo = null; }
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
  return S;
}

// Mira el espejo de IndexedDB (al arrancar, antes de pintar). Si pipos4 está roto o vacío, o si el espejo
// tiene una revisión más nueva que pipos4 (porque localStorage falló al escribir), deja la app en rescate
// ofreciendo el espejo. Devuelve el rescate (o null).
export async function revisarEspejo({ max = 1500 } = {}) {
  let reg, t = null;
  try {
    reg = await Promise.race([
      Promise.resolve().then(() => espejo.leer()),
      new Promise(r => { t = setTimeout(() => r(null), max); }),
    ]);
  } catch { reg = null; }
  clearTimeout(t);
  let x;
  try { x = reg && typeof reg.txt === 'string' ? JSON.parse(reg.txt) : null; } catch { x = null; }
  if (!esObjeto(x) || x.version !== VERSION || !esObjeto(x.perfil) || !x.dueño) return rescate;
  revEspejo = +reg.rev || 0;
  const info = { fecha: reg.fecha || null, dueño: x.dueño, sesiones: hechas(x).length, rev: revEspejo };
  if (rescate) { rescate.espejo = info; regEspejo = reg; }
  else if (!sucio && (cargadoVacio || revEspejo > rev)) {
    rescate = { motivo: cargadoVacio ? 'vacio' : 'espejo', copia: null, espejo: info };
    regEspejo = reg;
  }
  return rescate;
}

export const estado = () => S;
// Cómo va el guardado: { sucio, rev, error, rescate }.
export const estadoGuardado = () => ({ sucio, rev, error: errorGuardar, rescate });
// fn({ tipo: 'error', error }) si falla escribir; fn({ tipo: 'ok' }) al volver a guardar bien tras un fallo;
// fn({ tipo: 'externo', apartado }) si se cargó lo que guardó otra pestaña.
export function escucharGuardado(fn) { oyentesGuardado.add(fn); return () => oyentesGuardado.delete(fn); }

// Escribe S con una revisión mayor que `revMin` y que la propia. Devuelve true si localStorage lo aceptó.
function escribir(revMin = rev) {
  clearTimeout(temporizadorGuardar);
  const nueva = Math.max(rev, revMin) + 1;
  const txt = JSON.stringify(S);
  const reg = { txt, rev: nueva, fecha: new Date().toISOString() };
  const alEspejo = () => { try { Promise.resolve(espejo.escribir(reg)).catch(() => {}); } catch { /* nada */ } };
  try {
    almacen().setItem(CLAVE, txt);
  } catch (e) {
    console.error('No se pudo guardar', e);
    sucio = true; errorGuardar = e;
    alEspejo(); // el espejo sigue guardando aunque localStorage falle
    avisarGuardado({ tipo: 'error', error: e });
    return false;
  }
  rev = nueva;
  try { almacen().setItem(CLAVE_REV, String(rev)); } catch (e) { console.warn('No se pudo guardar la revisión', e); }
  sucio = false;
  alEspejo();
  if (errorGuardar) { errorGuardar = null; avisarGuardado({ tipo: 'ok' }); }
  return true;
}

// Carga lo que otra pestaña guardó en pipos4. Si aquí había cambios sin guardar, se apartan en pipos4-conflicto.
function recargarDeDisco() {
  let x;
  try { x = JSON.parse(almacen().getItem(CLAVE)); } catch { x = null; }
  if (!esObjeto(x)) return false;
  let apartado = false;
  if (sucio) {
    try { almacen().setItem(CLAVE_CONFLICTO, JSON.stringify(S)); apartado = true; } catch (e) { console.error('No se pudieron apartar los cambios de esta pestaña', e); }
  }
  clearTimeout(temporizadorGuardar);
  S = preparar(x); rev = leerRev(); sucio = false;
  avisar('externo');
  avisarGuardado({ tipo: 'externo', apartado });
  return true;
}

// Si otra pestaña guardó una revisión más nueva, la carga en memoria (y avisa con el motivo 'externo').
export function comprobarOtraPestaña() {
  if (rescate) return false;
  if (leerRev() <= rev) return false;
  return recargarDeDisco();
}

// Escribe ya (aunque no haya cambios). Nunca pisa una revisión más nueva de otra pestaña: la carga en su lugar.
export function guardarYa() {
  clearTimeout(temporizadorGuardar);
  if (rescate) return false; // en rescate no se escribe nada hasta que la persona decida
  const enDisco = leerRev();
  if (enDisco > rev) {
    if (recargarDeDisco()) return false;
    // Lo más nuevo del disco no se puede leer: se aparta intacto y se escribe lo de aquí.
    try { const crudo = almacen().getItem(CLAVE); if (crudo) apartarRoto(crudo); } catch { /* nada */ }
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
  importar(regEspejo.txt);
}
// «Empezar de cero» (datos ilegibles o vacíos) o «Seguir con lo guardado» (espejo más nuevo): sale del rescate
// y escribe ya, con una revisión por encima de la del espejo para que no se vuelva a ofrecer.
// Lo ilegible sigue apartado en pipos4-roto-<fecha>.
export function descartarRescate() {
  if (!rescate) return;
  if (rescate.motivo === 'roto') S = nuevoConViejo();
  rescate = null; regEspejo = null;
  escribir(Math.max(leerRev(), revEspejo));
  avisar('rescate');
}

// ── Copia de seguridad ──
export function exportar() { return JSON.stringify(S, null, 1); }
export function importar(txt) {
  const x = JSON.parse(txt);
  if (!x || x.version !== VERSION || !x.perfil) throw new Error('No es una copia de Pipos Fitness');
  clearTimeout(temporizadorGuardar);
  S = rellenar(nuevo(), x);
  rescate = null; regEspejo = null;
  escribir(Math.max(leerRev(), revEspejo));
  avisar('importar');
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
// Lo que ocupa pipos4 (caracteres ≈ bytes) y el porcentaje aproximado de unos 5 MB.
export function usoAlmacen() {
  let n;
  try { n = (almacen().getItem(CLAVE) || '').length; } catch { n = 0; }
  return { bytes: n, porcentaje: n / CAPACIDAD_APROX * 100 };
}

// ── Migración desde la app anterior (clave 'elplan2', con las dos personas juntas) ──
// Se usa una vez, al elegir dueño: trae su historial de sesiones, lesiones y medidas.
export function migrarDeViejo(dueño) {
  const v = S.viejo; if (!v) return 0;
  const u = dueño === 'victor' ? 'him' : 'her';
  let n = 0;
  Object.values(v.workouts || {}).filter(w => w.user === u && w.completed).forEach(w => {
    const id = 'v-' + (w.id || uid());
    if (S.sesiones[id]) return;
    S.sesiones[id] = {
      id, fecha: String(w.completedAt || w.date).slice(0, 10), creada: w.date, fuente: 'anterior',
      nombre: w.nombre || w.day || 'Sesión', foco: '', lugar: (w.lugar || 'gym').toLowerCase() === 'piscina' ? 'piscina' : (w.lugar || 'gym').toLowerCase(),
      explicacion: [], calentamiento: [], vuelta: [],
      ejercicios: (w.exercises || []).map(x => ({
        id: x.exId || null, nombre: x.name, rol: 'principal', series: (x.sets || []).length, reps: '', descanso: 60, kg: null, nota: '',
        sets: (x.sets || []).map(s => ({ kg: +s.weight > 0 ? +s.weight : null, valor: String(s.reps || ''), hecha: s.done !== false })),
      })),
      estado: 'hecha', empezada: w.date, terminada: w.completedAt || w.date,
      checkin: w.checkin ? { energia: +w.checkin.energia || null, dolor: w.checkin.dolor || {} } : null,
      cierre: w.feedback ? { esfuerzo: +w.feedback.esfuerzo || null, comentario: w.feedback.nota || '' } : null,
    };
    n++;
  });
  (v.injuries && v.injuries[u] || []).forEach(i => {
    S.perfil.lesiones.push({ id: uid(), zona: i.zoneKey, dolor: Math.min(10, (+i.severity || 1) * 3), desde: String(i.since || '').slice(0, 10), nota: i.note || '', activa: !!i.active });
  });
  (v.bodyLog && v.bodyLog[u] || []).forEach(b => {
    S.medidas.push({ fecha: String(b.date).slice(0, 10), peso: b.weight || null, cintura: b.waist || null, cadera: b.hip || null, cuello: b.neck || null, pecho: b.chest || null, brazo: b.arm || null, muslo: b.thigh || null, grasa: b.bodyFat || null });
  });
  const p = v.bodyProfile && v.bodyProfile[u];
  if (p) { S.perfil.datos.sexo = p.sex || ''; S.perfil.datos.altura = p.height || null; }
  delete S.viejo;
  return n;
}
