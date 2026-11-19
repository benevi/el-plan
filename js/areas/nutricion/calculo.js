// Área NUTRICIÓN · lógica sin pantalla.
// - Objetivo diario de cada persona (kcal, proteína, grasa, hidratos, fibra, agua) calculado aquí, no por la IA,
//   con el perfil compartido (sexo, altura, nacimiento, objetivos, días y minutos de entreno) y las medidas.
// - «Ficha» de cada persona: el resumen que cada móvil publica para que el menú se haga para los dos.
// - Turnos de trabajo que alternan cada semana, petición al agente, lista de la compra y cambios de plato.

export const PERSONAS_N = ['victor', 'virginia'];
export const MOMENTOS = ['desayuno', 'media mañana', 'comida', 'merienda', 'cena', 'post-entreno'];
const REPARTO = { desayuno: 25, 'media mañana': 10, comida: 35, merienda: 10, cena: 25, 'post-entreno': 10 };
export const SECCIONES = ['frutas y verduras', 'carnes', 'pescados', 'huevos y lácteos', 'panadería y cereales', 'legumbres', 'despensa', 'aceites y especias', 'congelados', 'conservas', 'frutos secos', 'bebidas', 'otros'];
export const ACTIVIDAD = { sentado: 'Sentado casi todo el día', ligera: 'Algo de movimiento', 'de pie': 'De pie casi todo el día', activo: 'Trabajo físico' };

// ───────── Modelo (vive en estado().nutricion) ─────────
// yo: lo propio de este móvil que no está en el perfil.
// compartido: lo común a los dos (se sincronizará entre móviles): hogar, fichas, menús y valoraciones.
export function yoVacio() {
  return {
    actividad: 'ligera', comidas: ['desayuno', 'media mañana', 'comida', 'merienda', 'cena'], ajusteKcal: 0,
    alergias: [], noGusta: [],
    turnos: { activo: false, refLunes: null, refTurno: 'tarde', comidasTrabajo: ['cena'], diasTrabajo: [1, 2, 3, 4, 5], excepciones: {} },
  };
}
export function compartidoVacio() {
  return {
    hogar: { alergias: [], noGusta: [], gustan: [], despensa: [], minutosEntreSemana: 30, batchDomingo: true, platosDelMundo: 2, actualizado: null },
    fichas: {},       // { victor: ficha, virginia: ficha }
    menus: {},        // por lunes 'YYYY-MM-DD': { creado, por, semana, menu, compra: { marcados, extra } }
    valoraciones: {}, // nombre de receta normalizado → 1 no | 2 normal | 3 gusta
  };
}
export function asegurar(S) {
  const n = S.nutricion = S.nutricion || {};
  n.yo = Object.assign(yoVacio(), n.yo || {});
  n.yo.turnos = Object.assign(yoVacio().turnos, n.yo.turnos || {});
  n.compartido = Object.assign(compartidoVacio(), n.compartido || {});
  n.compartido.hogar = Object.assign(compartidoVacio().hogar, n.compartido.hogar || {});
  return n;
}

// ───────── Fechas y turnos ─────────
const iso = d => { const x = new Date(d); return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())).toISOString().slice(0, 10); };
export function lunesDe(d) { const x = d ? new Date(typeof d === 'string' && d.length === 10 ? d + 'T12:00' : d) : new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); }
export function sumarDias(isoStr, n) { const x = new Date(isoStr + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); }

export function turnoSemana(turnos, lunes) {
  if (!turnos || !turnos.activo || !turnos.refLunes) return null;
  if (turnos.excepciones && turnos.excepciones[lunes]) return turnos.excepciones[lunes];
  const semanas = Math.round((new Date(lunes + 'T12:00:00') - new Date(lunesDe(turnos.refLunes) + 'T12:00:00')) / (7 * 864e5));
  return Math.abs(semanas) % 2 === 0 ? turnos.refTurno : (turnos.refTurno === 'tarde' ? 'mañana' : 'tarde');
}
export function comidasEnTrabajo(turnos, lunes) {
  if (turnoSemana(turnos, lunes) !== 'tarde') return [];
  const out = [];
  (turnos.diasTrabajo || []).forEach(d => (turnos.comidasTrabajo || []).forEach(m => out.push({ dia: d, momento: m })));
  return out;
}

// ───────── Datos de la persona (perfil compartido + medidas) ─────────
export function grasaNavy(sexo, altura, cuello, cintura, cadera) {
  if (!altura || !cuello || !cintura) return null;
  if (sexo === 'm' && !cadera) return null;
  const v = sexo === 'm'
    ? 495 / (1.29579 - 0.35004 * Math.log10(cintura + cadera - cuello) + 0.22100 * Math.log10(altura)) - 450
    : 495 / (1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(altura)) - 450;
  return isFinite(v) && v > 2 && v < 60 ? Math.round(v * 10) / 10 : null;
}
// sexo: 'h' hombre, 'm' mujer (como en el perfil).
export function datosPersona(S, hoy) {
  const p = S.perfil || {}, d = p.datos || {};
  const med = (S.medidas || []).filter(m => m && m.peso).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ult = med[med.length - 1] || {};
  const conCintura = (S.medidas || []).filter(m => m.cintura && m.cuello).sort((a, b) => a.fecha.localeCompare(b.fecha)).pop() || {};
  let grasa = ult.grasa != null ? +ult.grasa : null;
  if (grasa == null) grasa = grasaNavy(d.sexo, +d.altura, +conCintura.cuello, +conCintura.cintura, +conCintura.cadera);
  const ref = hoy ? new Date(hoy) : new Date();
  const edad = d.nacimiento ? Math.floor((ref - new Date(d.nacimiento)) / (365.25 * 864e5)) : null;
  const disp = p.disponibilidad || {};
  return {
    sexo: d.sexo || null, altura: +d.altura || null, edad,
    pesos: med.map(m => ({ fecha: m.fecha, kg: +m.peso })), grasa,
    objetivos: (p.objetivos || []).slice(), nivel: p.nivel || 1,
    dias: +disp.dias || 3, minutos: +disp.minutos || 60, diasSemana: (disp.diasSemana || []).map(Number),
  };
}

// Semana ISO 'YYYY-Www' (la misma forma que plan.semana en nucleo/modelo.js).
export function semanaDe(lunes) {
  const t = new Date(lunes + 'T12:00:00Z');
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - ini) / 864e5 + 1) / 7)).padStart(2, '0');
}
// Días que entrena la semana del lunes dado: los del plan si es de esa semana, si no los de su disponibilidad.
export function diasEntreno(S, lunes) {
  const plan = S.plan;
  if (plan && Array.isArray(plan.dias) && plan.dias.length && plan.semana === semanaDe(lunes)) return [...new Set(plan.dias.map(d => +d.diaSemana))].sort();
  const d = datosPersona(S);
  return d.diasSemana.length ? d.diasSemana.slice().sort() : diasPorDefecto(d.dias);
}
export function diasPorDefecto(n) {
  const m = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
  return m[Math.max(1, Math.min(7, n || 3))];
}

export function tendencia(pesos, hoy) {
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

// ───────── Energía y macros ─────────
const NEAT = { sentado: 1.2, ligera: 1.3, 'de pie': 1.4, activo: 1.55 };
const MET_SESION = 5;
const r = (v, a = 1) => Math.round(v / a) * a;
const coma = v => String(v).replace('.', ',');
const signo = v => (v > 0 ? '+' : '') + coma(v);

export function objetivosPersona(yo, datos, opts = {}) {
  const faltan = [];
  const peso = datos.pesos && datos.pesos.length ? datos.pesos[datos.pesos.length - 1].kg : null;
  if (!peso) faltan.push('peso (en Progreso → Medidas)');
  if (!datos.altura) faltan.push('altura (en Perfil)');
  if (!datos.edad) faltan.push('fecha de nacimiento (en Perfil)');
  if (!datos.sexo) faltan.push('sexo (en Perfil)');
  if (faltan.length) return { faltan };
  const mujer = datos.sexo === 'm';

  const como = [];
  let basal;
  if (datos.grasa != null) {
    const magra = peso * (1 - datos.grasa / 100);
    basal = 370 + 21.6 * magra;
    como.push(`Metabolismo basal ${r(basal)} kcal (Katch-McArdle con ${r(magra)} kg de masa magra, ${coma(datos.grasa)} % de grasa).`);
  } else {
    basal = 10 * peso + 6.25 * datos.altura - 5 * datos.edad + (mujer ? -161 : 5);
    como.push(`Metabolismo basal ${r(basal)} kcal (Mifflin-St Jeor: ${coma(peso)} kg, ${datos.altura} cm, ${datos.edad} años).`);
  }
  const f = NEAT[yo.actividad] || NEAT.ligera;
  const base = basal * f;
  como.push(`Día sin entreno ${r(base)} kcal (actividad «${yo.actividad || 'ligera'}», ×${coma(f)}).`);
  const minutos = opts.minutos || datos.minutos || 60;
  const sesion = (MET_SESION - 1) * peso * minutos / 60;
  como.push(`Cada sesión de ${minutos} min suma unas ${r(sesion)} kcal.`);

  const obj = datos.objetivos || [];
  const tiene = k => obj.includes(k);
  let ajuste = 0, protKg = 1.6, etiqueta = 'mantener el peso';
  if (tiene('perder') && (tiene('musculo') || tiene('fuerza'))) { ajuste = -0.15; protKg = 2.0; etiqueta = 'recomposición: perder grasa manteniendo o ganando músculo'; }
  else if (tiene('perder')) { ajuste = -0.2; protKg = 2.0; etiqueta = 'perder grasa'; }
  else if (tiene('musculo')) { ajuste = datos.nivel >= 3 ? 0.05 : 0.1; protKg = 1.8; etiqueta = 'ganar músculo'; }
  else if (tiene('fuerza')) { ajuste = 0.05; protKg = 1.8; etiqueta = 'ganar fuerza'; }
  else if (tiene('resistencia') || tiene('natacion')) { ajuste = 0; protKg = 1.6; etiqueta = 'rendimiento y resistencia'; }
  else if (tiene('salud')) { ajuste = 0; protKg = 1.4; etiqueta = 'salud'; }

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
  ajuste = Math.max(-0.25, Math.min(0.15, ajuste));

  const m2 = Math.pow(datos.altura / 100, 2);
  const imc = peso / m2;
  const ref = imc > 27 ? 25 * m2 + 0.25 * (peso - 25 * m2) : peso;
  const dia = extra => {
    const gasto = base + extra;
    let kcal = gasto + Math.max(gasto * ajuste, -750) + (+yo.ajusteKcal || 0);
    kcal = Math.max(kcal, basal * 1.05, mujer ? 1300 : 1500);
    const prot = protKg * ref;
    const grasa = Math.max(0.8 * ref, kcal * 0.25 / 9);
    const hc = Math.max(0, (kcal - prot * 4 - grasa * 9) / 4);
    return { kcal: r(kcal, 10), proteina: r(prot), grasa: r(grasa), hidratos: r(hc), fibra: r(kcal / 1000 * 14) };
  };
  como.push(`Objetivo: ${etiqueta} (${ajuste >= 0 ? '+' : ''}${r(ajuste * 100)} % sobre el gasto)${+yo.ajusteKcal ? `, más tu ajuste manual de ${signo(+yo.ajusteKcal)} kcal` : ''}.`);
  if (nota) como.push(nota);
  como.push(`Proteína ${coma(protKg)} g por kg${Math.abs(ref - peso) > 0.5 ? ` de peso de referencia (${r(ref)} kg)` : ''}; grasa mínimo 0,8 g/kg y 25 % de las kcal; el resto, hidratos.`);
  return {
    faltan: [], objetivo: etiqueta, edad: datos.edad, peso, tendencia: tend,
    descanso: dia(0), entreno: dia(sesion), minutos,
    agua: { descanso: r(peso * 35, 100), entreno: r(peso * 35 + 500 * minutos / 60, 100) },
    como,
  };
}

export function repartoComidas(comidas, total) {
  const lista = comidas && comidas.length ? comidas : ['desayuno', 'comida', 'cena'];
  const suma = lista.reduce((a, m) => a + (REPARTO[m] || 10), 0);
  const out = {};
  lista.forEach(m => { out[m] = { kcal: r(total.kcal * (REPARTO[m] || 10) / suma, 10), proteina: r(total.proteina * (REPARTO[m] || 10) / suma) }; });
  return out;
}

// Ficha que este móvil publica para el menú común. Se rehace cada vez con el perfil y las medidas actuales.
export function fichaPropia(S, dueño, nombre, lunes) {
  const n = asegurar(S);
  const d = datosPersona(S);
  const o = objetivosPersona(n.yo, d);
  if (o.faltan.length) return { faltan: o.faltan };
  return {
    nombre, actualizado: new Date().toISOString(),
    sexo: d.sexo === 'm' ? 'mujer' : 'hombre', edad: o.edad, pesoKg: o.peso, alturaCm: d.altura, grasaPct: d.grasa,
    objetivo: o.objetivo, nivel: d.nivel, minutosSesion: o.minutos,
    diasEntreno: diasEntreno(S, lunes),
    objetivoDiaEntreno: o.entreno, objetivoDiaDescanso: o.descanso,
    comidas: n.yo.comidas.slice(), alergias: n.yo.alergias.slice(), noGusta: n.yo.noGusta.slice(),
    turnos: JSON.parse(JSON.stringify(n.yo.turnos)),
  };
}

// ───────── Petición al agente ─────────
// fichas: { victor: ficha, virginia: ficha } de las personas que comen ese menú.
export function peticionMenu(compartido, fichas, lunes, entreno) {
  const personas = {};
  Object.entries(fichas).forEach(([k, f]) => {
    const dias = (entreno && entreno[k]) || f.diasEntreno || [];
    personas[k] = {
      nombre: f.nombre, sexo: f.sexo, edad: f.edad, pesoKg: f.pesoKg, alturaCm: f.alturaCm, grasaPct: f.grasaPct,
      objetivo: f.objetivo, nivel: f.nivel, diasEntreno: dias, minutosSesion: f.minutosSesion,
      objetivoDiaEntreno: f.objetivoDiaEntreno, objetivoDiaDescanso: f.objetivoDiaDescanso,
      repartoDiaEntreno: repartoComidas(f.comidas, f.objetivoDiaEntreno),
      comidas: f.comidas, alergias: f.alergias, noGusta: f.noGusta,
      turno: turnoSemana(f.turnos, lunes), comidasEnTrabajo: comidasEnTrabajo(f.turnos, lunes),
    };
  });
  const recientes = [];
  [-7, -14].forEach(n => { const m = compartido.menus[sumarDias(lunes, n)]; if (m && m.menu) (m.menu.recetas || []).forEach(x => recientes.push(x.nombre)); });
  const valoraciones = { gustan: [], noGustan: [] };
  Object.entries(compartido.valoraciones).forEach(([k, v]) => { if (v >= 3) valoraciones.gustan.push(k); else if (v <= 1) valoraciones.noGustan.push(k); });
  const H = compartido.hogar;
  return {
    semana: { lunes, domingo: sumarDias(lunes, 6) },
    personas,
    hogar: { alergias: H.alergias, noGusta: H.noGusta, gustan: H.gustan, enCasa: H.despensa, minutosEntreSemana: H.minutosEntreSemana, batchDomingo: H.batchDomingo, platosDelMundo: H.platosDelMundo },
    recetasRecientes: [...new Set(recientes)].slice(0, 60),
    valoraciones,
  };
}

// ───────── Lista de la compra ─────────
export const clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const singular = s => s.replace(/(es|s)$/, '');
const redondear = (v, u) => u === 'ud' ? Math.ceil(v * 2) / 2 : (v >= 1000 ? Math.ceil(v / 50) * 50 : Math.ceil(v / 10) * 10);
export function textoCantidad(v, u) {
  v = redondear(v, u);
  if (u === 'g') return v >= 1000 ? `${coma(Math.round(v / 100) / 10)} kg` : `${v} g`;
  if (u === 'ml') return v >= 1000 ? `${coma(Math.round(v / 100) / 10)} l` : `${v} ml`;
  return `${coma(v)} ud`;
}
export const racion = (v, u) => coma(Math.round(v * 10) / 10) + (u === 'ud' ? ' ud' : ' ' + u);

export function listaCompra(menu, despensa) {
  if (!menu) return { secciones: [], enCasa: [] };
  const recetas = {}; (menu.recetas || []).forEach(x => { recetas[x.id] = x; });
  const tot = {};
  (menu.dias || []).forEach(d => (d.comidas || []).forEach(c => {
    const rec = recetas[c.recetaId]; if (!rec) return;
    (rec.ingredientes || []).forEach(i => {
      const cant = PERSONAS_N.reduce((a, u) => a + (c[u] ? +i[u] || 0 : 0), 0);
      if (!cant) return;
      const k = singular(clave(i.nombre)) + '|' + i.unidad;
      if (!tot[k]) tot[k] = { nombre: i.nombre, unidad: i.unidad, seccion: i.seccion || 'otros', cantidad: 0, recetas: new Set() };
      tot[k].cantidad += cant; tot[k].recetas.add(rec.nombre);
    });
  }));
  const casa = (despensa || []).map(x => singular(clave(x))).filter(Boolean);
  const enCasa = [], porSeccion = {};
  Object.entries(tot).forEach(([k, x]) => {
    const item = { id: k, nombre: x.nombre, unidad: x.unidad, seccion: x.seccion, texto: textoCantidad(x.cantidad, x.unidad), recetas: [...x.recetas] };
    const n = k.split('|')[0];
    if (casa.some(c => n === c || n.includes(c) || c.includes(n))) enCasa.push(item);
    else (porSeccion[item.seccion] = porSeccion[item.seccion] || []).push(item);
  });
  const secciones = SECCIONES.filter(s => porSeccion[s]).concat(Object.keys(porSeccion).filter(s => !SECCIONES.includes(s)))
    .map(s => ({ seccion: s, items: porSeccion[s].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }));
  return { secciones, enCasa };
}

export function totalesDia(menu, dia, u) {
  const recetas = {}; (menu.recetas || []).forEach(x => { recetas[x.id] = x; });
  const d = (menu.dias || []).find(x => x.dia === dia); if (!d) return null;
  const t = { kcal: 0, proteina: 0, hidratos: 0, grasa: 0 };
  d.comidas.forEach(c => { if (!c[u]) return; const n = (recetas[c.recetaId] || {}).nutricion; if (!n || !n[u]) return; Object.keys(t).forEach(k => { t[k] += +n[u][k] || 0; }); });
  Object.keys(t).forEach(k => { t[k] = Math.round(t[k]); });
  return t;
}

export function sustituirReceta(m, idViejo, nueva) {
  nueva.id = nueva.id && !m.menu.recetas.some(x => x.id === nueva.id) ? nueva.id : idViejo + '-b';
  m.menu.recetas = m.menu.recetas.filter(x => x.id !== idViejo).concat(nueva);
  m.menu.dias.forEach(d => d.comidas.forEach(c => { if (c.recetaId === idViejo) c.recetaId = nueva.id; }));
}

// ───────── Pasar datos al otro móvil (provisional, hasta tener sincronización) ─────────
// Mezcla lo recibido: fichas y hogar por fecha de actualización, menús por fecha de creación, valoraciones se suman.
export function mezclarCompartido(local, otro) {
  if (!otro || typeof otro !== 'object') throw new Error('No es un paquete de nutrición');
  Object.entries(otro.fichas || {}).forEach(([k, f]) => { if (!local.fichas[k] || (f.actualizado || '') > (local.fichas[k].actualizado || '')) local.fichas[k] = f; });
  if (otro.hogar && (otro.hogar.actualizado || '') > (local.hogar.actualizado || '')) local.hogar = Object.assign(compartidoVacio().hogar, otro.hogar);
  Object.entries(otro.menus || {}).forEach(([l, m]) => { if (!local.menus[l] || (m.creado || '') > (local.menus[l].creado || '')) local.menus[l] = m; });
  Object.assign(local.valoraciones, otro.valoraciones || {});
  return local;
}
