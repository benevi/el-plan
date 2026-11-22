import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
for (const [z, lugar] of [['hombro', 'gym'], ['hombro', 'piscina'], ['cervical', 'gym'], ['muñeca', 'casa'], ['codo', 'gym'], ['cadera_lateral', 'casa'], ['dorsal', 'gym']]) {
  const S = nuevoS({ objetivos: ['salud'], nivel: 2, lugares: [lugar] }); S.perfil.lesiones.push({ id: 'l', zona: z, dolor: 5, activa: true, desde: '2025-01-01' });
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar, minutos: 60, energia: 3, dolorHoy: { [z]: 8 }, peticion: '' }).datos);
  console.log(`${z} 8/10 en ${lugar}: ` + s.vuelta.map(x => `${x.id || '«' + x.nombre + '»'} ${x.duracion}`).join(' | '));
}
console.log('r de circulos-brazos:', JSON.stringify(cat.ex('circulos-brazos').r), '| circulos-cadera:', JSON.stringify(cat.ex('circulos-cadera').r), '| balanceo:', JSON.stringify(cat.ex('balanceo-pierna-frontal').r), '| retraccion-cervical:', JSON.stringify(cat.ex('retraccion-cervical').r));
