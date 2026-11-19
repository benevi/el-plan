// Plan semanal de cada persona.
// Orden de preferencia: 1) el plan que hizo el entrenador IA (si sigue valiendo para el perfil y las lesiones de ahora),
// 2) un plan hecho con reglas de entrenamiento a partir del perfil, 3) el plan original (plan.js) mientras no hay perfil.
// Casa, Calistenia y Piscina del plan original están siempre disponibles, y la piscina se propone el fin de semana.
// Cada día lleva su calentamiento, su trabajo de rehabilitación si hay lesiones y su vuelta a la calma.
(function () {
  const L = window.L, E = window.EJERCICIOS, ZONAS = window.INJURY_ZONES;
  const POR_ID = Object.fromEntries(E.map(e => [e.id, e]));

  const PERFIL_BASE = { objetivo: 'musculo', nivel: 2, lugar: 'gym', minutos: 45, dias: 3, prioridades: [], material: [] };
  const bp = (S, u) => (S.bodyProfile || {})[u] || {};
  function perfilEntreno(S, u) { return Object.assign({}, PERFIL_BASE, bp(S, u).entreno || {}); }
  const tienePerfil = (S, u) => !!bp(S, u).entreno;
  const lesionesActivas = (S, u) => ((S.injuries || {})[u] || []).filter(i => i.active);
  // Lo que hace que un plan deje de valer: el perfil o las lesiones.
  function clavePlan(S, u) {
    return JSON.stringify(perfilEntreno(S, u)) + '|' + lesionesActivas(S, u).map(i => i.zoneKey + i.severity).sort().join(',');
  }

  // ── Criterio de entrenamiento ──
  // Series semanales por músculo (rango orientativo) según objetivo.
  const VOLUMEN = { musculo: [10, 16], fuerza: [8, 12], tono: [8, 12], perder: [6, 10], recuperacion: [4, 8] };
  const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];

  const DIAS = {
    empuje: { nombre: 'Empuje', huecos: ['pecho', 'hombro', 'pecho', 'triceps', 'hombro', 'core', 'triceps'] },
    tiron: { nombre: 'Tirón', huecos: ['espalda', 'espalda', 'isquios', 'biceps', 'hombro', 'core', 'biceps'] },
    pierna: { nombre: 'Pierna', huecos: ['cuadriceps', 'gluteo', 'isquios', 'cuadriceps', 'gemelo', 'core', 'gluteo'] },
    torso: { nombre: 'Torso', huecos: ['pecho', 'espalda', 'hombro', 'espalda', 'triceps', 'biceps', 'core'] },
    piernaB: { nombre: 'Pierna y core', huecos: ['gluteo', 'cuadriceps', 'isquios', 'gluteo', 'core', 'gemelo', 'core'] },
    fullA: { nombre: 'Cuerpo completo', huecos: ['cuadriceps', 'espalda', 'pecho', 'isquios', 'hombro', 'core', 'gluteo'] },
    fullB: { nombre: 'Cuerpo completo', huecos: ['gluteo', 'pecho', 'espalda', 'cuadriceps', 'triceps', 'core', 'biceps'] },
    fullC: { nombre: 'Cuerpo completo', huecos: ['isquios', 'espalda', 'hombro', 'cuadriceps', 'pecho', 'core', 'gluteo'] },
    salud: { nombre: 'Salud y movilidad', huecos: ['gluteo', 'espalda', 'core', 'cuadriceps', 'hombro', 'core'] },
    piscina: { nombre: 'Piscina', huecos: ['cardio', 'natacion', 'natacion', 'gluteo', 'natacion', 'cardio'] },
  };
  function reparto(p) {
    const d = Math.max(2, Math.min(6, +p.dias || 3));
    if (p.lugar === 'piscina') return Array(d).fill('piscina');
    if (p.objetivo === 'recuperacion') return Array.from({ length: d }, (_, i) => i % 2 ? 'fullA' : 'salud');
    const full = ['fullA', 'fullB', 'fullC'];
    if (p.objetivo === 'perder' || p.objetivo === 'tono' || d === 2) return Array.from({ length: d }, (_, i) => full[i % 3]);
    return { 3: ['empuje', 'tiron', 'pierna'], 4: ['torso', 'pierna', 'torso', 'piernaB'], 5: ['empuje', 'tiron', 'pierna', 'torso', 'piernaB'], 6: ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna'] }[d];
  }
  // Días de la semana (0 domingo … 6 sábado) con descanso entre medias.
  const HORARIO = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

  // Ejercicios base de cada músculo, de más a menos preferido.
  const BASE = {
    pecho: ['press-pecho-maquina', 'press-banca-mancuernas', 'press-inclinado-mancuernas', 'press-banca-barra', 'press-inclinado-maquina', 'flexiones', 'flexiones-inclinadas', 'flexiones-rodillas'],
    espalda: ['jalon-pecho', 'remo-sentado-polea', 'remo-mancuerna', 'dominadas-asistidas-maquina', 'remo-maquina', 'dominadas', 'remo-australiano', 'remo-banda', 'jalon-banda', 'remo-toalla'],
    hombro: ['press-hombro-maquina', 'press-militar-mancuernas', 'elevaciones-laterales', 'elevaciones-laterales-maquina', 'face-pull', 'pajaros', 'press-hombro-botellas', 'elevaciones-laterales-banda', 'face-pull-banda'],
    cuadriceps: ['prensa-piernas', 'sentadilla-goblet', 'sentadilla-smith', 'extension-cuadriceps', 'sentadilla-peso-corporal', 'zancadas', 'step-up'],
    gluteo: ['hip-thrust', 'gluteo-maquina', 'puente-gluteo', 'abductor-maquina', 'patada-gluteo-polea', 'puente-banda-rodillas', 'abduccion-sentada-banda'],
    isquios: ['peso-muerto-rumano', 'curl-femoral-tumbado', 'curl-femoral-sentado', 'puente-talones-elevados', 'hiperextension-45', 'curl-femoral-deslizante'],
    biceps: ['curl-mancuernas', 'curl-polea', 'curl-martillo', 'curl-maquina', 'curl-botellas'],
    triceps: ['extension-triceps-polea', 'fondos-asistidos-maquina', 'triceps-maquina', 'extension-triceps-cabeza', 'fondos-banco', 'extension-triceps-banda'],
    core: ['plancha', 'pallof-press', 'dead-bug', 'plancha-lateral', 'crunch-maquina', 'bird-dog', 'crunch'],
    gemelo: ['talones-pie', 'talones-prensa', 'talones-sentado'],
  };
  const extra = (m, id) => { const i = (BASE[m] || []).indexOf(id); return i < 0 ? 0 : 10 - i; };

  // Rehabilitación y prevención por zona: ejercicios que fortalecen lo que está lesionado (no solo quitar lo que duele).
  const REHAB = {
    cadera_lateral: { que: 'glúteo medio', ids: ['abductor-maquina', 'abduccion-isometrica-pared', 'almeja', 'abduccion-sentada-banda', 'puente-gluteo', 'abduccion-tumbada', 'elevacion-lateral-pierna-agua', 'elevacion-atras-pierna-agua', 'marcha-lateral-agua'] },
    rodilla: { que: 'cuádriceps y glúteo sin impacto', ids: ['sentadilla-isometrica', 'puente-gluteo', 'puente-talones-elevados', 'abduccion-isometrica-pared', 'sentadilla-agua'] },
    hombro: { que: 'manguito rotador y escápulas', ids: ['rotacion-externa-banda', 'face-pull', 'face-pull-banda', 'ytw-tumbado', 'separacion-banda'] },
    lumbar: { que: 'core y glúteo (estabilidad)', ids: ['dead-bug', 'bird-dog', 'pallof-press', 'puente-gluteo'] },
    cervical: { que: 'parte alta de la espalda', ids: ['separacion-banda', 'face-pull', 'ytw-tumbado', 'face-pull-banda'] },
    tobillo_pie: { que: 'gemelo y tobillo', ids: ['talones-sentado', 'talones-pie', 'movilidad-tobillo-pared'] },
    codo: { que: 'hombro y escápulas (sin cargar el codo)', ids: ['rotacion-externa-banda', 'separacion-banda'] },
    'muñeca': { que: 'estabilidad sin apoyar en las manos', ids: ['dead-bug', 'pallof-press'] },
  };

  // Series, repeticiones y descanso según objetivo y tipo de ejercicio.
  function dosis(e, p, i) {
    if (e.t !== 'reps' || e.m[0] === 'movilidad') return [e.d[0], e.d[1], e.d[2]];
    const aisl = /aperturas|cruces|elevaciones|curl|extension|patada|abduc|talones|crunch/.test(e.id) || !(e.s || []).length;
    const grande = i < 2 && !aisl;
    const peq = aisl || ['core', 'gemelo', 'biceps', 'triceps'].includes(e.m[0]);
    const lado = / c\//.test(e.d[1]) ? ' c/' + e.d[1].split(' c/')[1] : '';
    switch (p.objetivo) {
      case 'fuerza': return grande ? [4, '5-6' + lado, 150] : peq ? [3, '10-12' + lado, 60] : [3, '6-8' + lado, 120];
      case 'perder': return [3, (peq ? '15-20' : '10-15') + lado, grande ? 60 : 40];
      case 'tono': return [3, (peq ? '15-20' : '12-15') + lado, 45];
      case 'recuperacion': return [2, '12-15' + lado, 45];
      default: return grande ? [4, '6-10' + lado, 120] : peq ? [3, '12-15' + lado, 60] : [3, '8-12' + lado, 90];
    }
  }

  // ── Calentamiento y vuelta a la calma de cada día ──
  const CARDIO_SUAVE = { gym: ['bici-estatica', 'eliptica', 'cinta-inclinada', 'remo-ergometro'], casa: ['jumping-jacks-sin-salto', 'step-bajo', 'boxeo-sombra'], calle: ['marcha-rapida', 'jumping-jacks-sin-salto', 'boxeo-sombra'], piscina: ['caminar-agua', 'aquajogging'] };
  // Movilidad/estiramientos: su músculo objetivo es el primero de los secundarios.
  const toca = (e, ms) => ms.includes((e.s || [])[0]);
  function calentamiento(lugar, musculos, niveles, lesiones, primero) {
    const ok = id => POR_ID[id] && POR_ID[id].l.includes(lugar) && L.riesgo(POR_ID[id], niveles) === 'ok';
    const out = [];
    const c = (CARDIO_SUAVE[lugar] || []).find(ok) || (CARDIO_SUAVE[lugar] || []).find(id => POR_ID[id] && L.riesgo(POR_ID[id], niveles) !== 'evitar');
    if (c) out.push({ n: POR_ID[c].n, d: 'Ritmo suave, que puedas hablar. Sube poco a poco la temperatura.', t: lugar === 'piscina' ? '5 min' : '5-8 min', id: c });
    E.filter(e => e.m[0] === 'movilidad' && e.t === 'reps' && ok(e.id) && toca(e, musculos)).slice(0, 3)
      .forEach(e => out.push({ n: e.n, d: 'Movilidad dinámica: movimientos controlados, sin rebotes.', t: e.d[1], id: e.id }));
    lesiones.forEach(i => (ZONAS[i.zoneKey].warmup_rec || []).slice(0, 2).forEach(t => { if (!out.some(x => x.n === t || t.toLowerCase().startsWith(x.n.toLowerCase().split(' ').slice(0, 2).join(' ')))) out.push({ n: t, d: 'Por tu lesión de ' + (L.ZONA_CORTA[i.zoneKey] || '').toLowerCase() + '.', t: '' }); }));
    if (primero && primero.t === 'reps' && lugar !== 'piscina') out.push({ n: 'Series de aproximación: ' + primero.n, d: '2 series ligeras (10 reps al 40 % y 5 reps al 70 % del peso de trabajo) antes de empezar.', t: '2 min' });
    return out;
  }
  function vueltaCalma(lugar, musculos, niveles, lesiones, objetivo) {
    const ok = id => POR_ID[id] && POR_ID[id].l.includes(lugar) && L.riesgo(POR_ID[id], niveles) === 'ok';
    const out = [];
    if (objetivo === 'perder' && lugar !== 'piscina') {
      const c = (CARDIO_SUAVE[lugar] || []).find(ok);
      if (c) out.push({ n: POR_ID[c].n + ' suave', d: 'Cardio de baja intensidad para sumar gasto sin cansarte más.', t: '10-15 min', id: c });
    }
    E.filter(e => e.m[0] === 'movilidad' && e.t === 'tiempo' && ok(e.id) && toca(e, musculos)).slice(0, 4)
      .forEach(e => out.push({ n: e.n, d: 'Estiramiento suave y mantenido, respirando hondo. Sin dolor.', t: e.d[1], id: e.id }));
    lesiones.forEach(i => (ZONAS[i.zoneKey].stretch_rec || []).slice(0, 2).forEach(t => { if (!out.some(x => x.n === t)) out.push({ n: t, d: 'Por tu lesión de ' + (L.ZONA_CORTA[i.zoneKey] || '').toLowerCase() + '.', t: '30 s c/lado' }); }));
    if (!out.length) out.push({ n: 'Respiración y movilidad suave', d: 'Camina o muévete suave y respira profundo hasta que bajen las pulsaciones.', t: '3 min' });
    return out;
  }

  // ── Plan con reglas ──
  function planReglas(S, u) {
    const p = perfilEntreno(S, u);
    const niveles = L.nivelesZona(S, u, {});
    const lesiones = lesionesActivas(S, u);
    const enCasa = p.lugar === 'casa' || p.lugar === 'calle';
    const matOk = e => !enCasa || e.mat.some(m => m === 'peso corporal' || p.material.includes(m));
    const pool = E.filter(e => e.l.includes(p.lugar) && L.riesgo(e, niveles) !== 'evitar' && matOk(e) && e.niv <= (p.nivel || 2));
    const nEj = { 20: 4, 30: 5, 45: 6, 60: 7 }[p.minutos] || 6;
    const usados = {};
    const tipos = reparto(p);
    const dias = {};
    tipos.forEach((tipo, k) => {
      const plantilla = DIAS[tipo];
      let huecos = plantilla.huecos.slice();
      // Si la rehabilitación ya trabaja ese músculo (p. ej. glúteo medio en la cadera), no se añade otro hueco.
      const cubre = m => m === 'gluteo' && lesiones.some(i => i.zoneKey === 'cadera_lateral' || i.zoneKey === 'rodilla' || i.zoneKey === 'lumbar');
      (p.prioridades || []).forEach(m => { if (!cubre(m) && (tipo.startsWith('full') || tipo === 'salud' || huecos.includes(m))) huecos.splice(Math.min(2, huecos.length), 0, m); });
      huecos = huecos.slice(0, nEj + ((p.prioridades || []).length ? 1 : 0));
      const elegidos = [];
      huecos.forEach((m, i) => {
        const cands = pool.filter(e => e.m[0] === m && !elegidos.includes(e) && (e.t === 'reps' || ['core', 'cardio', 'natacion', 'gluteo'].includes(m)));
        if (!cands.length) return;
        const nota = e => (usados[e.id] || 0) * -12 + extra(m, e.id) + (i < 2 ? (e.s || []).length : 0) + (L.riesgo(e, niveles) === 'precaucion' ? -4 : 0) + (e.t === 'reps' ? 1 : 0);
        const e = cands.sort((a, b) => nota(b) - nota(a) || a.id.localeCompare(b.id))[0];
        elegidos.push(e); usados[e.id] = (usados[e.id] || 0) + 1;
      });
      const ej = elegidos.map((e, i) => { const [se, re, de] = dosis(e, p, i); return [e.id, se, re, de, '']; });
      // Rehabilitación: 1 ejercicio por lesión (2 si solo hay una), al principio, como activación. Va rotando entre días.
      const rehab = [];
      lesiones.forEach(les => {
        const R = REHAB[les.zoneKey]; if (!R) return;
        const cands = R.ids.map(id => POR_ID[id]).filter(e => e && e.l.includes(p.lugar) && L.riesgo(e, niveles) !== 'evitar' && matOk(e) && !elegidos.includes(e) && !rehab.some(x => x[0] === e.id));
        const n = lesiones.length === 1 ? 2 : 1;
        for (let j = 0; j < n && cands.length; j++) {
          const e = cands[(k * n + j) % cands.length];
          rehab.push([e.id, e.t === 'reps' ? 3 : Math.min(3, e.d[0]), e.t === 'reps' ? (/ c\//.test(e.d[1]) ? e.d[1] : '12-15') : e.d[1], 45, `Rehabilitación (${R.que}): carga progresiva, el dolor no debe pasar de 3/10.`]);
        }
      });
      const todos = rehab.concat(ej);
      const musculos = [...new Set(elegidos.map(e => e.m[0]))];
      const letra = String.fromCharCode(65 + k);
      dias[letra] = {
        nombre: `Día ${letra} · ${plantilla.nombre}`,
        foco: musculos.filter(m => !['cardio', 'movilidad', 'natacion'].includes(m)).slice(0, 4).map(m => L.MUSCULOS[m]).join(', ') + (rehab.length ? ' + rehabilitación' : ''),
        lugar: p.lugar, objetivo: p.objetivo, ej: todos,
        calent: calentamiento(p.lugar, musculos.concat(lesiones.length ? ['gluteo'] : []), niveles, lesiones, elegidos[0]),
        vuelta: vueltaCalma(p.lugar, musculos, niveles, lesiones, p.objetivo),
      };
    });
    // Volumen semanal: sube series donde un músculo grande se queda corto para el objetivo.
    const [vMin] = VOLUMEN[p.objetivo] || VOLUMEN.musculo;
    const vol = () => { const v = {}; Object.values(dias).forEach(d => d.ej.forEach(([id, se]) => { const e = POR_ID[id]; if (!e || e.t !== 'reps') return; v[e.m[0]] = (v[e.m[0]] || 0) + se; (e.s || []).forEach(m => { v[m] = (v[m] || 0) + se / 2; }); })); return v; };
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const v = vol(); let cambio = false;
      GRANDES.forEach(m => {
        if ((v[m] || 0) >= vMin) return;
        Object.values(dias).forEach(d => d.ej.forEach(x => { const e = POR_ID[x[0]]; if (e && e.m[0] === m && e.t === 'reps' && x[1] < 5 && !/Rehabilitación/.test(x[4])) { x[1]++; cambio = true; } }));
      });
      if (!cambio) break;
    }
    const volumen = vol();
    const horario = {};
    (HORARIO[tipos.length] || HORARIO[3]).forEach((wd, i) => { horario[wd] = String.fromCharCode(65 + i); });
    return { fuente: 'reglas', dias, horario, volumen, criterios: textoCriterios(p, tipos, volumen, lesiones) };
  }
  function textoCriterios(p, tipos, volumen, lesiones) {
    const nombres = [...new Set(tipos.map(t => DIAS[t].nombre))].join(', ');
    const v = GRANDES.filter(m => volumen[m]).map(m => `${L.MUSCULOS[m].toLowerCase()} ${Math.round(volumen[m])}`).join(' · ');
    const r = VOLUMEN[p.objetivo] || VOLUMEN.musculo;
    return [`${p.dias} días (${nombres}) para ${L.OBJETIVOS[p.objetivo].nombre.toLowerCase()}.`,
      `Series por semana: ${v} (objetivo ${r[0]}-${r[1]} por músculo grande).`,
      'Primero los ejercicios grandes con más descanso, después los accesorios y el core. Cada día con calentamiento, series de aproximación y estiramientos de lo trabajado.',
      lesiones.length ? `Lesiones: además de evitar lo que carga la zona, cada día lleva trabajo de rehabilitación (${lesiones.map(i => REHAB[i.zoneKey] ? REHAB[i.zoneKey].que : L.ZONA_CORTA[i.zoneKey]).join('; ')}).` : '',
      'Progresión: doble progresión (primero repeticiones, luego peso) y la app ajusta cada día por energía, dolor y recuperación.'].filter(Boolean).join(' ');
  }

  // ── Plan que usa la app ──
  const EXTRAS = ['Casa', 'Calle', 'Piscina'];
  let cache = {};
  function planActual(S, u) {
    const clave = clavePlan(S, u) + '|' + JSON.stringify(bp(S, u).planIA ? bp(S, u).planIA.creado : '') + tienePerfil(S, u);
    if (cache[u] && cache[u].clave === clave) return cache[u].plan;
    const base = window.PLAN_ANTERIOR[u] || {};
    let plan;
    const ia = bp(S, u).planIA;
    if (ia && ia.clave === clavePlan(S, u) && ia.dias && Object.keys(ia.dias).length) plan = { fuente: 'ia', dias: Object.assign({}, ia.dias), horario: Object.assign({}, ia.horario), criterios: ia.criterios, resumen: ia.resumen, progresion: ia.progresion, creado: ia.creado };
    else if (tienePerfil(S, u)) plan = planReglas(S, u);
    else plan = { fuente: 'original', dias: Object.fromEntries(Object.entries(base).filter(([k]) => !EXTRAS.includes(k))), horario: Object.fromEntries(Object.entries(window.DIA_SUGERIDO).filter(([, k]) => !EXTRAS.includes(k))) };
    plan.iaCaducado = !!(ia && ia.clave !== clavePlan(S, u));
    // Sesiones extra de siempre: casa, calistenia y piscina (la piscina, el fin de semana si está libre).
    const lugarPrincipal = (Object.values(plan.dias)[0] || {}).lugar;
    EXTRAS.forEach(k => { if (base[k] && base[k].lugar !== lugarPrincipal) plan.dias[k] = base[k]; });
    if (plan.dias.Piscina) [6, 0].forEach(wd => { if (!plan.horario[wd]) plan.horario[wd] = 'Piscina'; });
    cache[u] = { clave, plan };
    return plan;
  }

  window.PLAN_ANTERIOR = window.PLAN;
  window.PLAN = {};
  Object.keys(window.PERSONAS).forEach(u => Object.defineProperty(window.PLAN, u, { enumerable: true, get: () => planActual(window.Store.S, u).dias }));
  const diaSugerido = (S, u, fecha) => planActual(S, u).horario[(fecha || new Date()).getDay()] || null;

  // Lo que se manda al entrenador IA para que monte el plan.
  function datosParaEntrenador(S, u) {
    const p = perfilEntreno(S, u), niveles = L.nivelesZona(S, u, {});
    const enCasa = p.lugar === 'casa' || p.lugar === 'calle';
    const catalogo = E.filter(e => e.l.includes(p.lugar) && L.riesgo(e, niveles) !== 'evitar' && (!enCasa || e.mat.some(m => m === 'peso corporal' || p.material.includes(m))))
      .map(e => ({ id: e.id, nombre: e.n, musculos: e.m, secundarios: e.s, material: e.mat, nivel: e.niv, tipo: e.t, porDefecto: e.d, precaucion: L.zonasRiesgo(e, niveles).map(z => L.ZONA_CORTA[z]) }));
    const lesiones = lesionesActivas(S, u).map(i => {
      const z = ZONAS[i.zoneKey] || {};
      return { zona: z.name, intensidad: ['', 'leve', 'moderada', 'fuerte'][i.severity], nota: i.note || '', evitar: z.danger_rules, calentamientoRecomendado: z.warmup_rec, estiramientosRecomendados: z.stretch_rec, consejo: z.tip,
        rehabilitacionSugerida: (REHAB[i.zoneKey] || { ids: [] }).ids.filter(id => catalogo.some(c => c.id === id)) };
    });
    const b = bp(S, u), peso = ((S.bodyLog || {})[u] || []).filter(x => x.weight).slice(-1)[0];
    const prog = L.progresoParaAgente ? L.progresoParaAgente(S, u, catalogo.map(c => c.id), { energia: 3, niveles }) : {};
    return {
      persona: { nombre: window.PERSONAS[u].nombre, sexo: b.sex === 'f' ? 'mujer' : 'hombre', alturaCm: b.height || null, pesoKg: peso ? peso.weight : null, metaCuerpo: b.goals || null },
      perfil: { objetivo: L.OBJETIVOS[p.objetivo].nombre, nivel: L.NIVEL[p.nivel], lugar: window.LUGARES[p.lugar], minutosPorSesion: p.minutos, diasPorSemana: p.dias, priorizar: p.prioridades.map(m => L.MUSCULOS[m]), material: p.material.map(m => L.MATERIAL[m]) },
      lesiones, historial: prog.progreso || [], estado: prog.estado || null,
      volumenOrientativo: { seriesSemanaPorMusculoGrande: VOLUMEN[p.objetivo] || VOLUMEN.musculo },
      catalogo,
    };
  }
  // Convierte la respuesta del entrenador en el formato de la app y la guarda en el perfil.
  function guardarPlanIA(S, u, r) {
    if (!r || !Array.isArray(r.dias) || !r.dias.length) throw new Error('El entrenador no devolvió días');
    const p = perfilEntreno(S, u);
    const tarea = x => ({ n: String(x.nombre || (POR_ID[x.id] || {}).n || '').slice(0, 80), d: String(x.detalle || '').slice(0, 200), t: String(x.duracion || '').slice(0, 20), id: POR_ID[x.id] ? x.id : undefined });
    const dias = {}, horario = {};
    r.dias.slice(0, 7).forEach((d, k) => {
      const ej = (d.ejercicios || []).filter(x => POR_ID[x.id] && POR_ID[x.id].l.includes(p.lugar))
        .map(x => [x.id, Math.max(1, Math.min(8, +x.series || 3)), String(x.reps || POR_ID[x.id].d[1]).slice(0, 20), Math.max(0, Math.min(300, +x.descanso || 60)), String(x.nota || '').slice(0, 200)]);
      if (!ej.length) return;
      const letra = String.fromCharCode(65 + Object.keys(dias).length);
      dias[letra] = { nombre: `Día ${letra} · ${String(d.nombre || '').slice(0, 40)}`, foco: String(d.foco || '').slice(0, 80), lugar: p.lugar, objetivo: p.objetivo, ej,
        calent: (d.calentamiento || []).map(tarea).filter(t => t.n), vuelta: (d.vueltaCalma || []).map(tarea).filter(t => t.n), notas: String(d.explicacion || '').slice(0, 600) };
      const wd = +d.diaSemana; if (wd >= 1 && wd <= 7 && !horario[wd % 7]) horario[wd % 7] = letra;
    });
    if (!Object.keys(dias).length) throw new Error('Ningún día válido');
    if (!Object.keys(horario).length) (HORARIO[Object.keys(dias).length] || HORARIO[3]).forEach((wd, i) => { if (dias[String.fromCharCode(65 + i)]) horario[wd] = String.fromCharCode(65 + i); });
    S.bodyProfile[u] = S.bodyProfile[u] || {};
    S.bodyProfile[u].planIA = { creado: new Date().toISOString(), clave: clavePlan(S, u), dias, horario, resumen: String(r.resumen || '').slice(0, 800), criterios: String(r.criterios || '').slice(0, 1500), progresion: String(r.progresion || '').slice(0, 800) };
    cache = {};
  }
  function borrarPlanIA(S, u) { if (S.bodyProfile[u]) delete S.bodyProfile[u].planIA; cache = {}; }

  Object.assign(L, { perfilEntreno, tienePerfil, generarPlan: planReglas, planActual, diaSugerido, datosParaEntrenador, guardarPlanIA, borrarPlanIA, clavePlan, PERFIL_BASE, REHAB, VOLUMEN });
})();
