// Área ENTRENADOR (cerebro): crea la sesión del día y el plan semanal.
// Primero pregunta a la IA (/api/entrenador); si no hay red o falla, usa las reglas (reglas/generador.js).
// Todo lo que vuelve de la IA pasa por las barandillas: solo ejercicios del catálogo seguro, kilos acotados.

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { llamar } from '../../nucleo/api.js';
import { crearSesion, semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { generarSesion } from '../../reglas/generador.js';
import { perfilParaIA, lesionesParaIA, catalogoParaIA, historialParaIA } from '../../reglas/contexto.js';
import { acotarKg, sugerir, cargaMuscular } from '../../reglas/progresion.js';
import { nivelesZona, ex, riesgo } from '../../reglas/catalogo.js';
import { LUGARES } from '../../datos/constantes.js';

// Comentarios y gustos recientes que el entrenador debe leer para resolver problemas.
function peticionBase(S, lugares, dolorHoy) {
  const catalogo = catalogoParaIA(S, lugares, dolorHoy);
  const ids = catalogo.map(e => e.id);
  return { perfil: perfilParaIA(S), lesiones: lesionesParaIA(S, dolorHoy), catalogo, historial: historialParaIA(S, ids, { niveles: nivelesZona(S.perfil, dolorHoy) }), hoy: hoyISO(), diaSemana: diaSemana() };
}

function aplicarBarandillas(S, s) {
  s.ejercicios.forEach(x => {
    if (x.kg != null) { x.kg = acotarKg(S, x.id, x.kg); x.sets.forEach(z => { z.kg = x.kg; }); }
  });
  return s;
}

// checkin: { lugar, minutos, energia, dolorHoy, musculos?, peticion? (texto libre: "hoy solo tren superior") }
// Devuelve { sesion, aviso } — aviso explica si se usaron las reglas en vez de la IA.
export async function crearSesionHoy(checkin) {
  const S = estado();
  const lugar = checkin.lugar;
  let datos, aviso = '';
  try {
    const plan = planDeHoy(S);
    const r = await llamar('entrenador', {
      modo: 'sesion', ...peticionBase(S, [lugar], checkin.dolorHoy),
      checkin: { lugar: LUGARES[lugar], minutos: checkin.minutos, energia: checkin.energia, peticion: checkin.peticion || '' },
      planDeHoy: plan ? { nombre: plan.nombre, foco: plan.foco, lugar: LUGARES[plan.lugar], ejercicios: plan.ejercicios.map(x => x.id) } : null,
    });
    datos = { ...r.sesion, fuente: 'ia', lugar, minutos: checkin.minutos };
  } catch (e) {
    aviso = `Sesión hecha con las reglas de la app (${e.message}).`;
    datos = generarSesion(S, { lugar, minutos: checkin.minutos, energia: checkin.energia, dolorHoy: checkin.dolorHoy, musculos: checkin.musculos });
  }
  datos.checkin = { energia: checkin.energia, dolor: checkin.dolorHoy || {}, tiempo: checkin.minutos };
  const sesion = aplicarBarandillas(S, crearSesion(datos));
  if (!sesion.ejercicios.length) {
    // Respuesta vacía o rara: las reglas siempre dan algo.
    const r = crearSesion({ ...generarSesion(S, { lugar, minutos: checkin.minutos, energia: checkin.energia, dolorHoy: checkin.dolorHoy }), checkin: datos.checkin });
    aviso = 'La IA no propuso ejercicios válidos: sesión hecha con las reglas de la app.';
    cambiar(S2 => { S2.sesiones[r.id] = r; }, 'sesion');
    return { sesion: r, aviso };
  }
  cambiar(S2 => { S2.sesiones[sesion.id] = sesion; }, 'sesion');
  return { sesion, aviso };
}

// ── Plan semanal ──
export const planDeLaSemana = S => (S.plan && S.plan.semana === semanaISO() ? S.plan : null);
export function planDeHoy(S) {
  const p = planDeLaSemana(S); if (!p) return null;
  return p.dias.find(d => d.diaSemana === diaSemana()) || null;
}

// semana: { dias: [1..7], minutos, lugares }
export async function crearPlanSemana(semana) {
  const S = estado();
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  try {
    const r = await llamar('entrenador', {
      modo: 'plan', ...peticionBase(S, lugares, {}),
      semana: { dias: semana.dias, minutos: semana.minutos, lugares: lugares.map(l => ({ id: l, nombre: LUGARES[l] })) },
    }, { espera: 180000 });
    const plan = normalizarPlan(r.plan, 'ia', lugares);
    if (!plan.dias.length) throw new Error('plan vacío');
    cambiar(S2 => { S2.plan = plan; }, 'plan');
    return { plan, aviso: '' };
  } catch (e) {
    const plan = planPorReglas(S, semana, lugares);
    cambiar(S2 => { S2.plan = plan; }, 'plan');
    return { plan, aviso: `Plan hecho con las reglas de la app (${e.message}). Cada día se completa al prepararlo.` };
  }
}

function normalizarPlan(p, fuente, lugares) {
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente,
    resumen: String(p.resumen || ''), criterios: String(p.criterios || ''), progresion: String(p.progresion || ''),
    dias: (p.dias || []).map(d => {
      const lugar = lugares.includes(d.lugar) ? d.lugar : lugares[0];
      return {
        diaSemana: Math.max(1, Math.min(7, +d.diaSemana || 1)), nombre: String(d.nombre || '').slice(0, 60), foco: String(d.foco || '').slice(0, 80), lugar, minutos: +d.minutos || null,
        explicacion: (Array.isArray(d.explicacion) ? d.explicacion : [d.explicacion]).filter(Boolean).map(String),
        calentamiento: d.calentamiento || [], vuelta: d.vueltaCalma || d.vuelta || [],
        ejercicios: (d.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(lugar)),
      };
    }).sort((a, b) => a.diaSemana - b.diaSemana),
  };
}

// Sin IA: reparte los días y lugares; los ejercicios se eligen el mismo día con el check-in.
function planPorReglas(S, semana, lugares) {
  const dias = semana.dias.slice().sort();
  const pisc = lugares.includes('piscina');
  const nombres = dias.length <= 3 ? dias.map(() => 'Cuerpo completo') : dias.map((_, i) => (i % 2 ? 'Pierna y glúteo' : 'Torso'));
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'reglas',
    resumen: `${dias.length} días esta semana. Sin IA, cada sesión se monta el mismo día con tu energía y tu dolor de ese momento.`,
    criterios: 'Reparto sencillo: cuerpo completo con 3 días o menos, torso y pierna alternos con 4 o más; se respeta la recuperación de cada músculo.',
    progresion: 'Doble progresión: cuando llegues al tope de repeticiones en todas las series, sube el peso mínimo.',
    dias: dias.map((d, i) => {
      const lugar = pisc && dias.length >= 3 && i === dias.length - 1 ? 'piscina' : lugares.find(l => l !== 'piscina') || lugares[0];
      return { diaSemana: d, nombre: lugar === 'piscina' ? 'Piscina' : nombres[i], foco: '', lugar, minutos: semana.minutos, explicacion: [], calentamiento: [], vuelta: [], ejercicios: [] };
    }),
  };
}

// Convierte el día del plan en la sesión de hoy (sin red): ajusta kilos con la progresión.
export function sesionDesdePlan(dia, checkin) {
  const S = estado();
  if (!dia.ejercicios.length) return null;
  const niveles = nivelesZona(S.perfil, checkin.dolorHoy);
  const carga = cargaMuscular(S);
  const ejercicios = dia.ejercicios.filter(x => riesgo(ex(x.id), niveles) !== 'evitar').map(x => {
    const sg = sugerir(S, x.id, { series: x.series, reps: x.reps }, { energia: checkin.energia, niveles, carga });
    return { ...x, series: sg.series, reps: sg.reps, kg: sg.kg != null ? sg.kg : x.kg, motivo: sg.motivo };
  });
  const s = crearSesion({ ...dia, ejercicios, fuente: 'plan', checkin: { energia: checkin.energia, dolor: checkin.dolorHoy || {}, tiempo: checkin.minutos } });
  cambiar(S2 => { S2.sesiones[s.id] = s; }, 'sesion');
  return s;
}
