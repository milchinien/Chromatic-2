"""Verkleinert die Bilder der Offline-Version (braucht Pillow).

Kartenbilder: PNG 1536×1024 → WebP 768×512 (im Spiel werden sie viel kleiner gezeigt).
Raumbilder:   WebP neu kodiert (gleiche Größe, etwas stärkere Kompression).
Aufruf: python scripts/shrink-art.py <ordner der offline-version>
"""

import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1])
saved = 0

for png in sorted((root / "card-art" / "v2").glob("*.png")):
    before = png.stat().st_size
    im = Image.open(png).convert("RGB")
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    out = png.with_suffix(".webp")
    im.save(out, "WEBP", quality=86, method=6)
    png.unlink()
    saved += before - out.stat().st_size

for webp in sorted((root / "room-art").glob("*.webp")):
    before = webp.stat().st_size
    im = Image.open(webp).convert("RGB")
    im.save(webp, "WEBP", quality=82, method=6)
    saved += before - webp.stat().st_size

print(f"Bilder verkleinert, {saved / 1e6:.0f} MB gespart")
