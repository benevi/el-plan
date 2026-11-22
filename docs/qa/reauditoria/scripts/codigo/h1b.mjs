import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, cat, modelo } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
S.perfil.lesiones.push({ id: 'l', zona: 'rodilla', dolor: 3, activa: true, desde: '2026-11-10' });
const hoy = { rodilla: 3 };
const ci = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: hoy, peticion: '' };
const ses = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
const res = {};
for (const e of cat.EJERCICIOS.filter(e => e.l.includes('gym'))) {
  const alts = cat.alternativas(e, 'gym', S.perfil, { excluir: [e.id], dolorHoy: hoy, nivel: 2 }).slice(0, 8);
  const conR = alts.filter(a => (a.r || {}).rodilla);
  if (conR.length) res[e.id] = conR.map(a => `${a.id}(r=${a.r.rodilla})`);
}
console.log(Object.keys(res).length, 'ejercicios cuyo «Cambiar» ofrece algo con riesgo de rodilla:'); console.log("distintos:", [...new Set(Object.values(res).flat())].join(", "));for (const [k, v] of Object.entries(res).slice(0, 3)) console.log(' ', k, '→', v.join(', '));
// Validar una sesión con uno de ellos puesto como principal
const [orig, lst] = Object.entries(res)[0] || [];
if (orig) {
  const idAlt = lst[0].split('(')[0];
  const copia = structuredClone(ses); const i = copia.ejercicios.findIndex(x => x.rol === 'principal'); copia.ejercicios[i] = { ...copia.ejercicios[i], id: idAlt };
  console.log(`\nSesión con ${idAlt} puesto por «Cambiar»: problemas según el validador →`, ent.problemasSesion(S, copia, ci));
}
