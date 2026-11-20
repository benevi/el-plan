// Área ENTRENADOR · el puente con la IA (/api/entrenador): qué se le manda, las barandillas sobre lo que
// devuelve y la creación de la sesión de hoy y del plan de la semana (con las reglas si la IA no está o falla).
// Lo que propone la IA pasa por el validador único (validar.js): se corrige con las reglas y, si no se puede,
// la sesión entera sale de las reglas; la IA no se reintenta (C-IA-3). Antes de generar nada se preguntan
// las señales de alarma y el «desde cuándo» de las lesiones que no lo tienen (C-ALAR-1, C-ALAR-4, C-LES-6).

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { llamar, enLinea } from '../../nucleo/api.js';
import { crearSesion, semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { perfilParaIA, lesionesParaIA, catalogoParaIA, historialParaIA, analizarEjercicios, analisisParaIA, recortarIA, LARGO_IA } from '../../reglas/contexto.js';
import { cargaMuscular, lesionesSinFecha } from '../../reglas/progresion.js';
import { nivelesZona, ex, ZONAS } from '../../reglas/catalogo.js';
import { LUGARES, DIAS } from '../../datos/constantes.js';
import { porQueEjercicio, porQueRehab, resumenDia, lista, minutosSesion, nombreZona, bandasHoy, contextoDia, reglaCardio, minutosCalentamiento, minutosVuelta } from './dia.js';
import { planReglas, planDeLaSemana, diaElegido, estadoDias } from './plan.js';
import { ajustarAlCheckin, motivoIA } from './checkin.js';
import { validarSesion, esUltimoRecurso } from './validar.js';
import { alarmaPendiente, preguntaAlarma, respondidasNo, T2 } from './alarma.js';
import { etiquetasSalud } from './salud.js';

// ── Petición a la IA ──
// Sin el nombre de la persona, lugares con sus ids, textos libres recortados y salud solo como etiquetas
// (C-SALUD-0). Las zonas van con su banda, techo y fase ya calculados (los mismos que usa el validador).
function peticionBase(S, lugares, dolorHoy = {}, { plan = false } = {}) {
  const catalogo = catalogoParaIA(S, lugares, dolorHoy);
  const ids = catalogo.map(e => e.id);
  return {
    perfil: { ...perfilParaIA(S), salud: etiquetasSalud(S) }, lesiones: lesionesParaIA(S, dolorHoy, bandasHoy(S, dolorHoy, { plan })), catalogo,
    historial: historialParaIA(S, ids, { niveles: nivelesZona(S.perfil, dolorHoy) }), analisis: analisisParaIA(S),
    hoy: hoyISO(), diaSemana: diaSemana(),
  };
}
// Lo que las reglas ya fijan para un día y la IA tiene que respetar: cardio mínimo (C-CARDIO-1, C-CARDIO-4),
// minutos de calentamiento y vuelta (C-CAL-1, C-VUELTA-1), tiempo máximo (C-TIEMPO-1), principales con poca
// energía (C-ENERGIA-1), edad (C-EDAD-1) y salud (C-SALUD-0). Son números: el validador los vuelve a comprobar.
export function pautasDia(S, { lugar, minutos, dolorHoy = {}, energia = 3, futuro = false }) {
  const ctx = contextoDia(S, { lugar, minutos, dolorHoy, energia, futuro });
  const c = reglaCardio(S, ctx.lugar, { minutos: ctx.minutos, energia: ctx.energia, bandas: ctx.bandas });
  const sal = ctx.salud, mayor = ctx.edad != null && ctx.edad >= 60;
  return {
    cardio: { minimo: c.minutos, maximo: c.max, rpe: c.rpe, intervalos: !!c.intervalos },
    calentamientoMin: minutosCalentamiento(S, ctx), vueltaMin: minutosVuelta(S, ctx),
    minutosMax: Math.floor(ctx.minutos * 1.1),
    maxPrincipales: ctx.energia === 1 ? 3 : ctx.energia === 2 ? 4 : undefined,
    margenMin: Math.max(sal.margenMin || 0, mayor ? 2 : 0) || undefined,
    rpeMax: sal.rpeMax || undefined, isometricoMaxSeg: sal.isoMax || undefined, descansoMinSeg: sal.descansoMin || undefined,
    equilibrio: sal.equilibrio || mayor || undefined,
  };
}

// ── Antes de generar: alarma y «desde cuándo» ──
// Opciones de «¿Desde cuándo te duele?» (C-LES-6): la respuesta se guarda como fecha aproximada.
export const DESDE = { menos6: ['menos de 6 semanas', 21], de6a12: ['6 a 12 semanas', 63], mas3m: ['más de 3 meses', 120], nose: ['no lo sé', 0] };
const sinDesde = S => lesionesSinFecha(S);
// Lo que hay que preguntar antes de generar la sesión, o null. ci.desde: { zona: clave de DESDE }.
export function preguntaAntes(S, ci = {}) {
  const p = alarmaPendiente(S, ci);
  if (p) return { tipo: 'alarma', frase: p.frase, texto: preguntaAlarma(p.frase, p.de) };
  const zonas = sinDesde(S).map(l => l.zona).filter(z => !(ci.desde || {})[z]);
  if (zonas.length) return { tipo: 'desde', zonas, texto: `¿Desde cuándo te duele ${lista(zonas.map(z => `tu ${nombreZona(z)}`))}?` };
  return null;
}
// Apunta una alarma (marcada o respondida) en S.alarmas. Con «sí», el día queda «sin entrenar por precaución»
// y la sesión de hoy que aún no se ha empezado se cancela (C-ALAR-1).
function apuntarAlarma(a) {
  cambiar(S => {
    S.alarmas = [...(S.alarmas || []), { fecha: hoyISO(), ...a }].slice(-100);
    if (a.respuesta !== 'si') return;
    Object.values(S.sesiones).filter(s => s.fecha === hoyISO() && s.estado === 'pendiente').forEach(s => {
      delete S.sesiones[s.id];
      if (S.plan && S.plan.hechos) Object.keys(S.plan.hechos).forEach(d => { if (S.plan.hechos[d] === s.id) delete S.plan.hechos[d]; });
    });
  }, 'alarma');
}
export const sinEntrenarHoy = S => (S.alarmas || []).some(a => a.fecha === hoyISO() && a.respuesta === 'si');

// Barandillas sobre lo que propone la IA (sesión o día de plan): el validador único y notas con datos.
function completarIA(S, d, { lugar, minutos, dolorHoy = {}, energia = 3, k = 0, futuro = false }) {
  const v = validarSesion(S, d, { lugar, minutos, dolorHoy, energia, futuro, origen: 'ia', k });
  const s = v.sesion;
  // Cada ejercicio con su porqué concreto: si la IA deja una nota vacía o genérica, la escribe la app con sus datos.
  const an = analizarEjercicios(S), carga = futuro ? {} : cargaMuscular(S), niveles = nivelesZona(S.perfil, dolorHoy);
  const zonas = Object.keys(nivelesZona(S.perfil, dolorHoy)).filter(z => ZONAS[z]);
  s.ejercicios.forEach((x, i) => {
    const e = ex(x.id); if (!e || !notaGenerica(x.nota)) return;
    if (x.rol === 'rehab') { const z = zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0]; if (z) x.nota = porQueRehab(S, e, z, dolorHoy); }
    else if (x.rol === 'principal') x.nota = porQueEjercicio(S, e, { i, d: x, an, carga, niveles, dolorHoy });
  });
  if (!(s.explicacion || []).length) {
    const rehabZ = s.ejercicios.filter(x => x.rol === 'rehab').map(x => ({ zona: zonas.find(z => (ZONAS[z].rehab || []).includes(x.id)) || zonas[0] })).filter(x => x.zona);
    s.explicacion = [resumenDia(S, { plantilla: { nombre: s.nombre || 'Sesión' }, elegidos: s.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id)).filter(Boolean), rehab: rehabZ, cardio: s.ejercicios.find(x => x.rol === 'cardio'), an: {} })];
  }
  return { sesion: s, cambios: v.cambios, valida: v.valida };
}
const notaGenerica = t => !t || String(t).trim().length < 30 || /^(con cuidado|cuidado|técnica limpia|cambiado|sin dolor|controlad)/i.test(String(t).trim()) && !/\d/.test(t);
const principalesValidos = (lista0, lugar) => (lista0 || []).filter(x => x && x.rol !== 'rehab' && x.rol !== 'cardio' && ex(x.id) && ex(x.id).l.includes(lugar)).length;

// ── Sesión de hoy ──
// Devuelve { sesion, aviso, motivo } o, si antes hay que preguntar algo, { sesion: null, pregunta } y, con una
// señal de alarma, { sesion: null, alarma: [T2] }. Sin IA (o si falla) usa el día del plan ajustado al
// check-in o una sesión de reglas. ci: { …, alarma (casilla), alarmaRespuesta 'si'|'no', alarmaFrase, desde }
export async function crearSesionHoy(ci) {
  let S = estado();
  // Señal de alarma marcada o confirmada: hoy no se entrena, ni reglas ni IA (C-ALAR-1, C-ALAR-5).
  if (ci.alarma || ci.alarmaRespuesta === 'si') {
    apuntarAlarma({ respuesta: 'si', frase: String(ci.alarmaFrase || (ci.alarma ? 'casilla del check-in' : '')).slice(0, 200) });
    return { sesion: null, alarma: T2, aviso: '', motivo: '' };
  }
  // Ya hay una alarma confirmada hoy: no se entrena (por ningún camino).
  if (sinEntrenarHoy(S)) return { sesion: null, alarma: T2, aviso: '', motivo: '' };
  const yaNo = new Set((S.alarmas || []).filter(a => a.respuesta === 'no').map(a => a.frase));
  respondidasNo(ci).filter(f => !yaNo.has(f)).forEach(f => apuntarAlarma({ respuesta: 'no', frase: String(f).slice(0, 200) }));
  // Respuestas a «¿desde cuándo?» (C-LES-6).
  const desde = ci.desde || {};
  if (sinDesde(S).some(l => DESDE[desde[l.zona]])) {
    cambiar(S2 => S2.perfil.lesiones.forEach(l => {
      const r = DESDE[desde[l.zona]]; if (!l.activa || l.desde || !r) return;
      l.desde = hoyISO(new Date(Date.now() - r[1] * 864e5));
      if (desde[l.zona] === 'nose' && !l.tipo) l.tipo = 'puntual';
    }), 'perfil');
    S = estado();
  }
  const pregunta = preguntaAntes(S, ci);
  if (pregunta) return { sesion: null, pregunta, aviso: '', motivo: '' };

  const minutos = minutosSesion(ci.minutos);
  const dia = diaElegido(S, ci.diaPlan);
  const local = ajustarAlCheckin(S, dia, ci);
  const decide = motivoIA(S, ci, dia);
  let datos = local.datos, aviso = '';
  if (decide.usar) {
    try {
      const r = await llamar('entrenador', {
        modo: 'sesion', ...peticionBase(S, [ci.lugar], ci.dolorHoy || {}),
        checkin: {
          lugar: ci.lugar, minutos, energia: ci.energia, dolorHoy: ci.dolorHoy || {}, peticion: recortarIA(ci.peticion, LARGO_IA.peticion),
          pautas: pautasDia(S, { lugar: ci.lugar, minutos, dolorHoy: ci.dolorHoy || {}, energia: +ci.energia || 3 }),
        },
        planDeHoy: dia ? { nombre: dia.nombre, foco: dia.foco, lugar: dia.lugar, ejercicios: dia.ejercicios.map(x => ({ id: x.id, rol: x.rol, series: x.series, reps: x.reps })) } : null,
        ajusteReglas: local.cambios,
      });
      const s = r.sesion;
      if (!principalesValidos(s.ejercicios, ci.lugar)) aviso = 'La IA no propuso ejercicios válidos: sesión ajustada por la app.';
      else {
        const d = completarIA(S, { ...s, vuelta: s.vueltaCalma || s.vuelta, ejercicios: (s.ejercicios || []).filter(x => x && ex(x.id)) }, { lugar: ci.lugar, minutos, dolorHoy: ci.dolorHoy || {}, energia: +ci.energia || 3 });
        if (!d.valida) aviso = 'La sesión de la IA no cumplía las reglas de seguridad: sesión ajustada por la app.';
        else {
          const ex0 = d.sesion.explicacion || [];
          datos = {
            ...d.sesion, fuente: 'ia', lugar: ci.lugar, minutos, checkin: local.datos.checkin,
            // El último recurso de tiempo va arriba: explica por qué hay menos de 3 principales (C-TIEMPO-2).
            explicacion: [...ex0.slice(0, 1), ...ex0.slice(1).filter(esUltimoRecurso), ...(s.cambios || []).map(c => 'Por tu check-in: ' + c), ...d.cambios.map(c => 'Ajustado por la app: ' + c), ...ex0.slice(1).filter(t => !esUltimoRecurso(t))].slice(0, 8),
          };
        }
      }
    } catch (e) {
      aviso = `Sesión ajustada por la app (${e.message}).`;
    }
  }
  const sesion = crearSesion(datos);
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
  // Con una alarma pendiente o confirmada hoy, la IA no recibe nada (C-ALAR-5): el plan lo hacen las reglas.
  if (conIA && enLinea() && !sinEntrenarHoy(S) && !alarmaPendiente(S, {})) {
    try {
      const r = await llamar('entrenador', {
        modo: 'plan', ...peticionBase(S, lugares, {}, { plan: true }),
        semana: {
          dias, minutos: semana.minutos, lugares: lugares.map(l => ({ id: l, nombre: LUGARES[l] })),
          pautas: Object.fromEntries(lugares.map(l => [l, pautasDia(S, { lugar: l, minutos: semana.minutos, futuro: true })])),
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
    const ds = Math.max(1, Math.min(7, +d.diaSemana || 1));
    if (!dias.includes(ds) || vistos.has(ds)) return null;
    // Lugar del día: el que dice la IA si es de la persona; si sus ejercicios son de otro lugar, el de la mayoría.
    const ejsIA = (d.ejercicios || []).filter(x => x && ex(x.id));
    const cuenta = l => ejsIA.filter(x => ex(x.id).l.includes(l)).length;
    let lugar = lugares.includes(d.lugar) ? d.lugar : lugares[0];
    const mejor = lugares.slice().sort((a, b) => cuenta(b) - cuenta(a))[0];
    if (cuenta(lugar) < 3 && cuenta(mejor) > cuenta(lugar)) lugar = mejor;
    const min = minutosSesion(minutos); // los minutos que pidió la persona para la semana, no los de la IA
    const explicacion = (Array.isArray(d.explicacion) ? d.explicacion : [d.explicacion]).filter(Boolean).map(String);
    // Día suave del reparto (C-REP-2): sin fuerza, con su cardio; lo marca el primer punto de la explicación.
    const suave = /^Día suave/i.test(explicacion[0] || '') && !ejsIA.some(x => x.rol === 'principal') && ejsIA.some(x => x.rol === 'cardio');
    // Día sin ejercicios válidos para su lugar: lo hace la app (no se acepta un día vacío).
    if (!suave && principalesValidos(ejsIA, lugar) === 0) return null;
    const c = completarIA(S, {
      nombre: String(d.nombre || '').slice(0, 60), foco: String(d.foco || '').slice(0, 80), explicacion,
      calentamiento: d.calentamiento || [], vuelta: d.vueltaCalma || d.vuelta || [], ejercicios: ejsIA, ...(suave ? { tipo: 'suave' } : {}),
    }, { lugar, minutos: min, k: i, futuro: true });
    if (!c.valida || !c.sesion.ejercicios.length) return null;
    vistos.add(ds);
    const dd = c.sesion;
    if (c.cambios.length) dd.explicacion = [...dd.explicacion, ...c.cambios.map(t => 'Ajustado por la app: ' + t)];
    return { diaSemana: ds, lugar, minutos: min, tipo: suave ? 'suave' : null, nombre: dd.nombre, foco: dd.foco, explicacion: dd.explicacion, calentamiento: dd.calentamiento, ejercicios: dd.ejercicios, vuelta: dd.vuelta };
  }).filter(Boolean);
  // Días que la IA se dejó (o que no se pudieron corregir): los completa la app.
  const faltan = dias.filter(d => !vistos.has(d));
  if (faltan.length) planReglas(S, { dias: faltan, minutos, lugares }).dias.forEach(d => out.push({ ...d, explicacion: [...d.explicacion.slice(0, 1), 'Día completado por la app.', ...d.explicacion.slice(1)] }));
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'ia',
    resumen: String(p.resumen || ''), criterios: String(p.criterios || ''), progresion: String(p.progresion || ''),
    dias: out.sort((a, b) => a.diaSemana - b.diaSemana), hechos: {},
  };
}
