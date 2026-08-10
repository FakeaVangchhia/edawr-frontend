"""Generate the eDawr rider-app icons without any imaging dependency.

Pillow is not installed and adding it just to draw four flat images would be a
build dependency for something that runs once. PNG is a simple enough container
to write directly: IHDR, one zlib-compressed IDAT with a filter byte per
scanline, IEND, each with a CRC32.

The mark is a lightning bolt on the brand gradient — speed, which is the entire
proposition of a 15-minute delivery app.
"""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets"

BRAND_TOP = (46, 16, 101)     # #2e1065
BRAND_BOTTOM = (109, 40, 217)  # #6d28d9
WHITE = (255, 255, 255)

# A lightning bolt in a unit square, y increasing downwards.
BOLT = [
    (0.58, 0.04),
    (0.24, 0.56),
    (0.44, 0.56),
    (0.38, 0.96),
    (0.76, 0.42),
    (0.54, 0.42),
]


def point_in_polygon(x, y, polygon):
    """Ray casting. Good enough for one convex-ish shape."""
    inside = False
    count = len(polygon)
    j = count - 1
    for i in range(count):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y):
            if x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
        j = i
    return inside


def write_png(path, width, height, pixels):
    """pixels: flat bytearray of RGBA rows."""
    raw = bytearray()
    stride = width * 4
    for row in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(pixels[row * stride : (row + 1) * stride])

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def render(size, *, background, bolt_scale, bolt_colour):
    """background=None gives a transparent canvas.

    The bolt is supersampled 3x3 so its diagonals do not look like staircases
    at the sizes a launcher actually renders.
    """
    pixels = bytearray(size * size * 4)
    samples = 3
    inset = (1.0 - bolt_scale) / 2.0

    for y in range(size):
        if background is None:
            row_colour = None
        else:
            t = y / max(size - 1, 1)
            row_colour = tuple(
                round(background[0][c] + (background[1][c] - background[0][c]) * t)
                for c in range(3)
            )

        for x in range(size):
            offset = (y * size + x) * 4

            if row_colour is not None:
                pixels[offset] = row_colour[0]
                pixels[offset + 1] = row_colour[1]
                pixels[offset + 2] = row_colour[2]
                pixels[offset + 3] = 255

            hits = 0
            for sy in range(samples):
                for sx in range(samples):
                    ux = (x + (sx + 0.5) / samples) / size
                    uy = (y + (sy + 0.5) / samples) / size
                    bx = (ux - inset) / bolt_scale
                    by = (uy - inset) / bolt_scale
                    if 0.0 <= bx <= 1.0 and 0.0 <= by <= 1.0 and point_in_polygon(bx, by, BOLT):
                        hits += 1

            if hits:
                alpha = hits / (samples * samples)
                for c in range(3):
                    existing = pixels[offset + c] if row_colour is not None else bolt_colour[c]
                    pixels[offset + c] = round(existing * (1 - alpha) + bolt_colour[c] * alpha)
                pixels[offset + 3] = max(pixels[offset + 3], round(255 * alpha))

    return pixels


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    gradient = (BRAND_TOP, BRAND_BOTTOM)

    jobs = [
        # Store icon: full bleed, bolt at 62% so it breathes inside the squircle
        # iOS and Android both crop it into.
        ("icon.png", 1024, gradient, 0.62),
        # Android adaptive foreground: the outer 33% can be masked away, so the
        # mark has to sit well inside the safe zone.
        ("adaptive-icon.png", 1024, gradient, 0.44),
        # Splash: transparent, drawn on the backgroundColor set in app.json.
        ("splash-icon.png", 1024, None, 0.58),
        ("favicon.png", 64, gradient, 0.62),
    ]

    for name, size, background, scale in jobs:
        colour = WHITE
        pixels = render(size, background=background, bolt_scale=scale, bolt_colour=colour)
        write_png(OUT / name, size, size, pixels)
        print(f"  {name}  {size}x{size}  {(OUT / name).stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
