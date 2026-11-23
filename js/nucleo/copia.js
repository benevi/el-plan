// Copias automáticas en la nube (PR 4b, D14 y D15): cifradas en este móvil antes de salir.
//
// Formato del archivo, todo en bytes (versión 2; la 1 se sigue leyendo):
//   0  'PIPC'                     4 B  marca
//   4  versión = 2                1 B
//   5  kdf = 1 (PBKDF2-SHA-256)   1 B
//   6  iteraciones                4 B  (entero sin signo, big-endian; ≥ 600 000)
//   10 largo de la sal = 16       1 B
//   11 sal                        16 B (aleatoria, una por persona y frase)
//   27 largo del IV = 12          1 B
//   28 IV                         12 B (aleatorio en cada copia)
//   40 AES-GCM-256(gzip(texto))   con etiqueta de 16 B al final; los 40 B de la cabecera van como AAD,
//      así que tocar cualquier byte de la cabecera o del cuerpo hace fallar el descifrado.
// El texto, en la versión 2: JSON { tipo: 'pipos-copia', persona, creada, sesiones, ultima, estado }, con
// estado = exportar() (ya sin el código de acceso). En la versión 1 era exportar() a secas.
// En el nombre del blob van la sal (pública) y { s: sesiones, u: última } cifrados con la misma clave
// (IV propio, AAD 'pipos-copia-nombre/v2/<persona>'), para listar y probar la frase sin bajar las copias.
//
// La clave: PBKDF2-SHA-256(frase, sal, 600 000) → AES-GCM de 256 bits, NO exportable. La frase no se guarda
// nunca; la clave (CryptoKey) y su sal se guardan en IndexedDB ('pipos-copia'), no en localStorage, para poder
// copiar sin preguntar. Cada copia lleva su sal: con la frase basta para abrirla desde un móvil nuevo.
// Cambiar la frase crea sal y clave nuevas; las copias anteriores siguen con la anterior.
//
// Cuándo se copia (sin hacer nada): al terminar una sesión; tras cambios de perfil, lesiones, medidas, gustos,
// «Mis sesiones» o alarmas (1 minuto sin más cambios); al abrir la app si la última copia tiene más de 24 h o
// si el móvil tiene sesiones que no están en la nube, o si quedó una subida pendiente. Solo con red. Si una
// subida falla (sin red, la red que «miente», 5xx, 429), queda pendiente en 'pipos4-nube' y se reintenta sola
// con espera creciente (REINTENTOS), al volver la conexión, al volver la app a primer plano y al abrirla
// (D1, COD-3). Nunca dos subidas a la vez (tampoco entre pestañas, con Web Locks si hay)
// y nunca durante el rescate. Nunca se sube sola una copia con menos sesiones (o con una última sesión
// anterior) que la última subida: se pregunta (subir de todos modos o recuperar de la nube).

import { estado, exportar, escuchar, estadoGuardado } from './estado.js';
import { PALABRAS } from '../datos/palabras.js';

export const MAGIA = [0x50, 0x49, 0x50, 0x43]; // 'PIPC'
export const VERSION_FORMATO = 2;
const VERSIONES = [1, 2];
export const KDF_PBKDF2_SHA256 = 1;
export const ITERACIONES = 600000;
const MAX_ITERACIONES = 5000000; // por si alguien manipula la cabecera: no colgar el móvil
const LARGO_SAL = 16, LARGO_IV = 12, CABECERA = 40;
const MAX_TEXTO = 12 * 1024 * 1024; // tras descomprimir (importar() ya rechaza más de 10 MB)
export const LIMITE_SUBIDA = 4 * 1024 * 1024; // el mismo que api/copia.js
export const FRASE_MIN = 12;
export const PALABRAS_FRASE = 6; // 6 × 11 bits = 66 bits con la lista de 2048
export const DIA = 864e5;
export const ESPERA_CAMBIOS = 60e3;
export const AVISO_DIAS = 3;
// Espera antes de cada reintento tras un fallo; la última se repite mientras siga fallando.
export const REINTENTOS = [30e3, 2 * 60e3, 10 * 60e3, 30 * 60e3];
const MAX_SALES = 8; // frases distintas que se prueban como mucho (cada una cuesta un PBKDF2)

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
const desdeUtf8 = b => new TextDecoder('utf-8', { fatal: true }).decode(b);

// base64url sin relleno (para la sal y los metadatos del nombre).
export function b64u(bytes) {
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deB64u(txt) {
  if (typeof txt !== 'string' || !/^[A-Za-z0-9_-]*$/.test(txt)) return null;
  try { const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); } catch { return null; }
}

// ── Frases ──
// Propuesta: PALABRAS_FRASE palabras distintas al azar de la lista de 2048 (índices de 11 bits, sin sesgo):
// 6 × 11 = 66 bits (sin repetir, un poco menos: ~65,9). Siempre pasa calidadFrase.
export function generarFrase(n = PALABRAS_FRASE) {
  const elegidas = new Set();
  while (elegidas.size < n) {
    for (const x of globalThis.crypto.getRandomValues(new Uint16Array(n))) { if (elegidas.size < n) elegidas.add(PALABRAS[x & 2047]); }
  }
  return [...elegidas].join(' ');
}
// Entropía mínima (S3): la copia que cualquiera con el código puede bajar se ataca fuera de línea con un
// diccionario, así que no vale cualquier frase de 12 caracteres. 44 bits = 4 palabras de la lista; con PBKDF2 de
// 600 000 iteraciones, unos 2^63 pasos para probarlas todas.
export const BITS_MIN = 44;
const LISTA = new Set(PALABRAS);
// Lo primero que probaría alguien que os conoce: nombres, la app, años… No suman nada.
const OBVIAS = new Set(['victor', 'víctor', 'virginia', 'vir', 'vic', 'pipo', 'pipos', 'fitness', 'pipofitness', 'pipos-fitness', 'elplan', 'pareja', 'novio', 'novia',
  'gimnasio', 'gym', 'contraseña', 'contrasena', 'password', 'clave', 'frase', 'secreto', 'qwerty', 'asdf', 'hola', 'amor', 'quiero', 'teamo', 'tequiero']);
const sinTildes = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const esObvia = t => OBVIAS.has(t) || OBVIAS.has(sinTildes(t));
// Estimación prudente (por lo bajo) de los bits de una frase, al estilo de zxcvbn pero mucho más simple:
// cada palabra de la lista propia vale 11 bits; otra palabra, como mucho 12 (está en cualquier diccionario);
// las de 1 a 3 letras, 3; los años, 4; las cifras, 3,3 cada una (casi nada si son seguidas o repetidas); cada
// símbolo, 4. Una cadena sin palabras (p. ej. «x7#Kq9!mZ2@pL») cuenta como aleatoria. Lo repetido cuenta una vez.
export function bitsFrase(frase) {
  if (typeof frase !== 'string') return 0;
  const tokens = [...new Set(frase.normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean))];
  let bits = 0;
  for (const t of tokens) {
    if (LISTA.has(t)) { bits += 11; continue; }
    if (esObvia(t)) continue;
    let partes = 0, palabraLarga = false;
    for (const [trozo] of t.matchAll(/\p{L}+|\p{N}+|[^\p{L}\p{N}]+/gu)) {
      if (/^\p{L}/u.test(trozo)) {
        if (trozo.length >= 4) palabraLarga = true;
        partes += esObvia(trozo) ? 0 : LISTA.has(trozo) ? 11 : trozo.length <= 3 ? 3 : trozo.length <= 8 ? 12 : 12 + (trozo.length - 8) * 2;
      } else if (/^\p{N}/u.test(trozo)) {
        const seguidas = '0123456789012'.includes(trozo) || '9876543210987'.includes(trozo) || /^(\d)\1*$/.test(trozo);
        partes += /^(19|20)\d\d$/.test(trozo) ? 4 : seguidas ? 2 : trozo.length * 3.3;
      } else partes += 4 * trozo.length;
    }
    // Sin ninguna palabra dentro: cadena al azar (mayúsculas en la frase original, minúsculas, cifras, símbolos).
    if (!palabraLarga) {
      const orig = frase.normalize('NFC').split(/\s+/).find(x => x.toLowerCase() === t) || t;
      const clases = [/\p{Lu}/u, /\p{Ll}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter(r => r.test(orig)).length;
      const juego = [0, 26, 52, 62, 94][clases];
      if (clases >= 3) partes = Math.max(partes, orig.length * Math.log2(juego) * 0.6);
    }
    bits += partes;
  }
  return Math.round(bits * 10) / 10;
}
// Rechaza frases cortas o de baja entropía. Devuelve { ok, motivo, bits }.
export function calidadFrase(frase) {
  const mal = motivo => ({ ok: false, motivo, bits: bitsFrase(frase) });
  if (typeof frase !== 'string' || frase.trim().length < FRASE_MIN) return mal(`La frase tiene que tener al menos ${FRASE_MIN} caracteres.`);
  const t = frase.normalize('NFC').trim().toLowerCase();
  const junto = t.replace(/\s+/g, '');
  if (new Set(junto).size < 6 || /(.)\1{3,}/u.test(junto) || /^(.{1,8}?)\1+$/u.test(junto)) return mal('La frase repite demasiado: usa palabras distintas.');
  const pal = t.split(/\s+/).filter(Boolean);
  if (pal.length === 1 && /^\p{L}+$/u.test(pal[0])) return mal('Una sola palabra es fácil de adivinar: usa varias (mejor la que te propongo).');
  if (new Set(pal).size < pal.length) return mal('La frase repite palabras: usa palabras distintas.');
  if (/^(0123|1234|abcd|qwer|asdf|contrase|password)/u.test(junto)) return mal('Esa frase es demasiado común.');
  const bits = bitsFrase(frase);
  // porBits: solo falla la entropía (pasaba las reglas de antes de S3); ver activar().
  if (bits < BITS_MIN) return { ok: false, bits, porBits: true, motivo: 'Esa frase es fácil de adivinar para quien os conozca: usa la que te propongo, o al menos 4 palabras sin relación entre sí (sin vuestros nombres, «pipos», años ni frases hechas).' };
  return { ok: true, motivo: '', bits };
}

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
function cabecera(sal, iteraciones, iv, version) {
  const c = new Uint8Array(CABECERA);
  c.set(MAGIA, 0); c[4] = version; c[5] = KDF_PBKDF2_SHA256;
  new DataView(c.buffer).setUint32(6, iteraciones, false);
  c[10] = LARGO_SAL; c.set(sal, 11); c[27] = LARGO_IV; c.set(iv, 28);
  return c;
}
// Lee y valida la cabecera. Lanza ErrorNube('dañada') si no es un archivo de copia válido.
export function leerCabecera(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  if (b.length < CABECERA + 16 + 1) throw new ErrorNube(DAÑADA, 'dañada');
  if (MAGIA.some((x, i) => b[i] !== x)) throw new ErrorNube(DAÑADA, 'dañada');
  if (!VERSIONES.includes(b[4])) throw new ErrorNube('Esta copia es de una versión más nueva de la app: actualízala y vuelve a probar.', 'version');
  if (b[5] !== KDF_PBKDF2_SHA256 || b[10] !== LARGO_SAL || b[27] !== LARGO_IV) throw new ErrorNube(DAÑADA, 'dañada');
  const iteraciones = new DataView(b.buffer, b.byteOffset, b.length).getUint32(6, false);
  if (iteraciones < ITERACIONES || iteraciones > MAX_ITERACIONES) throw new ErrorNube(DAÑADA, 'dañada');
  return { version: b[4], iteraciones, sal: b.slice(11, 27), iv: b.slice(28, 40), aad: b.slice(0, CABECERA), cuerpo: b.slice(CABECERA) };
}
// Cifra un texto con la clave (y la sal/iteraciones con que se derivó, que van en la cabecera).
export async function cifrar(texto, { clave, sal, iteraciones = ITERACIONES }, { version = VERSION_FORMATO } = {}) {
  const iv = aleatorio(LARGO_IV);
  const c = cabecera(sal, iteraciones, iv, version);
  const datos = await comprimir(utf8.encode(texto));
  const cifrado = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: c, tagLength: 128 }, clave, datos));
  const out = new Uint8Array(CABECERA + cifrado.length);
  out.set(c, 0); out.set(cifrado, CABECERA);
  return out;
}
// Descifra y devuelve el texto. `clave` es una CryptoKey o una función (sal, iteraciones) => CryptoKey.
// Lanza ErrorNube: 'dañada' (cortada, alterada o no es una copia), 'frase' (no abre con esta clave/frase).
export async function descifrar(bytes, clave) {
  const c = leerCabecera(bytes);
  const k = typeof clave === 'function' ? await clave(c.sal, c.iteraciones) : clave;
  let datos;
  try { datos = new Uint8Array(await sutil().decrypt({ name: 'AES-GCM', iv: c.iv, additionalData: c.aad, tagLength: 128 }, k, c.cuerpo)); } catch {
    // AES-GCM no distingue «otra frase» de «bytes tocados»: se dice lo más probable.
    throw new ErrorNube(MAL_FRASE, 'frase');
  }
  try { return desdeUtf8(await descomprimir(datos)); } catch (e) {
    if (e instanceof ErrorNube) throw e;
    throw new ErrorNube(DAÑADA, 'dañada');
  }
}
// Versión 2: el texto lleva los metadatos y el estado.
export function empaquetar({ persona, creada, sesiones, ultima }, estadoTxt) {
  return JSON.stringify({ tipo: 'pipos-copia', persona, creada, sesiones, ultima: ultima || null, estado: JSON.parse(estadoTxt) });
}
// Abre un archivo: { estado (texto para importar()), meta ({ persona, creada, sesiones, ultima } o null en la v1), version }.
export async function abrirArchivo(bytes, clave) {
  const { version } = leerCabecera(bytes);
  const txt = await descifrar(bytes, clave);
  if (version === 1) return { estado: txt, meta: null, version };
  let x;
  try { x = JSON.parse(txt); } catch { throw new ErrorNube(DAÑADA, 'dañada'); }
  if (!x || x.tipo !== 'pipos-copia' || typeof x.persona !== 'string' || !x.estado || typeof x.estado !== 'object') throw new ErrorNube(DAÑADA, 'dañada');
  const meta = { persona: x.persona, creada: typeof x.creada === 'string' ? x.creada : null, sesiones: Number.isInteger(x.sesiones) ? x.sesiones : null, ultima: typeof x.ultima === 'string' ? x.ultima : null };
  return { estado: JSON.stringify(x.estado), meta, version };
}

// Metadatos del nombre: { s, u } cifrados con la clave de la persona.
const aadNombre = persona => utf8.encode('pipos-copia-nombre/v2/' + persona);
export async function cifrarNombre({ sesiones, ultima }, clave, persona) {
  const iv = aleatorio(LARGO_IV);
  const c = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: aadNombre(persona), tagLength: 128 }, clave, utf8.encode(JSON.stringify({ s: sesiones, u: ultima || '' }))));
  const out = new Uint8Array(LARGO_IV + c.length); out.set(iv, 0); out.set(c, LARGO_IV);
  return b64u(out);
}
// { sesiones, ultima } o null si no abre con esta clave (otra frase, o basura).
export async function descifrarNombre(txt, clave, persona) {
  const b = deB64u(txt);
  if (!b || b.length < LARGO_IV + 17) return null;
  try {
    const p = await sutil().decrypt({ name: 'AES-GCM', iv: b.slice(0, LARGO_IV), additionalData: aadNombre(persona), tagLength: 128 }, clave, b.slice(LARGO_IV));
    const x = JSON.parse(desdeUtf8(new Uint8Array(p)));
    return { sesiones: Number.isInteger(x.s) ? x.s : null, ultima: typeof x.u === 'string' && x.u ? x.u : null };
  } catch { return null; }
}
// Etiqueta de subida (S2): demuestra al servidor que quien sube tiene la clave de esa persona, sin dársela. Es
// AES-GCM de 16 bytes a cero con un IV fijo (todo unos) y AAD propia: una función determinista de la clave (la
// misma en cualquier móvil con la misma frase y sal) que no revela nada de ella. Las copias usan IV aleatorios
// de 96 bits, así que no coinciden con este (probabilidad 2^-96). Sirve con las claves ya guardadas (no
// exportables) sin volver a pedir la frase. El servidor guarda solo su SHA-256 (api/copia.js).
const IV_ETIQUETA = new Uint8Array(LARGO_IV).fill(0xff);
export async function etiquetaDe(clave, persona) {
  const c = await sutil().encrypt({ name: 'AES-GCM', iv: IV_ETIQUETA, additionalData: utf8.encode('pipos-copia-etiqueta/v1/' + persona), tagLength: 128 }, clave, new Uint8Array(16));
  return b64u(new Uint8Array(c));
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
// { persona, ultima: ISO de la última subida, sesiones y ultimaSesion de lo último subido o restaurado (la
//   «base»: no se sube solo nada con menos), error, inactiva (el servidor dijo 503), retenida (se dejó de
//   subir algo por tener menos que la base), pausada (tras «Empezar de cero» en el rescate),
//   pendiente ({ desde: ISO, motivo }: una subida falló y aún no se ha repetido bien; sobrevive a cerrar la app) }
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
const cerrojos = () => (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function' ? navigator.locks : null);
let dep = {
  fetch: (...a) => globalThis.fetch(...a),
  enLinea: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  ahora: () => Date.now(),
  setTimeout: (...a) => globalThis.setTimeout(...a),
  clearTimeout: (...a) => globalThis.clearTimeout(...a),
  // Ejecuta fn con el cerrojo entre pestañas si está libre; si otra pestaña lo tiene, devuelve 'ocupado'.
  bloqueo: (nombre, fn) => {
    const l = cerrojos();
    return l ? l.request(nombre, { ifAvailable: true }, lock => (lock ? fn() : 'ocupado')) : fn();
  },
  // Se cumple cuando el cerrojo queda libre (para reintentar entonces).
  cuandoLibre: nombre => { const l = cerrojos(); return l ? l.request(nombre, () => {}) : Promise.resolve(); },
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

// Para la interfaz: { activada, cargada, ultima, error, inactiva, subiendo, retenida, pausada, desactivada, avisar }.
export function estadoNube() {
  const n = nube(), S = estado();
  const dueño = S && S.dueño;
  const activada = !!(claveActual && dueño && claveActual.persona === dueño);
  const deEsta = !n.persona || n.persona === dueño;
  const vieja = !n.ultima || dep.ahora() - Date.parse(n.ultima) > AVISO_DIAS * DIA;
  // Hubo copias desde este móvil para esta persona, pero ya no está su clave (p. ej. se borró IndexedDB).
  const desactivada = claveCargada && !activada && !!dueño && !!n.ultima && n.persona === dueño;
  const retenida = activada && deEsta && n.retenida ? n.retenida : null;
  const pausada = activada && !!n.pausada;
  // Una subida que falló con error (no por falta de red) y sigue pendiente: se avisa ya, no a los 3 días (D1).
  const fallida = activada && deEsta && !!n.error && !!n.pendiente;
  return { activada, cargada: claveCargada, ultima: deEsta ? n.ultima || null : null, error: deEsta ? n.error || null : null, inactiva: !!n.inactiva,
    subiendo: !!subiendo, retenida, pausada, desactivada, fallida, pendiente: activada && deEsta && !!n.pendiente,
    reintenta: fallida && n.pendiente.motivo !== 'sin-reintento',
    avisar: desactivada || (activada && (!!n.inactiva || vieja || !!retenida || pausada || fallida)) };
}

// ── Servidor (api/copia.js) ──
const hechas = S => Object.values((S && S.sesiones) || {}).filter(s => s && s.estado === 'hecha');
export function metadatos(S) {
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
  if (r.status === 403 && datos && datos.etiqueta) throw new ErrorNube('La nube no reconoce la clave de este móvil para tus copias (quizá cambiaste la frase en otro móvil): actívalas otra vez con tu frase actual en Perfil › Copias. Si no la recuerdas o sigue igual, pide a Víctor que restablezca tu registro de copias (LEEME, «Quién sube»).', 'etiqueta', { status: 403 });
  // Retry-After (segundos) del servidor: hasta entonces no se insiste (M4).
  let espera = null;
  try { const ra = r.headers && r.headers.get && r.headers.get('retry-after'); if (ra && /^\d+$/.test(ra)) espera = +ra * 1000; } catch { espera = null; }
  throw new ErrorNube('La nube no responde: ' + msg + '.', 'servidor', { status: r.status, espera, mañana: r.status === 429 && /mañana/.test(msg) });
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

// ── Probar una frase (o la clave guardada) contra la lista ──
// No depende de la copia más nueva: agrupa las copias por sal, deriva UNA vez por sal distinta (como mucho
// MAX_SALES, de la más reciente a la más antigua) y marca cada copia: abre true/false/null (sin probar),
// con sus sesiones y última sesión si abre. Así sirven las frases antiguas y una copia basura no bloquea nada.
// Las copias de la versión 1 (sin sal en el nombre) se bajan para leer su cabecera.
// Devuelve { copias, claves: Map(sal base64url → { clave, sal, iteraciones }) }.
export async function probarCopias(persona, copias, { frase = null, reg = null, codigo } = {}) {
  const claves = new Map(), descartadas = new Set();
  const bajadas = new Map();
  const claveDe = async salTxt => {
    if (claves.has(salTxt)) return claves.get(salTxt);
    if (descartadas.has(salTxt)) return null;
    const sal = deB64u(salTxt);
    if (!sal || sal.length !== LARGO_SAL) { descartadas.add(salTxt); return null; }
    let k = null;
    if (reg && mismaSal(reg.sal, sal)) k = { clave: reg.clave, sal: reg.sal, iteraciones: reg.iteraciones };
    else if (frase && claves.size + descartadas.size < MAX_SALES) k = { clave: await derivarClave(frase, sal, ITERACIONES), sal, iteraciones: ITERACIONES };
    if (k) claves.set(salTxt, k); else descartadas.add(salTxt);
    return k;
  };
  const out = [];
  for (const c of copias) {
    const x = { ...c, abre: null };
    try {
      if (c.sal && c.meta) {
        const k = await claveDe(c.sal);
        if (k) {
          const m = await descifrarNombre(c.meta, k.clave, persona); // null: otra frase o basura
          x.abre = !!m;
          if (m) Object.assign(x, m);
        } else x.abre = frase ? null : false; // sin probar (demasiadas frases distintas) u otra frase
      } else {
        // Versión 1: hay que bajarla para saber su sal y probar.
        const b = await bajar(persona, c.nombre, { codigo });
        bajadas.set(c.nombre, b);
        const cab = leerCabecera(b);
        const salTxt = b64u(cab.sal);
        x.sal = salTxt;
        const k = await claveDe(salTxt);
        if (k) {
          try { await descifrar(b, k.clave); x.abre = true; } catch { x.abre = false; }
        } else x.abre = frase ? null : false;
      }
    } catch (e) {
      if (e instanceof ErrorNube && (e.codigo === 'sin-red' || e.codigo === 'inactiva' || e.codigo === 'codigo')) throw e;
      x.abre = false;
    }
    out.push(x);
  }
  return { copias: out, claves, bajadas };
}

// ── Activar, cambiar la frase y restaurar ──
// Activa las copias de `persona` en este móvil con `frase`. Si la nube ya tiene copias que abren con esta
// frase, se sigue con la sal de la más nueva que abre (misma clave) y su contenido pasa a ser la base (no se
// sube solo nada con menos). Si hay copias y ninguna abre, lanza ErrorNube('otra-frase') salvo con
// { aunqueNoCoincida: true }. Devuelve { reg, copias: nº en la nube, abren, ultimaQueAbre }.
// Compatibilidad (S3): una frase que ya no pasa calidadFrase pero abre copias que ya están en la nube se acepta
// para seguir con ellas (rechazarla no protege nada: esas copias ya están hechas con ella); se devuelve
// `floja: true` para recomendar cambiarla. Una frase floja nueva se rechaza siempre.
let fraseReciente = null; // { persona, frase, hasta }: solo en memoria y unos minutos tras activar (M3)
// Ante un 403 de etiqueta justo tras activar: con la frase de la activación, busca una copia que abra con otra sal
// (la clave registrada) y la adopta. Devuelve true si cambió de clave.
async function adoptarSalQueAbre(persona) {
  const f = fraseReciente;
  fraseReciente = null; // una sola vez
  if (!f || f.persona !== persona || dep.ahora() > f.hasta) return false;
  try {
    const lista = await listar(persona);
    const p = await probarCopias(persona, lista, { frase: f.frase });
    const u = p.copias.find(c => c.abre && !(claveActual && c.sal === b64u(claveActual.sal)));
    if (!u) return false;
    await guardarClave(persona, p.claves.get(u.sal));
    return true;
  } catch { return false; }
}
export async function activar(persona, frase, { aunqueNoCoincida = false } = {}) {
  const q = calidadFrase(frase);
  if (!q.ok && !q.porBits) throw new ErrorNube(q.motivo, 'corta');
  // M3: solo se sigue sin mirar la nube si las copias aún no están activadas en el servidor (503). Con el código
  // malo, sin red o con la nube ocupada, se para: crear una sal nueva sin ver lo que hay acabaría en un 403.
  let lista;
  try { lista = await listar(persona); } catch (e) {
    if (!(e instanceof ErrorNube && e.codigo === 'inactiva')) throw e;
    lista = [];
  }
  fraseReciente = { persona, frase, hasta: dep.ahora() + 10 * 60e3 };
  if (!q.ok) {
    let p;
    try { p = lista.length ? await probarCopias(persona, lista, { frase }) : null; } catch { p = null; }
    const u = p && p.copias.find(c => c.abre);
    if (!u) throw new ErrorNube(q.motivo, 'corta');
    const reg = await guardarClave(persona, p.claves.get(u.sal));
    ponerBase(persona, { sesiones: u.sesiones || 0, ultima: u.ultima || '' }, { siMayor: true });
    return { reg, copias: lista.length, abren: p.copias.filter(c => c.abre).length, ultimaQueAbre: u, floja: true };
  }
  if (lista.length) {
    let p;
    try { p = await probarCopias(persona, lista, { frase }); } catch { p = null; }
    const abren = p ? p.copias.filter(c => c.abre) : [];
    if (abren.length) {
      const u = abren[0];
      const k = p.claves.get(u.sal);
      const reg = await guardarClave(persona, k);
      ponerBase(persona, { sesiones: u.sesiones || 0, ultima: u.ultima || '' }, { siMayor: true });
      return { reg, copias: lista.length, abren: abren.length, ultimaQueAbre: u };
    }
    if (p && !aunqueNoCoincida) throw new ErrorNube('Esta frase no abre ninguna de tus copias en la nube. Si es una frase nueva, las copias anteriores solo se abrirán con la anterior.', 'otra-frase');
  }
  const sal = nuevaSal();
  const reg = await guardarClave(persona, { clave: await derivarClave(frase, sal), sal, iteraciones: ITERACIONES });
  return { reg, copias: lista.length, abren: 0, ultimaQueAbre: null };
}
async function guardarClave(persona, { clave, sal, iteraciones }) {
  const reg = { persona, sal: new Uint8Array(sal), iteraciones, clave, creada: new Date(dep.ahora()).toISOString() };
  // S2: si se cambia de clave (otra frase, o restaurar con una frase antigua), la etiqueta de la anterior sirve
  // para que el servidor acepte la nueva en la siguiente subida.
  // Si ya había una pendiente de usar (dos cambios antes de subir), se queda la primera: es la registrada.
  const ya = nube();
  const previa = claveActual && claveActual.persona === persona && !mismaSal(claveActual.sal, reg.sal)
    && !((!ya.persona || ya.persona === persona) && typeof ya.etiquetaPrevia === 'string') ? claveActual : null;
  let etiquetaPrevia = null;
  if (previa) { try { etiquetaPrevia = await etiquetaDe(previa.clave, persona); } catch { etiquetaPrevia = null; } }
  const ok = await almacenClave.escribir(reg);
  if (!ok) throw new ErrorNube('Este móvil no deja guardar la clave de las copias (IndexedDB no disponible, p. ej. en modo privado).', 'sin-idb');
  if (estado() && estado().dueño === persona) claveActual = reg;
  // Clave nueva: lo que estaba bloqueado por un error sin reintento (p. ej. «no reconoce la clave») se vuelve a probar.
  const sinReintento = ya.pendiente && ya.pendiente.motivo === 'sin-reintento';
  ponerNube({ error: null, ...(etiquetaPrevia ? { etiquetaPrevia } : {}), ...(sinReintento ? { pendiente: null } : {}) });
  return reg;
}
// La base: lo último subido o restaurado. Con siMayor, solo sube (nunca baja) lo que ya hubiera.
function ponerBase(persona, { sesiones, ultima }, { siMayor = false } = {}) {
  const n = nube();
  if (siMayor && n.persona === persona && ((n.sesiones || 0) > sesiones || String(n.ultimaSesion || '') > String(ultima || ''))) return;
  ponerNube({ persona, sesiones, ultimaSesion: ultima || '', retenida: null });
}
// Tras restaurar (o cargar a mano) unos datos: lo que hay ahora es la base.
export function marcarBase() {
  const S = estado(); if (!S || !S.dueño) return;
  ponerBase(S.dueño, metadatos(S));
}
// Nueva frase: sal y clave nuevas. Las copias siguientes van con ella; las anteriores siguen con la anterior.
export async function cambiarFrase(persona, frase) {
  const q = calidadFrase(frase);
  if (!q.ok) throw new ErrorNube(q.motivo, 'corta');
  const sal = nuevaSal();
  return guardarClave(persona, { clave: await derivarClave(frase, sal), sal, iteraciones: ITERACIONES });
}
// Tras «Empezar de cero» en el rescate: no se vuelve a usar la clave hasta que la persona lo confirme.
export function pausarNube() { ponerNube({ pausada: true }); }
export function reanudarNube() { ponerNube({ pausada: false }); }

// Baja y descifra una copia. Clave: `clave` ({ clave, sal, iteraciones } de probarCopias) si es de su sal; si no,
// `frase` (con la sal de la copia); si no, la clave guardada (si es de la misma sal). `esperado`: lo que dice
// el nombre ({ fecha, sesiones, ultima }). Devuelve { texto, meta, avisos, recordar }: avisos si los metadatos de
// dentro no cuadran con el nombre o la persona; recordar() guarda la clave tras importar bien.
export async function abrirCopia(persona, nombre, { frase = null, clave = null, codigo, esperado = null, bytes = null } = {}) {
  const b = bytes || await bajar(persona, nombre, { codigo });
  const c = leerCabecera(b);
  let k;
  if (clave && mismaSal(clave.sal, c.sal) && clave.iteraciones === c.iteraciones) k = clave;
  else if (frase) k = { clave: await derivarClave(frase, c.sal, c.iteraciones), sal: c.sal, iteraciones: c.iteraciones };
  else {
    const reg = claveActual && claveActual.persona === persona ? claveActual : await almacenClave.leer(persona);
    if (!reg || !mismaSal(reg.sal, c.sal) || reg.iteraciones !== c.iteraciones) throw new ErrorNube('Esta copia se hizo con otra frase: escríbela para abrirla.', 'pide-frase');
    k = reg;
  }
  const { estado: texto, meta, version } = await abrirArchivo(b, k.clave);
  const avisos = [];
  if (meta) {
    if (meta.persona !== persona) avisos.push(`Por dentro dice ser de ${meta.persona === 'victor' ? 'Víctor' : meta.persona === 'virginia' ? 'Virginia' : 'otra persona'}, no de quien elegiste.`);
    if (esperado) {
      if (esperado.sesiones != null && meta.sesiones !== esperado.sesiones) avisos.push(`La lista decía ${+esperado.sesiones} ${+esperado.sesiones === 1 ? 'sesión' : 'sesiones'} y dentro hay ${+meta.sesiones}.`);
      if (esperado.ultima !== undefined && (esperado.ultima || null) !== (meta.ultima || null)) avisos.push('La fecha de la última sesión no coincide con la de la lista.');
      const t1 = Date.parse(esperado.fecha), t2 = Date.parse(meta.creada);
      if (!Number.isNaN(t1) && (Number.isNaN(t2) || t2 > t1 + 5 * 60e3 || t1 - t2 > 30 * 60e3)) avisos.push('La fecha de dentro no coincide con la de la subida.');
    }
  }
  return { texto, meta, version, avisos, recordar: frase || (clave && !(claveActual && mismaSal(claveActual.sal, c.sal))) ? () => guardarClave(persona, k) : null };
}

// ── Subir ──
let subiendo = null;      // la subida en curso (promesa)
let otraVez = false;      // se pidió otra copia mientras se subía
let forzarOtraVez = false;
let esperandoCerrojo = false;
let faltaRed = false;     // se quiso copiar sin red: se reintenta al volver
let tCambios = null;
let tReintento = null;    // reintento programado tras un fallo
let intentos = 0;         // fallos seguidos (para la espera creciente)

// Tras un fallo que puede arreglarse solo: queda pendiente (también tras cerrar la app) y se programa un
// reintento con espera creciente. No depende del evento «online», que no llega si el navegador nunca se
// creyó sin red (cobertura que se cae un momento, fetch cortado al pasar a segundo plano).
// pendiente = { desde, motivo, ultimo (ms del último intento), espera (ms hasta el siguiente), n (fallos
// seguidos), hasta (ms: antes no se intenta nada automático; p. ej. el tope diario, M4) }. Se guarda en
// pipos4-nube, así que la espera creciente sigue tras cerrar y abrir la app.
function quedaPendiente(motivo, cambios = {}, { minimo = 0 } = {}) {
  const n = nube(), ahora = dep.ahora();
  const previo = n.pendiente || {};
  const fallos = Number.isInteger(previo.n) ? previo.n : intentos;
  const espera = Math.max(REINTENTOS[Math.min(fallos, REINTENTOS.length - 1)], minimo);
  intentos = fallos + 1;
  ponerNube({ ...cambios, pendiente: { desde: previo.desde || new Date(ahora).toISOString(), motivo, ultimo: ahora, espera, n: fallos + 1, ...(minimo ? { hasta: ahora + minimo } : {}) } });
  programarReintento(espera, { cambiar: true });
}
function programarReintento(ms, { cambiar = false } = {}) {
  if (tReintento && !cambiar) return;
  dep.clearTimeout(tReintento);
  tReintento = dep.setTimeout(() => { tReintento = null; copiarAhora('reintento'); }, Math.max(0, ms));
  if (tReintento && typeof tReintento.unref === 'function') tReintento.unref(); // en Node (pruebas): no retiene el proceso
}
function sinPendiente() {
  dep.clearTimeout(tReintento); tReintento = null; intentos = 0;
}
// ¿Se puede intentar ya una subida automática? (G1, M4). Lo pide la persona («Copiar ahora», «Subir de todos
// modos», activar, cambiar la frase): siempre. Si no:
// - con un error que no se arregla solo (código malo, la nube no reconoce la clave): nunca; se limpia al
//   cambiar el código en Ajustes o al guardar otra clave;
// - antes de `hasta` (tope diario o Retry-After): no;
// - tras un error, antes de que pase su espera (sin reiniciarla al volver a primer plano o al abrir): no, salvo
//   el propio reintento programado. Si no hay temporizador (app recién abierta), se programa el que falta.
const PIDE_LA_PERSONA = new Set(['manual', 'forzada', 'activar', 'frase', 'reanudar', 'codigo']);
function esperaPendiente(motivo) {
  const p = nube().pendiente;
  if (!p || PIDE_LA_PERSONA.has(motivo)) return 0;
  const ahora = dep.ahora();
  if (p.motivo === 'sin-reintento') return Infinity;
  if (+p.hasta > ahora) return +p.hasta - ahora;
  if (p.motivo === 'error' && motivo !== 'reintento' && +p.ultimo && +p.espera && ahora - p.ultimo < p.espera) return p.espera - (ahora - p.ultimo);
  return 0;
}
// Siguiente día UTC (cuando el servidor reinicia el tope diario de subidas).
const mañanaUTC = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) + 60e3; };
// Errores que no se arreglan reintentando (código malo, petición rechazada): se avisa y no se insiste.
const reintentable = e => e.codigo === 'sin-red' || (e.codigo === 'servidor' && (e.status >= 500 || e.status === 429 || e.status === 408));

async function subirYa(motivo, { forzar = false } = {}) {
  const S = estado();
  if (!S || !S.dueño) return 'sin-dueño';
  if (estadoGuardado().rescate) return 'rescate';
  const reg = claveActual && claveActual.persona === S.dueño ? claveActual : null;
  if (!reg) return 'sin-clave';
  const persona = S.dueño, m = metadatos(S), n = nube();
  if (n.pausada && !forzar) return 'pausada';
  // No subir sola una copia vacía o atrasada como «la más nueva».
  if (!forzar && n.persona === persona && ((n.sesiones || 0) > m.sesiones || String(n.ultimaSesion || '') > m.ultima)) {
    if (!n.retenida || n.retenida.sesiones !== m.sesiones) ponerNube({ retenida: { sesiones: m.sesiones, ultima: m.ultima, base: n.sesiones || 0, baseUltima: n.ultimaSesion || '' } });
    return 'retenida';
  }
  const falta = esperaPendiente(motivo);
  if (falta === Infinity) return 'bloqueada';
  if (falta > 0) { programarReintento(falta); return 'espera'; }
  if (!dep.enLinea()) { faltaRed = true; quedaPendiente('sin-red'); return 'sin-red'; }
  const creada = new Date(dep.ahora()).toISOString();
  const bytes = await cifrar(empaquetar({ persona, creada, ...m }, exportar()), reg);
  if (bytes.length > LIMITE_SUBIDA) { ponerNube({ error: 'Tus datos ocupan demasiado para la nube: guarda una copia en un archivo.' }); return 'grande'; }
  const meta = await cifrarNombre(m, reg.clave, persona);
  const cab = { 'x-copia-accion': 'subir', 'x-copia-persona': persona, 'x-copia-sal': b64u(reg.sal), 'x-copia-meta': meta, 'x-copia-etiqueta': await etiquetaDe(reg.clave, persona) };
  if (typeof n.etiquetaPrevia === 'string' && (!n.persona || n.persona === persona)) cab['x-copia-etiqueta-anterior'] = n.etiquetaPrevia;
  try {
    await pedir({ binario: bytes, cabeceras: cab });
  } catch (e) {
    if (e.codigo === 'sin-red') { faltaRed = true; quedaPendiente('sin-red'); return 'sin-red'; }
    if (e.codigo === 'inactiva') { ponerNube({ inactiva: true, error: e.message }); return 'inactiva'; }
    // M3: la nube no reconoce la clave recién activada: si con la frase de la activación alguna copia abre con
    // otra sal, se adopta esa clave (la registrada) y se vuelve a intentar una vez.
    if (e.codigo === 'etiqueta' && await adoptarSalQueAbre(persona)) return subirYa(motivo, { forzar });
    if (reintentable(e)) {
      const minimo = e.mañana ? mañanaUTC(dep.ahora()) - dep.ahora() : e.espera || 0;
      quedaPendiente('error', { error: e.message }, { minimo });
      return 'error';
    }
    ponerNube({ error: e.message, pendiente: { desde: new Date(dep.ahora()).toISOString(), motivo: 'sin-reintento' } }); // p. ej. 401
    sinPendiente();
    return 'error';
  }
  faltaRed = false;
  sinPendiente();
  ponerNube({ persona, ultima: new Date(dep.ahora()).toISOString(), sesiones: m.sesiones, ultimaSesion: m.ultima, error: null, inactiva: false, retenida: null, pausada: false, pendiente: null, etiquetaPrevia: null, motivo });
  return 'ok';
}

// Pide una copia ahora. Si ya hay una subiendo, se hace otra al acabar (una sola, con lo último). Si otra
// pestaña tiene el cerrojo, se reintenta cuando lo suelte. { forzar }: «Subir de todos modos».
export function copiarAhora(motivo = 'manual', { forzar = false } = {}) {
  if (subiendo) { otraVez = true; forzarOtraVez = forzarOtraVez || forzar; return subiendo; }
  subiendo = (async () => {
    let r;
    try { r = await dep.bloqueo('pipos-copia-nube', () => subirYa(motivo, { forzar })); } catch (e) { console.error('Copia en la nube', e); ponerNube({ error: 'No se pudo hacer la copia en la nube.' }); r = 'error'; }
    if (r === 'ocupado' && !esperandoCerrojo) {
      esperandoCerrojo = true;
      Promise.resolve(dep.cuandoLibre('pipos-copia-nube')).catch(() => {}).then(() => { esperandoCerrojo = false; copiarAhora(motivo, { forzar }); });
    }
    return r;
  })().finally(() => {
    subiendo = null;
    avisarNube();
    if (otraVez) { const f = forzarOtraVez; otraVez = false; forzarOtraVez = false; copiarAhora(motivo, { forzar: f }); }
  });
  avisarNube();
  return subiendo;
}
export const subidaEnCurso = () => subiendo;

// ── Disparadores ──
let sesionesVistas = 0;
let iniciado = false;
let dejarDeEscuchar = null;
// D7: también gustos (me gusta / no me gusta / no lo quiero), «Mis sesiones» y alarmas.
const CAMBIOS = /^(perfil|medidas|gusto|misSesiones|alarma)(-silencio)?$/;
let codigoVisto = null;
function alCambiar(motivo) {
  const S = estado();
  // G1: al cambiar el código en Ajustes, lo que estaba parado por un código malo se vuelve a intentar.
  const codigo = (S && S.ajustes && S.ajustes.codigo) || '';
  if (codigoVisto !== null && codigo !== codigoVisto) {
    codigoVisto = codigo;
    const p = nube().pendiente;
    if (p && p.motivo === 'sin-reintento') { ponerNube({ pendiente: null, error: null }); copiarAhora('codigo'); }
  }
  codigoVisto = codigo;
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
// Al volver la red (evento «online») o la app a primer plano: si quedó algo pendiente, se sube ya.
function alVolverRed() {
  const p = nube().pendiente;
  if (!faltaRed && !p) return;
  if (p && (p.motivo === 'sin-reintento' || esperaPendiente('red') > 0)) return; // G1, M4: no se insiste
  copiarAhora('red');
}
function alVolverVisible() { if (typeof document === 'undefined' || !document.hidden) alVolverRed(); }
// ¿Tiene el móvil sesiones que no están en la última copia subida (o restaurada)? (D1, COD-3)
function atrasada(n, persona) {
  if (n.persona !== persona) return false;
  const m = metadatos(estado());
  return m.sesiones > (n.sesiones || 0) || m.ultima > String(n.ultimaSesion || '');
}
// Al abrir: si la última copia tiene más de 24 h (o no hay), si hay sesiones sin subir o si quedó una subida
// pendiente (la app se cerró sin red o a mitad), se hace una.
export async function revisarApertura() {
  await cargarClave();
  const n = nube();
  if (!claveActual) return 'sin-clave';
  if (n.ultima && n.persona === claveActual.persona && dep.ahora() - Date.parse(n.ultima) <= DIA
    && !n.pendiente && !atrasada(n, claveActual.persona)) return 'reciente';
  return copiarAhora('apertura');
}
export function iniciarCopias() {
  if (iniciado) return revisarApertura();
  iniciado = true;
  sesionesVistas = hechas(estado()).length;
  codigoVisto = (estado() && estado().ajustes && estado().ajustes.codigo) || '';
  dejarDeEscuchar = escuchar(alCambiar);
  if (typeof window !== 'undefined') window.addEventListener('online', alVolverRed);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alVolverVisible);
  return revisarApertura();
}
// Solo para pruebas: deja el módulo como recién cargado.
export function reiniciarCopia() {
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  if (typeof window !== 'undefined') window.removeEventListener('online', alVolverRed);
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alVolverVisible);
  iniciado = false;
  sinPendiente();
  dep.clearTimeout(tCambios); tCambios = null; subiendo = null; otraVez = false; forzarOtraVez = false; faltaRed = false; esperandoCerrojo = false;
  claveActual = null; claveCargada = false; memoria = null; fraseReciente = null; codigoVisto = null;
  sesionesVistas = hechas(estado()).length;
}
export const _alVolverRed = alVolverRed;
