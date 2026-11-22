// ¿Qué impide que salga un ejercicio rechazado si la IA lo propone? (raíz por argumento)
const R = process.argv[2];
const { fijarFecha } = await import(R + '/tests/ayuda/comun.mjs');
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, modelo, ponerRed, est } = await import(R + '/tests/ayuda/node.mjs');
const E = (id, rol = 'principal') => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.' });
const T = n => ({ id: '', nombre: n, detalle: '', duracion: '5 min' });
const ses = { nombre: 'Torso', calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas'), E('bici-estatica', 'cardio')], vueltaCalma: [T('Estirar pecho'), T('Estiramiento de cuádriceps')], explicacion: ['x'] };
ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion: structuredClone(ses) }) }));
nuevoS({ objetivos: ['musculo'], gustos: { 'prensa-piernas': 'rechazo' } });
const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true });
console.log('sesión:', r.sesion.ejercicios.map(x => x.id).join(', '));
// Plan
const dia = (ds) => ({ diaSemana: ds, lugar: 'gym', nombre: 'D', foco: '', minutos: 60, explicacion: ['x'], calentamiento: [T('a'), T('b')], ejercicios: ses.ejercicios, vueltaCalma: [T('Estirar'), T('Respirar')] });
ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ plan: { resumen: 'r', criterios: 'c', progresion: 'p', dias: [dia(3), dia(5)] } }) }));
nuevoS({ objetivos: ['musculo'], gustos: { 'prensa-piernas': 'rechazo' } });
await ent.crearPlanSemana({ dias: [3, 5], minutos: 60, lugares: ['gym'] });
console.log('plan:', est.estado().plan.dias.map(d => d.ejercicios.map(x => x.id).join(',')).join(' | '));
