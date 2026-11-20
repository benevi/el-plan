// Mide el contraste (WCAG 2.x, nivel AA) de todos los pares de texto/fondo y de controles de cada dirección,
// comprueba que los colores de Víctor y Virginia se distinguen también con daltonismo y vigila el peso de fuentes e iconos.
// Lee los tokens de cada estilo.css (bloques :root y [data-persona="virginia"]), así que mide lo que se pinta.
// Uso: node prototipos/identidad/contraste.mjs [--escribir]
//   --escribir  vuelca las tablas en docs/diseno/identidad.md, entre <!-- contraste:inicio --> y <!-- contraste:fin -->.
// Sale con código 1 si algún par no llega.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contraste, simular, distancia } from './color.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(AQUI, '../../docs/diseno/identidad.md');
const DIRS = { tiza: 'Tiza', carril: 'Carril', hierro: 'Hierro', 'carril-2': 'Carril 2' };

function tokens(css, selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) return {};
  const bloque = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries([...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(m => [m[1], m[2].toUpperCase()]));
}

// [primer plano, fondo, mínimo, uso]
const TEXTO = 4.5, CONTROL = 3, ALARMA = 7;
const PARES = [
  ['texto', 'fondo', TEXTO, 'Texto principal'], ['texto', 'sup', TEXTO, 'Texto principal en panel'], ['texto', 'sup-2', TEXTO, 'Texto en control y descanso'],
  ['texto-2', 'fondo', TEXTO, 'Texto secundario'], ['texto-2', 'sup', TEXTO, 'Texto secundario en panel'], ['texto-2', 'sup-2', TEXTO, 'Texto secundario en descanso'],
  ['texto-3', 'fondo', TEXTO, 'Texto terciario y pestaña inactiva'], ['texto-3', 'sup', TEXTO, 'Texto terciario en panel'], ['texto-3', 'sup-2', TEXTO, 'Texto terciario en control'],
  ['ok', 'fondo', TEXTO, 'Estado «Hecha»'], ['ok', 'sup', TEXTO, 'Estado «Hecha» en panel'],
  ['acento', 'fondo', TEXTO, 'Color de la persona como texto o cifra'], ['acento', 'sup', TEXTO, 'Color de la persona en panel'], ['acento', 'sup-2', TEXTO, 'Color de la persona en descanso'],
  ['sobre-acento', 'acento', ALARMA, 'Texto del botón principal y de la alarma (R08: ≥ 7:1)'],
  ['borde-control', 'fondo', CONTROL, 'Borde de control'], ['borde-control', 'sup', CONTROL, 'Borde de control en panel'], ['borde-control', 'sup-2', CONTROL, 'Borde de control en descanso'],
  ['acento', 'fondo', CONTROL, 'Botón principal (relleno) sobre el fondo'],
  // Solo si la dirección tiene fondo de «agua» (Carril 2: el final de sesión)
  ['texto', 'agua', TEXTO, 'Texto del final sobre el agua'], ['texto-2', 'agua', TEXTO, 'Texto secundario del final sobre el agua'],
  ['acento', 'agua', CONTROL, 'Sello y botón del final sobre el agua'], ['borde-control', 'agua', CONTROL, 'Filete del final sobre el agua'],
  ['texto', 'acento', 0, null], // marcador: no se mide (el texto claro nunca va sobre el acento)
].filter(p => p[3]);

const fmt = n => n.toFixed(2).replace('.', ',');
let fallos = 0;
let md = '';
const resumen = [];

for (const [dir, nombre] of Object.entries(DIRS)) {
  const css = await readFile(path.join(AQUI, dir, 'estilo.css'), 'utf8');
  const base = tokens(css, ':root');
  const personas = { 'Víctor': base, 'Virginia': { ...base, ...tokens(css, '[data-persona="virginia"]') } };
  let filas = ''; let min = Infinity; let n = 0; let mal = 0;
  for (const [fg, bg, req, uso] of PARES) {
    const usaAcento = fg === 'acento' || bg === 'acento';
    if (!base[fg] && fg !== 'acento' || !base[bg] && bg !== 'acento') continue; // par que esta dirección no usa
    for (const [quien, t] of Object.entries(personas)) {
      if (!usaAcento && quien === 'Virginia') continue; // igual para los dos
      const c = contraste(t[fg], t[bg]);
      const ok = c >= req; n++; if (!ok) { mal++; fallos++; }
      min = Math.min(min, c);
      filas += `| ${uso}${usaAcento ? ` (${quien})` : ''} | \`${t[fg]}\` sobre \`${t[bg]}\` | ${fmt(c)}:1 | ${req === CONTROL ? '3:1' : req === ALARMA ? '7:1' : '4,5:1'} | ${ok ? 'Sí' : '**NO**'} |\n`;
    }
  }
  // Daltonismo: distancia perceptual (ΔE OKLab) entre los dos colores de persona, normal y simulada.
  const [a, b] = [personas['Víctor'].acento, personas['Virginia'].acento];
  let cvd = '';
  let peor = Infinity;
  for (const tipo of ['normal', 'protanopia', 'deuteranopia', 'tritanopia']) {
    const [x, y] = tipo === 'normal' ? [a, b] : [simular(a, tipo), simular(b, tipo)];
    const d = distancia(x, y); peor = Math.min(peor, d);
    const cf = Math.min(contraste(x, personas['Víctor'].fondo), contraste(y, personas['Víctor'].fondo));
    const ok = d >= 0.1 && cf >= CONTROL; if (!ok) fallos++;
    cvd += `| ${tipo === 'normal' ? 'Visión normal' : tipo[0].toUpperCase() + tipo.slice(1)} | \`${x}\` / \`${y}\` | ${fmt(d)} | ${fmt(cf)}:1 | ${ok ? 'Sí' : '**NO**'} |\n`;
  }
  // Fuentes e iconos
  const fuentes = (await readdir(path.join(AQUI, dir, 'fuentes'))).filter(f => f.endsWith('.woff2'));
  let bytes = 0; for (const f of fuentes) bytes += (await stat(path.join(AQUI, dir, 'fuentes', f))).size;
  const kb = bytes / 1024; if (kb > 150) fallos++;
  const pngs = (await readdir(path.join(AQUI, dir))).filter(f => f.endsWith('.png'));
  let pngTxt = []; for (const f of pngs) { const k = (await stat(path.join(AQUI, dir, f))).size / 1024; if (k > 50) fallos++; pngTxt.push(`${f} ${k.toFixed(1).replace('.', ',')} KB`); }

  resumen.push(`| ${nombre} | ${n - mal} de ${n} | ${fmt(min)}:1 | ${fmt(peor)} | ${kb.toFixed(1).replace('.', ',')} KB | ${pngTxt.map(t => t.split(' ').slice(1).join(' ')).join(', ')} |`);
  md += `\n#### ${nombre}\n\n| Uso | Par | Contraste | Mínimo | Cumple |\n|---|---|---|---|---|\n${filas}\n` +
    `Colores de persona con daltonismo (simulación de Machado et al., 2009; ΔE OKLab ≥ 0,10 se distinguen bien) y su contraste mínimo sobre el fondo:\n\n` +
    `| Visión | Víctor / Virginia | ΔE | Contraste con el fondo | Cumple |\n|---|---|---|---|---|\n${cvd}\n` +
    `Fuentes: ${fuentes.join(', ')} (${kb.toFixed(1).replace('.', ',')} KB de 150). Iconos PNG: ${pngTxt.join(', ')}.\n`;
}

// Iconos de las propuestas de logo
let logosTxt = '';
try {
  for (const id of (await readdir(path.join(AQUI, 'logos'), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name)) {
    const pngs = (await readdir(path.join(AQUI, 'logos', id))).filter(f => f.endsWith('.png'));
    const t = [];
    for (const f of pngs) { const k = (await stat(path.join(AQUI, 'logos', id, f))).size / 1024; if (k > 50) fallos++; t.push(k.toFixed(1).replace('.', ',') + ' KB'); }
    logosTxt += `| ${id} | ${t.join(', ')} |\n`;
  }
} catch { /* sin carpeta de logos */ }
if (logosTxt) md += `\n#### Propuestas de logo (PNG 192, 512 y maskable 512; máximo 50 KB)\n\n| Propuesta | PNG |\n|---|---|\n${logosTxt}`;

const tabla = `| Dirección | Pares que cumplen | Contraste mínimo medido | ΔE mínimo entre personas | Fuentes | PNG (192, 512, maskable) |\n|---|---|---|---|---|---|\n${resumen.join('\n')}\n`;
const salida = `<!-- contraste:inicio -->\n_Generado con \`node prototipos/identidad/contraste.mjs --escribir\`. No editar a mano._\n\n${tabla}${md}<!-- contraste:fin -->`;
console.log(tabla);
console.log(fallos ? `${fallos} comprobaciones NO cumplen.` : 'Todas las comprobaciones cumplen.');

if (process.argv.includes('--escribir')) {
  const doc = await readFile(DOC, 'utf8');
  const nuevo = doc.replace(/<!-- contraste:inicio -->[\s\S]*<!-- contraste:fin -->/, salida);
  if (nuevo === doc && !doc.includes(salida)) throw new Error('No encuentro los marcadores de contraste en identidad.md');
  await writeFile(DOC, nuevo);
  console.log('Tablas escritas en docs/diseno/identidad.md');
}
process.exitCode = fallos ? 1 : 0;
