// S5 (re-auditoría): package.json y package-lock.json no se sirven (dejan ver las versiones de las dependencias),
// pero NO se excluyen con .vercelignore: lo que este ignora no llega al build y Vercel necesita package.json para
// instalar las dependencias de las funciones de api/ (@vercel/blob, @anthropic-ai/sdk). Se cortan con una
// redirección de vercel.json, que se aplica antes que los archivos estáticos (las rewrites no: el archivo gana).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ruta } from './ayuda/comun.mjs';

test('S5: package.json y package-lock.json se redirigen y siguen en el despliegue', () => {
  const v = JSON.parse(fs.readFileSync(ruta('vercel.json'), 'utf8'));
  const fuentes = (v.redirects || []).map(r => r.source);
  for (const f of ['/package.json', '/package-lock.json']) assert.ok(fuentes.includes(f), f);
  const ignorados = fs.readFileSync(ruta('.vercelignore'), 'utf8').split('\n').map(l => l.trim());
  assert.ok(!ignorados.some(l => /^\/?package(-lock)?\.json$|^\/?\*\.json$/.test(l)), '.vercelignore no puede quitar package.json: las funciones se quedarían sin dependencias');
});
