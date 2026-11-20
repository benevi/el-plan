// Página de logos (símbolo de pareja): misma propuesta a varios tamaños, sobre fondo oscuro o claro, y en una pantalla de inicio simulada.
const PROPUESTAS = [
  { id: 'arco', nombre: 'Arco', idea: 'Dos trazos que se inclinan el uno hacia el otro: apoyo, sin fundirse.', finalista: true },
  { id: 'escalon', nombre: 'Escalón', idea: 'Dos «p», la segunda un paso más arriba: Pipos, dos y progreso.', finalista: true },
  { id: 'paralelo', nombre: 'Paralelo', idea: 'Dos trazos que avanzan a la par.' },
  { id: 'ondas', nombre: 'Ondas', idea: 'Dos ondas con el mismo ritmo.' },
  { id: 'orbita', nombre: 'Órbita', idea: 'Dos puntos en la misma órbita.' },
  { id: 'trenza', nombre: 'Trenza', idea: 'Dos trazos que se cruzan por encima y por debajo.' },
];
const TAMANOS = [16, 24, 32, 48, 64, 128];

const tabla = document.getElementById('tabla');
tabla.innerHTML = PROPUESTAS.map(p => `
  <article class="fila${p.finalista ? ' es-finalista' : ''}">
    <div class="fila-cab"><h3>${p.nombre}</h3>${p.finalista ? '<span class="marca-fin">Finalista</span>' : ''}<p>${p.idea}</p></div>
    <div class="tamanos">${TAMANOS.map(t => `<figure><img src="${p.id}/icono.svg" width="${t}" height="${t}" alt=""><figcaption>${t}</figcaption></figure>`).join('')}
      <figure><img class="redondo" src="${p.id}/icono-maskable.svg" width="96" height="96" alt=""><figcaption>maskable</figcaption></figure><figure><img src="${p.id}/icono-un-tono.svg" width="32" height="32" alt=""><figcaption>un tono</figcaption></figure><figure><img src="${p.id}/icono-un-tono.svg" width="16" height="16" alt=""><figcaption>un tono</figcaption></figure></div>
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
