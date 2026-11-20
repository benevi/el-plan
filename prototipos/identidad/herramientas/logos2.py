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

def trenza_v(a, b, amp=62, ancho=288, grosor=54, hueco_px=28, ventana=.08, t0=.25, t1=1.25, giro=0, fondo=None):
    """Dos trazos que se cruzan dos veces: en el primer cruce pasa por encima el de Víctor; en el segundo, el de Virginia."""
    fondo = fondo or FONDO
    x0 = 256 - ancho / 2
    A = lambda t: (x0 + ancho * (t - t0) / (t1 - t0), 256 - amp * math.sin(2 * math.pi * t))
    B = lambda t: (x0 + ancho * (t - t0) / (t1 - t0), 256 + amp * math.sin(2 * math.pi * t))
    hueco = lambda f, c: f'<path d="{onda(f, c - ventana, c + ventana, 16)}" fill="none" stroke="{fondo}" stroke-width="{grosor + hueco_px}" stroke-linecap="butt"/>'
    m = (t0 + t1) / 2  # punto medio, lejos de los cruces (0,5 y 1,0)
    cuerpo = (linea(onda(B, t0, m), b, grosor) +
              hueco(A, .5) + linea(onda(A, t0, m), a, grosor) +
              linea(onda(A, m, t1), a, grosor) +
              hueco(B, 1.0) + linea(onda(B, m, t1), b, grosor))
    return f'<g transform="rotate({giro} 256 256)">{cuerpo}</g>' if giro else cuerpo

# Variantes de Trenza estudiadas al pulirla (DIS 2, decisión de Víctor). La que se usa es la de TRENZA_ELEGIDA.
TRENZA_VARIANTES = {
  'a-vertical': dict(amp=60, ancho=316, grosor=46, hueco_px=24, ventana=.085, t0=.3, t1=1.2, giro=-90),
  'b-en-marcha': dict(amp=58, ancho=292, grosor=46, hueco_px=24, ventana=.085, t0=.3, t1=1.2, giro=-72),
  'c-horizontal': dict(amp=58, ancho=292, grosor=46, hueco_px=24, ventana=.085, t0=.3, t1=1.2),
}
TRENZA_ELEGIDA = 'a-vertical'

def trenza(a, b, fondo=None):
    return trenza_v(a, b, fondo=fondo, **TRENZA_VARIANTES[TRENZA_ELEGIDA])

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

# Variantes de Trenza, para comparar (logos-2/trenza/variantes/<variante>/)
for nombre, params in TRENZA_VARIANTES.items():
    carpeta = os.path.join(AQUI, 'logos-2', 'trenza', 'variantes', nombre)
    os.makedirs(carpeta, exist_ok=True)
    for archivo, cuerpo in (('icono.svg', trenza_v(LIMA, ROSA, **params)), ('icono-un-tono.svg', trenza_v(MARCA, MARCA, **params))):
        with open(os.path.join(carpeta, archivo), 'w') as fh:
            fh.write(svg('0 0 512 512', cuerpo, FONDO, 112))
print('variantes de trenza ok')
