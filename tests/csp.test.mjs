// PR 17: la CSP de vercel.json es estricta y el código de la app no necesita relajarla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const archivosJS = dir => fs.readdirSync(path.join(RAIZ, dir), { recursive: true }).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));

const cabeceras = () => {
  const todas = {};
  for (const r of JSON.parse(leer('vercel.json')).headers) if (r.source === '/(.*)') for (const c of r.headers) todas[c.key] = c.value;
  return todas;
};

test('vercel.json: CSP estricta, HSTS, Permissions-Policy, COOP y sin marcos', () => {
  const c = cabeceras();
  const csp = Object.fromEntries(c['Content-Security-Policy'].split(';').map(d => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.deepEqual(csp['script-src'], ["'self'"]);
  assert.deepEqual(csp['style-src'], ["'self'"]);
  assert.deepEqual(csp['connect-src'], ["'self'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.ok(!/unsafe|\*/.test(c['Content-Security-Policy']), 'sin unsafe-* ni comodines');
  assert.match(c['Strict-Transport-Security'], /max-age=\d{7,}/);
  assert.match(c['Permissions-Policy'], /camera=\(\)/);
  assert.match(c['Permissions-Policy'], /screen-wake-lock=\(self\)/); // la sesión mantiene la pantalla encendida
  assert.equal(c['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.equal(c['X-Frame-Options'], 'DENY');
});

test('index.html sin <script> en línea, sin on…= y sin style', () => {
  const html = leer('index.html');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.match(m[1], /\bsrc=/, 'cada <script> carga un archivo');
    assert.equal(m[2].trim(), '', 'sin código dentro de <script>');
  }
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'sin manejadores on…=');
  assert.ok(!/\sstyle\s*=/i.test(html) && !/<style\b/i.test(html), 'sin estilos en línea');
});

test('las plantillas de js/ no llevan atributos style ni on…= (los bloquearía la CSP)', () => {
  for (const f of archivosJS('js')) {
    const t = leer(f).replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/<[a-z][^<>]*\sstyle\s*=/i.test(t), `${f}: atributo style en una plantilla (usa data-var o una clase)`);
    assert.ok(!/<[a-z][^<>]*\son[a-z]+\s*=\s*["'`]/i.test(t), `${f}: manejador on…= en una plantilla`);
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(t), `${f}: eval o new Function`);
  }
});

test('.vercelignore no publica la documentación ni las pruebas', () => {
  const lineas = leer('.vercelignore').split('\n').map(l => l.trim().replace(/^\//, '').replace(/\/$/, ''));
  for (const x of ['docs', 'tests', 'LEEME.md', 'CLAUDE.md', 'scripts']) assert.ok(lineas.includes(x), `.vercelignore sin ${x}`);
});
