from copy import deepcopy
import tempfile
from pathlib import Path
import unittest
import zlib
import struct
import binascii

from engine.project import fingerprint, propose_translation, accept
from engine.jobs import create_job, execute
from hosts.standalone.session import Session, demo
from hosts.standalone.png_io import read_png
from scripts.batch_roundtrip import png


class StandaloneTests(unittest.TestCase):
    def setUp(self):
        self.session = Session(demo())
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def test_correction_undo_redo_and_reopen_preserve_sources_alpha_and_holds(self):
        original = deepcopy(self.session.project['originals'])
        self.session.correct({0: [80, 90, 100, 37]})
        corrected = deepcopy(self.session.project['drawings'][self.session.drawing_id()])
        self.assertTrue(corrected['locked'])
        self.assertEqual(corrected['origin'], 'artist_correction')
        self.assertTrue(self.session.travel())
        self.assertEqual(self.session.drawing_id(), 'source')
        self.assertTrue(self.session.travel(False))
        self.assertEqual(self.session.project['drawings'][self.session.drawing_id()], corrected)
        self.session.save(self.directory / 'roundtrip.aaa.json')
        reopened = Session.load(self.directory / 'roundtrip.aaa.json')
        self.assertEqual(reopened.project, self.session.project)
        self.assertEqual(reopened.project['originals'], original)
        self.assertEqual([e['length'] for e in reopened.project['exposures']], [4, 8])

    def test_move_cut_preserves_duration_and_undo(self):
        self.session.hold(6)
        self.assertEqual([(e['start'], e['length']) for e in self.session.project['exposures']], [(0, 6), (6, 6)])
        self.assertEqual(self.session.project['shot']['duration_frames'], 12)
        self.session.travel()
        self.assertEqual([e['length'] for e in self.session.project['exposures']], [4, 8])
        with self.assertRaises(ValueError):
            self.session.hold(12)

    def test_completed_job_explicit_apply_then_undo_rejects_old_result(self):
        directory = self.directory / 'job'
        create_job(self.session.project, 'source', 1, 0, directory)
        execute(directory)
        before = fingerprint(self.session.project['originals'])
        self.session.apply(directory)
        self.assertEqual(fingerprint(self.session.project['originals']), before)
        self.assertTrue(self.session.travel())
        with self.assertRaisesRegex(ValueError, 'Stale|Selected drawing changed'):
            self.session.apply(directory)

    def test_edit_during_job_makes_result_stale(self):
        directory = self.directory / 'job'
        create_job(self.session.project, 'source', 1, 0, directory)
        execute(directory)
        self.session.correct({2: [1, 2, 3, 4]})
        with self.assertRaisesRegex(ValueError, 'Stale|Selected drawing changed'):
            self.session.apply(directory)

    def test_unexposed_layer_is_explicitly_rejected(self):
        project = demo()
        project['layers']['extra'] = {'name': 'Extra'}
        with self.assertRaisesRegex(ValueError, 'full exposure coverage'):
            Session(project)

    def test_blank_gaps_are_explicitly_rejected(self):
        project = demo()
        project['exposures'][0]['length'] = 3
        with self.assertRaisesRegex(ValueError, 'full exposure coverage'):
            Session(project)

    def test_png_alpha_and_decompression_bomb_bound(self):
        project = self.session.project
        data = png(64, 64, project['drawings']['source']['pixels'])
        self.assertEqual(read_png(data)[2], project['drawings']['source']['pixels'])
        def chunk(kind, payload):
            return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', binascii.crc32(kind + payload) & 0xffffffff)
        attack = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'0' * 100000)) + chunk(b'IEND', b'')
        with self.assertRaisesRegex(ValueError, 'decompression'):
            read_png(attack)
