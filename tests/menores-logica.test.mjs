// Fallos menores de lógica pendientes antes del lanzamiento (docs/qa/informe-2026-11-21.md §M1-M21, la
// re-auditoría de docs/qa/reauditoria/ y su verificación del 22-11). Las pantallas van aparte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, est, ponerRed, hecha } from './ayuda/node.mjs';

const reloj = fijarFecha('2026-11-21T10:00'); // sábado
const { tiempoSesion } = await import(modulo('js/areas/entrenador/dia.js'));
const { hoyISO } = await import(modulo('js/nucleo/estado.js'));

// ── M1 · C-TIEMPO-1: la vista previa del plan no promete más minutos de los pedidos ──
test('M1, M1b, C-TIEMPO-1: los días del plan por reglas no pasan de los minutos pedidos (decisión del 23-11)', () => {
  const mal = [];
  for (const objetivos of [['musculo'], ['fuerza'], ['salud'], ['perder'], ['musculo', 'salud']])
    for (const nivel of [1, 2, 3]) for (const lugares of [['gym'], ['gym', 'piscina'], ['casa'], ['calle']])
      for (const minutos of [45, 60, 90]) {
        const S = nuevoS({ objetivos, nivel, lugares });
        for (const d of ent.planReglas(S, { dias: [1, 3, 5, 6], minutos, lugares }).dias)
          if (tiempoSesion(d) > minutos) mal.push(`${objetivos} n${nivel} ${lugares} ${minutos}: ${d.nombre} ${tiempoSesion(d)}`);
      }
  assert.deepEqual(mal, []);
});

// ── M2 · «Volver a ajustarla» sustituye la sesión de hoy sin tocar: no quedan huérfanas ──
test('M2: preparar otra vez la sesión de hoy sustituye la pendiente sin tocar y la que tiene algo hecho se queda', async () => {
  ponerRed(false);
  nuevoS({ objetivos: ['musculo'], nivel: 2 });
  await ent.crearPlanSemana({ dias: [6, 7], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const ci = { diaPlan: 6, lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '' };
  const a = (await ent.crearSesionHoy(ci)).sesion;
  reloj.avanzar(60e3);
  const b = (await ent.crearSesionHoy(ci)).sesion;
  reloj.avanzar(60e3);
  const c = (await ent.crearSesionHoy({ ...ci, energia: 2 })).sesion;
  const deHoy = () => Object.values(est.estado().sesiones).filter(s => s.fecha === hoyISO());
  assert.deepEqual(deHoy().map(s => s.id), [c.id], 'solo queda la última');
  assert.ok(![a.id, b.id].includes(est.estado().plan.hechos[6]));
  assert.equal(est.estado().plan.hechos[6], c.id);
  // Con una serie marcada, la anterior no se borra (no se pierde nada de lo hecho).
  est.cambiar(S => { S.sesiones[c.id].ejercicios[0].sets[0].hecha = true; }, 'sesion');
  reloj.avanzar(60e3);
  const d = (await ent.crearSesionHoy(ci)).sesion;
  assert.deepEqual(deHoy().map(s => s.id).sort(), [c.id, d.id].sort());
});

// ── M6 · T8: el tiempo que lleva la lesión nueva sale de su fecha, en días si no llega a una semana ──
test('M6, T8: una lesión apuntada hoy no «lleva 1 semana»; con días se dice en días y desde 7 en semanas', () => {
  const texto = desde => {
    const S = nuevoS({ objetivos: ['salud'], lesiones: [{ id: 'l1', zona: 'rodilla', dolor: 4, desde, nota: '', activa: true }] });
    return ent.ajustarAlCheckin(S, null, { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: { rodilla: 4 } }).cambios.find(t => /^Tu rodilla/.test(t)) || '';
  };
  assert.match(texto('2026-11-21'), /^Tu rodilla tiene dolor 4\/10 desde hoy: nada que la cargue/);
  assert.match(texto('2026-11-20'), /^Tu rodilla lleva 1 día con dolor 4\/10: hoy nada que la cargue/);
  assert.match(texto('2026-11-17'), /^Tu rodilla lleva 4 días con dolor 4\/10/);
  assert.match(texto('2026-11-14'), /^Tu rodilla lleva 1 semana con dolor 4\/10/);
  assert.match(texto('2026-11-04'), /^Tu rodilla lleva 2 semanas con dolor 4\/10/);
});

// ── M10 · check-in abierto antes de medianoche y preparado después ──
test('M10: si el check-in del día de hoy se abrió ayer y hoy toca otro día del plan, la sesión es la de hoy, con su lugar y sus minutos', async () => {
  ponerRed(false);
  const r = fijarFecha('2026-11-21T23:40'); // sábado
  nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym', 'piscina'] });
  await ent.crearPlanSemana({ dias: [6, 7], minutos: 45, lugares: ['gym', 'piscina'] }, { conIA: false });
  est.cambiar(S => { const d = S.plan.dias.find(x => x.diaSemana === 7); d.lugar = 'piscina'; d.minutos = 30; d.tipo = 'piscina'; }, 'plan');
  const d6 = est.estado().plan.dias.find(d => d.diaSemana === 6);
  const ci = { abierto: hoyISO(), diaPorDefecto: true, diaPlan: 6, lugar: d6.lugar, minutos: d6.minutos || 45, energia: 3, dolorHoy: {}, peticion: '' };
  r.avanzar(22 * 60e3); // domingo 00:02
  const res = await ent.crearSesionHoy(ci);
  const s = res.sesion, p = est.estado().plan;
  assert.equal(s.fecha, '2026-11-22');
  assert.equal(p.hechos[7], s.id, 'ocupa el domingo');
  assert.equal(p.hechos[6], undefined, 'el sábado no queda ocupado por una sesión del domingo');
  assert.equal(s.lugar, 'piscina', 'con el lugar del domingo');
  assert.equal(s.minutos, 30, 'y sus minutos');
  assert.match(res.aviso, /^Ya es domingo: te preparo el día de hoy\./);
  // Lo que se cambió en el check-in (los minutos) se respeta; lo demás es del domingo.
  const otro = await ent.crearSesionHoy({ ...ci, minutos: 60 });
  assert.equal(otro.sesion.lugar, 'piscina');
  assert.equal(otro.sesion.minutos, 60);
  // Un día elegido a propósito (no el de hoy de entonces) se respeta: hacer el del sábado el domingo.
  const s2 = (await ent.crearSesionHoy({ ...ci, diaPorDefecto: false })).sesion;
  assert.equal(est.estado().plan.hechos[6], s2.id);
  r.restaurar(); fijarFecha('2026-11-21T10:00');
});

// ── M11 · C-LES-3: el dolor nuevo del check-in se puede guardar como lesión puntual al terminar ──
test('M11, C-LES-3: zonas con dolor sin lesión en el check-in de la sesión y guardarlas como molestia puntual de hoy', async () => {
  ponerRed(false);
  nuevoS({ objetivos: ['salud'], lesiones: [{ id: 'l1', zona: 'hombro', dolor: 3, desde: '2026-10-01', nota: '', activa: true }] });
  const s = (await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: { hombro: 2, rodilla: 4, lumbar: 0 }, peticion: '' })).sesion;
  assert.deepEqual(ent.dolorNuevoSinLesion(est.estado(), s), [{ zona: 'rodilla', dolor: 4 }]);
  ent.guardarDolorComoLesion('rodilla', 4);
  const l = est.estado().perfil.lesiones.find(x => x.zona === 'rodilla');
  assert.deepEqual({ ...l, id: 'x' }, { id: 'x', zona: 'rodilla', dolor: 4, desde: '2026-11-21', nota: '', activa: true, tipo: 'puntual' });
  assert.deepEqual(ent.dolorNuevoSinLesion(est.estado(), s), [], 'ya guardada, no se vuelve a ofrecer');
  ent.guardarDolorComoLesion('rodilla', 5);
  assert.equal(est.estado().perfil.lesiones.filter(x => x.zona === 'rodilla').length, 1, 'no se duplica');
  ent.guardarDolorComoLesion('nariz', 5);
  assert.equal(est.estado().perfil.lesiones.length, 2, 'zona desconocida: nada');
});

test('M11 (revisión del PR #53): con una lesión inactiva de la zona se reactiva, con la fecha de la sesión', () => {
  nuevoS({ objetivos: ['salud'], lesiones: [{ id: 'vieja', zona: 'rodilla', dolor: 2, desde: '2025-03-01', nota: 'menisco', activa: false, tipo: 'lesion' }] });
  ent.guardarDolorComoLesion('rodilla', 5, '2026-11-20');
  const ls = est.estado().perfil.lesiones;
  assert.equal(ls.length, 1);
  assert.deepEqual({ id: ls[0].id, activa: ls[0].activa, dolor: ls[0].dolor, desde: ls[0].desde, nota: ls[0].nota }, { id: 'vieja', activa: true, dolor: 5, desde: '2026-11-20', nota: 'menisco' });
});

// ── Verificación del 22-11 · el nombre de la IA no contradice lo que lleva la sesión ──
const T_ = (n, d = '5 min', id = '') => ({ id, nombre: n, detalle: '', duracion: d });
const E_ = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
const sesionIA = o => ({ nombre: 'Torso', foco: 'x', cambios: [], explicacion: [], calentamiento: [T_('Bici suave', '5 min', 'bici-estatica'), T_('Movilidad de hombros', '3 min')],
  ejercicios: [E_('press-pecho-maquina'), E_('jalon-pecho'), E_('prensa-piernas'), E_('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })],
  vueltaCalma: [T_('Estiramiento de pecho', '2 min'), T_('Estiramiento de cuádriceps', '2 min')], ...o });
async function conIA(sesion, ci = {}, perfil = { objetivos: ['musculo'], nivel: 2 }) {
  nuevoS(perfil);
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion }) }));
  try { return (await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true, ...ci })).sesion; } finally { ponerRed(false); }
}
test('Verificación 22-11: un nombre de la IA que contradice los principales pasa a «Cuerpo completo»; sin falsos positivos', async () => {
  const pierna = [E_('press-pecho-maquina'), E_('prensa-piernas'), E_('curl-femoral-tumbado'), E_('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })];
  const s = await conIA(sesionIA({ ejercicios: pierna }));
  assert.equal(s.fuente, 'ia');
  assert.equal(s.nombre, 'Cuerpo completo');
  assert.doesNotMatch(s.explicacion[0], /torso/i, s.explicacion[0]);
  assert.equal((await conIA(sesionIA({ nombre: 'Torso B', ejercicios: pierna }))).nombre, 'Cuerpo completo B', 'conserva la letra del día');
  // Un solo principal del otro tren entre tres: el nombre se queda (revisión del PR #53).
  assert.equal((await conIA(sesionIA())).nombre, 'Torso');
  const s2 = await conIA(sesionIA({ ejercicios: [E_('press-pecho-maquina'), E_('jalon-pecho'), E_('press-hombro-maquina'), E_('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })] }));
  assert.equal(s2.nombre, 'Torso');
  assert.match((await conIA(sesionIA({ nombre: 'Pierna y glúteo', ejercicios: [E_('press-pecho-maquina'), E_('jalon-pecho'), E_('prensa-piernas'), E_('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })] }))).nombre, /^Cuerpo completo/);
  // Cadena posterior con «Espalda» o «Tirón» (CR-05, peso muerto rumano): cuadra.
  const { nombreCoherente } = await import(modulo('js/areas/entrenador/dia.js'));
  const P = id => ({ id, rol: 'principal' });
  assert.equal(nombreCoherente('Espalda, core y rehabilitación', [P('jalon-pecho'), P('hiperextension-45'), P('plancha')]), 'Espalda, core y rehabilitación');
  assert.equal(nombreCoherente('Tirón', [P('jalon-pecho'), P('remo-sentado-polea'), P('peso-muerto-rumano')]), 'Tirón');
});

// ── Verificación del 22-11 · «a tope, sprint final» choca con el 7 de 10 de los intervalos (C-CARDIO-4) ──
test('Verificación 22-11, C-CARDIO-4: una nota de cardio de la IA con esfuerzo máximo pasa a la de la regla; una con 7 de 10 se queda', async () => {
  const conNota = nota => conIA(sesionIA({ nombre: 'Cuerpo completo', ejercicios: [E_('press-pecho-maquina'), E_('jalon-pecho'), E_('prensa-piernas'), E_('bici-estatica', 'cardio', { series: 1, reps: '20 min', descanso: 0, nota })] }), { energia: 4 }, { objetivos: ['perder'], nivel: 2, datos: { sexo: 'h', nacimiento: '1985' } })
    .then(s => s.ejercicios.find(x => x.rol === 'cardio').nota);
  const mal = await conNota('Intervalos: 8 × 1 min a tope con 1 min suave, sprint final. Esfuerzo 7 de 10 el resto.');
  assert.doesNotMatch(mal, /a tope|sprint/i, mal);
  assert.match(mal, /7 de 10/);
  for (const nota of ['Esfuerzo 5 de 10, sin sprints.', 'Al 70 %, esfuerzo 6 de 10, nada de ir a tope.', 'Ritmo vivo (6 de 10), nunca a tope.']) assert.equal(await conNota(nota), nota, 'lo negado no cuenta');
  const bien = await conNota('Intervalos: 3 min suaves y 6 × 1 min fuerte (7 de 10) con 2 min suaves.');
  assert.match(bien, /^Intervalos: 3 min suaves y 6 × 1 min fuerte/);
});

// ── Verificación del 22-11 (caso B3 de la sonda) · tareas libres que la app no puede comprobar, también sin zonas ──
test('C-EST-4, C-CAL-1: sin zonas activas, una tarea de la IA que la app no puede comprobar («Burpees») se cambia por una de la app', async () => {
  const s = await conIA(sesionIA({ nombre: 'Cuerpo completo', calentamiento: [T_('Bici suave', '5 min', 'bici-estatica'), T_('Burpees', '3 min', 'burpees-inventado'), T_('Movilidad de hombros', '3 min')],
    vueltaCalma: [T_('Estiramiento de pecho', '2 min'), T_('Saltos al cajón', '2 min')] }));
  assert.equal(s.fuente, 'ia');
  const nombres = [...s.calentamiento, ...s.vuelta].map(t => t.nombre);
  assert.ok(!nombres.some(n => /burpee|cajón/i.test(n)), nombres.join(' · '));
  assert.equal(new Set(s.calentamiento.map(t => t.id).filter(Boolean)).size, s.calentamiento.filter(t => t.id).length, 'sin repetir');
  assert.ok(s.calentamiento.length >= 3, 'la tarea quitada se sustituye por una de la app: ' + s.calentamiento.map(t => t.nombre).join(' · '));
  assert.ok(s.vuelta.length >= 2);
  assert.ok(s.explicacion.some(t => /cambio \d tareas de calentamiento o vuelta que no puedo comprobar por las de la app/.test(t)), s.explicacion.join(' | '));
});

// ── M15 · textos de la lógica ──
test('M15: «1 día», la letra del día en mayúscula al mover, el resumen de la semana tras reorganizar y la nota del cardio', async () => {
  ponerRed(false);
  const S = nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: ['gym', 'piscina'] });
  assert.match(ent.planReglas(S, { dias: [7], minutos: 60, lugares: ['gym'] }).resumen, /^1 día: domingo \(cuerpo completo A\)/);
  const r = fijarFecha('2026-11-17T10:00'); // martes
  nuevoS({ objetivos: ['musculo'], nivel: 1, lugares: ['gym', 'piscina'] });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  const antes = est.estado().plan.dias.map(d => d.nombre);
  const nota = ent.reorganizar([4, 6]);
  assert.deepEqual(antes, ['Cuerpo completo A', 'Cuerpo completo B']);
  assert.equal(nota, 'Muevo miércoles (cuerpo completo A) al jueves y viernes (cuerpo completo B) al sábado.');
  const p = est.estado().plan;
  assert.match(p.resumen, /^2 días: jueves \(cuerpo completo A\) y sábado \(cuerpo completo B\)\./, p.resumen);
  assert.ok(p.resumen.includes(nota), 'y dice lo que se ha movido');
  // La nota del cardio en el gimnasio con piscina: a una persona, con su punto.
  const d = ent.montarDia(est.estado(), { lugar: 'gym', minutos: 60, tipo: 'fullA' });
  const c = d.ejercicios.find(x => x.rol === 'cardio');
  assert.doesNotMatch(c.nota, /os apetece|hacedlo/);
  assert.match(c.nota, /\.\s+Si te apetece, hazlo en la piscina/);
  r.restaurar(); fijarFecha('2026-11-21T10:00');
});

// ── M20 · tras pedírsela a la IA, el aviso dice lo que ha pasado, no lo que se iba a hacer ──
test('M20: con «Pedírsela al entrenador IA» y éxito, el motivo es un resultado; la previa sigue diciendo «Se lo pides»', async () => {
  nuevoS({ objetivos: ['musculo'], nivel: 2 });
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: sesionIA({ nombre: 'Cuerpo completo' }) }) }));
  try {
    assert.equal(ent.previaCheckin({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true }).ia.motivo, 'Se lo pides al entrenador IA.');
    const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true });
    assert.equal(r.sesion.fuente, 'ia');
    assert.equal(r.motivo, 'Te la ha preparado el entrenador IA, como pediste.');
  } finally { ponerRed(false); }
});

test('M15 (revisión): «Parto hace 1 semana», en singular', () => {
  const S = nuevoS({ objetivos: ['salud'], salud: { posparto: 1 } });
  const txt = JSON.stringify(ent.restriccionesSalud(S));
  assert.match(txt, /Parto hace 1 semana:/);
  assert.doesNotMatch(txt, /1 semanas/);
});

// ── Plurales (revisión del agente de interfaz) ──
test('plurales: «1 sesión con datos que no se entienden» y «1 semana» en el medidor de nivel', async () => {
  const { normalizarEstado } = await import(modulo('js/nucleo/normalizar.js'));
  const { medidorNivel } = await import(modulo('js/reglas/contexto.js'));
  const S = nuevoS();
  const n = normalizarEstado({ ...JSON.parse(est.exportar()), sesiones: { x: { id: 'x', fecha: 'nada', ejercicios: 7 } } });
  const av = n.avisos.join(' | ');
  assert.doesNotMatch(av, /\b1 sesiones/, av);
  hecha(S, 3, [{ id: 'press-pecho-maquina', sets: [[40, 10]] }]);
  const txt = JSON.stringify(medidorNivel(S));
  assert.doesNotMatch(txt, /\b1 semanas/, txt);
});

// ── Revisión del PR #53 · los huecos de las tareas libres no empobrecen el calentamiento ni la vuelta ──
test('PR #53: con tareas libres de la IA, vuelta con estiramiento de verdad (no solo flotación), calentamiento completo y sin repetidos', async () => {
  const conTareas = async (perfil, lugar, ejercicios, cal, vue, dolorHoy = {}) => {
    nuevoS(perfil);
    ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: sesionIA({ nombre: 'Cuerpo completo', ejercicios, calentamiento: cal.map(n => T_(n, '2 min')), vueltaCalma: vue.map(n => T_(n, '1 min')) }) }) }));
    try { return (await ent.crearSesionHoy({ lugar, minutos: 60, energia: 3, dolorHoy, peticion: '', forzarIA: true })).sesion; } finally { ponerRed(false); }
  };
  const repetidos = l => l.filter((t, i) => l.slice(0, i).some(y => y.nombre === t.nombre || (t.id && y.id === t.id)));
  // Piscina (C-VUELTA-1): la flotación no basta.
  const p = await conTareas({ objetivos: ['salud'], lugares: ['piscina'] }, 'piscina', [E_('patada-crol-tabla'), E_('elevacion-lateral-pierna-agua'), E_('aquajogging', 'cardio', { series: 1, reps: '15 min', descanso: 0 })], ['Burpees', 'Jumping jacks'], ['Foam roller', 'Yoga flow']);
  assert.equal(p.fuente, 'ia');
  assert.ok(p.vuelta.some(t => /estir/i.test(t.nombre)), p.vuelta.map(t => t.nombre).join(' · '));
  // Casa con el tobillo: la movilidad de la zona sigue en el calentamiento y nada se repite.
  const lesion = { lesiones: [{ id: 'l0', zona: 'tobillo_pie', dolor: 2, activa: true, desde: '2026-01-01' }] };
  const c = await conTareas({ objetivos: ['musculo'], lugares: ['casa'], materialCasa: ['mancuernas', 'banda'], ...lesion }, 'casa', [E_('flexiones-inclinadas'), E_('remo-banda'), E_('puente-gluteo'), E_('marcha-estatica', 'cardio', { series: 1, reps: '15 min', descanso: 0 })], ['Saltos a la comba', 'Rotaciones de hombro'], ['Caminar suave', 'Estiramiento de isquios', 'Meditación'], { tobillo_pie: 2 });
  assert.ok(c.calentamiento.some(t => /tobillo/i.test(t.nombre)), c.calentamiento.map(t => t.nombre).join(' · '));
  assert.deepEqual(repetidos(c.calentamiento), []);
  assert.deepEqual(repetidos(c.vuelta), [], c.vuelta.map(t => t.nombre).join(' · '));
  // Gimnasio con una zona: la aproximación (o series de prueba) del primer compuesto no se pierde (C-CAL-2).
  const g = await conTareas({ objetivos: ['musculo'], lugares: ['gym'], lesiones: [{ id: 'l0', zona: 'hombro', dolor: 1, activa: true, desde: '2026-01-01' }] }, 'gym', [E_('prensa-piernas'), E_('jalon-pecho'), E_('curl-femoral-tumbado'), E_('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })], ['Burpees', 'Jumping jacks'], ['Estiramiento de pecho', 'Respiración'], { hombro: 1 });
  assert.ok(g.calentamiento.some(t => /aproximaci|series de prueba/i.test(t.nombre)), g.calentamiento.map(t => t.nombre).join(' · '));
});

test('PR #53: una nota larga se corta en una frase entera o en un espacio, nunca a mitad de palabra', async () => {
  const { crearSesion, cortarTexto } = await import(modulo('js/nucleo/modelo.js'));
  const frase1 = 'Primera frase larga ' + 'con más texto '.repeat(13).trim() + '.';
  assert.equal(cortarTexto(frase1 + ' ' + 'palabra '.repeat(40), 300), frase1);
  const sinPunto = 'palabra '.repeat(50);
  const c = cortarTexto(sinPunto, 300);
  assert.ok(c.length <= 300 && /palabra…$/.test(c), c);
  assert.equal(cortarTexto('corta', 300), 'corta');
  const s = crearSesion({ nombre: 'x', lugar: 'gym', ejercicios: [{ id: 'bici-estatica', rol: 'cardio', series: 1, reps: '10 min', nota: frase1 + ' ' + 'cincuenta '.repeat(40) }] });
  assert.equal(s.ejercicios[0].nota, frase1);
});

// ── Matriz de la revisión del PR #53 (caso 51): la movilidad del calentamiento no cuenta como rehabilitación que cabe ──
test('PR #53, S5: el validador no suspende su corrección cuando la rehabilitación B1 ya va como movilidad en el calentamiento', async () => {
  // Caso 51 de la matriz con IA tramposa (respuesta tal cual).
  const C = {"perfil": {"objetivos": ["perder"], "lugares": ["casa"], "materialCasa": [], "nivel": 1, "datos": {"nacimiento": "1956-01-01"}}, "les": [{"id": "l0", "zona": "cadera_lateral", "dolor": 2, "activa": true, "desde": "2025-01-01"}, {"id": "l1", "zona": "tobillo_pie", "dolor": 0, "activa": true, "desde": "2026-11-01"}], "ci": {"lugar": "casa", "minutos": 45, "energia": 5, "dolorHoy": {"cadera_lateral": 3, "tobillo_pie": 1}, "peticion": ""}, "r": {"nombre": "IA", "calentamiento": [{"nombre": "Trote", "detalle": "", "duracion": "2 min"}, {"nombre": "Movilidad", "detalle": "", "duracion": "2 min"}], "ejercicios": [{"id": "puente-una-pierna", "rol": "rehab", "series": 3, "reps": "6-8", "descanso": 90, "kg": null, "nota": ""}, {"id": "abduccion-tumbada", "rol": "rehab", "series": 3, "reps": "6-8", "descanso": 90, "kg": null, "nota": ""}, {"id": "plancha-lateral", "rol": "principal", "series": 3, "reps": "8-12", "descanso": 90, "kg": null, "nota": ""}, {"id": "sentadilla-peso-corporal", "rol": "principal", "series": 3, "reps": "8-12", "descanso": 90, "kg": null, "nota": ""}, {"id": "sentadilla-goblet", "rol": "principal", "series": 3, "reps": "8-12", "descanso": 90, "kg": null, "nota": ""}, {"id": "puente-una-pierna", "rol": "principal", "series": 3, "reps": "4-6", "descanso": 30, "kg": null, "nota": ""}, {"id": "abduccion-tumbada", "rol": "principal", "series": 3, "reps": "4-6", "descanso": 30, "kg": null, "nota": ""}, {"id": "abduccion-pie", "rol": "principal", "series": 3, "reps": "4-6", "descanso": 30, "kg": null, "nota": ""}, {"id": "sentadilla-goblet", "rol": "principal", "series": 3, "reps": "4-6", "descanso": 30, "kg": null, "nota": ""}, {"id": "flexiones", "rol": "principal", "series": 8, "reps": "al fallo", "descanso": 90, "kg": null, "nota": ""}, {"id": "flexiones-inclinadas", "rol": "principal", "series": 8, "reps": "al fallo", "descanso": 90, "kg": null, "nota": ""}, {"id": "flexiones-rodillas", "rol": "principal", "series": 8, "reps": "al fallo", "descanso": 90, "kg": null, "nota": ""}, {"id": "bici-estatica", "rol": "cardio", "series": 3, "reps": "30 min", "descanso": 90, "kg": null, "nota": "Intervalos: 8 × 1 min a tope, sprint final"}], "vueltaCalma": [{"nombre": "Estiramiento de isquios tumbado con banda", "detalle": "", "duracion": "1 min"}, {"nombre": "Estiramiento de cuádriceps de pie", "detalle": "", "duracion": "1 min"}, {"nombre": "Estiramiento de gemelo en la pared", "detalle": "", "duracion": "1 min"}, {"nombre": "Estiramiento de pectoral en el marco de la puerta", "detalle": "", "duracion": "1 min"}], "cambios": []}};
  const S = nuevoS(C.perfil);
  S.perfil.lesiones.push(...C.les);
  const ia = await import(modulo('js/areas/entrenador/ia.js'));
  const v = ent.validarSesion(S, ia.sesionDeIA(structuredClone(C.r)), { ...C.ci, origen: 'ia' });
  assert.deepEqual(ent.problemasSesion(S, v.sesion, C.ci), []);
  assert.equal(v.valida, true);
});
