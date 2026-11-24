// Decisiones de Víctor del 24-11-2026 en pantalla (jsdom):
// 1) «Mis sesiones» en Hoy (crear si no hay, elegir una y empezar por el check-in, editar, ver todas) y fuera de Perfil.
// 2) Ejercicio suelto desde la ficha (C-SUELTO-1 a 5): «Hacerlo ahora», pantalla de un ejercicio sin calentamiento
//    ni vuelta, series con su descanso, terminar y verlo en la ficha y en Progreso; bloqueo por zona dolorida;
//    a medias en Ejercicios; desde una sesión en marcha la ficha no lo ofrece.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, semanaRef, sesionDemo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
after(() => a.cerrar());
const $ = s => a.doc.querySelector(s);
const $$ = s => [...a.doc.querySelectorAll(s)];
const hoyDS = new Date().getDay() || 7;
const sinHojas = () => { for (const f of $$('.hoja-fondo')) f.parentNode.removeChild(f); };
async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.w.localStorage.removeItem('pipos-temporizador');
  a.estado.cargar();
  sinHojas();
  await a.ir('perfil'); await a.ir('hoy');
}
const mia = (id, nombre) => ({ id, nombre, lugar: 'gym', minutos: 40, creada: '2026-11-01T10:00:00.000Z', ejercicios: [{ id: 'press-pecho-maquina', rol: 'principal', series: 3, reps: '8-12', descanso: 90 }] });
const conPlan = b => {
  b.plan = { semana: semanaRef(new Date()), creado: new Date().toISOString(), fuente: 'reglas', resumen: '', criterios: '', progresion: '', hechos: {},
    dias: [{ diaSemana: hoyDS, nombre: 'Torso', foco: '', lugar: 'gym', minutos: 60, tipo: 'fullA', explicacion: [], calentamiento: [], ejercicios: [{ id: 'remo-maquina', rol: 'principal', series: 3, reps: '8-12', descanso: 90, nota: '' }], vuelta: [] }] };
  return b;
};
const sueltas = () => Object.values(a.estado.estado().sesiones).filter(s => s.origen && s.origen.tipo === 'suelto');

// ── 1) Mis sesiones en Hoy ──
test('Hoy sin ninguna: «Crear una sesión» lleva al editor; al guardar vuelve a Hoy con ella en la lista', async () => {
  await reiniciar(conPlan(estadoBase()));
  const t = $('.mis-sesiones-hoy');
  assert.ok(t, 'Hoy tiene «Mis sesiones»');
  assert.match(t.textContent, /Elige tú los ejercicios/);
  a.clic('.mis-sesiones-hoy [data-act="hoy.crearMia"]'); await a.esperar(() => a.w.location.hash === '#mia/nueva');
  await a.tic();
  assert.equal($('#nav a[aria-current="page"]').getAttribute('href'), '#hoy', 'el editor es parte de Hoy');
  assert.match($('[data-act="mia.volver"]').textContent, /Hoy/);
  $('#mia-nombre').value = 'Pecho rápido'; $('#mia-nombre').dispatchEvent(new a.w.Event('input', { bubbles: true }));
  a.clic('[data-act="mia.buscar"]'); await a.esperar(() => $('.hoja #mia-buscar'));
  a.clic('.hoja [data-act="mia.anadir"][data-id="press-pecho-maquina"]');
  a.clic('[data-act="mia.listo"]'); await a.espera(60);
  a.clic('[data-act="mia.guardar"]'); await a.esperar(() => a.w.location.hash === '#hoy'); await a.tic();
  assert.match($('#aviso').textContent, /Hazla desde Hoy/);
  assert.match($('.mis-sesiones-hoy').textContent, /Pecho rápido/);
  assert.ok($('.mis-sesiones-hoy [data-act="hoy.crearMia"]'), '«Crear otra»');
});

test('Hoy con una: tocarla abre «Antes de empezar» con ella elegida y al empezar se hace (sin ocupar el día)', async () => {
  const b = conPlan(estadoBase()); b.misSesiones = [mia('m1', 'Pecho'), mia('m2', 'Espalda')];
  await reiniciar(b);
  assert.equal($$('.mis-sesiones-hoy [data-act="entrenador.prepararMia"]').length, 2);
  a.clic('.mis-sesiones-hoy [data-act="entrenador.prepararMia"][data-v="m2"]'); await a.esperar(() => $('.hoja.checkin'));
  const cmp = $('[data-act="entrenador.ciCompleto"]');
  if (cmp) { a.clic(cmp); await a.esperar(() => $('.hoja.checkin [data-act="entrenador.ciMia"]')); }
  assert.equal($('[data-act="entrenador.ciMia"][aria-pressed="true"]').dataset.v, 'm2');
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => /^#sesion\//.test(a.w.location.hash));
  const s = a.estado.estado().sesiones[a.w.location.hash.split('/')[1]];
  assert.deepEqual(s.origen, { tipo: 'mia', id: 'm2' });
  assert.ok(s.calentamiento.length && s.vuelta.length, 'C-MIA-1: calentamiento y vuelta siempre');
  assert.deepEqual(a.estado.estado().plan.hechos, {}, 'no ocupa el día del plan');
  sinHojas();
});

test('Hoy: «Editar» lleva a la suya; con más de 3, «Ver las N» las enseña todas; sin plan también está', async () => {
  const b = estadoBase(); b.misSesiones = ['a', 'b', 'c', 'd'].map(k => mia('m' + k, 'Sesión ' + k));
  await reiniciar(b);
  assert.match($('.hoy-cuerpo').textContent, /¿Qué días puedes entrenar\?/);
  assert.doesNotMatch($('.hoy-cuerpo').textContent, /Hacer una de mis sesiones/);
  assert.equal($$('.mis-sesiones-hoy [data-act="entrenador.prepararMia"]').length, 3);
  a.clic('[data-act="hoy.todasMias"]'); await a.esperar(() => $('.hoja'));
  assert.equal($$('.hoja [data-act="entrenador.prepararMia"]').length, 4);
  sinHojas();
  a.clic('[data-act="hoy.editarMia"][data-v="mb"]'); await a.esperar(() => a.w.location.hash === '#mia/mb'); await a.tic();
  assert.equal($('#mia-nombre').value, 'Sesión b');
  a.clic('[data-act="mia.volver"]'); await a.esperar(() => a.w.location.hash === '#hoy');
});

test('Hoy: con la sesión de hoy en marcha o un día sin entrenar por precaución, «Mis sesiones» no sale', async () => {
  const b = conPlan(estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } }));
  b.misSesiones = [mia('m1', 'Pecho')];
  await reiniciar(b);
  assert.match($('.hoy-tarjeta').textContent, /En marcha/);
  assert.equal($('.mis-sesiones-hoy'), null);
  const c = conPlan(estadoBase()); c.misSesiones = [mia('m1', 'Pecho')];
  c.alarmas = [{ fecha: a.estado.hoyISO(), respuesta: 'si', frase: 'x' }];
  await reiniciar(c);
  assert.equal($('.mis-sesiones-hoy'), null);
  // Hecha la de hoy, sí (otra más, si quiere)
  const d = conPlan(estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'hecha', terminada: new Date().toISOString(), cierre: { esfuerzo: 3, dolor: {}, comentario: '' } }) } }));
  d.misSesiones = [mia('m1', 'Pecho')];
  await reiniciar(d);
  assert.ok($('.mis-sesiones-hoy [data-act="entrenador.prepararMia"]'));
});

// ── 2) Ejercicio suelto ──
test('C-SUELTO · ficha → «Hacerlo ahora» → un solo ejercicio con su ficha, descanso al marcar, terminar y verlo después', async () => {
  const b = conPlan(estadoBase()); b.ajustes.modoSesion = 'foco';
  await reiniciar(b);
  await a.ir('ejercicios');
  a.clic('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.match($('.hoja .ficha-suelto').textContent, /Hacerlo ahora/);
  a.clic('.hoja [data-act="ejercicios.suelto"]'); await a.esperar(() => /^#sesion\//.test(a.w.location.hash)); await a.tic();
  const id = a.w.location.hash.split('/')[1];
  assert.match($('.cab-sesion').textContent, /Ejercicio suelto/);
  assert.equal($('.cab-sesion a').getAttribute('href'), '#ejercicios');
  assert.equal($('.modo-sesion'), null, 'sin «Uno a uno» aunque sea el modo guardado');
  assert.equal($('.pasos-sesion'), null);
  assert.equal($$('.tareas-bloque').length, 0, 'sin calentamiento ni vuelta a la calma');
  assert.equal($$('.sesion-ej').length, 1);
  assert.ok($('details.tecnica[data-id="press-pecho-maquina"]').open, 'la ficha técnica, a mano');
  assert.equal($('[data-act="sesion.guardarMia"]'), null);
  // Menú: sin «Cambiar por otro»
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => $('.hoja .menu-hoja'));
  assert.equal($('.hoja [data-act="sesion.cambiar"]'), null);
  sinHojas();
  // Marcar la primera serie: arranca el descanso
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.esperar(() => $('#temporizador'));
  assert.equal(a.estado.estado().sesiones[id].ejercicios[0].sets[0].hecha, true);
  // Hoy no la toma como sesión de hoy
  await a.ir('hoy');
  assert.match($('.hoy-tarjeta').textContent, /Hoy toca/);
  // Terminar y guardar: vuelve a Ejercicios con «Ejercicio guardado»
  await a.ir('sesion/' + id);
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => $('#c-com'));
  assert.equal($('.hoja [data-act="sesion.cerrar"]').textContent, 'Guardar ejercicio');
  a.clic('[data-act="sesion.cerrar"]'); await a.esperar(() => a.w.location.hash === '#ejercicios');
  await a.esperar(() => $('.final'));
  assert.match($('.final').textContent, /Ejercicio guardado/);
  assert.doesNotMatch($('.final').textContent, /días? del plan/);
  a.clic('.final [data-fin-hoy]'); await a.tic();
  const s = a.estado.estado().sesiones[id];
  assert.equal(s.estado, 'hecha');
  assert.deepEqual(a.estado.estado().plan.hechos, {});
  assert.equal(a.estado.estado().dolor.filter(d => d.momento === 'antes').length, 0);
  // La ficha enseña la vez y Progreso la cuenta en «Lo último», no como sesión
  a.clic('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.match($('.hoja .ficha').textContent, /Tus últimas veces/);
  sinHojas();
  await a.ir('progreso');
  assert.match(a.vista().textContent, /ejercicio suelto/);
  assert.doesNotMatch(a.vista().textContent, /Constancia/, 'sin sesiones no hay constancia que enseñar');
});

test('C-SUELTO-2 · con el hombro a 5 la ficha de un press dice por qué no y no ofrece el botón', async () => {
  const b = estadoBase(); b.perfil.lesiones = [{ id: 'l1', zona: 'hombro', dolor: 5, activa: true, desde: '2026-01-01', tipo: 'lesion' }];
  await reiniciar(b);
  await a.ir('ejercicios');
  a.clic('[data-act="ejercicios.ficha"][data-id="press-pecho-maquina"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.match($('.hoja .ficha-suelto-no').textContent, /Hoy no puedes hacerlo suelto/);
  assert.match($('.hoja .ficha-suelto-no').textContent, /Carga tu hombro/);
  assert.equal($('.hoja [data-act="ejercicios.suelto"]'), null);
  sinHojas();
  assert.equal(sueltas().length, 0);
});

test('C-SUELTO-1 · a medias: se ve en Ejercicios para seguir; desde una sesión en marcha la ficha no lo ofrece', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } });
  await reiniciar(b);
  await a.ir('ejercicios');
  a.clic('[data-act="ejercicios.ficha"][data-id="plancha"]'); await a.esperar(() => $('.hoja .ficha'));
  a.clic('.hoja [data-act="ejercicios.suelto"]'); await a.esperar(() => /^#sesion\//.test(a.w.location.hash)); await a.tic();
  const id = a.w.location.hash.split('/')[1];
  a.estado.cambiar(S => { const s = S.sesiones[id]; s.estado = 'en_curso'; s.ejercicios[0].sets[0].hecha = true; s.ejercicios[0].sets[0].valor = '30'; }, 'sesion');
  await a.ir('ejercicios');
  assert.match($('.sueltos-medias').textContent, /Plancha/);
  assert.equal($('.sueltos-medias a').getAttribute('href'), '#sesion/' + id);
  a.clic('[data-act="ejercicios.ficha"][data-id="plancha"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.match($('.hoja .ficha-suelto').textContent, /Seguir con él/);
  sinHojas();
  // En la sesión de hoy, «Ver la ficha completa» no saca de ella
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.ficha"][data-id="press-pecho-maquina"]'); await a.esperar(() => $('.hoja .ficha'));
  assert.equal($('.hoja .ficha-suelto'), null);
  assert.equal($('.hoja .ficha-suelto-no'), null);
  sinHojas();
});

// ── Revisión del PR #56 ──
async function hacerSuelto(id) {
  await a.ir('ejercicios');
  a.clic(`[data-act="ejercicios.ficha"][data-id="${id}"]`); await a.esperar(() => $('.hoja .ficha'));
  a.clic('.hoja [data-act="ejercicios.suelto"]'); await a.esperar(() => /^#sesion\//.test(a.w.location.hash)); await a.tic();
  return a.w.location.hash.split('/')[1];
}
const quitarFinal = () => { for (const f of $$('.final')) f.parentNode.removeChild(f); a.doc.body.classList.remove('con-final'); for (const n of $$('[inert]')) n.removeAttribute('inert'); };

test('H1 · «Algo va mal» en un suelto no ofrece «Cambiar por otro» ni «Seguir con el siguiente», sino «Terminar»; sigue con un ejercicio', async () => {
  const b = estadoBase(); b.perfil.lesiones = [{ id: 'l1', zona: 'rodilla', dolor: 2, activa: true, desde: '2026-01-01', tipo: 'lesion' }];
  await reiniciar(b);
  const id = await hacerSuelto('prensa-piernas');
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => $('.hoja .menu-hoja'));
  a.clic('.hoja [data-act="sesion.algoVaMal"]'); await a.esperar(() => $('#avm-dolor'));
  $('#avm-dolor').value = '6';
  a.clic('[data-act="sesion.dolorDurante"]'); await a.esperar(() => /Salta/.test(($('.hoja h2') || {}).textContent || ''));
  assert.equal($('.hoja [data-act="sesion.cambiar"]'), null);
  assert.doesNotMatch($('.hoja').textContent, /Seguir con el siguiente/);
  assert.equal($('.hoja [data-act="sesion.terminar"]').textContent, 'Terminar');
  // Aunque llegue la acción por otro lado, no se cambia
  const bt = a.doc.createElement('button'); bt.dataset.act = 'sesion.cambiarPor'; bt.dataset.e = '0'; bt.dataset.id = 'sentadilla-isometrica'; a.vista().append(bt);
  a.clic(bt); await a.espera(30);
  assert.equal(a.estado.estado().sesiones[id].ejercicios.length, 1);
  assert.ok(a.estado.estado().sesiones[id].ejercicios[0].dolorDurante);
  sinHojas();
});

test('H2 · a medias con dolor 8 hoy: «A medias» dice que hoy no se sigue y la pantalla solo deja terminar con lo hecho o descartar', async () => {
  await reiniciar(conPlan(estadoBase()));
  const id = await hacerSuelto('plancha');
  a.estado.cambiar(S => { const s = S.sesiones[id]; s.estado = 'en_curso'; s.empezada = new Date().toISOString(); s.ejercicios[0].sets[0].hecha = true; s.ejercicios[0].sets[0].valor = '30'; }, 'sesion');
  a.estado.cambiar(S => { S.dolor.push({ fecha: a.estado.hoyISO(), zona: 'lumbar', dolor: 8, momento: 'despues' }); }, 'sesion');
  await a.ir('ejercicios');
  assert.match($('.sueltos-medias').textContent, /Hoy no sigas: tienes dolor de 7 o más/);
  assert.match($('.sueltos-medias .fila-accion').textContent, /Cerrar/);
  a.clic('.sueltos-medias a'); await a.esperar(() => a.w.location.hash === '#sesion/' + id); await a.tic();
  assert.match($('.suelto-parado').textContent, /lumbar está a 8\/10/);
  assert.equal($('[data-act="sesion.serie"]'), null, 'no se pueden marcar más series');
  assert.equal($('[data-act="sesion.cuenta"]'), null);
  assert.ok($('[data-act="sesion.terminar"]') && $('[data-act="sesion.descartar"]'));
  // Ni forzando la acción
  const bt = a.doc.createElement('button'); bt.dataset.act = 'sesion.serie'; bt.dataset.e = '0'; bt.dataset.s = '1'; a.vista().append(bt);
  a.clic(bt); await a.tic();
  assert.equal(a.estado.estado().sesiones[id].ejercicios[0].sets[1].hecha, false);
  // Terminar con lo hecho lo guarda
  a.clic('.sesion-lista > [data-act="sesion.terminar"]'); await a.esperar(() => $('#c-com'));
  a.clic('[data-act="sesion.cerrar"]'); await a.esperar(() => a.w.location.hash === '#ejercicios');
  assert.equal(a.estado.estado().sesiones[id].estado, 'hecha');
  quitarFinal();
});

test('H3 · «Hacerla» con la sesión de hoy preparada pide confirmar y la sustituye, sin dejar dos ni el día del plan apuntando a ella', async () => {
  const b = conPlan(estadoBase({ sesiones: { s1: sesionDemo('s1', { fuente: 'ia', nombre: 'Torso IA' }) } }));
  b.plan.hechos = { [hoyDS]: 's1' };
  b.misSesiones = [mia('m1', 'Pecho')];
  await reiniciar(b);
  a.clic('.mis-sesiones-hoy [data-act="entrenador.prepararMia"][data-v="m1"]'); await a.esperar(() => $('.hoja [data-r="1"]'));
  assert.match($('.hoja').textContent, /«Torso IA»\. Si haces «Pecho», la sustituye/);
  // Cancelar: no pasa nada
  a.clic('.hoja [data-r="0"]'); await a.espera(60);
  assert.equal($('.hoja.checkin'), null);
  a.clic('.mis-sesiones-hoy [data-act="entrenador.prepararMia"][data-v="m1"]'); await a.esperar(() => $('.hoja [data-r="1"]'));
  a.clic('.hoja [data-r="1"]'); await a.esperar(() => $('.hoja.checkin'));
  const cmp = $('[data-act="entrenador.ciCompleto"]'); if (cmp) { a.clic(cmp); await a.tic(); }
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => /^#sesion\//.test(a.w.location.hash), { max: 4000 });
  const S = a.estado.estado(), nueva = a.w.location.hash.split('/')[1];
  assert.equal(S.sesiones.s1, undefined, 'la de hoy (tocada) se ha sustituido');
  assert.deepEqual(Object.keys(S.sesiones), [nueva]);
  assert.deepEqual(S.plan.hechos, {}, 'sin «Cuenta como el día», el día del plan queda libre');
  sinHojas();
});

test('H4 · «Ver las N»: editar y hacerla desde la hoja', async () => {
  const b = conPlan(estadoBase()); b.misSesiones = ['1', '2', '3', '4'].map(k => mia('m' + k, 'S' + k));
  await reiniciar(b);
  a.clic('[data-act="hoy.todasMias"]'); await a.esperar(() => $('.hoja .lista-mias-hoy'));
  a.clic('.hoja [data-act="hoy.editarMia"][data-v="m4"]'); await a.esperar(() => a.w.location.hash === '#mia/m4'); await a.tic();
  assert.equal($('.hoja .lista-mias-hoy'), null, 'la hoja se cierra al ir al editor');
  a.clic('[data-act="mia.volver"]'); await a.esperar(() => a.w.location.hash === '#hoy'); await a.tic();
  a.clic('[data-act="hoy.todasMias"]'); await a.esperar(() => $('.hoja .lista-mias-hoy'));
  a.clic('.hoja [data-act="entrenador.prepararMia"][data-v="m4"]'); await a.esperar(() => $('.hoja.checkin'));
  const cmp = $('[data-act="entrenador.ciCompleto"]'); if (cmp) { a.clic(cmp); await a.tic(); }
  assert.equal($('[data-act="entrenador.ciMia"][aria-pressed="true"]').dataset.v, 'm4');
  sinHojas();
});
