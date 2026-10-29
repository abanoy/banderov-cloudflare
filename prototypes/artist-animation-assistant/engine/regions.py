"""Independent region/palette identity design; REF-PALETTE-DOCKER precedent.

No colors are matched approximately. Managed geometry and artist constraints are
explicit. Adjacency below is a shared-ink-coverage proxy, not semantic topology.
"""
from copy import deepcopy

from engine.fill import propose,settings_checked,SOURCES
from engine.fill_revision import inputs,dependency,protected_pixels
from engine.layers import validate_layers
from engine.project import validate,fingerprint

PALETTE_SOURCES=['REF-PYTHON','REF-PYTHON-COPY','REF-PALETTE-DOCKER','REF-COLORIZE-MASK','REF-COMPOSITING']


def _indices(values,count):
    if not isinstance(values,list) or len(values)>count or any(type(i) is not int or not 0<=i<count for i in values) or len(set(values))!=len(values):
        raise ValueError('Invalid authoritative region pixel mask')
    return sorted(values)


def managed_pixels(project,identity):
    region=project['fill_regions'][identity]
    width,height=project['canvas']['width'],project['canvas']['height']
    count=width*height
    if region.get('region_format') in {'packed_roi_v1','motion_region_v1'}:
        from engine.roi_assistance import mask_indices
        return mask_indices(region['covered_mask'],region['roi']),False
    if 'covered' in region:
        return _indices(region['covered'],count),False
    # Explicit legacy v0/v1 representation: recover geometry from retained mask
    # and immutable generation-time ink, never from guessed pixel/color equality.
    ink_id=region.get('ink_drawing',identity+'-ink-drawing')
    if ink_id not in project['drawings']:
        raise ValueError('Legacy region has no retained generation ink; explicitly rebind its managed mask')
    ink=project['drawings'][ink_id]
    if region.get('last_input_sha256') and fingerprint(ink)!=region['last_input_sha256']:
        raise ValueError('Retained generation ink identity changed')
    result=set(_indices(region['region'],count))
    if region['settings']['overlap']:
        for index in list(result):
            x,y=index%width,index//width
            for ny in range(max(0,y-1),min(height,y+2)):
                for nx in range(max(0,x-1),min(width,x+2)):
                    if ink['pixels'][ny*width+nx][3]>0:result.add(ny*width+nx)
    return sorted(result),True


def peers(project,ink_layer,start,length):
    return [(i,r) for i,r in project.get('fill_regions',{}).items() if r['ink_layer']==ink_layer and max(start,r['start'])<min(start+length,r['start']+r['length'])]


def assert_disjoint(project,ink_layer,start,length,region,exclude=None):
    selected=set(region)
    for identity,other in peers(project,ink_layer,start,length):
        if identity!=exclude and selected&set(other['region']):
            raise ValueError('Proposed interior overlaps an accepted region; revise its boundary or explicitly resolve the region assignment')


def refresh_relations(project):
    relations=[]
    items=sorted(project.get('fill_regions',{}).items())
    for index,(left,a) in enumerate(items):
        for right,b in items[index+1:]:
            if a['ink_layer']!=b['ink_layer'] or max(a['start'],b['start'])>=min(a['start']+a['length'],b['start']+b['length']):continue
            covered_a,_=managed_pixels(project,left);covered_b,_=managed_pixels(project,right)
            def interior(r):
                if r.get('region_format') in {'packed_roi_v1','motion_region_v1'}:
                    from engine.roi_assistance import mask_indices
                    return mask_indices(r['region_mask'],r['roi'])
                return r['region']
            overlap=len(set(interior(a))&set(interior(b)))
            shared=len(set(covered_a)&set(covered_b))
            relations.append(dict(regions=[left,right],ink_layer=a['ink_layer'],interior_overlap=overlap,shared_ink_coverage=shared,adjacent_proxy=shared>0 and overlap==0,scope='Shared covered ink pixels only; not semantic part adjacency or occlusion inference'))
    project['region_relations']=relations
    return project


def additional_dependency(project,anchor_id,settings):
    anchor,exposures,layers=inputs(project,anchor_id)
    base=dependency(project,anchor_id,settings)
    topology={i:dict(region=r,epoch=project.get('dependency_epochs',{}).get('region:'+i,0)) for i,r in peers(project,anchor['ink_layer'],anchor['start'],anchor['length'])}
    return fingerprint(dict(anchor=base,topology=topology))


def propose_additional(project,anchor_id,settings,checkpoint=None):
    anchor,exposures,layers=inputs(project,anchor_id)
    additional_dependency(project,anchor_id,settings)
    entry=project.get('palettes',{}).get(settings['palette_id'])
    if entry and entry['rgba']!=settings['color']:raise ValueError('Existing palette has a different value; choose it or explicitly recolor it')
    ink=project['drawings'][exposures['ink']['drawing_id']]['pixels']
    from engine.region_domains import fill_arguments,validate_metadata
    w,h=project['canvas']['width'],project['canvas']['height'];validate_metadata(anchor,w,h)
    result=propose(ink,w,h,settings,checkpoint,**fill_arguments(anchor,w,h,include_seeds=False))
    assert_disjoint(project,anchor['ink_layer'],anchor['start'],anchor['length'],result['region'])
    shared=0
    for identity,other in peers(project,anchor['ink_layer'],anchor['start'],anchor['length']):
        managed,_=managed_pixels(project,identity)
        shared+=len(set(managed)&set(result['covered']))
    if shared:result['warnings'].append(f'{shared} shared ink-coverage pixels: existing fill siblings keep their current front-to-back priority; inspect antialiased/translucent edges.')
    result['method']='additional-seed-region-on-shared-ink'
    result['source_ids']+=['REF-PYTHON-COPY','REF-PALETTE-DOCKER']
    return result


def accept_additional(project,result,anchor_id,identity):
    anchor,exposures,layers=inputs(project,anchor_id)
    assert_disjoint(project,anchor['ink_layer'],anchor['start'],anchor['length'],result['region'])
    group=project['layers'][anchor['ink_layer']].get('parent_id')
    if group is None:raise ValueError('Shared region ink must have an explicit group')
    fill_layer=identity+'-fill';fill_id=identity+'-drawing';blank_id=identity+'-blank'
    if identity in project.get('fill_regions',{}) or fill_layer in project['layers'] or any(i in project['drawings'] for i in [fill_id,blank_id]):raise ValueError('Additional region identities must be new')
    if result['ink']!=project['drawings'][exposures['ink']['drawing_id']]['pixels']:raise ValueError('An additional region cannot rewrite shared ink')
    palette=result['settings']['palette_id']
    entry=project.get('palettes',{}).get(palette)
    if entry and entry['rgba']!=result['settings']['color']:raise ValueError('Existing palette has a different value; explicitly recolor or choose that palette value')
    updated=deepcopy(project)
    order=max(v.get('order',0) for v in updated['layers'].values() if v.get('parent_id')==group)+1
    updated['layers'][fill_layer]=dict(name='Flat: '+palette,parent_id=group,order=order,visible=True,locked=False)
    updated['drawings'][fill_id]=dict(pixels=deepcopy(result['fill']),origin='reviewed_additional_region',approved=True,locked=False)
    updated['drawings'][blank_id]=dict(pixels=[[0,0,0,0] for _ in result['fill']],origin='transparent_fill_hold',approved=True,locked=False)
    for exposure in project['exposures']:
        if exposure['layer_id']==anchor['ink_layer']:
            selected=exposure==exposures['ink']
            updated['exposures'].append(dict(exposure,layer_id=fill_layer,drawing_id=fill_id if selected else blank_id))
    updated['palettes'][palette]=dict(rgba=result['settings']['color'][:],color_profile='sRGB',origin='artist_assignment')
    updated['fill_regions'][identity]=dict(source_layer=anchor['source_layer'],source_drawing=exposures['ink']['drawing_id'],source_sha256=fingerprint(project['drawings'][exposures['ink']['drawing_id']]),start=anchor['start'],length=anchor['length'],ink_layer=anchor['ink_layer'],fill_layer=fill_layer,ink_drawing=exposures['ink']['drawing_id'],fill_drawing=fill_id,palette_id=palette,boundary=result['boundary'][:],region=result['region'][:],covered=result['covered'][:],settings=deepcopy(result['settings']),warnings=result['warnings'][:],source_ids=result['source_ids'][:],method=result['method'],method_version=result['version'],version=0,status='artist_reviewed',confidence='uncalibrated_geometry_requires_artist_review')
    from engine.region_domains import inherit_domain
    updated['fill_regions'][identity].update(inherit_domain(anchor))
    updated['revision']+=1
    updated['history'].append(dict(action='accept-additional-region',region_id=identity,shared_ink=anchor['ink_layer']))
    refresh_relations(updated);validate(updated);validate_layers(updated)
    return updated,fill_layer


def request_checked(request):
    if not isinstance(request,dict) or request.get('action') not in {'recolor','rebind'}:raise ValueError('Expected explicit recolor or rebind')
    required={'action','palette_id','rgba'} if request['action']=='recolor' else {'action','palette_id','region_id'}
    if set(request)!=required:raise ValueError('Unexpected palette request properties')
    identity=request['palette_id']
    if not isinstance(identity,str) or not 1<=len(identity)<=80 or any(ord(c)<32 for c in identity):raise ValueError('Expected stable palette identity')
    if request['action']=='recolor':
        rgba=request['rgba']
        if not isinstance(rgba,list) or len(rgba)!=4 or any(type(c) is not int or not 0<=c<=255 for c in rgba):raise ValueError('Expected RGBA8 palette value, including explicit transparency')
    elif not isinstance(request['region_id'],str):raise ValueError('Expected selected region identity')
    return deepcopy(request)


def binding(project,region_id):
    region=project['fill_regions'][region_id]
    matches=[e for e in project['exposures'] if e['layer_id']==region['fill_layer'] and e['start']==region['start'] and e['length']==region['length']]
    if len(matches)!=1:raise ValueError('Palette region exposure changed; explicitly rebind before recoloring')
    nodes={};parent=region['fill_layer']
    while parent is not None:
        node=project['layers'][parent]
        if node.get('locked',False):raise ValueError('Palette edit affects a locked layer/group; explicitly unlock it first')
        nodes[parent]=node;parent=node.get('parent_id')
    managed,legacy=managed_pixels(project,region_id)
    drawing=project['drawings'][matches[0]['drawing_id']]
    return dict(region=region,exposure=matches[0],drawing=drawing,layers=nodes,managed=managed,legacy_mask=legacy)


def palette_dependency(project,request):
    validate(project);validate_layers(project);request=request_checked(request)
    if project['schema_version']!='0.2' and max(project['canvas']['width'],project['canvas']['height'])>256:raise ValueError('Palette prototype is bounded to256px')
    target=request['palette_id']
    if request['action']=='rebind':
        if target not in project.get('palettes',{}):raise ValueError('Create the target palette entry before rebinding')
        if request['region_id'] not in project.get('fill_regions',{}):raise ValueError('Select an accepted region to rebind')
        identities=[request['region_id']]
    else:identities=sorted(i for i,r in project.get('fill_regions',{}).items() if r['palette_id']==target)
    subjects={i:binding(project,i) for i in identities}
    palettes={target}|{v['region']['palette_id'] for v in subjects.values()}
    keys={'region:'+i for i in identities}|{'palette:'+i for i in palettes}|{'layer:'+identity for v in subjects.values() for identity in v['layers']}
    epochs={key:project.get('dependency_epochs',{}).get(key,0) for key in sorted(keys)}
    return fingerprint(dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],request=request,subjects=subjects,palettes={i:project.get('palettes',{}).get(i) for i in sorted(palettes)},epochs=epochs)),subjects


def propose_palette(project,request,checkpoint=None):
    request=request_checked(request);scope,subjects=palette_dependency(project,request)
    rgba=request['rgba'] if request['action']=='recolor' else project['palettes'][request['palette_id']]['rgba']
    updates={};warnings=[]
    for identity,subject in subjects.items():
        if checkpoint:checkpoint()
        pixels=deepcopy(subject['drawing']['pixels'])
        packed=project['schema_version']=='0.2'
        if packed:
            from engine.spatial_constraints import drawing_mask
            from engine.roi_assistance import mask_indices
            protected=set(mask_indices(drawing_mask(subject['drawing'],legacy_locked=True),subject['region']['roi']))
        else:protected=set(protected_pixels(subject['drawing']))
        edits={}
        for position,index in enumerate(subject['managed']):
            if checkpoint and position%256==0:checkpoint()
            if index not in protected:
                if packed:edits[index]=rgba[:]
                else:pixels[index]=rgba[:] 
        if packed:pixels=pixels.with_edits(edits)
        updates[identity]=dict(pixels=pixels,protected_pixels=sorted(protected),managed=subject['managed'][:],old_drawing=subject['exposure']['drawing_id'])
        if protected:warnings.append(f'{identity}: {len(protected)} artist-protected pixels retain their exact RGBA, independently of palette color.')
        if subject['region'].get('geometry_status'):warnings.append(f'{identity}: ink geometry changed; this palette edit uses the accepted mask. Review its boundary to resegment.')
        if subject['legacy_mask']:warnings.append(f'{identity}: legacy managed mask reconstructed from saved region and retained generation ink, not color matching.')
    if checkpoint:checkpoint()
    if not updates:warnings.append('No bound regions: this edit creates or updates only the palette entry.')
    return dict(request=request,dependency_sha256=scope,updates=updates,rgba=rgba[:],warnings=warnings,method='explicit-palette-identity-edit-with-artist-constraints',version='0.1.0',source_ids=PALETTE_SOURCES[:])


def accept_palette(project,result,identity_prefix):
    request=request_checked(result['request']);scope,subjects=palette_dependency(project,request)
    if scope!=result['dependency_sha256'] or set(subjects)!=set(result['updates']):raise ValueError('Palette dependencies changed')
    updated=deepcopy(project);target=request['palette_id'];changes=[]
    for index,(identity,subject) in enumerate(subjects.items()):
        drawing_id=identity_prefix+'-'+str(index)
        if drawing_id in project['drawings']:raise ValueError('Palette drawing identities must be new')
        output=result['updates'][identity]
        packed=project['schema_version']=='0.2'
        if packed:
            from engine.spatial_constraints import indices,drawing_mask,count,ENCODING
            from engine.roi_assistance import mask_indices
            protected=mask_indices(drawing_mask(subject['drawing'],legacy_locked=True),subject['region']['roi'])
        else:protected=protected_pixels(subject['drawing'])
        if output['protected_pixels']!=protected or any(output['pixels'][i]!=subject['drawing']['pixels'][i] for i in protected):raise ValueError('Palette edit attempted to discard artist constraints')
        updated['drawings'][drawing_id]=dict(pixels=deepcopy(output['pixels']),origin='reviewed_palette_edit',approved=True,locked=bool(protected),protected_pixels=protected,parent_drawing=subject['exposure']['drawing_id'])
        if packed:
            d=updated['drawings'][drawing_id];d.pop('protected_pixels');d.update(protected_mask=drawing_mask(subject['drawing'],legacy_locked=True),protection_encoding=ENCODING);d['locked']=bool(count(d))
        next(e for e in updated['exposures'] if e==subject['exposure'])['drawing_id']=drawing_id
        region=updated['fill_regions'][identity]
        changes.append(dict(region_id=identity,before=subject['exposure']['drawing_id'],after=drawing_id,previous_palette_id=region['palette_id'],previous_settings=deepcopy(region['settings'])))
        layer=updated['layers'][region['fill_layer']]
        if layer['name']=='Flat: '+region['palette_id']:layer['name']='Flat: '+target
        region.update(palette_id=target,fill_drawing=drawing_id,covered=output['managed'][:],protected_pixels=protected,version=region.get('version',0)+1)
        if packed:
            region.pop('covered',None);region.pop('protected_pixels',None)
        region['settings']['palette_id']=target;region['settings']['color']=result['rgba'][:]
        region['palette_edit']=dict(method=result['method'],version=result['version'],source_ids=result['source_ids'][:],artist_assignment=True)
    if request['action']=='recolor':updated.setdefault('palettes',{})[target]=dict(rgba=result['rgba'][:],color_profile='sRGB',origin='artist_palette_edit')
    updated['revision']+=1
    updated['history'].append(dict(action='accept-palette-'+request['action'],palette_id=target,changes=changes,previous_palette=deepcopy(project.get('palettes',{}).get(target))))
    refresh_relations(updated);validate(updated);validate_layers(updated)
    return updated
