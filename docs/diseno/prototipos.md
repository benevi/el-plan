# DIS 4 · Prototipos navegables

Cuarta entrega de la fase D. La app entera en prototipo, construida **solo** con el sistema de DIS 3 (`prototipos/sistema/`: tokens, componentes y gráficos) y la identidad elegida (**Carril 2 + Trenza**), con datos de ejemplo realistas de Víctor y de Virginia. Las pantallas reflejan lo que la app ya hace hoy en `pipos-v2`; lo que no existe todavía está marcado abajo como **nuevo, requiere lógica**.

**Estado:** primera ronda, pendiente de revisión pantalla a pantalla (hasta tres rondas). Sin la aprobación de Víctor no se implementa nada de la fase 5.

**Dónde verlo:** `/prototipos/app/` en la vista previa de `diseno-prototipos` (con la barra final). El botón **«Prototipo»** de arriba a la derecha abre el mapa: persona (Víctor / Virginia) y un enlace a cada pantalla y estado. Cada estado tiene su dirección (`?p=virginia&e=alarma#sesion`), así se puede mandar un enlace a una pantalla concreta para comentarla. Nada se guarda: al recargar vuelve a empezar.

**Archivos**

| Ruta | Qué es |
|---|---|
| `prototipos/app/index.html`, `app.js`, `app.css` | El prototipo. `app.css` solo coloca piezas; todo lo visual sale de `../sistema/` |
| `prototipos/app/datos.js` | Datos de ejemplo (hoy = sábado 21 de noviembre de 2026) y textos fijos copiados de la app (avisos de salud, señales, tipos de lesión, objetivos…) |
| `prototipos/app/catalogo.js` | 30 ejercicios **extraídos del catálogo real** de `pipos-v2` con sus fichas (pasos, errores, consejo), generado con `herramientas/catalogo.mjs` |
| `prototipos/app/estados.js` | Mapa de pantallas y estados (lo usan el menú y las comprobaciones) |
| `prototipos/app/comprobar.mjs` | Comprobaciones y capturas; escribe la tabla del apartado 6 |
| `prototipos/app/capturas/` | Captura de cada pantalla y estado, de Víctor y de Virginia, a 390 × 844 (escala 2) |

---

## 1. Recorrido completo

Del estudio de uso (DIS 1, momentos M1-M13) al prototipo. Entrada habitual: el icono de la pantalla de inicio → **Hoy**.

```
[Primera vez] ── Bienvenida (¿de quién es este móvil?) ── Perfil ── Hoy (sin plan) ── Montar mi semana ──┐
[Icono] ── Hoy ─┬─ (hoy toca) Empezar ── Antes de empezar (check-in) ─┬─ reglas ────────────────────────┐ │
               │                                                      └─ IA: espera ─┬─ lista ─────────┤ │
               │                                                                     ├─ Cancelar ──────┤ │
               │                                                                     └─ falla ── nota «La ha hecho la app» + Reintentar con IA
               ├─ (descanso) Entrenar igualmente ─────────────────────────────────────────────────────┘ │
               ├─ (en marcha) Seguir con la sesión                                                       │
               └─ (ayer sin cerrar) Cerrar la de ayer / Descartarla                                      │
Sesión ── Calentamiento ── Ejercicio n: serie ── Serie n hecha ── Descanso (barra) ── Alarma ── … ── Vuelta a la calma
   │            ├─ Cómo se hace (ficha)        ├─ por tiempo / cardio: contador a pantalla completa
   │            └─ Menú: cambiar, ± serie, me gusta / no me gusta / no lo quiero, comentario
   └─ Terminar ─┬─ (pendientes) «Te quedan n series» ── Seguir / Terminar igual
                └─ ¿Qué tal ha ido? (esfuerzo, dolor, comentario) ── Guardar sesión ── Final (el agua sube) ── Hoy (hecha)
Noche / en casa: Progreso (constancia, fuerza, salud, dolor) · Perfil (objetivos, lesiones, salud, entreno, datos, copias, ajustes) · Ejercicios
```

| Paso | Pantalla | Qué hace la persona | Qué responde la app | Emoción probable (HIP de DIS 1) | Fricción y cómo se resuelve |
|---|---|---|---|---|---|
| M2 | Hoy | Mira qué toca y cuánto dura | Tarjeta «Hoy toca» con lugar, ejercicios y minutos; la semana arriba | Prisa | Todo en 1 s: nombre, lugar y minutos; el botón, abajo |
| M4-M5 | Antes de empezar | Ajusta energía, dolor, tiempo, lugar | Vista previa en vivo de lo que cambia, sin saltar de sitio (R15) | Decidir cómo viene el día | Un toque por control; nada abre el teclado salvo la petición |
| M5 | Espera de la IA | Espera o cancela | Pasos marcados, tiempo y «Cancelar y hacerla con la app» | Impaciencia | Nunca se queda colgada: se puede salir siempre |
| M6 | Sesión, serie actual | Marca la serie | Un toque con los mismos kilos (R04); los kilos y repeticiones pasan a la siguiente (R05) | Esfuerzo | Cifras de 56 px; botón de 56 px en el tercio inferior |
| M7 | Descanso | Mira el reloj | Barra abajo que no tapa la serie (R09); alarma con tres vibraciones | Recuperar | Si bloquea el móvil, al volver dice cuánto hace que acabó |
| M8 | Cambiar ejercicio | Busca alternativa | Lista del mismo músculo con lo que hay; conserva lo hecho y lo dice (R17) | Fastidio | Dos toques: menú → alternativa |
| M9 | Contador | Bici o plancha | Pantalla completa, cifra de 96 px, el agua sube con el tiempo | Rutina | Se lee desde el suelo o la máquina |
| M12 | Terminar | Cierra | Aviso de lo que falta; esfuerzo, dolor y comentario; final con el agua | Satisfacción, prisa | «Terminar igual» guarda lo hecho |
| M13 | Progreso, Perfil | Revisa | Gráficos con burbuja y tabla; perfil por grupos | Curiosidad | Un grupo cada vez |

**Momentos de satisfacción:** los kilos que ya están puestos en la serie siguiente; la serie recién marcada con su onda; el final con el agua que sube y las cifras que fluyen; las semanas que se llenan en Progreso.

**Caminos de error:** IA que no responde (nota «La ha hecho la app porque…» con «Reintentar con IA»), sin conexión (aviso en Hoy y en el check-in; todo funciona menos la IA), sesión de ayer sin cerrar, señal de alarma en el check-in («Hoy no toca entrenar»), filtros sin resultados en Ejercicios («Quitar filtros»), Progreso vacío (con «Ir a Hoy» y «Apuntar mis medidas de hoy»).

## 2. Pantallas y estados

Patrón de cada pantalla (guía `page-patterns`): **Hoy** = Dashboard (un vistazo y una acción); **Antes de empezar** = Formulario; **Sesión** = Detalle con su tarea; **Progreso** = Dashboard; **Perfil** = Ajustes por grupos; **Ejercicios** = Lista con búsqueda y filtros (la ficha, en hoja inferior). Las tareas cortas (cambiar ejercicio, comentario, lesión, medidas, montar la semana) van en hoja inferior (guía `surfaces`).

| Pantalla | Estados del prototipo |
|---|---|
| Hoy | Con plan · Primera vez · Sin plan esta semana · Día de descanso · Sesión en marcha · Sesión de ayer sin cerrar · Sin conexión · Sesión hecha. La tira de la semana va **arriba**, debajo del saludo, y el botón fijo de abajo nunca la tapa (en Carril 2 la tapaba) |
| Antes de empezar | Qué sesión (la del plan o una de **Mis sesiones**, con «Cuenta como el día … del plan»), dónde, tiempo, energía, dolor por zona (selector ±), ¿te duele algo más?, «Hoy noto algo de esto» con «Qué cuenta», algo que pedir, vista previa en vivo y «Pedírsela igualmente al entrenador IA» · Espera de la IA (pasos, tiempo, «Cancelar y hacerla con la app») · Fallo de la IA (nota en la sesión con «Reintentar con IA») · Sin conexión |
| Sesión | Uno a uno · Toda la sesión · Ejercicio por tiempo (con lados) · Cardio · Cómo se hace (ficha) · Menú del ejercicio (me gusta / no me gusta / no lo quiero, ± serie, comentario) · Cambiar ejercicio · Guardar como mía · Terminar con series pendientes · Cierre · Final · Sesión hecha en modo lectura |
| Descanso | Barra (−15, +15, Saltar; «Prepárate» en los últimos 10 s) · Alarma de fin (color de la persona, tres vibraciones, se cierra sola a los 8 s) · Vuelta tras bloquear el móvil («El descanso terminó hace 0:40») · Siguiente serie siempre visible |
| Progreso | Vacío · Primera semana · Un año de datos: constancia (8 semanas y sesiones por mes), nivel y criterios, fuerza (mediana, gráfico y ejercicios), salud (peso, cintura, cintura/altura, cardio de 7 días), dolor (Virginia) y últimas sesiones · Apuntar medidas |
| Perfil | Objetivos y nivel · Lesiones (alta y edición) · Salud · Mi entreno (días, minutos, lugares, material, Mis sesiones, valoraciones, uso de la IA) · Mis datos · Copias en la nube · Ajustes (código de acceso, vibrar, pitido, copia en archivo, versión) |
| Bienvenida y Ejercicios | Bienvenida · Ejercicios (búsqueda y filtros por lugar, músculo y valoración) · Ficha de un ejercicio |

## 3. Qué refleja de la app y qué es nuevo

Revisado contra `js/areas/` de `pipos-v2` (PR #34 incluido). **Igual**: lo que la app ya hace, con el aspecto nuevo. **Cambia la forma**: la misma función y los mismos datos, presentados de otra manera (solo interfaz). **Nuevo, requiere lógica**: no existe en la app y hace falta programarlo en la fase 5.

| Qué | Estado | Detalle |
|---|---|---|
| Hoy: sin perfil, sin plan, hoy toca, descanso («Entrenar igualmente»), en marcha («Seguir»), hecha, «Hacer una de mis sesiones» | Igual | Mismos textos que `hoy/indice.js` |
| Tu semana: días, «Por qué esta semana», «Cambiar días», «Hoy no puedo», «Reorganizar lo que queda», ver un día | Igual | `entrenador/indice.js` |
| Tira de la semana con fecha, ✓, ×, anillo y discontinuo | Cambia la forma | La app pinta letras y puntos |
| Check-in en pantalla propia (en la app es una hoja) | Cambia la forma | Más de 10 s y muchos campos: guía `surfaces` |
| Check-in: dolor con selector ± (la app usa un deslizador) y casillas como chips | Cambia la forma | Sin teclado y con 48 px |
| Vista previa en vivo, Mis sesiones en el check-in, «Pedírsela igualmente a la IA», señales de alarma | Igual | `checkin.js`; los cambios de la vista previa del prototipo son de ejemplo |
| Espera de la IA con pasos marcados | Cambia la forma | La app ya tiene fases y tiempo; aquí se ven como pasos |
| Nota «La ha hecho la app porque…» con «Reintentar con IA» | Igual | `notaFallo` |
| **Selector ± de kilos y repeticiones** (la app usa campos con teclado) | **Nuevo, requiere lógica** | Paso por máquina (1, 2,5 o 5 kg): dato nuevo en el catálogo o en el perfil (R04) |
| **Kilos y repeticiones de la serie hecha pasan a la siguiente** | **Nuevo, requiere lógica** | La app rellena con los kilos objetivo, no con lo hecho (R05) |
| Serie actual destacada con «Serie n hecha»; las demás en una línea | Cambia la forma | La app tiene un botón de marcar por fila |
| Uno a uno / Toda la sesión, pasos C-1-…-V, calentamiento y vuelta con casillas, «Cómo se hace» plegable, menú del ejercicio, cambiar ejercicio, ± serie, comentario, «Guardar como mía», descartar | Igual | `sesion/indice.js` |
| Me gusta / No me gusta / No lo quiero con iconos (la app usa emojis) | Cambia la forma | Iconos del sistema, con texto |
| Vídeo de la ficha (YouTube) | Igual en la app | No está en el prototipo porque no puede cargar nada de fuera; la app lo mantiene |
| **«Te quedan n series» al terminar** | **Nuevo, requiere lógica** | La app abre el cierre directamente (R17) |
| Cierre: esfuerzo 1-5, dolor ahora por zona, comentario, «Guardar sesión» | Igual | Dolor con selector ± en lugar de deslizador |
| **Final de sesión** (agua, series, minutos, kilos movidos, mejor serie) | **Nuevo, requiere lógica** | La app solo avisa «¡Sesión guardada!». Hace falta calcular kilos movidos y detectar la mejor serie del día |
| Descanso: −15, +15, Saltar; cuenta con la hora real y sigue tras bloquear el móvil | Igual | `temporizador.js` |
| **Alarma en la barra que se cierra sola a los 8 s, con tres vibraciones** | **Nuevo, requiere lógica** | La app abre una alarma a pantalla completa que parpadea hasta tocarla y vibra hasta 12 veces. Decisión de Víctor (21-11-2026): tres toques. R08 |
| «Prepárate» en los últimos 10 s | Cambia la forma | La app marca los últimos 5 s |
| Contador a pantalla completa: 5 s para colocarse, aguanta, mínimo hecho, objetivo superado, lados, pausa, cancelar sin apuntar | Igual | Solo para ejercicios por tiempo y cardio (decisión del 21-11-2026); el agua que sube es nueva, solo aspecto |
| **Sesión de ayer sin cerrar en Hoy** («Cerrar la de ayer» / «Descartarla») | **Nuevo, requiere lógica** | La app no la enseña al día siguiente (R20) |
| Aviso «Sin conexión» en Hoy | Cambia la forma | La app ya avisa en la cabecera y en el check-in |
| Progreso: constancia, nivel y criterios, fuerza (mediana, récords, ejercicios), salud (peso, cintura, cintura/altura, cardio 7 días), dolor, últimas sesiones, «Apuntar medidas», vacío | Igual | `progreso/indice.js` |
| Constancia en vasos de 8 semanas | Cambia la forma | La app usa barras por semana con la línea del objetivo |
| **Sesiones por mes del último año** | **Nuevo, requiere lógica** | Agregar por meses lo que ya hay |
| **Gráfico de fuerza en la página de Progreso** | **Nuevo, requiere lógica** | La app lo tiene en la hoja de cada ejercicio; aquí se elige el ejercicio principal |
| **Burbuja al tocar y «Ver como tabla» en todos los gráficos** | **Nuevo, requiere lógica** | Lo pide la guía `dataviz` |
| Dolor en barras por mes | Cambia la forma | La app pinta un punto por registro |
| Perfil por grupos (objetivos, lesiones, salud, mi entreno, datos, copias, ajustes) y todo su contenido | Igual | `perfil/indice.js`, `salud.js`, `nube.js` |
| Lesión: zona en chips, dolor con ±, tipo en segmento (la app usa desplegable y deslizador) | Cambia la forma | |
| Borrar lesión o una de Mis sesiones con confirmación que nombra lo que se borra | **Nuevo, requiere lógica** (pequeña) | La app borra sin preguntar (guía `surfaces`) |
| Texto del código de acceso: «El mismo que te ha dado Víctor…» (la app dice «APP_CODE en Vercel») | Cambia la forma | Sin jerga (R22) |
| «Que me la monte el entrenador IA» sin red: se queda enfocable y dice por qué (la app lo desactiva) | Cambia la forma | Guía de formularios: nada desactivado sin motivo |
| Cambio de pantalla con eje horizontal y movimiento del sistema | **Nuevo** (solo interfaz) | Presupuesto de DIS 3 |
| Bienvenida | Igual | `perfil/bienvenida.js` |
| Ejercicios: búsqueda, filtros por lugar, músculo y valoración, «Quitar filtros», ficha con pasos, errores, consejo, últimas veces y valoración | Igual | `ejercicios/indice.js` |
| Menú «Prototipo» | Solo del prototipo | No va en la app |

**Piezas que el prototipo ha necesitado y el sistema aún no tenía:** campo de texto (con etiqueta siempre visible), barra de avance de la sesión y celebración (agua). Están en `app.css` con tokens; pasan a `prototipos/sistema/` cuando se aprueben.

## 4. Revisión de accesibilidad (WCAG 2.1 AA)

| Criterio | Cómo está | Comprobado |
|---|---|---|
| 1.4.3 / 1.4.11 Contraste | Todo lo visible, en cada estado y para las dos personas (apartado 6) | Script |
| 1.3.1 Estructura | Un `h1` por pantalla; secciones con título; listas como listas; series en `<ol>` | Revisión |
| 2.1.1 Teclado | Botones nativos; segmentos como `radiogroup` con flechas; selector ± como `spinbutton` (flechas, Re Pág/Av Pág, Inicio, Fin); gráficos con flechas | Revisión y sistema (DIS 3) |
| 2.4.3 Orden del foco | Al cambiar de pantalla, el foco va al `h1`; al marcar una serie, a la siguiente «Serie n hecha» (R11); hojas con foco al título, Tab atrapado, Escape y botón atrás cierran, el foco vuelve a quien la abrió | Revisión |
| 2.4.7 Foco visible | Anillo del sistema (2 px, separado 2 px; oscuro sobre el color de la persona) | Sistema (DIS 3) |
| 2.5.5 Tamaño táctil | 48 px en sesión, check-in, descanso, contador y cierre; 44 px en el resto | Script |
| 3.3.2 Etiquetas | Todo campo con etiqueta visible; el ejemplo va en el marcador (guía `labels`) | Revisión |
| 4.1.2 Nombre, función y valor | Nombre en todo lo que se pulsa (script); `aria-pressed`, `aria-checked`, `aria-current`, `aria-valuenow` | Script y revisión |
| 4.1.3 Mensajes de estado | Avisos `role="status"` (errores `alert`); fin del descanso con `aria-live="assertive"`; vista previa del check-in `aria-live="polite"` | Revisión |
| Movimiento reducido | Cambios directos, sin agua ni ondas; las cifras salen ya con su valor | Revisión |

Pendiente de una prueba con lector de pantalla real (VoiceOver en el iPhone) en la ronda de revisión.

## 5. Decisiones aplicadas

- Identidad: **Carril 2 + Trenza** (DIS 2). Sistema: DIS 3 con las decisiones del 21-11-2026 (colores definitivos, descanso solo con la barra, alarma de tres toques).
- En «Mis sesiones» la sesión se guarda entera (contexto de Víctor): el prototipo lo dice al guardarla.

## 6. Comprobación automática

`node prototipos/app/comprobar.mjs --escribir` abre cada pantalla y estado de `estados.js`, con Víctor y con Virginia, y mide contraste, tamaños táctiles, nombres accesibles, cifras de la sesión, desbordes, errores y peticiones externas; en 360 × 640 y 320 × 568 mide además la serie actual (R03), la acción principal (R07) y que el botón de Hoy no tape la semana.

<!-- comprobacion:inicio -->
_Generado con `node prototipos/app/comprobar.mjs --escribir`. No editar a mano._

**86 pantallas y estados medidos** (Víctor y Virginia, 390 × 844): 4922 de 4922 pares de contraste cumplen AA; 0 zonas táctiles pequeñas; 0 cifras de sesión por debajo de 28 px.

| Medida | 360 × 640 | 320 × 568 |
|---|---|---|
| R03: margen de la serie actual sobre el borde o el descanso (peor caso) | 4 px | 12 px |
| R07: centro de la acción principal (peor caso, % del alto) | 77 % | 74 % |
| Hoy: hueco entre la tira de la semana y el botón | 256 px | 184 px |
| Desplazamiento horizontal | 0 px | 0 px |

| Pantalla | Estado | Captura (Víctor) | Contraste mínimo V / G |
|---|---|---|---|
| Hoy | Con plan | `capturas/hoy-con-plan-victor.png` | 3,56 / 4,99 |
| Hoy | Primera vez | `capturas/hoy-primera-vez-victor.png` | 6,82 / 6,82 |
| Hoy | Sin plan esta semana | `capturas/hoy-sin-plan-esta-semana-victor.png` | 4,61 / 4,61 |
| Hoy | Día de descanso | `capturas/hoy-dia-de-descanso-victor.png` | 3,56 / 4,61 |
| Hoy | Sesión en marcha | `capturas/hoy-sesion-en-marcha-victor.png` | 3,56 / 4,99 |
| Hoy | Sesión de ayer sin cerrar | `capturas/hoy-sesion-de-ayer-sin-cerrar-victor.png` | 3,56 / 3,56 |
| Hoy | Sin conexión | `capturas/hoy-sin-conexion-victor.png` | 3,56 / 4,99 |
| Hoy | Sesión hecha | `capturas/hoy-sesion-hecha-victor.png` | 3,56 / 4,99 |
| Check-in | Antes de empezar | `capturas/check-in-antes-de-empezar-victor.png` | 4,61 / 4,61 |
| Check-in | Espera de la IA | `capturas/check-in-espera-de-la-ia-victor.png` | 3,56 / 3,56 |
| Check-in | Fallo de la IA | `capturas/check-in-fallo-de-la-ia-victor.png` | 3,56 / 3,56 |
| Check-in | Sin conexión | `capturas/check-in-sin-conexion-victor.png` | 4,99 / 4,99 |
| Sesión | Uno a uno | `capturas/sesion-uno-a-uno-victor.png` | 4,61 / 4,61 |
| Sesión | Toda la sesión | `capturas/sesion-toda-la-sesion-victor.png` | 4,61 / 4,61 |
| Sesión | Ejercicio por tiempo | `capturas/sesion-ejercicio-por-tiempo-victor.png` | 4,61 / 4,61 |
| Sesión | Cardio | `capturas/sesion-cardio-victor.png` | 4,61 / 4,61 |
| Sesión | Cómo se hace | `capturas/sesion-como-se-hace-victor.png` | 3,56 / 3,56 |
| Sesión | Menú del ejercicio | `capturas/sesion-menu-del-ejercicio-victor.png` | 3,56 / 3,56 |
| Sesión | Cambiar ejercicio | `capturas/sesion-cambiar-ejercicio-victor.png` | 4,86 / 4,86 |
| Sesión | Guardar como mía | `capturas/sesion-guardar-como-mia-victor.png` | 7,00 / 6,32 |
| Sesión | Terminar con series pendientes | `capturas/sesion-terminar-con-series-pendientes-victor.png` | 3,56 / 3,56 |
| Sesión | Cierre | `capturas/sesion-cierre-victor.png` | 7,00 / 3,56 |
| Sesión | Final | `capturas/sesion-final-victor.png` | 9,81 / 8,85 |
| Sesión | Sesión hecha (lectura) | `capturas/sesion-sesion-hecha-lectura-victor.png` | 4,61 / 4,61 |
| Descanso | Barra de descanso | `capturas/descanso-barra-de-descanso-victor.png` | 4,08 / 4,08 |
| Descanso | Alarma de fin | `capturas/descanso-alarma-de-fin-victor.png` | 4,61 / 4,61 |
| Descanso | Vuelta tras bloquear | `capturas/descanso-vuelta-tras-bloquear-victor.png` | 4,61 / 4,61 |
| Progreso | Vacío | `capturas/progreso-vacio-victor.png` | 4,61 / 4,61 |
| Progreso | Primera semana | `capturas/progreso-primera-semana-victor.png` | 4,61 / 4,61 |
| Progreso | Un año de datos | `capturas/progreso-un-ano-de-datos-victor.png` | 4,61 / 4,61 |
| Progreso | Apuntar medidas | `capturas/progreso-apuntar-medidas-victor.png` | 7,00 / 6,32 |
| Perfil | Objetivos y nivel | `capturas/perfil-objetivos-y-nivel-victor.png` | 4,61 / 4,61 |
| Perfil | Lesiones | `capturas/perfil-lesiones-victor.png` | 4,61 / 4,61 |
| Perfil | Nueva lesión | `capturas/perfil-nueva-lesion-victor.png` | 3,56 / 3,56 |
| Perfil | Editar lesión | `capturas/perfil-editar-lesion-victor.png` | 3,56 / 3,56 |
| Perfil | Salud | `capturas/perfil-salud-victor.png` | 4,61 / 4,61 |
| Perfil | Mi entreno | `capturas/perfil-mi-entreno-victor.png` | 4,61 / 4,61 |
| Perfil | Mis datos | `capturas/perfil-mis-datos-victor.png` | 4,99 / 4,99 |
| Perfil | Copias | `capturas/perfil-copias-victor.png` | 4,61 / 4,61 |
| Perfil | Ajustes | `capturas/perfil-ajustes-victor.png` | 4,61 / 4,61 |
| Más | Bienvenida | `capturas/mas-bienvenida-victor.png` | 9,81 / 8,85 |
| Más | Ejercicios | `capturas/mas-ejercicios-victor.png` | 4,99 / 4,99 |
| Más | Ficha de un ejercicio | `capturas/mas-ficha-de-un-ejercicio-victor.png` | 3,56 / 3,56 |

**Todo cumple.**
<!-- comprobacion:fin -->
