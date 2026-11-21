// Primera vez en este móvil: ¿de quién es? Trae su historial de la app anterior si lo hay.

import { rutas, acciones, antesDeCadaRuta, ir } from '../../nucleo/router.js';
import { estado, cambiar, migrarDeViejo, resultadoMigracion, dueñoSoltadoConConfirmacion } from '../../nucleo/estado.js';
import { h, aviso, confirmar } from '../../nucleo/ui.js';
import { PERSONAS } from '../../datos/constantes.js';
import { T1 } from '../entrenador/alarma.js';
import { QUEDA } from './indice.js';

antesDeCadaRuta(r => (estado().dueño ? null : 'bienvenida'));

rutas({
  bienvenida: {
    titulo: 'Bienvenida', sinNav: true,
    vista: () => `<section class="bienvenida">
      <img src="icons/icon.svg" alt="" width="96" height="96" class="logo-grande">
      <h1>Pipos Fitness</h1>
      <p class="lectura">Tu entrenador personal. Cada uno usa su móvil y ve solo lo suyo.</p>
      <p class="quien" id="quien">¿De quién es este móvil?</p>
      <div class="dueños" role="group" aria-labelledby="quien">${Object.entries(PERSONAS).map(([k, p]) => `<span data-persona="${h(k)}"><button type="button" class="boton dueño" data-act="bienvenida.elegir" data-v="${h(k)}">${h(p.nombre)}</button></span>`).join('')}</div>
      <div class="aviso-salud avisos-salud">${T1.map(t => `<p>${h(t)}</p>`).join('')}</div>
    </section>`,
  },
});

acciones({
  'bienvenida.elegir': async el => {
    const v = el.dataset.v;
    if (!PERSONAS[v]) return;
    // Lo traído de la app anterior es de la otra persona: se quitará y se traerá lo de esta. Se confirma
    // (salvo si se acaba de confirmar en Perfil → «cambiar»).
    const m = estado().migracion, antes = m && m.dueño;
    if (antes && antes !== v && !dueñoSoltadoConConfirmacion()) {
      const ok = await confirmar(`Lo traído de la app anterior es de ${PERSONAS[antes].nombre}. Si eliges ${PERSONAS[v].nombre}, se quita y se trae lo de ${PERSONAS[v].nombre}. ${QUEDA}`, { si: 'Seguir' });
      if (!ok) return;
    }
    cambiar(S => { S.dueño = v; migrarDeViejo(v); }, 'dueño');
    const r = resultadoMigracion();
    if (r && (r.sesiones || r.descartadas.length)) {
      const partes = [];
      if (r.sesiones) partes.push(`He traído ${r.sesiones} sesiones de la app anterior`);
      if (r.descartadas.length) partes.push(`No he podido traer ${r.descartadas.join(', ')}`);
      aviso(partes.join('. '), r.descartadas.length ? 'info' : '');
    }
    ir(estado().perfil.objetivos.length ? 'hoy' : 'perfil');
  },
});
