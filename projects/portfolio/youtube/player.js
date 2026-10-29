(() => {
  const windows=[...document.querySelectorAll('.video-window')];
  let active=null;
  const close=(item,restore=false)=>{
    item.querySelector('iframe')?.remove();
    item.querySelector('.video-open').hidden=false;
    item.querySelector('.video-reset').hidden=true;
    item.classList.remove('is-screening','is-expanded');
    item.querySelector('.video-expand').setAttribute('aria-expanded','false');
    item.querySelector('.video-expand').textContent='Expand screen';
    item.querySelector('.video-next').hidden=true;
    item.querySelector('.video-status').textContent='Player closed.';
    if(active===item)active=null;
    if(restore)item.querySelector('.video-open').focus();
  };
  const open=item=>{
    if(active===item)return;
    if(active)close(active);
    // Opening a screening must not compete with this page's music players.
    document.querySelectorAll('audio').forEach(audio=>audio.pause());
    const frame=document.createElement('iframe');
    frame.src='https://www.youtube-nocookie.com/embed/'+item.dataset.video+'?rel=0';
    frame.title=item.querySelector('h3').textContent;
    frame.allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin';
    item.querySelector('.video-screen').append(frame);
    item.classList.add('is-screening');
    item.querySelector('.video-open').hidden=true;
    item.querySelector('.video-reset').hidden=false;
    item.querySelector('.video-next').hidden=false;
    item.querySelector('.video-status').textContent='Player opened. Press Play inside YouTube. If it cannot play here, use Watch on YouTube.';
    active=item;
    frame.focus();
  };
  windows.forEach((item,index)=>{
    const screen=item.querySelector('.video-screen'),button=item.querySelector('.video-open'),reset=item.querySelector('.video-reset'),tools=item.querySelector('.video-tools'),thumbnail=screen.querySelector('img');
    screen.id='screen-'+item.dataset.video;
    if(thumbnail){thumbnail.addEventListener('error',()=>thumbnail.hidden=true);if(thumbnail.complete&&!thumbnail.naturalWidth)thumbnail.hidden=true;}
    const expand=document.createElement('button');expand.type='button';expand.className='video-expand';expand.textContent='Expand screen';expand.setAttribute('aria-expanded','false');expand.setAttribute('aria-controls',screen.id);
    expand.addEventListener('click',()=>{const larger=item.classList.toggle('is-expanded');expand.setAttribute('aria-expanded',String(larger));expand.textContent=larger?'Restore screen':'Expand screen';});
    const next=document.createElement('button');next.type='button';next.className='video-next';next.textContent='Next highlight →';next.hidden=true;
    next.addEventListener('click',()=>{const target=windows[(index+1)%windows.length];open(target);target.scrollIntoView({block:'center',behavior:'instant'});});
    tools.append(expand,next);
    reset.addEventListener('click',()=>close(item,true));
    button.addEventListener('click',()=>open(item));button.hidden=false;
    // Keyboard events inside a cross-origin iframe belong to YouTube. The native Close control remains available.
    item.addEventListener('keydown',event=>{if(event.key==='Escape'&&active===item){event.preventDefault();close(item,true);}});
  });
  document.querySelectorAll('audio').forEach(audio=>audio.addEventListener('play',()=>{if(active)close(active);}));
  const lights=document.querySelector('.room-lights');
  if(lights){lights.hidden=false;lights.addEventListener('click',()=>{const dim=document.body.classList.toggle('room-dim');lights.setAttribute('aria-pressed',String(dim));lights.textContent=dim?'Bring up the lights':'Dim the room';});}
})();
