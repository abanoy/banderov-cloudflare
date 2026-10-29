"""Original dense scarf action, reused geometric authoring only; no owner art."""
from copy import deepcopy
from engine.project import create,fingerprint
from engine.io.project_archive import PixelPlane
from engine.schedules import save_constraints
from hosts.standalone.motion_fixtures import pose,INK

def fixture():
    duration=24;w,h=128,160;progress=[0,.04,.12,.3,.6,.85,1,1,.8,.6,.5,.5];drawings={};originals={};exposures=[]
    for index,t in enumerate(progress):
        pixels=pose(t)
        for layer in ('ink','paint'):
            values=[p if (p==INK)==(layer=='ink') else [0,0,0,0] for p in pixels];did=layer+'-'+str(index);drawing=dict(pixels=PixelPlane.from_pixels(w,h,values),origin='artist' if index in (0,10) else 'reviewed_landmark_motion',approved=True,locked=index in (0,10));drawings[did]=drawing
            if index in (0,10):originals[did]=deepcopy(drawing)
            exposures.append(dict(layer_id=layer,drawing_id=did,start=index*2,length=2))
    p=create(drawings['paint-0']['pixels'],w,h,duration);p.update(project_id='original-dense-scarf-timing',drawings=drawings,originals=originals,originals_sha256=fingerprint(originals),exposures=exposures,layers=dict(actor=dict(name='Original scarf actor',nodetype='grouplayer',visible=True,locked=False,isolation='isolate'),ink=dict(name='Scarf ink',parent_id='actor',order=0,visible=True,locked=False),paint=dict(name='Scarf colors',parent_id='actor',order=1,visible=True,locked=False)))
    return save_constraints(p,'actor',dict(required_slots=[],events=[dict(id='extension',label='Required extension hold',kind='extension',slot=12,length=4)]))
