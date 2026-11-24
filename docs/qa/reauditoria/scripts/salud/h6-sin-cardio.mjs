// H6: sesiones sin cardio (T1, C-PRIN-4, D3) con una o dos zonas en B2 en casa o en la calle.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const Z = Object.keys(cat.ZONAS);
const out = []; let n = 0;
for (const lugar of ['gym', 'casa', 'calle', 'piscina']) for (const mat of lugar === 'casa' ? [[], ['bici']] : [[]]) {
  for (let i = 0; i < Z.length; i++) for (let j = i; j < Z.length; j++) for (const d of [3, 5]) {
    const S = nuevoS({ objetivos: ['salud'], nivel: 1, lugares: [lugar], materialCasa: mat });
    const dolorHoy = { [Z[i]]: d, [Z[j]]: d };
    [...new Set([Z[i], Z[j]])].forEach(z => S.perfil.lesiones.push({ id: z, zona: z, dolor: d, activa: true, desde: '2025-01-01' }));
    const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { lugar, minutos: 45, energia: 3, dolorHoy, peticion: '' }).datos);
    n++;
    if (!s.ejercicios.some(x => x.rol === 'cardio')) out.push(`${lugar}${mat.length ? '+bici' : ''}: ${Z[i]}${i !== j ? ' + ' + Z[j] : ''} a ${d}/10`);
  }
}
console.log(`${out.length} de ${n} sin cardio:\n` + out.join('\n'));
