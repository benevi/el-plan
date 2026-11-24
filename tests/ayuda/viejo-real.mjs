// elplan2 realista (revisión del PR 4): 6 entrenos de cada uno que acaban pasada la medianoche en Madrid,
// lesión con `since` ISO, bodyLog, painLog y perfiles por defecto. tests/datos/v1-victor.json es lo que dejó
// en pipos4 la migración con fallos (antes del PR 4) al elegir a Víctor con este elplan2.
export function viejoReal() {
  const w = (key, user, date, done, ex) => ({ key, user, day: 'A', nombre: 'Torso', lugar: 'gym', date, completed: true, completedAt: done, exercises: ex,
    checkin: { energia: 3, dolor: { rodilla: 2 } }, feedback: { esfuerzo: 3, nota: 'ok' } });
  const workouts = {};
  for (let i = 0; i < 6; i++) {
    workouts['h' + i] = w('h' + i, 'him', `2026-10-0${i + 1}T21:30:00.000Z`, `2026-10-0${i + 1}T22:45:00.000Z`, [{ exId: 'press-pecho-maquina', name: 'Press de pecho en máquina BH (M090/M060)', sets: [{ weight: '40', reps: '10', done: true }] }]);
    workouts['m' + i] = w('m' + i, 'her', `2026-10-0${i + 1}T17:00:00.000Z`, `2026-10-0${i + 1}T18:00:00.000Z`, []);
  }
  return {
    v: 2, user: 'him', workouts,
    painLog: [{ date: '2026-10-01T22:45:01.000Z', user: 'him', antes: { rodilla: 2 }, despues: { rodilla: 3 } }],
    injuries: { him: [{ id: 'inj_1', zoneKey: 'rodilla', severity: 2, note: 'Menisco', active: true, since: '2026-09-30T23:30:00.000Z' }], her: [{ id: 'troc_virginia', zoneKey: 'cadera_lateral', severity: 2, note: 'Trocanteritis', active: true, since: '2025-01-01' }] },
    bodyLog: { him: [{ date: '2026-10-01T22:30:00.000Z', weight: 82, waist: 90 }, { date: '2026-10-05T07:00:00.000Z', weight: 81.5 }], her: [{ date: '2026-10-01T07:00:00.000Z', weight: 60 }] },
    bodyProfile: { him: { sex: 'm', height: 180 }, her: { sex: 'f', height: 165 } },
  };
}
