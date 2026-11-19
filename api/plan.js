// Entrenador IA: monta el plan semanal completo de una persona (calentamiento, trabajo principal, rehabilitación y
// vuelta a la calma de cada día) con criterio de preparador físico y fisioterapeuta.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria) y APP_CODE (opcional, código de acceso).
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SISTEMA = `Eres un preparador físico titulado (fuerza y acondicionamiento) con formación de fisioterapeuta deportivo. Diseñas el plan semanal de entrenamiento de UNA persona que entrena por su cuenta, con su perfil, sus lesiones y su historial. Tiene que ser un plan real, el que pondrías a un cliente tuyo, no un listado genérico.

Cómo lo construyes:
1. Reparto semanal según días disponibles y objetivo: 2 días cuerpo completo; 3 días cuerpo completo o empuje/tirón/pierna; 4 días torso/pierna; 5-6 días combinaciones con cada músculo grande 2 veces por semana. Deja descanso entre sesiones que repiten músculo (48-72 h). "diaSemana": 1 lunes … 7 domingo.
2. Volumen semanal por músculo grande (pecho, espalda, cuádriceps, glúteo, isquios, hombro) dentro de "volumenOrientativo". Ajústalo a nivel (principiante, parte baja) y lesiones.
3. Orden dentro de la sesión: activación/rehabilitación ligera → multiarticulares pesados (más descanso) → accesorios → core. Equilibra empuje y tirón, rodilla y cadera.
4. Dosis según objetivo: fuerza 3-5 series de 3-6 reps (2-3 min); ganar músculo 3-4 × 6-12 (90-120 s en básicos, 60 s accesorios); tonificar 2-3 × 12-15 (45-60 s); perder peso: fuerza para mantener músculo (8-15 reps, descansos 45-75 s, superseries cuando tenga sentido) + cardio al final o en la vuelta a la calma; salud y movilidad: 2-3 × 10-15 suave + movilidad.
5. Lesiones: además de no usar lo que las agrava (el catálogo ya viene filtrado; los que traen "precaucion" van con carga moderada y dilo en la nota), INCLUYE trabajo de rehabilitación y prevención en cada sesión (2-3 ejercicios para la zona, p. ej. glúteo medio en trocanteritis), usando "rehabilitacionSugerida" si encaja, con dosis terapéutica (series moderadas, control, dolor máximo 3/10) y explica en la nota para qué es.
6. Calentamiento específico de cada día (8-12 min): cardio suave 5 min, movilidad dinámica de las articulaciones que se van a usar, activación (incluida la de la lesión) y series de aproximación del primer ejercicio. Usa ejercicios del catálogo cuando existan (pon su "id"), si no, texto claro con "id" vacío.
7. Vuelta a la calma de cada día (5-10 min): estiramientos estáticos de lo trabajado y los recomendados para la lesión (30 s por lado), respiración; cardio suave si el objetivo es perder peso.
8. Usa el historial para elegir ejercicios que ya conoce y para que la progresión parta de donde está. Prioriza los músculos que pide.
9. Ajusta el número de ejercicios principales al tiempo por sesión (unos 6-8 minutos por ejercicio con descansos, sin contar calentamiento ni vuelta a la calma).

Reglas de formato:
- Ejercicios principales solo del catálogo, por su "id".
- "reps" texto corto: "8-10", "12 c/pierna", "30-45s", "25 m". "descanso" en segundos.
- "resumen": 2-3 frases para la persona sobre cómo es su semana.
- "criterios": por qué este reparto, volumen semanal aproximado por músculo, cómo se tratan las lesiones.
- "progresion": cómo progresar las próximas 4-6 semanas (doble progresión, semana de descarga…).
- Español de España, claro y cercano. Notas de ejercicio de una frase.`;

function esquema(ids, idsSuaves) {
  const tarea = {
    type: 'object', additionalProperties: false, required: ['id', 'nombre', 'detalle', 'duracion'],
    properties: { id: { type: 'string', enum: idsSuaves.concat('') }, nombre: { type: 'string' }, detalle: { type: 'string' }, duracion: { type: 'string' } },
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['resumen', 'criterios', 'progresion', 'dias'],
    properties: {
      resumen: { type: 'string' },
      criterios: { type: 'string' },
      progresion: { type: 'string' },
      dias: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['nombre', 'foco', 'diaSemana', 'explicacion', 'calentamiento', 'ejercicios', 'vueltaCalma'],
          properties: {
            nombre: { type: 'string', description: 'Corto, p. ej. "Torso" o "Pierna y glúteo"' },
            foco: { type: 'string' },
            diaSemana: { type: 'integer', description: '1 lunes … 7 domingo' },
            explicacion: { type: 'string', description: 'Qué busca esta sesión, 1-2 frases' },
            calentamiento: { type: 'array', items: tarea },
            ejercicios: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false, required: ['id', 'series', 'reps', 'descanso', 'nota'],
                properties: { id: { type: 'string', enum: ids }, series: { type: 'integer' }, reps: { type: 'string' }, descanso: { type: 'integer' }, nota: { type: 'string' } },
              },
            },
            vueltaCalma: { type: 'array', items: tarea },
          },
        },
      },
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  if (process.env.APP_CODE && req.headers['x-app-code'] !== process.env.APP_CODE) return res.status(401).json({ error: 'código de acceso incorrecto' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'falta la clave de la IA en el servidor' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const catalogo = Array.isArray(body.catalogo) ? body.catalogo.slice(0, 170) : [];
  const ids = [...new Set(catalogo.map(e => String(e.id)))];
  if (!ids.length) return res.status(400).json({ error: 'no hay ejercicios que encajen con ese perfil' });
  const idsSuaves = catalogo.filter(e => Array.isArray(e.musculos) && ['movilidad', 'cardio'].includes(e.musculos[0])).map(e => String(e.id));
  const peticion = {
    persona: body.persona, perfil: body.perfil, lesiones: body.lesiones || [],
    historial: Array.isArray(body.historial) ? body.historial.slice(0, 40) : [], estado: body.estado || null,
    volumenOrientativo: body.volumenOrientativo, catalogo,
  };

  try {
    const msg = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema(ids, idsSuaves) } },
      system: SISTEMA,
      messages: [{ role: 'user', content: 'Diseña el plan semanal con estos datos (JSON):\n\n' + JSON.stringify(peticion) }],
    });
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'la IA no ha querido generar este plan' });
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'respuesta incompleta' });
    const plan = JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
    (plan.dias || []).forEach(d => { d.ejercicios = (d.ejercicios || []).filter(e => ids.includes(e.id)); });
    return res.status(200).json({ plan });
  } catch (e) {
    console.error('plan: error de la API de Claude', e && e.status, e && e.message);
    const m = String((e && e.message) || '');
    let error = 'la IA no responde ahora [' + ((e && e.status) || (e && e.name) || 'error') + ': ' + m.slice(0, 140) + ']';
    if (e instanceof Anthropic.AuthenticationError) error = 'la clave de la IA no es válida (revisa ANTHROPIC_API_KEY en Vercel)';
    else if (e instanceof Anthropic.PermissionDeniedError) error = 'la clave de la IA no tiene permiso para este modelo';
    else if (e instanceof Anthropic.RateLimitError) error = 'demasiadas peticiones, prueba en un minuto';
    else if (/credit balance/i.test(m)) error = 'la cuenta de la API de Claude no tiene saldo';
    else if (e instanceof Anthropic.BadRequestError) error = 'petición rechazada por la IA: ' + m.slice(0, 160);
    else if (e instanceof Anthropic.APIConnectionError) error = 'el servidor no pudo conectar con la IA';
    else if (e instanceof SyntaxError) error = 'la IA devolvió una respuesta que no se pudo leer';
    return res.status(e instanceof Anthropic.RateLimitError ? 429 : 502).json({ error });
  }
}
