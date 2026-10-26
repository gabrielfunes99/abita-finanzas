"""Genera los íconos de la PWA (src/pwa/icons/) a partir de la "A" del logo.
Uso: python tools/icons.py   (requiere Pillow)
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'src/pwa/icons'
ORANGE, BG = (255, 77, 0), (0, 0, 0)
# Misma "A" que #mk1 y #mk2 en src/ui.html
PATHS = [
    'M227.482 1189.07L227.118 1188.39C225.213 1184.75 220.864 1183.12 220.687 1183.05C220.068 1182.84 219.067 1182.56 217.8 1182.46C217.525 1182.43 217.231 1182.42 216.897 1182.42C216.563 1182.42 216.239 1182.43 215.915 1182.45H215.767L197.396 1182.4H175.43L185.613 1162.97L194.941 1145.19L203.366 1129.04H175.086L167.28 1143.99L151.265 1174.51H151.304L143.645 1189.12C141.819 1192.81 141.868 1197.02 143.783 1200.66C145.688 1204.29 149.105 1206.71 153.15 1207.31C153.661 1207.38 154.201 1207.43 154.81 1207.43H155.418L179.682 1207.4L208.815 1207.49L218.193 1225.37L228.199 1244.43C228.199 1244.43 229.102 1246.12 230.565 1248.89H258.825L235.318 1204.07C233.442 1200.52 230.565 1195.05 227.462 1189.06L227.482 1189.07Z',
    'M160.633 1227.71C160.633 1225.12 159.376 1222.73 157.333 1221.44L147.455 1215.17C144.323 1213.19 140.317 1213.19 137.184 1215.17L127.306 1221.44C125.264 1222.73 124.007 1225.12 124.007 1227.71V1242.57C123.977 1243.22 124.007 1244.71 124.891 1246.19C125.362 1246.97 125.882 1247.44 126.088 1247.62C127.63 1248.92 129.466 1248.92 130.114 1248.89C134.17 1248.71 137.174 1248.89 141.338 1248.84C141.495 1248.84 142.143 1248.84 143.429 1248.84C148.879 1248.82 151.599 1248.84 152.316 1248.84C152.915 1248.84 154.024 1248.84 154.604 1248.84C154.849 1248.84 158.05 1248.86 159.739 1246.19C160.672 1244.71 160.662 1243.18 160.623 1242.57V1227.71H160.633Z',
]
X0, Y0, W, H = 123.98, 1129.0, 134.85, 119.9  # caja de la "A"


def polygon(d):
    """Aplana un path SVG con comandos absolutos M L H V C Z."""
    toks = re.findall(r'[MLHVCZ]|-?[\d.]+', d)
    pts, i, cmd, x, y = [], 0, None, 0.0, 0.0
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]; i += 1
            if cmd == 'Z':
                continue
        n = lambda k: float(toks[i + k])
        if cmd in 'ML':
            x, y = n(0), n(1); i += 2; pts.append((x, y))
        elif cmd == 'H':
            x = n(0); i += 1; pts.append((x, y))
        elif cmd == 'V':
            y = n(0); i += 1; pts.append((x, y))
        elif cmd == 'C':
            x1, y1, x2, y2, x3, y3 = (n(k) for k in range(6)); i += 6
            for s in range(1, 13):
                t = s / 12; u = 1 - t
                pts.append((u**3*x + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3, u**3*y + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3))
            x, y = x3, y3
    return pts


def icon(size, mark_width):
    """mark_width: ancho de la "A" como fracción del ícono."""
    ss = 4; S = size * ss
    img = Image.new('RGB', (S, S), BG)
    glow = Image.new('L', (S, S), 0); g = ImageDraw.Draw(glow)
    for r in range(40, 0, -1):  # resplandor naranja arriba a la derecha, como el hero
        a = int(90 * (1 - r / 40))
        cx, cy, rad = S * .72, S * .25, S * .7 * r / 40
        g.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=a)
    img = Image.composite(Image.new('RGB', (S, S), ORANGE), img, glow)
    k = S * mark_width / W
    ox, oy = (S - W * k) / 2, (S - H * k) / 2
    d = ImageDraw.Draw(img)
    for p in PATHS:
        d.polygon([(ox + (px - X0) * k, oy + (py - Y0) * k) for px, py in polygon(p)], fill=ORANGE)
    return img.resize((size, size), Image.LANCZOS)


def svg(mark_width):
    k = 512 * mark_width / W
    tf = f'translate({(512 - W * k) / 2:.2f} {(512 - H * k) / 2:.2f}) scale({k:.4f}) translate(-{X0} -{Y0})'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/>'
            '<radialGradient id="g" cx=".72" cy=".25" r=".7"><stop offset="0" stop-color="#FF4D00" stop-opacity=".35"/>'
            '<stop offset="1" stop-color="#FF4D00" stop-opacity="0"/></radialGradient><rect width="512" height="512" fill="url(#g)"/>'
            f'<g transform="{tf}" fill="#FF4D00">' + ''.join(f'<path d="{p}"/>' for p in PATHS) + '</g></svg>')


OUT.mkdir(parents=True, exist_ok=True)
icon(512, .6).save(OUT / 'icon-512.png')
icon(192, .6).save(OUT / 'icon-192.png')
icon(180, .6).save(OUT / 'apple-touch-icon.png')
icon(512, .46).save(OUT / 'maskable-512.png')  # zona segura de Android: círculo del 80%
(OUT / 'icon.svg').write_text(svg(.6), encoding='utf-8')
print('ok ->', OUT)
