"""Explicit binary ownership domains and four-neighbor component seed hints.

REF-KRITA-FILL-SELECTION / REF-COMPONENT-LABEL motivate the semantics.
Original bounded BFS, no SciPy dependency, automatic anatomy or semantic labels.
Domains are invisible hard constraints, independent of visible ink and paint.
"""
from collections import deque
from copy import deepcopy

from engine.io.project_archive import PixelPlane

# Shared raw mask wire spelling; list-only callers keep their stdlib route.
OWNERSHIP_ENCODING='red-boolean-mask-1'


def _packed_mask(mask,width,height):
    from engine.spatial_constraints import validate_mask
    return validate_mask(mask,width,height)

SOURCES=['REF-KRITA-FILL-SELECTION','REF-COMPONENT-LABEL','REF-KRITA-TRANSPARENCY-MASK','REF-PYTHON-COPY']
MAX_COMPONENTS=128


def _dimensions(width,height):
    if any(type(v) is not int or not 1<=v<=4096 for v in [width,height]):
        raise ValueError('Invalid ownership domain dimensions')


def _rectangle(width,height,rectangle):
    _dimensions(width,height)
    box=[0,0,width,height] if rectangle is None else rectangle
    if not isinstance(box,(list,tuple)) or len(box)!=4 or any(type(v) is not int for v in box) or not 0<=box[0]<box[2]<=width or not 0<=box[1]<box[3]<=height or max(box[2]-box[0],box[3]-box[1])>512:
        raise ValueError('Query an ownership domain within at most512square')
    return box


def validate_domain(domain,width,height):
    _dimensions(width,height)
    if isinstance(domain,PixelPlane):
        return _packed_mask(domain,width,height)
    if max(width,height)>256 or not isinstance(domain,list) or len(domain)>width*height or any(type(v) is not int or not 0<=v<width*height for v in domain) or domain!=sorted(set(domain)):
        raise ValueError('Legacy ownership domain requires sorted bounded indices; larger domains require packed masks')
    return domain


def domain_indices(domain,width,height,rectangle=None,local=False):
    """Only expand a bounded query, never a whole HD complement mask."""
    validate_domain(domain,width,height)
    x0,y0,x1,y1=_rectangle(width,height,rectangle)
    stride=x1-x0
    if isinstance(domain,PixelPlane):
        raw=domain.region_bytes([x0,y0,x1,y1])
        values=[(i//stride+y0)*width+i%stride+x0 for i in range(stride*(y1-y0)) if raw[4*i]]
    else:
        values=[i for i in domain if x0<=i%width<x1 and y0<=i//width<y1]
    return [(i//width-y0)*stride+i%width-x0 for i in values] if local else values


def checked_seeds(seeds,width,height,domain=None,rectangle=None):
    _dimensions(width,height)
    if domain is not None:validate_domain(domain,width,height)
    if not isinstance(seeds,list) or len(seeds)>MAX_COMPONENTS:
        raise ValueError('At most128 explicit component seeds; repair a fragmented ownership mask rather than dropping pieces')
    seen=set()
    for point in seeds:
        if not isinstance(point,list) or len(point)!=2 or any(type(v) is not int for v in point) or not 0<=point[0]<width or not 0<=point[1]<height:
            raise ValueError('Component seeds require integer canvas coordinates')
        if tuple(point) in seen:raise ValueError('Component seeds must be unique')
        seen.add(tuple(point))
        if rectangle and not rectangle[0]<=point[0]<rectangle[2]:raise ValueError('Component seed lies outside the selection')
        if rectangle and not rectangle[1]<=point[1]<rectangle[3]:raise ValueError('Component seed lies outside the selection')
        if domain is not None:
            index=point[1]*width+point[0]
            allowed=domain[index][0] if isinstance(domain,PixelPlane) else index in domain
            if not allowed:raise ValueError('Component seed lies outside its ownership domain')
    return deepcopy(seeds)


def component_seeds(interior,width,height,preferred=None,checkpoint=None):
    """One seed per exact FOUR-connected known interior, deterministic fallback.

    Caller supplies accepted geometry, not a color/semantic similarity guess.
    Refuse excessive fragmentation; do not select only the largest component.
    """
    _dimensions(width,height)
    if not isinstance(interior,list) or len(interior)>512*512 or any(type(i) is not int or not 0<=i<width*height for i in interior) or len(set(interior))!=len(interior):
        raise ValueError('Component geometry requires unique bounded canvas indices')
    preferred=checked_seeds(preferred or [],width,height)
    remaining=set(interior);components=[];visits=0
    # Sorting once avoids a quadratic repeated min(remaining) for fragmented data.
    for seed in sorted(remaining):
        if seed not in remaining:continue
        if len(components)>=MAX_COMPONENTS:raise ValueError('More than128 region components; repair ownership or add separate regions')
        remaining.remove(seed);queue=deque([seed]);members={seed}
        while queue:
            i=queue.popleft();visits+=1
            if checkpoint and visits%256==0:checkpoint()
            x,y=i%width,i//width
            for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                j=ny*width+nx
                if 0<=nx<width and 0<=ny<height and j in remaining:
                    remaining.remove(j);members.add(j);queue.append(j)
        chosen=next((y*width+x for x,y in preferred if y*width+x in members),seed)
        components.append([chosen%width,chosen//width])
    if checkpoint:checkpoint()
    return components


def fill_arguments(region,width,height,crop=None,include_seeds=True):
    """Map persisted world domain/hints to a bounded method's local coordinates."""
    domain=region.get('ownership_domain')
    seeds=region.get('component_seeds',[]) if include_seeds else []
    if domain is None and not seeds:return {}
    box=_rectangle(width,height,crop)
    if domain is not None:validate_domain(domain,width,height)
    checked_seeds(seeds,width,height,domain,box)
    result={}
    if domain is not None:result['domain']=domain_indices(domain,width,height,box,local=True)
    if seeds:result['extra_seeds']=[[x-box[0],y-box[1]] for x,y in seeds]
    return result


def validate_metadata(region,width,height):
    domain=region.get('ownership_domain')
    if domain is not None:
        if region.get('ownership_encoding')!=OWNERSHIP_ENCODING:raise ValueError('Unknown ownership domain encoding')
        validate_domain(domain,width,height)
        # A domain may cover the full canvas. Only managed geometry is ROI-bound.
        box=region.get('roi') or [0,0,width,height]
        allowed=set(domain_indices(domain,width,height,box))
        for field in ['region','covered']:
            if region.get('region_format') in {'packed_roi_v1','motion_region_v1'}:
                mask=_packed_mask(region[field+'_mask'],width,height);raw=mask.region_bytes(box);stride=box[2]-box[0]
                values=[(i//stride+box[1])*width+i%stride+box[0] for i in range(stride*(box[3]-box[1])) if raw[4*i]]
            else:values=region.get(field,[])
            if not set(values)<=allowed:raise ValueError('Accepted region geometry escapes its ownership domain')
    if 'component_seeds' in region:
        checked_seeds(region['component_seeds'],width,height,domain,region.get('roi'))
    return region


def inherit_domain(region):
    """Additional regions inherit ownership, never another color region's seeds."""
    if 'ownership_domain' not in region:return {}
    return dict(ownership_domain=deepcopy(region['ownership_domain']),ownership_encoding=region['ownership_encoding'])


def set_seed_hints(project,region_id,seeds):
    """Explicit metadata correction; pixels require separate reviewed regeneration."""
    from engine.fill_revision import inputs
    from engine.project import fingerprint,validate
    region,exposures,_=inputs(project,region_id)
    w,h=project['canvas']['width'],project['canvas']['height']
    validate_metadata(region,w,h)
    seeds=checked_seeds(seeds,w,h,region.get('ownership_domain'),region.get('roi'))
    if not seeds:raise ValueError('Choose at least one interior seed; repair an empty ownership domain first')
    history=region.get('seed_hint_history',[])
    if len(history)>=128:raise ValueError('Seed correction history capacity128; retain this region and explicitly create another before further changes')
    updated=deepcopy(project);target=updated['fill_regions'][region_id]
    target['seed_hint_history']=deepcopy(history)+[dict(seed=region['settings']['seed'][:],component_seeds=deepcopy(region.get('component_seeds',[])),input_drawings={k:e['drawing_id'] for k,e in exposures.items()},input_sha256={k:fingerprint(project['drawings'][e['drawing_id']]) for k,e in exposures.items()})]
    target['settings']['seed']=seeds[0][:];target['component_seeds']=deepcopy(seeds[1:]);target['seed_hint_version']=region.get('seed_hint_version',0)+1;target['geometry_status']='seed_hints_changed_review_required'
    validate_metadata(target,w,h);updated['revision']+=1;updated['history'].append(dict(action='edit-region-component-seeds',region_id=region_id,seeds=deepcopy(seeds)))
    validate(updated);return updated


def seed_scope(project,region_id):
    from engine.fill_revision import inputs
    from engine.project import fingerprint
    r,exposures,nodes=inputs(project,region_id)
    keys={'region:'+region_id}|{'layer:'+i for i in nodes}
    return fingerprint(dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],region=r,exposures=exposures,nodes=nodes,drawings={role:project['drawings'][e['drawing_id']] for role,e in exposures.items()},epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)}))


def retained_component_seeds(interior,width,height,preferred,checkpoint=None,allowed=None):
    """Retain ALL domain-permitted points, plus fallbacks for unseeded components.

    Invalidated points are returned explicitly for recorded repair, never erased
    from correction evidence. Geometry component count is not seed-point count.
    """
    preferred=checked_seeds(preferred,width,height)
    known=set(interior);permitted=known if allowed is None else set(allowed)
    valid=[p[:] for p in preferred if p[1]*width+p[0] in permitted]
    displaced=[p[:] for p in preferred if p[1]*width+p[0] not in permitted]
    representatives=component_seeds(interior,width,height,valid,checkpoint)
    result=valid+[p for p in representatives if p not in valid]
    if len(result)>MAX_COMPONENTS:raise ValueError('Retained points plus unseeded components exceed128; explicitly repair seeds without dropping evidence')
    return result,displaced,len(representatives)
