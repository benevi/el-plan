// S1: sin freno a intentos de código (401 ilimitados) ni a llamadas válidas al entrenador (coste sin tope).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Respuesta, peticion, clienteSimulado, mensaje } from '/home/user/wt/auditoria/tests/api/_simulado.mjs';
import { ponerClienteIA } from '/home/user/wt/auditoria/api/_comun.js';
import handler from '/home/user/wt/auditoria/api/entrenador.js';
import handlerCopia, { ponerAlmacen, reiniciarRitmo } from '/home/user/wt/auditoria/api/copia.js';
import { BlobSimulado } from '/home/user/wt/auditoria/tests/api/_blob-simulado.mjs';
process.env.APP_CODE = 'pipos'; process.env.ANTHROPIC_API_KEY = 'x';
console.error = () => {}; const logReal = console.log; console.log = () => {};
const cat = [{ id: 'sentadilla-goblet', m: ['cuadriceps'], l: ['gym'], niv: 1, t: 'reps', tipo: 'compuesto' }];
test('5000 códigos malos seguidos: todos 401, ninguno 429 (fuerza bruta sin freno)', async () => {
  const cods = {};
  for (let i = 0; i < 5000; i++) { const r = new Respuesta(); await handler(peticion({ codigo: 'c' + i, cuerpo: { modo: 'sesion', catalogo: cat } }), r); cods[r.codigo] = (cods[r.codigo] || 0) + 1; }
  const r2 = new Respuesta(); await handlerCopia(peticion({ codigo: 'zz', cuerpo: { accion: 'listar', persona: 'victor' } }), r2);
  logReal('entrenador', cods, 'copia', r2.codigo);
  assert.equal(cods[401], 5000);
});
test('200 planes seguidos con el código bueno: los 200 llegan a Claude (48000 max_tokens cada uno)', async () => {
  const c = clienteSimulado(() => mensaje({ dias: [] })); ponerClienteIA(c);
  let ok = 0;
  for (let i = 0; i < 200; i++) { const r = new Respuesta(); await handler(peticion({ codigo: 'pipos', cuerpo: { modo: 'plan', catalogo: cat, semana: { dias: [1], lugares: [{ id: 'gym' }] } } }), r); if (r.codigo === 200) ok++; }
  const tok = c.llamadas.reduce((s, l) => s + l.params.max_tokens, 0);
  logReal('llamadas a Claude', c.llamadas.length, 'max_tokens sumados', tok, 'modelo', c.llamadas[0].params.model, 'esfuerzo', c.llamadas[0].params.output_config.effort);
  assert.equal(c.llamadas.length, 200);
});
