"""Optional pinned local JPEG decoder. No drawing inference or image uploads.

Run with the cleared Python/Pillow backend; --credits needs no Pillow. Exact JPEG
bytes/EXIF remain private alongside an orientation-correct RGBA preview.
"""
from pathlib import Path
import argparse,sys,json,hashlib,io,struct,zlib,math,warnings
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))

def decode(path,output):
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT)
    components={c['component_id']:c for c in credits['components']}
    from PIL import Image,ImageOps,__version__,features
    from PIL import _imaging
    if __version__!='12.3.0' or hashlib.sha256(Path(_imaging.__file__).read_bytes()).hexdigest()!=components['COMP-PILLOW-BUNDLED-12-3-0']['artifact_sha256']:raise ValueError('Optional codec identity differs from cleared component; audit/register this runtime before use')
    if sys.version_info[:3]!=(3,12,14):raise ValueError('Optional codec interpreter differs from cleared3.12.14 runtime')
    if hashlib.sha256((Path(sys.base_prefix)/'python312.dll').read_bytes()).hexdigest()!=components['COMP-PYTHON-BUNDLED-3-12-14']['artifact_sha256']:raise ValueError('Optional interpreter binary differs from cleared component')
    path=Path(path);output=Path(output)
    if output.exists():raise ValueError('Photo output must be NEW; preserve previous studies')
    stat=path.stat()
    if not 4<=stat.st_size<=32*1024**2:raise ValueError('JPEG source must be<=32MiB')
    original=path.read_bytes();identity=hashlib.sha256(original).hexdigest();Image.MAX_IMAGE_PIXELS=4096*4096
    with warnings.catch_warnings():
        warnings.simplefilter('error',Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(original),formats=['JPEG']) as image:
            if image.format!='JPEG' or image.mode not in {'RGB','L'} or getattr(image,'n_frames',1)!=1:raise ValueError('Only single-frame RGB/grayscale JPEG supported; no CMYK/MPO inference')
            w,h=image.size
            if not 1<=w<=4096 or not 1<=h<=4096:raise ValueError('Decoded JPEG sides must be<=4096; no silent downsampling')
            profile=image.info.get('icc_profile')
            if profile and len(profile)>1024**2:raise ValueError('ICC profile exceeds1MiB')
            orientation=image.getexif().get(274,1)
            if type(orientation) is not int or not 1<=orientation<=8:raise ValueError('Invalid EXIF orientation')
            raw_dpi=image.info.get('dpi');dpi=list(raw_dpi) if isinstance(raw_dpi,(tuple,list)) and len(raw_dpi)==2 and all(type(v) in (int,float) and math.isfinite(v) and v>0 for v in raw_dpi) else None
            image.load();oriented=ImageOps.exif_transpose(image)
            target_bytes=None
            if profile:
                from PIL import ImageCms,_imagingcms
                if hashlib.sha256(Path(_imagingcms.__file__).read_bytes()).hexdigest()!=components['COMP-LCMS-BUNDLED-2-19-1']['artifact_sha256']:raise ValueError('Color runtime identity differs from cleared component')
                target=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB'));target_bytes=target.tobytes()
                oriented=ImageCms.profileToProfile(oriented,ImageCms.ImageCmsProfile(io.BytesIO(profile)),target,renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,outputMode='RGB')
            rgba=oriented.convert('RGBA');ow,oh=rgba.size;pixels=rgba.tobytes()
    after=path.stat()
    if (stat.st_size,stat.st_mtime_ns)!=(after.st_size,after.st_mtime_ns) or hashlib.sha256(path.read_bytes()).hexdigest()!=identity:raise ValueError('JPEG changed while decoding')
    from engine.io.png_codec import SIGNATURE,chunk
    scan=b''.join(b'\0'+pixels[y*ow*4:(y+1)*ow*4] for y in range(oh))
    png=SIGNATURE+chunk(b'IHDR',struct.pack('>IIBBBBB',ow,oh,8,6,0,0,0))+chunk(b'sRGB',b'\1' if profile else b'\0')+chunk(b'IDAT',zlib.compress(scan))+chunk(b'IEND',b'')
    output.mkdir(parents=True,exist_ok=False);(output/'original.jpg').write_bytes(original);(output/'oriented.png').write_bytes(png)
    if profile:
        (output/'source-profile.icc').write_bytes(profile);(output/'preview-profile.icc').write_bytes(target_bytes)
    report=dict(status='decoded-photo-preview',source_sha256=identity,source_bytes=len(original),source_mtime_ns=stat.st_mtime_ns,original_size=[w,h],oriented_size=[ow,oh],exif_orientation=orientation,dpi=dpi,color_assumption='Untagged RGB/grayscale decoded as sRGB preview; no ICC/color calibration or linear-light claim',original_exif_retained_in_jpeg=True,orientation_applied_to_preview_only=True,decoded_rgba_sha256=hashlib.sha256(pixels).hexdigest(),preview_png_sha256=hashlib.sha256(png).hexdigest(),pillow_version=__version__,libjpeg_turbo=features.version_feature('libjpeg_turbo'),libimagequant_available=features.check_feature('libimagequant'),credits_snapshot=credits['snapshot_sha256'])
    report.update(color_assumption='Embedded ICC converted to sRGB with relative colorimetric intent; no camera/paper/lighting calibration' if profile else report['color_assumption'],source_profile_sha256=hashlib.sha256(profile).hexdigest() if profile else None,preview_profile_sha256=hashlib.sha256(target_bytes).hexdigest() if target_bytes else None,rendering_intent='relative-colorimetric' if profile else None)
    (output/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    for name in ['CREDITS.md','credits.json','THIRD_PARTY_NOTICES.txt']:(output/name).write_bytes((ROOT/'generated'/name).read_bytes())
    runs=output/'provenance/runs';runs.mkdir(parents=True);(runs/'decode-photo.json').write_text(json.dumps(dict(schema_version='1.0',operation='jpeg-orientation-preview',source_sha256=identity,output_sha256=report['preview_png_sha256'],credits_snapshot=credits['snapshot_sha256'],component_ids=['COMP-PYTHON-BUNDLED-3-12-14','COMP-PILLOW-BUNDLED-12-3-0']+(['COMP-LCMS-BUNDLED-2-19-1'] if profile else []),source_ids=['REF-PILLOW-12-3-0','REF-PILLOW-LICENSE','REF-PILLOW-IMAGEOPS','REF-PILLOW-JPEG','REF-LIBJPEG-TURBO','REF-PYTHON-BUNDLED-LICENSE','REF-OWNER-PRIVATE-SAMPLES']+(['REF-PILLOW-IMAGECMS','REF-LCMS-LICENSE'] if profile else []),network_allowed=False,source_unchanged=True),indent=2)+'\n',encoding='utf-8');return report

def main():
    p=argparse.ArgumentParser();p.add_argument('source',nargs='?',type=Path);p.add_argument('output',nargs='?',type=Path);p.add_argument('--credits',action='store_true');args=p.parse_args()
    if args.credits:print((ROOT/'generated/CREDITS.md').read_text(encoding='utf-8'));return
    if not args.source or not args.output:p.error('Provide JPEG and NEW private output directory')
    print(json.dumps(decode(args.source,args.output)))

if __name__=='__main__':main()
