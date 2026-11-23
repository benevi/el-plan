// Área ENTRENADOR · el check-in: cómo cambia el día planificado con cómo estás hoy (energía, dolor,
// tiempo, lugar, petición, recuperación y progresión), y cuándo merece la pena pagar la IA.
// Todo lo que sale de aquí pasa por el validador único (validar.js) con el perfil de HOY: así un día del plan
// hecho antes de una lesión nueva, un rechazo, otro material u otro nivel se revalida al hacer el check-in.

import { estado, cambiar, uid, hoyISO } from '../../nucleo/estado.js';
import { enLinea } from '../../nucleo/api.js';
import { es } from '../../nucleo/ui.js';
import { diaSemana } from '../../nucleo/modelo.js';
import { analizarEjercicios, leerComentario } from '../../reglas/contexto.js';
import { sugerir, cargaMuscular, sesionesHechas, ajusteCargado, semanaDescarga, seriesDescarga, topeSeries } from '../../reglas/progresion.js';
import { nivelesZona, ex, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS } from '../../datos/constantes.js';
import { riesgoHoy, montarDia, tiempoSesion, lista, minus, frase, dosis, tipoParaLugar, bandasHoy, maxDolorHoy, nombreZona, contextoDia, valePrincipal, permitidoBase, minutosSesion, calentamientoDe, vueltaDe } from './dia.js';
import { diaDolorAlto } from './dolor-alto.js';
import { validarSesion, esUltimoRecurso, topeMinutos } from './validar.js';
import { avisosConsulta, T8 } from './alarma.js';
import { restriccionesSalud } from './salud.js';
import { planDeLaSemana, diaElegido } from './plan.js';
import { miaDe, miaComoDia } from './mias.js';

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
      // Días de calendario desde «Desde» (fecha local); sin fecha, como antes, 1 semana.
      const dias = b.lesion.desde ? Math.max(0, Math.round((new Date(hoyISO() + 'T12:00') - new Date(String(b.lesion.desde).slice(0, 10) + 'T12:00')) / 864e5)) : 7;
      out.push(T8(z, dias, +v));
    } else if (lesionDolor[z] != null && +v >= lesionDolor[z] + 2) out.push(`Tu ${nombreZona(z)} está peor que de costumbre (${v}/10 frente a ${lesionDolor[z]}/10).`);
  });
  out.push(...avisosConsulta(S, dolorHoy, { nueva: z => !!(bandas[z] && bandas[z].nueva) }));
  return out;
}

// C-LES-3 (M11 del informe del 21-11): zonas con dolor en el check-in de la sesión y sin lesión activa en el
// perfil. Al terminar se ofrece guardarlas como molestia puntual con «Desde» = hoy (guardarDolorComoLesion).
export function dolorNuevoSinLesion(S, s) {
  const con = new Set(S.perfil.lesiones.filter(l => l.activa).map(l => l.zona));
  const dolor = (s && s.checkin && s.checkin.dolor) || {};
  return Object.entries(dolor).filter(([z, v]) => ZONAS[z] && +v >= 1 && !con.has(z)).map(([zona, v]) => ({ zona, dolor: +v }));
}
// fecha: la de la sesión (por si se guarda otro día). Si ya hay una lesión inactiva de esa zona, se reactiva con el
// dolor y la fecha nuevos en vez de crear otra (revisión del PR #53).
export function guardarDolorComoLesion(zona, dolor, fecha = hoyISO()) {
  if (!ZONAS[zona]) return;
  const d = Math.max(0, Math.min(10, Math.round(+dolor || 0)));
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha)) ? String(fecha) : hoyISO();
  cambiar(S => {
    if (S.perfil.lesiones.some(l => l.activa && l.zona === zona)) return;
    const vieja = S.perfil.lesiones.find(l => !l.activa && l.zona === zona);
    if (vieja) Object.assign(vieja, { activa: true, dolor: d, desde });
    else S.perfil.lesiones.push({ id: uid(), zona, dolor: d, desde, nota: '', activa: true, tipo: 'puntual' });
  }, 'perfil');
}

// ── Check-in: lo que cambia del día planificado con cómo estás hoy ──
// ci: { lugar, minutos, energia 1-5, dolorHoy {zona:n}, peticion, mia? }
// Con ci.mia (id de «Mis sesiones») la base es esa sesión guardada y no el día del plan (que solo se ocupa):
// no se rehace por lugar ni se rellena por tiempo; lo que no valga hoy lo cambia el validador y lo explica.
// Devuelve { datos (para crearSesion), cambios [texto] }.
export function ajustarAlCheckin(S, dia, ci) {
  const mia = miaDe(S, ci.mia);
  const cambios = [];
  const energia = +ci.energia || 3;
  const dolorHoy = ci.dolorHoy || {};
  const minutos = minutosSesion(ci.minutos);
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const maxDolor = maxDolorHoy(dolorHoy);
  const checkin = { energia, dolor: dolorHoy, tiempo: ci.minutos };
  const ctxV = { lugar: ci.lugar, minutos, dolorHoy, energia, origen: dia ? 'plan' : 'reglas', k: diaSemana() };
  const salud = restriccionesSalud(S);

  // Dolor de hoy ≥ 7 (D2, C-DOLOR-4) o día «solo suave» por salud: plantilla fija, sin progresión ni IA.
  if (maxDolor >= 7 || salud.soloSuave) {
    const base = diaDolorAlto(S, { lugar: ci.lugar, minutos, dolorHoy }, { motivo: maxDolor >= 7 ? undefined : salud.soloSuave });
    cambios.push(base.explicacion[0], ...avisosDolor(S, dolorHoy));
    const v = validarSesion(S, base, ctxV);
    // Una sesión guardada no se salta la seguridad: hoy manda el día de dolor alto (o el suave por salud).
    const noMia = mia ? `Hoy no haces «${mia.nombre}»: ${maxDolor >= 7 ? 'con dolor de 7 o más toca la sesión suave del día de dolor alto' : 'por tus datos de salud hoy toca la sesión suave'}.` : '';
    if (noMia) cambios.splice(1, 0, noMia);
    const datos = { ...v.sesion, fuente: dia && !mia ? 'plan' : 'reglas', lugar: ci.lugar, minutos, checkin, explicacion: [...v.sesion.explicacion.slice(0, 1), ...(noMia ? [noMia] : []), ...v.sesion.explicacion.slice(1), ...cambios.slice(noMia ? 2 : 1).map(c => 'Por tu check-in: ' + c)].slice(0, 8) };
    return { datos, cambios };
  }

  let base = mia ? miaComoDia(mia) : dia ? JSON.parse(JSON.stringify(dia)) : null;
  const tipoDe = d => (d && d.tipo) || 'fullA';
  // Petición concreta que las reglas entienden (con una sesión guardada no hay petición).
  let tipo = tipoDe(base);
  const peticion = leerPeticion(mia ? '' : ci.peticion);
  if (peticion.tipo === 'torso') { tipo = 'torso'; cambios.push('Pides tren superior: hoy torso.'); }
  else if (peticion.tipo === 'pierna') { tipo = 'pierna'; cambios.push('Pides tren inferior: hoy pierna y glúteo.'); }
  // Cambio de lugar: con la plantilla del destino (piscina ↔ seco, C-PISC-1).
  const tipoHoy = tipoParaLugar(tipo, ci.lugar);
  if (!mia && (!base || ci.lugar !== base.lugar || tipoHoy !== tipoDe(base))) {
    if (base && ci.lugar !== base.lugar) cambios.push(`Hoy entrenas en ${minus(LUGARES[ci.lugar])} en vez de ${minus(LUGARES[base.lugar])}: ${(ci.lugar === 'piscina') !== (base.lugar === 'piscina') ? 'sesión de ese lugar' : 'misma idea, con lo que hay allí'}.`);
    const mismoMedio = base && (base.lugar === 'piscina') === (ci.lugar === 'piscina');
    const huecos = mismoMedio && tipoHoy === tipoDe(base) && ci.lugar !== 'piscina' ? base.ejercicios.filter(x => x.rol === 'principal' && ex(x.id)).map(x => ex(x.id).m[0]) : null;
    base = montarDia(S, { lugar: ci.lugar, minutos, tipo: tipoHoy, huecos: huecos && huecos.length >= 3 ? huecos : null, dolorHoy, energia, k: diaSemana() });
    // Semana de descarga (C-DESCARGA-1): el día rehecho también va con la mitad de series.
    if (semanaDescarga(S).toca) base.ejercicios.forEach(x => { if (x.rol === 'principal' && ex(x.id)) x.series = seriesDescarga(ex(x.id), x.series); });
  }
  let ej = base.ejercicios.map(x => ({ ...x }));

  // Dolor de hoy: avisos, y fuera (o cambiado) lo que hoy carga la zona.
  cambios.push(...avisosDolor(S, dolorHoy));
  const an = analizarEjercicios(S);
  const ctx = contextoDia(S, { lugar: ci.lugar, minutos, dolorHoy, energia });
  ej = ej.map((x, idx) => {
    const e = ex(x.id); if (!e || x.rol !== 'principal') return x;
    // En una sesión guardada, lo que choca con el dolor de hoy lo cambia el validador («Ajustado por la app»).
    const peligro = !mia && riesgoHoy(e, ctx.niveles, ctx.bandas) === 'evitar';
    const molesta = an[x.id] && (an[x.id].estado === 'molesta' || an[x.id].gusto === 'rechazo');
    if (!peligro && !molesta) return x;
    const excluir = ej.map(y => y.id);
    const alt = ctx.pool.filter(a => !excluir.includes(a.id) && valePrincipal(S, a, ctx) && permitidoBase(S, a, ctx) && (a.m[0] === e.m[0] || e.m.includes(a.m[0])) && (!an[a.id] || an[a.id].estado !== 'molesta'))
      .sort((a, b) => (b.m[0] === e.m[0]) - (a.m[0] === e.m[0]) || (a.niv <= ctx.nivel ? 0 : 1) - (b.niv <= ctx.nivel ? 0 : 1) || (riesgoHoy(a, ctx.niveles, ctx.bandas) === 'ok' ? 0 : 1) - (riesgoHoy(b, ctx.niveles, ctx.bandas) === 'ok' ? 0 : 1) || a.id.localeCompare(b.id))[0];
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

  // Recuperación: músculo cargado → como mucho 2 series con 3 de margen y sin subir (C-REC-2).
  const carga = cargaMuscular(S);
  const cargados = new Set();
  ej.forEach(x => {
    if (x.rol !== 'principal' || !ex(x.id)) return;
    const a = ajusteCargado(S, ex(x.id), x.series, carga); if (!a) return;
    x.series = a.series; a.musculos.forEach(m => cargados.add(m));
    x.nota = [x.nota, 'Hoy deja 3 repeticiones de margen: este músculo aún se recupera.'].filter(Boolean).join(' ');
  });
  if (cargados.size) cambios.push(`${lista([...cargados].map(m => MUSCULOS[m]))} aún se recupera${cargados.size > 1 ? 'n' : ''}: como mucho 2 series con 3 de margen y sin subir peso.`);

  // Energía (C-ENERGIA-1): el cardio se queda en su mínimo de D3 a esfuerzo 3, nunca por debajo (C-CARDIO-3).
  if (energia <= 2) {
    const antes = ej.filter(x => x.rol === 'principal').length;
    const tope = mia ? Infinity : energia === 1 ? 3 : 4; // una de «Mis sesiones» no pierde ejercicios (C-MIA-1)
    ej.forEach(x => { if (x.rol === 'principal' && x.series > 2) x.series--; });
    const prin = ej.filter(x => x.rol === 'principal');
    if (prin.length > tope) { const quitar = prin.slice(tope).map(x => x.id); ej = ej.filter(x => !quitar.includes(x.id)); }
    const c = ej.find(x => x.rol === 'cardio');
    if (c) c.nota = `${c.reps} suaves (esfuerzo 3 de 10): hoy tienes poca energía (${energia}/5). Ritmo en el que puedas hablar, sin intervalos.`;
    cambios.push(`Energía ${energia === 1 ? 'muy baja' : 'baja'}: una serie menos${antes > tope ? `, ${antes - tope} ejercicio${antes - tope > 1 ? 's' : ''} menos` : ''}, cardio suave y sin subir peso.`);
  } else if (energia === 5) {
    const p = ej.find(x => x.rol === 'principal' && ex(x.id).t === 'reps');
    if (p && p.series < topeSeries(S.perfil.nivel)) { p.series++; cambios.push(`Energía a tope: una serie más de ${ex(p.id).n.toLowerCase()}.`); } // D-B (S14)
  }

  // Tiempo disponible: si sobra mucho, más principales (si falta, lo cuadra el validador con C-TIEMPO-2).
  let t = tiempoSesion({ ...base, ejercicios: ej });
  if (!mia && t < minutos - 15 && energia > 2 && tipoHoy !== 'suave') {
    const extra = montarDia(S, { lugar: ci.lugar, minutos: minutos + 30, tipo: tipoHoy, dolorHoy, energia, k: diaSemana() + 1 }).ejercicios
      .filter(x => x.rol === 'principal' && !ej.some(y => y.id === x.id) && !cargados.has(ex(x.id).m[0]));
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

  // Sesión guardada: calentamiento y vuelta a la calma de hoy (lugar, dolor y lo que se va a trabajar).
  if (mia) {
    const prin = ej.filter(x => x.rol === 'principal' && ex(x.id) && permitidoBase(S, ex(x.id), ctx)).map(x => ex(x.id));
    base.calentamiento = calentamientoDe(S, ctx, prin);
    base.vuelta = vueltaDe(S, ctx, prin);
  }
  // Validador único con el perfil y el dolor de hoy.
  const v = validarSesion(S, { ...base, lugar: ci.lugar, minutos, ejercicios: ej }, { ...ctxV, tipo: tipoHoy, ...(mia ? { mia: true } : {}) });
  const ajustes = v.cambios.map(c => frase(c));
  // Tu sesión tal cual (C-MIA-1): si dura más de lo marcado, se dice en vez de recortarla.
  const dura = mia ? tiempoSesion(v.sesion) : 0;
  if (mia && dura > topeMinutos(minutos)) cambios.push(`Tu sesión dura unos ${dura} minutos, más de los ${minutos} que marcas: la dejo entera.`);
  const todos = [...cambios, ...ajustes];
  const datos = {
    ...v.sesion, fuente: mia ? 'reglas' : base.fuente === 'ia' ? 'ia' : dia ? 'plan' : 'reglas',
    lugar: ci.lugar, minutos,
    explicacion: [...(v.sesion.explicacion || []).slice(0, 1), ...(v.sesion.explicacion || []).slice(1).filter(esUltimoRecurso), ...(todos.length ? [...cambios.map(c => 'Por tu check-in: ' + c), ...ajustes.map(c => 'Ajustado por la app: ' + c)] : [mia ? 'Nada que ajustar: haces tu sesión tal como la guardaste.' : 'Tu check-in no cambia nada: haces el día tal como estaba planificado.']), ...(v.sesion.explicacion || []).slice(1).filter(t => !esUltimoRecurso(t))].slice(0, 8),
    checkin,
    ...(mia ? { origen: { tipo: 'mia', id: mia.id } } : {}),
  };
  return { datos, cambios: todos, peticion };
}

// Lo que las reglas entienden de la petición del check-in (sin IA): tren superior o inferior. `atendido` dice
// qué se ha hecho con ella y `completa` si no pedía nada más (palabras de relleno aparte), para que la nota
// «No he podido atender…» diga qué sí y qué no (N4 del informe del 21-11-2026).
const RELLENO = new Set('hoy quiero quisiera me gustaria apetece solo solamente centrarme centrar centrado en el la los las lo de del al y a un una unos unas tren parte inferior superior pierna piernas gluteo gluteos torso brazo brazos pecho espalda trabajar hacer entrenar por favor mejor dia sesion toca toda todo mas que nada'.split(' '));
export function leerPeticion(texto) {
  // Lo negado («sin máquinas de pierna», «nada de pecho») no es una petición de ese tren.
  const pet = minus(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sin|no|nada de|ni|evitar|evita)\s+([a-zñ]+\s+){0,3}?(piernas?|inferior|gluteos?|superior|torso|brazos?|pecho|espalda)\b/g, ' ');
  let tipo = null;
  if (/superior|torso|brazo|pecho|espalda/.test(pet) && !/pierna|inferior/.test(pet)) tipo = 'torso';
  else if (/inferior|pierna|gluteo/.test(pet)) tipo = 'pierna';
  if (!tipo) return { tipo: null, atendido: '', completa: false };
  const resto = pet.split(/[^a-zñ]+/).filter(w => w && !RELLENO.has(w));
  return { tipo, atendido: tipo === 'torso' ? 'hoy torso' : 'hoy pierna y glúteo', completa: !resto.length };
}

// ── Cuándo merece la pena pagar una llamada a la IA para el día ──
// modo del perfil: 'auto' (por defecto) · 'siempre' · 'ahorro'. Con dolor de hoy ≥ 7 nunca (D2, C-DOLOR-4).
export function motivoIA(S, ci, dia) {
  const modo = S.perfil.usoIA || 'auto';
  if (maxDolorHoy(ci.dolorHoy) >= 7) return { usar: false, por: 'dolor', motivo: 'Con dolor de 7 o más, la sesión la prepara la app sin IA.' };
  if (restriccionesSalud(S).soloSuave) return { usar: false, por: 'salud', motivo: 'Por tus datos de salud, hoy la sesión suave la prepara la app.' };
  if (miaDe(S, ci.mia)) return { usar: false, por: 'mia', motivo: 'Es una de tus sesiones: la ajusta la app con tu check-in, sin gastar IA.' };
  if (!enLinea()) return { usar: false, por: 'red', motivo: 'Sin conexión: lo ajusta la app con sus reglas.' };
  // hecho: el aviso tras prepararla bien (M20 del informe del 21-11); motivo es el de la previa.
  if (ci.forzarIA) return { usar: true, motivo: 'Se lo pides al entrenador IA.', hecho: 'Te la ha preparado el entrenador IA, como pediste.' };
  if (modo === 'ahorro') return { usar: false, por: 'ahorro', motivo: 'Modo ahorro: la IA solo hace el plan semanal.' };
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

// ── Check-in de un toque (M21; decisión de Víctor del 23-11-2026) ──
// Antes de entrenar sale un paso mínimo: la casilla de señales de alarma siempre a la vista (C-ALAR-3) y «Todo
// bien, empezar», que prepara la sesión con lo que ya hay (plan, perfil y el dolor con que se rellena el
// check-in, C-DOLOR-0). El check-in completo se abre con «Algo ha cambiado», o directamente cuando hace falta:
// una de «Mis sesiones» elegida, una petición pendiente, un reintento, una ficha con dolor 7 o más o por revisar
// (C-DOLOR-0: «obliga a hacer el check-in») o un dolor de hoy de 7 o más.
// Devuelve el motivo por el que va el completo ('' si basta el de un toque).
export function motivoCheckinCompleto(S, ci) {
  if (ci.mia || ci.ocuparDia) return 'mia';
  if (ci.reintento) return 'reintento';
  if (String(ci.peticion || '').trim()) return 'peticion';
  const activas = S.perfil.lesiones.filter(l => l.activa);
  if (activas.some(l => l.dolorRevisar || +l.dolor >= 7)) return 'ficha';
  if (Object.values(ci.dolorHoy || {}).some(v => +v >= 7)) return 'dolor';
  return '';
}
// Lo que se usará si se empieza con un toque, en una frase: el día (o la sesión de las reglas), dónde, cuánto y
// con qué dolor, para que se vea qué se da por bueno.
export function resumenUnToque(S, ci) {
  const pv = previaCheckin(ci);
  const dolor = Object.entries(ci.dolorHoy || {}).filter(([z]) => ZONAS[z]).map(([z, v]) => `${nombreZona(z)} ${+v}/10`);
  const que = pv.dia ? `Toca ${pv.dia.nombre}` : 'Hoy no hay día en tu plan: te preparo una sesión con lo que te falta esta semana';
  return { pv, texto: frase(`${que}, en ${minus(LUGARES[ci.lugar] || ci.lugar)}, unos ${+pv.minutos} min`), dolor: dolor.length ? frase(`Con tu dolor de siempre: ${lista(dolor)}`) : '' };
}

// Vista previa del check-in (para enseñar qué cambia antes de crear la sesión).
export function previaCheckin(ci) {
  const S = estado();
  const dia = diaElegido(S, ci.diaPlan);
  const { datos, cambios } = ajustarAlCheckin(S, dia, ci);
  return { dia, datos, cambios, ia: motivoIA(S, ci, dia), minutos: tiempoSesion(datos) };
}
