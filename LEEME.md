# El Plan · versión 3

App privada de entrenamiento para Víctor y Virginia. La versión anterior (`../index.html`) no se ha tocado.

## Qué hay
- `index.html`, `css/`, `js/`: la app (sin compilar, abre tal cual).
  - `js/ejercicios.js`: catálogo de 159 ejercicios (pasos, errores, vídeo, músculos, lugar, material, riesgo por lesión). Todo lo demás lee de aquí.
  - `js/plan.js`: el plan semanal de cada uno. Para cambiar un día, cambia la lista `[id, series, reps, descanso]`.
  - `js/logic.js`: ajuste por dolor, lesiones y cansancio; generador sin IA; cálculos corporales.
  - `js/progresion.js`: sobrecarga progresiva. Con lo apuntado (kilos, reps, tiempo, esfuerzo, dolor) propone el peso, las reps, el tiempo o las series de hoy. Lo usan el plan semanal, el generador sin IA y la IA (recibe el historial y esta propuesta como punto de partida).
    También mide la recuperación de cada músculo (grandes ~72 h, pequeños ~48 h, core ~24 h): en el plan quita una serie y no sube peso en los músculos sin recuperar y propone otro día si casi toda la sesión los carga; el generador sin IA los deja descansar; la IA recibe `recuperacion` y `ultimasSesiones`.
- Perfil → «Mi entrenamiento»: perfil guardado de cada uno (objetivo principal, nivel, lugar, tiempo, días, músculos a priorizar, material de casa). El generador y la IA parten de él; en el plan semanal el objetivo ajusta descansos (y añade cardio al final si es perder peso).
- `js/logros.js`: racha, XP y niveles, los 13 logros y los 4 de pareja (las mismas reglas que la versión original; cuentan también las sesiones importadas de ella). Se ven en Hoy y en Progreso → Juntos.
- Durante la sesión: «Modo entreno» (un ejercicio cada vez, con anterior / siguiente) y «Repetir última» (copia kilos y reps de la última vez que hiciste ese día). En Perfil → Entreno se puede quitar el check-in para empezar con un toque; en Hoy también está «Empezar ya, sin preguntas».
- Los ejercicios de máquina muestran el modelo BH de vuestro gimnasio (M090, M410…).
- Pestañas: Hoy, Ejercicios, Progreso, Dolor (dolor diario y lesiones) y Perfil. La Guía tiene página propia (desde Hoy y Perfil).
- `pasar-datos.html`: para traer de la versión anterior también peso, medidas, lesiones, perfil y fotos (su copia solo guarda sesiones y dolor). Se sube junto al index.html de la versión anterior, se abre en el mismo navegador y descarga una copia completa que aquí se importa.
- `api/rutina.js`: el agente de rutinas (función de Vercel con la API de Claude).
- `manifest.webmanifest`, `sw.js`, `icons/`: instalable y funciona sin conexión.

## Publicar en Vercel
1. Sube esta carpeta a un repositorio de GitHub y conéctalo a Vercel (sin comando de build).
2. En Vercel → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY`: tu clave de la API de Claude (console.anthropic.com).
   - `APP_CODE`: un código cualquiera; luego lo pones en la app, en Perfil → Agente de rutinas.
3. Sin clave la app funciona igual; «Crear con IA» usa entonces las reglas de la app.

## Pasar los datos
En la versión anterior: Perfil → Exportar. En esta: Perfil → Importar. Si las dos están en el mismo dominio, se pasan solas al abrir la nueva.
La versión anterior solo exporta sesiones y dolor: el peso y las medidas hay que volver a apuntarlos (o abrir la nueva en el mismo dominio).
