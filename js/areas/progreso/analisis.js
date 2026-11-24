// Análisis del progreso a partir de lo que de verdad se ha apuntado (sesiones, medidas y dolor).
// Funciones puras: las usa la pestaña Progreso, la pantalla Hoy (constancia) y el entrenador IA (analisisParaEntrenador).
// Nada de puntos ni logros inventados: cada número sale de un dato guardado y se explica cómo se calcula.

import { plural } from '../../nucleo/ui.js';
import { sesionesHechas, registros, rango, valor, tendenciaDolor } from '../../reglas/progresion.js';
import { semanasCalendario, cumplimiento, objetivoSemanal, tendenciaPeso, tendenciaCintura } from '../../reglas/contexto.js';
import { ex, ZONAS } from '../../reglas/catalogo.js';

const DIA = 864e5;
const fechaDe = s => new Date(s.terminada || (s.fecha + 'T12:00'));
const mediana = v => { if (!v.length) return null; const o = v.slice().sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const r1 = v => Math.round(v * 10) / 10;

// ── Constancia ──
// Sesiones terminadas por semana (lunes a domingo) frente a los días que la persona dice tener.
// Las semanas se cuentan con el calendario (el cambio de hora no salta ninguna). La racha cuenta semanas
// seguidas cumpliendo; la semana en curso no la rompe mientras no haya acabado. El cumplimiento mira las
// 4 últimas semanas cerradas y la primera semana de uso no cuenta como incumplida (C-ANA-7).
export function constancia(S, semanasAtras = 8) {
  const hechas = sesionesHechas(S);
  const objetivo = objetivoSemanal(S);
  const semanas = semanasCalendario(S, semanasAtras);
  const actual = semanas[semanas.length - 1].n;
  let racha = actual >= objetivo ? 1 : 0;
  const atras = semanasCalendario(S, 521);
  for (let k = atras.length - 2; k >= 0 && atras[k].n >= objetivo; k--) racha++;
  const primera = hechas.length ? fechaDe(hechas[0]) : null;
  const semanasActivo = primera ? Math.max(1, Math.ceil((Date.now() - primera) / (7 * DIA))) : 0;
  const ultima = hechas[hechas.length - 1];
  const diasSin = ultima ? Math.floor((Date.now() - fechaDe(ultima)) / DIA) : null;
  return { objetivo, semanas, estaSemana: actual, faltan: Math.max(0, objetivo - actual), racha, cumplimiento: cumplimiento(S), total: hechas.length, diasSin, semanasActivo };
}

// Frase corta para la pantalla Hoy (o para el entrenador).
export function textoConstancia(c) {
  if (!c.total) return 'Tu primera sesión empieza la cuenta.';
  const sem = c.estaSemana >= c.objetivo ? `Semana cumplida: ${c.estaSemana} de ${c.objetivo}` : `${plural(c.estaSemana, 'sesión', 'sesiones', c.objetivo)} esta semana`;
  const racha = c.racha > 1 ? ` · ${c.racha} semanas seguidas cumpliendo` : '';
  return sem + racha;
}

// ── Fuerza ──
// 1RM estimado (Epley) de cada serie con kg; fiable hasta unas 12 repeticiones.
const e1rm = (kg, reps) => kg * (1 + Math.min(reps, 12) / 30);
function mejorDia(reg, u) {
  const v = reg.sets.filter(z => z.kg).map(z => e1rm(z.kg, valor(z.txt, u) || 1));
  return v.length ? Math.max(...v) : null;
}
export function fuerza(S, semanas = 12) {
  const desde = Date.now() - semanas * 7 * DIA;
  const ids = [...new Set(sesionesHechas(S).flatMap(s => (s.ejercicios || []).map(x => x.id)))].filter(id => ex(id) && ex(id).t === 'reps');
  const filas = ids.map(id => {
    const u = '';
    const regs = registros(S, id).filter(r => r.sets.some(z => z.kg));
    if (!regs.length) return null;
    const asist = /asistid/.test(id);
    const serie = regs.map(r => ({ fecha: r.fecha, v: mejorDia(r, u), kg: Math.max(...r.sets.filter(z => z.kg).map(z => z.kg)), sets: r.sets }));
    const ventana = serie.filter(p => new Date(p.fecha) >= desde);
    const base = ventana.length >= 2 ? ventana : serie;
    const a = base[0].v, b = base[base.length - 1].v;
    let cambio = a && base.length >= 2 ? (b - a) / a * 100 : null;
    if (asist && cambio != null) cambio = -cambio; // en las asistidas, menos ayuda es más fuerza
    const max = asist ? Math.min(...serie.map(p => p.v)) : Math.max(...serie.map(p => p.v));
    const record = serie.length >= 2 && (asist ? serie[serie.length - 1].v <= max : serie[serie.length - 1].v >= max) && serie.slice(0, -1).every(p => asist ? p.v > serie[serie.length - 1].v : p.v < serie[serie.length - 1].v);
    return { id, n: ex(id).n, veces: regs.length, serie, ultimoKg: serie[serie.length - 1].kg, e1rm: r1(b), cambio: cambio == null ? null : r1(cambio), record };
  }).filter(Boolean).sort((x, y) => y.veces - x.veces);
  const conCambio = filas.filter(f => f.cambio != null && f.veces >= 2);
  const med = mediana(conCambio.map(f => f.cambio));
  return { filas, mediana: med == null ? null : r1(med), comparados: conCambio.length, records: filas.filter(f => f.record).length, semanas };
}

// ── Salud ──
// Índice cintura/altura (< 0,5 saludable; 0,5-0,6 riesgo aumentado; ≥ 0,6 riesgo alto), % de grasa (apuntado o
// estimado con la fórmula de la Marina de EE. UU. si hay cuello, cintura, cadera y altura), tendencia del peso,
// minutos de cardio frente a los 150 semanales que recomienda la OMS, y evolución del dolor.
export function grasaMarina(sexo, altura, cuello, cintura, cadera) {
  if (!altura || !cuello || !cintura) return null;
  const L = Math.log10;
  if (sexo === 'm' || sexo === 'mujer') { if (!cadera || cintura + cadera - cuello <= 0) return null; return r1(495 / (1.29579 - 0.35004 * L(cintura + cadera - cuello) + 0.221 * L(altura)) - 450); }
  if (cintura - cuello <= 0) return null;
  return r1(495 / (1.0324 - 0.19077 * L(cintura - cuello) + 0.15456 * L(altura)) - 450);
}
function serieMedida(S, k) { return S.medidas.filter(m => m[k] != null).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(m => ({ fecha: m.fecha, v: +m[k] })); }
// Tendencias con un mínimo de datos (C-ANA-3 para el peso, C-ANA-4 para la cintura); si no, null.
function tendenciaDe(S, k) {
  if (k === 'peso') {
    const t = tendenciaPeso(S.medidas);
    return t.suficiente ? { desde: t.desde, delta: t.cambio, porSemana: r1(t.cambio / (t.dias / 7) * 100) / 100, pctSemana: t.pctSemana } : null;
  }
  const t = tendenciaCintura(S.medidas);
  return t.suficiente ? { desde: t.desde, delta: t.cambio, relevante: t.relevante } : null;
}

function minutosCardio(s) {
  let min = 0;
  (s.ejercicios || []).forEach(x => {
    const e = ex(x.id); if (!e) return;
    const esCardio = x.rol === 'cardio' || e.m.includes('cardio') || e.t === 'distancia';
    if (!esCardio) return;
    const r = rango(x.reps), u = r ? r.u : '';
    x.sets.filter(z => z.hecha).forEach(z => {
      const v = valor(z.valor, u) != null ? valor(z.valor, u) : r ? r.lo : 0;
      if (u === 'min') min += v; else if (u === 's') min += v / 60;
      else if (e.t === 'distancia' || u === 'm') min += v / 100 * 2.5; // nadando, unos 2,5 min cada 100 m
    });
  });
  return min;
}

export function salud(S) {
  const p = S.perfil, d = p.datos || {};
  const altura = +d.altura || null;
  const ult = k => { const s = serieMedida(S, k); return s.length ? s[s.length - 1] : null; };
  const cin = ult('cintura'), peso = ult('peso');
  const ich = altura && cin ? Math.round(cin.v / altura * 100) / 100 : null;
  const ichNivel = ich == null ? null : ich < 0.5 ? 'bien' : ich < 0.6 ? 'aviso' : 'peligro';
  const apuntada = ult('grasa');
  const m = S.medidas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).find(x => x.cuello && x.cintura && (!(d.sexo === 'm' || d.sexo === 'mujer') || x.cadera));
  const estimada = m ? grasaMarina(d.sexo, altura, +m.cuello, +m.cintura, +m.cadera) : null;
  const imc = altura && peso ? r1(peso.v / (altura / 100) ** 2) : null;
  // Cardio de los últimos 7 días.
  const hace7 = Date.now() - 7 * DIA;
  const cardio = Math.round(sesionesHechas(S).filter(s => fechaDe(s) >= hace7).reduce((a, s) => a + minutosCardio(s), 0));
  return {
    altura, ich, ichNivel, imc,
    peso: peso && { ...peso, tendencia: tendenciaDe(S, 'peso') },
    cintura: cin && { ...cin, tendencia: tendenciaDe(S, 'cintura') },
    grasa: apuntada ? { v: apuntada.v, fecha: apuntada.fecha, fuente: 'apuntada' } : estimada ? { v: estimada, fecha: m.fecha, fuente: 'estimada' } : null,
    cardio, cardioObjetivo: 150,
    series: { peso: serieMedida(S, 'peso'), cintura: serieMedida(S, 'cintura') },
  };
}

// Lectura del peso según los objetivos de la persona (ritmos razonables: perder 0,25-1 % por semana;
// ganar músculo, como mucho +0,5 % por semana para que no sea casi todo grasa).
export function lecturaPeso(S, t) {
  if (!t || t.pctSemana == null) return '';
  const obj = S.perfil.objetivos || [], x = t.pctSemana;
  if (obj.includes('perder')) {
    if (x <= -1.2) return 'Bajas muy rápido: más de un 1 % por semana suele llevarse músculo. Come algo más.';
    if (x <= -0.25) return 'Buen ritmo para perder grasa sin perder músculo.';
    if (x < 0.25) return 'Peso estable. Si la cintura baja, vas bien; si no, toca ajustar la comida.';
    return 'El peso sube y tu objetivo es perder grasa: revisa la comida de estas semanas.';
  }
  if (obj.includes('musculo')) {
    if (x > 0.6) return 'Subes rápido: por encima de 0,5 % por semana se gana más grasa que músculo.';
    if (x >= 0.1) return 'Buen ritmo para ganar músculo.';
    if (x > -0.25) return 'Peso estable. Para ganar músculo suele hacer falta comer un poco más.';
    return 'Estás bajando de peso y tu objetivo es ganar músculo: come más.';
  }
  return Math.abs(x) < 0.3 ? 'Peso estable.' : x < 0 ? 'Tu peso baja.' : 'Tu peso sube.';
}

// ── Dolor ──
// Por zona: los últimos registros, la tendencia (C-ANA-5: ≥ 3 registros en los últimos 14 días y ≥ 3 en los
// 14 anteriores) y qué ejercicios coinciden con las sesiones en las que el dolor subió 2 puntos o más de antes
// a después (solo con ≥ 3 sesiones con ese ejercicio).
export function dolor(S) {
  const zonas = [...new Set(S.dolor.map(d => d.zona))].filter(z => ZONAS[z]);
  const hechas = sesionesHechas(S);
  return zonas.map(z => {
    // Se enseña el dolor después de entrenar y el del día a día; el de «antes» sirve para comparar con la sesión.
    const v = S.dolor.filter(d => d.zona === z && d.momento !== 'antes');
    const t = tendenciaDolor(S.dolor.filter(d => d.zona === z));
    const subidas = hechas.filter(s => s.cierre && s.cierre.dolor && s.cierre.dolor[z] != null && s.checkin && s.checkin.dolor && +s.cierre.dolor[z] >= +(s.checkin.dolor[z] || 0) + 2);
    const bien = hechas.filter(s => s.cierre && s.cierre.dolor && s.cierre.dolor[z] != null && !subidas.includes(s));
    const cuenta = {};
    subidas.forEach(s => (s.ejercicios || []).filter(x => x.sets.some(y => y.hecha)).forEach(x => { cuenta[x.id] = (cuenta[x.id] || 0) + 1; }));
    const sospechosos = Object.entries(cuenta).map(([id, n]) => {
      const total = [...subidas, ...bien].filter(s => (s.ejercicios || []).some(x => x.id === id && x.sets.some(y => y.hecha))).length;
      return { id, n, total };
    }).filter(x => x.total >= 3 && x.n >= 2 && x.n / x.total >= 0.6).sort((a, b) => b.n - a.n).slice(0, 3);
    return { zona: z, nombre: ZONAS[z].corta, registros: v.slice(-10), ultimo: v.length ? +v[v.length - 1].dolor : null, media: t.media14, antes: t.mediaAntes,
      tendencia: t.tendencia === 'sin datos' ? null : t.tendencia, subidas: subidas.length, sospechosos };
  });
}

// ── Para el entrenador IA ──
// Resumen compacto para meter en el contexto de la IA.
export function analisisParaEntrenador(S) {
  const c = constancia(S), f = fuerza(S), sa = salud(S), d = dolor(S);
  return {
    constancia: { objetivoSemanal: c.objetivo, estaSemana: c.estaSemana, racha: c.racha, cumplimiento4sem: c.cumplimiento, diasSinEntrenar: c.diasSin, sesionesTotales: c.total },
    fuerza: { cambioMediano12sem: f.mediana, ejercicios: f.filas.slice(0, 12).map(x => ({ id: x.id, veces: x.veces, ultimoKg: x.ultimoKg, e1rm: x.e1rm, cambio: x.cambio })) },
    salud: { cinturaAltura: sa.ich, grasa: sa.grasa && sa.grasa.v, peso: sa.peso && sa.peso.v, pesoPctSemana: sa.peso && sa.peso.tendencia && sa.peso.tendencia.pctSemana, cardioMin7d: sa.cardio },
    dolor: d.map(z => ({ zona: z.zona, ultimo: z.ultimo, tendencia: z.tendencia, sesionesConSubida: z.subidas, coincideCon: z.sospechosos.map(s => s.id) })),
  };
}

// ── Para los gráficos de Progreso (PR 16) ──
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const etiquetaDia = d => `${d.getDate()} ${MESES[d.getMonth()]}`;
const lunesDe = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

// Constancia de las últimas `n` semanas con el mismo denominador que Hoy: la semana en curso, frente a los
// días de su plan si lo hay; las demás, frente a los días por semana del perfil (el plan de semanas pasadas no
// se guarda). [{ sem, n, meta, actual, etiqueta: «16 nov» (su lunes) }]
// Con plan, la semana en curso cuenta como Hoy: días del plan hechos de los días del plan.
export function constanciaSemanas(S, n = 8, { planificados = 0, hechosPlan = 0 } = {}, ahora = new Date()) {
  const obj = objetivoSemanal(S);
  const lunes = lunesDe(ahora);
  return semanasCalendario(S, n, ahora).map((s, i) => {
    const d = new Date(lunes); d.setDate(d.getDate() - 7 * (n - 1 - i));
    const conPlan = s.actual && planificados > 0;
    return { ...s, n: conPlan ? hechosPlan : s.n, meta: conPlan ? planificados : obj, etiqueta: etiquetaDia(d) };
  });
}
// Semanas seguidas cumplidas (sin contar la de ahora si aún no se ha cumplido), con el mismo denominador.
export function rachaSemanas(semanas) {
  let r = 0;
  for (let i = semanas.length - 1; i >= 0; i--) {
    const s = semanas[i];
    if (s.n >= s.meta) r++;
    else if (!s.actual) break;
  }
  return r;
}

// Sesiones hechas por mes, los últimos `n` meses (el último, el de ahora). [{ mes: '2026-11', etiqueta: 'nov', n }]
export function sesionesPorMes(S, n = 12, ahora = new Date()) {
  const cuenta = {};
  sesionesHechas(S).forEach(s => { const d = fechaDe(s); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; cuenta[k] = (cuenta[k] || 0) + 1; });
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - k, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ mes, etiqueta: MESES[d.getMonth()], n: cuenta[mes] || 0 });
  }
  return out;
}

// Puntos para una línea: los `max` últimos, con su etiqueta de fecha (para la burbuja y la tabla).
export function puntosFecha(serie, max = 12) {
  return serie.slice(-max).map(p => ({ v: r1(p.v), etiqueta: etiquetaDia(new Date(String(p.fecha).slice(0, 10) + 'T12:00')) }));
}

// Dolor de una zona por mes (media de lo apuntado después de entrenar y en el día a día), solo los meses con
// datos, los `max` últimos. [{ etiqueta: 'nov', v }]
export function dolorPorMes(S, zona, max = 6) {
  const por = {};
  (S.dolor || []).filter(d => d.zona === zona && d.momento !== 'antes').forEach(d => {
    const k = String(d.fecha).slice(0, 7);
    (por[k] = por[k] || []).push(+d.dolor);
  });
  return Object.keys(por).sort().slice(-max).map(k => ({ etiqueta: MESES[+k.slice(5, 7) - 1], v: r1(por[k].reduce((a, b) => a + b, 0) / por[k].length) }));
}
