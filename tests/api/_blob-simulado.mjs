// Almacén Vercel Blob simulado (en memoria) con la forma que usa api/copia.js: put, list, get y del.
// Imita lo que importa del SDK (@vercel/blob 2.8): acceso obligatorio, sin sobrescribir salvo allowOverwrite,
// list por prefijo y con cursor, get que devuelve un ReadableStream y del con una lista de rutas.
// `fechas` permite simular cuándo se subió cada blob (uploadedAt).
export class BlobSimulado {
  constructor() { this.blobs = new Map(); this.llamadas = []; this.fallo = null; }
  _f(op) { this.llamadas.push(op); if (this.fallo) { const e = this.fallo; throw typeof e === 'function' ? e(op) : e; } }
  async put(pathname, cuerpo, opciones = {}) {
    this._f('put');
    if (opciones.access !== 'private' && opciones.access !== 'public') throw new Error('Vercel Blob: access must be "private" or "public"');
    if (this.blobs.has(pathname) && !opciones.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
    const bytes = Buffer.from(cuerpo);
    this.blobs.set(pathname, { pathname, bytes, opciones, uploadedAt: new Date() });
    return { pathname, url: 'https://simulado.private.blob.vercel-storage.com/' + pathname, contentType: opciones.contentType };
  }
  async list({ prefix = '', limit = 1000, cursor } = {}) {
    this._f('list');
    const todos = [...this.blobs.values()].filter(b => b.pathname.startsWith(prefix)).sort((a, b) => (a.pathname < b.pathname ? -1 : 1));
    const desde = cursor ? +cursor : 0;
    const pagina = todos.slice(desde, desde + limit);
    const hasMore = desde + limit < todos.length;
    return { blobs: pagina.map(b => ({ pathname: b.pathname, size: b.bytes.length, uploadedAt: b.uploadedAt, url: 'https://simulado/' + b.pathname, downloadUrl: '', etag: 'e' })), hasMore, cursor: hasMore ? String(desde + limit) : undefined };
  }
  async get(pathname, opciones = {}) {
    this._f('get');
    if (opciones.access !== 'private') throw new Error('Vercel Blob: get de un blob privado sin access private');
    const b = this.blobs.get(pathname);
    if (!b) return null;
    const bytes = new Uint8Array(b.bytes);
    return {
      statusCode: 200, headers: new Headers(),
      stream: new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); } }),
      blob: { pathname, contentType: 'application/octet-stream', size: bytes.length },
    };
  }
  async del(rutas) {
    this._f('del');
    for (const r of [].concat(rutas)) this.blobs.delete(r);
  }
}
