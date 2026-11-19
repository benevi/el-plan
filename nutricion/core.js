// Pipos Fitness · Nutrición (núcleo sin interfaz).
// Modelo de datos, cálculo de energía y macros de cada uno, turnos de trabajo, petición al agente y lista de la compra.
// Funciona en el navegador y en Node (queda en globalThis.NutriCore; también module.exports en CommonJS), sin dependencias.
(function (fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.NutriCore = api;
})(function () {
  'use strict';

  // ───────────────────────── Modelo de datos ─────────────────────────
  // Lo común (hogar, menús, compra, valoraciones) se comparte entre los dos móviles.
  // Lo de cada persona (perfil nutricional) va en personas[u]; peso, medidas y entreno se leen del perfil de entreno.
  const MOMENTOS = ['desayuno', 'media mañana', 'comida', 'merienda', 'cena', 'post-entreno'];
  const REPARTO = { desayuno: 25, 'media mañana': 10, comida: 35, merienda: 10, cena: 25, 'post-entreno': 10 };
  const SECCIONES = ['frutas y verduras', 'carnes', 'pescados', 'huevos y lácteos', 'panadería y cereales', 'legumbres', 'despensa', 'aceites y especias', 'congelados', 'conservas', 'frutos secos', 'bebidas', 'otros'];
  const UNIDADES = ['g', 'ml', 'ud'];
  const OBJETIVOS = { perder: 'Perder grasa', musculo: 'Ganar músculo', fuerza: 'Fuerza', tonificar: 'Tonificar', salud: 'Salud y movilidad', mantener: 'Mantener' };

  function personaVacia() {
    return {
      nacimiento: null,          // año, p. ej. 1988
      actividad: 'ligera',       // fuera del entreno: sentado | ligera | de pie | activo
      comidas: ['desayuno', 'media mañana', 'comida', 'merienda', 'cena'],
      ajusteKcal: 0,             // corrección manual en kcal/día (+/-)
      noGusta: [], alergias: [], // propias de cada uno, además de las del hogar
      turnos: { activo: false, refLunes: null, refTurno: 'tarde', comidasTrabajo: ['cena'], diasTrabajo: [1, 2, 3, 4, 5] },
    };
  }

  function vacio() {
    return {
      v: 1,
      hogar: {
        alergias: [], noGusta: [], gustan: [],
        despensa: [],             // [{ nombre, cantidad? }] lo que hay en casa
        minutosEntreSemana: 30,   // tiempo máximo para cocinar un día laborable
        batchDomingo: true,       // dejar cosas preparadas el fin de semana
        platosDelMundo: 2,        // recetas de fuera de la dieta mediterránea por semana
        notas: '',
      },
      personas: { him: personaVacia(), her: personaVacia() },
      menus: {},                  // por lunes ISO: { creado, semana, objetivos, menu, compra: { marcados: {}, extra: [] } }
      valoraciones: {},           // por nombre de receta normalizado: 1 (no), 2 (normal), 3 (gusta)
      actualizado: null,
    };
  }

  function completar(n) {
    const base = vacio();
    const out = Object.assign(base, n || {});
    out.hogar = Object.assign(vacio().hogar, (n || {}).hogar || {});
    ['him', 'her'].forEach(u => {
      const p = ((n || {}).personas || {})[u] || {};
      out.personas[u] = Object.assign(personaVacia(), p);
      out.personas[u].turnos = Object.assign(personaVacia().turnos, p.turnos || {});
    });
    out.menus = out.menus && typeof out.menus === 'object' ? out.menus : {};
    out.valoraciones = out.valoraciones && typeof out.valoraciones === 'object' ? out.valoraciones : {};
    return out;
  }

  // ───────────────────────── Fechas y turnos ─────────────────────────
  const iso = d => { const x = new Date(d); return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())).toISOString().slice(0, 10); };
  function lunesDe(d) { const x = new Date(d || Date.now()); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); }
  function sumarDias(isoStr, n) { const x = new Date(isoStr + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); }

  // Turno de una semana: alterna cada semana a partir de una semana de referencia que la persona fija en la app.
  function turnoSemana(persona, lunes) {
    const t = persona && persona.turnos;
    if (!t || !t.activo || !t.refLunes) return null;
    if (t.excepciones && t.excepciones[lunes]) return t.excepciones[lunes];
    const semanas = Math.round((new Date(lunes + 'T12:00:00') - new Date(lunesDe(t.refLunes) + 'T12:00:00')) / (7 * 864e5));
    const otro = t.refTurno === 'tarde' ? 'mañana' : 'tarde';
    return Math.abs(semanas) % 2 === 0 ? t.refTurno : otro;
  }
  // Comidas que esa semana hace en el trabajo (con microondas): [{ dia: 1..7, momento }]
  function comidasEnTrabajo(persona, lunes) {
    if (turnoSemana(persona, lunes) !== 'tarde') return [];
    const t = persona.turnos;
    const out = [];
    (t.diasTrabajo || []).forEach(d => (t.comidasTrabajo || []).forEach(m => out.push({ dia: d, momento: m })));
    return out;
  }

  // ───────────────────────── Datos de la persona ─────────────────────────
  // Lee del estado de la app de entreno lo que haga falta. Acepta tanto el formato actual
  // (bodyProfile[u] = { sex, height, entreno: { objetivo, dias, minutos, nivel } }, bodyLog[u] = [{ date, weight, bodyFat, neck, waist, hip }])
  // como datos ya preparados ({ sexo, altura, pesos: [{fecha, kg}], grasa, objetivos, dias, minutos, nivel }).
  function datosPersona(estado, u) {
    if (estado && estado.datosNutri && estado.datosNutri[u]) return estado.datosNutri[u];
    const prof = ((estado || {}).bodyProfile || {})[u] || {};
    const ent = prof.entreno || {};
    const log = (((estado || {}).bodyLog || {})[u] || []).filter(e => e && e.weight).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const ult = log[log.length - 1] || {};
    let grasa = ult.bodyFat != null ? +ult.bodyFat : null;
    if (grasa == null && prof.height && ult.neck && ult.waist) grasa = grasaNavy(prof.sex, prof.height, ult.neck, ult.waist, ult.hip);
    let objetivos = ent.objetivos || ent.objetivo || prof.objetivos || [];
    if (!Array.isArray(objetivos)) objetivos = [objetivos];
    return {
      sexo: prof.sex === 'f' ? 'f' : 'm',
      altura: +prof.height || null,
      pesos: log.map(e => ({ fecha: e.date, kg: +e.weight })),
      grasa,
      objetivos: objetivos.filter(Boolean),
      dias: +ent.dias || null,
      minutos: +ent.minutos || null,
      nivel: ent.nivel || null,
      pesoObjetivo: (prof.goals || {}).weight || null,
    };
  }

  function grasaNavy(sex, height, neck, waist, hip) {
    if (!height || !neck || !waist) return null;
    if (sex === 'f' && !hip) return null;
    const v = sex === 'f'
      ? 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450
      : 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    return isFinite(v) && v > 2 && v < 60 ? Math.round(v * 10) / 10 : null;
  }

  // Tendencia del peso en kg/semana con los registros de las últimas 4 semanas (regresión lineal).
  function tendencia(pesos, hoy) {
    const fin = hoy ? new Date(hoy) : new Date();
    const desde = new Date(fin); desde.setDate(desde.getDate() - 28);
    const p = (pesos || []).filter(x => new Date(x.fecha) >= desde && new Date(x.fecha) <= fin);
    if (p.length < 3) return null;
    const dias = (new Date(p[p.length - 1].fecha) - new Date(p[0].fecha)) / 864e5;
    if (dias < 10) return null;
    const xs = p.map(x => (new Date(x.fecha) - new Date(p[0].fecha)) / 864e5), ys = p.map(x => x.kg);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) * (x - mx); });
    return den ? Math.round(num / den * 7 * 100) / 100 : null;
  }

  // ───────────────────────── Energía y macros ─────────────────────────
  const NEAT = { sentado: 1.2, ligera: 1.3, 'de pie': 1.4, activo: 1.55 };
  const MET_SESION = 5; // entreno de fuerza con algo de cardio o piscina, intensidad media

  // Objetivo de cada uno. Devuelve también "faltan" (datos que hay que pedir) y "como" (explicación del cálculo).
  function objetivosPersona(persona, datos, opts) {
    opts = opts || {};
    const faltan = [];
    const peso = datos.pesos && datos.pesos.length ? datos.pesos[datos.pesos.length - 1].kg : null;
    const anio = (opts.hoy ? new Date(opts.hoy) : new Date()).getFullYear();
    const edad = persona.nacimiento ? anio - persona.nacimiento : null;
    if (!peso) faltan.push('peso');
    if (!datos.altura) faltan.push('altura');
    if (!edad) faltan.push('año de nacimiento');
    if (faltan.length) return { faltan };

    const como = [];
    // 1. Metabolismo basal
    let basal;
    if (datos.grasa != null) {
      const magra = peso * (1 - datos.grasa / 100);
      basal = 370 + 21.6 * magra;
      como.push(`Metabolismo basal ${r(basal)} kcal (Katch-McArdle con ${r(magra)} kg de masa magra, ${coma(datos.grasa)} % de grasa).`);
    } else {
      basal = 10 * peso + 6.25 * datos.altura - 5 * edad + (datos.sexo === 'f' ? -161 : 5);
      como.push(`Metabolismo basal ${r(basal)} kcal (Mifflin-St Jeor: ${peso} kg, ${datos.altura} cm, ${edad} años).`);
    }
    // 2. Actividad fuera del entreno
    const f = NEAT[persona.actividad] || NEAT.ligera;
    const base = basal * f;
    como.push(`Día sin entreno ${r(base)} kcal (actividad «${persona.actividad || 'ligera'}», ×${coma(f)}).`);
    // 3. Gasto de cada sesión
    const minutos = opts.minutos || datos.minutos || 60;
    const sesion = (MET_SESION - 1) * peso * minutos / 60;
    como.push(`Cada sesión de ${minutos} min suma unas ${r(sesion)} kcal.`);

    // 4. Ajuste por objetivo (puede haber varios)
    const obj = (datos.objetivos || []).map(normalizarObjetivo).filter(Boolean);
    const tiene = k => obj.includes(k);
    let ajuste = 0, protKg = 1.6, etiqueta = 'mantener';
    if (tiene('perder') && (tiene('musculo') || tiene('fuerza') || tiene('tonificar'))) { ajuste = -0.15; protKg = 2.0; etiqueta = 'recomposición (perder grasa manteniendo o ganando músculo)'; }
    else if (tiene('perder')) { ajuste = -0.2; protKg = 2.0; etiqueta = 'perder grasa'; }
    else if (tiene('musculo')) { ajuste = datos.nivel === 'avanzado' ? 0.05 : 0.1; protKg = 1.8; etiqueta = 'ganar músculo'; }
    else if (tiene('tonificar')) { ajuste = -0.1; protKg = 1.8; etiqueta = 'tonificar'; }
    else if (tiene('fuerza')) { ajuste = 0.05; protKg = 1.8; etiqueta = 'fuerza'; }
    else if (tiene('salud')) { ajuste = 0; protKg = 1.4; etiqueta = 'salud'; }

    // 5. Corrección por cómo va el peso las últimas semanas
    const tend = tendencia(datos.pesos, opts.hoy);
    let nota = null;
    if (tend != null) {
      const pct = tend / peso * 100;
      if (ajuste < 0 && tend > -0.1) { ajuste -= 0.05; nota = `En 4 semanas el peso no baja (${signo(tend)} kg/semana): recorto un 5 % más.`; }
      else if (ajuste < 0 && pct < -1) { ajuste += 0.05; nota = `Bajas más del 1 % por semana (${signo(tend)} kg): subo un 5 % para no perder músculo.`; }
      else if (ajuste > 0 && pct > 0.5) { ajuste -= 0.04; nota = `Subes más de lo recomendable (${signo(tend)} kg/semana): bajo un poco el superávit.`; }
      else if (ajuste > 0 && tend < 0.05) { ajuste += 0.04; nota = `El peso no sube (${signo(tend)} kg/semana): añado un 4 %.`; }
      else nota = `Tendencia del peso: ${signo(tend)} kg/semana, va según lo previsto.`;
    }

    // Peso de referencia para proteína y grasa (con sobrepeso se usa el peso a IMC 25 más un 25 % del exceso)
    const imc = peso / Math.pow(datos.altura / 100, 2);
    const ref = imc > 27 ? (25 * Math.pow(datos.altura / 100, 2)) + 0.25 * (peso - 25 * Math.pow(datos.altura / 100, 2)) : peso;

    // Límites de seguridad: déficit como mucho del 25 % y 750 kcal; superávit como mucho del 15 %.
    ajuste = Math.max(-0.25, Math.min(0.15, ajuste));
    const dia = (extra) => {
      const gasto = base + extra;
      let kcal = gasto + Math.max(gasto * ajuste, -750) + (persona.ajusteKcal || 0);
      kcal = Math.max(kcal, basal * 1.05, datos.sexo === 'f' ? 1300 : 1500);
      const prot = protKg * ref;
      const grasa = Math.max(0.8 * ref, kcal * 0.25 / 9);
      const hc = Math.max(0, (kcal - prot * 4 - grasa * 9) / 4);
      return { kcal: r(kcal, 10), proteina: r(prot), grasa: r(grasa), hidratos: r(hc), fibra: r(kcal / 1000 * 14) };
    };
    como.push(`Objetivo: ${etiqueta} (${ajuste >= 0 ? '+' : ''}${r(ajuste * 100)} % sobre el gasto)${persona.ajusteKcal ? `, más tu ajuste manual de ${signo(persona.ajusteKcal)} kcal` : ''}.`);
    if (nota) como.push(nota);
    como.push(`Proteína ${coma(protKg)} g por kg${ref !== peso ? ` de peso de referencia (${r(ref)} kg)` : ''}; grasa mínimo 0,8 g/kg y 25 % de las kcal; el resto, hidratos.`);
    return {
      faltan: [], objetivo: etiqueta, edad, peso, tendencia: tend,
      descanso: dia(0), entreno: dia(sesion),
      agua: { descanso: r(peso * 35, 100), entreno: r(peso * 35 + 500 * minutos / 60, 100) },
      como,
    };
  }
  function normalizarObjetivo(o) {
    const s = String(o || '').toLowerCase();
    if (/perd|grasa|adelgaz|defin/.test(s)) return 'perder';
    if (/m[uú]sc|hipert|volum/.test(s)) return 'musculo';
    if (/fuerz/.test(s)) return 'fuerza';
    if (/tonif/.test(s)) return 'tonificar';
    if (/salud|movil|rehab/.test(s)) return 'salud';
    if (/mant/.test(s)) return 'mantener';
    return null;
  }
  const r = (v, a) => { a = a || 1; return Math.round(v / a) * a; };
  const coma = v => String(v).replace('.', ',');
  const signo = v => (v > 0 ? '+' : '') + String(v).replace('.', ',');

  // Reparto de un día entre las comidas que hace esa persona.
  function repartoComidas(comidas, total) {
    const lista = (comidas && comidas.length ? comidas : ['desayuno', 'comida', 'cena']);
    const suma = lista.reduce((a, m) => a + (REPARTO[m] || 10), 0);
    const out = {};
    lista.forEach(m => { out[m] = { kcal: r(total.kcal * (REPARTO[m] || 10) / suma, 10), proteina: r(total.proteina * (REPARTO[m] || 10) / suma) }; });
    return out;
  }

  // ───────────────────────── Petición al agente ─────────────────────────
  // semana: { lunes, entreno: { him: [1,3,5], her: [...] }, minutos: {him, her}, quien: ['him','her'], turnos: { him: 'tarde' } (opcional, fuerza el turno) }
  function peticionMenu(nutri, estado, semana, nombres) {
    nutri = completar(nutri);
    const lunes = semana.lunes || lunesDe();
    const personas = {};
    const faltan = {};
    (semana.quien || ['him', 'her']).forEach(u => {
      const p = nutri.personas[u];
      const d = datosPersona(estado, u);
      const o = objetivosPersona(p, d, { minutos: (semana.minutos || {})[u] });
      if (o.faltan.length) { faltan[u] = o.faltan; return; }
      const pTurno = Object.assign({}, p, { turnos: Object.assign({}, p.turnos, (semana.turnos || {})[u] ? { excepciones: { [lunes]: semana.turnos[u] } } : {}) });
      const diasEntreno = ((semana.entreno || {})[u] || diasPorDefecto(d.dias)).map(Number).filter(n => n >= 1 && n <= 7);
      personas[u] = {
        nombre: (nombres || {})[u] || u,
        sexo: d.sexo === 'f' ? 'mujer' : 'hombre', edad: o.edad, pesoKg: o.peso, alturaCm: d.altura, grasaPct: d.grasa,
        objetivo: o.objetivo, nivel: d.nivel,
        diasEntreno, minutosSesion: (semana.minutos || {})[u] || d.minutos || 60,
        objetivoDiaEntreno: o.entreno, objetivoDiaDescanso: o.descanso,
        repartoDiaEntreno: repartoComidas(p.comidas, o.entreno),
        comidas: p.comidas,
        turno: turnoSemana(pTurno, lunes),
        comidasEnTrabajo: comidasEnTrabajo(pTurno, lunes),
        alergias: p.alergias, noGusta: p.noGusta,
      };
    });
    // Recetas de las 2 semanas anteriores, para no repetir, y lo que han valorado
    const recientes = [];
    [-7, -14].forEach(n => { const m = nutri.menus[sumarDias(lunes, n)]; if (m && m.menu) (m.menu.recetas || []).forEach(x => recientes.push(x.nombre)); });
    const valoradas = { gustan: [], noGustan: [] };
    Object.entries(nutri.valoraciones).forEach(([k, v]) => { if (v >= 3) valoradas.gustan.push(k); else if (v <= 1) valoradas.noGustan.push(k); });
    return {
      faltan,
      peticion: {
        semana: { lunes, domingo: sumarDias(lunes, 6) },
        personas,
        hogar: {
          alergias: nutri.hogar.alergias, noGusta: nutri.hogar.noGusta, gustan: nutri.hogar.gustan,
          enCasa: (nutri.hogar.despensa || []).map(x => typeof x === 'string' ? x : (x.nombre + (x.cantidad ? ` (${x.cantidad})` : ''))),
          minutosEntreSemana: nutri.hogar.minutosEntreSemana, batchDomingo: nutri.hogar.batchDomingo,
          platosDelMundo: nutri.hogar.platosDelMundo, notas: nutri.hogar.notas,
        },
        recetasRecientes: [...new Set(recientes)].slice(0, 60),
        valoraciones: valoradas,
      },
    };
  }
  function diasPorDefecto(n) {
    const m = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
    return m[Math.max(1, Math.min(7, n || 3))];
  }

  // ───────────────────────── Lista de la compra ─────────────────────────
  // Suma los ingredientes de todas las comidas de la semana con las raciones de cada persona.
  const clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  function singular(s) { return s.replace(/(es|s)$/,''); }
  function listaCompra(menu, despensa) {
    if (!menu) return { secciones: [], enCasa: [] };
    const recetas = {}; (menu.recetas || []).forEach(x => { recetas[x.id] = x; });
    const tot = {};
    (menu.dias || []).forEach(d => (d.comidas || []).forEach(c => {
      const rec = recetas[c.recetaId]; if (!rec) return;
      (rec.ingredientes || []).forEach(i => {
        const cant = (c.him ? +i.him || 0 : 0) + (c.her ? +i.her || 0 : 0);
        if (!cant) return;
        const k = singular(clave(i.nombre)) + '|' + i.unidad;
        if (!tot[k]) tot[k] = { nombre: i.nombre, unidad: i.unidad, seccion: i.seccion || 'otros', cantidad: 0, recetas: new Set() };
        tot[k].cantidad += cant; tot[k].recetas.add(rec.nombre);
      });
    }));
    const casa = (despensa || []).map(x => singular(clave(typeof x === 'string' ? x : x.nombre))).filter(Boolean);
    const enCasa = [], porSeccion = {};
    Object.entries(tot).forEach(([k, x]) => {
      const item = { id: k, nombre: x.nombre, unidad: x.unidad, seccion: x.seccion, cantidad: redondearCompra(x.cantidad, x.unidad), texto: textoCantidad(x.cantidad, x.unidad), recetas: [...x.recetas] };
      const n = k.split('|')[0];
      if (casa.some(c => n === c || n.includes(c) || c.includes(n))) enCasa.push(item);
      else (porSeccion[item.seccion] = porSeccion[item.seccion] || []).push(item);
    });
    const secciones = SECCIONES.filter(s => porSeccion[s]).concat(Object.keys(porSeccion).filter(s => !SECCIONES.includes(s)))
      .map(s => ({ seccion: s, items: porSeccion[s].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }));
    return { secciones, enCasa };
  }
  function redondearCompra(v, u) { if (u === 'ud') return Math.ceil(v * 2) / 2; return v >= 1000 ? Math.ceil(v / 50) * 50 : Math.ceil(v / 10) * 10; }
  function textoCantidad(v, u) {
    v = redondearCompra(v, u);
    if (u === 'g') return v >= 1000 ? `${String(Math.round(v / 100) / 10).replace('.', ',')} kg` : `${v} g`;
    if (u === 'ml') return v >= 1000 ? `${String(Math.round(v / 100) / 10).replace('.', ',')} l` : `${v} ml`;
    return `${String(v).replace('.', ',')} ud`;
  }

  // Totales del día por persona según el menú (estimación del agente) frente al objetivo.
  function totalesDia(menu, dia, u) {
    const recetas = {}; (menu.recetas || []).forEach(x => { recetas[x.id] = x; });
    const d = (menu.dias || []).find(x => x.dia === dia); if (!d) return null;
    const t = { kcal: 0, proteina: 0, hidratos: 0, grasa: 0 };
    d.comidas.forEach(c => { if (!c[u]) return; const n = (recetas[c.recetaId] || {}).nutricion; if (!n || !n[u]) return; Object.keys(t).forEach(k => { t[k] += +n[u][k] || 0; }); });
    Object.keys(t).forEach(k => { t[k] = Math.round(t[k]); });
    return t;
  }

  // Valorar una receta (1 no, 2 normal, 3 gusta). Se guarda por nombre para que el agente lo tenga en cuenta.
  function valorar(nutri, nombre, v) { nutri.valoraciones[clave(nombre)] = v; return nutri; }

  // Guarda un menú generado. Si ya había uno esa semana, conserva lo marcado de la compra.
  function guardarMenu(nutri, lunes, menu, objetivos) {
    const prev = nutri.menus[lunes];
    nutri.menus[lunes] = { creado: new Date().toISOString(), menu, objetivos, compra: prev ? prev.compra : { marcados: {}, extra: [] } };
    nutri.actualizado = new Date().toISOString();
    return nutri;
  }
  // Sustituye una receta (cambio de un plato) en todas las comidas donde aparecía.
  function sustituirReceta(nutri, lunes, idViejo, nueva) {
    const m = nutri.menus[lunes]; if (!m) return nutri;
    nueva.id = nueva.id && !m.menu.recetas.some(x => x.id === nueva.id) ? nueva.id : idViejo + '-b';
    m.menu.recetas = m.menu.recetas.filter(x => x.id !== idViejo).concat(nueva);
    m.menu.dias.forEach(d => d.comidas.forEach(c => { if (c.recetaId === idViejo) c.recetaId = nueva.id; }));
    nutri.actualizado = new Date().toISOString();
    return nutri;
  }

  return {
    MOMENTOS, SECCIONES, UNIDADES, OBJETIVOS, REPARTO,
    vacio, completar, personaVacia,
    lunesDe, sumarDias, turnoSemana, comidasEnTrabajo,
    datosPersona, grasaNavy, tendencia, objetivosPersona, repartoComidas, normalizarObjetivo,
    peticionMenu, diasPorDefecto,
    listaCompra, textoCantidad, totalesDia, valorar, guardarMenu, sustituirReceta, clave,
  };
});
