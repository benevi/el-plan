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
import { LUGARES } from '../../datos/constantes.js';
import { tiempoSesion, dosis } from './dia.js';
import { ajustarAlCheckin } from './checkin.js'; // solo dentro de funciones (checkin.js también importa de aquí)

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

// ── Editor de «Mis sesiones» (PR 16, sin IA) ──
// Crear una sesión desde cero o cambiar una guardada: nombre, lugar y ejercicios del catálogo, cada uno con
// sus series, repeticiones o tiempo y descanso. La forma guardada es la de siempre (ninguna clave nueva).
// Los valores que propone la app salen de la dosis de las reglas (C-DOSIS-2 a C-DOSIS-6, C-PAUSA-1) con el
// tope de series de D-B (aprobada por Víctor el 21-11-2026): 3 para principiante y 4 para intermedio y
// avanzado; en natación, por distancia, hasta 10 (C-SERIES-1). Al hacerla se ajusta a ese día como cualquier
// otra mía (C-MIA-1, C-MIA-2): esta parte solo guarda.
export const MAX_EJERCICIOS_MIA = 30;
export const DESCANSO_MAX_MIA = 300;

const nivelDe = S => Math.max(1, Math.min(3, +(S && S.perfil && S.perfil.nivel) || 1));
// Tope de series de un ejercicio para esta persona.
export function topeSeriesMia(S, e) {
  if (e && e.t === 'distancia') return 10;
  return nivelDe(S) === 1 ? 3 : 4;
}
// El cardio va con su rol (cuenta como el cardio del día); lo demás, como principal. La rehabilitación la pone
// la app al hacerla, según las zonas activas de ese día (C-DOLOR-3).
export const rolMia = e => (e && e.m[0] === 'cardio' ? 'cardio' : 'principal');

// Lo que propone la app para el ejercicio `id` en la posición `i` (0 = primero de la sesión).
export function propuestaMia(S, id, i = 0) {
  const e = ex(id);
  if (!e) return null;
  const d = dosis(S, e, i);
  const series = Math.max(1, Math.min(topeSeriesMia(S, e), Math.round(+d.series) || 1));
  return { id, rol: rolMia(e), series, reps: String(d.reps || e.d[1]).slice(0, 24), descanso: Math.max(0, Math.min(DESCANSO_MAX_MIA, Math.round(+d.descanso) || 0)) };
}

// Un ejercicio tal como lo deja el editor, dentro de los límites (los del normalizador y el tope de D-B).
function ejercicioEditado(S, x) {
  const e = x && ex(x.id);
  if (!e) return null;
  return {
    id: e.id, rol: ROLES.includes(x.rol) ? x.rol : rolMia(e),
    series: Math.max(1, Math.min(topeSeriesMia(S, e), Math.round(+x.series) || 1)),
    reps: String(x.reps || e.d[1]).replace(/\s+/g, ' ').trim().slice(0, 24) || String(e.d[1]),
    descanso: Math.max(0, Math.min(DESCANSO_MAX_MIA, Math.round(+x.descanso) || 0)),
  };
}

// Minutos de una mía tal como la monta el check-in (calentamiento, cardio, ejercicios y vuelta a la calma), con
// las mismas opciones de tiempo que el check-in: así «unos N min» de Perfil y el aviso «dura más de lo que
// marcas» del check-in cuentan lo mismo. Sin dolor ni energía especiales (los de ese día pueden cambiarlo).
const OPCIONES_MIN = [30, 45, 60, 75, 90];
export function minutosMia(S, mia) {
  const estimado = tiempoSesion({ calentamiento: [], vuelta: [], ejercicios: mia.ejercicios || [] });
  let min = OPCIONES_MIN.find(x => x >= estimado) || 90, dura = 0;
  const S2 = { ...S, misSesiones: [mia] };
  for (let k = 0; k < OPCIONES_MIN.length; k++) {
    let r;
    try { r = ajustarAlCheckin(S2, null, { lugar: mia.lugar, minutos: min, energia: 3, dolorHoy: {}, peticion: '', mia: mia.id }); } catch { break; }
    if (!r || !r.datos || !r.datos.origen || r.datos.origen.tipo !== 'mia') break; // día suave por salud: no es la mía
    dura = tiempoSesion(r.datos);
    const sig = OPCIONES_MIN.find(x => x >= dura);
    if (dura <= min * 1.1 || !sig || sig === min) break;
    min = sig;
  }
  return Math.max(10, Math.min(240, Math.round(dura || estimado) || 10));
}

// Por qué no se puede guardar lo editado (null si se puede). `id`: la que se está cambiando (null si es nueva).
export function motivoNoGuardarEdicion(S, datos, id = null) {
  const n = limpiarNombre(datos && datos.nombre);
  const ejs = (datos && Array.isArray(datos.ejercicios) ? datos.ejercicios : []).filter(x => x && ex(x.id));
  if (id && !miaDe(S, id)) return 'Esa sesión ya no está.';
  if (!n) return 'Ponle un nombre.';
  if (misSesiones(S).some(m => m.id !== id && m.nombre.toLowerCase() === n.toLowerCase())) return `Ya tienes una sesión que se llama «${n}».`;
  if (!ejs.length) return 'Añade al menos un ejercicio.';
  if (ejs.length > MAX_EJERCICIOS_MIA) return `Como mucho ${MAX_EJERCICIOS_MIA} ejercicios por sesión.`;
  if (!id && misSesiones(S).length >= MAX_MIAS) return `Ya tienes ${MAX_MIAS} sesiones guardadas: borra alguna antes de crear otra.`;
  return null;
}

// Guarda lo editado: crea una nueva (id null) o cambia la guardada conservando su id, su fecha y si es suave.
// Devuelve { mia } o { error }.
export function guardarEdicionMia(id, datos) {
  const S = estado();
  const error = motivoNoGuardarEdicion(S, datos, id);
  if (error) return { error };
  const ejercicios = datos.ejercicios.map(x => ejercicioEditado(S, x)).filter(Boolean);
  const lugar = Object.keys(LUGARES).includes(datos.lugar) ? datos.lugar : 'gym';
  const nombre = limpiarNombre(datos.nombre);
  const minutos = minutosMia(S, { id: id || '__nueva__', nombre: nombre || 'x', lugar, ejercicios, ...(id && miaDe(S, id) && miaDe(S, id).tipo === 'suave' ? { tipo: 'suave' } : {}) });
  let mia;
  if (id) {
    cambiar(S2 => {
      const m = miaDe(S2, id);
      if (m) Object.assign(m, { nombre, lugar, minutos, ejercicios });
    }, 'misSesiones');
    mia = miaDe(estado(), id);
  } else {
    mia = { id: uid(), nombre, lugar, minutos, creada: new Date().toISOString(), ejercicios };
    cambiar(S2 => { S2.misSesiones = [...misSesiones(S2), mia]; }, 'misSesiones');
  }
  return { mia };
}

// Atajo de la ficha: añade el ejercicio al final de una guardada con lo que propone la app.
export function añadirAMia(id, idEjercicio) {
  const S = estado(), m = miaDe(S, id), e = ex(idEjercicio);
  if (!m) return { error: 'Esa sesión ya no está.' };
  if (!e) return { error: 'Ese ejercicio no está en el catálogo.' };
  if (m.ejercicios.some(x => x && x.id === e.id)) return { error: `«${e.n}» ya está en «${m.nombre}».` };
  if (ejerciciosMia(m).length >= MAX_EJERCICIOS_MIA) return { error: `«${m.nombre}» ya tiene ${MAX_EJERCICIOS_MIA} ejercicios.` };
  // Mismo índice que el editor: el puesto entre los que no son cardio (la dosis de los dos primeros es otra).
  const i = ejerciciosMia(m).filter(x => x.rol !== 'cardio').length;
  return guardarEdicionMia(id, { nombre: m.nombre, lugar: m.lugar, ejercicios: [...ejerciciosMia(m), propuestaMia(S, e.id, i)] });
}
