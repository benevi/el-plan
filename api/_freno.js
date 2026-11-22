// Frenos del servidor (S1): intentos de código fallidos y cupo diario de llamadas a la IA.
//
// Las funciones de Vercel no comparten memoria entre instancias (y una instancia puede reciclarse en cualquier
// momento), así que un contador en memoria solo frena dentro de una instancia. Por eso, si el almacén Blob del
// proyecto está conectado (el mismo de las copias, api/copia.js), los contadores viven también ahí, en archivos
// pequeños bajo frenos/ (preview/frenos/ fuera de producción):
//   frenos/codigo/<huella de la IP>.json  { v: ventana, n: fallos, hasta: ms }  (la IP no se guarda en claro)
//   frenos/ia/<día UTC>.json              { sesion: n, plan: n }
// Límite real: es un leer-sumar-escribir sin bloqueo, así que dos peticiones a la vez pueden contar una sola
// (el tope es aproximado, no exacto). Sin almacén Blob, solo queda el freno en memoria de cada instancia.
// Si el Blob falla, no se bloquea a nadie por eso (se sigue con la memoria).
import * as blobReal from '@vercel/blob';
import { createHash } from 'node:crypto';

// ── Almacén y reloj (las pruebas los sustituyen) ──
let almacen = null;
export function ponerAlmacenFreno(a) { almacen = a; }
let reloj = () => Date.now();
export function ponerRelojFreno(f) { reloj = typeof f === 'function' ? f : () => Date.now(); }
const blob = () => almacen || blobReal;
// Con un almacén inyectado (pruebas) o con las credenciales que pone Vercel al conectar el Blob.
const hayBlob = () => !!almacen || !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const prefijo = () => (process.env.VERCEL_ENV === 'production' ? '' : 'preview/');

async function leerJSON(ruta) {
  const r = await blob().get(ruta, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const lector = r.stream.getReader(); const trozos = []; let n = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    n += value.length;
    if (n > 4096) { try { await lector.cancel(); } catch { /* nada */ } return null; }
    trozos.push(Buffer.from(value));
  }
  try { const x = JSON.parse(Buffer.concat(trozos).toString('utf8')); return x && typeof x === 'object' ? x : null; } catch { return null; }
}
const escribirJSON = (ruta, x) => blob().put(ruta, JSON.stringify(x), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
const avisar = (que, e) => console.error(`freno: ${que}`, (e && e.constructor && e.constructor.name) || 'error'); // nunca el mensaje (podría llevar rutas)

// ── Intentos de código fallidos ──
// 10 fallos en 10 minutos desde la misma IP la bloquean 15 minutos (también con el código bueno: si no, el
// bloqueo no frenaría a quien prueba códigos). Con un APP_CODE de 20 caracteres al azar, ni sin freno se podría
// adivinar; el freno es para un código corto o filtrado.
export const FALLOS = { ventana: 10 * 60e3, max: 10, bloqueo: 15 * 60e3 };
const fallosMem = new Map(); // huella → { v, n, hasta }
// IP del móvil: en Vercel, la pone su red (x-vercel-forwarded-for / x-forwarded-for, que sobrescribe).
export function ipDe(req) {
  const h = req.headers || {};
  const v = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '';
  return String(v).split(',')[0].trim() || 'desconocida';
}
const huella = ip => createHash('sha256').update('pipos-freno|' + ip).digest('hex').slice(0, 32);
const rutaFallos = h => `${prefijo()}frenos/codigo/${h}.json`;

// ¿Está bloqueada esta IP? Devuelve { bloqueada, h, rec } (rec: lo que había en el Blob, para sumar después).
export async function revisarIP(req) {
  const h = huella(ipDe(req)), ahora = reloj();
  const m = fallosMem.get(h);
  if (m && m.hasta > ahora) return { bloqueada: true, h, rec: m };
  let rec = null;
  if (hayBlob()) {
    try { rec = await leerJSON(rutaFallos(h)); } catch (e) { avisar('no se pudo leer', e); }
    if (rec && +rec.hasta > ahora) { fallosMem.set(h, { v: +rec.v || 0, n: +rec.n || 0, hasta: +rec.hasta }); return { bloqueada: true, h, rec }; }
  }
  return { bloqueada: false, h, rec: rec || m || null };
}
// Apunta un fallo (memoria y Blob). Devuelve true si con este queda bloqueada.
export async function apuntarFallo({ h, rec }) {
  const ahora = reloj(), v = Math.floor(ahora / FALLOS.ventana);
  const mem = fallosMem.get(h);
  const base = [rec, mem].filter(x => x && +x.v === v).reduce((n, x) => Math.max(n, +x.n || 0), 0);
  const n = base + 1;
  const nuevo = { v, n, hasta: n >= FALLOS.max ? ahora + FALLOS.bloqueo : 0 };
  fallosMem.set(h, nuevo);
  if (fallosMem.size > 5000) fallosMem.clear(); // por si acaso: la memoria no crece sin fin
  if (hayBlob()) {
    try { await escribirJSON(rutaFallos(h), nuevo); } catch (e) { avisar('no se pudo apuntar', e); }
    if (Math.random() < 0.05) limpiar(`${prefijo()}frenos/codigo/`, ahora - FALLOS.bloqueo - FALLOS.ventana).catch(() => {});
  }
  return !!nuevo.hasta;
}

// ── Cupo diario de llamadas a la IA ──
// Entre las dos personas (el servidor no sabe quién llama: el código es el mismo). Por defecto 60 sesiones y 15
// planes al día (UTC), de sobra para dos personas con reintentos; CUPO_IA_SESIONES y CUPO_IA_PLANES en Vercel lo
// cambian (p. ej. para pasar scripts/casos-ia.mjs). Al pasarlo, 429 y la app sigue con sus reglas.
export const CUPO = { sesion: 60, plan: 15 };
const cupoDe = modo => {
  const v = Number(process.env[modo === 'plan' ? 'CUPO_IA_PLANES' : 'CUPO_IA_SESIONES']);
  return Number.isInteger(v) && v >= 0 ? v : CUPO[modo];
};
const cupoMem = new Map(); // día → { sesion, plan }
const rutaCupo = dia => `${prefijo()}frenos/ia/${dia}.json`;
// Suma una llamada de `modo` si cabe. Devuelve true si cabe.
export async function gastarCupo(modo) {
  const dia = new Date(reloj()).toISOString().slice(0, 10);
  const mem = cupoMem.get(dia) || { sesion: 0, plan: 0 };
  let cuenta = mem;
  if (hayBlob()) {
    try {
      const x = await leerJSON(rutaCupo(dia));
      if (x) cuenta = { sesion: Math.max(mem.sesion, +x.sesion || 0), plan: Math.max(mem.plan, +x.plan || 0) };
    } catch (e) { avisar('no se pudo leer el cupo', e); }
  }
  if (cuenta[modo] >= cupoDe(modo)) { cupoMem.set(dia, cuenta); return false; }
  const nueva = { ...cuenta, [modo]: cuenta[modo] + 1 };
  cupoMem.clear(); cupoMem.set(dia, nueva); // solo el día de hoy
  if (hayBlob()) {
    try { await escribirJSON(rutaCupo(dia), nueva); } catch (e) { avisar('no se pudo apuntar el cupo', e); }
    if (cuenta.sesion + cuenta.plan === 0) limpiar(`${prefijo()}frenos/ia/`, Date.parse(dia)).catch(() => {});
  }
  return true;
}

// Borra los contadores de antes de `antesDe` (ms). El SDK de Blob no tiene caducidad.
async function limpiar(prefix, antesDe) {
  const r = await blob().list({ prefix, limit: 1000 });
  const viejos = (r.blobs || []).filter(b => b.uploadedAt && new Date(b.uploadedAt).getTime() < antesDe).map(b => b.pathname);
  if (viejos.length) await blob().del(viejos);
}

// Solo para pruebas.
export function reiniciarFrenos() { fallosMem.clear(); cupoMem.clear(); }
