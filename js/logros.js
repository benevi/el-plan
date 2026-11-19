// Motivación: racha, XP, niveles, logros (13 individuales + 4 de pareja). Las mismas reglas que la versión original,
// y funcionan también con las sesiones importadas de ella (que guardaban warmup/cooldown y day = 'Piscina'/'Casa'/'Calle').
(function () {
  const S = () => window.Store.S;
  const sesiones = u => Object.values(S().workouts).filter(w => w.completed && w.user === u && !w.freeLog);
  const cuando = w => new Date(w.completedAt || w.date);
  const lugarDe = w => w.lugar || ({ Piscina: 'piscina', Casa: 'casa', Calle: 'calle' }[w.day]) || 'gym';
  const hecha = t => !!(t && (t.done || t.ok));

  // XP: 10 por ejercicio hecho + 5 por cada tarea de calentamiento o vuelta a la calma + 25 si la sesión está completa.
  function xpSesion(w) {
    const ej = (w.exercises || []).filter(e => e.done || (e.sets || []).length && (e.sets || []).every(s => s.done)).length;
    const ca = (w.warmup || []).filter(hecha).length, vu = (w.cooldown || []).filter(hecha).length;
    return ej * 10 + (ca + vu) * 5 + (ej && ca && vu ? 25 : 0);
  }
  const xpTotal = u => sesiones(u).reduce((a, w) => a + xpSesion(w), 0);
  const TITULOS = ['Novato', 'Constante', 'En forma', 'Fuerte', 'Atleta', 'Máquina', 'Imparable', 'Leyenda'];
  // XP acumulado para pasar del nivel n: 100·n·(n+1)/2 (100, 300, 600, 1000…)
  function nivel(xp) {
    let n = 1; while (xp >= 100 * n * (n + 1) / 2) n++;
    const ini = 100 * (n - 1) * n / 2, fin = 100 * n * (n + 1) / 2;
    return { n, dentro: xp - ini, falta: fin - xp, total: fin - ini, pct: (xp - ini) / (fin - ini), titulo: TITULOS[Math.min(n - 1, TITULOS.length - 1)] };
  }

  const diasEntreno = u => [...new Set(sesiones(u).map(w => cuando(w).toDateString()))];
  // Racha actual: días seguidos entrenando hasta hoy (o hasta ayer, si hoy aún no).
  function racha(u) {
    const dias = new Set(diasEntreno(u)); const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
    let n = 0; while (dias.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function rachaMax(u) {
    const ds = diasEntreno(u).map(x => new Date(x).getTime()).sort((a, b) => a - b);
    let max = ds.length ? 1 : 0, cur = 1;
    for (let i = 1; i < ds.length; i++) { if ((ds[i] - ds[i - 1]) / 864e5 <= 1.5) { cur++; max = Math.max(max, cur); } else cur = 1; }
    return max;
  }
  function lunes() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; }
  const estaSemana = u => sesiones(u).filter(w => cuando(w) >= lunes()).length;
  const hoyEntreno = u => sesiones(u).some(w => cuando(w).toDateString() === new Date().toDateString());
  const completas = u => sesiones(u).filter(w => (w.warmup || []).some(hecha) && (w.cooldown || []).some(hecha)).length;
  const porLugar = (u, l) => sesiones(u).filter(w => lugarDe(w) === l).length;
  const conPeso = u => sesiones(u).some(w => (w.exercises || []).some(x => (x.sets || []).some(s => parseFloat(String(s.weight || '').replace(',', '.')) > 0)));

  const LOGROS = [
    { id: 'first', icono: '🌱', nombre: 'Primer paso', desc: 'Completa tu primera sesión', ok: u => sesiones(u).length >= 1 },
    { id: 's5', icono: '💪', nombre: 'Cogiendo ritmo', desc: '5 sesiones completadas', ok: u => sesiones(u).length >= 5 },
    { id: 's15', icono: '🔥', nombre: 'Habitual', desc: '15 sesiones completadas', ok: u => sesiones(u).length >= 15 },
    { id: 's30', icono: '⭐', nombre: 'Comprometido', desc: '30 sesiones completadas', ok: u => sesiones(u).length >= 30 },
    { id: 's50', icono: '👑', nombre: 'Veterano', desc: '50 sesiones completadas', ok: u => sesiones(u).length >= 50 },
    { id: 'streak3', icono: '📅', nombre: 'Tres seguidos', desc: 'Racha de 3 días', ok: u => rachaMax(u) >= 3 },
    { id: 'streak7', icono: '🌟', nombre: 'Semana perfecta', desc: 'Racha de 7 días', ok: u => rachaMax(u) >= 7 },
    { id: 'full10', icono: '✅', nombre: 'Sin atajos', desc: '10 sesiones completas (con calentamiento y estiramientos)', ok: u => completas(u) >= 10 },
    { id: 'pr', icono: '🏆', nombre: 'Récord personal', desc: 'Apunta un peso en algún ejercicio', ok: conPeso },
    { id: 'pool5', icono: '🏊', nombre: 'Sirena', desc: '5 sesiones de piscina', ok: u => porLugar(u, 'piscina') >= 5 },
    { id: 'home5', icono: '🏠', nombre: 'En casa también', desc: '5 rutinas en casa', ok: u => porLugar(u, 'casa') >= 5 },
    { id: 'street5', icono: '🌳', nombre: 'Rey del parque', desc: '5 sesiones de calistenia', ok: u => porLugar(u, 'calle') >= 5 },
    { id: 'level5', icono: '🚀', nombre: 'Nivel 5', desc: 'Llega al nivel 5', ok: u => nivel(xpTotal(u)).n >= 5 },
  ];
  const PAREJA = [
    { id: 'c_both_today', icono: '💞', nombre: 'Hoy los dos', desc: 'Entrenáis los dos el mismo día', ok: () => hoyEntreno('him') && hoyEntreno('her') },
    { id: 'c_week', icono: '🤝', nombre: 'Equipo de la semana', desc: 'Los dos entrenáis al menos 3 veces esta semana', ok: () => estaSemana('him') >= 3 && estaSemana('her') >= 3 },
    { id: 'c_100', icono: '💪', nombre: '100 entre los dos', desc: '100 sesiones sumando a los dos', ok: () => sesiones('him').length + sesiones('her').length >= 100 },
    { id: 'c_streak', icono: '🔥', nombre: 'Racha en pareja', desc: 'Los dos habéis tenido racha de 3 días o más', ok: () => rachaMax('him') >= 3 && rachaMax('her') >= 3 },
  ];
  const conseguidos = u => LOGROS.filter(a => { try { return a.ok(u); } catch (e) { return false; } }).map(a => a.id);
  const deParejaConseguidos = () => PAREJA.filter(a => { try { return a.ok(); } catch (e) { return false; } }).map(a => a.id);

  function mensajePareja(nombres) {
    const a = hoyEntreno('him'), b = hoyEntreno('her');
    if (a && b) return '¡Los dos habéis entrenado hoy! Equipo imparable.';
    if (a) return `${nombres.him} ya entrenó hoy. ¡Anima a ${nombres.her}!`;
    if (b) return `${nombres.her} ya entrenó hoy. ¡Te toca, ${nombres.him}!`;
    return 'Hoy no ha entrenado ninguno todavía. ¿Quién empieza?';
  }

  window.G = { xpSesion, xpTotal, nivel, racha, rachaMax, estaSemana, hoyEntreno, sesiones, LOGROS, PAREJA, conseguidos, deParejaConseguidos, mensajePareja, lugarDe };
})();
