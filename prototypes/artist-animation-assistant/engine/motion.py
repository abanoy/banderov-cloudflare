"""Original editable motion/interval adapter over credited point MLS.

Manual correspondences are evidence, not semantic anatomy or hidden-surface
reconstruction. Ink/color/masks share a field; source/approved keys stay retained.
"""
from copy import deepcopy
import hashlib,math
import numpy as np
from engine.project import validate,fingerprint
from engine.layers import validate_layers,visible
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE
from engine.spatial_constraints import uniform,drawing_mask,merge,ENCODING,count
from engine.deformation import points,warp,SOURCES
from engine import trajectories


def _name(value):
    if not isinstance(value,str) or not 1<=len(value)<=80 or any(ord(c)<32 for c in value):raise ValueError('Use a1..80character guide/landmark identity')
    return value


def validate_guides(project):
    guides=project.get('motion_guides',{})
    if not isinstance(guides,dict) or len(guides)>64:raise ValueError('At most64 retained motion guides')
    w,h=project['canvas']['width'],project['canvas']['height']
    for identity,g in guides.items():
        _name(identity);_name(g['name'])
        if type(g['source_slot']) is not int:raise ValueError('Source guide time must be a shot slot')
        if g['actor_id'] not in project['layers']:raise ValueError('Motion guide actor is missing')
        for slot in [g['source_slot'],g['guide_slot']]:
            if slot is not None and (type(slot) is not int or not 0<=slot<project['shot']['duration_frames']):raise ValueError('Guide time outside shot')
        history=g.get('rejected_matches',[])
        if not isinstance(history,list) or len(history)>128:raise ValueError('Motion correction history capacity128; preserve/export this guide before creating a new guide')
        for record in history:
            if not isinstance(record,dict) or set(record)!={'previous','replacement','reason','inputs','fingerprint','document_revision'}:raise ValueError('Invalid motion correction history')
            payload={k:v for k,v in record.items() if k not in {'fingerprint','document_revision'}}
            if record['reason'] not in {'removed','disabled','corrected'} or type(record['document_revision']) is not int or record['document_revision']<0 or fingerprint(payload)!=record['fingerprint']:raise ValueError('Invalid motion correction history identity')
        roi=g['roi']
        if len(roi)!=4 or any(type(i) is not int for i in roi) or not 0<=roi[0]<roi[2]<=w or not 0<=roi[1]<roi[3]<=h:raise ValueError('Choose a source rectangle inside the canvas; large selections use bounded streamed geometry')
        if not isinstance(g['handles'],list) or len(g['handles'])>32 or len({p['id'] for p in g['handles']})!=len(g['handles']):raise ValueError('Use at most32 distinct named correspondence records')
        for p in g['handles']:
            _name(p['id'])
            if set(p)!={'id','source','target','enabled'} or type(p['enabled']) is not bool or p['source'] is None and p['target'] is None:raise ValueError('Invalid matched/unmatched landmark record')
            for xy in [p['source'],p['target']]:
                if xy is not None and (not isinstance(xy,list) or len(xy)!=2 or any(type(v) not in {int,float} or not math.isfinite(v) or abs(v)>16384 for v in xy)):raise ValueError('Finite2D landmark coordinates required')
        trajectories.validate(g)
    return project


def save_guide(project,identity,definition):
    previous=project.get('motion_guides',{}).get(identity,{})
    definition=deepcopy(definition)
    # Legacy correspondence controls submit only their own fields. Preserve
    # independent spatial/clock/contact controls unless explicitly cleared.
    for field in trajectories.CONTROL_FIELDS:
        if field not in definition and field in previous:definition[field]=deepcopy(previous[field])
    history=deepcopy(previous.get('rejected_matches',[]))
    current={p['id']:p for p in definition['handles']}
    inputs={}
    if previous:
        for layer in _actor_layers(project,previous['actor_id']):
            for role in ['source','guide']:
                slot=previous[role+'_slot']
                e=_exposure(project,layer,slot) if slot is not None else None
                if e:inputs[role+':'+layer]=dict(drawing_id=e['drawing_id'],drawing_sha256=fingerprint(project['drawings'][e['drawing_id']]))
    for old in previous.get('handles',[]):
        after=current.get(old['id'])
        if old==after:continue
        reason='removed' if after is None else 'disabled' if old['enabled'] and not after['enabled'] else 'corrected'
        record=dict(previous=deepcopy(old),replacement=deepcopy(after),reason=reason,inputs=inputs)
        record['fingerprint']=fingerprint(record)
        if not any(r['fingerprint']==record['fingerprint'] for r in history):
            record['document_revision']=project['revision'];history.append(record)
    if history:definition['rejected_matches']=history
    else:definition.pop('rejected_matches',None)
    controls=trajectories.control_history(previous,definition,inputs,project['revision'])
    if controls:definition['motion_control_history']=controls
    else:definition.pop('motion_control_history',None)
    updated=deepcopy(project);updated.setdefault('motion_guides',{})[_name(identity)]=definition
    return validate_guides(updated)


def _descendant(project,current,ancestor):
    seen=set()
    while current in project['drawings'] and current not in seen:
        if current==ancestor:return True
        seen.add(current);current=project['drawings'][current].get('parent_drawing')
    return False


def _actor_layers(project,actor):
    result=[]
    def visit(identity):
        n=project['layers'][identity]
        if not visible(project,identity):return
        if n.get('locked',False):raise ValueError('Unlock the selected actor and children before motion')
        if n.get('nodetype','paintlayer')=='paintlayer':result.append(identity)
        else:
            for i,c in project['layers'].items():
                if c.get('parent_id')==identity:visit(i)
    visit(actor)
    if not result:raise ValueError('Select a visible raster actor or group')
    return result


def _exposure(project,layer,slot):return next((e for e in project['exposures'] if e['layer_id']==layer and e['start']<=slot<e['start']+e['length']),None)


def _base_subject(project,request):
    validate(project);validate_layers(project);validate_guides(project)
    required={'guide_id','mode','progress','target_start','target_end','operation_id','allow_clip'}
    if not required<=set(request) or set(request)-required-{'clock_time'}:raise ValueError('Unexpected motion request properties')
    if request['mode'] not in {'rigid','similarity','translation'} or type(request['progress']) not in {int,float} or not math.isfinite(request['progress']) or not 0<=request['progress']<=1 or type(request['allow_clip']) is not bool:raise ValueError('Choose a deformation backend, progress0..1 and explicit clipping choice')
    start,end=request['target_start'],request['target_end'];duration=project['shot']['duration_frames']
    if any(type(x) is not int for x in [start,end]) or not 0<=start<end<=duration:raise ValueError('Target hold must be inside the shot')
    if request['guide_id'] not in project.get('motion_guides',{}):raise ValueError('Select a saved motion guide')
    guide=project['motion_guides'][request['guide_id']];actor=guide['actor_id'];layers=_actor_layers(project,actor);nodes={}
    if 'clock_time' in request and trajectories.progress_at(guide,request['clock_time'])!=request['progress']:raise ValueError('Clock time and declared spatial progress differ; reevaluate the timing map')
    if guide['source_slot']>=start:raise ValueError('Source key must precede the proposed interval')
    for layer in layers:
        parent=layer
        while parent is not None:
            n=project['layers'][parent]
            if n.get('locked') or not n.get('visible',True):raise ValueError('Motion actor ancestors must be visible/unlocked')
            nodes[parent]=n;parent=n.get('parent_id')
    operation=None
    if request['operation_id']:
        matches=[o for o in project.get('motion_operations',[]) if o['operation_id']==request['operation_id']]
        if not matches:raise ValueError('Select an existing motion operation for revision')
        operation=matches[-1]
        if operation['actor_id']!=actor or operation['target_start']!=start or operation['target_end']!=end:raise ValueError('Motion actor/held interval changed; explicitly rebind before regeneration')
    entries={};missing=[]
    for layer in layers:
        e=_exposure(project,layer,guide['source_slot'])
        if e is None:missing.append(layer);continue
        d=project['drawings'][e['drawing_id']]
        if not d.get('approved'):raise ValueError('Start from an approved source drawing')
        entry=dict(source_exposure=e,source=d)
        if operation:
            target=_exposure(project,layer,start)
            if layer not in operation['output_drawings'] or target is None or target['start']!=start or target['length']!=end-start or not _descendant(project,target['drawing_id'],operation['output_drawings'][layer]):raise ValueError('Target is now a different key/interval; motion will not replace it')
            entry.update(target_exposure=target,target=project['drawings'][target['drawing_id']])
        elif not guide['source_slot']<start or not e['start']<start<end<=e['start']+e['length']:raise ValueError('Insert inside the source hold after its key; existing distinct keys are never overwritten')
        if guide['guide_slot'] is not None:
            target=_exposure(project,layer,guide['guide_slot'])
            if target:
                td=project['drawings'][target['drawing_id']]
                if not td.get('approved'):raise ValueError('Guide key must be approved')
                entry['guide_exposure']=target;entry['guide_drawing']=td
        entries[layer]=entry
    if not entries:raise ValueError('No source drawing at the guide time')
    relevant={}
    for identity,r in project.get('fill_regions',{}).items():
        affected={r['ink_layer'],r['fill_layer']}&set(entries)
        if affected and (r['start']<=guide['source_slot']<r['start']+r['length'] or operation and identity in operation['region_ids']):
            if not {r['ink_layer'],r['fill_layer']}<=set(entries):raise ValueError('Select the common group to deform ink, fills and region masks together')
            relevant[identity]=r
    keys={'guide:'+request['guide_id']}|{'layer:'+i for i in nodes}|{'region:'+i for i in relevant}|{'part:'+i for i in relevant}|{'palette:'+r['palette_id'] for r in relevant.values()}
    data=dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],request=request,guide=guide,nodes=nodes,entries=entries,regions=relevant,bindings={i:project.get('part_bindings',{}).get(i) for i in relevant},palettes={r['palette_id']:project.get('palettes',{}).get(r['palette_id']) for r in relevant.values()},operation=operation,epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)})
    return fingerprint(data),guide,entries,relevant,operation,missing


def subject(project,request):
    values=_base_subject(project,request)
    from engine.candidate_corrections import scope
    return (scope(project,'geometric',request,values[0]),)+values[1:]


def _plane(drawing,w,h):
    p=drawing['pixels'];return p if isinstance(p,PixelPlane) else PixelPlane.from_pixels(w,h,p)


def _mask(drawing,w,h):
    if isinstance(drawing['pixels'],PixelPlane):return drawing_mask(drawing)
    from engine.cleanup import drawing_constraints
    return uniform(w,h).with_edits({i:[1,0,0,0] for i in drawing_constraints(drawing)})


def _flags(mask,roi):
    x0,y0,x1,y1=roi;data=np.frombuffer(mask.region_bytes(roi),np.uint8).reshape(y1-y0,x1-x0,4);yy,xx=np.nonzero(data[:,:,0]);return ((yy+y0)*mask.width+xx+x0).tolist()


def _preserve_target(pixels,mask,target,w,h):
    current=_plane(target,w,h);fixed=_mask(target,w,h);store=OverlayTiles(pixels._store);keys=list(pixels.keys);preserved=0;conflicts=0
    for index,key in enumerate(fixed.keys):
        flag=np.frombuffer(fixed._store.get(key),np.uint8).reshape(-1,4)[:,0].astype(bool)
        if not np.any(flag):continue
        preserved+=int(np.count_nonzero(flag));old=np.frombuffer(current._store.get(current.keys[index]),np.uint8).reshape(-1,4);data=np.frombuffer(pixels._store.get(keys[index]),np.uint8).reshape(-1,4).copy();conflicts+=int(np.count_nonzero(np.any(data[flag]!=old[flag],axis=1)));data[flag]=old[flag];keys[index]=store.put(data.tobytes())
    return PixelPlane(w,h,keys,store),merge(mask,fixed),preserved,conflicts


def _region_masks(project,r,w,h):
    if r.get('region_format') in {'packed_roi_v1','motion_region_v1'}:return {key:r[key+'_mask'] for key in ['region','covered','boundary','added_barriers']}
    from engine.regions import managed_pixels
    identity=next(i for i,v in project['fill_regions'].items() if v is r);covered,_=managed_pixels(project,identity)
    data=dict(region=r['region'],covered=covered,boundary=r['boundary'])
    if 'added_barriers' in r:data['added_barriers']=r['added_barriers']
    else:
        ink_id=r.get('ink_drawing',identity+'-ink-drawing')
        if ink_id not in project['drawings']:raise ValueError('Retained generation ink is required to transport legacy boundary geometry')
        ink=project['drawings'][ink_id]['pixels'];data['added_barriers']=[i for i in r['boundary'] if ink[i][3]<r['settings']['threshold']]
    return {key:uniform(w,h).with_edits({i:[1,0,0,0] for i in values}) for key,values in data.items()}


def propose(project,request,checkpoint=None):
    scope,guide,entries,regions,operation,missing=subject(project,request);w,h=project['canvas']['width'],project['canvas']['height'];roi=guide['roi'];active=[p for p in guide['handles'] if p['enabled'] and p['source'] is not None and p['target'] is not None]
    if not active:raise ValueError('Add at least one matched correspondence; unmatched marks do not define deformation')
    p=np.asarray([r['source'] for r in active],np.float64);targets=trajectories.positions(guide,request['progress']);q=np.asarray([targets[r['id']] for r in active],np.float64);cache={};outputs={};unsafe=[];warnings=[];bounds=None
    for layer,entry in entries.items():
        if checkpoint:checkpoint()
        source=_plane(entry['source'],w,h);r=warp(source,_mask(entry['source'],w,h),roi,p,q,request['mode'],request['allow_clip'],checkpoint,cache)
        outputs[layer]=r;bounds=r['output_roi'];unsafe += [layer+': '+reason for reason in r['unsafe_reasons']]
    transformed={};domain_masks={}
    for identity,r in regions.items():
        if not r['start']<=guide['source_slot']<r['start']+r['length']:continue
        if checkpoint:checkpoint()
        entry=entries[r['ink_layer']];fill_entry=entries[r['fill_layer']]
        if any(e['source_exposure']['start']!=r['start'] or e['source_exposure']['length']!=r['length'] for e in [entry,fill_entry]):raise ValueError('Source region timing needs explicit repair before motion')
        transformed[identity]={}
        if 'ownership_domain' in r:
            from engine.part_regions import _domain
            domain_masks[identity]=warp(_domain(r,w,h),uniform(w,h),roi,p,q,request['mode'],request['allow_clip'],checkpoint,cache)['pixels']
        for key,mask in _region_masks(project,r,w,h).items():
            moved=warp(mask,uniform(w,h),roi,p,q,request['mode'],request['allow_clip'],checkpoint,cache);transformed[identity][key]=moved['pixels']
            x0,y0,x1,y1=bounds
            for row in range(y0,y1,16):
                if checkpoint:checkpoint()
                stop=min(y1,row+16);yy,xx=np.mgrid[row:stop,x0:x1];outside=~((xx>=roi[0])&(xx<roi[2])&(yy>=roi[1])&(yy<roi[3]));flags=np.frombuffer(mask.region_bytes([x0,row,x1,stop]),np.uint8).reshape(stop-row,x1-x0,4)[:,:,0]
                if np.any(outside&(flags>0)):unsafe.append(identity+': unselected_bound_geometry_in_output');break
    seed_plans={}
    from engine.region_domains import retained_component_seeds
    for identity,r in regions.items():
        if identity not in transformed or not ('ownership_domain' in r or 'component_seeds' in r):continue
        hints=[r['settings']['seed']]+r.get('component_seeds',[])
        mapped=points(np.asarray(hints,np.float64)+.5,p,q,request['mode'])
        traces=[];preferred=[]
        for old,point in zip(hints,mapped):
            target=[int(np.floor(point[0])),int(np.floor(point[1]))] if roi[0]<=old[0]<roi[2] and roi[1]<=old[1]<roi[3] else old[:]
            if 0<=target[0]<w and 0<=target[1]<h and target not in preferred:preferred.append(target)
            traces.append(dict(source=old[:],mapped=target))
        mask=transformed[identity]['region'];box=_box(mask,w,h);known=_flags(mask,box) if box else []
        domain=domain_masks.get(identity);allowed=set(known)|{point[1]*w+point[0] for point in preferred if domain is None or domain[point[1]*w+point[0]][0]}
        active,displaced,components=retained_component_seeds(known,w,h,preferred,checkpoint,allowed)
        for trace in traces:trace['active']=trace['mapped'] in active
        source_empty=_box(_region_masks(project,r,w,h)['region'],w,h) is None
        seed_plans[identity]=dict(active_seeds=active,trace=traces,source_empty=source_empty,component_count=components)
        if not known and not source_empty:unsafe.append(identity+': known_region_erased_requires_visibility_repair')
        if any(not t['active'] for t in traces):warnings.append(identity+': displaced seed points remain recorded in the transport review; inspect the replacement interior points.')
    if operation:
        for identity,r in regions.items():
            if identity not in operation['region_ids']:continue
            parent=operation['region_parents'][identity]
            if parent in transformed:
                box=_box(transformed[parent]['covered'],w,h)
                if box is None:
                    if seed_plans.get(parent,{}).get('source_empty'):continue
                    raise ValueError('Motion erased an accepted region; repair visibility/topology before regeneration')
                rgba=project['palettes'][r['palette_id']]['rgba'];managed=_flags(transformed[parent]['covered'],box);layer=r['fill_layer'];outputs[layer]['pixels']=outputs[layer]['pixels'].with_edits({i:rgba[:] for i in managed})
        for layer,entry in entries.items():
            target=entry['target']
            if target.get('origin')!='reviewed_landmark_motion':
                r=outputs[layer];r['pixels'],r['protected_mask'],preserved,conflicts=_preserve_target(r['pixels'],r['protected_mask'],target,w,h);r['metrics'].update(target_protected_pixels=preserved,target_override_conflicts=conflicts)
                if preserved:warnings.append(layer+': retained target artist constraints take precedence over regenerated samples; review contact/shape consistency.')
    if project['schema_version']=='0.2':
        from engine.candidate_corrections import overlay,active
        corrected=overlay(project,'geometric',request,outputs,checkpoint)
        if corrected:
            warnings.append('Retained explicit candidate paint/erase constraints applied; transported region geometry is not automatically reinterpreted.')
            for patch in active(project,'geometric',request)['patches'].values():
                box=_box(patch['touched'],w,h)
                if box:bounds=[min(bounds[0],box[0]),min(bounds[1],box[1]),max(bounds[2],box[2]),max(bounds[3],box[3])]
    for r in outputs.values():
        if project['schema_version']=='0.1':r['protected_pixels']=_flags(r['protected_mask'],[0,0,w,h]);r['pixels']=r['pixels'].materialize();r.pop('protected_mask')
        r.pop('unsafe_reasons',None)
    if project['schema_version']=='0.1':transformed={identity:{key:_flags(mask,[0,0,w,h]) for key,mask in masks.items()} for identity,masks in transformed.items()}
    if project['schema_version']=='0.1':domain_masks={i:_flags(mask,[0,0,w,h]) for i,mask in domain_masks.items()}
    events=[dict(landmark_id=r['id'],kind='unmatched_source' if r['target'] is None else 'unmatched_target',source=r['source'],target=r['target']) for r in guide['handles'] if r['enabled'] and (r['source'] is None or r['target'] is None)]
    if not operation and any(e['source_exposure']['start']+e['source_exposure']['length']>request['target_end'] for e in entries.values()):warnings.append('After this interval the previous source hold resumes until its next key. This local insertion does not infer an economical schedule.')
    if events or missing:warnings.append('Unmatched marks/missing source layers are recorded as visibility evidence; no newly exposed surface or missing anatomy is reconstructed.')
    warnings += ['Manual correspondences and progress define this proposal; source appearance does not determine intended action.','Point MLS ignores semantic topology. Fold checks are sampled, not a proof of injectivity; nearest raster resampling can change texture/line weight.','Spatial progress and target exposure interval are independent. Original keys/source drawings remain retained.']
    if unsafe:warnings.append('Needs repair before acceptance: '+'; '.join(sorted(set(unsafe))))
    operation_sources=SOURCES[:]
    if any(key in guide for key in trajectories.CONTROL_FIELDS):
        operation_sources=sorted(set(operation_sources+trajectories.SOURCES))
        warnings.append('Cubic landmark trajectories are supplied geometry. Contact intervals constrain points continuously, not anatomy or exact resampled contact pixels. Clock mapping is separate; request progress is spatial progress.')
    if domain_masks or any('component_seeds' in r for r in regions.values()):
        from engine.region_domains import SOURCES as DOMAIN_SOURCES
        operation_sources=sorted(set(operation_sources+DOMAIN_SOURCES))
    return dict(seed_plans=seed_plans,domain_masks=domain_masks,guide_snapshot=deepcopy(guide),request=deepcopy(request),dependency_sha256=scope,outputs=outputs,region_masks=transformed,output_roi=bounds,unsafe_reasons=sorted(set(unsafe)),visibility_events=events,missing_source_layers=missing,warnings=warnings,method='artist-landmark-'+request['mode']+'-mls',version='0.1.0',source_ids=operation_sources,score_kind='geometric_residuals_not_semantic_confidence')


def _box(mask,w,h):
    if isinstance(mask,list):return [min(i%w for i in mask),min(i//w for i in mask),max(i%w for i in mask)+1,max(i//w for i in mask)+1] if mask else None
    columns=(w+TILE-1)//TILE;left,top,right,bottom=w,h,0,0
    for index,key in enumerate(mask.keys):
        ty,tx=divmod(index,columns);a=np.frombuffer(mask._store.get(key),np.uint8).reshape(TILE,TILE,4)[:min(TILE,h-ty*TILE),:min(TILE,w-tx*TILE),0];yy,xx=np.nonzero(a)
        if len(xx):left=min(left,int(xx.min())+tx*TILE);right=max(right,int(xx.max())+tx*TILE+1);top=min(top,int(yy.min())+ty*TILE);bottom=max(bottom,int(yy.max())+ty*TILE+1)
    return [left,top,right,bottom] if right>left and bottom>top else None


def _transport_settings(settings,guide,request,w,h,masks,allow_empty=False):
    settings=deepcopy(settings);active=[r for r in guide['handles'] if r['enabled'] and r['source'] is not None and r['target'] is not None];p=np.asarray([r['source'] for r in active]);targets=trajectories.positions(guide,request['progress']);q=np.asarray([targets[r['id']] for r in active])
    def move(values):
        if not values:return []
        v=np.asarray([[i%w+.5,i//w+.5] for i in values]);out=points(v,p,q,request['mode']);out=np.asarray([mapped if guide['roi'][0]<=old[0]<guide['roi'][2] and guide['roi'][1]<=old[1]<guide['roi'][3] else old for old,mapped in zip(v,out)]);return sorted({int(y)*w+int(x) for x,y in np.floor(out) if 0<=x<w and 0<=y<h})
    sx,sy=settings['seed'];mapped=points([[sx+.5,sy+.5]],p,q,request['mode'])[0] if guide['roi'][0]<=sx<guide['roi'][2] and guide['roi'][1]<=sy<guide['roi'][3] else [sx+.5,sy+.5];seed=[int(np.floor(mapped[0])),int(np.floor(mapped[1]))]
    region=masks['region'];region_indices=region if isinstance(region,list) else _flags(region,_box(region,w,h)) if _box(region,w,h) else []
    if not region_indices:
        if allow_empty:
            settings.update(paper='transparent',add_barriers=move(settings['add_barriers']),keep_open=move(settings['keep_open']));return settings
        raise ValueError('Deformation erased an accepted region; explicit topology repair required')
    if not 0<=seed[0]<w or not 0<=seed[1]<h or seed[1]*w+seed[0] not in set(region_indices):
        i=min(region_indices,key=lambda i:(i%w-mapped[0])**2+(i//w-mapped[1])**2);seed=[i%w,i//w]
    settings.update(seed=seed,paper='transparent',add_barriers=move(settings['add_barriers']),keep_open=move(settings['keep_open']));return settings


def _install(project,result,identity,reviewed,*,fresh=False):
    scope,guide,entries,regions,previous,missing=subject(project,result['request'])
    if scope!=result['dependency_sha256'] or (not fresh and result!=propose(project,result['request'])):raise ValueError('Motion result is stale or differs from the declared backend')
    if result['unsafe_reasons']:raise ValueError('Repair motion before accepting: '+'; '.join(result['unsafe_reasons']))
    w,h=project['canvas']['width'],project['canvas']['height'];request=result['request'];start,end=request['target_start'],request['target_end'];operation_id=request['operation_id'] or identity
    if any(o['operation_id']==identity for o in project.get('motion_operations',[])) or any(identity+'-drawing-'+str(i) in project['drawings'] for i in range(len(entries))):raise ValueError('Motion output identities must be new')
    updated=deepcopy(project);output_drawings={};new_count=0
    for number,(layer,entry) in enumerate(entries.items()):
        out=result['outputs'][layer];source_id=entry['source_exposure']['drawing_id'];same=out['pixels']==entry['source']['pixels']
        same_mask=out['protected_mask']==_mask(entry['source'],w,h) if project['schema_version']=='0.2' else out['protected_pixels']==_flags(_mask(entry['source'],w,h),[0,0,w,h])
        if same and same_mask:drawing_id=source_id
        else:
            drawing_id=identity+'-drawing-'+str(number);new_count+=1;drawing=dict(pixels=out['pixels'],origin='reviewed_landmark_motion' if reviewed else 'unreviewed_motion_candidate',approved=reviewed,locked=False,parent_drawing=entry['target_exposure']['drawing_id'] if previous else source_id)
            if project['schema_version']=='0.2':drawing.update(protected_mask=out['protected_mask'],protection_encoding=ENCODING);drawing['locked']=bool(count(drawing))
            else:drawing.update(protected_pixels=out['protected_pixels'][:],locked=bool(out['protected_pixels']))
            updated['drawings'][drawing_id]=drawing
        output_drawings[layer]=drawing_id
        if previous:next(e for e in updated['exposures'] if e==entry['target_exposure'])['drawing_id']=drawing_id
        else:
            old=entry['source_exposure'];before=dict(old,length=start-old['start']);candidate=dict(old,drawing_id=drawing_id,start=start,length=end-start);after=dict(old,start=end,length=old['start']+old['length']-end)
            result_exposures=[]
            for e in updated['exposures']:
                if e==old:result_exposures += [before,candidate]+([after] if after['length'] else [])
                else:result_exposures.append(e)
            updated['exposures']=result_exposures
    region_ids=[];parents={};tail_ids=[]
    for parent,masks in result['region_masks'].items():
        original=project['fill_regions'][parent]
        if previous:
            identity_region=next((i for i,pid in previous['region_parents'].items() if pid==parent),None)
            if identity_region is None:raise ValueError('Source region set changed; explicitly rebind motion before regeneration')
            existing=project['fill_regions'][identity_region]
        else:
            identity_region=operation_id+'-region-'+hashlib.sha256(parent.encode()).hexdigest()[:12];existing=None
            if identity_region in project['fill_regions']:raise ValueError('Motion region identity reused')
            old_end=original['start']+original['length'];updated['fill_regions'][parent]['length']=start-original['start']
            if old_end>end:
                tail=operation_id+'-tail-'+hashlib.sha256(parent.encode()).hexdigest()[:12]
                if tail in updated['fill_regions']:raise ValueError('Motion tail identity reused')
                updated['fill_regions'][tail]=dict(deepcopy(original),start=end,length=old_end-end);tail_ids.append(tail)
                if parent in project.get('part_bindings',{}):updated.setdefault('part_bindings',{})[tail]=deepcopy(project['part_bindings'][parent])
        region=deepcopy(original);roi_boxes=[_box(mask,w,h) for mask in masks.values()];roi_boxes=[b for b in roi_boxes if b]
        roi_boxes += [[x,y,x+1,y+1] for x,y in result.get('seed_plans',{}).get(parent,{}).get('active_seeds',[])]
        if not roi_boxes:
            if result.get('seed_plans',{}).get(parent,{}).get('source_empty'):roi_boxes=[result['output_roi'][:]]
            else:raise ValueError('A motion region disappeared; repair its visibility/topology explicitly')
        box=[min(b[0] for b in roi_boxes),min(b[1] for b in roi_boxes),max(b[2] for b in roi_boxes),max(b[3] for b in roi_boxes)]
        if max(box[2]-box[0],box[3]-box[1])>512:raise ValueError('Motion-derived region exceeds current512square editable geometry bound')
        settings=_transport_settings(original['settings'],guide,request,w,h,masks,result.get('seed_plans',{}).get(parent,{}).get('source_empty',False));palette=existing['palette_id'] if existing else original['palette_id'];settings.update(palette_id=palette,color=project['palettes'][palette]['rgba'][:])
        region.update(start=start,length=end-start,palette_id=palette,source_layer=original['ink_layer'],source_drawing=entries[original['ink_layer']]['source_exposure']['drawing_id'],source_sha256=fingerprint(entries[original['ink_layer']]['source']),ink_drawing=output_drawings[original['ink_layer']],fill_drawing=output_drawings[original['fill_layer']],settings=settings,roi=box,sampled_context=result['output_roi'][:],version=(existing or original).get('version',0)+1,motion_operation_id=operation_id,motion_parent_region=parent,geometry_status='transported_motion_reviewed' if reviewed else 'transported_motion_candidate',confidence='known_deformation_not_semantic_topology')
        if project['schema_version']=='0.2':
            region.update(region_format='packed_roi_v1' if max(box[2]-box[0],box[3]-box[1])<=224 else 'motion_region_v1',**{key+'_mask':mask for key,mask in masks.items()})
            for key in ['region','covered','boundary','added_barriers','protected_pixels']:region.pop(key,None)
        else:region.update(**{key:mask[:] for key,mask in masks.items()})
        if parent in result.get('domain_masks',{}) or 'component_seeds' in original:
            if parent in result.get('domain_masks',{}):region['ownership_domain']=result['domain_masks'][parent]
            plan=result['seed_plans'][parent];seeds=plan['active_seeds']
            if seeds:settings['seed']=seeds[0][:]
            region['component_seeds']=deepcopy(seeds[1:]);region['seed_transport_review']=deepcopy(plan)
            if plan['source_empty']:region['geometry_status']='empty_owned_region_retained_through_motion'
        region['source_ids']=sorted(set(original.get('source_ids',[])+result['source_ids']));region['warnings']=original.get('warnings',[])+[('Region/part geometry transported by reviewed motion; ' if reviewed else 'Region/part geometry transported by unapproved candidate; ')+'not an independent anatomical or visibility inference.']
        updated.setdefault('fill_regions',{})[identity_region]=region;region_ids.append(identity_region);parents[identity_region]=parent
        binding=(project.get('part_bindings',{}).get(identity_region) if previous else None) or project.get('part_bindings',{}).get(parent)
        if binding:updated.setdefault('part_bindings',{})[identity_region]=dict(deepcopy(binding),target_bounds=result['output_roi'][:],motion_parent_region=parent)
    operation=dict(operation_id=operation_id,actor_id=guide['actor_id'],guide_id=request['guide_id'],guide_snapshot=deepcopy(guide),request=deepcopy(request),source_slot=guide['source_slot'],target_start=start,target_end=end,output_drawings=output_drawings,input_drawings={i:e['source_exposure']['drawing_id'] for i,e in entries.items()},input_sha256={i:fingerprint(e['source']) for i,e in entries.items()},region_ids=region_ids,region_parents=parents,tail_region_ids=tail_ids,visibility_events=deepcopy(result['visibility_events']),missing_source_layers=missing,output_roi=result['output_roi'][:],metrics={i:r['metrics'] for i,r in result['outputs'].items()},new_distinct_drawings=new_count,method=result['method'],version=result['version'],source_ids=result['source_ids'][:],dependency_sha256=scope,warnings=result['warnings'][:],revision_number=(previous.get('revision_number',0)+1) if previous else 0)
    if not reviewed:operation['review_state']='candidate_pool'
    updated.setdefault('motion_operations',[]).append(operation);updated['revision']+=1;updated['history'].append(dict(action='accept-landmark-motion' if reviewed else 'stage-unapproved-motion',operation_id=operation_id,target_start=start,target_end=end))
    from engine.regions import refresh_relations
    from engine.roi_assistance import validate_regions
    refresh_relations(updated);validate_regions(updated);validate(updated);validate_layers(updated);return updated


def request_at_time(project,guide_id,time,target_start,target_end,mode='rigid',operation_id=None,allow_clip=False):
    """Explicit normalized clock sample; spatial/manual progress remains separate.

    No automatic shot-slot correspondence: caller declares target hold, and the
    existing source-key/interval guards still validate it. Clock provenance persists.
    """
    validate_guides(project)
    if guide_id not in project.get('motion_guides',{}):raise ValueError('Select a saved motion guide')
    progress=trajectories.progress_at(project['motion_guides'][guide_id],time)
    result=dict(guide_id=guide_id,mode=mode,progress=progress,clock_time=time,target_start=target_start,target_end=target_end,operation_id=operation_id,allow_clip=allow_clip)
    subject(project,result)
    return result


def accept(project,result,identity):return _install(project,result,identity,True)


def stage(project,request,identity,checkpoint=None):
    """Generate and stage an unapproved copy, never consuming external results."""
    result=propose(project,request,checkpoint)
    return _install(project,result,identity,False,fresh=True)
