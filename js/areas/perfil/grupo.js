// La parte del perfil que se ve (Objetivos y nivel, Lesiones, Salud, Mi entreno, Mis datos, Copias, Ajustes).
// Aparte para que el editor de «Mis sesiones» pueda volver a «Mi entreno» sin importar Perfil entero.
export const GRUPOS = [['objetivos', 'Objetivos y nivel'], ['lesiones', 'Lesiones'], ['salud', 'Salud'], ['entreno', 'Mi entreno'], ['datos', 'Mis datos'], ['copias', 'Copias'], ['ajustes', 'Ajustes']];
let grupo = 'objetivos';
export const grupoPerfil = () => grupo;
export function ponerGrupo(g) { if (GRUPOS.some(([k]) => k === g)) grupo = g; }
