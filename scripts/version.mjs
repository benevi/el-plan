// Calcula VERSION de sw.js a partir del contenido de los archivos de APP (y del propio sw.js, sin
// VERSION ni HUELLAS) y la escribe en sw.js junto con HUELLAS, la huella SHA-256 de cada archivo de APP
// que comprueba la instalación. Así cualquier cambio en la app da una caché nueva, nadie tiene que
// acordarse de subir la versión a mano y no se puede instalar una versión con archivos de otro despliegue.
//   npm run version            → escribe la VERSION que toca
//   node scripts/version.mjs --comprobar   → sale con error si sw.js no la tiene (lo usa la CI vía npm test)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINEA = /const VERSION = '([^']*)';/;
const BLOQUE = /const HUELLAS = \{[\s\S]*?\};/;

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

// Lo que sw.js tiene escrito: { version, huellas }.
export function leerEscrito(sw) {
  const m = sw.match(BLOQUE);
  if (!m) throw new Error('sw.js sin const HUELLAS = {…};');
  return { version: versionEscrita(sw), huellas: vm.runInNewContext('(' + m[0].slice('const HUELLAS = '.length, -1) + ')') };
}

const sinGenerado = sw => sw.replace(LINEA, "const VERSION = '';").replace(BLOQUE, 'const HUELLAS = {};');
// index.html lleva <meta name="pipos-version" content="VERSION">: la instalación lo usa para aceptar el
// index.html aunque Vercel le inyecte algo (la barra de las vistas previas). Para el hash va vacío.
const META = /<meta name="pipos-version" content="[^"]*">/;
const conMeta = (html, v) => {
  if (!META.test(html)) throw new Error('index.html sin <meta name="pipos-version" content="…">');
  return html.replace(META, `<meta name="pipos-version" content="${v}">`);
};
function leer(raiz, f, version) {
  const b = fs.readFileSync(path.join(raiz, f));
  return f === 'index.html' ? Buffer.from(conMeta(b.toString('utf8'), version)) : b;
}

// VERSION y HUELLAS que corresponden a los archivos de `raiz` (por defecto, el repo). Las huellas son
// las de los archivos tal como quedan escritos (index.html con su meta de VERSION).
export function calcular(raiz = RAIZ_REPO) {
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const app = leerAPP(sw);
  const hash = crypto.createHash('sha256');
  hash.update('sw.js\0' + sinGenerado(sw) + '\0');
  for (const f of app.filter(Boolean).sort()) {
    hash.update(f + '\0');
    hash.update(leer(raiz, f, ''));
    hash.update('\0');
  }
  const version = 'pipos-app-' + hash.digest('hex').slice(0, 12);
  const huellas = {};
  for (const entrada of app) {
    huellas['./' + entrada] = 'sha256-' + crypto.createHash('sha256').update(leer(raiz, entrada || 'index.html', version)).digest('base64');
  }
  return { version, huellas };
}
export const calcularVersion = (raiz = RAIZ_REPO) => calcular(raiz).version;

const bloque = huellas => 'const HUELLAS = {\n' + Object.entries(huellas).map(([k, v]) => `  '${k}': '${v}',`).join('\n') + '\n};';

// Escribe VERSION y HUELLAS en sw.js. Devuelve { antes, ahora } (las VERSION).
export function escribirVersion(raiz = RAIZ_REPO) {
  const archivo = path.join(raiz, 'sw.js');
  const sw = fs.readFileSync(archivo, 'utf8');
  if (!BLOQUE.test(sw)) throw new Error('sw.js sin const HUELLAS = {…};');
  const antes = versionEscrita(sw);
  const { version, huellas } = calcular(raiz);
  const nuevo = sw.replace(LINEA, `const VERSION = '${version}';`).replace(BLOQUE, bloque(huellas));
  if (nuevo !== sw) fs.writeFileSync(archivo, nuevo);
  const index = path.join(raiz, 'index.html');
  const html = fs.readFileSync(index, 'utf8');
  if (conMeta(html, version) !== html) fs.writeFileSync(index, conMeta(html, version));
  return { antes, ahora: version };
}

// ¿Está sw.js al día? Devuelve una lista de problemas (vacía si sí).
export function comprobar(raiz = RAIZ_REPO) {
  const { version, huellas } = leerEscrito(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'));
  const toca = calcular(raiz);
  const problemas = [];
  if (version !== toca.version) problemas.push(`VERSION ${version}, le toca ${toca.version}`);
  const meta = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8').match(META);
  if (!meta || !meta[0].includes(`"${toca.version}"`)) problemas.push('index.html no lleva la VERSION en <meta name="pipos-version">');
  for (const k of new Set([...Object.keys(huellas), ...Object.keys(toca.huellas)])) {
    if (huellas[k] !== toca.huellas[k]) problemas.push(`HUELLAS['${k}'] no coincide`);
  }
  return problemas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const raiz = process.argv.slice(2).find(a => !a.startsWith('--')) || RAIZ_REPO;
  if (process.argv.includes('--comprobar')) {
    const problemas = comprobar(raiz);
    if (problemas.length) {
      console.error(`sw.js no está al día (ejecuta npm run version):\n- ${problemas.join('\n- ')}`);
      process.exit(1);
    }
    console.log('VERSION y HUELLAS al día');
  } else {
    const { antes, ahora } = escribirVersion(raiz);
    console.log(antes === ahora ? `VERSION ya estaba al día: ${ahora}` : `VERSION: ${antes} → ${ahora}`);
  }
}
