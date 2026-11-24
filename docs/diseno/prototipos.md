# DIS 4 · Prototipos: pantalla nueva del PR 16

> Este archivo completa `docs/diseno/prototipos.md` de la rama `diseno-prototipos` (DIS 4), que aún no está en
> `pipos-v2`. Al unirlas, este apartado pasa tal cual al final de aquel documento (apartado 7).

## 7. Editor de «Mis sesiones» (PR 16, pedido por Víctor)

Pantalla nueva, sin prototipo previo: diseñada con el sistema de DIS 3 (tokens, chips, segmento, selector ±,
tarjeta, hoja inferior, aviso) y el estilo aprobado de Perfil y Ejercicios. Sin IA en ningún paso.

**Dónde:** Perfil › Mi entreno › Mis sesiones → «Crear sesión» (`#mia/nueva`) o «Editar» en cada sesión
guardada (`#mia/<id>`). Atajo: en la ficha de cada ejercicio, «Añadir a una de mis sesiones» (hoja: elegir una
guardada o «Crear una sesión nueva con este ejercicio», que abre el editor con él). La pestaña activa sigue
siendo Perfil.

**Patrón** (guía `page-patterns`): formulario en página propia (es una tarea de más de 10 s con muchos
campos); el buscador del catálogo, en hoja inferior (guía `surfaces`), con los mismos filtros que Ejercicios.

| Zona | Qué hay | Detalle |
|---|---|---|
| Arriba | «‹ Mis sesiones» (vuelve a Perfil › Mi entreno sin guardar), h1 «Nueva sesión» / «Editar sesión» y una línea de ayuda | La ayuda dice lo que pasa al hacerla: calentamiento, cardio y estiramientos siempre; solo cambia lo que choque con el dolor, el lugar o el material (C-MIA-1) |
| Nombre y lugar | Campo con etiqueta visible (hasta 40 letras, sin repetir) y segmento de lugar en rejilla de 2 × 2 | Si un ejercicio no es del lugar elegido, la tarjeta lo marca («No es de gimnasio») y una línea dice que al hacerla se cambiará por otro del mismo músculo |
| Ejercicios | Lista numerada de tarjetas: nombre, músculos y material, insignias de riesgo; tres selectores ± (Series, Repeticiones / Tiempo / Distancia según el tipo del ejercicio, Descanso); Subir, Bajar y Quitar | Valores propuestos por la app según el nivel (C-DOSIS-2 a 6, C-PAUSA-1); tope de series de D-B: 3 principiante, 4 intermedio y avanzado (natación por distancia, 10, C-SERIES-1). Repeticiones y tiempo se recorren por una escala de rangos («8-10», «8-12», «10-15»…) que conserva «c/lado» |
| Añadir | Botón «Añadir ejercicios» → hoja con buscador, filtros por músculo, lugar (empieza en el de la sesión) y material, y la lista | Cada fila añade con un toque y queda «Añadido» (no se repite); «Listo» cierra. Contador «n ejercicios · m en la sesión» como `role="status"` |
| Abajo | «Guardar sesión» / «Guardar cambios»; al editar, «Borrar «nombre»» con confirmación que la nombra | Guardar valida nombre, nombre repetido, al menos un ejercicio, 30 ejercicios por sesión y 30 sesiones; el error va junto a su campo y el foco a él |

**Accesibilidad:** todo con botones nativos; Subir y Bajar son botones con nombre («Subir Flexiones») y
`aria-disabled` en los extremos (el foco no se pierde al mover); al mover, añadir o quitar, un mensaje de estado
lo dice («Flexiones: puesto 1 de 3»); al quitar, el foco pasa al ejercicio que ocupa su sitio. Los selectores son
`spinbutton` (flechas, Re Pág/Av Pág, Inicio, Fin) con `aria-valuetext` completo («8 a 12 repeticiones por
lado»); el lugar es un `radiogroup` con flechas. Zonas táctiles de 44 px o más también a 320 × 568 (los tres
selectores pasan a dos columnas en móviles estrechos). Contraste AA medido en Víctor y Virginia.

**Datos:** la forma de `S.misSesiones` no cambia (ninguna clave nueva); la lógica está en
`js/areas/entrenador/mias.js` (`propuestaMia`, `guardarEdicionMia`, `añadirAMia`).

**Capturas** (390 × 844): `docs/diseno/capturas-pr16/editor-nueva-victor.png`, `editor-mia-*.png`,
`editor-editar-victor.png`, `editor-buscador-*.png`, `ficha-anadir-a-mia-*.png`, `perfil-mis-sesiones-*.png`.
