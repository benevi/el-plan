# Genera los SVG de marca de cada dirección: icono, icono maskable y logo (símbolo + nombre en curvas).
# El nombre se convierte a trazados con fontTools para que el SVG no dependa de ninguna fuente instalada.
# Uso: python3 herramientas/marcas.py   (desde prototipos/identidad; necesita `pip install fonttools brotli`)
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def texto_a_trazado(fuente, ejes, texto, alto_px, x0, y_base, espaciado=0):
    f = TTFont(os.path.join(AQUI, fuente))
    f = instantiateVariableFont(f, ejes)
    upm = f['head'].unitsPerEm
    escala = alto_px / upm
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); hm = f['hmtx']
    partes = []; x = x0
    for c in texto:
        g = cmap[ord(c)]
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (escala, 0, 0, -escala, x, y_base))
        gs[g].draw(tp)
        d = pen.getCommands()
        if d: partes.append(d)
        x += hm[g][0] * escala + espaciado
    return ' '.join(partes), x - x0

# ---- Símbolos (en una caja de 512) -------------------------------------------------------------
TIZA_SIMBOLO = '''<g fill="none" stroke="{c}" stroke-linecap="round" stroke-width="34">
  <path d="M158 146 L154 368"/>
  <path d="M216 140 L214 372"/>
  <path d="M274 146 L276 366"/>
  <path d="M332 142 L330 370"/>
  <path d="M116 330 C190 290 300 220 396 176"/>
</g>'''
CARRIL_SIMBOLO = '''<g fill="none" stroke="{c}" stroke-width="54">
  <path d="M206 120 V392" stroke-linecap="butt"/>
  <path d="M134 392 H278" stroke-linecap="butt"/>
  <path d="M206 147 H284 a76 76 0 0 1 0 152 H206" stroke-linejoin="round"/>
</g>'''
HIERRO_SIMBOLO = '''<g>
  <rect x="166" y="190" width="56" height="226" rx="10" fill="{c}"/>
  <rect x="150" y="372" width="88" height="24" rx="6" fill="{c}"/>
  <circle cx="290" cy="214" r="116" fill="{c}"/>
  <circle cx="290" cy="214" r="86" fill="none" stroke="{f}" stroke-width="8"/>
  <circle cx="290" cy="214" r="30" fill="{f}"/>
</g>'''

DIRECCIONES = {
  'tiza':   dict(fondo='#1A221E', marca='#EEEDE6', simbolo=TIZA_SIMBOLO,
                 fuente='tiza/fuentes/bricolage-grotesque.woff2', ejes={'wght': 600}, esp=0),
  'carril': dict(fondo='#062033', marca='#EAF6FB', simbolo=CARRIL_SIMBOLO,
                 fuente='carril/fuentes/saira.woff2', ejes={'wght': 600, 'wdth': 87.5}, esp=0),
  'hierro': dict(fondo='#16120F', marca='#F4EEE6', simbolo=HIERRO_SIMBOLO,
                 fuente='hierro/fuentes/sofia-sans-extra-condensed.woff2', ejes={'wght': 600}, esp=1),
}

def generar():
    for nombre, d in DIRECCIONES.items():
        sim = d['simbolo'].format(c=d['marca'], f=d['fondo'])
        icono = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Pipos Fitness">
    <rect width="512" height="512" rx="112" fill="{d['fondo']}"/>
    {sim}
    </svg>
    '''
        # Maskable: fondo a sangre y símbolo reducido al 80 % para quedar dentro de la zona segura (círculo de radio 0,4).
        mask = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Pipos Fitness">
    <rect width="512" height="512" fill="{d['fondo']}"/>
    <g transform="translate(256 256) scale(.8) translate(-256 -256)">
    {sim}
    </g>
    </svg>
    '''
        # Logo horizontal: símbolo sin fondo (alto 120) y nombre en curvas.
        trazado, ancho = texto_a_trazado(d['fuente'], d['ejes'], 'Pipos Fitness', 76, 150, 88, d['esp'])
        total = int(150 + ancho + 8)
        logo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} 120" role="img" aria-label="Pipos Fitness">
    <g transform="translate(-38 -40) scale(.38)">{sim}</g>
    <path fill="{d['marca']}" d="{trazado}"/>
    </svg>
    '''
        # El símbolo del logo va en el color de la marca sobre fondo transparente; en Hierro los huecos del disco usan el fondo.
        for archivo, txt in (('icono.svg', icono), ('icono-maskable.svg', mask), ('logo.svg', logo)):
            with open(os.path.join(AQUI, nombre, archivo), 'w') as fh:
                fh.write(txt)
        print(nombre, 'ok', total)

if __name__ == '__main__':
    generar()
