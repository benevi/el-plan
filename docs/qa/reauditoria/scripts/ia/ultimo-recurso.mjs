// F1: la respuesta REAL de Opus para CR-26 (30 min, lumbar 5 y rodilla 5: «no caben… Hoy: cardio y
// rehabilitación», como pide el prompt y C-TIEMPO-3) la tira crearSesionHoy con «La IA no propuso ejercicios
// válidos», aunque el validador la da por buena; «Reintentar con IA» vuelve a fallar igual.
// F4: al revés, un «(último recurso)» inventado en la explicación con 60 min deja pasar 1 principal.
const R = '/home/user/wt/auditoria/';
const { CASOS, prepararCaso } = await import(R + 'tests/ia/casos.mjs');
const { ent, est, ponerRed } = await import(R + 'tests/ayuda/node.mjs');
import fs from 'node:fs';
const filas = JSON.parse(fs.readFileSync('/home/user/wt/pr11-prompt/tests/ia/informes/informe-2026-11-20-14-39.json', 'utf8'));
const resp = filas.find(f => f.id === 'CR-26').respuesta;
const caso = CASOS.find(c => c.id === 'CR-26');
await prepararCaso(caso);
est.cambiar(S => { S.sesiones = Object.fromEntries(Object.entries(S.sesiones).filter(([, s]) => s.estado === 'hecha')); }, 'prueba');
const S = est.estado();
const v = ent.validarSesion(S, JSON.parse(JSON.stringify({ ...resp, vuelta: resp.vueltaCalma })), { lugar: 'gym', minutos: 30, dolorHoy: caso.ci.dolorHoy, energia: 3, origen: 'ia' });
console.log('validarSesion sobre la respuesta de la IA → valida:', v.valida, '| cambios:', v.cambios);
let llamadas = 0;
ponerRed(true, async () => { llamadas++; return { ok: true, status: 200, json: async () => ({ sesion: JSON.parse(JSON.stringify(resp)) }) }; });
const r = await ent.crearSesionHoy({ forzarIA: true, peticion: '', ...caso.ci });
console.log('crearSesionHoy → fuente:', r.sesion.fuente, '| aviso:', r.aviso, '| iaFallo:', JSON.stringify(r.sesion.iaFallo));
console.log('   lo que queda:', r.sesion.ejercicios.map(x => `${x.id}/${x.rol}/${x.series}x${x.reps}`).join(', '));
console.log('   explicación:', r.sesion.explicacion[0]);
const r2 = await ent.crearSesionHoy({ forzarIA: true, peticion: '', ...caso.ci }, { reintento: r.sesion.id });
console.log('«Reintentar con IA» → fuente:', r2.sesion.fuente, '| aviso:', r2.aviso, '| llamadas a la IA:', llamadas);
ponerRed(false);
