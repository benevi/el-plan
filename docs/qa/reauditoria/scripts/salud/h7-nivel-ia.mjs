// H7: lo que propone la IA por encima del nivel de un principiante se queda (C-DOSIS-10; NUNCA de CR-06 y CR-08).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, cat, ponerRed } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: '', ...o });
const T = (n, id) => ({ ...(id ? { id } : {}), nombre: n, detalle: '', duracion: '2 min' });
async function caso(titulo, perfil, ci, ejercicios) {
  const S = nuevoS(perfil);
  const r = { nombre: 'IA', calentamiento: [T('Marcha', 'marcha-estatica'), T('Círculos de cadera', 'circulos-cadera')], ejercicios, vueltaCalma: [T('Estiramiento de gemelo en la pared', 'estiramiento-gemelo-pared'), T('Respiración')] };
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: structuredClone(r) }) }));
  const { sesion } = await ent.crearSesionHoy({ ...ci, forzarIA: true });
  console.log(`${titulo} (fuente ${sesion.fuente}): ` + sesion.ejercicios.filter(x => x.rol === 'principal').map(x => `${x.id}${cat.ex(x.id).niv > perfil.nivel ? ` [NIVEL ${cat.ex(x.id).niv} > ${perfil.nivel}]` : ''}`).join(', '));
}
await caso('CR-06 principiante, casa sin material, perder, 45 min', { objetivos: ['perder'], nivel: 1, lugares: ['casa'], materialCasa: [] }, { lugar: 'casa', minutos: 45, energia: 3, dolorHoy: {} },
  [E('flexiones'), E('sentadilla-peso-corporal'), E('remo-toalla'), E('puente-gluteo'), E('marcha-estatica', 'cardio', { reps: '15 min' })]);
await caso('CR-08 principiante, gimnasio, fuerza, 60 min', { objetivos: ['fuerza'], nivel: 1, lugares: ['gym'] }, { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {} },
  [E('press-banca-barra', 'principal', { reps: '6-8', descanso: 150 }), E('peso-muerto-rumano', 'principal', { reps: '6-8', descanso: 150 }), E('zancadas'), E('jalon-pecho'), E('bici-estatica', 'cardio', { reps: '10 min' })]);
ponerRed(false);
