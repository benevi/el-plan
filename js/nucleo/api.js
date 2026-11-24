// Llamadas a las funciones del servidor (/api/*). La clave de la IA vive solo en Vercel;
// el móvil manda el código de acceso (Perfil → Ajustes) en la cabecera x-app-code.
//
// llamar(): JSON de ida y vuelta. llamarEnVivo(): el entrenador, con la respuesta en vivo (D6): pide
// «text/event-stream», va leyendo las líneas «data: {…}» del servidor (inicio, progreso, latido, fin, error)
// y corta solo por inactividad (nada nuevo en `inactividad` ms), nunca por tiempo total. Si el servidor
// responde JSON (otra versión, o un error antes de empezar), lo lee igual.
// Los errores son siempre ErrorApi con un `tipo` fijo; el texto para la persona sale de textoError(),
// nunca del mensaje crudo de una excepción.

import { estado } from './estado.js';

// tipo: 'sinRed' | 'codigo' (401) | 'ritmo' (429) | 'sobrecarga' (529) | 'tiempo' (504 o inactividad) |
//       'corte' (el stream se cortó sin terminar) | 'cancelada' (la persona canceló) | 'config' (servidor sin
//       configurar) | 'ia' (la IA respondió mal: 502/422) | 'servidor' (otro).
export class ErrorApi extends Error {
  constructor(msg, { status = 0, sinRed = false, tipo = '' } = {}) {
    super(msg); this.name = 'ErrorApi'; this.status = status; this.sinRed = sinRed;
    this.tipo = tipo || (sinRed ? 'sinRed' : tipoDeEstado(status));
  }
}
function tipoDeEstado(status) {
  if (status === 401) return 'codigo';
  if (status === 429) return 'ritmo';
  if (status === 529) return 'sobrecarga';
  if (status === 504 || status === 408) return 'tiempo';
  if (status === 502 || status === 422) return 'ia';
  return 'servidor';
}

export const enLinea = () => navigator.onLine !== false;

const cabeceras = extra => ({ 'Content-Type': 'application/json', 'x-app-code': estado().ajustes.codigo || '', ...extra });
// Mensaje que manda el servidor en {error}: solo se guarda si es un texto corto (los mensajes fijos de _comun.js).
const errorDelServidor = d => d && typeof d.error === 'string' && d.error.length <= 160 ? d.error : '';
function errorDeRespuesta(status, datos) {
  const msg = errorDelServidor(datos) || (status === 401 ? 'código de acceso incorrecto' : status === 404 ? 'el servidor no tiene esta función' : 'error ' + status);
  const e = new ErrorApi(msg, { status });
  if (status === 500 && /no está configurado/.test(msg)) e.tipo = 'config';
  return e;
}

export async function llamar(nombre, cuerpo, { espera = 120000 } = {}) {
  if (!enLinea()) throw new ErrorApi('sin conexión', { sinRed: true });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), espera);
  let r;
  try {
    r = await fetch(`/api/${encodeURIComponent(nombre)}`, { // siempre relativa: el mismo sitio que sirve la app
      method: 'POST', headers: cabeceras(), body: JSON.stringify(cuerpo), signal: ctrl.signal,
    });
  } catch (e) {
    throw e && e.name === 'AbortError' ? new ErrorApi('la IA ha tardado demasiado', { tipo: 'tiempo' }) : new ErrorApi('sin conexión con el servidor', { sinRed: true });
  } finally { clearTimeout(t); }
  let datos = null;
  try { datos = await r.json(); } catch (e) { /* respuesta vacía */ }
  if (!r.ok) throw errorDeRespuesta(r.status, datos);
  return datos;
}

// ── En vivo ──
// opciones: signal (cancelar), alProgreso({fase, ejercicios, dias, de}), inactividad (ms sin nada del servidor).
// Devuelve lo mismo que llamar(): { sesion } o { plan }.
export const INACTIVIDAD_MS = 45000; // el servidor manda un latido cada 10 s
export async function llamarEnVivo(nombre, cuerpo, { signal, alProgreso = () => {}, inactividad = INACTIVIDAD_MS } = {}) {
  if (!enLinea()) throw new ErrorApi('sin conexión', { sinRed: true });
  if (signal && signal.aborted) throw new ErrorApi('cancelada', { tipo: 'cancelada' });
  const ctrl = new AbortController();
  let porQue = '';
  const cortar = q => { if (!ctrl.signal.aborted) { porQue = q; ctrl.abort(); } };
  const alCancelar = () => cortar('cancelada');
  if (signal) signal.addEventListener('abort', alCancelar, { once: true });
  let vigia = null;
  const vigilar = () => { clearTimeout(vigia); vigia = setTimeout(() => cortar('inactividad'), inactividad); };
  const errorDeCorte = () => porQue === 'cancelada' ? new ErrorApi('cancelada', { tipo: 'cancelada' })
    : porQue === 'inactividad' ? new ErrorApi('sin noticias del servidor', { tipo: 'tiempo' }) : null;
  vigilar();
  try {
    let r;
    try {
      r = await fetch(`/api/${encodeURIComponent(nombre)}`, {
        method: 'POST', headers: cabeceras({ Accept: 'text/event-stream' }), body: JSON.stringify(cuerpo), signal: ctrl.signal,
      });
    } catch (e) {
      throw errorDeCorte() || new ErrorApi('sin conexión con el servidor', { sinRed: true });
    }
    vigilar();
    const tipo = r.headers && typeof r.headers.get === 'function' ? String(r.headers.get('content-type') || '') : '';
    if (!r.ok || !/text\/event-stream/.test(tipo) || !r.body || typeof r.body.getReader !== 'function') {
      let datos = null;
      try { datos = await r.json(); } catch (e) { if (errorDeCorte()) throw errorDeCorte(); }
      if (errorDeCorte()) throw errorDeCorte();
      if (!r.ok) throw errorDeRespuesta(r.status, datos);
      return datos;
    }
    const lector = r.body.getReader();
    const dec = new TextDecoder();
    let resto = '', cr = ''; // cr: un «\r» al final de un trozo, por si el «\n» llega en el siguiente
    const normal = t => { t = cr + t; cr = ''; if (t.endsWith('\r')) { cr = '\r'; t = t.slice(0, -1); } return t.replace(/\r\n?/g, '\n'); };
    // Un evento SSE: líneas «data:» hasta una línea en blanco. Devuelve el resultado si es «fin».
    const evento = bloque => {
      const datos = bloque.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
      if (!datos) return null;
      let ev; try { ev = JSON.parse(datos); } catch (e) { return null; }
      if (!ev || typeof ev !== 'object') return null;
      if (ev.t === 'progreso') { try { alProgreso(ev); } catch (e) { /* la pantalla nunca rompe la llamada */ } }
      if (ev.t === 'error') throw errorDeRespuesta(Number.isInteger(ev.status) ? ev.status : 502, ev);
      if (ev.t === 'fin') { delete ev.t; return ev; }
      return null;
    };
    for (;;) {
      let trozo;
      try { trozo = await lector.read(); } catch (e) { throw errorDeCorte() || new ErrorApi('conexión cortada', { tipo: 'corte' }); }
      if (errorDeCorte()) throw errorDeCorte();
      if (trozo.done) {
        // Último evento sin línea en blanco detrás: también vale.
        const ultimo = resto + normal(dec.decode()) + (cr ? '\n' : '');
        const fin = evento(ultimo.trim());
        if (fin) return fin;
        break;
      }
      vigilar();
      resto += normal(dec.decode(trozo.value, { stream: true }));
      let i;
      while ((i = resto.indexOf('\n\n')) >= 0) {
        const bloque = resto.slice(0, i); resto = resto.slice(i + 2);
        const fin = evento(bloque);
        if (fin) { lector.cancel().catch(() => {}); return fin; }
      }
    }
    throw errorDeCorte() || new ErrorApi('la respuesta se cortó', { tipo: 'corte' });
  } finally {
    clearTimeout(vigia);
    if (signal) signal.removeEventListener('abort', alCancelar);
  }
}

// ── Texto para la persona ──
// Frase que completa «… porque {texto}». Nunca el mensaje crudo de una excepción: solo textos fijos (y, para
// los fallos de la IA, el mensaje fijo que manda el servidor).
// El cupo diario de la IA (api/_freno.js) vuelve al empezar el día UTC: esa hora, en la de España.
export function horaVuelveIA(ahora = new Date()) {
  const t = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  return t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}
export const esTopeIA = motivo => /tope diario de llamadas a la IA/.test(String(motivo || ''));
export function textoError(e) {
  if (!(e instanceof ErrorApi)) return 'algo falló al leer la respuesta de la IA';
  switch (e.tipo) {
    case 'sinRed': return 'no hay conexión con el servidor';
    case 'codigo': return 'el código de acceso no es correcto';
    case 'ritmo':
      // Los dos frenos del servidor (S1, api/_freno.js) dicen por qué.
      if (/tope diario/.test(e.message)) return `se ha llegado al tope diario de llamadas a la IA (vuelve a estar a las ${horaVuelveIA()})`;
      if (/código incorrecto/.test(e.message)) return 'demasiados intentos con un código incorrecto (prueba dentro de un rato)';
      return 'se han hecho demasiadas peticiones seguidas (prueba en un minuto)';
    case 'sobrecarga': return 'la IA está saturada ahora mismo (prueba en unos minutos)';
    case 'tiempo': return 'la IA ha dejado de responder';
    case 'corte': return 'la conexión se cortó antes de terminar';
    case 'cancelada': return 'cancelaste la espera';
    case 'config': return 'el servidor aún no está configurado para la IA';
    case 'ia': return e.message && e.message.length <= 160 && !/^error \d+$/.test(e.message) ? e.message : 'la IA no dio una respuesta válida';
    default: return e.status ? `el servidor respondió con un error (${+e.status})` : 'el servidor respondió con un error';
  }
}
