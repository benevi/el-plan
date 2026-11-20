// Área ENTRENADOR · el check-in: cómo cambia el día planificado con cómo estás hoy (energía, dolor,
// tiempo, lugar, petición, recuperación y progresión), y cuándo merece la pena pagar la IA.
// Todo lo que sale de aquí pasa por el validador único (validar.js) con el perfil de HOY: así un día del plan
// hecho antes de una lesión nueva, un rechazo, otro material u otro nivel se revalida al hacer el check-in.

import { estado } from '../../nucleo/estado.js';
import { enLinea } from '../../nucleo/api.js';
import { es } from '../../nucleo/ui.js';
import { diaSemana } from '../../nucleo/modelo.js';
import { analizarEjercicios, leerComentario } from '../../reglas/contexto.js';
import { sugerir, cargaMuscular, sesionesHechas } from '../../reglas/progresion.js';
import { nivelesZona, ex, riesgo } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS } from '../../datos/constantes.js';
import { montarDia, tiempoSesion, lista, minus, frase, dosis, tipoParaLugar, bandasHoy, maxDolorHoy, nombreZona, contextoDia, valePrincipal, permitidoBase, minutosSesion } from './dia.js';
import { diaDolorAlto } from './dolor-alto.js';
import { validarSesion } from './validar.js';
import { avisosConsulta, T8 } from './alarma.js';
import { restriccionesSalud } from './salud.js';
import { planDeLaSemana, diaElegido } from './plan.js';

const SEMANA = 7 * 864e5;
// Avisos del dolor de hoy: dolor nuevo sin lesión (C-LES-3), lesión nueva (T8, C-LES-2), peor que de costumbre
// y consulta no urgente (T4, C-ALAR-2, C-DOLOR-5).
function avisosDolor(S, dolorHoy) {
  const out = [];
  const bandas = bandasHoy(S, dolorHoy);
  const lesionDolor = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, +l.dolor]));
  Object.entries(dolorHoy).forEach(([z, v]) => {
    const b = bandas[z];
    if (+v >= 1 && lesionDolor[z] == null) out.push(`Dolor nuevo en ${nombreZona(z)} (${v}/10): lo trato como una lesión reciente, sin nada que la cargue. Al terminar puedes guardarlo en Perfil › Lesiones como molestia puntual.`);
    else if (b && b.nueva && +v >= 2 && b.lesion) {
      const sem = b.lesion.desde ? Math.max(1, Math.round((Date.now() - new Date(b.lesion.desde)) / SEMANA)) : 1;
      out.push(T8(z, sem, +v));
    } else if (lesionDolor[z] != null && +v >= lesionDolor[z] + 2) out.push(`Tu ${nombreZona(z)} está peor que de costumbre (${v}/10 frente a ${lesionDolor[z]}/10).`);
  });
  out.push(...avisosConsulta(S, dolorHoy, { nueva: z => !!(bandas[z] && bandas[z].nueva) }));
  return out;
}

// ── Check-in: lo que cambia del día planificado con cómo estás hoy ──
// ci: { lugar, minutos, energia 1-5, dolorHoy {zona:n}, peticion }
// Devuelve { datos (para crearSesion), cambios [texto] }.
export function ajustarAlCheckin(S, dia, ci) {
  const cambios = [];
  const energia = +ci.energia || 3;
  const dolorHoy = ci.dolorHoy || {};
  const minutos = minutosSesion(ci.minutos);
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const maxDolor = maxDolorHoy(dolorHoy);
  const pet = minus(ci.peticion);
  const checkin = { energia, dolor: dolorHoy, tiempo: ci.minutos };
  const ctxV = { lugar: ci.lugar, minutos, dolorHoy, energia, origen: dia ? 'plan' : 'reglas', k: diaSemana() };
  const salud = restriccionesSalud(S);

  // Dolor de hoy ≥ 7 (D2, C-DOLOR-4) o día «solo suave» por salud: plantilla fija, sin progresión ni IA.
  if (maxDolor >= 7 || salud.soloSuave) {
    const base = diaDolorAlto(S, { lugar: ci.lugar, minutos, dolorHoy }, { motivo: maxDolor >= 7 ? undefined : salud.soloSuave });
    cambios.push(base.explicacion[0], ...avisosDolor(S, dolorHoy));
    const v = validarSesion(S, base, ctxV);
    const datos = { ...v.sesion, fuente: dia ? 'plan' : 'reglas', lugar: ci.lugar, minutos, checkin, explicacion: [...v.sesion.explicacion, ...cambios.slice(1).map(c => 'Por tu check-in: ' + c)].slice(0, 8) };
    return { datos, cambios };
  }

  let base = dia ? JSON.parse(JSON.stringify(dia)) : null;
  const tipoDe = d => (d && d.tipo) || 'fullA';
  // Petición concreta que las reglas entienden.
  let tipo = tipoDe(base);
  if (/superior|torso|brazo|pecho|espalda/.test(pet) && !/pierna|inferior/.test(pet)) { tipo = 'torso'; cambios.push('Pides tren superior: hoy torso.'); }
  else if (/inferior|pierna|gl[uú]teo/.test(pet)) { tipo = 'pierna'; cambios.push('Pides tren inferior: hoy pierna y glúteo.'); }
  // Cambio de lugar: con la plantilla del destino (piscina ↔ seco, C-PISC-1).
  const tipoHoy = tipoParaLugar(tipo, ci.lugar);
  if (!base || ci.lugar !== base.lugar || tipoHoy !== tipoDe(base)) {
    if (base && ci.lugar !== base.lugar) cambios.push(`Hoy entrenas en ${minus(LUGARES[ci.lugar])} en vez de ${minus(LUGARES[base.lugar])}: ${(ci.lugar === 'piscina') !== (base.lugar === 'piscina') ? 'sesión de ese lugar' : 'misma idea, con lo que hay allí'}.`);
    const mismoMedio = base && (base.lugar === 'piscina') === (ci.lugar === 'piscina');
    const huecos = mismoMedio && tipoHoy === tipoDe(base) && ci.lugar !== 'piscina' ? base.ejercicios.filter(x => x.rol === 'principal' && ex(x.id)).map(x => ex(x.id).m[0]) : null;
    base = montarDia(S, { lugar: ci.lugar, minutos, tipo: tipoHoy, huecos: huecos && huecos.length >= 3 ? huecos : null, dolorHoy, energia, k: diaSemana() });
  }
  let ej = base.ejercicios.map(x => ({ ...x }));

  // Dolor de hoy: avisos, y fuera (o cambiado) lo que hoy carga la zona.
  cambios.push(...avisosDolor(S, dolorHoy));
  const an = analizarEjercicios(S);
  const ctx = contextoDia(S, { lugar: ci.lugar, minutos, dolorHoy, energia });
  ej = ej.map((x, idx) => {
    const e = ex(x.id); if (!e || x.rol !== 'principal') return x;
    const peligro = riesgo(e, ctx.niveles) === 'evitar';
    const molesta = an[x.id] && (an[x.id].estado === 'molesta' || an[x.id].gusto === 'rechazo');
    if (!peligro && !molesta) return x;
    const excluir = ej.map(y => y.id);
    const alt = ctx.pool.filter(a => !excluir.includes(a.id) && valePrincipal(S, a, ctx) && permitidoBase(S, a, ctx) && (a.m[0] === e.m[0] || e.m.includes(a.m[0])) && (!an[a.id] || an[a.id].estado !== 'molesta'))
      .sort((a, b) => (b.m[0] === e.m[0]) - (a.m[0] === e.m[0]) || (a.niv <= ctx.nivel ? 0 : 1) - (b.niv <= ctx.nivel ? 0 : 1) || (riesgo(a, ctx.niveles) === 'ok' ? 0 : 1) - (riesgo(b, ctx.niveles) === 'ok' ? 0 : 1) || a.id.localeCompare(b.id))[0];
    const por = peligro ? 'carga la zona que hoy te duele' : an[x.id].gusto === 'rechazo' ? 'no lo quieres' : `te ha molestado («${(an[x.id].comentarios.slice(-1)[0] || {}).texto || 'dolor después'}»)`;
    if (!alt) { cambios.push(`Quito ${e.n.toLowerCase()}: ${por}.`); return null; }
    cambios.push(`Cambio ${e.n.toLowerCase()} por ${alt.n.toLowerCase()}: ${por}.`);
    // La dosis sigue el tipo del nuevo (reps ↔ tiempo).
    return { ...x, id: alt.id, ...dosis(S, alt, idx, ci.lugar), kg: null, nota: frase(`Hoy en lugar de ${e.n.toLowerCase()}: ${por}`) + ' Mismo trabajo, sin cargar esa zona.' };
  }).filter(Boolean);
  // Comentarios de «ocupado»: aviso con alternativa.
  ej.forEach(x => {
    const a = an[x.id]; if (!a || !a.problemas.includes('ocupado') || x.rol !== 'principal') return;
    const e = ex(x.id);
    const alt = ctx.pool.find(b => b.id !== e.id && b.m[0] === e.m[0] && valePrincipal(S, b, ctx) && !ej.some(y => y.id === b.id));
    if (alt) x.nota = [x.nota, `Si está ocupado otra vez, haz ${alt.n.toLowerCase()}.`].filter(Boolean).join(' ');
  });

  // Recuperación: músculos aún cargados (por ejemplo si entrenó ayer fuera del plan).
  const carga = cargaMuscular(S);
  const cargados = [...new Set(ej.filter(x => x.rol === 'principal' && carga[ex(x.id).m[0]] && carga[ex(x.id).m[0]].estado === 'cargado').map(x => ex(x.id).m[0]))];
  if (cargados.length) {
    ej.forEach(x => { if (x.rol === 'principal' && cargados.includes(ex(x.id).m[0]) && x.series > 2) x.series--; });
    cambios.push(`${lista(cargados.map(m => MUSCULOS[m]))} aún se recupera${cargados.length > 1 ? 'n' : ''}: una serie menos y sin subir peso.`);
  }

  // Energía (C-ENERGIA-1): el cardio se queda en su mínimo de D3 a esfuerzo 3, nunca por debajo (C-CARDIO-3).
  if (energia <= 2) {
    const antes = ej.filter(x => x.rol === 'principal').length;
    const tope = energia === 1 ? 3 : 4;
    ej.forEach(x => { if (x.rol === 'principal' && x.series > 2) x.series--; });
    const prin = ej.filter(x => x.rol === 'principal');
    if (prin.length > tope) { const quitar = prin.slice(tope).map(x => x.id); ej = ej.filter(x => !quitar.includes(x.id)); }
    const c = ej.find(x => x.rol === 'cardio');
    if (c) c.nota = `${c.reps} suaves (esfuerzo 3 de 10): hoy tienes poca energía (${energia}/5). Ritmo en el que puedas hablar, sin intervalos.`;
    cambios.push(`Energía ${energia === 1 ? 'muy baja' : 'baja'}: una serie menos${antes > tope ? `, ${antes - tope} ejercicio${antes - tope > 1 ? 's' : ''} menos` : ''}, cardio suave y sin subir peso.`);
  } else if (energia === 5) {
    const p = ej.find(x => x.rol === 'principal' && ex(x.id).t === 'reps');
    if (p && p.series < 5) { p.series++; cambios.push(`Energía a tope: una serie más de ${ex(p.id).n.toLowerCase()}.`); }
  }

  // Tiempo disponible: si sobra mucho, más principales (si falta, lo cuadra el validador con C-TIEMPO-2).
  let t = tiempoSesion({ ...base, ejercicios: ej });
  if (t < minutos - 15 && energia > 2) {
    const extra = montarDia(S, { lugar: ci.lugar, minutos: minutos + 30, tipo: tipoHoy, dolorHoy, energia, k: diaSemana() + 1 }).ejercicios
      .filter(x => x.rol === 'principal' && !ej.some(y => y.id === x.id));
    const añadidos = [];
    while (extra.length && t < minutos - 10) { const x = extra.shift(); const pos = ej.map(y => y.rol).lastIndexOf('principal') + 1; ej.splice(pos, 0, x); añadidos.push(ex(x.id).n.toLowerCase()); t = tiempoSesion({ ...base, ejercicios: ej }); }
    if (añadidos.length) cambios.push(`Tienes ${minutos} minutos: añado ${lista(añadidos)}.`);
  }

  // Progresión de cada ejercicio con lo que apuntaste (doble progresión con frenos).
  const subidas = [], bajadas = [];
  ej = ej.map(x => {
    if (x.rol === 'cardio') return x;
    const sg = sugerir(S, x.id, { series: x.series, reps: x.reps }, { energia, niveles, carga, dolorHoy });
    if (sg.tipo === 'sube') subidas.push(`${ex(x.id).n.toLowerCase()}${sg.kg != null ? ' a ' + es(sg.kg) + ' kg' : ' (' + sg.reps + ')'}`);
    if (sg.tipo === 'baja') bajadas.push(ex(x.id).n.toLowerCase());
    return { ...x, series: sg.series, reps: sg.reps, kg: sg.kg != null ? sg.kg : x.kg, motivo: sg.motivo };
  });
  if (subidas.length) cambios.push(`Subes en ${lista(subidas)}: llegaste al tope la última vez.`);
  if (bajadas.length) cambios.push(`Bajas un poco en ${lista(bajadas)} para recuperar el ritmo.`);

  // Validador único con el perfil y el dolor de hoy.
  const v = validarSesion(S, { ...base, lugar: ci.lugar, minutos, ejercicios: ej }, { ...ctxV, tipo: tipoHoy });
  const ajustes = v.cambios.map(c => frase(c));
  const todos = [...cambios, ...ajustes];
  const datos = {
    ...v.sesion, fuente: base.fuente === 'ia' ? 'ia' : dia ? 'plan' : 'reglas',
    lugar: ci.lugar, minutos,
    explicacion: [...(v.sesion.explicacion || []).slice(0, 1), ...(todos.length ? [...cambios.map(c => 'Por tu check-in: ' + c), ...ajustes.map(c => 'Ajustado por la app: ' + c)] : ['Tu check-in no cambia nada: haces el día tal como estaba planificado.']), ...(v.sesion.explicacion || []).slice(1)].slice(0, 8),
    checkin,
  };
  return { datos, cambios: todos };
}

// ── Cuándo merece la pena pagar una llamada a la IA para el día ──
// modo del perfil: 'auto' (por defecto) · 'siempre' · 'ahorro'. Con dolor de hoy ≥ 7 nunca (D2, C-DOLOR-4).
export function motivoIA(S, ci, dia) {
  const modo = S.perfil.usoIA || 'auto';
  if (maxDolorHoy(ci.dolorHoy) >= 7) return { usar: false, motivo: 'Con dolor de 7 o más, la sesión la prepara la app sin IA.' };
  if (restriccionesSalud(S).soloSuave) return { usar: false, motivo: 'Por tus datos de salud, hoy la sesión suave la prepara la app.' };
  if (!enLinea()) return { usar: false, motivo: 'Sin conexión: lo ajusta la app con sus reglas.' };
  if (ci.forzarIA) return { usar: true, motivo: 'Se lo pides al entrenador IA.' };
  if (modo === 'ahorro') return { usar: false, motivo: 'Modo ahorro: la IA solo hace el plan semanal.' };
  if (modo === 'siempre') return { usar: true, motivo: 'Modo «siempre IA».' };
  const lesion = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, +l.dolor]));
  const r = [];
  if ((ci.peticion || '').trim().length > 3) r.push('le pides algo concreto');
  if (Object.entries(ci.dolorHoy || {}).some(([z, v]) => +v >= 1 && lesion[z] == null)) r.push('tienes un dolor nuevo');
  if (Object.entries(ci.dolorHoy || {}).some(([z, v]) => lesion[z] != null && +v >= Math.max(4, lesion[z] + 2))) r.push('te duele más de lo normal');
  if (dia && ci.lugar !== dia.lugar) r.push('cambias de lugar');
  if (!dia) r.push('hoy no hay día planificado');
  const p = planDeLaSemana(S);
  const desde = p ? p.creado : '';
  const nuevos = sesionesHechas(S).filter(s => (s.terminada || '') > desde).some(s => (s.cierre && s.cierre.comentario) || (s.ejercicios || []).some(x => x.comentario && leerComentario(x.comentario).length));
  if (nuevos) r.push('hay comentarios tuyos que leer');
  return r.length ? { usar: true, motivo: `El entrenador IA la revisa porque ${lista(r)}.` } : { usar: false, motivo: 'Ajustada por la app con tu check-in (sin gastar IA).' };
}

// Vista previa del check-in (para enseñar qué cambia antes de crear la sesión).
export function previaCheckin(ci) {
  const S = estado();
  const dia = diaElegido(S, ci.diaPlan);
  const { datos, cambios } = ajustarAlCheckin(S, dia, ci);
  return { dia, datos, cambios, ia: motivoIA(S, ci, dia), minutos: tiempoSesion(datos) };
}
