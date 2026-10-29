"""Create resized display derivatives; never overwrite original images."""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parent / 'assets'
for name in ('don-bass-cover', 'don-bass-screen'):
    with Image.open(assets / f'{name}.png') as original:
        for width in (640, 960):
            height = round(original.height * width / original.width)
            derivative = original.resize((width, height), Image.Resampling.LANCZOS)
            output = assets / f'{name}-{width}.webp'
            derivative.save(output, 'WEBP', lossless=True, method=6)
            print(f'{output.name}: {width}x{height}, {output.stat().st_size} bytes')
