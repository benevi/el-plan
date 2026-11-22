// H5: un intermedio en casa sin material recibe flexiones diamante (nivel 3), C-DOSIS-10 / H-7.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const out = [];
for (const lugar of ['casa', 'calle', 'gym']) for (const nivel of [1, 2]) for (const obj of [['fuerza'], ['musculo'], ['perder'], ['salud'], ['resistencia']]) for (const minutos of [45, 60, 75, 90]) for (const mat of [[], ['banda'], ['mancuernas']]) {
  const S = nuevoS({ objetivos: obj, nivel, lugares: [lugar], materialCasa: mat });
  const ci = { lugar, minutos, energia: 3, dolorHoy: {}, peticion: '' };
  const d = ent.ajustarAlCheckin(S, null, ci);
  const s = modelo.crearSesion(d.datos);
  const alto = s.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).niv > nivel);
  if (alto.length) out.push(`${lugar} mat=[${mat}] nivel ${nivel} ${obj} ${minutos} min: ${alto.map(x => `${x.id} (niv ${cat.ex(x.id).niv})`).join(', ')} | ${d.cambios.filter(c => /añado|Tienes/.test(c)).join(' / ')}`);
}
console.log(out.length + ' casos\n' + out.slice(0, 12).join('\n'));
