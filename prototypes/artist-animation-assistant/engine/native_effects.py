"""Independent experimental editable shadow/glow renderer.

REF-KRITA-EFFECT-{PIPELINE,UTILS,ORDER,DEFAULTS,SERIALIZER},
REF-KRITA-GAUSSIAN, REF-NUMPY-FFT, REF-COMPOSITING.
No upstream code copied/executed. Explicit API only: host raw renderer unchanged.
"""
import math
from copy import deepcopy
import numpy as np
from engine.packed_render import sample,over
from engine.io.project_archive import PixelPlane,MemoryTiles

VERSION='native-effects-experimental-1'
KINDS={'DrSh':'shadow','IrGl':'inner_glow','OrGl':'outer_glow'}

def _number(v,lo,hi):
    if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError('Effect numeric value outside supported bounds')
    return v

def _simple(v):
    if isinstance(v,dict) and set(v)=={'type','value'}:return _simple(v['value'])
    if isinstance(v,dict) and set(v)=={'name','class_id','items'}:return {k:_simple(x) for k,x in v['items'].items()}
    if isinstance(v,list):return [_simple(x) for x in v]
    return v

def _unit(items,key,unit,lo,hi):
    v=items.get(key)
    if not isinstance(v,dict) or set(v)!={'unit','value'} or v['unit']!=unit:raise ValueError('Unsupported native effect unit: '+key)
    return _number(v['value'],lo,hi)

def _flag(items,key):
    v=items.get(key)
    if type(v) is not bool:raise ValueError('Effect boolean missing: '+key)
    return v

def compile_styles(project):
    """Return editable JSON parameters separate from immutable native source bytes.

    Refuse unsupported semantics rather than silently ignore enabled effects.
    Currently linear contours, softer glows, no spread/noise/jitter, scale100.
    """
    from engine.io.kra_window import validate_source
    source=validate_source(project);meta=source.get('style_metadata');mapping={}
    if meta:
        if meta['patterns_bytes']:raise ValueError('Native style patterns not supported')
        for row in meta['styles']:
            a=_simple(row['identification']);b=_simple(row['style'])
            identity=a['Idnt'].strip('{}').lower()
            if identity in mapping:raise ValueError('Duplicate native style identity')
            fx=b.get('Lefx')
            if not isinstance(fx,dict):raise ValueError('Native effects descriptor missing')
            if _unit(fx,'Scl ','#Prc',100,100)!=100:raise ValueError('Unsupported native effect scale')
            enabled=_flag(fx,'masterFXSwitch');effects=[]
            for key,cfg in fx.items():
                if key in {'Scl ','masterFXSwitch'}:continue
                if not isinstance(cfg,dict) or type(cfg.get('enab')) is not bool:raise ValueError('Unknown native effect metadata: '+key)
                if not enabled or not cfg['enab']:continue
                if key not in KINDS:raise ValueError('Unsupported enabled native effect: '+key)
                common={'enab','Md  ','Clr ','Opct','Ckmt','blur','Nose','AntA','TrnS'}
                extra={'uglg','lagl','Dstn','layerConceals'} if key=='DrSh' else {'GlwT','ShdN','Inpr'}|({'glwS'} if key=='IrGl' else set())
                if set(cfg)!=common|extra:raise ValueError('Unknown/missing native effect parameter')
                _unit(cfg,'Ckmt','#Pxl',0,0);_unit(cfg,'Nose','#Prc',0,0);aa=_flag(cfg,'AntA')
                contour=cfg['TrnS']
                if not isinstance(contour,dict) or set(contour)!={'Nm  ','Crv '} or contour['Crv ']!=[{'Hrzn':0.0,'Vrtc':0.0},{'Hrzn':255.0,'Vrtc':255.0}]:raise ValueError('Only linear native contour supported')
                blend=cfg['Md  ']
                if not isinstance(blend,dict) or blend.get('enum')!='BlnM' or blend.get('value') not in {'Mltp','linearDodge','Nrml'}:raise ValueError('Unsupported native effect blend')
                color=cfg['Clr ']
                if not isinstance(color,dict) or set(color)!={'Rd  ','Grn ','Bl  '}:raise ValueError('Only RGB effect colors supported')
                rgb=[_number(color[c],0,255) for c in ['Rd  ','Grn ','Bl  ']]
                size=_unit(cfg,'blur','#Pxl',0,256);opacity=_unit(cfg,'Opct','#Prc',0,100)
                if size!=int(size) or opacity!=int(opacity):raise ValueError('Fractional native effect integer settings unsupported')
                effect=dict(kind=KINDS[key],enabled=True,color=rgb,blend={'Mltp':'multiply','linearDodge':'add','Nrml':'normal'}[blend['value']],opacity=opacity,size=size,anti_alias=aa,range=100,offset=[0,0],knockout=False)
                if key=='DrSh':
                    _flag(cfg,'uglg');angle=_unit(cfg,'lagl','#Ang',-360,360);distance=_unit(cfg,'Dstn','#Pxl',0,256)
                    effect['offset']=[-_round(distance*math.cos(math.radians(angle))),_round(distance*math.sin(math.radians(angle)))];effect['knockout']=_flag(cfg,'layerConceals')
                else:
                    if cfg['GlwT']!={'enum':'BETE','value':'SfBL'}:raise ValueError('Only softer native glow supported')
                    _unit(cfg,'ShdN','#Prc',0,0);effect['range']=_unit(cfg,'Inpr','#Prc',100,100)
                    if key=='IrGl' and cfg['glwS']!={'enum':'IGSr','value':'SrcE'}:raise ValueError('Only edge-source inner glow supported')
                    effect['knockout']=key=='OrGl'
                effects.append(effect)
            mapping[identity]=effects
    layers={}
    for layer_id,style_id in source.get('unrendered_style_layers',{}).items():
        if project['layers'][layer_id].get('nodetype')=='grouplayer':raise ValueError('Native group styles not supported')
        layers[layer_id]=deepcopy(mapping[style_id.strip('{}').lower()])
    params=dict(version=VERSION,layers=layers,source_manifest=source['manifest_sha256'])
    validate_parameters(project,params);return params

def _round(v):return int(math.copysign(math.floor(abs(v)+0.5),v))

def validate_parameters(project,params):
    if not isinstance(params,dict) or set(params)!={'version','layers','source_manifest'} or params['version']!=VERSION:raise ValueError('Unknown native effects schema')
    from engine.io.kra_window import validate_source
    source=validate_source(project)
    if not isinstance(params['layers'],dict):raise ValueError('Invalid effect layer mapping')
    if params['source_manifest']!=source['manifest_sha256'] or set(params['layers'])!=set(source['unrendered_style_layers']):raise ValueError('Effect source/layer binding changed')
    for identity,effects in params['layers'].items():
        if not isinstance(effects,list) or len(effects)>3:raise ValueError('Effect count bound')
        kinds=[]
        for e in effects:
            if not isinstance(e,dict) or set(e)!={'kind','enabled','color','blend','opacity','size','anti_alias','range','offset','knockout'}:raise ValueError('Unknown effect parameters')
            if e['kind'] not in KINDS.values() or e['kind'] in kinds:raise ValueError('Unknown/duplicate effect kind')
            kinds.append(e['kind'])
            if e['blend'] not in {'multiply','add','normal'}:raise ValueError('Unsupported effect blend')
            for key in ['enabled','anti_alias','knockout']:
                if type(e[key]) is not bool:raise ValueError('Invalid effect boolean')
            _number(e['size'],0,256);_number(e['opacity'],0,100);_number(e['range'],100,100)
            if type(e['color']) is not list or len(e['color'])!=3:raise ValueError('Invalid RGB effect color')
            for c in e['color']:_number(c,0,255)
            if type(e['offset']) is not list or len(e['offset'])!=2 or any(type(n) is not int or not -256<=n<=256 for n in e['offset']):raise ValueError('Invalid effect offset')
            if e['kind']!='shadow' and e['offset']!=[0,0]:raise ValueError('Glow offset unsupported')
    return params

def gaussian(alpha,radius,checkpoint=lambda:None):
    """Zero-extended finite Gaussian; no wrap or edge replication.

    Independent blockwise real FFT linear convolution. Native radius convention;
    quantize once after2D convolution (native FFT route), not after each axis.
    """
    _number(radius,0,256)
    if not isinstance(alpha,np.ndarray) or alpha.ndim!=2 or alpha.dtype!=np.uint8 or max(alpha.shape)>6144 or min(alpha.shape)<1:raise ValueError('Invalid effect alpha input')
    if radius==0:return alpha.copy()
    sigma=0.3*radius+0.3;half=3*math.ceil(sigma);x=np.arange(-half,half+1,dtype=np.float64);kernel=np.exp(-0.5*(x/sigma)**2);kernel/=kernel.sum()
    result=alpha.astype(np.float64)
    for axis in [1,0]:
        src=np.moveaxis(result,axis,-1);out=np.empty_like(src);n=1<<(src.shape[-1]+len(kernel)-2).bit_length();spectrum=np.fft.rfft(kernel,n)
        for start in range(0,src.shape[0],32):
            checkpoint();rows=src[start:start+32];out[start:start+32]=np.fft.irfft(np.fft.rfft(rows,n,axis=-1)*spectrum,n,axis=-1)[:,half:half+src.shape[-1]]
        result=np.moveaxis(out,-1,axis)
    return np.floor(np.clip(result,0,255)+0.5).astype(np.uint8)

def effect_mask(alpha,e,checkpoint=lambda:None):
    inner=e['kind']=='inner_glow';base=255-alpha if inner else alpha
    # The outside of an inverted source is opaque; blur its complement to avoid
    # artificial inner glow at the padded image border.
    mask=255-gaussian(255-base,e['size'],checkpoint) if inner else gaussian(base,e['size'],checkpoint)
    v=np.arange(256,dtype=np.float64)
    lookup=v if e['anti_alias'] else np.floor(np.floor(v/2.55)*2.55+0.5)
    if not inner:
        # The native edge-hidden ramp is nonlinear at the last two ramp entries.
        ramp=np.minimum(v*11,255);ramp[21:23]=[242,253];lookup=np.floor(ramp*lookup/256)
    mask=lookup[mask].astype(np.uint8)
    dx,dy=e['offset']
    if dx or dy:
        out=np.zeros_like(mask);h,w=mask.shape
        xa,xb=max(0,-dx),min(w,w-dx);ya,yb=max(0,-dy),min(h,h-dy)
        if xa<xb and ya<yb:out[ya+dy:yb+dy,xa+dx:xb+dx]=mask[ya:yb,xa:xb]
        mask=out
    if e['knockout']:mask=((mask.astype(np.uint32)*(255-alpha)+127)//255).astype(np.uint8)
    return mask

def blend(bottom,top,mode,opacity=255):
    if mode=='normal':return over(bottom,top,opacity)
    if mode not in {'multiply','add'}:raise ValueError('Unsupported blend')
    b=bottom.astype(np.float64)/255;s=top.astype(np.float64)/255;ab=b[:,:,3:4];a=s[:,:,3:4]*opacity/255
    overlap=b[:,:,:3]*s[:,:,:3] if mode=='multiply' else np.minimum(b[:,:,:3]+s[:,:,:3],1)
    final=a+ab*(1-a);premul=(1-a)*ab*b[:,:,:3]+(1-ab)*a*s[:,:,:3]+a*ab*overlap
    out=np.zeros_like(b);np.divide(premul,final,out=out[:,:,:3],where=final>0);out[:,:,3:4]=final
    return np.floor(np.clip(out,0,1)*255+0.5).astype(np.uint8)

def native_record(project,layer_id,drawing_id):
    """Native off-canvas lineage follows the exposed drawing, never shot clock."""
    source=project['native_window_source'];seen=set()
    while drawing_id is not None:
        if drawing_id in seen or len(seen)>=512:raise ValueError('Invalid native effect drawing ancestry')
        seen.add(drawing_id)
        records=[f for f in source['frame_records'] if f['layer_id']==layer_id and f['drawing_id']==drawing_id]
        if records:return records[0]
        drawing=project['drawings'].get(drawing_id)
        if drawing is None:raise ValueError('Native effect parent drawing missing')
        parent=drawing.get('parent_drawing')
        if parent is None and drawing.get('origin')=='artist_correction':raise ValueError('Correction native off-canvas lineage unresolved')
        drawing_id=parent
    return None


def render(project,slot,parameters=None,checkpoint=lambda:None):
    """Full-resolution explicit preview. Retains original off-canvas effect input.

    Never opens an external path; uses retained exact keys and current editable
    canvas intersections. Caller must run off the GUI callback. Returns RGBA tuple.
    """
    from engine.layers import validate_layers
    from engine.io.kra_window import decode_plane
    validate_layers(project);params=parameters if parameters is not None else project.get('native_effects')
    if params is None:params=compile_styles(project)
    validate_parameters(project,params);w,h=project['canvas']['width'],project['canvas']['height']
    if type(slot) is not int or not 0<=slot<project['shot']['duration_frames']:raise ValueError('Effect slot outside shot')
    active=[e for effects in params['layers'].values() for e in effects if e['enabled']]
    pad=max([0]+[3*math.ceil(0.3*e['size']+0.3)+max(abs(n) for n in e['offset']) for e in active]);pw,ph=w+2*pad,h+2*pad
    if active and max(pw,ph)>4096:raise ValueError('Native effect halo exceeds4096px retained-plane bound; narrow the canvas')
    if pw*ph>25_000_000:raise ValueError('Effect working area exceeds25million pixels; narrow input')
    source=project['native_window_source'];xs=np.arange(w);ys=np.arange(h);ranks={k:i for i,k in enumerate(project['layers'])}
    def children(parent):
        backdrop=np.zeros((h,w,4),dtype=np.uint8)
        for identity,layer in sorted([(i,l) for i,l in project['layers'].items() if l.get('parent_id')==parent],key=lambda p:(p[1].get('order',0),ranks[p[0]]),reverse=True):
            checkpoint()
            if not layer.get('visible',True):continue
            opacity=layer.get('opacity',255)
            if layer.get('nodetype')=='grouplayer':
                if layer.get('isolation','isolate')!='isolate':raise ValueError('Effect renderer requires isolated groups')
                backdrop=over(backdrop,children(identity),opacity);continue
            exposure=next(e for e in project['exposures'] if e['layer_id']==identity and e['start']<=slot<e['start']+e['length']);plane=project['drawings'][exposure['drawing_id']]['pixels']
            if not isinstance(plane,PixelPlane):plane=PixelPlane.from_pixels(w,h,plane)
            pixels=sample(plane,xs,ys);effects=[e for e in params['layers'].get(identity,[]) if e['enabled']]
            if not effects:backdrop=over(backdrop,pixels,opacity);continue
            padded=np.zeros((ph,pw),dtype=np.uint8)
            record=native_record(project,identity,exposure['drawing_id'])
            if record and record['record']:
                r=record['record'];off=r['offset'];store=MemoryTiles();native,_=decode_plane(source['native_payloads'][r['member']].data,pw,ph,(off[0]+pad,off[1]+pad),store,checkpoint)
                for row in range(0,ph,128):padded[row:row+128]=sample(native,np.arange(pw),np.arange(row,min(ph,row+128)))[:,:,3]
            padded[pad:pad+h,pad:pad+w]=pixels[:,:,3]
            masks={e['kind']:effect_mask(padded,e,checkpoint)[pad:pad+h,pad:pad+w] for e in effects}
            for e in effects:
                if e['kind']!='shadow':continue
                top=np.empty_like(pixels);top[:,:,:3]=np.floor(np.array(e['color'])+0.5);top[:,:,3]=masks[e['kind']];backdrop=blend(backdrop,top,e['blend'],opacity*e['opacity']/100)
            content=pixels.copy()
            for e in effects:
                if e['kind']!='inner_glow':continue
                opaque=content.copy();opaque[:,:,3]=255;top=np.empty_like(pixels);top[:,:,:3]=np.floor(np.array(e['color'])+0.5);top[:,:,3]=masks[e['kind']]
                content[:,:,:3]=blend(opaque,top,e['blend'],opacity*e['opacity']/100)[:,:,:3]
            backdrop=over(backdrop,content,opacity)
            for e in effects:
                if e['kind']!='outer_glow':continue
                top=np.empty_like(pixels);top[:,:,:3]=np.floor(np.array(e['color'])+0.5);top[:,:,3]=masks[e['kind']];backdrop=blend(backdrop,top,e['blend'],opacity*e['opacity']/100)
        return backdrop
    return w,h,children(None).tobytes()
