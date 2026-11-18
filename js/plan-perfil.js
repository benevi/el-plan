// Plan semanal hecho a partir del perfil de cada uno (objetivo, nivel, lugar, tiempo, días, músculos a priorizar,
// material) y de sus lesiones. Sustituye al plan fijo de plan.js, que queda como window.PLAN_ANTERIOR.
// El ajuste del día (dolor, energía, recuperación, progresión de peso) se sigue haciendo en el check-in.
(function () {
  const L = window.L, E = window.EJERCICIOS;

  const PERFIL_BASE = { objetivo: 'musculo', nivel: 2, lugar: 'gym', minutos: 45, dias: 3, prioridades: [], material: [] };
  function perfilEntreno(S, u) { return Object.assign({}, PERFIL_BASE, ((S.bodyProfile || {})[u] || {}).entreno || {}); }

  // Plantillas de día: lista de huecos por músculo principal, del más grande al más pequeño.
  const DIAS = {
    empuje: { nombre: 'Empuje', huecos: ['pecho', 'hombro', 'pecho', 'triceps', 'hombro', 'core', 'triceps'] },
    tiron: { nombre: 'Tirón', huecos: ['espalda', 'espalda', 'isquios', 'biceps', 'hombro', 'core', 'biceps'] },
    pierna: { nombre: 'Pierna', huecos: ['cuadriceps', 'gluteo', 'isquios', 'cuadriceps', 'gemelo', 'core', 'gluteo'] },
    torso: { nombre: 'Torso', huecos: ['pecho', 'espalda', 'hombro', 'espalda', 'triceps', 'biceps', 'core'] },
    piernaB: { nombre: 'Pierna y core', huecos: ['gluteo', 'cuadriceps', 'isquios', 'gluteo', 'core', 'gemelo', 'core'] },
    fullA: { nombre: 'Cuerpo completo', huecos: ['cuadriceps', 'espalda', 'pecho', 'isquios', 'hombro', 'core', 'gluteo'] },
    fullB: { nombre: 'Cuerpo completo', huecos: ['gluteo', 'pecho', 'espalda', 'cuadriceps', 'triceps', 'core', 'biceps'] },
    fullC: { nombre: 'Cuerpo completo', huecos: ['isquios', 'espalda', 'hombro', 'cuadriceps', 'pecho', 'core', 'gluteo'] },
    salud: { nombre: 'Salud y movilidad', huecos: ['movilidad', 'gluteo', 'espalda', 'core', 'movilidad', 'cuadriceps', 'hombro'] },
    piscina: { nombre: 'Piscina', huecos: ['cardio', 'natacion', 'natacion', 'gluteo', 'natacion', 'cardio'] },
  };
  // Reparto según objetivo y días por semana.
  function reparto(p) {
    const d = Math.max(2, Math.min(6, +p.dias || 3));
    if (p.lugar === 'piscina') return Array(d).fill('piscina');
    if (p.objetivo === 'recuperacion') return Array.from({ length: d }, (_, i) => i % 2 ? 'fullA' : 'salud');
    const full = ['fullA', 'fullB', 'fullC'];
    if (p.objetivo === 'perder' || p.objetivo === 'tono' || d === 2) return Array.from({ length: d }, (_, i) => full[i % 3]);
    return { 3: ['empuje', 'tiron', 'pierna'], 4: ['torso', 'pierna', 'torso', 'piernaB'], 5: ['empuje', 'tiron', 'pierna', 'torso', 'piernaB'], 6: ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna'] }[d];
  }
  // Qué día de la semana toca cada sesión (0 domingo … 6 sábado), repartidos con descanso entre medias.
  const HORARIO = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

  // Ejercicios base de cada músculo, de más a menos preferido (si son seguros y caben en el lugar y el nivel).
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

  // Series, repeticiones y descanso según objetivo y lo grande que sea el ejercicio.
  function dosis(e, p, i) {
    if (e.t !== 'reps' || e.m[0] === 'movilidad') return [e.d[0], e.d[1], e.d[2]];
    const grande = i < 2 && (e.s || []).length > 0 && !/aperturas|cruces|elevaciones|curl|extension|patada|abduc/.test(e.id);
    const peq = ['core', 'gemelo', 'biceps', 'triceps'].includes(e.m[0]) || e.m[0] === 'hombro' && !(e.s || []).length;
    const unilateral = / c\//.test(e.d[1]) ? ' c/' + e.d[1].split(' c/')[1] : '';
    switch (p.objetivo) {
      case 'fuerza': return grande ? [4, '5-6' + unilateral, 120] : peq ? [3, '10-12' + unilateral, 60] : [3, '6-8' + unilateral, 90];
      case 'perder': return [3, (peq ? '15-20' : '12-15') + unilateral, 30];
      case 'tono': return [3, (peq ? '15-20' : '12-15') + unilateral, 45];
      case 'recuperacion': return [2, '12-15' + unilateral, 45];
      default: return grande ? [4, '8-10' + unilateral, 90] : peq ? [3, '12-15' + unilateral, 45] : [3, '10-12' + unilateral, 60];
    }
  }

  const cache = {};
  function generarPlan(S, u) {
    const p = perfilEntreno(S, u);
    const lesiones = (S.injuries[u] || []).filter(i => i.active).map(i => i.zoneKey + i.severity).join(',');
    const clave = JSON.stringify(p) + lesiones;
    if (cache[u] && cache[u].clave === clave) return cache[u].plan;

    const niveles = L.nivelesZona(S, u, {});
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
      // Prioridades: un hueco más de cada músculo prioritario que encaje en este día (o en cualquiera si es cuerpo completo).
      (p.prioridades || []).forEach(m => { if (tipo.startsWith('full') || tipo === 'salud' || huecos.includes(m)) huecos.splice(Math.min(2, huecos.length), 0, m); });
      huecos = huecos.slice(0, nEj + ((p.prioridades || []).length ? 1 : 0));
      const elegidos = [];
      huecos.forEach((m, i) => {
        const cands = pool.filter(e => e.m[0] === m && !elegidos.includes(e) && (e.t === 'reps' || ['core', 'movilidad', 'cardio', 'natacion', 'gluteo'].includes(m)));
        if (!cands.length) return;
        const nota = e => (usados[e.id] || 0) * -12 + extra(m, e.id) + (i < 2 ? (e.s || []).length : 0) + (L.riesgo(e, niveles) === 'precaucion' ? -4 : 0) + (e.t === 'reps' ? 1 : 0);
        const e = cands.sort((a, b) => nota(b) - nota(a) || a.id.localeCompare(b.id))[0];
        elegidos.push(e); usados[e.id] = (usados[e.id] || 0) + 1;
      });
      const ej = elegidos.map((e, i) => { const [se, re, de] = dosis(e, p, i); return [e.id, se, re, de]; });
      // Perder peso: final de cardio suave (las máquinas o lo que haya en ese lugar).
      if (p.objetivo === 'perder' && p.lugar !== 'piscina') {
        const fin = pool.filter(e => e.m[0] === 'cardio' && e.t === 'tiempo').sort((a, b) => a.niv - b.niv || a.id.localeCompare(b.id))[k % 2];
        if (fin) ej.push([fin.id, 1, /min/.test(fin.d[1]) ? '10-12 min' : fin.d[1], 0]);
      }
      const letra = String.fromCharCode(65 + k);
      const musculos = [...new Set(elegidos.map(e => e.m[0]).filter(m => !['cardio', 'movilidad', 'natacion'].includes(m)))].slice(0, 4);
      dias[letra] = { nombre: `Día ${letra} · ${plantilla.nombre}`, foco: musculos.map(m => L.MUSCULOS[m]).join(', '), lugar: p.lugar, ej, objetivo: p.objetivo };
    });
    const horario = {};
    (HORARIO[tipos.length] || HORARIO[3]).forEach((wd, i) => { horario[wd] = String.fromCharCode(65 + i); });
    const plan = { dias, horario, perfil: p };
    cache[u] = { clave, plan };
    return plan;
  }

  window.PLAN_ANTERIOR = window.PLAN;
  window.PLAN = {};
  Object.keys(window.PERSONAS).forEach(u => Object.defineProperty(window.PLAN, u, { enumerable: true, get: () => generarPlan(window.Store.S, u).dias }));
  const diaSugerido = (S, u, fecha) => generarPlan(S, u).horario[(fecha || new Date()).getDay()] || null;

  Object.assign(L, { perfilEntreno, generarPlan, diaSugerido, PERFIL_BASE });
})();
