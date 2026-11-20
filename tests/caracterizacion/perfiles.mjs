// Perfiles de las pruebas de caracterización del entrenador (PR 6).
// Variados a propósito: objetivos, nivel, lesiones y dolor, lugares, material, minutos, con y sin plan,
// con historial (progresión, estancados, comentarios, gustos, peso, dolor que sube) y uso de la IA.
// Cada perfil es solo datos; generar.mjs lo convierte en un estado y fotografía lo que sale del entrenador.

const lesion = (zona, dolor, extra = {}) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: '2026-01-01', tipo: '', nota: '', ...extra });
const serie = (kg, reps, n = 3) => Array.from({ length: n }, () => [kg, reps]);

// Historiales: [diasAtras, [{ id, sets, reps?, comentario? }], extra?]
const HIST = {
  // Tres semanas subiendo en los básicos de gimnasio.
  progresa: [
    [20, [{ id: 'press-pecho-maquina', sets: serie(30, 10) }, { id: 'jalon-pecho', sets: serie(35, 10) }, { id: 'prensa-piernas', sets: serie(80, 10) }]],
    [13, [{ id: 'press-pecho-maquina', sets: serie(32.5, 12) }, { id: 'jalon-pecho', sets: serie(37.5, 12) }, { id: 'prensa-piernas', sets: serie(90, 12) }]],
    [6, [{ id: 'press-pecho-maquina', sets: serie(35, 12) }, { id: 'jalon-pecho', sets: serie(40, 12) }, { id: 'prensa-piernas', sets: serie(100, 12) }]],
  ],
  // Estancado en press y prensa, comentarios de máquina ocupada y de que cuesta.
  estancado: [
    [16, [{ id: 'press-pecho-maquina', sets: serie(40, 8) }, { id: 'prensa-piernas', sets: serie(100, 8) }, { id: 'remo-sentado-polea', sets: serie(40, 10) }]],
    [9, [{ id: 'press-pecho-maquina', sets: serie(40, 8) }, { id: 'prensa-piernas', sets: serie(100, 8) }, { id: 'remo-sentado-polea', sets: serie(40, 10), comentario: 'Estaba ocupada, tuve que esperar' }]],
    [3, [{ id: 'press-pecho-maquina', sets: serie(40, 7), comentario: 'Muy difícil, no llegué' }, { id: 'prensa-piernas', sets: serie(100, 8) }, { id: 'remo-sentado-polea', sets: serie(40, 10) }]],
  ],
  // Le molesta un ejercicio y entrenó ayer pierna fuera del plan (músculos cargados).
  molesta: [
    [8, [{ id: 'sentadilla-goblet', sets: serie(16, 10), comentario: 'Me duele la rodilla al bajar' }, { id: 'hip-thrust', sets: serie(40, 10) }]],
    [1, [{ id: 'prensa-piernas', sets: serie(90, 12, 4) }, { id: 'extension-cuadriceps', sets: serie(30, 12, 4) }, { id: 'curl-femoral-tumbado', sets: serie(25, 12, 4) }, { id: 'hip-thrust', sets: serie(50, 10, 4) }]],
  ],
  // Esta semana ya entrenó lunes y martes (fecha fija: miércoles 18-nov-2026).
  semana: [
    [2, [{ id: 'press-pecho-maquina', sets: serie(30, 10) }, { id: 'jalon-pecho', sets: serie(35, 10) }]],
    [1, [{ id: 'prensa-piernas', sets: serie(80, 10) }, { id: 'hip-thrust', sets: serie(40, 10) }], { cierre: { esfuerzo: 3, dolor: {}, comentario: 'Bien, aunque me aburre la cinta' } }],
  ],
  // En casa con peso corporal: estancado en flexiones.
  casa: [
    [15, [{ id: 'flexiones', sets: serie(0, 12) }, { id: 'sentadilla-peso-corporal', sets: serie(0, 20) }]],
    [8, [{ id: 'flexiones', sets: serie(0, 12) }, { id: 'sentadilla-peso-corporal', sets: serie(0, 22) }]],
    [4, [{ id: 'flexiones', sets: serie(0, 12), comentario: 'Demasiado fácil ya' }, { id: 'sentadilla-peso-corporal', sets: serie(0, 25) }]],
  ],
};

// Peso que no baja en 4 semanas, y dolor de rodilla que sube en las dos últimas.
const pesoQuieto = [{ fecha: '2026-10-14', peso: 82 }, { fecha: '2026-10-28', peso: 82.4 }, { fecha: '2026-11-16', peso: 82.6 }];
const pesoRapido = [{ fecha: '2026-10-14', peso: 70 }, { fecha: '2026-11-16', peso: 66 }];
const dolorSube = [
  { fecha: '2026-10-25', zona: 'rodilla', dolor: 2 }, { fecha: '2026-10-30', zona: 'rodilla', dolor: 2 },
  { fecha: '2026-11-10', zona: 'rodilla', dolor: 5 }, { fecha: '2026-11-15', zona: 'rodilla', dolor: 5 },
];

const disp = (dias, minutos, diasSemana = []) => ({ dias, minutos, diasSemana });

// ci: check-in base del perfil (se varía en generar.mjs). semana: la que se pide al planificar.
export const PERFILES = [
  { nombre: 'músculo principiante gym', perfil: { objetivos: ['musculo'], nivel: 1, lugares: ['gym'], disponibilidad: disp(3, 60) }, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'músculo intermedio gym con historial', perfil: { objetivos: ['musculo'], nivel: 2, lugares: ['gym'], disponibilidad: disp(4, 75) }, historial: 'progresa', plan: true, ci: { lugar: 'gym', minutos: 75 } },
  { nombre: 'fuerza avanzado 3 días', perfil: { objetivos: ['fuerza'], nivel: 3, lugares: ['gym'], disponibilidad: disp(3, 90) }, plan: true, ci: { lugar: 'gym', minutos: 90 } },
  { nombre: 'fuerza principiante estancado', perfil: { objetivos: ['fuerza'], nivel: 1, lugares: ['gym'], disponibilidad: disp(3, 60) }, historial: 'estancado', ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'perder gym peso quieto', perfil: { objetivos: ['perder'], nivel: 1, lugares: ['gym'], disponibilidad: disp(4, 60) }, medidas: pesoQuieto, historial: 'progresa', plan: true, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'perder rápido casa', perfil: { objetivos: ['perder'], nivel: 1, lugares: ['casa'], materialCasa: ['mancuernas', 'banda'], disponibilidad: disp(3, 45) }, medidas: pesoRapido, ci: { lugar: 'casa', minutos: 45 } },
  { nombre: 'músculo+perder gym y piscina', perfil: { objetivos: ['musculo', 'perder'], nivel: 2, lugares: ['gym', 'piscina'], disponibilidad: disp(5, 60, [1, 2, 3, 4, 5]) }, plan: true, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'resistencia intermedio calle', perfil: { objetivos: ['resistencia'], nivel: 2, lugares: ['calle'], disponibilidad: disp(3, 45) }, plan: true, ci: { lugar: 'calle', minutos: 45 } },
  { nombre: 'resistencia principiante gym 30 min', perfil: { objetivos: ['resistencia'], nivel: 1, lugares: ['gym'], disponibilidad: disp(2, 30) }, ci: { lugar: 'gym', minutos: 30 } },
  { nombre: 'salud mayor con lumbar', perfil: { objetivos: ['salud'], nivel: 1, lugares: ['gym'], lesiones: [lesion('lumbar', 3, { nota: 'Hernia L5' })], disponibilidad: disp(3, 45) }, plan: true, ci: { lugar: 'gym', minutos: 45 } },
  { nombre: 'salud piscina sola', perfil: { objetivos: ['salud'], nivel: 1, lugares: ['piscina'], disponibilidad: disp(2, 45) }, plan: true, ci: { lugar: 'piscina', minutos: 45 } },
  { nombre: 'natación intermedio piscina+gym', perfil: { objetivos: ['natacion'], nivel: 2, lugares: ['piscina', 'gym'], disponibilidad: disp(4, 60) }, plan: true, ci: { lugar: 'piscina', minutos: 60 } },
  { nombre: 'natación+salud solo piscina', perfil: { objetivos: ['natacion', 'salud'], nivel: 1, lugares: ['piscina'], disponibilidad: disp(3, 40) }, ci: { lugar: 'piscina', minutos: 40 } },
  { nombre: 'trocanteritis gym y piscina', perfil: { objetivos: ['perder', 'musculo'], nivel: 2, lugares: ['gym', 'piscina'], lesiones: [lesion('cadera_lateral', 4, { nota: 'Trocanteritis derecha' })], disponibilidad: disp(4, 60, [1, 2, 4, 5]) }, historial: 'semana', plan: true, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'rodilla con dolor que sube', perfil: { objetivos: ['musculo'], nivel: 2, lugares: ['gym'], lesiones: [lesion('rodilla', 3)], disponibilidad: disp(3, 60) }, dolor: dolorSube, historial: 'molesta', plan: true, ci: { lugar: 'gym', minutos: 60, dolorHoy: { rodilla: 4 } } },
  { nombre: 'hombro y codo casa', perfil: { objetivos: ['musculo'], nivel: 1, lugares: ['casa'], materialCasa: ['mancuernas', 'banco', 'banda'], lesiones: [lesion('hombro', 4), lesion('codo', 2)], disponibilidad: disp(3, 50) }, plan: true, ci: { lugar: 'casa', minutos: 50 } },
  { nombre: 'cervical y muñeca calle', perfil: { objetivos: ['salud', 'resistencia'], nivel: 1, lugares: ['calle'], lesiones: [lesion('cervical', 2), lesion('muñeca', 3)], disponibilidad: disp(3, 40) }, ci: { lugar: 'calle', minutos: 40 } },
  { nombre: 'tobillo en piscina y gym', perfil: { objetivos: ['perder'], nivel: 1, lugares: ['gym', 'piscina'], lesiones: [lesion('tobillo_pie', 5)], disponibilidad: disp(4, 50) }, plan: true, ci: { lugar: 'piscina', minutos: 50 } },
  { nombre: 'lesión inactiva', perfil: { objetivos: ['fuerza', 'musculo'], nivel: 2, lugares: ['gym'], lesiones: [{ ...lesion('lumbar', 6), activa: false }], disponibilidad: disp(4, 70) }, plan: true, ci: { lugar: 'gym', minutos: 70 } },
  { nombre: 'dolor alto hoy en lumbar', perfil: { objetivos: ['musculo'], nivel: 2, lugares: ['gym'], lesiones: [lesion('lumbar', 3)], disponibilidad: disp(3, 60) }, plan: true, ci: { lugar: 'gym', minutos: 60, dolorHoy: { lumbar: 8 } } },
  { nombre: 'dolor nuevo en hombro', perfil: { objetivos: ['perder'], nivel: 1, lugares: ['gym'], disponibilidad: disp(3, 60) }, plan: true, ci: { lugar: 'gym', minutos: 60, dolorHoy: { hombro: 3 } } },
  { nombre: 'gustos y rechazos', perfil: { objetivos: ['musculo'], nivel: 2, lugares: ['gym'], gustos: { 'prensa-piernas': 'rechazo', 'jalon-pecho': 'gusta', 'press-pecho-maquina': 'nogusta' }, disponibilidad: disp(3, 60) }, historial: 'estancado', plan: true, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'casa sin material', perfil: { objetivos: ['musculo'], nivel: 1, lugares: ['casa'], materialCasa: [], disponibilidad: disp(3, 30) }, historial: 'casa', ci: { lugar: 'casa', minutos: 30 } },
  { nombre: 'casa con todo el material', perfil: { objetivos: ['fuerza'], nivel: 2, lugares: ['casa'], materialCasa: ['mancuernas', 'banda', 'banco', 'botellas', 'barra fija', 'comba', 'rueda'], disponibilidad: disp(4, 60) }, plan: true, ci: { lugar: 'casa', minutos: 60 } },
  { nombre: 'todos los lugares 6 días', perfil: { objetivos: ['musculo'], nivel: 3, lugares: ['gym', 'piscina', 'casa', 'calle'], materialCasa: ['mancuernas'], disponibilidad: disp(6, 75) }, plan: true, ci: { lugar: 'calle', minutos: 75 } },
  { nombre: '7 días resistencia+salud', perfil: { objetivos: ['resistencia', 'salud'], nivel: 2, lugares: ['gym', 'calle'], disponibilidad: disp(7, 45) }, plan: true, ci: { lugar: 'gym', minutos: 45 } },
  { nombre: '1 día 20 minutos', perfil: { objetivos: ['musculo', 'fuerza'], nivel: 1, lugares: ['gym'], disponibilidad: disp(1, 20) }, plan: true, ci: { lugar: 'gym', minutos: 20 } },
  { nombre: 'sin objetivos', perfil: { objetivos: [], nivel: 1, lugares: ['gym'], disponibilidad: disp(3, 60) }, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'modo ahorro con plan y semana empezada', perfil: { objetivos: ['musculo', 'perder'], nivel: 1, lugares: ['gym'], usoIA: 'ahorro', disponibilidad: disp(3, 60, [1, 3, 5]) }, historial: 'semana', plan: true, ci: { lugar: 'gym', minutos: 60 } },
  { nombre: 'modo siempre IA, petición de pierna', perfil: { objetivos: ['fuerza'], nivel: 2, lugares: ['gym', 'casa'], materialCasa: ['mancuernas'], usoIA: 'siempre', disponibilidad: disp(4, 60) }, plan: true, ci: { lugar: 'gym', minutos: 60, peticion: 'Hoy quiero pierna' } },
  { nombre: 'cambio de lugar al check-in', perfil: { objetivos: ['musculo'], nivel: 2, lugares: ['gym', 'casa'], materialCasa: ['banda'], disponibilidad: disp(3, 60, [1, 3, 5]) }, plan: true, ci: { lugar: 'casa', minutos: 40 } },
  { nombre: 'perder con rodilla y comentarios', perfil: { objetivos: ['perder', 'salud'], nivel: 1, lugares: ['gym', 'calle'], lesiones: [lesion('rodilla', 2)], disponibilidad: disp(4, 50) }, historial: 'molesta', medidas: pesoQuieto, dolor: dolorSube, plan: true, ci: { lugar: 'calle', minutos: 50 } },
].map(p => ({ ...p, historial: p.historial ? HIST[p.historial] : [] }));
