// Pasa los iconos SVG de cada dirección a PNG (192, 512 y maskable 512) con Chromium.
// Uso: node prototipos/identidad/herramientas/iconos.mjs
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar, lanzarChromium } from './servidor.mjs';

const AQUI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { srv, url } = await arrancar();
const nav = await lanzarChromium();
const pag = await nav.newPage();
const CARPETAS = ['logos-2/paralelo', 'logos-2/ondas', 'logos-2/arco', 'logos-2/orbita', 'logos-2/escalon', 'logos-2/trenza', 'tiza', 'carril', 'hierro', 'carril-2', 'logos/giro', 'logos/marea', 'logos/trazo', 'logos/duo', 'logos/nivel'];
const solo = process.argv.slice(2);
for (const dir of CARPETAS.filter(c => !solo.length || solo.includes(c))) {
  for (const [svg, png, lado] of [['icono.svg', 'icono-192.png', 192], ['icono.svg', 'icono-512.png', 512], ['icono-maskable.svg', 'icono-maskable-512.png', 512]]) {
    await pag.setViewportSize({ width: lado, height: lado });
    await pag.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${lado}px;height:${lado}px}</style><img src="${url}/prototipos/identidad/${dir}/${svg}">`);
    await pag.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    const destino = path.join(AQUI, dir, png);
    await pag.screenshot({ path: destino, omitBackground: true, clip: { x: 0, y: 0, width: lado, height: lado } });
    const kb = (await stat(destino)).size / 1024;
    console.log(`${dir}/${png}: ${kb.toFixed(1)} KB${kb > 50 ? '  ¡SUPERA 50 KB!' : ''}`);
  }
}
await nav.close(); srv.close();
