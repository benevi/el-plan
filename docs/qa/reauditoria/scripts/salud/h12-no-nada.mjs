// H12: quien NO sabe nadar 2 × 25 m (perfil sin «nadar25») pero tiene nivel 2-3 recibe crol, series de 50 m y
// nado continuo; y al principiante que no sabe nadar se le manda aquajogging sin decirle que sea donde haga pie.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
for (const nivel of [1, 2, 3]) {
  const S = nuevoS({ objetivos: ['perder'], nivel, lugares: ['piscina'] }); // nadar25 sin marcar
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar: 'piscina', minutos: 45, energia: 3, dolorHoy: {}, peticion: '' }).datos);
  console.log(`nivel ${nivel}, NO sabe nadar 2×25: ` + s.ejercicios.map(x => `${x.id} ${x.series}×${x.reps}`).join(' | '));
  const aj = s.ejercicios.find(x => x.id === 'aquajogging');
  if (aj) console.log('   nota aquajogging:', aj.nota, '\n   ficha paso 1:', cat.ex('aquajogging').p[0]);
}
