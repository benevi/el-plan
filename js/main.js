// Arranque de Pipos Fitness: carga los datos, aplica el color de la persona, registra las áreas y pinta.
// Cada área se registra sola al importarse (rutas, acciones y pestaña). Para añadir un área nueva,
// crea js/areas/<area>/indice.js e impórtala aquí.

import { cargar, estado, escuchar, escucharGuardado, revisarEspejo } from './nucleo/estado.js';
import { arrancar, pintar } from './nucleo/router.js';
import { cerrarHoja, aviso, avisoFijo, quitarAvisoFijo } from './nucleo/ui.js';
import { PERSONAS } from './datos/constantes.js';

import './nucleo/rescate.js'; // antes que la bienvenida: su guardia manda
import './areas/perfil/bienvenida.js';
import './areas/hoy/indice.js';
import './areas/entrenador/indice.js';
import './areas/sesion/indice.js';
import './areas/progreso/indice.js';
import './areas/ejercicios/indice.js';
import './areas/perfil/indice.js';
import './aspecto/vida.js';

function colorPersona() {
  const p = PERSONAS[estado().dueño];
  const r = document.documentElement.style;
  r.setProperty('--acc', p ? p.color : '#4DD0E8');
  r.setProperty('--acc-2', p ? p.color2 : '#2A9BC2');
  document.body.dataset.persona = estado().dueño || '';
}

cargar();
// Antes de pintar se mira el espejo de IndexedDB: si pipos4 está roto o vacío y el espejo tiene datos,
// la pantalla de rescate lo ofrece. Sin IndexedDB (o si tarda) se sigue sin él.
await revisarEspejo();
colorPersona();
// Repintar tras cada cambio, salvo los que vienen de escribir en un campo (perderías el foco).
escuchar(motivo => {
  if (motivo === 'dueño') colorPersona();
  if (['importar', 'externo', 'rescate'].includes(motivo)) { cerrarHoja(); colorPersona(); }
  if (!/silencio$/.test(motivo)) pintar();
});
// Si no se puede guardar, aviso que no se va (se reintenta en el siguiente cambio y se quita al guardar bien).
escucharGuardado(ev => {
  if (ev.tipo === 'error') {
    avisoFijo(`<p><b>No se ha podido guardar en este móvil.</b> Puede que el almacenamiento esté lleno o bloqueado. Lo que hagas ahora podría perderse si cierras la app: guarda una copia y libera espacio. Lo vuelvo a intentar con el próximo cambio.</p>
      <button class="btn sec" data-act="perfil.exportar">Guardar copia</button>`);
  } else if (ev.tipo === 'ok') {
    quitarAvisoFijo(); aviso('Ya se guarda de nuevo');
  } else if (ev.tipo === 'externo') {
    aviso(ev.apartado ? 'Se han cargado los cambios guardados en otra ventana. Lo último que hiciste aquí no se pudo juntar y ha quedado apartado.' : 'Se han cargado los cambios guardados en otra ventana', 'info');
  }
});
arrancar();

// Pedir que el navegador no borre los datos por falta de espacio (si lo permite; si no, no pasa nada).
try {
  const st = navigator.storage;
  if (st && typeof st.persist === 'function') {
    Promise.resolve(typeof st.persisted === 'function' ? st.persisted() : false)
      .then(ya => ya || st.persist()).catch(() => {});
  }
} catch { /* nada */ }

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Sin modo sin conexión', e));
}
