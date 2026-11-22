import subprocess, sys, re, os
M = sys.argv[1]
MUT = [
 ('M3 alarma se cierra a los 30 s', 'js/areas/sesion/temporizador.js', 'const ALARMA_SEG = 8;', 'const ALARMA_SEG = 30;'),
 ('M11 una sola alarma sonora', 'js/areas/sesion/temporizador.js', '...ALARMA(fin), ...ALARMA(fin + 4), ...ALARMA(fin + 8)', '...ALARMA(fin)'),
 ('M13 −15 sin tope', 'js/areas/sesion/temporizador.js', 'F.dur = Math.max(transcurrido() + 1, F.dur - 15)', 'F.dur = F.dur - 15'),
 ('M14 previa de 3 s', 'js/areas/sesion/temporizador.js', 'const PREVIA = 5;', 'const PREVIA = 3;'),
]
env = dict(os.environ, PATH='/opt/node24/bin:' + os.environ['PATH'], PW_CHROMIUM='/opt/pw-browsers/chromium', PUERTO_E2E='8973', PUERTO_SW='8974')
for nombre, f, a, b in MUT:
    p = os.path.join(M, f); s = open(p).read()
    assert s.count(a) == 1, nombre
    open(p, 'w').write(s.replace(a, b))
    try:
        subprocess.run(['node', 'scripts/version.mjs'], cwd=M, env=env, capture_output=True)
        r = subprocess.run(['npx', 'playwright', 'test', 'tests/e2e/sesion.spec.mjs', 'tests/e2e/humo.spec.mjs', '--trace', 'off', '--reporter=line', '--output', '/tmp/claude-0/-home-user-el-plan/1a092d6b-4887-5556-b1cc-1429962da25e/scratchpad/reauditoria/codigo/pw-mut'], cwd=M, env=env, capture_output=True, text=True, timeout=600)
        out = r.stdout + r.stderr
        res = re.findall(r'(\d+) (passed|failed)', out)
        print(nombre, res, re.findall(r'› (tests/e2e/\S+:\d+:\d+ › [^\n]{0,90})', out)[:3] if r.returncode else '', flush=True)
    finally:
        open(p, 'w').write(s)
        subprocess.run(['node', 'scripts/version.mjs'], cwd=M, env=env, capture_output=True)
