const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const parent='portfolio/review/20261017-reader-large-text/preview-revision',root='portfolio/review/20261017-gallery-restore-order',dest=root+'/preview-revision';
if(fs.existsSync(dest))throw Error('Revision exists');
const m=JSON.parse(fs.readFileSync(parent+'/canonical-route-manifest.json'));
for(const f of m.files)if(sha(fs.readFileSync(f.path))!==f.sha256)throw Error('Route changed');
for(const i of m.inputs)if(sha(fs.readFileSync(i.path))!==i.sha256)throw Error('Input changed');
const aliases=m.files.filter(f=>['/gallery/','/gallery/index.html'].includes(f.route));if(aliases.length!==2)throw Error('Unexpected gallery aliases');
const original=fs.readFileSync(aliases[0].path,'utf8');if(fs.readFileSync(aliases[1].path,'utf8')!==original)throw Error('Aliases differ');
const addition='<script src="/gallery/restore-order.js" defer></script>';
if(original.includes(addition)||!original.includes('</head>'))throw Error('Unexpected source');
const html=original.replace('</head>',addition+'</head>');if(html.replace(addition,'')!==original)throw Error('Inverse mismatch');
fs.mkdirSync(dest);fs.writeFileSync(dest+'/gallery.before.html',original);fs.writeFileSync(dest+'/gallery.html',html);fs.copyFileSync(root+'/restore-order.js',dest+'/restore-order.js');
for(const f of aliases){f.path=path.resolve(dest+'/gallery.html').replaceAll('\\','/');f.sha256=sha(fs.readFileSync(f.path));}
m.files.push({route:'/gallery/restore-order.js',path:path.resolve(dest+'/restore-order.js').replaceAll('\\','/'),sha256:sha(fs.readFileSync(dest+'/restore-order.js'))});
m.revision='gallery-restore-order';m.updated=new Date().toISOString();
fs.writeFileSync(dest+'/canonical-route-manifest.json',JSON.stringify(m,null,2));fs.copyFileSync(parent+'/serve-canonical-preview.mjs',dest+'/serve-canonical-preview.mjs');fs.writeFileSync(dest+'/START-HERE.txt','Local gallery http://127.0.0.1:4228/gallery/\r\nAdds only deferred Restore order enhancement to existing gallery aliases; 159 predecessor routes checked,160 total. Canonical editable/public/backend untouched. Older snapshots retained; pinned asset references required.\r\n');console.log('Prepared local Restore order gallery; two HTML aliases plus one new script only.');
