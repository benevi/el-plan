// Área ENTRENADOR · día de dolor alto (D2, C-DOLOR-4 de docs/criterio.md).
// Si el dolor de HOY de cualquier zona es ≥ 7: sin IA, sesión de plantilla fija con un bloque de cardio suave
// que no cargue ninguna zona activa (empieza con 4-6 min más suaves que hacen de calentamiento), movilidad
// sin dolor, estiramientos y respiración, llenando exactamente los minutos pedidos. Sin fuerza, sin
// rehabilitación de la zona y nada con riesgo en ninguna zona activa. La misma plantilla sirve para el día
// «solo suave» de los datos de salud (C-SALUD-0) con otra primera línea.

import { ex, ZONAS } from '../../reglas/catalogo.js';
import { contextoDia, opcionesCardio, permitidoBase, repartir, minus, lista, frase, nombreZona, techoDolor, fasesRehab, tareasFicha, tareaOk, tareaSinIdOk, libresDe, ESTIRA_SUAVE } from './dia.js';
import { T6 } from './alarma.js';

// Minutos → [bloque de cardio suave, de ellos el tramo inicial más suave, movilidad, estiramientos y respiración].
const TABLA = { 30: [20, 4, 5, 5], 45: [27, 5, 10, 8], 60: [34, 5, 14, 12], 75: [40, 6, 20, 15], 90: [45, 6, 25, 20] };
export function tablaDolorAlto(minutos) {
  const m = Math.max(30, Math.round(+minutos || 30));
  const fila = [90, 75, 60, 45, 30].find(x => x <= m);
  const [c, w, mv, est] = TABLA[fila];
  return { cardio: c + (m - fila), suave: w, movilidad: mv, estiramientos: est, total: m };
}
const MOV_LIBRE = { piscina: 'Movilidad suave en el agua', otro: 'Movilidad articular suave' };
// Nada con r en una zona activa ni que sea rehabilitación de una zona con dolor alto (C-DOLOR-4.3).
let altas = [];
const sinRiesgoEn = (e, zonas) => !zonas.some(z => (e.r || {})[z]) && !altas.some(z => fasesRehab(e, z).length);
const esEstiraId = id => /estiramiento|postura-nino/.test(id);

// ci: { lugar, minutos, dolorHoy }. motivo: texto de la primera línea (por defecto, T6 de la zona más dolorida).
export function diaDolorAlto(S, ci, { motivo } = {}) {
  const ctx = contextoDia(S, { lugar: ci.lugar, minutos: ci.minutos, dolorHoy: ci.dolorHoy || {} });
  // En D2 todas las zonas activas cuentan como dolor alto para el riesgo: nada con r en ninguna (C-DOLOR-4.3).
  Object.keys(ctx.niveles).forEach(z => { ctx.niveles[z] = 3; });
  const zonas = Object.keys(ctx.bandas);
  altas = Object.entries(ci.dolorHoy || {}).filter(([, v]) => +v >= 7).map(([z]) => z);
  const lugar = ctx.lugar;
  const t = tablaDolorAlto(ctx.minutos);
  const mayores60 = ctx.edad != null && ctx.edad >= 60;
  const suave = t.suave + (mayores60 ? 2 : 0);
  const [zMax, dMax] = Object.entries(ci.dolorHoy || {}).map(([z, v]) => [z, +v]).sort((a, b) => b[1] - a[1])[0] || [zonas[0], 7];

  // Cardio del bloque: sin impacto y sin r en ninguna zona activa (C-CARDIO-6), con la prueba de 2 minutos.
  const opciones = opcionesCardio(S, ctx, { sinRiesgo: true }).filter(e => !['comba', 'carrera-suave', 'jumping-jacks-sin-salto', 'step-bajo'].includes(e.id));
  const [c1, c2] = opciones;
  const ejercicios = [];
  const calentamiento = [];
  const explicacion = [motivo || T6(zMax, dMax, ctx.minutos)];
  let movExtra = 0;
  if (c1) {
    const alterna = c2 ? ` Si lo prefieres, alterna con ${minus(c2.n)}.` : '';
    calentamiento.push({ id: c1.id, nombre: `${c1.n}, muy suave`, detalle: 'Esfuerzo 2 de 10, como un paseo. Es el inicio del bloque de cardio.', duracion: `${suave - 2} min` });
    calentamiento.push({ id: c1.id, nombre: 'Prueba de 2 minutos', detalle: 'Mismo ejercicio, algo más vivo: si el dolor sube 1 punto o más, cambia de ejercicio; si sigue subiendo, para el cardio y pasa a movilidad.', duracion: '2 min' });
    ejercicios.push({ id: c1.id, rol: 'cardio', series: 1, reps: `${t.cardio - suave} min`, descanso: 0, nota: frase(`${t.cardio} min de cardio suave en total contando el inicio: esfuerzo 3 de 10, puedes hablar con frases completas. Si el dolor sube 1 punto o más, cambia de ejercicio; si sigue subiendo, para y pasa a movilidad`) + alterna });
    explicacion.push(`Cardio suave de ${t.cardio} minutos con ${minus(c1.n)}${c2 ? ` (o ${minus(c2.n)})` : ''}: ninguno carga ${lista(zonas.map(nombreZona))}.`);
  } else {
    // Ninguna opción del lugar sirve: el bloque pasa a movilidad y respiración, y se dice (C-DOLOR-4.5).
    movExtra = t.cardio;
    calentamiento.push({ nombre: MOV_LIBRE[lugar === 'piscina' ? 'piscina' : 'otro'], detalle: 'Círculos lentos de hombros, cadera y tobillos, sin dolor.', duracion: '3 min' });
    calentamiento.push({ nombre: 'Respiración', detalle: 'Sentado o de pie, 6 respiraciones lentas.', duracion: '2 min' });
    movExtra -= 5;
    explicacion.push('Hoy ningún cardio de este lugar respeta tu dolor: el bloque de cardio pasa a movilidad suave y respiración.');
  }

  // Movilidad sin dolor: libre en las zonas sin dolor; nada con r en las zonas activas y, de la zona dolorida,
  // como mucho 2 tareas que su ficha marque como «alivio» (C-DOLOR-4, C-EST-2, S2). Lo «normal» de una ficha
  // solo en B0-B1 (tareaOk).
  const vuelta = [];
  const movMin = t.movilidad + Math.max(0, movExtra);
  const altasF = altas.filter(z => ZONAS[z]);
  const deFichaAlta = id => altasF.some(z => ['calentar', 'estirar'].some(tipo => tareasFicha(z, tipo, ((ctx.bandas[z] || {}).lesion || {}).detalle).some(f => f.id === id)));
  const vale = e => sinRiesgoEn(e, zonas) && permitidoBase(S, e, ctx) && tareaOk(S, e.id, ctx);
  // Las «alivio» de la ficha de cada zona con dolor alto (no cuentan como rehabilitación: C-DOLOR-4 las pide).
  const alivioDe = tipo => altasF.flatMap(z => tareasFicha(z, tipo, ((ctx.bandas[z] || {}).lesion || {}).detalle)
    .filter(f => f.uso === 'alivio' && f.id && ex(f.id) && permitidoBase(S, ex(f.id), ctx) && tareaOk(S, f.id, ctx)).map(f => ({ z, e: ex(f.id) })));
  const cupo = Object.fromEntries(altasF.map(z => [z, 2]));
  const tomar = l => l.filter(({ z }) => cupo[z]-- > 0).map(({ e }) => e);
  const movAlivio = tomar(alivioDe('calentar').filter(({ e }) => e.m[0] === 'movilidad' && !esEstiraId(e.id)));
  const mov = [...new Set([...movAlivio, ...ctx.pool.filter(e => e.m[0] === 'movilidad' && !esEstiraId(e.id) && vale(e) && !deFichaAlta(e.id)
    && !(lugar === 'calle' && ['gato-camello', 'rotacion-toracica-cuadrupedia'].includes(e.id)))])];
  const nMov = Math.max(1, Math.min(movMin >= 10 ? 5 : 3, Math.max(1, mov.length)));
  repartir(movMin, nMov).forEach((m, i) => {
    const e = mov[i];
    vuelta.push(e ? { id: e.id, nombre: e.n, detalle: 'Lento, en el rango que no duele.', duracion: `${m} min` } : { nombre: MOV_LIBRE[lugar === 'piscina' ? 'piscina' : 'otro'], detalle: 'Lento, en el rango que no duele.', duracion: `${m} min` });
  });
  // Estiramientos de las zonas sin dolor y respiración (más los «alivio» de la ficha, PR 9).
  const resp = t.estiramientos >= 12 ? 4 : t.estiramientos >= 8 ? 3 : 2;
  const est = ctx.pool.filter(e => esEstiraId(e.id) && vale(e) && !deFichaAlta(e.id) && !(lugar === 'calle' && ['postura-nino', 'estiramiento-isquios-tumbado', 'estiramiento-figura-4', 'estiramiento-gluteo-rodilla-pecho', 'estiramiento-flexor-cadera'].includes(e.id)));
  const alivio = tomar(alivioDe('estirar').filter(({ e }) => !mov.includes(e)));
  const estiramientos = [...new Set([...alivio, ...est])];
  const nEst = Math.max(1, Math.min(5, Math.round((t.estiramientos - resp) / 2)));
  const durEst = repartir(t.estiramientos - resp, nEst);
  const libres = libresDe(lugar).filter(([n]) => tareaSinIdOk(S, { nombre: n }, ctx));
  // Sin repetir: si no hay estiramientos para todos los huecos, el último que hay dura más.
  const opcionesEst = [...estiramientos.map(e => ({ id: e.id, nombre: e.n, detalle: '30 s por lado, tensión suave; si sube el dolor o notas hormigueo, sáltalo.' })),
    ...(libres.length ? libres : [ESTIRA_SUAVE]).map(([n]) => ({ nombre: n, detalle: '30 s por lado, tensión suave; si sube el dolor, sáltalo.' }))];
  durEst.forEach((m, i) => {
    if (i < opcionesEst.length) vuelta.push({ ...opcionesEst[i], duracion: `${m} min` });
    else { const u = vuelta[vuelta.length - 1]; u.duracion = `${parseInt(u.duracion, 10) + m} min`; }
  });

  vuelta.push({ nombre: 'Respiración', detalle: 'Cómodo, soltando el aire en 6 segundos. Nota cómo baja la tensión.', duracion: `${resp} min` });
  if (lugar === 'piscina' && !ctx.salud.sinTumbado && ex('flotacion') && permitidoBase(S, ex('flotacion'), ctx)) vuelta[vuelta.length - 1] = { id: 'flotacion', nombre: ex('flotacion').n, detalle: 'Boca arriba, soltando el aire despacio.', duracion: `${resp} min` };

  explicacion.push(`Movilidad sin dolor y estiramientos de lo que no duele; el dolor durante no debe pasar de ${Math.min(...zonas.filter(z => ZONAS[z]).map(z => techoDolor(S, z)), 3)}/10.`);
  if (mayores60) explicacion.push('Con 60 años o más, el tramo suave del principio dura 2 minutos más.');
  return {
    fuente: 'reglas', lugar, minutos: ctx.minutos, nombre: 'Sesión suave', foco: 'Cardio suave, movilidad y estiramientos', tipo: 'dolorAlto',
    explicacion, calentamiento, ejercicios, vuelta,
  };
}
