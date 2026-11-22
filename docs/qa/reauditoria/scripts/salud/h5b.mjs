import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['casa'], materialCasa: [] });
const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar: 'casa', minutos: 90, energia: 3, dolorHoy: {}, peticion: '' }).datos);
s.ejercicios.forEach(x => console.log(x.rol, x.id, 'niv', cat.ex(x.id).niv, x.series + '×' + x.reps, x.descanso + 's', '|', x.nota));
console.log(cat.EJERCICIOS.filter(e => e.m[0] === 'triceps' && e.l.includes('casa') && e.mat.includes('peso corporal')).map(e => e.id + ':' + e.niv));
