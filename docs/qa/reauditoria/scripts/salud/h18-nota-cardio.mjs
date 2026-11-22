// H18: la nota del cardio describe otro ejercicio (la del de referencia k=0 del validador): «alterna con» el propio
// ejercicio o la condición de la ficha de otra máquina (C-CARDIO-6).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const COND = Object.fromEntries(Object.values(cat.ZONAS).flatMap(Z => Object.entries((Z.cardio || {}).condiciones || {}).map(([id, t]) => [t, id])));
let n = 0, mal = 0; const ej = [];
for (const lugar of ['gym', 'casa', 'calle']) for (const z of [null, 'rodilla', 'hombro', 'lumbar', 'codo', 'cadera_lateral']) for (const obj of [['salud'], ['perder'], ['musculo']]) for (let dia = 0; dia < 7; dia++) {
  fijarFecha(`2026-11-${16 + dia}T10:00`);
  const S = nuevoS({ objetivos: obj, nivel: 2, lugares: [lugar] }); if (z) S.perfil.lesiones.push({ id: 'l', zona: z, dolor: 2, activa: true, desde: '2025-01-01' });
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar, minutos: 60, energia: 3, dolorHoy: z ? { [z]: 2 } : {}, peticion: '' }).datos);
  const c = s.ejercicios.find(x => x.rol === 'cardio'); if (!c) continue; n++;
  const nombre = cat.ex(c.id).n.toLowerCase();
  const m = (c.nota || '').match(/alterna con ([^)]+)\)/);
  const otraCond = Object.entries(COND).find(([t, id]) => (c.nota || '').includes(t) && id !== c.id && !(c.nota || '').includes('alterna'));
  if ((m && m[1].includes(nombre)) || otraCond) { mal++; if (ej.length < 5) ej.push(`${lugar} ${z} ${obj} día ${dia}: ${c.id} → «${c.nota}»`); }
}
console.log(`${mal} de ${n} notas de cardio hablan de otro ejercicio\n` + ej.join('\n'));
