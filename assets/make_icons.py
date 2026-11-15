"""Generate 行囊 app icons (cream suitcase + orange check on warm gradient)."""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "icons")
SIZE = 1024
SS = 2
W = SIZE * SS

CREAM = (255, 248, 238, 255)
CREAM_DARK = (255, 235, 213, 255)
ORANGE = (235, 77, 0, 255)
ORANGE_BRIGHT = (255, 108, 18, 255)


def background(size: int) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / float(size)
    t = np.clip(0.64 * x + 0.36 * y, 0.0, 1.0)[..., None]
    c1 = np.array([255, 162, 65], dtype=np.float32)
    c2 = np.array([236, 73, 0], dtype=np.float32)
    rgb = c1 * (1.0 - t) + c2 * t
    glow = np.exp(-(((x - 0.84) ** 2 + (y - 0.06) ** 2) / 0.055))[..., None]
    rgb = rgb + glow * np.array([34, 32, 18], dtype=np.float32)
    shade = np.clip((x * 0.35 + y * 0.65) - 0.55, 0, 1)[..., None]
    rgb = rgb - shade * np.array([22, 26, 30], dtype=np.float32)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def add_background_decoration(img: Image.Image) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = W / 1024.0
    d.ellipse((760 * s, -210 * s, 1320 * s, 350 * s), fill=(255, 255, 255, 20))
    d.ellipse((830 * s, -140 * s, 1250 * s, 280 * s), outline=(255, 255, 255, 30), width=int(3 * s))
    d.ellipse((-260 * s, 720 * s, 350 * s, 1330 * s), fill=(255, 255, 255, 10))
    d.ellipse((-160 * s, 800 * s, 290 * s, 1250 * s), outline=(255, 255, 255, 28), width=int(2 * s))
    d.ellipse((760 * s, 790 * s, 980 * s, 1010 * s), fill=(255, 255, 255, 10))
    img.alpha_composite(layer)


def foreground() -> Image.Image:
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    s = W / 1024.0
    d = ImageDraw.Draw(layer)

    # Soft drop shadow
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (248 * s, 372 * s, 776 * s, 790 * s), radius=86 * s, fill=(91, 26, 0, 110)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(36 * s))
    layer.alpha_composite(shadow)

    # Handle
    d.arc(
        (382 * s, 274 * s, 642 * s, 546 * s),
        start=180,
        end=360,
        fill=CREAM,
        width=int(44 * s),
    )

    # Suitcase body
    d.rounded_rectangle(
        (246 * s, 350 * s, 778 * s, 756 * s),
        radius=84 * s,
        fill=CREAM,
    )
    # Slight warm edge at the bottom
    d.rounded_rectangle(
        (246 * s, 698 * s, 778 * s, 756 * s),
        radius=84 * s,
        fill=CREAM_DARK,
    )
    d.rounded_rectangle(
        (246 * s, 350 * s, 778 * s, 716 * s),
        radius=84 * s,
        fill=CREAM,
    )

    # Top highlight
    d.rounded_rectangle(
        (282 * s, 372 * s, 742 * s, 402 * s),
        radius=15 * s,
        fill=(255, 255, 255, 150),
    )

    # Two little seams for a suitcase feel
    seam = (255, 229, 202, 255)
    d.line((454 * s, 420 * s, 454 * s, 464 * s), fill=seam, width=int(13 * s))
    d.line((570 * s, 420 * s, 570 * s, 464 * s), fill=seam, width=int(13 * s))

    # Check mark
    points = [(388 * s, 576 * s), (472 * s, 660 * s), (662 * s, 462 * s)]
    d.line(points, fill=ORANGE, width=int(58 * s), joint="curve")
    for point in (points[0], points[-1]):
        d.ellipse(
            (point[0] - 29 * s, point[1] - 29 * s, point[0] + 29 * s, point[1] + 29 * s),
            fill=ORANGE,
        )
    d.line(points, fill=ORANGE_BRIGHT, width=int(38 * s), joint="curve")
    for point in (points[0], points[-1]):
        d.ellipse(
            (point[0] - 19 * s, point[1] - 19 * s, point[0] + 19 * s, point[1] + 19 * s),
            fill=ORANGE_BRIGHT,
        )

    # Feet
    d.rounded_rectangle((322 * s, 742 * s, 376 * s, 808 * s), radius=26 * s, fill=CREAM)
    d.rounded_rectangle((648 * s, 742 * s, 702 * s, 808 * s), radius=26 * s, fill=CREAM)

    return layer


def make_icon(maskable: bool = False) -> Image.Image:
    img = background(W)
    add_background_decoration(img)
    fg = foreground()
    if maskable:
        scale = 0.78
        resized = fg.resize((int(W * scale), int(W * scale)), Image.Resampling.LANCZOS)
        offset = ((W - resized.width) // 2, (W - resized.height) // 2)
        canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        canvas.alpha_composite(resized, offset)
        fg = canvas
    img.alpha_composite(fg)
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def save(img: Image.Image, name: str, size: int) -> None:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    path = os.path.join(OUT, name)
    resized.save(path, "PNG", optimize=True)
    print(f"wrote {path} ({size}x{size})")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    normal = make_icon(False)
    maskable = make_icon(True)
    save(normal, "icon-512.png", 512)
    save(normal, "icon-192.png", 192)
    save(maskable, "icon-maskable-512.png", 512)
    save(normal, "apple-touch-icon.png", 180)
    save(normal, "favicon-64.png", 64)


if __name__ == "__main__":
    main()
