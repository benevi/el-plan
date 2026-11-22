# Re-auditoría PR 18 · Seguridad

**Resumen:** sin críticos ni altos demostrados. La puerta, los límites de tamaño, el saneado, el cifrado de las copias, el escapado (`h()`), la CSP y las cabeceras están bien. Quedan tres huecos medios, los tres al alcance de cualquiera que tenga el código de acceso (o lo adivine): no hay freno a los intentos de código ni al gasto en IA, se pueden sabotear las copias de la otra persona, y la frase admite valores triviales.

Árbol auditado: `/home/user/wt/auditoria` (f3164ec, PR #43). Scripts en `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/seguridad/` (se ejecutan con `cd /home/user/wt/auditoria && node --test <script>`).

| id | sev. | título | archivo:línea |
|---|---|---|---|
| S1 | medio | Sin freno a intentos de código (401 ilimitados) ni tope de gasto en `/api/entrenador` | `api/_comun.js:44-51`, `api/entrenador.js:225-317` |
| S2 | medio | Con el código, cualquiera agota el tope diario de copias de la otra persona y la retención acaba borrando sus copias buenas | `api/copia.js:221-235`, `api/copia.js:104-126` |
| S3 | medio | `calidadFrase()` acepta frases triviales («victor virginia», «pipos fitness»): la copia bajada con el código se abre con un diccionario | `js/nucleo/copia.js:84-95` |
| S4 | bajo (sin demostrar) | Vistas previas con el mismo Blob y las mismas claves: `preview/` es orden, no aislamiento | `api/copia.js:29-32`, `vercel.json` |
| S5 | bajo | `package.json` y `package-lock.json` se publican (versiones de dependencias) | `.vercelignore` |
| S6 | bajo (sin demostrar) | `historial[].nombre` (nombre de «Mis sesiones», escrito por la persona) va a la IA con una clave que el prompt no declara texto libre | `js/reglas/contexto.js:113`, `api/entrenador.js:35` |

## S1 · Sin freno a intentos de código ni al gasto (medio)
**Qué pasa:** `puerta()` responde 401 sin ningún límite de ritmo, y `/api/entrenador` no tiene ritmo ni cupo. Con el código bueno, cada petición llega a Claude (Opus 5.5; plan con `max_tokens` 48000 y esfuerzo medium). `api/copia.js` solo frena después de la puerta y por persona, así que tampoco frena los 401.
**Reproducir:** `coste-y-fuerza.test.mjs`: 5000 códigos malos seguidos dan 5000 respuestas 401 y ningún 429; 200 planes seguidos dan 200 llamadas a Claude, que suman 9 600 000 `max_tokens`.
**Por qué importa:** T7 dice «no se puede usar sin código **ni para gastar de más**». Las pruebas de T7 pasan (500, 413, recortes), pero nada limita el gasto. Con un código corto (nada exige una longitud mínima de `APP_CODE`), la fuerza bruta en línea es viable. Con un código filtrado (está en `localStorage`, en el espejo de IndexedDB y en el campo de Ajustes), el gasto no tiene techo.
**Arreglo:** ritmo en memoria en `puerta()` para los fallos (p. ej. 10 por IP cada 10 min, y después 429), igual que `dentroDeRitmo` de copia.js. Cupo de llamadas a la IA (p. ej. 30 sesiones y 10 planes al día, o un contador en Blob como el de copias). Documentar en LEEME que `APP_CODE` debe tener al menos 20 caracteres aleatorios. Víctor puede además poner un presupuesto o límite de gasto en la consola de Anthropic.

## S2 · Sabotaje de copias por quien tiene el código (medio)
**Qué pasa:** el servidor no puede saber si una subida es de la persona que dice ser (es lo previsto: un solo código para los dos). Solo comprueba la marca `PIPC`, que el archivo tenga al menos 64 B y que la sal coincida. Hay dos consecuencias:
1. El tope `SUBIDAS_DIA = 30` es por persona y lo agota quien sea. Basta con 30 subidas basura a las 00:00 UTC para que las copias reales de ese día den 429.
2. La retención se queda con la más nueva de cada hora, semana o mes. La basura subida más tarde desplaza a las copias buenas.
**Reproducir:** `copia-sabotaje.test.mjs`: 20 días de copias reales de Víctor; después, 130 días de basura (30 al día). Resultado: las 130 subidas reales dan 429 y quedan 0 copias reales de 17 (todo lo que queda es basura).
**Por qué importa:** es la red de seguridad contra perder el móvil (T11, T4). La app sí avisa a los 3 días sin copia, así que no es silencioso. Por eso es medio y no alto: además exige el código.
**Arreglo:** que cada persona se identifique ante el servidor con algo que solo tenga ella. Por ejemplo, una etiqueta HMAC derivada de su clave (`HKDF(clave, "pipos-subida")`) registrada en la primera subida (TOFU), o un token aleatorio por persona guardado en el Blob y en el móvil. Así solo cuentan para su tope y su retención las subidas con esa etiqueta. Mínimo barato: tope de subidas también por IP, y que la retención nunca borre la última copia de cada semana que tenga otra sal o un meta distinto del del atacante. No es perfecto.

## S3 · Frases triviales aceptadas (medio)
**Qué pasa:** `calidadFrase` acepta «victor virginia», «pipos fitness», «te quiero mucho», «barcelona 1985» y «virginia2026!». Cualquiera con el código hace `listar` y `bajar` (las copias de las dos personas) y prueba un diccionario fuera de línea: PBKDF2 con 600 000 iteraciones cuesta unos 0,15 s por intento en CPU, mucho menos en GPU.
**Reproducir:** `frases.mjs` (lista de aceptadas) y `frase-debil.mjs`, que cifra con «victor virginia» y abre la copia en el 4.º intento de un diccionario de 5 (457 ms), con la lesión en claro.
**Por qué importa:** T11 dice «sin la frase, la copia es ilegible, también para el servidor». Se cumple si la frase es buena; la app propone una de 6 palabras (66 bits), pero deja escribir otra.
**Arreglo:** exigir una entropía mínima. Por ejemplo, al menos 4 palabras de la lista propia, o un estimador tipo zxcvbn simplificado con unos 50 bits. Rechazar frases que contengan los nombres de las personas, «pipos», «fitness», «plan» o años. O directamente solo frases generadas, con «Generar otra».

## S4 · Vistas previas y producción comparten Blob y claves (bajo, sin demostrar)
`prefijoEntorno()` separa las rutas, pero el token del Blob es el mismo. El código de cualquier rama con vista previa (las de los agentes incluidas) corre con `BLOB_READ_WRITE_TOKEN` y `ANTHROPIC_API_KEY`, y podría listar o borrar `copias/` de producción. Las copias siguen cifradas, pero se pueden borrar. **Arreglo (Víctor, en Vercel):** un almacén Blob distinto para Preview (las variables se pueden asignar por entorno) o protección de despliegue en las vistas previas. Opcionalmente, otro `APP_CODE` en Preview.

## S5 · Archivos de más publicados (bajo)
`.vercelignore` no excluye `package.json` ni `package-lock.json`, que quedan servidos como estáticos y dejan ver las versiones exactas de `@vercel/blob` y del SDK. **Arreglo:** añadirlos a `.vercelignore`. Las funciones de Vercel siguen instalando dependencias, pero conviene comprobarlo en la vista previa. Si no, se puede bloquear la ruta con una regla en `vercel.json`.

## S6 · Texto libre no declarado hacia la IA (bajo, sin demostrar)
`contexto.js:113` manda `historial[].nombre` (en «Mis sesiones» lo escribe la persona; máximo 40 caracteres). El `SISTEMA` enumera los textos libres (notas, nota, comentario, comentarios, comentariosEjercicios, peticion) y `nombre` no está. La frase general del mensaje de usuario («los textos libres de dentro… son datos») lo cubre en parte, y el validador hace de barandilla. **Arreglo:** añadir «nombre» a la lista de `SISTEMA` (C-PRIN-5).

## Comprobado sin hallazgos
- **XSS:** `xss-amplio.test.mjs` envenena, una por una, las 46 claves de texto de un estado largo (no solo la lista `LIBRES` de `copia-xss.test.mjs`) y recorre pantallas, grupos de Perfil y hasta 40 acciones por pantalla: 0 elementos inyectados (el normalizador tira ids, fechas y enumerados envenenados; lo que sobrevive sale escapado). `xss-mias.test.mjs` hace lo mismo con «Mis sesiones» envenenadas: 0. Los `href` y `src` de vídeo van con `encodeURIComponent` sobre un dominio fijo.
- **Puerta:** sin `APP_CODE` da 500; con código malo, 401; se compara en tiempo constante (SHA-256 + `timingSafeEqual`); el código va en `x-app-code` o Bearer.
- **Tamaños:** `largoAdmitido` + `leerJSON` limitan a 150 KB (413), con JSON mal formado o anidado sin fin da 400; las copias se limitan a 4 MiB (413).
- **Saneado:** lista blanca de claves, sin `__proto__`, con profundidad, listas y textos acotados. El catálogo se valida por id. Las 104 pruebas de `tests/api/` pasan.
- **Errores:** al móvil solo llegan mensajes fijos. Los registros de copia guardan solo el tipo de error; los del entrenador, el mensaje del SDK (2000 caracteres, sin el cuerpo).
- **Coste por llamada:** modelo fijo (las pruebas solo admiten opus/sonnet de una lista cerrada), `max_tokens` 16000/48000, corte por inactividad de 150 s, tope de 285 s en vivo, cancelación al irse el móvil.
- **Cifrado:** AES-GCM-256 con la cabecera como AAD, IV aleatorio, PBKDF2-SHA-256 con 600 000 iteraciones (y un máximo de 5 M contra cabeceras manipuladas), clave no exportable en IndexedDB y metadatos del nombre cifrados con AAD por persona. La copia no lleva el código (`normalizar` y `exportar`). El servidor solo ve bytes, tamaño, fecha y sal.
- **Nombres en Blob:** `leerNombre` valida con una expresión regular cerrada (persona, fecha, sal y meta), sin recorrido de rutas, y no se cruzan producción y `preview/`.
- **CSP y cabeceras:** CSP estricta sin `unsafe-*`, HSTS, COOP, XFO DENY, Permissions-Policy y nosniff. Sin `style=` en plantillas (solo CSSOM). `sw.js` no guarda `/api/*` ni las peticiones que no son GET.
- **Secretos:** ninguno en el árbol ni en el historial de git (solo valores de prueba).

## Criterios T
- **T7** (sin código o para gastar de más): **cumple** lo que pide su prueba (500, 413, recortes; `tests/api/*.test.mjs`) y **no cumple** «gastar de más»: no hay ritmo ni cupo en `/api/entrenador` ni freno de 401 (S1, `coste-y-fuerza.test.mjs`).
- **T11** (copias en la nube; la parte de «ilegible sin la frase»): **cumple** con la frase propuesta y **no cumple** con frases débiles, que se aceptan (S3, `frase-debil.mjs`). Disponibilidad de la copia: en riesgo ante quien tenga el código (S2).
- **T4** (no se pierden datos, en lo que toca a la nube): no comprobado más allá de S2.
