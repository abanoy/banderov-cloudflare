"""Independent bounded seed/barrier baseline; REF-SEED-FILL / REF-MORPHOLOGY.

No semantic gap inference. White-paper factorization follows REF-COMPOSITING.
All outputs are proposals; the source pixels are never written.
"""
from collections import deque
from copy import deepcopy

from engine.project import validate, fingerprint
from engine.layers import validate_layers

SOURCES = ['REF-PYTHON', 'REF-SEED-FILL', 'REF-MORPHOLOGY', 'REF-COMPOSITING', 'REF-COLORIZE-MASK', 'REF-FLATMAGIC']


class FillCancelled(Exception):
    pass


def settings_checked(settings, width, height):
    required = {'seed', 'color', 'palette_id', 'gap_radius', 'threshold', 'paper', 'add_barriers', 'keep_open', 'overlap'}
    if set(settings) != required:
        raise ValueError('Fill settings require an explicit complete bounded specification')
    def integer(value, lo, hi):
        return type(value) is int and lo <= value <= hi
    seed, color = settings['seed'], settings['color']
    if not isinstance(seed, list) or len(seed) != 2 or not integer(seed[0],0,width-1) or not integer(seed[1],0,height-1):
        raise ValueError('Choose a seed inside the canvas')
    if not isinstance(color,list) or len(color)!=4 or any(not integer(c,0,255) for c in color):
        raise ValueError('Expected an RGBA8 fill color, including explicit transparency')
    if not isinstance(settings['palette_id'],str) or not 1<=len(settings['palette_id'])<=80 or any(ord(c)<32 for c in settings['palette_id']):
        raise ValueError('Expected a stable palette identity, 1..80 characters')
    if not integer(settings['gap_radius'],0,2) or not integer(settings['threshold'],1,255) or not integer(settings['overlap'],0,1) or settings['paper'] not in {'transparent','white'}:
        raise ValueError('Unsupported gap radius, threshold, overlap or paper mode')
    for key in ['add_barriers','keep_open']:
        values=settings[key]
        if not isinstance(values,list) or len(values)>width*height or len(set(values))!=len(values) or any(not integer(i,0,width*height-1) for i in values):
            raise ValueError('Boundary overrides require unique canvas pixel indices')
    if set(settings['add_barriers']) & set(settings['keep_open']):
        raise ValueError('A boundary pixel cannot be both added and kept open')
    return deepcopy(settings)


def defaults(seed, color, palette_id='fill_main'):
    return dict(seed=list(seed),color=list(color),palette_id=palette_id,gap_radius=0,threshold=32,paper='transparent',add_barriers=[],keep_open=[],overlap=1)


def propose(pixels,width,height,settings,checkpoint=None,*,domain=None,extra_seeds=None):
    """Pure finite method. Check cancellation every row and <=256 BFS visits."""
    if type(width) is not int or type(height) is not int or not 1<=width<=256 or not 1<=height<=256 or len(pixels)!=width*height:
        raise ValueError('Fill baseline supports canvas-sized RGBA8 grids <=256px')
    if any(len(p)!=4 or any(type(c) is not int or not 0<=c<=255 for c in p) for p in pixels):
        raise ValueError('Expected RGBA8 input')
    settings=settings_checked(settings,width,height)
    constrained=domain is not None or bool(extra_seeds)
    allowed=None
    if domain is not None:
        if not isinstance(domain,list) or len(domain)>width*height or any(type(i) is not int or not 0<=i<width*height for i in domain) or len(set(domain))!=len(domain):
            raise ValueError('Fill domain requires unique local pixel indices')
        allowed=set(domain)
    if extra_seeds is not None:
        from engine.region_domains import checked_seeds
        extra_seeds=checked_seeds(extra_seeds,width,height)
    def check():
        if checkpoint:
            checkpoint()
    ink=[]
    for y in range(height):
        check()
        for p in pixels[y*width:(y+1)*width]:
            if settings['paper']=='white':
                if p[3]!=255:
                    raise ValueError('White-paper mode requires fully opaque input; choose transparent mode for alpha artwork')
                minimum=min(p[:3])
                alpha=255-minimum
                ink.append([((c-minimum)*255+alpha//2)//alpha for c in p[:3]]+[alpha] if alpha else [0,0,0,0])
            else:
                ink.append(p[:])
    original={i for i,p in enumerate(ink) if p[3]>=settings['threshold']}
    boundary=set(original)
    radius=settings['gap_radius']
    if radius:
        # Include the exterior padding when dilating so closing cannot erase an
        # original stroke at the canvas border. Clip only after the erosion.
        dilated=set()
        for y in range(height):
            check()
            for x in range(width):
                if y*width+x in original:
                    dilated.update((x+dx,y+dy) for dy in range(-radius,radius+1) for dx in range(-radius,radius+1))
        closed=set()
        for y in range(height):
            check()
            for x in range(width):
                if all((x+dx,y+dy) in dilated for dy in range(-radius,radius+1) for dx in range(-radius,radius+1)):
                    closed.add(y*width+x)
        boundary |= closed
    boundary |= set(settings['add_barriers'])
    # Keep-open changes the FILL barrier, never erases original visible ink.
    boundary -= set(settings['keep_open'])
    seeds=[settings['seed']]+(extra_seeds or [])
    seed_indices={y*width+x for x,y in seeds}
    if allowed is not None and not seed_indices<=allowed:
        raise ValueError('Seed lies outside its ownership domain; repair the seed or ownership, not keep-open ink hints')
    if seed_indices&boundary:
        raise ValueError('Seed lies on an ink/fill boundary; select the interior or explicitly remove that barrier')
    # Hard ownership applies AFTER keep-open. Report only the neighboring seam,
    # not every forbidden exterior sample as a huge misleading boundary overlay.
    blocked=boundary.copy()
    if allowed is not None:
        seam=set()
        for i in allowed:
            x,y=i%width,i//width
            for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                j=ny*width+nx
                if 0<=nx<width and 0<=ny<height and j not in allowed:seam.add(j)
        boundary|=seam
        blocked|=set(range(width*height))-allowed
    region=set(seed_indices)
    queue=deque(sorted(seed_indices))
    visits=0
    while queue:
        visits+=1
        if visits%256==0:
            check()
        index=queue.popleft()
        x,y=index%width,index//width
        for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            neighbor=ny*width+nx
            if 0<=nx<width and 0<=ny<height and neighbor not in blocked and neighbor not in region:
                region.add(neighbor)
                queue.append(neighbor)
    covered=set(region)
    if settings['overlap']:
        # Extend only beneath ACTUAL ink, not across an invented closure or out
        # into transparent exterior. This is a limited edge-overlap policy.
        for index in region:
            x,y=index%width,index//width
            for ny in range(max(0,y-1),min(height,y+2)):
                for nx in range(max(0,x-1),min(width,x+2)):
                    candidate=ny*width+nx
                    if ink[candidate][3]>0:
                        covered.add(candidate)
    if allowed is not None:covered &= allowed
    check()
    fill=[settings['color'][:] if i in covered else [0,0,0,0] for i in range(width*height)]
    touches=any(i%width in {0,width-1} or i//width in {0,height-1} for i in region)
    warnings=[]
    if settings['color'][3]==0:warnings.append('Transparent palette assignment: region identity and managed mask remain available for later recolor.')
    if touches:
        warnings.append('Region touches the canvas edge: possible leak or intentional exterior; review before accepting.')
    if radius:
        warnings.append('Geometric gap closing may seal intentional openings; added barriers are inspectable, not semantic confidence.')
    if settings['paper']=='white':
        warnings.append('White-paper separation is underdetermined away from white. Derived ink is proposed; original opaque artwork is retained.')
    if constrained:
        warnings.append('Explicit component seeds and binary ownership constrain regeneration; keep-open and under-ink overlap cannot cross that domain. This is not inferred anatomy.')
    added=sorted(boundary-original)
    if added:
        warnings.append('Invisible added barriers can leave uncolored gap pixels; no visible ink is invented.')
    result=dict(ink=ink,fill=fill,boundary=sorted(boundary),added_barriers=added,region=sorted(region),covered=sorted(covered),warnings=warnings,metrics=dict(region_area=len(region),covered_area=len(covered),added_barriers=len(added),touches_edge=touches),settings=settings,method='four-connected-seed-invisible-boundary-baseline',version='0.1.0',source_ids=SOURCES[:])
    if constrained:
        from engine.region_domains import SOURCES as DOMAIN_SOURCES
        result.update(method='four-connected-seed-owned-domain',version='0.2.0',component_seeds=deepcopy(extra_seeds or []))
        result['source_ids']=sorted(set(result['source_ids']+DOMAIN_SOURCES))
        result['metrics'].update(seed_count=len(seed_indices),ownership_area=len(allowed) if allowed is not None else width*height)
    return result


def accept_fill(project,result,layer_id,slot,identity):
    """New editable group: retained source, ink and flat fill. One held exposure.

    Called only after the worker/result/source identity was independently checked.
    No approved source/correction pixel or other layer/exposure is overwritten.
    """
    validate(project)
    validate_layers(project)
    for key in [identity,identity+'-ink',identity+'-fill']:
        if key in project['layers'] or key in project['drawings'] or key in project.get('fill_regions',{}):
            raise ValueError('Fill acceptance identities must be new')
    layer=project['layers'][layer_id]
    if layer.get('nodetype','paintlayer')!='paintlayer':
        raise ValueError('Fill input must be a raster layer')
    ancestor=layer_id
    while ancestor is not None:
        current=project['layers'][ancestor]
        if current.get('locked',False) or not current.get('visible',True):
            raise ValueError('Input layer/ancestor must be visible and explicitly unlocked')
        ancestor=current.get('parent_id')
    exposure=next(e for e in project['exposures'] if e['layer_id']==layer_id and e['start']<=slot<e['start']+e['length'])
    updated=deepcopy(project)
    group=identity
    ink_layer,fill_layer=identity+'-ink',identity+'-fill'
    ink_id,fill_id,blank_id=identity+'-ink-drawing',identity+'-fill-drawing',identity+'-blank'
    if any(i in project['drawings'] for i in [ink_id,fill_id,blank_id]):
        raise ValueError('Fill drawing identities must be new')
    updated['layers']={}
    for key,value in project['layers'].items():
        if key==layer_id:
            updated['layers'][group]=dict(name='Reviewed flat: '+result['settings']['palette_id'],nodetype='grouplayer',parent_id=layer.get('parent_id'),order=layer.get('order',0),opacity=layer.get('opacity',255),visible=True,locked=False,isolation='isolate')
        updated['layers'][key]=deepcopy(value)
    updated['layers'][layer_id]['visible']=False
    updated['layers'][ink_layer]=dict(name='Preserved / proposed ink',parent_id=group,order=0,visible=True,locked=False)
    updated['layers'][fill_layer]=dict(name='Flat: '+result['settings']['palette_id'],parent_id=group,order=1,visible=True,locked=False)
    def drawing(pixels,origin):
        return dict(pixels=deepcopy(pixels),origin=origin,approved=True,locked=False)
    updated['drawings'][ink_id]=drawing(result['ink'],'reviewed_white_paper_ink' if result['settings']['paper']=='white' else 'preserved_ink')
    updated['drawings'][fill_id]=drawing(result['fill'],'reviewed_flat_fill')
    updated['drawings'][blank_id]=drawing([[0,0,0,0] for p in result['fill']],'transparent_fill_hold')
    schedule=[e for e in project['exposures'] if e['layer_id']==layer_id]
    for e in schedule:
        selected=e==exposure
        updated['exposures'].append(dict(e,layer_id=ink_layer,drawing_id=ink_id if selected else e['drawing_id']))
        updated['exposures'].append(dict(e,layer_id=fill_layer,drawing_id=fill_id if selected else blank_id))
    updated.setdefault('palettes',{})
    palette=result['settings']['palette_id']
    if palette in updated['palettes'] and updated['palettes'][palette]['rgba']!=result['settings']['color']:
        raise ValueError('Palette identity already has a different value; choose another identity or explicitly recolor it')
    updated['palettes'][palette]=dict(rgba=result['settings']['color'][:],color_profile='sRGB',origin='artist_assignment')
    updated.setdefault('fill_regions',{})[identity]=dict(source_layer=layer_id,source_drawing=exposure['drawing_id'],source_sha256=fingerprint(project['drawings'][exposure['drawing_id']]),start=exposure['start'],length=exposure['length'],ink_layer=ink_layer,fill_layer=fill_layer,palette_id=palette,boundary=result['boundary'][:],region=result['region'][:],covered=result['covered'][:],ink_drawing=ink_id,fill_drawing=fill_id,settings=deepcopy(result['settings']),warnings=result['warnings'][:],source_ids=result['source_ids'][:],confidence='uncalibrated_geometry_requires_artist_review',status='artist_reviewed',method=result['method'],method_version=result['version'],version=0)
    updated['revision']+=1
    updated['history'].append(dict(action='accept-reviewed-flat-fill',region_id=identity,source_drawing=exposure['drawing_id']))
    validate(updated)
    validate_layers(updated)
    return updated,fill_layer
