// Migración desde la app anterior (PR 4): incremental e idempotente, marcha atrás y vuelta, cambio de dueño
// y corrección única del sexo para quien migró con la versión con fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, viejoDemo } from './ayuda/comun.mjs';
import { est, cargarCon } from './ayuda/node.mjs';
import * as N from './ayuda/node.mjs';

const guardado = () => JSON.parse(N.almacen.getItem('pipos4') || 'null');
const elplan2 = () => JSON.parse(N.almacen.getItem('elplan2'));
const ponerElplan2 = v => N.almacen.setItem('elplan2', JSON.stringify(v));
const esperarGuardado = () => new Promise(r => setTimeout(r, 300));

// Lo que dejaba la migración con fallos (antes del PR 4) en pipos4 para Víctor: ids al azar, fecha UTC,
// sexo copiado tal cual ('m'), sin `migracion`, sin `viejo` (lo borraba).
function migradoConFallos(dueño = 'victor', sexo = 'm') {
  const v = viejoDemo(), u = dueño === 'victor' ? 'him' : 'her';
  const base = estadoBase({ dueño, sesiones: {}, medidas: [] });
  delete base.migracion;
  base.perfil.datos = { sexo, altura: v.bodyProfile[u].height, nacimiento: '' };
  Object.values(v.workouts).filter(w => w.user === u).forEach((w, i) => {
    const id = 'v-azar' + i;
    base.sesiones[id] = { id, fecha: w.completedAt.slice(0, 10), creada: w.date, fuente: 'anterior', nombre: w.nombre, foco: '', lugar: 'gym', explicacion: [], calentamiento: [], vuelta: [], ejercicios: [], estado: 'hecha', empezada: w.date, terminada: w.completedAt, checkin: null, cierre: null };
  });
  v.injuries[u].forEach(i => base.perfil.lesiones.push({ id: 'azar-l', zona: i.zoneKey, dolor: i.severity * 3, desde: i.since, nota: i.note, activa: i.active }));
  v.bodyLog[u].forEach(b => base.medidas.push({ fecha: b.date.slice(0, 10), peso: b.weight, cintura: b.waist || null, cadera: b.hip || null, cuello: b.neck || null, pecho: null, brazo: null, muslo: null, grasa: null }));
  return base;
}

test('migrar dos veces no duplica nada (claves estables, no uid())', () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'virginia';
  assert.equal(est.migrarDeViejo('virginia'), 1);
  const foto = JSON.stringify(S);
  assert.equal(est.migrarDeViejo('virginia'), 0);
  assert.equal(JSON.stringify(S), foto);
  assert.deepEqual(Object.keys(S.sesiones), ['v-k2']);
  assert.equal(S.perfil.lesiones[0].id, 'v-l-t');
  assert.equal(S.perfil.lesiones[0].dolorRevisar, true, 'el dolor migrado (gravedad × 3) queda por revisar');
  assert.equal(S.perfil.datos.sexo, 'm', 'Virginia: f en la app anterior → m (mujer) aquí');
  assert.ok(S.migracion.claves.includes('s:k2'));
});

test('elplan2 no se borra ni se copia en pipos4', () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  est.guardarYa();
  assert.deepEqual(elplan2(), viejoDemo());
  assert.equal(guardado().viejo, undefined);
  assert.ok(est.estado().viejo, 'sigue a mano para migrar');
  assert.equal(guardado().migracion.dueño, 'victor');
});

test('marcha atrás y vuelta: en el siguiente arranque se trae solo lo nuevo de elplan2 (sesiones, medidas y dolor)', async () => {
  cargarCon({ elplan2: viejoDemo() });
  est.cambiar(S => { S.dueño = 'victor'; est.migrarDeViejo('victor'); });
  est.guardarYa();
  // La persona borra una sesión migrada: no debe volver.
  est.cambiar(S => { delete S.sesiones['v-k1']; });
  est.guardarYa();
  // Marcha atrás a la app de main: guarda otra sesión, una medida y dolor en elplan2.
  const v = elplan2();
  v.workouts.k3 = { key: 'k3', user: 'him', day: 'B', nombre: 'Durante la marcha atrás', lugar: 'Casa', date: '2026-11-01T18:00:00.000Z', completed: true, completedAt: '2026-11-01T19:00:00.000Z', exercises: [{ exId: 'flexiones', name: 'Flexiones', sets: [{ weight: '', reps: '12', done: true }] }] };
  v.bodyLog.him.push({ date: '2026-11-02T07:00:00.000Z', weight: 81 });
  v.painLog = [{ date: '2026-11-01T19:00:10.000Z', user: 'him', antes: { hombro: 1 }, despues: { hombro: 2 } }];
  ponerElplan2(v);
  // Vuelta a la v2.
  est.cargar();
  const r = est.ponerAlDiaMigracion();
  assert.equal(r.sesiones, 1);
  const S = est.estado();
  assert.deepEqual(Object.values(S.sesiones).map(s => s.nombre), ['Durante la marcha atrás']);
  assert.equal(S.sesiones['v-k3'].lugar, 'casa');
  assert.deepEqual(S.medidas.map(m => m.peso), [82, 81]);
  assert.deepEqual(S.dolor.map(d => [d.momento, d.dolor, d.sesion]), [['antes', 1, 'v-k3'], ['despues', 2, 'v-k3']]);
  await esperarGuardado();
  assert.ok(guardado().sesiones['v-k3'], 'se guarda');
  // Otro arranque sin cambios en elplan2: nada que hacer.
  est.cargar();
  assert.equal(est.ponerAlDiaMigracion().cambió, false);
});

test('cambiar de dueño retira lo migrado del otro y deja lo hecho en esta app', () => {
  const S = cargarCon({ elplan2: viejoDemo() });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  S.sesiones.propia = { id: 'propia', fecha: '2026-11-10', creada: '2026-11-10T10:00:00.000Z', fuente: 'reglas', nombre: 'Hecha aquí', estado: 'hecha', ejercicios: [], calentamiento: [], vuelta: [] };
  S.medidas.push({ fecha: '2026-11-10', peso: 79 });
  S.dueño = 'virginia';
  est.migrarDeViejo('virginia');
  assert.deepEqual(Object.keys(S.sesiones).sort(), ['propia', 'v-k2']);
  assert.deepEqual(S.medidas.map(m => m.peso), [79, 60]);
  assert.equal(S.perfil.datos.sexo, 'm');
  assert.equal(S.perfil.datos.altura, 165);
  assert.equal(est.resultadoMigracion().retirado, true);
  // Y vuelta a Víctor.
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  assert.deepEqual(Object.keys(S.sesiones).sort(), ['propia', 'v-k1']);
  assert.equal(S.perfil.datos.sexo, 'h');
});

test('al arrancar no se retira nada sin preguntar si lo migrado es de la otra persona', () => {
  const base = estadoBase({ dueño: 'victor' });
  base.migracion = { version: 2, dueño: 'virginia', claves: ['s:k2'], sexoRevisar: false };
  cargarCon({ pipos4: base, elplan2: viejoDemo() });
  assert.equal(est.ponerAlDiaMigracion(), null);
  assert.equal(est.migracionDeOtro(), true);
  assert.deepEqual(est.estado().sesiones, {});
});

test('zonas desconocidas en la app anterior: se normalizan si se entienden y si no se descartan con aviso', () => {
  const v = viejoDemo();
  v.injuries.him = [{ id: 'a', zoneKey: 'Tobillo', severity: 1, active: true }, { id: 'b', zoneKey: 'oreja', severity: 3, active: true }];
  const S = cargarCon({ elplan2: v });
  S.dueño = 'victor';
  est.migrarDeViejo('victor');
  assert.deepEqual(S.perfil.lesiones.map(l => [l.zona, l.dolor]), [['tobillo_pie', 3]]);
  assert.ok(est.resultadoMigracion().descartadas.some(t => /oreja/.test(t)));
});

// ── Corrección única para quien ya migró con la versión con fallos ──
test('corrección única: los datos migrados con fallos no se duplican al ponerse al día', () => {
  cargarCon({ pipos4: migradoConFallos('virginia', 'f'), elplan2: viejoDemo() });
  const r = est.ponerAlDiaMigracion();
  const S = est.estado();
  assert.equal(r.sesiones, 0);
  assert.equal(Object.keys(S.sesiones).length, 1);
  assert.equal(S.perfil.lesiones.length, 1);
  assert.equal(S.medidas.length, 1);
  assert.equal(S.migracion.version, 2);
  assert.equal(S.migracion.dueño, 'virginia');
  assert.ok(S.perfil.lesiones[0].vid && S.medidas[0].vid, 'lo migrado queda marcado (se puede retirar)');
});

test("corrección única: 'f' (que esta app no usa) se arregla sola a 'm' y no se vuelve a tocar", () => {
  cargarCon({ pipos4: migradoConFallos('virginia', 'f'), elplan2: viejoDemo() });
  est.ponerAlDiaMigracion();
  assert.equal(est.estado().perfil.datos.sexo, 'm');
  assert.equal(est.estado().migracion.sexoRevisar, false);
  est.guardarYa();
  // Si luego la persona cambia el dato a mano, no se vuelve a corregir.
  est.cambiar(S => { S.perfil.datos.sexo = 'h'; }); est.guardarYa();
  est.cargar(); est.ponerAlDiaMigracion();
  assert.equal(est.estado().perfil.datos.sexo, 'h');
});

test("corrección única: 'm' que venía de 'm' (hombre) puede ser el fallo o una elección: se pregunta, no se adivina", () => {
  cargarCon({ pipos4: migradoConFallos('victor', 'm'), elplan2: viejoDemo() });
  est.ponerAlDiaMigracion();
  const S = est.estado();
  assert.equal(S.perfil.datos.sexo, 'm', 'no se cambia solo');
  assert.equal(S.migracion.sexoRevisar, true);
  est.confirmarSexo('h');
  assert.equal(est.estado().perfil.datos.sexo, 'h');
  assert.equal(est.estado().migracion.sexoRevisar, false);
  est.guardarYa(); est.cargar(); est.ponerAlDiaMigracion();
  assert.equal(est.estado().migracion.sexoRevisar, false, 'una sola vez');
});

test('corrección única: sin la app anterior a mano, con sesiones migradas y «m», también se pregunta', () => {
  cargarCon({ pipos4: migradoConFallos('victor', 'm') });
  est.ponerAlDiaMigracion();
  assert.equal(est.estado().migracion.sexoRevisar, true);
});

test('corrección única: quien nunca migró o ya lo arregló a mano no ve nada', () => {
  cargarCon({ pipos4: migradoConFallos('victor', 'h'), elplan2: viejoDemo() });
  est.ponerAlDiaMigracion();
  assert.equal(est.estado().perfil.datos.sexo, 'h');
  assert.equal(est.estado().migracion.sexoRevisar, false);
  const nunca = estadoBase({ perfil: { ...estadoBase().perfil, datos: { sexo: 'm', altura: 165, nacimiento: '' } } });
  cargarCon({ pipos4: nunca });
  est.ponerAlDiaMigracion();
  assert.equal(est.estado().migracion.sexoRevisar, false);
  assert.equal(est.estado().migracion.version, 2);
});

// ── Cambiar de dueño y volver (revisión del PR 4) ──
test('cambiar de dueño y volver repone lo migrado con sus cambios y no mezcla los datos personales', async () => {
  const { viejoReal } = await import('./ayuda/viejo-real.mjs');
  cargarCon({ elplan2: viejoReal() });
  est.cambiar(S => { S.dueño = 'victor'; est.migrarDeViejo('victor'); });
  est.cambiar(S => {
    Object.assign(S.perfil.lesiones[0], { nota: 'Menisco operado', activa: false }); delete S.perfil.lesiones[0].dolorRevisar;
    S.sesiones['v-h0'].cierre.comentario = 'EDIT';
    delete S.sesiones['v-h1'];
    S.sesiones.nueva1 = { ...JSON.parse(JSON.stringify(S.sesiones['v-h2'])), id: 'nueva1', fuente: 'reglas' };
    S.perfil.datos.nacimiento = '1985';
  });
  est.soltarDueño();
  est.cambiar(S => { S.dueño = 'virginia'; est.migrarDeViejo('virginia'); });
  let S = est.estado();
  assert.deepEqual(Object.keys(S.sesiones).sort(), ['nueva1', 'v-m0', 'v-m1', 'v-m2', 'v-m3', 'v-m4', 'v-m5'], 'lo hecho en esta app se queda; lo de Víctor se aparta');
  assert.deepEqual(S.perfil.lesiones.map(l => l.nota), ['Trocanteritis']);
  assert.deepEqual(S.perfil.datos, { sexo: 'm', altura: 165, nacimiento: '' }, 'el nacimiento de Víctor no pasa a Virginia');
  assert.equal(JSON.parse(est.exportar()).migracion.porDueño, undefined, 'lo apartado de Víctor no sale en la copia de Virginia');
  est.guardarYa();
  est.cargar(); // sobrevive a recargar
  est.soltarDueño();
  est.cambiar(X => { X.dueño = 'victor'; est.migrarDeViejo('victor'); });
  S = est.estado();
  assert.deepEqual(Object.keys(S.sesiones).sort(), ['nueva1', 'v-h0', 'v-h2', 'v-h3', 'v-h4', 'v-h5'], 'la borrada no vuelve');
  assert.equal(S.sesiones['v-h0'].cierre.comentario, 'EDIT');
  assert.deepEqual(S.perfil.lesiones.map(l => `${l.nota}:${l.activa}`), ['Menisco operado:false'], 'la curada sigue curada');
  assert.deepEqual(S.perfil.datos, { sexo: 'h', altura: 180, nacimiento: '1985' });
  assert.ok(S.migracion.porDueño && S.migracion.porDueño.virginia, 'ahora lo apartado es lo de Virginia');
  assert.equal(S.migracion.porDueño.victor, undefined);
});
