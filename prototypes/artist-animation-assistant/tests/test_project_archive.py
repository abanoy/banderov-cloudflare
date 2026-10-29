from copy import deepcopy
import base64
import hashlib
import io
import json
from pathlib import Path
import tempfile
import struct
import unittest
from unittest.mock import patch
import zipfile

from engine.io.project_archive import PixelPlane,MemoryTiles,PackedArchive,save_archive,TILE_BYTES,TAG
from engine.project import create,fingerprint
from hosts.standalone.session import Session,demo


class PackedStorageTests(unittest.TestCase):
    def rewrite(self,path,updates):
        with zipfile.ZipFile(path) as archive:members={n:archive.read(n) for n in archive.namelist()}
        members.update(updates)
        with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
            for name,data in members.items():archive.writestr(name,data)

    def test_packed_edge_roi_and_invisible_rgb_are_exact(self):
        w,h=131,70;raw=bytes((i*13+i//7)%256 for i in range(w*h*4));plane=PixelPlane.from_rgba(w,h,raw)
        self.assertEqual(plane.region_bytes(),raw)
        roi=plane.region_bytes((61,62,70,67))
        self.assertEqual(roi,b''.join(raw[(y*w+61)*4:(y*w+70)*4] for y in range(62,67)))
        self.assertEqual(plane[-1],list(raw[-4:]))
        self.assertEqual(plane[63:66],[list(raw[i*4:i*4+4]) for i in range(63,66)])
        with self.assertRaises(AttributeError):plane.keys=()
        with self.assertRaises(TypeError):plane[0]=[0,0,0,0]
        self.assertIs(deepcopy(plane),plane)

    def test_hundred_versions_share_unchanged_tiles_and_preserve_source(self):
        source=PixelPlane.from_rgba(1920,1080,bytes([60,90,120,128])*(1920*1080));versions=[source]
        for i in range(100):versions.append(versions[-1].with_edits({(i*19877)%len(source):[i,0,250,0]}))
        self.assertIs(versions[0]._store,versions[-1]._store.parent)
        self.assertIs(versions[0]._store,versions[1]._store.parent)
        self.assertLessEqual(len(versions[-1]._store.assets),100)
        self.assertLessEqual(len(source._store.assets),105)
        self.assertEqual(source[0],[60,90,120,128])
        self.assertEqual(versions[1][0],[0,0,250,0])
        self.assertEqual(versions[-1][0],[0,0,250,0])
        self.assertEqual(sum(a!=b for a,b in zip(versions[0].keys,versions[1].keys)),1)
        with self.assertRaises(ValueError):source.materialize()

    def test_legacy_and_compact_session_roundtrip_metadata_and_sources(self):
        with tempfile.TemporaryDirectory() as td:
            session=Session(demo());session.slot=4;session.correct({42:[50,20,90,0]})
            session.project['opaque_future_metadata']={'notes':['Keep identity',3],'parts':{'hand':'artist label'}}
            raw=b'original source archive\x00\xff';session.project['native_source']=dict(archive_base64=base64.b64encode(raw).decode(),sha256=hashlib.sha256(raw).hexdigest())
            before=deepcopy(session.project)
            for name in ['legacy.aaa.json','compact.aaa']:
                path=Path(td)/name;session.save(path);self.assertEqual(Session.load(path).project,before)
            self.assertEqual(session.project,before);self.assertFalse(session.dirty)
            with PackedArchive(Path(td)/'compact.aaa') as archive:
                self.assertEqual(archive.asset_reads,0)
                self.assertEqual(archive.project['native_source']['archive_base64'],base64.b64encode(raw).decode())
                self.assertEqual(archive.project['drawings']['source']['pixels'].materialize(),before['drawings']['source']['pixels'])

    def test_lazy_roi_lru_and_closed_lifetime(self):
        with tempfile.TemporaryDirectory() as td:
            raw=bytes((i*3+i//491)%256 for i in range(192*192*4));plane=PixelPlane.from_rgba(192,192,raw)
            path=Path(td)/'p.aaa';save_archive(path,dict(canvas=dict(width=192,height=192),drawings={'a':{'pixels':plane}}))
            with PackedArchive(path,cache_bytes=TILE_BYTES) as archive:
                lazy=archive.project['drawings']['a']['pixels'];self.assertEqual(archive.asset_reads,0)
                self.assertEqual(lazy.region_bytes((1,1,3,3)),plane.region_bytes((1,1,3,3)));self.assertEqual(archive.asset_reads,1)
                lazy[191*192+191];self.assertLessEqual(archive.bytes_cached,TILE_BYTES)
                detached=lazy.detached();self.assertEqual(archive.verify_all(),len(set(plane.keys)))
            self.assertEqual(detached.region_bytes(),raw)
            with self.assertRaises(ValueError):lazy[0]

    def test_large_storage_does_not_silently_expand_in_legacy_host(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';plane=PixelPlane.from_rgba(1920,1080,b'\x00\x00\x00\x00'*(1920*1080))
            save_archive(path,dict(canvas=dict(width=1920,height=1080),drawings={'a':{'pixels':plane}}))
            before=path.read_bytes()
            with self.assertRaisesRegex(ValueError,'migration'):Session.load(path)
            self.assertEqual(path.read_bytes(),before)

    def test_corrupt_tile_is_rejected_on_access_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo())
            with zipfile.ZipFile(path) as z:name=next(n for n in z.namelist() if n.startswith('tiles/'))
            self.rewrite(path,{name:bytes([13])*TILE_BYTES})
            with PackedArchive(path) as archive:
                with self.assertRaisesRegex(ValueError,'digest'):archive.verify_all()
            with self.assertRaises(ValueError):Session.load(path)

    def test_manifest_hash_missing_tile_and_unreferenced_payload_fail(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo())
            self.rewrite(path,{'project.sha256':b'0'*64})
            with self.assertRaisesRegex(ValueError,'digest'):PackedArchive(path)
            save_archive(path,demo());self.rewrite(path,{'../bad':b'no'})
            with self.assertRaisesRegex(ValueError,'unsafe'):PackedArchive(path)
            save_archive(path,demo());self.rewrite(path,{'blobs/'+'0'*64+'.bin':b'unreferenced'})
            with self.assertRaisesRegex(ValueError,'Unreferenced'):PackedArchive(path)
            save_archive(path,demo())
            with zipfile.ZipFile(path) as z:m=json.loads(z.read('project.json'))
            m['tile_keys'][0]='0'*64
            data=json.dumps(m).encode();self.rewrite(path,{'project.json':data,'project.sha256':hashlib.sha256(data).hexdigest().encode()})
            with self.assertRaisesRegex(ValueError,'Missing tile'):PackedArchive(path)

    def test_invalid_oversized_write_preserves_existing_file_and_removes_temp(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo());before=path.read_bytes()
            project=demo();project['invalid']={TAG:'collision'}
            with self.assertRaises(ValueError):save_archive(path,project)
            self.assertEqual(path.read_bytes(),before)
            with patch('engine.io.project_archive.MAX_METADATA',32):
                with self.assertRaises(ValueError):save_archive(path,demo())
            self.assertEqual(path.read_bytes(),before);self.assertEqual([p.name for p in Path(td).iterdir()],['p.aaa'])

    def test_invalid_samples_bounds_and_nonfinite_metadata_refuse(self):
        for dims in [(0,1),(True,1),(4097,2)]:
            with self.assertRaises(ValueError):PixelPlane.from_rgba(*dims,b'')
        with self.assertRaises(ValueError):PixelPlane.from_pixels(1,1,[[1,2,3,True]])
        p=PixelPlane.from_rgba(1,1,b'\x01\x02\x03\x00')
        for edits in [{True:[1,2,3,4]},{1:[0,0,0,0]},{0:[256,0,0,0]}]:
            with self.assertRaises(ValueError):p.with_edits(edits)
        with tempfile.TemporaryDirectory() as td:
            project=demo();project['bad']=float('nan')
            with self.assertRaises(ValueError):save_archive(Path(td)/'p.aaa',project)

    def test_document_semantic_validation_still_rejects_changed_originals(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';project=demo();project['originals']['source']['pixels'][0]=[1,2,3,4]
            save_archive(path,project)
            with self.assertRaisesRegex(ValueError,'Original snapshot'):Session.load(path)

    def test_preflight_directory_is_bounded_before_zip_parser(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo());data=bytearray(path.read_bytes());end=data.rfind(b'PK\x05\x06')
            struct.pack_into('<I',data,end+12,17*1024*1024);path.write_bytes(data)
            with patch('engine.io.project_archive.zipfile.ZipFile',side_effect=AssertionError('must not allocate central directory')):
                with self.assertRaisesRegex(ValueError,'directory budget'):PackedArchive(path)

    def test_duplicate_entries_and_special_members_refuse(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo())
            with zipfile.ZipFile(path,'a') as archive:
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore');archive.writestr('mimetype',b'duplicate')
            with self.assertRaisesRegex(ValueError,'uniqueness'):PackedArchive(path)
            save_archive(path,demo())
            with zipfile.ZipFile(path) as archive:members={n:archive.read(n) for n in archive.namelist()}
            with zipfile.ZipFile(path,'w') as archive:
                for name,data in members.items():
                    info=zipfile.ZipInfo(name)
                    if name=='mimetype':info.external_attr=0o120777<<16
                    archive.writestr(info,data)
            with self.assertRaisesRegex(ValueError,'special'):PackedArchive(path)

    def test_duplicate_json_metadata_is_not_silently_overridden(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo())
            with zipfile.ZipFile(path) as archive:data=archive.read('project.json')
            data=data.replace(b'"format":',b'"format":"wrong","format":',1)
            self.rewrite(path,{'project.json':data,'project.sha256':hashlib.sha256(data).hexdigest().encode()})
            with self.assertRaisesRegex(ValueError,'Duplicate metadata'):PackedArchive(path)

    def test_prior_format1_and_shared_index_validation(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';save_archive(path,demo())
            with zipfile.ZipFile(path) as archive:m=json.loads(archive.read('project.json'))
            def downgrade(value):
                if isinstance(value,dict):
                    if value.get(TAG)=='rgba8-tile-indices-1':return {TAG:'rgba8-tiles-1','width':value['width'],'height':value['height'],'keys':[m['tile_keys'][i] for i in value['tiles']]}
                    return {k:downgrade(v) for k,v in value.items()}
                if isinstance(value,list):return [downgrade(v) for v in value]
                return value
            old=dict(format='artist-assistant-packed-1',tile_size=64,document=downgrade(m['document']))
            data=json.dumps(old).encode();self.rewrite(path,{'project.json':data,'project.sha256':hashlib.sha256(data).hexdigest().encode()})
            self.assertEqual(Session.load(path).project,demo())
            save_archive(path,demo())
            with zipfile.ZipFile(path) as archive:m=json.loads(archive.read('project.json'))
            m['document']['drawings']['source']['pixels']['tiles'][0]=True
            data=json.dumps(m).encode();self.rewrite(path,{'project.json':data,'project.sha256':hashlib.sha256(data).hexdigest().encode()})
            with self.assertRaisesRegex(ValueError,'shared tile index'):PackedArchive(path)

    def test_compact_save_cannot_bypass_current_host_serialization_guard(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'p.aaa';session=Session(demo());session.save(path);before=path.read_bytes()
            session.project['oversize_metadata']='x'*(32*1024*1024)
            with self.assertRaisesRegex(ValueError,'32 MiB'):session.save(path)
            self.assertEqual(path.read_bytes(),before)


if __name__=='__main__':unittest.main()
