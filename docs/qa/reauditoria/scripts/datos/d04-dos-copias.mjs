// Cargar dos copias seguidas: lo que había antes de la primera (los datos de verdad del móvil) se pierde.
// pipos4-antes-de-importar guarda un solo estado y la segunda carga lo pisa con la primera copia.
import { est, cargarCon, hecha } from '/home/user/wt/auditoria/tests/ayuda/node.mjs';
import { estadoBase } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
cargarCon({ pipos4: estadoBase() });
const ses = n => Object.values(est.estado().sesiones).filter(s => s.estado === 'hecha').length;
// Copias antiguas: 2 y 5 sesiones.
const copiaDe = n => { cargarCon({ pipos4: estadoBase() }); for (let i = 0; i < n; i++) est.cambiar(S => { hecha(S, 30 + i, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); }); est.guardarYa(); return est.exportar(); };
const vieja2 = copiaDe(2), vieja5 = copiaDe(5);
// El móvil de verdad: 9 sesiones (la última, de ayer, aún no está en ninguna copia).
cargarCon({ pipos4: estadoBase() });
for (let i = 0; i < 9; i++) est.cambiar(S => { hecha(S, i + 1, [{ id: 'remo-sentado-polea', sets: [[30, 10]] }]); });
est.guardarYa();
console.log('móvil:', ses(), 'sesiones');
est.importar(vieja2); console.log('carga la copia de 2 →', ses());
est.importar(vieja5); console.log('carga la copia de 5 →', ses());
est.deshacerImportar(); console.log('«Volver a ellos» →', ses(), 'sesiones (las 9 del móvil ya no están en ningún sitio)');
est.deshacerImportar(); console.log('«Volver a ellos» otra vez →', ses());
