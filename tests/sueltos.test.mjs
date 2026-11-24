// Ejercicio suelto (decisión de Víctor del 24-11-2026; docs/criterio.md C-SUELTO-1 a C-SUELTO-5): seguridad,
// propuesta con la progresión de siempre, forma (origen 'suelto'), que cuenta para el progreso del ejercicio y no
// como sesión (ni sesión de hoy, ni plan, ni constancia), y que una a medias no estorba a la sesión de hoy.
// Fecha fija: miércoles 18-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, est, modelo, prog, analisis, ctx, hecha, ponerRed } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00');
ponerRed(false);
const { normalizarEstado } = await import(modulo('js/nucleo/normalizar.js'));
const { haySesionEnCurso } = await import(modulo('js/nucleo/version.js'));
const { NOTA_NIVEL } = await import(modulo('js/areas/entrenador/validar.js'));
const hoy = () => est.hoyISO();
const lesion = (zona, dolor, extra = {}) => ({ id: 'l-' + zona, zona, dolor, activa: true, desde: '2026-01-10', tipo: 'lesion', ...extra });
const S0 = (perfil = {}) => { const S = nuevoS({ lugares: ['gym'], ...perfil }); return S; };

// ── Forma ──
test('C-SUELTO-1 · forma: origen «suelto» en crearSesion y en el normalizador; esSuelta', () => {
  const s = modelo.crearSesion({ nombre: 'X', lugar: 'gym', ejercicios: [{ id: 'plancha', rol: 'principal' }], origen: { tipo: 'suelto', id: 'basura', otro: 1 } });
  assert.deepEqual(s.origen, { tipo: 'suelto' });
  assert.equal(modelo.esSuelta(s), true);
  assert.equal(modelo.esSuelta({ origen: { tipo: 'mia', id: 'm1' } }), false);
  assert.equal(modelo.esSuelta(null), false);
  assert.deepEqual(modelo.origenSesion({ tipo: 'raro' }), {});
});

test('C-SUELTO-1 · el normalizador conserva el origen suelto y nunca deja que ocupe un día del plan', () => {
  const S = S0();
  const r = ent.empezarSuelto('plancha');
  const datos = JSON.parse(JSON.stringify(est.estado()));
  datos.plan = { semana: modelo.semanaISO(new Date()), creado: new Date().toISOString(), fuente: 'reglas', dias: [], hechos: { 3: r.sesion.id } };
  const { estado } = normalizarEstado(datos);
  assert.deepEqual(estado.sesiones[r.sesion.id].origen, { tipo: 'suelto' });
  assert.deepEqual(estado.plan.hechos, {});
  assert.ok(S);
});

// ── Seguridad (C-SUELTO-2) ──
test('C-SUELTO-2 · sin lesiones ni dolor se puede; con el hombro a 5 (B2), lo que lo carga no', () => {
  const S = S0();
  assert.equal(ent.evaluarSuelto(S, 'press-banca-mancuernas').bloqueo, null);
  S.perfil.lesiones.push(lesion('hombro', 5));
  const b = ent.evaluarSuelto(est.estado(), 'press-banca-mancuernas').bloqueo;
  assert.equal(b.motivo, 'zona');
  assert.match(b.texto, /Carga tu hombro/);
  assert.match(b.texto, /5\/10/);
  assert.equal(ent.empezarSuelto('press-banca-mancuernas').bloqueo.motivo, 'zona');
  assert.equal(Object.keys(est.estado().sesiones).length, 0, 'no se crea nada');
  // Lo que no carga el hombro sí
  assert.equal(ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo, null);
});

test('C-SUELTO-2 · lo que la ficha dice evitar (r=2) no se hace aunque duela poco; r=1 en B1 sí, con cuidado', () => {
  const S = S0();
  S.perfil.lesiones.push(lesion('codo', 1));
  assert.equal(ent.evaluarSuelto(est.estado(), 'curl-mancuernas').bloqueo.motivo, 'zona'); // codo r=2
  S.perfil.lesiones = [lesion('hombro', 2)];
  const ev = ent.evaluarSuelto(est.estado(), 'press-pecho-maquina'); // hombro r=1, B1 crónica
  assert.equal(ev.bloqueo, null);
  assert.ok(ev.avisos.some(t => /^Con cuidado: carga tu hombro/.test(t)), ev.avisos.join(' | '));
  // La dosis «con precaución» (C-DOSIS-4) va en el ejercicio
  const x = ent.propuestaSuelto(est.estado(), 'press-pecho-maquina');
  assert.match(x.nota, /Con precaución por tu hombro \(2\/10\)/);
  assert.ok(prog.rango(x.reps).lo >= 10, x.reps);
});

test('C-SUELTO-2 · lesión reciente con dolor 2-3 cuenta como B2 (C-LES-2): no deja cargar la zona', () => {
  const S = S0();
  S.perfil.lesiones.push(lesion('rodilla', 3, { desde: '2026-11-10' }));
  const b = ent.evaluarSuelto(est.estado(), 'prensa-piernas').bloqueo;
  assert.equal(b.motivo, 'zona');
  assert.match(b.texto, /molestia reciente/);
});

test('C-SUELTO-2 · dolor de 7 o más en cualquier zona (reciente o de ficha): ningún ejercicio suelto', () => {
  const S = S0();
  S.dolor.push({ fecha: hoy(), zona: 'lumbar', dolor: 8, momento: 'despues' });
  const b = ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo;
  assert.equal(b.motivo, 'dolorAlto');
  assert.match(b.texto, /lumbar está a 8\/10/);
  assert.doesNotMatch(b.texto, /Perfil › Lesiones/);
  // Hace más de 3 días ya no vale como dolor de hoy
  S.dolor[0].fecha = '2026-11-10';
  assert.equal(ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo, null);
  // Ficha a 8 sin nada reciente: también, y dice dónde cambiarlo
  S.perfil.lesiones.push(lesion('rodilla', 8));
  const f = ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo;
  assert.equal(f.motivo, 'dolorAlto');
  assert.match(f.texto, /Perfil › Lesiones/);
  // Con un check-in reciente más bajo, manda el reciente
  S.dolor.push({ fecha: hoy(), zona: 'rodilla', dolor: 2, momento: 'antes' });
  assert.equal(ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo, null);
  // Una lesión traída con el dolor por revisar: como mucho 6 (decisión 11)
  S.perfil.lesiones = [lesion('lumbar', 9, { dolorRevisar: true })]; S.dolor = [];
  assert.equal(ent.dolorParaSuelto(est.estado()).lumbar.dolor, 6);
  assert.notEqual((ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo || {}).motivo, 'dolorAlto');
});

test('C-SUELTO-2 · señal de alarma hoy, salud «solo suave» o natación sin saber nadar: no', () => {
  const S = S0({ lugares: ['gym', 'piscina'] });
  S.perfil.nadar25 = false;
  assert.equal(ent.evaluarSuelto(est.estado(), 'nado-continuo').bloqueo.motivo, 'nadar');
  S.perfil.salud = { hipertension: 'sin_controlar' };
  const s = ent.evaluarSuelto(est.estado(), 'press-pecho-maquina').bloqueo;
  assert.equal(s.motivo, 'salud');
  assert.match(s.texto, /tensión no está controlada/);
  S.perfil.salud = {};
  S.alarmas = [{ fecha: hoy(), respuesta: 'si', frase: 'x' }];
  assert.equal(ent.evaluarSuelto(est.estado(), 'press-pecho-maquina').bloqueo.motivo, 'alarma');
});

test('C-SUELTO-3 · nivel superior: se puede, con la nota de técnica; «No lo quiero»: se puede, con aviso', () => {
  const S = S0({ nivel: 1 });
  const ev = ent.evaluarSuelto(S, 'press-banca-barra');
  assert.equal(ev.bloqueo, null);
  assert.ok(ev.avisos.includes(NOTA_NIVEL));
  assert.match(ent.propuestaSuelto(S, 'press-banca-barra').nota, /nivel más alto/);
  S.perfil.gustos['press-pecho-maquina'] = 'rechazo';
  const r = ent.evaluarSuelto(est.estado(), 'press-pecho-maquina');
  assert.equal(r.bloqueo, null);
  assert.ok(r.avisos.some(t => /No lo quiero/.test(t)));
  const { sesion } = ent.empezarSuelto('press-pecho-maquina');
  assert.ok(sesion.explicacion.some(t => /No lo quiero/.test(t)));
});

// ── Propuesta (C-SUELTO-3) ──
test('C-SUELTO-3 · propuesta: sin historial, kilos vacíos y «primera vez»; con el tope en todas, sube un paso', () => {
  const S = S0({ nivel: 2 });
  const p = ent.propuestaSuelto(S, 'press-pecho-maquina');
  assert.equal(p.kg, null);
  assert.match(p.motivo, /Primera vez/);
  assert.ok(p.series >= 1 && p.series <= prog.topeSeries(2));
  assert.ok(p.descanso > 0);
  hecha(S, 4, [{ id: 'press-pecho-maquina', reps: p.reps, sets: [[40, prog.rango(p.reps).hi], [40, prog.rango(p.reps).hi], [40, prog.rango(p.reps).hi]] }]);
  const q = ent.propuestaSuelto(est.estado(), 'press-pecho-maquina');
  assert.equal(q.kg, 42.5);
});

// ── Empezar, seguir y terminar ──
test('C-SUELTO-1 · empezar: un ejercicio, sin calentamiento ni vuelta; no es la sesión de hoy ni toca el plan', () => {
  const S = S0();
  S.plan = { semana: modelo.semanaISO(new Date()), creado: new Date().toISOString(), fuente: 'reglas', dias: [], hechos: {} };
  const r = ent.empezarSuelto('press-pecho-maquina');
  assert.equal(r.seguir, false);
  const s = est.estado().sesiones[r.sesion.id];
  assert.deepEqual(s.origen, { tipo: 'suelto' });
  assert.equal(s.ejercicios.length, 1);
  assert.deepEqual([s.calentamiento.length, s.vuelta.length], [0, 0]);
  assert.equal(s.foco, 'Ejercicio suelto');
  assert.match(s.explicacion[0], /no como una sesión de tu semana/);
  assert.equal(modelo.sesionDeHoy(est.estado()), null);
  assert.deepEqual(est.estado().plan.hechos, {});
  // Otra vez: sigue con el mismo (de hoy, sin empezar)
  assert.equal(ent.empezarSuelto('press-pecho-maquina').sesion.id, s.id);
  assert.equal(Object.keys(est.estado().sesiones).length, 1);
});

test('C-SUELTO-1 · uno viejo sin nada apuntado se cambia por uno nuevo; uno a medias se sigue', () => {
  const S = S0();
  const viejo = ent.empezarSuelto('plancha').sesion;
  est.cambiar(X => { X.sesiones[viejo.id].fecha = '2026-11-10'; }, 'sesion');
  const nuevo = ent.empezarSuelto('plancha').sesion;
  assert.notEqual(nuevo.id, viejo.id);
  assert.equal(est.estado().sesiones[viejo.id], undefined);
  est.cambiar(X => { const s = X.sesiones[nuevo.id]; s.fecha = '2026-11-10'; s.estado = 'en_curso'; s.ejercicios[0].sets[0].hecha = true; s.ejercicios[0].sets[0].valor = '30'; }, 'sesion');
  const r = ent.empezarSuelto('plancha');
  assert.equal(r.sesion.id, nuevo.id);
  assert.equal(r.seguir, true);
  assert.deepEqual(ent.sueltosAMedias(est.estado()).map(s => s.id), [nuevo.id]);
  assert.ok(S);
});

test('C-SUELTO-4 · hecho: cuenta para el progreso del ejercicio (registros, kilos, fuerza, recuperación) y no como sesión', () => {
  const S = S0({ nivel: 2 });
  hecha(S, 10, [{ id: 'remo-maquina', sets: [[30, '10'], [30, '10']] }]); // una sesión normal antes
  const antes = analisis.constancia(est.estado());
  const { sesion } = ent.empezarSuelto('press-pecho-maquina');
  est.cambiar(X => {
    const s = X.sesiones[sesion.id];
    s.ejercicios[0].sets.forEach(z => { z.kg = 50; z.valor = '12'; z.hecha = true; });
    Object.assign(s, { estado: 'hecha', empezada: new Date().toISOString(), terminada: new Date().toISOString(), cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  }, 'sesion');
  const S1 = est.estado();
  // Progreso del ejercicio
  const regs = prog.registros(S1, 'press-pecho-maquina');
  assert.equal(regs.length, 1);
  assert.equal(regs[0].sets[0].kg, 50);
  assert.ok(analisis.fuerza(S1).filas.some(f => f.id === 'press-pecho-maquina'));
  assert.ok(ent.propuestaSuelto(S1, 'press-pecho-maquina').kg >= 50, 'la próxima vez parte de esos 50 kg');
  assert.ok(prog.cargaMuscular(S1).pecho, 'el pecho queda cargado (C-REC)');
  // No es una sesión
  assert.equal(prog.sesionesHechas(S1).length, 1);
  assert.equal(prog.hechasConSueltos(S1).length, 2);
  const c = analisis.constancia(S1);
  assert.equal(c.total, antes.total);
  assert.equal(c.estaSemana, antes.estaSemana);
  assert.equal(modelo.sesionDeHoy(S1), null);
  assert.equal(ctx.historialParaIA(S1, []).sesionesUltimos14dias.length, 1, 'a la IA solo van las sesiones');
  assert.ok(ctx.historialParaIA(S1, ['press-pecho-maquina']).progreso.length === 1, 'pero sí el progreso del ejercicio');
});

test('C-SUELTO-1 · uno a medias no estorba a la sesión de hoy: ni la para ni se borra al prepararla', async () => {
  const S = S0();
  const pend = ent.empezarSuelto('plancha').sesion;
  const enCurso = ent.empezarSuelto('press-pecho-maquina').sesion;
  est.cambiar(X => { const s = X.sesiones[enCurso.id]; s.estado = 'en_curso'; s.empezada = new Date().toISOString(); s.ejercicios[0].sets[0].hecha = true; }, 'sesion');
  const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 45, energia: 3, dolorHoy: {}, peticion: '' });
  assert.ok(r.sesion && !r.descartada, JSON.stringify(r).slice(0, 200));
  const S1 = est.estado();
  assert.ok(S1.sesiones[pend.id], 'el suelto pendiente sigue');
  assert.ok(S1.sesiones[enCurso.id], 'el suelto en marcha sigue');
  assert.equal(modelo.sesionDeHoy(S1).id, r.sesion.id);
  assert.ok(S);
});

test('C-SUELTO-1 · versión nueva: un suelto en marcha solo la retiene 6 horas', () => {
  const S = S0();
  const { sesion } = ent.empezarSuelto('plancha');
  est.cambiar(X => { const s = X.sesiones[sesion.id]; s.estado = 'en_curso'; s.empezada = new Date(Date.now() - 3600e3).toISOString(); }, 'sesion');
  assert.equal(haySesionEnCurso(est.estado()), true);
  est.cambiar(X => { X.sesiones[sesion.id].empezada = new Date(Date.now() - 7 * 3600e3).toISOString(); }, 'sesion');
  assert.equal(haySesionEnCurso(est.estado()), false);
  assert.ok(S);
});

test('C-SUELTO-1 · el dolor de partida va en checkin.dolor y no cuenta como check-in para el siguiente', () => {
  const S = S0();
  S.perfil.lesiones.push(lesion('hombro', 2));
  const { sesion } = ent.empezarSuelto('curl-femoral-sentado');
  assert.deepEqual(sesion.checkin.dolor, { hombro: 2 });
  assert.equal(ent.dolorReciente(est.estado(), 'hombro'), null, 'el check-in sigue partiendo de la ficha');
});

// ── Revisión del PR #56 ──
test('N1 · el «dolor durante» de «Algo va mal» (rodilla 8 en una sesión aún abierta) bloquea el suelto', () => {
  const S = S0();
  S.perfil.lesiones.push(lesion('rodilla', 2));
  const set = () => ({ kg: 40, valor: '10', hecha: true });
  S.sesiones.h1 = { id: 'h1', fecha: hoy(), creada: new Date(Date.now() - 3600e3).toISOString(), fuente: 'reglas', nombre: 'Pierna', lugar: 'gym', estado: 'en_curso', empezada: new Date(Date.now() - 1800e3).toISOString(),
    checkin: { energia: 3, dolor: { rodilla: 2 } }, calentamiento: [], vuelta: [], explicacion: [], cierre: null,
    ejercicios: [{ id: 'prensa-piernas', rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 40, sets: [set(), { kg: 40, valor: '', hecha: false }], dolorDurante: { zona: 'rodilla', dolor: 8, antes: 2, techo: 3 }, comentario: '', gusto: null }] };
  assert.equal(ent.dolorParaSuelto(est.estado()).rodilla.dolor, 8);
  const r = ent.empezarSuelto('prensa-piernas');
  assert.equal(r.bloqueo && r.bloqueo.motivo, 'dolorAlto');
  assert.equal(ent.evaluarSuelto(est.estado(), 'curl-femoral-sentado').bloqueo.motivo, 'dolorAlto');
});

test('N1 · un ejercicio parado hoy por dolor no se puede hacer suelto ese día (C-DOLOR-6), aunque el dolor sea bajo', () => {
  const S = S0();
  S.sesiones.h1 = { id: 'h1', fecha: hoy(), creada: new Date().toISOString(), fuente: 'reglas', nombre: 'Torso', lugar: 'gym', estado: 'en_curso', empezada: new Date().toISOString(),
    checkin: { energia: 3, dolor: {} }, calentamiento: [], vuelta: [], explicacion: [], cierre: null,
    ejercicios: [{ id: 'remo-maquina', rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 40, sets: [{ kg: 40, valor: '', hecha: false }], dolorDurante: { zona: 'lumbar', dolor: 3, antes: 0, techo: 3 }, comentario: '', gusto: null }] };
  const b = ent.evaluarSuelto(est.estado(), 'remo-maquina').bloqueo;
  assert.equal(b.motivo, 'parado');
  assert.match(b.texto, /hoy no se repite/);
});

test('N2 · las mejoras de los sueltos no cuentan para subir de nivel (C-NIVEL-1)', () => {
  const S = S0({ nivel: 1 });
  for (const id of ['press-pecho-maquina', 'remo-maquina', 'prensa-piernas', 'jalon-pecho']) {
    [20, 13, 6].forEach((dias, k) => { const sid = hecha(S, dias, [{ id, sets: [[40 + k * 3, 10], [40 + k * 3, 10]] }]); S.sesiones[sid].origen = { tipo: 'suelto' }; });
  }
  const crit = ctx.medidorNivel(est.estado()).criterios.find(c => /mejorados/.test(c.que));
  assert.equal(crit.ok, false);
  assert.equal(crit.valor, '0');
});

test('N3 · un comentario en un suelto cuenta como «comentarios tuyos que leer» igual que en una sesión', () => {
  ponerRed(true);
  try {
    const S = S0();
    const sid = hecha(S, 1, [{ id: 'press-pecho-maquina', sets: [[40, 10]], comentario: 'me duele el hombro al bajar' }]);
    S.sesiones[sid].origen = { tipo: 'suelto' };
    const m1 = ent.motivoIA(est.estado(), { lugar: 'gym', dolorHoy: {}, peticion: '' });
    delete S.sesiones[sid].origen;
    const m2 = ent.motivoIA(est.estado(), { lugar: 'gym', dolorHoy: {}, peticion: '' });
    assert.match(m1.motivo, /comentarios/);
    assert.equal(m1.motivo, m2.motivo);
  } finally { ponerRed(false); }
});

test('H2 · al confirmar una alarma los sueltos abiertos se cierran: lo hecho, «parada: alarma»; sin nada, se borran', async () => {
  const S = S0();
  const a1 = ent.empezarSuelto('plancha').sesion;
  const a2 = ent.empezarSuelto('press-pecho-maquina').sesion;
  est.cambiar(X => { const s = X.sesiones[a1.id]; s.estado = 'en_curso'; s.empezada = new Date().toISOString(); s.ejercicios[0].sets[0].hecha = true; s.ejercicios[0].sets[0].valor = '30';
    X.sesiones[a2.id].estado = 'en_curso'; }, 'sesion');
  const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 45, energia: 3, dolorHoy: {}, peticion: '', alarma: true });
  assert.ok(r.alarma);
  const S1 = est.estado();
  assert.equal(S1.sesiones[a1.id].estado, 'hecha');
  assert.equal(S1.sesiones[a1.id].parada, 'alarma');
  assert.equal(S1.sesiones[a2.id], undefined);
  assert.equal(ent.evaluarSuelto(S1, 'plancha').bloqueo.motivo, 'alarma');
  assert.ok(S);
});
