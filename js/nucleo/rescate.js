// Pantalla de rescate: aparece en lugar de todo lo demás cuando los datos guardados no se pueden leer,
// cuando faltan pero el espejo de IndexedDB los tiene, o cuando el espejo es más nuevo que lo guardado
// (porque localStorage falló al escribir). Mientras se ve, la app no escribe nada en pipos4 ni en el espejo.
// Se importa en main.js ANTES que la bienvenida: su guardia manda sobre la de elegir dueño.

import { rutas, acciones, antesDeCadaRuta, ir } from './router.js';
import { estadoGuardado, recuperarDelEspejo, descartarRescate, textoRoto } from './estado.js';
import { h, aviso, confirmar } from './ui.js';
import { PERSONAS } from '../datos/constantes.js';
import { pausarNube } from './copia.js';

const rescate = () => estadoGuardado().rescate;
antesDeCadaRuta(() => (rescate() ? 'rescate' : null));

const fecha = iso => {
  const d = new Date(iso);
  return isNaN(d) ? 'fecha desconocida' : d.toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

const TEXTOS = {
  roto: 'Los datos guardados en este móvil no se pueden leer. No he borrado nada ni voy a guardar nada hasta que elijas qué hacer.',
  vacio: 'Este móvil no tiene datos guardados, pero la app conserva una copia interna.',
  espejo: 'La última vez no se pudo guardar todo en el almacenamiento del móvil, pero la app conserva una copia interna más reciente.',
};

function vista() {
  const r = rescate();
  if (!r) return '<p class="tenue">Todo en orden.</p>';
  const e = r.espejo;
  const nombre = e && PERSONAS[e.dueño] ? PERSONAS[e.dueño].nombre : '';
  return `<section class="tarjeta">
    <h1 class="titulo">Rescatar tus datos</h1>
    <p>${h(TEXTOS[r.motivo] || TEXTOS.roto)}</p>
    ${r.motivo === 'roto' ? (r.copia
      ? `<p class="tenue">El contenido original queda apartado en este móvil (${h(r.copia)}).</p>`
      : '<p class="tenue">No he podido apartar una copia del contenido original (no queda espacio).</p>')
      + '<button class="btn sec" data-act="rescate.descargarRoto">Descargar los datos ilegibles</button>' : ''}
    ${e ? `<p class="nota">Copia interna${nombre ? ' de ' + h(nombre) : ''} del ${h(fecha(e.fecha))}: ${+e.sesiones} ${+e.sesiones === 1 ? 'sesión hecha' : 'sesiones hechas'}.</p>
      <button class="btn grande" data-act="rescate.espejo">Recuperar la copia interna</button>` : ''}
    <button class="btn ${e ? 'sec' : 'grande'}" data-act="perfil.importar">Cargar copia</button>
    <p class="tenue">«Cargar copia» usa un archivo que guardaste antes desde Perfil → Copias → Guardar copia.</p>
    <button class="btn sec" data-act="nube.recuperar">Recuperar de la nube</button>
    <p class="tenue">«Recuperar de la nube» abre tus copias automáticas con tu frase de recuperación.</p>
    <button class="btn sec peligro" data-act="rescate.descartar">${r.motivo === 'espejo' ? 'Seguir con lo guardado' : 'Empezar de cero'}</button>
  </section>`;
}

rutas({ rescate: { titulo: 'Rescatar datos', sinNav: true, vista } });

acciones({
  'rescate.descargarRoto': () => {
    const txt = textoRoto();
    if (!txt) { aviso('No hay datos ilegibles que descargar', 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `pipos-fitness-ilegible-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
  },
  'rescate.espejo': () => {
    try { recuperarDelEspejo(); aviso('Datos recuperados'); ir('hoy'); } catch (e) { aviso(e.message, 'error'); }
  },
  'rescate.descartar': async () => {
    const r = rescate(); if (!r) return;
    const txt = r.motivo === 'espejo'
      ? 'Se quedará lo guardado en el móvil y se perderá lo último de la copia interna. ¿Seguir?'
      : r.motivo === 'roto' && !r.copia
        ? 'No se pudo apartar una copia de los datos ilegibles: si empiezas de cero, se perderán. ¿Seguro?'
        : `Empezarás con la app vacía${r.espejo ? ' y se perderá la copia interna' : ''}${r.copia ? '. Lo ilegible sigue apartado en el móvil' : ''}. ¿Seguro?`;
    if (!await confirmar(txt, { si: r.motivo === 'espejo' ? 'Seguir' : 'Empezar de cero', peligro: true })) return;
    const deCero = r.motivo !== 'espejo';
    if (descartarRescate()) {
      // Tras «Empezar de cero», las copias en la nube quedan en pausa hasta que la persona lo confirme
      // (si no, la siguiente copia automática sería la de la app vacía).
      if (deCero) pausarNube();
      ir('hoy');
    }
  },
});
