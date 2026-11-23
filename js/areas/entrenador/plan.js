// Área ENTRENADOR · la semana con reglas: reparto de días (C-REP-*), volumen semanal (C-VOL-*), descarga
// (C-DESCARGA-1), plan semanal sin IA, estado de cada día y reorganizar lo que queda cuando se pierde un día.

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { es } from '../../nucleo/ui.js';
import { semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { tendencias } from '../../reglas/contexto.js';
import { sesionesHechas, semanaDescarga, seriesDescarga, lesionNueva, topeSeries } from '../../reglas/progresion.js';
import { ex, ZONAS, disponibles, nivelesZona, riesgo } from '../../reglas/catalogo.js';
import { MUSCULOS, OBJETIVOS, DIAS } from '../../datos/constantes.js';
import { validarSesion } from './validar.js';
import { montarDia, objetivosDe, tiene, lista, minus, minusNombre, sincronizarDosis, contextoDia, valePrincipal, dosis, porQueEjercicio, tiempoEj, tiempoSesionExacto, riesgoHoy } from './dia.js';

const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];
const PEQUEÑOS = ['biceps', 'triceps', 'gemelo', 'core'];
// Zonas en las que la piscina descarga (cardio sin impacto).
const ZONAS_CARGA = ['cadera_lateral', 'rodilla', 'lumbar', 'tobillo_pie'];

// ── C-VOL-1 · Series semanales por músculo grande, por nivel ──
// banda, techo y máximo por sesión y músculo (series directas).
const VOLUMEN = { 1: { banda: [6, 10], techo: 12, sesion: 6 }, 2: { banda: [10, 14], techo: 16, sesion: 8 }, 3: { banda: [12, 18], techo: 20, sesion: 10 } };
// C-VOL-4 · Mapa zona → músculos (lumbar, dorsal y cervical: se cambia el tipo de ejercicio, no el volumen).
const MUSCULOS_ZONA = { cadera_lateral: ['gluteo'], rodilla: ['cuadriceps'], tobillo_pie: ['gemelo'], hombro: ['hombro', 'pecho'], codo: ['biceps', 'triceps'], 'muñeca': ['biceps', 'triceps'] };

// Volumen objetivo de la semana: { m: { min, techo } } para cada músculo con límites.
export function volumenObjetivo(S) {
  const nivel = Math.min(3, Math.max(1, +S.perfil.nivel || 1));
  const v = VOLUMEN[nivel], [lo, hi] = v.banda;
  const prin = objetivosDe(S)[0];
  // Dentro de la banda: músculo, mitad alta; fuerza y perder grasa, mitad; salud, resistencia y nadar mejor, mitad baja.
  const min = prin === 'musculo' ? Math.round(lo + (hi - lo) * 0.75) : prin === 'fuerza' || prin === 'perder' ? Math.round((lo + hi) / 2) : lo;
  const techo = nivel === 2 && prin === 'musculo' ? 18 : v.techo;
  const out = {};
  GRANDES.forEach(m => { out[m] = { min, techo }; });
  // C-VOL-3 · Bíceps, tríceps y gemelo: directas 0-6 (principiante) y 4-10 (resto). Core: 4-10.
  ['biceps', 'triceps', 'gemelo'].forEach(m => { out[m] = { min: 0, techo: nivel === 1 ? 6 : 10 }; });
  out.core = { min: 0, techo: 10 };
  // C-VOL-4 y C-DOLOR-1 · Banda de cada zona con el dolor de ficha, como mucho B2 (C-DOLOR-0); en lesión
  // nueva, dolor 2-3 cuenta como B2 (C-LES-2).
  (S.perfil.lesiones || []).filter(l => l.activa).forEach(l => {
    const d = +l.dolor || 0, nueva = lesionNueva(S, l.zona);
    const banda = d >= 4 || (nueva && d >= 2) ? 2 : d >= 1 ? 1 : 0;
    (MUSCULOS_ZONA[l.zona] || []).forEach(m => {
      if (banda === 1) out[m].techo = Math.min(out[m].techo, nivel === 1 ? 8 : VOLUMEN[nivel - 1].techo);
      if (banda === 2) { // −50 % de la banda
        const [bl, bh] = GRANDES.includes(m) ? v.banda : [0, out[m].techo];
        out[m].techo = Math.min(out[m].techo, Math.floor(bh / 2)); out[m].min = Math.floor(bl / 2);
      }
      out[m].min = Math.min(out[m].min, out[m].techo);
    });
  });
  return { nivel, banda: v.banda, sesion: v.sesion, musculos: out };
}

// Series de la semana por músculo: directas (músculo en `m`) × 1 e indirectas (en `s`) × 0,5. Solo ejercicios
// principales: no cuentan rehabilitación, cardio ni calentamiento.
export function volumenSemana(dias) {
  const vol = {};
  dias.forEach(d => (d.ejercicios || []).filter(x => x.rol === 'principal').forEach(x => {
    const e = ex(x.id); if (!e) return;
    e.m.forEach(m => { vol[m] = (vol[m] || 0) + x.series; });
    (e.s || []).forEach(m => { vol[m] = (vol[m] || 0) + x.series / 2; });
  }));
  return vol;
}
// Series directas de un músculo en un día.
const directas = (d, m) => (d.ejercicios || []).filter(x => x.rol === 'principal' && ex(x.id) && ex(x.id).m.includes(m)).reduce((t, x) => t + x.series, 0);
// Días seguidos en el calendario, también domingo → lunes (el plan se repite cada semana).
const seguido = (a, b) => b === (a % 7) + 1;
// Días del plan que caen justo antes o justo después (en el calendario) de d.
const vecinos = (dias, d) => dias.filter(o => seguido(o.diaSemana, d.diaSemana) || seguido(d.diaSemana, o.diaSemana));
// C-REP-1 · Músculos grandes con ≥ 4 series directas en dos días seguidos. `dias[1]` es el día que se recorta:
// el segundo del par o, en domingo → lunes, el domingo (para no tocar el primer día de la semana).
export function choquesSeguidos(dias) {
  const out = [];
  dias.forEach(a => dias.filter(b => seguido(a.diaSemana, b.diaSemana)).forEach(b => GRANDES.forEach(m => {
    if (directas(a, m) >= 4 && directas(b, m) >= 4) out.push({ m, dias: b.diaSemana === 1 ? [b.diaSemana, a.diaSemana] : [a.diaSemana, b.diaSemana] });
  })));
  return out;
}

// Ajustes por cómo van las cosas (peso, cintura, dolor, constancia). Cambian el plan y se explican.
export function ajustesPorTendencia(S) {
  const t = tendencias(S), out = { cardioExtra: 0, rehabExtra: false, notas: [] };
  // C-ANA-3 y C-ANA-4 · Cardio extra solo con datos suficientes, constancia ≥ 75 % y sin que la cintura baje.
  if (tiene(S, 'perder') && t.peso.suficiente && t.peso.noBaja) {
    if (t.cintura.baja) out.notas.push(`Tu peso no baja, pero la cintura sí (${es(t.cintura.cambio)} cm): vas bien, no cambio el cardio.`);
    else if (t.constancia != null && t.constancia >= 75) { out.cardioExtra = 5; out.notas.push(`Tu peso no ha bajado en ${t.peso.dias} días (${t.peso.cambio >= 0 ? '+' : ''}${es(t.peso.cambio)} kg): subo 5 minutos el cardio. Revisa también la comida.`); }
    else out.notas.push('Tu peso no baja, pero antes de añadir cardio toca cumplir las sesiones previstas.');
  }
  // C-ANA-6 · Pérdida de más de un 1 % por semana durante 3 semanas.
  if (t.perdidaRapida) out.notas.push('Estás bajando más de un 1 % de tu peso por semana: prioriza la fuerza y come algo más para no perder músculo.');
  const sube = t.dolor.filter(d => d.tendencia === 'sube');
  if (sube.length) { out.rehabExtra = true; out.notas.push(`El dolor de ${lista(sube.map(d => minus(d.nombre)))} ha subido estas dos semanas: más rehabilitación y menos carga en esa zona.`); }
  if (t.constancia != null && t.constancia < 50 && sesionesHechas(S).length >= 4) out.notas.push(`Estas 4 semanas has hecho ${es(t.sesionesPorSemana)} ${+t.sesionesPorSemana === 1 ? 'sesión' : 'sesiones'} por semana de ${S.perfil.disponibilidad.dias} previstas: mejor un plan realista que uno que no se cumple.`);
  return out;
}

// ── C-REP-2 · Repartos de 1 a 6 días (D5) ──
// Días por defecto si no los ha marcado. Principiante con 4 días: L, X, V y S [Decisión 10]. Como mucho 6
// días: siempre al menos 1 de descanso completo.
const HORARIO = {
  1: { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 3, 5, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] },
  2: { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] },
};
const horario = (nivel, n) => HORARIO[nivel === 1 ? 1 : 2][Math.max(1, Math.min(6, n || 3))].slice();
export const diasPorDefecto = S => {
  const d = S.perfil.disponibilidad;
  return d.diasSemana.length ? d.diasSemana.slice().sort((a, b) => a - b).slice(0, 6) : horario(+S.perfil.nivel || 1, d.dias || 3);
};

// Elige k de los días (índices) sin días de calendario seguidos si se puede; a igualdad, los primeros.
function repartirSinSeguidos(dias, k) {
  let mejor = null;
  const prueba = (desde, sel) => {
    if (sel.length === k) {
      const seguidos = sel.filter((i, j) => j && dias[i] - dias[sel[j - 1]] === 1).length;
      if (!mejor || seguidos < mejor.seguidos) mejor = { sel: sel.slice(), seguidos };
      return;
    }
    for (let i = desde; i < dias.length; i++) prueba(i + 1, [...sel, i]);
  };
  prueba(0, []);
  return mejor ? mejor.sel : [];
}
// Tipo de cada día (en orden). Día «suave»: cardio, core y movilidad.
function reparto(S, dias) {
  const n = dias.length, nivel = +S.perfil.nivel || 1;
  const soloSalud = objetivosDe(S).every(o => o === 'salud' || o === 'natacion');
  if (soloSalud) {
    if (nivel === 1 && n > 4) { // principiante: como mucho 4 días de fuerza
      const sel = repartirSinSeguidos(dias, 4); let j = 0;
      return dias.map((_, i) => (sel.includes(i) ? (j++ % 2 ? 'fullA' : 'salud') : 'suave'));
    }
    return Array.from({ length: n }, (_, i) => (i % 2 ? 'fullA' : 'salud'));
  }
  const full = ['fullA', 'fullB', 'fullC'];
  if (n <= 3) return full.slice(0, n); // C-REP-3: con 3 días, cuerpo completo × 3 para todos los niveles
  if (nivel === 1) {
    if (n === 4) return ['fullA', 'fullB', 'fullA', 'fullB'];
    // Principiante: como mucho 4 días de fuerza; con 5 o 6, cuerpo completo × 3 y días suaves alternos.
    const sel = repartirSinSeguidos(dias, 3);
    let j = 0;
    return dias.map((_, i) => (sel.includes(i) ? full[j++] : 'suave'));
  }
  if (n === 4) return ['torso', 'pierna', 'torso', 'pierna'];
  if (n === 5) return ['torso', 'pierna', 'suave', 'torso', 'pierna'];
  return ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna'];
}

// C-REP-6 · Días de piscina (fuente única; C-OBJ-2 remite aquí).
function diasPiscina(S, n, lugares) {
  if (!lugares.includes('piscina')) return 0;
  if (lugares.length === 1) return n;
  const objs = objetivosDe(S);
  if (objs[0] === 'natacion') return n >= 4 ? 2 : n >= 2 ? 1 : 0;
  if (objs.includes('natacion') && n >= 3) return 1;
  const carga = S.perfil.lesiones.some(l => l.activa && ZONAS_CARGA.includes(l.zona));
  if (n >= 3 && (carga || tiene(S, 'perder') || tiene(S, 'resistencia') || tiene(S, 'salud'))) return 1;
  return 0;
}
// Coloca la piscina en los días suaves o detrás de un día de pierna (o de cuerpo completo).
function conPiscina(S, dias, nPisc) {
  if (!nPisc) return reparto(S, dias);
  if (nPisc >= dias.length) return dias.map(() => 'piscina');
  let tipos = reparto(S, dias);
  let quedan = nPisc;
  tipos = tipos.map(t => (t === 'suave' && quedan > 0 ? (quedan--, 'piscina') : t));
  if (!quedan) return tipos;
  // Sin días suaves libres: reparto para los días de seco y la piscina detrás de pierna.
  const seco = reparto(S, dias.slice(0, dias.length - quedan));
  const out = [];
  for (let i = 0; i < dias.length; i++) {
    const tras = i > 0 && /pierna|full/.test(out[i - 1]) && dias[i] - dias[i - 1] === 1;
    if (quedan > 0 && (dias.length - i <= quedan || tras || !seco.length)) { out.push('piscina'); quedan--; } else out.push(seco.shift() || 'suave');
  }
  return out;
}

// Día suave (C-REP-2): cardio continuo a ritmo cómodo, core y movilidad. No lleva ejercicios de fuerza
// (rol «principal»): la movilidad va en el calentamiento y el core suave antes de los estiramientos.
function diaSuave(S, { lugar, minutos, k, usados, extraCardio }) {
  const d = montarDia(S, { lugar, minutos, tipo: 'suave', huecos: ['core', 'core'], k, usados, futuro: true });
  const niveles = nivelesZona(S.perfil);
  const pool = disponibles(S.perfil, lugar).filter(e => riesgo(e, niveles) === 'ok');
  const core = d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id));
  d.ejercicios = d.ejercicios.filter(x => x.rol !== 'principal');
  pool.filter(e => e.m[0] === 'movilidad' && !d.calentamiento.some(t => t.id === e.id)).sort((a, b) => a.niv - b.niv || a.id.localeCompare(b.id)).slice(k % 2, (k % 2) + 2)
    .forEach(e => d.calentamiento.push({ id: e.id, nombre: e.n, detalle: `${e.d[0]} × ${e.d[1]}, lento y sin dolor.`, duracion: '2 min' }));
  d.vuelta.unshift(...core.map(x => ({ id: x.id, nombre: ex(x.id).n, detalle: `Core suave: ${x.series} × ${x.reps}, descanso ${x.descanso} s.`, duracion: '4 min' })));
  const min = Math.max(15, Math.min(45, (+minutos || 45) - 25)) + (extraCardio || 0);
  const nota = `${min} min a ritmo cómodo: puedes hablar con frases completas.`;
  const hay = d.ejercicios.find(x => x.rol === 'cardio');
  if (hay) Object.assign(hay, { reps: `${min} min`, nota });
  else {
    const c = pool.filter(e => e.m[0] === 'cardio' && e.t === 'tiempo').sort((a, b) => a.niv - b.niv || a.id.localeCompare(b.id))[k % 2] || pool.find(e => e.m[0] === 'cardio' && e.t === 'tiempo');
    if (c) d.ejercicios.push({ id: c.id, rol: 'cardio', series: 1, reps: `${min} min`, descanso: 0, nota });
  }
  d.nombre = 'Día suave'; d.tipo = 'suave'; d.foco = 'Cardio suave, core y movilidad';
  d.explicacion = ['Día suave: cardio a ritmo cómodo, core y movilidad para recuperar entre los días de fuerza.', ...d.explicacion.slice(1).filter(t => !/^Cuerpo completo|^Dosis/.test(t))];
  return d;
}

// Generar los días con unos tipos dados.
function generar(S, dias, tipos, { minutos, seco, t }) {
  const usados = {};
  return dias.map((d, i) => {
    const tipo = tipos[i];
    const lugar = tipo === 'piscina' ? 'piscina' : seco;
    const op = { lugar, minutos, k: i, usados, futuro: true, extraCardio: t.cardioExtra, rehabExtra: t.rehabExtra };
    const dia = tipo === 'suave' ? diaSuave(S, op) : montarDia(S, { ...op, tipo });
    return { diaSemana: d, ...dia, nombre: dia.nombre };
  });
}

// Ningún principal por debajo de 2 series al recortar (C-DOSIS-2, C-DOSIS-3, C-TIEMPO-2: «mínimo 2», S9): si así no
// se respeta el techo, fuera el ejercicio entero.
const minSeries = () => 2;
// Quita series del músculo m en el día d hasta dejar menos de `tope` directas (C-REP-1).
function recortarDia(d, m, tope) {
  const conM = () => d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id) && ex(x.id).m.includes(m));
  while (directas(d, m) > tope) {
    const c = conM().filter(x => x.series > minSeries(ex(x.id))).sort((a, b) => b.series - a.series)[0];
    if (c) { c.series--; continue; }
    const quitar = conM().pop(); if (!quitar) break;
    d.ejercicios.splice(d.ejercicios.indexOf(quitar), 1);
  }
}

// Series por ejercicio hasta las que puede llegar el relleno de volumen (C-DOSIS-2 y C-VOL-1, decisión D-B de
// Víctor del 21-11-2026): principiante 3, intermedio y avanzado 4. Si con eso no se llega a la banda, se añade
// otro ejercicio del mismo músculo (añadirEjercicio) en vez de más series.
export const topeRelleno = nivel => topeSeries(nivel);
// Otro principal del músculo m en un día de seco (D-B): de su nivel, sin riesgo en una zona activa, que quepa
// en los minutos del día y sin pasar el máximo por sesión, el techo semanal ni crear un choque de C-REP-1.
function añadirEjercicio(S, out, d, m, obj, vol) {
  if (d.lugar === 'piscina' || d.tipo === 'suave') return false;
  const ctx = contextoDia(S, { lugar: d.lugar, minutos: d.minutos, futuro: true });
  const enSemana = new Set(out.flatMap(o => o.ejercicios.map(x => x.id)));
  const cand = ctx.pool.filter(e => valePrincipal(S, e, ctx, m) && e.niv <= ctx.nivel && !d.ejercicios.some(x => x.id === e.id) && riesgoHoy(e, ctx.niveles, ctx.bandas) === 'ok')
    .sort((a, b) => enSemana.has(a.id) - enSemana.has(b.id) || (b.s || []).length - (a.s || []).length || a.id.localeCompare(b.id));
  const iPrin = d.ejercicios.filter(x => x.rol === 'principal').length;
  for (const e of cand) {
    const dz = dosis(S, e, Math.max(2, iPrin), d.lugar);
    let series = Math.min(dz.series, topeRelleno(obj.nivel), Math.ceil(obj.musculos[m].min - (vol[m] || 0)));
    series = Math.max(2, series);
    if (e.m.some(mm => directas(d, mm) + series > obj.sesion)) continue;
    if ([...e.m, ...(e.s || [])].some(mm => obj.musculos[mm] && (vol[mm] || 0) + series * (e.m.includes(mm) ? 1 : 0.5) > obj.musculos[mm].techo)) continue;
    if (e.m.some(mm => GRANDES.includes(mm) && directas(d, mm) + series >= 4 && vecinos(out, d).some(o => directas(o, mm) >= 4))) continue;
    const x = { id: e.id, rol: 'principal', ...dz, series };
    if (tiempoSesionExacto(d) + tiempoEj(x) > (+d.minutos || 60) * 1.1) return false;
    x.nota = porQueEjercicio(S, e, { i: iPrin, d: x, an: {}, carga: {}, niveles: ctx.niveles, dolorHoy: {} });
    const pos = d.ejercicios.map(y => y.rol).lastIndexOf('principal') + 1;
    d.ejercicios.splice(pos, 0, x);
    return true;
  }
  return false;
}
// C-VOL-1 y C-VOL-2 · Rellena hasta el mínimo y recorta hasta el techo; nunca añade series a un ejercicio con
// r en una zona activa, ni pasa el máximo por sesión, ni crea un choque de C-REP-1.
function ajustarVolumen(S, out, obj, { rellenar = true } = {}) {
  const niveles = nivelesZona(S.perfil);
  const tocaZona = e => Object.keys(e.r || {}).some(z => niveles[z]);
  let vol = volumenSemana(out);
  if (rellenar) {
    GRANDES.forEach(m => {
      for (let guarda = 0; guarda < 40 && (vol[m] || 0) < obj.musculos[m].min; guarda++) {
        const cand = [];
        out.forEach(d => d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id) && ex(x.id).m[0] === m).forEach(x => {
          const e = ex(x.id);
          if (tocaZona(e) || x.series >= topeRelleno(obj.nivel)) return;
          if (e.m.some(mm => directas(d, mm) + 1 > obj.sesion)) return;
          if ([...e.m, ...(e.s || [])].some(mm => obj.musculos[mm] && (vol[mm] || 0) + (e.m.includes(mm) ? 1 : 0.5) > obj.musculos[mm].techo)) return;
          if (e.m.some(mm => GRANDES.includes(mm) && directas(d, mm) + 1 >= 4 && vecinos(out, d).some(o => directas(o, mm) >= 4))) return;
          cand.push(x);
        }));
        const x = cand.sort((a, b) => a.series - b.series)[0];
        if (x) { x.series++; vol = volumenSemana(out); continue; }
        // Todos en su tope de series: otro ejercicio del mismo músculo en el día que menos lleva (D-B).
        const dias0 = out.slice().sort((a, b) => directas(a, m) - directas(b, m) || a.diaSemana - b.diaSemana);
        if (!dias0.some(d => añadirEjercicio(S, out, d, m, obj, vol))) break;
        vol = volumenSemana(out);
      }
    });
  }
  // Techo: quitar series de lo que más aporta, empezando por los últimos días.
  [...GRANDES, ...PEQUEÑOS].forEach(m => {
    if (!obj.musculos[m]) return;
    for (let guarda = 0; guarda < 60 && (vol[m] || 0) > obj.musculos[m].techo; guarda++) {
      const cand = [];
      out.slice().reverse().forEach(d => d.ejercicios.forEach(x => {
        const e = x.rol === 'principal' && ex(x.id);
        if (e && (e.m.includes(m) || (e.s || []).includes(m)) && x.series > minSeries(e)) cand.push({ x, peso: e.m.includes(m) ? 1 : 0.5, otros: e.m.length });
      }));
      // Primero lo que más aporta y solo a este músculo (así no se quita volumen a otro que va justo).
      const c = cand.sort((a, b) => b.peso - a.peso || a.otros - b.otros || b.x.series - a.x.series)[0];
      if (c) { c.x.series--; vol = volumenSemana(out); continue; }
      // Sin series que quitar: fuera el ejercicio que más aporta a este músculo y menos a los demás
      // (C-VOL-2: el techo no se supera nunca).
      const quitar = [];
      out.slice().reverse().forEach(d => d.ejercicios.forEach(x => {
        const e = x.rol === 'principal' && ex(x.id);
        if (e && (e.m.includes(m) || (e.s || []).includes(m))) quitar.push({ d, x, peso: e.m.includes(m) ? 1 : 0.5, otros: e.m.filter(mm => mm !== m).length });
      }));
      // Primero de los días que siguen con 3 principales o más después de quitarlo (C-TIEMPO-2: mínimo 3).
      const q = quitar.sort((a, b) => (nPrin(a.d) > 3 ? 0 : 1) - (nPrin(b.d) > 3 ? 0 : 1) || a.otros - b.otros || b.peso - a.peso || b.x.series - a.x.series)[0];
      if (!q) break;
      q.d.ejercicios.splice(q.d.ejercicios.indexOf(q.x), 1); vol = volumenSemana(out);

    }
  });
  return vol;
}

// Un día de fuerza del plan que se ha quedado con menos de 3 principales (por el techo semanal o por C-REP-1) lleva
// otro de un músculo con sitio en la semana, sin pasar techos, el máximo por sesión ni los minutos, y sin crear
// choques de C-REP-1 (añadirEjercicio lo comprueba). Si ninguno cabe, se queda como está (C-VOL-2 manda).
const nPrin = d => d.ejercicios.filter(x => x.rol === 'principal').length;
function completarPrincipales(S, out, obj) {
  out.filter(d => d.tipo !== 'suave' && d.lugar !== 'piscina').forEach(d => {
    for (let g = 0; g < 3 && nPrin(d) < 3; g++) {
      const vol = volumenSemana(out);
      const conSitio = [...GRANDES, ...PEQUEÑOS].filter(m => obj.musculos[m]).sort((a, b) => (vol[a] || 0) / obj.musculos[a].techo - (vol[b] || 0) / obj.musculos[b].techo);
      if (!conSitio.some(m => añadirEjercicio(S, out, d, m, obj, vol))) break;
    }
  });
}

// semana: { dias [1..7], minutos, lugares }
export function planReglas(S, semana, { hechas = [] } = {}) {
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  const pedidos = [...new Set(semana.dias)].sort((a, b) => a - b);
  const dias = pedidos.slice(0, 6); // siempre al menos 1 día de descanso completo
  const seco = lugares.find(l => l !== 'piscina') || lugares[0];
  const soloPiscina = seco === 'piscina';
  const nPisc = soloPiscina ? dias.length : Math.min(diasPiscina(S, dias.length, lugares), dias.length);
  const t = ajustesPorTendencia(S);
  const nivel = +S.perfil.nivel || 1;
  const gen = tipos => generar(S, dias, tipos, { minutos: semana.minutos, seco, t });
  let tipos = conPiscina(S, dias, nPisc);
  let out = gen(tipos);
  const notas = [];
  // C-REP-2 · Si la persona elige días seguidos y el reparto choca con C-REP-1: 1) el principiante con 4 días
  // pasa a torso / pierna × 2; 2) si no basta, un día suave en medio; 3) si tampoco, el día siguiente no repite
  // el músculo cargado (se recortan sus series).
  const porDefecto = dias.join() === horario(nivel, dias.length).join();
  if (!porDefecto && choquesSeguidos(out).length) {
    const fuerza = tipos.filter(x => /full|torso|pierna|empuje|tiron|salud/.test(x)).length;
    if (nivel === 1 && fuerza === 4 && tipos.every(x => /full|piscina/.test(x))) {
      let j = 0; tipos = tipos.map(x => (x === 'piscina' ? x : ['torso', 'pierna'][j++ % 2])); out = gen(tipos);
      notas.push('Con tus días seguidos, torso y pierna alternos para no repetir músculo dos días seguidos.');
    }
    const ch = choquesSeguidos(out)[0];
    if (ch && tipos.filter(x => !/suave|piscina/.test(x)).length > 2) {
      const i = dias.indexOf(ch.dias[1]);
      tipos = tipos.map((x, k) => (k === i ? 'suave' : x)); out = gen(tipos);
      notas.push(`El ${minus(DIAS[ch.dias[1]])} pasa a día suave para no cargar dos días seguidos lo mismo.`);
    }
  }
  // Volumen semanal y descarga.
  const obj = volumenObjetivo(S);
  const desc = semanaDescarga(S);
  ajustarVolumen(S, out, obj, { rellenar: !desc.toca });
  // C-REP-1 · Barrera final: ningún músculo grande con ≥ 4 series directas en dos días seguidos.
  for (let g = 0; g < 20; g++) { const ch = choquesSeguidos(out)[0]; if (!ch) break; recortarDia(out.find(d => d.diaSemana === ch.dias[1]), ch.m, 3); }
  // C-DESCARGA-1 · Mismos ejercicios y peso, series −50 %, margen 4, cardio continuo con sus minutos.
  if (desc.toca) {
    out.forEach(d => {
      d.ejercicios.forEach(x => {
        const e = ex(x.id); if (!e) return;
        if (x.rol === 'principal') { x.series = seriesDescarga(e, x.series); x.nota = [x.nota, 'Semana de descarga: deja 4 repeticiones de margen.'].filter(Boolean).join(' '); }
        if (x.rol === 'cardio' && /intervalo/i.test(x.nota || '')) x.nota = String(x.nota).replace(/Intervalos[^.]*\./i, 'Ritmo constante y cómodo (zona 2), sin intervalos esta semana.');
      });
      d.explicacion = ['Semana de descarga: mismos ejercicios y pesos, la mitad de series y 4 repeticiones de margen.', ...d.explicacion];
    });
  }
  // La vista previa del plan pasa por las mismas reglas que la sesión del día (verificación final del 22-11-2026):
  // el volumen, C-REP-1, el día suave y la descarga tocan los días después de montarlos, así que cada día se vuelve a
  // validar (tiempo C-TIEMPO-1/2, tareas del lugar C-EST-4…), sin rellenar principales para no pasar el techo semanal
  // (C-VOL-2). Los cambios no se repiten en la explicación: ya los dirá el check-in de ese día.
  out.forEach((d, i) => {
    const v = validarSesion(S, d, { lugar: d.lugar, minutos: d.minutos, futuro: true, origen: 'plan', k: i, tipo: d.tipo, vistaPrevia: true });
    Object.assign(d, { calentamiento: v.sesion.calentamiento, ejercicios: v.sesion.ejercicios, vuelta: v.sesion.vuelta, explicacion: v.sesion.explicacion });
  });
  // El repaso puede cambiar algún ejercicio: el techo semanal y C-REP-1 vuelven a mandar (C-VOL-2: nunca se pasa).
  ajustarVolumen(S, out, obj, { rellenar: false });
  for (let g = 0; g < 20; g++) { const ch = choquesSeguidos(out)[0]; if (!ch) break; recortarDia(out.find(d => d.diaSemana === ch.dias[1]), ch.m, 3); }
  completarPrincipales(S, out, obj);
  out.forEach(sincronizarDosis);
  const vol = volumenSemana(out);
  const hechasTxt = hechas.length ? ` Ya llevas ${hechas.length} sesión${hechas.length > 1 ? 'es' : ''} esta semana y lo que queda lo tiene en cuenta.` : '';
  const zonas = S.perfil.lesiones.filter(l => l.activa).map(l => (ZONAS[l.zona] || {}).corta).filter(Boolean);
  const [lo, hi] = obj.banda;
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'reglas',
    resumen: `${resumenDias(out)}${hechasTxt} Cada día se ajusta a tu check-in.`,
    criterios: [
      desc.toca && desc.motivo,
      `Reparto para ${dias.length} días y tus objetivos (${lista(objetivosDe(S).map(o => minus(OBJETIVOS[o].nombre)))}), con al menos 48 h entre sesiones que cargan el mismo músculo grande.`,
      pedidos.length > dias.length && 'Como mucho 6 días: siempre queda al menos un día de descanso completo.',
      ...notas,
      out.some(d => d.lugar !== 'piscina') && `Volumen semanal (series): ${GRANDES.map(m => `${minus(MUSCULOS[m])} ${Math.round(vol[m] || 0)}`).join(', ')}. Para tu nivel: ${lo}-${hi}, sin pasar de ${obj.musculos.pecho.techo}.`,
      zonas.length ? `Lesiones (${lista(zonas.map(minus))}): fuera lo que las carga y rehabilitación en cada sesión.` : '',
      (() => { const np = out.filter(d => d.lugar === 'piscina').length; return np ? `Piscina ${np} día${np > 1 ? 's' : ''}: ${tiene(S, 'natacion') ? 'técnica y resistencia en el agua' : 'cardio y trabajo sin impacto'}.` : ''; })(),
      ...t.notas,
    ].filter(Boolean).join(' '),
    progresion: 'Doble progresión: cuando llegues al tope de repeticiones en todas las series, la app te sube el paso mínimo de peso. Si un ejercicio lleva 4 sesiones sin mejorar, se cambia por una variante. Tras 5 semanas constantes (8 si empiezas), una semana de descarga con la mitad de series.',
    dias: out.map(d => ({ diaSemana: d.diaSemana, nombre: d.nombre, foco: d.foco, lugar: d.lugar, minutos: d.minutos, tipo: d.tipo, explicacion: d.explicacion, calentamiento: d.calentamiento, ejercicios: d.ejercicios, vuelta: d.vuelta })),
    hechos: {},
  };
}

// ── Estado de la semana ──
export const planDeLaSemana = S => (S.plan && S.plan.semana === semanaISO() ? S.plan : null);
function lunesISO() { const h = new Date(); h.setDate(h.getDate() - diaSemana(h) + 1); return hoyISO(h); }
// Estado de cada día del plan: 'hecho' | 'hoy' | 'pendiente' | 'saltado' | 'noPuedo' (dijo «Hoy no puedo»).
// Una sesión solo marca un día: primero los días enlazados en `hechos`; después, una sesión hecha ese mismo día
// que no esté enlazada a ningún otro.
export function estadoDias(S) {
  const p = planDeLaSemana(S); if (!p) return [];
  const hoy = diaSemana(), lunes = lunesISO();
  // Una de «Mis sesiones» solo cuenta como día del plan si se enlazó al hacerla («Cuenta como el día X»).
  const hechasSemana = sesionesHechas(S).filter(s => s.fecha >= lunes && !(s.origen && s.origen.tipo === 'mia'));
  const enlazadas = {};
  Object.entries(p.hechos || {}).forEach(([d, id]) => { if (S.sesiones[id] && S.sesiones[id].estado === 'hecha' && !Object.values(enlazadas).includes(id)) enlazadas[d] = id; });
  const usadas = new Set(Object.values(enlazadas));
  return p.dias.map(d => {
    const id = enlazadas[d.diaSemana];
    let hecha = id ? S.sesiones[id] : null;
    if (!hecha) {
      const f = new Date(lunes + 'T12:00'); f.setDate(f.getDate() + d.diaSemana - 1);
      hecha = hechasSemana.find(s => s.fecha === hoyISO(f) && !usadas.has(s.id)) || null;
      if (hecha) usadas.add(hecha.id);
    }
    // «Hoy no puedo» sin otro día libre: el día queda apuntado como que no se puede (E13).
    const noPuede = !hecha && (p.noPuedo || []).includes(d.diaSemana) && d.diaSemana <= hoy;
    return { ...d, estado: hecha ? 'hecho' : noPuede ? 'noPuedo' : d.diaSemana === hoy ? 'hoy' : d.diaSemana < hoy ? 'saltado' : 'pendiente', sesion: hecha ? hecha.id : null };
  });
}
// El día que toca hoy: el de hoy si lo hay; si no, nada (se puede adelantar el siguiente).
export function planDeHoy(S) {
  const d = estadoDias(S).find(x => x.estado === 'hoy');
  return d || null;
}
// El día del plan que se va a hacer: el que se elige (diaSemana) o, si no se elige ninguno, el de hoy.
export const diaElegido = (S, diaPlan) => (diaPlan != null ? (planDeLaSemana(S) || { dias: [] }).dias.find(d => d.diaSemana === diaPlan) || null : planDeHoy(S));
export const siguientePendiente = S => estadoDias(S).find(x => x.estado === 'pendiente') || estadoDias(S).find(x => x.estado === 'saltado') || null;

// ── Reorganizar lo que queda de semana (día perdido, menos días, «hoy no puedo») ──
// libres: días que aún puede entrenar (>= hoy). Mueve los pendientes en orden; si no caben, los rehace.
// Sin ningún día libre no se borra nada: el plan sigue igual y se dice.
// quitarHoy: viene de «Hoy no puedo»; si no queda ningún día libre, se apunta que hoy no se entrena (E13).
// «2 días: lunes (Cuerpo completo A) y jueves (Cuerpo completo B).»
const resumenDias = dias => `${dias.length} día${dias.length === 1 ? '' : 's'}: ${lista(dias.map(d => `${minus(DIAS[d.diaSemana])} (${d.nombre})`))}.`;
export function reorganizar(libres, { quitarHoy = false } = {}) {
  const S = estado(), p = planDeLaSemana(S); if (!p) return null;
  const hoy = diaSemana();
  const est = estadoDias(S);
  const hechos = est.filter(d => d.estado === 'hecho');
  const pendientes = est.filter(d => d.estado !== 'hecho');
  libres = (libres || []).filter(d => d >= hoy && !hechos.some(h => h.diaSemana === d) && !(quitarHoy && d === hoy)).sort((a, b) => a - b);
  if (!libres.length && quitarHoy && est.some(d => d.estado === 'hoy')) return noPuedoHoy();
  if (!libres.length) return pendientes.length ? 'No queda ningún día libre esta semana: dejo el plan como está.' : 'Ya has hecho todos los días de esta semana.';
  let nuevos, nota;
  if (pendientes.length <= libres.length) {
    nuevos = pendientes.map((d, i) => ({ ...d, diaSemana: libres[i], ejercicios: d.ejercicios.map(x => ({ ...x })) }));
    // C-REP-1 también al mover días: el que queda detrás no repite el músculo cargado.
    for (let g = 0; g < 20; g++) {
      const ch = choquesSeguidos([...hechos, ...nuevos])[0]; if (!ch) break;
      const d = nuevos.find(x => x.diaSemana === ch.dias[1]) || nuevos.find(x => x.diaSemana === ch.dias[0]); if (!d) break;
      recortarDia(d, ch.m, 3);
    }
    const mov = pendientes.map((d, i) => [d, libres[i]]).filter(([d, n]) => d.diaSemana !== n);
    nota = mov.length ? `Muevo ${lista(mov.map(([d, n]) => `${minus(DIAS[d.diaSemana])} (${minusNombre(d.nombre)}) al ${minus(DIAS[n])}`))}.` : 'Todo sigue en su día.';
  } else {
    // No caben: con los días que quedan, cuerpo completo priorizando lo que aún no se ha trabajado esta semana.
    const trabajado = new Set(hechos.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id)).map(x => ex(x.id).m[0])));
    const faltan = GRANDES.filter(m => !trabajado.has(m));
    const huecos = [...faltan, ...GRANDES.filter(m => trabajado.has(m)), 'core'];
    const usados = {};
    nuevos = libres.map((d, i) => {
      const lugar = pendientes[i] ? pendientes[i].lugar : (S.perfil.lugares.find(l => l !== 'piscina') || S.perfil.lugares[0]);
      const dia = montarDia(S, { lugar, minutos: (pendientes[0] && pendientes[0].minutos) || S.perfil.disponibilidad.minutos, tipo: lugar === 'piscina' ? 'piscina' : 'fullA', huecos: lugar === 'piscina' ? null : huecos, k: i + 3, usados, futuro: true });
      return { diaSemana: d, nombre: libres.length === 1 ? 'Cuerpo completo (resumen de la semana)' : dia.nombre, foco: dia.foco, lugar, minutos: dia.minutos, tipo: 'fullA', explicacion: [`Rehecho al reorganizar la semana: prioriza ${lista(faltan.map(m => minus(MUSCULOS[m])))}, que aún no has trabajado.`, ...dia.explicacion], calentamiento: dia.calentamiento, ejercicios: dia.ejercicios, vuelta: dia.vuelta };
    });
    // C-REP-1 también al rehacer: el día siguiente no repite el músculo cargado.
    for (let g = 0; g < 20; g++) { const ch = choquesSeguidos([...hechos, ...nuevos])[0]; if (!ch) break; const d = nuevos.find(x => x.diaSemana === ch.dias[1]) || nuevos.find(x => x.diaSemana === ch.dias[0]); if (!d) break; recortarDia(d, ch.m, 3); }
    nota = `Quedaban ${pendientes.length} días y puedes ${libres.length}: lo junto en ${libres.length === 1 ? 'una sesión de cuerpo completo' : 'sesiones de cuerpo completo'} priorizando ${lista(faltan.map(m => minus(MUSCULOS[m]))) || 'lo más importante'}.`;
  }
  nuevos.forEach(sincronizarDosis);
  cambiar(S2 => {
    const pl = S2.plan;
    pl.dias = [...hechos.map(d => p.dias.find(x => x.diaSemana === d.diaSemana) || d), ...nuevos.map(({ estado: _e, sesion: _s, ...d }) => d)].sort((a, b) => a.diaSemana - b.diaSemana);
    pl.cambios = [...(pl.cambios || []), { fecha: new Date().toISOString(), texto: nota }];
    // El resumen nombraba los días de antes (M15 del informe del 21-11): ahora dice los de ahora y lo que cambió.
    pl.resumen = `${resumenDias(pl.dias)} ${nota} Cada día se ajusta a tu check-in.`;
    delete pl.iaFallo; // reorganizada a mano: «Reintentar con IA» ya no la pisaría (PR 12)
  }, 'plan');
  return nota;
}

// «Hoy no puedo» sin ningún otro día libre esta semana: no se mueve nada, pero queda apuntado que hoy no se
// entrena (Hoy deja de decir «Hoy toca») y se dice (E13). Si luego entrena igualmente, el día cuenta como hecho.
export function noPuedoHoy() {
  const S = estado(), p = planDeLaSemana(S); if (!p) return null;
  const hoy = diaSemana();
  const d = estadoDias(S).find(x => x.diaSemana === hoy && x.estado === 'hoy');
  if (!d) return null;
  const quedan = estadoDias(S).some(x => x.diaSemana > hoy && x.estado === 'pendiente');
  const texto = `Apuntado: hoy (${minus(DIAS[hoy])}) no entrenas «${d.nombre}». ${quedan ? 'Lo demás sigue en su día.' : 'No quedan más días esta semana: el lunes montas la semana nueva.'}`;
  cambiar(S2 => {
    const pl = S2.plan;
    pl.noPuedo = [...new Set([...(pl.noPuedo || []), hoy])].sort((a, b) => a - b);
    pl.cambios = [...(pl.cambios || []), { fecha: new Date().toISOString(), texto }];
  }, 'plan');
  return texto;
}
