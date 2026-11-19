// Interfaz de «El Plan». Una sola escucha de clics con data-act, rutas con # y textos siempre escapados.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = () => Store.S;
  const U = () => st().user;
  const ZONAS = window.INJURY_ZONES;
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const fecha = (d, o) => new Date(d).toLocaleDateString('es-ES', o || { day: 'numeric', month: 'short' });
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
  const fmt = (v, d = 1) => v == null ? '—' : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('es-ES');

  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    hoy: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    lib: svg('<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zm0 0A2 2 0 0 0 6 22h14"/><path d="M9 7h7M9 11h5"/>'),
    prog: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
    perfil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    check: svg('<path d="m5 12 5 5L20 7"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    play: svg('<path d="M7 4v16l13-8z" fill="currentColor"/>'),
    swap: svg('<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
    back: svg('<path d="m15 18-6-6 6-6"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    dumbbell: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>'),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  };

  // ── UI efímera ──
  const ui = {
    lib: { lugar: '', musculo: '', material: '', nivel: 0, seguro: false, q: '' },
    prog: 'cuerpo', metric: 'peso', fuerzaId: null,
    checkin: null, gen: null, genResult: null, genLoading: false, openEx: 0,
  };

  // ── Utilidades de interfaz ──
  function toast(msg, ms) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2600);
  }
  let alCerrarHoja = null;
  function hoja(html, onClose) {
    const bg = $('#sheet'); bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button class="icon-btn sheet-close" data-act="cerrarHoja" aria-label="Cerrar">${IC.x}</button>${html}</div>`;
    bg.classList.add('open'); alCerrarHoja = onClose || null;
    const f = bg.querySelector('.sheet'); f.scrollTop = 0; f.focus && f.setAttribute('tabindex', '-1'); f.focus();
  }
  function cerrarHoja() { const bg = $('#sheet'); bg.classList.remove('open'); bg.innerHTML = ''; if (alCerrarHoja) { const f = alCerrarHoja; alCerrarHoja = null; f(); } }
  let pendiente = null;
  function confirmar(titulo, texto, boton, fn, peligro) {
    pendiente = fn;
    hoja(`<h2>${h(titulo)}</h2><p class="muted" style="margin:10px 0 18px">${h(texto)}</p>
      <div class="btn-row"><button class="btn sec2" data-act="cerrarHoja">Cancelar</button><button class="btn ${peligro ? 'danger' : ''}" data-act="confirmarOk">${h(boton)}</button></div>`);
  }
  const vibrar = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  function rutina(ref) {
    const u = U();
    if (!ref) return null;
    if (ref.startsWith('P:')) { const p = window.PLAN[u][ref.slice(2)]; return p && Object.assign({ ref }, p); }
    if (ref.startsWith('R:')) { const r = st().routines[u].find(x => x.id === ref.slice(2)); return r && Object.assign({ ref }, r); }
    if (ref === 'G' && ui.genResult) return Object.assign({ ref }, ui.genResult);
    return null;
  }
  const lesionesActivas = u => (st().injuries[u] || []).filter(i => i.active);
  // Perfil de entreno de cada uno (se guarda y se puede cambiar en Perfil). Lo usan el plan, el generador y la IA.
  const perfilEntreno = u => L.perfilEntreno(st(), u);
  function guardarPerfil(cambios) {
    const S = st(), u = U(); S.bodyProfile[u] = S.bodyProfile[u] || {};
    S.bodyProfile[u].entreno = Object.assign(perfilEntreno(u), cambios); Store.guardar(); ui.gen = null; ui.genResult = null; render();
  }
  const MAT_CASA = ['mancuernas', 'banda', 'botellas', 'banco', 'barra fija', 'paralelas', 'comba', 'rueda'];
  const opPlan = (d, u) => ({ recuperacionHecha: rutinaDeHoy(d), objetivo: null }); // el plan semanal ya se genera con el objetivo del perfil (plan-perfil.js)
  const sesionesUsuario = u => Object.values(st().workouts).filter(w => w.user === u && w.completed);

  // ── Gráfica de línea simple ──
  function grafica(puntos, unidad) {
    if (puntos.length < 2) return '<p class="faint" style="padding:12px 0">Con dos registros o más verás aquí la evolución.</p>';
    const W = 320, H = 140, px = 30, py = 16;
    const ys = puntos.map(p => p.y), xs = puntos.map(p => +new Date(p.x));
    let min = Math.min(...ys), max = Math.max(...ys); if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.12; min -= pad; max += pad;
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
    const X = x => px + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - px - 8), Y = y => py + (1 - (y - min) / (max - min)) * (H - py * 2);
    const pts = puntos.map(p => `${X(+new Date(p.x)).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    const ult = puntos[puntos.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución: de ${fmt(ys[0])} a ${fmt(ult.y)} ${h(unidad || '')}">
      <line x1="${px}" x2="${W - 8}" y1="${Y(max - pad)}" y2="${Y(max - pad)}" stroke="rgba(255,255,255,.08)"/>
      <line x1="${px}" x2="${W - 8}" y1="${Y(min + pad)}" y2="${Y(min + pad)}" stroke="rgba(255,255,255,.08)"/>
      <text x="0" y="${Y(max - pad) + 3}">${fmt(max - pad)}</text><text x="0" y="${Y(min + pad) + 3}">${fmt(min + pad)}</text>
      <polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${puntos.map(p => `<circle cx="${X(+new Date(p.x)).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="var(--acc)"/>`).join('')}
      <text class="last" x="${Math.min(X(+new Date(ult.x)), W - 8).toFixed(1)}" y="${(Y(ult.y) > py + 14 ? Y(ult.y) - 9 : Y(ult.y) + 18).toFixed(1)}" text-anchor="end">${fmt(ult.y)}</text>
      <text x="${px}" y="${H - 1}">${fecha(puntos[0].x)}</text><text x="${W - 8}" y="${H - 1}" text-anchor="end">${fecha(ult.x)}</text>
    </svg>`;
  }

  // ═════════════ VISTAS ═════════════
  const TITULOS = { hoy: 'Hoy', biblioteca: 'Ejercicios', progreso: 'Progreso', perfil: 'Perfil', checkin: '¿Qué tal hoy?', sesion: 'Entreno', generar: 'Rutina a medida' };

  function ruta() { const [r, ...a] = (location.hash.slice(1) || 'hoy').split('/'); return { r: TITULOS[r] ? r : 'hoy', arg: decodeURIComponent(a.join('/')) }; }

  function render() {
    const { r, arg } = ruta();
    const u = U();
    document.body.classList.toggle('her', u === 'her');
    document.body.classList.toggle('in-session', r === 'sesion' || r === 'checkin');
    const atras = ['checkin', 'sesion', 'generar'].includes(r);
    $('#top').innerHTML = `${atras ? `<button class="icon-btn" data-act="atras" aria-label="Volver">${IC.back}</button>` : ''}
      <h1>${h(TITULOS[r])}</h1>
      <div class="who" role="group" aria-label="Persona">${Object.entries(window.PERSONAS).map(([k, p]) => `<button data-act="usuario" data-arg="${k}" aria-pressed="${k === u}">${h(p.nombre)}</button>`).join('')}</div>`;
    document.querySelectorAll('nav.bottom a').forEach(a => { if (a.dataset.r === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const V = { hoy: vHoy, biblioteca: vBiblioteca, progreso: vProgreso, perfil: vPerfil, checkin: vCheckin, sesion: vSesion, generar: vGenerar };
    $('#main').innerHTML = V[r](arg);
    $('#session-bar').innerHTML = r === 'sesion' && st().session ? barraSesion() : '';
    if (r === 'biblioteca') pintarLista();
    if (r === 'progreso' && ui.prog === 'cuerpo') pintarFotos();
    if (r === 'checkin') pintarPrevia();
    document.title = `${TITULOS[r]} · El Plan`;
  }

  // ── Hoy ──
  function semana(u) {
    const d = new Date(); const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7)); lunes.setHours(0, 0, 0, 0);
    const hechos = new Set(sesionesUsuario(u).map(w => new Date(w.completedAt || w.date).toDateString()));
    return `<div class="week" aria-label="Esta semana">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => {
      const x = new Date(lunes); x.setDate(lunes.getDate() + i);
      const cls = [x.toDateString() === d.toDateString() ? 'today' : '', hechos.has(x.toDateString()) ? 'done' : ''].join(' ');
      return `<div class="${cls}">${l}<b>${x.getDate()}</b></div>`;
    }).join('')}</div>`;
  }
  function tarjetaDia(ref, d, extra, hero) {
    const n = d.ej.length;
    return `<button class="card tap${hero ? ' hero' : ''}" data-act="irCheckin" data-arg="${h(ref)}">
      <span class="badge">${h(ref.startsWith('P:') && ref.length === 3 ? ref.slice(2) : (d.lugar === 'piscina' ? '≈' : d.lugar === 'casa' ? '⌂' : d.lugar === 'calle' ? '◎' : IC.spark))}</span>
      <span class="grow"><span class="card-title" style="display:block">${h(d.nombre)}</span><span class="card-sub">${d.foco ? h(d.foco) + ' · ' : ''}<span class="nw">${n} ejercicios</span></span>${extra || ''}</span>${hero ? `<span class="cta">${IC.play} Empezar</span>` : '<span class="chev">›</span>'}</button>`;
  }
  function vHoy() {
    const u = U(), S = st();
    const p = window.PLAN[u];
    const sug = L.diaSugerido(S, u);
    const hechoHoy = sesionesUsuario(u).find(w => new Date(w.completedAt || w.date).toDateString() === new Date().toDateString());
    let out = '';
    if (S.session && S.session.user === u) {
      const s = S.session, hechos = s.exercises.filter(e => e.done).length;
      out += `<button class="card tap hero" data-act="ir" data-arg="sesion"><span class="badge">${IC.play}</span><span class="grow"><span class="card-title" style="display:block">${h(s.nombre)}</span><span class="card-sub">Sesión en curso · ${hechos} de ${s.exercises.length} ejercicios</span></span><span class="cta">Continuar</span></button>`;
    }
    const hoyTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    out += `<p class="h-sub" style="margin:${out ? 24 : 0}px 0 8px">${h(hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1))}</p>${semana(u)}`;
    out += '<div class="sec">Hoy toca</div>';
    if (hechoHoy) out += `<div class="note ok"><strong>Hecho hoy ✓</strong>${h(hechoHoy.nombre || (p[hechoHoy.day] || {}).nombre || 'Sesión')}. Descansa bien.</div>`;
    else if (sug && p[sug]) out += tarjetaDia('P:' + sug, p[sug], '', true);
    else out += '<div class="note"><strong>Día de descanso</strong>Si te apetece moverte, elige abajo una sesión o crea una a medida.</div>';

    const les = lesionesActivas(u);
    if (les.length) out += `<p class="faint" style="margin-top:8px">Con cuidado: ${les.map(i => h((ZONAS[i.zoneKey] || {}).name || i.zoneKey)).join(' · ')}. Antes de empezar te pregunto cómo estás y ajusto la sesión.</p>`;

    const pa = L.planActual(S, u), pfH = perfilEntreno(u);
    const avisoPlan = pa.fuente === 'original' ? `<div class="note gold" style="margin-bottom:10px"><strong>Tu plan de siempre</strong>Rellena tu perfil (objetivo, nivel, días y dónde entrenas) y el entrenador te monta un plan a tu medida. <a href="#perfil">Completar perfil</a></div>`
      : pa.fuente === 'ia' ? `<p class="faint" style="margin:-4px 0 10px">Plan del entrenador IA (${h(fecha(pa.creado))}) para ${h(L.OBJETIVOS[pfH.objetivo].nombre.toLowerCase())}, ${pfH.dias} días. <a href="#perfil">Ver criterios</a></p>`
      : `<div class="note" style="margin-bottom:10px"><strong>Plan hecho con reglas</strong>${pa.iaCaducado ? 'Has cambiado el perfil o las lesiones desde el último plan del entrenador. ' : ''}Pide al entrenador IA un plan completo a tu medida. <a href="#perfil">Crear con el entrenador</a></div>`;
    out += `<div class="sec">Tu plan</div>${avisoPlan}<div class="stack">` + Object.entries(p).map(([k, d]) => tarjetaDia('P:' + k, d)).join('') + '</div>';
    out += `<div class="sec">Rutinas a medida</div><div class="stack"><button class="card tap dashed" data-act="ir" data-arg="generar"><span class="badge">${IC.spark}</span><span class="grow"><span class="card-title" style="display:block">Crear una rutina ahora</span><span class="card-sub">Lugar, tiempo y objetivo; respeta tus lesiones</span></span><span class="chev">›</span></button>`;
    out += S.routines[u].map(r => `<div class="row">${tarjetaDia('R:' + r.id, r, `<span class="faint" style="display:block">${r.fuente === 'ia' ? 'Hecha con IA' : 'Hecha con reglas'} · ${fecha(r.fecha)}</span>`)}<button class="icon-btn" data-act="borrarRutina" data-arg="${h(r.id)}" aria-label="Borrar ${h(r.nombre)}">${IC.trash}</button></div>`).join('') + '</div>';

    const dias = S.lastExport ? (Date.now() - new Date(S.lastExport)) / 864e5 : Infinity;
    if (Object.keys(S.workouts).length >= 3 && dias > 14) out += `<div class="note gold" style="margin-top:20px"><strong>Haz una copia de seguridad</strong>Tus datos solo están en este móvil. ${S.lastExport ? `La última copia es de hace ${Math.floor(dias)} días.` : 'Aún no has hecho ninguna.'} <a href="#perfil">Ir a Copia de seguridad</a></div>`;
    return out;
  }

  // ── Check-in previo ──
  function vCheckin(ref) {
    const d = rutina(ref);
    if (!d) return '<div class="empty">No encuentro esa sesión. <a href="#hoy">Volver a Hoy</a></div>';
    const u = U();
    if (!ui.checkin || ui.checkin.ref !== ref) {
      const dolor = {}; lesionesActivas(u).forEach(i => { dolor[i.zoneKey] = 0; });
      ui.checkin = { ref, energia: 3, tiempo: 'completo', dolor };
    }
    const c = ui.checkin;
    const ener = ['Agotado', 'Cansado', 'Normal', 'Bien', 'A tope'];
    const otras = Object.keys(ZONAS).filter(z => !(z in c.dolor));
    return `<div class="h-title">${h(d.nombre)}</div><p class="h-sub">${h(d.foco || '')} · ${h(window.LUGARES[d.lugar])}</p>
      <div class="sec">Energía</div>
      <div class="scale" role="group" aria-label="Energía">${ener.map((l, i) => `<button data-act="ciEnergia" data-arg="${i + 1}" aria-pressed="${c.energia === i + 1}"><b>${i + 1}</b>${l}</button>`).join('')}</div>
      <div class="sec">Tiempo</div>
      <div class="seg" role="group" aria-label="Tiempo disponible">${[['rapido', 'Poco (~25 min)'], ['normal', 'Normal (~40)'], ['completo', 'Completo']].map(([k, l]) => `<button data-act="ciTiempo" data-arg="${k}" aria-pressed="${c.tiempo === k}">${l}</button>`).join('')}</div>
      <div class="sec">Dolor ahora ${Object.keys(c.dolor).length ? '<span class="faint" style="text-transform:none;letter-spacing:0">0 nada · 10 máximo</span>' : ''}</div>
      <div class="stack">${Object.keys(c.dolor).map(z => `<div class="card" style="padding:12px 14px"><div class="row"><span class="grow" style="font-weight:600">${h(ZONAS[z].name)}</span><b id="dv-${z}" style="font-family:var(--f-head)">${c.dolor[z]}</b></div>
        <input type="range" min="0" max="10" step="1" value="${c.dolor[z]}" data-in="ciDolor" data-arg="${z}" aria-label="Dolor en ${h(ZONAS[z].name)}"></div>`).join('') || '<p class="faint">Sin lesiones activas. Si hoy te molesta algo, añádelo:</p>'}</div>
      ${otras.length ? `${Object.keys(c.dolor).length ? '<p class="faint" style="margin:12px 0 8px">¿Te molesta algo más hoy?</p>' : '<div style="height:8px"></div>'}<div class="chips">${otras.map(z => `<button class="chip" data-act="ciZona" data-arg="${z}">+ ${h(L.ZONA_CORTA[z])}</button>`).join('')}</div>` : ''}
      <div class="sec">Así queda la sesión</div><div id="previa"></div>
      <div class="cta-bar"><button class="btn" data-act="empezar">${IC.play} Empezar</button></div>`;
  }
  function pintarPrevia() {
    const c = ui.checkin, d = rutina(c && c.ref), el = $('#previa'); if (!d || !el) return;
    const a = L.adaptar(st(), U(), d.lugar, d.ej, c, opPlan(d, U()));
    el.innerHTML = (a.aviso ? `<div class="note warn" style="margin-bottom:10px"><strong>Mejor parar hoy</strong>${h(a.aviso)}</div>` : '') +
      (a.ajustes.length ? `<div class="note gold"><strong>Ajustes de hoy</strong><ul>${a.ajustes.map(x => `<li>${h(x)}</li>`).join('')}</ul></div>` : '<div class="note ok"><strong>Sin cambios</strong>La sesión va tal cual.</div>') +
      `<p class="faint" style="margin-top:8px">${a.lista.length} ejercicios: ${a.lista.map(x => h(L.ex(x.id).n)).join(', ')}</p>` + previaProgresion(a, c, d);
  }
  function previaProgresion(a, c, d) {
    const S = st(), u = U();
    const filas = a.lista.map(x => ({ e: L.ex(x.id), sg: progresionHoy(S, u, x, c, a.niveles, d) })).filter(f => ['sube', 'baja', 'series', 'ia'].includes(f.sg.tipo) || (f.sg.kg != null && f.e.t === 'reps'));
    if (!filas.length) return '';
    const txt = ({ e, sg }) => {
      const t = sg.tipo === 'sube' ? 'sube a ' : sg.tipo === 'baja' ? 'baja a ' : sg.tipo === 'series' ? 'una serie más: ' : '';
      return `<li><b>${h(e.n)}</b>: ${t}${sg.kg != null && e.t === 'reps' ? fmt(sg.kg, 2) + ' kg × ' + h(sg.reps) : sg.series + ' × ' + h(sg.reps)}</li>`;
    };
    return `<div class="note ok" style="margin-top:10px"><strong>Progresión de hoy</strong><ul>${filas.map(txt).join('')}</ul><span class="faint">Sale de lo que apuntaste otras veces, tu energía y tu dolor de hoy. Dentro de cada ejercicio te explico por qué.</span></div>`;
  }

  function crearSesion(d, checkin) {
    const u = U(), S = st();
    const a = L.adaptar(S, u, d.lugar, d.ej, checkin, opPlan(d, u));
    const clave = { gym: 'gym', casa: 'Casa', calle: 'Calle', piscina: 'Piscina' }[d.lugar];
    // El plan del entrenador y el de reglas traen su calentamiento y vuelta a la calma; si no, los de siempre por lugar.
    const calent = d.calent && d.calent.length ? d.calent.map(x => ({ n: x.n, d: x.d, t: x.t, ok: false })) : (window.WARMUPS[u][clave] || []).map(x => ({ n: x.name, d: x.detail, t: x.duration, ok: false }));
    if (!(d.calent && d.calent.length)) lesionesActivas(u).forEach(i => (ZONAS[i.zoneKey].warmup_rec || []).forEach(t => calent.push({ n: t, d: 'Recomendado por tu lesión de ' + L.ZONA_CORTA[i.zoneKey].toLowerCase(), t: '', ok: false })));
    const vuelta = d.vuelta && d.vuelta.length ? d.vuelta.map(x => ({ n: x.n, d: x.d, t: x.t, ok: false })) : (window.COOLDOWNS[u][clave] || []).map(x => ({ n: x.name, d: x.detail, t: x.duration, ok: false }));
    S.session = {
      key: hoyISO() + '_' + u + '_' + Date.now(), user: u, ref: d.ref, day: d.ref.startsWith('P:') ? d.ref.slice(2) : d.ref, nombre: d.nombre, lugar: d.lugar,
      date: new Date().toISOString(), checkin: JSON.parse(JSON.stringify(checkin)), ajustes: a.ajustes, aviso: a.aviso, notas: d.notas || '',
      calent, vuelta,
      exercises: a.lista.map(x => {
        const e = L.ex(x.id), sg = progresionHoy(S, u, x, checkin, a.niveles, d);
        return { exId: x.id, name: e.n, series: sg.series, reps: sg.reps, rest: x.desc, nota: x.nota && x.nota !== sg.motivo ? x.nota : '', precaucion: !!x.precaucion, cambio: x.cambio || '', sug: sg,
          sets: setsSugeridos(sg, e), done: false };
      }),
    };
    ui.openEx = 0; Store.guardar();
  }

  // Peso, reps, tiempo o series de hoy para un ejercicio. Si la IA lo propuso hoy, manda la IA; si no, las reglas de progresión.
  // Rutina generada hoy (IA o reglas): ya viene ajustada a la recuperación de cada músculo.
  const rutinaDeHoy = d => !!(d && d.fuente && d.fecha && String(d.fecha).slice(0, 10) === hoyISO());
  function progresionHoy(S, u, x, checkin, niveles, d) {
    const sg = L.sugerir(S, u, x.id, { series: x.series, reps: x.reps, desc: x.desc }, { energia: checkin.energia, niveles, tiempo: checkin.tiempo });
    const deHoy = d && d.fuente === 'ia' && d.fecha && String(d.fecha).slice(0, 10) === hoyISO();
    if (deHoy && !x.cambio) {
      sg.series = x.series; sg.reps = x.reps;
      if (x.kg != null) { sg.kg = x.kg; sg.tipo = 'ia'; }
      if (x.nota) sg.motivo = x.nota;
    }
    return sg;
  }
  function setsSugeridos(sg, e) {
    const r = L.rango(sg.reps), obj = r ? String(r.lo).replace('.', ',') : '';
    return Array.from({ length: sg.series }, () => ({ weight: '', reps: '', done: false, pw: sg.kg != null && e.t === 'reps' ? String(sg.kg) : '', pr: obj }));
  }

  // ── Sesión ──
  function vSesion() {
    const s = st().session;
    if (!s) return '<div class="empty">No hay ninguna sesión en marcha. <a href="#hoy">Elegir una</a></div>';
    if (s.user !== U()) return `<div class="empty">Esta sesión es de ${h(window.PERSONAS[s.user].nombre)}. <button class="btn sm ghost" data-act="usuario" data-arg="${s.user}" style="margin:12px auto 0">Cambiar a ${h(window.PERSONAS[s.user].nombre)}</button></div>`;
    const hechos = s.exercises.filter(e => e.done).length;
    const tarea = (lista, tipo) => lista.map((t, i) => `<button class="task" data-act="tarea" data-arg="${tipo}:${i}" aria-pressed="${t.ok}"><span class="tick">${IC.check}</span><span class="grow"><span class="task-name">${h(t.n)}</span>${t.t ? ` <span class="pill">${h(t.t)}</span>` : ''}<span class="faint" style="display:block">${h(t.d)}</span></span></button>`).join('');
    let out = `<div class="h-title">${h(s.nombre)}</div><div class="row" style="margin:10px 0 4px"><div class="progress grow"><i style="width:${Math.round(hechos / Math.max(1, s.exercises.length) * 100)}%"></i></div><span class="faint">${hechos}/${s.exercises.length}</span></div>`;
    if (s.aviso) out += `<div class="note warn" style="margin-top:12px"><strong>Ojo</strong>${h(s.aviso)}</div>`;
    if (s.ajustes.length) out += `<details class="fold" style="margin-top:12px"><summary>Ajustes de hoy (${s.ajustes.length})</summary><div style="padding:0 14px 14px"><ul style="padding-left:18px;font-size:14px" class="muted">${s.ajustes.map(a => `<li>${h(a)}</li>`).join('')}</ul></div></details>`;
    if (s.notas) out += `<div class="note" style="margin-top:12px"><strong>Notas de la rutina</strong>${h(s.notas)}</div>`;
    out += `<details class="fold" style="margin-top:12px"><summary>Calentamiento · ${s.calent.filter(t => t.ok).length}/${s.calent.length}</summary>${tarea(s.calent, 'c')}</details>`;
    out += '<div class="stack" style="margin-top:12px">' + s.exercises.map((x, i) => tarjetaEj(x, i, s)).join('') + '</div>';
    out += `<details class="fold" style="margin-top:12px"><summary>Vuelta a la calma · ${s.vuelta.filter(t => t.ok).length}/${s.vuelta.length}</summary>${tarea(s.vuelta, 'v')}</details>`;
    return out;
  }
  function tarjetaEj(x, i, s) {
    const e = L.ex(x.exId), abierto = ui.openEx === i;
    const conPeso = e.t === 'reps' && s.lugar !== 'piscina';
    const tipo = x.sug && x.sug.tipo, flecha = tipo === 'sube' ? '↑ ' : tipo === 'baja' ? '↓ ' : '';
    const pillProg = x.sug && x.sug.kg != null && conPeso ? `<span class="pill ok">${flecha}${fmt(x.sug.kg, 2)} kg</span>`
      : tipo === 'series' ? '<span class="pill ok">+1 serie</span>' : tipo === 'sube' ? '<span class="pill ok">↑ Progresa</span>' : '';
    const meta = [`<span class="pill acc">${x.sets.length} × ${h(x.reps)}</span>`, pillProg, x.rest ? `<span>Descanso ${x.rest} s</span>` : '',
      x.precaucion ? '<span class="pill warn">Con cuidado</span>' : '', x.cambio ? `<span class="pill gold">En vez de ${h(x.cambio)}</span>` : ''].join('');
    const ult = (x.sug ? (x.sug.motivo ? `<div class="prog-note">${h(x.sug.motivo)}</div>` : '') + (x.sug.ultima && !(x.sug.motivo || '').includes(x.sug.ultima) ? `<p class="faint" style="margin-top:8px">La última vez: ${h(x.sug.ultima)}</p>` : '')
      : x.sets.some(t => t.pw) ? `<p class="faint" style="margin-top:8px">La última vez: ${x.sets.filter(t => t.pw).map(t => `${h(t.pw)} kg × ${h(t.pr || '?')}`).join(' · ')}</p>` : '');
    return `<div class="ex ${x.done ? 'done' : ''}${abierto ? ' open' : ''}">
      <button class="ex-head" data-act="abrirEj" data-arg="${i}" aria-expanded="${abierto}"><span class="ex-num">${x.done ? IC.check.replace('<svg', '<svg width="16" height="16"') : i + 1}</span><span class="grow"><span class="ex-name">${h(e.n)}</span><span class="ex-meta">${meta}</span></span></button>
      ${abierto ? `<div class="ex-body">
        ${x.nota ? `<p class="muted" style="font-size:14px">${h(x.nota)}</p>` : ''}${ult}
        <div class="set-head" style="margin-top:12px"><span>Serie</span><span>${conPeso ? 'Kg' : ''}</span><span>${e.t === 'tiempo' ? 'Tiempo' : e.t === 'distancia' ? 'Metros' : 'Reps'}</span><span>Hecha</span></div>
        <div class="sets">${x.sets.map((t, j) => `<div class="set"><span class="n">${j + 1}</span>
          ${conPeso ? `<input inputmode="decimal" placeholder="${h(t.pw ? String(t.pw).replace('.', ',') : 'kg')}" value="${h(t.weight)}" data-in="setPeso" data-arg="${i}:${j}" aria-label="Kilos serie ${j + 1}">` : '<span></span>'}
          <input inputmode="${e.t === 'reps' ? 'numeric' : 'text'}" placeholder="${h(t.pr || x.reps)}" value="${h(t.reps)}" data-in="setReps" data-arg="${i}:${j}" aria-label="Repeticiones serie ${j + 1}">
          <button class="chk" data-act="serie" data-arg="${i}:${j}" aria-pressed="${t.done}" aria-label="Serie ${j + 1} hecha">${IC.check}</button></div>`).join('')}</div>
        <div class="set-adj"><span>Series</span><button data-act="menosSerie" data-arg="${i}" aria-label="Quitar serie">${IC.minus}</button><button data-act="masSerie" data-arg="${i}" aria-label="Añadir serie">${IC.plus}</button></div>
        <div class="ex-tools"><button class="btn sm sec2" data-act="tecnica" data-arg="${e.id}">${IC.info} Técnica y vídeo</button><button class="btn sm sec2" data-act="cambiar" data-arg="${i}">${IC.swap} Cambiar</button></div>
      </div>` : ''}</div>`;
  }
  function barraSesion() {
    const todo = st().session.exercises.every(e => e.done);
    return `<div class="session-bar"><div class="in btn-row"><button class="btn sec2 pause" data-act="ir" data-arg="hoy">Pausar</button><button class="btn${todo ? '' : ' sec2'}" data-act="terminar">${todo ? IC.check + ' ' : ''}Terminar</button></div></div>`;
  }

  // ── Temporizador de descanso ──
  let timer = null;
  function iniciarDescanso(seg, nombre) {
    clearInterval(timer && timer.i);
    timer = { fin: Date.now() + seg * 1000, nombre };
    const el = $('#timer'); el.classList.add('show');
    const tick = () => {
      const r = Math.max(0, Math.round((timer.fin - Date.now()) / 1000));
      el.innerHTML = `<span class="t" aria-live="off">${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}</span><span class="lbl">Descanso<br>${h(timer.nombre)}</span><button data-act="timerMas" aria-label="Sumar 15 segundos">+15</button><button data-act="timerFin">Saltar</button>`;
      if (r <= 0) { pararDescanso(); pitido(); vibrar([200, 100, 200]); toast('¡A por la siguiente serie!'); }
    };
    tick(); timer.i = setInterval(tick, 500);
  }
  function pararDescanso() { if (timer) clearInterval(timer.i); timer = null; $('#timer').classList.remove('show'); }
  function pitido() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.35); } catch (e) {} }

  let wake = null;
  async function pantallaEncendida(on) {
    try { if (on && !wake && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } else if (!on && wake) { wake.release(); wake = null; } } catch (e) {}
  }

  // ── Técnica (ficha de ejercicio) ──
  function fichaTecnica(id) {
    const e = L.ex(id); if (!e) return;
    const u = U(), niveles = L.nivelesZona(st(), u, {});
    const zonas = Object.entries(e.r || {});
    const mias = zonas.filter(([z]) => niveles[z]);
    hoja(`<h2>${h(e.n)}</h2>
      <div class="chips" style="margin-top:10px">${e.m.map(m => `<span class="pill acc">${h(L.MUSCULOS[m])}</span>`).join('')}${(e.s || []).map(m => `<span class="pill">${h(L.MUSCULOS[m])}</span>`).join('')}<span class="pill">${h(L.NIVEL[e.niv])}</span>${e.mat.map(m => `<span class="pill">${h(L.MATERIAL[m] || m)}</span>`).join('')}</div>
      <div class="video" data-video="${h(e.v)}"><img src="https://i.ytimg.com/vi/${h(e.v)}/hqdefault.jpg" alt="" loading="lazy"><button class="play" data-act="video" aria-label="Ver vídeo de ${h(e.n)}"><span>${IC.play}</span></button></div>
      ${mias.length ? `<div class="note warn" style="margin-bottom:14px"><strong>Con tus lesiones</strong>${mias.map(([z, r]) => `${h(ZONAS[z].name)}: ${r === 2 ? 'mejor evitarlo' : 'con cuidado y sin dolor'}`).join('<br>')}</div>` : ''}
      <div class="sec" style="margin-top:4px">Cómo se hace</div><ol class="steps">${e.p.map(p => `<li><span>${h(p)}</span></li>`).join('')}</ol>
      <div class="sec">Errores típicos</div><ul class="errs">${e.e.map(p => `<li><span>${h(p)}</span></li>`).join('')}</ul>
      ${e.c ? `<div class="note ok" style="margin-top:16px"><strong>Consejo</strong>${h(e.c)}</div>` : ''}
      <p class="faint" style="margin-top:16px">Por defecto: ${e.d[0]} series × ${h(e.d[1])}${e.d[2] ? `, descanso ${e.d[2]} s` : ''}.${zonas.length && !mias.length ? ' Ojo si te molesta: ' + zonas.map(([z]) => L.ZONA_CORTA[z].toLowerCase()).join(', ') + '.' : ''} <a href="https://www.youtube.com/watch?v=${h(e.v)}" target="_blank" rel="noopener">Abrir en YouTube</a></p>`);
  }

  // ── Biblioteca ──
  function filtrar(f, ignorar) {
    const niveles = L.nivelesZona(st(), U(), {});
    const q = (f.q || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return window.EJERCICIOS.filter(e =>
      (ignorar === 'lugar' || !f.lugar || e.l.includes(f.lugar)) &&
      (ignorar === 'musculo' || !f.musculo || e.m.includes(f.musculo) || (e.s || []).includes(f.musculo)) &&
      (ignorar === 'material' || !f.material || e.mat.includes(f.material)) &&
      (ignorar === 'nivel' || !f.nivel || e.niv === f.nivel) &&
      (!f.seguro || L.riesgo(e, niveles) === 'ok') &&
      (!q || (e.n + ' ' + e.m.map(m => L.MUSCULOS[m]).join(' ')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  }
  function vBiblioteca() {
    const f = ui.lib;
    // Solo se ofrecen opciones que dan resultados con el resto de filtros: nunca un filtro vacío.
    const conLugar = filtrar(f, 'musculo'), conMat = filtrar(f, 'material');
    const mus = Object.keys(L.MUSCULOS).filter(m => conLugar.some(e => e.m.includes(m) || (e.s || []).includes(m)));
    const mats = Object.keys(L.MATERIAL).filter(m => conMat.some(e => e.mat.includes(m)));
    const hayLes = lesionesActivas(U()).length;
    return `<div class="search"><span>${IC.search}</span><input class="input" type="search" placeholder="Buscar ejercicio o músculo" value="${h(f.q)}" data-in="libQ" aria-label="Buscar"></div>
      <div class="chips scroll" style="margin-top:12px" role="group" aria-label="Lugar">${[['', 'Todos'], ...Object.entries(window.LUGARES)].map(([k, l]) => `<button class="chip" data-act="libF" data-arg="lugar:${k}" aria-pressed="${f.lugar === k}">${h(l)}</button>`).join('')}</div>
      <div class="chips scroll" style="margin-top:8px" role="group" aria-label="Músculo">${['', ...mus].map(m => `<button class="chip" data-act="libF" data-arg="musculo:${m}" aria-pressed="${f.musculo === m}">${m ? h(L.MUSCULOS[m]) : 'Todos los músculos'}</button>`).join('')}</div>
      <div class="grid2" style="margin-top:8px"><select class="input slim" data-in="libMat" aria-label="Material"><option value="">Material</option>${mats.map(m => `<option value="${h(m)}" ${f.material === m ? 'selected' : ''}>${h(L.MATERIAL[m])}</option>`).join('')}</select>
      <select class="input slim" data-in="libNivel" aria-label="Nivel"><option value="0">Nivel</option>${[1, 2, 3].map(n => `<option value="${n}" ${f.nivel === n ? 'selected' : ''}>${L.NIVEL[n]}</option>`).join('')}</select></div>
      ${hayLes ? `<div class="chips" style="margin-top:8px"><button class="chip" data-act="libSeguro" aria-pressed="${f.seguro}">${f.seguro ? '✓ ' : ''}Solo seguros para mis lesiones</button></div>` : ''}
      <div id="libList" style="margin-top:16px"></div>`;
  }
  function pintarLista() {
    const el = $('#libList'); if (!el) return;
    const r = filtrar(ui.lib), niveles = L.nivelesZona(st(), U(), {});
    el.innerHTML = `<p class="faint" style="margin-bottom:8px" aria-live="polite">${r.length} ejercicio${r.length === 1 ? '' : 's'}</p>` + (r.length ? '<div class="stack">' + r.map(e => {
      const rg = L.riesgo(e, niveles);
      return `<button class="lib-item" data-act="tecnica" data-arg="${e.id}"><span class="lib-thumb" style="background-image:url(https://i.ytimg.com/vi/${h(e.v)}/mqdefault.jpg)"></span><span class="grow"><span class="lib-name" style="display:block">${h(e.n)}</span><span class="lib-meta">${e.m.map(m => L.MUSCULOS[m]).join(', ')} · ${e.l.map(l => window.LUGARES[l]).join(', ')} · ${L.NIVEL[e.niv]}</span>${rg !== 'ok' ? `<span class="pill ${rg === 'evitar' ? 'warn' : 'gold'}" style="margin-top:4px">${rg === 'evitar' ? 'Evitar con tu lesión' : 'Con cuidado'}</span>` : ''}</span></button>`;
    }).join('') + '</div>' : `<div class="empty">Nada con estos filtros.<br><button class="btn sm ghost" data-act="libReset" style="margin:12px auto 0">Quitar filtros</button></div>`);
  }

  // ── Progreso ──
  function vProgreso() {
    const seg = `<div class="seg" role="group" aria-label="Sección">${[['cuerpo', 'Cuerpo'], ['fuerza', 'Fuerza'], ['dolor', 'Dolor']].map(([k, l]) => `<button data-act="progTab" data-arg="${k}" aria-pressed="${ui.prog === k}">${l}</button>`).join('')}</div>`;
    return seg + '<div style="margin-top:16px">' + ({ cuerpo: pCuerpo, fuerza: pFuerza, dolor: pDolor }[ui.prog])() + '</div>';
  }
  const METRICAS = { peso: ['Peso', 'kg', 'peso'], grasa: ['% grasa', '%', 'grasa'], masaMagra: ['Masa magra', 'kg', 'masaMagra'], masaGrasa: ['Masa grasa', 'kg', 'masaGrasa'], cintura: ['Cintura', 'cm', 'cintura'], cadera: ['Cadera', 'cm', 'cadera'], pecho: ['Pecho', 'cm', 'pecho'], brazo: ['Brazo', 'cm', 'brazo'], muslo: ['Muslo', 'cm', 'muslo'] };
  function pCuerpo() {
    const u = U(), S = st(), prof = S.bodyProfile[u] || {}, log = S.bodyLog[u] || [];
    const botones = `<div class="btn-row" style="margin-top:14px"><button class="btn" data-act="registroCuerpo">${IC.plus} Nuevo registro</button><button class="btn sec2" data-act="objetivos">Objetivos</button></div>`;
    if (!log.length) return `<div class="empty">Aún no hay medidas.<br>Apunta peso y medidas para ver peso, % de grasa, masa magra e IMC.</div>${botones}<div class="sec">Fotos</div><div id="fotos"></div>`;
    const calc = log.map(e => Object.assign({ fecha: e.date }, L.cuerpo(prof, e)));
    const ult = calc[calc.length - 1], ant = calc.length > 1 ? calc[calc.length - 2] : null;
    const delta = (k, menosEsMejor) => { if (!ant || ult[k] == null || ant[k] == null) return ''; const d = ult[k] - ant[k]; if (Math.abs(d) < 0.05) return '<div class="d flat">igual</div>'; const bien = menosEsMejor ? d < 0 : d > 0; return `<div class="d ${bien ? 'down' : 'up'}">${d > 0 ? '+' : '−'}${fmt(Math.abs(d), k === 'ich' ? 2 : 1)}</div>`; };
    const stat = (k, n, unidad, extra, menos) => `<div class="stat"><div class="k">${n}</div><div class="v">${fmt(ult[k], k === 'ich' ? 2 : 1)}${ult[k] != null ? `<small>${unidad}</small>` : ''}</div><div class="row2">${delta(k, menos)}${extra ? `<div class="d faint">${h(extra)}</div>` : ''}</div></div>`;
    let out = `<p class="faint" style="margin-bottom:8px">Último registro: ${fecha(ult.fecha, { day: 'numeric', month: 'long' })}${ant ? ` · cambio desde el ${fecha(ant.fecha, { day: 'numeric', month: 'long' })}` : ''}</p>
      <div class="grid2">${stat('peso', 'Peso', 'kg', '', true)}${stat('grasa', 'Grasa corporal', '%', L.catGrasa(ult.grasa, prof.sex), true)}${stat('masaMagra', 'Masa magra', 'kg', '', false)}${stat('masaGrasa', 'Masa grasa', 'kg', '', true)}${stat('imc', 'IMC', '', L.catImc(ult.imc), true)}${stat('ich', 'Cintura / altura', '', L.catIch(ult.ich), true)}</div>`;
    if (!prof.height) out += '<div class="note gold" style="margin-top:10px"><strong>Falta tu altura</strong>Sin ella no puedo calcular el IMC ni el % de grasa. Añádela en «Nuevo registro».</div>';
    const disp = Object.keys(METRICAS).filter(k => calc.some(c => c[k] != null));
    if (!disp.includes(ui.metric)) ui.metric = disp[0] || 'peso';
    const [nm, un] = METRICAS[ui.metric];
    out += `<div class="sec">Evolución</div><div class="chips scroll" role="group" aria-label="Medida">${disp.map(k => `<button class="chip" data-act="metric" data-arg="${k}" aria-pressed="${ui.metric === k}">${METRICAS[k][0]}</button>`).join('')}</div>
      <div class="card" style="margin-top:10px">${grafica(calc.filter(c => c[ui.metric] != null).map(c => ({ x: c.fecha, y: c[ui.metric] })), un)}<p class="faint">${nm} en ${un}</p></div>`;
    const g = prof.goals || {};
    const barra = (n, cur, meta, ini, un2) => { if (meta == null || cur == null) return ''; const tot = Math.abs(meta - ini), hecho = Math.abs(cur - ini); const pc = tot ? Math.max(0, Math.min(100, Math.round(hecho / tot * 100))) : 100; return `<div style="margin-top:10px"><div class="row"><span class="grow">${n}</span><span class="faint">${fmt(cur)} → ${fmt(meta)} ${un2}</span></div><div class="progress" style="margin-top:6px"><i style="width:${pc}%"></i></div></div>`; };
    if (g.weight != null || g.bodyFat != null) out += `<div class="sec">Objetivos</div><div class="card">${barra('Peso', ult.peso, g.weight, calc[0].peso, 'kg')}${barra('% grasa', ult.grasa, g.bodyFat, calc[0].grasa, '%')}</div>`;
    out += botones;
    out += `<div class="sec">Historial</div><div class="card" style="padding:4px 14px">${calc.slice().reverse().slice(0, 12).map((c, i) => `<div class="list-row"><span class="grow"><b>${fecha(c.fecha, { day: 'numeric', month: 'short', year: '2-digit' })}</b><span class="faint" style="display:block">${[c.peso != null ? fmt(c.peso) + ' kg' : '', c.grasa != null ? fmt(c.grasa) + ' % grasa' : '', c.cintura != null ? 'cintura ' + fmt(c.cintura) : ''].filter(Boolean).join(' · ')}</span></span><button class="icon-btn" data-act="borrarCuerpo" data-arg="${log.length - 1 - i}" aria-label="Borrar registro">${IC.trash}</button></div>`).join('')}</div>`;
    out += '<div class="sec">Fotos</div><div id="fotos"></div>';
    return out;
  }
  function formCuerpo() {
    const u = U(), S = st(), prof = S.bodyProfile[u] || {}, f = prof.sex === 'f';
    const hoy = (S.bodyLog[u] || []).find(e => (e.date || '').slice(0, 10) === hoyISO()) || {};
    const campo = (id, n, un, v, ayuda) => `<div><label class="f" for="${id}">${n} (${un})</label><input class="input" id="${id}" inputmode="decimal" value="${v == null ? '' : h(v)}">${ayuda ? `<div class="hint">${h(ayuda)}</div>` : ''}</div>`;
    hoja(`<h2>Registro de hoy</h2><p class="faint" style="margin:6px 0 14px">Rellena lo que tengas. Con peso, cuello y cintura${f ? ' y cadera' : ''} calculo tu % de grasa (fórmula US Navy). Si tu báscula te da el % de grasa, ponlo y uso ese.</p>
      <div class="grid2">
        <div><label class="f" for="b-sex">Sexo</label><select class="input" id="b-sex"><option value="m" ${!f ? 'selected' : ''}>Hombre</option><option value="f" ${f ? 'selected' : ''}>Mujer</option></select></div>
        ${campo('b-height', 'Altura', 'cm', prof.height, '')}
        ${campo('b-weight', 'Peso', 'kg', hoy.weight, 'En ayunas, tras ir al baño.')}
        ${campo('b-fat', '% grasa báscula', '%', hoy.bodyFat, 'Opcional.')}
        ${campo('b-neck', 'Cuello', 'cm', hoy.neck, 'Bajo la nuez.')}
        ${campo('b-waist', 'Cintura', 'cm', hoy.waist, 'A la altura del ombligo, sin meter tripa.')}
        ${campo('b-hip', 'Cadera', 'cm', hoy.hip, 'Parte más ancha del glúteo.')}
        ${campo('b-chest', 'Pecho', 'cm', hoy.chest, '')}
        ${campo('b-arm', 'Brazo', 'cm', hoy.arm, 'Contraído, parte más ancha.')}
        ${campo('b-thigh', 'Muslo', 'cm', hoy.thigh, 'Parte más ancha.')}
      </div><div style="height:16px"></div><button class="btn" data-act="guardarCuerpo">Guardar</button>`);
  }
  async function pintarFotos() {
    const el = $('#fotos'); if (!el) return;
    const u = U(), fotos = (await Store.fotos.all()).filter(p => p.user === u).sort((a, b) => new Date(b.date) - new Date(a.date));
    el.innerHTML = `<p class="faint" style="margin-bottom:10px">Solo se guardan en este móvil. Misma luz, postura y ropa cada vez.</p>
      <label class="btn sec2" style="cursor:pointer">${IC.camera} Añadir foto<input type="file" accept="image/*" data-in="foto" class="sr"></label>
      ${fotos.length ? `<div class="photos" style="margin-top:12px">${fotos.map(p => `<button data-act="verFoto" data-arg="${h(p.id)}" style="background-image:url(${p.data})" aria-label="Foto del ${fecha(p.date)}"><span>${fecha(p.date)}</span></button>`).join('')}</div>` : ''}`;
  }
  function pFuerza() {
    const u = U(), S = st(), ses = sesionesUsuario(u);
    const mes = new Date(); const esteMes = ses.filter(w => { const d = new Date(w.completedAt || w.date); return d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear(); }).length;
    const ids = {}; ses.forEach(w => (w.exercises || []).forEach(x => { const id = x.exId || L.idDeNombre(x.name); if (id && L.ex(id) && (x.sets || []).some(s => +s.weight > 0)) ids[id] = (ids[id] || 0) + 1; }));
    const lista = Object.keys(ids).sort((a, b) => ids[b] - ids[a]);
    let out = `<div class="grid2"><div class="stat"><div class="k">Sesiones este mes</div><div class="v">${esteMes}</div></div><div class="stat"><div class="k">Sesiones en total</div><div class="v">${ses.length}</div></div></div>`;
    if (!lista.length) return out + '<div class="empty">Cuando apuntes kilos en tus sesiones verás aquí cómo sube tu fuerza.</div>';
    if (!lista.includes(ui.fuerzaId)) ui.fuerzaId = lista[0];
    const hist = L.historialEjercicio(S, u, ui.fuerzaId), mej = Math.max(...hist.map(x => x.max));
    out += `<div class="sec">Por ejercicio</div><select class="input" data-in="fuerzaId" aria-label="Ejercicio">${lista.map(id => `<option value="${id}" ${id === ui.fuerzaId ? 'selected' : ''}>${h(L.ex(id).n)} (${ids[id]})</option>`).join('')}</select>
      <div class="card" style="margin-top:10px">${grafica(hist.map(x => ({ x: x.fecha, y: x.max })), 'kg')}<p class="faint">Peso máximo por sesión (kg). Mejor marca: <b style="color:var(--text)">${fmt(mej)} kg</b> · 1RM estimado: ${fmt(hist[hist.length - 1].rm)} kg</p></div>`;
    out += `<div class="sec">Últimas sesiones</div><div class="card" style="padding:4px 14px">${ses.sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date)).slice(0, 8).map(w => {
      const vol = (w.exercises || []).reduce((t, x) => t + (x.sets || []).reduce((a, s) => a + (s.done !== false ? (+s.weight || 0) * (parseInt(s.reps) || 0) : 0), 0), 0);
      return `<div class="list-row"><span class="grow"><b>${h(w.nombre || (window.PLAN[u][w.day] || {}).nombre || w.day)}</b><span class="faint" style="display:block">${fecha(w.completedAt || w.date, { weekday: 'short', day: 'numeric', month: 'short' })}${vol ? ` · ${Math.round(vol).toLocaleString('es-ES')} kg movidos` : ''}${w.feedback && w.feedback.esfuerzo ? ` · esfuerzo ${w.feedback.esfuerzo}/5` : ''}</span></span></div>`;
    }).join('')}</div>`;
    return out;
  }
  function registrosDolor(u) {
    const pts = {};
    st().painLog.forEach(p => {
      if (p.zones || p.antes) {
        if (p.user !== u) return;
        Object.entries(Object.assign({}, p.antes || p.zones, p.despues || {})).forEach(([z, v]) => { (pts[z] = pts[z] || []).push({ x: p.date, y: +v }); });
      } else if (u === 'her') { // registros de la versión anterior (solo cadera)
        const v = Math.max(+p.rest || 0, +p.walking || 0, +p.during || 0, +p.next || 0);
        (pts.cadera_lateral = pts.cadera_lateral || []).push({ x: p.date, y: v });
      }
    });
    return pts;
  }
  function pDolor() {
    const u = U(), pts = registrosDolor(u), zonas = Object.keys(pts).filter(z => ZONAS[z]);
    if (!zonas.length) return '<div class="empty">Cada vez que empiezas una sesión apuntas el dolor de tus zonas. Aquí verás si va a menos.</div>';
    return zonas.map(z => {
      const p = pts[z].sort((a, b) => new Date(a.x) - new Date(b.x));
      const ult7 = p.filter(x => Date.now() - new Date(x.x) < 7 * 864e5), media = ult7.length ? ult7.reduce((a, b) => a + b.y, 0) / ult7.length : null;
      return `<div class="card" style="margin-bottom:12px"><div class="row"><span class="grow card-title">${h(ZONAS[z].name)}</span>${media != null ? `<span class="pill ${media >= 5 ? 'warn' : media >= 3 ? 'gold' : 'ok'}">media 7 días: ${fmt(media)}</span>` : ''}</div>${grafica(p, '/10')}<p class="faint">Dolor de 0 a 10. La buena señal es que baje con las semanas.</p></div>`;
    }).join('');
  }

  // ── Perfil ──
  function vPerfil() {
    const u = U(), S = st(), les = S.injuries[u] || [];
    const sev = ['', 'Leve', 'Moderada', 'Fuerte'];
    const tarjetaLesion = (i, idx) => { const z = ZONAS[i.zoneKey] || { name: i.zoneKey }; return `<div class="card" style="margin-bottom:10px;${i.active ? '' : 'opacity:.6'}">
      <div class="row"><span class="grow card-title">${h(z.name)}</span><span class="pill ${i.active ? 'warn' : 'ok'}">${i.active ? sev[i.severity] || '' : 'Superada'}</span></div>
      ${i.note ? `<p class="muted" style="font-size:14px;margin-top:4px">${h(i.note)}</p>` : ''}
      ${i.active ? `<div class="seg" style="margin-top:10px" role="group" aria-label="Intensidad">${[1, 2, 3].map(n => `<button data-act="lesionSev" data-arg="${idx}:${n}" aria-pressed="${+i.severity === n}">${sev[n]}</button>`).join('')}</div>` : ''}
      ${i.active && z.danger_rules ? `<details style="margin-top:10px"><summary class="faint" style="cursor:pointer">Qué evitar y qué ayuda</summary><ul style="padding-left:18px;font-size:14px;margin-top:6px" class="muted">${z.danger_rules.map(r => `<li>${h(r)}</li>`).join('')}</ul>${z.tip ? `<p style="font-size:14px;margin-top:6px">${h(z.tip)}</p>` : ''}</details>` : ''}
      <div class="btn-row" style="margin-top:10px">${i.active ? `<button class="btn sm sec2" data-act="lesionCurar" data-arg="${idx}">Marcar superada</button>` : `<button class="btn sm sec2" data-act="lesionActivar" data-arg="${idx}">Reactivar</button>`}<button class="btn-text danger" style="flex:0 0 auto" data-act="lesionBorrar" data-arg="${idx}">${IC.trash} Borrar</button></div></div>`; };
    const exp = S.lastExport ? fecha(S.lastExport, { day: 'numeric', month: 'long', year: 'numeric' }) : 'nunca';
    const pf = perfilEntreno(u);
    const chp = (act, k, l, on) => `<button class="chip" data-act="${act}" data-arg="${k}" aria-pressed="${on}">${h(l)}</button>`;
    const segp = (act, pares, val) => `<div class="seg" role="group">${pares.map(([k, l]) => `<button data-act="${act}" data-arg="${k}" aria-pressed="${String(val) === String(k)}">${h(l)}</button>`).join('')}</div>`;
    return `<div class="sec" style="margin-top:0">Mi entrenamiento · ${h(window.PERSONAS[u].nombre)}</div>
      <p class="faint" style="margin-bottom:10px">Se guarda para ${h(window.PERSONAS[u].nombre)}. Tu plan semanal se hace con estos datos y tus lesiones, y se rehace solo cuando cambias algo. Las rutinas a medida y la IA también parten de aquí.</p>
      <div class="card stack">
        <div><label class="f">Objetivo principal</label><div class="chips">${['perder', 'musculo', 'fuerza', 'tono', 'recuperacion'].map(k => chp('pfObj', k, L.OBJETIVOS[k].nombre, pf.objetivo === k)).join('')}</div></div>
        <div><label class="f">Nivel</label>${segp('pfNivel', [[1, 'Fácil'], [2, 'Medio'], [3, 'Avanzado']], pf.nivel)}</div>
        <div><label class="f">Dónde sueles entrenar</label><div class="chips">${Object.entries(window.LUGARES).map(([k, l]) => chp('pfLugar', k, l, pf.lugar === k)).join('')}</div></div>
        <div><label class="f">Tiempo por sesión</label>${segp('pfMin', [[20, '20 min'], [30, '30'], [45, '45'], [60, '60']], pf.minutos)}</div>
        <div><label class="f">Días por semana</label>${segp('pfDias', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], pf.dias)}</div>
        <div><label class="f">Músculos que quieres priorizar <span class="faint">opcional</span></label><div class="chips">${['gluteo', 'pecho', 'espalda', 'hombro', 'cuadriceps', 'isquios', 'core', 'biceps', 'triceps', 'gemelo'].map(m => chp('pfPrio', m, L.MUSCULOS[m], pf.prioridades.includes(m))).join('')}</div></div>
        <div><label class="f">Material que tienes en casa</label><div class="chips">${MAT_CASA.map(m => chp('pfMat', m, L.MATERIAL[m], pf.material.includes(m))).join('')}</div></div>
      </div>

      ${tarjetaPlan(u)}

      <div class="sec">Lesiones y molestias</div>
      <p class="faint" style="margin-bottom:10px">La app usa esto para cambiar o quitar ejercicios que te puedan hacer daño, en el plan, en la biblioteca y en las rutinas a medida.</p>
      ${les.map(tarjetaLesion).join('') || '<p class="muted" style="margin-bottom:10px">Ninguna apuntada.</p>'}
      <button class="btn ghost" data-act="nuevaLesion">${IC.plus} Añadir lesión</button>

      <div class="sec">Entreno</div>
      <div class="card"><div class="row"><span class="grow"><b>Descanso automático</b><span class="faint" style="display:block">Al marcar una serie arranca el temporizador.</span></span><button class="chip" data-act="autoRest" aria-pressed="${S.settings.autoRest}">${S.settings.autoRest ? 'Sí' : 'No'}</button></div></div>

      <div class="sec">Agente de rutinas (IA)</div>
      <div class="card"><label class="f" for="ia-code">Código de acceso</label><input class="input" id="ia-code" type="password" autocomplete="off" value="${h(S.settings.code)}" data-in="iaCode">
      <div class="hint">El mismo que configuraste al publicar la app. Si lo dejas vacío y el servidor no pide código, funciona igual.</div>
      <details style="margin-top:10px"><summary class="faint" style="cursor:pointer">Avanzado</summary><label class="f" for="ia-url" style="margin-top:8px">Dirección del agente</label><input class="input" id="ia-url" value="${h(S.settings.apiUrl)}" data-in="iaUrl"></details></div>

      <div class="sec">Copia de seguridad</div>
      <div class="card"><p class="muted" style="font-size:14px">Tus datos solo están en este móvil. Descarga una copia de vez en cuando y guárdala en tu nube. Última copia: <b>${h(exp)}</b>.</p>
      <p class="faint" style="margin-top:6px">También sirve para pasar los datos de la versión anterior: en la anterior pulsa «Exportar» y aquí «Importar».</p>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="exportar">Exportar</button><label class="btn sec2" style="cursor:pointer">Importar<input type="file" accept="application/json,.json" data-in="importar" class="sr"></label></div>
      <button class="btn-text danger block" data-act="borrarTodo">Borrar todos los datos</button></div>

      <div class="sec">Guía</div>
      <div class="stack">${guia(u)}</div>
      <p class="faint" style="text-align:center;margin-top:24px">El Plan · versión 3</p>`;
  }
  // Plan semanal: de dónde sale, con qué criterio y botón para que lo haga el entrenador IA.
  function tarjetaPlan(u) {
    const S = st(), pa = L.planActual(S, u);
    const fuente = { ia: `Hecho por el entrenador IA el ${fecha(pa.creado, { day: 'numeric', month: 'long' })}`, reglas: 'Hecho con las reglas de la app', original: 'Tu plan de siempre (aún sin perfil)' }[pa.fuente];
    const dias = Object.entries(pa.dias).filter(([k]) => !['Casa', 'Calle', 'Piscina'].includes(k));
    const nd = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const cuando = k => Object.entries(pa.horario).filter(([, v]) => v === k).map(([wd]) => nd[wd]).join(', ');
    return `<div class="sec">Tu plan semanal</div><div class="card stack">
      <div><b>${h(fuente)}</b>${pa.iaCaducado ? '<span class="faint" style="display:block">Has cambiado el perfil o las lesiones: el plan del entrenador ya no encaja y se usa el de reglas hasta que lo rehagas.</span>' : ''}</div>
      ${pa.resumen ? `<p style="font-size:14px">${h(pa.resumen)}</p>` : ''}
      <ul style="padding-left:18px;font-size:14px" class="muted">${dias.map(([k, d]) => `<li><b>${h(d.nombre)}</b>${cuando(k) ? ` · ${h(cuando(k))}` : ''} · ${d.ej.length} ejercicios${d.calent ? ` + calentamiento y estiramientos` : ''}</li>`).join('')}</ul>
      ${pa.criterios ? `<details><summary class="faint" style="cursor:pointer">Con qué criterio está hecho</summary><p style="font-size:14px;margin-top:6px">${h(pa.criterios)}</p>${pa.progresion ? `<p style="font-size:14px;margin-top:6px"><b>Progresión:</b> ${h(pa.progresion)}</p>` : ''}</details>` : ''}
      ${L.tienePerfil(S, u) ? `<button class="btn" data-act="crearPlanIA" ${ui.planLoading ? 'disabled' : ''}>${ui.planLoading ? '<span class="spin"></span> El entrenador está montando tu plan… (hasta 2-3 min)' : IC.spark + (pa.fuente === 'ia' ? ' Rehacer con el entrenador IA' : ' Crear mi plan con el entrenador IA')}</button>
        ${pa.fuente === 'ia' ? '<button class="btn-text block" data-act="planReglas">Usar el plan de reglas</button>' : ''}` : '<p class="faint">Elige arriba al menos tu objetivo y el plan se hace a tu medida.</p>'}
      <p class="faint">Casa, Calistenia y Piscina siguen siempre en Hoy; la piscina se propone el fin de semana.</p></div>`;
  }
  async function crearPlanIA() {
    const S = st(), u = U();
    ui.planLoading = true; render();
    try {
      const url = (S.settings.apiUrl || '/api/rutina').replace(/rutina\/?$/, 'plan');
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 280000);
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-code': S.settings.code || '' }, body: JSON.stringify(L.datosParaEntrenador(S, u)), signal: ctrl.signal });
      clearTimeout(to);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('error ' + r.status));
      L.guardarPlanIA(S, u, d.plan || d); Store.guardar();
      toast('Plan nuevo listo. Lo tienes en Hoy.', 3500);
    } catch (e) {
      const motivo = !navigator.onLine ? 'sin conexión' : e.name === 'AbortError' ? 'tardó demasiado' : e.message;
      toast('El entrenador no pudo hacer el plan (' + motivo + '). Sigues con el plan de reglas.', 5000);
    }
    ui.planLoading = false; render();
  }

  function guia(u) {
    const f = (t, html) => `<details class="fold"><summary>${t}</summary><div style="padding:0 14px 14px;font-size:15px" class="stack">${html}</div></details>`;
    const uso = f('Cómo usar la app', `<p>1. En <b>Hoy</b> elige la sesión. Te pregunto energía, tiempo y dolor, y ajusto la sesión: cambia ejercicios que no te convienen, quita series si estás cansado o recorta si vas con prisa. Ves cada cambio en «Ajustes de hoy».</p><p>2. Durante la sesión apunta kilos y repeticiones y marca cada serie. El descanso empieza solo.</p><p>3. En cada ejercicio, «Técnica y vídeo» te explica cómo se hace, y «Cambiar» te da alternativas seguras.</p><p>4. «Crear una rutina ahora» te hace una sesión a medida con lo que marques.</p>`);
    const him = f('Reglas de progreso', `<p><b>Test de las 12 reps.</b> 12 con margen: sube peso. 12 muy justas: peso correcto. No llegas a 8: baja peso.</p><p><b>Cuándo subir.</b> Las 3 series en el rango alto con buena técnica, 2 sesiones seguidas. Sube 2,5-5 kg en pierna o 1-2,5 kg en tren superior.</p><p><b>Nutrición.</b> Déficit de 300-500 kcal, 130-160 g de proteína al día, 2-3 L de agua.</p><p><b>Cardio.</b> 15-20 min moderado tras las pesas y 8-10 mil pasos al día.</p><div class="note warn"><strong>Para si notas</strong>Dolor agudo en una articulación, crujido con pérdida de fuerza, dolor lumbar que baja por la pierna, mareo o falta de aire desproporcionada.</div>`);
    const her = f('Tu regla de oro: el dolor manda', `<p><b>Antes:</b> si duele mucho, cámbialo por tren superior. <b>Durante:</b> si hay pinchazo, paras. <b>Después:</b> si al día siguiente empeora, fuera del plan.</p><p><b>Sí:</b> abductor con fuerza, tren superior, puente de glúteo, dead bug, bird dog, plancha, bici, caminar, aquajogging, piscina.</p><p><b>De momento no:</b> sentadilla, peso muerto, zancadas, hip thrust, búlgara, aductor, correr o saltar, estiramientos con la pierna cruzada.</p><p><b>Tu ejercicio estrella</b> es la máquina abductora: trabaja el glúteo medio y, con fuerza progresiva, es lo que más ayuda.</p><p><b>La señal de mejora</b> no es levantar más: es que baje el dolor en reposo y que caminar moleste menos.</p>`);
    const nat = f('Natación: los 7 principios', `<ol class="steps">${[['La respiración es inversa', 'Inhalas por la boca y exhalas por la nariz.'], ['Nunca aguantes el aire', 'Bajo el agua sueltas aire todo el rato; al salir solo inhalas.'], ['La cabeza se gira, no se levanta', 'Si la levantas, se hunden las caderas. Oreja pegada al brazo estirado.'], ['El cuerpo es una flecha', 'Brazos al frente, manos juntas, pegados a las orejas. Vuelve a esa posición entre brazadas.'], ['La patada viene de la cadera', 'Piernas casi rectas, movimiento pequeño y rápido. Te mantiene horizontal.'], ['Relájate: la tensión hunde', 'Con aire en los pulmones y el cuerpo suelto, flotas.'], ['Menos largos, más técnica', 'Ejercicios cortos con material. Las primeras sesiones son casi todo técnica.']].map(p => `<li><span><b>${p[0]}.</b> ${p[1]}</span></li>`).join('')}</ol>`);
    return uso + (u === 'her' ? her : him) + nat;
  }
  function formLesion() {
    hoja(`<h2>Añadir lesión o molestia</h2>
      <label class="f" for="l-zona" style="margin-top:14px">Zona</label><select class="input" id="l-zona">${Object.entries(ZONAS).map(([k, z]) => `<option value="${k}">${h(z.name)}</option>`).join('')}</select>
      <label class="f" style="margin-top:12px">Intensidad</label><div class="seg" role="group" id="l-sev">${['Leve', 'Moderada', 'Fuerte'].map((l, i) => `<button data-act="lSev" data-arg="${i + 1}" aria-pressed="${i === 1}">${l}</button>`).join('')}</div>
      <p class="hint">Leve o moderada: quito lo que más carga la zona y aviso en lo demás. Fuerte: cambio todo lo que la carga. Si un día duele 4 o más, también cambio todo lo que la carga.</p>
      <label class="f" for="l-nota" style="margin-top:12px">Nota (opcional)</label><textarea class="input" id="l-nota" placeholder="Qué te dijo el fisio, qué movimientos duelen…"></textarea>
      <div style="height:14px"></div><button class="btn" data-act="guardarLesion">Guardar</button>`);
  }

  // ── Generador de rutinas ──
  function vGenerar() {
    const u = U();
    if (!ui.gen) {
      const dolor = {}, pf = perfilEntreno(u); lesionesActivas(u).forEach(i => { dolor[i.zoneKey] = 0; });
      ui.gen = { lugar: pf.lugar, minutos: pf.minutos, objetivo: pf.objetivo, musculos: [], material: pf.lugar === 'casa' || pf.lugar === 'calle' ? pf.material.slice() : [], nivel: pf.nivel, prioridades: pf.prioridades.slice(), energia: 3, dolor, extra: '' };
    }
    const g = ui.gen;
    const mats = g.lugar === 'casa' || g.lugar === 'calle' ? Object.keys(L.MATERIAL).filter(m => m !== 'peso corporal' && window.EJERCICIOS.some(e => e.l.includes(g.lugar) && e.mat.includes(m))) : [];
    const musc = Object.keys(L.MUSCULOS).filter(m => window.EJERCICIOS.some(e => e.l.includes(g.lugar) && e.m[0] === m));
    const ch = (act, k, l, on) => `<button class="chip" data-act="${act}" data-arg="${k}" aria-pressed="${on}">${h(l)}</button>`;
    let out = `<p class="h-sub" style="margin-top:0">Rutina para <b>${h(window.PERSONAS[u].nombre)}</b>. Parte de tu perfil (${h(L.OBJETIVOS[perfilEntreno(u).objetivo].nombre.toLowerCase())}); lo que cambies aquí es solo para hoy. Solo ejercicios del catálogo (con vídeo) y seguros para tus lesiones. <a href="#perfil">Editar perfil</a></p>
      <div class="sec">Dónde</div><div class="chips">${Object.entries(window.LUGARES).map(([k, l]) => ch('gLugar', k, l, g.lugar === k)).join('')}</div>
      <div class="sec">Tiempo</div><div class="seg" role="group">${[20, 30, 45, 60].map(m => `<button data-act="gMin" data-arg="${m}" aria-pressed="${g.minutos === m}">${m} min</button>`).join('')}</div>
      <div class="sec">Objetivo</div><div class="chips">${Object.entries(L.OBJETIVOS).map(([k, o]) => ch('gObj', k, o.nombre, g.objetivo === k)).join('')}</div>
      ${g.lugar !== 'piscina' ? `<div class="sec">Músculos <span class="faint" style="text-transform:none;letter-spacing:0">opcional</span></div><div class="chips">${musc.map(m => ch('gMus', m, L.MUSCULOS[m], g.musculos.includes(m))).join('')}</div>` : ''}
      ${mats.length ? `<div class="sec">Material que tienes</div><div class="chips">${mats.map(m => ch('gMat', m, L.MATERIAL[m], g.material.includes(m))).join('')}</div><p class="hint">Sin marcar nada: solo ejercicios sin material.</p>` : ''}
      <div class="sec">Nivel</div><div class="seg" role="group">${[1, 2, 3].map(n => `<button data-act="gNivel" data-arg="${n}" aria-pressed="${g.nivel === n}">${L.NIVEL[n]}</button>`).join('')}</div>
      <div class="sec">Energía hoy</div><div class="scale" role="group">${['Agotado', 'Cansado', 'Normal', 'Bien', 'A tope'].map((l, i) => `<button data-act="gEnergia" data-arg="${i + 1}" aria-pressed="${g.energia === i + 1}"><b>${i + 1}</b>${l}</button>`).join('')}</div>
      ${Object.keys(g.dolor).length ? `<div class="sec">Dolor ahora</div><div class="stack">${Object.keys(g.dolor).map(z => `<div class="card" style="padding:12px 14px"><div class="row"><span class="grow" style="font-weight:600">${h(ZONAS[z].name)}</span><b id="gv-${z}">${g.dolor[z]}</b></div><input type="range" min="0" max="10" value="${g.dolor[z]}" data-in="gDolor" data-arg="${z}" aria-label="Dolor en ${h(ZONAS[z].name)}"></div>`).join('')}</div>` : ''}
      <div class="sec">Algo más <span class="faint" style="text-transform:none;letter-spacing:0">opcional</span></div><textarea class="input" data-in="gExtra" placeholder="Ej.: quiero acabar con algo de cardio, hoy me molesta la espalda al agacharme…">${h(g.extra)}</textarea>
      <div style="height:24px"></div>
      <button class="btn" data-act="generarIA" ${ui.genLoading ? 'disabled' : ''}>${ui.genLoading ? '<span class="spin"></span> Preparando…' : IC.spark + ' Crear con IA'}</button>
      <button class="btn-text block" data-act="generarLocal" ${ui.genLoading ? 'disabled' : ''}>Crear sin IA (reglas de la app)</button>
      <div id="genOut">${ui.genResult ? resultadoGen() : ''}</div>`;
    return out;
  }
  function resultadoGen() {
    const r = ui.genResult;
    return `<div class="card hero" style="margin-top:20px"><div class="card-title">${h(r.nombre)}</div><div class="card-sub">${h(r.foco)} · ${h(window.LUGARES[r.lugar])} · ${r.fuente === 'ia' ? 'Hecha con IA' : 'Hecha con reglas'}</div>${r.notas ? `<p style="font-size:14px;margin-top:8px">${h(r.notas)}</p>` : ''}</div>
      <div class="stack" style="margin-top:10px">${r.ej.map(([id, se, re, de, no, kg], i) => { const e = L.ex(id); return `<button class="lib-item" data-act="tecnica" data-arg="${id}"><span class="ex-num">${i + 1}</span><span class="grow"><span class="lib-name" style="display:block">${h(e.n)}</span><span class="lib-meta">${se} × ${h(re)}${kg != null && e.t === 'reps' ? ` · <b style="color:var(--ok)">${fmt(kg, 2)} kg</b>` : ''}${de ? ` · descanso ${de} s` : ''}</span>${no ? `<span class="faint" style="display:block">${h(no)}</span>` : ''}</span><span class="chev">›</span></button>`; }).join('')}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="genEmpezar">${IC.play} Empezar</button><button class="btn sec2" data-act="genGuardar">Guardar</button></div>`;
  }
  async function generarIA() {
    const u = U(), S = st(), g = ui.gen;
    ui.genLoading = true; render();
    try {
      const cuerpo = {
        persona: (() => { const bp = S.bodyProfile[u] || {}, pf = perfilEntreno(u), pesoAct = (S.bodyLog[u] || []).filter(x => x.weight).slice(-1)[0];
          return { nombre: window.PERSONAS[u].nombre, sexo: bp.sex === 'f' ? 'mujer' : 'hombre', alturaCm: bp.height || null, pesoKg: pesoAct ? pesoAct.weight : null,
            perfil: { objetivoPrincipal: L.OBJETIVOS[pf.objetivo].nombre, nivel: L.NIVEL[pf.nivel], diasPorSemana: pf.dias, minutosHabituales: pf.minutos, priorizar: pf.prioridades.map(m => L.MUSCULOS[m]), metaCuerpo: bp.goals || null } }; })(),
        lesiones: lesionesActivas(u).map(i => ({ zona: ZONAS[i.zoneKey].name, intensidad: ['', 'leve', 'moderada', 'fuerte'][i.severity], nota: i.note || '', evitar: ZONAS[i.zoneKey].danger_rules })),
        criterios: { lugar: window.LUGARES[g.lugar], minutos: g.minutos, objetivo: L.OBJETIVOS[g.objetivo].nombre, musculos: g.musculos.map(m => L.MUSCULOS[m]), material: g.material.map(m => L.MATERIAL[m]), nivel: L.NIVEL[g.nivel], energia: g.energia + '/5', dolorHoy: Object.fromEntries(Object.entries(g.dolor).map(([z, v]) => [ZONAS[z].name, v + '/10'])), peticion: g.extra },
        catalogo: L.catalogoParaAgente(S, u, g),
      };
      Object.assign(cuerpo, L.progresoParaAgente(S, u, cuerpo.catalogo.map(e => e.id), { energia: g.energia, niveles: L.nivelesZona(S, u, g.dolor) }));
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 90000);
      const r = await fetch(S.settings.apiUrl || '/api/rutina', { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-code': S.settings.code || '' }, body: JSON.stringify(cuerpo), signal: ctrl.signal });
      clearTimeout(to);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('error ' + r.status));
      ui.genResult = Object.assign(L.validarRutina(d.rutina || d, g.lugar), { fecha: new Date().toISOString() });
    } catch (e) {
      const motivo = !navigator.onLine ? 'sin conexión' : e.name === 'AbortError' ? 'tardó demasiado' : e.message;
      ui.genResult = Object.assign(L.generarLocal(S, u, g), { fecha: new Date().toISOString() });
      toast('No pude usar la IA (' + motivo + '). Te la he hecho con las reglas de la app.', 4500);
    }
    ui.genLoading = false; render();
    const o = $('#genOut'); o && o.scrollIntoView({ behavior: 'smooth' });
  }

  // ═════════════ ACCIONES ═════════════
  const A = {
    cerrarHoja, ir: r => { location.hash = r; },
    atras: () => { if (history.length > 1) history.back(); else location.hash = 'hoy'; },
    confirmarOk: () => { const f = pendiente; pendiente = null; cerrarHoja(); f && f(); },
    usuario: u => { st().user = u; Store.guardar(); ui.checkin = null; ui.gen = null; ui.genResult = null; render(); },

    irCheckin: ref => { const s = st().session; if (s && s.user === U()) return confirmar('Tienes una sesión a medias', `«${s.nombre}» sigue abierta. Si empiezas otra, la anterior se descarta.`, 'Empezar otra', () => { st().session = null; Store.guardar(); location.hash = 'checkin/' + encodeURIComponent(ref); }); location.hash = 'checkin/' + encodeURIComponent(ref); },
    ciEnergia: n => { ui.checkin.energia = +n; render(); },
    ciTiempo: t => { ui.checkin.tiempo = t; render(); },
    ciZona: z => { ui.checkin.dolor[z] = 3; render(); },
    empezar: () => { const d = rutina(ui.checkin.ref); if (!d) return; crearSesion(d, ui.checkin); ui.checkin = null; pantallaEncendida(true); location.hash = 'sesion'; },

    abrirEj: i => { ui.openEx = ui.openEx === +i ? -1 : +i; render(); },
    tarea: (a, el) => {
      const [t, i] = a.split(':'), l = st().session[t === 'c' ? 'calent' : 'vuelta'];
      l[+i].ok = !l[+i].ok; Store.guardar(); el.setAttribute('aria-pressed', l[+i].ok);
      const sum = el.closest('details').querySelector('summary'); sum.textContent = sum.textContent.replace(/\d+\/(\d+)$/, `${l.filter(x => x.ok).length}/$1`);
    },
    serie: a => {
      const [i, j] = a.split(':').map(Number), s = st().session, x = s.exercises[i], t = x.sets[j];
      t.done = !t.done;
      if (t.done) { if (t.weight === '' && t.pw) t.weight = t.pw; if (t.reps === '') t.reps = t.pr || String(x.reps).replace(/[^\d].*$/, '') || ''; vibrar(15); }
      x.done = x.sets.every(z => z.done);
      Store.guardar();
      if (t.done && st().settings.autoRest && !x.done && x.rest) iniciarDescanso(x.rest, L.ex(x.exId).n);
      if (x.done) { pararDescanso(); const sig = s.exercises.findIndex(z => !z.done); ui.openEx = sig; if (sig < 0) toast('¡Todos los ejercicios hechos! Haz la vuelta a la calma y pulsa Terminar.', 4000); }
      render();
    },
    masSerie: i => { const x = st().session.exercises[+i], u = x.sets[x.sets.length - 1] || {}; x.sets.push({ weight: '', reps: '', done: false, pw: u.weight || u.pw || '', pr: u.pr || '' }); x.done = false; Store.guardar(); render(); },
    menosSerie: i => { const x = st().session.exercises[+i]; if (x.sets.length > 1) x.sets.pop(); x.done = x.sets.every(z => z.done); Store.guardar(); render(); },
    timerMas: () => { if (timer) timer.fin += 15000; },
    timerFin: pararDescanso,
    tecnica: id => fichaTecnica(id),
    video: (_, el) => { const v = el.closest('.video'); v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.dataset.video)}?autoplay=1&rel=0&playsinline=1" title="Vídeo del ejercicio" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; },
    cambiar: i => {
      const s = st().session, x = s.exercises[+i], e = L.ex(x.exId), niv = L.nivelesZona(st(), U(), s.checkin.dolor);
      const usados = s.exercises.map(z => z.exId);
      let alts = L.alternativas(e, s.lugar, niv, usados); const pocas = alts.length < 3;
      if (pocas) alts = alts.concat(L.alternativas(e, s.lugar, niv, usados.concat(alts.map(a => a.id)), true).filter(a => a.m.some(m => e.m.concat(e.s || []).includes(m))));
      hoja(`<h2>Cambiar ${h(e.n)}</h2><p class="faint" style="margin:6px 0 14px">Alternativas para ${h(window.LUGARES[s.lugar].toLowerCase())} que trabajan lo mismo y son seguras para ti hoy.</p>
        <div class="stack">${alts.slice(0, 8).map(a => `<button class="lib-item" data-act="cambiarA" data-arg="${i}:${a.id}"><span class="lib-thumb" style="background-image:url(https://i.ytimg.com/vi/${h(a.v)}/mqdefault.jpg)"></span><span class="grow"><span class="lib-name" style="display:block">${h(a.n)}</span><span class="lib-meta">${a.m.map(m => L.MUSCULOS[m]).join(', ')} · ${a.mat.map(m => L.MATERIAL[m]).join(', ')}</span></span></button>`).join('') || '<div class="empty">No hay alternativas seguras aquí. Puedes quitar series con el botón −.</div>'}</div>`);
    },
    cambiarA: a => {
      const [i, id] = a.split(':'), s = st().session, x = s.exercises[+i], e = L.ex(id), ant = L.ex(x.exId);
      s.ajustes.push(`${ant.n} → ${e.n} (cambio manual)`);
      const niv = L.nivelesZona(st(), U(), s.checkin.dolor), reps = e.t === ant.t ? x.reps : e.d[1];
      const sg = L.sugerir(st(), U(), id, { series: x.sets.length, reps, desc: x.rest }, { energia: s.checkin.energia, niveles: niv, tiempo: s.checkin.tiempo });
      Object.assign(x, { exId: id, name: e.n, cambio: ant.n, nota: '', precaucion: L.riesgo(e, niv) === 'precaucion', reps: sg.reps, sug: sg, sets: setsSugeridos(sg, e), done: false });
      Store.guardar(); cerrarHoja(); render();
    },
    terminar: () => {
      const s = st().session, zonas = Object.keys(s.checkin.dolor || {});
      hoja(`<h2>Terminar sesión</h2>
        <div class="sec">¿Qué tal ha ido?</div><div class="scale" role="group" id="f-esf">${['Muy fácil', 'Fácil', 'Bien', 'Duro', 'Al límite'].map((l, i) => `<button data-act="fEsf" data-arg="${i + 1}" aria-pressed="${i === 2}"><b>${i + 1}</b>${l}</button>`).join('')}</div>
        ${zonas.length ? `<div class="sec">Dolor al acabar</div>${zonas.map(z => `<div class="row" style="margin-bottom:8px"><span class="grow">${h(ZONAS[z].name)}</span><b id="fv-${z}">${s.checkin.dolor[z]}</b></div><input type="range" min="0" max="10" value="${s.checkin.dolor[z]}" data-fz="${z}" data-in="fDolor" data-arg="${z}" aria-label="Dolor al acabar en ${h(ZONAS[z].name)}">`).join('')}` : ''}
        <div class="sec">Nota</div><textarea class="input" id="f-nota" placeholder="Cómo te has sentido, qué cambiar la próxima vez…"></textarea>
        <div style="height:14px"></div><button class="btn" data-act="guardarSesion">Guardar sesión</button>
        <button class="btn-text danger block" data-act="descartarSesion">Descartar sin guardar</button>`);
    },
    fEsf: (n, el) => { el.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === el)); },
    guardarSesion: () => {
      const S = st(), s = S.session;
      const esf = +(document.querySelector('#f-esf [aria-pressed="true"]') || { dataset: { arg: 3 } }).dataset.arg;
      const despues = {}; document.querySelectorAll('[data-fz]').forEach(i => { despues[i.dataset.fz] = +i.value; });
      const nota = ($('#f-nota') || {}).value || '';
      S.workouts[s.key] = { key: s.key, user: s.user, day: s.day, nombre: s.nombre, lugar: s.lugar, date: s.date, completed: true, completedAt: new Date().toISOString(),
        exercises: s.exercises.map(x => ({ name: x.name, exId: x.exId, sets: x.sets.map(t => ({ weight: t.weight, reps: t.reps, done: t.done })) })),
        feedback: { esfuerzo: esf, nota }, checkin: s.checkin, ajustes: s.ajustes };
      if (Object.keys(s.checkin.dolor || {}).length) S.painLog.push({ date: new Date().toISOString(), user: s.user, antes: s.checkin.dolor, despues, energia: s.checkin.energia });
      S.session = null; Store.guardar(); pararDescanso(); pantallaEncendida(false); cerrarHoja();
      toast('Sesión guardada. ¡Buen trabajo!'); location.hash = 'hoy';
    },
    descartarSesion: () => { cerrarHoja(); confirmar('¿Descartar la sesión?', 'Se pierde lo que has apuntado hoy.', 'Descartar', () => { st().session = null; Store.guardar(); pararDescanso(); pantallaEncendida(false); location.hash = 'hoy'; }, true); },

    libF: a => { const [k, v] = a.split(':'); ui.lib[k] = v; if (k === 'lugar') { const f = Object.assign({}, ui.lib); if (f.musculo && !filtrar(f).length) ui.lib.musculo = ''; if (ui.lib.material && !filtrar(ui.lib).length) ui.lib.material = ''; } render(); },
    libSeguro: () => { ui.lib.seguro = !ui.lib.seguro; render(); },
    libReset: () => { ui.lib = { lugar: '', musculo: '', material: '', nivel: 0, seguro: false, q: '' }; render(); },

    progTab: t => { ui.prog = t; render(); },
    metric: m => { ui.metric = m; render(); },
    registroCuerpo: formCuerpo,
    guardarCuerpo: () => {
      const u = U(), S = st(), v = id => num(($('#' + id) || {}).value);
      S.bodyProfile[u] = Object.assign({}, S.bodyProfile[u], { sex: $('#b-sex').value, height: v('b-height') });
      const e = { date: new Date().toISOString(), weight: v('b-weight'), bodyFat: v('b-fat'), neck: v('b-neck'), waist: v('b-waist'), hip: v('b-hip'), chest: v('b-chest'), arm: v('b-arm'), thigh: v('b-thigh') };
      Object.keys(e).forEach(k => e[k] == null && delete e[k]);
      if (Object.keys(e).length === 1) { Store.guardar(); cerrarHoja(); toast('Perfil guardado. Apunta al menos el peso o una medida para crear un registro.'); render(); return; }
      const i = S.bodyLog[u].findIndex(x => (x.date || '').slice(0, 10) === hoyISO());
      if (i >= 0) S.bodyLog[u][i] = e; else S.bodyLog[u].push(e);
      Store.guardar(); cerrarHoja(); toast('Registro guardado'); render();
    },
    borrarCuerpo: i => confirmar('¿Borrar este registro?', 'No se puede deshacer.', 'Borrar', () => { st().bodyLog[U()].splice(+i, 1); Store.guardar(); render(); }, true),
    objetivos: () => {
      const g = (st().bodyProfile[U()] || {}).goals || {};
      hoja(`<h2>Objetivos</h2><div class="grid2" style="margin-top:14px"><div><label class="f" for="g-w">Peso (kg)</label><input class="input" id="g-w" inputmode="decimal" value="${g.weight == null ? '' : g.weight}"></div><div><label class="f" for="g-f">% grasa</label><input class="input" id="g-f" inputmode="decimal" value="${g.bodyFat == null ? '' : g.bodyFat}"></div></div><div style="height:14px"></div><button class="btn" data-act="guardarObjetivos">Guardar</button>`);
    },
    guardarObjetivos: () => { const p = st().bodyProfile[U()] = st().bodyProfile[U()] || {}; p.goals = { weight: num($('#g-w').value), bodyFat: num($('#g-f').value) }; Store.guardar(); cerrarHoja(); render(); },
    verFoto: async id => { const p = (await Store.fotos.all()).find(x => x.id === id); if (!p) return; hoja(`<h2>${fecha(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</h2><img src="${p.data}" alt="Foto de progreso" style="width:100%;border-radius:14px;margin:14px 0"><button class="btn danger" data-act="borrarFoto" data-arg="${h(id)}">Borrar foto</button>`); },
    borrarFoto: id => { cerrarHoja(); confirmar('¿Borrar esta foto?', 'No se puede deshacer.', 'Borrar', async () => { await Store.fotos.del(id); render(); }, true); },

    nuevaLesion: formLesion,
    lSev: (n, el) => { el.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === el)); },
    guardarLesion: () => {
      const u = U(), z = $('#l-zona').value, sev = +($('#l-sev [aria-pressed="true"]') || { dataset: { arg: 2 } }).dataset.arg;
      st().injuries[u].push({ id: 'inj_' + Date.now(), zoneKey: z, severity: sev, note: $('#l-nota').value.trim(), active: true, since: new Date().toISOString() });
      Store.guardar(); cerrarHoja(); toast('Lesión añadida. Ajustaré las sesiones.'); render();
    },
    lesionSev: a => { const [i, n] = a.split(':').map(Number); st().injuries[U()][i].severity = n; Store.guardar(); render(); },
    lesionCurar: i => { const l = st().injuries[U()][+i]; l.active = false; l.healedAt = new Date().toISOString(); Store.guardar(); toast('¡Bien! Marcada como superada.'); render(); },
    lesionActivar: i => { const l = st().injuries[U()][+i]; l.active = true; delete l.healedAt; Store.guardar(); render(); },
    lesionBorrar: i => confirmar('¿Borrar esta lesión?', 'Si ya está curada, mejor márcala como superada para conservar el historial.', 'Borrar', () => { st().injuries[U()].splice(+i, 1); Store.guardar(); render(); }, true),
    autoRest: () => { st().settings.autoRest = !st().settings.autoRest; Store.guardar(); render(); },
    exportar: () => {
      const d = Store.exportar(), b = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), url = URL.createObjectURL(b), a = document.createElement('a');
      a.href = url; a.download = 'ElPlan-copia-' + hoyISO() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Copia descargada. Guárdala en tu nube.'); render();
    },
    borrarTodo: () => confirmar('¿Borrar todos los datos?', 'Se borran sesiones, medidas, fotos y lesiones de los dos. Descarga antes una copia si quieres conservarlos.', 'Borrar todo', () => { Store.borrarTodo(); toast('Datos borrados'); location.hash = 'hoy'; render(); }, true),
    borrarRutina: id => confirmar('¿Borrar esta rutina?', 'Solo se borra la rutina guardada, no las sesiones que hiciste con ella.', 'Borrar', () => { const l = st().routines[U()]; l.splice(l.findIndex(r => r.id === id), 1); Store.guardar(); render(); }, true),

    gLugar: l => { ui.gen.lugar = l; ui.gen.material = l === 'casa' || l === 'calle' ? perfilEntreno(U()).material.slice() : []; ui.gen.musculos = []; ui.genResult = null; render(); },
    gMin: m => { ui.gen.minutos = +m; render(); },
    gObj: o => { ui.gen.objetivo = o; render(); },
    crearPlanIA,
    planReglas: () => confirmar('¿Volver al plan de reglas?', 'Se borra el plan del entrenador IA. Puedes pedir otro cuando quieras.', 'Usar reglas', () => { L.borrarPlanIA(st(), U()); Store.guardar(); render(); }),
    pfObj: o => guardarPerfil({ objetivo: o }),
    pfNivel: n => guardarPerfil({ nivel: +n }),
    pfLugar: l => guardarPerfil({ lugar: l }),
    pfMin: m => guardarPerfil({ minutos: +m }),
    pfDias: n => guardarPerfil({ dias: +n }),
    pfPrio: m => { const l = perfilEntreno(U()).prioridades; guardarPerfil({ prioridades: l.includes(m) ? l.filter(x => x !== m) : l.concat(m).slice(-3) }); },
    pfMat: m => { const l = perfilEntreno(U()).material; guardarPerfil({ material: l.includes(m) ? l.filter(x => x !== m) : l.concat(m) }); },
    gNivel: n => { ui.gen.nivel = +n; render(); },
    gEnergia: n => { ui.gen.energia = +n; render(); },
    gMus: m => { const l = ui.gen.musculos; l.includes(m) ? l.splice(l.indexOf(m), 1) : l.push(m); render(); },
    gMat: m => { const l = ui.gen.material; l.includes(m) ? l.splice(l.indexOf(m), 1) : l.push(m); render(); },
    generarIA,
    generarLocal: () => { ui.genResult = Object.assign(L.generarLocal(st(), U(), ui.gen), { fecha: new Date().toISOString() }); render(); const o = $('#genOut'); o && o.scrollIntoView({ behavior: 'smooth' }); },
    genGuardar: () => { const r = Object.assign({ id: 'r' + Date.now() }, ui.genResult); st().routines[U()].unshift(r); Store.guardar(); toast('Guardada en «Rutinas a medida»'); },
    genEmpezar: () => {
      const g = ui.gen, d = Object.assign({ ref: 'G' }, ui.genResult);
      if (st().session && st().session.user === U()) st().session = null;
      crearSesion(d, { energia: g.energia, tiempo: 'completo', dolor: Object.assign({}, g.dolor) }); pantallaEncendida(true); location.hash = 'sesion';
    },
  };

  const IN = {
    ciDolor: (el, z) => { ui.checkin.dolor[z] = +el.value; $('#dv-' + z).textContent = el.value; pintarPrevia(); },
    gDolor: (el, z) => { ui.gen.dolor[z] = +el.value; $('#gv-' + z).textContent = el.value; },
    fDolor: (el, z) => { $('#fv-' + z).textContent = el.value; },
    gExtra: el => { ui.gen.extra = el.value.slice(0, 500); },
    setPeso: (el, a) => { const [i, j] = a.split(':').map(Number); st().session.exercises[i].sets[j].weight = el.value.replace(',', '.'); Store.guardar(); },
    setReps: (el, a) => { const [i, j] = a.split(':').map(Number); st().session.exercises[i].sets[j].reps = el.value; Store.guardar(); },
    libQ: el => { ui.lib.q = el.value; pintarLista(); },
    libMat: el => { ui.lib.material = el.value; render(); },
    libNivel: el => { ui.lib.nivel = +el.value; render(); },
    fuerzaId: el => { ui.fuerzaId = el.value; render(); },
    iaCode: el => { st().settings.code = el.value.trim(); Store.guardar(); },
    iaUrl: el => { st().settings.apiUrl = el.value.trim() || '/api/rutina'; Store.guardar(); },
    foto: el => {
      const file = el.files && el.files[0]; if (!file) return;
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = async () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        await Store.fotos.put({ id: 'ph_' + Date.now(), user: U(), date: new Date().toISOString(), data: c.toDataURL('image/jpeg', 0.75) });
        toast('Foto guardada'); pintarFotos();
      };
      img.src = url;
    },
    importar: el => {
      const file = el.files && el.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          const n = Store.importar(d);
          toast(`Importado: ${n.sesiones} sesiones, ${n.cuerpo} medidas, ${n.dolor} registros de dolor${n.lesiones ? `, ${n.lesiones} lesiones` : ''}.`, 5000);
          render();
        } catch (e) { toast('No se pudo leer el archivo. ¿Es una copia de El Plan?', 4000); }
      };
      r.readAsText(file); el.value = '';
    },
  };

  // ── Arranque ──
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el) { if (ev.target.id === 'sheet') cerrarHoja(); return; }
    const f = A[el.dataset.act]; if (f) { ev.preventDefault(); f(el.dataset.arg, el, ev); }
  });
  document.addEventListener('input', ev => { const el = ev.target.closest('[data-in]'); if (el && IN[el.dataset.in] && el.type !== 'file' && el.tagName !== 'SELECT') IN[el.dataset.in](el, el.dataset.arg); });
  document.addEventListener('change', ev => { const el = ev.target.closest('[data-in]'); if (el && IN[el.dataset.in] && (el.type === 'file' || el.tagName === 'SELECT')) IN[el.dataset.in](el, el.dataset.arg); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#sheet').classList.contains('open')) cerrarHoja(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st() && st().session && ruta().r === 'sesion') pantallaEncendida(true); });
  window.addEventListener('hashchange', () => { cerrarHoja(); window.scrollTo(0, 0); render(); });

  Store.cargar().then(() => {
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})();
