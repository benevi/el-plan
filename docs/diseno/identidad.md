# DIS 2 · Identidad nueva

Segunda entrega de la fase D. Tres direcciones de identidad **claramente distintas** para Pipos Fitness, solo en tema oscuro, para que Víctor elija una (o una mezcla) desde el móvil. El nombre se mantiene; todo lo demás es nuevo: logo, iconos, colores, letra y movimiento.

**Estado:** pendiente de elección.
**Dónde verlo:** en la vista previa de Vercel de la rama `diseno-prototipos`, ruta **`/prototipos/identidad/`** (con la barra final). La página índice permite comparar la misma pantalla en las tres direcciones, con Víctor o Virginia, a 360 × 640 o 390 × 844.

---

## Cómo elegir

1. Abre `/prototipos/identidad/` en el móvil.
2. En «Comparar la misma pantalla», elige Hoy, Sesión, Progreso o Final y desliza entre las tres.
3. Abre cada una entera («Abrir entera»): en la sesión puedes subir y bajar kilos y repeticiones, marcar la serie (los kilos pasan a la siguiente), esperar al final del descanso (alarma con vibración) y pulsar «Terminar» para ver la celebración. Nada se guarda.
4. Responde con una dirección o con una mezcla concreta (por ejemplo: «la letra y las cifras de Hierro, con la piscina de Carril»). Lo elegido pasa a DIS 3 como tokens.

Lo que **no** se está eligiendo aquí: el orden de las pantallas ni su contenido final (eso es DIS 3 y DIS 4). Las tres comparten los mismos datos de ejemplo y el mismo comportamiento para que la comparación sea solo de identidad.

---

## Las tres direcciones

### Tiza · la pizarra del gimnasio

| | |
|---|---|
| **Idea** | La pizarra donde se apuntan las series. La constancia se cuenta con **palotes**: cada sesión, un trazo; el tachón cierra la semana completa y, al terminar, la sesión. |
| **Logo** | Cuatro palotes y un tachón en tiza blanca (`tiza/logo.svg`, `tiza/icono.svg`). |
| **Paleta** | Pizarra `#1A221E`, panel `#222B26`, control `#2D3832`, tiza `#EEEDE6` / `#C3C8C0` / `#9DA79E`. **Víctor: tiza azul `#8CC8F2`. Virginia: tiza amarilla `#F2D04E`.** |
| **Letra** | Bricolage Grotesque (títulos y cifras) + Atkinson Hyperlegible Next (texto, diseñada para leerse con mala visión: pensada para los reflejos de la sala, H5). Cifras tabulares. 73,6 KB. |
| **Movimiento** | Entrada: aparece y sube 6 px (200 ms) y el subrayado de tiza se dibuja de izquierda a derecha (300 ms). Celebración: los cuatro palotes se escriben uno a uno (100 ms entre ellos), el tachón cruza (300 ms) y suelta un poco de polvo de tiza; después entran título y cifras. |
| **Carácter** | Tranquila, cercana, artesanal. La más legible de las tres. |

### Carril · la piscina climatizada

| | |
|---|---|
| **Idea** | La piscina de noche. La estructura son **calles y corcheras**; la **T** del final de la calle significa «completo»; las cifras son las de un marcador de competición. Todo se mueve en horizontal, como un largo. |
| **Logo** | Una P cuyo pie es la T del fondo de la calle (`carril/logo.svg`). |
| **Paleta** | Agua `#062033`, calle `#0B2C45`, control `#123B5A`, azulejo `#EAF6FB` / `#B5CEDD` / `#8FB0C5`. **Víctor: lima `#C6F04D`. Virginia: rosa `#FF7EB6`.** |
| **Letra** | Saira, una sola familia variable en peso **y anchura**: normal para leer y estrecha (62,5 %) para las cifras grandes. Cifras tabulares. 96,6 KB. |
| **Movimiento** | Entrada: llega nadando 24 px desde la derecha (300 ms); al volver, desde la izquierda; la barra de la sesión de Hoy se llena tramo a tramo. Descanso: la barra avanza de la salida a la pared. Celebración: la calle se completa hasta la pared, la T se marca y salen tres ondas; las cifras cuentan hasta su valor. |
| **Carácter** | Deportiva, luminosa, con más color. La única que habla también de la piscina. |

### Hierro · cartel de sala de pesas

| | |
|---|---|
| **Idea** | Un cartel de competición: **cifras enormes** en letra muy estrecha, rejilla rígida y filetes gruesos. Los **discos** son la unidad: la semana son discos de distinta altura, el progreso son columnas, la celebración carga la barra. |
| **Logo** | Una «p» hecha con un disco y la barra (`hierro/logo.svg`). |
| **Paleta** | Hierro `#16120F`, panel `#221C17`, control `#2F2721`, papel `#F4EEE6` / `#CDBFB1` / `#A99B8C`. **Víctor: ámbar `#F5B13D`. Virginia: lavanda `#A99BFF`.** |
| **Letra** | Sofia Sans Extra Condensed (titulares y cifras, hasta 120 px) + Onest (texto). Cifras tabulares. 72,5 KB. |
| **Movimiento** | Entrada: el contenido sube 12 px (200 ms) y las cifras grandes salen de su línea base, enmascaradas (300 ms), como un cartel que se pega. Celebración: los discos entran en la barra desde los lados, de mayor a menor (100 ms entre ellos); después aparece «Sesión hecha» y el total de kilos cuenta hasta su valor. |
| **Carácter** | La más expresiva y editorial. Las cifras de la sesión se leen a más distancia que en ninguna otra (kilos a 88 px, descanso a 72 px). |

### Lo que comparten (y no se elige)

- **Solo oscuro**, sin degradados de varios colores, sin cristal ni desenfoques, sin ilustraciones de personas, sin imágenes de bancos ni recursos externos. Sin logros, puntos ni vista «Juntos».
- **Un color por persona** que solo marca lo interactivo y lo «tuyo» (botón principal, serie actual, lo hecho). Nunca es el único portador de un estado (R12): «Hecha» lleva marca y texto, «Hoy» lleva texto o contorno, lo previsto va en discontinua o rayado.
- **Tres pesos de letra como máximo** (400, 500, 600), ninguno por encima de 600; texto mínimo 12 px y solo para datos auxiliares.
- **Duraciones** de 100, 200 o 300 ms; curva de salida `cubic-bezier(.16, 1, .3, 1)`; solo se animan `transform` y `opacity`. Dos excepciones documentadas: la barra del descanso avanza en lineal con el segundo (1000 ms, es el propio reloj) y las cifras de la celebración cuentan durante 900 ms (cambia el texto, no se mueve nada).
- **Movimiento reducido** (`prefers-reduced-motion: reduce`): todas las animaciones pasan a 1 ms y se ve directamente el estado final; las ondas y el polvo de tiza desaparecen; las cifras salen ya con su valor; la alarma no se mueve pero cambia igual de color y se anuncia. La información es la misma (R25).
- **Durante la serie no se mueve nada** salvo el contador del descanso.
- **Alarma de fin de descanso**: el bloque del descanso pasa al color de la persona con texto oscuro (≥ 7:1 en todos los fotogramas, R08: solo se mueve el bloque, nunca cambia la legibilidad), vibra (`300-120-300 ms`), se anuncia por lector de pantalla y se cierra sola a los 8 s o al marcar la serie.

---

## Contraste, daltonismo y pesos

Medido con `node prototipos/identidad/contraste.mjs`, que lee los tokens de cada `estilo.css`. Requisitos (R02): texto ≥ 4,5:1 (incluso el terciario y las cifras grandes, aunque podrían quedarse en 3:1), bordes de control y rellenos de botón ≥ 3:1, texto sobre el color de la persona ≥ 7:1 (R08). Los colores de persona se comparan con simulación de protanopía, deuteranopía y tritanopía (Machado, Oliveira y Fernandes, 2009) por distancia perceptual ΔE en OKLab (≥ 0,10 se distinguen bien) y deben seguir a ≥ 3:1 del fondo.

<!-- contraste:inicio -->
_Generado con `node prototipos/identidad/contraste.mjs --escribir`. No editar a mano._

| Dirección | Pares que cumplen | Contraste mínimo medido | ΔE mínimo entre personas | Fuentes | PNG (192, 512, maskable) |
|---|---|---|---|---|---|
| Tiza | 24 de 24 | 3,09:1 | 0,18 | 73,6 KB | 8,2 KB, 26,2 KB, 17,1 KB |
| Carril | 24 de 24 | 3,20:1 | 0,21 | 96,6 KB | 4,9 KB, 16,6 KB, 9,4 KB |
| Hierro | 24 de 24 | 3,07:1 | 0,16 | 72,5 KB | 8,9 KB, 27,3 KB, 17,8 KB |

#### Tiza

| Uso | Par | Contraste | Mínimo | Cumple |
|---|---|---|---|---|
| Texto principal | `#EEEDE6` sobre `#1A221E` | 13,85:1 | 4,5:1 | Sí |
| Texto principal en panel | `#EEEDE6` sobre `#222B26` | 12,41:1 | 4,5:1 | Sí |
| Texto en control y descanso | `#EEEDE6` sobre `#2D3832` | 10,38:1 | 4,5:1 | Sí |
| Texto secundario | `#C3C8C0` sobre `#1A221E` | 9,56:1 | 4,5:1 | Sí |
| Texto secundario en panel | `#C3C8C0` sobre `#222B26` | 8,56:1 | 4,5:1 | Sí |
| Texto secundario en descanso | `#C3C8C0` sobre `#2D3832` | 7,16:1 | 4,5:1 | Sí |
| Texto terciario y pestaña inactiva | `#9DA79E` sobre `#1A221E` | 6,55:1 | 4,5:1 | Sí |
| Texto terciario en panel | `#9DA79E` sobre `#222B26` | 5,87:1 | 4,5:1 | Sí |
| Texto terciario en control | `#9DA79E` sobre `#2D3832` | 4,91:1 | 4,5:1 | Sí |
| Estado «Hecha» | `#A8DCA8` sobre `#1A221E` | 10,43:1 | 4,5:1 | Sí |
| Estado «Hecha» en panel | `#A8DCA8` sobre `#222B26` | 9,34:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Víctor) | `#8CC8F2` sobre `#1A221E` | 9,03:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Virginia) | `#F2D04E` sobre `#1A221E` | 10,77:1 | 4,5:1 | Sí |
| Color de la persona en panel (Víctor) | `#8CC8F2` sobre `#222B26` | 8,09:1 | 4,5:1 | Sí |
| Color de la persona en panel (Virginia) | `#F2D04E` sobre `#222B26` | 9,65:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Víctor) | `#8CC8F2` sobre `#2D3832` | 6,77:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Virginia) | `#F2D04E` sobre `#2D3832` | 8,07:1 | 4,5:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Víctor) | `#1A221E` sobre `#8CC8F2` | 9,03:1 | 7:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Virginia) | `#1A221E` sobre `#F2D04E` | 10,77:1 | 7:1 | Sí |
| Borde de control | `#74847A` sobre `#1A221E` | 4,12:1 | 3:1 | Sí |
| Borde de control en panel | `#74847A` sobre `#222B26` | 3,69:1 | 3:1 | Sí |
| Borde de control en descanso | `#74847A` sobre `#2D3832` | 3,09:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Víctor) | `#8CC8F2` sobre `#1A221E` | 9,03:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Virginia) | `#F2D04E` sobre `#1A221E` | 10,77:1 | 3:1 | Sí |

Colores de persona con daltonismo (simulación de Machado et al., 2009; ΔE OKLab ≥ 0,10 se distinguen bien) y su contraste mínimo sobre el fondo:

| Visión | Víctor / Virginia | ΔE | Contraste con el fondo | Cumple |
|---|---|---|---|---|
| Visión normal | `#8CC8F2` / `#F2D04E` | 0,23 | 9,03:1 | Sí |
| Protanopia | `#b6c7f4` / `#e5cc3d` | 0,22 | 9,65:1 | Sí |
| Deuteranopia | `#a8bcf1` / `#eed755` | 0,24 | 8,62:1 | Sí |
| Tritanopia | `#64d3d6` / `#ffc0b5` | 0,18 | 9,16:1 | Sí |

Fuentes: atkinson-hyperlegible-next.woff2, bricolage-grotesque.woff2 (73,6 KB de 150). Iconos PNG: icono-192.png 8,2 KB, icono-512.png 26,2 KB, icono-maskable-512.png 17,1 KB.

#### Carril

| Uso | Par | Contraste | Mínimo | Cumple |
|---|---|---|---|---|
| Texto principal | `#EAF6FB` sobre `#062033` | 15,11:1 | 4,5:1 | Sí |
| Texto principal en panel | `#EAF6FB` sobre `#0B2C45` | 13,06:1 | 4,5:1 | Sí |
| Texto en control y descanso | `#EAF6FB` sobre `#123B5A` | 10,60:1 | 4,5:1 | Sí |
| Texto secundario | `#B5CEDD` sobre `#062033` | 10,17:1 | 4,5:1 | Sí |
| Texto secundario en panel | `#B5CEDD` sobre `#0B2C45` | 8,79:1 | 4,5:1 | Sí |
| Texto secundario en descanso | `#B5CEDD` sobre `#123B5A` | 7,14:1 | 4,5:1 | Sí |
| Texto terciario y pestaña inactiva | `#8FB0C5` sobre `#062033` | 7,28:1 | 4,5:1 | Sí |
| Texto terciario en panel | `#8FB0C5` sobre `#0B2C45` | 6,29:1 | 4,5:1 | Sí |
| Texto terciario en control | `#8FB0C5` sobre `#123B5A` | 5,11:1 | 4,5:1 | Sí |
| Estado «Hecha» | `#8BE3B9` sobre `#062033` | 10,92:1 | 4,5:1 | Sí |
| Estado «Hecha» en panel | `#8BE3B9` sobre `#0B2C45` | 9,44:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Víctor) | `#C6F04D` sobre `#062033` | 12,65:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Virginia) | `#FF7EB6` sobre `#062033` | 7,06:1 | 4,5:1 | Sí |
| Color de la persona en panel (Víctor) | `#C6F04D` sobre `#0B2C45` | 10,94:1 | 4,5:1 | Sí |
| Color de la persona en panel (Virginia) | `#FF7EB6` sobre `#0B2C45` | 6,10:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Víctor) | `#C6F04D` sobre `#123B5A` | 8,88:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Virginia) | `#FF7EB6` sobre `#123B5A` | 4,95:1 | 4,5:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Víctor) | `#062033` sobre `#C6F04D` | 12,65:1 | 7:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Virginia) | `#062033` sobre `#FF7EB6` | 7,06:1 | 7:1 | Sí |
| Borde de control | `#5D8BAC` sobre `#062033` | 4,56:1 | 3:1 | Sí |
| Borde de control en panel | `#5D8BAC` sobre `#0B2C45` | 3,94:1 | 3:1 | Sí |
| Borde de control en descanso | `#5D8BAC` sobre `#123B5A` | 3,20:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Víctor) | `#C6F04D` sobre `#062033` | 12,65:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Virginia) | `#FF7EB6` sobre `#062033` | 7,06:1 | 3:1 | Sí |

Colores de persona con daltonismo (simulación de Machado et al., 2009; ΔE OKLab ≥ 0,10 se distinguen bien) y su contraste mínimo sobre el fondo:

| Visión | Víctor / Virginia | ΔE | Contraste con el fondo | Cumple |
|---|---|---|---|---|
| Visión normal | `#C6F04D` / `#FF7EB6` | 0,35 | 7,06:1 | Sí |
| Protanopia | `#fee234` / `#8f9ab8` | 0,31 | 5,93:1 | Sí |
| Deuteranopia | `#f8e05a` / `#b1b2b3` | 0,21 | 7,83:1 | Sí |
| Tritanopia | `#d0e4d0` / `#ff7793` | 0,25 | 6,59:1 | Sí |

Fuentes: saira.woff2 (96,6 KB de 150). Iconos PNG: icono-192.png 4,9 KB, icono-512.png 16,6 KB, icono-maskable-512.png 9,4 KB.

#### Hierro

| Uso | Par | Contraste | Mínimo | Cumple |
|---|---|---|---|---|
| Texto principal | `#F4EEE6` sobre `#16120F` | 16,16:1 | 4,5:1 | Sí |
| Texto principal en panel | `#F4EEE6` sobre `#221C17` | 14,62:1 | 4,5:1 | Sí |
| Texto en control y descanso | `#F4EEE6` sobre `#2F2721` | 12,71:1 | 4,5:1 | Sí |
| Texto secundario | `#CDBFB1` sobre `#16120F` | 10,36:1 | 4,5:1 | Sí |
| Texto secundario en panel | `#CDBFB1` sobre `#221C17` | 9,37:1 | 4,5:1 | Sí |
| Texto secundario en descanso | `#CDBFB1` sobre `#2F2721` | 8,15:1 | 4,5:1 | Sí |
| Texto terciario y pestaña inactiva | `#A99B8C` sobre `#16120F` | 6,88:1 | 4,5:1 | Sí |
| Texto terciario en panel | `#A99B8C` sobre `#221C17` | 6,22:1 | 4,5:1 | Sí |
| Texto terciario en control | `#A99B8C` sobre `#2F2721` | 5,41:1 | 4,5:1 | Sí |
| Estado «Hecha» | `#9ED4A0` sobre `#16120F` | 10,98:1 | 4,5:1 | Sí |
| Estado «Hecha» en panel | `#9ED4A0` sobre `#221C17` | 9,93:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Víctor) | `#F5B13D` sobre `#16120F` | 9,97:1 | 4,5:1 | Sí |
| Color de la persona como texto o cifra (Virginia) | `#A99BFF` sobre `#16120F` | 7,82:1 | 4,5:1 | Sí |
| Color de la persona en panel (Víctor) | `#F5B13D` sobre `#221C17` | 9,02:1 | 4,5:1 | Sí |
| Color de la persona en panel (Virginia) | `#A99BFF` sobre `#221C17` | 7,08:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Víctor) | `#F5B13D` sobre `#2F2721` | 7,84:1 | 4,5:1 | Sí |
| Color de la persona en descanso (Virginia) | `#A99BFF` sobre `#2F2721` | 6,15:1 | 4,5:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Víctor) | `#16120F` sobre `#F5B13D` | 9,97:1 | 7:1 | Sí |
| Texto del botón principal y de la alarma (R08: ≥ 7:1) (Virginia) | `#16120F` sobre `#A99BFF` | 7,82:1 | 7:1 | Sí |
| Borde de control | `#7F7063` sobre `#16120F` | 3,90:1 | 3:1 | Sí |
| Borde de control en panel | `#7F7063` sobre `#221C17` | 3,53:1 | 3:1 | Sí |
| Borde de control en descanso | `#7F7063` sobre `#2F2721` | 3,07:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Víctor) | `#F5B13D` sobre `#16120F` | 9,97:1 | 3:1 | Sí |
| Botón principal (relleno) sobre el fondo (Virginia) | `#A99BFF` sobre `#16120F` | 7,82:1 | 3:1 | Sí |

Colores de persona con daltonismo (simulación de Machado et al., 2009; ΔE OKLab ≥ 0,10 se distinguen bien) y su contraste mínimo sobre el fondo:

| Visión | Víctor / Virginia | ΔE | Contraste con el fondo | Cumple |
|---|---|---|---|---|
| Visión normal | `#F5B13D` / `#A99BFF` | 0,29 | 7,82:1 | Sí |
| Protanopia | `#cab42b` / `#7caaff` | 0,28 | 8,03:1 | Sí |
| Deuteranopia | `#dac441` / `#7ca6fd` | 0,29 | 7,74:1 | Sí |
| Tritanopia | `#ff9f9a` / `#94aec1` | 0,16 | 8,06:1 | Sí |

Fuentes: onest.woff2, sofia-sans-extra-condensed.woff2 (72,5 KB de 150). Iconos PNG: icono-192.png 8,9 KB, icono-512.png 27,3 KB, icono-maskable-512.png 17,8 KB.
<!-- contraste:fin -->

### Otras comprobaciones (Playwright)

`node prototipos/identidad/herramientas/capturas.mjs` hace las capturas y comprueba, en 360 × 640 y 320 × 568:

| Comprobación | Tiza | Carril | Hierro |
|---|---|---|---|
| Sin desplazamiento horizontal (R24) | Sí | Sí | Sí |
| Zonas táctiles ≥ 48 px en sesión y ≥ 44 px en el resto (R01) | Sí | Sí | Sí |
| Cifras de la sesión ≥ 28 px (R06) | Sí (32 y 48 px) | Sí (56 px) | Sí (88 y 72 px) |
| Serie actual entera y sin tapar en 360 × 640 (R03) | Sí, sobran 74 px | Sí, sobran 30 px | Sí, sobran 79 px |
| Serie actual en 320 × 568 | El botón queda visible; el borde inferior de la fila (12 px) queda bajo el descanso | Igual, 8 px | Entera, sobran 37 px |
| Acción principal en el tercio inferior (R07), 360 × 640 | Hoy 84 %, sesión 67 % | Hoy 84 %, sesión 72 % | Hoy 84 %, sesión 68 % |
| Alarma salta al acabar el descanso y se cierra sola | Sí | Sí | Sí |
| Peticiones fuera del sitio y errores de consola | 0 | 0 | 0 |

Cada página lleva una CSP sin `'unsafe-inline'` (ni `<script>` en línea, ni `on…=`, ni atributos `style`): lo que cambia con los datos se pone por CSSOM. Es la misma regla que heredará la app.

---

## Archivos

| Ruta | Qué es |
|---|---|
| `prototipos/identidad/index.html`, `indice.css`, `indice.js` | Índice y comparador (neutro, con la letra del sistema, para no inclinar la elección) |
| `prototipos/identidad/{tiza,carril,hierro}/` | Cada dirección: `index.html`, `estilo.css` (tokens y estilo), `pantallas.js` (cómo pinta Hoy, Sesión, Progreso y el final), `logo.svg`, `icono.svg`, `icono-maskable.svg`, `icono-192.png`, `icono-512.png`, `icono-maskable-512.png` y `fuentes/` (woff2 + licencia OFL) |
| `prototipos/identidad/comun/` | Datos de ejemplo (`datos.js`), motor común (`demo.js`: persona, rutas, series, descanso, alarma y celebración) y `base.css` |
| `prototipos/identidad/contraste.mjs`, `color.mjs` | Medida de contraste y daltonismo; `--escribir` actualiza la tabla de arriba |
| `prototipos/identidad/herramientas/` | `marcas.py` (genera logos e iconos SVG; el nombre va en curvas con fontTools), `iconos.mjs` (PNG con Chromium), `capturas.mjs` (capturas y comprobaciones), `servidor.mjs` |
| `prototipos/identidad/capturas/` | Capturas a 390 × 844 (escala 2): `{dirección}-{hoy,sesion,progreso,celebracion}-{victor,virginia}.png`, `{dirección}-alarma-victor.png` e `indice.png` |

**Fuentes** (todas SIL Open Font License 1.1, descargadas de los paquetes `@fontsource-variable/*` de npm y alojadas en el repositorio; subconjunto latino, que cubre el español): Bricolage Grotesque, Atkinson Hyperlegible Next, Saira, Sofia Sans Extra Condensed y Onest.

**Vista previa:** `vercel.json` solo añade cabeceras, así que `/prototipos/identidad/` se sirve como estático. El `sw.js` de la app capturaba cualquier navegación y devolvía (y sobrescribía) el `index.html` de la app; ahora deja pasar `/prototipos/` a la red. Si un móvil ya tenía instalada la app de esta vista previa, la primera visita puede enseñar la app: recarga una vez y ya sale el prototipo. Esta rama no se fusiona, así que el cambio no llega a producción.

## Volver a generar

```
pip install fonttools brotli                         # solo para regenerar logos
python3 prototipos/identidad/herramientas/marcas.py
node prototipos/identidad/herramientas/iconos.mjs
node prototipos/identidad/herramientas/capturas.mjs
node prototipos/identidad/contraste.mjs --escribir
```
