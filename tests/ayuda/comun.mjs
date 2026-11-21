// Utilidades comunes de las pruebas: rutas del repo, zona horaria y reloj fijos, y datos de ejemplo.
// Importa este módulo ANTES que cualquier módulo de la app: fija TZ=Europe/Madrid para que las
// fechas se comporten como en los móviles de Víctor y Virginia.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

process.env.TZ = process.env.TZ_PRUEBAS || 'Europe/Madrid';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ruta = rel => path.join(RAIZ, rel);
// URL file:// de un módulo de la app, para import() dinámico.
export const modulo = rel => pathToFileURL(ruta(rel)).href;

// ── Reloj ──
// fijarFecha('2026-11-19T23:40') sustituye Date por uno cuyo «ahora» empieza en esa fecha (hora local)
// y avanza con el reloj real. Con { quieto: true } solo avanza con avanzar(ms): sirve para instantáneas
// exactas (marcas de tiempo e ids iguales en cada ejecución). Devuelve { avanzar(ms), restaurar() }.
const DateReal = globalThis.Date;
export function fijarFecha(cuando, { quieto = false } = {}) {
  const real = () => (quieto ? 0 : DateReal.now());
  let desfase = new DateReal(cuando).getTime() - real();
  class DateFalso extends DateReal {
    constructor(...a) { if (a.length) super(...a); else super(real() + desfase); }
    static now() { return real() + desfase; }
  }
  globalThis.Date = DateFalso;
  return {
    avanzar(ms) { desfase += ms; },
    restaurar() { globalThis.Date = DateReal; },
  };
}
export const restaurarFecha = () => { globalThis.Date = DateReal; };

// ── Fechas de ayuda ──
// 'YYYY-MM-DD' local de un Date.
export const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Semana ISO de referencia, calculada de otra forma que la app (para comparar).
export function semanaRef(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow + 3);
  const y = t.getFullYear();
  const j4 = new Date(y, 0, 4);
  const w = 1 + Math.round(((t - j4) / 864e5 - 3 + ((j4.getDay() + 6) % 7)) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}

// ── Datos de ejemplo (forma de la app actual, versión 4) ──
export function estadoBase(extra = {}) {
  return {
    version: 4, dueño: 'victor',
    perfil: { objetivos: ['musculo'], nivel: 1, nivelAuto: true, lesiones: [], disponibilidad: { dias: 3, minutos: 60, diasSemana: [] }, lugares: ['gym'], materialCasa: [], gustos: {}, datos: { sexo: 'h', altura: 180, nacimiento: '1985' }, notas: '' },
    plan: null, sesiones: {}, medidas: [], dolor: [], ajustes: { codigo: '', vibrar: true, sonido: true, apiUrl: '' },
    ...extra,
  };
}
export function sesionDemo(id = 's1', extra = {}) {
  const set = () => ({ kg: 40, valor: '', hecha: false });
  return {
    id, fecha: isoLocal(new Date()), creada: new Date().toISOString(), fuente: 'reglas', nombre: 'Demo', foco: '', lugar: 'gym', minutos: 60, explicacion: ['x'], checkin: { energia: 3, dolor: {} }, calentamiento: [], vuelta: [],
    ejercicios: [
      { id: 'press-pecho-maquina', rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 40, nota: '', motivo: '', sets: [set(), set(), set()], gusto: null, comentario: '' },
      { id: 'press-inclinado-maquina', rol: 'principal', series: 2, reps: '8-12', descanso: 60, kg: 30, nota: '', motivo: '', sets: [set(), set()], gusto: null, comentario: '' },
    ],
    estado: 'pendiente', empezada: null, terminada: null, cierre: null, ...extra,
  };
}

// Datos de la app anterior (rama main, clave 'elplan2', las dos personas juntas).
export function viejoDemo() {
  const w = (key, user, date, done, ex) => ({ key, user, day: 'A', nombre: 'Torso', lugar: 'gym', date, completed: true, completedAt: done, exercises: ex });
  return {
    v: 2, user: 'him',
    workouts: {
      k1: w('k1', 'him', '2026-10-05T22:10:00.000Z', '2026-10-05T23:30:00.000Z', [{ exId: 'press-pecho-maquina', name: 'Press', sets: [{ weight: '40', reps: '10', done: true }] }, { name: 'Curl raro sin exId', sets: [{ weight: '12', reps: '10', done: true }] }]),
      k2: w('k2', 'her', '2026-10-06T17:00:00.000Z', '2026-10-06T18:00:00.000Z', []),
    },
    injuries: { him: [], her: [{ id: 't', zoneKey: 'cadera_lateral', severity: 2, note: 'Trocanteritis', active: true, since: '2025-01-01' }] },
    bodyLog: { him: [{ date: '2026-10-01T07:00:00.000Z', weight: 82, neck: 39, waist: 90 }], her: [{ date: '2026-10-01T07:00:00.000Z', weight: 60, neck: 32, waist: 70, hip: 95 }] },
    bodyProfile: { him: { sex: 'm', height: 180 }, her: { sex: 'f', height: 165 } },
  };
}
