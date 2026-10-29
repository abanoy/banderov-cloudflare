const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root='portfolio/review/20261017-music-loading-pause';assert(fs.existsSync(root+'/before-diagnostic.json'));assert(!fs.existsSync(root+'/canonical-route-manifest.json'));const index=JSON.parse(fs.readFileSync('portfolio/review/current-preview-index.json')),parent=path.dirname(index.reviewDesk.server),m=JSON.parse(fs.readFileSync(parent+'/canonical-route-manifest.json'));for(const f of [...m.files,...m.inputs])assert.equal(sha(fs.readFileSync(f.path)),f.sha256);const file=m.files.find(f=>f.route==='/media.js'),before=fs.readFileSync(file.path,'utf8');let after=before;const changes=[
 ["button.addEventListener('click',()=>{if(!audio.paused){audio.pause();return;}if(audio.error||audio.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)audio.load();status.textContent='Loading track…';audio.play().catch(()=>{status.textContent='Playback could not start. Try again or open the audio file.';sync();});});",`let playbackRequest=0;
    button.addEventListener('click',()=>{
      const request=++playbackRequest;
      if(!audio.paused){audio.pause();status.textContent='Paused';sync();return;}
      if(audio.error||audio.networkState===HTMLMediaElement.NETWORK_NO_SOURCE)audio.load();
      status.textContent='Loading track…';
      const pending=audio.play();
      sync(); // Native play intent can be paused before data arrives.
      pending.catch(error=>{
        if(request!==playbackRequest)return;
        if(error.name==='AbortError'&&audio.paused){status.textContent='Paused';sync();return;}
        status.textContent='Playback could not start. Try again or open the audio file.';sync();
      });
    });`],
 ["audio.addEventListener('waiting',()=>{status.textContent='Buffering…';});","audio.addEventListener('waiting',()=>{if(!audio.paused)status.textContent='Buffering…';});"],
 ["audio.addEventListener('pause',()=>{status.textContent='Paused';sync();});","audio.addEventListener('pause',()=>{if(audio.paused){status.textContent='Paused';sync();}});"]
 ];for(const [old,replacement] of changes){assert.equal(after.split(old).length,2);after=after.replace(old,replacement);}let inverse=after;for(const [old,replacement] of changes.slice().reverse())inverse=inverse.replace(replacement,old);assert.equal(inverse,before);fs.writeFileSync(root+'/media.before.js',before);fs.writeFileSync(root+'/media.js',after);file.path=path.resolve(root+'/media.js').replaceAll('\\','/');file.sha256=sha(Buffer.from(after));m.revision='intentional-music-load-cancellation';m.updated=new Date().toISOString();fs.writeFileSync(root+'/canonical-route-manifest.json',JSON.stringify(m,null,2));fs.copyFileSync(parent+'/serve-canonical-preview.mjs',root+'/serve-canonical-preview.mjs');fs.writeFileSync(root+'/preparation.json',JSON.stringify({parent,changed:['/media.js'],unchangedRoutes:159,exactInverse:true,changes:changes.map(([old,replacement])=>({old,replacement}))},null,2));fs.writeFileSync(root+'/START-HERE.txt','Local portfolio http://127.0.0.1:4228/#music\r\nPlay can now be paused before audio data arrives without a false startup error. Stale play rejections do not overwrite a newer attempt. Onlymedia.jschanges;159otherroutebodies/4inputs preserved. Local unpublished.\r\n');console.log(JSON.stringify({prepared:root,changed:file.route,unchanged:159}));
