// Pruebas de caracterización del entrenador (PR 6): fotografía lo que hace HOY el entrenador para cada
// perfil de perfiles.mjs, para poder mover el código sin cambiar nada. No dice si lo que sale está bien
// (eso lo comprueban las demás pruebas y el PR 8): solo que es igual que antes.
//
// Todo es determinista: fecha y zona fijas con el reloj quieto, Math.random con semilla por perfil,
// y la red simulada (fetch que falla, o respuestas de IA fijas).
import { createHash } from 'node:crypto';
import { fijarFecha } from '../ayuda/comun.mjs';
import { nuevoS, ent, est, ponerRed, hecha } from '../ayuda/node.mjs';
import { PERFILES } from './perfiles.mjs';

fijarFecha('2026-11-18T10:00', { quieto: true }); // miércoles (diaSemana 3)

// ── Azar con semilla (uid() y los ids de las sesiones del historial) ──
let semilla = 1;
Math.random = () => {
  semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── Red simulada ──
let peticiones = [];
const huella = x => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
function red(respuesta) {
  peticiones = [];
  ponerRed(respuesta !== undefined, async (url, o) => {
    const cuerpo = JSON.parse(o.body);
    peticiones.push({ url, modo: cuerpo.modo, claves: Object.keys(cuerpo), huella: huella(cuerpo) });
    if (respuesta instanceof Error) throw respuesta;
    return { ok: true, status: 200, json: async () => respuesta };
  });
}
const FALLA = new TypeError('Failed to fetch');

// ── Respuestas de IA fijas (mezclan lugares: la app filtra lo que no es del lugar) ──
const T = (nombre, duracion = '2 min', id = '') => ({ id, nombre, detalle: 'Detalle de la tarea.', duracion });
const NOTA = 'Nota concreta de la IA con datos: 3 series de 10 a 40 kg, sube si llegas a 12.';
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: NOTA, ...o });
const EJ_IA = [
  E('press-pecho-maquina', 'principal', { kg: 40 }), E('jalon-pecho', 'principal', { kg: 35 }), E('prensa-piernas', 'principal', { kg: 500 }), E('curl-mancuernas', 'principal', { kg: 12 }),
  E('flexiones'), E('sentadilla-peso-corporal'), E('puente-gluteo'),
  E('dominadas'), E('zancadas'), E('plancha', 'principal', { reps: '30-45s' }),
  E('crol', 'principal', { reps: '4 × 25 m' }), E('patada-crol-tabla', 'principal', { reps: '4 × 25 m' }), E('aquajogging', 'cardio', { series: 1, reps: '10 min', descanso: 0 }),
];
const SESION_IA = {
  completa: {
    nombre: 'Sesión de la IA', foco: 'Todo el cuerpo', cambios: ['Hoy más corta por tu energía.'], explicacion: ['Porque lo pide tu check-in.', 'Segunda razón.'],
    calentamiento: [T('Bici suave', '5 min', 'bici-estatica'), T('Movilidad de hombros')], ejercicios: EJ_IA,
    vueltaCalma: [T('Estiramiento de pecho', '1 min'), T('Respiración', '1 min')],
  },
  pobre: {
    nombre: 'Corta', foco: '', cambios: [], calentamiento: [], vueltaCalma: [T('Respirar')],
    ejercicios: EJ_IA.map(x => ({ ...x, nota: x.id.length % 2 ? 'Con cuidado' : '', kg: x.kg ? x.kg * 3 : x.kg })),
  },
  vacia: { nombre: 'Nada', ejercicios: [{ id: 'no-existe', rol: 'principal' }] },
};
const PLAN_IA = dias => ({
  plan: {
    resumen: 'Plan de la IA.', criterios: 'Criterios de la IA.', progresion: 'Progresión de la IA.',
    dias: [
      { diaSemana: dias[0], lugar: 'gym', nombre: 'Día IA 1', foco: 'Torso', minutos: 55, explicacion: 'Una sola explicación', calentamiento: [T('a'), T('b')], ejercicios: EJ_IA, vueltaCalma: [T('c'), T('d')] },
      { diaSemana: dias[0], lugar: 'gym', nombre: 'Repetido', ejercicios: EJ_IA }, // mismo día: se descarta
      { diaSemana: 9, lugar: 'luna', nombre: 'Fuera de rango', ejercicios: EJ_IA.slice(4) }, // 9 → 7 si toca
      ...(dias[1] ? [{ diaSemana: dias[1], lugar: 'casa', nombre: 'Día IA 2', foco: '', ejercicios: EJ_IA.map(x => ({ ...x, nota: '' })), vuelta: [] }] : []),
    ],
  },
});

// ── Estado de un perfil, siempre igual ──
function preparar(p, n) {
  semilla = 1000 + n;
  red(undefined);
  const S = nuevoS(structuredClone(p.perfil));
  if (p.medidas) S.medidas = structuredClone(p.medidas);
  if (p.dolor) S.dolor = structuredClone(p.dolor);
  p.historial.forEach(([atras, ejs, extra]) => hecha(S, atras, structuredClone(ejs), structuredClone(extra || {})));
  if (p.plan) S.plan = ent.planReglas(S, { dias: ent.diasPorDefecto(S), minutos: S.perfil.disponibilidad.minutos, lugares: S.perfil.lugares });
  return S;
}
const ciDe = (p, o = {}) => ({ energia: 3, dolorHoy: {}, peticion: '', ...structuredClone(p.ci), ...o });
// Variantes del check-in: la del perfil, poca energía, energía a tope con más tiempo, poco tiempo con petición.
const variantes = p => ({
  base: ciDe(p),
  energia1: ciDe(p, { energia: 1 }),
  energia5largo: ciDe(p, { energia: 5, minutos: 90 }),
  corto: ciDe(p, { energia: 2, minutos: 25, peticion: 'tren superior' }),
});
const copia = x => JSON.parse(JSON.stringify(x === undefined ? null : x));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Para no repetir en la instantánea lo que ya está en otra salida: lo que lo identifica y una huella del resto.
const resumenDia = d => (d ? { diaSemana: d.diaSemana, estado: d.estado, nombre: d.nombre, huella: huella(d) } : null);
const previa = r => ({ dia: r.dia ? r.dia.diaSemana : null, cambios: r.cambios, ia: r.ia, minutos: r.minutos, datos: huella(r.datos) });

// ── Grupos de salidas ──
export const GRUPOS = {
  dia(p, n) {
    const S = preparar(p, n);
    const ci = ciDe(p);
    const usados = {};
    const ops = {
      fullA: { lugar: ci.lugar, minutos: ci.minutos, tipo: 'fullA' },
      torsoFuturo: { lugar: ci.lugar, minutos: ci.minutos, tipo: 'torso', k: 1, usados, futuro: true },
      piernaDolor: { lugar: ci.lugar, minutos: 30, tipo: 'pierna', k: 2, usados, dolorHoy: ci.dolorHoy, extraCardio: 5, rehabExtra: true },
      huecos: { lugar: ci.lugar, minutos: 45, tipo: 'fullC', huecos: ['pecho', 'espalda', 'core'], k: 4 },
      salud90: { lugar: ci.lugar, minutos: 90, tipo: 'salud', k: 5 },
      ...Object.fromEntries(S.perfil.lugares.map(l => ['lugar_' + l, { lugar: l, minutos: 60, tipo: l === 'piscina' ? 'piscina' : 'fullB', k: 3 }])),
    };
    const out = {};
    for (const [k, op] of Object.entries(ops)) {
      const d = ent.montarDia(S, op);
      out[k] = { dia: copia(d), tiempo: ent.tiempoSesion(d) };
    }
    out.usados = copia(usados);
    out.ajustesPorTendencia = copia(ent.ajustesPorTendencia(S));
    return out;
  },

  plan(p, n) {
    let S = preparar(p, n);
    const semana = { dias: ent.diasPorDefecto(S), minutos: S.perfil.disponibilidad.minutos, lugares: S.perfil.lugares };
    const out = {
      diasPorDefecto: ent.diasPorDefecto(S),
      planReglas: copia(ent.planReglas(S, semana)),
      planReglasUnLugarConHechas: copia(ent.planReglas(S, { dias: [4, 6], minutos: 40, lugares: [S.perfil.lugares[0]] }, { hechas: [{}, {}] })),
      // El resto de campos de estadoDias son los del día del plan (ya en planReglas): basta con comprobar que lo son.
      estadoDias: ent.estadoDias(S).map(({ estado, sesion, ...d }) => ({ diaSemana: d.diaSemana, estado, sesion, esElDelPlan: igual(d, S.plan.dias.find(x => x.diaSemana === d.diaSemana)) })),
      planDeHoy: resumenDia(ent.planDeHoy(S)),
      siguientePendiente: resumenDia(ent.siguientePendiente(S)),
      planDeLaSemana: !!ent.planDeLaSemana(S),
    };
    const reorg = [['restoDeSemana', [3, 4, 5, 6, 7], {}], ['soloSabado', [6], {}], ['hoyNoPuedo', [3, 5, 7], { quitarHoy: true }], ['nadaLibre', [1, 2], {}]];
    for (const [k, libres, o] of reorg) {
      S = preparar(p, n);
      const nota = ent.reorganizar(libres, o);
      out['reorganizar_' + k] = { nota, plan: copia(est.estado().plan) };
    }
    return out;
  },

  checkin(p, n) {
    const S = preparar(p, n);
    const dia = ent.planDeHoy(S) || (S.plan ? S.plan.dias[0] : null);
    const out = {};
    for (const [k, ci] of Object.entries(variantes(p))) {
      red(undefined);
      out[k] = {
        sinPlan: copia(ent.ajustarAlCheckin(S, null, ci)),
        conDia: dia ? copia(ent.ajustarAlCheckin(S, dia, ci)) : null,
        previa: previa(ent.previaCheckin(ci)),
        previaOtroDia: S.plan ? previa(ent.previaCheckin({ ...ci, diaPlan: S.plan.dias[S.plan.dias.length - 1].diaSemana })) : null,
        motivoIASinRed: ent.motivoIA(S, ci, dia),
      };
      red(FALLA);
      out[k].motivoIAConRed = ent.motivoIA(S, ci, dia);
      out[k].motivoIAForzada = ent.motivoIA(S, { ...ci, forzarIA: true }, dia);
      out[k].motivoIASinDia = ent.motivoIA(S, ci, null);
    }
    return out;
  },

  async ia(p, n) {
    const out = {};
    const sesion = async (k, respuesta, o = {}) => {
      preparar(p, n);
      red(respuesta);
      const r = await ent.crearSesionHoy(ciDe(p, o));
      out['sesion_' + k] = { r: copia(r), peticiones: copia(peticiones), hechos: copia((est.estado().plan || {}).hechos || null) };
    };
    await sesion('sinRed', undefined);
    await sesion('falla', FALLA, { forzarIA: true });
    await sesion('fallaAuto', FALLA);
    await sesion('completa', { sesion: SESION_IA.completa }, { forzarIA: true });
    await sesion('pobre', { sesion: SESION_IA.pobre }, { forzarIA: true, dolorHoy: { ...(p.ci.dolorHoy || {}), cervical: 2 } });
    await sesion('vacia', { sesion: SESION_IA.vacia }, { forzarIA: true });
    await sesion('otroDia', { sesion: SESION_IA.completa }, { forzarIA: true, diaPlan: 6 });

    const plan = async (k, respuesta, o = {}) => {
      const S = preparar(p, n);
      red(respuesta);
      const semana = { dias: o.dias || ent.diasPorDefecto(S), minutos: S.perfil.disponibilidad.minutos, lugares: o.lugares || [] };
      const r = await ent.crearPlanSemana(semana, { conIA: o.conIA !== false });
      const guardado = est.estado().plan;
      // Sin IA, sin red o si falla, el plan es el de reglas: con el primero entero basta; los demás se comparan con él.
      const deReglas = out.plan_sinIA && r.plan && r.plan.fuente === 'reglas';
      out['plan_' + k] = {
        r: deReglas ? { aviso: r.aviso, plan: igual(r.plan, out.plan_sinIA.r.plan) ? 'el de sinIA' : copia(r.plan) } : copia(r),
        peticiones: copia(peticiones), guardado: guardado === r.plan ? 'el devuelto' : huella(guardado),
      };
    };
    await plan('sinIA', FALLA, { conIA: false });
    await plan('sinRed', undefined);
    await plan('falla', FALLA);
    await plan('ia', PLAN_IA([3, 5]), { dias: [1, 3, 5, 7] });
    await plan('iaTodaLaSemana', PLAN_IA([4, 6]), { dias: [1, 2, 3, 4, 5, 6, 7], lugares: ['gym', 'casa'] });
    await plan('pasado', FALLA, { dias: [1, 2] });
    return out;
  },
};

export { PERFILES };
