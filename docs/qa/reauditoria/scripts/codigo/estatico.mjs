import fs from 'node:fs'; import path from 'node:path';
const R = process.argv[2];
const arch = [];
const recorre = d => { for (const f of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) recorre(p); else if (/\.(js|mjs)$/.test(f.name)) arch.push(p); } };
recorre('js'); recorre('api');
const src = Object.fromEntries(arch.map(a => [a, fs.readFileSync(path.join(R, a), 'utf8')]));
// grafo
const grafo = {};
for (const a of arch) {
  grafo[a] = [];
  for (const m of src[a].matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
    const r = path.normalize(path.join(path.dirname(a), m[1] || m[2])); grafo[a].push(r);
  }
}
// ciclos
const ciclos = new Set(); const pila = []; const enPila = new Set(); const visto = new Set();
const dfs = n => { visto.add(n); pila.push(n); enPila.add(n);
  for (const v of grafo[n] || []) { if (enPila.has(v)) { const c = pila.slice(pila.indexOf(v)); ciclos.add(c.join(' -> ') + ' -> ' + v); } else if (!visto.has(v)) dfs(v); }
  pila.pop(); enPila.delete(n); };
for (const a of arch) if (!visto.has(a)) dfs(a);
console.log('CICLOS:', ciclos.size); for (const c of ciclos) console.log('  ', c);
// exportados sin uso
const todosTests = [];
const recT = d => { for (const f of fs.readdirSync(path.join(R, d), { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) recT(p); else if (/\.(js|mjs)$/.test(f.name)) todosTests.push(fs.readFileSync(path.join(R, p), 'utf8')); } };
recT('tests'); recT('scripts');
const tt = todosTests.join('\n') + fs.readFileSync(path.join(R,'sw.js'),'utf8');
console.log('EXPORTADOS SIN USO EN LA APP (entre paréntesis: ¿solo en pruebas?)');
for (const a of arch) {
  const nombres = [...src[a].matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  for (const m of src[a].matchAll(/export\s*\{([^}]+)\}/g)) for (const p of m[1].split(',')) { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (n) nombres.push(n); }
  for (const n of nombres) {
    const re = new RegExp('\\b' + n.replace('$','\\$') + '\\b');
    const usos = arch.filter(b => b !== a && re.test(src[b]));
    const interno = (src[a].match(new RegExp('\\b' + n + '\\b', 'g')) || []).length > 1;
    if (!usos.length) console.log(`  ${a}: ${n}${interno ? ' [usado dentro]' : ''}${re.test(tt) ? ' (en pruebas)' : ' (NADIE)'}`);
  }
}
