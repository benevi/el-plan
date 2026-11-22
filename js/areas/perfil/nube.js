// Perfil → Copias: copias automáticas en la nube, cifradas en el móvil (lógica en js/nucleo/copia.js).
// Interfaz mínima: estado y avisos, activar con la frase (con una frase propuesta), lista de copias y
// restaurar, cambiar la frase y recuperar desde un móvil nuevo (o desde la pantalla de rescate).
// Restaurar pasa SIEMPRE por importar() (que aparta antes lo actual en pipos4-antes-de-importar).

import { acciones, pintar, rutaActual } from '../../nucleo/router.js';
import { estado, cambiar, importar, ErrorCopia, avisoSustituyeApartado } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, confirmar, $, fechaCorta } from '../../nucleo/ui.js';
import { PERSONAS } from '../../datos/constantes.js';
import { estadoNube, escucharNube, activar, cambiarFrase, copiarAhora, listar, abrirCopia, probarCopias, cargarClave, marcarBase,
  reanudarNube, generarFrase, calidadFrase, metadatos, ErrorNube, AVISO_DIAS } from '../../nucleo/copia.js';

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

// Aviso del sistema (icono + texto + acciones). Lleva las clases que buscan las pruebas.
const avisoAcc = (clases, texto, botones) => `<div class="aviso aviso-linea aviso--aviso aviso-nube ${clases}" role="note">${ICONOS.alerta}<div class="aviso-texto"><p>${texto}</p><div class="aviso-acciones">${botones}</div></div></div>`;
const accion = (act, txt, sec = true) => `<button type="button" class="boton ${sec ? 'boton--secundario' : 'boton--texto'}" data-act="${act}">${txt}</button>`;
// Aviso que se queda (Hoy y Perfil): copias desactivadas en este móvil, en pausa tras empezar de cero, una
// copia automática retenida por tener menos datos, una subida que falló (se reintenta sola), nube no activada en
// el servidor o más de 3 días sin copia.
export function avisoNube() {
  const n = estadoNube();
  if (!n.avisar) return '';
  if (n.desactivada) {
    return avisoAcc('desactivada-nube', 'Las copias en la nube se han desactivado en este móvil (ya no está su clave). Actívalas de nuevo con tu frase.', accion('nube.activar', 'Activar copias'));
  }
  if (n.pausada) {
    return avisoAcc('pausada-nube', 'Las copias en la nube están en pausa porque empezaste de cero en este móvil. ¿Sigo copiando con tu frase o recuperas tus datos de la nube?', accion('nube.reanudar', 'Seguir copiando') + accion('nube.recuperar', 'Recuperar de la nube', false));
  }
  if (n.retenida) {
    const r = n.retenida;
    return avisoAcc('retenida-nube', `No he subido la copia automática: este móvil tiene ${+r.sesiones} sesiones${r.ultima ? ` (la última, ${h(fechaCorta(r.ultima))})` : ''} y la última copia en la nube tenía ${+r.base}${r.baseUltima ? ` (la última, ${h(fechaCorta(r.baseUltima))})` : ''}. Si la subo, la copia más nueva tendría menos datos.`, accion('nube.forzar', 'Subir de todos modos') + accion('nube.lista', 'Recuperar de la nube', false));
  }
  if (n.fallida) {
    return avisoAcc('fallida-nube', `No se ha podido hacer la última copia en la nube. ${h(n.error)} ${n.reintenta ? 'Lo vuelvo a intentar solo; mientras tanto,' : 'Cuando esté arreglado, toca «Copiar ahora»; hasta entonces,'} lo último solo está en este móvil.`, accion('nube.copiar', 'Copiar ahora'));
  }
  const txt = n.inactiva
    ? 'Las copias en la nube aún no están activadas en el servidor: tus datos solo están en este móvil.'
    : n.ultima ? `Hace más de ${AVISO_DIAS} días que no se hace una copia en la nube (la última, ${cuando(n.ultima)}).` : 'Aún no se ha hecho ninguna copia en la nube.';
  return avisoAcc('', h(txt), accion('nube.copiar', 'Copiar ahora'));
}

export function grupoCopias() {
  const n = estadoNube();
  const estadoTxt = n.subiendo ? 'Haciendo una copia en la nube…'
    : n.ultima ? `Última copia en la nube: ${cuando(n.ultima)}` : 'Aún no hay ninguna copia en la nube desde este móvil.';
  return `<section class="tarjeta perfil-sec copias-nube" aria-labelledby="p-nube">
    <h2 id="p-nube">Copias en la nube</h2>
    ${n.activada ? `<p class="ultima-nube">${h(estadoTxt)}</p>
      ${avisoNube()}
      ${n.error && !n.inactiva && !n.fallida ? `<div class="aviso aviso-linea aviso--error error-nube" role="alert">${ICONOS.error}<div class="aviso-texto"><p>${h(n.error)}</p></div></div>` : ''}
      <p>Se hacen solas: al terminar una sesión, al cambiar tu perfil, lesiones o medidas y cada día que abras la app (con conexión).</p>
      <div class="fila-botones"><button type="button" class="boton boton--secundario" data-act="nube.copiar">Copiar ahora</button><button type="button" class="boton boton--secundario" data-act="nube.lista">Ver copias y restaurar</button></div>
      <button type="button" class="boton boton--texto" data-act="nube.frase">Cambiar la frase</button>`
    : `${avisoNube()}<p>Guarda tus datos en la nube de la app sin hacer nada: al terminar cada sesión, al cambiar tu perfil y cada día que la abras.</p>
      <button type="button" class="boton" data-act="nube.activar">Activar copias en la nube</button>
      ${n.cargada ? '' : '<p class="ayuda">Comprobando este móvil…</p>'}`}
    <p class="ayuda">Se cifran en este móvil con tu frase de recuperación antes de salir: ni el servidor ni quien tenga el código de acceso pueden leer lo que hay dentro, aunque sí ven cuándo se subió cada copia y cuánto ocupa. Cada uno tiene su frase. ${h(ADVERTENCIA)}</p>
    <button type="button" class="boton boton--texto" data-act="nube.recuperar">Recuperar de la nube en este móvil (con la frase)</button>
    <p class="ayuda">La copia en un archivo (Perfil › Ajustes › Guardar copia) sigue siendo la segunda vía.</p>
  </section>`;
}

// ── Frase ──
let propuesta = '';
const camposFrase = () => {
  propuesta = generarFrase();
  return `
  <div class="frase-propuesta"><p>Te propongo esta frase (6 palabras al azar: muy difícil de adivinar):</p>
    <p class="frase-generada"><b id="n-gen">${h(propuesta)}</b></p>
    <div class="fila-botones"><button type="button" class="btn sec" data-act="nube.generar">Generar otra</button><button type="button" class="btn sec" data-act="nube.usarGenerada">Usar esta</button></div></div>
  <label class="campo col"><span>Frase de recuperación <small>mejor la propuesta; si no, al menos 4 palabras sin relación (sin vuestros nombres ni años)</small></span>
    <input type="password" id="n-f1" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
  <label class="campo col"><span>Repite la frase</span><input type="password" id="n-f2" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
  <p class="nota aviso-nota"><b>${h(ADVERTENCIA)}</b> No se guarda ni en el móvil ni en el servidor.</p>`;
};
// { flojaVale }: al activar, una frase floja se deja pasar a activar(), que solo la acepta si ya abre copias
// de la nube (frases anteriores a S3); para una frase nueva, nunca.
function leerFrases({ flojaVale = false } = {}) {
  const a = $('#n-f1').value, b = $('#n-f2').value;
  const q = calidadFrase(a);
  if (!q.ok && !(flojaVale && q.porBits)) { aviso(q.motivo, 'error'); return null; }
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

// Una fila de la lista: abre (✓ con sus sesiones), no abre con esta frase, o sin probar.
function filaCopia(c, act) {
  const det = c.abre === true
    ? [c.sesiones != null ? `${+c.sesiones} sesiones` : '', c.ultima ? `última ${fechaCorta(c.ultima)}` : ''].filter(Boolean).join(' · ') || 'sin sesiones'
    : c.abre === false ? 'No se abre con esta frase' : 'Sin probar con esta frase';
  return `<li class="copia-${c.abre === true ? 'abre' : c.abre === false ? 'no-abre' : 'sin-probar'}"><button class="fila" data-act="${act}" data-n="${h(c.nombre)}">
    <span class="grow"><b>${h(cuando(c.fecha))}</b><span class="tenue">${c.abre === true ? '✓ ' : ''}${h(det)}</span></span></button></li>`;
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

// Recuperar con la frase (móvil nuevo, rescate u otra frase): persona, frase y, si el móvil aún no lo tiene, el código.
let recuperacion = null; // { persona, frase, codigo, copias, claves, bajadas } solo en memoria mientras la hoja está abierta
function hojaRecuperar(persona) {
  const S = estado();
  persona = persona || S.dueño || 'victor';
  const sinCodigo = !(S.ajustes && S.ajustes.codigo);
  recuperacion = null;
  abrirHoja(`<h2>Recuperar de la nube</h2>
    <div class="campo col"><span>¿De quién son las copias?</span><div class="segmentos" id="n-persona">${Object.entries(PERSONAS).map(([k, p]) => `<button type="button" data-v="${h(k)}" class="${k === persona ? 'on' : ''}">${h(p.nombre)}</button>`).join('')}</div></div>
    <label class="campo col"><span>Frase de recuperación <small>vale también una frase anterior</small></span><input type="password" id="n-frase" autocomplete="current-password" autocapitalize="off" spellcheck="false"></label>
    ${sinCodigo ? '<label class="campo col"><span>Código de acceso <small>el mismo que te ha dado Víctor para el entrenador IA</small></span><input type="password" id="n-codigo" autocomplete="off"></label>' : ''}
    <button class="btn grande" data-act="nube.buscar">Buscar copias</button>
    <div id="n-lista"></div>`, { clase: 'hoja-nube' });
  $('#n-persona').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#n-persona').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
}

// Baja, descifra, enseña lo que hay dentro (y si no cuadra con la lista) y, si se confirma, importa.
async function restaurarDe(persona, c, { frase = null, clave = null, codigo, bytes = null } = {}) {
  let abierta;
  try { abierta = await abrirCopia(persona, c.nombre, { frase, clave, codigo, bytes, esperado: c.abre ? { fecha: c.fecha, sesiones: c.sesiones, ultima: c.ultima } : { fecha: c.fecha } }); } catch (e) {
    if (e instanceof ErrorNube && e.codigo === 'pide-frase') { hojaRecuperar(persona); aviso(e.message, 'info'); return false; }
    aviso(mensaje(e), 'error'); return false;
  }
  const m = abierta.meta;
  const dentro = m
    ? `Copia de ${nombre(m.persona)} del ${cuando(m.creada || c.fecha)}: ${+m.sesiones} sesiones${m.ultima ? `, la última del ${fechaCorta(m.ultima)}` : ''}.`
    : `Copia del ${cuando(c.fecha)} (de la primera versión, sin datos por dentro).`;
  const avisos = abierta.avisos.length ? ` Ojo: ${abierta.avisos.join(' ')}` : '';
  if (!await confirmar(`${dentro}${avisos} Esto sustituye todos los datos de este móvil por los de la copia (lo de ahora queda apartado y puedes volver a ello).${avisoSustituyeApartado()} ¿Restaurar?`, { si: 'Restaurar', peligro: !!abierta.avisos.length })) return false;
  if (!await cargar(abierta.texto)) return false;
  // Si el móvil no tenía código, se queda el que se ha escrito para recuperar.
  if (codigo && !(estado().ajustes && estado().ajustes.codigo)) cambiar(S => { S.ajustes.codigo = codigo; }, 'perfil-silencio');
  // Con la frase: se recuerda la clave de esa copia para seguir copiando sin preguntar.
  if (abierta.recordar && estado().dueño === persona) { try { await abierta.recordar(); } catch (e) { aviso(mensaje(e), 'error'); } }
  marcarBase(); reanudarNube();
  await cargarClave();
  cerrarHoja();
  pintar();
  return true;
}

let listaPropia = null; // la última lista de «Ver copias» (con las marcas de la clave de este móvil)
async function verLista() {
  const persona = estado().dueño;
  let copias;
  try { copias = (await probarCopias(persona, await listar(persona), { reg: await cargarClave() })).copias; } catch (e) { aviso(mensaje(e), 'error'); return; }
  listaPropia = copias;
  abrirHoja(`<h2>Copias en la nube de ${h(nombre(persona))}</h2>
    ${copias.length ? `<ul class="lista copias-lista">${copias.map(c => filaCopia(c, 'nube.restaurar')).join('')}</ul>` : '<p class="tenue">Aún no hay copias en la nube.</p>'}
    <p class="tenue">Toca una para restaurarla (las que no se abren con tu frase actual te la pedirán). Se guardan: de los últimos 14 días, una por hora y hasta 10 al día; una por semana durante 3 meses y una por mes durante 2 años.</p>`);
}

acciones({
  'nube.activar': () => {
    abrirHoja(`<h2>Activar copias en la nube</h2>
      <p>Tus copias se cifran en este móvil con una frase que solo sabes tú (cada uno la suya). Se pide una vez en cada móvil.</p>
      ${camposFrase()}
      <button class="btn grande" data-act="nube.confirmarActivar">Activar</button>`);
  },
  'nube.generar': () => { propuesta = generarFrase(); const g = $('#n-gen'); if (g) g.textContent = propuesta; },
  'nube.usarGenerada': () => {
    for (const id of ['#n-f1', '#n-f2']) { const i = $(id); if (i) { i.value = propuesta; i.type = 'text'; } }
    aviso('Apúntala ahora en tu gestor de contraseñas', 'info');
  },
  'nube.confirmarActivar': el => conEspera(el, async () => {
    const frase = leerFrases({ flojaVale: true }); if (!frase) return;
    const persona = estado().dueño;
    let r;
    try { r = await activar(persona, frase); } catch (e) {
      if (e instanceof ErrorNube && e.codigo === 'otra-frase') {
        if (!await confirmar(`${e.message} ¿Usar esta frase igualmente?`, { si: 'Usar esta frase' })) return;
        try { r = await activar(persona, frase, { aunqueNoCoincida: true }); } catch (e2) { aviso(mensaje(e2), 'error'); return; }
      } else { aviso(mensaje(e), 'error'); return; }
    }
    cerrarHoja(); pintar();
    // La nube ya tiene copias y este móvil no tiene ninguna sesión: ofrecer recuperarlas en vez de subir una vacía.
    if (r.copias > 0 && metadatos(estado()).sesiones === 0) {
      const u = r.ultimaQueAbre;
      if (await confirmar(`Ya tienes copias en la nube${u ? ` (la más nueva que abre tu frase: ${+(u.sesiones || 0)} sesiones, ${cuando(u.fecha)})` : ''} y este móvil no tiene ninguna sesión hecha. ¿Recuperar tus datos de la nube en vez de subir una copia vacía?`, { si: 'Recuperar', no: 'Ahora no' })) {
        if (u) verLista(); else hojaRecuperar(persona);
      }
      return;
    }
    if (r.floja) aviso('Copias activadas con tu frase de siempre, pero es fácil de adivinar: cámbiala en «Cambiar la frase» (las copias nuevas irán con la nueva).', 'info');
    else aviso('Copias en la nube activadas. Hago la primera ahora.');
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
      else if (r === 'retenida' || r === 'pausada') { aviso('No he subido nada: mira el aviso de la nube', 'info'); pintar(); }
      else if (n.error) aviso(n.error, 'error');
    });
  },
  'nube.forzar': async () => {
    const r = estadoNube().retenida;
    if (!await confirmar(`La copia más nueva de la nube pasará a tener ${r ? +r.sesiones : 'menos'} sesiones (las anteriores siguen en la nube). ¿Subir de todos modos?`, { si: 'Subir de todos modos', peligro: true })) return;
    const res = await copiarAhora('forzada', { forzar: true });
    aviso(res === 'ok' ? 'Copia hecha en la nube' : estadoNube().error || 'No se ha podido subir', res === 'ok' ? '' : 'error');
    pintar();
  },
  'nube.reanudar': () => { reanudarNube(); copiarAhora('reanudar').then(() => pintar()); pintar(); },
  'nube.lista': el => conEspera(el, verLista),
  'nube.restaurar': el => conEspera(el, async () => {
    const c = (listaPropia || []).find(x => x.nombre === el.dataset.n);
    if (!c) return;
    if (c.abre === false) { hojaRecuperar(estado().dueño); aviso('Esa copia se hizo con otra frase: escríbela para abrirla.', 'info'); return; }
    await restaurarDe(estado().dueño, c);
  }),
  'nube.recuperar': () => hojaRecuperar(),
  'nube.buscar': el => conEspera(el, async () => {
    const persona = ($('#n-persona .on') || { dataset: { v: 'victor' } }).dataset.v;
    const frase = $('#n-frase').value;
    const codigo = $('#n-codigo') ? $('#n-codigo').value.trim() : undefined;
    if (!frase) { aviso('Escribe la frase', 'error'); return; }
    const lista = $('#n-lista');
    let p;
    try { p = await probarCopias(persona, await listar(persona, { codigo }), { frase, codigo }); } catch (e) { aviso(mensaje(e), 'error'); return; }
    if (!p.copias.length) { lista.innerHTML = `<p class="tenue">${h(nombre(persona))} aún no tiene copias en la nube.</p>`; return; }
    recuperacion = { persona, frase, codigo, ...p };
    const abren = p.copias.filter(c => c.abre).length;
    // Siempre la lista entera: marca las que abre esta frase (sirve una frase antigua; una copia basura no bloquea).
    lista.innerHTML = `${abren ? `<p class="tenue">Esta frase abre ${abren} de ${p.copias.length} copias.</p>` : `<p class="nota aviso-nota error-nube">${h('No he podido abrir ninguna copia: la frase no es la correcta (o las copias están dañadas). Tus datos siguen como estaban.')}</p>`}
      <ul class="lista copias-lista">${p.copias.map(c => filaCopia(c, 'nube.restaurarCon')).join('')}</ul>`;
  }),
  'nube.restaurarCon': el => conEspera(el, async () => {
    const r = recuperacion; if (!r) return;
    const c = r.copias.find(x => x.nombre === el.dataset.n);
    if (!c) return;
    if (c.abre === false) { aviso('Esa copia no se abre con esta frase', 'error'); return; }
    if (await restaurarDe(r.persona, c, { frase: c.abre ? null : r.frase, clave: r.claves.get(c.sal) || null, codigo: r.codigo, bytes: r.bajadas.get(c.nombre) || null })) recuperacion = null;
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
