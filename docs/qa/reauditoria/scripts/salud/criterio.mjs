// Comprobador independiente del criterio (docs/criterio.md) para sesiones ya montadas.
import { cat, ent, lesiones } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
const { ex, hayMaterial, EJERCICIOS, ZONAS } = cat;
const { fasesDe, riesgoDetalle } = lesiones;
export const PIERNA = ['cadera_lateral', 'rodilla', 'tobillo_pie'];
const TUMBADO = ['postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4', 'gato-camello', 'estiramiento-gluteo-rodilla-pecho', 'estiramiento-flexor-cadera', 'rotacion-toracica-cuadrupedia', 'descarga-90-90', 'apertura-libro', 'dead-bug', 'puente-gluteo'];
const AISLA_HOMBRO = ['elevaciones-laterales', 'elevaciones-laterales-maquina', 'elevaciones-laterales-banda', 'pajaros', 'face-pull', 'face-pull-banda', 'rotacion-externa-banda'];
const CARDIO_MIN = { musculo: 8, fuerza: 8, salud: 10, perder: 15, resistencia: 15, natacion: 10 };
const porNombre = Object.fromEntries(EJERCICIOS.map(e => [e.n.toLowerCase(), e]));
export const rango = t => { const m = String(t || '').match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(min|s)?/); return m ? { lo: +m[1].replace(',', '.'), hi: +(m[2] || m[1]).replace(',', '.'), u: m[3] || '' } : null; };
const minDe = t => { const r = rango(t); return !r ? 0 : r.u === 'min' ? r.hi : r.u === 's' ? r.hi / 60 : 0; };
const banda = d => d >= 7 ? 3 : d >= 4 ? 2 : d >= 1 ? 1 : 0;
const opMin = m => [30, 45, 60, 75, 90].reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
function pausaMinima(tipo, lo) {
  if (!(lo > 0) || !['compuesto', 'corporal', 'aislamiento'].includes(tipo)) return 0;
  if (tipo === 'aislamiento') return lo <= 10 ? 60 : lo <= 15 ? 45 : 30;
  return lo <= 6 ? 120 : lo <= 10 ? 90 : lo <= 15 ? 60 : 45;
}
// Bandas propias: C-DOLOR-0/1, C-LES-1/2/3.
export function misBandas(S, dolorHoy) {
  const out = {};
  for (const l of S.perfil.lesiones.filter(l => l.activa)) {
    const hoy = dolorHoy[l.zona] != null && dolorHoy[l.zona] !== '' ? +dolorHoy[l.zona] : Math.min(6, +l.dolor || 0);
    const sem = l.desde ? (Date.now() - new Date(l.desde)) / 6048e5 : 0;
    const nueva = l.tipo === 'puntual' || (l.tipo !== 'recurrente' && (!l.desde || sem < 6));
    let b = banda(hoy); if (nueva && b === 1 && hoy >= 2) b = 2;
    if (!out[l.zona] || out[l.zona].dolor < hoy) out[l.zona] = { dolor: hoy, b, nueva, det: l.detalle };
  }
  for (const [z, v] of Object.entries(dolorHoy)) if (+v >= 1 && !out[z]) { let b = banda(+v); if (b === 1 && +v >= 2) b = 2; out[z] = { dolor: +v, b, nueva: true, sin: true }; }
  return out;
}
export function comprobar(S, ses, ci, { mia = false, ruta = 'reglas' } = {}) {
  const P = [];
  const p = S.perfil, lugar = ci.lugar, min = opMin(+ci.minutos || 60);
  const B = misBandas(S, ci.dolorHoy || {});
  const d2 = Object.values(ci.dolorHoy || {}).some(v => +v >= 7);
  const edad = p.datos && p.datos.nacimiento ? new Date().getFullYear() - +String(p.datos.nacimiento).slice(0, 4) : null;
  const nivel = p.nivel || 1;
  const ejs = ses.ejercicios || [], cal = ses.calentamiento || [], vue = ses.vuelta || [];
  const prin = ejs.filter(x => x.rol === 'principal');
  const expl = (ses.explicacion || []).join(' ');
  const ultimo = /último recurso|no caben tu cardio/.test(expl);
  const suave = ses.tipo === 'dolorAlto';
  // T1
  if (cal.length < 2) P.push('T1 calentamiento < 2');
  if (vue.length < 2 || !vue.some(t => /estir|postura|flotaci/i.test(t.nombre || '') || /estiramiento/.test(t.id || ''))) P.push('T1 vuelta sin estiramiento');
  const cardio = ejs.filter(x => x.rol === 'cardio');
  if (!cardio.length) P.push('T1 sin cardio');
  const objs = p.objetivos.length ? p.objetivos : ['salud'];
  let cmin = CARDIO_MIN[objs[0]] || 10;
  if (objs.slice(1).some(o => o === 'perder' || o === 'resistencia') && min >= 60) cmin = Math.max(cmin, 15);
  if (lugar === 'piscina') cmin = ['perder', 'resistencia'].includes(objs[0]) ? 15 : 10;
  const cm = cardio.reduce((t, x) => t + minDe(x.reps), 0);
  if (cardio.length && !d2 && !suave && cm < cmin) P.push(`C-CARDIO-1 cardio ${cm} < ${cmin}`);
  // Cada tarea/ejercicio
  const todos = [...ejs.map(x => ({ ...x, donde: 'ej' })), ...cal.map(t => ({ ...t, donde: 'cal' })), ...vue.map(t => ({ ...t, donde: 'vue' }))];
  for (const x of todos) {
    const e = x.id ? ex(x.id) : porNombre[String(x.nombre || '').toLowerCase()];
    if (!e) continue;
    const tag = `${x.donde}:${e.id}${x.id ? '' : '(por nombre)'}`;
    if (!e.l.includes(lugar)) P.push(`C-EST-4 ${tag} no es de ${lugar}`);
    if (!hayMaterial(e, lugar, p)) P.push(`C-EST-4 ${tag} sin material`);
    if ((p.gustos || {})[e.id] === 'rechazo') P.push(`T3 ${tag} rechazado`);
    if (lugar === 'calle' && TUMBADO.includes(e.id)) P.push(`C-EST-4 ${tag} tumbado en la calle`);
    for (const [z, b] of Object.entries(B)) {
      const r = riesgoDetalle(e, z, b.det);
      if (!r) continue;
      if (d2 && !(x.rol === 'cardio' && false)) { P.push(`C-DOLOR-4 ${tag} r=${r} en ${z} en D2`); continue; }
      if (r === 2) P.push(`C-DOLOR-1 ${tag} r=2 en ${z} (B${b.b})`);
      else if (b.b >= 2 && !(x.rol === 'rehab' && false)) P.push(`C-DOLOR-1 ${tag} r=1 en ${z} B${b.b}`);
    }
  }
  if (d2) {
    if (prin.length) P.push('C-DOLOR-4 principal en D2');
    if (ejs.some(x => x.rol === 'rehab')) P.push('C-DOLOR-4 rehab en D2');
    const t = ent.tiempoSesion(ses);
    if (Math.abs(t - min) > 2) P.push(`C-DOLOR-4 D2 ${t} min de ${min}`);
    return P;
  }
  // Rehab
  for (const x of ejs.filter(x => x.rol === 'rehab')) {
    const e = ex(x.id); if (!e) continue;
    const ok = Object.entries(B).some(([z, b]) => { const f = b.b === 0 ? 3 : b.b === 1 && !b.nueva ? 2 : 1; const fs = fasesDe(e, z, b.det).filter(q => q <= f); if (!fs.length) return false; const r = riesgoDetalle(e, z, b.det); return !r || (r === 1 && b.b === 0 && fs.includes(3)); });
    if (!ok) P.push(`C-ZONA-0 rehab ${x.id} no vale`);
  }
  for (const [z, b] of Object.entries(B)) if (b.b === 2 && !ejs.some(x => x.rol === 'rehab' && fasesDe(ex(x.id), z, b.det).length)) P.push(`C-DOLOR-3 sin rehab de ${z} (B2)`);
  // r por zona en principales
  for (const z of Object.keys(B)) { const n = prin.filter(x => (ex(x.id).r || {})[z]).length; if (n > 2) P.push(`C-DOSIS-4 ${n} principales con r en ${z}`); }
  if (prin[0] && Object.keys(B).some(z => (ex(prin[0].id).r || {})[z]) && prin.some(x => !Object.keys(B).some(z => (ex(x.id).r || {})[z]))) P.push(`C-DOSIS-4 primer principal ${prin[0].id} con r`);
  if (prin.length < 3 && !ultimo && !mia && ses.tipo !== 'suave' && !(ci.energia === 1 && prin.length)) P.push(`C-TIEMPO-2 ${prin.length} principales`);
  if (ci.energia === 1 && prin.length > 3 && !mia) P.push(`C-ENERGIA-1 ${prin.length} principales con energía 1`);
  if (ci.energia === 2 && prin.length > 4 && !mia) P.push(`C-ENERGIA-1 ${prin.length} principales con energía 2`);
  // Dosis
  prin.forEach((x, i) => {
    const e = ex(x.id); const r = rango(x.reps);
    if (+x.series > (e.t === 'distancia' && lugar === 'piscina' ? 10 : 6)) P.push(`C-SERIES-1 ${x.id} ${x.series} series`);
    if (e.t !== 'distancia' && ruta === 'reglas' && !mia && +x.series > (nivel === 1 ? 3 : 4) && ci.energia !== 5) P.push(`D-B ${x.id} ${x.series} series (nivel ${nivel})`);
    if (e.t !== 'distancia' && ruta === 'reglas' && !mia && +x.series > (nivel === 1 ? 3 : 4) + 1) P.push(`D-B ${x.id} ${x.series} series (nivel ${nivel}, energía 5)`);
    if (e.t === 'reps' && r && r.u === '') {
      if (e.tipo === 'aislamiento' && r.lo < (AISLA_HOMBRO.includes(e.id) ? 12 : 8)) P.push(`C-DOSIS-3 ${x.id} ${x.reps}`);
      const pm = pausaMinima(e.tipo, r.lo); if (+x.descanso < pm && !x.superserie) P.push(`${i > 0 && prin[i-1].superserie ? 'SUPERSERIE ' : ''}C-PAUSA-1 ${x.id} ${x.reps} con ${x.descanso}s (mín ${pm})`);
      const prec = Object.entries(B).some(([z, b]) => riesgoDetalle(e, z, b.det) === 1 && b.b <= 1);
      if (prec && r.lo < (e.tipo === 'aislamiento' ? 12 : 10)) P.push(`C-DOSIS-4 ${x.id} con precaución a ${x.reps}`);
      if (/fallo/i.test(x.reps)) P.push(`C-PRIN-7 ${x.id} al fallo`);
    }
    if (!mia && e.niv > nivel && !(lugar === 'piscina' && p.nadar25 && ['crol', 'espalda'].includes(e.id))) P.push(`C-DOSIS-10 ${x.id} niv ${e.niv} > ${nivel}`);
  });
  ejs.forEach(x => { if (x.kg != null && +x.kg > 0 && !Object.values(S.sesiones || {}).some(s => (s.ejercicios || []).some(y => y.id === x.id && (y.sets || []).some(z => z.hecha && +z.kg > 0)))) P.push(`C-PROG-1 ${x.id} kg sin historial`); });
  // Edad
  if (edad != null && edad >= 60) {
    const eqOk = ex('equilibrio-una-pierna').l.includes(lugar);
    if (eqOk && ![...cal, ...ejs, ...vue].some(t => t.id === 'equilibrio-una-pierna') && !(B.tobillo_pie && B.tobillo_pie.b >= 2) && !(B.cadera_lateral && B.cadera_lateral.b >= 2)) P.push('C-EDAD-1 sin equilibrio');
  }
  // Intervalos
  const conInt = cardio.some(x => /6-8 veces 1 min fuerte/.test(x.nota || ''));
  if (conInt) {
    const okInt = nivel >= 2 && ['perder', 'resistencia'].includes(objs[0]) && !Object.entries(B).some(([z, b]) => [...PIERNA, 'lumbar'].includes(z) && b.b >= 2) && !(edad != null && edad >= 60) && ci.energia > 2;
    if (!okInt) P.push('C-CARDIO-4 intervalos no permitidos');
    if (cardio.some(x => ['carrera-suave', 'comba'].includes(x.id)) && Object.keys(B).some(z => PIERNA.includes(z))) P.push(`C-CARDIO-4 ${cardio[0].id} a intervalos con lesión de pierna`);
  }
  // Tiempo
  const t = ent.tiempoSesion(ses);
  if (!mia && !ultimo && t > min * 1.1 + 0.5) P.push(`C-TIEMPO-1 ${t} min de ${min}`);
  return P;
}
export const minutosOp = opMin;
