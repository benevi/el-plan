// Plan semanal de cada uno. Cada ejercicio apunta a un id del catálogo (ejercicios.js),
// así que la técnica, el vídeo y las lesiones salen siempre del mismo sitio.
// Formato de cada ejercicio: [id, series, reps, descanso en segundos]
window.PERSONAS = { him: { nombre: 'Víctor' }, her: { nombre: 'Virginia' } };

window.LUGARES = { gym: 'Gimnasio', casa: 'Casa', calle: 'Calle', piscina: 'Piscina' };

window.PLAN = {
  him: {
    A: { nombre: 'Día A · Empuje', foco: 'Pecho, hombros y tríceps', lugar: 'gym', ej: [
      ['press-pecho-maquina',4,'8-12',90], ['press-hombro-maquina',3,'10-12',75], ['aperturas-maquina',3,'12-15',60],
      ['elevaciones-laterales-maquina',3,'12-15',45], ['fondos-asistidos-maquina',3,'8-12',75], ['plancha',3,'30-45s',45] ] },
    B: { nombre: 'Día B · Tirón', foco: 'Espalda, bíceps e isquios', lugar: 'gym', ej: [
      ['dominadas-asistidas-maquina',4,'6-10',90], ['jalon-pecho',3,'10-12',75], ['remo-sentado-polea',3,'10-12',60],
      ['curl-femoral-tumbado',3,'12-15',60], ['curl-mancuernas',3,'10-12',60], ['face-pull',3,'12-15',45] ] },
    C: { nombre: 'Día C · Pierna', foco: 'Cuádriceps, glúteo y gemelo', lugar: 'gym', ej: [
      ['prensa-piernas',4,'10-12',90], ['gluteo-maquina',4,'10-12 c/pierna',75], ['extension-cuadriceps',3,'12-15',60],
      ['curl-femoral-tumbado',3,'12-15',60], ['talones-pie',4,'15-20',45], ['plancha-lateral',3,'20-30s c/lado',45] ] },
    Casa: { nombre: 'En casa', foco: 'Cuerpo completo sin material', lugar: 'casa', ej: [
      ['sentadilla-peso-corporal',4,'15-20',60], ['flexiones',4,'8-15',75], ['zancadas',3,'12 c/pierna',60], ['fondos-banco',3,'10-15',60],
      ['puente-gluteo',4,'15-20',60], ['remo-toalla',3,'10-15',60], ['plancha',3,'30-60s',45], ['mountain-climbers',3,'30s',45] ] },
    Calle: { nombre: 'Calistenia', foco: 'Cuerpo completo en el parque', lugar: 'calle', ej: [
      ['dominadas',4,'5-10',90], ['fondos-paralelas',4,'6-12',90], ['flexiones',4,'10-20',60], ['remo-australiano',4,'8-15',75],
      ['sentadilla-peso-corporal',4,'15-20',60], ['zancadas',3,'12 c/pierna',60], ['elevacion-rodillas-barra',3,'10-15',60], ['plancha',3,'30-60s',45] ] },
    Piscina: { nombre: 'Piscina', foco: 'Aprender crol', lugar: 'piscina', ej: [
      ['caminar-agua',1,'3 min',0], ['burbujas',1,'5-7 min',0], ['flecha',4,'10-15 m',30], ['patada-crol-tabla',6,'25 m',30],
      ['crol',6,'25 m',60], ['flotacion',1,'3 min',0] ] },
  },
  her: {
    A: { nombre: 'Día A · Empuje + abductor', foco: 'Pecho, hombros y glúteo medio', lugar: 'gym', ej: [
      ['abductor-maquina',3,'12-15',60], ['press-pecho-maquina',3,'10-12',75], ['press-hombro-maquina',3,'10-12',60], ['aperturas-maquina',3,'12-15',60],
      ['elevaciones-laterales-maquina',3,'12-15',45], ['fondos-asistidos-maquina',3,'8-12',60], ['plancha',3,'20-40s',45] ] },
    B: { nombre: 'Día B · Tirón + glúteo', foco: 'Espalda, bíceps y glúteo', lugar: 'gym', ej: [
      ['dominadas-asistidas-maquina',3,'6-10',75], ['jalon-pecho',3,'10-12',75], ['remo-sentado-polea',3,'10-12',60], ['gluteo-maquina',3,'12-15 c/pierna',60],
      ['curl-mancuernas',3,'10-12',45], ['face-pull',3,'12-15',45], ['dead-bug',3,'10 c/lado',45] ] },
    C: { nombre: 'Día C · Mixto + core', foco: 'Pierna suave, core y postura', lugar: 'gym', ej: [
      ['abductor-maquina',3,'12-15',60], ['extension-cuadriceps',3,'12-15',60], ['curl-femoral-tumbado',3,'12-15',60], ['aperturas-maquina',3,'12-15',60],
      ['gluteo-maquina',3,'12-15 c/pierna',60], ['bird-dog',3,'10 c/lado',45], ['plancha',3,'20-40s',45] ] },
    Casa: { nombre: 'En casa', foco: 'Sin gimnasio, adaptado a la cadera', lugar: 'casa', ej: [
      ['abduccion-tumbada',3,'15 c/pierna',45], ['flexiones-rodillas',3,'8-12',60], ['puente-gluteo',4,'15-20',60], ['remo-toalla',3,'12-15',60],
      ['press-hombro-botellas',3,'12-15',60], ['curl-botellas',3,'12-15',45], ['dead-bug',3,'10 c/lado',45], ['bird-dog',3,'10 c/lado',45] ] },
    Calle: { nombre: 'Calistenia', foco: 'Adaptada a la cadera', lugar: 'calle', ej: [
      ['remo-australiano',3,'8-12',75], ['dominadas-negativas',3,'4-6',90], ['fondos-banco',3,'10-15',60], ['flexiones-inclinadas',3,'8-12',60],
      ['puente-gluteo',4,'15-20',60], ['abduccion-pie',3,'15 c/pierna',45], ['dead-bug',3,'10 c/lado',45], ['plancha',3,'20-40s',45] ] },
    Piscina: { nombre: 'Piscina', foco: 'Rehabilitación de cadera', lugar: 'piscina', ej: [
      ['caminar-agua',1,'5 min',0], ['aquajogging',1,'5 min',0], ['elevacion-lateral-pierna-agua',3,'15 c/pierna',30], ['elevacion-atras-pierna-agua',3,'15 c/pierna',30],
      ['rodillas-altas-agua',3,'30s',30], ['patada-espalda-tabla',4,'25 m',45], ['aquajogging',1,'15 min',0], ['flotacion',1,'5 min',0] ] },
  }
};

// Qué día toca según el día de la semana (0 domingo … 6 sábado)
window.DIA_SUGERIDO = { 1:'A', 3:'B', 5:'C', 6:'Piscina', 0:'Piscina' };

// Nombres de la versión anterior → id del catálogo, para no perder el historial importado
window.ALIAS = {
  'Press de pecho en máquina BH (M090/M060)':'press-pecho-maquina', 'Press de hombro en máquina BH (M090)':'press-hombro-maquina',
  'Pec Fly en máquina BH (M410)':'aperturas-maquina', 'Deltoid Raise en máquina BH (M490)':'elevaciones-laterales-maquina',
  'Fondos asistidos máquina BH (M450)':'fondos-asistidos-maquina', 'Plancha frontal':'plancha', 'Plancha':'plancha',
  'Dominadas asistidas máquina BH (M450)':'dominadas-asistidas-maquina', 'Jalón al pecho polea':'jalon-pecho', 'Remo sentado polea':'remo-sentado-polea',
  'Prone Leg Curl máquina BH (M170)':'curl-femoral-tumbado', 'Curl de bíceps con mancuernas':'curl-mancuernas', 'Curl bíceps mancuernas':'curl-mancuernas',
  'Face pull polea':'face-pull', 'Leg Press máquina BH (M050)':'prensa-piernas', 'Gluteus máquina BH (M330)':'gluteo-maquina',
  'Leg Extension máquina BH (M010)':'extension-cuadriceps', 'Elevación de talones (gemelos)':'talones-pie', 'Plancha lateral':'plancha-lateral',
  'Abductor máquina BH (M250)':'abductor-maquina', 'Dead bug en suelo':'dead-bug', 'Dead bug en el césped':'dead-bug', 'Bird dog en suelo':'bird-dog',
  'Caminar en el agua':'caminar-agua', 'Burbujas (EL MÁS IMPORTANTE)':'burbujas', 'Posición de flecha':'flecha', 'Patada de crol con tabla':'patada-crol-tabla',
  'Crol con descansos':'crol', 'Flotación + vuelta a la calma':'flotacion', 'Aquajogging suave':'aquajogging',
  'Elevaciones laterales de pierna':'elevacion-lateral-pierna-agua', 'Elevaciones de pierna hacia atrás':'elevacion-atras-pierna-agua',
  'Marcha con rodillas altas':'rodillas-altas-agua', 'Patada espalda con tabla':'patada-espalda-tabla',
  'Sentadilla con peso corporal':'sentadilla-peso-corporal', 'Flexiones (push-ups)':'flexiones', 'Flexiones':'flexiones', 'Zancadas alternas':'zancadas',
  'Zancadas caminando':'zancadas', 'Fondos de tríceps en silla':'fondos-banco', 'Fondos de tríceps en banco':'fondos-banco',
  'Puente de glúteo / Hip thrust suelo':'puente-gluteo', 'Puente de glúteo en suelo':'puente-gluteo', 'Puente de glúteo en banco':'puente-gluteo',
  'Remo invertido / con toalla':'remo-toalla', 'Remo con toalla en puerta':'remo-toalla', 'Mountain climbers (cardio)':'mountain-climbers',
  'Dominadas (o negativas)':'dominadas', 'Dominadas negativas asistidas':'dominadas-negativas', 'Fondos en paralelas (o banco)':'fondos-paralelas',
  'Remo australiano (barra baja)':'remo-australiano', 'Remo australiano (barra alta)':'remo-australiano', 'Sentadillas / pistol asistido':'sentadilla-peso-corporal',
  'Elevaciones de rodillas en barra':'elevacion-rodillas-barra', 'Abducción de cadera tumbada':'abduccion-tumbada', 'Flexiones (rodillas o pared)':'flexiones-rodillas',
  'Flexiones (banco o suelo)':'flexiones-inclinadas', 'Press de hombro con botellas/mochila':'press-hombro-botellas', 'Curl bíceps con botellas/mochila':'curl-botellas',
  'Abducción de pie en barra':'abduccion-pie',
};

// Modelo de máquina BH de vuestro gimnasio para cada ejercicio (sale de los nombres de la versión anterior).
window.MAQUINA_BH = {};
Object.entries(window.ALIAS).forEach(([nombre, id]) => { const m = nombre.match(/BH \(([^)]+)\)/); if (m) window.MAQUINA_BH[id] = 'BH ' + m[1]; });
