(() => {
  const {GIRLS,TAGS,OPENERS,CLOSERS} = SevenDialogue;
  const {create,submit,advance} = SevenLogic;
  const game = document.querySelector('#game'), scene = document.querySelector('#scene');
  const audio = document.querySelector('#audio'), music = document.querySelector('#music');
  let state, girl, parts=[], lastDelta=0, musicOn=false;
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button = (text,fn,cls='') => {const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=fn;return b;};
  function focusHeading(){game.querySelector('h1,h2')?.focus({preventScroll:true});}
  function backdrop(day=1){scene.innerHTML=day===7?SevenArt.bridge('sunset'):SevenArt.cafe(day);}
  function menu(){state=null;parts=[];backdrop();game.innerHTML='<h1 tabindex="-1">A week. A café. A spark.</h1><p>Build a reply from three word blocks. Read her interests, choose your tone, and see how it lands.</p><p class="sub">Seven days: six café conversations, then a date. Reach 80 connection by the end. Day 1 is practice: you cannot lose connection. No timer—take your time.</p><h2>Choose a table</h2><div class="partners"></div><p class="sub">Condensed prototype from surviving source. The original week has many more conversations.</p>';
    // Initial milestone uses the three grounded personas without book/canon connections.
    GIRLS.slice(0,3).forEach(g=>{const b=button('',()=>start(g),'partner');b.innerHTML='<strong>'+esc(g.key.replace('The ',''))+'</strong><small>'+esc(g.blurb)+'</small>';game.querySelector('.partners').append(b);});focusHeading();}
  function start(g){girl=g;state=create(g.key);parts=[];render();}
  function line(){return state.day===7?girl.final:girl.lines[state.day-1];}
  function options(){const slot=parts.length;if(slot===1)return line()[1].map(([text,tag])=>({text,tag}));const pool=slot===0?OPENERS:CLOSERS;
    const ranked=Object.keys(pool).sort((a,b)=>(girl.likes[b]||0)-(girl.likes[a]||0));const tags=[ranked[0],ranked[1],ranked[4],ranked[ranked.length-1]];
    // Rotate positions each day so the strongest reply is not always button one.
    return tags.map(tag=>({tag,text:pool[tag][(state.day-1)%pool[tag].length]})).sort((a,b)=>((tags.indexOf(a.tag)+state.day)%4)-((tags.indexOf(b.tag)+state.day)%4));}
  function select(p){if(!state||state.phase!=='choose'||parts.length>=3)return;parts.push(p);if(parts.length===3){const before=state.hearts;state=submit(state,girl,parts);lastDelta=state.hearts-before;}render();}
  function render(){backdrop(state.day);if(state.phase==='ended')return ending();
    const favorites=Object.entries(girl.likes).filter(([,v])=>v===2).map(([k])=>TAGS[k].label).join(' / ');
    game.innerHTML=`<div class="hud"><strong>${esc(girl.key.replace('The ',''))}</strong><span>Connection ${state.hearts} / 80</span></div><div class="meter" role="meter" aria-label="Connection" aria-valuemin="0" aria-valuemax="130" aria-valuenow="${state.hearts}"><div style="width:${state.hearts/1.3}%"></div></div><div class="days" aria-label="Seven days">${Array.from({length:7},(_,i)=>`<span class="${i+1===state.day?'active':i+1<state.day?'done':''}">${i+1}</span>`).join('')}</div><h2 tabindex="-1">Day ${state.day}${state.day===7?' · The date':state.day===1?' · First hello':''}</h2><p class="sub">Likes ${esc(favorites)} replies. ${esc(girl.blurb)}</p><p class="prompt">“${esc(line()[0])}”</p><div class="sentence" aria-label="Your reply">${parts.length?parts.map(p=>`<span>${esc(p.text)}</span>`).join(' '):'Your words go here…'}</div><div id="turn"></div>`;
    const turn=game.querySelector('#turn');
    if(state.phase==='choose'){turn.innerHTML=`<p class="sub">${['1 · Choose an opener','2 · Choose your answer (this matters most)','3 · Choose a closer'][parts.length]} · Tap or use keys 1–4</p><div class="choices"></div>`;
      options().forEach((p,i)=>{const b=button('',()=>select(p),'choice');b.innerHTML=`<small>${i+1} · ${esc(TAGS[p.tag].label)}</small>${esc(p.text)}`;turn.querySelector('.choices').append(b);});
      if(parts.length)turn.append(button('Undo last block',()=>{parts.pop();render();}));
    }else{const r=state.history.at(-1),kind=r.taste>=5?'love':r.taste>=2.5?'laugh':r.taste>=0?'confused':r.taste<=-3?'anger':'sad';
      turn.innerHTML=`<p class="status" role="status"><strong>${lastDelta>=0?'+':''}${lastDelta} connection${r.perfect?' · Great match':''}</strong>“${esc(girl.react[kind])}”<br><span class="sub">${r.taste>=2.5?'Your tone matched her interests.':r.taste>=0?'A mixed reply: try a tone she enjoys.':'That tone clashed with her interests.'}${state.day===1?' First hello is protected.':''}</span></p>`;
      turn.append(button(state.day===7||state.hearts===0?'See the ending':'Next day',()=>{state=advance(state);parts=[];render();focusHeading();},'primary'));
    }
    const actions=document.createElement('div');actions.className='actions';actions.append(button('Choose another table',menu));turn.append(actions);
  }
  function ending(){game.innerHTML=`<h1 tabindex="-1">${state.won?'A spark worth another cup.':'Some cups do not click.'}</h1><p>${state.won?'You won a heart. She would like to meet again.':'The conversation ends here. Try another tone—or another table.'}</p><p class="sub">${state.hearts} connection · ${state.history.length} days played · prototype target 80</p><ul class="review">${state.history.map(r=>`<li>Day ${r.day}: ${r.delta>=0?'+':''}${r.delta}${r.perfect?' · great match':''}</li>`).join('')}</ul><div class="actions"></div>`;game.querySelector('.actions').append(button('Replay this table',()=>start(girl),'primary'),button('Choose another table',menu));focusHeading();}
  music.onclick=async()=>{musicOn=!musicOn;if(musicOn){try{audio.volume=.35;await audio.play();}catch{musicOn=false;}}else audio.pause();music.textContent=musicOn?'Music on':'Music off';music.setAttribute('aria-pressed',String(musicOn));};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});
  document.addEventListener('pointerdown',()=>{if(musicOn&&audio.paused&&!document.hidden)audio.play().catch(()=>{});});
  document.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const i='1234'.indexOf(e.key);if(i>=0&&state?.phase==='choose'){e.preventDefault();const p=options()[i];if(p)select(p);}});
  menu();
})();
