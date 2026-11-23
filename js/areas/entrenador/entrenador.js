// Área ENTRENADOR (cerebro): plan de la semana, sesión del día y cómo cambian con lo que pasa.
//
// Quién decide qué:
// - La IA (/api/entrenador) diseña el plan de la semana y, cuando hace falta pensar (dolor nuevo, una petición,
//   otro lugar, poca energía…), la sesión del día. Cada llamada cuesta dinero, así que no se llama por rutina.
// - Las reglas de esta área montan un plan y una sesión completos sin IA (sin red, sin saldo o en modo ahorro)
//   y ajustan cada día al check-in: energía, dolor, tiempo, lugar, recuperación, progresión, gustos y comentarios.
// - Barandillas sobre lo que diga la IA: solo ejercicios seguros, kilos acotados, siempre calentamiento,
//   rehabilitación de las lesiones activas, cardio en toda sesión (D3) y vuelta a la calma con estiramientos.
//
// Dónde está cada cosa (esta es la fachada: el resto de la app importa de aquí):
// - dia.js      una sesión con reglas: dosis, regla de cardio, porqués y tiempo.
// - plan.js     la semana: reparto, plan sin IA, estado de cada día y reorganizar.
// - checkin.js  el día ajustado al check-in y cuándo merece la pena la IA.
// - ia.js       petición a la IA, barandillas sobre su respuesta, sesión de hoy y plan de la semana.
// - validar.js  validador único de sesiones: toda sesión pasa por él antes de guardarse (PR 8).
// - dolor-alto.js  el día con dolor de hoy ≥ 7 (D2): plantilla fija, sin IA.
// - alarma.js   señales de alarma, palabras de alarma en textos libres y textos fijos T1-T8.
// - salud.js    datos de salud del perfil (D4) y sus restricciones.
// - mias.js     «Mis sesiones»: guardar una sesión para repetirla (el check-in la ajusta a hoy, sin IA).

export { dosis, reglaCardio, montarDia, tiempoEj, tiempoSesion, bandasHoy, soloRehab, limiteDolor, alternativasHoy, ejercicioCambiado, contextoDia } from './dia.js';
export { validarSesion, problemasSesion, normalizarReps } from './validar.js';
export { diaDolorAlto, tablaDolorAlto } from './dolor-alto.js';
export { fraseAlarma, alarmaPendiente, avisosConsulta, SEÑALES, SEÑALES_CORTAS, T1, T2, T3, T3b, T6, T8 } from './alarma.js';
export { restriccionesSalud, etiquetasSalud, CAMPOS_SALUD, MEDICACION, AVISO_VISTO_BUENO } from './salud.js';
export { ajustesPorTendencia, diasPorDefecto, planReglas, planDeLaSemana, estadoDias, planDeHoy, diaElegido, siguientePendiente, reorganizar, noPuedoHoy } from './plan.js';
export { ajustarAlCheckin, motivoIA, previaCheckin, dolorNuevoSinLesion, guardarDolorComoLesion } from './checkin.js';
export { crearSesionHoy, crearPlanSemana, preguntaAntes, sinEntrenarHoy, pararPorAlarma, DESDE, fraseIAOk } from './ia.js';
export { misSesiones, miaDe, guardarMia, renombrarMia, borrarMia, motivoNoGuardar, MAX_MIAS, LARGO_NOMBRE_MIA,
  ejerciciosMia, propuestaMia, topeSeriesMia, guardarEdicionMia, motivoNoGuardarEdicion, añadirAMia, MAX_EJERCICIOS_MIA, DESCANSO_MAX_MIA } from './mias.js';
