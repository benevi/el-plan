// Comprueba la lista APP de sw.js frente a los archivos reales y que no haya import rotos
// (de pwa/app-check.js de la auditoría). Si añades un archivo a la app, súmalo a APP y sube VERSION.
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
const front = archivos.filter(f => /^(css|js|icons)\//.test(f) || ['index.html', 'manifest.webmanifest'].includes(f));

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

test('todo archivo de la app (css, js, icons, index, manifest) está en APP', () => {
  assert.deepEqual(front.filter(f => !APP.includes(f)), []);
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

// ── Fallos demostrados por la auditoría (PR 5) ──

test('APP solo precarga JS que la app usa (sin generador.js)', { todo: 'PR 5: generador.js en la precarga' }, () => {
  assert.deepEqual(APP.filter(a => a.endsWith('.js') && !alcanzables.has(a)), []);
});

test('sin fuentes de Google: la app no depende de la red para pintar el texto', { todo: 'PR 5: fuentes alojadas en el sitio (D8)' }, () => {
  const html = fs.readFileSync(ruta('index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('los PNG de icons/ pesan menos de 50 KB', { todo: 'PR 5: PNG pesados' }, () => {
  const pesados = archivos.filter(f => f.startsWith('icons/') && f.endsWith('.png')).map(f => [f, fs.statSync(ruta(f)).size]).filter(([, n]) => n > 50 * 1024);
  assert.deepEqual(pesados, []);
});

// Ejecuta sw.js en un contexto aislado con caches y fetch simulados y devuelve lo que guarda.
async function navegarConSW(url, { modo = 'navigate', enCache = false } = {}) {
  const oyentes = {};
  const guardados = [];
  const cache = { match: async () => (enCache ? { ok: true, viejo: true } : undefined), put: async (k, v) => { guardados.push(typeof k === 'string' ? k : k.url); }, addAll: async () => {} };
  const contexto = {
    self: { addEventListener: (t, f) => { oyentes[t] = f; }, skipWaiting() {}, clients: { claim() {} } },
    location: new URL('https://pipos.test/sw.js'), URL,
    caches: { open: async () => cache, keys: async () => [] },
    fetch: async () => ({ ok: true, status: 200, clone() { return this; } }),
  };
  vm.runInNewContext(sw, contexto);
  let respuesta;
  oyentes.fetch({ request: { url, method: 'GET', mode: modo }, respondWith(p) { respuesta = p; } });
  await respuesta;
  await new Promise(r => setTimeout(r, 0));
  return guardados;
}

test('el service worker guarda index.html al navegar a la raíz', async () => {
  assert.deepEqual(await navegarConSW('https://pipos.test/'), ['./index.html']);
});

test('el service worker solo guarda como index.html la navegación a ./ o ./index.html', { todo: 'PR 5: index.html pisado por cualquier navegación' }, async () => {
  // En Vercel, /cualquier-cosa responde 200 con otra página o un 404 propio: no debe sustituir a la app guardada.
  assert.deepEqual(await navegarConSW('https://pipos.test/sub/ruta'), []);
});

test('el fetch no reescribe en la caché archivos propios ya guardados (solo entran en install)', { todo: 'PR 5: mezcla de módulos viejos y nuevos' }, async () => {
  assert.deepEqual(await navegarConSW('https://pipos.test/js/main.js', { modo: 'cors', enCache: true }), []);
});
