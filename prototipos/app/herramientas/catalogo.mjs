// Extrae del catálogo real de la app (rama pipos-v2, en /home/user/el-plan) los ejercicios que usan los prototipos,
// con sus fichas tal cual, para que el prototipo enseñe lo que la app ya tiene. Uso:
//   node prototipos/app/herramientas/catalogo.mjs /ruta/a/el-plan
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = path.resolve(process.argv[2] || '/home/user/el-plan');
const { EJERCICIOS } = await import(pathToFileURL(path.join(app, 'js/reglas/catalogo.js')));
const { MUSCULOS, MATERIAL, LUGARES, NIVELES } = await import(pathToFileURL(path.join(app, 'js/datos/constantes.js')));
const IDS = ['press-banca-mancuernas', 'press-banca-barra', 'flexiones', 'flexiones-inclinadas', 'fondos-asistidos-maquina', 'remo-sentado-polea', 'remo-maquina',
  'remo-mancuerna', 'plancha', 'plancha-lateral', 'bird-dog', 'puente-gluteo', 'puente-una-pierna', 'sentadilla-goblet', 'zancadas', 'bici-estatica', 'crol',
  'patada-crol-tabla', 'crol-pull-buoy', 'remo-ergometro', 'remo-banda', 'puente-banda-rodillas'];
const extra = EJERCICIOS.filter(e => /press militar|jal[oó]n|prensa|curl de b[ií]ceps|elevaciones laterales|peso muerto rumano|aperturas/i.test(e.n)).slice(0, 8).map(e => e.id);
const lista = [...IDS, ...extra].map(id => EJERCICIOS.find(e => e.id === id)).filter(Boolean)
  .map(e => ({ id: e.id, n: e.n, m: e.m, s: e.s || [], mat: e.mat, l: e.l, niv: e.niv, t: e.t, p: e.p || [], e: e.e || [], c: e.c || '' }));
const txt = `// GENERADO por herramientas/catalogo.mjs desde js/reglas/catalogo.js de pipos-v2. No editar a mano.\n` +
  `export const EJERCICIOS = ${JSON.stringify(lista, null, 1)};\n` +
  `export const MUSCULOS = ${JSON.stringify(MUSCULOS)};\nexport const MATERIAL = ${JSON.stringify(MATERIAL)};\n` +
  `export const LUGARES = ${JSON.stringify(LUGARES)};\nexport const NIVELES = ${JSON.stringify(NIVELES)};\n` +
  `export const ex = id => EJERCICIOS.find(e => e.id === id);\n`;
await writeFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'catalogo.js'), txt);
console.log(lista.length, 'ejercicios:', lista.map(e => e.id).join(', '));
