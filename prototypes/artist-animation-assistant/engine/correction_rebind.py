"""Reviewed version-preserving correction rebind; no semantic correspondence.

REF-KRITA-TRANSFORM-MASK is an interaction precedent only. REF-NUMPY-NONZERO-2-4
documents bounded tile indexing. No external transform code is copied.
"""
from copy import deepcopy
import numpy as np
from engine import candidate_corrections as corrections, motion, learned_motion as learned
from engine.project import validate, fingerprint
from engine.layers import validate_layers
from engine.io.project_archive import PixelPlane, MemoryTiles, TILE
from engine.spatial_constraints import uniform, drawing_mask, count, ENCODING
from engine.packed_model import check_budget


def working_copy(project, config):
    validate(project);validate_layers(project);corrections.validate_metadata(project)
    if not isinstance(config,dict) or set(config)!={'correction_id','version','family','request','offset'}:raise ValueError('Declare correction/version, target request and integer pixel offset')
    identity=config['correction_id'];rows=project.get('candidate_corrections',{})
    if not isinstance(identity,str) or identity not in rows:raise ValueError('Choose a retained correction')
    row=rows[identity];version=config['version'];family=config['family'];request=config['request'];offset=config['offset']
    if type(version) is not int or not 0<=version<len(row['versions']):raise ValueError('Choose a retained correction version')
    if not isinstance(family,str) or family not in corrections.FAMILIES or not isinstance(request,dict):raise ValueError('Choose an explicit geometric or learned request')
    if not isinstance(offset,list) or len(offset)!=2 or any(type(v) is not int or abs(v)>4096 for v in offset):raise ValueError('Supply integer X/Y offsets within4096pixels')
    q=corrections.deactivate(project,identity)
    # Only the explicitly selected old constraint is disabled in this private
    # candidate. Every other active constraint still participates in normal guards.
    corrections.source_scope(q,family,request)
    if corrections.actor(q,family,request)!=row['actor_id']:raise ValueError('Rebind must keep the same actor; cross-actor correspondence is not declared')
    target=corrections.key(family,request);other=rows.get(target)
    if target!=identity and other and other['active'] is not None:raise ValueError('Target already has active corrections; do not replace them')
    original=row['versions'][version];w,h=project['canvas']['width'],project['canvas']['height']
    if any((p['pixels'].width,p['pixels'].height)!=(w,h) for p in original['patches'].values()):raise ValueError('Canvas size changed; explicit canvas mapping is required')
    scope=fingerprint(dict(binding=corrections.binding(q,family,request),old_entry=row,target_entry=other,epochs={k:project.get('dependency_epochs',{}).get('candidate_correction:'+k,0) for k in {identity,target}},config=config))
    return q,original,target,scope


def translate_patch(patch, offset, checkpoint):
    pixels=patch['pixels'];mask=patch['touched'];w,h=pixels.width,pixels.height;dx,dy=offset;box=motion._box(mask,w,h)
    if box is None:raise ValueError('Retained correction has no marked pixels')
    if box[0]+dx<0 or box[1]+dy<0 or box[2]+dx>w or box[3]+dy>h:raise ValueError('Rebind would clip protected correction pixels')
    if dx==dy==0:return deepcopy(patch)
    pixel_store=MemoryTiles();mask_store=MemoryTiles();pkeys=[];mkeys=[]
    # Iterate destination tiles. Each source ROI is at most64square; no whole
    # canvas index array, interpolation, hidden-RGB loss or partially clipped mark.
    for y in range(0,h,TILE):
        for x in range(0,w,TILE):
            checkpoint();rgba=np.zeros((TILE,TILE,4),np.uint8);flags=rgba.copy();sx,sy=max(0,x-dx),max(0,y-dy);ex,ey=min(w,x+min(TILE,w-x)-dx),min(h,y+min(TILE,h-y)-dy)
            if sx<ex and sy<ey:
                region=[sx,sy,ex,ey];m=np.frombuffer(mask.region_bytes(region),np.uint8).reshape(ey-sy,ex-sx,4);yy,xx=np.nonzero(m[:,:,0]);oy,ox=sy+dy-y,sx+dx-x
                if len(yy):
                    colors=np.frombuffer(pixels.region_bytes(region),np.uint8).reshape(ey-sy,ex-sx,4);rgba[yy+oy,xx+ox]=colors[yy,xx];flags[yy+oy,xx+ox,0]=1
            pkeys.append(pixel_store.put(rgba.tobytes()));mkeys.append(mask_store.put(flags.tobytes()))
    moved=dict(pixels=PixelPlane(w,h,pkeys,pixel_store),touched=PixelPlane(w,h,mkeys,mask_store),lineage=deepcopy(patch['lineage']))
    if count(dict(pixels=moved['pixels'],protected_mask=moved['touched'],protection_encoding=ENCODING))!=count(dict(pixels=pixels,protected_mask=mask,protection_encoding=ENCODING)):raise ValueError('Rebind changed the marked pixel count')
    return moved


def _protected_conflicts(outputs,patches,checkpoint):
    for lid,patch in patches.items():
        out=outputs[lid]
        for i,key in enumerate(patch['touched'].keys):
            checkpoint();touched=np.frombuffer(patch['touched']._store.get(key),np.uint8).reshape(-1,4)[:,0].astype(bool)
            if not touched.any():continue
            protected=np.frombuffer(out['protected_mask']._store.get(out['protected_mask'].keys[i]),np.uint8).reshape(-1,4)[:,0].astype(bool);a=np.frombuffer(out['pixels']._store.get(out['pixels'].keys[i]),np.uint8).reshape(-1,4);b=np.frombuffer(patch['pixels']._store.get(patch['pixels'].keys[i]),np.uint8).reshape(-1,4)
            if np.any(touched & protected & np.any(a!=b,axis=1)):raise ValueError('Rebound correction conflicts with other protected pixels; keep both versions and revise placement')


def _view(project,config):
    request=config['request'];actor=corrections.actor(project,config['family'],request);layers=motion._actor_layers(project,actor);nodes={}
    for lid in layers:
        while lid is not None:nodes[lid]=project['layers'][lid];lid=nodes[lid].get('parent_id')
    exposures=[e for e in project['exposures'] if e['layer_id'] in layers and max(e['start'],request['target_start'])<min(e['start']+e['length'],request['target_end'])]
    return dict(canvas=project['canvas'],nodes=nodes,exposures=exposures,drawings={e['drawing_id']:project['drawings'][e['drawing_id']] for e in exposures})


def propose(project,config,checkpoint=None,*,generator=None):
    checkpoint=checkpoint or (lambda:None);work,old,target,scope=working_copy(project,config);checkpoint();family=config['family'];request=config['request'];raw=(generator or (learned.propose if family=='learned' else motion.propose))(work,request,checkpoint)
    if raw['unsafe_reasons']:raise ValueError('Repair target generator conflicts before rebind: '+'; '.join(raw['unsafe_reasons']))
    outputs=raw['outputs']
    if set(outputs)!=set(old['base_hashes']):raise ValueError('Target paint layers differ; explicit layer correspondence is required')
    patches={lid:translate_patch(patch,config['offset'],checkpoint) for lid,patch in old['patches'].items()};_protected_conflicts(outputs,patches,checkpoint)
    base_hashes={lid:dict(pixels=fingerprint(out['pixels']),mask=fingerprint(out['protected_mask'])) for lid,out in outputs.items()};version=dict(binding=corrections.binding(work,family,request),base_hashes=base_hashes,patches=patches,edited_preview_sha256=fingerprint(dict(scope=scope,base=base_hashes,patches=patches)))
    prepared=deepcopy(work);entry=prepared.setdefault('candidate_corrections',{}).setdefault(target,dict(family=family,actor_id=corrections.actor(work,family,request),request=deepcopy(request),versions=[],active=None))
    if len(entry['versions'])>=8:raise ValueError('Candidate correction version capacity8; retain history before continuing')
    entry['versions'].append(version);entry['active']=len(entry['versions'])-1;corrections.validate_metadata(prepared);check_budget(prepared)
    raw_hash=fingerprint(raw);operation='rebind-'+fingerprint(dict(scope=scope,raw=raw_hash))[:32]
    raw_preview=learned._install_fresh(work,raw,operation,False) if family=='learned' else motion._install(work,raw,operation,False,fresh=True)
    corrected=deepcopy(raw);corrections.overlay(prepared,family,request,corrected['outputs'],checkpoint);corrected['dependency_sha256']=corrections.source_scope(prepared,family,request)
    if family=='learned':corrected['signature']=fingerprint(dict(inputs=corrected['dependency_sha256'],pixels={lid:fingerprint(dict(pixels=out['pixels'],mask=out['protected_mask'])) for lid,out in corrected['outputs'].items()}))
    else:
        for patch in patches.values():
            box=motion._box(patch['touched'],project['canvas']['width'],project['canvas']['height']);b=corrected['output_roi'];corrected['output_roi']=[min(b[0],box[0]),min(b[1],box[1]),max(b[2],box[2]),max(b[3],box[3])]
    preview=learned._install_fresh(prepared,corrected,operation,False) if family=='learned' else motion._install(prepared,corrected,operation,False,fresh=True)
    raw_view=fingerprint(_view(raw_preview,config));mapped_view=fingerprint(_view(preview,config));signature=fingerprint(dict(config=config,inputs=scope,raw=raw_hash,mapped=mapped_view))
    rejected=any(h.get('action')=='reject-correction-rebind' and h.get('signature')==signature and h.get('inputs')==scope for h in project['history'])
    prepared['history'].append(dict(action='reviewed-correction-rebind-proposal',old_correction=config['correction_id'],old_version=config['version'],new_correction=target,offset=deepcopy(config['offset']),raw_sha256=raw_hash,signature=signature))
    return dict(config=deepcopy(config),dependency_sha256=scope,raw_sha256=raw_hash,raw_view_sha256=raw_view,preview_sha256=mapped_view,signature=signature,previously_rejected=rejected,old_version_sha256=fingerprint(old),new_version_sha256=fingerprint(version),raw_preview=raw_preview,preview=preview,prepared=prepared,counts=dict(marked_pixels=sum(count(dict(pixels=p['pixels'],protected_mask=p['touched'],protection_encoding=ENCODING)) for p in patches.values()),corrected_layers=len(patches),generated_pose_evaluations=1),warnings=['Explicit supplied integer translation only; no anatomical/semantic correspondence inferred.','All generated artwork stays unapproved; source drawings and old correction versions retained.','A new source, model result, parameter, placement or correction epoch requires fresh comparison and review.'])


def _verified(project,result,checkpoint,*,generator=None):
    if not isinstance(result,dict):raise ValueError('Expected a rebind proposal')
    current=propose(project,result['config'],checkpoint,generator=generator)
    fields=set(current)-{'raw_preview','preview','prepared'}
    if set(result)!=set(current) or any(result[k]!=current[k] for k in fields):raise ValueError('Rebind proposal differs from current source/backend/placement; review again')
    if fingerprint(_view(result['raw_preview'],result['config']))!=current['raw_view_sha256'] or fingerprint(_view(result['preview'],result['config']))!=current['preview_sha256']:raise ValueError('Rebind comparison was changed')
    old=result['config']['correction_id'];target=corrections.key(result['config']['family'],result['config']['request'])
    if any(result['prepared']['candidate_corrections'].get(k)!=current['prepared']['candidate_corrections'].get(k) for k in {old,target}):raise ValueError('Rebind prepared constraints were changed')
    return current


def accept(project,result,checkpoint=None,*,generator=None):
    current=_verified(project,result,checkpoint,generator=generator)
    if current['previously_rejected']:raise ValueError('This exact rebind was rejected; change evidence or placement before review')
    return current['prepared']


def reject(project,result,reason,checkpoint=None,*,generator=None):
    if not isinstance(reason,str) or not reason.strip() or len(reason)>240:raise ValueError('Record a1..240character rejection reason')
    current=_verified(project,result,checkpoint,generator=generator);q=deepcopy(project);q['history'].append(dict(action='reject-correction-rebind',signature=current['signature'],inputs=current['dependency_sha256'],reason=reason));check_budget(q);return q
