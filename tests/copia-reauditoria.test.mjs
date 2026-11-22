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
  assert.ok(N.almacen);
});
