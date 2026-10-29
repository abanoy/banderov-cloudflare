"""Original standalone editing controller; GUI-independent, no network or models."""

from copy import deepcopy

import base64

import hashlib

import json

from pathlib import Path

import uuid



from engine.project import create, validate, fingerprint, correct_and_lock, accept, propose_translation

from engine.jobs import atomic_write, apply_result, apply_fill_result, apply_palette_result, apply_cleanup_result, read

from engine.io.project_archive import PixelPlane

from engine.packed_model import check_budget,load_packed

from engine.layers import validate_layers, visible

from engine.fill_revision import advance_epochs, protected_pixels





def demo():

    pixels = [[0, 0, 0, 0] for _ in range(64 * 64)]

    for y in range(20, 36):

        for x in range(12, 28):

            pixels[y * 64 + x] = [30, 110, 210, 180]

    project = create(pixels, 64, 64, 12)

    project['project_id'] = 'standalone-integration-demo'

    project = accept(propose_translation(project, 'demo-shift', 'source', 16, 0), 'demo-shift', 'shifted')

    project['exposures'] = [dict(layer_id='ink', drawing_id='source', start=0, length=4), dict(layer_id='ink', drawing_id='shifted', start=4, length=8)]

    return validate(project)





def supported(project):

    validate(project)

    limit=4096 if project['schema_version']=='0.2' else 256

    drawings=512 if project['schema_version']=='0.2' else 64

    if project['schema_version']=='0.2':

        check_budget(project)

        from engine.roi_assistance import validate_regions

        validate_regions(project)

    else:

        from engine.region_domains import validate_metadata

        for region in project.get('fill_regions',{}).values():

            validate_metadata(region,project['canvas']['width'],project['canvas']['height'])

    if max(project['canvas']['width'], project['canvas']['height']) > limit or project['shot']['duration_frames'] > 600 or len(project['drawings']) > drawings:

        raise ValueError('This prototype supports <=256px, <=600 slots and <=64 drawings')

    validate_layers(project)

    if any(k in project for k in ['references','reference_archive','part_bindings']):

        from engine.references import validate_references

        validate_references(project)

    if 'motion_guides' in project:

        from engine.motion import validate_guides

        validate_guides(project)

    if 'candidate_corrections' in project:
        from engine.candidate_corrections import validate_metadata
        validate_metadata(project)

    if 'learned_motion_operations' in project or 'learned_motion_reviews' in project:
        from engine.learned_motion import validate_metadata
        validate_metadata(project)

    if 'correspondence_reviews' in project or 'correspondence_operations' in project:

        from engine.correspondence import validate_reviews

        validate_reviews(project)

    if 'raster_parts' in project:

        from engine.raster_parts import validate_parts

        validate_parts(project)

    if 'native_window_source' in project:
        from engine.io.kra_window import validate_source
        validate_source(project)
    if 'native_effects' in project:
        from engine.native_effects import validate_parameters
        validate_parameters(project,project['native_effects'])
    if any(k in project for k in ('schedule_constraints','schedule_reviews','schedule_operations')):

        from engine.schedules import validate_metadata

        validate_metadata(project)

    epochs=project.get('dependency_epochs',{})

    if not isinstance(epochs,dict) or len(epochs)>512 or any(not isinstance(key,str) or not 1<=len(key)<=256 or type(value) is not int or not 0<=value<2**63 for key,value in epochs.items()):

        raise ValueError('Invalid dependency epoch metadata')

    for drawing in project['drawings'].values():

        if 'protected_mask' in drawing or 'protection_encoding' in drawing:

            if project['schema_version']!='0.2':raise ValueError('Spatial asset masks require packed schema')

            from engine.spatial_constraints import drawing_mask

            drawing_mask(drawing)

        if 'protected_pixels' in drawing:

            protected_pixels(drawing)

    for field in ['native_source','ora_source','png_source']:

        if field not in project:

            continue

        source = project[field]

        if project['schema_version']=='0.2' and 'blob' in source:

            from engine.io.project_archive import SourceBlob

            if not isinstance(source['blob'],SourceBlob) or source['blob'].sha256!=source.get('sha256'):raise ValueError('Retained source identity changed')

            continue

        try:

            data = base64.b64decode(source['encoded_base64' if field=='png_source' else 'archive_base64'], validate=True)

        except (ValueError, KeyError) as error:

            raise ValueError('Invalid retained native archive') from error

        if len(data) > 4 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != source.get('sha256'):

            raise ValueError('Retained native archive identity changed')

    fps = project['shot']['fps']

    if set(fps) != {'numerator', 'denominator'} or not 1 <= fps['numerator'] / fps['denominator'] <= 120:

        raise ValueError('Expected a rational frame rate between 1 and 120')

    return project





class Session:

    def __init__(self, project=None):

        self.project = deepcopy(supported(project)) if project is not None else None

        self.slot = 0

        paints = validate_layers(self.project) if self.project else []

        self.layer_id = next((i for i in paints if visible(self.project, i)), paints[0] if paints else None)

        self.past, self.future = [], []

        self.saved_hash = fingerprint(self.project)

        self.counter = self.project['revision'] if self.project else 0



    @property

    def dirty(self):

        return fingerprint(self.project) != self.saved_hash



    def apply_joint_motion(self,directory,choice,rejecting=False):
        from engine.jobs import apply_joint_motion_result
        result=apply_joint_motion_result(self.project,directory,choice,'joint-'+uuid.uuid4().hex,rejecting)
        self.commit(result,'reject-joint-motion-schedule' if rejecting else 'accept-joint-motion-schedule')
        atomic_write(Path(directory)/('rejected-by-host.json' if rejecting else 'applied-by-host.json'),dict(revision=self.project['revision'],action='joint-motion-schedule-review'))

    def apply_learned_motion(self,directory,rejecting=False,reason='Rejected learned pose'):
        from engine.jobs import apply_learned_motion_result
        result=apply_learned_motion_result(self.project,directory,'learned-'+uuid.uuid4().hex,rejecting,reason)
        self.commit(result,'reject-learned-motion' if rejecting else 'accept-learned-motion')
        atomic_write(Path(directory)/('rejected-by-host.json' if rejecting else 'applied-by-host.json'),dict(revision=self.project['revision'],action='learned-motion-review'))

    def apply_schedule(self,directory,choice,rejecting=False):

        from engine.jobs import apply_schedule_result

        result=apply_schedule_result(self.project,directory,choice,'schedule-'+uuid.uuid4().hex,rejecting)

        self.commit(result,'reject-schedule' if rejecting else 'accept-schedule')

        atomic_write(Path(directory)/('rejected-by-host.json' if rejecting else 'applied-by-host.json'),dict(revision=self.project['revision'],action='schedule-review'))



    def review_matches(self,directory,decisions):

        from engine.jobs import apply_correspondence_result

        result=apply_correspondence_result(self.project,directory,decisions,'matches-'+uuid.uuid4().hex)

        self.commit(result,'review-image-correspondences')

        atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='review-correspondences'))



    def set_native_effects(self, parameters):
        """Explicit editable effect setting with undo; raw host display unchanged."""
        from engine.native_effects import validate_parameters,compile_styles
        validate_parameters(self.project,parameters)
        previous=self.project.get('native_effects') or compile_styles(self.project)
        for identity,settings in parameters['layers'].items():
            ancestor=identity
            while ancestor is not None:
                layer=self.project['layers'][ancestor]
                if settings!=previous['layers'][identity] and layer.get('locked',False):
                    raise ValueError('Cannot change effects on a locked layer or group')
                ancestor=layer.get('parent_id')
        candidate=deepcopy(self.project)
        candidate['native_effects']=deepcopy(parameters)
        self.commit(candidate,'set-native-effects')

    def commit(self, project, action):

        supported(project)

        candidate=deepcopy(project)

        candidate['revision']=self.counter+1

        candidate['history'].append({'action':action})

        candidate=advance_epochs(self.project,candidate)

        supported(candidate)

        if candidate['schema_version']=='0.2':check_budget(candidate)

        elif len(json.dumps(candidate,indent=2,ensure_ascii=False,allow_nan=False).encode('utf-8'))>32*1024*1024:

            raise ValueError('Proposed state exceeds the32MiB serialization bound; current project is preserved')

        self.past.append(deepcopy(self.project))

        self.past=self.past[-16:]

        self.future.clear()

        self.counter+=1

        self.project=candidate



    def travel(self, undo=True):

        source, target = (self.past, self.future) if undo else (self.future, self.past)

        if not source:

            return False

        target.append(deepcopy(self.project))

        before=self.project

        self.project = advance_epochs(before,source.pop())

        self.counter += 1  # Undo must never make an old worker result current again.

        self.project['revision'] = self.counter

        for proposal in self.project['proposals'].values():

            if proposal['status'] == 'pending':

                proposal['status'] = 'stale'

        self.slot = min(self.slot, self.project['shot']['duration_frames'] - 1)

        paints=validate_layers(self.project)

        if self.layer_id not in paints:

            self.layer_id=next((i for i in paints if visible(self.project,i)),paints[0])

        return True



    def exposure(self):

        return next(e for e in self.project['exposures'] if e['layer_id'] == self.layer_id and e['start'] <= self.slot < e['start'] + e['length'])



    def drawing_id(self):

        return self.exposure()['drawing_id']



    def correct(self, edits):

        """One stroke = one undoable correction; original/previous drawings survive."""

        source_pixels=self.project['drawings'][self.drawing_id()]['pixels']

        if isinstance(source_pixels,PixelPlane):

            if not edits:return

            from engine.spatial_constraints import uniform

            pixels=source_pixels.with_edits(edits)

            delta=uniform(source_pixels.width,source_pixels.height).with_edits({i:[1,0,0,0] for i in edits})

            return self.commit_packed_correction(pixels,delta)

        else:

            pixels = deepcopy(self.project['drawings'][self.drawing_id()]['pixels'])

            for index, color in edits.items():

                if type(index) is not int or not 0 <= index < len(pixels) or len(color) != 4 or any(type(c) is not int or not 0 <= c <= 255 for c in color):

                    raise ValueError('Invalid RGBA pixel edit')

                pixels[index] = list(color)

        if not edits:

            return

        identifier = 'correction-' + uuid.uuid4().hex

        corrected = correct_and_lock(self.project, self.drawing_id(), identifier, pixels)

        previous=self.project['drawings'][self.drawing_id()]

        inherited=previous['protected_pixels'] if 'protected_pixels' in previous else list(range(len(pixels))) if previous.get('origin')=='artist_correction' and previous.get('locked',False) else []

        corrected['drawings'][identifier]['protected_pixels']=sorted(set(inherited)|set(edits))

        corrected['drawings'][identifier]['parent_drawing']=self.drawing_id()

        for old, new in zip(self.project['exposures'], corrected['exposures']):

            if old['layer_id'] != self.layer_id:

                new['drawing_id'] = old['drawing_id']

        self.commit(corrected, 'standalone-stroke')



    def correct_stroke(self,stroke):

        from engine.paint_stroke import PackedStroke

        if not isinstance(stroke,PackedStroke):raise ValueError('Expected an explicit repair stroke')

        source=self.project['drawings'][self.drawing_id()]['pixels']

        if isinstance(source,PixelPlane):

            if source!=stroke.source:raise ValueError('Stroke input changed')

            if stroke.touched:self.commit_packed_correction(*stroke.planes())

        else:

            c=self.project['canvas']

            if PixelPlane.from_pixels(c['width'],c['height'],source)!=stroke.source:raise ValueError('Stroke input changed')

            if stroke.touched:self.correct(stroke.edits())



    def commit_packed_correction(self,pixels,delta):

        from engine.spatial_constraints import drawing_mask,merge,ENCODING,validate_mask,validate_artist_delta

        previous=self.project['drawings'][self.drawing_id()]

        validate_mask(delta,pixels.width,pixels.height)

        validate_artist_delta(previous['pixels'],pixels,delta)

        mask=merge(drawing_mask(previous),delta)

        identifier='correction-'+uuid.uuid4().hex

        corrected=correct_and_lock(self.project,self.drawing_id(),identifier,pixels)

        corrected['drawings'][identifier].update(protected_mask=mask,protection_encoding=ENCODING,parent_drawing=self.drawing_id())

        if previous.get('approved') is False:
            corrected['drawings'][identifier].update(candidate_correction=True,candidate_touched_mask=delta)

        for old,new in zip(self.project['exposures'],corrected['exposures']):

            if old['layer_id']!=self.layer_id:new['drawing_id']=old['drawing_id']

        self.commit(corrected,'standalone-spatial-correction')



    def hold(self, length):

        """Move the next cut, keeping clip duration and all other cuts unchanged."""

        if type(length) is not int or length < 1:

            raise ValueError('Hold must be a positive integer')

        result = deepcopy(self.project)

        ordered = sorted((e for e in result['exposures'] if e['layer_id'] == self.layer_id), key=lambda e: e['start'])

        index = next(i for i, e in enumerate(ordered) if e['start'] <= self.slot < e['start'] + e['length'])

        current = ordered[index]

        if index + 1 == len(ordered):

            raise ValueError('Last hold ends at the clip boundary; select an earlier drawing to move a cut')

        following = ordered[index + 1]

        delta = length - current['length']

        if following['start'] != current['start'] + current['length'] or following['length'] - delta < 1:

            raise ValueError('Keep at least one slot in the following contiguous hold')

        current['length'] = length

        following['start'] += delta

        following['length'] -= delta

        if self.project.get('schedule_constraints'):

            from engine.schedules import check_manual_timing_edit

            check_manual_timing_edit(self.project,result,self.layer_id)

        self.slot = current['start']

        self.commit(result, 'move-exposure-cut')



    def apply(self, directory):

        job=read(Path(directory)/'job.json')

        if job['operation']=='raster_part_partition':

            from engine.jobs import apply_part_result

            result=apply_part_result(self.project,directory,'part-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-raster-part')

            self.slot=job['settings']['target_start']

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-raster-part'))

            return

        if job['operation']=='landmark_motion':

            from engine.jobs import apply_motion_result

            result=apply_motion_result(self.project,directory,'motion-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-landmark-motion')

            self.slot=job['settings']['target_start']

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-landmark-motion'))

            return

        if job['operation']=='reference_role_assignment':

            from engine.jobs import apply_reference_result

            result=apply_reference_result(self.project,directory,'reference-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-reference-role')

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-reference-role'))

            return

        if job['operation']=='selected_contour_cleanup':

            if self.layer_id!=job['layer_id'] or self.drawing_id()!=job['drawing_id'] or self.slot!=job['slot']:raise ValueError('Return to the cleanup input layer/drawing/playhead before accepting')

            result=apply_cleanup_result(self.project,directory,'cleanup-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-selected-cleanup')

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-cleanup'))

            return

        if job['operation']=='palette_identity_edit':

            result=apply_palette_result(self.project,directory,'palette-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-palette-edit')

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-palette'))

            return

        if job['operation'] in {'seed_fill_boundary_baseline','revise_accepted_fill','add_shared_ink_region'}:

            if self.layer_id!=job['layer_id'] or self.drawing_id()!=job['drawing_id'] or self.slot!=job['slot']:

                raise ValueError('Return to the fill input layer and playhead before accepting')

            result,layer=apply_fill_result(self.project,directory,'flat-'+uuid.uuid4().hex)

            self.commit(result,'apply-reviewed-fill-layers')

            self.layer_id=layer

            atomic_write(Path(directory)/'applied-by-host.json',dict(revision=self.project['revision'],action='accept-fill'))

            return

        old = self.drawing_id()

        if read(Path(directory) / 'job.json')['drawing_id'] != old:

            raise ValueError('Selected drawing changed; return to the job input drawing')

        new = 'accepted-' + uuid.uuid4().hex

        result = apply_result(self.project, directory, 'job-' + uuid.uuid4().hex, new)

        for exposure in result['exposures']:

            if exposure['drawing_id'] == old and exposure['layer_id'] == self.layer_id:

                exposure['drawing_id'] = new

        self.commit(result, 'apply-reviewed-job-to-selected-drawing')



    def save(self, path):

        supported(self.project)

        if self.project['schema_version']=='0.2':

            if Path(path).suffix.lower()!='.aaa':raise ValueError('Packed documents save as .aaa; legacy JSON would expand assets')

            from engine.io.project_archive import save_archive

            check_budget(self.project);save_archive(path,self.project)

            self.saved_hash=fingerprint(self.project)

            return

        if len(json.dumps(self.project, indent=2, ensure_ascii=False, allow_nan=False).encode('utf-8')) > 32 * 1024 * 1024:

            raise ValueError('Project exceeds the 32 MiB supported serialization bound')

        if Path(path).suffix.lower()=='.aaa':

            from engine.io.project_archive import save_archive

            save_archive(path,self.project)

            self.saved_hash=fingerprint(self.project)

            return

        atomic_write(path, self.project)

        self.saved_hash = fingerprint(self.project)



    @classmethod

    def load(cls, path):

        path = Path(path)

        if path.suffix.lower()=='.aaa':

            from engine.io.project_archive import PackedArchive

            with PackedArchive(path) as archive:

                if archive.project.get('schema_version')=='0.2':

                    from engine.packed_model import resident

                    return cls(resident(archive.project))

                return cls(archive.materialize_legacy())

        if path.stat().st_size > 32 * 1024 * 1024:

            raise ValueError('Project exceeds the 32 MiB prototype bound')

        return cls(json.loads(path.read_text(encoding='utf-8')))

