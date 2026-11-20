// Primera vez en el móvil con datos de la app anterior (elplan2): elegir dueño y corregirlo (t06 de la auditoría). PR 4.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { viejoDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { elplan2: viejoDemo() } });
after(() => a.cerrar());

test('arranca en la bienvenida y al elegir a Víctor trae su sesión', async () => {
  await a.espera(20);
  assert.equal(a.doc.title, 'Bienvenida · Pipos Fitness');
  a.clic('[data-act="bienvenida.elegir"][data-v="victor"]');
  await a.espera(30);
  const S = a.estado.estado();
  assert.equal(S.dueño, 'victor');
  assert.equal(Object.keys(S.sesiones).length, 1);
  assert.match(a.doc.querySelector('#aviso').textContent, /He traído 1 sesiones/);
});

test('el perfil migrado de Víctor muestra «Hombre»', { todo: 'PR 4: sexo cruzado en la migración' }, async () => {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="datos"]');
  await a.espera(10);
  assert.equal(a.doc.querySelector('select[data-k="sexo"]').selectedOptions[0].textContent, 'Hombre');
});

test('si se eligió mal, al cambiar a Virginia se ven sus datos y no los de Víctor', { todo: 'PR 4: dueño irreversible' }, async () => {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="ajustes"]');
  a.clic('[data-act="perfil.cambiarDueño"]'); await a.espera(10);
  a.clic('.hoja [data-r="1"]'); await a.espera(20);
  a.clic('[data-act="bienvenida.elegir"][data-v="virginia"]'); await a.espera(20);
  const S = a.estado.estado();
  assert.equal(S.dueño, 'virginia');
  assert.deepEqual(S.medidas.map(m => m.peso), [60], 'medidas');
  assert.equal(S.perfil.lesiones.length, 1, 'lesiones');
  assert.deepEqual(Object.values(S.sesiones).map(s => s.creada), ['2026-10-06T17:00:00.000Z'], 'sesiones');
});
