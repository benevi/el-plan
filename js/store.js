// Estado y guardado. Todo vive en este móvil: localStorage (datos) e IndexedDB (copia + fotos).
(function () {
  const KEY = 'elplan2';
  const DB_NAME = 'ElPlan2DB';

  const vacio = () => ({
    v: 2,
    user: 'him',
    workouts: {},
    painLog: [],
    injuries: { him: [], her: [] },
    bodyLog: { him: [], her: [] },
    bodyProfile: { him: { sex: 'm' }, her: { sex: 'f' } },
    routines: { him: [], her: [] },
    settings: { autoRest: true, apiUrl: '/api/rutina', code: '' },
    session: null,
    lastExport: null,
  });

  let S = vacio();
  let db = null;

  function lsGet(k) { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }

  function completar(s) {
    const base = vacio();
    const out = Object.assign(base, s || {});
    ['injuries', 'bodyLog', 'routines'].forEach(k => { out[k] = Object.assign({ him: [], her: [] }, out[k] || {}); });
    out.bodyProfile = Object.assign({ him: { sex: 'm' }, her: { sex: 'f' } }, out.bodyProfile || {});
    out.settings = Object.assign(vacio().settings, out.settings || {});
    if (!Array.isArray(out.painLog)) out.painLog = [];
    if (!out.workouts || typeof out.workouts !== 'object') out.workouts = {};
    return out;
  }

  // Si la versión anterior está en el mismo dominio, se pasa sola la primera vez.
  function migrarAnterior() {
    const w = lsGet('workouts');
    if (!w && !lsGet('bodyLog') && !lsGet('injuries')) return false;
    S.workouts = w || {};
    S.painLog = lsGet('painLog') || [];
    S.user = localStorage.getItem('currentUser') || 'him';
    if (lsGet('injuries')) S.injuries = lsGet('injuries');
    if (lsGet('bodyLog')) S.bodyLog = lsGet('bodyLog');
    if (lsGet('bodyProfile')) S.bodyProfile = lsGet('bodyProfile');
    S = completar(S);
    return true;
  }

  function lesionPorDefecto() {
    if (!S.injuries.her.some(i => i.zoneKey === 'cadera_lateral')) {
      S.injuries.her.push({ id: 'troc_virginia', zoneKey: 'cadera_lateral', severity: 2, note: 'Trocanteritis lateral de cadera. Dolor crónico en la cara externa.', active: true, since: '2025-01-01' });
    }
  }

  function abrirDB() {
    return new Promise(res => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => { const d = e.target.result; d.createObjectStore('estado'); d.createObjectStore('fotos', { keyPath: 'id' }); };
        req.onsuccess = e => { db = e.target.result; res(true); };
        req.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function idbReq(fn) { return new Promise(res => { try { if (!db) return res(undefined); const r = fn(); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); } }); }

  async function cargar() {
    await abrirDB();
    const local = lsGet(KEY);
    if (local) S = completar(local);
    else {
      const snap = await idbReq(() => tx('estado', 'readonly').get('snapshot'));
      if (snap) S = completar(snap);
      else migrarAnterior();
    }
    lesionPorDefecto();
    guardar();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    return S;
  }

  let t = null;
  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    clearTimeout(t);
    t = setTimeout(() => idbReq(() => tx('estado', 'readwrite').put(JSON.parse(JSON.stringify(S)), 'snapshot')), 400);
  }

  // ── Fotos ──
  const fotos = {
    put: rec => idbReq(() => tx('fotos', 'readwrite').put(rec)),
    all: () => idbReq(() => tx('fotos', 'readonly').getAll()).then(r => r || []),
    del: id => idbReq(() => tx('fotos', 'readwrite').delete(id)),
  };

  // ── Copia de seguridad (compatible con las copias de la versión anterior) ──
  function exportar() {
    const data = Object.assign({ version: 3, exported: new Date().toISOString(), currentUser: S.user }, JSON.parse(JSON.stringify(S)));
    delete data.session;
    S.lastExport = new Date().toISOString(); guardar();
    return data;
  }

  function importar(d) {
    if (!d || (!d.workouts && !d.painLog && !d.bodyLog)) throw new Error('Archivo no válido');
    const n = { sesiones: 0, dolor: 0, cuerpo: 0, lesiones: 0, rutinas: 0 };
    Object.entries(d.workouts || {}).forEach(([k, w]) => { if (!S.workouts[k]) n.sesiones++; S.workouts[k] = w; });
    const fechas = new Set(S.painLog.map(p => p.date + (p.user || '')));
    (d.painLog || []).forEach(p => { if (!fechas.has(p.date + (p.user || ''))) { S.painLog.push(p); n.dolor++; } });
    S.painLog.sort((a, b) => new Date(a.date) - new Date(b.date));
    ['him', 'her'].forEach(u => {
      const bl = (d.bodyLog || {})[u] || [];
      const dias = new Set(S.bodyLog[u].map(e => (e.date || '').slice(0, 10)));
      bl.forEach(e => { if (!dias.has((e.date || '').slice(0, 10))) { S.bodyLog[u].push(e); n.cuerpo++; } });
      S.bodyLog[u].sort((a, b) => new Date(a.date) - new Date(b.date));
      const inj = (d.injuries || {})[u] || [];
      inj.forEach(i => { if (!S.injuries[u].some(x => x.id === i.id)) { S.injuries[u].push(i); n.lesiones++; } });
      const rt = (d.routines || {})[u] || [];
      rt.forEach(r => { if (!S.routines[u].some(x => x.id === r.id)) { S.routines[u].push(r); n.rutinas++; } });
      if (d.bodyProfile && d.bodyProfile[u]) S.bodyProfile[u] = Object.assign({}, S.bodyProfile[u], d.bodyProfile[u]);
    });
    // Fotos (la herramienta pasar-datos.html las incluye desde la versión anterior)
    if (Array.isArray(d.fotos) && d.fotos.length) n.fotosP = fotos.all().then(ya => { const ids = new Set(ya.map(f => f.id)); const nuevas = d.fotos.filter(f => f && f.id && f.data && !ids.has(f.id)); return Promise.all(nuevas.map(f => fotos.put(f))).then(() => nuevas.length); });
    if (d.settings) S.settings = Object.assign(S.settings, { autoRest: d.settings.autoRest, apiUrl: d.settings.apiUrl || S.settings.apiUrl });
    guardar();
    return n;
  }

  function borrarTodo() {
    S = vacio(); lesionPorDefecto(); guardar();
    idbReq(() => tx('fotos', 'readwrite').clear());
  }

  window.Store = { cargar, guardar, exportar, importar, borrarTodo, fotos, get S() { return S; } };
})();
