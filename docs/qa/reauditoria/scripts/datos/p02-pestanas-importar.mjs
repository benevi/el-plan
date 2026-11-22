// Dos pestañas: A está a mitad de sesión con un descanso en marcha; B carga una copia (de antes de la sesión).
// ¿Qué pasa en A? ¿Puede A deshacer la copia de B al seguir apuntando? ¿Errores?
import { chromium, devices } from '/home/user/wt/auditoria/node_modules/playwright/index.mjs';
import { crearServidor } from '/home/user/wt/auditoria/tests/e2e/servidor.mjs';
const PUERTO = 8922;
const srv = crearServidor(); await srv.escuchar(PUERTO);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const base = `http://127.0.0.1:${PUERTO}`;
const ctx = await nav.newContext({ ...devices['Pixel 7'] });
await ctx.route(u => !['127.0.0.1'].includes(new URL(u).hostname), r => r.fulfill({ status: 204, body: '' }));
await ctx.route('**/api/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }));
const errores = [];
const A = await ctx.newPage(); A.on('pageerror', e => errores.push('A: ' + e.message));
await A.goto(base + '/'); await A.click('[data-act="bienvenida.elegir"][data-v="victor"]'); await A.waitForSelector('#nav a');
const copia = await A.evaluate(async () => { const e = await import('/js/nucleo/estado.js'); e.cambiar(S => { S.perfil.usoIA = 'ahorro'; S.ajustes.modoSesion = 'lista'; }, 'perfil'); e.guardarYa(); return e.exportar(); });
const id = await A.evaluate(async () => {
  const e = await import('/js/nucleo/estado.js'); const m = await import('/js/nucleo/modelo.js');
  const s = m.crearSesion({ nombre: 'Hoy', lugar: 'gym', ejercicios: [{ id: 'remo-sentado-polea', series: 3, reps: '10-12', descanso: 90, kg: 30 }] });
  e.cambiar(S => { S.sesiones[s.id] = s; }, 'sesion'); e.guardarYa(); location.hash = '#sesion/' + s.id; return s.id;
});
await A.waitForSelector('[data-act="sesion.serie"]');
await A.click('[data-act="sesion.serie"][data-s="0"]');
await A.waitForTimeout(400);
const B = await ctx.newPage(); B.on('pageerror', e => errores.push('B: ' + e.message));
await B.goto(base + '/#perfil'); await B.waitForSelector('#nav a');
const rB = await B.evaluate(async t => { const e = await import('/js/nucleo/estado.js'); try { e.importar(t); return 'importada'; } catch (x) { return 'error: ' + x.message; } }, copia);
await A.waitForTimeout(800);
const enA = await A.evaluate(id => ({ hash: location.hash, titulo: document.title, sesion: !!JSON.parse(localStorage.getItem('pipos4')).sesiones[id], barra: !!document.querySelector('.descanso, .contador, [role=timer]'), texto: document.querySelector('#vista').innerText.slice(0, 160) }), id);
console.log('B:', rB); console.log('A tras la copia de B:', enA);
// A sigue: toca otra serie si está en pantalla.
const hay = await A.locator('[data-act="sesion.serie"]').count();
if (hay) { await A.locator('[data-act="sesion.serie"]').first().click(); await A.waitForTimeout(600); }
console.log('A con botón de serie tras la copia:', hay, '· sesión en pipos4 ahora:', await A.evaluate(id => !!JSON.parse(localStorage.getItem('pipos4')).sesiones[id], id));
// Fin del descanso con la sesión ya inexistente
await A.evaluate(() => { const t = JSON.parse(localStorage.getItem('pipos-crono') || 'null'); return t; }).then(t => console.log('crono guardado:', t && t.tipo, t && t.meta));
console.log('errores:', errores);
await nav.close(); await srv.cerrar(); process.exit(0);
