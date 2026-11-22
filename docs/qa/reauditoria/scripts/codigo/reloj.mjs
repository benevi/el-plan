// Precarga: desplaza el reloj a FECHA_SIM (ISO) manteniendo el avance real.
const objetivo = Date.parse(process.env.FECHA_SIM);
const Real = Date; const desfase = objetivo - Real.now();
class Falsa extends Real {
  constructor(...a) { if (a.length === 0) super(Real.now() + desfase); else super(...a); }
  static now() { return Real.now() + desfase; }
}
globalThis.Date = Falsa;
