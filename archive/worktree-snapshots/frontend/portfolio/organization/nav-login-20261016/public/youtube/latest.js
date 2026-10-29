(() => {
  const rail=document.querySelector('.latest-rail');
  if(!rail)return;
  const previous=document.querySelector('.latest-previous'),next=document.querySelector('.latest-next'),status=document.querySelector('.latest-position'),cards=[...rail.children],reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{
    const bounds=rail.getBoundingClientRect(),visible=cards.map((card,index)=>({rect:card.getBoundingClientRect(),index})).filter(v=>v.rect.right>bounds.left+8&&v.rect.left<bounds.right-8);
    if(visible.length)status.textContent=(visible[0].index+1)+'–'+(visible.at(-1).index+1)+' of '+cards.length+' videos';
    previous.disabled=rail.scrollLeft<=2;
    next.disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;
  };
  const move=direction=>rail.scrollBy({left:direction*Math.max(rail.clientWidth*.85,260),behavior:reduced.matches?'instant':'smooth'});
  previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  rail.addEventListener('keydown',event=>{
    if(event.target!==rail)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}
    else if(event.key==='Home'||event.key==='End'){event.preventDefault();rail.scrollTo({left:event.key==='Home'?0:rail.scrollWidth,behavior:reduced.matches?'instant':'smooth'});}
  });
  // Touch retains native browser panning; mouse/pen can grab anywhere on a card.
  let pointer=null,blockedClick=false;
  const finishDrag=()=>{
    if(!pointer)return;
    const old=pointer;pointer=null;
    rail.classList.remove('is-dragging');
    if(old.dragging)blockedClick=true;
    if(rail.hasPointerCapture(old.id))rail.releasePointerCapture(old.id);
    update();
  };
  rail.classList.add('is-grabbable');
  rail.addEventListener('dragstart',event=>event.preventDefault());
  rail.addEventListener('pointerdown',event=>{
    if(pointer)return;
    blockedClick=false;
    if(event.pointerType==='touch'||event.button!==0)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:rail.scrollLeft,dragging:false};
  });
  rail.addEventListener('pointermove',event=>{
    if(!pointer||event.pointerId!==pointer.id)return;
    if(!(event.buttons&1)){finishDrag();return;}
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    if(!pointer.dragging){
      if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){pointer=null;return;}
      if(Math.abs(dx)<8)return;
      pointer.dragging=true;rail.classList.add('is-dragging');rail.setPointerCapture(event.pointerId);
    }
    event.preventDefault();rail.scrollLeft=pointer.left-dx;
  });
  rail.addEventListener('pointerup',event=>{if(event.pointerId===pointer?.id)finishDrag();});
  rail.addEventListener('pointercancel',event=>{if(event.pointerId===pointer?.id)finishDrag();});
  rail.addEventListener('lostpointercapture',event=>{if(event.pointerId===pointer?.id)finishDrag();});
  rail.addEventListener('click',event=>{
    if(blockedClick&&event.detail>0){blockedClick=false;event.preventDefault();event.stopPropagation();}
  },true);
  window.addEventListener('blur',finishDrag);
  window.addEventListener('pointerup',event=>{if(event.pointerId===pointer?.id)finishDrag();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finishDrag();});
  window.addEventListener('resize',finishDrag);
  let timer;rail.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(update,150)},{passive:true});
  rail.addEventListener('latest-updated',()=>{cards.splice(0,cards.length,...rail.children);update();});
  new ResizeObserver(update).observe(rail);
  document.querySelector('.latest-controls').hidden=false;
  update();
  rail.querySelectorAll('img').forEach(image=>{image.addEventListener('error',()=>image.hidden=true);if(image.complete&&!image.naturalWidth)image.hidden=true;});
})();
