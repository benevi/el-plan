// PR 12 (revisión) en jsdom: «Reintentar con IA» solo con la sesión sin tocar ni el cronómetro en marcha,
// sin hoja de espera cuando la IA no se va a usar (dolor ≥ 7) y el reintento sobrevive a una pregunta previa.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

let llamadas = 0;
const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = id => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.' });
const BUENA = { nombre: 'Torso de la IA', foco: 'x', cambios: [], explicacion: ['Hoy torso.'], calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')], vueltaCalma: [T('Estirar pecho', '1 min'), T('Estiramiento de cuádriceps', '1 min')] };
const a = await montar({
  ls: { pipos4: estadoBase() }, hash: 'hoy',
  antes: () => { globalThis.fetch = async () => { llamadas++; return new Response(JSON.stringify({ sesion: BUENA }), { headers: { 'content-type': 'application/json' } }); }; },
});
after(() => a.cerrar());
const modelo = await import(modulo('js/nucleo/modelo.js'));
const crono = await import(modulo('js/areas/sesion/temporizador.js'));

// Estado con una sesión de hoy hecha por la app por un fallo de la IA.
async function conSesionDeLaApp({ perfil = p => p, dolor = {}, motivo = 'no hay conexión con el servidor' } = {}) {
  const b = estadoBase();
  b.ajustes.codigo = 'secreto';
  perfil(b.perfil);
  const s = modelo.crearSesion({ fuente: 'reglas', nombre: 'De la app', lugar: 'gym', minutos: 60, checkin: { energia: 3, dolor, tiempo: 60 },
    calentamiento: [T('Bici')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho')], vuelta: [T('Estirar')],
    iaFallo: { motivo, peticion: 'algo de core', diaPlan: null, reintentable: true } });
  b.sesiones[s.id] = s;
  a.w.localStorage.setItem('pipos4', JSON.stringify(b));
  a.estado.cargar();
  a.doc.querySelectorAll('.hoja-fondo').forEach(f => f.remove());
  await a.ir('perfil'); await a.ir('hoy');
  return s.id;
}
const boton = () => a.doc.querySelector('.nota-fallo [data-act="entrenador.reintentarIA"]');

test('sin tocar se ofrece; con kilos apuntados o el cronómetro de esa sesión en marcha, no', async () => {
  const id = await conSesionDeLaApp();
  assert.ok(boton(), 'sin tocar: se ofrece');
  a.estado.cambiar(S => { S.sesiones[id].ejercicios[0].sets[0].kg = 40; }, 'sesion');
  await a.tic();
  assert.match(a.doc.querySelector('.nota-fallo').textContent, /La ha hecho la app porque no hay conexión/);
  assert.equal(boton(), null, 'con kilos apuntados no');

  const id2 = await conSesionDeLaApp();
  crono.cuenta({ lo: 30, hi: 30, etiqueta: 'Plancha', meta: { sesion: id2, e: 0, s: 0 } });
  await a.ir('progreso'); await a.ir('hoy');
  assert.equal(boton(), null, 'con su cronómetro en marcha no');
  crono.parar();
  await a.ir('progreso'); await a.ir('hoy');
  assert.ok(boton(), 'parado el cronómetro, otra vez sí');
});

test('con dolor de 7 o más no aparece la hoja de espera (la IA no se usa)', async () => {
  const id = await conSesionDeLaApp({ perfil: p => p.lesiones.push({ id: 'l1', zona: 'hombro', dolor: 3, desde: '2026-01-01', nota: '', activa: true }), dolor: { hombro: 8 } });
  let espera = false;
  const obs = new a.w.MutationObserver(() => { if (a.doc.querySelector('.hoja.espera')) espera = true; });
  obs.observe(a.doc.body, { childList: true, subtree: true });
  const b = a.doc.createElement('button'); b.dataset.act = 'entrenador.reintentarIA'; b.dataset.v = id; a.vista().append(b);
  llamadas = 0;
  a.clic(b);
  await a.espera(50); await a.tic();
  obs.disconnect();
  assert.equal(espera, false);
  assert.equal(llamadas, 0);
});

test('un reintento que antes pregunta «¿desde cuándo?» sigue siendo reintento: no deja dos sesiones', async () => {
  await conSesionDeLaApp({ perfil: p => p.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 2, desde: '', nota: '', activa: true }) });
  a.clic(boton());
  await a.esperar(() => /¿Desde cuándo te duele/.test((a.doc.querySelector('.hoja') || {}).textContent || ''));
  a.clic('[data-act="entrenador.ciDesde"][data-v="mas3m"]');
  await a.esperar(() => a.doc.querySelector('[data-act="entrenador.crearHoy"]'));
  a.clic('[data-act="entrenador.crearHoy"]');
  await a.esperar(() => !a.doc.querySelector('.hoja'), { max: 4000 });
  await a.espera(50);
  assert.equal(Object.keys(a.estado.estado().sesiones).length, 1);
});

test('S1 (revisión #46): tras el tope diario de la IA no se ofrece «Reintentar con IA» y se dice a qué hora vuelve', async () => {
  const api = await import(modulo('js/nucleo/api.js'));
  const motivo = api.textoError(new api.ErrorApi('se ha llegado al tope diario de llamadas a la IA; hoy la app hace las sesiones con sus reglas', { status: 429 }));
  assert.match(motivo, /vuelve a estar a las \d\d:00/);
  assert.equal(api.horaVuelveIA(new Date('2026-11-22T10:00:00Z')), '01:00', 'en invierno, la 1 en España');
  assert.equal(api.horaVuelveIA(new Date('2027-07-01T10:00:00Z')), '02:00', 'en verano, las 2');
  await conSesionDeLaApp({ motivo });
  assert.match(a.doc.querySelector('.nota-fallo').textContent, /tope diario/);
  assert.equal(boton(), null);
});

test('M20: tras «Reintentar con IA» con éxito el aviso dice el resultado, no «Se lo pides al entrenador IA.»', async () => {
  await conSesionDeLaApp();
  a.clic(boton());
  await a.esperar(() => Object.values(a.estado.estado().sesiones).some(s => s.fuente === 'ia'), { max: 4000 });
  await a.esperar(() => !a.doc.querySelector('.hoja.espera'), { max: 4000 });
  await a.tic();
  const txt = (a.doc.querySelector('#aviso') || {}).textContent || '';
  assert.doesNotMatch(txt, /Se lo pides al entrenador IA/);
  assert.match(txt, /El entrenador IA ha rehecho tu sesión/);
});
