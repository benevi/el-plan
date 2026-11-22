# Re-auditoría PR 18 · Despliegue (Operator)

## Resumen
El service worker atómico, el vigilante y el aviso «Actualizar» se portan bien en todo lo que probé: el paso desde la app **real** de `main` (sacada de `origin/main`, con un `elplan2` realista), el modo avión con la sesión creada y la marcha atrás de ida y vuelta, en la que se conserva todo lo entrenado. Los fallos están en el **plan de lanzamiento y de marcha atrás**: las fotos de progreso de `main` no llegan a ninguna copia y el paso 11 (reinstalar en iPhone) las borraría; la marcha atrás tal como está escrita no se puede hacer en el plan Hobby si hay más de un despliegue de producción y, después de hacerla, deja `main` sin despliegue automático; además le faltan avisos y comprobaciones previas. 0 críticos, 1 alto, 3 medios y 3 bajos.

## Hallazgos

| id | sev. | título | dónde |
|---|---|---|---|
| D1 | alto | Las fotos de progreso de `main` (IndexedDB `ElPlan2DB/fotos`) no se migran, no van en la copia a archivo de `main` ni en la de v2, ni en la nube; el paso 11 (reinstalar en iPhone) las borra | plan.md «Lanzamiento a main» pasos 2, 10 y 11; `js/nucleo/migracion.js` (no las lee) |
| D2 | medio | «Volver en Vercel al despliegue anotado»: en Hobby solo se puede volver al despliegue de producción **inmediatamente anterior**; y tras una vuelta atrás Vercel deja de asignar el dominio a los despliegues nuevos de `main` | plan.md «Marcha atrás» |
| D3 | medio | En la marcha atrás, `main` no ve nada de lo entrenado en v2 y las copias en la nube se paran. El plan no lo avisa, y en un iPhone ya reinstalado (paso 11) `main` aparece vacío | plan.md «Marcha atrás»; demostrado en `t-paso-main.mjs C` |
| D4 | medio | No hay comprobación previa de las variables de **Production** (`BLOB_READ_WRITE_TOKEN`/`BLOB_STORE_ID`, `APP_CODE`, `ANTHROPIC_API_KEY`); el simulacro del paso 3 en la vista previa escribe en `preview/` y no demuestra nada de producción | plan.md pasos 3 y 7; `api/copia.js:34` |
| D5 | bajo | Si el SW de v2 no consigue instalarse, v2 sigue funcionando bajo el SW de `main` (red primero, reescribe la caché) sin ningún aviso, es decir, con el esquema de mezcla que el PR 5 quitó | `sw.js:189-197` (sin aviso); demostrado en `t-paso-main.mjs B` |
| D6 | bajo | «Abrir la app dos veces» en iOS tiene que ser cerrarla del todo (deslizarla en el multitarea): volver a primer plano no recarga, y la primera apertura sigue siendo v2 | plan.md «Marcha atrás» |
| D7 | bajo | «He traído 1 sesiones nuevas de la app anterior» (sin concordancia) | `js/main.js:59` |

---

### D1 · alto · Las fotos de progreso de `main` se quedan fuera de todas las copias
**Qué pasa.** `main` guarda las fotos de progreso (Progreso → Cuerpo → «Añadir foto») en IndexedDB `ElPlan2DB`, almacén `fotos`. Pero:
- el «Exportar» de `main` (`Store.exportar`) solo copia `S`, sin las fotos;
- v2 no lee `ElPlan2DB` (no hay ninguna referencia a fotos en `js/` ni en `docs/`);
- la copia a archivo de v2 (`exportar()`) y la copia en la nube (que también sale de `exportar()`) tampoco las llevan.

Mientras no se borre el almacenamiento, las fotos siguen en el móvil sin que nada las enseñe. El paso 11 del lanzamiento (iPhone: «reinstalar y restaurar desde la nube») borra los datos de la web app instalada, y con ellos las fotos (y todo `elplan2`: lo de la otra persona, las rutinas `routines`, que tampoco se migran, y el `painLog`). Después de ese paso no queda ninguna copia de las fotos.

**Reproducir.** `node despliegue/t-fotos.mjs` (puerto 8933). Instala la app real de `main`, guarda una foto con `Store.fotos.put`, pasa a v2 y elige dueño. Resultado:
`main: fotos guardadas = 1 | la copia «Exportar» de main lleva fotos: false` · `v2: la copia a archivo (exportar) lleva fotos: false | pipos4 (lo que va a la nube) las lleva: false | bases IndexedDB: ElPlan2DB, pipos-copia, pipos-espejo`.
Que iOS borre los datos al quitar la app de la pantalla de inicio está **sin demostrar** desde aquí (no hay WebKit), pero es el comportamiento conocido desde que iOS da a cada web app instalada su propio almacenamiento.

**Por qué importa.** Si las usaban, es pérdida de datos irrecuperable provocada por el propio plan de lanzamiento, con T4 dado por cumplido. Que las usen es una incógnita: hay que preguntárselo a Víctor.

**Arreglo.** Antes de lanzar, preguntar a Víctor y a Virginia si tienen fotos en la app vieja. Si las tienen, hay dos caminos. Uno: un paso del lanzamiento que las saque (en `main`, abrir cada foto y guardarla a mano, o añadir en v2 una acción de un solo uso, «Descargar fotos de la app anterior», que lea `ElPlan2DB/fotos` y las comparta con `navigator.share`). Otro: decidir de forma explícita que se abandonan. Y en cualquier caso, **no hacer el paso 11** hasta tenerlas fuera del teléfono. Añadirlo a «Pruebas en tus móviles».

### D2 · medio · La marcha atrás de Vercel tiene límites que el plan no recoge
**Qué pasa.** Según la documentación de Vercel (Instant Rollback / `vercel rollback`): «On the Hobby plan you can only roll back to the immediately previous production deployment». Si después de fusionar llega otro despliegue de producción a `main` (un arreglo rápido, un redespliegue), el despliegue anotado en el paso 1 ya no se puede recuperar con un clic. Además, después de una vuelta atrás Vercel desactiva la asignación automática de los dominios de producción: los commits nuevos de `main` (el arreglo de v2) **no salen** hasta que alguien hace «Undo rollback» / `vercel promote`. La frase del plan, «la vuelta a v2 recupera lo entrenado», da por hecho que la vuelta ocurre sola.
**Reproducir.** Es documentación: búsqueda en la documentación de Vercel, «Instant Rollback Hobby». Sin cuenta ni configuración tocadas.
**Arreglo.** En «Marcha atrás»: (a) mirar el plan de la cuenta. En Hobby, la marcha atrás con un clic solo sirve mientras el despliegue de v2 sea el único de producción después del de `main`. Si no, la vía es `git revert` del merge en `main` (un PR con el OK de Víctor), que funciona con cualquier plan. (b) Añadir «para volver a v2: Promote del despliegue bueno (o Undo rollback); si no, los commits nuevos no se publican».

### D3 · medio · Lo que se ve y lo que no durante la marcha atrás
**Qué pasa** (demostrado, `t-paso-main.mjs C`, puerto 8932, app real de `main`):
1. v2 con 6 sesiones migradas más 1 hecha en v2, en total 7.
2. Marcha atrás: la 1.ª apertura sigue siendo v2 y la 2.ª ya es `main` (el «dos veces» del plan es correcto). `pipos4` sigue intacto, pero **`main` no enseña la sesión hecha en v2** (`main ve la sesión de v2: false`).
3. Una sesión hecha en `main` durante la marcha atrás.
4. Vuelta a v2: se ve desde la 1.ª apertura, con el aviso «He traído 1 sesiones nuevas», y ahora hay **8 sesiones**: la de v2 y la de `main` están las dos.

Así que la promesa del plan se cumple: no se pierde nada. Pero el plan no avisa de que, durante la marcha atrás:
- la app vieja «no tiene» lo entrenado en v2, y eso puede llevar a apuntarlo otra vez y duplicarlo al volver;
- lo que se *edite* en `main` sobre algo ya migrado no vuelve, porque la migración es incremental por clave;
- las copias en la nube fallan, porque `main` no tiene `/api/copia`.

En un iPhone reinstalado (paso 11) no queda `elplan2` y `main` arranca vacío.
**Arreglo.** Añadir a «Marcha atrás» un aviso para los dos: «la app vieja no verá lo entrenado estos días; no lo apuntéis de nuevo; vuelve al volver a la nueva». Y decidir si la marcha atrás deja de ser una opción a partir del paso 11, o retrasar ese paso unos días.

### D4 · medio · Faltan comprobaciones previas de producción
**Qué pasa.** `api/copia.js:34` separa la vista previa: fuera de producción las copias van a `preview/`. El paso 3 («hacer una copia de prueba y restaurarla en un navegador limpio en la vista previa») solo prueba Preview: ni las variables de Production ni el Blob conectado a Production. Si el almacén o `APP_CODE` solo están en Preview, el fallo se ve en el paso 7, ya fusionado. `main` ya usaba `APP_CODE` y `ANTHROPIC_API_KEY`, pero no Blob.
**Reproducir.** Lectura de `api/copia.js:30-34` y `api/_comun.js` (`process.env.APP_CODE`, `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`/`BLOB_STORE_ID`, `VERCEL_ENV`). La configuración de Vercel no se puede comprobar desde aquí: **sin demostrar** que falte algo.
**Arreglo.** Paso 0 del lanzamiento, para Víctor en el panel: comprobar que las cuatro variables y el almacén Blob están conectados al entorno **Production**. Añadir también que el simulacro de recuperación definitivo es el del paso 7 en producción, no el del paso 3.

### D5 · bajo · SW de v2 sin instalar y en silencio
**Qué pasa.** `t-paso-main.mjs B`: se despliega v2 con un archivo de `APP` cuya huella no casa (`icons/maskable-512.png`). La página de v2 arranca y migra igual, servida por el SW de `main` (red primero). El SW nuevo falla en `install` siempre, y la app sigue indefinidamente bajo el SW de `main`, que reescribe su caché con cada respuesta. Sin red funciona, porque esa caché acaba teniendo todos los archivos de v2, pero vuelve el riesgo de mezcla del PR 5 y nadie se entera.
**Arreglo.** Opcional: si `navigator.serviceWorker.controller` no es de esta app (no contesta a `{tipo:'version'}`) pasado un rato desde el arranque, mostrarlo en Perfil → Ajustes («Modo sin conexión: no instalado») y añadir esa línea a la lista del paso 5 del lanzamiento.

### D6 · bajo · «Abrir dos veces» en iOS
Volver a primer plano no recarga la página. En la marcha atrás, `reg.update()` (en `visibilitychange`) instala el SW de `main`, pero la página sigue siendo v2 hasta que se recarga, y `versionActivada(null)` no avisa. Hay que escribirlo así: «cerrar la app del todo (deslizarla en el multitarea) y abrirla; dos veces». Sin demostrar en iOS.

### D7 · bajo · Concordancia
`js/main.js:59`: «He traído 1 sesiones nuevas de la app anterior», visto en `t-paso-main.mjs C`. Usar `plural()`.

---

## Lo que funciona (comprobado)
- `node despliegue/t5-sesion-sin-red.mjs` (8931): instalar, plan por reglas, crear la sesión de hoy (IA a 503 → reglas), **modo avión, cerrar y reabrir**: arranca, abre la sesión, marca una serie, sale el descanso, «Guardar sesión» y queda `hecha`, sin errores de página.
- `t-paso-main.mjs A` con la app **real** de `main` (el `sw.js` del fixture `tests/e2e/legado` es idéntico al de `origin/main`): migra «He traído 6 sesiones», el SW nuevo entra sin pedir «Actualizar», borra `elplan-v3.3.0*` y sin red funciona.
- `tests/e2e/sw.spec.mjs` en mis puertos: 13/13 en verde. `npm run lint` en verde. `tests/version.test.mjs` y `app-check` en verde. `node scripts/version.mjs --comprobar`: al día.
- `vercel.json`: `no-cache` en `/sw.js`, `no-store` en `/api/*`, `maxDuration` 300/30, CSP coherente con lo que pide la app. `.vercelignore` no deja fuera nada de `APP` ni nada que importe `api/`.
- CI: sintaxis, lint, `npm test` (incluye la comprobación de VERSION/HUELLAS) y e2e en cada PR. Nota menor: `retries: 1` en CI puede tapar pruebas inestables.

## Criterios
- **T5 · cumple** en Chromium: `t5-sesion-sin-red.mjs`, `t-paso-main.mjs A/B/C` y `sw.spec.mjs` (instalación, versiones mezcladas, actualización a medias, paso desde `main` y marcha atrás). **No comprobado** en iOS/WebKit (queda para «Pruebas en tus móviles»).
- **T10 · cumple**: `.github/workflows/ci.yml` corre lint, `npm test` (con `comprobar()` de `scripts/version.mjs`) y e2e; VERSION y HUELLAS son generadas (`npm run version`) y la CI falla si no coinciden.
- Lista de lanzamiento y marcha atrás: **incompleta** (D1-D4, D6). Lo que sí se cumple: la marcha atrás recupera de verdad lo entrenado (D3, paso 4).

Scripts: `/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/despliegue/` (`t5-sesion-sin-red.mjs`, `t-paso-main.mjs [A|B|C]`, `t-fotos.mjs`, `comun-pw.mjs`, `main-real/` = `git archive origin/main`).
