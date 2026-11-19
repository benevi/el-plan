// Agente de nutrición de Pipos Fitness: menú semanal para los dos (mismos platos, raciones de cada uno),
// recetas con cantidades y pasos, tuppers para las semanas de turno de tarde y cambio de un plato suelto.
// Las calorías y macros objetivo NO las decide el agente: llegan calculadas por la app (nutricion/core.js)
// a partir del peso, altura, edad, % de grasa, entreno de la semana y objetivo de cada uno.
// Variables de entorno en Vercel: ANTHROPIC_API_KEY (obligatoria), APP_CODE (opcional), NUTRI_MODEL (opcional, otro modelo).
// Las claves de persona son las del dueño de cada móvil: 'victor' y 'virginia'.
import { Anthropic, MODELO as MODELO_APP, responderError } from './_comun.js';

const client = new Anthropic();
const MODELO = process.env.NUTRI_MODEL || MODELO_APP;

const SECCIONES = ['frutas y verduras', 'carnes', 'pescados', 'huevos y lácteos', 'panadería y cereales', 'legumbres', 'despensa', 'aceites y especias', 'congelados', 'conservas', 'frutos secos', 'bebidas', 'otros'];

const SISTEMA = `Eres dietista-nutricionista colegiado en España, especializado en nutrición deportiva y dieta mediterránea. Planificas la comida de una pareja que entrena junta (gimnasio y piscina) y vive en España. Comen lo mismo o casi lo mismo, pero cada uno con sus cantidades. Es un plan real que pondrías a tus clientes, no un ejemplo genérico.

Datos que recibes: para cada persona, sus objetivos diarios YA CALCULADOS (kcal, proteína, grasa, hidratos y fibra) para días de entreno y de descanso, qué días entrena, cuántos minutos, qué comidas hace al día y el reparto orientativo por comida; el turno de trabajo y qué comidas hace en el trabajo esa semana; alergias, lo que no les gusta, lo que les gusta, lo que hay en casa y las recetas de las semanas anteriores.

Cómo trabajas:
1. Cantidades: cada ingrediente lleva la cantidad para UNA ración de cada persona ("victor" y "virginia"), en crudo y en g, ml o unidades (huevos, piezas de fruta, latas). Pon 0 si esa persona no come ese plato. Ajusta las raciones para que cada persona llegue a su objetivo del día (±5 % de kcal, proteína al menos el 95 %), con el objetivo de entreno los días que entrena y el de descanso los demás. Usa valores de composición de alimentos españoles (BEDCA) y calcula en "nutricion" lo que aporta la ración de cada uno.
2. Dieta mediterránea: aceite de oliva virgen extra, verdura y hortaliza en comida y cena, fruta a diario, legumbre 3-4 veces por semana, pescado 3-4 (2 azul), carne blanca 2-3, carne roja como mucho 1, huevos, cereales integrales, frutos secos y lácteos. Hasta "platosDelMundo" recetas por semana de otras cocinas, adaptadas y con ingredientes que se encuentran en cualquier supermercado español (Mercadona, Lidl, Carrefour). Nada de ingredientes raros.
3. Objetivo de cada uno: en déficit, platos saciantes (volumen de verdura, proteína en cada comida, fibra); para ganar músculo o fuerza, proteína repartida en 3-5 tomas de 0,3-0,4 g/kg y más hidratos alrededor del entreno. Los días de entreno pon hidratos y algo de proteína en la comida previa y proteína con hidratos después.
4. Práctico: un día laborable no se cocina más de "minutosEntreSemana" minutos; si "batchDomingo" es true, deja preparado el domingo lo que se pueda (legumbre, cereal cocido, salsas, verdura asada) y planifica sobras (cocinar doble y reutilizar al día siguiente con el mismo id de receta). Reutiliza ingredientes durante la semana para no desperdiciar y aprovecha primero lo que hay en casa ("enCasa"). Desayunos y meriendas sencillos; pueden repetirse.
5. Comidas en el trabajo ("comidasEnTrabajo"): solo hay microondas. Tienen que ser tuppers que se transporten bien, se calienten en 2-3 minutos o se coman fríos, aguanten en nevera hasta el día que toca (máximo 3 días; si no, congelar y decirlo), sin fritos ni rebozados, sin huevo poco hecho y sin pescado de olor fuerte recalentado. Marca "tupper": true y explica cómo calentarlo y conservarlo. Ese día la otra persona puede cenar el mismo plato en casa o uno distinto.
6. Alergias: absolutas, ni trazas. Lo que no les gusta, evítalo. Las valoraciones dicen qué recetas gustan (repítelas de vez en cuando o haz variantes) y cuáles no (no las vuelvas a poner). No repitas las recetas recientes salvo las que gustan.
7. Vídeo: NO inventes enlaces. En "videoBusqueda" pon la búsqueda en español con la que se encuentra en YouTube un vídeo de esa receta (nombre del plato y la técnica principal, 3-6 palabras, p. ej. "lentejas estofadas con verduras receta"). La app busca el vídeo real.
8. "pasos": cortos, numerables, con tiempos y temperaturas.

Formato: "momento" de cada comida es uno de los que hace esa persona (desayuno, media mañana, comida, merienda, cena, post-entreno). "dia": 1 lunes … 7 domingo. En cada comida marca quién la come ("victor", "virginia"); si una persona no está en los datos, pon false y 0 para ella. Español de España, cercano y claro.`;

const num = { type: 'number' };
const porPersona = props => ({ type: 'object', additionalProperties: false, required: ['victor', 'virginia'], properties: { victor: props, virginia: props } });
const macros = { type: 'object', additionalProperties: false, required: ['kcal', 'proteina', 'hidratos', 'grasa'], properties: { kcal: num, proteina: num, hidratos: num, grasa: num } };
const RECETA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'nombre', 'cocina', 'minutos', 'dificultad', 'tupper', 'calentar', 'conservacion', 'ingredientes', 'pasos', 'videoBusqueda', 'nutricion', 'nota'],
  properties: {
    id: { type: 'string', description: 'slug corto y único, p. ej. "lentejas-verduras"' },
    nombre: { type: 'string' },
    cocina: { type: 'string', description: 'mediterránea, española, italiana, griega, marroquí, mexicana, japonesa…' },
    minutos: { type: 'integer' },
    dificultad: { type: 'string', enum: ['fácil', 'media'] },
    tupper: { type: 'boolean' },
    calentar: { type: 'string', description: 'cómo calentarlo en el microondas o "se come frío"; vacío si no es tupper' },
    conservacion: { type: 'string', description: 'cuántos días en nevera, si se congela, en qué recipiente' },
    ingredientes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['nombre', 'seccion', 'unidad', 'victor', 'virginia'],
        properties: { nombre: { type: 'string', description: 'nombre de supermercado, en singular' }, seccion: { type: 'string', enum: SECCIONES }, unidad: { type: 'string', enum: ['g', 'ml', 'ud'] }, victor: num, virginia: num },
      },
    },
    pasos: { type: 'array', items: { type: 'string' } },
    videoBusqueda: { type: 'string' },
    nutricion: porPersona(macros),
    nota: { type: 'string', description: 'una frase: por qué encaja (p. ej. post-entreno, rica en hierro)' },
  },
};
const MENU = {
  type: 'object', additionalProperties: false,
  required: ['resumen', 'criterios', 'recetas', 'dias', 'preparacion', 'consejos'],
  properties: {
    resumen: { type: 'string', description: '2-3 frases sobre la semana' },
    criterios: porPersona({ type: 'string', description: 'cómo se ha planteado para esta persona: objetivo, reparto, ajustes' }),
    recetas: { type: 'array', items: RECETA },
    dias: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['dia', 'comidas'],
        properties: {
          dia: { type: 'integer' },
          comidas: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['momento', 'recetaId', 'victor', 'virginia', 'enTrabajo', 'nota'],
              properties: {
                momento: { type: 'string' }, recetaId: { type: 'string' },
                victor: { type: 'boolean' }, virginia: { type: 'boolean' },
                enTrabajo: { type: 'array', items: { type: 'string', enum: ['victor', 'virginia'] }, description: 'quién se lo lleva al trabajo' },
                nota: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preparacion: {
      type: 'array', description: 'plan de batch cooking y preparación anticipada',
      items: { type: 'object', additionalProperties: false, required: ['cuando', 'tareas'], properties: { cuando: { type: 'string' }, tareas: { type: 'array', items: { type: 'string' } } } },
    },
    consejos: { type: 'array', items: { type: 'string' } },
  },
};
const PLATO = { type: 'object', additionalProperties: false, required: ['receta', 'motivo'], properties: { receta: RECETA, motivo: { type: 'string' } } };

function limpiarMenu(menu, quien) {
  const ids = new Set((menu.recetas || []).map(r => r.id));
  (menu.dias || []).forEach(d => {
    d.comidas = (d.comidas || []).filter(c => ids.has(c.recetaId));
    d.comidas.forEach(c => { ['victor', 'virginia'].forEach(u => { if (!quien.includes(u)) c[u] = false; }); c.enTrabajo = (c.enTrabajo || []).filter(u => quien.includes(u)); });
  });
  menu.dias = (menu.dias || []).filter(d => d.dia >= 1 && d.dia <= 7).sort((a, b) => a.dia - b.dia);
  return menu;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  if (process.env.APP_CODE && req.headers['x-app-code'] !== process.env.APP_CODE) return res.status(401).json({ error: 'código de acceso incorrecto' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: `falta configurar la clave de la IA (ANTHROPIC_API_KEY) en Vercel para el entorno ${process.env.VERCEL_ENV === 'preview' ? 'Preview' : process.env.VERCEL_ENV === 'production' ? 'Production' : 'de esta versión'}; márcalo y vuelve a desplegar`, codigo: 'sin_clave' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'JSON no válido' }); }
  const modo = body.modo === 'plato' ? 'plato' : 'menu';
  const peticion = body.peticion || {};
  const quien = Object.keys(peticion.personas || {});
  if (!quien.length) return res.status(400).json({ error: 'faltan los datos de las personas' });

  let texto;
  if (modo === 'menu') {
    texto = 'Prepara el menú de la semana (los 7 días, todas las comidas de cada persona) con estos datos (JSON):\n\n' + JSON.stringify(peticion);
  } else {
    if (!body.receta) return res.status(400).json({ error: 'falta el plato a cambiar' });
    texto = 'Cambia SOLO este plato por otro distinto que cumpla lo mismo (misma comida del día, mismas personas, kcal y proteína parecidas para cada uno, mismas condiciones de tupper si lo era). '
      + (body.motivo ? `Motivo del cambio: «${String(body.motivo).slice(0, 300)}». ` : '')
      + 'Evita los otros platos de la semana.\n\nPlato actual (JSON):\n' + JSON.stringify(body.receta)
      + '\n\nDónde se come: ' + JSON.stringify(body.donde || [])
      + '\n\nOtros platos de la semana: ' + JSON.stringify((body.otros || []).slice(0, 60))
      + '\n\nDatos de la semana (JSON):\n' + JSON.stringify(peticion);
  }

  try {
    const stream = client.beta.messages.stream({
      model: MODELO,
      max_tokens: modo === 'menu' ? 64000 : 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: modo === 'menu' ? MENU : PLATO } },
      system: SISTEMA,
      messages: [{ role: 'user', content: texto }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'la IA no ha querido generar este menú' });
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'respuesta incompleta' });
    const datos = JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
    const uso = { modelo: msg.model, entrada: msg.usage.input_tokens, salida: msg.usage.output_tokens };
    if (modo === 'menu') return res.status(200).json({ menu: limpiarMenu(datos, quien), uso });
    return res.status(200).json({ receta: datos.receta, motivo: datos.motivo, uso });
  } catch (e) {
    return responderError(res, e, 'nutricion');
  }
}
