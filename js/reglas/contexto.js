// Lo que el móvil manda al entrenador IA: perfil, lesiones, gustos, catálogo ya filtrado por seguridad,
// historial resumido, recuperación muscular y comentarios recientes. La IA decide; las reglas filtran antes
// (nada peligroso llega al catálogo) y corrigen después (kilos acotados, ver progresion.acotarKg).

import { ex, disponibles, nivelesZona, zonasRiesgo, ZONAS } from './catalogo.js';
import { registros, resumen, sugerir, cargaMuscular, sesionesHechas, hace } from './progresion.js';
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
    notas: p.notas || '',
  };
}

export function lesionesParaIA(S, dolorHoy = {}) {
  return S.perfil.lesiones.filter(l => l.activa).map(l => {
    const z = ZONAS[l.zona] || {};
    return { zona: z.nombre || l.zona, dolor: `${l.dolor}/10`, dolorHoy: dolorHoy[l.zona] != null ? `${dolorHoy[l.zona]}/10` : undefined,
      desde: l.desde || undefined, nota: l.nota || undefined, evitar: z.evitar, rehabilitacionSugerida: (z.rehab || []).filter(id => ex(id)) };
  });
}

// Catálogo seguro de los lugares pedidos. Cada ejercicio lleva en qué lugares se puede hacer.
export function catalogoParaIA(S, lugares, dolorHoy = {}) {
  const niveles = nivelesZona(S.perfil, dolorHoy);
  const vistos = new Map();
  lugares.forEach(l => disponibles(S.perfil, l, { dolorHoy }).forEach(e => {
    const x = vistos.get(e.id) || { id: e.id, nombre: e.n, musculos: e.m, secundarios: e.s, material: e.mat, nivel: e.niv, tipo: e.t, porDefecto: e.d, lugares: [] };
    x.lugares.push(l);
    const z = zonasRiesgo(e, niveles); if (z.length) x.precaucion = z.map(k => ZONAS[k] ? ZONAS[k].corta : k);
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
