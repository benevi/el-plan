const { EJERCICIOS } = await import('/home/user/wt/auditoria/js/datos/ejercicios.js');
console.log(EJERCICIOS.length);
for (const e of EJERCICIOS) console.log(`## ${e.id} [${e.m}|${e.l}|${e.mat}|n${e.niv}|${e.t}|d=${JSON.stringify(e.d)}|r=${JSON.stringify(e.r||{})}${e.rehab?'|rehab='+JSON.stringify(e.rehab):''}]\nP: ${(e.p||[]).join(' / ')}\nE: ${(e.e||[]).join(' / ')}${e.c?'\nC: '+e.c:''}`);
