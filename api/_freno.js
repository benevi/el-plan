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
// 10 códigos incorrectos DISTINTOS en 10 minutos desde la misma IP (o la misma red /64 en IPv6) la bloquean 15
// minutos, también con el código bueno (si no, el bloqueo no frenaría a quien prueba códigos). El mismo código
// malo repetido (un móvil con el código viejo reintentando) cuenta una vez: así no se bloquea a los dos por un
// código cambiado en Vercel. Con un APP_CODE de 20 caracteres al azar, ni sin freno se podría adivinar.
// Operaciones del Blob (M1): con el código bueno no se toca el Blob (solo la memoria de esta instancia); con uno
// malo se lleva en memoria y se escribe en el Blob a partir del 3.º distinto (y se lee entonces), así que quien
// no tiene el código no puede gastar operaciones del Blob con cada petición.
// Límite real: entre instancias, el bloqueo solo se ve en la instancia que lo aplicó y en las que luego reciben
// 3 códigos malos distintos de esa IP (cada instancia nueva regala 2 intentos); un código bueno que llegue a otra
// instancia pasa. Con pocas instancias (Fluid Compute) y un APP_CODE largo, basta.
export const FALLOS = { ventana: 10 * 60e3, max: 10, bloqueo: 15 * 60e3, blobDesde: 3 };
const fallosMem = new Map(); // huella de la IP → { v, c: [huellas de códigos], hasta }
// IP del móvil: en Vercel, la pone su red (x-vercel-forwarded-for / x-forwarded-for, que sobrescribe).
export function ipDe(req) {
  const h = req.headers || {};
  const v = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '';
  return String(v).split(',')[0].trim() || 'desconocida';
}
// IPv6: una persona suele tener una red /64 entera; se agrupa por sus 4 primeros bloques.
export function grupoIP(ip) {
  if (!ip.includes(':') || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) return ip.replace(/^::ffff:/i, '');
  const [a, b = ''] = ip.toLowerCase().split('%')[0].split('::');
  const izq = a ? a.split(':') : [], der = b ? b.split(':') : [];
  const todos = ip.includes('::') ? [...izq, ...Array(Math.max(0, 8 - izq.length - der.length)).fill('0'), ...der] : izq;
  return todos.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
const huella = ip => createHash('sha256').update('pipos-freno|' + grupoIP(ip)).digest('hex').slice(0, 32);
const huellaCodigo = c => createHash('sha256').update('pipos-freno-codigo|' + c).digest('hex').slice(0, 12);
const rutaFallos = h => `${prefijo()}frenos/codigo/${h}.json`;
const delaVentana = (x, v) => (x && +x.v === v && Array.isArray(x.c) ? x.c.filter(y => typeof y === 'string').slice(0, 50) : []);

// Decide la puerta: { bloqueada } y, con un código malo, lo apunta. `valido`: si el código es el bueno.
export async function frenoCodigo(req, valido, codigoProbado) {
  const h = huella(ipDe(req)), ahora = reloj(), v = Math.floor(ahora / FALLOS.ventana);
  const mem = fallosMem.get(h);
  if (mem && mem.hasta > ahora) return { bloqueada: true };
  if (valido) return { bloqueada: false }; // sin tocar el Blob
  const c = huellaCodigo(String(codigoProbado || ''));
  let lista = delaVentana(mem, v);
  if (!lista.includes(c)) lista = [...lista, c];
  let usarBlob = hayBlob() && lista.length >= FALLOS.blobDesde;
  if (usarBlob) {
    let rec = null;
    try { rec = await conTope(leerJSON(rutaFallos(h))); } catch (e) { avisar('no se pudo leer', e); usarBlob = false; }
    if (rec && +rec.hasta > ahora) { fallosMem.set(h, { v, c: lista, hasta: +rec.hasta }); return { bloqueada: true }; }
    for (const x of delaVentana(rec, v)) if (!lista.includes(x)) lista.push(x);
  }
  const nuevo = { v, c: lista.slice(-50), hasta: lista.length >= FALLOS.max ? ahora + FALLOS.bloqueo : 0 };
  if (fallosMem.size > 5000) fallosMem.clear(); // por si acaso: la memoria no crece sin fin
  fallosMem.set(h, nuevo);
  if (usarBlob) {
    try { await conTope(escribirJSON(rutaFallos(h), nuevo)); } catch (e) { avisar('no se pudo apuntar', e); }
    if (Math.random() < 0.05) limpiar(`${prefijo()}frenos/codigo/`, ahora - FALLOS.bloqueo - FALLOS.ventana).catch(() => {});
  }
  return { bloqueada: false, recienBloqueada: !!nuevo.hasta };
}

// M2: si el Blob se cuelga, no se espera más de TOPE_BLOB_MS: se sigue con la memoria (falla abierto).
export const TOPE_BLOB_MS = 1500;
export function conTope(promesa, ms = TOPE_BLOB_MS) {
  let t;
  return Promise.race([promesa, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('el Blob tarda demasiado')), ms); if (t.unref) t.unref(); })]).finally(() => clearTimeout(t));
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
  const conBlob = hayBlob();
  if (conBlob) {
    try {
      const x = await conTope(leerJSON(rutaCupo(dia)));
      if (x) cuenta = { sesion: Math.max(mem.sesion, +x.sesion || 0), plan: Math.max(mem.plan, +x.plan || 0) };
    } catch (e) { avisar('no se pudo leer el cupo', e); }
  }
  if (cuenta[modo] >= cupoDe(modo)) { cupoMem.set(dia, cuenta); return false; }
  const nueva = { ...cuenta, [modo]: cuenta[modo] + 1 };
  cupoMem.clear(); cupoMem.set(dia, nueva); // solo el día de hoy
  if (conBlob) {
    try { await conTope(escribirJSON(rutaCupo(dia), nueva)); } catch (e) { avisar('no se pudo apuntar el cupo', e); }
    if (cuenta.sesion + cuenta.plan === 0) limpiar(`${prefijo()}frenos/ia/`, Date.parse(dia)).catch(() => {});
  }
  return true;
}
// Devuelve una llamada al cupo: la IA falló antes de responder (saturada, sin conexión, cancelada…), así que no
// ha costado nada que contar.
export async function devolverCupo(modo) {
  const dia = new Date(reloj()).toISOString().slice(0, 10);
  const mem = cupoMem.get(dia);
  if (mem && mem[modo] > 0) mem[modo]--;
  if (!hayBlob()) return;
  try {
    const x = await conTope(leerJSON(rutaCupo(dia)));
    if (x && +x[modo] > 0) await conTope(escribirJSON(rutaCupo(dia), { sesion: +x.sesion || 0, plan: +x.plan || 0, [modo]: +x[modo] - 1 }));
  } catch (e) { avisar('no se pudo devolver el cupo', e); }
}
// Hora (ISO) a la que vuelve el cupo: el principio del día UTC siguiente.
export const vuelveCupo = () => { const d = new Date(reloj()); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString(); };

// Borra los contadores de antes de `antesDe` (ms). El SDK de Blob no tiene caducidad.
async function limpiar(prefix, antesDe) {
  const r = await blob().list({ prefix, limit: 1000 });
  const viejos = (r.blobs || []).filter(b => b.uploadedAt && new Date(b.uploadedAt).getTime() < antesDe).map(b => b.pathname);
  if (viejos.length) await blob().del(viejos);
}

// Solo para pruebas.
export function reiniciarFrenos() { fallosMem.clear(); cupoMem.clear(); }
