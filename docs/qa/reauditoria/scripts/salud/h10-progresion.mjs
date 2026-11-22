// H10: progresión (T6, C-PROG-*, C-PARON-1, D-B): casos que no cubren las pruebas.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, prog, hecha } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const ci = (o = {}) => ({ lugar: 'casa', minutos: 45, energia: 3, dolorHoy: {}, peticion: '', ...o });
// 1. Principiante con flexiones inclinadas al tope dos sesiones: ¿4 series (D-B dice 3)?
{
  const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: ['casa'] });
  hecha(S, 5, [{ id: 'flexiones-inclinadas', reps: '6-12', sets: [[0, 12], [0, 12], [0, 12]] }]);
  hecha(S, 2, [{ id: 'flexiones-inclinadas', reps: '6-12', sets: [[0, 12], [0, 12], [0, 12]] }]);
  const sg = prog.sugerir(S, 'flexiones-inclinadas', { series: 3, reps: '6-12' }, { energia: 3 });
  console.log('1. principiante, flexiones inclinadas 3×12 dos veces →', sg.series, 'series', sg.reps, '|', sg.motivo);
}
// 2. Energía 5: series del primer principal (principiante 3 → ?, intermedio fuerza 4 → ?)
for (const [nivel, obj, lugar] of [[1, 'musculo', 'gym'], [2, 'fuerza', 'gym'], [3, 'fuerza', 'gym']]) {
  const S = nuevoS({ objetivos: [obj], nivel, lugares: [lugar] });
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci({ lugar, minutos: 60, energia: 5 })).datos);
  const p = s.ejercicios.filter(x => x.rol === 'principal');
  console.log(`2. energía 5, nivel ${nivel} ${obj}: primer principal ${p[0].id} ${p[0].series}×${p[0].reps} (tope D-B ${nivel === 1 ? 3 : 4})`);
}
// 3. Parón: 30 días (H-8: −20 % y −1 serie), 60 días (−30 a −40 %, −40 % series), 100 días (como sin historial)
for (const dias of [16, 30, 60, 100]) {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  hecha(S, dias + 3, [{ id: 'prensa-piernas', reps: '6-10', sets: [[100, 10], [100, 10], [100, 10], [100, 10]] }]);
  hecha(S, dias, [{ id: 'prensa-piernas', reps: '6-10', sets: [[100, 10], [100, 10], [100, 10], [100, 10]] }]);
  const sg = prog.sugerir(S, 'prensa-piernas', { series: 4, reps: '6-10' }, { energia: 3 });
  console.log(`3. parón ${dias} d: ${sg.kg} kg, ${sg.series} series, ${sg.tipo} | ${sg.motivo}`);
}
// 4. Hombro 1/10 estable desde hace 8 meses (H-4): sube press de pecho en máquina; con hoy 4 no sube.
for (const hoy of [1, 4]) {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push({ id: 'l', zona: 'hombro', dolor: 1, activa: true, desde: '2026-03-01' });
  hecha(S, 30, [{ id: 'press-pecho-maquina', reps: '6-10', sets: [[40, 10], [40, 10], [40, 10]] }]);
  hecha(S, 3, [{ id: 'press-pecho-maquina', reps: '6-10', sets: [[40, 10], [40, 10], [40, 10]] }]);
  const sg = prog.sugerir(S, 'press-pecho-maquina', { series: 3, reps: '6-10' }, { energia: 3, dolorHoy: { hombro: hoy } });
  console.log(`4. hombro hoy ${hoy}: ${sg.tipo} ${sg.kg} kg | ${sg.motivo}`);
}
// 5. Lesión nueva (3 semanas) de rodilla, dolor 1: prensa al tope → no sube carga (C-LES-2)
{
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push({ id: 'l', zona: 'rodilla', dolor: 1, activa: true, desde: '2026-10-28' });
  hecha(S, 3, [{ id: 'prensa-piernas', reps: '6-10', sets: [[80, 10], [80, 10], [80, 10]] }]);
  const sg = prog.sugerir(S, 'prensa-piernas', { series: 3, reps: '6-10' }, { energia: 3, dolorHoy: { rodilla: 1 } });
  console.log(`5. rodilla nueva 1/10: ${sg.tipo} ${sg.kg} | ${sg.motivo}`);
}
// 6. C-DOLOR-7: hoy 2 puntos más que antes de la última sesión → −30 %
{
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  S.perfil.lesiones.push({ id: 'l', zona: 'hombro', dolor: 1, activa: true, desde: '2025-01-01' });
  const id = hecha(S, 3, [{ id: 'press-pecho-maquina', reps: '6-10', sets: [[40, 8], [40, 8], [40, 8]] }], { checkin: { dolor: { hombro: 1 }, energia: 3 } });
  const sg = prog.sugerir(S, 'press-pecho-maquina', { series: 3, reps: '6-10' }, { energia: 3, dolorHoy: { hombro: 3 } });
  console.log(`6. hombro de 1 a 3: ${sg.tipo} ${sg.kg} kg | ${sg.motivo}`);
}
