const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const parent='portfolio/review/20261017-hero-sketch-study/compact-frame-revision',dest='portfolio/review/20261017-reader-large-text/preview-revision';
if(fs.existsSync(dest))throw Error('Destination exists');
const manifest=JSON.parse(fs.readFileSync(parent+'/canonical-route-manifest.json'));
for(const f of manifest.files)if(sha(fs.readFileSync(f.path))!==f.sha256)throw Error('Route changed: '+f.route);
for(const i of manifest.inputs)if(sha(fs.readFileSync(i.path))!==i.sha256)throw Error('Input changed');
const before=JSON.stringify(manifest.files),desk=manifest.files.find(f=>f.route==='/stories/alternate-1404/desk.css');
if(!desk)throw Error('Missing desk route');
fs.mkdirSync(dest);const css=fs.readFileSync(desk.path);
fs.writeFileSync(dest+'/desk.before.css',css);
fs.writeFileSync(dest+'/desk.css',Buffer.concat([css,Buffer.from('\r\n'),fs.readFileSync('portfolio/review/20261017-reader-large-text/mobile-paper.proposed.css')]));
desk.path=path.resolve(dest+'/desk.css').replaceAll('\\','/');desk.sha256=sha(fs.readFileSync(desk.path));
assertOneRoute();function assertOneRoute(){const old=JSON.parse(before);if(manifest.files.filter((f,i)=>JSON.stringify(f)!==JSON.stringify(old[i])).length!==1)throw Error('Unexpected delta');}
manifest.revision='mobile-paper';manifest.updated=new Date().toISOString();
fs.writeFileSync(dest+'/canonical-route-manifest.json',JSON.stringify(manifest,null,2));
fs.copyFileSync(parent+'/serve-canonical-preview.mjs',dest+'/serve-canonical-preview.mjs');
fs.writeFileSync(dest+'/START-HERE.txt','Local preview http://127.0.0.1:4228/stories/alternate-1404/#chapter-1\r\nOnly desk.css gains a screen<=420px margin rule relative to compact-frame predecessor. Original159 routes and4input hashes checked. No manuscript/source/public/backend changes. Not portable without pinned references.\r\n');
console.log('Prepared local-only mobile-paper revision; exactly one CSS route differs.');
