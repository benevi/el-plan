// Migración desde la app anterior (rama main, clave 'elplan2': las dos personas juntas, sexo 'm' hombre / 'f' mujer).
//
// Reglas:
// - No se borra nada de la app anterior: `elplan2` se queda como está y se vuelve a leer en cada arranque.
// - Incremental e idempotente: cada cosa migrada tiene una clave estable sacada de los datos viejos
//   ('s:<clave del entreno>', 'l:<id de la lesión>', 'm:<fecha>', 'd:<fecha>|<persona>', 'p' para el perfil) y
//   se apunta en `S.migracion.claves`. Lo ya apuntado no se vuelve a traer (aunque la persona lo haya borrado),
//   y lo nuevo (p. ej. tras una marcha atrás a la app anterior) se trae en el siguiente arranque.
// - Lo migrado lleva su clave en `vid` (lesiones, medidas, dolor) o es una sesión con fuente 'anterior',
//   para poder retirarlo si se eligió mal el dueño.
// - `S.migracion.version` marca los datos: 1 = migrado (o no) con la versión con fallos; 2 = esta versión.
//   La corrección de los datos con versión 1 (sexo cruzado, claves sin apuntar) se aplica una sola vez.
// - No cambia reglas de entrenamiento: las lesiones migradas guardan dolor = gravedad × 3 como antes,
//   marcadas con `dolorRevisar` para que la app pida el dolor real.
//
// Todo trabaja sobre el estado que se le pasa (no guarda: eso lo hace estado.js).

import { EJERCICIOS, ex } from '../reglas/catalogo.js';
import { zona } from './normalizar.js';

export const VERSION_MIGRACION = 2;
const USUARIO = { victor: 'him', virginia: 'her' };
const LUGARES = ['gym', 'piscina', 'casa', 'calle'];

// Nombres de la app anterior → id del catálogo (copiado de window.ALIAS en js/plan.js de main).
const ALIAS = {
  'Press de pecho en máquina BH (M090/M060)': 'press-pecho-maquina', 'Press de hombro en máquina BH (M090)': 'press-hombro-maquina',
  'Pec Fly en máquina BH (M410)': 'aperturas-maquina', 'Deltoid Raise en máquina BH (M490)': 'elevaciones-laterales-maquina',
  'Fondos asistidos máquina BH (M450)': 'fondos-asistidos-maquina', 'Plancha frontal': 'plancha', 'Plancha': 'plancha',
  'Dominadas asistidas máquina BH (M450)': 'dominadas-asistidas-maquina', 'Jalón al pecho polea': 'jalon-pecho', 'Remo sentado polea': 'remo-sentado-polea',
  'Prone Leg Curl máquina BH (M170)': 'curl-femoral-tumbado', 'Curl de bíceps con mancuernas': 'curl-mancuernas', 'Curl bíceps mancuernas': 'curl-mancuernas',
  'Face pull polea': 'face-pull', 'Leg Press máquina BH (M050)': 'prensa-piernas', 'Gluteus máquina BH (M330)': 'gluteo-maquina',
  'Leg Extension máquina BH (M010)': 'extension-cuadriceps', 'Elevación de talones (gemelos)': 'talones-pie', 'Plancha lateral': 'plancha-lateral',
  'Abductor máquina BH (M250)': 'abductor-maquina', 'Dead bug en suelo': 'dead-bug', 'Dead bug en el césped': 'dead-bug', 'Bird dog en suelo': 'bird-dog',
  'Caminar en el agua': 'caminar-agua', 'Burbujas (EL MÁS IMPORTANTE)': 'burbujas', 'Posición de flecha': 'flecha', 'Patada de crol con tabla': 'patada-crol-tabla',
  'Crol con descansos': 'crol', 'Flotación + vuelta a la calma': 'flotacion', 'Aquajogging suave': 'aquajogging',
  'Elevaciones laterales de pierna': 'elevacion-lateral-pierna-agua', 'Elevaciones de pierna hacia atrás': 'elevacion-atras-pierna-agua',
  'Marcha con rodillas altas': 'rodillas-altas-agua', 'Patada espalda con tabla': 'patada-espalda-tabla',
  'Sentadilla con peso corporal': 'sentadilla-peso-corporal', 'Flexiones (push-ups)': 'flexiones', 'Flexiones': 'flexiones', 'Zancadas alternas': 'zancadas',
  'Zancadas caminando': 'zancadas', 'Fondos de tríceps en silla': 'fondos-banco', 'Fondos de tríceps en banco': 'fondos-banco',
  'Puente de glúteo / Hip thrust suelo': 'puente-gluteo', 'Puente de glúteo en suelo': 'puente-gluteo', 'Puente de glúteo en banco': 'puente-gluteo',
  'Remo invertido / con toalla': 'remo-toalla', 'Remo con toalla en puerta': 'remo-toalla', 'Mountain climbers (cardio)': 'mountain-climbers',
  'Dominadas (o negativas)': 'dominadas', 'Dominadas negativas asistidas': 'dominadas-negativas', 'Fondos en paralelas (o banco)': 'fondos-paralelas',
  'Remo australiano (barra baja)': 'remo-australiano', 'Remo australiano (barra alta)': 'remo-australiano', 'Sentadillas / pistol asistido': 'sentadilla-peso-corporal',
  'Elevaciones de rodillas en barra': 'elevacion-rodillas-barra', 'Abducción de cadera tumbada': 'abduccion-tumbada', 'Flexiones (rodillas o pared)': 'flexiones-rodillas',
  'Flexiones (banco o suelo)': 'flexiones-inclinadas', 'Press de hombro con botellas/mochila': 'press-hombro-botellas', 'Curl bíceps con botellas/mochila': 'curl-botellas',
  'Abducción de pie en barra': 'abduccion-pie',
};
const sinTildes = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
let porNombre = null;
// Id del catálogo a partir del exId (si sigue existiendo) o del nombre (exacto, sin mayúsculas ni tildes, o por alias).
export function resolverEjercicio(exId, nombre) {
  if (typeof exId === 'string' && ex(exId)) return exId;
  if (!porNombre) {
    porNombre = new Map(EJERCICIOS.map(e => [sinTildes(e.n), e.id]));
    for (const [n, i] of Object.entries(ALIAS)) if (ex(i) && !porNombre.has(sinTildes(n))) porNombre.set(sinTildes(n), i);
  }
  return porNombre.get(sinTildes(nombre)) || null;
}

// En la app anterior 'm' = hombre y 'f' = mujer; en esta 'h' = hombre y 'm' = mujer.
export const traducirSexo = s => (s === 'm' ? 'h' : s === 'f' ? 'm' : '');
// Lo que escribía la migración con el fallo (copiaba el valor tal cual).
const sexoConFallo = s => (s === 'm' || s === 'f' ? s : '');

// 'YYYY-MM-DD' en la hora local del móvil (la app anterior guardaba ISO en UTC).
export function diaLocal(iso) {
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; // ya es un día: no se mueve de zona
  const d = new Date(iso);
  if (typeof iso !== 'string' || Number.isNaN(d.getTime())) return /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10) : null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const iso = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const limpio = (v, max = 60) => String(v == null ? '' : v).replace(/[^\w-]/g, '_').slice(0, max);
const txt = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
const numPos = (v, max = 500) => { const n = +v; return Number.isFinite(n) && n > 0 && n <= max ? n : null; };
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);

// ¿Es esto un estado (o una copia v3) de la app anterior?
export const esViejo = x => obj(x) && !obj(x.perfil) && (obj(x.workouts) || Array.isArray(x.painLog) || obj(x.bodyLog) || obj(x.injuries));

// ── Conversión de cada cosa (devuelven [clave, objeto nuevo]) ──
const claveSesion = k => 's:' + limpio(k, 120);
export const idSesion = k => 'v-' + limpio(k, 76);

function sesion(k, w) {
  const fin = iso(w.completedAt) || iso(w.date);
  const fecha = diaLocal(fin || w.date);
  if (!fecha) return null;
  const lugar = String(w.lugar || 'gym').toLowerCase();
  const dolorCi = {};
  if (obj(w.checkin) && obj(w.checkin.dolor)) for (const [z, v] of Object.entries(w.checkin.dolor)) { const zz = zona(z); if (zz && Number.isFinite(+v)) dolorCi[zz] = Math.max(0, Math.min(10, Math.round(+v))); }
  return {
    id: idSesion(k), fecha, creada: iso(w.date) || fin || fecha, fuente: 'anterior',
    nombre: txt(w.nombre || w.day, 60) || 'Sesión', foco: '', lugar: LUGARES.includes(lugar) ? lugar : 'gym',
    minutos: null, explicacion: [], calentamiento: [], vuelta: [],
    ejercicios: (Array.isArray(w.exercises) ? w.exercises : []).filter(obj).map(x => {
      const sets = (Array.isArray(x.sets) ? x.sets : []).filter(obj);
      return {
        id: resolverEjercicio(x.exId, x.name), nombre: txt(x.name, 120), rol: 'principal', series: sets.length, reps: '', descanso: 60, kg: null, nota: '', motivo: '',
        sets: sets.map(s => ({ kg: numPos(s.weight), valor: txt(s.reps, 12), hecha: s.done !== false })), gusto: null, comentario: '',
      };
    }),
    estado: 'hecha', empezada: iso(w.date), terminada: fin,
    checkin: obj(w.checkin) ? { energia: Math.max(1, Math.min(5, Math.round(+w.checkin.energia))) || null, dolor: dolorCi, tiempo: null } : null,
    cierre: obj(w.feedback) ? { esfuerzo: Math.max(1, Math.min(5, Math.round(+w.feedback.esfuerzo))) || null, dolor: {}, comentario: txt(w.feedback.nota, 1000) } : null,
  };
}
const claveLesion = i => 'l:' + limpio(i.id || (i.zoneKey + '|' + i.since), 120);
function lesion(i) {
  const z = zona(i.zoneKey);
  if (!z) return null;
  return {
    id: 'v-l-' + limpio(i.id || (i.zoneKey + '-' + i.since), 60), zona: z, dolor: Math.min(10, (Math.round(+i.severity) || 1) * 3),
    desde: diaLocal(i.since) || '', nota: txt(i.note, 300), activa: !!i.active, dolorRevisar: true, vid: claveLesion(i),
  };
}
function medida(b) {
  const fecha = diaLocal(b.date);
  if (!fecha) return null;
  const m = { fecha, peso: numPos(b.weight), cintura: numPos(b.waist), cadera: numPos(b.hip), cuello: numPos(b.neck), pecho: numPos(b.chest), brazo: numPos(b.arm), muslo: numPos(b.thigh), grasa: numPos(b.bodyFat, 80) };
  for (const k of Object.keys(m)) if (m[k] == null) delete m[k];
  return Object.keys(m).length > 1 ? { ...m, vid: 'm:' + fecha } : null;
}

// Todo lo que la app anterior tiene de una persona, con su clave estable.
function deUsuario(v, u) {
  const workouts = Object.entries(obj(v.workouts) ? v.workouts : {}).filter(([, w]) => obj(w) && w.user === u && w.completed);
  const injuries = (obj(v.injuries) && Array.isArray(v.injuries[u]) ? v.injuries[u] : []).filter(obj);
  const body = (obj(v.bodyLog) && Array.isArray(v.bodyLog[u]) ? v.bodyLog[u] : []).filter(obj);
  const pain = (Array.isArray(v.painLog) ? v.painLog : []).filter(p => obj(p) && p.user === u && iso(p.date));
  const perfil = obj(v.bodyProfile) && obj(v.bodyProfile[u]) ? v.bodyProfile[u] : null;
  return { workouts, injuries, body, pain, perfil };
}

// ── Retirar lo migrado (al cambiar de dueño) y reponerlo (al volver) ──
// Lo retirado se guarda tal como estaba (con lo que la persona cambió: lesión curada, comentarios…) en
// `S.migracion.porDueño[dueño]`, junto con sus claves y sus datos personales. Así, si vuelve a ese dueño,
// se repone y no se pierde nada ni resucita lo que borró. Lo hecho en esta app (sesiones, plan, objetivos,
// medidas apuntadas aquí) se queda siempre: es de quien usa el móvil. No va en las copias exportadas.
const DATOS = ['sexo', 'altura', 'nacimiento'];
function retirar(S, de) {
  const guardado = { claves: S.migracion.claves.slice(), sesiones: {}, lesiones: [], medidas: [], dolor: [], datos: {} };
  for (const [k, s] of Object.entries(S.sesiones)) if (s && s.fuente === 'anterior') { guardado.sesiones[k] = s; delete S.sesiones[k]; }
  guardado.lesiones = S.perfil.lesiones.filter(l => l.vid);
  guardado.medidas = S.medidas.filter(m => m.vid);
  guardado.dolor = S.dolor.filter(d => d.vid);
  S.perfil.lesiones = S.perfil.lesiones.filter(l => !l.vid);
  S.medidas = S.medidas.filter(m => !m.vid);
  S.dolor = S.dolor.filter(d => !d.vid);
  for (const k of DATOS) { guardado.datos[k] = S.perfil.datos[k]; S.perfil.datos[k] = k === 'altura' ? null : ''; }
  if (de) { S.migracion.porDueño = { ...(obj(S.migracion.porDueño) ? S.migracion.porDueño : {}), [de]: guardado }; }
  S.migracion.claves = [];
  S.migracion.sexoRevisar = false;
}
function reponer(S, a) {
  const pd = obj(S.migracion.porDueño) ? S.migracion.porDueño : {};
  const g = pd[a];
  if (!obj(g)) return false;
  for (const [k, s] of Object.entries(obj(g.sesiones) ? g.sesiones : {})) if (!S.sesiones[k]) S.sesiones[k] = s;
  const ids = new Set(S.perfil.lesiones.map(l => l.id));
  (Array.isArray(g.lesiones) ? g.lesiones : []).forEach(l => { if (!ids.has(l.id)) S.perfil.lesiones.push(l); });
  const dias = new Set(S.medidas.map(m => m.fecha));
  (Array.isArray(g.medidas) ? g.medidas : []).forEach(m => { if (!dias.has(m.fecha)) S.medidas.push(m); });
  (Array.isArray(g.dolor) ? g.dolor : []).forEach(d => S.dolor.push(d));
  if (obj(g.datos)) for (const k of DATOS) if (g.datos[k] !== undefined) S.perfil.datos[k] = g.datos[k];
  S.migracion.claves = Array.isArray(g.claves) ? g.claves.slice() : [];
  delete pd[a];
  if (!Object.keys(pd).length) delete S.migracion.porDueño;
  return true;
}

// ── Corrección única de lo migrado con la versión con fallos (S.migracion.version < 2) ──
// Aquella versión, al elegir dueño, traía TODO lo de esa persona que hubiera en elplan2 en ese momento.
// Por eso, si hay pruebas de esa migración, todo lo del dueño en elplan2 hasta la fecha de lo último
// emparejado cuenta como ya migrado, aunque la persona lo haya borrado o cambiado después (no resucita ni se
// duplica); solo se traerá lo posterior. Además: sexo cruzado (si no se puede saber, se pregunta en Perfil),
// fecha local en las sesiones migradas y `vid` en lo que casa para poder retirarlo.
const tiempo = x => { const t = Date.parse(x); return Number.isNaN(t) ? null : t; };
export function corregirAntigua(S, v) {
  const m = S.migracion;
  if (m.version >= VERSION_MIGRACION) return false;
  m.version = VERSION_MIGRACION;
  const anteriores = Object.values(S.sesiones).filter(s => s && s.fuente === 'anterior');
  // Fecha local en las sesiones migradas (la versión con fallos cortaba la fecha UTC).
  anteriores.forEach(s => { const f = diaLocal(s.terminada || s.creada); if (f) s.fecha = f; });
  if (!anteriores.length && !v) return true; // nunca hubo nada que migrar
  // ¿De quién se migró? De quien tenga entrenos que casen con las sesiones migradas; si no, el dueño actual.
  let dueño = S.dueño;
  if (v && anteriores.length) {
    const creadas = new Set(anteriores.map(s => s.creada));
    const cuenta = u => Object.values(obj(v.workouts) ? v.workouts : {}).filter(w => obj(w) && w.user === USUARIO[u] && creadas.has(w.date)).length;
    const mejor = Object.keys(USUARIO).sort((a, b) => cuenta(b) - cuenta(a))[0];
    if (cuenta(mejor) > 0) dueño = mejor;
  }
  if (!dueño) { m.version = 1; return false; } // sin dueño aún: se corrige al elegirlo
  m.dueño = dueño;
  const claves = new Set(m.claves);
  const sexo = S.perfil.datos.sexo;
  if (v) {
    const d = deUsuario(v, USUARIO[dueño]);
    const creadas = new Set(anteriores.map(s => s.creada));
    // Pruebas de la migración y su fecha límite: lo último que casa (sesiones, lesiones o medidas).
    let limite = null, hayPrueba = false;
    const subir = t => { if (t != null) limite = limite == null ? t : Math.max(limite, t); };
    d.workouts.forEach(([, w]) => { if (creadas.has(w.date)) { hayPrueba = true; subir(tiempo(w.completedAt)); subir(tiempo(w.date)); } });
    d.injuries.forEach(i => {
      const z = zona(i.zoneKey), desde = String(i.since || '').slice(0, 10), nota = i.note || '';
      const l = S.perfil.lesiones.find(x => !x.vid && x.zona === z && (x.desde || '') === desde && (x.nota || '') === nota);
      if (l) { l.vid = claveLesion(i); hayPrueba = true; }
    });
    d.body.forEach(b => {
      const fecha = String(b.date || '').slice(0, 10);
      const x = S.medidas.find(y => !y.vid && y.fecha === fecha && (y.peso || null) === (b.weight || null));
      if (x) { x.vid = 'm:' + fecha; hayPrueba = true; }
    });
    if (hayPrueba) {
      const hasta = t => limite == null || (t != null && t <= limite) || t == null; // sin sesiones emparejadas: todo
      d.workouts.forEach(([k, w]) => { if (hasta(tiempo(w.completedAt || w.date))) claves.add(claveSesion(k)); });
      d.injuries.forEach(i => { if (hasta(tiempo(i.since))) claves.add(claveLesion(i)); });
      d.body.forEach(b => { if (hasta(tiempo(b.date))) { claves.add('m:' + String(b.date || '').slice(0, 10)); claves.add('m:' + diaLocal(b.date)); } });
      claves.add('p');
    }
    // Sexo: la versión con fallos copiaba 'm'/'f' tal cual. 'f' no existe en esta app → seguro que es el fallo.
    // 'm' es válido aquí (mujer): pudo ser el fallo o una elección → se pregunta.
    const viejoSexo = d.perfil ? sexoConFallo(d.perfil.sex) : '';
    if (sexo === 'f') S.perfil.datos.sexo = 'm';
    else if (sexo === 'm' && viejoSexo === 'm' && hayPrueba) m.sexoRevisar = true;
  } else {
    // Sin la app anterior a mano no se puede comparar: 'f' se arregla; 'm' se pregunta.
    claves.add('p');
    if (sexo === 'f') S.perfil.datos.sexo = 'm';
    else if (sexo === 'm') m.sexoRevisar = true;
  }
  m.claves = [...claves];
  return true;
}

// Id de la sesión de esta app que corresponde a un entreno viejo: la migrada con id estable o, si se
// migró con la versión con fallos (id al azar), la que tiene su misma hora de inicio.
function idDeEntreno(S, k, w) {
  if (S.sesiones[idSesion(k)]) return idSesion(k);
  const s = Object.values(S.sesiones).find(x => x && x.fuente === 'anterior' && x.creada === w.date);
  return s ? s.id : null;
}

// ── Migrar ──
// Trae de `v` (la app anterior) lo de `dueño` que aún no se haya traído. Si lo migrado era de la otra persona,
// lo retira antes. Devuelve { sesiones, lesiones, medidas, dolor, descartadas: [texto], retirado, cambió }.
export function migrar(S, v, dueño) {
  const r = { sesiones: 0, lesiones: 0, medidas: 0, dolor: 0, descartadas: [], retirado: false, cambió: false };
  const u = USUARIO[dueño];
  if (!u || !obj(S.migracion)) return r;
  r.cambió = corregirAntigua(S, v) || r.cambió;
  if (!esViejo(v)) return r;
  const m = S.migracion;
  if (m.dueño && m.dueño !== dueño) { retirar(S, m.dueño); r.retirado = true; r.cambió = true; r.repuesto = reponer(S, dueño); }
  const claves = new Set(m.claves);
  const nueva = c => { if (claves.has(c)) return false; claves.add(c); return true; };
  const d = deUsuario(v, u);

  d.workouts.forEach(([k, w]) => {
    if (!nueva(claveSesion(k))) return;
    const s = sesion(k, w);
    if (!s) { r.descartadas.push(`un entreno sin fecha (${txt(w.nombre || w.day, 30) || k})`); return; }
    if (S.sesiones[s.id]) return;
    S.sesiones[s.id] = s; r.sesiones++;
  });
  d.injuries.forEach(i => {
    if (!nueva(claveLesion(i))) return;
    const l = lesion(i);
    if (!l) { r.descartadas.push(`la lesión de zona «${txt(i.zoneKey, 30) || '?'}», que esta app no conoce`); return; }
    if (S.perfil.lesiones.some(x => x.id === l.id)) l.id += '-' + S.perfil.lesiones.length;
    S.perfil.lesiones.push(l); r.lesiones++;
  });
  d.body.forEach(b => {
    const x = medida(b);
    if (!x || !nueva(x.vid)) return;
    if (S.medidas.some(y => y.fecha === x.fecha)) return; // ya hay medidas de ese día en esta app: se respetan
    S.medidas.push(x); r.medidas++;
  });
  // painLog → registro de dolor, enlazado con el entreno que acabó a la vez (±5 min), buscado por minuto.
  const porMinuto = new Map();
  d.workouts.forEach(e => { const t = tiempo(e[1].completedAt || e[1].date); if (t != null) porMinuto.set(Math.round(t / 60e3), e); });
  const entrenoDe = t => { const mm = Math.round(t / 60e3); for (let k = 0; k <= 5; k++) { const e = porMinuto.get(mm - k) || porMinuto.get(mm + k); if (e) return e; } return null; };
  d.pain.forEach(p => {
    const c = 'd:' + limpio(p.date + '|' + u, 120);
    if (!nueva(c)) return;
    const fecha = diaLocal(p.date), t = Date.parse(p.date);
    const w = entrenoDe(t);
    for (const [momento, valores] of [['antes', p.antes], ['despues', p.despues]]) {
      if (!obj(valores)) continue;
      for (const [zk, val] of Object.entries(valores)) {
        const z = zona(zk), n = Math.round(+val);
        if (!z) { r.descartadas.push(`dolor de la zona «${txt(zk, 30)}», que esta app no conoce`); continue; }
        if (!Number.isFinite(n)) continue;
        const reg = { fecha, zona: z, dolor: Math.max(0, Math.min(10, n)), momento, vid: c };
        const sid = w && idDeEntreno(S, w[0], w[1]);
        if (sid) reg.sesion = sid;
        S.dolor.push(reg); r.dolor++;
      }
    }
  });
  if (d.perfil && nueva('p')) {
    const datos = S.perfil.datos, sexo = traducirSexo(d.perfil.sex), alt = numPos(d.perfil.height, 250);
    if (!datos.sexo && sexo) datos.sexo = sexo;
    if (!datos.altura && alt) datos.altura = alt;
    r.cambió = true;
  }
  const cambiaron = r.sesiones + r.lesiones + r.medidas + r.dolor > 0 || claves.size !== m.claves.length || m.dueño !== dueño;
  m.claves = [...claves];
  m.dueño = dueño;
  r.descartadas = [...new Set(r.descartadas)];
  r.cambió = r.cambió || cambiaron;
  return r;
}
