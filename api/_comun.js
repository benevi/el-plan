// Utilidades de las funciones del servidor. Los archivos de /api que empiezan por _ no son rutas.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria para la IA) y APP_CODE (código de acceso,
// obligatorio: sin él el servidor no atiende a nadie). Las copias en la nube (api/copia.js) usan además el
// almacén Blob conectado al proyecto (BLOB_READ_WRITE_TOKEN, o BLOB_STORE_ID con OIDC).
import { createHash, timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';

export { Anthropic };
export const MODELO = 'claude-opus-5-5';
export const LIMITE_CUERPO = 150 * 1024; // bytes

// ── Cliente de la IA ──
// Se crea la primera vez que hace falta (así un fallo de configuración no tumba el módulo entero)
// y las pruebas pueden sustituirlo por uno simulado con ponerClienteIA().
let cliente = null;
export function clienteIA() {
  if (!cliente) cliente = new Anthropic();
  return cliente;
}
export function ponerClienteIA(c) { cliente = c; }

// Errores propios con una categoría fija; el mensaje al móvil sale siempre de MENSAJES.
export class ErrorIA extends Error {
  constructor(categoria, detalle = '') { super(detalle || categoria); this.name = 'ErrorIA'; this.categoria = categoria; }
}

// ── Puerta de entrada ──
const resumen = v => createHash('sha256').update(String(v)).digest();
function codigoValido(dado, esperado) {
  // Se comparan los SHA-256 (misma longitud siempre) en tiempo constante.
  return timingSafeEqual(resumen(typeof dado === 'string' ? dado : ''), resumen(esperado));
}

// Puerta común a todas las funciones: método POST, APP_CODE configurado y código correcto (en tiempo constante).
// Devuelve true si se puede seguir; si no, ya ha respondido (405, 500 o 401). Siempre deja `no-store`.
export function puerta(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Usa POST' }); return false; }
  const codigo = process.env.APP_CODE;
  if (!codigo) { console.error('servidor: falta APP_CODE'); res.status(500).json({ error: 'el servidor no está configurado' }); return false; }
  if (!codigoValido(req.headers['x-app-code'], codigo)) { res.status(401).json({ error: 'código de acceso incorrecto' }); return false; }
  return true;
}
export const tipoDe = req => String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
// Si la cabecera Content-Length ya pasa del límite, responde 413 (sin leer el cuerpo) y devuelve false.
export function largoAdmitido(req, res, limite) {
  const largo = Number(req.headers['content-length']);
  if (Number.isFinite(largo) && largo > limite) { res.status(413).json({ error: 'la petición es demasiado grande' }); return false; }
  return true;
}
// El cuerpo JSON ya parseado (objeto) y de como mucho `limite` bytes, o null si ya ha respondido (400 o 413).
export function leerJSON(req, res, limite = LIMITE_CUERPO) {
  let cuerpo;
  try {
    cuerpo = req.body; // en Vercel es un getter que parsea el JSON y lanza si está mal formado
    if (typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo)) cuerpo = JSON.parse(String(cuerpo));
  } catch (e) { res.status(400).json({ error: 'petición mal formada' }); return null; }
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) { res.status(400).json({ error: 'petición mal formada' }); return null; }
  let tam;
  try { tam = Buffer.byteLength(JSON.stringify(cuerpo)); } catch (e) { res.status(400).json({ error: 'petición mal formada' }); return null; } // p. ej. anidado sin fin
  if (tam > limite) { res.status(413).json({ error: 'la petición es demasiado grande' }); return null; }
  return cuerpo;
}

// Comprueba método, código, tipo y tamaño (para el entrenador). Devuelve el cuerpo ya parseado (objeto) o null si ya ha respondido.
export function comprobar(req, res) {
  if (!puerta(req, res)) return null;
  if (tipoDe(req) !== 'application/json') { res.status(415).json({ error: 'la petición tiene que ser JSON' }); return null; }
  if (!largoAdmitido(req, res, LIMITE_CUERPO)) return null;
  if (!process.env.ANTHROPIC_API_KEY) { console.error('servidor: falta ANTHROPIC_API_KEY'); res.status(500).json({ error: 'el servidor no está configurado' }); return null; }
  return leerJSON(req, res, LIMITE_CUERPO);
}

// ── Saneado del cuerpo ──
// Solo pasan las claves que usa el servidor; textos, listas y profundidad acotados. Con los datos que
// arma el móvil (js/reglas/contexto.js y peticionBase en js/areas/entrenador/ia.js) no cambia nada:
// lo comprueba tests/api/saneado.test.mjs.
export const CLAVES = ['modo', 'perfil', 'lesiones', 'historial', 'analisis', 'hoy', 'diaSemana', 'catalogo', 'checkin', 'planDeHoy', 'ajusteReglas', 'semana'];
// Los textos libres pueden contar algo de seguridad (dolor, molestias): límites holgados, el tope de
// 150 KB del cuerpo es la barrera. «comentariosEjercicios» lleva «Nombre del ejercicio: comentario».
// Es un Map para que claves como «valueOf» o «toString» no encuentren nada heredado.
const LARGO_POR_CLAVE = new Map([['nota', 4000], ['notas', 4000], ['comentario', 2000], ['comentarios', 2000], ['peticion', 2000], ['texto', 2000], ['comentariosEjercicios', 2400]]);
const LARGO = 500, MAX_LISTA = 60, MAX_CLAVES = 80, MAX_PROFUNDIDAD = 8, MAX_CATALOGO = 200;
const ID = /^[\w-]{1,60}$/;
const PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

function recortar(s, max) {
  if (s.length <= max) return s;
  let r = s.slice(0, max);
  const u = r.charCodeAt(r.length - 1);
  if (u >= 0xd800 && u <= 0xdbff) r = r.slice(0, -1); // no dejar medio emoji
  return r;
}
function limpiar(v, clave, prof) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return recortar(v, LARGO_POR_CLAVE.get(clave) || LARGO);
  if (prof >= MAX_PROFUNDIDAD || typeof v !== 'object') return undefined;
  if (Array.isArray(v)) return v.slice(0, MAX_LISTA).map(x => limpiar(x, clave, prof + 1)).filter(x => x !== undefined);
  const out = {};
  for (const k of Object.keys(v).slice(0, MAX_CLAVES)) {
    if (PROHIBIDAS.has(k) || k.length > 60) continue;
    const x = limpiar(v[k], k, prof + 1);
    if (x !== undefined) out[k] = x;
  }
  return out;
}
const textos = (a, n, max) => Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, n).map(x => recortar(x, max)) : [];
function limpiarEjercicio(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID.test(e.id)) return null;
  const x = { id: e.id };
  if ('m' in e) x.m = textos(e.m, 20, 60);
  if ('l' in e) x.l = textos(e.l, 10, 30);
  if ('niv' in e) x.niv = Number.isFinite(e.niv) ? e.niv : null;
  if (typeof e.t === 'string') x.t = recortar(e.t, 20);
  if (typeof e.tipo === 'string') x.tipo = recortar(e.tipo, 20);
  if (typeof e.prec === 'string') x.prec = recortar(e.prec, 200);
  if (typeof e.gusto === 'string') x.gusto = recortar(e.gusto, 30);
  return x;
}

// Devuelve { cuerpo, catalogoDescartados }.
export function sanear(crudo) {
  const cuerpo = {};
  for (const k of CLAVES) {
    if (k === 'catalogo' || crudo[k] === undefined) continue;
    const v = limpiar(crudo[k], k, 1);
    if (v !== undefined) cuerpo[k] = v;
  }
  const lista = Array.isArray(crudo.catalogo) ? crudo.catalogo : [];
  cuerpo.catalogo = lista.map(limpiarEjercicio).filter(Boolean).slice(0, MAX_CATALOGO);
  return { cuerpo, catalogoDescartados: lista.length - cuerpo.catalogo.length };
}

// ── Llamada a Claude ──
// Pide una respuesta JSON que cumple `esquema`. En streaming para que las respuestas largas
// (el plan de la semana) no choquen con los límites de tiempo de una petición normal.
// `signal` corta la llamada si el móvil se va; `registro` recoge lo que se apunta en el log.
// `modelo`: solo para las pruebas de scripts/casos-ia.mjs (lista cerrada en entrenador.js); si no, MODELO.
export async function pedirJSON(client, { sistema, usuario, esquema, esfuerzo = 'low', maxTokens = 16000, modelo = MODELO, signal, registro = {} }) {
  const msg = await client.beta.messages.stream({
    model: modelo,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    system: sistema,
    messages: [{ role: 'user', content: usuario }],
  }, { signal }).finalMessage();
  Object.assign(registro, { id: msg.id, modelo: msg.model, stop_reason: msg.stop_reason }, uso(msg.usage));
  // Solo vale una respuesta terminada (end_turn): max_tokens, pause_turn, tool_use… se tratan como incompletas.
  if (msg.stop_reason === 'refusal') throw new ErrorIA('negativa');
  if (msg.stop_reason === 'max_tokens') throw new ErrorIA('incompleta', 'stop_reason max_tokens');
  if (msg.stop_reason !== 'end_turn') throw new ErrorIA('incompleta', 'stop_reason ' + msg.stop_reason);
  const bloques = Array.isArray(msg.content) ? msg.content : [];
  const textoDe = lista => lista.filter(b => b && b.type === 'text').map(b => b.text).join('');
  const ultimoFallback = bloques.map(b => b && b.type).lastIndexOf('fallback');
  if (ultimoFallback >= 0) registro.fallback = true;
  // Con fallbacks:'default' el modelo de respaldo puede seguir el texto del primero (la unión es el JSON)
  // o empezarlo de nuevo (vale solo lo que hay tras el último bloque «fallback»).
  const candidatos = [textoDe(bloques)];
  if (ultimoFallback >= 0) candidatos.push(textoDe(bloques.slice(ultimoFallback + 1)));
  if (!candidatos[0].trim()) throw new ErrorIA('ilegible', 'contenido vacío');
  for (const texto of candidatos) {
    let datos;
    try { datos = JSON.parse(texto); } catch (e) { continue; }
    if (datos && typeof datos === 'object' && !Array.isArray(datos)) return datos;
  }
  throw new ErrorIA('ilegible', 'JSON no válido');
}

// Tokens de una respuesta para el registro: totales, caché y, si la API los da, los de cada iteración (el
// modelo pedido y, con un fallback, el de respaldo), para saber qué modelo respondió y cuánto costó cada uno.
export function uso(u) {
  if (!u || typeof u !== 'object') return {};
  const out = { entrada: u.input_tokens, salida: u.output_tokens };
  if (u.cache_read_input_tokens) out.cacheLeida = u.cache_read_input_tokens;
  if (u.cache_creation_input_tokens) out.cacheEscrita = u.cache_creation_input_tokens;
  if (Array.isArray(u.iterations) && u.iterations.length) {
    out.iteraciones = u.iterations.map(i => ({ tipo: i && i.type, modelo: (i && i.model) || undefined, entrada: i && i.input_tokens, salida: i && i.output_tokens }));
  }
  return out;
}

// ── Cancelación ──
// Si el móvil cierra la conexión antes de que respondamos, se aborta la llamada a Claude (deja de generar y de cobrar)
// y se llama a alCancelar una sola vez.
// Ojo: en Node 18+ req emite «close» en cuanto se ha leído el cuerpo aunque el móvil siga esperando
// (probado en Node 22), así que ese «close» solo cuenta si el cuerpo quedó a medias o el socket está cerrado.
export function cancelarAlCerrar(req, res, alCancelar = () => {}) {
  const ctrl = new AbortController();
  const cancelar = () => {
    if (ctrl.signal.aborted || res.writableFinished) return;
    ctrl.abort();
    try { alCancelar(); } catch (e) { console.error('cancelación', e); }
  };
  const alCerrarPeticion = () => { if (!req.complete || (req.socket && req.socket.destroyed)) cancelar(); };
  const oyentes = [[res, 'close', cancelar], [req, 'aborted', cancelar], [req, 'error', cancelar], [req, 'close', alCerrarPeticion]]
    .filter(([em]) => em && typeof em.on === 'function');
  oyentes.forEach(([em, ev, fn]) => em.on(ev, fn));
  return { signal: ctrl.signal, soltar: () => oyentes.forEach(([em, ev, fn]) => em.off(ev, fn)) };
}

// ── Errores ──
// Al móvil, solo un mensaje fijo por categoría; el detalle va al registro con console.error.
const MENSAJES = {
  clave: [502, 'la clave de la IA no es válida (revisa ANTHROPIC_API_KEY en Vercel)'],
  permiso: [502, 'la clave de la IA no tiene permiso para este modelo'],
  saldo: [502, 'la cuenta de la API de Claude no tiene saldo'],
  ritmo: [429, 'demasiadas peticiones, prueba en un minuto'],
  rechazada: [502, 'petición rechazada por la IA'],
  conexion: [502, 'el servidor no pudo conectar con la IA'],
  ilegible: [502, 'la IA devolvió una respuesta que no se pudo leer'],
  incompleta: [502, 'respuesta incompleta de la IA'],
  negativa: [422, 'la IA no ha querido responder a esto'],
  otro: [502, 'la IA no responde ahora, prueba en un rato'],
};
export function categoria(e) {
  if (e instanceof ErrorIA) return e.categoria;
  if (e instanceof Anthropic.APIUserAbortError || (e && e.name === 'AbortError')) return 'cancelada';
  if (e instanceof Anthropic.AuthenticationError) return 'clave';
  if (e instanceof Anthropic.PermissionDeniedError) return 'permiso';
  if (e instanceof Anthropic.PaymentRequiredError || (e && e.type === 'billing_error') || /credit balance/i.test(String(e && e.message))) return 'saldo';
  if (e instanceof Anthropic.RateLimitError) return 'ritmo';
  if (e instanceof Anthropic.BadRequestError) return 'rechazada';
  if (e instanceof Anthropic.APIConnectionError) return 'conexion';
  if (e instanceof SyntaxError) return 'ilegible';
  return 'otro';
}
// signal: la de cancelarAlCerrar. Solo se calla si la cancelación es nuestra o la respuesta ya no se puede escribir;
// un aborto que no sea nuestro es un error más y se responde con el mensaje genérico.
export function responderError(res, e, quien, signal) {
  let cat = categoria(e);
  console.error(quien + ': error de la IA', JSON.stringify({ categoria: cat, status: e && e.status, tipo: e && (e.type || e.name), peticion: e && e.requestID }), String((e && e.message) || '').slice(0, 2000));
  if ((signal && signal.aborted) || res.writableEnded || res.destroyed) return 'cancelada';
  if (cat === 'cancelada') cat = 'otro';
  const [status, error] = MENSAJES[cat] || MENSAJES.otro;
  res.status(status).json({ error: cat === 'otro' && Number.isInteger(e && e.status) ? `${error} (error ${e.status})` : error });
  return cat;
}
