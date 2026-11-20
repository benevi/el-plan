// Para probar las copias en la nube sin red: un fetch que entrega cada petición a la función real
// api/copia.js (con un Blob simulado) y un almacén de claves en memoria (en lugar de IndexedDB).
import { Respuesta, Peticion } from '../api/_simulado.mjs';
import { BlobSimulado } from '../api/_blob-simulado.mjs';
import handler, { ponerAlmacen, reiniciarRitmo } from '../../api/copia.js';

export { BlobSimulado };

// Pasa una petición (método, cabeceras, cuerpo en bytes) por api/copia.js. Devuelve { status, headers, body }.
export async function porLaFuncion({ method = 'POST', headers = {}, body = null }) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const bytes = body == null ? Buffer.alloc(0) : Buffer.from(typeof body === 'string' ? body : body);
  h['content-length'] = String(bytes.length);
  const res = new Respuesta();
  await handler(new Peticion(method, h, bytes), res);
  const cab = { ...res.cabeceras };
  if (res.bytes) return { status: res.codigo, headers: cab, body: res.bytes };
  cab['content-type'] = 'application/json';
  return { status: res.codigo, headers: cab, body: Buffer.from(JSON.stringify(res.cuerpo === undefined ? null : res.cuerpo)) };
}

// fetch falso para js/nucleo/copia.js (configurarCopia({ fetch })). Apunta las peticiones en `peticiones`.
export function fetchNube(blob, { codigo = 'secreto' } = {}) {
  process.env.APP_CODE = codigo;
  ponerAlmacen(blob); reiniciarRitmo();
  const peticiones = [];
  const f = async (url, init = {}) => {
    peticiones.push({ url, init });
    if (f.sinRed) throw new TypeError('Failed to fetch');
    const r = await porLaFuncion({ method: init.method, headers: init.headers, body: init.body });
    return new Response(r.body, { status: r.status, headers: r.headers });
  };
  f.peticiones = peticiones;
  f.sinRed = false;
  return f;
}

export class ClavesMemoria {
  constructor() { this.regs = new Map(); }
  async leer(p) { return this.regs.get(p) || null; }
  async escribir(r) { this.regs.set(r.persona, r); return true; }
  async borrar(p) { this.regs.delete(p); return true; }
}
