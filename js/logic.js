// Lógica sin interfaz: ajuste por dolor y cansancio, alternativas, generador local y cálculos corporales.
(function () {
  const E = window.EJERCICIOS;
  const POR_ID = Object.fromEntries(E.map(e => [e.id, e]));
  const POR_NOMBRE = Object.fromEntries(E.map(e => [e.n.toLowerCase(), e.id]));

  const MUSCULOS = { pecho: 'Pecho', espalda: 'Espalda', hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps', core: 'Core', gluteo: 'Glúteo', cuadriceps: 'Cuádriceps', isquios: 'Isquios', gemelo: 'Gemelo', cardio: 'Cardio', movilidad: 'Movilidad', natacion: 'Natación' };
  const MATERIAL = { maquina: 'Máquina', mancuernas: 'Mancuernas', banco: 'Banco', barra: 'Barra', polea: 'Polea', 'peso corporal': 'Sin material', paralelas: 'Paralelas', botellas: 'Botellas o mochila', 'barra fija': 'Barra fija', banda: 'Banda elástica', rueda: 'Rueda abdominal', agua: 'Agua', tabla: 'Tabla', comba: 'Comba', 'pull buoy': 'Pull buoy', aletas: 'Aletas' };
  const NIVEL = { 1: 'Fácil', 2: 'Medio', 3: 'Avanzado' };
  const ZONA_CORTA = { cadera_lateral: 'Cadera', rodilla: 'Rodilla', hombro: 'Hombro', lumbar: 'Lumbar', codo: 'Codo', cervical: 'Cuello', tobillo_pie: 'Tobillo', 'muñeca': 'Muñeca' };

  const ex = id => POR_ID[id];
  function idDeNombre(nombre) {
    if (!nombre) return null;
    return (window.ALIAS && window.ALIAS[nombre]) || POR_NOMBRE[nombre.toLowerCase()] || null;
  }

  // Nivel de cada zona hoy (0 nada · 1 cuidado · 2 cambiar todo lo que la carga · 3 parar).
  // Una lesión leve o moderada pone la zona en 1: fuera lo que la carga mucho, aviso en lo demás.
  // Una lesión fuerte o dolor de 4 o más ese día sube a 2 y cambia también lo que la carga un poco.
  function nivelDolor(n) { return n >= 7 ? 3 : n >= 4 ? 2 : n >= 1 ? 1 : 0; }
  function nivelesZona(S, u, dolorHoy) {
    const z = {};
    (S.injuries[u] || []).filter(i => i.active).forEach(i => { z[i.zoneKey] = Math.max(z[i.zoneKey] || 0, +i.severity >= 3 ? 2 : 1); });
    Object.entries(dolorHoy || {}).forEach(([k, v]) => { const l = nivelDolor(+v); if (l) z[k] = Math.max(z[k] || 0, l); });
    return z;
  }

  // 'ok' · 'precaucion' · 'evitar'
  function riesgo(e, niveles) {
    let peor = 'ok';
    for (const [zona, nivel] of Object.entries(niveles)) {
      const r = (e.r || {})[zona];
      if (!r || !nivel) continue;
      if (r === 2 || (r === 1 && nivel >= 2)) return 'evitar';
      if (r === 1) peor = 'precaucion';
    }
    return peor;
  }
  function zonasRiesgo(e, niveles) { return Object.keys(e.r || {}).filter(z => niveles[z]); }

  function alternativas(orig, lugar, niveles, excluir, todas) {
    const mat = new Set(orig.mat);
    return E.filter(e => e.id !== orig.id && !(excluir || []).includes(e.id) && e.l.includes(lugar) &&
        (todas || e.m.includes(orig.m[0]) || orig.m.includes(e.m[0])) && riesgo(e, niveles) !== 'evitar')
      .map(e => ({ e, p: (e.m[0] === orig.m[0] ? 10 : 0) + e.mat.filter(m => mat.has(m)).length * 3 + (e.t === orig.t ? 2 : 0) - Math.abs(e.niv - orig.niv) }))
      .sort((a, b) => b.p - a.p).map(x => x.e);
  }

  // Ajusta una lista [id, series, reps, descanso] al check-in de hoy.
  function adaptar(S, u, lugar, items, checkin, op) {
    const niveles = nivelesZona(S, u, checkin.dolor);
    const ajustes = [];
    let lista = [];
    const usados = items.map(i => i[0]);
    items.forEach(([id, series, reps, desc, nota, kg]) => {
      const e = ex(id); if (!e) return;
      const rg = riesgo(e, niveles);
      if (rg === 'evitar') {
        const alt = alternativas(e, lugar, niveles, usados.concat(lista.map(x => x.id)))[0];
        const zonas = zonasRiesgo(e, niveles).map(z => ZONA_CORTA[z]).join(', ');
        if (alt) {
          ajustes.push(`${e.n} → ${alt.n} (${zonas})`);
          lista.push({ id: alt.id, series, reps: alt.t === e.t ? reps : alt.d[1], desc, nota, cambio: e.n });
        } else if (Object.entries(e.r).some(([z, r]) => r === 2 && niveles[z])) {
          ajustes.push(`Quitado: ${e.n} (${zonas}), sin alternativa segura aquí`);
        } else {
          ajustes.push(`${e.n}: una serie menos y con cuidado (${zonas})`);
          lista.push({ id, series: Math.max(1, series - 1), reps, desc, nota, kg, precaucion: true });
        }
      } else {
        lista.push({ id, series, reps, desc, nota, kg, precaucion: rg === 'precaucion' });
      }
    });

    // Recuperación: músculos trabajados hace poco → una serie menos (y sin subir peso, eso lo decide la progresión).
    const carga = window.L.cargaMuscular ? window.L.cargaMuscular(S, u) : {};
    const porMusculo = {};
    lista.forEach(x => {
      const m = ex(x.id).m[0], k = carga[m]; if (!k || k.estado === 'fresco') return;
      if (k.estado === 'cargado' && x.series > 2 && !(op && op.recuperacionHecha)) { x.series--; }
      (porMusculo[m] = porMusculo[m] || []).push(x);
    });
    Object.entries(porMusculo).forEach(([m, xs]) => {
      const k = carga[m];
      ajustes.push(window.L.textoCarga(m, k) + (k.estado === 'cargado' ? (op && op.recuperacionHecha ? '. Aún no se ha recuperado: la rutina ya lo tiene en cuenta, sin subir peso.' : '. Aún no se ha recuperado: una serie menos en sus ejercicios y sin subir peso.') : '. Casi recuperado: mismo peso, sin subir.'));
    });
    const fuerza = l => l.filter(x => { const e = ex(x[0] || x.id); return e && !['movilidad', 'cardio', 'natacion'].includes(e.m[0]); });
    const cuota = l => { const f = fuerza(l); return f.length ? f.filter(x => { const k = carga[ex(x[0] || x.id).m[0]]; return k && k.estado === 'cargado'; }).length / f.length : 0; };
    const cuotaHoy = cuota(lista);
    if (cuotaHoy >= 0.5 && window.PLAN && window.PLAN[u]) {
      const mejor = Object.values(window.PLAN[u]).filter(d => d.lugar === lugar).map(d => ({ d, q: cuota(d.ej) })).sort((a, b) => a.q - b.q)[0];
      if (mejor && mejor.q <= cuotaHoy - 0.3) ajustes.push(`Casi toda esta sesión carga músculos que aún se recuperan. Hoy te encaja mejor «${mejor.d.nombre}».`);
      else ajustes.push('Casi toda esta sesión carga músculos que aún se recuperan: hazla suave o cambia a cardio o movilidad.');
    }

    // Objetivo del perfil (solo en el plan semanal; las rutinas a medida ya salen con el objetivo elegido).
    const objPerfil = op && op.objetivo;
    const energia = +checkin.energia || 3;
    if (objPerfil === 'perder' && lugar !== 'piscina') {
      lista.forEach(x => { if (ex(x.id).t === 'reps' && x.desc > 45) x.desc = Math.max(45, x.desc - 30); });
      const fin = E.filter(e => e.m[0] === 'cardio' && e.l.includes(lugar) && riesgo(e, niveles) !== 'evitar' && !lista.some(x => x.id === e.id)).sort((a, b) => a.niv - b.niv)[0];
      if (fin && energia >= 3 && (checkin.tiempo || 'completo') === 'completo') {
        lista.push({ id: fin.id, series: fin.d[0], reps: fin.t === 'tiempo' && /min/.test(fin.d[1]) ? '10-12 min' : fin.d[1], desc: fin.d[2], nota: 'Final de cardio para tu objetivo de perder peso.' });
        ajustes.push(`Objetivo perder peso: descansos más cortos y ${fin.n.toLowerCase()} al final.`);
      } else ajustes.push('Objetivo perder peso: descansos más cortos para que la sesión queme más.');
    } else if (objPerfil === 'fuerza') {
      lista.forEach(x => { if (ex(x.id).t === 'reps' && x.desc >= 75) x.desc += 30; });
      ajustes.push('Objetivo fuerza: 30 s más de descanso en los ejercicios principales para mover más peso.');
    } else if (objPerfil === 'tono') {
      lista.forEach(x => { if (ex(x.id).t === 'reps' && x.desc > 45) x.desc = Math.max(45, x.desc - 15); });
      ajustes.push('Objetivo tonificar: descansos un poco más cortos.');
    }
    if (energia === 2) {
      lista.forEach(x => { if (x.series > 2) x.series--; x.desc += 15; });
      ajustes.push('Energía baja: una serie menos por ejercicio, 15 s más de descanso y deja 3 repeticiones en reserva.');
    } else if (energia <= 1) {
      lista = lista.slice(0, 4); lista.forEach(x => { x.series = Math.min(x.series, 2); x.desc += 15; });
      ajustes.push('Sesión suave: 4 ejercicios a 2 series, peso cómodo. Hoy cuenta moverse, no apretar.');
    }

    const tiempo = checkin.tiempo || 'completo';
    if (tiempo === 'rapido' && energia > 1) {
      if (lista.length > 4) ajustes.push(`Poco tiempo: los 4 primeros ejercicios a 2 series (quitados ${lista.length - 4}).`);
      else ajustes.push('Poco tiempo: 2 series por ejercicio.');
      lista = lista.slice(0, 4); lista.forEach(x => { x.series = Math.min(x.series, 2); });
    } else if (tiempo === 'normal' && energia > 1) {
      if (lista.length > 5) ajustes.push(`Tiempo normal: 5 ejercicios como máximo, 3 series (quitados ${lista.length - 5}).`);
      lista = lista.slice(0, 5); lista.forEach(x => { x.series = Math.min(x.series, 3); });
    }

    const maxDolor = Math.max(0, ...Object.values(checkin.dolor || {}).map(Number));
    const aviso = maxDolor >= 7 ? 'Dolor fuerte hoy (7 o más). Lo más sensato es descansar o hacer solo movilidad suave. Si dura más de unos días, consúltalo con tu fisio o médico.' : null;
    return { lista, ajustes, aviso, niveles, carga };
  }

  // ── Generador local (sin IA): reglas simples a partir del catálogo ──
  const OBJETIVOS = {
    fuerza: { nombre: 'Fuerza', series: 4, reps: '6-8', desc: 90 },
    musculo: { nombre: 'Ganar músculo', series: 3, reps: '8-12', desc: 75 },
    tono: { nombre: 'Tonificar y resistencia', series: 3, reps: '12-15', desc: 45 },
    perder: { nombre: 'Perder peso', series: 3, reps: '12-15', desc: 30 },
    recuperacion: { nombre: 'Salud y movilidad', series: 2, reps: '12-15', desc: 45 },
    cardio: { nombre: 'Cardio', series: 3, reps: '30-40s', desc: 30 },
  };
  const PATRON = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'hombro', 'isquios', 'core', 'biceps', 'triceps', 'gemelo'];

  function generarLocal(S, u, f) {
    const niveles = nivelesZona(S, u, f.dolor);
    const obj = OBJETIVOS[f.objetivo] || OBJETIVOS.musculo;
    const n = { 20: 4, 30: 5, 45: 6, 60: 8 }[f.minutos] || 6;
    const matOk = e => f.lugar === 'gym' || f.lugar === 'piscina' || !f.material || !f.material.length || e.mat.some(m => m === 'peso corporal' || f.material.includes(m));
    const nivelMax = f.nivel || 2;
    // Recuperación: fuera lo que carga como músculo principal algo aún sin recuperar, salvo que lo hayas pedido.
    const carga = window.L.cargaMuscular ? window.L.cargaMuscular(S, u) : {};
    const pedidos = f.musculos || [];
    const cargado = m => carga[m] && carga[m].estado === 'cargado';
    const descansan = Object.keys(carga).filter(m => cargado(m) && !pedidos.includes(m));
    let pool = E.filter(e => e.l.includes(f.lugar) && riesgo(e, niveles) !== 'evitar' && matOk(e) && e.niv <= nivelMax && !descansan.includes(e.m[0]));
    // Músculos que esta persona quiere priorizar (perfil): van primero.
    const prioridad = (f.prioridades || []).filter(m => MUSCULOS[m]);
    if (f.objetivo === 'recuperacion') pool = pool.filter(e => e.niv === 1);
    const orden = f.lugar === 'piscina' ? ['cardio', 'natacion', 'gluteo', 'natacion', 'cardio', 'natacion', 'gluteo', 'natacion']
      : f.objetivo === 'cardio' ? ['cardio', 'cuadriceps', 'core', 'cardio', 'gluteo', 'pecho', 'cardio', 'espalda']
      : f.objetivo === 'perder' ? [...prioridad.filter(m => !descansan.includes(m)), 'cuadriceps', 'espalda', 'gluteo', 'pecho', 'core', 'cardio'].filter(m => !descansan.includes(m))
      : f.objetivo === 'recuperacion' ? ['movilidad', 'gluteo', 'movilidad', 'core', 'movilidad', 'espalda', 'movilidad', 'core']
      : (f.musculos && f.musculos.length ? f.musculos.concat(f.musculos, ['core']) : [...new Set(prioridad.concat(PATRON))].filter(m => !descansan.includes(m)));
    const elegidos = [];
    const azar = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    for (let i = 0; elegidos.length < n && i < orden.length * 3; i++) {
      const m = orden[i % orden.length];
      const c = azar(pool.filter(e => e.m[0] === m && !elegidos.includes(e)));
      const c2 = c.length ? c : azar(pool.filter(e => e.m.includes(m) && !elegidos.includes(e)));
      if (c2[0]) elegidos.push(c2[0]);
    }
    // Relleno: en sesiones de fuerza no se cuelan estiramientos ni cardio.
    const relleno = f.lugar === 'piscina' || f.objetivo === 'cardio' || f.objetivo === 'recuperacion' ? pool : pool.filter(e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]));
    azar(relleno).forEach(e => { if (elegidos.length < n && !elegidos.includes(e)) elegidos.push(e); });
    if (f.objetivo === 'perder') elegidos.sort((x, y) => (x.m[0] === 'cardio') - (y.m[0] === 'cardio'));
    const lista = elegidos.map(e => {
      if (e.t !== 'reps' || e.m[0] === 'movilidad') return [e.id, f.lugar === 'piscina' || e.m[0] === 'movilidad' ? e.d[0] : Math.min(obj.series, 3), e.d[1], e.d[2]];
      return [e.id, obj.series, obj.reps, obj.desc];
    }).map(([id, series, reps, desc]) => {
      // Sobrecarga progresiva con lo que hayas apuntado otras veces.
      if (cargado(ex(id).m[0]) && series > 2) series--;
      const sg = window.L.sugerir(S, u, id, { series, reps, desc }, { energia: f.energia, niveles, carga });
      return [id, sg.series, sg.reps, desc, sg.motivo, sg.kg];
    });
    const lug = window.LUGARES[f.lugar];
    return {
      nombre: `${obj.nombre} · ${lug}`,
      foco: f.musculos && f.musculos.length ? f.musculos.map(m => MUSCULOS[m]).join(', ') : 'Cuerpo completo',
      lugar: f.lugar,
      notas: 'Hecha con las reglas de la app (sin IA): ejercicios del catálogo seguros para tus lesiones de hoy, con el peso y las repeticiones ajustados a lo que has apuntado otras veces.' +
        (f.objetivo === 'perder' ? ' Para perder peso: descansos cortos (30 s), repeticiones altas y cardio al final.' : '') +
        (prioridad.length && !(f.musculos || []).length ? ` Prioriza ${prioridad.map(m => MUSCULOS[m].toLowerCase()).join(', ')}, como pide tu perfil.` : '') +
        (descansan.length ? ` Hoy descansan ${descansan.map(m => MUSCULOS[m].toLowerCase()).join(', ')}, que trabajaste hace poco.` : '') +
        (pedidos.filter(cargado).length ? ` Has pedido ${pedidos.filter(cargado).map(m => MUSCULOS[m].toLowerCase()).join(', ')} aunque aún se recupera: una serie menos y sin subir peso.` : ''),
      ej: lista,
      fuente: 'local',
    };
  }

  // Lo que se manda al agente: solo ejercicios que ya son seguros y encajan con el lugar y material.
  function catalogoParaAgente(S, u, f) {
    const niveles = nivelesZona(S, u, f.dolor);
    return E.filter(e => e.l.includes(f.lugar) && riesgo(e, niveles) !== 'evitar' &&
        (f.lugar === 'gym' || f.lugar === 'piscina' || !f.material || !f.material.length || e.mat.some(m => m === 'peso corporal' || f.material.includes(m))))
      .map(e => ({ id: e.id, nombre: e.n, musculos: e.m, secundarios: e.s, material: e.mat, nivel: e.niv, tipo: e.t, porDefecto: e.d, precaucion: zonasRiesgo(e, niveles).map(z => ZONA_CORTA[z]) }));
  }

  function validarRutina(r, lugar) {
    if (!r || !Array.isArray(r.ejercicios)) throw new Error('Respuesta sin ejercicios');
    const ej = r.ejercicios.filter(x => POR_ID[x.id] && POR_ID[x.id].l.includes(lugar))
      .map(x => [x.id, Math.max(1, Math.min(10, +x.series || 3)), String(x.reps || POR_ID[x.id].d[1]).slice(0, 20), Math.max(0, Math.min(240, +x.descanso || 60)), (x.nota || '').slice(0, 200), +x.kg > 0 && +x.kg < 400 ? Math.round(+x.kg * 4) / 4 : null]);
    if (!ej.length) throw new Error('Ningún ejercicio válido');
    return { nombre: String(r.nombre || 'Rutina a medida').slice(0, 60), foco: String(r.foco || '').slice(0, 80), lugar, notas: String(r.notas || '').slice(0, 600), explicacion: (Array.isArray(r.explicacion) ? r.explicacion : []).map(x => String(x).slice(0, 400)).filter(Boolean).slice(0, 8), ej, fuente: 'ia' };
  }

  // ── Cuerpo ──
  function grasaNavy(sex, height, neck, waist, hip) {
    if (!height || !neck || !waist) return null;
    if (sex === 'f' && !hip) return null;
    const v = sex === 'f'
      ? 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450
      : 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    return v > 0 && v < 70 ? Math.round(v * 10) / 10 : null;
  }
  function cuerpo(prof, e) {
    if (!e) return {};
    const grasa = e.bodyFat != null ? e.bodyFat : grasaNavy(prof.sex, prof.height, e.neck, e.waist, e.hip);
    const imc = e.weight && prof.height ? Math.round(e.weight / Math.pow(prof.height / 100, 2) * 10) / 10 : null;
    const masaGrasa = grasa != null && e.weight ? Math.round(e.weight * grasa / 10) / 10 : null;
    const masaMagra = masaGrasa != null ? Math.round((e.weight - masaGrasa) * 10) / 10 : null;
    const ich = e.waist && prof.height ? Math.round(e.waist / prof.height * 100) / 100 : null;
    return { peso: e.weight, grasa, imc, masaGrasa, masaMagra, ich, cintura: e.waist, cadera: e.hip, cuello: e.neck, pecho: e.chest, brazo: e.arm, muslo: e.thigh };
  }
  function catImc(v) { return v == null ? '' : v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad'; }
  function catGrasa(v, sex) {
    if (v == null) return '';
    const c = sex === 'f' ? [14, 21, 25, 32] : [6, 14, 18, 25];
    return v < c[0] ? 'Muy bajo' : v < c[1] ? 'Atlético' : v < c[2] ? 'Saludable' : v < c[3] ? 'Aceptable' : 'Alto';
  }
  function catIch(v) { return v == null ? '' : v < 0.43 ? 'Bajo' : v < 0.53 ? 'Saludable' : v < 0.58 ? 'Riesgo elevado' : 'Riesgo alto'; }

  // ── Historial de fuerza ──
  function historialEjercicio(S, u, id) {
    return Object.values(S.workouts).filter(w => w.user === u && w.completed)
      .sort((a, b) => new Date(a.completedAt || a.date) - new Date(b.completedAt || b.date))
      .map(w => {
        const x = (w.exercises || []).find(x => (x.exId || idDeNombre(x.name)) === id);
        if (!x) return null;
        const sets = (x.sets || []).filter(s => s.done !== false && +s.weight > 0);
        if (!sets.length) return null;
        const max = Math.max(...sets.map(s => +s.weight));
        const rm = Math.max(...sets.map(s => +s.weight * (1 + (parseInt(s.reps) || 1) / 30)));
        return { fecha: w.completedAt || w.date, max, rm: Math.round(rm * 10) / 10, sets: x.sets };
      }).filter(Boolean);
  }
  function ultimoUso(S, u, id) {
    const h = historialEjercicio(S, u, id);
    return h.length ? h[h.length - 1] : null;
  }

  window.L = { ex, idDeNombre, MUSCULOS, MATERIAL, NIVEL, ZONA_CORTA, OBJETIVOS, nivelesZona, nivelDolor, riesgo, zonasRiesgo, alternativas, adaptar, generarLocal, catalogoParaAgente, validarRutina, grasaNavy, cuerpo, catImc, catGrasa, catIch, historialEjercicio, ultimoUso };
})();
