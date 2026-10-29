const cards=[...document.querySelectorAll('.art-window')],filters=[...document.querySelectorAll('[data-filter]')],dialog=document.querySelector('.viewer'),image=dialog.querySelector('img'),title=dialog.querySelector('h2'),caption=dialog.querySelector('.viewer-caption'),status=dialog.querySelector('.viewer-status'),original=dialog.querySelector('.image-file'),zoom=dialog.querySelector('.zoom'),counter=document.querySelector('.count');
const artworkStage=dialog.querySelector('.viewer-stage');
let current=0,opener=null;const visible=()=>[...document.querySelectorAll('.wall .art-window')].filter(c=>!c.hidden);const label=c=>c.querySelector('h2').textContent;
document.querySelectorAll('[data-enhancement]').forEach(e=>e.hidden=false);
function announce(){counter.textContent=visible().length+' works on the wall';}
filters.forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.filter;filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));cards.forEach(c=>c.hidden=filter!=='All'&&c.dataset.category!==filter);announce();}));
document.querySelector('.layout').addEventListener('click',e=>{const active=document.body.classList.toggle('sheet');e.currentTarget.setAttribute('aria-pressed',String(active));e.currentTarget.textContent=active?'Loose wall':'Contact sheet';});
document.querySelector('.shuffle').addEventListener('click',()=>{const order=cards.slice();for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}order.forEach(c=>document.querySelector('.wall').append(c));counter.textContent='Wall rearranged · '+visible().length+' works';});
function show(index){artworkStage.setAttribute('aria-busy','true');const list=visible();current=(index+list.length)%list.length;const card=list[current],link=card.querySelector('.art-link');dialog.dataset.category=card.dataset.category;title.textContent=label(card);caption.textContent=card.querySelector('.caption p').textContent;image.alt=card.querySelector('img').alt;image.hidden=true;zoom.setAttribute('aria-disabled','true');status.textContent='Loading image…';image.src=link.href;original.href=link.href;original.setAttribute('aria-label','Open '+label(card)+' image file');dialog.dataset.zoom='false';zoom.setAttribute('aria-pressed','false');dialog.querySelector('.viewer-stage').scrollTo(0,0);}
image.addEventListener('load',()=>{if(!image.hasAttribute('src'))return;artworkStage.setAttribute('aria-busy','false');zoom.setAttribute('aria-disabled','false');image.hidden=false;status.textContent=(current+1)+' / '+visible().length+' · '+image.naturalWidth+' × '+image.naturalHeight;});image.addEventListener('error',()=>{artworkStage.setAttribute('aria-busy','false');zoom.setAttribute('aria-disabled','true');image.hidden=true;status.textContent='The image could not load. Try opening the image file.';});
cards.forEach(card=>card.querySelector('.art-link').addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;e.preventDefault();opener=e.currentTarget;show(visible().indexOf(card));dialog.showModal();dialog.querySelector('.close').focus();}));
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.querySelector('.prev').addEventListener('click',()=>show(current-1));dialog.querySelector('.next').addEventListener('click',()=>show(current+1));dialog.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.target.closest('input,select,textarea,[contenteditable]')||(dialog.dataset.zoom==='true'&&e.target.closest('.viewer-stage')))return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?visible().length-1:current+(e.key==='ArrowLeft'?-1:1));}});
dialog.addEventListener('close',()=>{artworkStage.setAttribute('aria-busy','false');image.removeAttribute('src');image.hidden=true;zoom.setAttribute('aria-disabled','true');if(document.activeElement===document.body||dialog.contains(document.activeElement))opener?.focus();});
zoom.addEventListener('click',()=>{if(zoom.getAttribute('aria-disabled')==='true')return;const active=dialog.dataset.zoom!=='true';dialog.dataset.zoom=String(active);zoom.setAttribute('aria-pressed',String(active));if(active)dialog.querySelector('.viewer-stage').focus();});dialog.querySelector('.mat').addEventListener('change',e=>dialog.dataset.mat=e.target.value);announce();


/* Optional local gallery enhancement; existing art nodes and filters stay intact. */
(() => {
  const wall = document.querySelector('.wall');
  const shuffle = document.querySelector('.shuffle');
  const status = document.querySelector('.count');
  if (!wall || !shuffle || !status) return;
  const originalOrder = [...wall.querySelectorAll('.art-window')];
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'restore-order';
  restore.textContent = 'Restore order';
  restore.title = 'Return to the original artwork order';
  shuffle.after(restore);
  restore.addEventListener('click', () => {
    for (const card of originalOrder) wall.append(card);
    const count = originalOrder.filter(card => !card.hidden).length;
    status.textContent = 'Original order restored · ' + count + ' works';
  });
})();

/* Preserve a native motion choice made before this deferred enhancement arrives. */
(() => {
  const choice = document.getElementById('gallery-still');
  if (!choice) return;
  const key = 'banderov.gallery.still.v1';
  const persist = () => {
    try { localStorage.setItem(key, choice.checked ? '1' : '0'); } catch {}
  };
  const restoreSavedChoice = () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === '1' || saved === '0') choice.checked = saved === '1';
    } catch { /* Keep the current native choice if storage is unavailable. */ }
  };
  // Input cloning preserves native dirty checkedness. Probe only a detached clone
  // so even toggling back to the default is detected without changing the live UI.
  const probe = choice.cloneNode();
  probe.defaultChecked = !choice.defaultChecked;
  const changedBeforeSetup = probe.checked === choice.checked;
  if (changedBeforeSetup) persist();
  else restoreSavedChoice();
  choice.addEventListener('change', persist);
  // Apply the saved choice after native history form restoration.
  window.addEventListener('pageshow', restoreSavedChoice);
  window.addEventListener('storage', event => { if (event.key === key) restoreSavedChoice(); });
})();

/* Mouse detail panning; touch and keyboard retain native scrolling. */
(() => {
  const stage = dialog.querySelector('.viewer-stage');
  image.draggable = false;
  let pan;
  const stopPan = () => {
    const previous = pan;
    pan = undefined;
    delete stage.dataset.dragging;
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
  };
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || dialog.dataset.zoom !== 'true' || image.hidden) return;
    const bounds = stage.getBoundingClientRect();
    // Let the browser own native scrollbar gutters and border clicks.
    if (event.clientX < bounds.left + stage.clientLeft || event.clientX >= bounds.left + stage.clientLeft + stage.clientWidth || event.clientY < bounds.top + stage.clientTop || event.clientY >= bounds.top + stage.clientTop + stage.clientHeight) return;
    pan = {id:event.pointerId, x:event.clientX, y:event.clientY, left:stage.scrollLeft, top:stage.scrollTop};
    try { stage.setPointerCapture(event.pointerId); } catch { pan = undefined; return; }
    stage.dataset.dragging = 'true';
    stage.focus({preventScroll:true});
    event.preventDefault();
  });
  stage.addEventListener('pointermove', event => {
    if (!pan || event.pointerId !== pan.id) return;
    if (event.buttons !== 1 || dialog.dataset.zoom !== 'true' || image.hidden) { stopPan(); return; }
    stage.scrollLeft = pan.left + pan.x - event.clientX;
    stage.scrollTop = pan.top + pan.y - event.clientY;
    event.preventDefault();
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) stage.addEventListener(name, event => {
    if (pan && event.pointerId === pan.id) stopPan();
  });
  dialog.addEventListener('close', stopPan);
  for (const name of ['click','keydown']) dialog.addEventListener(name, () => {
    if (dialog.dataset.zoom !== 'true' || image.hidden) stopPan();
  });
  dialog.querySelector('.zoom').addEventListener('click', () => {
    if (dialog.dataset.zoom !== 'true' || image.hidden) return;
    stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
    stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
  });
  image.addEventListener('error', stopPan);
  window.addEventListener('blur', stopPan);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPan(); });
})();

/* Collection totals stay grounded in the existing artwork cards. */
filters.forEach(button => {
  const total = button.dataset.filter === 'All' ? cards.length : cards.filter(card => card.dataset.category === button.dataset.filter).length;
  const badge = document.createElement('span');
  badge.className = 'filter-total';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = String(total).padStart(2, '0');
  button.setAttribute('aria-label', button.textContent.trim() + ', ' + total + (total === 1 ? ' work' : ' works'));
  button.append(badge);
});
