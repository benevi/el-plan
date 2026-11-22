// Nombres y listas fijas que comparten todas las áreas.

export const PERSONAS = {
  victor: { nombre: 'Víctor', color: '#4DD0E8', color2: '#2A9BC2' },
  virginia: { nombre: 'Virginia', color: '#C77DFF', color2: '#9D4EDD' },
};

// «antebrazo» (decisión 9 de docs/criterio.md) es solo para la rehabilitación de codo y muñeca: sin volumen semanal propio.
export const MUSCULOS = {
  pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps', antebrazo: 'Antebrazo', core: 'Core',
  gluteo: 'Glúteo', cuadriceps: 'Cuádriceps', isquios: 'Isquios', gemelo: 'Gemelo',
  cardio: 'Cardio', movilidad: 'Movilidad', natacion: 'Natación',
};

export const MATERIAL = {
  maquina: 'Máquina', polea: 'Polea', mancuernas: 'Mancuernas', barra: 'Barra', 'barra fija': 'Barra fija',
  banda: 'Banda elástica', banco: 'Banco', botellas: 'Botellas o mochila', 'peso corporal': 'Sin material',
  paralelas: 'Paralelas', comba: 'Comba', rueda: 'Rueda abdominal', agua: 'Agua', tabla: 'Tabla',
  'pull buoy': 'Pull buoy', aletas: 'Aletas', bici: 'Bici estática',
};
// Material que puede haber en casa (el gimnasio y la piscina del centro lo tienen todo).
export const MATERIAL_CASA = ['mancuernas', 'banda', 'banco', 'botellas', 'barra fija', 'comba', 'rueda', 'bici'];

export const LUGARES = { gym: 'Gimnasio', piscina: 'Piscina', casa: 'Casa', calle: 'Calle' };

// Objetivos: se pueden marcar varios. La dosis por objetivo la usan las reglas sin IA.
export const OBJETIVOS = {
  perder: { nombre: 'Perder grasa', series: 3, reps: '12-15', desc: 45 },
  musculo: { nombre: 'Ganar músculo', series: 3, reps: '8-12', desc: 90 },
  fuerza: { nombre: 'Ganar fuerza', series: 4, reps: '5-8', desc: 120 },
  resistencia: { nombre: 'Resistencia y cardio', series: 3, reps: '15-20', desc: 40 },
  salud: { nombre: 'Salud, movilidad y espalda sana', series: 2, reps: '10-15', desc: 60 },
  natacion: { nombre: 'Nadar mejor', series: 4, reps: '25 m', desc: 30 },
};

export const NIVELES = { 1: 'Principiante', 2: 'Intermedio', 3: 'Avanzado' };

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Lo que opina cada uno de un ejercicio. El entrenador nunca propone los rechazados.
// Largo máximo de los textos libres que escribe la persona (D4): el mismo en el campo (maxlength) y en el
// normalizador de las copias, para que restaurar nunca recorte en silencio lo que la app dejó escribir.
export const LARGO_TEXTO = { notaLesion: 1000, comentarioEjercicio: 1000, comentarioCierre: 2000, notasPerfil: 2000 };

export const GUSTOS = {
  rechazo: { nombre: 'No lo quiero', icono: '⛔' },
  nogusta: { nombre: 'No me gusta', icono: '👎' },
  gusta: { nombre: 'Me gusta', icono: '👍' },
};
