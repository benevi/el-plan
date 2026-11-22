// Sobrecarga progresiva, recuperación, descarga y vuelta tras un parón (docs/criterio.md, secciones 8 y 10).
// Son las barandillas del entrenador:
// - lo que propone la IA se compara con esto (kilos y series razonables, C-PROG-5),
// - y sin conexión o sin IA, las reglas del entrenador usan esto directamente.
//
// Cada regla cita su identificador del criterio (C-PROG-*, C-REC-*, C-PARON-1, C-DESCARGA-1, C-DOLOR-7).
// Todo es puro: depende del estado S y del reloj (Date.now()).

import { ex } from './catalogo.js';
import { MUSCULOS } from '../datos/constantes.js';
import { num, es } from '../nucleo/ui.js';
import { semanaISO } from '../nucleo/modelo.js';

const DIA = 864e5;

// «8-12», «12 c/pierna», «30-45s», «10-20 min», «25 m» → { lo, hi, u, resto }
// Tope de series por ejercicio en el plan y en las reglas (C-DOSIS-2, decisión D-B de Víctor del 21-11-2026):
// 3 para el principiante y 4 para intermedio y avanzado. Lo usan la progresión, la energía 5, el relleno de
// volumen del plan y «Mis sesiones».
export const topeSeries = nivel => ((+nivel || 1) <= 1 ? 3 : 4);

export function rango(txt) {
  const m = String(txt || '').match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?\s*(min|s|m)?\b\s*(.*)$/i);
  if (!m) return null;
  const lo = num(m[1]), hi = m[2] ? num(m[2]) : lo;
  return { lo, hi, u: (m[3] || '').toLowerCase(), resto: m[4] ? ' ' + m[4].trim() : '' };
}
export function textoRango(r) {
  return (r.lo === r.hi ? es(r.lo) : `${es(r.lo)}-${es(r.hi)}`) + (r.u === 's' ? '' : r.u ? ' ' : '') + r.u + r.resto;
}
// Lo apuntado: «12», «40s», «1:30», «2 min» → número en la unidad del rango.
export function valor(txt, u) {
  const s = String(txt == null ? '' : txt).trim();
  if (!s) return null;
  const mmss = s.match(/^(\d+):(\d{1,2})$/);
  if (mmss) { const seg = +mmss[1] * 60 + +mmss[2]; return u === 'min' ? seg / 60 : seg; }
  const v = num(s); if (v == null || !Number.isFinite(v) || v < 0) return null;
  if (u === 's' && /min/i.test(s)) return v * 60;
  if (u === 'min' && /\d\s*s\b/i.test(s)) return v / 60;
  return v;
}

export const esAsistida = e => /asistid/.test(e.id) && e.mat.includes('maquina');

// C-PROG-3 · Paso mínimo de carga del material, sobre el peso real apuntado (sin redondear a múltiplos).
export function paso(e, kg) {
  kg = +kg || 0;
  if (e.mat.includes('mancuernas')) return kg < 10 ? 1 : 2;
  if (e.mat.includes('barra')) return kg > 80 ? 5 : 2.5;
  if (e.mat.includes('maquina') || e.mat.includes('polea')) return 2.5; // la placa más pequeña (por defecto 2,5)
  if (e.mat.includes('botellas') || e.mat.includes('mochila')) return 0.5;
  return kg >= 20 ? 2.5 : 1; // lastre con peso corporal
}
const r2 = v => Math.round(v * 100) / 100;
const abajo = (kg, p) => r2(Math.floor(r2(kg / p)) * p);
const arriba = (kg, p) => r2(Math.ceil(r2(kg / p)) * p);
// C-PROG-6 · Bajar: el mayor de 1 paso o un 10 % (o el % pedido), redondeado hacia abajo al paso.
// Nunca llega a 0: si no se puede bajar más, null.
function bajar(e, kg, p, pct = 0.1) {
  if (esAsistida(e)) return arriba(kg + Math.max(p, kg * pct), p); // en las asistidas, más ayuda es más fácil
  const v = abajo(kg - Math.max(p, kg * pct), p);
  return v > 0 ? v : null;
}

// C-PARON-1 · Bajada por parón: el % de la tabla redondeado al paso más cercano; desde −20 %, al menos un paso.
function bajarParon(e, kg, p, pct) {
  if (esAsistida(e)) return Math.max(r2(kg + p), r2(Math.round(kg * (1 + pct) / p) * p));
  let v = r2(Math.round(kg * (1 - pct) / p) * p);
  if (pct >= 0.2 && v >= kg) v = r2(kg - p);
  return v > 0 ? Math.min(v, kg) : null;
}

export const sesionesHechas = S => Object.values(S.sesiones || {}).filter(s => s.estado === 'hecha')
  .sort((a, b) => new Date(a.terminada || a.fecha) - new Date(b.terminada || b.fecha));
const fechaSesion = s => new Date(s.terminada || (s.fecha + 'T12:00'));

// «Dolor durante» un ejercicio (C-DOLOR-6). Lo apuntará la sesión (PR 8); hasta entonces no hay ninguno.
export const dolorDurante = x => !!(x && x.dolorDurante);

// Todas las veces que hizo un ejercicio, de la más antigua a la más reciente. `descarga` marca las sesiones de
// una semana de descarga (C-DESCARGA-1), que no cuentan para «estancado».
export function registros(S, id) {
  const desc = semanasDescarga(S).semanas;
  return registrosCrudos(S, id).map(r => ({ ...r, descarga: desc.has(semanaISO(new Date(r.fecha))) }));
}
function registrosCrudos(S, id) {
  return sesionesHechas(S).map(s => {
    const x = (s.ejercicios || []).find(x => x.id === id);
    if (!x) return null;
    const sets = (x.sets || []).filter(z => z.hecha && (String(z.valor || '').trim() || +z.kg > 0))
      .map(z => ({ kg: +z.kg > 0 && Number.isFinite(+z.kg) ? +z.kg : null, txt: String(z.valor || '').trim() }));
    if (!sets.length) return null;
    return { fecha: s.terminada || s.fecha, sets, esfuerzo: s.cierre && +s.cierre.esfuerzo || null, energia: s.checkin && +s.checkin.energia || null,
      antes: (s.checkin && s.checkin.dolor) || {}, despues: (s.cierre && s.cierre.dolor) || {}, gusto: x.gusto || null,
      comentario: x.comentario || '', durante: dolorDurante(x), descarga: false };
  }).filter(Boolean);
}

export function resumen(reg) {
  if (!reg) return '';
  const conKg = reg.sets.some(s => s.kg);
  return reg.sets.map(s => conKg ? `${s.kg ? es(s.kg) : '—'} kg × ${s.txt || '?'}` : (s.txt || '?')).join(' · ');
}
// Zonas con riesgo en el ejercicio cuyo dolor subió ≥ 2 de antes a después de la sesión.
export const dolorSubio = (reg, e) => Object.keys(e.r || {}).filter(z => reg.despues[z] != null && +reg.despues[z] >= +(reg.antes[z] || 0) + 2);
// C-DOLOR-7 · Subidas de dolor de cada sesión: de antes a después, o hasta el check-in de la siguiente sesión
// con ese ejercicio (≥ 2 puntos por encima del de antes). Devuelve, por sesión, las zonas que subieron.
export function subidasDolor(regs, e) {
  return regs.map((r, i) => {
    const z = new Set(dolorSubio(r, e)), sig = regs[i + 1];
    if (sig) Object.keys(e.r || {}).forEach(k => { if (sig.antes[k] != null && r.antes[k] != null && +sig.antes[k] >= +r.antes[k] + 2) z.add(k); });
    return [...z];
  });
}

// ── Fuerza de una sesión: kilos de trabajo, repeticiones a ese peso y 1RM estimado (Epley) ──
export const e1rm = (kg, reps) => kg * (1 + Math.min(reps, 12) / 30);
export function medidaSesion(reg, e) {
  const u = (rango((e && e.d && e.d[1]) || '') || {}).u || '';
  const conKg = reg.sets.filter(z => z.kg);
  if (conKg.length) {
    const asist = !!e && esAsistida(e);
    const kg = asist ? Math.min(...conKg.map(z => z.kg)) : Math.max(...conKg.map(z => z.kg));
    const reps = conKg.filter(z => z.kg === kg).reduce((t, z) => t + (valor(z.txt, u) || 0), 0);
    const rm = asist ? null : Math.max(...conKg.map(z => e1rm(z.kg, valor(z.txt, u) || 1)));
    return { kg, reps, rm, asist };
  }
  return { kg: null, reps: reg.sets.reduce((t, z) => t + (valor(z.txt, u) || 0), 0), rm: null, asist: false };
}

// C-PROG-8 · Estancado: en las 4 últimas sesiones que cuentan (sin descarga ni energía ≤ 2), en al menos
// 14 días, ninguna de las 3 últimas mejora a la primera en peso máximo, ni en repeticiones totales al peso
// de trabajo ni en 1RM estimado en más de un 2 %.
export const cuentaParaEstancado = r => !r.descarga && !(r.energia && r.energia <= 2);
// Sesiones desde la vuelta del último parón, sin las de reentrada (C-PARON-1): antes del parón no son referencia.
export function trasParon(regs) {
  for (let i = regs.length - 1; i >= 1; i--) {
    const t = tramoParon(Math.floor((new Date(regs[i].fecha) - new Date(regs[i - 1].fecha)) / DIA));
    if (!t) continue;
    const vuelta = new Date(regs[i].fecha).getTime();
    return regs.slice(i).filter((r, j) => (t.reentrada.sesiones ? j >= t.reentrada.sesiones : new Date(r.fecha) - vuelta >= t.reentrada.semanas * 7 * DIA));
  }
  return regs;
}
export function estaEstancado(regs, e) {
  const v = trasParon(regs).filter(cuentaParaEstancado).slice(-4);
  if (v.length < 4) return false;
  if (new Date(v[3].fecha) - new Date(v[0].fecha) < 14 * DIA - 3600e3) return false;
  const [ref, ...resto] = v.map(r => medidaSesion(r, e));
  const mejora = m => {
    if (ref.kg != null && m.kg != null) {
      if (ref.asist ? m.kg < ref.kg : m.kg > ref.kg) return true;
      if (m.kg === ref.kg && m.reps > ref.reps * 1.02) return true;
      return !!(ref.rm && m.rm && m.rm > ref.rm * 1.02);
    }
    return m.reps > ref.reps * 1.02;
  };
  return !resto.some(mejora);
}
// Bajando: la última sesión con menos kilos (o más ayuda) que la anterior.
export function estaBajando(regs, e) {
  const v = regs.filter(cuentaParaEstancado).slice(-2);
  if (v.length < 2) return false;
  const [a, b] = v.map(r => medidaSesion(r, e));
  if (a.kg == null || b.kg == null) return false;
  return a.asist ? b.kg > a.kg : b.kg < a.kg;
}

// ── C-ANA-5 · Tendencia del dolor de una zona ──
// ≥ 3 registros en los últimos 14 días y ≥ 3 en los 14 anteriores. «Sube»: media +1 y el último ≥ la media
// reciente. «Baja»: media −1. Si no, «igual»; con menos datos, «sin datos».
export function tendenciaDolor(registrosZona, ahora = Date.now()) {
  const t = d => new Date(String(d.fecha).length === 10 ? d.fecha + 'T12:00' : d.fecha).getTime();
  const l = registrosZona.filter(d => Number.isFinite(+d.dolor) && Number.isFinite(t(d))).slice().sort((a, b) => t(a) - t(b));
  const rec = l.filter(d => t(d) <= ahora && ahora - t(d) <= 14 * DIA), prev = l.filter(d => ahora - t(d) > 14 * DIA && ahora - t(d) <= 28 * DIA);
  const m = a => a.length ? Math.round(a.reduce((x, d) => x + +d.dolor, 0) / a.length * 10) / 10 : null;
  const mr = m(rec), mp = m(prev);
  let tendencia = 'sin datos';
  if (rec.length >= 3 && prev.length >= 3) {
    const ult = +rec[rec.length - 1].dolor;
    const dif = Math.round((mr - mp) * 10); // en décimas, sin errores de coma flotante
    tendencia = dif >= 10 && ult >= mr ? 'sube' : dif <= -10 ? 'baja' : 'igual';
  }
  return { media14: mr, mediaAntes: mp, n14: rec.length, nAntes: prev.length, tendencia };
}
export const tendenciaDolorZona = (S, z, ahora = Date.now()) => tendenciaDolor((S.dolor || []).filter(d => d.zona === z), ahora);

// ── C-LES-1 · Lesión nueva: menos de 6 semanas, sin «desde» (C-LES-6: «no lo sé» cuenta como nueva) o
// puntual (C-LES-4). La recurrente se trata como crónica. Un dolor de hoy en una zona sin lesión también es
// nuevo (C-LES-3).
export function lesionNueva(S, z, dolorHoy = {}) {
  const l = (S.perfil.lesiones || []).filter(x => x.activa && x.zona === z);
  if (!l.length) return +dolorHoy[z] >= 1;
  return l.some(x => {
    if (x.tipo === 'recurrente') return false;
    if (x.tipo === 'puntual') return true;
    const f = fechaLesion(S, x);
    return !f || Date.now() - f.getTime() < 42 * DIA;
  });
}
// Fecha de inicio de una lesión: su «desde» o, si no lo tiene, una provisional (C-LES-6) hasta que el check-in
// la pregunte: la fecha de alta que lleva su id (uid de la app) o, si viene de la app anterior, la del primer
// dato migrado. Sin ninguna, null (cuenta como nueva).
export function fechaLesion(S, l) {
  if (l.desde) return new Date(l.desde + 'T12:00');
  const t = parseInt(String(l.id || '').slice(0, -5), 36);
  if (/^[0-9a-z]{13,}$/.test(String(l.id || '')) && t > Date.UTC(2020, 0, 1) && t <= Date.now()) return new Date(t);
  if (l.vid) {
    const f = [...Object.values(S.sesiones || {}).filter(s => s.fuente === 'anterior').map(s => s.fecha), ...(S.dolor || []).filter(d => d.vid).map(d => d.fecha), ...(S.medidas || []).filter(m => m.vid).map(m => m.fecha)]
      .filter(Boolean).sort()[0];
    if (f) return new Date(String(f).slice(0, 10) + 'T12:00');
  }
  return null;
}
// Lesiones activas sin «desde»: el check-in (PR 8) debe preguntar «¿Desde cuándo te duele…?» (C-LES-6).
export const lesionesSinFecha = S => (S.perfil.lesiones || []).filter(l => l.activa && !l.desde);

// ── C-REC-1 y C-REC-2 · Recuperación por músculo ──
export const RECUPERA = { pecho: 48, espalda: 48, cuadriceps: 48, gluteo: 48, isquios: 48, hombro: 48, biceps: 36, triceps: 36, gemelo: 36, core: 24 };
export function cargaMuscular(S) {
  const ahora = Date.now(), c = {};
  const hechas = sesionesHechas(S);
  const primera = hechas.length ? fechaSesion(hechas[0]).getTime() : 0;
  const principiante = (+S.perfil.nivel || 1) === 1;
  hechas.forEach(s => {
    const t = fechaSesion(s).getTime();
    const horas = (ahora - t) / 3600e3;
    if (horas < 0 || horas > 96) return;
    // ×1,25 si se cerró con esfuerzo ≥ 4/5 o en las 4 primeras semanas de un principiante.
    const f = (s.cierre && +s.cierre.esfuerzo >= 4) || (principiante && t - primera < 28 * DIA) ? 1.25 : 1;
    (s.ejercicios || []).forEach(x => {
      const e = ex(x.id); if (!e || x.rol === 'rehab') return;
      const n = (x.sets || []).filter(z => z.hecha).length; if (!n) return;
      const suma = (m, peso) => {
        const rec = RECUPERA[m] && RECUPERA[m] * f; if (!rec || horas >= rec) return;
        const k = c[m] || (c[m] = { horas, series: 0, rec });
        k.horas = Math.min(k.horas, horas); k.rec = Math.max(k.rec, rec); k.series += n * peso;
      };
      e.m.forEach(m => suma(m, 1)); (e.s || []).forEach(m => suma(m, 0.5));
    });
  });
  Object.values(c).forEach(k => {
    k.series = Math.round(k.series * 10) / 10;
    // Cargado: < 67 % de sus horas y ≥ 4 series. Parcial: menos de sus horas (entrena normal y puede subir).
    k.estado = k.horas < k.rec * 0.67 && k.series >= 4 ? 'cargado' : k.horas < k.rec ? 'parcial' : 'fresco';
    k.horas = Math.round(k.horas); k.rec = Math.round(k.rec);
    k.faltan = Math.max(0, k.rec - k.horas);
  });
  return c;
}
export const hace = hrs => hrs < 24 ? `hace ${hrs} h` : hrs < 48 ? 'ayer' : `hace ${Math.round(hrs / 24)} días`;

// ── C-DESCARGA-1 · Semanas de descarga ──
// Se recorren las semanas desde la primera sesión: una semana sin entrenar cuenta como descarga; tras
// 5 semanas constantes (8 en principiante; ≥ 75 % de las sesiones previstas) la siguiente es de descarga.
const lunesDe = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const masDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const cacheDescarga = new WeakMap();
// Semanas de descarga desde la primera sesión hasta la actual: por calendario o adelantadas por señales.
// Devuelve { semanas: Set, motivos: Map(semana → { texto, senales }), seguidas, umbral }.
export function semanasDescarga(S, ahora = new Date()) {
  const hechas = sesionesHechas(S);
  const umbral = (+S.perfil.nivel || 1) === 1 ? 8 : 5;
  const motivos = new Map();
  if (!hechas.length) return { semanas: new Set(), motivos, seguidas: 0, umbral };
  const objetivo = Math.max(1, +(S.perfil.disponibilidad && S.perfil.disponibilidad.dias) || 3);
  const actual = semanaISO(ahora), fin = lunesDe(ahora).getTime();
  const u = hechas[hechas.length - 1];
  const clave = [hechas.length, hechas[0].id, u.id, u.terminada, actual, umbral, objetivo, (S.dolor || []).length].join('|');
  const guardado = S.sesiones && cacheDescarga.get(S.sesiones);
  if (guardado && guardado.clave === clave) return guardado.r;
  const porSemana = {};
  hechas.forEach(s => { const k = semanaISO(fechaSesion(s)); porSemana[k] = (porSemana[k] || 0) + 1; });
  const crudos = {}, regsDe = id => crudos[id] || (crudos[id] = registrosCrudos(S, id));
  let seguidas = 0, lunes = lunesDe(fechaSesion(hechas[0]));
  for (let i = 0; i < 600 && lunes.getTime() <= fin; i++, lunes = masDias(lunes, 7)) {
    const sem = semanaISO(lunes), L = lunes.getTime();
    let m = null;
    if (seguidas >= umbral) m = { texto: `Llevas ${umbral} semanas seguidas entrenando con constancia: esta semana toca descarga.`, senales: [] };
    else if (!motivos.has(semanaISO(masDias(lunes, -7))) && !motivos.has(semanaISO(masDias(lunes, -14)))) {
      const senales = senalesDescarga(S, L, regsDe, motivos);
      if (senales.length >= 2) m = { texto: `Esta semana toca descarga: ${senales.join(' y ')}.`, senales };
    }
    if (m) { motivos.set(sem, m); seguidas = 0; if (sem === actual) break; continue; }
    if (sem === actual) break;
    const n = porSemana[sem] || 0;
    if (!n) seguidas = 0; // una semana sin entrenar cuenta como descarga
    else if (n >= objetivo * 0.75) seguidas++;
  }
  const r = { semanas: new Set(motivos.keys()), motivos, seguidas, umbral };
  if (S.sesiones) cacheDescarga.set(S.sesiones, { clave, r });
  return r;
}
// Las 4 señales que adelantan la descarga, con lo apuntado en las 2 semanas anteriores al lunes L.
function senalesDescarga(S, L, regsDe, motivos) {
  const desde = L - 14 * DIA;
  const antes = sesionesHechas(S).filter(s => fechaSesion(s).getTime() < L);
  const ult = antes.filter(s => fechaSesion(s).getTime() >= desde);
  if (!ult.length) return [];
  const senales = [];
  const esf = ult.map(s => s.cierre && +s.cierre.esfuerzo).filter(Boolean);
  if (esf.length >= 2 && esf.reduce((a, b) => a + b, 0) / esf.length >= 4.3) senales.push('esfuerzo medio muy alto');
  const ids = [...new Set(ult.flatMap(s => (s.ejercicios || []).filter(x => x.rol !== 'rehab' && x.rol !== 'cardio').map(x => x.id)))].filter(id => ex(id));
  const malos = ids.filter(id => {
    const r = regsDe(id).filter(x => new Date(x.fecha).getTime() < L).map(x => ({ ...x, descarga: motivos.has(semanaISO(new Date(x.fecha))) }));
    return estaEstancado(r, ex(id)) || estaBajando(r, ex(id));
  });
  if (malos.length >= 3) senales.push(`${malos.length} ejercicios estancados o bajando`);
  const ener = antes.filter(s => s.checkin && s.checkin.energia).slice(-5);
  if (ener.filter(s => +s.checkin.energia <= 2).length >= 3) senales.push('poca energía en 3 de los últimos 5 check-ins');
  const zonas = [...new Set((S.dolor || []).map(d => d.zona))];
  if (zonas.some(z => tendenciaDolorZona(S, z, L).tendencia === 'sube')) senales.push('un dolor que va a más');
  return senales;
}
// ¿Esta semana es de descarga? La decisión solo mira semanas cerradas: no cambia a mitad de semana.
// Si las señales la adelantan, la semana queda marcada y sus sesiones no cuentan para «estancado».
export function semanaDescarga(S, ahora = new Date()) {
  const m = semanasDescarga(S, ahora).motivos.get(semanaISO(ahora));
  return m ? { toca: true, motivo: m.texto, senales: m.senales } : { toca: false, motivo: '', senales: [] };
}
// Series en descarga: −50 % redondeando hacia abajo; mínimo 2 en compuestos y 1 en accesorios.
const RE_AISLADO = /aperturas|cruces|elevacion|curl|extension|patada|abduc|face-pull|pajaros|crunch|talones|plancha/;
// Compuesto: `tipo` del catálogo (PR 9); el peso corporal multiarticular (flexiones, remo australiano) cuenta igual.
const multiarticular = e => (e.s || []).length > 0 && !RE_AISLADO.test(e.id);
export const esCompuestoDe = e => !!e && (e.tipo === 'compuesto' || ((!e.tipo || e.tipo === 'corporal') && multiarticular(e)));
export const seriesDescarga = (e, series) => Math.min(series, Math.max(esCompuestoDe(e) ? 2 : 1, Math.floor(series / 2)));

// ── C-PARON-1 · Vuelta tras un parón: tramo según los días sin hacer el ejercicio ──
export function tramoParon(dias) {
  if (!(dias >= 14)) return null;
  const sem = `${Math.round(dias / 7)} semanas`;
  if (dias > 84) return { dias, pct: null, series: s => Math.max(1, Math.round(s * 0.6)), reentrada: { semanas: 4 }, txt: 'más de 12 semanas' };
  if (dias >= 43) return { dias, pct: 0.35, series: s => Math.max(1, Math.round(s * 0.6)), reentrada: { semanas: 2 }, txt: sem };
  if (dias >= 22) return { dias, pct: 0.2, series: s => Math.max(1, s - 1), reentrada: { sesiones: 2 }, txt: sem };
  return { dias, pct: 0.1, series: s => Math.max(1, s - 1), reentrada: { sesiones: 1 }, txt: `${dias} días` };
}
// ¿Está en reentrada? Mira el último hueco ≥ 14 días entre registros y lo que lleva desde la vuelta.
export function enReentrada(regs) {
  for (let i = regs.length - 1; i >= 1; i--) {
    const t = tramoParon(Math.floor((new Date(regs[i].fecha) - new Date(regs[i - 1].fecha)) / DIA));
    if (!t) continue;
    if (t.reentrada.sesiones) return regs.length - i < t.reentrada.sesiones ? t : null;
    return Date.now() - new Date(regs[i].fecha) < t.reentrada.semanas * 7 * DIA ? t : null;
  }
  return null;
}

// C-PROG-9 · Cadena de variantes sin kilos (el catálogo del PR 9 la trae como `siguiente`; esto es la reserva).
const VARIANTES = {
  'flexiones-inclinadas': 'flexiones-rodillas', 'flexiones-rodillas': 'flexiones', flexiones: 'flexiones-diamante',
  'sentadilla-peso-corporal': 'sentadilla-goblet', 'puente-gluteo': 'puente-una-pierna', 'remo-toalla': 'remo-australiano',
  'dominadas-negativas': 'dominadas', 'talones-pie': 'talones-una-pierna', plancha: 'plancha-lateral', 'curl-femoral-banda': 'curl-femoral-deslizante',
};
// Variante siguiente que puede hacer con su nivel (C-DOSIS-10), o null.
export function varianteSiguiente(e, nivel = 1) {
  const sig = (Array.isArray(e.siguiente) ? e.siguiente : e.siguiente ? [e.siguiente] : [VARIANTES[e.id]]).map(ex).filter(Boolean);
  return sig.find(v => v.niv <= nivel) || null;
}
// C-DOSIS-5 · Peso corporal: con más de 20 repeticiones (15 en flexiones y remo australiano) pasa a la variante.
const techoCorporal = e => (/^flexiones|remo-australiano/.test(e.id) ? 15 : 20);
// C-PISC-2 · Tope de series de largos por nivel.
const TOPE_LARGOS = { 1: 6, 2: 8, 3: 10 };

// C-REC-2 · Músculos principales del ejercicio que están «cargados» (todos los de `m`, no solo el primero).
export function musculosCargados(S, e, carga) {
  const c = carga || cargaMuscular(S);
  return e.m.filter(m => c[m] && c[m].estado === 'cargado').map(m => ({ m, horas: c[m].horas }));
}
// C-REC-2 · Con un músculo cargado, ese día: como mucho 2 series, margen 3 y sin subir. null si no hay ninguno.
export function ajusteCargado(S, e, series, carga) {
  const m = musculosCargados(S, e, carga);
  return m.length ? { series: Math.min(series, 2), margen: 3, musculos: m.map(x => x.m) } : null;
}

// Frenos de una subida: lista cerrada de C-REC-3 (C-PROG-7 para las lesiones). Una lesión con dolor 1-3
// estable no frena. ctx: { energia, dolorHoy, niveles, carga, descarga }.
export function frenosDe(S, e, regs, ctx = {}) {
  const ult = regs[regs.length - 1];
  const frenos = [];
  if ((+ctx.energia || 3) <= 2) frenos.push('hoy tienes poca energía');
  const cargado = musculosCargados(S, e, ctx.carga);
  if (cargado.length) frenos.push(`el ${(MUSCULOS[cargado[0].m] || '').toLowerCase()} aún se recupera (${hace(cargado[0].horas)})`);
  const zonas = Object.keys(e.r || {});
  const dolorHoy = ctx.dolorHoy || {};
  // Dolor de hoy ≥ 4 en una zona implicada. Sin el dolor de hoy, el nivel de cuidado ≥ 2 (4-6) hace sus veces.
  if (zonas.some(z => dolorHoy[z] != null ? +dolorHoy[z] >= 4 : (ctx.niveles || {})[z] >= 2)) frenos.push('hoy te duele una zona que trabaja este ejercicio');
  // C-DOLOR-7: tras una subida de dolor (en la sesión o hasta el check-in siguiente), no sube hasta dos
  // sesiones sin subida.
  if (ult && subidasDolor(regs, e).slice(-2).some(z => z.length)) frenos.push('te subió el dolor hace poco');
  const activas = zonas.filter(z => (S.perfil.lesiones || []).some(l => l.activa && l.zona === z) || +dolorHoy[z] >= 1);
  if (activas.some(z => lesionNueva(S, z, dolorHoy))) frenos.push('la lesión es reciente');
  if (activas.some(z => tendenciaDolorZona(S, z).tendencia === 'sube')) frenos.push('el dolor de esa zona va a más');
  if (ult && ult.esfuerzo >= 5) frenos.push('la última sesión fue al límite');
  if (ctx.descarga) frenos.push('es semana de descarga');
  if (enReentrada(regs)) frenos.push('estás volviendo tras un parón');
  return frenos;
}

// Propuesta para hoy de un ejercicio. base: { series, reps }.
// ctx: { energia, dolorHoy, niveles, carga, tiempo, descarga, nivel }.
// Devuelve { series, reps, kg, tipo: 'nuevo'|'igual'|'sube'|'baja'|'series', motivo, ultima, variante? }.
export function sugerir(S, id, base, ctx = {}) {
  const out = sugerirBase(S, id, base, ctx);
  const e = ex(id);
  if (!e || out.tipo === 'nuevo') return out;
  // C-DESCARGA-1 · Series −50 % sobre las de una semana normal (así da igual que el plan ya las haya bajado).
  const descarga = ctx.descarga != null ? !!ctx.descarga : semanaDescarga(S).toca;
  if (descarga) {
    const normal = registros(S, id).filter(r => !r.descarga).pop();
    out.series = Math.min(out.series, seriesDescarga(e, Math.max(normal ? normal.sets.length : 0, base.series)));
  }
  // C-REC-2 · Músculo cargado: como mucho 2 series con margen 3.
  const aj = ajusteCargado(S, e, out.series, ctx.carga);
  if (aj && out.series > aj.series) { out.series = aj.series; out.motivo = `${out.motivo} Hoy como mucho ${aj.series} series y deja 3 de margen: ese músculo aún se recupera.`.trim(); }
  return out;
}
function sugerirBase(S, id, base, ctx) {
  const e = ex(id);
  const out = { series: base.series, reps: base.reps, kg: null, tipo: 'igual', motivo: '', ultima: '' };
  if (!e) return out;
  const r = rango(base.reps);
  const regs = registros(S, id);
  const ult = regs[regs.length - 1], prev = regs[regs.length - 2];
  const conCarga = e.mat.some(m => ['maquina', 'polea', 'mancuernas', 'barra', 'botellas'].includes(m));
  const nuevo = txt => {
    out.tipo = 'nuevo'; out.kg = null;
    if (txt) out.motivo = txt;
    else if (e.t === 'reps' && r && conCarga) out.motivo = `Primera vez: elige un peso con el que llegues a ${es(r.hi)} dejando 3 repeticiones de margen, y apúntalo.`;
    else if (e.t === 'reps' && r && e.mat.includes('banda')) out.motivo = `Primera vez: elige una banda con la que llegues a ${es(r.hi)} dejando 3 repeticiones de margen.`;
    return out;
  };
  // C-PROG-1 · Sin historial: kg vacío.
  if (!ult) return nuevo();
  out.ultima = resumen(ult);
  const nivel = +ctx.nivel || +S.perfil.nivel || 1;
  const dias = Math.floor((Date.now() - new Date(ult.fecha)) / DIA);
  const descarga = ctx.descarga != null ? !!ctx.descarga : semanaDescarga(S).toca;
  const paron = tramoParon(dias);
  const reentrada = !paron && enReentrada(regs);
  const frenos = frenosDe(S, e, regs, { ...ctx, descarga });
  const freno = frenos[0] || '';
  const vals = s => valor(s.txt, r ? r.u : '');
  const conKg = e.t === 'reps' && ult.sets.some(s => s.kg);
  const dolorHoy = ctx.dolorHoy || {};
  // C-DOLOR-7 · Regla de las 24 horas: hoy ≥ 2 puntos por encima del dolor de antes de la última sesión.
  const peor24 = Object.keys(e.r || {}).filter(z => dolorHoy[z] != null && ult.antes[z] != null && +dolorHoy[z] >= +ult.antes[z] + 2);

  // C-PARON-1 · Más de 84 días: como sin historial, con dosis de principiante y margen 3-4.
  if (paron && paron.pct == null) {
    out.series = paron.series(base.series);
    return nuevo('Hace más de 12 semanas que no lo haces: empieza como la primera vez, con un peso con el que te sobren 3 o 4 repeticiones.');
  }

  if (conKg) {
    const asist = esAsistida(e);
    const kgDe = x => { const k = x.sets.filter(s => s.kg).map(s => s.kg); return asist ? Math.min(...k) : Math.max(...k); };
    const kgUlt = kgDe(ult);
    const top = ult.sets.filter(s => s.kg === kgUlt).map(vals).filter(v => v != null);
    const p = paso(e, kgUlt);
    const lo = r ? r.lo : 8, hi = r ? r.hi : 12;
    // C-PROG-2 · Tope del rango en todas las series (mínimo 2) con el peso de trabajo.
    const alTope = (x, extra = 0) => {
      if (!x || !x.sets.some(s => s.kg) || kgDe(x) !== kgUlt) return false;
      const conPeso = x.sets.filter(s => s.kg === kgUlt), v = conPeso.map(vals).filter(y => y != null);
      return v.length >= Math.max(2, base.series) && v.length === conPeso.length && v.every(y => y >= hi + extra);
    };
    const llego = alTope(ult);
    // C-PROG-4 · Si el paso supera el 10 % del peso: 2 sesiones seguidas en el tope o tope + 2 repeticiones.
    const pasoGrande = !asist && p > kgUlt * 0.1;
    const listo = llego && (!pasoGrande || alTope(prev) || alTope(ult, 2));
    // C-PROG-6 · Más de la mitad de las series por debajo del mínimo.
    const corto = x => {
      if (!x || !x.sets.some(s => s.kg)) return false;
      const k = kgDe(x), v = x.sets.filter(s => s.kg === k).map(vals).filter(y => y != null);
      return v.length > 0 && v.filter(y => y < lo).length > v.length / 2;
    };
    let kg = kgUlt;
    // Todas las bajadas que tocan; se aplica la más fuerte (C-PARON-1, C-DOLOR-7, C-PROG-6).
    const bajadas = [];
    if (paron) bajadas.push({ kg: bajarParon(e, kgUlt, p, paron.pct), txt: k => `Hace ${paron.txt} que no lo haces: empieza con ${es(k)} kg`, porParon: true });
    if (peor24.length) bajadas.push({ kg: bajar(e, kgUlt, p, 0.3), txt: k => `Hoy te duele más que antes de la última sesión: ${k != null ? `baja a ${es(k)} kg` : 'usa una variante más suave'}; no subas hasta dos sesiones sin que el dolor suba` });
    if (corto(ult) && corto(prev)) bajadas.push({ kg: bajar(e, kgUlt, p), txt: k => (k != null ? `Dos sesiones sin llegar a ${es(lo)} repeticiones: baja a ${es(k)} kg y vuelve a subir desde ahí` : `Dos sesiones sin llegar a ${es(lo)} repeticiones y ya estás en el peso más bajo: prueba una variante más fácil`) });
    const fuerte = bajadas.filter(b => b.kg != null).sort((a, b) => (asist ? b.kg - a.kg : a.kg - b.kg))[0] || bajadas[0];
    const extraDescarga = descarga ? ' Semana de descarga: menos series y 4 repeticiones de margen.' : '';
    if (fuerte) {
      if (fuerte.kg != null && fuerte.kg !== kgUlt) { kg = fuerte.kg; out.tipo = 'baja'; }
      if (paron) out.series = paron.series(base.series);
      out.motivo = fuerte.txt(fuerte.kg) + (paron && !fuerte.porParon ? ` (llevas ${paron.txt} sin hacerlo)` : '') + (paron ? `, con ${out.series} series.` : '.') + extraDescarga;
    } else if (descarga) {
      out.motivo = `Semana de descarga: mismo peso (${es(kgUlt)} kg), menos series y deja 4 repeticiones de margen.`;
    } else if (listo && !freno) {
      const k = asist ? r2(kgUlt - p) : r2(kgUlt + p);
      if (asist && k <= 0) out.motivo = `Ya casi no necesitas ayuda (${es(kgUlt)} kg): mantén y prueba la versión sin máquina cuando te veas con fuerza.`;
      else { kg = k; out.tipo = 'sube'; out.motivo = asist ? `Quita ${es(p)} kg de ayuda: llegaste a ${es(hi)} en todas las series. Hoy basta con llegar a ${es(lo)}.` : `Sube ${es(p)} kg: llegaste a ${es(hi)} en todas las series. Hoy basta con llegar a ${es(lo)}.`; }
    } else if (llego && freno) out.motivo = `Te tocaba subir, pero ${freno}: repite ${es(kgUlt)} kg.`;
    else if (llego) out.motivo = `Llegaste a ${es(hi)} en todas: el siguiente peso es un salto grande, así que repite ${es(kgUlt)} kg y súbelo cuando llegues al tope dos veces seguidas o a ${es(hi + 2)}.`;
    else if (top.length >= 2 && top.length < base.series && top.every(v => v >= hi)) out.motivo = freno ? `Mantén ${es(kgUlt)} kg: ${freno}.` : `Llegaste a ${es(hi)} en tus ${top.length} series; hoy son ${base.series}: mismo peso, ${es(kgUlt)} kg, y cuando llegues a ${es(hi)} en todas, subes.`;
    else if (corto(ult)) out.motivo = `Repite ${es(kgUlt)} kg e intenta llegar a ${es(lo)} repeticiones en cada serie.`;
    else { const obj = Math.min(hi, Math.floor(Math.max(...top, 0)) + 1); out.motivo = freno ? `Mantén ${es(kgUlt)} kg: ${freno}.` : `Mismo peso, ${es(kgUlt)} kg: intenta ${es(obj)} repeticiones por serie. Al llegar a ${es(hi)} en todas, subes.`; }
    if (reentrada) out.series = reentrada.series(base.series);
    // C-PROG-7 · Con lesión en B0-B1 estable se sube un paso cada vez, nunca dos semanas seguidas.
    if (out.tipo === 'sube' && Object.keys(e.r || {}).some(z => (S.perfil.lesiones || []).some(l => l.activa && l.zona === z)) && subioHace(regs, asist) < 14) {
      kg = kgUlt; out.tipo = 'igual'; out.motivo = `Con tu lesión se sube una semana sí y otra no: repite ${es(kgUlt)} kg.`;
    }
    out.kg = kg;
    return out;
  }

  // ── Sin kilos (C-PROG-9): siempre desde lo último que hizo ──
  const vs = ult.sets.map(vals).filter(v => v != null);
  if (!r || !vs.length) return out;
  const unidad = r.u === 's' ? ' s' : r.u === 'min' ? ' min' : r.u === 'm' ? ' m' : '';
  const min = Math.min(...vs);
  const hechas = Math.max(base.series, ult.sets.length);
  const desde = (a, b) => textoRango({ lo: a, hi: b, u: r.u, resto: r.resto });
  if (paron) { out.tipo = 'baja'; out.series = paron.series(base.series); out.motivo = `Hace ${paron.txt} que no lo haces: ${out.series} series en la parte baja del rango.`; return out; }
  if (descarga) { out.motivo = 'Semana de descarga: menos series y deja 4 repeticiones de margen.'; return out; }
  if (reentrada) out.series = reentrada.series(base.series);
  // Nunca por debajo de lo que ya hizo.
  if (min > r.hi) out.reps = desde(min, min);
  const todas = vs.length >= Math.max(2, base.series) && vs.length === ult.sets.length && vs.every(v => v >= r.hi);
  if (!todas) {
    const obj = Math.min(Math.max(r.hi, min), Math.floor(vs.reduce((a, b) => a + b, 0) / vs.length) + (r.u === 's' ? 5 : 1));
    out.motivo = freno ? `Mantén lo de la última vez: ${freno}.` : `La última vez: ${out.ultima}. Hoy intenta llegar a ${es(obj)}${unidad} en cada serie.`;
    return out;
  }
  if (freno) { out.motivo = `Te tocaba subir, pero ${freno}: repite lo de la última vez.`; return out; }
  // Piscina: +1 serie hasta el tope del nivel; después, de 25 a 50 m.
  if (e.t === 'distancia' || r.u === 'm') {
    const tope = TOPE_LARGOS[nivel] || 6;
    if (ctx.tiempo !== 'rapido' && hechas < tope) { out.series = hechas + 1; out.tipo = 'series'; out.motivo = `Completaste todos los largos: hoy una serie más (${out.series}).`; }
    else if (r.lo < 50) { out.reps = desde(50, 50); out.series = Math.max(2, Math.round(hechas / 2)); out.tipo = 'sube'; out.motivo = `Llegaste al tope de largos: hoy ${out.series} × 50 m.`; }
    return out;
  }
  // Tiempo: +5 s hasta 45 s, +10 s hasta 60 s; con 60 s o más, variante.
  if (r.u === 's' || r.u === 'min') {
    const seg = r.u === 'min' ? min * 60 : min;
    if (seg >= 60) {
      const v = varianteSiguiente(e, nivel);
      out.reps = desde(min, min); if (v) out.variante = v.id;
      out.motivo = v ? `Aguantas ${es(min)}${unidad}: mantén el tiempo y, cuando quieras, pasa a ${v.n.toLowerCase()}.` : `Aguantas ${es(min)}${unidad}: mantén el tiempo y hazlo más lento y controlado.`;
      return out;
    }
    const inc = r.u === 'min' ? 1 : min <= 45 ? 5 : 10;
    out.reps = desde(min, r.u === 'min' ? min + inc : Math.min(60, min + inc)); out.tipo = 'sube';
    out.motivo = `Llegaste a ${es(min)}${unidad} en todas: hoy ${out.reps}.`;
    return out;
  }
  // Banda: la siguiente al llegar al tope.
  if (e.mat.includes('banda') && !e.mat.includes('peso corporal')) { out.tipo = 'sube'; out.motivo = `Llegaste a ${es(r.hi)} en todas: hoy pasa a la banda siguiente y vuelve a ${es(r.lo)}.`; return out; }
  // Repeticiones: +1-2 por serie; con el tope dos sesiones seguidas, +1 serie (hasta 3 o 4, D-B); por encima del techo
  // de C-DOSIS-5 dos sesiones seguidas, variante.
  const valsPrev = prev ? prev.sets.map(vals) : [];
  const prevTope = valsPrev.length > 0 && valsPrev.every(v => v != null && v >= r.hi);
  const techo = techoCorporal(e);
  if (min > techo && valsPrev.length && valsPrev.every(v => v != null && v > techo)) {
    const v = varianteSiguiente(e, nivel);
    out.reps = desde(min, min);
    if (v) { out.variante = v.id; out.motivo = `Más de ${techo} repeticiones dos sesiones seguidas: pasa a ${v.n.toLowerCase()}.`; }
    else out.motivo = `Más de ${techo} repeticiones dos sesiones seguidas: mantén y hazlo más lento (3 s al bajar).`;
    return out;
  }
  if (prevTope && hechas < topeSeries(nivel) && ctx.tiempo !== 'rapido') { // D-B (S14)
    out.series = hechas + 1; out.tipo = 'series'; out.reps = desde(r.lo, Math.max(r.hi, min));
    out.motivo = `Dos sesiones al tope: hoy una serie más (${out.series}).`;
    return out;
  }
  out.reps = desde(min, min + 2); out.tipo = 'sube';
  out.motivo = `Llegaste a ${es(min)} en todas: hoy ${out.reps}.`;
  return out;
}
// Días desde la última vez que subió de peso (o quitó ayuda) en este ejercicio.
function subioHace(regs, asist) {
  const k = x => { const v = x.sets.filter(s => s.kg).map(s => s.kg); return v.length ? (asist ? Math.min(...v) : Math.max(...v)) : null; };
  for (let i = regs.length - 1; i >= 1; i--) {
    const a = k(regs[i - 1]), b = k(regs[i]);
    if (a != null && b != null && (asist ? b < a : b > a)) return (Date.now() - new Date(regs[i].fecha)) / DIA;
  }
  return Infinity;
}

// C-PROG-5 · Barandilla para lo que propone la IA. Usa la misma decisión que las reglas (sugerir):
// - máximo: el último peso máximo + 1 paso solo si las reglas dicen «sube»; si no, lo que digan las reglas
//   (mismo peso, o menos si toca bajar: fallos, regla de las 24 h, parón…);
// - asistidas: ayuda ≥ última − 1 paso solo si toca subir; si no, ≥ la ayuda que digan las reglas;
// - mínimo: 50 % del último; por debajo, se corrige al 50 %.
// ctx: { energia, dolorHoy, niveles, descarga, carga, series, reps }. Sin ctx no se sabe cómo llega hoy la
// persona: no se deja subir. Devuelve null si los kilos no son un número o si, tras más de 12 semanas, toca
// empezar como sin historial.
export function acotarKg(S, id, kg, ctx) {
  if (kg == null || kg === '') return null;
  kg = +kg;
  if (!Number.isFinite(kg) || kg < 0) return null;
  const e = ex(id); if (!e) return kg;
  const regs = registros(S, id);
  const ult = regs[regs.length - 1];
  if (!ult || !ult.sets.some(s => s.kg)) return kg;
  const conCtx = !!ctx && Object.keys(ctx).length > 0;
  const k = ult.sets.filter(s => s.kg).map(s => s.kg);
  const asist = esAsistida(e);
  const ref = asist ? Math.min(...k) : Math.max(...k);
  const p = paso(e, ref);
  const sg = sugerir(S, id, { series: (ctx && ctx.series) || Math.max(2, ult.sets.length), reps: (ctx && ctx.reps) || e.d[1] }, ctx || {});
  if (sg.tipo === 'nuevo') return null;
  const reglas = sg.kg != null ? sg.kg : ref;
  const sube = conCtx && sg.tipo === 'sube';
  if (asist) return Math.max(kg, sube ? Math.max(p, r2(ref - p)) : Math.max(ref, reglas));
  const max = sube ? r2(ref + p) : Math.min(ref, reglas);
  const minimo = Math.min(max, arriba(ref * 0.5, p));
  return Math.min(Math.max(kg, minimo), max);
}
