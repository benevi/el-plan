// H17: datos de salud (C-SALUD-0): embarazo ≥ 16 semanas con lumbar; hipertensión; osteoporosis; equilibrio.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const BOCA_ARRIBA = ['descarga-90-90', 'dead-bug', 'puente-gluteo', 'elevacion-pierna-recta', 'estiramiento-isquios-tumbado', 'crunch', 'puente-banda-rodillas', 'puente-talones-elevados', 'curl-femoral-deslizante', 'estiramiento-figura-4', 'estiramiento-gluteo-rodilla-pecho', 'press-banca-mancuernas', 'press-banca-barra', 'retraccion-cervical'];
function ver(t, salud, les, ci) {
  const S = nuevoS({ objetivos: ['salud'], nivel: 2, lugares: [ci.lugar], materialCasa: ['banda', 'mancuernas'], salud });
  les.forEach((l, i) => S.perfil.lesiones.push({ id: 'l' + i, activa: true, desde: '2025-01-01', ...l }));
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { energia: 3, peticion: '', ...ci }).datos);
  const todos = [...s.calentamiento.map(x => ['cal', x]), ...s.ejercicios.map(x => [x.rol, x]), ...s.vuelta.map(x => ['vue', x])];
  const supino = todos.filter(([, x]) => BOCA_ARRIBA.includes(x.id)).map(([d, x]) => `${d}:${x.id} ${x.series ? x.series + '×' + x.reps : x.duracion}`);
  const tumb = todos.filter(([, x]) => /Tumbado/.test(x.detalle || '')).map(([d, x]) => `${d}:«${x.nombre}» ${x.duracion}`);
  console.log(`${t}\n   boca arriba: ${supino.join(' | ') || '—'}${tumb.length ? ' | ' + tumb.join(' | ') : ''}`);
}
ver('Embarazo 24 sem con visto bueno, lumbar 3/10, gym 60', { embarazo: 24, vistoBueno: { embarazo: true } }, [{ zona: 'lumbar', dolor: 3 }], { lugar: 'gym', minutos: 60, dolorHoy: { lumbar: 3 } });
ver('Embarazo 24 sem con visto bueno, lumbar 5/10, casa 45', { embarazo: 24, vistoBueno: { embarazo: true } }, [{ zona: 'lumbar', dolor: 5 }], { lugar: 'casa', minutos: 45, dolorHoy: { lumbar: 5 } });
ver('Embarazo 24 sem con visto bueno, sin lesión, gym 60', { embarazo: 24, vistoBueno: { embarazo: true } }, [], { lugar: 'gym', minutos: 60, dolorHoy: {} });
