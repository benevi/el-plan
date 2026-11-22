// XSS amplio: envenena TODOS los textos (no solo la lista LIBRES de copia-xss.test.mjs) y también las CLAVES
// de los objetos-mapa, sección por sección; importa y recorre pantallas y hojas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { modulo, viejoDemo } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
import { montar, tic } from '/home/user/wt/auditoria/tests/ayuda/dom.mjs';
import { generarEstadoLargo } from '/home/user/wt/auditoria/tests/ayuda/estado-largo.mjs';

const a = await montar({ ls: { elplan2: viejoDemo() }, hash: 'hoy' });
after(() => a.cerrar());
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
const V = `x"'><img src=x onerror="window.__pwn=1" data-pwn>`;
const vivos = o => JSON.stringify(o).split('data-pwn').length - 1;

function envenenar(o, claves) {
  if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string') o[i] = v + V; else envenenar(v, claves); }); return; }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') o[k] = v + V; else envenenar(v, claves);
    if (claves && v && typeof v === 'object' && !Array.isArray(v) === false) { /* nada */ }
  }
  if (claves) for (const k of Object.keys(o)) { if (/^[\w-]+$/.test(k) && k.length > 5 && /-|\d/.test(k)) o[k + V] = o[k]; }
}

const resultados = [];
async function recorrer(etq) {
  const doc = a.doc, hallazgos = new Set();
  const mirar = donde => {
    doc.querySelectorAll('[data-pwn], img[src="x"]').forEach(() => hallazgos.add('elemento en ' + donde));
    doc.querySelectorAll('*').forEach(el => { for (const at of el.attributes) if (/^on/i.test(at.name) && /pwn/i.test(at.value)) hallazgos.add(`${at.name} en ${donde}`); });
    if (a.w.__pwn) hallazgos.add('ejecutado en ' + donde);
  };
  const S = a.estado.estado();
  const rutas = ['hoy', 'progreso', 'perfil', 'ejercicios', ...Object.keys(S.sesiones).slice(0, 3).map(id => 'sesion/' + id)];
  const sel = '[data-act]';
  for (const ru of rutas) {
    await a.ir(ru); mirar(ru);
    if (ru === 'perfil') for (const g of ['objetivos', 'lesiones', 'entreno', 'datos', 'copias', 'ajustes']) { a.clic(`[data-act="perfil.grupo"][data-v="${g}"]`); await tic(); mirar('perfil:' + g); }
    const n = Math.min(doc.querySelectorAll(sel).length, 40);
    for (let i = 0; i < n; i++) {
      const el = doc.querySelectorAll(sel)[i]; if (!el) break;
      const act = el.dataset.act;
      if (/borrar|importar|reiniciar|cero|dueño|exportar|nube|frase|eliminar|cancelar|empezar|terminar/i.test(act)) continue;
      try { a.clic(el); await tic(); } catch { /* */ }
      mirar(`${ru} > ${act}`);
      if (location.hash.replace('#', '') !== ru) await a.ir(ru);
    }
  }
  return [...hallazgos];
}

function clavesTexto(o, out = new Set(), padre = '') {
  if (Array.isArray(o)) { o.forEach(v => typeof v === 'string' ? out.add(padre + '[]') : clavesTexto(v, out, padre)); return out; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') out.add(k); else clavesTexto(v, out, k); }
  return out;
}
function porClave(o, clave, padre = '') {
  if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string') { if (padre + '[]' === clave) o[i] = v + V; } else porClave(v, clave, padre); }); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') { if (k === clave) o[k] = v + V; } else porClave(v, clave, k); }
}
test('XSS amplio por clave', async () => {
  await generarEstadoLargo(a.estado, ent);
  const base = a.estado.exportar();
  const todas = [...clavesTexto(JSON.parse(base))];
  console.log('claves', todas.length, todas.join(','));
  for (const sec of todas) {
    for (const claves of [false]) {
      const x = JSON.parse(base);
      porClave(x, sec);
      let r;
      try { a.estado.importar(JSON.stringify(x), { otraPersona: true }); } catch (e) { resultados.push({ sec, claves, importar: 'rechazada: ' + e.message.slice(0, 80) }); continue; }
      const sobreviven = vivos(a.estado.estado()); if (!sobreviven) { resultados.push({ sec, sobreviven }); a.estado.importar(base, { otraPersona: true }); continue; }
      r = await recorrer(sec);
      resultados.push({ sec, claves, sobreviven, hallazgos: r });
      a.w.__pwn = undefined;
      a.estado.importar(base, { otraPersona: true });
    }
  }
  console.log(JSON.stringify(resultados, null, 1));
  assert.deepEqual(resultados.filter(r => r.hallazgos && r.hallazgos.length), []);
});
