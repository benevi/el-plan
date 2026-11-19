// Utilidades de las funciones del servidor. Los archivos de /api que empiezan por _ no son rutas.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria para la IA) y APP_CODE (código de acceso).
import Anthropic from '@anthropic-ai/sdk';

export { Anthropic };
export const MODELO = 'claude-opus-5-5';

export function comprobar(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Usa POST' }); return null; }
  if (process.env.APP_CODE && req.headers['x-app-code'] !== process.env.APP_CODE) { res.status(401).json({ error: 'código de acceso incorrecto' }); return null; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: 'falta la clave de la IA en el servidor' }); return null; }
  try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch (e) { res.status(400).json({ error: 'petición mal formada' }); return null; }
}

// Pide a Claude una respuesta JSON que cumple `esquema`.
export async function pedirJSON(client, { sistema, usuario, esquema, esfuerzo = 'low', maxTokens = 16000 }) {
  const msg = await client.beta.messages.create({
    model: MODELO,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    system: sistema,
    messages: [{ role: 'user', content: usuario }],
  });
  if (msg.stop_reason === 'refusal') { const e = new Error('la IA no ha querido responder a esto'); e.status = 422; throw e; }
  if (msg.stop_reason === 'max_tokens') { const e = new Error('respuesta incompleta de la IA'); e.status = 502; throw e; }
  return JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
}

export function responderError(res, e, quien) {
  console.error(quien + ': error de la API de Claude', e && e.status, e && e.message);
  const m = String((e && e.message) || '');
  let error = 'la IA no responde ahora [' + ((e && e.status) || (e && e.name) || 'error') + ': ' + m.slice(0, 140) + ']';
  let status = 502;
  if (e instanceof Anthropic.AuthenticationError) error = 'la clave de la IA no es válida (revisa ANTHROPIC_API_KEY en Vercel)';
  else if (e instanceof Anthropic.PermissionDeniedError) error = 'la clave de la IA no tiene permiso para este modelo';
  else if (e instanceof Anthropic.RateLimitError) { error = 'demasiadas peticiones, prueba en un minuto'; status = 429; }
  else if (/credit balance/i.test(m)) error = 'la cuenta de la API de Claude no tiene saldo';
  else if (e instanceof Anthropic.BadRequestError) error = 'petición rechazada por la IA: ' + m.slice(0, 160);
  else if (e instanceof Anthropic.APIConnectionError) error = 'el servidor no pudo conectar con la IA';
  else if (e instanceof SyntaxError) error = 'la IA devolvió una respuesta que no se pudo leer';
  else if (e && e.status === 422) { error = m; status = 422; }
  else if (m === 'respuesta incompleta de la IA') error = m;
  return res.status(status).json({ error });
}
