// H11: «Mis sesiones» (C-MIA-1, C-MIA-2) con todas las zonas, dolor 0-9, lugares y energía, por el comprobador del criterio.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const { comprobar } = await import('./criterio.mjs');
const MIAS = {
  'abdominales y flexiones (casa)': { lugar: 'casa', ejercicios: [['crunch', 3, '15', 30], ['flexiones', 3, '8-12', 60], ['plancha', 3, '30s', 30], ['elevacion-piernas', 3, '12', 30]] },
  'pierna pesada (gym)': { lugar: 'gym', ejercicios: [['sentadilla-barra', 4, '5', 150], ['peso-muerto-rumano', 4, '6', 150], ['zancadas', 3, '10 c/pierna', 0], ['extension-cuadriceps', 3, '12', 0]] },
  'torso avanzado (gym)': { lugar: 'gym', ejercicios: [['press-banca-barra', 4, '4-6', 60], ['dominadas', 4, '6', 60], ['press-militar-mancuernas', 3, '6-8', 60], ['fondos-paralelas', 3, '8', 30], ['bici-estatica', 1, '20 min', 0]] },
  'piscina (piscina)': { lugar: 'piscina', ejercicios: [['crol', 8, '50 m', 30], ['espalda', 6, '25 m', 30], ['patada-crol-tabla', 4, '25 m', 30]] },
};
const fallos = {}, ej = {};
let n = 0;
for (const [nm, m] of Object.entries(MIAS)) for (const z of [null, ...Object.keys(cat.ZONAS)]) for (const hoy of [0, 2, 5, 8]) for (const energia of [1, 3, 5]) for (const lugar of [m.lugar, 'calle']) {
  if (!z && hoy) continue;
  const S = nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: [lugar], materialCasa: ['banda'] });
  if (z) S.perfil.lesiones.push({ id: 'l', zona: z, dolor: hoy, activa: true, desde: '2025-01-01' });
  S.misSesiones = [{ id: 'm1', nombre: nm, lugar: m.lugar, minutos: 45, creada: '2026-11-01T10:00:00Z', ejercicios: m.ejercicios.map(([id, series, reps, descanso]) => ({ id, rol: cat.ex(id).m[0] === 'cardio' ? 'cardio' : 'principal', series, reps, descanso })) }];
  const ci = { lugar, minutos: 45, energia, dolorHoy: z ? { [z]: hoy } : {}, peticion: '', mia: 'm1' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
  n++;
  const P = comprobar(S, s, ci, { mia: true });
  // C-MIA-2: lo de nivel superior que se queda lleva la nota de técnica.
  s.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).niv > 1 && !/nivel más alto/.test(x.nota || '')).forEach(x => P.push(`C-MIA-2 ${x.id} sin nota de técnica`));
  P.forEach(p => { const k = p.replace(/\d+/g, 'N'); fallos[k] = (fallos[k] || 0) + 1; (ej[k] = ej[k] || []).length < 2 && ej[k].push(`${nm} | ${lugar} | ${z} ${hoy} | e${energia} => ${p} || ${s.ejercicios.map(x => x.rol[0] + ':' + x.id + ' ' + x.series + '×' + x.reps).join(', ')}`); });
}
console.log('sesiones', n);
Object.entries(fallos).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => { console.log(c, k); ej[k].forEach(x => console.log('    ', x.slice(0, 420))); });
