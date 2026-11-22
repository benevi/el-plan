// La explicación de una sesión de la IA se monta en crearSesionHoy (ia.js:192) como
// [1.º punto, último recurso, «Por tu check-in: …» de la IA, «Ajustado por la app: …», resto] y se corta a 8.
// Las notas de salud del validador (C-SALUD-0: tensión alta, embarazo, corazón…) van en «resto», así que con
// unos cuantos «cambios» de la IA desaparecen, y con ellas los «Ajustado por la app» (C-IA-3).
const R = '/home/user/wt/auditoria/';
const { fijarFecha } = await import(R + 'tests/ayuda/comun.mjs');
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, ponerRed } = await import(R + 'tests/ayuda/node.mjs');
const T = (n, d = '5 min', id = '') => ({ id, nombre: n, detalle: '', duracion: d });
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.', ...o });
for (const nCambios of [0, 3, 6]) {
  const S = nuevoS({ objetivos: ['salud'], nivel: 2 });
  S.perfil.salud = { hipertension: 'controlada', medicacion: ['betabloqueantes'] };
  const sesion = { nombre: 'Torso', foco: 'x', cambios: Array.from({ length: nCambios }, (_, i) => `Cambio ${i + 1} de la IA porque lo pides en el check-in.`),
    explicacion: ['Resumen del día.', 'Punto 2 de la IA.', 'Punto 3 de la IA.'],
    calentamiento: [T('Bici suave', '5 min', 'bici-estatica'), T('Movilidad', '3 min')],
    // jalón con 7 series (lo corrige la app) y sin cardio (lo añade la app)
    ejercicios: [E('press-pecho-maquina'), E('jalon-pecho', 'principal', { series: 7 }), E('prensa-piernas')],
    vueltaCalma: [T('Estiramiento de pecho', '2 min'), T('Estiramiento de cuádriceps', '2 min')] };
  ponerRed(true, async () => ({ ok: true, status: 200, json: async () => ({ sesion }) }));
  const r = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: {}, peticion: '', forzarIA: true });
  ponerRed(false);
  const ex = r.sesion.explicacion;
  const salud = ex.filter(t => /Tensión alta|betabloqueantes|margen en cada serie/.test(t)).length;
  const app = ex.filter(t => /^Ajustado por la app/.test(t)).length;
  console.log(`cambios de la IA: ${nCambios} → ${ex.length} puntos; notas de salud: ${salud}/3; «Ajustado por la app»: ${app}`);
  if (nCambios === 6) console.log(ex.map((t, i) => `  ${i + 1}. ${t}`).join('\n'));
}
