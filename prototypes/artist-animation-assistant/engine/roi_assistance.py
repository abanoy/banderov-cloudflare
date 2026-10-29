"""Independent bounded context adapters; REF-KRITA-SELECTIONS/FILL-SELECTION.

Selection limits output; it does not prove an ink/anatomical boundary. Existing
geometry baselines remain attributed in cleanup/fill. No model or copied engine.
"""
from copy import deepcopy
import numpy as np
from engine.project import validate,fingerprint
from engine.layers import validate_layers,source_over
from engine.io.project_archive import PixelPlane,OverlayTiles,TILE
from engine.spatial_constraints import uniform,drawing_mask,indices,count,merge,ENCODING
from engine.cleanup import defaults as cleanup_defaults,checked,subject as cleanup_subject,propose as cleanup
from engine.fill import settings_checked,propose as fill

ADAPTER='packed-context-roi-1'
SOURCES=['REF-KRITA-SELECTIONS','REF-KRITA-FILL-SELECTION','REF-PYTHON-COPY','REF-PYTHON-BUFFERS','REF-NUMPY-2-4-1','REF-NUMPY-BUFFER']


def rectangle(project,roi):
    w,h=project['canvas']['width'],project['canvas']['height']
    if not isinstance(roi,list) or len(roi)!=4 or any(type(i) is not int for i in roi) or not 0<=roi[0]<roi[2]<=w or not 0<=roi[1]<roi[3]<=h:raise ValueError('Choose a rectangle inside the drawing')
    if roi[2]-roi[0]>224 or roi[3]-roi[1]>224:raise ValueError('Select at most224x224 source pixels;16pixel context surrounds this local method')
    return roi[:]


def context(project,roi):
    x0,y0,x1,y1=rectangle(project,roi);c=project['canvas']
    return [max(0,x0-16),max(0,y0-16),min(c['width'],x1+16),min(c['height'],y1+16)]


def patch(plane,roi,raw):
    x0,y0,x1,y1=roi;w,h=plane.width,plane.height
    if not 0<=x0<x1<=w or not 0<=y0<y1<=h or len(raw)!=(x1-x0)*(y1-y0)*4:raise ValueError('ROI patch bounds mismatch')
    local=np.frombuffer(raw,np.uint8).reshape(y1-y0,x1-x0,4);store=OverlayTiles(plane._store);keys=list(plane.keys);cols=(w+TILE-1)//TILE
    for ty in range(y0//TILE,(y1-1)//TILE+1):
        for tx in range(x0//TILE,(x1-1)//TILE+1):
            left,top=max(x0,tx*TILE),max(y0,ty*TILE);right,bottom=min(x1,(tx+1)*TILE),min(y1,(ty+1)*TILE)
            i=ty*cols+tx;data=bytearray(plane._store.get(keys[i]));a=np.frombuffer(data,np.uint8).reshape(TILE,TILE,4)
            a[top-ty*TILE:bottom-ty*TILE,left-tx*TILE:right-tx*TILE]=local[top-y0:bottom-y0,left-x0:right-x0]
            keys[i]=store.put(bytes(data))
    return PixelPlane(w,h,keys,store)


def world(index,crop,width):
    cw=crop[2]-crop[0];y,x=divmod(index,cw);return (y+crop[1])*width+x+crop[0]


def local_indices(values,crop,width):
    x0,y0,x1,y1=crop;cw=x1-x0
    return [(i//width-y0)*cw+i%width-x0 for i in values if x0<=i%width<x1 and y0<=i//width<y1]


def mask_from_local(project,values,crop,selection):
    w,h=project['canvas']['width'],project['canvas']['height'];x0,y0,x1,y1=selection
    chosen=[world(i,crop,w) for i in values];chosen=[i for i in chosen if x0<=i%w<x1 and y0<=i//w<y1]
    return uniform(w,h).with_edits({i:[1,0,0,0] for i in chosen})


def mask_indices(mask,roi):
    if max(roi[2]-roi[0],roi[3]-roi[1])>512:raise ValueError('Managed motion geometry query exceeds512square')
    drawing=dict(pixels=mask,protected_mask=mask,protection_encoding=ENCODING);values=[]
    for y in range(roi[1],roi[3],128):
        for x in range(roi[0],roi[2],128):values += indices(drawing,[x,y,min(x+128,roi[2]),min(y+128,roi[3])])
    return sorted(values)


def crop_pixels(project,drawing,roi,paper):
    crop=context(project,roi);cw,ch=crop[2]-crop[0],crop[3]-crop[1]
    raw=drawing['pixels'].region_bytes(crop);pixels=np.frombuffer(raw,np.uint8).reshape(-1,4).tolist();w=project['canvas']['width']
    # Already separated neighboring context can be recomposed for white-paper
    # analysis; the output selection itself must still be genuinely opaque.
    if paper=='white':
        for i,p in enumerate(pixels):
            wi=world(i,crop,w);inside=roi[0]<=wi%w<roi[2] and roi[1]<=wi//w<roi[3]
            if inside and p[3]!=255:raise ValueError('White-paper selection must be opaque; choose transparent ink for separated areas')
            if not inside and p[3]!=255:pixels[i]=source_over([[255,255,255,255]],[p])[0]
    return crop,cw,ch,pixels


def cleanup_roi(project,layer,slot,settings,checkpoint=None):
    scope,e=cleanup_subject(project,layer,slot,settings);roi=rectangle(project,settings['roi']);drawing=project['drawings'][e['drawing_id']]
    crop,cw,ch,pixels=crop_pixels(project,drawing,roi,settings['paper']);w=project['canvas']['width']
    local=deepcopy(settings);local['roi']=[roi[0]-crop[0],roi[1]-crop[1],roi[2]-crop[0],roi[3]-crop[1]];local['keep_pixels']=local_indices(settings['keep_pixels'],crop,w)
    protected=indices(drawing,crop,local=True)
    result=cleanup(pixels,cw,ch,local,protected,checkpoint)
    local_array=np.asarray(result['pixels'],dtype=np.uint8).reshape(ch,cw,4);lx,ly=roi[0]-crop[0],roi[1]-crop[1]
    output=patch(drawing['pixels'],roi,local_array[ly:ly+roi[3]-roi[1],lx:lx+roi[2]-roi[0]].tobytes())
    mask=merge(drawing_mask(drawing),uniform(output.width,output.height).with_edits({i:[1,0,0,0] for i in settings['keep_pixels']}))
    records=deepcopy(result['components'])
    for record in records:
        for path in record.get('paths',[]):
            for key in ['source_points','curve','anchors']:
                for point in path[key]:point[0]+=crop[0];point[1]+=crop[1]
    changed=[world(i,crop,w) for i in result['changed_indices']]
    warnings=result['warnings']+['Processing is limited to the selected rectangle with16pixel sampled context. Crop edges do not establish anatomical boundaries; centerlines are local inferred analysis.']
    return dict(adapter=ADAPTER,pixels=output,protected_mask=mask,protection_encoding=ENCODING,protected_pixels=[world(i,crop,w) for i in result['protected_pixels']],settings=deepcopy(settings),roi=roi,sampled_context=crop,components=records,changed_indices=changed,warnings=warnings,metrics=dict(result['metrics'],protected_global_count=count(dict(pixels=output,protected_mask=mask,protection_encoding=ENCODING))),method='selected-context-'+result['method'],version='0.1.0',source_ids=result['source_ids']+SOURCES,score_kind='uncalibrated_local_geometry')


def accept_cleanup_roi(project,result,layer,slot,identifier):
    _,e=cleanup_subject(project,layer,slot,result['settings']);source=project['drawings'][e['drawing_id']]
    if identifier in project['drawings'] or not result['changed_indices']:raise ValueError('Cleanup needs a new identity and actual pixel changes')
    updated=deepcopy(project);updated['drawings'][identifier]=dict(pixels=result['pixels'],origin='reviewed_roi_cleanup',approved=True,locked=bool(count(dict(pixels=result['pixels'],protected_mask=result['protected_mask'],protection_encoding=ENCODING))),protected_mask=result['protected_mask'],protection_encoding=ENCODING,parent_drawing=e['drawing_id'])
    next(x for x in updated['exposures'] if x==e)['drawing_id']=identifier
    saved={k:deepcopy(result[k]) for k in ['adapter','settings','roi','sampled_context','components','changed_indices','warnings','metrics','method','version','source_ids','score_kind']}
    saved.update(input_drawing=e['drawing_id'],input_sha256=fingerprint(source),drawing_id=identifier,layer_id=layer,start=e['start'],length=e['length'])
    updated.setdefault('cleanup_operations',[]).append(saved)
    changed=set(result['changed_indices'])
    for identity,r in updated.get('fill_regions',{}).items():
        if r['ink_layer']==layer and max(r['start'],e['start'])<min(r['start']+r['length'],e['start']+e['length']):
            from engine.regions import managed_pixels
            covered,_=managed_pixels(project,identity)
            if changed&set(covered):r['geometry_status']='source_changed_cleanup_review'
    updated['revision']+=1;updated['history'].append(dict(action='accept-reviewed-roi-cleanup',drawing_id=identifier));validate(updated);validate_layers(updated);return updated


def fill_scope(project,layer,slot,settings,roi,region_id=None):
    settings_checked(settings,project['canvas']['width'],project['canvas']['height']);rectangle(project,roi);validate_regions(project)
    request=cleanup_defaults(project['canvas']['width'],project['canvas']['height']);request['roi']=roi
    base,e=cleanup_subject(project,layer,slot,request);extra={}
    for i,r in project.get('fill_regions',{}).items():
        if r['ink_layer']==layer and max(r['start'],e['start'])<min(r['start']+r['length'],e['start']+e['length']):extra[i]=r
    if region_id:
        r=project['fill_regions'][region_id]
        fe=next(x for x in project['exposures'] if x['layer_id']==r['fill_layer'] and x['start']==r['start'] and x['length']==r['length'])
        parent=r['fill_layer'];nodes={}
        while parent is not None:
            n=project['layers'][parent]
            if n.get('locked') or not n.get('visible',True):raise ValueError('Fill target and ancestors must be visible/unlocked')
            nodes[parent]=n;parent=n.get('parent_id')
        extra['target']=dict(region=r,exposure=fe,drawing=project['drawings'][fe['drawing_id']],nodes=nodes,epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in ['layer:'+i for i in nodes]})
    epoch_keys=['region:'+i for i in project.get('fill_regions',{}) if i in extra]+['palette:'+settings['palette_id']]
    epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in epoch_keys}
    return fingerprint(dict(base=base,settings=settings,roi=roi,peers=extra,target_palette=project.get('palettes',{}).get(settings['palette_id']),epochs=epochs)),e


def _peer_guard(project,result,layer,e,exclude=None):
    roi=result['roi'];candidate=result['region_mask']
    for i,r in project.get('fill_regions',{}).items():
        if i==exclude or r['ink_layer']!=layer or max(r['start'],e['start'])>=min(r['start']+r['length'],e['start']+e['length']):continue
        if r.get('region_format')!='packed_roi_v1':raise ValueError('Cannot silently mix legacy and packed region masks')
        rr=r['roi'];common=[max(roi[0],rr[0]),max(roi[1],rr[1]),min(roi[2],rr[2]),min(roi[3],rr[3])]
        if common[0]<common[2] and common[1]<common[3]:
            a=np.frombuffer(candidate.region_bytes(common),np.uint8).reshape(-1,4)[:,0];b=np.frombuffer(r['region_mask'].region_bytes(common),np.uint8).reshape(-1,4)[:,0]
            if np.any(a&b):raise ValueError('Selection overlaps an accepted region interior; revise that region instead of merging')


def fill_roi(project,layer,slot,settings,roi,region_id=None,checkpoint=None):
    scope,e=fill_scope(project,layer,slot,settings,roi,region_id);drawing=project['drawings'][e['drawing_id']]
    crop,cw,ch,pixels=crop_pixels(project,drawing,roi,settings['paper']);w=project['canvas']['width'];local=deepcopy(settings)
    if not roi[0]<=settings['seed'][0]<roi[2] or not roi[1]<=settings['seed'][1]<roi[3]:raise ValueError('Choose the fill seed inside the selection')
    local['seed']=[settings['seed'][0]-crop[0],settings['seed'][1]-crop[1]]
    for key in ['add_barriers','keep_open']:local[key]=local_indices(settings[key],crop,w)
    from engine.region_domains import fill_arguments,inherit_domain
    if region_id:domain_record=project['fill_regions'][region_id]
    else:
        anchors=[r for r in project.get('fill_regions',{}).values() if r['ink_layer']==layer and max(r['start'],e['start'])<min(r['start']+r['length'],e['start']+e['length'])]
        domains=[inherit_domain(r) for r in anchors]
        if domains and any(d!=domains[0] for d in domains):raise ValueError('Shared ink has inconsistent ownership domains; explicitly repair region assignments')
        domain_record=domains[0] if domains else {}
    result=fill(pixels,cw,ch,local,checkpoint,**fill_arguments(domain_record,w,project['canvas']['height'],crop));lx,ly=roi[0]-crop[0],roi[1]-crop[1];rw,rh=roi[2]-roi[0],roi[3]-roi[1]
    ink=np.asarray(result['ink'],np.uint8).reshape(ch,cw,4)[ly:ly+rh,lx:lx+rw].copy();flat=np.asarray(result['fill'],np.uint8).reshape(ch,cw,4)[ly:ly+rh,lx:lx+rw].copy()
    protected=indices(drawing,roi,local=True)
    if not region_id:
        original=np.frombuffer(drawing['pixels'].region_bytes(roi),np.uint8).reshape(rh,rw,4)
        ink.reshape(-1,4)[protected]=original.reshape(-1,4)[protected];flat.reshape(-1,4)[protected]=[0,0,0,0]
    ink_plane=patch(drawing['pixels'],roi,ink.tobytes());base=uniform(w,project['canvas']['height'])
    fill_plane=patch(base,roi,flat.tobytes());target_mask=drawing_mask(drawing)
    if region_id:
        region=project['fill_regions'][region_id]
        if settings['paper']!='transparent':raise ValueError('Accepted separated ink revisions use transparent paper mode')
        old_id=next(x['drawing_id'] for x in project['exposures'] if x['layer_id']==region['fill_layer'] and x['start']==region['start'] and x['length']==region['length'])
        target=project['drawings'][old_id];target_mask=drawing_mask(target,legacy_locked=True)
        current=np.frombuffer(target['pixels'].region_bytes(roi),np.uint8).reshape(rh,rw,4);pindices=indices(target,roi,local=True,legacy_locked=True)
        flat.reshape(-1,4)[pindices]=current.reshape(-1,4)[pindices];fill_plane=patch(target['pixels'],roi,flat.tobytes())
    composite=source_over(flat.reshape(-1,4).tolist(),ink.reshape(-1,4).tolist());preview=patch(drawing['pixels'],roi,bytes(c for p in composite for c in p))
    masks={key+'_mask':mask_from_local(project,result[key],crop,roi) for key in ['region','covered','boundary','added_barriers']}
    warnings=result['warnings']+['Output is clipped to the selection; sampled context/selection edges do not prove an ink or anatomical boundary.']
    if result['metrics']['touches_edge']:warnings.append('Fill reaches the sampled context edge: possible leak. Expand context/selection or add an explicit barrier before accepting.')
    if protected and not region_id:warnings.append('Artist-protected source samples retain exact projected RGBA; fill is omitted beneath them, including transparent erase intent.')
    output=dict(adapter=ADAPTER,pixels=preview,ink=ink_plane,fill=fill_plane,protected_mask=target_mask,ink_protected_mask=drawing_mask(drawing),protection_encoding=ENCODING,protected_pixels=[world(i,crop,w) for i in indices(drawing,crop,local=True)],settings=deepcopy(settings),roi=roi[:],sampled_context=crop,region_id=region_id,dependency_sha256=scope,warnings=warnings,metrics=dict(result['metrics'],protected_pixels=len(protected),selected_region_area=len(mask_indices(masks['region_mask'],roi))),method='selected-context-'+result['method'],version='0.1.0',source_ids=result['source_ids']+SOURCES,**masks)
    output.update(inherit_domain(domain_record))
    if 'component_seeds' in result:output['component_seeds']=[[x+crop[0],y+crop[1]] for x,y in result['component_seeds']]
    _peer_guard(project,output,layer,e,region_id);return output


def validate_regions(project):
    from engine.spatial_constraints import validate_mask
    w,h=project['canvas']['width'],project['canvas']['height']
    from engine.region_domains import validate_metadata
    for r in project.get('fill_regions',{}).values():
        validate_metadata(r,w,h)
        if r.get('region_format') not in {'packed_roi_v1','motion_region_v1'}:continue
        if r['region_format']=='packed_roi_v1':roi=rectangle(project,r['roi'])
        else:
            roi=r['roi'];w,h=project['canvas']['width'],project['canvas']['height']
            if len(roi)!=4 or any(type(i) is not int for i in roi) or not 0<=roi[0]<roi[2]<=w or not 0<=roi[1]<roi[3]<=h or max(roi[2]-roi[0],roi[3]-roi[1])>512:raise ValueError('Invalid transported region bounds')
        for key in ['region_mask','covered_mask','boundary_mask','added_barriers_mask']:
            mask=validate_mask(r[key],w,h)
            if count(dict(pixels=mask,protected_mask=mask,protection_encoding=ENCODING))!=len(mask_indices(mask,roi)):raise ValueError('Region mask contains flags outside its selection')
    return project


def accept_fill_roi(project,result,layer,slot,identity,region_id=None):
    scope,e=fill_scope(project,layer,slot,result['settings'],result['roi'],region_id)
    if scope!=result['dependency_sha256']:raise ValueError('Fill ROI inputs changed')
    _peer_guard(project,result,layer,e,region_id);updated=deepcopy(project);source=project['drawings'][e['drawing_id']]
    def drawing(pixels,mask,origin,parent=None):return dict(pixels=pixels,protected_mask=mask,protection_encoding=ENCODING,approved=True,locked=bool(count(dict(pixels=pixels,protected_mask=mask,protection_encoding=ENCODING))),origin=origin,parent_drawing=parent)
    palette=result['settings']['palette_id']
    if palette in updated.get('palettes',{}) and updated['palettes'][palette]['rgba']!=result['settings']['color']:raise ValueError('Palette identity has another value; explicitly recolor or use another identity')
    generated=[identity+'-fill-drawing'] if region_id else [identity+'-ink-drawing',identity+'-fill-drawing',identity+'-blank']
    if any(i in updated['drawings'] for i in generated) or any(i in updated['layers'] for i in [identity,identity+'-ink',identity+'-fill']):raise ValueError('Fill acceptance identities must be new')
    if region_id:
        region=updated['fill_regions'][region_id];fill_layer=region['fill_layer'];draw_id=identity+'-fill-drawing'
        if draw_id in updated['drawings']:raise ValueError('Fill revision identity reused')
        fe=next(x for x in updated['exposures'] if x['layer_id']==fill_layer and x['start']==region['start'] and x['length']==region['length'])
        updated['drawings'][draw_id]=drawing(result['fill'],result['protected_mask'],'reviewed_roi_fill_revision',fe['drawing_id']);fe['drawing_id']=draw_id
        region['fill_drawing']=draw_id;region.pop('geometry_status',None)
    else:
        if identity in updated['layers'] or identity in updated.get('fill_regions',{}):raise ValueError('Fill ROI identity reused')
        anchors=[r for r in project.get('fill_regions',{}).values() if r['ink_layer']==layer and max(r['start'],e['start'])<min(r['start']+r['length'],e['start']+e['length'])]
        if anchors:
            ink_layer=layer;group=project['layers'][layer]['parent_id']
            ink_id=e['drawing_id']
            if result['ink']!=source['pixels']:
                # A white-paper area may be separated locally, but never rewrite
                # ink underneath another accepted region's managed coverage.
                for r in anchors:
                    rr=r['roi'];roi=result['roi'];common=[max(rr[0],roi[0]),max(rr[1],roi[1]),min(rr[2],roi[2]),min(rr[3],roi[3])]
                    if common[0]<common[2] and common[1]<common[3]:
                        old=np.frombuffer(source['pixels'].region_bytes(common),np.uint8).reshape(-1,4)
                        new=np.frombuffer(result['ink'].region_bytes(common),np.uint8).reshape(-1,4)
                        covered=np.frombuffer(r['covered_mask'].region_bytes(common),np.uint8).reshape(-1,4)[:,0].astype(bool)
                        if np.any(old[covered]!=new[covered]):raise ValueError('Shared-ink separation would alter accepted region coverage; revise boundaries first')
                ink_id=identity+'-ink-drawing'
                updated['drawings'][ink_id]=drawing(result['ink'],result['ink_protected_mask'],'reviewed_local_shared_ink_separation',e['drawing_id'])
                next(x for x in updated['exposures'] if x==e)['drawing_id']=ink_id
        else:
            node=project['layers'][layer];group=identity;ink_layer=identity+'-ink';ink_id=identity+'-ink-drawing'
            layers={}
            for key,value in updated['layers'].items():
                if key==layer:layers[group]=dict(name='Reviewed ROI fills',nodetype='grouplayer',parent_id=node.get('parent_id'),order=node.get('order',0),opacity=node.get('opacity',255),visible=True,locked=False,isolation='isolate')
                layers[key]=value
            updated['layers']=layers;updated['layers'][layer]['visible']=False;updated['layers'][ink_layer]=dict(name='Preserved / proposed ink',parent_id=group,order=0,visible=True,locked=False)
            updated['drawings'][ink_id]=drawing(result['ink'],result['ink_protected_mask'],'preserved_roi_ink',e['drawing_id'])
            for old in project['exposures']:
                if old['layer_id']==layer:updated['exposures'].append(dict(old,layer_id=ink_layer,drawing_id=ink_id if old==e else old['drawing_id']))
        fill_layer=identity+'-fill';draw_id=identity+'-fill-drawing';blank_id=identity+'-blank'
        updated['layers'][fill_layer]=dict(name='Flat: '+palette,parent_id=group,order=1+len(anchors),visible=True,locked=False)
        updated['drawings'][draw_id]=drawing(result['fill'],result['protected_mask'],'reviewed_roi_flat',e['drawing_id'])
        updated['drawings'][blank_id]=dict(pixels=uniform(source['pixels'].width,source['pixels'].height),origin='transparent_fill_hold',approved=True,locked=False)
        for old in project['exposures']:
            if old['layer_id']==layer:updated['exposures'].append(dict(old,layer_id=fill_layer,drawing_id=draw_id if old==e else blank_id))
        region=dict(region_format='packed_roi_v1',source_layer=layer,source_drawing=e['drawing_id'],source_sha256=fingerprint(source),start=e['start'],length=e['length'],ink_layer=ink_layer,fill_layer=fill_layer,ink_drawing=ink_id,fill_drawing=draw_id,version=-1)
        updated.setdefault('fill_regions',{})[identity]=region
    region.update(palette_id=palette,roi=result['roi'][:],sampled_context=result['sampled_context'][:],settings=deepcopy(result['settings']),warnings=result['warnings'][:],metrics=deepcopy(result['metrics']),source_ids=result['source_ids'][:],method=result['method'],method_version=result['version'],status='artist_reviewed',confidence='uncalibrated_local_geometry',version=region.get('version',0)+1,**{k:result[k] for k in ['region_mask','covered_mask','boundary_mask','added_barriers_mask']})
    from engine.region_domains import inherit_domain
    region.update(inherit_domain(result))
    if 'component_seeds' in result:region['component_seeds']=deepcopy(result['component_seeds'])
    updated.setdefault('palettes',{})[palette]=dict(rgba=result['settings']['color'][:],color_profile='sRGB',origin='artist_assignment')
    updated['revision']+=1;updated['history'].append(dict(action='accept-reviewed-roi-fill',region_id=region_id or identity));validate(updated);validate_layers(updated);return updated,fill_layer
