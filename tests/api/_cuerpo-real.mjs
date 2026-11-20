// Cuerpos reales: carga los módulos del móvil (con window, document y localStorage simulados) y captura
// exactamente lo que crearSesionHoy y crearPlanSemana mandan a /api/entrenador.
// No es un archivo de pruebas (no acaba en .test.mjs): lo usan saneado.test.mjs y entrenador.test.mjs.

const almacen = new Map();
globalThis.localStorage = {
  getItem: k => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: k => { almacen.delete(k); },
};
const oyente = { addEventListener() {}, removeEventListener() {} };
globalThis.window = globalThis.window || oyente;
globalThis.document = globalThis.document || { ...oyente, hidden: false };
if (!globalThis.navigator || globalThis.navigator.onLine === undefined) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
}

const raiz = new URL('../../js/', import.meta.url);
const { cargar } = await import(new URL('nucleo/estado.js', raiz));
const { disponibles } = await import(new URL('reglas/catalogo.js', raiz));
const { crearSesionHoy, crearPlanSemana } = await import(new URL('areas/entrenador/entrenador.js', raiz));

const iso = d => d.toISOString().slice(0, 10);

// Una persona con historia de verdad: 3 semanas entrenando, una lesión, comentarios, gustos y medidas.
export function estadoRealista({ todo = false } = {}) {
  const hoy = new Date();
  const S = {
    version: 4, dueño: 'virginia',
    perfil: {
      objetivos: ['perder', 'musculo'], nivel: 2, nivelAuto: true,
      lesiones: todo ? [] : [{ id: 'a', zona: 'cadera_lateral', dolor: 4, desde: '2026-03-01', tipo: 'tendinopatía', nota: 'Trocanteritis derecha, me molesta más al subir escaleras y al dormir de ese lado. La fisio me dijo que siga con los ejercicios de glúteo medio.', activa: true }],
      disponibilidad: { dias: 4, minutos: 60, diasSemana: [1, 2, 4, 5] },
      lugares: todo ? ['gym', 'piscina', 'casa', 'calle'] : ['gym', 'piscina'],
      materialCasa: todo ? ['mancuernas', 'banda', 'banco'] : [],
      gustos: {}, acompañado: true,
      datos: { sexo: 'mujer', altura: 165, nacimiento: '1985-05-05' },
      notas: 'Prefiero máquinas a peso libre. Me aburre mucho la cinta, mejor bici o elíptica. Los martes voy con prisa y tengo como mucho 45 minutos. Quiero bajar de 65 kg antes del verano sin perder fuerza.',
    },
    plan: null, sesiones: {}, dolor: [],
    medidas: [{ fecha: iso(new Date(hoy - 35 * 864e5)), peso: 68.4, cintura: 81 }, { fecha: iso(new Date(hoy - 21 * 864e5)), peso: 68, cintura: 80 }, { fecha: iso(new Date(hoy - 3 * 864e5)), peso: 67.5, cintura: 79 }],
    ajustes: { codigo: 'secreto', vibrar: true, sonido: true, apiUrl: '' },
  };
  const pool = disponibles(S.perfil, 'gym').filter(e => !['movilidad', 'cardio', 'natacion'].includes(e.m[0]));
  const comentarios = ['Me molesta un poco el hombro al bajar', 'Estaba ocupada la máquina y esperé mucho', 'Demasiado fácil, puedo subir', 'Me aburre, siempre lo mismo', 'No sé si lo hago bien, la postura me cuesta'];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy - (i * 1.7 + 1) * 864e5); const id = 's' + i;
    S.sesiones[id] = {
      id, fecha: iso(d), terminada: d.toISOString(), estado: 'hecha', nombre: i % 2 ? 'Torso' : 'Pierna y glúteo', lugar: 'gym',
      checkin: { energia: 3, dolor: { cadera_lateral: 4 } },
      cierre: { esfuerzo: 4, dolor: { cadera_lateral: 4 }, comentario: i % 3 ? '' : 'Bien en general, aunque la prensa estaba ocupada y esperé mucho. Al final hice la elíptica 15 minutos.' },
      ejercicios: pool.slice((i % 2) * 7, (i % 2) * 7 + 7).map((e, j) => ({
        id: e.id, rol: 'principal', series: 3, reps: '8-12',
        sets: [1, 2, 3].map(() => ({ kg: 20 + j * 5 + (i < 4 ? 2.5 : 0), valor: '10', hecha: true })),
        comentario: j < 3 && i < 5 ? comentarios[(i + j) % comentarios.length] : '',
      })),
    };
    S.dolor.push({ fecha: iso(d), zona: 'cadera_lateral', dolor: 3 + (i % 3), momento: 'antes' });
  }
  pool.slice(0, 4).forEach((e, i) => { S.perfil.gustos[e.id] = ['gusta', 'nogusta', 'gusta', 'rechazo'][i]; });
  return S;
}

// Captura los cuerpos que el móvil manda y responde con un error para que siga por las reglas.
async function capturar(S, accion) {
  localStorage.setItem('pipos4', JSON.stringify(S));
  cargar();
  const cuerpos = [];
  const fetchAntes = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    cuerpos.push({ url: String(url), opciones, cuerpo: JSON.parse(opciones.body) });
    return new Response(JSON.stringify({ error: 'prueba' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  };
  try { await accion(); } finally { globalThis.fetch = fetchAntes; }
  return cuerpos;
}

// conPlan: antes se hace el plan de la semana con las reglas, así la sesión lleva «planDeHoy».
export async function cuerpoSesion({ conPlan = false, ...opciones } = {}) {
  const S = estadoRealista(opciones);
  const [c] = await capturar(S, async () => {
    if (conPlan) await crearPlanSemana({ dias: [1, 2, 3, 4, 5, 6, 7], minutos: 50, lugares: ['gym'] }, { conIA: false });
    return crearSesionHoy({
    lugar: 'gym', minutos: 50, energia: 2, dolorHoy: { cadera_lateral: 5 }, forzarIA: true,
    peticion: 'Hoy voy cansada y con la cadera cargada: algo más suave pero que sude un poco, y nada de cinta por favor.',
    });
  });
  return c;
}

export async function cuerpoPlan(opciones = {}) {
  const S = estadoRealista(opciones);
  const [c] = await capturar(S, () => crearPlanSemana({ dias: [1, 2, 3, 4, 5, 6, 7], minutos: 60, lugares: S.perfil.lugares }));
  return c;
}
