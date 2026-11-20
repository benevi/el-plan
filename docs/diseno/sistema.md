# DIS 3 · Sistema de diseño

Tercera entrega de la fase D. Convierte la identidad elegida (**Carril 2 + logo Trenza**, DIS 2) en tokens, componentes con todos sus estados y gráficos, con su contraste medido por script. Lo heredan los prototipos (DIS 4) y la implementación (fase 5).

**Estado:** pendiente de la aprobación de Víctor.
**Catálogo:** `/prototipos/sistema/` en la vista previa de `diseno-prototipos` (con la barra final). Arriba a la derecha se cambia entre Víctor y Virginia; cada muestra dice su contraste medido.

**Archivos**

| Ruta | Qué es |
|---|---|
| `prototipos/sistema/tokens.css` | Todos los tokens: primitivos, semánticos y de componente. El único archivo con colores en bruto |
| `prototipos/sistema/componentes.css` | Los componentes con todos sus estados (solo usa tokens) |
| `prototipos/sistema/graficos.js` | Gráficos en SVG (línea con área, barras, vasos de constancia, vacío y cargando) con burbuja y tabla |
| `prototipos/sistema/index.html`, `catalogo.js`, `catalogo.css` | Página catálogo |
| `prototipos/sistema/comprobar.mjs` | Comprobación automática (contraste, teclado, reglas de código) y capturas; escribe `contraste.json` y la tabla de este documento |
| `prototipos/sistema/capturas/` | Catálogo entero en móvil (Víctor y Virginia) y escritorio, secciones a 390 px y la hoja abierta |

---

## 1. Principios

1. **Lo de la serie, primero y grande.** Cifras de la sesión ≥ 28 px; kilos y repeticiones a 56 px; descanso a 48 px; contador a 96 px. Todo lo que se pulsa en la sesión mide ≥ 48 px.
2. **Un color por persona, solo para lo tuyo y lo que se pulsa.** Lima suave para Víctor, rosa suave para Virginia (`data-persona` en `<html>`). Nunca es el único portador de un estado (R12): siempre va con forma, icono o texto.
3. **Borde antes que sombra.** Las superficies se separan por un escalón de color y un filete; solo flota (y lleva sombra) lo que va encima de otra cosa: aviso y hoja.
4. **Movimiento con presupuesto.** Solo `transform` y `opacity`; durante la serie no se mueve nada salvo el reloj; con movimiento reducido, la misma información sin desplazamientos.
5. **Sistema, no pantalla.** Ningún componente usa un valor en bruto. Si falta algo, se añade un token.

## 2. Tokens

Tres capas en `tokens.css`: **primitivos** (`--p-*`, el material: `--p-noche-950`, `--p-lima-300`…) → **semánticos** (para qué sirven: `--sup-panel`, `--texto-2`, `--acento`…) → **de componente** (`--boton-fondo`, `--chip-alto`…). Los componentes solo leen semánticos y de componente.

### 2.1 Color

| Token | Valor | Uso |
|---|---|---|
| `--sup-fondo` | `#081723` | Fondo de la app |
| `--sup-panel` | `#0D1F2E` | Tarjetas, listas, serie actual |
| `--sup-control` | `#16293B` | Descanso, controles pulsados |
| `--sup-capa` | `#1D3349` | Hoja inferior, avisos, burbuja de gráfico |
| `--sup-agua` | `#0F2C42` | Final de sesión (el agua que sube) |
| `--sup-velo` | `rgba(3, 9, 15, .72)` | Detrás de una hoja (sin texto encima) |
| `--texto-1` | `#EDF3F7` | Texto principal |
| `--texto-2` | `#AFC1CF` | Secundario |
| `--texto-3` | `#88A2B6` | Terciario: ayudas, ejes, pendientes (≥ 4,86:1 incluso sobre `--sup-capa`) |
| `--texto-sobre-acento` | `#081723` | Texto sobre el color de la persona (≥ 7:1: vale para la alarma) |
| `--borde-fino` | `#22394F` | Filetes entre filas (decorativo) |
| `--borde-control` | `#6A8AA3` | Contorno de controles: ≥ 3:1 sobre todas las superficies |
| `--borde-foco` | `#EDF3F7` | Anillo de foco (2 px, separado 2 px). Sobre el color de la persona, pasa a `--texto-sobre-acento` |
| `--estado-bien` / `aviso` / `error` / `info` | `#93DDB8` / `#F5C76B` / `#FF8A80` / `#8CC8F2` | Siempre con icono y texto |
| `--acento` | Víctor `#C9E77E` · Virginia `#F29BC2` | Botón principal, elegido, hoy, gráfico |
| `--acento-pulsado` | Víctor `#ADC76C` · Virginia `#D085A7` | Botón principal pulsado (el texto sigue ≥ 6,5:1) |
| `--acento-tinte` | Víctor `#2B3F3B` · Virginia `#323346` | Fondo de lo elegido (chip, me gusta) y agua del contador |

**Cambio respecto a Carril 2:** `--borde-control` pasa de `#5E7F98` a `#6A8AA3` para llegar a 3:1 también sobre `--sup-capa` (hoja y avisos).

**Personas y daltonismo (de DIS 2):** ΔE OKLab entre lima y rosa ≥ 0,15 con protanopía, deuteranopía y tritanopía. El validador de la guía `dataviz` da **CVD y contraste correctos** (ΔE 15,3 deutan; ≥ 3:1 sobre el panel) y marca la banda de luminosidad como fuera de rango para una paleta **categórica**; no aplica: los dos colores nunca comparten gráfico (cada uno ve solo lo suyo) y cada gráfico tiene una sola serie.

### 2.2 Letra

Instrument Sans (OFL, 56 KB, alojada). Pesos 400, 500 y 600. Las cifras usan `font-stretch: 75%` y números tabulares (`.cifra-estrecha`).

| Token | Tamaño / interlineado | Uso |
|---|---|---|
| `--t-portada` | 34 / 1,1 | Título de Hoy y Progreso |
| `--t-titulo` | 26 / 1,15 | Nombre del ejercicio |
| `--t-subtitulo` | 20 / 1,25 | Títulos de bloque, hoja |
| `--t-cuerpo` | 16 / 1,55 | Texto |
| `--t-secundario` | 14 / 1,5 | Ayudas, «La última vez» |
| `--t-meta` | 12 / 1,4 | Solo datos auxiliares (ejes, días) |
| `--t-cifra-s` | 28 | Mínimo de cualquier cifra de la sesión (R06) |
| `--t-cifra-m` | 48 | Reloj del descanso |
| `--t-cifra-l` | 56 | Kilos y repeticiones |
| `--t-cifra-xl` | 96 | Contador a pantalla completa (R06: ≥ 64) |

### 2.3 Espacio, radios, profundidad y toque

- **Espacio, base 4:** `--e-1` 4 · `--e-2` 8 · `--e-3` 12 · `--e-4` 16 · `--e-5` 20 (margen lateral) · `--e-6` 24 · `--e-8` 32 (entre bloques) · `--e-10` 40 · `--e-12` 48 · `--e-16` 64. Dentro de un componente, 4-16; entre bloques, 32.
- **Tres radios:** `--r-pequeno` 8 (barras, celdas) · `--r-medio` 20 (tarjetas, hojas, avisos) · `--r-pildora` (todo lo que se pulsa).
- **Profundidad:** `--prof-0` nada · `--prof-1` filo de luz (panel) · `--prof-2` aviso flotante · `--prof-3` hoja inferior.
- **Toque (R01):** `--toque-min` 44 fuera de la sesión · `--toque-sesion` 48 en sesión, descanso, contador y cierre · `--toque-principal` 56 · `--toque-separacion` 8.

### 2.4 Movimiento

| Token | Valor | Curva | Uso |
|---|---|---|---|
| `--m-instante` | 100 ms | `--c-sale` | Respuesta a un toque |
| `--m-corto` | 200 ms | `--c-sale` (entrar) / `--c-entra` (salir) | Abrir y cerrar, avisos, salida de pantalla |
| `--m-medio` | 300 ms | `--c-sale` | Entrada de pantalla y de hoja |
| `--m-largo` | 600 ms | `--c-sale` | Progreso que se llena (fuera de la serie) |
| `--m-fluye` | 900 ms | `--c-agua` | Celebración: el agua sube y las cifras fluyen |
| `--m-escalon` | 50 ms | — | Cascada entre elementos; máximo 5, el resto entra a la vez |

Curvas: `--c-sale` `cubic-bezier(.16, 1, .3, 1)` · `--c-entra` `cubic-bezier(.7, 0, .84, 0)` · `--c-estandar` `cubic-bezier(.4, 0, .2, 1)` · `--c-agua` `cubic-bezier(.3, .7, .2, 1)`. Excepciones documentadas: el nivel del descanso y el agua del contador avanzan en lineal, 1 s por paso (son el propio reloj); el giro de carga es un bucle funcional.

**Presupuesto de movimiento**

| Momento | Qué se mueve | Límite |
|---|---|---|
| Durante la serie | Solo el reloj (dígitos y nivel) | Nada más; ni avisos animados |
| Fin del descanso | La barra sube 8 px y lanza 3 ecos (600 ms) | El texto no cambia de contraste (R08) |
| Cambio de pantalla | Sale la anterior (150-200 ms) y entra la nueva (300 ms) con cascada | ≤ 600 ms en total |
| Progreso | Vasos, barras y gráfico se llenan una vez al entrar | 600-900 ms |
| Final de sesión y récords | Agua, ondas, cifras que fluyen | ≤ 1,5 s; nunca en bucle |
| Rendimiento | Solo `transform` y `opacity` | 60 fps con la CPU ×4 (medido en DIS 2: 58-60 fps) |

**Movimiento reducido** (`prefers-reduced-motion: reduce`): todas las animaciones y transiciones pasan a 1 ms y sin retraso, así que se ve directamente el estado final; desaparecen ecos, ondas y polvo; el esqueleto deja de latir; el giro de carga se queda quieto y el botón dice «Guardando…»; la información es la misma (R25).

## 3. Componentes

Cada componente tiene su selector real (`:active`, `:focus-visible`, `aria-pressed`, `aria-checked`, `aria-disabled`, `aria-busy`, `aria-current`) y una clase `.es-*` equivalente para enseñarlo quieto en el catálogo. «—» = el estado no aplica.

| Componente | Normal | Pulsado | Activo | Desactivado | Foco | Error | Cargando | Vacío |
|---|---|---|---|---|---|---|---|---|
| Botón (principal, secundario, de texto, peligro) | Sí | Sí | — | Sí, con motivo y enfocable | Sí | Sí («Reintentar» + mensaje) | Sí (giro + «Guardando…», `aria-busy`) | — |
| Botón de icono | Sí | Sí | Sí (`aria-pressed`, relleno) | Sí | Sí | — | Sí | — |
| Chip | Sí | Sí | Sí (tinte + borde + ✓) | Sí | Sí | Sí (grupo sin elegir) | — | — |
| Segmento | Sí | Sí | Sí | Sí (opción tachada) | Sí | — | — | — |
| Selector ± | Sí | Sí | — | Sí (− en el mínimo) | Sí (en el valor) | Sí (valor raro) | — | — |
| Fila de serie | Pendiente | — | Actual / recién hecha | Lectura (sesión cerrada) | Sí (sus controles) | Sí («Sin guardar») | — | — |
| Tarjeta de ejercicio | Pendiente | — | En curso / hecha | — | Sí («Cómo se hace») | — | Sí (esqueleto) | Sí (con acción) |
| Hoja inferior | Cerrada | — | Abierta | — | Título al abrir | — | — | — |
| Aviso | Info | — | Hecho | — | Sí (cerrar) | Sí (con Reintentar) | — | Sin conexión |
| Descanso | Corriendo | Sí (botones) | Últimos 10 s | — | Sí | — | — | — |
| Alarma | — | — | Suena (≥ 7:1) | — | Sí | — | — | — |
| Contador | Listo / en pausa | Sí (botones) | En marcha / terminado | — | Sí | — | — | — |
| Tira de la semana | Descanso / prevista | — | Hecha / hoy / no hecha (×) | — | — | — | — | Sí (sin plan) |
| Pestañas | Sí | Sí | Sí (`aria-current`) | — | Sí | — | — | — |
| Gráficos | Con datos | — | Punto elegido (burbuja) | — | Sí (todo el gráfico) | — | Sí (esqueleto) | Sí (con acción) |

### Notas de uso y accesibilidad

- **Botón.** Uno principal por pantalla, en el tercio inferior (R07). No se desactiva un envío: si falta algo, se pulsa y se explica (guía de formularios). Cuando algo no se puede hacer (sin red), `aria-disabled` + motivo visible al lado, y sigue enfocable (R21). Protección contra el doble toque en marcar serie, terminar y guardar: dos toques en menos de 400 ms cuentan como uno (R27).
- **Botón de icono.** 48 × 48 con `aria-label`. Si alterna, `aria-pressed` y cambio de forma (contorno → relleno).
- **Chip.** `button` con `aria-pressed`. Elegido = tinte, borde del color de la persona y ✓. El grupo tiene `role="group"` y nombre. Se actualiza en su sitio (R15).
- **Segmento.** `radiogroup` con foco itinerante: Tab entra en la opción elegida; flechas, Inicio y Fin cambian. Opciones de 48 px.
- **Selector ±.** Valor como `spinbutton` (`aria-valuenow`, `aria-valuetext` «22,5 kilos»): flechas suben y bajan un paso, Re Pág / Av Pág cuatro pasos, Inicio y Fin van al mínimo y al máximo. Botones de 48 px con nombre («Más 2,5 kilos»). Paso de kilos según la máquina (1, 2,5 o 5). Sin teclado del móvil (R04).
- **Fila de serie.** La actual es una tarjeta con dos selectores y «Serie n hecha»; al marcarla, sus kilos y repeticiones pasan a la siguiente vacía (R05) y el foco va al siguiente «Serie n hecha» (R11).
- **Tarjeta de ejercicio.** Orden: nombre y objetivo → series → «Cómo se hace» plegado (R26). «Cambiar por otro» conserva lo hecho y lo dice (R17).
- **Hoja inferior.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; al abrir, foco al título; Tab no sale de la hoja; Escape, «Cerrar», tocar el velo o el botón atrás del móvil (entrada en el historial) la cierran; el resto de la página queda `inert`; el foco vuelve al botón que la abrió (R10). No abre el teclado (R23). Entra 300 ms desde abajo; sale 200 ms.
- **Aviso.** `role="status"` (o `alert` si es error). Siempre icono + título + qué hacer. Los errores no se van solos y no enseñan códigos (R13). En la sesión no se animan.
- **Descanso y alarma.** `role="timer"`. No tapa la serie siguiente ni la acción principal: la pantalla reserva su alto (R09). Últimos 10 s: el reloj toma el color de la persona y la etiqueta dice «Prepárate». Alarma: fondo del color de la persona, texto `--texto-sobre-acento` (≥ 7:1 en todos los fotogramas: solo se mueve el bloque), vibración 300-120-300 ms, anuncio `aria-live="assertive"` y cierre solo a los 8 s o al marcar la serie (R08).
- **Contador a pantalla completa.** Para ejercicios por tiempo y cardio: mm:ss y texto propio desde 2 min (R18); el agua (tinte de la persona) sube con el tiempo; botones de 56 px.
- **Tira de la semana.** Cada estado con forma propia (lleno con ✓, anillo, discontinuo, ×, nada) y texto oculto para el lector.
- **Pestañas.** Enlaces con `aria-current="page"`; la activa cambia de color y lleva un punto. Ocultas durante la sesión.

## 4. Gráficos

Siguiendo la guía `dataviz`:

- **Forma por trabajo:** constancia → vasos que se llenan (sesiones hechas sobre previstas, ✓ en las semanas completas) con la cifra de cabecera «4 de 8 semanas completas»; fuerza → línea con área y la cifra «+5 kg en 8 semanas»; medidas → dos gráficos pequeños (peso en kg, cintura en cm: **nunca dos ejes**); dolor → barras de 0 a 10, un gráfico pequeño por zona.
- **Color:** una sola serie por gráfico, en el color de la persona; las barras anteriores en `--texto-3` y la última en el color de la persona. **Texto en tinta** (`--texto-2`/`--texto-3`), nunca en el color de la serie.
- **Marcas:** línea de 2 px, punto final de 8 px, barras con extremos redondeados de 3 px y 2 px de hueco, rejilla tenue (`--borde-fino`).
- **Interacción:** el gráfico es una sola parada de teclado (con su resumen como nombre); flechas, Inicio y Fin recorren los puntos y se anuncian; con el dedo o el ratón se elige el punto más cercano. Burbuja con valor y semana; guía vertical en las líneas.
- **Tabla:** cada gráfico tiene «Ver como tabla» con los mismos datos.
- **Estados:** con datos, vacío (título, para qué sirve y una acción: «Apuntar medidas») y cargando (esqueleto con la forma del gráfico).

## 5. Reglas de código (las hereda la fase 5)

- HTML + CSS + módulos ES, **sin compilación ni dependencias**; nada de recursos externos (letra alojada).
- **Sin `<script>` en línea, sin `on…=`, sin atributos `style`** en el HTML: lo que depende de los datos se pone por CSSOM (`el.style.setProperty('--v', …)`). Funciona con una CSP sin `'unsafe-inline'`.
- **Sin `import()` dinámico.**
- **Ningún color en bruto fuera de `tokens.css`** (lo comprueba `comprobar.mjs`); espacios, radios, duraciones y curvas, siempre por token.
- Estados por atributos ARIA (`aria-pressed`, `aria-checked`, `aria-disabled`, `aria-busy`, `aria-current`, `aria-invalid`), no por clases sueltas; las `.es-*` son solo para el catálogo.
- Foco: nunca `outline: none` sin sustituto; el anillo global vale para todo.
- Persona: `data-persona="victor" | "virginia"` en `<html>`; ningún componente pregunta por la persona.
- Orden de carga: `tokens.css` → `componentes.css` → estilos de pantalla.

## 6. Comprobación automática

`node prototipos/sistema/comprobar.mjs --escribir` (Chromium con Playwright) mide sobre la página renderizada, para Víctor y para Virginia:

- **Contraste de cada muestra:** cada texto contra su fondo real (componiendo transparencias), 4,5:1 (3:1 desde 24 px) y 7:1 en la alarma; bordes o rellenos de controles, iconos, marcas de gráfico, indicadores y anillos de foco, 3:1. Los desactivados se miden pero no suspenden (WCAG los exime).
- **Teclado:** recorre la página entera con Tab en un móvil de 390 px; cada parada debe tener nombre accesible, foco visible (anillo ≥ 2 px) y tamaño táctil (48 px en sesión, 44 px en el resto).
- **Hoja inferior:** al abrir, foco al título, `aria-modal` y fondo `inert`; Escape la cierra y devuelve el foco al botón.
- **Reglas de código** del apartado 5.

<!-- comprobacion:inicio -->
_Generado con `node prototipos/sistema/comprobar.mjs --escribir` el 2026-11-20. No editar a mano._

| Muestra | Víctor: mínimo | Virginia: mínimo | Pares | Cumple |
|---|---|---|---|---|
| boton-vivo | 12,15:1 | 8,18:1 | 2 | Sí |
| boton-normal | 12,15:1 | 8,18:1 | 2 | Sí |
| boton-pulsado | 8,91:1 | 6,06:1 | 2 | Sí |
| boton-foco | 12,15:1 | 8,18:1 | 3 | Sí |
| boton-cargando | 12,15:1 | 8,18:1 | 2 | Sí |
| boton-desactivado | 9,06:1 | 9,06:1 | 3 | Sí |
| boton-error | 7,34:1 | 7,34:1 | 4 | Sí |
| boton-secundario | 4,61:1 | 4,61:1 | 2 | Sí |
| boton-secundario-pulsado | 4,61:1 | 4,61:1 | 2 | Sí |
| boton-texto | 14,98:1 | 14,98:1 | 1 | Sí |
| boton-peligro | 7,34:1 | 7,34:1 | 2 | Sí |
| icono-vivo | 4,61:1 | 4,61:1 | 2 | Sí |
| icono-normal | 4,61:1 | 4,61:1 | 2 | Sí |
| icono-pulsado | 4,61:1 | 4,61:1 | 2 | Sí |
| icono-activo | 8,11:1 | 6,03:1 | 2 | Sí |
| icono-foco | 4,61:1 | 4,61:1 | 3 | Sí |
| icono-desactivado | 0,00:1 | 0,00:1 | 2 | Sí |
| icono-cargando | 4,61:1 | 4,61:1 | 1 | Sí |
| chip-vivo | 4,61:1 | 4,61:1 | 9 | Sí |
| chip-normal | 4,61:1 | 4,61:1 | 2 | Sí |
| chip-pulsado | 4,61:1 | 4,61:1 | 2 | Sí |
| chip-activo | 8,11:1 | 6,03:1 | 3 | Sí |
| chip-foco | 4,61:1 | 4,61:1 | 3 | Sí |
| chip-desactivado | 0,00:1 | 0,00:1 | 2 | Sí |
| chip-error | 7,34:1 | 7,34:1 | 8 | Sí |
| segmento-vivo | 9,06:1 | 8,18:1 | 3 | Sí |
| segmento-normal | 9,06:1 | 8,18:1 | 4 | Sí |
| segmento-pulsado | 8,03:1 | 8,03:1 | 4 | Sí |
| segmento-foco | 9,06:1 | 8,18:1 | 5 | Sí |
| segmento-desactivado | 12,15:1 | 8,18:1 | 3 | Sí |
| selector-vivo | 4,61:1 | 4,61:1 | 7 | Sí |
| selector-normal | 4,61:1 | 4,61:1 | 7 | Sí |
| selector-pulsado | 4,61:1 | 4,61:1 | 7 | Sí |
| selector-foco | 4,61:1 | 4,61:1 | 8 | Sí |
| selector-desactivado | 4,61:1 | 4,61:1 | 7 | Sí |
| selector-error | 4,61:1 | 4,61:1 | 9 | Sí |
| serie-vivo | 4,61:1 | 4,61:1 | 24 | Sí |
| serie-estados | 6,30:1 | 6,30:1 | 13 | Sí |
| tarjeta-actual | 4,61:1 | 4,61:1 | 9 | Sí |
| tarjeta-pendiente | 9,06:1 | 9,06:1 | 5 | Sí |
| tarjeta-hecha | 9,81:1 | 9,81:1 | 4 | Sí |
| tarjeta-cargando | 0,00:1 | 0,00:1 | 0 | Sí |
| tarjeta-vacia | 4,61:1 | 4,61:1 | 4 | Sí |
| hoja-vivo | 4,61:1 | 4,61:1 | 2 | Sí |
| hoja-abierta | 3,56:1 | 3,56:1 | 8 | Sí |
| aviso-vivo | 4,61:1 | 4,61:1 | 2 | Sí |
| aviso-info | 7,00:1 | 7,00:1 | 4 | Sí |
| aviso-bien | 7,00:1 | 7,00:1 | 4 | Sí |
| aviso-aviso | 3,56:1 | 3,56:1 | 7 | Sí |
| aviso-error | 3,56:1 | 3,56:1 | 7 | Sí |
| aviso-sinred | 7,00:1 | 7,00:1 | 3 | Sí |
| descanso-vivo | 4,08:1 | 4,08:1 | 8 | Sí |
| descanso-corriendo | 4,08:1 | 4,08:1 | 7 | Sí |
| descanso-ultimos | 4,08:1 | 4,08:1 | 7 | Sí |
| descanso-alarma | 13,15:1 | 8,85:1 | 6 | Sí |
| contador-vivo | 9,06:1 | 8,18:1 | 6 | Sí |
| contador-marcha | 4,61:1 | 4,61:1 | 6 | Sí |
| contador-pausado | 4,61:1 | 4,61:1 | 8 | Sí |
| contador-terminado | 9,06:1 | 8,18:1 | 6 | Sí |
| semana | 4,61:1 | 4,61:1 | 18 | Sí |
| semana-vacia | 9,06:1 | 8,18:1 | 4 | Sí |
| pestanas | 6,30:1 | 6,30:1 | 9 | Sí |
| grafico-constancia | 4,61:1 | 4,61:1 | 50 | Sí |
| grafico-fuerza | 6,30:1 | 6,30:1 | 28 | Sí |
| grafico-medidas | 6,30:1 | 6,30:1 | 56 | Sí |
| grafico-dolor | 6,30:1 | 6,30:1 | 64 | Sí |
| grafico-vacio | 4,61:1 | 4,61:1 | 5 | Sí |
| grafico-cargando | 9,06:1 | 9,06:1 | 1 | Sí |

**Total:** Víctor 517 de 517 pares; Virginia 517 de 517 pares. Teclado: 61 paradas con Tab, 0 sin nombre, sin foco visible o pequeñas. Hoja inferior: foco al título al abrir, fondo inerte, Escape cierra y devuelve el foco: sí. Reglas de código: sin fallos.
<!-- comprobacion:fin -->

## 7. De dónde sale cada requisito de DIS 1

| Requisito | Dónde lo resuelve el sistema |
|---|---|
| R01 zonas táctiles | `--toque-*`; comprobado con Tab en 390 px |
| R02 contraste AA | Tokens + `comprobar.mjs` en cada muestra |
| R03 serie visible | Fila de serie compacta; descanso que reserva su alto (comprobado en Carril 2: 24 px de margen en 320 × 568) |
| R04 repetir en 1 toque, cambiar en ≤ 3 | Fila de serie + selector ± |
| R05 kilos que pasan | Fila de serie (en vivo en el catálogo) |
| R06 cifras ≥ 28 px y contador ≥ 64 | `--t-cifra-*` |
| R07 acción en el tercio inferior | Botón principal; descanso abajo |
| R08 alarma ≥ 7:1 | `--texto-sobre-acento` sobre `--acento` (medido) |
| R09 descanso que no tapa | Barra fija que reserva su alto |
| R10 hojas accesibles | Hoja inferior (comprobada) |
| R11 foco tras cada acción | Fila de serie; hoja; aviso |
| R12 estados no solo por color | Forma + icono + texto en chip, semana, serie, aviso, pestañas |
| R13 errores claros | Aviso de error con «Reintentar» y alternativa |
| R15 actualizar en su sitio | Chips, segmentos y selectores no cambian de alto |
| R17 pérdidas nombradas | Aviso «Te quedan 2 series»; hoja «Tienes 1 serie hecha: se conserva» |
| R18 cardio en mm:ss | Contador |
| R21 sin red | Botón desactivado con motivo; aviso «Sin conexión» |
| R23 hojas sin teclado | Hoja inferior: foco al título |
| R25 movimiento reducido | Apartado 2.4 |
| R26 orden de la tarjeta | Tarjeta de ejercicio |
| R27 doble toque | Fila de serie (en vivo) |

## 8. Preguntas abiertas para Víctor

1. ¿Vale el **rosa suave** de Virginia y la **lima suave** de Víctor como colores definitivos, o los queréis elegir vosotros?
2. **Contador a pantalla completa:** ¿lo queréis también para los descansos largos (más de 2 min) o solo para ejercicios por tiempo y cardio?
3. **Vibración** de la alarma: ¿300-120-300 ms os parece bien o la queréis más larga (con auriculares)?
