"""Create lossless display encodings; original PNGs remain the archival files.

Run with an existing Pillow installation. No resizing, cropping, or pixel edits.
Every derivative must decode to exactly the original RGBA pixels.
"""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parent / "assets"
for name in ["archive-art-3", "archive-art-1", "don-bass-cover", "don-bass-screen", "crusaders-turns"]:
    source = assets / f"{name}.png"
    target = assets / f"{name}.webp"
    with Image.open(source) as image:
        original = image.convert("RGBA")
        original.save(target, "WEBP", lossless=True, exact=True, method=6)
    with Image.open(target) as image:
        assert image.convert("RGBA").tobytes() == original.tobytes(), f"Pixel mismatch: {name}"
        assert image.size == original.size, f"Dimension mismatch: {name}"
    saved = 1 - target.stat().st_size / source.stat().st_size
    print(f"{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes ({saved:.1%} saved), identical RGBA pixels")
