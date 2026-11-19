// Arranque de Pipos Fitness: carga los datos, aplica el color de la persona, registra las áreas y pinta.
// Cada área se registra sola al importarse (rutas, acciones y pestaña). Para añadir un área nueva,
// crea js/areas/<area>/indice.js e impórtala aquí.

import { cargar, estado, escuchar } from './nucleo/estado.js';
import { arrancar, pintar } from './nucleo/router.js';
import { cerrarHoja } from './nucleo/ui.js';
import { PERSONAS } from './datos/constantes.js';

import './areas/perfil/bienvenida.js';
import './areas/hoy/indice.js';
import './areas/entrenador/indice.js';
import './areas/sesion/indice.js';
import './areas/progreso/indice.js';
import './areas/ejercicios/indice.js';
import './areas/perfil/indice.js';
import './areas/nutricion/indice.js';

function colorPersona() {
  const p = PERSONAS[estado().dueño];
  const r = document.documentElement.style;
  r.setProperty('--acc', p ? p.color : '#4DD0E8');
  r.setProperty('--acc-2', p ? p.color2 : '#2A9BC2');
  document.body.dataset.persona = estado().dueño || '';
}

cargar();
colorPersona();
// Repintar tras cada cambio, salvo los que vienen de escribir en un campo (perderías el foco).
escuchar(motivo => {
  if (motivo === 'dueño') colorPersona();
  if (motivo === 'importar') { cerrarHoja(); colorPersona(); }
  if (!/silencio$/.test(motivo)) pintar();
});
arrancar();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Sin modo sin conexión', e));
}
