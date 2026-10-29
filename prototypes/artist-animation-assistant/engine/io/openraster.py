"""Independent layered ORA interchange: REF-ORA-LAYOUT/STACK/SELECTION, REF-PNG.

Standard artwork is separate from a hash-bound authoritative assistant project.
External artwork edits cannot silently restore obsolete embedded project state.
"""
import base64
from copy import deepcopy
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
import math
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET
import zipfile

from engine.project import validate, fingerprint
from engine.layers import validate_layers, render, visible
from engine.io.png_codec import encode_png, read_png


class StaleEmbeddedProject(ValueError):
    pass


def _digest(data):
    return hashlib.sha256(data).hexdigest()


def _check(project):
    validate(project)
    validate_layers(project)
    if max(project['canvas']['width'],project['canvas']['height'])>256 or len(project['drawings'])>64 or project['shot']['duration_frames']>600:
        raise ValueError('Interchange exceeds current document bounds')
    fps=project['shot']['fps']
    if set(fps)!={'numerator','denominator'} or not 1<=fps['numerator']/fps['denominator']<=120:
        raise ValueError('Invalid interchange frame rate')
    for key in ['native_source','ora_source','png_source']:
        if key in project:
            record=project[key]
            data=base64.b64decode(record['encoded_base64' if key=='png_source' else 'archive_base64'],validate=True)
            if len(data)>4*1024*1024 or _digest(data)!=record['sha256']:
                raise ValueError('Retained source archive identity changed')
    return project


def _artwork(project,slot,selected):
    _check(project)
    if type(slot) is not int or not 0<=slot<project['shot']['duration_frames']:
        raise ValueError('Export slot outside clip')
    width,height=project['canvas']['width'],project['canvas']['height']
    resolution=project['canvas'].get('resolution',{'x':72,'y':72})
    if any(type(resolution[k]) not in {int,float} or not math.isfinite(resolution[k]) or not float(resolution[k]).is_integer() or not 1<=resolution[k]<=100000 for k in ['x','y']):
        raise ValueError('ORA requires integer document resolution; no silent rounding')
    image=ET.Element('image',version='0.0.6',w=str(width),h=str(height),name=project['project_id'],xres=str(int(resolution['x'])),yres=str(int(resolution['y'])))
    stack=ET.SubElement(image,'stack')
    members,bindings={},[]
    paints=validate_layers(project)
    if selected not in paints or not visible(project,selected):
        selected=next((i for i in paints if visible(project,i)),paints[0])
    def walk(parent,element):
        siblings=[(i,l) for i,l in project['layers'].items() if l.get('parent_id')==parent]
        for identity,layer in sorted(siblings,key=lambda pair:pair[1].get('order',0)):
            attributes={'name':layer['name'],'opacity':format(float(Decimal(str(layer.get('opacity',255)))/255),'.17g'),'visibility':'visible' if layer.get('visible',True) else 'hidden','composite-op':'svg:src-over'}
            kind=layer.get('nodetype','paintlayer')
            binding={'layer_id':identity,'kind':kind,'parent_id':parent}
            bindings.append(binding)
            if kind=='grouplayer':
                node=ET.SubElement(element,'stack',isolation=layer.get('isolation','isolate'),**attributes)
                walk(identity,node)
            else:
                exposure=next(e for e in project['exposures'] if e['layer_id']==identity and e['start']<=slot<e['start']+e['length'])
                filename=f'data/layer-{len(bindings):03d}.png'
                attributes.update(src=filename,x='0',y='0')
                if identity==selected:
                    attributes['selected']='true'
                ET.SubElement(element,'layer',attributes)
                members[filename]=encode_png(width,height,project['drawings'][exposure['drawing_id']]['pixels'])
                binding.update(drawing_id=exposure['drawing_id'],src=filename)
    walk(None,stack)
    members['stack.xml']=ET.tostring(image,encoding='utf-8',xml_declaration=True)
    projection=encode_png(width,height,render(project,slot))
    members['mergedimage.png']=projection
    members['Thumbnails/thumbnail.png']=projection
    return members,bindings,selected


def write_ora(project,path,slot=0,selected_layer=None,embed_project=True):
    members,bindings,selected=_artwork(project,slot,selected_layer)
    if embed_project:
        encoded=json.dumps(project,indent=2,ensure_ascii=False,allow_nan=False).encode('utf-8')
        if len(encoded)>32*1024*1024:
            raise ValueError('Embedded project exceeds32MiB')
        members['assistant/project.json']=encoded
        manifest={'schema_version':'1.0','format':'artist-assistant-ora-1','project_fingerprint':fingerprint(project),'slot':slot,'selected_layer_id':selected,'layer_bindings':bindings,'member_sha256':{name:_digest(data) for name,data in members.items()}}
        members['assistant/manifest.json']=json.dumps(manifest,indent=2,ensure_ascii=False,allow_nan=False).encode('utf-8')
    if sum(map(len,members.values()))>64*1024*1024:
        raise ValueError('Interchange expanded data exceeds64MiB')
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        archive.writestr('mimetype',b'image/openraster',compress_type=zipfile.ZIP_STORED)
        for name,data in members.items():
            archive.writestr(name,data,compress_type=zipfile.ZIP_DEFLATED)
    data=output.getvalue()
    if len(data)>4*1024*1024:
        raise ValueError('ORA exceeds current4MiB file bound')
    with Path(path).open('xb') as stream:
        stream.write(data)
    return {'path':Path(path).name,'sha256':_digest(data),'slot':slot,'layer_count':len(project['layers']),'embedded_project':embed_project}


def import_ora(path,prefer_project=True):
    path=Path(path)
    if path.stat().st_size>4*1024*1024:
        raise ValueError('ORA exceeds current4MiB file bound')
    with path.open('rb') as stream:
        data=stream.read(4*1024*1024+1)
    if len(data)>4*1024*1024:
        raise ValueError('ORA exceeds current4MiB file bound')
    digest=_digest(data)
    project={'schema_version':'0.1','project_id':path.stem,'revision':0,'layers':{},'drawings':{},'exposures':[],'proposals':{},'history':[]}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names=archive.namelist()
        if not names or names[0]!='mimetype' or len(names)>512 or len(names)!=len(set(names)) or sum(i.file_size for i in archive.infolist())>64*1024*1024:
            raise ValueError('Invalid/excessive ORA archive layout')
        for name in names:
            parts=PurePosixPath(name)
            if parts.is_absolute() or '..' in parts.parts or '\\' in name or ':' in name or archive.getinfo(name).compress_type not in {zipfile.ZIP_DEFLATED,zipfile.ZIP_STORED}:
                raise ValueError('Unsupported ORA path/compression')
        def bounded(name,limit=2*1024*1024):
            if archive.getinfo(name).file_size>limit:
                raise ValueError('ORA member exceeds size bound')
            return archive.read(name)
        if archive.getinfo('mimetype').compress_type!=zipfile.ZIP_STORED or bounded('mimetype')!=b'image/openraster':
            raise ValueError('Invalid ORA mimetype')
        xml=bounded('stack.xml')
        if b'<!ENTITY' in xml.upper():
            raise ValueError('ORA XML entity declarations unsupported')
        image=ET.fromstring(xml)
        if image.tag!='image' or len(image)!=1 or image[0].tag!='stack':
            raise ValueError('Unsupported ORA root structure')
        width,height=int(image.get('w','0')),int(image.get('h','0'))
        if not 1<=width<=256 or not 1<=height<=256:
            raise ValueError('ORA canvas outside current bounds')
        xr,yr=int(image.get('xres','72')),int(image.get('yres','72'))
        if not 1<=xr<=100000 or not 1<=yr<=100000 or ('xres' in image.attrib)!=('yres' in image.attrib):
            raise ValueError('Invalid ORA resolution')
        if image[0].attrib:
            raise ValueError('ORA root stack cannot have layer attributes')
        project['canvas']={'width':width,'height':height,'color_profile':'sRGB','alpha_mode':'straight','resolution':{'x':xr,'y':yr}}
        project['shot']={'id':'ora-still','fps':{'numerator':24,'denominator':1},'duration_frames':1}
        order_nodes=[]
        selected=None
        clipped=0
        def walk(parent,element,depth=0):
            nonlocal selected,clipped
            if depth>12:
                raise ValueError('ORA hierarchy too deep')
            for order,node in enumerate(element):
                if len(project['layers'])>=32 or node.tag not in {'stack','layer'}:
                    raise ValueError('Unsupported/excessive ORA layers or filters')
                allowed={'name','opacity','visibility','composite-op','isolation','x','y'} if node.tag=='stack' else {'name','opacity','visibility','composite-op','src','x','y','selected'}
                if set(node.attrib)-allowed or node.get('composite-op','svg:src-over')!='svg:src-over' or (node.tag=='stack' and node.get('isolation','isolate') not in {'isolate','auto'}):
                    raise ValueError('Unsupported ORA blend/isolation/extension')
                try:
                    opacity=float(Decimal(node.get('opacity','1'))*255)
                except (InvalidOperation,OverflowError) as error:
                    raise ValueError('Invalid ORA opacity') from error
                visibility=node.get('visibility','visible')
                if not math.isfinite(opacity) or not 0<=opacity<=255 or visibility not in {'visible','hidden'}:
                    raise ValueError('Invalid ORA opacity/visibility')
                identity=f'ora-{digest[:12]}-{len(project["layers"]):03d}'
                kind='grouplayer' if node.tag=='stack' else 'paintlayer'
                project['layers'][identity]={'name':node.get('name','Layer'),'nodetype':kind,'parent_id':parent,'order':order,'visible':visibility=='visible','locked':False,'opacity':opacity,'native_attributes':dict(node.attrib)}
                order_nodes.append((identity,node))
                if kind=='grouplayer':
                    project['layers'][identity]['isolation']=node.get('isolation','isolate')
                    walk(identity,node,depth+1)
                    continue
                if len(node):
                    raise ValueError('Unsupported ORA layer children')
                filename=node.get('src','')
                if filename not in names or filename in {'stack.xml','mimetype'}:
                    raise ValueError('ORA raster reference missing/invalid')
                w,h,pixels=read_png(bounded(filename))
                x,y=int(node.get('x','0')),int(node.get('y','0'))
                canvas=[[0,0,0,0] for _ in range(width*height)]
                for py in range(h):
                    for px in range(w):
                        if 0<=px+x<width and 0<=py+y<height:
                            canvas[(py+y)*width+px+x]=pixels[py*w+px]
                        elif pixels[py*w+px][3]:
                            clipped+=1
                drawing=identity+':source'
                project['drawings'][drawing]={'pixels':canvas,'origin':'artist','approved':True,'locked':True}
                project['exposures'].append({'layer_id':identity,'drawing_id':drawing,'start':0,'length':1})
                if node.get('selected','false') not in {'false','true','0','1'}:
                    raise ValueError('Invalid ORA selected-layer value')
                if node.get('selected') in {'true','1'} and selected is None:
                    selected=identity
        walk(None,image[0])
        # Required preview files are decoded but do not replace actual layers.
        for name in ['mergedimage.png','Thumbnails/thumbnail.png']:
            pw,ph,_=read_png(bounded(name))
            if name=='mergedimage.png' and (pw,ph)!=(width,height):
                raise ValueError('ORA merged projection bounds differ from canvas')
        project['originals']=deepcopy(project['drawings'])
        project['originals_sha256']=fingerprint(project['originals'])
        project['ora_source']={'filename':path.name,'sha256':digest,'archive_base64':base64.b64encode(data).decode('ascii'),'image_attributes':dict(image.attrib),'clipped_nontransparent_pixels':clipped,'source_ids':['REF-ORA-LAYOUT','REF-ORA-STACK','REF-ORA-SELECTION','REF-PNG']}
        _check(project)
        metadata_present='assistant/manifest.json' in names or 'assistant/project.json' in names
        if prefer_project and metadata_present:
            try:
                manifest=json.loads(bounded('assistant/manifest.json'))
                original=json.loads(bounded('assistant/project.json',32*1024*1024))
                _check(original)
                if manifest['format']!='artist-assistant-ora-1' or manifest['schema_version']!='1.0' or fingerprint(original)!=manifest['project_fingerprint']:
                    raise ValueError('Invalid authoritative project identity')
                required=set(names)-{'mimetype','assistant/manifest.json'}
                if set(manifest['member_sha256'])!=required or any(_digest(bounded(name,32*1024*1024))!=value for name,value in manifest['member_sha256'].items()):
                    raise ValueError('Artwork/member identity changed')
                _,bindings,_=_artwork(original,manifest['slot'],manifest['selected_layer_id'])
                if bindings!=manifest['layer_bindings'] or len(bindings)!=len(order_nodes) or original['canvas']['width']!=width or original['canvas']['height']!=height:
                    raise ValueError('Embedded project/layer binding mismatch')
                resolution=original['canvas'].get('resolution',{'x':72,'y':72})
                if resolution['x']!=xr or resolution['y']!=yr or original['project_id']!=image.get('name') or read_png(bounded('mergedimage.png'))[2]!=render(original,manifest['slot']):
                    raise ValueError('Embedded project resolution/title/projection differs from artwork')
                mapping={binding['layer_id']:parsed_id for binding,(parsed_id,node) in zip(bindings,order_nodes)}
                for binding,(parsed_id,node) in zip(bindings,order_nodes):
                    layer=original['layers'][binding['layer_id']]
                    parsed=project['layers'][parsed_id]
                    if binding['kind']!=parsed['nodetype'] or mapping.get(binding['parent_id'])!=parsed['parent_id'] or layer['name']!=parsed['name'] or layer.get('visible',True)!=parsed['visible'] or layer.get('isolation','isolate')!=parsed.get('isolation','isolate') or not math.isclose(layer.get('opacity',255),parsed['opacity'],rel_tol=0,abs_tol=1e-10):
                        raise ValueError('Embedded project structure differs from artwork')
                    if binding['kind']=='paintlayer':
                        pixels=project['drawings'][parsed_id+':source']['pixels']
                        if node.get('src')!=binding['src'] or pixels!=original['drawings'][binding['drawing_id']]['pixels']:
                            raise ValueError('Embedded project pixels differ from artwork')
                return {'project':original,'selected_layer_id':manifest['selected_layer_id'],'slot':manifest['slot'],'metadata_state':'restored_verified','warnings':[]}
            except (ValueError,KeyError,TypeError,RecursionError) as error:
                raise StaleEmbeddedProject('Embedded project no longer matches artwork; import artwork-only explicitly to keep external edits') from error
        paints=validate_layers(project)
        if selected not in paints or not visible(project,selected):
            selected=next((i for i in paints if visible(project,i)),paints[0])
        warnings=[]
        if metadata_present:
            warnings.append('Embedded assistant history/timing not applied: explicit artwork-only import')
        if clipped:
            warnings.append(f'{clipped} off-canvas pixels remain recoverable in original archive; editable canvas is cropped')
        return {'project':project,'selected_layer_id':selected,'slot':0,'metadata_state':'artwork_only' if metadata_present else 'plain_ora_still','warnings':warnings}


def export_bundle(project,directory,selected_layer=None,selected_slot=0):
    _check(project)
    cuts=sorted({e['start'] for e in project['exposures']})
    if len(cuts)>64:
        raise ValueError('Current layered bundle supports at most64global drawing cuts')
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=False)
    encoded=json.dumps(project,indent=2,ensure_ascii=False,allow_nan=False).encode('utf-8')
    if len(encoded)>32*1024*1024:
        raise ValueError('Project sidecar exceeds32MiB')
    (directory/'project.aaa.json').write_bytes(encoded)
    editable=write_ora(project,directory/'project.ora',selected_slot,selected_layer,embed_project=True)
    frames=directory/'frames'
    frames.mkdir()
    exposures=[]
    for i,start in enumerate(cuts):
        filename=f'frame-{start:04d}.ora'
        report=write_ora(project,frames/filename,start,selected_layer,embed_project=False)
        end=cuts[i+1] if i+1<len(cuts) else project['shot']['duration_frames']
        exposures.append({'file':'frames/'+filename,'start':start,'length':end-start,'sha256':report['sha256']})
    manifest={'schema_version':'1.0','fps':deepcopy(project['shot']['fps']),'duration_frames':project['shot']['duration_frames'],'project_fingerprint':fingerprint(project),'project_file':'project.aaa.json','project_sha256':_digest(encoded),'editable_project_file':'project.ora','editable_project_sha256':editable['sha256'],'exposures':exposures,'fidelity':'Frame ORAs are editable layered stills; project.ora embeds a bound full project; timing, IDs, approvals and history also live in project.aaa.json and this schedule','source_ids':['REF-ORA-LAYOUT','REF-ORA-STACK','REF-ORA-SELECTION','REF-PNG','REF-COMPOSITING']}
    (directory/'animation.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return manifest
