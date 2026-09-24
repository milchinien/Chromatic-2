"""Baut aus dem Pixel-Sheet der Schrift „Weiholmir Standard" eine TrueType-Datei.

Quelle: assets/font/Weiholmir_full_sheet.png (70 × 77 px, Zellen 7 × 7, 10 pro Zeile).
Ziel:   assets/font/Weiholmir.ttf

Jeder gesetzte Pixel wird zu einem Quadrat von 100 Einheiten; die Umrisse werden
zu geschlossenen Konturen zusammengefügt (keine Nähte). 1 em = 8 Pixel, die Schrift
ist also bei 8 / 16 / 24 … px pixelgenau. Fehlende Zeichen (Umlaute, ß, ·, × …)
werden im Stil der Schrift ergänzt.

Aufruf:  python scripts/build_weiholmir.py   (benötigt: pip install fonttools pillow)
"""

from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'assets/font/Weiholmir_full_sheet.png'
OUT = ROOT / 'assets/font/Weiholmir.ttf'

PX = 100  # Einheiten pro Pixel
CELL = 7
BASE_ROW = 6  # unterste Zeile einer Zelle liegt auf der Grundlinie

# Belegung des Sheets, Zeile für Zeile (je 10 Zellen)
ROWS = [
    'ABCDEFGHIJ',
    'KLMNOPQRST',
    'UVWXYZ',
    'abcdefghij',
    'klmnopqrst',
    'uvwxyz',
    '0123456789',
    '!?.%;:$#\'"',
    '/\\()&*+,-<',
    '>=@[]^_`{}',
    '°€£~™',
]

Glyph = list[tuple[int, int]]  # gesetzte Pixel als (x, y), y = Zeile von oben (0 = Oberkante Zelle)


def read_sheet() -> dict[str, Glyph]:
    im = Image.open(SHEET).convert('RGBA')
    glyphs: dict[str, Glyph] = {}
    for r, chars in enumerate(ROWS):
        for c, ch in enumerate(chars):
            px = [
                (x, y)
                for y in range(CELL)
                for x in range(CELL)
                if im.getpixel((c * CELL + x, r * CELL + y))[3] == 255
            ]
            glyphs[ch] = px
    return glyphs


def from_art(rows: list[str], top: int = 0) -> Glyph:
    return [(x, top + y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == '#']


def add_extras(g: dict[str, Glyph]) -> None:
    """Ergänzt Zeichen, die im Sheet fehlen, im selben Stil."""

    def with_dots(base: str, dot_row: int) -> Glyph:
        px = g[base]
        xs = [x for x, _ in px]
        left, right = min(xs), max(xs)
        dots = [(left, dot_row), (right, dot_row)] if right - left >= 3 else [(left, dot_row), (left + 2, dot_row)]
        # Zwei Punkte, je 1 Pixel breit, über dem Buchstaben
        return px + dots

    g['ä'] = with_dots('a', 0)
    g['ö'] = with_dots('o', 0)
    g['ü'] = with_dots('u', 0)
    g['Ä'] = with_dots('A', -2)
    g['Ö'] = with_dots('O', -2)
    g['Ü'] = with_dots('U', -2)
    g['ß'] = from_art([
        '.###.',
        '##.##',
        '##.##',
        '##.#.',
        '##.##',
        '##.##',
        '##.#.',
    ])
    g['·'] = from_art(['##', '##'], top=2)
    g['×'] = from_art(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], top=2)
    g['–'] = from_art(['#####'], top=3)
    g['—'] = from_art(['#######'], top=3)
    g['−'] = from_art(['####'], top=3)
    g['▸'] = from_art(['#..', '##.', '###', '##.', '#..'], top=1)
    g['★'] = from_art(['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#'], top=1)
    g['…'] = from_art(['#.#.#'], top=6)
    g['„'] = from_art(['##.##', '.#..#'], top=5)
    g['“'] = from_art(['#..#.', '##.##'], top=0)
    g['‘'] = from_art(['#.', '##'], top=0)
    g['’'] = from_art(['##', '.#'], top=0)
    g['|'] = from_art(['##'] * 7)


def outline(px: Glyph) -> list[list[tuple[int, int]]]:
    """Verbindet die Pixel zu geschlossenen Umrissen (Kanten zwischen zwei Pixeln fallen weg)."""
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    cells = set(px)

    def add(a: tuple[int, int], b: tuple[int, int]) -> None:
        edges.setdefault(a, []).append(b)

    # Koordinaten: x nach rechts, y nach oben (Einheit: Pixel), Grundlinie = 0
    for x, y in cells:
        top = BASE_ROW + 1 - y
        bot = top - 1
        # Umlaufrichtung im Uhrzeigersinn (TrueType-Außenkontur)
        if (x, y - 1) not in cells:
            add((x, top), (x + 1, top))
        if (x + 1, y) not in cells:
            add((x + 1, top), (x + 1, bot))
        if (x, y + 1) not in cells:
            add((x + 1, bot), (x, bot))
        if (x - 1, y) not in cells:
            add((x, bot), (x, top))

    loops = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        cur = start
        while True:
            nxt = edges[cur].pop()
            if not edges[cur]:
                del edges[cur]
            if nxt == start:
                break
            loop.append(nxt)
            cur = nxt
        # Gerade Zwischenpunkte entfernen
        simple = []
        n = len(loop)
        for i, p in enumerate(loop):
            a, b = loop[i - 1], loop[(i + 1) % n]
            if (a[0] == p[0] == b[0]) or (a[1] == p[1] == b[1]):
                continue
            simple.append(p)
        loops.append(simple)
    return loops


def main() -> None:
    glyphs = read_sheet()
    add_extras(glyphs)

    order = ['.notdef', 'space'] + [f'uni{ord(ch):04X}' for ch in glyphs]
    cmap = {32: 'space', 160: 'space'}
    metrics = {}
    tt_glyphs = {}

    pen = TTGlyphPen(None)
    pen.moveTo((0, 0))
    pen.lineTo((0, 700))
    pen.lineTo((400, 700))
    pen.lineTo((400, 0))
    pen.closePath()
    tt_glyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (500, 0)
    tt_glyphs['space'] = TTGlyphPen(None).glyph()
    metrics['space'] = (3 * PX, 0)

    for ch, px in glyphs.items():
        name = f'uni{ord(ch):04X}'
        cmap[ord(ch)] = name
        pen = TTGlyphPen(None)
        if px:
            min_x = min(x for x, _ in px)
            shifted = [(x - min_x, y) for x, y in px]
            width = max(x for x, _ in shifted) + 1
            for loop in outline(shifted):
                pen.moveTo((loop[0][0] * PX, loop[0][1] * PX))
                for p in loop[1:]:
                    pen.lineTo((p[0] * PX, p[1] * PX))
                pen.closePath()
        else:
            width = 2
        tt_glyphs[name] = pen.glyph()
        metrics[name] = ((width + 1) * PX, 0)

    fb = FontBuilder(unitsPerEm=8 * PX, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(tt_glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=8 * PX, descent=-2 * PX)
    fb.setupNameTable({'familyName': 'Weiholmir', 'styleName': 'Regular'})
    fb.setupOS2(
        sTypoAscender=8 * PX,
        sTypoDescender=-2 * PX,
        sTypoLineGap=0,
        usWinAscent=10 * PX,
        usWinDescent=2 * PX,
        sxHeight=5 * PX,
        sCapHeight=7 * PX,
    )
    fb.setupPost()
    fb.save(OUT)
    print(f'{OUT.relative_to(ROOT)}: {len(glyphs)} Zeichen')


if __name__ == '__main__':
    main()
