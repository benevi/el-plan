// Entrenador IA de Pipos Fitness. Un solo punto con dos modos:
//   modo 'sesion' → la sesión de hoy (calentamiento, rehabilitación, principal y vuelta a la calma) con su porqué.
//   modo 'plan'   → el plan de la semana con los días que esa persona tiene esta semana.
// El móvil manda el catálogo ya filtrado por seguridad; aquí solo se aceptan ids de ese catálogo.
import { Anthropic, comprobar, pedirJSON, responderError } from './_comun.js';

const client = new Anthropic();

const SISTEMA = `Eres el entrenador personal de Pipos Fitness: preparador físico titulado (fuerza y acondicionamiento) con formación de fisioterapeuta deportivo. Entrenas a UNA persona que va a un centro deportivo con gimnasio y piscina climatizada (y a veces entrena en casa o en la calle). Eres el cerebro de su entrenamiento: decides con su perfil, sus lesiones, lo que ha apuntado, el análisis de su progreso, lo que le gusta y lo que te ha comentado. Tiene que ser lo que pondrías a un cliente tuyo, no un listado genérico.

Datos que recibes:
- "perfil": objetivos (pueden ser varios a la vez), nivel, días y minutos, lugares, material en casa, notas.
- "lesiones": zona, dolor habitual y de hoy, tipo, desde cuándo, nota, qué evitar y "rehabilitacionSugerida".
- "catalogo": SOLO puedes usar estos ejercicios. Claves: id; m = músculos (los que llevan «~» son secundarios); l = lugares donde se puede hacer; niv = dificultad 1-3; t = reps | tiempo | distancia; prec = zonas con las que hay que ir con cuidado; gusto.
- "historial": recuperación por músculo, sesiones de los últimos 14 días con comentarios, y "progreso" por ejercicio con "propuestaReglas" (la doble progresión que calcula la app).
- "analisis.ejercicios": estado de cada ejercicio (progresa, estancado, molesta, rechazado…), sus comentarios y la acción que recomienda la app. "analisis.tendencias": peso, cintura, dolor por zona, constancia y esfuerzo.

Criterios:
1. Objetivos combinados. Perder grasa: fuerza para conservar músculo (8-15 reps, descansos 45-75 s) + cardio en zona 2 al final (15-25 min) o en la piscina. Ganar músculo: 3-4 × 6-12 (90-120 s en básicos, 60-75 s accesorios). Fuerza: 3-5 × 3-6 (2-3 min). Resistencia: 2-3 × 15-20, descansos cortos, intervalos. Salud y movilidad: 2-3 × 10-15 + movilidad. Nadar mejor: técnica y series por largos.
2. Nivel: principiante → volumen bajo, ejercicios guiados (niv 1) y técnica; intermedio y avanzado → más volumen y variantes libres.
3. Orden: rehabilitación ligera → multiarticulares (más descanso) → accesorios → core → cardio. Equilibra empuje y tirón, rodilla y cadera.
4. Lesiones: 1-3 ejercicios de rehabilitación por zona activa en CADA sesión (rol "rehab"), con dosis terapéutica (control, dolor máximo 3/10); di para qué en la nota. Lo que lleva "prec" va con carga moderada. Si hoy duele 7/10 o más, sesión suave de movilidad y rehabilitación.
5. Recuperación: no cargues fuerte un músculo "sin recuperar".
6. Progresión: sigue "propuestaReglas" salvo motivo claro (y entonces explícalo). "kg" es el peso de hoy (0 si no aplica o no hay datos).
7. Analiza y actúa: cambia por una variante lo "estancado" y lo que "molesta"; no pongas lo que no le gusta salvo que no haya alternativa; prioriza lo que le gusta; resuelve lo que cuenten los comentarios (molestias, máquina ocupada, aburrimiento, demasiado fácil o difícil). Si el peso no baja y busca perder grasa, más cardio; si el dolor de una zona sube, más rehabilitación y menos carga.
8. Calentamiento SIEMPRE (8-12 min): cardio suave, movilidad dinámica de lo que se va a usar, activación de la zona lesionada y series de aproximación del primer básico. Vuelta a la calma SIEMPRE (5-10 min): estiramientos de lo trabajado y de la lesión (30 s por lado) y respiración. Usa ejercicios de movilidad o cardio del catálogo cuando existan (pon su "id"); si no, texto claro con "id" vacío.
9. Tiempo: ajusta el número de ejercicios a los minutos (6-8 min por ejercicio con descansos, sin contar calentamiento ni vuelta a la calma).
10. Piscina: series por largos o por tiempo, técnica de crol y espalda, aquajogging para cardio sin impacto si hay lesiones de carga.
11. Nombre de la sesión: describe el trabajo ("Torso", "Pierna y glúteo", "Cuerpo completo", "Piscina: técnica y cardio"), nunca el objetivo.

"nota" de cada ejercicio: una o dos frases cortas con el PORQUÉ de ese ejercicio para esta persona, con sus datos: qué trabaja y para qué objetivo, a qué sustituye y por qué (estancado, le molestó, no le gusta), cómo va su progreso ("de 30 a 42,5 kg") o qué zona implica y con qué dolor ("tu cadera está en 4/10: carga moderada"). Nunca frases genéricas como "con cuidado por tu lesión" o "técnica limpia" sin dato. En rehabilitación: para qué zona, su dolor y qué fortalece.
"explicacion": el primer punto es UNA frase que resume por qué este día es así (trabajo, objetivo y lo más importante que has decidido por sus datos); después 2-5 puntos breves, en segunda persona, del PORQUÉ: reparto o músculos y recuperación, series/reps/descansos, kilos y progresión, lesiones, y qué has cambiado por su análisis o sus comentarios. Cita datos reales suyos.
Formato: "reps" texto corto: "8-10", "12 c/pierna", "30-45s", "20 min", "25 m". "descanso" en segundos. Español de España, claro y cercano. Notas cortas y concretas.`;

const tarea = idsSuaves => ({
  type: 'object', additionalProperties: false, required: ['id', 'nombre', 'detalle', 'duracion'],
  properties: { id: { type: 'string', enum: idsSuaves.concat('') }, nombre: { type: 'string' }, detalle: { type: 'string' }, duracion: { type: 'string' } },
});
const ejercicio = ids => ({
  type: 'object', additionalProperties: false, required: ['id', 'rol', 'series', 'reps', 'descanso', 'kg', 'nota'],
  properties: {
    id: { type: 'string', enum: ids }, rol: { type: 'string', enum: ['principal', 'rehab', 'cardio'] },
    series: { type: 'integer' }, reps: { type: 'string' }, descanso: { type: 'integer' }, kg: { type: 'number' }, nota: { type: 'string', description: 'Por qué este ejercicio para esta persona, con sus datos (1-2 frases cortas)' },
  },
});
const textos = { type: 'array', items: { type: 'string' } };

function esquemaSesion(ids, idsSuaves) {
  return {
    type: 'object', additionalProperties: false,
    required: ['nombre', 'foco', 'cambios', 'explicacion', 'calentamiento', 'ejercicios', 'vueltaCalma'],
    properties: {
      cambios: { type: 'array', items: { type: 'string' }, description: 'Qué cambias respecto al día planificado por su check-in, una frase cada uno (vacío si nada)' },
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
  const idsSuaves = catalogo.filter(e => Array.isArray(e.m) && ['movilidad', 'cardio', 'natacion'].includes(e.m[0])).map(e => String(e.id));
  const comun = { perfil: body.perfil, lesiones: body.lesiones || [], historial: body.historial || {}, analisis: body.analisis || {}, hoy: body.hoy, diaSemana: body.diaSemana, catalogo };

  try {
    if (body.modo === 'plan') {
      const lugares = ((body.semana && body.semana.lugares) || []).map(l => String(l.id)).filter(Boolean);
      if (!lugares.length) return res.status(400).json({ error: 'faltan los lugares de la semana' });
      const plan = await pedirJSON(client, {
        sistema: SISTEMA + `\n\nAhora diseñas el PLAN DE LA SEMANA: un día por cada "semana.dias" (1 lunes … 7 domingo), en esos días exactos. Si "semana.hechas" trae sesiones ya hechas esta semana, planifica lo que queda teniéndolas en cuenta (no repitas lo trabajado si no se ha recuperado y completa lo que falta). Reparto según cuántos días sean: 2 cuerpo completo; 3 cuerpo completo o empuje/tirón/pierna; 4 torso/pierna; 5-6 cada músculo grande 2 veces. 48-72 h entre sesiones que repiten músculo grande. Si tiene piscina entre sus lugares y encaja con el objetivo o las lesiones, usa la piscina algún día. Cada ejercicio debe poder hacerse en el "lugar" del día (mira "lugares" de cada ejercicio).`,
        usuario: 'Plan de la semana con estos datos (JSON):\n\n' + JSON.stringify({ ...comun, semana: body.semana }),
        esquema: esquemaPlan(ids, idsSuaves, lugares), esfuerzo: 'medium', maxTokens: 48000,
      });
      (plan.dias || []).forEach(d => { d.ejercicios = (d.ejercicios || []).filter(e => ids.includes(e.id)); });
      return res.status(200).json({ plan });
    }
    const sesion = await pedirJSON(client, {
      sistema: SISTEMA + `\n\nAhora diseñas la SESIÓN DE HOY con su check-in (lugar, minutos, energía 1-5, dolor de hoy y lo que pida). Si hay "planDeHoy", parte de él y adáptalo al check-in; si no, decide tú lo que más le conviene hoy según la semana que lleva. "ajusteReglas" es lo que la app ya cambiaría por el check-in: tenlo en cuenta y mejóralo. En "cambios" di qué cambias respecto al día planificado y por qué.`,
      usuario: 'Sesión de hoy con estos datos (JSON):\n\n' + JSON.stringify({ ...comun, checkin: body.checkin, planDeHoy: body.planDeHoy || null, ajusteReglas: body.ajusteReglas || [] }),
      esquema: esquemaSesion(ids, idsSuaves), esfuerzo: body.planDeHoy ? 'low' : 'medium',
    });
    sesion.ejercicios = (sesion.ejercicios || []).filter(e => ids.includes(e.id));
    return res.status(200).json({ sesion });
  } catch (e) {
    return responderError(res, e, 'entrenador');
  }
}
