# Nutrición · Pipos Fitness

Sección de nutrición, separada del entreno. Pensada para integrarse en la base nueva de la app; mientras tanto se prueba en `/nutricion/`.

## Piezas
- `core.js`: todo lo que no es pantalla, sin dependencias (queda en `globalThis.NutriCore`).
  - Modelo de datos (`vacio()`, `completar()`): `hogar` (alergias, no gusta, gusta, lo que hay en casa, minutos para cocinar, batch del domingo, platos de otras cocinas), `personas.him|her` (año de nacimiento, actividad fuera del entreno, comidas al día, ajuste manual de kcal, alergias y gustos propios, turnos), `menus[lunes]` (menú, objetivos, lista de la compra marcada) y `valoraciones` de recetas.
  - Objetivos de cada persona (`objetivosPersona`): metabolismo basal (Katch-McArdle si hay % de grasa, si no Mifflin-St Jeor), actividad, gasto de cada sesión, ajuste por objetivo (varios a la vez: perder + músculo = recomposición), corrección automática según la tendencia del peso de las últimas 4 semanas, proteína, grasa, hidratos, fibra y agua, para día de entreno y de descanso. Devuelve también el texto «cómo se calcula».
  - Turnos (`turnoSemana`, `comidasEnTrabajo`): alternan cada semana desde una semana de referencia; se puede cambiar una semana suelta.
  - `peticionMenu`: arma lo que recibe el agente. `listaCompra`: suma las raciones de cada uno de toda la semana por sección del súper y separa lo que ya hay en casa.
- `../api/nutricion.js`: el agente (dietista-nutricionista deportivo, dieta mediterránea). Modo `menu` (semana completa) y modo `plato` (cambiar un plato). Modelo `claude-opus-5-5` con esfuerzo bajo; se puede cambiar con la variable `NUTRI_MODEL`.
- `../api/video.js`: busca en YouTube el vídeo de cada receta y comprueba que existe (oEmbed). Si no encuentra, devuelve el enlace a la búsqueda.
- `index.html` + `app.js`: pantallas mínimas de prueba (Menú, Compra, Tupper, Ajustes). Lee peso, altura y objetivo de la app de entreno si está en el mismo dominio; si faltan, se escriben en Ajustes.

## Datos compartidos
Hoy se guarda en `localStorage` (`pipos-nutricion`). Lo común a los dos es `hogar`, `menus` y `valoraciones`; eso es lo que se sincronizará entre los dos móviles.
