// Área ENTRENADOR (cerebro): plan de la semana, sesión del día y cómo cambian con lo que pasa.
//
// Quién decide qué:
// - La IA (/api/entrenador) diseña el plan de la semana y, cuando hace falta pensar (dolor nuevo, una petición,
//   otro lugar, poca energía…), la sesión del día. Cada llamada cuesta dinero, así que no se llama por rutina.
// - Las reglas de esta área montan un plan y una sesión completos sin IA (sin red, sin saldo o en modo ahorro)
//   y ajustan cada día al check-in: energía, dolor, tiempo, lugar, recuperación, progresión, gustos y comentarios.
// - Barandillas sobre lo que diga la IA: solo ejercicios seguros, kilos acotados, siempre calentamiento,
//   rehabilitación de las lesiones activas, cardio si el objetivo lo pide y vuelta a la calma.
//
// Dónde está cada cosa (esta es la fachada: el resto de la app importa de aquí):
// - dia.js      una sesión con reglas: dosis, regla de cardio, porqués y tiempo.
// - plan.js     la semana: reparto, plan sin IA, estado de cada día y reorganizar.
// - checkin.js  el día ajustado al check-in y cuándo merece la pena la IA.
// - ia.js       petición a la IA, barandillas sobre su respuesta, sesión de hoy y plan de la semana.
// - validar.js  validador único de sesiones (vacío hasta el PR 8).

export { dosis, reglaCardio, montarDia, tiempoEj, tiempoSesion } from './dia.js';
export { ajustesPorTendencia, diasPorDefecto, planReglas, planDeLaSemana, estadoDias, planDeHoy, diaElegido, siguientePendiente, reorganizar } from './plan.js';
export { ajustarAlCheckin, motivoIA, previaCheckin } from './checkin.js';
export { crearSesionHoy, crearPlanSemana } from './ia.js';
