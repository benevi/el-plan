// Perfil (jsdom, PR 4): corrección del sexo migrado con fallos, aviso de datos de salud y guardar la copia
// compartiéndola (iPhone con la app instalada, donde la descarga con a.download no funciona).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, viejoDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

// Víctor migrado con la versión con fallos: 'm' tal cual (aquí sería «Mujer»), sin marca de migración.
const conFallo = estadoBase({ ajustes: { codigo: 'secreto-123', vibrar: true, sonido: true } });
delete conFallo.migracion;
conFallo.perfil.datos.sexo = 'm';
conFallo.sesiones = { 'v-x': { id: 'v-x', fecha: '2026-10-06', creada: '2026-10-05T22:10:00.000Z', fuente: 'anterior', nombre: 'Torso', lugar: 'gym', estado: 'hecha', ejercicios: [], calentamiento: [], vuelta: [], terminada: '2026-10-05T23:30:00.000Z' } };

const compartidos = [];
let respuestaShare = () => Promise.resolve();
const a = await montar({
  ls: { pipos4: conFallo, elplan2: viejoDemo() }, hash: 'perfil',
  antes: w => {
    Object.defineProperty(w.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', configurable: true });
    Object.defineProperty(w.navigator, 'standalone', { value: true, configurable: true });
    w.navigator.canShare = d => !!(d && d.files && d.files.length);
    w.navigator.share = d => { compartidos.push(d); return respuestaShare(); };
  },
});
after(() => a.cerrar());

test('quien migró con el fallo y tiene «m» ve la pregunta del sexo; al responder, desaparece', async () => {
  await a.ir('perfil');
  const caja = await a.esperar(() => a.doc.querySelector('.revisar-sexo'));
  assert.match(caja.textContent, /Ahora pone Mujer/);
  // Para Víctor se marca «Hombre» como lo probable, pero se sigue preguntando.
  assert.ok(caja.querySelector('[data-v="h"]').classList.contains('probable'));
  assert.ok(!caja.querySelector('[data-v="m"]').classList.contains('probable'));
  a.clic('.revisar-sexo [data-act="perfil.sexoRevisado"][data-v="h"]');
  await a.tic();
  assert.equal(a.estado.estado().perfil.datos.sexo, 'h');
  assert.equal(a.doc.querySelector('.revisar-sexo'), null);
});

test('Ajustes avisa de que la copia lleva datos de salud y ofrece enviarla a otra app', async () => {
  a.clic('[data-act="perfil.grupo"][data-v="ajustes"]'); await a.tic();
  assert.match(a.doc.querySelector('.aviso-salud').textContent, /datos de salud/);
  assert.ok(a.doc.querySelector('[data-act="perfil.compartir"]'));
});

test('en el iPhone con la app instalada, «Guardar copia» la comparte (sin el código) y solo entonces se apunta', async () => {
  a.clic('[data-act="perfil.exportar"]');
  await a.esperar(() => a.w.localStorage.getItem('pipos4-copia'));
  assert.equal(compartidos.length, 1);
  const f = compartidos[0].files[0];
  assert.match(f.name, /^pipos-fitness-victor-\d{4}-\d{2}-\d{2}\.json$/);
  const txt = await f.text();
  assert.doesNotMatch(txt, /secreto-123/);
  assert.equal(JSON.parse(txt).dueño, 'victor');
});

test('si se cancela la hoja de compartir, la copia no cuenta como hecha', async () => {
  a.w.localStorage.removeItem('pipos4-copia');
  respuestaShare = () => Promise.reject(Object.assign(new Error('cancelado'), { name: 'AbortError' }));
  a.clic('[data-act="perfil.exportar"]');
  await a.esperar(() => compartidos.length === 2);
  await a.tic();
  assert.equal(a.w.localStorage.getItem('pipos4-copia'), null);
});
