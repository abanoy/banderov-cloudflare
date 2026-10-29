"""Accepted geometry partition and lineage over explicit artist-owned pixels.

Independent implementation. Mask/selection/connected-component precedents are
credited in region_domains; no semantic topology or new surface is inferred.
"""
from copy import deepcopy
import hashlib
from engine.project import fingerprint
from engine.io.project_archive import PixelPlane
from engine.spatial_constraints import uniform,ENCODING
from engine.region_domains import component_seeds,retained_component_seeds,validate_metadata,SOURCES


def related(project,settings,entries,previous):
    """Require paired ink/fill and exact holds; include bindings in the scope."""
    from engine.motion import _exposure
    from engine.roi_assistance import validate_regions
    layers=set(entries);start,end=settings['target_start'],settings['target_end']
    part_layers=set(previous['part_layers'].values()) if previous else set()
    relevant={};sources={};donors={};targets={}
    for identity,r in project.get('fill_regions',{}).items():
        pair={r['ink_layer'],r['fill_layer']}
        touches=bool(pair&(layers|part_layers))
        source=r['start']<=settings['source_slot']<r['start']+r['length']
        donor=r['start']<=settings['content_slot']<r['start']+r['length']
        target=max(start,r['start'])<min(end,r['start']+r['length'])
        if not touches or not (source or donor or target):continue
        required={'settings','palette_id','ink_drawing','fill_drawing','source_layer','source_drawing','source_sha256'}
        if not required<=set(r) or not ('region' in r or 'region_mask' in r):
            raise ValueError('Accepted fill-region metadata needs explicit repair; no geometry is discarded')
        if not (pair<=layers or previous and pair<=part_layers):
            if previous:raise ValueError('Region set changed; explicitly rebind ownership to include the reviewed fill')
            raise ValueError('Select the common actor group: ink and every accepted fill must be partitioned together')
        if r['palette_id'] not in project.get('palettes',{}):raise ValueError('Accepted region lost its palette; explicitly repair it')
        relevant[identity]=r
        for slot,role in [(settings['source_slot'],'source'),(settings['content_slot'],'content')]:
            if not pair<=layers or not r['start']<=slot<r['start']+r['length']:continue
            for layer in pair:
                e=entries[layer][role+'_exposure']
                if (r['start'],r['length'])!=(e['start'],e['length']):raise ValueError('Region timing no longer matches its source/content hold; explicitly rebind')
            (sources if role=='source' else donors)[identity]=r
        if target:
            if previous:
                if r['start']!=start or r['length']!=end-start or identity not in previous.get('region_parents',{}):raise ValueError('Region set or target timing changed; explicitly rebind ownership before revising')
                for layer in pair:
                    e=_exposure(project,layer,start)
                    if e is None or e['start']!=start or e['length']!=end-start:raise ValueError('Region target exposure changed; explicitly rebind')
                targets[identity]=r
            elif identity not in sources:raise ValueError('Region overlaps a different target key; existing geometry is not replaced')
    if relevant:validate_regions(project)
    if previous and set(targets)!=set(previous.get('region_parents',{})):
        raise ValueError('Region set changed; explicitly rebind ownership before revising')
    return dict(regions=relevant,sources=sources,donors=donors,targets=targets,
        bindings={i:project.get('part_bindings',{}).get(i) for i in relevant},
        palettes={r['palette_id']:project['palettes'][r['palette_id']] for r in relevant.values()})


def _domain(region,w,h):
    value=region.get('ownership_domain')
    return value if isinstance(value,PixelPlane) else uniform(w,h).with_edits({i:[1,0,0,0] for i in value}) if value is not None else uniform(w,h,True)


def _roi(region,w,h):
    return region.get('roi',[0,0,w,h])[:]


def _geometry(project,r,w,h,roi):
    from engine.motion import _region_masks,_flags
    return {k:set(_flags(mask,roi)) for k,mask in _region_masks(project,r,w,h).items()}


def plans(project,settings,entries,previous,effective_source,effective_content,outputs,checkpoint=None):
    """Known accepted masks are split, with target reviews kept on retained areas."""
    from engine.motion import _flags,_plane,_mask
    info=related(project,settings,entries,previous);w,h=project['canvas']['width'],project['canvas']['height'];packed=project['schema_version']=='0.2';result=[]
    for role,parents,owned in [('base',info['sources'],effective_source),('part',info['donors'],effective_content)]:
        for parent,source in parents.items():
            if checkpoint:checkpoint()
            current_id=next((i for i,p in (previous or {}).get('region_parents',{}).items() if p==dict(parent=parent,role=role)),None)
            if previous and current_id is None:raise ValueError('Region source/content set changed; explicitly rebind ownership')
            current=project['fill_regions'][current_id] if current_id else None
            roi=_roi(source,w,h);domain=_domain(source,w,h)
            if role=='base':domain=domain.with_edits({i:[0,0,0,0] for i in owned})
            else:domain=uniform(w,h).with_edits({i:[1,0,0,0] for i in owned if domain[i][0]})
            allowed=set(_flags(domain,roi));geometry=_geometry(project,source,w,h,roi)
            if current:
                if _roi(current,w,h)!=roi:raise ValueError('Reviewed region rectangle changed; explicitly rebind ownership')
                old_allowed=set(_flags(_domain(current,w,h),roi));retained=old_allowed&allowed
                current_geometry=_geometry(project,current,w,h,roi)
                geometry={k:(values&(allowed-old_allowed))|(current_geometry[k]&retained) for k,values in geometry.items()}
            else:geometry={k:values&allowed for k,values in geometry.items()}
            # Invisible ownership seam just outside an interior. Visible ink is
            # unchanged. A global complement is never expanded into an overlay.
            seam=set()
            for i in geometry['region']:
                x,y=i%w,i//w
                for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    j=ny*w+nx
                    if roi[0]<=nx<roi[2] and roi[1]<=ny<roi[3] and j not in allowed:seam.add(j)
            geometry['boundary']|=seam;geometry['added_barriers']|=seam
            prior_geometry=current_geometry if current else _geometry(project,source,w,h,roi)
            previous_components=len(component_seeds(sorted(prior_geometry['region']),w,h,checkpoint=checkpoint))
            template=deepcopy(current or source);settings_out=deepcopy(template['settings'])
            seeds,displaced,after_components=retained_component_seeds(sorted(geometry['region']),w,h,[settings_out['seed']]+template.get('component_seeds',[]),checkpoint,allowed)
            template['ownership_seed_review']=dict(displaced=deepcopy(displaced),active_seeds=deepcopy(seeds),from_current_review=bool(current))
            if seeds:settings_out['seed']=seeds[0][:]
            settings_out['paper']='transparent';palette=template['palette_id'];settings_out.update(palette_id=palette,color=project['palettes'][palette]['rgba'][:])
            template.update(settings=settings_out,palette_id=palette,ownership_domain=domain if packed else _flags(domain,[0,0,w,h]),ownership_encoding=ENCODING,component_seeds=seeds[1:],geometry_status='reviewed_ownership_partition' if seeds else 'empty_owned_region_requires_seed_or_mask_repair',roi=roi)
            template['warnings']=template.get('warnings',[])+['Known region geometry partitioned by explicit binary ownership; disconnected components retain seeds. This is not semantic split/merge inference.']
            template['source_ids']=sorted(set(template.get('source_ids',[])+SOURCES));template['method']='accepted-region-owned-partition';template['method_version']='0.1.0'
            if packed:
                template.update(region_format='packed_roi_v1' if max(roi[2]-roi[0],roi[3]-roi[1])<=224 else 'motion_region_v1',**{k+'_mask':uniform(w,h).with_edits({i:[1,0,0,0] for i in sorted(v)}) for k,v in geometry.items()})
                for k in ['region','covered','boundary','added_barriers','protected_pixels']:template.pop(k,None)
            else:template.update(**{k:sorted(v) for k,v in geometry.items()})
            validate_metadata(template,w,h)
            if current:
                # Preserve reviewed boundary/color output on shared ownership;
                # new ownership samples follow the current target palette. Paint
                # constraints always win, including transparent/exterior erases.
                fill_layer=source['fill_layer'];output=outputs[fill_layer];pixels=output[role+'_pixels']
                plane=pixels if packed else PixelPlane.from_pixels(w,h,pixels)
                protected=_mask(project['drawings'][next(e['drawing_id'] for e in project['exposures'] if e['layer_id']==current['fill_layer'] and e['start']==current['start'] and e['length']==current['length'])],w,h)
                current_drawing=project['drawings'][next(e['drawing_id'] for e in project['exposures'] if e['layer_id']==current['fill_layer'] and e['start']==current['start'] and e['length']==current['length'])]
                old_pixels=_plane(current_drawing,w,h)
                edits={i:settings_out['color'][:] for i in geometry['covered'] if i not in retained and not protected[i][0]}
                edits.update({i:old_pixels[i] for i in retained if not protected[i][0]})
                plane=plane.with_edits(edits);output[role+'_pixels']=plane if packed else plane.materialize()
            kind='region_emptied' if previous_components and not after_components else 'region_reappeared_from_approved_geometry' if not previous_components and after_components else 'known_interior_split' if after_components>previous_components else 'known_interior_merge' if after_components<previous_components else 'ownership_partition_same_component_count'
            event=dict(kind=kind,parent_region=parent,role=role,before_components=previous_components,after_components=after_components,evidence='explicit_ownership_over_accepted_geometry_not_semantic_inference')
            template['ownership_topology']=deepcopy(event)
            result.append(dict(parent=parent,role=role,current_id=current_id,region=template,topology_event=event))
    # Without accepted donor metadata, nontransparent part fill samples cannot
    # acquire a guessed region/palette. Blank approved donor holds are allowed.
    for parent,source in info['sources'].items():
        if any(r['fill_layer']==source['fill_layer'] for r in info['donors'].values()):continue
        pixels=outputs[source['fill_layer']]['part_pixels']
        if any(pixels[i][3] for i in effective_content):raise ValueError('Approved donor fill has no accepted region metadata; explicitly segment or rebind it')
    return result,info


def apply(project,updated,record,region_plans,info,previous):
    """Install paired interval metadata atomically with accepted part rasters."""
    logical=record['operation_id'];start,end=record['settings']['target_start'],record['settings']['target_end'];parents={};tails=[]
    if not previous:
        for parent,original in info['sources'].items():
            old_end=original['start']+original['length'];updated['fill_regions'][parent]['length']=start-original['start']
            if old_end>end:
                tail=logical+'-tail-'+hashlib.sha256(parent.encode()).hexdigest()[:12]
                if tail in updated['fill_regions']:raise ValueError('Part tail region identity reused')
                updated['fill_regions'][tail]=dict(deepcopy(original),start=end,length=old_end-end);tails.append(tail)
                if parent in project.get('part_bindings',{}):updated.setdefault('part_bindings',{})[tail]=deepcopy(project['part_bindings'][parent])
    else:tails=previous.get('tail_region_ids',[])[:]
    for plan in region_plans:
        parent,role=plan['parent'],plan['role'];identity=plan['current_id'] or logical+'-region-'+role+'-'+hashlib.sha256(parent.encode()).hexdigest()[:12]
        if not previous and identity in updated.get('fill_regions',{}):raise ValueError('Part region identity reused')
        original=project['fill_regions'][parent];r=deepcopy(plan['region']);ink=original['ink_layer'];fill=original['fill_layer']
        r.update(start=start,length=end-start,ink_layer=ink if role=='base' else record['part_layers'][ink],fill_layer=fill if role=='base' else record['part_layers'][fill],ink_drawing=record[role+'_drawings'][ink],fill_drawing=record[role+'_drawings'][fill],version=r.get('version',0)+1,part_operation_id=logical,partition_parent_region=parent,raster_owner_id=record['settings']['part_id'] if role=='part' else 'base:'+record['settings']['actor_id'])
        updated.setdefault('fill_regions',{})[identity]=r;parents[identity]=dict(parent=parent,role=role)
        binding=project.get('part_bindings',{}).get(plan['current_id'] or parent)
        if binding:updated.setdefault('part_bindings',{})[identity]=dict(deepcopy(binding),partition_parent_region=parent,raster_owner_id=r['raster_owner_id'])
    record.update(region_parents=parents,tail_region_ids=tails,region_topology_events=[deepcopy(p['topology_event']) for p in region_plans],region_input_snapshots=deepcopy(info['regions']),region_binding_snapshots=deepcopy(info['bindings']))
    from engine.regions import refresh_relations
    from engine.roi_assistance import validate_regions
    refresh_relations(updated);validate_regions(updated)
    return updated
