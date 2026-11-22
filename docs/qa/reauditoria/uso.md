# Re-auditoría PR 18 · Enfoque: uso (T9 y «funciones que no hacen lo que dicen»)

**Resumen.** Recorrí la app entera como Víctor y como Virginia en Chromium a 360×640, 390×844 y 320×568, con movimiento reducido, solo con el teclado, con texto ×1,5 y ×2 (zoom de página) y en apaisado. El contraste AA pasa en todas las pantallas y hojas, medido con `tests/e2e/medir-contraste.mjs`. No hay desplazamiento horizontal y no salen errores de consola. Los arreglos E5 (cardio en minutos), E6 (lados) y E7 (sesión sin series) funcionan. Queda **1 fallo alto**: cuando hay una hoja abierta, tapa el cronómetro del descanso y su alarma visual. También quedan **2 medios** (días de «Tu semana» por debajo de 44 px, y el cronómetro no se puede usar con texto ×2) y **4 bajos**.

Árbol auditado: `/home/user/wt/auditoria` (`f3164ec`). Servidor: `tests/e2e/servidor.mjs` en el puerto 8961. IA simulada con un 503. Scripts en `uso/scripts/` y capturas en `uso/capturas/` (las dos carpetas están dentro de esta carpeta de re-auditoría).

| id | sev. | título | archivo:línea |
|---|---|---|---|
| U1 | **alto** | Con una hoja abierta («Más opciones», «Cómo se hace», «Cambiar por otro», «Algo va mal»…), el descanso y su alarma visual quedan tapados | `css/componentes.css:237` y z-index del temporizador (50) frente a `.hoja-fondo` (70); `js/areas/sesion/temporizador.js:305-316` |
| U2 | medio | Días L-D de «Tu semana» y de «Reorganizar»: 42×44 px a 360 y 37×44 px a 320 (T9 pide ≥ 44) | `js/areas/entrenador/indice.js:321,345` (chips `entrenador.psDia` / `roDia`) |
| U3 | medio | Con texto ×2 (zoom de Android, 180 px CSS), los botones «Pausar» y «Hecho» / «Cambiar de lado» del contador quedan fuera de la pantalla y no se puede desplazar hasta ellos; «Saltar» del descanso se sale por la derecha | `css/componentes.css:237` (`.contador--pantalla` fija, `overflow:hidden`); barra de descanso |
| U4 | bajo | El botón atrás con el contador a pantalla completa cambia la pantalla de debajo y deja el contador encima | `js/areas/sesion/temporizador.js:235-283` (el contador no entra en el historial, al contrario que las hojas) |
| U5 | bajo | Primera vez: tras elegir persona se cae en Perfil (7 partes) sin ninguna indicación de qué hacer ni de volver a Hoy | `js/areas/perfil/bienvenida.js:47` |
| U6 | bajo | «Algo va mal» sin lesiones: «Si es solo el dolor de tu lesión y pasa de 3/10…» y el bloque «Si es solo el dolor de tu lesión» le salen a quien no tiene ninguna | `js/areas/sesion/indice.js:402-409` |
| U7 | bajo | Texto: «Pecho, Cuádriceps, Espalda, Isquios.» en mayúsculas a mitad de frase (Hoy, hoja del día) | foco del día del plan (`js/areas/hoy/indice.js:147`, `dia.foco`) |

## U1 · La hoja tapa el descanso y la alarma (alto)
- **Qué pasa:** durante un descanso, Virginia toca «Más opciones» y después «Cómo se hace» para repasar la técnica (es lo natural entre series). La hoja (z 70) tapa la barra del descanso (z 50). No ve cuánto le queda. Cuando el descanso termina, la alarma se pinta debajo de la hoja, no recibe el foco (`alarmaDescanso` no la enfoca si hay `.hoja-fondo`) y se cierra sola a los 8 s. Solo quedan la vibración y el pitido.
- **Reproducir:** `uso/scripts/04-alarma-hoja.mjs` y `uso/scripts/04b-ficha-descanso.mjs`. Ambos imprimen `tapado:true` a mitad del descanso y al saltar la alarma. Capturas: `04b-ficha-tapa-descanso.png`, `04b-ficha-tapa-alarma.png` y `04-alarma-con-hoja.png`.
- **Por qué importa:** en `CLAUDE.md`, «el cronómetro… con **alarma visual** y vibración. Tiene que ir perfecto», y la ficha de cada ejercicio es una exigencia de Víctor. Con el sonido quitado (muchos van con música) solo queda la vibración. Rompe T9 en su función principal.
- **Arreglo:** con una hoja abierta, la barra del descanso y la alarma deben quedar por encima del fondo de la hoja; por ejemplo, la hoja reserva `--alto-descanso` abajo y el temporizador pasa a un z-index mayor que `.hoja-fondo`. Otra opción: que la alarma cierre la hoja. Hace falta una e2e: descanso → abrir ficha → fin → alarma visible con `elementFromPoint`.

## U2 · Días de la semana pequeños (medio)
- 360×640: 42×44 px; 320×568: 37×44 px, en «Montar mi semana», «Cambiar días» y «Hoy no puedo → Reorganizar». Lo saca `uso/scripts/07-barrido.mjs 360 640 victor` y `… 320 568 virginia`. Capturas: `02-victor-360-hoja-semana.png`, `07-virginia-320x568-hoja-semana.png`.
- La prueba de zonas de `tests/e2e/pr16.spec.mjs` no mide estas hojas de Hoy.
- **Arreglo:** que la fila pueda hacer scroll horizontal o salte a dos líneas, o quitar el hueco entre días. Hay que llegar a ≥ 44×44 px.

## U3 · Contador y descanso con texto ×2 (medio)
- En Android, la escala de texto del sistema se aplica como zoom de página. Como el CSS está todo en px, ×2 en un móvil de 360 deja 180×320 CSS px. El contador es `position:fixed; overflow:hidden` y mide 410 px dentro de 320, así que los botones quedan en y = 360-416 y la rueda o el arrastre no los mueven. En la barra de descanso, «Saltar» se sale por la derecha y «−15» se monta encima del reloj. Con ×1,5 (240 px) y en apaisado (640×360 y 568×320) sí cabe todo.
- **Reproducir:** `uso/scripts/09-zoom.mjs` y `uso/scripts/09b.mjs`. Capturas: `09-180-contador.png` y `09-180-descanso.png`.
- **Arreglo:** `overflow-y:auto` en `.contador--pantalla` y bajar el tamaño del reloj con `clamp()` / `vh`. En la barra de descanso, que los botones pasen a una segunda fila cuando no caben.

## U4 · Atrás con el contador abierto (bajo)
- `uso/scripts/03-crono.mjs`: con la plancha contando, `goBack()` cambia el hash a otra pantalla y el contador sigue encima. «Hecho» apunta bien (usa `meta.sesion`), pero después la barra del descanso sale sobre Perfil y no hay forma de volver a la sesión desde ella. Captura: `03-360-hecho-fuera.png`.
- **Arreglo:** que el contador entre en el historial, como las hojas (PR 13), y que atrás haga lo mismo que «✕ Cancelar sin apuntar» (o lo pregunte).

## U5 · Primera vez sin guía (bajo)
- Al elegir persona se va a `#perfil` («Sin objetivos · principiante»). Ningún texto dice «elige tu objetivo y vuelve a Hoy». Hoy sí tiene «Completar mi perfil», pero no se pasa por Hoy. Lo muestra `uso/scripts/02-recorrido.mjs`.
- **Arreglo:** ir a Hoy (la tarjeta «Cuéntale a tu entrenador quién eres» ya lo cuenta), o poner un aviso en Perfil con «Listo, ver mi semana» cuando ya hay un objetivo.

## U6 · «Algo va mal» habla de «tu lesión» sin lesión (bajo)
- Víctor no tiene lesiones y lee «Si es solo el dolor de tu lesión y pasa de 3/10…», con un selector de todas las zonas. Lo muestra `uso/scripts/08-funciones.mjs`. Apuntar un dolor nuevo durante la sesión tiene sentido; lo que no encaja es el texto.
- **Arreglo:** sin lesiones activas, poner «Si te duele una zona al hacer un ejercicio».

## U7 · Mayúsculas en el foco del día (bajo)
- «Gimnasio, 6 ejercicios, unos 61 min. Pecho, Cuádriceps, Espalda, Isquios.» (`02-victor-360-hoy-conplan.png`). Es de la familia de M15, pero no aparece en la lista de M15.

## Comprobado y correcto
- **Contraste AA:** 0 fallos en Hoy, hojas de semana, día y reorganizar, check-in (arriba y abajo), sesión en «uno a uno» y en lista, descanso, alarma, menú, cambiar, «Algo va mal», cierre, pantalla final, Progreso, Ejercicios, ficha y las 7 partes de Perfil, para las dos personas en los tres tamaños.
- **Zonas táctiles:** en toda la sesión ≥ 48 px, también a 320. En el resto ≥ 44 px salvo U2. Las casillas de 20-22 px están dentro de etiquetas de ≥ 238×44.
- **Cronómetro:** el «c/lado» hace los dos lados, «Cambiar de lado», la previa de 5 s, pausa y seguir (con 10 s en pausa no avanza), apunta el lado más flojo (23 frente a 27 → «23»); el cardio de 8 min sale en minutos («objetivo 8 min», «7:59») y, con 9 min bloqueado, pregunta con paso de 1 min y apunta «8 min»; la vibración de la alarma es `[250,120,250,120,250]` y se cierra a los 8 s; la serie actual se ve sin desplazarse a 320×568 en todos los pasos. «Sin contador» → «Apuntar» guarda el valor escrito.
- **Teclado y lector:** el orden de Tab es lógico y el foco se ve en todos los controles (también en el paso actual relleno, con doble anillo); los spinbutton tienen nombre y valor; la tira de pasos tiene nombres completos; `role=timer`, la alarma con `role=alert`.
- **Botones que hacen lo que dicen:** «Hoy no puedo → Reorganizar» un miércoles (mueve al jueves); «Pedírsela igualmente al entrenador IA» llama de verdad a `/api/entrenador`; «Algo va mal → Termino la sesión aquí → Terminar aquí» deja Hoy en «Sin entrenar por precaución» con «La marqué por error»; «Terminar» sin nada marcado no guarda (E7).
- Lo que sigue apareciendo y ya está en el informe del 21-11 como menor (no lo repito): el resumen de la semana tras reorganizar y «cuerpo completo a» en minúsculas (M15), «unos 61 min» con 60 pedidos (M1), el consejo de la cadera lateral en la bici de Víctor (M15) y el check-in que sale siempre (M21).

## Criterio T9
- Prototipos aprobados y capturas iguales al prototipo: **no comprobado** (fuera de este enfoque).
- Zonas ≥ 48 px en la sesión: **cumple** (`07-barrido.mjs`, `10-tiempo-320.mjs`). Zonas ≥ 44 px en el resto: **no cumple** (U2).
- Contraste AA por script: **cumple** (`07-barrido.mjs`, las 3 medidas × 2 personas).
- Primera serie visible sin desplazarse en 360×640 (y 320×568): **cumple** (`10-tiempo-320.mjs`; también `sesion.spec.mjs`).
- Movimiento reducido: **cumple** en lo recorrido (alarma y final sin animación, con la misma información).
- 60 fps con CPU ×4: **no comprobado**.
- «Usable con una mano / el cronómetro tiene que ir perfecto»: **no cumple** mientras siga U1.
