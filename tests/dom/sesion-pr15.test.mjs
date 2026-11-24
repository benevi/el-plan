// Sesión y descanso (PR 15) en jsdom: reactivar el sonido tras recargar, kilos y repeticiones que pasan a las
// series siguientes vacías (R05), «Terminar» dice cuántas quedan, cambiar con series hechas conserva lo hecho,
// el dolor del cierre parte del último apuntado, la sesión hecha no se puede tocar, la alarma vibra tres toques
// y el contador con el móvil bloqueado pregunta antes de apuntar.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

let suena = false; // el navegador no deja sonar sin un toque tras recargar
const vibra = [];
const a = await montar({
  ls: {
    pipos4: estadoBase({ sesiones: { s1: sesionDemo() } }),
    'pipos-temporizador': { tipo: 'descanso', etiqueta: 'Serie 2 de 3', meta: { sesion: 's1', siguiente: 'A por la serie 2' }, fases: [{ f: 'descanso', dur: 90 }], i: 0, inicio: Date.now() - 10000, pausa: null, tiempos: [], avisos: {}, confirmar: null },
  },
  hash: 'sesion/s1',
  antes: w => {
    w.Audio.prototype.play = function () { if (!suena) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve(); };
    Object.defineProperty(w.navigator, 'vibrate', { configurable: true, value: p => { vibra.push(p); return true; } });
  },
});
const crono = await import(modulo('js/areas/sesion/temporizador.js'));
after(() => a.cerrar());
const S1 = () => a.estado.estado().sesiones.s1;

async function reiniciar(datos) {
  crono.parar(); crono.cerrarAlarma();
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
const lista = () => { const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista'; return b; };

test('tras recargar a mitad de un descanso, la barra sigue y ofrece «Activar el sonido» con un toque', async () => {
  const b = await a.esperar(() => a.doc.querySelector('#temporizador [data-t="sonido"]'), { que: 'el botón de activar el sonido' });
  assert.match(a.doc.querySelector('#temporizador .descanso-reloj').textContent, /^1:(1|2)\d$/);
  suena = true;
  a.clic(b); await a.tic(); await a.tic();
  assert.equal(a.doc.querySelector('#temporizador [data-t="sonido"]'), null, 'el botón sigue ahí');
  assert.ok(a.doc.querySelector('#temporizador.descanso'));
});

test('R05: al marcar una serie, sus kilos y repeticiones pasan a las siguientes vacías (no a las ya tocadas)', async () => {
  const b = lista();
  b.sesiones.s1.ejercicios[0].sets[2].valor = '6'; // la tercera ya tiene sus repeticiones
  await reiniciar(b);
  await a.ir('sesion/s1');
  // Selector ±: +1 paso de kilos (máquina: 2,5) y +2 repeticiones
  const kg = a.doc.querySelector('[data-actual] .selector[data-ej] [data-paso="1"]');
  a.clic(kg); await a.tic();
  const reps = a.doc.querySelectorAll('[data-actual] .selector')[1].querySelector('[data-paso="1"]');
  a.clic(reps); a.clic(reps); await a.tic();
  assert.equal(S1().ejercicios[0].sets[0].kg, 42.5);
  assert.equal(S1().ejercicios[0].sets[0].valor, '10');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  const sets = S1().ejercicios[0].sets;
  assert.deepEqual([sets[1].kg, sets[1].valor, sets[1].hecha], [42.5, '10', false]);
  assert.deepEqual([sets[2].kg, sets[2].valor], [42.5, '6']);
  // La serie actual enseña ya los valores que pasaron
  assert.equal(a.doc.querySelector('[data-actual] [role="spinbutton"]').getAttribute('aria-valuenow'), '42.5');
});

test('«Terminar» con series pendientes dice cuántas quedan y deja seguir', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('.hoja .aviso-hoja'));
  assert.match(a.doc.querySelector('.hoja .aviso-hoja').textContent, /Te quedan 4 series.*2 de press de pecho en máquina, 2 de press inclinado en máquina/s);
  a.clic('.hoja [data-act="sesion.seguir"]'); await a.tic();
  assert.equal(S1().estado, 'en_curso');
});

test('«Cambiar por otro» con series hechas: confirmando, lo hecho se queda y el nuevo hace las que faltan', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiar"]'));
  a.clic('[data-act="sesion.cambiar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiarPor"]'));
  assert.match(a.doc.querySelector('.hoja').textContent, /Tienes 1 serie hecha/);
  const nuevo = a.doc.querySelector('[data-act="sesion.cambiarPor"]').dataset.id;
  a.clic('[data-act="sesion.cambiarPor"]'); await a.esperar(() => a.doc.querySelector('.hoja [data-r="1"]'));
  a.clic('.hoja [data-r="1"]'); await a.esperar(() => S1().ejercicios.length === 3);
  const [viejo, n] = S1().ejercicios;
  assert.equal(viejo.id, 'press-pecho-maquina');
  assert.deepEqual(viejo.sets.map(z => z.hecha), [true]);
  assert.equal(n.id, nuevo);
  assert.equal(n.sets.length, 2);
});

test('el dolor del cierre parte del último apuntado si no hay check-in ni lesión que lo diga', async () => {
  const b = lista();
  b.sesiones.s1.checkin = { energia: 3, dolor: {} };
  b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: null, desde: '2026-01-01', nota: '', activa: true });
  b.dolor = [{ fecha: '2026-11-01', zona: 'rodilla', dolor: 2, momento: 'despues' }, { fecha: '2026-11-10', zona: 'rodilla', dolor: 4, momento: 'despues' }];
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('.hoja [data-zona="rodilla"]'));
  assert.equal(a.doc.querySelector('.hoja [data-zona="rodilla"]').value, '4');
  // El selector ± cambia el valor que se guarda
  a.clic(a.doc.querySelector('.hoja [data-zona="rodilla"]').closest('.selector').querySelector('[data-paso="-1"]')); await a.tic();
  a.clic('.hoja [data-act="sesion.cerrar"]'); await a.tic();
  assert.equal(S1().estado, 'hecha');
  assert.deepEqual(S1().cierre.dolor, { rodilla: 3 });
  // La pantalla final sale encima de Hoy y se quita con «Volver a Hoy»
  assert.equal(a.w.location.hash, '#hoy');
  assert.ok(a.doc.querySelector('.final [data-fin-hoy]'));
  a.clic('.final [data-fin-hoy]'); await a.tic();
  assert.equal(a.doc.querySelector('.final'), null);
});

test('la sesión hecha no tiene nada que marcar y no arranca el temporizador', async () => {
  const b = lista();
  Object.assign(b.sesiones.s1, { estado: 'hecha', terminada: new Date().toISOString(), cierre: { esfuerzo: 3, dolor: {}, comentario: '' } });
  b.sesiones.s1.ejercicios[0].sets[0].hecha = true;
  await reiniciar(b);
  await a.ir('sesion/s1');
  assert.equal(a.doc.querySelectorAll('#vista [data-act="sesion.serie"], #vista [data-act="sesion.cuenta"], #vista [data-act="sesion.terminar"]').length, 0);
  assert.match(a.doc.querySelector('.cab-sesion').textContent, /hecha/);
});

test('fin del descanso: tres vibraciones (250-120-250-120-250 ms) una sola vez, alarma en la barra con el foco', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  await a.espera(300); // el toque de «Guardar sesión» de la prueba anterior
  vibra.length = 0;
  crono.descanso(1, 'Serie 2 de 3', { sesion: 's1', siguiente: 'A por la serie 2' });
  const el = await a.esperar(() => a.doc.querySelector('#temporizador.descanso--alarma'), { max: 2500 });
  assert.deepEqual(vibra, [[250, 120, 250, 120, 250]]);
  assert.equal(el.getAttribute('role'), 'alert');
  assert.match(el.textContent, /A por la serie 2/);
  assert.equal(a.doc.activeElement, el);
  a.clic('#temporizador [data-t="cerrar"]'); await a.tic();
  assert.equal(a.doc.querySelector('#temporizador'), null);
  assert.equal(vibra.length, 1);
});

test('el contador con el móvil bloqueado no apunta solo: pregunta, con el objetivo de partida, y apunta lo elegido', async () => {
  const s = sesionDemo();
  s.ejercicios[0] = { id: 'plancha', rol: 'principal', series: 2, reps: '30-45s', descanso: 0, kg: null, nota: '', motivo: '', sets: [1, 2].map(() => ({ kg: null, valor: '', hecha: false })), gusto: null, comentario: '' };
  await reiniciar(estadoBase({ sesiones: { s1: s } }));
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.cuenta"][data-s="0"]'); await a.esperar(() => a.doc.querySelector('#temporizador.contador'));
  await a.ocultar(true);
  const real = Date.now; Date.now = () => real() + 10 * 60 * 1000;
  try {
    await a.ocultar(false);
    await a.esperar(() => a.doc.querySelector('#temporizador.contador.confirmar'));
    assert.equal(a.doc.querySelector('#temporizador .contador-reloj').textContent, '0:45');
    assert.equal(S1().ejercicios[0].sets[0].hecha, false);
    a.clic('#temporizador [data-t="conf-menos"]'); await a.tic();
    a.clic('#temporizador [data-t="apuntar"]'); await a.tic();
  } finally { Date.now = real; }
  assert.deepEqual([S1().ejercicios[0].sets[0].hecha, S1().ejercicios[0].sets[0].valor], [true, '40']);
});

// ── Revisión del PR #40 ──
test('R05: lo propagado de la serie anterior no se queda anticuado (bajas la serie 2 y la 3 baja con ella)', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  const pasos = (n, d, veces) => { for (let k = 0; k < veces; k++) a.clic(a.doc.querySelectorAll('[data-actual] .selector')[n].querySelector(`[data-paso="${d}"]`)); };
  pasos(0, 1, 1); pasos(1, 1, 1); // serie 1: 42,5 × 9
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.deepEqual([S1().ejercicios[0].sets[2].kg, S1().ejercicios[0].sets[2].valor], [42.5, '9']);
  await a.espera(260); // otra serie justo después cuenta como doble toque (240 ms)
  pasos(0, -1, 2); pasos(1, -1, 2); // serie 2: 37,5 × 7
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="1"]'); await a.tic();
  assert.deepEqual([S1().ejercicios[0].sets[2].kg, S1().ejercicios[0].sets[2].valor], [37.5, '7']);
});

test('dos pestañas: si la otra quita el temporizador («Saltar»), aquí se para sin alarma ni vibración', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  crono.descanso(1, 'Serie 2 de 3', { sesion: 's1', siguiente: 'A por la serie 2' });
  assert.ok(a.doc.querySelector('#temporizador.descanso'));
  await a.espera(300); vibra.length = 0;
  a.w.dispatchEvent(new a.w.StorageEvent('storage', { key: 'pipos-temporizador', newValue: null }));
  assert.equal(a.doc.querySelector('#temporizador'), null);
  assert.equal(crono.activo(), false);
  await a.espera(1200);
  assert.equal(a.doc.querySelector('#temporizador'), null, 'salió una alarma fantasma');
  assert.deepEqual(vibra, []);
});

test('dos pestañas: si la otra empieza un descanso, aquí se adopta', async () => {
  await reiniciar(lista());
  await a.ir('sesion/s1');
  const g = { tipo: 'descanso', etiqueta: 'Serie 3 de 3', meta: { sesion: 's1', siguiente: 'A por la serie 3' }, fases: [{ f: 'descanso', dur: 60 }], i: 0, inicio: Date.now(), pausa: null, tiempos: [], avisos: {}, confirmar: null };
  a.w.dispatchEvent(new a.w.StorageEvent('storage', { key: 'pipos-temporizador', newValue: JSON.stringify(g) }));
  await a.tic();
  assert.match(a.doc.querySelector('#temporizador .descanso-et').textContent, /Serie 3 de 3/);
  crono.parar();
});

test('cerrar la sesión de ayer no corta el descanso de otra y apunta el dolor en su día', async () => {
  const b = lista();
  Object.assign(b.sesiones.s1, { fecha: '2026-11-01', checkin: { energia: 3, dolor: { rodilla: 2 } } });
  b.sesiones.otra = sesionDemo('otra'); // la de hoy, que existe (un descanso de una sesión que ya no está se quita)
  b.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 2, desde: '2026-01-01', nota: '', activa: true });
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  crono.descanso(90, 'Serie 2 de 3', { sesion: 'otra', siguiente: 'A por la serie 2' });
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cerrar"]'));
  a.clic('[data-act="sesion.cerrar"]'); await a.tic();
  assert.equal(S1().estado, 'hecha');
  assert.ok(crono.activo(), 'paró el descanso de otra sesión');
  const d = a.estado.estado().dolor.filter(x => x.sesion === 's1');
  assert.deepEqual(d.map(x => [x.fecha, x.momento]), [['2026-11-01', 'despues'], ['2026-11-01', 'antes']]);
  crono.parar();
  a.clic('.final [data-fin-hoy]');
});
