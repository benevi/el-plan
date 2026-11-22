// Con las respuestas REALES guardadas: ¿sobreviven las notas de salud/edad del validador en la explicación guardada?
const R = '/home/user/wt/auditoria/';
const { CASOS, prepararCaso } = await import(R + 'tests/ia/casos.mjs');
const { ent, est, ponerRed } = await import(R + 'tests/ayuda/node.mjs');
import fs from 'node:fs';
const D = '/home/user/wt/pr11-prompt/tests/ia/informes/';
for (const [a, id] of [['informe-2026-11-20-14-39.json', 'CR-25'], ['informe-2026-11-20-14-39.json', 'CR-24'], ['informe-2026-11-20-15-18.json', 'CR-25'], ['informe-2026-11-20-15-18.json', 'CR-24']]) {
  const f = JSON.parse(fs.readFileSync(D + a, 'utf8')).find(x => x.id === id);
  const caso = CASOS.find(c => c.id === id);
  await prepararCaso(caso);
  est.cambiar(S => { S.sesiones = Object.fromEntries(Object.entries(S.sesiones).filter(([, s]) => s.estado === 'hecha')); }, 'prueba');
  const v = ent.validarSesion(est.estado(), JSON.parse(JSON.stringify({ ...f.respuesta, vuelta: f.respuesta.vueltaCalma })), { lugar: caso.ci.lugar, minutos: caso.ci.minutos, dolorHoy: caso.ci.dolorHoy || {}, energia: caso.ci.energia || 3, origen: 'ia' });
  const notasApp = v.sesion.explicacion.filter(t => /Tus notas hablan de tu salud|repeticiones de margen en cada serie/.test(t));
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: JSON.parse(JSON.stringify(f.respuesta)) }) }));
  const r = await ent.crearSesionHoy({ forzarIA: true, peticion: '', ...caso.ci });
  ponerRed(false);
  const quedan = notasApp.filter(n => r.sesion.explicacion.includes(n));
  console.log(`${a.slice(8, 24)} ${id} ${f.config}: cambios IA ${(f.respuesta.cambios || []).length}, explicación IA ${(f.respuesta.explicacion || []).length} → notas de salud del validador ${notasApp.length}, guardadas ${quedan.length}`);
  notasApp.filter(n => !quedan.includes(n)).forEach(n => console.log('   PERDIDA:', n));
}
