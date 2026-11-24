import subprocess, sys, re, os, json
M = sys.argv[1]
MUT = [
 ('M1 C-DOLOR-0 tope 6 de la ficha', 'js/areas/entrenador/dia.js', 'Math.min(6, +l.dolor || 0)', '(+l.dolor || 0)'),
 ('M2 validador no mira rechazos', 'js/areas/entrenador/validar.js', "if ((S.perfil.gustos || {})[e.id] === 'rechazo') return 'no lo quieres';", ''),
 ('M3 alarma se cierra a los 30 s', 'js/areas/sesion/temporizador.js', 'const ALARMA_SEG = 8;', 'const ALARMA_SEG = 30;'),
 ('M4 vibración de un toque', 'js/areas/sesion/temporizador.js', 'export const VIBRA_ALARMA = [250, 120, 250, 120, 250];', 'export const VIBRA_ALARMA = [250];'),
 ('M5 espejo no guarda si localStorage falla', 'js/nucleo/estado.js', 'alEspejo(); // el espejo sigue guardando aunque localStorage falle', '// quitado'),
 ('M6 temporizador no se recupera tras recargar', 'js/areas/sesion/temporizador.js', 's - F.dur > 10 * 60', 's - F.dur > -1e9'),
 ('M7 espera de cambios 10 min', 'js/nucleo/copia.js', 'export const ESPERA_CAMBIOS = 60e3;', 'export const ESPERA_CAMBIOS = 600e3;'),
 ('M8 sin confirmar tras bloqueo', 'js/areas/sesion/temporizador.js', "if (ultimo && !enVivo && s >= F.hi && !t.avisos['vivo' + t.i]) {", "if (false) {"),
 ('M9 límite de cuerpo 1,5 MB', 'api/_comun.js', 'export const LIMITE_CUERPO = 150 * 1024;', 'export const LIMITE_CUERPO = 1500 * 1024;'),
 ('M10 no carga lo de otra pestaña', 'js/nucleo/estado.js', '  if (leerRev() <= rev) return false;\n  return recargarDeDisco();', '  return false;'),
 ('M11 una sola alarma sonora', 'js/areas/sesion/temporizador.js', '...ALARMA(fin), ...ALARMA(fin + 4), ...ALARMA(fin + 8)', '...ALARMA(fin)'),
 ('M12 sin C-LES-2 en bandasHoy', 'js/areas/entrenador/dia.js', 'if (b.nueva && b.banda === 1 && b.dolor >= 2) b.banda = 2;', ''),
 ('M13 −15 puede dejar el descanso en negativo', 'js/areas/sesion/temporizador.js', 'F.dur = Math.max(transcurrido() + 1, F.dur - 15)', 'F.dur = F.dur - 15'),
 ('M14 previa de 3 s', 'js/areas/sesion/temporizador.js', 'const PREVIA = 5;', 'const PREVIA = 3;'),
 ('M15 dolor alto desde 8', 'js/areas/entrenador/checkin.js', 'if (maxDolor >= 7 || salud.soloSuave) {', 'if (maxDolor >= 8 || salud.soloSuave) {'),
 ('M16 guardarYa pisa otra pestaña', 'js/nucleo/estado.js', '    if (recargarDeDisco()) return false;\n', ''),
 ('M17 pagehide no guarda', 'js/nucleo/estado.js', "window.addEventListener('pagehide', guardarPendiente);", ''),
 ('M18 alarma no vibra', 'js/areas/sesion/temporizador.js', '  pitar(); vibrar(VIBRA_ALARMA);\n  if (enOtraSesion', '  pitar();\n  if (enOtraSesion'),
]
sel = sys.argv[2].split(',') if len(sys.argv) > 2 else None
env = dict(os.environ, PATH='/opt/node24/bin:' + os.environ['PATH'])
for nombre, f, a, b in MUT:
    if sel and nombre.split()[0] not in sel: continue
    p = os.path.join(M, f); s = open(p).read()
    if s.count(a) != 1: print(nombre, 'NO APLICA', s.count(a)); continue
    open(p, 'w').write(s.replace(a, b))
    try:
        r = subprocess.run(['node', '--test', '--test-reporter=spec', 'tests/**/*.test.mjs'], cwd=M, env=env, capture_output=True, text=True, timeout=300)
        out = r.stdout + r.stderr
        fails = sorted(set(re.findall(r'^test at (\S+)', out, re.M)))
        fails = [x for x in fails if 'version' not in x]
        print(f"{nombre}: {'CAZADA' if fails else 'SOBREVIVE'} {fails[:4]}", flush=True)
    finally:
        open(p, 'w').write(s)
