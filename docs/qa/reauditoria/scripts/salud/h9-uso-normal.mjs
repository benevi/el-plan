// H9: tareas que la ficha de la zona limita a B0-B1 (uso «normal», C-EST-2) aparecen con dolor 4-6 y en el día de dolor alto.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const out = [];
for (const [z, Z] of Object.entries(cat.ZONAS)) {
  const normales = [...Z.tareas.calentar, ...Z.tareas.estirar].filter(t => t.uso === 'normal' && t.id).map(t => t.id);
  if (!normales.length) continue;
  for (const lugar of ['gym', 'casa', 'calle', 'piscina']) for (const hoy of [5, 8]) for (const minutos of [45, 60, 90]) {
    const S = nuevoS({ objetivos: ['salud'], nivel: 2, lugares: [lugar], materialCasa: ['banda'] });
    S.perfil.lesiones.push({ id: 'l', zona: z, dolor: 5, activa: true, desde: '2025-01-01' });
    const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar, minutos, energia: 3, dolorHoy: { [z]: hoy }, peticion: '' }).datos);
    const hay = [...s.calentamiento, ...s.vuelta].filter(t => normales.includes(t.id)).map(t => t.id);
    if (hay.length) out.push(`${z} ${hoy}/10 ${lugar} ${minutos}: ${[...new Set(hay)].join(', ')}`);
  }
  console.log(z, 'uso normal (solo B0-B1):', normales.join(', '));
}
const resumen = {};
out.forEach(l => { const k = l.split(' ')[0] + ' ' + l.split(' ')[1] + ' → ' + l.split(': ')[1]; resumen[k] = (resumen[k] || 0) + 1; });
console.log(`\n${out.length} sesiones con tareas «normal» en B2/B3:`); Object.entries(resumen).forEach(([k, n]) => console.log(' ', n, '×', k));
