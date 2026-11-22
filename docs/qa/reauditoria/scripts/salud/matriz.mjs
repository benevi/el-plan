import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const { comprobar } = await import('./criterio.mjs');
let seed = +(process.argv[2] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ZON = Object.keys(cat.ZONAS);
const DET = { tobillo_pie: [undefined, 'esguince', 'fascitis', 'aquiles'], lumbar: [undefined, 'contractura', 'hernia'], codo: [undefined, 'fuera', 'dentro'], cervical: [undefined, 'contractura', 'irradiado'] };
const OBJ = [['musculo'], ['fuerza'], ['perder'], ['resistencia'], ['salud'], ['natacion'], ['musculo', 'perder'], ['fuerza', 'perder'], ['perder', 'fuerza'], ['salud', 'natacion'], ['resistencia', 'musculo'], ['perder', 'musculo', 'salud']];
const N = +(process.argv[3] || 3000);
const fallos = {}; let total = 0;
const ejemplos = {};
const reg = (k, nombre) => { fallos[k] = (fallos[k] || 0) + 1; (ejemplos[k] = ejemplos[k] || []).length < 3 && ejemplos[k].push(nombre); };
for (let i = 0; i < N; i++) {
  const lugar = pick(['gym', 'piscina', 'casa', 'calle']);
  const mat = pick([[], ['mancuernas'], ['banda'], ['mancuernas', 'banda', 'banco'], ['bici'], ['botellas', 'banda']]);
  const nac = pick(['2008', '1995', '1980', '1966', '1960', '1956']);
  const perfil = { objetivos: pick(OBJ), lugares: [lugar], materialCasa: mat, nivel: pick([1, 2, 3]), datos: { sexo: '', altura: null, nacimiento: nac + '-05-01' }, nadar25: rnd() < 0.5 };
  const S = nuevoS(perfil);
  const nz = pick([0, 1, 1, 2]);
  const dolorHoy = {};
  const zs = [];
  for (let j = 0; j < nz; j++) {
    const z = pick(ZON); if (zs.includes(z)) continue; zs.push(z);
    const desde = pick(['2026-11-04', '2026-09-20', '2025-06-01', undefined]);
    S.perfil.lesiones.push({ id: 'l' + j, zona: z, dolor: pick([0, 1, 2, 3, 4, 5, 6, 8]), activa: true, desde, tipo: pick(['lesion', 'lesion', 'recurrente', 'puntual']), detalle: DET[z] ? pick(DET[z]) : undefined });
    if (rnd() < 0.85) dolorHoy[z] = pick([0, 1, 2, 3, 4, 5, 6, 7, 9]);
  }
  if (rnd() < 0.1) { const z = pick(ZON); if (!zs.includes(z)) dolorHoy[z] = pick([2, 5, 7]); }
  const minutos = pick([20, 30, 45, 60, 75, 90]);
  const energia = pick([1, 2, 3, 3, 3, 4, 5]);
  const ci = { lugar, minutos, energia, dolorHoy, peticion: '' };
  const conPlan = rnd() < 0.5;
  const nombre = `#${i} ${lugar} mat=${mat} nac=${nac} niv=${perfil.nivel} obj=${perfil.objetivos} les=${JSON.stringify(S.perfil.lesiones.map(l => [l.zona, l.dolor, l.desde, l.tipo, l.detalle]))} hoy=${JSON.stringify(dolorHoy)} min=${minutos} e=${energia} plan=${conPlan}`;
  let ses;
  try {
    const plan = conPlan ? ent.planReglas(S, { dias: [1, 3, 5], minutos, lugares: [lugar] }) : null;
    ses = modelo.crearSesion(ent.ajustarAlCheckin(S, plan ? plan.dias[0] : null, ci).datos);
  } catch (err) { reg('EXCEPCION ' + err.message.slice(0, 60), nombre); continue; }
  total++;
  const P = comprobar(S, ses, ci);
  for (const p of P) reg(p.replace(/\d+(\.\d+)?/g, 'N').replace(/(ej|cal|vue):\S+/, m => m), nombre + ' => ' + p);
  const val = ent.problemasSesion(S, ses, ci);
  if (val.length) reg('VALIDADOR: ' + val[0].replace(/\d+/g, 'N'), nombre + ' => ' + val.join('; '));
}
console.log('casos', total);
for (const [k, n] of Object.entries(fallos).sort((a, b) => b[1] - a[1])) { console.log(n, k); ejemplos[k].slice(0, 2).forEach(x => console.log('     ', x.slice(0, 600))); }
