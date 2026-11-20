# Logos, tercera ronda: «símbolo de pareja» (dos personas que entrenan juntas, en abstracto) para Carril 2.
# Para cada propuesta genera en logos-2/<id>/: simbolo.svg (dos colores), simbolo-un-tono.svg, icono.svg,
# icono-maskable.svg, icono-un-tono.svg y logo.svg (símbolo + nombre en curvas con Instrument Sans).
# Los PNG los saca herramientas/iconos.mjs. Uso: python3 prototipos/identidad/herramientas/logos2.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marcas import texto_a_trazado, AQUI

FONDO = '#081723'
LIMA = '#C9E77E'    # Víctor
ROSA = '#F29BC2'    # Virginia
MARCA = '#EDF3F7'   # un tono

def onda(f, t0, t1, n=48):
    pts = [f(t0 + (t1 - t0) * i / n) for i in range(n + 1)]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)

def linea(d, color, ancho, extra=''):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{ancho}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'

# ---------------------------------------------------------------- propuestas
def paralelo(a, b):
    # Dos trazos que avanzan en paralelo; el segundo, un paso por detrás.
    return (linea('M162 350 L278 150', a, 64) + linea('M264 372 L360 206', b, 64))

def ondas(a, b):
    # Dos ondas con el mismo ritmo, una sobre otra: dos calles que van juntas.
    f1 = lambda t: (128 + 256 * t, 206 - 46 * math.sin(2 * math.pi * t))
    f2 = lambda t: (128 + 256 * t, 306 - 46 * math.sin(2 * math.pi * t))
    return linea(onda(f1, 0, 1), a, 54) + linea(onda(f2, 0, 1), b, 54)

def arco(a, b):
    # Dos formas que se inclinan la una hacia la otra y casi se tocan: apoyo, sin juntarse del todo.
    return (linea('M176 396 C176 300 186 214 220 150', a, 62) + linea('M336 396 C336 300 326 214 292 150', b, 62))

def orbita(a, b):
    # Dos puntos en la misma órbita, cada uno con su estela: el mismo ritmo, siempre a la par.
    R, cx, cy = 118, 256, 256
    def punto(ang):
        r = math.radians(ang); return cx + R * math.cos(r), cy + R * math.sin(r)
    def estela(ang, color):
        ini, fin = ang - 110, ang - 18
        x0, y0 = punto(ini); x1, y1 = punto(fin)
        return f'<path d="M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{color}" stroke-width="26" stroke-linecap="round" opacity=".55"/>'
    pa, pb = punto(-50), punto(130)
    return (estela(-50, a) + estela(130, b) +
            f'<circle cx="{pa[0]:.1f}" cy="{pa[1]:.1f}" r="46" fill="{a}"/><circle cx="{pb[0]:.1f}" cy="{pb[1]:.1f}" r="46" fill="{b}"/>')

def escalon(a, b):
    # Dos «p» minúsculas, la segunda un paso más arriba: Pipos en plural, avanzando.
    def p(x0, y0, c):
        return (f'<path fill="{c}" fill-rule="evenodd" d="M{x0} {y0 + 66} A66 66 0 0 1 {x0 + 66} {y0} A66 66 0 0 1 {x0 + 66} {y0 + 132} '
                f'H{x0 + 54} V{y0 + 240} A27 27 0 0 1 {x0} {y0 + 240} Z M{x0 + 66} {y0 + 44} A22 22 0 0 0 {x0 + 66} {y0 + 88} A22 22 0 0 0 {x0 + 66} {y0 + 44} Z"/>')
    return p(118, 154, a) + p(262, 96, b)

def trenza(a, b):
    # Dos trazos que se cruzan dos veces, una por encima y otra por debajo: entrenar juntos, cada uno a su paso.
    A = lambda t: (112 + 288 * (t - .25), 256 - 62 * math.sin(2 * math.pi * t))
    B = lambda t: (112 + 288 * (t - .25), 256 + 62 * math.sin(2 * math.pi * t))
    hueco = lambda f, t0, t1: f'<path d="{onda(f, t0, t1, 12)}" fill="none" stroke="{FONDO}" stroke-width="82" stroke-linecap="butt"/>'
    return (linea(onda(B, .25, .75), b, 54) +
            hueco(A, .42, .58) + linea(onda(A, .25, .75), a, 54) +
            linea(onda(A, .75, 1.25), a, 54) +
            hueco(B, .92, 1.08) + linea(onda(B, .75, 1.25), b, 54))

PROPUESTAS = {'paralelo': paralelo, 'ondas': ondas, 'arco': arco, 'orbita': orbita, 'escalon': escalon, 'trenza': trenza}

def svg(caja, cuerpo, fondo=None, rx=0):
    f = f'<rect width="512" height="512"{f" rx=\"{rx}\"" if rx else ""} fill="{fondo}"/>\n' if fondo else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}" role="img" aria-label="Pipos Fitness">\n{f}{cuerpo}\n</svg>\n'

trazado, ancho = texto_a_trazado('carril-2/fuentes/instrument-sans.woff2', {'wght': 500, 'wdth': 100}, 'Pipos Fitness', 64, 132, 82, -0.6)
for clave, dibuja in PROPUESTAS.items():
    carpeta = os.path.join(AQUI, 'logos-2', clave)
    os.makedirs(carpeta, exist_ok=True)
    color, mono = dibuja(LIMA, ROSA), dibuja(MARCA, MARCA)
    maskable = lambda c: f'<g transform="translate(256 256) scale(.78) translate(-256 -256)">\n{c}\n</g>'
    total = int(132 + ancho + 6)
    archivos = {
        'simbolo.svg': svg('80 80 352 352', color),
        'simbolo-un-tono.svg': svg('80 80 352 352', mono),
        'icono.svg': svg('0 0 512 512', color, FONDO, 112),
        'icono-un-tono.svg': svg('0 0 512 512', mono, FONDO, 112),
        'icono-maskable.svg': svg('0 0 512 512', maskable(color), FONDO),
        'logo.svg': (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} 112" role="img" aria-label="Pipos Fitness">\n'
                     f'<g transform="translate(-28 -28) scale(.328)">{color}</g>\n<path fill="{MARCA}" d="{trazado}"/>\n</svg>\n'),
    }
    for nombre, txt in archivos.items():
        with open(os.path.join(carpeta, nombre), 'w') as fh:
            fh.write(txt)
    print(clave, 'ok')
