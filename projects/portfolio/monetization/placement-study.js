const isReview=new URL(location.href).searchParams.get('ad-review')==='1';
if(isReview){
 const bar=document.createElement('aside');bar.className='placement-study-bar';bar.setAttribute('aria-label','Local placement study');
 const text=document.createElement('p');text.textContent='LOCAL PLACEMENT STUDY · Empty layout samples, no ads loaded.';
 const link=document.createElement('a');link.href='/monetization/placements.html';link.textContent='← Placement map';bar.append(text,link);document.body.prepend(bar);
 function place(selector,id,note,{desktopOnly=false,gap=128}={}){const anchor=document.querySelector(selector);if(!anchor)return;const section=document.createElement('aside');section.className='placement-study-slot'+(desktopOnly?' placement-desktop-only':'');section.dataset.placement=id;section.style.setProperty('--placement-gap',gap+'px');section.setAttribute('aria-label','Local banner placement sample');const label=document.createElement('span');label.className='placement-study-label';label.textContent='Advertisements';const space=document.createElement('div');space.className='placement-study-space';space.textContent='Empty banner sample · no network loaded';const caption=document.createElement('p');caption.className='placement-study-caption';caption.textContent=id+' · '+note;section.append(label,space,caption);anchor.after(section);}
 switch(location.pathname){
 case '/':case '/index.html':place('#games','HOME-01','After the complete game showcase; before art/music.',{gap:180});place('#videos','HOME-02','Optional desktop footer banner after all video content.',{desktopOnly:true});break;
 case '/gallery/':place('#wall','ART-01','After the complete artwork wall, outside filters and image viewer.');break;
 case '/youtube/':place('.room-note','TV-01','After the uploads shelf and viewing notes; outside player and drag area.');break;
 case '/stories/alternate-1404/':place('main','BOOK-01','Optional desktop end-of-reader banner. No mobile reading ads.',{desktopOnly:true,gap:180});break;
 }
 const mobileNote=document.createElement('p');mobileNote.className='placement-study-mobile-note';mobileNote.textContent='Mobile reader recommendation: no banners in the book, between pages, or beside page controls.';if(location.pathname.startsWith('/stories/'))document.body.append(mobileNote);
}
