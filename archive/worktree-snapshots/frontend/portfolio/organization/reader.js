(() => {
  const book=document.querySelector('#book'), chapters=[...book.querySelectorAll('.chapter')], pages=[];
  for(const chapter of chapters){
    const children=[...chapter.children];let leaf,words=0;
    const begin=()=>{leaf=document.createElement('div');leaf.className='leaf';leaf.tabIndex=-1;leaf.dataset.chapter=chapter.id;leaf.id=chapter.id+'-page-'+(chapter.querySelectorAll('.leaf').length+1);chapter.append(leaf);pages.push(leaf);words=0;};
    begin();
    for(const child of children){const count=child.textContent.trim().split(/\s+/).length;if(child.tagName==='P'&&!child.classList.contains('chapter-subtitle')&&words>0&&words+count>430)begin();leaf.append(child);words+=count;}
  }
  let current=0,continuous=false;
  const previous=document.querySelector('#previous'),next=document.querySelector('#next'),status=document.querySelector('#page-count'),flow=document.querySelector('#flow');
  const render=(focus=false)=>{document.body.classList.toggle('paged',!continuous);pages.forEach((p,i)=>p.hidden=!continuous&&i!==current);chapters.forEach(c=>c.hidden=!continuous&&!c.contains(pages[current]));previous.disabled=current===0;next.disabled=current===pages.length-1;status.textContent='Page '+(current+1)+' of '+pages.length+' · '+pages[current].dataset.chapter.replace('chapter-','Chapter ').replace('preface','Preface').replace('title','Title');if(focus){pages[current].scrollIntoView({block:'start',behavior:'instant'});pages[current].focus({preventScroll:true});}};
  const followHash=()=>{const fragment=decodeURIComponent(location.hash.slice(1));const index=pages.findIndex(p=>p.id===fragment||p.dataset.chapter===fragment);if(index>=0)current=index;render(index>=0);};
  const turn=delta=>{current=Math.max(0,Math.min(pages.length-1,current+delta));history.replaceState(null,'','#'+pages[current].id);render(true);};
  previous.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
  document.querySelector('.contents nav').addEventListener('click',event=>{const link=event.target.closest('a');if(!link)return;const index=pages.findIndex(p=>p.dataset.chapter===link.hash.slice(1));if(index>=0){current=index;render(true);}});
  window.addEventListener('hashchange',followHash);
  document.querySelector('#text-size').addEventListener('change',event=>book.style.setProperty('--reading-size',event.target.value+'px'));
  document.querySelector('#paper').addEventListener('click',event=>{const night=document.body.dataset.paper!=='night';document.body.dataset.paper=night?'night':'paper';event.currentTarget.setAttribute('aria-pressed',String(night));event.currentTarget.textContent=night?'Light paper':'Night paper';});
  flow.addEventListener('click',()=>{continuous=!continuous;flow.setAttribute('aria-pressed',String(continuous));flow.textContent=continuous?'Read page by page':'Read continuously';document.querySelector('.page-turns').hidden=continuous;render(true);});
  book.addEventListener('keydown',event=>{if(continuous||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();turn(event.key==='ArrowRight'?1:-1);}});
  document.querySelector('.reader-tools').hidden=false;document.querySelector('.page-turns').hidden=false;followHash();
})();
