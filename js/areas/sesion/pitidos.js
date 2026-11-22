// Pitidos del temporizador: qué suena y en qué segundo (sin DOM; lo prueba tests/pitidos.test.mjs, COD-4).
// El temporizador (temporizador.js) genera con wav() un audio con silencio y estos pitidos en su sitio y lo
// reproduce al empezar: así suena aunque la pantalla se bloquee.
// - Descanso: cuenta atrás 3-2-1 y, al acabar, tres alarmas (fin, +4 s y +8 s).
// - Ejercicio por tiempo: 5 s para colocarse (cuenta atrás y «ya»), doble pitido al llegar al mínimo, alarma al
//   máximo; si es «c/lado», el segundo lado empieza al acabar el primero, con su previa.

export const PREVIA = 5;                  // segundos para colocarse antes de un ejercicio por tiempo
export const ALARMAS_DESCANSO = [0, 4, 8]; // segundos tras el fin del descanso en que suena la alarma

export const CORTO = s => [{ t: s, f: 660, d: 0.09, v: 0.6 }];
export const ALARMA = s => [0, 0.32, 0.64].map((d, i) => ({ t: s + d, f: i === 2 ? 1320 : 880, d: 0.24, v: 1 }));
export const ARRANCA = s => [{ t: s, f: 1320, d: 0.45, v: 1 }];
export const DOBLE = s => [0, 0.25].map(d => ({ t: s + d, f: 1040, d: 0.16, v: 0.9 }));
const cuentaAtras = fin => [3, 2, 1].filter(k => fin - k > 0.05).flatMap(k => CORTO(fin - k));

// Fases de un ejercicio por tiempo. lo/hi en segundos (30-45 s → 30 y 45); lados = 2 para «c/lado».
export function fasesCuenta({ lo, hi, lados = 1 }) {
  hi = Math.max(lo, hi || lo);
  const fases = [];
  for (let l = 1; l <= lados; l++) {
    fases.push({ f: 'previa', dur: PREVIA, lado: lados > 1 ? l : 0 });
    fases.push({ f: 'trabajo', lo, hi, lado: lados > 1 ? l : 0 });
  }
  return fases;
}

// Pitidos que quedan desde ahora: fases y fase actual i, con seg segundos ya pasados en ella.
// Devuelve { p: [{ t, f, d, v }] con t en segundos desde ahora, dur: segundos que dura el audio }.
export function agenda(fases, i, seg) {
  const p = [];
  let base = -seg;
  for (let k = i; k < fases.length; k++) {
    const F = fases[k];
    if (F.f === 'previa') { p.push(...cuentaAtras(base + F.dur), ...ARRANCA(base + F.dur)); base += F.dur; }
    else if (F.f === 'descanso') {
      const fin = base + F.dur;
      p.push(...cuentaAtras(fin), ...ALARMAS_DESCANSO.flatMap(d => ALARMA(fin + d)));
      base = fin + ALARMAS_DESCANSO[ALARMAS_DESCANSO.length - 1] + 2;
    } else if (F.f === 'trabajo') {
      if (F.lo < F.hi) p.push(...DOBLE(base + F.lo));
      const fin = base + F.hi;
      p.push(...cuentaAtras(fin), ...ALARMA(fin));
      if (k === fases.length - 1) { base = fin + 1.5; break; } // después del máximo ya no hay más pitidos
      base = fin;
    }
  }
  return { p: p.filter(x => x.t >= 0), dur: Math.max(0, base) };
}

// WAV de 8 kHz y 8 bits con silencio y los pitidos en sus segundos.
export function wav(pitidos, dur) {
  const R = 8000, n = Math.ceil((dur + 0.5) * R);
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const txt = (o, s) => [...s].forEach((c, i) => { buf[o + i] = c.charCodeAt(0); });
  txt(0, 'RIFF'); dv.setUint32(4, 36 + n, true); txt(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, R, true); dv.setUint32(28, R, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
  txt(36, 'data'); dv.setUint32(40, n, true);
  buf.fill(128, 44);
  for (const p of pitidos) {
    const a = Math.floor(p.t * R), b = Math.min(n, a + Math.floor(p.d * R));
    for (let k = Math.max(0, a); k < b; k++) {
      const x = (k - a) / R, env = Math.min(1, x / 0.01, (p.d - x) / 0.02);
      buf[44 + k] = 128 + Math.round(Math.sin(2 * Math.PI * p.f * x) * 110 * p.v * env);
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
