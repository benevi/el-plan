// Segunda verificación de cada error apuntado (independiente de los recorridos). Imprime REPRODUCIDO / NO y
// guarda la captura que acompaña a cada error en el informe. Uso: node 99-verificacion.mjs
import { navegador, contexto, vigilar, foto, leer, botones, esperar, empezar } from './comun.mjs';
const b = await navegador();
const R = (id, ok, dato) => console.log(`${ok ? 'REPRODUCIDO' : 'NO        '} ${id} · ${dato}`);
async function nueva({ movil = 'm360', quien = 'victor', objetivos = ['musculo'], lesion, reloj = '2026-11-21T10:00:00+01:00', dias = [6, 7] } = {}) {
  const ctx = await contexto(b, movil); const page = await ctx.newPage(); vigilar(page);
  await page.clock.install({ time: new Date(reloj) });
  await empezar(page, quien, { objetivos });
  if (lesion) {
    await page.click('[data-act="perfil.grupo"][data-v="lesiones"]'); await page.click('[data-act="perfil.lesion"]');
    await page.selectOption('#l-zona', lesion.zona); await page.$eval('#l-dolor', (el, v) => { el.value = v; }, lesion.dolor);
    if (lesion.desde) await page.fill('#l-desde', lesion.desde);
    await page.click('[data-act="perfil.guardarLesion"]');
  }
  await page.click('#nav a[href="#hoy"]'); await page.clock.runFor(300);
  await page.click('[data-act="entrenador.plan"]');
  const on = await page.$$eval('[data-act="entrenador.psDia"].on', bs => bs.map(x => +x.dataset.v));
  for (const d of on) if (!dias.includes(d)) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  for (const d of dias) if (!on.includes(d)) await page.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  await page.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await page.clock.runFor(600);
  return { ctx, page };
}
const ses = page => page.evaluate(() => Object.values(JSON.parse(localStorage.pipos4).sesiones));
let { ctx, page } = await nueva({ lesion: { zona: 'rodilla', dolor: 4 } });
// V15 minutos del plan
const minPlan = (await leer(page)).vista.match(/unos (\d+) min/g); R('E-PLAN-MIN', minPlan.some(t => +t.match(/\d+/)[0] > 66), `con 60 min pedidos el plan dice: ${minPlan.join(', ')}`);
await foto(page, 'E01-plan-mas-minutos');
// V1 desplazamiento del check-in
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(400);
await page.$eval('.hoja', h => { h.scrollTop = 300; });
await page.click('[data-act="entrenador.ci"][data-k="energia"][data-v="4"]'); await page.clock.runFor(400);
const top = await page.$eval('.hoja', h => h.scrollTop); R('E-CI-SCROLL', top < 100, `tras tocar Energía 4 con la hoja bajada 300 px, scrollTop = ${top}`);
await foto(page, 'E02-checkin-vuelve-arriba');
// V14 texto T8
const t8 = (await leer(page)).hoja.match(/lleva \d+ semanas? con dolor[^.]*/); R('E-T8-SEMANA', !!t8 && /1 semana/.test(t8[0]), `lesión creada hoy: «${t8 && t8[0]}»`);
// V11 tocar fuera de la confirmación de dolor ≥ 7
await page.$eval('[data-cambio="entrenador.ciDolor"]', el => { el.value = 8; el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.clock.runFor(400);
await page.mouse.click(180, 40); await page.clock.runFor(400);
R('E-CONFIRMAR-FUERA', !(await page.$('.hoja')), `tras tocar fuera de «¿Hoy de verdad 7 o más?» queda abierta alguna hoja: ${!!(await page.$('.hoja'))}`);
await foto(page, 'E03-confirmacion-fuera');
// V9 atrás con el check-in abierto
await page.click('#nav a[href="#progreso"]'); await page.clock.runFor(300); await page.click('#nav a[href="#hoy"]'); await page.clock.runFor(300);
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(300);
await page.goBack(); await page.clock.runFor(500);
R('E-ATRAS-HOJA', !!(await page.$('.hoja')) && (await leer(page)).hash === '#progreso', `atrás con el check-in abierto: hash ${(await leer(page)).hash}, hoja abierta ${!!(await page.$('.hoja'))}`);
await foto(page, 'E04-atras-hoja-encima-de-progreso');
await page.click('.hoja [data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
// V4 series 5 vs nota 3
await page.click('[data-act="sesion.modo"][data-v="lista"]').catch(() => {}); await page.clock.runFor(300);
const ip = (await ses(page))[0].ejercicios.findIndex(x => x.rol === 'principal' && x.series >= 5);
const cab = await page.$eval(`#ej-${ip} header .tenue`, e => e.innerText); const nota = await page.$eval(`#ej-${ip} .nota`, e => e.innerText).catch(() => '');
R('E-SERIES-NOTA', /^5 ×/.test(cab) && /3 ×/.test(nota), `principiante, «${(await ses(page))[0].ejercicios[ip].id}»: cabecera «${cab}» · nota «${nota.slice(0, 80)}»`);
await page.$eval(`#ej-${ip}`, e => e.scrollIntoView()); await foto(page, 'E05-cinco-series-nota-tres');
// V3 cardio en minutos con «seg»
const ic = (await ses(page))[0].ejercicios.findIndex(x => x.rol === 'cardio');
const fila = await page.$eval(`#ej-${ic} .serie`, li => li.innerText.replace(/\n/g, ' ') + ' | ph=' + li.querySelector('input').placeholder);
R('E-CARDIO-SEG', /seg/.test(fila), `${(await ses(page))[0].ejercicios[ic].reps} → fila «${fila}»`);
await page.$eval(`#ej-${ic} .serie`, e => e.scrollIntoView({ block: 'center' })); await foto(page, 'E06-cardio-8-seg');
// V2 foco del menú
const ipr = (await ses(page))[0].ejercicios.findIndex(x => x.id === 'press-pecho-maquina');
await page.click(`[data-act="sesion.menu"][data-e="${ipr}"]`); await page.clock.runFor(400);
const foco = await page.evaluate(() => document.activeElement.id); R('E-MENU-TECLADO', foco === 'm-com', `al abrir «Más opciones» el foco va a #${foco}`);
await foto(page, 'E07-menu-foco-comentario');
// V13 alternativas de nivel 2 para principiante
await page.click('.hoja [data-act="sesion.cambiar"]'); await page.clock.runFor(300);
const alts = await page.$$eval('.hoja [data-act="sesion.cambiarPor"]', bs => bs.map(x => x.dataset.id));
const niv = await page.evaluate(async ids => { const m = await import('./js/datos/ejercicios.js'); return ids.map(i => i + ':' + m.EJERCICIOS.find(e => e.id === i).niv); }, alts);
R('E-ALT-NIVEL', niv.some(x => x.endsWith(':2') || x.endsWith(':3')), `principiante, alternativas: ${niv.join(', ')}`);
await foto(page, 'E08-alternativas-nivel2');
await page.mouse.click(180, 40); await page.clock.runFor(300);
// V9b atrás con el menú abierto y «Añadir una serie»
await page.click('[data-act="sesion.menu"][data-e="0"]'); await page.clock.runFor(300);
const series0 = (await ses(page))[0].ejercicios[0].sets.length;
await page.goBack(); await page.clock.runFor(400);
await page.click('.hoja [data-act="sesion.serieMas"][data-v="1"]'); await page.clock.runFor(300);
R('E-ATRAS-MENU', (await ses(page))[0].ejercicios[0].sets.length === series0, `«Añadir una serie» tras volver atrás: series ${series0} → ${(await ses(page))[0].ejercicios[0].sets.length}, hash ${(await leer(page)).hash}`);
await page.goForward(); await page.clock.runFor(400);
// V10 doble toque en la marca de serie
await page.dblclick('[data-act="sesion.serie"][data-e="0"][data-s="0"]'); await page.clock.runFor(400);
R('E-DOBLE-TOQUE', !(await ses(page))[0].ejercicios[0].sets[0].hecha, `doble toque en la marca: hecha=${(await ses(page))[0].ejercicios[0].sets[0].hecha}, descanso=${!!(await page.$('#temporizador'))}`);
// V5 terminar con 0 series
await page.click('[data-act="sesion.terminar"]'); await page.clock.runFor(300);
const preg = (await leer(page)).hoja.split('\n')[0];
await page.click('[data-act="sesion.cerrar"]'); await page.clock.runFor(600);
const hoy = (await leer(page)).vista;
R('E-CERO-SERIES', /0 series/.test(hoy) && /1 de 2/.test(hoy), `sin ninguna serie, la hoja dice «${preg}» y Hoy: «${(hoy.match(/0 series[^\n]*/) || [''])[0]}» · «${(hoy.match(/\d de \d días del plan/) || [''])[0]}»`);
await foto(page, 'E09-cero-series-cuenta', { completa: true });
await ctx.close();
// V6 «Volver a ajustarla» deja sesiones huérfanas
({ ctx, page } = await nueva({ quien: 'virginia' }));
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(300); await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
for (let k = 0; k < 2; k++) { await page.goto(page.url().split('#')[0] + '#hoy'); await page.clock.runFor(500); await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(300); await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800); }
const ss = await ses(page); R('E-REAJUSTE-HUERFANAS', ss.length === 3, `tras preparar y «Volver a ajustarla» 2 veces hay ${ss.length} sesiones de hoy: ${ss.map(s => s.estado).join(', ')}`);
await ctx.close();
// V7 «Hoy no puedo» el domingo
({ ctx, page } = await nueva({ quien: 'virginia', reloj: '2026-11-22T10:00:00+01:00', dias: [7] }));
await page.click('[data-act="entrenador.hoyNo"]'); await page.clock.runFor(300);
await foto(page, 'E10-domingo-hoy-no-puedo');
await page.click('[data-act="entrenador.reorganizar"]'); await page.clock.runFor(400);
R('E-HOY-NO-PUEDO', /HOY TOCA/i.test((await leer(page)).vista), `domingo, tras «Hoy no puedo» → «${(await leer(page)).aviso}» y Hoy sigue «${(await leer(page)).vista.match(/HOY TOCA[^\n]*\n[^\n]*/i)[0].replace(/\n/, ' ')}»`);
await foto(page, 'E11-domingo-sigue-hoy-toca');
await ctx.close();
// V8 «Pedírsela igualmente al entrenador IA» con tensión sin controlar
{
  const c2 = await contexto(b, 'm360'); const p2 = await c2.newPage(); vigilar(p2); const api = []; p2.on('request', r => { if (r.url().includes('/api/')) api.push(r.url()); });
  await empezar(p2, 'victor', { objetivos: ['fuerza'] });
  await p2.click('[data-act="perfil.grupo"][data-v="salud"]'); await p2.check('[data-cambio="perfil.salud"][data-k="hipertension"]');
  await p2.click('#nav a[href="#hoy"]'); await p2.click('[data-act="entrenador.plan"]');
  for (const d of [1, 3, 5, 6, 7]) await p2.click(`[data-act="entrenador.psDia"][data-v="${d}"]`);
  await p2.click('[data-act="entrenador.crearPlan"][data-ia="0"]'); await esperar(500);
  await p2.click('[data-act="entrenador.prepararHoy"]'); await esperar(400);
  await p2.locator('[data-cambio="entrenador.ciIA"]').check(); await esperar(400);
  const txt = (await leer(p2)).hoja.split('\n').filter(l => /IA/.test(l)).join(' | ');
  await foto(p2, 'E12-pedirsela-a-la-ia-con-salud');
  await p2.click('[data-act="entrenador.crearHoy"]'); await esperar(1200);
  R('E-IA-FORZADA', !api.length && /Se lo pides/.test(txt), `la hoja dice «${txt}» y peticiones a /api: ${api.length}; aviso: «${(await leer(p2)).aviso}»`);
  await c2.close();
}
// V12 abducción isométrica sin «c/lado»
({ ctx, page } = await nueva({ quien: 'virginia', objetivos: ['salud'], lesion: { zona: 'cadera_lateral', dolor: 4, desde: '2026-01-10' } }));
await page.click('[data-act="entrenador.prepararHoy"]'); await page.clock.runFor(300); await page.click('[data-act="entrenador.crearHoy"]'); await page.clock.runFor(800);
const ab = (await ses(page))[0].ejercicios.find(x => x.id === 'abduccion-isometrica-pared');
R('E-CLADO', ab && !/lado/.test(ab.reps), `abducción isométrica contra la pared: «${ab && ab.series + ' × ' + ab.reps}» (catálogo: «30-45s c/lado»; pasos: «…y cambia de lado»)`);
await page.click('[data-act="sesion.modo"][data-v="lista"]').catch(() => {}); await page.clock.runFor(300);
const ia = (await ses(page))[0].ejercicios.findIndex(x => x.id === 'abduccion-isometrica-pared');
await page.click(`[data-act="sesion.cuenta"][data-e="${ia}"][data-s="0"]`); await page.clock.runFor(6000);
R('E-CLADO-CRONO', !/Lado/.test((await leer(page)).crono), `cronómetro: «${(await leer(page)).crono.replace(/\n/g, ' | ')}»`);
await foto(page, 'E13-abduccion-un-solo-lado');
await ctx.close();
await b.close();
