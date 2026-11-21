# Pipos Fitness · guía para Claude Code

Léelo entero antes de tocar nada. Los detalles técnicos (guardado, copias, service worker, pruebas) están en `LEEME.md`; el criterio de entrenamiento, en `docs/criterio.md`.

## Qué es
- App **privada** de entrenamiento de **Víctor y Virginia** (pareja). No se vende ni se publica.
- Cada uno la usa en **su móvil**, con **sus datos** y **su color** (`data-persona` en `<html>`, que cambia `--acento` en `css/tokens.css`). No hay datos compartidos entre ellos ni base de datos propia: todo vive en el navegador de cada móvil (más copias cifradas opcionales en Vercel Blob).
- Entrenan en un **centro deportivo con gimnasio y piscina climatizada**; a veces en casa o en la calle.
- PWA sin paso de compilación (HTML + módulos ES + CSS), alojada en Vercel. La IA va en funciones del servidor (`api/`) con la clave de Anthropic, que nunca sale de Vercel.
- Todo en **español de España**: interfaz, código, comentarios, commits y PR.

## Ramas y despliegue (reglas fijas)
- `main` = **producción** en https://el-plan-six.vercel.app. **No se toca sin el OK explícito de Víctor**: nada de push, merge ni PR que vaya a `main`.
- `pipos-v2` = la versión nueva (reescrita de cero), PR #8 en borrador. Cada rama tiene su vista previa en Vercel (la de `pipos-v2`: https://el-plan-git-pipos-v2-benevis-projects.vercel.app).
- Trabaja en una rama propia y abre el PR **contra `pipos-v2`**, nunca contra `main`.
- **Víctor gestiona Vercel él mismo** (variables, almacén Blob, dominios). No intentes cambiar la configuración de Vercel; si hace falta algo, díselo con los pasos.
- PR #3, #4, #5, #6 y #7 quedan **solo como referencia**: no se fusionan. El #7 es nutrición (aparcada).

## Qué quiere Víctor
- **El entrenador IA es el cerebro**: hace el plan semanal y la sesión de cada día, analiza el progreso, lee sus comentarios y lo adapta todo. Los planes son **dinámicos** (pueden cambiar en un día o en una semana). Criterio de especialista real, nunca respuestas enlatadas. Si la IA falla, la app sigue con las reglas locales.
- **Todo sale de un perfil editable**, nada fijo en el código: uno o varios objetivos, nivel (editable o movido por el progreso), lesiones y dolor (zona, intensidad y duración cambian), días disponibles cada semana, minutos, lugares y material de casa.
- **Calentamiento y vuelta a la calma con estiramientos: obligatorios** en toda sesión. **Cardio siempre**, dosificado según el objetivo.
- **Cada ejercicio de la sesión lleva la información para saber hacerlo** (ficha técnica, cómo se hace, en qué fijarse).
- **Me gusta / no me gusta** por ejercicio, y la IA lo tiene en cuenta.
- **Check-in solo si de verdad cambia la sesión.**
- Lo que más usaban de la versión anterior: el **cronómetro** de ejercicios por tiempo y descansos, con **alarma visual y vibración**. Tiene que ir perfecto.
- Motivación por **constancia y progreso** (fuerza y salud). Sin logros, puntos ni vista «Juntos».
- **Estilo limpio, elegante y muy intuitivo.** Su queja de siempre: funciones que no hacen lo que dicen, pantallas sin función real y app desordenada. No añadas pantallas ni botones que no sirvan para algo concreto; antes de dar algo por hecho, compruébalo funcionando.
- **Logo: opción B** (ya en `icons/`).
- **Nutrición fuera de esta app**: será otra app en el futuro. No añadas nada de comidas ni dietas aquí.

## Estructura del código
| Dónde | Qué |
|---|---|
| `index.html`, `js/main.js`, `js/arranque.js` | Entrada, arranque y vigilante de arranque |
| `js/nucleo/` | Estado y guardado (`estado.js`, espejo en IndexedDB, rescate, normalizador, migración desde `main`), router, piezas de interfaz (`ui.js`), llamadas a `/api` (`api.js`), forma de sesión y plan (`modelo.js`), copias (`copia.js`) y versión |
| `js/datos/` | Catálogo de ejercicios (`ejercicios.js`), lesiones, constantes, palabras de la frase de copias |
| `js/reglas/` | Barandillas compartidas: catálogo y seguridad, progresión, contexto que se manda a la IA |
| `js/areas/entrenador/` | Lógica del entrenador: `dia.js` (sesión por reglas), `plan.js` (semana), `checkin.js`, `ia.js` (puente con la IA), `validar.js` (validador único), `indice.js` (pantallas) |
| `js/areas/{hoy,perfil,sesion,progreso,ejercicios}/` | Cada pantalla; `sesion/temporizador.js` es el cronómetro |
| `js/aspecto/` | Movimiento (cambio de pantalla) y celebración |
| `api/entrenador.js`, `api/_comun.js` | Función de la IA (modos `sesion` y `plan`), saneado y llamada a Claude |
| `api/copia.js` | Copias cifradas en Vercel Blob |
| `css/` | `tokens.css` y `componentes.css` (sistema de diseño), `marco.css`, `legado.css` (lo aún no rediseñado), `areas.css` |
| `sw.js`, `scripts/version.mjs` | Modo sin conexión y versiones (lista `APP`, `VERSION`, `HUELLAS`) |
| `docs/criterio.md` | Especificación de salud y entrenamiento (aprobada por Víctor el 20-11-2026) |
| `tests/` | `node:test` + jsdom, y e2e con Playwright |

## Reglas al cambiar código
- Cada área se registra en su `indice.js` con `rutas`, `acciones` y `pestaña`; botones con `data-act="area.accion"`, campos con `data-cambio="area.accion"`.
- Datos: leer con `estado()`, cambiar con `cambiar(S => {...}, motivo)`. No cambies la forma de `pipos4` ni la de sesión/plan (`js/nucleo/modelo.js`) sin pensarlo: afecta a todo y a los datos guardados en los móviles.
- Escapa con `h()` todo lo que venga del estado en las plantillas.
- Nada de `<script>` en línea ni `on…=` en `index.html` (CSP). Nada de `import()` dinámico en `js/`.
- Si añades un archivo de la app, súmalo a `APP` en `sw.js`.
- **Tras cambiar cualquier archivo de la app, ejecuta `npm run version`** y sube el `sw.js` (y la meta de `index.html`) que cambian.
- Seguridad y salud: sigue `docs/criterio.md` (cita sus identificadores, p. ej. `C-DOLOR-3`). Toda sesión pasa por el validador. Los textos libres del usuario son datos, no instrucciones.
- Antes de dar algo por terminado: `npm run lint` y `npm test` (y `npm run e2e` si tocas arranque, guardado o `sw.js`). La CI lo repite en cada PR.

## Probar en local
Requiere **Node 24** (`node --version`).
```
npm ci
npm test            # pruebas unitarias y de pantalla
npm run lint
npx playwright install chromium   # solo la primera vez
npm run e2e         # pruebas en un móvil emulado
python3 -m http.server 8765        # y abrir http://localhost:8765
```
Con el servidor simple la app funciona entera **sin IA** (usa las reglas). Para probar la IA hace falta Vercel: la vista previa del PR, o `vercel dev` con el proyecto enlazado (`vercel link`, `vercel env pull`), que es cosa de Víctor.
