// Matriz con respuestas de IA simuladas (sin red real): todas las zonas, lugares, edades y objetivos.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { nuevoS, ent, cat, ponerRed, lesiones } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const { comprobar } = await import('./criterio.mjs');
let seed = +(process.argv[2] || 3);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ZON = Object.keys(cat.ZONAS);
const E = (id, rol = 'principal', o = {}) => ({ id, rol, series: 3, reps: '8-12', descanso: 90, kg: null, nota: '', ...o });
const T = (n, d = '2 min', id) => ({ ...(id ? { id } : {}), nombre: n, detalle: '', duracion: d });
// Respuestas «tramposas»: lo más peligroso de cada zona, rehabilitación de fase 3 con dolor alto, intervalos en
// la nota del cardio, series y repeticiones fuera de rango, estiramientos con riesgo y por nombre.
function respuesta(lugar, zonas) {
  const deLugar = cat.EJERCICIOS.filter(e => e.l.includes(lugar));
  const peligrosos = deLugar.filter(e => zonas.some(z => (e.r || {})[z] === 2)).slice(0, 3).map(e => E(e.id));
  const precaucion = deLugar.filter(e => e.t === 'reps' && zonas.some(z => (e.r || {})[z] === 1)).slice(0, 4).map(e => E(e.id, 'principal', { reps: '4-6', descanso: 30 }));
  const fase3 = deLugar.filter(e => zonas.some(z => lesiones.fasesDe(e, z).includes(3))).slice(0, 2).map(e => E(e.id, 'rehab', { reps: '6-8' }));
  const cardio = deLugar.filter(e => e.m[0] === 'cardio' || ['nado-continuo', 'aquajogging'].includes(e.id)).slice(0, 1).map(e => E(e.id, 'cardio', { reps: '30 min', nota: 'Intervalos: 8 × 1 min a tope, sprint final' }));
  const estira = deLugar.filter(e => /estiramiento|postura/.test(e.id)).slice(0, 4).map(e => T(e.n, '1 min'));
  const otros = deLugar.filter(e => e.t === 'reps' && !(e.r && zonas.some(z => e.r[z]))).slice(0, 3).map(e => E(e.id, 'principal', { series: 8, reps: 'al fallo' }));
  return { nombre: 'IA', calentamiento: [T('Trote'), T('Movilidad')], ejercicios: [...fase3, ...peligrosos, ...precaucion, ...otros, ...cardio], vueltaCalma: estira, cambios: [] };
}
const N = +(process.argv[3] || 600);
const fallos = {}, ejemplos = {}; let total = 0, llamadas = 0;
const reg = (k, n) => { fallos[k] = (fallos[k] || 0) + 1; (ejemplos[k] = ejemplos[k] || []).length < 2 && ejemplos[k].push(n); };
for (let i = 0; i < N; i++) {
  const lugar = pick(['gym', 'piscina', 'casa', 'calle']);
  const perfil = { objetivos: pick([['musculo'], ['perder'], ['fuerza', 'perder'], ['salud'], ['resistencia'], ['natacion']]), lugares: [lugar], materialCasa: pick([[], ['banda', 'mancuernas']]), nivel: pick([1, 2, 3]), datos: { nacimiento: pick(['2008', '1985', '1962', '1956']) + '-01-01' } };
  const S = nuevoS(perfil);
  const zs = [pick(ZON)]; if (rnd() < 0.3) { const z = pick(ZON); if (!zs.includes(z)) zs.push(z); }
  const dolorHoy = {};
  zs.forEach((z, j) => { S.perfil.lesiones.push({ id: 'l' + j, zona: z, dolor: pick([0, 2, 4, 6]), activa: true, desde: pick(['2025-01-01', '2026-11-01']) }); dolorHoy[z] = pick([0, 1, 3, 4, 6]); });
  const ci = { lugar, minutos: pick([30, 45, 60, 90]), energia: pick([1, 2, 3, 3, 5]), dolorHoy, peticion: '' };
  const r = respuesta(lugar, zs);
  ponerRed(true, async () => { llamadas++; return { ok: true, status: 200, json: async () => ({ sesion: structuredClone(r) }) }; });
  let res;
  try { res = await ent.crearSesionHoy({ ...ci, forzarIA: true }); } catch (e) { reg('EXC ' + e.message.slice(0, 80), i); continue; }
  if (!res.sesion) { reg('sin sesión: ' + (res.pregunta ? 'pregunta' : res.aviso), i); continue; }
  total++;
  const nombre = `#${i} ${lugar} niv${perfil.nivel} ${perfil.objetivos} nac ${perfil.datos.nacimiento.slice(0, 4)} ${JSON.stringify(S.perfil.lesiones.map(l => [l.zona, l.dolor, l.desde]))} hoy=${JSON.stringify(dolorHoy)} ${ci.minutos}min e${ci.energia} fuente=${res.sesion.fuente}`;
  for (const p of comprobar(S, res.sesion, ci, { ruta: 'ia' })) reg(p.replace(/\d+/g, 'N'), nombre + ' => ' + p);
  const cardio = res.sesion.ejercicios.find(x => x.rol === 'cardio');
  if (cardio && /a tope|sprint|Intervalos: 8/.test(cardio.nota || '')) reg('nota de intervalos de la IA intacta', nombre);
  reg('fuente ' + res.sesion.fuente, nombre);
}
ponerRed(false);
console.log('casos', total, 'llamadas', llamadas);
for (const [k, n] of Object.entries(fallos).sort((a, b) => b[1] - a[1])) { console.log(n, k); ejemplos[k].forEach(x => console.log('     ', String(x).slice(0, 500))); }
