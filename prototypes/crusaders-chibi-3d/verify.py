from pathlib import Path
import hashlib,json,zipfile
from PIL import Image
root=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
record=json.loads((root/'review/package-size.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(root/'chibi-3d-review.zip')as z:
 assert len(z.namelist())==11
 for file in record['reviewRuntimeFiles']:
  data=z.read(file['path']);assert data==(root/file['path']).read_bytes()==(root/'dist'/file['path']).read_bytes()
  assert len(data)==file['bytes'] and hashlib.sha256(data).hexdigest()==file['sha256']
 assert sum(len(z.read(n))for n in z.namelist())==record['reviewRuntimeBytes']<20_000_000
provenance=json.loads((root/'provenance.json').read_text(encoding='utf-8'))
for row in provenance['files']:
 if row.get('copy'):assert sha(root/row['copy'])==row['copySha256']
 if not (row.get('copy') or '').startswith('snapshots/'):
  assert sha(Path(row['original']))==row['originalSha256']
  if row.get('copy'):assert row['copySha256']==row['originalSha256']
background=Image.open(root/'review/fixed-background.png').convert('RGB')
for size in [32,64,96,160]:
 image=Image.open(root/f'review/fixed-{size}.png').convert('RGB');outside=0
 for y in range(220):
  for x in range(240):
   if not (60<=x<=180 and 28<=y<=195):outside+=image.getpixel((x,y))!=background.getpixel((x,y))
 assert outside==0
report={'packageFiles':11,'runtimeBytes':record['reviewRuntimeBytes'],'adapterBytes':record['adapterRuntimeBytes'],'provenanceFilesVerified':len(provenance['files']),'fixedCameraOutsideUnionChangedPixels':[0,0,0,0]}
(root/'review/integrity-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
