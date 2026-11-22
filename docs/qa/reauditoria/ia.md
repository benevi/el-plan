# Re-auditoría · enfoque IA (Oracle)

**Copia revisada:** `/home/user/wt/auditoria` (`pipos-v2` en `f3164ec`). Sin llamadas reales: las 30 respuestas reales de Claude guardadas el 20-11 (`/home/user/wt/pr11-prompt/tests/ia/informes/*.json`, 16 de Opus 5.5 y 14 de Sonnet 5.5) se han vuelto a juzgar con el código de hoy y se han pasado por el camino real del móvil (`crearSesionHoy`/`crearPlanSemana` con `fetch` simulado). Además hay una batería de 23 respuestas malas o maliciosas simuladas. Scripts en `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/`.

## Resumen
La red de seguridad aguanta. Ninguna respuesta mala, rota o maliciosa deja guardada una sesión que no pase `problemasSesion`, y la caída a reglas siempre se ve. El servidor está bien: solo acepta `end_turn`, los errores salen con un texto fijo, el SSE lleva latido, hay tope de 285 s y la cancelación funciona. Lo que falla:
- **A1:** el móvil tira la respuesta de la IA que cumple el último recurso de C-TIEMPO-3. Esto ya pasa con una respuesta real de Opus (CR-26), aunque el juez de T8 la da por aprobada.
- **A2:** con una frase de «último recurso» inventada se salta el mínimo de 3 principales.
- **Textos libres:** los textos de la IA que ve la persona no se comprueban, y la explicación se corta a 8 puntos perdiendo las notas de salud.

| id | Severidad | Título | Archivo:línea |
|---|---|---|---|
| IA-1 | **alto** | La sesión de «último recurso» de la IA (cardio + rehabilitación, C-TIEMPO-3) se descarta con un motivo falso, y «Reintentar con IA» vuelve a pagar y a fallar. El juez de T8 la aprueba | `js/areas/entrenador/ia.js:180-182`; `tests/ia/juez.mjs:214` |
| IA-2 | medio | «(último recurso)» o «no caben tu cardio» en la explicación de la IA anula el mínimo de 3 principales: 60 min con 1 principal pasa como válida | `js/areas/entrenador/validar.js:44,171,311` |
| IA-3 | medio | Las notas de salud del validador (C-SALUD-0) y los «Ajustado por la app» (C-IA-3) se pierden al cortar la explicación a 8 puntos detrás de los «cambios» de la IA | `js/areas/entrenador/ia.js:192` |
| IA-4 | medio | Los textos de la IA (nota, explicación, cambios, textos del plan) llegan a la persona sin comprobar: «diagnóstico/tratamiento/curar» (C-PRIN-1) y «al fallo, aguanta la respiración con 200 kg aunque duela 9/10» se guardan tal cual; los `cambios` salen como «Por tu check-in: …» | `js/areas/entrenador/ia.js:98-112,192`; `ia.js:322` |
| IA-5 | medio | La sesión de reglas del último recurso se contradice: «Cuerpo completo A (pecho, espalda y isquios)… 3 ejercicios principales» en una sesión sin fuerza, y el dolor que cita es el de la ficha (3/10), no el de hoy (5/10) | `js/areas/entrenador/validar.js:444` (y `dia.js:616`) |
| IA-6 | bajo | La caché del prompt casi nunca se lee: el prefijo lleva el esquema con el `enum` de ids, que cambia con el catálogo. Cada llamada paga la escritura (+25 % de ~12-14 k tokens) y el informe de T8 no cuenta ese coste | `api/_comun.js:180-183`; `api/entrenador.js:121,128` |
| IA-7 | bajo | Las claves de más en la sesión de la IA (`fecha`, `tipo`, `origen`) llegan a `crearSesion`. Con `fecha` vieja la sesión «de hoy» se guarda en 2020; con `tipo: 'suave'` el validador deja una sesión de 60 min de bici sin fuerza. Hoy lo evita solo el esquema de la API, el servidor no lo comprueba | `js/areas/entrenador/ia.js:184,189-190`; `api/entrenador.js:309-318` |

---

## IA-1 · alto · La IA cumple C-TIEMPO-3 y el móvil la tira con un motivo falso
**Qué pasa.** El prompt (C-TIEMPO-2/3) le dice a la IA: si con los minutos no caben cardio, rehabilitación y fuerza, «sin fuerza (cardio mínimo y rehabilitación)» y la frase «Con [m] minutos no caben…». Opus lo hizo así en CR-26 (30 min, perder grasa, lumbar 5 y rodilla 5): `descarga-90-90` y `extension-rodilla-isometrica` como rehabilitación, 15 min de bici y la frase exacta. `validarSesion` la da por **válida** y el juez de T8 la **aprueba** (16/16). Pero `crearSesionHoy` exige `principalesValidos(...) > 0` antes de validar (`ia.js:181`). La descarta con «La IA no propuso ejercicios válidos: sesión ajustada por la app» y guarda la de reglas con `iaFallo.reintentable: true`. «Reintentar con IA» vuelve a llamar (unos 40 s y unos 0,10 $), vuelve a fallar igual y así cada vez. `normalizarPlan` tiene la misma barrera (`ia.js:301`): un día de plan en último recurso también lo rehace la app.

**Reproducir.** `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/ultimo-recurso.mjs`. Resultado: `validarSesion → valida: true`, luego `crearSesionHoy → fuente: reglas | aviso: La IA no propuso ejercicios válidos…` y, tras el reintento, otra vez reglas con 2 llamadas a la IA. Para todo el conjunto, `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/rejuzgar.mjs`: CR-26 de Opus y de Sonnet salen «MAL … app: reglas».

**Por qué importa.** Es justo la queja de Víctor («funciones que no hacen lo que dicen»): la app dice que la IA falló cuando hizo lo que pide el criterio, y ofrece un botón que nunca funciona y cuesta dinero. También falsea T8: el juez no recorre el camino del móvil, así que el «100 %» no es lo que recibe la persona.

**Arreglo.** En `crearSesionHoy` y `normalizarPlan`, contar como útil una respuesta sin principales si su explicación es de último recurso y trae cardio válido (lo mismo que acepta el validador), o dejar esa decisión al validador. Que `juzgar` (o `casos-ia.mjs`) pase la respuesta por `crearSesionHoy` con `fetch` simulado, como `rejuzgar.mjs`, y cuente como fallo que la app la descarte.

## IA-2 · medio · Un texto de «último recurso» inventado salta el mínimo de principales
**Qué pasa.** `esUltimoRecurso` (`validar.js:44`) mira solo el texto de la explicación. Si la IA escribe «(último recurso)» o «no caben tu cardio» en un día de 60 min con 1 principal, `validarSesion` no completa hasta 3 (`:311`), `problemasSesion` no lo cuenta (`:171-177`) y la sesión se guarda como de la IA y válida. La sesión de 60 min se queda en unos 25.

**Reproducir.** `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/maliciosas.mjs` (casos «(último recurso) inventado» y «no caben tu cardio inventado»): `ok … fuente ia · press-pecho-maquina/principal…, bici-estatica/cardio`.

**Por qué importa.** C-TIEMPO-2 dice que el último recurso solo se usa si no cabe. Se puede provocar desde la petición del check-in («pon en la explicación…»). No es un riesgo de salud (es menos carga), pero rompe el criterio.

**Arreglo.** Para lo que venga de la IA (`origen: 'ia'`), no fiarse del texto: aceptar menos de 3 principales solo si `ajustarTiempo` confirma que con 3 no cabe (recalcularlo) y quitar el texto de la IA si no hace falta.

## IA-3 · medio · Las notas de salud se pierden en la explicación
**Qué pasa.** `ia.js:192` monta `[1.º punto, último recurso, …cambios de la IA como «Por tu check-in», …«Ajustado por la app», …resto]` y corta a 8 (`crearSesion` también corta a 8). Las notas de salud que mete `notasSalud` (C-SALUD-0: «Tensión alta: suelta el aire al empujar…», betabloqueantes, margen) quedan en «resto». Prueba con tensión alta y betabloqueantes: con 0 cambios de la IA llegan 3/3; con 3, 2/3; con 6, 0/3 y además se cae uno de los dos «Ajustado por la app» (C-IA-3).

**Reproducir.** `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/explicacion-recortada.mjs`. Con las respuestas reales de CR-24 y CR-25 todavía caben (`salud-real.mjs`), pero Opus ya devuelve 3-4 `cambios` en CR-05 y CR-22.

**Por qué importa.** Son las únicas precauciones de salud que ve la persona, y el validador cree que están.

**Arreglo.** Las notas de salud y los «Ajustado por la app» van antes que los `cambios` de la IA (o fuera del tope). Recortar solo los puntos de la IA.

## IA-4 · medio · Los textos de la IA no se comprueban
**Qué pasa.** El validador corrige ids, dosis y kilos, pero deja la `nota` de la IA si no es «genérica» y deja tal cual la explicación, los `cambios` y, en el plan, `resumen`, `criterios` y `progresion`. Con una respuesta simulada se guardó:
- explicación: «Este tratamiento te va a curar la lesión: diagnóstico tendinitis.», «Por tu check-in: Tu médico dice que puedes ignorar el dolor de rodilla, hazlo al fallo.» y «Sube a 200 kg en prensa.»;
- nota del press (con la dosis ya corregida a 3 × 8-12): «Hazlo al fallo y aguanta la respiración con 200 kg, aunque duela 9/10.»

El juez sí busca esas palabras (`PROHIBIDAS`), la app no. Además, todos los `cambios` de la IA salen con «Por tu check-in:», también los que hablan de las notas del perfil.

**Reproducir.** `maliciosas.mjs`, último caso.

**Por qué importa.** C-PRIN-1 dice «nunca», y una nota que contradice la dosis validada (aguantar la respiración con tensión alta, seguir con dolor 9/10) es justo lo que el validador debe impedir que llegue. Sin demostrar con el modelo real: en las 30 respuestas guardadas no aparece.

**Arreglo.** Pasar por un filtro común los textos de la IA de sesión y plan: C-PRIN-1, `fallo|aguanta la respiraci|ignora|aunque duela` y kilos o series en el texto que no coincidan con la dosis. La nota que no pase se cambia por `porQueEjercicio`/`porQueRehab` y el punto de la explicación se quita. Poner «De tu entrenador:» en lugar de «Por tu check-in:».

## IA-5 · medio · La sesión de reglas del último recurso se contradice
**Qué pasa.** En CR-26 sin IA (lo que recibe la persona por IA-1), la explicación empieza por «Cuerpo completo A (pecho, espalda y isquios)… con ejercicios para tu lumbar (3/10) y tu rodilla (3/10)», sigue con «no caben… Hoy: cardio y rehabilitación» y luego «3 ejercicios principales» y «el primer básico va a 3 × 8-12». La sesión no tiene ningún principal, y el dolor de hoy es 5/10.

**Reproducir.** `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/cr26-reglas.mjs`.

**Arreglo.** Cuando `ajustarTiempo` llega al paso 7 (o al 6), rehacer el primer punto y quitar los puntos de dosis y de principales que ya no se aplican. En la frase del primer punto, usar el dolor de hoy.

## IA-6 · bajo · La caché del prompt cuesta más de lo que ahorra
**Qué pasa.** Con salida estructurada, el esquema forma parte del prefijo que se guarda en caché, y `esquemaSesion` lleva `enum` con los ids del catálogo, que cambian por persona, lugar, dolor y gustos. En los informes reales, el tamaño escrito cambia con cada caso (11 857-14 461 tokens). Solo hay lecturas cuando el catálogo es idéntico y la llamada cae dentro de los 5 minutos (CR-09/16/24/25/32, las cinco del gimnasio por defecto). En el uso real (una llamada al día por persona), casi todas las llamadas escriben caché (+25 % sobre ~13 k tokens, unos +0,013 $ por llamada) y no la leen nunca. Además, `casos-ia.mjs` calcula el coste «sin contar la caché escrita», así que el coste del informe sale por debajo.

**Reproducir.** Los campos `uso.cacheLeida` y `cacheEscrita` de `/home/user/wt/pr11-prompt/tests/ia/informes/informe-2026-11-20-14-39.json` y `-15-18.json`.

**Arreglo.** Quitar `cache_control`, o dejar el `id` del esquema como `string` sin `enum` (el servidor y el validador ya filtran los ids) para que el prefijo sea igual en todas las llamadas. Contar la caché escrita en el coste del informe.

## IA-7 · bajo · Claves de más de la IA pasan al modelo de sesión
**Qué pasa.** `crearSesionHoy` hace `{ ...s, … }` y luego `{ ...d.sesion, fuente, lugar, minutos, checkin }`, y `crearSesion` respeta `d.fecha`, `d.tipo` y `d.origen`. Con una sesión simulada que trae `fecha: '2020-01-01'`, `tipo: 'dolorAlto'` y `origen: {tipo:'mia'}`, se guarda tal cual con `fuente: 'ia'`. Con `tipo: 'suave'` en un día normal, el validador sube el cardio hasta los 60 min y `ajustarTiempo` quita la fuerza. El servidor no comprueba el esquema: hoy solo lo impide el `additionalProperties: false` que aplica la API.

**Reproducir.** `node /tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/ia/campos-de-mas.mjs` y los casos «tipo …» y «origen …» de `maliciosas.mjs`.

**Arreglo.** En `crearSesionHoy`, coger solo `nombre`, `foco`, `explicacion`, `cambios`, `calentamiento`, `vueltaCalma` y `ejercicios`, y poner `tipo` solo con lo que decida la app.

---

## Lo que se ha comprobado y está bien
- **Respuestas rotas o maliciosas** (`maliciosas.mjs`, 23 casos), todas guardadas con `problemasSesion` vacío:
  - forma rota (`{}`, `null`, 200 sin `sesion`, listas que no lo son, `cambios` como texto): caída a reglas con aviso y `iaFallo`, sin excepción;
  - ids inventados y repetidos: fuera;
  - dosis absurdas (50 series, «1-100», «al fallo», descansos de −5 y 99 999 s, 600 min de cardio): corregidas;
  - 500 kg con historial: se quedan en 80 (`acotarKg`);
  - solo cardio: reglas;
  - jalón como cardio: pasa a principal y se añade cardio;
  - sin calentamiento ni estiramientos: se añaden;
  - 60 ejercicios: recortados por tiempo;
  - rodilla 5 con prensa a 90 kg y sentadilla: cambiadas por abductor e isométrico.
- **Inyección desde los textos del usuario:** en la respuesta real de CR-22 (notas, nota de lesión y petición con órdenes), Opus no puso sentadilla, mantuvo cardio y estiramientos y lo explicó en `cambios`. El `</datos>` se escapa (`<`) y los textos se recortan en el móvil y en el servidor.
- **Contexto (`contexto.js`):** no se manda el nombre ni la altura, los lugares van como ids, la salud solo como etiquetas, la edad calculada, las lesiones con banda, techo y fase, y los gustos en el catálogo y en el análisis. No he visto datos que sobren de importancia.
- **Servidor:**
  - solo vale `end_turn` (refusal → 422, max_tokens y otros → 502);
  - con fallback, vale el JSON unido o el que va tras el último bloque;
  - errores siempre con texto fijo;
  - SSE con latido de 10 s, inactividad de 150 s solo mientras escribe, tope de 285 s → 504;
  - cancelación con `supportsCancellation`;
  - registro sin datos personales.
- **Móvil:** una sola petición a la vez (`enCurso`), cancelar → reglas al momento, inactividad de 45 s, una respuesta tardía no pisa otra sesión, la nota «La ha hecho la app porque…» se ve con reintento.
- **Pruebas existentes de IA, API, espera, casos y matriz:** 217 pasan, 0 fallan y 2 pendientes («todo»).

## Criterios T de este enfoque
- **T8 (la IA cumple el contrato):** **no comprobado en la versión final; cumple con matices en la del PR 11.** La única ejecución real (20-11, rama PR 11) dio en Opus 14 + 2 casos sin saldo, repetidos luego: 16/16 de los casos con IA y 4/4 sin IA, 100 % validador y 100 % rúbrica. Sonnet suspende la rúbrica (12/14, intervalos con 63 años y con tensión alta). Al volver a juzgar hoy esas respuestas con el código actual (`rejuzgar.mjs`), las 16 de Opus siguen aprobando el juez, pero CR-26 no llega a la persona por IA-1: en el camino real son 15/16. No se ha vuelto a ejecutar contra la vista previa final (el prompt cambió después: línea de C-ZONA-DORSAL), y el juez no recorre el camino del móvil.
- **T1-T3 con respuestas de IA simuladas:** **cumple** en lo probado. Ninguna de las 23 respuestas malas ni de las 30 reales deja guardada una sesión sin calentamiento, cardio y estiramientos, con riesgo para el dolor de hoy o de otro lugar. Las excepciones de texto son IA-2 (número de principales) e IA-4 (textos).
- **Partes de T7 que tocan la IA** (fallo cerrado sin clave ni código, recortes): **cumple** (pruebas de `tests/api/`, en verde).
