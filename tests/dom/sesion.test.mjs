// Pantalla de sesión (jsdom): botón atrás con la hoja de cierre, doble toque, cambiar ejercicio, cierre y
// cuenta atrás con el móvil bloqueado (t07, t08 y t09 de la auditoría). PR 13 y PR 15.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, fijarFecha } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const a = await montar({ ls: { pipos4: estadoBase({ sesiones: { s1: sesionDemo() } }) }, hash: 'hoy' });
after(() => a.cerrar());
const S1 = () => a.estado.estado().sesiones.s1;

async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}

test('«atrás» con la hoja de cierre abierta no da por guardada una sesión que no se guardó', async () => {
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('#c-com'));
  a.doc.querySelector('#c-com').value = 'Me molestó el hombro en el press';
  a.w.history.back(); await a.esperar(() => a.w.location.hash !== '#sesion/s1' || !a.doc.querySelector('.hoja')); await a.tic();
  const hojaAbierta = !!a.doc.querySelector('.hoja');
  if (hojaAbierta) { a.clic('[data-act="sesion.cerrar"]'); await a.esperar(() => (a.doc.querySelector('#aviso') || {}).textContent); }
  const aviso = (a.doc.querySelector('#aviso') || {}).textContent || '';
  // O bien «atrás» cierra la hoja, o bien, si se guarda, la sesión queda de verdad cerrada.
  assert.ok(!hojaAbierta || S1().estado === 'hecha', `hoja abierta tras «atrás»; aviso «${aviso}» y la sesión sigue ${S1().estado}`);
});

const base = () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo(), h1: sesionDemo('h1', { estado: 'hecha', fecha: '2026-11-01', terminada: '2026-11-01T18:00:00Z', cierre: { esfuerzo: 3, dolor: {}, comentario: '' } }) } });
  b.perfil.lesiones.push({ id: 'l1', zona: 'tobillo_pie', dolor: 5, desde: '2026-01-01', nota: '', activa: true });
  b.ajustes.modoSesion = 'lista';
  return b;
};

test('un toque en la serie la marca y arranca el descanso', async () => {
  await reiniciar(base());
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.esperar(() => a.doc.querySelector('#temporizador'));
  assert.equal(S1().ejercicios[0].sets[0].hecha, true);
  assert.ok(a.doc.querySelector('#temporizador'));
});

test('un doble toque accidental no desmarca la serie', async () => {
  await reiniciar(base());
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  assert.equal(S1().ejercicios[0].sets[0].hecha, true);
});

test('«Cambiar por otro» con series ya hechas pide confirmación', async () => {
  await reiniciar(base());
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiar"]'));
  a.clic('[data-act="sesion.cambiar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiarPor"]'));
  a.clic('[data-act="sesion.cambiarPor"]'); await a.tic();
  assert.equal(S1().ejercicios[0].id, 'press-pecho-maquina', `cambiado a ${S1().ejercicios[0].id} sin confirmar`);
});

test('el dolor del cierre parte del último valor conocido de la lesión', async () => {
  await reiniciar(base());
  await a.ir('sesion/s1');
  // Una serie hecha: sin ninguna, «Terminar» no ofrece el cierre (E7, posterior a esta prueba).
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('.hoja [data-zona="tobillo_pie"]'));
  assert.equal(a.doc.querySelector('.hoja [data-zona="tobillo_pie"]').value, '5');
});

test('una sesión ya hecha se ve en modo lectura (tocar una serie no arranca un descanso)', async () => {
  await reiniciar(base());
  a.w.localStorage.removeItem('pipos-temporizador');
  await a.ir('sesion/h1');
  const serie = a.doc.querySelector('[data-act="sesion.serie"][data-e="0"][data-s="0"]');
  if (serie) { a.clic(serie); await a.tic(); }
  assert.ok(!a.doc.querySelector('#temporizador'), 'arrancó un descanso');
  assert.equal(a.w.localStorage.getItem('pipos-temporizador'), null);
});

test('la cuenta atrás de un ejercicio por tiempo no apunta 10 minutos si el móvil se bloquea', async () => {
  const ses = sesionDemo();
  ses.ejercicios[0] = { id: 'plancha', rol: 'principal', series: 3, reps: '30-45s', descanso: 60, kg: null, nota: '', motivo: '', sets: [1, 2, 3].map(() => ({ kg: null, valor: '', hecha: false })), gusto: null, comentario: '' };
  await reiniciar(estadoBase({ sesiones: { s1: ses } }));
  await a.ir('sesion/s1');
  const reloj = fijarFecha(new Date().toISOString());
  try {
    a.clic('[data-act="sesion.cuenta"][data-s="0"]'); await a.esperar(() => a.doc.querySelector('#temporizador .c-arriba'));
    await a.ocultar(true);
    reloj.avanzar(10 * 60 * 1000); // 10 minutos con la pantalla bloqueada
    await a.ocultar(false);
    // Lo correcto puede ser no apuntar nada: se espera a que apunte o a un máximo de 1 s.
    await a.esperar(() => S1().ejercicios[0].sets[0].hecha, { max: 1000, lanzar: false });
  } finally { reloj.restaurar(); }
  const z = S1().ejercicios[0].sets[0];
  assert.ok(!(z.hecha && +z.valor > 120), `serie apuntada: ${JSON.stringify(z)}`);
});
