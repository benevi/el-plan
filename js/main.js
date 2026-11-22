// Arranque de Pipos Fitness: carga los datos, aplica el color de la persona, registra las áreas y pinta.
// Cada área se registra sola al importarse (rutas, acciones y pestaña). Para añadir un área nueva,
// crea js/areas/<area>/indice.js e impórtala aquí.

import { cargar, estado, escuchar, escucharGuardado, revisarEspejo, revisarApartado, usarPruebaDePintado, ponerAlDiaMigracion } from './nucleo/estado.js';
import { arrancar, pintar, probarPantallas } from './nucleo/router.js';
import { cerrarHoja, aviso, avisoFijo, quitarAvisoFijo } from './nucleo/ui.js';
import { PERSONAS } from './datos/constantes.js';
import { iniciarVersiones } from './nucleo/version.js';
import { iniciarCopias } from './nucleo/copia.js';

import './nucleo/rescate.js'; // antes que la bienvenida: su guardia manda
import './areas/perfil/bienvenida.js';
import './areas/hoy/indice.js';
import './areas/entrenador/indice.js';
import './areas/sesion/indice.js';
import './areas/progreso/indice.js';
import './areas/ejercicios/indice.js';
import './areas/perfil/indice.js';
import './aspecto/vida.js';

// El color de la persona sale de los tokens (css/tokens.css) según data-persona en <html>:
// lima suave para Víctor y rosa suave para Virginia. Ningún componente pregunta por la persona.
function colorPersona() {
  const d = estado().dueño;
  if (PERSONAS[d]) document.documentElement.dataset.persona = d;
  else delete document.documentElement.dataset.persona;
}

// Antes de cargar una copia se prueban todas las pantallas con sus datos (estado.importar).
usarPruebaDePintado(probarPantallas);
cargar();
// Antes de pintar se mira el espejo de IndexedDB: si pipos4 está roto o vacío y el espejo tiene datos,
// la pantalla de rescate lo ofrece. Sin IndexedDB (o si tarda) se sigue sin él.
await revisarEspejo();
// Lo nuevo de la app anterior (p. ej. tras una marcha atrás) y la corrección única de lo migrado con fallos.
let migrado = null;
try { migrado = ponerAlDiaMigracion(); } catch (e) { console.error('No se pudo poner al día lo de la app anterior', e); }
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
    if (ev.perdido) aviso('Se han cargado los cambios guardados en otra ventana. Lo último que hiciste aquí no se pudo guardar ni apartar y se ha perdido.', 'error');
    else aviso(ev.apartado ? 'Se han cargado los cambios guardados en otra ventana. Lo último que hiciste aquí no se pudo juntar y ha quedado apartado (puedes recuperarlo en Perfil › Ajustes).' : 'Se han cargado los cambios guardados en otra ventana', 'info');
    if (ev.apartado) pintar();
  }
});
arrancar();
// Lo apartado (Perfil › Ajustes) se lee del espejo sin esperar: si hay algo, se repinta.
revisarApartado().then(a => { if (a) pintar(); }, () => {});
if (migrado && migrado.sesiones) aviso(`He traído ${migrado.sesiones} sesiones nuevas de la app anterior`, 'info');
// Marca el arranque para el vigilante de js/arranque.js (si no llega, avisa en vez de quedarse en blanco).
document.documentElement.setAttribute('data-arrancado', '');
try { performance.mark('pipos:arrancado'); } catch { /* sin marcas */ }
window.dispatchEvent(new Event('pipos:arrancado'));

// Pedir que el navegador no borre los datos por falta de espacio (si lo permite; si no, no pasa nada).
try {
  const st = navigator.storage;
  if (st && typeof st.persist === 'function') {
    Promise.resolve(typeof st.persisted === 'function' ? st.persisted() : false)
      .then(ya => ya || st.persist()).catch(() => {});
  }
} catch { /* nada */ }

// Copias automáticas en la nube (js/nucleo/copia.js): solo si están activadas en este móvil.
iniciarCopias().catch(e => console.error('Copias en la nube', e));

// Service worker y aviso de versión nueva (js/nucleo/version.js).
iniciarVersiones();
