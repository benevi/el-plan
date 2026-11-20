// Área ENTRENADOR · el check-in: cómo cambia el día planificado con cómo estás hoy (energía, dolor,
// tiempo, lugar, petición, recuperación y progresión), y cuándo merece la pena pagar la IA.

import { estado } from '../../nucleo/estado.js';
import { enLinea } from '../../nucleo/api.js';
import { es } from '../../nucleo/ui.js';
import { diaSemana } from '../../nucleo/modelo.js';
import { analizarEjercicios, leerComentario } from '../../reglas/contexto.js';
import { sugerir, cargaMuscular, sesionesHechas } from '../../reglas/progresion.js';
import { nivelesZona, ex, riesgo, alternativas, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, MUSCULOS } from '../../datos/constantes.js';
import { montarDia, reglaCardio, tiempoSesion, minDe, lista, minus, frase } from './dia.js';
import { planDeLaSemana, diaElegido } from './plan.js';

// ── Check-in: lo que cambia del día planificado con cómo estás hoy ──
// ci: { lugar, minutos, energia 1-5, dolorHoy {zona:n}, peticion }
// Devuelve { datos (para crearSesion), cambios [texto] }.
export function ajustarAlCheckin(S, dia, ci) {
  const cambios = [];
  const energia = +ci.energia || 3;
  const dolorHoy = ci.dolorHoy || {};
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const maxDolor = Math.max(0, ...Object.values(dolorHoy).map(Number));
  const lesionDolor = Object.fromEntries(S.perfil.lesiones.filter(l => l.activa).map(l => [l.zona, +l.dolor]));
  const pet = minus(ci.peticion);
  let base = dia ? JSON.parse(JSON.stringify(dia)) : null;
  const tipoDe = d => d && d.tipo || 'fullA';

  // Dolor fuerte: sesión suave de movilidad y rehabilitación.
  if (maxDolor >= 7) {
    const z = Object.entries(dolorHoy).find(([, v]) => +v >= 7)[0];
    base = montarDia(S, { lugar: ci.lugar, minutos: Math.min(ci.minutos, 40), tipo: ci.lugar === 'piscina' ? 'piscina' : 'salud', dolorHoy, rehabExtra: true });
    base.nombre = 'Sesión suave';
    if (!reglaCardio(S, ci.lugar, { dolorMax: maxDolor })) base.ejercicios = base.ejercicios.filter(x => x.rol !== 'cardio');
    cambios.push(`Te duele ${minus((ZONAS[z] || {}).corta || z)} a ${dolorHoy[z]}/10: hoy sesión suave de movilidad y rehabilitación, sin cargar. Si sigue así varios días, consúltalo con tu fisio.`);
  } else {
    // Petición concreta que las reglas entienden.
    let tipo = tipoDe(base);
    if (/superior|torso|brazo|pecho|espalda/.test(pet) && !/pierna|inferior/.test(pet)) { tipo = 'torso'; cambios.push('Pides tren superior: hoy torso.'); }
    else if (/inferior|pierna|gl[uú]teo/.test(pet)) { tipo = 'pierna'; cambios.push('Pides tren inferior: hoy pierna y glúteo.'); }
    if (!base || ci.lugar !== base.lugar || tipo !== tipoDe(base)) {
      if (base && ci.lugar !== base.lugar) cambios.push(`Hoy entrenas en ${minus(LUGARES[ci.lugar])} en vez de ${minus(LUGARES[base.lugar])}: misma idea, con lo que hay allí.`);
      const huecos = base && base.ejercicios && tipo === tipoDe(base) && ci.lugar !== 'piscina' ? base.ejercicios.filter(x => x.rol === 'principal' && ex(x.id)).map(x => ex(x.id).m[0]) : null;
      base = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: ci.lugar === 'piscina' ? 'piscina' : tipo, huecos: huecos && huecos.length ? huecos : null, dolorHoy, k: diaSemana() });
    }
  }
  if (!base.calentamiento || !base.calentamiento.length || !base.vuelta || !base.vuelta.length) {
    const r = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: tipoDe(base), dolorHoy });
    if (!base.calentamiento || !base.calentamiento.length) base.calentamiento = r.calentamiento;
    if (!base.vuelta || !base.vuelta.length) base.vuelta = r.vuelta;
  }
  let ej = base.ejercicios.map(x => ({ ...x }));

  // Dolor de hoy: fuera (o cambiado) lo que hoy carga la zona.
  Object.entries(dolorHoy).forEach(([z, v]) => {
    if (+v >= 1 && lesionDolor[z] == null) cambios.push(`Dolor nuevo en ${minus((ZONAS[z] || {}).corta || z)} (${v}/10): lo tengo en cuenta en cada ejercicio.`);
    else if (lesionDolor[z] != null && +v >= lesionDolor[z] + 2) cambios.push(`Tu ${minus(ZONAS[z].corta)} está peor que de costumbre (${v}/10 frente a ${lesionDolor[z]}/10).`);
  });
  const an = analizarEjercicios(S);
  ej = ej.map(x => {
    const e = ex(x.id); if (!e || x.rol === 'rehab') return x;
    const peligro = riesgo(e, niveles) === 'evitar';
    const molesta = an[x.id] && (an[x.id].estado === 'molesta' || an[x.id].gusto === 'rechazo');
    if (!peligro && !molesta) return x;
    const alt = alternativas(e, ci.lugar, S.perfil, { excluir: ej.map(y => y.id), dolorHoy }).filter(a => !an[a.id] || an[a.id].estado !== 'molesta')[0];
    const por = peligro ? `carga la zona que hoy te duele` : an[x.id].gusto === 'rechazo' ? 'no lo quieres' : `te ha molestado («${(an[x.id].comentarios.slice(-1)[0] || {}).texto || 'dolor después'}»)`;
    if (!alt) { cambios.push(`Quito ${e.n.toLowerCase()}: ${por}.`); return null; }
    cambios.push(`Cambio ${e.n.toLowerCase()} por ${alt.n.toLowerCase()}: ${por}.`);
    return { ...x, id: alt.id, nota: frase(`Hoy en lugar de ${e.n.toLowerCase()}: ${por}`) + ' Mismo trabajo, sin cargar esa zona.' };
  }).filter(Boolean);
  // Comentarios de «ocupado»: aviso con alternativa.
  ej.forEach(x => { const a = an[x.id]; if (a && a.problemas.includes('ocupado')) { const alt = alternativas(ex(x.id), ci.lugar, S.perfil, { excluir: ej.map(y => y.id), dolorHoy })[0]; if (alt) x.nota = [x.nota, `Si está ocupado otra vez, haz ${alt.n.toLowerCase()}.`].filter(Boolean).join(' '); } });

  // Recuperación: músculos aún cargados (por ejemplo si entrenó ayer fuera del plan).
  const carga = cargaMuscular(S);
  const cargados = [...new Set(ej.filter(x => x.rol === 'principal' && carga[ex(x.id).m[0]] && carga[ex(x.id).m[0]].estado === 'cargado').map(x => ex(x.id).m[0]))];
  if (cargados.length) {
    ej.forEach(x => { if (x.rol === 'principal' && cargados.includes(ex(x.id).m[0]) && x.series > 2) x.series--; });
    cambios.push(`${lista(cargados.map(m => MUSCULOS[m]))} aún se recupera${cargados.length > 1 ? 'n' : ''}: una serie menos y sin subir peso.`);
  }

  // Energía.
  if (energia <= 2) {
    const antes = ej.filter(x => x.rol === 'principal').length;
    ej.forEach(x => { if (x.rol === 'principal' && x.series > 2) x.series--; if (x.rol === 'cardio') { x.reps = energia === 1 ? '10 min' : '12-15 min'; x.nota = `${x.reps} suaves: hoy tienes poca energía (${energia}/5) y mejor recuperar. Ritmo en el que puedas hablar.`; } });
    const prin = ej.filter(x => x.rol === 'principal');
    if (prin.length > 4) { const quitar = prin.slice(4).map(x => x.id); ej = ej.filter(x => !quitar.includes(x.id)); }
    cambios.push(`Energía ${energia === 1 ? 'muy baja' : 'baja'}: una serie menos${antes > 4 ? `, ${antes - 4} ejercicio${antes - 4 > 1 ? 's' : ''} menos` : ''}${ej.some(x => x.rol === 'cardio') ? ' y cardio más corto' : ''}, y sin subir peso.`);
  } else if (energia === 5) {
    const p = ej.find(x => x.rol === 'principal' && ex(x.id).t === 'reps');
    if (p && p.series < 5) { p.series++; cambios.push(`Energía a tope: una serie más de ${ex(p.id).n.toLowerCase()}.`); }
  }

  // Tiempo disponible.
  let t = tiempoSesion({ ejercicios: ej });
  if (t > ci.minutos + 5) {
    const quitados = [];
    while (t > ci.minutos + 5 && ej.filter(x => x.rol === 'principal').length > 3) {
      const idx = ej.map(x => x.rol).lastIndexOf('principal');
      quitados.push(ex(ej[idx].id).n.toLowerCase()); ej.splice(idx, 1); t = tiempoSesion({ ejercicios: ej });
    }
    const c = ej.find(x => x.rol === 'cardio');
    if (t > ci.minutos + 5 && c) { c.reps = `${Math.max(8, minDe(c.reps) - (t - ci.minutos))} min`; c.nota = String(c.nota || '').replace(/^\d+ min( \([^)]*\))?/, `${c.reps} (lo que cabe en tus ${ci.minutos} min de hoy)`); }
    if (quitados.length) cambios.push(`Tienes ${ci.minutos} minutos: quito ${lista(quitados)}.`);
  } else if (t < ci.minutos - 15 && maxDolor < 7) {
    const extra = montarDia(S, { lugar: ci.lugar, minutos: ci.minutos, tipo: tipoDe(base), dolorHoy, k: diaSemana() + 1 }).ejercicios
      .filter(x => x.rol === 'principal' && !ej.some(y => y.id === x.id));
    const añadidos = [];
    while (extra.length && t < ci.minutos - 10) { const x = extra.shift(); const pos = ej.map(y => y.rol).lastIndexOf('principal') + 1; ej.splice(pos, 0, x); añadidos.push(ex(x.id).n.toLowerCase()); t = tiempoSesion({ ejercicios: ej }); }
    if (añadidos.length) cambios.push(`Tienes ${ci.minutos} minutos: añado ${lista(añadidos)}.`);
  }

  // Progresión de cada ejercicio con lo que apuntaste (doble progresión con frenos).
  const subidas = [], bajadas = [];
  ej = ej.map(x => {
    if (x.rol === 'cardio') return x;
    const sg = sugerir(S, x.id, { series: x.series, reps: x.reps }, { energia, niveles, carga });
    if (sg.tipo === 'sube') subidas.push(`${ex(x.id).n.toLowerCase()}${sg.kg != null ? ' a ' + es(sg.kg) + ' kg' : ' (' + sg.reps + ')'}`);
    if (sg.tipo === 'baja') bajadas.push(ex(x.id).n.toLowerCase());
    return { ...x, series: sg.series, reps: sg.reps, kg: sg.kg != null ? sg.kg : x.kg, motivo: sg.motivo };
  });
  if (subidas.length) cambios.push(`Subes en ${lista(subidas)}: llegaste al tope la última vez.`);
  if (bajadas.length) cambios.push(`Bajas un poco en ${lista(bajadas)} para recuperar el ritmo.`);

  const datos = {
    ...base, fuente: base.fuente === 'ia' ? 'ia' : dia ? 'plan' : 'reglas',
    lugar: ci.lugar, minutos: ci.minutos, ejercicios: ej,
    explicacion: [...(base.explicacion || []).slice(0, 1), ...(cambios.length ? cambios.map(c => 'Por tu check-in: ' + c) : ['Tu check-in no cambia nada: haces el día tal como estaba planificado.']), ...(base.explicacion || []).slice(1)].slice(0, 8),
    checkin: { energia, dolor: dolorHoy, tiempo: ci.minutos },
  };
  return { datos, cambios };
}

// ── Cuándo merece la pena pagar una llamada a la IA para el día ──
// modo del perfil: 'auto' (por defecto) · 'siempre' · 'ahorro'.
export function motivoIA(S, ci, dia) {
  const modo = S.perfil.usoIA || 'auto';
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
