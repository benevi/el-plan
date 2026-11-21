// Servidor estático mínimo (sin dependencias) para las pruebas e2e: sirve la raíz del repo.
// Imita a Vercel en lo que importa a la PWA: sw.js sin caché, el resto revalidando con ETag.
// Uso: node tests/e2e/servidor.mjs [puerto]   (por defecto 8781 o PUERTO_E2E)
// Las pruebas del service worker lo crean en su propio puerto con crearServidor() y lo controlan:
// cambiar la raíz (otra «versión desplegada»), servir rutas concretas de otra raíz (un despliegue a
// mitad de la descarga), cortar o retrasar archivos concretos y ver qué se pidió. Con control.api = (req, res)
// atienden /api/* (p. ej. la función real api/entrenador.js con una IA simulada, en espera.spec.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

// Las cabeceras de vercel.json (CSP, HSTS…) también aquí, para que las e2e prueben la app con la CSP real.
// Cada raíz servida usa su propio vercel.json si lo tiene (el «main» de sw.spec lleva el de producción, sin CSP);
// si no, el del repo.
const reglasCache = new Map();
function reglasDe(raiz) {
  if (!reglasCache.has(raiz)) {
    const propio = path.join(raiz, 'vercel.json');
    const f = fs.existsSync(propio) ? propio : path.join(RAIZ, 'vercel.json');
    reglasCache.set(raiz, JSON.parse(fs.readFileSync(f, 'utf8')).headers
      .map(r => ({ re: new RegExp('^' + r.source.replace(/[.]/g, '\\.').replace(/\(\\\.\*\)/g, '(.*)') + '$'), headers: r.headers })));
  }
  return reglasCache.get(raiz);
}
export function cabecerasDe(ruta, raiz = RAIZ) {
  const fuera = {};
  for (const r of reglasDe(raiz)) if (r.re.test(ruta)) for (const c of r.headers) fuera[c.key.toLowerCase()] = c.value;
  return fuera;
}

export function crearServidor({ raiz = RAIZ } = {}) {
  const control = { raiz, porRuta: {}, cortar: [], retrasar: {}, peticiones: [], api: null };
  const servidor = http.createServer((q, s) => {
    const u = new URL(q.url, 'http://localhost');
    control.peticiones.push(u.pathname);
    if (control.api && u.pathname.startsWith('/api/')) return control.api(q, s);
    // Simula cobertura a medias: corta la conexión de los archivos indicados.
    if (control.cortar.some(x => u.pathname.includes(x))) { q.socket.destroy(); return; }
    const ms = Object.entries(control.retrasar).find(([x]) => u.pathname.includes(x));
    if (ms) setTimeout(() => servir(q, s, u), ms[1]); else servir(q, s, u);
  });
  function servir(q, s, u) {
    let f;
    try { f = decodeURIComponent(u.pathname); } catch {
      s.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      return s.end('Ruta mal formada');
    }
    if (f.endsWith('/')) f += 'index.html';
    const base = control.porRuta[f] || control.raiz;
    const fp = path.join(base, f);
    const dentro = fp.startsWith(base + path.sep) && !/[\\/](node_modules|\.git)[\\/]/.test(fp);
    if (!dentro || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      s.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return s.end('No encontrado');
    }
    const cuerpo = fs.readFileSync(fp);
    const etag = '"' + crypto.createHash('md5').update(cuerpo).digest('hex') + '"';
    for (const [k, v] of Object.entries(cabecerasDe(u.pathname, base))) if (k !== 'cache-control') s.setHeader(k, v);
    s.setHeader('etag', etag);
    s.setHeader('cache-control', u.pathname === '/sw.js' ? 'no-cache' : 'public, max-age=0, must-revalidate');
    s.setHeader('content-type', TIPOS[path.extname(fp)] || 'application/octet-stream');
    if (q.headers['if-none-match'] === etag) { s.statusCode = 304; return s.end(); }
    s.end(cuerpo);
  }
  return {
    control,
    escuchar: puerto => new Promise(r => servidor.listen(puerto, '127.0.0.1', r)),
    cerrar: () => new Promise(r => { servidor.closeAllConnections(); servidor.close(r); }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const PUERTO = +process.argv[2] || +process.env.PUERTO_E2E || 8781;
  crearServidor().escuchar(PUERTO).then(() => console.log(`Pipos Fitness en http://127.0.0.1:${PUERTO}`));
}
