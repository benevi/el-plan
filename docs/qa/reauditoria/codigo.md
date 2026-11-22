# Re-auditoría PR 18 · enfoque **código** (T10, calidad del código y de las pruebas)

Árbol auditado: `/home/user/wt/auditoria` (pipos-v2, `f3164ec`), sin tocar (git status limpio; Playwright deja `playwright-report/`, que está en `.gitignore`). Scripts y salidas: `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/codigo/`. Node 24.22.3 (`/opt/node24/bin`; el `node` del PATH es el 22).

## Resumen

La base está sana: `npm test` (951: 948 ✔, 1 skip legítimo, 2 `todo`), `npm run lint` y la e2e completa (54/54 sin carga) pasan, y 13 de 18 mutaciones dirigidas las caza la suite. Pero hay **una regla de seguridad duplicada que diverge**: «Cambiar por otro» ofrece ejercicios que el propio validador rechaza (T3). Hay también dos reglas que no se aplican en la vida real aunque sus pruebas pasan: la copia de una sesión hecha sin red (T11) y el bajar de nivel solo (C-NIVEL-3). Y quedan varios huecos de prueba: el audio de la alarma, la guarda de rechazados, T9 a 320×568 y el límite de T7.

## Tabla de hallazgos

| id | sev. | título | archivo:línea |
|---|---|---|---|
| COD-1 | **alto** | «Cambiar por otro» usa `nivelesZona` (sin C-LES-2/C-LES-3 ni C-DOLOR-0) y ofrece ejercicios que el validador rechaza (T3) | `js/reglas/catalogo.js:15-20,42-47,55` · `js/areas/sesion/indice.js:668` frente a `js/areas/entrenador/dia.js:160-182` |
| COD-2 | **alto** | C-NIVEL-3 nunca se aplica con «Que mi progreso me cambie de nivel» activado (el valor por defecto); Progreso dice «lo sube o lo baja» | `js/areas/entrenador/indice.js:426-435` · `js/areas/progreso/indice.js:45` · `js/areas/perfil/indice.js:81` |
| COD-3 | medio | T11: la sesión terminada sin red no se copia al reabrir con red (`revisarApertura` dice «reciente»), y con «red que miente» no hay reintento | `js/nucleo/copia.js:568-575,575` (`alVolverRed`), `:527-540` |
| COD-4 | medio | El audio programado de la alarma (lo que suena con la pantalla bloqueada) no tiene ninguna prueba: cambiar sus pitidos, la previa o el tope de −15 no rompe nada | `js/areas/sesion/temporizador.js:84-100,23,436` |
| COD-5 | medio | T9 a 320×568: la prueba se llama «la serie actual se ve sin desplazarse» pero no lo comprueba, y la serie queda 97 px por debajo del borde | `tests/e2e/sesion.spec.mjs:273-283` |
| COD-6 | medio | La guarda «nunca un ejercicio rechazado» sobre lo que propone la IA solo la protege una instantánea de caracterización | `js/areas/entrenador/validar.js:70` · `tests/caracterizacion/*` |
| COD-7 | bajo | T7: la prueba del 413 usa `LIMITE_CUERPO` importado (es tautológica): subirlo a 1,5 MB no rompe nada | `tests/api/entrenador.test.mjs:101-108` · `api/_comun.js:10` |
| COD-8 | bajo | Dos `todo` olvidados que ya pasan: si vuelve el fallo, la CI no lo ve | `tests/entrenador-ia.test.mjs:128,149` |
| COD-9 | bajo | Prueba de rendimiento intermitente con carga (674 ms y otra vez > 600 ms en 2 de 3 ejecuciones completas con CPU compartida); en CI, `retries: 1` la esconde | `tests/e2e/rediseno.spec.mjs:204-234` · `playwright.config.js:11` |
| COD-10 | bajo | Bomba de relojería: `listar` falla a partir de ~2028-11 (la copia v1 fija de 2026-11-01 la borra la retención de 2 años) | `tests/api/copia.test.mjs:154-167` |
| COD-11 | bajo | Código muerto exportado: `bloqueMedidor` (duplicado de Perfil; su comentario dice «lo pinta Perfil»), `esperandoIA`, `musculoEj`, `borradorMia`, `desactivar` (nube), `$$` | `js/areas/entrenador/indice.js:228,408-415,557` · `js/areas/perfil/editor.js:330` · `js/nucleo/copia.js:445` · `js/nucleo/ui.js` |
| COD-12 | bajo (sin demostrar) | La tercera alarma sonora (fin+8 s) cae justo cuando la barra se cierra sola a los 8 s y `cerrarAlarma` pausa el audio: con la pantalla a la vista se corta a medias | `js/areas/sesion/temporizador.js:92,322-324` |

---

## COD-1 · alto · «Cambiar por otro» ofrece lo que el validador prohíbe (regla duplicada)

**Qué pasa.** Hay dos cálculos de «cuánto cuidar cada zona hoy»:
- `bandasHoy` (`dia.js:160`), que usan el validador y las reglas: el dolor de hoy sustituye a la ficha, la ficha se topa en 6 (C-DOLOR-0) y una lesión nueva o un dolor sin lesión de 2 a 6 cuenta como B2 (C-LES-2, C-LES-3).
- `nivelesZona` + `nivelDolor` (`catalogo.js:15`, idéntica a `bandaDe`), que no hace nada de eso. La usan `disponibles()` y `alternativas()`, es decir, «Cambiar por otro» de la sesión (`sesion/indice.js:668`), el catálogo que se manda a la IA (`ia.js:catalogoParaIA`) y la nota de `completarIA`.

El cambio elegido se guarda **sin pasar por el validador** (`sesion.cambiarPor`).

**Reproducir.** `node …/codigo/h1b.mjs`: lesión de rodilla nueva (ficha 3) y hoy 3 en el gimnasio. El validador la trata como B2, pero «Cambiar» ofrece algo con riesgo de rodilla en 52 ejercicios: `sentadilla-smith`, `sentadilla-goblet`, `step-up`, `prensa-piernas`, `eliptica`, `bird-dog`, `patada-gluteo-cuadrupedia`… Metido en la sesión, el validador dice `bird-dog: carga tu rodilla, que hoy está a 3/10`. Pasa lo mismo con dolor 2-3 sin lesión registrada (C-LES-3) y con el «dolor durante» de 2-3 (C-DOLOR-6).

**Por qué importa.** Rompe T3 («nunca aparece un ejercicio contraindicado para el dolor de hoy») en un botón que se usa a mitad de sesión. Es exactamente el caso de la queja de Víctor: dos reglas para lo mismo que no dicen lo mismo.

**Arreglo.** Que `disponibles`/`alternativas` reciban las bandas del validador: `nivelesDe(bandasHoy(S, dolorHoy))`, o que `nivelesZona` pase a ser un envoltorio de eso. Borrar `nivelDolor` o `bandaDe` (hoy hay dos copias). Pasar la sesión por `problemasSesion` tras `cambiarPor`. Añadir una prueba: «para cada ejercicio del catálogo, ninguna alternativa tiene problemas en el validador» con la matriz de bandas.

## COD-2 · alto · El nivel nunca baja solo (C-NIVEL-3)

**Qué pasa.** El oyente de `entrenador/indice.js:426` solo actúa cuando cambia el número de sesiones hechas, y salta la primera vez (al abrir). Cuando se termina una sesión tras el parón, `medidorNivel` ya ve `diasSinEntrenar = 0` y propone el mismo nivel. Perfil solo enseña «Pasar a…» si `nivelAuto` está **desactivado** (`perfil/indice.js:81`). Con el valor por defecto (`nivelAuto: true`) nadie aplica ni propone bajar. Progreso afirma «Tu entrenador lo sube o lo baja».

**Reproducir.** `node --test …/codigo/h5-nivel-auto.test.mjs` (copiarlo en `tests/` de una copia del árbol). Al abrir, el medidor dice `sugerido: 1` («Llevas 10 semanas sin entrenar…»), pero el nivel sigue en 2. Tras terminar una sesión, `sugerido: 2` y el nivel sigue en 2. Ninguna prueba cubre el oyente.

**Arreglo.** Evaluar la bajada al arrancar (o al abrir el check-in), antes de la primera sesión tras el parón, con `nivelAuto`. Y con `nivelAuto` activado, enseñar también el motivo en Perfil. Hace falta una prueba de pantalla del oyente.

## COD-3 · medio · Copia de una sesión hecha sin red (T11)

**Qué pasa.**
- (a) Se termina la sesión sin cobertura (la piscina), se cierra la app y se reabre con red antes de 24 h desde la última copia. `revisarApertura` mira solo la hora de la última copia, no si hay sesiones nuevas (`metadatos(S).sesiones > nube().sesiones`), y devuelve `'reciente'`. La sesión no sube hasta la siguiente sesión o pasadas 24 h.
- (b) Con `navigator.onLine` a true pero fetch fallando («red que miente»), `faltaRed = true` solo se reintenta con el evento `online`, que nunca llega. La prueba existente llama a `_alVolverRed()` a mano, así que pasa.

**Reproducir.** `…/codigo/h2-nube-sin-red.test.mjs` (en `tests/` de una copia; simula un `localStorage` que sobrevive a cerrar la app, que es lo que el arnés no hace: `reiniciarCopia()` borra la memoria y por eso la prueba original no lo ve). Falla H2a (`revisarApertura → reciente`) y H2b (0 copias tras 30 min con red).

**Arreglo.** En `revisarApertura`, copiar también si `metadatos(S).sesiones > n.sesiones` o si `ultimaSesion` es más nueva. Reintentar `faltaRed` al volver a primer plano (`visibilitychange`) o con un temporizador con espera creciente.

## COD-4 · medio · El audio de la alarma no está probado

**Qué pasa.** El cronómetro es lo que más usan, y su aviso con la pantalla bloqueada sale de `agenda()`/`wav()`. Ninguna prueba unitaria ni e2e mira los pitidos: jsdom sustituye `Audio` y `createObjectURL`. Mutaciones que sobreviven a toda la suite unitaria y a `sesion.spec` + `humo.spec`:
- M11: una sola alarma en vez de tres.
- M13: −15 sin el tope `transcurrido()+1`.
- M14: la previa de 5 s pasa a 3 s.

El cierre a los 30 s (M3) sí lo caza la e2e.

**Reproducir.** `python3 …/codigo/mutar.py <copia>` y `python3 …/codigo/mutar-e2e.py <copia>` (resultados en `mutaciones-unit.txt` y `mutaciones-e2e.txt`).

**Arreglo.** Exportar `agenda()` (pura) y probar los instantes de los pitidos para descanso, previa, trabajo lo<hi y c/lado. Añadir una prueba de jsdom de «−15» con menos de 15 s restantes.

## COD-5 · medio · T9 a 320×568 sin comprobar

La prueba `T9 en 320 × 568 (…): la serie actual se ve sin desplazarse…` solo hace la aserción R03 si `w === 360`. En la salida de la e2e: `T9 320×568 victor: margen de la serie actual sobre el borde -97 px` (igual con Virginia). El plan pide T9 en la sesión «en 360×640 y 320×568» (aceptación del PR 15). Si 320×568 se acepta así, hay que decirlo en el nombre de la prueba. Si no, falla T9 en ese tamaño. Reproducir: `npm run e2e -- tests/e2e/sesion.spec.mjs -g "320"` y mirar el `console.log`.

## COD-6 · medio · La guarda de rechazados de la IA solo la vigila una instantánea

Al quitar `if (gustos[e.id] === 'rechazo') return 'no lo quieres'` (`validar.js:70`), la IA vuelve a meter `prensa-piernas` rechazada en la sesión y en los dos días del plan (`node …/codigo/m2.mjs <raíz>`, con y sin la mutación). Solo falla `tests/caracterizacion/…`. Esas instantáneas se han regenerado en 10 commits (`ACTUALIZAR_INSTANTANEAS=1`): un cambio así se colaría al regenerarlas. La matriz de 336 casos no tiene ningún rechazo. **Arreglo:** que la matriz y `entrenador-ia.test.mjs` tengan una prueba explícita en la que la IA propone un rechazado (sesión y plan).

## COD-7 · bajo · Límite de T7 sin fijar
`'A'.repeat(LIMITE_CUERPO)` se mueve con la constante (M9 sobrevive). Hay que probar que 151 KB → 413 y 149 KB → 200 con números literales.

## COD-8 · bajo · `todo` olvidados
`respuesta 200 sin «sesion»` y `plan nulo de la IA` llevan `{ todo: 'PR 12: errores crudos' }`, pero ya pasan (`ok … # TODO`). Basta con quitar el `todo`.

## COD-9 · bajo · Prueba de rendimiento intermitente
Mediana de 674 ms (presupuesto local de 600 ms) con otra carga en la máquina: falló en 2 de 3 ejecuciones completas con pruebas unitarias en paralelo y pasó sola (3/3) y en la ejecución limpia (54/54). En CI el presupuesto es de 900 ms y hay `retries: 1`, que además esconde cualquier intermitencia de las demás e2e. Habría que informar de los reintentos (el reporter `github` ya los marca como *flaky*) o quitarlos.

## COD-10 · bajo · Prueba con fecha que caduca
`FECHA_SIM=2029-11-21 … node --import …/codigo/reloj.mjs --test` → `listar` falla (`1 !== 2`). La copia v1 está fechada a mano en 2026-11-01 y la retención de 2 años la borra. Conviene fecharla respecto a `ahora` o con `ponerReloj`.

## COD-11 · bajo · Código muerto
Salida de `node …/codigo/estatico.mjs .`. `bloqueMedidor` es una segunda versión del medidor que no pinta nadie (Perfil tiene la suya en `perfil/indice.js:78-81`). `desactivar` (nube) no tiene botón. Borrarlos o usarlos. Los ciclos de imports (`dia↔validar`, `dia→validar→dolor-alto→dia`, `checkin↔mias`) solo se usan dentro de funciones: importar cada módulo por separado funciona.

## COD-12 · bajo, sin demostrar · Tercera alarma cortada
`agenda()` programa tres alarmas (fin, +4 y +8 s) y la barra se cierra a los 8 s de pintarse (`ALARMA_SEG`). `cerrarAlarma` pausa el audio si no hay temporizador. Con la pantalla a la vista, el tercer triple pitido empieza justo cuando se corta.

---

## Lo que no es un fallo (comprobado)
- **Zonas horarias.** `tests/ayuda/comun.mjs` fuerza `process.env.TZ = TZ_PRUEBAS || 'Europe/Madrid'`, así que `TZ=…` no cambia nada (948 ✔ con Kiritimati y Los Ángeles). Con `TZ_PRUEBAS` fallan 71/74 pruebas. Todas son instantáneas de caracterización, la prueba que exige Madrid o pruebas de migración escritas a propósito «a la 1:30 en Madrid». No sale ninguna lógica de la app que dependa de la zona fuera de eso.
- **Fechas simuladas.** Con `--import reloj.mjs` (FECHA_SIM): 22-11 a las 23:59:30, 23-11 a las 00:00:30, el cambio de hora del 28-03-2027, Nochevieja, el 29-02-2028, junio de 2027 y la semana del 07-12 dan 948 ✔. Una fecha **anterior** a los datos de las pruebas (25-10-2026) da 3 fallos esperables, y 2029 da el COD-10.
- **Umbral de dolor alto (M15, `checkin.js` 7→8).** Sobrevive porque el validador lo vuelve a imponer: la salida es idéntica en 9 casos (`m15-orig.txt`/`m15-mut.txt`). Es defensa en profundidad, no un hueco.
- Las mutaciones del guardado (espejo, otra pestaña, `pagehide`, `guardarYa`), del cronómetro tras bloqueo o recarga, de la vibración y de la espera de las copias **las caza** la suite.
- Los `catch` vacíos son de foco, audio, vibración o historial. No he encontrado ninguno que se trague un error de datos.

## Criterios T de mi enfoque
| T | Estado | Prueba |
|---|---|---|
| T10 | **cumple** | La CI (`.github/workflows/ci.yml`) hace `node --check`, lint, `npm test` y la e2e completa; `tests/version.test.mjs` comprueba que `HUELLAS`/`VERSION` salen de `scripts/version.mjs` (cualquier cambio en la app sin `npm run version` lo rompe, visto en todas las mutaciones). Pegas: COD-8 y COD-9 (`retries: 1`). |
| T3 | **no cumple** | COD-1 (`h1b.mjs`); la guarda de la IA, poco protegida (COD-6). |
| T11 | **no cumple del todo** | COD-3 (`h2-nube-sin-red.test.mjs`). Con red al terminar, sí (prueba existente `copia-nube.test.mjs:307`). |
| T9 (sesión, 320×568) | **no comprobado / no cumple a 320** | COD-5. |
| T7 | cumple (hueco de prueba COD-7) | `tests/api/entrenador.test.mjs`. |
| T1, T2, T4, T5, T6 | cumplen en lo que miran sus pruebas | La suite y la e2e en verde. Las mutaciones de T4 las caza. |
