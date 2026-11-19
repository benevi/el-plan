// Entrenador IA de Pipos Fitness. Un solo punto con dos modos:
//   modo 'sesion' → la sesión de hoy (calentamiento, rehabilitación, principal y vuelta a la calma) con su porqué.
//   modo 'plan'   → el plan de la semana con los días que esa persona tiene esta semana.
// El móvil manda el catálogo ya filtrado por seguridad; aquí solo se aceptan ids de ese catálogo.
import { Anthropic, comprobar, pedirJSON, responderError } from './_comun.js';

const client = new Anthropic();

const SISTEMA = `Eres el entrenador personal de Pipos Fitness: preparador físico titulado (fuerza y acondicionamiento) con formación de fisioterapeuta deportivo. Entrenas a UNA persona que va por su cuenta a un centro deportivo con gimnasio y piscina climatizada (y a veces entrena en casa o en la calle). Eres su cerebro de entrenamiento: decides con su perfil, sus lesiones, lo que ha apuntado, lo que le gusta y lo que te ha comentado. Tiene que ser lo que pondrías a un cliente tuyo, no un listado genérico.

Criterios:
1. Objetivos: puede tener varios a la vez. Equilíbralos. Perder grasa: fuerza para conservar músculo (8-15 reps, descansos 45-75 s, superseries cuando tenga sentido) + cardio moderado al final. Ganar músculo: 3-4 × 6-12 (90-120 s en básicos, 60 s accesorios). Fuerza: 3-5 × 3-6 (2-3 min). Resistencia: 2-3 × 15-20, descansos cortos, circuitos. Salud y movilidad: 2-3 × 10-15 suave + movilidad. Nadar mejor: técnica y series por largos.
2. Nivel: principiante → parte baja de volumen, ejercicios guiados y técnica; intermedio y avanzado → más volumen y variantes libres.
3. Orden de la sesión: activación y rehabilitación ligera → multiarticulares pesados (más descanso) → accesorios → core → cardio si toca. Equilibra empuje y tirón, rodilla y cadera.
4. Lesiones: el catálogo ya viene sin lo peligroso; los que traen "precaucion" van con carga moderada y dilo en la nota. INCLUYE en cada sesión 1-3 ejercicios de rehabilitación o prevención para cada zona activa (rol "rehab"), usando "rehabilitacionSugerida" si encaja, con dosis terapéutica (control, dolor máximo 3/10) y di para qué en la nota. Si hoy le duele 7/10 o más una zona, sesión suave o de movilidad y dilo.
5. Recuperación: no cargues fuerte un músculo "sin recuperar" (48-72 h en grandes); si se pide igualmente, una serie menos y sin subir peso.
6. Progresión: usa "historial.progreso". "propuestaReglas" es la doble progresión calculada por la app; síguela salvo que tengas un motivo y entonces explícalo. "kg" es el peso para hoy (0 si no aplica o no hay datos).
7. Gustos: no uses lo que "no le gusta" salvo que no haya alternativa razonable; prioriza lo que "le gusta". Lee "comentarios" y "comentariosEjercicios" y resuelve lo que cuenten (molestias, aburrimiento, máquina ocupada…).
8. Calentamiento específico (8-12 min): cardio suave, movilidad dinámica de lo que se va a usar, activación de la zona lesionada y series de aproximación del primer ejercicio. Vuelta a la calma (5-10 min): estiramientos de lo trabajado y de la lesión (30 s por lado) y respiración. Usa ejercicios del catálogo de movilidad o cardio cuando existan (pon su "id"); si no, texto claro con "id" vacío.
9. Tiempo: ajusta el número de ejercicios principales a los minutos (unos 6-8 min por ejercicio con descansos, sin contar calentamiento ni vuelta a la calma).
10. Piscina: series por largos o por tiempo, técnica de crol y espalda, aquagym para cardio sin impacto si hay lesiones de carga.

"explicacion": 3-6 puntos breves, en segunda persona, del PORQUÉ de lo que propones: objetivo, reparto o músculos y recuperación, series/reps/descansos, kilos y progresión, lesiones. Cita datos reales suyos (kilos, días, dolor, comentarios).
Formato: ejercicios solo del catálogo, por su "id". "reps" texto corto: "8-10", "12 c/pierna", "30-45s", "25 m". "descanso" en segundos. Español de España, claro y cercano. Notas de una frase.`;

const tarea = idsSuaves => ({
  type: 'object', additionalProperties: false, required: ['id', 'nombre', 'detalle', 'duracion'],
  properties: { id: { type: 'string', enum: idsSuaves.concat('') }, nombre: { type: 'string' }, detalle: { type: 'string' }, duracion: { type: 'string' } },
});
const ejercicio = ids => ({
  type: 'object', additionalProperties: false, required: ['id', 'rol', 'series', 'reps', 'descanso', 'kg', 'nota'],
  properties: {
    id: { type: 'string', enum: ids }, rol: { type: 'string', enum: ['principal', 'rehab', 'cardio'] },
    series: { type: 'integer' }, reps: { type: 'string' }, descanso: { type: 'integer' }, kg: { type: 'number' }, nota: { type: 'string' },
  },
});
const textos = { type: 'array', items: { type: 'string' } };

function esquemaSesion(ids, idsSuaves) {
  return {
    type: 'object', additionalProperties: false,
    required: ['nombre', 'foco', 'explicacion', 'calentamiento', 'ejercicios', 'vueltaCalma'],
    properties: {
      nombre: { type: 'string', description: 'Corto, p. ej. "Torso" o "Pierna y glúteo"' }, foco: { type: 'string' },
      explicacion: textos, calentamiento: { type: 'array', items: tarea(idsSuaves) },
      ejercicios: { type: 'array', items: ejercicio(ids) }, vueltaCalma: { type: 'array', items: tarea(idsSuaves) },
    },
  };
}
function esquemaPlan(ids, idsSuaves, lugares) {
  return {
    type: 'object', additionalProperties: false, required: ['resumen', 'criterios', 'progresion', 'dias'],
    properties: {
      resumen: { type: 'string', description: '2-3 frases para la persona sobre su semana' },
      criterios: { type: 'string', description: 'Por qué este reparto, volumen semanal por músculo, cómo se tratan las lesiones' },
      progresion: { type: 'string', description: 'Cómo progresar las próximas 4-6 semanas' },
      dias: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['diaSemana', 'lugar', 'nombre', 'foco', 'minutos', 'explicacion', 'calentamiento', 'ejercicios', 'vueltaCalma'],
          properties: {
            diaSemana: { type: 'integer', description: '1 lunes … 7 domingo' }, lugar: { type: 'string', enum: lugares },
            nombre: { type: 'string' }, foco: { type: 'string' }, minutos: { type: 'integer' }, explicacion: textos,
            calentamiento: { type: 'array', items: tarea(idsSuaves) }, ejercicios: { type: 'array', items: ejercicio(ids) },
            vueltaCalma: { type: 'array', items: tarea(idsSuaves) },
          },
        },
      },
    },
  };
}

export default async function handler(req, res) {
  const body = comprobar(req, res); if (!body) return;
  const catalogo = Array.isArray(body.catalogo) ? body.catalogo.slice(0, 200) : [];
  const ids = [...new Set(catalogo.map(e => String(e.id)))];
  if (!ids.length) return res.status(400).json({ error: 'no hay ejercicios que encajen con ese perfil' });
  const idsSuaves = catalogo.filter(e => Array.isArray(e.musculos) && ['movilidad', 'cardio'].includes(e.musculos[0])).map(e => String(e.id));
  const comun = { perfil: body.perfil, lesiones: body.lesiones || [], historial: body.historial || {}, hoy: body.hoy, diaSemana: body.diaSemana, catalogo };

  try {
    if (body.modo === 'plan') {
      const lugares = ((body.semana && body.semana.lugares) || []).map(l => String(l.id)).filter(Boolean);
      if (!lugares.length) return res.status(400).json({ error: 'faltan los lugares de la semana' });
      const plan = await pedirJSON(client, {
        sistema: SISTEMA + `\n\nAhora diseñas el PLAN DE LA SEMANA: un día por cada "semana.dias" (1 lunes … 7 domingo), en esos días exactos. Reparto según cuántos días sean: 2 cuerpo completo; 3 cuerpo completo o empuje/tirón/pierna; 4 torso/pierna; 5-6 cada músculo grande 2 veces. 48-72 h entre sesiones que repiten músculo grande. Si tiene piscina entre sus lugares y encaja con el objetivo o las lesiones, usa la piscina algún día. Cada ejercicio debe poder hacerse en el "lugar" del día (mira "lugares" de cada ejercicio).`,
        usuario: 'Plan de la semana con estos datos (JSON):\n\n' + JSON.stringify({ ...comun, semana: body.semana }),
        esquema: esquemaPlan(ids, idsSuaves, lugares), esfuerzo: 'medium', maxTokens: 32000,
      });
      (plan.dias || []).forEach(d => { d.ejercicios = (d.ejercicios || []).filter(e => ids.includes(e.id)); });
      return res.status(200).json({ plan });
    }
    const sesion = await pedirJSON(client, {
      sistema: SISTEMA + `\n\nAhora diseñas la SESIÓN DE HOY con su check-in (lugar, minutos, energía 1-5, dolor de hoy y lo que pida). Si hay "planDeHoy", parte de él y adáptalo al check-in; si no, decide tú lo que más le conviene hoy según la semana que lleva.`,
      usuario: 'Sesión de hoy con estos datos (JSON):\n\n' + JSON.stringify({ ...comun, checkin: body.checkin, planDeHoy: body.planDeHoy || null }),
      esquema: esquemaSesion(ids, idsSuaves),
    });
    sesion.ejercicios = (sesion.ejercicios || []).filter(e => ids.includes(e.id));
    return res.status(200).json({ sesion });
  } catch (e) {
    return responderError(res, e, 'entrenador');
  }
}
