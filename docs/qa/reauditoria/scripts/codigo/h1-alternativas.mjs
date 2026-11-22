// H1: «Cambiar por otro» (catalogo.alternativas → nivelesZona) no aplica C-LES-2/C-LES-3 (bandasHoy del validador).
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, cat, modelo } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const { bandasHoy, nivelesDe } = await import('/home/user/wt/auditoria/js/areas/entrenador/dia.js');
for (const caso of [
  { nombre: 'lesión nueva de rodilla (ficha 3), hoy 3', lesion: { id: 'l', zona: 'rodilla', dolor: 3, activa: true, desde: '2026-11-10' }, hoy: { rodilla: 3 } },
  { nombre: 'sin lesión registrada, hoy rodilla 3 (C-LES-3)', lesion: null, hoy: { rodilla: 3 } },
]) {
  const S = nuevoS({ objetivos: ['musculo'], nivel: 2, lugares: ['gym'] });
  if (caso.lesion) S.perfil.lesiones.push(caso.lesion);
  const ci = { lugar: 'gym', minutos: 60, energia: 3, dolorHoy: caso.hoy, peticion: '' };
  const ses = modelo.crearSesion(ent.ajustarAlCheckin(S, null, ci).datos);
  const b = bandasHoy(S, caso.hoy);
  console.log(`\n== ${caso.nombre}: banda del validador B${b.rodilla.banda}; nivelesZona da ${JSON.stringify(cat.nivelesZona(S.perfil, caso.hoy))}`);
  console.log('sesión (validada):', ses.ejercicios.map(x => x.id + (cat.ex(x.id).r?.rodilla ? '[r rodilla=' + cat.ex(x.id).r.rodilla + ']' : '')).join(', '));
  // Lo que ofrece «Cambiar por otro» para cada principal, como js/areas/sesion/indice.js:668
  let malos = 0;
  for (const x of ses.ejercicios.filter(x => x.rol === 'principal')) {
    const alts = cat.alternativas(cat.ex(x.id), 'gym', S.perfil, { excluir: ses.ejercicios.map(y => y.id), dolorHoy: caso.hoy, nivel: 2 }).slice(0, 8);
    const conR = alts.filter(a => (a.r || {}).rodilla);
    if (conR.length) { malos += conR.length; console.log(`  cambiar ${x.id} ofrece con riesgo de rodilla:`, conR.map(a => `${a.id}(r=${a.r.rodilla})`).join(', ')); }
    // ¿Lo aceptaría el validador? Sustituye y valida
    for (const a of conR.slice(0, 1)) {
      const copia = structuredClone(ses); copia.ejercicios[ses.ejercicios.indexOf(x)] = { ...x, id: a.id };
      console.log('    el validador dice de la sesión con el cambio:', ent.problemasSesion(S, copia, ci));
    }
  }
  console.log('alternativas con riesgo en la zona B2:', malos);
}
