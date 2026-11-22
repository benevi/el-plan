// D3 (re-auditoría, T4): un campo con data-cambio guarda en «change», que solo llega al perder el foco. Lo
// escrito en «Para tu entrenador» (o el código, o los kilos de una serie) no se puede perder por salir con
// «atrás», pasar a segundo plano o recargar sin tocar fuera del campo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'perfil' });
after(() => a.cerrar());

// Lo que hace el navegador al escribir: foco (focusin) y teclear (input), sin «change» hasta salir del campo.
function escribir(sel, texto) {
  const el = a.doc.querySelector(sel);
  el.focus();
  el.dispatchEvent(new a.w.FocusEvent('focusin', { bubbles: true }));
  el.value = texto;
  el.dispatchEvent(new a.w.Event('input', { bubbles: true }));
  return el;
}
async function abrirDatos() {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="datos"]'); await a.tic();
  assert.ok(a.doc.querySelector('#d-notas'));
}

test('D3: «Para tu entrenador» se guarda al salir con «atrás» (cambio de ruta sin perder el foco)', async () => {
  await abrirDatos();
  escribir('#d-notas', 'me duele al girar el hombro');
  await a.ir('hoy');
  assert.equal(a.estado.estado().perfil.notas, 'me duele al girar el hombro');
});

test('D3: … y al pasar a segundo plano (se escribe ya en pipos4)', async () => {
  await abrirDatos();
  escribir('#d-notas', 'segundo plano');
  await a.ocultar(true);
  assert.equal(a.guardado().perfil.notas, 'segundo plano');
  await a.ocultar(false);
});

test('D3: … y al recargar o cerrar (pagehide)', async () => {
  await abrirDatos();
  escribir('#d-notas', 'antes de recargar');
  a.w.dispatchEvent(new a.w.Event('pagehide'));
  assert.equal(a.guardado().perfil.notas, 'antes de recargar');
});

test('D3: el código de acceso también; sin cambios no se entrega nada ni se repite el aviso', async () => {
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="ajustes"]'); await a.tic();
  escribir('#a-codigo', 'codigo-nuevo');
  await a.ocultar(true); await a.ocultar(false);
  assert.equal(a.guardado().ajustes.codigo, 'codigo-nuevo');
  const antes = a.w.localStorage.getItem('pipos4');
  await a.ocultar(true); await a.ocultar(false); // mismo valor: nada que entregar
  assert.equal(a.w.localStorage.getItem('pipos4'), antes);
});
