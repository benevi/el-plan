// Utilidades de las funciones del servidor. Los archivos de /api que empiezan por _ no son rutas.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria para la IA) y APP_CODE (código de acceso,
// obligatorio: sin él el servidor no atiende a nadie).
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

// Comprueba método, código, tipo y tamaño. Devuelve el cuerpo ya parseado (objeto) o null si ya ha respondido.
export function comprobar(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Usa POST' }); return null; }
  const codigo = process.env.APP_CODE;
  if (!codigo) { console.error('servidor: falta APP_CODE'); res.status(500).json({ error: 'el servidor no está configurado' }); return null; }
  if (!codigoValido(req.headers['x-app-code'], codigo)) { res.status(401).json({ error: 'código de acceso incorrecto' }); return null; }
  const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/json') { res.status(415).json({ error: 'la petición tiene que ser JSON' }); return null; }
  const largo = Number(req.headers['content-length']);
  if (Number.isFinite(largo) && largo > LIMITE_CUERPO) { res.status(413).json({ error: 'la petición es demasiado grande' }); return null; }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('servidor: falta ANTHROPIC_API_KEY'); res.status(500).json({ error: 'el servidor no está configurado' }); return null; }
  let cuerpo;
  try {
    cuerpo = req.body; // en Vercel es un getter que parsea el JSON y lanza si está mal formado
    if (typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo)) cuerpo = JSON.parse(String(cuerpo));
  } catch (e) { res.status(400).json({ error: 'petición mal formada' }); return null; }
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) { res.status(400).json({ error: 'petición mal formada' }); return null; }
  let tam;
  try { tam = Buffer.byteLength(JSON.stringify(cuerpo)); } catch (e) { res.status(400).json({ error: 'petición mal formada' }); return null; } // p. ej. anidado sin fin
  if (tam > LIMITE_CUERPO) { res.status(413).json({ error: 'la petición es demasiado grande' }); return null; }
  return cuerpo;
}

// ── Saneado del cuerpo ──
// Solo pasan las claves que usa el servidor; textos, listas y profundidad acotados. Con los datos que
// arma el móvil (js/reglas/contexto.js y peticionBase en js/areas/entrenador/entrenador.js) no cambia nada:
// lo comprueba tests/api/saneado.test.mjs.
export const CLAVES = ['modo', 'perfil', 'lesiones', 'historial', 'analisis', 'hoy', 'diaSemana', 'catalogo', 'checkin', 'planDeHoy', 'ajusteReglas', 'semana'];
// «comentariosEjercicios» lleva «Nombre del ejercicio: comentario», de ahí el margen sobre 300.
const LARGO_POR_CLAVE = { nota: 1000, notas: 1000, comentario: 300, comentarios: 300, peticion: 300, texto: 300, comentariosEjercicios: 360 };
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
  if (typeof v === 'string') return recortar(v, LARGO_POR_CLAVE[clave] || LARGO);
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
  if ('t' in e) x.t = recortar(String(e.t), 20);
  if ('prec' in e) x.prec = recortar(String(e.prec), 200);
  if ('gusto' in e) x.gusto = recortar(String(e.gusto), 30);
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
export async function pedirJSON(client, { sistema, usuario, esquema, esfuerzo = 'low', maxTokens = 16000, signal, registro = {} }) {
  const msg = await client.beta.messages.stream({
    model: MODELO,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    system: sistema,
    messages: [{ role: 'user', content: usuario }],
  }, { signal }).finalMessage();
  Object.assign(registro, {
    id: msg.id, modelo: msg.model, stop_reason: msg.stop_reason,
    entrada: msg.usage && msg.usage.input_tokens, salida: msg.usage && msg.usage.output_tokens,
  });
  if (msg.stop_reason === 'refusal') throw new ErrorIA('negativa');
  if (msg.stop_reason === 'max_tokens') throw new ErrorIA('incompleta', 'stop_reason max_tokens');
  if (msg.stop_reason !== 'end_turn') throw new ErrorIA('incompleta', 'stop_reason ' + msg.stop_reason);
  const texto = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!texto.trim()) throw new ErrorIA('ilegible', 'contenido vacío');
  let datos;
  try { datos = JSON.parse(texto); } catch (e) { throw new ErrorIA('ilegible', 'JSON no válido'); }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorIA('ilegible', 'no es un objeto');
  return datos;
}

// ── Cancelación ──
// Si el móvil cierra la conexión antes de que respondamos, se aborta la llamada a Claude (deja de generar y de cobrar).
export function cancelarAlCerrar(res) {
  const ctrl = new AbortController();
  const alCerrar = () => { if (!res.writableFinished) ctrl.abort(); };
  res.on('close', alCerrar);
  return { signal: ctrl.signal, soltar: () => res.off('close', alCerrar) };
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
export function responderError(res, e, quien) {
  const cat = categoria(e);
  console.error(quien + ': error de la IA', JSON.stringify({ categoria: cat, status: e && e.status, tipo: e && (e.type || e.name), peticion: e && e.requestID }), String((e && e.message) || '').slice(0, 2000));
  if (cat === 'cancelada' || res.writableEnded || res.destroyed) return cat;
  const [status, error] = MENSAJES[cat] || MENSAJES.otro;
  res.status(status).json({ error: cat === 'otro' && Number.isInteger(e && e.status) ? `${error} (error ${e.status})` : error });
  return cat;
}
