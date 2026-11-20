// VERSION de sw.js generada: tiene que coincidir con el hash de los archivos de APP. Si falla,
// ejecuta `npm run version` y sube el sw.js cambiado. La CI lo exige porque corre npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ruta } from './ayuda/comun.mjs';
import { calcularVersion, escribirVersion, versionEscrita, leerAPP } from '../scripts/version.mjs';

test('VERSION de sw.js coincide con el hash actual de APP (si no: npm run version)', () => {
  const escrita = versionEscrita(fs.readFileSync(ruta('sw.js'), 'utf8'));
  assert.equal(escrita, calcularVersion(), 'sw.js tiene una VERSION que no corresponde a los archivos: ejecuta npm run version');
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
    fs.appendFileSync(path.join(tmp, 'js/nucleo/ui.js'), '\n// cambio\n');
    const v1 = calcularVersion(tmp);
    assert.notEqual(v1, v0);
    assert.deepEqual(escribirVersion(tmp), { antes: versionEscrita(sw), ahora: v1 });
    assert.equal(calcularVersion(tmp), v1, 'escribir VERSION no debe cambiar el hash');
    fs.appendFileSync(path.join(tmp, 'sw.js'), '\n// cambio en sw.js\n');
    assert.notEqual(calcularVersion(tmp), v1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
