// PR 10 · Reparto de la semana y volumen (js/areas/entrenador/plan.js) según docs/criterio.md:
// C-REP-1 a C-REP-6 (D5), C-VOL-1 a C-VOL-4 y la descarga en el plan (C-DESCARGA-1, CR-11, CR-20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fijarFecha, modulo } from './ayuda/comun.mjs';
import { nuevoS, ent, cat, hecha } from './ayuda/node.mjs';

fijarFecha('2026-11-18T10:00'); // miércoles
const P = await import(modulo('js/areas/entrenador/plan.js'));
const plan = (perfil, dias, o = {}) => { const S = nuevoS(perfil); return { S, p: ent.planReglas(S, { dias, minutos: 60, lugares: o.lugares || perfil.lugares || ['gym'] }) }; };
const fuerza = d => d.ejercicios.some(x => x.rol === 'principal');
const GRANDES = ['pecho', 'espalda', 'cuadriceps', 'gluteo', 'isquios', 'hombro'];

test('C-REP-2: días por defecto según nivel; como mucho 6', () => {
  const S = nuevoS({ nivel: 1, disponibilidad: { dias: 4, minutos: 60, diasSemana: [] } });
  assert.deepEqual(ent.diasPorDefecto(S), [1, 3, 5, 6], 'principiante 4 días: L, X, V, S [Decisión 10]');
  S.perfil.nivel = 2;
  assert.deepEqual(ent.diasPorDefecto(S), [1, 2, 4, 5]);
  S.perfil.disponibilidad.dias = 7;
  assert.equal(ent.diasPorDefecto(S).length, 6);
  const { p } = plan({ objetivos: ['musculo'], nivel: 2 }, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(p.dias.length, 6, 'siempre 1 día de descanso');
});

test('C-REP-3 (D5): con 3 días, cuerpo completo × 3 para todos los niveles', () => {
  for (const nivel of [1, 2, 3]) {
    const { p } = plan({ objetivos: ['musculo', 'fuerza'], nivel }, [1, 3, 5]);
    assert.deepEqual(p.dias.map(d => d.tipo), ['fullA', 'fullB', 'fullC'], `nivel ${nivel}`);
  }
});

test('C-REP-2: principiante 4 días L-X-V-S de cuerpo completo; intermedio torso / pierna × 2', () => {
  assert.deepEqual(plan({ objetivos: ['musculo'], nivel: 1 }, [1, 3, 5, 6]).p.dias.map(d => d.tipo), ['fullA', 'fullB', 'fullA', 'fullB']);
  assert.deepEqual(plan({ objetivos: ['musculo'], nivel: 2 }, [1, 2, 4, 5]).p.dias.map(d => d.tipo), ['torso', 'pierna', 'torso', 'pierna']);
});

test('C-REP-2: 5 días: principiante cuerpo completo L-X-V y suaves M-S; intermedio torso, pierna, suave, torso, pierna', () => {
  assert.deepEqual(plan({ objetivos: ['musculo'], nivel: 1 }, [1, 2, 3, 5, 6]).p.dias.map(d => d.tipo), ['fullA', 'suave', 'fullB', 'fullC', 'suave']);
  assert.deepEqual(plan({ objetivos: ['musculo'], nivel: 2 }, [1, 2, 3, 4, 5]).p.dias.map(d => d.tipo), ['torso', 'pierna', 'suave', 'torso', 'pierna']);
});

test('CR-11: principiante con 6 días: 3 cuerpos completos alternos y 3 suaves, sin choques de C-REP-1', () => {
  const { p } = plan({ objetivos: ['musculo'], nivel: 1 }, [1, 2, 3, 4, 5, 6]);
  assert.ok(p.dias.filter(fuerza).length <= 4, '> 4 días con rol principal');
  assert.deepEqual(p.dias.filter(fuerza).map(d => d.diaSemana), [1, 3, 5]);
  const suave = p.dias.find(d => d.tipo === 'suave');
  assert.ok(suave.ejercicios.some(x => x.rol === 'cardio'), 'el día suave lleva cardio');
  assert.deepEqual(P.choquesSeguidos(p.dias), []);
});

test('C-REP-1: ningún reparto deja un músculo grande con ≥ 4 series directas dos días seguidos', () => {
  const casos = [];
  for (const nivel of [1, 2, 3]) for (const objetivos of [['musculo'], ['fuerza'], ['perder'], ['salud']]) for (const dias of [[1, 2], [1, 2, 3], [1, 3, 5, 6], [1, 2, 3, 4], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]]) {
    const { p } = plan({ objetivos, nivel }, dias);
    const ch = P.choquesSeguidos(p.dias);
    if (ch.length) casos.push(`nivel ${nivel} ${objetivos} ${dias}: ${JSON.stringify(ch[0])}`);
  }
  assert.deepEqual(casos, []);
});

test('C-REP-2: días elegidos seguidos: el principiante con 4 días pasa a torso / pierna', () => {
  const { p } = plan({ objetivos: ['musculo'], nivel: 1, disponibilidad: { dias: 4, minutos: 60, diasSemana: [1, 2, 3, 4] } }, [1, 2, 3, 4]);
  assert.deepEqual(P.choquesSeguidos(p.dias), []);
  assert.ok(p.dias.filter(fuerza).length >= 3);
});

test('C-VOL-1: el volumen semanal de cada músculo grande no pasa del techo del nivel', () => {
  for (const [nivel, techo] of [[1, 12], [2, 18], [3, 20]]) {
    const { p } = plan({ objetivos: ['musculo'], nivel }, [1, 2, 3, 4, 5, 6]);
    const vol = P.volumenSemana(p.dias);
    for (const m of GRANDES) assert.ok((vol[m] || 0) <= techo, `nivel ${nivel} ${m} ${vol[m]}`);
    for (const d of p.dias) for (const m of GRANDES) assert.ok(d.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).m.includes(m)).reduce((t, x) => t + x.series, 0) <= { 1: 6, 2: 8, 3: 10 }[nivel], `${m} por sesión`);
  }
});

test('C-VOL-1: músculo intermedio llega al menos a la banda en los grandes principales', () => {
  const { p } = plan({ objetivos: ['musculo'], nivel: 2 }, [1, 2, 4, 5]);
  const vol = P.volumenSemana(p.dias);
  // Banda 10-14 (mitad alta para músculo): al menos el inicio de la banda en pecho y espalda. El cuádriceps
  // se queda algo por debajo porque las sentadillas y la prensa cuentan también como glúteo directo y el
  // glúteo llega antes a su techo (C-VOL-2: el techo manda).
  assert.ok(['pecho', 'espalda'].every(m => vol[m] >= 10), JSON.stringify(vol));
  assert.ok(vol.cuadriceps >= 8 && vol.gluteo <= 18, JSON.stringify(vol));
  // D-B (Víctor, 21-11-2026): como mucho 4 series por ejercicio; el volumen que falta va en otro ejercicio.
  const prin = p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal'));
  assert.ok(prin.every(x => x.series <= 4), prin.map(x => `${x.id} ${x.series}`).join(', '));
});

test('D-B: el relleno de volumen no pasa de 3 series (principiante) ni de 4 (intermedio y avanzado) y añade ejercicios', () => {
  for (const [nivel, tope] of [[1, 3], [2, 4], [3, 4]]) {
    for (const dias of [[6, 7], [1, 4], [1, 3, 5], [1, 2, 4, 5]]) {
      const { p } = plan({ objetivos: ['musculo'], nivel }, dias);
      const prin = p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal'));
      assert.ok(prin.every(x => x.series <= tope), `nivel ${nivel}, días ${dias}: ${prin.map(x => `${x.id} ${x.series}`).join(', ')}`);
    }
  }
  // Avanzado con 2 días: con 4 series por ejercicio no llega a su banda (12) sin otro ejercicio de pecho.
  const { p } = plan({ objetivos: ['musculo'], nivel: 3 }, [1, 4]);
  const pecho = p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).m[0] === 'pecho'));
  assert.ok(pecho.length >= 3, pecho.map(x => x.id).join(', '));
  assert.ok(P.volumenSemana(p.dias).pecho >= 12, JSON.stringify(P.volumenSemana(p.dias)));
});

test('C-VOL-4: hombro en B1 deja hombro y pecho en el techo del nivel inferior; nunca suma series a lo que toca la zona', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lesiones: [{ id: 'h', zona: 'hombro', dolor: 2, activa: true, desde: '2026-01-01', tipo: 'lesion' }] });
  const obj = P.volumenObjetivo(S);
  assert.equal(obj.musculos.hombro.techo, 12);
  assert.equal(obj.musculos.pecho.techo, 12);
  const p = ent.planReglas(S, { dias: [1, 2, 4, 5], minutos: 60, lugares: ['gym'] });
  const vol = P.volumenSemana(p.dias);
  assert.ok(vol.hombro <= 12 && vol.pecho <= 12, JSON.stringify(vol));
  // Lesión nueva con dolor 3: cuenta como B2 (C-LES-2): −50 %.
  S.perfil.lesiones[0].desde = '2026-11-01';
  S.perfil.lesiones[0].dolor = 3;
  assert.equal(P.volumenObjetivo(S).musculos.hombro.techo, 7, 'banda 10-14 a la mitad');
});

test('C-REP-6: piscina con lesión de carga y 3 días; natación principal con 4 días, 2', () => {
  const lugares = ['gym', 'piscina'];
  const a = plan({ objetivos: ['perder'], nivel: 2, lugares, lesiones: [{ id: 'r', zona: 'rodilla', dolor: 2, activa: true, desde: '2026-01-01' }] }, [1, 3, 5], { lugares }).p;
  assert.equal(a.dias.filter(d => d.lugar === 'piscina').length, 1);
  const b = plan({ objetivos: ['natacion', 'salud'], nivel: 2, lugares }, [1, 2, 4, 5], { lugares }).p;
  assert.equal(b.dias.filter(d => d.lugar === 'piscina').length, 2);
  const c = plan({ objetivos: ['musculo'], nivel: 2, lugares }, [1, 3, 5], { lugares }).p;
  assert.equal(c.dias.filter(d => d.lugar === 'piscina').length, 0);
});

test('C-DESCARGA-1 (CR-20): la semana 6 tras 5 constantes, mitad de series y margen 4 en el plan', () => {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2 });
  const normal = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym'] });
  for (let w = 5; w >= 1; w--) for (const d of [0, 2, 4]) hecha(S, 0, [{ id: 'remo-sentado-polea', sets: [[40, 10], [40, 10]] }], { cuando: new Date(new Date('2026-11-16T18:00').getTime() - w * 7 * 864e5 + d * 864e5) });
  const desc = ent.planReglas(S, { dias: [1, 3, 5], minutos: 60, lugares: ['gym'] });
  const series = p => p.dias.flatMap(d => d.ejercicios.filter(x => x.rol === 'principal')).reduce((t, x) => t + x.series, 0);
  assert.ok(series(desc) <= Math.ceil(series(normal) / 2) + 3, `${series(desc)} frente a ${series(normal)}`);
  assert.match(desc.criterios, /descarga/);
  for (const d of desc.dias) for (const x of d.ejercicios.filter(y => y.rol === 'principal')) assert.match(x.nota, /4 repeticiones de margen/);
  assert.ok(desc.dias.every(d => d.ejercicios.filter(x => x.rol === 'cardio').every(x => !/intervalo/i.test(x.nota) || /sin intervalos/.test(x.nota))));
});

test('el texto del plan cita 48 h y 4 sesiones para «estancado»', () => {
  const { p } = plan({ objetivos: ['musculo'], nivel: 2 }, [1, 3, 5]);
  assert.match(p.criterios, /48 h/);
  assert.match(p.progresion, /4 sesiones/);
});

// ── Revisión independiente del PR 10 (scripts rev-pr10/p3, p4 y p5 convertidos en pruebas) ──

test('fuzz de planes con semilla (revisión): techo semanal, C-REP-1 (también domingo → lunes) y principiante ≤ 4 días de fuerza', () => {
  let seed = 11;
  const az = () => (seed = (seed * 16807) % 2147483647) / 2147483647, el = a => a[Math.floor(az() * a.length)];
  const malos = [];
  const N = +process.env.FUZZ_PLANES || 400;
  for (let i = 0; i < N; i++) {
    const nivel = el([1, 2, 3]);
    const objetivos = el([['musculo'], ['fuerza'], ['perder'], ['salud'], ['resistencia'], ['musculo', 'perder'], ['natacion', 'musculo'], ['salud', 'natacion'], ['fuerza', 'resistencia']]);
    const lugares = el([['gym'], ['casa'], ['gym', 'piscina'], ['casa', 'piscina'], ['calle']]);
    const lesiones = az() < 0.4 ? [{ id: 'l', zona: el(['hombro', 'rodilla', 'lumbar', 'cadera_lateral', 'codo', 'tobillo_pie']), dolor: el([0, 1, 2, 3, 5, 6]), activa: true, desde: el(['', '2026-11-01', '2025-01-01']) }] : [];
    const k = el([1, 2, 3, 4, 5, 6, 7]);
    const dias = az() < 0.5 ? ent.diasPorDefecto(nuevoS({ nivel, disponibilidad: { dias: k, minutos: 60, diasSemana: [] } })) : [1, 2, 3, 4, 5, 6, 7].sort(() => az() - 0.5).slice(0, k).sort((a, b) => a - b);
    const S = nuevoS({ nivel, objetivos, lugares, lesiones, disponibilidad: { dias: dias.length, minutos: 60, diasSemana: [] } });
    const tag = `#${i} nivel ${nivel} ${objetivos} ${lugares} ${lesiones.map(l => l.zona + l.dolor)} días ${dias}`;
    let p;
    try { p = ent.planReglas(S, { dias, minutos: el([30, 45, 60, 90]), lugares }); } catch (e) { malos.push(`${tag}: ${e.message}`); continue; }
    const obj = P.volumenObjetivo(S), vol = P.volumenSemana(p.dias);
    for (const m of Object.keys(obj.musculos)) if ((vol[m] || 0) > obj.musculos[m].techo + 1e-9) malos.push(`${tag}: ${m} ${vol[m]} > ${obj.musculos[m].techo}`);
    const ch = P.choquesSeguidos(p.dias); if (ch.length) malos.push(`${tag}: C-REP-1 ${JSON.stringify(ch[0])}`);
    if (nivel === 1) { const f = p.dias.filter(d => d.ejercicios.some(x => x.rol === 'principal') && d.lugar !== 'piscina').length; if (f > 4) malos.push(`${tag}: ${f} días de fuerza`); }
  }
  assert.deepEqual(malos.slice(0, 5), []);
});

test('C-VOL-2 (revisión): con los días por defecto ninguna combinación supera el techo', () => {
  const malos = [];
  for (const nivel of [1, 2, 3]) for (const objetivos of [['musculo'], ['fuerza'], ['perder'], ['salud'], ['resistencia']]) for (const k of [1, 2, 3, 4, 5, 6]) for (const lugares of [['gym'], ['casa']]) {
    for (const lesiones of [[], [{ id: 'l', zona: 'hombro', dolor: 5, activa: true, desde: '2025-01-01' }], [{ id: 'l', zona: 'rodilla', dolor: 2, activa: true, desde: '' }]]) {
      const S = nuevoS({ nivel, objetivos, lugares, lesiones, disponibilidad: { dias: k, minutos: 60, diasSemana: [] } });
      for (const minutos of [45, 90]) {
        const p = ent.planReglas(S, { dias: ent.diasPorDefecto(S), minutos, lugares });
        const obj = P.volumenObjetivo(S), vol = P.volumenSemana(p.dias);
        for (const m of GRANDES) if ((vol[m] || 0) > obj.musculos[m].techo) malos.push(`nivel ${nivel} ${objetivos} ${k} días ${lugares} ${lesiones.map(l => l.zona)} ${minutos} min: ${m} ${vol[m]}/${obj.musculos[m].techo}`);
      }
    }
  }
  assert.deepEqual(malos.slice(0, 5), []);
});

test('C-REP-1 (revisión): domingo → lunes también cuenta', () => {
  const { p } = plan({ objetivos: ['musculo'], nivel: 2 }, [1, 3, 5, 7]);
  const dir = (d, m) => d.ejercicios.filter(x => x.rol === 'principal' && cat.ex(x.id).m.includes(m)).reduce((t, x) => t + x.series, 0);
  const dom = p.dias.find(d => d.diaSemana === 7), lun = p.dias.find(d => d.diaSemana === 1);
  for (const m of GRANDES) assert.ok(!(dir(dom, m) >= 4 && dir(lun, m) >= 4), m);
});

test('C-REP-1 (revisión): reorganizar moviendo días tampoco deja dos días seguidos cargando lo mismo', async () => {
  const { est } = await import('./ayuda/node.mjs');
  nuevoS({ objetivos: ['musculo'], lugares: ['gym'], nivel: 2 });
  await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] }, { conIA: false });
  ent.reorganizar([5, 6]);
  const dias = est.estado().plan.dias;
  assert.deepEqual(dias.map(d => d.diaSemana), [5, 6]);
  assert.deepEqual(P.choquesSeguidos(dias), []);
});

test('Principiante con salud y 6 días: como mucho 4 días de fuerza', () => {
  const { p } = plan({ objetivos: ['salud'], nivel: 1 }, [1, 2, 3, 4, 5, 6]);
  assert.ok(p.dias.filter(fuerza).length <= 4, p.dias.map(d => d.tipo).join());
});
