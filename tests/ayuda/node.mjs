// Arnés ligero para probar la lógica en node sin navegador (a partir de h.mjs de la auditoría).
// - Inyecta un almacén en memoria en estado.js (usarAlmacen), sin tocar localStorage.
// - Carga los módulos de reglas, modelo y entrenador una vez por proceso.
// - nuevoS(perfil) deja un estado limpio de Víctor con ese perfil; hecha(...) añade una sesión hecha.
// node:test ejecuta cada archivo en su propio proceso, así que cada archivo parte de cero.
import { modulo } from './comun.mjs';

export class AlmacenMemoria {
  constructor(datos = {}) { this.datos = { ...datos }; this.escrituras = 0; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.datos, k) ? this.datos[k] : null; }
  setItem(k, v) { this.escrituras++; this.datos[k] = String(v); }
  removeItem(k) { delete this.datos[k]; }
  clear() { this.datos = {}; }
}

// La app mira navigator.onLine; en node no existe. Por defecto, sin red (camino de reglas).
export function ponerRed(enLinea, fetchFalso) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: enLinea }, writable: true, configurable: true });
  if (fetchFalso) globalThis.fetch = fetchFalso;
}
ponerRed(false);

export const est = await import(modulo('js/nucleo/estado.js'));
export const modelo = await import(modulo('js/nucleo/modelo.js'));
export const cat = await import(modulo('js/reglas/catalogo.js'));
export const prog = await import(modulo('js/reglas/progresion.js'));
export const ctx = await import(modulo('js/reglas/contexto.js'));
export const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
export const analisis = await import(modulo('js/areas/progreso/analisis.js'));
export const K = await import(modulo('js/datos/constantes.js'));
export const datos = await import(modulo('js/datos/ejercicios.js'));
export const lesiones = await import(modulo('js/datos/lesiones.js'));

export let almacen = new AlmacenMemoria();
est.usarAlmacen(almacen);

// Estado limpio cargado desde un almacén nuevo (opcionalmente con datos guardados).
export function cargarCon(datosGuardados = {}) {
  almacen = new AlmacenMemoria(Object.fromEntries(Object.entries(datosGuardados).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])));
  est.usarAlmacen(almacen);
  return est.cargar();
}

export function nuevoS(perfil = {}) {
  const S = cargarCon();
  S.dueño = 'victor';
  Object.assign(S.perfil, { objetivos: ['musculo'], lugares: ['gym'] }, perfil);
  return S;
}

// Un Date a `diasAtras` días de ahora, a la hora `h` local.
export const haceDias = (diasAtras, h = 18) => { const d = new Date(Date.now() - diasAtras * 864e5); d.setHours(h, 0, 0, 0); return d; };

// Añade una sesión hecha: ejs = [{ id, sets: [[kg, valor, hecha=true], ...], reps?, comentario? }]
export function hecha(S, diasAtras, ejs, extra = {}) {
  const d = extra.cuando || haceDias(diasAtras);
  const id = 's' + Math.random().toString(36).slice(2);
  S.sesiones[id] = {
    id, fecha: est.hoyISO(d), creada: d.toISOString(), fuente: 'reglas', nombre: 'x', lugar: 'gym', estado: 'hecha', terminada: d.toISOString(),
    checkin: extra.checkin || null, cierre: extra.cierre || null, calentamiento: [], vuelta: [],
    ejercicios: ejs.map(e => ({ id: e.id, rol: 'principal', series: e.sets.length, reps: e.reps || '8-12', sets: e.sets.map(([kg, valor, h = true]) => ({ kg, valor: String(valor), hecha: h })), comentario: e.comentario || '' })),
  };
  return id;
}
