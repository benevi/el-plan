// Página de logos: misma propuesta a varios tamaños, sobre fondo oscuro o claro, y en una pantalla de inicio simulada.
const PROPUESTAS = [
  { id: 'giro', nombre: 'Giro', idea: 'Dos P que giran media vuelta: dos personas, un ciclo.', finalista: true },
  { id: 'marea', nombre: 'Marea', idea: 'La P con la línea del agua: la piscina como alusión.', finalista: true },
  { id: 'trazo', nombre: 'Trazo', idea: 'Una P de un solo trazo con el cuenco abierto.' },
  { id: 'duo', nombre: 'Dúo', idea: 'La P en dos piezas separadas por una calle.' },
  { id: 'nivel', nombre: 'Nivel', idea: 'Un círculo que se llena de agua.' },
];
const TAMANOS = [16, 24, 32, 48, 64, 128];

const tabla = document.getElementById('tabla');
tabla.innerHTML = PROPUESTAS.map(p => `
  <article class="fila${p.finalista ? ' es-finalista' : ''}">
    <div class="fila-cab"><h3>${p.nombre}</h3>${p.finalista ? '<span class="marca-fin">Finalista</span>' : ''}<p>${p.idea}</p></div>
    <div class="tamanos">${TAMANOS.map(t => `<figure><img src="${p.id}/icono.svg" width="${t}" height="${t}" alt=""><figcaption>${t}</figcaption></figure>`).join('')}
      <figure><img class="redondo" src="${p.id}/icono-maskable.svg" width="96" height="96" alt=""><figcaption>maskable</figcaption></figure></div>
    <div class="logo-fila"><img src="${p.id}/logo.svg" height="36" alt="Logo ${p.nombre} con el nombre Pipos Fitness"></div>
  </article>`).join('');

const RELLENO = ['Reloj', 'Notas', 'Mapas', 'Fotos', 'Música', 'Tiempo', 'Banco'];
document.getElementById('moviles').innerHTML = PROPUESTAS.map(p => `
  <figure class="movil">
    <div class="pantalla">
      ${['', 'circulo'].map(forma => `<div class="rejilla ${forma}">${RELLENO.slice(0, 3).map(r => `<span class="app"><i></i><small>${r}</small></span>`).join('')}
        <span class="app"><img src="${p.id}/${forma ? 'icono-maskable-512.png' : 'icono-512.png'}" alt=""><small>Pipos</small></span>
        ${RELLENO.slice(3, 7).map(r => `<span class="app"><i></i><small>${r}</small></span>`).join('')}</div>`).join('')}
    </div>
    <figcaption>${p.nombre}</figcaption>
  </figure>`).join('');

document.addEventListener('click', e => {
  const b = e.target.closest('[data-fondo]');
  if (!b) return;
  tabla.dataset.fondo = b.dataset.fondo;
  document.querySelectorAll('[data-fondo]').forEach(x => x.matches('button') && x.setAttribute('aria-pressed', String(x === b)));
});
