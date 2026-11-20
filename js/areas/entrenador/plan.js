// Área ENTRENADOR · la semana con reglas: reparto de días, plan semanal sin IA, estado de cada día
// y reorganizar lo que queda cuando se pierde un día.

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { es } from '../../nucleo/ui.js';
import { semanaISO, diaSemana } from '../../nucleo/modelo.js';
import { tendencias } from '../../reglas/contexto.js';
import { sesionesHechas } from '../../reglas/progresion.js';
import { ex, ZONAS } from '../../reglas/catalogo.js';
import { MUSCULOS, OBJETIVOS, DIAS } from '../../datos/constantes.js';
import { montarDia, objetivosDe, tiene, lista, minus } from './dia.js';

// Volumen semanal orientativo por músculo grande (series), según objetivo.
const VOLUMEN = { musculo: [10, 16], fuerza: [8, 12], perder: [8, 12], resistencia: [6, 10], salud: [4, 8], natacion: [4, 8] };
const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];
// Zonas en las que la piscina descarga (cardio sin impacto).
const ZONAS_CARGA = ['cadera_lateral', 'rodilla', 'lumbar', 'tobillo_pie'];


// Ajustes por cómo van las cosas (peso, dolor, constancia). Cambian el plan y se explican.
export function ajustesPorTendencia(S) {
  const t = tendencias(S), out = { cardioExtra: 0, rehabExtra: false, notas: [] };
  if (tiene(S, 'perder') && t.cambioPeso4sem != null && t.cambioPeso4sem >= 0) {
    out.cardioExtra = 5; out.notas.push(`Tu peso no ha bajado en 4 semanas (${t.cambioPeso4sem >= 0 ? '+' : ''}${es(t.cambioPeso4sem)} kg): subo 5 minutos el cardio. Revisa también la nutrición.`);
  }
  if (tiene(S, 'perder') && t.cambioPeso4sem != null && t.cambioPeso4sem < -3) out.notas.push(`Has bajado ${es(-t.cambioPeso4sem)} kg en 4 semanas: es rápido; prioriza la fuerza para no perder músculo.`);
  const sube = t.dolor.filter(d => d.tendencia === 'sube');
  if (sube.length) { out.rehabExtra = true; out.notas.push(`El dolor de ${lista(sube.map(d => minus(d.nombre)))} ha subido estas dos semanas: más rehabilitación y menos carga en esa zona.`); }
  if (t.constancia < 50 && sesionesHechas(S).length >= 4) out.notas.push(`Estas 4 semanas has hecho ${es(t.sesionesPorSemana)} sesiones por semana de ${S.perfil.disponibilidad.dias} previstas: mejor un plan realista que uno que no se cumple.`);
  return out;
}

// ── Reparto de la semana ──
function reparto(S, n) {
  const nivel = S.perfil.nivel || 1;
  const soloSalud = objetivosDe(S).every(o => o === 'salud' || o === 'natacion');
  if (soloSalud) return Array.from({ length: n }, (_, i) => (i % 2 ? 'fullA' : 'salud'));
  if (n <= 3) return (nivel >= 2 && n === 3 && S.perfil.lugares.includes('gym') && !tiene(S, 'perder') && (tiene(S, 'musculo') || tiene(S, 'fuerza'))) ? ['empuje', 'pierna', 'tiron'] : ['fullA', 'fullB', 'fullC'].slice(0, n);
  if (n === 4) return ['torso', 'pierna', 'torso', 'pierna'];
  if (n === 5) return ['torso', 'pierna', 'fullA', 'torso', 'pierna'];
  return ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna', 'fullB'].slice(0, n);
}
// Qué días de la semana, si no los ha marcado: repartidos con descanso.
const HORARIO = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
export const diasPorDefecto = S => { const d = S.perfil.disponibilidad; return d.diasSemana.length ? d.diasSemana.slice() : HORARIO[Math.max(1, Math.min(7, d.dias || 3))].slice(); };

// ¿Cuándo va a la piscina? Si nada, si tiene lesiones de carga o busca cardio, y hay 4 días o más.
function diasPiscina(S, n, lugares) {
  if (!lugares.includes('piscina')) return 0;
  const carga = S.perfil.lesiones.some(l => l.activa && ZONAS_CARGA.includes(l.zona));
  if (tiene(S, 'natacion')) return n >= 4 ? 2 : 1;
  if (lugares.length === 1) return n;
  if (n >= 4 && (carga || tiene(S, 'perder') || tiene(S, 'resistencia') || tiene(S, 'salud'))) return 1;
  return 0;
}

// semana: { dias [1..7], minutos, lugares }
export function planReglas(S, semana, { hechas = [] } = {}) {
  const lugares = semana.lugares && semana.lugares.length ? semana.lugares : S.perfil.lugares;
  const dias = semana.dias.slice().sort((a, b) => a - b);
  const seco = lugares.find(l => l !== 'piscina') || lugares[0];
  const nPisc = Math.min(diasPiscina(S, dias.length, lugares), dias.length);
  const tipos = reparto(S, dias.length - (seco === 'piscina' ? 0 : nPisc));
  const t = ajustesPorTendencia(S);
  const usados = {};
  const out = [];
  let iSeco = 0;
  dias.forEach((d, i) => {
    // La piscina va al final de la semana (o detrás de un día de pierna), con su propia plantilla.
    const pisc = seco !== 'piscina' && i >= dias.length - nPisc;
    const lugar = pisc ? 'piscina' : seco;
    const tipo = pisc || lugar === 'piscina' ? 'piscina' : tipos[iSeco++ % tipos.length];
    const dia = montarDia(S, { lugar, minutos: semana.minutos, tipo, k: i, usados, futuro: true, extraCardio: t.cardioExtra, rehabExtra: t.rehabExtra });
    out.push({ diaSemana: d, ...dia, nombre: dia.nombre });
  });
  // Volumen semanal por músculo grande (series directas + la mitad de las indirectas).
  const vol = {};
  out.forEach(d => d.ejercicios.filter(x => x.rol === 'principal').forEach(x => { const e = ex(x.id); vol[e.m[0]] = (vol[e.m[0]] || 0) + x.series; (e.s || []).forEach(m => { vol[m] = (vol[m] || 0) + x.series / 2; }); }));
  const objPrin = objetivosDe(S).find(o => VOLUMEN[o]) || 'salud';
  const [lo, hi] = VOLUMEN[objPrin];
  // Si un músculo grande se queda corto, una serie más donde aparece (hasta 5).
  GRANDES.forEach(m => {
    let falta = Math.ceil(lo - (vol[m] || 0));
    out.forEach(d => d.ejercicios.filter(x => x.rol === 'principal' && ex(x.id).m[0] === m).forEach(x => { if (falta > 0 && x.series < 5) { x.series++; falta--; vol[m] = (vol[m] || 0) + 1; } }));
  });
  const hechasTxt = hechas.length ? ` Ya llevas ${hechas.length} sesión${hechas.length > 1 ? 'es' : ''} esta semana y lo que queda lo tiene en cuenta.` : '';
  const zonas = S.perfil.lesiones.filter(l => l.activa).map(l => (ZONAS[l.zona] || {}).corta).filter(Boolean);
  return {
    semana: semanaISO(), creado: new Date().toISOString(), fuente: 'reglas',
    resumen: `${dias.length} días: ${lista(out.map(d => `${DIAS[d.diaSemana].toLowerCase()} (${d.nombre})`))}.${hechasTxt} Cada día se ajusta a tu check-in.`,
    criterios: [
      `Reparto para ${dias.length} días y tus objetivos (${lista(objetivosDe(S).map(o => minus(OBJETIVOS[o].nombre)))}), con 48-72 h entre sesiones que repiten músculo grande.`,
      out.some(d => d.lugar !== 'piscina') && `Volumen semanal (series): ${GRANDES.map(m => `${minus(MUSCULOS[m])} ${Math.round(vol[m] || 0)}`).join(', ')}. Orientativo para tu objetivo: ${lo}-${hi}.`,
      zonas.length ? `Lesiones (${lista(zonas.map(minus))}): fuera lo que las carga y rehabilitación en cada sesión.` : '',
      (() => { const np = out.filter(d => d.lugar === 'piscina').length; return np ? `Piscina ${np} día${np > 1 ? 's' : ''}: ${tiene(S, 'natacion') ? 'técnica y resistencia en el agua' : 'cardio y trabajo sin impacto'}.` : ''; })(),
      ...t.notas,
    ].filter(Boolean).join(' '),
    progresion: 'Doble progresión: cuando llegues al tope de repeticiones en todas las series, la app te sube el peso mínimo. Si un ejercicio se estanca 3 sesiones, se cambia por una variante. Cada 5-6 semanas, una semana de descarga con la mitad de series.',
    dias: out.map(d => ({ diaSemana: d.diaSemana, nombre: d.nombre, foco: d.foco, lugar: d.lugar, minutos: d.minutos, tipo: d.tipo, explicacion: d.explicacion, calentamiento: d.calentamiento, ejercicios: d.ejercicios, vuelta: d.vuelta })),
    hechos: {},
  };
}

// ── Estado de la semana ──
export const planDeLaSemana = S => (S.plan && S.plan.semana === semanaISO() ? S.plan : null);
function lunesISO() { const h = new Date(); h.setDate(h.getDate() - diaSemana(h) + 1); return hoyISO(h); }
// Estado de cada día del plan: 'hecho' | 'hoy' | 'pendiente' | 'saltado'.
export function estadoDias(S) {
  const p = planDeLaSemana(S); if (!p) return [];
  const hoy = diaSemana(), lunes = lunesISO();
  const hechasSemana = sesionesHechas(S).filter(s => s.fecha >= lunes);
  const usadas = new Set();
  return p.dias.map(d => {
    const id = (p.hechos || {})[d.diaSemana];
    let hecha = id && S.sesiones[id] && S.sesiones[id].estado === 'hecha' ? S.sesiones[id] : null;
    if (!hecha) { // sesión hecha ese mismo día aunque no saliera del plan
      const f = new Date(lunes); f.setDate(f.getDate() + d.diaSemana - 1);
      hecha = hechasSemana.find(s => s.fecha === hoyISO(f) && !usadas.has(s.id)) || null;
    }
    if (hecha) usadas.add(hecha.id);
    return { ...d, estado: hecha ? 'hecho' : d.diaSemana === hoy ? 'hoy' : d.diaSemana < hoy ? 'saltado' : 'pendiente', sesion: hecha ? hecha.id : null };
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
export function reorganizar(libres, { quitarHoy = false } = {}) {
  const S = estado(), p = planDeLaSemana(S); if (!p) return null;
  const hoy = diaSemana();
  const est = estadoDias(S);
  const hechos = est.filter(d => d.estado === 'hecho');
  const pendientes = est.filter(d => d.estado !== 'hecho');
  libres = libres.filter(d => d >= hoy && !hechos.some(h => h.diaSemana === d) && !(quitarHoy && d === hoy)).sort((a, b) => a - b);
  let nuevos, nota;
  if (pendientes.length <= libres.length) {
    nuevos = pendientes.map((d, i) => ({ ...d, diaSemana: libres[i] }));
    const mov = pendientes.map((d, i) => [d, libres[i]]).filter(([d, n]) => d.diaSemana !== n);
    nota = mov.length ? `Muevo ${lista(mov.map(([d, n]) => `${minus(DIAS[d.diaSemana])} (${minus(d.nombre)}) al ${minus(DIAS[n])}`))}.` : 'Todo sigue en su día.';
  } else {
    // No caben: con los días que quedan, cuerpo completo priorizando lo que aún no se ha trabajado esta semana.
    const trabajado = new Set(hechos.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal').map(x => ex(x.id).m[0])));
    const faltan = GRANDES.filter(m => !trabajado.has(m));
    const huecos = [...faltan, ...GRANDES.filter(m => trabajado.has(m)), 'core'];
    const usados = {};
    nuevos = libres.map((d, i) => {
      const lugar = pendientes[i] ? pendientes[i].lugar : (S.perfil.lugares.find(l => l !== 'piscina') || S.perfil.lugares[0]);
      const dia = montarDia(S, { lugar, minutos: (pendientes[0] && pendientes[0].minutos) || S.perfil.disponibilidad.minutos, tipo: lugar === 'piscina' ? 'piscina' : 'fullA', huecos: lugar === 'piscina' ? null : huecos, k: i + 3, usados, futuro: true });
      return { diaSemana: d, nombre: libres.length === 1 ? 'Cuerpo completo (resumen de la semana)' : dia.nombre, foco: dia.foco, lugar, minutos: dia.minutos, tipo: 'fullA', explicacion: [`Rehecho al reorganizar la semana: prioriza ${lista(faltan.map(m => minus(MUSCULOS[m])))}, que aún no has trabajado.`, ...dia.explicacion], calentamiento: dia.calentamiento, ejercicios: dia.ejercicios, vuelta: dia.vuelta };
    });
    nota = `Quedaban ${pendientes.length} días y puedes ${libres.length}: lo junto en ${libres.length === 1 ? 'una sesión de cuerpo completo' : 'sesiones de cuerpo completo'} priorizando ${lista(faltan.map(m => minus(MUSCULOS[m]))) || 'lo más importante'}.`;
  }
  cambiar(S2 => {
    const pl = S2.plan;
    pl.dias = [...hechos.map(d => p.dias.find(x => x.diaSemana === d.diaSemana) || d), ...nuevos.map(({ estado: _e, sesion: _s, ...d }) => d)].sort((a, b) => a.diaSemana - b.diaSemana);
    pl.cambios = [...(pl.cambios || []), { fecha: new Date().toISOString(), texto: nota }];
  }, 'plan');
  return nota;
}
