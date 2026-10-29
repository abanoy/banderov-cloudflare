from copy import deepcopy
from fractions import Fraction
import hashlib,json,random,struct,tempfile,unittest,zlib
from pathlib import Path
from unittest.mock import patch
import numpy as np
from engine.spatial_constraints import count as protection_count
from engine.project import create,validate,fingerprint
from engine.io.project_archive import PixelPlane,SourceBlob
from engine.packed_model import check_budget
from engine.packed_render import render,over,png_bytes
from engine.layers import source_over,render as old_render
from engine.io.png_codec import read_png,SIGNATURE,chunk
from engine.jobs import create_job,execute,read,request_cancel,apply_result,atomic_write
from engine.io.packed_export import export_bundle
from hosts.standalone.session import Session

ROOT=Path(__file__).resolve().parents[1]


def original(width=513,height=257,duration=12):
    raw=bytes([30,80,150,128])*(width*height)
    return create(PixelPlane.from_rgba(width,height,raw),width,height,duration)


class LivePackedTests(unittest.TestCase):
    def test_all_integer_opacities_match_independent_scalar_compositing(self):
        rng=np.random.default_rng(29);bottom=rng.integers(0,256,(4,8,4),dtype=np.uint8);top=rng.integers(0,256,bottom.shape,dtype=np.uint8)
        bottom[0]=[255,255,255,255];top[0]=[255,255,255,255];bottom[1,:,3]=0;top[2,:,3]=0
        for opacity in range(256):
            expected=source_over(bottom.reshape(-1,4).tolist(),top.reshape(-1,4).tolist(),opacity)
            self.assertEqual(over(bottom,top,opacity).reshape(-1,4).tolist(),expected)

    def test_zero_tile_fast_path_does_not_bypass_store_integrity(self):
        plane=PixelPlane.from_rgba(64,64,bytes(64*64*4));p=create(plane,64,64)
        plane._store.assets[plane.keys[0]]=bytes([1,2,3,255])*(64*64)
        with self.assertRaisesRegex(ValueError,'identity changed'):render(p,0)

    def test_legacy_hashes_do_not_change_or_silently_upgrade(self):
        legacy=create([[1,2,3,0],[30,40,50,128]],2,1)
        expected=hashlib.sha256(json.dumps(legacy,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        self.assertEqual(fingerprint(legacy),expected);self.assertEqual(Session(legacy).project['schema_version'],'0.1')
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'old.aaa.json';Session(legacy).save(p);self.assertEqual(Session.load(p).project,legacy)

    def test_full_alpha_pair_grid_matches_independent_integer_oracle(self):
        a=np.arange(256,dtype=np.uint8)
        bottom=np.zeros((256,256,4),dtype=np.uint8);top=bottom.copy()
        bottom[:,:,:3]=[15,90,220];top[:,:,:3]=[200,10,80]
        bottom[:,:,3]=a[:,None];top[:,:,3]=a[None,:]
        for opacity in [255,127.5,Fraction(1,10**12)]:
            expected=source_over(bottom.reshape(-1,4).tolist(),top.reshape(-1,4).tolist(),opacity)
            self.assertEqual(over(bottom,top,opacity).reshape(-1,4).tolist(),expected)

    def test_layer_group_opacity_priority_and_nearest_view_are_exact(self):
        rng=random.Random(55);w,h=19,13;first=[[rng.randrange(256) for _ in range(4)] for _ in range(w*h)];second=[[rng.randrange(256) for _ in range(4)] for _ in first]
        legacy=create(first,w,h);legacy['drawings']['second']=dict(pixels=second,approved=True,locked=False,origin='synthetic')
        legacy['layers']={'group':dict(name='auto',nodetype='grouplayer',isolation='auto',opacity=117.125),'ink':dict(name='ink',parent_id='group',opacity=201.5,order=1),'top':dict(name='top',parent_id='group',opacity=200.125,order=0)}
        legacy['exposures'].append(dict(layer_id='top',drawing_id='second',start=0,length=1))
        packed=deepcopy(legacy);packed['schema_version']='0.2'
        for table in ['drawings','originals']:
            for drawing in packed[table].values():drawing['pixels']=PixelPlane.from_pixels(w,h,drawing['pixels'])
        packed['originals_sha256']=fingerprint(packed['originals']);validate(packed)
        for isolation in ['auto','isolate']:
            packed['layers']['group']['isolation']=legacy['layers']['group']['isolation']=isolation
            expected=bytes(c for p in old_render(legacy,0) for c in p)
            self.assertEqual(render(packed,0)[2],expected)
            ow,oh,raw=render(packed,0,(7,5),(3,2,17,12));grid=np.frombuffer(expected,np.uint8).reshape(h,w,4)
            self.assertEqual(raw,grid[(2+np.arange(5)*10//5)[:,None],(3+np.arange(7)*14//7)[None,:]].tobytes())

    def test_transparent_backdrop_shortcut_preserves_low_alpha_rgb_rounding(self):
        values=np.zeros((1,256,4),dtype=np.uint8);values[:,:,:3]=[77,12,200];values[:,:,3]=np.arange(256,dtype=np.uint8)
        bottom=np.zeros_like(values)
        for opacity in [0,1,.5,127.5,255,Fraction(1,10**12)]:
            self.assertEqual(over(bottom,values,opacity).reshape(-1,4).tolist(),source_over(bottom.reshape(-1,4).tolist(),values.reshape(-1,4).tolist(),opacity))

    def test_hundred_live_corrections_share_pixels_keep_constraints_and_sources(self):
        session=Session(original(1920,1080));source=session.project['originals']['source']['pixels']
        for i in range(100):session.correct({i*79:[i,90,150,0 if i%3==0 else 200]})
        current=session.project['drawings'][session.drawing_id()]
        self.assertEqual(protection_count(current),100);self.assertEqual(len(session.project['drawings']),101)
        self.assertEqual(source[0],[30,80,150,128]);self.assertEqual(current['pixels'][0],[0,90,150,0])
        self.assertIs(session.past[0]['originals']['source']['pixels'],source)
        self.assertEqual(len(session.past),16);self.assertIs(current['pixels']._store.parent,source._store)
        self.assertLessEqual(len(current['pixels']._store.assets),100)
        counter=session.counter;self.assertTrue(session.travel());self.assertGreater(session.counter,counter);session.travel(False)
        self.assertEqual(session.project['drawings'][session.drawing_id()]['pixels'][0],[0,90,150,0])

    def test_source_blob_same_path_save_and_load_own_backing_are_exact(self):
        session=Session(original());raw=b'original binary PNG source\x00\xff';session.project['png_source']=dict(filename='artist.png',sha256=hashlib.sha256(raw).hexdigest(),blob=SourceBlob(raw))
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'current.aaa';session.save(path);loaded=Session.load(path);self.assertEqual(loaded.project,session.project)
            path.rename(Path(td)/'moved.aaa')
            self.assertEqual(loaded.project['drawings']['source']['pixels'][0],[30,80,150,128])
            loaded.correct({4:[12,13,14,0]});loaded.save(path);self.assertEqual(Session.load(path).project,loaded.project)
            self.assertEqual(loaded.project['png_source']['blob'].data,raw)
            with self.assertRaisesRegex(ValueError,'save as .aaa'):loaded.save(Path(td)/'invalid.aaa.json')

    def test_packed_job_snapshots_translation_accept_stale_tamper_and_cancel(self):
        with tempfile.TemporaryDirectory() as td:
            session=Session(original());directory=Path(td)/'job';create_job(session.project,'source',3,2,directory)
            self.assertTrue((directory/'input.json').read_bytes().startswith(b'PK'))
            self.assertIn('COMP-NUMPY-2-4-1',read(directory/'job.json')['component_ids'])
            execute(directory);result=read(directory/'result.json');self.assertIsInstance(result['pixels'],PixelPlane)
            before=fingerprint(session.project);session.apply(directory)
            self.assertNotEqual(fingerprint(session.project),before);self.assertIn('source',session.project['drawings']);self.assertTrue(session.project['drawings']['source']['locked'])
            stale=Path(td)/'stale';create_job(session.project,session.drawing_id(),1,0,stale);execute(stale);session.correct({0:[1,2,3,4]});session.travel()
            with self.assertRaisesRegex(ValueError,'Stale'):session.apply(stale)
            bad=Path(td)/'tamper';create_job(session.project,session.drawing_id(),0,0,bad);execute(bad);changed=read(bad/'result.json');changed['pixels']=changed['pixels'].with_edits({5:[1,2,3,4]});atomic_write(bad/'result.json',changed)
            with self.assertRaisesRegex(ValueError,'hash'):session.apply(bad)
            cancel=Path(td)/'cancel';create_job(session.project,session.drawing_id(),5,0,cancel)
            execute(cancel,row_hook=lambda y:request_cancel(cancel) if y>=64 else None)
            self.assertEqual(read(cancel/'job.json')['state'],'cancelled');self.assertFalse((cancel/'result.json').exists())

    def test_invalid_original_and_budget_failure_preserve_live_history(self):
        session=Session(original());before=fingerprint(session.project);counter=session.counter;pool=dict(session.project['drawings']['source']['pixels']._store.assets)
        with patch('engine.packed_model.LIVE_ASSETS',0):
            with self.assertRaises(ValueError):session.correct({1:[1,2,3,4]})
        self.assertEqual(fingerprint(session.project),before);self.assertEqual(session.counter,counter);self.assertFalse(session.past)
        self.assertEqual(session.project['drawings']['source']['pixels']._store.assets,pool)
        invalid=deepcopy(session.project);invalid['originals']['source']['pixels']=invalid['originals']['source']['pixels'].with_edits({0:[1,1,1,1]})
        with self.assertRaisesRegex(ValueError,'Original snapshot'):validate(invalid)
        invalid=deepcopy(session.project);invalid['drawings']['source']['pixels']=[[0,0,0,0]]
        with self.assertRaisesRegex(ValueError,'immutable'):validate(invalid)

    def test_packed_png_all_filter_rows_keep_rgba_and_transparency(self):
        w,h=83,5;rng=random.Random(11);rows=[bytes(rng.randrange(256) for _ in range(w*4)) for _ in range(h)];encoded=[]
        for y,row in enumerate(rows):
            mode=y;previous=rows[y-1] if y else bytes(len(row));out=bytearray()
            for i,value in enumerate(row):
                left=row[i-4] if i>=4 else 0;up=previous[i];corner=previous[i-4] if i>=4 else 0
                e=left+up-corner;distances=[abs(e-v) for v in [left,up,corner]]
                predictor=[0,left,up,(left+up)//2,[left,up,corner][distances.index(min(distances))]][mode]
                out.append((value-predictor)&255)
            encoded.append(bytes([mode])+out)
        data=SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(encoded)))+chunk(b'IEND',b'')
        self.assertEqual(read_png(data,packed=True)[2].region_bytes(),b''.join(rows))
        self.assertEqual(read_png(data)[2],[list((b''.join(rows))[i:i+4]) for i in range(0,w*h*4,4)])

    def test_packed_png_masks_unused_trns_high_bits_as_required(self):
        data=SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'tRNS',struct.pack('>3H',0xff0a,20,30))+chunk(b'IDAT',zlib.compress(bytes([0,10,20,30])))+chunk(b'IEND',b'')
        self.assertEqual(read_png(data,packed=True)[2][0],[10,20,30,0])
        self.assertEqual(read_png(data)[2],[[10,20,30,0]])

    def test_repeated_source_size_mismatch_is_rejected_on_cached_read(self):
        import zipfile
        from engine.io.project_archive import save_archive,PackedArchive
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'bad.aaa';project=original();blob=SourceBlob(b'abc');project['first_blob']=blob;project['second_blob']=blob;save_archive(p,project)
            with zipfile.ZipFile(p) as archive:members={n:archive.read(n) for n in archive.namelist()}
            manifest=json.loads(members['project.json']);manifest['document']['second_blob']['size']=2
            data=json.dumps(manifest).encode();members['project.json']=data;members['project.sha256']=hashlib.sha256(data).hexdigest().encode()
            with zipfile.ZipFile(p,'w') as archive:
                for name,value in members.items():archive.writestr(name,value)
            with self.assertRaisesRegex(ValueError,'Repeated source size'):PackedArchive(p)

    def test_large_png_and_exposure_bundle_reopen_are_exact(self):
        project=original();project['shot']['fps']=dict(numerator=24000,denominator=1001)
        project['drawings']['second']=dict(pixels=project['drawings']['source']['pixels'].with_edits({0:[255,0,0,255]}),origin='synthetic',approved=True,locked=False)
        project['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='second',start=4,length=8)]
        with tempfile.TemporaryDirectory() as td:
            directory=Path(td)/'export';manifest=export_bundle(project,directory,ROOT/'generated')
            self.assertEqual([e['length'] for e in manifest['exposures']],[4,8]);self.assertEqual(manifest['fps'],project['shot']['fps'])
            self.assertEqual(Session.load(directory/'project.aaa').project,project)
            for e in manifest['exposures']:
                actual=read_png((directory/e['file']).read_bytes(),packed=True)[2].region_bytes()
                self.assertEqual(actual,render(project,e['start'])[2])
            self.assertTrue((directory/'CREDITS.md').exists());self.assertFalse((directory/'INCOMPLETE.json').exists())


if __name__=='__main__':unittest.main()
