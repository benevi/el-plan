// Estado de la app y guardado en el móvil (localStorage).
// Cada móvil guarda los datos de UNA persona (su dueño). No se comparte nada entre móviles.
//
// Reglas para todas las áreas:
// - Leer con `estado()` (objeto vivo, no lo sustituyas).
// - Cambiar con `cambiar(fn, motivo)`: aplica fn(estado), guarda y avisa a quien escuche.
// - Escuchar con `escuchar(fn)`; fn(motivo) se llama tras cada cambio.
// - Cada área guarda lo suyo bajo su clave (perfil, plan, sesiones, medidas, dolor…).
//   Si necesitas una clave nueva, añádela en `nuevo()` y, si hace falta, en `migrar()`.

const CLAVE = 'pipos4';
const CLAVE_VIEJA = 'elplan2';
export const VERSION = 4;

export function hoyISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function perfilVacio() {
  return {
    objetivos: [],            // claves de OBJETIVOS, varias a la vez
    nivel: 1,                 // 1-3
    nivelAuto: true,          // si el medidor de progreso puede subirlo solo
    lesiones: [],             // { id, zona, dolor 0-10, desde 'YYYY-MM-DD', nota, activa }
    disponibilidad: { dias: 3, minutos: 60, diasSemana: [] }, // diasSemana 1=lunes…7; cambia cada semana
    lugares: ['gym', 'piscina'],
    materialCasa: [],
    gustos: {},               // { idEjercicio: 'rechazo' | 'nogusta' | 'gusta' }
    datos: { sexo: '', altura: null, nacimiento: '' },
    notas: '',                // lo que quiera contarle al entrenador
  };
}

export function nuevo() {
  return {
    version: VERSION,
    dueño: null,              // 'victor' | 'virginia'
    perfil: perfilVacio(),
    plan: null,               // plan semanal (ver areas/entrenador)
    sesiones: {},             // { id: sesión } (ver areas/sesion/modelo.js)
    medidas: [],              // { fecha, peso, cintura, cadera, cuello, pecho, brazo, muslo, grasa }
    dolor: [],                // { fecha, zona, dolor, momento: 'antes'|'despues'|'dia', sesion }
    ajustes: { codigo: '', vibrar: true, sonido: true, apiUrl: '' },
  };
}

let S = null;
const oyentes = new Set();
let temporizadorGuardar = null;

// Almacén de datos: en el navegador, localStorage. Las pruebas en node pueden inyectar otro
// con la misma forma (getItem/setItem) mediante `usarAlmacen`; si no se inyecta nada, se usa localStorage.
let almacenInyectado = null;
const almacen = () => almacenInyectado || localStorage;
export function usarAlmacen(obj) { almacenInyectado = obj || null; }

function rellenar(base, x) {
  // Añade claves que falten sin pisar lo guardado (útil al ampliar el modelo).
  for (const k of Object.keys(base)) {
    if (x[k] === undefined) x[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && x[k] && typeof x[k] === 'object') rellenar(base[k], x[k]);
  }
  return x;
}

export function cargar() {
  let x = null;
  try { x = JSON.parse(almacen().getItem(CLAVE) || 'null'); } catch (e) { x = null; }
  if (!x) {
    x = nuevo();
    try { const viejo = JSON.parse(almacen().getItem(CLAVE_VIEJA) || 'null'); if (viejo) x.viejo = viejo; } catch (e) { /* nada */ }
  }
  S = rellenar(nuevo(), x);
  delete S.nutricion; // la nutrición irá en otra app
  return S;
}

export const estado = () => S;

export function guardarYa() {
  clearTimeout(temporizadorGuardar);
  try { almacen().setItem(CLAVE, JSON.stringify(S)); } catch (e) { console.error('No se pudo guardar', e); }
}
function guardar() {
  clearTimeout(temporizadorGuardar);
  temporizadorGuardar = setTimeout(guardarYa, 250);
}
// Guardar al salir o pasar a segundo plano (solo si hay navegador; en node no existen).
if (typeof window !== 'undefined') window.addEventListener('pagehide', guardarYa);
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) guardarYa(); });

export function cambiar(fn, motivo = '') {
  fn(S);
  guardar();
  oyentes.forEach(o => { try { o(motivo); } catch (e) { console.error(e); } });
}
export function escuchar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

// ── Copia de seguridad ──
export function exportar() { return JSON.stringify(S, null, 1); }
export function importar(txt) {
  const x = JSON.parse(txt);
  if (!x || x.version !== VERSION || !x.perfil) throw new Error('No es una copia de Pipos Fitness');
  S = rellenar(nuevo(), x);
  guardarYa();
  oyentes.forEach(o => o('importar'));
}

// ── Migración desde la app anterior (clave 'elplan2', con las dos personas juntas) ──
// Se usa una vez, al elegir dueño: trae su historial de sesiones, lesiones y medidas.
export function migrarDeViejo(dueño) {
  const v = S.viejo; if (!v) return 0;
  const u = dueño === 'victor' ? 'him' : 'her';
  let n = 0;
  Object.values(v.workouts || {}).filter(w => w.user === u && w.completed).forEach(w => {
    const id = 'v-' + (w.id || uid());
    if (S.sesiones[id]) return;
    S.sesiones[id] = {
      id, fecha: String(w.completedAt || w.date).slice(0, 10), creada: w.date, fuente: 'anterior',
      nombre: w.nombre || w.day || 'Sesión', foco: '', lugar: (w.lugar || 'gym').toLowerCase() === 'piscina' ? 'piscina' : (w.lugar || 'gym').toLowerCase(),
      explicacion: [], calentamiento: [], vuelta: [],
      ejercicios: (w.exercises || []).map(x => ({
        id: x.exId || null, nombre: x.name, rol: 'principal', series: (x.sets || []).length, reps: '', descanso: 60, kg: null, nota: '',
        sets: (x.sets || []).map(s => ({ kg: +s.weight > 0 ? +s.weight : null, valor: String(s.reps || ''), hecha: s.done !== false })),
      })),
      estado: 'hecha', empezada: w.date, terminada: w.completedAt || w.date,
      checkin: w.checkin ? { energia: +w.checkin.energia || null, dolor: w.checkin.dolor || {} } : null,
      cierre: w.feedback ? { esfuerzo: +w.feedback.esfuerzo || null, comentario: w.feedback.nota || '' } : null,
    };
    n++;
  });
  (v.injuries && v.injuries[u] || []).forEach(i => {
    S.perfil.lesiones.push({ id: uid(), zona: i.zoneKey, dolor: Math.min(10, (+i.severity || 1) * 3), desde: String(i.since || '').slice(0, 10), nota: i.note || '', activa: !!i.active });
  });
  (v.bodyLog && v.bodyLog[u] || []).forEach(b => {
    S.medidas.push({ fecha: String(b.date).slice(0, 10), peso: b.weight || null, cintura: b.waist || null, cadera: b.hip || null, cuello: b.neck || null, pecho: b.chest || null, brazo: b.arm || null, muslo: b.thigh || null, grasa: b.bodyFat || null });
  });
  const p = v.bodyProfile && v.bodyProfile[u];
  if (p) { S.perfil.datos.sexo = p.sex || ''; S.perfil.datos.altura = p.height || null; }
  delete S.viejo;
  return n;
}
