// Área ENTRENADOR · ejercicio suelto (pedido por Víctor el 24-11-2026; docs/criterio.md C-SUELTO-1 a C-SUELTO-5).
//
// Desde la ficha de un ejercicio, «Hacerlo ahora»: un solo ejercicio, sin calentamiento ni vuelta a la calma, con
// las series, repeticiones, descanso y kilos que propone la progresión de siempre (dosis de las reglas y sugerir,
// C-PROG-*), y la pantalla de sesión de siempre (series, kilos, cronómetro de descanso y de tiempo con su alarma).
//
// Forma: una sesión normal (js/nucleo/modelo.js) con `origen: { tipo: 'suelto' }`, un ejercicio, calentamiento y
// vuelta vacíos y, en `checkin.dolor`, el dolor con el que empieza (el de partida de «Algo va mal» y de la regla
// de las 24 horas). Así el progreso de ese ejercicio la lee sola (registros, kilos de la próxima vez, fuerza) y la
// copia, el normalizador y la nube la tratan como cualquier sesión. Lo que la aparta (esSuelta):
// - no es «la sesión de hoy», no ocupa días del plan y una a medias no estorba a la de hoy (C-SUELTO-1);
// - no cuenta como sesión: ni constancia semanal o general, ni nivel, ni descarga (C-SUELTO-4).
// Seguridad (C-SUELTO-2, C-SUELTO-3): las mismas reglas que el validador usa para cada ejercicio (bandas de dolor,
// riesgo por zona, datos de salud, saber nadar, señal de alarma de hoy); el resto del validador (calentamiento,
// cardio, vuelta a la calma, número de principales y minutos) no aplica a un ejercicio suelto.

import { estado, cambiar, hoyISO } from '../../nucleo/estado.js';
import { crearSesion, esSuelta, trabajoHecho } from '../../nucleo/modelo.js';
import { ex, ZONAS, riesgoDetalle } from '../../reglas/catalogo.js';
import { sugerir, cargaMuscular } from '../../reglas/progresion.js';
import { contextoDia, dosis, noSabeNadar, nombreZona, lista } from './dia.js';
import { conPrecaucion, NOTA_NIVEL } from './validar.js';
import { sinEntrenarHoy } from './ia.js';
import { rolMia, topeSeriesMia } from './mias.js';

const DIA = 864e5;
const CON_PESO = ['mancuernas', 'barra', 'maquina', 'polea', 'botellas'];

// Dolor de cada zona para hoy, sin check-in: lo apuntado en los 3 últimos días (check-ins, cierres y el «dolor
// durante» de «Algo va mal» de cualquier sesión o suelto, aunque siga abierta; si el mismo día hay varios, el más alto) y, si no hay nada, el de la ficha de la lesión activa (una
// lesión traída de la app anterior, con el dolor por revisar, como mucho 6: decisión 11). Devuelve
// { zona: { dolor, de: 'reciente'|'ficha' } }.
export function dolorParaSuelto(S, ahora = Date.now()) {
  const desde = hoyISO(new Date(ahora - 3 * DIA));
  const porZona = {};
  const apuntar = (z, fecha, v) => {
    if (!Object.prototype.hasOwnProperty.call(ZONAS, z) || !(+v >= 0) || !fecha || fecha < desde) return;
    const a = porZona[z];
    if (!a || fecha > a.fecha || (fecha === a.fecha && +v > a.dolor)) porZona[z] = { fecha, dolor: +v };
  };
  (S.dolor || []).forEach(d => d && apuntar(d.zona, String(d.fecha || '').slice(0, 10), d.dolor));
  Object.values(S.sesiones || {}).forEach(s => {
    if (!s) return;
    const f = String(s.fecha || s.creada || '').slice(0, 10);
    // «Algo va mal» (C-DOLOR-6): el dolor que paró un ejercicio, también en una sesión aún abierta.
    (s.ejercicios || []).forEach(x => { if (x && x.dolorDurante) apuntar(x.dolorDurante.zona, f, x.dolorDurante.dolor); });
    if (esSuelta(s) || !s.checkin || !s.checkin.dolor) return;
    Object.entries(s.checkin.dolor).forEach(([z, v]) => apuntar(z, String(s.creada || s.fecha || '').slice(0, 10), v));
  });
  const out = {};
  Object.entries(porZona).forEach(([z, a]) => { out[z] = { dolor: a.dolor, de: 'reciente' }; });
  ((S.perfil || {}).lesiones || []).filter(l => l && l.activa && !out[l.zona]).forEach(l => {
    const d = l.dolorRevisar ? Math.min(6, +l.dolor || 0) : +l.dolor || 0;
    if (!out[l.zona] || d > out[l.zona].dolor) out[l.zona] = { dolor: d, de: 'ficha' };
  });
  return out;
}
const soloValores = d => Object.fromEntries(Object.entries(d).map(([z, x]) => [z, x.dolor]));

// ¿Se puede hacer `id` suelto ahora? Devuelve { e, bloqueo: null | { motivo, texto }, avisos: [texto], dolor, ctx }.
// motivo: 'alarma' · 'dolorAlto' · 'parado' · 'zona' · 'salud' · 'nadar'.
export function evaluarSuelto(S, id) {
  const e = ex(id);
  if (!e) return { e: null, bloqueo: { motivo: 'catalogo', texto: 'Ese ejercicio no está en la app.' }, avisos: [], dolor: {}, ctx: null };
  const dolor = dolorParaSuelto(S);
  const dolorHoy = soloValores(dolor);
  const ctx = contextoDia(S, { lugar: lugarDe(S, e), dolorHoy });
  const out = { e, bloqueo: null, avisos: [], dolor, ctx };
  const bloquear = (motivo, texto) => { out.bloqueo = { motivo, texto }; return out; };
  // C-SUELTO-2 · Señal de alarma hoy: hoy no se entrena (C-ALAR-1).
  if (sinEntrenarHoy(S)) return bloquear('alarma', 'Hoy has marcado una señal de alarma: hoy no se entrena, tampoco un ejercicio suelto. Si fue un error, deshazlo en Hoy.');
  // C-SUELTO-2 · Dolor de 7 o más en cualquier zona: solo lo suave del check-in (C-DOLOR-4).
  const alto = Object.entries(dolor).filter(([, x]) => x.dolor >= 7).sort((a, b) => b[1].dolor - a[1].dolor)[0];
  if (alto) {
    const [z, x] = alto;
    return bloquear('dolorAlto', `Tu ${nombreZona(z)} está a ${x.dolor}/10. Con dolor de 7 o más no se hacen ejercicios sueltos: prepara la sesión de hoy desde Hoy y la app te monta un día suave, sin fuerza.${x.de === 'ficha' ? ' Es el dolor de tu ficha: si hoy te duele menos, cámbialo en Perfil › Lesiones.' : ''}`);
  }
  // C-SUELTO-2 · Parado hoy por dolor con «Algo va mal» (C-DOLOR-6): hoy no se repite, tampoco suelto.
  const hoy = hoyISO();
  const parado = Object.values(S.sesiones || {}).find(s => s && s.fecha === hoy && (s.ejercicios || []).some(x => x && x.id === e.id && x.dolorDurante));
  if (parado) {
    const dd = parado.ejercicios.find(x => x.id === e.id && x.dolorDurante).dolorDurante;
    return bloquear('parado', `Hoy lo paraste por dolor (tu ${nombreZona(dd.zona)} a ${+dd.dolor}/10): hoy no se repite. Mañana la app lo vuelve a mirar con tu dolor de ese día.`);
  }
  // C-SUELTO-2 · Datos de salud (C-SALUD-0): lo que excluyen y, con «solo suave», nada de fuerza.
  const salud = ctx.salud;
  if (salud.soloSuave && e.m[0] !== 'movilidad') return bloquear('salud', `${salud.soloSuave} Por eso ahora no deja hacer este ejercicio suelto.`);
  if (salud.excluir.has(e.id)) return bloquear('salud', 'Por tus datos de salud (Perfil › Salud), la app no te lo propone ahora.');
  // C-SUELTO-2 · Carga una zona dolorida: r=2 en cualquier zona activa, o r=1 con la zona en B2 o más (C-DOLOR-1).
  const zonas = Object.keys(ctx.niveles).filter(z => riesgoDetalle(e, z, ((ctx.bandas[z] || {}).lesion || {}).detalle));
  const r2 = zonas.find(z => riesgoDetalle(e, z, ((ctx.bandas[z] || {}).lesion || {}).detalle) === 2);
  if (r2) {
    const b = ctx.bandas[r2];
    return bloquear('zona', `Carga mucho tu ${nombreZona(r2)}${b && b.dolor ? `, que está a ${b.dolor}/10` : ''}, y con esa zona activa es de los que hay que evitar. Busca otro que no la cargue: en la lista, los que dicen «Evitar por tu lesión» o «Con cuidado» la cargan.`);
  }
  const b2 = zonas.find(z => (ctx.bandas[z] || {}).banda >= 2);
  if (b2) {
    const b = ctx.bandas[b2];
    const porque = b.dolor >= 4 ? `con dolor de 4 o más (la tienes a ${b.dolor}/10)` : `con una molestia reciente que duele (${b.dolor}/10)`;
    return bloquear('zona', `Carga tu ${nombreZona(b2)}, y ${porque} la app no deja hacer lo que carga esa zona. Busca otro que no la cargue: en la lista, los que dicen «Evitar por tu lesión» o «Con cuidado» la cargan.`);
  }
  // C-SUELTO-2 · Natación por distancia sin saber nadar 2 × 25 m (C-PISC-2).
  if (noSabeNadar(S, e)) return bloquear('nadar', 'Es para quien sabe nadar 2 × 25 m seguidos (márcalo en Perfil › Mi entreno si es tu caso). Si no, en la piscina vale el aquajogging o caminar en el agua donde hagas pie.');
  // C-SUELTO-3 · Avisos que no lo impiden.
  if (zonas.length) out.avisos.push(`Con cuidado: carga tu ${lista(zonas.map(nombreZona))}. Si el dolor sube 2 puntos o más, para y apúntalo en «Algo va mal».`);
  if (e.niv > ctx.nivel) out.avisos.push(NOTA_NIVEL);
  if ((S.perfil.gustos || {})[e.id] === 'rechazo') out.avisos.push('Lo tienes en «No lo quiero»: lo haces porque lo eliges tú (la app sigue sin proponértelo).');
  return out;
}
// Dónde se hace: el primero de tus lugares en el que se puede; si no, el primero suyo.
function lugarDe(S, e) {
  return ((S.perfil || {}).lugares || []).find(l => e.l.includes(l)) || e.l[0] || 'gym';
}

// Lo que propone la app (C-SUELTO-3): la dosis de las reglas como primer ejercicio (C-DOSIS-2 a 6) con el tope de
// series de D-B y la progresión de siempre con lo que apuntaste (sugerir: C-PROG-1 a 9, C-REC-2, C-DOLOR-7,
// C-PARON-1, C-DESCARGA-1); con riesgo por zona, la dosis «con precaución» (C-DOSIS-4); de un nivel más alto, la
// nota de técnica. Devuelve { id, rol, series, reps, descanso, kg, nota, motivo }.
export function propuestaSuelto(S, id, ev = evaluarSuelto(S, id)) {
  const e = ex(id); if (!e) return null;
  const rol = rolMia(e);
  const d = dosis(S, e, 0);
  let x = { id, rol, series: Math.max(1, Math.min(topeSeriesMia(S, e), Math.round(+d.series) || 1)), reps: String(d.reps || e.d[1]), descanso: Math.max(0, Math.round(+d.descanso) || 0), kg: null, nota: '', motivo: '' };
  if (rol !== 'cardio' && ev.ctx) {
    const sg = sugerir(S, id, { series: x.series, reps: x.reps }, { energia: 3, niveles: ev.ctx.niveles, carga: cargaMuscular(S), dolorHoy: soloValores(ev.dolor) });
    x = { ...x, series: Math.max(1, Math.min(topeSeriesMia(S, e), sg.series)), reps: sg.reps, kg: sg.kg != null ? sg.kg : null, motivo: sg.motivo || '' };
  }
  if (ev.ctx) conPrecaucion(S, x, ev.ctx);
  if (e.niv > (ev.ctx ? ev.ctx.nivel : 1)) x.nota = `${NOTA_NIVEL} ${x.nota || ''}`.trim().slice(0, 300);
  return x;
}

// El suelto abierto (sin terminar) de un ejercicio, el más reciente.
export const sueltoAbierto = (S, id) => Object.values(S.sesiones || {}).filter(s => esSuelta(s) && s.estado !== 'hecha' && (s.ejercicios || []).some(x => x.id === id))
  .sort((a, b) => String(b.creada).localeCompare(String(a.creada)))[0] || null;
// Sueltos a medias (con algo apuntado y sin terminar), del más reciente al más antiguo.
export const sueltosAMedias = S => Object.values(S.sesiones || {}).filter(s => esSuelta(s) && s.estado !== 'hecha' && trabajoHecho(s))
  .sort((a, b) => String(b.creada).localeCompare(String(a.creada)));

// «Hacerlo ahora»: { sesion, seguir } o { bloqueo }. Si ya hay uno de ese ejercicio a medias (o de hoy sin
// empezar), se sigue con él; uno viejo sin nada apuntado se cambia por uno nuevo.
export function empezarSuelto(id) {
  const S = estado();
  const ev = evaluarSuelto(S, id);
  if (ev.bloqueo) return { bloqueo: ev.bloqueo };
  const abierto = sueltoAbierto(S, id);
  if (abierto && (trabajoHecho(abierto) || abierto.fecha === hoyISO())) return { sesion: abierto, seguir: true };
  const e = ev.e, x = propuestaSuelto(S, id, ev);
  const conKg = e.t === 'reps' && e.mat.some(m => CON_PESO.includes(m));
  const sesion = crearSesion({
    fuente: 'reglas', nombre: e.n, foco: 'Ejercicio suelto', lugar: ev.ctx.lugar, minutos: null,
    explicacion: [
      'Ejercicio suelto: sin calentamiento ni estiramientos. Cuenta para tu progreso en este ejercicio, no como una sesión de tu semana.',
      ...(conKg ? ['Si vas en frío, haz antes una o dos series ligeras con la mitad del peso.'] : []),
      // La nota de nivel y la de «con cuidado» van en el propio ejercicio (C-DOSIS-4, C-MIA-2 · NOTA_NIVEL).
      ...ev.avisos.filter(t => t !== NOTA_NIVEL && !/^Con cuidado/.test(t)), ...ev.ctx.salud.notas,
    ],
    checkin: { energia: null, dolor: soloValores(ev.dolor), tiempo: null },
    calentamiento: [], vuelta: [], ejercicios: [x], origen: { tipo: 'suelto' },
  });
  cambiar(S2 => {
    if (abierto && S2.sesiones[abierto.id] && !trabajoHecho(S2.sesiones[abierto.id])) delete S2.sesiones[abierto.id];
    S2.sesiones[sesion.id] = sesion;
  }, 'sesion');
  return { sesion, seguir: false };
}
