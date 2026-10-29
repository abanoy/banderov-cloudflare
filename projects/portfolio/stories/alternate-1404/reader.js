(() => {
  const book=document.querySelector('#book'),chapters=[...book.querySelectorAll('.chapter')],pages=[];
  const sectionName=id=>id.replace('chapter-','Chapter ').replace('preface','Preface').replace('title','Title');
  for(const chapter of chapters){
    const children=[...chapter.children];let leaf,words=0;
    const begin=()=>{leaf=document.createElement('div');leaf.className='leaf';leaf.tabIndex=-1;leaf.dataset.chapter=chapter.id;leaf.id=chapter.id+(chapter.id==='chapter-6'?'-reading-page-':'-page-')+(chapter.querySelectorAll('.leaf').length+1);chapter.append(leaf);pages.push(leaf);words=0;};begin();
    for(const child of children){const count=child.textContent.trim().split(/\s+/).length;if(child.tagName==='P'&&!child.classList.contains('chapter-subtitle')&&leaf.querySelector('[data-source]')&&words+count>430)begin();leaf.append(child);words+=count;}
  }
  const paragraphs=[...book.querySelectorAll('[data-source]')],bySource=new Map(paragraphs.map(p=>[p.dataset.source,p])),bookmarkKey='banderov.alternate1404.place.v1',settingsKey='banderov.alternate1404.reader.v1';
  const previous=document.querySelector('#previous'),next=document.querySelector('#next'),status=document.querySelector('#page-count'),flow=document.querySelector('#flow'),size=document.querySelector('#text-size'),paper=document.querySelector('#paper'),jump=document.querySelector('#page-jump'),progress=document.querySelector('#reading-progress'),resume=document.querySelector('#resume-reading'),forget=document.querySelector('#forget-place'),resumeRow=document.querySelector('.resume-row');
  let current=0,continuous=false,saved=null,canStore=true,scrollTimer;
  try{const value=JSON.parse(localStorage.getItem(bookmarkKey));if(value&&typeof value.source==='string'&&bySource.has(value.source))saved=value;}catch{}
  let mayRemember=!saved,footerNavigation=false;
  const syncResume=()=>{resumeRow.hidden=!saved;resume.textContent=saved?'Continue · '+sectionName(bySource.get(saved.source).closest('.chapter').id):'Continue reading';};syncResume();
  const setPaper=night=>{document.body.dataset.paper=night?'night':'paper';paper.setAttribute('aria-pressed',String(night));paper.textContent=night?'Light paper':'Night paper';};
  try{const pref=JSON.parse(localStorage.getItem(settingsKey));if(pref){if(['18','20','24'].includes(pref.size))size.value=pref.size;setPaper(pref.night===true);continuous=pref.continuous===true;}}catch{}
  book.style.setProperty('--reading-size',size.value+'px');
  const saveSettings=()=>{try{localStorage.setItem(settingsKey,JSON.stringify({size:size.value,night:document.body.dataset.paper==='night',continuous}));}catch{}};
  const remember=()=>{
    if(!canStore||!mayRemember||footerNavigation)return;const bounds=book.getBoundingClientRect();if(bounds.top>=innerHeight||bounds.bottom<=0)return;
    const candidates=continuous?paragraphs:[...pages[current].querySelectorAll('[data-source]')];
    const visible=candidates.map(p=>({p,r:p.getBoundingClientRect()})).filter(v=>v.r.height>0&&v.r.bottom>0&&v.r.top<innerHeight);
    if(!visible.length)return;const target=visible.find(v=>v.r.bottom>Math.min(innerHeight*.3,240))||visible[0];
    const value={source:target.p.dataset.source};try{localStorage.setItem(bookmarkKey,JSON.stringify(value));saved=value;syncResume();}catch{canStore=false;}
  };
  const scheduleRemember=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(remember,200);};
  const options=document.createDocumentFragment();pages.forEach((page,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=(index+1)+' · '+sectionName(page.dataset.chapter);options.append(option)});jump.append(options);progress.max=pages.length;
  const render=(focus=false)=>{
    document.body.classList.toggle('paged',!continuous);pages.forEach((p,i)=>p.hidden=!continuous&&i!==current);chapters.forEach(c=>c.hidden=!continuous&&!c.contains(pages[current]));previous.disabled=current===0;next.disabled=current===pages.length-1;jump.value=String(current);progress.value=current+1;
    status.textContent='Page '+(current+1)+' of '+pages.length+' · '+sectionName(pages[current].dataset.chapter);
    document.querySelectorAll('.contents nav a').forEach(a=>{if(a.hash.slice(1)===pages[current].dataset.chapter)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
    flow.setAttribute('aria-pressed',String(continuous));flow.textContent=continuous?'Read page by page':'Read continuously';document.querySelector('.page-turns').hidden=continuous;
    if(focus){pages[current].scrollIntoView({block:'start',behavior:'instant'});pages[current].focus({preventScroll:true});scheduleRemember();}
  };
  const followHash=()=>{let fragment='';try{fragment=decodeURIComponent(location.hash.slice(1))}catch{}const legacy=/^chapter-6-page-([0-9]+)$/.exec(fragment);if(legacy){const n=Number(legacy[1]),max=pages.filter(p=>p.dataset.chapter==='chapter-6').length+1;if(Number.isSafeInteger(n)&&n>=1&&n<=max){fragment='chapter-6-reading-page-'+Math.max(1,n-1);history.replaceState(history.state,'','#'+fragment);}}const index=pages.findIndex(p=>p.id===fragment||p.dataset.chapter===fragment);if(index>=0){current=index;mayRemember=true;}render(index>=0);};
  const turnTo=index=>{mayRemember=true;current=Math.max(0,Math.min(pages.length-1,index));history.replaceState(null,'','#'+pages[current].id);render(true);};
  previous.addEventListener('click',()=>turnTo(current-1));next.addEventListener('click',()=>turnTo(current+1));jump.addEventListener('change',()=>turnTo(Number(jump.value)));
  window.addEventListener('hashchange',followHash);
  size.addEventListener('change',()=>{book.style.setProperty('--reading-size',size.value+'px');saveSettings();});paper.addEventListener('click',()=>{setPaper(document.body.dataset.paper!=='night');saveSettings();});flow.addEventListener('click',()=>{continuous=!continuous;saveSettings();render(true);});
  resume.addEventListener('click',()=>{if(!saved)return;mayRemember=true;const paragraph=bySource.get(saved.source);current=pages.indexOf(paragraph.closest('.leaf'));history.replaceState(null,'','#'+pages[current].id);render();paragraph.tabIndex=-1;paragraph.scrollIntoView({block:'start',behavior:'instant'});paragraph.focus({preventScroll:true});scheduleRemember();});
  forget.addEventListener('click',()=>{clearTimeout(scrollTimer);try{localStorage.removeItem(bookmarkKey)}catch{}saved=null;mayRemember=false;syncResume();document.querySelector('.contents summary').focus();});
  book.addEventListener('keydown',event=>{if(continuous||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();turnTo(current+(event.key==='ArrowRight'?1:-1));}});
  book.addEventListener('focusin',()=>{footerNavigation=false;mayRemember=true;});book.addEventListener('pointerdown',()=>{footerNavigation=false;mayRemember=true;});window.addEventListener('wheel',()=>{const b=book.getBoundingClientRect();if(b.top<innerHeight*.6&&b.bottom>0){footerNavigation=false;mayRemember=true;}},{passive:true});window.addEventListener('touchstart',()=>{const b=book.getBoundingClientRect();if(b.top<innerHeight*.6&&b.bottom>0){footerNavigation=false;mayRemember=true;}},{passive:true});window.addEventListener('scroll',scheduleRemember,{passive:true});window.addEventListener('pagehide',remember);
  // Focusing footer navigation is not evidence of reading the lower paragraphs.
  document.addEventListener('focusin',event=>{footerNavigation=Boolean(event.target.closest('footer'));});
  window.addEventListener('pointerdown',event=>{if(!event.target.closest('footer'))footerNavigation=false;},{passive:true});
  window.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,[contenteditable]'))return;if(['PageUp','PageDown','ArrowUp','ArrowDown','Home','End',' '].includes(event.key))footerNavigation=false;});
  // Keep continuous-mode page selection aligned with the visible text without changing the URL/focus.
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(!continuous)return;const visible=entries.filter(e=>e.isIntersecting);if(!visible.length)return;const paragraph=visible.sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top))[0].target;const index=pages.indexOf(paragraph.closest('.leaf'));if(index>=0&&index!==current){current=index;jump.value=String(index);progress.value=index+1;status.textContent='Page '+(index+1)+' of '+pages.length+' · '+sectionName(pages[index].dataset.chapter);document.querySelectorAll('.contents nav a').forEach(a=>{if(a.hash.slice(1)===pages[index].dataset.chapter)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});}}, {rootMargin:'0px 0px -65% 0px'});paragraphs.forEach(p=>observer.observe(p));}
  document.querySelector('.reader-tools').hidden=false;followHash();
})();

/* Local accessibility study: label page groups without changing their text/focus/controller. */
(()=>{const pages=[...document.querySelectorAll('#book .leaf')];const sectionName=id=>id.replace('chapter-','Chapter ').replace('preface','Preface').replace('title','Title');pages.forEach((page,index)=>{page.setAttribute('role','group');page.setAttribute('aria-label',sectionName(page.dataset.chapter)+' · Page '+(index+1)+' of '+pages.length);});})();

/* Finish explicit manuscript deep-link focus after native fragment processing.
   Skip ordinary entries, unknown fragments and any intervening user activity. */
(()=>{let interacted=false;for(const event of ['pointerdown','keydown'])window.addEventListener(event,()=>{interacted=true;},{once:true,capture:true});window.addEventListener('load',()=>requestAnimationFrame(()=>{if(interacted||(document.activeElement!==document.body&&document.activeElement!==document.documentElement))return;let fragment;try{fragment=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!fragment)return;const page=[...document.querySelectorAll('#book .leaf')].find(p=>p.id===fragment||p.dataset.chapter===fragment);if(page&&!page.hidden&&!page.closest('.chapter').hidden)page.focus({preventScroll:true});}),{once:true});})();
