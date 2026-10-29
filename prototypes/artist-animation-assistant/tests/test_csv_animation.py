"""Wire-format and read-only-audit regressions; modeled XML is not native execution."""
from copy import deepcopy
import csv
import hashlib
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.project import create, propose_translation, accept
from engine.io.krita_csv import export_animation, inspect_interchange
from engine.io.kra_timing_audit import audit_native
from scripts.batch_roundtrip import png, decode_fixture_png


class AnimationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.project = create([[30, 110, 210, 180], [0, 0, 0, 0]] * 8, 4, 4, 12)
        self.project['layers']['ink']['name'] = 'Integration proposals'
        self.project = accept(propose_translation(self.project, 'translate', 'source', 1, 0), 'translate', 'pose-b')
        self.project['exposures'] = [{'layer_id': 'ink', 'drawing_id': 'source', 'start': 0, 'length': 4}, {'layer_id': 'ink', 'drawing_id': 'pose-b', 'start': 4, 'length': 8}]

    def export(self):
        return export_animation(self.project, self.directory / 'bundle', png)

    def modeled_native(self, times=(0, 4), fps='24', end=11, missing=False):
        path = self.directory / ('modeled-' + str(len(list(self.directory.glob('*.zip')))) + '.zip')
        document = f'<DOC><IMAGE name="Unnamed" width="4" height="4" colorspacename="RGBA" profile="sRGB-elle-V2-srgbtrc.icc"><layers><layer name="Integration proposals" nodetype="paintlayer" locked="0" visible="1" selected="true" uuid="fixture-uuid" keyframes="layer2.keyframes.xml"/></layers><animation><framerate value="{fps}"/><range from="0" to="{end}"/></animation></IMAGE></DOC>'
        frames = '<keyframes><channel name="content">' + ''.join(f'<keyframe time="{t}" frame="layer2.f{i}"><offset x="0" y="0"/></keyframe>' for i, t in enumerate(times)) + '</channel></keyframes>'
        with zipfile.ZipFile(path, 'x') as archive:
            archive.writestr('maindoc.xml', document)
            archive.writestr('Unnamed/layers/layer2.keyframes.xml', frames)
            for index in range(len(times)):
                if not missing or index == 0:
                    archive.writestr(f'Unnamed/layers/layer2.f{index}', b'MODELED PAYLOAD, NOT KRITA PIXELS ' + bytes([index]))
        return path

    def test_two_images_twelve_slots_and_alpha_preserved_in_input(self):
        before = deepcopy(self.project)
        manifest = self.export()
        report = inspect_interchange(self.directory / 'bundle')
        self.assertEqual(report['unique_image_files'], 2)
        self.assertEqual(report['playback_slots'], 12)
        self.assertEqual(report['expected_key_times'], [0, 4])
        self.assertEqual(report['exposure_lengths'], [4, 8])
        self.assertEqual(self.project, before)
        for drawing_id, asset in manifest['assets'].items():
            self.assertEqual(decode_fixture_png((self.directory / 'bundle/timing.frames' / asset['file']).read_bytes())[2], self.project['drawings'][drawing_id]['pixels'])
        self.assertEqual(json.loads((self.directory / 'bundle/project.json').read_text()), self.project)

    def test_fractional_fps_and_gaps_fail_before_writing(self):
        self.project['shot']['fps'] = {'numerator': 24000, 'denominator': 1001}
        with self.assertRaisesRegex(ValueError, 'integer fps'):
            self.export()
        self.assertFalse((self.directory / 'bundle').exists())
        self.project['shot']['fps'] = {'numerator': 24, 'denominator': 1}
        self.project['exposures'][1]['length'] = 7
        with self.assertRaisesRegex(ValueError, 'coverage'):
            self.export()

    def test_groups_are_not_silently_flattened(self):
        self.project['layers']['ink']['parent_id'] = 'group'
        with self.assertRaisesRegex(ValueError, 'Unsupported layer properties'):
            self.export()

    def test_quoted_labels_and_newline_rejection(self):
        label = 'Ink, "Щит"'
        self.project['layers']['ink']['name'] = label
        self.export()
        with (self.directory / 'bundle/timing.csv').open(encoding='utf-8', newline='') as stream:
            self.assertEqual(next(row for row in csv.reader(stream) if row and row[0] == '#Layers')[1], label)
        self.project['layers']['ink']['name'] = 'bad\nlabel'
        with self.assertRaisesRegex(ValueError, 'controls/newlines'):
            export_animation(self.project, self.directory / 'other', png)

    def test_modified_asset_is_detected(self):
        manifest = self.export()
        asset = next(iter(manifest['assets'].values()))
        (self.directory / 'bundle/timing.frames' / asset['file']).write_bytes(b'changed fixture')
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            inspect_interchange(self.directory / 'bundle')

    def test_modeled_native_timing_audit_is_read_only(self):
        expected = self.export()
        path = self.modeled_native()
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        report = audit_native(path, expected)
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['key_times'], [0, 4])
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), before)
        self.assertIn('Pixel/alpha equality', report['remaining'][0])

    def test_modeled_wrong_timing_and_fractional_fps_fail(self):
        expected = self.export()
        self.assertFalse(audit_native(self.modeled_native(times=(0, 5)), expected)['checks']['exact_key_times'])
        self.assertFalse(audit_native(self.modeled_native(fps='24.5'), expected)['checks']['integer_fps'])
        self.assertFalse(audit_native(self.modeled_native(end=12), expected)['checks']['clip_range'])

    def test_missing_native_pixel_member_cannot_pass(self):
        expected = self.export()
        with self.assertRaises(KeyError):
            audit_native(self.modeled_native(missing=True), expected)

    def test_cli_malformed_native_saves_failure_report(self):
        self.export()
        bad = self.directory / 'malformed.kra'
        bad.write_bytes(b'Not a native ZIP archive')
        report = self.directory / 'audit.json'
        run = subprocess.run([sys.executable, str(ROOT / 'scripts/audit_kra_animation.py'), '--input', str(bad), '--expect', str(self.directory / 'bundle/interchange.json'), '--report', str(report)], cwd=ROOT, capture_output=True, text=True, timeout=15)
        self.assertEqual(run.returncode, 1)
        self.assertEqual(json.loads(report.read_text())['status'], 'failed')
        self.assertEqual(bad.read_bytes(), b'Not a native ZIP archive')
