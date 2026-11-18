// Agente de rutinas: recibe criterios + catálogo ya filtrado (solo ejercicios seguros) y devuelve una sesión.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria) y APP_CODE (opcional, código de acceso).
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SISTEMA = `Eres el entrenador personal de una pareja que entrena junta. Preparas UNA sesión de entrenamiento para hoy.

Reglas:
- Usa solo ejercicios del catálogo que te paso, por su "id". El catálogo ya excluye lo que no conviene por las lesiones; los que traen "precaucion" son aceptables pero con carga moderada: dilo en su nota.
- Ajusta el número de ejercicios y series al tiempo disponible (unos 5-6 minutos por ejercicio con descansos; reserva 5-8 minutos para calentar y estirar, que la app ya incluye).
- La sesión es para una persona concreta ("persona"): usa su perfil (objetivo principal, nivel, días por semana, músculos a priorizar, sexo, altura, peso) y su propio historial. Él y ella tienen perfiles, lesiones e historial distintos, así que sus rutinas deben ser distintas. "criterios.objetivo" es el objetivo de hoy; si difiere del principal, manda el de hoy pero sin perder de vista el principal.
- Perder peso: más densidad (descansos de 30-45 s, superseries o circuito), repeticiones 12-15, ejercicios grandes de cuerpo completo y 8-12 minutos de cardio suave al final si hay tiempo; mantén algo de fuerza para no perder músculo.
- Si hay músculos a priorizar, dales algo más de volumen dentro de lo que permitan la recuperación y las lesiones.
- Respeta el objetivo: fuerza (pocas reps, más descanso), ganar músculo (8-12), tonificar/resistencia (12-15, poco descanso), recuperación (suave, pocos ejercicios, con ejercicios de movilidad), cardio (por tiempo, descansos cortos).
- Si la energía es baja (1-2 de 5) o el dolor de hoy es 4 o más, baja volumen e intensidad y dilo en "notas".
- Ordena: primero los ejercicios grandes o multiarticulares, después los pequeños y al final el core.
- Equilibra empuje y tirón, y no repitas el mismo patrón dos veces seguidas salvo que lo pidan.
- Atiende la petición libre si es razonable y segura; si pide algo que choca con una lesión, no lo hagas y explícalo en "notas".
- "reps" es texto corto: "8-10", "12 c/pierna", "30-45s", "25 m".

Progreso (sobrecarga progresiva). En "progreso" tienes, por ejercicio, las últimas veces que lo hizo (kilos × repeticiones o tiempo por serie, esfuerzo de esa sesión del 1 al 5 y si le subió el dolor) y "propuestaApp", lo que proponen las reglas de la app. En "estado" tienes peso corporal, sesiones de la última semana, esfuerzo reciente y dolor antes y después de las últimas sesiones. Úsalo para dar en cada ejercicio el peso, las repeticiones, el tiempo o las series adecuadas para hoy:
- Doble progresión: con el mismo peso sube repeticiones dentro del rango; cuando llegó al tope del rango en todas las series, sube el peso lo mínimo (2,5 kg en máquina, polea o barra; 1-2 kg por mancuerna; 5 kg en prensa o pesos grandes) y vuelve a la parte baja del rango.
- Si no llegó a la parte baja del rango, repite peso. Si le pasó dos veces seguidas, baja un 10 %.
- Si hace más de 4 semanas que no lo hace, baja un 10 %.
- No subas si hoy tiene energía 1-2 de 5, si el ejercicio va con "precaucion", si la última vez le subió el dolor o si la última sesión fue al límite (5/5). Con energía 1, baja un 10 %.
- En máquinas asistidas (dominadas o fondos asistidos) el peso es ayuda: progresar es quitar kilos.
- Sin kilos (peso corporal, plancha, cardio, natación) progresa en repeticiones, segundos, minutos o una serie más, de poco en poco.
- Si no hay historial de un ejercicio pero sí de otros parecidos, puedes estimar con prudencia a partir de ellos; si no, "kg" = 0 y en "nota" di que elija un peso que le deje 2-3 repeticiones de margen.
- Ponte por defecto en lo que dice "propuestaApp" salvo que el conjunto de datos (cansancio de la semana, dolor, peso corporal, petición) justifique otra cosa; entonces explícalo en "nota".
- "kg" es el peso por serie para hoy (por mancuerna si son mancuernas). Pon 0 si el ejercicio no lleva peso.
- Recuperación muscular: en "recuperacion" tienes los músculos trabajados hace poco (horas, series y si están "sin recuperar" o "casi recuperados") y en "ultimasSesiones" los ejercicios de los últimos días. No pongas como músculo principal uno "sin recuperar" (grandes ~72 h, pequeños ~48 h, core ~24 h): elige otros músculos o, si la persona lo pide expresamente, baja una serie, no subas peso y avísalo en "notas". Con los "casi recuperados", no subas carga. Evita repetir los mismos ejercicios del día anterior. Di en "notas" qué músculos descansan hoy y por qué.
- En la "nota" de cada ejercicio con historial di en una frase qué toca hoy y por qué (ej.: "Sube a 42,5 kg: la última vez hiciste 12 en las tres series").
- Escribe en español de España, frases cortas y claras. "nota" de cada ejercicio: máximo una frase, solo si aporta algo.`;

function esquema(ids) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['nombre', 'foco', 'notas', 'ejercicios'],
    properties: {
      nombre: { type: 'string', description: 'Nombre corto de la sesión, máx. 40 caracteres' },
      foco: { type: 'string', description: 'Qué trabaja, máx. 60 caracteres' },
      notas: { type: 'string', description: 'Por qué está montada así y avisos, 1-3 frases' },
      ejercicios: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'series', 'reps', 'descanso', 'nota', 'kg'],
          properties: {
            id: { type: 'string', enum: ids },
            series: { type: 'integer' },
            reps: { type: 'string' },
            descanso: { type: 'integer', description: 'segundos' },
            nota: { type: 'string' },
            kg: { type: 'number', description: 'kilos por serie para hoy; 0 si no lleva peso o no hay datos' },
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
  const catalogo = Array.isArray(body.catalogo) ? body.catalogo.slice(0, 150) : [];
  const ids = [...new Set(catalogo.map(e => String(e.id)))];
  if (!ids.length) return res.status(400).json({ error: 'no hay ejercicios que encajen con esos criterios' });

  const peticion = {
    persona: body.persona,
    lesiones: body.lesiones,
    criterios: body.criterios,
    estado: body.estado || null,
    recuperacion: Array.isArray(body.recuperacion) ? body.recuperacion.slice(0, 15) : [],
    ultimasSesiones: Array.isArray(body.ultimasSesiones) ? body.ultimasSesiones.slice(0, 6) : [],
    progreso: Array.isArray(body.progreso) ? body.progreso.filter(p => p && ids.includes(String(p.id))).slice(0, 40) : [],
    catalogo,
  };

  try {
    const msg = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: esquema(ids) } },
      system: SISTEMA,
      messages: [{ role: 'user', content: 'Prepara la sesión de hoy con estos datos (JSON):\n\n' + JSON.stringify(peticion) }],
    });
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'la IA no ha querido generar esta rutina' });
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'respuesta incompleta' });
    const texto = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const rutina = JSON.parse(texto);
    rutina.ejercicios = (rutina.ejercicios || []).filter(e => ids.includes(e.id));
    return res.status(200).json({ rutina });
  } catch (e) {
    // Se registra en los logs de Vercel (Deployments → Logs) y se devuelve un motivo legible a la app.
    console.error('rutina: error de la API de Claude', e && e.status, e && e.message);
    const m = String((e && e.message) || '');
    let error = 'la IA no responde ahora';
    if (e instanceof Anthropic.AuthenticationError) error = 'la clave de la IA no es válida (revisa ANTHROPIC_API_KEY en Vercel)';
    else if (e instanceof Anthropic.PermissionDeniedError) error = 'la clave de la IA no tiene permiso para este modelo';
    else if (e instanceof Anthropic.RateLimitError) error = 'demasiadas peticiones, prueba en un minuto';
    else if (/credit balance/i.test(m)) error = 'la cuenta de la API de Claude no tiene saldo';
    else if (e instanceof Anthropic.BadRequestError) error = 'petición rechazada por la IA: ' + m.slice(0, 160);
    else if (e instanceof Anthropic.APIConnectionError) error = 'el servidor no pudo conectar con la IA';
    else if (e instanceof SyntaxError) error = 'la IA devolvió una respuesta que no se pudo leer';
    const status = e instanceof Anthropic.RateLimitError ? 429 : 502;
    return res.status(status).json({ error });
  }
}
