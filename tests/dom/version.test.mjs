// Aviso de versión nueva (js/nucleo/version.js) con un service worker simulado en jsdom:
// con una sesión en curso no avisa; al terminarla aparece «Hay una versión nueva — Actualizar»,
// que pide al SW nuevo que entre. Perfil → Ajustes enseña la VERSION de la página (meta de index.html).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estadoBase, sesionDemo, ruta } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const mensajes = [];
const trabajador = nombre => ({
  nombre,
  postMessage(m, puertos) {
    mensajes.push([nombre, m]);
    if (m.tipo === 'version' && puertos && puertos[0]) { puertos[0].postMessage({ version: 'pipos-app-' + nombre }); puertos[0].close(); }
  },
});
const oyentes = {};
const registro = {
  active: trabajador('vieja'), waiting: trabajador('nueva'), installing: null, actualizaciones: 0,
  addEventListener() {}, update() { registro.actualizaciones++; return Promise.resolve(); },
};
const sw = {
  controller: registro.active,
  ready: Promise.resolve(registro),
  register: async () => registro,
  addEventListener: (t, f) => { (oyentes[t] ||= []).push(f); },
};

const a = await montar({
  ls: { pipos4: estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } }) },
  hash: 'hoy',
  antes: w => { Object.defineProperty(w.navigator, 'serviceWorker', { value: sw, configurable: true }); },
});
after(() => a.cerrar());

test('Perfil → Ajustes enseña la versión de la app (la VERSION de sw.js)', async () => {
  const VERSION = fs.readFileSync(ruta('sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
  await a.ir('perfil');
  a.clic('[data-act="perfil.grupo"][data-v="ajustes"]');
  await a.tic();
  assert.equal(a.doc.querySelector('[data-version-app]').textContent, VERSION);
  // Y pregunta al SW en espera de qué versión es antes de avisar.
  await a.esperar(() => mensajes.some(([n, m]) => n === 'nueva' && m.tipo === 'version'), { que: 'pregunta de versión' });
});

test('con una sesión en curso no avisa de la versión nueva', async () => {
  await a.tic();
  assert.equal(a.doc.querySelector('#aviso-version'), null);
  assert.ok(!mensajes.some(([, m]) => m.tipo === 'actualizar'), 'no debe activar la versión nueva solo');
});

test('al terminar la sesión aparece el aviso y «Actualizar» pide al SW nuevo que entre', async () => {
  a.estado.cambiar(S => { S.sesiones.s1.estado = 'hecha'; S.sesiones.s1.terminada = new Date().toISOString(); }, 'prueba');
  const el = await a.esperar(() => a.doc.querySelector('#aviso-version'), { que: 'aviso de versión' });
  assert.match(el.textContent, /Hay una versión nueva/);
  const boton = el.querySelector('button');
  assert.equal(boton.textContent, 'Actualizar');
  a.clic(boton);
  assert.deepEqual(mensajes.at(-1), ['nueva', { tipo: 'actualizar' }]);
});

test('al volver a primer plano busca versión nueva (reg.update)', async () => {
  const antes = registro.actualizaciones;
  Object.defineProperty(a.doc, 'visibilityState', { get: () => 'visible', configurable: true });
  a.doc.dispatchEvent(new a.w.Event('visibilitychange'));
  assert.equal(registro.actualizaciones, antes + 1);
});
