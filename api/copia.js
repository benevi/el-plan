// Copias automáticas en la nube (PR 4b, decisiones D14 y D15 del plan v2).
// Un almacén Vercel Blob PRIVADO para los dos: copias/<persona>/<fecha>_s<sesiones>_u<última>.bin
// Lo que llega ya va cifrado en el móvil (AES-GCM con una clave que sale de la frase de cada persona,
// ver js/nucleo/copia.js): aquí solo se ven bytes cifrados, su tamaño, su fecha y dos datos no sensibles
// que manda el móvil para poder enseñar la lista sin descifrar (nº de sesiones hechas y día de la última).
//
// POST /api/copia, siempre con la cabecera x-app-code (la misma puerta que el entrenador, ver _comun.js):
// - subir: cuerpo application/octet-stream (los bytes cifrados, como mucho LIMITE_COPIA) y cabeceras
//   x-copia-accion: subir, x-copia-persona, x-copia-sesiones, x-copia-ultima (AAAA-MM-DD o vacío).
//   Se manda en binario y no en base64 dentro de JSON: el cuerpo de una función de Vercel no puede pasar
//   de 4,5 MB (la plataforma corta antes con su propio 413) y el base64 lo infla un 33 %. Por eso el límite
//   propio es de 4 MiB (por debajo del de Vercel, para dar un 413 nuestro, en español) y no los 5 MB del plan;
//   una copia real comprimida y cifrada ocupa del orden de 0,05-0,3 MB. Tras subir se aplica la retención.
// - listar, bajar, borrar-viejas: cuerpo JSON { accion, persona, nombre? } (límites de comprobar()).
//   bajar responde con los bytes cifrados (application/octet-stream).
// Sin credenciales del Blob (el almacén aún no está creado o conectado) responde 503 y la app lo enseña.
import { puerta, tipoDe, largoAdmitido, leerJSON, LIMITE_CUERPO } from './_comun.js';
import * as blobReal from '@vercel/blob';

export const LIMITE_COPIA = 4 * 1024 * 1024; // bytes del archivo cifrado
export const PERSONAS = ['victor', 'virginia'];
export const MAGIA = 'PIPC'; // primeros bytes de un archivo de copia (js/nucleo/copia.js)
const ACCIONES = ['subir', 'listar', 'bajar', 'borrar-viejas'];
const NOMBRE = /^copias\/(victor|virginia)\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)_s(\d{1,6})_u(\d{4}-\d{2}-\d{2}|-)\.bin$/;
const MAX_LISTA = 400; // copias que se enseñan por persona (con la retención quedan unas 40-60)

// ── Almacén ──
// El real es @vercel/blob; las pruebas ponen uno simulado con la misma forma (put, list, get, del).
let almacen = null;
export function ponerAlmacen(a) { almacen = a; }
const blob = () => almacen || blobReal;
// ¿Hay credenciales del Blob? Al conectar el almacén al proyecto, Vercel pone BLOB_READ_WRITE_TOKEN
// (o BLOB_STORE_ID, y el token OIDC lo da la propia función).
const hayCredenciales = () => !!almacen || !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const NO_ACTIVADA = 'las copias en la nube aún no están activadas';

// ── Ritmo de peticiones ──
// Por instancia (Fluid Compute reparte entre pocas instancias y dos personas hacen pocas peticiones):
// es un freno contra un móvil en bucle, no una barrera exacta. Ventana de 10 minutos por persona.
const RITMO = { ventana: 10 * 60e3, todas: 60, subir: 20 };
const historial = new Map();
export function reiniciarRitmo() { historial.clear(); }
function dentroDeRitmo(persona, accion, ahora = Date.now()) {
  const k = persona;
  const lista = (historial.get(k) || []).filter(x => ahora - x.t < RITMO.ventana);
  const subidas = lista.filter(x => x.accion === 'subir').length;
  if (lista.length >= RITMO.todas || (accion === 'subir' && subidas >= RITMO.subir)) { historial.set(k, lista); return false; }
  lista.push({ t: ahora, accion });
  historial.set(k, lista);
  return true;
}

// ── Nombres ──
// ISO con guiones en la hora (los «:» no van bien en URL y rutas).
let ultimoSello = 0;
export const sello = d => d.toISOString().replace(/:/g, '-');
export function nombreCopia(persona, fecha, sesiones, ultima) {
  return `copias/${persona}/${sello(fecha)}_s${sesiones}_u${ultima || '-'}.bin`;
}
export function leerNombre(pathname) {
  const m = NOMBRE.exec(String(pathname || ''));
  if (!m) return null;
  const iso = m[2].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return { nombre: pathname, persona: m[1], fecha: new Date(t).toISOString(), sesiones: +m[3], ultima: m[4] === '-' ? null : m[4] };
}

// ── Retención ──
// Se quedan: todas las de los últimos 14 días; de las de hace 14 días a 3 meses, la más nueva de cada semana;
// de las de hace 3 meses a 2 años, la más nueva de cada mes; ninguna de más de 2 años. La más nueva de
// todas se queda siempre (aunque sea vieja: es lo único que hay). El SDK de Blob no tiene caducidad nativa,
// así que se limpia aquí al subir (y con la acción borrar-viejas). Devuelve los nombres que sobran.
const DIA = 864e5;
export const RETENCION = { diario: 14, semanal: 92, mensual: 730 }; // días
function semanaISO(t) {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // el jueves de esa semana decide el año
  const año = d.getUTCFullYear();
  return `${año}-${1 + Math.floor((d - Date.UTC(año, 0, 1)) / (7 * DIA))}`;
}
export function sobrantes(copias, ahora = Date.now()) {
  const lista = copias.map(c => ({ ...c, t: Date.parse(c.fecha) })).filter(c => !Number.isNaN(c.t)).sort((a, b) => b.t - a.t);
  const quedan = new Set(), vistos = new Set();
  lista.forEach((c, i) => {
    const edad = (ahora - c.t) / DIA;
    let cubo = null;
    if (i === 0 || edad <= RETENCION.diario) { quedan.add(c.nombre); return; }
    if (edad <= RETENCION.semanal) cubo = 'w' + semanaISO(c.t);
    else if (edad <= RETENCION.mensual) cubo = 'm' + new Date(c.t).toISOString().slice(0, 7);
    if (cubo && !vistos.has(cubo)) { vistos.add(cubo); quedan.add(c.nombre); }
  });
  return lista.filter(c => !quedan.has(c.nombre)).map(c => c.nombre);
}

async function listarPersona(persona) {
  const copias = [];
  let cursor;
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const r = await blob().list({ prefix: `copias/${persona}/`, limit: 1000, cursor });
    for (const b of r.blobs || []) {
      const c = leerNombre(b.pathname);
      if (c && c.persona === persona) copias.push({ ...c, bytes: +b.size || 0, url: b.url });
    }
    if (!r.hasMore || !r.cursor) break;
    cursor = r.cursor;
  }
  return copias.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
async function aplicarRetencion(persona, ahora) {
  const copias = await listarPersona(persona);
  const fuera = sobrantes(copias, ahora);
  if (fuera.length) await blob().del(fuera);
  return fuera.length;
}

// Lee el cuerpo binario: en Vercel req.body ya es un Buffer para application/octet-stream; si no (otro
// servidor), se lee del flujo cortando al pasar del límite. Devuelve el Buffer o null si es demasiado grande.
async function leerBinario(req, limite) {
  let b;
  try { b = req.body; } catch { b = undefined; }
  if (Buffer.isBuffer(b)) return b.length > limite ? null : b;
  if (b instanceof Uint8Array) return b.length > limite ? null : Buffer.from(b);
  if (typeof req.on !== 'function' || req.readableEnded) return Buffer.alloc(0);
  return new Promise((res, rej) => {
    const trozos = []; let n = 0, pasado = false;
    req.on('data', t => { if (pasado) return; n += t.length; if (n > limite) { pasado = true; res(null); return; } trozos.push(t); });
    req.on('end', () => { if (!pasado) res(Buffer.concat(trozos)); });
    req.on('error', rej);
  });
}
async function aBuffer(stream, limite) {
  const lector = stream.getReader(); const trozos = []; let n = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    n += value.length;
    if (n > limite) { try { await lector.cancel(); } catch { /* nada */ } throw new Error('copia demasiado grande'); }
    trozos.push(Buffer.from(value));
  }
  return Buffer.concat(trozos);
}

function errorBlob(e) {
  const B = blobReal;
  if (e instanceof B.BlobStoreNotFoundError || e instanceof B.BlobStoreSuspendedError || e instanceof B.BlobAccessError
    || (e instanceof B.BlobError && /credentials|read-write token|storeId/i.test(String(e.message)))) return [503, NO_ACTIVADA];
  if (e instanceof B.BlobServiceRateLimited) return [429, 'demasiadas peticiones a la nube, prueba en un rato'];
  return [502, 'la nube no responde ahora, prueba en un rato'];
}

export default async function handler(req, res) {
  const inicio = Date.now();
  const registro = {};
  const fin = (status, cuerpo) => {
    registro.resultado = status; registro.ms = Date.now() - inicio;
    console.log(JSON.stringify({ copia: registro })); // una línea, sin contenido ni nombres de persona
    if (cuerpo !== undefined) res.status(status).json(cuerpo);
  };
  if (!puerta(req, res)) return; // 405, 500 o 401, como el entrenador
  const tipo = tipoDe(req);
  let accion, persona, cuerpo = null;
  if (tipo === 'application/octet-stream') {
    accion = String(req.headers['x-copia-accion'] || '');
    persona = String(req.headers['x-copia-persona'] || '');
    if (accion !== 'subir') return fin(400, { error: 'petición mal formada' });
    if (!largoAdmitido(req, res, LIMITE_COPIA)) return fin('rechazada');
  } else if (tipo === 'application/json') {
    if (!largoAdmitido(req, res, LIMITE_CUERPO)) return fin('rechazada');
    cuerpo = leerJSON(req, res, LIMITE_CUERPO);
    if (!cuerpo) return fin('rechazada');
    accion = String(cuerpo.accion || ''); persona = String(cuerpo.persona || '');
    if (accion === 'subir') return fin(415, { error: 'la copia se sube en binario (application/octet-stream)' });
  } else return fin(415, { error: 'tipo de petición no admitido' });
  registro.accion = ACCIONES.includes(accion) ? accion : 'otra';
  if (!ACCIONES.includes(accion)) return fin(400, { error: 'acción desconocida' });
  if (!PERSONAS.includes(persona)) return fin(400, { error: 'persona no válida' });
  if (!hayCredenciales()) { console.error('copia: faltan las credenciales del Blob'); return fin(503, { error: NO_ACTIVADA, activada: false }); }
  if (!dentroDeRitmo(persona, accion)) return fin(429, { error: 'demasiadas copias seguidas, prueba en unos minutos' });

  try {
    if (accion === 'subir') {
      const datos = await leerBinario(req, LIMITE_COPIA);
      if (!datos) return fin(413, { error: 'la copia es demasiado grande' });
      registro.bytes = datos.length;
      // Solo se acepta lo que tiene forma de copia cifrada (cabecera propia): nunca un JSON en claro por error.
      if (datos.length < 64 || datos.subarray(0, 4).toString('latin1') !== MAGIA) return fin(400, { error: 'no es una copia cifrada' });
      const sesiones = Math.max(0, Math.min(999999, parseInt(req.headers['x-copia-sesiones'], 10) || 0));
      const u = String(req.headers['x-copia-ultima'] || '');
      const ultima = /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : null;
      // Fecha siempre creciente en esta instancia: dos subidas en el mismo milisegundo no chocan.
      const ahora = new Date(Math.max(Date.now(), ultimoSello + 1));
      ultimoSello = ahora.getTime();
      const nombre = nombreCopia(persona, ahora, sesiones, ultima);
      await blob().put(nombre, datos, { access: 'private', contentType: 'application/octet-stream', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 });
      let borradas = 0;
      try { borradas = await aplicarRetencion(persona, ahora.getTime()); } catch (e) { console.error('copia: no se pudo aplicar la retención', e && e.name); }
      registro.borradas = borradas;
      return fin(200, { ok: true, copia: leerNombre(nombre), borradas });
    }
    if (accion === 'listar') {
      const copias = (await listarPersona(persona)).slice(0, MAX_LISTA).map(({ nombre, fecha, sesiones, ultima, bytes }) => ({ nombre, fecha, sesiones, ultima, bytes }));
      registro.n = copias.length;
      return fin(200, { copias });
    }
    if (accion === 'borrar-viejas') {
      const borradas = await aplicarRetencion(persona, Date.now());
      registro.borradas = borradas;
      return fin(200, { ok: true, borradas });
    }
    // bajar
    const c = leerNombre(cuerpo.nombre);
    if (!c || c.persona !== persona) return fin(400, { error: 'copia no válida' });
    const r = await blob().get(c.nombre, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return fin(404, { error: 'esa copia ya no está' });
    const datos = await aBuffer(r.stream, LIMITE_COPIA);
    registro.bytes = datos.length;
    registro.resultado = 200; registro.ms = Date.now() - inicio;
    console.log(JSON.stringify({ copia: registro }));
    res.status(200);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(datos.length));
    res.end(datos);
  } catch (e) {
    const [status, error] = errorBlob(e);
    console.error('copia: error del Blob', JSON.stringify({ accion: registro.accion, tipo: e && e.name }), String((e && e.message) || '').slice(0, 300));
    return fin(status, status === 503 ? { error, activada: false } : { error });
  }
}
