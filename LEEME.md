# Pipos Fitness

App privada de entrenamiento de Víctor y Virginia. Cada uno usa su móvil y ve solo lo suyo; no hay datos compartidos ni backend propio. La nutrición irá en otra app.
PWA sin paso de compilación (HTML + módulos JS + CSS), alojada en Vercel. La IA va en funciones del servidor (`/api`), la clave nunca sale de Vercel.

## Variables en Vercel (Production y Preview)
Las dos son **obligatorias** y hay que darlas de alta en **Production y en Preview** (en Preview también, o las vistas previas no tendrán IA).
- `ANTHROPIC_API_KEY`: clave de la API de Claude.
- `APP_CODE`: código de acceso; se escribe en la app en **Perfil → Ajustes del móvil**. Sin ella el servidor falla cerrado: `/api/*` responde 500 («el servidor no está configurado») a todo el mundo y la app sigue con las reglas, sin IA. Con ella, un código distinto en el móvil da 401.

## Mapa por áreas

| Área | Archivos | Qué hace |
|---|---|---|
| **Núcleo** (integrador) | `index.html`, `js/arranque.js`, `js/main.js`, `js/nucleo/estado.js`, `js/nucleo/router.js`, `js/nucleo/ui.js`, `js/nucleo/api.js`, `js/nucleo/modelo.js`, `js/nucleo/version.js`, `sw.js`, `scripts/version.mjs`, `manifest.webmanifest` | Arranque y vigilante de arranque, datos y guardado, navegación, piezas de interfaz, llamadas al servidor, forma de sesión y plan, modo sin conexión y aviso de versión nueva |
| **Entrenador IA** | `js/areas/entrenador/` (`entrenador.js` lógica, `indice.js` check-in y plan), `api/entrenador.js`, `api/_comun.js`, `js/reglas/contexto.js` | Sesión de hoy y plan semanal con IA; si falla, reglas |
| **Perfil** | `js/areas/perfil/` (`indice.js`, `bienvenida.js`) | Objetivos, nivel, lesiones, disponibilidad, lugares, material, gustos, ajustes, copia |
| **Sesión** | `js/areas/sesion/` (`indice.js`, `temporizador.js`) | Hacer la sesión: series, descansos con alarma visual y vibración, tiempo, modo uno a uno, cambiar ejercicio, cierre |
| **Progreso** | `js/areas/progreso/indice.js` | Constancia, fuerza, medidas, dolor, historial |
| **Hoy** | `js/areas/hoy/indice.js` | Pantalla de inicio |
| **Ejercicios** | `js/areas/ejercicios/indice.js` | Catálogo, ficha técnica, me gusta / no me gusta / no lo quiero |
| **Aspecto** | `css/base.css`, `css/componentes.css`, `css/areas.css`, `icons/`, `fonts/`, `js/aspecto/` | Colores, tipografía, componentes, movimiento y confeti; color por persona en `--acc` |
| **Datos y reglas** (compartido) | `js/datos/` (catálogo de 159 ejercicios, lesiones, constantes), `js/reglas/` (catálogo y seguridad, progresión, generador sin IA) | Barandillas que usan todas las áreas |

## Cómo se añade algo
- Cada área se registra sola en su `indice.js`: `rutas({...})`, `acciones({'area.accion': fn})`, `pestaña({...})`. Los botones usan `data-act="area.accion"`; los campos `data-cambio="area.accion"`.
- Datos: leer con `estado()`, cambiar con `cambiar(S => {...}, motivo)`. Si el motivo acaba en `-silencio` no se repinta (para campos de texto).
- La forma de una sesión y de un plan está en `js/nucleo/modelo.js`. Cambiarla afecta a todas las áreas: avisar al integrador.
- Si añades archivos, súmalos a `APP` en `sw.js`.
- **Tras cambiar cualquier archivo de la app, ejecuta `npm run version`** y sube el `sw.js` que cambia: `VERSION` es el hash de los archivos de `APP` (y del propio `sw.js`). No se toca a mano; si no coincide, `npm test` (y la CI) fallan.
- Nada de `<script>` en línea ni manejadores `on…=` nuevos en `index.html`: van a archivos (`js/arranque.js` es un script clásico que se carga antes que `main.js`), para la CSP.
- PR contra la rama `pipos-v2`, nunca contra `main`.

## Modo sin conexión y versiones
- `sw.js` guarda cada versión en su propia caché (`pipos-app-<hash>`), que solo se llena al instalarse, de golpe (`addAll`): si un archivo falla, la versión nueva no entra y sigue la anterior entera. Al pedir archivos se sirve lo de la caché de la versión activa y nunca se reescribe, así no se mezclan módulos viejos y nuevos. `/api/*` no se guarda. Solo la navegación a `./` o `./index.html` recibe el `index.html` guardado; cualquier otra URL va a la red.
- Al volver a primer plano la app pregunta si hay `sw.js` nuevo. Si lo hay, se instala y espera: aparece «Hay una versión nueva — Actualizar» y la versión nueva entra al tocarlo (recarga). No se recarga nunca sola y, con una sesión en curso, el aviso espera a que termine. Excepción: si la versión activa es de antes de este esquema (la de `main`), la nueva entra sin esperar.
- Si `main.js` no arranca en unos 6 s (o falla un módulo), `js/arranque.js` muestra «No se pudo actualizar: conéctate y vuelve a abrir» con un botón para recargar, en vez de dejar la pantalla en blanco.
- La versión activa se ve en **Perfil → Ajustes**.
- Las fuentes (Archivo y Outfit, subconjunto latino, licencia OFL en `fonts/`) se sirven desde el propio sitio.

## Probar en local
`python3 -m http.server 8765` y abrir `http://localhost:8765` (la IA necesita Vercel; sin ella la app usa las reglas).

## Pruebas
Requiere Node 24. Primero `npm ci`.
- `npm test`: pruebas unitarias y de pantalla con `node:test` (`tests/**/*.test.mjs`, en zona horaria de Madrid). Las de pantalla montan la app real en jsdom (`tests/ayuda/dom.mjs`); las de lógica usan un almacén en memoria (`tests/ayuda/node.mjs`, que inyecta `usarAlmacen` en `estado.js`).
- `npm run lint`: ESLint sobre `js/`, `api/`, `tests/` y `sw.js`.
- `npm run e2e`: Playwright en un móvil emulado (`tests/e2e/`): `humo.spec.mjs` (pestañas con y sin red) y `sw.spec.mjs` (instalación y arranque sin red, actualización con un archivo que falla, aviso de versión nueva, navegación a otras URL, vigilante de arranque y paso desde `main` y marcha atrás, con el `sw.js` de `main` copiado en `tests/e2e/legado/`). `sw.spec.mjs` levanta su propio servidor en el puerto 8783. Si ya tienes Chromium: `PW_CHROMIUM=/ruta/al/chromium npm run e2e`; si no, `npx playwright install chromium` antes.
- `tests/app-check.test.mjs` comprueba que la lista `APP` de `sw.js` coincide con los archivos reales y que no hay `import` rotos; `tests/version.test.mjs`, que `VERSION` está al día (si falla: `npm run version`).
- `npm run version`: recalcula `VERSION` en `sw.js`.

**Pruebas pendientes (`todo`).** Cada fallo que demostró la auditoría tiene una prueba que lo reproduce, marcada como `test('…', { todo: 'PR N: …' }, fn)` con el PR que lo arreglará. Un `todo` que falla no rompe `npm test`, pero se ve en el resumen (`# todo`). Cuando tu PR arregle el fallo, la prueba pasará: quítale el `todo` en ese mismo PR para que ya no pueda volver a romperse. La CI (`.github/workflows/ci.yml`) ejecuta todo esto en cada PR y en cada push a `pipos-v2`.
