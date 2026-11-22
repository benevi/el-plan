// Copias y guardado (re-auditoría, enfoque «datos», T4): recortes al restaurar (D4), dos copias seguidas (D2),
// lo apartado se puede recuperar (D5), espejo lento al arrancar (D6) y lo apartado de la otra persona en la
// migración (D8).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, modulo } from './ayuda/comun.mjs';
import { est, cargarCon, hecha } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const K = await import(modulo('js/datos/constantes.js'));
afterEach(() => { est.usarPruebaDePintado(null); est.usarEspejo(null); });
const texto = n => 'Diagnóstico: tendinopatía del supraespinoso; duele al elevar el brazo y al dormir de lado. '.repeat(60).slice(0, n);

// ── D4 ──
test('D4: notas y comentarios tan largos como deja escribir la app vuelven enteros al restaurar', () => {
  const L = K.LARGO_TEXTO;
  cargarCon({ pipos4: estadoBase() });
  let sid;
  est.cambiar(S => {
    S.perfil.lesiones.push({ id: 'l1', zona: 'hombro', dolor: 5, desde: '2026-10-01', nota: texto(L.notaLesion), activa: true });
    S.perfil.notas = texto(L.notasPerfil);
    sid = hecha(S, 1, [{ id: 'press-pecho-maquina', sets: [[40, 10]], comentario: texto(L.comentarioEjercicio) }]);
    S.sesiones[sid].cierre = { esfuerzo: 4, dolor: {}, comentario: texto(L.comentarioCierre) };
  }, 'perfil');
  // Lo que deja la interfaz ya no es menos que lo de antes (300, 400, 1000, 2000).
  assert.ok(L.notaLesion >= 700 && L.comentarioEjercicio >= 600 && L.comentarioCierre >= 1300 && L.notasPerfil >= 2000);
  const r = est.importar(est.exportar());
  const T = est.estado();
  assert.equal(T.perfil.lesiones[0].nota.length, L.notaLesion);
  assert.equal(T.perfil.notas.length, L.notasPerfil);
  assert.equal(T.sesiones[sid].ejercicios[0].comentario.length, L.comentarioEjercicio);
  assert.equal(T.sesiones[sid].cierre.comentario.length, L.comentarioCierre);
  assert.deepEqual(r.avisos, []);
});

test('D4: si una copia trae textos más largos, se recortan con aviso (nunca en silencio)', () => {
  cargarCon({ pipos4: estadoBase() });
  const x = JSON.parse(est.exportar());
  x.perfil.lesiones = [{ id: 'l1', zona: 'hombro', dolor: 5, desde: '2026-10-01', nota: texto(K.LARGO_TEXTO.notaLesion + 50), activa: true }];
  x.perfil.notas = texto(K.LARGO_TEXTO.notasPerfil + 1);
  const r = est.importar(JSON.stringify(x));
  assert.equal(est.estado().perfil.lesiones[0].nota.length, K.LARGO_TEXTO.notaLesion);
  assert.ok(r.avisos.some(a => /2 notas o comentarios .* recortado/.test(a)), r.avisos.join(' | '));
});

test('D4: los campos de la interfaz tienen el mismo límite (maxlength) que el normalizador', async () => {
  const fs = await import('node:fs');
  const perfil = fs.readFileSync(new URL(modulo('js/areas/perfil/indice.js')), 'utf8');
  const sesion = fs.readFileSync(new URL(modulo('js/areas/sesion/indice.js')), 'utf8');
  assert.match(perfil, /id="d-notas"[^>]*maxlength="\$\{\+LARGO_TEXTO\.notasPerfil\}"/);
  assert.match(perfil, /id="l-nota"[^>]*maxlength="\$\{\+LARGO_TEXTO\.notaLesion\}"/);
  assert.match(sesion, /id="c-com"[^>]*maxlength="\$\{\+LARGO_TEXTO\.comentarioCierre\}"/);
  assert.match(sesion, /id="m-com"[^>]*maxlength="\$\{\+LARGO_TEXTO\.comentarioEjercicio\}"/);
});

// ── D2 ──
const nSes = () => Object.values(est.estado().sesiones).filter(s => s.estado === 'hecha').length;
function copiaCon(n) {
  cargarCon({ pipos4: estadoBase() });
  for (let i = 0; i < n; i++) est.cambiar(S => { hecha(S, 30 + i, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); });
  est.guardarYa();
  return est.exportar();
}
function movilCon(n) {
  cargarCon({ pipos4: estadoBase() });
  for (let i = 0; i < n; i++) est.cambiar(S => { hecha(S, i + 1, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); });
  est.guardarYa();
}

test('D2: cargar dos copias seguidas no pierde los datos del móvil: «Volver a ellos» lleva a los de antes de la primera', async () => {
  const de2 = copiaCon(2), de5 = copiaCon(5);
  movilCon(9);
  const r1 = est.importar(de2);
  assert.equal(r1.apartado, false, 'la primera va a «datos de antes»');
  const r2 = est.importar(de5);
  assert.equal(nSes(), 5);
  assert.equal(r2.apartado, 'local', 'la segunda: lo de ahora (la copia de 2) va a lo apartado');
  assert.equal(est.infoApartado().sesiones, 2);
  est.deshacerImportar();
  assert.equal(nSes(), 9, 'las 9 del móvil siguen ahí');
  // Lo de la primera copia sigue recuperable.
  const r = await est.recuperarApartado();
  assert.equal(nSes(), 2);
  assert.equal(r.apartado, 'local', 'lo de ahora (las 9) ocupa el sitio de lo apartado');
  assert.equal(est.infoApartado().sesiones, 9);
  await est.recuperarApartado();
  assert.equal(nSes(), 9);
});

test('D2: pasados 7 días, los «datos de antes» caducan y la siguiente carga vuelve a guardar lo de ahora en su lugar', () => {
  const de2 = copiaCon(2), de4 = copiaCon(4);
  movilCon(9);
  est.importar(de2);
  const c = JSON.parse(N.almacen.getItem('pipos4-antes-de-importar'));
  c.fecha = new Date(Date.now() - 8 * 864e5).toISOString();
  N.almacen.setItem('pipos4-antes-de-importar', JSON.stringify(c));
  const r = est.importar(de4);
  assert.equal(r.apartado, false);
  est.deshacerImportar();
  assert.equal(nSes(), 2, '«Volver a ellos» lleva a lo de justo antes (la copia de 2)');
});

// ── D5 ──
test('D5: lo apartado por un conflicto entre pestañas se ve y se recupera (y es reversible)', async () => {
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '4' });
  est.usarEspejo({ leer: async () => null, escribir: async () => {}, apartar: async () => false }); // sin IndexedDB
  N.almacen.setItem('pipos4', JSON.stringify(estadoBase({ medidas: [{ fecha: '2026-11-19', peso: 81 }] })));
  N.almacen.setItem('pipos4-rev', '5');
  est.cambiar(S => { S.perfil.notas = 'de la pestaña vieja'; }, 'perfil-silencio');
  assert.equal(est.guardarYa(), false);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(est.estado().perfil.notas, '');
  const info = await est.revisarApartado();
  assert.ok(info && info.fecha, 'se ve qué hay apartado y de cuándo');
  await est.recuperarApartado();
  assert.equal(est.estado().perfil.notas, 'de la pestaña vieja');
  assert.equal(est.infoAntesDeImportar() && est.infoAntesDeImportar().dueño, 'victor', 'lo de antes de recuperar se puede deshacer');
  assert.equal(await est.revisarApartado(), null, 'lo recuperado ya no está apartado');
  est.deshacerImportar();
  assert.equal(est.estado().medidas.length, 1);
});

test('D5: lo apartado en el espejo (IndexedDB) también se lee, se recupera y se descarta', async () => {
  const espejo = { conflicto: null, leer: async () => null, escribir: async () => {}, apartar: async r => { espejo.conflicto = r; return true; },
    leerApartado: async () => espejo.conflicto, borrarApartado: async () => { espejo.conflicto = null; return true; } };
  cargarCon({ pipos4: estadoBase(), 'pipos4-rev': '1' });
  est.usarEspejo(espejo);
  N.almacen.setItem('pipos4', JSON.stringify(estadoBase())); N.almacen.setItem('pipos4-rev', '2');
  est.cambiar(S => { S.perfil.notas = 'apartada en IDB'; }, 'perfil-silencio');
  est.guardarYa();
  await new Promise(r => setTimeout(r, 0));
  assert.equal((await est.revisarApartado()).donde, 'espejo');
  await est.descartarApartado();
  assert.equal(espejo.conflicto, null);
  assert.equal(await est.revisarApartado(), null);
});

// ── D6 ──
test('D6: sin pipos4 y con el espejo lento, no se pisa la copia interna y se ofrece el rescate cuando llega', async () => {
  cargarCon({ pipos4: estadoBase() });
  for (let i = 0; i < 40; i++) est.cambiar(S => { hecha(S, i + 1, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); });
  let reg = { txt: JSON.stringify(est.estado()), rev: 57, fecha: new Date().toISOString() };
  let soltar;
  const llega = new Promise(r => { soltar = r; });
  est.usarEspejo({ leer: () => llega.then(() => reg), escribir: r => { if (!(reg && reg.rev > r.rev)) reg = r; }, apartar: async () => true });
  cargarCon({}); // localStorage vacío
  const motivos = []; const q = est.escuchar(m => motivos.push(m));
  try {
    assert.equal(await est.revisarEspejo({ max: 20 }), null, 'a tiempo no llegó');
    est.cambiar(S => { S.dueño = 'victor'; }, 'dueño'); est.guardarYa(); // bienvenida → Víctor
    est.cambiar(S => { S.perfil.objetivos = ['salud']; }, 'perfil'); est.guardarYa();
    assert.equal(Object.keys(JSON.parse(reg.txt).sesiones).length, 40, 'el espejo sigue con sus 40 sesiones');
    soltar(); await new Promise(r => setTimeout(r, 0));
    const r = est.estadoGuardado().rescate;
    assert.ok(r, 'al llegar se ofrece el rescate');
    assert.equal(r.espejo.sesiones, 40);
    assert.ok(motivos.includes('rescate'));
    est.recuperarDelEspejo();
    assert.equal(nSes(), 40);
  } finally { q(); }
});

test('D6: si el espejo lento llega sin nada que rescatar, se escribe entonces (por encima de su revisión)', async () => {
  let reg = { txt: '{}', rev: 9, fecha: new Date().toISOString() };
  let soltar; const llega = new Promise(r => { soltar = r; });
  est.usarEspejo({ leer: () => llega.then(() => reg), escribir: r => { if (!(reg && reg.rev > r.rev)) reg = r; }, apartar: async () => true });
  cargarCon({ pipos4: estadoBase() });
  await est.revisarEspejo({ max: 20 });
  est.cambiar(S => { S.perfil.notas = 'algo'; }, 'perfil'); est.guardarYa();
  assert.equal(reg.rev, 9, 'mientras no se sabe qué tiene, no se toca');
  soltar(); await new Promise(r => setTimeout(r, 0));
  assert.equal(est.estadoGuardado().rescate, null);
  assert.ok(reg.rev > 9);
  assert.equal(JSON.parse(reg.txt).perfil.notas, 'algo');
});

// ── D8 ──
test('D8: cargar una copia v4 no pierde lo apartado de la otra persona (migracion.porDueño)', async () => {
  const { viejoReal } = await import('./ayuda/viejo-real.mjs');
  cargarCon({ elplan2: viejoReal() });
  est.cambiar(S => { S.dueño = 'victor'; est.migrarDeViejo('victor'); });
  est.cambiar(S => { S.sesiones['v-h0'].cierre.comentario = 'EDIT'; delete S.sesiones['v-h1']; });
  est.soltarDueño();
  est.cambiar(S => { S.dueño = 'virginia'; est.migrarDeViejo('virginia'); });
  assert.ok(est.estado().migracion.porDueño.victor);
  est.importar(est.exportar()); // una copia propia de Virginia (sin porDueño, que no sale del móvil)
  assert.ok(est.estado().migracion.porDueño && est.estado().migracion.porDueño.victor, 'lo apartado de Víctor sigue en el móvil');
  est.soltarDueño();
  est.cambiar(X => { X.dueño = 'victor'; est.migrarDeViejo('victor'); });
  const S = est.estado();
  assert.equal(S.sesiones['v-h0'].cierre.comentario, 'EDIT', 'los cambios sobre lo migrado vuelven');
  assert.equal(S.sesiones['v-h1'], undefined, 'lo borrado no resucita');
});
