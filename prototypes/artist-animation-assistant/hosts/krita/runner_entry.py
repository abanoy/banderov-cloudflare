"""Original headless native integration probe; REF-KRITA-RUNNER/SOURCE/API/NODE.

Invoked by the installed kritarunner with -s runner_entry -f main <new-output-dir>.
The launcher isolates settings and uses Qt offscreen; no artist files are opened.
"""
import hashlib
import json
from pathlib import Path
import platform
import sys
import traceback

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def main(args):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    verify_ui(ROOT)
    credits = build(check=True)
    out = Path(args[0]).resolve()
    if not out.is_relative_to((ROOT / 'experiments').resolve()):
        raise ValueError('Probe output must be in this project experiments directory')
    out.mkdir(parents=True, exist_ok=False)
    report = {'schema_version': '1.0', 'status': 'running', 'checks': {},
              'evidence_level': 'native Krita API in isolated offscreen process, not interactive UI',
              'source_ids': ['REF-KRITA-RUNNER', 'REF-KRITA-SOURCE', 'REF-KRITA-API', 'REF-KRITA-NODE', 'REF-QT-OFFSCREEN'],
              'component_ids': ['COMP-KRITARUNNER-5-3-2-1', 'COMP-KRITA-5-3-2-1'],
              'credits_snapshot_sha256': credits['snapshot_sha256'],
              'limitations': ['Tiny synthetic U8/sRGB fixture only', 'Expanded exposures may create duplicate native keys', 'No interactive UI, undo/redo, cancellation, artist review or real-art quality acceptance']}
    documents = []
    try:
        from krita import Krita
        from PyQt5.QtCore import QByteArray, QT_VERSION_STR, PYQT_VERSION_STR
        from PyQt5.QtGui import QImage, QColor
        app = Krita.instance()
        report['environment'] = {'krita': app.version(), 'python': sys.version, 'qt': QT_VERSION_STR, 'pyqt': PYQT_VERSION_STR, 'os': platform.platform()}
        # Document::importAnimation at the exact installed revision uses a main
        # window/view internally. Create one in this isolated offscreen process.
        window = app.openWindow()
        if window is None:
            raise RuntimeError('No isolated window available')
        doc = app.createDocument(8, 8, 'AAA native synthetic fixture', 'RGBA', 'U8', 'sRGB-elle-V2-srgbtrc.icc', 72)
        documents.append(doc)
        doc.setBatchmode(True)
        doc.setAutosave(False)
        window.addView(doc)
        doc.setFramesPerSecond(24)
        doc.setFullClipRangeStartTime(0)
        doc.setFullClipRangeEndTime(4)
        group = doc.createNode('Originals', 'grouplayer')
        doc.rootNode().addChildNode(group, None)
        source = doc.createNode('Source ink', 'paintlayer')
        group.addChildNode(source, None)
        raw = bytes([13, 71, 191, 128] * 4)
        if not source.setPixelData(QByteArray(raw), 2, 3, 2, 2):
            raise RuntimeError('setPixelData failed')
        doc.waitForDone()
        source.setLocked(True)
        source_id = str(source.uniqueId())
        before = bytes(source.pixelData(0, 0, 8, 8))
        annotation = b'{"schema_version":"0.1","project_id":"AAA-native","unique_drawings":2,"duration_frames":5}'
        doc.setAnnotation('artist-animation-assistant', 'Synthetic project identity', QByteArray(annotation))
        paths = []
        for index, color in enumerate((QColor(220, 40, 70, 180), QColor(30, 170, 80, 255))):
            image = QImage(8, 8, QImage.Format_ARGB32)
            image.fill(color)
            path = out / (str(index) + '.png')
            if not image.save(str(path)):
                raise RuntimeError('Cannot save synthetic fixture image')
            paths.append(str(path))
        before_ids = {str(n.uniqueId()) for n in doc.rootNode().childNodes()}
        report['checks']['import_success'] = bool(doc.importAnimation([paths[0]] * 2 + [paths[1]] * 3, 0, 1))
        doc.waitForDone()
        layers = [n for n in doc.rootNode().childNodes() if str(n.uniqueId()) not in before_ids and n.animated()]
        if len(layers) != 1:
            raise RuntimeError('Expected one new animated layer, got ' + str(len(layers)))
        layer = layers[0]
        layer.setName('Integration proposals')
        samples = [bytes(layer.pixelDataAtTime(0, 0, 8, 8, i)) for i in range(5)]
        report['checks']['nonempty_frames'] = all(len(sample) == 8 * 8 * 4 for sample in samples)
        report['checks']['nonuniform_exposure_contents'] = len(set(samples)) == 2 and samples[0] == samples[1] and samples[2] == samples[3] == samples[4]
        report['native_key_times'] = [i for i in range(5) if layer.hasKeyframeAtTime(i)]
        report['channel_convention'] = 'Integer RGBA storage is BGRA according to REF-KRITA-NODE; exact raw-byte round trip checked'
        report['source_bounds_before'] = [source.bounds().x(), source.bounds().y(), source.bounds().width(), source.bounds().height()]
        target = out / 'synthetic.kra'
        if not doc.saveAs(str(target)):
            raise RuntimeError('Native saveAs failed')
        reopened = app.openDocument(str(target))
        documents.append(reopened)
        if reopened is None:
            raise RuntimeError('Native reopen failed')
        reopened.setBatchmode(True)
        reopened.setAutosave(False)
        reopened.waitForDone()
        source_after = reopened.nodeByName('Source ink')
        frames_after = reopened.nodeByName('Integration proposals')
        if source_after is None or frames_after is None:
            raise RuntimeError('Reopened layer missing')
        report['checks']['source_pixels_exact'] = bytes(source_after.pixelData(0, 0, 8, 8)) == before
        report['checks']['original_input_bytes_present'] = bytes(source_after.pixelData(2, 3, 2, 2)) == raw
        report['checks']['source_lock_preserved'] = source_after.locked()
        report['checks']['source_group_preserved'] = source_after.parentNode().name() == 'Originals'
        report['checks']['source_id_preserved'] = str(source_after.uniqueId()) == source_id
        report['checks']['annotation_preserved'] = bytes(reopened.annotation('artist-animation-assistant')) == annotation
        report['checks']['all_frames_exact'] = all(bytes(frames_after.pixelDataAtTime(0, 0, 8, 8, i)) == samples[i] for i in range(5))
        report['checks']['dimensions_profile_preserved'] = reopened.width() == 8 and reopened.height() == 8 and reopened.colorProfile() == doc.colorProfile() and reopened.colorDepth() == 'U8'
        report['checks']['fps_clip_range_preserved'] = reopened.framesPerSecond() == 24 and reopened.fullClipRangeStartTime() == 0 and reopened.fullClipRangeEndTime() == 4
        # Edit only the reopened proposal and save to a second NEW file; original
        # layer is checked independently to demonstrate editable storage.
        edit = bytes([90, 20, 10, 255])
        reopened.setCurrentTime(2)
        writable = frames_after.setPixelData(QByteArray(edit), 0, 0, 1, 1)
        reopened.waitForDone()
        edited = out / 'edited-copy.kra'
        report['checks']['proposal_edit_and_save'] = bool(writable) and reopened.saveAs(str(edited))
        edited_doc = app.openDocument(str(edited))
        documents.append(edited_doc)
        edited_doc.waitForDone()
        report['checks']['proposal_edit_persisted'] = bytes(edited_doc.nodeByName('Integration proposals').pixelDataAtTime(0, 0, 1, 1, 2)) == edit
        report['checks']['source_unchanged_after_proposal_edit'] = bytes(edited_doc.nodeByName('Source ink').pixelData(0, 0, 8, 8)) == before
        report['assets'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()}
        report['status'] = 'passed' if all(report['checks'].values()) else 'failed'
    except Exception:
        report['status'] = 'failed'
        report['error'] = traceback.format_exc()
    finally:
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        (out / 'CREDITS.md').write_bytes((ROOT / 'generated/CREDITS.md').read_bytes())
        for doc in reversed(documents):
            if doc is not None:
                try:
                    doc.setModified(False)
                    doc.close()
                except Exception:
                    pass
    print('AAA_PROBE_REPORT=' + json.dumps(report))
