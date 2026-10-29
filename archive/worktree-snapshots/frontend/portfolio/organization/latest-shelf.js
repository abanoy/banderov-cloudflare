(() => {
  const rail=document.querySelector('.latest-rail');
  if(!rail)return;
  const previous=document.querySelector('.latest-previous'),next=document.querySelector('.latest-next'),status=document.querySelector('.latest-position'),cards=[...rail.children],reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{
    const bounds=rail.getBoundingClientRect(),visible=cards.map((card,index)=>({rect:card.getBoundingClientRect(),index})).filter(v=>v.rect.right>bounds.left+8&&v.rect.left<bounds.right-8);
    if(visible.length)status.textContent=(visible[0].index+1)+'–'+(visible.at(-1).index+1)+' of '+cards.length+' public videos';
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
  let timer;rail.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(update,150)},{passive:true});
  new ResizeObserver(update).observe(rail);
  document.querySelector('.latest-controls').hidden=false;
  update();
  rail.querySelectorAll('img').forEach(image=>{image.addEventListener('error',()=>image.hidden=true);if(image.complete&&!image.naturalWidth)image.hidden=true;});
})();
