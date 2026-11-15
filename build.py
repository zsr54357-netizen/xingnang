#!/usr/bin/env python3
"""Build the deployable PWA and the single-file offline phone version."""
from __future__ import annotations

import base64
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
ICONS = SRC / "icons"

html = (SRC / "index.html").read_text(encoding="utf-8")
css = (SRC / "styles.css").read_text(encoding="utf-8")
js = (SRC / "app.js").read_text(encoding="utf-8")

if "</script" in js.lower():
    raise SystemExit("app.js contains a closing script tag; inline build would break.")

html = html.replace(
    '  <link rel="stylesheet" href="styles.css">',
    "  <style>\n" + css + "\n  </style>",
)
html = html.replace(
    '  <script src="app.js"></script>',
    "  <script>\n" + js + "\n  </script>",
)
if "styles.css" in html or 'src="app.js"' in html:
    raise SystemExit("Failed to inline stylesheet or script.")

pwa_html = html
(ROOT / "index.html").write_text(pwa_html, encoding="utf-8")

# The single-file version must not reference external manifest/icons.
offline_html = pwa_html
offline_html = re.sub(r'\n\s*<link rel="manifest"[^>]*>', "", offline_html)
offline_html = re.sub(r'\n\s*<link rel="icon"[^>]*>', "", offline_html)
offline_html = re.sub(r'\n\s*<link rel="apple-touch-icon"[^>]*>', "", offline_html)
favicon = base64.b64encode((ICONS / "favicon-64.png").read_bytes()).decode("ascii")
offline_html = offline_html.replace(
    "</head>",
    f'  <link rel="icon" href="data:image/png;base64,{favicon}">\n</head>',
)
(ROOT / "行囊-手机版.html").write_text(offline_html, encoding="utf-8")

# Static PWA files next to index.html.
shutil.copy2(SRC / "manifest.webmanifest", ROOT / "manifest.webmanifest")
shutil.copy2(SRC / "sw.js", ROOT / "sw.js")
target_icons = ROOT / "icons"
if target_icons.exists():
    shutil.rmtree(target_icons)
shutil.copytree(ICONS, target_icons)

# A zip of only the files needed for HTTPS static hosting.
readme = ROOT / "使用说明.md"
zip_path = ROOT / "行囊-部署包.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for rel in ["index.html", "manifest.webmanifest", "sw.js"]:
        archive.write(ROOT / rel, rel)
    for icon_file in sorted(target_icons.glob("*.png")):
        archive.write(icon_file, f"icons/{icon_file.name}")
    if readme.exists():
        archive.write(readme, readme.name)

print(f"built {ROOT / 'index.html'}")
print(f"built {ROOT / '行囊-手机版.html'}")
print(f"built {zip_path}")
