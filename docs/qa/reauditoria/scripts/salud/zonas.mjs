const R='/home/user/wt/auditoria/';
const { ZONAS } = await import(R+'js/datos/lesiones.js');
const { EJERCICIOS } = await import(R+'js/datos/ejercicios.js');
const byN = Object.fromEntries(EJERCICIOS.map(e=>[e.n,e]));
for (const [z,Z] of Object.entries(ZONAS)) {
  console.log(z, '| estirar:', JSON.stringify(Z.estirar), '| tareas.estirar:', JSON.stringify(Z.tareas.estirar));
  for (const n of Z.estirar) { const e = byN[n]; console.log('   ', n, e ? `id=${e.id} l=${e.l} r=${JSON.stringify(e.r||{})}` : '(texto)'); }
}
