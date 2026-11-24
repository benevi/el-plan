globalThis.crypto ??= (await import('node:crypto')).webcrypto;
const { calidadFrase } = await import('/home/user/wt/auditoria/js/nucleo/copia.js');
for (const f of ['victor virginia', 'virginia2026!', 'mi perro toby', 'te quiero mucho', 'pipos fitness', 'contraseña123', 'barcelona 1985', 'vicvir1990abc']) console.log(JSON.stringify(f), calidadFrase(f).ok);
