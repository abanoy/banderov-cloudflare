const fs=require('node:fs'),path=require('node:path');
const root=__dirname,art=path.resolve(root,'../recovery/art');
const cast=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(art,'cast5_gloss.json'),'utf8')).map(c=>[c.name,c.svg]));
const guy=JSON.parse(fs.readFileSync(path.join(art,'guy_gloss.json'),'utf8')).svg;
fs.writeFileSync(path.join(root,'src/cast.js'),'// Recovered historical procedural silhouettes.\nconst CAST = '+JSON.stringify(cast)+';\nconst GUY_SVG = '+JSON.stringify(guy)+';\n');
// src/all.js is now the editable recovered game source. Never overwrite it from
// the archive during builds; the preserved archive remains available for comparison.
const files=['index.html','src/cast.js','src/all.js','src/expanded.js','src/style.css','src/recovery.css','assets/cafe.mp3'];let bytes=0;
for(const file of files){const source=path.join(root,file);if(file.endsWith('.js'))require('node:child_process').execFileSync(process.execPath,['--check',source]);bytes+=fs.statSync(source).size;
 for(const mode of ['portal','portfolio']){const dest=path.join(root,'dist',mode,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);}}
if(bytes>=20_000_000)throw Error('Owner build-size budget exceeded');
console.log(`Eight recovered silhouettes plus player; ${files.length} files; ${bytes} bytes (${(bytes/1e6).toFixed(3)} MB) per standalone build.`);
