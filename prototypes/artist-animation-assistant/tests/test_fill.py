from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from engine.fill import propose, defaults, accept_fill, FillCancelled
from engine.jobs import create_fill_job, execute, apply_fill_result, read, atomic_write, request_cancel
from engine.layers import render,source_over
from engine.project import create,fingerprint
from hosts.standalone.session import Session


def fixture(gap=False, paper=False, hole=False):
    size=15
    pixels=[[255,255,255,255] if paper else [0,0,0,0] for _ in range(size*size)]
    for y in range(3,12):
        for x in range(3,12):
            if x in {3,11} or y in {3,11}:
                pixels[y*size+x]=[20,30,40,255]
    if gap:
        pixels[3*size+7]=[255,255,255,255] if paper else [0,0,0,0]
    if hole:
        for y in range(6,9):
            for x in range(6,9):
                if x in {6,8} or y in {6,8}:
                    pixels[y*size+x]=[20,30,40,255]
    return create(pixels,size,size,12)


class FillTests(unittest.TestCase):
    def result(self, project, **changes):
        settings=defaults([5,5],[70,130,220,255])
        settings.update(changes)
        return propose(project['drawings']['source']['pixels'],15,15,settings)

    def test_closed_region_exact_ground_truth_and_originals(self):
        project=fixture()
        original=deepcopy(project)
        result=self.result(project)
        expected={y*15+x for y in range(4,11) for x in range(4,11)}
        self.assertEqual(set(result['region']),expected)
        self.assertEqual(result['ink'],project['drawings']['source']['pixels'])
        self.assertEqual(project,original)
        self.assertFalse(result['metrics']['touches_edge'])

    def test_gap_leak_then_invisible_closure(self):
        project=fixture(gap=True)
        leaked=self.result(project)
        closed=self.result(project,gap_radius=1)
        self.assertTrue(leaked['metrics']['touches_edge'])
        self.assertFalse(closed['metrics']['touches_edge'])
        self.assertIn(3*15+7,closed['added_barriers'])
        self.assertEqual(closed['ink'],leaked['ink'])
        self.assertEqual(closed['fill'][3*15+7],[0,0,0,0])
        self.assertTrue(closed['warnings'])

    def test_keep_open_overrides_closure_without_erasing_ink(self):
        project=fixture(gap=True)
        result=self.result(project,gap_radius=1,keep_open=[3*15+7])
        self.assertTrue(result['metrics']['touches_edge'])
        self.assertNotIn(3*15+7,result['boundary'])

    def test_manual_barrier_prevents_leak_without_closing_other_openings(self):
        project=fixture(gap=True)
        result=self.result(project,add_barriers=[3*15+7])
        self.assertFalse(result['metrics']['touches_edge'])
        self.assertEqual(result['added_barriers'],[52])

    def test_hole_and_small_noise_not_silently_filled_or_removed(self):
        project=fixture(hole=True)
        project['drawings']['source']['pixels'][5*15+6]=[40,40,40,255]
        result=self.result(project)
        self.assertNotIn(7*15+7,result['region'])
        self.assertNotIn(5*15+6,result['region'])
        self.assertEqual(result['ink'][5*15+6],[40,40,40,255])

    def test_white_paper_factorization_recomposes_exact_source(self):
        pixels=[[r,g,b,255] for r in range(0,256,17) for g in range(0,256,17) for b in range(0,256,17)]
        # 4096 samples; add a white seed in the first pixel.
        pixels[0]=[255,255,255,255]
        result=propose(pixels,64,64,dict(defaults([0,0],[70,130,220,255]),paper='white'))
        white=[[255,255,255,255] for _ in pixels]
        self.assertEqual(source_over(white,result['ink']),pixels)
        self.assertTrue(any('underdetermined' in w for w in result['warnings']))

    def test_antialias_overlap_only_beneath_real_ink(self):
        project=fixture()
        project['drawings']['source']['pixels'][3*15+6]=[30,40,70,80]
        result=self.result(project)
        self.assertEqual(result['fill'][3*15+6],[70,130,220,255])
        self.assertEqual(result['fill'][2*15+6],[0,0,0,0])
        self.assertEqual(result['ink'][3*15+6],[30,40,70,80])

    def test_invalid_inputs_and_seed_on_boundary(self):
        for changes in [dict(seed=[3,3]),dict(gap_radius=3),dict(seed=[-1,5]),dict(keep_open=[1,1]),dict(add_barriers=[1],keep_open=[1])]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):
                self.result(fixture(),**changes)
        with self.assertRaises(ValueError):
            self.result(fixture(),paper='white')

    def test_structured_accept_preserves_locked_source_other_holds_and_layers(self):
        project=fixture()
        project['drawings']['other']=deepcopy(project['drawings']['source'])
        project['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=5),dict(layer_id='ink',drawing_id='other',start=5,length=7)]
        project['layers']['second']=dict(name='Hidden unrelated',visible=False)
        project['exposures'].append(dict(layer_id='second',drawing_id='source',start=0,length=12))
        original=deepcopy(project)
        updated,layer=accept_fill(project,self.result(project),'ink',0,'fill-test')
        self.assertEqual(project,original)
        self.assertEqual(updated['originals'],project['originals'])
        self.assertEqual(updated['drawings']['source'],project['drawings']['source'])
        self.assertEqual(updated['exposures'][:3],project['exposures'])
        self.assertEqual(render(updated,6),render(project,6))
        self.assertEqual(render(updated,0)[5*15+5],[70,130,220,255])
        self.assertEqual(updated['fill_regions']['fill-test']['palette_id'],'fill_main')
        self.assertEqual(layer,'fill-test-fill')

    def test_worker_cancel_stale_tamper_replay_and_session_undo(self):
        project=fixture()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'job'
            create_fill_job(project,'source','ink',0,defaults([5,5],[70,130,220,255]),path)
            self.assertEqual(execute(path)['state'],'completed')
            result=read(path/'result.json')
            changed=deepcopy(result)
            changed['fill_result']['boundary']=[]
            changed['fill_sha256']=fingerprint(changed['fill_result'])
            atomic_write(path/'result.json',changed)
            with self.assertRaises(ValueError): apply_fill_result(project,path,'tampered')
            atomic_write(path/'result.json',result)
            stale=deepcopy(project)
            stale['revision']+=1
            with self.assertRaises(ValueError): apply_fill_result(stale,path,'stale')
            session=Session(project)
            session.apply(path)
            self.assertIn(session.layer_id,session.project['layers'])
            session.travel()
            self.assertEqual(session.project['drawings'],project['drawings'])
            self.assertIn(session.layer_id,session.project['layers'])
            with self.assertRaises(ValueError): session.apply(path)
            cancel=Path(directory)/'cancel'
            create_fill_job(project,'source','ink',0,defaults([5,5],[70,130,220,255]),cancel)
            request_cancel(cancel)
            self.assertEqual(execute(cancel)['state'],'cancelled')
            self.assertFalse((cancel/'result.json').exists())

    def test_mid_operation_cancel_and_palette_conflict(self):
        with self.assertRaises(FillCancelled):
            propose(fixture()['drawings']['source']['pixels'],15,15,defaults([5,5],[1,2,3,255]),lambda: (_ for _ in ()).throw(FillCancelled()))
        project=fixture()
        project['palettes']={'fill_main':dict(rgba=[1,2,3,255],color_profile='sRGB')}
        with self.assertRaises(ValueError): accept_fill(project,self.result(project),'ink',0,'conflict')


if __name__=='__main__':
    unittest.main()
