const R = '/home/user/wt/auditoria/';
const { CASOS, prepararCaso } = await import(R + 'tests/ia/casos.mjs');
const p = await prepararCaso(CASOS.find(c => c.id === 'CR-26'));
const s = p.resultado.sesion;
console.log(s.fuente, JSON.stringify(s.explicacion, null, 1));
console.log(s.ejercicios.map(x => `${x.id}/${x.rol}/${x.series}x${x.reps} · ${x.nota}`).join('\n'));
