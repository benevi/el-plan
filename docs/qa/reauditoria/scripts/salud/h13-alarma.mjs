// H13: frases de alarma habituales que no detecta fraseAlarma (C-ALAR-4) y falsos positivos.
import { fijarFecha } from '/home/user/wt/auditoria/tests/ayuda/comun.mjs';
fijarFecha('2026-11-18T10:00');
const { ent } = await import('/home/user/wt/auditoria/tests/ayuda/node.mjs');
const deben = ['me mareé al acabar la cinta', 'dolor en el pecho al subir la escalera', 'noté falta de aire en la cinta', 'mucha falta de aire hoy', 'me faltaba el aire', 'me costaba respirar en la bici', 'sentí opresión en el pecho', 'me dolía el pecho', 'tenía el pecho oprimido', 'se me nubló la vista', 'casi me desmayo', 'me quedé sin fuerza en el brazo', 'perdí fuerza en la pierna', 'se me durmió la mano', 'tengo la pierna dormida', 'palpitaciones raras', 'el corazón me iba a mil', 'me dio un pinchazo en el pecho', 'dolor entre los omóplatos y sudor frío', 'tengo 38 de fiebre', 'estoy con gripe', 'el gemelo hinchado y caliente', 'me duele la cabeza muchísimo de golpe', 'veía doble', 'orina muy oscura', 'me hormiguea el brazo', 'calambre en el brazo izquierdo'];
const no = ['sin mareos hoy', 'press de pecho muy pesado', 'no he notado hormigueo', 'nada de náuseas', 'estiramiento de pecho genial', 'ni mareo ni nada', 'cero fiebre', 'aperturas de pecho', 'la falta de tiempo', 'me falta el aire... no, es broma: sin problemas'];
console.log('DEBERÍAN avisar y no avisan:');
deben.filter(t => !ent.fraseAlarma(t)).forEach(t => console.log('   ·', t));
console.log('NO deberían avisar y avisan:');
no.filter(t => ent.fraseAlarma(t)).forEach(t => console.log('   ·', t, '→', ent.fraseAlarma(t)));
