// Matriz de 336 casos del plan (T1-T3): 7 perfiles × 4 lugares × 3 duraciones × dolor alto sí/no × con/sin plan,
// por el camino de reglas (sin IA). De t2_req.mjs de la auditoría.
import { nuevoS, ent, cat, modelo } from './node.mjs';

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

export function casos() {
  const filas = [];
  for (const [pn, p] of Object.entries(PERFILES)) for (const lugar of LUGARES) for (const minutos of MINUTOS) for (const dolor of [null, 8]) {
    const S = nuevoS({ ...p, lugares: [lugar], materialCasa: [] });
    if (dolor) S.perfil.lesiones.push({ id: 'l', zona: 'rodilla', dolor: 3, activa: true });
    const ci = { lugar, minutos, energia: 3, dolorHoy: dolor ? { rodilla: dolor } : {}, peticion: '' };
    const nombre = `${pn} | ${lugar} | ${minutos} min | dolor ${dolor || '-'}`;
    filas.push({ nombre: nombre + ' | sin plan', minutos, dolor, sesion: modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos) });
    const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos, lugares: [lugar] });
    filas.push({ nombre: nombre + ' | plan', minutos, dolor, sesion: modelo.crearSesion(ent.ajustarAlCheckin(S, plan.dias[0], ci).datos) });
  }
  return filas;
}
