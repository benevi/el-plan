// Otra pestaña activa la versión nueva (sw.js lo anuncia por BroadcastChannel 'pipos-version'):
// con una sesión en curso esta pestaña no se recarga, avisa y se recarga al terminar la sesión.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

// BroadcastChannel simulado: anunciar() hace de sw.js al activarse.
const canales = [];
globalThis.BroadcastChannel = class { constructor(n) { this.nombre = n; canales.push(this); } postMessage() {} close() {} };
const anunciar = data => canales.filter(c => c.nombre === 'pipos-version').forEach(c => c.onmessage && c.onmessage({ data }));

const registro = { active: null, waiting: null, installing: null, addEventListener() {}, update: () => Promise.resolve() };
const sw = { controller: null, ready: Promise.resolve(registro), register: async () => registro, addEventListener() {} };
const a = await montar({
  ls: { pipos4: estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } }) },
  hash: 'hoy',
  antes: w => { Object.defineProperty(w.navigator, 'serviceWorker', { value: sw, configurable: true }); },
});
const { opciones } = await import('../../js/nucleo/version.js');
let recargas = 0;
opciones.recargar = () => { recargas++; };
after(() => a.cerrar());

test('versión activada en otra pestaña con sesión en curso: aviso y sin recargar', async () => {
  anunciar({ tipo: 'activada', version: 'pipos-app-otra' });
  const el = await a.esperar(() => a.doc.querySelector('#aviso-version'), { que: 'aviso' });
  assert.match(el.textContent, /al terminar la sesión/);
  await a.espera(50);
  assert.equal(recargas, 0);
});

test('la misma versión que la página (primera instalación) no hace nada', async () => {
  const v = a.doc.querySelector('meta[name="pipos-version"]').content;
  anunciar({ tipo: 'activada', version: v });
  await a.espera(50);
  assert.equal(recargas, 0);
});

test('al terminar la sesión se recarga', async () => {
  a.estado.cambiar(S => { S.sesiones.s1.estado = 'hecha'; S.sesiones.s1.terminada = new Date().toISOString(); }, 'prueba');
  await a.esperar(() => recargas === 1, { max: 4000, que: 'recarga' });
});
