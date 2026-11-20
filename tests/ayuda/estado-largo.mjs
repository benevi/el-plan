// Estado realista generado por la propia app (revisión del PR 4): migración, perfil completo y 6 semanas de
// plan y sesiones hechas con el entrenador de reglas. Sirve para la ida y vuelta exportar → importar y para
// envenenar todos los textos de una copia (XSS). `est` y `ent` son los módulos de la app ya cargados.
import { fijarFecha, viejoDemo } from './comun.mjs';

export async function generarEstadoLargo(est, ent) {
  const reloj = fijarFecha('2026-09-07T09:00');
  try {
    est.cambiar(S => { S.dueño = 'victor'; est.migrarDeViejo('victor'); });
    est.cambiar(S => {
      Object.assign(S.perfil, { objetivos: ['musculo', 'perder'], lugares: ['gym', 'piscina'], usoIA: 'ahorro', acompañado: true, notas: 'Notas <b>x</b>' });
      S.perfil.lesiones.push({ id: 'abc', tipo: 'recurrente', zona: 'rodilla', dolor: 4, desde: '2026-01-02', nota: 'n', activa: true });
      S.perfil.gustos['press-pecho-maquina'] = 'gusta';
      S.ajustes.modoSesion = 'lista'; S.ajustes.codigo = 'secreto';
    });
    for (let semana = 0; semana < 6; semana++) {
      await ent.crearPlanSemana({ dias: [1, 3, 5], minutos: 60 }, { conIA: false });
      for (let d = 0; d < 3; d++) {
        const { sesion } = await ent.crearSesionHoy({ lugar: 'gym', minutos: 60, energia: 3, dolorHoy: { rodilla: 2 } });
        est.cambiar(S => {
          const s = S.sesiones[sesion.id];
          s.estado = 'hecha'; s.empezada = new Date().toISOString(); s.terminada = new Date(Date.now() + 3600e3).toISOString();
          s.ejercicios.forEach((x, i) => { x.sets.forEach(z => { z.hecha = true; z.valor = '10'; z.kg = z.kg ?? 20; }); if (i === 0) { x.comentario = 'duro'; x.gusto = 'gusta'; } });
          s.calentamiento.forEach(t => { t.hecho = true; });
          s.cierre = { esfuerzo: 3, dolor: { rodilla: 3 }, comentario: 'ok' };
          S.dolor.push({ fecha: s.fecha, zona: 'rodilla', dolor: 3, momento: 'despues', sesion: s.id });
        });
        reloj.avanzar(2 * 864e5);
      }
      est.cambiar(S => { S.medidas.push({ fecha: est.hoyISO(), peso: 80 - semana * 0.3, cintura: 90 }); });
      reloj.avanzar(864e5);
    }
    est.cambiar(S => { S.perfil.nivelCambios = [{ fecha: new Date().toISOString(), de: 1, a: 2, motivo: 'm' }]; S.perfil.nivel = 2; if (S.plan) S.plan.cambios = [{ fecha: new Date().toISOString(), texto: 'reorganizado' }]; });
  } finally { reloj.restaurar(); }
}
export { viejoDemo };
