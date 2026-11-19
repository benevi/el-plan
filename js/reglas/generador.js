// Entrenador sin IA: monta una sesión completa con reglas cuando no hay conexión o la IA falla.
// Siempre incluye calentamiento, trabajo principal, rehabilitación de las lesiones activas y vuelta a la calma.

import { ex, disponibles, nivelesZona, riesgo, ZONAS } from './catalogo.js';
import { sugerir, cargaMuscular } from './progresion.js';
import { OBJETIVOS, MUSCULOS, LUGARES } from '../datos/constantes.js';

const PATRON = ['cuadriceps', 'espalda', 'pecho', 'gluteo', 'isquios', 'hombro', 'core', 'biceps', 'triceps', 'gemelo'];
const DINAMICOS = ['circulos-brazos', 'circulos-cadera', 'balanceo-pierna-frontal', 'rotacion-toracica-cuadrupedia', 'gato-camello', 'dislocaciones-banda', 'movilidad-tobillo-pared'];
const ESTIRA = {
  pecho: ['estiramiento-pectoral-puerta'], hombro: ['estiramiento-hombro-cruzado'], espalda: ['postura-nino'], triceps: ['estiramiento-hombro-cruzado'],
  cuadriceps: ['estiramiento-cuadriceps-pie', 'estiramiento-flexor-cadera'], isquios: ['estiramiento-isquios-tumbado'],
  gluteo: ['estiramiento-gluteo-rodilla-pecho', 'estiramiento-figura-4'], gemelo: ['estiramiento-gemelo-pared'], core: ['gato-camello'],
};
const ejPorMinutos = m => m <= 30 ? 4 : m <= 45 ? 5 : m <= 60 ? 6 : m <= 75 ? 7 : 8;
const azar = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);

// opciones: { lugar, minutos, energia 1-5, dolorHoy {zona:n}, musculos [] (si pide algo concreto) }
export function generarSesion(S, op) {
  const perfil = S.perfil;
  const lugar = op.lugar || (perfil.lugares || ['gym'])[0];
  const minutos = +op.minutos || perfil.disponibilidad.minutos || 60;
  const energia = +op.energia || 3;
  const objetivos = perfil.objetivos.length ? perfil.objetivos : ['salud'];
  const obj = OBJETIVOS[objetivos.find(o => o !== 'perder' && o !== 'natacion') || objetivos[0]] || OBJETIVOS.salud;
  const niveles = nivelesZona(perfil, op.dolorHoy);
  const carga = cargaMuscular(S);
  const pool = disponibles(perfil, lugar, { dolorHoy: op.dolorHoy });
  const gusto = e => ({ gusta: 2, nogusta: -3 }[(perfil.gustos || {})[e.id]] || 0);
  const explicacion = [];
  const zonasActivas = Object.keys(niveles);

  // ── Rehabilitación: hasta 2 ejercicios por zona activa (máx. 3 en total) ──
  const rehab = [];
  zonasActivas.forEach(z => {
    const ids = (ZONAS[z] && ZONAS[z].rehab || []).filter(id => pool.some(e => e.id === id) && !rehab.some(r => r.id === id));
    ids.slice(0, 2).forEach(id => rehab.length < 3 && rehab.push({ id, zona: z }));
  });

  // ── Principal ──
  const descansan = Object.keys(carga).filter(m => carga[m].estado === 'cargado' && !(op.musculos || []).includes(m));
  let n = ejPorMinutos(minutos) - Math.ceil(rehab.length / 2);
  if (energia <= 2) n = Math.min(n, 4);
  const orden = lugar === 'piscina' ? ['natacion', 'natacion', 'cardio', 'natacion', 'gluteo', 'natacion', 'cardio']
    : (op.musculos && op.musculos.length ? [...op.musculos, ...op.musculos, 'core'] : PATRON.filter(m => !descansan.includes(m)));
  const fuerza = e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]);
  const candidatos = lugar === 'piscina' ? pool.filter(e => e.m[0] !== 'movilidad') : pool.filter(fuerza);
  const elegidos = [];
  for (let i = 0; elegidos.length < n && i < orden.length * 2; i++) {
    const m = orden[i % orden.length];
    const c = azar(candidatos.filter(e => e.m[0] === m && !elegidos.includes(e) && !rehab.some(r => r.id === e.id))).sort((a, b) => gusto(b) - gusto(a));
    if (c[0]) elegidos.push(c[0]);
  }
  azar(candidatos).forEach(e => { if (elegidos.length < n && !elegidos.includes(e) && !rehab.some(r => r.id === e.id)) elegidos.push(e); });
  // Multiarticulares (más músculos implicados) primero.
  elegidos.sort((a, b) => (b.m.length + (b.s || []).length) - (a.m.length + (a.s || []).length));

  const ctx = { energia, niveles, carga };
  const ejercicios = [];
  rehab.forEach(r => {
    const e = ex(r.id);
    ejercicios.push({ id: e.id, rol: 'rehab', series: Math.min(3, e.d[0]), reps: e.d[1], descanso: 45, nota: `Para tu ${ZONAS[r.zona].corta.toLowerCase()}: controlado, dolor máximo 3 de 10.` });
  });
  elegidos.forEach(e => {
    const base = e.t === 'reps' && lugar !== 'piscina' ? { series: obj.series, reps: obj.reps, desc: obj.desc } : { series: e.d[0], reps: e.d[1], desc: e.d[2] };
    if (energia <= 2 && base.series > 2) base.series--;
    if (carga[e.m[0]] && carga[e.m[0]].estado !== 'fresco' && base.series > 2) base.series--;
    const sg = sugerir(S, e.id, base, ctx);
    ejercicios.push({ id: e.id, rol: 'principal', series: sg.series, reps: sg.reps, descanso: base.desc, kg: sg.kg, motivo: sg.motivo, nota: riesgo(e, niveles) === 'precaucion' ? 'Con cuidado por tu lesión: carga moderada y técnica limpia.' : '' });
  });
  if (objetivos.includes('perder') && lugar !== 'piscina' && energia >= 3) {
    const fin = azar(pool.filter(e => e.m[0] === 'cardio')).sort((a, b) => a.niv - b.niv)[0];
    if (fin) ejercicios.push({ id: fin.id, rol: 'cardio', series: 1, reps: '12-15 min', descanso: 0, nota: 'Cardio moderado al final: puedes hablar, pero te cuesta.' });
  }

  // ── Calentamiento ──
  const calentamiento = [];
  const suave = pool.filter(e => e.m[0] === 'cardio' && e.niv === 1)[0];
  calentamiento.push({ id: suave ? suave.id : null, nombre: suave ? suave.n + ' suave' : 'Cardio suave', detalle: 'Ritmo cómodo, hasta empezar a sudar un poco.', duracion: '5 min' });
  azar(DINAMICOS.filter(id => ex(id) && riesgo(ex(id), niveles) !== 'evitar' && (lugar !== 'piscina' || ex(id).l.includes('piscina')))).slice(0, 3)
    .forEach(id => calentamiento.push({ id, nombre: ex(id).n, detalle: 'Movilidad dinámica, sin forzar.', duracion: '1 min' }));
  zonasActivas.forEach(z => (ZONAS[z].calentar || []).slice(0, 1).forEach(t => calentamiento.push({ nombre: t, detalle: `Activación para tu ${ZONAS[z].corta.toLowerCase()}.`, duracion: '1-2 min' })));
  const primero = ejercicios.find(x => x.rol === 'principal' && x.kg);
  if (primero) calentamiento.push({ nombre: 'Series de aproximación', detalle: `1-2 series de ${ex(primero.id).n.toLowerCase()} con la mitad del peso.`, duracion: '2 min' });

  // ── Vuelta a la calma ──
  const trabajados = [...new Set(elegidos.flatMap(e => e.m))];
  const vuelta = [];
  trabajados.flatMap(m => ESTIRA[m] || []).filter((id, i, a) => a.indexOf(id) === i && ex(id) && riesgo(ex(id), niveles) !== 'evitar').slice(0, 4)
    .forEach(id => vuelta.push({ id, nombre: ex(id).n, detalle: '30 s por lado, respirando lento.', duracion: '1 min' }));
  zonasActivas.forEach(z => (ZONAS[z].estirar || []).slice(0, 1).forEach(t => vuelta.push({ nombre: t, detalle: `Para tu ${ZONAS[z].corta.toLowerCase()}.`, duracion: '1 min' })));
  vuelta.push({ nombre: 'Respiración', detalle: 'Tumbado, 6 respiraciones lentas soltando el aire en 6 segundos.', duracion: '1 min' });

  // ── Por qué ──
  explicacion.push(`Hecha sin IA, con las reglas de la app: ${ejercicios.filter(x => x.rol === 'principal').length} ejercicios en ${LUGARES[lugar].toLowerCase()} para unos ${minutos} minutos.`);
  explicacion.push(`Dosis de «${obj.nombre.toLowerCase()}»: ${obj.series} series de ${obj.reps} con ${obj.desc} s de descanso en los ejercicios de fuerza.`);
  if (descansan.length) explicacion.push(`Hoy descansan ${descansan.map(m => MUSCULOS[m].toLowerCase()).join(', ')}: los trabajaste hace poco y aún se recuperan.`);
  if (rehab.length) explicacion.push(`Rehabilitación de ${[...new Set(rehab.map(r => ZONAS[r.zona].corta.toLowerCase()))].join(' y ')} al principio, con dosis suave, y fuera lo que la carga.`);
  if (energia <= 2) explicacion.push('Energía baja: menos ejercicios y una serie menos.');
  if (objetivos.includes('perder')) explicacion.push('Para perder grasa: fuerza para mantener músculo y cardio moderado al final.');
  if (ejercicios.some(x => x.motivo)) explicacion.push('Los kilos y repeticiones salen de lo que apuntaste otras veces (doble progresión).');

  return {
    fuente: 'reglas', lugar, minutos, nombre: lugar === 'piscina' ? 'Piscina' : `${obj.nombre}`,
    foco: lugar === 'piscina' ? 'Técnica y resistencia en el agua' : (op.musculos && op.musculos.length ? op.musculos.map(m => MUSCULOS[m]).join(', ') : 'Cuerpo completo'),
    explicacion, calentamiento, ejercicios, vuelta,
    checkin: { energia, dolor: op.dolorHoy || {}, tiempo: minutos },
  };
}
