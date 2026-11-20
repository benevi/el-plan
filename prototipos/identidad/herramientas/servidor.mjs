// Servidor estático mínimo para los scripts de Playwright. Sirve la raíz del repositorio.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

export function arrancar(puerto = 0) {
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RAIZ, p);
    if (!f.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    try {
      const datos = await readFile(f);
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }).end(datos);
    } catch { res.writeHead(404).end('no'); }
  });
  return new Promise(ok => srv.listen(puerto, '127.0.0.1', () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}

// Abre Chromium con el Playwright del proyecto y, si su navegador no está instalado, con el global.
import { createRequire } from 'node:module';
const requerir = createRequire(import.meta.url);
export async function lanzarChromium() {
  for (const ruta of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return await requerir(ruta).chromium.launch(); } catch { /* prueba el siguiente */ }
  }
  throw new Error('No encuentro Chromium para Playwright (npx playwright install chromium)');
}
