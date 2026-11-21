# Propuestas de logo para «Carril 2» (DIS 2, segunda vuelta). Genera, para cada propuesta, en logos/<id>/:
#   simbolo.svg (solo el símbolo, sin fondo), icono.svg, icono-maskable.svg y logo.svg (símbolo + nombre en curvas).
# Los PNG los saca herramientas/iconos.mjs. Uso: python3 prototipos/identidad/herramientas/logos.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marcas import texto_a_trazado, AQUI  # reutiliza el paso de texto a curvas

FONDO = '#081723'   # agua de noche (fondo de Carril 2)
MARCA = '#EDF3F7'   # blanco azulado
TINTE = '#7FCFE0'   # agua clara: segundo tono de la marca (nunca color de persona)

# Cada símbolo se dibuja en una caja de 512 con su contenido centrado en (256, 256) y dentro de un círculo de radio ~180.
P_CUENCO = 'M284 96 A88 88 0 0 1 284 272 H228 V96 Z M284 148 V220 A36 36 0 0 0 284 148 Z'
SIMBOLOS = {
  # 1 · Giro: dos P que comparten el asta y giran media vuelta. Dos personas, una misma constancia.
  'giro': dict(nombre='Giro', svg=f'''<g fill="{MARCA}" fill-rule="evenodd">
  <rect x="228" y="96" width="56" height="320" rx="6"/>
  <path d="{P_CUENCO}"/>
  <path d="{P_CUENCO}" transform="rotate(180 256 256)"/>
</g>''', idea='Dos P que comparten el asta y giran media vuelta: dos personas y un mismo ritmo. Simétrica por giro, se reconoce del revés y a 16 px.'),

  # 2 · Marea: la P entera, cortada por una línea de agua ondulada; la parte de abajo, en el tono del agua.
  'marea': dict(nombre='Marea', svg=f'''<defs>
  <clipPath id="marea-p"><path d="M156 104 H288 A100 100 0 0 1 288 304 H224 V408 H156 Z M224 164 V244 H284 A40 40 0 0 0 284 164 Z" clip-rule="evenodd"/></clipPath>
</defs>
<g clip-path="url(#marea-p)">
  <rect x="140" y="90" width="260" height="330" fill="{MARCA}"/>
  <path d="M140 252 C176 232 212 232 248 252 S320 272 356 252 S400 236 410 242 V430 H140 Z" fill="{TINTE}"/>
  <path d="M140 252 C176 232 212 232 248 252 S320 272 356 252 S400 236 410 242" fill="none" stroke="{FONDO}" stroke-width="14"/>
</g>''', idea='Una P sólida con la línea del agua a media altura: la piscina como alusión, no como tema. La ola marca también el «nivel» que sube con el progreso.'),

  # 3 · Trazo: una P de un solo trazo que no cierra el cuenco. Una línea continua, como la constancia.
  'trazo': dict(nombre='Trazo', svg=f'''<path d="M190 412 V196 A92 92 0 0 1 282 104 A84 84 0 0 1 282 272 H292" fill="none" stroke="{MARCA}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>''',
     idea='Una P de un solo trazo, de grosor constante, que deja el cuenco abierto: se lee como firma y como movimiento continuo.'),

  # 4 · Dúo: la P partida en dos piezas, asta y cuenco, separadas por una calle. Dos tonos, dos personas.
  'duo': dict(nombre='Dúo', svg=f'''<g>
  <rect x="160" y="100" width="64" height="312" rx="32" fill="{MARCA}"/>
  <path d="M252 100 H272 A92 92 0 0 1 272 284 H252 Z M252 160 V224 H272 A32 32 0 0 0 272 160 Z" fill="{TINTE}" fill-rule="evenodd"/>
</g>''', idea='La P en dos piezas separadas por una calle: asta y cuenco, cada una con su tono. Habla de la pareja sin pintar personas.'),

  # 5 · Nivel: un círculo que se llena de agua. El progreso como nivel que sube.
  'nivel': dict(nombre='Nivel', svg=f'''<defs><clipPath id="nivel-c"><circle cx="256" cy="256" r="118"/></clipPath></defs>
<circle cx="256" cy="256" r="138" fill="none" stroke="{MARCA}" stroke-width="36"/>
<g clip-path="url(#nivel-c)">
  <path d="M100 262 C150 236 200 236 256 262 S362 288 412 262 V420 H100 Z" fill="{TINTE}"/>
</g>''', idea='Un círculo que se llena de agua: el progreso como nivel que sube. Abstracto y muy legible pequeño, pero menos propio.'),
}

for clave, d in SIMBOLOS.items():
    carpeta = os.path.join(AQUI, 'logos', clave)
    os.makedirs(carpeta, exist_ok=True)
    sim = d['svg']
    archivos = {
      'simbolo.svg': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 80 352 352" role="img" aria-label="Pipos Fitness">\n{sim}\n</svg>\n',
      'icono.svg': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Pipos Fitness">\n<rect width="512" height="512" rx="112" fill="{FONDO}"/>\n{sim}\n</svg>\n',
      'icono-maskable.svg': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Pipos Fitness">\n<rect width="512" height="512" fill="{FONDO}"/>\n<g transform="translate(256 256) scale(.78) translate(-256 -256)">\n{sim}\n</g>\n</svg>\n',
    }
    trazado, ancho = texto_a_trazado('carril-2/fuentes/instrument-sans.woff2', {'wght': 500, 'wdth': 100}, 'Pipos Fitness', 64, 132, 82, -0.6)
    total = int(132 + ancho + 6)
    archivos['logo.svg'] = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} 112" role="img" aria-label="Pipos Fitness">\n'
                            f'<g transform="translate(-28 -28) scale(.328)">{sim}</g>\n<path fill="{MARCA}" d="{trazado}"/>\n</svg>\n')
    for nombre, txt in archivos.items():
        # Los id de clipPath se prefijan por archivo para que varios SVG en línea no choquen
        with open(os.path.join(carpeta, nombre), 'w') as fh:
            fh.write(txt)
    print(clave, 'ok')
