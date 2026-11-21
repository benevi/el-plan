// Datos de ejemplo de los prototipos (DIS 4). Inventados pero realistas; los textos fijos (avisos de salud, señales,
// tipos de lesión, objetivos…) son los de la app (pipos-v2) para que el prototipo diga lo mismo que dirá la app.
// «Hoy» es el sábado 21 de noviembre de 2026 (fijo, para que las capturas no cambien).

export const HOY = { iso: '2026-11-21', diaSemana: 6, texto: 'Sábado, 21 de noviembre' };
export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIAS_CORTOS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const FECHAS_SEMANA = ['', 16, 17, 18, 19, 20, 21, 22];

export const OBJETIVOS = {
  perder: 'Perder grasa', musculo: 'Ganar músculo', fuerza: 'Ganar fuerza', resistencia: 'Resistencia y cardio',
  salud: 'Salud, movilidad y espalda sana', natacion: 'Nadar mejor',
};
export const ZONAS = {
  cadera_lateral: ['Cadera lateral / Trocanteritis', 'Cadera'], rodilla: ['Rodilla', 'Rodilla'], hombro: ['Hombro / Manguito rotador', 'Hombro'],
  lumbar: ['Zona lumbar / Espalda baja', 'Lumbar'], codo: ['Codo / Epicondilitis', 'Codo'], cervical: ['Cervicales / Cuello', 'Cuello'],
  tobillo_pie: ['Tobillo / Pie', 'Tobillo'], muñeca: ['Muñeca / Mano', 'Muñeca'],
};
export const TIPOS_LESION = { lesion: 'Lesión diagnosticada', recurrente: 'Dolor que va y viene', puntual: 'Molestia puntual (días)' };
export const GUSTOS = { gusta: 'Me gusta', nogusta: 'No me gusta', rechazo: 'No lo quiero' };
export const MATERIAL_CASA = ['mancuernas', 'banda', 'banco', 'botellas', 'barra fija', 'comba', 'rueda', 'bici'];
export const USO_IA = {
  auto: ['Automático', 'La IA monta la semana y revisa el día solo cuando hace falta (dolor nuevo, una petición, otro lugar, comentarios). Unos 0,25 € por semana y 0,10 € por día revisado.'],
  siempre: ['Siempre', 'La IA rehace cada sesión con tu check-in. Unos 0,10 € por sesión.'],
  ahorro: ['Ahorro', 'La IA solo cuando la pidas para la semana. El día lo ajusta la app.'],
};
export const CAMPOS_SALUD = {
  hipertension: 'Tensión alta', embarazo: 'Embarazo', posparto: 'Parto reciente', cardiopatia: 'Enfermedad del corazón', diabetes: 'Diabetes',
  osteoporosis: 'Osteoporosis', protesis: 'Prótesis de cadera o rodilla', epilepsia: 'Epilepsia', asma: 'Asma', equilibrio: 'Problemas de equilibrio o caídas',
};
export const MEDICACION = { betabloqueantes: 'Betabloqueantes', anticoagulantes: 'Anticoagulantes', azucar: 'Insulina u otros para el azúcar', corticoides: 'Corticoides largos' };
export const ENERGIA = ['', 'Muy baja', 'Baja', 'Normal', 'Buena', 'A tope'];
export const ESFUERZO = [['1', 'Muy fácil'], ['2', 'Fácil'], ['3', 'Justo'], ['4', 'Duro'], ['5', 'Al límite']];
export const DESDE = { menos6: 'Menos de 6 semanas', de6a12: '6 a 12 semanas', mas3m: 'Más de 3 meses', nose: 'No lo sé' };
export const T1 = [
  'Pipos Fitness te propone entrenamientos orientativos. No diagnostica ni sustituye a tu médico, a tu fisioterapeuta ni a tu matrona.',
  'Para en seco y pide ayuda si notas dolor u opresión en el pecho, mareo, sudor frío, falta de aire fuera de lo normal, hormigueo o pérdida de fuerza en un brazo o una pierna, o un dolor fuerte y repentino. No entrenes con fiebre.',
];
export const SEÑALES = [
  'Dolor u opresión en el pecho, palpitaciones raras, mareo o desmayo, falta de aire fuera de lo normal, sudor frío o náuseas al esforzarte',
  'Dolor de cabeza muy fuerte y repentino, visión doble, dificultad para hablar o tragar, pérdida de fuerza de un lado del cuerpo',
  'Hormigueo, adormecimiento o pérdida de fuerza en un brazo o una pierna que aparece o va a más',
  'Golpe o caída con hinchazón inmediata, deformidad, rodilla bloqueada o no poder apoyar el pie',
];
export const VERSION = 'pipos-5.4.0';

// ---- Sesiones de ejemplo ----
// rol: principal | rehab | cardio. reps: «8-10», «40-60 s», «12 min», «10 c/lado», «4 × 50 m»
const calentamientoGym = [
  { nombre: 'Bici suave', duracion: '5 min', detalle: 'Que puedas hablar sin ahogarte.' },
  { nombre: 'Movilidad de hombros con banda', duracion: '2 min', detalle: 'Círculos y aperturas, sin dolor.' },
  { nombre: 'Serie de aproximación', duracion: '2 min', detalle: 'El primer ejercicio con la mitad de peso.' },
];
const vueltaGym = [
  { nombre: 'Estiramiento de pecho en el marco de la puerta', duracion: '2 × 30 s' },
  { nombre: 'Estiramiento de dorsal de rodillas', duracion: '2 × 30 s' },
  { nombre: 'Respiración lenta tumbado', duracion: '1 min' },
];
export const SESIONES = {
  victor: {
    nombre: 'Empuje y tren superior', lugar: 'gym', foco: 'Pecho, hombro y espalda', minutos: 60, fuente: 'ia',
    explicacion: [
      'Subimos 2,5 kg en el press porque el lunes te sobraron dos repeticiones en todas las series.',
      'Jalón antes que elevaciones para equilibrar empuje y tracción en la semana.',
      'Bici al final, 12 minutos suaves: tu cardio de la semana va por 95 de 150 minutos.',
    ],
    calentamiento: calentamientoGym, vuelta: vueltaGym,
    ejercicios: [
      { id: 'press-banca-mancuernas', rol: 'principal', series: 4, reps: '8-10', kg: 22.5, descanso: 120, ultima: '20 kg: 10, 10, 10 y 9' },
      { id: 'jalon-pecho', rol: 'principal', series: 3, reps: '10-12', kg: 45, descanso: 90, ultima: '42,5 kg: 12, 11 y 10' },
      { id: 'elevaciones-laterales', rol: 'principal', series: 3, reps: '12-15', kg: 6, descanso: 60, ultima: '6 kg: 13, 12 y 12' },
      { id: 'fondos-asistidos-maquina', rol: 'principal', series: 3, reps: '8-10', kg: 25, descanso: 90, nota: 'Asistencia de 25 kg: cuanto menos, más difícil.' },
      { id: 'plancha', rol: 'principal', series: 3, reps: '40-60 s', descanso: 60 },
      { id: 'bici-estatica', rol: 'cardio', series: 1, reps: '12 min', descanso: 0 },
    ],
  },
  virginia: {
    nombre: 'Core y espalda', lugar: 'gym', foco: 'Core, glúteo y espalda', minutos: 50, fuente: 'ia',
    explicacion: [
      'Tu lumbar está en 3/10: core en estático y tracción sentada, nada que la cargue en flexión.',
      'Puente y bird dog son tu rehabilitación de la zona lumbar; plancha lateral para los oblicuos.',
      'Bici al final: el jueves nadaste 1200 m y te faltan 35 minutos de cardio esta semana.',
    ],
    calentamiento: [
      { nombre: 'Bici suave', duracion: '5 min' }, { nombre: 'Gato-camello', duracion: '10 repeticiones', detalle: 'Despacio, sin forzar el final.' },
      { nombre: 'Puente de glúteo sin peso', duracion: '10 repeticiones' },
    ],
    vuelta: [{ nombre: 'Rodillas al pecho tumbada', duracion: '2 × 30 s' }, { nombre: 'Estiramiento de cadera en cuadrupedia', duracion: '2 × 30 s' }, { nombre: 'Respiración diafragmática', duracion: '1 min' }],
    ejercicios: [
      { id: 'remo-sentado-polea', rol: 'principal', series: 3, reps: '10-12', kg: 20, descanso: 75, ultima: '17,5 kg: 12, 12 y 12' },
      { id: 'puente-gluteo', rol: 'rehab', series: 3, reps: '12', descanso: 60 },
      { id: 'bird-dog', rol: 'rehab', series: 3, reps: '10 c/lado', descanso: 45 },
      { id: 'plancha-lateral', rol: 'principal', series: 3, reps: '20-30 s c/lado', descanso: 45 },
      { id: 'bici-estatica', rol: 'cardio', series: 1, reps: '15 min', descanso: 0 },
    ],
  },
};

// ---- Plan de la semana (16-22 nov) ----
export const PLANES = {
  victor: {
    fuente: 'ia', resumen: 'Cuatro días: dos de empuje y tracción, uno de pierna y uno completo en casa, con cardio cada día.',
    criterios: 'Músculo y salud: 10-12 series por grupo grande a la semana, sin dos días seguidos del mismo músculo.',
    progresion: 'Doble progresión: cuando hagas el máximo de repeticiones en todas las series, sube el peso.',
    dias: [
      { d: 1, nombre: 'Tirón y bíceps', lugar: 'gym', min: 55, ej: 6, estado: 'hecho' },
      { d: 3, nombre: 'Pierna y core', lugar: 'gym', min: 60, ej: 6, estado: 'hecho' },
      { d: 5, nombre: 'Cuerpo completo en casa', lugar: 'casa', min: 45, ej: 5, estado: 'saltado' },
      { d: 6, nombre: 'Empuje y tren superior', lugar: 'gym', min: 60, ej: 6, estado: 'hoy' },
    ],
  },
  virginia: {
    fuente: 'ia', resumen: 'Tres días: espalda y core en sala, técnica de crol en la piscina y un día de pierna suave.',
    criterios: 'Salud de espalda y nadar mejor: core todos los días, nada de flexión cargada con la lumbar en 3/10.',
    progresion: 'Más metros en la piscina cada semana (máximo un 10 % más) y peso en el remo cuando hagas 12 en todas.',
    dias: [
      { d: 2, nombre: 'Pierna suave y movilidad', lugar: 'gym', min: 45, ej: 5, estado: 'hecho' },
      { d: 4, nombre: 'Técnica de crol', lugar: 'piscina', min: 45, ej: 4, estado: 'hecho' },
      { d: 6, nombre: 'Core y espalda', lugar: 'gym', min: 50, ej: 5, estado: 'hoy' },
    ],
  },
};

// ---- Perfil ----
export const PERFILES = {
  victor: {
    objetivos: ['musculo', 'salud'], nivel: 2, nivelAuto: true,
    lesiones: [{ id: 'l1', zona: 'tobillo_pie', dolor: 0, tipo: 'puntual', desde: '2026-03-02', nota: 'Esguince jugando al pádel.', activa: false }],
    salud: {}, dias: 4, minutos: 60, lugares: ['gym', 'casa'], materialCasa: ['mancuernas', 'banda', 'banco'], acompañado: true, nadar25: false,
    gustos: { 'press-banca-mancuernas': 'gusta', 'zancadas': 'nogusta' }, usoIA: 'auto',
    datos: { sexo: 'h', altura: 178, nacimiento: 1986 }, notas: 'Prefiero entrenar a primera hora. Me aburre la cinta.',
    mias: [{ id: 'm1', nombre: 'Abdominales y flexiones', lugar: 'casa', minutos: 30, ej: [['flexiones', 3, '10-12'], ['plancha', 3, '40-60 s'], ['bird-dog', 3, '10 c/lado']] }],
    criterios: [['Constancia: 3 sesiones por semana durante 8 semanas', true, '7 de 8 semanas'], ['Fuerza: +10 % en los ejercicios principales', true, '+12 %'], ['Técnica: sin molestias en las 4 últimas semanas', true, 'sin molestias'], ['Antigüedad: 12 meses entrenando', false, '9 meses']],
  },
  virginia: {
    objetivos: ['salud', 'natacion', 'perder'], nivel: 1, nivelAuto: true,
    lesiones: [{ id: 'l1', zona: 'lumbar', dolor: 3, tipo: 'recurrente', desde: '2024-05-10', nota: 'Me molesta al agacharme a coger peso y tras estar mucho sentada.', activa: true }],
    salud: { asma: true }, dias: 3, minutos: 50, lugares: ['gym', 'piscina'], materialCasa: [], acompañado: true, nadar25: true,
    gustos: { 'bird-dog': 'gusta', 'crol': 'gusta', 'sentadilla-goblet': 'rechazo' }, usoIA: 'auto',
    datos: { sexo: 'm', altura: 165, nacimiento: 1989 }, notas: 'Los jueves solo puedo ir a la piscina.',
    mias: [{ id: 'm1', nombre: 'Core de los martes', lugar: 'gym', minutos: 35, ej: [['bird-dog', 3, '10 c/lado'], ['puente-gluteo', 3, '12'], ['plancha-lateral', 3, '20-30 s c/lado']] }],
    criterios: [['Constancia: 3 sesiones por semana durante 8 semanas', true, '6 de 8 semanas'], ['Fuerza: +10 % en los ejercicios principales', true, '+14 %'], ['Técnica: sin molestias en las 4 últimas semanas', false, 'lumbar en 3/10']],
  },
};

// ---- Progreso: un año de datos (sem 1 = hace 51 semanas … sem 52 = esta) ----
const MESES = ['dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov'];
export const PROGRESO = {
  victor: {
    sesionesMes: [9, 11, 12, 10, 13, 12, 9, 6, 8, 12, 14, 11], meses: MESES,
    semanas8: [[3, 4], [4, 4], [3, 3], [4, 4], [3, 4], [4, 4], [3, 3], [3, 4]], etiquetas8: ['28 sep', '5 oct', '12 oct', '19 oct', '26 oct', '2 nov', '9 nov', '16 nov'],
    racha: 7, cumplimiento: 89, total: 127, fuerzaMediana: 18, records: 3,
    fuerza: [
      ['press-banca-mancuernas', 46, 22.5, 24, true, [14, 15, 15, 16, 17.5, 17.5, 18, 19, 20, 20, 21, 22.5]],
      ['jalon-pecho', 44, 45, 15, false, null], ['sentadilla-goblet', 38, 26, 30, true, null], ['remo-mancuerna', 30, 22.5, 18, false, null], ['elevaciones-laterales', 40, 6, 0, false, null],
    ],
    peso: [82.4, 82.1, 81.6, 81.2, 81.0, 80.6, 80.9, 80.7, 80.2, 80.0, 79.8, 79.6], cintura: [92, 92, 91, 91, 90, 89, 89, 89, 88, 87, 87, 86],
    cardio: 95, dolor: [],
  },
  virginia: {
    sesionesMes: [7, 9, 10, 9, 11, 10, 8, 4, 9, 11, 12, 9], meses: MESES,
    semanas8: [[2, 3], [3, 3], [3, 3], [1, 3], [3, 3], [2, 3], [3, 3], [2, 3]], etiquetas8: ['28 sep', '5 oct', '12 oct', '19 oct', '26 oct', '2 nov', '9 nov', '16 nov'],
    racha: 2, cumplimiento: 79, total: 101, fuerzaMediana: 21, records: 2,
    fuerza: [
      ['remo-sentado-polea', 36, 20, 26, true, [12.5, 12.5, 15, 15, 15, 15, 17.5, 17.5, 17.5, 17.5, 20, 20]],
      ['puente-gluteo', 40, 0, 0, false, null], ['jalon-pecho', 22, 30, 20, false, null],
    ],
    peso: [66.8, 66.5, 66.2, 66.0, 65.6, 65.4, 65.7, 65.5, 65.1, 64.9, 64.8, 64.6], cintura: [80, 80, 79, 79, 78, 78, 78, 77, 77, 76, 76, 75],
    cardio: 115, dolor: [['lumbar', [5, 5, 4, 4, 4, 3, 4, 3, 3, 3, 2, 3], 'baja']],
  },
};

// Historial reciente (últimas sesiones).
export const HISTORIAL = {
  victor: [['Pierna y core', '18 nov', 'gym', 4], ['Tirón y bíceps', '16 nov', 'gym', 3], ['Empuje y tren superior', '14 nov', 'gym', 4], ['Cuerpo completo en casa', '13 nov', 'casa', 3]],
  virginia: [['Técnica de crol', '19 nov', 'piscina', 3], ['Pierna suave y movilidad', '17 nov', 'gym', 2], ['Core y espalda', '14 nov', 'gym', 3]],
};
