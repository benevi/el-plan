// pipos4 vacío (p. ej. borrado) y espejo con 40 sesiones que tarda más de 1,5 s en contestar (arranque en frío):
// no se ofrece el rescate, la persona elige dueño en la bienvenida y el guardado pisa la única copia interna.
import { est, cargarCon, hecha } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
import { estadoBase } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
cargarCon({ pipos4: estadoBase() });
for (let i = 0; i < 40; i++) est.cambiar(S => { hecha(S, i + 1, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); });
let reg = { txt: JSON.stringify(est.estado()), rev: 57, fecha: new Date().toISOString() };
const espejo = {
  leer: () => new Promise(r => setTimeout(() => r(reg), 2000)),
  escribir: r => { if (!(reg && reg.rev > r.rev)) reg = r; },
  apartar: () => true,
};
est.usarEspejo(espejo);
cargarCon({}); // localStorage vacío
const r = await est.revisarEspejo(); // tope de 1,5 s, como en main.js
console.log('rescate ofrecido:', r);
est.cambiar(S => { S.dueño = 'victor'; }, 'dueño'); est.guardarYa(); // bienvenida → Víctor
await new Promise(res => setTimeout(res, 700));
console.log('espejo ahora: rev', reg.rev, '· sesiones', Object.keys(JSON.parse(reg.txt).sesiones).length);
// La persona sigue: rellena su perfil (siguiente guardado, ya conocida la revisión del espejo).
est.cambiar(S => { S.perfil.objetivos = ['salud']; }, 'perfil'); est.guardarYa();
await new Promise(res => setTimeout(res, 50));
console.log('tras el siguiente cambio: espejo rev', reg.rev, '· sesiones', Object.keys(JSON.parse(reg.txt).sesiones).length, '· ¿se ofrece algo al recargar?', await (async () => { est.cargar(); return est.revisarEspejo(); })());
