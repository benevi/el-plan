// Primera vez en este móvil: ¿de quién es? Trae su historial de la app anterior si lo hay.

import { rutas, acciones, antesDeCadaRuta, ir } from '../../nucleo/router.js';
import { estado, cambiar, migrarDeViejo } from '../../nucleo/estado.js';
import { h, aviso } from '../../nucleo/ui.js';
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
  'bienvenida.elegir': el => {
    let n = 0;
    cambiar(S => { S.dueño = el.dataset.v; n = migrarDeViejo(el.dataset.v); }, 'dueño');
    if (n) aviso(`He traído ${n} sesiones de la app anterior`);
    ir(estado().perfil.objetivos.length ? 'hoy' : 'perfil');
  },
});
