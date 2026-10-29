"""Encode the local Seven Sips capture losslessly; preserve the original PNG."""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parent / "assets"
source = assets / "seven-sips-opening.png"
target = assets / "seven-sips-opening.webp"
with Image.open(source) as image:
    original = image.convert("RGBA")
if not target.exists():
    original.save(target, "WEBP", lossless=True, exact=True, method=6)
with Image.open(target) as image:
    assert image.size == original.size
    assert image.convert("RGBA").tobytes() == original.tobytes()
print(f"{source.stat().st_size} -> {target.stat().st_size} bytes; identical RGBA pixels")
