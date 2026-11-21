// Recorrido 12: dos pestañas abiertas a la vez (mismo móvil). Cambios cruzados y sesión en las dos.
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar, BASE } from './comun.mjs';
const b = await navegador();
const ctx = await contexto(b, 'm390');
const A = await ctx.newPage(); const eA = vigilar(A);
await empezar(A, 'victor', { objetivos: ['musculo'] });
const B = await ctx.newPage(); const eB = vigilar(B);
await B.goto(BASE + '#perfil'); await esperar(500);
// A: lesión de hombro. B (sin repintar): cambia el nivel
await A.click('[data-act="perfil.grupo"][data-v="lesiones"]');
await A.click('[data-act="perfil.lesion"]'); await A.selectOption('#l-zona', 'hombro'); await A.click('[data-act="perfil.guardarLesion"]'); await esperar(300);
console.log('B ve la lesión de A?', (await leer(B)).vista.split('\n')[1]);
await B.click('[data-act="perfil.nivel"][data-v="2"]'); await esperar(400);
const S = await A.evaluate(() => JSON.parse(localStorage.pipos4).perfil);
console.log('guardado: nivel', S.nivel, '| lesiones', S.lesiones.map(l => l.zona), '| aviso en B:', (await leer(B)).aviso, '| aviso en A:', (await leer(A)).aviso);
// Plan en A, y en B (con la hoja abierta desde antes) otro plan
await A.click('#nav a[href="#hoy"]'); await B.click('#nav a[href="#hoy"]'); await esperar(300);
await B.click('[data-act="entrenador.plan"]'); await esperar(200);
await A.click('[data-act="entrenador.plan"]');
for (const d of [6, 7]) await A.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
await A.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
await A.click('[data-act="entrenador.prepararHoy"]'); await A.click('[data-act="entrenador.crearHoy"]'); await esperar(600);
await A.click('[data-act="sesion.modo"][data-v="lista"]');
await A.click('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await esperar(300);
console.log('A: sesión en curso', (await leer(A)).hash, '| crono A:', (await leer(A)).crono.split('\n')[0]);
console.log('B: hoja de semana aún abierta?', !!(await B.$('.hoja')), '| B ve:', (await leer(B)).vista.split('\n').slice(9, 12).join(' | '));
await B.click('[data-act="entrenador.psDia"][data-v="7"]').catch(() => {});
const crear = await B.$('[data-act="entrenador.crearPlan"][data-ia="0"]');
if (crear) { await crear.click(); await esperar(600); }
const S2 = await A.evaluate(() => JSON.parse(localStorage.pipos4));
console.log('tras crear plan en B: días del plan', S2.plan.dias.map(d => d.diaSemana), '| hechos', JSON.stringify(S2.plan.hechos), '| sesiones', Object.values(S2.sesiones).map(s => s.estado));
console.log('A tras el plan de B:', (await leer(A)).vista.slice(0, 80).replace(/\n/g, ' | '), '| aviso A:', (await leer(A)).aviso);
await A.reload(); await esperar(800);
console.log('A tras recargar, crono:', JSON.stringify((await leer(A)).crono.split('\n')[0]), '| serie 1 hecha:', await A.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones)[0].ejercicios[0].sets[0].hecha));
await B.goto(BASE + '#hoy'); await esperar(500);
console.log('B en Hoy:', (await leer(B)).vista.split('\n').slice(9, 16).join(' | '), '| crono B:', JSON.stringify((await leer(B)).crono.split('\n')[0]));
await foto(B, '12-m390-pestaña-b');
console.log('errores', eA, eB, await A.evaluate(() => Object.keys(localStorage)));
await b.close();
