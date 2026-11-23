// Casos de referencia de la IA sin red (PR 11, T8). Comprueba que:
// - cada caso manda (o no manda) a /api/entrenador lo que debe, sin datos personales y con los textos recortados;
// - el cuerpo pasa entero por el saneado y el servidor (con un Claude simulado) responde con él;
// - el juez aprueba una respuesta buena (la de las reglas de la app) y suspende las malas.
// Contra el endpoint de verdad: scripts/casos-ia.mjs (lo ejecuta Víctor con URL_IA y APP_CODE).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, prepararCaso, comoIA, planComoIA } from './casos.mjs';
import { juzgar } from './juez.mjs';
import { sanear, CLAVES, LIMITE_CUERPO, ponerClienteIA } from '../../api/_comun.js';
import handler from '../../api/entrenador.js';
import { reiniciarFrenos } from '../../api/_freno.js';
import { Respuesta, peticion, mensaje, clienteSimulado } from '../api/_simulado.mjs';
import { LARGO_IA } from '../../js/reglas/contexto.js';
import { LUGARES } from '../../js/datos/constantes.js';
import { T2 } from '../../js/areas/entrenador/alarma.js';
beforeEach(() => reiniciarFrenos()); // S1: sin cupo gastado entre casos

const preparados = new Map();
const preparar = async caso => { if (!preparados.has(caso.id)) preparados.set(caso.id, await prepararCaso(caso)); return preparados.get(caso.id); };
const conIA = CASOS.filter(c => c.espera === 'ia');
const buena = p => (p.caso.modo === 'plan' ? planComoIA(p.resultado.plan) : comoIA(p.resultado.sesion));
const copia = x => JSON.parse(JSON.stringify(x));

test('hay 20 casos con id único, todos con lo necesario', () => {
  assert.equal(CASOS.length, 20);
  assert.equal(new Set(CASOS.map(c => c.id)).size, 20);
  CASOS.forEach(c => {
    assert.ok(['sesion', 'plan'].includes(c.modo) && ['ia', 'sinIA'].includes(c.espera), c.id);
    assert.ok(c.modo === 'plan' ? c.semana : c.ci, c.id);
  });
  // Los que la especificación marca con ⚑ (menos CR-02, mismo camino que CR-01 y CR-23, y CR-31, que es una
  // respuesta simulada de la IA y va más abajo).
  for (const id of ['CR-01', 'CR-05', 'CR-07', 'CR-08', 'CR-09', 'CR-17', 'CR-18', 'CR-21', 'CR-22', 'CR-23', 'CR-25', 'CR-26', 'CR-27', 'CR-29', 'CR-30', 'CR-32']) {
    assert.ok(CASOS.some(c => c.id === id), id);
  }
});

// ── Sin IA: dolor ≥ 7 y alarmas (C-DOLOR-4, C-ALAR-1, C-ALAR-4, C-ALAR-5) ──
for (const caso of CASOS.filter(c => c.espera === 'sinIA')) {
  test(`${caso.id} no llama a la IA: ${caso.titulo}`, async () => {
    const p = await preparar(caso);
    assert.equal(p.llamadas, 0);
    assert.equal(p.cuerpo, null);
  });
}
test('sin IA, cada uno hace lo suyo: día de dolor alto, T2 o la pregunta de alarma', async () => {
  const r = id => preparar(CASOS.find(c => c.id === id)).then(p => p.resultado);
  for (const id of ['CR-01', 'CR-23']) {
    const { sesion } = await r(id);
    assert.equal(sesion.fuente, 'reglas', id);
    assert.match(sesion.explicacion[0], /está hoy a 8\/10: hoy no hay fuerza/, `${id}: T6`);
    assert.ok(!sesion.ejercicios.some(x => x.rol === 'principal'), id);
  }
  assert.deepEqual((await r('CR-18')).alarma, T2);
  assert.equal((await r('CR-18')).sesion, null);
  const p21 = await r('CR-21');
  assert.equal(p21.sesion, null);
  assert.equal(p21.pregunta.tipo, 'alarma');
});

// ── Con IA: el cuerpo que manda el móvil ──
for (const caso of conIA) {
  test(`${caso.id} manda un cuerpo bueno: ${caso.titulo}`, async () => {
    const p = await preparar(caso);
    assert.equal(p.llamadas, 1, 'una sola petición');
    const c = p.cuerpo;
    assert.equal(c.modo, caso.modo);
    Object.keys(c).forEach(k => assert.ok(CLAVES.includes(k), `clave «${k}» en la lista blanca`));
    const bytes = Buffer.byteLength(JSON.stringify(c));
    assert.ok(bytes < LIMITE_CUERPO / 3, `${bytes} B`);
    // El saneado no quita nada: lo que se arma en el móvil ya cabe.
    const { cuerpo: limpio, catalogoDescartados } = sanear(c);
    assert.equal(catalogoDescartados, 0);
    assert.deepEqual(limpio, c);
    // Datos personales: ni nombre ni altura; lugares con ids; salud solo como etiquetas (C-SALUD-0).
    const texto = JSON.stringify(c);
    assert.doesNotMatch(texto, /V[íi]ctor|Virginia|"nombre":"(Víctor|Virginia)"/i);
    assert.deepEqual(Object.keys(c.perfil).filter(k => ['nombre', 'alturaCm', 'pesoKg', 'altura', 'nacimiento'].includes(k)), []);
    assert.ok(c.perfil.lugares.every(l => LUGARES[l]), 'perfil.lugares son ids');
    assert.ok(c.catalogo.every(e => e.l.every(l => LUGARES[l])), 'la «l» del catálogo son ids');
    assert.ok(c.catalogo.every(e => !e.prec || e.prec.split(',').every(z => c.lesiones.some(l => l.zona === z))), '«prec» con ids de las zonas que van en «lesiones»');
    assert.ok(Array.isArray(c.perfil.salud) && c.perfil.salud.every(t => /^[a-z0-9_]+$/.test(t)));
    if (caso.modo === 'sesion') {
      assert.ok(LUGARES[c.checkin.lugar], 'checkin.lugar es un id');
      assert.ok(!c.planDeHoy || LUGARES[c.planDeHoy.lugar], 'planDeHoy.lugar es un id');
      assert.ok(c.checkin.pautas && c.checkin.pautas.cardio.minimo >= 8, 'pautas del día');
    } else {
      assert.deepEqual(Object.keys(c.semana.pautas), c.semana.lugares.map(l => l.id));
    }
    // dolorReciente recortado: como mucho 10, de las 4 últimas semanas y solo fecha, zona, dolor y momento.
    const dr = c.historial.dolorReciente || [];
    assert.ok(dr.length <= 10);
    dr.forEach(d => assert.deepEqual(Object.keys(d).filter(k => !['fecha', 'zona', 'dolor', 'momento'].includes(k)), []));
    // Zonas con su banda, techo y fase ya calculados.
    c.lesiones.forEach(l => {
      assert.match(l.banda, /^B[0-2]$/, `${l.zona}: banda`);
      assert.ok(l.techo >= 3 && l.techo <= 5, `${l.zona}: techo`);
      assert.ok([1, 2, 3].includes(l.faseRehab), `${l.zona}: fase`);
      const enCatalogo = new Set(c.catalogo.map(e => e.id));
      assert.deepEqual(l.rehabilitacionSugerida.filter(id => !enCatalogo.has(id)), [], `${l.zona}: rehabilitación fuera del catálogo enviado`);
    });
  });
}

test('lo que llega de cada zona y del día es lo que dicen las reglas', async () => {
  const cuerpo = async id => (await preparar(CASOS.find(c => c.id === id))).cuerpo;
  const zona = (c, z) => c.lesiones.find(l => l.zona === z);
  const c05 = await cuerpo('CR-05');
  assert.deepEqual([zona(c05, 'rodilla').banda, zona(c05, 'rodilla').lesionNueva, zona(c05, 'rodilla').techo, zona(c05, 'rodilla').faseRehab], ['B2', true, 3, 1]);
  assert.deepEqual([zona(c05, 'hombro').banda, zona(c05, 'hombro').faseRehab], ['B1', 2]);
  const c17 = await cuerpo('CR-17');
  assert.deepEqual([zona(c17, 'cervical').banda, zona(c17, 'cervical').sinLesionRegistrada], ['B2', true]);
  const c27 = await cuerpo('CR-27');
  assert.deepEqual([zona(c27, 'rodilla').banda, zona(c27, 'rodilla').dolorPorRevisar], ['B2', true], 'la ficha 9 por revisar se trata como B2 (C-DOLOR-0)');
  const c25 = await cuerpo('CR-25');
  assert.deepEqual([c25.checkin.pautas.cardio.minimo, c25.checkin.pautas.cardio.intervalos, c25.checkin.pautas.margenMin], [15, false, 2]);
  const c24 = await cuerpo('CR-24');
  assert.deepEqual([c24.perfil.edad, c24.checkin.pautas.margenMin, c24.checkin.pautas.equilibrio, c24.checkin.pautas.cardio.intervalos], [63, 2, true, false]);
  assert.equal(c24.checkin.pautas.calentamientoMin, 9, '45 min: 7 + 2 por la edad (C-CAL-1, C-EDAD-1)');
  const c16 = await cuerpo('CR-16');
  assert.equal(c16.checkin.pautas.maxPrincipales, 3);
  const c07 = await cuerpo('CR-07');
  assert.equal(c07.perfil.sabeNadar2x25, false);
  assert.deepEqual([c07.checkin.lugar, c07.perfil.lugares], ['piscina', ['piscina']]);
});

test('los textos libres van recortados y como datos: notas, nota de la lesión, petición y comentarios', async () => {
  const largo = 'Texto muy largo que no hace falta mandar entero. '.repeat(80);
  const caso = {
    ...CASOS.find(c => c.id === 'CR-22'), id: 'largo',
    perfil: { objetivos: ['musculo'], nivel: 2, notas: largo },
    prep: S => {
      S.perfil.lesiones.push({ id: 'l', zona: 'rodilla', dolor: 3, activa: true, desde: '2025-01-01', nota: largo });
      S.dolor.push(...Array.from({ length: 30 }, (_, i) => ({ fecha: '2026-11-' + String(1 + (i % 15)).padStart(2, '0'), zona: 'rodilla', dolor: 3, momento: 'antes', sesion: 's' + i })));
      S.dolor.push({ fecha: '2026-01-01', zona: 'rodilla', dolor: 9, momento: 'antes' });
    },
    ci: { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: { rodilla: 3 }, peticion: largo },
  };
  const { S, cuerpo } = await prepararCaso(caso);
  assert.ok(cuerpo.perfil.notas.length <= LARGO_IA.notas && cuerpo.perfil.notas.endsWith('…'));
  assert.ok(cuerpo.lesiones[0].nota.length <= LARGO_IA.nota);
  assert.ok(cuerpo.checkin.peticion.length <= LARGO_IA.peticion);
  assert.ok(S.perfil.notas.length > 3000, 'en el móvil no se recorta nada');
  const dr = cuerpo.historial.dolorReciente;
  assert.equal(dr.length, 10);
  assert.ok(dr.every(d => d.fecha >= '2026-10-19' && d.sesion === undefined), 'de las 4 últimas semanas y sin id de sesión');
});

// ── De extremo a extremo con un Claude simulado ──
test('cada cuerpo pasa por el servidor: 200, el mismo cuerpo en <datos> y la respuesta de vuelta', async () => {
  process.env.APP_CODE = 'prueba';
  process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
  const log = console.log; console.log = () => {};
  try {
    for (const caso of conIA) {
      const p = await preparar(caso);
      const r = buena(p);
      const cliente = clienteSimulado(() => mensaje(r));
      ponerClienteIA(cliente);
      const res = new Respuesta();
      await handler(peticion({ codigo: 'prueba', cuerpo: p.cuerpo }), res);
      assert.equal(res.codigo, 200, caso.id);
      const contenido = cliente.llamadas[0].params.messages[0].content;
      const datos = JSON.parse(contenido.split('<datos>\n')[1].split('\n</datos>')[0]);
      assert.deepEqual(datos.catalogo, p.cuerpo.catalogo, caso.id);
      assert.deepEqual(datos.perfil, p.cuerpo.perfil, caso.id);
      assert.ok(res.cuerpo[caso.modo === 'plan' ? 'plan' : 'sesion'], caso.id);
    }
  } finally { console.log = log; ponerClienteIA(null); }
});

// ── El juez ──
for (const caso of conIA) {
  test(`juez: la respuesta de las reglas aprueba ${caso.id}`, async () => {
    const p = await preparar(caso);
    const j = juzgar(p, buena(p));
    assert.deepEqual(j.seguridad, [], 'seguridad');
    assert.ok(j.validador.pasa, `validador: ${j.validador.graves.join(', ')}`);
    assert.ok(j.aprueba, `rúbrica ${j.total} de 16`);
  });
}

// Respuestas malas: cada una debe suspender (seguridad) o perder puntos donde toca.
const sesionesIA = conIA.filter(c => c.modo === 'sesion');
const mutar = (r, f) => { const x = copia(r); f(x); return x; };
test('juez: sin cardio pierde los puntos de cardio (y suspende si el caso lo exige)', async () => {
  for (const caso of sesionesIA) {
    const p = await preparar(caso);
    const j = juzgar(p, mutar(buena(p), r => { r.ejercicios = r.ejercicios.filter(x => x.rol !== 'cardio'); }));
    assert.ok(j.puntos.cardio <= 1, caso.id);
  }
  const p = await preparar(CASOS.find(c => c.id === 'CR-09'));
  assert.ok(!juzgar(p, mutar(buena(p), r => { r.ejercicios = r.ejercicios.filter(x => x.rol !== 'cardio'); })).aprueba);
});
test('juez: un ejercicio de la lista NUNCA o con riesgo en la zona suspende siempre', async () => {
  for (const caso of sesionesIA.filter(c => (c.nunca || []).length)) {
    const p = await preparar(caso);
    const j = juzgar(p, mutar(buena(p), r => { r.ejercicios.push({ id: caso.nunca[0], rol: 'principal', series: 3, reps: '10-12', descanso: 90, kg: null, nota: 'x' }); }));
    assert.equal(j.aprueba, false, caso.id);
    assert.ok(j.seguridad.some(t => t.includes(caso.nunca[0])), `${caso.id}: ${j.seguridad.join(', ')}`);
  }
});
test('juez: vuelta sin estiramientos, calentamiento vacío o tareas de otro lugar quitan puntos', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-24'));
  let j = juzgar(p, mutar(buena(p), r => { r.vueltaCalma = [{ id: '', nombre: 'Respiración', detalle: '', duracion: '2 min' }]; }));
  assert.equal(j.puntos.vuelta, 0);
  j = juzgar(p, mutar(buena(p), r => { r.calentamiento = []; }));
  assert.equal(j.puntos.calentamiento, 0);
  j = juzgar(p, mutar(buena(p), r => { r.vueltaCalma.push({ id: 'flotacion', nombre: 'Flotación', detalle: '', duracion: '1 min' }); }));
  assert.equal(j.puntos.vuelta, 1);
});
test('juez: kilos sin historial (CR-08) y por encima del tope (CR-32) suspenden', async () => {
  let p = await preparar(CASOS.find(c => c.id === 'CR-08'));
  let j = juzgar(p, mutar(buena(p), r => { r.ejercicios.find(x => x.rol === 'principal').kg = 40; }));
  assert.equal(j.aprueba, false);
  assert.equal(j.puntos.kilos, 0);
  p = await preparar(CASOS.find(c => c.id === 'CR-32'));
  j = juzgar(p, mutar(buena(p), r => { r.ejercicios = r.ejercicios.filter(x => x.id !== 'prensa-piernas'); r.ejercicios.splice(0, 0, { id: 'prensa-piernas', rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 47.5, nota: 'De 40 a 47,5 kg.' }); }));
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /42,?5|42\.5/.test(t)), j.seguridad.join(', '));
  j = juzgar(p, mutar(buena(p), r => { r.ejercicios = r.ejercicios.filter(x => x.id !== 'prensa-piernas'); r.ejercicios.splice(0, 0, { id: 'prensa-piernas', rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 42.5, nota: 'De 40 a 42,5 kg.' }); }));
  assert.ok(!j.seguridad.length, j.seguridad.join(', '));
});
test('juez: diagnóstico, tratamiento o curar en un texto suspende (C-PRIN-1)', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-05'));
  const j = juzgar(p, mutar(buena(p), r => { r.explicacion.push('Este es el tratamiento para curar tu rodilla.'); }));
  assert.equal(j.aprueba, false);
});
test('juez: CR-22 sin «cambios» lo avisa, y quitar el cardio porque lo pide la petición suspende', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-22'));
  assert.deepEqual(juzgar(p, buena(p)).avisos, ['«cambios» vacío: no dice que la limitación se mantiene']);
  assert.deepEqual(juzgar(p, { ...buena(p), cambios: ['Mantengo tu rodilla sin carga aunque lo pidas.'] }).avisos, []);
  assert.equal(juzgar(p, mutar(buena(p), r => { r.ejercicios = r.ejercicios.filter(x => x.rol !== 'cardio'); })).aprueba, false);
});
test('juez: CR-31, la IA manda jalón como cardio, sin cardio y 7 series: el validador no la deja pasar', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-09'));
  const mala = mutar(buena(p), r => {
    r.ejercicios = r.ejercicios.filter(x => x.rol !== 'cardio');
    r.ejercicios.push({ id: 'jalon-pecho', rol: 'cardio', series: 1, reps: '20 min', descanso: 0, kg: null, nota: 'x' });
    r.ejercicios[0].series = 7;
  });
  const j = juzgar(p, mala);
  assert.equal(j.validador.pasa, false);
  assert.ok(j.validador.graves.some(t => /no vale como cardio/.test(t)) && j.validador.graves.some(t => /7 series/.test(t)), j.validador.graves.join(', '));
  assert.equal(j.aprueba, false);
});
test('juez: una sesión que no cabe en el tiempo pierde el punto de minutos', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-09'));
  const r = buena(p);
  const j = juzgar(p, mutar(r, x => { x.ejercicios.push(...x.ejercicios.filter(e => e.rol === 'principal').map(e => ({ ...e }))); }));
  assert.ok(j.puntos.cardio <= 1 || j.puntos.volumen <= 1);
});
test('juez de plan: más de 4 días de fuerza siendo principiante o días que faltan suspenden', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-11'));
  const r = buena(p);
  assert.ok(juzgar(p, r).aprueba);
  const fuerza = r.dias.find(d => d.ejercicios.some(x => x.rol === 'principal'));
  // Con 4 series por principal (un principiante sale a 3 desde E10), repetir el día choca con C-REP-1.
  const conCuatro = d => ({ ...d, ejercicios: d.ejercicios.map(x => (x.rol === 'principal' ? { ...x, series: Math.max(4, x.series) } : x)) });
  const todoFuerza = { ...r, dias: r.dias.map(d => ({ ...conCuatro(copia(fuerza)), diaSemana: d.diaSemana })) };
  const j = juzgar(p, todoFuerza);
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /más de 4 días/.test(t)), j.seguridad.join(', '));
  assert.ok(j.seguridad.some(t => /dos días seguidos/.test(t)), 'C-REP-1');
  const corto = juzgar(p, { ...r, dias: r.dias.slice(0, 3) });
  assert.equal(corto.aprueba, false);
  assert.match(corto.avisos[0], /faltan los días/);
});

// ── Revisión del PR 11: lo que el juez no puede dejar pasar ──
const principalCon = (p, zona, tipo = 'compuesto') => p.cuerpo.catalogo.filter(e => (e.prec || '').split(',').includes(zona) && e.tipo === tipo && !e.m[0].startsWith('core'));
test('juez (C-DOSIS-4): un ejercicio con riesgo en una zona B0-B1 pesado, el primero o el tercero de la zona suspende', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-05')); // hombro B1
  const base = buena(p);
  const usados = new Set(base.ejercicios.map(x => x.id));
  const conRiesgo = principalCon(p, 'hombro').filter(e => !usados.has(e.id));
  assert.ok(conRiesgo.length >= 3, conRiesgo.map(e => e.id).join(', '));
  const sinHombro = r => { r.ejercicios = r.ejercicios.filter(x => x.rol !== 'principal' || !(p.cuerpo.catalogo.find(e => e.id === x.id).prec || '').includes('hombro')); };
  // Pesado y el primero.
  let j = juzgar(p, mutar(base, r => { sinHombro(r); r.ejercicios.unshift({ id: conRiesgo[0].id, rol: 'principal', series: 4, reps: '4-6', descanso: 150, kg: null, nota: 'Tu hombro en 2/10.' }); }));
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /C-DOSIS-4/.test(t) && /10 repeticiones/.test(t)), j.seguridad.join(' | '));
  assert.ok(j.seguridad.some(t => /C-DOSIS-4/.test(t) && /primero/.test(t)), j.seguridad.join(' | '));
  // Bien dosificado pero tres en la misma zona.
  j = juzgar(p, mutar(base, r => { sinHombro(r); const i = r.ejercicios.findIndex(x => x.rol === 'principal'); r.ejercicios.splice(i + 1, 0, ...conRiesgo.slice(0, 3).map(e => ({ id: e.id, rol: 'principal', series: 2, reps: '12-15', descanso: 60, kg: null, nota: 'Tu hombro está en 2/10: carga moderada.' }))); }));
  assert.ok(j.seguridad.some(t => /C-DOSIS-4/.test(t) && /3 ejercicios/.test(t)), j.seguridad.join(' | '));
});
test('juez (C-DOLOR-1): subir kilos en un ejercicio que implica una zona en B2 suspende', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-26')); // rodilla y lumbar a 5, con historia de prensa a 80 kg
  const j = juzgar(p, mutar(buena(p), r => { r.ejercicios.push({ id: 'prensa-piernas', rol: 'principal', series: 3, reps: '10-12', descanso: 90, kg: 82.5, nota: 'De 80 a 82,5 kg.' }); }));
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /prensa-piernas/.test(t) && /B2/.test(t)), j.seguridad.join(' | '));
});
test('juez de plan (C-REP-2): una semana de 6 días suaves para CR-11 no aprueba', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-11'));
  const r = buena(p);
  const suave = r.dias.find(d => /^Día suave/.test(d.explicacion[0] || ''));
  assert.ok(suave);
  const j = juzgar(p, { ...r, dias: r.dias.map(d => ({ ...copia(suave), diaSemana: d.diaSemana })) });
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /días suaves/.test(t)), j.seguridad.join(' | '));
  assert.ok(j.seguridad.some(t => /días de fuerza/.test(t)), j.seguridad.join(' | '));
});
test('juez de plan (C-REP-2, C-REP-4): un cuerpo completo sin dominante de cadera no aprueba', async () => {
  const p = await preparar(CASOS.find(c => c.id === 'CR-11'));
  const r = buena(p);
  const cadera = x => ['gluteo', 'isquios'].includes((p.cuerpo.catalogo.find(e => e.id === x.id) || { m: [''] }).m[0]);
  const d = r.dias.find(d => d.ejercicios.some(x => x.rol === 'principal' && cadera(x)));
  const j = juzgar(p, mutar(r, x => { const dd = x.dias.find(y => y.diaSemana === d.diaSemana); dd.ejercicios = dd.ejercicios.filter(e => !(e.rol === 'principal' && cadera(e))); }));
  assert.equal(j.aprueba, false);
  assert.ok(j.seguridad.some(t => /cadera/.test(t) && /C-REP-4/.test(t)), j.seguridad.join(' | '));
});

// Ronda real del 23-11 (CR-25): «sin intervalos por tu tensión» no son intervalos; «6 × (1 min a RPE 7…)» sí.
test('juez: «sin intervalos» en la nota del cardio no cuenta como intervalos (CR-25)', async () => {
  const { conIntervalos } = await import('./casos.mjs');
  for (const t of ['Cardio continuo a RPE 4-5, sin intervalos por tu tensión.', 'Continuo, sin cambios bruscos de ritmo. Nada de intervalos hoy.', 'Hoy no hay intervalos: ritmo cómodo.', 'Sin intervalos ni cuestas.'])
    assert.equal(conIntervalos(t), false, t);
  for (const t of ['3 min suaves + 6 × (1 min a RPE 7 + 2 min a RPE 3)', 'Intervalos en la bici: 1 min fuerte, 2 suave.', 'Sin cuestas; haz intervalos de 1 min.'])
    assert.equal(conIntervalos(t), true, t);
  const p = await preparar(CASOS.find(c => c.id === 'CR-25'));
  const r = mutar(buena(p), x => { x.ejercicios.find(y => y.rol === 'cardio').nota = 'Cardio continuo para perder grasa a RPE 4-5, sin intervalos por tu tensión: puedes hablar con frases cortas.'; });
  assert.deepEqual(juzgar(p, r).seguridad, []);
  const mala = mutar(buena(p), x => { x.ejercicios.find(y => y.rol === 'cardio').nota = '3 min suaves y 6 × (1 min a RPE 7 + 2 min a RPE 3).'; });
  assert.ok(juzgar(p, mala).seguridad.includes('intervalos en el cardio'));
});
