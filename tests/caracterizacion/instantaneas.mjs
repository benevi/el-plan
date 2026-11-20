// Compara (o reescribe) las instantáneas de un grupo de generar.mjs: un test por perfil.
// Para reescribirlas a propósito (solo si un PR cambia el comportamiento y lo explica):
//   ACTUALIZAR_INSTANTANEAS=1 npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ruta } from '../ayuda/comun.mjs';
import { GRUPOS, PERFILES } from './generar.mjs';

// Una línea por perfil y salida: archivos más pequeños y diffs que dicen qué salida cambió.
const aTexto = o => '{\n' + Object.entries(o).map(([p, salidas]) => ` ${JSON.stringify(p)}: {\n` +
  Object.entries(salidas).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n }').join(',\n') + '\n}\n';

export function probarGrupo(grupo) {
  const archivo = ruta(`tests/caracterizacion/${grupo}.json`);
  const actualizar = process.env.ACTUALIZAR_INSTANTANEAS === '1';
  const guardadas = !actualizar && fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : {};
  const nuevas = {};
  test(`${grupo}: hay una instantánea por perfil y ninguna de sobra`, { skip: actualizar }, () => {
    assert.deepEqual(Object.keys(guardadas).sort(), PERFILES.map(p => p.nombre).sort());
  });
  PERFILES.forEach((p, n) => {
    test(`${grupo}: ${p.nombre}`, async () => {
      const salida = await GRUPOS[grupo](p, n);
      if (actualizar) { nuevas[p.nombre] = salida; return; }
      assert.deepStrictEqual(salida, guardadas[p.nombre]);
    });
  });
  if (actualizar) after(() => fs.writeFileSync(archivo, aTexto(nuevas)));
}
