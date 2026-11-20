// PR 12 · api/entrenador.js en vivo (D6): con «Accept: text/event-stream» responde en streaming con progreso,
// latidos y el mismo resultado que en JSON; corta por inactividad (no por tiempo total), por el tope de
// Vercel y al irse el móvil; los errores llegan como evento con el estado y el mensaje fijo.
import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Respuesta, peticion, mensaje, clienteSimulado, clienteEnVivo, espera, delta } from './_simulado.mjs';
import handler, { ponerTiempos } from '../../api/entrenador.js';
import { ponerClienteIA, Anthropic } from '../../api/_comun.js';

const cuerpoMinimo = { modo: 'sesion', catalogo: [{ id: 'remo', m: ['espalda'], l: ['gym'], niv: 1, t: 'reps' }], perfil: { notas: 'nada' } };
const sesionIA = { nombre: 'Torso', foco: 'Espalda', cambios: [], explicacion: ['Hoy torso.'], calentamiento: [], vueltaCalma: [], ejercicios: [
  { id: 'remo', rol: 'principal', series: 3, reps: '8-10', descanso: 90, kg: 30, nota: 'Remo para tu espalda.' },
  { id: 'inventado', rol: 'principal', series: 3, reps: '8-10', descanso: 90, kg: 30, nota: 'No existe.' },
] };
const VIVO = { accept: 'text/event-stream' };
// Los temporizadores del servidor no retienen el proceso (unref: en Vercel lo retiene la petición abierta);
// aquí no hay socket, así que un temporizador propio mantiene vivo el bucle mientras duran las pruebas.
const vivo = setInterval(() => {}, 1000);
after(() => clearInterval(vivo));
let registros, errores, logAntes, errorAntes;
beforeEach(() => {
  process.env.APP_CODE = 'secreto'; process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
  registros = []; errores = [];
  logAntes = console.log; errorAntes = console.error;
  console.log = (...a) => registros.push(a.join(' ')); console.error = (...a) => errores.push(a.join(' '));
});
afterEach(() => { console.log = logAntes; console.error = errorAntes; ponerClienteIA(null); ponerTiempos(); });
const registro = () => registros.map(l => { try { return JSON.parse(l).entrenador; } catch (e) { return null; } }).filter(Boolean);

// Guion que escribe el JSON de la sesión en trozos, con una pausa entre ellos.
const escribe = (texto, pausa = 5) => async emitir => {
  emitir({ type: 'message_start', message: {} });
  emitir({ type: 'content_block_start', index: 0, content_block: { type: 'thinking' } });
  await espera(pausa);
  emitir({ type: 'content_block_start', index: 1, content_block: { type: 'text' } });
  for (let i = 0; i < texto.length; i += 60) { emitir(delta(texto.slice(i, i + 60))); await espera(pausa); }
  return mensaje(texto);
};
async function llamar(cliente, opciones = {}) {
  ponerClienteIA(cliente);
  const res = new Respuesta();
  await handler(peticion({ cuerpo: cuerpoMinimo, cabeceras: VIVO, ...opciones }), res);
  return res;
}

test('en vivo: inicio, progreso de ejercicios y «fin» con el mismo objeto que en JSON', async () => {
  const res = await llamar(clienteEnVivo(escribe(JSON.stringify(sesionIA)), Anthropic.APIUserAbortError));
  assert.equal(res.codigo, 200);
  assert.match(res.cabeceras['content-type'], /^text\/event-stream/);
  assert.equal(res.cabeceras['cache-control'], 'no-store');
  assert.equal(res.writableEnded, true);
  const ev = res.eventos();
  assert.deepEqual(ev[0], { t: 'inicio', modo: 'sesion' });
  const prog = ev.filter(e => e.t === 'progreso');
  assert.equal(prog[0].fase, 'pensando');
  assert.equal(prog.at(-1).fase, 'escribiendo');
  assert.equal(prog.at(-1).ejercicios, 2);
  const fin = ev.at(-1);
  assert.equal(fin.t, 'fin');
  // Lo mismo que devuelve el modo JSON con la misma respuesta de la IA.
  ponerClienteIA(clienteSimulado(() => mensaje(sesionIA)));
  const json = new Respuesta();
  await handler(peticion({ cuerpo: cuerpoMinimo }), json);
  assert.deepEqual({ sesion: fin.sesion }, json.cuerpo);
  assert.equal(registro()[0].enVivo, true);
  assert.equal(registro()[0].resultado, 'ok');
});

test('el plan cuenta los días escritos sobre los pedidos', async () => {
  const plan = { resumen: 'r', criterios: 'c', progresion: 'p', dias: [{ diaSemana: 3, lugar: 'gym', ejercicios: [] }, { diaSemana: 5, lugar: 'gym', ejercicios: [] }] };
  const res = await llamar(clienteEnVivo(escribe(JSON.stringify(plan)), Anthropic.APIUserAbortError), {
    cuerpo: { ...cuerpoMinimo, modo: 'plan', semana: { dias: [3, 5], lugares: [{ id: 'gym' }] } },
  });
  const prog = res.eventos().filter(e => e.t === 'progreso');
  assert.deepEqual(prog.at(-1), { t: 'progreso', fase: 'escribiendo', dias: 2, de: 2 });
  assert.equal(res.eventos().at(-1).t, 'fin');
});

test('corte por inactividad, no por tiempo total: lo largo que sigue llegando no se corta', async () => {
  ponerTiempos({ inactividad: 80, latido: 1000 });
  // 30 trozos cada 20 ms = 600 ms en total, nunca 80 ms sin nada.
  const res = await llamar(clienteEnVivo(escribe(JSON.stringify(sesionIA).padEnd(1, ' '), 20), Anthropic.APIUserAbortError));
  assert.equal(res.eventos().at(-1).t, 'fin');
});

test('sin eventos de Claude en el tiempo de inactividad → error 504 y la llamada a Claude se aborta', async () => {
  ponerTiempos({ inactividad: 60 });
  const cliente = clienteEnVivo(async emitir => { emitir({ type: 'message_start', message: {} }); await new Promise(() => {}); }, Anthropic.APIUserAbortError);
  const res = await llamar(cliente);
  assert.deepEqual(res.eventos().at(-1), { t: 'error', status: 504, error: 'la IA ha dejado de responder' });
  assert.equal(cliente.llamadas[0].opciones.signal.aborted, true);
  assert.equal(res.writableEnded, true);
  assert.equal(registro()[0].resultado, 'inactividad');
});

test('latidos mientras la IA piensa', async () => {
  ponerTiempos({ latido: 20 });
  const res = await llamar(clienteEnVivo(async emitir => { emitir({ type: 'message_start', message: {} }); await espera(90); return mensaje(sesionIA); }, Anthropic.APIUserAbortError));
  assert.ok(res.eventos().filter(e => e.t === 'latido').length >= 2);
  assert.equal(res.eventos().at(-1).t, 'fin');
});

test('tope antes del de Vercel → error 504 claro', async () => {
  ponerTiempos({ limite: 60, inactividad: 10_000, latido: 1000 });
  const cliente = clienteEnVivo(async (emitir, señal) => { while (!señal.aborted) { emitir(delta(' ')); await espera(10); } }, Anthropic.APIUserAbortError);
  const res = await llamar(cliente);
  assert.deepEqual(res.eventos().at(-1), { t: 'error', status: 504, error: 'la IA ha dejado de responder' });
  assert.equal(cliente.llamadas[0].opciones.signal.aborted, true);
});

test('si el móvil se va: se aborta la llamada a Claude, no se escribe nada más y se registra «cancelada»', async () => {
  ponerTiempos({ latido: 10 });
  const cliente = clienteEnVivo(async (emitir, señal) => { while (!señal.aborted) { emitir(delta('x')); await espera(5); } }, Anthropic.APIUserAbortError);
  ponerClienteIA(cliente);
  const res = new Respuesta();
  const enCurso = handler(peticion({ cuerpo: cuerpoMinimo, cabeceras: VIVO }), res);
  await espera(30);
  res.cortar();
  const n = (res.trozos || []).length;
  await enCurso;
  await espera(40);
  assert.equal(cliente.llamadas[0].opciones.signal.aborted, true);
  assert.equal((res.trozos || []).length, n, 'ni latidos ni progreso tras cortar');
  assert.equal(registro().length, 1);
  assert.equal(registro()[0].resultado, 'cancelada');
});

const h = new Headers();
const casos = [
  ['429 al pedir', () => { throw Anthropic.APIError.generate(429, { type: 'error', error: { type: 'rate_limit_error', message: 'CRUDO' } }, 'CRUDO', h); }, 429, 'demasiadas peticiones, prueba en un minuto'],
  ['529 al pedir', () => { throw Anthropic.APIError.generate(529, { type: 'error', error: { type: 'overloaded_error', message: 'CRUDO' } }, 'CRUDO', h); }, 529, 'la IA está saturada ahora mismo, prueba en unos minutos'],
  ['saturada a mitad', async emitir => { emitir(delta('{"nombre":')); throw new Anthropic.APIError(undefined, { type: 'error', error: { type: 'overloaded_error', message: 'CRUDO' } }, 'CRUDO', h, 'overloaded_error'); }, 529, 'la IA está saturada ahora mismo, prueba en unos minutos'],
  ['stop_reason max_tokens', () => mensaje(sesionIA, { stop_reason: 'max_tokens' }), 502, 'respuesta incompleta de la IA'],
  ['JSON roto', () => mensaje('{"nombre": "Tor'), 502, 'la IA devolvió una respuesta que no se pudo leer'],
];
for (const [nombre, guion, status, error] of casos) {
  test(`en vivo, ${nombre} → evento de error ${status} sin texto crudo`, async () => {
    const res = await llamar(clienteEnVivo(guion, Anthropic.APIUserAbortError));
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.eventos().at(-1), { t: 'error', status, error });
    assert.ok(!(res.trozos || []).join('').includes('CRUDO'));
  });
}

test('la puerta no cambia en vivo: 401, 405 y 400 siguen siendo respuestas normales', async () => {
  const cliente = clienteEnVivo(escribe('{}'), Anthropic.APIUserAbortError);
  let res = await llamar(cliente, { codigo: 'otro' });
  assert.equal(res.codigo, 401);
  assert.deepEqual(res.cuerpo, { error: 'código de acceso incorrecto' });
  res = await llamar(cliente, { codigo: null, cabeceras: { ...VIVO, authorization: 'Bearer secreto' } });
  assert.equal(res.codigo, 200, 'Bearer también vale');
  res = await llamar(cliente, { metodo: 'GET' });
  assert.equal(res.codigo, 405);
  res = await llamar(cliente, { cuerpo: { ...cuerpoMinimo, catalogo: [] } });
  assert.equal(res.codigo, 400);
});
