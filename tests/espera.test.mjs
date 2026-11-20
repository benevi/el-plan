// PR 12 · Espera, cancelación y errores (lado del móvil): llamarEnVivo lee la respuesta en vivo del servidor,
// corta por inactividad (no por tiempo total), distingue corte, cancelación y errores, y nunca enseña el texto
// crudo de una excepción; crearSesionHoy y crearPlanSemana guardan la nota «La ha hecho la app porque…», la
// petición sin atender, no pisan nada con una respuesta tardía y «Reintentar con IA» funciona.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, est, ponerRed } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles
const api = await import(modulo('js/nucleo/api.js'));
const { llamarEnVivo, ErrorApi, textoError } = api;

// ── Respuestas simuladas ──
const sse = o => 'data: ' + JSON.stringify(o) + '\n\n';
// Respuesta en vivo: trozos (texto o { espera: ms } o { cortar: true }); { colgar: true } deja el stream abierto.
function enVivo(trozos, { status = 200 } = {}) {
  const enc = new TextEncoder();
  return (url, o) => {
    const signal = o.signal;
    const body = new ReadableStream({
      async start(c) {
        const abortar = () => { try { c.error(Object.assign(new Error('aborted'), { name: 'AbortError' })); } catch (e) { /* ya cerrado */ } };
        signal.addEventListener('abort', abortar);
        for (const t of trozos) {
          if (signal.aborted) return;
          if (t.espera) { await new Promise(r => setTimeout(r, t.espera)); continue; }
          if (t.colgar) return; // no llega nada más
          if (t.cortar) { c.error(new TypeError('network error')); return; }
          c.enqueue(enc.encode(t));
        }
        c.close();
      },
    });
    return Promise.resolve(new Response(body, { status, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }));
  };
}
const json = (cuerpo, status = 200) => async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
let peticiones = [];
function red(f) {
  peticiones = [];
  ponerRed(true, (url, o) => { peticiones.push({ url, o, cuerpo: JSON.parse(o.body) }); return f(url, o); });
}
beforeEach(() => { nuevoS({ objetivos: ['musculo'] }); });

// ── llamarEnVivo ──
test('lee el progreso y devuelve el mismo objeto que llegaría en JSON', async () => {
  const sesion = { nombre: 'Torso', ejercicios: [{ id: 'remo' }] };
  red(enVivo([sse({ t: 'inicio' }), sse({ t: 'progreso', fase: 'pensando', ejercicios: 0 }), sse({ t: 'latido' }),
    // un evento partido en dos trozos de red
    'data: {"t":"progreso","fase":"escribiendo",', '"ejercicios":2}\n\n', sse({ t: 'fin', sesion })]));
  const vistos = [];
  const r = await llamarEnVivo('entrenador', { a: 1 }, { alProgreso: p => vistos.push(p.fase + p.ejercicios) });
  assert.deepEqual(r, { sesion });
  assert.deepEqual(vistos, ['pensando0', 'escribiendo2']);
  assert.equal(peticiones[0].o.headers.Accept, 'text/event-stream');
  assert.ok('x-app-code' in peticiones[0].o.headers);
});

test('el corte es por inactividad: una respuesta larga con latidos no se corta', async () => {
  const latidos = Array.from({ length: 8 }, () => [{ espera: 40 }, sse({ t: 'latido' })]).flat();
  red(enVivo([sse({ t: 'inicio' }), ...latidos, sse({ t: 'fin', plan: { dias: [] } })]));
  const r = await llamarEnVivo('entrenador', {}, { inactividad: 150 }); // 320 ms en total, nunca 150 sin nada
  assert.deepEqual(r, { plan: { dias: [] } });
});

test('sin noticias del servidor en el tiempo de inactividad → ErrorApi «tiempo»', async () => {
  red(enVivo([sse({ t: 'inicio' }), { colgar: true }]));
  const t0 = Date.now();
  await assert.rejects(llamarEnVivo('entrenador', {}, { inactividad: 120 }), e => e instanceof ErrorApi && e.tipo === 'tiempo');
  assert.ok(Date.now() - t0 < 2000);
});

test('stream que se corta sin «fin» → «corte»; error de red a mitad → «corte»', async () => {
  red(enVivo([sse({ t: 'inicio' }), sse({ t: 'progreso', fase: 'escribiendo', ejercicios: 1 })]));
  await assert.rejects(llamarEnVivo('entrenador', {}), e => e.tipo === 'corte');
  red(enVivo([sse({ t: 'inicio' }), { cortar: true }]));
  await assert.rejects(llamarEnVivo('entrenador', {}), e => e.tipo === 'corte');
});

test('cancelar corta al momento → «cancelada»', async () => {
  red(enVivo([sse({ t: 'inicio' }), { colgar: true }]));
  const ctrl = new AbortController();
  const p = llamarEnVivo('entrenador', {}, { signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 30);
  await assert.rejects(p, e => e.tipo === 'cancelada');
});

test('errores: 401, 429, 504, 529 (en la respuesta o a mitad del stream), sin red y JSON del servidor', async () => {
  const casos = [
    [json({ error: 'código de acceso incorrecto' }, 401), 'codigo'],
    [json({ error: 'demasiadas peticiones, prueba en un minuto' }, 429), 'ritmo'],
    [async () => new Response('<html>Gateway Timeout</html>', { status: 504 }), 'tiempo'],
    [json({ error: 'la IA está saturada ahora mismo, prueba en unos minutos' }, 529), 'sobrecarga'],
    [enVivo([sse({ t: 'inicio' }), sse({ t: 'error', status: 529, error: 'la IA está saturada ahora mismo, prueba en unos minutos' })]), 'sobrecarga'],
    [enVivo([sse({ t: 'error', status: 504, error: 'la IA ha dejado de responder' })]), 'tiempo'],
    [async () => { throw new TypeError('Failed to fetch'); }, 'sinRed'],
    [json({ error: 'el servidor no está configurado' }, 500), 'config'],
  ];
  for (const [f, tipo] of casos) {
    red(f);
    await assert.rejects(llamarEnVivo('entrenador', {}), e => e instanceof ErrorApi && e.tipo === tipo, tipo);
  }
  ponerRed(false);
  await assert.rejects(llamarEnVivo('entrenador', {}), e => e.tipo === 'sinRed');
  // Un servidor viejo que responde JSON también vale.
  red(json({ sesion: { nombre: 'x' } }));
  assert.deepEqual(await llamarEnVivo('entrenador', {}), { sesion: { nombre: 'x' } });
});

test('textoError: frases fijas, nunca el mensaje crudo', () => {
  assert.equal(textoError(new ErrorApi('x', { status: 401 })), 'el código de acceso no es correcto');
  assert.equal(textoError(new ErrorApi('x', { status: 429 })), 'se han hecho demasiadas peticiones seguidas (prueba en un minuto)');
  assert.equal(textoError(new ErrorApi('x', { status: 504 })), 'la IA ha dejado de responder');
  assert.equal(textoError(new ErrorApi('x', { status: 529 })), 'la IA está saturada ahora mismo (prueba en unos minutos)');
  assert.equal(textoError(new ErrorApi('x', { sinRed: true })), 'no hay conexión con el servidor');
  assert.equal(textoError(new TypeError("Cannot read properties of null (reading 'dias')")), 'algo falló al leer la respuesta de la IA');
  assert.equal(textoError(new ErrorApi('error 502', { status: 502 })), 'la IA no dio una respuesta válida');
  assert.equal(textoError(new ErrorApi('x'.repeat(500), { status: 502 })), 'la IA no dio una respuesta válida');
});

// ── Sesión de hoy ──
const ci0 = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true };
const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = id => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.' });
const BUENA = { nombre: 'Torso', foco: 'x', cambios: [], explicacion: ['Porque sí.'], calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')], vueltaCalma: [T('Estirar pecho', '1 min'), T('Estiramiento de cuádriceps', '1 min')] };
const sesiones = () => Object.values(est.estado().sesiones);

test('cancelar la espera deja la sesión de las reglas al momento, con la nota y la petición', async () => {
  red(enVivo([sse({ t: 'inicio' }), { colgar: true }]));
  const ctrl = new AbortController();
  const p = ent.crearSesionHoy({ ...ci0, peticion: 'hoy sin máquinas de pierna' }, { signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 20);
  const r = await p;
  assert.equal(r.sesion.fuente !== 'ia', true);
  assert.equal(r.aviso, 'La ha hecho la app porque cancelaste la espera.');
  assert.deepEqual(r.sesion.iaFallo, { motivo: 'cancelaste la espera', peticion: 'hoy sin máquinas de pierna', diaPlan: null, reintentable: true });
  assert.equal(sesiones().length, 1);
});

test('401: la nota lo dice en claro (sin texto crudo)', async () => {
  red(json({ error: 'código de acceso incorrecto' }, 401));
  const r = await ent.crearSesionHoy({ ...ci0 });
  assert.equal(r.sesion.iaFallo.motivo, 'el código de acceso no es correcto');
});

test('sin conexión y con una petición escrita: se guarda y se dice que no se pudo atender', async () => {
  ponerRed(false);
  const r = await ent.crearSesionHoy({ ...ci0, forzarIA: false, peticion: 'la prensa está ocupada' });
  assert.deepEqual(r.sesion.iaFallo, { motivo: 'no había conexión', peticion: 'la prensa está ocupada', diaPlan: null, reintentable: true });
  // Sin petición y sin IA no hay nota: no ha fallado nada.
  const r2 = await ent.crearSesionHoy({ ...ci0, forzarIA: false });
  assert.equal(r2.sesion.iaFallo, undefined);
});

test('con dolor de 7 o más no se ofrece reintentar con IA (C-DOLOR-4)', async () => {
  ponerRed(true, async () => { throw new Error('no debería llamar'); });
  est.cambiar(S => { S.perfil.lesiones.push({ id: 'l1', zona: 'hombro', dolor: 3, desde: '2026-01-01', nota: '', activa: true }); }, 'perfil');
  const r = await ent.crearSesionHoy({ ...ci0, forzarIA: false, dolorHoy: { hombro: 8 }, peticion: 'quiero hacer press militar' });
  assert.equal(r.sesion.iaFallo.reintentable, false);
});

test('una respuesta tardía no pisa una sesión empezada mientras tanto', async () => {
  let soltar;
  red(async () => { await new Promise(r => { soltar = r; }); return new Response(JSON.stringify({ sesion: BUENA }), { headers: { 'content-type': 'application/json' } }); });
  const p = ent.crearSesionHoy({ ...ci0 });
  await new Promise(r => setTimeout(r, 5));
  // Mientras espera, en otra pestaña se crea y se empieza una sesión de hoy.
  est.cambiar(S => { S.sesiones.otra = { ...structuredClone(Object.values(S.sesiones)[0] || {}), id: 'otra', fecha: est.hoyISO(), creada: new Date(Date.now() + 1000).toISOString(), estado: 'en_curso', empezada: new Date(Date.now() + 1000).toISOString(), fuente: 'reglas', nombre: 'Otra', lugar: 'gym', ejercicios: [], calentamiento: [], vuelta: [] }; }, 'sesion');
  soltar();
  const r = await p;
  assert.equal(r.descartada, true);
  assert.deepEqual(sesiones().map(s => s.id), ['otra']);
});

test('«Reintentar con IA»: si sale bien, la sesión de la IA sustituye a la de la app', async () => {
  red(json({ error: 'demasiadas peticiones, prueba en un minuto' }, 429));
  const a = await ent.crearSesionHoy({ ...ci0, peticion: 'algo de core' });
  assert.equal(a.sesion.iaFallo.motivo, 'se han hecho demasiadas peticiones seguidas (prueba en un minuto)');
  // Vuelve a fallar: se queda la misma sesión, con el motivo nuevo.
  red(json({ error: 'x' }, 529));
  const b = await ent.crearSesionHoy({ ...ci0, peticion: 'algo de core' }, { reintento: a.sesion.id });
  assert.equal(b.sesion.id, a.sesion.id);
  assert.equal(sesiones().length, 1);
  assert.equal(sesiones()[0].iaFallo.motivo, 'la IA está saturada ahora mismo (prueba en unos minutos)');
  // Sale bien: sesión de la IA, sin nota, y la de la app ya no está.
  red(json({ sesion: BUENA }));
  const c = await ent.crearSesionHoy({ ...ci0, peticion: 'algo de core' }, { reintento: a.sesion.id });
  assert.equal(c.sesion.fuente, 'ia');
  assert.equal(c.sesion.iaFallo, undefined);
  assert.deepEqual(sesiones().map(s => s.id), [c.sesion.id]);
  assert.equal(peticiones[0].cuerpo.checkin.peticion, 'algo de core', 'la petición vuelve a la IA');
});

test('la nota sobrevive a una copia (normalizador)', async () => {
  ponerRed(false);
  await ent.crearSesionHoy({ ...ci0, forzarIA: false, peticion: 'la prensa está ocupada' });
  const copia = est.exportar();
  const n = (await import(modulo('js/nucleo/normalizar.js'))).normalizarEstado(JSON.parse(copia)).estado;
  assert.deepEqual(Object.values(n.sesiones)[0].iaFallo, { motivo: 'no había conexión', peticion: 'la prensa está ocupada', diaPlan: null, reintentable: true });
});

// ── Plan de la semana ──
test('plan: si la IA falla, plan de la app con la nota y lo necesario para reintentar', async () => {
  red(enVivo([sse({ t: 'inicio' }), sse({ t: 'error', status: 504, error: 'la IA ha dejado de responder' })]));
  const r = await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] });
  assert.equal(r.aviso, 'La semana la ha hecho la app porque la IA ha dejado de responder.');
  assert.deepEqual(est.estado().plan.iaFallo, { motivo: 'la IA ha dejado de responder', semana: { dias: [3, 5], minutos: 60, lugares: ['gym'] } });
  const n = (await import(modulo('js/nucleo/normalizar.js'))).normalizarEstado(JSON.parse(est.exportar())).estado;
  assert.deepEqual(n.plan.iaFallo, est.estado().plan.iaFallo);
});

test('plan: si la semana cambia mientras se espera, la respuesta tardía se descarta', async () => {
  let soltar;
  red(async () => { await new Promise(r => { soltar = r; }); throw new TypeError('Failed to fetch'); });
  const p = ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] });
  await new Promise(r => setTimeout(r, 5));
  await ent.crearPlanSemana({ dias: [4], minutos: 45, lugares: ['gym'] }, { conIA: false });
  const antes = est.estado().plan.creado;
  soltar();
  const r = await p;
  assert.equal(r.descartada, true);
  assert.equal(est.estado().plan.creado, antes);
});
