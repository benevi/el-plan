// VERSION de sw.js generada: tiene que coincidir con el hash de los archivos de APP. Si falla,
// ejecuta `npm run version` y sube el sw.js cambiado. La CI lo exige porque corre npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ruta } from './ayuda/comun.mjs';
import { calcularVersion, escribirVersion, versionEscrita, leerAPP, comprobar, leerEscrito, calcular } from '../scripts/version.mjs';

test('VERSION, HUELLAS y la meta de index.html están al día (si no: npm run version)', () => {
  assert.deepEqual(comprobar(), [], 'sw.js o index.html no corresponden a los archivos: ejecuta npm run version');
  const { huellas } = leerEscrito(fs.readFileSync(ruta('sw.js'), 'utf8'));
  const app = leerAPP(fs.readFileSync(ruta('sw.js'), 'utf8'));
  assert.deepEqual(Object.keys(huellas).sort(), app.map(a => './' + a).sort(), 'HUELLAS tiene una entrada por archivo de APP');
  assert.match(huellas['./'], /^sha256-[A-Za-z0-9+/]{43}=$/);
  assert.equal(huellas['./'], huellas['./index.html']);
});

test('cambiar un archivo de APP, o el propio sw.js, cambia la VERSION; escribirla no la cambia', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pipos-version-'));
  try {
    const sw = fs.readFileSync(ruta('sw.js'), 'utf8');
    for (const f of [...leerAPP(sw).filter(Boolean), 'sw.js']) {
      fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
      fs.copyFileSync(ruta(f), path.join(tmp, f));
    }
    const v0 = calcularVersion(tmp);
    assert.equal(v0, calcularVersion());
    assert.match(v0, /^pipos-app-[0-9a-f]{12}$/);
    const h0 = calcular(tmp).huellas['./js/nucleo/ui.js'];
    fs.appendFileSync(path.join(tmp, 'js/nucleo/ui.js'), '\n// cambio\n');
    const v1 = calcularVersion(tmp);
    assert.notEqual(v1, v0);
    assert.notEqual(calcular(tmp).huellas['./js/nucleo/ui.js'], h0);
    assert.ok(comprobar(tmp).length >= 2, 'sin npm run version, la comprobación falla');
    assert.deepEqual(escribirVersion(tmp), { antes: versionEscrita(sw), ahora: v1 });
    assert.equal(calcularVersion(tmp), v1, 'escribir VERSION no debe cambiar el hash');
    assert.deepEqual(comprobar(tmp), []);
    assert.match(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), new RegExp(`<meta name="pipos-version" content="${v1}">`));
    fs.appendFileSync(path.join(tmp, 'sw.js'), '\n// cambio en sw.js\n');
    assert.notEqual(calcularVersion(tmp), v1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
