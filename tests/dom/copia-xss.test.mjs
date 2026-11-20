// XSS por copia (revisión del PR 4): un estado largo generado por la app, con TODOS sus textos libres
// envenenados al máximo de su longitud, se importa y se recorren todas las pantallas y hojas de solo lectura.
// Ningún elemento ni atributo on… del veneno puede aparecer (el texto escapado sí puede verse).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { viejoDemo, modulo } from '../ayuda/comun.mjs';
import { montar, tic } from '../ayuda/dom.mjs';
import { generarEstadoLargo } from '../ayuda/estado-largo.mjs';

const a = await montar({ ls: { elplan2: viejoDemo() }, hash: 'hoy' });
after(() => a.cerrar());
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));

const P = n => n >= 40 ? `PWN"'><img src=x onerror="window.__pwn=1" data-pwn>` : n >= 24 ? `'"><i data-pwn>` : '<i data-pwn>';
const LIBRES = { nombre: 120, foco: 120, nota: 300, motivo: 300, comentario: 400, detalle: 400, duracion: 30, notas: 2000, resumen: 2000, criterios: 2000, progresion: 2000, texto: 600, valor: 12, reps: 24, vid: 200 };
function envenenar(o) {
  if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === 'string') o[i] = P(600); else envenenar(v); }); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && LIBRES[k]) o[k] = P(LIBRES[k]);
    else if (k === 'explicacion' && Array.isArray(v)) o[k] = v.map(() => P(600));
    else envenenar(v);
  }
}

test('ningún texto de la copia se convierte en HTML en ninguna pantalla ni hoja', async () => {
  await generarEstadoLargo(a.estado, ent);
  const x = JSON.parse(a.estado.exportar());
  envenenar(x);
  x.migracion.claves.push(P(200));
  a.estado.importar(JSON.stringify(x), { otraPersona: true });
  const doc = a.doc, hallazgos = new Set();
  let visto = 0;
  const mirar = donde => {
    if (doc.body.textContent.includes('data-pwn')) visto++;
    doc.querySelectorAll('[data-pwn], img[src="x"]').forEach(() => hallazgos.add('elemento en ' + donde));
    doc.querySelectorAll('*').forEach(el => { for (const at of el.attributes) if (/^on/i.test(at.name) && /pwn/i.test(at.value)) hallazgos.add(`${at.name} en ${donde}`); });
    if (a.w.__pwn) hallazgos.add('ejecutado en ' + donde);
  };
  const S = a.estado.estado();
  const rutas = ['hoy', 'progreso', 'perfil', 'ejercicios', ...Object.keys(S.sesiones).map(id => 'sesion/' + id)];
  const sel = '[data-act="perfil.lesion"][data-id], [data-act="progreso.ejercicio"], [data-act="ejercicios.ficha"], [data-act="sesion.ficha"], [data-act="sesion.menu"], [data-act="sesion.ir"], [data-act="entrenador.verDia"]';
  for (const ru of rutas) {
    await a.ir(ru);
    mirar(ru);
    if (ru === 'perfil') for (const g of ['objetivos', 'lesiones', 'entreno', 'datos', 'copias', 'ajustes']) { a.clic(`[data-act="perfil.grupo"][data-v="${g}"]`); await tic(); mirar('perfil:' + g); }
    const n = Math.min(doc.querySelectorAll(sel).length, 20);
    for (let i = 0; i < n; i++) {
      const el = doc.querySelectorAll(sel)[i]; if (!el) break;
      a.clic(el); await tic(); mirar(`${ru} > ${el.dataset.act}`);
    }
  }
  assert.ok(visto > 10, 'el veneno se ve como texto (escapado) en muchas pantallas');
  assert.deepEqual([...hallazgos], []);
  assert.equal(a.pantallaRota(), false);
});
