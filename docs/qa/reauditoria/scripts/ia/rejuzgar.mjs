// Re-juzga las respuestas reales guardadas de los casos de referencia (informes del 20-11 en wt/pr11-prompt)
// con el código ACTUAL de la copia de auditoría: juez + recorrido completo por la app (crearSesionHoy /
// crearPlanSemana con la respuesta guardada como si viniera del servidor) y problemasSesion sobre lo guardado.
// Sin llamadas reales.
const R = '/home/user/wt/auditoria/';
const { CASOS, prepararCaso } = await import(R + 'tests/ia/casos.mjs');
const { juzgar } = await import(R + 'tests/ia/juez.mjs');
const { ent, est, ponerRed } = await import(R + 'tests/ayuda/node.mjs');
import fs from 'node:fs';

const DIR = '/home/user/wt/pr11-prompt/tests/ia/informes/';
const archivos = ['informe-2026-11-20-14-39.json', 'informe-2026-11-20-15-17.json', 'informe-2026-11-20-15-18.json'];
let total = 0, malos = 0;
for (const a of archivos) {
  const filas = JSON.parse(fs.readFileSync(DIR + a, 'utf8'));
  for (const f of filas) {
    if (!f.respuesta) continue;
    const caso = CASOS.find(c => c.id === f.id);
    if (!caso) { console.log('sin caso', f.id); continue; }
    total++;
    const prep = await prepararCaso(caso);
    const j = juzgar(prep, JSON.parse(JSON.stringify(f.respuesta)));
    // Recorrido por la app con la respuesta guardada.
    const p2 = await prepararCaso(caso); // estado limpio de nuevo
    // quitar lo que creó prepararCaso (sesión/plan de reglas) para que no se descarte
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
        fuente += ` (días rehechos por la app: ${rehechos}/${r.plan.dias.length})`;
      } else {
        const r = await ent.crearSesionHoy({ forzarIA: true, peticion: '', ...caso.ci });
        aviso = r.aviso; fuente = r.sesion && r.sesion.fuente;
        problemas = r.sesion ? ent.problemasSesion(est.estado(), r.sesion, { lugar: caso.ci.lugar, minutos: caso.ci.minutos, dolorHoy: caso.ci.dolorHoy || {}, energia: caso.ci.energia || 3 }) : ['sin sesión'];
      }
    } finally { ponerRed(false); }
    const ok = j.validador.pasa && j.aprueba && !problemas.length && /ia/.test(fuente);
    if (!ok) malos++;
    console.log(`${ok ? 'OK ' : 'MAL'} ${a.slice(8, 24)} ${f.id} ${f.config} | antes: val ${f.pasaValidador} rub ${f.aprueba} | ahora: val ${j.validador.pasa} rub ${j.aprueba} (${j.puntos ?? ''}) seg ${JSON.stringify(j.seguridad || [])} | app: ${fuente} ${aviso ? '«' + aviso + '»' : ''} ${problemas.length ? 'PROBLEMAS ' + problemas.join(' | ') : ''}`);
    if (j.validador.cambios && j.validador.cambios.length) console.log('     cambios:', j.validador.cambios.join(' · ').slice(0, 400));
  }
}
console.log(`\n${total} respuestas, ${malos} con algo`);
