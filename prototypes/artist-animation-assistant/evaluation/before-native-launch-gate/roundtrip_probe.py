"""UNEXECUTED native probe. Run from Krita Scripter after the credits UI gate.

Independently authored against REF-KRITA-API / REF-KRITA-NODE / REF-KRITA-PLUGIN.
This makes NEW synthetic documents and writes only under this project's experiments/.
No active-document edits, user settings changes, model loads, or network requests.
"""
import hashlib
import json
from pathlib import Path
import sys
import traceback

# Scripter may not set __file__. In that case run the saved file with
# exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'), {'__file__': str(path)})
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def run():
    gate = ROOT / "evaluation/credits-ui-acceptance.json"
    if not gate.is_file():
        raise RuntimeError("Complete the offline CREDITS UI gate first; see NEXT_ACTIONS.md")
    proof = json.loads(gate.read_text(encoding="utf-8"))
    if proof.get("viewer_sha256") != hashlib.sha256((ROOT / "generated/viewer.html").read_bytes()).hexdigest() or not all(proof.get(k) for k in ("visible_button", "keyboard_open", "offline_readable", "close_returns_focus")):
        raise RuntimeError("Credits UI evidence is incomplete or stale")
    from krita import Krita
    from PyQt5.QtCore import QByteArray
    from PyQt5.QtGui import QImage, QColor
    app = Krita.instance()
    out = ROOT / "experiments/EXP-0002-native-roundtrip/outputs"
    out.mkdir(parents=True, exist_ok=False)
    report = {"status": "running", "krita_version": app.version(), "source_ids": ["REF-KRITA-API", "REF-KRITA-NODE", "REF-KRITA-PLUGIN"], "checks": {}, "limitations": ["Synthetic RGBA U8 only; no group/mask/vector/high-bit-depth fidelity claim", "Five step-1 imports encode two unique images with redundant native keys", "No undo, cancellation, artist-effort or production-readiness claim"]}
    try:
        doc = app.createDocument(8, 8, "AAA synthetic round-trip probe", "RGBA", "U8", "sRGB-elle-V2-srgbtrc.icc", 72)
        if doc is None:
            raise RuntimeError("createDocument returned no document")
        app.activeWindow().addView(doc)
        layer = doc.createNode("Original synthetic source", "paintlayer")
        doc.rootNode().addChildNode(layer, None)
        # Deliberately asymmetric raw bytes: the test records exact storage rather
        # than claiming a verified RGB channel convention from documentation alone.
        raw = bytes([13, 71, 191, 128] * 64)
        layer.setPixelData(QByteArray(raw), 0, 0, 8, 8)
        layer.setLocked(True)
        before = bytes(layer.pixelData(0, 0, 8, 8))
        annotation = QByteArray(b'{"schema_version":"0.1","project_id":"AAA-native-fixture","unique_drawings":2,"duration_frames":5}')
        doc.setAnnotation("artist-animation-assistant", "Synthetic probe identity", annotation)
        image_paths = []
        for index, color in enumerate((QColor(220, 40, 70, 180), QColor(30, 170, 80, 255))):
            image = QImage(8, 8, QImage.Format_ARGB32)
            image.fill(color)
            path = out / (str(index) + ".png")
            if not image.save(str(path)):
                raise RuntimeError("PNG fixture creation failed")
            image_paths.append(str(path))
        ids_before = {str(n.uniqueId()) for n in doc.rootNode().childNodes()}
        imported = doc.importAnimation([image_paths[0]] * 2 + [image_paths[1]] * 3, 0, 1)
        doc.waitForDone()
        report["checks"]["import_returned_true"] = bool(imported)
        new_layers = [n for n in doc.rootNode().childNodes() if str(n.uniqueId()) not in ids_before]
        animated = [n for n in new_layers if n.animated()]
        if len(animated) != 1:
            raise RuntimeError("Expected exactly one new animated layer; got " + str(len(animated)))
        animated[0].setName("Integration proposals (expanded exposures)")
        samples = [bytes(animated[0].pixelDataAtTime(0, 0, 8, 8, i)) for i in range(5)]
        report["checks"]["two_unique_drawings_five_slots"] = len(set(samples)) == 2 and samples[0] == samples[1] and samples[2] == samples[3] == samples[4]
        report["native_key_times"] = [i for i in range(5) if animated[0].hasKeyframeAtTime(i)]
        target = out / "synthetic.kra"
        if not doc.saveAs(str(target)):
            raise RuntimeError("Native saveAs failed")
        reopened = app.openDocument(str(target))
        if reopened is None:
            raise RuntimeError("Native reopen failed")
        reopened.waitForDone()
        app.activeWindow().addView(reopened)
        source_after = reopened.nodeByName("Original synthetic source")
        frames_after = reopened.nodeByName("Integration proposals (expanded exposures)")
        report["checks"]["source_raw_pixels_preserved"] = bytes(source_after.pixelData(0, 0, 8, 8)) == before
        report["checks"]["source_lock_preserved"] = source_after.locked()
        report["checks"]["annotation_preserved"] = bytes(reopened.annotation("artist-animation-assistant")) == bytes(annotation)
        report["checks"]["all_frame_pixels_preserved"] = all(bytes(frames_after.pixelDataAtTime(0, 0, 8, 8, i)) == samples[i] for i in range(5))
        report["checks"]["dimensions_preserved"] = reopened.width() == 8 and reopened.height() == 8
        report["status"] = "passed" if all(report["checks"].values()) else "failed"
    except Exception:
        report["status"] = "failed"
        report["error"] = traceback.format_exc()
    finally:
        (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    run()
