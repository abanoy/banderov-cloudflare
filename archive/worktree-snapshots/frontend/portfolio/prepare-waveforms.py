"""Derive decorative RMS waveforms from intact portfolio audio; preserve sources."""
from pathlib import Path
from array import array
import json
import math
import shutil
import subprocess

assets = Path(__file__).resolve().parent / 'assets'
ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    raise SystemExit('Existing ffmpeg is required; no installation is performed.')
metadata = {}
for name in ('title', 'cognition'):
    result = subprocess.run([ffmpeg, '-v', 'error', '-i', str(assets / f'{name}.mp3'),
                             '-f', 'f32le', '-ac', '1', '-ar', '8000', 'pipe:1'],
                            check=True, capture_output=True)
    samples = array('f')
    samples.frombytes(result.stdout)
    if not samples:
        raise ValueError(f'{name}: no decoded samples')
    count = 96
    bins = []
    for index in range(count):
        segment = samples[len(samples) * index // count:len(samples) * (index + 1) // count]
        bins.append(math.sqrt(sum(value * value for value in segment) / len(segment)))
    peak = max(bins)
    lines = []
    for index, value in enumerate(bins):
        x = 4 + index * 632 / (count - 1)
        amplitude = value / peak * 28 if peak else 0
        lines.append(f'<path d="M{x:.2f} {32-amplitude:.2f}V{32+amplitude:.2f}"/>')
    # Fill the CSS visualizer surface while preserving relative RMS amplitudes.
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 64" preserveAspectRatio="none"><g stroke="black" stroke-width="4" stroke-linecap="round">' + ''.join(lines) + '</g></svg>\n'
    (assets / f'{name}-waveform.svg').write_text(svg, encoding='utf-8')
    metadata[name] = {'decoded_seconds': round(len(samples) / 8000, 3), 'sample_rate': 8000,
                      'bins': count, 'measure': 'mono RMS, normalized per track'}
    print(f'{name}: {metadata[name]["decoded_seconds"]} seconds, {count} RMS bins')
(assets / 'music-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
