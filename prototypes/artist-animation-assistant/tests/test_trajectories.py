from copy import deepcopy
from pathlib import Path
import tempfile,unittest
import numpy as np
from engine.trajectories import validate,positions,progress_at,cubic
from engine.motion import save_guide,propose,accept,request_at_time,subject
from engine.project import fingerprint
from engine.jobs import create_motion_job,execute,apply_motion_result,read
from hosts.standalone.session import Session
from hosts.standalone.motion_fixtures import fixture,request


def curved():
    p=fixture();g=p['motion_guides']['arm-lift']
    g['trajectories']={'hand':[dict(end_progress=1,control1=[116.5,33.5],control2=[110.5,25.5],end=[106.5,22.5])]}
    g['contacts']=[dict(id='left-foot',landmark_id='left_foot',start_progress=0,end_progress=1,position=g['handles'][0]['source'][:])]
    g['timing_map']=[dict(end_time=.25,end_progress=0,easing=[0,0,1,1]),dict(end_time=1,end_progress=1,easing=[.42,0,.58,1])]
    return p


class TrajectoryTests(unittest.TestCase):
    def test_legacy_guide_edit_preserves_independent_controls_until_explicit_clear(self):
        p=curved();g=deepcopy(p['motion_guides']['arm-lift'])
        for key in ('trajectories','timing_map','contacts'):g.pop(key)
        g['name']='Renamed correspondence guide'
        q=save_guide(p,'arm-lift',g)
        for key in ('trajectories','timing_map','contacts'):self.assertEqual(q['motion_guides']['arm-lift'][key],p['motion_guides']['arm-lift'][key])
        g['trajectories']={};cleared=save_guide(q,'arm-lift',g)
        self.assertEqual(cleared['motion_guides']['arm-lift']['trajectories'],{})
        self.assertEqual(len(cleared['motion_guides']['arm-lift']['motion_control_history']),1)

    def test_clock_provenance_and_progress_are_bound_without_moving_keys(self):
        p=curved();r=request_at_time(p,'arm-lift',.5,4,8)
        self.assertEqual(r['clock_time'],.5);self.assertEqual(r['progress'],progress_at(p['motion_guides']['arm-lift'],.5))
        changed=deepcopy(r);changed['progress']+=.01
        with self.assertRaisesRegex(ValueError,'Clock time'):subject(p,changed)
        self.assertEqual(p['exposures'],curved()['exposures'])

    def test_legacy_geometry_exact_and_spatial_path_not_changed_by_clock(self):
        p=fixture();g=p['motion_guides']['arm-lift']
        for progress in (0,.123,.5,1):
            result=positions(g,progress)
            for h in g['handles']:
                np.testing.assert_array_equal(result[h['id']],np.array(h['source'])+progress*(np.array(h['target'])-h['source']))
        g=curved()['motion_guides']['arm-lift'];points=positions(g,.5);later=deepcopy(g);later['timing_map']=[dict(end_time=1,end_progress=1,easing=[.9,0,1,1])]
        self.assertEqual(points,positions(later,.5));self.assertNotEqual(progress_at(g,.5),progress_at(later,.5))
        self.assertEqual(positions(g,0)['hand'],[113.5,38.5]);self.assertEqual(positions(g,1)['hand'],[106.5,22.5])
        self.assertEqual(progress_at(g,.2),0);self.assertEqual(progress_at(g,.25),0)

    def test_easing_inverts_time_rather_than_substitutes_into_y(self):
        g=fixture()['motion_guides']['arm-lift'];g['timing_map']=[dict(end_time=1,end_progress=1,easing=[.1,.6,.8,.9])]
        u=.37;bern=lambda a,b:3*(1-u)**2*u*a+3*(1-u)*u*u*b+u**3
        self.assertAlmostEqual(progress_at(g,bern(.1,.8)),bern(.6,.9),places=13)
        self.assertNotAlmostEqual(progress_at(g,bern(.1,.8)),cubic(0,.6,.9,1,bern(.1,.8)),places=3)
        self.assertEqual(progress_at(g,0),0);self.assertEqual(progress_at(g,1),1)
        g['timing_map'][0]['easing']=[1,0,0,1]
        self.assertEqual(progress_at(g,.5),.5)

    def test_continuous_contact_rejects_endpoint_touch_with_interior_bulge(self):
        g=curved()['motion_guides']['arm-lift'];foot=g['handles'][0]['source'][:]
        g['trajectories']['left_foot']=[dict(end_progress=1,control1=[foot[0]+1,foot[1]],control2=foot[:],end=foot[:])]
        with self.assertRaisesRegex(ValueError,'constant throughout'):validate(g)
        g['trajectories']['left_foot'][0]['control1']=foot[:];validate(g)
        for t in np.linspace(0,1,41):self.assertEqual(positions(g,float(t))['left_foot'],foot)

    def test_contact_then_release_with_explicit_spatial_boundary(self):
        g=dict(handles=[dict(id='point',source=[10,20],target=[20,20],enabled=True)],trajectories={'point':[dict(end_progress=.4,control1=[10,20],control2=[10,20],end=[10,20]),dict(end_progress=1,control1=[12,20],control2=[18,20],end=[20,20])]},contacts=[dict(id='planted',landmark_id='point',start_progress=0,end_progress=.4,position=[10,20])])
        validate(g);self.assertEqual(positions(g,.3)['point'],[10,20]);self.assertGreater(positions(g,.7)['point'][0],10)
        g['contacts'][0]['end_progress']=.5
        with self.assertRaises(ValueError):validate(g)

    def test_invalid_unknown_controls_and_contact_conflicts_refuse(self):
        g=curved()['motion_guides']['arm-lift']
        variants=[]
        bad=deepcopy(g);bad['trajectories']['hand'][0]['end']=[0,0];variants.append(bad)
        bad=deepcopy(g);bad['trajectories']['hand'][0]['end_progress']=.9;variants.append(bad)
        bad=deepcopy(g);bad['timing_map'][0]['easing']=[0,1,1,0];variants.append(bad)
        bad=deepcopy(g);bad['contacts'][0]['position'][0]+=1;variants.append(bad)
        bad=deepcopy(g);bad['trajectories']['missing']=bad['trajectories'].pop('hand');variants.append(bad)
        bad=deepcopy(g);bad['trajectories']['hand'][0]['control1'][0]=float('nan');variants.append(bad)
        for bad in variants:
            with self.assertRaises(ValueError):validate(bad)
        for t in (-.1,1.1,True,float('nan')):
            with self.assertRaises(ValueError):progress_at(g,t)

    def test_controls_history_is_bound_to_source_and_exact_reopen(self):
        p=curved();g=deepcopy(p['motion_guides']['arm-lift']);g['trajectories']['hand'][0]['control1'][0]+=1
        q=save_guide(p,'arm-lift',g);history=q['motion_guides']['arm-lift']['motion_control_history']
        self.assertEqual(len(history),1);self.assertEqual(history[0]['previous']['trajectories'],p['motion_guides']['arm-lift']['trajectories'])
        self.assertEqual(history[0]['inputs']['source:ink']['drawing_sha256'],fingerprint(p['drawings']['ink-start']))
        with tempfile.TemporaryDirectory() as td:
            s=Session(q);s.save(Path(td)/'curves.aaa.json');self.assertEqual(Session.load(Path(td)/'curves.aaa.json').project,q)
        bad=deepcopy(q);bad['motion_guides']['arm-lift']['motion_control_history'][0]['previous']={}
        with self.assertRaises(ValueError):Session(bad)

    def test_curved_mls_worker_recomputes_sources_and_curve_edit_undo_is_stale(self):
        p=curved();r=propose(p,request());self.assertEqual(r['unsafe_reasons'],[])
        linear=deepcopy(p);linear['motion_guides']['arm-lift'].pop('trajectories');old=propose(linear,request())
        self.assertNotEqual(r['outputs']['ink']['pixels'],old['outputs']['ink']['pixels'])
        self.assertIn('REF-SVG-CUBIC-PATHS',r['source_ids'])
        with tempfile.TemporaryDirectory() as td:
            job=Path(td)/'motion';manifest=create_motion_job(p,request(),job);self.assertIn('REF-SVG-CUBIC-PATHS',manifest['source_ids']);self.assertEqual(execute(job)['state'],'completed')
            q=apply_motion_result(p,job,'curve-pose');self.assertEqual(q['originals'],p['originals']);self.assertEqual(q['motion_operations'][-1]['guide_snapshot']['trajectories'],p['motion_guides']['arm-lift']['trajectories'])
            s=Session(p);g=deepcopy(p['motion_guides']['arm-lift']);g['timing_map'][-1]['easing']=[0,0,1,1];s.commit(save_guide(s.project,'arm-lift',g),'change-clock');s.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):apply_motion_result(s.project,job,'stale')


if __name__=='__main__':unittest.main()
