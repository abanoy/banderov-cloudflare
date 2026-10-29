from pathlib import Path
from copy import deepcopy
import tempfile,unittest,threading,time,json
from unittest.mock import patch
import numpy as np
from hosts.standalone.native_jobs import NativeJobs
from hosts.standalone.session import Session
from engine.io.kra_window import KraWindow
from engine.native_effects import render
from engine.project import fingerprint
from engine.io.png_codec import read_png
from tests.test_kra_window import fixture
from tests.test_native_effects import source_with_style

class NativeJobTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.jobs=NativeJobs(self.root/'work');self.addCleanup(self.stop)
    def stop(self):self.jobs.cancel();self.jobs.join(10)
    def finish(self):
        self.jobs.join(10);self.assertFalse(self.jobs.busy);result=self.jobs.poll();self.assertIsNotNone(result);return result
    def project(self):
        path=fixture(self.root/'input.kra')
        with KraWindow(path) as source:return source_with_style(source.import_window(0,7))
    def test_index_import_source_identity_and_separate_editable_roundtrip(self):
        path=fixture(self.root/'input.kra');before=path.read_bytes();self.jobs.start('index',dict(path=str(path)),('document',0));result=self.finish();self.assertEqual(result['state'],'ready');index=result['result']['index'];self.assertEqual(index['width'],130)
        directory=self.jobs.start('import',dict(path=str(path),source_sha256=index['source']['sha256'],start=2,end=7,layers=['top'],mode='strict'),('document',0));result=self.finish();self.assertEqual(result['state'],'ready');self.assertEqual(result['token'],('document',0));p=result['result']['session'].project;self.assertEqual(Session.load(directory/'window.aaa').project,p);self.assertEqual(path.read_bytes(),before)
        manifest=json.loads(next((directory/'provenance/runs').glob('*.json')).read_text());self.assertEqual(manifest['state'],'ready');self.assertFalse(manifest['execution']['network_allowed']);self.assertIn('window.aaa',manifest['outputs_sha256'])
    def test_changed_archive_after_index_refuses_and_retains_failure(self):
        path=fixture(self.root/'input.kra');self.jobs.start('index',dict(path=str(path)));index=self.finish()['result']['index']
        fixture(path,padding=1)
        directory=self.jobs.start('import',dict(path=str(path),source_sha256=index['source']['sha256'],start=0,end=7,layers=['top'],mode='strict'));result=self.finish();self.assertEqual(result['state'],'failed');self.assertIn('changed after indexing',result['error']);self.assertFalse((directory/'window.aaa').exists())
    def test_effects_snapshot_worker_thread_view_sampling_and_cache(self):
        p=self.project();before=deepcopy(p);calls=[];caller=threading.get_ident()
        def run(*args,**kwargs):calls.append(threading.get_ident());return render(*args,**kwargs)
        with patch('engine.native_effects.render',side_effect=run):
            self.jobs.start('effects',dict(project=p,slot=0,view=[0,0,130,90,65,45]),('view',1));one=self.finish();self.assertEqual(one['state'],'ready');self.assertFalse(one['result']['cache_hit']);self.assertEqual(len(calls),1);self.assertNotEqual(calls[0],caller)
            self.jobs.start('effects',dict(project=p,slot=0,view=[0,0,65,45,65,45]),('view',2));two=self.finish();self.assertTrue(two['result']['cache_hit']);self.assertEqual(len(calls),1)
        w,h,pixels=read_png(two['result']['png'],packed=True);expected=np.frombuffer(render(p,0)[2],np.uint8).reshape(90,130,4)[:45,:65].tobytes();self.assertEqual((w,h,pixels.region_bytes()),(65,45,expected));self.assertEqual(p,before)
    def test_cooperative_cancel_and_single_active_task_do_not_return_ready(self):
        p=self.project();entered=threading.Event();release=threading.Event()
        def slow(project,slot,params,checkpoint):
            entered.set();release.wait(5);checkpoint();return render(project,slot,params,checkpoint)
        with patch('engine.native_effects.render',side_effect=slow):
            self.jobs.start('effects',dict(project=p,slot=0,view=[0,0,130,90,65,45]));self.assertTrue(entered.wait(3))
            with self.assertRaisesRegex(ValueError,'still running'):self.jobs.start('index',dict(path='unused'))
            self.jobs.cancel();release.set();result=self.finish();self.assertEqual(result['state'],'cancelled');self.assertNotIn('result',result)
    def test_input_is_immutable_snapshot_and_undo_revision_is_distinct(self):
        p=self.project();initial=fingerprint(p);s=Session(p);entered=threading.Event();release=threading.Event()
        def slow(project,slot,params,checkpoint):entered.set();release.wait(5);return render(project,slot,params,checkpoint)
        with patch('engine.native_effects.render',side_effect=slow):
            self.jobs.start('effects',dict(project=s.project,slot=0,view=[0,0,130,90,65,45]));self.assertTrue(entered.wait(3));s.layer_id='top';s.correct({0:[1,2,3,4]});s.travel();release.set();result=self.finish()
        self.assertEqual(result['result']['input_fingerprint'],initial);self.assertNotEqual(fingerprint(s.project),initial)
    def test_background_project_open_save_roundtrip(self):
        p=self.project();target=self.root/'saved.aaa';self.jobs.start('save',dict(project=p,path=str(target)));saved=self.finish();self.assertEqual(saved['state'],'ready');self.assertEqual(saved['result']['input_fingerprint'],fingerprint(p))
        self.jobs.start('open',dict(path=str(target)));opened=self.finish();self.assertEqual(opened['state'],'ready');self.assertEqual(opened['result']['session'].project,p)
    def test_cancelled_save_keeps_existing_destination_and_removes_own_staging(self):
        p=self.project();target=self.root/'saved.aaa';Session(p).save(target);before=target.read_bytes();entered=threading.Event();release=threading.Event();original=Session.save
        def held(session,path):original(session,path);entered.set();release.wait(5)
        with patch.object(Session,'save',held):
            self.jobs.start('save',dict(project=p,path=str(target)));self.assertTrue(entered.wait(3));self.jobs.cancel();release.set();result=self.finish()
        self.assertEqual(result['state'],'cancelled');self.assertEqual(target.read_bytes(),before);self.assertFalse(list(self.root.glob('.artist-save-*')))
    def test_save_does_not_overwrite_changed_destination_or_original_native_archive(self):
        p=self.project();target=self.root/'saved.aaa';Session(p).save(target);entered=threading.Event();release=threading.Event();original=Session.save
        def held(session,path):original(session,path);entered.set();release.wait(5)
        with patch.object(Session,'save',held):
            self.jobs.start('save',dict(project=p,path=str(target)));self.assertTrue(entered.wait(3));changed=target.read_bytes()+b'changed elsewhere';target.write_bytes(changed);release.set();result=self.finish()
        self.assertEqual(result['state'],'failed');self.assertEqual(target.read_bytes(),changed)
        path=fixture(self.root/'original-native.aaa');before=path.read_bytes()
        with KraWindow(path) as source:q=source.import_window(0,7)
        self.jobs.start('save',dict(project=q,path=str(path)));result=self.finish();self.assertEqual(result['state'],'failed');self.assertIn('Original native archive',result['error']);self.assertEqual(path.read_bytes(),before)
    def test_project_snapshot_is_shared_across_slots_and_tamper_refuses_reuse(self):
        p=self.project();self.jobs.start('effects',dict(project=p,slot=0,view=[0,0,130,90,65,45]));one=self.finish();self.jobs.start('effects',dict(project=p,slot=1,view=[0,0,130,90,65,45]));two=self.finish()
        self.assertEqual(one['result']['input_project'],two['result']['input_project']);snapshot=Path(one['result']['input_project']['path']);snapshot.write_bytes(snapshot.read_bytes()+b'changed')
        self.jobs.start('effects',dict(project=p,slot=2,view=[0,0,130,90,65,45]));result=self.finish();self.assertEqual(result['state'],'failed');self.assertIn('snapshot changed',result['error'])
    def test_record_write_error_still_finishes_with_failed_event(self):
        with patch('hosts.standalone.native_jobs.atomic_write',side_effect=OSError('test disk failure')):
            self.jobs.start('index',dict(path='not-opened'));result=self.finish()
        self.assertEqual(result['state'],'failed');self.assertIn('record write failed',result['error'])

if __name__=='__main__':unittest.main()
