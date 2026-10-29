"""Regression for the reported first-paint obstacle, with image-byte preservation."""
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.batch_roundtrip import write_ora
from scripts.fix_fixture_selection import select_fixture_proposal, layers


class SelectionTests(unittest.TestCase):
    def test_new_ora_selects_only_visible_proposal(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'fixture.ora'
            pixels = [[10, 40, 90, 180]] * 64
            write_ora(path, pixels, pixels)
            with zipfile.ZipFile(path) as archive:
                root = ET.fromstring(archive.read('stack.xml'))
            selected = [n for n in root.iter() if n.get('selected') == 'true']
            self.assertEqual(len(selected), 1)
            self.assertEqual(selected[0].get('name'), 'Integration proposal')
            self.assertEqual(selected[0].get('visibility'), 'visible')
            self.assertEqual(root.find('./stack/stack').get('visibility'), 'hidden')

    def test_native_diagnostic_copy_preserves_image_members(self):
        with tempfile.TemporaryDirectory() as directory:
            source, destination = Path(directory) / 'saved.kra', Path(directory) / 'copy.kra'
            xml = b'<?xml version="1.0"?><DOC><IMAGE><layers><layer name="Integration proposal" nodetype="paintlayer" visible="1" locked="0"/><layer name="Originals" nodetype="grouplayer" visible="0" selected="true"/></layers></IMAGE></DOC>'
            with zipfile.ZipFile(source, 'x') as archive:
                archive.writestr('mimetype', 'application/x-krita')
                archive.writestr('maindoc.xml', xml)
                archive.writestr('Unnamed/layers/layer2', b'original diagnostic pixel payload\x00\x01')
            before = source.read_bytes()
            report = select_fixture_proposal(source, destination)
            self.assertEqual(source.read_bytes(), before)
            self.assertEqual(report['selected_before'], ['Originals'])
            self.assertEqual(report['selected_after'], ['Integration proposal'])
            self.assertTrue(report['image_bytes_preserved'])
            with self.assertRaisesRegex(ValueError, 'NEW'):
                select_fixture_proposal(source, source)
            with self.assertRaisesRegex(ValueError, 'NEW'):
                select_fixture_proposal(source, destination)
