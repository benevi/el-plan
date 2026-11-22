// S2: con el código (compartido por los dos), cualquiera sube basura «con forma de copia» a nombre de otra
// persona: agota su tope diario (sus copias reales dan 429) y la retención borra sus copias buenas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Respuesta, peticion } from '/home/user/wt/auditoria/tests/api/_simulado.mjs';
import { BlobSimulado } from '/home/user/wt/auditoria/tests/api/_blob-simulado.mjs';
import handler, { ponerAlmacen, reiniciarRitmo, ponerReloj } from '/home/user/wt/auditoria/api/copia.js';
process.env.APP_CODE = 'pipos'; process.env.VERCEL_ENV = 'production';
console.log = () => {}; console.error = () => {};
const blob = new BlobSimulado(); ponerAlmacen(blob);
let t = Date.parse('2026-11-01T08:00:00Z'); ponerReloj(() => t);
const META = randomBytes(55).toString('base64url');
const archivo = () => { const b = randomBytes(300); b.write('PIPC', 0, 'latin1'); b[4] = 2; return b; };
const subir = async (bytes, real) => { const r = new Respuesta(); await handler(peticion({ codigo: 'pipos', tipo: 'application/octet-stream', cuerpo: bytes,
  cabeceras: { 'x-copia-accion': 'subir', 'x-copia-persona': 'victor', 'x-copia-sal': bytes.subarray(11, 27).toString('base64url'), 'x-copia-meta': real ? 'R' + META.slice(1) : META, 'content-length': String(bytes.length) } }), r); return r.codigo; };
const reales = () => [...blob.blobs.keys()].filter(k => k.startsWith('copias/victor/') && k.includes('_mR'));
test('tope diario agotado por un tercero y copias reales borradas por la retención', async () => {
  // 20 días de copias reales de Víctor, una al día a las 08:00
  for (let d = 0; d < 20; d++) { reiniciarRitmo(); assert.equal(await subir(archivo(), true), 200); t += 864e5; }
  const antes = reales().length;
  // A partir de hoy, alguien con el código sube basura a las 00:00 UTC cada día (30 en un minuto, en tandas de 20/10 min)
  const resultados = [];
  for (let d = 0; d < 130; d++) {
    const dia0 = Math.floor(t / 864e5) * 864e5;
    t = dia0 + 60e3; reiniciarRitmo();
    for (let i = 0; i < 30; i++) { if (i === 20) { t += 11 * 60e3; } await subir(archivo(), false); t += 1000; }
    t = dia0 + 20 * 3600e3; // Víctor termina su sesión a las 20:00
    resultados.push(await subir(archivo(), true));
    t = dia0 + 864e5;
  }
  const despues = reales().length;
  console.info?.call(null);
  process.stdout.write(`# reales antes ${antes}, después ${despues}; subidas reales de Víctor en 130 días: ${JSON.stringify(resultados.reduce((o, c) => (o[c] = (o[c] || 0) + 1, o), {}))}; total blobs de victor ${[...blob.blobs.keys()].filter(k => k.startsWith('copias/victor/')).length}\n`);
  assert.ok(resultados.every(c => c === 429));
  assert.equal(despues, 0);
});
