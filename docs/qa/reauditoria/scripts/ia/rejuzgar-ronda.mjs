// Re-juzga las respuestas reales guardadas de una ronda de scripts/casos-ia.mjs (el JSON que acompaña al
// informe) con el código ACTUAL de esta copia: juez + recorrido completo por la app (crearSesionHoy /
// crearPlanSemana con la respuesta guardada como si viniera del servidor) y problemasSesion sobre lo guardado.
// Además cuenta lo que la app tiene que corregir de la IA (tareas cambiadas, repeticiones sin su formato, roles
// equivocados, cardio por debajo del mínimo…), que es lo que se quiere que baje de una ronda a otra. Los ids
// inventados no se ven aquí (el servidor ya los filtra antes de guardar la respuesta): se vigilan en el registro
// de Vercel, campos «descartados» y «tareasSinId» de la línea «entrenador».
// Sin llamadas reales.
//
//   node docs/qa/reauditoria/scripts/ia/rejuzgar-ronda.mjs <ronda.json> [--detalle]
import fs from 'node:fs';

const { CASOS, prepararCaso } = await import('../../../../../tests/ia/casos.mjs');
const { juzgar } = await import('../../../../../tests/ia/juez.mjs');
const { ent, est, ponerRed } = await import('../../../../../tests/ayuda/node.mjs');

const archivo = process.argv[2];
const detalle = process.argv.includes('--detalle');
if (!archivo) { console.error('Uso: rejuzgar-ronda.mjs <ronda.json> [--detalle]'); process.exit(2); }
const filas = JSON.parse(fs.readFileSync(archivo, 'utf8'));

// Familias de correcciones de la app (textos de validar.js).
const FAMILIAS = [
  ['tareas', /tareas? de calentamiento o vuelta que no puedo comprobar|^quito .* del calentamiento|^quito .* de la vuelta/],
  ['formatoReps', /no vale para este ejercicio, pongo/],
  ['rol', /no es un ejercicio principal|no es cardio|como cardio: no lo es|no es rehabilitación de ninguna zona/],
  ['principalesAñadidos', /toda sesión lleva al menos 3 ejercicios principales/],
  ['cardioMinimo', /el cardio sube de/],
  ['tiempo', /para que quepa en|calentamiento de 4 minutos|con \d+ minutos quito/],
  ['dosis', /son demasiadas|es demasiado, pongo|a \d+-\d+ repeticiones/],
];
const familia = c => (FAMILIAS.find(([, re]) => re.test(c)) || ['otros'])[0];
const cuenta = {};
let tareasCambiadas = 0, total = 0, malos = 0, seguridadMal = 0, rubrica = 0, conCambios = 0, nCambios = 0;
for (const f of filas) {
  if (!f.respuesta) continue;
  const caso = CASOS.find(c => c.id === f.id);
  if (!caso) { console.log('sin caso', f.id); continue; }
  total++;
  const prep = await prepararCaso(caso);
  const j = juzgar(prep, JSON.parse(JSON.stringify(f.respuesta)));
  await prepararCaso(caso); // estado limpio de nuevo
  // Fuera lo que creó prepararCaso (sesión o plan de reglas), para que la respuesta no se descarte.
  est.cambiar(S => { if (caso.modo !== 'plan') S.sesiones = Object.fromEntries(Object.entries(S.sesiones).filter(([, s]) => s.estado === 'hecha')); else S.plan = null; }, 'prueba');
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => (caso.modo === 'plan' ? { plan: JSON.parse(JSON.stringify(f.respuesta)) } : { sesion: JSON.parse(JSON.stringify(f.respuesta)) }) }));
  let fuente = '', problemas = [], aviso = '';
  try {
    if (caso.modo === 'plan') {
      const r = await ent.crearPlanSemana({ ...caso.semana }, { conIA: true });
      aviso = r.aviso; fuente = r.plan.fuente;
      const S = est.estado();
      (r.plan.dias || []).forEach(d => { const pr = ent.problemasSesion(S, d, { lugar: d.lugar, minutos: d.minutos, futuro: true, tipo: d.tipo }); if (pr.length) problemas.push(`día ${d.diaSemana}: ${pr.join('; ')}`); });
      const rehechos = (r.plan.dias || []).filter(d => (d.explicacion || []).includes('Día completado por la app.')).length;
      if (rehechos) fuente += ` (días rehechos por la app: ${rehechos}/${r.plan.dias.length})`;
    } else {
      const r = await ent.crearSesionHoy({ forzarIA: true, peticion: '', ...caso.ci });
      aviso = r.aviso; fuente = r.sesion && r.sesion.fuente;
      problemas = r.sesion ? ent.problemasSesion(est.estado(), r.sesion, { lugar: caso.ci.lugar, minutos: caso.ci.minutos, dolorHoy: caso.ci.dolorHoy || {}, energia: caso.ci.energia || 3 }) : ['sin sesión'];
    }
  } finally { ponerRed(false); }
  const cambios = caso.modo === 'plan' ? j.porDia.flatMap(d => d.validador.cambios || []) : (j.validador.cambios || []);
  cambios.forEach(c => { const k = familia(c); cuenta[k] = (cuenta[k] || 0) + 1; });
  cambios.forEach(c => { const m = c.match(/cambio (\d+) tareas? de calentamiento o vuelta/); if (m) tareasCambiadas += +m[1]; });
  if (cambios.length) conCambios++;
  nCambios += cambios.length;
  const ok = j.validador.pasa && j.aprueba && !problemas.length && /ia/.test(fuente);
  if (!ok) malos++;
  if (!j.seguridadOk) seguridadMal++;
  if (j.aprueba) rubrica++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${f.id} | antes: val ${f.pasaValidador} rub ${f.aprueba} | ahora: val ${j.validador.pasa} rub ${j.aprueba} (${j.total}) seg ${JSON.stringify(j.seguridad || [])} | app: ${fuente} ${aviso ? '«' + aviso + '»' : ''} ${problemas.length ? 'PROBLEMAS ' + problemas.join(' | ') : ''}`);
  if (detalle && cambios.length) console.log('     cambios:', cambios.join(' · ').slice(0, 600));
}
console.log(`\n${total} respuestas · ${malos} con algo · seguridad mal ${seguridadMal} · rúbrica ${rubrica}/${total} · ${conCambios} con cambios de la app (${nCambios} cambios)`);
console.log('Cambios de la app por familia:', JSON.stringify(cuenta), `· tareas sin id cambiadas: ${tareasCambiadas}`);
