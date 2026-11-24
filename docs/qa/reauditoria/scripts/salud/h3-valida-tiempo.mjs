// H3: el validador marca como no válida la sesión que él mismo deja tras C-TIEMPO-2 (quita la rehabilitación
// de una zona B0-B1 para que quepa): una sesión correcta de la IA se descarta con el aviso de «seguridad».
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, ponerRed } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const S = nuevoS({ objetivos: ['perder'], nivel: 2, lugares: ['gym'] });
S.perfil.lesiones.push({ id: 'l', zona: 'hombro', dolor: 2, activa: true, desde: '2025-01-01' });
const T = (n, d) => ({ nombre: n, detalle: '', duracion: d });
const E = (id, rol, series, reps, descanso) => ({ id, rol, series, reps, descanso, kg: null, nota: '' });
const ia = { nombre: 'IA', calentamiento: [{ id: 'bici-estatica', nombre: 'Bici estática', duracion: '3 min' }, { id: 'circulos-cadera', nombre: 'Círculos de cadera', duracion: '2 min' }],
  ejercicios: [E('rotacion-externa-banda', 'rehab', 3, '15', 45), E('prensa-piernas', 'principal', 3, '10-12', 90), E('jalon-pecho', 'principal', 3, '10-12', 90), E('curl-femoral-sentado', 'principal', 2, '12-15', 45), E('bici-estatica', 'cardio', 1, '15 min', 0)],
  vueltaCalma: [{ id: 'estiramiento-isquios-pie', nombre: 'Estiramiento de isquios de pie', duracion: '1 min' }, { id: 'estiramiento-gemelo-pared', nombre: 'Estiramiento de gemelo', duracion: '1 min' }, T('Respiración', '1 min')] };
let llamadas = 0;
ponerRed(true, async () => { llamadas++; return { ok: true, status: 200, json: async () => ({ sesion: structuredClone(ia) }) }; });
const ci = { lugar: 'gym', minutos: 30, energia: 3, dolorHoy: { hombro: 2 }, peticion: '', forzarIA: true };
const r = await ent.crearSesionHoy(ci);
console.log('llamadas IA:', llamadas, '| fuente:', r.sesion.fuente, '| aviso:', r.aviso);
const v = ent.validarSesion(S, structuredClone(ia), { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 2 }, energia: 3, origen: 'ia' });
console.log('validarSesion.valida =', v.valida, '| problemas tras corregir:', ent.problemasSesion(S, v.sesion, { lugar: 'gym', minutos: 30, dolorHoy: { hombro: 2 } }));
console.log('cambios:', v.cambios);
