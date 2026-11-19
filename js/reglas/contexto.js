// Lo que el móvil manda al entrenador IA: perfil, lesiones, gustos, catálogo ya filtrado por seguridad,
// historial resumido, recuperación muscular y comentarios recientes. La IA decide; las reglas filtran antes
// (nada peligroso llega al catálogo) y corrigen después (kilos acotados, ver progresion.acotarKg).

import { ex, disponibles, nivelesZona, zonasRiesgo, ZONAS } from './catalogo.js';
import { registros, resumen, sugerir, cargaMuscular, sesionesHechas, hace } from './progresion.js';
import { num, es } from '../nucleo/ui.js';
import { OBJETIVOS, NIVELES, PERSONAS, MUSCULOS, LUGARES } from '../datos/constantes.js';

const DIA = 864e5;

export function perfilParaIA(S) {
  const p = S.perfil;
  const edad = p.datos.nacimiento ? Math.floor((Date.now() - new Date(p.datos.nacimiento)) / (365.25 * DIA)) : null;
  const med = S.medidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ult = med[med.length - 1];
  return {
    nombre: PERSONAS[S.dueño] ? PERSONAS[S.dueño].nombre : '',
    sexo: p.datos.sexo || null, edad, alturaCm: p.datos.altura || null,
    pesoKg: ult && ult.peso || null,
    objetivos: p.objetivos.map(o => OBJETIVOS[o] ? OBJETIVOS[o].nombre : o),
    nivel: NIVELES[p.nivel] || 'Principiante',
    diasPorSemana: p.disponibilidad.dias, minutosPorSesion: p.disponibilidad.minutos,
    diasPreferidos: p.disponibilidad.diasSemana,
    lugares: p.lugares.map(l => LUGARES[l]), materialEnCasa: p.materialCasa,
    entrenaAcompañado: !!p.acompañado,
    notas: p.notas || '',
  };
}

export function lesionesParaIA(S, dolorHoy = {}) {
  return S.perfil.lesiones.filter(l => l.activa).map(l => {
    const z = ZONAS[l.zona] || {};
    return { zona: z.nombre || l.zona, dolor: `${l.dolor}/10`, dolorHoy: dolorHoy[l.zona] != null ? `${dolorHoy[l.zona]}/10` : undefined,
      desde: l.desde || undefined, tipo: l.tipo || undefined, nota: l.nota || undefined, evitar: z.evitar, rehabilitacionSugerida: (z.rehab || []).filter(id => ex(id)) };
  });
}

// Catálogo seguro de los lugares pedidos, en forma compacta (cada token cuesta):
// { id, m: [principales, ...secundarios marcados con «~»], l: lugares, niv, t, prec?: zonas con cuidado, gusto? }
export function catalogoParaIA(S, lugares, dolorHoy = {}) {
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const vistos = new Map();
  lugares.forEach(l => disponibles(S.perfil, l, { dolorHoy }).forEach(e => {
    const x = vistos.get(e.id) || { id: e.id, m: [...e.m, ...(e.s || []).map(m => '~' + m)], l: [], niv: e.niv, t: e.t };
    x.l.push(l);
    const z = zonasRiesgo(e, niveles); if (z.length) x.prec = z.map(k => ZONAS[k] ? ZONAS[k].corta : k).join(',');
    const g = S.perfil.gustos[e.id]; if (g) x.gusto = g === 'gusta' ? 'le gusta' : 'no le gusta';
    vistos.set(e.id, x);
  }));
  return [...vistos.values()];
}

export function historialParaIA(S, ids, ctx = {}) {
  const progreso = [];
  ids.forEach(id => {
    const regs = registros(S, id); if (!regs.length) return;
    const e = ex(id);
    const sug = sugerir(S, id, { series: e.d[0], reps: e.d[1] }, ctx);
    progreso.push({
      id, diasDesdeUltima: Math.floor((Date.now() - new Date(regs[regs.length - 1].fecha)) / DIA),
      ultimas: regs.slice(-3).reverse().map(r => ({ fecha: String(r.fecha).slice(0, 10), series: resumen(r), esfuerzo: r.esfuerzo ? r.esfuerzo + '/5' : undefined })),
      propuestaReglas: [sug.kg != null ? sug.kg + ' kg' : '', sug.series + ' × ' + sug.reps, sug.motivo].filter(Boolean).join(' · '),
    });
  });
  progreso.sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima);
  const hechas = sesionesHechas(S).reverse();
  const carga = cargaMuscular(S);
  return {
    recuperacion: Object.entries(carga).filter(([, k]) => k.estado !== 'fresco').map(([m, k]) => ({ musculo: MUSCULOS[m] || m, trabajado: hace(k.horas), estado: k.estado === 'cargado' ? 'sin recuperar' : 'casi recuperado', faltanHoras: k.faltan })),
    sesionesUltimos14dias: hechas.filter(s => Date.now() - new Date(s.terminada || s.fecha) < 14 * DIA).map(s => ({
      fecha: s.fecha, nombre: s.nombre, lugar: s.lugar, esfuerzo: s.cierre && s.cierre.esfuerzo ? s.cierre.esfuerzo + '/5' : undefined,
      comentario: s.cierre && s.cierre.comentario || undefined,
      comentariosEjercicios: (s.ejercicios || []).filter(x => x.comentario).map(x => `${ex(x.id) ? ex(x.id).n : x.id}: ${x.comentario}`),
    })),
    progreso: progreso.slice(0, 40),
    dolorReciente: S.dolor.slice(-10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis del entrenador: lo que se saca de lo apuntado y que cambia lo que se prescribe.
// Lo usan las reglas (sin IA) y se manda a la IA tal cual, así las dos decisiones parten de lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

// Comentarios en texto libre → problemas que el entrenador sabe resolver.
const PROBLEMAS = [
  ['molestia', /duel|dolor|molest|pinch|tir[oó]n|cruj|lesi|se me carg|me carga/i],
  ['ocupado', /ocupad|no (hab[ií]a|hay|estaba)|rota|averiad|sin m[aá]quina/i],
  ['aburrido', /aburr|mon[oó]ton|siempre lo mismo|repetitiv/i],
  ['facil', /f[aá]cil|ligero|me sobr|muy poco|sin esfuerzo/i],
  ['dificil', /dif[ií]cil|no pude|no llegu|demasiad|muy pesad|imposible|no pod[ií]a/i],
  ['tecnica', /t[eé]cnica|no s[eé] (hacer|c[oó]mo)|no me sale|no lo entiendo|postura/i],
];
export function leerComentario(txt) {
  return PROBLEMAS.filter(([, re]) => re.test(String(txt || ''))).map(([k]) => k);
}

// Por ejercicio: cómo va (sube, estancado, baja), si duele, si gusta y lo que se ha comentado.
export function analizarEjercicios(S) {
  const porId = {};
  const hechas = sesionesHechas(S);
  hechas.forEach(s => (s.ejercicios || []).forEach(x => {
    if (!x.id || !x.comentario) return;
    (porId[x.id] = porId[x.id] || { comentarios: [] }).comentarios.push({ fecha: s.fecha, texto: x.comentario });
  }));
  const ids = new Set([...hechas.flatMap(s => (s.ejercicios || []).map(x => x.id)).filter(Boolean), ...Object.keys(S.perfil.gustos || {})]);
  const out = {};
  ids.forEach(id => {
    const e = ex(id); if (!e) return;
    const regs = registros(S, id).slice(-6);
    const a = { id, veces: regs.length, gusto: (S.perfil.gustos || {})[id] || null, comentarios: ((porId[id] || {}).comentarios || []).slice(-3), problemas: [] };
    a.comentarios.forEach(c => leerComentario(c.texto).forEach(p => { if (!a.problemas.includes(p)) a.problemas.push(p); }));
    const kgDe = r => Math.max(0, ...r.sets.map(z => z.kg || 0));
    const volDe = r => r.sets.reduce((t, z) => t + (num(z.txt) || 0) * (z.kg || 1), 0);
    if (regs.length >= 2) {
      const pri = regs[0], ult = regs[regs.length - 1];
      const conKg = kgDe(ult) > 0;
      const ini = conKg ? kgDe(pri) : volDe(pri), fin = conKg ? kgDe(ult) : volDe(ult);
      a.cambio = ini ? Math.round((fin - ini) / ini * 100) : 0;
      a.unidad = conKg ? 'kg' : 'volumen';
      a.desde = conKg ? `${es(ini)} → ${es(fin)} kg` : '';
      // Estancado: 3 últimas sesiones sin mejorar ni kilos ni volumen.
      const ult3 = regs.slice(-3);
      a.estancado = ult3.length === 3 && ult3.every((r, i) => i === 0 || (conKg ? kgDe(r) <= kgDe(ult3[0]) : volDe(r) <= volDe(ult3[0]) * 1.03));
      a.dolorSube = regs.filter(r => Object.keys(e.r || {}).some(z => r.despues[z] != null && +r.despues[z] >= +(r.antes[z] || 0) + 2)).length;
    }
    a.estado = a.gusto === 'rechazo' ? 'rechazado'
      : a.problemas.includes('molestia') || a.dolorSube >= 1 ? 'molesta'
      : a.estancado ? 'estancado'
      : a.cambio > 0 ? 'progresa'
      : regs.length < 2 ? 'nuevo' : 'estable';
    a.accion = {
      rechazado: 'No volver a ponerlo.',
      molesta: 'Cambiar por una variante que no cargue la zona, o bajar carga y rango.',
      estancado: 'Cambiar de variante o de rango de repeticiones unas semanas.',
      progresa: 'Seguir con la doble progresión.',
      estable: 'Seguir; si se repite, ajustar.',
      nuevo: 'Aprender la técnica y fijar el peso de partida.',
    }[a.estado];
    if (a.problemas.includes('ocupado')) a.accion += ' Tener una alternativa por si está ocupado.';
    if (a.problemas.includes('aburrido')) a.accion += ' Variar el ejercicio.';
    if (a.problemas.includes('facil') && a.estado !== 'molesta') a.accion += ' Le resulta fácil: subir carga o pasar a una variante más difícil.';
    if (a.problemas.includes('dificil')) a.accion += ' Le cuesta: bajar carga o pasar a una variante guiada.';
    if (a.problemas.includes('tecnica')) a.accion += ' Repasar técnica con menos peso.';
    out[id] = a;
  });
  return out;
}

// Puntuación de preferencia de un ejercicio para elegirlo (gusto, molestias, estancamiento, conocido).
export function preferencia(analisis, id) {
  const a = analisis[id]; if (!a) return 0;
  let p = { gusta: 3, nogusta: -4, rechazo: -100 }[a.gusto] || 0;
  if (a.estado === 'molesta') p -= 8;
  if (a.estado === 'estancado') p -= 6;
  if (a.estado === 'progresa') p += 2;
  if (a.problemas.includes('ocupado')) p -= 2;
  if (a.problemas.includes('aburrido')) p -= 2;
  if (a.veces) p += 1; // ya lo conoce: continuidad en la progresión
  return p;
}

// Tendencias: peso, cintura, dolor por zona, esfuerzo y constancia. Cambian dosis y volumen.
export function tendencias(S) {
  const ahora = Date.now();
  const enDias = (f, d) => ahora - new Date(f) <= d * DIA;
  const med = S.medidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const serie = k => med.filter(m => m[k] != null && m[k] !== '');
  const delta = (k, dias) => {
    const v = serie(k); if (v.length < 2) return null;
    const ult = v[v.length - 1]; const ref = v.filter(m => new Date(ult.fecha) - new Date(m.fecha) >= dias * DIA * 0.7).pop();
    return ref ? Math.round((+ult[k] - +ref[k]) * 10) / 10 : null;
  };
  const dolor = {};
  S.dolor.forEach(d => { (dolor[d.zona] = dolor[d.zona] || []).push(d); });
  const dolorZona = Object.entries(dolor).map(([z, l]) => {
    const rec = l.filter(d => enDias(d.fecha, 14)).map(d => +d.dolor), prev = l.filter(d => !enDias(d.fecha, 14) && enDias(d.fecha, 28)).map(d => +d.dolor);
    const m = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
    const r = m(rec), p = m(prev);
    return { zona: z, nombre: (ZONAS[z] || {}).corta || z, media14: r, mediaAntes: p, tendencia: r == null || p == null ? 'sin datos' : r >= p + 1 ? 'sube' : r <= p - 1 ? 'baja' : 'igual' };
  }).filter(d => d.media14 != null);
  const hechas = sesionesHechas(S);
  const ult28 = hechas.filter(s => enDias(s.terminada || s.fecha, 28));
  const esf = ult28.map(s => s.cierre && +s.cierre.esfuerzo).filter(Boolean);
  const plan = (S.perfil.disponibilidad || {}).dias || 3;
  return {
    pesoKg: (serie('peso').pop() || {}).peso || null,
    cambioPeso4sem: delta('peso', 28), cambioCintura4sem: delta('cintura', 28),
    dolor: dolorZona,
    sesionesPorSemana: Math.round(ult28.length / 4 * 10) / 10,
    constancia: Math.min(100, Math.round(ult28.length / (plan * 4) * 100)),
    esfuerzoMedio: esf.length ? Math.round(esf.reduce((a, b) => a + b, 0) / esf.length * 10) / 10 : null,
  };
}

// Medidor de nivel: el progreso medido puede subir (o bajar) el nivel del perfil.
// Principiante → Intermedio: 8 semanas entrenando con constancia y progresión real en varios ejercicios.
// Intermedio → Avanzado: 9 meses de constancia y mejoras grandes y sostenidas.
// Bajar: 8 semanas sin entrenar (se vuelve con cuidado).
export function medidorNivel(S) {
  const hechas = sesionesHechas(S);
  const nivel = S.perfil.nivel || 1;
  const ahora = Date.now();
  const semanasActivas = [0, 1, 2, 3, 4, 5, 6, 7].filter(i => hechas.filter(s => { const t = ahora - new Date(s.terminada || s.fecha); return t >= i * 7 * DIA && t < (i + 1) * 7 * DIA; }).length >= 2).length;
  const primera = hechas[0] ? new Date(hechas[0].terminada || hechas[0].fecha) : null;
  const semanasEntrenando = primera ? Math.floor((ahora - primera) / (7 * DIA)) : 0;
  const ultima = hechas.length ? new Date(hechas[hechas.length - 1].terminada || hechas[hechas.length - 1].fecha) : null;
  const semanasSinEntrenar = ultima ? Math.floor((ahora - ultima) / (7 * DIA)) : null;
  const an = Object.values(analizarEjercicios(S));
  const mejoran = an.filter(a => a.cambio >= 10 && a.veces >= 3).length;
  const mejoranMucho = an.filter(a => a.cambio >= 25 && a.veces >= 4).length;
  const criterios = nivel === 1
    ? [['8 semanas entrenando', semanasEntrenando >= 8, `${semanasEntrenando} semanas`], ['6 de las últimas 8 semanas con 2 sesiones o más', semanasActivas >= 6, `${semanasActivas} de 8`], ['4 ejercicios mejorados un 10 % o más', mejoran >= 4, `${mejoran}`]]
    : nivel === 2
      ? [['9 meses entrenando', semanasEntrenando >= 39, `${semanasEntrenando} semanas`], ['6 de las últimas 8 semanas con 2 sesiones o más', semanasActivas >= 6, `${semanasActivas} de 8`], ['8 ejercicios mejorados un 25 % o más', mejoranMucho >= 8, `${mejoranMucho}`]]
      : [];
  let sugerido = nivel, motivo = '';
  if (nivel > 1 && semanasSinEntrenar != null && semanasSinEntrenar >= 8) { sugerido = nivel - 1; motivo = `Llevas ${semanasSinEntrenar} semanas sin entrenar: se vuelve un nivel más abajo para retomar con cuidado.`; }
  else if (criterios.length && criterios.every(c => c[1])) { sugerido = nivel + 1; motivo = 'Cumples todos los criterios de constancia y progreso para subir de nivel.'; }
  return { nivel, sugerido, motivo, criterios: criterios.map(([que, ok, valor]) => ({ que, ok, valor })), semanasActivas, semanasEntrenando, mejoran };
}

// Resumen de análisis para la IA (compacto: solo lo que cambia decisiones).
export function analisisParaIA(S) {
  const an = Object.values(analizarEjercicios(S)).filter(a => a.estado !== 'nuevo' || a.gusto || a.comentarios.length);
  return {
    ejercicios: an.slice(0, 40).map(a => ({ id: a.id, estado: a.estado, cambio: a.cambio != null ? a.cambio + '%' : undefined, veces: a.veces || undefined, gusto: a.gusto || undefined,
      comentarios: a.comentarios.length ? a.comentarios.map(c => c.texto) : undefined, accion: a.accion })),
    tendencias: tendencias(S),
  };
}
