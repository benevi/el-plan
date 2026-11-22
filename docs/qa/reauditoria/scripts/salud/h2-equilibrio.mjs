// H2: con 60 años o más falta el ejercicio de equilibrio (C-EDAD-1) cuando el ajuste de tiempo rehace el calentamiento.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const fila = [];
for (const lugar of ['gym', 'casa', 'calle', 'piscina']) for (const minutos of [30, 45, 60, 75, 90]) for (const obj of [['musculo'], ['perder'], ['salud']]) {
  const S = nuevoS({ objetivos: obj, nivel: 2, lugares: [lugar], datos: { nacimiento: '1956-05-01' } });
  const ci = { lugar, minutos, energia: 3, dolorHoy: {}, peticion: '' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
  const tiene = [...s.calentamiento, ...s.vuelta, ...s.ejercicios].some(t => t.id === 'equilibrio-una-pierna');
  if (!tiene) fila.push(`${lugar} ${minutos} min ${obj}: calentamiento = ${s.calentamiento.map(t => t.nombre + ' ' + t.duracion).join(' | ')}`);
}
console.log(fila.length ? fila.join('\n') : 'todas con equilibrio');
let n = 0, sin = 0; const ej = [];
for (const lugar of ['gym', 'casa', 'calle', 'piscina']) for (const minutos of [30, 45, 60]) for (const obj of [['musculo'], ['perder'], ['salud']]) for (const z of ['hombro', 'lumbar', 'codo', 'dorsal', 'cervical', 'muñeca']) for (const hoy of [2, 5]) {
  const S = nuevoS({ objetivos: obj, nivel: 2, lugares: [lugar], datos: { nacimiento: '1956-05-01' } });
  S.perfil.lesiones.push({ id: 'l', zona: z, dolor: hoy, activa: true, desde: '2025-01-01' });
  const ci = { lugar, minutos, energia: 3, dolorHoy: { [z]: hoy }, peticion: '' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
  n++;
  if (![...s.calentamiento, ...s.vuelta, ...s.ejercicios].some(t => t.id === 'equilibrio-una-pierna')) { sin++; if (ej.length < 4) ej.push(`${lugar} ${minutos} min ${obj} ${z} ${hoy}/10`); }
}
console.log(`70 años con una lesión de tren superior o espalda: ${sin} de ${n} sesiones sin equilibrio. P. ej.: ${ej.join(' · ')}`);
