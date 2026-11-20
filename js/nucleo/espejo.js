// Espejo del estado en IndexedDB (decisión D1 del plan v2).
// localStorage ('pipos4') sigue siendo el almacén principal; aquí se guarda una segunda copia del mismo texto
// tras cada guardado, para poder rescatar los datos si localStorage se rompe, se vacía o se llena.
//
// Una base pequeña ('pipos-espejo'), un almacén ('estado') y un único registro ('pipos4'):
//   { txt: JSON del estado, rev: revisión, fecha: ISO }
// Nada de esto bloquea la interfaz: las escrituras se encolan y solo se escribe la última pendiente.
// Si el navegador no tiene IndexedDB (o falla), todo es un «no hace nada» silencioso.

const NOMBRE = 'pipos-espejo';
const TABLA = 'estado';
const ID = 'pipos4';

let bd = null; // Promise<IDBDatabase|null>

function abrir() {
  if (bd) return bd;
  bd = new Promise(res => {
    let idb;
    try { idb = globalThis.indexedDB || null; } catch { idb = null; }
    if (!idb) { res(null); return; }
    let r;
    try { r = idb.open(NOMBRE, 1); } catch { res(null); return; }
    r.onupgradeneeded = () => { try { r.result.createObjectStore(TABLA); } catch { /* ya existe */ } };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => { db.close(); bd = null; };
      res(db);
    };
    r.onerror = () => { bd = null; res(null); };
    r.onblocked = () => { bd = null; res(null); };
  });
  return bd;
}

// Lee el registro del espejo, o null si no hay (o no hay IndexedDB).
export async function leer() {
  const db = await abrir();
  if (!db) return null;
  return new Promise(res => {
    try {
      const q = db.transaction(TABLA, 'readonly').objectStore(TABLA).get(ID);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    } catch { res(null); }
  });
}

// Escribe el registro salvo que el espejo ya tenga una revisión más nueva (otra pestaña se adelantó).
async function poner(reg) {
  const db = await abrir();
  if (!db) return false;
  return new Promise(res => {
    try {
      const t = db.transaction(TABLA, 'readwrite');
      const tabla = t.objectStore(TABLA);
      const q = tabla.get(ID);
      q.onsuccess = () => {
        const hay = q.result;
        if (hay && +hay.rev > +reg.rev) return; // no pisar una revisión más nueva
        tabla.put(reg, ID);
      };
      t.oncomplete = () => res(true);
      t.onerror = t.onabort = () => res(false);
    } catch { res(false); }
  });
}

let pendiente = null;
let enCurso = null;

// Encola una escritura y vuelve enseguida. Devuelve una promesa que se cumple al vaciar la cola
// (útil en pruebas; la app no la espera).
export function escribir(reg) {
  pendiente = reg;
  if (!enCurso) {
    enCurso = (async () => {
      while (pendiente) { const r = pendiente; pendiente = null; try { await poner(r); } catch { /* nada */ } }
    })().finally(() => { enCurso = null; });
  }
  return enCurso;
}
