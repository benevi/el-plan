// Catálogo del sistema de diseño: muestras en vivo, persona y medidas de contraste (de contraste.json, que escribe comprobar.mjs).
import { linea, barras, vasos, vacio, cargando, activar, num } from './graficos.js';

const raiz = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
let medidas = null;

// ---------- Grupos de opción única (radiogroup): Tab entra en la elegida; flechas, Inicio y Fin cambian ----------
function radiogrupo(g, alCambiar) {
  const opciones = () => $$('[role="radio"]:not([aria-disabled="true"])', g);
  const elegir = (b, foco = true) => {
    $$('[role="radio"]', g).forEach(x => { const si = x === b; x.setAttribute('aria-checked', String(si)); x.tabIndex = si ? 0 : -1; });
    if (foco) b.focus();
    alCambiar?.(b);
  };
  g.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b && b.getAttribute('aria-disabled') !== 'true') elegir(b, false); });
  g.addEventListener('keydown', e => {
    const ops = opciones(); const i = ops.indexOf(document.activeElement);
    if (i < 0) return;
    const sig = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: ops.length - 1 }[e.key];
    if (sig == null) return;
    e.preventDefault();
    elegir(ops[(sig + ops.length) % ops.length]);
  });
}
radiogrupo($('.cat-cab [role="radiogroup"]'), b => { raiz.dataset.persona = b.dataset.persona; pintarMedidas(); });
$$('main .segmento[role="radiogroup"]').filter(g => !g.closest('[inert]')).forEach(g => radiogrupo(g));

// ---------- Tokens ----------
const COLORES = [
  ['Superficies', [['--sup-fondo', 'Fondo'], ['--sup-panel', 'Panel'], ['--sup-control', 'Control'], ['--sup-capa', 'Capa (hoja, aviso)'], ['--sup-agua', 'Agua (final)']]],
  ['Texto', [['--texto-1', 'Principal'], ['--texto-2', 'Secundario'], ['--texto-3', 'Terciario'], ['--texto-sobre-acento', 'Sobre el color de la persona']]],
  ['Bordes', [['--borde-fino', 'Filete (decorativo)'], ['--borde-control', 'Borde de control'], ['--borde-foco', 'Anillo de foco']]],
  ['Estados', [['--estado-bien', 'Bien'], ['--estado-aviso', 'Aviso'], ['--estado-error', 'Error'], ['--estado-info', 'Información']]],
  ['Persona', [['--acento', 'Color de la persona'], ['--acento-pulsado', 'Pulsado'], ['--acento-tinte', 'Tinte (elegido)']]],
];
$('#paleta').innerHTML = COLORES.map(([grupo, lista]) => `<div class="paleta-grupo"><h3>${grupo}</h3><ul>${lista.map(([t, n]) =>
  `<li><span class="muestra-color" data-token="${t}"></span><span><b>${n}</b><code>${t}</code></span><span class="medida" data-token-medida="${t}"></span></li>`).join('')}</ul></div>`).join('');
function pintarPaleta() {
  const cs = getComputedStyle(raiz);
  $$('[data-token]').forEach(n => { n.style.background = `var(${n.dataset.token})`; n.title = cs.getPropertyValue(n.dataset.token).trim(); });
}
pintarPaleta();

$('#espacios').innerHTML = [[1, 4], [2, 8], [3, 12], [4, 16], [5, 20], [6, 24], [8, 32], [10, 40], [12, 48], [16, 64]]
  .map(([k, px]) => `<li><code>--e-${k}</code><span class="barra-espacio e-${k}"></span><span class="cifra">${px}</span></li>`).join('');

const MOVS = [
  ['instante', '--m-instante · 100 ms · sale', 'Respuesta a un toque (pulsar, marcar).'],
  ['corto', '--m-corto · 200 ms · sale/entra', 'Abrir y cerrar, salir de pantalla, avisos.'],
  ['medio', '--m-medio · 300 ms · sale', 'Entrar una pantalla o una hoja.'],
  ['largo', '--m-largo · 600 ms · sale', 'Progreso que se llena (fuera de la serie).'],
  ['fluye', '--m-fluye · 900 ms · agua', 'Celebración: el agua sube y las cifras fluyen.'],
];
$('#movs').innerHTML = MOVS.map(([k, t, uso]) => `<li><div><b>${t}</b><p>${uso}</p></div><span class="pista-mov"><i class="bola mov-${k}"></i></span><button type="button" class="boton boton--secundario boton-mini" data-act="mov" data-mov="${k}" aria-label="Probar ${t.split(' · ')[0]}">Probar</button></li>`).join('');

// ---------- Selector ± ----------
function selector(s) {
  const v = $('[role="spinbutton"]', s); const b = $('b', v);
  const min = Number(s.dataset.min), max = Number(s.dataset.max), paso = Number(s.dataset.incremento);
  const poner = n => {
    n = Math.min(max, Math.max(min, Math.round(n / paso) * paso));
    v.setAttribute('aria-valuenow', String(n)); v.setAttribute('aria-valuetext', `${num(n)} ${s.dataset.unidad === 'kg' ? 'kilos' : 'repeticiones'}`);
    b.textContent = num(n);
    $('[data-paso="-1"]', s).setAttribute('aria-disabled', String(n <= min));
    $('[data-paso="1"]', s).setAttribute('aria-disabled', String(n >= max));
  };
  s.addEventListener('click', e => { const p = e.target.closest('[data-paso]'); if (p && p.getAttribute('aria-disabled') !== 'true') poner(Number(v.getAttribute('aria-valuenow')) + Number(p.dataset.paso) * paso); });
  v.addEventListener('keydown', e => {
    const ahora = Number(v.getAttribute('aria-valuenow'));
    const n = { ArrowUp: ahora + paso, ArrowRight: ahora + paso, ArrowDown: ahora - paso, ArrowLeft: ahora - paso, PageUp: ahora + paso * 4, PageDown: ahora - paso * 4, Home: min, End: max }[e.key];
    if (n == null) return; e.preventDefault(); poner(n);
  });
  poner(Number(v.getAttribute('aria-valuenow')));
}
$$('[data-selector]').forEach(selector);

// ---------- Series en vivo: un toque repite la serie; los kilos pasan a la siguiente ----------
const ses = { series: [{ kg: 22.5, reps: 10, hecha: true }, { kg: null, reps: null, hecha: false }, { kg: null, reps: null, hecha: false }], recien: -1 };
function pintarSeries() {
  const actual = ses.series.findIndex(s => !s.hecha);
  $('#series-vivo').innerHTML = ses.series.map((s, i) => {
    if (i === actual) {
      const kg = s.kg ?? ses.series[i - 1]?.kg ?? 20; const reps = s.reps ?? ses.series[i - 1]?.reps ?? 10;
      return `<li class="serie serie--actual" aria-current="step"><p class="selector-et">Serie <span class="cifra">${i + 1}</span> de ${ses.series.length}</p>
        <div class="selectores">
          <div class="selector" data-selector data-min="0" data-max="300" data-incremento="2.5" data-unidad="kg"><span class="selector-et" id="sv-kg-${i}">Kilos</span><div class="selector-valor" role="spinbutton" tabindex="0" aria-labelledby="sv-kg-${i}" aria-valuemin="0" aria-valuemax="300" aria-valuenow="${kg}"><b data-cifra>${num(kg)}</b><span>kg</span></div><div class="selector-pasos"><button type="button" data-paso="-1" aria-label="Menos 2,5 kilos"><svg class="icono" aria-hidden="true"><use href="#i-menos"/></svg></button><button type="button" data-paso="1" aria-label="Más 2,5 kilos"><svg class="icono" aria-hidden="true"><use href="#i-mas"/></svg></button></div></div>
          <div class="selector" data-selector data-min="1" data-max="50" data-incremento="1" data-unidad="reps"><span class="selector-et" id="sv-r-${i}">Repeticiones</span><div class="selector-valor" role="spinbutton" tabindex="0" aria-labelledby="sv-r-${i}" aria-valuemin="1" aria-valuemax="50" aria-valuenow="${reps}"><b data-cifra>${reps}</b><span>reps</span></div><div class="selector-pasos"><button type="button" data-paso="-1" aria-label="Una repetición menos"><svg class="icono" aria-hidden="true"><use href="#i-menos"/></svg></button><button type="button" data-paso="1" aria-label="Una repetición más"><svg class="icono" aria-hidden="true"><use href="#i-mas"/></svg></button></div></div>
        </div><button type="button" class="boton boton--ancho" data-act="serie-hecha">Serie ${i + 1} hecha</button></li>`;
    }
    return `<li class="serie ${s.hecha ? 'serie--hecha' : 'serie--pendiente'}${i === ses.recien ? ' serie--recien' : ''}"><span class="serie-n cifra">${i + 1}</span><span class="serie-valor cifra">${s.hecha ? `${num(s.kg)} kg × ${s.reps}` : 'Pendiente'}</span>${s.hecha ? '<span class="serie-estado"><svg class="icono" aria-hidden="true"><use href="#i-check"/></svg>Hecha</span>' : '<span></span>'}</li>`;
  }).join('') + (actual < 0 ? '<li class="serie"><span></span><span class="serie-valor">Todas hechas.</span><button type="button" class="boton boton--texto" data-act="series-reiniciar">Volver a empezar</button></li>' : '');
  $$('#series-vivo [data-selector]').forEach(selector);
}
pintarSeries();

// ---------- Hoja inferior accesible ----------
let ultimoToque = 0; let disparador = null;
function abrirHoja(desde) {
  disparador = desde;
  const capa = $('#capa-hoja');
  capa.innerHTML = `<div class="hoja-velo entra" data-act="velo"><div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-t">
    <div class="hoja-asa" aria-hidden="true"></div>
    <div class="hoja-cab"><h2 id="hoja-t" tabindex="-1">Cambiar press de banca</h2><button type="button" class="boton-icono boton-icono--sin-borde" data-act="cerrar-hoja" aria-label="Cerrar"><svg class="icono" aria-hidden="true"><use href="#i-cerrar"/></svg></button></div>
    <p class="cat-p2">Tienes 1 serie hecha: se conserva. Mismo músculo y con lo que hay libre:</p>
    <div class="segmento segmento--ancho hoja-opciones" role="radiogroup" aria-label="Ejercicio alternativo"><button type="button" role="radio" aria-checked="true" tabindex="0">En máquina</button><button type="button" role="radio" aria-checked="false" tabindex="-1">Flexiones</button></div>
    <button type="button" class="boton boton--ancho hoja-ok" data-act="cerrar-hoja">Cambiar</button>
  </div></div>`;
  radiogrupo($('.hoja-opciones', capa));
  $('main').inert = true; $('header.cat-cab').inert = true;
  $('#hoja-t').focus();
  history.pushState({ hoja: 1 }, '');
}
function cerrarHoja({ desdeHistoria = false } = {}) {
  const velo = $('#capa-hoja .hoja-velo'); if (!velo) return;
  const fin = () => { $('#capa-hoja').innerHTML = ''; $('main').inert = false; $('header.cat-cab').inert = false; disparador?.focus(); disparador = null; };
  if (!desdeHistoria && history.state?.hoja) history.back();
  if (reducido()) fin(); else { velo.classList.remove('entra'); velo.classList.add('sale'); setTimeout(fin, 200); }
}
window.addEventListener('popstate', () => cerrarHoja({ desdeHistoria: true }));
document.addEventListener('keydown', e => {
  const hoja = $('#capa-hoja .hoja'); if (!hoja) return;
  if (e.key === 'Escape') { e.preventDefault(); cerrarHoja(); return; }
  if (e.key === 'Tab') { // el foco no sale de la hoja
    const f = $$('button:not([tabindex="-1"]), [tabindex="0"]', hoja); const primero = f[0], ultimo = f.at(-1);
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
});

// ---------- Avisos ----------
const AVISOS = [
  ['bien', 'i-check', 'Sesión guardada', 'El entrenador la tendrá en cuenta para el sábado.'],
  ['error', 'i-error', 'No se ha podido guardar', 'Lo hecho sigue en el móvil. Se volverá a intentar al recuperar la red.'],
  ['info', 'i-info', 'Hoy, 50 minutos', 'El check-in ha recortado el cardio.'],
];
let nAviso = 0;
function mostrarAviso() {
  const [tipo, ico, t, p] = AVISOS[nAviso++ % AVISOS.length];
  const a = document.createElement('div');
  a.className = `aviso aviso--${tipo} entra`; a.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  a.innerHTML = `<svg class="icono" aria-hidden="true"><use href="#${ico}"/></svg><div class="aviso-texto"><b>${t}</b><p>${p}</p></div><button type="button" class="boton-icono boton-icono--sin-borde" data-act="cerrar-aviso" aria-label="Cerrar aviso"><svg class="icono" aria-hidden="true"><use href="#i-cerrar"/></svg></button>`;
  $('#pila-avisos').replaceChildren(a);
  if (tipo !== 'error') setTimeout(() => a.isConnected && a.remove(), 6000); // los errores se quedan hasta cerrarlos (R13)
}

// ---------- Descanso en vivo ----------
const desc = { total: 12, quedan: 12, reloj: null, alarma: null };
const dv = $('#descanso-vivo');
function pintarDescanso() {
  $('[data-reloj]', dv).textContent = mmss(desc.quedan);
  dv.style.setProperty('--p', String(desc.quedan / desc.total));
  dv.classList.toggle('descanso--ultimos', desc.quedan > 0 && desc.quedan <= 10 && !dv.classList.contains('descanso--alarma'));
  $('.descanso-et', dv).textContent = dv.classList.contains('descanso--alarma') ? 'A por la serie 3' : desc.quedan <= 10 ? 'Prepárate' : 'Descanso';
}
function empezarDescanso(seg = 12) {
  clearInterval(desc.reloj); clearTimeout(desc.alarma);
  dv.classList.remove('descanso--alarma', 'suena', 'sobre-acento');
  Object.assign(desc, { total: seg, quedan: seg });
  pintarDescanso();
  desc.reloj = setInterval(() => {
    desc.quedan -= 1;
    if (desc.quedan <= 0) {
      desc.quedan = 0; clearInterval(desc.reloj);
      dv.classList.add('descanso--alarma', 'suena', 'sobre-acento');
      $('#descanso-anuncio').textContent = 'Descanso terminado. A por la serie 3.';
      try { navigator.vibrate?.([250, 120, 250, 120, 250]); } catch { /* sin vibración: tres toques seguidos */ }
      desc.alarma = setTimeout(() => { dv.classList.remove('descanso--alarma', 'suena', 'sobre-acento'); pintarDescanso(); }, 8000);
    }
    pintarDescanso();
  }, 1000);
}
pintarDescanso();

// ---------- Contador en vivo ----------
const cont = { total: 20, pasados: 0, reloj: null, estado: 'listo' };
const cv = $('#contador-vivo');
function pintarContador() {
  $('[data-reloj]', cv).textContent = mmss(cont.estado === 'listo' ? cont.total : cont.total - cont.pasados);
  cv.style.setProperty('--p', String(cont.pasados / cont.total));
  $('[data-estado]', cv).textContent = { listo: 'Listo para empezar', marcha: 'En marcha', pausa: 'En pausa', hecho: `Hecho: ${cont.total} s` }[cont.estado];
  cv.classList.toggle('contador--terminado', cont.estado === 'hecho');
  $('[data-act="contador"]', cv).textContent = { listo: 'Empezar', marcha: 'Pausar', pausa: 'Seguir', hecho: 'Repetir' }[cont.estado];
}
function contador() {
  if (cont.estado === 'marcha') { clearInterval(cont.reloj); cont.estado = 'pausa'; pintarContador(); return; }
  if (cont.estado === 'hecho') cont.pasados = 0;
  cont.estado = 'marcha'; pintarContador();
  cont.reloj = setInterval(() => {
    cont.pasados += 1;
    if (cont.pasados >= cont.total) { clearInterval(cont.reloj); cont.estado = 'hecho'; try { navigator.vibrate?.(200); } catch { /* nada */ } }
    pintarContador();
  }, 1000);
}
pintarContador();

// ---------- Gráficos ----------
const SEMANAS = ['29 sep', '6 oct', '13 oct', '20 oct', '27 oct', '3 nov', '10 nov', '17 nov'];
$('#graficos').innerHTML = [
  ['grafico-constancia', 'Constancia', vasos({ titulo: 'Constancia, últimas 8 semanas', semanas: [[3, 4], [4, 4], [2, 3], [4, 4], [3, 4], [4, 4], [3, 3], [2, 4]], etiquetas: SEMANAS })],
  ['grafico-fuerza', 'Fuerza', linea({ titulo: 'Fuerza · press de banca, mejor serie', cifra: '+5', cifraTexto: 'kg en 8 semanas', unidad: 'kg', valores: [17.5, 17.5, 20, 20, 20, 20, 22.5, 22.5], etiquetas: SEMANAS })],
  ['grafico-medidas', 'Medidas (dos gráficos, dos unidades)', `<div class="multiples">${linea({ titulo: 'Peso', cifra: '79,6', cifraTexto: 'kg', unidad: 'kg', valores: [81.2, 80.9, 80.7, 80.4, 80.1, 80.0, 79.8, 79.6], etiquetas: SEMANAS, paso: 1, ancho: 160 })}${linea({ titulo: 'Cintura', cifra: '86', cifraTexto: 'cm', unidad: 'cm', valores: [89, 89, 88, 88, 87, 87, 86, 86], etiquetas: SEMANAS, paso: 1, ancho: 160 })}</div>`],
  ['grafico-dolor', 'Dolor por zona (0 a 10)', `<div class="multiples">${barras({ titulo: 'Lumbar', cifra: '1', cifraTexto: 'de 10 ahora', unidad: 'de 10', valores: [4, 4, 3, 3, 2, 2, 1, 1], etiquetas: SEMANAS })}${barras({ titulo: 'Rodilla', cifra: '2', cifraTexto: 'de 10 ahora', unidad: 'de 10', valores: [2, 3, 3, 2, 2, 2, 3, 2], etiquetas: SEMANAS })}</div>`],
  ['grafico-vacio', 'Vacío', vacio({ titulo: 'Medidas', cabecera: 'Aún no hay medidas', texto: 'Apunta tu peso o la cintura una vez por semana y verás cómo cambian.', accion: 'Apuntar medidas' })],
  ['grafico-cargando', 'Cargando', cargando({ titulo: 'Fuerza' })],
].map(([id, cap, html]) => `<figure class="muestra${id === 'grafico-medidas' || id === 'grafico-dolor' ? ' ancha' : ''}" data-medir="${id}">${html}<figcaption>${cap}</figcaption></figure>`).join('');
activar($('#graficos'));

// ---------- Acciones ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.getAttribute('aria-disabled') === 'true') return;
  switch (b.dataset.act) {
    case 'cargar':
      if (b.getAttribute('aria-busy') === 'true') break;
      b.setAttribute('aria-busy', 'true'); b.innerHTML = '<span class="giro" aria-hidden="true"></span>Guardando…';
      setTimeout(() => { b.removeAttribute('aria-busy'); b.textContent = 'Guardado'; setTimeout(() => { b.textContent = 'Guardar sesión'; }, 1500); }, 1500);
      break;
    case 'alternar': b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); break;
    case 'serie-hecha': {
      if (Date.now() - ultimoToque < 400) break; // doble toque = uno (R27)
      ultimoToque = Date.now();
      const i = ses.series.findIndex(s => !s.hecha); const s = ses.series[i];
      const fila = b.closest('.serie');
      s.kg = Number($('[data-unidad="kg"] [role="spinbutton"]', fila).getAttribute('aria-valuenow'));
      s.reps = Number($('[data-unidad="reps"] [role="spinbutton"]', fila).getAttribute('aria-valuenow'));
      s.hecha = true; ses.recien = i;
      const sig = ses.series[i + 1]; if (sig) { sig.kg ??= s.kg; sig.reps ??= s.reps; } // R05
      pintarSeries();
      ($('#series-vivo [data-act="serie-hecha"]') || $('#series-vivo [data-act="series-reiniciar"]'))?.focus();
      break;
    }
    case 'series-reiniciar': ses.series = [{ kg: 22.5, reps: 10, hecha: true }, { kg: null, reps: null, hecha: false }, { kg: null, reps: null, hecha: false }]; ses.recien = -1; pintarSeries(); $('#series-vivo [data-act="serie-hecha"]')?.focus(); break;
    case 'abrir-hoja': abrirHoja(b); break;
    case 'cerrar-hoja': cerrarHoja(); break;
    case 'velo': if (e.target === b) cerrarHoja(); break;
    case 'aviso': mostrarAviso(); break;
    case 'cerrar-aviso': b.closest('.aviso').remove(); $('[data-act="aviso"]').focus(); break;
    case 'descanso-empezar': empezarDescanso(12); break;
    case 'descanso-mas': desc.quedan += 15; desc.total = Math.max(desc.total, desc.quedan); pintarDescanso(); break;
    case 'descanso-saltar': clearInterval(desc.reloj); clearTimeout(desc.alarma); dv.classList.remove('descanso--alarma', 'suena', 'sobre-acento'); desc.quedan = desc.total; pintarDescanso(); break;
    case 'contador': contador(); break;
    case 'mov': {
      const bola = $(`.mov-${b.dataset.mov}`); bola.classList.remove('va'); void bola.offsetWidth; bola.classList.add('va'); break;
    }
    default: break;
  }
});

// ---------- Medidas de contraste (de comprobar.mjs) ----------
function pintarMedidas() {
  pintarPaleta();
  if (!medidas) return;
  const p = raiz.dataset.persona;
  const m = medidas.personas[p];
  $$('[data-medir]').forEach(f => {
    const r = m.muestras[f.dataset.medir];
    let cap = $('figcaption', f); if (!cap) return;
    let badge = $('.medida', cap);
    if (!badge) { badge = document.createElement('span'); badge.className = 'medida'; cap.append(' ', badge); }
    if (!r) { badge.textContent = 'sin medir'; return; }
    badge.textContent = `${r.ok ? 'Cumple' : 'NO cumple'}: mínimo ${r.minimo.toFixed(2).replace('.', ',')}:1 (${r.pares} pares)`;
    badge.classList.toggle('mal', !r.ok);
  });
  $$('[data-token-medida]').forEach(n => {
    const r = m.tokens[n.dataset.tokenMedida];
    n.textContent = r ? `${r.toFixed(2).replace('.', ',')}:1` : '';
  });
  const tot = m.resumen;
  $('#resumen').textContent = `${tot.cumplen} de ${tot.pares} pares cumplen AA (${p === 'victor' ? 'Víctor' : 'Virginia'}). Medido el ${medidas.fecha}.`;
}
fetch('contraste.json').then(r => (r.ok ? r.json() : null)).then(j => { medidas = j; pintarMedidas(); if (!j) $('#resumen').textContent = 'Aún no hay medidas: ejecuta node prototipos/sistema/comprobar.mjs.'; })
  .catch(() => { $('#resumen').textContent = 'No se han podido cargar las medidas de contraste.'; });
