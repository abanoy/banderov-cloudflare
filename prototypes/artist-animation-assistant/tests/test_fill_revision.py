from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from engine.fill import propose,defaults,accept_fill
from engine.fill_revision import inputs,dependency,propose_revision,protected_pixels
from engine.jobs import create_fill_revision_job,execute,apply_fill_result,read,atomic_write
from engine.layers import render
from engine.project import fingerprint
from hosts.standalone.session import Session
from test_fill import fixture


def accepted():
    project=fixture(gap=True)
    project['drawings']['other']=deepcopy(project['drawings']['source'])
    project['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=5),dict(layer_id='ink',drawing_id='other',start=5,length=7)]
    project['layers']['unrelated']=dict(name='Unrelated hidden paint',visible=False,order=8)
    project['drawings']['unrelated']=deepcopy(project['drawings']['source'])
    project['exposures'].append(dict(layer_id='unrelated',drawing_id='unrelated',start=0,length=12))
    settings=defaults([5,5],[70,130,220,255])
    result=propose(project['drawings']['source']['pixels'],15,15,settings)
    project,layer=accept_fill(project,result,'ink',0,'region-test')
    return project


def revised_settings(project):
    settings=deepcopy(project['fill_regions']['region-test']['settings'])
    settings['add_barriers']=[3*15+7]
    return settings


class RevisionTests(unittest.TestCase):
    def test_local_revision_changes_one_fill_exposure_without_stacking(self):
        project=accepted()
        before=deepcopy(project)
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'revision'
            create_fill_revision_job(project,'region-test',revised_settings(project),job)
            execute(job)
            updated,layer=apply_fill_result(project,job,'new-version')
        self.assertEqual(project,before)
        self.assertEqual(updated['layers'],project['layers'])
        self.assertEqual(len(updated['drawings']),len(project['drawings'])+1)
        self.assertEqual(updated['originals'],project['originals'])
        self.assertEqual(updated['drawings']['source'],project['drawings']['source'])
        self.assertEqual(render(updated,6),render(project,6))
        self.assertEqual(updated['fill_regions']['region-test']['version'],1)
        self.assertEqual(layer,'region-test-fill')
        self.assertFalse(updated['drawings']['new-version']['pixels'][0][3])
        for original in project['exposures']:
            if original['layer_id']=='region-test-fill' and original['start']==0: continue
            self.assertIn(original,updated['exposures'])

    def test_paint_erasure_same_color_lock_and_previous_versions_survive(self):
        session=Session(accepted());session.layer_id='region-test-fill'
        session.correct({0:[220,40,60,255],5*15+5:[0,0,0,0]})
        session.correct({5*15+6:[70,130,220,255]})
        old_id=session.drawing_id()
        old=deepcopy(session.project['drawings'][old_id])
        self.assertEqual(old['protected_pixels'],[0,80,81])
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'revision'
            create_fill_revision_job(session.project,'region-test',revised_settings(session.project),job)
            execute(job)
            session.layer_id='region-test-ink'
            session.apply(job)
            new=session.project['drawings'][session.drawing_id()]
            self.assertEqual(new['protected_pixels'],[0,80,81])
            self.assertEqual(new['pixels'][0],[220,40,60,255])
            self.assertEqual(new['pixels'][80],[0,0,0,0])
            self.assertEqual(new['pixels'][81],[70,130,220,255])
            self.assertEqual(new['pixels'][1],[0,0,0,0])
            self.assertEqual(session.project['drawings'][old_id],old)
            accepted_project=deepcopy(session.project)
            session.travel();self.assertEqual(session.project['drawings'][old_id],old)
            session.travel(False);self.assertEqual(session.project['layers'],accepted_project['layers'])
            path=Path(directory)/'saved.aaa.json';session.save(path)
            self.assertEqual(Session.load(path).project,session.project)

    def test_unrelated_edit_during_job_survives_local_application(self):
        session=Session(accepted())
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'revision'
            create_fill_revision_job(session.project,'region-test',revised_settings(session.project),job)
            execute(job)
            session.layer_id='unrelated';session.correct({2:[90,50,10,255]})
            correction=session.drawing_id()
            session.layer_id='region-test-ink'
            session.apply(job)
            self.assertEqual(session.project['drawings'][correction]['pixels'][2],[90,50,10,255])
            self.assertEqual(next(e for e in session.project['exposures'] if e['layer_id']=='unrelated')['drawing_id'],correction)

    def test_dependency_changes_fail_even_after_undo_and_redo(self):
        session=Session(accepted())
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'revision'
            create_fill_revision_job(session.project,'region-test',revised_settings(session.project),job)
            execute(job)
            session.layer_id='region-test-fill';session.correct({0:[90,50,10,255]})
            session.layer_id='region-test-ink'
            with self.assertRaises(ValueError):session.apply(job)
            session.travel()
            session.layer_id='region-test-ink'
            with self.assertRaises(ValueError):session.apply(job)

    def test_unrelated_undo_keeps_dependency_current(self):
        session=Session(accepted())
        settings=revised_settings(session.project)
        before=dependency(session.project,'region-test',settings)
        session.layer_id='unrelated';session.correct({2:[90,50,10,255]})
        self.assertEqual(dependency(session.project,'region-test',settings),before)
        session.travel()
        self.assertEqual(dependency(session.project,'region-test',settings),before)

    def test_legacy_locked_fill_preserved_in_full(self):
        project=accepted()
        region,exposures,layers=inputs(project,'region-test')
        drawing=project['drawings'][exposures['fill']['drawing_id']]
        drawing.update(locked=True,origin='artist_correction')
        result=propose_revision(project,'region-test',revised_settings(project))
        self.assertEqual(result['fill'],drawing['pixels'])
        self.assertEqual(result['protected_pixels'],list(range(225)))

    def test_tamper_protection_subject_and_output_rejected(self):
        project=accepted()
        with tempfile.TemporaryDirectory() as directory:
            job=Path(directory)/'revision'
            create_fill_revision_job(project,'region-test',revised_settings(project),job)
            execute(job)
            result=read(job/'result.json')
            for key,value in [('region_id','other'),('dependency_sha256','0'*64),('fill_result',dict(result['fill_result'],protected_pixels=[0]))]:
                changed=deepcopy(result);changed[key]=value
                if key=='fill_result':changed['fill_sha256']=fingerprint(value)
                atomic_write(job/'result.json',changed)
                with self.assertRaises(ValueError):apply_fill_result(project,job,'tampered')
            atomic_write(job/'result.json',result)
            changed=deepcopy(project);changed['palettes']['fill_main']['rgba']=[3,2,1,255]
            with self.assertRaises(ValueError):apply_fill_result(changed,job,'changed-palette')

    def test_retimed_layer_locked_layer_and_paper_change_require_explicit_repair(self):
        project=accepted()
        changed=deepcopy(project)
        changed['layers']['region-test-fill']['locked']=True
        with self.assertRaises(ValueError):propose_revision(changed,'region-test',revised_settings(changed))
        with self.assertRaises(ValueError):propose_revision(project,'region-test',dict(revised_settings(project),paper='white'))
        changed=deepcopy(project)
        for e in changed['exposures']:
            if e['layer_id']=='region-test-fill':
                if e['start']==0:e['length']=6
                else:e['start']=6;e['length']=6
        with self.assertRaises(ValueError):propose_revision(changed,'region-test',revised_settings(changed))

    def test_project_load_validation_rejects_invalid_constraints_and_clocks(self):
        project=accepted()
        for clocks in [{'layer:ink':-1},{'layer:ink':True},{'layer:ink':2**63},[]]:
            bad=deepcopy(project);bad['dependency_epochs']=clocks
            with self.subTest(clocks=clocks),self.assertRaises(ValueError):Session(bad)
        bad=deepcopy(project)
        bad['drawings']['source']['protected_pixels']=[-1]
        with self.assertRaises(ValueError):Session(bad)

    def test_invalid_protection_indices_rejected(self):
        for indices in [[True],[225],[1,1],[-1],['1']]:
            with self.subTest(indices=indices),self.assertRaises(ValueError):protected_pixels(dict(pixels=[[0,0,0,0] for _ in range(225)],protected_pixels=indices))


if __name__=='__main__':unittest.main()
