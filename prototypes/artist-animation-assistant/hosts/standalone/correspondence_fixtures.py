"""Original asymmetric textured patch/endpoint pair; no external image assets."""
from copy import deepcopy
from engine.project import create,fingerprint
from engine.spatial_constraints import uniform


def fixture(packed=False,width=80,height=80,offset=(0,0),duplicate=False,occluded=False):
    ox,oy=offset;source={};target={}
    for dy in range(-3,4):
        for dx in range(-3,4):
            pixel=[(dx*31+dy*17+140)%256,(dy*43+dx*11+80)%256,(dx*dx*19+dy*29+120)%256,128 if (dx+dy)%3==0 else 255]
            source[(oy+30+dy)*width+ox+30+dx]=pixel[:]
            if not occluded:target[(oy+35+dy)*width+ox+37+dx]=pixel[:]
            if duplicate:target[(oy+35+dy)*width+ox+17+dx]=pixel[:]
    a=uniform(width,height).with_edits(source);b=uniform(width,height).with_edits(target)
    if not packed:a=a.materialize();b=b.materialize()
    p=create(a,width,height,12);p['drawings']['end']=dict(pixels=b,origin='artist',approved=True,locked=True);p['originals']['end']=deepcopy(p['drawings']['end']);p['originals_sha256']=fingerprint(p['originals'])
    p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=8),dict(layer_id='ink',drawing_id='end',start=8,length=4)]
    p['motion_guides']={'patch':dict(name='Original translated texture',actor_id='ink',source_slot=0,guide_slot=8,roi=[ox+10,oy+10,ox+60,oy+60],handles=[dict(id='pattern',source=[ox+30.5,oy+30.5],target=[ox+30.5,oy+30.5],enabled=True)])}
    return p
