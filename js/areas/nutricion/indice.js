// Área NUTRICIÓN: menú semanal común a los dos (con raciones de cada uno), tuppers de las semanas de turno
// de tarde, lista de la compra y ajustes de comida. La lógica está en calculo.js; el agente en api/nutricion.js.
//
// Datos en estado().nutricion = { yo, compartido } (ver calculo.js). Lo «compartido» es lo que se pasará al
// otro móvil: hasta que haya sincronización, se pasa con «Pasar al otro móvil» (copiar y pegar).
// Lee del perfil (sexo, altura, nacimiento, objetivos, disponibilidad), de las medidas y del plan semanal.

import { rutas, pestaña, acciones, ir, pintar } from '../../nucleo/router.js';
import { estado, cambiar } from '../../nucleo/estado.js';
import { h, ICONOS, abrirHoja, cerrarHoja, aviso, $, fechaCorta } from '../../nucleo/ui.js';
import { llamar } from '../../nucleo/api.js';
import { PERSONAS, DIAS, DIAS_CORTOS } from '../../datos/constantes.js';
import * as C from './calculo.js';

const ui = { semana: 0, dia: ((new Date().getDay() + 6) % 7) + 1, cargando: false, gen: null };
const PESTAÑAS = [['menu', 'Menú'], ['compra', 'Compra'], ['tupper', 'Tupper'], ['ajustes', 'Ajustes']];

const N = () => C.asegurar(estado());
const yoKey = () => estado().dueño || 'victor';
const otroKey = () => (yoKey() === 'victor' ? 'virginia' : 'victor');
const nombre = k => (PERSONAS[k] || {}).nombre || k;
const lunes = () => C.sumarDias(C.lunesDe(), ui.semana * 7);
const menuSemana = () => N().compartido.menus[lunes()];
const objetivosYo = () => C.objetivosPersona(N().yo, C.datosPersona(estado()));
const lista = v => String(v || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
const alternar = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v));
const fmtSemana = l => `${fechaCorta(l)} – ${fechaCorta(C.sumarDias(l, 6))}`;
const litros = ml => String(Math.round(ml / 100) / 10).replace('.', ',');

// La ficha propia se rehace con el perfil y las medidas de este móvil y se guarda en lo compartido.
function refrescarFicha(S, l) {
  const f = C.fichaPropia(S, yoKey(), nombre(yoKey()), l || lunes());
  if (!f.faltan) S.nutricion.compartido.fichas[yoKey()] = f;
  return f;
}

// ───────── Vistas ─────────
function cabecera(tab) {
  return `<h1 class="titulo">Comida</h1>
    <div class="segmentos" role="tablist">${PESTAÑAS.map(([k, t]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-act="nutri.tab" data-v="${k}">${t}</button>`).join('')}</div>`;
}
const selSemana = () => `<div class="segmentos" style="margin-top:10px">${[0, 1].map(n => `<button class="${ui.semana === n ? 'on' : ''}" data-act="nutri.semana" data-v="${n}">${n ? 'Próxima semana' : 'Esta semana'}<small>${fmtSemana(C.sumarDias(C.lunesDe(), n * 7))}</small></button>`).join('')}</div>`;

function tarjetaObjetivo() {
  const o = objetivosYo();
  if (o.faltan.length) return `<section class="tarjeta"><h2>Tu objetivo diario</h2><p>Para calcular tus cantidades falta: ${o.faltan.map(h).join(', ')}.</p><a class="btn sec" href="#perfil">Ir al perfil</a></section>`;
  const celda = (v, t) => `<span style="display:flex;flex-direction:column;align-items:center"><b style="font-size:19px">${v}</b><span class="tenue" style="font-size:12px">${t}</span></span>`;
  const fila = (x, t) => `<div style="margin-top:12px"><b>${t}</b><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px">${celda(x.kcal, 'kcal')}${celda(x.proteina, 'prot g')}${celda(x.hidratos, 'hidr g')}${celda(x.grasa, 'grasa g')}</div></div>`;
  return `<section class="tarjeta"><h2>Tu objetivo diario</h2><p class="tenue">${h(o.objetivo)}</p>
    ${fila(o.entreno, 'Día de entreno')}${fila(o.descanso, 'Día de descanso')}
    <p class="tenue pie">Agua: ${litros(o.agua.descanso)} l en descanso, ${litros(o.agua.entreno)} l si entrenas. <button class="enlace" style="display:inline;padding:0" data-act="nutri.como">Cómo se calcula</button></p></section>`;
}

function vMenu() {
  const l = lunes(), m = menuSemana();
  let out = selSemana() + tarjetaObjetivo();
  if (ui.cargando) return out + `<section class="tarjeta cargando"><div class="giro"></div><b>Preparando el menú…</b><p class="tenue">El nutricionista está planificando la semana. Tarda uno o dos minutos; no cierres esta pantalla.</p></section>`;
  if (!m) return out + `<section class="tarjeta"><h2>Menú de la semana</h2><p class="tenue">Se prepara una vez por semana con vuestros datos, el entreno de esa semana, los turnos y lo que tengáis en casa.</p><button class="btn" data-act="nutri.preparar">${ICONOS.ia} Preparar el menú</button></section>`;
  const menu = m.menu, rec = {}; menu.recetas.forEach(r => { rec[r.id] = r; });
  const yo = yoKey();
  out += `<section class="tarjeta"><p>${h(menu.resumen)}</p><p class="tenue pie">Para ${C.PERSONAS_N.filter(k => (m.quien || []).includes(k)).map(nombre).join(' y ')} · hecho por ${h(nombre(m.por))} el ${h(fechaCorta(m.creado.slice(0, 10)))}</p></section>`;
  out += `<div class="chips dias" style="margin:14px 0">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="chip ${ui.dia === d ? 'on' : ''}" data-act="nutri.dia" data-v="${d}" aria-label="${DIAS[d]}">${DIAS_CORTOS[d]}</button>`).join('')}</div>`;
  const dia = menu.dias.find(d => d.dia === ui.dia);
  out += `<section class="tarjeta"><h2>${DIAS[ui.dia]}</h2>`;
  if (dia && dia.comidas.length) {
    const ficha = N().compartido.fichas[yo];
    const ent = ((m.entreno || {})[yo] || []).includes(ui.dia);
    const tot = C.totalesDia(menu, ui.dia, yo);
    const obj = ficha && (ent ? ficha.objetivoDiaEntreno : ficha.objetivoDiaDescanso);
    if (tot && obj && tot.kcal) out += `<p class="tenue">${ent ? 'Día de entreno' : 'Día de descanso'}: ${tot.kcal} de ${obj.kcal} kcal y ${tot.proteina} de ${obj.proteina} g de proteína (según el nutricionista).</p>`;
    out += `<ul class="lista">${dia.comidas.map(c => {
      const r = rec[c.recetaId]; if (!r) return '';
      const quien = C.PERSONAS_N.filter(k => c[k]);
      const tupper = (c.enTrabajo || []).length ? `<span class="insignia aviso">Tupper de ${(c.enTrabajo || []).map(nombre).join(' y ')}</span>` : '';
      return `<li><button class="fila" data-act="nutri.receta" data-v="${h(r.id)}"><span class="grow"><span class="tenue">${h(c.momento)}</span><b>${h(r.nombre)}</b><span class="tenue">${quien.map(nombre).join(' y ')} · ${r.minutos} min</span></span>${tupper}${ICONOS.sig}</button></li>`;
    }).join('')}</ul>`;
  } else out += '<p class="tenue">Sin comidas este día.</p>';
  out += '</section>';
  if ((menu.preparacion || []).length) out += `<section class="tarjeta"><h2>Preparación anticipada</h2>${menu.preparacion.map(p => `<h3>${h(p.cuando)}</h3><ul>${p.tareas.map(t => `<li>${h(t)}</li>`).join('')}</ul>`).join('')}</section>`;
  const crit = (menu.criterios || {})[yo];
  out += `<details class="tarjeta plegable"><summary>${ICONOS.info} Por qué es así</summary>${crit ? `<p>${h(crit)}</p>` : ''}${(menu.consejos || []).length ? `<ul>${menu.consejos.map(c => `<li>${h(c)}</li>`).join('')}</ul>` : ''}</details>`;
  out += `<button class="btn sec" data-act="nutri.preparar" style="width:100%">Rehacer el menú de esta semana</button>`;
  return out;
}

function vCompra() {
  const m = menuSemana();
  let out = selSemana();
  if (!m) return out + `<section class="tarjeta"><p class="tenue">Aún no hay menú para esta semana. <a href="#nutricion/menu">Prepararlo</a></p></section>`;
  const l = C.listaCompra(m.menu, N().compartido.hogar.despensa);
  const marc = m.compra.marcados;
  const fila = i => `<li class="${marc[i.id] ? 'apagada' : ''}"><label class="interruptor" style="margin:10px 0"><input type="checkbox" data-cambio="nutri.marcar" data-v="${h(i.id)}" ${marc[i.id] ? 'checked' : ''}><span class="grow">${h(i.nombre)}</span><span class="tenue">${h(i.texto)}</span></label></li>`;
  out += `<p class="tenue pie">Para los dos y toda la semana, sumado de las recetas. Marca lo que ya está en el carro.</p>`;
  l.secciones.forEach(s => { out += `<section class="tarjeta"><h2>${h(s.seccion)}</h2><ul class="lista">${s.items.map(fila).join('')}</ul></section>`; });
  if ((m.compra.extra || []).length) out += `<section class="tarjeta"><h2>Añadido a mano</h2><ul class="lista">${m.compra.extra.map(x => fila({ id: 'extra:' + x, nombre: x, texto: '' })).join('')}</ul></section>`;
  out += `<section class="tarjeta"><label class="campo col"><span>Añadir algo a la lista</span><input id="nutri-extra" placeholder="Papel de cocina, café…"></label><button class="btn sec" data-act="nutri.extra">${ICONOS.mas} Añadir</button></section>`;
  if (l.enCasa.length) out += `<section class="tarjeta"><h2>Ya lo tenéis en casa</h2><p class="tenue">Revisad que haya suficiente.</p><ul class="lista">${l.enCasa.map(fila).join('')}</ul></section>`;
  out += `<button class="btn" data-act="nutri.compartirLista" style="width:100%">Copiar o compartir la lista</button>`;
  return out;
}

function vTupper() {
  const l = lunes(), n = N(), yo = yoKey();
  let out = selSemana();
  const t = n.yo.turnos;
  if (!t.activo) out += `<section class="tarjeta"><h2>Turnos de trabajo</h2><p class="tenue">Si trabajas a turnos de mañana y tarde que cambian cada semana, actívalo en Ajustes y en las semanas de tarde el menú incluirá tuppers que solo necesitan microondas.</p><button class="btn sec" data-act="nutri.tab" data-v="ajustes">Ir a Ajustes</button></section>`;
  else {
    const turno = C.turnoSemana(t, l);
    out += `<section class="tarjeta"><h2>Turno de ${h(turno)}</h2><p class="tenue">${turno === 'tarde' ? 'Te llevas: ' + t.comidasTrabajo.map(h).join(', ') + ' (solo microondas).' : 'Esta semana comes en casa.'}</p>
      <div class="segmentos">${['mañana', 'tarde'].map(x => `<button class="${turno === x ? 'on' : ''}" data-act="nutri.turnoSemana" data-v="${x}">Esta semana: ${x}</button>`).join('')}</div></section>`;
  }
  const m = menuSemana();
  if (!m) return out;
  const rec = {}; m.menu.recetas.forEach(r => { rec[r.id] = r; });
  const items = [];
  m.menu.dias.forEach(d => d.comidas.forEach(c => { if ((c.enTrabajo || []).length && rec[c.recetaId]) items.push({ d, c, r: rec[c.recetaId] }); }));
  out += `<section class="tarjeta"><h2>Tuppers de la semana</h2>`;
  out += items.length ? `<ul class="lista">${items.map(({ d, c, r }) => `<li><button class="fila" data-act="nutri.receta" data-v="${h(r.id)}"><span class="grow"><span class="tenue">${DIAS[d.dia]} · ${h(c.momento)} · ${c.enTrabajo.map(nombre).join(' y ')}</span><b>${h(r.nombre)}</b><span class="tenue">${h(r.calentar)} · ${h(r.conservacion)}</span></span>${ICONOS.sig}</button></li>`).join('')}</ul>` : '<p class="tenue">Esta semana no hay comidas en el trabajo.</p>';
  return out + '</section>';
}

const chips = (pares, sel, act, extra = '') => `<div class="chips">${pares.map(([v, t]) => `<button class="chip ${sel.includes(v) ? 'on' : ''}" data-act="${act}" data-v="${h(v)}" ${extra}>${h(t)}</button>`).join('')}</div>`;
function vAjustes() {
  const n = N(), y = n.yo, t = y.turnos, H = n.compartido.hogar, otro = otroKey(), fo = n.compartido.fichas[otro];
  let out = `<section class="tarjeta"><h2>Lo tuyo</h2><p class="tenue">Peso, altura, edad, objetivos y días de entreno se leen de tu perfil y tus medidas.</p>
    <label class="campo col"><span>Actividad fuera del entreno</span><select data-cambio="nutri.actividad">${Object.entries(C.ACTIVIDAD).map(([k, v]) => `<option value="${k}" ${y.actividad === k ? 'selected' : ''}>${h(v)}</option>`).join('')}</select></label>
    <div class="campo col"><span>Comidas que haces al día</span>${chips(C.MOMENTOS.map(x => [x, x]), y.comidas, 'nutri.comida')}</div>
    <label class="campo col"><span>Ajuste manual de kcal al día (+/-)</span><input type="number" inputmode="numeric" data-cambio="nutri.yoNum" data-k="ajusteKcal" value="${h(y.ajusteKcal || '')}" placeholder="0"></label>
    <label class="campo col"><span>Alergias o intolerancias tuyas</span><input data-cambio="nutri.yoLista" data-k="alergias" value="${h(y.alergias.join(', '))}" placeholder="separadas por comas"></label>
    <label class="campo col"><span>Lo que no te gusta</span><input data-cambio="nutri.yoLista" data-k="noGusta" value="${h(y.noGusta.join(', '))}"></label></section>`;
  out += `<section class="tarjeta"><h2>Turnos de trabajo</h2><label class="interruptor"><input type="checkbox" data-cambio="nutri.turnos" ${t.activo ? 'checked' : ''}><span>Trabajo a turnos de mañana y tarde que cambian cada semana</span></label>`;
  if (t.activo) {
    out += `<div class="campo col"><span>Esta semana tengo turno de</span><div class="segmentos">${['mañana', 'tarde'].map(v => `<button class="${C.turnoSemana(t, C.lunesDe()) === v ? 'on' : ''}" data-act="nutri.turnoRef" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="campo col"><span>En las semanas de tarde como en el trabajo (solo microondas)</span>${chips(C.MOMENTOS.map(x => [x, x]), t.comidasTrabajo, 'nutri.comidaTrabajo')}</div>
      <div class="campo col"><span>Días que trabajo</span><div class="chips dias">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="chip ${t.diasTrabajo.includes(d) ? 'on' : ''}" data-act="nutri.diaTrabajo" data-v="${d}">${DIAS_CORTOS[d]}</button>`).join('')}</div></div>`;
  }
  out += `</section><section class="tarjeta"><h2>En casa (de los dos)</h2>
    <label class="campo col"><span>Alergias e intolerancias de la casa</span><input data-cambio="nutri.hogarLista" data-k="alergias" value="${h(H.alergias.join(', '))}"></label>
    <label class="campo col"><span>No nos gusta</span><input data-cambio="nutri.hogarLista" data-k="noGusta" value="${h(H.noGusta.join(', '))}"></label>
    <label class="campo col"><span>Nos gusta</span><input data-cambio="nutri.hogarLista" data-k="gustan" value="${h(H.gustan.join(', '))}"></label>
    <label class="campo col"><span>Lo que hay en casa (uno por línea)</span><textarea rows="5" data-cambio="nutri.hogarLista" data-k="despensa" placeholder="arroz integral&#10;garbanzos cocidos&#10;pechuga de pollo">${h(H.despensa.join('\n'))}</textarea></label>
    <label class="campo col"><span>Minutos máximos para cocinar entre semana</span><input type="number" inputmode="numeric" data-cambio="nutri.hogarNum" data-k="minutosEntreSemana" value="${h(H.minutosEntreSemana)}"></label>
    <label class="campo col"><span>Platos de otras cocinas por semana</span><input type="number" inputmode="numeric" data-cambio="nutri.hogarNum" data-k="platosDelMundo" value="${h(H.platosDelMundo)}"></label>
    <label class="interruptor"><input type="checkbox" data-cambio="nutri.batch" ${H.batchDomingo ? 'checked' : ''}><span>Dejar cosas preparadas el domingo</span></label></section>`;
  out += `<section class="tarjeta"><h2>Con ${h(nombre(otro))}</h2><p class="tenue">${fo ? `Tengo los datos de ${h(nombre(otro))} del ${h(fechaCorta(fo.actualizado.slice(0, 10)))}.` : `Para que el menú sea para los dos necesito los datos de ${h(nombre(otro))}.`} Hasta que los móviles se sincronicen solos, se pasan copiando y pegando: menú, compra, casa y datos de comida.</p>
    <div class="fila-botones"><button class="btn sec" data-act="nutri.exportar">Copiar mis datos</button><button class="btn sec" data-act="nutri.importar">Pegar los de ${h(nombre(otro))}</button></div></section>`;
  return out;
}

function vista(params) {
  const tab = PESTAÑAS.some(([k]) => k === params[0]) ? params[0] : 'menu';
  return `<div class="area-nutricion">${cabecera(tab)}${({ menu: vMenu, compra: vCompra, tupper: vTupper, ajustes: vAjustes })[tab]()}</div>`;
}

// ───────── Hojas ─────────
function hojaReceta(id) {
  const m = menuSemana(); if (!m) return;
  const r = m.menu.recetas.find(x => x.id === id); if (!r) return;
  const val = N().compartido.valoraciones[C.clave(r.nombre)];
  const cols = C.PERSONAS_N.filter(u => m.menu.dias.some(d => d.comidas.some(c => c.recetaId === id && c[u])));
  const nut = cols.map(u => r.nutricion && r.nutricion[u] ? `${nombre(u)}: ${Math.round(r.nutricion[u].kcal)} kcal · ${Math.round(r.nutricion[u].proteina)} g prot` : '').filter(Boolean).join('<br>');
  const v = r.videos;
  const videos = v ? (v.videos.length ? `<ul class="lista">${v.videos.map(x => `<li><a class="fila" href="${h(x.url)}" target="_blank" rel="noopener">${ICONOS.video}<span class="grow"><b>${h(x.titulo)}</b><span class="tenue">${h(x.canal)} · ${h(x.duracion)}</span></span></a></li>`).join('')}</ul>` : '<p class="tenue">No he encontrado un vídeo comprobado.</p>') + `<a class="enlace" href="${h(v.buscar)}" target="_blank" rel="noopener">Ver más en YouTube</a>`
    : `<button class="btn sec" data-act="nutri.video" data-v="${h(r.id)}">${ICONOS.video} Buscar vídeo de la receta</button>`;
  abrirHoja(`<h2>${h(r.nombre)}</h2><p class="tenue">${h(r.cocina)} · ${r.minutos} min · ${h(r.dificultad)}</p>
    <p>${h(r.nota)}</p>${nut ? `<p class="pie">${nut}</p>` : ''}
    ${r.tupper ? `<div class="nota aviso-nota"><b>Tupper.</b> ${h(r.calentar)}<br>${h(r.conservacion)}</div>` : (r.conservacion ? `<p class="tenue pie">${h(r.conservacion)}</p>` : '')}
    <h3 style="margin-top:18px">Ingredientes por ración</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14.5px"><thead><tr><th></th>${cols.map(u => `<th style="text-align:right;font-size:12px;color:var(--txt-2);padding-left:10px">${h(nombre(u))}</th>`).join('')}</tr></thead><tbody>
    ${r.ingredientes.map(i => `<tr style="border-top:1px solid var(--line)"><td style="padding:6px 0">${h(i.nombre)}</td>${cols.map(u => `<td style="text-align:right;white-space:nowrap;padding-left:10px">${+i[u] ? C.racion(+i[u], i.unidad) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <h3 style="margin-top:18px">Pasos</h3><ol style="padding-left:20px;line-height:1.5">${r.pasos.map(p => `<li>${h(p)}</li>`).join('')}</ol>
    <h3 style="margin-top:18px">Vídeo</h3><div id="nutri-video">${videos}</div>
    <h3 style="margin-top:18px">¿Os gusta?</h3><div class="segmentos">${[[1, 'No'], [2, 'Normal'], [3, 'Nos gusta']].map(([k, t]) => `<button class="${val === k ? 'on' : ''}" data-act="nutri.valorar" data-v="${k}" data-id="${h(r.id)}">${t}</button>`).join('')}</div>
    <h3 style="margin-top:18px">Cambiar este plato</h3><input id="nutri-motivo" data-no-foco="1" placeholder="Motivo (opcional): sin horno, sin pescado…">
    <div class="fila-botones"><button class="btn sec" data-act="nutri.cambiar" data-v="${h(r.id)}">Pedir otro plato</button><button class="btn sec" data-act="nutri.cerrar">Cerrar</button></div>`);
}

function hojaPreparar() {
  const S = estado(), l = lunes(), yo = yoKey(), otro = otroKey();
  const fo = N().compartido.fichas[otro];
  if (!ui.gen || ui.gen.lunes !== l) ui.gen = { lunes: l, quien: fo ? [yo, otro] : [yo], entreno: { [yo]: C.diasEntreno(S, l), [otro]: fo ? fo.diasEntreno.slice() : [] } };
  const g = ui.gen;
  const diasDe = k => `<div class="campo col"><span>Días que entrena ${h(nombre(k))} esa semana</span><div class="chips dias">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button class="chip ${g.entreno[k].includes(d) ? 'on' : ''}" data-act="nutri.gDia" data-u="${k}" data-v="${d}">${DIAS_CORTOS[d]}</button>`).join('')}</div></div>`;
  abrirHoja(`<h2>Menú de la semana</h2><p class="tenue">${fmtSemana(l)}</p>
    <div class="campo col"><span>¿Para quién?</span>${chips([[yo, nombre(yo)]].concat(fo ? [[otro, nombre(otro)]] : []), g.quien, 'nutri.gQuien')}</div>
    ${fo ? '' : `<p class="nota">Aún no tengo los datos de ${h(nombre(otro))}. Pásalos en Comida → Ajustes para que el menú sea para los dos.</p>`}
    ${g.quien.map(diasDe).join('')}
    <p class="tenue pie">Lo que hay en casa y los turnos se cambian en Ajustes. Cada menú gasta unos céntimos de la API de Claude.</p>
    <button class="btn" data-act="nutri.generar" style="width:100%">${ICONOS.ia} Preparar menú</button>`);
}

async function generar() {
  const S = estado(), g = ui.gen, yo = yoKey();
  const f = C.fichaPropia(S, yo, nombre(yo), g.lunes);
  if (f.faltan) { cerrarHoja(); aviso('Faltan datos: ' + f.faltan.join(', ')); return; }
  const fichas = {};
  g.quien.forEach(k => { fichas[k] = k === yo ? f : N().compartido.fichas[k]; });
  const peticion = C.peticionMenu(N().compartido, fichas, g.lunes, g.entreno);
  cerrarHoja(); ui.cargando = true; pintar();
  try {
    const j = await llamar('nutricion', { modo: 'menu', peticion }, { espera: 300000 });
    cambiar(S2 => {
      const n = C.asegurar(S2);
      n.compartido.fichas[yo] = f;
      const prev = n.compartido.menus[g.lunes];
      n.compartido.menus[g.lunes] = { creado: new Date().toISOString(), por: yo, quien: g.quien.slice(), entreno: g.entreno, peticion, menu: j.menu, uso: j.uso, compra: prev ? prev.compra : { marcados: {}, extra: [] } };
    }, 'nutricion');
    ui.cargando = false; pintar(); aviso('Menú listo');
  } catch (e) { ui.cargando = false; pintar(); aviso('No se pudo crear el menú: ' + e.message); }
}

// ───────── Acciones ─────────
acciones({
  'nutri.tab': el => ir('nutricion/' + el.dataset.v),
  'nutri.semana': el => { ui.semana = +el.dataset.v; pintar(); },
  'nutri.dia': el => { ui.dia = +el.dataset.v; pintar(); },
  'nutri.receta': el => hojaReceta(el.dataset.v),
  'nutri.cerrar': () => cerrarHoja(),
  'nutri.como': () => { const o = objetivosYo(); abrirHoja(`<h2>Cómo se calcula</h2><ul>${o.como.map(x => `<li>${h(x)}</li>`).join('')}</ul><p class="tenue pie">Se recalcula con tu último peso y medidas. Si en 4 semanas el peso no va como toca, se corrige solo.</p>`); },
  'nutri.preparar': () => hojaPreparar(),
  'nutri.gQuien': el => { const g = ui.gen; g.quien = alternar(g.quien, el.dataset.v); if (!g.quien.length) g.quien = [yoKey()]; hojaPreparar(); },
  'nutri.gDia': el => { const g = ui.gen, u = el.dataset.u; g.entreno[u] = alternar(g.entreno[u], +el.dataset.v).sort(); hojaPreparar(); },
  'nutri.generar': generar,
  'nutri.video': async el => {
    const id = el.dataset.v, r = menuSemana().menu.recetas.find(x => x.id === id);
    const caja = $('#nutri-video'); if (caja) caja.innerHTML = '<p class="tenue">Buscando…</p>';
    let res;
    try { res = await llamar('nutricion-video', { q: r.videoBusqueda || r.nombre }, { espera: 20000 }); }
    catch (e) { res = { videos: [], buscar: 'https://www.youtube.com/results?search_query=' + encodeURIComponent((r.videoBusqueda || r.nombre) + ' receta') }; }
    cambiar(() => { r.videos = res; }, 'nutri-silencio');
    hojaReceta(id);
  },
  'nutri.valorar': el => { const r = menuSemana().menu.recetas.find(x => x.id === el.dataset.id); cambiar(S => { C.asegurar(S).compartido.valoraciones[C.clave(r.nombre)] = +el.dataset.v; }, 'nutri-silencio'); hojaReceta(r.id); },
  'nutri.cambiar': async el => {
    const m = menuSemana(), id = el.dataset.v, r = m.menu.recetas.find(x => x.id === id);
    const donde = []; m.menu.dias.forEach(d => d.comidas.forEach(c => { if (c.recetaId === id) donde.push({ dia: d.dia, momento: c.momento, victor: c.victor, virginia: c.virginia, enTrabajo: c.enTrabajo }); }));
    const motivo = ($('#nutri-motivo') || {}).value || '';
    el.disabled = true; el.textContent = 'Pidiendo otro plato…';
    try {
      const j = await llamar('nutricion', { modo: 'plato', receta: r, donde, motivo, otros: m.menu.recetas.map(x => x.nombre), peticion: m.peticion }, { espera: 120000 });
      cerrarHoja();
      cambiar(() => C.sustituirReceta(m, id, j.receta), 'nutricion');
      aviso('Plato cambiado: ' + j.receta.nombre);
    } catch (e) { el.disabled = false; el.textContent = 'Pedir otro plato'; aviso('No se pudo: ' + e.message); }
  },
  'nutri.marcar': el => { const m = menuSemana(); cambiar(() => { m.compra.marcados[el.dataset.v] = el.checked; }, 'nutricion'); },
  'nutri.extra': () => { const x = ($('#nutri-extra') || {}).value; if (!x || !x.trim()) return; const m = menuSemana(); cambiar(() => { m.compra.extra = (m.compra.extra || []).concat(x.trim()); }, 'nutricion'); },
  'nutri.compartirLista': async () => {
    const m = menuSemana(), l = C.listaCompra(m.menu, N().compartido.hogar.despensa);
    const txt = l.secciones.map(s => s.seccion.toUpperCase() + '\n' + s.items.filter(i => !m.compra.marcados[i.id]).map(i => `- ${i.nombre}: ${i.texto}`).join('\n')).join('\n\n')
      + ((m.compra.extra || []).length ? '\n\nOTROS\n' + m.compra.extra.map(x => '- ' + x).join('\n') : '');
    try { if (navigator.share) await navigator.share({ title: 'Lista de la compra', text: txt }); else { await navigator.clipboard.writeText(txt); aviso('Lista copiada'); } } catch (e) { /* cancelado */ }
  },
  'nutri.turnoSemana': el => cambiar(S => { const t = C.asegurar(S).yo.turnos; t.excepciones = Object.assign({}, t.excepciones, { [lunes()]: el.dataset.v }); }, 'nutricion'),
  'nutri.turnoRef': el => cambiar(S => { const t = C.asegurar(S).yo.turnos; t.refLunes = C.lunesDe(); t.refTurno = el.dataset.v; t.excepciones = {}; }, 'nutricion'),
  'nutri.comidaTrabajo': el => cambiar(S => { const t = C.asegurar(S).yo.turnos; t.comidasTrabajo = alternar(t.comidasTrabajo, el.dataset.v); }, 'nutricion'),
  'nutri.diaTrabajo': el => cambiar(S => { const t = C.asegurar(S).yo.turnos; t.diasTrabajo = alternar(t.diasTrabajo, +el.dataset.v).sort(); }, 'nutricion'),
  'nutri.comida': el => cambiar(S => { const y = C.asegurar(S).yo; y.comidas = C.MOMENTOS.filter(x => (x === el.dataset.v) !== y.comidas.includes(x)); }, 'nutricion'),
  // Campos (data-cambio)
  'nutri.actividad': el => cambiar(S => { C.asegurar(S).yo.actividad = el.value; }, 'nutricion'),
  'nutri.yoNum': el => cambiar(S => { C.asegurar(S).yo[el.dataset.k] = +el.value || 0; }, 'nutri-silencio'),
  'nutri.yoLista': el => cambiar(S => { C.asegurar(S).yo[el.dataset.k] = lista(el.value); }, 'nutri-silencio'),
  'nutri.hogarLista': el => cambiar(S => { const H = C.asegurar(S).compartido.hogar; H[el.dataset.k] = lista(el.value); H.actualizado = new Date().toISOString(); }, 'nutri-silencio'),
  'nutri.hogarNum': el => cambiar(S => { const H = C.asegurar(S).compartido.hogar; H[el.dataset.k] = Math.max(0, +el.value || 0); H.actualizado = new Date().toISOString(); }, 'nutri-silencio'),
  'nutri.batch': el => cambiar(S => { const H = C.asegurar(S).compartido.hogar; H.batchDomingo = el.checked; H.actualizado = new Date().toISOString(); }, 'nutri-silencio'),
  'nutri.turnos': el => cambiar(S => { const t = C.asegurar(S).yo.turnos; t.activo = el.checked; if (t.activo && !t.refLunes) { t.refLunes = C.lunesDe(); t.refTurno = 'tarde'; } }, 'nutricion'),
  // Pasar al otro móvil (provisional)
  'nutri.exportar': async () => {
    const S = estado();
    const f = refrescarFicha(S, C.lunesDe());
    if (f.faltan) { aviso('Antes completa: ' + f.faltan.join(', ')); return; }
    cambiar(() => {}, 'nutri-silencio');
    const txt = 'PIPOS-NUTRI:' + JSON.stringify(N().compartido);
    try { await navigator.clipboard.writeText(txt); aviso(`Copiado. Pégalo en el móvil de ${nombre(otroKey())}: Comida → Ajustes → Pegar.`); }
    catch (e) { abrirHoja(`<h2>Copia este texto</h2><textarea rows="8" readonly>${h(txt)}</textarea>`); }
  },
  'nutri.importar': () => abrirHoja(`<h2>Pegar datos de ${h(nombre(otroKey()))}</h2><p class="tenue">Pega aquí el texto que ha copiado en su móvil (Comida → Ajustes → Copiar mis datos).</p><textarea id="nutri-pegar" rows="6"></textarea><button class="btn" data-act="nutri.importarOk" style="width:100%">Añadir</button>`),
  'nutri.importarOk': () => {
    const txt = (($('#nutri-pegar') || {}).value || '').trim().replace(/^PIPOS-NUTRI:/, '');
    try {
      const otro = JSON.parse(txt);
      cambiar(S => { C.mezclarCompartido(C.asegurar(S).compartido, otro); }, 'nutricion');
      cerrarHoja(); aviso('Datos añadidos');
    } catch (e) { aviso('Ese texto no es de Pipos Fitness'); }
  },
});

rutas({ nutricion: { titulo: 'Comida', vista } });
pestaña({ ruta: 'nutricion', nombre: 'Comida', icono: ICONOS.nutricion, orden: 25 });
