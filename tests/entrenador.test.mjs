// Entrenador por reglas (sin IA): plan semanal, check-in, reorganizar. Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, est, modelo, prog, ponerRed } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles (diaSemana 3)
ponerRed(false);
const ci = (o = {}) => ({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', ...o });
const ids = d => d.ejercicios.map(x => x.id);

// ── Lo que ya funciona ──

test('planReglas hace un día por cada día pedido, con ejercicios del lugar', () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  const plan = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym'] });
  assert.deepEqual(plan.dias.map(d => d.diaSemana), [1, 3, 5]);
  for (const d of plan.dias) {
    assert.ok(d.ejercicios.filter(x => x.rol === 'principal').length >= 3, d.nombre);
    assert.ok(d.ejercicios.every(x => cat.ex(x.id).l.includes('gym')));
    assert.ok(d.calentamiento.length && d.vuelta.length);
  }
});

test('ajustarAlCheckin sin plan monta una sesión completa para ese lugar', () => {
  const S = nuevoS({ objetivos: ['perder'], lugares: ['casa'], materialCasa: [] });
  const { datos } = ent.ajustarAlCheckin(S, null, ci({ lugar: 'casa', minutos: 45 }));
  const s = modelo.crearSesion(datos);
  assert.equal(s.lugar, 'casa');
  assert.ok(s.ejercicios.length >= 3);
  assert.ok(s.ejercicios.every(x => cat.hayMaterial(cat.ex(x.id), 'casa', S.perfil)));
});

test('un ejercicio rechazado después del plan se cambia al hacer el check-in', () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym'], nivel: 2 });
  const d = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym'] }).dias[0];
  const quitado = d.ejercicios.find(x => x.rol === 'principal').id;
  S.perfil.gustos[quitado] = 'rechazo';
  const r = ent.ajustarAlCheckin(S, d, ci());
  assert.ok(!ids(r.datos).includes(quitado));
  assert.ok(r.cambios.some(c => /no lo quieres/.test(c)));
});

test('con dolor ≥ 7 la sesión pasa a «Sesión suave» y avisa de consultar (C-DOLOR-4, T6)', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'lumbar', dolor: 3, activa: true }] });
  const r = ent.ajustarAlCheckin(S, null, ci({ dolorHoy: { lumbar: 9 }, minutos: 30 }));
  assert.equal(r.datos.nombre, 'Sesión suave');
  assert.equal(r.cambios[0], ent.T6('lumbar', 9, 30));
  assert.ok(r.cambios.some(c => /consúltalo/.test(c)));
});

test('crearSesionHoy sin red: sesión del plan, guardada y marcada en el plan', async () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const { sesion } = await ent.crearSesionHoy(ci());
  assert.equal(sesion.fuente, 'plan');
  assert.ok(est.estado().sesiones[sesion.id]);
  assert.equal(est.estado().plan.hechos[3], sesion.id);
  assert.equal(S, est.estado());
});

test('reorganizar mueve los días pendientes a los días libres', async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const nota = ent.reorganizar([4, 6]);
  assert.match(nota, /Muevo/);
  assert.deepEqual(est.estado().plan.dias.map(d => d.diaSemana), [4, 6]);
});

// ── Fallos demostrados por la auditoría (los cierra el PR 8 salvo los de plan.js, que son del PR 10) ──

test('reorganizar sin días libres no borra la semana', { todo: 'PR 10: reorganizar sin días libres (plan.js)' }, async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  ent.reorganizar([]);
  assert.equal(est.estado().plan.dias.length, 2);
});

test('una sesión no marca dos días del plan como hechos', { todo: 'PR 10: «una sesión marca dos días» (plan.js)' }, async () => {
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'] });
  await ent.crearPlanSemana({ dias: [3, 4], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const { sesion } = await ent.crearSesionHoy(ci({ diaPlan: 4 }));
  est.cambiar(S => { const s = S.sesiones[sesion.id]; s.estado = 'hecha'; s.terminada = new Date().toISOString(); s.ejercicios.forEach(x => x.sets.forEach(z => { z.hecha = true; z.valor = '10'; })); });
  const hechos = ent.estadoDias(est.estado()).filter(d => d.estado === 'hecho');
  assert.equal(hechos.length, 1, hechos.map(d => d.diaSemana).join(','));
});

test('una rehabilitación rechazada después del plan no aparece en la sesión', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'rodilla', dolor: 2, activa: true }] });
  const d = ent.planReglas(S, { dias: [3], minutos: 60, lugares: ['gym'] }).dias[0];
  const rehab = d.ejercicios.find(x => x.rol === 'rehab').id;
  S.perfil.gustos[rehab] = 'rechazo';
  assert.ok(!ids(ent.ajustarAlCheckin(S, d, ci({ dolorHoy: { rodilla: 2 } })).datos).includes(rehab));
});

test('con dolor 5 hoy no queda ninguna rehabilitación contraindicada', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'rodilla', dolor: 2, activa: true }] });
  const d = ent.planReglas(S, { dias: [3], minutos: 60, lugares: ['gym'] }).dias[0];
  const r = ent.ajustarAlCheckin(S, d, ci({ dolorHoy: { rodilla: 5 } }));
  const niv = cat.nivelesZona(S.perfil, { rodilla: 5 });
  assert.deepEqual(r.datos.ejercicios.filter(x => cat.riesgo(cat.ex(x.id), niv) === 'evitar').map(x => x.id), []);
});

test('una lesión nueva tras el plan añade su rehabilitación y quita tareas contraindicadas', () => {
  const S = nuevoS({ objetivos: ['musculo'] });
  const d = ent.planReglas(S, { dias: [3], minutos: 60, lugares: ['gym'] }).dias[0];
  S.perfil.lesiones.push({ id: 'h', zona: 'hombro', dolor: 6, activa: true });
  const r = ent.ajustarAlCheckin(S, d, ci({ dolorHoy: { hombro: 6 } }));
  const niv = cat.nivelesZona(S.perfil, { hombro: 6 });
  assert.ok(r.datos.ejercicios.some(x => x.rol === 'rehab'), 'sin rehabilitación de hombro');
  const tareas = [...r.datos.calentamiento, ...r.datos.vuelta].filter(t => t.id && cat.riesgo(cat.ex(t.id), niv) === 'evitar').map(t => t.id);
  assert.deepEqual(tareas, []);
});

test('quitar material y bajar de nivel rehace los días pendientes', () => {
  const S = nuevoS({ objetivos: ['musculo'], lugares: ['casa'], nivel: 3, materialCasa: ['mancuernas', 'banda', 'banco', 'barra fija'] });
  const d = ent.planReglas(S, { dias: [3], minutos: 60, lugares: ['casa'] }).dias[0];
  S.perfil.materialCasa = []; S.perfil.nivel = 1;
  const r = ent.ajustarAlCheckin(S, d, ci({ lugar: 'casa' }));
  const posibles = new Set(cat.disponibles(S.perfil, 'casa').map(e => e.id));
  assert.deepEqual(ids(r.datos).filter(id => !posibles.has(id)), []);
});

test('un día de piscina hecho en el gimnasio usa la plantilla del gimnasio', () => {
  const S = nuevoS({ objetivos: ['natacion'], lugares: ['gym', 'piscina'] });
  const p = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym', 'piscina'] });
  const dp = p.dias.find(d => d.lugar === 'piscina');
  const r = ent.ajustarAlCheckin(S, dp, ci({ lugar: 'gym' }));
  // Hoy sale solo trabajo de glúteo (el «equivalente» del agua) y se queda muy corta para 60 minutos.
  assert.ok(ent.tiempoSesion(r.datos) >= 60 * 0.7, `${ent.tiempoSesion(r.datos)} min: ${ids(r.datos).join(', ')}`);
});

test('una zona de dolor desconocida no rompe el check-in', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'a', zona: 'espalda_alta', dolor: 6, activa: true }] });
  assert.doesNotThrow(() => ent.ajustarAlCheckin(S, null, ci({ dolorHoy: { espalda_alta: 9 } })));
});

test('con dolor 9 no se sube de peso en ningún ejercicio', () => {
  const S = nuevoS({ objetivos: ['musculo'], lesiones: [{ id: 'l', zona: 'lumbar', dolor: 3, activa: true }] });
  const d = new Date(Date.now() - 5 * 864e5);
  S.sesiones.h = { id: 'h', fecha: est.hoyISO(d), terminada: d.toISOString(), estado: 'hecha', lugar: 'gym', ejercicios: [{ id: 'jalon-pecho', sets: [[40, 12], [40, 12], [40, 12]].map(([kg, v]) => ({ kg, valor: String(v), hecha: true })) }] };
  const r = ent.ajustarAlCheckin(S, null, ci({ dolorHoy: { lumbar: 9 }, minutos: 30 }));
  assert.deepEqual(r.datos.ejercicios.filter(x => /^Sube/.test(x.motivo || '')).map(x => x.id), []);
});

test('al sustituir un ejercicio por dolor, la dosis sigue el tipo del nuevo (reps ↔ tiempo)', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2 });
  const d = { nombre: 'x', lugar: 'gym', minutos: 60, tipo: 'fullA', calentamiento: [{ nombre: 'a' }], vuelta: [{ nombre: 'b' }], explicacion: [], ejercicios: [{ id: 'plancha', rol: 'principal', series: 4, reps: '6-10', descanso: 120 }] };
  const r = ent.ajustarAlCheckin(S, d, ci({ dolorHoy: { lumbar: 5 }, minutos: 30 }));
  const x = r.datos.ejercicios.find(x => /en lugar de/i.test(x.nota || ''));
  assert.ok(x, 'no hubo sustitución');
  const e = cat.ex(x.id);
  const u = (prog.rango(x.reps) || {}).u || '';
  assert.ok(e.t === 'tiempo' ? ['s', 'min'].includes(u) : e.t === 'reps' ? u === '' : u === 'm', `${x.id}[${e.t}] con ${x.reps}`);
});
