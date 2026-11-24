// Casos de referencia de la IA contra el endpoint de verdad (PR 11, T8 del plan; docs/criterio.md § 19).
// Manda los 20 casos de tests/ia/casos.mjs a /api/entrenador, aplica el juez de tests/ia/juez.mjs y escribe un
// informe en markdown (y las respuestas en JSON, para la rúbrica humana) con aprobados, tiempos, tokens y coste.
//
//   URL_IA=https://<vista-previa>.vercel.app APP_CODE=… node scripts/casos-ia.mjs [opciones]
//
// Variables de entorno:
//   URL_IA          la vista previa (o la URL completa de /api/entrenador). Obligatoria.
//   APP_CODE        el código de acceso de la app. Obligatoria. No se escribe en el informe.
//   VERCEL_BYPASS   opcional: el secreto de «Protection Bypass for Automation» si la vista previa está protegida.
//   URL_IA también puede ser un enlace para compartir de Vercel (?_vercel_share=…): se abre una vez y se usa su galleta.
//   CODIGO_POR_PROXY=1  sin APP_CODE: el código lo añade el proxy como «Authorization: Bearer» (nunca pasa por aquí).
// Opciones:
//   --solo CR-05,CR-22    solo esos casos
//   --comparar            el modo sesión con Opus 5.5 y Sonnet 5.5, con esfuerzo medium y low (4 configuraciones;
//                         el plan, solo con la de la app: el servidor no deja cambiarlo)
//   --modelo claude-sonnet-5-5 · --esfuerzo low   una configuración concreta para el modo sesión
//   --repetir 3           cada caso varias veces (la IA no responde siempre igual)
//   --salida informe.md   dónde escribir el informe (por defecto tests/ia/informes/informe-<fecha>.md, fuera de git)
//   --pausa 2000          milisegundos entre llamadas (por defecto 1000)
// El servidor solo hace caso a las cabeceras de pruebas con el código bueno, y solo con modelos y esfuerzos
// de una lista cerrada (api/entrenador.js). Cada llamada cuesta dinero: unos céntimos por caso.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASOS, prepararCaso, AHORA } from '../tests/ia/casos.mjs';
import { juzgar } from '../tests/ia/juez.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fetchReal = globalThis.fetch; // los casos sustituyen fetch para capturar el cuerpo: se guarda el de verdad
const PRECIOS = { // dólares por millón de tokens (entrada, salida, lectura de caché)
  'claude-opus-5-5': [4, 20, 0.2], 'claude-sonnet-5-5': [2, 10, 0.1], 'claude-opus-5': [5, 25, 0.5], 'claude-opus-4-8': [5, 25, 0.5], 'claude-sonnet-5': [2, 10, 0.2],
};
const POR_DEFECTO = { modelo: 'claude-opus-5-5', esfuerzo: null }; // null: el que elige la app (medium, o low con plan de hoy)

function opciones(argv) {
  const o = { solo: null, comparar: false, modelo: null, esfuerzo: null, repetir: 1, salida: null, pausa: 1000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === '--solo') o.solo = v().split(',').map(s => s.trim().toUpperCase());
    else if (a === '--comparar') o.comparar = true;
    else if (a === '--modelo') o.modelo = v();
    else if (a === '--esfuerzo') o.esfuerzo = v();
    else if (a === '--repetir') o.repetir = Math.max(1, +v() || 1);
    else if (a === '--salida') o.salida = v();
    else if (a === '--pausa') o.pausa = Math.max(0, +v() || 0);
    else if (a === '--ayuda' || a === '-h') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); process.exit(0); }
    else { console.error(`Opción desconocida: ${a} (usa --ayuda)`); process.exit(2); }
  }
  return o;
}

const espera = ms => new Promise(r => setTimeout(r, ms));
const dolares = n => '$' + n.toFixed(n < 0.1 ? 4 : 3);
const ms = n => (n == null ? '—' : n >= 1000 ? (n / 1000).toFixed(1) + ' s' : Math.round(n) + ' ms');
const celda = t => String(t == null ? '' : t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function coste(uso) {
  if (!uso) return 0;
  const partes = Array.isArray(uso.iteraciones) && uso.iteraciones.length ? uso.iteraciones : [{ modelo: uso.modelo, entrada: uso.entrada, salida: uso.salida }];
  const total = partes.reduce((t, p) => { const [e, s] = PRECIOS[p.modelo] || PRECIOS['claude-opus-5-5']; return t + ((p.entrada || 0) * e + (p.salida || 0) * s) / 1e6; }, 0);
  const [e, , c] = PRECIOS[uso.modelo] || PRECIOS['claude-opus-5-5'];
  // La caché escrita (5 min) cuesta un 25 % más que la entrada normal; la leída, el precio de lectura.
  return total + (uso.cacheLeida || 0) * c / 1e6 + (uso.cacheEscrita || 0) * e * 1.25 / 1e6;
}

let galleta = '';
async function llamar(url, codigo, cuerpo, config) {
  const cabeceras = { 'content-type': 'application/json', 'x-pruebas': '1' };
  if (codigo) cabeceras['x-app-code'] = codigo; // sin APP_CODE, el código lo pone el proxy (Authorization: Bearer)
  if (galleta) cabeceras.cookie = galleta;
  if (config.modelo) cabeceras['x-pruebas-modelo'] = config.modelo;
  if (config.esfuerzo) cabeceras['x-pruebas-esfuerzo'] = config.esfuerzo;
  if (process.env.VERCEL_BYPASS) cabeceras['x-vercel-protection-bypass'] = process.env.VERCEL_BYPASS;
  const t0 = performance.now();
  let r, datos = null;
  try {
    r = await fetchReal(url, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(300000) });
    try { datos = await r.json(); } catch (e) { /* sin JSON */ }
  } catch (e) { return { ok: false, error: `sin respuesta (${e.name})`, ms: performance.now() - t0 }; }
  const total = performance.now() - t0;
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}${datos && datos.error ? ': ' + datos.error : ''}`, ms: total };
  return { ok: true, datos, ms: total };
}

// Un caso con una configuración: { id, titulo, modo, config, sinIA, error, juez, uso, ms, coste, respuesta }.
async function ejecutar(caso, config, url, codigo) {
  const prep = await prepararCaso(caso);
  const base = { id: caso.id, titulo: caso.titulo, modo: caso.modo, config: nombreConfig(caso.modo === 'plan' ? POR_DEFECTO : config), esperado: caso.esperado || '' };
  if (caso.espera === 'sinIA') {
    const ok = prep.llamadas === 0;
    return { ...base, sinIA: true, pasaValidador: ok, aprueba: ok, error: ok ? '' : 'la app llamó a la IA y no debía' };
  }
  if (!prep.cuerpo) return { ...base, pasaValidador: false, aprueba: false, error: 'la app no llamó a la IA y debía' };
  const r = await llamar(url, codigo, prep.cuerpo, caso.modo === 'plan' ? {} : config);
  if (!r.ok) return { ...base, pasaValidador: false, aprueba: false, error: r.error, ms: r.ms };
  const respuesta = caso.modo === 'plan' ? r.datos.plan : r.datos.sesion;
  if (!respuesta) return { ...base, pasaValidador: false, aprueba: false, error: 'respuesta sin ' + (caso.modo === 'plan' ? 'plan' : 'sesion'), ms: r.ms };
  const j = juzgar(prep, respuesta);
  const uso = r.datos.uso || null;
  return { ...base, juez: j, pasaValidador: j.validador.pasa, aprueba: j.aprueba, uso, ms: r.ms, msServidor: uso && uso.ms, coste: coste(uso), respuesta };
}

const nombreConfig = c => `${(c.modelo || POR_DEFECTO.modelo).replace('claude-', '')} · ${c.esfuerzo || 'el de la app'}`;

function resumen(filas) {
  const n = filas.length, conIA = filas.filter(f => !f.sinIA && f.ms != null);
  const tiempos = conIA.map(f => f.ms).sort((a, b) => a - b);
  const pct = k => (n ? Math.round(k / n * 100) : 0);
  const val = filas.filter(f => f.pasaValidador).length, rub = filas.filter(f => f.aprueba).length;
  return {
    n, val, rub, pctVal: pct(val), pctRub: pct(rub), t8: n > 0 && val === n && rub / n >= 0.9,
    mediana: tiempos.length ? tiempos[Math.floor(tiempos.length / 2)] : null, max: tiempos.length ? tiempos[tiempos.length - 1] : null,
    entrada: conIA.reduce((t, f) => t + ((f.uso && f.uso.entrada) || 0), 0), salida: conIA.reduce((t, f) => t + ((f.uso && f.uso.salida) || 0), 0),
    coste: conIA.reduce((t, f) => t + (f.coste || 0), 0), llamadas: conIA.length,
    fallbacks: conIA.filter(f => f.uso && f.uso.fallback).length,
  };
}

function informe(filas, { url, configs, opciones: o, inicio }) {
  const L = [];
  L.push('# Casos de referencia de la IA (T8)', '');
  L.push(`- Fecha: ${new Date(inicio).toISOString().slice(0, 16).replace('T', ' ')} UTC · reloj de los casos fijado en ${AHORA}`);
  L.push(`- Endpoint: ${new URL(url).host}`);
  L.push(`- Casos: ${[...new Set(filas.map(f => f.id))].length} · repeticiones: ${o.repetir}`);
  L.push('- T8: el 100 % pasa el validador y al menos el 90 % aprueba la rúbrica (seguridad bien y 12 de 16 o más). Los casos sin IA (dolor ≥ 7, alarma) cuentan como aprobados si la app no llama a la IA.', '');
  L.push('## Resumen por configuración', '');
  L.push('| Configuración | Validador | Rúbrica | T8 | Mediana | Máximo | Tokens entrada | Tokens salida | Coste | Coste por llamada | Fallbacks |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of configs) {
    const r = resumen(filas.filter(f => f.config === c || (f.modo === 'plan' && c === configs[0]) || (f.sinIA && c === configs[0])));
    L.push(`| ${c} | ${r.val}/${r.n} (${r.pctVal} %) | ${r.rub}/${r.n} (${r.pctRub} %) | ${r.t8 ? 'cumple' : '**no cumple**'} | ${ms(r.mediana)} | ${ms(r.max)} | ${r.entrada} | ${r.salida} | ${dolares(r.coste)} | ${r.llamadas ? dolares(r.coste / r.llamadas) : '—'} | ${r.fallbacks} |`);
  }
  L.push('', 'Coste aproximado con los precios de lista por millón de tokens (Opus 5.5: $4 entrada, $20 salida; Sonnet 5.5: $2 y $10), con la caché leída a su precio de lectura y la escrita a 1,25 veces la entrada.', '');
  L.push('## Caso a caso', '');
  L.push('| Caso | Configuración | Resultado | Validador | Seguridad | Rúbrica | Tiempo | Tokens (entrada/salida) | Coste |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const f of filas) {
    const j = f.juez;
    const resultado = f.error ? `**error**: ${celda(f.error)}` : f.sinIA ? 'sin IA, como debe' : f.aprueba ? 'aprobado' : '**suspenso**';
    L.push(`| ${f.id} ${celda(f.titulo)} | ${celda(f.config)} | ${resultado} | ${f.sinIA ? '—' : f.pasaValidador ? 'pasa' : '**no pasa**'} | ${j ? (j.seguridadOk ? 'bien' : `**${j.seguridad.length} ${j.seguridad.length === 1 ? 'fallo' : 'fallos'}**`) : '—'} | ${j ? `${j.total}/16` : '—'} | ${ms(f.ms)} | ${f.uso ? `${f.uso.entrada}/${f.uso.salida}` : '—'} | ${f.coste ? dolares(f.coste) : '—'} |`);
  }
  const conDetalle = filas.filter(f => f.juez && (!f.aprueba || !f.pasaValidador || f.juez.avisos.length || (f.juez.validador.cambios || []).length));
  if (conDetalle.length) {
    L.push('', '## Detalle de lo que falla o corrige la app', '');
    for (const f of conDetalle) {
      const j = f.juez;
      L.push(`### ${f.id} · ${f.config}`, '');
      if (f.esperado) L.push(`Esperado (rúbrica humana): ${f.esperado}`, '');
      if (j.seguridad.length) L.push('Seguridad:', ...j.seguridad.map(t => `- ${t}`), '');
      if (j.validador.graves.length) L.push('Graves para el validador:', ...j.validador.graves.map(t => `- ${t}`), '');
      const otros = j.validador.problemas.filter(p => !j.validador.graves.includes(p));
      if (otros.length) L.push('Lo que completa la app:', ...otros.map(t => `- ${t}`), '');
      if (j.validador.cambios && j.validador.cambios.length) L.push('Cambios del validador:', ...j.validador.cambios.map(t => `- ${t}`), '');
      if (j.puntos) L.push('Rúbrica: ' + Object.entries(j.puntos).map(([k, v]) => `${k} ${v}${j.notas[k] ? ` (${j.notas[k]})` : ''}`).join(' · '), '');
      if (j.porDia) j.porDia.forEach(d => L.push(`- Día ${d.diaSemana}: ${d.total}/16 · ${Object.entries(d.puntos).map(([k, v]) => `${k} ${v}`).join(', ')}${d.validador.problemas.length ? ' · ' + d.validador.problemas.join('; ') : ''}`));
      if (j.avisos.length) L.push('Avisos:', ...j.avisos.map(t => `- ${t}`), '');
      L.push('');
    }
  }
  L.push('', 'La rúbrica automática no sustituye a la humana (notas con datos reales y explicación se miran a mano): las respuestas completas están en el JSON que acompaña a este informe.');
  return L.join('\n') + '\n';
}

async function main() {
  const o = opciones(process.argv.slice(2));
  let url = process.env.URL_IA, codigo = process.env.APP_CODE || '';
  if (!url || (!codigo && !process.env.CODIGO_POR_PROXY)) { console.error('Faltan URL_IA y APP_CODE (o CODIGO_POR_PROXY=1) en el entorno (usa --ayuda).'); process.exit(2); }
  // Enlace para compartir de Vercel (?_vercel_share=…): se abre una vez y se guarda la galleta de acceso.
  const u0 = new URL(url);
  if (u0.searchParams.has('_vercel_share')) {
    const r0 = await fetchReal(u0, { redirect: 'manual' });
    galleta = (r0.headers.getSetCookie ? r0.headers.getSetCookie() : [r0.headers.get('set-cookie') || '']).map(c => c.split(';')[0]).filter(Boolean).join('; ');
    if (!galleta) { console.error('El enlace para compartir no ha dado acceso (¿caducado?).'); process.exit(2); }
    url = u0.origin;
  }
  url = url.replace(/\/+$/, '');
  if (!/\/api\/entrenador$/.test(url)) url += '/api/entrenador';
  const casos = CASOS.filter(c => !o.solo || o.solo.includes(c.id));
  if (!casos.length) { console.error('Ningún caso con esos ids.'); process.exit(2); }
  const configs = o.comparar
    ? [{ modelo: 'claude-opus-5-5', esfuerzo: 'medium' }, { modelo: 'claude-opus-5-5', esfuerzo: 'low' }, { modelo: 'claude-sonnet-5-5', esfuerzo: 'medium' }, { modelo: 'claude-sonnet-5-5', esfuerzo: 'low' }]
    : [{ modelo: o.modelo, esfuerzo: o.esfuerzo }];
  const inicio = performance.timeOrigin + performance.now(), filas = []; // hora real: Date va con el reloj de los casos
  for (const [i, config] of configs.entries()) {
    for (const caso of casos) {
      // Lo que no depende de la configuración (plan y casos sin IA) se hace solo con la primera.
      if (i > 0 && (caso.modo === 'plan' || caso.espera === 'sinIA')) continue;
      for (let rep = 0; rep < o.repetir; rep++) {
        process.stdout.write(`${caso.id} · ${nombreConfig(caso.modo === 'plan' ? POR_DEFECTO : config)}${o.repetir > 1 ? ` · ${rep + 1}` : ''} … `);
        const f = await ejecutar(caso, config, url, codigo);
        filas.push(f);
        console.log(f.error ? `error: ${f.error}` : f.sinIA ? 'sin IA' : `${f.aprueba ? 'aprobado' : 'SUSPENSO'} · validador ${f.pasaValidador ? 'pasa' : 'NO PASA'} · ${f.juez.total}/16 · ${ms(f.ms)}`);
        if (!f.sinIA) await espera(o.pausa);
      }
    }
  }
  const nombres = configs.map(c => nombreConfig(c));
  const salida = path.resolve(o.salida || path.join(RAIZ, 'tests/ia/informes', `informe-${new Date(inicio).toISOString().slice(0, 16).replace(/[T:]/g, '-')}.md`));
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, informe(filas, { url, configs: nombres, opciones: o, inicio }));
  fs.writeFileSync(salida.replace(/\.md$/, '') + '.json', JSON.stringify(filas.map(({ juez, ...f }) => ({ ...f, juez: juez && { ...juez, porDia: undefined } })), null, 1));
  const r = resumen(filas.filter(f => f.config === nombres[0] || f.modo === 'plan' || f.sinIA));
  console.log(`\n${nombres[0]}: validador ${r.pctVal} %, rúbrica ${r.pctRub} %, T8 ${r.t8 ? 'cumple' : 'NO cumple'} · coste total ${dolares(filas.reduce((t, f) => t + (f.coste || 0), 0))}`);
  console.log(`Informe: ${salida}`);
  process.exitCode = r.t8 ? 0 : 1;
}

await main();
