const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=__dirname,files=['index.html','src/art.js','src/dialogue.js','src/logic.js','src/style.css','src/app.js','assets/cafe.mp3'];
let bytes=0;
for(const file of files){const src=path.join(root,file);if(file.endsWith('.js'))cp.execFileSync(process.execPath,['--check',src]);bytes+=fs.statSync(src).size;}
if(bytes>=20_000_000)throw Error('Owner 20 MB budget exceeded');
for(const mode of ['portal','portfolio'])for(const file of files){const dest=path.join(root,'dist',mode,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
console.log(`${files.length} files per build; ${bytes} bytes (${(bytes/1e6).toFixed(3)} MB), uncompressed. Identical portable portal and portfolio builds.`);
