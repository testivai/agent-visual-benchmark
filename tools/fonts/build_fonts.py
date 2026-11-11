#!/usr/bin/env python3
"""Builds the app's web font and the re-exported copy one task swaps in.

Source: Figtree variable (latin subset), SIL Open Font License 1.1, from the
npm package @fontsource-variable/figtree@5.3.0. Both outputs are renamed
"Acme Sans" inside the file, so they are modified versions under a new name.

  acme-sans.woff2            the font the app ships: same outlines, renamed
  acme-sans-reexport.woff2   the same design re-exported at a different
                             units-per-em: outlines are rounded to a new grid,
                             so glyph edges move by a fraction of a pixel

Usage:  python3 tools/fonts/build_fonts.py <figtree-latin-wght-normal.woff2> <out-dir>
Needs:  pip install fonttools brotli
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem

FAMILY = "Acme Sans"


def rename(font):
    names = {1: FAMILY, 3: f"{FAMILY} Variable", 4: FAMILY, 6: "AcmeSans", 16: FAMILY}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID]


def build(src, out, upem=None):
    font = TTFont(src)
    rename(font)
    if upem:
        scale_upem(font, upem)
    font.flavor = "woff2"
    font.save(out)
    return font["head"].unitsPerEm


if __name__ == "__main__":
    src, out_dir = sys.argv[1], sys.argv[2]
    base = TTFont(src)["head"].unitsPerEm
    print("source units per em:", base)
    print("acme-sans.woff2:", build(src, f"{out_dir}/acme-sans.woff2"))
    print("acme-sans-reexport.woff2:", build(src, f"{out_dir}/acme-sans-reexport.woff2", upem=1000 if base != 1000 else 2048))
