// Sobrecarga progresiva y recuperación. Son las barandillas del entrenador:
// - lo que propone la IA se compara con esto (kilos y series razonables),
// - y sin conexión o sin IA, las reglas del entrenador usan esto directamente.
//
// Doble progresión: con kilos, cuando llegas al tope del rango en todas las series se sube el paso mínimo
// del material; si dos sesiones seguidas no llegas al mínimo, se baja un 10 %. Sin kilos se progresa en
// repeticiones, tiempo, metros o series. Frenos: poca energía, dolor que subió, sesión al límite o músculo
// sin recuperar.

import { ex, riesgo } from './catalogo.js';
import { MUSCULOS } from '../datos/constantes.js';
import { num, es } from '../nucleo/ui.js';

const DIA = 864e5;

// «8-12», «12 c/pierna», «30-45s», «10-20 min», «25 m» → { lo, hi, u, resto }
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
  const v = num(s); if (v == null) return null;
  if (u === 's' && /min/i.test(s)) return v * 60;
  if (u === 'min' && /\d\s*s\b/i.test(s)) return v / 60;
  return v;
}

export const esAsistida = e => /asistid/.test(e.id) && e.mat.includes('maquina');
export function paso(e, kg) {
  if (e.mat.includes('mancuernas')) return kg < 10 ? 1 : 2;
  if (e.mat.includes('barra') || e.mat.includes('maquina') || e.mat.includes('polea')) return kg >= 80 ? 5 : 2.5;
  return kg >= 20 ? 2.5 : 1;
}
const redondear = (kg, p) => Math.max(0, Math.round(kg / p) * p);

export const sesionesHechas = S => Object.values(S.sesiones || {}).filter(s => s.estado === 'hecha')
  .sort((a, b) => new Date(a.terminada || a.fecha) - new Date(b.terminada || b.fecha));

// Todas las veces que hizo un ejercicio, de la más antigua a la más reciente.
export function registros(S, id) {
  return sesionesHechas(S).map(s => {
    const x = (s.ejercicios || []).find(x => x.id === id);
    if (!x) return null;
    const sets = (x.sets || []).filter(z => z.hecha && (String(z.valor || '').trim() || +z.kg > 0)).map(z => ({ kg: +z.kg > 0 ? +z.kg : null, txt: String(z.valor || '').trim() }));
    if (!sets.length) return null;
    return { fecha: s.terminada || s.fecha, sets, esfuerzo: s.cierre && +s.cierre.esfuerzo || null, energia: s.checkin && +s.checkin.energia || null,
      antes: (s.checkin && s.checkin.dolor) || {}, despues: (s.cierre && s.cierre.dolor) || {}, gusto: x.gusto || null };
  }).filter(Boolean);
}

export function resumen(reg) {
  if (!reg) return '';
  const conKg = reg.sets.some(s => s.kg);
  return reg.sets.map(s => conKg ? `${s.kg ? es(s.kg) : '—'} kg × ${s.txt || '?'}` : (s.txt || '?')).join(' · ');
}
const dolorSubio = (reg, e) => Object.keys(e.r || {}).filter(z => reg.despues[z] != null && +reg.despues[z] >= +(reg.antes[z] || 0) + 2);

// ── Recuperación por músculo ──
export const RECUPERA = { pecho: 72, espalda: 72, cuadriceps: 72, gluteo: 72, isquios: 72, hombro: 48, biceps: 48, triceps: 48, gemelo: 48, core: 24 };
export function cargaMuscular(S) {
  const ahora = Date.now(), c = {};
  sesionesHechas(S).forEach(s => {
    const horas = (ahora - new Date(s.terminada || s.fecha)) / 3600e3;
    if (horas < 0 || horas > 96) return;
    const duro = s.cierre && +s.cierre.esfuerzo >= 4 ? 1.25 : 1;
    (s.ejercicios || []).forEach(x => {
      const e = ex(x.id); if (!e) return;
      const n = (x.sets || []).filter(z => z.hecha).length; if (!n) return;
      const suma = (m, f) => {
        const rec = RECUPERA[m]; if (!rec || horas > rec) return;
        const k = c[m] || (c[m] = { horas, series: 0, rec });
        k.horas = Math.min(k.horas, horas); k.series += n * f * duro;
      };
      e.m.forEach(m => suma(m, 1)); (e.s || []).forEach(m => suma(m, 0.5));
    });
  });
  Object.values(c).forEach(k => {
    k.series = Math.round(k.series * 10) / 10; k.horas = Math.round(k.horas);
    k.estado = k.horas < k.rec * 0.67 && k.series >= 4 ? 'cargado' : k.horas < k.rec && k.series >= 3 ? 'parcial' : 'fresco';
    k.faltan = Math.max(0, k.rec - k.horas);
  });
  return c;
}
export const hace = hrs => hrs < 24 ? `hace ${hrs} h` : hrs < 48 ? 'ayer' : `hace ${Math.round(hrs / 24)} días`;

// Propuesta para hoy de un ejercicio. base: { series, reps }. ctx: { energia, niveles, carga, tiempo }.
// Devuelve { series, reps, kg, tipo: 'nuevo'|'igual'|'sube'|'baja'|'series', motivo, ultima }.
export function sugerir(S, id, base, ctx = {}) {
  const e = ex(id);
  const out = { series: base.series, reps: base.reps, kg: null, tipo: 'igual', motivo: '', ultima: '' };
  if (!e) return out;
  const r = rango(base.reps);
  const regs = registros(S, id);
  const ult = regs[regs.length - 1], prev = regs[regs.length - 2];
  if (!ult) {
    out.tipo = 'nuevo';
    const conCarga = e.mat.some(m => ['maquina', 'polea', 'mancuernas', 'barra', 'botellas'].includes(m));
    if (e.t === 'reps' && r && conCarga) out.motivo = `Primera vez: elige un peso con el que llegues a ${es(r.hi)} dejando 2 o 3 repeticiones de margen, y apúntalo.`;
    else if (e.t === 'reps' && r && e.mat.includes('banda')) out.motivo = `Primera vez: elige una banda con la que llegues a ${es(r.hi)} dejando 2 o 3 repeticiones de margen.`;
    return out;
  }
  out.ultima = resumen(ult);
  const energia = +ctx.energia || 3;
  const dias = Math.floor((Date.now() - new Date(ult.fecha)) / DIA);
  const frenos = [];
  if (energia <= 2) frenos.push('hoy tienes poca energía');
  if (riesgo(e, ctx.niveles || {}) === 'precaucion') frenos.push('vas con cuidado por tu lesión');
  const subio = dolorSubio(ult, e);
  if (subio.length) frenos.push('la última vez te subió el dolor');
  if (ult.esfuerzo >= 5) frenos.push('la última sesión fue al límite');
  const carga = (ctx.carga || cargaMuscular(S))[e.m[0]];
  if (carga && carga.estado !== 'fresco') frenos.push(`el ${(MUSCULOS[e.m[0]] || '').toLowerCase()} aún se recupera (${hace(carga.horas)})`);
  const freno = frenos[0] || '';
  const vals = s => valor(s.txt, r ? r.u : '');
  const conKg = e.t === 'reps' && ult.sets.some(s => s.kg);

  if (conKg) {
    const asist = esAsistida(e);
    const kgDe = x => { const k = x.sets.filter(s => s.kg).map(s => s.kg); return asist ? Math.min(...k) : Math.max(...k); };
    const kgUlt = kgDe(ult);
    const top = ult.sets.filter(s => s.kg === kgUlt).map(vals).filter(v => v != null);
    const p = paso(e, kgUlt);
    const lo = r ? r.lo : 8, hi = r ? r.hi : 12;
    const llego = top.length >= Math.min(2, base.series) && top.every(v => v >= hi);
    const corto = x => { if (!x || !x.sets.some(s => s.kg)) return false; const k = kgDe(x); const v = x.sets.filter(s => s.kg === k).map(vals).filter(v => v != null); return v.length && v.filter(y => y < lo).length > v.length / 2; };
    const masDuro = kg => asist ? kg - p : kg + p, masFacil = kg => asist ? kg * 1.1 : kg * 0.9;
    let kg = kgUlt;
    if (dias > 28) { kg = redondear(masFacil(kgUlt), p); out.tipo = 'baja'; out.motivo = `Hace ${Math.round(dias / 7)} semanas que no lo haces: empieza con ${es(kg)} kg y recupera el ritmo.`; }
    else if (energia <= 1) { kg = redondear(masFacil(kgUlt), p); out.tipo = 'baja'; out.motivo = `Día de poca energía: ${es(kg)} kg, un 10 % más suave.`; }
    else if (corto(ult) && corto(prev)) { kg = redondear(masFacil(kgUlt), p); out.tipo = 'baja'; out.motivo = `Dos sesiones sin llegar a ${es(lo)} repeticiones: baja a ${es(kg)} kg y vuelve a subir desde ahí.`; }
    else if (llego && !freno) { kg = redondear(masDuro(kgUlt), p); out.tipo = 'sube'; out.motivo = asist ? `Quita ${es(p)} kg de ayuda: llegaste a ${es(hi)} en todas las series.` : `Sube ${es(p)} kg: llegaste a ${es(hi)} en todas las series. Hoy basta con llegar a ${es(lo)}.`; }
    else if (llego) out.motivo = `Te tocaba subir, pero ${freno}: repite ${es(kgUlt)} kg.`;
    else if (corto(ult)) out.motivo = `Repite ${es(kgUlt)} kg e intenta llegar a ${es(lo)} repeticiones en cada serie.`;
    else { const obj = Math.min(hi, Math.floor(Math.max(...top, 0)) + 1); out.motivo = freno ? `Mantén ${es(kgUlt)} kg: ${freno}.` : `Mismo peso, ${es(kgUlt)} kg: intenta ${es(obj)} repeticiones por serie. Al llegar a ${es(hi)} en todas, subes.`; }
    out.kg = kg;
    return out;
  }

  const vs = ult.sets.map(vals).filter(v => v != null);
  if (!r || !vs.length) return out;
  const todas = vs.length >= Math.min(2, base.series) && vs.every(v => v >= r.hi);
  const media = vs.reduce((a, b) => a + b, 0) / vs.length;
  const unidad = r.u === 's' ? ' s' : r.u === 'min' ? ' min' : r.u === 'm' ? ' m' : '';
  if (dias > 28 || energia <= 1) { out.tipo = 'baja'; out.motivo = dias > 28 ? `Hace ${Math.round(dias / 7)} semanas que no lo haces: quédate en la parte baja del rango.` : 'Día suave: quédate en la parte baja del rango.'; return out; }
  if (!todas) { const obj = Math.min(r.hi, Math.floor(media) + (r.u === 's' ? 5 : 1)); out.motivo = freno ? `Mantén lo de la última vez: ${freno}.` : `La última vez: ${out.ultima}. Hoy intenta llegar a ${es(obj)}${unidad} en cada serie.`; return out; }
  if (freno) { out.motivo = `Te tocaba subir, pero ${freno}: repite lo de la última vez.`; return out; }
  if (e.t === 'distancia' || r.u === 'm') {
    if (ctx.tiempo !== 'rapido' && base.series < 10) { out.series = base.series + 1; out.tipo = 'series'; out.motivo = `Completaste todos los largos: hoy una serie más (${out.series}).`; }
    return out;
  }
  if (e.t === 'reps' && r.hi >= 20 && base.series < 5 && ctx.tiempo !== 'rapido') { out.series = base.series + 1; out.tipo = 'series'; out.motivo = `Llegaste a ${es(r.hi)} en todas: hoy una serie más. Cuando te sobre, pasa a una variante más difícil.`; return out; }
  const inc = r.u === 's' ? (r.hi >= 60 ? 10 : 5) : 2;
  out.reps = textoRango({ lo: r.hi, hi: r.hi + inc, u: r.u, resto: r.resto }); out.tipo = 'sube';
  out.motivo = `Llegaste a ${es(r.hi)}${unidad} en todas: hoy ${out.reps}.`;
  return out;
}

// Barandilla para lo que propone la IA: si los kilos se alejan mucho de lo último apuntado, se corrigen.
export function acotarKg(S, id, kg) {
  const e = ex(id); if (!e || kg == null) return kg;
  const ult = registros(S, id).pop();
  if (!ult || !ult.sets.some(s => s.kg)) return kg;
  const ref = Math.max(...ult.sets.filter(s => s.kg).map(s => s.kg));
  const p = paso(e, ref);
  return Math.min(Math.max(kg, redondear(ref * 0.7, p)), ref + 2 * p);
}
