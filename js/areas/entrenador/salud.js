// Área ENTRENADOR · datos de salud del perfil (D4, C-SALUD-0 y C-SALUD-1 de docs/criterio.md).
// Casillas opcionales en Perfil › Salud (perfil.salud). No diagnostican nada: deciden qué no se programa
// hasta que el médico dé el visto bueno y qué precauciones van siempre. Las aplica el validador.
//
// perfil.salud (todo opcional):
// { hipertension: ''|'controlada'|'sin_controlar', embarazo: semanas (0 = no), posparto: semanas (0 = no),
//   cesarea: bool, medicacion: ['betabloqueantes'|'anticoagulantes'|'azucar'|'corticoides'],
//   cardiopatia, diabetes, diabetesVista, diabetesPies, osteoporosis: ''|'sin_fracturas'|'con_fracturas',
//   protesis, epilepsia, asma, equilibrio: bool, vistoBueno: { campo: true } }

export const CAMPOS_SALUD = {
  hipertension: 'Tensión alta',
  embarazo: 'Embarazo',
  posparto: 'Parto reciente',
  medicacion: 'Medicación',
  cardiopatia: 'Enfermedad del corazón',
  diabetes: 'Diabetes',
  osteoporosis: 'Osteoporosis',
  protesis: 'Prótesis de cadera o rodilla',
  epilepsia: 'Epilepsia',
  asma: 'Asma',
  equilibrio: 'Problemas de equilibrio o caídas',
};
export const MEDICACION = { betabloqueantes: 'Betabloqueantes', anticoagulantes: 'Anticoagulantes', azucar: 'Insulina u otros para el azúcar', corticoides: 'Corticoides largos' };
export const AVISO_VISTO_BUENO = 'Consulta con tu médico antes de seguir; cuando te dé el visto bueno, márcalo.';

const ABDOMINALES_FLEXION = ['crunch', 'crunch-maquina', 'elevacion-piernas', 'rueda-abdominal', 'mountain-climbers'];
const BOCA_ABAJO = ['superman', 'curl-femoral-tumbado', 'ytw-tumbado'];
const IMPACTO = ['comba', 'carrera-suave', 'jumping-jacks-sin-salto'];
const CAIDA = ['comba', 'boxeo-sombra'];
const COLUMNA = ['crunch', 'crunch-maquina', 'rueda-abdominal', 'elevacion-piernas', 'lenador-polea', 'estiramiento-gluteo-rodilla-pecho'];
const INESTABLES = ['zancadas', 'sentadilla-bulgara', 'peso-muerto-rumano-una-pierna', 'comba'];
const CABEZA_ABAJO = ['pike-pushup'];
// Notas del perfil que hablan de salud cuando aún no hay datos de salud (C-SALUD-1, C-CARDIO-4).
const NOTAS_SALUD = /tension|hipertens|corazon|arritmia|marcapasos|infarto|stent|diabet|embaraz|epileps|protesis/;
const sinTildes = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const tieneSalud = s => !!s && Object.entries(s).some(([k, v]) => k !== 'vistoBueno' && (Array.isArray(v) ? v.length : !!v));

// Restricciones del día. { excluir: Set(ids), soloSuave: motivo|null (sin fuerza: caminar suave y movilidad),
//   sinIntervalos, sinImpacto, rpeMax, calentamientoExtra, calentamientoMin, vueltaMin, equilibrio, notas: [texto] }
export function restriccionesSalud(S) {
  const p = S.perfil || {}, s = p.salud || {}, vb = s.vistoBueno || {};
  const r = { excluir: new Set(), soloSuave: null, sinIntervalos: false, sinImpacto: false, rpeMax: null, calentamientoExtra: 0, calentamientoMin: 0, vueltaMin: 0, equilibrio: false, margenMin: 0, isoMax: null, descansoMin: 0, notas: [] };
  const fuera = ids => ids.forEach(id => r.excluir.add(id));
  const rpe = n => { r.rpeMax = r.rpeMax ? Math.min(r.rpeMax, n) : n; };
  const suave = m => { r.soloSuave = r.soloSuave || m; };
  if (!tieneSalud(s)) {
    // Sin datos de salud: las notas del perfil como señal (C-SALUD-1).
    if (NOTAS_SALUD.test(sinTildes(p.notas))) {
      r.sinIntervalos = true; r.margenMin = 2; fuera(CABEZA_ABAJO);
      r.notas.push('Tus notas hablan de tu salud: hoy sin intervalos ni ejercicios cabeza abajo y con 2 repeticiones de margen. Rellena Perfil › Salud para que la app lo tenga en cuenta bien.');
    }
    return r;
  }
  if (s.hipertension) {
    if (s.hipertension === 'sin_controlar') suave('Tu tensión no está controlada: hoy solo caminar suave y movilidad, sin fuerza, hasta que lo esté.');
    r.margenMin = 2; r.sinIntervalos = true; fuera(CABEZA_ABAJO); r.isoMax = 45; r.descansoMin = 60;
    r.notas.push('Tensión alta: suelta el aire al empujar, sin aguantar la respiración, y deja 2 repeticiones de margen.');
  }
  if (+s.embarazo > 0) {
    if (!vb.embarazo) suave('Embarazo sin el visto bueno de tu matrona o ginecóloga: caminar suave, movilidad y fuerza muy ligera.');
    rpe(6); r.sinIntervalos = true; fuera(ABDOMINALES_FLEXION); fuera(['comba', 'carrera-suave', 'boxeo-sombra']);
    if (+s.embarazo >= 16) fuera(BOCA_ABAJO);
    r.notas.push('Embarazo: que puedas hablar mientras entrenas, sin aguantar la respiración y nada boca arriba más de 2 minutos seguidos. Para y consulta si notas sangrado, pérdida de líquido, contracciones, mareo, dolor de cabeza o dolor en la pantorrilla.');
  }
  if (+s.posparto > 0) {
    const tope = s.cesarea ? 8 : 6;
    if (+s.posparto < tope) suave(`Parto hace ${+s.posparto} semanas: de momento caminar, respiración, suelo pélvico y movilidad.`);
    if (+s.posparto < 12) { r.sinImpacto = true; fuera(IMPACTO); }
    fuera(ABDOMINALES_FLEXION);
  }
  const med = Array.isArray(s.medicacion) ? s.medicacion : [];
  if (med.includes('betabloqueantes')) r.notas.push('Con betabloqueantes el pulso no sirve de guía: usa el esfuerzo de 0 a 10.');
  if (med.includes('anticoagulantes')) fuera(CAIDA);
  if (s.cardiopatia) {
    if (!vb.cardiopatia) suave('Enfermedad del corazón sin el visto bueno de tu médico: caminar o bici muy suave y movilidad.');
    rpe(vb.cardiopatia ? 5 : 3); r.sinIntervalos = true; r.calentamientoMin = 10; r.vueltaMin = 10;
    r.notas.push('Corazón: sin aguantar la respiración. Si notas algo en el pecho, mareo o falta de aire rara, para y marca la casilla de alarma.');
  }
  if (s.diabetes || med.includes('azucar')) {
    if (!vb.diabetes) rpe(5);
    r.notas.push('Sigue la pauta de tu médico para medirte antes y después de entrenar y lleva azúcar encima.');
    if (s.diabetesVista) { r.sinIntervalos = true; fuera(CABEZA_ABAJO); }
    if (s.diabetesPies) { r.sinImpacto = true; fuera(IMPACTO); r.notas.push('Revisa tus pies después de la piscina.'); }
  }
  const osteo = s.osteoporosis || (med.includes('corticoides') ? 'sin_fracturas' : '');
  if (osteo) {
    if (osteo === 'con_fracturas' && !vb.osteoporosis) suave('Osteoporosis con fracturas sin el visto bueno de tu médico: solo movilidad y caminar.');
    fuera(COLUMNA); r.equilibrio = true;
    if (osteo === 'con_fracturas') { r.sinImpacto = true; fuera(IMPACTO); }
  }
  if (s.protesis) {
    if (!vb.protesis) suave('Prótesis sin el visto bueno de tu cirujano: movilidad, bici suave y piscina.');
    r.sinImpacto = true; fuera(IMPACTO);
    r.notas.push('Sigue las precauciones de tu cirujano: sin cruzar las piernas ni flexión profunda de cadera o rodilla.');
  }
  if (s.epilepsia) r.notas.push('Epilepsia: piscina solo acompañado y con socorrista, sin aguantar la respiración ni bucear; con barra pesada, siempre con alguien que te ayude.');
  if (s.asma) { r.calentamientoExtra += 3; r.notas.push('Asma: calentamiento más largo y progresivo, inhalador a mano; si aparecen pitidos o tos que no ceden, para.'); }
  if (s.equilibrio) { fuera(INESTABLES); r.equilibrio = true; }
  return r;
}

// Etiquetas para la IA: nunca texto libre (C-SALUD-0).
export function etiquetasSalud(S) {
  const s = (S.perfil || {}).salud || {}, vb = s.vistoBueno || {};
  if (!tieneSalud(s)) return [];
  const out = [];
  const conVB = (k, et) => out.push(et + (vb[k] ? '_visto_bueno' : '_sin_visto_bueno'));
  if (s.hipertension) out.push('hipertension_' + s.hipertension);
  if (+s.embarazo > 0) conVB('embarazo', `embarazo_semana_${Math.round(+s.embarazo)}`);
  if (+s.posparto > 0) out.push(`posparto_semana_${Math.round(+s.posparto)}${s.cesarea ? '_cesarea' : ''}`);
  (s.medicacion || []).forEach(m => out.push('medicacion_' + m));
  if (s.cardiopatia) conVB('cardiopatia', 'cardiopatia');
  if (s.diabetes) conVB('diabetes', 'diabetes');
  if (s.diabetesVista) out.push('diabetes_vista');
  if (s.diabetesPies) out.push('diabetes_pies');
  if (s.osteoporosis) conVB('osteoporosis', 'osteoporosis_' + s.osteoporosis);
  if (s.protesis) conVB('protesis', 'protesis');
  ['epilepsia', 'asma', 'equilibrio'].forEach(k => { if (s[k]) out.push(k); });
  return out;
}
