// «Mis sesiones»: guardar una sesión para repetirla y crear la de hoy a partir de ella, sin IA y pasando por
// el validador único con el dolor, lugar y material de hoy. Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, est, modelo, prog, ponerRed, hecha } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles (diaSemana 3)
ponerRed(false);
const { normalizarEstado } = await import(modulo('js/nucleo/normalizar.js'));
const ci = (o = {}) => ({ lugar: 'casa', minutos: 45, energia: 3, dolorHoy: {}, peticion: '', ...o });
const ids = s => s.ejercicios.map(x => x.id);

// Una sesión de «abdominales y flexiones» en casa, con kilos y series apuntadas, guardada en el estado.
function sesionAbdos(S, ejercicios = ['flexiones', 'crunch', 'plancha', 'dead-bug']) {
  const s = modelo.crearSesion({ fuente: 'reglas', nombre: 'Abdos', lugar: 'casa', minutos: 30, ejercicios: ejercicios.map(id => ({ id, rol: 'principal', series: 3, reps: cat.ex(id).d[1], descanso: 45, kg: 10 })) });
  est.cambiar(X => { X.sesiones[s.id] = s; }, 'sesion');
  return s;
}

test('guardar como mía: ids, rol, series, reps, descanso y lugar; sin kilos ni lo apuntado', () => {
  const S = nuevoS({ lugares: ['casa'] });
  const s = sesionAbdos(S);
  s.ejercicios[0].sets[0].hecha = true;
  const r = ent.guardarMia(s.id, '  Solo abdominales   y flexiones  ');
  assert.ok(!r.error, r.error);
  const [m] = est.estado().misSesiones;
  assert.equal(m.nombre, 'Solo abdominales y flexiones');
  assert.equal(m.lugar, 'casa');
  assert.match(m.id, /^[\w-]+$/);
  assert.deepEqual(m.ejercicios.map(x => x.id), ['flexiones', 'crunch', 'plancha', 'dead-bug']);
  assert.deepEqual(Object.keys(m.ejercicios[0]).sort(), ['descanso', 'id', 'reps', 'rol', 'series']);
  assert.deepEqual(m.ejercicios[0], { id: 'flexiones', rol: 'principal', series: 3, reps: '8-15', descanso: 45 });
});

test('nombre: obligatorio, hasta 40 caracteres y sin repetir', () => {
  const S = nuevoS({ lugares: ['casa'] });
  const s = sesionAbdos(S);
  assert.match(ent.guardarMia(s.id, '   ').error, /nombre/);
  assert.equal(ent.guardarMia(s.id, 'x'.repeat(60)).mia.nombre.length, 40);
  assert.match(ent.guardarMia(s.id, 'X'.repeat(40)).error, /Ya tienes una sesión que se llama/);
});

test('como mucho 30; la del día de dolor alto no se guarda', () => {
  const S = nuevoS({ lugares: ['casa'] });
  const s = sesionAbdos(S);
  for (let i = 0; i < ent.MAX_MIAS; i++) assert.ok(ent.guardarMia(s.id, 'Sesión ' + i).mia);
  assert.match(ent.guardarMia(s.id, 'Una más').error, /Ya tienes 30/);
  assert.equal(est.estado().misSesiones.length, 30);
  const suave = modelo.crearSesion({ ...ent.diaDolorAlto(S, { lugar: 'casa', minutos: 30, dolorHoy: { lumbar: 8 } }) });
  est.cambiar(X => { X.sesiones[suave.id] = suave; X.misSesiones = []; }, 'sesion');
  assert.match(ent.guardarMia(suave.id, 'Suave').error, /dolor alto/);
});

test('renombrar conserva el id; borrar la quita', () => {
  const S = nuevoS({ lugares: ['casa'] });
  const s = sesionAbdos(S);
  const { mia } = ent.guardarMia(s.id, 'Abdos');
  ent.guardarMia(s.id, 'Otra');
  assert.match(ent.renombrarMia(mia.id, 'otra').error, /Ya tienes/);
  assert.equal(ent.renombrarMia(mia.id, 'Core y flexiones').mia.id, mia.id);
  assert.equal(ent.miaDe(est.estado(), mia.id).nombre, 'Core y flexiones');
  ent.borrarMia(mia.id);
  assert.equal(ent.miaDe(est.estado(), mia.id), null);
  assert.equal(est.estado().misSesiones.length, 1);
});

test('copia ida y vuelta: normalizar conserva misSesiones (ids estables) y el origen de la sesión', async () => {
  const S = nuevoS({ lugares: ['casa'] });
  const s = sesionAbdos(S);
  const { mia } = ent.guardarMia(s.id, 'Abdos');
  const { sesion } = await ent.crearSesionHoy(ci({ mia: mia.id }));
  const antes = JSON.parse(est.exportar());
  const { estado: n, avisos } = normalizarEstado(antes);
  assert.deepEqual(avisos, []);
  assert.deepEqual(n.misSesiones, antes.misSesiones);
  assert.deepEqual(n.sesiones[sesion.id].origen, { tipo: 'mia', id: mia.id });
  // Y entra de verdad por importar(): sigue igual tras cargar la copia.
  est.importar(JSON.stringify(antes));
  assert.deepEqual(est.estado().misSesiones, antes.misSesiones);
  assert.deepEqual(est.estado().sesiones[sesion.id].origen, { tipo: 'mia', id: mia.id });
});

test('normalizar: descarta lo raro de misSesiones y se queda con 30', () => {
  const S = nuevoS();
  const buena = i => ({ id: 'm' + i, nombre: 'Mía ' + i, lugar: 'gym', minutos: 30, creada: '2026-11-01T10:00:00.000Z', ejercicios: [{ id: 'plancha', rol: 'principal', series: 3, reps: '30s', descanso: 45, kg: 50 }] });
  const x = JSON.parse(JSON.stringify({ ...S, misSesiones: [
    buena(1), buena(1), // repetida
    { ...buena(2), id: '../mal' }, { ...buena(3), nombre: '  ' }, { ...buena(4), ejercicios: [] }, { ...buena(5), lugar: 'luna', series: 99 },
    { ...buena(6), ejercicios: [{ id: 'plancha', rol: 'jefe', series: 99, reps: 'x'.repeat(50), descanso: 9999 }, { id: '<b>' }] },
    ...Array.from({ length: 40 }, (_, i) => buena(10 + i)),
  ] }));
  const { estado: n } = normalizarEstado(x);
  assert.equal(n.misSesiones[0].id, 'm1');
  assert.ok(!('kg' in n.misSesiones[0].ejercicios[0]));
  assert.equal(n.misSesiones.filter(m => m.id === 'm1').length, 1);
  assert.ok(!n.misSesiones.some(m => ['../mal', 'm3', 'm4'].includes(m.id)));
  assert.equal(n.misSesiones.find(m => m.id === 'm5').lugar, 'gym');
  assert.deepEqual(n.misSesiones.find(m => m.id === 'm6').ejercicios, [{ id: 'plancha', rol: 'principal', series: 10, reps: 'x'.repeat(24), descanso: 300 }]);
  assert.ok(n.misSesiones.length <= 30);
  // Sin sesiones guardadas, la clave no aparece (como alarmas).
  assert.ok(!('misSesiones' in normalizarEstado(JSON.parse(JSON.stringify(S))).estado));
});

test('crear desde una mía: sin IA, con calentamiento, cardio y vuelta con estiramientos, y marca de origen', async () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['casa'], nivel: 2 }); // flexiones es de nivel 2 (C-DOSIS-10)
  const { mia } = ent.guardarMia(sesionAbdos(S).id, 'Abdos y flexiones');
  let llamadas = 0;
  ponerRed(true, async () => { llamadas++; throw new Error('no debe llamar a la IA'); });
  try {
    const r = await ent.crearSesionHoy(ci({ mia: mia.id, peticion: 'algo largo que no se manda', forzarIA: true }));
    const s = r.sesion;
    assert.equal(llamadas, 0);
    assert.ok(!s.iaFallo);
    assert.deepEqual(s.origen, { tipo: 'mia', id: mia.id });
    assert.equal(s.nombre, 'Abdos y flexiones');
    for (const id of ['flexiones', 'crunch', 'plancha', 'dead-bug']) assert.ok(ids(s).includes(id), id);
    assert.ok(s.calentamiento.length >= 2);
    assert.ok(s.vuelta.some(t => /estir|postura/i.test(t.nombre)));
    assert.ok(s.ejercicios.some(x => x.rol === 'cardio'));
    assert.ok(s.explicacion.some(t => /^Ajustado por la app: Añado \d+ min de cardio/.test(t)));
    assert.match(s.explicacion[0], /Tu sesión «Abdos y flexiones»/);
    assert.deepEqual(ent.problemasSesion(S, s, { lugar: 'casa', minutos: 45, dolorHoy: {} }), []);
  } finally { ponerRed(false); }
});

test('crear desde una mía con dolor de hoy: cambia lo que carga la zona y lo explica (C-DOLOR-1)', async () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['casa'] });
  const { mia } = ent.guardarMia(sesionAbdos(S).id, 'Abdos');
  // Después de guardarla aparece una lumbalgia: el crunch (riesgo 2 en lumbar) ya no vale.
  est.cambiar(X => { X.perfil.lesiones.push({ id: 'l1', zona: 'lumbar', dolor: 4, desde: '2026-01-01', activa: true, tipo: 'recurrente' }); }, 'perfil');
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id, dolorHoy: { lumbar: 4 } }));
  assert.ok(!ids(s).includes('crunch'));
  assert.ok(s.explicacion.some(t => /^Ajustado por la app: (Cambio|Quito) crunch abdominal.*lumbar/.test(t)), s.explicacion.join('\n'));
  assert.ok(s.ejercicios.some(x => x.rol === 'rehab'), 'rehabilitación de la zona activa');
  assert.ok(s.ejercicios.every(x => cat.ex(x.id).r.lumbar !== 2));
  assert.deepEqual(ent.problemasSesion(est.estado(), s, { lugar: 'casa', minutos: 45, dolorHoy: { lumbar: 4 } }), []);
});

test('crear desde una mía sin el material: lo cambia por algo que puedes hacer hoy', async () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['casa'], materialCasa: ['rueda'] });
  const { mia } = ent.guardarMia(sesionAbdos(S, ['flexiones', 'rueda-abdominal', 'plancha', 'dead-bug']).id, 'Con rueda');
  est.cambiar(X => { X.perfil.materialCasa = []; X.perfil.nivel = 3; }, 'perfil'); // la rueda ya no está en casa
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id }));
  assert.ok(!ids(s).includes('rueda-abdominal'));
  assert.ok(s.explicacion.some(t => /^Ajustado por la app: (Cambio|Quito) rueda abdominal.*no tienes el material/.test(t)), s.explicacion.join('\n'));
  assert.ok(s.ejercicios.every(x => cat.hayMaterial(cat.ex(x.id), 'casa', est.estado().perfil)));
});

test('crear desde una mía en otro lugar: cambia lo que no hay allí', async () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['casa', 'gym'] });
  const { mia } = ent.guardarMia(sesionAbdos(S).id, 'Abdos');
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id, lugar: 'gym' }));
  assert.equal(s.lugar, 'gym');
  assert.ok(!ids(s).includes('flexiones')); // solo casa y calle
  assert.ok(s.explicacion.some(t => /flexiones.*otro lugar/.test(t)), s.explicacion.join('\n'));
  assert.ok(s.ejercicios.every(x => cat.ex(x.id).l.includes('gym')));
});

test('con dolor ≥ 7 manda el día de dolor alto, no la mía (C-DOLOR-4)', async () => {
  const S = nuevoS({ objetivos: ['salud'], lugares: ['casa'], lesiones: [{ id: 'l1', zona: 'lumbar', dolor: 3, desde: '2026-01-01', activa: true, tipo: 'recurrente' }] });
  const { mia } = ent.guardarMia(sesionAbdos(S, ['flexiones', 'plancha', 'dead-bug']).id, 'Abdos');
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id, dolorHoy: { lumbar: 8 } }));
  assert.equal(s.tipo, 'dolorAlto');
  assert.ok(!s.origen);
  assert.ok(!s.ejercicios.some(x => x.rol === 'principal'));
  assert.ok(s.explicacion.some(t => /Hoy no haces «Abdos»: con dolor de 7 o más/.test(t)));
});

test('con una señal de alarma no se crea nada, aunque sea una mía (C-ALAR-1)', async () => {
  const S = nuevoS({ lugares: ['casa'] });
  const { mia } = ent.guardarMia(sesionAbdos(S).id, 'Abdos');
  const antes = Object.keys(est.estado().sesiones).length;
  const r = await ent.crearSesionHoy(ci({ mia: mia.id, alarma: true }));
  assert.equal(r.sesion, null);
  assert.ok(r.alarma);
  // Las pendientes de hoy se cancelan con la alarma (la de sesionAbdos lo era).
  assert.ok(Object.keys(est.estado().sesiones).length < antes);
});

test('kilos según la progresión: con historial salen acotados; sin él, nulos (C-PROG-1, C-PROG-5)', async () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym'], nivel: 2 });
  hecha(S, 3, [{ id: 'press-pecho-maquina', reps: '8-12', sets: [[40, 12], [40, 12], [40, 12], [40, 12]] }]);
  const s0 = modelo.crearSesion({ nombre: 'Pecho', lugar: 'gym', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 4, reps: '8-12', descanso: 90, kg: 200 }, { id: 'remo-sentado-polea', rol: 'principal', series: 3, reps: '10-12', descanso: 75, kg: 80 }, { id: 'plancha', rol: 'principal', series: 3, reps: '30-45s', descanso: 45 }] });
  est.cambiar(X => { X.sesiones[s0.id] = s0; }, 'sesion');
  const { mia } = ent.guardarMia(s0.id, 'Pecho');
  const { sesion: s } = await ent.crearSesionHoy(ci({ mia: mia.id, lugar: 'gym', minutos: 60 }));
  const press = s.ejercicios.find(x => x.id === 'press-pecho-maquina');
  assert.ok(press.kg >= 40 && press.kg <= prog.acotarKg(est.estado(), press.id, 200, { series: press.series, reps: press.reps }), String(press.kg));
  const remo = s.ejercicios.find(x => x.id === 'remo-sentado-polea');
  if (remo) assert.equal(remo.kg, null);
});

test('un día del plan: la mía lo ocupa igual que «Hacer este día hoy»', async () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym', 'casa'] });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const { mia } = ent.guardarMia(sesionAbdos(S).id, 'Abdos');
  const { sesion } = await ent.crearSesionHoy(ci({ mia: mia.id, diaPlan: 3 }));
  assert.equal(est.estado().plan.hechos[3], sesion.id);
  assert.equal(sesion.fuente, 'reglas');
  // Al terminarla cuenta como cualquier otra para la constancia y el estado de la semana.
  est.cambiar(X => { const s = X.sesiones[sesion.id]; s.estado = 'hecha'; s.terminada = new Date().toISOString(); }, 'sesion');
  assert.ok(prog.sesionesHechas(est.estado()).some(s => s.id === sesion.id));
  assert.equal(ent.estadoDias(est.estado()).find(d => d.diaSemana === 3).estado, 'hecho');
});

test('una mía que ya no existe no crea nada ni llama a la IA', async () => {
  nuevoS({ lugares: ['casa'] });
  const r = await ent.crearSesionHoy(ci({ mia: 'no-existe' }));
  assert.equal(r.sesion, null);
  assert.match(r.aviso, /ya no está/);
});
