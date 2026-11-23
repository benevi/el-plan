# Re-auditoría de Pipos Fitness v2 · 22-11-2026

Re-auditoría final del plan (PR 18): siete auditores independientes sobre `pipos-v2` en `f3164ec` (tras el PR 17), con los mismos enfoques que la primera auditoría. Cada hallazgo está demostrado con un script salvo que diga «sin demostrar». Sin llamadas reales a la IA ni a Vercel.

Informes completos en `docs/qa/reauditoria/<enfoque>.md` y scripts de reproducción en `docs/qa/reauditoria/scripts/<enfoque>/` (se ejecutan desde la raíz del repo en el commit auditado).

## Resultado

| Enfoque | Críticos | Altos | Medios | Bajos |
|---|---|---|---|---|
| Seguridad | 0 | 0 | 3 | 3 |
| Datos | 0 | 2 | 4 | 2 |
| Sin conexión y despliegue | 0 | 1 | 3 | 3 |
| Salud y entrenamiento | 0 | 3 | 9 | 7 |
| IA | 0 | 1 | 4 | 2 |
| Uso y accesibilidad | 0 | 1 | 2 | 4 |
| Código y pruebas | 0 | 2 | 4 | 6 |
| **Total** | **0** | **10** | **29** | **27** |

La primera auditoría tenía 8 críticos y unos 30 altos; ninguno de ellos sigue abierto. Ahora no hay críticos, pero quedan 10 altos, así que **el PR 18 no cumple todavía su criterio** (0 críticos y 0 altos). Se arreglan en tres PR por tema (abajo) y después se repiten los scripts de esta re-auditoría.

## Altos

| id | Qué pasa | Arreglo en |
|---|---|---|
| Salud S1 | Rehabilitación de fase 2-3 que se queda con el dolor de hoy en B2 (venía del plan o de la IA) | entrenador |
| Salud S2 | Movilidad y estiramientos de la zona dolorida que su ficha limita a B0-B1, en B2 y en el día de dolor alto | entrenador |
| Salud S3 | Crol, espalda y nado continuo para quien no sabe nadar 2×25 m con nivel 2-3; aquajogging «en la parte honda» al principiante | entrenador |
| IA-1 | La sesión de último recurso de la IA (C-TIEMPO-3) se descarta con el aviso falso «La IA no propuso ejercicios válidos»; reintentar vuelve a pagar | entrenador |
| COD-1 | «Cambiar por otro» ofrece ejercicios que el validador rechaza (la regla está escrita dos veces) | entrenador |
| COD-2 | El nivel no baja solo tras 56 días sin entrenar con el nivel automático (C-NIVEL-3) | entrenador |
| Datos D1 | Una subida a la nube que falla no se reintenta ni avisa | datos |
| Datos D2 | Cargar dos copias seguidas pierde para siempre lo que había antes de la primera | datos |
| Uso U1 | Una hoja abierta tapa la barra y la alarma visual del descanso, que se cierra sola a los 8 s | interfaz |
| Despliegue D1 | Las fotos de progreso y las rutinas de `main` no se migran ni van en ninguna copia | Víctor y Virginia no tienen fotos; las rutinas, en la lista de lanzamiento (abajo) |

Los medios y bajos de cada enfoque están en su informe; casi todos van en los mismos tres PR.

## Criterios T

| T | Estado | Por qué |
|---|---|---|
| T1 | No cumple por poco | Calentamiento y estiramientos 100 %; sin cardio en 8 de 450 combinaciones (casa o calle con dos zonas en B2, S7) |
| T2 | Cumple en carga, fortalecimiento y minutos | La movilidad del día de dolor alto incumple C-DOLOR-4 y C-EST-2 (S2) |
| T3 | No cumple | S1, S3, S6, S11 y COD-1 |
| T4 | No cumple | D2, D3, D4 y D6; las pruebas de la tabla del plan existen y pasan |
| T5 | Cumple en Chromium | Paso desde la app real de `main`, modo avión con la sesión creada y marcha atrás de ida y vuelta. Sin comprobar en iOS |
| T6 | Cumple | Choca con D-B en el número de series (S14) |
| T7 | Cumple las pruebas | Falta freno al gasto y a los intentos de código (seguridad S1); la prueba del 413 usa la misma constante (COD-7) |
| T8 | Cumple (23-11) | Opus 5.5, 20 casos × 3 contra la vista previa: validador 100 %, rúbrica 100 % tras el PR #49. Ver `docs/qa/ia/2026-11-23-resumen.md` |
| T9 | Cumple en la sesión, contraste y movimiento reducido | U2 (días de 42 px), U3 (texto ×2) y COD-5 (320×568 sin comprobar de verdad) |
| T10 | Cumple | COD-8 y COD-9 |
| T11 | No cumple del todo | Restaurar con la frase y copia ilegible sin ella: sí. «Menos de 1 minuto» solo si la primera subida funciona (D1, COD-3); frases débiles (seguridad S3) |

## Batería de recorridos (PR 18)

`tests/e2e/recorridos.spec.mjs` recorre de principio a fin a Víctor y a Virginia: migración desde datos reales de `main`, perfil, plan por reglas, check-in, sesión entera con descanso y alarma, cierre, Progreso, Ejercicios y valoraciones, una sesión propia de casa, una sesión de la IA simulada con ajustes de la app, dolor 7 con sesión suave, copia a archivo y restauración en un navegador limpio, modo avión y actualización a una versión nueva con la sesión en curso. Comprueba en cada paso los criterios T1-T3, que no hay errores en consola ni violaciones de CSP. No encontró fallos.

Deja fijadas tres cosas que conviene saber:
- «No me gusta» solo penaliza un ejercicio; el que nunca sale es «No lo quiero».
- Si la IA propone algo que la app no le ofreció (rechazado o que carga la zona dolorida), el servidor lo descarta en silencio.
- Un dolor de 7 o más arrastra al check-in del día siguiente si es de hace 3 días o menos (C-DOLOR-0 y C-DOLOR-4).

## Cambios en la lista de lanzamiento y marcha atrás

Del informe de despliegue (D1-D4, D6):
- **Antes de lanzar:** comprobar en Vercel que `APP_CODE`, `ANTHROPIC_API_KEY` y el almacén Blob están en el entorno **Production** (el simulacro en la vista previa guarda en `preview/` y no lo demuestra). Lo hace Víctor.
- **Paso 2 (exportar en la app vieja):** además de la copia, apuntar las rutinas propias de la app vieja si las hay, porque no se migran.
- **Paso 11 (reinstalar en iPhone):** solo después de comprobar en otro navegador que la copia de la nube se restaura entera.
- **Marcha atrás:** en el plan Hobby, Vercel solo deja volver al despliegue de producción inmediatamente anterior, y tras volver deja de publicar los commits nuevos de `main` hasta hacer «Promote» o «Undo rollback». Alternativa: `git revert` del merge en `main` (con el OK de Víctor).
- **Durante la marcha atrás:** la app vieja no ve lo entrenado en v2 ni las copias en la nube; no apuntar otra vez lo ya hecho (al volver a v2 se recupera todo).
- **En iOS,** «abrir la app dos veces» es cerrarla del todo desde el selector de apps y volver a abrirla.
