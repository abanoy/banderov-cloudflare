"""Independent local raster-contour suggestion, not intended-contour inference.

REF-THINNING-OPENCV: Zhang–Suen conditions (no code/tables copied).
REF-CHAIKIN-NOTES / REF-QGIS-SMOOTH: corner cutting and retention precedents.
Source-derived brush reconstruction is a project baseline; original medium survives
in retained versions, not a claim of lossless pencil-texture reconstruction.
"""
from collections import deque
from copy import deepcopy
import math

from engine.project import validate,fingerprint
from engine.layers import validate_layers,source_over

SOURCES=['REF-PYTHON','REF-PYTHON-COPY','REF-COMPOSITING','REF-THINNING-OPENCV','REF-CHAIKIN-NOTES','REF-QGIS-SMOOTH']
NEIGHBORS=[(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)]


class CleanupCancelled(Exception):pass


def defaults(width,height):
    return dict(roi=[0,0,width,height],iterations=2,corner_angle=55,max_shift=1.5,max_remove_area=0,threshold=32,paper='transparent',keep_pixels=[])


def checked(settings,width,height):
    if set(settings)!=set(defaults(width,height)):raise ValueError('Expected complete explicit cleanup settings')
    roi=settings['roi']
    if not isinstance(roi,list) or len(roi)!=4 or any(type(n) is not int for n in roi) or not 0<=roi[0]<roi[2]<=width or not 0<=roi[1]<roi[3]<=height:raise ValueError('Select a nonempty rectangle inside the drawing')
    for key,lo,hi in [('iterations',0,3),('corner_angle',0,180),('max_remove_area',0,32),('threshold',1,255)]:
        if type(settings[key]) is not int or not lo<=settings[key]<=hi:raise ValueError('Invalid bounded cleanup '+key)
    shift=settings['max_shift']
    if type(shift) not in {int,float} or not math.isfinite(shift) or not 0<=shift<=4:raise ValueError('Maximum displacement must be0..4pixels')
    if settings['paper'] not in {'transparent','white'}:raise ValueError('Choose transparent ink or explicit white paper')
    keep=settings['keep_pixels']
    if not isinstance(keep,list) or len(keep)>width*height or any(type(i) is not int or not 0<=i<width*height for i in keep) or len(set(keep))!=len(keep):raise ValueError('Invalid keep-detail pixel mask')
    return deepcopy(settings)


def components(mask,diagonal=True,checkpoint=None):
    remaining=set(mask);result=[];moves=NEIGHBORS if diagonal else NEIGHBORS[::2]
    while remaining:
        seed=min(remaining);remaining.remove(seed);found={seed};queue=deque([seed]);visits=0
        while queue:
            point=queue.popleft();visits+=1
            if checkpoint and visits%256==0:checkpoint()
            for dx,dy in moves:
                neighbor=(point[0]+dx,point[1]+dy)
                if neighbor in remaining:remaining.remove(neighbor);found.add(neighbor);queue.append(neighbor)
        result.append(found)
    return result


def topology(mask,width,height,checkpoint=None):
    foreground=len(components(mask,True,checkpoint))
    background={(x,y) for y in range(-1,height+1) for x in range(-1,width+1)}-set(mask)
    holes=max(0,len(components(background,False,checkpoint))-1)
    return dict(components=foreground,holes=holes)


def thin(mask,checkpoint=None):
    current=set(mask)
    for iteration in range(256):
        changed=False
        for phase in [0,1]:
            remove=[]
            for index,(x,y) in enumerate(sorted(current)):
                if checkpoint and index%256==0:checkpoint()
                ring=[int((x+dx,y+dy) in current) for dx,dy in NEIGHBORS]
                transitions=sum(ring[i]==0 and ring[(i+1)%8]==1 for i in range(8))
                if not 2<=sum(ring)<=6 or transitions!=1:continue
                north,east,south,west=ring[0],ring[2],ring[4],ring[6]
                triples=(north*east*south,east*south*west) if phase==0 else (north*east*west,north*south*west)
                if triples==(0,0):remove.append((x,y))
            if remove:current.difference_update(remove);changed=True
        if not changed:return current
    raise ValueError('Thinning iteration budget exceeded; original retained')


def paths(mask):
    graph={}
    for x,y in mask:
        neighbors=[]
        for dx,dy in NEIGHBORS:
            candidate=(x+dx,y+dy)
            if candidate not in mask:continue
            if dx and dy and ((x+dx,y) in mask or (x,y+dy) in mask):continue
            neighbors.append(candidate)
        graph[x,y]=sorted(neighbors)
    visited=set();result=[]
    starts=sorted(graph,key=lambda p:(len(graph[p])==2,p))
    for start in starts:
        if not graph[start]:result.append([start])
        for neighbor in graph[start]:
            edge=tuple(sorted([start,neighbor]))
            if edge in visited:continue
            path=[start,neighbor];visited.add(edge);previous,current=start,neighbor
            while len(graph[current])==2 and current!=start:
                following=next(p for p in graph[current] if p!=previous)
                edge=tuple(sorted([current,following]))
                if edge in visited:break
                visited.add(edge);path.append(following);previous,current=current,following
            result.append(path)
    return result


def widths(mask):
    result={p:1 for p in mask if any((p[0]+dx,p[1]+dy) not in mask for dx,dy in NEIGHBORS[::2])}
    queue=deque(result)
    while queue:
        x,y=queue.popleft()
        for dx,dy in NEIGHBORS[::2]:
            point=(x+dx,y+dy)
            if point in mask and point not in result:result[point]=result[x,y]+1;queue.append(point)
    return result


def distance(point,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1];denominator=dx*dx+dy*dy
    t=max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/denominator)) if denominator else 0
    return math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy),t


def cut(points,iterations,corner_angle):
    anchors={0,len(points)-1}
    window=3
    for i in range(window,len(points)-window):
        before=(points[i][0]-points[i-window][0],points[i][1]-points[i-window][1])
        after=(points[i+window][0]-points[i][0],points[i+window][1]-points[i][1])
        norm=math.hypot(*before)*math.hypot(*after)
        if norm:
            angle=math.degrees(math.acos(max(-1,min(1,(before[0]*after[0]+before[1]*after[1])/norm))))
            if angle>=corner_angle and i-max(a for a in anchors if a<i)>=window:anchors.add(i)
    ordered=sorted(anchors);result=[]
    for start,end in zip(ordered,ordered[1:]):
        segment=points[start:end+1]
        for _ in range(iterations):
            refined=[segment[0]]
            for a,b in zip(segment,segment[1:]):
                refined.extend([[(3*x+y)/4 for x,y in zip(a,b)],[(x+3*y)/4 for x,y in zip(a,b)]])
            refined.append(segment[-1]);segment=refined
        result.extend(segment if not result else segment[1:])
    return result or points,[points[i] for i in ordered]


def deviation(original,curve):
    # Parameter-local, bidirectional sampled distance, NOT a calibrated confidence
    # or a continuous global Hausdorff certificate.
    bins={}
    for a,b in zip(curve,curve[1:]):
        for index in range(max(0,math.floor(a[-1])-1),math.ceil(b[-1])+2):bins.setdefault(index,[]).append((a,b))
    worst=0
    for i,p in enumerate(original):
        segments=bins.get(i,[])
        if segments:worst=max(worst,min(distance(p,a,b)[0] for a,b in segments))
    for p in curve:
        i=math.floor(p[-1]);segments=list(zip(original[max(0,i-2):min(len(original),i+4)],original[max(1,i-1):min(len(original),i+5)]))
        if segments:worst=max(worst,min(distance(p,a,b)[0] for a,b in segments))
    return worst



def normal_width(path,index,pixels,width,height):
    x,y=path[index]
    a,b=path[max(0,index-3)],path[min(len(path)-1,index+3)]
    dx,dy=b[0]-a[0],b[1]-a[1];norm=math.hypot(dx,dy)
    nx,ny=(-dy/norm,dx/norm) if norm else (0,1)
    values=[]
    for step in range(-32,33):
        px,py=x+nx*step/4,y+ny*step/4
        left,top=math.floor(px),math.floor(py);fx,fy=px-left,py-top
        alpha=0
        for xx,wx in [(left,1-fx),(left+1,fx)]:
            for yy,wy in [(top,1-fy),(top+1,fy)]:
                if 0<=xx<width and 0<=yy<height:alpha+=pixels[yy*width+xx][3]*wx*wy
        values.append(alpha)
    start=end=32
    while start>0 and values[start-1]>1:start-=1
    while end+1<len(values) and values[end+1]>1:end+=1
    peak=max(values[start:end+1])
    radius=sum(values[start:end+1])/4/max(1,peak)/2
    return max(.5,min(8,radius)),peak


def brush(curves,width,height,checkpoint=None):
    output={}
    for curve in curves:
        segments=list(zip(curve,curve[1:])) or [(curve[0],curve[0])]
        for position,(a,b) in enumerate(segments):
            if checkpoint and position%32==0:checkpoint()
            radius=max(a[2],b[2])+1
            for y in range(max(0,math.floor(min(a[1],b[1])-radius)),min(height,math.ceil(max(a[1],b[1])+radius))):
                for x in range(max(0,math.floor(min(a[0],b[0])-radius)),min(width,math.ceil(max(a[0],b[0])+radius))):
                    hits=0
                    for ox,oy in [(0.25,0.25),(0.75,0.25),(0.25,0.75),(0.75,0.75)]:
                        d,t=distance((x+ox,y+oy),a,b)
                        if d<=a[2]*(1-t)+b[2]*t:hits+=1
                    if not hits:continue
                    _,t=distance((x+.5,y+.5),a,b)
                    rgba=[round(a[c]*(1-t)+b[c]*t) for c in range(3,7)]
                    rgba[3]=round(rgba[3]*hits/4)
                    index=y*width+x
                    if rgba[3]>output.get(index,[0,0,0,0])[3]:output[index]=rgba
    return output


def propose(pixels,width,height,settings,protected=None,checkpoint=None):
    if type(width) is not int or type(height) is not int or not 1<=width<=256 or not 1<=height<=256 or len(pixels)!=width*height:raise ValueError('Cleanup expects bounded canvas-sized RGBA8 <=256px')
    if any(len(p)!=4 or any(type(c) is not int or not 0<=c<=255 for c in p) for p in pixels):raise ValueError('Expected RGBA8 source')
    settings=checked(settings,width,height);roi=settings['roi']
    protected=set(protected or [])|set(settings['keep_pixels'])
    if any(type(i) is not int or not 0<=i<width*height for i in protected):raise ValueError('Invalid persistent cleanup constraint')
    def check():
        if checkpoint:checkpoint()
    ink=[]
    for y in range(height):
        check()
        for p in pixels[y*width:(y+1)*width]:
            if settings['paper']=='white':
                if p[3]!=255:raise ValueError('White-paper cleanup requires opaque source; choose transparent for alpha ink')
                m=min(p[:3]);a=255-m
                ink.append([((c-m)*255+a//2)//a for c in p[:3]]+[a] if a else [0,0,0,0])
            else:ink.append(p[:])
    working=deepcopy(ink)
    inside=lambda p:roi[0]<=p[0]<roi[2] and roi[1]<=p[1]<roi[3]
    active={(i%width,i//width) for i,p in enumerate(ink) if p[3] and inside((i%width,i//width))}
    groups=components(active,True,checkpoint)
    if len(groups)>256:raise ValueError('Too many selected components for this bounded cleanup baseline')
    base_mask={(i%width,i//width) for i,p in enumerate(ink) if p[3]>=settings['threshold']}
    original_topology=topology(base_mask,width,height,checkpoint)
    records=[];warnings=[];removed=smoothed=refused=0
    if settings['paper']=='white':warnings.append('White-paper alpha is an explicit approximation, recomposed over white; off-white interpretation is not recovered.')
    if settings['max_remove_area']:warnings.append('Small area does not imply noise: intentional dots/details may be removed. Add keep-detail hints or set removal0.')
    for number,group in enumerate(groups):
        check();identity=fingerprint(sorted(group))[:16]
        if any(y*width+x in protected for x,y in group):
            records.append(dict(component_id=identity,status='preserved_artist_constraint',area=len(group)));continue
        if len(group)<=settings['max_remove_area']:
            for x,y in group:working[y*width+x]=[0,0,0,0]
            removed+=1;records.append(dict(component_id=identity,status='removed_by_explicit_area_setting',area=len(group)));continue
        if not settings['iterations'] or settings['max_shift']==0:continue
        core={p for p in group if ink[p[1]*width+p[0]][3]>=settings['threshold']}
        if not core:refused+=1;records.append(dict(component_id=identity,status='below_threshold_original_retained'));continue
        skeleton=thin(core,checkpoint)
        if not skeleton or len(skeleton)>1024:
            refused+=1;records.append(dict(component_id=identity,status='skeleton_empty_or_complex_original_retained'));continue
        distance_field=widths(core)
        if max(distance_field.values())>8:
            refused+=1;records.append(dict(component_id=identity,status='filled_or_thick_shape_original_retained'));continue
        traced=paths(skeleton)
        if len(traced)>128:refused+=1;records.append(dict(component_id=identity,status='too_many_branches_original_retained'));continue
        curves=[];path_records=[];anchors=[];changed=False;worst=0
        for path in traced:
            attributes=[]
            for j,(x,y) in enumerate(path):
                rgba=ink[y*width+x][:]
                radius,peak=normal_width(path,j,ink,width,height)
                rgba[3]=round(peak)
                attributes.append([x+.5,y+.5,radius]+[float(c) for c in rgba]+[float(j)])
            if len(path)>=5:
                curve,fixed=cut(attributes,settings['iterations'],settings['corner_angle'])
                shift=deviation(attributes,curve);worst=max(worst,shift)
                changed=changed or shift>1e-5
            else:curve,fixed,shift=attributes,attributes,0
            curves.append(curve);anchors.extend(fixed)
            path_records.append(dict(source_points=[p[:2] for p in attributes],curve=[p[:7] for p in curve],anchors=[p[:2] for p in fixed],sampled_deviation=shift,closed=len(path)>1 and path[0]==path[-1]))
        if worst>settings['max_shift']:
            refused+=1;records.append(dict(component_id=identity,status='displacement_limit_original_retained',sampled_deviation=worst));continue
        if not changed:continue
        width_scale=1.0  # Width is measured along local source normals.
        rendered=brush(curves,width,height,checkpoint)
        candidate=deepcopy(working)
        for x,y in group:candidate[y*width+x]=[0,0,0,0]
        for index,rgba in rendered.items():
            point=index%width,index//width
            if inside(point) and (point in group or ink[index][3]==0):candidate[index]=rgba
        # Fixed graph endpoints/junctions/corners and a two-pixel selection seam
        # band retain their ORIGINAL samples, not merely coincident vector nodes.
        fixed_indices=set(protected)
        for anchor in anchors:
            r=anchor[2]+settings['max_shift']+1
            for y in range(max(roi[1],math.floor(anchor[1]-r)),min(roi[3],math.ceil(anchor[1]+r))):
                for x in range(max(roi[0],math.floor(anchor[0]-r)),min(roi[2],math.ceil(anchor[0]+r))):
                    if math.hypot(x+.5-anchor[0],y+.5-anchor[1])<=r:fixed_indices.add(y*width+x)
        touches=any(x in {roi[0],roi[2]-1} or y in {roi[1],roi[3]-1} for x,y in group)
        if touches:
            for y in range(roi[1],roi[3]):
                for x in range(roi[0],roi[2]):
                    if min(x-roi[0],roi[2]-1-x,y-roi[1],roi[3]-1-y)<2:fixed_indices.add(y*width+x)
        for index in fixed_indices:candidate[index]=working[index][:]
        before={(i%width,i//width) for i,p in enumerate(working) if p[3]>=settings['threshold']}
        after={(i%width,i//width) for i,p in enumerate(candidate) if p[3]>=settings['threshold']}
        if topology(before,width,height,checkpoint)!=topology(after,width,height,checkpoint):
            refused+=1;records.append(dict(component_id=identity,status='topology_change_original_retained',paths=path_records));continue
        old_mass=sum(working[y*width+x][3] for x,y in group)
        new_support={(i%width,i//width) for i in rendered if inside((i%width,i//width))}|group
        new_mass=sum(candidate[y*width+x][3] for x,y in new_support if (x,y) in group or working[y*width+x][3]==0)
        mass_ratio=new_mass/max(1,old_mass)
        if not .8<=mass_ratio<=1.25:
            refused+=1;records.append(dict(component_id=identity,status='line_weight_guard_original_retained',opacity_mass_ratio=mass_ratio));continue
        working=candidate;smoothed+=1
        records.append(dict(component_id=identity,status='smoothed_candidate',area=len(group),paths=path_records,sampled_deviation=worst,selection_seam_preserved=touches,width_scale=width_scale,opacity_mass_ratio=mass_ratio))
    check()
    if settings['paper']=='white':working=source_over([[255,255,255,255] for _ in working],working)
    result=deepcopy(pixels)
    for y in range(roi[1],roi[3]):
        for x in range(roi[0],roi[2]):
            index=y*width+x
            if index not in protected:result[index]=working[index][:]
    for index in protected:result[index]=pixels[index][:]
    changed_indices=[i for i,(old,new) in enumerate(zip(pixels,result)) if old!=new]
    warnings += ['Contour smoothing and source-derived brush reconstruction do not infer intended strokes, construction-line meaning or anatomy. Pencil texture/pressure may change; compare the retained source.', 'Corner/deviation/topology checks are geometric guards, not calibrated artistic confidence. Parallel overdraw is not consolidated by this baseline.']
    if refused:warnings.append(f'{refused} components retained after threshold/complexity/displacement/topology guards.')
    return dict(pixels=result,settings=settings,components=records,changed_indices=changed_indices,protected_pixels=sorted(protected),warnings=warnings,metrics=dict(changed_pixels=len(changed_indices),smoothed_components=smoothed,removed_components=removed,refused_components=refused,topology_before=original_topology),method='selected-raster-skeleton-anchored-corner-cutting-baseline',version='0.1.0',source_ids=SOURCES[:],score_kind='uncalibrated_geometry')


def drawing_constraints(drawing):
    if 'protected_mask' in drawing:
        from engine.spatial_constraints import indices
        return indices(drawing,legacy_locked=True)
    if 'protected_pixels' in drawing:return drawing['protected_pixels'][:]
    return list(range(len(drawing['pixels']))) if drawing.get('locked') and drawing.get('origin')=='artist_correction' else []


def subject(project,layer_id,slot,settings):
    validate(project);validate_layers(project)
    checked(settings,project['canvas']['width'],project['canvas']['height'])
    if project['layers'][layer_id].get('nodetype','paintlayer')!='paintlayer':raise ValueError('Select a raster layer for cleanup')
    exposure=next(e for e in project['exposures'] if e['layer_id']==layer_id and e['start']<=slot<e['start']+e['length'])
    nodes={};parent=layer_id
    while parent is not None:
        node=project['layers'][parent]
        if node.get('locked',False) or not node.get('visible',True):raise ValueError('Cleanup source layer and ancestors must be visible/unlocked')
        nodes[parent]=node;parent=node.get('parent_id')
    keys={'layer:'+i for i in nodes}
    data=dict(project_id=project['project_id'],originals_sha256=project['originals_sha256'],canvas=project['canvas'],shot=project['shot'],exposure=exposure,drawing=project['drawings'][exposure['drawing_id']],nodes=nodes,epochs={k:project.get('dependency_epochs',{}).get(k,0) for k in sorted(keys)})
    return fingerprint(data),exposure


def accept_cleanup(project,result,layer_id,slot,drawing_id):
    _,exposure=subject(project,layer_id,slot,result['settings'])
    if drawing_id in project['drawings']:raise ValueError('Cleanup version identity must be new')
    if not result['changed_indices']:raise ValueError('No pixel changes to accept; retain source or adjust the selected operation')
    source=project['drawings'][exposure['drawing_id']]
    for i in drawing_constraints(source):
        if result['pixels'][i]!=source['pixels'][i]:raise ValueError('Cleanup cannot discard an artist correction')
    updated=deepcopy(project)
    updated['drawings'][drawing_id]=dict(pixels=deepcopy(result['pixels']),origin='reviewed_cleanup',approved=True,locked=bool(result['protected_pixels']),protected_pixels=result['protected_pixels'][:],parent_drawing=exposure['drawing_id'])
    next(e for e in updated['exposures'] if e==exposure)['drawing_id']=drawing_id
    operation=dict(input_drawing=exposure['drawing_id'],input_sha256=fingerprint(source),drawing_id=drawing_id,layer_id=layer_id,start=exposure['start'],length=exposure['length'],settings=deepcopy(result['settings']),method=result['method'],version=result['version'],source_ids=result['source_ids'][:],warnings=result['warnings'][:],components=deepcopy(result['components']),changed_indices=result['changed_indices'][:],score_kind='uncalibrated_geometry')
    updated.setdefault('cleanup_operations',[]).append(operation)
    changed=set(result['changed_indices'])
    for identity,region in updated.get('fill_regions',{}).items():
        if region['ink_layer']==layer_id and max(region['start'],exposure['start'])<min(region['start']+region['length'],exposure['start']+exposure['length']):
            from engine.regions import managed_pixels
            covered,_=managed_pixels(project,identity)
            if changed&set(covered):region['geometry_status']='source_changed_cleanup_review'
    updated['revision']+=1;updated['history'].append(dict(action='accept-selected-cleanup',drawing_id=drawing_id,input_drawing=exposure['drawing_id']))
    validate(updated);validate_layers(updated)
    return updated
