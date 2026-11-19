// Zonas de lesión: lo que hay que evitar, cómo calentar y estirar, y ejercicios del catálogo para
// rehabilitar o prevenir. El riesgo de cada ejercicio por zona está en ejercicios.js (campo r).
export const ZONAS = {
  "cadera_lateral": {
    "corta": "Cadera",
    "nombre": "Cadera lateral / Trocanteritis",
    "icono": "🦴",
    "desc": "Tendón del glúteo medio inflamado. Dolor en la cara externa de la cadera.",
    "evitar": [
      "Sin sentadillas ni zancadas",
      "Sin hip thrust ni peso muerto",
      "Sin máquina aductora (cruzar piernas)",
      "Sin saltos ni carrera",
      "Sin cruzar pierna por delante",
      "Sin dormir sobre el lado afectado"
    ],
    "calentar": [
      "Bici estática suave 5 min",
      "Rotaciones de cadera tumbado",
      "Puente de glúteo (activación)",
      "Activación de glúteo medio en cuadrupedia"
    ],
    "estirar": [
      "Estiramiento de glúteo medio (tumbado, sin cruzar pierna)",
      "Estiramiento de piriforme en silla",
      "Estiramiento de cuádriceps de pie con apoyo"
    ],
    "consejo": "El abductor con fuerza progresiva ES terapéutico. El dolor manda: si pica, para.",
    "rehab": [
      "abduccion-isometrica-pared",
      "almeja",
      "abduccion-tumbada",
      "puente-banda-rodillas",
      "paso-lateral-banda"
    ]
  },
  "rodilla": {
    "corta": "Rodilla",
    "nombre": "Rodilla",
    "icono": "🦵",
    "desc": "Incluye menisco, ligamentos, condromalacia y tendinopatía rotuliana.",
    "evitar": [
      "Sin flexión de rodilla >90°",
      "Sin extensiones de rodilla con carga pesada",
      "Sin saltos ni carrera",
      "Sentadilla solo parcial si se permite",
      "Evitar subir escaleras con carga"
    ],
    "calentar": [
      "Bici estática sin resistencia 5 min",
      "Activación de cuádriceps en silla",
      "Elevación de pierna recta tumbado",
      "Rotaciones de tobillo"
    ],
    "estirar": [
      "Estiramiento de cuádriceps de pie con apoyo",
      "Estiramiento de isquios sentado",
      "Estiramiento de pantorrilla en pared"
    ],
    "consejo": "Fortalece el cuádriceps (isométrico, rango corto) para proteger la rodilla.",
    "rehab": [
      "sentadilla-isometrica",
      "puente-gluteo",
      "abduccion-tumbada",
      "curl-femoral-tumbado",
      "movilidad-tobillo-pared"
    ]
  },
  "hombro": {
    "corta": "Hombro",
    "nombre": "Hombro / Manguito rotador",
    "icono": "💪",
    "desc": "Tendones del manguito rotador, bursitis subacromial o inestabilidad glenohumeral.",
    "evitar": [
      "Sin press por encima de la cabeza con carga",
      "Sin fondos ni dominadas amplias",
      "Sin press inclinado pesado",
      "Sin jalón detrás de la nuca",
      "Evitar movimientos por encima del hombro con dolor"
    ],
    "calentar": [
      "Rotaciones de hombro con banda ligera",
      "Pendulares de Codman 30s",
      "Activación de rotadores externos con banda",
      "Movilidad escapular (retracciones)"
    ],
    "estirar": [
      "Estiramiento de pectoral en puerta",
      "Estiramiento del manguito rotador cruzado",
      "Estiramiento de tríceps sobre la cabeza",
      "Estiramiento de deltoides cruzado"
    ],
    "consejo": "Los face pull y rotaciones externas son terapéuticos. Prioriza el trabajo escapular.",
    "rehab": [
      "rotacion-externa-banda",
      "face-pull-banda",
      "separacion-banda",
      "ytw-tumbado"
    ]
  },
  "lumbar": {
    "corta": "Lumbar",
    "nombre": "Zona lumbar / Espalda baja",
    "icono": "🔩",
    "desc": "Contractura, hernia, protrusión o lumbociática.",
    "evitar": [
      "Sin flexión de tronco con carga (peso muerto, buenos días)",
      "Sin rotaciones con carga (Russian twist)",
      "Sin crunch ni abdominales con carga",
      "Sin press militar de pie con carga pesada",
      "Sin remo con barra inclinado"
    ],
    "calentar": [
      "Rodillas al pecho tumbado 30s",
      "Cat-cow en cuadrupedia 10 reps",
      "Rotaciones de cadera tumbado",
      "Bird dog suave (activación core)"
    ],
    "estirar": [
      "Estiramiento de piriforme tumbado",
      "Estiramiento de psoas de rodillas",
      "Estiramiento de isquios suave",
      "Rodillas al pecho (postura fetal)"
    ],
    "consejo": "El core estabilizador (plancha, dead bug) protege la lumbar. Evita hiperlordosis.",
    "rehab": [
      "bird-dog",
      "dead-bug",
      "plancha-lateral",
      "puente-gluteo",
      "gato-camello"
    ]
  },
  "codo": {
    "corta": "Codo",
    "nombre": "Codo / Epicondilitis",
    "icono": "🦾",
    "desc": "Epicondilitis lateral (tenista) o medial (golfista). Tendón del antebrazo.",
    "evitar": [
      "Sin curl de bíceps con carga",
      "Sin remo con supinación forzada",
      "Sin extensiones de muñeca",
      "Agarre neutro en todos los jalones",
      "Descanso activo del antebrazo"
    ],
    "calentar": [
      "Rotaciones de muñeca suaves",
      "Estiramientos de antebrazo (flexor/extensor)",
      "Apertura y cierre de mano",
      "Bandas de resistencia mínima en muñeca"
    ],
    "estirar": [
      "Estiramiento de extensor de muñeca (brazo extendido, mano hacia abajo)",
      "Estiramiento de flexor de muñeca (mano hacia arriba)",
      "Masaje del antebrazo con pulgar"
    ],
    "consejo": "Trabaja la fuerza de prensión con bolas o bandas muy ligeras como rehabilitación.",
    "rehab": [
      "curl-martillo",
      "extension-triceps-banda",
      "rotacion-externa-banda"
    ]
  },
  "cervical": {
    "corta": "Cuello",
    "nombre": "Cervicales / Cuello",
    "icono": "🧠",
    "desc": "Contractura cervical, artrosis o radiculopatía cervical.",
    "evitar": [
      "Sin encogimientos de hombros (shrugs) pesados",
      "Sin jalón detrás de la nuca",
      "Sin press detrás de la nuca",
      "Sin remo al cuello",
      "Sin llevar la cabeza hacia atrás con carga"
    ],
    "calentar": [
      "Rotaciones de cuello suaves (3×cada lado)",
      "Inclinaciones laterales lentas",
      "Retracción cervical (chin tucks)",
      "Movilidad escapular"
    ],
    "estirar": [
      "Estiramiento lateral de cuello (oreja a hombro)",
      "Estiramiento de trapecios (mano en cabeza suave)",
      "Chin tuck contra pared"
    ],
    "consejo": "La retracción cervical (chin tuck) es el ejercicio más efectivo para la postura cervical.",
    "rehab": [
      "separacion-banda",
      "ytw-tumbado",
      "rotacion-toracica-cuadrupedia"
    ]
  },
  "tobillo_pie": {
    "corta": "Tobillo",
    "nombre": "Tobillo / Pie",
    "icono": "🦶",
    "desc": "Esguince, fascitis plantar, tendinopatía aquílea o inestabilidad de tobillo.",
    "evitar": [
      "Sin saltos ni carrera",
      "Sin elevaciones de talones con carga",
      "Sin sentadillas con peso",
      "Sin carga sobre el pie afectado",
      "Movilidad de tobillo sin carga"
    ],
    "calentar": [
      "Rotaciones de tobillo sentado 20 cada sentido",
      "Escritura del alfabeto con el pie",
      "Estiramiento de fascia plantar (dedos hacia arriba)",
      "Elevación de talones sin carga (movilidad)"
    ],
    "estirar": [
      "Estiramiento de gemelo en pared (rodilla extendida)",
      "Estiramiento de sóleo (rodilla flexionada)",
      "Estiramiento de fascia plantar en el suelo"
    ],
    "consejo": "La piscina es ideal para mantener cardio y fuerza sin carga sobre el tobillo.",
    "rehab": [
      "movilidad-tobillo-pared",
      "talones-pie",
      "talones-una-pierna"
    ]
  },
  "muñeca": {
    "corta": "Muñeca",
    "nombre": "Muñeca / Mano",
    "icono": "✋",
    "desc": "Tendinitis de muñeca, síndrome del túnel carpiano o esguince.",
    "evitar": [
      "Sin press con extensión de muñeca",
      "Sin fondos ni dominadas con muñeca en extensión",
      "Sin flexión/extensión de muñeca con carga",
      "Usar bandas de muñeca de soporte",
      "Plancha sobre codos, no sobre manos"
    ],
    "calentar": [
      "Rotaciones de muñeca suaves",
      "Estiramientos de muñeca en flexión y extensión",
      "Apertura y cierre de mano",
      "Pelota antiestrés suave"
    ],
    "estirar": [
      "Estiramiento de flexores (mano hacia abajo, brazo extendido)",
      "Estiramiento de extensores (mano hacia arriba)",
      "Masaje palma con pulgar contrario"
    ],
    "consejo": "Plancha sobre codos en lugar de manos para no sobrecargar la muñeca.",
    "rehab": [
      "dead-bug",
      "bird-dog"
    ]
  }
};
