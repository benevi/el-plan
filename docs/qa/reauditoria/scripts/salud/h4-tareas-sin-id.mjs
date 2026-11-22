// H4: las tareas de la ficha de la zona (estiramiento de vuelta y activación del calentamiento) van solo por
// nombre, sin id: el validador no comprueba su riesgo ni su lugar (C-EST-2, C-EST-4).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const porNombre = Object.fromEntries(cat.EJERCICIOS.map(e => [e.n, e]));
function ver(titulo, z, ficha, hoy, lugar, minutos, conPlan) {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: [lugar], materialCasa: ['banda'] });
  S.perfil.lesiones.push({ id: 'l', zona: z, dolor: ficha, activa: true, desde: '2025-01-01' });
  const plan = conPlan ? ent.planReglas(S, { dias: [1, 3, 5], minutos, lugares: [lugar] }) : null;
  const ci = { lugar, minutos, energia: 3, dolorHoy: { [z]: hoy }, peticion: '' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, plan ? plan.dias[0] : null, ci).datos);
  const tareas = [...s.calentamiento.map(t => ['cal', t]), ...s.vuelta.map(t => ['vuelta', t])].filter(([, t]) => !t.id && porNombre[t.nombre]);
  console.log(`${titulo}: ${tareas.map(([d, t]) => { const e = porNombre[t.nombre]; return `${d} «${t.nombre}» sin id (l=${e.l}, r=${JSON.stringify(e.r || {})})`; }).join(' · ') || '—'} | problemasSesion: ${JSON.stringify(ent.problemasSesion(S, s, ci))}`);
}
ver('hombro 1 en el plan, hoy 6 (B2)', 'hombro', 1, 6, 'gym', 60, true);
ver('rodilla 5 en la calle, 60 min', 'rodilla', 5, 5, 'calle', 60, false);
ver('lumbar 5 en la calle, 75 min', 'lumbar', 5, 5, 'calle', 75, false);
ver('lumbar 5 en la piscina, 60 min', 'lumbar', 5, 5, 'piscina', 60, false);
ver('cadera 2 en la piscina, 60 min', 'cadera_lateral', 2, 2, 'piscina', 60, false);
ver('codo 2 en la calle, 60 min', 'codo', 2, 2, 'calle', 60, false);
