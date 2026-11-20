// Perfil → Copias: copias automáticas en la nube, cifradas en el móvil (lógica en js/nucleo/copia.js).
// Interfaz mínima: estado y aviso, activar con la frase, lista de copias y restaurar, cambiar la frase y
// recuperar desde un móvil nuevo (o desde la pantalla de rescate: botón «Recuperar de la nube»).
// Restaurar pasa SIEMPRE por importar() (que aparta antes lo actual en pipos4-antes-de-importar).

import { acciones, pintar, rutaActual } from '../../nucleo/router.js';
import { estado, cambiar, importar, ErrorCopia } from '../../nucleo/estado.js';
import { h, abrirHoja, cerrarHoja, aviso, confirmar, $, fechaCorta } from '../../nucleo/ui.js';
import { PERSONAS } from '../../datos/constantes.js';
import { estadoNube, escucharNube, activar, cambiarFrase, copiarAhora, listar, abrirCopia, cargarClave, ErrorNube, FRASE_MIN, AVISO_DIAS } from '../../nucleo/copia.js';

const nombre = d => (PERSONAS[d] ? PERSONAS[d].nombre : 'otra persona');
const ADVERTENCIA = 'Sin la frase, las copias de la nube no se pueden abrir; guárdala en un gestor de contraseñas.';

// «hoy 18:40», «ayer 9:05» o «12 nov 18:40».
export function cuando(iso, ahora = new Date()) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dia = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(ahora) - dia(d)) / 864e5);
  if (dif === 0) return 'hoy ' + hora;
  if (dif === 1) return 'ayer ' + hora;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: d.getFullYear() === ahora.getFullYear() ? undefined : 'numeric' }) + ' ' + hora;
}

// Aviso que se queda (Hoy y Perfil) si la nube no está activada en el servidor o si hace más de 3 días de la última.
export function avisoNube() {
  const n = estadoNube();
  if (!n.avisar) return '';
  const txt = n.inactiva
    ? 'Las copias en la nube aún no están activadas en el servidor: tus datos solo están en este móvil.'
    : n.ultima ? `Hace más de ${AVISO_DIAS} días que no se hace una copia en la nube (la última, ${cuando(n.ultima)}).` : 'Aún no se ha hecho ninguna copia en la nube.';
  return `<p class="nota aviso-nota aviso-nube">${h(txt)} <button class="enlace" data-act="nube.copiar">Copiar ahora</button></p>`;
}

export function grupoCopias(S) {
  const n = estadoNube();
  const estadoTxt = n.subiendo ? 'Haciendo una copia en la nube…'
    : n.ultima ? `Última copia en la nube: ${cuando(n.ultima)}` : 'Aún no hay ninguna copia en la nube desde este móvil.';
  return `<section class="tarjeta copias-nube">
    <h2>Copias en la nube</h2>
    ${n.activada ? `<p class="ultima-nube">${h(estadoTxt)}</p>
      ${avisoNube()}
      ${n.error && !n.inactiva ? `<p class="nota aviso-nota error-nube">${h(n.error)}</p>` : ''}
      <p class="tenue">Se hacen solas: al terminar una sesión, al cambiar tu perfil, lesiones o medidas y cada día que abras la app (con conexión).</p>
      <div class="fila-botones"><button class="btn sec" data-act="nube.copiar">Copiar ahora</button><button class="btn sec" data-act="nube.lista">Ver copias y restaurar</button></div>
      <button class="enlace" data-act="nube.frase">Cambiar la frase</button>`
    : `<p>Guarda tus datos en la nube de la app sin hacer nada: al terminar cada sesión, al cambiar tu perfil y cada día que la abras.</p>
      <button class="btn" data-act="nube.activar">Activar copias en la nube</button>
      ${n.cargada ? '' : '<p class="tenue">Comprobando este móvil…</p>'}`}
    <p class="tenue">Se cifran en este móvil con tu frase de recuperación antes de salir: ni el servidor ni quien tenga el código de acceso pueden leerlas. Cada uno tiene su frase. ${h(ADVERTENCIA)}</p>
    <button class="enlace" data-act="nube.recuperar">Recuperar de la nube en este móvil (con la frase)</button>
    <p class="tenue">La copia a un archivo (Perfil → Ajustes → Guardar copia) sigue siendo la segunda vía.</p>
  </section>`;
}

// ── Hojas ──
const camposFrase = (pista = '') => `
  <label class="campo col"><span>Frase de recuperación <small>al menos ${FRASE_MIN} caracteres; mejor 4 o 5 palabras sin relación</small></span>
    <input type="password" id="n-f1" autocomplete="new-password" autocapitalize="off" spellcheck="false" ${pista}></label>
  <label class="campo col"><span>Repite la frase</span><input type="password" id="n-f2" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
  <p class="nota aviso-nota"><b>${h(ADVERTENCIA)}</b> No se guarda ni en el móvil ni en el servidor.</p>`;
function leerFrases() {
  const a = $('#n-f1').value, b = $('#n-f2').value;
  if (a.length < FRASE_MIN) { aviso(`La frase tiene que tener al menos ${FRASE_MIN} caracteres`, 'error'); return null; }
  if (a !== b) { aviso('Las dos frases no coinciden', 'error'); return null; }
  return a;
}
let ocupado = false;
async function conEspera(boton, fn) {
  if (ocupado) return;
  ocupado = true;
  const b = boton && boton.closest ? boton : null;
  if (b) { b.disabled = true; b.dataset.texto = b.textContent; b.textContent = 'Un momento…'; }
  try { return await fn(); } finally {
    ocupado = false;
    if (b && b.isConnected) { b.disabled = false; b.textContent = b.dataset.texto; }
  }
}
const mensaje = e => (e instanceof ErrorNube || e instanceof ErrorCopia ? e.message : 'No se ha podido: ' + ((e && e.message) || 'error'));

function filaCopia(c, act, extra = '') {
  const det = [c.sesiones != null ? `${+c.sesiones} sesiones` : '', c.ultima ? `última ${fechaCorta(c.ultima)}` : ''].filter(Boolean).join(' · ');
  return `<li><button class="fila" data-act="${act}" data-n="${h(c.nombre)}"${extra}><span class="grow"><b>${h(cuando(c.fecha))}</b><span class="tenue">${h(det || 'sin sesiones')}</span></span></button></li>`;
}

// Importa el texto descifrado (siempre por importar()). Devuelve true si se cargó.
async function cargar(texto, opciones = {}) {
  try {
    const r = importar(texto, opciones);
    aviso(r.avisos && r.avisos.length ? `Copia de la nube cargada. ${r.avisos.join('. ')}.` : 'Copia de la nube cargada', r.avisos && r.avisos.length ? 'info' : '');
    return true;
  } catch (e) {
    if (e instanceof ErrorCopia && e.codigo === 'otra-persona') {
      if (await confirmar(`${e.message} ¿Seguro que quieres cargarla?`, { si: `Sí, el móvil es de ${nombre(e.info.dueño)}`, peligro: true })) return cargar(texto, { ...opciones, otraPersona: true });
      return false;
    }
    if (!(e instanceof ErrorCopia)) console.error(e);
    aviso(e instanceof ErrorCopia ? e.message : 'No se ha podido cargar la copia. Tus datos siguen como estaban.', 'error');
    return false;
  }
}

// Recuperar con la frase (móvil nuevo o rescate): persona, frase y, si el móvil aún no lo tiene, el código.
let recuperacion = null; // { persona, frase, codigo, copias } solo en memoria mientras la hoja está abierta
function hojaRecuperar(persona) {
  const S = estado();
  persona = persona || S.dueño || 'victor';
  const sinCodigo = !(S.ajustes && S.ajustes.codigo);
  abrirHoja(`<h2>Recuperar de la nube</h2>
    <div class="campo col"><span>¿De quién son las copias?</span><div class="segmentos" id="n-persona">${Object.entries(PERSONAS).map(([k, p]) => `<button type="button" data-v="${h(k)}" class="${k === persona ? 'on' : ''}">${h(p.nombre)}</button>`).join('')}</div></div>
    <label class="campo col"><span>Frase de recuperación</span><input type="password" id="n-frase" autocomplete="current-password" autocapitalize="off" spellcheck="false"></label>
    ${sinCodigo ? '<label class="campo col"><span>Código de acceso <small>el mismo que APP_CODE en Vercel</small></span><input type="password" id="n-codigo" autocomplete="off"></label>' : ''}
    <button class="btn grande" data-act="nube.buscar">Buscar copias</button>
    <div id="n-lista"></div>`, { clase: 'hoja-nube' });
  $('#n-persona').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#n-persona').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

async function restaurarDe(persona, nomb, { frase = null, codigo } = {}) {
  if (!await confirmar('Esto sustituye todos los datos de este móvil por los de la copia de la nube (lo de ahora queda apartado y puedes volver a ello). ¿Seguir?', { si: 'Restaurar' })) return false;
  let abierta;
  try { abierta = await abrirCopia(persona, nomb, { frase, codigo }); } catch (e) {
    if (e instanceof ErrorNube && e.codigo === 'pide-frase') { hojaRecuperar(persona); aviso(e.message, 'info'); return false; }
    aviso(mensaje(e), 'error'); return false;
  }
  if (!await cargar(abierta.texto)) return false;
  // Si el móvil no tenía código, se queda el que se ha escrito para recuperar.
  if (codigo && !(estado().ajustes && estado().ajustes.codigo)) cambiar(S => { S.ajustes.codigo = codigo; }, 'perfil-silencio');
  // Con la frase: se recuerda la clave de esa copia para seguir copiando sin preguntar.
  if (abierta.recordar && estado().dueño === persona) { try { await abierta.recordar(); } catch (e) { aviso(mensaje(e), 'error'); } }
  await cargarClave();
  cerrarHoja();
  pintar();
  return true;
}

acciones({
  'nube.activar': () => {
    abrirHoja(`<h2>Activar copias en la nube</h2>
      <p>Tus copias se cifran en este móvil con una frase que solo sabes tú (cada uno la suya). Se pide una vez en cada móvil.</p>
      ${camposFrase()}
      <button class="btn grande" data-act="nube.confirmarActivar">Activar</button>`);
  },
  'nube.confirmarActivar': el => conEspera(el, async () => {
    const frase = leerFrases(); if (!frase) return;
    const persona = estado().dueño;
    try { await activar(persona, frase); } catch (e) {
      if (e instanceof ErrorNube && e.codigo === 'otra-frase') {
        if (!await confirmar(`${e.message} ¿Usar esta frase igualmente?`, { si: 'Usar esta frase' })) return;
        try { await activar(persona, frase, { aunqueNoCoincida: true }); } catch (e2) { aviso(mensaje(e2), 'error'); return; }
      } else { aviso(mensaje(e), 'error'); return; }
    }
    cerrarHoja(); pintar();
    aviso('Copias en la nube activadas. Hago la primera ahora.');
    copiarAhora('activar');
  }),
  'nube.frase': () => {
    abrirHoja(`<h2>Cambiar la frase</h2>
      <p>Las copias siguientes se cifrarán con la frase nueva. <b>Las que ya están en la nube seguirán abriéndose solo con la frase anterior.</b></p>
      ${camposFrase()}
      <button class="btn grande" data-act="nube.confirmarFrase">Cambiar la frase</button>`);
  },
  'nube.confirmarFrase': el => conEspera(el, async () => {
    const frase = leerFrases(); if (!frase) return;
    try { await cambiarFrase(estado().dueño, frase); } catch (e) { aviso(mensaje(e), 'error'); return; }
    cerrarHoja(); pintar();
    aviso('Frase cambiada. Las copias anteriores siguen con la frase anterior.', 'info');
    copiarAhora('frase');
  }),
  'nube.copiar': () => {
    if (!estadoNube().activada) { aviso('Activa primero las copias en la nube (Perfil → Copias)', 'info'); return; }
    copiarAhora('manual').then(r => {
      const n = estadoNube();
      if (r === 'ok') aviso('Copia hecha en la nube');
      else if (r === 'sin-red') aviso('Sin conexión: la copia se hará al volver la red', 'info');
      else if (r === 'rescate') aviso('Primero resuelve el rescate de tus datos', 'info');
      else if (n.error) aviso(n.error, 'error');
    });
  },
  'nube.lista': el => conEspera(el, async () => {
    const persona = estado().dueño;
    let copias;
    try { copias = await listar(persona); } catch (e) { aviso(mensaje(e), 'error'); return; }
    abrirHoja(`<h2>Copias en la nube de ${h(nombre(persona))}</h2>
      ${copias.length ? `<ul class="lista copias-lista">${copias.map(c => filaCopia(c, 'nube.restaurar')).join('')}</ul>` : '<p class="tenue">Aún no hay copias en la nube.</p>'}
      <p class="tenue">Toca una para restaurarla. Se guardan las de los últimos 14 días, una por semana durante 3 meses y una por mes durante 2 años.</p>`);
  }),
  'nube.restaurar': el => conEspera(el, () => restaurarDe(estado().dueño, el.dataset.n)),
  'nube.recuperar': () => { recuperacion = null; hojaRecuperar(); },
  'nube.buscar': el => conEspera(el, async () => {
    const persona = ($('#n-persona .on') || { dataset: { v: 'victor' } }).dataset.v;
    const frase = $('#n-frase').value;
    const codigo = $('#n-codigo') ? $('#n-codigo').value.trim() : undefined;
    if (!frase) { aviso('Escribe la frase', 'error'); return; }
    let copias;
    try { copias = await listar(persona, { codigo }); } catch (e) { aviso(mensaje(e), 'error'); return; }
    const lista = $('#n-lista');
    if (!copias.length) { lista.innerHTML = `<p class="tenue">${h(nombre(persona))} aún no tiene copias en la nube.</p>`; return; }
    // Se comprueba la frase con la más nueva antes de enseñar la lista: frase mal → mensaje claro, sin tocar nada.
    try { await abrirCopia(persona, copias[0].nombre, { frase, codigo }); } catch (e) {
      lista.innerHTML = `<p class="nota aviso-nota error-nube">${h(mensaje(e))}</p>`;
      return;
    }
    recuperacion = { persona, frase, codigo, copias };
    lista.innerHTML = `<ul class="lista copias-lista">${copias.map(c => filaCopia(c, 'nube.restaurarCon')).join('')}</ul>`;
  }),
  'nube.restaurarCon': el => conEspera(el, async () => {
    const r = recuperacion; if (!r) return;
    if (await restaurarDe(r.persona, el.dataset.n, { frase: r.frase, codigo: r.codigo })) recuperacion = null;
  }),
});

// Repinta Hoy y Perfil → Copias cuando cambia el estado de la nube (no otras pantallas: podrías estar escribiendo).
let esCopias = () => false;
export function siVisible(fn) { esCopias = fn; }
escucharNube(() => {
  const r = rutaActual().ruta;
  if (document.querySelector('.hoja-fondo')) return; // con una hoja abierta no se repinta debajo
  if (r === 'hoy' || (r === 'perfil' && esCopias())) pintar();
});
