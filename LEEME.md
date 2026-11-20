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
| **Núcleo** (integrador) | `index.html`, `js/arranque.js`, `js/main.js`, `js/nucleo/estado.js`, `js/nucleo/espejo.js`, `js/nucleo/rescate.js`, `js/nucleo/normalizar.js`, `js/nucleo/migracion.js`, `js/nucleo/router.js`, `js/nucleo/ui.js`, `js/nucleo/api.js`, `js/nucleo/modelo.js`, `js/nucleo/version.js`, `sw.js`, `scripts/version.mjs`, `manifest.webmanifest` | Arranque y vigilante de arranque, datos y guardado (con espejo en IndexedDB y pantalla de rescate), copias validadas y migración de la app anterior, navegación, piezas de interfaz, llamadas al servidor, forma de sesión y plan, modo sin conexión y aviso de versión nueva |
| **Entrenador IA** | `js/areas/entrenador/` (`entrenador.js` fachada de la lógica: `dia.js` sesión con reglas, `plan.js` semana, `checkin.js` ajuste al check-in, `ia.js` puente con la IA, `validar.js` validador; `indice.js` check-in y plan), `api/entrenador.js`, `api/_comun.js`, `js/reglas/contexto.js` | Sesión de hoy y plan semanal con IA; si falla, reglas |
| **Perfil** | `js/areas/perfil/` (`indice.js`, `bienvenida.js`) | Objetivos, nivel, lesiones, disponibilidad, lugares, material, gustos, ajustes, copia |
| **Sesión** | `js/areas/sesion/` (`indice.js`, `temporizador.js`) | Hacer la sesión: series, descansos con alarma visual y vibración, tiempo, modo uno a uno, cambiar ejercicio, cierre |
| **Progreso** | `js/areas/progreso/indice.js` | Constancia, fuerza, medidas, dolor, historial |
| **Hoy** | `js/areas/hoy/indice.js` | Pantalla de inicio |
| **Ejercicios** | `js/areas/ejercicios/indice.js` | Catálogo, ficha técnica, me gusta / no me gusta / no lo quiero |
| **Aspecto** | `css/base.css`, `css/componentes.css`, `css/areas.css`, `icons/`, `fonts/`, `js/aspecto/` | Colores, tipografía, componentes, movimiento y confeti; color por persona en `--acc` |
| **Datos y reglas** (compartido) | `js/datos/` (catálogo de 159 ejercicios, lesiones, constantes), `js/reglas/` (catálogo y seguridad, progresión, contexto para la IA) | Barandillas que usan todas las áreas |

## Cómo se añade algo
- Cada área se registra sola en su `indice.js`: `rutas({...})`, `acciones({'area.accion': fn})`, `pestaña({...})`. Los botones usan `data-act="area.accion"`; los campos `data-cambio="area.accion"`.
- Datos: leer con `estado()`, cambiar con `cambiar(S => {...}, motivo)`. Si el motivo acaba en `-silencio` no se repinta (para campos de texto).
- Guardado: `pipos4` es el almacén principal y su forma no cambia; lo demás va aparte (`pipos4-rev` revisión entre pestañas, `pipos4-roto-<fecha>` datos ilegibles apartados, `pipos4-conflicto`, `pipos4-copia` fecha de la última copia, `pipos4-antes-de-importar` lo que había antes de cargar una copia) y un espejo en IndexedDB (`pipos-espejo`). Si `pipos4` no se puede leer, la app enseña la pantalla de rescate y no escribe nada hasta que la persona elija.
- Copias: «Guardar copia» exporta el estado sin el código de acceso (lleva datos de salud: se avisa); en un iPhone con la app instalada, o si no se puede descargar, se comparte con `navigator.share`. «Cargar copia» pasa siempre por `importar()` (`js/nucleo/estado.js`): el normalizador (`js/nucleo/normalizar.js`) reconstruye el estado (tipos, rangos, zonas conocidas, ids `^[\w-]+$`, fechas, textos recortados, sin claves desconocidas), se prueba a pintar todas las pantallas con los datos nuevos (rutas con `probar()`), lo de antes queda en `pipos4-antes-de-importar` («Volver a ellos» o «Descartar» en Ajustes; caduca a los 7 días; en el rescate guarda la copia interna del espejo), si el móvil no acepta los datos nuevos no se carga nada, las copias de más de 10 MB se rechazan, nunca entra el código de la copia y una copia de la otra persona pide confirmación. También acepta copias v3 de la app anterior.
- Migración de la app anterior (`js/nucleo/migracion.js`): `elplan2` no se borra nunca y se relee en cada arranque; lo ya migrado se apunta en `S.migracion.claves` (claves sacadas de los datos viejos), así que es idempotente y tras una marcha atrás a `main` trae solo lo nuevo. Cambiar de dueño aparta lo migrado de la otra persona (con sus cambios, y su sexo, altura y nacimiento) en `S.migracion.porDueño` y lo repone si se vuelve; lo hecho en esta app se queda; lo apartado no sale en las copias. Para datos de la versión con fallos, todo lo del dueño en `elplan2` hasta lo último emparejado cuenta como ya migrado (no resucita lo borrado). `S.migracion.version` 1 = migrado con la versión con fallos: se corrige una vez (sexo cruzado; si no se puede saber, se pregunta en Perfil). Las lesiones migradas llevan `dolorRevisar` (dolor estimado = gravedad × 3).
- Toda plantilla escapa con `h()` lo que venga del estado, o lo fuerza a número con `+x`.
- La URL de la API es siempre relativa (`/api/…`); ya no existe `ajustes.apiUrl`.
- La forma de una sesión y de un plan está en `js/nucleo/modelo.js`. Cambiarla afecta a todas las áreas: avisar al integrador.
- Si añades archivos, súmalos a `APP` en `sw.js`.
- **Tras cambiar cualquier archivo de la app, ejecuta `npm run version`** y sube el `sw.js` que cambia: `VERSION` es el hash de los archivos de `APP` (y del propio `sw.js`), y el script escribe también `HUELLAS` en `sw.js` y la `VERSION` en la meta de `index.html`. No se tocan a mano; si no coinciden, `npm test` (y la CI) fallan. Todo archivo que sirva el sitio tiene que estar en `APP` o en la lista `FUERA_DE_APP` de `tests/app-check.test.mjs`.
- Nada de `<script>` en línea ni manejadores `on…=` nuevos en `index.html`: van a archivos (`js/arranque.js` es un script clásico que se carga antes que `main.js`), para la CSP.
- PR contra la rama `pipos-v2`, nunca contra `main`.

## Modo sin conexión y versiones
- `sw.js` guarda cada versión en su propia caché (`pipos-app-<hash>`), que solo se llena al instalarse y de golpe: descarga todo `APP`, comprueba cada archivo contra su huella SHA-256 (`HUELLAS`) y solo entonces lo guarda. Si un archivo falla o es de otro despliegue (un despliegue nuevo a mitad de la descarga), la versión nueva no entra y sigue la anterior entera. `index.html` vale también si lleva `<meta name="pipos-version">` con su `VERSION`, porque Vercel le inyecta su barra en las vistas previas.
- Al pedir archivos se sirve lo de la caché de la versión activa y nunca se reescribe, así no se mezclan módulos viejos y nuevos. Por eso no se usa `import()` dinámico en `js/` (una prueba lo prohíbe). `/api/*` no se guarda. Solo la navegación a `./` o `./index.html` recibe el `index.html` guardado; cualquier otra URL va a la red.
- Al activarse, la versión nueva borra las demás cachés, también las de `main` (`elplan-v3.3.0` y `elplan-v3.3.0-ext`). Las miniaturas de YouTube ya no se guardan: sin red no se ven.
- Al volver a primer plano la app pregunta si hay `sw.js` nuevo. Si lo hay, se instala y espera: aparece «Hay una versión nueva — Actualizar» y la versión nueva entra al tocarlo (recarga). Con una sesión en curso, el aviso espera a que termine. Excepción: si la versión activa es de antes de este esquema (la de `main`), la nueva entra sin esperar.
- Cuando una versión nueva entra desde una pestaña, las demás se enteran (BroadcastChannel `pipos-version`): sin sesión en curso se recargan; con sesión, lo avisan y se recargan al terminarla.
- Vigilante de arranque (`js/arranque.js`): si `main.js` no arranca en unos 6 s (o falla un módulo), con un service worker que controla la página y una red que de verdad sirve la app (lo comprueba pidiendo `index.html` sin pasar por el service worker, máximo 4,5 s) borra las cachés `pipos-app-*`, da de baja el service worker y recarga desde la red (una vez por pestaña). Si no se puede, muestra «No se pudo actualizar: conéctate y vuelve a abrir» con «Volver a intentar» (que activa la versión en espera, si la hay). Si la app aún no está instalada (primera vez o paso desde `main`), primero dice «Sigue cargando…» y espera hasta 20 s.
- La versión de la app se ve en **Perfil → Ajustes**.
- Las fuentes (Archivo y Outfit, subconjunto latino, licencia OFL en `fonts/`) se sirven desde el propio sitio.

## Probar en local
`python3 -m http.server 8765` y abrir `http://localhost:8765` (la IA necesita Vercel; sin ella la app usa las reglas).

## Pruebas
Requiere Node 24. Primero `npm ci`.
- `npm test`: pruebas unitarias y de pantalla con `node:test` (`tests/**/*.test.mjs`, en zona horaria de Madrid). Las de pantalla montan la app real en jsdom (`tests/ayuda/dom.mjs`); las de lógica usan un almacén en memoria (`tests/ayuda/node.mjs`, que inyecta `usarAlmacen` en `estado.js`).
- `npm run lint`: ESLint sobre `js/`, `api/`, `tests/` y `sw.js`.
- `npm run e2e`: Playwright en un móvil emulado (`tests/e2e/`): `humo.spec.mjs` (pestañas con y sin red) y `sw.spec.mjs` (instalación y arranque sin red, actualización con un archivo que falla, despliegue a mitad de la instalación, caché estropeada, aviso de versión nueva, dos pestañas, navegación a otras URL, vigilante de arranque y paso desde `main` y marcha atrás, con el `sw.js` de `main` copiado en `tests/e2e/legado/`). `sw.spec.mjs` levanta su propio servidor en el puerto 8783. Si ya tienes Chromium: `PW_CHROMIUM=/ruta/al/chromium npm run e2e`; si no, `npx playwright install chromium` antes.
- `tests/app-check.test.mjs` comprueba que la lista `APP` de `sw.js` coincide con los archivos reales y que no hay `import` rotos; `tests/version.test.mjs`, que `VERSION`, `HUELLAS` y la meta de `index.html` están al día (si falla: `npm run version`).
- `npm run version`: recalcula `VERSION` y `HUELLAS` en `sw.js` y la meta de `index.html`.

**Pruebas pendientes (`todo`).** Cada fallo que demostró la auditoría tiene una prueba que lo reproduce, marcada como `test('…', { todo: 'PR N: …' }, fn)` con el PR que lo arreglará. Un `todo` que falla no rompe `npm test`, pero se ve en el resumen (`# todo`). Cuando tu PR arregle el fallo, la prueba pasará: quítale el `todo` en ese mismo PR para que ya no pueda volver a romperse. La CI (`.github/workflows/ci.yml`) ejecuta todo esto en cada PR y en cada push a `pipos-v2`.
