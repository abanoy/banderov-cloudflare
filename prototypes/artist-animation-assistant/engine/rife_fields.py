"""Optional pinned RIFE4.6 CPU field adapter, EXP0035.

Uses MIT converted graph/weights and BSD ncnn, full notices in CREDITS. NumPy
Warp implements the documented border/bilinear operator independently. No training,
model-zoo imports, automatic download, Tk, GPU or network operation.
"""
from pathlib import Path
import hashlib,json,sys
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
MAX_INPUT_PIXELS=1024*768


def bilinear_chw(image,flow):
    """Pinned model's RGB Warp semantics: backward pixel displacement, border pad."""
    c,h,w=image.shape
    if flow.shape!=(2,h,w):raise ValueError('Warp flow shape differs')
    yy,xx=np.mgrid[:h,:w];x=np.clip(xx.astype(np.float32)+flow[0],0,w-1);y=np.clip(yy.astype(np.float32)+flow[1],0,h-1);x0=np.floor(x).astype(np.int64);y0=np.floor(y).astype(np.int64);x1=np.minimum(x0+1,w-1);y1=np.minimum(y0+1,h-1);a=x-x0;b=y-y0
    return np.ascontiguousarray((image[:,y0,x0]*(1-a)+image[:,y0,x1]*a)*(1-b)+(image[:,y1,x0]*(1-a)+image[:,y1,x1]*a)*b,dtype=np.float32)


def installation():
    from scripts.credits import build
    from scripts.provenance_gate import verify_ui
    credits=build(check=True);verify_ui(ROOT);path=ROOT/'models/rife-ncnn-audit/execution-manifest.json'
    if not path.is_file():raise ValueError('Optional pinned RIFE/ncnn runtime is not configured; no automatic download')
    manifest=json.loads(path.read_text());components={row['component_id']:row for row in credits['components']}
    if manifest['runtime_files']!=components[manifest['runtime_component']]['artifacts'] or manifest['model_files']!=components[manifest['model_component']]['artifacts']:raise ValueError('Optional manifest differs from registered component artifacts')
    for cid in manifest['component_ids']:
        if cid not in components or not components[cid]['execution_allowed'] or not components[cid]['permission_state'].startswith('permitted'):raise ValueError('RIFE component is not cleared: '+cid)
    for row in manifest['runtime_files']+manifest['model_files']:
        file=(ROOT/row['path']).resolve()
        if not file.is_relative_to((ROOT/'models').resolve()) or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Pinned optional runtime/model artifact changed: '+row['path'])
    manifest['credits_snapshot']=credits['snapshot_sha256'];return manifest


def infer(first,second,progress,checkpoint=None):
    """Return midpoint→both-key flow and source blend weight, not calibrated confidence."""
    checkpoint=checkpoint or (lambda:None);manifest=installation()
    if not isinstance(first,np.ndarray) or first.dtype!=np.float32 or first.ndim!=3 or first.shape[0]!=3 or second.shape!=first.shape or second.dtype!=np.float32:raise ValueError('Two float32 RGB CHW arrays required')
    _,h,w=first.shape
    if min(h,w)<32 or max(h,w)>1024 or h*w>MAX_INPUT_PIXELS or not np.isfinite(first).all() or not np.isfinite(second).all() or min(first.min(),second.min())<0 or max(first.max(),second.max())>1:raise ValueError('Bounded RGB input32..1024, area<=786432and range0..1required')
    if type(progress) not in (int,float) or not np.isfinite(progress) or not 0<progress<1:raise ValueError('Learned interpolation requires an interior phase0..1')
    checkpoint();runtime=str(ROOT/manifest['runtime'])
    if runtime not in sys.path:sys.path.insert(0,runtime)
    import ncnn
    expected=(ROOT/manifest['runtime']/'ncnn/__init__.py').resolve()
    if Path(ncnn.__file__).resolve()!=expected or ncnn.__version__!='1.0.20261020':raise ValueError('A different ncnn runtime is already imported')
    # Keep Python layer objects alive through Net.clear; Mat borrows NumPy buffers.
    live=[];calls=0
    class Warp(ncnn.Layer):
        def __init__(self):super().__init__();self.one_blob_only=False
        def forward(self,bottoms,tops,opt):
            nonlocal calls
            checkpoint();calls+=1;value=bilinear_chw(np.array(bottoms[0]),np.array(bottoms[1]));tops[0].clone_from(ncnn.Mat(value));return 0
    def create():
        layer=Warp();live.append(layer);return layer
    def destroy(layer):live.remove(layer)
    net=ncnn.Net();net.opt.use_vulkan_compute=False;net.opt.num_threads=2;net.opt.use_packing_layout=False;net.opt.use_fp16_storage=False;net.opt.use_fp16_arithmetic=False;net.opt.use_bf16_storage=False
    assert net.register_custom_layer('rife.Warp',create,destroy)==0
    model={Path(row['path']).suffix:ROOT/row['path'] for row in manifest['model_files']}
    try:
        if net.load_param(str(model['.param']))!=0 or net.load_model(str(model['.bin']))!=0:raise ValueError('Pinned RIFE graph/weights could not load')
        ph=(-h)%32;pw=(-w)%32;arrays=[np.ascontiguousarray(np.pad(a,((0,0),(0,ph),(0,pw)),mode='edge')) for a in [first,second]];arrays.append(np.full((1,h+ph,w+pw),progress,np.float32))
        with net.create_extractor() as ex:
            ex.set_light_mode(False)
            for name,array in zip(['in0','in1','in2'],arrays):
                if ex.input(name,ncnn.Mat(array).clone())!=0:raise ValueError('RIFE input binding failed')
            outputs={}
            for name in ['327','332','out0']:
                checkpoint();code,value=ex.extract(name)
                if code!=0:raise ValueError('RIFE field extraction failed: '+name)
                outputs[name]=np.array(value).copy()
        flow=outputs['327'][:,:h,:w];weight=outputs['332'][:,:h,:w];rgb=outputs['out0'][:,:h,:w]
        if flow.shape!=(4,h,w) or weight.shape!=(1,h,w) or rgb.shape!=(3,h,w) or any(not np.isfinite(value).all() for value in [flow,weight,rgb]):raise ValueError('Model returned invalid/nonfinite fields')
        if np.max(np.abs(flow))>2*max(w,h) or weight.min()<0 or weight.max()>1:raise ValueError('Predicted field exceeds declared displacement/weight bounds')
        reconstructed=bilinear_chw(first,flow[:2])*weight+bilinear_chw(second,flow[2:])*(1-weight)
        error=float(np.max(np.abs(reconstructed-rgb)))
        if error>2e-4:raise ValueError('Extracted flow/mask does not reconstruct model RGB: '+str(error))
        active_sources=[s for s in manifest['source_ids'] if s not in {'REF-RAFT-SMALL','REF-DIS-FLOW','REF-OPENCV-LICENSE'}]
        checkpoint();return dict(flow0=np.ascontiguousarray(flow[:2]),flow1=np.ascontiguousarray(flow[2:]),weight=np.ascontiguousarray(weight[0]),rgb=np.ascontiguousarray(rgb),metadata=dict(backend='rife-v4.6-ncnn-cpu',working_size=[w,h],padded_size=[w+pw,h+ph],progress=progress,threads=2,custom_warp_calls=calls,reconstruction_max_error=error,source_ids=active_sources,component_ids=manifest['component_ids'],credits_snapshot=manifest['credits_snapshot'],artifact_sha256={row['path']:row['sha256'] for row in manifest['model_files']}))
    finally:net.clear()
