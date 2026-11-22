# Re-auditoría PR 18 · Enfoque «datos» (T4 y T11)

**Resumen.** El guardado base es sólido: los 174 tests de guardado, copias, nube y migración pasan, y también `guardado.spec` y `nube.spec` en Chromium. La ida y vuelta exportar → normalizar de un estado largo generado por la app sale idéntica (diff profundo: 0 diferencias). Aun así encontré 2 fallos altos: una copia en la nube que falla una vez no se reintenta, y cargar dos copias seguidas borra los datos originales. Hay además 4 medios: texto que se pierde al salir sin que el campo pierda el foco, textos recortados en silencio al restaurar, cambios «apartados» que no se pueden recuperar y una copia interna que se pisa si IndexedDB tarda. Por último, 2 bajos.

Scripts en `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/datos/`. Los `d*.mjs` se ejecutan con `node <script>` desde `/home/user/wt/auditoria`, el `d02` con `node --test`, y los `p*.mjs` con Playwright en los puertos 8921 y 8922.

| id | sev. | título | archivo:línea |
|---|---|---|---|
| D1 | alto | Una subida a la nube que falla (red inestable, app a segundo plano, 5xx/429) no se reintenta nunca sola, y al reabrir la app antes de 24 h tampoco se sube | `js/nucleo/copia.js:512-515, 561, 563-569, 302` |
| D2 | alto | Cargar dos copias seguidas pierde para siempre los datos que había antes de la primera | `js/nucleo/estado.js:432-438` |
| D3 | medio | «Para tu entrenador» (Perfil › Datos) no se guarda si se sale con «atrás», al pasar a segundo plano o al recargar | `js/areas/perfil/indice.js:147, 309` · `js/nucleo/router.js:146` |
| D4 | medio | Notas de lesión, comentarios de ejercicio y del cierre se recortan sin aviso al cargar una copia (archivo, nube o copia interna) | `js/nucleo/normalizar.js:107, 198, 241` |
| D5 | medio | «Ha quedado apartado» (conflicto entre pestañas): lo apartado no se puede recuperar desde la app | `js/nucleo/estado.js:246-250, 263` · `js/main.js:55` |
| D6 | medio (raro) | Sin `pipos4` y con IndexedDB lento (> 1,5 s), no se ofrece el rescate y el siguiente guardado pisa la copia interna | `js/nucleo/estado.js:182-203, 219` |
| D7 | bajo | «Me gusta / no me gusta», «Mis sesiones» y alarmas no disparan copia en la nube | `js/nucleo/copia.js:548` |
| D8 | bajo | Cargar cualquier copia v4 borra lo apartado de la otra persona (`migracion.porDueño`) | `js/nucleo/estado.js:410-416` · `js/nucleo/normalizar.js:349-357` |

---

## D1 · alto · La copia en la nube no se reintenta tras un fallo (T11)

**Qué pasa**
- Cuando `subirYa` recibe un error de red con `navigator.onLine === true`, solo pone `faltaRed = true` en memoria (`copia.js:512`).
- El reintento depende del evento `online` (`copia.js:561`), que solo llega cuando la red pasa de desconectada a conectada. Si el navegador nunca llegó a marcarse sin conexión (cobertura que se cae un momento, `fetch` cortado al pasar la app a segundo plano), no hay reintento.
- Con 5xx o 429 se guarda `error` y no se reintenta nunca.
- Al reabrir la app, `revisarApertura` solo mira si la última subida tiene más de 24 h (`copia.js:567`). No compara con las sesiones que hay en el móvil. `faltaRed` se pierde al cerrar.
- `estadoNube().avisar` no tiene en cuenta `error` (`copia.js:302`): no sale ningún aviso hasta pasados 3 días.

**Resultado:** una sesión terminada en el gimnasio con mala cobertura, o justo antes de bloquear el móvil, puede pasar hasta casi un día (o hasta la siguiente sesión o el siguiente cambio de perfil) sin estar en la nube, y nadie lo avisa.

**Reproducir:** `node --test d02-nube-apertura.test.mjs`. Dos pruebas y las dos fallan:
1. Sesión sin red, app cerrada y reabierta 3 h después con red: `revisarApertura → reciente` y 0 subidas nuevas.
2. `fetch` que falla una vez con la red «en línea»: 1 intento, ningún reintento, `avisar = false` y `error = null`.

**Por qué importa:** T11 pide una copia nueva menos de 1 minuto después de terminar una sesión. Además, D2 convierte esta copia atrasada en pérdida real.

**Arreglo sugerido:**
- En `revisarApertura` (y también al recuperar la red o el foco), subir si `metadatos(S)` tiene más sesiones o una última más nueva que la base (`n.sesiones` / `n.ultimaSesion`), aunque la última copia tenga menos de 24 h.
- Tras `'sin-red'` o `'error'`, programar reintentos con espera creciente (por ejemplo 30 s, 2 min y 10 min) además de escuchar `online`.
- Hacer que `avisar` tenga en cuenta `error`.

## D2 · alto · Dos cargas de copia seguidas borran los datos originales (T4)

**Qué pasa:** `pipos4-antes-de-importar` guarda un solo estado. Cada `importar()` lo sustituye por lo que hay en ese momento (`estado.js:434`). El espejo de IndexedDB también se sobrescribe. El flujo que lo provoca es el que la propia app propone en «Copias en la nube» («Toca una para restaurarla»):
1. Restaurar la copia A (no era la buena).
2. Restaurar la copia B.

Ahora «Volver a ellos» lleva a A, y los datos de verdad del móvil ya no están en ningún sitio. La confirmación dice «lo de ahora queda apartado y puedes volver a ello», lo que es cierto solo para el último paso.

**Reproducir:** `node d04-dos-copias.mjs`. Salida: `móvil: 9 → copia de 2 → copia de 5 → «Volver a ellos» → 2 (las 9 del móvil ya no están en ningún sitio)`.

**Por qué importa:** es pérdida de datos real, en un caso tan normal como probar copias de la lista. Junto con D1, la sesión que no llegó a subirse desaparece.

**Arreglo sugerido:** si ya existe `pipos4-antes-de-importar` y tiene menos de 7 días, no sustituirlo. Hay dos opciones:
- conservar el primero, es decir, «lo que había antes de empezar a cargar copias»;
- guardar los dos (o el que tenga más sesiones) y avisar.

Como mínimo, la confirmación de la segunda carga debería decir que el original se perderá.

## D3 · medio · Las notas del perfil se pierden al salir sin que el campo pierda el foco

**Qué pasa:** `#d-notas` guarda con `data-cambio`, que escucha el evento `change`, y ese evento solo llega cuando el campo pierde el foco. En estos casos el texto no llega al estado:
- el botón «atrás» repinta la vista y quita el `textarea` sin que se dispare `change`;
- `visibilitychange` y `pagehide` llaman a `guardarPendiente()`, que solo guarda lo que ya está en `S`;
- recargar o cerrar la app.

**Reproducir:** `node p01-notas.mjs` (puerto 8921). Resultado:

| Cómo se sale | ¿Se guarda? |
|---|---|
| Tocar la pestaña Hoy | sí |
| `history.back()` | no (`""`) |
| Segundo plano | no (`""`) |
| Recargar | no (`""`) |

**Por qué importa:** el texto es lo que la persona quiere que lea la IA. Es justo la queja de Víctor: un campo que parece guardado y no lo está. Al código de acceso (`#a-codigo`) le pasa lo mismo, y a los kilos y repeticiones escritos a mano en la sesión (`sesion.dato`) si la app se cierra antes de tocar otro sitio.

**Arreglo sugerido:** en los campos de texto, guardar también con `input` y un retardo (`perfil-silencio`), o recoger el campo enfocado antes de `pintar()` y en `visibilitychange`/`pagehide`. Por ejemplo, disparar `change` sobre `document.activeElement` si tiene `data-cambio`.

## D4 · medio · Recortes silenciosos al restaurar (T4 y T11)

**Qué pasa:** la interfaz no limita el largo de estos textos (sin `maxlength`):
- nota de lesión (`perfil/indice.js:285`);
- comentario de ejercicio (`sesion/indice.js:423`);
- comentario del cierre (`sesion/indice.js:361`);
- «Para tu entrenador» (`perfil/indice.js:147`).

El normalizador los corta a 300, 400, 1000 y 2000 caracteres. Toda carga pasa por él: archivo, nube y también «Recuperar la copia interna», que se hace con `importar(…, { interno: true })`. `avisos` queda vacío.

**Reproducir:** `node d03-recortes.mjs`. Resultado: lesión 700 → 300, comentario de ejercicio 600 → 400, cierre 1300 → 1000, `avisos: []`.

**Por qué importa:** una nota de diagnóstico (el propio campo invita: «qué movimientos duelen, diagnóstico…») vuelve cortada tras restaurar, sin que nadie lo diga.

**Arreglo sugerido:** poner los mismos límites en la interfaz (`maxlength` y contador), o subir los del normalizador por encima de lo que la interfaz permite. Si recorta, añadir un aviso.

## D5 · medio · Los cambios «apartados» no se pueden recuperar

**Qué pasa:** cuando otra pestaña guarda antes, los cambios de esta se apartan en el registro `conflicto` de IndexedDB o en `pipos4-conflicto`. La app avisa: «Lo último que hiciste aquí no se pudo juntar y ha quedado apartado». Pero ningún código lee ese registro ni esa clave (`grep -rn conflicto js/`: solo hay escrituras, en `estado.js:246-250` y `espejo.js:73-84`). Cada conflicto nuevo pisa al anterior. Lo mismo pasa al elegir «Recuperar la copia interna» con `rescate.motivo === 'espejo'` (`estado.js:440`).

**Reproducir:** las pruebas existentes `tests/guardado.test.mjs` («una pestaña con revisión vieja no pisa la nueva…») crean el registro. El `grep` demuestra que no hay forma de leerlo.

**Por qué importa:** es una función que no hace lo que dice. Para la persona, «apartado» quiere decir «lo puedo recuperar».

**Arreglo sugerido:** ofrecer «Ver lo apartado» o «Recuperarlo» en Perfil › Ajustes, con `importar(txt, { interno: true })` (y así es reversible). Otra opción es cambiar el aviso a «se ha perdido».

## D6 · medio (raro) · Copia interna pisada si IndexedDB tarda en arrancar

**Qué pasa:** `revisarEspejo({ max: 1500 })` da por perdida la lectura del espejo a los 1,5 s. Si `pipos4` está vacío y el espejo contesta tarde:
1. Sale la bienvenida.
2. Cuando la lectura llega, `revEspejo` se actualiza.
3. El siguiente guardado escribe con una revisión mayor y sustituye el único registro del espejo por el estado vacío.

En ningún momento se ofrece el rescate.

**Reproducir:** `node d05-espejo-lento.mjs`. Salida: `rescate ofrecido: null` y, tras el siguiente cambio, `espejo rev 58 · sesiones 0` (antes tenía 40).

**Por qué importa:** la pérdida es total y silenciosa, aunque hace falta que se den a la vez `pipos4` vacío e IndexedDB lento, por ejemplo en un arranque en frío en iOS.

**Arreglo sugerido:** cuando la lectura tardía llegue con `cargadoVacio` y un registro válido, ofrecer el rescate con `avisar('rescate')`. Hasta entonces, no escribir en el espejo por encima de una revisión que aún no se conoce.

## D7 · bajo · Cambios que no disparan copia en la nube

**Qué pasa:** `CAMBIOS = /^(perfil|medidas)(-silencio)?$/` no incluye estos motivos:
- `gusto`: me gusta, no me gusta y «No lo quiero», que viven en `perfil.gustos`;
- `misSesiones`;
- `alarma`: hay una prueba que lo da por bueno en el caso de gustos y plan.

Quedan fuera de la nube hasta la siguiente sesión o hasta que la última copia tenga más de 24 h al abrir la app.

**Arreglo sugerido:** añadir `gusto|misSesiones|alarma` al patrón (con la misma espera de 1 minuto).

## D8 · bajo · `porDueño` se pierde al cargar una copia v4

**Qué pasa:** `exportar()` quita `migracion.porDueño` y el normalizador no lo trae. El camino v3 sí lo conserva (`estado.js:405`), pero el v4 no. Si tras cambiar de dueño se carga una copia propia (aunque sea del mismo móvil) y después se vuelve al otro dueño:
- se pierden los cambios hechos sobre lo migrado;
- lo borrado vuelve, porque `claves` se vació al retirar.

**Arreglo sugerido:** en el camino v4, copiar `S.migracion.porDueño` del móvil al candidato, igual que se hace en el camino v3.

---

## Comprobado y correcto (no hace falta repetirlo)

- **Ida y vuelta:** diff profundo de un estado largo real, con migración, plan, 19 sesiones, Mis sesiones, alarmas, salud y `nadar25`: 0 diferencias (`d01-idavuelta.mjs`).
- **Dos pestañas e importar:** A está a mitad de sesión con descanso y B carga una copia. A carga la copia, enseña «No encuentro esa sesión», no la vuelve a escribir, no deja el descanso colgado y no da errores (`p02-pestanas-importar.mjs`).
- **Cronómetro tras restaurar:** un fin de ejercicio por tiempo sobre una sesión que ya no existe se ignora (`sesion/indice.js:755`).
- **Otras pruebas:** ejecuté 174 pruebas de guardado, copias, nube, API de copias, migración, medianoche y salir (todas en verde), y en Chromium `guardado.spec` y `nube.spec` (4/4).

**Nota:** al ejecutar Playwright en `/home/user/wt/auditoria` se creó `playwright-report/`, que está ignorada por git. El árbol sigue limpio (`git status` vacío).

## Criterios

- **T4 (no se pierden datos): no cumple.**
  - Se pierden datos con D2 (dos copias seguidas), D3 (texto escrito sin guardar), D4 (recortes al restaurar) y D6 (espejo lento).
  - Lo que pide expresamente la tabla del plan sí está cubierto y pasa: JSON roto, copia mala, cuota llena, dos pestañas, atrás en el cierre, medianoche, migración repetida, dueño equivocado, y marcha atrás y vuelta.
- **T11 (copias en la nube): no cumple del todo.**
  - Restaurar en un navegador limpio con la frase: cumple (prueba «restaurar desde un móvil nuevo» y `nube.spec`). Se restaura todo salvo lo de D4.
  - Ilegible sin la frase, también para el servidor: cumple (pruebas de cifrado y de «qué ve el servidor»).
  - «< 1 minuto tras terminar una sesión»: solo se cumple si la primera subida funciona. Con un fallo puntual no hay reintento ni aviso (D1, `d02-nube-apertura.test.mjs`).
