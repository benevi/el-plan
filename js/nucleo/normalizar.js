// Normalizador del estado (versión 4): reconstruye desde cero un estado válido a partir de lo que venga
// de fuera (una copia importada, la copia interna del espejo). Nada que traiga la copia llega a la app
// ni a ningún innerHTML sin pasar por aquí.
//
// - Solo se copian las claves conocidas; lo demás se descarta (también `__proto__` y compañía).
// - Tipos y rangos: números finitos y acotados, textos recortados y sin caracteres de control,
//   ids `^[\w-]+$`, fechas 'YYYY-MM-DD' o ISO, listas cerradas (lugares, objetivos, zonas de lesión…).
// - Lo que no se puede arreglar se quita y se cuenta en `avisos` (p. ej. lesiones de zonas desconocidas).
// - Nunca trae `ajustes.codigo` ni `ajustes.apiUrl`: el código de acceso lo pone quien llama (el del móvil).
//
// normalizarEstado(x) → { estado, avisos: [texto] }. Lanza ErrorCopia si no es una copia de la versión 4.

import { ZONAS } from '../datos/lesiones.js';
import { PERSONAS, LUGARES, OBJETIVOS, MATERIAL_CASA, GUSTOS, LARGO_TEXTO } from '../datos/constantes.js';
import { EJERCICIOS } from '../datos/ejercicios.js';

export const VERSION_DATOS = 4;

// Error con un mensaje en español claro para la persona. `codigo` sirve a la interfaz para decidir
// (p. ej. 'otra-persona' → pedir confirmación) y `info` lleva datos para el mensaje.
export class ErrorCopia extends Error {
  constructor(msg, codigo = 'invalida', info = {}) { super(msg); this.name = 'ErrorCopia'; this.codigo = codigo; this.info = info; }
}

// ── Piezas ──
const PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);
export const esObjeto = x => !!x && typeof x === 'object' && !Array.isArray(x);
const RE_ID = /^[\w-]+$/;
export const idValido = v => typeof v === 'string' && v.length > 0 && v.length <= 80 && RE_ID.test(v) && !PROHIBIDAS.has(v);
const id = v => (idValido(v) ? v : null);

// Texto: solo cadenas (o números), sin caracteres de control (salvo saltos de línea y tabuladores), recortado.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export function texto(v, max = 300) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  return v.replace(CONTROL, '').trim().slice(0, max);
}
// Número finito dentro de [min, max] (los de fuera se acotan). Si no es número, `def`.
export function numero(v, min, max, def = null, { entero = false } = {}) {
  if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) v = parseFloat(v.replace(',', '.'));
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  if (entero) v = Math.round(v);
  return Math.min(max, Math.max(min, v));
}
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
const enLista = (v, lista, def = null) => (typeof v === 'string' && lista.includes(v) ? v : def);
const lista = (v, max = 500) => (Array.isArray(v) ? v.slice(0, max) : []);

// Fecha 'YYYY-MM-DD' que existe de verdad.
export function fechaDia(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [a, m, d] = v.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && a >= 1900 && a <= 2200 ? v : null;
}
// Fecha y hora ISO ('2026-11-19T18:00:00.000Z') o solo el día. Devuelve el texto tal cual si es válido.
export function fechaISO(v) {
  if (typeof v !== 'string' || v.length > 40) return null;
  if (fechaDia(v)) return v;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

// Zonas de lesión: las del catálogo (js/datos/lesiones.js) y algunos nombres sueltos que se entienden.
const ALIAS_ZONAS = { cadera: 'cadera_lateral', trocanter: 'cadera_lateral', trocanteritis: 'cadera_lateral', tobillo: 'tobillo_pie', pie: 'tobillo_pie', cuello: 'cervical', muneca: 'muñeca', lumbares: 'lumbar',
  espalda_alta: 'dorsal', dorsales: 'dorsal', toracica: 'dorsal', toracico: 'dorsal' };
export function zona(v) {
  if (typeof v !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(ZONAS, v)) return v;
  const k = v.trim().toLowerCase().replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(ZONAS, k)) return k;
  const sin = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const alias = x => (Object.prototype.hasOwnProperty.call(ALIAS_ZONAS, x) ? ALIAS_ZONAS[x] : null); // nada de «__proto__»
  return alias(k) || alias(sin) || null;
}
// { zona: 0-10 } con solo zonas conocidas.
function dolorPorZona(v) {
  const out = {};
  if (!esObjeto(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    const z = zona(k), d = numero(n, 0, 10, null, { entero: true });
    if (z && d != null) out[z] = d;
  }
  return out;
}

const ROLES = ['principal', 'rehab', 'cardio'];
const ESTADOS = ['pendiente', 'en_curso', 'hecha'];
const FUENTES = ['ia', 'reglas', 'plan', 'anterior'];
const MOMENTOS = ['antes', 'despues', 'dia', 'perfil'];
const TIPOS_LESION = ['lesion', 'recurrente', 'puntual']; // como TIPOS_LESION en areas/perfil/indice.js
const USO_IA = ['auto', 'siempre', 'ahorro'];
// Textos libres de la persona (notas, comentarios): se recortan al límite de la interfaz (LARGO_TEXTO) y se
// cuenta cuántos, para avisar (D4): nunca un recorte en silencio.
let recortados = 0;
function libre(v, max) {
  const t = texto(v, Infinity);
  if (t.length > max) recortados++;
  return t.slice(0, max);
}
const MEDIDAS = ['peso', 'cintura', 'cadera', 'cuello', 'pecho', 'brazo', 'muslo', 'grasa'];

// ── Perfil ──
function lesion(l, avisos, vistos) {
  if (!esObjeto(l)) return null;
  const z = zona(l.zona);
  if (!z) { avisos.push(`Lesión de zona desconocida («${texto(l.zona, 30) || 'sin zona'}») no traída`); return null; }
  let i = id(l.id);
  if (!i || vistos.has(i)) { i = 'l' + vistos.size + '-' + Math.random().toString(36).slice(2, 7); }
  vistos.add(i);
  const out = {
    id: i, zona: z, dolor: numero(l.dolor, 0, 10, 3, { entero: true }), desde: fechaDia(l.desde) || '',
    nota: libre(l.nota, LARGO_TEXTO.notaLesion), activa: bool(l.activa, true),
  };
  const tipo = enLista(l.tipo, TIPOS_LESION); if (tipo) out.tipo = tipo;
  // Detalle opcional (esguince, fascitis…): solo si es una opción de esa zona; si no, se usa el de por defecto.
  const opciones = (ZONAS[z].detalles || {}).opciones;
  if (typeof l.detalle === 'string' && opciones && Object.prototype.hasOwnProperty.call(opciones, l.detalle)) out.detalle = l.detalle;
  if (l.dolorRevisar === true) out.dolorRevisar = true;
  if (typeof l.vid === 'string' && l.vid.length <= 200) out.vid = texto(l.vid, 200);
  return out;
}

function perfil(p, avisos) {
  p = esObjeto(p) ? p : {};
  const objetivos = (typeof p.objetivos === 'string' ? [p.objetivos] : lista(p.objetivos, 20))
    .filter(o => typeof o === 'string' && Object.prototype.hasOwnProperty.call(OBJETIVOS, o));
  const d = esObjeto(p.disponibilidad) ? p.disponibilidad : {};
  const diasSemana = [...new Set(lista(d.diasSemana, 7).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
  const lugares = [...new Set(lista(p.lugares, 10).filter(l => typeof l === 'string' && Object.prototype.hasOwnProperty.call(LUGARES, l)))];
  const gustos = {};
  if (esObjeto(p.gustos)) {
    for (const [k, g] of Object.entries(p.gustos).slice(0, 500)) {
      if (idValido(k) && typeof g === 'string' && Object.prototype.hasOwnProperty.call(GUSTOS, g)) gustos[k] = g;
    }
  }
  const datos = esObjeto(p.datos) ? p.datos : {};
  const año = texto(datos.nacimiento, 10).slice(0, 4);
  const vistos = new Set();
  const out = {
    objetivos: [...new Set(objetivos)],
    nivel: numero(p.nivel, 1, 3, 1, { entero: true }),
    nivelAuto: bool(p.nivelAuto, true),
    lesiones: lista(p.lesiones, 100).map(l => lesion(l, avisos, vistos)).filter(Boolean),
    disponibilidad: { dias: numero(d.dias, 1, 7, 3, { entero: true }), minutos: numero(d.minutos, 10, 240, 60, { entero: true }), diasSemana },
    lugares: lugares.length ? lugares : ['gym'],
    materialCasa: [...new Set(lista(p.materialCasa, 20).filter(m => MATERIAL_CASA.includes(m)))],
    gustos,
    datos: {
      sexo: enLista(datos.sexo, ['h', 'm'], ''),
      altura: numero(datos.altura, 50, 250, null),
      nacimiento: /^\d{4}$/.test(año) && +año >= 1900 && +año <= 2100 ? año : '',
    },
    notas: libre(p.notas, LARGO_TEXTO.notasPerfil),
  };
  const uso = enLista(p.usoIA, USO_IA); if (uso) out.usoIA = uso;
  if (typeof p.acompañado === 'boolean') out.acompañado = p.acompañado;
  if (Array.isArray(p.nivelCambios)) {
    out.nivelCambios = lista(p.nivelCambios, 50).filter(esObjeto).map(c => ({
      fecha: fechaISO(c.fecha), de: numero(c.de, 1, 3, null, { entero: true }), a: numero(c.a, 1, 3, null, { entero: true }), motivo: texto(c.motivo, 300),
    })).filter(c => c.fecha && c.de && c.a);
  }
  if (p.nadar25 === true) out.nadar25 = true;
  const sal = salud(p.salud); if (sal) out.salud = sal;
  return out;
}

// Datos de salud (D4, opcional): solo claves conocidas y valores de listas cerradas (js/areas/entrenador/salud.js).
const SALUD_BOOL = ['cesarea', 'cardiopatia', 'diabetes', 'diabetesVista', 'diabetesPies', 'protesis', 'epilepsia', 'asma', 'equilibrio'];
const VISTO_BUENO = ['hipertension', 'embarazo', 'posparto', 'cardiopatia', 'diabetes', 'osteoporosis', 'protesis'];
function salud(s) {
  if (!esObjeto(s)) return null;
  const out = {};
  const h = enLista(s.hipertension, ['controlada', 'sin_controlar']); if (h) out.hipertension = h;
  const emb = numero(s.embarazo, 0, 45, 0, { entero: true }); if (emb) out.embarazo = emb;
  const pos = numero(s.posparto, 0, 104, 0, { entero: true }); if (pos) out.posparto = pos;
  const med = [...new Set(lista(s.medicacion, 10).filter(m => ['betabloqueantes', 'anticoagulantes', 'azucar', 'corticoides'].includes(m)))]; if (med.length) out.medicacion = med;
  const o = enLista(s.osteoporosis, ['sin_fracturas', 'con_fracturas']); if (o) out.osteoporosis = o;
  SALUD_BOOL.forEach(k => { if (s[k] === true) out[k] = true; });
  if (esObjeto(s.vistoBueno)) { const vb = {}; VISTO_BUENO.forEach(k => { if (s.vistoBueno[k] === true) vb[k] = true; }); if (Object.keys(vb).length) out.vistoBueno = vb; }
  return Object.keys(out).length ? out : null;
}

// ── Sesiones y plan ──
function tarea(t, conHecho) {
  if (!esObjeto(t)) return null;
  const out = { id: id(t.id), nombre: texto(t.nombre, 120), detalle: texto(t.detalle, 400), duracion: texto(t.duracion, 30) };
  if (!conHecho && out.id == null) delete out.id; // en el plan, las tareas sin ejercicio del catálogo no llevan id
  if (conHecho) out.hecho = bool(t.hecho);
  return out.nombre ? out : null;
}
function serie(z) {
  if (!esObjeto(z)) return null;
  return { kg: numero(z.kg, 0, 500, null), valor: texto(z.valor, 12), hecha: bool(z.hecha) };
}
function ejercicioSesion(x) {
  if (!esObjeto(x)) return null;
  const sets = lista(x.sets, 30).map(serie).filter(Boolean);
  const out = {
    id: id(x.id), rol: enLista(x.rol, ROLES, 'principal'),
    series: numero(x.series, 0, 30, sets.length, { entero: true }), reps: texto(x.reps, 24),
    descanso: numero(x.descanso, 0, 900, 60, { entero: true }), kg: numero(x.kg, 0, 500, null),
    nota: texto(x.nota, 400), motivo: texto(x.motivo, 400), sets,
    gusto: enLista(x.gusto, Object.keys(GUSTOS), null), comentario: libre(x.comentario, LARGO_TEXTO.comentarioEjercicio),
  };
  const nombre = texto(x.nombre, 120); if (nombre) out.nombre = nombre;
  if (x.superserie === true) out.superserie = true;
  // «Dolor durante» (C-DOLOR-6, E9): opcional; el ejercicio se paró porque el dolor pasó del límite.
  if (esObjeto(x.dolorDurante) && zona(x.dolorDurante.zona)) {
    const d = x.dolorDurante, n = k => numero(d[k], 0, 10, null, { entero: true });
    if (n('dolor') != null) out.dolorDurante = { zona: zona(d.zona), dolor: n('dolor'), antes: n('antes') ?? 0, techo: n('techo') ?? 3 };
  }
  return out.id || out.nombre ? out : null;
}
function ejercicioPlan(x) {
  if (!esObjeto(x) || !idValido(x.id)) return null;
  const out = {
    id: x.id, rol: enLista(x.rol, ROLES, 'principal'), series: numero(x.series, 1, 30, 3, { entero: true }), reps: texto(x.reps, 24),
    descanso: numero(x.descanso, 0, 900, 60, { entero: true }), nota: texto(x.nota, 400),
  };
  const motivo = texto(x.motivo, 400); if (motivo) out.motivo = motivo;
  const kg = numero(x.kg, 0, 500, null); if (kg != null) out.kg = kg;
  if (x.superserie === true) out.superserie = true;
  return out;
}
const explicacion = v => (typeof v === 'string' ? [v] : lista(v, 12)).map(t => texto(t, 600)).filter(Boolean);

function sesion(s, clave) {
  if (!esObjeto(s)) return null;
  const sid = idValido(clave) ? clave : id(s.id);
  if (!sid) return null;
  const terminada = fechaISO(s.terminada), creada = fechaISO(s.creada);
  const fecha = fechaDia(s.fecha) || (terminada || creada || '').slice(0, 10);
  if (!fechaDia(fecha)) return null;
  const ci = esObjeto(s.checkin) ? s.checkin : null;
  const cierre = esObjeto(s.cierre) ? s.cierre : null;
  return {
    id: sid, fecha, creada: creada || fecha, fuente: enLista(s.fuente, FUENTES, 'reglas'),
    nombre: texto(s.nombre, 80) || 'Sesión', foco: texto(s.foco, 120), lugar: enLista(s.lugar, Object.keys(LUGARES), 'gym'),
    minutos: numero(s.minutos, 0, 600, null, { entero: true }),
    explicacion: explicacion(s.explicacion),
    checkin: ci ? { energia: numero(ci.energia, 1, 5, null, { entero: true }), dolor: dolorPorZona(ci.dolor), tiempo: numero(ci.tiempo, 0, 600, null, { entero: true }) } : null,
    calentamiento: lista(s.calentamiento, 40).map(t => tarea(t, true)).filter(Boolean),
    ejercicios: lista(s.ejercicios, 60).map(ejercicioSesion).filter(Boolean),
    vuelta: lista(s.vuelta, 40).map(t => tarea(t, true)).filter(Boolean),
    estado: enLista(s.estado, ESTADOS, 'pendiente'), empezada: fechaISO(s.empezada), terminada,
    cierre: cierre ? { esfuerzo: numero(cierre.esfuerzo, 1, 5, null, { entero: true }), dolor: dolorPorZona(cierre.dolor), comentario: libre(cierre.comentario, LARGO_TEXTO.comentarioCierre) } : null,
    ...(['suave', 'dolorAlto'].includes(s.tipo) ? { tipo: s.tipo } : {}), // los de TIPOS_SESION (modelo.js)
    ...(s.parada === 'alarma' ? { parada: 'alarma' } : {}), // parada con «Algo va mal» (C-ALAR-1, E9)
    ...iaFalloSesion(s.iaFallo),
    ...origenSesion(s.origen),
  };
}
// Marca de origen: hecha desde una de «Mis sesiones» (misma forma que origenSesion de modelo.js).
const origenSesion = o => (esObjeto(o) && o.tipo === 'mia' && idValido(o.id) ? { origen: { tipo: 'mia', id: o.id } } : {});
// Nota «La ha hecho la app porque…» (PR 12; misma forma que iaFalloSesion e iaFalloPlan de modelo.js).
function iaFalloSesion(f) {
  if (!esObjeto(f)) return {};
  const motivo = texto(f.motivo, 300); if (!motivo) return {};
  const peticion = texto(f.peticion, 300), atendido = texto(f.atendido, 120);
  const huella = typeof f.huella === 'string' && /^[a-z0-9]{1,16}$/.test(f.huella) ? { huella: f.huella } : {};
  return { iaFallo: { motivo, ...(peticion ? { peticion } : {}), ...(peticion && atendido ? { atendido } : {}), diaPlan: numero(f.diaPlan, 1, 7, null, { entero: true }), reintentable: f.reintentable !== false, ...huella } };
}
function iaFalloPlan(f) {
  if (!esObjeto(f) || !esObjeto(f.semana)) return {};
  const motivo = texto(f.motivo, 300);
  const dias = [...new Set(lista(f.semana.dias, 7).map(d => numero(d, 1, 7, null, { entero: true })).filter(d => d != null))].sort();
  const lugares = [...new Set(lista(f.semana.lugares, 6).filter(l => typeof l === 'string' && Object.prototype.hasOwnProperty.call(LUGARES, l)))];
  if (!motivo || !dias.length || !lugares.length) return {};
  return { iaFallo: { motivo, semana: { dias, minutos: numero(f.semana.minutos, 15, 180, 60, { entero: true }), lugares } } };
}

function diaPlan(d) {
  if (!esObjeto(d)) return null;
  const ds = numero(d.diaSemana, 1, 7, null, { entero: true });
  if (ds == null) return null;
  return {
    diaSemana: ds, nombre: texto(d.nombre, 80) || 'Sesión', foco: texto(d.foco, 120), lugar: enLista(d.lugar, Object.keys(LUGARES), 'gym'),
    minutos: numero(d.minutos, 0, 600, 60, { entero: true }), tipo: typeof d.tipo === 'string' && idValido(d.tipo) ? d.tipo : null,
    explicacion: explicacion(d.explicacion),
    calentamiento: lista(d.calentamiento, 40).map(t => tarea(t, false)).filter(Boolean),
    ejercicios: lista(d.ejercicios, 60).map(ejercicioPlan).filter(Boolean),
    vuelta: lista(d.vuelta, 40).map(t => tarea(t, false)).filter(Boolean),
  };
}
function plan(p, sesiones) {
  if (!esObjeto(p) || typeof p.semana !== 'string' || !/^\d{4}-W\d{2}$/.test(p.semana)) return null;
  const vistos = new Set();
  const dias = lista(p.dias, 7).map(diaPlan).filter(d => d && !vistos.has(d.diaSemana) && vistos.add(d.diaSemana)).sort((a, b) => a.diaSemana - b.diaSemana);
  const hechos = {};
  if (esObjeto(p.hechos)) {
    for (const [k, v] of Object.entries(p.hechos)) {
      const ds = numero(k, 1, 7, null, { entero: true });
      if (ds != null && String(ds) === k && idValido(v) && sesiones[v]) hechos[ds] = v;
    }
  }
  const out = {
    semana: p.semana, creado: fechaISO(p.creado) || new Date().toISOString(), fuente: enLista(p.fuente, ['ia', 'reglas'], 'reglas'),
    resumen: texto(p.resumen, 2000), criterios: texto(p.criterios, 3000), progresion: texto(p.progresion, 2000), dias, hechos,
    ...iaFalloPlan(p.iaFallo),
  };
  // Días en los que dijo «Hoy no puedo» sin otro día libre (opcional, E13).
  if (Array.isArray(p.noPuedo)) { const np = [...new Set(p.noPuedo.slice(0, 50).filter(d => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b).slice(0, 7); if (np.length) out.noPuedo = np; }
  if (Array.isArray(p.cambios)) out.cambios = lista(p.cambios, 50).filter(esObjeto).map(c => ({ fecha: fechaISO(c.fecha), texto: texto(c.texto, 600) })).filter(c => c.fecha && c.texto);
  return out;
}

// ── Mis sesiones (sesiones guardadas para repetir; js/areas/entrenador/mias.js) ──
const MAX_MIAS = 30;
const DEL_CATALOGO = new Set(EJERCICIOS.map(e => e.id));
function ejercicioMia(x) {
  if (!esObjeto(x) || !idValido(x.id) || !DEL_CATALOGO.has(x.id)) return null; // solo ejercicios que existen
  return {
    id: x.id, rol: enLista(x.rol, ROLES, 'principal'), series: numero(x.series, 1, 10, 3, { entero: true }),
    reps: texto(x.reps, 24), descanso: numero(x.descanso, 0, 300, 60, { entero: true }),
  };
}
function miaSesion(m, vistos) {
  if (!esObjeto(m)) return null;
  const i = id(m.id), nombre = texto(m.nombre, 40).replace(/\s+/g, ' ');
  const ejercicios = lista(m.ejercicios, 30).map(ejercicioMia).filter(Boolean);
  if (!i || vistos.has(i) || !nombre || !ejercicios.length) return null;
  vistos.add(i);
  return {
    id: i, nombre, lugar: enLista(m.lugar, Object.keys(LUGARES), 'gym'), minutos: numero(m.minutos, 10, 240, null, { entero: true }),
    creada: fechaISO(m.creada) || new Date().toISOString(), ...(m.tipo === 'suave' ? { tipo: 'suave' } : {}), ejercicios,
  };
}

// ── Medidas, dolor, ajustes y migración ──
function medida(m) {
  if (!esObjeto(m)) return null;
  const fecha = fechaDia(m.fecha) || fechaDia(String(fechaISO(m.fecha) || '').slice(0, 10));
  if (!fecha) return null;
  const out = { fecha };
  for (const k of MEDIDAS) { const v = numero(m[k], 0, k === 'grasa' ? 80 : 500, null); if (v != null && v > 0) out[k] = v; }
  if (typeof m.vid === 'string') out.vid = texto(m.vid, 200);
  return Object.keys(out).some(k => MEDIDAS.includes(k)) ? out : null;
}
function registroDolor(d) {
  if (!esObjeto(d)) return null;
  const fecha = fechaDia(d.fecha), z = zona(d.zona), v = numero(d.dolor, 0, 10, null, { entero: true });
  if (!fecha || !z || v == null) return null;
  const out = { fecha, zona: z, dolor: v, momento: enLista(d.momento, MOMENTOS, 'dia') };
  if (idValido(d.sesion)) out.sesion = d.sesion;
  if (typeof d.vid === 'string') out.vid = texto(d.vid, 200);
  return out;
}
// Señales de alarma apuntadas (C-ALAR-1, C-ALAR-4): { fecha, respuesta 'si'|'no', frase }.
function alarma(a) {
  if (!esObjeto(a)) return null;
  const fecha = fechaDia(a.fecha), respuesta = enLista(a.respuesta, ['si', 'no']);
  return fecha && respuesta ? { fecha, respuesta, frase: texto(a.frase, 200) } : null;
}
export function migracion(m) {
  if (!esObjeto(m)) return { version: 1, dueño: null, claves: [], sexoRevisar: false };
  return {
    version: numero(m.version, 0, 99, 1, { entero: true }),
    dueño: Object.prototype.hasOwnProperty.call(PERSONAS, m.dueño) ? m.dueño : null,
    claves: [...new Set(lista(m.claves, 20000).filter(c => typeof c === 'string' && c.length <= 200).map(c => texto(c, 200)))],
    sexoRevisar: bool(m.sexoRevisar),
  };
}

// ── Estado completo ──
export function normalizarEstado(x) {
  if (!esObjeto(x)) throw new ErrorCopia('No es una copia de Pipos Fitness: el archivo no tiene datos.');
  if (x.version !== VERSION_DATOS) {
    throw new ErrorCopia(typeof x.version === 'number' && x.version > VERSION_DATOS
      ? 'No es una copia que esta versión de la app entienda: es de una versión más nueva. Actualiza la app y vuelve a intentarlo.'
      : 'No es una copia de Pipos Fitness (versión de datos desconocida).');
  }
  if (!esObjeto(x.perfil)) throw new ErrorCopia('No es una copia de Pipos Fitness: le falta el perfil.');
  if (!Object.prototype.hasOwnProperty.call(PERSONAS, x.dueño)) throw new ErrorCopia('No es una copia de Pipos Fitness completa: no dice de quién es (Víctor o Virginia).');
  const avisos = [];
  recortados = 0;
  const sesiones = {};
  let descartadas = 0;
  if (esObjeto(x.sesiones)) {
    for (const [k, s] of Object.entries(x.sesiones).slice(0, 20000)) {
      const n = sesion(s, k);
      if (n && !sesiones[n.id]) sesiones[n.id] = n; else descartadas++;
    }
  }
  if (descartadas) avisos.push(`${descartadas} sesiones con datos que no se entienden no se han traído`);
  const porFecha = new Map();
  lista(x.medidas, 5000).map(medida).filter(Boolean).forEach(m => porFecha.set(m.fecha, m)); // una por día
  const a = esObjeto(x.ajustes) ? x.ajustes : {};
  const ajustes = { codigo: '', vibrar: bool(a.vibrar, true), sonido: bool(a.sonido, true) };
  const modo = enLista(a.modoSesion, ['foco', 'lista']); if (modo) ajustes.modoSesion = modo;
  const estado = {
    version: VERSION_DATOS,
    dueño: x.dueño,
    perfil: perfil(x.perfil, avisos),
    plan: plan(x.plan, sesiones),
    sesiones,
    medidas: [...porFecha.values()],
    dolor: lista(x.dolor, 20000).map(registroDolor).filter(Boolean),
    ajustes,
    migracion: migracion(x.migracion),
  };
  const alarmas = lista(x.alarmas, 100).map(alarma).filter(Boolean);
  if (alarmas.length) estado.alarmas = alarmas;
  const vistas = new Set();
  // Primero se descarta lo que no vale y después se corta a 30.
  const validas = lista(x.misSesiones, 1000).map(m => miaSesion(m, vistas)).filter(Boolean);
  const mias = validas.slice(0, MAX_MIAS);
  if (validas.length > MAX_MIAS) avisos.push(`Solo se traen ${MAX_MIAS} de tus sesiones guardadas`);
  if (mias.length) estado.misSesiones = mias;
  if (recortados) avisos.push(recortados === 1 ? 'Una nota o comentario era más largo de lo que guarda la app y se ha recortado' : `${recortados} notas o comentarios eran más largos de lo que guarda la app y se han recortado`);
  return { estado, avisos };
}
