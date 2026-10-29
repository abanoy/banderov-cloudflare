const fs=require('node:fs'),assert=require('node:assert/strict');const file=__dirname+'/publish-environment.cjs';let script=fs.readFileSync(file,'utf8').replace("out=path.resolve(__dirname,'environment-publication-20261015')","out=path.resolve(__dirname,'stories-publication-20261015')");const a=script.indexOf("if(action==='stage'){"),b=script.indexOf('const st=json(out',a);assert(a>=0&&b>a);
const stage=`if(action==='stage'){
 assert(!fs.existsSync(stage),'Existing stage must be inspected');
 const source=home+'/projects/portfolio',before=walk(home+'/banderov/public');assert.equal(before.length,201);
 const protectedReader=json(source+'/review/20261015-reader-resume/final-hashes.json');
 for(const name of ['index.html','reader.js','reader.css'])assert.equal(sha(read(source+'/stories/alternate-1404/'+name)),protectedReader['stories/alternate-1404/'+name]);
 fs.cpSync(home+'/banderov/public',stage,{recursive:true});fs.mkdirSync(stage+'/stories/alternate-1404',{recursive:true});
 for(const name of ['index.html','reader.js','reader.css'])fs.copyFileSync(source+'/stories/alternate-1404/'+name,stage+'/stories/alternate-1404/'+name);
 let html=read(stage+'/index.html').toString(),sourceHtml=read(source+'/index.html').toString();const marker='<p class="large-copy">Some worlds begin<br>on the page.</p>';
 assert.equal(html.split(marker).length,2);const cta=sourceHtml.match(/<a class="button" href="\\/stories\\/alternate-1404\\/">[\\s\\S]*?<\\/a><p class="fine-print">[\\s\\S]*?<\\/p>/)[0];assert(!html.includes('href="/stories/alternate-1404/"'));html=html.replace(marker,marker+cta);fs.writeFileSync(stage+'/index.html',html);
 const after=walk(stage);for(const f of before)if(f.path!=='index.html')assert.deepEqual(after.find(a=>a.path===f.path),f);for(const f of after)assert(f.bytes<=25*1024*1024);
 save(out+'/stage.json',{before,after,changed:after.filter(f=>!before.some(b=>b.path===f.path&&b.sha256===f.sha256)),scope:'Owner-authorized Alternate1404 web reader only, title/preface/six chapters and saved-place controls. Originals/private editorial/music/newer games excluded.',createdAtUtc:new Date().toISOString()});console.log(JSON.stringify({staged:true,existing:before.length,total:after.length,changed:4}));return;
}
`;
script=script.slice(0,a)+stage+script.slice(b);
script=script.replace('Owner-authorized Crusaders 3D Environment WIP, preserve all existing portfolio/games/backend','Owner-authorized Alternate1404 Stories reader, preserve all live modules/YouTube/games').replace('Publish owner-requested Crusaders 3D Environment WIP only','Publish owner-approved Alternate1404 reader only');
const old="for(const f of st.before){const r=await fetch('https://banderov.com/'+f.path);assert.equal(r.status,200,f.path);assert.equal(sha(Buffer.from(await r.arrayBuffer())),f.sha256,'Live/local mismatch: '+f.path)}";
assert(script.includes(old));script=script.replace(old,"let position=0;await Promise.all(Array.from({length:4},async()=>{while(position<st.before.length){const f=st.before[position++];let r;for(let attempt=0;attempt<3;attempt++){try{r=await fetch('https://banderov.com/'+f.path);break}catch(e){if(attempt===2)throw e}}assert.equal(r.status,200,f.path);assert.equal(sha(Buffer.from(await r.arrayBuffer())),f.sha256,'Live/local mismatch: '+f.path)}}));");
fs.writeFileSync(__dirname+'/publish-stories.cjs',script);console.log('Created isolated Stories publisher with exact live module preservation.');
