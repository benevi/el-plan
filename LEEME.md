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
| **Núcleo** (integrador) | `index.html`, `js/main.js`, `js/nucleo/estado.js`, `js/nucleo/espejo.js`, `js/nucleo/rescate.js`, `js/nucleo/router.js`, `js/nucleo/ui.js`, `js/nucleo/api.js`, `js/nucleo/modelo.js`, `sw.js`, `manifest.webmanifest` | Arranque, datos y guardado (con espejo en IndexedDB y pantalla de rescate), navegación, piezas de interfaz, llamadas al servidor, forma de sesión y plan, modo sin conexión |
| **Entrenador IA** | `js/areas/entrenador/` (`entrenador.js` lógica, `indice.js` check-in y plan), `api/entrenador.js`, `api/_comun.js`, `js/reglas/contexto.js` | Sesión de hoy y plan semanal con IA; si falla, reglas |
| **Perfil** | `js/areas/perfil/` (`indice.js`, `bienvenida.js`) | Objetivos, nivel, lesiones, disponibilidad, lugares, material, gustos, ajustes, copia |
| **Sesión** | `js/areas/sesion/` (`indice.js`, `temporizador.js`) | Hacer la sesión: series, descansos con alarma visual y vibración, tiempo, modo uno a uno, cambiar ejercicio, cierre |
| **Progreso** | `js/areas/progreso/indice.js` | Constancia, fuerza, medidas, dolor, historial |
| **Hoy** | `js/areas/hoy/indice.js` | Pantalla de inicio |
| **Ejercicios** | `js/areas/ejercicios/indice.js` | Catálogo, ficha técnica, me gusta / no me gusta / no lo quiero |
| **Aspecto** | `css/base.css`, `css/componentes.css`, `css/areas.css`, `icons/`, `js/aspecto/` | Colores, tipografía, componentes, movimiento y confeti; color por persona en `--acc` |
| **Datos y reglas** (compartido) | `js/datos/` (catálogo de 159 ejercicios, lesiones, constantes), `js/reglas/` (catálogo y seguridad, progresión, generador sin IA) | Barandillas que usan todas las áreas |

## Cómo se añade algo
- Cada área se registra sola en su `indice.js`: `rutas({...})`, `acciones({'area.accion': fn})`, `pestaña({...})`. Los botones usan `data-act="area.accion"`; los campos `data-cambio="area.accion"`.
- Datos: leer con `estado()`, cambiar con `cambiar(S => {...}, motivo)`. Si el motivo acaba en `-silencio` no se repinta (para campos de texto).
- Guardado: `pipos4` es el almacén principal y su forma no cambia; lo demás va aparte (`pipos4-rev` revisión entre pestañas, `pipos4-roto-<fecha>` datos ilegibles apartados, `pipos4-conflicto`, `pipos4-copia` fecha de la última copia) y un espejo en IndexedDB (`pipos-espejo`). Si `pipos4` no se puede leer, la app enseña la pantalla de rescate y no escribe nada hasta que la persona elija.
- La forma de una sesión y de un plan está en `js/nucleo/modelo.js`. Cambiarla afecta a todas las áreas: avisar al integrador.
- Si añades archivos, súmalos a `APP` en `sw.js` y sube `VERSION`.
- PR contra la rama `pipos-v2`, nunca contra `main`.

## Probar en local
`python3 -m http.server 8765` y abrir `http://localhost:8765` (la IA necesita Vercel; sin ella la app usa las reglas).

## Pruebas
Requiere Node 24. Primero `npm ci`.
- `npm test`: pruebas unitarias y de pantalla con `node:test` (`tests/**/*.test.mjs`, en zona horaria de Madrid). Las de pantalla montan la app real en jsdom (`tests/ayuda/dom.mjs`); las de lógica usan un almacén en memoria (`tests/ayuda/node.mjs`, que inyecta `usarAlmacen` en `estado.js`).
- `npm run lint`: ESLint sobre `js/`, `api/`, `tests/` y `sw.js`.
- `npm run e2e`: prueba de humo con Playwright en un móvil emulado, con y sin red (`tests/e2e/`). Si ya tienes Chromium: `PW_CHROMIUM=/ruta/al/chromium npm run e2e`; si no, `npx playwright install chromium` antes.
- `tests/app-check.test.mjs` comprueba que la lista `APP` de `sw.js` coincide con los archivos reales y que no hay `import` rotos.

**Pruebas pendientes (`todo`).** Cada fallo que demostró la auditoría tiene una prueba que lo reproduce, marcada como `test('…', { todo: 'PR N: …' }, fn)` con el PR que lo arreglará. Un `todo` que falla no rompe `npm test`, pero se ve en el resumen (`# todo`). Cuando tu PR arregle el fallo, la prueba pasará: quítale el `todo` en ese mismo PR para que ya no pueda volver a romperse. La CI (`.github/workflows/ci.yml`) ejecuta todo esto en cada PR y en cada push a `pipos-v2`.
