"""Genera las versiones de la app a partir de src/ui.html.
   - docs/                      -> PWA (GitHub Pages) que habla con la API de Apps Script (doPost)
   - apps-script/Index.html     -> diálogo dentro del Sheet (Abita > Abrir dashboard)
   - dist/cowork-dashboard.html -> artifact de Claude Cowork (usa el conector de Google Sheets)
Uso: python build.py
"""
import hashlib, shutil
from pathlib import Path
R = Path(__file__).parent
ui = (R/'src/ui.html').read_text(encoding='utf-8')
assert '/*ADAPTER*/' in ui and '<!--CHARTJS-->' in ui

GAS_HEAD = ('<base target="_top">\n'
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n'
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>')
COWORK_HEAD = ('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js" '
  'integrity="sha384-iU8HYtnGQ8Cy4zl7gbNMOhsDTTKX02BTXptVP/vqAWIaTfM7isw76iyZCsjL2eVi" crossorigin="anonymous"></script>')
PWA_HEAD = (R/'src/pwa/head.html').read_text(encoding='utf-8')

def build(head, adapter, out):
    html = ui.replace('<!--CHARTJS-->', head).replace('/*ADAPTER*/', (R/adapter).read_text(encoding='utf-8'))
    (R/out).parent.mkdir(parents=True, exist_ok=True)
    (R/out).write_text(html, encoding='utf-8'); print('ok ->', out)
    return html

build(GAS_HEAD, 'src/adapters/gas.js', 'apps-script/Index.html')
build(COWORK_HEAD, 'src/adapters/cowork.js', 'dist/cowork-dashboard.html')

# PWA: index.html + archivos estáticos de src/pwa (menos head.html). El service worker lleva un hash
# del contenido para que cada build nueva reemplace la caché vieja.
D = R/'docs'
if D.exists(): shutil.rmtree(D)
html = build(PWA_HEAD, 'src/adapters/pwa.js', 'docs/index.html')
h = hashlib.sha256(html.encode('utf-8'))
for f in sorted((R/'src/pwa').rglob('*')):
    if f.is_dir() or f.name in ('head.html', 'sw.js'): continue
    dst = D/f.relative_to(R/'src/pwa'); dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(f, dst); h.update(f.read_bytes())
sw = (R/'src/pwa/sw.js').read_text(encoding='utf-8').replace('__VERSION__', h.hexdigest()[:10])
(D/'sw.js').write_text(sw, encoding='utf-8')
(D/'.nojekyll').write_text('', encoding='utf-8')
print('ok -> docs/ (PWA)')
