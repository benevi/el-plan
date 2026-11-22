// Barrido: cada pantalla y hoja, en un tamaño y persona. Zonas táctiles (48 en la sesión, 44 resto), contraste, desborde.
import { abrir, foto, BASE, pequenos, contraste, desborde } from './h.mjs';
const W = +process.argv[2] || 360, H = +process.argv[3] || 640, P = process.argv[4] || 'victor';
const { browser, page } = await abrir({ w: W, hgt: H, reducir: true });
await page.goto(BASE + '/');
await page.click(`[data-act="bienvenida.elegir"][data-v="${P}"]`);
await page.waitForSelector('#nav a');
const ids = await page.evaluate(async P => {
  const e = await import('/js/nucleo/estado.js'), m = await import('/js/nucleo/modelo.js'), ent = await import('/js/areas/entrenador/entrenador.js');
  const V = P === 'victor';
  e.cambiar(S => {
    S.perfil.objetivos = V ? ['musculo', 'salud'] : ['salud', 'perder']; S.perfil.usoIA = 'ahorro';
    S.perfil.lugares = V ? ['gym', 'casa'] : ['gym', 'piscina']; S.perfil.materialCasa = ['mancuernas', 'banda'];
    S.perfil.datos = V ? { sexo: 'h', altura: 180, nacimiento: '1985' } : { sexo: 'm', altura: 165, nacimiento: '1987' };
    S.perfil.disponibilidad = { dias: 3, minutos: 60, diasSemana: [1, 3, 5] };
    S.perfil.lesiones = V ? [] : [{ id: 'l1', tipo: 'recurrente', zona: 'lumbar', dolor: 3, desde: '2025-01-01', nota: 'Al agacharme', activa: true }];
    S.misSesiones = [{ id: 'm1', nombre: 'Abdominales y flexiones', lugar: 'gym', minutos: 30, creada: '2026-11-01T10:00:00.000Z', ejercicios: [{ id: 'crunch', rol: 'principal', series: 3, reps: '15', descanso: 45 }, { id: 'flexiones', rol: 'principal', series: 3, reps: '10', descanso: 60 }] }];
    const hace = n => { const d = new Date(); d.setDate(d.getDate() - n); return e.hoyISO(d); };
    for (let k = 3; k <= 60; k += 3) {
      const s = m.crearSesion({ fecha: hace(k), nombre: 'Cuerpo completo', lugar: 'gym', fuente: 'reglas', ejercicios: [['press-banca-mancuernas', 3, '8-10', 90, 20], ['plancha', 2, '30-40s', 30, null], ['bici-estatica', 1, '10 min', 0, null]].map(([id, series, reps, descanso, kg]) => ({ id, rol: 'principal', series, reps, descanso, kg })) });
      s.estado = 'hecha'; s.empezada = hace(k) + 'T17:00:00.000Z'; s.terminada = hace(k) + 'T17:50:00.000Z'; s.cierre = { esfuerzo: 3, dolor: {}, comentario: '' };
      s.ejercicios.forEach(x => x.sets.forEach(z => { z.hecha = true; z.kg = x.kg ? x.kg + Math.floor((60 - k) / 10) : null; z.valor = /s$/.test(x.reps) ? '35' : /min/.test(x.reps) ? '10' : '9'; }));
      S.sesiones[s.id] = s;
    }
    S.medidas = [{ fecha: hace(30), peso: V ? 82 : 63, cintura: V ? 90 : 72 }, { fecha: hace(2), peso: V ? 81 : 62.5, cintura: V ? 89 : 71 }];
  }, 'sesion');
  await ent.crearPlanSemana({ dias: [3, 5, 6], minutos: 60, lugares: ['gym'] }, { conIA: false });
  return {};
}, P);
const R = [];
async function medir(nombre, { lim = 44, sel = 'body' } = {}) {
  await page.waitForTimeout(150);
  const peq = await pequenos(page, lim, sel), con = await contraste(page), des = await desborde(page);
  R.push({ nombre, peq, con, des });
  await foto(page, `07-${P}-${W}x${H}-${nombre}`);
}
const ir = async h => { await page.evaluate(h => { location.hash = h; }, h); await page.waitForTimeout(250); };
const cerrar = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
await ir('#hoy'); await medir('hoy');
await page.click('[data-act="entrenador.plan"]'); await medir('hoja-semana', { sel: '.hoja' }); await cerrar();
await page.click('[data-act="entrenador.verDia"] >> nth=0'); await medir('hoja-dia', { sel: '.hoja' }); await cerrar();
await page.click('[data-act="entrenador.hoyNo"]'); await medir('hoja-hoyno', { sel: '.hoja' }); await cerrar();
await page.click('.accion-hoy [data-act="entrenador.prepararHoy"]'); await medir('checkin', { sel: '.hoja' });
await page.evaluate(() => { const h = document.querySelector('.hoja.checkin'); h.scrollTop = h.scrollHeight; }); await medir('checkin-abajo', { sel: '.hoja' });
await page.click('[data-act="entrenador.crearHoy"]'); await page.waitForTimeout(600);
const sid = await page.evaluate(() => location.hash.split('/')[1]);
await page.click('[data-act="sesion.ir"][data-v="1"]'); await medir('sesion-uno', { lim: 48, sel: '#vista' });
await page.click('[data-act="sesion.serie"][data-principal]'); await page.waitForTimeout(300); await medir('sesion-descanso', { lim: 48, sel: '#vista, #temporizador' });
await page.click('[data-act="sesion.menu"]'); await medir('hoja-menu', { lim: 48, sel: '.hoja' });
await page.click('.hoja [data-act="sesion.cambiar"]'); await medir('hoja-cambiar', { lim: 48, sel: '.hoja' }); await cerrar();
await page.click('#vista [data-act="sesion.algoVaMal"]'); await medir('hoja-algovamal', { lim: 48, sel: '.hoja' }); await cerrar();
await page.click('[data-act="sesion.modo"][data-v="lista"]'); await page.waitForTimeout(200); await medir('sesion-lista', { lim: 48, sel: '#vista' });
await page.click('#vista [data-act="sesion.terminar"] >> nth=0'); await medir('hoja-cierre', { lim: 48, sel: '.hoja' });
await page.click('[data-act="sesion.cerrar"]'); await page.waitForTimeout(500); await medir('final', { lim: 48, sel: '.final' });
await page.click('[data-fin-hoy]'); await page.waitForTimeout(300); await medir('hoy-hecha');
await ir('#progreso'); await medir('progreso'); await foto(page, `07-${P}-${W}x${H}-progreso-entera`, true);
await ir('#ejercicios'); await medir('ejercicios');
await page.click('#vista [data-act="ejercicios.ficha"] >> nth=0').catch(e => console.log('sin ficha', e.message.slice(0, 80)));
await medir('ficha', { sel: '.hoja' }); await cerrar();
await ir('#perfil');
for (const g of ['objetivos', 'lesiones', 'salud', 'entreno', 'datos', 'copias', 'ajustes']) { await page.click(`[data-act="perfil.grupo"][data-v="${g}"]`); await medir('perfil-' + g); }
for (const r of R) console.log(`${r.nombre}: desb=${r.des} PEQ=${JSON.stringify(r.peq)} CONTR=${JSON.stringify(r.con)}`);
console.log('ERR', page.errores);
await browser.close();
