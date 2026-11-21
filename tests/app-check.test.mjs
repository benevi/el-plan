// Comprueba la lista APP de sw.js frente a los archivos reales y que no haya import rotos
// (de pwa/app-check.js de la auditoría). Si añades un archivo a la app, súmalo a APP y ejecuta npm run version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { RAIZ, ruta } from './ayuda/comun.mjs';

const sw = fs.readFileSync(ruta('sw.js'), 'utf8');
const APP = [...vm.runInNewContext(sw.match(/const APP = (\[[\s\S]*?\]);/)[1])].map(x => x.replace(/^\.\//, ''));
const recorrer = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  ['.git', 'node_modules', 'tests', 'test-results', 'playwright-report'].includes(e.name) ? [] : e.isDirectory() ? recorrer(path.join(d, e.name)) : [path.join(d, e.name)]);
const archivos = recorrer(RAIZ).map(f => path.relative(RAIZ, f).split(path.sep).join('/'));
const front = archivos.filter(f => /^(css|js|icons)\//.test(f) || /^fonts\/.*\.woff2$/.test(f) || ['index.html', 'manifest.webmanifest'].includes(f));

// Módulos alcanzables desde main.js siguiendo import/export estáticos y dinámicos.
const alcanzables = new Set();
const rotos = [];
(function visitar(f) {
  if (alcanzables.has(f)) return;
  alcanzables.add(f);
  const src = fs.readFileSync(ruta(f), 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const s = m[1] || m[2] || m[3];
    if (!s.startsWith('.')) { rotos.push(`${f} -> ${s} (no relativo)`); continue; }
    const t = path.posix.normalize(path.posix.dirname(f) + '/' + s);
    if (!fs.existsSync(ruta(t))) { rotos.push(`${f} -> ${s}`); continue; }
    visitar(t);
  }
})('js/main.js');

test('todo lo que está en APP existe', () => {
  assert.deepEqual(APP.filter(a => a && !fs.existsSync(ruta(a))), []);
});

test('todo archivo de la app (css, js, icons, fuentes, index, manifest) está en APP', () => {
  assert.deepEqual(front.filter(f => !APP.includes(f)), []);
});

// Lo que el sitio sirve y no es de la app: ni se precarga ni entra en VERSION. Cualquier otro archivo
// (también una carpeta nueva de recursos) tiene que estar en APP, o añadirse aquí a sabiendas.
const FUERA_DE_APP = [
  /^api\//, /^tests\//, /^scripts\//, /^docs\//, /^\.github\//, /^fonts\/OFL-[\w-]+\.txt$/,
  /^(\.gitignore|\.vercelignore|LEEME\.md|CLAUDE\.md|eslint\.config\.js|playwright\.config\.js|package\.json|package-lock\.json|vercel\.json|sw\.js)$/,
];
test('todo archivo servible está en APP salvo lo excluido a sabiendas (VERSION cubre toda la app)', () => {
  const todo = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    ['.git', 'node_modules', 'test-results', 'playwright-report'].includes(e.name) ? [] : e.isDirectory() ? todo(path.join(d, e.name)) : [path.join(d, e.name)]);
  const sueltos = todo(RAIZ).map(f => path.relative(RAIZ, f).split(path.sep).join('/'))
    .filter(f => !APP.includes(f) && !FUERA_DE_APP.some(r => r.test(f)));
  assert.deepEqual(sueltos, [], 'súmalos a APP en sw.js (y npm run version) o a FUERA_DE_APP en esta prueba');
});

test('sin import() dinámico en js/: tras activar una versión, una pestaña vieja no puede pedir módulos nuevos', () => {
  const js = archivos.filter(f => f.startsWith('js/') && f.endsWith('.js'));
  assert.deepEqual(js.filter(f => /\bimport\s*\(/.test(fs.readFileSync(ruta(f), 'utf8'))), []);
});

test('APP no tiene entradas repetidas e incluye la raíz', () => {
  assert.deepEqual(APP.filter((a, i) => APP.indexOf(a) !== i), []);
  assert.ok(APP.includes(''), 'falta ./');
});

test('no hay import rotos desde main.js', () => {
  assert.deepEqual(rotos, []);
  assert.ok(alcanzables.size > 20);
});

test('todos los módulos alcanzables desde main.js están en APP', () => {
  assert.deepEqual([...alcanzables].filter(f => !APP.includes(f)), []);
});

test('lo que enlazan index.html, el CSS y el manifiesto está en APP', () => {
  const refs = new Set();
  const html = fs.readFileSync(ruta('index.html'), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) refs.add(m[1]);
  for (const c of archivos.filter(f => f.endsWith('.css'))) {
    for (const m of fs.readFileSync(ruta(c), 'utf8').matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      if (!/^data:|^https?:|^#/.test(m[1])) refs.add(path.posix.normalize(path.posix.dirname(c) + '/' + m[1]));
    }
  }
  for (const i of JSON.parse(fs.readFileSync(ruta('manifest.webmanifest'), 'utf8')).icons) refs.add(i.src);
  assert.deepEqual([...refs].filter(r => !APP.includes(r)), []);
});

test('sw.js declara una VERSION', () => {
  assert.match(sw, /const VERSION = 'pipos-[\w.-]+';/);
});

test('index.html carga los scripts como archivos (sin <script> en línea, para la CSP)', () => {
  const html = fs.readFileSync(ruta('index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 2);
  for (const [, attrs, cuerpo] of scripts) {
    assert.match(attrs, /\ssrc="/, 'script sin src');
    assert.equal(cuerpo.trim(), '', 'script con código en línea');
  }
  assert.match(html, /<script src="js\/arranque\.js"><\/script>\s*<script type="module" src="js\/main\.js">/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" crossorigin="use-credentials">/);
});

// ── Fallos demostrados por la auditoría (PR 5) ──

test('APP solo precarga JS que la app usa (sin generador.js)', () => {
  // js/arranque.js es un script clásico que carga index.html, no un módulo de main.js.
  const html = fs.readFileSync(ruta('index.html'), 'utf8');
  assert.deepEqual(APP.filter(a => a.endsWith('.js') && !alcanzables.has(a) && !html.includes(`src="${a}"`)), []);
});

test('sin fuentes de Google: la app no depende de la red para pintar el texto', () => {
  const html = fs.readFileSync(ruta('index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(sw, /fonts\.googleapis|gstatic/);
  for (const c of archivos.filter(f => f.endsWith('.css'))) assert.doesNotMatch(fs.readFileSync(ruta(c), 'utf8'), /@import|url\(['"]?https?:/, c);
});

test('las fuentes alojadas pesan ≤ 150 KB en total y llevan su licencia', () => {
  const fuentes = archivos.filter(f => f.startsWith('fonts/') && f.endsWith('.woff2'));
  // PR 13: la identidad aprobada (Carril 2) usa una sola familia, Instrument Sans (DIS 2).
  assert.ok(fuentes.length >= 1);
  const total = fuentes.reduce((n, f) => n + fs.statSync(ruta(f)).size, 0);
  assert.ok(total <= 150 * 1024, `fuentes: ${total} bytes`);
  assert.ok(fs.existsSync(ruta('fonts/OFL-instrument-sans.txt')));
});

test('los PNG de icons/ pesan menos de 50 KB', () => {
  const pesados = archivos.filter(f => f.startsWith('icons/') && f.endsWith('.png')).map(f => [f, fs.statSync(ruta(f)).size]).filter(([, n]) => n > 50 * 1024);
  assert.deepEqual(pesados, []);
});

// Ejecuta sw.js en un contexto aislado con caches y fetch simulados y devuelve lo que guarda.
async function navegarConSW(url, { modo = 'navigate', enCache = false } = {}) {
  const oyentes = {};
  const guardados = [];
  const buscados = [];
  const cache = { match: async k => { buscados.push(typeof k === 'string' ? k : k.url); return enCache ? { ok: true, viejo: true } : undefined; }, put: async (k, v) => { guardados.push(typeof k === 'string' ? k : k.url); }, addAll: async () => {} };
  const contexto = {
    self: { addEventListener: (t, f) => { oyentes[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: new URL('https://pipos.test/sw.js'), URL,
    caches: { open: async () => cache, keys: async () => [] },
    fetch: async () => ({ ok: true, status: 200, clone() { return this; } }),
  };
  vm.runInNewContext(sw, contexto);
  let respuesta = null;
  oyentes.fetch({ request: { url, method: 'GET', mode: modo }, respondWith(p) { respuesta = p; } });
  const r = await respuesta;
  await new Promise(r => setTimeout(r, 0));
  return Object.assign(guardados, { buscados, respondio: respuesta !== null, respuesta: r });
}

test('al navegar a la raíz o a index.html sirve el index.html precargado (sin guardar nada)', async () => {
  for (const u of ['https://pipos.test/', 'https://pipos.test/index.html', 'https://pipos.test/?x=1']) {
    const g = await navegarConSW(u, { enCache: true });
    assert.deepEqual([...g], [], u);
    assert.deepEqual(g.buscados, ['./index.html'], u);
    assert.equal(g.respuesta.viejo, true, u);
  }
});

test('el service worker solo guarda como index.html la navegación a ./ o ./index.html', async () => {
  // En Vercel, /cualquier-cosa responde 200 con otra página o un 404 propio: no debe sustituir a la app guardada.
  const sub = await navegarConSW('https://pipos.test/sub/ruta');
  assert.deepEqual([...sub], []);
  assert.equal(sub.respondio, false);
  // Otra página del sitio con extensión (p. ej. /LEEME.md) ni se sirve ni se guarda: va directa a la red.
  const g = await navegarConSW('https://pipos.test/LEEME.md');
  assert.deepEqual([...g], []);
  assert.equal(g.respondio, false);
});

test('el fetch no reescribe en la caché archivos propios ya guardados (solo entran en install)', async () => {
  assert.deepEqual([...await navegarConSW('https://pipos.test/js/main.js', { modo: 'cors', enCache: true })], []);
  // Lo que no está precargado va a la red y tampoco se guarda.
  assert.deepEqual([...await navegarConSW('https://pipos.test/otra/cosa.png', { modo: 'no-cors' })], []);
});

test('/api/* y otros orígenes no pasan por la caché', async () => {
  assert.equal((await navegarConSW('https://pipos.test/api/entrenador', { modo: 'cors' })).respondio, false);
  assert.equal((await navegarConSW('https://fonts.gstatic.com/x.woff2', { modo: 'cors' })).respondio, false);
});
