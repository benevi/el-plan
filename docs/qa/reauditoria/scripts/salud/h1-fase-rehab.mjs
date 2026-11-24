// H1: la rehabilitación del día del plan (hecha con el dolor de ficha) se queda aunque hoy duela más
// y su fase ya no toca (C-DOLOR-1, C-DOSIS-7, C-ZONA-0): fase 3 o 2 con dolor de hoy en B2.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat, lesiones } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const casos = [
  ['cervical', 0, 6, 'gym', 'recurrente'], ['dorsal', 0, 5, 'gym', 'lesion'], ['tobillo_pie', 0, 6, 'casa', 'lesion'],
  ['hombro', 0, 6, 'gym', 'lesion'], ['rodilla', 0, 5, 'gym', 'lesion'], ['lumbar', 0, 6, 'gym', 'lesion'], ['codo', 0, 6, 'gym', 'lesion'], ['cadera_lateral', 0, 5, 'gym', 'lesion'],
  ['rodilla', 3, 6, 'gym', 'lesion'], ['hombro', 2, 5, 'gym', 'lesion'],
];
for (const [z, ficha, hoy, lugar, tipo] of casos) {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: [lugar], materialCasa: ['banda', 'mancuernas'] });
  S.perfil.lesiones.push({ id: 'l', zona: z, dolor: ficha, activa: true, desde: '2025-01-01', tipo });
  const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: [lugar] });
  const dia = plan.dias.find(d => d.ejercicios.some(x => x.rol === 'rehab'));
  const rehabPlan = dia.ejercicios.filter(x => x.rol === 'rehab').map(x => `${x.id}(fases ${lesiones.fasesDe(cat.ex(x.id), z)})`);
  const ci = { lugar, minutos: 60, energia: 3, dolorHoy: { [z]: hoy }, peticion: '' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, dia, ci).datos);
  const rh = s.ejercicios.filter(x => x.rol === 'rehab').map(x => `${x.id} ${x.series}×${x.reps} (fases ${lesiones.fasesDe(cat.ex(x.id), z)})`);
  const sinPlan = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos).ejercicios.filter(x => x.rol === 'rehab').map(x => `${x.id}(fases ${lesiones.fasesDe(cat.ex(x.id), z)})`);
  console.log(`${z} ficha ${ficha} → hoy ${hoy} (toca fase ${hoy >= 4 ? 1 : 2}) | plan: ${rehabPlan} | hoy con plan: ${rh.join(', ')} | hoy sin plan: ${sinPlan} | problemasSesion: ${JSON.stringify(ent.problemasSesion(S, s, ci))}`);
}
