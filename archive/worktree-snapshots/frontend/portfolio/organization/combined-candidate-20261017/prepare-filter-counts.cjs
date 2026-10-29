const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve('portfolio/review/20261020-gallery-filter-counts');
assert(!fs.existsSync(dir),'Preserve an existing proposal');fs.mkdirSync(dir,{recursive:true});
const idx=JSON.parse(fs.readFileSync('portfolio/review/current-preview-index.json'));
const origin=path.dirname(idx.activeMain.server),m=JSON.parse(fs.readFileSync(origin+'/canonical-route-manifest.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const f of [...m.files,...m.inputs])assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
const js=m.files.find(f=>f.route==='/gallery/desk.js'),css=m.files.find(f=>f.route==='/gallery/desk.css');
const addition=`
// Derive category totals from the curated cards, independent of filtering or order.
(()=>{
  const cards=[...document.querySelectorAll('.wall .art-window')];
  for(const button of document.querySelectorAll('[data-filter]')){
    if(button.querySelector('.filter-count'))continue;
    const label=button.textContent.trim();
    const total=cards.filter(card=>button.dataset.filter==='All'||card.dataset.category===button.dataset.filter).length;
    const badge=document.createElement('span');
    badge.className='filter-count';badge.setAttribute('aria-hidden','true');
    badge.textContent=String(total).padStart(2,'0');
    button.append(' ',badge);
    button.setAttribute('aria-label',label+', '+total+' '+(total===1?'work':'works'));
  }
})();
`;
const style=`
/* File-counter chips echo the art windows without competing with their titles. */
.filters .filter-count{display:inline-block;min-width:1.7em;margin-inline-start:.3em;padding:.12em .28em;border:1px solid #bdf8ef70;border-radius:5px;background:#172d38;color:#bdf8ef;font-size:.78em;font-variant-numeric:tabular-nums;line-height:1.2;vertical-align:middle}
.filters [aria-pressed=true] .filter-count{background:#bdf8ef;color:#17343a;border-color:#bdf8ef}
@media(forced-colors:active){.filters .filter-count{background:Canvas;color:CanvasText;border-color:CanvasText}.filters [aria-pressed=true] .filter-count{background:Highlight;color:HighlightText;border-color:Highlight}}
`;
for(const [entry,name,delta] of [[js,'desk.js',addition],[css,'desk.css',style]]){
  const before=fs.readFileSync(entry.path);fs.writeFileSync(dir+'/'+name+'.before',before);
  const after=Buffer.concat([before,Buffer.from(delta)]);fs.writeFileSync(dir+'/'+name,after);
  entry.path=(dir+'/'+name).replaceAll('\\','/');entry.sha256=sha(after);
}
fs.writeFileSync(dir+'/canonical-route-manifest.json',JSON.stringify(m,null,2));
const server=fs.readFileSync(origin+'/serve-canonical-preview.mjs','utf8');assert.equal(server.split(".listen(4228,").length,2);
fs.writeFileSync(dir+'/serve-canonical-preview.mjs',server.replaceAll('4228','4240'));
fs.writeFileSync(dir+'/START-HERE.txt','Local gallery filter-count proposal: http://127.0.0.1:4240/gallery/\r\nMain remains on4228. No canonical/public integration, API proxy or deployment.\r\n');
fs.writeFileSync(dir+'/preparation.json',JSON.stringify({at:new Date().toISOString(),source:origin,changedRoutes:['/gallery/desk.js','/gallery/desk.css'],unchangedRoutes:m.files.length-2,inputs:m.inputs.length},null,2));
console.log(dir);
