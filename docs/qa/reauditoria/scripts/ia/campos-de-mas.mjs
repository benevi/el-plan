// Claves de más en la sesión de la IA (fuera del esquema): pasan tal cual a crearSesion (ia.js:184 y 189-190).
const R = '/home/user/wt/auditoria/';
const { fijarFecha } = await import(R + 'tests/ayuda/comun.mjs');
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, ponerRed } = await import(R + 'tests/ayuda/node.mjs');
const T = (n, d = '5 min', id = '') => ({ id, nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
nuevoS({});
const sesion = { nombre: 'Torso', foco: 'x', cambios: [], explicacion: ['x'], calentamiento: [T('Bici', '5 min', 'bici-estatica'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas'), E('bici-estatica', 'cardio', { reps: '10 min' })], vueltaCalma: [T('Estiramiento de pecho'), T('Estiramiento de cuádriceps')],
  fecha: '2020-01-01', tipo: 'dolorAlto', origen: { tipo: 'mia', id: 'no-existe' } };
ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion }) }));
const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true });
console.log({ fecha: r.sesion.fecha, tipo: r.sesion.tipo, origen: r.sesion.origen, fuente: r.sesion.fuente });
