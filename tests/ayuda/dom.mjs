// Arnés jsdom: monta index.html como globales y carga la app real (a partir de arnes.mjs de la auditoría).
// Los módulos ES se cachean por proceso: monta la app UNA vez por archivo de prueba
// (node:test ejecuta cada archivo en su propio proceso).
//
//   const a = await montar({ ls: { pipos4: estadoBase() }, hash: 'hoy' });
//   await a.ir('perfil'); a.clic('[data-act="perfil.grupo"][data-v="datos"]');
//   a.guardado()  → lo que hay en localStorage['pipos4'], ya parseado
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { ruta, modulo } from './comun.mjs';

const setTimeoutNode = globalThis.setTimeout;
export const espera = ms => new Promise(r => setTimeoutNode(r, ms));

export async function montar({ ls = {}, hash = '', cargarApp = true, antes = null } = {}) {
  const html = fs.readFileSync(ruta('index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, '');
  const dom = new JSDOM(html, { url: 'https://pipos.test/' + (hash ? '#' + hash : ''), pretendToBeVisual: true });
  const w = dom.window;
  for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.Audio = class { constructor() { this.paused = true; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } setAttribute() {} };
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  const g = globalThis;
  g.window = w; g.document = w.document; g.localStorage = w.localStorage; g.location = w.location;
  Object.defineProperty(g, 'navigator', { value: w.navigator, configurable: true, writable: true });
  g.matchMedia = w.matchMedia; g.requestAnimationFrame = fn => setTimeout(fn, 0); g.cancelAnimationFrame = id => clearTimeout(id);
  g.addEventListener = w.addEventListener.bind(w); g.removeEventListener = w.removeEventListener.bind(w);
  g.Audio = w.Audio; g.URL = w.URL; g.Blob = w.Blob; g.innerWidth = 390; g.innerHeight = 800; g.devicePixelRatio = 2;
  g.getComputedStyle = w.getComputedStyle.bind(w); g.MediaMetadata = class {}; g.HTMLElement = w.HTMLElement;
  g.Event = w.Event; g.MouseEvent = w.MouseEvent; g.CustomEvent = w.CustomEvent;
  // Temporizadores de la app (descansos, avisos, animaciones): se apuntan para pararlos al cerrar,
  // si no el proceso de la prueba no termina.
  const timeouts = new Set(), intervalos = new Set();
  const stReal = globalThis.setTimeout, siReal = globalThis.setInterval;
  g.setTimeout = (fn, ms, ...r) => { const id = stReal(() => { timeouts.delete(id); fn(...r); }, ms); timeouts.add(id); return id; };
  g.setInterval = (fn, ms, ...r) => { const id = siReal(fn, ms, ...r); intervalos.add(id); return id; };
  w.setTimeout = g.setTimeout; w.setInterval = g.setInterval; w.clearTimeout = g.clearTimeout; w.clearInterval = g.clearInterval;
  if (antes) await antes(w);

  // Errores que la app escribe en consola (p. ej. «No se pudo guardar»).
  const errores = [];
  const ceReal = console.error;
  console.error = (...x) => { errores.push(x.map(v => (v && v.message) || String(v)).join(' ')); };

  if (cargarApp) await import(modulo('js/main.js'));
  const estado = await import(modulo('js/nucleo/estado.js'));
  const doc = w.document;
  const clic = sel => {
    const el = typeof sel === 'string' ? doc.querySelector(sel) : sel;
    if (!el) throw new Error('No existe ' + sel);
    el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  };
  const ir = async h => { w.location.hash = h; await espera(20); };
  const ocultar = async (oculto = true) => {
    Object.defineProperty(doc, 'hidden', { get: () => oculto, configurable: true });
    doc.dispatchEvent(new w.Event('visibilitychange'));
    await espera(5);
  };
  const vista = () => doc.querySelector('#vista');
  const pantallaRota = () => /Algo ha fallado/.test(vista().textContent);
  const cerrar = () => {
    console.error = ceReal;
    timeouts.forEach(id => clearTimeout(id)); intervalos.forEach(id => clearInterval(id));
    g.setTimeout = stReal; g.setInterval = siReal;
    try { w.close(); } catch { /* nada */ }
  };
  return {
    dom, w, doc, estado, espera, clic, ir, ocultar, vista, pantallaRota, errores, cerrar,
    guardado: () => JSON.parse(w.localStorage.getItem('pipos4') || 'null'),
  };
}
