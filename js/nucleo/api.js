// Llamadas a las funciones del servidor (/api/*). La clave de la IA vive solo en Vercel;
// el móvil manda el código de acceso (Perfil → Ajustes) en la cabecera x-app-code.

import { estado } from './estado.js';

export class ErrorApi extends Error {
  constructor(msg, { status = 0, sinRed = false } = {}) { super(msg); this.status = status; this.sinRed = sinRed; }
}

export const enLinea = () => navigator.onLine !== false;

export async function llamar(nombre, cuerpo, { espera = 120000 } = {}) {
  if (!enLinea()) throw new ErrorApi('sin conexión', { sinRed: true });
  const S = estado();
  const base = (S.ajustes.apiUrl || '').replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), espera);
  let r;
  try {
    r = await fetch(`${base}/api/${nombre}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-code': S.ajustes.codigo || '' },
      body: JSON.stringify(cuerpo),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ErrorApi(e.name === 'AbortError' ? 'la IA ha tardado demasiado' : 'sin conexión con el servidor', { sinRed: true });
  } finally { clearTimeout(t); }
  let datos = null;
  try { datos = await r.json(); } catch (e) { /* respuesta vacía */ }
  if (!r.ok) {
    const msg = (datos && datos.error) || (r.status === 401 ? 'código de acceso incorrecto' : r.status === 404 ? 'el servidor no tiene esta función' : 'error ' + r.status);
    throw new ErrorApi(msg, { status: r.status });
  }
  return datos;
}
