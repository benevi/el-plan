// Calentamientos, vueltas a la calma y zonas de lesión (de la versión anterior)
window.WARMUPS = {
  him: {
    gym: [
      { name: "Cardio suave", detail: "Cinta caminando rápido al 3-5% de inclinación, bici o elíptica. Hasta que empieces a sudar ligeramente.", duration: "3-5 min" },
      { name: "Círculos de brazos", detail: "10 hacia adelante y 10 hacia atrás con cada brazo.", duration: "30s" },
      { name: "Rotaciones de cadera", detail: "10 a cada lado, movimientos amplios.", duration: "30s" },
      { name: "Sentadillas sin peso", detail: "10 reps al aire, técnica completa.", duration: "30s" },
      { name: "Zancadas sin peso", detail: "5 por pierna, alternas.", duration: "30s" },
      { name: "Series de aproximación", detail: "1-2 series con la barra vacía o la mitad del peso del primer ejercicio. Activa el patrón motor antes de cargar.", duration: "2 min" }
    ],
    Piscina: [
      { name: "Ducha y entrada gradual", detail: "Mójate antes de meterte. No saltes al agua fría de golpe.", duration: "1 min" },
      { name: "Caminar en el agua", detail: "Adelante, atrás y de lado. Activa el cuerpo y adapta la temperatura.", duration: "3 min" },
      { name: "Burbujas (preparación respiratoria)", detail: "Agarrado al borde, mete cabeza y suelta TODO el aire en burbujas. Saca y coge aire por la boca. 10-15 repeticiones lentas.", duration: "2 min" }
    ],
    Casa: [
      { name: "Saltos suaves / marcha en el sitio", detail: "Marcha o trote suave en el sitio para subir pulsaciones. Hasta notar el cuerpo caliente.", duration: "3 min" },
      { name: "Círculos de brazos", detail: "10 hacia adelante y 10 hacia atrás con cada brazo.", duration: "30s" },
      { name: "Rotaciones de cadera", detail: "10 a cada lado, movimientos amplios.", duration: "30s" },
      { name: "Sentadillas sin peso", detail: "10 reps al aire, técnica completa para activar las piernas.", duration: "30s" },
      { name: "Movilidad de tobillos y muñecas", detail: "Importante antes de flexiones y sentadillas. 10 círculos cada uno.", duration: "30s" }
    ],
    Calle: [
      { name: "Trote suave o caminar rápido", detail: "5 min para llegar al parque o dar una vuelta. Sube pulsaciones y calienta las piernas.", duration: "5 min" },
      { name: "Círculos de brazos y hombros", detail: "10 adelante y 10 atrás. Importante antes de dominadas y fondos.", duration: "30s" },
      { name: "Colgarse de la barra", detail: "Cuélgate 15-20 seg de la barra de dominadas. Prepara hombros y agarre, descomprime la espalda.", duration: "30s" },
      { name: "Sentadillas y zancadas sin peso", detail: "10 sentadillas + 5 zancadas por pierna para activar el tren inferior.", duration: "1 min" },
      { name: "Flexiones lentas de activación", detail: "5-8 flexiones suaves para activar pecho y hombros antes de las series fuertes.", duration: "30s" }
    ]
  },
  her: {
    gym: [
      { name: "Bici estática suave", detail: "TU MEJOR opción para calentar — no carga la cadera lateralmente. Ritmo cómodo, no fuerces.", duration: "8-10 min" },
      { name: "Círculos de brazos", detail: "10 hacia adelante y 10 hacia atrás con cada brazo.", duration: "30s" },
      { name: "Rotaciones de torso", detail: "10 a cada lado, sentada o de pie.", duration: "30s" },
      { name: "Puente de glúteo SIN peso", detail: "10 reps lentas. Despierta el glúteo antes de cargarlo. Esto es clave para ti.", duration: "1 min" },
      { name: "Activación de glúteo medio", detail: "Tumbada SOBRE EL LADO SANO, eleva la pierna afectada 10 veces despacio. Si molesta, sáltatelo.", duration: "1 min" }
    ],
    Piscina: [
      { name: "Ducha y entrada gradual", detail: "Mójate antes de meterte. El agua tibia es ideal para ti.", duration: "1 min" },
      { name: "Caminar en el agua", detail: "Agua hasta el pecho. Adelante, atrás y de lado. Activa el glúteo medio con descarga total — perfecto para ti.", duration: "5 min" }
    ],
    Casa: [
      { name: "Marcha suave en el sitio", detail: "Calienta el cuerpo sin impacto. Si molesta, hazlo más suave o sentada moviendo los brazos.", duration: "3-5 min" },
      { name: "Círculos de brazos", detail: "10 hacia adelante y 10 hacia atrás con cada brazo.", duration: "30s" },
      { name: "Rotaciones de torso", detail: "10 a cada lado, sentada o de pie.", duration: "30s" },
      { name: "Puente de glúteo SIN peso", detail: "10 reps lentas. Despierta el glúteo antes de cargarlo. Clave para ti.", duration: "1 min" },
      { name: "Activación de glúteo medio", detail: "Tumbada SOBRE EL LADO SANO, eleva la pierna afectada 10 veces despacio. Si molesta, sáltatelo.", duration: "1 min" }
    ],
    Calle: [
      { name: "Caminar hasta el parque", detail: "El propio paseo te sirve de calentamiento. Ritmo cómodo, sin forzar la cadera.", duration: "5 min" },
      { name: "Círculos de brazos y hombros", detail: "10 adelante y 10 atrás. Prepara el tren superior para remo y fondos.", duration: "30s" },
      { name: "Rotaciones de torso", detail: "10 a cada lado, de pie, movimientos suaves.", duration: "30s" },
      { name: "Puente de glúteo en el césped", detail: "10 reps lentas para despertar el glúteo antes de trabajar. Clave para ti.", duration: "1 min" }
    ]
  }
};

window.COOLDOWNS = {
  him: {
    gym: [
      { name: "Cardio moderado final", detail: "Cinta inclinada caminando rápido, bici o elíptica. Intensidad: puedes hablar pero con dificultad. Para perder grasa.", duration: "15-20 min" },
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en una pared con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento de cuádriceps", detail: "De pie, agarra el tobillo y llévalo al glúteo. Rodillas juntas. 30s por pierna.", duration: "1 min" },
      { name: "Estiramiento de isquios", detail: "Sentado en el suelo, una pierna estirada, intenta tocar la punta del pie sin forzar. 30s por pierna.", duration: "1 min" },
      { name: "Estiramiento de espalda", detail: "Posición de niño (rodillas en el suelo, brazos estirados al frente, frente al suelo). Respira profundo.", duration: "1 min" },
      { name: "Hidratación", detail: "Bebe 500 ml de agua antes de salir. Vas a necesitarla.", duration: "—" }
    ],
    Piscina: [
      { name: "Flotación boca arriba", detail: "Brazos en cruz, respira tranquilo. Te subes solo si te relajas del todo. Excelente sensación final.", duration: "2-3 min" },
      { name: "Burbujas tranquilas", detail: "En el borde, respira profundo y suelta aire bajo el agua sin prisa. Te ayuda a integrar lo aprendido.", duration: "1 min" },
      { name: "Ducha y crema", detail: "Ducha con agua templada. Crema hidratante en cuerpo (el cloro reseca mucho).", duration: "—" }
    ],
    Casa: [
      { name: "Cardio opcional", detail: "Si tienes espacio: 10-15 min de saltos, burpees suaves o subir y bajar escaleras. Para perder grasa.", duration: "10-15 min" },
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en el marco de una puerta con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento de cuádriceps", detail: "De pie, agarra el tobillo y llévalo al glúteo. Rodillas juntas. 30s por pierna.", duration: "1 min" },
      { name: "Estiramiento de espalda", detail: "Posición de niño (rodillas en el suelo, brazos al frente, frente al suelo). Respira profundo.", duration: "1 min" },
      { name: "Hidratación", detail: "Bebe agua. Has sudado más de lo que crees.", duration: "—" }
    ],
    Calle: [
      { name: "Caminar de vuelta a casa", detail: "El paseo de vuelta baja pulsaciones poco a poco. Aprovecha para recuperar.", duration: "5-10 min" },
      { name: "Estiramiento de espalda y dorsales", detail: "Agárrate a la barra con un brazo y deja caer el peso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en un poste o barra vertical con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento de cuádriceps", detail: "De pie, agarra el tobillo y llévalo al glúteo (sujétate de la barra para el equilibrio). 30s por pierna.", duration: "1 min" },
      { name: "Hidratación", detail: "Bebe agua. Llévate siempre una botella al parque.", duration: "—" }
    ]
  },
  her: {
    gym: [
      { name: "Bici estática suave", detail: "Para bajar revoluciones sin cargar la cadera. Ritmo muy suave.", duration: "5-10 min" },
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en pared con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento suave de espalda", detail: "Posición de niño (rodillas en el suelo, brazos al frente, frente al suelo). Respira profundo. NO fuerces.", duration: "1 min" },
      { name: "Movilidad de cadera SUAVE", detail: "De pie, círculos pequeños con la rodilla (mueves la cadera sin cargarla). NO estiramientos de cruzar pierna por delante.", duration: "1 min" },
      { name: "Frío local si está irritada", detail: "Si después del entreno la zona del trocánter queda muy irritada, hielo local 10 min puede ayudar (sobre una toalla, nunca directo sobre la piel).", duration: "10 min (opcional)" },
      { name: "Hidratación", detail: "Bebe 500 ml de agua antes de salir.", duration: "—" }
    ],
    Piscina: [
      { name: "Flotación boca arriba", detail: "Brazos en cruz, respira tranquilo. Permite que la cadera se descargue totalmente.", duration: "2-3 min" },
      { name: "Movilidad SUAVE en el agua", detail: "Círculos pequeños con la pierna, sin forzar rango. El agua te da resistencia amable.", duration: "1 min" },
      { name: "Lo que NO hacer", detail: "Evita estiramientos forzados de tipo \"cruzar pierna por delante\". Comprimen el tendón irritado.", duration: "—" },
      { name: "Ducha y crema", detail: "Ducha con agua templada. Crema hidratante (el cloro reseca).", duration: "—" }
    ],
    Casa: [
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en el marco de una puerta con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Estiramiento suave de espalda", detail: "Posición de niño (rodillas en el suelo, brazos al frente, frente al suelo). Respira profundo. NO fuerces.", duration: "1 min" },
      { name: "Movilidad de cadera SUAVE", detail: "Tumbada boca arriba, lleva una rodilla al pecho suavemente (NO cruzada). Solo hasta donde no moleste. 20s por pierna.", duration: "1 min" },
      { name: "Frío local si está irritada", detail: "Si la zona del trocánter queda muy irritada, hielo local 10 min sobre una toalla (nunca directo sobre la piel).", duration: "10 min (opcional)" },
      { name: "Hidratación", detail: "Bebe agua para recuperar.", duration: "—" }
    ],
    Calle: [
      { name: "Caminar de vuelta a casa", detail: "El paseo de vuelta baja pulsaciones y mantiene la cadera en movimiento suave.", duration: "5-10 min" },
      { name: "Estiramiento de pecho", detail: "Apoya el antebrazo en un poste o barra vertical con codo a 90°. Gira el torso al lado contrario. 30s por lado.", duration: "1 min" },
      { name: "Movilidad de cadera SUAVE", detail: "De pie, sujétate de la barra y haz círculos pequeños con la rodilla. NADA de cruzar la pierna por delante.", duration: "1 min" },
      { name: "Frío local si está irritada", detail: "Si la zona del trocánter queda irritada, hielo local 10 min al llegar a casa (sobre una toalla).", duration: "10 min (opcional)" },
      { name: "Hidratación", detail: "Bebe agua para recuperar.", duration: "—" }
    ]
  }
};


window.INJURY_ZONES = {
  cadera_lateral: {
    name: 'Cadera lateral / Trocanteritis',
    icon: '🦴',
    desc: 'Tendón del glúteo medio inflamado. Dolor en la cara externa de la cadera.',
    danger_kw: ['sentadilla','zancada','búlgara','caminando','hip thrust','peso muerto','aductor','cruzar','salto','correr','running','pistol','step-up','leg press','prensa','extensión de cadera'],
    safe_kw: ['abductor','plancha','dead bug','bird dog','puente','curl bíceps','press','elevación lateral','jalón','remo','fondos','dominadas','face pull','extensión tríceps'],
    danger_rules: ['Sin sentadillas ni zancadas','Sin hip thrust ni peso muerto','Sin máquina aductora (cruzar piernas)','Sin saltos ni carrera','Sin cruzar pierna por delante','Sin dormir sobre el lado afectado'],
    warmup_rec: ['Bici estática suave 5 min','Rotaciones de cadera tumbado','Puente de glúteo (activación)','Activación de glúteo medio en cuadrupedia'],
    stretch_rec: ['Estiramiento de glúteo medio (tumbado, sin cruzar pierna)','Estiramiento de piriforme en silla','Estiramiento de cuádriceps de pie con apoyo'],
    tip: 'El abductor con fuerza progresiva ES terapéutico. El dolor manda: si pica, para.'
  },
  rodilla: {
    name: 'Rodilla',
    icon: '🦵',
    desc: 'Incluye menisco, ligamentos, condromalacia y tendinopatía rotuliana.',
    danger_kw: ['sentadilla profunda','pistol','zancada','step-up','leg press completo','extensión de rodilla','salto','correr','running','prensa (rango largo)'],
    safe_kw: ['curl femoral','puente','plancha','press','elevaciones laterales','jalón','remo','fondos','dominadas','curl bíceps','natación','piscina','bici estática'],
    danger_rules: ['Sin flexión de rodilla >90°','Sin extensiones de rodilla con carga pesada','Sin saltos ni carrera','Sentadilla solo parcial si se permite','Evitar subir escaleras con carga'],
    warmup_rec: ['Bici estática sin resistencia 5 min','Activación de cuádriceps en silla','Elevación de pierna recta tumbado','Rotaciones de tobillo'],
    stretch_rec: ['Estiramiento de cuádriceps de pie con apoyo','Estiramiento de isquios sentado','Estiramiento de pantorrilla en pared'],
    tip: 'Fortalece el cuádriceps (isométrico, rango corto) para proteger la rodilla.'
  },
  hombro: {
    name: 'Hombro / Manguito rotador',
    icon: '💪',
    desc: 'Tendones del manguito rotador, bursitis subacromial o inestabilidad glenohumeral.',
    danger_kw: ['press militar','press de hombro','elevaciones frontales','fondos','press inclinado','press banca','dominadas','jalón detrás de la nuca','remo al cuello'],
    safe_kw: ['face pull','rotación externa','bird dog','plancha','curl bíceps','extensión tríceps polea','remo sentado','jalón al pecho (agarre neutro)','elevaciones laterales suaves'],
    danger_rules: ['Sin press por encima de la cabeza con carga','Sin fondos ni dominadas amplias','Sin press inclinado pesado','Sin jalón detrás de la nuca','Evitar movimientos por encima del hombro con dolor'],
    warmup_rec: ['Rotaciones de hombro con banda ligera','Pendulares de Codman 30s','Activación de rotadores externos con banda','Movilidad escapular (retracciones)'],
    stretch_rec: ['Estiramiento de pectoral en puerta','Estiramiento del manguito rotador cruzado','Estiramiento de tríceps sobre la cabeza','Estiramiento de deltoides cruzado'],
    tip: 'Los face pull y rotaciones externas son terapéuticos. Prioriza el trabajo escapular.'
  },
  lumbar: {
    name: 'Zona lumbar / Espalda baja',
    icon: '🔩',
    desc: 'Contractura, hernia, protrusión o lumbociática.',
    danger_kw: ['peso muerto','buenos días','sentadilla','hip thrust','remo con barra','remo inclinado','press militar de pie','encogimientos','crunch','russian twist','abdominales con carga'],
    safe_kw: ['plancha','dead bug','bird dog','puente','natación','piscina','jalón','remo en máquina','curl bíceps','press en máquina','extensión tríceps'],
    danger_rules: ['Sin flexión de tronco con carga (peso muerto, buenos días)','Sin rotaciones con carga (Russian twist)','Sin crunch ni abdominales con carga','Sin press militar de pie con carga pesada','Sin remo con barra inclinado'],
    warmup_rec: ['Rodillas al pecho tumbado 30s','Cat-cow en cuadrupedia 10 reps','Rotaciones de cadera tumbado','Bird dog suave (activación core)'],
    stretch_rec: ['Estiramiento de piriforme tumbado','Estiramiento de psoas de rodillas','Estiramiento de isquios suave','Rodillas al pecho (postura fetal)'],
    tip: 'El core estabilizador (plancha, dead bug) protege la lumbar. Evita hiperlordosis.'
  },
  codo: {
    name: 'Codo / Epicondilitis',
    icon: '🦾',
    desc: 'Epicondilitis lateral (tenista) o medial (golfista). Tendón del antebrazo.',
    danger_kw: ['curl bíceps','curl martillo','curl concentrado','remo con mancuerna','jalón supino','dominadas supinas','remo con barra','extensión de muñeca'],
    safe_kw: ['press máquina','plancha','sentadilla','puente','jalón neutro','remo en máquina','curl femoral','extensión cuádriceps','piscina','bici'],
    danger_rules: ['Sin curl de bíceps con carga','Sin remo con supinación forzada','Sin extensiones de muñeca','Agarre neutro en todos los jalones','Descanso activo del antebrazo'],
    warmup_rec: ['Rotaciones de muñeca suaves','Estiramientos de antebrazo (flexor/extensor)','Apertura y cierre de mano','Bandas de resistencia mínima en muñeca'],
    stretch_rec: ['Estiramiento de extensor de muñeca (brazo extendido, mano hacia abajo)','Estiramiento de flexor de muñeca (mano hacia arriba)','Masaje del antebrazo con pulgar'],
    tip: 'Trabaja la fuerza de prensión con bolas o bandas muy ligeras como rehabilitación.'
  },
  cervical: {
    name: 'Cervicales / Cuello',
    icon: '🧠',
    desc: 'Contractura cervical, artrosis o radiculopatía cervical.',
    danger_kw: ['encogimientos','jalón detrás de la nuca','remo al cuello','press militar','press detrás de la nuca','shrugs','trapecio'],
    safe_kw: ['plancha','dead bug','jalón al pecho','remo sentado','curl bíceps','extensión tríceps','piscina (braza suave)','bici'],
    danger_rules: ['Sin encogimientos de hombros (shrugs) pesados','Sin jalón detrás de la nuca','Sin press detrás de la nuca','Sin remo al cuello','Sin llevar la cabeza hacia atrás con carga'],
    warmup_rec: ['Rotaciones de cuello suaves (3×cada lado)','Inclinaciones laterales lentas','Retracción cervical (chin tucks)','Movilidad escapular'],
    stretch_rec: ['Estiramiento lateral de cuello (oreja a hombro)','Estiramiento de trapecios (mano en cabeza suave)','Chin tuck contra pared'],
    tip: 'La retracción cervical (chin tuck) es el ejercicio más efectivo para la postura cervical.'
  },
  tobillo_pie: {
    name: 'Tobillo / Pie',
    icon: '🦶',
    desc: 'Esguince, fascitis plantar, tendinopatía aquílea o inestabilidad de tobillo.',
    danger_kw: ['salto','correr','running','gemelo','elevación de talones','sentadilla','zancada','step-up','calistenia calle','burpee'],
    safe_kw: ['bici estática','natación','piscina','press','jalón','remo','curl bíceps','dominadas','fondos','plancha','dead bug'],
    danger_rules: ['Sin saltos ni carrera','Sin elevaciones de talones con carga','Sin sentadillas con peso','Sin carga sobre el pie afectado','Movilidad de tobillo sin carga'],
    warmup_rec: ['Rotaciones de tobillo sentado 20 cada sentido','Escritura del alfabeto con el pie','Estiramiento de fascia plantar (dedos hacia arriba)','Elevación de talones sin carga (movilidad)'],
    stretch_rec: ['Estiramiento de gemelo en pared (rodilla extendida)','Estiramiento de sóleo (rodilla flexionada)','Estiramiento de fascia plantar en el suelo'],
    tip: 'La piscina es ideal para mantener cardio y fuerza sin carga sobre el tobillo.'
  },
  muñeca: {
    name: 'Muñeca / Mano',
    icon: '✋',
    desc: 'Tendinitis de muñeca, síndrome del túnel carpiano o esguince.',
    danger_kw: ['press banca','press militar','fondos','dominadas','remo con barra','curl con barra','flexión de muñeca','extensión de muñeca','plancha con manos'],
    safe_kw: ['bici estática','piscina','remo en máquina (con soporte)','jalón en máquina','extensión cuádriceps','curl femoral','puente','dead bug','plancha sobre codos'],
    danger_rules: ['Sin press con extensión de muñeca','Sin fondos ni dominadas con muñeca en extensión','Sin flexión/extensión de muñeca con carga','Usar bandas de muñeca de soporte','Plancha sobre codos, no sobre manos'],
    warmup_rec: ['Rotaciones de muñeca suaves','Estiramientos de muñeca en flexión y extensión','Apertura y cierre de mano','Pelota antiestrés suave'],
    stretch_rec: ['Estiramiento de flexores (mano hacia abajo, brazo extendido)','Estiramiento de extensores (mano hacia arriba)','Masaje palma con pulgar contrario'],
    tip: 'Plancha sobre codos en lugar de manos para no sobrecargar la muñeca.'
  }
};

