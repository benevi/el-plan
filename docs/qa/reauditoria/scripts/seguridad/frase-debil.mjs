// S3: calidadFrase() acepta frases triviales; con el código, quien baje la copia la abre probando un diccionario.
globalThis.crypto ??= (await import('node:crypto')).webcrypto;
const C = await import('/home/user/wt/auditoria/js/nucleo/copia.js');
const frase = 'victor virginia';
console.log('calidadFrase acepta', JSON.stringify(frase), C.calidadFrase(frase).ok);
const sal = C.nuevaSal();
const clave = await C.derivarClave(frase, sal);
const bytes = await C.cifrar(C.empaquetar({ persona: 'victor', creada: new Date().toISOString(), sesiones: 40, ultima: '2026-11-20' }, JSON.stringify({ perfil: { lesiones: [{ zona: 'lumbar', nota: 'hernia L5' }] } })), { clave, sal });
// atacante: solo tiene los bytes (bajados con el código) y un diccionario
const dicc = ['pipos fitness', 'el plan', 'virginia victor', 'victor virginia', 'te quiero'];
const t0 = Date.now();
for (const g of dicc) {
  try { const r = await C.abrirArchivo(bytes, (s, it) => C.derivarClave(g, s, it)); console.log('ABIERTA con', JSON.stringify(g), 'en', Date.now() - t0, 'ms:', r.estado); break; } catch { /* sigue */ }
}
