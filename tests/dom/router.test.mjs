// Navegación con rutas raras (t12 de la auditoría). PR 13.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar, tic } from '../ayuda/dom.mjs';

let fallo = null;
let a = null;
try { a = await montar({ ls: { pipos4: estadoBase() }, hash: '%E0%A4%A' }); } catch (e) { fallo = e; }
after(() => a && a.cerrar());

test('un hash mal formado no deja la pantalla en blanco', { todo: 'PR 13: hash mal formado fuera del try' }, async () => {
  assert.equal(fallo, null, fallo && fallo.message);
  await tic();
  assert.ok(a.vista().textContent.trim().length > 0);
});

// Las rutas desconocidas o sin parámetros se prueban en arranque.test.mjs (aquí el arranque falla).
