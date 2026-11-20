// Primera vez en este móvil: ¿de quién es? Trae su historial de la app anterior si lo hay.

import { rutas, acciones, antesDeCadaRuta, ir } from '../../nucleo/router.js';
import { estado, cambiar, migrarDeViejo, resultadoMigracion, dueñoSoltadoConConfirmacion } from '../../nucleo/estado.js';
import { h, aviso, confirmar } from '../../nucleo/ui.js';
import { PERSONAS } from '../../datos/constantes.js';

antesDeCadaRuta(r => (estado().dueño ? null : 'bienvenida'));

rutas({
  bienvenida: {
    titulo: 'Bienvenida', sinNav: true,
    vista: () => `<div class="bienvenida">
      <img src="icons/icon.svg" alt="" class="logo-grande">
      <h1>Pipos Fitness</h1>
      <p class="tenue">Tu entrenador personal. Cada uno usa su móvil y ve solo lo suyo.</p>
      <p><b>¿De quién es este móvil?</b></p>
      <div class="dueños">${Object.entries(PERSONAS).map(([k, p]) => `<button class="dueño" style="--c:${p.color}" data-act="bienvenida.elegir" data-v="${k}">${h(p.nombre)}</button>`).join('')}</div>
    </div>`,
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
      const ok = await confirmar(`Lo traído de la app anterior es de ${PERSONAS[antes].nombre}. Si eliges ${PERSONAS[v].nombre}, se quita y se trae lo de ${PERSONAS[v].nombre}. Lo hecho en esta app se queda. ¿Seguir?`, { si: 'Seguir' });
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
