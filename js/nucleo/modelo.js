// Forma única de una sesión y de un plan semanal. La crean el entrenador (IA o reglas) y la usan
// la pantalla de sesión, Hoy y Progreso. Si cambias algo aquí, cambia el contrato de todas las áreas.
//
// Sesión:
// {
//   id, fecha 'YYYY-MM-DD', creada ISO, fuente: 'ia' | 'reglas' | 'plan' | 'anterior',
//   nombre, foco, lugar: 'gym'|'piscina'|'casa'|'calle', minutos,
//   explicacion: [texto],                       // el porqué de la sesión, punto a punto
//   checkin: { energia 1-5, dolor: { zona: 0-10 }, tiempo: minutos } | null,
//   calentamiento: [tarea], vuelta: [tarea],      // tarea = { id|null, nombre, detalle, duracion, hecho }
//   ejercicios: [{
//     id, rol: 'principal' | 'rehab' | 'cardio', series, reps: '8-12'|'30-45s'|'25 m', descanso (s), kg|null,
//     nota, motivo,                               // nota del entrenador · motivo de la progresión
//     sets: [{ kg|null, valor: '12'|'40'|'1:30', hecha }],
//     gusto: 'rechazo'|'nogusta'|'gusta'|null, comentario,
//     superserie?: true,                        // va en pareja con el siguiente (último recurso de tiempo)
//     dolorDurante?: { zona, dolor, antes, techo }  // se paró: el dolor pasó del límite (C-DOLOR-6, «Algo va mal»)
//   }],
//   estado: 'pendiente' | 'en_curso' | 'hecha', empezada, terminada,
//   cierre: { esfuerzo 1-5, dolor: { zona: 0-10 }, comentario } | null,
//   origen?: { tipo: 'mia', id }               // hecha a partir de una de «Mis sesiones» (S.misSesiones)
//   parada?: 'alarma'                          // terminada con «Algo va mal» por una señal de alarma (C-ALAR-1)
//   iaFallo?: { motivo, peticion?, atendido?, diaPlan 1-7|null, reintentable, huella }  (huella: huellaSesion al crearla)  // la hizo la app sin la IA (PR 12):
//            motivo completa «La ha hecho la app porque…»; peticion = lo pedido en el check-in sin atender;
//            atendido = la parte que sí entendió la app («hoy pierna y glúteo»)
// }
//
// Plan semanal:
// { semana 'YYYY-Www', creado ISO, fuente, resumen, criterios, progresion,
//   dias: [{ diaSemana 1-7, nombre, foco, lugar, minutos, explicacion: [texto], calentamiento, ejercicios, vuelta }],
//   iaFallo?: { motivo, semana: { dias, minutos, lugares } },   // la hizo la app porque falló la IA (PR 12)
//   noPuedo?: [diaSemana] }   // días en que dijo «Hoy no puedo» sin otro día libre (E13): no cuentan como «Hoy toca»

import { uid, hoyISO } from './estado.js';
import { ex } from '../reglas/catalogo.js';

const tarea = t => ({ id: t.id && ex(t.id) ? t.id : null, nombre: String(t.nombre || (t.id && ex(t.id) ? ex(t.id).n : '')).slice(0, 80), detalle: String(t.detalle || '').slice(0, 300), duracion: String(t.duracion || '').slice(0, 20), hecho: false });

export function crearEjercicio(x) {
  const e = ex(x.id);
  const series = Math.max(1, Math.min(10, Math.round(+x.series || (e ? e.d[0] : 3))));
  const kg = +x.kg > 0 && +x.kg < 400 ? Math.round(+x.kg * 4) / 4 : null;
  return {
    id: x.id, rol: ['principal', 'rehab', 'cardio'].includes(x.rol) ? x.rol : 'principal',
    series, reps: String(x.reps || (e ? e.d[1] : '10')).slice(0, 24),
    descanso: Math.max(0, Math.min(300, Math.round(+x.descanso >= 0 && x.descanso !== '' && x.descanso != null ? +x.descanso : (e ? e.d[2] : 60)))),
    kg, nota: cortarTexto(x.nota, 300), motivo: String(x.motivo || '').slice(0, 300).trim(),
    sets: Array.from({ length: series }, () => ({ kg, valor: '', hecha: false })),
    gusto: null, comentario: '',
    ...(x.superserie === true ? { superserie: true } : {}),
  };
}

// Corta un texto largo en la última frase completa que quepa o, si no hay, en el último espacio con «…»;
// nunca a mitad de palabra (revisión del PR #53).
export function cortarTexto(t, max) {
  t = String(t || '').trim();
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const punto = Math.max(c.lastIndexOf('. '), c.endsWith('.') ? c.length - 1 : -1);
  if (punto >= max / 2) return c.slice(0, punto + 1);
  const esp = c.slice(0, max - 1).lastIndexOf(' ');
  return (esp > 0 ? c.slice(0, esp) : c.slice(0, max - 1)).replace(/[\s,;:]+$/, '') + '…';
}

export function crearSesion(d) {
  const s = {
    id: uid(), fecha: d.fecha || hoyISO(), creada: new Date().toISOString(), fuente: d.fuente || 'reglas',
    nombre: String(d.nombre || 'Sesión').slice(0, 60), foco: String(d.foco || '').slice(0, 80), lugar: d.lugar || 'gym', minutos: +d.minutos || null,
    explicacion: (Array.isArray(d.explicacion) ? d.explicacion : d.explicacion ? [d.explicacion] : []).map(x => String(x).slice(0, 400)).filter(Boolean).slice(0, 8),
    checkin: d.checkin || null,
    calentamiento: (d.calentamiento || []).map(tarea).filter(t => t.nombre),
    ejercicios: (d.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(d.lugar || 'gym')).map(crearEjercicio),
    vuelta: (d.vuelta || d.vueltaCalma || []).map(tarea).filter(t => t.nombre),
    estado: 'pendiente', empezada: null, terminada: null, cierre: null,
    // Opcional: el tipo de día que cambia lo que se comprueba (día suave del reparto, día de dolor alto).
    ...(TIPOS_SESION.includes(d.tipo) ? { tipo: d.tipo } : {}),
    ...origenSesion(d.origen),
  };
  const f = d.iaFallo ? iaFalloSesion(d.iaFallo) : undefined;
  // La huella de cómo quedó al crearla: si luego cambia (kilos, series, comentarios…), ya no se rehace.
  if (f) s.iaFallo = { ...f, huella: huellaSesion(s) };
  return s;
}
// Huella de lo que la persona puede cambiar en una sesión: estado, tareas hechas y, por ejercicio, cuál es,
// series, kilos, lo apuntado, gusto y comentario. Corta (djb2 en base 36); no lleva iaFallo.
export function huellaSesion(s) {
  const t = JSON.stringify([s.estado, (s.calentamiento || []).map(x => !!x.hecho), (s.vuelta || []).map(x => !!x.hecho), s.cierre || null,
    (s.ejercicios || []).map(x => [x.id, x.rol, x.series, x.reps, x.descanso, x.kg, (x.sets || []).map(z => [z.kg, z.valor, !!z.hecha]), x.gusto || null, x.comentario || '', ...(x.dolorDurante ? [x.dolorDurante] : [])])]);
  let n = 5381;
  for (let i = 0; i < t.length; i++) n = ((n * 33) ^ t.charCodeAt(i)) >>> 0;
  return n.toString(36);
}
// ¿Ha tocado la persona esta sesión desde que la hizo la app? (entonces «Reintentar con IA» ya no se ofrece).
export function sesionTocada(s) {
  if (!s || s.estado !== 'pendiente') return true;
  if (s.iaFallo && s.iaFallo.huella) return huellaSesion(s) !== s.iaFallo.huella;
  return (s.calentamiento || []).some(t => t.hecho) || (s.vuelta || []).some(t => t.hecho) ||
    (s.ejercicios || []).some(x => x.comentario || x.gusto || x.sets.length !== x.series || x.sets.some(z => z.hecha || (z.valor != null && z.valor !== '') || z.kg !== x.kg));
}
// ¿Hay algo hecho en la sesión? Series marcadas, tareas de calentamiento o vuelta a la calma marcadas (un día de
// dolor alto puede no llevar ejercicios) o un ejercicio parado por dolor (C-DOLOR-6). Sin nada de esto, la
// sesión no se guarda como hecha ni cuenta para la constancia (E7).
export const trabajoHecho = s => !!s && ((s.ejercicios || []).some(x => x.dolorDurante || (x.sets || []).some(z => z.hecha))
  || [...(s.calentamiento || []), ...(s.vuelta || [])].some(t => t.hecho));
// Forma de la nota «La ha hecho la app porque…» (la usan crearSesion y el normalizador de copias).
export function iaFalloSesion(f) {
  if (!f || typeof f !== 'object' || typeof f.motivo !== 'string' || !f.motivo.trim()) return undefined;
  const ds = Number.isInteger(f.diaPlan) && f.diaPlan >= 1 && f.diaPlan <= 7 ? f.diaPlan : null;
  return { motivo: f.motivo.slice(0, 300), ...(typeof f.peticion === 'string' && f.peticion.trim() ? { peticion: f.peticion.slice(0, 300) } : {}),
    ...(typeof f.atendido === 'string' && f.atendido.trim() ? { atendido: f.atendido.slice(0, 120) } : {}), diaPlan: ds, reintentable: f.reintentable !== false,
    ...(typeof f.huella === 'string' && /^[a-z0-9]{1,16}$/.test(f.huella) ? { huella: f.huella } : {}) };
}
export const TIPOS_SESION = ['suave', 'dolorAlto'];
// Marca de origen (opcional): de qué sesión guardada sale. La usan crearSesion y el normalizador de copias.
export function origenSesion(o) {
  return o && typeof o === 'object' && o.tipo === 'mia' && typeof o.id === 'string' && /^[\w-]{1,80}$/.test(o.id) ? { origen: { tipo: 'mia', id: o.id } } : {};
}

// Semana ISO: '2026-W47'
export function semanaISO(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - ini) / 864e5 + 1) / 7)).padStart(2, '0');
}
export const diaSemana = (d = new Date()) => d.getDay() || 7;

// Sesión de hoy (la última creada con fecha de hoy).
export function sesionDeHoy(S) {
  const hoy = hoyISO();
  return Object.values(S.sesiones).filter(s => s.fecha === hoy && s.fuente !== 'anterior').sort((a, b) => b.creada.localeCompare(a.creada))[0] || null;
}
