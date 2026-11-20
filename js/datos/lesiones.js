// Zonas de lesión (docs/criterio.md, sección 12): qué evitar, cómo calentar y estirar, cardio preferente,
// techo de dolor, cuándo consultar y rehabilitación por fases. El riesgo de cada ejercicio por zona está en
// ejercicios.js (campo r) y la rehabilitación sale de su campo rehab, así que aquí no se repiten listas de ids.
//
// Campos de cada zona:
// - evitar: textos; lo absoluto es lo que lleva r=2; lo de r=1 empieza por «Con dolor 4 o más» (C-ZONA-0).
// - tareas: { calentar, estirar }: [{ id | texto, uso: 'alivio' | 'normal' | 'activacion', detalle? }] (C-EST-2).
//   'alivio' vale en B1-B3 si no sube el dolor; 'normal', solo en B0-B1; 'activacion' (de su fase 1, C-CAL-2),
//   en B0-B2. Con `detalle`, solo para ese detalle de la lesión.
// - calentar, estirar: las mismas tareas como textos (nombre del ejercicio), sin las de un detalle concreto.
// - techo: { nueva, cronica } de dolor (C-DOLOR-6). derivar: cuándo consultar (T5).
// - detalles: { porDefecto, opciones: { clave: { nombre, techo?, irradiado?, r?, alivio? } } } (C-ZONA-SUB).
//   Sin detalle se aplica `porDefecto`, la opción más prudente. `r` cambia el riesgo de un ejercicio con ese detalle.
// - cardio: { preferente: { gym, casa, calle, piscina }, condiciones: { id: texto } } (C-CARDIO-6). Solo orden de
//   preferencia y notas: el permiso lo dan siempre las etiquetas r.
// - fases: { 1, 2, 3 } con los ids de rehabilitación del detalle por defecto (del campo rehab del catálogo).
// - rehab: fases 1 y 2 (las que nunca tienen riesgo en la zona), para quien aún lee una lista plana.
import { EJERCICIOS } from './ejercicios.js';

const DATOS = {
  "cadera_lateral": {
    "corta": "Cadera",
    "nombre": "Cadera lateral / Trocanteritis",
    "icono": "🦴",
    "desc": "Tendón del glúteo medio irritado. Dolor en la cara externa de la cadera.",
    "evitar": [
      "Sin sentadillas, prensa, zancadas ni step-up",
      "Sin hip thrust, peso muerto ni buenos días",
      "Sin saltos ni carrera (tampoco comba)",
      "Sin cruzar la pierna, tampoco al estirar",
      "Sin tumbarte sobre el lado que duele (tampoco en plancha lateral)",
      "Con dolor 4 o más: sin abducción tumbado o de pie, abductor en máquina, puente a una pierna, equilibrio ni talones a una pierna",
      "Con dolor 4 o más: sin elíptica, cinta, marcha rápida ni cardio con pasos (step, jumping jacks, mountain climbers)"
    ],
    "tareas": {
      "calentar": [
        { "id": "abduccion-isometrica-pared", "uso": "activacion" },
        { "id": "balanceo-pierna-frontal", "uso": "normal" }
      ],
      "estirar": [
        { "id": "estiramiento-flexor-cadera-pie", "uso": "normal" },
        { "id": "estiramiento-isquios-pie", "uso": "normal" },
        { "id": "descarga-90-90", "uso": "alivio" }
      ]
    },
    "consejo": "El trabajo de abductores con carga progresiva suele ayudar a esta zona: primero isométricos, después con movimiento. No cruces la pierna.",
    "techo": { "nueva": 3, "cronica": 5 },
    "derivar": ["Dolor que te despierta por la noche", "Dolor en la ingle", "Cojera", "Sin mejora en 6 semanas"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "eliptica"],
        "casa": ["cardio-sentado", "boxeo-sombra", "marcha-estatica"],
        "calle": ["marcha-rapida", "cardio-sentado"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "bici-estatica": "Con el sillín alto.",
        "marcha-rapida": "En llano.",
        "marcha-estatica": "Solo con dolor 1-3."
      }
    }
  },
  "rodilla": {
    "corta": "Rodilla",
    "nombre": "Rodilla",
    "icono": "🦵",
    "desc": "Incluye menisco, ligamentos, condromalacia y tendinopatía rotuliana.",
    "evitar": [
      "Sin doblar la rodilla más de 90° con carga (sentadilla con barra, zancadas, búlgara)",
      "Sin extensión de cuádriceps en máquina ni curl nórdico",
      "Sin saltos ni carrera (tampoco comba)",
      "Sin cargar el peso sobre la rodilla muy doblada (postura del niño, estiramientos de rodillas o con el talón al glúteo)",
      "Con dolor 4 o más: sin sentadillas parciales, prensa, step-up ni step",
      "Con dolor 4 o más: sin elíptica, jumping jacks, mountain climbers ni patada de crol",
      "Con dolor 4 o más: sin apoyar la rodilla en cuadrupedia (bird dog, gato-camello, flexiones de rodillas)"
    ],
    "tareas": {
      "calentar": [
        { "id": "extension-rodilla-isometrica", "uso": "activacion" },
        { "id": "balanceo-pierna-frontal", "uso": "normal" },
        { "id": "movilidad-tobillo-pared", "uso": "normal" }
      ],
      "estirar": [
        { "id": "estiramiento-flexor-cadera-pie", "uso": "normal" },
        { "id": "estiramiento-isquios-pie", "uso": "alivio" },
        { "id": "estiramiento-gemelo-pared", "uso": "normal" }
      ]
    },
    "consejo": "Fortalecer el cuádriceps, primero en isométrico y en rango corto, suele proteger la rodilla.",
    "techo": { "nueva": 3, "cronica": 3 },
    "derivar": ["Bloqueo de la rodilla", "Fallos («se me va»)", "Hinchazón que vuelve después de entrenar", "Golpe con chasquido"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "eliptica"],
        "casa": ["marcha-estatica", "cardio-sentado", "boxeo-sombra"],
        "calle": ["marcha-rapida", "cardio-sentado"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "bici-estatica": "Con el sillín alto y poca resistencia.",
        "eliptica": "Solo con dolor 1-3."
      }
    }
  },
  "hombro": {
    "corta": "Hombro",
    "nombre": "Hombro / Manguito rotador",
    "icono": "💪",
    "desc": "Tendones del manguito rotador, bursitis subacromial o inestabilidad del hombro.",
    "evitar": [
      "Sin press por encima de la cabeza con carga (máquina, mancuernas, botellas, banda, pike)",
      "Sin fondos (paralelas, banco o asistidos) ni extensión de tríceps por detrás de la cabeza",
      "Sin dominadas ni dominadas escapulares; sin colgarte de la barra",
      "Sin aperturas profundas, pullover, press de banca con barra ni dislocaciones con banda",
      "Con dolor 4 o más: sin press de pecho o inclinado, flexiones, aperturas en máquina ni cruces",
      "Con dolor 4 o más: sin jalón, dominadas asistidas o negativas ni elevaciones laterales",
      "Con dolor 4 o más: sin Y-T-W, plancha, rueda ni leñador",
      "Con dolor 4 o más: sin crol, espalda ni patada con tabla; sin remo ergómetro, jumping jacks ni boxeo de sombra",
      "Con dolor 4 o más: sin estirar el pecho ni el hombro cruzado"
    ],
    "tareas": {
      "calentar": [
        { "id": "rotacion-externa-isometrica", "uso": "activacion" },
        { "texto": "Péndulo: inclinado con apoyo, deja colgar el brazo y haz círculos pequeños", "uso": "alivio" },
        { "id": "circulos-brazos", "uso": "normal" },
        { "id": "separacion-banda", "uso": "normal" }
      ],
      "estirar": [
        { "id": "estiramiento-pectoral-pared", "uso": "normal" },
        { "id": "estiramiento-hombro-cruzado", "uso": "normal" }
      ]
    },
    "consejo": "Las rotaciones externas y el trabajo de escápulas suelen ayudar al hombro. Lo de por encima de la cabeza, lo último en volver.",
    "techo": { "nueva": 3, "cronica": 5 },
    "derivar": ["No poder levantar el brazo", "Dolor que te despierta", "Sensación de que el hombro se sale", "Dolor después de una caída", "Hormigueo hacia la mano"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "cinta-inclinada", "eliptica"],
        "casa": ["marcha-estatica", "step-bajo"],
        "calle": ["marcha-rapida"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "eliptica": "Sin usar los brazos.",
        "nado-continuo": "Solo con dolor 1-3."
      }
    }
  },
  "lumbar": {
    "corta": "Lumbar",
    "nombre": "Zona lumbar / Espalda baja",
    "icono": "🔩",
    "desc": "Contractura, hernia, protrusión o lumbociática.",
    "evitar": [
      "Sin flexión de tronco con carga (peso muerto, buenos días)",
      "Sin rotaciones con carga (leñador)",
      "Sin abdominales en flexión (crunch, elevación de piernas, rueda)",
      "Sin rodillas al pecho (con detalle «contractura», sí, si te alivia)",
      "Sin remo con barra inclinado ni sentadilla con barra",
      "Con dolor 4 o más: sin prensa, sentadilla goblet o en Smith, hip thrust ni peso muerto a una pierna",
      "Con dolor 4 o más: sin hiperextensión, superman, pull-through, patadas de glúteo ni glúteo en máquina",
      "Con dolor 4 o más: sin remo con mancuerna, en polea o con mochila, pájaros, patada de tríceps ni press militar",
      "Con dolor 4 o más: sin remo ergómetro, carrera ni comba"
    ],
    "tareas": {
      "calentar": [
        { "id": "dead-bug", "uso": "activacion" },
        { "id": "gato-camello", "uso": "alivio" },
        { "id": "rotacion-toracica-cuadrupedia", "uso": "normal" }
      ],
      "estirar": [
        { "id": "estiramiento-flexor-cadera-pie", "uso": "normal" },
        { "id": "descarga-90-90", "uso": "alivio" },
        { "id": "gato-camello", "uso": "alivio" },
        { "id": "estiramiento-gluteo-rodilla-pecho", "uso": "alivio", "detalle": ["contractura"] }
      ]
    },
    "consejo": "Moverse suele sentar mejor que el reposo. El core estabilizador (dead bug, bird dog) y caminar erguido protegen la espalda.",
    "techo": { "nueva": 3, "cronica": 3 },
    "derivar": ["Pérdida de control de la orina o las heces, o adormecimiento entre los muslos: a urgencias hoy", "Hormigueo o pérdida de fuerza en una pierna, o dolor que baja por debajo de la rodilla y va a más", "Dolor por la noche con fiebre o pérdida de peso", "Más de 6 semanas sin mejora"],
    "cardio": {
      "preferente": {
        "gym": ["cinta-inclinada", "bici-estatica", "eliptica"],
        "casa": ["marcha-estatica", "boxeo-sombra"],
        "calle": ["marcha-rapida"],
        "piscina": ["nado-continuo", "aquajogging"]
      },
      "condiciones": {
        "cinta-inclinada": "En llano y erguido.",
        "bici-estatica": "Erguido.",
        "eliptica": "Erguido.",
        "marcha-rapida": "Erguido.",
        "nado-continuo": "De espalda o crol.",
        "remo-ergometro": "Con dolor 4 o más, sin remo."
      }
    }
  },
  "codo": {
    "corta": "Codo",
    "nombre": "Codo / Epicondilitis",
    "icono": "🦾",
    "desc": "Epicondilitis lateral (tenista) o medial (golfista). Tendones del antebrazo.",
    "evitar": [
      "Sin curl de bíceps con carga (mancuernas, martillo, barra, polea, máquina, botellas, australiano)",
      "Sin press francés",
      "Sin extensiones de muñeca pesadas o rápidas; las de la rehabilitación, sí",
      "Con dolor 4 o más: sin agarres fuertes y largos (paseo del granjero, remo con barra o australiano, dominadas)",
      "Con dolor 4 o más: sin curl con banda, extensiones de tríceps ni fondos",
      "Con dolor 4 o más: sin remo ergómetro ni boxeo de sombra",
      "Agarre neutro en jalones y remos"
    ],
    "tareas": {
      "calentar": [
        { "id": "prension-pelota", "uso": "activacion" },
        { "texto": "Rotaciones de muñeca suaves", "uso": "alivio" },
        { "texto": "Abrir y cerrar la mano", "uso": "alivio" }
      ],
      "estirar": [
        { "texto": "Estiramiento de extensores de muñeca: brazo estirado, palma hacia abajo, tensión suave", "uso": "normal" },
        { "texto": "Estiramiento de flexores de muñeca: brazo estirado, palma hacia arriba, tensión suave", "uso": "normal" }
      ]
    },
    "consejo": "El tendón suele mejorar con carga lenta y progresiva: isométricos primero y excéntricos después. Agarre neutro siempre que puedas.",
    "techo": { "nueva": 3, "cronica": 5 },
    "derivar": ["Hormigueo en el anular y el meñique", "Pérdida de fuerza al agarrar", "Más de 3 meses sin mejora", "Dolor después de un golpe"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "cinta-inclinada", "eliptica"],
        "casa": ["marcha-estatica", "step-bajo"],
        "calle": ["marcha-rapida"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "bici-estatica": "Sin agarrar fuerte el manillar.",
        "eliptica": "Sin agarrar fuerte las asas.",
        "cinta-inclinada": "Sin agarrarte a la barra.",
        "nado-continuo": "Solo con dolor 1-3."
      }
    }
  },
  "cervical": {
    "corta": "Cuello",
    "nombre": "Cervicales / Cuello",
    "icono": "🧠",
    "desc": "Contractura cervical, artrosis o dolor que baja por el brazo.",
    "evitar": [
      "Sin encogimientos de hombros pesados ni cargas detrás de la nuca",
      "Sin posiciones cabeza abajo (pike)",
      "Sin llevar la cabeza hacia atrás con carga",
      "Con dolor 4 o más: sin crol con respiración lateral ni sus ejercicios de técnica",
      "Con dolor 4 o más: sin crunch, superman ni paseo del granjero",
      "Con dolor 4 o más: sin elevaciones laterales ni press de hombro"
    ],
    "tareas": {
      "calentar": [
        { "id": "retraccion-cervical", "uso": "alivio" },
        { "texto": "Giros de cuello lentos, sin forzar el final", "uso": "normal" }
      ],
      "estirar": [
        { "texto": "Inclinación lateral de cuello (oreja hacia el hombro), suave", "uso": "normal" },
        { "id": "estiramiento-pectoral-pared", "uso": "normal" }
      ]
    },
    "consejo": "La retracción cervical (doble mentón) suele ser de lo que más ayuda al cuello. Sin forzar el final del movimiento.",
    "techo": { "nueva": 3, "cronica": 3 },
    "derivar": ["Hormigueo, adormecimiento o pérdida de fuerza en un brazo", "Mareo, náuseas o vértigo al mover el cuello", "Dolor después de un golpe o un accidente de coche", "Rigidez de cuello con fiebre"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "eliptica", "cinta-inclinada"],
        "casa": ["marcha-estatica", "step-bajo"],
        "calle": ["marcha-rapida"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "bici-estatica": "Erguido.",
        "nado-continuo": "De espalda; sin crol con dolor 4 o más."
      }
    }
  },
  "tobillo_pie": {
    "corta": "Tobillo",
    "nombre": "Tobillo / Pie",
    "icono": "🦶",
    "desc": "Esguince, fascitis plantar, tendinopatía aquílea o inestabilidad de tobillo.",
    "evitar": [
      "Sin saltos ni carrera (tampoco comba)",
      "Con Aquiles: sin bajar el talón por debajo del escalón, ni al estirar ni en los talones",
      "Lesión reciente (menos de 6 semanas): sin carga sobre el pie más allá de lo que te deje caminar sin dolor",
      "Con dolor 4 o más: sin sentadillas con peso, zancadas, búlgara ni step-up",
      "Con dolor 4 o más: sin marcha (tampoco en el sitio), cinta, elíptica, step, jumping jacks ni boxeo de sombra",
      "Con dolor 4 o más: sin elevaciones de talones a una pierna ni con peso",
      "Con dolor 4 o más: sin paseo del granjero ni mountain climbers"
    ],
    "tareas": {
      "calentar": [
        { "id": "movilidad-tobillo-pared", "uso": "normal" },
        { "id": "balanceo-pierna-frontal", "uso": "normal" }
      ],
      "estirar": [
        { "id": "estiramiento-gemelo-pared", "uso": "normal" },
        { "id": "estiramiento-isquios-pie", "uso": "normal" }
      ]
    },
    "consejo": "La piscina y la bici permiten seguir con el cardio sin cargar el tobillo.",
    "techo": { "nueva": 3, "cronica": 3 },
    "derivar": ["No poder apoyar el pie y dar 4 pasos", "Dolor en el hueso (tobillo o borde exterior del pie)", "Chasquido en el Aquiles o no poder ponerte de puntillas", "Hinchazón que no baja en 1 semana", "Esguinces que se repiten"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "remo-ergometro"],
        "casa": ["cardio-sentado", "bici-estatica"],
        "calle": ["cardio-sentado"],
        "piscina": ["nado-continuo", "aquajogging"]
      },
      "condiciones": {
        "nado-continuo": "Con pull buoy y sin aletas.",
        "cardio-sentado": "En la calle, con dolor 4 o más, mejor el gimnasio o la piscina."
      }
    }
  },
  "muñeca": {
    "corta": "Muñeca",
    "nombre": "Muñeca / Mano",
    "icono": "✋",
    "desc": "Tendinitis de muñeca, síndrome del túnel carpiano o esguince.",
    "evitar": [
      "Sin apoyarte en la mano con la muñeca doblada hacia atrás y carga (fondos, flexiones diamante, pike)",
      "Sin doblar y estirar la muñeca con carga, salvo los ejercicios de la rehabilitación",
      "Con dolor 4 o más: sin flexiones, press de banca ni curl con barra",
      "Con dolor 4 o más: sin cuadrupedia (bird dog, gato-camello, patada de glúteo) ni mountain climbers",
      "Con dolor 4 o más: sin paseo del granjero, comba, remo ergómetro ni boxeo de sombra",
      "Plancha sobre los antebrazos, no sobre las manos"
    ],
    "tareas": {
      "calentar": [
        { "id": "prension-pelota", "uso": "activacion" },
        { "texto": "Rotaciones de muñeca suaves", "uso": "alivio" },
        { "texto": "Abrir y cerrar la mano", "uso": "alivio" }
      ],
      "estirar": [
        { "texto": "Estiramiento de flexores de muñeca: brazo estirado, palma hacia arriba, tensión suave", "uso": "normal" },
        { "texto": "Estiramiento de extensores de muñeca: brazo estirado, palma hacia abajo, tensión suave", "uso": "normal" }
      ]
    },
    "consejo": "Plancha sobre los antebrazos y agarre neutro para no sobrecargar la muñeca.",
    "techo": { "nueva": 3, "cronica": 3 },
    "derivar": ["Hormigueo por la noche del pulgar al anular", "Caída sobre la mano con dolor en la base del pulgar", "Bulto o chasquido en la muñeca"],
    "cardio": {
      "preferente": {
        "gym": ["bici-estatica", "cinta-inclinada", "eliptica"],
        "casa": ["marcha-estatica", "step-bajo"],
        "calle": ["marcha-rapida"],
        "piscina": ["aquajogging", "nado-continuo"]
      },
      "condiciones": {
        "bici-estatica": "Sin agarrar fuerte el manillar.",
        "eliptica": "Sin agarrar fuerte las asas.",
        "cinta-inclinada": "Sin agarrarte a la barra.",
        "nado-continuo": "Solo con dolor 1-3."
      }
    }
  }
};

// Detalle de la lesión (C-ZONA-SUB, decisión 3): opcional; sin él, `porDefecto` (lo más prudente).
const DETALLES = {
  "tobillo_pie": {
    "porDefecto": "esguince",
    "opciones": {
      "esguince": { "nombre": "Esguince o tobillo que se tuerce" },
      "fascitis": { "nombre": "Fascitis plantar (planta del pie)", "techo": { "cronica": 5 } },
      "aquiles": { "nombre": "Tendón de Aquiles", "techo": { "cronica": 5 } }
    }
  },
  "lumbar": {
    "porDefecto": "hernia",
    "opciones": {
      "contractura": { "nombre": "Contractura, sin dolor que baje por la pierna", "r": { "estiramiento-gluteo-rodilla-pecho": 1 }, "alivio": ["estiramiento-gluteo-rodilla-pecho"] },
      "hernia": { "nombre": "Hernia o dolor que baja por la pierna", "irradiado": true }
    }
  },
  "codo": {
    "porDefecto": "fuera",
    "opciones": {
      "fuera": { "nombre": "Por fuera (codo de tenista)" },
      "dentro": { "nombre": "Por dentro (codo de golfista)" }
    }
  },
  "cervical": {
    "porDefecto": "contractura",
    "opciones": {
      "contractura": { "nombre": "Contractura" },
      "irradiado": { "nombre": "Dolor que baja por el brazo", "irradiado": true }
    }
  }
};

const POR_ID = Object.fromEntries(EJERCICIOS.map(e => [e.id, e]));
const tiene = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

// Detalle válido de una zona, o el de por defecto (null si la zona no tiene detalles).
export function detalleDe(zona, detalle) {
  const d = DETALLES[zona];
  if (!d) return null;
  return tiene(d.opciones, detalle) ? detalle : d.porDefecto;
}
const opcion = (zona, detalle) => tiene(DETALLES, zona) ? DETALLES[zona].opciones[detalleDe(zona, detalle)] : {};

// Fases en las que un ejercicio sirve de rehabilitación para esa zona y ese detalle ([] si no sirve).
export function fasesDe(e, zona, detalle) {
  const v = ((e && e.rehab) || {})[zona];
  if (v == null) return [];
  const o = typeof v === 'object' && !Array.isArray(v) ? v : { fase: v };
  if (o.detalle && !o.detalle.includes(detalleDe(zona, detalle))) return [];
  return [].concat(o.fase);
}

// { 1: [ids], 2: [ids], 3: [ids] } en el orden del catálogo.
export function rehabPorFase(zona, detalle) {
  const out = { 1: [], 2: [], 3: [] };
  for (const e of EJERCICIOS) for (const f of fasesDe(e, zona, detalle)) if (out[f]) out[f].push(e.id);
  return out;
}

// Riesgo (0, 1 o 2) de un ejercicio en una zona teniendo en cuenta el detalle de la lesión.
export function riesgoDetalle(e, zona, detalle) {
  const r = ((opcion(zona, detalle) || {}).r || {})[e.id];
  return r != null ? r : ((e.r || {})[zona] || 0);
}

// Techo de dolor (C-DOLOR-6): { techo, sube, irradiado }. `sube` es lo que puede subir sobre el dolor de partida
// (0 con dolor irradiado: si sube o baja más hacia la mano o el pie, se para). Rehabilitación: techo 3 siempre.
export function techoDolor(zona, { nueva = true, detalle, rehab = false } = {}) {
  const op = opcion(zona, detalle) || {};
  const t = { nueva: 3, cronica: 3, ...((DATOS[zona] || {}).techo || {}), ...(op.techo || {}) };
  const techo = rehab ? Math.min(3, nueva ? t.nueva : t.cronica) : nueva ? t.nueva : t.cronica;
  return { techo, sube: op.irradiado ? 0 : 2, irradiado: !!op.irradiado };
}

const FASE_TXT = {
  1: 'aguanta sin moverte, a la mitad o algo más de tu fuerza.',
  2: 'lento: 3 segundos al bajar, 1 de pausa y 2 al subir, dejando 3 repeticiones de margen.',
  3: 'fuerza progresiva, con 2 repeticiones de margen y el movimiento controlado.',
};
const HACIA = { cervical: 'la mano', lumbar: 'el pie' };

// Nota de un ejercicio de rehabilitación con el dolor real de hoy y su techo (C-ZONA-0, C-DOLOR-6).
// dolor: el de hoy (0-10) o null si no se sabe; nueva: lesión nueva o puntual (C-LES-1, C-LES-4).
export function notaRehab(zona, { dolor = null, fase = 2, detalle, nueva = true } = {}) {
  const nombre = ((DATOS[zona] || {}).corta || zona).toLowerCase();
  const { techo, irradiado } = techoDolor(zona, { nueva, detalle, rehab: true });
  const d = dolor === null || dolor === '' || !Number.isFinite(+dolor) ? null : Math.max(0, Math.min(10, Math.round(+dolor)));
  let regla;
  if (irradiado) regla = `${d != null ? `Empiezas en ${d}/10: ` : ''}no debe subir; si sube o baja más hacia ${HACIA[zona] || 'la mano o el pie'}, para.`;
  else if (d == null) regla = `El dolor puede subir como mucho 2 puntos sobre cómo empiezas y nunca por encima de ${techo}/10.`;
  else {
    const max = Math.min(d + 2, techo);
    regla = max > d ? `Empiezas en ${d}/10: puede subir hasta ${max}/10, no más; si pasa, para y sigue con el siguiente.`
      : `Empiezas en ${d}/10: no debe subir; si sube, para y sigue con el siguiente.`;
  }
  return `Para tu ${nombre}: ${FASE_TXT[fase] || FASE_TXT[2]} ${regla} Mañana debe estar como hoy antes de empezar.`;
}

const nombreTarea = t => t.texto || (POR_ID[t.id] ? POR_ID[t.id].n : t.id);

export const ZONAS = Object.fromEntries(Object.entries(DATOS).map(([z, Z]) => {
  const fases = rehabPorFase(z);
  const comunes = l => l.filter(t => !t.detalle);
  return [z, {
    ...Z,
    calentar: comunes(Z.tareas.calentar).map(nombreTarea),
    estirar: comunes(Z.tareas.estirar).map(nombreTarea),
    detalles: DETALLES[z] || null,
    fases,
    rehab: [...new Set([...fases[1], ...fases[2]])],
  }];
}));
