// Copias automáticas en la nube (PR 4b, decisiones D14 y D15 del plan v2).
// Un almacén Vercel Blob PRIVADO para los dos: copias/<persona>/<fecha>_k<sal>_m<metadatos cifrados>.bin
// Lo que llega ya va cifrado en el móvil (AES-GCM con una clave que sale de la frase de cada persona,
// ver js/nucleo/copia.js). Aquí solo se ve: bytes cifrados, su tamaño, la fecha de subida y la sal (pública)
// con la que se derivó la clave. El nº de sesiones y el día de la última van en el nombre CIFRADOS con la
// clave de la persona (base64url), para que el móvil enseñe la lista sin bajar cada copia.
// Las copias de la primera versión (nombre …_s<n>_u<día>.bin, con esos dos datos en claro) se siguen leyendo.
//
// POST /api/copia, siempre con la cabecera x-app-code (la misma puerta que el entrenador, ver _comun.js):
// - subir: cuerpo application/octet-stream (los bytes cifrados, como mucho LIMITE_COPIA) y cabeceras
//   x-copia-accion: subir, x-copia-persona, x-copia-sal (la de la cabecera del archivo, base64url) y
//   x-copia-meta (metadatos cifrados, base64url). Se manda en binario y no en base64 dentro de JSON: el cuerpo
//   de una función de Vercel no puede pasar de 4,5 MB (la plataforma corta antes con su propio 413) y el base64
//   lo infla un 33 %. Por eso el límite propio es de 4 MiB (para dar un 413 nuestro, en español) y no los 5 MB
//   del plan; una copia real comprimida y cifrada ocupa del orden de 0,05-0,3 MB. Tras subir se aplica la retención.
// - listar, bajar, borrar-viejas: cuerpo JSON { accion, persona, nombre? } (límites de comprobar()).
//   bajar responde con los bytes cifrados (application/octet-stream).
// Sin credenciales del Blob (el almacén aún no está creado o conectado) responde 503 y la app lo enseña.
import { puerta, tipoDe, largoAdmitido, leerJSON, LIMITE_CUERPO } from './_comun.js';
import * as blobReal from '@vercel/blob';

export const LIMITE_COPIA = 4 * 1024 * 1024; // bytes del archivo cifrado
export const PERSONAS = ['victor', 'virginia'];
export const MAGIA = 'PIPC'; // primeros bytes de un archivo de copia (js/nucleo/copia.js)
export const SUBIDAS_DIA = 30; // por persona y día (UTC)
const ACCIONES = ['subir', 'listar', 'bajar', 'borrar-viejas'];
const FECHA = '(\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.\\d{3}Z)';
const NOMBRE_V2 = new RegExp(`^copias\\/(victor|virginia)\\/${FECHA}_k([A-Za-z0-9_-]{22})_m([A-Za-z0-9_-]{40,200})\\.bin$`);
const NOMBRE_V1 = new RegExp(`^copias\\/(victor|virginia)\\/${FECHA}_s(\\d{1,6})_u(\\d{4}-\\d{2}-\\d{2}|-)\\.bin$`);
const SAL = /^[A-Za-z0-9_-]{22}$/, META = /^[A-Za-z0-9_-]{40,200}$/;
const MAX_LISTA = 400; // copias que se enseñan por persona (con la retención quedan unas 60-90)

// ── Almacén ──
// El real es @vercel/blob; las pruebas ponen uno simulado con la misma forma (put, list, get, del).
let almacen = null;
export function ponerAlmacen(a) { almacen = a; }
// Reloj (las pruebas lo cambian para simular días y horas).
let reloj = () => Date.now();
export function ponerReloj(f) { reloj = typeof f === 'function' ? f : () => Date.now(); }
const blob = () => almacen || blobReal;
// ¿Hay credenciales del Blob? Al conectar el almacén al proyecto, Vercel pone BLOB_READ_WRITE_TOKEN
// (o BLOB_STORE_ID, y el token OIDC lo da la propia función).
const hayCredenciales = () => !!almacen || !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const NO_ACTIVADA = 'las copias en la nube aún no están activadas';

// ── Ritmo de peticiones ──
// En memoria, por instancia (Fluid Compute reparte entre pocas instancias y dos personas hacen pocas
// peticiones): un freno contra un móvil en bucle, no una barrera exacta. Ventana de 10 minutos por persona.
// Además, un tope de SUBIDAS_DIA subidas al día por persona con un contador en el propio Blob (ver subir).
const RITMO = { ventana: 10 * 60e3, todas: 60, subir: 20 };
const historial = new Map();
export function reiniciarRitmo() { historial.clear(); ultimoSello = 0; }
function dentroDeRitmo(persona, accion, ahora = reloj()) {
  const lista = (historial.get(persona) || []).filter(x => ahora - x.t < RITMO.ventana);
  const subidas = lista.filter(x => x.accion === 'subir').length;
  if (lista.length >= RITMO.todas || (accion === 'subir' && subidas >= RITMO.subir)) { historial.set(persona, lista); return false; }
  lista.push({ t: ahora, accion });
  historial.set(persona, lista);
  return true;
}

// ── Nombres ──
// ISO con guiones en la hora (los «:» no van bien en URL y rutas).
let ultimoSello = 0;
export const sello = d => d.toISOString().replace(/:/g, '-');
export function nombreCopia(persona, fecha, sal, meta) {
  return `copias/${persona}/${sello(fecha)}_k${sal}_m${meta}.bin`;
}
// Solo para leer (y para pruebas): el nombre de la primera versión, con sesiones y última en claro.
export function nombreCopiaV1(persona, fecha, sesiones, ultima) {
  return `copias/${persona}/${sello(fecha)}_s${sesiones}_u${ultima || '-'}.bin`;
}
const fechaDe = s => { const t = Date.parse(s.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3')); return Number.isNaN(t) ? null : new Date(t).toISOString(); };
export function leerNombre(pathname) {
  const p = String(pathname || '');
  let m = NOMBRE_V2.exec(p);
  if (m) { const fecha = fechaDe(m[2]); return fecha && { nombre: p, persona: m[1], fecha, sal: m[3], meta: m[4] }; }
  m = NOMBRE_V1.exec(p);
  if (m) { const fecha = fechaDe(m[2]); return fecha && { nombre: p, persona: m[1], fecha, sesiones: +m[3], ultima: m[4] === '-' ? null : m[4] }; }
  return null;
}

// ── Retención ──
// Se quedan: de los últimos 14 días, la más nueva de cada hora y como mucho las 10 más nuevas de cada día;
// de hace 14 días a 3 meses, la más nueva de cada semana; de hace 3 meses a 2 años, la más nueva de cada mes;
// ninguna de más de 2 años. La más nueva de todas se queda siempre (aunque sea vieja: es lo único que hay).
// Horas, días, semanas y meses en UTC. El SDK de Blob no tiene caducidad nativa, así que se limpia aquí al
// subir (y con la acción borrar-viejas). Devuelve los nombres que sobran.
const DIA = 864e5;
export const RETENCION = { diario: 14, porDia: 10, semanal: 92, mensual: 730 }; // días (porDia: copias)
function semanaISO(t) {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // el jueves de esa semana decide el año
  const año = d.getUTCFullYear();
  return `${año}-${1 + Math.floor((d - Date.UTC(año, 0, 1)) / (7 * DIA))}`;
}
export function sobrantes(copias, ahora = reloj()) {
  const lista = copias.map(c => ({ ...c, t: Date.parse(c.fecha) })).filter(c => !Number.isNaN(c.t)).sort((a, b) => b.t - a.t);
  const quedan = new Set(), vistos = new Set(), porDia = new Map();
  lista.forEach((c, i) => {
    const edad = (ahora - c.t) / DIA;
    const iso = new Date(c.t).toISOString();
    if (i === 0) { quedan.add(c.nombre); vistos.add('h' + iso.slice(0, 13)); porDia.set(iso.slice(0, 10), 1); return; }
    if (edad <= RETENCION.diario) {
      const hora = 'h' + iso.slice(0, 13), dia = iso.slice(0, 10);
      if (vistos.has(hora) || (porDia.get(dia) || 0) >= RETENCION.porDia) return;
      vistos.add(hora); porDia.set(dia, (porDia.get(dia) || 0) + 1); quedan.add(c.nombre);
      return;
    }
    let cubo = null;
    if (edad <= RETENCION.semanal) cubo = 'w' + semanaISO(c.t);
    else if (edad <= RETENCION.mensual) cubo = 'm' + iso.slice(0, 7);
    if (cubo && !vistos.has(cubo)) { vistos.add(cubo); quedan.add(c.nombre); }
  });
  return lista.filter(c => !quedan.has(c.nombre)).map(c => c.nombre);
}

async function listarPrefijo(prefix) {
  const out = [];
  let cursor;
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const r = await blob().list({ prefix, limit: 1000, cursor });
    out.push(...(r.blobs || []));
    if (!r.hasMore || !r.cursor) break;
    cursor = r.cursor;
  }
  return out;
}
async function listarPersona(persona) {
  const copias = [];
  for (const b of await listarPrefijo(`copias/${persona}/`)) {
    const c = leerNombre(b.pathname);
    if (c && c.persona === persona) copias.push({ ...c, bytes: +b.size || 0 });
  }
  return copias.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
async function aplicarRetencion(persona, ahora) {
  const copias = await listarPersona(persona);
  const fuera = sobrantes(copias, ahora);
  // Contadores de días anteriores (ver contadorHoy).
  const hoy = new Date(ahora).toISOString().slice(0, 10);
  const contadores = (await listarPrefijo(`cuentas/${persona}/`)).map(b => b.pathname).filter(p => !p.endsWith(`/${hoy}.json`));
  if (fuera.length || contadores.length) await blob().del([...fuera, ...contadores]);
  return fuera.length;
}

// Subidas de hoy de una persona: un contador en el Blob (cuentas/<persona>/<día>.json), porque la retención
// deja menos copias de las que se suben y la memoria de una instancia no dura. Dos subidas a la vez pueden
// contar una sola: es un tope aproximado contra un móvil en bucle.
const rutaContador = (persona, ahora) => `cuentas/${persona}/${new Date(ahora).toISOString().slice(0, 10)}.json`;
async function contadorHoy(persona, ahora) {
  const r = await blob().get(rutaContador(persona, ahora), { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return 0;
  try { const n = JSON.parse((await aBuffer(r.stream, 1024)).toString('utf8')).n; return Number.isInteger(n) && n >= 0 ? n : 0; } catch { return 0; }
}
const ponerContador = (persona, ahora, n) => blob().put(rutaContador(persona, ahora), JSON.stringify({ n }),
  { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });

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
// Para el registro, solo el tipo de error (nunca su mensaje: podría llevar rutas o fragmentos de token).
const tipoError = e => (e && e.constructor && e.constructor.name && e.constructor.name !== 'Error' ? e.constructor.name : (e && e.name) || 'desconocido');

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
      const sal = String(req.headers['x-copia-sal'] || ''), meta = String(req.headers['x-copia-meta'] || '');
      // Solo se acepta lo que tiene forma de copia cifrada (cabecera propia, con la misma sal que se declara):
      // nunca un JSON en claro por error.
      if (datos.length < 64 || datos.subarray(0, 4).toString('latin1') !== MAGIA) return fin(400, { error: 'no es una copia cifrada' });
      if (!SAL.test(sal) || !META.test(meta) || datos.subarray(11, 27).toString('base64url') !== sal) return fin(400, { error: 'faltan los datos de la copia' });
      // Fecha siempre creciente en esta instancia: dos subidas en el mismo milisegundo no chocan.
      const ahora = new Date(Math.max(reloj(), ultimoSello + 1));
      ultimoSello = ahora.getTime();
      const hechas = await contadorHoy(persona, ahora.getTime());
      if (hechas >= SUBIDAS_DIA) return fin(429, { error: 'ya se han hecho muchas copias hoy; la siguiente, mañana' });
      const nombre = nombreCopia(persona, ahora, sal, meta);
      await blob().put(nombre, datos, { access: 'private', contentType: 'application/octet-stream', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 });
      try { await ponerContador(persona, ahora.getTime(), hechas + 1); } catch (e) { console.error('copia: no se pudo apuntar el contador', tipoError(e)); }
      let borradas = 0;
      try { borradas = await aplicarRetencion(persona, ahora.getTime()); } catch (e) { console.error('copia: no se pudo aplicar la retención', tipoError(e)); }
      registro.borradas = borradas;
      const { nombre: n, fecha } = leerNombre(nombre);
      return fin(200, { ok: true, copia: { nombre: n, fecha }, borradas });
    }
    if (accion === 'listar') {
      const copias = (await listarPersona(persona)).slice(0, MAX_LISTA).map(c => { const x = { ...c }; delete x.persona; return x; });
      registro.n = copias.length;
      return fin(200, { copias });
    }
    if (accion === 'borrar-viejas') {
      const borradas = await aplicarRetencion(persona, reloj());
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
    console.error('copia: error del Blob', JSON.stringify({ accion: registro.accion, tipo: tipoError(e) }));
    return fin(status, status === 503 ? { error, activada: false } : { error });
  }
}
