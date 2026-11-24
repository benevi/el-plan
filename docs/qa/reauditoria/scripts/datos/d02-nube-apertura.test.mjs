// T11: una sesión terminada sin red (o con la app cerrada antes de que acabe la subida) no se sube al volver a
// abrir la app si la última copia tiene menos de 24 h. faltaRed vive solo en memoria.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { est, cargarCon, hecha } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
import { modulo, estadoBase } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
import { BlobSimulado, fetchNube, ClavesMemoria } from '/home/user/wt/auditoria/tests/ayuda/nube.mjs';
import { ponerReloj } from '/home/user/wt/auditoria/api/copia.js';
import { AlmacenMemoria } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
globalThis.localStorage = new AlmacenMemoria(); // pipos4-nube sobrevive al «cerrar la app»
const C = await import(modulo('js/nucleo/copia.js'));
process.env.VERCEL_ENV = 'production';
const FRASE = 'caballo grapa batería correcta';
let blob, f, claves, reloj, red;
function configurar() {
  C.configurarCopia({ almacen: claves, fetch: f, enLinea: () => red, ahora: () => reloj,
    setTimeout: () => ({}), clearTimeout: () => {}, bloqueo: (n, fn) => fn(), cuandoLibre: () => Promise.resolve() });
}
beforeEach(() => {
  cargarCon({ pipos4: estadoBase({ ajustes: { codigo: 'secreto', vibrar: true, sonido: true } }) });
  blob = new BlobSimulado(); f = fetchNube(blob); claves = new ClavesMemoria();
  reloj = Date.parse('2026-11-20T18:40:00Z'); red = true; ponerReloj(() => reloj);
  configurar(); C.reiniciarCopia();
});
const subidas = () => f.peticiones.filter(p => p.init.headers['x-copia-accion'] === 'subir');

test('sesión terminada sin red y app cerrada: al reabrir con red (< 24 h) no se copia', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias(); // copia de apertura
  assert.equal(subidas().length, 1);
  // 2 h después: termina una sesión en el gimnasio sin cobertura.
  reloj += 2 * 3600e3; red = false;
  est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
  await (C.subidaEnCurso() || Promise.resolve());
  assert.equal(subidas().length, 1);
  // Cierra la app (se pierde faltaRed). La vuelve a abrir en casa, con red, 3 h después.
  const guardado = JSON.parse(JSON.stringify(est.estado()));
  const nube = globalThis.localStorage?.getItem?.('pipos4-nube');
  reloj += 3 * 3600e3; red = true;
  C.reiniciarCopia(); configurar();
  const r = await C.iniciarCopias();
  await (C.subidaEnCurso() || Promise.resolve());
  console.log('revisarApertura →', r, '· subidas:', subidas().length, '· sesiones locales:', C.metadatos(est.estado()).sesiones, '· en la nube:', 0);
  assert.equal(subidas().length, 2, 'la sesión nueva debería subirse al abrir con red');
});

test('fallo puntual de la subida tras una sesión (red «en línea»): no se reintenta nunca solo', async () => {
  await C.activar('victor', FRASE);
  await C.iniciarCopias();
  const n0 = subidas().length;
  reloj += 2 * 3600e3;
  f.sinRed = true; // el fetch falla (4G que se cae un momento, app a segundo plano a mitad), navigator.onLine sigue true
  est.cambiar(S => { hecha(S, 0, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]); }, 'sesion');
  const r1 = await (C.subidaEnCurso() || Promise.resolve());
  f.sinRed = false;
  // Pasa el tiempo con la app abierta y red buena; no hay transición offline→online, así que no llega «online».
  reloj += 60e3;
  await new Promise(r => setTimeout(r, 50));
  console.log('primer intento →', r1, '· subidas tras el fallo:', subidas().length - n0, '(intento fallido incluido) · estadoNube.avisar =', C.estadoNube().avisar, '· error =', C.estadoNube().error);
  // Error del servidor (p. ej. 500 o 429): tampoco se reintenta.
  const ok = subidas().filter(p => true).length;
  assert.ok(subidas().length - n0 >= 2, 'debería reintentarse sola en menos de un minuto');
});
