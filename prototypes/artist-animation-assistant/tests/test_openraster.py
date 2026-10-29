import base64
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
import zlib

from engine.io.openraster import write_ora,import_ora,export_bundle,StaleEmbeddedProject
from engine.io.png_codec import encode_png,read_png,chunk,SIGNATURE
from engine.io.kra_raster import import_kra
from engine.layers import render
from engine.project import create,fingerprint
from hosts.standalone.session import Session,demo

ROOT=Path(__file__).resolve().parents[1]


def encoded(width,height,depth,color,raw,before=b''):
    return SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,depth,color,0,0,0))+before+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')


class PNGTests(unittest.TestCase):
    def test_rgb_all_filters_with_known_scanlines(self):
        pairs=[([10,20,30,40,50,60],[11,22,33,44,55,66]),([10,20,30,30,30,30],[11,22,33,33,33,33]),([10,20,30,40,50,60],[1,2,3,4,5,6]),([10,20,30,35,40,45],[6,12,18,19,19,20]),([10,20,30,30,30,30],[1,2,3,4,5,6])]
        expected=[[10,20,30,255],[40,50,60,255],[11,22,33,255],[44,55,66,255]]
        for mode,(first,second) in enumerate(pairs):
            self.assertEqual(read_png(encoded(2,2,8,2,bytes([mode]+first+[mode]+second)))[2],expected)

    def test_packed_palette_alpha_and_gray_padding(self):
        palette=chunk(b'PLTE',bytes([10,20,30,40,50,60,70,80,90,100,110,120]))
        self.assertEqual(read_png(encoded(4,1,2,3,b'\0\x1b',palette+chunk(b'tRNS',bytes([0,37]))))[2],[[10,20,30,0],[40,50,60,37],[70,80,90,255],[100,110,120,255]])
        self.assertEqual(read_png(encoded(3,1,1,0,b'\0\x40',chunk(b'tRNS',b'\xff\x00')))[2],[[0,0,0,0],[255,255,255,255],[0,0,0,0]])

    def test_gray_alpha_rgb_transparency_and_rgba_exact(self):
        self.assertEqual(read_png(encoded(1,1,8,4,bytes([0,77,111])))[2],[[77,77,77,111]])
        trns=chunk(b'tRNS',struct.pack('>3H',0xff0a,20,30))
        self.assertEqual(read_png(encoded(1,1,8,2,bytes([0,10,20,30]),trns))[2],[[10,20,30,0]])
        pixels=[[1,2,3,0],[90,80,70,111]]
        self.assertEqual(read_png(encode_png(2,1,pixels))[2],pixels)

    def test_invalid_crc_palette_depth_and_inflate_bounds(self):
        good=bytearray(encode_png(1,1,[[1,2,3,4]]))
        good[20]^=1
        cases=[bytes(good),encoded(1,1,16,6,b'\0'+b'\0'*8),encoded(1,1,2,3,b'\0\xc0',chunk(b'PLTE',b'\0'*6)),encoded(1,1,8,6,b'0'*100000)]
        for data in cases:
            with self.assertRaises(ValueError):
                read_png(data)


class ORATests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory=Path(self.temp.name)

    def rewrite(self,path,mutate):
        with zipfile.ZipFile(path) as archive:
            entries={n:archive.read(n) for n in archive.namelist()}
        mutate(entries)
        target=self.directory/'changed.ora'
        with zipfile.ZipFile(target,'w') as archive:
            for name,contents in entries.items():
                archive.writestr(name,contents)
        return target

    def test_actual_native_layers_full_project_roundtrip(self):
        project=import_kra(ROOT/'experiments/EXP-0005-editable-selection/outputs/gui-roundtrip-selected-proposal.kra')
        path=self.directory/'native.ora'
        write_ora(project,path)
        result=import_ora(path)
        self.assertEqual(result['project'],project)
        self.assertEqual(result['metadata_state'],'restored_verified')
        with zipfile.ZipFile(path) as archive:
            self.assertEqual(archive.namelist()[0],'mimetype')
            self.assertEqual(archive.getinfo('mimetype').compress_type,zipfile.ZIP_STORED)
            self.assertEqual(read_png(archive.read('mergedimage.png'))[2],render(project,0))

    def test_original_plain_ora_preserves_layers_group_and_source_bytes(self):
        source=ROOT/'experiments/EXP-0004-native-batch/outputs/input.ora'
        result=import_ora(source)
        project=result['project']
        self.assertEqual(len(project['layers']),3)
        self.assertEqual(result['metadata_state'],'plain_ora_still')
        self.assertFalse(next(l for l in project['layers'].values() if l['name']=='Originals')['visible'])
        self.assertEqual(base64.b64decode(project['ora_source']['archive_base64']),source.read_bytes())

    def test_project_locks_history_nonuniform_holds_survive_embedded_roundtrip(self):
        session=Session(demo())
        session.correct({3:[10,20,30,111]})
        session.hold(5)
        project=session.project
        project['canvas']['resolution']={'x':300,'y':150}
        path=self.directory/'edited.ora'
        write_ora(project,path,slot=5,selected_layer='ink')
        restored=import_ora(path)
        self.assertEqual(restored['project'],project)
        self.assertEqual(restored['slot'],5)
        self.assertEqual(restored['selected_layer_id'],'ink')
        self.assertEqual([e['length'] for e in restored['project']['exposures']],[5,7])

    def test_external_pixel_edits_cannot_restore_stale_project(self):
        project=demo()
        path=self.directory/'initial.ora'
        write_ora(project,path)
        def edit(entries):
            name=next(n for n in entries if n.startswith('data/'))
            width,height,pixels=read_png(entries[name])
            pixels[0]=[200,100,50,37]
            entries[name]=encode_png(width,height,pixels)
        changed=self.rewrite(path,edit)
        with self.assertRaises(StaleEmbeddedProject):
            import_ora(changed)
        artwork=import_ora(changed,prefer_project=False)
        self.assertEqual(artwork['metadata_state'],'artwork_only')
        self.assertEqual(artwork['project']['shot']['duration_frames'],1)
        self.assertEqual(next(iter(artwork['project']['drawings'].values()))['pixels'][0],[200,100,50,37])
        self.assertTrue(artwork['warnings'])

    def test_rehashed_wrong_pixels_still_fail_semantic_binding(self):
        project=demo()
        path=self.directory/'initial.ora'
        write_ora(project,path)
        def edit(entries):
            name=next(n for n in entries if n.startswith('data/'))
            width,height,pixels=read_png(entries[name]); pixels[0]=[1,2,3,4]
            entries[name]=encode_png(width,height,pixels)
            manifest=json.loads(entries['assistant/manifest.json'])
            manifest['member_sha256'][name]=hashlib.sha256(entries[name]).hexdigest()
            entries['assistant/manifest.json']=json.dumps(manifest).encode()
        with self.assertRaises(StaleEmbeddedProject):
            import_ora(self.rewrite(path,edit))

    def test_animation_bundle_schedule_and_layered_stills(self):
        project=demo()
        manifest=export_bundle(project,self.directory/'bundle')
        self.assertEqual([(e['start'],e['length']) for e in manifest['exposures']],[(0,4),(4,8)])
        self.assertEqual(json.loads((self.directory/'bundle/project.aaa.json').read_text()),project)
        for record in manifest['exposures']:
            loaded=import_ora(self.directory/'bundle'/record['file'])['project']
            self.assertEqual(render(loaded,0),render(project,record['start']))

    def test_nonisolated_group_opacity_differs_from_isolated(self):
        project=create([[255,0,0,255]],1,1)
        project['layers']={'group':{'name':'Group','nodetype':'grouplayer','opacity':127.5,'order':0,'isolation':'auto'},'blue':{'name':'Blue','parent_id':'group','order':0},'green':{'name':'Green','parent_id':'group','order':1},'ink':{'name':'Red','order':1}}
        for name,color in [('blue',[0,0,255,255]),('green',[0,255,0,255])]:
            project['drawings'][name]={'pixels':[color],'origin':'artist','approved':True,'locked':True}
            project['exposures'].append({'layer_id':name,'drawing_id':name,'start':0,'length':1})
        self.assertEqual(render(project,0),[[64,64,128,255]])
        path=self.directory/'auto.ora'
        write_ora(project,path,embed_project=False)
        self.assertEqual(render(import_ora(path)['project'],0),render(project,0))
        project['layers']['group']['isolation']='isolate'
        self.assertEqual(render(project,0),[[128,0,128,255]])

    def test_unsupported_blend_and_overwrite_fail(self):
        path=self.directory/'plain.ora'
        write_ora(demo(),path,embed_project=False)
        with self.assertRaises(FileExistsError):
            write_ora(demo(),path)
        changed=self.rewrite(path,lambda e:e.update({'stack.xml':e['stack.xml'].replace(b'svg:src-over',b'svg:multiply')}))
        with self.assertRaisesRegex(ValueError,'blend'):
            import_ora(changed)

    def test_rehashed_resolution_edit_cannot_restore_old_metadata(self):
        project=demo(); project['canvas']['resolution']={'x':300,'y':150}
        path=self.directory/'initial.ora'; write_ora(project,path)
        def edit(entries):
            entries['stack.xml']=entries['stack.xml'].replace(b'xres="300"',b'xres="400"')
            manifest=json.loads(entries['assistant/manifest.json'])
            manifest['member_sha256']['stack.xml']=hashlib.sha256(entries['stack.xml']).hexdigest()
            entries['assistant/manifest.json']=json.dumps(manifest).encode()
        with self.assertRaises(StaleEmbeddedProject):
            import_ora(self.rewrite(path,edit))

    def test_default_equal_layer_orders_keep_topmost_insertion_order(self):
        project=create([[255,0,0,255]],1,1)
        project['layers']={'front':{'name':'Blue'},'ink':{'name':'Red'}}
        project['drawings']['blue']={'pixels':[[0,0,255,255]],'origin':'artist','approved':True,'locked':True}
        project['exposures'].append({'layer_id':'front','drawing_id':'blue','start':0,'length':1})
        self.assertEqual(render(project,0),[[0,0,255,255]])
        path=self.directory/'ordered.ora'; write_ora(project,path,embed_project=False)
        self.assertEqual(render(import_ora(path)['project'],0),[[0,0,255,255]])
