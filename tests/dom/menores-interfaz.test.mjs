// Fallos menores de interfaz del informe del 21-11-2026 (M4, M5, M9, M12, M15, M16, M17, M18) y de la
// verificación de la re-auditoría (la barra del descanso de una sesión que ya no existe), en jsdom.
// M20 está en tests/dom/espera.test.mjs (necesita la IA simulada) y M19 en tests/e2e/menores.spec.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, fijarFecha, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const reloj = fijarFecha('2026-11-21T10:00'); // sábado
const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
const crono = await import(modulo('js/areas/sesion/temporizador.js'));
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
after(() => { crono.parar(); reloj.restaurar(); a.cerrar(); });

async function reiniciar(datos, hash = 'hoy') {
  crono.parar(); crono.cerrarAlarma({ foco: false });
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('progreso'); await a.ir(hash);
}
const hoja = () => a.doc.querySelector('.hoja');
const textoHoja = () => (hoja() || {}).textContent || '';
const S = () => a.estado.estado();

// ── M4 ──
test('M4: desmarcar una serie anterior no corta el descanso en marcha; desmarcar la que lo empezó, sí', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  await a.espera(260); // fuera del doble toque entre series
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await a.tic();
  assert.ok(crono.activo(), 'descanso tras la serie 2');
  await a.espera(260);
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic(); // desmarca la serie 1
  assert.equal(S().sesiones.s1.ejercicios[0].sets[0].hecha, false);
  assert.ok(crono.activo(), 'el descanso de la serie 2 sigue');
  assert.ok(a.doc.querySelector('#temporizador.descanso'), 'y su barra se ve');
  await a.espera(260);
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await a.tic(); // desmarca la que lo empezó
  assert.equal(S().sesiones.s1.ejercicios[0].sets[1].hecha, false);
  assert.equal(crono.activo(), false, 'desmarcar la serie del descanso lo quita');
});

// ── Verificación de la re-auditoría: descanso de una sesión que ya no existe ──
test('una sesión que desaparece (copia cargada en otra pestaña, descartada) se lleva su descanso y su barra', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.ok(crono.activo());
  // Otro descanso de una sesión que sí existe no se toca.
  a.estado.cambiar(S2 => { delete S2.sesiones.s1; }, 'importar');
  await a.tic();
  assert.equal(crono.activo(), false, 'el descanso sigue contando');
  assert.equal(a.doc.querySelector('#temporizador.descanso'), null, 'la barra sigue a la vista');
  // Un descanso sin sesión (p. ej. de una prueba o de otra versión) no se para por esto.
  crono.descanso(60, 'Descanso');
  a.estado.cambiar(S2 => { S2.perfil.notas = 'x'; }, 'perfil');
  assert.ok(crono.activo());
  crono.parar();
});

// ── M5 ──
test('M5: tocar fuera de «¿Hoy de verdad 7 o más?» vuelve al check-in con lo marcado', async () => {
  const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 6, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true });
  await reiniciar(b);
  const bt = a.doc.createElement('button'); bt.dataset.act = 'entrenador.prepararHoy'; a.vista().append(bt);
  a.clic(bt); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.crearHoy"]'));
  // Check-in de un toque (M21): para tocar energía o dolor, «Algo ha cambiado».
  const cmp = a.doc.querySelector('[data-act="entrenador.ciCompleto"]');
  if (cmp) { a.clic(cmp); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.ci"]')); }
  a.clic('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await a.tic();
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]');
  await a.esperar(() => /¿Hoy de verdad 7 o más\?/.test(textoHoja()));
  const fondo = a.doc.querySelector('.hoja-fondo');
  fondo.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await a.esperar(() => a.doc.querySelector('.hoja.checkin #ci-rodilla'), { que: 'el check-in vuelve' });
  await a.espera(50); await a.tic(); // el «atrás» de la confirmación no se lleva el check-in
  assert.ok(a.doc.querySelector('.hoja.checkin'), 'el check-in sigue abierto');
  assert.equal(a.doc.querySelector('#ci-rodilla').textContent, '6');
  assert.equal(a.doc.querySelector('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]').getAttribute('aria-checked'), 'true', 'la energía marcada se queda');
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

// ── M9 ──
test('M9: una nota de lesión larga y sin espacios se recorta en la lista y entera en la ficha', async () => {
  const nota = 'https://ejemplo.com/' + 'a'.repeat(300) + ' ' + 'palabra '.repeat(100);
  const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 3, desde: '2025-01-01', tipo: 'lesion', nota: nota.trim(), activa: true });
  await reiniciar(b, 'perfil');
  a.clic('[data-act="perfil.grupo"][data-v="lesiones"]'); await a.tic();
  const fila = a.vista().querySelector('[data-act="perfil.lesion"][data-id="l1"] .crece > span');
  assert.ok(fila.textContent.length < 200, `la lista enseña ${fila.textContent.length} caracteres`);
  assert.match(fila.textContent, /…$/);
  a.clic('[data-act="perfil.lesion"][data-id="l1"]'); await a.esperar(() => a.doc.querySelector('#l-nota'));
  assert.equal(a.doc.querySelector('#l-nota').value, nota.trim(), 'la ficha tiene la nota entera');
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

// ── M12 ──
test('M12 (C-OBJ-1): con varios objetivos se ve cuál manda y se puede poner otro primero', async () => {
  const b = estadoBase(); b.perfil.objetivos = ['musculo', 'salud'];
  await reiniciar(b, 'perfil');
  a.clic('[data-act="perfil.grupo"][data-v="objetivos"]'); await a.tic();
  const sec = () => a.vista().querySelector('.perfil-sec');
  assert.match(sec().textContent, /Manda Ganar músculo/);
  assert.equal(sec().querySelector('[data-act="perfil.objetivoPrincipal"][data-v="musculo"]'), null, 'el que ya manda no tiene botón');
  a.clic('[data-act="perfil.objetivoPrincipal"][data-v="salud"]'); await a.tic();
  assert.deepEqual(S().perfil.objetivos, ['salud', 'musculo']);
  assert.match(sec().textContent, /Manda Salud, movilidad y espalda sana/);
  // Con uno solo no hace falta decir nada.
  a.clic('[data-act="perfil.objetivo"][data-v="musculo"]'); await a.tic();
  assert.doesNotMatch(sec().textContent, /Manda/);
  assert.equal(sec().querySelector('[data-act="perfil.objetivoPrincipal"]'), null);
});

// ── M15 ──
test('M15: «Lo siguiente» no pone en minúscula la letra del día (cuerpo completo B)', async () => {
  const b = estadoBase();
  b.plan = ent.planReglas(b, { dias: [6, 7], minutos: 60, lugares: ['gym'] }, { hechas: [] });
  b.plan.dias[0].nombre = 'Cuerpo completo A'; b.plan.dias[1].nombre = 'Cuerpo completo B';
  const s = sesionDemo('h1', { estado: 'hecha', fecha: '2026-11-21', terminada: '2026-11-21T09:00:00Z', cierre: { esfuerzo: 3, dolor: {}, comentario: '' }, diaPlan: b.plan.dias[0].id });
  s.ejercicios[0].sets[0].hecha = true;
  b.sesiones.h1 = s;
  await reiniciar(b);
  assert.match(a.vista().textContent, /Lo siguiente: domingo, cuerpo completo B\./);
});

// ── M16 ──
test('M16: medidas fuera de lo razonable o negativas no se guardan y se dice por qué', async () => {
  await reiniciar(estadoBase(), 'progreso');
  const abrir = async () => { a.clic('[data-act="progreso.medida"]'); await a.esperar(() => a.doc.querySelector('#m-peso')); };
  await abrir();
  a.doc.querySelector('#m-peso').value = '1000';
  a.doc.querySelector('#m-cintura').value = '-80';
  a.clic('[data-act="progreso.guardarMedida"]'); await a.tic();
  assert.equal(S().medidas.length, 0, 'se guardó');
  assert.ok(hoja(), 'la hoja sigue abierta');
  assert.equal(a.doc.querySelector('#m-peso').getAttribute('aria-invalid'), 'true');
  assert.equal(a.doc.querySelector('#m-cintura').getAttribute('aria-invalid'), 'true');
  assert.match(textoHoja(), /Peso: entre 25 y 300 kg/);
  a.doc.querySelector('#m-peso').value = '80,5';
  a.doc.querySelector('#m-cintura').value = '';
  a.clic('[data-act="progreso.guardarMedida"]'); await a.tic();
  assert.equal(S().medidas.length, 1);
  assert.equal(S().medidas[0].peso, 80.5);
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

// ── M17 ──
test('M17: tras cargar una copia no dice «Aún no has guardado ninguna copia» ni «Llevas N sesiones sin guardar»', async () => {
  const antes = estadoBase();
  for (let i = 0; i < 11; i++) antes.sesiones['p' + i] = sesionDemo('p' + i, { estado: 'hecha', fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, terminada: `2026-09-${String(i + 1).padStart(2, '0')}T18:00:00.000Z`, cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  await reiniciar(antes, 'perfil');
  a.w.localStorage.removeItem('pipos4-copia');
  a.w.localStorage.removeItem('pipos4-antes-de-importar');
  const otra = estadoBase();
  for (let i = 0; i < 12; i++) otra.sesiones['h' + i] = sesionDemo('h' + i, { estado: 'hecha', fecha: `2026-10-${String(i + 1).padStart(2, '0')}`, terminada: `2026-10-${String(i + 1).padStart(2, '0')}T18:00:00.000Z`, cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  a.clic('[data-act="perfil.grupo"][data-v="copias"]'); await a.tic();
  // «Cargar copia» con un archivo elegido: se coge el <input type=file> que crea y se le da el archivo.
  let entrada = null;
  const clicReal = a.w.HTMLInputElement.prototype.click;
  a.w.HTMLInputElement.prototype.click = function () { if (this.type === 'file') entrada = this; else clicReal.call(this); };
  try { a.clic('[data-act="perfil.importar"]'); } finally { a.w.HTMLInputElement.prototype.click = clicReal; }
  Object.defineProperty(entrada, 'files', { value: [new a.w.File([JSON.stringify(otra)], 'copia.json', { type: 'application/json' })] });
  entrada.onchange();
  await a.esperar(() => a.doc.querySelector('.hoja [data-r="1"]'));
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => Object.keys(S().sesiones).some(k => k.startsWith('h')));
  await a.ir('progreso'); await a.ir('perfil'); await a.tic();
  assert.equal(Object.values(S().sesiones).filter(x => x.estado === 'hecha').length, 12);
  const v = a.vista().textContent;
  assert.doesNotMatch(v, /Aún no has guardado ninguna copia/);
  assert.doesNotMatch(v, /sin guardar una copia/);
  // La fecha es la de la última sesión de la copia, no la de hoy (la copia puede ser vieja).
  assert.match(v, /Última copia guardada: 12 oct/);
  // «Volver a ellos»: esas 11 sesiones no estaban en la copia cargada; vuelve el recordatorio.
  a.clic('[data-act="perfil.deshacerImportar"]');
  await a.esperar(() => a.doc.querySelector('.hoja [data-r="1"]'));
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => Object.keys(S().sesiones).some(k => k.startsWith('p')));
  await a.ir('progreso'); await a.ir('perfil'); await a.tic();
  assert.match(a.vista().textContent, /Aún no has guardado ninguna copia/);
  assert.match(a.vista().textContent, /Llevas 11 sesiones sin guardar una copia/);
});

// ── M18 ──
test('M18: embarazo, parto y cesárea no salen en el perfil de un hombre (salvo que ya estén marcados)', async () => {
  const b = estadoBase(); b.perfil.datos.sexo = 'h';
  await reiniciar(b, 'perfil');
  a.clic('[data-act="perfil.grupo"][data-v="salud"]'); await a.tic();
  assert.equal(a.vista().querySelector('[data-k="embarazo"]'), null);
  assert.equal(a.vista().querySelector('[data-k="posparto"]'), null);
  assert.ok(a.vista().querySelector('[data-k="hipertension"]'));
  const m = estadoBase(); m.dueño = 'virginia'; m.perfil.datos.sexo = 'm';
  await reiniciar(m, 'perfil');
  assert.ok(a.vista().querySelector('[data-k="embarazo"]'));
  assert.ok(a.vista().querySelector('[data-k="posparto"]'));
  const sinSexo = estadoBase(); sinSexo.perfil.datos.sexo = '';
  await reiniciar(sinSexo, 'perfil');
  assert.ok(a.vista().querySelector('[data-k="embarazo"]'), 'sin sexo dicho, se ofrece');
  const raro = estadoBase(); raro.perfil.datos.sexo = 'h'; raro.perfil.salud = { embarazo: 12 };
  await reiniciar(raro, 'perfil');
  assert.ok(a.vista().querySelector('[data-k="embarazo"]'), 'marcado, se ve para poder quitarlo');
});

// ── Revisión del PR #52 ──
test('M4 (revisión): tras «Cambiar por otro» en esa posición, desmarcar no corta un descanso que era del ejercicio de antes', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.ok(crono.activo());
  a.estado.cambiar(S2 => { S2.sesiones.s1.ejercicios[0].id = 'press-inclinado-maquina'; }, 'sesion');
  await a.espera(1050); // el mismo botón: fuera del doble toque de 1 s
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.equal(S().sesiones.s1.ejercicios[0].sets[0].hecha, false);
  assert.ok(crono.activo(), 'el descanso sigue');
});

test('M4 (revisión): desmarcar otra serie no cierra la alarma del descanso; desmarcar la suya, sí', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  await a.espera(260);
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await a.tic();
  const meta = crono.info().meta;
  crono.descanso(1, 'Serie 3 de 3', meta); // el mismo descanso, ya casi acabado
  await a.esperar(() => crono.alarmaDe(), { max: 3000, que: 'la alarma' });
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.ok(crono.alarmaDe(), 'cerró la alarma de otra serie');
  await a.espera(260);
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await a.tic();
  assert.equal(crono.alarmaDe(), null);
});

test('una cuenta en marcha da la sesión por empezada (no se puede rehacer debajo)', async () => {
  const s = sesionDemo();
  s.ejercicios.push({ id: 'plancha', rol: 'principal', series: 1, reps: '30-40s', descanso: 0, kg: null, nota: '', motivo: '', sets: [{ kg: null, valor: '', hecha: false }], gusto: null, comentario: '' });
  const b = estadoBase({ sesiones: { s1: s } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.cuenta"][data-e="2"]'); await a.tic();
  assert.ok(crono.activo());
  assert.equal(S().sesiones.s1.estado, 'en_curso');
  crono.parar();
});

test('plurales con una sola serie y con una meta de 1 día', async () => {
  const s = sesionDemo(); s.ejercicios = [s.ejercicios[0]]; s.ejercicios[0].series = 1; s.ejercicios[0].sets = [s.ejercicios[0].sets[0]];
  await reiniciar(estadoBase({ sesiones: { s1: s, h1: sesionDemo('h1', { estado: 'hecha', fecha: '2026-11-20', terminada: '2026-11-20T18:00:00Z', cierre: { esfuerzo: 3, dolor: {}, comentario: '' } }) } }), 'sesion/s1');
  assert.match(a.vista().querySelector('.cab-sesion').textContent, /0 de 1 serie(?!s)/);
  const { tarjetaConstancia } = await import(modulo('js/areas/progreso/indice.js'));
  assert.match(tarjetaConstancia(S(), { planificados: 1, hechosPlan: 0 }).replace(/<[^>]+>/g, ''), /0 de 1 día del plan esta semana/);
});

test('M16 (revisión): un muslo de 110 cm se guarda', async () => {
  await reiniciar(estadoBase(), 'progreso');
  a.clic('[data-act="progreso.medida"]'); await a.esperar(() => a.doc.querySelector('#m-muslo'));
  a.doc.querySelector('#m-muslo').value = '110';
  a.clic('[data-act="progreso.guardarMedida"]'); await a.tic();
  assert.equal(S().medidas[0].muslo, 110);
});

test('M12 (revisión): tras «Que mande …» el foco va al texto que dice cuál manda', async () => {
  const b = estadoBase(); b.perfil.objetivos = ['musculo', 'salud'];
  await reiniciar(b, 'perfil');
  a.clic('[data-act="perfil.grupo"][data-v="objetivos"]'); await a.tic();
  const bt = a.vista().querySelector('[data-act="perfil.objetivoPrincipal"][data-v="salud"]');
  bt.focus(); a.clic(bt); await a.tic();
  assert.ok(a.doc.activeElement && a.doc.activeElement.matches('.objetivo-manda .ayuda'), `foco en ${a.doc.activeElement && a.doc.activeElement.tagName}`);
  assert.match(a.doc.activeElement.textContent, /Manda Salud/);
});

// ── M11 ──
test('M11 (C-LES-3): el cierre ofrece guardar un dolor nuevo como molestia puntual, con el dolor del cierre y la fecha de la sesión', async () => {
  const s = sesionDemo('s1', { fecha: '2026-11-20', checkin: { energia: 3, dolor: { hombro: 4, rodilla: 2 } } });
  const b = estadoBase({ sesiones: { s1: s } }); b.ajustes.modoSesion = 'lista';
  b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 2, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true });
  await reiniciar(b, 'sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cerrar"]'));
  assert.ok(a.doc.querySelector('[data-act="sesion.guardarMolestia"][data-z="hombro"]'), 'se ofrece para el hombro');
  assert.equal(a.doc.querySelector('[data-act="sesion.guardarMolestia"][data-z="rodilla"]'), null, 'la rodilla ya está en el perfil');
  // El dolor del hombro en el cierre pasa a 5 y se guarda con ese valor.
  a.doc.querySelector('.hoja input[data-zona="hombro"]').value = '5';
  a.clic('[data-act="sesion.guardarMolestia"][data-z="hombro"]'); await a.tic();
  const l = S().perfil.lesiones.find(x => x.zona === 'hombro');
  assert.ok(l, 'se guardó');
  assert.equal(l.tipo, 'puntual');
  assert.equal(l.desde, '2026-11-20');
  assert.equal(l.dolor, 5);
  assert.match(textoHoja(), /Guardada en Perfil › Lesiones/);
  assert.ok(a.doc.querySelector('[data-act="sesion.cerrar"]'), 'el cierre sigue abierto');
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});
