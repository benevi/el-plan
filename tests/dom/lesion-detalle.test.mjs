// Ficha de lesión en Perfil: el «detalle» opcional (esguince, fascitis…) por zona (docs/criterio.md, C-ZONA-SUB). PR 9.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'perfil' });
after(() => a.cerrar());

const visible = z => a.doc.querySelector(`[data-detalle="${z}"]`).style.display !== 'none';

test('nueva lesión: el detalle sale solo para la zona elegida y se guarda', async () => {
  a.clic('[data-act="perfil.grupo"][data-v="lesiones"]');
  await a.esperar(() => a.doc.querySelector('[data-act="perfil.lesion"]'));
  a.clic('[data-act="perfil.lesion"]');
  await a.esperar(() => a.doc.querySelector('#l-zona'));
  const zona = a.doc.querySelector('#l-zona');
  zona.value = 'tobillo_pie'; zona.dispatchEvent(new a.w.Event('change', { bubbles: true }));
  assert.ok(visible('tobillo_pie') && !visible('lumbar') && !visible('codo'));
  const opciones = [...a.doc.querySelectorAll('#l-detalle-tobillo_pie option')].map(o => o.value);
  assert.deepEqual(opciones, ['', 'esguince', 'fascitis', 'aquiles'], '«No lo sé» primero: sin detalle, lo más prudente');
  a.doc.querySelector('#l-detalle-tobillo_pie').value = 'aquiles';
  a.clic('[data-act="perfil.guardarLesion"]');
  await a.esperar(() => a.estado.estado().perfil.lesiones.length === 1);
  const l = a.estado.estado().perfil.lesiones[0];
  assert.equal(l.zona, 'tobillo_pie');
  assert.equal(l.detalle, 'aquiles');
  await a.esperar(() => /tendón de aquiles/.test(a.vista().textContent));
});

test('una zona sin detalles no guarda detalle, y al quitarlo se borra', async () => {
  const id = a.estado.estado().perfil.lesiones[0].id;
  a.clic(`[data-act="perfil.lesion"][data-id="${id}"]`);
  await a.esperar(() => a.doc.querySelector('#l-detalle-tobillo_pie'));
  assert.equal(a.doc.querySelector('#l-detalle-tobillo_pie').value, 'aquiles', 'al editar se ve el guardado');
  const zona = a.doc.querySelector('#l-zona');
  zona.value = 'rodilla'; zona.dispatchEvent(new a.w.Event('change', { bubbles: true }));
  assert.ok(![...a.doc.querySelectorAll('[data-detalle]')].some(c => c.style.display !== 'none'), 'rodilla no tiene detalle');
  a.clic(`[data-act="perfil.guardarLesion"][data-id="${id}"]`);
  await a.esperar(() => a.estado.estado().perfil.lesiones[0].zona === 'rodilla');
  assert.equal('detalle' in a.estado.estado().perfil.lesiones[0], false);
  assert.ok(!a.pantallaRota());
});
