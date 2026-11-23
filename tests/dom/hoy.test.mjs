// PR 14 · Hoy y check-in en jsdom: sesión sin cerrar de un día anterior (R20), tira de la semana accesible,
// barra de la acción principal, «Sin conexión», minutos coherentes (la opción elegida siempre está), selector ±
// del dolor (con la confirmación de 7 o más), segmentos con flechas y los pasos de la espera de la IA.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, fijarFecha, isoLocal, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const reloj = fijarFecha('2026-11-21T10:00'); // sábado
const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
after(() => { reloj.restaurar(); a.cerrar(); });

async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
const vista = () => a.vista().textContent;
const hoja = () => a.doc.querySelector('.hoja');
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const conPlan = (extra = {}) => {
  const b = estadoBase(extra);
  b.perfil.disponibilidad.diasSemana = [1, 3, 5, 6];
  b.plan = ent.planReglas(b, { dias: [1, 3, 5, 6], minutos: 60, lugares: ['gym'] }, { hechas: [] });
  return b;
};
const abrirCheckin = async () => {
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; a.vista().append(b);
  a.clic(b); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.crearHoy"]'));
  // Check-in de un toque (M21): para tocar lugar, tiempo o dolor, «Algo ha cambiado».
  const cmp = a.doc.querySelector('[data-act="entrenador.ciCompleto"]');
  if (cmp) { a.clic(cmp); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.ci"]')); }
};

test('R20: una sesión de anteayer sin cerrar sale en Hoy con «Cerrarla» y «Descartarla» (que pregunta y la borra)', async () => {
  const s = sesionDemo('vieja', { fecha: dia(-2), estado: 'en_curso', nombre: 'Torso' });
  s.ejercicios[0].sets[0].hecha = true;
  const pend = sesionDemo('nada', { fecha: dia(-3), nombre: 'Sin tocar' }); // sin nada hecho: no se enseña
  await reiniciar(conPlan({ sesiones: { vieja: s, nada: pend } }));
  const aviso = a.doc.querySelector('.sin-cerrar');
  assert.ok(aviso, 'sin aviso de la sesión sin cerrar');
  assert.match(aviso.textContent, /La sesión del jueves 19 está sin cerrar/);
  assert.match(aviso.textContent, /Torso: 1 de 5 series/);
  assert.equal(aviso.querySelector('a[data-act="hoy.cerrarAnterior"]').getAttribute('href'), '#sesion/vieja');
  assert.match(aviso.textContent, /Cerrar la del jueves 19/);
  a.clic('[data-act="hoy.descartarAnterior"][data-v="vieja"]');
  await a.esperar(() => /¿Descartar «Torso», la sesión del jueves 19\?/.test((hoja() || {}).textContent || ''));
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => !a.estado.estado().sesiones.vieja);
  await a.tic();
  assert.equal(a.doc.querySelector('.sin-cerrar'), null);
  assert.ok(a.estado.estado().sesiones.nada, 'la que no se tocó no se borra');
});

test('«Cerrar la de ayer» lleva a esa sesión con el cierre abierto', async () => {
  const s = sesionDemo('ayer', { fecha: dia(-1), estado: 'en_curso' });
  s.ejercicios[1].sets[0].hecha = true;
  await reiniciar(conPlan({ sesiones: { ayer: s } }));
  assert.match(a.doc.querySelector('.sin-cerrar').textContent, /La sesión de ayer está sin cerrar/);
  a.clic('[data-act="hoy.cerrarAnterior"]');
  await a.esperar(() => a.doc.querySelector('.hoja [data-act="sesion.cerrar"]'));
  assert.equal(a.w.location.hash, '#sesion/ayer');
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('tira de la semana: cada día con su nombre accesible y su marca (✓, ×, fecha), no solo color', async () => {
  const hecha = sesionDemo('lun', { fecha: dia(-5), estado: 'hecha', cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  hecha.ejercicios[0].sets[0].hecha = true;
  await reiniciar(conPlan({ sesiones: { lun: hecha } }));
  const dias = [...a.doc.querySelectorAll('.semana .dia-c')];
  assert.equal(dias.length, 7);
  const et = dias.map(d => d.getAttribute('aria-label'));
  assert.match(et[0], /^Lunes 16: .+, hecho$/);
  assert.match(et[2], /^Miércoles 18: .+, no hecho$/);
  assert.match(et[5], /^Sábado 21: hoy, /);
  assert.equal(et[1], 'Martes 17: descanso');
  assert.ok(dias.every(d => d.getAttribute('role') === 'img'));
  assert.ok(dias[0].querySelector('svg'), 'hecho sin ✓');
  assert.ok(dias[2].querySelector('svg'), 'no hecho sin ×');
  assert.equal(dias[1].textContent.trim(), '17');
  // La acción principal va en su barra, después de todo lo demás
  const barra = a.doc.querySelector('#vista > .accion-hoy');
  assert.ok(barra && barra === a.vista().lastElementChild);
  assert.equal(barra.querySelector('[data-act="entrenador.prepararHoy"]').textContent, 'Empezar');
});

test('minutos y número de ejercicios coherentes: los mismos en Hoy, en la semana y en el día', async () => {
  await reiniciar(conPlan());
  const d = ent.planDeHoy(a.estado.estado());
  const min = ent.tiempoSesion(d);
  assert.match(a.doc.querySelector('.hoy-tarjeta').textContent, new RegExp(`unos ${min} min`));
  const fila = [...a.doc.querySelectorAll('.plan-semana [data-act="entrenador.verDia"]')].find(b => b.dataset.v === '6');
  assert.match(fila.textContent, new RegExp(`unos ${min} min`));
  a.clic(fila); await a.esperar(() => hoja());
  assert.match(hoja().textContent, new RegExp(`unos ${min} min`));
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  assert.doesNotMatch(vista(), /\b1 ejercicios\b|\b1 series\b/);
});

test('check-in: el tiempo del perfil (50) sale elegido aunque no sea de los de siempre', async () => {
  const b = estadoBase(); b.perfil.disponibilidad.minutos = 50;
  await reiniciar(b);
  await abrirCheckin();
  const on = a.doc.querySelector('[data-act="entrenador.ci"][data-k="minutos"][aria-checked="true"]');
  assert.equal(on && on.dataset.v, '50');
  assert.ok(on.classList.contains('on'));
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('check-in: selector ± del dolor (con confirmación al pasar a 7) y segmentos con flechas', async () => {
  const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 6, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true });
  await reiniciar(b);
  await abrirCheckin();
  const valor = () => a.doc.querySelector('#ci-rodilla').textContent;
  assert.equal(valor(), '6');
  assert.equal(a.doc.querySelector('#ci-r-rodilla').getAttribute('aria-valuetext'), '6 de 10');
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="-1"]'); await a.tic();
  assert.equal(valor(), '5');
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]'); await a.tic();
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]');
  await a.esperar(() => /¿Hoy de verdad 7 o más\?/.test((hoja() || {}).textContent || ''));
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => a.doc.querySelector('#ci-rodilla') && valor() === '7');
  // En 0 el «menos» no hace nada (y lo dice con aria-disabled)
  for (let i = 0; i < 7; i++) { a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="-1"]'); await a.tic(); }
  assert.equal(valor(), '0');
  const menos = a.doc.querySelector('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="-1"]');
  assert.equal(menos.getAttribute('aria-disabled'), 'true');
  a.clic(menos); await a.tic();
  assert.equal(valor(), '0');
  // Flechas en el segmento de energía: de 3 a 4, y el foco sigue en la opción elegida
  const e3 = a.doc.querySelector('[data-act="entrenador.ci"][data-k="energia"][data-v="3"]');
  e3.focus();
  e3.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await a.tic();
  const e4 = a.doc.querySelector('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]');
  assert.equal(e4.getAttribute('aria-checked'), 'true');
  assert.equal(a.doc.activeElement, e4);
  assert.match(hoja().textContent, /Energía: Buena/);
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('check-in a pantalla completa: flecha «Volver a Hoy», casillas nativas y acción abajo', async () => {
  await reiniciar(estadoBase());
  await abrirCheckin();
  const h = hoja();
  assert.ok(h.classList.contains('checkin-pantalla'));
  assert.equal(h.querySelector('.hoja-cab [data-cerrar-hoja]').getAttribute('aria-label'), 'Volver a Hoy');
  const alarma = h.querySelector('label.casilla [data-cambio="entrenador.ciAlarma"]');
  assert.equal(alarma.type, 'checkbox');
  assert.ok(h.querySelector('.ci-accion [data-act="entrenador.crearHoy"]'));
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});

test('sin conexión: Hoy lo dice y el check-in también (sin «Pedírsela igualmente»)', async () => {
  await reiniciar(conPlan());
  Object.defineProperty(a.w.navigator, 'onLine', { value: false, configurable: true });
  a.w.dispatchEvent(new a.w.Event('offline')); await a.tic();
  try {
    assert.match(a.doc.querySelector('.sin-red').textContent, /Tu sesión de hoy funciona entera/);
    await abrirCheckin();
    assert.match(hoja().textContent, /Sin conexión: la prepara la app con sus reglas/);
    assert.equal(a.doc.querySelector('[data-cambio="entrenador.ciIA"]'), null);
  } finally {
    Object.defineProperty(a.w.navigator, 'onLine', { value: true, configurable: true });
    a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
    a.w.dispatchEvent(new a.w.Event('online')); await a.tic();
  }
  assert.equal(a.doc.querySelector('.sin-red'), null);
});

// ── Revisión del PR #41 ──
test('la tira sigue diciendo «hoy» cuando la sesión de hoy está hecha', async () => {
  const s = sesionDemo('h', { estado: 'hecha', cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  s.ejercicios[0].sets[0].hecha = true;
  await reiniciar(conPlan({ sesiones: { h: s } }));
  const sab = a.doc.querySelectorAll('.semana .dia')[5];
  assert.ok(sab.classList.contains('dia--hoy') && sab.classList.contains('dia--hecha'));
  assert.match(sab.querySelector('.dia-c').getAttribute('aria-label'), /^Sábado 21: hoy, .+, hecho$/);
});

test('sesión sin cerrar: región con título, solo tareas sin «0 de N series», el mes si es de hace más de una semana y el foco tras descartar', async () => {
  const s = sesionDemo('vieja', { fecha: dia(-16), estado: 'en_curso', nombre: 'Movilidad', calentamiento: [{ id: null, nombre: 'Bici', detalle: '', duracion: '5 min', hecho: true }] });
  await reiniciar(conPlan({ sesiones: { vieja: s } }));
  const av = a.doc.querySelector('.sin-cerrar');
  assert.equal(av.getAttribute('role'), 'region');
  assert.equal(a.doc.getElementById(av.getAttribute('aria-labelledby')).textContent, 'La sesión del jueves 5 de noviembre está sin cerrar');
  assert.match(av.textContent, /Movilidad: 1 tarea hecha de calentamiento o vuelta a la calma\./);
  assert.doesNotMatch(av.textContent, /0 de \d+ series/);
  a.clic('[data-act="hoy.descartarAnterior"]');
  await a.esperar(() => /¿Descartar «Movilidad»/.test((hoja() || {}).textContent || ''));
  assert.doesNotMatch(hoja().textContent, /0 de \d+ series/);
  a.clic('.hoja [data-r="1"]');
  await a.esperar(() => !a.estado.estado().sesiones.vieja);
  await a.tic();
  assert.equal(a.doc.activeElement, a.doc.querySelector('#vista h1'), 'el foco se pierde tras descartar');
});

test('sin plan y con precaución T2, «Montar mi semana» es secundaria y no hay barra de acción', async () => {
  const b = estadoBase(); b.alarmas = [{ fecha: isoLocal(new Date()), respuesta: 'si', frase: '' }];
  await reiniciar(b);
  assert.match(vista(), /Sin entrenar por precaución/);
  assert.equal(a.doc.querySelector('.accion-hoy'), null);
  assert.ok(a.doc.querySelector('.sin-plan [data-act="entrenador.plan"]').classList.contains('boton--secundario'));
});

test('selector de dolor: una sola parada y un solo control para el lector (el deslizador); el foco vuelve a él tras ± y tras «No»', async () => {
  const b = estadoBase(); b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 6, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true });
  await reiniciar(b);
  await abrirCheckin();
  const pasos = a.doc.querySelector('.selector--dolor .selector-pasos');
  assert.equal(pasos.getAttribute('aria-hidden'), 'true');
  assert.ok([...pasos.querySelectorAll('button')].every(x => x.tabIndex === -1));
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="-1"]'); await a.tic();
  assert.equal(a.doc.activeElement, a.doc.querySelector('#ci-r-rodilla'));
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]'); await a.tic();
  a.clic('[data-act="entrenador.ciDolorPaso"][data-z="rodilla"][data-v="1"]');
  await a.esperar(() => /¿Hoy de verdad 7 o más\?/.test((hoja() || {}).textContent || ''));
  a.clic('.hoja [data-r="0"]');
  await a.esperar(() => a.doc.querySelector('#ci-rodilla'));
  assert.equal(a.doc.querySelector('#ci-rodilla').textContent, '6');
  assert.equal(a.doc.activeElement, a.doc.querySelector('#ci-r-rodilla'));
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
});
