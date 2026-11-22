import { BASE } from './h.mjs';
// Elige persona y siembra una sesión de hoy (como tests/e2e/sesion.spec.mjs) con: press con kilos, plancha lateral c/lado,
// plancha por tiempo, cardio en minutos. Devuelve el id.
export async function sembrar(page, persona = 'victor', { modo = 'foco' } = {}) {
  await page.goto(BASE + '/');
  await page.click(`[data-act="bienvenida.elegir"][data-v="${persona}"]`);
  await page.waitForSelector('#nav a');
  return page.evaluate(async ([persona, modo]) => {
    const e = await import('/js/nucleo/estado.js');
    const m = await import('/js/nucleo/modelo.js');
    const ej = [['press-banca-mancuernas', 3, '8-10', 90, 22], ['plancha-lateral', 2, '20-30s c/lado', 45, null], ['plancha', 2, '30-40s', 30, null], ['bici-estatica', 1, '8 min', 0, null]];
    let id;
    e.cambiar(S => {
      S.perfil.objetivos = ['musculo']; S.perfil.usoIA = 'ahorro'; S.ajustes.modoSesion = modo;
      S.perfil.disponibilidad = { dias: 3, minutos: 60, diasSemana: [1, 3, 5] };
      if (persona === 'virginia') S.perfil.lesiones.push({ id: 'l1', tipo: 'recurrente', zona: 'cadera_lateral', dolor: 3, desde: '2025-01-01', nota: '', activa: true });
      const s = m.crearSesion({ nombre: 'Prueba de uso', lugar: 'gym', minutos: 55, fuente: 'reglas', explicacion: ['Sesión de prueba.'],
        checkin: { energia: 3, dolor: persona === 'virginia' ? { cadera_lateral: 3 } : {} },
        calentamiento: [{ nombre: 'Bici suave', duracion: '5 min' }], vuelta: [{ nombre: 'Estiramiento de pectoral', duracion: '1 min' }],
        ejercicios: ej.map(([id, series, reps, descanso, kg]) => ({ id, rol: id === 'bici-estatica' ? 'cardio' : 'principal', series, reps, descanso, kg })) });
      S.sesiones[s.id] = s; id = s.id;
    }, 'sesion');
    return id;
  }, [persona, modo]);
}
export const esconder = (page, oculto) => page.evaluate(o => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => o });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (o ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, oculto);
export const tTxt = page => page.evaluate(() => { const t = document.getElementById('temporizador'); return t ? t.innerText.replace(/\s+/g, ' ') : null; });
export const sets = (page, id, i) => page.evaluate(async ([id, i]) => (await import('/js/nucleo/estado.js')).estado().sesiones[id].ejercicios[i].sets, [id, i]);
