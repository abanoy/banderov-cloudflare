const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=__dirname,read=f=>fs.readFileSync(path.join(base,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=JSON.parse(read('candidate-audit.json')),rules=JSON.parse(read('preserved-rules-baseline.json')),text=read('src/all.js').toString('utf8');
const checked=[];
for(const [name,r] of Object.entries(rules.blocks)){
 const start=text.indexOf(r.start);assert(start>=0,name+' start missing');const end=text.indexOf(r.end,start);assert(end>start,name+' end missing');
 assert.equal(sha(Buffer.from(text.slice(start,end))),r.sha256,name+' mechanics changed');checked.push(name);
}
for(const f of rules.unchanged_files){assert.equal(sha(read(f)),baseline.files[f],f+' changed');checked.push(f);}
assert.equal(sha(read('index.html')),baseline.files['index.html'],'entry point changed');
assert(!/CrazyGames|requestAd|adPending|adMute|portalMute|__fastAd|\bmidgame\b/.test(text),'ad hooks reintroduced');
console.log(JSON.stringify({passed:true,scope:'Exact original battle mechanics and original art/music/Expanded files; no browser acceptance',checked}));
