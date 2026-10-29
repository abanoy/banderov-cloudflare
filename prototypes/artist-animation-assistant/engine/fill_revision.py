"""Project-designed local accepted-fill revision and artist pixel constraints.

REF-COLORIZE-MASK is an interaction precedent; no Krita algorithm copied.
The underlying seed/mask baseline is attributed in engine.fill.
"""
from copy import deepcopy

from engine.fill import propose, settings_checked
from engine.layers import validate_layers
from engine.project import validate, fingerprint



def advance_epochs(before,after):
    """Monotonic subject clocks, including undo/redo; unrelated edits stay local."""
    def subjects(project):
        if not project:
            return {}
        result={}
        for identity,layer in project['layers'].items():
            exposures=[e for e in project['exposures'] if e['layer_id']==identity]
            result['layer:'+identity]=fingerprint(dict(layer=layer,exposures=exposures,drawings={e['drawing_id']:project['drawings'][e['drawing_id']] for e in exposures}))
        for field,prefix in [('fill_regions','region:'),('palettes','palette:'),('references','reference:'),('part_bindings','part:'),('motion_guides','guide:'),('correspondence_reviews','match_review:'),('raster_parts','raster_part:'),('schedule_constraints','schedule_constraint:'),('schedule_reviews','schedule_review:'),('candidate_corrections','candidate_correction:')]:
            result.update({prefix+i:fingerprint(value) for i,value in project.get(field,{}).items()})
        return result
    old,new=subjects(before),subjects(after)
    clocks=dict((before or {}).get('dependency_epochs',{}))
    for key,value in after.get('dependency_epochs',{}).items():
        clocks[key]=max(clocks.get(key,0),value)
    for key in set(old)|set(new):
        if old.get(key)!=new.get(key):
            clocks[key]=clocks.get(key,0)+1
    after['dependency_epochs']=clocks
    return after


def protected_pixels(drawing):
    if 'protected_mask' in drawing:
        from engine.spatial_constraints import indices
        return indices(drawing,legacy_locked=True)
    count=len(drawing['pixels'])
    if 'protected_pixels' in drawing:
        indices=drawing['protected_pixels']
        if not isinstance(indices,list) or any(type(i) is not int or not 0<=i<count for i in indices) or len(set(indices))!=len(indices):
            raise ValueError('Invalid artist pixel protection mask')
        return sorted(indices)
    # Old locked corrections have no spatial constraint history. Protect the
    # whole raster instead of guessing which pixels may safely be discarded.
    return list(range(count)) if drawing.get('locked',False) else []


def inputs(project,region_id):
    validate(project)
    validate_layers(project)
    if region_id not in project.get('fill_regions',{}):
        raise ValueError('Select an accepted fill region')
    region=project['fill_regions'][region_id]
    start,length=region['start'],region['length']
    exposures={}
    layers={}
    for role in ['ink','fill']:
        identity=region[role+'_layer']
        if identity not in project['layers'] or project['layers'][identity].get('nodetype','paintlayer')!='paintlayer':
            raise ValueError('Accepted region layer structure changed; rebind explicitly')
        matches=[e for e in project['exposures'] if e['layer_id']==identity and e['start']==start and e['length']==length]
        if len(matches)!=1:
            raise ValueError('Accepted region exposure changed; rebind explicitly before regeneration')
        exposures[role]=matches[0]
        parent=identity
        while parent is not None:
            node=project['layers'][parent]
            if node.get('locked',False) or not node.get('visible',True):
                raise ValueError('Region layers and ancestors must be visible and explicitly unlocked')
            layers[parent]=node
            parent=node.get('parent_id')
    if project['layers'][region['ink_layer']].get('parent_id')!=project['layers'][region['fill_layer']].get('parent_id'):
        raise ValueError('Accepted ink/fill no longer share a group; rebind explicitly')
    return region,exposures,layers


def dependency(project,region_id,settings):
    """Only declared inputs; unrelated drawings/layers/history are excluded."""
    region,exposures,layers=inputs(project,region_id)
    settings_checked(settings,project['canvas']['width'],project['canvas']['height'])
    if settings['paper']!='transparent':
        raise ValueError('Accepted-region revision uses its current ink; paper separation belongs to the original import')
    palette_ids={region['palette_id'],settings['palette_id']}
    keys={'layer:'+i for i in layers}|{'region:'+region_id}|{'palette:'+i for i in palette_ids}
    epochs={key:project.get('dependency_epochs',{}).get(key,0) for key in sorted(keys)}
    return fingerprint(dict(epochs=epochs,project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],region_id=region_id,region=region,exposures=exposures,layers=layers,drawings={role:project['drawings'][e['drawing_id']] for role,e in exposures.items()},palettes={i:project.get('palettes',{}).get(i) for i in sorted(palette_ids)}))


def propose_revision(project,region_id,settings,checkpoint=None):
    region,exposures,layers=inputs(project,region_id)
    dependency(project,region_id,settings)
    ink=project['drawings'][exposures['ink']['drawing_id']]
    current=project['drawings'][exposures['fill']['drawing_id']]
    from engine.region_domains import fill_arguments,validate_metadata
    w,h=project['canvas']['width'],project['canvas']['height']
    validate_metadata(region,w,h)
    result=propose(ink['pixels'],w,h,settings,checkpoint,**fill_arguments(region,w,h))
    from engine.regions import assert_disjoint
    assert_disjoint(project,region['ink_layer'],region['start'],region['length'],result['region'],exclude=region_id)
    protected=protected_pixels(current)
    result['unconstrained_fill_sha256']=fingerprint(result['fill'])
    for index in protected:
        result['fill'][index]=current['pixels'][index][:]
    result['protected_pixels']=protected
    result['metrics']['protected_pixels']=len(protected)
    if protected:
        result['warnings'].append(f'{len(protected)} artist-protected pixels preserved, including transparent erasures; region geometry may differ from final painted output.')
    result['method']='dependency-scoped-fill-revision-with-artist-pixel-constraints'
    result['source_ids'].append('REF-PYTHON-COPY')
    return result


def accept_revision(project,result,region_id,drawing_id):
    """Replace one dependent exposure reference with a NEW retained version."""
    region,exposures,layers=inputs(project,region_id)
    if drawing_id in project['drawings']:
        raise ValueError('Revision drawing identity must be new')
    old_id=exposures['fill']['drawing_id']
    ink_id=exposures['ink']['drawing_id']
    if result['ink']!=project['drawings'][ink_id]['pixels']:
        raise ValueError('A fill-only revision cannot rewrite its ink')
    palette=result['settings']['palette_id']
    entry=project.get('palettes',{}).get(palette)
    if entry and entry['rgba']!=result['settings']['color']:
        raise ValueError('Palette identity has another color; choose a new identity or explicitly recolor it')
    protected=protected_pixels(project['drawings'][old_id])
    if result.get('protected_pixels')!=protected or any(result['fill'][i]!=project['drawings'][old_id]['pixels'][i] for i in protected):
        raise ValueError('Revision attempted to discard an artist correction')
    updated=deepcopy(project)
    updated['drawings'][drawing_id]=dict(pixels=deepcopy(result['fill']),origin='reviewed_fill_revision',approved=True,locked=bool(protected),protected_pixels=protected,parent_drawing=old_id)
    target=next(e for e in updated['exposures'] if e==exposures['fill'])
    target['drawing_id']=drawing_id
    record=updated['fill_regions'][region_id]
    record.pop('geometry_status',None)
    if 'component_seeds' in result:record['component_seeds']=deepcopy(result['component_seeds'])
    record.setdefault('initial_settings',deepcopy(record['settings']))
    record.update(version=record.get('version',0)+1,settings=deepcopy(result['settings']),boundary=result['boundary'][:],region=result['region'][:],covered=result['covered'][:],warnings=result['warnings'][:],palette_id=palette,protected_pixels=protected,ink_drawing=ink_id,fill_drawing=drawing_id,last_input_sha256=fingerprint(project['drawings'][ink_id]),status='artist_reviewed',source_ids=result['source_ids'][:],method=result['method'],method_version=result['version'])
    updated['palettes'][palette]=dict(rgba=result['settings']['color'][:],color_profile='sRGB',origin='artist_assignment')
    updated['revision']+=1
    updated['history'].append(dict(action='accept-local-fill-revision',region_id=region_id,before=old_id,after=drawing_id,protected_pixels=protected,previous_settings=deepcopy(region['settings']),previous_boundary=region['boundary'][:],previous_region=region['region'][:]))
    from engine.regions import refresh_relations
    refresh_relations(updated)
    validate(updated)
    validate_layers(updated)
    return updated,region['fill_layer']
