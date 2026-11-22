// H16: los estiramientos «libres» sin id (de pie, en el borde) no miran la zona: hombro o espalda a 5-8/10.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const LIBRES = /Estiramiento de (hombros|espalda) en el borde|Estiramiento de pecho de pie|Estiramiento de espalda de pie|Estiramiento de gemelos (en el borde|de pie)/;
for (const [z, lugar] of [['hombro', 'piscina'], ['hombro', 'calle'], ['dorsal', 'piscina'], ['tobillo_pie', 'piscina'], ['tobillo_pie', 'calle'], ['lumbar', 'calle']]) for (const hoy of [5, 8]) for (const minutos of [45, 90]) {
  const S = nuevoS({ objetivos: ['salud'], nivel: 2, lugares: [lugar] }); S.perfil.lesiones.push({ id: 'l', zona: z, dolor: 5, activa: true, desde: '2025-01-01' });
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar, minutos, energia: 3, dolorHoy: { [z]: hoy }, peticion: '' }).datos);
  const l = s.vuelta.filter(t => !t.id && LIBRES.test(t.nombre)).map(t => `«${t.nombre}» (${t.detalle})`);
  if (l.length) console.log(`${z} ${hoy}/10 ${lugar} ${minutos}: ${l.join(' · ')}`);
}
