"""Assemble browser pixels beside unchanged reference pixels; no final art textures."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
board=Image.new('RGB',(1400,1130),'#fffaf0');d=ImageDraw.Draw(board)
d.text((30,22),'Original sailor drawing / provisional circular-head 3D study',font=font,fill='#282c30')
original=Image.open(root/'references/NewCanvas3.png').convert('RGB')
rect=(430,850,2810,3230)
crop=original.crop(rect);crop.thumbnail((270,270),Image.Resampling.LANCZOS)
board.paste(crop,(80,80));front=Image.open(root/'review/front-clean.png').convert('RGB');board.paste(front,(455,65))
d.text((35,492),'NewCanvas3 · manual rectangular reference crop',font=small,fill='#282c30')
d.text((465,492),'Current 3D · neutral / flat / front',font=small,fill='#282c30')
for i,line in enumerate(['Approximate comparable head width;','circle changes the head aspect ratio.','Brown palette follows Artist records;','original olive/yellow is older evidence.','','Observed: sleepy eyes, uneven fringe,','leaf tuft, navy collar, red tie, tiny feet.','','Inferred: depth, ears, back hair/collar,','hidden limbs, hand shape and gait.','','Owner judges likeness. No approval','or superiority of 2D/3D is claimed.']):d.text((955,90+i*26),line,font=small,fill='#282c30')
sheet=Image.open(root/'review/eight-views.png').convert('RGB');sheet.thumbnail((1320,572),Image.Resampling.LANCZOS);board.paste(sheet,(35,535));board.save(root/'review/original-and-eight.png')
rig=Image.new('RGB',(1250,600),'#fffaf0');r=ImageDraw.Draw(rig);r.text((20,12),'Editable walk phases / expressions · provisional motion, same camera and scale',font=font,fill='#282c30')
for i in range(4):rig.paste(Image.open(root/f'review/walk-{i}.png').convert('RGB'),(i*300,45));r.text((i*300+10,300),f'Walk phase {i} · 45 degrees',font=small,fill='#282c30')
for i,label in enumerate(['neutral','happy','surprised']):rig.paste(Image.open(root/f'review/expression-{i}.png').convert('RGB'),(i*300,330));r.text((i*300+250,435),label,font=small,fill='#282c30')
rig.save(root/'review/rig-and-expressions.png')
record={'crop':{'source':'references/NewCanvas3.png','rectLTRB':rect,'sourceSize':original.size,'method':'Manual rectangular selection; uniformly resized for comparison, no retouching or geometry tracing.'},'inputHashes':{str(p.relative_to(root)):sha(p) for p in [root/'references/NewCanvas3.png',root/'review/front-clean.png',root/'review/eight-views.png']},'outputHash':sha(root/'review/original-and-eight.png')}
(root/'review/comparison-provenance.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print('Comparison and rig boards assembled from browser captures and supplied reference.')
