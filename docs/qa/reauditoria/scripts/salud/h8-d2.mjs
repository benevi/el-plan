// H8: día de dolor alto (D2): contenido de CR-01, CR-02, CR-23 y la dorsal; los estiramientos «alivio» de la ficha (C-EST-2) no salen nunca.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, cat } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
function d2(t, perfil, lesiones, ci) {
  const S = nuevoS(perfil); lesiones.forEach((l, i) => S.perfil.lesiones.push({ id: 'l' + i, activa: true, desde: '2025-01-01', ...l }));
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, { energia: 3, peticion: '', ...ci }).datos);
  console.log(`\n${t}: ${ent.tiempoSesion(s)} min`);
  console.log('  cal:', s.calentamiento.map(x => `${x.id || '-'} ${x.duracion}`).join(' | '));
  console.log('  ej :', s.ejercicios.map(x => `${x.rol} ${x.id} ${x.reps}`).join(' | '));
  console.log('  vue:', s.vuelta.map(x => `${x.id || x.nombre} ${x.duracion}`).join(' | '));
}
d2('CR-01 rodilla 8, gym 45', { objetivos: ['musculo'], nivel: 2, lugares: ['gym'] }, [{ zona: 'rodilla', dolor: 3 }], { lugar: 'gym', minutos: 45, dolorHoy: { rodilla: 8 } });
d2('CR-02 lumbar 7, casa sin material 30', { objetivos: ['salud'], nivel: 1, lugares: ['casa'], materialCasa: [] }, [{ zona: 'lumbar', dolor: 7 }], { lugar: 'casa', minutos: 30, dolorHoy: { lumbar: 7 } });
d2('CR-23 hombro 8 + rodilla 4, piscina 90', { objetivos: ['salud'], nivel: 2, lugares: ['piscina'] }, [{ zona: 'hombro', dolor: 5 }, { zona: 'rodilla', dolor: 4 }], { lugar: 'piscina', minutos: 90, dolorHoy: { hombro: 8, rodilla: 4 } });
d2('dorsal 8, calle 60', { objetivos: ['perder'], nivel: 2, lugares: ['calle'] }, [{ zona: 'dorsal', dolor: 5 }], { lugar: 'calle', minutos: 60, dolorHoy: { dorsal: 8 } });
d2('tobillo 8, casa sin material 45, 70 años', { objetivos: ['salud'], nivel: 1, lugares: ['casa'], datos: { nacimiento: '1956-01-01' } }, [{ zona: 'tobillo_pie', dolor: 5 }], { lugar: 'casa', minutos: 45, dolorHoy: { tobillo_pie: 8 } });
