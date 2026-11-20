// Servidor estático mínimo (sin dependencias) para las pruebas e2e: sirve la raíz del repo.
// Imita a Vercel en lo que importa a la PWA: sw.js sin caché, el resto revalidando con ETag.
// Uso: node tests/e2e/servidor.mjs [puerto]   (por defecto 8781 o PUERTO_E2E)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUERTO = +process.argv[2] || +process.env.PUERTO_E2E || 8781;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

http.createServer((q, s) => {
  const u = new URL(q.url, 'http://localhost');
  let f;
  try { f = decodeURIComponent(u.pathname); } catch {
    s.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    return s.end('Ruta mal formada');
  }
  if (f.endsWith('/')) f += 'index.html';
  const fp = path.join(RAIZ, f);
  const dentro = fp.startsWith(RAIZ + path.sep) && !/[\\/](node_modules|\.git)[\\/]/.test(fp);
  if (!dentro || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    s.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return s.end('No encontrado');
  }
  const cuerpo = fs.readFileSync(fp);
  const etag = '"' + crypto.createHash('md5').update(cuerpo).digest('hex') + '"';
  s.setHeader('etag', etag);
  s.setHeader('cache-control', u.pathname === '/sw.js' ? 'no-cache' : 'public, max-age=0, must-revalidate');
  s.setHeader('content-type', TIPOS[path.extname(fp)] || 'application/octet-stream');
  if (q.headers['if-none-match'] === etag) { s.statusCode = 304; return s.end(); }
  s.end(cuerpo);
}).listen(PUERTO, '127.0.0.1', () => console.log(`Pipos Fitness en http://127.0.0.1:${PUERTO}`));
