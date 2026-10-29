from pathlib import Path
from copy import deepcopy
import tempfile,time,unittest
from tests.test_joint_motion import fixture
from engine import joint_motion as joint
from hosts.standalone.session import Session
from hosts.standalone.joint_jobs import JointJobs,merge_prepared
from engine.project import fingerprint


def wait(controller):
    controller.join(30)
    if controller.busy:raise AssertionError('Joint task did not finish')
    result=controller.poll()
    if result is None:raise AssertionError('Missing joint result')
    return result


class JointJobsTests(unittest.TestCase):
    def test_status_write_failure_is_delivered_without_changing_document(self):
        from unittest.mock import patch
        import hosts.standalone.joint_jobs as module
        p,settings=fixture();before=fingerprint(p);write=module.atomic_write
        def fail_status(path,value):
            if Path(path).name=='status.json':raise OSError('Synthetic disk failure')
            return write(path,value)
        with tempfile.TemporaryDirectory() as td,patch.object(module,'atomic_write',fail_status):
            jobs=JointJobs(td);jobs.start('generate',p,settings);event=wait(jobs)
            self.assertEqual(event['state'],'failed');self.assertIn('persist task status',event['error']);self.assertEqual(fingerprint(p),before)

    def test_comparison_detail_bounds_and_context_cache_are_distinct(self):
        from hosts.standalone.joint_jobs import comparison_frames
        from engine.io.png_codec import read_png
        p,settings=fixture();p['motion_guides']['move']['trajectories']={'a':[dict(end_progress=1,control1=[18,0],control2=[24,0],end=[26.5,18.5])]}
        ticks=[];frames=comparison_frames(p,p,settings,lambda:ticks.append(True))
        self.assertEqual(frames['detail_rectangle'],(0,0,46,44));self.assertEqual(frames['source'],frames['proposed']);self.assertEqual(frames['source_detail'],frames['proposed_detail'])
        self.assertNotEqual(frames['source'][0],frames['source_detail'][0]);self.assertEqual(len(frames['source_detail']),8);self.assertGreater(len(ticks),24)
        self.assertEqual(read_png(frames['source_detail'][0],packed=True)[:2],(271,260))

    def test_three_way_keeps_mapping_order_independent_layers_and_history(self):
        base=dict(layers={'z':dict(order=0),'a':dict(order=0)},exposures=[dict(layer_id='z',drawing_id='old',start=0),dict(layer_id='a',drawing_id='other',start=0)],drawings={'old':1,'other':2},history=[],revision=0)
        after=deepcopy(base);after['exposures'][0]['drawing_id']='new';after['drawings']['new']=3;after['history'].append(dict(action='joint'));after['motion_operations']=[dict(operation_id='joint')];after['revision']=2
        current=deepcopy(base);current['exposures'][1]['drawing_id']='painted';current['drawings']['painted']=4;current['history'].append(dict(action='paint'));current['motion_operations']=[dict(operation_id='other')];current['revision']=1
        merged=merge_prepared(base,after,current);self.assertEqual(list(merged['layers']),['z','a']);self.assertEqual({r['layer_id']:r['drawing_id'] for r in merged['exposures']},{'z':'new','a':'painted'});self.assertEqual(merged['history'],[dict(action='paint'),dict(action='joint')]);self.assertEqual(len(merged['motion_operations']),2);self.assertEqual(merged['revision'],1)
        current['drawings']['old']=99;after['drawings']['old']=88
        with self.assertRaises(ValueError):merge_prepared(base,after,current)

    def test_background_generate_preview_prepare_and_cancel_do_not_commit(self):
        p,settings=fixture();original=fingerprint(p)
        with tempfile.TemporaryDirectory() as td:
            jobs=JointJobs(td);jobs.start('generate',p,settings,token='document');event=wait(jobs);self.assertEqual(event['state'],'ready',event.get('error'));result=event['result']
            jobs.start('preview',p,result=result,choice='sampled_change',token='document');preview=wait(jobs);self.assertEqual(preview['state'],'ready',preview.get('error'));self.assertEqual(len(preview['frames']['source']),8);self.assertEqual(len(preview['frames']['proposed']),8);self.assertTrue(Path(preview['preview_path']).is_file())
            jobs.start('accept',p,result=result,choice='sampled_change',token='document');prepared=wait(jobs);self.assertEqual(prepared['state'],'ready',prepared.get('error'));self.assertEqual(joint.subject(p,settings),prepared['scope']);self.assertEqual(fingerprint(p),original)
            session=Session(p);session.commit(merge_prepared(prepared['base'],prepared['prepared'],session.project),'review');session.travel();self.assertEqual(session.project['drawings'],p['drawings'])
            jobs.start('generate',p,settings);jobs.cancel();cancelled=wait(jobs);self.assertEqual(cancelled['state'],'cancelled');self.assertEqual(fingerprint(p),original)


if __name__=='__main__':unittest.main()
