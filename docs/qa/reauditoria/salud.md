# Re-auditoría PR 18 · Salud (entrenamiento y readaptación)

**Resumen.** Lo grave de la primera auditoría está cerrado: en 2000 sesiones por reglas, 800 con IA simulada y tramposa, 888 de «Mis sesiones» y 3456 planes no sale ni un ejercicio con r=2 en una zona activa, ni r=1 en B2, ni fuerza o rehabilitación en el día de dolor alto, ni kilos sin historial. El día de dolor alto (D2) dura siempre los minutos pedidos. Quedan 3 fallos **altos** de criterio clínico: (1) la rehabilitación del día del plan, o la que propone la IA, se queda aunque el dolor de hoy pida una fase más baja; (2) la movilidad y los estiramientos no respetan la zona dolorida en B2 ni en D2; (3) quien no sabe nadar pero tiene nivel 2-3 recibe crol y nado continuo. Además hay 9 medios y varios bajos.

Árbol auditado: `/home/user/wt/auditoria` (pipos-v2, `f3164ec`), sin cambios. Scripts en `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/salud/`. Para reproducir: `node <script>.mjs` desde esa carpeta.

## Tabla de hallazgos

| id | sev. | título | archivo:línea |
|---|---|---|---|
| S1 | alto | La rehabilitación de fase 2-3 se queda con el dolor de hoy en B2: viene del plan o de la IA y el validador no mira la fase | `js/areas/entrenador/dia.js:307` (`rehabValida`) |
| S2 | alto | Con dolor de 4-6 y en D2 salen movilidad y estiramientos de la zona dolorida que su ficha limita a B0-B1, además de estiramientos «libres» sin comprobar | `js/areas/entrenador/dolor-alto.js:68`, `dia.js:395`, `dia.js:433`, `js/datos/ejercicios.js:458,464` |
| S3 | alto | Quien no sabe nadar 2 × 25 m pero tiene nivel 2-3 recibe crol, espalda y 15 min de nado continuo. Al principiante se le manda aquajogging «en la parte honda» | `dia.js:261`, `dia.js:528`, `ejercicios.js:311` |
| S4 | medio | Con 60 años o más se pierde el ejercicio de equilibrio cuando el ajuste de tiempo rehace el calentamiento (C-EDAD-1) | `js/areas/entrenador/validar.js:423` y `:484` |
| S5 | medio | El validador marca como «no válida» su propia corrección de C-TIEMPO-2: la sesión de la IA se descarta con el aviso «no cumplía las reglas de seguridad» | `validar.js:175`, `js/areas/entrenador/ia.js:186` y `:306` |
| S6 | medio | Las tareas de la ficha de la zona van solo por nombre y el validador no las comprueba: estiramiento con r=1 de hombro en B2 y activación de otro lugar | `dia.js:403`, `dia.js:425` |
| S7 | medio | T1: no hay cardio con dos zonas en B2 en casa o en la calle (8 de 450 combinaciones) | `dia.js:271`, catálogo |
| S8 | medio | Palabras de alarma que no se detectan: «falta de aire», «me dolía el pecho», «perdí fuerza», «veía doble»… (C-ALAR-4) | `js/areas/entrenador/alarma.js:60` |
| S9 | medio | El plan deja principales a 1 serie para no pasar del techo semanal (345 de 576 planes) | `js/areas/entrenador/plan.js:215`, `:286` |
| S10 | medio | Embarazo de 16 semanas o más: rehabilitación lumbar boca arriba 2-3 min seguidos (descarga 90/90, dead bug) | `js/areas/entrenador/salud.js:64` |
| S11 | medio | Aquiles o esguince de tobillo a 5/10 en la piscina: patada lateral con aletas (C-PISC-3 y la ficha dicen «sin aletas») | `ejercicios.js:507` |
| S12 | medio | IA por encima del nivel (CR-08): el validador cambia el press de banca con barra por aperturas en máquina, un aislamiento que pasa a ser el «básico» | `validar.js:79` (`alternativa`) |
| S13 | bajo | Flexiones diamante (nivel 3) para un intermedio en casa, sin la nota que exige la excepción de C-DOSIS-10 | `dia.js:543` |
| S14 | bajo | D-B (3 / 4 series): con energía 5 salen 4 series al principiante y 5 al intermedio; la progresión sin kilos lleva al principiante a 4 series | `js/areas/entrenador/checkin.js:139`, `js/reglas/progresion.js:558` |
| S15 | bajo | El prompt del servidor contradice D-B («fuerza… 4-5 × 3-6», «en fuerza, 5») | `api/entrenador.js:70`, `:75` |
| S16 | bajo | Fichas técnicas mejorables: extensión a 45° con «espalda ligeramente redondeada», buenos días con la banda por detrás del cuello y sin r cervical, «Para él.», remo con toalla en el pomo | `ejercicios.js:346`, `:334`, `:434`, `:117` |
| S17 | bajo | La nota del cardio describe otro ejercicio (por ejemplo, la de boxeo de sombra dice «alterna con boxeo de sombra») | `validar.js:296` |
| S18 | bajo | Superserie: 60 s entre parejas, por debajo de C-PAUSA-1 (6-12 corporal debería ir con 120 s) | `validar.js` (`ajustarTiempo`, paso 6) |
| S19 | bajo | Plan de principiante con `sentadilla-goblet` (nivel 2): el relleno de volumen no respeta «de su nivel» (D-B) | `plan.js` (relleno de C-VOL-1) |

---

## S1 · alto · La rehabilitación de una fase que ya no toca se queda (C-DOLOR-1, C-DOSIS-7, C-ZONA-0)

**Qué pasa.** `rehabValida` solo comprueba que el ejercicio tenga **alguna** fase para la zona y que su riesgo no lo impida. No comprueba que esa fase sea ≤ la que permite la banda de hoy (`faseDeBanda`). El día del plan se hace con el dolor de ficha. Si en el check-in el dolor sube a 4-6, se quedan la fase 3 o la fase 2 de la ficha, con su dosis de fuerza (3 × 8-12). La IA puede hacer lo mismo.

**Reproducción.** `h1-fase-rehab.mjs` (por reglas) y `matriz-ia.mjs 3 800` (IA):
- codo crónico, ficha 0, hoy 6 → `remo-maquina 3×8-12` (fase 3, agarre) y `extension-muneca-excentrica 3×15` (fase 2). Sin plan: `prension-pelota` y `extension-muneca-isometrica` (fase 1), que es lo correcto.
- espalda alta (dorsal), ficha 0, hoy 5 → `face-pull` y `remo-maquina` 3 × 8-12 (fase 3).
- hombro, ficha 0, hoy 6 → `face-pull 3×8-12`. Rodilla, ficha 3, hoy 6 → `almeja` y `elevacion-pierna-recta` (fase 2).
- IA: lumbar hoy 6 (hernia por defecto) → `paseo-granjero` como rehabilitación (fase 3, con carga).
- En todos los casos `problemasSesion` devuelve `[]`.

**Por qué importa.** Es el camino más habitual: un día del plan y un check-in con más dolor. Con 6/10, la tabla de C-DOLOR-1 pide isométricos de fase 1 y aquí se hace fuerza progresiva y excéntricos. Se incumple una regla [Objetivo] del criterio.

**Arreglo.** En `rehabValida`, exigir `fases.some(f => f <= faseDeBanda(b))`. En el paso 3 de `validarSesion`, cambiar la rehabilitación que no valga por un candidato de `candidatosRehab` y apuntarlo en «Ajustado por la app». Hay que añadir un caso a la matriz con plan + check-in con dolor más alto, en todas las zonas.

## S2 · alto · Movilidad y estiramientos que no respetan la zona dolorida (C-EST-2, C-DOLOR-4)

**Qué pasa.** Las fichas marcan el uso de cada tarea (`alivio`, `normal` solo para B0-B1, `activacion`), pero ese dato se pierde. `ZONAS[z].estirar` y `ZONAS[z].calentar` se convierten en textos (`lesiones.js:573`). Por eso `vueltaDe` (`dia.js:425`) y `diaDolorAlto` (`dolor-alto.js:78`) nunca ven un `alivio`, y la movilidad de D2 y del calentamiento (`dolor-alto.js:68`, `dia.js:395`) solo filtra por `r`. Hay tareas que mueven justo la zona dolorida y no tienen `r`: `circulos-brazos` y `balanceo-pierna-frontal` tienen `r:{}`. Los estiramientos «libres» (`ESTIRA_LIBRE`, `dia.js:433`) no miran la zona.

**Reproducción.** `h9-uso-normal.mjs`: 110 sesiones con tareas «normal» en B2 o B3. Por ejemplo:
- hombro 8/10 → `circulos-brazos` 3 min;
- tobillo 8/10 → `estiramiento-gemelo-pared`;
- rodilla 8/10 → `movilidad-tobillo-pared` y balanceo de pierna;
- cadera lateral 8/10 → `balanceo-pierna-frontal` (apoyo a una pierna);
- lumbar 8/10 → `rotacion-toracica-cuadrupedia`;
- espalda alta 8/10 → `circulos-brazos` y `dislocaciones-banda`.

Más ejemplos en `h8-d2.mjs`, `h8b.mjs` y `h16-libres.mjs`:
- hombro 5/10 en la piscina → «Estiramiento de hombros en el borde (deja caer el pecho hacia el agua)»;
- hombro 5/10 en la calle → «Estiramiento de pecho de pie»;
- lumbar 5/10 en la calle → «Estiramiento de espalda de pie: redondea la espalda».

En el otro sentido, el `alivio` de la ficha no sale nunca: CR-02 espera `descarga-90-90` en D2 lumbar y no aparece.

**Por qué importa.** El día de dolor alto es el día más delicado. C-DOLOR-4 dice que en la zona dolorida van, como mucho, 2 tareas `alivio`, y la ficha lo tiene escrito, pero no se aplica.

**Arreglo.**
- Conservar `tareas` con `uso` en `ZONAS` y aplicarlo en `vueltaDe`, `calentamientoDe` y `diaDolorAlto`: `normal` solo en B0-B1, `alivio` en B1-B3 y `activacion` en B0-B2.
- Etiquetar el catálogo: `circulos-brazos` → hombro 1 y dorsal 1; `balanceo-pierna-frontal` → cadera_lateral 1, rodilla 1 y tobillo_pie 1; `dislocaciones-banda` → dorsal 1.
- Dar `r` a los estiramientos libres (o pasarlos a ids). El validador debe comprobar las tareas sin id que casen con un ejercicio por nombre, como ya hace con las de la IA.

## S3 · alto · Natación para quien no sabe nadar (C-PISC-2, C-DOSIS-10)

**Qué pasa.** «No sabe nadar 2 × 25 m» solo se tiene en cuenta con `nivel === 1` (`dia.js:261`, `dia.js:528`). El nivel es de fuerza general, no de natación. La ficha de `aquajogging` empieza por «En la parte honda con cinturón de flotación» y la nota del cardio no dice «donde hagas pie».

**Reproducción.** `h12-no-nada.mjs`. Con perfil sin `nadar25`, piscina y 45 min:
- nivel 2 → `espalda 4×25 m | crol-pull-buoy 4×25 m | patada-espalda-tabla | nado-continuo 15 min`; con nivel 3, lo mismo;
- nivel 1 → `aquajogging` 15 min con la nota «Seguido; si paras en el borde, menos de 20 s».

**Por qué importa.** Hay riesgo de ahogamiento: es una sesión imposible de hacer, en una zona sin pie. Además, el prompt de la IA repite la misma condición («"sabeNadar2x25" false y principiante»).

**Arreglo.** Aplicar la regla del que no sabe nadar con cualquier nivel: sin crol, espalda, nado continuo ni series, por tiempo, con tabla y aquajogging. En `api/entrenador.js`, quitar «y principiante». En la ficha y en la nota del cardio para `!nadar25`: «Siempre donde hagas pie, con el agua por el pecho».

## S4 · medio · Sin equilibrio con 60 años o más (C-EDAD-1)

El validador añade `equilibrio-una-pierna` al calentamiento (`validar.js:423`). Después, `ajustarTiempo` rehace el calentamiento (`:484`) y lo pierde. En `h2-equilibrio.mjs` (70 años, con una lesión de tren superior o espalda), 27 de 432 sesiones salen sin él, por ejemplo gimnasio, 30 min, lumbar 2/10. En la matriz general salieron 57 de 2000, y en la de IA, 50 de 800. **Arreglo:** poner el equilibrio después del paso 8, o volver a añadirlo tras el ajuste de tiempo.

## S5 · medio · El validador suspende su propia corrección (C-TIEMPO-2 frente a C-DOLOR-3)

`ajustarTiempo`, en el paso 4, quita la rehabilitación de las zonas B0-B1 (lo permite C-TIEMPO-2), pero `problemasSesion` exige rehabilitación en toda zona activa (`validar.js:175`). Así, `valida` sale en `false`. En `h3-valida-tiempo.mjs` (hombro 2/10, 30 min, IA correcta), la sesión de la IA se descarta: «La sesión de la IA no cumplía las reglas de seguridad: sesión ajustada por la app». Se paga una llamada a la IA, se tira, y el mensaje asusta sin motivo. En los planes, el día de la IA se rehace (`ia.js:306`). **Arreglo:** que `problemasSesion` exija la rehabilitación solo en B2, o cuando no se haya aplicado el paso 4 de C-TIEMPO-2.

## S6 · medio · Tareas de la ficha sin id: el validador no las ve (C-EST-4)

La activación (`dia.js:403`) y el estiramiento de la zona (`dia.js:425`) se añaden solo con el nombre. En `h4-tareas-sin-id.mjs`:
- hombro 1/10 en el plan y 6/10 hoy → la vuelta lleva «Estiramiento de pectoral en pared o borde», que tiene r hombro=1 (no vale en B2), y `problemasSesion` no dice nada;
- en la calle, «Cuádriceps isométrico sentado» (no es de calle) y «Dead bug», tumbado.

**Arreglo:** guardar el `id` en esas tareas para que `tareaOk` las compruebe.

## S7 · medio · T1: sesiones sin cardio (C-PRIN-4, D3)

En `h6-sin-cardio.mjs`, 8 de 450 combinaciones no tienen cardio: en casa o en la calle, cadera o tobillo en B2 junto con hombro o codo en B2. La app lo dice («hoy no hay ningún cardio posible…»), pero T1 pide el 100 %. **Arreglo:** añadir al catálogo un cardio sin riesgo para piernas ni brazos, por ejemplo «pedaleo sentado sin brazos» o marcha sentada, o aplicar la excepción de D2 (movilidad y respiración), dicha en la explicación y aprobada por Víctor.

## S8 · medio · Alarmas no detectadas en textos libres (C-ALAR-4)

`h13-alarma.mjs`. No avisan, entre otras: «noté falta de aire en la cinta», «me costaba respirar», «me dolía el pecho», «tenía el pecho oprimido», «perdí fuerza en la pierna», «me quedé sin fuerza en el brazo», «veía doble», «tengo la pierna dormida», «el corazón me iba a mil», «estoy con gripe», «el gemelo hinchado y caliente», «me duele la cabeza muchísimo de golpe». Las expresiones salen tal cual de la lista del criterio, pero esa lista olvida justo «falta de aire» y «pérdida de fuerza», que son A1, A2 y A4 y el propio texto T1. Es una segunda barrera, porque la casilla siempre está visible, pero falla con las frases más comunes. **Arreglo (para que Víctor lo apruebe):** añadir `falta de aire|costaba respirar|ahog`, `(dolia|duele|dolor|oprimid).{0,15}pecho`, `perd\w* (la )?fuerza|sin fuerza en`, `dormid[ao]`, `veia doble`, `taquicard|corazon .{0,10}a mil`, `gripe|gastroenteritis`, `(gemelo|pantorrilla).{0,20}(hinchad|calient|roj)`, `dolor de cabeza .{0,15}(fuerte|subito|de golpe)` y `cabeza .{0,15}(muchisimo|de golpe)`.

## S9 · medio · Principales a 1 serie en el plan (C-DOSIS-2, C-DOSIS-3, C-DOSIS-5)

`h15-una-serie.mjs`: 345 de 576 planes de reglas tienen principales a 1 serie. Por ejemplo, principiante con objetivo músculo, en casa, 4 días y 75 min: «elevaciones-laterales 1×12-15, extension-triceps-banda 1×10-15…». Pasa porque el recorte del techo semanal deja `minSeries = 1` en los no compuestos (`plan.js:215`, `:286`). La dosis del criterio es de 2-3 series, y C-TIEMPO-2 dice «mínimo 2». **Arreglo:** al recortar, mínimo 2 series; si así no se respeta el techo, quitar el ejercicio entero (ya existe ese camino).

## S10 · medio · Embarazo y boca arriba (C-SALUD-0)

`h17-salud.mjs`, con 24 semanas y visto bueno:
- lumbar 3/10 → `descarga-90-90 1×2-3 min`;
- lumbar 5/10 → `dead-bug 3×8 c/lado`;
- siempre, «Respiración: Tumbado» 2 min.

El criterio dice que desde la semana 16 no se está boca arriba más de 2 min seguidos. **Arreglo:** con `embarazo ≥ 16`, excluir de la rehabilitación y de las tareas los ejercicios boca arriba de más de 2 min. Por ejemplo: descarga 90/90 sentada o de lado, dead bug a una serie o `pallof-press`, y la respiración sentada.

## S11 · medio · Aletas con el tobillo dolorido (C-PISC-3, C-CARDIO-6)

`h19-aletas.mjs`: 54 de 378 sesiones de piscina con el tobillo a 5/10 (Aquiles, esguince o fascitis) llevan `patada-lateral` (material `aletas`, r sin tobillo). **Arreglo:** poner `tobillo_pie: 1` en `patada-lateral` (`ejercicios.js:507`) o excluir las aletas cuando el tobillo está activo.

## S12 · medio · La alternativa por nivel cambia un básico por un aislamiento (C-DOSIS-10, CR-08)

En `h7-nivel-ia.mjs` (principiante con objetivo fuerza, la IA propone `press-banca-barra` y `peso-muerto-rumano`), queda «aperturas-maquina, curl-femoral-sentado, extension-cuadriceps, jalon-pecho». Así, el «primer compuesto 3 × 6-8 con 150 s» de CR-08 desaparece. `alternativa()` (`validar.js:79`) no puntúa el `tipo` (el de `catalogo.js` sí, con `puntosTipo`) y el empate se resuelve por orden alfabético: aperturas va antes que press. **Arreglo:** sumar los puntos por mismo `tipo`, como en `catalogo.alternativas`.

## S13 · bajo · Excepción de nivel sin explicar (C-DOSIS-10)

Con `h5-nivel.mjs` y `h5b.mjs`, un intermedio en casa o en la calle, 90 min, recibe `flexiones-diamante` (nivel 3, r muñeca 2) en el hueco de tríceps porque no hay otro tríceps de su nivel. El criterio permite la excepción, pero «la nota lo explica», y la nota no lo hace. H-7 dice «flexiones diamante solo con nivel 3». **Arreglo:** dejar vacío un hueco secundario si solo queda nivel + 1, o añadir la nota.

## S14 · bajo · Tope de series de D-B

`h10-progresion.mjs`:
- con energía 5, principiante 4 × 8-12 e intermedio o avanzado de fuerza 5 × 4-6 (`checkin.js:139`, `p.series < 5`);
- en un principiante, «dos sesiones al tope» pasa a 4 series (`progresion.js:558`, `hechas < 4`).

D-B (21-11-2026) dice 3 y 4 series «en el plan y en las reglas». **Arreglo:** usar `topeSeriesMia` (o uno común) en los dos sitios.

## S15 · bajo · El prompt del servidor contra D-B

`api/entrenador.js:70` dice «fuerza … 4-5 × 3-6» y `:75` dice «Como mucho 6 series… en fuerza, 5». D-B lo deja en 3 (principiante) y 4 (resto). El validador solo corta en 6, así que la IA puede poner 5-6 series. Por lo demás, el prompt cumple el criterio: T7, bandas, fases, techo, cardio D3, intervalos, piscina, salud y C-PROG-5. También repite la condición de S3.

## S16 · bajo · Fichas técnicas (catálogo)

He revisado las 186 fichas (`fichas.mjs` genera `fichas.txt`). No he visto nada peligroso en sí mismo. Para mejorar:
- `hiperextension-45` (`:346`, rehabilitación lumbar de fase 3): «con la espalda neutra **o ligeramente redondeada**». Con hernia, que es el detalle por defecto, la flexión con carga es r=2. Mejor «espalda neutra; el movimiento sale de la cadera».
- `buenos-dias` (`:334`): «banda pasada **por detrás del cuello**» sin `r` cervical. La ficha cervical evita «cargas detrás de la nuca».
- `carrera-suave` (`:434`): `c: 'Para él. …'` es un texto sobrante.
- `remo-toalla` (`:117`): con todo el peso tirando del pomo, si el pomo cede, caída hacia atrás. Mejor un nudo en la toalla cogido en la puerta cerrada por el lado de las bisagras.
- Lo tumbado en la calle (dead bug, puente de glúteo, superman, curl femoral con banda) tiene `calle` en `l`. C-EST-4 pide «nada tumbado» en las tareas; para los ejercicios conviene decidirlo. Sale en la matriz unas 100 veces.
- La ficha de `aquajogging` va en S3.

## S17 · bajo · Nota del cardio de otro ejercicio

En el paso 4 de `validarSesion`, la nota se toma de `cardioDelDia(S, ctx, 0)` (`validar.js:296`), que puede ser otro ejercicio. En `h18-nota-cardio.mjs`, 29 de 378 casos, como «boxeo-sombra → … alterna con boxeo de sombra». Con una lesión, la condición de la ficha (por ejemplo «sillín alto») puede quedar en una máquina que no es.

## S18 · bajo · Descanso de la superserie

En el último recurso (paso 6), el segundo de la pareja lleva 60 s. Con 6-12 a peso corporal o 6-10 con carga, C-PAUSA-1 pide 90-120 s. El ejemplo de C-TIEMPO-4 usa 60 s, así que el propio criterio es incoherente. Habría que decidir uno de los dos.

## S19 · bajo · Relleno de volumen de otro nivel

En `h14b.mjs`, el plan de un principiante con objetivo músculo, en casa con mancuernas y 4 días, incluye `sentadilla-goblet` (nivel 2) con `sentadilla-peso-corporal` en el mismo día. D-B dice «añade otro ejercicio del mismo músculo (de su nivel…)».

---

## Criterios T de este enfoque

| T | Veredicto | Prueba |
|---|---|---|
| **T1** calentamiento, cardio y estiramientos | **No cumple** (por poco) | Calentamiento ≥ 2 tareas y vuelta con estiramiento en el 100 % de 2000 + 800 + 888 sesiones (`matriz.mjs`, `matriz-ia.mjs`, `h11-mias.mjs`). Cardio: 8 de 450 combinaciones de dos zonas en casa o en la calle no tienen ninguno (S7). La matriz de 336 de las pruebas sigue en verde. |
| **T2** dolor ≥ 7 sin carga ni fortalecimiento de la zona | **Cumple** en lo que mide; **no** en la movilidad | 0 principales, 0 rehabilitaciones y 0 ejercicios con r en zona activa en D2, en todas las zonas, lugares y minutos; minutos = pedidos ± 2 (`matriz.mjs`, `h8-d2.mjs`). Pero la movilidad y los estiramientos de la zona a 8/10 incumplen C-DOLOR-4 y C-EST-2 (S2). |
| **T3** nada rechazado, contraindicado, de otro lugar o sin material | **No cumple** | Ejercicios con id: 0 fallos de lugar, material, rechazo o r. Pero se cuela rehabilitación de una fase que no toca con el dolor de hoy (S1), hay tareas sin id que el validador no ve (S6), aletas con el tobillo dolorido (S11) y natación para quien no sabe nadar (S3). |
| **T6** la progresión sube cuando toca | **Cumple** | `node --test tests/criterio-progresion.test.mjs tests/progresion.test.mjs …`: 172 de 172. Con `h10-progresion.mjs`: parón de 16, 30, 60 y 100 días → −10 %, −20 %, −35 % y «como sin historial», con las series bajadas; C-DOLOR-7 −30 %; lesión nueva y dolor ≥ 4 frenan; B0-B1 estable sube una semana sí y otra no. Solo choca con D-B en el número de series (S14). |

Mis sesiones (C-MIA-1, C-MIA-2): **cumple**. En `h11-mias.mjs` (888 sesiones), la sesión guardada se respeta, lleva nota de técnica en lo de nivel superior, cambia lo que choca con el dolor y en D2 manda la sesión suave. Solo aparece lo tumbado en la calle (S16).
