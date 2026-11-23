// PR 12 · Espera, cancelación y errores en un Chromium de verdad. /api/entrenador lo atiende la función real
// (api/entrenador.js, en vivo) con una IA simulada: lenta, colgada, que se cae a mitad, o con el código malo.
// Gasto en la API real: cero.
import { test, expect } from '@playwright/test';
import { crearServidor } from './servidor.mjs';
import handler from '../../api/entrenador.js';
import { ponerClienteIA, Anthropic } from '../../api/_comun.js';
import { estadoBase } from '../ayuda/comun.mjs';
import { clienteEnVivo, mensaje, espera, delta } from '../api/_simulado.mjs';

const PUERTO = 8774;
const BASE = `http://127.0.0.1:${PUERTO}`;
const srv = crearServidor();

// Lo mínimo de los ayudantes de Vercel (req.body, res.status, res.json) para la función real.
srv.control.api = (req, res) => {
  let b = ''; req.on('data', d => { b += d; });
  req.on('end', () => {
    try { req.body = JSON.parse(b); } catch (e) { req.body = b; }
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    if (modo === 'caido') { // acepta, empieza a contestar y se corta la conexión
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"t":"inicio"}\n\n');
      setTimeout(() => res.socket.destroy(), 300);
      return;
    }
    handler(req, res);
  });
};

// Sesión válida para el perfil de estadoBase (ganar músculo, principiante, gimnasio).
const T = (n, d = '5 min') => ({ id: '', nombre: n, detalle: '', duracion: d });
const E = id => ({ id, rol: 'principal', series: 3, reps: '8-12', descanso: 90, kg: 0, nota: 'Nota suficientemente larga para no ser genérica, con 30 kg.' });
const BUENA = { nombre: 'Cuerpo completo de la IA', foco: 'x', cambios: [], explicacion: ['Hoy cuerpo completo con la IA.'], calentamiento: [T('Bici'), T('Movilidad')], ejercicios: [E('press-pecho-maquina'), E('jalon-pecho'), E('prensa-piernas')], vueltaCalma: [T('Estirar pecho', '1 min'), T('Estiramiento de cuádriceps', '1 min')] };

let modo = 'lento', cliente = null;
// IA lenta: piensa ~1,5 s y escribe la sesión en trozos durante ~2 s.
const lenta = () => clienteEnVivo(async (emitir, señal) => {
  emitir({ type: 'message_start', message: {} });
  emitir({ type: 'content_block_start', index: 0, content_block: { type: 'thinking' } });
  await espera(1500);
  emitir({ type: 'content_block_start', index: 1, content_block: { type: 'text' } });
  const texto = JSON.stringify(BUENA);
  for (let i = 0; i < texto.length && !señal.aborted; i += 40) { emitir(delta(texto.slice(i, i + 40))); await espera(2000 * 40 / texto.length); }
  return mensaje(BUENA);
}, Anthropic.APIUserAbortError);
// IA colgada: no termina nunca (hasta que la aborten).
const colgada = () => clienteEnVivo(async (emitir, señal) => { emitir({ type: 'message_start', message: {} }); while (!señal.aborted) await espera(50); }, Anthropic.APIUserAbortError);

test.beforeAll(async () => { process.env.APP_CODE = 'secreto'; process.env.ANTHROPIC_API_KEY = 'clave-de-prueba'; await srv.escuchar(PUERTO); });
test.afterAll(async () => { ponerClienteIA(null); await srv.cerrar(); });

async function abrir(browser, { codigo = 'secreto' } = {}) {
  const ctx = await browser.newContext({ ...test.info().project.use, baseURL: BASE });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|i\.ytimg\.com/, r => r.fulfill({ status: 200, body: '' }));
  const datos = estadoBase(); datos.ajustes.codigo = codigo;
  await ctx.addInitScript(d => { if (!localStorage.getItem('pipos4')) localStorage.setItem('pipos4', d); }, JSON.stringify(datos));
  const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto('/#hoy');
  await expect(p.locator('#vista')).not.toBeEmpty();
  return { ctx, p, errores };
}
// Check-in como desde Hoy (sin plan esta semana, Hoy enseña «Montar mi semana»): se abre con su acción.
async function checkin(p, peticion = '') {
  // Se crea y se pulsa en el mismo paso: un repintado de Hoy podría quitar el botón entre medias.
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'entrenador.prepararHoy'; document.querySelector('#vista').append(b); b.click(); });
  await expect(p.locator('.hoja.checkin')).toBeVisible();
  // Check-in de un toque (M21): la petición está en el completo, tras «Algo ha cambiado».
  if (peticion) { await p.click('[data-act="entrenador.ciCompleto"]'); await p.fill('#ci-peticion', peticion); }
  await p.click('[data-act="entrenador.crearHoy"]');
}
const sesionGuardada = p => p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pipos4')).sesiones));

test('servidor lento: progreso visible, tocar fuera no cierra y llega la sesión de la IA', async ({ browser }) => {
  modo = 'lento'; cliente = lenta(); ponerClienteIA(cliente);
  const { ctx, p, errores } = await abrir(browser);
  await checkin(p);
  const hoja = p.locator('.hoja.espera');
  await expect(hoja).toBeVisible();
  await expect(p.locator('#espera-fase')).toContainText('Pensando tu sesión');
  await p.mouse.click(10, 10); // fuera de la hoja
  await expect(hoja).toBeVisible();
  await expect(p.locator('#espera-fase')).toContainText(/Escribiendo tu sesión · \d ejercicio/, { timeout: 10000 });
  await expect(p).toHaveURL(/#sesion\//, { timeout: 15000 });
  await expect(hoja).toHaveCount(0);
  await expect(p.locator('.cab-sesion h1')).toHaveText('Cuerpo completo de la IA');
  await expect(p.locator('.nota-fallo')).toHaveCount(0);
  await expect.poll(async () => (await sesionGuardada(p)).map(x => x.fuente)).toEqual(['ia']);
  expect(errores).toEqual([]);
  await ctx.close();
});

test('cancelar: la hace la app al momento, guarda la petición y la respuesta tardía no pisa nada', async ({ browser }) => {
  modo = 'lento'; cliente = colgada(); ponerClienteIA(cliente);
  const { ctx, p, errores } = await abrir(browser);
  await checkin(p, 'hoy la prensa está ocupada');
  await expect(p.locator('.hoja.espera')).toBeVisible();
  // Una segunda petición no sale mientras hay una en curso.
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'entrenador.crearHoy'; document.body.append(b); b.click(); });
  await expect(p.locator('#aviso')).toContainText('Ya estoy preparando una');
  expect(cliente.llamadas.length).toBe(1);
  const t0 = Date.now();
  await p.click('[data-act="entrenador.cancelarIA"]');
  await expect(p).toHaveURL(/#sesion\//);
  expect(Date.now() - t0).toBeLessThan(3000);
  const nota = p.locator('.nota-fallo');
  await expect(nota).toContainText('La ha hecho la app porque cancelaste la espera.');
  await expect(nota).toContainText('No he podido atender lo que pediste: «hoy la prensa está ocupada».');
  await expect(nota.locator('[data-act="entrenador.reintentarIA"]')).toBeVisible();
  // El servidor se ha enterado y ha dejado de pedir a la IA.
  await expect.poll(() => cliente.llamadas[0].opciones.signal.aborted).toBe(true);
  await p.waitForTimeout(500);
  await expect.poll(async () => (await sesionGuardada(p)).length).toBe(1);
  const s = await sesionGuardada(p);
  expect(s[0].fuente).not.toBe('ia');
  // En Hoy la nota sigue a la vista.
  await p.goto('/#hoy');
  await expect(p.locator('.tarjeta.destacada .nota-fallo')).toContainText('cancelaste la espera');
  expect(errores).toEqual([]);
  await ctx.close();
});

test('servidor caído a mitad: nota clara y «Reintentar con IA» funciona de verdad', async ({ browser }) => {
  modo = 'caido';
  const { ctx, p, errores } = await abrir(browser);
  await checkin(p, 'algo de core al final');
  await expect(p).toHaveURL(/#sesion\//, { timeout: 10000 });
  const nota = p.locator('.nota-fallo');
  await expect(nota).toContainText('La ha hecho la app porque la conexión se cortó antes de terminar.');
  await expect(nota).not.toContainText(/TypeError|network|undefined/i);
  await expect.poll(async () => (await sesionGuardada(p)).length).toBe(1);
  const vieja = (await sesionGuardada(p))[0].id;
  // Vuelve el servidor: reintentar sustituye la sesión de la app por la de la IA.
  modo = 'lento'; cliente = lenta(); ponerClienteIA(cliente);
  await nota.locator('[data-act="entrenador.reintentarIA"]').click();
  await expect(p.locator('.hoja.espera')).toBeVisible();
  await expect(p.locator('.cab-sesion h1')).toHaveText('Cuerpo completo de la IA', { timeout: 15000 });
  await expect(p.locator('.nota-fallo')).toHaveCount(0);
  await expect.poll(async () => (await sesionGuardada(p)).map(x => x.fuente)).toEqual(['ia']);
  expect((await sesionGuardada(p))[0].id).not.toBe(vieja);
  // La petición escrita viajó en el reintento.
  const enviado = JSON.parse(cliente.llamadas[0].params.messages[0].content.split('<datos>\n')[1].split('\n</datos>')[0]);
  expect(enviado.checkin.peticion).toBe('algo de core al final');
  expect(errores).toEqual([]);
  await ctx.close();
});

test('401: lo dice en claro y lleva a Perfil › Ajustes para cambiar el código', async ({ browser }) => {
  modo = 'lento'; cliente = lenta(); ponerClienteIA(cliente);
  const { ctx, p, errores } = await abrir(browser, { codigo: 'otro' });
  await checkin(p);
  await expect(p).toHaveURL(/#sesion\//, { timeout: 10000 });
  const nota = p.locator('.nota-fallo');
  await expect(nota).toContainText('La ha hecho la app porque el código de acceso no es correcto.');
  expect(cliente.llamadas.length).toBe(0); // la puerta no deja pasar a la IA
  await nota.locator('[data-act="perfil.irAjustes"]').click();
  await expect(p).toHaveURL(/#perfil$/);
  await expect(p.locator('[data-cambio="perfil.codigo"]')).toBeVisible();
  expect(errores).toEqual([]);
  await ctx.close();
});
