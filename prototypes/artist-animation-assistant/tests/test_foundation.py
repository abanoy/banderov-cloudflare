"""Engineering invariant checks on original synthetic grids, not model evaluation."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine.project import create, validate, fingerprint, propose_translation, accept, correct_and_lock, reject
from scripts import credits


class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.p = create([[0, 0, 0, 0], [20, 40, 80, 128], [0, 0, 0, 0], [0, 0, 0, 255]], 2, 2, 12)

    def test_originals_and_alpha_survive_proposal(self):
        before = deepcopy(self.p)
        out = propose_translation(self.p, "p1", "source", 0, 0)
        self.assertEqual(before, self.p)
        self.assertEqual(out["proposals"]["p1"]["pixels"], self.p["drawings"]["source"]["pixels"])
        self.assertEqual(out["originals"], self.p["originals"])

    def test_unique_drawings_are_separate_from_exposure_time(self):
        self.assertEqual(len(self.p["drawings"]), 1)
        self.assertEqual(self.p["exposures"][0]["length"], 12)
        self.assertEqual(validate(json.loads(json.dumps(self.p))), self.p)

    def test_locked_or_approved_replacement_rejected(self):
        p = propose_translation(self.p, "p1", "source", 0, 0)
        with self.assertRaisesRegex(ValueError, "locked or approved"):
            accept(p, "p1", "new", replace_id="source")
        self.assertEqual(self.p["revision"], 0)

    def test_stale_result_cannot_commit(self):
        p = propose_translation(self.p, "p1", "source", 0, 0)
        p["revision"] += 1
        with self.assertRaisesRegex(ValueError, "Stale"):
            accept(p, "p1", "new")

    def test_edited_input_without_revision_is_detected(self):
        p = propose_translation(self.p, "p1", "source", 0, 0)
        p["drawings"]["source"]["pixels"][0] = [5, 5, 5, 255]
        with self.assertRaisesRegex(ValueError, "Stale"):
            accept(p, "p1", "new")

    def test_correction_lock_and_neighbor_regeneration(self):
        p = accept(propose_translation(self.p, "p1", "source", 0, 0), "p1", "accepted")
        old = deepcopy(p["drawings"]["accepted"])
        pixels = deepcopy(old["pixels"])
        pixels[0] = [90, 20, 10, 255]
        p = correct_and_lock(p, "accepted", "corrected", pixels)
        before = deepcopy(p["drawings"]["corrected"])
        out = propose_translation(p, "p2", "corrected", -1, 0)
        self.assertEqual(out["drawings"]["corrected"], before)
        self.assertEqual(out["drawings"]["accepted"], old)
        self.assertEqual(out["originals_sha256"], self.p["originals_sha256"])

    def test_rejection_preserves_duration_and_history(self):
        p = reject(propose_translation(self.p, "p1", "source", 1, 0), "p1")
        self.assertEqual(p["shot"], self.p["shot"])
        self.assertEqual(p["exposures"], self.p["exposures"])
        with self.assertRaisesRegex(ValueError, "reused"):
            propose_translation(p, "p1", "source", 0, 0)

    def test_bad_exposure_and_mutated_snapshot_rejected(self):
        p = deepcopy(self.p)
        p["exposures"][0]["length"] = 13
        with self.assertRaisesRegex(ValueError, "outside"):
            validate(p)
        p = deepcopy(self.p)
        p["originals"]["source"]["pixels"][0][0] = 1
        with self.assertRaisesRegex(ValueError, "snapshot"):
            validate(p)

    def test_unknown_schema_and_alpha_conversion_rejected(self):
        p = deepcopy(self.p)
        p["schema_version"] = "999"
        with self.assertRaisesRegex(ValueError, "schema"):
            validate(p)
        p = deepcopy(self.p)
        p["canvas"]["alpha_mode"] = "premultiplied"
        with self.assertRaisesRegex(ValueError, "straight-alpha"):
            validate(p)


class CreditsTests(unittest.TestCase):
    def test_deterministic_generated_files_current(self):
        self.assertEqual(credits.build(check=True), credits.load())

    def test_dangling_reference_fails_closed(self):
        original_read = credits.read
        def broken(path):
            value = original_read(path)
            if path.endswith("feature_uses.json"):
                value["uses"][0]["source_ids"].append("REF-MISSING")
            return value
        with patch.object(credits, "read", broken), self.assertRaisesRegex(ValueError, "Unresolved"):
            credits.load()

    def test_distribution_without_audit_fails_closed(self):
        original_read = credits.read
        def broken(path):
            value = original_read(path)
            if path.endswith("components.json"):
                value["components"][0]["distribution_allowed"] = True
            return value
        with patch.object(credits, "read", broken), self.assertRaisesRegex(ValueError, "Distribution"):
            credits.load()

    def test_private_artwork_has_honest_citation_without_public_url(self):
        data=credits.load();row=next(s for s in data['sources'] if s['source_id']=='REF-OWNER-PRIVATE-SAMPLES')
        self.assertIsNone(row['canonical_url']);self.assertIsNone(row['free_access_url']);self.assertIn('Unpublished artwork',row['apa_reference'])
        original_read=credits.read
        for field,value in [('permission_state','permitted_distribution'),('canonical_url','https://example.com/invented'),('apa_override','')]:
            def broken(path):
                data=original_read(path)
                if path.endswith('sources.json'):
                    row=next(s for s in data['sources'] if s['source_id']=='REF-OWNER-PRIVATE-SAMPLES');row[field]=value
                return data
            with patch.object(credits,'read',broken),self.assertRaisesRegex(ValueError,'Private artwork'):credits.load()

    def test_static_offline_shell_contract(self):
        html = (ROOT / "generated/viewer.html").read_text(encoding="utf-8")
        self.assertIn('>CREDITS</button>', html)
        self.assertIn("dialog.showModal()", html)
        self.assertIn("connect-src 'none'", html)
        self.assertNotIn("fetch(", html)
        self.assertNotIn("<script src=", html)
        self.assertNotIn("__CREDITS_DATA__", html)
        # This is a static contract check, not a native UI/offline browser test.


if __name__ == "__main__":
    unittest.main(verbosity=2)
