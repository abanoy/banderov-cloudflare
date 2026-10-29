const fs=require('node:fs'),assert=require('node:assert/strict');
const root='portfolio/review/20261018-gallery-history-races';
const before=fs.readFileSync('portfolio/review/20261018-gallery-history/gallery.before.js');
const enhancement=String.raw`

// Keep one artwork visit in browser history, including asynchronous close cleanup.
(()=>{
  const key='banderovGalleryViewerV1';
  const hrefFor=card=>card.querySelector('.art-link').getAttribute('href');
  const saved=history.state?.[key];
  const session=typeof saved?.session==='string'?saved.session:crypto.randomUUID();
  let closing=false,queued=null,cleanupPending=false,historyDrivenClose=false;
  const own=()=>history.state?.[key]?.session===session;
  const entry=card=>({[key]:{session,href:hrefFor(card)}});
  const push=card=>history.pushState(entry(card),'');
  const reveal=card=>{if(card.hidden)(filters.find(b=>b.dataset.filter===card.dataset.category)||filters.find(b=>b.dataset.filter==='All'))?.click();};
  const nativeClose=dialog.close.bind(dialog);
  dialog.close=function(...args){if(dialog.open)cleanupPending=true;return nativeClose(...args);};
  dialog.addEventListener('cancel',event=>{
    cleanupPending=true;
    queueMicrotask(()=>{if(event.defaultPrevented){cleanupPending=false;drain();}});
  });
  const showBefore=show;
  show=function(index){
    showBefore(index);
    if(dialog.open&&own()&&!closing&&!cleanupPending){
      const card=visible()[current];
      if(card)history.replaceState(entry(card),'');
    }
  };
  cards.forEach(card=>{
    const link=card.querySelector('.art-link');
    link.addEventListener('click',e=>{
      if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;
      if(closing||cleanupPending){e.preventDefault();e.stopImmediatePropagation();queued=card;}
    },true);
    link.addEventListener('click',e=>{
      if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button||!dialog.open)return;
      try{push(card);}catch{/* Existing Close/Escape controls still work without history. */}
    });
  });
  dialog.addEventListener('close',()=>{
    cleanupPending=false;
    if(historyDrivenClose){historyDrivenClose=false;drain();return;}
    if(own()&&!closing){closing=true;history.back();return;}
    drain();
  });
  function restore(){
    if(cleanupPending)return;
    const card=cards.find(c=>hrefFor(c)===history.state?.[key]?.href);
    if(!own()||!card){if(dialog.open){historyDrivenClose=true;dialog.close();}return;}
    reveal(card);opener=card.querySelector('.art-link');
    show(visible().indexOf(card));
    if(!dialog.open){dialog.showModal();dialog.querySelector('.close').focus();}
  }
  function drain(){
    if(closing||cleanupPending)return;
    if(queued){const card=queued;queued=null;reveal(card);card.querySelector('.art-link').click();return;}
    restore();
  }
  addEventListener('popstate',()=>{closing=false;drain();});
  if(saved?.session===session)restore();
})();
`;
fs.writeFileSync(root+'/gallery.v3.js',Buffer.concat([before,Buffer.from(enhancement)]),{flag:'wx'});
fs.writeFileSync(root+'/gallery.original.js',before,{flag:'wx'});
let regression=fs.readFileSync('portfolio/organization/combined-candidate-20261017/check-gallery-history.mjs','utf8');
regression=regression.replace("const root='portfolio/review/20261018-gallery-history';","const root='portfolio/review/20261018-gallery-history-races/regression';");
const start=regression.indexOf('const enhancement=String.raw`');
const end=regression.indexOf('fs.writeFileSync(root+\'/gallery.before.js\'',start);
assert(start>=0&&end>start);
regression=regression.slice(0,start)+"const proposal=fs.readFileSync('portfolio/review/20261018-gallery-history-races/gallery.v3.js');\n"+regression.slice(end);
fs.writeFileSync(root+'/check-regression.mjs',regression,{flag:'wx'});
console.log(JSON.stringify({prepared:true,proposal:root+'/gallery.v3.js'}));
