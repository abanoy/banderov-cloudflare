"""Meaningful persistence/race/constraint tests for the portable worker boundary."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.project import create, fingerprint
from engine.jobs import create_job, execute, request_cancel, apply_result, read, atomic_write


class JobTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name) / 'job-01'
        self.project = create([[30, 80, 120, 180], [0, 0, 0, 0]] * 8, 4, 4, 12)

    def test_separate_worker_save_reopen_and_apply(self):
        before = deepcopy(self.project)
        create_job(self.project, 'source', 1, 0, self.directory)
        process = subprocess.run([sys.executable, str(ROOT / 'scripts/worker.py'), '--job', str(self.directory)], cwd=ROOT, capture_output=True, text=True, timeout=15)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(read(self.directory / 'job.json')['history'], ['created', 'validating', 'queued', 'running', 'completed'])
        result = apply_result(self.project, self.directory, 'proposal', 'accepted')
        self.assertEqual(self.project, before)
        self.assertEqual(result['originals'], before['originals'])
        self.assertEqual(result['exposures'], before['exposures'])
        self.assertEqual(result['revision'], 1)
        target = Path(self.tmp.name) / 'saved.json'
        atomic_write(target, result)
        self.assertEqual(read(target), result)

    def test_cancel_before_execution_has_no_result(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        self.assertTrue(request_cancel(self.directory))
        self.assertEqual(execute(self.directory)['state'], 'cancelled')
        self.assertFalse((self.directory / 'result.json').exists())
        self.assertFalse((self.directory / 'worker.lock').exists())

    def test_controlled_mid_operation_cancel(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        def cancel_after_two_rows(row):
            if row == 2:
                request_cancel(self.directory)
        self.assertEqual(execute(self.directory, row_hook=cancel_after_two_rows)['state'], 'cancelled')
        self.assertFalse((self.directory / 'result.json').exists())

    def test_newer_input_rejects_completed_result(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        execute(self.directory)
        changed = deepcopy(self.project)
        changed['layers']['ink']['name'] = 'Artist renamed while running'
        with self.assertRaisesRegex(ValueError, 'Stale'):
            apply_result(changed, self.directory, 'proposal', 'accepted')

    def test_corrupt_worker_result_and_snapshot_are_rejected(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        execute(self.directory)
        result = read(self.directory / 'result.json')
        result['pixels'][0] = [255, 1, 1, 255]
        result['output_sha256'] = fingerprint(result['pixels'])
        atomic_write(self.directory / 'result.json', result)
        with self.assertRaisesRegex(ValueError, 'violates'):
            apply_result(self.project, self.directory, 'proposal', 'accepted')

    def test_only_one_worker_can_own_a_job(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        (self.directory / 'worker.lock').touch()
        with self.assertRaises(FileExistsError):
            execute(self.directory)
        self.assertEqual(read(self.directory / 'job.json')['state'], 'created')

    def test_replay_preserves_completed_job(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        execute(self.directory)
        before = (self.directory / 'job.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'already started'):
            execute(self.directory)
        self.assertEqual((self.directory / 'job.json').read_bytes(), before)

    def test_worker_cannot_change_requested_parameters(self):
        create_job(self.project, 'source', 1, 0, self.directory)
        execute(self.directory)
        result = read(self.directory / 'result.json')
        result['settings']['dx'] = 3
        atomic_write(self.directory / 'result.json', result)
        with self.assertRaisesRegex(ValueError, 'requested operation'):
            apply_result(self.project, self.directory, 'proposal', 'accepted')


if __name__ == '__main__':
    unittest.main(verbosity=2)
