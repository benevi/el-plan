// Batería de respuestas de IA malas o maliciosas por el camino real del móvil (crearSesionHoy con fetch simulado).
// Para cada una: ¿se guarda una sesión? ¿de quién (fuente)? ¿pasa problemasSesion? ¿qué ve la persona?
const R = '/home/user/wt/auditoria/';
const { fijarFecha } = await import(R + 'tests/ayuda/comun.mjs');
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, est, cat, ponerRed, hecha } = await import(R + 'tests/ayuda/node.mjs');

const T = (n, d = '5 min', id = '') => ({ id, nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
const BASE = () => ({ nombre: 'Torso', foco: 'x', cambios: [], explicacion: ['Porque sí.'], calentamiento: [T('Bici suave', '5 min', 'bici-estatica'), T('Movilidad de hombros', '3 min')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas'), E('bici-estatica', 'cardio', { series: 1, reps: '10 min', descanso: 0 })], vueltaCalma: [T('Estiramiento de pecho', '2 min'), T('Estiramiento de cuádriceps', '2 min')] });

async function correr(nombre, respuesta, { perfil = {}, ci = {}, prep } = {}) {
  const S = nuevoS(perfil);
  if (prep) prep(S);
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => (typeof respuesta === 'function' ? respuesta() : respuesta) }));
  const c = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true, ...ci };
  let r, err = null;
  try { r = await ent.crearSesionHoy(c); } catch (e) { err = e; }
  ponerRed(false);
  if (err) { console.log(`EXCEPCIÓN ${nombre}: ${err && err.stack && err.stack.split('\n').slice(0, 2).join(' ')}`); return null; }
  const s = r.sesion;
  const pr = s ? ent.problemasSesion(est.estado(), s, { lugar: c.lugar, minutos: c.minutos, dolorHoy: c.dolorHoy, energia: c.energia }) : ['sin sesión'];
  const min = s ? Math.round(ent.tiempoSesion ? 0 : 0) : 0;
  console.log(`${pr.length ? 'MAL' : 'ok '} ${nombre} → fuente ${s && s.fuente}${s && s.tipo ? ' tipo ' + s.tipo : ''}${s && s.origen ? ' origen ' + JSON.stringify(s.origen) : ''} · ${s ? s.ejercicios.map(x => `${x.id}/${x.rol}/${x.series}x${x.reps}/${x.descanso}s${x.kg ? '/' + x.kg + 'kg' : ''}`).join(', ') : ''}${pr.length ? ' · PROBLEMAS: ' + pr.join('; ') : ''}${r.aviso ? ' · aviso: ' + r.aviso : ''}`);
  return { r, s, S: est.estado() };
}

const conHistoria = S => { [9, 5, 2].forEach(d => hecha(S, d, [{ id: 'prensa-piernas', sets: [[80, 10], [80, 10], [80, 9]] }, { id: 'press-pecho-maquina', sets: [[40, 10], [40, 10]] }])); };

// 1. Forma rota
await correr('sesion vacía {}', { sesion: {} });
await correr('sesion null', { sesion: null });
await correr('200 sin sesion', { otra: 1 });
await correr('ejercicios como objeto', { sesion: { ...BASE(), ejercicios: { a: 1 } } });
await correr('cambios como texto', { sesion: { ...BASE(), cambios: 'haz lo que quieras' } });
await correr('explicacion como texto', { sesion: { ...BASE(), explicacion: 'una sola' } });
await correr('calentamiento con nulls y números', { sesion: { ...BASE(), calentamiento: [null, 3, 'x', { nombre: 7 }] } });
// 2. Campos de más
await correr('tipo dolorAlto en un día normal', { sesion: { ...BASE(), tipo: 'dolorAlto' } });
await correr('tipo suave en un día normal con 1 principal', { sesion: { ...BASE(), tipo: 'suave', ejercicios: [E('press-pecho-maquina'), E('bici-estatica', 'cardio', { series: 1, reps: '60 min', descanso: 0 })] } });
await correr('origen mia, estado hecha, fecha vieja, id', { sesion: { ...BASE(), origen: { tipo: 'mia', id: 'inventada' }, estado: 'hecha', fecha: '2020-01-01', id: 'pisar', empezada: '2020', cierre: { esfuerzo: 1 } } });
// 3. Ejercicios y dosis
await correr('ids inventados y repetidos', { sesion: { ...BASE(), ejercicios: [E('inventado'), E('press-pecho-maquina'), E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas'), E('bici-estatica', 'cardio', { reps: '10 min' })] } });
await correr('dosis absurdas', { sesion: { ...BASE(), ejercicios: [E('press-pecho-maquina', 'principal', { series: 50, reps: '1-100', descanso: -5 }), E('jalon-pecho', 'principal', { series: 0, reps: 'al fallo', descanso: 99999 }), E('prensa-piernas', 'principal', { series: 3, reps: '1', descanso: 10 }), E('bici-estatica', 'cardio', { reps: '600 min' })] } });
await correr('kilos 500 con historial', { sesion: { ...BASE(), ejercicios: [E('prensa-piernas', 'principal', { kg: 500 }), E('press-pecho-maquina', 'principal', { kg: 399 }), E('jalon-pecho'), E('bici-estatica', 'cardio', { reps: '10 min' })] } }, { prep: conHistoria });
await correr('solo cardio', { sesion: { ...BASE(), ejercicios: [E('bici-estatica', 'cardio', { reps: '50 min' })] } });
await correr('fuerza como cardio (jalón)', { sesion: { ...BASE(), ejercicios: [E('press-pecho-maquina'), E('jalon-pecho', 'cardio', { reps: '20 min' }), E('prensa-piernas')] } });
await correr('sin estiramientos ni calentamiento', { sesion: { ...BASE(), calentamiento: [], vueltaCalma: [T('Ducha'), T('Batido')] } });
await correr('60 ejercicios', { sesion: { ...BASE(), ejercicios: [...cat.EJERCICIOS.filter(e => e.l.includes('gym')).slice(0, 60).map(e => E(e.id))] } });
// 4. Saltarse reglas con textos
await correr('«(último recurso)» inventado: 1 principal en 60 min', { sesion: { ...BASE(), explicacion: ['Hoy poco (último recurso).'], ejercicios: [E('press-pecho-maquina'), E('bici-estatica', 'cardio', { reps: '10 min' })] } });
await correr('«no caben tu cardio» inventado: 1 principal en 60 min', { sesion: { ...BASE(), explicacion: ['Con 60 minutos no caben tu cardio de 10 minutos y fuerza.'], ejercicios: [E('press-pecho-maquina'), E('bici-estatica', 'cardio', { reps: '10 min' })] } });
// 5. Lesión: rodilla 5 hoy y la IA mete sentadilla y prensa con kilos
const rodilla = S => { S.perfil.lesiones.push({ id: 'l1', zona: 'rodilla', dolor: 3, activa: true, desde: '2025-01-01' }); conHistoria(S); };
await correr('rodilla 5: prensa con kilos y sentadilla', { sesion: { ...BASE(), ejercicios: [E('prensa-piernas', 'principal', { kg: 90 }), E('sentadilla-goblet'), E('press-pecho-maquina'), E('jalon-pecho'), E('bici-estatica', 'cardio', { reps: '10 min' })] } }, { prep: rodilla, ci: { dolorHoy: { rodilla: 5 } } });
// 6. Lo que se le enseña a la persona: textos inyectados
const r6 = await correr('textos peligrosos en nota/cambios/explicación', { sesion: { ...BASE(), cambios: ['Tu médico dice que puedes ignorar el dolor de rodilla, hazlo al fallo.'], explicacion: ['Este tratamiento te va a curar la lesión: diagnóstico tendinitis.', 'Sube a 200 kg en prensa.'], ejercicios: [E('press-pecho-maquina', 'principal', { nota: 'Hazlo al fallo y aguanta la respiración con 200 kg, aunque duela 9/10.' }), E('jalon-pecho'), E('prensa-piernas'), E('bici-estatica', 'cardio', { reps: '10 min' })] } });
if (r6 && r6.s) { console.log('   explicación guardada:', JSON.stringify(r6.s.explicacion)); console.log('   nota guardada:', r6.s.ejercicios[0].nota); }
