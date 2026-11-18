// Sobrecarga progresiva: a partir de lo que cada uno ha apuntado (kilos, repeticiones, tiempo, esfuerzo,
// dolor y energía) propone para hoy el peso, las repeticiones, el tiempo o las series de cada ejercicio.
// Lo usan el plan semanal, el generador sin IA y, como dato de partida, el agente de IA.
(function () {
  const L = window.L;
  const DIA = 864e5;
  const n = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? null : x; };
  const es = v => (Math.round(v * 100) / 100).toLocaleString('es-ES');

  // «8-12», «12 c/pierna», «30-45s», «20-30s c/lado», «10-20 min», «25 m» → { lo, hi, u, resto }
  function rango(txt) {
    const m = String(txt || '').match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?\s*(min|s|m)?\b\s*(.*)$/i);
    if (!m) return null;
    const lo = n(m[1]), hi = m[2] ? n(m[2]) : lo;
    return { lo, hi, u: (m[3] || '').toLowerCase(), resto: m[4] ? ' ' + m[4].trim() : '' };
  }
  function textoRango(r) {
    const sep = r.u === 's' ? '' : r.u ? ' ' : '';
    return (r.lo === r.hi ? es(r.lo) : `${es(r.lo)}-${es(r.hi)}`) + sep + r.u + r.resto;
  }
  // Lo que se apunta en la columna de reps/tiempo/metros: «12», «40s», «1:30», «2 min».
  function valor(txt, u) {
    const s = String(txt == null ? '' : txt).trim();
    if (!s) return null;
    const mmss = s.match(/^(\d+):(\d{1,2})$/);
    if (mmss) { const seg = +mmss[1] * 60 + +mmss[2]; return u === 'min' ? seg / 60 : seg; }
    const v = n(s); if (v == null) return null;
    if (u === 's' && /min/i.test(s)) return v * 60;
    if (u === 'min' && /\d\s*s\b/i.test(s)) return v / 60;
    return v;
  }

  // Máquinas asistidas: el peso es ayuda, así que progresar es quitar kilos.
  const esAsistida = e => /asistid/.test(e.id) && e.mat.includes('maquina');
  function paso(e, kg) {
    if (e.mat.includes('mancuernas')) return kg < 10 ? 1 : 2;
    if (e.mat.includes('barra') || e.mat.includes('maquina') || e.mat.includes('polea')) return kg >= 80 ? 5 : 2.5;
    return kg >= 20 ? 2.5 : 1;
  }
  const redondear = (kg, p) => Math.max(0, Math.round(kg / p) * p);

  // Todas las veces que ha hecho este ejercicio, de la más antigua a la más reciente.
  function registros(S, u, id) {
    return Object.values(S.workouts).filter(w => w.user === u && w.completed)
      .sort((a, b) => new Date(a.completedAt || a.date) - new Date(b.completedAt || b.date))
      .map(w => {
        const x = (w.exercises || []).find(x => (x.exId || L.idDeNombre(x.name)) === id);
        if (!x) return null;
        const sets = (x.sets || []).filter(s => s.done !== false && (String(s.reps || '').trim() || +s.weight > 0))
          .map(s => ({ kg: +s.weight > 0 ? +s.weight : null, txt: String(s.reps || '').trim() }));
        if (!sets.length) return null;
        const fin = new Date(w.completedAt || w.date);
        const dolor = (S.painLog || []).find(p => p.user === u && p.despues && Math.abs(new Date(p.date) - fin) < 3 * 3600e3);
        return { fecha: w.completedAt || w.date, sets, esfuerzo: w.feedback && +w.feedback.esfuerzo || null, energia: w.checkin && +w.checkin.energia || null, antes: dolor ? dolor.antes : (w.checkin && w.checkin.dolor) || {}, despues: dolor ? dolor.despues : {} };
      }).filter(Boolean);
  }

  function resumen(reg, e) {
    if (!reg) return '';
    const conKg = reg.sets.some(s => s.kg);
    const partes = reg.sets.map(s => conKg ? `${s.kg ? es(s.kg) : '—'} kg × ${s.txt || '?'}` : (s.txt || '?'));
    return partes.join(' · ');
  }

  // Zonas lesionadas que este ejercicio carga y a las que les subió el dolor la última vez.
  function dolorSubio(reg, e) {
    return Object.keys(e.r || {}).filter(z => reg.despues[z] != null && +reg.despues[z] >= +(reg.antes[z] || 0) + 2);
  }

  // ── Recuperación por músculo ──
  // Horas que necesita cada músculo tras una sesión normal (grandes 72 h, pequeños 48 h, core 24 h).
  const RECUPERA = { pecho: 72, espalda: 72, cuadriceps: 72, gluteo: 72, isquios: 72, hombro: 48, biceps: 48, triceps: 48, gemelo: 48, core: 24 };
  // Para cada músculo: horas desde que lo trabajaste, series efectivas dentro de su ventana y estado
  // ('cargado': aún a medias, no conviene volver a darle fuerte · 'parcial': casi listo, sin subir carga).
  function cargaMuscular(S, u) {
    const ahora = Date.now(), c = {};
    Object.values(S.workouts || {}).filter(w => w.user === u && w.completed).forEach(w => {
      const horas = (ahora - new Date(w.completedAt || w.date)) / 3600e3;
      if (horas < 0 || horas > 96) return;
      const duro = w.feedback && +w.feedback.esfuerzo >= 4 ? 1.25 : 1;
      (w.exercises || []).forEach(x => {
        const e = L.ex(x.exId || L.idDeNombre(x.name)); if (!e) return;
        const n = (x.sets || []).filter(s => s.done !== false).length; if (!n) return;
        const suma = (m, f) => {
          const rec = RECUPERA[m]; if (!rec || horas > rec) return;
          const k = c[m] || (c[m] = { horas, series: 0, rec });
          k.horas = Math.min(k.horas, horas); k.series += n * f * duro;
        };
        e.m.forEach(m => suma(m, 1)); (e.s || []).forEach(m => suma(m, 0.5));
      });
    });
    Object.values(c).forEach(k => {
      k.series = Math.round(k.series * 10) / 10; k.horas = Math.round(k.horas);
      k.estado = k.horas < k.rec * 0.67 && k.series >= 4 ? 'cargado' : k.horas < k.rec && k.series >= 3 ? 'parcial' : 'fresco';
      k.faltan = Math.max(0, k.rec - k.horas);
    });
    return c;
  }
  const hace = hrs => hrs < 24 ? `hace ${hrs} h` : hrs < 48 ? 'ayer' : `hace ${Math.round(hrs / 24)} días`;
  function textoCarga(m, k) { return `${(L.MUSCULOS[m] || m)}: lo trabajaste ${hace(k.horas)} (${es(Math.round(k.series))} series)`; }

  // base: { series, reps, desc } tal como sale del plan o del generador ya ajustado al check-in.
  // ctx: { energia, niveles, tiempo }
  function sugerir(S, u, id, base, ctx) {
    const e = L.ex(id); ctx = ctx || {};
    const out = { series: base.series, reps: base.reps, kg: null, tipo: 'igual', motivo: '', ultima: '' };
    if (!e) return out;
    const r = rango(base.reps);
    const regs = registros(S, u, id);
    const ult = regs[regs.length - 1], prev = regs[regs.length - 2];
    if (!ult) {
      out.tipo = 'nuevo';
      if (e.t === 'reps' && !e.mat.includes('peso corporal') && r) out.motivo = `Primera vez: elige un peso con el que llegues a ${es(r.hi)} dejando 2 o 3 repeticiones de margen, y apúntalo.`;
      return out;
    }
    out.ultima = resumen(ult, e);
    const energia = +ctx.energia || 3;
    const dias = Math.floor((Date.now() - new Date(ult.fecha)) / DIA);
    const cuidado = L.riesgo(e, ctx.niveles || {}) === 'precaucion';
    const subioDolor = dolorSubio(ult, e).map(z => L.ZONA_CORTA[z] || z);
    const asist = esAsistida(e);
    const frenos = [];
    if (energia <= 2) frenos.push('hoy tienes poca energía');
    if (cuidado) frenos.push('vas con cuidado por tu lesión');
    if (subioDolor.length) frenos.push(`la última vez te subió el dolor (${subioDolor.join(', ').toLowerCase()})`);
    if (ult.esfuerzo >= 5) frenos.push('la última sesión fue al límite');
    const carga = (ctx.carga || cargaMuscular(S, u))[e.m[0]];
    if (carga && carga.estado !== 'fresco') frenos.push(`el ${(L.MUSCULOS[e.m[0]] || '').toLowerCase()} aún se recupera (${hace(carga.horas)})`);
    const freno = frenos.length ? frenos[0] : '';

    const vals = s => valor(s.txt, r ? r.u : '');
    const conKg = e.t === 'reps' && ult.sets.some(s => s.kg);

    if (conKg) {
      const kgUlt = asist ? Math.min(...ult.sets.filter(s => s.kg).map(s => s.kg)) : Math.max(...ult.sets.filter(s => s.kg).map(s => s.kg));
      const top = ult.sets.filter(s => s.kg === kgUlt).map(vals).filter(v => v != null);
      const p = paso(e, kgUlt);
      const lo = r ? r.lo : 8, hi = r ? r.hi : 12;
      const llego = top.length >= Math.min(2, base.series) && top.every(v => v >= hi);
      const corto = x => { if (!x) return false; const k = asist ? Math.min(...x.sets.filter(s => s.kg).map(s => s.kg)) : Math.max(...x.sets.filter(s => s.kg).map(s => s.kg)); const v = x.sets.filter(s => s.kg === k).map(vals).filter(v => v != null); return v.length && v.filter(y => y < lo).length > v.length / 2; };
      const masDuro = kg => asist ? kg - p : kg + p, masFacil = (kg, f) => asist ? kg * (2 - f) : kg * f;
      let kg = kgUlt;
      if (dias > 28) {
        kg = redondear(masFacil(kgUlt, 0.9), p); out.tipo = 'baja';
        out.motivo = `Hace ${Math.round(dias / 7)} semanas que no lo haces: empieza con ${es(kg)} kg y recupera el ritmo.`;
      } else if (energia <= 1) {
        kg = redondear(masFacil(kgUlt, 0.9), p); out.tipo = 'baja';
        out.motivo = `Día de poca energía: ${es(kg)} kg, un 10 % más suave, sin apretar.`;
      } else if (corto(ult) && corto(prev)) {
        kg = redondear(masFacil(kgUlt, 0.9), p); out.tipo = 'baja';
        out.motivo = `Dos sesiones sin llegar a ${es(lo)} repeticiones: baja a ${es(kg)} kg y vuelve a subir desde ahí.`;
      } else if (llego && !freno) {
        kg = redondear(masDuro(kgUlt), p); out.tipo = 'sube';
        if (r) out.reps = textoRango(r);
        out.motivo = asist ? `Quita ${es(p)} kg de ayuda: la última vez llegaste a ${es(hi)} en todas las series con ${es(kgUlt)} kg.`
          : `Sube ${es(p)} kg: la última vez llegaste a ${es(hi)} en todas las series. Hoy basta con llegar a ${es(lo)}.`;
      } else if (llego) {
        out.motivo = `Te tocaba subir, pero ${freno}: repite ${es(kgUlt)} kg.`;
      } else if (corto(ult)) {
        out.motivo = `Repite ${es(kgUlt)} kg e intenta llegar a ${es(lo)} repeticiones en cada serie.`;
      } else {
        const mejor = Math.max(...top, 0);
        const obj = Math.min(hi, Math.floor(mejor) + 1);
        out.motivo = freno ? `Mantén ${es(kgUlt)} kg: ${freno}.` : `Mismo peso, ${es(kgUlt)} kg: intenta ${es(obj)} repeticiones por serie. Al llegar a ${es(hi)} en todas, subes.`;
      }
      out.kg = kg;
      return out;
    }

    // Sin kilos: progresar en repeticiones, tiempo, metros o series.
    const vs = ult.sets.map(vals).filter(v => v != null);
    if (!r || !vs.length) return out;
    const todas = vs.length >= Math.min(2, base.series) && vs.every(v => v >= r.hi);
    const media = vs.reduce((a, b) => a + b, 0) / vs.length;
    if (dias > 28 || energia <= 1) {
      out.motivo = dias > 28 ? `Hace ${Math.round(dias / 7)} semanas que no lo haces: quédate en la parte baja del rango.` : 'Día suave: quédate en la parte baja del rango.';
      out.tipo = 'baja';
      return out;
    }
    if (!todas) {
      const obj = Math.min(r.hi, Math.floor(media) + (r.u === 's' ? 5 : r.u === 'min' ? 1 : 1));
      out.motivo = freno ? `Mantén lo de la última vez: ${freno}.` : `La última vez: ${out.ultima}. Hoy intenta llegar a ${es(obj)}${r.u === 's' ? ' s' : r.u === 'min' ? ' min' : r.u === 'm' ? ' m' : ''} en cada serie.`;
      return out;
    }
    if (freno) { out.motivo = `Te tocaba subir, pero ${freno}: repite lo de la última vez.`; return out; }
    if (e.t === 'distancia' || r.u === 'm') {
      if (ctx.tiempo !== 'rapido' && base.series < 10) { out.series = base.series + 1; out.tipo = 'series'; out.motivo = `Completaste todos los largos: hoy una serie más (${out.series}).`; }
      return out;
    }
    const inc = r.u === 's' ? (r.hi >= 60 ? 10 : 5) : r.u === 'min' ? 2 : 2;
    const nuevo = { lo: r.hi, hi: r.hi + inc, u: r.u, resto: r.resto };
    if (e.t === 'reps' && r.hi >= 20 && base.series < 5 && ctx.tiempo !== 'rapido') {
      out.series = base.series + 1; out.tipo = 'series';
      out.motivo = `Llegaste a ${es(r.hi)} en todas: hoy una serie más. Cuando te sobre, pasa a una variante más difícil.`;
      return out;
    }
    out.reps = textoRango(nuevo); out.tipo = 'sube';
    out.motivo = r.u === 's' ? `Aguantaste ${es(r.hi)} s en todas: hoy ${out.reps}.` : r.u === 'min' ? `Completaste ${es(r.hi)} min: hoy ${out.reps}.` : `Llegaste a ${es(r.hi)} en todas: hoy ${out.reps}.`;
    return out;
  }

  // Lo que se manda al agente de IA para que decida con datos.
  function progresoParaAgente(S, u, ids, ctx) {
    const progreso = [];
    ids.forEach(id => {
      const regs = registros(S, u, id); if (!regs.length) return;
      const e = L.ex(id);
      const sug = sugerir(S, u, id, { series: e.d[0], reps: e.d[1], desc: e.d[2] }, ctx);
      progreso.push({
        id,
        ultimas: regs.slice(-3).reverse().map(r => ({ fecha: String(r.fecha).slice(0, 10), series: resumen(r, e), esfuerzo: r.esfuerzo ? r.esfuerzo + '/5' : null, dolorSubio: dolorSubio(r, e).length ? dolorSubio(r, e).map(z => L.ZONA_CORTA[z]) : undefined })),
        diasDesdeUltima: Math.floor((Date.now() - new Date(regs[regs.length - 1].fecha)) / DIA),
        propuestaApp: [sug.kg != null ? es(sug.kg) + ' kg' : '', sug.series + ' × ' + sug.reps, sug.motivo].filter(Boolean).join(' · '),
      });
    });
    progreso.sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima);

    const ses = Object.values(S.workouts).filter(w => w.user === u && w.completed).sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date));
    const hace = d => Math.floor((Date.now() - new Date(d)) / DIA), hace2 = hace;
    const peso = (S.bodyLog[u] || []).filter(x => x.weight).sort((a, b) => new Date(a.date) - new Date(b.date));
    const pUlt = peso[peso.length - 1], p30 = peso.filter(x => hace(x.date) >= 25)[peso.filter(x => hace(x.date) >= 25).length - 1];
    const dolor = (S.painLog || []).filter(p => p.user === u).slice(-5).map(p => ({ fecha: String(p.date).slice(0, 10), antes: p.antes, despues: p.despues }));
    const carga = cargaMuscular(S, u);
    return {
      recuperacion: Object.entries(carga).filter(([, k]) => k.estado !== 'fresco').map(([m, k]) => ({ musculo: L.MUSCULOS[m] || m, id: m, haceHoras: k.horas, series: Math.round(k.series), estado: k.estado === 'cargado' ? 'sin recuperar' : 'casi recuperado', faltanHoras: k.faltan })),
      ultimasSesiones: ses.filter(w => hace2(w.completedAt || w.date) < 4).map(w => ({ haceHoras: Math.round((Date.now() - new Date(w.completedAt || w.date)) / 3600e3), nombre: w.nombre || w.day, ejercicios: (w.exercises || []).map(x => x.exId || L.idDeNombre(x.name) || x.name).filter(Boolean) })),
      progreso: progreso.slice(0, 40),
      estado: {
        pesoCorporal: pUlt ? { kg: pUlt.weight, fecha: String(pUlt.date).slice(0, 10), cambio30dias: p30 ? Math.round((pUlt.weight - p30.weight) * 10) / 10 : null } : null,
        sesionesUltimos7dias: ses.filter(w => hace(w.completedAt || w.date) < 7).length,
        ultimaSesion: ses[0] ? { haceDias: hace(ses[0].completedAt || ses[0].date), nombre: ses[0].nombre || ses[0].day, esfuerzo: ses[0].feedback && ses[0].feedback.esfuerzo ? ses[0].feedback.esfuerzo + '/5' : null, energiaAntes: ses[0].checkin && ses[0].checkin.energia ? ses[0].checkin.energia + '/5' : null } : null,
        esfuerzoUltimas: ses.slice(0, 5).map(w => w.feedback && w.feedback.esfuerzo).filter(Boolean),
        dolorUltimasSesiones: dolor,
      },
    };
  }

  Object.assign(L, { rango, textoRango, registros, sugerir, progresoParaAgente, esAsistida, cargaMuscular, textoCarga, RECUPERA });
})();
