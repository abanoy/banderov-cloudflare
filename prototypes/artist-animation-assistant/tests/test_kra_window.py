from pathlib import Path
from copy import deepcopy
import base64,io,struct,tempfile,unittest,zipfile
import xml.etree.ElementTree as ET
from unittest.mock import patch
import numpy as np
from engine.io.kra_window import KraWindow,decode_plane,validate_source,verify_external_source
from engine.io.kra_raster import import_kra
from engine.packed_render import render
from hosts.standalone.session import Session

ROOT=Path(__file__).resolve().parents[1]
ACTUAL=ROOT/'experiments/EXP-0005-editable-selection/outputs/gui-roundtrip-selected-proposal.kra'
with zipfile.ZipFile(ACTUAL) as z:ICC=z.read('Unnamed/annotations/icc')


def native_tiles(edits):
    blocks={}
    for (x,y),rgba in edits.items():
        tx,ty=x//64*64,y//64*64;tile=blocks.setdefault((tx,ty),bytearray(16384));i=((y-ty)*64+x-tx)*4;r,g,b,a=rgba;tile[i:i+4]=bytes([b,g,r,a])
    data=b'VERSION 2\nTILEWIDTH 64\nTILEHEIGHT 64\nPIXELSIZE 4\nDATA '+str(len(blocks)).encode()+b'\n'
    for (x,y),tile in sorted(blocks.items()):data+=f'{x},{y},LZF,16385\n'.encode()+b'\0'+tile
    return data


def fixture(path,padding=0,mutate=None):
    root=ET.Element('DOC');image=ET.SubElement(root,'IMAGE',name='fixture',width='130',height='90',colorspacename='RGBA',profile='sRGB',**{'x-res':'72','y-res':'72'});ET.SubElement(image,'ProjectionBackgroundColor',ColorData=base64.b64encode(bytes(4)).decode());layers=ET.SubElement(image,'layers');group=ET.SubElement(layers,'layer',name='Group',nodetype='grouplayer',filename='group',uuid='group',visible='1',locked='0',opacity='255',passthrough='0');children=ET.SubElement(group,'layers')
    for lid in ['top','bottom']:
        ET.SubElement(children,'layer',name=lid,nodetype='paintlayer',filename=lid,uuid=lid,visible='1',locked='0',opacity='255',colorspacename='RGBA',compositeop='normal',keyframes=lid+'.xml',channellockflags='1111')
    ET.SubElement(layers,'layer',name='Hidden source',nodetype='paintlayer',filename='hidden',uuid='hidden',visible='0',locked='1',opacity='255',colorspacename='RGBA')
    animation=ET.SubElement(image,'animation');ET.SubElement(animation,'framerate',value='24');ET.SubElement(animation,'range',**{'from':'0','to':'11'});ET.SubElement(animation,'currentTime',value='0')
    items={'mimetype':b'application/x-krita','fixture/annotations/icc':ICC,'fixture/layers/top.icc':ICC,'fixture/layers/bottom.icc':ICC,'fixture/layers/hidden':b'NOT A SUPPORTED PAYLOAD; MUST NEVER BE READ','fixture/layers/hidden.icc':ICC}
    for lid in ['top','bottom']:
        keys=ET.Element('keyframes');channel=ET.SubElement(keys,'channel',name='content')
        for index,t in enumerate([0,4,8]):
            name=lid+str(index);key=ET.SubElement(channel,'keyframe',time=str(t),frame=name);ET.SubElement(key,'offset',x='0',y='0');color=[255,0,0,128] if lid=='top' else [0,0,255,255];items['fixture/layers/'+name]=native_tiles({(10+index,10):color,(-1,2):[33,44,55,255]});items['fixture/layers/'+name+'.defaultpixel']=bytes(4)
        items['fixture/layers/'+lid+'.xml']=ET.tostring(keys)
    items['maindoc.xml']=ET.tostring(root)
    if padding:items['unused-large-padding']=b'X'*padding
    if mutate:mutate(items)
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_STORED) as z:
        for name,value in items.items():z.writestr(name,value)
    return path


class KraWindowTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.directory=Path(self.temp.name)
    def test_xml_order_exact_alpha_window_timing_and_hidden_payload_is_not_read(self):
        path=fixture(self.directory/'native.kra')
        with KraWindow(path) as reader:
            p=reader.import_window(2,7);self.assertNotIn('fixture/layers/hidden',reader.read_members);self.assertEqual(p['layers']['top']['order'],0);self.assertEqual(p['layers']['bottom']['order'],1)
        self.assertEqual(p['shot']['duration_frames'],5);self.assertEqual(p['shot']['fps']['numerator'],24)
        self.assertEqual([(e['start'],e['length']) for e in p['exposures'] if e['layer_id']=='top'],[(0,2),(2,3)])
        w,h,raw=render(p,0);a=np.frombuffer(raw,np.uint8).reshape(h,w,4);self.assertEqual(a[10,10].tolist(),[128,0,127,255]);self.assertEqual(a[10,11].tolist(),[0,0,0,0]);self.assertEqual(np.frombuffer(render(p,2)[2],np.uint8).reshape(h,w,4)[10,11].tolist(),[128,0,127,255])
        self.assertEqual(len(p['native_window_source']['native_payloads']),4);self.assertTrue(all(f['decoded_details']['outside_canvas_nontransparent_samples']==1 for f in p['native_window_source']['frame_records']));self.assertEqual(validate_source(p)['archive_sha256'],reader.sha256)
    def test_large_archive_index_avoids_legacy_full_load_and_unselected_member_expansion(self):
        path=fixture(self.directory/'large.kra',padding=5*1024**2)
        with self.assertRaisesRegex(ValueError,'4MiB'):import_kra(path)
        with patch.object(Path,'read_bytes',side_effect=AssertionError('No whole-file read_bytes')):
            with KraWindow(path) as source:p=source.import_window(0,3,['top']);self.assertNotIn('unused-large-padding',source.read_members);self.assertLess(source.bytes_read,100000)
        self.assertEqual(len(p['drawings']),1);self.assertEqual(set(p['layers']),{'group','top'})
    def test_unaligned_offset_canvas_intersection_and_raw_bgra_samples(self):
        raw=native_tiles({(-1,0):[1,2,3,255],(0,0):[12,34,56,78],(63,63):[4,5,6,255],(64,63):[7,8,9,255],(1,1):[91,92,93,0]});plane,details=decode_plane(raw,130,90,(1,1))
        self.assertEqual(plane[1*130+1],[12,34,56,78]);self.assertEqual(plane[1*130+0],[1,2,3,255]);self.assertEqual(plane[64*130+64],[4,5,6,255]);self.assertEqual(plane[64*130+65],[7,8,9,255]);self.assertEqual(plane[2*130+2],[91,92,93,0]);self.assertEqual(details['outside_canvas_nontransparent_samples'],0)
        for bad_offset in [None,(1,),[0,0,0],[0,1.5]]:
            with self.assertRaises(ValueError):decode_plane(raw,130,90,bad_offset)
        cropped,details=decode_plane(raw,2,2);self.assertEqual(details['outside_canvas_nontransparent_samples'],3);self.assertEqual(cropped[0],[12,34,56,78])
    def test_compressed_planar_lzf_zero_tile_and_malformed_payloads(self):
        encoded=bytearray(b'\0\0');remaining=16383
        while remaining>=9:
            amount=min(264,remaining);encoded.extend([224,amount-9,0]);remaining-=amount
        if remaining:encoded.append(remaining-1);encoded.extend(bytes(remaining))
        payload=b'\1'+bytes(encoded);head=b'VERSION 2\nTILEWIDTH 64\nTILEHEIGHT 64\nPIXELSIZE 4\nDATA 1\n';raw=head+b'0,0,LZF,'+str(len(payload)).encode()+b'\n'+payload;plane,_=decode_plane(raw,64,64);self.assertEqual(plane.region_bytes(),bytes(16384))
        for bad in [raw+b'trailing',raw[:-1],raw.replace(b'0,0,LZF',b'1,0,LZF'),raw.replace(b'DATA 1',b'DATA 9000')]:
            with self.assertRaises(ValueError):decode_plane(bad,64,64)
    def test_roundtrip_edit_original_payloads_and_explicit_external_verification(self):
        path=fixture(self.directory/'native.kra')
        with KraWindow(path) as reader:p=reader.import_window(0,7)
        source=deepcopy(p['native_window_source']);s=Session(p);s.layer_id='top';s.correct({0:[1,2,3,4]});s.save(self.directory/'edited.aaa');q=Session.load(self.directory/'edited.aaa').project;self.assertEqual(q,s.project);self.assertEqual(q['native_window_source'],source);self.assertEqual(verify_external_source(q),path)
        with path.open('ab') as f:f.write(b'changed')
        with self.assertRaisesRegex(ValueError,'identity changed'):verify_external_source(q)
        # Loading an already detached project never opens its external archive.
        path.unlink();self.assertEqual(Session.load(self.directory/'edited.aaa').project,q)
    def test_manifest_or_native_payload_swap_refuses_without_source_io(self):
        path=fixture(self.directory/'native.kra')
        with KraWindow(path) as reader:p=reader.import_window(0,7)
        for change in ['manifest','blob']:
            q=deepcopy(p)
            if change=='manifest':q['native_window_source']['native_start']=1
            else:
                from engine.io.project_archive import SourceBlob
                name=next(iter(q['native_window_source']['native_payloads']));q['native_window_source']['native_payloads'][name]=SourceBlob(b'changed')
            with self.assertRaisesRegex(ValueError,'manifest changed'):Session(q)
    def test_profiles_masks_partial_channel_locks_default_pixel_and_entities_refuse(self):
        def mask(items):items['maindoc.xml']=items['maindoc.xml'].replace(b'name="top"',b'name="top"',1).replace(b'filename="top"',b'filename="top"',1);root=ET.fromstring(items['maindoc.xml']);node=next(n for n in root.iter('layer') if n.get('uuid')=='top');children=ET.SubElement(node,'layers');ET.SubElement(children,'layer',nodetype='transparencymask',filename='mask',uuid='mask');items['maindoc.xml']=ET.tostring(root)
        mutations=[(lambda m:m.__setitem__('fixture/annotations/icc',b'bad'),'ICC'),(lambda m:m.__setitem__('fixture/layers/top.icc',b'bad'),'ICC'),(lambda m:m.__setitem__('fixture/layers/top0.defaultpixel',b'\1\0\0\0'),'default pixel'),(lambda m:m.__setitem__('maindoc.xml',m['maindoc.xml'].replace(b'1111',b'1110',1)),'channel'),(mask,'masks'),(lambda m:m.__setitem__('maindoc.xml',b'<!DOCTYPE a [<!ENTITY x "bad">]>'+m['maindoc.xml']),'entities')]
        for index,(mutate,message) in enumerate(mutations):
            path=fixture(self.directory/(str(index)+'.kra'),mutate=mutate)
            with self.assertRaisesRegex(ValueError,message):
                with KraWindow(path) as reader:reader.import_window(0,7)
    def test_archive_change_cancellation_unsafe_paths_and_bad_requests(self):
        path=fixture(self.directory/'native.kra')
        with KraWindow(path) as reader:
            for args in [(True,4),(0,13),(4,4),(-1,3)]:
                with self.assertRaises(ValueError):reader.import_window(*args)
            for bad_layers in [['top','top'],[['top']],['top',False]]:
                with self.assertRaises(ValueError):reader.import_window(0,3,bad_layers)
            with path.open('ab') as f:f.write(b'changed')
            with self.assertRaisesRegex(ValueError,'changed'):reader.import_window(0,7)
        path=fixture(self.directory/'unsafe.kra',mutate=lambda m:m.__setitem__('../bad',b'bad'))
        with self.assertRaisesRegex(ValueError,'Unsafe'):KraWindow(path)
        with self.assertRaisesRegex(RuntimeError,'cancel'):KraWindow(path,checkpoint=lambda:(_ for _ in ()).throw(RuntimeError('cancel')))
    def test_nonzero_clip_start_preceding_key_and_native_layer_lock_are_preserved(self):
        def change(items):
            root=ET.fromstring(items['maindoc.xml']);root.find('.//range').set('from','2');root.find('.//layer[@uuid="top"]').set('locked','1');items['maindoc.xml']=ET.tostring(root)
        path=fixture(self.directory/'native.kra',mutate=change)
        with KraWindow(path) as reader:p=reader.import_window(3,6,['top'])
        self.assertTrue(p['layers']['top']['locked']);self.assertEqual(p['native_window_source']['source_clip'],[2,12]);self.assertEqual(p['native_window_source']['frame_records'][0]['native_time'],0);self.assertEqual(p['shot']['duration_frames'],3)
    def test_directory_bomb_bound_checked_before_zipfile_index(self):
        path=self.directory/'too-many.kra';path.write_bytes(struct.pack('<4s4H2LH',b'PK\5\6',0,0,40000,40000,0,0,0))
        with patch('zipfile.ZipFile',side_effect=AssertionError('Must reject before index allocation')):
            with self.assertRaisesRegex(ValueError,'directory'):KraWindow(path)

    def test_style_resources_require_explicit_raw_mode_and_survive_exact_roundtrip(self):
        from tests.test_asl_metadata import asl,STYLE
        def add_style(items):
            root=ET.fromstring(items['maindoc.xml']);node=root.find('.//layer[@uuid="top"]');node.set('layerstyle','{'+STYLE+'}');items['maindoc.xml']=ET.tostring(root);items['fixture/annotations/layerstyles.asl']=asl()
        path=fixture(self.directory/'styled.kra',mutate=add_style)
        with KraWindow(path) as reader:
            with self.assertRaisesRegex(ValueError,'styles'):reader.import_window(0,7)
            p=reader.import_window(0,7,style_policy='retain_unrendered')
        self.assertIn('NOT RENDERED',p['import_note']);self.assertEqual(p['native_window_source']['style_library'].data,asl());self.assertEqual(p['native_window_source']['style_metadata']['style_count'],1);self.assertEqual(p['native_window_source']['unrendered_style_layers'],{'top':'{'+STYLE+'}'})
        s=Session(p);s.save(self.directory/'styled.aaa');self.assertEqual(Session.load(self.directory/'styled.aaa').project,s.project)

    def test_existing_real_native_fixture_cached_projection_matches_supported_window(self):
        from engine.io.png_codec import read_png
        with KraWindow(ACTUAL) as reader:
            p=reader.import_window(reader.current_time,reader.current_time+1)
        w,h,pixels=read_png(p['native_window_source']['cached_projection'].data,packed=True)
        self.assertEqual(render(p,0),(w,h,pixels.region_bytes()))

if __name__=='__main__':unittest.main()
