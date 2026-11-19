// Pantallas mínimas de Nutrición para probar el agente mientras se rehace la base de la app.
// Toda la lógica está en core.js; aquí solo se pinta y se guarda. Se integrará en la navegación de la app nueva.
(function () {
  'use strict';
  const N = window.NutriCore;
  const $ = s => document.querySelector(s);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'pipos-nutricion';
  const NOMBRES = { him: 'Víctor', her: 'Virginia' };
  const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const OBJ = N.OBJETIVOS;

  const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  let S = N.completar(leer(KEY));
  S.manual = S.manual || { him: {}, her: {} };
  const app = leer('elplan2') || {}; // datos de la app de entreno, si está en el mismo dominio
  const ui = { u: (leer(KEY + ':u') || app.user || 'him'), tab: 'menu', semana: 0, dia: ((new Date().getDay() + 6) % 7) + 1, cargando: false, gen: null };
  function guardar() { S.actualizado = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem(KEY + ':u', JSON.stringify(ui.u)); } catch (e) {} }

  const lunes = () => N.sumarDias(N.lunesDe(), ui.semana * 7);
  const codigo = () => S.codigo || ((app.settings || {}).code) || '';
  function datos(u) {
    const d = N.datosPersona(app, u), m = S.manual[u] || {};
    return Object.assign({}, d, {
      sexo: m.sexo || d.sexo, altura: d.altura || +m.altura || null,
      pesos: d.pesos.length ? d.pesos : (m.peso ? [{ fecha: new Date().toISOString(), kg: +m.peso }] : []),
      objetivos: (m.objetivos && m.objetivos.length) ? m.objetivos : d.objetivos,
      dias: +m.dias || d.dias, minutos: +m.minutos || d.minutos,
    });
  }
  const estado = () => ({ datosNutri: { him: datos('him'), her: datos('her') } });
  const objetivos = u => N.objetivosPersona(S.personas[u], datos(u));

  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
  function hoja(html) { const bg = $('#sheet'); bg.innerHTML = `<div class="sheet"><button class="icon-btn sheet-close" data-a="cerrar" aria-label="Cerrar">✕</button>${html}</div>`; bg.classList.add('open'); }
  function cerrar() { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; }

  // ───────── Pintar ─────────
  function render() {
    document.body.classList.toggle('her', ui.u === 'her');
    $('#top').innerHTML = `<h1>Nutrición</h1><div class="who">${['him', 'her'].map(k => `<button data-a="u" data-v="${k}" aria-pressed="${k === ui.u}">${NOMBRES[k]}</button>`).join('')}</div>`;
    const tabs = [['menu', 'Menú'], ['compra', 'Compra'], ['tupper', 'Tupper'], ['ajustes', 'Ajustes']];
    $('#main').innerHTML = `<div class="tabs"><div class="seg">${tabs.map(([k, t]) => `<button data-a="tab" data-v="${k}" aria-pressed="${ui.tab === k}">${t}</button>`).join('')}</div></div>`
      + ({ menu: vMenu, compra: vCompra, tupper: vTupper, ajustes: vAjustes })[ui.tab]();
  }

  const fmtSemana = l => { const a = new Date(l + 'T12:00:00'), b = new Date(N.sumarDias(l, 6) + 'T12:00:00'); const o = { day: 'numeric', month: 'short' }; return `${a.toLocaleDateString('es-ES', o)} – ${b.toLocaleDateString('es-ES', o)}`; };
  const selSemana = () => `<div class="seg" style="margin-bottom:16px">${[0, 1].map(n => `<button data-a="semana" data-v="${n}" aria-pressed="${ui.semana === n}">${n ? 'Próxima' : 'Esta semana'}</button>`).join('')}</div>`;

  function tarjetaObjetivo(u) {
    const o = objetivos(u);
    if (o.faltan.length) return `<div class="note gold"><strong>Faltan datos de ${NOMBRES[u]}</strong>Para calcular sus cantidades necesito: ${o.faltan.join(', ')}. <a href="#" data-a="tab" data-v="ajustes">Añadirlos</a></div>`;
    const t = (x, n) => `<div class="card" style="padding:12px"><div class="card-title" style="font-size:14px">${n}</div><div class="faint" style="font-size:12px;line-height:1.35">${h(o.objetivo)}</div><div class="tgt"><div><b>${x.kcal}</b><span>kcal</span></div><div><b>${x.proteina}</b><span>prot g</span></div><div><b>${x.hidratos}</b><span>hidr g</span></div><div><b>${x.grasa}</b><span>grasa g</span></div></div></div>`;
    return `<div class="stack">${t(o.entreno, 'Día de entreno')}${t(o.descanso, 'Día de descanso')}</div><p class="faint" style="margin-top:6px">Agua: ${(o.agua.descanso / 1000).toString().replace('.', ',')} l en descanso, ${(o.agua.entreno / 1000).toString().replace('.', ',')} l si entrenas. <a href="#" data-a="como">Cómo se calcula</a></p>`;
  }

  function vMenu() {
    const l = lunes(), m = S.menus[l];
    let out = selSemana() + `<p class="faint" style="margin:-8px 0 12px">${fmtSemana(l)}</p>`;
    out += `<div class="sec" style="margin-top:8px">Objetivo diario de ${NOMBRES[ui.u]}</div>` + tarjetaObjetivo(ui.u);
    if (ui.cargando) return out + `<div class="note" style="margin-top:20px"><strong>Preparando el menú…</strong>El nutricionista está planificando 7 días para los dos. Tarda uno o dos minutos; no cierres esta pantalla.</div>`;
    if (!m) return out + `<div style="height:20px"></div><button class="btn" data-a="preparar">Preparar el menú de la semana</button><p class="hint">Se crea una vez por semana con vuestros datos, el entreno de esa semana, el turno y lo que tengáis en casa.</p>`;
    const menu = m.menu, rec = {}; menu.recetas.forEach(r => { rec[r.id] = r; });
    out += `<div class="note" style="margin-top:20px">${h(menu.resumen)}</div>`;
    out += `<div class="week" style="margin-top:16px">${DIAS.map((d, i) => `<button data-a="dia" data-v="${i + 1}" class="${ui.dia === i + 1 ? 'today' : ''}" style="padding:8px 0;border-radius:12px">${d}</button>`).join('')}</div>`;
    const dia = menu.dias.find(d => d.dia === ui.dia);
    out += `<div class="sec">${DIAS_LARGO[ui.dia - 1]}</div>`;
    if (dia) {
      const tot = N.totalesDia(menu, ui.dia, ui.u);
      const ent = (m.semana && m.semana.entreno && (m.semana.entreno[ui.u] || []).includes(ui.dia));
      const o = objetivos(ui.u); const obj = !o.faltan.length && (ent ? o.entreno : o.descanso);
      if (tot && obj) out += `<p class="faint" style="margin-bottom:10px">${ent ? 'Día de entreno' : 'Descanso'} · ${NOMBRES[ui.u]}: ${tot.kcal} de ${obj.kcal} kcal, ${tot.proteina} de ${obj.proteina} g de proteína (según el agente)</p>`;
      dia.comidas.forEach(c => {
        const r = rec[c.recetaId]; if (!r) return;
        const quien = ['him', 'her'].filter(u => c[u]);
        out += `<button class="card meal" data-a="receta" data-v="${h(r.id)}"><div class="m">${h(c.momento)}${c.enTrabajo && c.enTrabajo.length ? ` · tupper de ${c.enTrabajo.map(u => NOMBRES[u]).join(' y ')}` : ''}</div><div class="card-title">${h(r.nombre)}</div><span class="card-sub">${quien.map(u => `<span class="${u}">● ${NOMBRES[u]}</span>`).join('  ')} · ${r.minutos} min${c.nota ? ' · ' + h(c.nota) : ''}</span></button>`;
      });
    }
    if (menu.preparacion && menu.preparacion.length) out += `<div class="sec">Preparación anticipada</div>` + menu.preparacion.map(p => `<div class="card" style="margin-bottom:8px"><div class="card-title">${h(p.cuando)}</div><ul style="padding-left:18px;margin-top:6px">${p.tareas.map(t => `<li>${h(t)}</li>`).join('')}</ul></div>`).join('');
    out += `<div class="sec">Por qué es así</div><div class="note"><strong>${NOMBRES[ui.u]}</strong>${h((menu.criterios || {})[ui.u] || '')}</div>`;
    if (menu.consejos && menu.consejos.length) out += `<ul style="padding-left:18px;margin-top:12px" class="muted">${menu.consejos.map(c => `<li>${h(c)}</li>`).join('')}</ul>`;
    out += `<div style="height:20px"></div><button class="btn sec2" data-a="preparar">Rehacer el menú de esta semana</button>`;
    return out;
  }

  const racion = (v, u) => (Math.round(v * 10) / 10).toString().replace('.', ',') + (u === 'ud' ? ' ud' : ' ' + u);
  function vReceta(id) {
    const m = S.menus[lunes()], r = m.menu.recetas.find(x => x.id === id); if (!r) return;
    const val = S.valoraciones[N.clave(r.nombre)];
    const come = u => m.menu.dias.some(d => d.comidas.some(c => c.recetaId === id && c[u]));
    const cols = ['him', 'her'].filter(come);
    const nut = cols.map(u => `<span class="${u}">${NOMBRES[u]}: ${Math.round(r.nutricion[u].kcal)} kcal · ${Math.round(r.nutricion[u].proteina)} g prot</span>`).join('<br>');
    const videos = r.videos ? (r.videos.videos.length ? r.videos.videos.map(v => `<a class="card tap" style="margin-top:8px" href="${h(v.url)}" target="_blank" rel="noopener"><span class="grow"><span class="card-title" style="font-size:15px">${h(v.titulo)}</span><span class="card-sub">${h(v.canal)} · ${h(v.duracion)}</span></span><span class="chev">›</span></a>`).join('') : '<p class="faint">No he encontrado un vídeo comprobado.</p>') + `<a class="btn-text block" href="${h(r.videos.buscar)}" target="_blank" rel="noopener">Ver más en YouTube</a>`
      : `<button class="btn ghost" data-a="video" data-v="${h(r.id)}">Buscar vídeo de la receta</button>`;
    hoja(`<h2>${h(r.nombre)}</h2><p class="faint" style="margin:4px 0 12px">${h(r.cocina)} · ${r.minutos} min · ${h(r.dificultad)}</p>
      <p class="muted">${h(r.nota)}</p><p style="margin-top:8px;font-size:14px">${nut}</p>
      ${r.tupper ? `<div class="note gold" style="margin-top:12px"><strong>Tupper</strong>${h(r.calentar)}<br>${h(r.conservacion)}</div>` : (r.conservacion ? `<p class="faint" style="margin-top:8px">${h(r.conservacion)}</p>` : '')}
      <div class="sec">Ingredientes (por ración)</div>
      <div class="qty"><span class="h">Ingrediente</span>${cols.map(u => `<span class="h ${u}">${NOMBRES[u]}</span>`).join('')}${cols.length < 2 ? '<span></span>' : ''}
      ${r.ingredientes.map(i => `<span>${h(i.nombre)}</span>${cols.map(u => `<span class="nw">${i[u] ? racion(i[u], i.unidad) : '—'}</span>`).join('')}${cols.length < 2 ? '<span></span>' : ''}`).join('')}</div>
      <div class="sec">Pasos</div><ol class="pasos">${r.pasos.map(p => `<li>${h(p)}</li>`).join('')}</ol>
      <div class="sec">Vídeo</div><div id="vid">${videos}</div>
      <div class="sec">¿Os gusta?</div><div class="seg">${[[1, 'No'], [2, 'Normal'], [3, 'Nos gusta']].map(([v, t]) => `<button data-a="valorar" data-v="${v}" data-id="${h(r.id)}" aria-pressed="${val === v}">${t}</button>`).join('')}</div>
      <div class="sec">Cambiar este plato</div><input class="input" id="motivo" placeholder="Motivo (opcional): no tenemos horno, sin pescado…"><div style="height:8px"></div><button class="btn sec2" data-a="cambiar" data-v="${h(r.id)}">Pedir otro plato</button>`);
  }

  function vCompra() {
    const l = lunes(), m = S.menus[l];
    let out = selSemana();
    if (!m) return out + '<p class="muted">Aún no hay menú para esta semana.</p>';
    const lista = N.listaCompra(m.menu, S.hogar.despensa);
    const marc = m.compra.marcados;
    const fila = i => `<label class="buy ${marc[i.id] ? 'ok' : ''}"><input type="checkbox" data-in="marcar" data-v="${h(i.id)}" ${marc[i.id] ? 'checked' : ''}><span class="grow">${h(i.nombre)}</span><span class="faint nw">${i.texto}</span></label>`;
    out += `<p class="faint">Cantidades para los dos y toda la semana, sumadas de las recetas.</p>`;
    lista.secciones.forEach(s => { out += `<div class="sec">${h(s.seccion)}</div>` + s.items.map(fila).join(''); });
    (m.compra.extra || []).forEach((x, n) => { out += (n ? '' : '<div class="sec">Añadido a mano</div>') + fila({ id: 'extra:' + x, nombre: x, texto: '' }); });
    out += `<div class="row" style="margin-top:12px"><input class="input grow" id="extra" placeholder="Añadir algo a la lista"><button class="btn sm" data-a="extra">Añadir</button></div>`;
    if (lista.enCasa.length) out += `<div class="sec">Ya lo tenéis en casa (revisad la cantidad)</div>` + lista.enCasa.map(fila).join('');
    out += `<div style="height:16px"></div><button class="btn sec2" data-a="compartir">Copiar o compartir la lista</button>`;
    return out;
  }

  function vTupper() {
    const l = lunes(); let out = selSemana();
    const con = ['him', 'her'].filter(u => S.personas[u].turnos.activo);
    if (!con.length) return out + `<div class="note">Activa los turnos de trabajo en <a href="#" data-a="tab" data-v="ajustes">Ajustes</a> y el menú incluirá los tuppers de las semanas que comes en el trabajo.</div>`;
    con.forEach(u => {
      const t = N.turnoSemana(S.personas[u], l);
      out += `<div class="card" style="margin-bottom:8px"><div class="card-title">${NOMBRES[u]}: turno de ${t}</div><span class="card-sub">${t === 'tarde' ? 'Se lleva: ' + S.personas[u].turnos.comidasTrabajo.join(', ') + ' (solo microondas)' : 'Come en casa esta semana'}</span><div class="seg" style="margin-top:10px">${['mañana', 'tarde'].map(x => `<button data-a="turnoSemana" data-u="${u}" data-v="${x}" aria-pressed="${t === x}">Esta semana: ${x}</button>`).join('')}</div></div>`;
    });
    const m = S.menus[l];
    if (!m) return out + '<p class="muted" style="margin-top:12px">Cuando prepares el menú de esta semana, aquí saldrán los tuppers.</p>';
    const rec = {}; m.menu.recetas.forEach(r => { rec[r.id] = r; });
    const items = [];
    m.menu.dias.forEach(d => d.comidas.forEach(c => { if (c.enTrabajo && c.enTrabajo.length && rec[c.recetaId]) items.push({ d, c, r: rec[c.recetaId] }); }));
    out += '<div class="sec">Tuppers de la semana</div>';
    if (!items.length) out += '<p class="muted">Esta semana no hay comidas en el trabajo.</p>';
    items.forEach(({ d, c, r }) => { out += `<button class="card meal" data-a="receta" data-v="${h(r.id)}"><div class="m">${DIAS_LARGO[d.dia - 1]} · ${h(c.momento)}</div><div class="card-title">${h(r.nombre)}</div><span class="card-sub">${h(r.calentar)} · ${h(r.conservacion)}</span></button>`; });
    return out;
  }

  const chips = (lista, sel, act, extra) => `<div class="chips">${lista.map(([v, t]) => `<button class="chip" data-a="${act}" data-v="${h(v)}" ${extra || ''} aria-pressed="${sel.includes(v)}">${h(t)}</button>`).join('')}</div>`;
  const campo = (id, lab, val, attrs) => `<label class="f" for="${id}">${lab}</label><input class="input" id="${id}" data-in="${id}" value="${h(val == null ? '' : val)}" ${attrs || ''}>`;
  function vAjustes() {
    const u = ui.u, p = S.personas[u], m = S.manual[u] || {}, d = N.datosPersona(app, u), t = p.turnos;
    let out = `<div class="sec" style="margin-top:8px">${NOMBRES[u]}</div>`;
    out += campo('nacimiento', 'Año de nacimiento', p.nacimiento, 'inputmode="numeric" placeholder="1988"');
    if (!d.altura) out += campo('altura', 'Altura (cm)', m.altura, 'inputmode="numeric"');
    if (!d.pesos.length) out += campo('peso', 'Peso (kg)', m.peso, 'inputmode="decimal"') + '<p class="hint">Cuando lo apuntes en Progreso, se usará ese.</p>';
    out += `<label class="f">Sexo</label><div class="seg">${[['m', 'Hombre'], ['f', 'Mujer']].map(([v, x]) => `<button data-a="manual" data-k="sexo" data-v="${v}" aria-pressed="${(m.sexo || d.sexo) === v}">${x}</button>`).join('')}</div>`;
    const objs = (m.objetivos && m.objetivos.length) ? m.objetivos : d.objetivos.map(N.normalizarObjetivo);
    out += `<label class="f">Objetivos (puedes marcar varios)</label>` + chips(Object.entries(OBJ), objs, 'objetivo');
    out += campo('dias', 'Días de entreno a la semana', m.dias || d.dias, 'inputmode="numeric"') + campo('minutos', 'Minutos por sesión', m.minutos || d.minutos || 60, 'inputmode="numeric"');
    out += `<label class="f">Actividad fuera del entreno</label><div class="seg">${['sentado', 'ligera', 'de pie', 'activo'].map(v => `<button data-a="actividad" data-v="${v}" aria-pressed="${p.actividad === v}">${v}</button>`).join('')}</div>`;
    out += `<label class="f">Comidas que haces al día</label>` + chips(N.MOMENTOS.map(x => [x, x]), p.comidas, 'comida');
    out += campo('ajusteKcal', 'Ajuste manual de kcal al día (+/-)', p.ajusteKcal || '', 'inputmode="numeric" placeholder="0"');
    out += campo('p-alergias', 'Alergias o intolerancias propias', p.alergias.join(', ')) + campo('p-noGusta', 'No me gusta', p.noGusta.join(', '));
    out += `<div class="sec">Turnos de trabajo</div><label class="buy"><input type="checkbox" data-in="turnos" ${t.activo ? 'checked' : ''}><span class="grow">Trabajo a turnos de mañana y tarde que cambian cada semana</span></label>`;
    if (t.activo) {
      out += `<label class="f">Esta semana tengo turno de</label><div class="seg">${['mañana', 'tarde'].map(v => `<button data-a="turnoRef" data-v="${v}" aria-pressed="${N.turnoSemana(p, N.lunesDe()) === v}">${v}</button>`).join('')}</div>`;
      out += `<label class="f">En las semanas de tarde como en el trabajo (solo microondas)</label>` + chips(N.MOMENTOS.map(x => [x, x]), t.comidasTrabajo, 'comidaTrabajo');
      out += `<label class="f">Días que trabajo</label>` + chips(DIAS.map((x, i) => [String(i + 1), x]), t.diasTrabajo.map(String), 'diaTrabajo');
    }
    const H = S.hogar;
    out += `<div class="sec">En casa (común a los dos)</div>`;
    out += campo('h-alergias', 'Alergias e intolerancias de la casa', H.alergias.join(', ')) + campo('h-noGusta', 'No nos gusta', H.noGusta.join(', ')) + campo('h-gustan', 'Nos gusta', H.gustan.join(', '));
    out += `<label class="f" for="despensa">Lo que hay en casa (uno por línea)</label><textarea class="input" rows="5" id="despensa" data-in="despensa" placeholder="arroz integral\ngarbanzos cocidos\npechuga de pollo 500 g">${h(H.despensa.map(x => typeof x === 'string' ? x : x.nombre).join('\n'))}</textarea>`;
    out += campo('minutosEntreSemana', 'Minutos máximos para cocinar entre semana', H.minutosEntreSemana, 'inputmode="numeric"');
    out += campo('platosDelMundo', 'Platos de otras cocinas por semana', H.platosDelMundo, 'inputmode="numeric"');
    out += `<label class="buy"><input type="checkbox" data-in="batch" ${H.batchDomingo ? 'checked' : ''}><span class="grow">Dejar cosas preparadas el domingo</span></label>`;
    out += campo('codigo', 'Código de acceso de la app', codigo(), 'autocomplete="off"');
    return out;
  }

  // ───────── Acciones ─────────
  const lista = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const alternar = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v);
  async function llamar(url, body) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'x-app-code': codigo() }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'error ' + r.status);
    return j;
  }

  function prepararHoja() {
    const l = lunes();
    ui.gen = ui.gen && ui.gen.lunes === l ? ui.gen : { lunes: l, entreno: { him: N.diasPorDefecto(datos('him').dias), her: N.diasPorDefecto(datos('her').dias) }, quien: ['him', 'her'] };
    const g = ui.gen;
    hoja(`<h2>Menú de la semana</h2><p class="faint" style="margin:4px 0 10px">${fmtSemana(l)}</p>
      <label class="f">¿Para quién?</label>${chips([['him', NOMBRES.him], ['her', NOMBRES.her]], g.quien, 'gQuien')}
      ${['him', 'her'].filter(u => g.quien.includes(u)).map(u => `<label class="f">Días que entrena ${NOMBRES[u]} esta semana</label>${chips(DIAS.map((x, i) => [String(i + 1), x]), g.entreno[u].map(String), 'gDia', `data-u="${u}"`)}`).join('')}
      <p class="hint" style="margin-top:12px">Lo que hay en casa y los turnos se cambian en Ajustes. Cuesta unos céntimos de la API de Claude.</p>
      <div style="height:14px"></div><button class="btn" data-a="generar">Preparar menú</button>`);
  }

  async function generar() {
    const g = ui.gen;
    const { peticion, faltan } = N.peticionMenu(S, estado(), { lunes: g.lunes, entreno: g.entreno, quien: g.quien }, NOMBRES);
    const quienFalta = Object.keys(faltan);
    if (quienFalta.length) { cerrar(); toast(`Faltan datos de ${quienFalta.map(u => NOMBRES[u]).join(' y ')}: ${faltan[quienFalta[0]].join(', ')}`); ui.tab = 'ajustes'; ui.u = quienFalta[0]; return render(); }
    cerrar(); ui.cargando = true; render();
    try {
      const j = await llamar('/api/nutricion', { modo: 'menu', peticion });
      const obj = {}; g.quien.forEach(u => { obj[u] = { entreno: peticion.personas[u].objetivoDiaEntreno, descanso: peticion.personas[u].objetivoDiaDescanso }; });
      N.guardarMenu(S, g.lunes, j.menu, obj);
      S.menus[g.lunes].semana = { entreno: g.entreno, quien: g.quien };
      S.menus[g.lunes].peticion = peticion;
      S.menus[g.lunes].uso = j.uso;
      guardar(); toast('Menú listo');
    } catch (e) { toast('No se pudo crear: ' + e.message); }
    ui.cargando = false; render();
  }

  const A = {
    cerrar,
    u: v => { ui.u = v; guardar(); render(); },
    tab: v => { ui.tab = v; render(); window.scrollTo(0, 0); },
    semana: v => { ui.semana = +v; render(); },
    dia: v => { ui.dia = +v; render(); },
    receta: v => vReceta(v),
    como: () => { const o = objetivos(ui.u); hoja(`<h2>Cómo se calcula</h2><ul style="padding-left:18px;margin-top:12px">${o.como.map(x => `<li style="margin-bottom:6px">${h(x)}</li>`).join('')}</ul><p class="faint" style="margin-top:12px">Se recalcula cada vez con tu último peso y medidas. Si el peso no evoluciona como toca en 4 semanas, se corrige solo.</p>`); },
    preparar: prepararHoja,
    gQuien: v => { ui.gen.quien = alternar(ui.gen.quien, v); if (!ui.gen.quien.length) ui.gen.quien = [v]; prepararHoja(); },
    gDia: (v, el) => { const u = el.dataset.u; ui.gen.entreno[u] = alternar(ui.gen.entreno[u], +v).sort(); prepararHoja(); },
    generar,
    video: async v => {
      const m = S.menus[lunes()], r = m.menu.recetas.find(x => x.id === v);
      $('#vid').innerHTML = '<p class="faint">Buscando…</p>';
      try { r.videos = await llamar('/api/video?q=' + encodeURIComponent(r.videoBusqueda || r.nombre)); guardar(); }
      catch (e) { r.videos = { videos: [], buscar: 'https://www.youtube.com/results?search_query=' + encodeURIComponent((r.videoBusqueda || r.nombre) + ' receta') }; }
      vReceta(v);
    },
    valorar: (v, el) => { const r = S.menus[lunes()].menu.recetas.find(x => x.id === el.dataset.id); N.valorar(S, r.nombre, +v); guardar(); vReceta(r.id); },
    cambiar: async v => {
      const l = lunes(), m = S.menus[l], r = m.menu.recetas.find(x => x.id === v);
      const donde = []; m.menu.dias.forEach(d => d.comidas.forEach(c => { if (c.recetaId === v) donde.push({ dia: d.dia, momento: c.momento, him: c.him, her: c.her, enTrabajo: c.enTrabajo }); }));
      const motivo = ($('#motivo') || {}).value || '';
      const btn = document.querySelector('[data-a="cambiar"]'); btn.disabled = true; btn.textContent = 'Pidiendo otro plato…';
      try {
        const j = await llamar('/api/nutricion', { modo: 'plato', receta: r, donde, motivo, otros: m.menu.recetas.map(x => x.nombre), peticion: m.peticion });
        N.sustituirReceta(S, l, v, j.receta); guardar(); cerrar(); render(); toast('Plato cambiado: ' + j.receta.nombre);
      } catch (e) { btn.disabled = false; btn.textContent = 'Pedir otro plato'; toast('No se pudo: ' + e.message); }
    },
    extra: () => { const x = $('#extra').value.trim(); if (!x) return; const m = S.menus[lunes()]; m.compra.extra = (m.compra.extra || []).concat(x); guardar(); render(); },
    compartir: async () => {
      const m = S.menus[lunes()], l = N.listaCompra(m.menu, S.hogar.despensa);
      const txt = l.secciones.map(s => `${s.seccion.toUpperCase()}\n` + s.items.filter(i => !m.compra.marcados[i.id]).map(i => `- ${i.nombre}: ${i.texto}`).join('\n')).join('\n\n') + ((m.compra.extra || []).length ? '\n\nOTROS\n' + m.compra.extra.map(x => '- ' + x).join('\n') : '');
      try { if (navigator.share) await navigator.share({ title: 'Lista de la compra', text: txt }); else { await navigator.clipboard.writeText(txt); toast('Lista copiada'); } } catch (e) {}
    },
    manual: (v, el) => { S.manual[ui.u] = Object.assign({}, S.manual[ui.u], { [el.dataset.k]: v }); guardar(); render(); },
    objetivo: v => { const d = N.datosPersona(app, ui.u); const m = S.manual[ui.u] = S.manual[ui.u] || {}; const act = (m.objetivos && m.objetivos.length) ? m.objetivos : d.objetivos.map(N.normalizarObjetivo).filter(Boolean); m.objetivos = alternar(act, v); guardar(); render(); },
    actividad: v => { S.personas[ui.u].actividad = v; guardar(); render(); },
    comida: v => { const p = S.personas[ui.u]; p.comidas = N.MOMENTOS.filter(x => (x === v) !== p.comidas.includes(x)); guardar(); render(); },
    turnoRef: v => { const t = S.personas[ui.u].turnos; t.refLunes = N.lunesDe(); t.refTurno = v; t.excepciones = {}; guardar(); render(); },
    turnoSemana: (v, el) => { const t = S.personas[el.dataset.u].turnos; t.excepciones = Object.assign({}, t.excepciones, { [lunes()]: v }); guardar(); render(); },
    comidaTrabajo: v => { const t = S.personas[ui.u].turnos; t.comidasTrabajo = alternar(t.comidasTrabajo, v); guardar(); render(); },
    diaTrabajo: v => { const t = S.personas[ui.u].turnos; t.diasTrabajo = alternar(t.diasTrabajo, +v).sort(); guardar(); render(); },
  };
  const IN = {
    nacimiento: el => { S.personas[ui.u].nacimiento = +el.value || null; },
    altura: el => { S.manual[ui.u].altura = +el.value || null; }, peso: el => { S.manual[ui.u].peso = +String(el.value).replace(',', '.') || null; },
    dias: el => { S.manual[ui.u].dias = +el.value || null; }, minutos: el => { S.manual[ui.u].minutos = +el.value || null; },
    ajusteKcal: el => { S.personas[ui.u].ajusteKcal = +el.value || 0; },
    'p-alergias': el => { S.personas[ui.u].alergias = lista(el.value); }, 'p-noGusta': el => { S.personas[ui.u].noGusta = lista(el.value); },
    'h-alergias': el => { S.hogar.alergias = lista(el.value); }, 'h-noGusta': el => { S.hogar.noGusta = lista(el.value); }, 'h-gustan': el => { S.hogar.gustan = lista(el.value); },
    despensa: el => { S.hogar.despensa = el.value.split('\n').map(x => x.trim()).filter(Boolean); },
    minutosEntreSemana: el => { S.hogar.minutosEntreSemana = +el.value || 30; }, platosDelMundo: el => { S.hogar.platosDelMundo = Math.max(0, +el.value || 0); },
    batch: el => { S.hogar.batchDomingo = el.checked; },
    turnos: el => { const t = S.personas[ui.u].turnos; t.activo = el.checked; if (t.activo && !t.refLunes) { t.refLunes = N.lunesDe(); t.refTurno = 'tarde'; } render(); },
    marcar: (el) => { const m = S.menus[lunes()]; m.compra.marcados[el.dataset.v] = el.checked; el.closest('.buy').classList.toggle('ok', el.checked); },
    codigo: el => { S.codigo = el.value.trim(); },
  };

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]'); if (!el) { if (ev.target.id === 'sheet') cerrar(); return; }
    ev.preventDefault(); A[el.dataset.a] && A[el.dataset.a](el.dataset.v, el);
  });
  document.addEventListener('change', ev => { const el = ev.target.closest('[data-in]'); if (el && IN[el.dataset.in]) { IN[el.dataset.in](el); guardar(); } });
  render();
})();
