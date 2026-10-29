(() => {
  for(const track of document.querySelectorAll('.track')){
    const audio=track.querySelector('audio'),title=track.querySelector('h3').textContent.trim();
    const disc=document.createElement('span');disc.className='record-disc';disc.setAttribute('aria-hidden','true');track.prepend(disc);
    const button=document.createElement('button');button.className='transport-button';button.type='button';button.textContent='▶ Play';button.setAttribute('aria-label','Play '+title);button.setAttribute('aria-pressed','false');
    const status=document.createElement('p');status.className='transport-status';status.setAttribute('role','status');
    const tools=track.querySelector('.track-tools');
    if(tools){tools.prepend(button);tools.after(status);}
    else audio.before(button,status);
    const sync=()=>{const playing=!audio.paused&&!audio.ended;button.textContent=playing?'Ⅱ Pause':'▶ Play';button.setAttribute('aria-label',(playing?'Pause ':'Play ')+title);button.setAttribute('aria-pressed',String(playing));};
    let playbackRequest=0;
    button.addEventListener('click',()=>{
      const request=++playbackRequest;
      if(!audio.paused){audio.pause();status.textContent='Paused';sync();return;}
      if(audio.error||audio.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)audio.load();
      status.textContent='Loading track…';
      const pending=audio.play();
      sync(); // Native play intent can be paused before data arrives.
      pending.catch(error=>{
        if(request!==playbackRequest)return;
        if(error.name==='AbortError'&&audio.paused&&!audio.error&&track.querySelector('.audio-error').hidden){status.textContent='Paused';sync();return;}
        status.textContent='Playback could not start. Try again or open the audio file.';sync();
      });
    });
    audio.addEventListener('playing',()=>{status.textContent='Playing / '+title;sync();});
    audio.addEventListener('waiting',()=>{if(!audio.paused)status.textContent='Buffering…';});
    audio.addEventListener('pause',()=>{if(audio.paused){playbackRequest++;status.textContent=audio.error||!track.querySelector('.audio-error').hidden?'Audio unavailable. Use the audio file link.':'Paused';sync();}});
    audio.addEventListener('ended',()=>{status.textContent='Track finished';sync();});
    audio.addEventListener('error',()=>{playbackRequest++;audio.pause();status.textContent='Audio unavailable. Use the audio file link.';sync();});
    for(const source of audio.querySelectorAll('source'))source.addEventListener('error',()=>{if(!track.querySelector('.audio-error').hidden){playbackRequest++;audio.pause();status.textContent='Audio unavailable. Use the audio file link.';sync();}});
    // Enhance only after the custom transport and the existing seek/volume tools exist.
    if(track.querySelector('.waveform-seek'))audio.hidden=true;
  }
})();
