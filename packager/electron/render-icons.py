#!/usr/bin/env python3
"""Regenerate the icons in icons/ from packager/flatpak/peergos.svg.

Development only, like the GTK host's --render-icon was: it needs GdkPixbuf to
rasterise the SVG and Pillow to write the PNGs, and neither is present in the
flatpak build. The PNGs it produces are committed, so the build just installs
them.

The tray icon is the Peergos logo with a sync-state dot badged into the corner,
in the same place and the same colours the GTK host drew it, so the tray looks
unchanged across the port. There is an icon for the no-pairs state too: with no
sync pairs there is no dot, but the icon itself must stay, since it is the only
way back into a hidden window and the only way to quit.

    ./render-icons.py
"""
import os
import sys

import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, os.pardir, "flatpak", "peergos.svg")
OUT = os.path.join(HERE, "icons")

TRAY_SIZE = 44
WINDOW_SIZE = 512
DOT_RADIUS = 10.0
# drawn at 4x and shrunk, which is how we get a smooth edge without doing the
# blending by hand as the GTK host had to
SUPERSAMPLE = 4

DOT_COLOURS = {
    "synced": (0x2E, 0xA0, 0x43),
    "syncing": (0xDB, 0x8A, 0x0F),
    "error": (0xDA, 0x36, 0x33),
    "idle": None,
}


def rasterise(size):
    """The logo as a square RGBA image, letterboxed if the SVG is not square."""
    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(SVG, size, size)
    if not pixbuf.get_has_alpha():
        pixbuf = pixbuf.add_alpha(False, 0, 0, 0)
    width, height = pixbuf.get_width(), pixbuf.get_height()
    stride = pixbuf.get_rowstride()
    raw = bytes(pixbuf.get_pixels())
    rows = b"".join(raw[y * stride:y * stride + width * 4] for y in range(height))
    logo = Image.frombytes("RGBA", (width, height), rows)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(logo, ((size - width) // 2, (size - height) // 2))
    return canvas


def with_dot(logo, colour):
    """Blend the dot, ringed in white for contrast, into the bottom right."""
    if colour is None:
        return logo
    scale = SUPERSAMPLE
    overlay = Image.new("RGBA", (TRAY_SIZE * scale, TRAY_SIZE * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    centre = (TRAY_SIZE - DOT_RADIUS - 1) * scale
    for radius, fill in ((DOT_RADIUS * scale, (0xFF, 0xFF, 0xFF, 0xFF)),
                         (DOT_RADIUS * 0.72 * scale, colour + (0xFF,))):
        draw.ellipse([centre - radius, centre - radius, centre + radius, centre + radius],
                     fill=fill)
    badged = logo.copy()
    badged.alpha_composite(overlay.resize((TRAY_SIZE, TRAY_SIZE), Image.LANCZOS))
    return badged


def main():
    os.makedirs(OUT, exist_ok=True)
    logo = rasterise(TRAY_SIZE)
    for state, colour in DOT_COLOURS.items():
        path = os.path.join(OUT, "tray-" + state + ".png")
        with_dot(logo, colour).save(path)
        print("wrote " + path)
    path = os.path.join(OUT, "peergos.png")
    rasterise(WINDOW_SIZE).save(path)
    print("wrote " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
