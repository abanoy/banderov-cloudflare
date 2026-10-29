const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const source='portfolio/review/20261020-gallery-filter-counts',root='portfolio/review/20261020-gallery-return-link',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),report=JSON.parse(fs.readFileSync(root+'/report.json'));
assert(report.passed&&report.cases.length===4);assert(!fs.existsSync(root+'/canonical-route-manifest.json'));
const m=JSON.parse(fs.readFileSync(source+'/canonical-route-manifest.json'));
for(const f of [...m.files,...m.inputs])assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
const changed=[];
for(const f of m.files){const name=['/gallery/','/gallery/index.html'].includes(f.route)?'gallery.html':f.route==='/gallery/desk.css'?'desk.css':null;if(name){f.path=path.resolve(root,name).replaceAll('\\','/');f.sha256=sha(fs.readFileSync(f.path));changed.push(f.route);}}
assert.equal(changed.length,3);assert.equal(sha(fs.readFileSync(root+'/gallery.html')),report.proposal.htmlSha256);assert.equal(sha(fs.readFileSync(root+'/desk.css')),report.proposal.cssSha256);
fs.writeFileSync(root+'/canonical-route-manifest.json',JSON.stringify(m,null,2));
for(const name of ['serve-canonical-preview.mjs','open-preview.mjs','OPEN-PREVIEW.cmd'])fs.copyFileSync(source+'/'+name,root+'/'+name);
fs.writeFileSync(root+'/START-HERE.txt','Local gallery proposal with category counts and native footer return link.\r\nhttp://127.0.0.1:4240/gallery/\r\nOPEN-PREVIEW.cmd or Node open-preview.mjs reuses only matching HTML/JS/CSS, or starts saved server on refused connection. --check validates files only.\r\nMain4228 remains unchanged. Older count-only archive preserved in ../20261020-gallery-filter-counts; its launcher will refuse this newer response rather than overwrite it.\r\nNo public integration, API proxy, install, deployment or account action. Existing bundled Node path is machine-specific.\r\n');
fs.writeFileSync(root+'/integration.json',JSON.stringify({at:new Date().toISOString(),changed,unchangedRoutes:m.files.length-changed.length,inputs:m.inputs.length,source,scope:'Prepared only; existing proposal must be deliberately stopped before starting this exact saved server on same4240.'},null,2));
console.log(JSON.stringify({prepared:true,changed,unchangedRoutes:m.files.length-3}));
