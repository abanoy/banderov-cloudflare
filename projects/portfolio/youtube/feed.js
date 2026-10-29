(() => {
 const rail=document.querySelector('.latest-rail'),status=document.querySelector('.latest-feed-status'),button=document.querySelector('.latest-refresh');if(!rail||!status||!button)return;
 const archive=[...rail.children].map(card=>({id:new URL(card.querySelector('a').href).searchParams.get('v'),title:card.querySelector('h3').textContent,duration:card.querySelector('.latest-duration')?.textContent}));
 let loading=false,lastAttempt=0,waiting=null,shelfTouching=false,shelfScrolling=false,shelfIdle;
 const shelfBusy=()=>shelfTouching||shelfScrolling||rail.contains(document.activeElement)||rail.classList.contains('is-dragging');
 const apply=data=>{
  if(shelfBusy()){waiting=data;status.textContent='New feed ready. Leave the shelf to update it.';return}
  waiting=null;const freshIds=new Set(data.videos.map(v=>v.id)),videos=[...data.videos.map(v=>({...v,fresh:true})),...archive.filter(v=>!freshIds.has(v.id))];
  const fragment=document.createDocumentFragment();videos.forEach((video,index)=>{
   const li=document.createElement('li');li.className='latest-card';const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+video.id;link.target='_blank';link.rel='noopener noreferrer';
   const thumb=document.createElement('span');thumb.className='latest-thumb';const img=document.createElement('img');img.src='https://i.ytimg.com/vi/'+video.id+'/mqdefault.jpg';img.alt='';img.width=320;img.height=180;img.loading='lazy';img.addEventListener('error',()=>img.hidden=true);thumb.append(img);
   if(video.duration){const duration=document.createElement('span');duration.className='latest-duration';duration.textContent=video.duration;thumb.append(duration)}
   const copy=document.createElement('div');copy.className='latest-copy';const title=document.createElement('h3');title.textContent=video.title;const label=document.createElement('span');label.textContent=(video.fresh?'Public feed':'Archive · 15 Oct 2026')+' / Watch on YouTube ↗';copy.append(title,label);link.append(thumb,copy);li.append(link);fragment.append(li);
  });
  const left=rail.scrollLeft;rail.replaceChildren(fragment);rail.scrollLeft=left;rail.dispatchEvent(new Event('latest-updated'));
  status.textContent=(data.stale?'Cached feed · ':'Public feed updated · ')+new Date(data.fetchedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+' · '+data.videos.length+' recent uploads. Older cards are from the dated archive.';
 };
 const refresh=async()=>{if(loading)return;loading=true;lastAttempt=Date.now();button.disabled=true;status.textContent='Checking public uploads…';const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch('/api/youtube/public-uploads',{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('Feed unavailable');const data=await response.json();if(data.channelId!=='UCEyvYB3tiYdbkSavB_xINlQ'||!Array.isArray(data.videos)||!data.videos.length||data.videos.length>15||!Number.isFinite(Date.parse(data.fetchedAt))||data.videos.some(v=>!/^[\w-]{11}$/.test(v.id)||typeof v.title!=='string'||v.title.length>500))throw Error('Invalid feed');apply(data)}
  catch{status.textContent='Live refresh unavailable. Keeping the last available list; older archive cards were checked 15 October 2026. Visit the channel for current uploads.'}
  finally{clearTimeout(timer);loading=false;button.disabled=false}
 };
 const flush=()=>{if(waiting&&!shelfBusy())apply(waiting)};
 // Native touch and scroll momentum keep the current cards stable until idle.
 const scheduleShelfIdle=()=>{clearTimeout(shelfIdle);shelfIdle=setTimeout(()=>{if(shelfTouching)return;shelfScrolling=false;flush()},200)};
 rail.addEventListener('touchstart',()=>{shelfTouching=true;shelfScrolling=true;clearTimeout(shelfIdle)},{passive:true});
 rail.addEventListener('scroll',()=>{shelfScrolling=true;scheduleShelfIdle()},{passive:true});
 window.addEventListener('scroll',()=>{if(shelfScrolling)scheduleShelfIdle()},{passive:true});
 const touchFinished=event=>{if(!shelfTouching||event.touches?.length)return;shelfTouching=false;scheduleShelfIdle()};
 window.addEventListener('touchend',touchFinished,{passive:true});
 window.addEventListener('touchcancel',touchFinished,{passive:true});
 const clearShelfGesture=()=>{clearTimeout(shelfIdle);shelfTouching=false;shelfScrolling=false};
 window.addEventListener('blur',clearShelfGesture);
 window.addEventListener('pagehide',clearShelfGesture);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearShelfGesture();flush()}});
 rail.addEventListener('focusout',()=>setTimeout(flush,0));window.addEventListener('pointerup',()=>setTimeout(flush,0));window.addEventListener('blur',()=>setTimeout(flush,0));
 button.hidden=false;button.addEventListener('click',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastAttempt>600000)refresh()});
 setInterval(()=>{if(!document.hidden&&Date.now()-lastAttempt>=600000)refresh()},600000);
 refresh();
})();
