"""Original portable job/result contract, master-spec implementation scaffolding.

Translation and reviewable seed/mask fill baselines are implemented. No host/UI
objects, automatic acceptance or artwork uploads. Optional pinned CPU learned
inference is selected explicitly and runs with network disabled. REF-PYTHON.
"""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import tempfile

from engine.io.project_archive import PixelPlane
from engine.packed_model import first_plane,load_packed,PackedCancelled,translate
from engine.project import validate, fingerprint, propose_translation, accept
from engine.cleanup import subject as cleanup_subject, propose as propose_cleanup, accept_cleanup, drawing_constraints, CleanupCancelled, SOURCES as CLEANUP_SOURCES
from engine.fill import propose as propose_fill, settings_checked, SOURCES, FillCancelled, accept_fill
from engine.fill_revision import inputs as region_inputs, dependency as region_dependency, propose_revision, accept_revision
from engine.regions import additional_dependency, propose_additional, accept_additional, palette_dependency, propose_palette, accept_palette, PALETTE_SOURCES


def read(path):
    with Path(path).open('rb') as stream:signature=stream.read(4)
    if signature.startswith(b'PK'):
        envelope=load_packed(path)
        if envelope.get('wire_format')!='packed-job-envelope-1':raise ValueError('Unexpected packed job envelope')
        return envelope['payload']
    return json.loads(Path(path).read_text(encoding='utf-8'))


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    plane=first_plane(data)
    if plane is not None:
        from engine.io.project_archive import save_archive
        save_archive(path,dict(wire_format='packed-job-envelope-1',canvas=dict(width=plane.width,height=plane.height),payload=data))
        return
    # Same-directory replace avoids partial destination JSON if interrupted.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n', dir=path.parent, prefix='.pending-', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(data, stream, indent=2, ensure_ascii=False, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def create_job(project, drawing_id, dx, dy, job_dir):
    """Snapshot a job in a NEW artist-private directory (research uses fixtures)."""
    validate(project)
    if drawing_id not in project['drawings']:
        raise ValueError('Unknown input drawing')
    if type(dx) is not int or type(dy) is not int:
        raise ValueError('Integer translation required')
    job_dir = Path(job_dir)
    job_dir.mkdir(parents=True, exist_ok=False)
    manifest = {'schema_version': '0.1', 'job_id': job_dir.name, 'state': 'created',
                'document_revision': project['revision'], 'input_sha256': fingerprint(project),
                'operation': 'translate_integration_baseline',
                'drawing_id': drawing_id, 'settings': {'dx': dx, 'dy': dy},
                'source_ids': ['REF-PYTHON'], 'component_ids': ['COMP-PYTHON-3-13-1'],
                'execution': {'target': 'local', 'network_allowed': False},
                'applicability': 'requires_review', 'history': ['created']}
    if project['schema_version']=='0.2':
        manifest['source_ids']+=['REF-NUMPY-2-4-1','REF-NUMPY-BUFFER']
        manifest['component_ids']+=['COMP-NUMPY-2-4-1']
    atomic_write(job_dir / 'input.json', deepcopy(project))
    atomic_write(job_dir / 'job.json', manifest)
    return manifest



def _fill_domain_credits(project,layer,slot,manifest):
    relevant=[r for r in project.get('fill_regions',{}).values() if r['ink_layer']==layer and r['start']<=slot<r['start']+r['length']]
    if any('ownership_domain' in r or r.get('component_seeds') for r in relevant):
        from engine.region_domains import SOURCES as DOMAIN_SOURCES
        manifest['source_ids']=sorted(set(manifest['source_ids']+DOMAIN_SOURCES))
    return manifest


def create_roi_fill_job(project,layer_id,slot,settings,roi,job_dir,region_id=None,adding=False):
    from engine.roi_assistance import ADAPTER,SOURCES as ROI_SOURCES,fill_scope
    if project['schema_version']!='0.2':raise ValueError('Packed ROI job requires schema0.2')
    scope,e=fill_scope(project,layer_id,slot,settings,roi,None if adding else region_id)
    if region_id:
        r=project['fill_regions'][region_id]
        if r.get('region_format')!='packed_roi_v1' or r['ink_layer']!=layer_id or not r['start']<=slot<r['start']+r['length']:raise ValueError('Packed region subject changed')
        if not adding and roi!=r['roi']:raise ValueError('Revise the accepted rectangle; create a new region for another selection')
    manifest=create_job(project,e['drawing_id'],0,0,job_dir)
    manifest.update(operation='add_shared_ink_region' if adding else 'revise_accepted_fill' if region_id else 'seed_fill_boundary_baseline',roi_adapter=ADAPTER,roi=roi[:],layer_id=layer_id,slot=slot,settings=deepcopy(settings),dependency_sha256=scope,source_ids=SOURCES+ROI_SOURCES)
    if region_id:manifest['region_id']=region_id
    _fill_domain_credits(project,layer_id,slot,manifest)
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def _roi_fill(project,job,checkpoint=None):
    from engine.roi_assistance import ADAPTER,fill_roi,fill_scope
    if project['schema_version']!='0.2' or job.get('roi_adapter')!=ADAPTER:raise ValueError('Packed fill adapter identity changed')
    if job.get('region_id'):
        r=project['fill_regions'][job['region_id']]
        if r.get('region_format')!='packed_roi_v1' or r['ink_layer']!=job['layer_id'] or not r['start']<=job['slot']<r['start']+r['length']:raise ValueError('Packed region anchor changed')
    revision=job.get('region_id') if job['operation']=='revise_accepted_fill' else None
    scope,e=fill_scope(project,job['layer_id'],job['slot'],job['settings'],job['roi'],revision)
    if scope!=job['dependency_sha256'] or e['drawing_id']!=job['drawing_id']:raise ValueError('Stale packed fill dependency')
    if revision and job['roi']!=project['fill_regions'][revision]['roi']:raise ValueError('Revision rectangle changed')
    return fill_roi(project,job['layer_id'],job['slot'],job['settings'],job['roi'],revision,checkpoint)


def create_fill_job(project, drawing_id, layer_id, slot, settings, job_dir):
    settings_checked(settings,project['canvas']['width'],project['canvas']['height'])
    exposure=next(e for e in project['exposures'] if e['layer_id']==layer_id and e['start']<=slot<e['start']+e['length'])
    if exposure['drawing_id']!=drawing_id:
        raise ValueError('Selected exposure does not match fill input')
    manifest=create_job(project,drawing_id,0,0,job_dir)
    manifest.update(operation='seed_fill_boundary_baseline',settings=settings,source_ids=SOURCES[:],layer_id=layer_id,slot=slot)
    atomic_write(Path(job_dir)/'job.json',manifest)
    return manifest



def create_fill_revision_job(project,region_id,settings,job_dir,slot=None):
    region,exposures,layers=region_inputs(project,region_id)
    scope=region_dependency(project,region_id,settings)
    slot=region['start'] if slot is None else slot
    if type(slot) is not int or not region['start']<=slot<region['start']+region['length']:
        raise ValueError('Playhead must be in the accepted region exposure')
    manifest=create_fill_job(project,exposures['ink']['drawing_id'],region['ink_layer'],slot,settings,job_dir)
    manifest.update(operation='revise_accepted_fill',region_id=region_id,dependency_sha256=scope,source_ids=SOURCES+['REF-PYTHON-COPY'])
    _fill_domain_credits(project,region['ink_layer'],slot,manifest)
    atomic_write(Path(job_dir)/'job.json',manifest)
    return manifest



def create_additional_region_job(project,anchor_id,settings,job_dir,slot=None):
    manifest=create_fill_revision_job(project,anchor_id,settings,job_dir,slot=slot)
    manifest.update(operation='add_shared_ink_region',dependency_sha256=additional_dependency(project,anchor_id,settings),source_ids=SOURCES+['REF-PYTHON-COPY','REF-PALETTE-DOCKER'])
    _fill_domain_credits(project,manifest['layer_id'],manifest['slot'],manifest)
    atomic_write(Path(job_dir)/'job.json',manifest)
    return manifest


def create_part_job(project,settings,job_dir):
    from engine.raster_parts import subject,SOURCES
    scope,entries,_,_,_,_=subject(project,settings)
    manifest=create_job(project,next(iter(entries.values()))['source_exposure']['drawing_id'],0,0,job_dir)
    manifest.update(operation='raster_part_partition',settings=deepcopy(settings),dependency_sha256=scope,source_ids=SOURCES[:])
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_part_result(project,directory,identity):
    from engine.raster_parts import subject,propose,accept
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='raster_part_partition':raise ValueError('Expected completed raster part proposal')
    if subject(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Stale raster part inputs or target state')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Raster part job/result identity changed')
    expected=propose(project,job['settings'])
    if result['base_revision']!=job['document_revision'] or result['part_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Raster part result differs from declared masks/inputs')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Raster part job already reviewed')
    return accept(project,expected,identity)



def create_joint_motion_job(project,settings,job_dir):
    from engine import joint_motion as joint
    scope=joint.subject(project,settings)
    from engine.motion import _exposure,_actor_layers
    layer=_actor_layers(project,settings['schedule']['actor_id'])[0]
    manifest=create_job(project,_exposure(project,layer,settings['schedule']['start'])['drawing_id'],0,0,job_dir)
    manifest.update(operation='joint_motion_schedule',settings=deepcopy(settings),dependency_sha256=scope,source_ids=joint.SOURCES[:])
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    if any('ownership_domain' in r or 'component_seeds' in r for r in project.get('fill_regions',{}).values()):
        from engine.region_domains import SOURCES as DOMAIN_SOURCES
        manifest['source_ids']=sorted(set(manifest['source_ids']+DOMAIN_SOURCES))
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_joint_motion_result(project,directory,choice,identity,rejecting=False):
    from engine import joint_motion as joint
    directory=Path(directory);job,result=read(directory/'job.json'),read(directory/'result.json')
    if job['state']!='completed' or job['operation']!='joint_motion_schedule':raise ValueError('Expected completed joint motion schedule')
    if (directory/'applied-by-host.json').exists() or (directory/'rejected-by-host.json').exists():raise ValueError('Joint job already reviewed')
    if joint.subject(project,job['settings'])!=job['dependency_sha256']:raise ValueError('Stale joint motion/schedule inputs')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Joint job/result identity changed')
    if result['joint_result']['settings']!=job['settings'] or result['joint_result']['dependency_sha256']!=job['dependency_sha256']:raise ValueError('Joint inner settings/dependency differ from declared job')
    if result['base_revision']!=job['document_revision'] or result['output_sha256']!=fingerprint(result['joint_result']):raise ValueError('Joint output identity differs')
    if (directory/'applied-by-host.json').exists() or (directory/'rejected-by-host.json').exists():raise ValueError('Joint job already reviewed')
    return joint.reject(project,result['joint_result'],choice) if rejecting else joint.accept(project,result['joint_result'],choice,identity)


def create_schedule_job(project,settings,job_dir):
    from engine.schedules import subject,SOURCES
    scope,_,_,_,exposures,_,_,_,_=subject(project,settings)
    manifest=create_job(project,exposures[0]['drawing_id'],0,0,job_dir)
    manifest.update(operation='event_preserving_schedule',settings=deepcopy(settings),dependency_sha256=scope,source_ids=SOURCES[:])
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest

def apply_schedule_result(project,directory,choice,identity,rejecting=False):
    from engine.schedules import subject,propose,accept,reject
    directory=Path(directory);job,result=read(directory/'job.json'),read(directory/'result.json')
    if job['state']!='completed' or job['operation']!='event_preserving_schedule':raise ValueError('Expected completed schedule proposal')
    if subject(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Stale schedule inputs or constraints')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Schedule job/result identity changed')
    expected=propose(project,job['settings'])
    if result['base_revision']!=job['document_revision'] or result['schedule_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Schedule differs from declared inputs/constraints')
    if (directory/'applied-by-host.json').exists() or (directory/'rejected-by-host.json').exists():raise ValueError('Schedule already reviewed')
    return reject(project,expected,choice) if rejecting else accept(project,expected,choice,identity)

def create_correspondence_job(project,settings,job_dir):
    from engine.correspondence import subject,SOURCES
    scope,_,inputs,_,_=subject(project,settings)
    manifest=create_job(project,next(iter(inputs.values()))['drawing_id'],0,0,job_dir)
    manifest.update(operation='patch_correspondence',settings=deepcopy(settings),dependency_sha256=scope,source_ids=SOURCES[:])
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_correspondence_result(project,directory,decisions,identity):
    from engine.correspondence import subject,propose,review
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='patch_correspondence':raise ValueError('Expected completed image correspondence job')
    if subject(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Stale correspondence inputs or prior review')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Correspondence job/result identity changed')
    expected=propose(project,job['settings'])
    if result['base_revision']!=job['document_revision'] or result['correspondence_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Correspondence output differs from declared matcher')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Correspondence job already reviewed')
    return review(project,expected,decisions,identity)


def create_motion_job(project,request,job_dir):
    from engine.motion import subject,SOURCES as MOTION_SOURCES
    scope,guide,entries,regions,_,_=subject(project,request)
    manifest=create_job(project,next(iter(entries.values()))['source_exposure']['drawing_id'],0,0,job_dir)
    manifest.update(operation='landmark_motion',settings=deepcopy(request),dependency_sha256=scope,source_ids=MOTION_SOURCES[:])
    from engine import trajectories
    if any(key in guide for key in trajectories.CONTROL_FIELDS):manifest['source_ids']=sorted(set(manifest['source_ids']+trajectories.SOURCES))
    if any('ownership_domain' in r or 'component_seeds' in r for r in regions.values()):
        from engine.region_domains import SOURCES as DOMAIN_SOURCES
        manifest['source_ids']=sorted(set(manifest['source_ids']+DOMAIN_SOURCES))
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_motion_result(project,directory,identity):
    from engine.motion import subject,propose,accept
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='landmark_motion':raise ValueError('Expected completed landmark motion')
    if subject(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Stale motion: source, guide, target or dependent metadata changed')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Motion job/result identity changed')
    expected=propose(project,job['settings'])
    if result['base_revision']!=job['document_revision'] or result['motion_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Motion output violates declared backend')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Motion job already reviewed')
    return accept(project,expected,identity)


def create_reference_job(project,request,job_dir):
    from engine.references import dependency,SOURCES as REFERENCE_SOURCES
    scope,_,_=dependency(project,request)
    manifest=create_job(project,next(iter(project['drawings'])),0,0,job_dir)
    manifest.update(operation='reference_role_assignment',settings=deepcopy(request),dependency_sha256=scope,source_ids=REFERENCE_SOURCES[:])
    if 'COMP-NUMPY-2-4-1' not in manifest['component_ids']:manifest['component_ids'].append('COMP-NUMPY-2-4-1')
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_reference_result(project,directory,identity):
    from engine.references import dependency,propose,accept
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='reference_role_assignment':raise ValueError('Expected completed reference assignment')
    if dependency(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Stale reference assignment; declared dependencies changed')
    for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256']:
        if result.get(key)!=job.get(key):raise ValueError('Reference job/result identity changed')
    expected=propose(project,job['settings'])
    if result['base_revision']!=job['document_revision'] or result['reference_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Reference output violates declared operation')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Reference job already reviewed')
    return accept(project,expected,identity)


def create_palette_job(project,request,job_dir):
    scope,subjects=palette_dependency(project,request)
    manifest=create_job(project,next(iter(project['drawings'])),0,0,job_dir)
    manifest.update(operation='palette_identity_edit',settings=deepcopy(request),dependency_sha256=scope,source_ids=PALETTE_SOURCES[:])
    atomic_write(Path(job_dir)/'job.json',manifest)
    return manifest


def create_learned_motion_job(project,settings,job_dir):
    from engine import learned_motion
    from engine.rife_fields import installation
    scope,layers,_,entries=learned_motion.subject(project,settings);installed=installation()
    manifest=create_job(project,entries[layers[0]]['source']['drawing_id'],0,0,job_dir)
    manifest.update(operation='learned_layer_motion',settings=deepcopy(settings),dependency_sha256=scope,source_ids=[s for s in installed['source_ids'] if s not in {'REF-RAFT-SMALL','REF-DIS-FLOW','REF-OPENCV-LICENSE'}],component_ids=installed['component_ids'],model_identity=fingerprint(dict(runtime=installed['runtime_files'],model=installed['model_files'])))
    atomic_write(Path(job_dir)/'job.json',manifest);return manifest


def apply_learned_motion_result(project,directory,identity,rejecting=False,reason='Rejected learned pose'):
    from engine import learned_motion
    from engine.rife_fields import installation
    directory=Path(directory)
    if any((directory/name).exists() for name in ['applied-by-host.json','rejected-by-host.json']):raise ValueError('Learned job already reviewed')
    job,result=read(directory/'job.json'),read(directory/'result.json')
    if job['state']!='completed' or job['operation']!='learned_layer_motion':raise ValueError('Expected a completed learned motion job')
    for key in ['job_id','input_sha256','settings','source_ids','component_ids','dependency_sha256','model_identity']:
        if result.get(key)!=job.get(key):raise ValueError('Learned job/result identity changed')
    installed=installation()
    if fingerprint(dict(runtime=installed['runtime_files'],model=installed['model_files']))!=job['model_identity']:raise ValueError('Learned runtime/model changed')
    if result['base_revision']!=job['document_revision'] or result['learned_result']['settings']!=job['settings'] or learned_motion.subject(project,job['settings'])[0]!=job['dependency_sha256']:raise ValueError('Learned result is stale or has different inner settings')
    expected=learned_motion.propose(project,job['settings'])
    if result['learned_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Learned output differs from the declared model/backend')
    return learned_motion._reject_fresh(project,expected,reason) if rejecting else learned_motion._install_fresh(project,expected,identity,True)


def apply_palette_result(project,directory,identity):
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='palette_identity_edit':raise ValueError('Expected completed palette edit')
    scope,subjects=palette_dependency(project,job['settings'])
    if scope!=job['dependency_sha256']:raise ValueError('Stale palette result; a declared dependency changed')
    if any(result.get(key)!=job.get(key) for key in ['job_id','input_sha256','settings','source_ids','component_ids','dependency_sha256']) or result['base_revision']!=job['document_revision'] or result['drawing_id']!=job['drawing_id']:raise ValueError('Palette result identity changed')
    expected=propose_palette(project,job['settings'])
    if result['palette_result']!=expected or result['output_sha256']!=fingerprint(expected):raise ValueError('Palette output violates declared operation')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Palette job already reviewed')
    return accept_palette(project,expected,identity)



def create_cleanup_job(project,layer_id,slot,settings,job_dir):
    scope,exposure=cleanup_subject(project,layer_id,slot,settings)
    if project['schema_version']=='0.2':
        from engine.roi_assistance import rectangle
        rectangle(project,settings['roi'])
    manifest=create_job(project,exposure['drawing_id'],0,0,job_dir)
    manifest.update(operation='selected_contour_cleanup',layer_id=layer_id,slot=slot,settings=deepcopy(settings),dependency_sha256=scope,source_ids=CLEANUP_SOURCES[:])
    if project['schema_version']=='0.2':
        from engine.roi_assistance import ADAPTER,SOURCES as ROI_SOURCES
        manifest.update(roi_adapter=ADAPTER,source_ids=CLEANUP_SOURCES+ROI_SOURCES)
    atomic_write(Path(job_dir)/'job.json',manifest)
    return manifest


def apply_cleanup_result(project,directory,identity):
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation']!='selected_contour_cleanup':raise ValueError('Expected completed cleanup proposal')
    scope,exposure=cleanup_subject(project,job['layer_id'],job['slot'],job['settings'])
    if scope!=job['dependency_sha256'] or exposure['drawing_id']!=job['drawing_id']:raise ValueError('Stale cleanup; a declared input changed')
    if any(result.get(k)!=job.get(k) for k in ['job_id','input_sha256','settings','source_ids','component_ids','dependency_sha256','drawing_id']) or result['base_revision']!=job['document_revision']:raise ValueError('Cleanup result identity changed')
    drawing=project['drawings'][exposure['drawing_id']]
    if project['schema_version']=='0.2':
        from engine.roi_assistance import ADAPTER,cleanup_roi
        if job.get('roi_adapter')!=ADAPTER:raise ValueError('Packed cleanup adapter identity changed')
        expected=cleanup_roi(project,job['layer_id'],job['slot'],job['settings'])
    else:expected=propose_cleanup(drawing['pixels'],project['canvas']['width'],project['canvas']['height'],job['settings'],drawing_constraints(drawing))
    if result['cleanup_result']!=expected or result['pixels']!=expected['pixels'] or result['output_sha256']!=fingerprint(expected):raise ValueError('Cleanup output violates the declared constrained method')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Cleanup job already reviewed')
    if project['schema_version']=='0.2':
        from engine.roi_assistance import accept_cleanup_roi
        return accept_cleanup_roi(project,expected,job['layer_id'],job['slot'],identity)
    return accept_cleanup(project,expected,job['layer_id'],job['slot'],identity)


def apply_fill_result(project,directory,identity):
    validate(project)
    job,result=read(Path(directory)/'job.json'),read(Path(directory)/'result.json')
    if job['state']!='completed' or job['operation'] not in {'seed_fill_boundary_baseline','revise_accepted_fill','add_shared_ink_region'}:
        raise ValueError('Expected a completed fill job')
    if project['schema_version']=='0.2':
        from engine.roi_assistance import accept_fill_roi
        expected=_roi_fill(project,job)
        for key in ['job_id','input_sha256','drawing_id','settings','source_ids','component_ids','dependency_sha256','roi','roi_adapter','region_id']:
            if result.get(key)!=job.get(key):raise ValueError('Packed fill result identity changed')
        if result['base_revision']!=job['document_revision'] or result['fill_result']!=expected or result['fill_sha256']!=fingerprint(expected) or result['pixels']!=expected['pixels'] or result['output_sha256']!=fingerprint(expected['pixels']):raise ValueError('Packed fill output violates declared method')
        if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():raise ValueError('Fill job already reviewed')
        return accept_fill_roi(project,expected,job['layer_id'],job['slot'],identity,job.get('region_id') if job['operation']=='revise_accepted_fill' else None)
    adding=job['operation']=='add_shared_ink_region'
    revising=job['operation'] in {'revise_accepted_fill','add_shared_ink_region'}
    if revising:
        if (additional_dependency(project,job['region_id'],job['settings']) if adding else region_dependency(project,job['region_id'],job['settings']))!=job['dependency_sha256']:
            raise ValueError('Stale fill revision; a declared dependency changed')
        region,exposures,layers=region_inputs(project,job['region_id'])
        if job['layer_id']!=region['ink_layer'] or job['drawing_id']!=exposures['ink']['drawing_id'] or not region['start']<=job['slot']<region['start']+region['length']:
            raise ValueError('Fill revision subject changed')
        if result.get('region_id')!=job['region_id'] or result.get('dependency_sha256')!=job['dependency_sha256']:
            raise ValueError('Fill revision result subject changed')
        expected=propose_additional(project,job['region_id'],job['settings']) if adding else propose_revision(project,job['region_id'],job['settings'])
    else:
        if project['revision']!=job['document_revision'] or fingerprint(project)!=job['input_sha256']:
            raise ValueError('Stale fill; source document changed')
        expected=propose_fill(project['drawings'][job['drawing_id']]['pixels'],project['canvas']['width'],project['canvas']['height'],job['settings'])
    from engine.layers import source_over
    if result['job_id']!=job['job_id'] or result['base_revision']!=job['document_revision'] or result['input_sha256']!=job['input_sha256'] or result['drawing_id']!=job['drawing_id'] or result['settings']!=job['settings'] or result['source_ids']!=job['source_ids'] or result['component_ids']!=job['component_ids']:
        raise ValueError('Fill result identity or operation changed')
    if result['fill_result']!=expected or result['fill_sha256']!=fingerprint(expected) or result['pixels']!=source_over(expected['fill'],expected['ink']) or result['output_sha256']!=fingerprint(result['pixels']):
        raise ValueError('Fill result violates declared operation')
    if (Path(directory)/'applied-by-host.json').exists() or (Path(directory)/'rejected-by-host.json').exists():
        raise ValueError('Fill job already reviewed')
    if adding:return accept_additional(project,expected,job['region_id'],identity)
    return accept_revision(project,expected,job['region_id'],identity) if revising else accept_fill(project,expected,job['layer_id'],job['slot'],identity)


def transition(directory, state, **extra):
    job = read(Path(directory) / 'job.json')
    job['state'] = state
    job['history'].append(state)
    job.update(extra)
    atomic_write(Path(directory) / 'job.json', job)
    return job


def request_cancel(directory):
    directory = Path(directory)
    job = read(directory / 'job.json')
    if job['state'] in {'completed', 'cancelled', 'failed'}:
        return False
    # A request is a separate marker, so it cannot race with a worker replacing
    # the job-status file. The worker alone owns state transitions while running.
    (directory / 'cancel.request').touch(exist_ok=True)
    return True


def execute(directory, row_hook=None):
    """Worker-owned state, bounded by finite rows; cancellation at row boundaries.

    row_hook is an in-process controlled-test observation hook, never serialized
    or accepted from an untrusted job. Only one worker can own a job at a time.
    """
    directory = Path(directory)
    with (directory / 'worker.lock').open('x'):
        pass
    started = False
    try:
        job = read(directory / 'job.json')
        if job['state'] != 'created':
            raise ValueError('Job already started; never replay completed work')
        started = True
        transition(directory, 'validating')
        source = read(directory / 'input.json')
        validate(source)
        if fingerprint(source) != job['input_sha256'] or source['revision'] != job['document_revision']:
            raise ValueError('Input snapshot does not match job')
        if job['operation'] not in {'translate_integration_baseline','seed_fill_boundary_baseline','revise_accepted_fill','add_shared_ink_region','palette_identity_edit','selected_contour_cleanup','reference_role_assignment','landmark_motion','patch_correspondence','raster_part_partition','event_preserving_schedule','joint_motion_schedule','learned_layer_motion'} or job['execution'] != {'target': 'local', 'network_allowed': False}:
            raise ValueError('Unsupported operation or execution target')
        width, height = source['canvas']['width'], source['canvas']['height']
        if job['operation']=='learned_layer_motion':
            from engine import learned_motion
            from engine.rife_fields import installation
            import socket
            from unittest.mock import patch
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def learned_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                learned_checkpoint();installed=installation()
                if learned_motion.subject(source,job['settings'])[0]!=job['dependency_sha256'] or fingerprint(dict(runtime=installed['runtime_files'],model=installed['model_files']))!=job['model_identity']:raise ValueError('Learned input/model identity changed')
                with patch.object(socket,'socket',side_effect=RuntimeError('Network disabled for learned worker')):proposal=learned_motion.propose(source,job['settings'],learned_checkpoint)
                learned_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            result=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=job['dependency_sha256'],model_identity=job['model_identity'],learned_result=proposal,output_sha256=fingerprint(proposal),applicability='needs_repair' if proposal['unsafe_reasons'] else 'requires_review')
            atomic_write(directory/'result.json',result);return transition(directory,'completed',output_present=True)
        if job['operation']=='joint_motion_schedule':
            from engine import joint_motion as joint
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def joint_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                joint_checkpoint()
                if joint.subject(source,job['settings'])!=job['dependency_sha256']:raise ValueError('Joint dependency identity changed')
                proposal=joint.propose(source,job['settings'],joint_checkpoint);joint_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=job['dependency_sha256'],joint_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='needs_repair' if proposal['schedule']['conflicts'] else 'requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='event_preserving_schedule':
            from engine.schedules import subject,propose
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def schedule_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                schedule_checkpoint();scope=subject(source,job['settings'])[0]
                if scope!=job['dependency_sha256']:raise ValueError('Schedule dependencies changed')
                proposal=propose(source,job['settings'],schedule_checkpoint);schedule_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,schedule_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='needs_repair' if proposal['conflicts'] else 'requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='raster_part_partition':
            from engine.raster_parts import subject,propose
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def part_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                part_checkpoint();scope,_,_,_,_,_=subject(source,job['settings'])
                if scope!=job['dependency_sha256']:raise ValueError('Raster part dependencies changed')
                proposal=propose(source,job['settings'],part_checkpoint);part_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,part_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='needs_repair' if proposal['unsafe_reasons'] else 'requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='patch_correspondence':
            from engine.correspondence import subject,propose
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def match_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                match_checkpoint();scope,_,_,_,_=subject(source,job['settings'])
                if scope!=job['dependency_sha256']:raise ValueError('Correspondence inputs changed')
                proposal=propose(source,job['settings'],match_checkpoint);match_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,correspondence_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='landmark_motion':
            from engine.motion import subject,propose
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def motion_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                motion_checkpoint();scope,_,_,_,_,_=subject(source,job['settings'])
                if scope!=job['dependency_sha256']:raise ValueError('Motion input dependencies changed')
                proposal=propose(source,job['settings'],motion_checkpoint);motion_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,motion_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='needs_repair' if proposal['unsafe_reasons'] else 'requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='reference_role_assignment':
            from engine.references import dependency,propose
            transition(directory,'queued');transition(directory,'running');ticks=[0]
            def reference_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                reference_checkpoint();scope,_,_=dependency(source,job['settings'])
                if scope!=job['dependency_sha256']:raise ValueError('Reference input dependency changed')
                proposal=propose(source,job['settings'],reference_checkpoint)
            except FillCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,reference_result=proposal,output_sha256=fingerprint(proposal),method=proposal['method'],version=proposal['version'],warnings=proposal['warnings'],applicability='requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='selected_contour_cleanup':
            transition(directory,'queued');transition(directory,'running')
            ticks=[0]
            def cleanup_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise CleanupCancelled()
            try:
                scope,exposure=cleanup_subject(source,job['layer_id'],job['slot'],job['settings'])
                if scope!=job['dependency_sha256'] or exposure['drawing_id']!=job['drawing_id']:raise ValueError('Cleanup input identity changed')
                drawing=source['drawings'][exposure['drawing_id']]
                if source['schema_version']=='0.2':
                    from engine.roi_assistance import ADAPTER,cleanup_roi
                    if job.get('roi_adapter')!=ADAPTER:raise ValueError('Packed cleanup adapter identity changed')
                    cleanup=cleanup_roi(source,job['layer_id'],job['slot'],job['settings'],cleanup_checkpoint)
                else:cleanup=propose_cleanup(drawing['pixels'],width,height,job['settings'],drawing_constraints(drawing),cleanup_checkpoint)
                cleanup_checkpoint()
            except CleanupCancelled:
                transition(directory,'cancel_requested');return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,cleanup_result=cleanup,pixels=cleanup['pixels'],output_sha256=fingerprint(cleanup),method=cleanup['method'],version=cleanup['version'],warnings=cleanup['warnings'],applicability='requires_review')
            atomic_write(directory/'result.json',manifest);return transition(directory,'completed',output_present=True)
        if job['operation']=='palette_identity_edit':
            transition(directory,'queued');transition(directory,'running')
            ticks=[0]
            def palette_checkpoint():
                if row_hook:row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():raise FillCancelled()
            try:
                scope,subjects=palette_dependency(source,job['settings'])
                if scope!=job['dependency_sha256']:raise ValueError('Palette input dependency changed')
                palette=propose_palette(source,job['settings'],palette_checkpoint)
                palette_checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested')
                return transition(directory,'cancelled',output_present=False)
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],settings=job['settings'],source_ids=job['source_ids'],component_ids=job['component_ids'],dependency_sha256=scope,palette_result=palette,output_sha256=fingerprint(palette),method=palette['method'],version=palette['version'],warnings=palette['warnings'],applicability='requires_review')
            atomic_write(directory/'result.json',manifest)
            return transition(directory,'completed',output_present=True)
        if job['operation'] in {'seed_fill_boundary_baseline','revise_accepted_fill','add_shared_ink_region'}:
            transition(directory,'queued')
            transition(directory,'running')
            ticks=[0]
            def checkpoint():
                if row_hook:
                    row_hook(ticks[0])
                ticks[0]+=1
                if (directory/'cancel.request').exists():
                    raise FillCancelled()
            try:
                if source['schema_version']=='0.2':fill=_roi_fill(source,job,checkpoint)
                elif job['operation'] in {'revise_accepted_fill','add_shared_ink_region'}:
                    adding=job['operation']=='add_shared_ink_region'
                    scope=additional_dependency(source,job['region_id'],job['settings']) if adding else region_dependency(source,job['region_id'],job['settings'])
                    if scope!=job['dependency_sha256']:
                        raise ValueError('Revision input dependency identity changed')
                    fill=propose_additional(source,job['region_id'],job['settings'],checkpoint) if adding else propose_revision(source,job['region_id'],job['settings'],checkpoint)
                else:
                    fill=propose_fill(source['drawings'][job['drawing_id']]['pixels'],width,height,job['settings'],checkpoint)
                checkpoint()
            except FillCancelled:
                transition(directory,'cancel_requested')
                return transition(directory,'cancelled',applicability='requires_review',output_present=False)
            from engine.layers import source_over
            pixels=fill['pixels'] if source['schema_version']=='0.2' else source_over(fill['fill'],fill['ink'])
            manifest=dict(schema_version='0.1',job_id=job['job_id'],base_revision=source['revision'],input_sha256=job['input_sha256'],drawing_id=job['drawing_id'],pixels=pixels,output_sha256=fingerprint(pixels),fill_result=fill,fill_sha256=fingerprint(fill),source_ids=job['source_ids'],component_ids=job['component_ids'],method=fill['method'],version=fill['version'],settings=job['settings'],warnings=fill['warnings'],color_representation=deepcopy(source['canvas']),exposure_changes=[],applicability='requires_review')
            if source['schema_version']=='0.2':
                manifest.update(roi=job['roi'],roi_adapter=job['roi_adapter'],dependency_sha256=job['dependency_sha256'])
            if job['operation'] in {'revise_accepted_fill','add_shared_ink_region'}:
                manifest.update(region_id=job['region_id'],dependency_sha256=job['dependency_sha256'])
            atomic_write(directory/'result.json',manifest)
            return transition(directory,'completed',output_present=True)
        dx, dy = job['settings']['dx'], job['settings']['dy']
        if type(dx) is not int or type(dy) is not int:
            raise ValueError('Integer translation required')
        original = source['drawings'][job['drawing_id']]['pixels']
        if isinstance(original,PixelPlane):
            transition(directory,'queued');transition(directory,'running')
            def packed_checkpoint(row):
                if row_hook:row_hook(row)
                if (directory/'cancel.request').exists():raise PackedCancelled()
            try:
                from engine.packed_model import translated_constraints
                protection=translated_constraints(source['drawings'][job['drawing_id']],width,height,dx,dy,packed_checkpoint)
                if protection.get('constraint_clip_count'):raise ValueError('Translation would clip protected artist corrections')
                result,clipped=translate(original,dx,dy,packed_checkpoint)
            except PackedCancelled:
                transition(directory,'cancel_requested')
                return transition(directory,'cancelled',output_present=False)
        else:
            from engine.packed_model import translated_constraints
            protection=translated_constraints(source['drawings'][job['drawing_id']],width,height,dx,dy)
            if protection.get('constraint_clip_count'):raise ValueError('Translation would clip protected artist corrections')
            result = [[0, 0, 0, 0] for _ in original]
            transition(directory, 'queued')
            transition(directory, 'running')
            clipped = 0
            for y in range(height):
                if row_hook:
                    row_hook(y)
                if (directory / 'cancel.request').exists():
                    transition(directory, 'cancel_requested')
                    return transition(directory, 'cancelled', applicability='requires_review', output_present=False)
                for x in range(width):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        result[ny * width + nx] = original[y * width + x][:]
                    elif original[y * width + x][3]:
                        clipped += 1
        if (directory / 'cancel.request').exists():
            transition(directory, 'cancel_requested')
            return transition(directory, 'cancelled', output_present=False)
        manifest = {'schema_version': '0.1', 'job_id': job['job_id'], 'base_revision': source['revision'],
                    'input_sha256': job['input_sha256'], 'drawing_id': job['drawing_id'],
                    'pixels': result, 'output_sha256': fingerprint(result),
                    'source_ids': job['source_ids'], 'component_ids': job['component_ids'],
                    'method': 'integer-translation-integration-baseline', 'version': '0.1.0',
                    'settings': job['settings'], 'warnings': [str(clipped) + ' nontransparent pixels clipped'] if clipped else [],
                    'color_representation': deepcopy(source['canvas']),
                    'exposure_changes': [], 'applicability': 'requires_review'}
        atomic_write(directory / 'result.json', manifest)
        return transition(directory, 'completed', output_present=True)
    except Exception as error:
        if started and (directory / 'job.json').is_file():
            transition(directory, 'failed', error=str(error), output_present=False)
        raise
    finally:
        (directory / 'worker.lock').unlink(missing_ok=True)


def apply_result(project, directory, proposal_id, new_drawing_id):
    """Explicit application yields a NEW project; disk/host originals untouched."""
    validate(project)
    directory = Path(directory)
    job, result = read(directory / 'job.json'), read(directory / 'result.json')
    if job['state'] != 'completed':
        raise ValueError('Only completed jobs can be reviewed/applied')
    if project['revision'] != result['base_revision'] or fingerprint(project) != result['input_sha256']:
        raise ValueError('Stale result; input document changed')
    if result['input_sha256'] != job['input_sha256'] or result['job_id'] != job['job_id']:
        raise ValueError('Result/job identity mismatch')
    if result['settings'] != job['settings'] or result['drawing_id'] != job['drawing_id'] or result['source_ids'] != job['source_ids'] or result['component_ids'] != job['component_ids']:
        raise ValueError('Result does not match the requested operation')
    if fingerprint(result['pixels']) != result['output_sha256']:
        raise ValueError('Result pixels do not match recorded output hash')
    # Derive the baseline's expected result locally before accepting an external
    # worker's output. Other adapters will need their own constraint validation.
    proposed = propose_translation(project, proposal_id, result['drawing_id'], **result['settings'])
    if result['pixels'] != proposed['proposals'][proposal_id]['pixels']:
        raise ValueError('Result violates the declared baseline operation')
    return accept(proposed, proposal_id, new_drawing_id)
