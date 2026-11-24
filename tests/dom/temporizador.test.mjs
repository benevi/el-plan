// COD-4 (re-auditoría): «−15» en el descanso nunca lo da por acabado de golpe (tope: queda al menos 1 s) y el
// audio programado se rehace con lo que queda.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { estadoBase, sesionDemo, modulo } from '../ayuda/comun.mjs';
import { montar } from '../ayuda/dom.mjs';

const fuentes = [];
const a = await montar({
  ls: {
    pipos4: estadoBase({ sesiones: { s1: sesionDemo() } }),
    // Descanso de 60 s del que ya han pasado 50: quedan 10
    'pipos-temporizador': { tipo: 'descanso', etiqueta: 'Serie 2 de 3', meta: { sesion: 's1', siguiente: 'A por la serie 2' }, fases: [{ f: 'descanso', dur: 60 }], i: 0, inicio: Date.now() - 50000, pausa: null, tiempos: [], avisos: {}, confirmar: null },
  },
  hash: 'sesion/s1',
  antes: w => { w.URL.createObjectURL = b => { fuentes.push(b); return 'blob:' + fuentes.length; }; },
});
await import(modulo('js/areas/sesion/temporizador.js'));
after(() => a.cerrar());

test('«−15» con 10 s por delante deja 1 s (no salta la alarma al momento) y el audio se rehace', async () => {
  const menos = await a.esperar(() => a.doc.querySelector('#temporizador [data-t="menos"]'), { que: 'la barra del descanso' });
  const antes = fuentes.length;
  a.clic(menos); await a.tic();
  const barra = a.doc.querySelector('#temporizador');
  assert.ok(barra.classList.contains('descanso'), 'la barra sigue');
  assert.ok(!barra.classList.contains('alarma'), 'la alarma ha saltado al quitar 15 s');
  assert.equal(barra.querySelector('.descanso-reloj').textContent, '0:01');
  assert.equal(fuentes.length, antes + 1, 'no se ha rehecho el audio programado');
  // Y al segundo, la alarma
  await a.esperar(() => a.doc.querySelector('#temporizador.alarma'), { max: 2500, que: 'la alarma' });
});
