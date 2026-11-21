// Arreglos del informe de pruebas del 21-11-2026 en pantalla (jsdom): E2 «Tu semana» sin días pasados, E3 la
// hoja del check-in no salta, E4 «Más opciones» sin teclado, E5 cardio en minutos, E7 sesión sin series,
// E9 «Algo va mal» y «dolor durante», E12 el interruptor de la IA solo cuando se puede, E13 «Hoy no puedo»
// el último día y N4 lo que sí se atendió de la petición. La lógica, en tests/qa-informe.test.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, fijarFecha, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

let reloj = fijarFecha('2026-11-21T10:00'); // sábado
const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
after(() => { reloj.restaurar(); a.cerrar(); });

async function reiniciar(datos) {
  a.w.localStorage.setItem('pipos4', JSON.stringify(datos));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
}
const hoja = () => a.doc.querySelector('.hoja');
const textoHoja = () => (hoja() || {}).textContent || '';
const cambio = (sel, v) => { const el = a.doc.querySelector(sel); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new a.w.Event('change', { bubbles: true })); };
const abrirCheckin = async () => {
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; a.doc.querySelector('#vista').append(b);
  a.clic(b); await a.esperar(() => a.doc.querySelector('.hoja.checkin [data-act="entrenador.crearHoy"]'));
};
const conLesion = (zona, dolor, extra = {}) => { const b = estadoBase(extra); b.perfil.lesiones.push({ id: 'l1', zona, dolor, desde: '2025-01-01', tipo: 'recurrente', nota: '', activa: true }); return b; };

// ── E2 ──
test('E2: un sábado, «Tu semana» no trae marcados ni deja marcar los días pasados, y no cambia los días por semana del perfil', async () => {
  await reiniciar(estadoBase());
  a.clic('[data-act="entrenador.plan"]'); await a.esperar(() => a.doc.querySelector('[data-act="entrenador.psDia"]'));
  for (const d of [1, 2, 3, 4, 5]) {
    const b = a.doc.querySelector(`[data-act="entrenador.psDia"][data-v="${d}"]`);
    assert.ok(!b.classList.contains('on'), `día ${d} marcado`);
    assert.ok(b.disabled, `día ${d} se puede tocar`);
  }
  a.clic('[data-act="entrenador.psDia"][data-v="6"]'); await a.tic();
  a.clic('[data-act="entrenador.psDia"][data-v="7"]'); await a.tic();
  assert.match(textoHoja(), /2 días por planificar/);
  a.clic('[data-act="entrenador.crearPlan"][data-ia="0"]');
  await a.esperar(() => a.estado.estado().plan);
  const S = a.estado.estado();
  assert.deepEqual(S.plan.dias.map(d => d.diaSemana), [6, 7]);
  assert.equal(S.perfil.disponibilidad.dias, 3, 'días por semana del perfil');
  assert.deepEqual(S.perfil.disponibilidad.diasSemana, []);
});

// ── E3 ──
test('E3: la hoja del check-in se abre arriba sin foco en la casilla de alarma y no vuelve arriba al tocar una opción', async () => {
  await reiniciar(estadoBase());
  await abrirCheckin();
  await a.espera(260); // el foco automático de abrirHoja va a los 200 ms
  assert.ok(!a.doc.activeElement || !a.doc.activeElement.matches('[data-cambio="entrenador.ciAlarma"]'), 'el foco va a la casilla de alarma');
  assert.equal(hoja().scrollTop, 0);
  await reiniciar(conLesion('rodilla', 4));
  await abrirCheckin();
  hoja().scrollTop = 300;
  a.clic('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await a.tic();
  assert.equal(hoja().scrollTop, 300, 'tras tocar Energía 4');
  a.clic('[data-act="entrenador.ciZona"][data-v="hombro"]'); await a.tic();
  assert.equal(hoja().scrollTop, 300, 'tras añadir una zona');
  cambio('[data-cambio="entrenador.ciDolor"][data-z="rodilla"]', 8); await a.esperar(() => a.doc.querySelector('[data-r="1"]'));
  a.clic('[data-r="1"]'); await a.esperar(() => a.doc.querySelector('.hoja.checkin'));
  assert.equal(hoja().scrollTop, 300, 'tras confirmar 7 o más');
});

// ── E4 ──
test('E4: «Más opciones» de un ejercicio no pone el foco en el comentario', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('#m-com'));
  await a.espera(260);
  assert.notEqual(a.doc.activeElement && a.doc.activeElement.id, 'm-com');
});

// ── E5 ──
test('E5: el cardio por minutos se apunta y se enseña en minutos', async () => {
  const s = sesionDemo();
  s.ejercicios.push({ id: 'bici-estatica', rol: 'cardio', series: 1, reps: '8 min', descanso: 0, kg: null, nota: '', motivo: '', sets: [{ kg: null, valor: '', hecha: false }], gusto: null, comentario: '' });
  const b = estadoBase({ sesiones: { s1: s } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  const fila = a.doc.querySelector('#ej-2 .serie');
  assert.equal(fila.querySelector('small').textContent, 'min');
  assert.equal(fila.querySelector('input').placeholder, '8');
  assert.match(fila.querySelector('[data-act="sesion.cuenta"]').getAttribute('aria-label'), /8 minutos/);
  a.clic('#ej-2 [data-act="sesion.serie"]'); await a.tic();
  assert.equal(a.estado.estado().sesiones.s1.ejercicios[2].sets[0].valor, '8');
  assert.match(a.doc.querySelector('#ej-2').textContent, /8 min/);
  assert.doesNotMatch(a.doc.querySelector('#ej-2').textContent, /seg/);
});

// ── E7 ──
test('E7: terminar sin ninguna serie no guarda la sesión como hecha (ni cuenta para la constancia)', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => hoja());
  assert.match(textoHoja(), /No has marcado nada/);
  assert.ok(!a.doc.querySelector('[data-act="sesion.cerrar"]'), 'no se ofrece guardar');
  a.clic('[data-act="sesion.seguir"]'); await a.tic();
  assert.equal(a.estado.estado().sesiones.s1.estado, 'pendiente');
  // Con una serie sí se guarda.
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cerrar"]'));
  a.clic('[data-act="sesion.cerrar"]'); await a.tic();
  assert.equal(a.estado.estado().sesiones.s1.estado, 'hecha');
});

// ── E9 ──
test('E9: «Algo va mal» enseña T3; un dolor por encima del límite para el ejercicio y queda guardado', async () => {
  const b = conLesion('hombro', 2, { sesiones: { s1: sesionDemo('s1', { checkin: { energia: 3, dolor: { hombro: 2 } } }) } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.algoVaMal"]'); await a.esperar(() => hoja());
  assert.match(textoHoja(), new RegExp(ent.T3(5).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(a.doc.querySelector('#avm-zona').value, 'hombro', 'la zona del ejercicio va primero');
  // Dentro del límite (2 + 2 = 4): no se para.
  a.doc.querySelector('#avm-dolor').value = '4';
  a.clic('[data-act="sesion.dolorDurante"]'); await a.tic();
  assert.equal(a.estado.estado().sesiones.s1.ejercicios[0].dolorDurante, undefined);
  // Por encima: se para, se guarda y no se puede marcar.
  a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.algoVaMal"][data-e="0"]'));
  a.clic('[data-act="sesion.algoVaMal"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('#avm-dolor'));
  a.doc.querySelector('#avm-dolor').value = '6';
  a.clic('[data-act="sesion.dolorDurante"]'); await a.esperar(() => /Salta/.test(textoHoja()));
  assert.deepEqual(a.estado.estado().sesiones.s1.ejercicios[0].dolorDurante, { zona: 'hombro', dolor: 6, antes: 2, techo: 5 });
  a.clic('[data-act="sesion.seguir"]'); await a.tic();
  assert.match(a.doc.querySelector('#ej-0').textContent, /Parado por dolor/);
  assert.ok(!a.doc.querySelector('[data-act="sesion.serie"][data-e="0"]'), 'sus series ya no se marcan');
  // Se guarda en los datos y sobrevive a volver a cargarlos (la copia y el progreso lo leen).
  await a.esperar(() => a.guardado().sesiones.s1.ejercicios[0].dolorDurante);
  a.estado.cargar();
  assert.deepEqual(a.estado.estado().sesiones.s1.ejercicios[0].dolorDurante, { zona: 'hombro', dolor: 6, antes: 2, techo: 5 });
});

test('E9: «Termino la sesión aquí» para la sesión en curso (C-ALAR-1) y Hoy queda sin entrenar por precaución', async () => {
  const b = estadoBase({ sesiones: { s1: sesionDemo() } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await a.tic();
  a.clic('[data-act="sesion.algoVaMal"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.pararAlarma"]'));
  a.clic('[data-act="sesion.pararAlarma"]'); await a.esperar(() => a.doc.querySelector('[data-r="1"]'));
  a.clic('[data-r="1"]'); await a.esperar(() => a.w.location.hash === '#hoy');
  await a.tic();
  const S = a.estado.estado();
  assert.equal(S.sesiones.s1.estado, 'hecha');
  assert.equal(S.sesiones.s1.parada, 'alarma');
  assert.ok(ent.sinEntrenarHoy(S));
  assert.match(a.vista().textContent, /Sin entrenar por precaución/);
});

// ── E12 ──
test('E12: «Pedírsela igualmente al entrenador IA» no sale con dolor de 7 o más, con salud que lo impide ni con la alarma marcada', async () => {
  const ahorro = estadoBase(); ahorro.perfil.usoIA = 'ahorro';
  await reiniciar(ahorro);
  await abrirCheckin();
  assert.ok(a.doc.querySelector('[data-cambio="entrenador.ciIA"]'), 'en modo ahorro sí se puede pedir');
  cambio('[data-cambio="entrenador.ciAlarma"]', true); await a.tic();
  assert.ok(!a.doc.querySelector('[data-cambio="entrenador.ciIA"]'), 'con la casilla de alarma');
  const salud = estadoBase(); salud.perfil.usoIA = 'ahorro'; salud.perfil.salud = { hipertension: 'sin_controlar' };
  await reiniciar(salud);
  await abrirCheckin();
  assert.ok(!a.doc.querySelector('[data-cambio="entrenador.ciIA"]'), 'con salud que pide la sesión suave');
  assert.doesNotMatch(textoHoja(), /Se lo pides al entrenador IA/);
  const dolor = conLesion('rodilla', 4); dolor.perfil.usoIA = 'ahorro';
  await reiniciar(dolor);
  await abrirCheckin();
  cambio('[data-cambio="entrenador.ciDolor"][data-z="rodilla"]', 8); await a.esperar(() => a.doc.querySelector('[data-r="1"]'));
  a.clic('[data-r="1"]'); await a.esperar(() => a.doc.querySelector('.hoja.checkin'));
  assert.ok(!a.doc.querySelector('[data-cambio="entrenador.ciIA"]'), 'con dolor de 7 o más');
});

// ── N4 ──
test('N4: la nota dice qué se atendió de la petición y qué no', async () => {
  const s = sesionDemo('s1', { iaFallo: { motivo: 'tienes el modo ahorro (la IA solo hace el plan)', peticion: 'pierna y glúteo, la prensa está ocupada', atendido: 'hoy pierna y glúteo', diaPlan: null, reintentable: true } });
  await reiniciar(estadoBase({ sesiones: { s1: s } }));
  const t = a.vista().textContent;
  assert.match(t, /la app ha hecho lo que entiende: hoy pierna y glúteo/);
  assert.match(t, /Lo demás no lo he podido atender/);
  assert.doesNotMatch(t, /No he podido atender lo que pediste/);
});

// ── E13 ──
test('E13: «Hoy no puedo» el último día de la semana lo apunta y Hoy lo enseña (con «Entrenar igualmente»)', async () => {
  reloj.restaurar(); reloj = fijarFecha('2026-11-22T10:00'); // domingo
  await reiniciar(estadoBase());
  await ent.crearPlanSemana({ dias: [7], minutos: 60, lugares: ['gym'] }, { conIA: false });
  await a.ir('perfil'); await a.ir('hoy');
  assert.match(a.vista().textContent, /Hoy toca/i);
  a.clic('[data-act="entrenador.hoyNo"]'); await a.tic();
  assert.ok(!a.doc.querySelector('[data-act="entrenador.reorganizar"]'), 'no abre una hoja sin días que elegir');
  assert.match(a.doc.querySelector('#aviso').textContent, /hoy \(domingo\) no entrenas/);
  await a.tic();
  const t = a.vista().textContent;
  assert.match(t, /Hoy no entrenas/);
  assert.doesNotMatch(t, /Hoy toca/i);
  assert.ok(a.doc.querySelector('[data-act="entrenador.hacerDia"][data-v="7"]'), 'Entrenar igualmente');
  assert.match(t, /Hoy no puedes/);
});

// ── Revisión del PR #38 ──
test('E13: un «Hoy no puedo» de un día que ya pasó se lee «No entrenado»', async () => {
  // Sigue en domingo (prueba anterior): el sábado se apuntó «Hoy no puedo».
  const S = a.estado.estado();
  a.estado.cambiar(S2 => { S2.plan.dias.unshift({ ...S2.plan.dias[0], diaSemana: 6 }); S2.plan.noPuedo = [6, 7]; }, 'plan');
  await a.ir('perfil'); await a.ir('hoy');
  const filas = [...a.doc.querySelectorAll('.plan-semana [data-act="entrenador.verDia"]')].map(b => b.textContent);
  assert.match(filas.find(t => /Sábado/.test(t)), /No entrenado/);
  assert.match(filas.find(t => /Domingo/.test(t)), /Hoy no puedes/);
  assert.ok(S);
});

test('E7: un día de dolor alto sin ejercicios se puede terminar con las tareas marcadas', async () => {
  reloj.restaurar(); reloj = fijarFecha('2026-11-21T10:00');
  const s = sesionDemo('s1', { tipo: 'dolorAlto', ejercicios: [],
    calentamiento: [{ id: null, nombre: 'Bici suave', detalle: '', duracion: '20 min', hecho: false }, { id: null, nombre: 'Movilidad', detalle: '', duracion: '5 min', hecho: false }],
    vuelta: [{ id: null, nombre: 'Estirar', detalle: '', duracion: '5 min', hecho: false }] });
  const b = estadoBase({ sesiones: { s1: s } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  a.clic('[data-act="sesion.tarea"][data-k="calentamiento"][data-i="0"]'); await a.tic();
  a.clic('[data-act="sesion.terminar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cerrar"]'));
  a.clic('[data-act="sesion.cerrar"]'); await a.tic();
  assert.equal(a.estado.estado().sesiones.s1.estado, 'hecha');
});

test('E9: «Cambiar por otro» dos veces en un ejercicio parado por dolor cambia el sustituto, no va sumando', async () => {
  const s = sesionDemo();
  s.ejercicios[0].dolorDurante = { zona: 'muñeca', dolor: 5, antes: 1, techo: 3 };
  const b = estadoBase({ sesiones: { s1: s } }); b.ajustes.modoSesion = 'lista';
  await reiniciar(b);
  await a.ir('sesion/s1');
  for (let k = 0; k < 2; k++) {
    a.clic('[data-act="sesion.menu"][data-e="0"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiar"]'));
    a.clic('[data-act="sesion.cambiar"]'); await a.esperar(() => a.doc.querySelector('[data-act="sesion.cambiarPor"]'));
    a.clic('[data-act="sesion.cambiarPor"]'); await a.tic();
  }
  const ejs = a.estado.estado().sesiones.s1.ejercicios;
  assert.equal(ejs.length, 3, ejs.map(x => x.id).join(', '));
  assert.ok(ejs[0].dolorDurante, 'el parado se queda con su marca');
});
