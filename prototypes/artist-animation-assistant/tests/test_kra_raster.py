import base64
from copy import deepcopy
import hashlib
import io
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

from engine.io.kra_raster import import_kra, decode_tiles, unlzf
from engine.layers import render, source_over
from hosts.standalone.session import Session
from scripts.batch_roundtrip import decode_fixture_png

ROOT = Path(__file__).resolve().parents[1]
ACTUAL = ROOT/'experiments/EXP-0005-editable-selection/outputs/gui-roundtrip-selected-proposal.kra'


class NativeRasterTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)

    def rewrite(self, mutate):
        with zipfile.ZipFile(ACTUAL) as source:
            members = {n:source.read(n) for n in source.namelist()}
        mutate(members)
        path = self.directory/'modeled.kra'
        with zipfile.ZipFile(path, 'w') as output:
            for name, content in members.items():
                output.writestr(name, content)
        return path

    def test_actual_kra_layers_match_original_ora_pixels_and_merged_projection(self):
        before = hashlib.sha256(ACTUAL.read_bytes()).hexdigest()
        project = import_kra(ACTUAL)
        self.assertEqual(len(project['layers']), 3)
        self.assertEqual(len(project['drawings']), 2)
        self.assertEqual(project['shot']['duration_frames'], 101)
        with zipfile.ZipFile(ROOT/'experiments/EXP-0004-native-batch/outputs/input.ora') as ora:
            stack = ET.fromstring(ora.read('stack.xml'))
            expected = {n.get('name'):decode_fixture_png(ora.read(n.get('src')))[2] for n in stack.iter('layer')}
        for e in project['exposures']:
            self.assertEqual(project['drawings'][e['drawing_id']]['pixels'], expected[project['layers'][e['layer_id']]['name']])
        with zipfile.ZipFile(ACTUAL) as archive:
            self.assertEqual(render(project, 0), decode_fixture_png(archive.read('mergedimage.png'))[2])
        self.assertEqual(hashlib.sha256(base64.b64decode(project['native_source']['archive_base64'])).hexdigest(), before)
        self.assertEqual(hashlib.sha256(ACTUAL.read_bytes()).hexdigest(), before)

    def test_actual_native_import_edit_save_reopen_preserves_hidden_group_and_archive(self):
        session = Session(import_kra(ACTUAL))
        originals = deepcopy(session.project['originals'])
        source = session.project['native_source']['archive_base64']
        group = next(i for i,l in session.project['layers'].items() if l['nodetype'] == 'grouplayer')
        self.assertFalse(session.project['layers'][group]['visible'])
        session.correct({0:[12,34,56,78]})
        session.save(self.directory/'edited.aaa.json')
        reopened = Session.load(self.directory/'edited.aaa.json')
        self.assertEqual(reopened.project, session.project)
        self.assertEqual(reopened.project['originals'], originals)
        self.assertEqual(reopened.project['native_source']['archive_base64'], source)
        self.assertFalse(reopened.project['layers'][group]['visible'])

    def test_raw_bgra_channels_offsets_and_outside_content(self):
        tile = bytearray(16384)
        tile[:4] = bytes([56,34,12,78])
        data = b'VERSION 2\nTILEWIDTH 64\nTILEHEIGHT 64\nPIXELSIZE 4\nDATA 1\n0,0,LZF,16385\n\0' + tile
        self.assertEqual(decode_tiles(data, 2, 2, (1, 1))[3], [12,34,56,78])
        with self.assertRaisesRegex(ValueError, 'off-canvas'):
            decode_tiles(data, 2, 2, (-1, 0))
        with self.assertRaisesRegex(ValueError, 'Trailing'):
            decode_tiles(data+b'bad', 2, 2)

    def test_lzf_overlap_and_malformed_bounds(self):
        self.assertEqual(unlzf(bytes([0,65,224,0,0]), 10), b'A'*10)
        for data, size in [(bytes([0,65,224,0,0]),9), (b'\x20\0',3), (b'\x02x',3), (b'\xe0',9)]:
            with self.assertRaises(ValueError):
                unlzf(data,size)

    def test_modeled_animation_has_two_keys_and_nonuniform_holds(self):
        def modify(members):
            root = ET.fromstring(members['maindoc.xml'])
            layer = next(n for n in root.iter() if n.tag.endswith('layer') and n.get('filename') == 'layer2')
            layer.set('keyframes','layer2.frames.xml')
            for n in root.iter():
                if n.tag.endswith('range'):
                    n.set('from','0'); n.set('to','11')
            members['maindoc.xml'] = ET.tostring(root)
            members['Unnamed/layers/layer2.frames.xml'] = b'<keyframes><channel name="content"><keyframe time="0" frame="layer2"><offset x="0" y="0"/></keyframe><keyframe time="4" frame="layer2.f1"><offset x="0" y="0"/></keyframe></channel></keyframes>'
            members['Unnamed/layers/layer2.f1'] = members['Unnamed/layers/layer4']
            members['Unnamed/layers/layer2.f1.defaultpixel'] = b'\0'*4
        project = import_kra(self.rewrite(modify))
        identity = next(i for i,l in project['layers'].items() if l['name'] == 'Integration proposal')
        self.assertEqual([(e['start'],e['length']) for e in project['exposures'] if e['layer_id'] == identity], [(0,4),(4,8)])
        self.assertNotEqual(render(project,0),render(project,4))
        self.assertEqual(len(project['drawings']),3)

    def test_unsupported_masks_profile_and_corruption_fail(self):
        def mask(m):
            m['maindoc.xml'] = m['maindoc.xml'].replace(b'nodetype="paintlayer"',b'nodetype="transparencymask"',1)
        def profile(m):
            m['Unnamed/annotations/icc'] = b'not the supported ICC profile'
        def corrupt(m):
            m['Unnamed/layers/layer2'] = b'bad payload'
        def mimetype(m):
            m['mimetype'] = b'application/not-krita'
        for mutation, message in [(mask,'Masks/non-raster'),(profile,'profile'),(corrupt,'native tile'),(mimetype,'mimetype')]:
            with self.assertRaisesRegex(ValueError,message):
                import_kra(self.rewrite(mutation))

    def test_retained_native_archive_tamper_rejected(self):
        project = import_kra(ACTUAL)
        project['native_source']['archive_base64'] = base64.b64encode(b'changed archive').decode('ascii')
        with self.assertRaisesRegex(ValueError, 'archive identity changed'):
            Session(project)

    def test_source_over_fractional_alpha(self):
        self.assertEqual(source_over([[255,0,0,255]],[[0,0,255,128]])[0], [127,0,128,255])
        self.assertEqual(source_over([[0,0,0,0]],[[12,34,56,78]])[0], [12,34,56,78])
        self.assertEqual(source_over([[12,34,56,78]],[[1,2,3,255]],0)[0], [12,34,56,78])
