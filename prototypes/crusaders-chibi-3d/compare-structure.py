from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19)
out=Image.new('RGB',(1200,1160),'#fffaf0');d=ImageDraw.Draw(out)
d.text((15,12),'Before: first volume study (same camera and model height)',font=font,fill='#282c30')
out.paste(Image.open(root/'review/before-structure/eight-views.png').convert('RGB'),(0,45))
d.text((15,585),'Current: defined cheek/chin/skull depth, larger sleepy eyes, softened torso',font=font,fill='#282c30')
out.paste(Image.open(root/'review/eight-views.png').convert('RGB'),(0,620))
out.save(root/'review/structure-before-after.png')
