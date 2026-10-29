"""Original abstract three-part character and sheet; no external art."""
from engine.project import create
from engine.fill import defaults,propose,accept_fill
from engine.regions import propose_additional,accept_additional
from engine.references import add_reference,edit_reference
from engine.io.png_codec import encode_png

BOXES={'cap':[16,4,40,18],'coat':[12,23,44,44],'shoes':[18,49,38,61]}
COLORS={'cap':[220,75,45,255],'coat':[45,125,210,255],'shoes':[65,155,95,255]}
def fixture():
    w=h=64;pixels=[[0,0,0,0] for _ in range(w*h)]
    for b in BOXES.values():
        for y in range(b[1],b[3]):
            for x in range(b[0],b[2]):
                if x in {b[0],b[2]-1} or y in {b[1],b[3]-1}:pixels[y*w+x]=[30,35,45,255]
    p=create(pixels,w,h,12);p['exposures']=[dict(layer_id='ink',drawing_id='source',start=0,length=4),dict(layer_id='ink',drawing_id='source',start=4,length=8)]
    for index,(role,b) in enumerate(BOXES.items()):
        settings=defaults([(b[0]+b[2])//2,(b[1]+b[3])//2],[150,150,150,255],'unassigned')
        if index==0:p,_=accept_fill(p,propose(pixels,w,h,settings),'ink',0,role)
        else:p,_=accept_additional(p,propose_additional(p,'cap',settings),'cap',role)
    return p

def sheet():
    pixels=[[77,12,200,0] for _ in range(128*64)]
    for offset,colors in [(0,COLORS),(64,dict(COLORS,cap=[240,210,60,255],coat=[145,60,180,255]))]:
        for role,b in BOXES.items():
            for y in range(b[1],b[3]):
                for x in range(b[0],b[2]):pixels[y*128+x+offset]=colors[role][:]
    return encode_png(128,64,pixels)

def with_reference(p,identity='front',view='front',offset=0):
    data=sheet();p=add_reference(p,identity,'Original diagnostic sheet','hero',view,data)
    p=edit_reference(p,identity,crop=[offset,0,offset+64,64])
    for role,b in BOXES.items():p=edit_reference(p,identity,part_id=role,bbox=[b[0]+offset,b[1],b[2]+offset,b[3]],swatch=[(b[0]+b[2])//2+offset,(b[1]+b[3])//2])
    return p

def request(region='cap',view='front',override=None,use=True):return dict(region_id=region,character_id='hero',view=view,target_bounds=[0,0,64,64],part_override=override,use_references=use,propagate_bound=False)
