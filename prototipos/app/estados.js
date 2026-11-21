// Mapa de pantallas y estados del prototipo: [grupo, [[nombre, escenario, ruta]]]. «g:x» abre el grupo x del perfil.
// Lo usan el menú «Prototipo» (app.js) y las capturas y comprobaciones (comprobar.mjs).
export const MAPA = [
  ['Hoy', [['Con plan', 'plan', 'hoy'], ['Primera vez', 'primera', 'hoy'], ['Sin plan esta semana', 'sinplan', 'hoy'], ['Día de descanso', 'descanso', 'hoy'], ['Sesión en marcha', 'marcha', 'hoy'], ['Sesión de ayer sin cerrar', 'ayer', 'hoy'], ['Sin conexión', 'sinred', 'hoy'], ['Sesión hecha', 'hecha', 'hoy']]],
  ['Check-in', [['Antes de empezar', 'plan', 'checkin'], ['Espera de la IA', 'espera', 'checkin'], ['Fallo de la IA', 'fallo', 'sesion'], ['Sin conexión', 'sinred', 'checkin']]],
  ['Sesión', [['Uno a uno', 'sesion', 'sesion'], ['Toda la sesión', 'lista', 'sesion'], ['Ejercicio por tiempo', 'tiempo', 'sesion'], ['Cardio', 'cardio', 'sesion'], ['Cómo se hace', 'ficha', 'sesion'], ['Menú del ejercicio', 'menu', 'sesion'], ['Cambiar ejercicio', 'cambiar', 'sesion'], ['Guardar como mía', 'mia', 'sesion'], ['Terminar con series pendientes', 'pendientes', 'sesion'], ['Cierre', 'cierre', 'sesion'], ['Final', 'final', 'sesion'], ['Sesión hecha (lectura)', 'leer', 'sesion']]],
  ['Descanso', [['Barra de descanso', 'descanso-s', 'sesion'], ['Alarma de fin', 'alarma', 'sesion'], ['Vuelta tras bloquear', 'volver', 'sesion']]],
  ['Progreso', [['Vacío', 'vacio', 'progreso'], ['Primera semana', 'semana', 'progreso'], ['Un año de datos', 'año', 'progreso'], ['Apuntar medidas', 'medidas', 'progreso']]],
  ['Perfil', [['Objetivos y nivel', 'g:objetivos', 'perfil'], ['Lesiones', 'g:lesiones', 'perfil'], ['Nueva lesión', 'lesion-nueva', 'perfil'], ['Editar lesión', 'lesion-editar', 'perfil'], ['Salud', 'g:salud', 'perfil'], ['Mi entreno', 'g:entreno', 'perfil'], ['Mis datos', 'g:datos', 'perfil'], ['Copias', 'g:copias', 'perfil'], ['Ajustes', 'g:ajustes', 'perfil']]],
  ['Más', [['Bienvenida', 'bienvenida', 'bienvenida'], ['Ejercicios', 'plan', 'ejercicios'], ['Ficha de un ejercicio', 'ficha-ej', 'ejercicios']]],
];
