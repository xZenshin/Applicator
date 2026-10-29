"""Generates "Cabin Small Caps", the font the CV uses for its name, headings and titles.

Cabin has no small caps. Faking them (CSS font-variant, or capitals at two font sizes) puts each word into
the PDF as two pieces of text, so PDF viewers select "ducation" when "Education" is double-clicked. In this
font every lowercase letter is drawn as a capital at 70%, so a whole word is set in one font at one size and
copies as the original text.

Cabin is licensed under the SIL Open Font License 1.1, which allows modified versions; the licence is copied
next to the output. The generated files are committed, so this only needs to run again when Cabin changes.

Usage (Python with fonttools and brotli: pip install fonttools brotli):
    python scripts/make-small-caps-font.py
"""
import shutil
import unicodedata
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

SCALE = 0.7
FAMILY = 'Cabin Small Caps'
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'node_modules' / '@fontsource' / 'cabin'
OUT = ROOT / 'src' / 'renderer' / 'src' / 'assets' / 'fonts'
STYLES = {'Regular': 'cabin-latin-400-normal.woff2', 'Bold': 'cabin-latin-700-normal.woff2'}


def small_cap_glyph(font: TTFont, base: str):
    """The capital `base`, scaled down, as a new outline (components decomposed)."""
    recording = DecomposingRecordingPen(font.getGlyphSet())
    font.getGlyphSet()[base].draw(recording)
    pen = TTGlyphPen(None)
    recording.replay(TransformPen(pen, (SCALE, 0, 0, SCALE, 0, 0)))
    glyph = pen.glyph()
    glyph.recalcBounds(font['glyf'])
    return glyph


def make(style: str, source_file: str) -> Path:
    font = TTFont(SOURCE / 'files' / source_file)
    glyf, hmtx = font['glyf'], font['hmtx']
    cmap = font.getBestCmap()
    order = list(font.getGlyphOrder())

    for cp, _ in sorted(cmap.items()):
        ch = chr(cp)
        upper = ch.upper()
        # Only letters with a one-character capital in the font; others (ß, µ, ÿ) keep their own glyph.
        if unicodedata.category(ch) != 'Ll' or len(upper) != 1 or ord(upper) not in cmap:
            continue
        base = cmap[ord(upper)]
        name = f'{base}.sc'
        if name not in glyf:
            glyph = small_cap_glyph(font, base)
            glyf[name] = glyph
            hmtx[name] = (round(hmtx[base][0] * SCALE), getattr(glyph, 'xMin', 0))
            order.append(name)
        for table in font['cmap'].tables:
            if table.isUnicode() and cp in table.cmap:
                table.cmap[cp] = name
    font.setGlyphOrder(order)

    postscript = f"{FAMILY.replace(' ', '')}-{style}"
    names = {1: FAMILY, 3: f'{postscript}; derived from Cabin', 4: f'{FAMILY} {style}', 6: postscript, 16: FAMILY}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID]

    out = OUT / f"cabin-small-caps-latin-{'700' if style == 'Bold' else '400'}-normal.woff2"
    font.flavor = 'woff2'
    font.save(out)
    return out


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for style, source_file in STYLES.items():
        print('wrote', make(style, source_file).relative_to(ROOT))
    shutil.copy(SOURCE / 'LICENSE', OUT / 'OFL.txt')
    print('wrote', (OUT / 'OFL.txt').relative_to(ROOT))
