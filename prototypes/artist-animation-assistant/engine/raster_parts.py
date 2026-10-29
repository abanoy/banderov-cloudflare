"""Original binary ownership partitions into editable part groups.

Cited mask/group interaction precedents are in SOURCES. No anatomy inference,
grayscale matting, Frite lattices or unseen-content synthesis.
"""
from copy import deepcopy
import numpy as np
from engine.project import validate,fingerprint
from engine.layers import validate_layers,visible
from engine.motion import _name,_actor_layers,_exposure,_descendant,_plane,_mask,_flags,_box,_preserve_target
from engine.spatial_constraints import uniform,validate_mask,ENCODING,count
from engine.io.project_archive import PixelPlane

SOURCES=['REF-KRITA-FILL-SELECTION','REF-COMPONENT-LABEL','REF-SEED-FILL','REF-KRITA-TRANSPARENCY-MASK','REF-FRITE-GROUP-WORKFLOW','REF-TRANSIENT-EMBEDDINGS-ABSTRACT','REF-COMPOSITING','REF-PYTHON-COPY','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER']


def ownership(project,indices):
    w,h=project['canvas']['width'],project['canvas']['height'];values=sorted(set(indices))
    if any(type(i) is not int or not 0<=i<w*h for i in values) or len(values)>65536:raise ValueError('Ownership mask must contain at most65536 canvas pixels')
    return uniform(w,h).with_edits({i:[1,0,0,0] for i in values}) if project['schema_version']=='0.2' else values


def mask_indices(project,mask):
    w,h=project['canvas']['width'],project['canvas']['height']
    if project['schema_version']=='0.2':
        validate_mask(mask,w,h);box=_box(mask,w,h)
        if box is None:return []
        if max(box[2]-box[0],box[3]-box[1])>256:raise ValueError('Each ownership mask must fit256square')
        return _flags(mask,box)
    if not isinstance(mask,list) or len(mask)>65536 or mask!=sorted(set(mask)) or any(type(i) is not int or not 0<=i<w*h for i in mask):raise ValueError('Invalid sorted ownership indices')
    box=_box(mask,w,h)
    if box and max(box[2]-box[0],box[3]-box[1])>256:raise ValueError('Each ownership mask must fit256square')
    return mask[:]


def validate_parts(project):
    parts=project.get('raster_parts',{})
    if not isinstance(parts,dict) or len(parts)>32:raise ValueError('At most32 retained raster part records')
    for identity,p in parts.items():
        _name(identity);_name(p['settings']['name']);_name(p['settings']['part_id'])
        if p['part_group'] not in project['layers'] or project['layers'][p['part_group']].get('nodetype')!='grouplayer':raise ValueError('Raster part group missing')
        for layer in p['source_layers']:
            if layer not in project['layers'] or p['part_layers'][layer] not in project['layers']:raise ValueError('Raster part layer mapping missing')
        for key in ['source_mask','content_mask']:mask_indices(project,p['settings'][key])
    return project


def subject(project,settings):
    validate(project);validate_layers(project);validate_parts(project)
    expected={'actor_id','source_slot','content_slot','target_start','target_end','name','part_id','source_mask','content_mask','depth','operation_id'}
    if set(settings)!=expected:raise ValueError('Unexpected part ownership settings')
    _name(settings['name']);_name(settings['part_id']);duration=project['shot']['duration_frames'];start,end=settings['target_start'],settings['target_end'];source_slot=settings['source_slot'];donor_slot=settings['content_slot']
    if any(type(v) is not int for v in [start,end,source_slot,donor_slot]) or not 0<=source_slot<start<end<=duration or not 0<=donor_slot<duration:raise ValueError('Source precedes target interval; content key and interval must be in the shot')
    if start<=donor_slot<end:raise ValueError('Choose content outside the edited interval; do not derive a part from its own output')
    if settings['depth'] not in {'front','back','hidden'}:raise ValueError('Choose front, back or hidden part depth')
    source_mask=mask_indices(project,settings['source_mask']);content_mask=mask_indices(project,settings['content_mask'])
    if not source_mask and not content_mask:raise ValueError('Draw a source ownership or approved-content mask')
    actor=settings['actor_id'];previous=project.get('raster_parts',{}).get(settings['operation_id']) if settings['operation_id'] else None
    if settings['operation_id'] and previous is None:raise ValueError('Raster part operation missing')
    if previous and (previous['settings']['actor_id']!=actor or previous['settings']['target_start']!=start or previous['settings']['target_end']!=end):raise ValueError('Part actor/interval changed; explicitly rebind')
    layers=previous['source_layers'][:] if previous else _actor_layers(project,actor);nodes={};entries={}
    for layer in layers:
        node=layer
        while node is not None:
            current=project['layers'][node]
            if current.get('locked') or not current.get('visible',True):raise ValueError('Source actor/ancestors must be visible and unlocked')
            nodes[node]=current;node=current.get('parent_id')
        source=_exposure(project,layer,source_slot);donor=_exposure(project,layer,donor_slot)
        if source is None or donor is None or not project['drawings'][source['drawing_id']].get('approved') or not project['drawings'][donor['drawing_id']].get('approved'):raise ValueError('Part source/content keys must be approved and exposed')
        entry=dict(source_exposure=source,source=project['drawings'][source['drawing_id']],content_exposure=donor,content=project['drawings'][donor['drawing_id']])
        if previous:
            base=_exposure(project,layer,start);part=_exposure(project,previous['part_layers'][layer],start)
            if any(e is None or e['start']!=start or e['length']!=end-start for e in [base,part]) or not _descendant(project,base['drawing_id'],previous['base_drawings'][layer]) or not _descendant(project,part['drawing_id'],previous['part_drawings'][layer]):raise ValueError('Part target is now another key/interval; rebind explicitly')
            entry.update(base_target=project['drawings'][base['drawing_id']],part_target=project['drawings'][part['drawing_id']],base_exposure=base,part_exposure=part)
        elif not source['start']<start<end<=source['start']+source['length']:raise ValueError('Split only inside a held source after its key; distinct keys are never overwritten')
        entries[layer]=entry
    from engine.part_regions import related
    region_info=related(project,settings,entries,previous)
    extra_nodes={i:n for i,n in project['layers'].items() if previous and (i==previous['part_group'] or i in previous['cloned_nodes'].values())}
    scopes={'layer:'+i for i in nodes}|{'layer:'+i for i in extra_nodes}|({'raster_part:'+settings['operation_id']} if previous else set())
    scopes |= {'region:'+i for i in region_info['regions']}|{'part:'+i for i in region_info['regions']}|{'palette:'+i for i in region_info['palettes']}
    data=dict(region_info=region_info,project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],settings=settings,nodes=nodes,extra_nodes=extra_nodes,entries=entries,previous=previous,epochs={i:project.get('dependency_epochs',{}).get(i,0) for i in sorted(scopes)})
    return fingerprint(data),entries,nodes,previous,source_mask,content_mask


def _subset(plane,indices,keep):
    if not keep:return plane.with_edits({i:[0,0,0,0] for i in indices})
    return uniform(plane.width,plane.height).with_edits({i:plane[i] for i in indices})


def propose(project,settings,checkpoint=None):
    scope,entries,nodes,previous,source_mask,content_mask=subject(project,settings);w,h=project['canvas']['width'],project['canvas']['height'];outputs={};warnings=[];protected=set();unsafe=[]
    for entry in entries.values():
        masks=[_mask(entry['source'],w,h)]
        if previous:masks.append(_mask(entry['base_target'],w,h))
        for values in [source_mask,content_mask]:
            box=_box(values,w,h)
            if box:
                for mask in masks:protected.update(_flags(mask,box))
    source_set=set(source_mask)-protected;content_set=set(content_mask)-protected
    for layer,entry in entries.items():
        if checkpoint:checkpoint()
        source=_plane(entry['source'],w,h);content=_plane(entry['content'],w,h);base=_subset(source,source_set,False);part=_subset(content,content_set,True);base_mask=_mask(entry['source'],w,h);part_mask=uniform(w,h)
        if previous:
            base,base_mask,bp,bc=_preserve_target(base,base_mask,entry['base_target'],w,h);part,part_mask,pp,pc=_preserve_target(part,part_mask,entry['part_target'],w,h)
            if settings['depth']!=previous['settings']['depth'] and (bp or pp):unsafe.append('depth_change_with_protected_target')
            if bp or pp:warnings.append(layer+': retained target paint/erase constraints; inspect partition seams.')
        outputs[layer]=dict(base_pixels=base,part_pixels=part,base_mask=base_mask,part_mask=part_mask)
        if project['schema_version']=='0.1':
            outputs[layer]=dict(base_pixels=base.materialize(),part_pixels=part.materialize(),base_protected=_flags(base_mask,[0,0,w,h]),part_protected=_flags(part_mask,[0,0,w,h]))
    from engine.part_regions import plans
    region_plans,_=plans(project,settings,entries,previous,source_set,content_set,outputs,checkpoint)
    for plan in region_plans:
        review=plan['region']['ownership_seed_review']
        if review['displaced'] and review['from_current_review']:warnings.append(plan['parent']+' / '+plan['role']+': earlier seeds '+str(review['displaced'])+' are outside the revised owned interior. They remain recorded; inspect replacement seeds before accepting.')
    removed_protected=len((set(source_mask)|set(content_mask))&protected)
    if removed_protected:warnings.append(str(removed_protected)+' protected world samples excluded from ownership/donor masks; original intent retained.')
    donor=settings['content_slot']!=settings['source_slot']
    warnings += ['Binary pixel ownership preserves original antialias samples; it is not a semantic boundary or feathered matte.','Front/back/hidden is an explicit group choice, not inferred occlusion. New content comes only from the selected approved key.' if donor else 'Part content comes from the source drawing; newly exposed missing artwork is not invented.']
    return dict(region_plans=region_plans,settings=deepcopy(settings),dependency_sha256=scope,outputs=outputs,protected_excluded=removed_protected,ownership_pixels=len(source_set),content_pixels=len(content_set),event='approved_key_content' if donor else 'binary_part_split',unsafe_reasons=sorted(set(unsafe)),warnings=warnings,method='binary-raster-part-ownership',version='0.1.0',source_ids=SOURCES[:])


def accept(project,result,identity):
    settings=result['settings'];scope,entries,nodes,previous,_,_=subject(project,settings)
    if scope!=result['dependency_sha256'] or result!=propose(project,settings):raise ValueError('Part proposal is stale or differs from its declared masks')
    if result['unsafe_reasons']:raise ValueError('Repair part constraints before changing depth')
    updated=deepcopy(project);w,h=project['canvas']['width'],project['canvas']['height'];start,end=settings['target_start'],settings['target_end'];logical=settings['operation_id'] or identity;actor=settings['actor_id'];actor_node=project['layers'][actor];is_group=actor_node.get('nodetype')=='grouplayer'
    if previous:group=previous['part_group'];cloned=previous['cloned_nodes'].copy();part_layers=previous['part_layers'].copy()
    else:
        group=identity+'-group';cloned={}
        def belongs(node):
            if not is_group:return node==actor
            while node is not None:
                if node==actor:return True
                node=project['layers'][node].get('parent_id')
            return False
        for node in nodes:
            if belongs(node) and (node!=actor or not is_group):cloned[node]=identity+'-node-'+str(len(cloned))
        part_layers={layer:cloned[layer] for layer in entries}
        if len(project['layers'])+len(cloned)+1>32:raise ValueError('Part hierarchy exceeds current32layer budget')
        for old,new in cloned.items():
            node=deepcopy(project['layers'][old]);node['parent_id']=cloned.get(node.get('parent_id'),group);updated['layers'][new]=node
    if not previous and (group in project['layers'] or any(i in project['layers'] for i in cloned.values()) or identity+'-blank' in project['drawings'] or identity in project.get('raster_parts',{})):raise ValueError('New raster part identities must be unique')
    parent=actor if is_group else actor_node.get('parent_id');siblings=[n.get('order',0) for i,n in project['layers'].items() if n.get('parent_id')==parent and i!=group];order=min(siblings,default=0)-1 if settings['depth']=='front' else max(siblings,default=0)+1
    updated['layers'][group]=dict(name=settings['name'],nodetype='grouplayer',parent_id=parent,visible=settings['depth']!='hidden',locked=False,isolation='isolate',order=order)
    base_drawings={};part_drawings={};blank_id=identity+'-blank'
    if not previous:updated['drawings'][blank_id]=dict(pixels=uniform(w,h) if project['schema_version']=='0.2' else [[0,0,0,0] for _ in range(w*h)],origin='generated_empty_exposure',approved=True,locked=False)
    for number,(layer,entry) in enumerate(entries.items()):
        for role in ['base','part']:
            drawing_id=identity+'-'+role+'-'+str(number)
            if drawing_id in updated['drawings']:raise ValueError('Part drawing identity must be new')
            out=result['outputs'][layer];drawing=dict(pixels=out[role+'_pixels'],origin='reviewed_raster_part',approved=True,locked=False,parent_drawing=(entry[role+'_exposure']['drawing_id'] if previous else entry['source_exposure']['drawing_id'] if role=='base' else entry['content_exposure']['drawing_id']))
            if project['schema_version']=='0.2':drawing.update(protected_mask=out[role+'_mask'],protection_encoding=ENCODING);drawing['locked']=bool(count(drawing))
            else:drawing.update(protected_pixels=out[role+'_protected'][:],locked=bool(out[role+'_protected']))
            reference_id=entry[role+'_exposure']['drawing_id'] if previous else entry['source_exposure']['drawing_id'] if role=='base' else blank_id
            reference=updated['drawings'][reference_id]
            same_pixels=drawing['pixels']==reference['pixels']
            same_protection=drawing['protected_mask']==_mask(reference,w,h) if project['schema_version']=='0.2' else drawing['protected_pixels']==_flags(_mask(reference,w,h),[0,0,w,h])
            if same_pixels and same_protection:drawing_id=reference_id
            else:updated['drawings'][drawing_id]=drawing
            (base_drawings if role=='base' else part_drawings)[layer]=drawing_id
        if previous:
            next(e for e in updated['exposures'] if e==entry['base_exposure'])['drawing_id']=base_drawings[layer];next(e for e in updated['exposures'] if e==entry['part_exposure'])['drawing_id']=part_drawings[layer]
        else:
            old=entry['source_exposure'];replacement=[dict(old,length=start-old['start']),dict(old,start=start,length=end-start,drawing_id=base_drawings[layer])]
            if end<old['start']+old['length']:replacement.append(dict(old,start=end,length=old['start']+old['length']-end))
            updated['exposures']=[item for e in updated['exposures'] for item in (replacement if e==old else [e])]
            part_layer=part_layers[layer];updated['exposures'] += [dict(layer_id=part_layer,drawing_id=blank_id,start=0,length=start),dict(layer_id=part_layer,drawing_id=part_drawings[layer],start=start,length=end-start)]
            if end<project['shot']['duration_frames']:updated['exposures'].append(dict(layer_id=part_layer,drawing_id=blank_id,start=end,length=project['shot']['duration_frames']-end))
    record=dict(operation_id=logical,settings=deepcopy(settings),source_layers=list(entries),part_layers=part_layers,part_group=group,cloned_nodes=cloned,base_drawings=base_drawings,part_drawings=part_drawings,input_drawings={layer:dict(source=e['source_exposure']['drawing_id'],content=e['content_exposure']['drawing_id']) for layer,e in entries.items()},input_sha256={layer:dict(source=fingerprint(e['source']),content=fingerprint(e['content'])) for layer,e in entries.items()},dependency_sha256=scope,source_ids=SOURCES[:],event=result['event'],new_distinct_drawings=len(updated['drawings'])-len(project['drawings']),warnings=result['warnings'][:],version=previous.get('version',0)+1 if previous else 0)
    from engine.part_regions import apply,related
    apply(project,updated,record,result['region_plans'],related(project,settings,entries,previous),previous)
    updated.setdefault('raster_parts',{})[logical]=record;updated.setdefault('part_operations',[]).append(deepcopy(record));validate(updated);validate_layers(updated);validate_parts(updated);return updated
