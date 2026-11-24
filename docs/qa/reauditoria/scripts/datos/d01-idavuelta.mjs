// Diff profundo: estado real generado por la app vs exportar→normalizar (lo que vuelve tras importar).
import { est, ent, cargarCon } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
import { generarEstadoLargo } from '/home/user/wt/auditoria/tests/ayuda/estado-largo.mjs';
import { modulo } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
const N = await import(modulo('js/nucleo/normalizar.js'));
const mias = await import(modulo('js/areas/entrenador/mias.js'));
cargarCon({ elplan2: JSON.stringify((await import('/home/user/wt/auditoria/tests/ayuda/estado-largo.mjs')).viejoDemo()) });
await generarEstadoLargo(est, ent);
// extras: mis sesiones, alarmas, salud, iaFallo, origen, dolorDurante
const S = est.estado();
const ids = Object.keys(S.sesiones);
const una = S.sesiones[ids[ids.length - 1]];
try { mias.guardarMia(una.id, 'Mía de prueba'); } catch (e) { console.log('guardarMia', e.message); }
est.cambiar(S => { S.alarmas = [{ fecha: '2026-10-01', respuesta: 'no', frase: 'me mareé' }]; S.perfil.salud = { hipertension: 'controlada', medicacion: ['betabloqueantes'], vistoBueno: { hipertension: true } }; S.perfil.nadar25 = true; });
const original = JSON.parse(est.exportar());
const vuelta = N.normalizarEstado(JSON.parse(est.exportar())).estado;
const difs = [];
function diff(a, b, p) {
  if (a === b) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k);
    return;
  }
  if ((a === undefined && b === null) || (a === null && b === undefined)) return difs.push(['null/undef', p, a, b]);
  difs.push(['DISTINTO', p, JSON.stringify(a)?.slice(0, 80), JSON.stringify(b)?.slice(0, 80)]);
}
diff(original, vuelta, 'S');
const agrupa = {};
for (const [t, p, a, b] of difs) { const k = t + ' ' + p.replace(/\.[\w-]{8,}\./g, '.<id>.').replace(/\.\d+(\.|$)/g, '.N$1'); (agrupa[k] ||= { n: 0, ej: [a, b] }).n++; }
console.log(Object.keys(S.sesiones).length, 'sesiones');
for (const [k, v] of Object.entries(agrupa)) console.log(v.n, k, '|', v.ej.join(' → '));
