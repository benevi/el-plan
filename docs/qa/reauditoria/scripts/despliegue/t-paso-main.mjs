// Paso a producción desde la app REAL de main (git archive origin/main), con un elplan2 realista.
// Escenarios (puerto 8932):
//  A) main → v2 con red buena: migra, el SW nuevo entra, sin red funciona.
//  B) main → v2 y el SW nuevo NO se puede instalar (un archivo de APP no casa con su huella, p. ej. un
//     despliegue a medias o una caché intermedia): ¿qué pasa en modo avión?
//  C) Marcha atrás con datos: entreno en v2 → vuelta a main → entreno en main → vuelta a v2.
import path from 'node:path';
import { crearServidor, RAIZ } from '/home/user/wt/auditoria/tests/e2e/servidor.mjs';
import { viejoReal } from '/home/user/wt/auditoria/tests/ayuda/viejo-real.mjs';
import { navegador, contexto, sesiones } from './comun-pw.mjs';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const MAIN = path.join(AQUI, 'main-real');
const esc = process.argv[2] || 'A';
const srv = crearServidor({ raiz: MAIN });
srv.control.api = (q, s) => { s.writeHead(503, { 'content-type': 'application/json' }); s.end('{"error":"sin IA"}'); };
await srv.escuchar(8932);
const b = await navegador(); const ctx = await contexto(b, 8932, { reloj: null });
let page = await ctx.newPage(); const errores = []; const vig = p => p.on('pageerror', e => errores.push(e.message)); vig(page);
const log = (...a) => console.log(`· [${esc}]`, ...a);
const foto = async () => page.evaluate(async () => ({ titulo: document.title, ctl: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL, caches: await caches.keys(), v2: !!document.querySelector('meta[name="pipos-version"]'), arrancado: document.documentElement.hasAttribute('data-arrancado'), fallo: (document.getElementById('fallo-arranque') || {}).textContent || null }));
const esperaCaches = (pred, ms = 15000) => page.waitForFunction(pred, null, { timeout: ms }).catch(() => log('(timeout esperando cachés)'));
try {
  // 1) Producción de hoy: la app de main instalada con sus datos.
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(d => localStorage.setItem('elplan2', JSON.stringify(d)), viejoReal());
  await page.reload(); await page.waitForTimeout(800);
  log('main:', JSON.stringify(await foto()));
  // 2) Se despliega v2.
  srv.control.raiz = RAIZ;
  if (esc === 'B') srv.control.porRuta = { '/icons/maskable-512.png': path.join(AQUI, 'distinto') };
  await page.reload();
  await page.waitForSelector('[data-act="bienvenida.elegir"]', { timeout: 20000 });
  await page.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await page.waitForTimeout(1500);
  log('v2 tras elegir:', JSON.stringify(await foto()), 'sesiones:', (await sesiones(page)).length, 'aviso:', await page.locator('.aviso, [role=status]').allInnerTexts());
  await page.waitForTimeout(3000);
  log('v2 asentado:', JSON.stringify(await foto()));
  // 3) Modo avión: cerrar y reabrir.
  await ctx.setOffline(true);
  await page.close(); page = await ctx.newPage(); vig(page);
  await page.goto('/').catch(e => log('goto sin red:', e.message.split('\n')[0]));
  await page.waitForTimeout(8000);
  log('sin red:', JSON.stringify(await foto().catch(e => 'ERR ' + e.message)), 'nav:', await page.locator('#nav a').count());
  await ctx.setOffline(false);
  if (esc === 'C') {
    await page.goto('/'); await page.waitForSelector('#nav a');
    // Una sesión hecha en v2 (como al entrenar tras el lanzamiento)
    await page.evaluate(async () => {
      const e = await import('/js/nucleo/estado.js'); const m = await import('/js/nucleo/modelo.js');
      e.cambiar(S => { const s = m.crearSesion({ fecha: e.hoyISO(), nombre: 'Hecha en v2', lugar: 'gym', fuente: 'reglas', ejercicios: [{ id: 'press-banca-mancuernas', rol: 'principal', series: 3, reps: '8-10', descanso: 90, kg: 20 }] }); s.estado = 'hecha'; S.sesiones[s.id] = s; }, 'prueba');
      e.guardarYa();
    });
    const antes = await sesiones(page);
    log('v2 antes de la marcha atrás:', antes.length, 'sesiones');
    // Marcha atrás: Vercel vuelve al despliegue de main. «Abrir la app dos veces».
    srv.control.raiz = MAIN; srv.control.porRuta = {};
    for (let i = 1; i <= 3; i++) {
      await page.close(); page = await ctx.newPage(); vig(page);
      await page.goto('/'); await page.waitForTimeout(2500);
      log(`marcha atrás, apertura ${i}:`, JSON.stringify(await foto()));
    }
    const lsMain = await page.evaluate(() => ({ pipos4: !!localStorage.getItem('pipos4'), workouts: Object.keys(JSON.parse(localStorage.getItem('elplan2')).workouts).length }));
    log('en main:', JSON.stringify(lsMain), 'main ve la sesión de v2:', await page.evaluate(() => JSON.stringify(window.Store && Object.values(Store.S.workouts).some(w => /v2/.test(w.nombre || '')))));
    // Entreno en main durante la marcha atrás
    await page.evaluate(() => { const k = 'w_marcha_atras'; Store.S.workouts[k] = { key: k, user: 'him', day: 'B', nombre: 'Hecha en main', lugar: 'gym', date: new Date().toISOString(), completed: true, completedAt: new Date().toISOString(), exercises: [{ exId: 'press-pecho-maquina', name: 'Press', sets: [{ weight: '40', reps: '10', done: true }] }] }; Store.guardar(); });
    // Vuelve v2 (arreglada)
    srv.control.raiz = RAIZ;
    for (let i = 1; i <= 2; i++) {
      await page.close(); page = await ctx.newPage(); vig(page);
      await page.goto('/'); await page.waitForTimeout(3000);
      log(`vuelta a v2, apertura ${i}:`, JSON.stringify(await foto()), 'avisos:', JSON.stringify(await page.locator('.aviso, #avisos, [role=status]').allInnerTexts()));
    }
    const despues = await sesiones(page);
    log('v2 después:', despues.length, 'sesiones; la de v2:', despues.some(s => antes.find(a => a.id === s.id && a.fuente === 'reglas')), '; la de main:', despues.filter(s => !antes.some(a => a.id === s.id)).map(s => s.fuente + ' ' + s.fecha));
  }
  log('errores:', JSON.stringify(errores));
} catch (e) { console.error('FALLO', e.message.split('\n')[0]); await page.screenshot({ path: path.join(AQUI, `paso-${esc}.png`) }).catch(() => {}); }
finally { await b.close(); await srv.cerrar(); }
