// Copias automáticas en la nube (PR 4b, D14 y D15): cifradas en este móvil antes de salir.
//
// Formato del archivo (versión 1), todo en bytes:
//   0  'PIPC'                     4 B  marca
//   4  versión = 1                1 B
//   5  kdf = 1 (PBKDF2-SHA-256)   1 B
//   6  iteraciones                4 B  (entero sin signo, big-endian; ≥ 600 000)
//   10 largo de la sal = 16       1 B
//   11 sal                        16 B (aleatoria, una por persona y frase)
//   27 largo del IV = 12          1 B
//   28 IV                         12 B (aleatorio en cada copia)
//   40 AES-GCM-256(gzip(exportar()))  con etiqueta de 16 B al final; los 40 B de la cabecera van como AAD,
//      así que tocar cualquier byte de la cabecera o del cuerpo hace fallar el descifrado.
// Lo que se cifra es exportar() (ya sin el código de acceso).
//
// La clave: PBKDF2-SHA-256(frase, sal, 600 000) → AES-GCM de 256 bits, NO exportable. La frase no se guarda
// nunca; la clave (CryptoKey) y su sal se guardan en IndexedDB ('pipos-copia'), no en localStorage, para poder
// copiar sin preguntar. Cada copia lleva su sal e iteraciones en la cabecera: con la frase basta para abrirla
// desde un móvil nuevo. Cambiar la frase crea sal y clave nuevas; las copias anteriores siguen con la anterior.
//
// Cuándo se copia (sin hacer nada): al terminar una sesión; tras cambios de perfil, lesiones o medidas
// (1 minuto sin más cambios); al abrir la app si la última copia tiene más de 24 h. Solo con red (si no, se
// reintenta al volver la conexión), nunca dos subidas a la vez (tampoco entre pestañas, con Web Locks si hay)
// y nunca durante el rescate.

import { estado, exportar, escuchar, estadoGuardado } from './estado.js';

export const MAGIA = [0x50, 0x49, 0x50, 0x43]; // 'PIPC'
export const VERSION_FORMATO = 1;
export const KDF_PBKDF2_SHA256 = 1;
export const ITERACIONES = 600000;
const MAX_ITERACIONES = 5000000; // por si alguien manipula la cabecera: no colgar el móvil
const LARGO_SAL = 16, LARGO_IV = 12, CABECERA = 40;
const MAX_TEXTO = 12 * 1024 * 1024; // tras descomprimir (importar() ya rechaza más de 10 MB)
export const LIMITE_SUBIDA = 4 * 1024 * 1024; // el mismo que api/copia.js
export const FRASE_MIN = 12;
export const DIA = 864e5;
export const ESPERA_CAMBIOS = 60e3;
export const AVISO_DIAS = 3;

export class ErrorNube extends Error {
  constructor(msg, codigo = '', extra = {}) { super(msg); this.name = 'ErrorNube'; this.codigo = codigo; Object.assign(this, extra); }
}
const MAL_FRASE = 'No he podido abrir la copia: la frase no es la correcta (o la copia está dañada). Tus datos siguen como estaban.';
const DAÑADA = 'Esta copia de la nube está dañada o no es de Pipos Fitness. Tus datos siguen como estaban.';

const sutil = () => {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new ErrorNube('Este navegador no puede cifrar (hace falta HTTPS).', 'sin-cifrado');
  return c.subtle;
};
const aleatorio = n => globalThis.crypto.getRandomValues(new Uint8Array(n));
const utf8 = new TextEncoder();

// ── Compresión ──
async function porFlujo(bytes, transformacion, max = Infinity) {
  const flujo = new Blob([bytes]).stream().pipeThrough(transformacion);
  const lector = flujo.getReader(); const trozos = []; let n = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    n += value.length;
    if (n > max) { try { await lector.cancel(); } catch { /* nada */ } throw new ErrorNube(DAÑADA, 'grande'); }
    trozos.push(value);
  }
  const out = new Uint8Array(n); let o = 0;
  for (const t of trozos) { out.set(t, o); o += t.length; }
  return out;
}
const comprimir = b => porFlujo(b, new CompressionStream('gzip'));
const descomprimir = b => porFlujo(b, new DecompressionStream('gzip'), MAX_TEXTO);

// ── Clave ──
export async function derivarClave(frase, sal, iteraciones = ITERACIONES) {
  if (typeof frase !== 'string' || !frase) throw new ErrorNube('Falta la frase.', 'frase');
  const base = await sutil().importKey('raw', utf8.encode(frase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return sutil().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const nuevaSal = () => aleatorio(LARGO_SAL);

// ── Formato ──
function cabecera(sal, iteraciones, iv) {
  const c = new Uint8Array(CABECERA);
  c.set(MAGIA, 0); c[4] = VERSION_FORMATO; c[5] = KDF_PBKDF2_SHA256;
  new DataView(c.buffer).setUint32(6, iteraciones, false);
  c[10] = LARGO_SAL; c.set(sal, 11); c[27] = LARGO_IV; c.set(iv, 28);
  return c;
}
// Lee y valida la cabecera. Lanza ErrorNube('dañada') si no es un archivo de copia válido.
export function leerCabecera(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  if (b.length < CABECERA + 16 + 1) throw new ErrorNube(DAÑADA, 'dañada');
  if (MAGIA.some((x, i) => b[i] !== x)) throw new ErrorNube(DAÑADA, 'dañada');
  if (b[4] !== VERSION_FORMATO) throw new ErrorNube('Esta copia es de una versión más nueva de la app: actualízala y vuelve a probar.', 'version');
  if (b[5] !== KDF_PBKDF2_SHA256 || b[10] !== LARGO_SAL || b[27] !== LARGO_IV) throw new ErrorNube(DAÑADA, 'dañada');
  const iteraciones = new DataView(b.buffer, b.byteOffset, b.length).getUint32(6, false);
  if (iteraciones < ITERACIONES || iteraciones > MAX_ITERACIONES) throw new ErrorNube(DAÑADA, 'dañada');
  return { version: b[4], iteraciones, sal: b.slice(11, 27), iv: b.slice(28, 40), aad: b.slice(0, CABECERA), cuerpo: b.slice(CABECERA) };
}
// Cifra el texto con la clave (y la sal/iteraciones con que se derivó, que van en la cabecera).
export async function cifrar(texto, { clave, sal, iteraciones = ITERACIONES }) {
  const iv = aleatorio(LARGO_IV);
  const c = cabecera(sal, iteraciones, iv);
  const datos = await comprimir(utf8.encode(texto));
  const cifrado = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: c, tagLength: 128 }, clave, datos));
  const out = new Uint8Array(CABECERA + cifrado.length);
  out.set(c, 0); out.set(cifrado, CABECERA);
  return out;
}
// Descifra. `clave` es una CryptoKey o una función (sal, iteraciones) => CryptoKey (p. ej. derivar de la frase).
// Lanza ErrorNube: 'dañada' (cortada, alterada o no es una copia), 'frase' (no abre con esta clave/frase).
export async function descifrar(bytes, clave) {
  const c = leerCabecera(bytes);
  const k = typeof clave === 'function' ? await clave(c.sal, c.iteraciones) : clave;
  let datos;
  try { datos = new Uint8Array(await sutil().decrypt({ name: 'AES-GCM', iv: c.iv, additionalData: c.aad, tagLength: 128 }, k, c.cuerpo)); } catch {
    // AES-GCM no distingue «otra frase» de «bytes tocados»: se dice lo más probable.
    throw new ErrorNube(MAL_FRASE, 'frase');
  }
  let txt;
  try { txt = new TextDecoder('utf-8', { fatal: true }).decode(await descomprimir(datos)); } catch (e) {
    if (e instanceof ErrorNube) throw e;
    throw new ErrorNube(DAÑADA, 'dañada');
  }
  return txt;
}
const mismaSal = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

// ── Dónde se guarda la clave: IndexedDB 'pipos-copia', almacén 'clave', un registro por persona ──
// { persona, sal: Uint8Array, iteraciones, clave: CryptoKey no exportable, creada: ISO }
// Las pruebas pueden inyectar otro almacén con { leer(persona), escribir(reg), borrar(persona) }.
const BD = 'pipos-copia', TABLA = 'clave';
let bd = null;
function abrirBD() {
  if (bd) return bd;
  bd = new Promise(res => {
    let idb; try { idb = globalThis.indexedDB || null; } catch { idb = null; }
    if (!idb) { res(null); return; }
    let r; try { r = idb.open(BD, 1); } catch { res(null); return; }
    r.onupgradeneeded = () => { try { r.result.createObjectStore(TABLA); } catch { /* ya existe */ } };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); bd = null; }; db.onclose = () => { bd = null; }; res(db); };
    r.onerror = r.onblocked = () => { bd = null; res(null); };
  });
  return bd;
}
function operar(modo, fn) {
  return abrirBD().then(db => new Promise(res => {
    if (!db) { res(modo === 'readonly' ? null : false); return; }
    try {
      const t = db.transaction(TABLA, modo); const q = fn(t.objectStore(TABLA));
      t.oncomplete = () => res(modo === 'readonly' ? (q && q.result) || null : true);
      t.onerror = t.onabort = () => res(modo === 'readonly' ? null : false);
    } catch { bd = null; res(modo === 'readonly' ? null : false); }
  }));
}
const almacenIDB = {
  leer: persona => operar('readonly', t => t.get(persona)),
  escribir: reg => operar('readwrite', t => t.put(reg, reg.persona)),
  borrar: persona => operar('readwrite', t => t.delete(persona)),
};
let almacenClave = almacenIDB;

// ── Estado de la nube en este móvil (localStorage 'pipos4-nube'; no es parte de pipos4) ──
// { ultima: ISO de la última copia subida, error: texto|null, inactiva: bool (el servidor dijo 503) }
const CLAVE_NUBE = 'pipos4-nube';
function leerNube() {
  try { const x = JSON.parse(globalThis.localStorage.getItem(CLAVE_NUBE) || 'null'); return x && typeof x === 'object' ? x : {}; } catch { return {}; }
}
let memoria = null;
const nube = () => ({ ...(memoria || {}), ...leerNube() });
function ponerNube(cambios) {
  const x = { ...nube(), ...cambios };
  try { globalThis.localStorage.setItem(CLAVE_NUBE, JSON.stringify(x)); } catch { /* sin espacio: se queda en memoria */ }
  memoria = x;
  avisarNube();
  return x;
}

// ── Dependencias (las pruebas las sustituyen) ──
let dep = {
  fetch: (...a) => globalThis.fetch(...a),
  enLinea: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  ahora: () => Date.now(),
  setTimeout: (...a) => globalThis.setTimeout(...a),
  clearTimeout: (...a) => globalThis.clearTimeout(...a),
  bloqueo: (nombre, fn) => {
    const l = typeof navigator !== 'undefined' && navigator.locks;
    if (l && typeof l.request === 'function') return l.request(nombre, { ifAvailable: true }, lock => (lock ? fn() : 'ocupado'));
    return fn();
  },
};
export function configurarCopia({ almacen, ...resto } = {}) {
  if (almacen !== undefined) almacenClave = almacen || almacenIDB;
  dep = { ...dep, ...resto };
}

const oyentesNube = new Set();
export function escucharNube(fn) { oyentesNube.add(fn); return () => oyentesNube.delete(fn); }
function avisarNube() { oyentesNube.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

// La clave de la persona dueña de este móvil (se lee de IndexedDB al arrancar y se queda en memoria).
let claveActual = null; // registro o null
let claveCargada = false;
export async function cargarClave(persona = estado() && estado().dueño) {
  claveActual = null;
  if (persona) { try { const r = await almacenClave.leer(persona); claveActual = r && r.clave && r.persona === persona ? r : null; } catch { claveActual = null; } }
  claveCargada = true;
  avisarNube();
  return claveActual;
}

// Para la interfaz: { activada, cargada, ultima, error, inactiva, subiendo, avisar }.
export function estadoNube() {
  const n = nube(), S = estado();
  const activada = !!(claveActual && S && claveActual.persona === S.dueño);
  const vieja = !n.ultima || dep.ahora() - Date.parse(n.ultima) > AVISO_DIAS * DIA;
  return { activada, cargada: claveCargada, ultima: n.ultima || null, error: n.error || null, inactiva: !!n.inactiva,
    subiendo: !!subiendo, avisar: activada && (!!n.inactiva || vieja) };
}

// ── Servidor (api/copia.js) ──
const hechas = S => Object.values((S && S.sesiones) || {}).filter(s => s && s.estado === 'hecha');
function metadatos(S) {
  const h = hechas(S);
  const ultima = h.map(s => String(s.fecha || s.terminada || '').slice(0, 10)).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort().pop() || '';
  return { sesiones: h.length, ultima };
}
async function pedir({ json, binario, cabeceras = {}, codigo }) {
  if (!dep.enLinea()) throw new ErrorNube('Sin conexión.', 'sin-red');
  const S = estado();
  const headers = { 'x-app-code': codigo != null ? codigo : (S && S.ajustes && S.ajustes.codigo) || '', ...cabeceras };
  headers['Content-Type'] = binario ? 'application/octet-stream' : 'application/json';
  let r;
  try { r = await dep.fetch('/api/copia', { method: 'POST', headers, body: binario || JSON.stringify(json), cache: 'no-store' }); } catch {
    throw new ErrorNube('No hay conexión con el servidor.', 'sin-red');
  }
  if (r.ok) return r;
  let datos = null;
  try { datos = await r.json(); } catch { /* vacío */ }
  const msg = (datos && datos.error) || 'error ' + r.status;
  if (r.status === 503) throw new ErrorNube('Las copias en la nube aún no están activadas en el servidor.', 'inactiva', { status: 503 });
  if (r.status === 401) throw new ErrorNube('El código de acceso no es correcto (Perfil → Ajustes).', 'codigo', { status: 401 });
  if (r.status === 500) throw new ErrorNube('El servidor no está configurado.', 'servidor', { status: 500 });
  throw new ErrorNube('La nube no responde: ' + msg + '.', 'servidor', { status: r.status });
}
export async function listar(persona, opciones = {}) {
  const r = await pedir({ json: { accion: 'listar', persona }, ...opciones });
  const d = await r.json();
  return Array.isArray(d && d.copias) ? d.copias : [];
}
export async function bajar(persona, nombre, opciones = {}) {
  const r = await pedir({ json: { accion: 'bajar', persona, nombre }, ...opciones });
  return new Uint8Array(await r.arrayBuffer());
}

// ── Activar, cambiar la frase y restaurar ──
// Activa las copias de `persona` en este móvil con `frase`. Si ya hay copias en la nube y la frase no abre
// la última, lanza ErrorNube('otra-frase') salvo con { aunqueNoCoincida: true }.
export async function activar(persona, frase, { aunqueNoCoincida = false } = {}) {
  if (typeof frase !== 'string' || frase.length < FRASE_MIN) throw new ErrorNube(`La frase tiene que tener al menos ${FRASE_MIN} caracteres.`, 'corta');
  let ultimaNube;
  if (!aunqueNoCoincida) {
    try { const l = await listar(persona); ultimaNube = l[0] || null; } catch { ultimaNube = null; } // sin red o sin nube: se activa igual
    if (ultimaNube) {
      try {
        const b = await bajar(persona, ultimaNube.nombre);
        const c = leerCabecera(b);
        const clave = await derivarClave(frase, c.sal, c.iteraciones);
        await descifrar(b, clave);
        // La frase abre las copias que ya hay: se sigue con su misma sal (misma clave).
        return guardarClave(persona, { clave, sal: c.sal, iteraciones: c.iteraciones });
      } catch (e) {
        if (e instanceof ErrorNube && e.codigo === 'frase') throw new ErrorNube('Esta frase no abre tu última copia en la nube. Si es una frase nueva, las copias anteriores solo se abrirán con la anterior.', 'otra-frase');
        // No se pudo comprobar (sin red, copia dañada…): se activa con sal nueva.
      }
    }
  }
  const sal = nuevaSal();
  return guardarClave(persona, { clave: await derivarClave(frase, sal), sal, iteraciones: ITERACIONES });
}
async function guardarClave(persona, { clave, sal, iteraciones }) {
  const reg = { persona, sal: new Uint8Array(sal), iteraciones, clave, creada: new Date(dep.ahora()).toISOString() };
  const ok = await almacenClave.escribir(reg);
  if (!ok) throw new ErrorNube('Este móvil no deja guardar la clave de las copias (IndexedDB no disponible, p. ej. en modo privado).', 'sin-idb');
  if (estado() && estado().dueño === persona) claveActual = reg;
  ponerNube({ error: null });
  return reg;
}
// Nueva frase: sal y clave nuevas. Las copias siguientes van con ella; las anteriores siguen con la anterior.
export async function cambiarFrase(persona, frase) {
  if (typeof frase !== 'string' || frase.length < FRASE_MIN) throw new ErrorNube(`La frase tiene que tener al menos ${FRASE_MIN} caracteres.`, 'corta');
  const sal = nuevaSal();
  return guardarClave(persona, { clave: await derivarClave(frase, sal), sal, iteraciones: ITERACIONES });
}
export async function desactivar(persona) {
  await almacenClave.borrar(persona);
  if (claveActual && claveActual.persona === persona) claveActual = null;
  avisarNube();
}

// Baja y descifra una copia. Con `frase` se deriva con la sal de la copia; sin ella, con la clave guardada
// (si la copia es de la misma sal). Devuelve { texto, recordar } (recordar: guarda la clave tras importar bien).
export async function abrirCopia(persona, nombre, { frase = null, codigo } = {}) {
  const b = await bajar(persona, nombre, { codigo });
  const c = leerCabecera(b);
  let clave;
  if (frase) clave = await derivarClave(frase, c.sal, c.iteraciones);
  else {
    const reg = claveActual && claveActual.persona === persona ? claveActual : await almacenClave.leer(persona);
    if (!reg || !mismaSal(reg.sal, c.sal) || reg.iteraciones !== c.iteraciones) throw new ErrorNube('Esta copia se hizo con otra frase: escríbela para abrirla.', 'pide-frase');
    clave = reg.clave;
  }
  const texto = await descifrar(b, clave);
  return { texto, recordar: frase ? () => guardarClave(persona, { clave, sal: c.sal, iteraciones: c.iteraciones }) : null };
}

// ── Subir ──
let subiendo = null;      // la subida en curso (promesa)
let otraVez = false;      // se pidió otra copia mientras se subía
let faltaRed = false;     // se quiso copiar sin red: se reintenta al volver
let tCambios = null;

async function subirYa(motivo) {
  const S = estado();
  if (!S || !S.dueño) return 'sin-dueño';
  if (estadoGuardado().rescate) return 'rescate';
  const reg = claveActual && claveActual.persona === S.dueño ? claveActual : null;
  if (!reg) return 'sin-clave';
  if (!dep.enLinea()) { faltaRed = true; return 'sin-red'; }
  const persona = S.dueño, m = metadatos(S);
  const bytes = await cifrar(exportar(), reg);
  if (bytes.length > LIMITE_SUBIDA) { ponerNube({ error: 'Tus datos ocupan demasiado para la nube: guarda una copia en un archivo.' }); return 'grande'; }
  try {
    await pedir({ binario: bytes, cabeceras: { 'x-copia-accion': 'subir', 'x-copia-persona': persona, 'x-copia-sesiones': String(m.sesiones), 'x-copia-ultima': m.ultima } });
  } catch (e) {
    if (e.codigo === 'sin-red') { faltaRed = true; return 'sin-red'; }
    if (e.codigo === 'inactiva') { ponerNube({ inactiva: true, error: e.message }); return 'inactiva'; }
    ponerNube({ error: e.message });
    return 'error';
  }
  faltaRed = false;
  ponerNube({ ultima: new Date(dep.ahora()).toISOString(), error: null, inactiva: false, motivo });
  return 'ok';
}

// Pide una copia ahora. Si ya hay una subiendo, se hace otra al acabar (una sola, con lo último).
export function copiarAhora(motivo = 'manual') {
  if (subiendo) { otraVez = true; return subiendo; }
  subiendo = (async () => {
    let r;
    try { r = await dep.bloqueo('pipos-copia-nube', () => subirYa(motivo)); } catch (e) { console.error('Copia en la nube', e); ponerNube({ error: 'No se pudo hacer la copia en la nube.' }); r = 'error'; }
    return r;
  })().finally(() => {
    subiendo = null;
    avisarNube();
    if (otraVez) { otraVez = false; copiarAhora(motivo); }
  });
  avisarNube();
  return subiendo;
}
export const subidaEnCurso = () => subiendo;

// ── Disparadores ──
let sesionesVistas = 0;
let iniciado = false;
const CAMBIOS = /^(perfil|medidas)(-silencio)?$/;
function alCambiar(motivo) {
  const S = estado();
  const n = hechas(S).length;
  const antes = sesionesVistas;
  sesionesVistas = n;
  if (motivo === 'dueño' || motivo === 'importar' || motivo === 'externo' || motivo === 'rescate') { cargarClave(); return; } // otros datos: no es una sesión nueva
  if (n > antes) { dep.clearTimeout(tCambios); tCambios = null; copiarAhora('sesion'); return; }
  if (CAMBIOS.test(motivo)) {
    dep.clearTimeout(tCambios);
    tCambios = dep.setTimeout(() => { tCambios = null; copiarAhora('cambios'); }, ESPERA_CAMBIOS);
  }
}
function alVolverRed() { if (faltaRed) copiarAhora('red'); }
// Al abrir: si la última copia tiene más de 24 h (o no hay), se hace una.
export async function revisarApertura() {
  await cargarClave();
  const n = nube();
  if (!claveActual) return 'sin-clave';
  if (n.ultima && dep.ahora() - Date.parse(n.ultima) <= DIA) return 'reciente';
  return copiarAhora('apertura');
}
export function iniciarCopias() {
  if (iniciado) return revisarApertura();
  iniciado = true;
  sesionesVistas = hechas(estado()).length;
  escuchar(alCambiar);
  if (typeof window !== 'undefined') window.addEventListener('online', alVolverRed);
  return revisarApertura();
}
// Solo para pruebas: deja el módulo como recién cargado.
export function reiniciarCopia() {
  dep.clearTimeout(tCambios); tCambios = null; subiendo = null; otraVez = false; faltaRed = false;
  claveActual = null; claveCargada = false; memoria = null;
  sesionesVistas = hechas(estado()).length;
}
export const _alVolverRed = alVolverRed;
