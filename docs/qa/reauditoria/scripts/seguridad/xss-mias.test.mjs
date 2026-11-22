import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { modulo, viejoDemo } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
import { montar, tic } from '/home/user/wt/auditoria/tests/ayuda/dom.mjs';
import { generarEstadoLargo } from '/home/user/wt/auditoria/tests/ayuda/estado-largo.mjs';
const a = await montar({ ls: { elplan2: viejoDemo() }, hash: 'hoy' });
after(() => a.cerrar());
const ent = await import(modulo('js/areas/entrenador/entrenador.js'));
const { EJERCICIOS } = await import(modulo('js/datos/ejercicios.js'));
const V = `"'><img src=x onerror=window.__pwn=1 data-pwn>`;
test('mis sesiones envenenadas', async () => {
  await generarEstadoLargo(a.estado, ent);
  const x = JSON.parse(a.estado.exportar());
  x.misSesiones = [{ id: 'mia-1', nombre: V.slice(0, 40), lugar: 'gym', minutos: 30, creada: new Date().toISOString(), ejercicios: EJERCICIOS.slice(0, 3).map(e => ({ id: e.id, rol: 'principal', series: 3, reps: V.slice(0, 24), descanso: 60 })) }];
  a.estado.importar(JSON.stringify(x), { otraPersona: true });
  assert.equal(a.estado.estado().misSesiones.length, 1);
  const doc = a.doc, hall = new Set();
  const mirar = d => { doc.querySelectorAll('[data-pwn], img[src="x"]').forEach(() => hall.add(d)); if (a.w.__pwn) hall.add('ejec ' + d); };
  for (const ru of ['hoy', 'perfil', 'ejercicios']) {
    await a.ir(ru); mirar(ru);
    const els = [...doc.querySelectorAll('[data-act]')].filter(e => /mia|mias|repetir|guardad/i.test(e.dataset.act + e.textContent)).slice(0, 20);
    for (const el of els) { try { a.clic(el); await tic(); } catch {} mirar(ru + '>' + el.dataset.act); const inner = [...doc.querySelectorAll('[data-act]')].filter(e => /mia/i.test(e.dataset.act)).slice(0, 10); for (const e2 of inner) { try { a.clic(e2); await tic(); } catch {} mirar(ru + '>' + el.dataset.act + '>' + e2.dataset.act); } await a.ir(ru); }
    console.log(ru, els.map(e => e.dataset.act).join(','));
  }
  console.log('veneno visible como texto:', doc.body.innerHTML.includes('&lt;img'));
  assert.deepEqual([...hall], []);
});
