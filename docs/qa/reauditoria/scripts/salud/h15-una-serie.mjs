// H15: el plan semanal deja principales a 1 serie para no pasar el techo semanal (fuera de C-DOSIS-2/3 y C-DOSIS-5).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-16T10:00');
const { nuevoS, ent, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
let planes = 0, conUna = 0; const ej = [];
for (const nivel of [1, 2, 3]) for (const obj of [['musculo'], ['fuerza'], ['perder'], ['salud']]) for (const dias of [[1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]]) for (const lug of ['gym', 'casa', 'calle']) for (const minutos of [45, 60, 75, 90]) {
  const S = nuevoS({ objetivos: obj, nivel, lugares: [lug], materialCasa: ['mancuernas', 'banda'] });
  const p = ent.planReglas(S, { dias, minutos, lugares: [lug] });
  planes++;
  const unos = p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal' && +x.series === 1 && cat.ex(x.id).t !== 'distancia').map(x => `${d.diaSemana}:${x.id}`));
  if (unos.length) { conUna++; if (ej.length < 6) ej.push(`niv${nivel} ${obj} ${dias.length} días ${lug} ${minutos} min → ${unos.length} principales a 1 serie (${unos.slice(0, 4).join(', ')})`); }
}
console.log(`${conUna} de ${planes} planes con principales a 1 serie\n` + ej.join('\n'));
