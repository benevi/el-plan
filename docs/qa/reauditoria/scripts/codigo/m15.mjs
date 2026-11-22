// ¿Cambia algo la sesión con dolor 7 si el umbral de checkin.js pasa a 8? (raíz por argumento)
const R = process.argv[2];
const { fijarFecha } = await import(R + '/tests/ayuda/comun.mjs');
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, cat, modelo, ponerRed } = await import(R + '/tests/ayuda/node.mjs');
const out = [];
for (const zona of ['rodilla', 'lumbar', 'hombro']) for (const lugar of ['gym', 'piscina', 'casa']) {
  const S = nuevoS({ objetivos: ['musculo'], lugares: [lugar] });
  S.perfil.lesiones.push({ id: 'l', zona, dolor: 3, activa: true, desde: '2026-01-01' });
  const ci = { lugar, minutos: 60, energia: 3, dolorHoy: { [zona]: 7 }, peticion: '' };
  const s = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
  out.push(`${zona}/${lugar}: ${s.nombre} | ${s.ejercicios.map(x => x.rol[0] + ':' + x.id).join(',')} | ${ent.tiempoSesion(s)} min`);
  // Camino IA con forzarIA
  let n = 0; ponerRed(true, async () => { n++; return { ok: true, status: 200, json: async () => ({ sesion: { nombre: 'IA', ejercicios: [{ id: 'sentadilla-barra', rol: 'principal', series: 3, reps: '8', descanso: 90 }] } }) }; });
  nuevoS({ objetivos: ['musculo'], lugares: [lugar], lesiones: [{ id: 'l', zona, dolor: 3, activa: true, desde: '2026-01-01' }] });
  const r = await ent.crearSesionHoy({ ...ci, forzarIA: true });
  out.push(`   IA llamada: ${n}, principales: ${r.sesion.ejercicios.filter(x => x.rol === 'principal').map(x => x.id).join(',') || '-'}`);
  ponerRed(false);
}
console.log(out.join('\n'));
