(() => {
  for(const track of document.querySelectorAll('.track')){
    const audio=track.querySelector('audio'),title=track.querySelector('h3').textContent.trim();
    const disc=document.createElement('span');disc.className='record-disc';disc.setAttribute('aria-hidden','true');track.prepend(disc);
    const button=document.createElement('button');button.className='transport-button';button.type='button';button.textContent='▶ Play';button.setAttribute('aria-label','Play '+title);button.setAttribute('aria-pressed','false');
    const status=document.createElement('p');status.className='transport-status';status.setAttribute('role','status');
    audio.before(button,status);
    const sync=()=>{const playing=!audio.paused&&!audio.ended;button.textContent=playing?'Ⅱ Pause':'▶ Play';button.setAttribute('aria-label',(playing?'Pause ':'Play ')+title);button.setAttribute('aria-pressed',String(playing));};
    button.addEventListener('click',()=>{if(!audio.paused){audio.pause();return;}if(audio.error||audio.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)audio.load();status.textContent='Loading track…';audio.play().catch(()=>{status.textContent='Playback could not start. Try again or open the audio file.';sync();});});
    audio.addEventListener('playing',()=>{status.textContent='Playing / '+title;sync();});
    audio.addEventListener('waiting',()=>{status.textContent='Buffering…';});
    audio.addEventListener('pause',()=>{status.textContent='Paused';sync();});
    audio.addEventListener('ended',()=>{status.textContent='Track finished';sync();});
    audio.addEventListener('error',()=>{status.textContent='Audio unavailable. Use the file link below.';sync();});
    for(const source of audio.querySelectorAll('source'))source.addEventListener('error',()=>{if(!track.querySelector('.audio-error').hidden){audio.pause();status.textContent='Audio unavailable. Use the file link below.';sync();}});
    // Enhance only after the custom transport and the existing seek/volume tools exist.
    if(track.querySelector('.waveform-seek'))audio.hidden=true;
  }
  for(const window of document.querySelectorAll('.video-window')){
    const screen=window.querySelector('.video-screen'),button=window.querySelector('.video-open'),reset=window.querySelector('.video-reset'),status=window.querySelector('.video-status');
    const thumbnail=screen.querySelector('img');thumbnail.addEventListener('error',()=>thumbnail.hidden=true);if(thumbnail.complete&&!thumbnail.naturalWidth)thumbnail.hidden=true;
    button.hidden=false;
    button.addEventListener('click',()=>{const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+window.dataset.video+'?rel=0';iframe.title=window.querySelector('h3').textContent;iframe.allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';screen.append(iframe);button.hidden=true;reset.hidden=false;status.textContent='YouTube player opened. Use its Play control to begin; the external link remains available.';iframe.focus();});
    reset.addEventListener('click',()=>{screen.querySelector('iframe')?.remove();button.hidden=false;reset.hidden=true;status.textContent='Player closed.';button.focus();});
  }
})();
