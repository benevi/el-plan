// Área ENTRENADOR · «Mis sesiones»: sesiones que la persona guarda para repetirlas otro día
// (p. ej. «solo abdominales y flexiones»).
//
// Forma (S.misSesiones, opcional; la conserva normalizar.js y va en las copias):
//   [{ id (estable: no cambia al renombrar), nombre (≤ 40), lugar, minutos|null, creada ISO, tipo?: 'suave',
//      ejercicios: [{ id del catálogo, rol, series, reps, descanso }] }]   // sin kilos: se recalculan
// Excepciones aprobadas por Víctor (docs/criterio.md, C-MIA-1 y C-MIA-2): se respeta tal cual (sin rellenar
// principales) y un ejercicio de nivel superior se queda con nota de técnica.
//
// Repetir una es el check-in con `ci.mia = id`: la sesión de hoy sale de ella SIN IA y pasa por lo mismo que
// un día del plan (ajustarAlCheckin → validador único) con el dolor, lugar, material, minutos y energía de hoy.
// Con dolor ≥ 7, salud «solo suave» o alarma manda el día de dolor alto / la alarma, como siempre.

import { estado, cambiar, uid } from '../../nucleo/estado.js';
import { ex } from '../../reglas/catalogo.js';
import { tiempoSesion } from './dia.js';

export const MAX_MIAS = 30;
export const LARGO_NOMBRE_MIA = 40;
const ROLES = ['principal', 'rehab', 'cardio'];

// Solo entradas con la forma buena (por si el estado viene de una versión rara): Perfil y el check-in no revientan.
const valida = m => !!m && typeof m === 'object' && typeof m.id === 'string' && typeof m.nombre === 'string' && Array.isArray(m.ejercicios);
export const misSesiones = S => (Array.isArray(S && S.misSesiones) ? S.misSesiones.filter(valida) : []);
// Ejercicios de la mía que existen en el catálogo (los demás no se pueden hacer).
export const ejerciciosMia = m => (m && Array.isArray(m.ejercicios) ? m.ejercicios.filter(x => x && ex(x.id)) : []);
export const miaDe = (S, id) => (id ? misSesiones(S).find(m => m.id === id) || null : null);
const limpiarNombre = n => String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE_MIA);

// Lo que se guarda de una sesión: solo ejercicios del catálogo, sin kilos ni lo apuntado.
export function miaDesdeSesion(s, nombre) {
  const ejercicios = (s.ejercicios || []).filter(x => x && ex(x.id)).slice(0, 30).map(x => ({
    id: x.id, rol: ROLES.includes(x.rol) ? x.rol : 'principal',
    series: Math.max(1, Math.min(10, Math.round(+x.series || (x.sets || []).length || ex(x.id).d[0]))),
    reps: String(x.reps || ex(x.id).d[1]).slice(0, 24),
    descanso: Math.max(0, Math.min(300, Math.round(+x.descanso >= 0 ? +x.descanso : ex(x.id).d[2]))),
  }));
  return { id: uid(), nombre: limpiarNombre(nombre), lugar: s.lugar || 'gym', minutos: Math.round(+s.minutos) || tiempoSesion(s) || null, creada: new Date().toISOString(),
    ...(s.tipo === 'suave' ? { tipo: 'suave' } : {}), ejercicios };
}

// Por qué no se puede guardar (null si se puede).
export function motivoNoGuardar(S, s, nombre) {
  const n = limpiarNombre(nombre);
  if (!s) return 'No encuentro esa sesión.';
  if (s.tipo === 'dolorAlto') return 'Es la sesión suave de un día de dolor alto: no se guarda, la app la monta cada vez con tu dolor de ese día.';
  if (!(s.ejercicios || []).some(x => x && ex(x.id))) return 'Esta sesión no tiene ejercicios que guardar.';
  if (!n) return 'Ponle un nombre.';
  if (misSesiones(S).length >= MAX_MIAS) return `Ya tienes ${MAX_MIAS} sesiones guardadas: borra alguna en Perfil › Mi entreno.`;
  if (misSesiones(S).some(m => m.nombre.toLowerCase() === n.toLowerCase())) return `Ya tienes una sesión que se llama «${n}».`;
  return null;
}

// Guarda la sesión `idSesion` como mía. Devuelve { mia } o { error }.
export function guardarMia(idSesion, nombre) {
  const S = estado(), s = S.sesiones[idSesion];
  const error = motivoNoGuardar(S, s, nombre);
  if (error) return { error };
  const mia = miaDesdeSesion(s, nombre);
  cambiar(S2 => { S2.misSesiones = [...misSesiones(S2), mia]; }, 'misSesiones');
  return { mia };
}

export function renombrarMia(id, nombre) {
  const S = estado(), n = limpiarNombre(nombre);
  if (!miaDe(S, id)) return { error: 'Esa sesión ya no está.' };
  if (!n) return { error: 'Ponle un nombre.' };
  if (misSesiones(S).some(m => m.id !== id && m.nombre.toLowerCase() === n.toLowerCase())) return { error: `Ya tienes una sesión que se llama «${n}».` };
  cambiar(S2 => { const m = miaDe(S2, id); if (m) m.nombre = n; }, 'misSesiones');
  return { mia: miaDe(estado(), id) };
}

export function borrarMia(id) {
  cambiar(S2 => { S2.misSesiones = misSesiones(S2).filter(m => m.id !== id); }, 'misSesiones');
}

// La mía como base de un día (la forma que entiende ajustarAlCheckin). Calentamiento y vuelta vacíos: se
// hacen con el lugar y el dolor de hoy.
export function miaComoDia(mia) {
  return {
    fuente: 'reglas', nombre: mia.nombre, foco: 'Tu sesión guardada', lugar: mia.lugar, minutos: mia.minutos,
    ...(mia.tipo === 'suave' ? { tipo: 'suave' } : {}),
    explicacion: [`Tu sesión «${mia.nombre}», ajustada a hoy por la app (sin IA): calentamiento, cardio y estiramientos siempre, y lo que no valga hoy se cambia.`],
    calentamiento: [], vuelta: [],
    ejercicios: ejerciciosMia(mia).map(x => ({ ...x })),
  };
}
