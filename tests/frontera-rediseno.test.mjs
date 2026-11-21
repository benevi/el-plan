// Frontera del rediseño (plan, sección 2): los PR 13-16 cambian el aspecto, no la lógica ni la forma de los
// datos. En sus ramas, esta prueba falla si el árbol de HEAD cambia, respecto a donde salió de la base
// (git diff base...HEAD, con tres puntos: lo que ya está en la base no cuenta), alguno de:
//   js/nucleo/estado.js, js/nucleo/modelo.js, js/nucleo/api.js, la lógica del entrenador (dia.js, plan.js,
//   checkin.js, ia.js, validar.js), js/reglas/, js/datos/ o api/.
// Base: origin/<GITHUB_BASE_REF> en CI o origin/pipos-v2 (FRONTERA_BASE para otra). Solo en ramas del
// rediseño (pr13…pr16 o rediseno…; en CI, GITHUB_HEAD_REF; FRONTERA=1 la fuerza). Sin git, sin la base o con
// un checkout superficial se salta y lo dice. Los cambios sin guardar también cuentan.
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
const lineas = t => t.split('\n').map(x => x.trim()).filter(Boolean);

function contexto() {
  let rama;
  try { rama = process.env.GITHUB_HEAD_REF || git('rev-parse', '--abbrev-ref', 'HEAD'); } catch { return { salta: 'sin git' }; }
  if (!/^(pr1[3-6]|redise(n|ñ)o)/i.test(rama) && process.env.FRONTERA !== '1') return { salta: `la rama «${rama}» no es del rediseño` };
  const base = process.env.FRONTERA_BASE || `origin/${process.env.GITHUB_BASE_REF || 'pipos-v2'}`;
  try { git('rev-parse', '--verify', '--quiet', base + '^{commit}'); } catch { return { salta: `no está la rama base «${base}» (haz git fetch origin)` }; }
  try { if (git('rev-parse', '--is-shallow-repository') === 'true') return { salta: 'checkout superficial: falta historial para comparar con la base' }; } catch { /* git viejo */ }
  return { base };
}

test('la regla reconoce lo que no se puede tocar', () => {
  for (const f of ['js/nucleo/estado.js', 'js/nucleo/modelo.js', 'js/nucleo/api.js', 'js/areas/entrenador/dia.js', 'js/areas/entrenador/validar.js', 'js/reglas/progresion.js', 'js/datos/ejercicios.js', 'api/entrenador.js']) assert.ok(prohibido(f), f);
  for (const f of ['js/nucleo/ui.js', 'js/nucleo/router.js', 'js/areas/entrenador/indice.js', 'js/areas/hoy/indice.js', 'css/tokens.css', 'sw.js', 'index.html']) assert.ok(!prohibido(f), f);
});

const ctx = contexto();
if (ctx.salta) console.warn(`[frontera del rediseño] SE SALTA: ${ctx.salta}.`);
test('el rediseño no toca la lógica ni la forma de los datos', { skip: ctx.salta ? `se salta: ${ctx.salta}` : false }, () => {
  const archivos = new Set([...lineas(git('diff', '--name-only', `${ctx.base}...HEAD`)), ...lineas(git('diff', '--name-only', 'HEAD'))]);
  assert.deepEqual([...archivos].filter(prohibido).sort(), [], `archivos fuera de la frontera del rediseño respecto a ${ctx.base}`);
});
