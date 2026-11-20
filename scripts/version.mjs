// Calcula VERSION de sw.js a partir del contenido de los archivos de APP (y del propio sw.js, sin la
// línea de VERSION) y la escribe en sw.js. Así cualquier cambio en la app da una caché nueva y nadie
// tiene que acordarse de subir la versión a mano.
//   npm run version            → escribe la VERSION que toca
//   node scripts/version.mjs --comprobar   → sale con error si sw.js no la tiene (lo usa la CI vía npm test)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINEA = /const VERSION = '([^']*)';/;

// Lista APP de un sw.js (texto), sin './' delante; './' queda como '' y no se hashea (es index.html).
export function leerAPP(sw) {
  const m = sw.match(/const APP = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('sw.js sin lista APP');
  return [...vm.runInNewContext(m[1])].map(x => x.replace(/^\.\//, ''));
}

export function versionEscrita(sw) {
  const m = sw.match(LINEA);
  return m ? m[1] : null;
}

// VERSION que corresponde a los archivos de `raiz` (por defecto, el repo).
export function calcularVersion(raiz = RAIZ_REPO) {
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const hash = crypto.createHash('sha256');
  hash.update('sw.js\0' + sw.replace(LINEA, "const VERSION = '';") + '\0');
  for (const f of leerAPP(sw).filter(Boolean).sort()) {
    hash.update(f + '\0');
    hash.update(fs.readFileSync(path.join(raiz, f)));
    hash.update('\0');
  }
  return 'pipos-app-' + hash.digest('hex').slice(0, 12);
}

// Escribe la VERSION calculada en sw.js. Devuelve { antes, ahora }.
export function escribirVersion(raiz = RAIZ_REPO) {
  const archivo = path.join(raiz, 'sw.js');
  const sw = fs.readFileSync(archivo, 'utf8');
  const antes = versionEscrita(sw);
  const ahora = calcularVersion(raiz);
  if (antes !== ahora) fs.writeFileSync(archivo, sw.replace(LINEA, `const VERSION = '${ahora}';`));
  return { antes, ahora };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const raiz = process.argv.slice(2).find(a => !a.startsWith('--')) || RAIZ_REPO;
  if (process.argv.includes('--comprobar')) {
    const escrita = versionEscrita(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'));
    const toca = calcularVersion(raiz);
    if (escrita !== toca) {
      console.error(`sw.js tiene VERSION ${escrita} y le toca ${toca}: ejecuta npm run version`);
      process.exit(1);
    }
    console.log(`VERSION al día: ${toca}`);
  } else {
    const { antes, ahora } = escribirVersion(raiz);
    console.log(antes === ahora ? `VERSION ya estaba al día: ${ahora}` : `VERSION: ${antes} → ${ahora}`);
  }
}
