// Matriz de 336 casos del plan (T1-T3): 7 perfiles × 4 lugares × 3 duraciones × dolor alto sí/no × con/sin plan,
// por el camino de reglas (sin IA) y con respuestas de IA simuladas. De t2_req.mjs de la auditoría.
import { nuevoS, ent, cat, modelo, ponerRed } from './node.mjs';

export const PERFILES = {
  'solo musculo': { objetivos: ['musculo'] }, 'solo fuerza': { objetivos: ['fuerza'] }, 'solo perder': { objetivos: ['perder'] },
  'solo resistencia': { objetivos: ['resistencia'] }, 'solo salud': { objetivos: ['salud'] }, 'solo natacion': { objetivos: ['natacion'] },
  'musculo+perder': { objetivos: ['musculo', 'perder'] },
};
export const LUGARES = ['gym', 'piscina', 'casa', 'calle'];
export const MINUTOS = [20, 30, 60];
const CON_CARGA = ['maquina', 'polea', 'mancuernas', 'barra', 'botellas'];

export const esEstiramiento = t => /estir|postura|flotaci/i.test(t.nombre) || (t.id && /estir|postura-nino|gato-camello|flotacion/.test(t.id));
export const esCardio = x => x.rol === 'cardio' || ['cardio', 'natacion'].includes((cat.ex(x.id) || { m: [] }).m[0]);
export const conCarga = x => (cat.ex(x.id) || { mat: [] }).mat.some(m => CON_CARGA.includes(m));

// Un perfil de la matriz: estado nuevo (global de la app) y check-in.
function preparar(p, lugar, minutos, dolor) {
  const S = nuevoS({ ...p, lugares: [lugar], materialCasa: [] });
  if (dolor) S.perfil.lesiones.push({ id: 'l', zona: 'rodilla', dolor: 3, activa: true, desde: '2026-01-01' });
  const ci = { lugar, minutos, energia: 3, dolorHoy: dolor ? { rodilla: dolor } : {}, peticion: '' };
  return { S, ci };
}
function* combinaciones() {
  for (const [pn, p] of Object.entries(PERFILES)) for (const lugar of LUGARES) for (const minutos of MINUTOS) for (const dolor of [null, 8]) {
    yield { pn, p, lugar, minutos, dolor, nombre: `${pn} | ${lugar} | ${minutos} min | dolor ${dolor || '-'}` };
  }
}

// Camino de reglas: { nombre, minutos, dolor, ci, S, sesion }.
export function casos() {
  const filas = [];
  for (const c of combinaciones()) {
    const { S, ci } = preparar(c.p, c.lugar, c.minutos, c.dolor);
    filas.push({ nombre: c.nombre + ' | sin plan', minutos: c.minutos, dolor: c.dolor, ci, S, sesion: modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos) });
    const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: c.minutos, lugares: [c.lugar] });
    filas.push({ nombre: c.nombre + ' | plan', minutos: c.minutos, dolor: c.dolor, ci, S, sesion: modelo.crearSesion(ent.ajustarAlCheckin(S, plan.dias[0], ci).datos) });
  }
  return filas;
}

// Respuestas de IA simuladas (C-IA-3): vacía, solo cardio, rehabilitación de una sola zona, jalón con rol de
// cardio, ejercicios de todos los lugares con series y kilos absurdos, y sin calentamiento ni estiramientos.
const T = (n, d = '2 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: '', ...o });
export const RESPUESTAS_IA = {
  vacia: { nombre: 'Nada', ejercicios: [] },
  soloCardio: { nombre: 'Cardio', calentamiento: [T('a'), T('b')], ejercicios: [E('bici-estatica', 'cardio', { reps: '40 min' }), E('aquajogging', 'cardio', { reps: '30 min' })], vueltaCalma: [T('Respirar')] },
  rehabUnaZona: { nombre: 'Rehab', ejercicios: [E('puente-gluteo', 'rehab'), E('sentadilla-isometrica', 'rehab'), E('flexiones'), E('press-pecho-maquina'), E('crol')], vueltaCalma: [] },
  jalonCardio: { nombre: 'Jalón', ejercicios: [E('jalon-pecho', 'cardio', { reps: '20 min' }), E('press-pecho-maquina'), E('prensa-piernas', 'principal', { kg: 300 }), E('remo-australiano'), E('patada-crol-tabla', 'principal', { reps: '4 × 25 m' })] },
  todoMezclado: {
    nombre: 'Mezcla', calentamiento: [T('Bici'), { id: 'postura-nino', nombre: 'Postura del niño', duracion: '2 min' }], vueltaCalma: [T('Beber agua'), T('Ducha')],
    ejercicios: ['sentadilla-barra', 'carrera-suave', 'comba', 'flexiones', 'sentadilla-peso-corporal', 'remo-toalla', 'crol', 'espalda', 'press-banca-mancuernas', 'zancadas', 'step-up', 'plancha']
      .map(id => E(id, 'principal', { series: 9, reps: '1:30', kg: 80 })),
  },
};
// Camino de IA: crearSesionHoy con la red simulada. { nombre, minutos, dolor, ci, S, sesion, peticiones }.
export async function casosIA(respuestas = RESPUESTAS_IA) {
  const filas = [];
  for (const c of combinaciones()) for (const conPlan of [false, true]) for (const [rn, r] of Object.entries(respuestas)) {
    const { S, ci } = preparar(c.p, c.lugar, c.minutos, c.dolor);
    if (conPlan) S.plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: c.minutos, lugares: [c.lugar] });
    let peticiones = 0;
    ponerRed(true, async () => { peticiones++; return { ok: true, status: 200, json: async () => ({ sesion: structuredClone(r) }) }; });
    const { sesion } = await ent.crearSesionHoy({ ...ci, forzarIA: true, diaPlan: conPlan ? 1 : null });
    filas.push({ nombre: `${c.nombre} | ${conPlan ? 'plan' : 'sin plan'} | IA ${rn}`, minutos: c.minutos, dolor: c.dolor, ci, S, sesion, peticiones });
  }
  ponerRed(false);
  return filas;
}
