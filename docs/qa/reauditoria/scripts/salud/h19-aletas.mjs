// H19: Aquiles o esguince de tobillo en B2 en la piscina: sin aletas (C-PISC-3, C-CARDIO-6 «Sin aletas»).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
let n = 0, con = 0; const ej = [];
for (const det of ['aquiles', 'esguince', 'fascitis']) for (const nivel of [2, 3]) for (const obj of [['natacion'], ['salud'], ['perder']]) for (const minutos of [45, 60, 90]) for (let d = 0; d < 7; d++) {
  fijarFecha(`2026-11-${16 + d}T10:00`);
  const S = nuevoS({ objetivos: obj, nivel, lugares: ['piscina'], nadar25: true });
  S.perfil.lesiones.push({ id: 'l', zona: 'tobillo_pie', dolor: 5, activa: true, desde: '2025-01-01', detalle: det });
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar: 'piscina', minutos, energia: 3, dolorHoy: { tobillo_pie: 5 }, peticion: '' }).datos);
  n++;
  const a = s.ejercicios.filter(x => cat.ex(x.id).mat.includes('aletas'));
  if (a.length) { con++; if (ej.length < 3) ej.push(`${det} niv${nivel} ${obj} ${minutos}: ${a.map(x => x.id + ' ' + x.series + '×' + x.reps).join(', ')}`); }
}
console.log(`${con} de ${n} sesiones de piscina con el tobillo a 5/10 llevan un ejercicio con aletas\n${ej.join('\n')}`);
console.log('patada-lateral:', JSON.stringify({ mat: cat.ex('patada-lateral').mat, r: cat.ex('patada-lateral').r, c: cat.ex('patada-lateral').c }));
