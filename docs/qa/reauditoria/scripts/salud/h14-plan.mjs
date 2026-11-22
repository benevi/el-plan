// H14: planes semanales por reglas: techo semanal (C-VOL-1), C-REP-1, principiante ≤ 4 días de fuerza (C-REP-2),
// D-B y validador de cada día.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-16T10:00');
const { nuevoS, ent, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];
const TECHO = { 1: 12, 2: 16, 3: 20 }, SES = { 1: 6, 2: 8, 3: 10 };
const DIAS = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], '4c': [1, 2, 3, 4], '3c': [1, 2, 3] };
const fallos = {}; const ej = {};
const reg = (k, t) => { fallos[k] = (fallos[k] || 0) + 1; (ej[k] = ej[k] || []).length < 2 && ej[k].push(t); };
let n = 0;
for (const nivel of [1, 2, 3]) for (const obj of [['musculo'], ['fuerza'], ['perder'], ['salud'], ['natacion'], ['musculo', 'perder']]) for (const [dn, dias] of Object.entries(DIAS)) for (const lug of [['gym'], ['gym', 'piscina'], ['casa'], ['calle']]) for (const minutos of [45, 75]) for (const z of [null, 'rodilla', 'hombro']) {
  const S = nuevoS({ objetivos: obj, nivel, lugares: lug, materialCasa: ['mancuernas', 'banda'] });
  if (z) S.perfil.lesiones.push({ id: 'l', zona: z, dolor: 3, activa: true, desde: '2025-01-01' });
  const p = ent.planReglas(S, { dias, minutos, lugares: lug });
  n++;
  const nom = `niv${nivel} ${obj} ${dn} días ${lug} ${minutos} ${z || ''}`;
  const sem = {};
  const porDia = p.dias.map(d => { const m = {}; d.ejercicios.filter(x => x.rol === 'principal').forEach(x => { const e = cat.ex(x.id); m[e.m[0]] = (m[e.m[0]] || 0) + +x.series; (e.m.slice(1)).forEach(s => { sem[s] = (sem[s] || 0) + 0.5 * x.series; }); sem[e.m[0]] = (sem[e.m[0]] || 0) + +x.series; }); return { ds: d.diaSemana, m, d }; });
  GRANDES.forEach(g => { if ((sem[g] || 0) > TECHO[nivel] + (nivel === 2 && obj[0] === 'musculo' ? 2 : 0)) reg(`C-VOL-1 techo semanal de ${g}`, `${nom}: ${sem[g]}`); });
  porDia.forEach((a, i) => {
    GRANDES.forEach(g => { if ((a.m[g] || 0) > SES[nivel]) reg(`C-VOL-1 máx por sesión ${g}`, `${nom}: día ${a.ds} ${a.m[g]}`); });
    const b = porDia[i + 1];
    if (b && b.ds === a.ds + 1) GRANDES.forEach(g => { if ((a.m[g] || 0) >= 4 && (b.m[g] || 0) >= 4) reg(`C-REP-1 ${g} ≥4 dos días seguidos`, `${nom}: días ${a.ds}-${b.ds} ${a.m[g]}/${b.m[g]}`); });
    a.d.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).t !== 'distancia').forEach(x => { if (+x.series > (nivel === 1 ? 3 : 4)) reg('D-B series', `${nom}: ${x.id} ${x.series}`); if (cat.ex(x.id).niv > nivel && a.d.lugar !== 'piscina') reg('C-DOSIS-10 nivel', `${nom}: ${x.id}`); });
    const pr = ent.problemasSesion(S, a.d, { lugar: a.d.lugar, minutos: a.d.minutos, futuro: true, dolorHoy: {} });
    if (pr.length) reg('VALIDADOR ' + pr[0].replace(/\d+/g, 'N'), `${nom}: ${pr.join('; ')}`);
  });
  const fuerza = p.dias.filter(d => d.ejercicios.some(x => x.rol === 'principal')).length;
  if (nivel === 1 && fuerza > 4) reg('C-REP-2 principiante > 4 días de fuerza', `${nom}: ${fuerza}`);
  if (p.dias.length >= 7) reg('C-REP-2 sin día de descanso', nom);
}
console.log('planes', n);
Object.entries(fallos).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => { console.log(c, k); ej[k].forEach(x => console.log('    ', x.slice(0, 300))); });
