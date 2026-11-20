// Área ENTRENADOR · el puente con la IA (/api/entrenador): qué se le manda, las barandillas sobre lo que
// devuelve y la creación de la sesión de hoy y del plan de la semana (con las reglas si la IA no está o falla).

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { llamar, enLinea } from '../../nucleo/api.js';
import { crearSesion, semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { perfilParaIA, lesionesParaIA, catalogoParaIA, historialParaIA, analizarEjercicios, analisisParaIA } from '../../reglas/contexto.js';
import { acotarKg, cargaMuscular, sesionesHechas } from '../../reglas/progresion.js';
import { nivelesZona, ex, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, DIAS } from '../../datos/constantes.js';
import { montarDia, reglaCardio, porQueEjercicio, porQueRehab, resumenDia, lista, minus } from './dia.js';
import { planReglas, planDeLaSemana, diaElegido, estadoDias } from './plan.js';
import { ajustarAlCheckin, motivoIA } from './checkin.js';
import { validarSesion } from './validar.js';

// ── Petición a la IA ──
function peticionBase(S, lugares, dolorHoy) {
  const catalogo = catalogoParaIA(S, lugares, dolorHoy);
  const ids = catalogo.map(e => e.id);
  return {
    perfil: perfilParaIA(S), lesiones: lesionesParaIA(S, dolorHoy), catalogo,
    historial: historialParaIA(S, ids, { niveles: nivelesZona(S.perfil, dolorHoy) }), analisis: analisisParaIA(S),
    hoy: hoyISO(), diaSemana: diaSemana(),
  };
}

// Barandillas sobre lo que propone la IA (sesión o día de plan): seguridad, kilos y piezas obligatorias.
function completarIA(S, d, { lugar, minutos, dolorHoy = {}, k = 0 }) {
  const r = montarDia(S, { lugar, minutos, tipo: lugar === 'piscina' ? 'piscina' : 'fullA', dolorHoy, k, futuro: !!d.futuro });
  const añadidos = [];
  if (!d.calentamiento || d.calentamiento.length < 2) { d.calentamiento = r.calentamiento; añadidos.push('calentamiento'); }
  if (!d.vuelta || d.vuelta.length < 2) { d.vuelta = r.vuelta; añadidos.push('estiramientos'); }
  const zonas = Object.keys(nivelesZona(S.perfil, dolorHoy)).filter(z => ZONAS[z]);
  zonas.forEach(z => {
    const tieneRehab = d.ejercicios.some(x => x.rol === 'rehab' && (ZONAS[z].rehab || []).includes(x.id)) || d.ejercicios.some(x => x.rol === 'rehab');
    if (!tieneRehab) { const x = r.ejercicios.find(y => y.rol === 'rehab'); if (x) { d.ejercicios.unshift(x); añadidos.push('rehabilitación de ' + minus(ZONAS[z].corta)); } }
  });
  const cardio = reglaCardio(S, lugar);
  if (cardio && cardio.obligatorio && !d.ejercicios.some(x => x.rol === 'cardio')) {
    const c = r.ejercicios.find(y => y.rol === 'cardio'); if (c) { d.ejercicios.push(c); añadidos.push('cardio'); }
  }
  d.ejercicios.forEach(x => {
    if (!(x.kg != null && +x.kg > 0)) { x.kg = null; return; }
    const conHistorial = sesionesHechas(S).some(s2 => (s2.ejercicios || []).some(y => y.id === x.id && (y.sets || []).some(z => z.hecha && +z.kg > 0)));
    // Sin historial no hay referencia: un peso absurdo se descarta y la persona elige el de partida.
    x.kg = conHistorial ? acotarKg(S, x.id, +x.kg) : +x.kg <= 120 ? +x.kg : null;
  });
  // Cada ejercicio con su porqué concreto: si la IA deja una nota vacía o genérica, la escribe la app con sus datos.
  const an = analizarEjercicios(S), carga = d.futuro ? {} : cargaMuscular(S), niveles = nivelesZona(S.perfil, dolorHoy);
  d.ejercicios.forEach((x, i) => {
    const e = ex(x.id); if (!e || !notaGenerica(x.nota)) return;
    if (x.rol === 'rehab') { const z = zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0]; if (z) x.nota = porQueRehab(S, e, z, dolorHoy); }
    else if (x.rol === 'principal') x.nota = porQueEjercicio(S, e, { i, d: x, an, carga, niveles, dolorHoy });
  });
  if (!(d.explicacion || []).length) {
    const rehabZ = d.ejercicios.filter(x => x.rol === 'rehab').map(x => ({ zona: zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0] })).filter(x => x.zona);
    d.explicacion = [resumenDia(S, { plantilla: { nombre: d.nombre || 'Sesión' }, elegidos: d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id)).filter(Boolean), rehab: rehabZ, cardio: d.ejercicios.find(x => x.rol === 'cardio'), an: {} })];
  }
  if (añadidos.length) d.explicacion = [...(d.explicacion || []), `La app añadió ${lista(añadidos)}, que siempre van.`];
  return d;
}
const notaGenerica = t => !t || String(t).trim().length < 30 || /^(con cuidado|cuidado|técnica limpia|cambiado|sin dolor|controlad)/i.test(String(t).trim()) && !/\d/.test(t);

// ── Sesión de hoy ──
// Devuelve { sesion, aviso }. Sin IA (o si falla) usa el día del plan ajustado al check-in o una sesión de reglas.
export async function crearSesionHoy(ci) {
  const S = estado();
  const dia = diaElegido(S, ci.diaPlan);
  const local = ajustarAlCheckin(S, dia, ci);
  const decide = motivoIA(S, ci, dia);
  let datos = local.datos, aviso = '';
  if (decide.usar) {
    try {
      const r = await llamar('entrenador', {
        modo: 'sesion', ...peticionBase(S, [ci.lugar], ci.dolorHoy),
        checkin: { lugar: LUGARES[ci.lugar], minutos: ci.minutos, energia: ci.energia, dolorHoy: ci.dolorHoy, peticion: ci.peticion || '' },
        planDeHoy: dia ? { nombre: dia.nombre, foco: dia.foco, lugar: LUGARES[dia.lugar], ejercicios: dia.ejercicios.map(x => ({ id: x.id, rol: x.rol, series: x.series, reps: x.reps })) } : null,
        ajusteReglas: local.cambios,
      });
      const s = r.sesion;
      const d = completarIA(S, { ...s, vuelta: s.vueltaCalma, ejercicios: (s.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(ci.lugar)) }, { lugar: ci.lugar, minutos: ci.minutos, dolorHoy: ci.dolorHoy });
      if (d.ejercicios.filter(x => x.rol !== 'rehab').length) {
        datos = { ...d, explicacion: [...(d.explicacion || []).slice(0, 1), ...(s.cambios || []).map(c => 'Por tu check-in: ' + c), ...(d.explicacion || []).slice(1)].slice(0, 8), fuente: 'ia', lugar: ci.lugar, minutos: ci.minutos, checkin: local.datos.checkin };
      } else aviso = 'La IA no propuso ejercicios válidos: sesión ajustada por la app.';
    } catch (e) {
      aviso = `Sesión ajustada por la app (${e.message}).`;
    }
  }
  const sesion = crearSesion(validarSesion(datos));
  sesion.ejercicios.forEach(x => { if (x.kg != null) { x.kg = acotarKg(S, x.id, x.kg); x.sets.forEach(z => { z.kg = x.kg; }); } });
  cambiar(S2 => {
    S2.sesiones[sesion.id] = sesion;
    if (dia && S2.plan) { S2.plan.hechos = S2.plan.hechos || {}; S2.plan.hechos[dia.diaSemana] = sesion.id; }
  }, 'sesion');
  return { sesion, aviso, motivo: decide.usar && !aviso ? decide.motivo : decide.usar ? '' : decide.motivo };
}

// ── Plan de la semana ──
// semana: { dias: [1..7], minutos, lugares }, conIA
export async function crearPlanSemana(semana, { conIA = true } = {}) {
  const S = estado();
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  const hoy = diaSemana();
  const est = estadoDias(S);
  const hechas = est.filter(d => d.estado === 'hecho');
  // A mitad de semana solo se planifican los días que quedan; lo hecho se conserva.
  const dias = semana.dias.filter(d => d >= hoy && !hechas.some(h => h.diaSemana === d));
  const conservar = hechas.map(d => planDeLaSemana(S).dias.find(x => x.diaSemana === d.diaSemana));
  const unir = plan => { plan.dias = [...conservar, ...plan.dias].sort((a, b) => a.diaSemana - b.diaSemana); plan.hechos = (planDeLaSemana(S) || {}).hechos || {}; return plan; };
  if (!dias.length) return { plan: planDeLaSemana(S), aviso: 'No quedan días por planificar esta semana.' };
  if (conIA && enLinea()) {
    try {
      const r = await llamar('entrenador', {
        modo: 'plan', ...peticionBase(S, lugares, {}),
        semana: {
          dias, minutos: semana.minutos, lugares: lugares.map(l => ({ id: l, nombre: LUGARES[l] })),
          hechas: hechas.map(d => ({ dia: DIAS[d.diaSemana], nombre: d.nombre, musculos: [...new Set(d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id) && ex(x.id).m[0]).filter(Boolean))] })),
        },
      }, { espera: 240000 });
      const plan = normalizarPlan(S, r.plan, lugares, dias, semana.minutos);
      if (!plan.dias.length) throw new Error('plan vacío');
      cambiar(S2 => { S2.plan = unir(plan); }, 'plan');
      return { plan, aviso: '' };
    } catch (e) {
      const plan = unir(planReglas(S, { ...semana, dias, lugares }, { hechas }));
      cambiar(S2 => { S2.plan = plan; }, 'plan');
      return { plan, aviso: `Plan hecho por la app (${e.message}).` };
    }
  }
  const plan = unir(planReglas(S, { ...semana, dias, lugares }, { hechas }));
  cambiar(S2 => { S2.plan = plan; }, 'plan');
  return { plan, aviso: '' };
}

function normalizarPlan(S, p, lugares, dias, minutos) {
  const vistos = new Set();
  const out = (p.dias || []).map((d, i) => {
    const lugar = lugares.includes(d.lugar) ? d.lugar : lugares[0];
    const ds = Math.max(1, Math.min(7, +d.diaSemana || 1));
    if (!dias.includes(ds) || vistos.has(ds)) return null;
    vistos.add(ds);
    const dd = completarIA(S, {
      futuro: true, nombre: String(d.nombre || '').slice(0, 60), foco: String(d.foco || '').slice(0, 80),
      explicacion: (Array.isArray(d.explicacion) ? d.explicacion : [d.explicacion]).filter(Boolean).map(String),
      calentamiento: d.calentamiento || [], vuelta: d.vueltaCalma || d.vuelta || [],
      ejercicios: (d.ejercicios || []).filter(x => ex(x.id) && ex(x.id).l.includes(lugar)),
    }, { lugar, minutos: +d.minutos || minutos, k: i });
    delete dd.futuro;
    return { diaSemana: ds, lugar, minutos: +d.minutos || minutos, tipo: null, ...dd };
  }).filter(Boolean);
  // Días que la IA se dejó: los completa la app.
  const faltan = dias.filter(d => !vistos.has(d));
  if (faltan.length) planReglas(S, { dias: faltan, minutos, lugares }).dias.forEach(d => out.push({ ...d, explicacion: [...d.explicacion.slice(0, 1), 'Día completado por la app.', ...d.explicacion.slice(1)] }));
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'ia',
    resumen: String(p.resumen || ''), criterios: String(p.criterios || ''), progresion: String(p.progresion || ''),
    dias: out.sort((a, b) => a.diaSemana - b.diaSemana), hechos: {},
  };
}
