// Textos libres que la app guarda sin límite y que el normalizador recorta al cargar una copia
// (archivo, nube o copia interna del espejo): se pierden sin aviso.
import { est, cargarCon, hecha } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
import { estadoBase } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
cargarCon({ pipos4: estadoBase() });
const largo = n => 'Diagnóstico del traumatólogo: tendinopatía del supraespinoso; duele al elevar el brazo por encima del hombro y al dormir de lado. '.repeat(10).slice(0, n);
est.cambiar(S => {
  S.perfil.lesiones.push({ id: 'l1', zona: 'hombro', dolor: 5, desde: '2026-10-01', nota: largo(700), activa: true });
  S.perfil.notas = largo(3000);
  const id = hecha(S, 1, [{ id: 'press-pecho-maquina', sets: [[40, 10]], comentario: largo(600) }]);
  S.sesiones[id].cierre = { esfuerzo: 4, dolor: {}, comentario: largo(1500) };
}, 'perfil');
est.guardarYa();
const S = est.estado(); const sid = Object.keys(S.sesiones)[0];
const antes = { lesion: S.perfil.lesiones[0].nota.length, notas: S.perfil.notas.length, comentarioEj: S.sesiones[sid].ejercicios[0].comentario.length, cierre: S.sesiones[sid].cierre.comentario.length };
const r = est.importar(est.exportar());
const T = est.estado();
const despues = { lesion: T.perfil.lesiones[0].nota.length, notas: T.perfil.notas.length, comentarioEj: T.sesiones[sid].ejercicios[0].comentario.length, cierre: T.sesiones[sid].cierre.comentario.length };
console.log('antes  ', antes); console.log('después', despues); console.log('avisos ', r.avisos);
