// Datos de ejemplo de las muestras de identidad (DIS 2). Inventados pero realistas; no son los de Víctor ni Virginia.
// Las tres direcciones pintan exactamente los mismos datos para que la comparación sea justa.

export const PERSONAS = {
  victor: {
    nombre: 'Víctor',
    hoy: {
      fecha: 'Jueves, 20 de noviembre',
      titulo: 'Empuje y tren superior',
      lugar: 'Gimnasio',
      minutos: 55,
      porque: 'Subimos 2,5 kg en el press porque el lunes te sobraron dos repeticiones en todas las series.',
      partes: [
        { nombre: 'Calentamiento', detalle: 'Movilidad de hombro y remo suave', min: 8 },
        { nombre: 'Fuerza', detalle: '5 ejercicios, 18 series', min: 29 },
        { nombre: 'Cardio', detalle: 'Bici estática, ritmo cómodo', min: 12 },
        { nombre: 'Estiramientos', detalle: 'Pecho, hombro y espalda', min: 6 },
      ],
      // L M X J V S D · estado: hecho, hoy, plan, descanso
      semana: [
        { d: 'L', n: 17, e: 'hecho', min: 52 }, { d: 'M', n: 18, e: 'descanso' }, { d: 'X', n: 19, e: 'hecho', min: 48 },
        { d: 'J', n: 20, e: 'hoy', min: 55 }, { d: 'V', n: 21, e: 'descanso' }, { d: 'S', n: 22, e: 'plan', min: 45 }, { d: 'D', n: 23, e: 'descanso' },
      ],
      constancia: { hechas: 2, previstas: 4 },
    },
    sesion: {
      titulo: 'Empuje y tren superior',
      ejercicio: 'Press de banca con mancuernas',
      orden: 2, total: 5,
      objetivo: '4 series de 8 a 10 repeticiones',
      ultima: '20\u00a0kg, con 10, 10 y 9 repeticiones',
      paso: 2.5,
      series: [
        { kg: 22.5, reps: 10, hecha: true },
        { kg: 22.5, reps: 10, hecha: false },
        { kg: null, reps: null, hecha: false },
        { kg: null, reps: null, hecha: false },
      ],
      descanso: { total: 120, restante: 84 },
      siguiente: 'Press militar sentado',
      tecnica: 'Escápulas juntas y apoyadas; baja hasta que los codos queden un poco por debajo del banco.',
    },
    progreso: {
      constancia: [ // 8 semanas: [hechas, previstas]
        [3, 4], [4, 4], [2, 3], [4, 4], [3, 4], [4, 4], [3, 3], [2, 4],
      ],
      racha: 'Siete semanas seguidas con al menos tres sesiones',
      fuerza: { ejercicio: 'Press de banca con mancuernas', unidad: 'kg', valores: [17.5, 17.5, 20, 20, 20, 20, 22.5, 22.5], resumen: '+5 kg en 8 semanas' },
      fuerza2: [
        { ejercicio: 'Sentadilla goblet', antes: 20, ahora: 26 },
        { ejercicio: 'Remo con mancuerna', antes: 18, ahora: 22.5 },
        { ejercicio: 'Press militar sentado', antes: 12.5, ahora: 14 },
      ],
      salud: { titulo: 'Sin molestias', texto: 'Ninguna molestia apuntada en las últimas 8 semanas.', valores: null },
    },
    cierre: { series: 18, minutos: 53, marca: 'Press de banca: 22,5 kg × 10, tu mejor serie', semana: '3 de 4 sesiones esta semana', kg: 4320 },
  },
  virginia: {
    nombre: 'Virginia',
    hoy: {
      fecha: 'Jueves, 20 de noviembre',
      titulo: 'Piscina y core',
      lugar: 'Piscina climatizada y sala',
      minutos: 50,
      porque: 'Hoy toca agua: descarga la zona lumbar después de las piernas del martes, y el core la protege.',
      partes: [
        { nombre: 'Calentamiento', detalle: 'Movilidad de cadera en seco', min: 6 },
        { nombre: 'Nado', detalle: '1200 m: crol técnico y espalda', min: 26 },
        { nombre: 'Core', detalle: '3 ejercicios, 9 series', min: 10 },
        { nombre: 'Estiramientos', detalle: 'Cadera, lumbar e isquios', min: 8 },
      ],
      semana: [
        { d: 'L', n: 17, e: 'descanso' }, { d: 'M', n: 18, e: 'hecho', min: 50 }, { d: 'X', n: 19, e: 'descanso' },
        { d: 'J', n: 20, e: 'hoy', min: 50 }, { d: 'V', n: 21, e: 'descanso' }, { d: 'S', n: 22, e: 'plan', min: 40 }, { d: 'D', n: 23, e: 'descanso' },
      ],
      constancia: { hechas: 1, previstas: 3 },
    },
    sesion: {
      titulo: 'Piscina y core',
      ejercicio: 'Puente de glúteo con disco',
      orden: 1, total: 3,
      objetivo: '3 series de 12 repeticiones',
      ultima: '7,5\u00a0kg, con 12, 12 y 11 repeticiones',
      paso: 2.5,
      series: [
        { kg: 10, reps: 12, hecha: true },
        { kg: 10, reps: 12, hecha: false },
        { kg: null, reps: null, hecha: false },
      ],
      descanso: { total: 75, restante: 41 },
      siguiente: 'Bird dog',
      tecnica: 'Aprieta glúteos arriba sin arquear la zona lumbar; las costillas, abajo.',
    },
    progreso: {
      constancia: [[2, 3], [3, 3], [3, 3], [1, 3], [3, 3], [2, 3], [3, 3], [1, 3]],
      racha: 'Cinco de las últimas ocho semanas, completas',
      fuerza: { ejercicio: 'Puente de glúteo con disco', unidad: 'kg', valores: [5, 5, 5, 7.5, 7.5, 7.5, 10, 10], resumen: '+5 kg en 8 semanas' },
      fuerza2: [
        { ejercicio: 'Nado continuo', antes: 600, ahora: 1200, unidad: 'm' },
        { ejercicio: 'Plancha frontal', antes: 30, ahora: 50, unidad: 's' },
        { ejercicio: 'Remo en polea baja', antes: 15, ahora: 20 },
      ],
      salud: { titulo: 'Zona lumbar', texto: 'De 4 a 1 sobre 10 en ocho semanas.', valores: [4, 4, 3, 3, 2, 2, 1, 1] },
    },
    cierre: { series: 9, minutos: 49, marca: 'Puente de glúteo: 10 kg × 12, tu mejor serie', semana: '2 de 3 sesiones esta semana', metros: 1200, kg: 1080 },
  },
};

// Formato español: coma decimal y punto de millares (Intl ya lo hace con es-ES).
const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
export const num = n => (n == null ? '—' : fmt.format(n));
export const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
// Escapa texto para plantillas (los datos son fijos, pero se pinta igual que en la app: siempre escapado).
export const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SEMANAS = ['29 sep', '6 oct', '13 oct', '20 oct', '27 oct', '3 nov', '10 nov', '17 nov'];
