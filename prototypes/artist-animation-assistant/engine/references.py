"""Original reference/role controls and rectangle-distance diagnostic baseline.

REF-KRITA-REFERENCE-IMAGES: interaction precedent. REF-PAINTBUCKET: semantic
role/view/ablation motivation, NOT a reimplementation of inclusion matching.
No neural model, figure, reference artwork, code or dataset from that project.
"""
from copy import deepcopy
import base64,hashlib,math
from engine.project import fingerprint,validate
from engine.io.project_archive import SourceBlob,PixelPlane
from engine.io.png_codec import read_png
from engine.regions import binding,managed_pixels,refresh_relations
from engine.fill_revision import protected_pixels
from engine.spatial_constraints import indices,drawing_mask,count,ENCODING

SOURCES=['REF-KRITA-REFERENCE-IMAGES','REF-PAINTBUCKET','REF-PYTHON-COPY','REF-PYTHON-BUFFERS','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER','REF-PALETTE-DOCKER','REF-COMPOSITING']
METHOD='artist-anchored-normalized-rectangle-reference-baseline'


def text(value,label):
    if not isinstance(value,str) or not 1<=len(value)<=80 or any(ord(c)<32 for c in value):raise ValueError('Expected '+label+'(1..80 characters)')
    return value


def rect(value,w,h):
    if not isinstance(value,list) or len(value)!=4 or any(type(i) is not int for i in value) or not 0<=value[0]<value[2]<=w or not 0<=value[1]<value[3]<=h:raise ValueError('Rectangle must be inside its own image coordinates')
    return value[:]


def image_bytes(reference):
    image=reference['image'];raw=image['blob'].data if isinstance(image.get('blob'),SourceBlob) else base64.b64decode(image['encoded_base64'],validate=True)
    if len(raw)>8*1024*1024 or hashlib.sha256(raw).hexdigest()!=image['sha256']:raise ValueError('Reference source identity/size changed')
    return raw


def plane(reference):
    w,h,pixels=read_png(image_bytes(reference),packed=True)
    if (w,h)!=(reference['image']['width'],reference['image']['height']):raise ValueError('Reference dimensions changed')
    return pixels


def validate_references(project):
    refs=project.get('references',{});archive=project.get('reference_archive',{})
    if not isinstance(refs,dict) or not isinstance(archive,dict) or len(refs)+len(archive)>16 or set(refs)&set(archive):raise ValueError('Reference set supports16 retained images, with distinct IDs')
    for identity,r in dict(refs,**archive).items():
        text(identity,'reference ID');text(r['name'],'reference name');text(r['character_id'],'character ID');text(r['view'],'view')
        if type(r['enabled']) is not bool or r['permissions']!={'project_use':True,'training':False,'upload':False}:raise ValueError('References authorize local project use only; training/upload remain separate')
        image_bytes(r);w,h=r['image']['width'],r['image']['height']
        if type(w) is not int or type(h) is not int or not 1<=w<=4096 or not 1<=h<=4096:raise ValueError('Invalid reference dimensions')
        crop=rect(r['crop'],w,h)
        if not isinstance(r['parts'],dict) or len(r['parts'])>64:raise ValueError('Reference supports at most64 annotated parts')
        for pid,p in r['parts'].items():
            text(pid,'part ID');text(p['name'],'part name');b=rect(p['bbox'],w,h);point=p['swatch']
            if not crop[0]<=b[0]<b[2]<=crop[2] or not crop[1]<=b[1]<b[3]<=crop[3]:raise ValueError('Part annotation must be inside the character crop')
            if not isinstance(point,list) or len(point)!=2 or any(type(x) is not int for x in point) or not b[0]<=point[0]<b[2] or not b[1]<=point[1]<b[3]:raise ValueError('Color anchor must be inside its part annotation')
    bindings=project.get('part_bindings',{})
    if not isinstance(bindings,dict) or len(bindings)>512:raise ValueError('Invalid part bindings')
    for region,b in bindings.items():
        if region not in project.get('fill_regions',{}):raise ValueError('Part binding refers to a missing accepted region')
        text(b['character_id'],'character ID');text(b['part_id'],'part ID')
        if b.get('reference_id') is not None and b['reference_id'] not in refs and b['reference_id'] not in archive:raise ValueError('Part binding lost its reference provenance')
        rect(b['target_bounds'],project['canvas']['width'],project['canvas']['height'])
    return project


def add_reference(project,identity,name,character,view,data):
    text(identity,'reference ID');text(name,'name');text(character,'character ID');text(view,'view')
    if identity in project.get('references',{}) or identity in project.get('reference_archive',{}):raise ValueError('Reference identity must be new')
    if len(data)>8*1024*1024:raise ValueError('Reference PNG limit is8MiB')
    w,h,_=read_png(data,packed=True);image=dict(sha256=hashlib.sha256(data).hexdigest(),width=w,height=h)
    if project['schema_version']=='0.2':image['blob']=SourceBlob(data)
    else:image['encoded_base64']=base64.b64encode(data).decode('ascii')
    updated=deepcopy(project);updated.setdefault('references',{})[identity]=dict(name=name,character_id=character,view=view,enabled=True,image=image,crop=[0,0,w,h],parts={},permissions=dict(project_use=True,training=False,upload=False),rights_basis='artist-selected local project reference',revision=0)
    return validate_references(updated)


def edit_reference(project,identity,*,character=None,view=None,crop=None,enabled=None,part_id=None,bbox=None,swatch=None,remove_part=False,archive=False):
    updated=deepcopy(project);r=updated['references'][identity]
    if character is not None:r['character_id']=text(character,'character ID')
    if view is not None:r['view']=text(view,'view')
    if crop is not None:r['crop']=crop[:]
    if enabled is not None:r['enabled']=enabled
    if part_id:
        if remove_part:r['parts'].pop(part_id)
        else:r['parts'][text(part_id,'part ID')]=dict(name=part_id,bbox=bbox[:],swatch=swatch[:],origin='artist_annotation')
    r['revision']+=1
    if archive:updated.setdefault('reference_archive',{})[identity]=updated['references'].pop(identity)
    return validate_references(updated)


def correct_part(project,region_id,character,part_id,target_bounds):
    binding(project,region_id);updated=deepcopy(project)
    updated.setdefault('part_bindings',{})[region_id]=dict(character_id=text(character,'character ID'),part_id=text(part_id,'part ID'),target_bounds=rect(target_bounds,project['canvas']['width'],project['canvas']['height']),reference_id=None,origin='artist_correction')
    return validate_references(updated)


def request_checked(project,request):
    if set(request)!={'region_id','character_id','view','target_bounds','part_override','use_references','propagate_bound'}:raise ValueError('Unexpected reference request fields')
    text(request['region_id'],'region ID');text(request['character_id'],'character ID');text(request['view'],'view')
    if request['part_override'] is not None:text(request['part_override'],'part override')
    if any(type(request[k]) is not bool for k in ['use_references','propagate_bound']):raise ValueError('Reference controls require explicit booleans')
    rect(request['target_bounds'],project['canvas']['width'],project['canvas']['height']);return deepcopy(request)


def box(project,region_id):
    values,_=managed_pixels(project,region_id);w=project['canvas']['width']
    if not values:raise ValueError('Region has no accepted geometry to match')
    return [min(i%w for i in values),min(i//w for i in values),max(i%w for i in values)+1,max(i//w for i in values)+1]


def normalized(b,crop):
    if not crop[0]<=b[0]<b[2]<=crop[2] or not crop[1]<=b[1]<b[3]<=crop[3]:raise ValueError('Target character bounds must contain the selected region')
    w,h=crop[2]-crop[0],crop[3]-crop[1]
    return [(b[0]-crop[0])/w,(b[1]-crop[1])/h,(b[2]-crop[0])/w,(b[3]-crop[1])/h]


def choices(project,request):
    request_checked(project,request);validate_references(project);subject=binding(project,request['region_id'])
    if not request['use_references']:return [],subject
    target=normalized(box(project,request['region_id']),request['target_bounds']);result=[]
    assigned=project.get('part_bindings',{}).get(request['region_id'],{})
    override=request['part_override'] or (assigned.get('part_id') if assigned.get('character_id')==request['character_id'] and assigned.get('origin')=='artist_correction' else None)
    for identity,r in project.get('references',{}).items():
        if not r['enabled'] or r['character_id']!=request['character_id'] or request['view']!='any' and r['view']!=request['view']:continue
        pixels=None
        for pid,part in r['parts'].items():
            if override and pid!=override:continue
            if pixels is None:pixels=plane(r)
            shape=normalized(part['bbox'],r['crop']);score=sum((a-b)**2 for a,b in zip(target,shape))
            x,y=part['swatch'];rgba=pixels[y*pixels.width+x]
            result.append(dict(reference_id=identity,reference_sha256=r['image']['sha256'],reference_revision=r['revision'],reference_crop=r['crop'][:],part_id=pid,view=r['view'],rgba=rgba,score=score,anchor=part['swatch'][:],part_box=part['bbox'][:],identity_source='artist_override' if override else 'geometric_candidate'))
    result.sort(key=lambda r:(r['score'],r['reference_id'],r['part_id']));return result,subject


def role_palette(character,part,view):return 'reference-role-'+hashlib.sha256((character+'\0'+part+'\0'+view).encode()).hexdigest()[:24]


def dependency(project,request):
    request=request_checked(project,request);options,subject=choices(project,request)
    selected=options[0] if options else None;targets={request['region_id']:subject};role=None
    if selected:
        role=role_palette(request['character_id'],selected['part_id'],selected['view'])
        for i,r in project.get('fill_regions',{}).items():
            assigned=project.get('part_bindings',{}).get(i,{})
            if r['palette_id']==role or request['propagate_bound'] and assigned.get('character_id')==request['character_id'] and assigned.get('part_id')==selected['part_id'] and assigned.get('view') in {None,selected['view']}:targets[i]=binding(project,i)
    refs={i:r for i,r in project.get('references',{}).items() if request['use_references'] and r['character_id']==request['character_id'] and (request['view']=='any' or r['view']==request['view'])}
    keys={'reference:'+i for i in refs}|{'part:'+i for i in targets}|{'region:'+i for i in targets}|{'layer:'+l for s in targets.values() for l in s['layers']}
    if role:keys.add('palette:'+role)
    data=dict(project_id=project['project_id'],canvas=project['canvas'],shot=project['shot'],originals_sha256=project['originals_sha256'],request=request,refs=refs,targets=targets,bindings={i:project.get('part_bindings',{}).get(i) for i in targets},palette=project.get('palettes',{}).get(role),epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)})
    return fingerprint(data),options,targets


def propose(project,request,checkpoint=None):
    scope,options,targets=dependency(project,request);selected=options[0] if options else None;updates={};warnings=[]
    if not selected:warnings.append('No eligible enabled reference/part: reference-free preview retains current colors and identity. No automatic assignment to accept.')
    else:
        rgba=selected['rgba'];role=role_palette(request['character_id'],selected['part_id'],selected['view'])
        for identity,s in targets.items():
            if checkpoint:checkpoint()
            d=s['drawing'];packed=isinstance(d['pixels'],PixelPlane)
            if packed:
                from engine.roi_assistance import mask_indices
                protected=mask_indices(drawing_mask(d,legacy_locked=True),s['region'].get('roi',box(project,identity)))
            else:protected=protected_pixels(d)
            protected_set=set(protected)
            edits={i:rgba[:] for i in s['managed'] if i not in protected_set}
            if packed:pixels=d['pixels'].with_edits(edits)
            else:
                pixels=deepcopy(d['pixels'])
                for i,color in edits.items():pixels[i]=color
            updates[identity]=dict(pixels=pixels,old_drawing=s['exposure']['drawing_id'],protected_pixels=protected,managed=s['managed'][:],palette_id=role)
        warnings.append('Rectangle distance is an uncalibrated project baseline, not semantic recognition, inclusion matching or motion inference. Review part/view/color and alternatives.')
        if len(options)>1 and options[1]['score']-selected['score']<.02:warnings.append('Near-tied geometric alternatives: location/shape alone cannot establish part identity.')
        if any(o['part_id']==selected['part_id'] and o['rgba']!=rgba for o in options):warnings.append('Reference views disagree on this role color. The chosen sample is explicit; colors were not averaged.')
        if len(updates)>1:warnings.append('This named role also updates the displayed bound regions. Other character/role identities remain independent.')
        if rgba[3]==0:warnings.append('Reference anchor is transparent; typed geometry and part identity remain for later color correction.')
    if checkpoint:checkpoint()
    return dict(request=deepcopy(request),matching_inputs=dict(target_box=box(project,request['region_id']),target_bounds=request['target_bounds'][:]),dependency_sha256=scope,selected=selected,alternatives=options[:32],updates=updates,warnings=warnings,method=METHOD,version='0.1.1',source_ids=SOURCES[:],score_kind='uncalibrated_squared_normalized_rectangle_distance')


def accept(project,result,identity):
    scope,options,targets=dependency(project,result['request'])
    if scope!=result['dependency_sha256'] or result!=propose(project,result['request']):raise ValueError('Reference result is stale or differs from its declared baseline')
    if not result['selected']:raise ValueError('No reference assignment to accept; keep current artwork')
    selected=result['selected'];request=result['request'];updated=deepcopy(project);role=role_palette(request['character_id'],selected['part_id'],selected['view'])
    for number,(rid,out) in enumerate(result['updates'].items()):
        did=identity+'-'+str(number)
        if did in updated['drawings']:raise ValueError('Reference drawing identity reused')
        s=targets[rid];old=s['drawing'];d=dict(pixels=out['pixels'],origin='reviewed_reference_role',approved=True,locked=bool(out['protected_pixels']),parent_drawing=out['old_drawing'])
        if isinstance(out['pixels'],PixelPlane):d.update(protected_mask=drawing_mask(old,legacy_locked=True),protection_encoding=ENCODING);d['locked']=bool(count(d))
        else:d['protected_pixels']=out['protected_pixels'][:]
        updated['drawings'][did]=d;next(e for e in updated['exposures'] if e==s['exposure'])['drawing_id']=did
        r=updated['fill_regions'][rid];r.update(palette_id=role,fill_drawing=did,version=r.get('version',0)+1);r['settings'].update(palette_id=role,color=selected['rgba'][:])
        previous=project.get('part_bindings',{}).get(rid,{})
        updated.setdefault('part_bindings',{})[rid]=dict(character_id=request['character_id'],part_id=selected['part_id'],target_bounds=request['target_bounds'][:] if rid==request['region_id'] else previous.get('target_bounds',request['target_bounds'])[:],reference_id=selected['reference_id'],origin='artist_correction' if selected['identity_source']=='artist_override' else 'reviewed_geometric_proposal',view=selected['view'],anchor=selected['anchor'][:])
    updated.setdefault('palettes',{})[role]=dict(rgba=selected['rgba'][:],color_profile='sRGB',origin='reviewed_reference_role')
    saved={k:deepcopy(result[k]) for k in ['request','matching_inputs','selected','alternatives','warnings','method','version','source_ids','score_kind','dependency_sha256']};saved['affected_regions']=list(result['updates'])
    updated.setdefault('reference_operations',[]).append(saved);updated['revision']+=1;updated['history'].append(dict(action='accept-reference-role',affected_regions=list(result['updates'])))
    refresh_relations(updated);validate(updated);return validate_references(updated)


def set_depth(project,region_id,depth):
    if type(depth) is not int or not -1000<=depth<=1000:raise ValueError('Part depth must be a whole order from-1000to1000')
    binding(project,region_id);updated=deepcopy(project);r=updated['fill_regions'][region_id];updated['layers'][r['fill_layer']]['order']=depth
    updated.setdefault('part_depth',{})[region_id]=dict(order=depth,scope='fill sibling order only; ink remains separate',origin='artist_assignment');return updated
