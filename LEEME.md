# Pipos Fitness

App privada de entrenamiento de Víctor y Virginia. Cada uno usa su móvil y ve solo lo suyo; no hay datos compartidos ni backend propio. La nutrición irá en otra app.
PWA sin paso de compilación (HTML + módulos JS + CSS), alojada en Vercel. La IA va en funciones del servidor (`/api`), la clave nunca sale de Vercel.

## Variables en Vercel (Production y Preview)
- `ANTHROPIC_API_KEY`: clave de la API de Claude.
- `APP_CODE`: código de acceso; se escribe en la app en **Perfil → Ajustes del móvil**.

## Mapa por áreas

| Área | Archivos | Qué hace |
|---|---|---|
| **Núcleo** (integrador) | `index.html`, `js/main.js`, `js/nucleo/estado.js`, `js/nucleo/router.js`, `js/nucleo/ui.js`, `js/nucleo/api.js`, `js/nucleo/modelo.js`, `sw.js`, `manifest.webmanifest` | Arranque, datos y guardado, navegación, piezas de interfaz, llamadas al servidor, forma de sesión y plan, modo sin conexión |
| **Entrenador IA** | `js/areas/entrenador/` (`entrenador.js` lógica, `indice.js` check-in y plan), `api/entrenador.js`, `api/_comun.js`, `js/reglas/contexto.js` | Sesión de hoy y plan semanal con IA; si falla, reglas |
| **Perfil** | `js/areas/perfil/` (`indice.js`, `bienvenida.js`) | Objetivos, nivel, lesiones, disponibilidad, lugares, material, gustos, ajustes, copia |
| **Sesión** | `js/areas/sesion/` (`indice.js`, `temporizador.js`) | Hacer la sesión: series, descansos con alarma visual y vibración, tiempo, modo uno a uno, cambiar ejercicio, cierre |
| **Progreso** | `js/areas/progreso/indice.js` | Constancia, fuerza, medidas, dolor, historial |
| **Hoy** | `js/areas/hoy/indice.js` | Pantalla de inicio |
| **Ejercicios** | `js/areas/ejercicios/indice.js` | Catálogo, ficha técnica, me gusta / no me gusta / no lo quiero |
| **Aspecto** | `css/base.css`, `css/componentes.css`, `css/areas.css`, `icons/` | Colores, tipografía, componentes; color por persona en `--acc` |
| **Datos y reglas** (compartido) | `js/datos/` (catálogo de 159 ejercicios, lesiones, constantes), `js/reglas/` (catálogo y seguridad, progresión, generador sin IA) | Barandillas que usan todas las áreas |

## Cómo se añade algo
- Cada área se registra sola en su `indice.js`: `rutas({...})`, `acciones({'area.accion': fn})`, `pestaña({...})`. Los botones usan `data-act="area.accion"`; los campos `data-cambio="area.accion"`.
- Datos: leer con `estado()`, cambiar con `cambiar(S => {...}, motivo)`. Si el motivo acaba en `-silencio` no se repinta (para campos de texto).
- La forma de una sesión y de un plan está en `js/nucleo/modelo.js`. Cambiarla afecta a todas las áreas: avisar al integrador.
- Si añades archivos, súmalos a `APP` en `sw.js` y sube `VERSION`.
- PR contra la rama `pipos-v2`, nunca contra `main`.

## Probar en local
`python3 -m http.server 8765` y abrir `http://localhost:8765` (la IA necesita Vercel; sin ella la app usa las reglas).
