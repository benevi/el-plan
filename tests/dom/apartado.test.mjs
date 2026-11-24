// D5 (re-auditoría): «ha quedado apartado» tiene que poder recuperarse desde la app. Perfil › Copias enseña
// lo apartado (pipos4-conflicto o el registro 'conflicto' del espejo) con «Recuperarlos» y «Descartar».
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const apartado = estadoBase({ perfil: { ...estadoBase().perfil, notas: 'lo de la otra ventana' } });
const a = await montar({ ls: { pipos4: estadoBase(), 'pipos4-conflicto': JSON.stringify({ fecha: '2026-11-21T10:00:00.000Z', txt: JSON.stringify(apartado) }) }, hash: 'perfil' });
after(() => a.cerrar());

async function ajustes() { // las copias (archivo, lo apartado) están en Perfil › Copias (M19)
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="copias"]'); await a.tic();
}
const responder = async si => { await a.esperar(() => a.doc.querySelector('.hoja [data-r]')); a.clic(`.hoja [data-r="${si ? 1 : 0}"]`); await a.tic(); };

test('D5: Perfil › Copias enseña lo apartado y «Recuperarlos» lo carga (y lo de ahora queda para volver)', async () => {
  await ajustes();
  const bloque = await a.esperar(() => a.vista().querySelector('.apartado'));
  assert.match(bloque.textContent, /datos apartados/);
  a.clic('[data-act="perfil.recuperarApartado"]');
  await responder(true);
  await a.esperar(() => a.estado.estado().perfil.notas === 'lo de la otra ventana');
  assert.equal(a.guardado().perfil.notas, 'lo de la otra ventana');
  await ajustes();
  assert.ok(a.vista().querySelector('.deshacer-importar'), '«Volver a ellos» para deshacerlo');
  assert.equal(a.vista().querySelector('.apartado'), null, 'ya no queda nada apartado');
  assert.ok(!a.pantallaRota());
});

test('D5: «Descartar» lo quita (con confirmación)', async () => {
  a.w.localStorage.setItem('pipos4-conflicto', JSON.stringify({ fecha: '2026-11-21T11:00:00.000Z', txt: JSON.stringify(apartado) }));
  await a.estado.revisarApartado();
  await ajustes();
  assert.ok(a.vista().querySelector('.apartado'));
  a.clic('[data-act="perfil.descartarApartado"]');
  await responder(true);
  await a.esperar(() => !a.vista().querySelector('.apartado'));
  assert.equal(a.w.localStorage.getItem('pipos4-conflicto'), null);
});
