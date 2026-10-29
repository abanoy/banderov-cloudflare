"""Explicit candidate paint/erase adoption, independent of motion generator.

REF-COLORIZE-MASK is an interaction precedent only; no Krita algorithm copied.
Exact source/candidate bindings and tiled override policy are project design.
"""
from copy import deepcopy
import re
import numpy as np
from engine.project import fingerprint,validate
from engine.layers import validate_layers
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE
from engine.spatial_constraints import drawing_mask,validate_mask,validate_artist_delta,merge,count,ENCODING
from engine.packed_model import check_budget

FAMILIES={'learned','geometric'}
def digest(value):return isinstance(value,str) and re.fullmatch('[a-f0-9]{64}',value) is not None
def key(family,request):
    if family not in FAMILIES or not isinstance(request,dict):raise ValueError('Unknown candidate correction family/request')
    return fingerprint(dict(family=family,request=request))
def actor(project,family,request):return request['actor_id'] if family=='learned' else project['motion_guides'][request['guide_id']]['actor_id']
def source_scope(project,family,request):
    if family=='learned':
        from engine.learned_motion import subject
    else:
        from engine.motion import subject
    return subject(project,request)[0]


def validate_metadata(project):
    rows=project.get('candidate_corrections',{})
    if not isinstance(rows,dict) or len(rows)>32:raise ValueError('Candidate correction capacity32requests')
    if rows and project['schema_version']!='0.2':raise ValueError('Candidate corrections need explicit compact0.2project')
    w,h=project['canvas']['width'],project['canvas']['height']
    for identity,row in rows.items():
        if not digest(identity) or not isinstance(row,dict) or set(row)!={'family','actor_id','request','versions','active'} or not isinstance(row['family'],str) or row['family'] not in FAMILIES or key(row['family'],row['request'])!=identity or not isinstance(row['actor_id'],str) or not row['actor_id'] or row['active'] is not None and row['actor_id'] not in project['layers']:raise ValueError('Malformed candidate correction binding')
        if row['active'] is not None:
            try:expected_actor=actor(project,row['family'],row['request'])
            except (KeyError,TypeError):raise ValueError('Active candidate correction source anchor is missing')
            if row['actor_id']!=expected_actor:raise ValueError('Candidate correction actor differs from request')
        versions=row['versions'];active=row['active']
        if not isinstance(versions,list) or not 1<=len(versions)<=8 or active is not None and (type(active) is not int or not 0<=active<len(versions)):raise ValueError('Candidate correction version capacity8or invalid active selection')
        for version in versions:
            if not isinstance(version,dict) or set(version)!={'binding','base_hashes','patches','edited_preview_sha256'} or not digest(version['binding']) or not digest(version['edited_preview_sha256']):raise ValueError('Malformed candidate correction version')
            bases,patches=version['base_hashes'],version['patches']
            if not isinstance(bases,dict) or not 1<=len(bases)<=32 or not isinstance(patches,dict) or not patches or not set(patches)<=set(bases):raise ValueError('Candidate correction layer mapping changed')
            for lid,hashes in bases.items():
                if row['active'] is not None and lid not in project['layers'] or not isinstance(hashes,dict) or set(hashes)!={'pixels','mask'} or not all(digest(v) for v in hashes.values()):raise ValueError('Malformed candidate baseline hashes')
            for lid,patch in patches.items():
                if not isinstance(patch,dict) or set(patch)!={'pixels','touched','lineage'} or not isinstance(patch['pixels'],PixelPlane) or row['active'] is not None and (patch['pixels'].width,patch['pixels'].height)!=(w,h):raise ValueError('Malformed candidate pixel patch')
                validate_mask(patch['touched'],patch['pixels'].width,patch['pixels'].height)
                if not count(dict(pixels=patch['pixels'],protected_mask=patch['touched'],protection_encoding=ENCODING)):raise ValueError('Empty candidate correction mask')
                if not isinstance(patch['lineage'],list) or not 1<=len(patch['lineage'])<=64 or any(not digest(v) for v in patch['lineage']):raise ValueError('Malformed candidate edit lineage')
    return project


def active(project,family,request):
    row=project.get('candidate_corrections',{}).get(key(family,request))
    return row['versions'][row['active']] if row and row['active'] is not None else None


def binding(project,family,request):
    """Conditioning identities omit internal pool cuts; real source epochs remain."""
    if family=='learned':
        from engine.learned_motion import _base_subject
        _,layers,nodes,entries=_base_subject(project,request)
        drawings={lid:{name:dict(id=entries[lid][name]['drawing_id'],drawing=project['drawings'][entries[lid][name]['drawing_id']]) for name in ('source','guide')} for lid in layers}
    else:
        from engine.motion import _base_subject
        _,guide,entries,regions,operation,missing=_base_subject(project,request);nodes={};drawings={}
        for lid,entry in entries.items():
            drawings[lid]={name:entry[name] for name in ('source','guide_drawing','target') if name in entry}
            node=lid
            while node is not None:nodes[node]=project['layers'][node];node=nodes[node].get('parent_id')
    guides={i:g for i,g in project.get('motion_guides',{}).items() if g['actor_id'] in nodes};related={i:r for i,r in project.get('fill_regions',{}).items() if r['ink_layer'] in nodes or r['fill_layer'] in nodes};prefixes={'layer:'+i for i in nodes}|{'guide:'+i for i in guides}|{'region:'+i for i in related}|{'part:'+i for i in related}|{'palette:'+r['palette_id'] for r in related.values()}
    epochs={k:v for k,v in project.get('dependency_epochs',{}).items() if k in prefixes}
    return fingerprint(dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],family=family,request=request,nodes=nodes,drawings=drawings,guides=guides,epochs=epochs))


def check_overlap(project,family,request):
    from engine.motion import _actor_layers
    own=key(family,request);who=actor(project,family,request);consumed=set(_actor_layers(project,who));a,b=request['target_start'],request['target_end']
    for identity,row in project.get('candidate_corrections',{}).items():
        if row['active'] is None or not consumed.intersection(_actor_layers(project,row['actor_id'])):continue
        old=row['request']
        if max(a,old['target_start'])<min(b,old['target_end']) and identity!=own:raise ValueError('Retained candidate correction overlaps changed method/parameters; rebind or explicitly deactivate it first')


def scope(project,family,request,base_scope):
    if not project.get('candidate_corrections') and not any(k.startswith('candidate_correction:') for k in project.get('dependency_epochs',{})):return base_scope
    validate_metadata(project);check_overlap(project,family,request);identity=key(family,request);version=active(project,family,request);epoch=project.get('dependency_epochs',{}).get('candidate_correction:'+identity,0)
    if version is not None and version['binding']!=binding(project,family,request):raise ValueError('Retained candidate correction needs source rebind; it was not discarded')
    if version is None and not epoch:return base_scope
    return fingerprint(dict(base=base_scope,correction=version,epoch=epoch))


def overlay(project,family,request,outputs,checkpoint=None):
    version=active(project,family,request)
    if version is None:return {}
    if version['binding']!=binding(project,family,request):raise ValueError('Retained candidate correction source changed')
    current={lid:dict(pixels=fingerprint(out['pixels']),mask=fingerprint(out['protected_mask'])) for lid,out in outputs.items()}
    if current!=version['base_hashes']:raise ValueError('Regenerated candidate pixels/protection changed; rebind retained correction explicitly')
    counts={}
    for lid,patch in version['patches'].items():
        out=outputs[lid];pixels=out['pixels'];store=OverlayTiles(pixels._store);keys=list(pixels.keys)
        for i,mask_key in enumerate(patch['touched'].keys):
            if checkpoint:checkpoint()
            flags=np.frombuffer(patch['touched']._store.get(mask_key),np.uint8).reshape(-1,4)[:,0].astype(bool)
            if not flags.any():continue
            rgba=np.frombuffer(pixels._store.get(keys[i]),np.uint8).reshape(-1,4).copy();new=np.frombuffer(patch['pixels']._store.get(patch['pixels'].keys[i]),np.uint8).reshape(-1,4);rgba[flags]=new[flags];keys[i]=store.put(rgba.tobytes())
        out['pixels']=PixelPlane(pixels.width,pixels.height,keys,store);out['protected_mask']=merge(out['protected_mask'],patch['touched']);counts[lid]=count(dict(pixels=out['pixels'],protected_mask=patch['touched'],protection_encoding=ENCODING));out.setdefault('metrics',{})['candidate_correction_pixels']=counts[lid]
    return counts


def _exposure(project,lid,slot):return next(e for e in project['exposures'] if e['layer_id']==lid and e['start']<=slot<e['start']+e['length'])


def descriptors(source,preview):
    """Exposed, freshly installed operations; stored unexposed assets stay unedited."""
    old_learned={r['id'] for r in source.get('learned_motion_operations',[])};old_geo={r['operation_id'] for r in source.get('motion_operations',[])};rows=[]
    for family,operations,id_field,old in [('learned',preview.get('learned_motion_operations',[]),'id',old_learned),('geometric',preview.get('motion_operations',[]),'operation_id',old_geo)]:
        for op in operations:
            if op[id_field] in old:continue
            request=op['settings'] if family=='learned' else op['request'];drawings=op['drawings'] if family=='learned' else op['output_drawings'];slot=request['target_start']
            if not any(did not in source['drawings'] and _exposure(preview,lid,slot)['drawing_id']==did for lid,did in drawings.items()):continue
            if any(_exposure(preview,lid,slot)['drawing_id']!=did for lid,did in drawings.items()):raise ValueError('Candidate actor is not exposed as a complete bundle')
            rows.append(dict(family=family,request=deepcopy(request),actor_id=actor(source,family,request),drawings=deepcopy(drawings),binding=binding(source,family,request),source_scope=source_scope(source,family,request)))
    if not rows:raise ValueError('Select a schedule exposing at least one generated candidate')
    return rows


def editable_copy(source,preview):
    if source['schema_version']!='0.2':raise ValueError('Use an explicit compact0.2candidate project for correction adoption')
    rows=descriptors(source,preview);q=deepcopy(preview)
    for row in rows:
        for lid,did in list(row['drawings'].items()):
            if q['drawings'][did].get('approved') is False:continue
            # A geometric layer may reuse an unchanged approved source. Fork only
            # this candidate exposure; do not paint on every source occurrence.
            name='editable-candidate-'+fingerprint(dict(family=row['family'],request=row['request'],layer=lid))[:32]
            if name in q['drawings']:raise ValueError('Editable candidate identity collision')
            old=q['drawings'][did];d=deepcopy(old);d.pop('protected_pixels',None);d.update(approved=False,origin='unreviewed_motion_candidate',parent_drawing=did,protected_mask=drawing_mask(old),protection_encoding=ENCODING);d['locked']=bool(count(d));q['drawings'][name]=d;e=_exposure(q,lid,row['request']['target_start']);e['drawing_id']=name;row['drawings'][lid]=name
        row['base_hashes']={lid:dict(pixels=fingerprint(q['drawings'][did]['pixels']),mask=fingerprint(drawing_mask(q['drawings'][did]))) for lid,did in row['drawings'].items()}
    validate(q);validate_layers(q);check_budget(q);return q,rows


def adopt(source,before,edited,rows,checkpoint=None):
    """Adopt explicit paint chains as constraints; no drawing/exposure is approved."""
    validate(source);validate(before);validate(edited);validate_metadata(source)
    if source['schema_version']!='0.2' or not isinstance(rows,list) or not 1<=len(rows)<=16:raise ValueError('Expected bounded compact candidate correction context')
    roots={}
    for index,row in enumerate(rows):
        if row['binding']!=binding(source,row['family'],row['request']) or row['source_scope']!=source_scope(source,row['family'],row['request']):raise ValueError('Candidate source/correction state changed before adoption')
        for lid,did in row['drawings'].items():
            if did in roots:raise ValueError('Candidate edit roots must be distinct')
            if before['drawings'][did].get('approved') is not False:raise ValueError('Only unapproved candidate drawings are editable here')
            roots[did]=(index,lid)
    ignore={'drawings','exposures','history','revision','dependency_epochs','proposals'}
    if {k:v for k,v in before.items() if k not in ignore}!={k:v for k,v in edited.items() if k not in ignore}:raise ValueError('Candidate correction adoption cannot discard layer/timing/reference/region changes; keep the edited copy and handle them explicitly')
    if edited['history'][:len(before['history'])]!=before['history']:raise ValueError('Edited candidate history no longer extends the preview')
    for identity,value in before['proposals'].items():
        after=edited['proposals'].get(identity);expected=deepcopy(value)
        if expected.get('status')=='pending' and after and after.get('status')=='stale':expected['status']='stale'
        if after!=expected:raise ValueError('Unexpected proposal change in edited candidate')
    if set(before['proposals'])!=set(edited['proposals']):raise ValueError('Unexpected edited proposal set')
    if any(edited['drawings'].get(did)!=d for did,d in before['drawings'].items()):raise ValueError('A retained source/candidate version was overwritten')
    extra=set(edited['drawings'])-set(before['drawings']);cache={};chains={};touched={}
    def root(did,trail=()):
        if did in roots:return did
        if did in cache:return cache[did]
        if did not in extra or did in trail or len(trail)>=64:raise ValueError('Edited drawing is outside the candidate lineage or cyclic')
        d=edited['drawings'][did]
        expected={'pixels','origin','approved','locked','protected_mask','protection_encoding','parent_drawing','candidate_correction','candidate_touched_mask'}
        if set(d)!=expected or d.get('approved') is not False or d.get('origin')!='unreviewed_motion_candidate' or d.get('candidate_correction') is not True:raise ValueError('Candidate edit must remain unapproved and come from explicit paint/erase')
        parent=d.get('parent_drawing');ancestor=root(parent,trail+(did,));previous=edited['drawings'][parent];mask=drawing_mask(d);delta=validate_mask(d['candidate_touched_mask'],mask.width,mask.height);validate_artist_delta(previous['pixels'],d['pixels'],delta)
        if merge(drawing_mask(previous),delta)!=mask:raise ValueError('Candidate edit removed or forged inherited protected marks')
        cache[did]=ancestor;chains[did]=chains.get(parent,[])+[fingerprint(d)];touched[did]=merge(touched[parent],delta) if parent in touched else delta;return ancestor
    for did in extra:
        if checkpoint:checkpoint()
        root(did)
    if len(before['exposures'])!=len(edited['exposures']):raise ValueError('Candidate correction cannot retime holds')
    leaves={};used=set()
    for a,b in zip(before['exposures'],edited['exposures']):
        if {k:v for k,v in a.items() if k!='drawing_id'}!={k:v for k,v in b.items() if k!='drawing_id'}:raise ValueError('Candidate correction cannot retime/reorganize exposures')
        if a['drawing_id']==b['drawing_id']:continue
        ancestor=root(b['drawing_id'])
        if ancestor!=a['drawing_id']:raise ValueError('Edited exposure changed a source key or another candidate')
        if ancestor in leaves and leaves[ancestor]!=b['drawing_id']:raise ValueError('Choose one edited version per candidate pose')
        leaves[ancestor]=b['drawing_id'];used.add(b['drawing_id'])
    if not leaves:raise ValueError('Paint/erase a generated candidate first')
    lineage_used=set()
    for did in used:
        while did in extra:lineage_used.add(did);did=edited['drawings'][did]['parent_drawing']
    if extra!=lineage_used:raise ValueError('Unexposed new edits remain; preserve/select them explicitly instead of dropping them')
    q=deepcopy(source);groups={}
    for ancestor,leaf in leaves.items():
        index,lid=roots[ancestor];d=edited['drawings'][leaf];groups.setdefault(index,{})[lid]=dict(pixels=d['pixels'],touched=touched[leaf],lineage=chains[leaf])
    for index,patches in groups.items():
        row=rows[index];identity=key(row['family'],row['request']);old=active(source,row['family'],row['request']);entry=q.setdefault('candidate_corrections',{}).setdefault(identity,dict(family=row['family'],actor_id=row['actor_id'],request=deepcopy(row['request']),versions=[],active=None))
        if len(entry['versions'])>=8:raise ValueError('Candidate correction version capacity8; preserve history before continuing')
        combined=deepcopy(old['patches']) if old else {}
        for lid,patch in patches.items():
            if lid in combined:patch=dict(patch,touched=merge(combined[lid]['touched'],patch['touched']))
            combined[lid]=patch
        base=deepcopy(old['base_hashes'] if old else row['base_hashes'])
        entry['versions'].append(dict(binding=row['binding'],base_hashes=base,patches=combined,edited_preview_sha256=fingerprint(edited)));entry['active']=len(entry['versions'])-1
    q['history'].append(dict(action='adopt-candidate-corrections',requests=len(groups),edited_preview_sha256=fingerprint(edited)));validate_metadata(q);check_budget(q);return q


def deactivate(project,identity):
    validate_metadata(project)
    if identity not in project.get('candidate_corrections',{}):raise ValueError('Choose a retained correction')
    q=deepcopy(project);q['candidate_corrections'][identity]['active']=None;q['history'].append(dict(action='deactivate-candidate-correction-retain-history',correction=identity));return q


def activate(project,identity,version):
    validate_metadata(project)
    if identity not in project.get('candidate_corrections',{}) or type(version) is not int or not 0<=version<len(project['candidate_corrections'][identity]['versions']):raise ValueError('Choose a retained correction version')
    row=project['candidate_corrections'][identity]
    if row['versions'][version]['binding']!=binding(project,row['family'],row['request']):raise ValueError('Retained correction needs source rebind before activation')
    q=deepcopy(project);q['candidate_corrections'][identity]['active']=version;q['history'].append(dict(action='activate-retained-candidate-correction',correction=identity,version=version));validate_metadata(q);return q
