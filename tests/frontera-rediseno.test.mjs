// Frontera del rediseño (plan, sección 2): los PR 13-16 cambian el aspecto, no la lógica ni la forma de los
// datos. En sus ramas, esta prueba falla si algún commit propio (o un cambio sin guardar) toca:
//   js/nucleo/estado.js, js/nucleo/modelo.js, js/nucleo/api.js, la lógica del entrenador (dia.js, plan.js,
//   checkin.js, ia.js, validar.js), js/reglas/, js/datos/ o api/.
// «Propio» = commit sin fusionar que no está en ninguna otra rama (local o remota): así no cuentan los
// cambios de la rama de la que sale (p. ej. una que aún no se ha fusionado en pipos-v2).
// Solo se aplica en ramas del rediseño (pr13…pr16 o rediseno…; en CI, GITHUB_HEAD_REF). Sin git o sin
// historial (CI con checkout superficial) se salta y lo dice. Para forzarla: FRONTERA=1 npm test.
// Si una pantalla necesita un dato nuevo: función de solo lectura en otro archivo y aviso al integrador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { RAIZ } from './ayuda/comun.mjs';

export const PROHIBIDOS = [
  /^js\/nucleo\/(estado|modelo|api)\.js$/,
  /^js\/areas\/entrenador\/(dia|plan|checkin|ia|validar)\.js$/,
  /^js\/reglas\//,
  /^js\/datos\//,
  /^api\//,
];
export const prohibido = f => PROHIBIDOS.some(r => r.test(f));

const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lineas = t => t.split('\n').map(s => s.trim()).filter(Boolean);

function contexto() {
  try {
    if (git('rev-parse', '--is-shallow-repository') === 'true') return { salta: 'checkout superficial: sin historial no se pueden separar los commits propios' };
    const rama = process.env.GITHUB_HEAD_REF || git('rev-parse', '--abbrev-ref', 'HEAD');
    const delRediseno = /^(pr1[3-6]|redise(n|ñ)o)/i.test(rama);
    if (!delRediseno && process.env.FRONTERA !== '1') return { salta: `la rama «${rama}» no es del rediseño` };
    return { rama };
  } catch { return { salta: 'sin git' }; }
}

// Archivos que tocan los commits propios de la rama y los cambios sin guardar.
function tocados(rama) {
  const otras = lineas(git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes'))
    .filter(r => !r.endsWith('/' + rama) && !r.endsWith('/HEAD'));
  const propios = lineas(git('rev-list', '--no-merges', 'HEAD', '--not', ...otras));
  const archivos = new Set();
  for (const c of propios) for (const f of lineas(git('diff-tree', '--no-commit-id', '--name-only', '-r', c))) archivos.add(f);
  for (const f of lineas(git('diff', '--name-only', 'HEAD'))) archivos.add(f);
  return { propios: propios.length, archivos: [...archivos].sort() };
}

test('la regla reconoce lo que no se puede tocar', () => {
  for (const f of ['js/nucleo/estado.js', 'js/nucleo/modelo.js', 'js/nucleo/api.js', 'js/areas/entrenador/dia.js', 'js/areas/entrenador/validar.js', 'js/reglas/progresion.js', 'js/datos/ejercicios.js', 'api/entrenador.js']) assert.ok(prohibido(f), f);
  for (const f of ['js/nucleo/ui.js', 'js/nucleo/router.js', 'js/areas/entrenador/indice.js', 'js/areas/hoy/indice.js', 'css/tokens.css', 'sw.js', 'index.html']) assert.ok(!prohibido(f), f);
});

const ctx = contexto();
test('el rediseño no toca la lógica ni la forma de los datos', { skip: ctx.salta || false }, () => {
  const { archivos } = tocados(ctx.rama);
  assert.deepEqual(archivos.filter(prohibido), [], 'archivos fuera de la frontera del rediseño');
});
