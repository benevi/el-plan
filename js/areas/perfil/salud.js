// Área PERFIL · Salud (D4, C-SALUD-0 de docs/criterio.md): casillas opcionales que el entrenador respeta.
// Se guardan solo en este móvil y en tu copia privada; a la IA solo le llegan como etiquetas, nunca como texto.
// Interfaz mínima: el rediseño la cambiará.

import { acciones } from '../../nucleo/router.js';
import { cambiar } from '../../nucleo/estado.js';
import { h } from '../../nucleo/ui.js';
import { T1, CAMPOS_SALUD, MEDICACION, AVISO_VISTO_BUENO } from '../entrenador/entrenador.js';

const CON_VISTO_BUENO = ['hipertension', 'embarazo', 'posparto', 'cardiopatia', 'diabetes', 'osteoporosis', 'protesis'];
const casilla = (k, on, txt, act = 'perfil.salud') => `<label class="interruptor"><input type="checkbox" data-cambio="${act}" data-k="${h(k)}" ${on ? 'checked' : ''}><span>${h(txt)}</span></label>`;

export function grupoSalud(S) {
  const s = S.perfil.salud || {}, vb = s.vistoBueno || {};
  const activo = k => (Array.isArray(s[k]) ? s[k].length > 0 : !!s[k]);
  const vistoBueno = k => (activo(k) && CON_VISTO_BUENO.includes(k) ? `<p class="tenue">${h(AVISO_VISTO_BUENO)}</p>${casilla(k, vb[k], 'Mi médico me ha dado el visto bueno', 'perfil.saludVB')}` : '');
  const fila = (k, extra = '') => `<div class="campo col">${casilla(k, activo(k), CAMPOS_SALUD[k])}${activo(k) ? extra + vistoBueno(k) : ''}</div>`;
  const opciones = (k, ops) => `<div class="chips">${ops.map(([v, n]) => `<button class="chip ${s[k] === v ? 'on' : ''}" data-act="perfil.saludValor" data-k="${k}" data-v="${h(v)}" aria-pressed="${s[k] === v}">${h(n)}</button>`).join('')}</div>`;
  const semanas = k => `<label class="campo col"><span>Semanas</span><input type="number" inputmode="numeric" min="1" max="45" data-cambio="perfil.saludNum" data-k="${k}" value="${+s[k] || ''}"></label>`;
  return `<section class="tarjeta">
    <h2>Salud</h2>
    ${T1.map(t => `<p class="tenue">${h(t)}</p>`).join('')}
    <p class="nota aviso-nota">Es opcional. Se guarda en este móvil y en tu copia privada. Al entrenador IA solo le llegan como etiquetas (por ejemplo «tensión alta controlada»), nunca lo que escribas.</p>
    ${fila('hipertension', opciones('hipertension', [['controlada', 'Controlada'], ['sin_controlar', 'Sin controlar o no lo sé']]))}
    ${fila('embarazo', semanas('embarazo'))}
    ${fila('posparto', semanas('posparto') + casilla('cesarea', s.cesarea, 'Fue por cesárea'))}
    <div class="campo col"><span>${h(CAMPOS_SALUD.medicacion)}</span>${Object.entries(MEDICACION).map(([k, n]) => `<label class="interruptor"><input type="checkbox" data-cambio="perfil.saludMed" data-k="${k}" ${(s.medicacion || []).includes(k) ? 'checked' : ''}><span>${h(n)}</span></label>`).join('')}</div>
    ${fila('cardiopatia')}
    ${fila('diabetes', casilla('diabetesVista', s.diabetesVista, 'Problemas de vista por la diabetes') + casilla('diabetesPies', s.diabetesPies, 'Poca sensibilidad en los pies'))}
    ${fila('osteoporosis', opciones('osteoporosis', [['sin_fracturas', 'Sin fracturas'], ['con_fracturas', 'Con fracturas']]))}
    ${fila('protesis')}${fila('epilepsia')}${fila('asma')}${fila('equilibrio')}
  </section>`;
}

const conSalud = (S, f) => { S.perfil.salud = S.perfil.salud || {}; f(S.perfil.salud); };
acciones({
  'perfil.salud': el => cambiar(S => conSalud(S, s => {
    const k = el.dataset.k;
    if (!el.checked) { delete s[k]; if (s.vistoBueno) delete s.vistoBueno[k]; return; }
    s[k] = k === 'hipertension' ? 'sin_controlar' : k === 'osteoporosis' ? 'sin_fracturas' : k === 'embarazo' || k === 'posparto' ? 1 : true;
  }), 'perfil'),
  'perfil.saludVB': el => cambiar(S => conSalud(S, s => { s.vistoBueno = { ...(s.vistoBueno || {}), [el.dataset.k]: el.checked }; if (!el.checked) delete s.vistoBueno[el.dataset.k]; }), 'perfil'),
  'perfil.saludValor': el => cambiar(S => conSalud(S, s => { s[el.dataset.k] = el.dataset.v; }), 'perfil'),
  'perfil.saludNum': el => cambiar(S => conSalud(S, s => { const n = Math.round(+el.value); s[el.dataset.k] = n > 0 ? Math.min(el.dataset.k === 'posparto' ? 104 : 45, n) : 1; }), 'perfil-silencio'),
  'perfil.saludMed': el => cambiar(S => conSalud(S, s => { const m = new Set(s.medicacion || []); if (el.checked) m.add(el.dataset.k); else m.delete(el.dataset.k); s.medicacion = [...m]; }), 'perfil'),
});
