"""A reported UI check must not silently authorize changed UI behavior."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.provenance_gate import verify_ui


class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for relative in ['evaluation/credits-ui-acceptance.json', 'evaluation/credits-ui-accepted/viewer.html', 'viewer/template.html', 'generated/viewer.html']:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)

        template=(ROOT/'experiments/EXP-0026-owner-sample-studies/preimages/viewer/template.html').read_text(encoding='utf-8')
        (self.root/'viewer/template.html').write_bytes(template.encode('utf-8'))
        payload=(ROOT/'generated/credits.json').read_text(encoding='utf-8').replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
        (self.root/'generated/viewer.html').write_bytes(template.replace('__CREDITS_DATA__',payload).encode('utf-8'))

    def test_user_report_accepts_only_unchanged_shell(self):
        proof = verify_ui(self.root)
        self.assertEqual(proof['evidence_kind'], 'user_reported')
        viewer = self.root / 'generated/viewer.html'
        viewer.write_text(viewer.read_text(encoding='utf-8').replace('dialog.showModal()', 'dialog.close()'), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'behavior changed'):
            verify_ui(self.root)

    def test_missing_check_and_changed_template_rejected(self):
        gate = self.root / 'evaluation/credits-ui-acceptance.json'
        proof = json.loads(gate.read_text(encoding='utf-8'))
        proof['offline_readable'] = False
        gate.write_text(json.dumps(proof), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            verify_ui(self.root)
        proof['offline_readable'] = True
        gate.write_text(json.dumps(proof), encoding='utf-8')
        with (self.root / 'viewer/template.html').open('a', encoding='utf-8') as stream:
            stream.write('changed shell')
        with self.assertRaisesRegex(ValueError, 'template changed'):
            verify_ui(self.root)


class NativeLineageTests(unittest.TestCase):
    def test_joint_addon_tamper_and_missing_binding_refuse(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof['extension']['files'].values()):
                dst=root/item['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],dst)
            path=root/'evaluation/standalone-credits-lineage.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(proof));verify_ui(root)
            addon=root/proof['extension']['files']['joint_panel']['path'];before=addon.read_bytes();addon.write_bytes(before+b'\n# changed joint interface\n')
            with self.assertRaisesRegex(ValueError,'evidence changed: joint_panel'):verify_ui(root)
            addon.write_bytes(before)
            for role in ('joint_panel','joint_compare','joint_jobs','learned_panel','learned_jobs','learned_schedule_jobs','candidate_editor','rebind_panel','rebind_jobs','rebind_compare'):proof['extension']['files'].pop(role)
            path.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'Joint extension evidence is missing'):verify_ui(root)

    def test_selected_host_proof_does_not_claim_new_browser_acceptance(self):
        from scripts.provenance_gate import verify_viewer_ui
        self.assertEqual(verify_ui(ROOT)['evidence_kind'],'automated_native_lineage')
        with self.assertRaisesRegex(ValueError,'template changed'):verify_viewer_ui(ROOT)

    def test_native_evidence_and_current_source_changes_fail_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof.get('extension',{}).get('files',{}).values()):
                dst=root/item['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],dst)
            path=root/'evaluation/standalone-credits-lineage.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(proof))
            self.assertEqual(verify_ui(root)['host'],'standalone')
            app=root/proof['files']['current_app']['path'];app.write_bytes(app.read_bytes()+b'\n# changed source\n')
            with self.assertRaisesRegex(ValueError,'evidence changed'):verify_ui(root)

    def test_extension_source_tamper_and_missing_selected_proof_refuse(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);proof=json.loads((ROOT/'evaluation/standalone-credits-lineage.json').read_text())
            for item in list(proof['files'].values())+list(proof['extension']['files'].values()):
                dst=root/item['path'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],dst)
            path=root/'evaluation/standalone-credits-lineage.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(proof));verify_ui(root)
            host=root/proof['extension']['files']['host']['path'];before=host.read_bytes();host.write_bytes(before+b'\n# changed extension\n')
            with self.assertRaisesRegex(ValueError,'extension credits evidence changed'):verify_ui(root)
            host.write_bytes(before);proof.pop('extension');path.write_text(json.dumps(proof))
            with self.assertRaisesRegex(ValueError,'extension evidence is missing'):verify_ui(root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
