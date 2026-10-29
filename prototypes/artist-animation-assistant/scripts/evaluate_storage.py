"""Original storage-only scale probe; not a claim of large-canvas UI/model support."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine.io.project_archive import PixelPlane,PackedArchive,save_archive


def run(output):
    from scripts.credits import build
    credits=build(check=True)
    output.mkdir(parents=True,exist_ok=False)
    records=[]
    for w,h,label in [(1920,1080,'rgba-texture'),(2048,2048,'flat-and-edge'),(4096,4096,'4k-flat')]:
        t=time.perf_counter()
        raw=bytes((i*37+i//491)%256 for i in range(w*h*4)) if label=='rgba-texture' else bytes([40,90,160,128])*(w*h)
        source=PixelPlane.from_rgba(w,h,raw);packing=time.perf_counter()-t
        versions=[source];edits={};t=time.perf_counter()
        for i in range(100):
            index=(i*19877)%len(source);color=[i,250-i,130,0 if i%3==0 else 77]
            edits[index]=color;versions.append(versions[-1].with_edits({index:color}))
        editing=time.perf_counter()-t
        document=dict(schema_version='packed-backend-probe-1',project_id=label,canvas=dict(width=w,height=h,color_profile='sRGB',alpha_mode='straight',dpi={'x':300,'y':300}),originals={'source':dict(pixels=source,approved=True,locked=True)},drawings={str(i):dict(pixels=plane,origin='original_synthetic_storage_probe',approved=True,locked=i>0,protected_pixels=list(edits)[:i]) for i,plane in enumerate(versions)},shot=dict(fps=dict(numerator=24000,denominator=1001),duration_frames=12),exposures=[dict(layer_id='ink',drawing_id='0',start=0,length=4),dict(layer_id='ink',drawing_id='100',start=4,length=8)],palettes={'coat':dict(rgba=[50,120,220,128])},analysis={'kind':'metadata_preservation_only','warning':'Not a host-supported project schema; memory/render migration is next'})
        path=output/f'{label}.aaa';t=time.perf_counter();saved=save_archive(path,document);saving=time.perf_counter()-t
        t=time.perf_counter()
        with PackedArchive(path,cache_bytes=1024*1024) as archive:
            opening=time.perf_counter()-t;reads_before=archive.asset_reads
            plane=archive.project['drawings']['100']['pixels'];t=time.perf_counter();roi=plane.region_bytes((61,61,71,71));roi_seconds=time.perf_counter()-t
            expected=bytearray(b''.join(raw[(y*w+61)*4:(y*w+71)*4] for y in range(61,71)))
            for index,color in edits.items():
                y,x=divmod(index,w)
                if 61<=x<71 and 61<=y<71:
                    offset=((y-61)*10+x-61)*4;expected[offset:offset+4]=bytes(color)
            assert roi==bytes(expected)
            reads_roi=archive.asset_reads
            assert reads_before==0 and reads_roi<=4
            assert archive.project['originals']['source']['pixels'].region_bytes()==raw
            assert plane[0]==edits[0] and archive.project['originals']['source']['pixels'][0]==list(raw[:4])
            assert archive.project['shot']==document['shot'] and archive.project['exposures']==document['exposures'] and archive.project['palettes']==document['palettes']
            verified=archive.verify_all();cache=archive.bytes_cached
            assert cache<=1024*1024
            assert deepcopy(plane) is plane
            for i,index in enumerate(list(edits)[:8]):assert archive.project['drawings'][str(i+1)]['pixels'][index]==edits[index]
        records.append(dict(case=label,width=w,height=h,versions=101,edits=100,source_rgba_sha256=hashlib.sha256(raw).hexdigest(),source_preserved=True,metadata_exact=True,roi_exact=True,verified_tile_assets=verified,lazy_initial_tile_reads=reads_before,roi_tile_reads=reads_roi,tile_cache_bytes=cache,packing_seconds=packing,edits_seconds=editing,save_seconds=saving,open_metadata_seconds=opening,roi_seconds=roi_seconds,equivalent_full_rgba_bytes=w*h*4*102,comparison_scope='Theoretical full RGBA payload for101drawings+original, not an executed competing format or artist benchmark',**saved))
    report=dict(status='passed_storage_backend_only',credits_snapshot_sha256=credits['snapshot_sha256'],records=records,scope='Original packed RGBA synthetic textures,100 immutable edits at1920x1080/2048x2048/4096x4096. Native model/rendering still256px/list-based. No owner art/model/inference/artist-effort claim.',source_sha256={n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in ['engine/io/project_archive.py','scripts/evaluate_storage.py']})
    (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);run(parser.parse_args().output.resolve())
