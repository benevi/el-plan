// Copias en la nube de extremo a extremo (PR 4b) en un Chromium de verdad (WebCrypto, CompressionStream,
// IndexedDB): /api/copia lo atiende la función real api/copia.js con un Blob simulado en memoria.
// Terminar una sesión → copia subida al Blob → navegador limpio → restaurar con la frase → mismos datos.
import { test, expect } from '@playwright/test';
import { BlobSimulado, porLaFuncion } from '../ayuda/nube.mjs';
import { ponerAlmacen, reiniciarRitmo } from '../../api/copia.js';
import { estadoBase, sesionDemo } from '../ayuda/comun.mjs';

const FRASE = 'tortuga lámpara otoño ciento';
const blob = new BlobSimulado();

test.beforeAll(() => { process.env.APP_CODE = 'secreto'; ponerAlmacen(blob); reiniciarRitmo(); });
test.afterAll(() => ponerAlmacen(null));

// Contexto con /api/copia → función real (el service worker no atiende /api/*, así que la ruta lo ve).
async function contexto(browser, datos) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/api/copia', async route => {
    const q = route.request();
    const r = await porLaFuncion({ method: q.method(), headers: q.headers(), body: q.postDataBuffer() });
    await route.fulfill({ status: r.status, headers: r.headers, body: r.body });
  });
  if (datos) await ctx.addInitScript(d => { if (!localStorage.getItem('pipos4')) localStorage.setItem('pipos4', d); }, JSON.stringify(datos));
  return ctx;
}
const copiasDe = persona => [...blob.blobs.keys()].filter(k => k.startsWith(`copias/${persona}/`)).sort();

test('terminar sesión → copia en la nube → navegador limpio → restaurar con la frase → mismos datos', async ({ browser }) => {
  const datos = estadoBase({ sesiones: { s1: sesionDemo('s1', { estado: 'en_curso', empezada: new Date().toISOString() }) } });
  datos.ajustes.codigo = 'secreto';
  datos.perfil.notas = 'Rodilla derecha: menisco operado en 2024';

  // ── Móvil 1: activar, terminar la sesión ──
  const a = await contexto(browser, datos);
  const p = await a.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto('/#perfil');
  await p.click('[data-act="perfil.grupo"][data-v="copias"]');
  await p.click('[data-act="nube.activar"]');
  await expect(p.locator('.hoja')).toContainText('gestor de contraseñas');
  await p.fill('#n-f1', FRASE); await p.fill('#n-f2', FRASE);
  await p.click('[data-act="nube.confirmarActivar"]');
  await expect.poll(() => copiasDe('victor').length, { timeout: 15000 }).toBe(1); // la primera, al activar
  await expect(p.locator('.ultima-nube')).toContainText('Última copia en la nube: hoy');
  // La clave quedó en IndexedDB como CryptoKey no exportable; la frase no está en ningún almacén.
  const guardado = await p.evaluate(() => new Promise(res => {
    const r = indexedDB.open('pipos-copia', 1);
    r.onsuccess = () => { const q = r.result.transaction('clave').objectStore('clave').get('victor'); q.onsuccess = () => res({ tipo: q.result.clave.constructor.name, exportable: q.result.clave.extractable, ls: JSON.stringify(localStorage) }); };
  }));
  expect(guardado.tipo).toBe('CryptoKey');
  expect(guardado.exportable).toBe(false);
  expect(guardado.ls).not.toContain(FRASE);

  await p.goto('/#sesion/s1');
  await p.locator('[data-act="sesion.serie"]').first().click();
  const terminar = p.locator('[data-act="sesion.terminar"]:visible').first();
  await terminar.evaluate(e => e.scrollIntoView({ block: 'center' }));
  await terminar.click();
  await p.locator('[data-act="sesion.cerrar"]:visible').first().click();
  await expect.poll(() => copiasDe('victor').length, { timeout: 15000 }).toBe(2);
  expect(copiasDe('victor')[1]).toMatch(/_s1_u\d{4}-\d{2}-\d{2}\.bin$/);
  // En el Blob solo hay bytes cifrados.
  const subido = blob.blobs.get(copiasDe('victor')[1]).bytes.toString('latin1');
  expect(subido.startsWith('PIPC')).toBe(true);
  expect(subido).not.toContain('menisco');
  await expect.poll(() => p.evaluate(() => JSON.parse(localStorage.getItem('pipos4')).sesiones.s1.estado)).toBe('hecha');
  const antes = await p.evaluate(() => JSON.parse(localStorage.getItem('pipos4')));
  expect(errores).toEqual([]);
  await a.close();

  // ── Móvil 2: navegador limpio ──
  const b = await contexto(browser, null);
  const q = await b.newPage();
  q.on('pageerror', e => errores.push(e.message));
  await q.goto('/');
  await q.click('[data-act="bienvenida.elegir"][data-v="victor"]');
  await expect(q.locator('#nav a')).toHaveCount(4);
  await q.goto('/#perfil');
  await q.click('[data-act="perfil.grupo"][data-v="copias"]');
  await q.click('[data-act="nube.recuperar"]');
  await q.fill('#n-codigo', 'secreto');
  // Frase incorrecta: mensaje claro y nada cambia.
  await expect.poll(() => q.evaluate(() => !!localStorage.getItem('pipos4'))).toBe(true); // ya guardado el dueño
  const vacio = await q.evaluate(() => localStorage.getItem('pipos4'));
  await q.fill('#n-frase', 'esta no es la frase');
  await q.click('[data-act="nube.buscar"]');
  await expect(q.locator('#n-lista')).toContainText('la frase no es la correcta');
  expect(await q.evaluate(() => localStorage.getItem('pipos4'))).toBe(vacio);
  // Frase buena: lista con fecha y sesiones; se restaura la más nueva.
  await q.fill('#n-frase', FRASE);
  await q.click('[data-act="nube.buscar"]');
  await expect(q.locator('#n-lista li')).toHaveCount(2);
  await expect(q.locator('#n-lista li').first()).toContainText('1 sesiones');
  await q.locator('[data-act="nube.restaurarCon"]').first().click();
  await q.click('.hoja [data-r="1"]'); // «Restaurar»
  await expect(q.locator('#aviso')).toContainText('Copia de la nube cargada');
  const despues = await q.evaluate(() => JSON.parse(localStorage.getItem('pipos4')));
  expect(despues.dueño).toBe('victor');
  expect(despues.perfil).toEqual(antes.perfil);
  expect(despues.dolor).toEqual(antes.dolor);
  for (const k of ['estado', 'terminada', 'cierre', 'fecha']) expect(despues.sesiones.s1[k]).toEqual(antes.sesiones.s1[k]);
  expect(despues.sesiones.s1.ejercicios.map(e => e.sets)).toEqual(antes.sesiones.s1.ejercicios.map(e => e.sets));
  await expect.poll(() => q.evaluate(() => JSON.parse(localStorage.getItem('pipos4')).ajustes.codigo)).toBe('secreto');
  // Lo de antes queda apartado (pipos4-antes-de-importar) y este móvil ya copia solo con la clave recordada.
  expect(await q.evaluate(() => !!localStorage.getItem('pipos4-antes-de-importar'))).toBe(true);
  await q.goto('/#perfil');
  await q.click('[data-act="perfil.grupo"][data-v="copias"]');
  await expect(q.locator('[data-act="nube.lista"]')).toBeVisible();
  expect(errores).toEqual([]);
  await b.close();
});

test('sin almacén Blob: la app lo dice y sigue funcionando', async ({ browser }) => {
  ponerAlmacen(null);
  delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_STORE_ID;
  try {
    const datos = estadoBase(); datos.ajustes.codigo = 'secreto';
    const a = await contexto(browser, datos);
    const p = await a.newPage();
    const errores = []; p.on('pageerror', e => errores.push(e.message));
    await p.goto('/#perfil');
    await p.click('[data-act="perfil.grupo"][data-v="copias"]');
    await p.click('[data-act="nube.activar"]');
    await p.fill('#n-f1', FRASE); await p.fill('#n-f2', FRASE);
    await p.click('[data-act="nube.confirmarActivar"]');
    await expect(p.locator('.aviso-nube')).toContainText('aún no están activadas', { timeout: 15000 });
    await p.goto('/#hoy');
    await expect(p.locator('.aviso-nube')).toContainText('aún no están activadas');
    await expect(p.locator('#nav a')).toHaveCount(4);
    expect(errores).toEqual([]);
    await a.close();
  } finally { ponerAlmacen(blob); }
});
