// Las fotos de progreso de main (IndexedDB ElPlan2DB/fotos) en el paso a v2: ¿llegan a alguna copia? Puerto 8933.
import path from 'node:path';
import { crearServidor, RAIZ } from '/home/user/wt/auditoria/tests/e2e/servidor.mjs';
import { viejoReal } from '/home/user/wt/auditoria/tests/ayuda/viejo-real.mjs';
import { navegador, contexto } from './comun-pw.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const srv = crearServidor({ raiz: path.join(AQUI, 'main-real') }); await srv.escuchar(8933);
const b = await navegador(); const ctx = await contexto(b, 8933, { reloj: null }); const page = await ctx.newPage();
const log = (...a) => console.log('·', ...a);
try {
  await page.goto('/'); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(d => localStorage.setItem('elplan2', JSON.stringify(d)), viejoReal());
  await page.reload(); await page.waitForFunction(() => window.Store);
  await page.evaluate(async () => { await Store.fotos.put({ id: 'ph_1', user: 'him', date: new Date().toISOString(), data: 'data:image/jpeg;base64,/9j/4AAQ' }); });
  const expMain = await page.evaluate(() => JSON.stringify(Store.exportar()));
  log('main: fotos guardadas =', await page.evaluate(async () => (await Store.fotos.all()).length), '| la copia «Exportar» de main lleva fotos:', /ph_1|fotos/.test(expMain));
  srv.control.raiz = RAIZ;
  await page.reload(); await page.click('[data-act="bienvenida.elegir"][data-v="victor"]'); await page.waitForTimeout(2000);
  const v2 = await page.evaluate(async () => {
    const e = await import('/js/nucleo/estado.js');
    const exp = JSON.stringify(e.exportar());
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [];
    return { lleva: /ph_1|fotos|data:image/.test(exp), dbs, pipos4: /ph_1|data:image/.test(localStorage.getItem('pipos4')) };
  });
  log('v2: la copia a archivo (exportar) lleva fotos:', v2.lleva, '| pipos4 (lo que va a la nube) las lleva:', v2.pipos4, '| bases IndexedDB:', v2.dbs.join(', '));
} catch (e) { console.error('FALLO', e.message.split('\n')[0]); }
finally { await b.close(); await srv.cerrar(); }
