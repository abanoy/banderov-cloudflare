"""Original integration fixture; deliberately gated on a real credits UI check."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.project import create, propose_translation, accept, correct_and_lock, reject, validate
from scripts.credits import build


def run(output):
    from scripts.provenance_gate import verify_ui
    verify_ui(ROOT)
    data = build(check=True)
    if output.exists():
        raise SystemExit("Use a new output directory; historical fixture runs are immutable")
    output.mkdir(parents=True)
    for duration, name in [(1, "still"), (12, "shot")]:
        pixels = [[0, 0, 0, 0] for _ in range(64)]
        for i in (18, 19, 20, 26, 34, 35, 36):
            pixels[i] = [25, 45, 80, 255]
        p = create(pixels, 8, 8, duration)
        p = accept(propose_translation(p, "proposal-1", "source", 1, 0), "proposal-1", "accepted-1")
        # Explicit exposure editing belongs to the host; this fixture records a supported schedule.
        if duration > 1:
            p["exposures"] = [{"drawing_id": "source", "layer_id": "ink", "start": 0, "length": 4}, {"drawing_id": "accepted-1", "layer_id": "ink", "start": 4, "length": 8}]
        correction = [pixel[:] for pixel in p["drawings"]["accepted-1"]["pixels"]]
        correction[28] = [180, 40, 30, 255]
        p = correct_and_lock(p, "accepted-1", "corrected-1", correction)
        p = reject(propose_translation(p, "proposal-2", "corrected-1", 0, 1), "proposal-2")
        validate(p)
        (output / (name + ".json")).write_text(json.dumps(p, indent=2) + "\n", encoding="utf-8")
    (output / "run.json").write_text(json.dumps({"schema_version": "0.1", "method": "Original integer-translation integration baseline", "source_ids": ["REF-PYTHON"], "component_ids": ["COMP-PYTHON-3-13-1"], "credits_snapshot_sha256": data["snapshot_sha256"], "input_provenance": "Synthetic 8x8 grids authored in scripts/run_fixture.py; no external artwork", "seed": None, "quality_claim": "No semantic motion, artist-effort or native-host claim"}, indent=2), encoding="utf-8")
    (output / "CREDITS.md").write_bytes((ROOT / "generated/CREDITS.md").read_bytes())
    print(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--credits", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.credits:
        print((ROOT / "generated/CREDITS.md").read_text(encoding="utf-8"))
    elif args.output:
        run(args.output)
    else:
        parser.error("--output or --credits required")
